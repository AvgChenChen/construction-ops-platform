import { formatDate, workingDaysBetween } from "./calendar";

/**
 * Blocker detection: a pure function over a project's task graph.
 *
 * A task that is not complete is:
 * - "blocked"  if it is marked BLOCKED, has an open blocking issue, or should
 *              already be under way (in progress, or planned start <= today)
 *              while a predecessor is still incomplete.
 * - "at_risk"  if a predecessor is incomplete and it is planned to start within
 *              the look-ahead window, or if it is past its planned finish date.
 *
 * For every flagged task we also report the root causes: the incomplete
 * upstream tasks whose own predecessors are all complete. Those are the tasks
 * somebody can actually act on today. If drywall waits on an inspection that
 * waits on electrical, the root cause is electrical, not the inspection.
 */

export type BlockerTask = {
  id: string;
  name: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETE";
  percentComplete: number;
  plannedStart: Date;
  plannedEnd: Date;
  dependsOn: string[];
  subcontractorName?: string | null;
};

export type BlockerIssue = {
  taskId: string | null;
  title: string;
  isBlocker: boolean;
  status: "OPEN" | "RESOLVED";
};

export type Blocker = {
  taskId: string;
  taskName: string;
  level: "blocked" | "at_risk";
  reasons: string[];
  waitingOn: { id: string; name: string }[];
  rootCauses: { id: string; name: string; percentComplete: number; plannedEnd: Date; overdue: boolean }[];
  plannedStart: Date;
};

const STATUS_TEXT: Record<BlockerTask["status"], string> = {
  NOT_STARTED: "not started",
  IN_PROGRESS: "in progress",
  BLOCKED: "blocked",
  COMPLETE: "complete",
};

export function detectBlockers(
  tasks: BlockerTask[],
  issues: BlockerIssue[],
  today: Date,
  lookaheadWorkingDays = 5,
): Blocker[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const isComplete = (id: string) => byId.get(id)?.status === "COMPLETE";

  const rootCausesFor = (taskId: string): BlockerTask[] => {
    const roots = new Map<string, BlockerTask>();
    const seen = new Set<string>();
    const stack = [...(byId.get(taskId)?.dependsOn ?? [])];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const t = byId.get(id);
      if (!t || t.status === "COMPLETE") continue;
      const openPreds = t.dependsOn.filter((p) => byId.has(p) && !isComplete(p));
      if (openPreds.length === 0) roots.set(t.id, t);
      else stack.push(...openPreds);
    }
    return [...roots.values()];
  };

  const blockers: Blocker[] = [];

  for (const task of tasks) {
    if (task.status === "COMPLETE") continue;

    const reasons: string[] = [];
    let level: Blocker["level"] | null = null;
    const escalate = (to: Blocker["level"]) => {
      if (level !== "blocked") level = to;
    };

    const waitingOn = task.dependsOn
      .map((id) => byId.get(id))
      .filter((t): t is BlockerTask => !!t && t.status !== "COMPLETE");

    const startsIn = workingDaysBetween(today, task.plannedStart);
    const shouldBeUnderWay = task.status === "IN_PROGRESS" || startsIn <= 0;

    if (task.status === "BLOCKED") {
      escalate("blocked");
      reasons.push("Marked as blocked by the site team.");
    }

    for (const issue of issues) {
      if (issue.taskId === task.id && issue.isBlocker && issue.status === "OPEN") {
        escalate("blocked");
        reasons.push(`Open blocking issue: ${issue.title}`);
      }
    }

    if (waitingOn.length > 0) {
      const list = waitingOn.map((t) => `${t.name} (${STATUS_TEXT[t.status]}, ${t.percentComplete}%)`).join(", ");
      if (shouldBeUnderWay) {
        escalate("blocked");
        reasons.push(
          startsIn < 0
            ? `Planned to start ${formatDate(task.plannedStart)} but still waiting on ${list}.`
            : `Scheduled to start today but still waiting on ${list}.`,
        );
      } else if (startsIn <= lookaheadWorkingDays) {
        escalate("at_risk");
        reasons.push(
          `Starts ${formatDate(task.plannedStart)} (in ${startsIn} working day${startsIn === 1 ? "" : "s"}) and is waiting on ${list}.`,
        );
      }
    }

    const overdueBy = workingDaysBetween(task.plannedEnd, today);
    if (overdueBy > 0) {
      escalate("at_risk");
      reasons.push(
        `Planned to finish ${formatDate(task.plannedEnd)}; now ${overdueBy} working day${overdueBy === 1 ? "" : "s"} late at ${task.percentComplete}%.`,
      );
    }

    if (level) {
      const roots = waitingOn.length > 0 ? rootCausesFor(task.id) : [];
      const indirectRoots = roots.filter((r) => !task.dependsOn.includes(r.id));
      if (indirectRoots.length > 0) {
        reasons.push(
          `Root cause upstream: ${indirectRoots.map((r) => `${r.name} (${r.percentComplete}%)`).join(", ")}.`,
        );
      }
      blockers.push({
        taskId: task.id,
        taskName: task.name,
        level,
        reasons,
        waitingOn: waitingOn.map((t) => ({ id: t.id, name: t.name })),
        rootCauses: roots.map((r) => ({
          id: r.id,
          name: r.name,
          percentComplete: r.percentComplete,
          plannedEnd: r.plannedEnd,
          overdue: workingDaysBetween(r.plannedEnd, today) > 0,
        })),
        plannedStart: task.plannedStart,
      });
    }
  }

  // Blocked before at-risk, then by how soon the task is meant to start.
  return blockers.sort((a, b) => {
    if (a.level !== b.level) return a.level === "blocked" ? -1 : 1;
    return a.plannedStart.getTime() - b.plannedStart.getTime();
  });
}

/** Duration-weighted progress across a project's tasks (0 to 100). */
export function projectProgress(tasks: { durationDays: number; percentComplete: number; status: string }[]): number {
  const total = tasks.reduce((s, t) => s + t.durationDays, 0);
  if (total === 0) return 0;
  const done = tasks.reduce((s, t) => s + t.durationDays * (t.status === "COMPLETE" ? 1 : t.percentComplete / 100), 0);
  return Math.round((done / total) * 100);
}

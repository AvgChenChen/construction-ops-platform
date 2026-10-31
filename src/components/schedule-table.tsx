import Link from "next/link";
import type { TaskStatus, Trade } from "@prisma/client";
import type { Blocker } from "@/lib/domain/blockers";
import { formatDate } from "@/lib/domain/calendar";
import { TRADE_LABELS } from "@/lib/domain/trades";
import { EmptyState, Table, Td, Th } from "./ui/primitives";
import { RiskBadge, TaskStatusBadge } from "./ui/status";

export type ScheduleRow = {
  id: string;
  name: string;
  trade: Trade;
  location: string | null;
  status: TaskStatus;
  percentComplete: number;
  plannedStart: Date;
  plannedEnd: Date;
  durationDays: number;
  subcontractor: { companyName: string } | null;
  dependencies: { dependsOnId: string }[];
};

const DAY = 86_400_000;

/** Task table with a proportional timeline. The vertical marker is today. */
export function ScheduleTable({
  projectId,
  rows,
  allTasks,
  blockers,
  today,
}: {
  projectId: string;
  rows: ScheduleRow[];
  allTasks: ScheduleRow[];
  blockers: Blocker[];
  today: Date;
}) {
  if (allTasks.length === 0)
    return (
      <div className="p-6">
        <EmptyState title="No tasks yet">Add the first task to start building the schedule.</EmptyState>
      </div>
    );
  if (rows.length === 0)
    return (
      <div className="p-6">
        <EmptyState title="No tasks match these filters" />
      </div>
    );
  const names = new Map(allTasks.map((t) => [t.id, t.name]));
  const risk = new Map(blockers.map((b) => [b.taskId, b.level]));
  const min = Math.min(...allTasks.map((t) => t.plannedStart.getTime()), today.getTime());
  const max = Math.max(...allTasks.map((t) => t.plannedEnd.getTime() + DAY), today.getTime() + DAY);
  const pct = (ms: number) => ((ms - min) / (max - min)) * 100;

  return (
    <Table label="Project schedule" minWidth={920}>
      <thead>
        <tr>
          <Th>Task</Th>
          <Th>Subcontractor</Th>
          <Th>Planned</Th>
          <Th>Status</Th>
          <Th className="w-[28%]">Timeline</Th>
        </tr>
      </thead>
      <tbody data-testid="schedule-table">
        {rows.map((t) => {
          const level = risk.get(t.id);
          const bar =
            t.status === "COMPLETE"
              ? "bg-success-ink/50"
              : level === "blocked"
                ? "bg-danger-ink"
                : level
                  ? "bg-accent"
                  : t.status === "IN_PROGRESS"
                    ? "bg-primary"
                    : "bg-line-strong";
          return (
            <tr key={t.id} className="hover:bg-canvas/60">
              <Td>
                <Link
                  href={`/projects/${projectId}/tasks/${t.id}`}
                  className="font-medium text-ink hover:text-primary hover:underline"
                >
                  {t.name}
                </Link>
                <div className="mt-0.5 text-xs text-ink-subtle">
                  {TRADE_LABELS[t.trade]}
                  {t.location ? ` · ${t.location}` : ""}
                </div>
                {t.dependencies.length > 0 ? (
                  <div className="mt-1 text-xs text-ink-subtle">
                    After {t.dependencies.map((d) => names.get(d.dependsOnId)).join(", ")}
                  </div>
                ) : null}
              </Td>
              <Td className="text-ink-muted">
                {t.subcontractor?.companyName ?? <span className="text-ink-subtle">Unassigned</span>}
              </Td>
              <Td className="whitespace-nowrap text-ink-muted tabular">
                {formatDate(t.plannedStart)} – {formatDate(t.plannedEnd)}
                <div className="text-xs text-ink-subtle">
                  {t.durationDays} working day{t.durationDays === 1 ? "" : "s"}
                </div>
              </Td>
              <Td>
                <div className="flex flex-col items-start gap-1">
                  <TaskStatusBadge status={t.status} />
                  {level ? <RiskBadge level={level} /> : null}
                  <span className="text-xs text-ink-subtle tabular">{t.percentComplete}% complete</span>
                </div>
              </Td>
              <Td>
                <div className="relative mt-1 h-4 rounded-sm bg-surface/70" aria-hidden>
                  <div
                    className={`absolute inset-y-0.5 rounded-sm ${bar}`}
                    style={{
                      left: `${pct(t.plannedStart.getTime())}%`,
                      width: `${Math.max(pct(t.plannedEnd.getTime() + DAY) - pct(t.plannedStart.getTime()), 1.5)}%`,
                    }}
                  />
                  <div className="absolute -inset-y-1 w-0.5 bg-accent" style={{ left: `${pct(today.getTime())}%` }} />
                </div>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

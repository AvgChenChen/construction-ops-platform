/**
 * Pure domain rules for the first Mills customer-facing workflow.
 *
 * This module deliberately has no database, network, SMS, or model dependency.
 * It can run in the browser for a fast pilot and on the server when the
 * persistence layer is added. AI may draft the explanation later, but the
 * dependency walk and state changes stay deterministic.
 */

export const tradeStatuses = ['ON_TRACK', 'AT_RISK', 'DELAYED', 'BLOCKED'] as const;
export type TradeStatus = (typeof tradeStatuses)[number];

export const impactSeverities = ['AT_RISK', 'DELAYED', 'BLOCKED'] as const;
export type ImpactSeverity = (typeof impactSeverities)[number];

export type MillsTrade = {
  id: string;
  name: string;
  company?: string;
  phone?: string;
};

export type MillsTask = {
  id: string;
  title: string;
  tradeId: string;
  startDate?: string;
  dueDate?: string;
  status: TradeStatus;
  /** IDs of tasks that must finish before this task can start. */
  dependencies: string[];
  note?: string;
};

export type MillsJob = {
  id: string;
  name: string;
  address?: string;
  trades: MillsTrade[];
  tasks: MillsTask[];
};

export type MillsStatusUpdate = {
  taskId: string;
  status: TradeStatus;
  reportedAt?: string;
  note?: string;
  eta?: string;
};

export type MillsImpact = {
  sourceTaskId: string;
  affectedTaskIds: string[];
  severity: ImpactSeverity;
  reason: string;
};

export type MillsMessageDraft = {
  jobId: string;
  sourceTaskId: string;
  recipientTradeIds: string[];
  body: string;
  requiresApproval: true;
};

function statusSeverity(status: TradeStatus): ImpactSeverity | null {
  if (status === 'BLOCKED') return 'BLOCKED';
  if (status === 'DELAYED') return 'DELAYED';
  if (status === 'AT_RISK') return 'AT_RISK';
  return null;
}

function severityRank(severity: ImpactSeverity): number {
  return severity === 'BLOCKED' ? 3 : severity === 'DELAYED' ? 2 : 1;
}

function maxSeverity(a: ImpactSeverity | null, b: ImpactSeverity | null): ImpactSeverity | null {
  if (!a) return b;
  if (!b) return a;
  return severityRank(a) >= severityRank(b) ? a : b;
}

function taskMap(job: MillsJob): Map<string, MillsTask> {
  return new Map(job.tasks.map((task) => [task.id, task]));
}

function validateJob(job: MillsJob): void {
  const ids = new Set(job.tasks.map((task) => task.id));
  for (const task of job.tasks) {
    for (const dependency of task.dependencies) {
      if (!ids.has(dependency)) {
        throw new Error(`Unknown dependency ${dependency} for task ${task.id}`);
      }
    }
  }
}

/**
 * Finds every task downstream of sourceTaskId, in dependency order.
 * Cycles are rejected because a schedule with a cycle cannot produce a useful
 * impact notification.
 */
export function downstreamTaskIds(job: MillsJob, sourceTaskId: string): string[] {
  validateJob(job);
  const tasks = taskMap(job);
  if (!tasks.has(sourceTaskId)) throw new Error(`Unknown task ${sourceTaskId}`);

  const dependents = new Map<string, string[]>();
  for (const task of job.tasks) {
    for (const dependency of task.dependencies) {
      const current = dependents.get(dependency) ?? [];
      current.push(task.id);
      dependents.set(dependency, current);
    }
  }

  const result: string[] = [];
  const seen = new Set<string>([sourceTaskId]);
  const queue = [...(dependents.get(sourceTaskId) ?? [])];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    queue.push(...(dependents.get(id) ?? []));
  }
  return result;
}

/**
 * Calculates the strongest impact a status can have on downstream work.
 * On-track updates intentionally produce no impact.
 */
export function detectImpacts(job: MillsJob, sourceTaskId: string, status?: TradeStatus): MillsImpact | null {
  const source = taskMap(job).get(sourceTaskId);
  if (!source) throw new Error(`Unknown task ${sourceTaskId}`);
  const sourceStatus = status ?? source.status;
  const sourceSeverity = statusSeverity(sourceStatus);
  if (!sourceSeverity) return null;

  const affectedTaskIds = downstreamTaskIds(job, sourceTaskId);
  if (!affectedTaskIds.length) return null;

  return {
    sourceTaskId,
    affectedTaskIds,
    severity: sourceSeverity,
    reason:
      sourceSeverity === 'AT_RISK'
        ? `${source.title} is at risk and may affect dependent work.`
        : sourceSeverity === 'DELAYED'
          ? `${source.title} is delayed; dependent work should be reconfirmed.`
          : `${source.title} is blocked; dependent work should pause until the blocker is cleared.`,
  };
}

/**
 * Applies a field update without mutating the input job and returns the
 * downstream impact produced by that update.
 */
export function applyStatusUpdate(job: MillsJob, update: MillsStatusUpdate): { job: MillsJob; impact: MillsImpact | null } {
  validateJob(job);
  const current = taskMap(job).get(update.taskId);
  if (!current) throw new Error(`Unknown task ${update.taskId}`);

  const impact = detectImpacts(job, update.taskId, update.status);
  const impactedIds = new Set(impact?.affectedTaskIds ?? []);
  const sourceSeverity = statusSeverity(update.status);
  const tasks = job.tasks.map((task) => {
    if (task.id === update.taskId) {
      return {
        ...task,
        status: update.status,
        note: update.note ?? task.note,
      };
    }
    if (!impactedIds.has(task.id) || !sourceSeverity) return { ...task };
    // Do not overwrite a stronger signal already recorded on a downstream task.
    const nextStatus = maxSeverity(statusSeverity(task.status), sourceSeverity) ?? task.status;
    return { ...task, status: nextStatus };
  });

  return { job: { ...job, tasks }, impact };
}

/** Creates an approval-gated SMS/email draft for impacted trades. */
export function draftImpactMessage(job: MillsJob, impact: MillsImpact): MillsMessageDraft {
  const tasks = taskMap(job);
  const source = tasks.get(impact.sourceTaskId);
  if (!source) throw new Error(`Unknown source task ${impact.sourceTaskId}`);

  const recipientTradeIds = [...new Set(
    impact.affectedTaskIds
      .map((id) => tasks.get(id)?.tradeId)
      .filter((id): id is string => Boolean(id) && id !== source.tradeId),
  )];
  const affectedTitles = impact.affectedTaskIds
    .map((id) => tasks.get(id)?.title)
    .filter((title): title is string => Boolean(title));
  const list = affectedTitles.length ? affectedTitles.join(', ') : 'dependent work';

  return {
    jobId: job.id,
    sourceTaskId: source.id,
    recipientTradeIds,
    requiresApproval: true,
    body: `Mills update for ${job.name}: ${source.title} is ${source.status.toLowerCase().replace('_', ' ')}. This may affect ${list}. Please confirm your timing or reply with a blocker.`,
  };
}


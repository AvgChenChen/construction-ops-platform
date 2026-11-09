import { z } from 'zod';

/*
 * Contract for any future AI worker in Mills. No worker calls a model today; this
 * guard is the boundary every worker result must pass before it is stored or shown.
 * The model can propose drafts only. Sending, submitting or contacting anyone is a
 * separate human action that this module never performs.
 */

/** Read-only tools a worker may request. Anything else is rejected. */
export const allowedWorkerTools = ['read_job_schedule', 'read_trade_status', 'draft_message'] as const;
const outboundPattern = /\b(send|email|sms|text|call|submit|post|publish|webhook|calendar|invite)\b/i;

export const workerResultSchema = z.object({
  workerId: z.string().min(1).max(80),
  taskId: z.string().uuid(),
  accountId: z.string().uuid(),
  auditEventId: z.string().uuid(),
  output: z.object({ summary: z.string().max(2000), draftMessage: z.string().max(4000).optional() }),
  evidence: z.array(z.object({ sourceId: z.string().uuid(), accountId: z.string().uuid(), quote: z.string().max(500) })).max(50),
  claims: z.array(z.object({ text: z.string().max(500), evidenceIds: z.array(z.string().uuid()).max(20) })).max(50),
  confidence: z.number().min(0).max(1),
  approvalStatus: z.literal('PENDING_HUMAN_APPROVAL'),
  toolCalls: z.array(z.object({ name: z.string().max(80) })).max(20),
}).strict();

export type WorkerResult = z.infer<typeof workerResultSchema>;
export type GuardOutcome = { ok: true; result: WorkerResult; needsReview: string[] } | { ok: false; reasons: string[] };

const overridePattern = /(ignore (all |any )?(previous|prior|above) instructions|you are now|system prompt|developer mode|approval (is )?(not )?required|already approved)/i;

/** Validate a raw model/worker result against tenant scope, tool policy and approval policy. */
export function guardWorkerResult(raw: unknown, scope: { accountId: string; taskId: string }): GuardOutcome {
  const parsed = workerResultSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reasons: ['invalid_structure'] };
  const result = parsed.data;
  const reasons: string[] = [];
  if (result.accountId !== scope.accountId || result.taskId !== scope.taskId) reasons.push('scope_mismatch');
  if (result.evidence.some((item) => item.accountId !== scope.accountId)) reasons.push('cross_tenant_evidence');
  for (const call of result.toolCalls) {
    if (!(allowedWorkerTools as readonly string[]).includes(call.name)) reasons.push(outboundPattern.test(call.name.replace(/_/g, ' ')) ? 'outbound_tool_blocked' : 'unauthorized_tool');
  }
  const text = `${result.output.summary}\n${result.output.draftMessage ?? ''}`;
  if (overridePattern.test(text)) reasons.push('instruction_override_in_output');
  // Links are the usual exfiltration channel (data packed into a URL); drafts never need one.
  if (/https?:\/\/|!\[[^\]]*\]\(/i.test(text)) reasons.push('link_in_output');
  if (reasons.length) return { ok: false, reasons: [...new Set(reasons)] };

  const evidenceIds = new Set(result.evidence.map((item) => item.sourceId));
  const needsReview: string[] = [];
  if (result.claims.some((claim) => !claim.evidenceIds.length || claim.evidenceIds.some((id) => !evidenceIds.has(id)))) needsReview.push('unsupported_claim');
  if (result.confidence < 0.6) needsReview.push('low_confidence');
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+?\d[\d\s().-]{8,}\d/i.test(text)) needsReview.push('contact_data_in_output');
  return { ok: true, result, needsReview };
}

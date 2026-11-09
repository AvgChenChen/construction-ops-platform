import { pool } from '../db';
import { equal } from '../auth';
import { configurationErrors } from './config';
import { redactLogDetail } from './redaction';

export const loops = ['mills'] as const;

export function monitoringAuthorized(req: Request) {
  const token = process.env.MONITORING_TOKEN;
  return !!token && token.length >= 32 && equal(req.headers.get('authorization') ?? '', `Bearer ${token}`);
}

export async function heartbeat(instance: string, loop: string, status: 'RUNNING' | 'OK' | 'ERROR') {
  await pool.query(
    "INSERT INTO worker_heartbeat(id,loop,status,failures,last_success) VALUES($1,$2,$3,CASE WHEN $3='ERROR' THEN 1 ELSE 0 END,CASE WHEN $3='OK' THEN now() END) ON CONFLICT(id) DO UPDATE SET status=$3,failures=CASE WHEN $3='ERROR' THEN worker_heartbeat.failures+1 WHEN $3='OK' THEN 0 ELSE worker_heartbeat.failures END,last_success=CASE WHEN $3='OK' THEN now() ELSE worker_heartbeat.last_success END,updated_at=now()",
    [`${instance}:${loop}`, loop, status],
  );
}

export async function operationalStatus() {
  const errors = configurationErrors();
  await pool.query('SELECT 1');
  const { rows: heartbeatRows } = await pool.query("SELECT bool_or(updated_at>now()-interval '180 seconds' AND last_success IS NOT NULL AND failures<3) AS healthy, extract(epoch FROM now()-max(updated_at))::int AS heartbeat_age, coalesce(max(failures),0)::int AS failures FROM worker_heartbeat WHERE loop='mills'");
  const workers = { mills: heartbeatRows[0]?.healthy === true };
  const heartbeatAgeSeconds: number | null = heartbeatRows[0]?.heartbeat_age ?? null;
  const workerFailures: number = heartbeatRows[0]?.failures ?? 0;
  const { rows: [counts] } = await pool.query("SELECT (SELECT count(*)::int FROM mills_job WHERE status='ACTIVE') AS active_jobs, (SELECT count(*)::int FROM mills_trade WHERE status IN ('DELAYED','BLOCKED')) AS attention_trades, (SELECT count(*)::int FROM mills_message WHERE status='DRAFT') AS pending_messages, (SELECT count(*)::int FROM mills_audit_event WHERE created_at>now()-interval '24 hours') AS recent_audits, (SELECT max(created_at) FROM backup_record) AS last_backup, (SELECT count(*)::int FROM task_event WHERE type='AUTH_SIGN_IN_FAILED' AND created_at>now()-interval '24 hours') AS auth_failures, (SELECT count(*)::int FROM task_event WHERE type='AUTH_OIDC_FAILED' AND created_at>now()-interval '24 hours') AS oidc_failures, (SELECT count(*)::int FROM task_event WHERE type='BACKUP_FAILED' AND created_at>now()-interval '24 hours') AS backup_failures, (SELECT max(created_at) FROM task_event WHERE type='RESTORE_DRILL_COMPLETED') AS last_restore_drill");
  const backupFresh = !!counts.last_backup && Date.now() - new Date(counts.last_backup).getTime() < 26 * 3600000;
  return {
    ready: errors.length === 0 && workers.mills,
    configurationErrors: errors,
    workers,
    counts: {
      activeJobs: counts.active_jobs,
      attentionTrades: counts.attention_trades,
      pendingMessages: counts.pending_messages,
      recentAudits: counts.recent_audits,
      lastBackup: counts.last_backup,
      authFailures24h: counts.auth_failures,
      oidcFailures24h: counts.oidc_failures,
      backupFailures24h: counts.backup_failures,
      lastRestoreDrill: counts.last_restore_drill,
    },
    heartbeatAgeSeconds,
    workerFailures,
    backupFresh,
  };
}

export function metrics(status: Awaited<ReturnType<typeof operationalStatus>>) {
  return [
    '# TYPE mills_ready gauge',
    `mills_ready ${Number(status.ready)}`,
    `mills_worker_healthy{loop="mills"} ${Number(status.workers.mills)}`,
    `mills_active_jobs ${status.counts.activeJobs}`,
    `mills_attention_trades ${status.counts.attentionTrades}`,
    `mills_pending_messages ${status.counts.pendingMessages}`,
    `mills_recent_audits ${status.counts.recentAudits}`,
    `mills_backup_fresh ${Number(status.backupFresh)}`,
    `mills_auth_failures_24h ${status.counts.authFailures24h}`,
    `mills_oidc_failures_24h ${status.counts.oidcFailures24h}`,
    `mills_backup_failures_24h ${status.counts.backupFailures24h}`,
    `mills_worker_consecutive_failures{loop="mills"} ${status.workerFailures}`,
    `mills_worker_heartbeat_age_seconds{loop="mills"} ${status.heartbeatAgeSeconds ?? -1}`,
    `mills_restore_drill_age_seconds ${status.counts.lastRestoreDrill ? Math.round((Date.now() - new Date(status.counts.lastRestoreDrill).getTime()) / 1000) : -1}`,
    '',
  ].join('\n');
}

export function safeLog(event: string, detail?: string) {
  console.log(JSON.stringify({ time: new Date().toISOString(), event, detail: redactLogDetail(detail) }));
}

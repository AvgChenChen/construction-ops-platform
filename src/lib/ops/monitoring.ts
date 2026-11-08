import { pool } from '../db';
import { equal } from '../auth';
import { configurationErrors } from './config';

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
  const { rows: heartbeatRows } = await pool.query("SELECT bool_or(updated_at>now()-interval '180 seconds' AND last_success IS NOT NULL AND failures<3) AS healthy FROM worker_heartbeat WHERE loop='mills'");
  const workers = { mills: heartbeatRows[0]?.healthy === true };
  const { rows: [counts] } = await pool.query("SELECT (SELECT count(*)::int FROM mills_job WHERE status='ACTIVE') AS active_jobs, (SELECT count(*)::int FROM mills_trade WHERE status IN ('DELAYED','BLOCKED')) AS attention_trades, (SELECT count(*)::int FROM mills_message WHERE status='DRAFT') AS pending_messages, (SELECT count(*)::int FROM mills_audit_event WHERE created_at>now()-interval '24 hours') AS recent_audits, (SELECT max(created_at) FROM backup_record) AS last_backup");
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
    },
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
    '',
  ].join('\n');
}

export function safeLog(event: string, detail?: string) {
  console.log(JSON.stringify({ time: new Date().toISOString(), event, detail }));
}

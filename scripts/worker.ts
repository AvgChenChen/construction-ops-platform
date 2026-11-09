import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { pool } from '../src/lib/db';
import { heartbeat, safeLog } from '../src/lib/ops/monitoring';
import { configurationErrors } from '../src/lib/ops/config';

let stopped = false;
const instance = randomUUID();
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { stopped = true; });

async function maintenanceTick() {
  await pool.query("DELETE FROM auth_session WHERE expires_at<now() OR last_seen<now()-interval '30 minutes'");
  await pool.query("DELETE FROM login_state WHERE expires_at<now()");
  await pool.query("DELETE FROM auth_throttle WHERE until<now()-interval '1 hour'");
}

async function main() {
  if (configurationErrors().length) throw new Error('INVALID_CONFIGURATION');
  safeLog('MILLS_WORKER_STARTED');
  while (!stopped) {
    try {
      const started = Date.now();
      await heartbeat(instance, 'mills', 'RUNNING');
      await maintenanceTick();
      await heartbeat(instance, 'mills', 'OK');
      const durationMs = Date.now() - started;
      if (durationMs > 1000) safeLog('MILLS_WORKER_SLOW_TICK', `duration_ms=${durationMs}`);
    } catch (error) {
      safeLog('MILLS_WORKER_ITERATION_FAILED', error instanceof Error ? error.name : 'unknown');
      try { await heartbeat(instance, 'mills', 'ERROR'); } catch { safeLog('MILLS_HEARTBEAT_WRITE_FAILED'); }
    }
    if (!stopped) await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  await pool.query('DELETE FROM worker_heartbeat WHERE id LIKE $1', [`${instance}:%`]);
  await pool.end();
  safeLog('MILLS_WORKER_STOPPED');
}

main().catch((error) => {
  safeLog('MILLS_WORKER_FATAL', error instanceof Error ? error.name : 'unknown');
  process.exit(1);
});

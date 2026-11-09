import 'dotenv/config';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('Dedicated TEST_DATABASE_URL ending _test is required');
process.env.DATABASE_URL = url;
process.env.APP_ORIGIN = 'http://127.0.0.1:3000';
process.env.DEPLOYMENT_ENV = 'local';
process.env.AUTH_MODE = 'local';
// Throwaway value generated per run; never a real credential.
process.env.DASHBOARD_PASSWORD = randomBytes(24).toString('hex');

const { db, pool } = await import('../src/lib/db');
const { migrate } = await import('drizzle-orm/node-postgres/migrator');
const auth = await import('../src/lib/auth');
const { heartbeat, operationalStatus, metrics } = await import('../src/lib/ops/monitoring');

beforeAll(async () => { await migrate(db, { migrationsFolder: './db/migrations' }); });
beforeEach(async () => { await pool.query("TRUNCATE auth_session, auth_throttle, worker_heartbeat; DELETE FROM task_event WHERE type LIKE 'AUTH_%'"); });
afterAll(async () => { await pool.end(); });

describe('local password sessions', () => {
  it('rejects wrong passwords and accepts the configured one', () => {
    expect(auth.validPassword('wrong')).toBe(false);
    expect(auth.validPassword('')).toBe(false);
    expect(auth.validPassword(process.env.DASHBOARD_PASSWORD!)).toBe(true);
  });

  it('throttles repeated login attempts per key', async () => {
    for (let i = 0; i < 10; i++) expect(await auth.allowLogin('test-key')).toBe(true);
    expect(await auth.allowLogin('test-key')).toBe(false);
    expect(await auth.allowLogin('other-key')).toBe(true);
  });

  it('expires sessions on the absolute limit and on inactivity', async () => {
    const absolute = await auth.makeSession();
    const idle = await auth.makeSession();
    expect(await auth.sessionActor(absolute)).toMatchObject({ id: 'local-operator' });
    await pool.query("UPDATE auth_session SET expires_at=now()-interval '1 second' WHERE hash=$1", [auth.hash(absolute)]);
    await pool.query("UPDATE auth_session SET last_seen=now()-interval '31 minutes' WHERE hash=$1", [auth.hash(idle)]);
    expect(await auth.sessionActor(absolute)).toBeNull();
    expect(await auth.sessionActor(idle)).toBeNull();
  });

  it('revokes a session and records sign-in, sign-out and failure events without secrets', async () => {
    const token = await auth.makeSession();
    await auth.revokeSession(token);
    expect(await auth.sessionActor(token)).toBeNull();
    await auth.recordAuthFailure('local');
    const { rows } = await pool.query("SELECT type, detail::text FROM task_event WHERE type LIKE 'AUTH_%' ORDER BY created_at");
    expect(rows.map((row) => row.type)).toEqual(['AUTH_SIGNED_IN', 'AUTH_SIGNED_OUT', 'AUTH_SIGN_IN_FAILED']);
    expect(JSON.stringify(rows)).not.toContain(process.env.DASHBOARD_PASSWORD);
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it('rejects malformed tokens without touching the database', async () => {
    expect(await auth.sessionActor('not-a-token')).toBeNull();
    expect(await auth.sessionActor("x' OR '1'='1")).toBeNull();
  });
});

describe('OIDC subject allowlist', () => {
  it('refuses identities that are not configured and allowlisted', async () => {
    await expect(auth.makeSession({ issuer: 'https://issuer.example', subject: 'someone' })).rejects.toThrow('IDENTITY_NOT_ALLOWED');
    const previous = { ...process.env };
    try {
      Object.assign(process.env, { AUTH_MODE: 'oidc', APP_ORIGIN: 'https://app.example.test', OIDC_ISSUER: 'https://issuer.example', OIDC_CLIENT_ID: 'test-client', OIDC_CLIENT_SECRET: 'test-only', OIDC_ALLOWED_SUBJECTS: 'allowed-subject' });
      await expect(auth.makeSession({ issuer: 'https://issuer.example', subject: 'intruder' })).rejects.toThrow('IDENTITY_NOT_ALLOWED');
      await expect(auth.makeSession({ issuer: 'https://evil.example', subject: 'allowed-subject' })).rejects.toThrow('IDENTITY_NOT_ALLOWED');
      const token = await auth.makeSession({ issuer: 'https://issuer.example', subject: 'allowed-subject' });
      expect(await auth.sessionActor(token)).not.toBeNull();
      process.env.OIDC_ALLOWED_SUBJECTS = 'someone-else';
      expect(await auth.sessionActor(token)).toBeNull();
    } finally {
      for (const key of ['AUTH_MODE', 'APP_ORIGIN', 'OIDC_ISSUER', 'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET', 'OIDC_ALLOWED_SUBJECTS']) {
        if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
      }
    }
  });
});

describe('worker heartbeat and metrics', () => {
  it('reports a fresh heartbeat and auth failure counts as aggregate metrics only', async () => {
    await heartbeat('test-instance', 'mills', 'OK');
    await auth.recordAuthFailure('oidc');
    const status = await operationalStatus();
    expect(status.workers.mills).toBe(true);
    expect(status.heartbeatAgeSeconds).toBeLessThan(5);
    const text = metrics(status);
    expect(text).toContain('mills_worker_healthy{loop="mills"} 1');
    expect(text).toContain('mills_oidc_failures_24h 1');
    expect(text).not.toMatch(/@|\+1 /);
  });
});

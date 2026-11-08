import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, open, rename, rm, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { Pool } from 'pg';

const header = Buffer.from('MILBAK01');

function key() {
  const value = process.env.BACKUP_ENCRYPTION_KEY ?? '';
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('BACKUP_KEY_REQUIRED');
  return Buffer.from(value, 'hex');
}

function pgEnvironment(url: string) {
  const parsed = new URL(url);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error('INVALID_DATABASE_URL');
  return {
    ...process.env,
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || '5432',
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
    PGDATABASE: decodeURIComponent(parsed.pathname.slice(1)),
    PGSSLMODE: parsed.searchParams.get('sslmode') ?? 'prefer',
    ...(parsed.searchParams.get('sslrootcert') ? { PGSSLROOTCERT: parsed.searchParams.get('sslrootcert')! } : {}),
  };
}

function child(binary: string, args: string[], url: string) {
  const process = spawn(binary, args, { env: pgEnvironment(url), stdio: ['ignore', 'pipe', 'ignore'] });
  const done = new Promise<void>((resolve, reject) => {
    process.once('error', () => reject(new Error('POSTGRES_TOOL_UNAVAILABLE')));
    process.once('exit', code => code === 0 ? resolve() : reject(new Error('POSTGRES_TOOL_FAILED')));
  });
  return { childProcess: process, done };
}

async function checksum(path: string) {
  const hash = createHash('sha256');
  for await (const part of createReadStream(path)) hash.update(part);
  return hash.digest('hex');
}

export async function createBackup(url: string, directory: string) {
  const secret = key();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const filename = `mills-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}.enc`;
  const final = join(directory, filename);
  const partial = `${final}.partial`;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secret, iv);
  const file = await open(partial, 'wx', 0o600);
  await file.write(Buffer.concat([header, iv]));
  await file.close();
  const { childProcess, done } = child(process.env.PG_DUMP_BIN ?? 'pg_dump', ['--format=custom', '--no-owner', '--no-acl', '--exclude-table-data=auth_session', '--exclude-table-data=login_state', '--exclude-table-data=auth_throttle', '--exclude-table-data=oauth_state', '--exclude-table-data=worker_heartbeat'], url);
  try {
    await Promise.all([pipeline(childProcess.stdout!, cipher, createWriteStream(partial, { flags: 'a', mode: 0o600 })), done]);
    const output = await open(partial, 'a');
    await output.write(cipher.getAuthTag());
    await output.sync();
    await output.close();
    await rename(partial, final);
    const bytes = (await stat(final)).size;
    const sha256 = await checksum(final);
    const db = new Pool({ connectionString: url });
    try { await db.query('INSERT INTO backup_record(filename,sha256,bytes) VALUES($1,$2,$3)', [filename, sha256, bytes]); } finally { await db.end(); }
    return { path: final, bytes, sha256 };
  } catch (error) {
    childProcess.kill();
    await rm(partial, { force: true });
    throw error;
  }
}

export async function decryptBackup(path: string, destination: string) {
  const file = await open(path, 'r');
  const size = (await file.stat()).size;
  let created = false;
  try {
    if (size < 37) throw new Error('INVALID_BACKUP');
    const start = Buffer.alloc(20);
    const tag = Buffer.alloc(16);
    await file.read(start, 0, 20, 0);
    await file.read(tag, 0, 16, size - 16);
    if (!start.subarray(0, 8).equals(header)) throw new Error('INVALID_BACKUP');
    const decipher = createDecipheriv('aes-256-gcm', key(), start.subarray(8));
    decipher.setAuthTag(tag);
    const output = await open(destination, 'wx', 0o600);
    created = true;
    try { await pipeline(createReadStream(path, { start: 20, end: size - 17 }), decipher, output.createWriteStream()); } finally { await output.close(); }
  } catch {
    if (created) await rm(destination, { force: true });
    throw new Error('BACKUP_AUTHENTICATION_FAILED');
  } finally {
    await file.close();
  }
}

export async function restoreBackup(path: string, targetUrl: string, confirmation: string) {
  const target = new URL(targetUrl);
  if (decodeURIComponent(target.pathname.slice(1)) !== confirmation || !confirmation.endsWith('_restore')) throw new Error('EMPTY_RESTORE_DATABASE_CONFIRMATION_REQUIRED');
  if (process.env.DATABASE_URL) {
    const source = new URL(process.env.DATABASE_URL);
    if (source.hostname === target.hostname && source.port === target.port && source.pathname === target.pathname) throw new Error('CANNOT_RESTORE_OVER_SOURCE');
  }
  const db = new Pool({ connectionString: targetUrl });
  const temporary = await mkdtemp(join(tmpdir(), 'mills-restore-'));
  const dump = join(temporary, 'database.dump');
  try {
    const { rows: [row] } = await db.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')");
    if (row.n !== 0) throw new Error('RESTORE_TARGET_NOT_EMPTY');
    await decryptBackup(path, dump);
    const { done } = child(process.env.PG_RESTORE_BIN ?? 'pg_restore', ['--no-owner', '--no-acl', '--exit-on-error', '--single-transaction', '--dbname', confirmation, dump], targetUrl);
    await done;
    await db.query('BEGIN; DELETE FROM auth_session; DELETE FROM login_state; DELETE FROM oauth_state; DELETE FROM auth_throttle; DELETE FROM worker_heartbeat; COMMIT;');
    return { restored: true, database: confirmation, reviewRequired: true, filename: basename(path) };
  } finally {
    await db.end();
    await rm(temporary, { recursive: true, force: true });
  }
}

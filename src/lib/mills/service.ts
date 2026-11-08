import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { pool, transaction } from '../db';
import { applyStatusUpdate, type TradeStatus } from './domain';

const statusSchema = z.enum(['ON_TRACK', 'AT_RISK', 'DELAYED', 'BLOCKED']);
const discoverySchema = z.enum(['PROSPECT', 'SCHEDULED', 'INTERVIEWED', 'PILOT', 'NOT_NOW']);

export type MillsWorkspace = {
  job: { id: string; accountId: string; name: string; address: string | null; status: string };
  trades: Array<{ id: string; trade: string; company: string; contact: string; phone: string; status: TradeStatus }>;
  tasks: Array<{ id: string; title: string; tradeId: string; due: string; dependsOn: string[]; note: string }>;
  contacts: Array<{ id: string; name: string; company: string; role: string; city: string; email: string; status: string; callDate: string; pain: number; notes: string; nextStep: string }>;
  messages: Array<{ id: string; sourceTaskId: string; body: string; status: string; createdAt: string }>;
};

export type MillsContractorWorkspace = {
  viewer: { tradeId: string; trade: string; company: string; contact: string };
  job: { id: string; name: string; address: string | null; status: string };
  trades: Array<{ id: string; trade: string; company: string; status: TradeStatus }>;
  tasks: Array<{ id: string; title: string; tradeId: string; due: string; dependsOn: string[]; note: string; status: TradeStatus }>;
  messages: Array<{ id: string; sourceTaskId: string; body: string; status: string; createdAt: string }>;
};

const defaultJobName = 'Bloor renovation pilot';
const defaultAccountSlug = 'mills-local';

type MillsAccess = { accountId: string; role: string };

async function accountForActor(client: { query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }> }, actorId: string, accountId?: string): Promise<MillsAccess> {
  const values: unknown[] = [actorId];
  let where = 'm.actor_id=$1 AND m.status=\'ACTIVE\'';
  if (accountId) { values.push(accountId); where += ' AND m.account_id=$2'; }
  const { rows: [membership] } = await client.query(`SELECT m.account_id,m.role FROM mills_membership m JOIN mills_account a ON a.id=m.account_id AND a.status='ACTIVE' WHERE ${where} ORDER BY m.created_at LIMIT 1`, values);
  if (!membership) throw new Error('Mills account access denied');
  return { accountId: membership.account_id, role: membership.role };
}

function requireOperatorRole(access: MillsAccess) {
  if (!['OWNER', 'OPS', 'GC', 'OPERATOR'].includes(access.role)) throw new Error('Mills operator access required');
}

async function requireKnownAccountActor(actorId: string) {
  if (actorId === 'local-operator') return;
  await accountForActor({ query: (text, values) => pool.query(text, values) }, actorId);
}

async function requireLocalOperatorContractorAccess(actorId: string) {
  if (actorId !== 'local-operator') return;
  const access = await accountForActor({ query: (text, values) => pool.query(text, values) }, actorId);
  requireOperatorRole(access);
}

async function assertOperatorJobAccess(client: { query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }> }, actorId: string, jobId: string) {
  const { rows: [job] } = await client.query('SELECT j.id,j.account_id FROM mills_job j WHERE j.id=$1', [jobId]);
  if (!job) throw new Error('Mills job not found');
  const access = await accountForActor(client, actorId, job.account_id);
  if (!['OWNER', 'OPS', 'GC', 'OPERATOR'].includes(access.role)) throw new Error('Mills operator access required');
  return { ...job, accountId: access.accountId };
}

async function recordAudit(client: { query: (text: string, values?: unknown[]) => Promise<unknown> }, values: { accountId: string; actorId: string; jobId?: string; tradeId?: string; action: string; beforeState?: unknown; afterState?: unknown }) {
  await client.query('INSERT INTO mills_audit_event(id,account_id,actor_id,job_id,trade_id,action,before_state,after_state) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [randomUUID(), values.accountId, values.actorId, values.jobId ?? null, values.tradeId ?? null, values.action, JSON.stringify(values.beforeState ?? {}), JSON.stringify(values.afterState ?? {})]);
}

async function ensureDefaultWorkspace() {
  return transaction(async (client) => {
    const { rows: [account] } = await client.query('SELECT id,name FROM mills_account WHERE slug=$1 LIMIT 1', [defaultAccountSlug]);
    const accountId = account?.id ?? randomUUID();
    if (!account) await client.query('INSERT INTO mills_account(id,name,slug,status) VALUES($1,$2,$3,$4)', [accountId, 'Mills local workspace', defaultAccountSlug, 'ACTIVE']);
    await client.query("INSERT INTO mills_membership(id,account_id,actor_id,role,status) VALUES($1,$2,$3,$4,$5) ON CONFLICT(account_id,actor_id) DO NOTHING", [randomUUID(), accountId, 'local-operator', 'OPS', 'ACTIVE']);
    const existing = await client.query('SELECT id,account_id,name,address,status FROM mills_job WHERE account_id=$1 AND name=$2 LIMIT 1', [accountId, defaultJobName]);
    let job = existing.rows[0];
    if (!job) {
      const jobId = randomUUID();
      const trades = [
        ['plumbing', 'Plumbing', 'Anson Plumbing', 'Anson', '+1 647 555 0101'],
        ['electrical', 'Electrical', 'Northline Electrical', 'Maya', '+1 416 555 0102'],
        ['drywall', 'Drywall', 'West End Drywall', 'Chris', '+1 416 555 0103'],
        ['painting', 'Painting', 'Lakeshore Finishes', 'Jordan', '+1 416 555 0104'],
      ] as const;
      await client.query('INSERT INTO mills_job(id,account_id,name,address,status) VALUES($1,$2,$3,$4,$5)', [jobId, accountId, defaultJobName, 'Toronto, ON', 'ACTIVE']);
      const ids = new Map<string, string>();
      for (const [key, trade, company, contact, phone] of trades) {
        const id = randomUUID();
        ids.set(key, id);
        await client.query('INSERT INTO mills_trade(id,job_id,trade,company,contact,phone,status) VALUES($1,$2,$3,$4,$5,$6,$7)', [id, jobId, trade, company, contact, phone, 'ON_TRACK']);
      }
      const tasks = [
        ['rough-plumbing', 'Rough plumbing complete', 'plumbing', '2026-11-12T12:00:00-05:00', []],
        ['rough-electrical', 'Rough electrical complete', 'electrical', '2026-11-14T12:00:00-05:00', ['rough-plumbing']],
        ['drywall-close', 'Close walls and hang drywall', 'drywall', '2026-11-18T12:00:00-05:00', ['rough-electrical']],
        ['paint-ready', 'Prime and paint main floor', 'painting', '2026-11-22T12:00:00-05:00', ['drywall-close']],
      ] as const;
      const taskIds = new Map<string, string>();
      for (const [key, title, tradeKey, due, dependencies] of tasks) {
        const id = randomUUID();
        taskIds.set(key, id);
        await client.query('INSERT INTO mills_task(id,job_id,trade_id,title,due_date,dependencies,status) VALUES($1,$2,$3,$4,$5,$6,$7)', [id, jobId, ids.get(tradeKey), title, due, JSON.stringify(dependencies.map((dependency) => taskIds.get(dependency) ?? dependency)), 'ON_TRACK']);
      }
      job = { id: jobId, account_id: accountId, name: defaultJobName, address: 'Toronto, ON', status: 'ACTIVE' };
      await client.query('INSERT INTO mills_contact(id,account_id,name,company,role,city,email,status,call_date,pain,notes,next_step) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [randomUUID(), accountId, 'Design partner candidate', 'Toronto Renovation Co.', 'Owner / GC', 'Toronto', '', 'SCHEDULED', '2026-11-07T10:00:00-05:00', 4, 'Currently uses a spreadsheet and group texts for trade updates.', 'Ask for a live-job walkthrough']);
      await client.query('INSERT INTO mills_contact(id,account_id,name,company,role,city,email,status,call_date,pain,notes,next_step) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [randomUUID(), accountId, 'Warm referral', 'Pacific Build Group', 'Project Manager', 'Vancouver', '', 'PROSPECT', null, 0, '', 'Send a short interview request']);
    }
    const tradeRows = await client.query('SELECT id,job_id FROM mills_trade WHERE job_id=$1', [job.id]);
    for (const trade of tradeRows.rows) await client.query("INSERT INTO mills_trade_membership(id,account_id,job_id,trade_id,actor_id,role,status) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(actor_id,trade_id) DO NOTHING", [randomUUID(), accountId, trade.job_id, trade.id, 'local-operator', 'CONTRACTOR', 'ACTIVE']);
    return job;
  });
}

export async function readWorkspace(actorId = 'local-operator'): Promise<MillsWorkspace> {
  await requireKnownAccountActor(actorId);
  const job = await ensureDefaultWorkspace();
  const access = await accountForActor({ query: (text, values) => pool.query(text, values) }, actorId, job.account_id);
  if (access.accountId !== job.account_id) throw new Error('Mills account access denied');
  requireOperatorRole(access);
  const [trades, tasks, contacts, messages] = await Promise.all([
    pool.query('SELECT id,trade,company,contact,phone,status FROM mills_trade WHERE job_id=$1 ORDER BY created_at', [job.id]),
    pool.query('SELECT id,title,trade_id,due_date,dependencies,note FROM mills_task WHERE job_id=$1 ORDER BY due_date NULLS LAST,created_at', [job.id]),
    pool.query('SELECT id,name,company,role,city,email,status,call_date,pain,notes,next_step FROM mills_contact WHERE account_id=$1 ORDER BY created_at DESC', [job.account_id]),
    pool.query('SELECT id,source_task_id,body,status,created_at FROM mills_message WHERE job_id=$1 ORDER BY created_at DESC LIMIT 50', [job.id]),
  ]);
  const taskIdByLegacy = new Map<string, string>();
  const mappedTasks = tasks.rows.map((row) => {
    const dependencies = Array.isArray(row.dependencies) ? row.dependencies : [];
    const mapped = dependencies.map((value: unknown) => String(value));
    return { id: row.id, title: row.title, tradeId: row.trade_id, due: row.due_date ? new Date(row.due_date).toISOString().slice(0, 10) : '', dependsOn: mapped, note: row.note ?? '' };
  });
  for (const task of mappedTasks) taskIdByLegacy.set(task.id, task.id);
  return {
    job: { id: job.id, accountId: job.account_id, name: job.name, address: job.address, status: job.status },
    trades: trades.rows.map((row) => ({ id: row.id, trade: row.trade, company: row.company, contact: row.contact, phone: row.phone ?? '', status: statusSchema.parse(row.status) })),
    tasks: mappedTasks.map((task) => ({ ...task, dependsOn: task.dependsOn.map((dependency: string) => taskIdByLegacy.get(dependency) ?? dependency) })),
    contacts: contacts.rows.map((row) => ({ id: row.id, name: row.name, company: row.company, role: row.role, city: row.city, email: row.email, status: discoverySchema.parse(row.status), callDate: row.call_date ? new Date(row.call_date).toISOString().slice(0, 16) : '', pain: row.pain, notes: row.notes, nextStep: row.next_step })),
    messages: messages.rows.map((row) => ({ id: row.id, sourceTaskId: row.source_task_id, body: row.body, status: row.status, createdAt: new Date(row.created_at).toISOString() })),
  };
}

export const contractorStatusUpdateSchema = z.object({ action: z.literal('updateTradeStatus'), tradeId: z.string().uuid(), status: statusSchema });

export async function readContractorWorkspace(actorId: string): Promise<MillsContractorWorkspace> {
  await requireLocalOperatorContractorAccess(actorId);
  await ensureDefaultWorkspace();
  const assigned = await pool.query('SELECT t.id,t.job_id,t.trade,t.company,t.contact,t.status FROM mills_trade t JOIN mills_job j ON j.id=t.job_id JOIN mills_account a ON a.id=j.account_id AND a.status=\'ACTIVE\' JOIN mills_trade_membership tm ON tm.trade_id=t.id AND tm.job_id=t.job_id AND tm.account_id=j.account_id WHERE tm.actor_id=$1 AND tm.role=\'CONTRACTOR\' AND tm.status=\'ACTIVE\' AND t.status IS NOT NULL ORDER BY t.created_at LIMIT 1', [actorId]);
  if (!assigned.rowCount) throw new Error('Contractor workspace access denied');
  const tradeIds = assigned.rows.map((row) => row.id as string);
  const jobIds = [...new Set(assigned.rows.map((row) => row.job_id as string))];
  const [jobs, tasks, messages] = await Promise.all([
    pool.query('SELECT id,name,address,status FROM mills_job WHERE id=ANY($1::uuid[]) ORDER BY created_at', [jobIds]),
    pool.query('SELECT id,title,trade_id,due_date,dependencies,note,status FROM mills_task WHERE trade_id=ANY($1::uuid[]) ORDER BY due_date NULLS LAST,created_at', [tradeIds]),
    pool.query('SELECT id,job_id,source_task_id,recipient_trade_ids,body,status,created_at FROM mills_message WHERE job_id=ANY($1::uuid[]) ORDER BY created_at DESC LIMIT 50', [jobIds]),
  ]);
  const tradeIdSet = new Set(tradeIds);
  const job = jobs.rows[0];
  if (!job) throw new Error('Contractor job not found');
  const mappedTasks = tasks.rows.map((row) => ({ id: row.id, title: row.title, tradeId: row.trade_id, due: row.due_date ? new Date(row.due_date).toISOString().slice(0, 10) : '', dependsOn: (Array.isArray(row.dependencies) ? row.dependencies : []).map((dependency: unknown) => String(dependency)), note: row.note ?? '', status: statusSchema.parse(row.status) }));
  return {
    viewer: { tradeId: assigned.rows[0].id, trade: assigned.rows[0].trade, company: assigned.rows[0].company, contact: assigned.rows[0].contact },
    job: { id: job.id, name: job.name, address: job.address, status: job.status },
    trades: assigned.rows.map((row) => ({ id: row.id, trade: row.trade, company: row.company, status: statusSchema.parse(row.status) })),
    tasks: mappedTasks,
    messages: messages.rows.filter((row) => (Array.isArray(row.recipient_trade_ids) ? row.recipient_trade_ids : []).some((id: unknown) => tradeIdSet.has(String(id)))).map((row) => ({ id: row.id, sourceTaskId: row.source_task_id, body: row.body, status: row.status, createdAt: new Date(row.created_at).toISOString() })),
  };
}

export async function executeContractorStatusUpdate(actorId: string, input: z.infer<typeof contractorStatusUpdateSchema>) {
  await requireLocalOperatorContractorAccess(actorId);
  return transaction(async (client) => {
    const { rows: [trade] } = await client.query('SELECT t.id,t.job_id,t.status,j.account_id FROM mills_trade t JOIN mills_job j ON j.id=t.job_id JOIN mills_account a ON a.id=j.account_id AND a.status=\'ACTIVE\' JOIN mills_trade_membership tm ON tm.trade_id=t.id AND tm.job_id=t.job_id AND tm.account_id=j.account_id WHERE t.id=$1 AND tm.actor_id=$2 AND tm.role=\'CONTRACTOR\' AND tm.status=\'ACTIVE\' FOR UPDATE', [input.tradeId, actorId]);
    if (!trade) throw new Error('Trade access denied');
    await client.query('UPDATE mills_trade SET status=$2,updated_at=now() WHERE id=$1', [input.tradeId, input.status]);
    await client.query('UPDATE mills_task SET status=$2,updated_at=now() WHERE trade_id=$1', [input.tradeId, input.status]);
    await recordAudit(client, { accountId: trade.account_id, actorId, jobId: trade.job_id, tradeId: trade.id, action: 'CONTRACTOR_STATUS_UPDATED', beforeState: { status: trade.status }, afterState: { status: input.status } });
    return { ok: true, jobId: trade.job_id, status: input.status };
  });
}

export const millsCommandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('updateTrade'), tradeId: z.string().uuid(), status: statusSchema }),
  z.object({ action: z.literal('addContact'), name: z.string().trim().min(1).max(160), company: z.string().trim().min(1).max(200), role: z.string().trim().max(120).default(''), city: z.string().trim().max(120).default(''), email: z.string().trim().email().or(z.literal('')).default('') }),
  z.object({ action: z.literal('updateContact'), contactId: z.string().uuid(), status: discoverySchema.optional(), nextStep: z.string().trim().max(300).optional(), notes: z.string().trim().max(2000).optional() }),
  z.object({ action: z.literal('recordMockMessage'), jobId: z.string().uuid(), sourceTaskId: z.string().uuid(), recipientTradeIds: z.array(z.string().uuid()).max(50), body: z.string().trim().min(1).max(4000), approved: z.literal(true) }),
]);

export async function executeCommand(input: z.infer<typeof millsCommandSchema>, actorId = 'local-operator') {
  await requireKnownAccountActor(actorId);
  await ensureDefaultWorkspace();
  if (input.action === 'updateTrade') {
    return transaction(async (client) => {
      const { rows: [trade] } = await client.query('SELECT t.id,t.job_id,t.trade,t.company,t.contact,t.phone,t.status,j.account_id FROM mills_trade t JOIN mills_job j ON j.id=t.job_id WHERE t.id=$1 FOR UPDATE', [input.tradeId]);
      if (!trade) throw new Error('Trade not found');
      const access = await assertOperatorJobAccess(client, actorId, trade.job_id);
      await client.query('UPDATE mills_trade SET status=$2,updated_at=now() WHERE id=$1', [input.tradeId, input.status]);
      await client.query('UPDATE mills_task SET status=$2,updated_at=now() WHERE trade_id=$1', [input.tradeId, input.status]);
      await recordAudit(client, { accountId: access.accountId, actorId, jobId: trade.job_id, tradeId: trade.id, action: 'TRADE_STATUS_UPDATED', beforeState: { status: trade.status }, afterState: { status: input.status } });
      return { ok: true, jobId: trade.job_id, status: input.status };
    });
  }
  if (input.action === 'addContact') {
    return transaction(async (client) => {
      const access = await accountForActor(client, actorId);
      requireOperatorRole(access);
      const id = randomUUID();
      await client.query('INSERT INTO mills_contact(id,account_id,name,company,role,city,email,status,call_date,pain,notes,next_step) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [id, access.accountId, input.name, input.company, input.role, input.city, input.email, 'PROSPECT', null, 0, '', 'Send interview request']);
      await recordAudit(client, { accountId: access.accountId, actorId, action: 'DISCOVERY_CONTACT_CREATED', afterState: { contactId: id, company: input.company, role: input.role, city: input.city } });
      return { id };
    });
  }
  if (input.action === 'updateContact') {
    return transaction(async (client) => {
      const { rows: [contact] } = await client.query('SELECT id,account_id,status,next_step,notes FROM mills_contact WHERE id=$1 FOR UPDATE', [input.contactId]);
      if (!contact) throw new Error('Discovery contact not found');
      const access = await accountForActor(client, actorId, contact.account_id);
      requireOperatorRole(access);
      const updates: string[] = [];
      const values: unknown[] = [];
      if (input.status) { values.push(input.status); updates.push(`status=$${values.length}`); }
      if (input.nextStep !== undefined) { values.push(input.nextStep); updates.push(`next_step=$${values.length}`); }
      if (input.notes !== undefined) { values.push(input.notes); updates.push(`notes=$${values.length}`); }
      if (!updates.length) return { ok: true };
      values.push(input.contactId);
      await client.query(`UPDATE mills_contact SET ${updates.join(',')},updated_at=now() WHERE id=$${values.length}`, values);
      await recordAudit(client, { accountId: access.accountId, actorId, action: 'DISCOVERY_CONTACT_UPDATED', afterState: { contactId: input.contactId, status: input.status ?? contact.status, nextStep: input.nextStep ?? contact.next_step, notes: input.notes ?? contact.notes } });
      return { ok: true };
    });
  }
  return transaction(async (client) => {
    const { rows: [task] } = await client.query('SELECT id,job_id FROM mills_task WHERE id=$1 FOR SHARE', [input.sourceTaskId]);
    if (!task || task.job_id !== input.jobId) throw new Error('Task does not belong to this Mills job');
    const access = await assertOperatorJobAccess(client, actorId, input.jobId);
    if (input.recipientTradeIds.length) {
      const recipients = await client.query('SELECT id FROM mills_trade WHERE job_id=$1 AND id=ANY($2::uuid[])', [input.jobId, input.recipientTradeIds]);
      if (recipients.rowCount !== input.recipientTradeIds.length) throw new Error('Recipient trade does not belong to this Mills job');
    }
    const messageId = randomUUID();
    await client.query('INSERT INTO mills_message(id,job_id,source_task_id,recipient_trade_ids,body,status,approved_at,sent_at,provenance) VALUES($1,$2,$3,$4,$5,$6,now(),now(),$7)', [messageId, input.jobId, input.sourceTaskId, JSON.stringify(input.recipientTradeIds), input.body, 'SENT_MOCK', 'MOCK']);
    await recordAudit(client, { accountId: access.accountId, actorId, jobId: input.jobId, action: 'MOCK_MESSAGE_RECORDED', afterState: { messageId, sourceTaskId: input.sourceTaskId, recipientTradeIds: input.recipientTradeIds } });
    return { ok: true, mockOnly: true };
  });
}

/* Keep the imported domain function in this module's dependency graph so the
 * persistence path is always paired with deterministic status rules. */
export { applyStatusUpdate };

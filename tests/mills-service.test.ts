import 'dotenv/config';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('Dedicated TEST_DATABASE_URL ending _test is required');
process.env.DATABASE_URL = url;

const { db, pool } = await import('../src/lib/db');
const { migrate } = await import('drizzle-orm/node-postgres/migrator');
const mills = await import('../src/lib/mills/service');

type TenantFixture = { accountId: string; jobId: string; tradeId: string; taskId: string };

async function createTenantFixture(actorId: string, role = 'OPS'): Promise<TenantFixture> {
  const accountId = randomUUID();
  const jobId = randomUUID();
  const tradeId = randomUUID();
  const taskId = randomUUID();
  await pool.query('INSERT INTO mills_account(id,name,slug,status) VALUES($1,$2,$3,$4)', [accountId, 'Secondary account', `secondary-${accountId}`, 'ACTIVE']);
  await pool.query('INSERT INTO mills_membership(id,account_id,actor_id,role,status) VALUES($1,$2,$3,$4,$5)', [randomUUID(), accountId, actorId, role, 'ACTIVE']);
  await pool.query('INSERT INTO mills_job(id,account_id,name,address,status) VALUES($1,$2,$3,$4,$5)', [jobId, accountId, 'Secondary renovation', 'Toronto, ON', 'ACTIVE']);
  await pool.query('INSERT INTO mills_trade(id,job_id,trade,company,contact,phone,status) VALUES($1,$2,$3,$4,$5,$6,$7)', [tradeId, jobId, 'Roofing', 'Secondary Roofing', 'Robin', '+1 416 555 0199', 'ON_TRACK']);
  await pool.query('INSERT INTO mills_task(id,job_id,trade_id,title,due_date,dependencies,status) VALUES($1,$2,$3,$4,$5,$6,$7)', [taskId, jobId, tradeId, 'Install roof membrane', '2026-11-30T12:00:00-05:00', JSON.stringify([]), 'ON_TRACK']);
  return { accountId, jobId, tradeId, taskId };
}

beforeAll(async () => { await migrate(db, { migrationsFolder: './db/migrations' }); });
beforeEach(async () => { await pool.query('TRUNCATE mills_audit_event,mills_message,mills_task,mills_trade_membership,mills_trade,mills_contact,mills_job,mills_membership,mills_account CASCADE'); });
afterAll(async () => { await pool.end(); });

describe('Mills MVP persistence', () => {
  it('seeds one reviewable pilot workspace on first read', async () => {
    const workspace = await mills.readWorkspace();
    expect(workspace.job.name).toBe('Bloor renovation pilot');
    expect(workspace.trades).toHaveLength(4);
    expect(workspace.tasks).toHaveLength(4);
    expect(workspace.contacts).toHaveLength(2);
    expect((await pool.query('SELECT count(*)::int AS count FROM mills_job')).rows[0].count).toBe(1);
  });

  it('persists a trade status update without contacting a trade', async () => {
    const workspace = await mills.readWorkspace();
    const plumbing = workspace.trades.find((trade) => trade.trade === 'Plumbing')!;
    await mills.executeCommand({ action: 'updateTrade', tradeId: plumbing.id, status: 'DELAYED' });
    const updated = (await mills.readWorkspace()).trades.find((trade) => trade.id === plumbing.id);
    expect(updated?.status).toBe('DELAYED');
    expect((await pool.query('SELECT count(*)::int AS count FROM mills_message')).rows[0].count).toBe(0);
    const audit = (await pool.query('SELECT account_id,actor_id,job_id,trade_id,action,before_state,after_state FROM mills_audit_event WHERE trade_id=$1', [plumbing.id])).rows[0];
    expect(audit).toMatchObject({
      account_id: workspace.job.accountId,
      actor_id: 'local-operator',
      job_id: workspace.job.id,
      trade_id: plumbing.id,
      action: 'TRADE_STATUS_UPDATED',
      before_state: { status: 'ON_TRACK' },
      after_state: { status: 'DELAYED' },
    });
  });

  it('validates discovery contact input before writing', async () => {
    expect(() => mills.millsCommandSchema.parse({ action: 'addContact', name: 'Test', company: 'Builder', email: 'not-an-email' })).toThrow();
    const result = await mills.executeCommand({ action: 'addContact', name: 'Test owner', company: 'Builder', role: 'Owner', city: 'Toronto', email: '' });
    expect('id' in result && result.id).toEqual(expect.any(String));
    expect((await mills.readWorkspace()).contacts.some((contact) => contact.name === 'Test owner')).toBe(true);
  });

  it('requires explicit approval and enforces job ownership for mock messages', async () => {
    const workspace = await mills.readWorkspace();
    const source = workspace.tasks[0];
    expect(() => mills.millsCommandSchema.parse({ action: 'recordMockMessage', jobId: workspace.job.id, sourceTaskId: source.id, recipientTradeIds: [], body: 'Draft', approved: false })).toThrow();
    await expect(mills.executeCommand({ action: 'recordMockMessage', jobId: randomUUID(), sourceTaskId: source.id, recipientTradeIds: [], body: 'Draft', approved: true })).rejects.toThrow('Task does not belong');
    await mills.executeCommand({ action: 'recordMockMessage', jobId: workspace.job.id, sourceTaskId: source.id, recipientTradeIds: [workspace.trades[1].id], body: 'Approved mock update', approved: true });
    expect((await mills.readWorkspace()).messages[0].status).toBe('SENT_MOCK');
  });

  it('rejects duplicate mock-message recipients before writing or auditing', async () => {
    const workspace = await mills.readWorkspace();
    const source = workspace.tasks[0];
    const duplicateInput = {
      action: 'recordMockMessage' as const,
      jobId: workspace.job.id,
      sourceTaskId: source.id,
      recipientTradeIds: [workspace.trades[0].id, workspace.trades[0].id],
      body: 'Duplicate recipient should be rejected',
      approved: true as const,
    };

    expect(() => mills.millsCommandSchema.parse(duplicateInput)).toThrow('recipientTradeIds must contain unique trade IDs');
    await expect(mills.executeCommand(duplicateInput)).rejects.toThrow('Recipient trade IDs must be unique');
    expect((await pool.query('SELECT count(*)::int AS count FROM mills_message')).rows[0].count).toBe(0);
    expect((await pool.query('SELECT count(*)::int AS count FROM mills_audit_event')).rows[0].count).toBe(0);
  });

  it('requires an active account membership and an operator role for operator mutations', async () => {
    const workspace = await mills.readWorkspace();
    const source = workspace.tasks[0];
    const addContact = { action: 'addContact' as const, name: 'Blocked contact', company: 'No access builder', role: 'Owner', city: 'Toronto', email: '' };
    const initialContacts = (await pool.query('SELECT count(*)::int AS count FROM mills_contact')).rows[0].count;

    await expect(mills.executeCommand({ action: 'updateTrade', tradeId: workspace.trades[0].id, status: 'BLOCKED' }, 'unknown-actor')).rejects.toThrow('Mills account access denied');
    await expect(mills.executeCommand(addContact, 'unknown-actor')).rejects.toThrow('Mills account access denied');
    await expect(mills.executeCommand({ action: 'recordMockMessage', jobId: workspace.job.id, sourceTaskId: source.id, recipientTradeIds: [], body: 'No access', approved: true }, 'unknown-actor')).rejects.toThrow('Mills account access denied');

    await pool.query('INSERT INTO mills_membership(id,account_id,actor_id,role,status) VALUES($1,$2,$3,$4,$5)', [randomUUID(), workspace.job.accountId, 'inactive-actor', 'OPS', 'INACTIVE']);
    await expect(mills.executeCommand(addContact, 'inactive-actor')).rejects.toThrow('Mills account access denied');

    await pool.query('INSERT INTO mills_membership(id,account_id,actor_id,role,status) VALUES($1,$2,$3,$4,$5)', [randomUUID(), workspace.job.accountId, 'contractor-only', 'CONTRACTOR', 'ACTIVE']);
    await expect(mills.readWorkspace('contractor-only')).rejects.toThrow('Mills operator access required');
    await expect(mills.executeCommand({ action: 'updateTrade', tradeId: workspace.trades[0].id, status: 'BLOCKED' }, 'contractor-only')).rejects.toThrow('Mills operator access required');
    await expect(mills.executeCommand(addContact, 'contractor-only')).rejects.toThrow('Mills operator access required');
    await expect(mills.executeCommand({ action: 'recordMockMessage', jobId: workspace.job.id, sourceTaskId: source.id, recipientTradeIds: [], body: 'Contractor cannot send', approved: true }, 'contractor-only')).rejects.toThrow('Mills operator access required');
    expect((await pool.query('SELECT count(*)::int AS count FROM mills_contact')).rows[0].count).toBe(initialContacts);
  });

  it('denies workspace reads to actors outside the account', async () => {
    await mills.readWorkspace();
    await expect(mills.readWorkspace('unknown-read-actor')).rejects.toThrow('Mills account access denied');
  });

  it('does not reactivate revoked local access or allow suspended accounts', async () => {
    const workspace = await mills.readWorkspace();
    await pool.query('UPDATE mills_membership SET status=$2 WHERE account_id=$1 AND actor_id=$3', [workspace.job.accountId, 'INACTIVE', 'local-operator']);
    await expect(mills.readWorkspace()).rejects.toThrow('Mills account access denied');
    await expect(mills.readContractorWorkspace('local-operator')).rejects.toThrow('Mills account access denied');
    expect((await pool.query('SELECT status FROM mills_membership WHERE account_id=$1 AND actor_id=$2', [workspace.job.accountId, 'local-operator'])).rows[0].status).toBe('INACTIVE');

    await pool.query('UPDATE mills_membership SET status=$2 WHERE account_id=$1 AND actor_id=$3', [workspace.job.accountId, 'ACTIVE', 'local-operator']);
    await pool.query('UPDATE mills_account SET status=$2 WHERE id=$1', [workspace.job.accountId, 'SUSPENDED']);
    await expect(mills.readWorkspace()).rejects.toThrow('Mills account access denied');
  });

  it('keeps operator mutations inside the actor account and permits a member of the matching account', async () => {
    const workspace = await mills.readWorkspace();
    const foreign = await createTenantFixture('secondary-operator');

    await expect(mills.executeCommand({ action: 'updateTrade', tradeId: foreign.tradeId, status: 'BLOCKED' }, 'local-operator')).rejects.toThrow('Mills account access denied');
    expect((await pool.query('SELECT status FROM mills_trade WHERE id=$1', [foreign.tradeId])).rows[0].status).toBe('ON_TRACK');

    await mills.executeCommand({ action: 'updateTrade', tradeId: foreign.tradeId, status: 'BLOCKED' }, 'secondary-operator');
    expect((await pool.query('SELECT status FROM mills_trade WHERE id=$1', [foreign.tradeId])).rows[0].status).toBe('BLOCKED');
    const audit = (await pool.query('SELECT account_id,actor_id,job_id,trade_id,action FROM mills_audit_event WHERE trade_id=$1', [foreign.tradeId])).rows[0];
    expect(audit).toMatchObject({ account_id: foreign.accountId, actor_id: 'secondary-operator', job_id: foreign.jobId, trade_id: foreign.tradeId, action: 'TRADE_STATUS_UPDATED' });
    expect(audit.account_id).not.toBe(workspace.job.accountId);
  });

  it('records account-scoped audit events for contact and approved message mutations', async () => {
    const workspace = await mills.readWorkspace();
    const source = workspace.tasks[0];
    const created = await mills.executeCommand({ action: 'addContact', name: 'Audit contact', company: 'Audit Builder', role: 'Owner', city: 'Toronto', email: '' });
    if (!('id' in created)) throw new Error('Expected contact id');
    await mills.executeCommand({ action: 'updateContact', contactId: created.id, status: 'INTERVIEWED', nextStep: 'Schedule a site visit', notes: 'Asked for a walkthrough.' });
    await mills.executeCommand({ action: 'recordMockMessage', jobId: workspace.job.id, sourceTaskId: source.id, recipientTradeIds: [workspace.trades[0].id], body: 'Approved audit message', approved: true });

    const rows = (await pool.query('SELECT account_id,actor_id,job_id,trade_id,action,before_state,after_state FROM mills_audit_event ORDER BY created_at,id')).rows;
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.action)).toEqual(expect.arrayContaining(['DISCOVERY_CONTACT_CREATED', 'DISCOVERY_CONTACT_UPDATED', 'MOCK_MESSAGE_RECORDED']));
    for (const row of rows) {
      expect(row.account_id).toBe(workspace.job.accountId);
      expect(row.actor_id).toBe('local-operator');
    }
    const contactCreated = rows.find((row) => row.action === 'DISCOVERY_CONTACT_CREATED');
    expect(contactCreated).toMatchObject({ job_id: null, trade_id: null, after_state: { contactId: created.id, company: 'Audit Builder', role: 'Owner', city: 'Toronto' } });
    const contactUpdated = rows.find((row) => row.action === 'DISCOVERY_CONTACT_UPDATED');
    expect(contactUpdated).toMatchObject({ job_id: null, trade_id: null, after_state: { contactId: created.id, status: 'INTERVIEWED', nextStep: 'Schedule a site visit', notes: 'Asked for a walkthrough.' } });
    const messageRecorded = rows.find((row) => row.action === 'MOCK_MESSAGE_RECORDED');
    expect(messageRecorded).toMatchObject({ job_id: workspace.job.id, trade_id: null, after_state: { sourceTaskId: source.id, recipientTradeIds: [workspace.trades[0].id] } });
  });

  it('limits contractor reads and writes to active trade memberships and recipient messages', async () => {
    const workspace = await mills.readWorkspace();
    const targetTrade = workspace.trades[0];
    const otherTrade = workspace.trades[1];
    const targetTask = workspace.tasks.find((task) => task.tradeId === targetTrade.id)!;
    const otherTask = workspace.tasks.find((task) => task.tradeId === otherTrade.id)!;
    const actorId = 'plumbing-contractor';

    await pool.query('INSERT INTO mills_trade_membership(id,account_id,job_id,trade_id,actor_id,role,status) VALUES($1,$2,$3,$4,$5,$6,$7)', [randomUUID(), workspace.job.accountId, workspace.job.id, targetTrade.id, actorId, 'CONTRACTOR', 'ACTIVE']);
    await mills.executeCommand({ action: 'recordMockMessage', jobId: workspace.job.id, sourceTaskId: targetTask.id, recipientTradeIds: [targetTrade.id], body: 'Visible to plumbing', approved: true });
    await mills.executeCommand({ action: 'recordMockMessage', jobId: workspace.job.id, sourceTaskId: otherTask.id, recipientTradeIds: [otherTrade.id], body: 'Visible only to electrical', approved: true });

    const contractor = await mills.readContractorWorkspace(actorId);
    expect(contractor.viewer).toMatchObject({ tradeId: targetTrade.id, trade: targetTrade.trade, company: targetTrade.company });
    expect(contractor.trades.map((trade) => trade.id)).toEqual([targetTrade.id]);
    expect(contractor.trades[0]).not.toHaveProperty('contact');
    expect(contractor.trades[0]).not.toHaveProperty('phone');
    expect(contractor.tasks.map((task) => task.id)).toEqual([targetTask.id]);
    expect(contractor.messages.map((message) => message.body)).toEqual(['Visible to plumbing']);

    await expect(mills.executeContractorStatusUpdate(actorId, { action: 'updateTradeStatus', tradeId: otherTrade.id, status: 'BLOCKED' })).rejects.toThrow('Trade access denied');
    await mills.executeContractorStatusUpdate(actorId, { action: 'updateTradeStatus', tradeId: targetTrade.id, status: 'DELAYED' });
    const updated = await mills.readContractorWorkspace(actorId);
    expect(updated.trades[0].status).toBe('DELAYED');
    expect(updated.tasks[0].status).toBe('DELAYED');
    const audit = (await pool.query('SELECT account_id,actor_id,job_id,trade_id,action,before_state,after_state FROM mills_audit_event WHERE action=$1', ['CONTRACTOR_STATUS_UPDATED'])).rows[0];
    expect(audit).toMatchObject({ account_id: workspace.job.accountId, actor_id: actorId, job_id: workspace.job.id, trade_id: targetTrade.id, action: 'CONTRACTOR_STATUS_UPDATED', before_state: { status: 'ON_TRACK' }, after_state: { status: 'DELAYED' } });

    await pool.query('UPDATE mills_trade_membership SET status=$2 WHERE actor_id=$1', [actorId, 'INACTIVE']);
    await expect(mills.readContractorWorkspace(actorId)).rejects.toThrow('Contractor workspace access denied');
  });

  it('requires contractor role on trade memberships', async () => {
    const workspace = await mills.readWorkspace();
    const targetTrade = workspace.trades[0];
    const actorId = 'ops-trade-membership';

    await pool.query('INSERT INTO mills_trade_membership(id,account_id,job_id,trade_id,actor_id,role,status) VALUES($1,$2,$3,$4,$5,$6,$7)', [randomUUID(), workspace.job.accountId, workspace.job.id, targetTrade.id, actorId, 'OPS', 'ACTIVE']);

    await expect(mills.readContractorWorkspace(actorId)).rejects.toThrow('Contractor workspace access denied');
    await expect(mills.executeContractorStatusUpdate(actorId, { action: 'updateTradeStatus', tradeId: targetTrade.id, status: 'DELAYED' })).rejects.toThrow('Trade access denied');
    expect((await pool.query('SELECT status FROM mills_trade WHERE id=$1', [targetTrade.id])).rows[0].status).toBe('ON_TRACK');
  });

  it('rejects cross-account trade membership records', async () => {
    const workspace = await mills.readWorkspace();
    const targetTrade = workspace.trades[0];
    const foreign = await createTenantFixture('foreign-contractor', 'CONTRACTOR');
    await pool.query('INSERT INTO mills_trade_membership(id,account_id,job_id,trade_id,actor_id,role,status) VALUES($1,$2,$3,$4,$5,$6,$7)', [randomUUID(), foreign.accountId, foreign.jobId, foreign.tradeId, 'foreign-contractor', 'CONTRACTOR', 'ACTIVE']);
    await expect(pool.query('INSERT INTO mills_trade_membership(id,account_id,job_id,trade_id,actor_id,role,status) VALUES($1,$2,$3,$4,$5,$6,$7)', [randomUUID(), foreign.accountId, workspace.job.id, targetTrade.id, 'foreign-contractor', 'CONTRACTOR', 'ACTIVE'])).rejects.toThrow('foreign key');
    expect((await mills.readContractorWorkspace('foreign-contractor')).viewer.tradeId).toBe(foreign.tradeId);
    await expect(mills.executeContractorStatusUpdate('foreign-contractor', { action: 'updateTradeStatus', tradeId: targetTrade.id, status: 'BLOCKED' })).rejects.toThrow('Trade access denied');
  });
});

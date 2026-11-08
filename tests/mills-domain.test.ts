import { describe, expect, it } from 'vitest';
import {
  applyStatusUpdate,
  detectImpacts,
  draftImpactMessage,
  downstreamTaskIds,
  type MillsJob,
} from '../src/lib/mills/domain';

const job = (): MillsJob => ({
  id: 'job-1',
  name: 'Queen Street renovation',
  trades: [
    { id: 'plumbing', name: 'Plumbing', company: 'Anson Plumbing' },
    { id: 'electrical', name: 'Electrical', company: 'Northline Electric' },
    { id: 'drywall', name: 'Drywall', company: 'Smooth Finish' },
  ],
  tasks: [
    { id: 'rough-plumbing', title: 'Rough plumbing', tradeId: 'plumbing', status: 'ON_TRACK', dependencies: [] },
    { id: 'rough-electrical', title: 'Rough electrical', tradeId: 'electrical', status: 'ON_TRACK', dependencies: ['rough-plumbing'] },
    { id: 'drywall-close', title: 'Close drywall', tradeId: 'drywall', status: 'ON_TRACK', dependencies: ['rough-electrical'] },
  ],
});

describe('Mills scheduling domain', () => {
  it('walks all downstream tasks in dependency order', () => {
    expect(downstreamTaskIds(job(), 'rough-plumbing')).toEqual(['rough-electrical', 'drywall-close']);
  });

  it('does not produce an impact for an on-track update', () => {
    expect(detectImpacts(job(), 'rough-plumbing', 'ON_TRACK')).toBeNull();
  });

  it('marks dependent work at risk and leaves the original job untouched', () => {
    const original = job();
    const result = applyStatusUpdate(original, { taskId: 'rough-plumbing', status: 'DELAYED', note: 'Fixture missing' });
    expect(result.impact).toMatchObject({ sourceTaskId: 'rough-plumbing', severity: 'DELAYED' });
    expect(result.job.tasks.map((task) => [task.id, task.status])).toEqual([
      ['rough-plumbing', 'DELAYED'],
      ['rough-electrical', 'DELAYED'],
      ['drywall-close', 'DELAYED'],
    ]);
    expect(original.tasks.every((task) => task.status === 'ON_TRACK')).toBe(true);
  });

  it('does not downgrade a stronger downstream signal', () => {
    const source = job();
    source.tasks[1].status = 'BLOCKED';
    const result = applyStatusUpdate(source, { taskId: 'rough-plumbing', status: 'AT_RISK' });
    expect(result.job.tasks.find((task) => task.id === 'rough-electrical')?.status).toBe('BLOCKED');
  });

  it('drafts an approval-gated message to affected trades', () => {
    const current = applyStatusUpdate(job(), { taskId: 'rough-plumbing', status: 'BLOCKED' });
    const draft = draftImpactMessage(current.job, current.impact!);
    expect(draft.requiresApproval).toBe(true);
    expect(draft.recipientTradeIds).toEqual(['electrical', 'drywall']);
    expect(draft.body).toContain('Queen Street renovation');
    expect(draft.body).toContain('Rough plumbing');
  });

  it('rejects unknown dependencies and tasks', () => {
    const invalid = job();
    invalid.tasks[1].dependencies = ['missing'];
    expect(() => downstreamTaskIds(invalid, 'rough-plumbing')).toThrow('Unknown dependency');
    expect(() => applyStatusUpdate(job(), { taskId: 'missing', status: 'DELAYED' })).toThrow('Unknown task');
  });
});

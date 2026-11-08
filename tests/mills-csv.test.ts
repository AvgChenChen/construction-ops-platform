import { describe, expect, it } from 'vitest';
import { discoveryContactsToCsv } from '../src/lib/mills/csv';

describe('discovery CSV export', () => {
  it('escapes commas, quotes, and newlines without changing the data', () => {
    const csv = discoveryContactsToCsv([{
      name: 'Maya Singh',
      company: 'Northline, Build Group',
      role: 'Operations "lead"',
      city: 'Toronto',
      email: 'maya@example.com',
      status: 'SCHEDULED',
      nextStep: 'Ask about the last delay',
      notes: 'Uses group texts\nand a spreadsheet.',
    }]);

    expect(csv).toContain('Name,Company,Role,City,Work email,Stage,Next step,Notes');
    expect(csv).toContain('Maya Singh,"Northline, Build Group","Operations ""lead""",Toronto,maya@example.com,SCHEDULED,Ask about the last delay,"Uses group texts\nand a spreadsheet."');
    expect(csv.endsWith('\r\n')).toBe(true);
  });
});

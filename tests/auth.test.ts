import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from '../src/lib/auth';

describe('safe login redirects', () => {
  it('keeps valid internal paths and their query strings', () => {
    expect(safeRedirectPath('/hq?tab=growth#queue')).toBe('/hq?tab=growth#queue');
  });

  it('rejects external and protocol-relative destinations', () => {
    expect(safeRedirectPath('https://evil.example/')).toBe('/mills');
    expect(safeRedirectPath('//evil.example/')).toBe('/mills');
    expect(safeRedirectPath('/\\evil.example/')).toBe('/mills');
    expect(safeRedirectPath('/\\/evil.example/')).toBe('/mills');
  });

  it('rejects API destinations and falls back for missing input', () => {
    expect(safeRedirectPath('/api/metrics')).toBe('/mills');
    expect(safeRedirectPath(undefined)).toBe('/mills');
  });
});

import { describe, it, expect } from 'vitest';
import { describeDataFreshness } from '../freshness.js';

const base = {
  status: 'OPEN',
  dataAsOf: '2026-07-30',
  todayIST: '2026-07-30',
  fetchedAt: Date.parse('2026-07-30T09:30:00Z'),
  providerId: 'yahoo',
};

describe('describeDataFreshness', () => {
  it('reports not-loaded before any fetch has succeeded, and does not claim data is live', () => {
    const r = describeDataFreshness({ ...base, fetchedAt: null });
    expect(r.isLoaded).toBe(false);
    expect(r.isStaleWhileOpen).toBe(false);
    expect(r.message).toMatch(/loading/i);
  });

  it('flags stale data when the market is OPEN but the newest bar predates today', () => {
    const r = describeDataFreshness({ ...base, status: 'OPEN', dataAsOf: '2026-07-28', todayIST: '2026-07-30' });
    expect(r.isStaleWhileOpen).toBe(true);
    expect(r.severity).toBe('warn');
    expect(r.message).toContain('2026-07-28');
  });

  it('does NOT flag stale when the market is open and data is from today', () => {
    const r = describeDataFreshness({ ...base, status: 'OPEN', dataAsOf: '2026-07-30', todayIST: '2026-07-30' });
    expect(r.isStaleWhileOpen).toBe(false);
    expect(r.severity).toBe('ok');
  });

  it('treats an older close as expected (not stale) when the market is closed/weekend/holiday', () => {
    for (const status of ['CLOSED', 'WEEKEND', 'HOLIDAY']) {
      const r = describeDataFreshness({ ...base, status, dataAsOf: '2026-07-24', todayIST: '2026-07-30' });
      expect(r.isStaleWhileOpen).toBe(false);
      expect(r.severity).toBe('ok');
      // The whole point of spec Section 22: say it's the last available
      // close, rather than implying it's live.
      expect(r.message).toMatch(/last available close/i);
      expect(r.message).toContain('2026-07-24');
    }
  });

  it('surfaces synthetic/mock data as a warning regardless of market status', () => {
    expect(describeDataFreshness({ ...base, providerId: 'mock' }).isSynthetic).toBe(true);
    expect(describeDataFreshness({ ...base, providerId: 'yahoo' }).isSynthetic).toBe(false);
    expect(describeDataFreshness({ ...base, status: 'CLOSED', providerId: 'mock' }).isSynthetic).toBe(true);
  });

  it('handles a missing dataAsOf without producing "undefined" in user-facing text', () => {
    const open = describeDataFreshness({ ...base, dataAsOf: null, status: 'OPEN' });
    const closed = describeDataFreshness({ ...base, dataAsOf: null, status: 'CLOSED' });
    expect(open.isStaleWhileOpen).toBe(false); // can't claim stale without knowing the date
    expect(open.message).not.toMatch(/undefined|null/);
    expect(closed.message).not.toMatch(/undefined|null/);
  });

  it('compares dates lexically across month and year boundaries', () => {
    expect(describeDataFreshness({ ...base, status: 'OPEN', dataAsOf: '2026-12-31', todayIST: '2027-01-04' }).isStaleWhileOpen).toBe(true);
    expect(describeDataFreshness({ ...base, status: 'OPEN', dataAsOf: '2026-09-30', todayIST: '2026-10-01' }).isStaleWhileOpen).toBe(true);
  });
});

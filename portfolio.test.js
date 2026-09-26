import { describe, it, expect } from 'vitest';
import { equalWeightAllocation, calculateShares, buildPositions, markToExit } from '../portfolio.js';

describe('equalWeightAllocation — spec Section 12 worked example', () => {
  it('₹50,000 / 5 stocks = ₹10,000 per stock', () => {
    expect(equalWeightAllocation(50_000, 5)).toBe(10_000);
  });
});

describe('calculateShares — whole shares only (spec Section 13)', () => {
  it('floors instead of allowing fractional shares', () => {
    expect(calculateShares(10_000, 3000)).toBe(3); // 3.33 -> 3
    expect(calculateShares(10_000, 2500)).toBe(4); // exact
    expect(calculateShares(10_000, 10_001)).toBe(0); // can't afford even one share
  });

  it('throws on invalid entry price rather than dividing by zero', () => {
    expect(() => calculateShares(10_000, 0)).toThrow();
    expect(() => calculateShares(10_000, -50)).toThrow();
  });
});

describe('buildPositions — full worked example, 5 stocks / ₹50,000', () => {
  const picks = [
    { symbol: 'A', name: 'A Ltd', entryPrice: 1000 },
    { symbol: 'B', name: 'B Ltd', entryPrice: 333 },
    { symbol: 'C', name: 'C Ltd', entryPrice: 2000 },
    { symbol: 'D', name: 'D Ltd', entryPrice: 750 },
    { symbol: 'E', name: 'E Ltd', entryPrice: 3000 },
  ];
  const { positions, totalInvested, remainingCash } = buildPositions(picks, 50_000);

  it('allocates ₹10,000 target per stock', () => {
    positions.forEach((p) => expect(p.targetAllocation).toBe(10_000));
  });

  it('computes whole shares and actual invested amount per stock', () => {
    expect(positions.find((p) => p.symbol === 'A').shares).toBe(10); // 10000/1000
    expect(positions.find((p) => p.symbol === 'B').shares).toBe(30); // floor(10000/333)=30
    expect(positions.find((p) => p.symbol === 'E').shares).toBe(3); // floor(10000/3000)=3
  });

  it('total invested + remaining cash reconciles exactly to starting capital', () => {
    expect(totalInvested + remainingCash).toBeCloseTo(50_000, 8);
  });

  it('remaining cash is the sum of each stock leftover from flooring', () => {
    const expectedRemaining = positions.reduce((sum, p) => sum + p.remaining, 0);
    expect(remainingCash).toBeCloseTo(expectedRemaining, 8);
  });
});

describe('markToExit', () => {
  it('values each position at the exit price and flags any missing exit price instead of pricing it at zero', () => {
    const positions = [
      { symbol: 'A', shares: 10, invested: 10_000 },
      { symbol: 'B', shares: 5, invested: 5_000 },
    ];
    const { positions: marked, totalExitValue, flags } = markToExit(positions, new Map([['A', 1100]]));
    expect(marked.find((p) => p.symbol === 'A').exitValue).toBe(11_000);
    expect(marked.find((p) => p.symbol === 'B').exitValue).toBeNull();
    expect(totalExitValue).toBe(11_000); // B excluded, not counted as zero silently merged in without a flag
    expect(flags.length).toBe(1);
  });
});

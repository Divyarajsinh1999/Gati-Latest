import { describe, it, expect } from 'vitest';
import { calculateTradeCost, calculateRoundTripCost } from '../transactionCosts.js';

const costConfig = {
  enabled: true,
  brokeragePct: 0,
  sttPct: 0.1,
  exchangeTxnPct: 0.003,
  sebiFeePct: 0.0001,
  stampDutyPct: 0.015,
  gstPct: 18,
  slippagePct: 0.05,
};

describe('calculateTradeCost — OFF by default (spec Section 16)', () => {
  it('returns all zeros when costs are disabled, so a gross backtest is a true no-op', () => {
    const result = calculateTradeCost(100_000, 'buy', { ...costConfig, enabled: false });
    expect(result.total).toBe(0);
    expect(Object.values(result).every((v) => v === 0)).toBe(true);
  });
});

describe('calculateTradeCost — enabled', () => {
  it('applies stamp duty only on the buy side, never on sell', () => {
    const buy = calculateTradeCost(100_000, 'buy', costConfig);
    const sell = calculateTradeCost(100_000, 'sell', costConfig);
    expect(buy.stampDuty).toBeCloseTo(15, 6); // 0.015% of 100,000
    expect(sell.stampDuty).toBe(0);
  });

  it('charges STT on both sides equally', () => {
    const buy = calculateTradeCost(100_000, 'buy', costConfig);
    const sell = calculateTradeCost(100_000, 'sell', costConfig);
    expect(buy.stt).toBeCloseTo(100, 6); // 0.1% of 100,000
    expect(sell.stt).toBeCloseTo(100, 6);
  });

  it('computes GST only on brokerage + exchange charges + SEBI fee, never on STT or stamp duty', () => {
    const result = calculateTradeCost(100_000, 'buy', costConfig);
    const gstableBase = result.brokerage + result.exchangeTxn + result.sebiFee;
    expect(result.gst).toBeCloseTo(gstableBase * 0.18, 6);
    // Sanity: GST should be a small fraction of the total, not comparable to STT
    expect(result.gst).toBeLessThan(result.stt);
  });

  it('returns zero cost for a zero-value trade instead of NaN', () => {
    expect(calculateTradeCost(0, 'buy', costConfig).total).toBe(0);
  });
});

describe('calculateRoundTripCost', () => {
  it('sums independent buy-side and sell-side costs for entry and exit values', () => {
    const roundTrip = calculateRoundTripCost(100_000, 110_000, costConfig);
    const buy = calculateTradeCost(100_000, 'buy', costConfig).total;
    const sell = calculateTradeCost(110_000, 'sell', costConfig).total;
    expect(roundTrip).toBeCloseTo(buy + sell, 6);
  });
});

import { calculateCostMicros, PRICING_TABLE, PRICING_VERSION } from '../src/cost/pricing';

describe('Functions Cost Calculations', () => {
  test('uses integer micros with no floating point inaccuracies', () => {
    const cost = calculateCostMicros('gemini-3.6-flash', 1000, 1000);
    expect(Number.isInteger(cost)).toBe(true);
    expect(cost).toBe(75 + 300); // 375 micros
  });

  test('calculates mock-model costs deterministically', () => {
    const cost = calculateCostMicros('mock-model', 1000, 1000, 2000);
    expect(cost).toBe(10 + 20 + 10); // 40 micros
  });

  test('handles zero token inputs gracefully', () => {
    const cost = calculateCostMicros('gemini-3.6-flash', 0, 0, 0);
    expect(cost).toBe(0);
  });

  test('has current pricing version defined', () => {
    expect(PRICING_VERSION).toBe('2026-09-01');
    expect(PRICING_TABLE['gemini-3.6-flash']).toBeDefined();
    expect(PRICING_TABLE['gemini-3.8-flash']).toBeDefined();
    expect(PRICING_TABLE['gemini-4']).toBeDefined();
  });
});

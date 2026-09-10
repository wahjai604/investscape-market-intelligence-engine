import { escalateCost, weightedConsensus } from "../../src/cre-intelligence/consensus";
import type { CREObservation } from "../../src/cre-intelligence/types";

const base = (overrides: Partial<CREObservation>): CREObservation => ({
  metric: "cap_rate",
  assetClass: "industrial",
  geography: { country: "CA", city: "Vancouver", metro: "Vancouver" },
  periodStart: "2026-04-01",
  periodEnd: "2026-06-30",
  low: 0.055,
  high: 0.06,
  unit: "decimal",
  source: { sourceId: "test", sourceName: "Test", sourceType: "brokerage" },
  sourceQuality: 90,
  ...overrides,
});

describe("E68 CRE intelligence consensus", () => {
  test("weights point estimates by explicit source quality", () => {
    const result = weightedConsensus([
      base({ value: 0.055, low: undefined, high: undefined, sourceQuality: 100, source: { sourceId: "a", sourceName: "A", sourceType: "brokerage" } }),
      base({ value: 0.065, low: undefined, high: undefined, sourceQuality: 50, source: { sourceId: "b", sourceName: "B", sourceType: "brokerage" } }),
    ]);
    expect(result.weightedValue).toBeCloseTo(0.0583333333, 10);
    expect(result.observationCount).toBe(2);
    expect(result.sourceIds).toEqual(["a", "b"]);
  });

  test("preserves published range boundaries", () => {
    const result = weightedConsensus([
      base({ low: 0.05, high: 0.06 }),
      base({ low: 0.0575, high: 0.065 }),
    ]);
    expect(result.low).toBe(0.05);
    expect(result.high).toBe(0.065);
  });

  test("rejects empty input", () => {
    expect(() => weightedConsensus([])).toThrow("At least one CRE observation is required");
  });

  test("escalates construction cost by index ratio", () => {
    expect(escalateCost(400, 200, 220)).toBe(440);
  });
});

import {
  normalizeCapRateObservation,
  normalizeConstructionCostObservation,
  normalizeConstructionIndexObservation,
  constructionIndexRatio,
} from "../../src/cre-intelligence/normalize";
import type { CREObservation } from "../../src/cre-intelligence/types";

const source = { sourceId: "test", sourceName: "Test", sourceType: "brokerage" as const };
const base = (overrides: Partial<CREObservation>): CREObservation => ({
  metric: "cap_rate",
  assetClass: "industrial",
  geography: { country: "CA", city: "Vancouver", metro: "Vancouver" },
  periodStart: "2026-04-01",
  periodEnd: "2026-06-30",
  value: 5.5,
  unit: "percent",
  source,
  sourceQuality: 90,
  ...overrides,
});

describe("E68 CRE normalization", () => {
  test("normalizes percentage cap rates to decimals", () => {
    const result = normalizeCapRateObservation(base({ value: 5.5, low: 5, high: 6 }));
    expect(result.value).toBeCloseTo(0.055);
    expect(result.low).toBeCloseTo(0.05);
    expect(result.high).toBeCloseTo(0.06);
  });

  test("accepts decimal cap rates without changing them", () => {
    const result = normalizeCapRateObservation(base({ value: 0.055, low: 0.05, high: 0.06, unit: "decimal" }));
    expect(result.value).toBe(0.055);
    expect(result.low).toBe(0.05);
    expect(result.high).toBe(0.06);
  });

  test("rejects inverted cap-rate ranges", () => {
    expect(() => normalizeCapRateObservation(base({ low: 7, high: 5 }))).toThrow("low cannot exceed high");
  });

  test("normalizes CAD and USD hard costs per square foot", () => {
    const cad = normalizeConstructionCostObservation(base({
      metric: "hard_cost", value: 400, low: 350, high: 450, unit: "CAD/SF", basis: "per_sf",
    }));
    const usd = normalizeConstructionCostObservation(base({
      metric: "hard_cost", value: 300, low: 275, high: 325, unit: "USD/SF", basis: "per_sf",
    }));
    expect(cad.unit).toBe("CAD_per_sf");
    expect(usd.unit).toBe("USD_per_sf");
    expect(cad.value).toBe(400);
    expect(usd.value).toBe(300);
  });

  test("normalizes soft-cost percentages to decimals", () => {
    const result = normalizeConstructionCostObservation(base({
      metric: "soft_cost", value: 22, low: 18, high: 25, unit: "%", basis: "percent_of_hard_cost",
    }));
    expect(result.unit).toBe("percent_of_hard_cost");
    expect(result.value).toBeCloseTo(0.22);
    expect(result.low).toBeCloseTo(0.18);
    expect(result.high).toBeCloseTo(0.25);
  });

  test("rejects cost observations without currency for per-SF basis", () => {
    expect(() => normalizeConstructionCostObservation(base({
      metric: "hard_cost", value: 400, unit: "SF", basis: "per_sf",
    }))).toThrow("Per-SF construction cost unit must specify CAD or USD");
  });

  test("normalizes and compares construction indexes", () => {
    const baseIndex = normalizeConstructionIndexObservation(base({
      metric: "construction_index", value: 200, unit: "index",
    }));
    const targetIndex = normalizeConstructionIndexObservation(base({
      metric: "construction_index", value: 220, unit: "index",
    }));
    expect(constructionIndexRatio(baseIndex, targetIndex)).toBeCloseTo(1.1);
  });

  test("rejects non-positive construction indexes", () => {
    expect(() => normalizeConstructionIndexObservation(base({
      metric: "construction_index", value: 0, unit: "index",
    }))).toThrow("Construction index requires a positive value");
  });
});

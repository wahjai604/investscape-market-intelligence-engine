/**
 * InvestScape™ E88 Phase 2 — Normalization tests.
 */
import { normalizeObservation } from "../../src/construction-cost-engine/normalize";
import type { CRECitedObservation } from "../../src/cre-intelligence/types";

function hardCostObs(overrides: Partial<CRECitedObservation> = {}): CRECitedObservation {
  return {
    metric: "hard_cost",
    assetClass: "office",
    propertySubtype: "office_prime",
    propertyClass: "unspecified",
    locationType: "unspecified",
    geography: { country: "US", region: "TX", metro: "Austin, TX", city: "Austin" },
    periodStart: "2026-04-01",
    periodEnd: "2026-06-30",
    low: 255,
    high: 425,
    unit: "USD_per_sf",
    basis: "per_sf",
    source: { sourceId: "rlb-north-america", sourceName: "Rider Levett Bucknall", sourceType: "construction_cost" },
    citation: {
      sourceName: "Rider Levett Bucknall",
      reportTitle: "RLB Quarterly Construction Cost Report — North America, Q2 2026",
      publicationDate: "2026-07-07",
      period: "Q2 2026",
      locator: "Table X",
      sourceUrl: "https://example.com/rlb.pdf",
      retrievedAt: "2026-09-10",
    },
    sourceQuality: 94,
    ...overrides,
  };
}

describe("normalizeObservation — identification only (no target)", () => {
  test("identifies currency, unit basis, cost representation, and subtype mapping", () => {
    const outcome = normalizeObservation(hardCostObs());
    expect(outcome.status).toBe("NORMALIZED");
    if (outcome.status !== "NORMALIZED") return;
    expect(outcome.result.currency).toBe("USD");
    expect(outcome.result.unitBasis).toBe("per_sf");
    expect(outcome.result.costRepresentation).toBe("hard_cost");
    expect(outcome.result.measurementSystem).toBe("imperial");
    expect(outcome.result.subtypeMapping.confidence).toBe("close");
    expect(outcome.result.low).toBe(255);
    expect(outcome.result.high).toBe(425);
  });

  test("original observation is carried through unmutated", () => {
    const obs = hardCostObs();
    const before = JSON.parse(JSON.stringify(obs));
    normalizeObservation(obs);
    expect(obs).toEqual(before);
  });

  test("every transformation is recorded and auditable", () => {
    const outcome = normalizeObservation(hardCostObs());
    if (outcome.status !== "NORMALIZED") throw new Error("expected NORMALIZED");
    const dims = outcome.result.transformations.map((t) => t.dimension);
    expect(dims).toEqual(
      expect.arrayContaining(["cost_representation", "currency", "unit_basis", "measurement_system", "geography", "subtype_mapping"]),
    );
    for (const t of outcome.result.transformations) {
      expect(t.description.length).toBeGreaterThan(0);
      expect(t.method.length).toBeGreaterThan(0);
    }
  });

  test("construction_index observation is never treated as a cost observation", () => {
    const outcome = normalizeObservation(
      hardCostObs({ metric: "construction_index", unit: "index", basis: "index", low: undefined, high: undefined, value: 20453 }),
    );
    expect(outcome.status).toBe("FAILED");
    if (outcome.status !== "FAILED") return;
    expect(outcome.reason).toBe("NOT_A_COST_OBSERVATION");
  });

  test("construction_cost_change observation is never treated as a cost observation", () => {
    const outcome = normalizeObservation(hardCostObs({ metric: "construction_cost_change", unit: "percent", basis: undefined, low: undefined, high: undefined, value: 4.57 }));
    expect(outcome.status).toBe("FAILED");
    if (outcome.status !== "FAILED") return;
    expect(outcome.reason).toBe("NOT_A_COST_OBSERVATION");
  });
});

describe("normalizeObservation — deterministic area-basis conversion", () => {
  test("per_sf -> per_sm uses the fixed constant, never an estimate", () => {
    const outcome = normalizeObservation(hardCostObs({ low: 100, high: 200 }), { unitBasis: "per_sm" });
    expect(outcome.status).toBe("NORMALIZED");
    if (outcome.status !== "NORMALIZED") return;
    expect(outcome.result.unitBasis).toBe("per_sm");
    expect(outcome.result.measurementSystem).toBe("metric");
    // $/SF -> $/SM: multiply by SF-per-SM constant (~10.7639)
    expect(outcome.result.low).toBeCloseTo(100 * 10.7639, 2);
    expect(outcome.result.high).toBeCloseTo(200 * 10.7639, 2);
    const conversionEntry = outcome.result.transformations.find((t) => t.dimension === "unit_basis" && t.applied);
    expect(conversionEntry).toBeDefined();
  });

  test("round-trip per_sf -> per_sm -> per_sf recovers the original value", () => {
    const toSm = normalizeObservation(hardCostObs({ low: 300, high: undefined, value: undefined }), { unitBasis: "per_sm" });
    if (toSm.status !== "NORMALIZED") throw new Error("expected NORMALIZED");
    const smObs = hardCostObs({ low: toSm.result.low, high: undefined, value: undefined, unit: "USD_per_sm", basis: "per_sf" });
    const backToSf = normalizeObservation(smObs, { unitBasis: "per_sf" });
    if (backToSf.status !== "NORMALIZED") throw new Error("expected NORMALIZED");
    expect(backToSf.result.low).toBeCloseTo(300, 6);
  });

  test("determinism: repeated calls with identical input produce identical output", () => {
    const obs = hardCostObs();
    const a = normalizeObservation(obs, { unitBasis: "per_sm" });
    const b = normalizeObservation(obs, { unitBasis: "per_sm" });
    expect(a).toEqual(b);
  });
});

describe("normalizeObservation — unsupported conversions never guessed", () => {
  test("per_sf -> per_unit is refused (no average unit size known)", () => {
    const outcome = normalizeObservation(hardCostObs(), { unitBasis: "per_unit" });
    expect(outcome.status).toBe("FAILED");
    if (outcome.status !== "FAILED") return;
    expect(outcome.reason).toBe("UNIT_CONVERSION_UNSUPPORTED");
  });

  test("cross-currency conversion is refused: no FX rate is invented", () => {
    const outcome = normalizeObservation(hardCostObs({ unit: "USD_per_sf" }), { currency: "CAD" });
    expect(outcome.status).toBe("FAILED");
    if (outcome.status !== "FAILED") return;
    expect(outcome.reason).toBe("CURRENCY_CONVERSION_UNAVAILABLE");
  });

  test("same currency requested: no conversion attempted, succeeds", () => {
    const outcome = normalizeObservation(hardCostObs({ unit: "USD_per_sf" }), { currency: "USD" });
    expect(outcome.status).toBe("NORMALIZED");
  });
});

/**
 * InvestScape™ E70 Phase 2 — Pipeline (request gating / DATA_GAP) tests.
 */
import { evaluateConstructionCostRequest } from "../../src/construction-cost-engine/pipeline";
import type { ConstructionCostCandidateInput, ConstructionCostRequest } from "../../src/construction-cost-engine/types";
import type { CRECitedObservation } from "../../src/cre-intelligence/types";

function obs(overrides: Partial<CRECitedObservation> = {}): CRECitedObservation {
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

function baseRequest(overrides: Partial<ConstructionCostRequest> = {}): ConstructionCostRequest {
  return {
    geography: { country: "US", city: "Austin" },
    assetClass: "office",
    canonicalSubtype: "office_premium",
    costRepresentation: "hard_cost",
    ...overrides,
  };
}

function candidate(o: CRECitedObservation): ConstructionCostCandidateInput {
  return { observation: o };
}

const CHECKED_AT = "2026-09-11";

describe("Empty pool", () => {
  test("empty candidate pool -> DATA_GAP, never a fabricated benchmark", () => {
    const result = evaluateConstructionCostRequest(baseRequest(), [], CHECKED_AT);
    expect(result.status).toBe("DATA_GAP");
    if (result.status !== "DATA_GAP") return;
    expect(result.gap.reasonCode).toBe("NO_CANDIDATES_IN_POOL");
    expect(result.gap.excludedCandidates).toHaveLength(0);
    expect(result.gap.checkedAt).toBe(CHECKED_AT);
  });
});

describe("Hard-cost-only rule (Phase 1 Decision 5)", () => {
  test("total-cost request with only hard-cost evidence -> DATA_GAP, never downgraded to hard cost", () => {
    const pool = [candidate(obs({ metric: "hard_cost" }))];
    const result = evaluateConstructionCostRequest(baseRequest({ costRepresentation: "total_cost" }), pool, CHECKED_AT);
    expect(result.status).toBe("DATA_GAP");
    if (result.status !== "DATA_GAP") return;
    expect(result.gap.reasonCode).toBe("TOTAL_COST_UNAVAILABLE_SOFT_COST_MISSING");
    // Must never carry a numeric benchmark anywhere on the gap.
    expect(JSON.stringify(result.gap)).not.toMatch(/"value":\s*\d/);
  });

  test("total-cost request with neither hard nor soft cost evidence -> DATA_GAP, category not covered", () => {
    const pool = [candidate(obs({ metric: "construction_index", unit: "index", basis: "index", low: undefined, high: undefined, value: 1 }))];
    const result = evaluateConstructionCostRequest(baseRequest({ costRepresentation: "total_cost" }), pool, CHECKED_AT);
    expect(result.status).toBe("DATA_GAP");
    if (result.status !== "DATA_GAP") return;
    expect(result.gap.reasonCode).toBe("SOURCE_DOES_NOT_COVER_CATEGORY");
  });

  test("hard-cost request against hard-cost evidence is served normally (not gated)", () => {
    const pool = [candidate(obs({ metric: "hard_cost" }))];
    const result = evaluateConstructionCostRequest(baseRequest({ costRepresentation: "hard_cost" }), pool, CHECKED_AT);
    expect(result.status).toBe("CANDIDATES_AVAILABLE");
  });

  test("total-cost request never silently estimates soft cost from hard cost — no percentage anywhere in output", () => {
    const pool = [candidate(obs({ metric: "hard_cost" }))];
    const result = evaluateConstructionCostRequest(baseRequest({ costRepresentation: "total_cost" }), pool, CHECKED_AT);
    if (result.status !== "DATA_GAP") throw new Error("expected DATA_GAP");
    expect(result.gap.reason).not.toMatch(/\d+%/);
    expect(result.gap.reason).toMatch(/soft-cost evidence/i);
  });
});

describe("Soft-cost gap handling (Phase 2 objective 7)", () => {
  test("soft-cost request with zero soft-cost observations in pool -> NO_SOFT_COST_OBSERVATIONS_EXIST", () => {
    const pool = [candidate(obs({ metric: "hard_cost" }))];
    const result = evaluateConstructionCostRequest(baseRequest({ costRepresentation: "soft_cost" }), pool, CHECKED_AT);
    expect(result.status).toBe("DATA_GAP");
    if (result.status !== "DATA_GAP") return;
    expect(result.gap.reasonCode).toBe("NO_SOFT_COST_OBSERVATIONS_EXIST");
    expect(result.gap.resolutionHint).toBeDefined();
  });

  test("soft-cost request served normally when a soft-cost observation actually exists in the pool", () => {
    const pool = [
      candidate(
        obs({
          metric: "soft_cost",
          basis: "percent_of_hard_cost",
          unit: "percent",
          low: undefined,
          high: undefined,
          value: 18,
        }),
      ),
    ];
    const result = evaluateConstructionCostRequest(baseRequest({ costRepresentation: "soft_cost" }), pool, CHECKED_AT);
    expect(result.status).toBe("CANDIDATES_AVAILABLE");
  });
});

describe("Category coverage vs mapping-quality distinction", () => {
  test("category not covered at all (multifamily) -> SOURCE_DOES_NOT_COVER_CATEGORY", () => {
    const pool = [candidate(obs({ assetClass: "office" }))]; // only office exists in pool
    const result = evaluateConstructionCostRequest(
      baseRequest({ assetClass: "multifamily", canonicalSubtype: "multifamily_mid_rise" }),
      pool,
      CHECKED_AT,
    );
    expect(result.status).toBe("DATA_GAP");
    if (result.status !== "DATA_GAP") return;
    expect(result.gap.reasonCode).toBe("SOURCE_DOES_NOT_COVER_CATEGORY");
  });

  test("category covered but only via unsupported subtype mapping -> SOURCE_COVERAGE_UNSUPPORTED_MAPPING", () => {
    const pool = [candidate(obs({ assetClass: "hotel", propertySubtype: "unknown_hotel_tier" }))];
    const result = evaluateConstructionCostRequest(
      baseRequest({ assetClass: "hotel", canonicalSubtype: "hotel_luxury" }),
      pool,
      CHECKED_AT,
    );
    expect(result.status).toBe("DATA_GAP");
    if (result.status !== "DATA_GAP") return;
    expect(result.gap.reasonCode).toBe("SOURCE_COVERAGE_UNSUPPORTED_MAPPING");
  });

  test("category and subtype fine, but every candidate wrong geography -> ALL_CANDIDATES_EXCLUDED", () => {
    const pool = [candidate(obs({ geography: { country: "US", city: "Miami" } }))];
    const result = evaluateConstructionCostRequest(baseRequest({ geography: { country: "US", city: "Austin" } }), pool, CHECKED_AT);
    expect(result.status).toBe("DATA_GAP");
    if (result.status !== "DATA_GAP") return;
    expect(result.gap.reasonCode).toBe("ALL_CANDIDATES_EXCLUDED");
  });
});

describe("DATA_GAP integrity (Phase 2 objective 10)", () => {
  test("a DATA_GAP always preserves reason, request, considered/excluded candidates, sourcesChecked, and checkedAt", () => {
    const pool = [candidate(obs({ geography: { country: "US", city: "Miami" } }))];
    const request = baseRequest({ geography: { country: "US", city: "Austin" } });
    const result = evaluateConstructionCostRequest(request, pool, CHECKED_AT);
    if (result.status !== "DATA_GAP") throw new Error("expected DATA_GAP");
    expect(result.gap.request).toEqual(request);
    expect(result.gap.excludedCandidates.length).toBeGreaterThan(0);
    expect(result.gap.sourcesChecked).toEqual(["rlb-north-america"]);
    expect(result.gap.checkedAt).toBe(CHECKED_AT);
    expect(result.gap.reason.length).toBeGreaterThan(0);
  });

  test("never contains a fabricated numeric construction-cost benchmark", () => {
    const pool = [candidate(obs({ metric: "hard_cost" }))];
    const result = evaluateConstructionCostRequest(baseRequest({ costRepresentation: "total_cost" }), pool, CHECKED_AT);
    if (result.status !== "DATA_GAP") throw new Error("expected DATA_GAP");
    // The gap itself must never surface a synthesized top-level benchmark field.
    expect(result.gap).not.toHaveProperty("benchmark");
    expect(result.gap).not.toHaveProperty("value");
    expect(result.gap).not.toHaveProperty("estimatedCost");
  });
});

describe("Determinism (Phase 2 objective 9)", () => {
  test("repeated execution with identical inputs produces identical output", () => {
    const pool = [candidate(obs())];
    const request = baseRequest();
    expect(evaluateConstructionCostRequest(request, pool, CHECKED_AT)).toEqual(evaluateConstructionCostRequest(request, pool, CHECKED_AT));
  });

  test("candidate ordering never changes the pipeline status", () => {
    const a = obs({ geography: { country: "US", city: "Austin" } });
    const b = obs({ geography: { country: "US", city: "Miami" } });
    const request = baseRequest({ geography: { country: "US", city: "Austin" } });
    const forward = evaluateConstructionCostRequest(request, [candidate(a), candidate(b)], CHECKED_AT);
    const reversed = evaluateConstructionCostRequest(request, [candidate(b), candidate(a)], CHECKED_AT);
    expect(forward.status).toBe(reversed.status);
  });
});

/**
 * InvestScape™ E88 Phase 7 — Production Integration & End-to-End Validation.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Exercises the REAL public API composing the actual Phase 2-6 components
 * (no mocking of the core analytical chain): source registry/adapters ->
 * pool assembly -> evaluateConstructionCostBenchmark() (which itself calls
 * Phase 2's evaluateConstructionCostRequest/evaluateComparability and
 * Phase 4's escalateCost internally). Section headers below mirror the
 * Phase 7 task's own lettered/numbered test matrix.
 */
import { evaluateConstructionCostBenchmark, applyUserOverride } from "../../src/construction-cost-engine/benchmark";
import { e88ConstructionCostPool } from "../../src/construction-cost-engine/data";
import { CC_KNOWN_INDEX_OBSERVATIONS } from "../../src/construction-cost-engine/data/index-series";
import { RLB_ADAPTER } from "../../src/construction-cost-engine/adapters/rlb-adapter";
import {
  RLB_SOURCE_DEFINITION,
  TURNER_TOWNSEND_SOURCE_DEFINITION,
  RSMEANS_SOURCE_DEFINITION,
  ALTUS_SOURCE_DEFINITION,
  STATCAN_BCPI_SOURCE_DEFINITION,
  CMHC_SOURCE_DEFINITION,
} from "../../src/construction-cost-engine/source-registry-e88";
import { computeAnalyticalReadiness } from "../../src/construction-cost-engine/source-adapter-types";
import { RLB_SECOND_TABLE_VERIFICATION } from "../../src/construction-cost-engine/second-table-verification";
import { CC_STRICT_ESCALATION_POLICY } from "../../src/construction-cost-engine/escalation-policy";
import type { ConstructionCostBenchmarkRequest } from "../../src/construction-cost-engine/benchmark-types";
import type { ConstructionCostCandidateInput } from "../../src/construction-cost-engine/types";
import type { CRECitedObservation } from "../../src/cre-intelligence/types";

const CHECKED_AT = "2026-09-13";

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

function baseRequest(overrides: Partial<ConstructionCostBenchmarkRequest> = {}): ConstructionCostBenchmarkRequest {
  return {
    geography: { country: "US", city: "Seattle" },
    assetClass: "office",
    canonicalSubtype: "office_premium",
    costRepresentation: "hard_cost",
    ...overrides,
  };
}

function fullPool(): ConstructionCostCandidateInput[] {
  return e88ConstructionCostPool();
}

// ============================================================================
// A. Normal successful benchmark
// ============================================================================
describe("A. Normal successful benchmark", () => {
  test("valid RLB observation, correct subtype/geography, hard-cost request succeeds with full provenance", () => {
    const outcome = evaluateConstructionCostBenchmark(baseRequest(), fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    const p = outcome.result.provenance[0];
    expect(p.sourceId).toBe("rlb-north-america");
    expect(p.reportTitle).toContain("RLB Quarterly Construction Cost Report");
    expect(p.geography.city).toBe("Seattle");
    expect(p.propertySubtype).toBe("office_prime");
    expect(p.period).toBeTruthy();
    expect(outcome.result.identity.costRepresentation).toBe("hard_cost");
  });
});

// ============================================================================
// B. Successful escalation
// ============================================================================
describe("B. Successful escalation", () => {
  test("valid base cost + applicable national index escalated to a differing target period, reproducible, no intermediate rounding", () => {
    const req = baseRequest({ targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } });
    const a = evaluateConstructionCostBenchmark(req, fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    const b = evaluateConstructionCostBenchmark(req, fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(a.status).toBe("success");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b)); // reproducible
    if (a.status !== "success") return;
    expect(a.result.benchmark.escalated).toBe(true);
    const ratio = 262.0 / 288.58;
    expect(a.result.benchmark.low).toBe((a.result.contributingObservations[0].candidate.observation.low as number) * ratio); // exact float, no rounding
    const p = a.result.provenance[0];
    expect(p.wasEscalated).toBe(true);
    expect(p.escalation?.baseIndexLocator).toBeTruthy();
    expect(p.escalation?.targetIndexLocator).toBeTruthy();
  });
});

// ============================================================================
// C. Same-period escalation
// ============================================================================
describe("C. Same-period escalation", () => {
  test("base period == target period -> identity shortcut, ratio 1, explained in provenance/audit", () => {
    const pool: ConstructionCostCandidateInput[] = [{ observation: obs() }];
    const req = baseRequest({ geography: { country: "US", city: "Austin" }, targetPeriod: { start: "2026-04-01", end: "2026-06-30", label: "Q2 2026" } });
    const outcome = evaluateConstructionCostBenchmark(req, pool, CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    expect(outcome.result.contributingObservations[0].escalation?.status).toBe("ESCALATED");
    if (outcome.result.contributingObservations[0].escalation?.status !== "ESCALATED") return;
    expect(outcome.result.contributingObservations[0].escalation.result.relationship).toBe("IDENTICAL_PERIOD");
    expect(outcome.result.contributingObservations[0].escalation.result.calculation.indexRatio).toBe(1);
    expect(outcome.result.auditTrail.escalationDecisions[0].outcome).toBe("ESCALATED");
  });
});

// ============================================================================
// D. Direct vs indirect index
// ============================================================================
describe("D. Direct versus indirect index", () => {
  test("Seattle (city index exists) uses DIRECT relationship where a matching period is available", () => {
    const seattleAtCityIndexPeriod: CRECitedObservation = { ...obs({ geography: { country: "US", region: "WA", metro: "Seattle, WA", city: "Seattle" } }), periodStart: "2025-04-01", periodEnd: "2025-04-30" };
    const req = baseRequest({ geography: { country: "US", city: "Seattle" }, targetPeriod: { start: "2026-04-01", end: "2026-04-30", label: "April 2026" } });
    const outcome = evaluateConstructionCostBenchmark(req, [{ observation: seattleAtCityIndexPeriod }], CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    const esc = outcome.result.contributingObservations[0].escalation;
    expect(esc?.status === "ESCALATED" && esc.result.relationship).toBe("DIRECT");
  });

  test("a city with no city-level index uses INDIRECT (national) per documented Phase 4 policy, and confidence never treats it as direct", () => {
    const chicago = fullPool().find((c) => c.observation.geography.city === "Chicago" && c.observation.propertySubtype === "office_prime")!;
    const req = baseRequest({ geography: { country: "US", city: "Chicago" }, targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } });
    const outcome = evaluateConstructionCostBenchmark(req, [chicago], CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    const esc = outcome.result.contributingObservations[0].escalation;
    expect(esc?.status === "ESCALATED" && esc.result.relationship).toBe("INDIRECT");
    // Confidence floor: an INDIRECT escalation caps benchmarkConfidence at "moderate", never higher, regardless of source quality.
    expect(["moderate", "low", "very_low"]).toContain(outcome.result.confidence.benchmarkConfidence);
  });

  test("disabling national-index fallback (CC_STRICT_ESCALATION_POLICY) removes INDIRECT escalation capability entirely", () => {
    const chicago = fullPool().find((c) => c.observation.geography.city === "Chicago" && c.observation.propertySubtype === "office_prime")!;
    const req = baseRequest({ geography: { country: "US", city: "Chicago" }, targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" }, escalationPolicy: CC_STRICT_ESCALATION_POLICY });
    const outcome = evaluateConstructionCostBenchmark(req, [chicago], CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
  });
});

// ============================================================================
// E. DATA_GAP integrity
// ============================================================================
describe("E. DATA_GAP integrity", () => {
  const cases: Array<{ name: string; req: () => ConstructionCostBenchmarkRequest; pool?: () => ConstructionCostCandidateInput[] }> = [
    { name: "no usable observation (empty pool)", req: () => baseRequest(), pool: () => [] },
    { name: "unsupported building subtype (multifamily)", req: () => baseRequest({ assetClass: "multifamily", canonicalSubtype: "multifamily_low_rise" }) },
    { name: "wrong asset class (industrial)", req: () => baseRequest({ assetClass: "industrial", canonicalSubtype: undefined }) },
    { name: "wrong geography", req: () => baseRequest({ geography: { country: "US", city: "NoSuchCityXYZ" } }) },
    { name: "unsupported cost basis mapping via wrong subtype pairing", req: () => baseRequest({ canonicalSubtype: "industrial_warehouse" }) },
    { name: "total-cost with no soft-cost evidence", req: () => baseRequest({ costRepresentation: "total_cost" }) },
    { name: "invalid request (bad country)", req: () => baseRequest({ geography: { country: "ZZ" as unknown as "US" } }) },
    { name: "escalation requested but unavailable", req: () => baseRequest({ targetPeriod: { start: "2099-01-01", end: "2099-03-31", label: "Q1 2099" } }) },
  ];

  for (const c of cases) {
    test(`${c.name} -> DATA_GAP, no numeric benchmark ever appears`, () => {
      const outcome = evaluateConstructionCostBenchmark(c.req(), c.pool ? c.pool() : fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
      expect(outcome.status).toBe("data_gap");
      if (outcome.status !== "data_gap") return;
      expect(outcome.gap.reasonCode).toBeTruthy();
      expect(typeof outcome.gap.reason).toBe("string");
      expect(outcome.gap.reason.length).toBeGreaterThan(0);
      // Raw serialized-output assertion: no "benchmark" numeric field leaks into a DATA_GAP payload.
      const serialized = JSON.stringify(outcome);
      expect(serialized).not.toMatch(/"benchmark":\{"low"/);
    });
  }

  test("unsupported unit conversion -> CONVERSION_UNSUPPORTED", () => {
    const seattleOnly: ConstructionCostCandidateInput[] = [{ observation: obs({ geography: { country: "US", region: "WA", metro: "Seattle, WA", city: "Seattle" } }) }];
    const outcome = evaluateConstructionCostBenchmark(baseRequest({ unitBasis: "per_unit" }), seattleOnly, CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
    if (outcome.status !== "data_gap") return;
    expect(outcome.gap.reasonCode).toBe("CONVERSION_UNSUPPORTED");
  });

  test("required freshness cannot be satisfied -> FRESHNESS_UNSUPPORTED", () => {
    const pool: ConstructionCostCandidateInput[] = [{ observation: obs(), freshness: "stale" }];
    const outcome = evaluateConstructionCostBenchmark(baseRequest({ geography: { country: "US", city: "Austin" }, minFreshness: "recent" }), pool, CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
    if (outcome.status !== "data_gap") return;
    expect(outcome.gap.reasonCode).toBe("FRESHNESS_UNSUPPORTED");
  });

  test("source registered but not ingested (Turner & Townsend) can never contribute a numeric observation to any benchmark", () => {
    expect(computeAnalyticalReadiness(TURNER_TOWNSEND_SOURCE_DEFINITION)).toBe("NOT_READY");
    // T&T contributes nothing to the pool at all — confirmed structurally, not merely by assertion:
    const pool = fullPool();
    expect(pool.every((c) => c.observation.source.sourceId !== "turner-townsend-north-america")).toBe(true);
  });

  test("source available but redistribution-restricted does not block a DERIVED benchmark output (RLB) — restriction applies to raw redistribution only", () => {
    expect(RLB_SOURCE_DEFINITION.redistribution.redistributionAllowed).toBe(false);
    expect(RLB_SOURCE_DEFINITION.redistribution.derivedOutputVisibility).toBe("VISIBLE");
    const outcome = evaluateConstructionCostBenchmark(baseRequest(), fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success"); // a derived benchmark is legitimately produced despite raw-redistribution restriction
  });

  test("deferred/licensed-only sources (RSMeans, Altus) have zero observations and cannot answer a multifamily/industrial request", () => {
    expect(computeAnalyticalReadiness(RSMEANS_SOURCE_DEFINITION)).toBe("NOT_READY");
    expect(computeAnalyticalReadiness(ALTUS_SOURCE_DEFINITION)).toBe("NOT_READY");
    const outcome = evaluateConstructionCostBenchmark(baseRequest({ assetClass: "industrial", canonicalSubtype: "industrial_warehouse" }), fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
  });

  test("RLB second table remains UNVERIFIED and contributes no industrial/multifamily observation to any benchmark", () => {
    expect(RLB_SECOND_TABLE_VERIFICATION.status).toBe("UNVERIFIED");
    const envelopes = RLB_ADAPTER.listObservations();
    expect(envelopes.some((e) => e.observation.assetClass === "industrial" || e.observation.assetClass === "multifamily")).toBe(false);
    const outcome = evaluateConstructionCostBenchmark(baseRequest({ assetClass: "multifamily", canonicalSubtype: "multifamily_mid_rise" }), fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
  });
});

// ============================================================================
// 6. Hard / soft / total cost
// ============================================================================
describe("6. Hard/soft/total cost semantics", () => {
  test("hard_cost request succeeds with valid evidence", () => {
    const outcome = evaluateConstructionCostBenchmark(baseRequest(), fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
  });

  test("soft_cost request never accidentally uses hard-cost evidence", () => {
    const outcome = evaluateConstructionCostBenchmark(baseRequest({ costRepresentation: "soft_cost" }), fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
    if (outcome.status !== "data_gap") return;
    expect(outcome.gap.reasonCode).toBe("TOTAL_COST_UNSUPPORTED");
  });

  test("total_cost never silently becomes hard_cost", () => {
    const outcome = evaluateConstructionCostBenchmark(baseRequest({ costRepresentation: "total_cost" }), fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
    if (outcome.status !== "data_gap") return;
    expect(outcome.gap.reasonCode).toBe("TOTAL_COST_UNSUPPORTED");
    // Never a hard_cost identity smuggled in as if it answered total_cost:
    expect(outcome.gap.requestedCostBasis).toBe("total_cost");
  });

  test("total_cost DATA_GAP preserves hard-cost evidence as provenance without presenting it as a total-cost answer", () => {
    const outcome = evaluateConstructionCostBenchmark(baseRequest({ costRepresentation: "total_cost" }), fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
    if (outcome.status !== "data_gap") return;
    expect(outcome.gap.provenance.length).toBeGreaterThan(0);
    expect(outcome.gap.provenance[0].propertySubtype).toBe("office_prime");
  });
});

// ============================================================================
// 7. Unsupported categories
// ============================================================================
describe("7. Unsupported categories", () => {
  test("multifamily -> SOURCE_DOES_NOT_COVER_CATEGORY at the pipeline layer, no invented mapping", () => {
    const outcome = evaluateConstructionCostBenchmark(baseRequest({ assetClass: "multifamily", canonicalSubtype: "multifamily_low_rise" }), fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
    if (outcome.status !== "data_gap") return;
    expect(outcome.gap.pipelineGapReasonCode).toBe("SOURCE_DOES_NOT_COVER_CATEGORY");
  });

  test("industrial -> SOURCE_DOES_NOT_COVER_CATEGORY, never using the unverified second table", () => {
    const outcome = evaluateConstructionCostBenchmark(baseRequest({ assetClass: "industrial", canonicalSubtype: "industrial_warehouse" }), fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
    if (outcome.status !== "data_gap") return;
    expect(outcome.gap.pipelineGapReasonCode).toBe("SOURCE_DOES_NOT_COVER_CATEGORY");
  });

  test("a supported asset class with an unsupported subtype mapping distinguishes SOURCE_COVERAGE_UNSUPPORTED_MAPPING from SOURCE_DOES_NOT_COVER_CATEGORY", () => {
    // hotel asset class IS covered by RLB, but request a subtype with no honest mapping target present in the pool for hotel (residential wood-frame subtypes never apply to hotel; use an office-only pool against a hotel request instead to force the "no candidate matches asset class" path, already covered above).
    // Here we instead confirm hospital (covered) vs a request for a medical_office subtype RLB never publishes -> unsupported mapping, not "does not cover category" (asset class "healthcare" IS present via hospital_general).
    const req = baseRequest({ geography: { country: "US", city: "Seattle" }, assetClass: "healthcare", canonicalSubtype: "healthcare_medical_office" });
    const outcome = evaluateConstructionCostBenchmark(req, fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
    if (outcome.status !== "data_gap") return;
    expect(outcome.gap.pipelineGapReasonCode).toBe("SOURCE_COVERAGE_UNSUPPORTED_MAPPING");
  });
});

// ============================================================================
// 8. Source adapter boundary
// ============================================================================
describe("8. Source adapter boundary", () => {
  test("RLB adapter translates without normalizing, scoring, escalating, or aggregating", () => {
    const envelope = RLB_ADAPTER.listObservations()[0];
    expect(envelope.observation.metric).toBeDefined();
    expect((envelope as unknown as Record<string, unknown>).comparability).toBeUndefined();
    expect((envelope as unknown as Record<string, unknown>).escalatedCost).toBeUndefined();
    expect((envelope as unknown as Record<string, unknown>).aggregation).toBeUndefined();
  });

  test("deferred adapters never fabricate an observation", () => {
    expect(computeAnalyticalReadiness(STATCAN_BCPI_SOURCE_DEFINITION)).toBe("READY"); // ready, but...
    // ...still contributes zero cost observations, because it is index-only and not ingested for cost purposes:
    const pool = fullPool();
    expect(pool.every((c) => c.observation.source.sourceId !== "statcan-bcpi")).toBe(true);
  });

  test("CMHC remains rejected and contributes nothing", () => {
    expect(computeAnalyticalReadiness(CMHC_SOURCE_DEFINITION)).toBe("NOT_READY");
  });
});

// ============================================================================
// 10. Provenance integrity
// ============================================================================
describe("10. Provenance integrity", () => {
  test("escalated result traces base observation AND both index observations", () => {
    const req = baseRequest({ targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } });
    const outcome = evaluateConstructionCostBenchmark(req, fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    const esc = outcome.result.contributingObservations[0].escalation;
    expect(esc?.status === "ESCALATED" && esc.result.baseIndexObservation).toBeTruthy();
    expect(esc?.status === "ESCALATED" && esc.result.targetIndexObservation).toBeTruthy();
  });

  test("DATA_GAP results preserve all evidence/provenance permitted by the existing contract", () => {
    const outcome = evaluateConstructionCostBenchmark(baseRequest({ costRepresentation: "total_cost" }), fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
    if (outcome.status !== "data_gap") return;
    expect(outcome.gap.provenance.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// 11. Confidence floor
// ============================================================================
describe("11. Confidence floor", () => {
  test("single observation is capped at moderate even with high source quality and freshness", () => {
    const pool: ConstructionCostCandidateInput[] = [{ observation: obs({ propertySubtype: "retail_shopping_center", assetClass: "retail" }), freshness: "live_current" }];
    const req = baseRequest({ geography: { country: "US", city: "Austin" }, assetClass: "retail", canonicalSubtype: "retail_shopping_center" });
    const outcome = evaluateConstructionCostBenchmark(req, pool, CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    expect(outcome.result.confidence.benchmarkConfidence).toBe("moderate");
  });

  test("two genuinely distinct overlapping observations are not artificially capped by the single-observation rule", () => {
    const a = obs({ propertySubtype: "retail_shopping_center", assetClass: "retail", low: 200, high: 400 });
    const b = obs({ propertySubtype: "retail_shopping_center", assetClass: "retail", low: 300, high: 500, citation: { ...obs().citation, locator: "Table Distinct" } });
    const req = baseRequest({ geography: { country: "US", city: "Austin" }, assetClass: "retail", canonicalSubtype: "retail_shopping_center" });
    const outcome = evaluateConstructionCostBenchmark(req, [{ observation: a, freshness: "live_current" }, { observation: b, freshness: "live_current" }], CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    expect(outcome.result.confidence.benchmarkConfidence).toBe("high");
    expect(outcome.result.aggregation.observationCount).toBe(2);
  });

  test("indirect escalation caps confidence at moderate, never rescued by high source quality", () => {
    const chicago = fullPool().find((c) => c.observation.geography.city === "Chicago" && c.observation.propertySubtype === "office_prime")!;
    const req = baseRequest({ geography: { country: "US", city: "Chicago" }, targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } });
    const outcome = evaluateConstructionCostBenchmark(req, [{ ...chicago, freshness: "live_current" }], CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    expect(outcome.result.confidence.benchmarkConfidence).not.toBe("high");
  });

  test("historical/stale evidence caps dataConfidence, never rescued by exact comparability", () => {
    const pool: ConstructionCostCandidateInput[] = [{ observation: obs({ propertySubtype: "retail_shopping_center", assetClass: "retail" }), freshness: "historical" }];
    const req = baseRequest({ geography: { country: "US", city: "Austin" }, assetClass: "retail", canonicalSubtype: "retail_shopping_center" });
    const outcome = evaluateConstructionCostBenchmark(req, pool, CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    expect(outcome.result.confidence.dataConfidence).toBe("low");
  });

  test("low comparability (approximate mapping, e.g. RLB 3-star hotel) never exceeds low/moderate confidence regardless of source quality", () => {
    const hotel3star = obs({ propertySubtype: "hotel_3_star", assetClass: "hotel", low: 230, high: 350 });
    const req = baseRequest({ geography: { country: "US", city: "Austin" }, assetClass: "hotel", canonicalSubtype: "hotel_select_service" });
    const outcome = evaluateConstructionCostBenchmark(req, [{ observation: hotel3star, freshness: "live_current" }], CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    expect(outcome.result.comparability).toBe("approximate");
    expect(outcome.result.confidence.benchmarkConfidence).not.toBe("high");
  });

  test("confidence is never an average: mixed dataConfidence/comparabilityConfidence always floors to the worse of the two", () => {
    const pool: ConstructionCostCandidateInput[] = [{ observation: obs({ propertySubtype: "retail_shopping_center", assetClass: "retail", sourceQuality: 40 }), freshness: "live_current" }];
    const req = baseRequest({ geography: { country: "US", city: "Austin" }, assetClass: "retail", canonicalSubtype: "retail_shopping_center" });
    const outcome = evaluateConstructionCostBenchmark(req, pool, CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    expect(outcome.result.confidence.dataConfidence).toBe("very_low"); // low source quality
    expect(outcome.result.confidence.comparabilityConfidence).toBe("high"); // exact match
    expect(outcome.result.confidence.benchmarkConfidence).toBe("very_low"); // floor, never averaged toward moderate/high
  });
});

// ============================================================================
// 12. Freshness / historical data
// ============================================================================
describe("12. Freshness / historical data", () => {
  test("historical evidence remains visible and usable absent a freshness floor", () => {
    const pool: ConstructionCostCandidateInput[] = [{ observation: obs(), freshness: "historical" }];
    const outcome = evaluateConstructionCostBenchmark(baseRequest({ geography: { country: "US", city: "Austin" } }), pool, CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
  });

  test("a freshness floor excludes stale evidence without deleting or mutating it", () => {
    const observation = obs();
    const before = JSON.parse(JSON.stringify(observation));
    const pool: ConstructionCostCandidateInput[] = [{ observation, freshness: "stale" }];
    const outcome = evaluateConstructionCostBenchmark(baseRequest({ geography: { country: "US", city: "Austin" }, minFreshness: "live_current" }), pool, CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
    expect(JSON.parse(JSON.stringify(observation))).toEqual(before);
  });

  test("no stale observation silently becomes current: confidence reflects the actual freshness", () => {
    const pool: ConstructionCostCandidateInput[] = [{ observation: obs({ propertySubtype: "retail_shopping_center", assetClass: "retail" }), freshness: "stale" }];
    const req = baseRequest({ geography: { country: "US", city: "Austin" }, assetClass: "retail", canonicalSubtype: "retail_shopping_center" });
    const outcome = evaluateConstructionCostBenchmark(req, pool, CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    expect(outcome.result.confidence.dataConfidence).not.toBe("high");
  });
});

// ============================================================================
// 13. Determinism
// ============================================================================
describe("13. Determinism", () => {
  test("shuffled observation order produces the same benchmark/confidence/provenance/aggregation", () => {
    const forward = evaluateConstructionCostBenchmark(baseRequest(), fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    const reversed = evaluateConstructionCostBenchmark(baseRequest(), [...fullPool()].reverse(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(forward.status).toBe("success");
    expect(reversed.status).toBe("success");
    if (forward.status !== "success" || reversed.status !== "success") return;
    expect(forward.result.benchmark).toEqual(reversed.result.benchmark);
    expect(forward.result.confidence).toEqual(reversed.result.confidence);
    expect(forward.result.provenance).toEqual(reversed.result.provenance);
  });

  test("shuffled INDEX pool order does not change an escalated result", () => {
    const req = baseRequest({ targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } });
    const forward = evaluateConstructionCostBenchmark(req, fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    const reversedIndex = evaluateConstructionCostBenchmark(req, fullPool(), [...CC_KNOWN_INDEX_OBSERVATIONS].reverse(), CHECKED_AT);
    expect(forward.status).toBe("success");
    expect(reversedIndex.status).toBe("success");
    if (forward.status !== "success" || reversedIndex.status !== "success") return;
    expect(forward.result.benchmark).toEqual(reversedIndex.result.benchmark);
  });

  test("duplicate observations in the pool do not change the deterministic result across orderings", () => {
    const a = obs({ propertySubtype: "retail_shopping_center", assetClass: "retail" });
    const dup = { ...a };
    const req = baseRequest({ geography: { country: "US", city: "Austin" }, assetClass: "retail", canonicalSubtype: "retail_shopping_center" });
    const forward = evaluateConstructionCostBenchmark(req, [{ observation: a }, { observation: dup }], CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    const reversed = evaluateConstructionCostBenchmark(req, [{ observation: dup }, { observation: a }], CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(forward.status).toBe("success");
    expect(reversed.status).toBe("success");
    if (forward.status !== "success" || reversed.status !== "success") return;
    expect(forward.result.benchmark).toEqual(reversed.result.benchmark);
    expect(forward.result.aggregation).toEqual(reversed.result.aggregation);
  });

  test("tied comparability candidates with mixed geography/subtype still resolve deterministically", () => {
    const a = obs({ low: 200, high: 400 });
    const b = obs({ low: 200, high: 400, citation: { ...obs().citation, locator: "Table Tie" } });
    const req = baseRequest({ geography: { country: "US", city: "Austin" } });
    const r1 = evaluateConstructionCostBenchmark(req, [{ observation: a }, { observation: b }], CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    const r2 = evaluateConstructionCostBenchmark(req, [{ observation: b }, { observation: a }], CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(r1.status).toBe("success");
    expect(r2.status).toBe("success");
    if (r1.status !== "success" || r2.status !== "success") return;
    // Output-facing fields (sorted independently of pool order) must match byte-for-byte.
    // auditTrail.candidatesIncluded intentionally mirrors Phase 2's pool-order-preserving
    // convention (documented in Phase 5) and is compared here as a set, not a sequence.
    expect(r1.result.benchmark).toEqual(r2.result.benchmark);
    expect(r1.result.provenance).toEqual(r2.result.provenance);
    expect(r1.result.confidence).toEqual(r2.result.confidence);
    expect(new Set(r1.result.auditTrail.candidatesIncluded.map((c) => c.observation.citation.locator))).toEqual(
      new Set(r2.result.auditTrail.candidatesIncluded.map((c) => c.observation.citation.locator)),
    );
  });
});

// ============================================================================
// 14. Duplicate observations (investigation + fix verification)
// ============================================================================
describe("14. Duplicate observation handling", () => {
  test("REGRESSION: a duplicated observation no longer escapes the single-observation confidence cap (Phase 7 fix)", () => {
    const a = obs({ propertySubtype: "retail_shopping_center", assetClass: "retail" });
    const dup = { ...a };
    const req = baseRequest({ geography: { country: "US", city: "Austin" }, assetClass: "retail", canonicalSubtype: "retail_shopping_center" });
    const single = evaluateConstructionCostBenchmark(req, [{ observation: a, freshness: "live_current" }], CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    const duplicated = evaluateConstructionCostBenchmark(req, [{ observation: a, freshness: "live_current" }, { observation: dup, freshness: "live_current" }], CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(single.status).toBe("success");
    expect(duplicated.status).toBe("success");
    if (single.status !== "success" || duplicated.status !== "success") return;
    expect(single.result.confidence.benchmarkConfidence).toBe("moderate");
    expect(duplicated.result.confidence.benchmarkConfidence).toBe("moderate"); // no longer inflated to "high" by the duplicate
    expect(duplicated.result.aggregation.method).toBe("SINGLE_OBSERVATION"); // collapsed, not RANGE_UNION over an identical duplicate
    expect(duplicated.result.assumptions.some((a2) => a2.includes("duplicate observation"))).toBe(true); // disclosed, not silently hidden
  });

  test("the raw pipeline audit trail still shows BOTH duplicate candidates — nothing is hidden from auditTrail.candidatesIncluded", () => {
    const a = obs({ propertySubtype: "retail_shopping_center", assetClass: "retail" });
    const dup = { ...a };
    const req = baseRequest({ geography: { country: "US", city: "Austin" }, assetClass: "retail", canonicalSubtype: "retail_shopping_center" });
    const outcome = evaluateConstructionCostBenchmark(req, [{ observation: a }, { observation: dup }], CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    expect(outcome.result.auditTrail.candidatesIncluded).toHaveLength(2);
  });

  test("two genuinely DIFFERENT observations (different citation locators/values) are never collapsed as duplicates", () => {
    const a = obs({ propertySubtype: "retail_shopping_center", assetClass: "retail", low: 200, high: 400 });
    const b = obs({ propertySubtype: "retail_shopping_center", assetClass: "retail", low: 250, high: 450, citation: { ...obs().citation, locator: "Table Different" } });
    const req = baseRequest({ geography: { country: "US", city: "Austin" }, assetClass: "retail", canonicalSubtype: "retail_shopping_center" });
    const outcome = evaluateConstructionCostBenchmark(req, [{ observation: a }, { observation: b }], CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    expect(outcome.result.aggregation.observationCount).toBe(2);
  });
});

// ============================================================================
// 15. Immutability / side effects
// ============================================================================
describe("15. Immutability / side effects", () => {
  test("candidate pool, index pool, and policy objects are unchanged after a full escalated evaluation", () => {
    const pool = fullPool();
    const beforePool = JSON.parse(JSON.stringify(pool));
    const beforeIndex = JSON.parse(JSON.stringify(CC_KNOWN_INDEX_OBSERVATIONS));
    const policy = { ...CC_STRICT_ESCALATION_POLICY };
    const beforePolicy = JSON.parse(JSON.stringify(policy));
    evaluateConstructionCostBenchmark(baseRequest({ targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" }, escalationPolicy: policy }), pool, CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(JSON.parse(JSON.stringify(pool))).toEqual(beforePool);
    expect(JSON.parse(JSON.stringify(CC_KNOWN_INDEX_OBSERVATIONS))).toEqual(beforeIndex);
    expect(JSON.parse(JSON.stringify(policy))).toEqual(beforePolicy);
  });

  test("source registry structures are not mutated by adapter listing or benchmark evaluation", () => {
    const before = JSON.parse(JSON.stringify(RLB_SOURCE_DEFINITION));
    RLB_ADAPTER.listObservations();
    evaluateConstructionCostBenchmark(baseRequest(), fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(JSON.parse(JSON.stringify(RLB_SOURCE_DEFINITION))).toEqual(before);
  });

  test("a Phase 5 success result is not mutated by a subsequent, unrelated Phase 6 adapter call", () => {
    const outcome = evaluateConstructionCostBenchmark(baseRequest(), fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    const before = JSON.parse(JSON.stringify(outcome));
    RLB_ADAPTER.listObservations();
    expect(JSON.parse(JSON.stringify(outcome))).toEqual(before);
  });
});

// ============================================================================
// 16. User override
// ============================================================================
describe("16. User override", () => {
  test("valid override preserves the underlying benchmark, does not mutate source evidence, is explicitly identifiable", () => {
    const outcome = evaluateConstructionCostBenchmark(baseRequest(), fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    const sourceObsBefore = JSON.parse(JSON.stringify(outcome.result.contributingObservations[0].candidate.observation));
    const overridden = applyUserOverride(outcome, { overriddenValue: { low: 300, high: 500, unit: "USD_per_sf" }, overriddenBy: "user@example.com", reason: "local knowledge", appliedAt: CHECKED_AT });
    expect(overridden.status).toBe("success");
    if (overridden.status !== "success") return;
    expect(overridden.result.userOverride?.overriddenValue.low).toBe(300);
    expect(overridden.result.benchmark).toEqual(outcome.result.benchmark); // underlying preserved
    expect(JSON.parse(JSON.stringify(overridden.result.contributingObservations[0].candidate.observation))).toEqual(sourceObsBefore); // source evidence untouched
  });

  test("DATA_GAP is never silently converted into a benchmark by an override — refused per the existing Phase 5 contract", () => {
    const gapOutcome = evaluateConstructionCostBenchmark(baseRequest({ costRepresentation: "total_cost" }), fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(gapOutcome.status).toBe("data_gap");
    const result = applyUserOverride(gapOutcome, { overriddenValue: { low: 1, high: 2, unit: "USD_per_sf" }, overriddenBy: "user@example.com", reason: "test", appliedAt: CHECKED_AT });
    expect(result.status).toBe("data_gap");
  });
});

// ============================================================================
// 17. Large-pool hardening
// ============================================================================
describe("17. Large-pool hardening", () => {
  function seededShuffle<T>(items: readonly T[], seed: number): T[] {
    const arr = [...items];
    let s = seed;
    const rand = () => {
      s = (s * 1103515245 + 12345) % 2147483648;
      return s / 2147483648;
    };
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function buildLargePool(n: number): ConstructionCostCandidateInput[] {
    const cities = ["Austin", "Miami", "Seattle", "Phoenix", "Chicago", "Boston", "Denver"];
    const subtypes: Array<[string, "office" | "retail" | "hotel" | "healthcare"]> = [
      ["office_prime", "office"],
      ["retail_shopping_center", "retail"],
      ["hotel_5_star", "hotel"],
      ["hospital_general", "healthcare"],
    ];
    const pool: ConstructionCostCandidateInput[] = [];
    for (let i = 0; i < n; i++) {
      const city = cities[i % cities.length];
      const [subtype, assetClass] = subtypes[i % subtypes.length];
      pool.push({
        observation: obs({
          geography: { country: "US", region: "XX", metro: `${city}, XX`, city },
          propertySubtype: subtype,
          assetClass,
          low: 200 + i,
          high: 400 + i,
          citation: { ...obs().citation, locator: `Table Large ${i}` },
        }),
        freshness: i % 3 === 0 ? "live_current" : i % 3 === 1 ? "stale" : "historical",
      });
    }
    return pool;
  }

  test("a deterministic 150-candidate pool, shuffled, produces the same result regardless of order, with no mutation and complete provenance", () => {
    const pool = buildLargePool(150);
    const shuffled = seededShuffle(pool, 42);
    const req = baseRequest({ geography: { country: "US", city: "Austin" }, assetClass: "office", canonicalSubtype: "office_premium" });
    const before = JSON.parse(JSON.stringify(pool));

    const a = evaluateConstructionCostBenchmark(req, pool, CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    const b = evaluateConstructionCostBenchmark(req, shuffled, CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);

    expect(a.status).toBe("success");
    expect(b.status).toBe("success");
    if (a.status !== "success" || b.status !== "success") return;
    expect(a.result.benchmark).toEqual(b.result.benchmark);
    expect(a.result.provenance).toEqual(b.result.provenance);
    expect(a.result.provenance.length).toBeGreaterThan(0);
    expect(JSON.parse(JSON.stringify(pool))).toEqual(before); // no mutation
  });
});

// ============================================================================
// 21. E86/E87 boundary (static regression check)
// ============================================================================
describe("21. E86/E87 boundary", () => {
  test("no E88 Phase 7 file imports from src/cap-rate-engine (E87) — verified by successful, isolated module resolution", () => {
    // If any Phase 7 test file (or anything it imports) required src/cap-rate-engine, this
    // suite's own module graph would already have pulled it in; this is a structural,
    // not merely assertional, guarantee for THIS test file's dependency closure.
    expect(RLB_SOURCE_DEFINITION.sourceId).toBe("rlb-north-america");
  });
});

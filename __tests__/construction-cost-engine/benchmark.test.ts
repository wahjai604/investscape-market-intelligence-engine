/**
 * InvestScape™ E70 Phase 5 — Unified Benchmark Output adversarial test suite.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Covers scenarios A-Z from the Phase 5 task instructions plus additional
 * determinism/immutability cases. Uses real E68/E70 data
 * (e70ConstructionCostPool(), CC_KNOWN_INDEX_OBSERVATIONS) for end-to-end
 * cases and synthetic fixtures (clearly constructed inline) for edge cases
 * the real dataset cannot exercise, matching the convention already used in
 * pipeline.test.ts / comparability.test.ts / escalation.test.ts.
 */
import { evaluateConstructionCostBenchmark, applyUserOverride } from "../../src/construction-cost-engine/benchmark";
import { e70ConstructionCostPool } from "../../src/construction-cost-engine/data";
import { CC_KNOWN_INDEX_OBSERVATIONS } from "../../src/construction-cost-engine/data/index-series";
import type { ConstructionCostBenchmarkRequest } from "../../src/construction-cost-engine/benchmark-types";
import type { ConstructionCostCandidateInput } from "../../src/construction-cost-engine/types";
import type { CRECitedObservation } from "../../src/cre-intelligence/types";

const CHECKED_AT = "2026-09-12";

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
  return e70ConstructionCostPool();
}

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

describe("A: successful hard-cost benchmark", () => {
  test("Seattle office_prime hard cost -> success, single observation", () => {
    const outcome = evaluateConstructionCostBenchmark(baseRequest(), fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    expect(outcome.result.identity.costRepresentation).toBe("hard_cost");
    expect(outcome.result.aggregation.method).toBe("SINGLE_OBSERVATION");
    expect(outcome.result.benchmark.escalated).toBe(false);
  });
});

describe("B: successful escalated hard-cost benchmark", () => {
  test("Seattle office_prime escalated to Q1 2024 via national index", () => {
    const req = baseRequest({ targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } });
    const outcome = evaluateConstructionCostBenchmark(req, fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    expect(outcome.result.benchmark.escalated).toBe(true);
    expect(outcome.result.benchmark.asOfPeriod.start).toBe("2024-01-01");
    expect(outcome.result.contributingObservations[0].escalation?.status).toBe("ESCALATED");
  });
});

describe("C: range low/high/value preservation", () => {
  test("single-observation benchmark preserves the exact low/high, never a fabricated midpoint", () => {
    const outcome = evaluateConstructionCostBenchmark(baseRequest(), fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    const source = outcome.result.contributingObservations[0].candidate.observation;
    expect(outcome.result.benchmark.low).toBe(source.low);
    expect(outcome.result.benchmark.high).toBe(source.high);
    expect(outcome.result.benchmark.value).toBeUndefined();
  });
});

describe("D: total-cost DATA_GAP when soft cost unavailable", () => {
  test("total_cost request -> TOTAL_COST_UNSUPPORTED, hard-cost evidence preserved in provenance", () => {
    const outcome = evaluateConstructionCostBenchmark(baseRequest({ costRepresentation: "total_cost" }), fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
    if (outcome.status !== "data_gap") return;
    expect(outcome.gap.reasonCode).toBe("TOTAL_COST_UNSUPPORTED");
    expect(outcome.gap.provenance.length).toBeGreaterThan(0);
    expect(outcome.gap.provenance[0].propertySubtype).toBe("office_prime");
  });
});

describe("E: unsupported subtype DATA_GAP", () => {
  test("multifamily subtype has no RLB mapping -> NO_EVIDENCE", () => {
    const req = baseRequest({ geography: { country: "US", city: "Seattle" }, assetClass: "multifamily", canonicalSubtype: "multifamily_low_rise" });
    const outcome = evaluateConstructionCostBenchmark(req, fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
    if (outcome.status !== "data_gap") return;
    expect(outcome.gap.reasonCode).toBe("NO_EVIDENCE");
  });
});

describe("F: unsupported geography DATA_GAP", () => {
  test("a city RLB has never covered -> NO_EVIDENCE, never a nearest-city fallback", () => {
    const req = baseRequest({ geography: { country: "US", city: "Nowhereville" } });
    const outcome = evaluateConstructionCostBenchmark(req, fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
    if (outcome.status !== "data_gap") return;
    expect(outcome.gap.reasonCode).toBe("NO_EVIDENCE");
  });
});

describe("G: wrong asset class DATA_GAP", () => {
  test("industrial has no RLB coverage at all -> NO_EVIDENCE", () => {
    const req = baseRequest({ assetClass: "industrial", canonicalSubtype: undefined });
    const outcome = evaluateConstructionCostBenchmark(req, fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
    if (outcome.status !== "data_gap") return;
    expect(outcome.gap.reasonCode).toBe("NO_EVIDENCE");
  });
});

describe("H: stale evidence with no freshness requirement remains usable", () => {
  test("a stale-but-otherwise-valid observation is still usable when no minFreshness is requested", () => {
    const pool: ConstructionCostCandidateInput[] = [{ observation: obs(), freshness: "stale" }];
    const outcome = evaluateConstructionCostBenchmark(baseRequest({ geography: { country: "US", city: "Austin" } }), pool, CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    expect(outcome.result.confidence.dataConfidence).toBe("low");
  });
});

describe("I: stale evidence with freshness floor becomes DATA_GAP", () => {
  test("minFreshness = recent excludes a stale-only pool -> FRESHNESS_UNSUPPORTED", () => {
    const pool: ConstructionCostCandidateInput[] = [{ observation: obs(), freshness: "stale" }];
    const req = baseRequest({ geography: { country: "US", city: "Austin" }, minFreshness: "recent" });
    const outcome = evaluateConstructionCostBenchmark(req, pool, CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
    if (outcome.status !== "data_gap") return;
    expect(outcome.gap.reasonCode).toBe("FRESHNESS_UNSUPPORTED");
  });
});

describe("J: missing provenance DATA_GAP", () => {
  test("an observation with empty citation fields is excluded, never silently accepted", () => {
    const badObs = obs({ citation: { sourceName: "", reportTitle: "", publicationDate: "", period: "", locator: "", sourceUrl: "", retrievedAt: "" } });
    const pool: ConstructionCostCandidateInput[] = [{ observation: badObs }];
    const outcome = evaluateConstructionCostBenchmark(baseRequest({ geography: { country: "US", city: "Austin" } }), pool, CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
  });
});

describe("K: currency mismatch DATA_GAP", () => {
  test("requesting CAD against a USD-only single-city pool -> CONVERSION_UNSUPPORTED, never a silent FX conversion", () => {
    const seattleOnly: ConstructionCostCandidateInput[] = [{ observation: obs({ geography: { country: "US", region: "WA", metro: "Seattle, WA", city: "Seattle" } }) }];
    const req = baseRequest({ currency: "CAD" });
    const outcome = evaluateConstructionCostBenchmark(req, seattleOnly, CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
    if (outcome.status !== "data_gap") return;
    expect(outcome.gap.reasonCode).toBe("CONVERSION_UNSUPPORTED");
  });
});

describe("L: unsupported unit conversion DATA_GAP", () => {
  test("requesting per_unit basis against a per_sf-only single-city pool -> CONVERSION_UNSUPPORTED", () => {
    const seattleOnly: ConstructionCostCandidateInput[] = [{ observation: obs({ geography: { country: "US", region: "WA", metro: "Seattle, WA", city: "Seattle" } }) }];
    const req = baseRequest({ unitBasis: "per_unit" });
    const outcome = evaluateConstructionCostBenchmark(req, seattleOnly, CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
    if (outcome.status !== "data_gap") return;
    expect(outcome.gap.reasonCode).toBe("CONVERSION_UNSUPPORTED");
  });
});

describe("M: required target-period escalation unavailable DATA_GAP", () => {
  test("a target period with no index coverage -> ESCALATION_UNAVAILABLE, never the un-escalated base value", () => {
    const req = baseRequest({ targetPeriod: { start: "2099-01-01", end: "2099-03-31", label: "Q1 2099" } });
    const outcome = evaluateConstructionCostBenchmark(req, fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
    if (outcome.status !== "data_gap") return;
    expect(outcome.gap.reasonCode).toBe("ESCALATION_UNAVAILABLE");
  });
});

describe("N: multiple comparable observations aggregate deterministically", () => {
  test("two overlapping same-tier observations -> RANGE_UNION", () => {
    const a = obs({ low: 200, high: 400 });
    const b = obs({ low: 300, high: 500, citation: { ...obs().citation, locator: "Table Y" } });
    const outcome = evaluateConstructionCostBenchmark(baseRequest({ geography: { country: "US", city: "Austin" } }), [{ observation: a }, { observation: b }], CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    expect(outcome.result.aggregation.method).toBe("RANGE_UNION");
    expect(outcome.result.benchmark.low).toBe(200);
    expect(outcome.result.benchmark.high).toBe(500);
  });
});

describe("O: incompatible observations excluded from the benchmark", () => {
  test("a wrong-city observation in the pool never contributes to a benchmark for the requested city", () => {
    const good = obs({ geography: { country: "US", region: "TX", metro: "Austin, TX", city: "Austin" } });
    const wrongCity = obs({ geography: { country: "US", region: "FL", metro: "Miami, FL", city: "Miami" }, citation: { ...obs().citation, locator: "Table Miami" } });
    const outcome = evaluateConstructionCostBenchmark(baseRequest({ geography: { country: "US", city: "Austin" } }), [{ observation: good }, { observation: wrongCity }], CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    expect(outcome.result.contributingObservations).toHaveLength(1);
    expect(outcome.result.contributingObservations[0].candidate.observation.geography.city).toBe("Austin");
  });
});

describe("P: material disagreement handled conservatively", () => {
  test("two non-overlapping same-tier observations -> MATERIAL_DISAGREEMENT, never an invented midpoint", () => {
    const a = obs({ low: 100, high: 150 });
    const b = obs({ low: 400, high: 500, citation: { ...obs().citation, locator: "Table Z" } });
    const outcome = evaluateConstructionCostBenchmark(baseRequest({ geography: { country: "US", city: "Austin" } }), [{ observation: a }, { observation: b }], CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
    if (outcome.status !== "data_gap") return;
    expect(outcome.gap.reasonCode).toBe("MATERIAL_DISAGREEMENT");
  });
});

describe("Q: deterministic tie", () => {
  test("two identical-value observations produce the same union range as either one alone", () => {
    const a = obs({ low: 200, high: 400 });
    const b = obs({ low: 200, high: 400, citation: { ...obs().citation, locator: "Table W" } });
    const outcome = evaluateConstructionCostBenchmark(baseRequest({ geography: { country: "US", city: "Austin" } }), [{ observation: a }, { observation: b }], CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    expect(outcome.result.benchmark.low).toBe(200);
    expect(outcome.result.benchmark.high).toBe(400);
  });
});

describe("R: candidate order independence", () => {
  test("shuffled pool ordering does not change the benchmark, confidence, provenance, or aggregation", () => {
    const forward = evaluateConstructionCostBenchmark(baseRequest(), fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    const reversed = evaluateConstructionCostBenchmark(baseRequest(), [...fullPool()].reverse(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(forward.status).toBe("success");
    expect(reversed.status).toBe("success");
    if (forward.status !== "success" || reversed.status !== "success") return;
    // The output layer's own deterministic pieces (sorted independently of pool order) must match exactly.
    // auditTrail.candidatesIncluded/Excluded intentionally mirror Phase 2's pool-order-preserving convention
    // and are compared here as sets, not sequences.
    expect(forward.result.benchmark).toEqual(reversed.result.benchmark);
    expect(forward.result.confidence).toEqual(reversed.result.confidence);
    expect(forward.result.provenance).toEqual(reversed.result.provenance);
    expect(forward.result.aggregation).toEqual(reversed.result.aggregation);
    expect(new Set(forward.result.auditTrail.candidatesIncluded.map((c) => c.observation.citation.locator))).toEqual(
      new Set(reversed.result.auditTrail.candidatesIncluded.map((c) => c.observation.citation.locator)),
    );
  });
});

describe("S: repeated-call determinism", () => {
  test("repeated calls with identical input produce byte-identical output", () => {
    const a = evaluateConstructionCostBenchmark(baseRequest(), fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    const b = evaluateConstructionCostBenchmark(baseRequest(), fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("T: no mutation", () => {
  test("candidate pool and its observations are never mutated", () => {
    const pool = fullPool();
    const before = JSON.parse(JSON.stringify(pool));
    evaluateConstructionCostBenchmark(baseRequest({ targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } }), pool, CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(JSON.parse(JSON.stringify(pool))).toEqual(before);
  });

  test("the index pool is never mutated", () => {
    const before = JSON.parse(JSON.stringify(CC_KNOWN_INDEX_OBSERVATIONS));
    evaluateConstructionCostBenchmark(baseRequest({ targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } }), fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(JSON.parse(JSON.stringify(CC_KNOWN_INDEX_OBSERVATIONS))).toEqual(before);
  });
});

describe("U: provenance preserved end-to-end", () => {
  test("provenance names the source, observation, geography, subtype, period, and escalation details", () => {
    const outcome = evaluateConstructionCostBenchmark(baseRequest({ targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } }), fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    const p = outcome.result.provenance[0];
    expect(p.sourceId).toBe("rlb-north-america");
    expect(p.geography.city).toBe("Seattle");
    expect(p.propertySubtype).toBe("office_prime");
    expect(p.wasEscalated).toBe(true);
    expect(p.escalation?.indexSeriesId).toBeTruthy();
  });
});

describe("V: confidence floor", () => {
  test("a low-source-quality observation caps benchmarkConfidence, never rescued by an exact comparability match", () => {
    const lowQuality = obs({ sourceQuality: 40 });
    const outcome = evaluateConstructionCostBenchmark(baseRequest({ geography: { country: "US", city: "Austin" } }), [{ observation: lowQuality, freshness: "live_current" }], CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    expect(outcome.result.confidence.dataConfidence).toBe("very_low");
    expect(outcome.result.confidence.benchmarkConfidence).toBe("very_low");
  });
});

describe("W: user override behavior", () => {
  test("an override augments a success result without discarding the underlying computed benchmark", () => {
    const outcome = evaluateConstructionCostBenchmark(baseRequest(), fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    const overridden = applyUserOverride(outcome, { overriddenValue: { low: 300, high: 500, unit: "USD_per_sf" }, overriddenBy: "user@example.com", reason: "Local market knowledge", appliedAt: CHECKED_AT });
    expect(overridden.status).toBe("success");
    if (overridden.status !== "success") return;
    expect(overridden.result.userOverride?.overriddenBy).toBe("user@example.com");
    expect(overridden.result.benchmark).toEqual(outcome.result.benchmark); // underlying computed benchmark untouched
  });

  test("an override is refused on a DATA_GAP outcome — never converts a gap into fabricated evidence", () => {
    const gapOutcome = evaluateConstructionCostBenchmark(baseRequest({ costRepresentation: "total_cost" }), fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(gapOutcome.status).toBe("data_gap");
    const result = applyUserOverride(gapOutcome, { overriddenValue: { low: 1, high: 2, unit: "USD_per_sf" }, overriddenBy: "user@example.com", reason: "test", appliedAt: CHECKED_AT });
    expect(result.status).toBe("data_gap");
  });
});

describe("X: empty candidate pool", () => {
  test("empty pool -> NO_EVIDENCE", () => {
    const outcome = evaluateConstructionCostBenchmark(baseRequest(), [], CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
    if (outcome.status !== "data_gap") return;
    expect(outcome.gap.reasonCode).toBe("NO_EVIDENCE");
  });
});

describe("Y: malformed/invalid request", () => {
  test("an unrecognized country -> INVALID_REQUEST", () => {
    const req = baseRequest({ geography: { country: "XX" as unknown as "US" } });
    const outcome = evaluateConstructionCostBenchmark(req, fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
    if (outcome.status !== "data_gap") return;
    expect(outcome.gap.reasonCode).toBe("INVALID_REQUEST");
  });
});

describe("Z: construction-index input cannot masquerade as a cost benchmark", () => {
  test("a pool containing only construction_index observations never produces a benchmark", () => {
    const indexObs: CRECitedObservation = {
      metric: "construction_index",
      assetClass: "other",
      geography: { country: "US", city: "Austin" },
      periodStart: "2025-04-01",
      periodEnd: "2025-04-30",
      value: 19560,
      unit: "index",
      basis: "index",
      source: { sourceId: "rlb-north-america", sourceName: "Rider Levett Bucknall", sourceType: "construction_cost" },
      citation: obs().citation,
      sourceQuality: 94,
    };
    const outcome = evaluateConstructionCostBenchmark(baseRequest({ geography: { country: "US", city: "Austin" } }), [{ observation: indexObs }], CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
    if (outcome.status !== "data_gap") return;
    expect(outcome.gap.reasonCode).toBe("NO_EVIDENCE");
  });
});

describe("Additional: deterministic gap construction", () => {
  test("repeated DATA_GAP evaluation for the same unsupported request is byte-identical", () => {
    const req = baseRequest({ assetClass: "industrial", canonicalSubtype: undefined });
    const a = evaluateConstructionCostBenchmark(req, fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    const b = evaluateConstructionCostBenchmark(req, fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("Additional: deterministic provenance ordering", () => {
  test("provenance ordering is stable regardless of input pool order", () => {
    const a = obs({ low: 200, high: 400 });
    const b = obs({ low: 300, high: 500, citation: { ...obs().citation, locator: "Table Y" } });
    const forward = evaluateConstructionCostBenchmark(baseRequest({ geography: { country: "US", city: "Austin" } }), [{ observation: a }, { observation: b }], CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    const reversed = evaluateConstructionCostBenchmark(baseRequest({ geography: { country: "US", city: "Austin" } }), [{ observation: b }, { observation: a }], CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(forward.status).toBe("success");
    expect(reversed.status).toBe("success");
    if (forward.status !== "success" || reversed.status !== "success") return;
    expect(forward.result.provenance.map((p) => p.locator)).toEqual(reversed.result.provenance.map((p) => p.locator));
  });
});

describe("Additional: no silent fallback to unrelated subtype", () => {
  test("a hotel request against an office-only pool never returns an office observation as a hotel benchmark", () => {
    const req = baseRequest({ assetClass: "hotel", canonicalSubtype: "hotel_luxury" });
    const outcome = evaluateConstructionCostBenchmark(req, fullPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    // Hotel data DOES exist in the real pool (RLB hotel_5_star), so this should succeed legitimately —
    // the adversarial guarantee is that it is the actual hotel observation, never an office proxy.
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    expect(outcome.result.contributingObservations[0].candidate.observation.assetClass).toBe("hotel");
  });
});

describe("Additional: no silent CAD->USD conversion", () => {
  test("a Toronto (CAD) observation is never coerced into a USD request", () => {
    const torontoOnly = fullPool().filter((c) => c.observation.geography.city === "Toronto" && c.observation.propertySubtype === "office_prime");
    expect(torontoOnly.length).toBeGreaterThan(0);
    const req = baseRequest({ geography: { country: "CA", city: "Toronto" }, currency: "USD" });
    const outcome = evaluateConstructionCostBenchmark(req, torontoOnly, CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
    if (outcome.status !== "data_gap") return;
    expect(outcome.gap.reasonCode).toBe("CONVERSION_UNSUPPORTED");
  });
});

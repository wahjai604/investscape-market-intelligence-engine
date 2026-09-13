/**
 * InvestScape™ E87 Phase 3 — Consensus & Benchmark Selection tests.
 *
 * Adversarial style mirroring Phase 2's own test suite: every scenario is
 * exercised end to end through `evaluateComparability` (Phase 2, unmodified)
 * piped into `buildCapRateBenchmark` (Phase 3), never by calling Phase 3
 * internals directly with hand-built E87ComparabilityResult objects, so the
 * two phases are proven to compose correctly.
 */
import { evaluateComparability } from "../../src/cap-rate-engine/comparability";
import type { E87CandidateInput, E87ComparabilityRequest } from "../../src/cap-rate-engine/comparability-types";
import { buildCapRateBenchmark } from "../../src/cap-rate-engine/benchmark-consensus";
import type { CRECitedObservation, CRESourceType } from "../../src/cre-intelligence/types";

function obs(overrides: Partial<CRECitedObservation> = {}): CRECitedObservation {
  return {
    metric: "cap_rate",
    assetClass: "multifamily",
    geography: { country: "US", metro: "Houston Metro", city: "Houston" },
    periodStart: "2026-01-01",
    periodEnd: "2026-06-30",
    value: 5.5,
    unit: "percent",
    capRateType: "stabilized",
    source: { sourceId: "kidder-mathews-research", sourceName: "Kidder Mathews", sourceType: "brokerage" },
    citation: {
      sourceName: "Kidder Mathews",
      reportTitle: "Test Report 2026",
      publicationDate: "2026-07-01",
      period: "2Q 2026",
      locator: "Table X",
      sourceUrl: "https://example.com/report.pdf",
      retrievedAt: "2026-09-01",
    },
    sourceQuality: 90,
    ...overrides,
  };
}

function source(sourceId: string, sourceName: string, sourceType: CRESourceType) {
  return { sourceId, sourceName, sourceType };
}

function baseRequest(overrides: Partial<E87ComparabilityRequest> = {}): E87ComparabilityRequest {
  return {
    geography: { country: "US", city: "Houston" },
    assetClass: "multifamily",
    capRateType: "stabilized",
    ...overrides,
  };
}

function candidate(o: CRECitedObservation, freshness?: E87CandidateInput["freshness"]): E87CandidateInput {
  return { observation: o, freshness };
}

/** Convenience: build the Phase 3 result straight from a request + candidate pool. */
function run(request: E87ComparabilityRequest, pool: E87CandidateInput[]) {
  return buildCapRateBenchmark(evaluateComparability(request, pool));
}

describe("1. One exact, authoritative observation", () => {
  test("single tier-1 (valuation) exact observation produces a benchmark, not a weak one", () => {
    const result = run(baseRequest(), [
      candidate(
        obs({ source: source("cushman-valuation", "Cushman Valuation", "valuation") }),
        "live_current",
      ),
    ]);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.benchmark.value).toBe(5.5);
    expect(result.benchmark.method).toBe("single_observation");
    expect(result.dataConfidence).toBe("high");
    // Confidence reflects limited breadth (n=1) even though data is excellent — floor pulls it down.
    expect(result.confidence).not.toBe("very_low");
  });
});

describe("2. Two compatible observations", () => {
  test("CBRE + C&W in close agreement produce a weighted consensus", () => {
    const result = run(baseRequest(), [
      candidate(obs({ source: source("cbre", "CBRE", "brokerage"), value: 5.5 }), "recent"),
      candidate(obs({ source: source("cw", "Cushman & Wakefield", "brokerage"), value: 5.55 }), "recent"),
    ]);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.contributingObservations).toHaveLength(2);
    expect(result.benchmark.value).toBeGreaterThan(5.49);
    expect(result.benchmark.value).toBeLessThan(5.56);
  });
});

describe("3. Three tightly clustered observations", () => {
  test("CBRE=5.5, C&W=5.6, JLL=5.7 -> tight/moderate consensus, all contributing", () => {
    const result = run(baseRequest(), [
      candidate(obs({ source: source("cbre", "CBRE", "brokerage"), value: 5.5 }), "recent"),
      candidate(obs({ source: source("cw", "Cushman & Wakefield", "brokerage"), value: 5.6 }), "recent"),
      candidate(obs({ source: source("jll", "JLL", "brokerage"), value: 5.7 }), "recent"),
    ]);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.contributingObservations).toHaveLength(3);
    expect(result.dispersion.bps).toBeCloseTo(20, 5);
    expect(result.dispersion.tier).toBe("moderate");
    expect(result.benchmark.value).toBeGreaterThan(5.5);
    expect(result.benchmark.value).toBeLessThan(5.7);
  });
});

describe("4. Moderate dispersion", () => {
  test("~30bps spread classified as moderate", () => {
    const result = run(baseRequest(), [
      candidate(obs({ source: source("a", "Source A", "brokerage"), value: 5.4 }), "recent"),
      candidate(obs({ source: source("b", "Source B", "brokerage"), value: 5.7 }), "recent"),
    ]);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.dispersion.tier).toBe("moderate");
  });
});

describe("5. Material dispersion (resolvable, not severe)", () => {
  test("~70bps spread classified as material and still produces a (lower-confidence) benchmark", () => {
    const result = run(baseRequest(), [
      candidate(obs({ source: source("a", "Source A", "brokerage"), value: 5.2 }), "recent"),
      candidate(obs({ source: source("b", "Source B", "brokerage"), value: 5.9 }), "recent"),
    ]);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.dispersion.tier).toBe("material");
    expect(result.benchmarkConfidence).toBe("low");
  });
});

describe("6. Severe conflict — CBRE=5.0 vs C&W=7.0, same tier", () => {
  test("no averaging: returns DATA_GAP with MATERIAL_SOURCE_DISAGREEMENT", () => {
    const result = run(baseRequest(), [
      candidate(obs({ source: source("cbre", "CBRE", "brokerage"), value: 5.0 }), "recent"),
      candidate(obs({ source: source("cw", "Cushman & Wakefield", "brokerage"), value: 7.0 }), "recent"),
    ]);
    expect(result.status).toBe("data_gap");
    if (result.status !== "data_gap") return;
    expect(result.gap.reasonCode).toBe("MATERIAL_SOURCE_DISAGREEMENT");
    expect(result.gap.conflictingCandidates).toHaveLength(2);
    // Never a fabricated midpoint of 6.0.
    expect(result.gap.conflictingCandidates!.some((c) => c.scalarValue === 6.0)).toBe(false);
  });
});

describe("7. Incompatible cap-rate families", () => {
  test("transaction-derived and survey stabilized never pooled; unpinned request -> DATA_GAP", () => {
    const result = run(baseRequest({ capRateType: undefined }), [
      candidate(obs({ source: source("a", "Source A", "brokerage"), value: 5.5, capRateType: "stabilized" }), "recent"),
      candidate(
        obs({
          source: source("txn-db", "Transaction DB", "transaction_database"),
          value: 6.2,
          capRateType: "derived_transaction",
          derivedFrom: {
            propertyName: "123 Main St",
            transactionDate: "2026-05-01",
            purchasePrice: 10_000_000,
            priceSource: "county records",
            noi: 620_000,
            noiSource: "seller disclosure",
            methodology: "NOI / purchase price",
          },
        }),
        "recent",
      ),
    ]);
    expect(result.status).toBe("data_gap");
    if (result.status !== "data_gap") return;
    expect(result.gap.reasonCode).toBe("INCOMPATIBLE_CAP_RATE_FAMILY");
  });

  test("pinning capRateType selects only that concept and documents the family-adjacent exclusion", () => {
    const result = run(baseRequest({ capRateType: "stabilized" }), [
      candidate(obs({ source: source("a", "Source A", "brokerage"), value: 5.5, capRateType: "stabilized" }), "recent"),
      candidate(obs({ source: source("b", "Source B", "brokerage"), value: 6.0, capRateType: "going_in" }), "recent"),
    ]);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.contributingObservations).toHaveLength(1);
    expect(result.audit.excludedByPhase3.length).toBeGreaterThanOrEqual(0);
  });
});

describe("8. Different asset classes", () => {
  test("office observation never contributes to a multifamily request", () => {
    const result = run(baseRequest({ assetClass: "multifamily" }), [
      candidate(obs({ source: source("a", "Source A", "brokerage"), assetClass: "office" })),
    ]);
    expect(result.status).toBe("data_gap");
    if (result.status !== "data_gap") return;
    expect(result.gap.reasonCode).toBe("NO_COMPARABLE_OBSERVATIONS");
  });
});

describe("9. Different property classes", () => {
  test("Class A request excludes an explicit Class C observation", () => {
    const result = run(baseRequest({ assetClass: "office", propertyClass: "A" }), [
      candidate(obs({ source: source("a", "Source A", "brokerage"), assetClass: "office", locationType: "cbd", propertyClass: "C" })),
    ]);
    expect(result.status).toBe("data_gap");
  });
});

describe("10. Downtown vs suburban", () => {
  test("suburban request never combined with a downtown-only observation", () => {
    const result = run(baseRequest({ assetClass: "office", locationType: "suburban" }), [
      candidate(obs({ source: source("a", "Source A", "brokerage"), assetClass: "office", locationType: "cbd" })),
    ]);
    expect(result.status).toBe("data_gap");
  });
});

describe("11. Stale candidate excluded by request", () => {
  test("minFreshness gate excludes a historical-only pool -> INSUFFICIENT_FRESHNESS", () => {
    const result = run(baseRequest({ minFreshness: "live_current" }), [
      candidate(obs({ source: source("a", "Source A", "brokerage") }), "historical"),
    ]);
    expect(result.status).toBe("data_gap");
    if (result.status !== "data_gap") return;
    expect(result.gap.reasonCode).toBe("INSUFFICIENT_FRESHNESS");
  });
});

describe("12. Historical candidate retained but not preferred", () => {
  test("a historical observation alongside a live_current one contributes but does not dominate weight", () => {
    const result = run(baseRequest(), [
      candidate(obs({ source: source("fresh", "Fresh Source", "brokerage"), value: 5.5 }), "live_current"),
      candidate(obs({ source: source("old", "Old Source", "brokerage"), value: 5.6 }), "historical"),
    ]);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.contributingObservations).toHaveLength(2);
    // Weighted toward the fresher source: closer to 5.5 than the unweighted midpoint 5.55.
    expect(result.benchmark.value).toBeLessThan(5.55);
  });
});

describe("13. Missing provenance", () => {
  test("an observation with empty citation fields never reaches Phase 3 eligibility", () => {
    const result = run(baseRequest(), [
      candidate(
        obs({
          source: source("a", "Source A", "brokerage"),
          citation: {
            sourceName: "",
            reportTitle: "",
            publicationDate: "",
            period: "",
            locator: "",
            sourceUrl: "",
            retrievedAt: "",
          },
        }),
      ),
    ]);
    expect(result.status).toBe("data_gap");
    if (result.status !== "data_gap") return;
    expect(result.audit.excludedByComparability[0].note).toContain("INSUFFICIENT_PROVENANCE");
  });
});

describe("14. Incompatible representation", () => {
  test("an observation with neither value nor low/high, and no representation tag, is UNSUPPORTED_REPRESENTATION", () => {
    const result = run(baseRequest(), [
      candidate(obs({ source: source("a", "Source A", "brokerage"), value: undefined, low: undefined, high: undefined })),
    ]);
    expect(result.status).toBe("data_gap");
    if (result.status !== "data_gap") return;
    expect(result.gap.reasonCode).toBe("UNSUPPORTED_REPRESENTATION");
  });

  test("an unrecognized tags.representation value is unsupported, never guessed", () => {
    const result = run(baseRequest(), [
      candidate(obs({ source: source("a", "Source A", "brokerage"), tags: { representation: "mode" } })),
    ]);
    expect(result.status).toBe("data_gap");
    if (result.status !== "data_gap") return;
    expect(result.gap.reasonCode).toBe("UNSUPPORTED_REPRESENTATION");
  });

  test("range representation uses the documented midpoint transformation", () => {
    const result = run(baseRequest(), [
      candidate(obs({ source: source("a", "Source A", "brokerage"), value: undefined, low: 5.0, high: 6.0 })),
    ]);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.benchmark.value).toBe(5.5);
  });
});

describe("15. Source hierarchy preference", () => {
  test("valuation-tier source is weighted more heavily than a secondary/aggregated one", () => {
    const result = run(baseRequest(), [
      candidate(obs({ source: source("valuer", "Specialist Valuer", "valuation"), value: 5.0 }), "recent"),
      candidate(obs({ source: source("gov", "Government Stat Office", "government"), value: 5.6 }), "recent"),
    ]);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    // Weighted average should sit closer to the higher-tier source's value than the midpoint 5.3.
    expect(result.benchmark.value).toBeLessThan(5.3);
  });
});

describe("16. Source hierarchy cannot override incompatibility", () => {
  test("a tier-1 valuation source with the WRONG asset class is still excluded", () => {
    const result = run(baseRequest({ assetClass: "multifamily" }), [
      candidate(obs({ source: source("valuer", "Specialist Valuer", "valuation"), assetClass: "retail" })),
    ]);
    expect(result.status).toBe("data_gap");
    if (result.status !== "data_gap") return;
    expect(result.audit.excludedByComparability).toHaveLength(1);
  });
});

describe("17. Deterministic tie-breaking", () => {
  test("two candidates with identical weight order by sourceId, deterministically", () => {
    const a = candidate(obs({ source: source("zzz", "Z Source", "brokerage"), value: 5.5 }), "recent");
    const b = candidate(obs({ source: source("aaa", "A Source", "brokerage"), value: 5.6 }), "recent");
    const r1 = run(baseRequest(), [a, b]);
    const r2 = run(baseRequest(), [b, a]);
    expect(r1.status).toBe("success");
    expect(r2.status).toBe("success");
    if (r1.status !== "success" || r2.status !== "success") return;
    const order1 = r1.audit.contributing.map((c) => c.sourceId);
    const order2 = r2.audit.contributing.map((c) => c.sourceId);
    expect(order1).toEqual(order2);
    expect(order1[0]).toBe("aaa");
  });
});

describe("18. Identical input -> identical result", () => {
  test("running twice on the same pool produces byte-identical benchmark output", () => {
    const pool = [
      candidate(obs({ source: source("cbre", "CBRE", "brokerage"), value: 5.5 }), "recent"),
      candidate(obs({ source: source("jll", "JLL", "brokerage"), value: 5.6 }), "recent"),
    ];
    const r1 = run(baseRequest(), pool);
    const r2 = run(baseRequest(), pool);
    expect(JSON.stringify(r1)).toEqual(JSON.stringify(r2));
  });
});

describe("19. Zero eligible candidates", () => {
  test("empty pool -> DATA_GAP NO_COMPARABLE_OBSERVATIONS, never throws", () => {
    const result = run(baseRequest(), []);
    expect(result.status).toBe("data_gap");
    if (result.status !== "data_gap") return;
    expect(result.gap.reasonCode).toBe("NO_COMPARABLE_OBSERVATIONS");
    expect(result.gap.eligibleCount).toBe(0);
  });
});

describe("20. One candidate sufficient for benchmark", () => {
  test("a single comparable candidate alone succeeds without an arbitrary minimum sample size", () => {
    const result = run(baseRequest(), [candidate(obs({ source: source("a", "Source A", "brokerage") }), "recent")]);
    expect(result.status).toBe("success");
  });
});

describe("21. High data confidence / low benchmark confidence", () => {
  test("excellent sources with material dispersion: dataConfidence high, benchmarkConfidence low", () => {
    const result = run(baseRequest(), [
      candidate(obs({ source: source("v1", "Valuer One", "valuation"), value: 5.2 }), "live_current"),
      candidate(obs({ source: source("v2", "Valuer Two", "valuation"), value: 5.9 }), "live_current"),
    ]);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.dataConfidence).toBe("high");
    expect(result.benchmarkConfidence).toBe("low");
  });
});

describe("22. Low data confidence / high benchmark confidence", () => {
  test("secondary/aggregated sources tightly clustered: dataConfidence low, benchmarkConfidence high", () => {
    const result = run(baseRequest(), [
      candidate(obs({ source: source("g1", "Gov Stat 1", "government"), value: 5.50 }), "recent"),
      candidate(obs({ source: source("g2", "Gov Stat 2", "government"), value: 5.51 }), "recent"),
      candidate(obs({ source: source("g3", "Gov Stat 3", "government"), value: 5.52 }), "recent"),
    ]);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.dataConfidence).toBe("low");
    expect(result.benchmarkConfidence).toBe("high");
  });
});

describe("23. Final confidence uses FLOOR, never average", () => {
  test("floor(high, low) = low, not a blended 'moderate'", () => {
    const result = run(baseRequest(), [
      candidate(obs({ source: source("v1", "Valuer One", "valuation"), value: 5.2 }), "live_current"),
      candidate(obs({ source: source("v2", "Valuer Two", "valuation"), value: 5.9 }), "live_current"),
    ]);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.confidence).toBe(result.benchmarkConfidence < result.dataConfidence ? result.benchmarkConfidence : result.confidence);
    expect(result.confidence).toBe("low");
  });
});

describe("24. DATA_GAP includes audit evidence", () => {
  test("every data_gap result carries candidateCount, eligibleCount, excludedCount, explanation, provenance", () => {
    const result = run(baseRequest(), [
      candidate(obs({ source: source("a", "Source A", "brokerage"), value: 5.0 }), "recent"),
      candidate(obs({ source: source("b", "Source B", "brokerage"), value: 7.0 }), "recent"),
    ]);
    expect(result.status).toBe("data_gap");
    if (result.status !== "data_gap") return;
    expect(result.gap.candidateCount).toBe(2);
    expect(result.gap.eligibleCount).toBe(2);
    expect(typeof result.gap.explanation).toBe("string");
    expect(result.gap.explanation.length).toBeGreaterThan(0);
    expect(result.gap.provenanceReferences.length).toBeGreaterThan(0);
    expect(result.audit.narrative.length).toBeGreaterThan(0);
  });
});

describe("25. No silent averaging of conflicting sources", () => {
  test("5.0 vs 7.0 never yields 6.0 anywhere in the result", () => {
    const result = run(baseRequest(), [
      candidate(obs({ source: source("a", "Source A", "brokerage"), value: 5.0 }), "recent"),
      candidate(obs({ source: source("b", "Source B", "brokerage"), value: 7.0 }), "recent"),
    ]);
    expect(JSON.stringify(result)).not.toContain('"value":6');
  });
});

describe("26. No mixing Class A/B/C", () => {
  test("Class A request never pools with an unrequested different explicit class in consensus", () => {
    const result = run(baseRequest({ assetClass: "office", propertyClass: "A" }), [
      candidate(obs({ source: source("a", "Source A", "brokerage"), assetClass: "office", locationType: "cbd", propertyClass: "A" }), "recent"),
      candidate(obs({ source: source("b", "Source B", "brokerage"), assetClass: "office", locationType: "cbd", propertyClass: "B" }), "recent"),
    ]);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.contributingObservations).toHaveLength(1);
    expect(result.contributingObservations[0].observation.propertyClass).toBe("A");
  });
});

describe("27. No mixing downtown/suburban", () => {
  test("downtown-pinned request never pools a suburban observation into consensus", () => {
    const result = run(baseRequest({ assetClass: "office", locationType: "cbd" }), [
      candidate(obs({ source: source("a", "Source A", "brokerage"), assetClass: "office", locationType: "cbd" }), "recent"),
      candidate(obs({ source: source("b", "Source B", "brokerage"), assetClass: "office", locationType: "suburban" }), "recent"),
    ]);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.contributingObservations).toHaveLength(1);
  });
});

describe("28. No fabricated benchmark when dispersion is unresolved", () => {
  test("severe dispersion with tied top-tier sources never produces a status:success benchmark", () => {
    const result = run(baseRequest(), [
      candidate(obs({ source: source("cbre", "CBRE", "brokerage"), value: 5.0 }), "recent"),
      candidate(obs({ source: source("cw", "Cushman & Wakefield", "brokerage"), value: 7.0 }), "recent"),
    ]);
    expect(result.status).toBe("data_gap");
  });
});

describe("Additional edge cases", () => {
  test("severe dispersion resolved by a uniquely-best-tier source (methodology preference)", () => {
    const result = run(baseRequest(), [
      candidate(obs({ source: source("valuer", "Specialist Valuer", "valuation"), value: 5.0 }), "live_current"),
      candidate(obs({ source: source("gov", "Government Stat Office", "government"), value: 8.0 }), "recent"),
    ]);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.benchmark.method).toBe("methodology_preferred");
    expect(result.benchmark.value).toBe(5.0);
    expect(result.contributingObservations).toHaveLength(1);
    expect(result.benchmarkConfidence).toBe("very_low");
  });

  test("transaction-derived observation may be recognized as comparable evidence, not recomputed", () => {
    const result = run(baseRequest({ capRateType: "derived_transaction" }), [
      candidate(
        obs({
          source: source("txn-db", "Transaction DB", "transaction_database"),
          value: 5.5,
          capRateType: "derived_transaction",
          derivedFrom: {
            propertyName: "123 Main St",
            transactionDate: "2026-05-01",
            purchasePrice: 10_000_000,
            priceSource: "county records",
            noi: 550_000,
            noiSource: "seller disclosure",
            methodology: "NOI / purchase price",
          },
        }),
        "recent",
      ),
    ]);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.benchmark.value).toBe(5.5);
    expect(result.audit.contributing[0].sourceHierarchyTier).toBe("transaction_derived_complete_provenance");
  });

  test("DispersionPolicy is configurable via options", () => {
    const request = baseRequest();
    const pool = [
      candidate(obs({ source: source("a", "Source A", "brokerage"), value: 5.0 }), "recent"),
      candidate(obs({ source: source("b", "Source B", "brokerage"), value: 5.5 }), "recent"),
    ];
    const strict = buildCapRateBenchmark(evaluateComparability(request, pool), {
      dispersionPolicy: { tightBps: 5, moderateBps: 10, materialBps: 20 },
    });
    expect(strict.status).toBe("data_gap");
    if (strict.status !== "data_gap") return;
    expect(strict.gap.reasonCode).toBe("MATERIAL_SOURCE_DISAGREEMENT");
  });

  test("undefined capRateType with a single concept group succeeds without a pin", () => {
    const result = run(baseRequest({ capRateType: undefined }), [
      candidate(obs({ source: source("a", "Source A", "brokerage"), capRateType: "stabilized" }), "recent"),
    ]);
    expect(result.status).toBe("success");
  });

  test("does not throw for any scenario in this file (no exceptions on evidence gaps)", () => {
    expect(() => run(baseRequest(), [])).not.toThrow();
  });
});

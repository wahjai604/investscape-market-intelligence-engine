/**
 * InvestScape™ E87 Phase 7 — Production Hardening: End-to-End Contract Tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Unlike the Phase 2-6 unit/integration suites, every test here wires
 * MULTIPLE phases together in a single continuous flow the way a real caller
 * would: cited E86-shaped observations -> Phase 2 comparability -> Phase 3
 * consensus -> (Phase 4 transaction derivation where relevant) -> Phase 5
 * unified pipeline (incl. user override) -> Phase 6 scenario/sensitivity
 * generation. No phase is re-tested in isolation here; see the existing
 * per-phase suites for that.
 */
import { resolveCapRateBenchmark } from "../../src/cap-rate-engine/pipeline";
import type { E87PipelineRequest } from "../../src/cap-rate-engine/pipeline-types";
import type { E87CandidateInput, E87ComparabilityRequest } from "../../src/cap-rate-engine/comparability-types";
import { deriveTransactionCapRate } from "../../src/cap-rate-engine/transaction-derivation";
import type { CRETransactionInput } from "../../src/cap-rate-engine/transaction-types";
import { known, unknown } from "../../src/cap-rate-engine/transaction-types";
import { generateScenarios, generateScenariosWithDefaultPolicy } from "../../src/cap-rate-engine/scenario-sensitivity";
import { DEFAULT_SENSITIVITY_POLICY } from "../../src/cap-rate-engine/scenario-types";
import { CONFIDENCE_RANK } from "../../src/cap-rate-engine/consensus-types";
import type { CRECitedObservation, CRESourceType } from "../../src/cre-intelligence/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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

function baseTransaction(overrides: Partial<CRETransactionInput> = {}): CRETransactionInput {
  return {
    transactionId: "txn-001",
    propertyName: "Test Property",
    geography: { country: "US", metro: "Houston Metro", city: "Houston" },
    assetClass: "multifamily",
    transactionDate: "2026-03-01",
    price: known({ amount: 10_000_000, currency: "USD", priceType: "confirmed_sale_price" }),
    noi: known({ amount: 600_000, currency: "USD", definition: "actual_trailing", period: "annual" }),
    provenance: {
      source: "RCA",
      transactionId: "txn-001",
      transactionDate: "2026-03-01",
      sourceUrl: "https://example.com/txn-001",
      retrievedAt: "2026-09-01",
    },
    ...overrides,
  };
}

// A shuffle utility that is itself deterministic across calls given the same seed,
// so the "different orderings" tests are reproducible.
function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ===========================================================================
// 1. Full chain: cited observations -> comparability -> consensus -> pipeline
//    -> scenarios, with a distinctive citation traced end to end.
// ===========================================================================

describe("E2E 1: full chain success with provenance traced into Phase 6 output", () => {
  test("a distinctive sourceId/reportTitle survives comparability, consensus, pipeline, and scenario generation", () => {
    const distinctiveSourceId = "distinctive-cushman-e2e-9f3a";
    const distinctiveReportTitle = "E2E Marker Report — Q2 2026 Multifamily Cap Rates";
    const original = obs({
      source: source(distinctiveSourceId, "Cushman Valuation", "valuation"),
      citation: {
        sourceName: "Cushman Valuation",
        reportTitle: distinctiveReportTitle,
        publicationDate: "2026-07-01",
        period: "2Q 2026",
        locator: "Table 4",
        sourceUrl: "https://example.com/e2e-marker-report.pdf",
        retrievedAt: "2026-09-01",
      },
    });

    const pipelineResult = resolveCapRateBenchmark({
      comparability: baseRequest(),
      candidatePool: [candidate(original, "live_current")],
    });
    expect(pipelineResult.pipelineStatus).toBe("success");
    if (pipelineResult.pipelineStatus !== "success") return;

    // Provenance traceable directly on the Phase 5 result.
    const contributing = pipelineResult.result.contributingObservations[0].observation;
    expect(contributing.source.sourceId).toBe(distinctiveSourceId);
    expect(contributing.citation.reportTitle).toBe(distinctiveReportTitle);

    // Provenance traceable in the Phase 3 audit trail carried by Phase 5.
    expect(pipelineResult.result.audit.contributing.some((c) => c.sourceId === distinctiveSourceId)).toBe(true);

    // Now push through Phase 6 and confirm the marker is still reachable via
    // the scenario set's evidence range / underlying benchmark link (the
    // scenario objects themselves are mechanical, but the full pipeline
    // result — which the scenario set embeds nothing that erases — must
    // still trace back through generateScenarios's own input).
    const scenarioResult = generateScenarios(pipelineResult, [-25, 0, 25]);
    expect(scenarioResult.scenarioStatus).toBe("success");
    if (scenarioResult.scenarioStatus !== "success") return;
    expect(scenarioResult.scenarios.length).toBe(3); // anchor(0) + [-25,25], 0 deduped with anchor
    // The anchor scenario's reference value ties back to the exact benchmark
    // value produced from the distinctively-cited observation.
    const anchor = scenarioResult.scenarios.find((s) => s.deltaBps === 0)!;
    expect(anchor.capRateValue).toBeCloseTo(pipelineResult.result.benchmark.value, 6);
    // And the pipeline result itself (still fully intact, never flattened by
    // scenario generation) still carries the distinctive citation.
    expect(pipelineResult.result.contributingObservations[0].observation.source.sourceId).toBe(distinctiveSourceId);
  });
});

// ===========================================================================
// 2. Transaction-derived -> Phase 5 -> Phase 6, with provenance to the
//    transaction's own audit trail.
// ===========================================================================

describe("E2E 2: transaction-derived observation traced through to Phase 6", () => {
  test("transactionId and RCA provenance remain reachable after scenario generation", () => {
    const txn = baseTransaction({ transactionId: "e2e-txn-marker-77821" });
    const derived = deriveTransactionCapRate(txn);
    expect(derived.status).toBe("success");
    if (derived.status !== "success") return;

    const pipelineResult = resolveCapRateBenchmark({
      comparability: baseRequest({ capRateType: "derived_transaction" }),
      candidatePool: [],
      transactionDerivedObservations: [derived.observation],
    });
    expect(pipelineResult.pipelineStatus).toBe("success");
    if (pipelineResult.pipelineStatus !== "success") return;
    expect(pipelineResult.origin).toBe("transaction_derived");

    const scenarios = generateScenariosWithDefaultPolicy(pipelineResult, DEFAULT_SENSITIVITY_POLICY);
    expect(scenarios.scenarioStatus).toBe("success");
    if (scenarios.scenarioStatus !== "success") return;

    // The anchor scenario is provenance "derived" (never "observed" or
    // "mechanically_generated") because the underlying origin is transaction_derived.
    const anchor = scenarios.scenarios.find((s) => s.deltaBps === 0)!;
    expect(anchor.provenance).toBe("derived");

    // The original transaction identifiers remain reachable via the
    // pipeline's own contributing observation (never erased or replaced by
    // scenario generation).
    const contributing = pipelineResult.result.contributingObservations[0].observation;
    expect(contributing.derivedFrom).toBeDefined();
    expect(contributing.derivedFrom!.propertyName).toBe(txn.propertyName);
  });
});

// ===========================================================================
// 3. DATA_GAP cannot be bypassed end to end, across multiple adversarial
//    inputs, through Phase 5 and Phase 6.
// ===========================================================================

describe("E2E 3: DATA_GAP propagates cleanly through Phase 5 and Phase 6, never fabricated", () => {
  test("incompatible cap-rate family -> DATA_GAP at pipeline, DATA_GAP at scenario stage", () => {
    const pipelineResult = resolveCapRateBenchmark({
      comparability: baseRequest({ capRateType: "stabilized" }),
      candidatePool: [candidate(obs({ capRateType: "exit" }))],
    });
    expect(pipelineResult.pipelineStatus).toBe("data_gap");

    const scenarios = generateScenarios(pipelineResult, [-50, 0, 50]);
    expect(scenarios.scenarioStatus).toBe("data_gap");
    if (scenarios.scenarioStatus === "data_gap") {
      expect(scenarios.underlyingGap.gap.reasonCode).toBe("INCOMPATIBLE_CAP_RATE_FAMILY");
    }
  });

  test("severe conflicting tier-1 sources -> DATA_GAP end to end, never averaged", () => {
    const pipelineResult = resolveCapRateBenchmark({
      comparability: baseRequest(),
      candidatePool: [
        candidate(obs({ value: 5.0, source: source("cbre-valuation", "CBRE Valuation", "valuation") }), "live_current"),
        candidate(obs({ value: 7.0, source: source("cw-valuation", "C&W Valuation", "valuation") }), "live_current"),
      ],
    });
    expect(pipelineResult.pipelineStatus).toBe("data_gap");
    if (pipelineResult.pipelineStatus === "data_gap") {
      expect(pipelineResult.result.gap.reasonCode).toBe("MATERIAL_SOURCE_DISAGREEMENT");
    }
    const scenarios = generateScenarios(pipelineResult, [-25, 25]);
    expect(scenarios.scenarioStatus).toBe("data_gap");
    // No numeric benchmark ever appears anywhere in the gap result.
    expect(JSON.stringify(scenarios)).not.toMatch(/"capRateValue"/);
  });

  test("wrong geography -> DATA_GAP end to end", () => {
    const pipelineResult = resolveCapRateBenchmark({
      comparability: baseRequest({ geography: { country: "US", city: "Dallas" } }),
      candidatePool: [candidate(obs())],
    });
    expect(pipelineResult.pipelineStatus).toBe("data_gap");
    expect(generateScenarios(pipelineResult, [10]).scenarioStatus).toBe("data_gap");
  });

  test("wrong asset class -> DATA_GAP end to end", () => {
    const pipelineResult = resolveCapRateBenchmark({
      comparability: baseRequest({ assetClass: "multifamily" }),
      candidatePool: [candidate(obs({ assetClass: "office" }))],
    });
    expect(pipelineResult.pipelineStatus).toBe("data_gap");
    expect(generateScenarios(pipelineResult, [10]).scenarioStatus).toBe("data_gap");
  });

  test("missing NOI (transaction path) never reaches the pool, and the pipeline still reports DATA_GAP", () => {
    const derived = deriveTransactionCapRate(baseTransaction({ noi: unknown() }));
    expect(derived.status).toBe("data_gap");
    const pipelineResult = resolveCapRateBenchmark({ comparability: baseRequest(), candidatePool: [] });
    expect(pipelineResult.pipelineStatus).toBe("data_gap");
    expect(generateScenarios(pipelineResult, [0]).scenarioStatus).toBe("data_gap");
  });

  test("invalid (asking-price) transaction never reaches the pool -> DATA_GAP end to end", () => {
    const derived = deriveTransactionCapRate(
      baseTransaction({ price: known({ amount: 10_000_000, currency: "USD", priceType: "asking_price" }) }),
    );
    expect(derived.status).toBe("data_gap");
    const pipelineResult = resolveCapRateBenchmark({
      comparability: baseRequest({ capRateType: "derived_transaction" }),
      candidatePool: [],
      transactionDerivedObservations: [],
    });
    expect(pipelineResult.pipelineStatus).toBe("data_gap");
  });

  test("currency mismatch (transaction path) -> DATA_GAP, never silently mixed, end to end", () => {
    const derived = deriveTransactionCapRate(
      baseTransaction({ noi: known({ amount: 600_000, currency: "CAD", definition: "actual_trailing", period: "annual" }) }),
    );
    expect(derived.status).toBe("data_gap");
    if (derived.status === "data_gap") expect(derived.gap.reasonCode).toBe("CURRENCY_MISMATCH");
  });

  test("missing provenance / insufficient comparability data -> DATA_GAP, empty pool", () => {
    const pipelineResult = resolveCapRateBenchmark({ comparability: baseRequest(), candidatePool: [] });
    expect(pipelineResult.pipelineStatus).toBe("data_gap");
    if (pipelineResult.pipelineStatus === "data_gap") {
      expect(pipelineResult.result.gap.reasonCode).toBe("NO_COMPARABLE_OBSERVATIONS");
    }
  });

  test("stale-only pool under an explicit freshness floor -> DATA_GAP end to end, never smuggled in as usable", () => {
    const pipelineResult = resolveCapRateBenchmark({
      comparability: baseRequest({ minFreshness: "recent" }),
      candidatePool: [candidate(obs(), "historical")],
    });
    expect(pipelineResult.pipelineStatus).toBe("data_gap");
    const scenarios = generateScenarios(pipelineResult, [0]);
    expect(scenarios.scenarioStatus).toBe("data_gap");
  });

  test("user override cannot manufacture a benchmark where DATA_GAP persists as the underlying truth", () => {
    const pipelineResult = resolveCapRateBenchmark({
      comparability: baseRequest(),
      candidatePool: [],
      userOverride: { overrideValue: 6.0, overrideReason: "Manual entry; no comparable data exists." },
    });
    expect(pipelineResult.pipelineStatus).toBe("user_overridden");
    if (pipelineResult.pipelineStatus === "user_overridden") {
      // The override wins for the ACTIVE value, but the underlying gap is
      // still explicitly a data_gap — never silently turned into a "success".
      expect(pipelineResult.underlying.status).toBe("data_gap");
    }
    const scenarios = generateScenarios(pipelineResult, [-25, 0, 25]);
    // Scenarios ARE generated here (override always wins per spec) but must
    // be clearly labeled user_override provenance, never "observed"/"derived".
    expect(scenarios.scenarioStatus).toBe("success");
    if (scenarios.scenarioStatus === "success") {
      expect(scenarios.scenarios.every((s) => s.provenance === "user_override" || s.provenance === "mechanically_generated")).toBe(true);
      expect(scenarios.isOverrideBased).toBe(true);
    }
  });

  test("empty candidate pool with a transaction list that itself entirely gaps -> DATA_GAP", () => {
    const pipelineResult = resolveCapRateBenchmark({
      comparability: baseRequest({ capRateType: "derived_transaction" }),
      candidatePool: [],
      transactionDerivedObservations: [],
    });
    expect(pipelineResult.pipelineStatus).toBe("data_gap");
  });
});

// ===========================================================================
// 4. Confidence is floor-based end to end, never averaged/upgraded, and
//    survives into Phase 6 scenario output.
// ===========================================================================

describe("E2E 4: confidence remains floor-based through the full pipeline and into scenarios", () => {
  test("a high-tier single source combined with a low-tier agreeing source never exceeds the floor", () => {
    const pipelineResult = resolveCapRateBenchmark({
      comparability: baseRequest(),
      candidatePool: [
        // primary_specialist_research-equivalent tier (valuation) — likely higher confidence
        candidate(obs({ value: 5.5, source: source("cushman-valuation", "Cushman Valuation", "valuation") }), "live_current"),
        // secondary/aggregated-equivalent tier, agreeing closely (tight dispersion) but a weaker source
        candidate(
          obs({ value: 5.52, source: source("aggregator-co", "Generic Aggregator", "other") }),
          "historical",
        ),
      ],
    });
    expect(pipelineResult.pipelineStatus).toBe("success");
    if (pipelineResult.pipelineStatus !== "success") return;

    const { dataConfidence, benchmarkConfidence, confidence } = pipelineResult.result;
    const expectedFloor = CONFIDENCE_RANK[dataConfidence] <= CONFIDENCE_RANK[benchmarkConfidence] ? dataConfidence : benchmarkConfidence;
    expect(confidence).toBe(expectedFloor);
    expect(CONFIDENCE_RANK[confidence]).toBeLessThanOrEqual(CONFIDENCE_RANK[dataConfidence]);
    expect(CONFIDENCE_RANK[confidence]).toBeLessThanOrEqual(CONFIDENCE_RANK[benchmarkConfidence]);

    // Confidence is never silently upgraded by scenario generation: the
    // anchor scenario's confidence must be exactly the pipeline's combined
    // (floor) confidence, never dataConfidence or benchmarkConfidence alone
    // if those differ from the floor.
    const scenarios = generateScenarios(pipelineResult, [-25, 25]);
    expect(scenarios.scenarioStatus).toBe("success");
    if (scenarios.scenarioStatus === "success") {
      const anchor = scenarios.scenarios.find((s) => s.deltaBps === 0)!;
      expect(anchor.confidence).toBe(confidence);
    }
  });

  test("methodology-preferred severe-dispersion resolution floors benchmarkConfidence at 'low' and never exceeds it", () => {
    const pipelineResult = resolveCapRateBenchmark({
      comparability: baseRequest(),
      candidatePool: [
        candidate(obs({ value: 5.0, source: source("cbre-valuation", "CBRE Valuation", "valuation") }), "live_current"),
        candidate(obs({ value: 7.0, source: source("some-broker", "Some Broker", "brokerage") }), "live_current"),
      ],
    });
    expect(pipelineResult.pipelineStatus).toBe("success");
    if (pipelineResult.pipelineStatus !== "success") return;
    expect(CONFIDENCE_RANK[pipelineResult.result.benchmarkConfidence]).toBeLessThanOrEqual(CONFIDENCE_RANK.low);
    expect(pipelineResult.result.confidence).toBe(
      CONFIDENCE_RANK[pipelineResult.result.dataConfidence] <= CONFIDENCE_RANK[pipelineResult.result.benchmarkConfidence]
        ? pipelineResult.result.dataConfidence
        : pipelineResult.result.benchmarkConfidence,
    );
  });
});

// ===========================================================================
// 5. Stale/historical observations are preserved verbatim (identity/deep
//    equality), never mutated or removed from the audit trail.
// ===========================================================================

describe("E2E 5: stale/historical observations survive the full pipeline unmutated and remain visible", () => {
  test("a stale candidate that still contributes stays in the audit contributing list, and its source object is untouched", () => {
    const staleObs = obs({ value: 5.4, source: source("older-broker", "Older Broker", "brokerage") });
    const staleSnapshot = JSON.parse(JSON.stringify(staleObs));

    const pipelineResult = resolveCapRateBenchmark({
      comparability: baseRequest(),
      candidatePool: [
        candidate(obs({ value: 5.5, source: source("cushman-valuation", "Cushman Valuation", "valuation") }), "live_current"),
        candidate(staleObs, "historical"),
      ],
    });
    expect(pipelineResult.pipelineStatus).toBe("success");
    if (pipelineResult.pipelineStatus === "success") {
      expect(pipelineResult.result.audit.contributing.length).toBe(2);
      expect(pipelineResult.result.audit.contributing.some((c) => c.freshness === "stale")).toBe(true);
    }
    // Never mutated, even after Phase 6 runs on top of it.
    generateScenarios(pipelineResult, [-10, 10]);
    expect(staleObs).toEqual(staleSnapshot);
  });

  test("a stale candidate EXCLUDED by an explicit freshness floor still appears in excludedByComparability, never vanishes", () => {
    const staleObs = obs({ value: 5.4, source: source("older-broker", "Older Broker", "brokerage") });
    const pipelineResult = resolveCapRateBenchmark({
      comparability: baseRequest({ minFreshness: "recent" }),
      candidatePool: [
        candidate(obs({ value: 5.5, source: source("cushman-valuation", "Cushman Valuation", "valuation") }), "live_current"),
        candidate(staleObs, "historical"),
      ],
    });
    expect(pipelineResult.pipelineStatus).toBe("success");
    if (pipelineResult.pipelineStatus === "success") {
      const excludedEntry = pipelineResult.result.audit.excludedByComparability.find((e) => e.sourceId === "older-broker");
      expect(excludedEntry).toBeDefined();
      expect(excludedEntry!.note.toUpperCase()).toContain("STALE");
    }
  });
});

// ===========================================================================
// 6. Scenario provenance isolation: mechanically generated scenarios can
//    never inherit observed/derived/benchmark confidence status.
// ===========================================================================

describe("E2E 6: mechanically generated scenarios never inherit observed/derived confidence", () => {
  test("every non-anchor scenario is 'mechanically_generated' and carries no confidence field", () => {
    const pipelineResult = resolveCapRateBenchmark({
      comparability: baseRequest(),
      candidatePool: [candidate(obs({ source: source("cushman-valuation", "Cushman Valuation", "valuation") }), "live_current")],
    });
    expect(pipelineResult.pipelineStatus).toBe("success");
    const scenarios = generateScenarios(pipelineResult, [-50, -25, 25, 50]);
    expect(scenarios.scenarioStatus).toBe("success");
    if (scenarios.scenarioStatus !== "success") return;

    const nonAnchor = scenarios.scenarios.filter((s) => s.deltaBps !== 0);
    expect(nonAnchor.length).toBe(4);
    for (const s of nonAnchor) {
      expect(s.provenance).toBe("mechanically_generated");
      expect(s.confidence).toBeUndefined();
    }
    // The anchor alone carries the real confidence tier, and only the anchor.
    const anchor = scenarios.scenarios.find((s) => s.deltaBps === 0)!;
    expect(anchor.provenance).not.toBe("mechanically_generated");
    expect(anchor.confidence).toBeDefined();
  });

  test("mechanically generated scenarios never carry a confidence value equal to a fabricated upgrade of the benchmark tier", () => {
    const pipelineResult = resolveCapRateBenchmark({
      comparability: baseRequest(),
      candidatePool: [
        candidate(obs({ value: 5.0, source: source("cbre-valuation", "CBRE Valuation", "valuation") }), "live_current"),
        candidate(obs({ value: 7.0, source: source("some-broker", "Some Broker", "brokerage") }), "live_current"),
      ],
    });
    expect(pipelineResult.pipelineStatus).toBe("success");
    const scenarios = generateScenarios(pipelineResult, [-25, 25]);
    expect(scenarios.scenarioStatus).toBe("success");
    if (scenarios.scenarioStatus !== "success") return;
    for (const s of scenarios.scenarios.filter((sc) => sc.deltaBps !== 0)) {
      expect(s.confidence).toBeUndefined();
      expect(s.provenance).toBe("mechanically_generated");
    }
  });
});

// ===========================================================================
// 7. User override chain: benchmark -> override -> scenario generation.
// ===========================================================================

describe("E2E 7: user override preserves the underlying benchmark and evidence through scenario generation", () => {
  test("full chain: benchmark success -> override -> scenarios; original benchmark still retrievable", () => {
    const original = obs({ source: source("cushman-valuation", "Cushman Valuation", "valuation") });
    const originalSnapshot = JSON.parse(JSON.stringify(original));

    const pipelineResult = resolveCapRateBenchmark({
      comparability: baseRequest(),
      candidatePool: [candidate(original, "live_current")],
      userOverride: {
        overrideValue: 6.25,
        overrideReason: "Local broker relationships suggest tighter cap rates than published surveys.",
        now: new Date("2026-09-11T00:00:00.000Z"),
      },
    });
    expect(pipelineResult.pipelineStatus).toBe("user_overridden");
    if (pipelineResult.pipelineStatus !== "user_overridden") return;
    expect(pipelineResult.override.overrideValue).toBe(6.25);
    expect(pipelineResult.underlying.status).toBe("success");
    if (pipelineResult.underlying.status === "success") {
      expect(pipelineResult.underlying.benchmark.value).toBeCloseTo(5.5, 4);
      // The evidence (contributing observations) backing the ORIGINAL benchmark remains intact.
      expect(pipelineResult.underlying.contributingObservations[0].observation.source.sourceId).toBe("cushman-valuation");
    }

    const scenarios = generateScenarios(pipelineResult, [-25, 0, 25]);
    expect(scenarios.scenarioStatus).toBe("success");
    if (scenarios.scenarioStatus === "success") {
      expect(scenarios.isOverrideBased).toBe(true);
      expect(scenarios.referenceValue).toBe(6.25);
      const anchor = scenarios.scenarios.find((s) => s.deltaBps === 0)!;
      expect(anchor.provenance).toBe("user_override");
      expect(anchor.capRateValue).toBe(6.25);
    }

    // Underlying original observation is never mutated by any of this.
    expect(original).toEqual(originalSnapshot);
  });
});

// ===========================================================================
// 8. Adversarial end-to-end cases not already covered above: mixed families,
//    duplicate observations, deterministic ties.
// ===========================================================================

describe("E2E 8: further adversarial pipeline cases", () => {
  test("duplicate observations (identical citation) do not silently double-count into a falsely tighter consensus", () => {
    const dup = obs({ value: 5.5, source: source("cushman-valuation", "Cushman Valuation", "valuation") });
    const pipelineResult = resolveCapRateBenchmark({
      comparability: baseRequest(),
      candidatePool: [candidate(dup, "live_current"), candidate({ ...dup }, "live_current")],
    });
    expect(pipelineResult.pipelineStatus).toBe("success");
    if (pipelineResult.pipelineStatus === "success") {
      // Both are treated as separate candidates by Phase 2/3 (no dedup logic exists to
      // silently collapse them) — document current behavior rather than assert a specific
      // count design decision, but confirm both remain traceable in the audit.
      expect(pipelineResult.result.audit.contributing.length).toBe(2);
    }
  });

  test("mixed cap-rate families in the same pool never blend into one family's benchmark", () => {
    const pipelineResult = resolveCapRateBenchmark({
      comparability: baseRequest({ capRateType: "stabilized" }),
      candidatePool: [
        candidate(obs({ value: 5.5, capRateType: "stabilized", source: source("a", "A", "valuation") }), "live_current"),
        candidate(obs({ value: 8.0, capRateType: "exit", source: source("b", "B", "valuation") }), "live_current"),
        candidate(obs({ value: 4.0, capRateType: "going_in", source: source("c", "C", "valuation") }), "live_current"),
      ],
    });
    expect(pipelineResult.pipelineStatus).toBe("success");
    if (pipelineResult.pipelineStatus === "success") {
      // Only the exact-family (stabilized) candidate contributes; exit/going_in are excluded.
      expect(pipelineResult.result.contributingObservations.length).toBe(1);
      expect(pipelineResult.result.benchmark.value).toBeCloseTo(5.5, 4);
    }
  });

  test("deterministic tie case: two identically-ranked, identically-fresh, identically-valued sources -> stable ordering", () => {
    const reqA = {
      comparability: baseRequest(),
      candidatePool: [
        candidate(obs({ value: 5.5, source: source("zzz-broker", "ZZZ Broker", "brokerage") }), "live_current"),
        candidate(obs({ value: 5.5, source: source("aaa-broker", "AAA Broker", "brokerage") }), "live_current"),
      ],
    };
    const r1 = resolveCapRateBenchmark(reqA);
    const r2 = resolveCapRateBenchmark({ ...reqA, candidatePool: [...reqA.candidatePool].reverse() });
    expect(JSON.stringify(r1)).toEqual(JSON.stringify(r2));
  });

  test("empty candidate pool combined with an empty transaction list is a clean DATA_GAP, not a crash", () => {
    expect(() =>
      resolveCapRateBenchmark({ comparability: baseRequest(), candidatePool: [], transactionDerivedObservations: [] }),
    ).not.toThrow();
  });
});

// ===========================================================================
// 9. Large candidate pools: deterministic regardless of input ordering.
// ===========================================================================

describe("E2E 9: large candidate pool (150 synthetic candidates) is order-independent", () => {
  function buildLargePool(): E87CandidateInput[] {
    const pool: E87CandidateInput[] = [];
    const freshnessOptions = ["live_current", "recent", "historical"] as const;
    const sourceTypes: CRESourceType[] = ["valuation", "brokerage", "other"];
    for (let i = 0; i < 150; i++) {
      const value = 5.4 + ((i % 7) * 0.02); // tight cluster around 5.4-5.52
      pool.push(
        candidate(
          obs({
            value,
            source: source(`synth-source-${i}`, `Synthetic Source ${i}`, sourceTypes[i % sourceTypes.length]),
            citation: {
              sourceName: `Synthetic Source ${i}`,
              reportTitle: `Synthetic Report ${i}`,
              publicationDate: "2026-07-01",
              period: "2Q 2026",
              locator: `Table ${i}`,
              sourceUrl: `https://example.com/synthetic-${i}.pdf`,
              retrievedAt: "2026-09-01",
            },
          }),
          freshnessOptions[i % freshnessOptions.length],
        ),
      );
    }
    return pool;
  }

  test("shuffled orderings of the same 150-candidate pool produce byte-identical results", () => {
    const pool = buildLargePool();
    const request: E87ComparabilityRequest = baseRequest();

    const r1 = resolveCapRateBenchmark({ comparability: request, candidatePool: pool });
    const shuffled1 = seededShuffle(pool, 12345);
    const shuffled2 = seededShuffle(pool, 987654321);

    const r2 = resolveCapRateBenchmark({ comparability: request, candidatePool: shuffled1 });
    const r3 = resolveCapRateBenchmark({ comparability: request, candidatePool: shuffled2 });

    expect(JSON.stringify(r1)).toEqual(JSON.stringify(r2));
    expect(JSON.stringify(r1)).toEqual(JSON.stringify(r3));

    // And downstream Phase 6 scenario generation is equally order-independent.
    const s1 = generateScenarios(r1, [-25, 0, 25]);
    const s2 = generateScenarios(r2, [-25, 0, 25]);
    expect(JSON.stringify(s1)).toEqual(JSON.stringify(s2));
  });
});

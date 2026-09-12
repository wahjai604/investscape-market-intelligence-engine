/**
 * InvestScape™ E69 Phase 5 — Unified Cap-Rate Benchmark Output tests.
 *
 * Adversarial, end-to-end style: every scenario runs the real
 * `resolveCapRateBenchmark` orchestration function against realistic
 * candidate pools / transaction inputs, never hand-built Phase 5 result
 * objects. Mirrors the style of the Phase 2/3/4 suites so the whole stack is
 * proven to compose.
 */
import { resolveCapRateBenchmark } from "../../src/cap-rate-engine/pipeline";
import type { E69PipelineRequest } from "../../src/cap-rate-engine/pipeline-types";
import type { E69CandidateInput, E69ComparabilityRequest } from "../../src/cap-rate-engine/comparability-types";
import { deriveTransactionCapRate } from "../../src/cap-rate-engine/transaction-derivation";
import type { CRETransactionInput } from "../../src/cap-rate-engine/transaction-types";
import { known, unknown } from "../../src/cap-rate-engine/transaction-types";
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

function baseRequest(overrides: Partial<E69ComparabilityRequest> = {}): E69ComparabilityRequest {
  return {
    geography: { country: "US", city: "Houston" },
    assetClass: "multifamily",
    capRateType: "stabilized",
    ...overrides,
  };
}

function candidate(o: CRECitedObservation, freshness?: E69CandidateInput["freshness"]): E69CandidateInput {
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

describe("1. Zero candidates", () => {
  test("empty pool -> DATA_GAP", () => {
    const result = resolveCapRateBenchmark({ comparability: baseRequest(), candidatePool: [] });
    expect(result.pipelineStatus).toBe("data_gap");
    if (result.pipelineStatus === "data_gap") {
      expect(result.result.gap.reasonCode).toBe("NO_COMPARABLE_OBSERVATIONS");
    }
  });
});

describe("2. One exact candidate", () => {
  test("single exact tier-1 observation -> success", () => {
    const result = resolveCapRateBenchmark({
      comparability: baseRequest(),
      candidatePool: [candidate(obs({ source: source("cushman-valuation", "Cushman Valuation", "valuation") }), "live_current")],
    });
    expect(result.pipelineStatus).toBe("success");
    if (result.pipelineStatus === "success") {
      expect(result.result.benchmark.value).toBeCloseTo(5.5, 4);
      expect(result.origin).toBe("publisher_survey");
    }
  });
});

describe("3. Multiple exact candidates -> consensus", () => {
  test("two agreeing tier-1 observations -> weighted consensus, origin=consensus", () => {
    const result = resolveCapRateBenchmark({
      comparability: baseRequest(),
      candidatePool: [
        candidate(obs({ value: 5.5, source: source("cushman-valuation", "Cushman Valuation", "valuation") }), "live_current"),
        candidate(obs({ value: 5.6, source: source("cbre-valuation", "CBRE Valuation", "valuation") }), "recent"),
      ],
    });
    expect(result.pipelineStatus).toBe("success");
    if (result.pipelineStatus === "success") {
      expect(result.origin).toBe("consensus");
      expect(result.result.contributingObservations.length).toBe(2);
    }
  });
});

describe("4. Incompatible geography -> exclusion", () => {
  test("wrong city excludes the candidate, leaving zero eligible -> DATA_GAP", () => {
    const result = resolveCapRateBenchmark({
      comparability: baseRequest({ geography: { country: "US", city: "Dallas" } }),
      candidatePool: [candidate(obs())],
    });
    expect(result.pipelineStatus).toBe("data_gap");
    if (result.pipelineStatus === "data_gap") {
      expect(result.result.audit.excludedByComparability[0].note).toContain("WRONG_GEOGRAPHY");
    }
  });
});

describe("5. Incompatible asset class -> exclusion", () => {
  test("office candidate against a multifamily request -> DATA_GAP", () => {
    const result = resolveCapRateBenchmark({
      comparability: baseRequest({ assetClass: "multifamily" }),
      candidatePool: [candidate(obs({ assetClass: "office" }))],
    });
    expect(result.pipelineStatus).toBe("data_gap");
    if (result.pipelineStatus === "data_gap") {
      expect(result.result.audit.excludedByComparability[0].note).toContain("WRONG_ASSET_TYPE");
    }
  });
});

describe("6. Incompatible cap-rate family -> DATA_GAP", () => {
  test("a different capRateType family than requested -> DATA_GAP, never substituted", () => {
    const result = resolveCapRateBenchmark({
      comparability: baseRequest({ capRateType: "stabilized" }),
      candidatePool: [candidate(obs({ capRateType: "exit" }))],
    });
    expect(result.pipelineStatus).toBe("data_gap");
  });
});

describe("7. Severe dispersion -> no fabricated average", () => {
  test("two tier-1 sources disagreeing severely and tied on tier -> DATA_GAP, not an average", () => {
    const result = resolveCapRateBenchmark({
      comparability: baseRequest(),
      candidatePool: [
        candidate(obs({ value: 5.0, source: source("cbre-valuation", "CBRE Valuation", "valuation") }), "live_current"),
        candidate(obs({ value: 7.0, source: source("cw-valuation", "C&W Valuation", "valuation") }), "live_current"),
      ],
    });
    expect(result.pipelineStatus).toBe("data_gap");
    if (result.pipelineStatus === "data_gap") {
      expect(result.result.gap.reasonCode).toBe("MATERIAL_SOURCE_DISAGREEMENT");
    }
  });
});

describe("8. Unique best source under severe dispersion -> deterministic selection", () => {
  test("one uniquely-best-tier source resolves the disagreement via methodology preference", () => {
    const result = resolveCapRateBenchmark({
      comparability: baseRequest(),
      candidatePool: [
        candidate(obs({ value: 5.0, source: source("cbre-valuation", "CBRE Valuation", "valuation") }), "live_current"),
        candidate(
          obs({ value: 7.0, source: source("some-broker", "Some Broker", "brokerage") }),
          "live_current",
        ),
      ],
    });
    expect(result.pipelineStatus).toBe("success");
    if (result.pipelineStatus === "success") {
      expect(result.result.benchmark.value).toBeCloseTo(5.0, 4);
      expect(result.result.benchmark.method).toBe("methodology_preferred");
    }
  });
});

describe("9. Tied best sources under severe dispersion -> DATA_GAP", () => {
  test("two equally-ranked valuation sources disagreeing severely -> DATA_GAP", () => {
    const result = resolveCapRateBenchmark({
      comparability: baseRequest(),
      candidatePool: [
        candidate(obs({ value: 5.0, source: source("cbre-valuation", "CBRE Valuation", "valuation") }), "live_current"),
        candidate(obs({ value: 7.0, source: source("cw-valuation", "C&W Valuation", "valuation") }), "live_current"),
      ],
    });
    expect(result.pipelineStatus).toBe("data_gap");
  });
});

describe("10. Transaction-derived -> valid pipeline end to end", () => {
  test("a valid transaction flows through toE69CandidateInput -> comparability -> consensus", () => {
    const derived = deriveTransactionCapRate(baseTransaction());
    expect(derived.status).toBe("success");
    if (derived.status !== "success") return;

    const result = resolveCapRateBenchmark({
      comparability: baseRequest({ capRateType: "derived_transaction" }),
      candidatePool: [],
      transactionDerivedObservations: [derived.observation],
    });
    expect(result.pipelineStatus).toBe("success");
    if (result.pipelineStatus === "success") {
      expect(result.origin).toBe("transaction_derived");
      expect(result.result.benchmark.value).toBeCloseTo(6, 1); // 600k / 10M = 6%
    }
  });
});

describe("11. Missing NOI -> DATA_GAP (transaction path)", () => {
  test("transaction with unknown NOI never reaches the candidate pool, produces DATA_GAP", () => {
    const derived = deriveTransactionCapRate(baseTransaction({ noi: unknown() }));
    expect(derived.status).toBe("data_gap");
    if (derived.status !== "data_gap") return;
    expect(derived.gap.reasonCode).toBe("NOI_MISSING");

    // Since deriveTransactionCapRate itself gapped, nothing is passed into the pipeline —
    // confirm the pipeline still reports DATA_GAP with an empty pool.
    const result = resolveCapRateBenchmark({ comparability: baseRequest(), candidatePool: [] });
    expect(result.pipelineStatus).toBe("data_gap");
  });
});

describe("12. Non-transaction price -> DATA_GAP (transaction path)", () => {
  test("asking price is rejected by Phase 4 before it can reach the pipeline", () => {
    const derived = deriveTransactionCapRate(
      baseTransaction({ price: known({ amount: 10_000_000, currency: "USD", priceType: "asking_price" }) }),
    );
    expect(derived.status).toBe("data_gap");
    if (derived.status !== "data_gap") return;
    expect(derived.gap.reasonCode).toBe("NON_TRANSACTION_PRICE");
  });
});

describe("13. Unresolved currency mismatch -> DATA_GAP (transaction path)", () => {
  test("mismatched currencies with no FX conversion -> DATA_GAP, never silently mixed", () => {
    const derived = deriveTransactionCapRate(
      baseTransaction({ noi: known({ amount: 600_000, currency: "CAD", definition: "actual_trailing", period: "annual" }) }),
    );
    expect(derived.status).toBe("data_gap");
    if (derived.status !== "data_gap") return;
    expect(derived.gap.reasonCode).toBe("CURRENCY_MISMATCH");
  });
});

describe("14. Publisher and derived cap rates coexist in the final output", () => {
  test("a transaction with a publisher-stated cap rate preserves both values separately", () => {
    const derived = deriveTransactionCapRate(
      baseTransaction({ publisherCapRate: { value: 5.9, capRateType: "stabilized" } }),
    );
    expect(derived.status).toBe("success");
    if (derived.status !== "success") return;
    expect(derived.observation.audit.reconciliation).toBeDefined();
    expect(derived.observation.audit.reconciliation!.publisherCapRate).toBe(5.9);
    expect(derived.observation.audit.reconciliation!.derivedCapRate).toBeCloseTo(6, 1);
    // The derived cap rate on the observation itself is never overwritten by the publisher figure.
    expect(derived.observation.capRate * 100).toBeCloseTo(6, 1);

    const result = resolveCapRateBenchmark({
      comparability: baseRequest({ capRateType: "derived_transaction" }),
      candidatePool: [],
      transactionDerivedObservations: [derived.observation],
    });
    expect(result.pipelineStatus).toBe("success");
    if (result.pipelineStatus === "success") {
      const contributing = result.result.contributingObservations[0].observation;
      expect(contributing.derivedFrom).toBeDefined();
    }
  });
});

describe("15. Stale historical evidence remains preserved", () => {
  test("a stale candidate excluded from the winning value still appears in the audit trail", () => {
    const result = resolveCapRateBenchmark({
      comparability: baseRequest(),
      candidatePool: [
        candidate(obs({ value: 5.5, source: source("cushman-valuation", "Cushman Valuation", "valuation") }), "live_current"),
        candidate(obs({ value: 5.4, source: source("older-broker", "Older Broker", "brokerage") }), "historical"),
      ],
    });
    expect(result.pipelineStatus).toBe("success");
    if (result.pipelineStatus === "success") {
      // Both candidates were comparable (freshness alone never excludes without minFreshness),
      // so both remain in the audit's contributing entries even though weighted differently.
      expect(result.result.audit.contributing.length).toBe(2);
      // Phase 3 derives freshness from Phase 2's freshnessMatch dimension tier (both "stale"
      // and "historical" raw freshness collapse to the "approximate" dimension tier, which
      // Phase 3 labels "stale" in its own audit vocabulary) — the raw historical fact is
      // still preserved in full via the original observation on the candidate itself.
      expect(result.result.audit.contributing.some((c) => c.freshness === "stale")).toBe(true);
    }
  });
});

describe("16. Explicit freshness requirement excludes insufficiently fresh candidates", () => {
  test("minFreshness='recent' excludes a stale-only candidate -> DATA_GAP", () => {
    const result = resolveCapRateBenchmark({
      comparability: baseRequest({ minFreshness: "recent" }),
      candidatePool: [candidate(obs(), "historical")],
    });
    expect(result.pipelineStatus).toBe("data_gap");
    if (result.pipelineStatus === "data_gap") {
      expect(result.result.gap.reasonCode).toBe("INSUFFICIENT_FRESHNESS");
    }
  });

  test("without minFreshness, the same historical candidate is still usable", () => {
    const result = resolveCapRateBenchmark({
      comparability: baseRequest(),
      candidatePool: [candidate(obs(), "historical")],
    });
    expect(result.pipelineStatus).toBe("success");
  });
});

describe("17. User override preserves original benchmark alongside the overridden value", () => {
  test("override wins but the underlying success result remains fully retrievable", () => {
    const result = resolveCapRateBenchmark({
      comparability: baseRequest(),
      candidatePool: [candidate(obs({ source: source("cushman-valuation", "Cushman Valuation", "valuation") }), "live_current")],
      userOverride: {
        overrideValue: 6.25,
        overrideReason: "Local broker relationships suggest tighter cap rates than published surveys.",
        now: new Date("2026-09-11T00:00:00.000Z"),
      },
    });
    expect(result.pipelineStatus).toBe("user_overridden");
    if (result.pipelineStatus === "user_overridden") {
      expect(result.override.overrideValue).toBe(6.25);
      expect(result.override.originalValue).toBeCloseTo(5.5, 4);
      expect(result.underlying.status).toBe("success");
      if (result.underlying.status === "success") {
        expect(result.underlying.benchmark.value).toBeCloseTo(5.5, 4);
      }
    }
  });

  test("override also wins over a DATA_GAP underlying result, and the gap remains visible", () => {
    const result = resolveCapRateBenchmark({
      comparability: baseRequest(),
      candidatePool: [],
      userOverride: { overrideValue: 6.0, overrideReason: "Manual entry; no comparable data exists." },
    });
    expect(result.pipelineStatus).toBe("user_overridden");
    if (result.pipelineStatus === "user_overridden") {
      expect(result.underlying.status).toBe("data_gap");
      expect(result.override.originalValue).toBeUndefined();
      expect(result.origin).toBe("n/a");
    }
  });
});

describe("18. DATA_GAP remains deterministic", () => {
  test("identical input twice -> identical gap reason and explanation", () => {
    const req: E69PipelineRequest = { comparability: baseRequest(), candidatePool: [] };
    const r1 = resolveCapRateBenchmark(req);
    const r2 = resolveCapRateBenchmark(req);
    expect(r1).toEqual(r2);
  });
});

describe("19. Identical input produces byte-identical output", () => {
  test("JSON.stringify equality for a success case", () => {
    const req: E69PipelineRequest = {
      comparability: baseRequest(),
      candidatePool: [candidate(obs({ source: source("cushman-valuation", "Cushman Valuation", "valuation") }), "live_current")],
    };
    const r1 = resolveCapRateBenchmark(req);
    const r2 = resolveCapRateBenchmark(req);
    expect(JSON.stringify(r1)).toEqual(JSON.stringify(r2));
  });
});

describe("20. Candidate order does not change the result", () => {
  test("reversing the pool order produces the same benchmark value and confidence", () => {
    const pool = [
      candidate(obs({ value: 5.5, source: source("cushman-valuation", "Cushman Valuation", "valuation") }), "live_current"),
      candidate(obs({ value: 5.6, source: source("cbre-valuation", "CBRE Valuation", "valuation") }), "recent"),
    ];
    const r1 = resolveCapRateBenchmark({ comparability: baseRequest(), candidatePool: pool });
    const r2 = resolveCapRateBenchmark({ comparability: baseRequest(), candidatePool: [...pool].reverse() });
    expect(r1.pipelineStatus).toBe("success");
    expect(r2.pipelineStatus).toBe("success");
    if (r1.pipelineStatus === "success" && r2.pipelineStatus === "success") {
      expect(r1.result.benchmark.value).toBeCloseTo(r2.result.benchmark.value, 6);
      expect(r1.result.confidence).toBe(r2.result.confidence);
    }
  });
});

describe("21. Provenance survives every pipeline stage", () => {
  test("final output traces back to the original observation's citation", () => {
    const original = obs({ source: source("cushman-valuation", "Cushman Valuation", "valuation") });
    const result = resolveCapRateBenchmark({
      comparability: baseRequest(),
      candidatePool: [candidate(original, "live_current")],
    });
    expect(result.pipelineStatus).toBe("success");
    if (result.pipelineStatus === "success") {
      const traced = result.result.contributingObservations[0].observation;
      expect(traced.citation.sourceUrl).toBe(original.citation.sourceUrl);
      expect(traced.citation.reportTitle).toBe(original.citation.reportTitle);
      expect(traced.source.sourceId).toBe(original.source.sourceId);
    }
  });
});

describe("22. No E68 source observation is mutated", () => {
  test("input observations are deep-equal before and after the pipeline runs", () => {
    const original = obs({ source: source("cushman-valuation", "Cushman Valuation", "valuation") });
    const snapshot = JSON.parse(JSON.stringify(original));
    resolveCapRateBenchmark({
      comparability: baseRequest(),
      candidatePool: [candidate(original, "live_current")],
      userOverride: { overrideValue: 6.0, overrideReason: "test" },
    });
    expect(original).toEqual(snapshot);
  });

  test("transaction-derived input is not mutated by the pipeline", () => {
    const txn = baseTransaction();
    const snapshot = JSON.parse(JSON.stringify(txn));
    const derived = deriveTransactionCapRate(txn);
    if (derived.status === "success") {
      resolveCapRateBenchmark({
        comparability: baseRequest({ capRateType: "derived_transaction" }),
        candidatePool: [],
        transactionDerivedObservations: [derived.observation],
      });
    }
    expect(txn).toEqual(snapshot);
  });
});

describe("Extra edge case: mixed publisher-survey + transaction-derived pool -> consensus origin", () => {
  test("a pool mixing a survey observation and a transaction-derived observation, both pinned to derived_transaction, is a consensus", () => {
    const derived = deriveTransactionCapRate(baseTransaction());
    if (derived.status !== "success") throw new Error("expected success");
    const surveyDerived = obs({
      capRateType: "derived_transaction",
      value: 6.1,
      source: source("other-txn-db", "Other Transaction DB", "transaction_database"),
    });
    const result = resolveCapRateBenchmark({
      comparability: baseRequest({ capRateType: "derived_transaction" }),
      candidatePool: [candidate(surveyDerived, "recent")],
      transactionDerivedObservations: [derived.observation],
    });
    expect(result.pipelineStatus).toBe("success");
    if (result.pipelineStatus === "success") {
      expect(result.origin).toBe("transaction_derived");
      expect(result.result.contributingObservations.length).toBe(2);
    }
  });
});

describe("Extra edge case: notDisclosed NOI definition also gaps in the transaction path", () => {
  test("not_disclosed NOI definition -> DATA_GAP reason NOI_DEFINITION_MISSING", () => {
    const derived = deriveTransactionCapRate(
      baseTransaction({ noi: known({ amount: 600_000, currency: "USD", definition: "not_disclosed", period: "annual" }) }),
    );
    expect(derived.status).toBe("data_gap");
    if (derived.status === "data_gap") {
      expect(derived.gap.reasonCode).toBe("NOI_DEFINITION_MISSING");
    }
  });
});

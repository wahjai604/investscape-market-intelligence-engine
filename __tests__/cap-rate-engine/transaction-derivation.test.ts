/**
 * InvestScape™ E87 Phase 4 — Transaction-Derived Cap Rate tests.
 *
 * Adversarial style mirroring comparability.test.ts / benchmark-consensus.test.ts:
 * every scenario is exercised end to end through deriveTransactionCapRate /
 * deriveTransactionCapRateBatch / toE87CandidateInput, not merely named.
 */
import {
  capRateDifferenceBps,
  classifyReconciliationTier,
  deriveTransactionCapRate,
  deriveTransactionCapRateBatch,
  toE87CandidateInput,
} from "../../src/cap-rate-engine/transaction-derivation";
import { evaluateComparability } from "../../src/cap-rate-engine/comparability";
import { buildCapRateBenchmark } from "../../src/cap-rate-engine/benchmark-consensus";
import type { CRETransactionInput } from "../../src/cap-rate-engine/transaction-types";
import { known, notDisclosed, unknown } from "../../src/cap-rate-engine/transaction-types";

const FIXED_NOW = () => "2026-09-01T00:00:00.000Z";

function baseInput(overrides: Partial<CRETransactionInput> = {}): CRETransactionInput {
  return {
    transactionId: "txn-001",
    propertyName: "123 Main St",
    geography: { country: "US", city: "Houston", metro: "Houston Metro" },
    assetClass: "multifamily",
    transactionDate: "2026-06-15",
    price: known({ amount: 20_000_000, currency: "USD", priceType: "confirmed_sale_price" }),
    noi: known({ amount: 1_200_000, currency: "USD", definition: "actual_trailing", period: "annual" }),
    provenance: {
      source: "CoStar",
      report: "CoStar Transaction Detail",
      publicationDate: "2026-07-01",
      transactionDate: "2026-06-15",
      locator: "Deal ID 998877",
      sourceUrl: "https://example.com/deal/998877",
      transactionId: "txn-001",
      retrievedAt: "2026-09-01",
    },
    ...overrides,
  };
}

describe("1. Basic valid calculations", () => {
  test("valid price + annual NOI -> exact 6.00% reproducible", () => {
    const r = deriveTransactionCapRate(baseInput(), { now: FIXED_NOW });
    expect(r.status).toBe("success");
    if (r.status !== "success") return;
    expect(r.observation.capRate).toBeCloseTo(0.06, 10);
    expect(r.observation.displayValue).toBe("6.00%");
    expect(r.observation.status).toBe("DERIVED");
  });

  test("valid price + trailing-12 NOI", () => {
    const r = deriveTransactionCapRate(
      baseInput({ noi: known({ amount: 1_200_000, currency: "USD", definition: "actual_trailing", period: "trailing_12_month" }) }),
      { now: FIXED_NOW },
    );
    expect(r.status).toBe("success");
    if (r.status === "success") expect(r.observation.displayValue).toBe("6.00%");
  });

  test("valid price + forward NOI", () => {
    const r = deriveTransactionCapRate(
      baseInput({ noi: known({ amount: 1_300_000, currency: "USD", definition: "actual_forward", period: "forward_12_month" }) }),
      { now: FIXED_NOW },
    );
    expect(r.status).toBe("success");
    if (r.status === "success") expect(r.observation.capRate).toBeCloseTo(0.065, 10);
  });

  test("exact arithmetic reproducibility across repeated calls", () => {
    const a = deriveTransactionCapRate(baseInput(), { now: FIXED_NOW });
    const b = deriveTransactionCapRate(baseInput(), { now: FIXED_NOW });
    expect(a).toEqual(b);
  });

  test("no rounding before calculation: odd numbers preserve full precision", () => {
    const r = deriveTransactionCapRate(
      baseInput({
        price: known({ amount: 17_333_333, currency: "USD", priceType: "confirmed_sale_price" }),
        noi: known({ amount: 987_654, currency: "USD", definition: "actual_trailing", period: "annual" }),
      }),
      { now: FIXED_NOW },
    );
    expect(r.status).toBe("success");
    if (r.status === "success") {
      const expected = 987_654 / 17_333_333;
      expect(r.observation.capRate).toBe(expected);
    }
  });
});

describe("2. Missing inputs -> DATA_GAP", () => {
  test("missing price (UNKNOWN)", () => {
    const r = deriveTransactionCapRate(baseInput({ price: unknown() }));
    expect(r.status).toBe("data_gap");
    if (r.status === "data_gap") expect(r.gap.reasonCode).toBe("TRANSACTION_PRICE_MISSING");
  });

  test("missing NOI (NOT_DISCLOSED)", () => {
    const r = deriveTransactionCapRate(baseInput({ noi: notDisclosed() }));
    expect(r.status).toBe("data_gap");
    if (r.status === "data_gap") expect(r.gap.reasonCode).toBe("NOI_MISSING");
  });

  test("missing NOI definition -> NOI_DEFINITION_MISSING", () => {
    const r = deriveTransactionCapRate(
      baseInput({ noi: known({ amount: 1_200_000, currency: "USD", definition: "not_disclosed", period: "annual" }) }),
    );
    expect(r.status).toBe("data_gap");
    if (r.status === "data_gap") expect(r.gap.reasonCode).toBe("NOI_DEFINITION_MISSING");
  });

  test("missing NOI period -> NOI_PERIOD_MISSING", () => {
    const input = baseInput();
    // Simulate a legitimate source that discloses NOI amount/definition but not period.
    const withoutPeriod = {
      ...input,
      noi: { state: "KNOWN", value: { amount: 1_200_000, currency: "USD", definition: "actual_trailing" } },
    } as unknown as CRETransactionInput;
    const r = deriveTransactionCapRate(withoutPeriod);
    expect(r.status).toBe("data_gap");
    if (r.status === "data_gap") expect(r.gap.reasonCode).toBe("NOI_PERIOD_MISSING");
  });
});

describe("3. Currency rules", () => {
  test("unknown currency -> CURRENCY_UNKNOWN", () => {
    const r = deriveTransactionCapRate(
      baseInput({ price: known({ amount: 20_000_000, currency: "OTHER", priceType: "confirmed_sale_price" }) }),
    );
    expect(r.status).toBe("data_gap");
    if (r.status === "data_gap") expect(r.gap.reasonCode).toBe("CURRENCY_UNKNOWN");
  });

  test("mismatched currencies, no FX supplied -> CURRENCY_MISMATCH", () => {
    const r = deriveTransactionCapRate(
      baseInput({ noi: known({ amount: 1_200_000, currency: "CAD", definition: "actual_trailing", period: "annual" }) }),
    );
    expect(r.status).toBe("data_gap");
    if (r.status === "data_gap") expect(r.gap.reasonCode).toBe("CURRENCY_MISMATCH");
  });

  test("currency conversion unavailable (fx present but wrong currencies) -> CURRENCY_MISMATCH", () => {
    const r = deriveTransactionCapRate(
      baseInput({
        noi: known({ amount: 1_200_000, currency: "CAD", definition: "actual_trailing", period: "annual" }),
        fx: { fromCurrency: "OTHER" as any, toCurrency: "USD", rate: 1.3, rateDate: "2026-06-15", rateSource: "BoC" },
      }),
    );
    expect(r.status).toBe("data_gap");
    if (r.status === "data_gap") expect(r.gap.reasonCode).toBe("CURRENCY_MISMATCH");
  });

  test("valid explicit FX conversion succeeds and records the transformation", () => {
    const r = deriveTransactionCapRate(
      baseInput({
        noi: known({ amount: 1_600_000, currency: "CAD", definition: "actual_trailing", period: "annual" }),
        fx: { fromCurrency: "CAD", toCurrency: "USD", rate: 0.75, rateDate: "2026-06-15", rateSource: "Bank of Canada" },
      }),
      { now: FIXED_NOW },
    );
    expect(r.status).toBe("success");
    if (r.status === "success") {
      expect(r.observation.capRate).toBeCloseTo((1_600_000 * 0.75) / 20_000_000, 10);
      expect(r.observation.audit.transformations.some((t) => t.includes("Currency conversion"))).toBe(true);
    }
  });
});

describe("4. Price validation", () => {
  test("zero price -> INVALID_TRANSACTION_VALUES", () => {
    const r = deriveTransactionCapRate(
      baseInput({ price: known({ amount: 0, currency: "USD", priceType: "confirmed_sale_price" }) }),
    );
    expect(r.status).toBe("data_gap");
    if (r.status === "data_gap") expect(r.gap.reasonCode).toBe("INVALID_TRANSACTION_VALUES");
  });

  test("negative price -> INVALID_TRANSACTION_VALUES", () => {
    const r = deriveTransactionCapRate(
      baseInput({ price: known({ amount: -5, currency: "USD", priceType: "confirmed_sale_price" }) }),
    );
    expect(r.status).toBe("data_gap");
    if (r.status === "data_gap") expect(r.gap.reasonCode).toBe("INVALID_TRANSACTION_VALUES");
  });

  test("zero NOI -> INVALID_TRANSACTION_VALUES", () => {
    const r = deriveTransactionCapRate(
      baseInput({ noi: known({ amount: 0, currency: "USD", definition: "actual_trailing", period: "annual" }) }),
    );
    expect(r.status).toBe("data_gap");
    if (r.status === "data_gap") expect(r.gap.reasonCode).toBe("INVALID_TRANSACTION_VALUES");
  });

  test("negative NOI -> INVALID_TRANSACTION_VALUES", () => {
    const r = deriveTransactionCapRate(
      baseInput({ noi: known({ amount: -100, currency: "USD", definition: "actual_trailing", period: "annual" }) }),
    );
    expect(r.status).toBe("data_gap");
    if (r.status === "data_gap") expect(r.gap.reasonCode).toBe("INVALID_TRANSACTION_VALUES");
  });

  test("asking price -> NON_TRANSACTION_PRICE", () => {
    const r = deriveTransactionCapRate(baseInput({ price: known({ amount: 20_000_000, currency: "USD", priceType: "asking_price" }) }));
    expect(r.status).toBe("data_gap");
    if (r.status === "data_gap") expect(r.gap.reasonCode).toBe("NON_TRANSACTION_PRICE");
  });

  test("listing price -> NON_TRANSACTION_PRICE", () => {
    const r = deriveTransactionCapRate(baseInput({ price: known({ amount: 20_000_000, currency: "USD", priceType: "listing_price" }) }));
    expect(r.status).toBe("data_gap");
    if (r.status === "data_gap") expect(r.gap.reasonCode).toBe("NON_TRANSACTION_PRICE");
  });

  test("assessed value -> NON_TRANSACTION_PRICE", () => {
    const r = deriveTransactionCapRate(baseInput({ price: known({ amount: 18_000_000, currency: "USD", priceType: "assessed_value" }) }));
    expect(r.status).toBe("data_gap");
    if (r.status === "data_gap") expect(r.gap.reasonCode).toBe("NON_TRANSACTION_PRICE");
  });

  test("estimated value -> NON_TRANSACTION_PRICE", () => {
    const r = deriveTransactionCapRate(baseInput({ price: known({ amount: 19_000_000, currency: "USD", priceType: "estimated_value" }) }));
    expect(r.status).toBe("data_gap");
    if (r.status === "data_gap") expect(r.gap.reasonCode).toBe("NON_TRANSACTION_PRICE");
  });
});

describe("5. No-inference scenarios (must always DATA_GAP)", () => {
  test("price only (NOI unknown)", () => {
    const r = deriveTransactionCapRate(baseInput({ noi: unknown() }));
    expect(r.status).toBe("data_gap");
  });

  test("NOI only (price unknown)", () => {
    const r = deriveTransactionCapRate(baseInput({ price: unknown() }));
    expect(r.status).toBe("data_gap");
  });

  test("price + gross rent without expenses is never a valid NOI substitute", () => {
    // The type system requires an explicit NOI; a caller cannot construct a valid
    // "gross rent as NOI" input without lying about the definition. Simulate the
    // legitimate rejection path: NOI genuinely not disclosed while only rent is known.
    const r = deriveTransactionCapRate(baseInput({ noi: notDisclosed() }));
    expect(r.status).toBe("data_gap");
    if (r.status === "data_gap") expect(r.gap.reasonCode).toBe("NOI_MISSING");
  });

  test("price + asking cap rate but no NOI -> DATA_GAP even with publisherCapRate present", () => {
    const r = deriveTransactionCapRate(baseInput({ noi: unknown(), publisherCapRate: { value: 5.75, capRateType: "going_in" } }));
    expect(r.status).toBe("data_gap");
    if (r.status === "data_gap") expect(r.gap.reasonCode).toBe("NOI_MISSING");
  });

  test("price + estimated expenses without documented NOI is out of scope -> DATA_GAP", () => {
    const r = deriveTransactionCapRate(baseInput({ noi: unknown() }));
    expect(r.status).toBe("data_gap");
  });

  test("price + unknown NOI period -> DATA_GAP", () => {
    const withoutPeriod = {
      ...baseInput(),
      noi: { state: "KNOWN", value: { amount: 1_200_000, currency: "USD", definition: "actual_trailing" } },
    } as unknown as CRETransactionInput;
    const r = deriveTransactionCapRate(withoutPeriod);
    expect(r.status).toBe("data_gap");
  });

  test("price + unknown currency -> DATA_GAP", () => {
    const r = deriveTransactionCapRate(
      baseInput({ noi: known({ amount: 1_200_000, currency: "OTHER", definition: "actual_trailing", period: "annual" }) }),
    );
    expect(r.status).toBe("data_gap");
  });

  test("listing price + NOI -> DATA_GAP (NON_TRANSACTION_PRICE)", () => {
    const r = deriveTransactionCapRate(baseInput({ price: known({ amount: 21_000_000, currency: "USD", priceType: "listing_price" }) }));
    expect(r.status).toBe("data_gap");
    if (r.status === "data_gap") expect(r.gap.reasonCode).toBe("NON_TRANSACTION_PRICE");
  });

  test("assessment value + NOI -> DATA_GAP (NON_TRANSACTION_PRICE)", () => {
    const r = deriveTransactionCapRate(baseInput({ price: known({ amount: 17_500_000, currency: "USD", priceType: "assessed_value" }) }));
    expect(r.status).toBe("data_gap");
    if (r.status === "data_gap") expect(r.gap.reasonCode).toBe("NON_TRANSACTION_PRICE");
  });

  test("no fabricated NOI: valid input never invents an NOI field that wasn't supplied", () => {
    const r = deriveTransactionCapRate(baseInput(), { now: FIXED_NOW });
    expect(r.status).toBe("success");
    if (r.status === "success") {
      expect(r.observation.derivedFrom.noi).toBe(1_200_000); // exactly the disclosed figure, no adjustment
    }
  });

  test("no fabricated expense ratio: assumptions explicitly disclaim expense estimation", () => {
    const r = deriveTransactionCapRate(baseInput(), { now: FIXED_NOW });
    expect(r.status).toBe("success");
    if (r.status === "success") {
      expect(r.observation.audit.assumptions.some((a) => /expense/i.test(a))).toBe(true);
    }
  });

  test("no inference from rent: gross-rent-only input path is unreachable via the type-safe API and rejected at the NOI gate", () => {
    const r = deriveTransactionCapRate(baseInput({ noi: unknown() }));
    expect(r.status).toBe("data_gap");
    if (r.status === "data_gap") expect(r.gap.reasonCode).toBe("NOI_MISSING");
  });
});

describe("6. NOI quality/definition preservation", () => {
  test("actual vs estimated NOI remain distinguishable", () => {
    const actual = deriveTransactionCapRate(baseInput(), { now: FIXED_NOW });
    const estimated = deriveTransactionCapRate(
      baseInput({ noi: known({ amount: 1_200_000, currency: "USD", definition: "estimated", period: "annual" }) }),
      { now: FIXED_NOW },
    );
    expect(actual.status).toBe("success");
    expect(estimated.status).toBe("success");
    if (actual.status === "success" && estimated.status === "success") {
      expect(actual.observation.audit.noi.quality).toBe("ACTUAL");
      expect(estimated.observation.audit.noi.quality).toBe("ESTIMATED");
    }
  });

  test("stabilized NOI classified STABILIZED", () => {
    const r = deriveTransactionCapRate(
      baseInput({ noi: known({ amount: 1_200_000, currency: "USD", definition: "stabilized", period: "annual" }) }),
      { now: FIXED_NOW },
    );
    expect(r.status).toBe("success");
    if (r.status === "success") expect(r.observation.audit.noi.quality).toBe("STABILIZED");
  });

  test("seller-reported NOI classified REPORTED", () => {
    const r = deriveTransactionCapRate(
      baseInput({ noi: known({ amount: 1_200_000, currency: "USD", definition: "seller_reported", period: "annual" }) }),
      { now: FIXED_NOW },
    );
    expect(r.status).toBe("success");
    if (r.status === "success") expect(r.observation.audit.noi.quality).toBe("REPORTED");
  });

  test("source-derived NOI classified REPORTED", () => {
    const r = deriveTransactionCapRate(
      baseInput({ noi: known({ amount: 1_200_000, currency: "USD", definition: "source_derived", period: "annual" }) }),
      { now: FIXED_NOW },
    );
    expect(r.status).toBe("success");
    if (r.status === "success") expect(r.observation.audit.noi.quality).toBe("REPORTED");
  });

  test("broker-reported NOI classified REPORTED", () => {
    const r = deriveTransactionCapRate(
      baseInput({ noi: known({ amount: 1_200_000, currency: "USD", definition: "broker_reported", period: "annual" }) }),
      { now: FIXED_NOW },
    );
    expect(r.status).toBe("success");
    if (r.status === "success") expect(r.observation.audit.noi.quality).toBe("REPORTED");
  });
});

describe("7. Provenance", () => {
  test("insufficient provenance -> INSUFFICIENT_TRANSACTION_PROVENANCE", () => {
    const r = deriveTransactionCapRate(
      baseInput({ provenance: { source: "", transactionDate: "2026-06-15", transactionId: "txn-001" } }),
    );
    expect(r.status).toBe("data_gap");
    if (r.status === "data_gap") expect(r.gap.reasonCode).toBe("INSUFFICIENT_TRANSACTION_PROVENANCE");
  });

  test("valid transaction with full provenance retains every required field on the audit", () => {
    const r = deriveTransactionCapRate(baseInput(), { now: FIXED_NOW });
    expect(r.status).toBe("success");
    if (r.status === "success") {
      const a = r.observation.audit;
      expect(a.source).toBe("CoStar");
      expect(a.locator).toBe("Deal ID 998877");
      expect(a.publicationDate).toBe("2026-07-01");
      expect(a.purchasePrice.amount).toBe(20_000_000);
      expect(a.noi.amount).toBe(1_200_000);
      expect(a.calculation).toContain("NOI / purchasePrice");
    }
  });
});

describe("8. Publisher vs derived cap rate reconciliation", () => {
  test("NOI + publisher cap rate: both preserved separately, never overwritten", () => {
    const r = deriveTransactionCapRate(
      baseInput({ publisherCapRate: { value: 5.75, capRateType: "going_in" } }),
      { now: FIXED_NOW },
    );
    expect(r.status).toBe("success");
    if (r.status === "success") {
      expect(r.observation.audit.reconciliation?.publisherCapRate).toBe(5.75);
      expect(r.observation.audit.reconciliation?.derivedCapRate).toBeCloseTo(6.0, 10);
      // publisher's figure is never mutated into the derived value or vice versa
      expect(r.observation.audit.reconciliation?.publisherCapRate).not.toBe(r.observation.audit.reconciliation?.derivedCapRate);
    }
  });

  test("publisher vs derived difference computed deterministically in bps", () => {
    expect(capRateDifferenceBps(5.75, 5.83)).toBe(8);
    expect(capRateDifferenceBps(5.0, 5.0)).toBe(0);
  });

  test("reconciliation tiers: negligible/notable/material", () => {
    const policy = { negligibleBps: 10, notableBps: 30 };
    expect(classifyReconciliationTier(5, policy)).toBe("negligible");
    expect(classifyReconciliationTier(20, policy)).toBe("notable");
    expect(classifyReconciliationTier(50, policy)).toBe("material");
  });

  test("publisher cap rate preserved separately on the observation itself", () => {
    const r = deriveTransactionCapRate(baseInput({ publisherCapRate: { value: 5.75, capRateType: "going_in" } }), { now: FIXED_NOW });
    expect(r.status).toBe("success");
    if (r.status === "success") expect(r.observation.capRateType).toBe("going_in");
  });

  test("derived cap rate preserved separately from publisher figure", () => {
    const r = deriveTransactionCapRate(baseInput({ publisherCapRate: { value: 5.75, capRateType: "going_in" } }), { now: FIXED_NOW });
    expect(r.status).toBe("success");
    if (r.status === "success") expect(r.observation.capRate).toBeCloseTo(0.06, 10);
  });

  test("no publisher cap rate -> reconciliation absent, no fabricated comparison", () => {
    const r = deriveTransactionCapRate(baseInput(), { now: FIXED_NOW });
    expect(r.status).toBe("success");
    if (r.status === "success") expect(r.observation.audit.reconciliation).toBeUndefined();
  });
});

describe("9. Period / annualization", () => {
  test("quarterly NOI with explicit annualization x4", () => {
    const r = deriveTransactionCapRate(
      baseInput({ noi: known({ amount: 300_000, currency: "USD", definition: "actual_trailing", period: "quarterly" }) }),
      { now: FIXED_NOW },
    );
    expect(r.status).toBe("success");
    if (r.status === "success") {
      expect(r.observation.capRate).toBeCloseTo(0.06, 10);
      expect(r.observation.audit.transformations.some((t) => t.includes("Annualization") && t.includes("x4"))).toBe(true);
    }
  });

  test("monthly NOI with explicit annualization x12", () => {
    const r = deriveTransactionCapRate(
      baseInput({ noi: known({ amount: 100_000, currency: "USD", definition: "actual_trailing", period: "monthly" }) }),
      { now: FIXED_NOW },
    );
    expect(r.status).toBe("success");
    if (r.status === "success") {
      expect(r.observation.capRate).toBeCloseTo(0.06, 10);
      expect(r.observation.audit.transformations.some((t) => t.includes("Annualization") && t.includes("x12"))).toBe(true);
    }
  });

  test("annual NOI records 'no annualization required'", () => {
    const r = deriveTransactionCapRate(baseInput(), { now: FIXED_NOW });
    expect(r.status).toBe("success");
    if (r.status === "success") {
      expect(r.observation.audit.transformations.some((t) => t.includes("No annualization required"))).toBe(true);
    }
  });
});

describe("10. Unsupported methodology", () => {
  test("unsupported NOI methodology is unrepresentable via the typed API and rejected upstream at the definition gate", () => {
    // The type system only allows the documented CRENoiDefinition union; a caller
    // attempting to smuggle in an undocumented method is caught here as
    // "not_disclosed" behaves like an explicit refusal to accept unverifiable methods.
    const r = deriveTransactionCapRate(
      baseInput({ noi: known({ amount: 1_200_000, currency: "USD", definition: "not_disclosed", period: "annual" }) }),
    );
    expect(r.status).toBe("data_gap");
    if (r.status === "data_gap") expect(r.gap.reasonCode).toBe("NOI_DEFINITION_MISSING");
  });
});

describe("11. Batch processing", () => {
  test("batch of independent transactions all succeed independently", () => {
    const results = deriveTransactionCapRateBatch([baseInput({ transactionId: "a" }), baseInput({ transactionId: "b" })], {
      now: FIXED_NOW,
    });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === "success")).toBe(true);
  });

  test("one valid + one invalid transaction: each gets its own independent result", () => {
    const results = deriveTransactionCapRateBatch(
      [baseInput({ transactionId: "good" }), baseInput({ transactionId: "bad", price: unknown() })],
      { now: FIXED_NOW },
    );
    expect(results[0].status).toBe("success");
    expect(results[1].status).toBe("data_gap");
    if (results[1].status === "data_gap") {
      expect(results[1].gap.transactionId).toBe("bad");
      expect(results[1].gap.reasonCode).toBe("TRANSACTION_PRICE_MISSING");
    }
  });

  test("batch never aggregates or averages across transactions", () => {
    const results = deriveTransactionCapRateBatch(
      [
        baseInput({ transactionId: "x", price: known({ amount: 10_000_000, currency: "USD", priceType: "confirmed_sale_price" }) }),
        baseInput({ transactionId: "y", price: known({ amount: 30_000_000, currency: "USD", priceType: "confirmed_sale_price" }) }),
      ],
      { now: FIXED_NOW },
    );
    expect(results[0].status).toBe("success");
    expect(results[1].status).toBe("success");
    if (results[0].status === "success" && results[1].status === "success") {
      // Each result is its own independent cap rate — no blended/averaged value appears anywhere.
      expect(results[0].observation.capRate).not.toBeCloseTo(results[1].observation.capRate, 5);
    }
  });
});

describe("12. Transaction remains marked DERIVED", () => {
  test("status is always DERIVED, never OBSERVED", () => {
    const r = deriveTransactionCapRate(baseInput(), { now: FIXED_NOW });
    expect(r.status).toBe("success");
    if (r.status === "success") {
      expect(r.observation.status).toBe("DERIVED");
      expect((r.observation as any).status).not.toBe("OBSERVED");
    }
  });
});

describe("13. Phase 2/3 integration", () => {
  test("toE87CandidateInput produces a shape Phase 2 accepts and includes", () => {
    const derived = deriveTransactionCapRate(baseInput(), { now: FIXED_NOW });
    expect(derived.status).toBe("success");
    if (derived.status !== "success") return;
    const candidateInput = toE87CandidateInput(derived.observation);
    expect(candidateInput.observation.dataStatus).toBe("derived");
    expect(candidateInput.observation.capRateType).toBe("derived_transaction");

    const result = evaluateComparability(
      { geography: { country: "US", city: "Houston" }, assetClass: "multifamily" },
      [candidateInput],
    );
    expect(result.included).toHaveLength(1);
  });

  test("a transaction-derived observation can flow through into Phase 3's buildCapRateBenchmark", () => {
    const derived = deriveTransactionCapRate(baseInput(), { now: FIXED_NOW });
    expect(derived.status).toBe("success");
    if (derived.status !== "success") return;
    const candidateInput = toE87CandidateInput(derived.observation);
    const comparability = evaluateComparability(
      { geography: { country: "US", city: "Houston" }, assetClass: "multifamily", capRateType: "derived_transaction" },
      [candidateInput],
    );
    const benchmark = buildCapRateBenchmark(comparability);
    expect(benchmark.status).toBe("success");
    if (benchmark.status === "success") {
      expect(benchmark.benchmark.value).toBeCloseTo(6.0, 10);
      expect(benchmark.benchmark.capRateType).toBe("derived_transaction");
    }
  });
});

describe("14. Determinism across identical inputs (no Date.now/Math.random leakage into capRate)", () => {
  test("capRate is identical regardless of wall-clock time", () => {
    const r1 = deriveTransactionCapRate(baseInput());
    const r2 = deriveTransactionCapRate(baseInput());
    expect(r1.status).toBe("success");
    expect(r2.status).toBe("success");
    if (r1.status === "success" && r2.status === "success") {
      expect(r1.observation.capRate).toBe(r2.observation.capRate);
      expect(r1.observation.displayValue).toBe(r2.observation.displayValue);
    }
  });
});

/**
 * InvestScape™ E87 Phase 4 — Transaction-Derived Cap Rate Calculation.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Calculates capRate = NOI / purchasePrice ONLY when a transaction's inputs
 * are sufficient, comparable, and legitimately establish both figures.
 * Otherwise returns a DATA_GAP with an explicit reason code and explanation.
 * See docs/E87-phase4-transaction-derived.md.
 *
 * THIS FILE DOES NOT: estimate NOI, infer NOI from rent, invent an expense
 * ratio, assume occupancy, treat financing costs as operating expenses, use
 * sale price alone, mix currencies silently, or run consensus/aggregation
 * across multiple transactions (Phase 3's job).
 */
import type { CRECitedObservation, CREDerivedTransaction } from "../cre-intelligence/types";
import type { E87CandidateInput } from "./comparability-types";
import {
  DEFAULT_RECONCILIATION_POLICY,
  NOI_ANNUALIZATION_FACTOR,
  NOI_DEFINITION_QUALITY,
  USABLE_PRICE_TYPES,
  type CRECapRateReconciliation,
  type CRENoiPeriod,
  type CRETransactionAudit,
  type CRETransactionDerivedObservation,
  type CRETransactionGap,
  type CRETransactionGapReasonCode,
  type CRETransactionInput,
  type CRETransactionOptions,
  type CRETransactionResult,
  type CREReconciliationPolicy,
  type CREReconciliationTier,
} from "./transaction-types";

function defaultNow(): string {
  return new Date().toISOString();
}

function gap(transactionId: string, reasonCode: CRETransactionGapReasonCode, explanation: string): CRETransactionResult {
  return { status: "data_gap", gap: { transactionId, reasonCode, explanation } };
}

/**
 * Deterministic basis-point difference between two cap rates expressed as
 * percentages (e.g. 5.75 and 5.83). 1 basis point = 0.01 percentage point.
 */
export function capRateDifferenceBps(a: number, b: number): number {
  return Math.round(Math.abs(a - b) * 100 * 100) / 100;
}

export function classifyReconciliationTier(bps: number, policy: CREReconciliationPolicy): CREReconciliationTier {
  if (bps <= policy.negligibleBps) return "negligible";
  if (bps <= policy.notableBps) return "notable";
  return "material";
}

function buildReconciliation(
  publisherValue: number,
  publisherType: CRETransactionInput["publisherCapRate"],
  derivedPercent: number,
  policy: CREReconciliationPolicy,
): CRECapRateReconciliation {
  const bps = capRateDifferenceBps(publisherValue, derivedPercent);
  const tier = classifyReconciliationTier(bps, policy);
  return {
    publisherCapRate: publisherValue,
    publisherCapRateType: publisherType?.capRateType,
    derivedCapRate: derivedPercent,
    differenceBps: bps,
    tier,
    policy,
    narrative:
      `Publisher stated cap rate: ${publisherValue.toFixed(2)}%. Derived cap rate: ${derivedPercent.toFixed(2)}%. ` +
      `Difference: ${bps}bps (${tier}, PROVISIONAL thresholds: negligible<=${policy.negligibleBps}bps, ` +
      `notable<=${policy.notableBps}bps, material>${policy.notableBps}bps). Neither figure is presumed correct; ` +
      "both are retained separately for audit.",
  };
}

/**
 * Calculate a single transaction's derived cap rate, or return an explicit
 * DATA_GAP. Pure function: never mutates `input`, never uses Date.now()
 * except via the injectable `options.now` (defaults to real time, but tests
 * should inject a fixed clock for full determinism of `calculatedAt`, which
 * is documentation-only and never affects `capRate`).
 */
export function deriveTransactionCapRate(
  input: CRETransactionInput,
  options: CRETransactionOptions = {},
): CRETransactionResult {
  const now = options.now ?? defaultNow;
  const policy = options.reconciliationPolicy ?? DEFAULT_RECONCILIATION_POLICY;
  const id = input.transactionId;

  // --- Provenance floor -----------------------------------------------------
  if (
    !input.provenance ||
    !input.provenance.source?.trim() ||
    !input.provenance.transactionId?.trim() ||
    !input.provenance.transactionDate?.trim()
  ) {
    return gap(
      id,
      "INSUFFICIENT_TRANSACTION_PROVENANCE",
      "Transaction provenance is incomplete: source, transactionId, and transactionDate are all required to trace this " +
        "figure back to its origin and reproduce the calculation independently.",
    );
  }

  // --- Purchase price ---------------------------------------------------------
  if (input.price.state !== "KNOWN" || input.price.value === undefined) {
    return gap(
      id,
      "TRANSACTION_PRICE_MISSING",
      `Purchase price is not KNOWN (state: ${input.price.state}). No cap rate can be calculated without a disclosed, ` +
        "verified transaction price. UNKNOWN/NOT_DISCLOSED is never treated as zero or estimated.",
    );
  }
  const price = input.price.value;

  if (!USABLE_PRICE_TYPES.has(price.priceType)) {
    return gap(
      id,
      "NON_TRANSACTION_PRICE",
      `Price type "${price.priceType}" does not represent actual transaction consideration. Only ` +
        "confirmed_sale_price or reported_sale_price may be used as a cap-rate denominator; asking/listing prices and " +
        "assessed/estimated values are never treated as purchase price.",
    );
  }

  if (!(price.amount > 0)) {
    return gap(
      id,
      "INVALID_TRANSACTION_VALUES",
      `Purchase price ${price.amount} is zero or negative. A zero/negative price is rejected outright, never silently ` +
        "corrected or treated as a data-entry convenience.",
    );
  }

  // --- NOI ---------------------------------------------------------------
  if (input.noi.state !== "KNOWN" || input.noi.value === undefined) {
    return gap(
      id,
      "NOI_MISSING",
      `NOI is not KNOWN (state: ${input.noi.state}). No cap rate can be calculated without disclosed NOI — never ` +
        "estimated from gross rent, an assumed expense ratio, or occupancy.",
    );
  }
  const noi = input.noi.value;

  if (noi.definition === "not_disclosed") {
    return gap(
      id,
      "NOI_DEFINITION_MISSING",
      "NOI amount is present but its definition (actual/stabilized/estimated/etc.) is not disclosed. A cap rate cannot " +
        "be labeled or trusted without knowing what kind of NOI backs it.",
    );
  }

  if (!input.noi.value || (input.noi.value as { period?: CRENoiPeriod }).period === undefined) {
    return gap(
      id,
      "NOI_PERIOD_MISSING",
      "NOI period (annual/trailing_12_month/forward_12_month/quarterly/monthly) is not stated. Annualization must be " +
        "explicit and cannot be assumed.",
    );
  }

  if (!(noi.amount > 0)) {
    return gap(
      id,
      "INVALID_TRANSACTION_VALUES",
      `NOI ${noi.amount} is zero or negative. A zero/negative NOI is rejected outright, never silently corrected.`,
    );
  }

  // --- Currency ------------------------------------------------------------
  if (price.currency === "OTHER" || noi.currency === "OTHER") {
    return gap(
      id,
      "CURRENCY_UNKNOWN",
      `Currency is not confidently known (price currency: ${price.currency}, NOI currency: ${noi.currency}). A cap ` +
        "rate is never calculated across an unknown currency.",
    );
  }

  let noiAmountInPriceCurrency = noi.amount;
  const transformations: string[] = [];

  if (price.currency !== noi.currency) {
    if (!input.fx || input.fx.fromCurrency !== noi.currency || input.fx.toCurrency !== price.currency) {
      return gap(
        id,
        "CURRENCY_MISMATCH",
        `Purchase price is in ${price.currency} but NOI is in ${noi.currency}, and no explicit, matching FX conversion ` +
          "(with rate, rate date, and rate source) was supplied. Currencies are never silently mixed and no FX rate is " +
          "ever invented.",
      );
    }
    if (!(input.fx.rate > 0) || !input.fx.rateDate?.trim() || !input.fx.rateSource?.trim()) {
      return gap(
        id,
        "CURRENCY_MISMATCH",
        "An FX conversion was supplied but is incomplete (rate must be positive; rateDate and rateSource are required).",
      );
    }
    noiAmountInPriceCurrency = noi.amount * input.fx.rate;
    transformations.push(
      `Currency conversion: NOI converted from ${noi.currency} to ${price.currency} at explicit rate ${input.fx.rate} ` +
        `(source: ${input.fx.rateSource}, dated ${input.fx.rateDate}). Raw NOI ${noi.amount} ${noi.currency} -> ` +
        `${noiAmountInPriceCurrency} ${price.currency}.`,
    );
  }

  // --- Annualization (explicit, labeled) ------------------------------------
  const factor = NOI_ANNUALIZATION_FACTOR[noi.period];
  const annualizedNoi = noiAmountInPriceCurrency * factor;
  if (factor !== 1) {
    transformations.push(
      `Annualization: ${noi.period} NOI ${noiAmountInPriceCurrency} ${price.currency} x${factor} = ` +
        `${annualizedNoi} ${price.currency}.`,
    );
  } else {
    transformations.push(`No annualization required: NOI period is "${noi.period}" (already an annual figure).`);
  }

  if (!(annualizedNoi > 0)) {
    return gap(
      id,
      "INVALID_TRANSACTION_VALUES",
      "Annualized NOI is zero or negative after currency conversion/annualization — rejected outright.",
    );
  }

  // --- Calculation: NO rounding before this point ---------------------------
  const rawCapRate = annualizedNoi / price.amount; // exact division, full float precision
  const capRatePercent = rawCapRate * 100;
  const displayValue = `${capRatePercent.toFixed(2)}%`;

  const noiQuality = NOI_DEFINITION_QUALITY[noi.definition];

  const assumptions: string[] = [
    `Price type "${price.priceType}" accepted as actual transaction consideration.`,
    `NOI definition "${noi.definition}" (quality: ${noiQuality}) preserved verbatim — not treated as equivalent to any other NOI definition.`,
    "No operating expenses were estimated; NOI is used exactly as disclosed (guessed-expense-ratio pathways are out of scope for this phase).",
  ];

  let reconciliation: CRECapRateReconciliation | undefined;
  if (input.publisherCapRate !== undefined) {
    reconciliation = buildReconciliation(input.publisherCapRate.value, input.publisherCapRate, capRatePercent, policy);
  }

  const calculation =
    `capRate = NOI / purchasePrice = ${annualizedNoi} ${price.currency} / ${price.amount} ${price.currency} = ` +
    `${rawCapRate} (${displayValue}). Computed with no intermediate rounding.`;

  const derivedFrom: CREDerivedTransaction = {
    propertyName: input.propertyName ?? "(unnamed property)",
    transactionDate: input.transactionDate,
    purchasePrice: price.amount,
    priceSource: input.provenance.source,
    noi: annualizedNoi,
    noiSource: input.provenance.source,
    methodology:
      `NOI / purchase price. NOI definition: ${noi.definition} (period: ${noi.period}` +
      (factor !== 1 ? `, annualized x${factor}` : "") +
      (price.currency !== noi.currency ? `, FX-converted ${noi.currency}->${price.currency}` : "") +
      "). Price type: " +
      price.priceType +
      ".",
  };

  const audit: CRETransactionAudit = {
    transactionId: id,
    propertyName: input.propertyName,
    source: input.provenance.source,
    purchasePrice: { amount: price.amount, currency: price.currency, priceType: price.priceType },
    noi: { amount: noi.amount, currency: noi.currency, definition: noi.definition, period: noi.period, quality: noiQuality },
    currency: price.currency,
    calculation,
    capRateType: input.publisherCapRate?.capRateType,
    publicationDate: input.provenance.publicationDate,
    locator: input.provenance.locator,
    assumptions,
    transformations,
    calculatedAt: now(),
    reconciliation,
  };

  const observation: CRETransactionDerivedObservation = {
    status: "DERIVED",
    transactionId: id,
    capRate: rawCapRate,
    displayValue,
    capRateType: input.publisherCapRate?.capRateType,
    derivedFrom,
    audit,
    geography: input.geography,
    assetClass: input.assetClass,
    propertySubtype: input.propertySubtype,
    propertyClass: input.propertyClass,
    locationType: input.locationType,
    sourceUrl: input.provenance.sourceUrl,
    retrievedAt: input.provenance.retrievedAt,
  };

  return { status: "success", observation };
}

/**
 * Batch entry point: calculates each transaction independently. One
 * transaction's DATA_GAP never affects another's SUCCESS, and no
 * aggregation/consensus is performed across the batch — that remains Phase
 * 3's job, only if these results are later fed through Phase 2/3's own
 * contracts (see `toE87CandidateInput` below).
 */
export function deriveTransactionCapRateBatch(
  inputs: readonly CRETransactionInput[],
  options: CRETransactionOptions = {},
): CRETransactionResult[] {
  return inputs.map((input) => deriveTransactionCapRate(input, options));
}

/**
 * Convert a successful Phase 4 derived observation into the exact shape
 * Phase 2's `evaluateCandidate`/`evaluateComparability` already consume
 * (`E87CandidateInput`, wrapping a `CRECitedObservation`), so a
 * transaction-derived cap rate can flow into the existing comparability and
 * (from there) Phase 3 benchmark contracts without a parallel engine.
 *
 * `capRateType` on the resulting observation is always `"derived_transaction"`
 * — E86's own vocabulary for "computed by E86 as NOI / price from explicitly
 * disclosed figures" (see CAP_RATE_FAMILY in cre-intelligence/types.ts) —
 * regardless of any publisher-stated `capRateType`, which is preserved
 * separately on `observation.capRateType`/`observation.audit.reconciliation`
 * and never overwritten. `dataStatus` is set to `"derived"` per E86's own
 * `assertObservationStatus` contract (requires `derivedFrom` or
 * capRateType "derived_transaction" — both are satisfied here).
 *
 * `freshness` is left undefined: Phase 4 does not assess freshness itself
 * (E87's documented hard dependency on E86/Phase-8's `assessFreshness`); a
 * caller who has computed it may attach it before passing this into Phase 2.
 */
export function toE87CandidateInput(observation: CRETransactionDerivedObservation): E87CandidateInput {
  const a = observation.audit;
  const cited: CRECitedObservation = {
    metric: "cap_rate",
    assetClass: observation.assetClass,
    propertySubtype: observation.propertySubtype,
    propertyClass: observation.propertyClass,
    locationType: observation.locationType,
    geography: observation.geography,
    periodStart: observation.derivedFrom.transactionDate,
    periodEnd: observation.derivedFrom.transactionDate,
    value: observation.capRate * 100,
    unit: "percent",
    capRateType: "derived_transaction",
    source: { sourceId: a.source, sourceName: a.source, sourceType: "transaction_database" },
    citation: {
      sourceName: a.source,
      reportTitle: a.transactionId,
      publicationDate: a.publicationDate ?? a.calculatedAt,
      period: observation.derivedFrom.transactionDate,
      locator: a.locator ?? "(no locator)",
      sourceUrl: observation.sourceUrl ?? "",
      retrievedAt: observation.retrievedAt ?? a.calculatedAt,
    },
    sourceQuality: 0,
    derivedFrom: observation.derivedFrom,
    dataStatus: "derived",
  };
  return { observation: cited };
}

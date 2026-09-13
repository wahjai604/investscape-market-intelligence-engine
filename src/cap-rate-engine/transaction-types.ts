/**
 * InvestScape™ E87 Phase 4 — Transaction-Derived Cap Rate Calculation: types.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * E87 Phase 4 is a read-only consumer of E86 (`src/cre-intelligence/`, frozen
 * at v1.0) and of Phase 2 (`comparability-types.ts`/`comparability.ts`). It
 * calculates a cap rate ONLY from an explicit transaction's disclosed
 * purchase price and NOI — never estimated, interpolated, or inferred from
 * rent/asking price/assessed value. See
 * docs/E87-phase4-transaction-derived.md for the full design rationale.
 *
 * THIS FILE DOES NOT: run consensus/aggregation across transactions (Phase
 * 3's job, only after a derived observation flows back through Phase 2/3's
 * existing contracts), invent an expense ratio, or estimate NOI from gross
 * income. Those are explicitly out of scope — see the Phase 4 doc's "Known
 * limitations" and "Future NOI construction capabilities" sections.
 */
import type {
  CREAssetClass,
  CRECapRateType,
  CREDerivedTransaction,
  CREGeography,
  CRELocationType,
  CREPropertyClass,
} from "../cre-intelligence/types";

/**
 * Explicit tri/four-state disclosure vocabulary, reused everywhere Phase 4
 * needs to distinguish "we don't have this" from "the source says zero" from
 * "this field does not apply to this transaction." NEVER collapse UNKNOWN or
 * NOT_DISCLOSED into a zero or a default value.
 */
export type CREDisclosureState = "KNOWN" | "UNKNOWN" | "NOT_DISCLOSED" | "NOT_APPLICABLE";

/**
 * A value alongside its disclosure state. When `state !== "KNOWN"`, `value`
 * MUST be undefined — enforced by `validateTransaction`, never merely assumed
 * by callers.
 */
export interface Disclosed<T> {
  state: CREDisclosureState;
  value?: T;
}

export function known<T>(value: T): Disclosed<T> {
  return { state: "KNOWN", value };
}
export function unknown<T = never>(): Disclosed<T> {
  return { state: "UNKNOWN" };
}
export function notDisclosed<T = never>(): Disclosed<T> {
  return { state: "NOT_DISCLOSED" };
}
export function notApplicable<T = never>(): Disclosed<T> {
  return { state: "NOT_APPLICABLE" };
}

// ---------------------------------------------------------------------------
// Purchase price classification (Part 3 of the spec)
// ---------------------------------------------------------------------------

/**
 * Only `confirmed_sale_price` and `reported_sale_price` represent actual
 * transaction consideration. `asking_price`, `listing_price`, and
 * `assessed_value` are explicitly NEVER usable as a cap-rate denominator —
 * `validateTransaction` hard-rejects them (NON_TRANSACTION_PRICE) regardless
 * of how confident the source otherwise looks.
 */
export type CREPriceType =
  | "confirmed_sale_price"
  | "reported_sale_price"
  | "asking_price"
  | "listing_price"
  | "assessed_value"
  | "estimated_value";

export const USABLE_PRICE_TYPES: ReadonlySet<CREPriceType> = new Set(["confirmed_sale_price", "reported_sale_price"]);

// ---------------------------------------------------------------------------
// NOI definition / quality (Part 4 of the spec)
// ---------------------------------------------------------------------------

/**
 * NOI definitions are NOT interchangeable. Preserved verbatim on every
 * derived observation so a cap rate based on actual trailing NOI never
 * becomes indistinguishable from one based on stabilized/estimated NOI.
 */
export type CRENoiDefinition =
  | "actual_trailing"
  | "actual_forward"
  | "stabilized"
  | "estimated"
  | "seller_reported"
  | "broker_reported"
  | "source_derived"
  | "not_disclosed";

/**
 * Explicit NOI quality classification, kept separate from the general source
 * hierarchy tier (Phase 3's `E87SourceHierarchyTier`) — a high-quality source
 * publishing an ESTIMATED NOI does not become ACTUAL NOI by association.
 */
export type CRENoiQuality = "ACTUAL" | "REPORTED" | "ESTIMATED" | "STABILIZED" | "UNKNOWN";

/** Maps each NOI definition to its quality classification, deterministically. */
export const NOI_DEFINITION_QUALITY: Readonly<Record<CRENoiDefinition, CRENoiQuality>> = {
  actual_trailing: "ACTUAL",
  actual_forward: "ACTUAL",
  stabilized: "STABILIZED",
  estimated: "ESTIMATED",
  seller_reported: "REPORTED",
  broker_reported: "REPORTED",
  source_derived: "REPORTED",
  not_disclosed: "UNKNOWN",
};

// ---------------------------------------------------------------------------
// NOI period (Part 5 of the spec)
// ---------------------------------------------------------------------------

export type CRENoiPeriod = "annual" | "trailing_12_month" | "forward_12_month" | "quarterly" | "monthly";

/**
 * Explicit, labeled annualization factor. `quarterly`/`monthly` NOI is never
 * silently annualized — the factor and the resulting transformation string
 * are always recorded on the audit trail.
 */
export const NOI_ANNUALIZATION_FACTOR: Readonly<Record<CRENoiPeriod, number>> = {
  annual: 1,
  trailing_12_month: 1,
  forward_12_month: 1,
  quarterly: 4,
  monthly: 12,
};

// ---------------------------------------------------------------------------
// Currency (Part 6 of the spec)
// ---------------------------------------------------------------------------

export type CRECurrency = "USD" | "CAD" | "OTHER";

/**
 * Contract only, per the spec: "you do not need to build a real FX
 * mechanism — just the contract/gap for it; don't invent rates." No
 * implementation of `convert` exists in Phase 4; a caller who supplies one
 * takes responsibility for its correctness. Absent this, any currency
 * mismatch is an unconditional DATA_GAP.
 */
export interface CREFxConversion {
  fromCurrency: CRECurrency;
  toCurrency: CRECurrency;
  rate: number;
  rateDate: string;
  rateSource: string;
}

// ---------------------------------------------------------------------------
// Transaction cap-rate type (Part 8/9 of the spec)
// ---------------------------------------------------------------------------

/** Publisher-stated cap-rate concept, when explicitly stated. Reuses E86's CRECapRateType. */
export type CRETransactionCapRateType = CRECapRateType;

// ---------------------------------------------------------------------------
// Transaction input model (Part 2 of the spec)
// ---------------------------------------------------------------------------

export interface CRETransactionProvenance {
  source: string;
  report?: string;
  publicationDate?: string;
  transactionDate: string;
  locator?: string;
  sourceUrl?: string;
  transactionId: string;
  /** ISO retrieval timestamp, mirrors E86's CRECitation.retrievedAt. */
  retrievedAt?: string;
}

/**
 * The full transaction input model. Every financial/definitional field is a
 * `Disclosed<T>` so a legitimate source's silence (NOT_DISCLOSED) is never
 * confused with "this project didn't look" (UNKNOWN) or with zero.
 */
export interface CRETransactionInput {
  transactionId: string;
  propertyName?: string;
  geography: CREGeography;
  assetClass: CREAssetClass;
  propertySubtype?: string;
  propertyClass?: CREPropertyClass;
  locationType?: CRELocationType;

  transactionDate: string;

  price: Disclosed<{ amount: number; currency: CRECurrency; priceType: CREPriceType }>;
  noi: Disclosed<{ amount: number; currency: CRECurrency; definition: CRENoiDefinition; period: CRENoiPeriod }>;

  /** Publisher-stated cap-rate type/value, when explicitly published — retained, never overwritten. */
  publisherCapRate?: { value: number; capRateType?: CRETransactionCapRateType };

  /** Optional explicit FX conversion the caller supplies; Phase 4 never invents one. */
  fx?: CREFxConversion;

  provenance: CRETransactionProvenance;
}

// ---------------------------------------------------------------------------
// DATA_GAP reason codes (Part on DATA GAP)
// ---------------------------------------------------------------------------

export type CRETransactionGapReasonCode =
  | "TRANSACTION_PRICE_MISSING"
  | "NOI_MISSING"
  | "NOI_DEFINITION_MISSING"
  | "NOI_PERIOD_MISSING"
  | "CURRENCY_MISMATCH"
  | "CURRENCY_UNKNOWN"
  | "NON_TRANSACTION_PRICE"
  | "INSUFFICIENT_TRANSACTION_PROVENANCE"
  | "INVALID_TRANSACTION_VALUES"
  | "UNSUPPORTED_NOI_METHOD"
  | "OTHER";

export interface CRETransactionGap {
  transactionId: string;
  reasonCode: CRETransactionGapReasonCode;
  explanation: string;
}

// ---------------------------------------------------------------------------
// Reconciliation (Part on RECONCILIATION)
// ---------------------------------------------------------------------------

/**
 * Configurable, explicitly PROVISIONAL thresholds — same spirit as Phase 3's
 * `DispersionPolicy`. Not empirically validated; a future phase must
 * calibrate against real transaction populations.
 */
export interface CREReconciliationPolicy {
  /** <= this many bps difference: negligible, not flagged. PROVISIONAL default 10bps. */
  negligibleBps: number;
  /** <= this many bps: notable but not material. PROVISIONAL default 30bps. */
  notableBps: number;
  /** > notableBps: material, flagged for audit. */
}

export const DEFAULT_RECONCILIATION_POLICY: CREReconciliationPolicy = {
  negligibleBps: 10,
  notableBps: 30,
};

export type CREReconciliationTier = "negligible" | "notable" | "material";

export interface CRECapRateReconciliation {
  publisherCapRate: number;
  publisherCapRateType?: CRETransactionCapRateType;
  derivedCapRate: number;
  differenceBps: number;
  tier: CREReconciliationTier;
  policy: CREReconciliationPolicy;
  narrative: string;
}

// ---------------------------------------------------------------------------
// Audit trail (Part on AUDIT TRAIL)
// ---------------------------------------------------------------------------

export interface CRETransactionAudit {
  transactionId: string;
  propertyName?: string;
  source: string;
  purchasePrice: { amount: number; currency: CRECurrency; priceType: CREPriceType };
  noi: { amount: number; currency: CRECurrency; definition: CRENoiDefinition; period: CRENoiPeriod; quality: CRENoiQuality };
  currency: CRECurrency;
  calculation: string;
  capRateType?: CRETransactionCapRateType;
  publicationDate?: string;
  locator?: string;
  assumptions: string[];
  transformations: string[];
  calculatedAt: string;
  reconciliation?: CRECapRateReconciliation;
}

// ---------------------------------------------------------------------------
// Derived observation (Part on DERIVED OBSERVATION)
// ---------------------------------------------------------------------------

/**
 * The canonical Phase 4 output for a single transaction. `status` is always
 * `"DERIVED"`, never `"OBSERVED"` — this is E87's own arithmetic, not a
 * publisher-printed figure. `asCandidateInput` reuses E86's
 * `CREDerivedTransaction` shape verbatim (via `toDerivedTransaction` in
 * transaction-derivation.ts) and produces an `E87CandidateInput` so the
 * result can flow into Phase 2's `evaluateCandidate`/`evaluateComparability`
 * and, from there, Phase 3's `buildCapRateBenchmark` — through the existing
 * contracts, with no parallel benchmark engine.
 */
export interface CRETransactionDerivedObservation {
  status: "DERIVED";
  transactionId: string;
  capRate: number;
  displayValue: string;
  capRateType?: CRETransactionCapRateType;
  derivedFrom: CREDerivedTransaction;
  audit: CRETransactionAudit;
  /**
   * Property/geography identity carried through from the originating
   * `CRETransactionInput`, verbatim, so `toE87CandidateInput` can build a
   * complete, valid `CRECitedObservation` without inventing or omitting any
   * Phase 2 comparability dimension.
   */
  geography: CREGeography;
  assetClass: CREAssetClass;
  propertySubtype?: string;
  propertyClass?: CREPropertyClass;
  locationType?: CRELocationType;
  sourceUrl?: string;
  retrievedAt?: string;
}

export type CRETransactionResult =
  | { status: "success"; observation: CRETransactionDerivedObservation }
  | { status: "data_gap"; gap: CRETransactionGap };

export interface CRETransactionOptions {
  reconciliationPolicy?: CREReconciliationPolicy;
  /** Injection point for deterministic tests; defaults to `() => new Date().toISOString()`. */
  now?: () => string;
}

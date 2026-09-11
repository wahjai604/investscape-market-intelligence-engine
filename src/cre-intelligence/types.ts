/**
 * InvestScape™ E68 — Commercial Real Estate Intelligence
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Data contracts only. E68 deliberately stores normalized observations and
 * provenance; it does not embed or redistribute proprietary brokerage,
 * transaction, or construction-cost databases.
 */

export type CRECountry = "CA" | "US";

export type CREAssetClass =
  | "office"
  | "industrial"
  | "retail"
  | "multifamily"
  | "hotel"
  | "healthcare"
  | "self_storage"
  | "seniors_housing"
  | "student_housing"
  | "medical_office"
  | "data_center"
  | "mixed_use"
  | "other";

export type CRESourceType =
  | "government"
  | "brokerage"
  | "valuation"
  | "transaction_database"
  | "construction_cost"
  | "user"
  | "internal"
  | "other";

export type CREMetric =
  | "cap_rate"
  | "hard_cost"
  | "soft_cost"
  | "construction_index"
  | "construction_cost_change";

export type CostBasis = "per_sf" | "per_unit" | "percent_of_hard_cost" | "index";

/**
 * Cap-rate concepts are NOT interchangeable. A stabilized cap rate and a
 * value-add cap rate on the same asset in the same market describe different
 * things, and averaging across them produces a number no publisher stands
 * behind. Any observation with metric "cap_rate" must state which concept it
 * is; see `assertComparableCapRates` in ./consensus.
 */
export type CRECapRateType =
  | "stabilized"
  | "value_add"
  | "going_in"
  | "exit"
  | "transaction"
  | "net_lease"
  /** A publisher's own market estimate (e.g. "Newmark's Current Estimate"). */
  | "survey_estimate"
  /** Computed by E68 as NOI / price from explicitly disclosed figures. */
  | "derived_transaction";

/**
 * Concept families that must never be averaged together. Survey estimates and
 * transaction-derived yields answer different questions; a derived transaction
 * cap rate is E68's own arithmetic and is quarantined from both.
 */
export const CAP_RATE_FAMILY: Readonly<Record<CRECapRateType, string>> = {
  stabilized: "survey",
  value_add: "survey",
  going_in: "survey",
  exit: "survey",
  net_lease: "survey",
  survey_estimate: "survey",
  transaction: "transaction",
  derived_transaction: "derived",
};

/**
 * Source-native building quality grade. "unspecified" is a real, meaningful
 * value: it means the publisher did not grade the asset, NOT that the grade is
 * unknown-but-inferable. Never derive A/B/C from another classification (an
 * RLB "prime" office is a cost tier, not a CBRE Class A).
 */
export type CREPropertyClass = "A" | "B" | "C" | "unspecified";

/** Source-native geography type within a market. */
export type CRELocationType = "cbd" | "suburban" | "urban" | "unspecified";

export interface CREGeography {
  country: CRECountry;
  region?: string;
  metro?: string;
  city?: string;
  submarket?: string;
}

export interface CRESource {
  sourceId: string;
  sourceName: string;
  sourceType: CRESourceType;
  methodologyUrl?: string;
  retrievedAt?: string;
  licenseNotes?: string;
}

/**
 * Citation metadata sufficient for a reader to independently re-find the exact
 * figure. "CBRE" or "CBRE Cap Rate Survey" is not a citation; a report title, a
 * publication date, a period and a locator within the document are.
 */
export interface CRECitation {
  /** Publisher, e.g. "Rider Levett Bucknall". */
  sourceName: string;
  /** Exact document title, e.g. "RLB Quarterly Construction Cost Report — North America Q2 2026". */
  reportTitle: string;
  /** ISO date the document was published. */
  publicationDate: string;
  /** Period the figure describes, e.g. "Q2 2026" or "April 2025 - April 2026". */
  period: string;
  /** Table/figure/page within the document, e.g. "Table: Indicative Construction Costs — USA / Austin". */
  locator: string;
  /** Canonical URL of the document itself, not a publisher landing page. */
  sourceUrl: string;
  /** ISO date this project actually retrieved the figure. */
  retrievedAt: string;
  /**
   * The party that actually produced the number, when the citing publisher is
   * republishing someone else's data (e.g. a brokerage report whose cap-rate
   * table is credited "Data Source: CoStar"). Keeps lineage auditable and stops
   * a proprietary dataset from looking free because a free report quoted it.
   */
  underlyingDataProvider?: string;
  /** Caveats a reader needs in order to use the figure correctly. */
  methodologyNote?: string;
}

/**
 * Licence classification (Phase 4A Part 9). A page being viewable says nothing
 * about licensing, so "free to read" is never a value here.
 */
export type CRELicenseClass =
  | "public"
  | "public_report"
  | "public_api"
  | "paid"
  | "subscription"
  | "proprietary"
  | "user_supplied";

/**
 * Provenance for a cap rate E68 computed itself. Every field is required:
 * without the price, the NOI, and where each came from, the arithmetic is not
 * auditable and the observation must not exist.
 */
export interface CREDerivedTransaction {
  propertyName: string;
  transactionDate: string;
  purchasePrice: number;
  priceSource: string;
  noi: number;
  noiSource: string;
  /** How the cap rate was computed, e.g. "NOI / purchase price". */
  methodology: string;
}

/**
 * A normalized market observation. low/high are optional because some sources
 * publish point estimates while others publish ranges. For a point estimate,
 * set value and omit low/high. For a range, set low/high and leave value
 * undefined — E68 never manufactures a midpoint the publisher did not print.
 * Use `rangeMidpoint()` at read time when a single number is genuinely needed.
 */
export interface CREObservation {
  metric: CREMetric;
  assetClass: CREAssetClass;
  /**
   * Source-native building subtype, verbatim in spirit from the publisher's own
   * table (e.g. "office_prime", "hotel_5_star"). First-class rather than a tag
   * because it is an analytical dimension, not incidental metadata.
   */
  propertySubtype?: string;
  propertyClass?: CREPropertyClass;
  locationType?: CRELocationType;
  /** Required in practice for metric "cap_rate"; see CRECapRateType. */
  capRateType?: CRECapRateType;
  geography: CREGeography;
  periodStart: string;
  periodEnd: string;
  value?: number;
  low?: number;
  high?: number;
  unit: string;
  basis?: CostBasis;
  source: CRESource;
  citation?: CRECitation;
  sourceQuality: number;
  sampleSize?: number;
  /** Required when capRateType is "derived_transaction"; forbidden otherwise. */
  derivedFrom?: CREDerivedTransaction;
  /** Genuinely source-specific extras only. Never core analytical dimensions. */
  tags?: Record<string, string>;
}

/**
 * The shape every observation in src/cre-intelligence/data/ must satisfy.
 * Citation is mandatory here, so an uncited figure cannot reach the data layer
 * even if `CREObservation` itself stays permissive for callers constructing
 * ad-hoc observations at runtime.
 */
export interface CRECitedObservation extends CREObservation {
  citation: CRECitation;
}

/**
 * A city/category combination E68 deliberately does NOT carry, and why.
 * Recording the absence is what keeps "we have no data" distinguishable from
 * "nobody looked" — and stops a future contributor from quietly backfilling an
 * estimate.
 */
export interface CREDataGap {
  metric: CREMetric;
  assetClass?: CREAssetClass;
  propertySubtype?: string;
  geography: CREGeography;
  /** Why no observation exists. Must describe a source fact, not an intention. */
  reason: string;
  /** Sources actually checked before declaring the gap. */
  sourcesChecked: string[];
  checkedAt: string;
}

export interface ConsensusResult {
  metric: CREMetric;
  observationCount: number;
  weightedValue: number;
  low: number;
  high: number;
  confidence: number;
  sourceIds: string[];
}

export interface EscalationResult {
  baseCost: number;
  basePeriod: string;
  targetPeriod: string;
  indexRatio: number;
  escalatedCost: number;
}

/**
 * Explicit, opt-in midpoint of a published range. This is a derived field by
 * definition: callers choose to compute it, and the result is never written
 * back into an observation's `value`.
 */
export function rangeMidpoint(obs: Pick<CREObservation, "low" | "high">): number | undefined {
  if (obs.low === undefined || obs.high === undefined) return undefined;
  return (obs.low + obs.high) / 2;
}

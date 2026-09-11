/**
 * InvestScape™ E68 Phase 7 — government/public-source ingestion architecture.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Generic pipeline contracts so a future public source can plug in without
 * rewriting E68:
 *
 *   Government/Public Source -> Source Adapter -> Raw Source Record
 *     -> Normalization -> Validation -> Qualification -> CREObservation
 *     -> Historical Data Store -> Benchmark/Downstream Consumers
 *
 * E68's existing `CREObservation` (types.ts) models a CRE market benchmark
 * (cap rate, hard/soft cost, construction index). Most public/government
 * sources do NOT publish CRE benchmarks directly — they publish CRE-ADJACENT
 * economic, demographic, or property data (population, employment, permits,
 * assessed value, mortgage rates). Forcing that data into `CREObservation`
 * would repeat the Phase 4 fabrication problem by dressing up an economic
 * statistic as a market benchmark. `EconomicIndicatorObservation` below is a
 * deliberately separate, parallel type for that data: it can never satisfy
 * `CREObservation`'s `metric: CREMetric` union, so a series like FRED's
 * 30-year mortgage rate cannot be typo'd or coerced into a cap rate.
 *
 * A source adapter MAY still produce genuine `CREObservation`s when a
 * government source really does publish one (e.g. Statistics Canada's
 * Building Construction Price Index, already registered in E68's source
 * registry as `statcan-bcpi` with metric `construction_index`).
 */
import type { CREGeography, CRECitation, CREDataStatus, CREObservation, CREDataGap } from "../types";
import type { CREDataGapReasonCode } from "./gap-reasons";

/** Part 2 classification: what a source provides. A source may provide several. */
export type CREPublicDataCategory =
  | "direct_cre_benchmark"
  | "cre_adjacent_economic"
  | "property_assessment"
  | "construction_permit"
  | "demographic"
  | "rental_housing"
  | "transaction_public_record"
  | "not_available";

/** Part 10 licensing tags. Multiple tags may apply to one source. */
export type CRELicenseTag =
  | "PUBLIC_GOVERNMENT"
  | "PUBLIC_API"
  | "PUBLIC_DOWNLOAD"
  | "ATTRIBUTION_REQUIRED"
  | "COMMERCIAL_USE_PERMITTED"
  | "COMMERCIAL_USE_UNCLEAR"
  | "REDISTRIBUTION_UNCLEAR"
  | "LICENSE_REQUIRED"
  | "PAID";

export type CREApiAvailability = "public_api" | "public_download" | "public_report_only" | "none_found";
export type CREAuthRequirement = "none" | "free_api_key" | "registration_required" | "paid_credentials";
export type CREPricingModel = "free" | "freemium" | "paid" | "unknown";
export type CREGeographicGranularity =
  | "national"
  | "provincial_state"
  | "metro_cbsa"
  | "city_municipal"
  | "census_tract_or_finer"
  | "parcel";

/**
 * Part 3/12 — one government/public source, fully classified. This is
 * research metadata, structurally identical in spirit to `CRESourceDefinition`
 * (source-registry.ts) and `CREPaidSourceProfile` (paid-source-analysis.ts)
 * but scoped to Part 2's eight-category classification and to sources that
 * were not necessarily adopted. Every field with a factual claim is expected
 * to carry (via `evidenceUrls`) a real URL checked on `dateVerified`.
 */
export interface CREPublicSourceProfile {
  sourceId: string;
  officialName: string;
  country: "CA" | "US";
  jurisdiction: string;
  datasetOrApiName: string;
  categories: CREPublicDataCategory[];
  url: string;
  apiAvailability: CREApiAvailability;
  downloadFormats: string[];
  authRequirement: CREAuthRequirement;
  pricingModel: CREPricingModel;
  rateLimitNote?: string;
  commercialUseRestriction: "permitted" | "unclear" | "restricted";
  redistributionRestriction: "permitted" | "unclear" | "restricted";
  attributionRequired: boolean;
  updateFrequency: "daily" | "monthly" | "quarterly" | "annual" | "irregular" | "unknown";
  geographicGranularity: CREGeographicGranularity;
  historicalDepthNote: string;
  /**
   * The honest answer to Part 3's final question. `false` unless the terms
   * were actually read and permit it; `null` when licensing is unresolved and
   * a legal/license review is required before any incorporation.
   */
  legallyIncorporable: boolean | null;
  licenseTags: CRELicenseTag[];
  refresh: {
    lastKnownPublicationPeriod?: string;
    retrievalMechanism: string;
    historicalBackfillPossible: boolean;
    automatedIngestionSafe: boolean;
  };
  citiesCoveredVerified: string[];
  evidenceUrls: string[];
  dateVerified: string;
  notes: string;
}

/** Raw, unnormalized payload as retrieved from a source, before any parsing. */
export interface RawSourceRecord<TRaw = unknown> {
  sourceId: string;
  datasetId: string;
  retrievedAt: string;
  requestParams: Record<string, string>;
  raw: TRaw;
}

export type SourceAdapterErrorCode =
  | "NETWORK_ERROR"
  | "RATE_LIMITED"
  | "SCHEMA_CHANGED"
  | "VALIDATION_FAILED"
  | "GEOGRAPHY_NOT_COVERED"
  | "NOT_FOUND";

export class SourceAdapterError extends Error {
  constructor(
    public readonly code: SourceAdapterErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SourceAdapterError";
  }
}

/** Category 2 (Part 2) data: a CRE-adjacent economic/demographic/property
 * observation. Structurally distinct from `CREObservation` on purpose — see
 * file header. Never has a `capRateType` and never claims metric `cap_rate`. */
export interface EconomicIndicatorObservation {
  sourceId: string;
  indicatorId: string;
  indicatorName: string;
  category: Exclude<CREPublicDataCategory, "direct_cre_benchmark" | "not_available">;
  geography: CREGeography;
  periodStart: string;
  periodEnd: string;
  value: number;
  unit: string;
  /** Adapters implemented in Phase 7 must set this explicitly; there is no
   * default the way there is for legacy `CREObservation`s. */
  dataStatus: CREDataStatus;
  citation: CRECitation;
  retrievedAt: string;
  tags?: Record<string, string>;
}

export type IngestionOutcome =
  | { status: "ok"; observations: CREObservation[] }
  | { status: "ok_economic"; observations: EconomicIndicatorObservation[] }
  | { status: "gap"; gap: CREDataGap }
  | { status: "error"; code: SourceAdapterErrorCode; message: string };

/**
 * The generic pipeline contract every Phase 7+ adapter implements. Kept
 * intentionally small: fetch the raw payload, parse it into a typed shape,
 * then normalize+validate into either CREObservations, EconomicIndicator
 * observations, or an explicit gap/error — never silently drop a failure.
 */
export interface SourceAdapter<TQuery, TRaw, TParsed> {
  readonly sourceId: string;
  readonly profile: CREPublicSourceProfile;

  /** Retrieve the raw payload. Adapters used in tests must not hit the network. */
  fetchRaw(query: TQuery): Promise<RawSourceRecord<TRaw>>;

  /** Parse the raw payload into a typed intermediate shape. Throws
   * `SourceAdapterError("SCHEMA_CHANGED", ...)` on an unrecognized shape
   * rather than guessing at field positions. */
  parse(raw: RawSourceRecord<TRaw>): TParsed[];

  /** Normalize + validate parsed records into the final ingestion outcome. */
  normalize(parsed: TParsed[], query: TQuery): IngestionOutcome;
}

/** Convenience for a reason-coded gap consistent with Part 11's vocabulary. */
export function buildDataGap(input: {
  metric: CREObservation["metric"];
  assetClass?: CREObservation["assetClass"];
  geography: CREGeography;
  reason: string;
  reasonCode: CREDataGapReasonCode;
  sourcesChecked: string[];
  checkedAt: string;
}): CREDataGap {
  return {
    metric: input.metric,
    assetClass: input.assetClass,
    geography: input.geography,
    reason: input.reason,
    reasonCode: input.reasonCode,
    sourcesChecked: input.sourcesChecked,
    checkedAt: input.checkedAt,
  };
}

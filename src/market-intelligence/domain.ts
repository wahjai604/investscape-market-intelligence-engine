/**
 * InvestScape™ Market Intelligence & Statistical Risk Engine
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * InvestScape™ is a registered trademark of Lighthouse Research Ltd.
 * This software is proprietary and confidential.
 *
 * LICENSING:
 * - Personal/Educational Use: Permitted (see LICENSE)
 * - Commercial Use: Requires written Commercial License Agreement
 * Contact: wahjai604@gmail.com
 *
 * DISCLAIMER:
 * This software is provided "as-is" for informational purposes only.
 * Not investment advice, tax advice, or financial advice.
 * Use at your own risk.
 */

// Re-exported so market-intelligence/ consumers have one import surface for
// both domain types and the pure-math result shape they're carried in.
export type { StatisticalIssue, StatResult } from "../statistical-risk/types";

export type GeographyLevel =
  | "country"
  | "province_state"
  | "metro"
  | "city"
  | "submarket"
  | "neighbourhood"
  | "postal_zip"
  | "custom";

export type SeasonalAdjustment = "seasonally_adjusted" | "not_adjusted" | "unknown";
export type RevisionStatus = "preliminary" | "revised" | "final" | "unknown";

export interface SourceMetadata {
  sourceId: string;
  sourceName: string;
  sourceType: "government" | "commercial" | "brokerage" | "user" | "internal" | "other";
  methodologyUrl?: string;
  licenseNotes?: string;
  retrievedAt?: string;
}

/**
 * The three economic-engine geography levels this repo actually has today.
 * NOT the same union as GeographyLevel — that's the spec's general-purpose
 * vocabulary; this is specifically what @investscape/economic-engine's
 * Region/City/NeighborhoodMetrics types use internally (regionId, cityId,
 * neighborhoodId). Kept separate and explicit rather than aliased, so a
 * TypeScript error surfaces immediately if economic-engine ever adds a
 * fourth level this package doesn't know about.
 */
export type EconomicEngineGeographyLevel = "region" | "city" | "neighborhood";

/**
 * GeographyRef is the spec-required shape (id/name/level/parentId/
 * countryCode) PLUS a `economicEngine` superset block that makes the
 * original economic-engine identifier recoverable — per the architecture
 * review's explicit requirement that GeographyRef be "a wrapper/superset
 * of investscape-economic-engine's existing geography shape... not an
 * independent hierarchy." See geography.ts for the wrap/unwrap functions
 * and __tests__/market-intelligence/geography.test.ts for the round-trip
 * proof.
 *
 * Correction to the architecture review's premise, confirmed by direct
 * inspection of investscape-economic-engine/src/types/{region,city,
 * neighborhood}.types.ts: coordinates are NOT present on all three
 * economic-engine geography types. Only NeighborhoodMetrics carries
 * `coordinates: {lat, lng}` — RegionMetrics and CityMetrics do not. This
 * type reflects that reality (`coordinates` is optional and only ever
 * populated for neighborhood-level refs) rather than the review's "confirmed
 * identical across all three" claim, which does not hold under inspection.
 */
export interface GeographyRef {
  id: string;
  name: string;
  level: GeographyLevel;
  parentId?: string;
  /**
   * ISO 3166-1 alpha-2 where determinable. economic-engine doesn't carry a
   * country code on City/NeighborhoodMetrics directly, only on region-level
   * REGION_DETAILS lookups — see geography.ts's wrapCityGeography /
   * wrapNeighborhoodGeography for how this is resolved (caller-supplied,
   * falling back to "UNKNOWN" rather than guessed).
   */
  countryCode: string;
  economicEngine: {
    level: EconomicEngineGeographyLevel;
    /** The exact regionId/cityId/neighborhoodId string as economic-engine uses it — this is what makes recovery possible. */
    id: string;
    coordinates?: { lat: number; lng: number };
  };
}

export interface MarketObservation {
  metricId: string;
  value: number;
  unit: string;
  periodStart: string;
  periodEnd: string;
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "annual" | "point_in_time";
  geography: GeographyRef;
  source: SourceMetadata;
  releasedAt?: string;
  effectiveAt?: string;
  seasonalAdjustment?: SeasonalAdjustment;
  revisionStatus?: RevisionStatus;
  sampleSize?: number;
  marginOfError?: number;
  confidenceLevel?: number;
  tags?: Record<string, string>;
}

/**
 * MarketObservation has no `id` field of its own (per the spec's exact
 * domain contract — not something this repo can add without diverging from
 * a binding shape). Provenance ("every derived output retains references
 * to the observations... used", per spec) needs *something* stable to
 * reference, so this builds a deterministic composite key from the fields
 * that actually identify an observation. Two calls with field-for-field
 * identical observations always produce the same key; this is a reference
 * key for provenance tracking, not a database primary key.
 */
export function observationKey(obs: MarketObservation): string {
  return [obs.metricId, obs.geography.id, obs.periodStart, obs.periodEnd, obs.source.sourceId].join("|");
}

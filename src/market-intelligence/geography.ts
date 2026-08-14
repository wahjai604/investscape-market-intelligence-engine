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

/**
 * The ONLY file in market-intelligence/ concerned with wrapping/unwrapping
 * economic-engine's three geography id shapes into GeographyRef. Adapter
 * files that fetch actual economic-engine data live in
 * economic-engine-adapters.ts and call into here for the geography piece.
 */

import { REGION_DETAILS } from "@investscape/economic-engine";
import { GeographyRef, GeographyLevel } from "./domain";

/**
 * economic-engine's "region" concept (e.g. 'central-canada', spanning
 * Ontario + Quebec) is a multi-province/state grouping — it doesn't match
 * any single value in the spec's GeographyLevel union ("metro" is a single
 * urban area, "province_state" is one province/state, neither fits a
 * multi-province zone). Mapped to "custom" as the most honest choice rather
 * than forcing a mismatched label. city and neighbourhood map directly.
 */
const LEVEL_MAP: Record<"region" | "city" | "neighborhood", GeographyLevel> = {
  region: "custom",
  city: "city",
  neighborhood: "neighbourhood",
};

/**
 * Derives ISO 3166-1 alpha-2 from economic-engine's REGION_DETAILS lookup
 * (REGION_DETAILS[regionId].country is "Canada" or "United States").
 * Returns "UNKNOWN" — never a guess — for an unrecognized regionId.
 */
export function countryCodeForRegionId(regionId: string): string {
  const details = REGION_DETAILS[regionId];
  if (!details) return "UNKNOWN";
  if (details.country === "Canada") return "CA";
  if (details.country === "United States") return "US";
  return "UNKNOWN";
}

export function wrapRegionGeography(input: { regionId: string; regionName: string }): GeographyRef {
  return {
    id: `region:${input.regionId}`,
    name: input.regionName,
    level: LEVEL_MAP.region,
    countryCode: countryCodeForRegionId(input.regionId),
    economicEngine: {
      level: "region",
      id: input.regionId,
    },
  };
}

/**
 * CityMetrics carries no country field — economic-engine's `province`
 * string alone doesn't disambiguate CA vs US (province names/abbreviations
 * are not globally unique). `countryCode` must be supplied by the caller
 * (who typically already knows it, e.g. from the request that produced
 * this city); defaults to "UNKNOWN" rather than guessed if omitted.
 */
export function wrapCityGeography(input: {
  cityId: string;
  cityName: string;
  regionId: string;
  countryCode?: string;
}): GeographyRef {
  return {
    id: `city:${input.cityId}`,
    name: input.cityName,
    level: LEVEL_MAP.city,
    parentId: `region:${input.regionId}`,
    countryCode: input.countryCode ?? "UNKNOWN",
    economicEngine: {
      level: "city",
      id: input.cityId,
    },
  };
}

/**
 * NeighborhoodMetrics is the one economic-engine geography type that does
 * carry coordinates ({lat, lng}) — see domain.ts's GeographyRef doc comment
 * for why this is NOT true of region/city despite the architecture
 * review's premise. countryCode has the same caller-supplied/"UNKNOWN"
 * policy as wrapCityGeography, for the same reason (no country field on
 * NeighborhoodMetrics either).
 */
export function wrapNeighborhoodGeography(input: {
  neighborhoodId: string;
  neighborhoodName: string;
  cityId: string;
  coordinates?: { lat: number; lng: number };
  countryCode?: string;
}): GeographyRef {
  return {
    id: `neighborhood:${input.neighborhoodId}`,
    name: input.neighborhoodName,
    level: LEVEL_MAP.neighborhood,
    parentId: `city:${input.cityId}`,
    countryCode: input.countryCode ?? "UNKNOWN",
    economicEngine: {
      level: "neighborhood",
      id: input.neighborhoodId,
      coordinates: input.coordinates,
    },
  };
}

/**
 * Recovers the original economic-engine id + level from a GeographyRef —
 * the round-trip the architecture review specifically required a test for.
 * Returns the raw `{ level, id }` pair exactly as economic-engine would
 * expect it back (e.g. as `regionId` in a regionalMacroContext() call).
 */
export function unwrapEconomicEngineGeography(ref: GeographyRef): { level: "region" | "city" | "neighborhood"; id: string } {
  return { level: ref.economicEngine.level, id: ref.economicEngine.id };
}

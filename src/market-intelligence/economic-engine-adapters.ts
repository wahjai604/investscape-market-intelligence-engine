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
 * The ONLY place in this package (besides geography.ts's REGION_DETAILS
 * lookup) that imports @investscape/economic-engine functions/constants.
 * Everything else in market-intelligence/ works on the normalized
 * MarketObservation model, not on economic-engine's bundle shapes
 * directly — this file is the seam, per the architecture review: MI must
 * call economic-engine's real functions rather than re-deriving anything
 * they already compute (avoiding the mistake documented in
 * investscape-economic-engine/src/E45-scenario-batch-processor.ts's own
 * header, where a package that was "declared in package.json but not
 * actually published or present" got silently reimplemented instead).
 */

import {
  regionalMacroContext,
  cityMarketAnalysis,
  neighborhoodDemographics,
  DATA_FRESHNESS_TTL,
  DATA_SOURCES,
  type RegionMetrics,
  type RegionMetricsInput,
  type CityMetrics,
  type CityMetricsInput,
  type NeighborhoodMetrics,
  type NeighborhoodMetricsInput,
} from "@investscape/economic-engine";

import { MarketObservation, SourceMetadata } from "./domain";
import { wrapCityGeography, wrapNeighborhoodGeography, wrapRegionGeography } from "./geography";
import { DataQualityInputs } from "./data-quality";

/**
 * Bridges economic-engine's 3-level confidence string onto a 0..1
 * sourceReliability input for assessDataQuality(). This is legitimate
 * per data-quality.ts's "never infer reliability from a source's name"
 * rule — economic-engine's own confidence assessment about its bundle is
 * an EXTERNAL signal already computed by that engine, not something this
 * package is inferring from a source name string.
 */
const CONFIDENCE_TO_SOURCE_RELIABILITY: Record<"high" | "medium" | "low", number> = {
  high: 0.9,
  medium: 0.6,
  low: 0.3,
};

/**
 * economic-engine's DATA_SOURCES are mostly government/statistical bodies,
 * with CREA and CBRE being industry/commercial organizations — a
 * documented, disclosed heuristic since economic-engine's own types don't
 * carry a sourceType field matching the spec's SourceMetadata vocabulary.
 */
const GOVERNMENT_SOURCES = new Set<string>([
  DATA_SOURCES.STATCAN,
  DATA_SOURCES.BOC,
  DATA_SOURCES.FRED,
  DATA_SOURCES.CENSUS,
  DATA_SOURCES.CMHC,
  DATA_SOURCES.FHFA,
]);

function sourceMetadataFor(sourceName: string, retrievedAtIso: string): SourceMetadata {
  return {
    sourceId: sourceName,
    sourceName,
    sourceType: GOVERNMENT_SOURCES.has(sourceName) ? "government" : "commercial",
    retrievedAt: retrievedAtIso,
  };
}

/**
 * freshness (0..1 for DataQualityInputs): 1.0 at age=0, decaying linearly
 * to 0 at age>=ttl, using economic-engine's REAL DATA_FRESHNESS_TTL
 * constants (7/14/30/90 days for RATES/MACRO/COMPS/DEMOGRAPHICS) — never a
 * value this package invents itself. See
 * __tests__/market-intelligence/data-quality.test.ts's
 * "does not hardcode freshness thresholds" test for the direct proof.
 */
export function freshnessScoreFor(asOfDate: Date, category: keyof typeof DATA_FRESHNESS_TTL, now: Date = new Date()): number {
  const ageMs = now.getTime() - asOfDate.getTime();
  const ttl = DATA_FRESHNESS_TTL[category];
  if (ageMs <= 0) return 1;
  if (ageMs >= ttl) return 0;
  return 1 - ageMs / ttl;
}

function buildDataQualityInputs(
  confidence: "high" | "medium" | "low",
  asOfDate: Date,
  category: keyof typeof DATA_FRESHNESS_TTL,
  completeness: number,
  now?: Date,
): DataQualityInputs {
  return {
    completeness,
    freshness: freshnessScoreFor(asOfDate, category, now),
    sourceReliability: CONFIDENCE_TO_SOURCE_RELIABILITY[confidence],
  };
}

interface ObservationSpec {
  metricId: string;
  value: number | null;
  unit: string;
}

function toObservations(
  specs: ObservationSpec[],
  common: Pick<MarketObservation, "frequency" | "geography" | "source" | "periodStart" | "periodEnd">,
): MarketObservation[] {
  return specs
    .filter((s): s is ObservationSpec & { value: number } => s.value !== null)
    .map((s) => ({ metricId: s.metricId, value: s.value, unit: s.unit, ...common }));
}

/**
 * Fetches E29 (regionalMacroContext) and normalizes its bundle into
 * MarketObservation[] — one observation per non-null numeric field,
 * `dayOfYear` point-in-time period (a region snapshot has no start/end
 * range, only an as-of date). Returns both the observations and the raw
 * bundle + a ready-to-use DataQualityInputs (completeness derived from how
 * many of the 7 tracked fields were non-null).
 */
export function fetchRegionObservations(input: RegionMetricsInput, now?: Date): {
  bundle: RegionMetrics;
  observations: MarketObservation[];
  dataQualityInputs: DataQualityInputs;
} {
  const bundle = regionalMacroContext(input);
  const geography = wrapRegionGeography({ regionId: bundle.regionId, regionName: bundle.regionName });
  const asOfIso = bundle.asOfDate.toISOString();
  const source = sourceMetadataFor(bundle.source, asOfIso);
  const common = { frequency: "point_in_time" as const, geography, source, periodStart: asOfIso, periodEnd: asOfIso };

  const specs: ObservationSpec[] = [
    { metricId: "region.gdp_growth", value: bundle.gdpGrowth, unit: "percent" },
    { metricId: "region.inflation_rate", value: bundle.inflationRate, unit: "percent" },
    { metricId: "region.mortgage_rate_5yr", value: bundle.mortgageRate5yr, unit: "percent" },
    { metricId: "region.employment_growth", value: bundle.employmentGrowth, unit: "percent" },
    { metricId: "region.construction_starts", value: bundle.constructionStarts, unit: "units_per_year" },
    { metricId: "region.avg_cap_rate", value: bundle.avgCapRate, unit: "percent" },
    { metricId: "region.avg_appreciation", value: bundle.avgAppreciation, unit: "percent" },
  ];

  const completeness = specs.filter((s) => s.value !== null).length / specs.length;

  return {
    bundle,
    observations: toObservations(specs, common),
    dataQualityInputs: buildDataQualityInputs(bundle.confidence, bundle.asOfDate, "MACRO", completeness, now),
  };
}

export function fetchCityObservations(input: CityMetricsInput, now?: Date): {
  bundle: CityMetrics;
  observations: MarketObservation[];
  dataQualityInputs: DataQualityInputs;
} {
  const bundle = cityMarketAnalysis(input);
  const geography = wrapCityGeography({ cityId: bundle.cityId, cityName: bundle.cityName, regionId: bundle.regionId });
  const asOfIso = bundle.asOfDate.toISOString();
  const source = sourceMetadataFor("CREA/Census composite", asOfIso);
  const common = { frequency: "point_in_time" as const, geography, source, periodStart: asOfIso, periodEnd: asOfIso };

  // medianHousePrice/medianRent use a generic "currency" unit rather than a
  // guessed ISO code — CityMetrics carries no country/currency field (see
  // domain.ts's GeographyRef doc comment), so claiming "CAD" or "USD" here
  // would be a fabricated fact, not a derived one. comparability.ts's
  // currency heuristic only matches a 3-letter prefix, so "currency" never
  // produces a false currency-mismatch flag against itself.
  const specs: ObservationSpec[] = [
    { metricId: "city.population", value: bundle.population, unit: "count" },
    { metricId: "city.median_house_price", value: bundle.medianHousePrice, unit: "currency" },
    { metricId: "city.median_rent", value: bundle.medianRent, unit: "currency_per_month" },
    { metricId: "city.cap_rate_p25", value: bundle.capRateDistribution.p25, unit: "percent" },
    { metricId: "city.cap_rate_p50", value: bundle.capRateDistribution.p50, unit: "percent" },
    { metricId: "city.cap_rate_p75", value: bundle.capRateDistribution.p75, unit: "percent" },
    { metricId: "city.price_change_12m", value: bundle.priceChange12m, unit: "percent" },
    { metricId: "city.rent_change_12m", value: bundle.rentChange12m, unit: "percent" },
    { metricId: "city.days_on_market", value: bundle.daysOnMarket, unit: "days" },
    { metricId: "city.absorption_rate", value: bundle.absorptionRate, unit: "months" },
  ];

  const completeness = specs.filter((s) => s.value !== null).length / specs.length;

  return {
    bundle,
    observations: toObservations(specs, common),
    dataQualityInputs: buildDataQualityInputs(bundle.confidence, bundle.asOfDate, "COMPS", completeness, now),
  };
}

export function fetchNeighborhoodObservations(input: NeighborhoodMetricsInput, now?: Date): {
  bundle: NeighborhoodMetrics;
  observations: MarketObservation[];
  dataQualityInputs: DataQualityInputs;
} {
  const bundle = neighborhoodDemographics(input);
  const geography = wrapNeighborhoodGeography({
    neighborhoodId: bundle.neighborhoodId,
    neighborhoodName: bundle.neighborhoodName,
    cityId: bundle.cityId,
    coordinates: bundle.coordinates,
  });
  const asOfIso = bundle.asOfDate.toISOString();
  const source = sourceMetadataFor("Statistics Canada/Census demographic composite", asOfIso);
  const common = { frequency: "point_in_time" as const, geography, source, periodStart: asOfIso, periodEnd: asOfIso };

  const specs: ObservationSpec[] = [
    { metricId: "neighborhood.population", value: bundle.population, unit: "count" },
    { metricId: "neighborhood.population_growth", value: bundle.populationGrowth, unit: "percent" },
    { metricId: "neighborhood.median_age", value: bundle.medianAge, unit: "years" },
    { metricId: "neighborhood.median_household_income", value: bundle.medianHouseholdIncome, unit: "currency" },
    { metricId: "neighborhood.household_count", value: bundle.householdCount, unit: "count" },
    { metricId: "neighborhood.median_list_price", value: bundle.medianListPrice, unit: "currency" },
    { metricId: "neighborhood.median_sold_price", value: bundle.medianSoldPrice, unit: "currency" },
    { metricId: "neighborhood.price_per_sqft", value: bundle.pricePerSqft, unit: "currency_per_sqft" },
    { metricId: "neighborhood.median_rent", value: bundle.medianRent, unit: "currency_per_month" },
    { metricId: "neighborhood.rent_per_sqft", value: bundle.rentPerSqft, unit: "currency_per_sqft" },
    { metricId: "neighborhood.rental_vacancy_rate", value: bundle.rentalVacancyRate, unit: "percent" },
    { metricId: "neighborhood.days_on_market", value: bundle.daysOnMarket, unit: "days" },
    { metricId: "neighborhood.sold_volume_12m", value: bundle.soldVolume12m, unit: "count" },
    { metricId: "neighborhood.walk_score", value: bundle.walkScore, unit: "score_0_100" },
    { metricId: "neighborhood.transit_score", value: bundle.transitScore, unit: "score_0_100" },
    { metricId: "neighborhood.bike_score", value: bundle.bikeScore, unit: "score_0_100" },
    { metricId: "neighborhood.average_school_rating", value: bundle.averageSchoolRating, unit: "score_0_10" },
  ];

  const completeness = specs.filter((s) => s.value !== null).length / specs.length;

  return {
    bundle,
    observations: toObservations(specs, common),
    dataQualityInputs: buildDataQualityInputs(bundle.confidence, bundle.asOfDate, "DEMOGRAPHICS", completeness, now),
  };
}

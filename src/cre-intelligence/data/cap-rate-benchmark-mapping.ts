/**
 * InvestScape™ E86 Phase 4C — application benchmark mapping output.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Runs every one of the 35 verified cap-rate observations (15 US + 20 Canada)
 * through `qualifyCapRateObservation`. This is the E86 -> InvestScape
 * translation layer requested for Phase 4C, built entirely within this repo:
 * `CAP_RATE_BENCHMARKS` does not exist here (confirmed absent from this
 * workspace in Phase 4) and is not touched — that is Phase 5's job, against
 * the WeWeb repository, once this session has access to it.
 *
 * The 35 source observations in data/cap-rates-us.ts and data/cap-rates-ca.ts
 * are NOT modified by this file. Nothing here changes a value, a citation, or
 * a classification to make an observation map better — an observation that
 * cannot legitimately qualify stays unmapped (`legacyKey: undefined`).
 */
import { US_CAP_RATE_OBSERVATIONS } from "./cap-rates-us";
import { CA_CAP_RATE_OBSERVATIONS } from "./cap-rates-ca";
import { qualifyCapRateObservation, type ObservationQualification } from "../qualification";
import type { CRECitedObservation, CREAssetClass, CREPropertyClass, CRELocationType } from "../types";

/** Stable, deterministic id. Not a database key — just a readable identifier
 *  for this mapping table's rows. */
export function observationId(obs: CRECitedObservation): string {
  const parts = [
    obs.source.sourceId,
    obs.geography.country,
    obs.geography.city ?? "unknown-city",
    obs.assetClass,
    obs.propertySubtype ?? "na",
    obs.periodStart,
  ];
  return parts.join(":");
}

export interface BenchmarkMappingRow {
  observationId: string;
  sourceId: string;
  sourceName: string;
  reportTitle: string;
  country: "US" | "CA";
  city: string;
  sourceAssetClass: CREAssetClass;
  sourceSubtype?: string;
  sourcePropertyClass?: CREPropertyClass;
  sourceLocationType?: CRELocationType;
  period: string;
  valueShape: "point" | "range";
  mappedLegacyKey?: string;
  qualification: ObservationQualification["confidence"];
  baseQualification: ObservationQualification["confidence"];
  mappingRationale: string;
  warnings: readonly string[];
}

function toRow(obs: CRECitedObservation): BenchmarkMappingRow {
  const q = qualifyCapRateObservation(obs);
  return {
    observationId: observationId(obs),
    sourceId: obs.source.sourceId,
    sourceName: obs.source.sourceName,
    reportTitle: obs.citation.reportTitle,
    country: obs.geography.country,
    city: obs.geography.city ?? "unknown",
    sourceAssetClass: obs.assetClass,
    sourceSubtype: obs.propertySubtype,
    sourcePropertyClass: obs.propertyClass,
    sourceLocationType: obs.locationType,
    period: obs.citation.period,
    valueShape: q.valueShape,
    mappedLegacyKey: q.legacyKey,
    qualification: q.confidence,
    baseQualification: q.baseConfidence,
    mappingRationale: q.rationale,
    warnings: q.warnings,
  };
}

/** All 35 verified cap-rate observations, mapped. Order matches the source files. */
export const CAP_RATE_BENCHMARK_MAPPING: readonly BenchmarkMappingRow[] = [
  ...US_CAP_RATE_OBSERVATIONS.map(toRow),
  ...CA_CAP_RATE_OBSERVATIONS.map(toRow),
];

export function mappingSummary(): Record<BenchmarkMappingRow["qualification"], number> {
  const summary = { exact: 0, close: 0, approximate: 0, unsupported: 0 };
  for (const row of CAP_RATE_BENCHMARK_MAPPING) summary[row.qualification]++;
  return summary;
}

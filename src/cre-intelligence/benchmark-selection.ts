/**
 * InvestScape™ E86 Phase 5 — deterministic benchmark selection.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Turns a `BenchmarkIdentity` request into a `CREBenchmarkResponse` by
 * selecting from the qualified observation pool. This is the "matching a
 * specific application request against the best available observation" step
 * that Phase 4C explicitly deferred.
 *
 * SELECTION PRIORITY (Part 3 of the Phase 5 spec), applied in order as a
 * sequence of filters, never a weighted score:
 *   1. exact geographic match (country + city)
 *   2. exact asset-class match
 *   3. exact subtype match (if the request specifies one)
 *   4. exact class match (if the request specifies one)
 *   5. exact geography-type match (if the request specifies one)
 *   6. closest valid period
 *   7. source quality
 *   8. multiple-source corroboration (more observations agreeing wins ties)
 *
 * NEVER: average different asset classes, different property classes, or
 * CBD/suburban together. Combining only happens when the request's own
 * identity is defined broadly enough to ask for it (e.g. no propertyClass
 * specified at all) — never as a silent fallback after a narrower match fails.
 */
import type { CRECitedObservation } from "./types";
import { qualifyCapRateObservation, type ObservationQualification } from "./qualification";
import { observationId } from "./data/cap-rate-benchmark-mapping";
import type {
  BenchmarkIdentity,
  BenchmarkProvenanceEntry,
  CREBenchmarkResponse,
  DerivedValue,
  PublisherRange,
} from "./benchmark-types";

function matchesIdentity(obs: CRECitedObservation, id: BenchmarkIdentity): boolean {
  if (obs.geography.country !== id.country) return false;
  if ((obs.geography.city ?? "").toLowerCase() !== id.city.toLowerCase()) return false;
  if (obs.assetClass !== id.assetClass) return false;
  // Only filter on a dimension the REQUEST actually specifies. An unspecified
  // request dimension deliberately widens the pool; it never causes a silent
  // cross-category blend, because the pool is still asset-class-locked above.
  if (id.propertySubtype !== undefined && obs.propertySubtype !== id.propertySubtype) return false;
  if (id.propertyClass !== undefined && (obs.propertyClass ?? "unspecified") !== id.propertyClass) return false;
  if (id.locationType !== undefined && (obs.locationType ?? "unspecified") !== id.locationType) return false;
  if (id.capRateType !== undefined && obs.capRateType !== id.capRateType) return false;
  return true;
}

function periodRecency(obs: CRECitedObservation): number {
  return new Date(obs.periodEnd).getTime();
}

/**
 * Rank candidates per the priority list. Steps 1-5 are already enforced by
 * `matchesIdentity` (a non-matching observation never enters the pool), so
 * this comparator only needs to break ties on period, source quality, and
 * (implicitly, by candidate count) corroboration.
 */
function rankCandidates(candidates: readonly CRECitedObservation[]): CRECitedObservation[] {
  return [...candidates].sort((a, b) => {
    const periodDiff = periodRecency(b) - periodRecency(a);
    if (periodDiff !== 0) return periodDiff;
    return b.sourceQuality - a.sourceQuality;
  });
}

function toProvenance(obs: CRECitedObservation, q: ObservationQualification): BenchmarkProvenanceEntry {
  return {
    observationId: observationId(obs),
    sourceId: obs.source.sourceId,
    sourceName: obs.source.sourceName,
    reportTitle: obs.citation.reportTitle,
    publicationDate: obs.citation.publicationDate,
    period: obs.citation.period,
    locator: obs.citation.locator,
    sourceUrl: obs.citation.sourceUrl,
    qualification: q.confidence,
    methodologyNote: obs.citation.methodologyNote,
  };
}

/**
 * Select a cap-rate benchmark. Never averages across the candidate pool —
 * the top-ranked observation (after identity filtering) is the benchmark,
 * with any other matching observations surfaced only as additional
 * provenance/corroboration, never blended into the number.
 */
export function selectCapRateBenchmark(
  identity: BenchmarkIdentity,
  pool: readonly CRECitedObservation[],
  asOf?: Date,
): CREBenchmarkResponse {
  const candidates = pool.filter((obs) => matchesIdentity(obs, identity));
  if (candidates.length === 0) {
    return {
      status: "DATA_GAP",
      identity,
      warnings: [],
      provenance: [],
      dataGap: {
        reason: "No observation in the qualified pool matches this identity.",
        sourcesInvestigated: [],
        lastResearchDate: asOf?.toISOString().slice(0, 10) ?? "unknown",
      },
    };
  }

  const ranked = rankCandidates(candidates);
  const best = ranked[0];
  const q = qualifyCapRateObservation(best, asOf);

  if (q.confidence === "unsupported") {
    return {
      status: "DATA_GAP",
      identity,
      warnings: [],
      provenance: [],
      dataGap: {
        reason: `Best-matching observation (${observationId(best)}) failed qualification: ${q.rationale}`,
        sourcesInvestigated: [best.source.sourceId],
        lastResearchDate: asOf?.toISOString().slice(0, 10) ?? "unknown",
      },
    };
  }

  // APPROXIMATE must never silently look like a normal benchmark (Part 4).
  const status = q.confidence === "approximate" ? "AVAILABLE_WITH_WARNING" : "AVAILABLE";
  const warnings = [...q.warnings];
  if (q.confidence === "approximate") {
    warnings.unshift("Approximate benchmark — source/classification/temporal limitation. Do not present this as a standard exact benchmark.");
  }
  if (q.confidence === "close" && q.baseConfidence !== "close") {
    warnings.push(`Qualification is "close" rather than "exact": ${q.rationale}`);
  }

  const provenance = ranked.map((obs) => toProvenance(obs, qualifyCapRateObservation(obs, asOf)));

  const response: CREBenchmarkResponse = {
    status,
    identity,
    qualification: q.confidence,
    mappedLegacyKey: q.legacyKey,
    warnings,
    provenance,
  };

  if (best.value !== undefined) {
    response.publisherValue = { value: best.value, unit: best.unit };
  } else if (best.low !== undefined && best.high !== undefined) {
    const range: PublisherRange = { low: best.low, high: best.high, unit: best.unit };
    response.publisherRange = range;
  }

  return response;
}

/**
 * Explicitly derive a single number from a publisher range. Opt-in only —
 * nothing in `selectCapRateBenchmark` calls this on its own. The result is
 * always tagged `e86_derived` / `sourceSupplied: false` (Part 5's hard rule).
 */
export function deriveMidpoint(range: PublisherRange, method: string = "arithmetic midpoint"): DerivedValue {
  const value = (range.low + range.high) / 2;
  return {
    value,
    unit: range.unit,
    derivationMethod: method,
    provenance: "e86_derived",
    sourceSupplied: false,
  };
}

/**
 * Construction-cost selection. Identical filtering discipline to cap rates,
 * but there is no qualification pass yet for hard-cost observations (Phase
 * 4C only built cap-rate qualification) — so status is driven purely by
 * whether an RLB subtype mapping exists (Part 6 / mapping.ts's
 * `mapRlbSubtype`). An observation whose subtype maps `unsupported` (e.g.
 * multifamily, which RLB does not publish) is a DATA_GAP, not a forced fit.
 */
export function selectHardCostBenchmark(
  identity: BenchmarkIdentity,
  pool: readonly CRECitedObservation[],
  mapSubtype: (subtype: string) => { confidence: "exact" | "close" | "approximate" | "unsupported"; rationale: string; legacySubtype?: string },
  asOf?: Date,
): CREBenchmarkResponse {
  const candidates = pool.filter((obs) => matchesIdentity(obs, identity));
  if (candidates.length === 0) {
    return {
      status: "DATA_GAP",
      identity,
      warnings: [],
      provenance: [],
      dataGap: {
        reason: "No hard-cost observation matches this identity.",
        sourcesInvestigated: [],
        lastResearchDate: asOf?.toISOString().slice(0, 10) ?? "unknown",
      },
    };
  }

  const best = rankCandidates(candidates)[0];
  const mapping = best.propertySubtype ? mapSubtype(best.propertySubtype) : { confidence: "unsupported" as const, rationale: "No propertySubtype recorded." };

  if (mapping.confidence === "unsupported") {
    return {
      status: "DATA_GAP",
      identity,
      warnings: [],
      provenance: [],
      dataGap: {
        reason: `No defensible construction-cost mapping: ${mapping.rationale}`,
        sourcesInvestigated: [best.source.sourceId],
        lastResearchDate: asOf?.toISOString().slice(0, 10) ?? "unknown",
      },
    };
  }

  const warnings: string[] = [];
  const status = mapping.confidence === "approximate" ? "AVAILABLE_WITH_WARNING" : "AVAILABLE";
  if (mapping.confidence === "approximate") {
    warnings.push(`Approximate mapping: ${mapping.rationale}`);
  } else if (mapping.confidence === "close") {
    warnings.push(mapping.rationale);
  }

  const response: CREBenchmarkResponse = {
    status,
    identity,
    qualification: mapping.confidence,
    mappedLegacyKey: mapping.legacySubtype,
    warnings,
    provenance: [toProvenance(best, { legacyKey: undefined, confidence: mapping.confidence, baseConfidence: mapping.confidence, rationale: mapping.rationale, warnings: [], methodologyFamily: "derived", valueShape: best.value !== undefined ? "point" : "range", sourceQualityTier: "medium" })],
  };

  if (best.value !== undefined) {
    response.publisherValue = { value: best.value, unit: best.unit };
  } else if (best.low !== undefined && best.high !== undefined) {
    response.publisherRange = { low: best.low, high: best.high, unit: best.unit };
  }

  return response;
}

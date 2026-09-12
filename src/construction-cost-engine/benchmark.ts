/**
 * InvestScape™ E70 Phase 5 — Unified Benchmark Output.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * `evaluateConstructionCostBenchmark()` orchestrates Phase 2 (comparability/
 * pipeline) and Phase 4 (escalation) into ONE typed answer to: "what
 * construction-cost benchmark can E70 legitimately provide for this
 * request, from what evidence, with what confidence, after what
 * normalization/escalation, and what is missing if it cannot provide one?"
 *
 * THIS FILE DOES NOT reimplement comparability scoring or the escalation
 * index-ratio formula — it calls `evaluateConstructionCostRequest` (Phase 2)
 * and `escalateCost` (Phase 4) exactly as they already exist and interprets
 * their results. It adds exactly three things Phase 2/4 do not provide on
 * their own: (1) a single, deterministic aggregation across multiple
 * top-tier comparable observations, (2) a three-component confidence
 * model, and (3) one unified success/DATA_GAP output contract.
 *
 * Pure, deterministic: never mutates its inputs, never calls `Date.now()`
 * (every timestamp is caller-supplied via `checkedAt`), and produces
 * byte-identical output for byte-identical input regardless of candidate
 * pool ordering.
 */
import { evaluateConstructionCostRequest } from "./pipeline";
import { evaluateComparability } from "./comparability";
import { escalateCost } from "./escalation";
import { CC_DEFAULT_ESCALATION_POLICY } from "./escalation-policy";
import { comparabilityToTier, escalationRelationshipCap, floorConfidence, freshnessToTier, singleObservationCap, sourceQualityToTier } from "./confidence";
import type { ConstructionCostCandidateInput } from "./types";
import type { ConstructionCostComparabilityCandidate } from "./comparability-types";
import type { CCDataGapReasonCode } from "./gap-types";
import type { CCIndexObservation, EscalationOutcome } from "./index-types";
import type {
  BenchmarkDataGapReasonCode,
  BenchmarkProvenanceEntry,
  CCAggregationDecision,
  CCBenchmarkAuditTrail,
  CCBenchmarkCostFigure,
  CCConfidenceBreakdown,
  CCContributingObservation,
  ConstructionCostBenchmarkDataGap,
  ConstructionCostBenchmarkOutcome,
  ConstructionCostBenchmarkRequest,
  ConstructionCostBenchmarkResult,
  CCUserOverride,
} from "./benchmark-types";

const COMPARABILITY_RANK: Readonly<Record<string, number>> = { exact: 3, close: 2, approximate: 1, unsupported: 0 };

function isValidRequest(request: ConstructionCostBenchmarkRequest): string | undefined {
  if (request.geography.country !== "US" && request.geography.country !== "CA") {
    return `Request geography.country "${request.geography.country}" is not a recognized country (must be "US" or "CA").`;
  }
  if (!request.assetClass) return "Request assetClass is required and was not provided.";
  if (!request.costRepresentation) return "Request costRepresentation is required and was not provided.";
  return undefined;
}

function buildProvenanceEntry(
  candidate: ConstructionCostComparabilityCandidate,
  freshness: import("../cre-intelligence/ingestion/observation-lifecycle").CREPresentationFreshness | undefined,
  escalation: EscalationOutcome | undefined,
): BenchmarkProvenanceEntry {
  const obs = candidate.observation;
  const entry: BenchmarkProvenanceEntry = {
    sourceId: obs.source.sourceId,
    sourceName: obs.citation.sourceName,
    reportTitle: obs.citation.reportTitle,
    publicationDate: obs.citation.publicationDate,
    period: obs.citation.period,
    locator: obs.citation.locator,
    sourceUrl: obs.citation.sourceUrl,
    geography: obs.geography,
    propertySubtype: obs.propertySubtype,
    comparability: candidate.comparability,
    freshness,
    wasEscalated: escalation?.status === "ESCALATED",
  };
  if (escalation?.status === "ESCALATED") {
    entry.escalation = {
      relationship: escalation.result.relationship,
      indexSeriesId: escalation.result.indexSeries?.seriesId,
      baseIndexLocator: escalation.result.baseIndexObservation?.citation.locator,
      targetIndexLocator: escalation.result.targetIndexObservation?.citation.locator,
      indexRatio: escalation.result.calculation.indexRatio,
    };
  }
  return entry;
}

function sortKey(c: ConstructionCostComparabilityCandidate): string {
  const o = c.observation;
  return `${o.source.sourceId}|${o.geography.country}|${o.geography.city ?? ""}|${o.propertySubtype ?? ""}|${o.periodStart}|${o.periodEnd}|${o.citation.locator}`;
}

/** Deterministic, pool-order-independent sort so output ordering never depends on caller-supplied pool order. */
function sortedDeterministically<T extends ConstructionCostComparabilityCandidate>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
}

/**
 * Phase 7 defect fix (see file header note at the call site and
 * docs/E70-phase7-production-hardening.md): collapse candidates whose
 * OBSERVATION IDENTITY is identical — same source, same citation locator,
 * same period, same published figure — to a single contributing
 * observation, so a duplicate entry in the caller-supplied pool cannot
 * inflate the apparent evidence count. Input MUST already be sorted
 * deterministically (via `sortedDeterministically`) so "first occurrence
 * wins" is itself pool-order independent.
 */
function deduplicateByObservationIdentity<T extends ConstructionCostComparabilityCandidate>(sortedItems: readonly T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of sortedItems) {
    const key = sortKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function figureFromNormalized(n: { low?: number; high?: number; value?: number; unitBasis?: string; currency?: string }, unit: string): CCBenchmarkCostFigure {
  return { low: n.low, high: n.high, value: n.value, unit, currency: n.currency as CCBenchmarkCostFigure["currency"] };
}

function figureFromEscalated(escalation: Extract<EscalationOutcome, { status: "ESCALATED" }>): CCBenchmarkCostFigure {
  const c = escalation.result.escalatedCost;
  return { low: c.low, high: c.high, value: c.value, unit: c.unit, currency: c.currency };
}

function mapPipelineReasonToBenchmarkReason(
  reasonCode: CCDataGapReasonCode,
  excluded: readonly ConstructionCostComparabilityCandidate[],
): BenchmarkDataGapReasonCode {
  switch (reasonCode) {
    case "NO_CANDIDATES_IN_POOL":
    case "SOURCE_DOES_NOT_COVER_CATEGORY":
    case "SOURCE_COVERAGE_UNSUPPORTED_MAPPING":
      return "NO_EVIDENCE";
    case "NO_SOFT_COST_OBSERVATIONS_EXIST":
    case "TOTAL_COST_UNAVAILABLE_SOFT_COST_MISSING":
      return "TOTAL_COST_UNSUPPORTED";
    case "CURRENCY_CONVERSION_UNAVAILABLE":
    case "UNIT_CONVERSION_UNSUPPORTED":
      return "CONVERSION_UNSUPPORTED";
    case "ALL_CANDIDATES_EXCLUDED": {
      const codes = new Set(excluded.map((c) => c.exclusionReasonCode));
      if (codes.size > 0 && [...codes].every((c) => c === "CURRENCY_MISMATCH" || c === "INCOMPATIBLE_UNIT_BASIS")) return "CONVERSION_UNSUPPORTED";
      if (codes.size > 0 && [...codes].every((c) => c === "STALE" || c === "UNAVAILABLE")) return "FRESHNESS_UNSUPPORTED";
      return "NO_EVIDENCE";
    }
    default:
      return "NO_EVIDENCE";
  }
}

/**
 * Evaluate a construction-cost benchmark request against a candidate pool
 * (Phase 2 evidence) and, optionally, an index pool (Phase 4 evidence, used
 * only when `request.targetPeriod` is set). `checkedAt`/`computedAt` must be
 * supplied by the caller — never `Date.now()` internally, matching every
 * prior E70 phase's determinism convention.
 */
export function evaluateConstructionCostBenchmark(
  request: ConstructionCostBenchmarkRequest,
  pool: readonly ConstructionCostCandidateInput[],
  indexPool: readonly CCIndexObservation[],
  checkedAt: string,
): ConstructionCostBenchmarkOutcome {
  const invalidReason = isValidRequest(request);
  if (invalidReason !== undefined) {
    return {
      status: "data_gap",
      gap: buildGap(request, "INVALID_REQUEST", invalidReason, [], [], checkedAt),
    };
  }

  const pipelineResult = evaluateConstructionCostRequest(request, pool, checkedAt);

  if (pipelineResult.status === "DATA_GAP") {
    const { gap } = pipelineResult;
    let provenance: readonly BenchmarkProvenanceEntry[] = [];

    // Preserve hard-cost evidence when a total_cost request fails for lack of soft cost —
    // never silently discarded, never presented as if it answered the total_cost request.
    if (gap.reasonCode === "TOTAL_COST_UNAVAILABLE_SOFT_COST_MISSING") {
      const hardCostResult = evaluateComparability({ ...request, costRepresentation: "hard_cost" }, pool);
      provenance = sortedDeterministically(hardCostResult.included).map((c) => buildProvenanceEntry(c, poolFreshness(pool, c), undefined));
    }

    return {
      status: "data_gap",
      gap: buildGap(
        request,
        mapPipelineReasonToBenchmarkReason(gap.reasonCode, gap.excludedCandidates),
        gap.reason,
        [],
        gap.excludedCandidates,
        checkedAt,
        gap.resolutionHint,
        gap.reasonCode,
        undefined,
        provenance,
      ),
    };
  }

  const { result } = pipelineResult;
  const topRank = Math.max(...result.included.map((c) => COMPARABILITY_RANK[c.comparability]));
  const topTierRaw = sortedDeterministically(result.included.filter((c) => COMPARABILITY_RANK[c.comparability] === topRank));

  // --- Phase 7 defect fix: duplicate-observation collapse (see docs/E70-phase7-production-hardening.md). ---
  // Two candidates whose OBSERVATION IDENTITY (source id + geography + subtype + period + citation
  // locator — the same key already used for deterministic ordering) is identical describe the same
  // underlying published fact (the citation locator alone already points at one specific report
  // table cell), not two independent corroborating observations. Left uncollapsed, a duplicate entry
  // in the caller-supplied pool (e.g. the same observation accidentally present twice) would silently
  // inflate `contributingObservations.length` past 1, which in turn defeats the single-observation
  // confidence cap (confidence.ts's `singleObservationCap`) with no new evidence actually gained — a
  // genuine confidence-integrity defect, found and fixed in Phase 7. `result.included`/
  // `auditTrail.candidatesIncluded` still show every raw pipeline candidate, duplicates included —
  // nothing is hidden — only the aggregation/confidence layer treats a duplicate identity as one.
  const topTier = deduplicateByObservationIdentity(topTierRaw);
  const duplicatesCollapsed = topTierRaw.length - topTier.length;

  // --- Optional escalation (Phase 4), attempted independently per top-tier candidate. ---
  const escalationDecisions: Array<{ locator: string; outcome: "ESCALATED" | "DATA_GAP" | "NOT_REQUESTED"; detail: string }> = [];
  let survivors: Array<{ candidate: ConstructionCostComparabilityCandidate; escalation?: EscalationOutcome }> = topTier.map((candidate) => ({ candidate }));

  if (request.targetPeriod !== undefined) {
    const policy = request.escalationPolicy ?? CC_DEFAULT_ESCALATION_POLICY;
    const attempted = topTier.map((candidate) => {
      const outcome = escalateCost({ sourceObservation: candidate.observation, targetPeriod: request.targetPeriod!, policy, computedAt: checkedAt }, indexPool);
      escalationDecisions.push({
        locator: candidate.observation.citation.locator,
        outcome: outcome.status === "ESCALATED" ? "ESCALATED" : "DATA_GAP",
        detail: outcome.status === "ESCALATED" ? `Escalated via ${outcome.result.relationship} relationship, ratio ${outcome.result.calculation.indexRatio}.` : outcome.gap.reason,
      });
      return { candidate, escalation: outcome };
    });
    survivors = attempted.filter((a) => a.escalation!.status === "ESCALATED");

    if (survivors.length === 0) {
      const provenance = sortedDeterministically(topTier).map((c) => buildProvenanceEntry(c, poolFreshness(pool, c), undefined));
      const firstGapReason = attempted[0]?.escalation?.status === "DATA_GAP" ? attempted[0].escalation.gap.reasonCode : undefined;
      return {
        status: "data_gap",
        gap: buildGap(
          request,
          "ESCALATION_UNAVAILABLE",
          `A target period (${request.targetPeriod.start} to ${request.targetPeriod.end}) was requested, but escalation could not be performed for any of the ${topTier.length} qualifying observation(s).`,
          topTier,
          [],
          checkedAt,
          "Real index evidence (Phase 4) covering this geography/currency/period combination would be required to serve this request.",
          undefined,
          firstGapReason,
          provenance,
        ),
      };
    }
  } else {
    for (const candidate of topTier) {
      escalationDecisions.push({ locator: candidate.observation.citation.locator, outcome: "NOT_REQUESTED", detail: "No targetPeriod was requested; the observation's own published period is used as-is." });
    }
  }

  // --- Aggregation across surviving (possibly escalated) top-tier candidates. ---
  const figures = survivors.map((s) =>
    s.escalation?.status === "ESCALATED" ? figureFromEscalated(s.escalation as Extract<EscalationOutcome, { status: "ESCALATED" }>) : figureFromNormalized(s.candidate.normalized!, s.candidate.observation.unit),
  );

  const aggregation = aggregate(figures);
  if (aggregation.status === "DISAGREEMENT") {
    const provenance = sortedDeterministically(topTier).map((c, i) => buildProvenanceEntry(c, poolFreshness(pool, c), survivors[i]?.escalation));
    return {
      status: "data_gap",
      gap: buildGap(
        request,
        "MATERIAL_DISAGREEMENT",
        `${figures.length} comparable observations exist at the top comparability tier but their cost ranges do not mutually overlap (e.g. low=${aggregation.maxLow}, high=${aggregation.minHigh}). No single benchmark can be honestly derived without hiding the disagreement.`,
        topTier,
        [],
        checkedAt,
        undefined,
        undefined,
        undefined,
        provenance,
      ),
    };
  }

  const unit = survivors[0].escalation?.status === "ESCALATED" ? (survivors[0].escalation.result.escalatedCost.unit) : survivors[0].candidate.observation.unit;
  const currency = figures[0].currency;
  const asOfPeriod =
    request.targetPeriod ?? { start: survivors[0].candidate.observation.periodStart, end: survivors[0].candidate.observation.periodEnd, label: survivors[0].candidate.observation.citation.period };
  const escalated = request.targetPeriod !== undefined;

  const contributingObservations: CCContributingObservation[] = survivors.map((s) => {
    const freshness = poolFreshness(pool, s.candidate);
    return {
      candidate: s.candidate,
      freshness,
      escalation: s.escalation,
      dataConfidence: floorConfidence(sourceQualityToTier(s.candidate.observation.sourceQuality), freshnessToTier(freshness)),
      comparabilityConfidence: comparabilityToTier(s.candidate.comparability),
    };
  });

  const dataConfidence = floorConfidence(...contributingObservations.map((c) => c.dataConfidence));
  const comparabilityConfidence = floorConfidence(...contributingObservations.map((c) => c.comparabilityConfidence));
  const caps: string[] = [];
  const singleCap = singleObservationCap(survivors.length);
  if (singleCap) caps.push(`single-observation cap (${singleCap}): only ${survivors.length} contributing observation.`);
  const relationships = survivors.map((s) => (s.escalation?.status === "ESCALATED" ? s.escalation.result.relationship : undefined));
  const worstRelationshipCap = relationships.map(escalationRelationshipCap).find((c) => c !== undefined);
  if (worstRelationshipCap) caps.push(`escalation-relationship cap (${worstRelationshipCap}): at least one contributing observation was escalated via an INDIRECT index relationship.`);

  const benchmarkConfidence = floorConfidence(dataConfidence, comparabilityConfidence, ...(singleCap ? [singleCap] : []), ...(worstRelationshipCap ? [worstRelationshipCap] : []));

  const confidence: CCConfidenceBreakdown = {
    dataConfidence,
    comparabilityConfidence,
    benchmarkConfidence,
    derivation: [
      `dataConfidence = floor(sourceQuality tier, freshness tier) across ${contributingObservations.length} contributing observation(s) = ${dataConfidence}.`,
      `comparabilityConfidence = floor(Phase 2 comparability tier) across ${contributingObservations.length} contributing observation(s) = ${comparabilityConfidence}.`,
      ...caps,
      `benchmarkConfidence = floor(dataConfidence, comparabilityConfidence${singleCap ? ", single-observation cap" : ""}${worstRelationshipCap ? ", escalation-relationship cap" : ""}) = ${benchmarkConfidence}.`,
    ],
  };

  const provenance = sortedDeterministically(topTier).map((c, i) => buildProvenanceEntry(c, poolFreshness(pool, c), survivors.find((s) => s.candidate === c)?.escalation));
  const transformations = sortedDeterministically(survivors.map((s) => s.candidate)).flatMap((c) => c.normalized?.transformations ?? []);

  const comparabilityFloor = topTier.reduce<string>((acc, c) => (COMPARABILITY_RANK[c.comparability] < COMPARABILITY_RANK[acc] ? c.comparability : acc), topTier[0].comparability) as ConstructionCostComparabilityCandidate["comparability"];

  const aggregationDecision: CCAggregationDecision =
    survivors.length === 1
      ? { method: "SINGLE_OBSERVATION", observationCount: 1, rationale: "Exactly one top-tier comparable observation; used directly, no aggregation across sources performed." }
      : {
          method: "RANGE_UNION",
          observationCount: survivors.length,
          rationale: `${survivors.length} top-tier comparable observations mutually overlap; aggregated as the union range (min of lows, max of highs) — never a fabricated midpoint.`,
        };

  const assumptions: string[] = [
    `Benchmark reflects ${request.costRepresentation} only — never presented as a different cost representation.`,
    escalated ? `Escalated to the requested target period via Phase 4's escalateCost(); the un-escalated published figure(s) are preserved in provenance.` : "No escalation was requested; the benchmark reflects each contributing observation's own published period as-is.",
    ...(duplicatesCollapsed > 0
      ? [
          `${duplicatesCollapsed} duplicate observation(s) (identical source/citation-locator/period/figure) were detected in the candidate pool and treated as a single contributing observation for aggregation and confidence purposes — see auditTrail.candidatesIncluded for the full, uncollapsed set actually evaluated by Phase 2.`,
        ]
      : []),
  ];

  const auditTrail: CCBenchmarkAuditTrail = {
    candidatesConsidered: result.candidates.length,
    candidatesIncluded: result.included,
    candidatesExcluded: result.excluded,
    escalationDecisions,
    aggregationDecision: aggregationDecision.rationale,
    confidenceCalculation: confidence.derivation.join(" "),
    pipelineStatus: "CANDIDATES_AVAILABLE",
  };

  const benchmarkResult: ConstructionCostBenchmarkResult = {
    request,
    identity: {
      geography: request.geography,
      assetClass: request.assetClass,
      canonicalSubtype: request.canonicalSubtype,
      costRepresentation: request.costRepresentation,
      currency: request.currency ?? currency,
      unitBasis: request.unitBasis,
    },
    contributingObservations,
    benchmark: { ...aggregation.figure, unit, currency, asOfPeriod, escalated },
    comparability: comparabilityFloor,
    confidence,
    aggregation: aggregationDecision,
    provenance,
    auditTrail,
    assumptions,
    transformations,
    escalationPolicyVersion: escalated ? (request.escalationPolicy ?? CC_DEFAULT_ESCALATION_POLICY).version : undefined,
    computedAt: checkedAt,
  };

  return { status: "success", result: benchmarkResult };
}

function poolFreshness(
  pool: readonly ConstructionCostCandidateInput[],
  candidate: ConstructionCostComparabilityCandidate,
): import("../cre-intelligence/ingestion/observation-lifecycle").CREPresentationFreshness | undefined {
  return pool.find((p) => p.observation === candidate.observation)?.freshness;
}

type AggregationOutcome =
  | { status: "OK"; figure: Pick<CCBenchmarkCostFigure, "low" | "high" | "value"> }
  | { status: "DISAGREEMENT"; maxLow: number; minHigh: number };

/**
 * Deterministic, order-independent aggregation across N ≥ 1 same-tier
 * figures. A point value is treated as low === high === value for overlap
 * purposes. Overlap ⇒ conservative range union (min of lows, max of highs)
 * — never a fabricated midpoint. No overlap ⇒ material disagreement,
 * reported rather than hidden.
 */
function aggregate(figures: readonly CCBenchmarkCostFigure[]): AggregationOutcome {
  if (figures.length === 1) return { status: "OK", figure: figures[0] };

  const lows = figures.map((f) => f.low ?? f.value!);
  const highs = figures.map((f) => f.high ?? f.value!);
  const maxLow = Math.max(...lows);
  const minHigh = Math.min(...highs);

  if (maxLow > minHigh) return { status: "DISAGREEMENT", maxLow, minHigh };

  const anyRange = figures.some((f) => f.low !== undefined || f.high !== undefined);
  return {
    status: "OK",
    figure: anyRange ? { low: Math.min(...lows), high: Math.max(...highs) } : { value: figures[0].value },
  };
}

function buildGap(
  request: ConstructionCostBenchmarkRequest,
  reasonCode: BenchmarkDataGapReasonCode,
  reason: string,
  evidenceConsidered: readonly ConstructionCostComparabilityCandidate[],
  excludedEvidence: readonly ConstructionCostComparabilityCandidate[],
  checkedAt: string,
  resolutionHint?: string,
  pipelineGapReasonCode?: CCDataGapReasonCode,
  escalationGapReasonCode?: import("./index-types").EscalationDataGapReasonCode,
  provenance?: readonly BenchmarkProvenanceEntry[],
): ConstructionCostBenchmarkDataGap {
  return {
    request,
    reasonCode,
    reason,
    requestedCostBasis: request.costRepresentation,
    geography: request.geography,
    canonicalSubtype: request.canonicalSubtype,
    currency: request.currency,
    unitBasis: request.unitBasis,
    evidenceConsidered,
    excludedEvidence,
    pipelineGapReasonCode,
    escalationGapReasonCode,
    provenance: provenance ?? [],
    resolutionHint,
    checkedAt,
  };
}

/**
 * Apply an explicit, E70-local user override on top of an already-computed
 * outcome. NEVER mutates the underlying outcome, NEVER rewrites a source
 * observation, and NEVER converts a DATA_GAP into fabricated source
 * evidence — the override is always its own clearly-labeled figure, and the
 * underlying computed outcome (success or gap) is returned unchanged
 * alongside it for the caller to inspect. If the underlying outcome was a
 * DATA_GAP, this function does NOT synthesize a "success" — it is the
 * caller's responsibility to decide whether to display an override without
 * an underlying computed benchmark; this function only ever attaches the
 * override to a genuine "success" result, refusing otherwise.
 */
export function applyUserOverride(
  outcome: ConstructionCostBenchmarkOutcome,
  override: Omit<CCUserOverride, never>,
): ConstructionCostBenchmarkOutcome {
  if (outcome.status !== "success") {
    // Deliberately refuse: overriding a DATA_GAP would risk presenting a
    // user-supplied number as if it were a resolved benchmark. Callers who
    // need this must build their own explicitly-labeled "user-supplied
    // estimate, no benchmark available" presentation — never through this
    // function, which only ever augments a genuine success.
    return outcome;
  }
  return { status: "success", result: { ...outcome.result, userOverride: override } };
}

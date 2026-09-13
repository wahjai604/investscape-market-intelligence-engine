/**
 * InvestScape™ E87 Phase 3 — Consensus & Benchmark Selection.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Phase 2 (`comparability.ts`) answers "which observations are comparable to
 * this request?" This file answers the next question: "given the comparable
 * ones, is there enough legitimate, non-conflicting evidence to defend a
 * benchmark?" It NEVER re-derives comparability — it consumes
 * `E87ComparabilityResult` (Phase 2's own output type) as its sole input and
 * treats Phase 2's INCLUDED/EXCLUDED split as authoritative.
 *
 * THIS FILE DOES NOT: recompute comparability dimensions, calculate a
 * transaction-derived cap rate from NOI/price (Phase 4), fabricate a value
 * when evidence is missing/conflicting/stale/incompatible, or select
 * randomly among tied candidates. See docs/E87-phase3-consensus-and-benchmark.md.
 */
import { CAP_RATE_FAMILY, rangeMidpoint, type CRECapRateType } from "../cre-intelligence/types";
import type { E87ComparabilityCandidate, E87ComparabilityResult, E87MatchLevel } from "./comparability-types";
import {
  DEFAULT_DISPERSION_POLICY,
  SOURCE_HIERARCHY_RANK,
  floorConfidence,
  type DispersionPolicy,
  type E87Benchmark,
  type E87BenchmarkAudit,
  type E87BenchmarkAuditEntry,
  type E87BenchmarkGap,
  type E87BenchmarkGapReasonCode,
  type E87BenchmarkOptions,
  type E87BenchmarkResult,
  type E87ConfidenceTier,
  type E87Dispersion,
  type E87DispersionTier,
  type E87EnrichedCandidate,
  type E87Representation,
  type E87SourceHierarchyTier,
} from "./consensus-types";

// ---------------------------------------------------------------------------
// Representation classification (Part 3 of the Phase 3 doc)
// ---------------------------------------------------------------------------

const KNOWN_TAG_REPRESENTATIONS: ReadonlySet<string> = new Set([
  "point",
  "range",
  "median",
  "average",
  "percentile",
  "transaction_derived",
  "survey_estimate",
]);

/**
 * Classify an observation's representation. A source-declared
 * `tags.representation` wins when present and recognized; an unrecognized
 * tag value is `"unsupported"`, never guessed at. Absent a tag, the shape of
 * the observation (`value` vs `low`/`high`) and its `capRateType` drive the
 * inference — this never fabricates a representation the observation does
 * not structurally support.
 */
export function classifyRepresentation(obs: E87ComparabilityCandidate["observation"]): E87Representation {
  const tag = obs.tags?.representation;
  if (tag !== undefined) {
    return KNOWN_TAG_REPRESENTATIONS.has(tag) ? (tag as E87Representation) : "unsupported";
  }
  if (obs.capRateType === "derived_transaction") return "transaction_derived";
  if (obs.capRateType === "survey_estimate") return "survey_estimate";
  if (obs.value !== undefined) return "point";
  if (obs.low !== undefined && obs.high !== undefined) return "range";
  return "unsupported";
}

/**
 * Extract a single scalar for consensus math, WITHOUT unifying the original
 * representation away from the audit trail (the enriched candidate keeps
 * both). `range` uses E86's own `rangeMidpoint` (a pure, already-reviewed
 * transformation) — this is the one explicit, documented scalar
 * transformation Phase 3 performs; every other representation already
 * carries a publisher-printed scalar (`value`), used verbatim.
 */
export function extractScalarValue(
  obs: E87ComparabilityCandidate["observation"],
  representation: E87Representation,
): number | undefined {
  switch (representation) {
    case "point":
    case "median":
    case "average":
    case "percentile":
    case "transaction_derived":
    case "survey_estimate":
      return obs.value ?? rangeMidpoint(obs);
    case "range":
      return rangeMidpoint(obs);
    case "unsupported":
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Source hierarchy (Part 5 of the Phase 3 doc)
// ---------------------------------------------------------------------------

/**
 * Deterministic five-tier source hierarchy, derived ONLY from E86 fields that
 * already exist (`CRESource.sourceType`, `CRECapRateType`/`CAP_RATE_FAMILY`,
 * `CREDerivedTransaction`) — no new source-quality vocabulary is invented
 * beyond what the Phase 3 spec requires. This tier affects WEIGHT and
 * CONFIDENCE only; it can never move a candidate that Phase 2 excluded back
 * into eligibility, and it can never make an incompatible asset/geography/
 * cap-rate-family observation compatible (proved by
 * `sourceHierarchyNeverOverridesIncompatibility` in the test suite).
 */
export function sourceHierarchyTier(obs: E87ComparabilityCandidate["observation"]): E87SourceHierarchyTier {
  const family = obs.capRateType ? CAP_RATE_FAMILY[obs.capRateType] : undefined;
  switch (obs.source.sourceType) {
    case "valuation":
      return "primary_specialist_research";
    case "brokerage":
      return "primary_brokerage_research";
    case "transaction_database":
      if ((family === "transaction" || family === "derived") && obs.derivedFrom !== undefined) {
        return "transaction_derived_complete_provenance";
      }
      // A transaction database entry without complete derivation provenance is not yet
      // "complete provenance" transaction evidence — falls through to secondary/aggregated.
      return "secondary_aggregated";
    case "government":
    case "construction_cost":
    case "other":
      return "secondary_aggregated";
    case "user":
    case "internal":
    default:
      return "unsupported_unknown";
  }
}

// ---------------------------------------------------------------------------
// Deterministic weighting (Part 6/8 of the Phase 3 doc)
// ---------------------------------------------------------------------------

const HIERARCHY_WEIGHT: Readonly<Record<E87SourceHierarchyTier, number>> = {
  primary_specialist_research: 5,
  primary_brokerage_research: 4,
  transaction_derived_complete_provenance: 3,
  secondary_aggregated: 2,
  unsupported_unknown: 1,
};

const FRESHNESS_WEIGHT: Readonly<Record<string, number>> = {
  live_current: 4,
  recent: 3,
  stale: 2,
  historical: 1,
  unavailable: 1,
};

const COMPARABILITY_WEIGHT: Readonly<Record<E87MatchLevel, number>> = {
  exact: 3,
  close: 2,
  approximate: 1,
  unsupported: 0,
};

/**
 * Additive, explicit, deterministic weight. Additive (not multiplicative) so
 * one weak axis dampens rather than annihilates a candidate's influence —
 * incompatibility itself is handled entirely upstream by Phase 2 and by the
 * cap-rate-family grouping below, never by this weight collapsing to zero.
 */
function computeWeight(tier: E87SourceHierarchyTier, freshness: string | undefined, comparability: E87MatchLevel): number {
  const freshnessWeight = freshness !== undefined ? (FRESHNESS_WEIGHT[freshness] ?? 1) : 1;
  return HIERARCHY_WEIGHT[tier] + freshnessWeight + COMPARABILITY_WEIGHT[comparability];
}

// ---------------------------------------------------------------------------
// Confidence tiers (Part 9 of the Phase 3 doc — two axes, floor only)
// ---------------------------------------------------------------------------

function hierarchyToConfidence(tier: E87SourceHierarchyTier): E87ConfidenceTier {
  switch (tier) {
    case "primary_specialist_research":
      return "high";
    case "primary_brokerage_research":
      return "high";
    case "transaction_derived_complete_provenance":
      return "moderate";
    case "secondary_aggregated":
      return "low";
    case "unsupported_unknown":
      return "very_low";
  }
}

function freshnessToConfidence(freshness: string | undefined): E87ConfidenceTier {
  switch (freshness) {
    case "live_current":
      return "high";
    case "recent":
      return "high";
    case "stale":
      return "moderate";
    case "historical":
      return "low";
    case "unavailable":
      return "very_low";
    default:
      return "moderate"; // not assessed: never assumed current, never assumed worst.
  }
}

function comparabilityToConfidence(level: E87MatchLevel): E87ConfidenceTier {
  switch (level) {
    case "exact":
      return "high";
    case "close":
      return "moderate";
    case "approximate":
      return "low";
    case "unsupported":
      return "very_low";
  }
}

/**
 * Data confidence: the quality of the OBSERVATIONS themselves, taken as the
 * FLOOR across every contributing candidate's own floor (hierarchy /\
 * freshness /\ comparability). Consistent with E86's project-wide rule that
 * dimensions combine by floor, never average — one weak contributing
 * observation legitimately caps how much the underlying evidence can be
 * trusted, even inside an otherwise strong group.
 */
function computeDataConfidence(enriched: E87EnrichedCandidate[]): E87ConfidenceTier {
  let floor: E87ConfidenceTier = "high";
  for (const c of enriched) {
    const candidateFloor = [
      hierarchyToConfidence(c.sourceHierarchyTier),
      freshnessToConfidence(c.freshness),
      comparabilityToConfidence(c.comparability),
    ].reduce(floorConfidence);
    floor = floorConfidence(floor, candidateFloor);
  }
  return floor;
}

function sampleSizeConfidence(n: number): E87ConfidenceTier {
  // PROVISIONAL: a single excellent observation is deliberately NOT downgraded to
  // "low" for being alone (Phase 3 spec: "one excellent observation may be
  // sufficient") — but it is capped below "high" because breadth of evidence is
  // genuinely limited. Calibration of the n>=3 threshold is future work.
  if (n >= 3) return "high";
  return "moderate";
}

function dispersionConfidence(tier: E87DispersionTier): E87ConfidenceTier {
  switch (tier) {
    case "single_observation":
    case "tight":
      return "high";
    case "moderate":
      return "moderate";
    case "material":
      return "low";
    case "severe":
      return "very_low";
  }
}

function sourceIndependenceConfidence(enriched: E87EnrichedCandidate[]): E87ConfidenceTier {
  const distinctSources = new Set(enriched.map((c) => c.candidate.observation.source.sourceId));
  return distinctSources.size >= 2 ? "high" : "moderate";
}

function computeBenchmarkConfidence(enriched: E87EnrichedCandidate[], dispersionTier: E87DispersionTier): E87ConfidenceTier {
  return [
    sampleSizeConfidence(enriched.length),
    dispersionConfidence(dispersionTier),
    sourceIndependenceConfidence(enriched),
  ].reduce(floorConfidence);
}

// ---------------------------------------------------------------------------
// Dispersion (Part 7 of the Phase 3 doc)
// ---------------------------------------------------------------------------

function classifyDispersion(values: number[], policy: DispersionPolicy): { bps: number; tier: E87DispersionTier } {
  if (values.length <= 1) return { bps: 0, tier: "single_observation" };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const bps = Math.round((max - min) * 100 * 100) / 100; // percentage points -> basis points
  if (bps <= policy.tightBps) return { bps, tier: "tight" };
  if (bps <= policy.moderateBps) return { bps, tier: "moderate" };
  if (bps <= policy.materialBps) return { bps, tier: "material" };
  return { bps, tier: "severe" };
}

// ---------------------------------------------------------------------------
// Deterministic ordering / tie-breaking (Part 16 of the Phase 3 doc)
// ---------------------------------------------------------------------------

/**
 * Total order over candidates used wherever a stable, reproducible ordering
 * is needed (audit listing, tie-breaking). Never depends on input array
 * order, object key order, or any non-deterministic source (Date.now, Math.random).
 */
function compareCandidatesDeterministically(a: E87EnrichedCandidate, b: E87EnrichedCandidate): number {
  if (a.weight !== b.weight) return b.weight - a.weight; // higher weight first
  const aId = a.candidate.observation.source.sourceId;
  const bId = b.candidate.observation.source.sourceId;
  if (aId !== bId) return aId < bId ? -1 : 1;
  const aPub = a.candidate.observation.citation.publicationDate;
  const bPub = b.candidate.observation.citation.publicationDate;
  if (aPub !== bPub) return aPub < bPub ? -1 : 1;
  const aTitle = a.candidate.observation.citation.reportTitle;
  const bTitle = b.candidate.observation.citation.reportTitle;
  return aTitle < bTitle ? -1 : aTitle > bTitle ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Audit entries
// ---------------------------------------------------------------------------

function toAuditEntry(enriched: E87EnrichedCandidate, note: string): E87BenchmarkAuditEntry {
  const obs = enriched.candidate.observation;
  return {
    sourceId: obs.source.sourceId,
    sourceName: obs.citation.sourceName,
    capRateType: obs.capRateType,
    representation: enriched.representation,
    scalarValue: enriched.scalarValue,
    sourceHierarchyTier: enriched.sourceHierarchyTier,
    comparability: enriched.comparability,
    freshness: enriched.freshness,
    weight: enriched.weight,
    note,
  };
}

function excludedEntryFromComparability(candidate: E87ComparabilityCandidate): E87BenchmarkAuditEntry {
  const obs = candidate.observation;
  return {
    sourceId: obs.source.sourceId,
    sourceName: obs.citation?.sourceName ?? "(no citation)",
    capRateType: obs.capRateType,
    representation: classifyRepresentation(obs),
    sourceHierarchyTier: sourceHierarchyTier(obs),
    comparability: candidate.comparability,
    note: `Excluded by Phase 2 comparability (${candidate.exclusionReasonCode ?? "OTHER"}): ${candidate.explanation}`,
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

const HIERARCHY_SUMMARY =
  "Tier 1 primary_specialist_research (E86 sourceType 'valuation') > Tier 2 primary_brokerage_research " +
  "('brokerage') > Tier 3 transaction_derived_complete_provenance ('transaction_database' with a complete " +
  "CREDerivedTransaction) > Tier 4 secondary_aggregated ('government'/'construction_cost'/'other', or a " +
  "'transaction_database' lacking complete derivation provenance) > Tier 5 unsupported_unknown " +
  "('user'/'internal'). Affects weighting and confidence ONLY — never overrides Phase 2 comparability.";

/**
 * Build a Phase 3 benchmark from a Phase 2 comparability result. Never
 * throws for an ordinary evidence gap — returns `{status:"data_gap", ...}`.
 * Deterministic: identical `comparability` + `options` always produce an
 * identical result.
 */
export function buildCapRateBenchmark(
  comparability: E87ComparabilityResult,
  options: E87BenchmarkOptions = {},
): E87BenchmarkResult {
  const policy = options.dispersionPolicy ?? DEFAULT_DISPERSION_POLICY;
  const request = comparability.request;
  const narrative: string[] = [];

  const excludedByComparability = comparability.excluded
    .slice()
    .sort((a, b) => a.observation.source.sourceId.localeCompare(b.observation.source.sourceId))
    .map(excludedEntryFromComparability);

  if (comparability.included.length === 0) {
    // Distinguish "nothing comparable" from "everything comparable was too stale" so a
    // caller sees the more precise reason where the evidence supports it.
    const staleCodes = new Set(["STALE", "UNAVAILABLE"]);
    const allStale =
      comparability.excluded.length > 0 && comparability.excluded.every((c) => staleCodes.has(c.exclusionReasonCode ?? ""));
    const reasonCode: E87BenchmarkGapReasonCode = allStale ? "INSUFFICIENT_FRESHNESS" : "NO_COMPARABLE_OBSERVATIONS";
    narrative.push(
      reasonCode === "INSUFFICIENT_FRESHNESS"
        ? "Every candidate that would otherwise be comparable failed the freshness requirement."
        : "No candidate observation was comparable to the requested benchmark identity.",
    );
    const audit: E87BenchmarkAudit = {
      requestedBenchmark: request,
      observationsConsideredCount: comparability.candidates.length,
      excludedByComparability,
      excludedByPhase3: [],
      contributing: [],
      sourceHierarchySummary: HIERARCHY_SUMMARY,
      consensusMethod: "n/a — no eligible candidates",
      dataConfidence: "very_low",
      benchmarkConfidence: "very_low",
      confidence: "very_low",
      dataGapReasonCode: reasonCode,
      narrative,
    };
    return {
      status: "data_gap",
      gap: {
        reasonCode,
        requestedBenchmark: request,
        candidateCount: comparability.candidates.length,
        eligibleCount: 0,
        excludedCount: comparability.excluded.length,
        explanation: narrative[0],
        provenanceReferences: excludedByComparability.map((e) => `${e.sourceName} (${e.sourceId})`),
      },
      audit,
    };
  }

  // Phase 2 does not carry the raw CREPresentationFreshness on the candidate (only the
  // derived freshnessMatch dimension result), so Phase 3 reads freshness back from that
  // dimension's tier rather than re-assessing it — this keeps intact Phase 2's rule that
  // E87 never recomputes freshness itself. "not_constrained" cannot occur here because
  // `evaluateFreshness` always returns a tier (never "not_constrained").
  const dimensionToFreshness: Readonly<Record<string, string>> = {
    exact: "live_current",
    close: "recent",
    approximate: "stale",
    unsupported: "unavailable",
  };

  // Enrich every Phase-2-included candidate with Phase-3-only metadata.
  const enrichedAll: E87EnrichedCandidate[] = comparability.included.map((candidate) => {
    const obs = candidate.observation;
    const representation = classifyRepresentation(obs);
    const scalarValue = extractScalarValue(obs, representation);
    const tier = sourceHierarchyTier(obs);
    const freshnessLevel = candidate.dimensions.freshnessMatch.level;
    const freshness = freshnessLevel === "not_constrained" ? undefined : dimensionToFreshness[freshnessLevel];
    return {
      candidate,
      representation,
      scalarValue,
      sourceHierarchyTier: tier,
      freshness: freshness as E87EnrichedCandidate["freshness"],
      comparability: candidate.comparability,
      weight: 0,
    };
  });

  // Phase-3-only exclusion: representation could not yield a usable scalar.
  const excludedByPhase3: E87BenchmarkAuditEntry[] = [];
  const withScalar = enrichedAll.filter((e) => {
    if (e.scalarValue === undefined) {
      excludedByPhase3.push(toAuditEntry(e, "Excluded by Phase 3: representation did not yield a usable scalar value (UNSUPPORTED_REPRESENTATION)."));
      return false;
    }
    return true;
  });

  if (withScalar.length === 0) {
    const audit: E87BenchmarkAudit = {
      requestedBenchmark: request,
      observationsConsideredCount: comparability.candidates.length,
      excludedByComparability,
      excludedByPhase3,
      contributing: [],
      sourceHierarchySummary: HIERARCHY_SUMMARY,
      consensusMethod: "n/a — no candidate carried a usable scalar representation",
      dataConfidence: "very_low",
      benchmarkConfidence: "very_low",
      confidence: "very_low",
      dataGapReasonCode: "UNSUPPORTED_REPRESENTATION",
      narrative: ["Every comparable candidate's representation could not be reduced to a usable scalar value."],
    };
    return {
      status: "data_gap",
      gap: {
        reasonCode: "UNSUPPORTED_REPRESENTATION",
        requestedBenchmark: request,
        candidateCount: comparability.candidates.length,
        eligibleCount: 0,
        excludedCount: comparability.excluded.length + excludedByPhase3.length,
        explanation: audit.narrative[0],
        provenanceReferences: excludedByPhase3.map((e) => `${e.sourceName} (${e.sourceId})`),
      },
      audit,
    };
  }

  // Cap-rate family / type grouping (Part 4 of the Phase 3 doc). Compatibility is
  // determined by the EXACT capRateType, not merely CAP_RATE_FAMILY, mirroring E86's
  // `assertComparableCapRates` guard in consensus.ts ("cannot mix cap-rate types").
  const byType = new Map<string, E87EnrichedCandidate[]>();
  for (const e of withScalar) {
    const key = e.candidate.observation.capRateType ?? "(unstated)";
    const list = byType.get(key) ?? [];
    list.push(e);
    byType.set(key, list);
  }

  let targetGroup: E87EnrichedCandidate[];
  const droppedGroups: E87EnrichedCandidate[] = [];

  if (request.capRateType !== undefined) {
    targetGroup = byType.get(request.capRateType) ?? [];
    for (const [key, list] of byType) {
      if (key !== request.capRateType) droppedGroups.push(...list);
    }
    for (const e of droppedGroups) {
      excludedByPhase3.push(
        toAuditEntry(
          e,
          `Excluded by Phase 3: capRateType "${e.candidate.observation.capRateType}" is family-adjacent to requested ` +
            `"${request.capRateType}" (same CAP_RATE_FAMILY) but is a different concept — never pooled for consensus ` +
            `(mirrors consensus.ts's assertComparableCapRates).`,
        ),
      );
    }
  } else if (byType.size === 1) {
    targetGroup = [...byType.values()][0];
  } else {
    // Request left capRateType unpinned and more than one distinct concept is present among
    // otherwise-comparable candidates. Phase 3 deliberately refuses to guess which concept
    // the caller meant — this is the documented, conservative "cannot mix cap-rate types
    // without a pin" outcome, not a silent pooling of incompatible families.
    const sortedTypes = [...byType.keys()].sort();
    const conflicting = sortedTypes
      .flatMap((t) => byType.get(t)!)
      .sort(compareCandidatesDeterministically)
      .map((e) => toAuditEntry(e, `Distinct capRateType group "${e.candidate.observation.capRateType}".`));
    const audit: E87BenchmarkAudit = {
      requestedBenchmark: request,
      observationsConsideredCount: comparability.candidates.length,
      excludedByComparability,
      excludedByPhase3,
      contributing: [],
      sourceHierarchySummary: HIERARCHY_SUMMARY,
      consensusMethod: "n/a — multiple incompatible cap-rate-type groups and no pinned capRateType",
      dataConfidence: "very_low",
      benchmarkConfidence: "very_low",
      confidence: "very_low",
      dataGapReasonCode: "INCOMPATIBLE_CAP_RATE_FAMILY",
      narrative: [
        `Comparable candidates span ${byType.size} distinct cap-rate concepts (${sortedTypes.join(", ")}) and the ` +
          "request did not pin one. Phase 3 does not select among incompatible concepts on the caller's behalf.",
      ],
    };
    return {
      status: "data_gap",
      gap: {
        reasonCode: "INCOMPATIBLE_CAP_RATE_FAMILY",
        requestedBenchmark: request,
        candidateCount: comparability.candidates.length,
        eligibleCount: 0,
        excludedCount: comparability.excluded.length,
        conflictingCandidates: conflicting,
        explanation: audit.narrative[0],
        provenanceReferences: conflicting.map((e) => `${e.sourceName} (${e.sourceId})`),
      },
      audit,
    };
  }

  if (targetGroup.length === 0) {
    const audit: E87BenchmarkAudit = {
      requestedBenchmark: request,
      observationsConsideredCount: comparability.candidates.length,
      excludedByComparability,
      excludedByPhase3,
      contributing: [],
      sourceHierarchySummary: HIERARCHY_SUMMARY,
      consensusMethod: "n/a — no candidate matches the requested capRateType exactly",
      dataConfidence: "very_low",
      benchmarkConfidence: "very_low",
      confidence: "very_low",
      dataGapReasonCode: "INCOMPATIBLE_CAP_RATE_FAMILY",
      narrative: [`No comparable candidate carries the exact requested capRateType "${request.capRateType}".`],
    };
    return {
      status: "data_gap",
      gap: {
        reasonCode: "INCOMPATIBLE_CAP_RATE_FAMILY",
        requestedBenchmark: request,
        candidateCount: comparability.candidates.length,
        eligibleCount: 0,
        excludedCount: comparability.excluded.length + excludedByPhase3.length,
        explanation: audit.narrative[0],
        provenanceReferences: [],
      },
      audit,
    };
  }

  // Weight every remaining candidate and sort deterministically.
  for (const e of targetGroup) {
    e.weight = computeWeight(e.sourceHierarchyTier, e.freshness, e.comparability);
  }
  targetGroup.sort(compareCandidatesDeterministically);

  const values = targetGroup.map((e) => e.scalarValue!);
  const dispersionInfo = classifyDispersion(values, policy);
  const dispersion: E87Dispersion = { bps: dispersionInfo.bps, tier: dispersionInfo.tier, policy, values: [...values].sort((a, b) => a - b) };

  const dataConfidence = computeDataConfidence(targetGroup);

  // Severe dispersion: attempt a methodology-preference resolution; otherwise DATA_GAP.
  if (dispersionInfo.tier === "severe") {
    const bestRank = Math.min(...targetGroup.map((e) => SOURCE_HIERARCHY_RANK[e.sourceHierarchyTier]));
    const bestTierCandidates = targetGroup.filter((e) => SOURCE_HIERARCHY_RANK[e.sourceHierarchyTier] === bestRank);

    if (bestTierCandidates.length === 1) {
      // Exactly one candidate is unambiguously the best-ranked source: the disagreement is
      // attributable to methodology quality, not genuine market ambiguity. Use that
      // candidate's own value; never blend it with the disagreeing evidence.
      const chosen = bestTierCandidates[0];
      const contributing = targetGroup.map((e) =>
        toAuditEntry(
          e,
          e === chosen
            ? "Selected: uniquely highest-ranked source hierarchy tier resolves the severe disagreement (methodology preference)."
            : `Not used in the final value (severe disagreement resolved by preferring the higher-ranked source): scalar=${e.scalarValue}.`,
        ),
      );
      const benchmarkConfidence = floorConfidence(computeBenchmarkConfidence(targetGroup, dispersionInfo.tier), "low");
      const confidence = floorConfidence(dataConfidence, benchmarkConfidence);
      const benchmark: E87Benchmark = {
        value: chosen.scalarValue!,
        unit: chosen.candidate.observation.unit,
        capRateType: chosen.candidate.observation.capRateType,
        method: "methodology_preferred",
      };
      const audit: E87BenchmarkAudit = {
        requestedBenchmark: request,
        observationsConsideredCount: comparability.candidates.length,
        excludedByComparability,
        excludedByPhase3,
        contributing,
        sourceHierarchySummary: HIERARCHY_SUMMARY,
        dispersion,
        consensusMethod:
          "methodology_preferred: severe dispersion resolved by selecting the single candidate holding the uniquely " +
          "highest source-hierarchy tier, rather than averaging across a genuine methodological disagreement.",
        dataConfidence,
        benchmarkConfidence,
        confidence,
        finalBenchmarkValue: benchmark.value,
        narrative: [
          `Severe dispersion (${dispersionInfo.bps}bps) resolved via source-hierarchy methodology preference: ` +
            `"${chosen.candidate.observation.citation.sourceName}" is the sole tier-${SOURCE_HIERARCHY_RANK[chosen.sourceHierarchyTier]} source.`,
        ],
      };
      return {
        status: "success",
        benchmark,
        dataConfidence,
        benchmarkConfidence,
        confidence,
        contributingObservations: [chosen.candidate],
        dispersion,
        audit,
      };
    }

    // Multiple candidates tie for the best tier and still disagree severely (the CBRE=5.0 /
    // C&W=7.0 conflict case): no methodological preference is defensible. DATA_GAP.
    const conflicting = targetGroup.map((e) => toAuditEntry(e, `Conflicting value ${e.scalarValue} at source-hierarchy tier ${SOURCE_HIERARCHY_RANK[e.sourceHierarchyTier]}.`));
    const audit: E87BenchmarkAudit = {
      requestedBenchmark: request,
      observationsConsideredCount: comparability.candidates.length,
      excludedByComparability,
      excludedByPhase3,
      contributing: [],
      sourceHierarchySummary: HIERARCHY_SUMMARY,
      dispersion,
      consensusMethod: "n/a — material source disagreement with no defensible methodological preference",
      dataConfidence,
      benchmarkConfidence: "very_low",
      confidence: "very_low",
      dataGapReasonCode: "MATERIAL_SOURCE_DISAGREEMENT",
      narrative: [
        `Comparable, compatible candidates disagree by ${dispersionInfo.bps}bps (severe) and no single source is ` +
          "unambiguously methodologically superior. Averaging would fabricate a number no contributing source stands behind.",
      ],
    };
    return {
      status: "data_gap",
      gap: {
        reasonCode: "MATERIAL_SOURCE_DISAGREEMENT",
        requestedBenchmark: request,
        candidateCount: comparability.candidates.length,
        eligibleCount: targetGroup.length,
        excludedCount: comparability.excluded.length + excludedByPhase3.length,
        conflictingCandidates: conflicting,
        explanation: audit.narrative[0],
        provenanceReferences: conflicting.map((e) => `${e.sourceName} (${e.sourceId})`),
      },
      audit,
    };
  }

  // Tight / moderate / material (resolvable) / single-observation: deterministic weighted
  // consensus. For n=1 this degenerates to that one observation's own value.
  const totalWeight = targetGroup.reduce((sum, e) => sum + e.weight, 0);
  const weightedValue =
    totalWeight === 0
      ? values.reduce((a, b) => a + b, 0) / values.length // defensive fallback; weight is always >=1 per candidate in practice
      : targetGroup.reduce((sum, e) => sum + e.scalarValue! * e.weight, 0) / totalWeight;
  const finalValue = Math.round(weightedValue * 10000) / 10000;

  const benchmarkConfidence = computeBenchmarkConfidence(targetGroup, dispersionInfo.tier);
  const confidence = floorConfidence(dataConfidence, benchmarkConfidence);

  const method: E87Benchmark["method"] = targetGroup.length === 1 ? "single_observation" : "weighted_consensus";
  const consensusMethod =
    targetGroup.length === 1
      ? "single_observation: exactly one eligible, compatible candidate — its own scalar value is the benchmark verbatim (no math performed)."
      : "weighted_consensus: deterministic additive weight per candidate = sourceHierarchyWeight(1-5) + freshnessWeight(1-4) + " +
        "comparabilityWeight(0-3); final value = weight-normalized average of contributing scalar values. Never applied " +
        "across incompatible capRateType groups.";

  const contributing = targetGroup.map((e) => toAuditEntry(e, "Contributed to the weighted consensus."));

  const audit: E87BenchmarkAudit = {
    requestedBenchmark: request,
    observationsConsideredCount: comparability.candidates.length,
    excludedByComparability,
    excludedByPhase3,
    contributing,
    sourceHierarchySummary: HIERARCHY_SUMMARY,
    dispersion,
    consensusMethod,
    dataConfidence,
    benchmarkConfidence,
    confidence,
    finalBenchmarkValue: finalValue,
    narrative: [
      `${targetGroup.length} comparable, compatible (capRateType="${request.capRateType ?? [...byType.keys()][0]}") ` +
        `candidate(s) with ${dispersionInfo.tier} dispersion (${dispersionInfo.bps}bps) produced benchmark ${finalValue} via ${method}.`,
    ],
  };

  return {
    status: "success",
    benchmark: {
      value: finalValue,
      unit: targetGroup[0].candidate.observation.unit,
      capRateType: (request.capRateType ?? targetGroup[0].candidate.observation.capRateType) as CRECapRateType | undefined,
      method,
    },
    dataConfidence,
    benchmarkConfidence,
    confidence,
    contributingObservations: targetGroup.map((e) => e.candidate),
    dispersion,
    audit,
  };
}

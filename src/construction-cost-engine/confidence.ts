/**
 * InvestScape™ E88 Phase 5 — Confidence Model.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Three explicit components, combined ONLY by floor — never averaged, so a
 * high-quality source can never "rescue" an incompatible observation, and a
 * single strong dimension can never paper over a weak one. This mirrors
 * E87's own `floorConfidence`/`E87ConfidenceTier` philosophy (Phase 1 spec
 * Section 16), independently re-implemented here — E88 does not import
 * anything from src/cap-rate-engine/.
 *
 * PROVISIONAL, exactly like E87's own confidence thresholds: the specific
 * sourceQuality/freshness cut points below are a considered first pass, not
 * an empirically calibrated model. Documented here and in
 * docs/E88-phase5-unified-benchmark-output.md.
 */
import type { CREPresentationFreshness } from "../cre-intelligence/ingestion/observation-lifecycle";
import type { CCMatchLevel } from "./comparability-types";
import type { CCIndexRelationship } from "./index-types";
import type { CCConfidenceTier } from "./benchmark-types";

const TIER_RANK: Readonly<Record<CCConfidenceTier, number>> = {
  very_low: 0,
  low: 1,
  moderate: 2,
  high: 3,
};

/** Floor combination: the LOWEST tier among the inputs wins. Never an average. */
export function floorConfidence(...tiers: readonly CCConfidenceTier[]): CCConfidenceTier {
  let worst: CCConfidenceTier = "high";
  for (const t of tiers) {
    if (TIER_RANK[t] < TIER_RANK[worst]) worst = t;
  }
  return worst;
}

/**
 * PROVISIONAL cut points, consistent with `sourceQuality`'s existing 0-100
 * scale (E86 `CREObservation.sourceQuality`, already populated e.g. RLB at
 * 94). Not empirically calibrated against outcome data — a documented first
 * pass, per the same honesty standard E87 applies to its own dispersion
 * thresholds.
 */
export function sourceQualityToTier(sourceQuality: number): CCConfidenceTier {
  if (sourceQuality >= 90) return "high";
  if (sourceQuality >= 75) return "moderate";
  if (sourceQuality >= 50) return "low";
  return "very_low";
}

/**
 * Freshness contributes to DATA confidence, not comparability. "stale" and
 * "historical" are valid facts about their own period (never invalidated —
 * Phase 2's `evaluateFreshness` never excludes on this basis alone) but cap
 * data confidence below high/moderate for a CURRENT benchmark's purposes.
 * `undefined` (freshness not assessed) is never assumed current.
 */
export function freshnessToTier(freshness: CREPresentationFreshness | undefined): CCConfidenceTier {
  switch (freshness) {
    case "live_current":
      return "high";
    case "recent":
      return "moderate";
    case "stale":
      return "low";
    case "historical":
      return "low";
    case "unavailable":
      return "very_low";
    case undefined:
      return "low";
  }
}

/** Comparability confidence is a direct, documented mapping from Phase 2's OWN CCMatchLevel — consumed, never reimplemented or re-derived from raw dimensions. */
export function comparabilityToTier(level: CCMatchLevel): CCConfidenceTier {
  switch (level) {
    case "exact":
      return "high";
    case "close":
      return "moderate";
    case "approximate":
      return "low";
    case "unsupported":
      // Should never be reached: an "unsupported" candidate is always EXCLUDED before
      // reaching the confidence model. Mapped conservatively rather than throwing, in
      // case a future caller passes an excluded candidate here by mistake.
      return "very_low";
  }
}

/**
 * PROVISIONAL single-observation cap: a benchmark backed by exactly one
 * observation is capped at "moderate" even if every other component says
 * "high" — a single figure, however well-sourced, has not been
 * cross-validated by a second independent observation. This reflects
 * "limited evidence" honestly (task instruction) without inventing a
 * numeric confidence PENALTY that would imply false precision; it is a cap,
 * not a subtraction.
 */
export function singleObservationCap(observationCount: number): CCConfidenceTier | undefined {
  return observationCount === 1 ? "moderate" : undefined;
}

/**
 * PROVISIONAL escalation-relationship cap: an INDIRECT index relationship
 * (e.g. a national index standing in for a specific city — Phase 4 Section
 * 5.1) caps confidence at "moderate", never "high", because the escalation
 * input is less specific than the cost observation itself. A DIRECT
 * relationship or an IDENTICAL_PERIOD (no index needed at all) applies no
 * additional cap.
 */
export function escalationRelationshipCap(relationship: CCIndexRelationship | "IDENTICAL_PERIOD" | undefined): CCConfidenceTier | undefined {
  return relationship === "INDIRECT" ? "moderate" : undefined;
}

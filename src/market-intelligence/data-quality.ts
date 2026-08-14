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

import type { ConfidenceLabel, ProvenanceSource } from "@investscape/calc-engine";
import { StatisticalIssue } from "../statistical-risk/types";
import { SourceMetadata } from "./domain";

/**
 * Deliberately NOT its own "high"|"moderate"|"low"|"insufficient" enum —
 * an earlier spec draft suggested that, and the Aug 14 architecture review
 * explicitly superseded it: DataQualityAssessment.label reuses
 * @investscape/calc-engine's real, already-exported ConfidenceLabel
 * ("High"|"Moderate"|"Low"|"Uncertain") instead of inventing a third
 * confidence vocabulary alongside calc-engine's and economic-engine's
 * (see investscape-docs Doc 62 §2.11 for the two that already existed).
 * "Not enough data to assess" is represented as a StatisticalIssue with
 * severity "error" (see NOT_ENOUGH_DATA_ISSUE_CODE below), never as a
 * label value — ConfidenceLabel has no "insufficient" member and none is
 * added here.
 */
export const NOT_ENOUGH_DATA_ISSUE_CODE = "insufficient_data_for_assessment";

export interface DataQualityInputs {
  /** 0..1 — fraction of expected fields/observations actually present. */
  completeness: number;
  /** 0..1 — 1.0 = current, decaying toward 0 as data ages past its category's freshness window. */
  freshness: number;
  /** 0..1 — optional: is the sample size adequate for the claim being made? */
  sampleAdequacy?: number;
  /** 0..1 — optional: how well does the data's geography match the subject's? */
  geographicFit?: number;
  /** 0..1 — optional: how similar is the data's property segment to the subject's? */
  segmentSimilarity?: number;
  /**
   * 0..1 — optional. MUST be supplied externally (by the adapter that
   * knows the actual source), per spec: "never infer reliability from a
   * source's name inside the core engine." This module never looks at
   * SourceMetadata.sourceName/sourceId to guess a number.
   */
  sourceReliability?: number;
}

export interface DataQualityAssessment {
  score: number; // 0..100
  label: ConfidenceLabel;
  components: Record<string, number | undefined>;
  issues: StatisticalIssue[];
}

/**
 * Default component weights for the composite score — configurable
 * (callers may pass their own `weights`) and documented here since the
 * spec requires both: completeness and sourceReliability weighted highest
 * (3) because they most directly bound whether the underlying numbers can
 * be trusted at all; freshness and sampleAdequacy next (2) since stale or
 * thin data degrades reliability without necessarily making the numbers
 * wrong; geographicFit and segmentSimilarity lowest (1) since they're
 * about relevance to the specific comparison being made, not the data's
 * own intrinsic reliability. This weighting is a documented judgment call,
 * not a spec-given formula — override via the `weights` parameter if a
 * different priority is wanted.
 */
export const DEFAULT_DATA_QUALITY_WEIGHTS: Record<keyof DataQualityInputs, number> = {
  completeness: 3,
  freshness: 2,
  sampleAdequacy: 2,
  geographicFit: 1,
  segmentSimilarity: 1,
  sourceReliability: 3,
};

/** score/100 compared against calc-engine E19's own confidenceLabelFor thresholds (0.8/0.5/0.25) — reused rather than re-invented, for consistency across the codebase's two confidence-scoring implementations. */
function labelForScore(score: number): ConfidenceLabel {
  const fraction = score / 100;
  if (fraction >= 0.8) return "High";
  if (fraction >= 0.5) return "Moderate";
  if (fraction >= 0.25) return "Low";
  return "Uncertain";
}

export function assessDataQuality(
  inputs: DataQualityInputs,
  weights: Record<keyof DataQualityInputs, number> = DEFAULT_DATA_QUALITY_WEIGHTS,
): DataQualityAssessment {
  const components: Record<string, number | undefined> = {
    completeness: inputs.completeness,
    freshness: inputs.freshness,
    sampleAdequacy: inputs.sampleAdequacy,
    geographicFit: inputs.geographicFit,
    segmentSimilarity: inputs.segmentSimilarity,
    sourceReliability: inputs.sourceReliability,
  };

  let weightedSum = 0;
  let weightTotal = 0;
  for (const [key, value] of Object.entries(components) as [keyof DataQualityInputs, number | undefined][]) {
    if (value === undefined) continue; // never manufacture a value for a component the caller didn't supply
    weightedSum += value * weights[key];
    weightTotal += weights[key];
  }

  const issues: StatisticalIssue[] = [];
  if (inputs.completeness === 0) {
    issues.push({
      code: NOT_ENOUGH_DATA_ISSUE_CODE,
      severity: "error",
      message: "Completeness is 0 — there is not enough data to meaningfully assess quality.",
    });
  }

  const score = weightTotal > 0 ? Math.round((weightedSum / weightTotal) * 100) : 0;

  return { score, label: labelForScore(score), components, issues };
}

/**
 * Bridges the spec's own SourceMetadata.sourceType vocabulary
 * ("government"|"commercial"|"brokerage"|"user"|"internal"|"other") onto
 * calc-engine's ProvenanceSource ("user_input"|"market_data"|"appraised"|
 * "estimated"|"calculated") — these are two genuinely different enums for
 * a related concept, not the same thing renamed. This mapping exists so
 * callers who want to build a calc-engine-shaped TrackedField/
 * ProvenanceEntry record from a MarketObservation's SourceMetadata have a
 * documented, single place to do that conversion rather than each
 * inventing their own guess.
 */
export function sourceTypeToProvenanceSource(sourceType: SourceMetadata["sourceType"]): ProvenanceSource {
  switch (sourceType) {
    case "government":
    case "commercial":
    case "brokerage":
      return "market_data";
    case "internal":
      return "calculated";
    case "user":
      return "user_input";
    case "other":
      return "estimated";
  }
}

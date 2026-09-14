/**
 * InvestScape™ E85 Phase 6 — Multi-Source Rule-Pack Composition: findings.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Every composition decision is reported, successes included. A composer that
 * emitted findings only on failure would leave a reviewer unable to tell
 * "these instruments agreed" from "only one of them mentioned this at all" —
 * materially different situations that produce identical effective rules.
 *
 * These codes describe WHAT COMPOSITION DID. Where the consequence is a missing
 * or contested answer, the finding carries a real Phase 3 record — an
 * `E85DataGap` or an `E85ManualReviewRecord` — rather than a fourth parallel
 * vocabulary, exactly as Phase 5's normalization findings do.
 */
import type { E85DataGap } from "./data-gap-types";
import type { E85ManualReviewRecord } from "./manual-review-types";
import type { E85RuleConceptKey } from "./rule-concept-identity";
import type { E85RuleFamily } from "./rule-family-types";

export type E85CompositionFindingCode =
  /** Rules from two or more packs regulate different concepts and were combined with no interaction. The ordinary, uneventful case. */
  | "RULES_COMBINED"
  /** Exactly one pack spoke to this concept; it carries through unchanged. */
  | "SINGLE_SOURCE_CONCEPT"
  /** Separate packs stated the SAME value for one concept from genuinely different evidence. Both provenance chains are kept, and the agreement does NOT raise qualification — corroboration is not a confidence multiplier. */
  | "INDEPENDENT_AGREEMENT_PRESERVED"
  /** Byte-identical evidence appeared more than once and was counted once, so a bundle supplied twice cannot masquerade as two authorities. */
  | "DUPLICATE_RULE_COLLAPSED"
  /** An explicitly-stated relation decided a contested concept. Names the relation and both claims. */
  | "PRECEDENCE_RELATION_APPLIED"
  /** One claim was displaced by another under an explicit relation; the displaced claim is preserved in `suppressed`. */
  | "RULE_OVERRIDDEN"
  /** Two or more authoritative claims disagree and no stated relation ranks them. Carries a manual-review record. */
  | "AUTHORITATIVE_CONFLICT_UNRESOLVED"
  /** A contested concept involves at least one claim with no established effective date. Recorded so it is visible that recency was NOT used to break the tie. */
  | "TEMPORAL_RELATION_UNRESOLVED"
  /** A condition-gated rule stayed gated. Composition never affirms a condition on a caller's behalf. */
  | "CONDITIONAL_RULE_PRESERVED"
  /** A caller-affirmed condition admitted a conditional rule into composition. It then competes on equal terms with every other claim. */
  | "CONDITIONAL_RULE_ADMITTED"
  /** A precedence relation was declared but could not be used; carries the reason. The concepts it would have decided fall back to ordinary conflict handling. */
  | "PRECEDENCE_METADATA_REJECTED"
  /** A contributing pack carries a rights/coverage limitation. Reported only — licensing never suppresses a rule. */
  | "SOURCE_READINESS_LIMITATION";

/**
 * How the finding affects the composed pack.
 *  INFO          — composition proceeded; recorded for audit.
 *  WARNING       — proceeded with a caveat a reviewer should see.
 *  GAP           — a concept could not be resolved; `gap` is populated.
 *  MANUAL_REVIEW — evidence exists on both sides and requires judgment; `manualReview` is populated.
 */
export type E85CompositionSeverity = "INFO" | "WARNING" | "GAP" | "MANUAL_REVIEW";

export interface E85CompositionFinding {
  code: E85CompositionFindingCode;
  severity: E85CompositionSeverity;
  /** The regulated concept this finding is about, when it is concept-specific rather than composition-wide. */
  conceptKey?: E85RuleConceptKey;
  /** Family of `conceptKey`, carried so a caller can assess materiality without parsing the key. */
  family?: E85RuleFamily;
  /** Pack ids involved, sorted. */
  packIds?: readonly string[];
  /** Precedence relation ids involved, sorted. */
  relationIds?: readonly string[];
  /** Specific, non-boilerplate explanation. */
  message: string;
  /** Populated when and only when `severity` is "GAP". */
  gap?: E85DataGap;
  /** Populated when and only when `severity` is "MANUAL_REVIEW". */
  manualReview?: E85ManualReviewRecord;
}

/** Whether any finding would stop a caller treating the composed pack as settled. */
export function hasBlockingCompositionFinding(findings: readonly E85CompositionFinding[]): boolean {
  return findings.some((f) => f.severity === "GAP" || f.severity === "MANUAL_REVIEW");
}

/**
 * InvestScape™ E85 Phase 4 — Rule Normalization & Deterministic Evaluation:
 * internal per-output finding shape.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * `E85EvaluationFinding` is an INTERNAL evaluator-pipeline shape, not part of
 * the public `E85Result` union — each family evaluator (use, density,
 * dimensional, parking/amenity, overlay) produces zero or more findings for
 * whatever fields it was asked to resolve, and `result-status.ts` /
 * `evaluator.ts` fold these into the final discriminated `E85Result`. Kept
 * separate from `E85Result` so an individual family evaluator never has to
 * construct a whole (and possibly premature) top-level result itself.
 */
import type { E85RuleFamily } from "./rule-family-types";
import type { E85Qualification } from "./qualification-types";
import type { E85DataGap } from "./data-gap-types";
import type { E85ManualReviewRecord } from "./manual-review-types";
import type { E85Evidence } from "./evidence-types";
import type { E85RegulatoryEnvelope } from "./envelope-types";
import type { E85FindingApplicabilityAudit } from "./rule-applicability-types";

/** One finding's disposition. RESOLVED = safe to surface as a fact. CONDITIONAL_UNRESOLVED = a rule exists but its condition was not affirmed by caller context, so no value is surfaced (not a gap, not a review — simply "not applicable without more information," surfaced only as an optional warning). CONFLICT / GAP / MANUAL_REVIEW drive result status per result-status.ts. NO_RULE_FOR_PROPOSAL_SCOPE (Phase 12B.2) = the source states this concept only for proposals other than this one, every such scope having been PROVEN not to apply; informational only — no evidence is missing, so it is not a gap, and no value is implied (never zero, never unlimited). */
export type E85FindingOutcome = "RESOLVED" | "CONDITIONAL_UNRESOLVED" | "GAP" | "MANUAL_REVIEW" | "NO_RULE_FOR_PROPOSAL_SCOPE";

export interface E85EnvelopeContribution {
  field: keyof E85RegulatoryEnvelope;
  evidence: E85Evidence<number>;
  /** Free-text note documenting how this value was derived, e.g. "FSR (evidence X) x parcel.siteAreaSqm (Y)". Required whenever the value is DERIVED rather than a direct source statement. */
  derivationNote?: string;
}

export interface E85EvaluationFinding {
  family: E85RuleFamily;
  /** Human-readable identifier of what this finding is about, e.g. "usePermission:multi_family_dwelling", "maxFsr", "maxRegulatoryGfaSqm", "setback:front". Free text, not part of any enum — used only for reporting/debugging. */
  field: string;
  outcome: E85FindingOutcome;
  /** Present when `outcome` is RESOLVED or CONDITIONAL_UNRESOLVED and this finding materially contributes to the result's overall qualification. */
  qualification?: E85Qualification;
  gap?: E85DataGap;
  manualReview?: E85ManualReviewRecord;
  /** Non-blocking caveat text to surface if the overall result ends up MACHINE_RESOLVED_WITH_WARNINGS. */
  warning?: string;
  /** When this finding resolves a numeric envelope field, the contribution to fold into the assembled envelope. */
  envelopeContribution?: E85EnvelopeContribution;
  /**
   * The resolved value itself, for findings whose result has no dedicated
   * home on the frozen `E85Result`/`E85RegulatoryEnvelope` contracts (e.g. a
   * use-permission status, a parking ratio, an amenity requirement, an
   * overlay description). `evaluator.ts` surfaces these via the
   * `E85EvaluationOutcome` wrapper it returns alongside the frozen
   * `E85Result` shape — see `evaluator-result-types.ts`.
   */
  resolvedValue?: unknown;
  resolvedEvidence?: E85Evidence<unknown>;
  /** PHASE 12B.2: present when scoped applicability decided or blocked this finding — the canonical scope key(s), the outcome, and the deciding or missing dimensions. Absent for unscoped evidence. */
  applicability?: E85FindingApplicabilityAudit;
}

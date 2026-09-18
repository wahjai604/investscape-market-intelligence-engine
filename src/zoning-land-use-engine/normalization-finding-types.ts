/**
 * InvestScape™ E85 Phase 5 — Source Adapter & Registry Foundation:
 * normalization findings.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Adapter uncertainty is reported, never hidden. Every source fact an adapter
 * touches produces either a normalized rule or a finding explaining why it did
 * not — an adapter that silently drops a fact it does not understand is the
 * specific failure this taxonomy exists to prevent.
 *
 * These codes describe what happened DURING NORMALIZATION. They deliberately
 * do not duplicate the Phase 3 taxonomies: where a finding also means "the
 * resulting rule value is missing", it carries a real `E85DataGap` with an
 * existing `E85DataGapReasonCode`, and where it means "a human must judge
 * this", it carries a real `E85ManualReviewRecord`. The code below says how
 * normalization got there; the attached record says what the downstream
 * consequence is, in the vocabulary the rest of E85 already speaks.
 */
import type { E85DataGap } from "./data-gap-types";
import type { E85ManualReviewRecord } from "./manual-review-types";

export type E85NormalizationFindingCode =
  /** The source term matched an adapter mapping exactly; the value carried through unchanged. */
  | "TERM_MAPPED_EXACT"
  /** The source term was mapped via an explicit, documented jurisdiction policy rather than a literal match (e.g. a percentage converted to a fraction). The policy applied is named in the message and in the value's `interpretationNote`. */
  | "TERM_MAPPED_BY_JURISDICTION_POLICY"
  /** The source attaches a condition to this value; the condition was preserved and the value kept OUT of the unconditional rule set. */
  | "CONDITION_PRESERVED"
  /** The adapter does not recognize this source term or rule concept. Never guessed at, never fuzzy-matched. */
  | "UNSUPPORTED_SOURCE_CONCEPT"
  /** A required numeric/textual value was absent from the fact. Paired with a DATA_GAP; never defaulted to 0. */
  | "MISSING_REQUIRED_VALUE"
  /** The fact is readable two ways and the adapter will not choose. Paired with a manual-review record. */
  | "AMBIGUOUS_SOURCE_INTERPRETATION"
  /** The fact was recognized but could not be expressed in any E85 rule record shape. Paired with a RULE_NOT_STRUCTURED gap. */
  | "RULE_NOT_STRUCTURED"
  /** The extract's version is not a registered consolidation, or no version was stated. */
  | "SOURCE_VERSION_INCOMPLETE"
  /** A section known to exist was not structured by the extract. */
  | "SOURCE_SECTION_UNAVAILABLE"
  /** An identical fact appeared more than once in the extract and was normalized only once, so a repeated read can never masquerade as corroboration. */
  | "DUPLICATE_SOURCE_FACT_IGNORED"
  /** The stated unit is not one this concept accepts (e.g. a height in SPACES), so no conversion was attempted. */
  | "UNIT_UNSUPPORTED_FOR_CONCEPT"
  /** PHASE 12C.2A: an extractor's note (`E85StructuredSourceFact.notes`) was carried forward as an audit-only finding. INFO only — a note never changes whether a fact was normalized or what its outcome was. */
  | "SOURCE_NOTE_PRESERVED";

/**
 * How the finding affects the bundle.
 *  INFO          — normalization succeeded; recorded for audit.
 *  WARNING       — normalization succeeded with a caveat a reviewer should see.
 *  GAP           — a value could not be produced; `gap` is populated.
 *  MANUAL_REVIEW — evidence exists but requires judgment; `manualReview` is populated.
 */
export type E85NormalizationSeverity = "INFO" | "WARNING" | "GAP" | "MANUAL_REVIEW";

export interface E85NormalizationFinding {
  code: E85NormalizationFindingCode;
  severity: E85NormalizationSeverity;
  /** `E85StructuredSourceFact.factId` this finding is about, when it is fact-specific rather than document-wide. */
  factId?: string;
  /** The source's own term, echoed so a reviewer sees what the adapter was looking at without re-reading the extract. */
  sourceTerm?: string;
  /** Specific, non-boilerplate explanation. */
  message: string;
  /** Populated when and only when `severity` is "GAP" — a real Phase 3 gap record, not a parallel one. */
  gap?: E85DataGap;
  /** Populated when and only when `severity` is "MANUAL_REVIEW". */
  manualReview?: E85ManualReviewRecord;
}

/** A source fact the adapter could not turn into a rule, preserved so the bundle accounts for every input rather than quietly shrinking. */
export interface E85UnresolvedSourceItem {
  factId: string;
  /** The source's own term for the concept that went unresolved. */
  sourceTerm: string;
  /** Which finding code explains it — always matches a finding in the same bundle. */
  code: E85NormalizationFindingCode;
  reason: string;
}

/** Convenience predicate used by callers deciding whether a bundle is safe to evaluate without review. */
export function hasBlockingNormalizationFinding(findings: readonly E85NormalizationFinding[]): boolean {
  return findings.some((f) => f.severity === "GAP" || f.severity === "MANUAL_REVIEW");
}

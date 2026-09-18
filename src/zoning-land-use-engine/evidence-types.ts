/**
 * InvestScape™ E85 Phase 3 — Zoning & Land-Use Rules Engine: evidence &
 * temporal/version model.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * A piece of "evidence" is one fact taken from one source with its own
 * provenance and effective-date basis. Rule records (rule-family-types.ts)
 * are built FROM evidence; this file defines the evidence wrapper and the
 * temporal metadata that lets E85 pick the version of a rule that was in
 * force on a given date.
 */
import type { E85Provenance } from "./provenance-types";
import type { E85RuleApplicability } from "./rule-applicability-types";

/**
 * What grounds the effective-date value attached to a rule/evidence
 * record. Municipal by-laws are amended piecemeal; knowing WHY a date was
 * chosen (vs. just having a date) is what lets a reviewer trust it.
 */
export type E85EffectiveDateBasis =
  /** The document/source states its own effective/adoption date explicitly. */
  | "SOURCE_STATED"
  /** Inferred from a consolidation/publication date printed on the document, where the document itself does not state a separate effective date. */
  | "PUBLICATION_DATE_INFERRED"
  /** A council/board resolution or bylaw-amendment date is known and used as the effective date. */
  | "AMENDMENT_DATE_KNOWN"
  /** No effective date could be established at all — always paired with an EFFECTIVE_DATE_UNKNOWN data gap, never defaulted to "now" or any other fabricated date. */
  | "UNKNOWN";

/**
 * Temporal window during which a rule/evidence record is understood to be
 * in force. `effectiveTo` is undefined for a currently-in-force rule; an
 * explicit `effectiveTo` value marks a superseded version, preserved for
 * historical queries rather than deleted (Phase 2's determinism/
 * immutability expectation).
 */
export interface E85TemporalWindow {
  /** ISO 8601 date the rule/evidence took effect. */
  effectiveFrom?: string;
  /** ISO 8601 date the rule/evidence stopped being in force, if superseded. Undefined means "still in force as far as E85 knows." */
  effectiveTo?: string;
  effectiveDateBasis: E85EffectiveDateBasis;
}

/**
 * One fact taken from one source, with full provenance and temporal
 * grounding. Rule-family records (UseRule, DensityRule, etc.) are expected
 * to carry one or more `E85Evidence<T>` items, never a bare value with no
 * evidence trail — this is what lets E85 distinguish "we know this because
 * the by-law says so" from "we are guessing."
 */
export interface E85Evidence<T> {
  value: T;
  provenance: E85Provenance;
  temporal: E85TemporalWindow;
  /**
   * PHASE 12B.2 CONTRACT EXTENSION (optional, additive): which proposals this
   * value governs. An independent axis from `value`, `temporal` and
   * `provenance`. Absent means unscoped, which keeps exactly the meaning every
   * earlier phase gave evidence. See rule-applicability-types.ts.
   */
  applicability?: E85RuleApplicability;
}

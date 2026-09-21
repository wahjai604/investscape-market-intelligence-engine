/**
 * InvestScape™ E85 Phase 3 — Zoning & Land-Use Rules Engine: DATA_GAP
 * taxonomy.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Refined from the Phase 2 draft list. `MANUAL_REVIEW_REQUIRED` is
 * deliberately NOT a member of this enum (Phase 2 correction 2) — that is a
 * separate, disjoint concept in manual-review-types.ts describing abundant
 * evidence that requires professional/legal interpretation, whereas every
 * code below describes evidence that is missing, insufficient, or
 * unresolvable by ordinary means.
 *
 * Changes from the Phase 2 draft list, and why:
 *  - Removed nothing from the draft list; all 13 draft codes are retained
 *    because each describes a genuinely distinct failure mode seen in real
 *    municipal evidence gathering (parcel identification, source discovery,
 *    source structure, classification, geometry, overlay, conflict,
 *    temporal, jurisdiction coverage, site-dimension).
 *  - Split `OVERLAY_DATA_MISSING` (evidence about an overlay's existence or
 *    terms could not be found) from a NEW code `OVERLAY_PRECEDENCE_UNRESOLVED`
 *    moved to manual-review-types.ts, NOT added here — because "we don't
 *    know which of two overlays wins" is not missing evidence, it is a
 *    professional-judgment question, so it belongs to correction 2's
 *    manual-review taxonomy rather than to DATA_GAP.
 *  - Added `RULE_FAMILY_UNSUPPORTED_BY_JURISDICTION` is intentionally NOT
 *    added as a gap — per correction 7, "this jurisdiction has no parking
 *    bylaw concept" is a genuine fact represented by
 *    `E85RuleFamilySupport.NOT_APPLICABLE_TO_JURISDICTION`
 *    (rule-family-types.ts), not a gap in evidence. Only
 *    `SUPPORT_UNDETERMINED` combined with an actual failed lookup would
 *    produce a `RULE_NOT_STRUCTURED` or `BYLAW_NOT_FOUND` gap.
 *  - PHASE 5A SCOPE CLARIFICATION (no code added or removed). Three codes
 *    describe three genuinely different states that an earlier Phase 5 mapping
 *    collapsed, and they are not interchangeable:
 *      `ZONING_NOT_FOUND`   — the parcel's zoning could not be IDENTIFIED.
 *                             A statement about the world. Established
 *                             upstream of normalization, never by it: by the
 *                             time an extract exists it names a zone, so no
 *                             adapter or resolver path may emit this.
 *      `RULE_NOT_STRUCTURED`— the zoning is known and the document exists;
 *                             what is missing is structured rule content for
 *                             it. A statement about E85's coverage. This is
 *                             the honest answer for a real zone with no
 *                             normalizer (Vancouver's CD-1, for instance).
 *      `BYLAW_NOT_FOUND`    — no governing document is registered for this
 *                             jurisdiction/zone at all.
 *    Reporting coverage as non-existence sends a caller to re-establish a fact
 *    they already hold, which is why these stay distinct.
 *  - PHASE 7 ADDITION — `SPATIAL_REFERENCE_MISMATCH`. The only code this phase
 *    adds, and only because nothing existing states the fact honestly. When a
 *    parcel and a regulatory layer declare different coordinate reference
 *    systems and no transform has been performed, E85 refuses the comparison —
 *    but the geometry is emphatically NOT unavailable, so reporting
 *    `GEOMETRY_UNAVAILABLE` would send a caller to re-obtain shapes they are
 *    already holding, the same wrong-errand failure that keeps
 *    `ZONING_NOT_FOUND` and `RULE_NOT_STRUCTURED` distinct above. What is
 *    missing is a stated basis for treating two coordinate systems as
 *    comparable, and the resolution is a transform, not an acquisition.
 *  - Added `SOURCE_LICENSING_RESTRICTED`: a source-readiness axis
 *    (correction 13) may mark a source as legally inaccessible to E85 for a
 *    given request even though the source itself exists and is otherwise
 *    known — that is a distinct, real gap reason not covered by the draft
 *    list ("BYLAW_NOT_FOUND" implies non-existence/undiscovered, not
 *    "found but not licensed for this use").
 */

export type E85DataGapReasonCode =
  | "PARCEL_NOT_IDENTIFIED"
  | "ZONING_NOT_FOUND"
  | "ZONING_AMBIGUOUS"
  | "BYLAW_NOT_FOUND"
  | "BYLAW_VERSION_UNKNOWN"
  | "RULE_NOT_STRUCTURED"
  | "USE_CLASSIFICATION_UNKNOWN"
  | "GEOMETRY_UNAVAILABLE"
  | "OVERLAY_DATA_MISSING"
  | "CONFLICTING_RULES"
  | "EFFECTIVE_DATE_UNKNOWN"
  | "JURISDICTION_UNSUPPORTED"
  | "REQUIRED_SITE_DIMENSION_MISSING"
  | "SOURCE_LICENSING_RESTRICTED"
  | "SPATIAL_REFERENCE_MISMATCH"
  /** PHASE 12B.2: a scoped rule's applicability depends on a proposal fact (dwelling-unit count, building role, or tenure) that the request did not establish. */
  | "PROPOSAL_CONTEXT_MISSING"
  /** PHASE 12B.4: a scoped rule's applicability depends only on an external condition (for example a site-location predicate E85 does not resolve itself) that the request neither affirmed nor denied. Not a missing proposal attribute. */
  | "EXTERNAL_CONDITION_UNDETERMINED"
  /**
   * PHASE 15.16 (Slice 3F-1): the caller EXPLICITLY supplied a `temporalRequest`
   * (CURRENT or AS_OF) on `E85DecisionRequest`, and E85 has not yet wired real
   * temporal source-version selection into decision orchestration. Narrow and
   * deliberate: this code means ONLY "the request was accepted but not applied
   * yet" — it does NOT mean the effective date is unknown, that no candidate
   * source-version exists, that no law existed, that current law could not be
   * determined, that a spatial designation is invalid, that sources conflict, or
   * that a rule family is unsupported. It is never emitted for a legacy
   * `asOfDate`-only request, which continues to mean ordinary fact filtering as
   * before this slice.
   */
  | "TEMPORAL_ANALYSIS_NOT_YET_APPLIED"
  /**
   * PHASE 15.18A (Slice 3F-2): the caller explicitly supplied
   * `temporalLineageEvidence` for a `CURRENT` request, and the existing
   * Slice 2 selector deterministically reported `INSUFFICIENT_TEMPORAL_EVIDENCE`
   * for a `GROUP_READY` lineage because E85 reads no clock and CURRENT has no
   * trusted present-day reference basis. Never emitted for AS_OF requests.
   */
  | "TEMPORAL_CURRENT_REFERENCE_UNAVAILABLE"
  /**
   * PHASE 15.18A (Slice 3F-2): a supplied temporal lineage's grouping outcome
   * (`GROUP_BLOCKED`, `GROUP_EVIDENCE_INCOMPLETE`, or `GROUP_NO_CANDIDATE`)
   * never reached the Slice 2 selector at all, so no source-version candidate
   * could even be considered for this lineage.
   */
  | "TEMPORAL_LINEAGE_NOT_READY"
  /**
   * PHASE 15.18A (Slice 3F-2): the Slice 2 selector identified exactly one
   * applicable source-version candidate for the supplied AS_OF request within
   * the supplied synthetic/injected lineage evidence. This means ONLY that a
   * candidate was identified — it does NOT mean the selected source version
   * controlled rule-pack evaluation, that a parcel's historical zoning
   * designation was proven, or that legal text and parcel designation were
   * temporally aligned. E85 has not yet wired selected-version application
   * into rule-pack evaluation, so this disclosure is retained specifically to
   * prevent a caller from inferring application from selection.
   */
  | "TEMPORAL_CANDIDATE_SELECTED_NOT_APPLIED"
  /** PHASE 15.18A (Slice 3F-2): more than one supplied source-version candidate was applicable to the requested AS_OF date within one lineage and no basis exists to prefer one. */
  | "TEMPORAL_CANDIDATE_AMBIGUOUS"
  /** PHASE 15.18A (Slice 3F-2): no supplied source-version candidate in this lineage was applicable to the requested AS_OF date. */
  | "TEMPORAL_CANDIDATE_INSUFFICIENT_EVIDENCE"
  /** PHASE 15.18A (Slice 3F-2): the requested AS_OF date falls outside every supplied candidate's proven validity interval for this lineage. */
  | "TEMPORAL_CANDIDATE_OUTSIDE_VALIDITY"
  /** PHASE 15.18A (Slice 3F-2): every supplied candidate applicable to this lineage does not yet take effect as of the requested AS_OF date. */
  | "TEMPORAL_CANDIDATE_FUTURE_EFFECTIVE"
  /** PHASE 15.18A (Slice 3F-2): every supplied candidate applicable to this lineage had already been superseded as of the requested AS_OF date. */
  | "TEMPORAL_CANDIDATE_SUPERSEDED";

export const E85_DATA_GAP_REASON_LABELS: Readonly<Record<E85DataGapReasonCode, string>> = {
  PARCEL_NOT_IDENTIFIED: "The parcel/site could not be identified from the information supplied.",
  ZONING_NOT_FOUND: "No zoning designation could be found for this parcel.",
  ZONING_AMBIGUOUS: "More than one zoning designation was found for this parcel and could not be resolved to one.",
  BYLAW_NOT_FOUND: "No governing by-law/ordinance document could be found for this jurisdiction and zone.",
  BYLAW_VERSION_UNKNOWN: "A governing document was found but its version/consolidation date could not be established.",
  RULE_NOT_STRUCTURED: "The governing document exists but its rule content could not be resolved into a structured rule record.",
  USE_CLASSIFICATION_UNKNOWN: "The requested land use could not be matched to any use category recognized by the governing document.",
  GEOMETRY_UNAVAILABLE: "Geometry needed to resolve this determination was not available. (Rule-Only Mode: expected to be rare/never required for v1 scope.)",
  OVERLAY_DATA_MISSING: "An overlay applicable to this parcel is known or suspected to exist, but its terms could not be found.",
  CONFLICTING_RULES: "Two or more sources state contradictory rule values and no basis exists to prefer one over the other.",
  EFFECTIVE_DATE_UNKNOWN: "No effective date could be established for the applicable rule/evidence.",
  JURISDICTION_UNSUPPORTED: "This jurisdiction is not yet covered by any E85 source.",
  REQUIRED_SITE_DIMENSION_MISSING: "A site dimension required to evaluate this rule was not supplied and could not be resolved from other evidence.",
  SOURCE_LICENSING_RESTRICTED: "A source that would answer this request is known to exist but is not licensed/accessible for this use.",
  SPATIAL_REFERENCE_MISMATCH: "Geometries that needed to be compared declare different coordinate reference systems, and no transform between them has been performed.",
  PROPOSAL_CONTEXT_MISSING: "A rule's applicability depends on a fact about the proposal that was not supplied, so whether the rule governs this proposal could not be determined.",
  EXTERNAL_CONDITION_UNDETERMINED: "A rule's applicability depends on an external condition that was neither affirmed nor denied for this request, so whether the rule governs this proposal could not be determined.",
  TEMPORAL_ANALYSIS_NOT_YET_APPLIED: "The caller explicitly requested a temporal analysis (CURRENT or AS_OF), and this request was accepted but not yet applied: E85 has not yet wired real temporal source-version selection into decision orchestration.",
  TEMPORAL_CURRENT_REFERENCE_UNAVAILABLE: "A CURRENT temporal request was evaluated against supplied lineage evidence, but E85 has no trusted present-day reference basis (no clock is read), so no candidate could be treated as currently in force.",
  TEMPORAL_LINEAGE_NOT_READY: "The supplied temporal lineage evidence for this lineage was not structurally ready for source-version selection (blocked, incomplete, or without any candidate), so no source-version could be considered.",
  TEMPORAL_CANDIDATE_SELECTED_NOT_APPLIED: "A source-version candidate was identified as applicable to the requested date within the supplied lineage evidence, but the selected version was NOT applied to rule-pack evaluation: E85 has not yet wired selected-version application into decision orchestration.",
  TEMPORAL_CANDIDATE_AMBIGUOUS: "More than one supplied source-version candidate in this lineage was applicable to the requested date and no basis exists to prefer one.",
  TEMPORAL_CANDIDATE_INSUFFICIENT_EVIDENCE: "No supplied source-version candidate in this lineage was applicable to the requested date.",
  TEMPORAL_CANDIDATE_OUTSIDE_VALIDITY: "The requested date falls outside every supplied source-version candidate's proven validity interval for this lineage.",
  TEMPORAL_CANDIDATE_FUTURE_EFFECTIVE: "Every supplied source-version candidate applicable to this lineage does not yet take effect as of the requested date.",
  TEMPORAL_CANDIDATE_SUPERSEDED: "Every supplied source-version candidate applicable to this lineage had already been superseded as of the requested date.",
};

/**
 * Hard invariant (Phase 2 correction 10): a gap record NEVER carries a
 * fabricated numeric value. This type intentionally has no field for one —
 * only the reason, an explanation, and what was checked. Any numeric
 * envelope/rule field that could not be resolved must be left
 * undefined/null at its own type and paired with one of these records,
 * never defaulted to 0, unlimited, or any other sentinel number.
 */
export interface E85DataGap {
  reasonCode: E85DataGapReasonCode;
  /** Free-text explanation of the source fact behind the gap — never an intention ("we haven't gotten to this yet"). */
  reason: string;
  /** Source IDs actually checked before concluding the gap. */
  sourcesChecked: readonly string[];
  checkedAt: string;
  /** What would resolve this gap, only when genuinely true. */
  resolutionHint?: string;
}

export function formatE85DataGapMessage(gap: Pick<E85DataGap, "reasonCode" | "reason" | "resolutionHint">): string {
  const label = E85_DATA_GAP_REASON_LABELS[gap.reasonCode];
  const hint = gap.resolutionHint ? ` ${gap.resolutionHint}` : "";
  return `${label} ${gap.reason}${hint}`;
}

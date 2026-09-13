/**
 * InvestScape™ E85 Phase 3 — Zoning & Land-Use Rules Engine: manual-review
 * taxonomy.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Phase 3B primary-source correction: `DISCRETIONARY_USE_DETERMINATION` was
 * removed (was present through Phase 3A). Direct review of the City of
 * Vancouver R1-1 District Schedule (June 2026 consolidation) confirms
 * Vancouver's current by-law vocabulary is "Outright Approval Use" /
 * "Conditional Approval Use" only — a conditional-approval use is one the
 * Director of Planning "may approve... with or without conditions" after
 * considering the schedule's intent and Council policy. There is no
 * separate legally-distinct "discretionary" use category in the primary
 * text; "discretionary" is descriptive language for the same
 * professional-judgment call already covered by
 * `PROFESSIONAL_INTERPRETATION_REQUIRED` below. Retaining both reason codes
 * would have created two reason codes for the same underlying fact
 * (redundant per the "smallest non-redundant stable taxonomy" rule), so the
 * redundant, jurisdiction-flavored code was removed rather than kept for
 * historical continuity.
 *
 * Disjoint from `E85DataGapReasonCode` by design (Phase 2 correction 2):
 * every reason below describes a situation where E85 has ABUNDANT evidence
 * but that evidence requires professional/legal interpretation a machine
 * should not perform unsupervised — the opposite failure mode from
 * DATA_GAP, where evidence is missing/insufficient/unresolvable. A result
 * must never carry both a data-gap reason and a manual-review reason for
 * the same underlying fact; if evidence is missing, use DATA_GAP, and only
 * once real evidence exists but conflicts/requires judgment does
 * MANUAL_REVIEW_REQUIRED apply.
 */

export type E85ManualReviewReasonCode =
  /** Two or more authoritative sources conflict and a plausible reading exists for each, unlike CONFLICTING_RULES' data-gap cousin which applies when no basis exists to prefer either — here a human can plausibly adjudicate using context E85 does not have. */
  | "CONFLICTING_AUTHORITATIVE_SOURCES"
  /** The parcel is governed by a site-specific/comprehensive-development zoning instrument (e.g. Vancouver's "CD-1" designation, or an equivalent negotiated/custom zoning concept in another jurisdiction) whose terms were custom-negotiated and cannot be safely generalized from the standard district-schedule pattern. The jurisdiction-specific label itself (e.g. "CD-1 (245)") belongs on `E85Provenance.zoneDesignation` / `E85ParcelReference.rawZoningDesignation`, never on this generic reason code. */
  | "SITE_SPECIFIC_ZONING"
  /** The parcel's boundary or zone-designation match is ambiguous (e.g. it straddles two zones, or geocoding matched more than one plausible zone) and the specific match materially affects the result. */
  | "AMBIGUOUS_PARCEL_ZONE_MATCH"
  /** Two or more overlays apply to the parcel and their relative precedence is not stated by any source found — evidence about each overlay exists, but which one controls is unresolved. */
  | "OVERLAY_PRECEDENCE_UNRESOLVED"
  /** The parcel or use may hold legal non-conforming status (a pre-existing use/structure that predates a rule change and is grandfathered), which requires case-specific legal analysis to confirm. */
  | "LEGAL_NON_CONFORMING_STATUS"
  /** A rezoning application is known to be pending for this parcel, meaning the currently-in-force rule may not reflect the parcel's near-term regulatory status. */
  | "PENDING_REZONING"
  /** The parcel is subject to a heritage agreement, heritage revitalization agreement, or similar negotiated instrument that modifies otherwise-applicable rules. */
  | "HERITAGE_AGREEMENT_APPLIES"
  /** Applying the resolved rule to this parcel requires a professional judgment call not covered by any other reason code above (a deliberate catch-all, used sparingly and always paired with an explanatory note). */
  | "PROFESSIONAL_INTERPRETATION_REQUIRED";

export const E85_MANUAL_REVIEW_REASON_LABELS: Readonly<Record<E85ManualReviewReasonCode, string>> = {
  CONFLICTING_AUTHORITATIVE_SOURCES: "Two or more authoritative sources conflict and a plausible reading exists for each.",
  SITE_SPECIFIC_ZONING: "The parcel is governed by a site-specific/comprehensive-development zoning instrument whose custom terms cannot be safely generalized.",
  AMBIGUOUS_PARCEL_ZONE_MATCH: "The parcel's match to a specific zone/boundary is ambiguous and materially affects the result.",
  OVERLAY_PRECEDENCE_UNRESOLVED: "Multiple overlays apply and their relative precedence is not stated by any source found.",
  LEGAL_NON_CONFORMING_STATUS: "The parcel or use may hold legal non-conforming status requiring case-specific legal analysis.",
  PENDING_REZONING: "A rezoning application is known to be pending for this parcel.",
  HERITAGE_AGREEMENT_APPLIES: "The parcel is subject to a heritage agreement or similar negotiated instrument.",
  PROFESSIONAL_INTERPRETATION_REQUIRED: "Applying the resolved rule to this parcel requires professional judgment not covered by another reason code.",
};

export interface E85ManualReviewRecord {
  reasonCode: E85ManualReviewReasonCode;
  /** Free-text explanation of the specific situation triggering review — never generic boilerplate. */
  explanation: string;
  /** Source IDs / evidence items considered in reaching this determination (evidence EXISTS here, unlike a DATA_GAP). */
  evidenceConsidered: readonly string[];
  flaggedAt: string;
}

export function formatE85ManualReviewMessage(record: Pick<E85ManualReviewRecord, "reasonCode" | "explanation">): string {
  const label = E85_MANUAL_REVIEW_REASON_LABELS[record.reasonCode];
  return `${label} ${record.explanation}`;
}

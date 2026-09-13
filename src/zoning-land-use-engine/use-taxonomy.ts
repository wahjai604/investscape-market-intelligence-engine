/**
 * InvestScape™ E85 Phase 3 — Zoning & Land-Use Rules Engine: use-permission
 * taxonomy.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Pilot-validated against City of Vancouver Zoning and Development By-law
 * terminology (Phase 3 Vancouver pilot — see Phase 3 report Section 3/4/9;
 * re-confirmed in Phase 3B directly against the R1-1 District Schedule PDF,
 * City of Vancouver, June 2026 consolidation, Section 2.1 "Outright and
 * Conditional Approval Uses").
 * CONFIRMED FROM DIRECT OFFICIAL PRIMARY SOURCE (Phase 3B — R1-1 District
 * Schedule, Section 2.1, read directly from the local offline PDF, not a
 * search result): "The uses identified in the table below as outright
 * approval uses are permitted in this district and will be issued a
 * permit," and "The uses identified in the table below as conditional
 * approval uses may be approved in this district by the Director of
 * Planning, with or without conditions..." Uses absent from the district
 * schedule's use table are not addressed by an approval path at all in
 * that table — an E85 evaluator would need to affirmatively check the
 * by-law's general provisions before treating such an absence as
 * PROHIBITED rather than UNKNOWN (see PROHIBITED vs UNKNOWN discussion in
 * data-gap-types.ts / the Phase 3B report). There is no separate,
 * legally-distinct "Discretionary Use" category in the current by-law text
 * — "Conditional Approval Use" is the operative term (see
 * manual-review-types.ts for the resulting Phase 3B taxonomy correction).
 * E85's four-value normalized status below is deliberately
 * generic (not Vancouver-specific vocabulary) so other jurisdictions'
 * equivalent concepts (e.g. "Permitted," "Special Exception," "Conditional
 * Use Permit," "As-of-Right") normalize onto the same four values, while
 * the exact source wording is always preserved alongside it.
 */

/**
 * Normalized, jurisdiction-independent use-permission status. Four values,
 * not three: "unknown" is never collapsed into "prohibited" (Phase 2
 * correction 8) — a use E85 has not yet resolved evidence for is a
 * different fact than a use the source document affirmatively excludes.
 */
export type E85UsePermissionStatus =
  /** Permitted outright, without discretionary approval (Vancouver: "Outright Approval Use"). */
  | "PERMITTED"
  /** May be permitted subject to discretionary approval by a named authority, with or without conditions (Vancouver's current term: "Conditional Approval Use"; historically also called "Discretionary Use"). */
  | "CONDITIONAL"
  /** Affirmatively excluded by the source — the use is not permitted in this district under any approval path found in the evidence. */
  | "PROHIBITED"
  /** No evidence yet resolves this use's status for this district/parcel. Distinct from PROHIBITED; must not be treated as either PERMITTED or PROHIBITED by any downstream consumer. */
  | "UNKNOWN";

/**
 * One use-permission determination for one land use in one district,
 * preserving BOTH the normalized status and the exact source wording
 * (Phase 2 correction 8) — the raw string is never discarded even after
 * normalization, since professional/legal review may depend on the
 * source's own phrasing (e.g. distinguishing "Conditional Approval Use"
 * from a jurisdiction that instead says "Special Exception").
 */
export interface E85UsePermission {
  /** The land use being classified, in E85's own use vocabulary (not defined further at Phase 3 — a taxonomy of land-use categories themselves is out of scope for this phase's types work and belongs to rule-evaluation logic in a later phase). */
  useCode: string;
  status: E85UsePermissionStatus;
  /** Exact wording found at the source for this use's status, e.g. "Conditional Approval Use", never paraphrased. */
  rawSourceTerminology?: string;
  /** Name of the authority that grants approval, when `status` is "CONDITIONAL" — e.g. "Director of Planning", "Development Permit Board". */
  approvalAuthority?: string;
  /** Free-text conditions attached to a CONDITIONAL determination, verbatim or closely paraphrased from source; never a computed/derived judgment about whether conditions would be met for a specific parcel. */
  conditionsNote?: string;
}

/**
 * InvestScape™ E85 Phase 12B.4 — regulatory requirements: generic contract.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * A REGULATORY REQUIREMENT is a binding obligation a legal instrument imposes on
 * a development that is otherwise entitled — for example "provide a share of the
 * floor area as a particular kind of housing", or "make a payment instead". It
 * is not a use permission, not a density or dimensional limit, not parking, and
 * not an amenity requirement (`E85AmenityRule` keeps its own meaning unchanged).
 *
 * THE FOUR AXES STAY SEPARATE:
 *  - the obligation itself is the evidence VALUE (`E85RegulatoryRequirement`);
 *  - which proposals trigger it is the evidence's `applicability` (Phase 12B.2),
 *    never a field of the obligation;
 *  - when it was in force is the evidence's `temporal` window;
 *  - why E85 believes it is the evidence's `provenance`.
 * Each alternative of a legal choice, and each stated quantity, is its own
 * evidence item, so each can be sourced and dated independently.
 *
 * DELIBERATELY SMALL. Every enum below holds only what current authoritative
 * evidence requires; extending one is an additive contract change made when a
 * source needs it, not in anticipation. In particular there is NO field for who
 * elects between alternatives: a source that is silent on that question must
 * not acquire an answer through a default.
 *
 * NO VALUATION. E85 records what the instrument states. It never multiplies a
 * stated fraction by a project's floor area, never prices an obligation, and
 * never computes a payment — those belong to downstream engines.
 */
import type { E85Evidence } from "./evidence-types";
import type { E85DocumentLocator } from "./provenance-types";
import type { E85DataGap } from "./data-gap-types";
import type { E85FindingApplicabilityAudit } from "./rule-applicability-types";

/** Generic category of obligation. Jurisdiction-neutral; the source's own name for the obligation lives in `requirementCode` and `rawSourceTerminology`. */
export type E85RequirementCategory = "AFFORDABLE_HOUSING";

/** What the obligation requires the developer to do. */
export type E85ObligationKind =
  /** Deliver something within the development (e.g. a share of floor area of a specified kind). */
  | "PROVIDE"
  /** Pay money instead of providing something the instrument otherwise requires. */
  | "PAYMENT_IN_LIEU";

/** How alternatives in one choice group relate. Only what current evidence requires. */
export type E85RequirementChoiceMode =
  /** Exactly one alternative in the group satisfies the obligation. */
  "ONE_OF";

/** Membership of an obligation in a legal choice. Requirements with no choice are cumulative. */
export interface E85RequirementChoice {
  /** Normalized, adapter-supplied id shared by every alternative of one choice. Opaque to the engine. */
  choiceGroupId: string;
  mode: E85RequirementChoiceMode;
}

/** What a reference to another instrument supplies for this obligation. */
export type E85RequirementReferenceRole =
  /** The referenced instrument states how much is owed (a rate, a formula, a schedule). While unstructured, the obligation's quantity is unresolved. */
  | "QUANTIFICATION"
  /** The referenced instrument states further terms of the obligation (who may own it, how it is secured, for how long) but not its quantity. */
  | "TERMS";

/** A pointer to another instrument (or another part of one) that this obligation depends on. */
export interface E85RequirementInstrumentReference {
  role: E85RequirementReferenceRole;
  /** Where the referenced content is. */
  target: E85DocumentLocator;
  /** Short description of the referenced content, e.g. "cash-in-lieu rate table". Never the content itself. */
  description: string;
  /** Whether the referenced content has been normalized into E85 evidence. False means it is known to exist and NOT structured. */
  structured: boolean;
}

/** The obligation, as the evidence value. */
export interface E85RegulatoryRequirement {
  category: E85RequirementCategory;
  /** Normalized, adapter-supplied code distinguishing this obligation from every other in its category. Opaque to the engine. */
  requirementCode: string;
  obligationKind: E85ObligationKind;
  /** The source's own wording for the obligation, preserved verbatim or as a short label. */
  rawSourceTerminology: string;
  choice?: E85RequirementChoice;
  instrumentReferences?: readonly E85RequirementInstrumentReference[];
}

/** Kind of machine-readable quantity. Only what current evidence requires. */
export type E85RequirementQuantityKind =
  /** A minimum fraction (0..1) of a floor-area basis the source names. */
  "MIN_FRACTION_OF_FLOOR_AREA";

/** A quantity the source states for an obligation, as the evidence value. A bare legal fact — never applied to any project figure. */
export interface E85RequirementQuantity {
  kind: E85RequirementQuantityKind;
  value: number;
  /** The quantity's basis in the source's own words, e.g. "residential floor area". */
  basisTerm: string;
}

/** One obligation plus the quantities stated for it. Quantities must carry the same applicability scope as the obligation. */
export interface E85RequirementItem {
  requirement: E85Evidence<E85RegulatoryRequirement>;
  quantities?: readonly E85Evidence<E85RequirementQuantity>[];
}

/** Phase 4 disposition of one obligation for one proposal. Obligations proven not to apply are reported only as audit findings, not here. */
export type E85RequirementStatus =
  /** Triggered, and every quantity it depends on is structured. */
  | "APPLICABLE_STRUCTURED"
  /** Triggered, but its quantity is not stated in structured form, or depends on an instrument not yet structured. Paired with a DATA_GAP. */
  | "APPLICABLE_QUANTIFICATION_UNRESOLVED"
  /** Whether it is triggered could not be decided from the request. Paired with a DATA_GAP. */
  | "APPLICABILITY_UNDETERMINED";

/** One obligation as returned to a caller, discoverable without reading any finding text. */
export interface E85RequirementOutcome {
  /** Unscoped concept key of the obligation, e.g. "REQUIREMENT:obligation[<category>:<code>]". */
  conceptKey: string;
  category: E85RequirementCategory;
  requirementCode: string;
  status: E85RequirementStatus;
  /** The obligation, present when the evidence governing this proposal agrees on it. */
  requirement?: E85RegulatoryRequirement;
  /** Structured quantities governing this proposal, each with its own evidence. Never multiplied by any project figure. */
  quantities: readonly E85Evidence<E85RequirementQuantity>[];
  /** The obligation evidence behind this entry (provenance, temporal basis, applicability). */
  evidence: readonly E85Evidence<E85RegulatoryRequirement>[];
  applicability?: E85FindingApplicabilityAudit;
  /** Present for the two unresolved statuses. */
  gap?: E85DataGap;
}

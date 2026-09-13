/**
 * InvestScape™ E85 Phase 5 — Vancouver R1-1 pilot: source-terminology policy.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * EVERY piece of Vancouver vocabulary in E85 lives in this file and its
 * sibling adapter. "R1-1", "Outright Approval Use", "Conditional Approval
 * Use" and "Director of Planning" are City of Vancouver terms, and none of
 * them appears in a core E85 enum — core stays PERMITTED / CONDITIONAL /
 * PROHIBITED / UNKNOWN (use-taxonomy.ts) and this module is the only thing
 * that knows how Vancouver's words land on those four values.
 *
 * The mappings are drawn from terminology confirmed against the City of
 * Vancouver R1-1 District Schedule during the Phase 3B primary-source review
 * (the same reading that produced the Phase 3B corrections in
 * use-taxonomy.ts and manual-review-types.ts). Only short terminology labels
 * and section locators are reproduced here — no regulatory prose.
 *
 * ABSENCE IS NOT PROHIBITION. There is deliberately no mapping from "use not
 * found in the schedule's table" to PROHIBITED. Vancouver's schedule tables
 * state approval paths for the uses they list; a use absent from the table is
 * not thereby excluded by that table, and treating it as excluded would need
 * an affirmative reading of the by-law's general provisions that this pilot
 * does not perform. Absence therefore produces no permission fact at all, and
 * Phase 4's own absence-is-UNKNOWN invariant does the rest.
 */
import type { E85UsePermissionStatus } from "../../use-taxonomy";
import type { E85SourceUnit } from "../../source-fact-types";

/** Vancouver's two approval-path terms, mapped onto E85's generic statuses. Nothing maps to PROHIBITED or UNKNOWN: neither is a term the schedule's use table uses. */
const VANCOUVER_USE_STATUS_TERMS: Readonly<Record<string, E85UsePermissionStatus>> = {
  "Outright Approval Use": "PERMITTED",
  "Conditional Approval Use": "CONDITIONAL",
};

/**
 * The authority named by the schedule as granting conditional approvals.
 * Attached to CONDITIONAL permissions so a reviewer sees who decides, and
 * never used to imply that approval would in fact be granted.
 */
export const VANCOUVER_CONDITIONAL_APPROVAL_AUTHORITY = "Director of Planning";

/** Which normalized rule field a Vancouver source term lands on, and which units that field will accept. */
export type E85VancouverConceptMapping =
  | { family: "DENSITY"; field: "maxFsr"; acceptedUnits: readonly E85SourceUnit[] }
  | { family: "DIMENSIONAL"; field: "maxHeightMetres"; acceptedUnits: readonly E85SourceUnit[] }
  | { family: "DIMENSIONAL"; field: "maxStoreys"; acceptedUnits: readonly E85SourceUnit[] }
  | { family: "DIMENSIONAL"; field: "maxSiteCoverageFraction"; acceptedUnits: readonly E85SourceUnit[] }
  | { family: "DIMENSIONAL"; field: "minFrontageMetres"; acceptedUnits: readonly E85SourceUnit[] }
  | { family: "DIMENSIONAL"; field: "setback"; yardName: string; acceptedUnits: readonly E85SourceUnit[] };

/**
 * Vancouver terminology → normalized concept. Exact, case-sensitive lookup:
 * an unrecognized term is reported as UNSUPPORTED_SOURCE_CONCEPT rather than
 * stemmed, lower-cased, or fuzzily matched toward a neighbour, because a term
 * this table has not been reviewed against is one nobody has confirmed the
 * meaning of.
 *
 * Yard names are preserved as the source names them ("front", "side", "rear")
 * and become keys in `E85DimensionalRule.setbacksMetres`, whose contract
 * already specifies source-named keys.
 */
const VANCOUVER_CONCEPT_TERMS: Readonly<Record<string, E85VancouverConceptMapping>> = {
  "Floor Space Ratio": { family: "DENSITY", field: "maxFsr", acceptedUnits: ["RATIO"] },
  Height: { family: "DIMENSIONAL", field: "maxHeightMetres", acceptedUnits: ["METRES"] },
  Storeys: { family: "DIMENSIONAL", field: "maxStoreys", acceptedUnits: ["STOREYS"] },
  "Site Coverage": { family: "DIMENSIONAL", field: "maxSiteCoverageFraction", acceptedUnits: ["FRACTION", "PERCENT"] },
  Frontage: { family: "DIMENSIONAL", field: "minFrontageMetres", acceptedUnits: ["METRES"] },
  "Front Yard": { family: "DIMENSIONAL", field: "setback", yardName: "front", acceptedUnits: ["METRES"] },
  "Side Yard": { family: "DIMENSIONAL", field: "setback", yardName: "side", acceptedUnits: ["METRES"] },
  "Rear Yard": { family: "DIMENSIONAL", field: "setback", yardName: "rear", acceptedUnits: ["METRES"] },
};

/** Exact lookup of a Vancouver approval-path term. Undefined means "this adapter has no reviewed mapping for that term", never "prohibited". */
export function mapVancouverUseStatus(sourceTerm: string): E85UsePermissionStatus | undefined {
  return Object.prototype.hasOwnProperty.call(VANCOUVER_USE_STATUS_TERMS, sourceTerm) ? VANCOUVER_USE_STATUS_TERMS[sourceTerm] : undefined;
}

/** Exact lookup of a Vancouver regulated-concept term. */
export function mapVancouverConcept(sourceTerm: string): E85VancouverConceptMapping | undefined {
  return Object.prototype.hasOwnProperty.call(VANCOUVER_CONCEPT_TERMS, sourceTerm) ? VANCOUVER_CONCEPT_TERMS[sourceTerm] : undefined;
}

/**
 * Vancouver's names for land uses → E85 use codes.
 *
 * A VOCABULARY MAP ONLY. It asserts nothing whatsoever about whether any use
 * is outright, conditional, or excluded in R1-1 or any other district — a
 * use's approval status comes solely from the extracted fact that states it,
 * never from this table's membership. Being listed here means only "E85 has a
 * code for what Vancouver calls this", so that a caller can ask about a use in
 * a stable vocabulary instead of re-typing the by-law's wording.
 */
const VANCOUVER_USE_CODE_TERMS: Readonly<Record<string, string>> = {
  "One-Family Dwelling": "one_family_dwelling",
  "Multiple Dwelling": "multiple_dwelling",
  "Laneway House": "laneway_house",
  "Home Occupation": "home_occupation",
  "Child Day Care Facility": "child_day_care_facility",
};

/** Exact lookup of a Vancouver land-use name. Undefined means this adapter has no reviewed code for that use — reported as a finding, never guessed at. */
export function mapVancouverUseCode(sourceUseTerm: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(VANCOUVER_USE_CODE_TERMS, sourceUseTerm) ? VANCOUVER_USE_CODE_TERMS[sourceUseTerm] : undefined;
}

/** Every land-use name this adapter can map, for diagnostics and tests. */
export function vancouverKnownUseTerms(): readonly string[] {
  return Object.keys(VANCOUVER_USE_CODE_TERMS).sort();
}

/** Every approval-path term this adapter recognizes, for diagnostics and tests. */
export function vancouverKnownUseStatusTerms(): readonly string[] {
  return Object.keys(VANCOUVER_USE_STATUS_TERMS).sort();
}

/** Every regulated-concept term this adapter recognizes, for diagnostics and tests. */
export function vancouverKnownConceptTerms(): readonly string[] {
  return Object.keys(VANCOUVER_CONCEPT_TERMS).sort();
}

/**
 * Converts a stated value to the unit the normalized field expects.
 *
 * The only conversion performed is PERCENT → FRACTION for site coverage, and
 * it is reported as an explicit jurisdiction-policy mapping rather than done
 * silently, because "50" and "0.5" are the same regulation written two ways
 * and a reader of the normalized output deserves to know which one the
 * document actually printed. Any other unit/field combination is refused
 * rather than coerced.
 */
export function convertVancouverUnit(mapping: E85VancouverConceptMapping, value: number, unit: E85SourceUnit): { ok: true; value: number; policyApplied?: string } | { ok: false } {
  if (!mapping.acceptedUnits.includes(unit)) return { ok: false };
  if (mapping.family === "DIMENSIONAL" && mapping.field === "maxSiteCoverageFraction" && unit === "PERCENT") {
    return { ok: true, value: value / 100, policyApplied: "Site coverage stated as a percentage was divided by 100 to produce the fraction that E85RegulatoryEnvelope.maxSiteCoverageFraction is defined in." };
  }
  return { ok: true, value };
}

/**
 * InvestScape™ E85 Phase 14.4B — Vancouver C-2C pilot: source-terminology policy.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Follows the exact convention `r1-1-terminology.ts` established: every piece
 * of Vancouver C-2C vocabulary lives here and in its sibling adapter, core E85
 * enums stay ignorant of it, and every lookup is exact, case-sensitive, and
 * refuses rather than guesses at an unreviewed term.
 *
 * NARROW SLICE. Only the six USE terms and the one DIMENSIONAL concept
 * (`Front Yard`) this pilot's fixture actually states are mapped. Every other
 * C-2C §2.1 row and every other C-2C dimensional/density term has NO mapping
 * here — an unmapped term is reported as UNSUPPORTED_SOURCE_CONCEPT by the
 * adapter, never approximated.
 */
import type { E85UsePermissionStatus } from "../../use-taxonomy";
import type { E85SourceUnit } from "../../source-fact-types";

/** Vancouver's two approval-path terms, mapped onto E85's generic statuses. Identical to R1-1's mapping — the by-law's own vocabulary, not a per-district term. */
const VANCOUVER_C_2C_USE_STATUS_TERMS: Readonly<Record<string, E85UsePermissionStatus>> = {
  "Outright Approval Use": "PERMITTED",
  "Conditional Approval Use": "CONDITIONAL",
};

/** Which normalized rule field a Vancouver C-2C source term lands on. Only `Front Yard` is reviewed for this pilot. */
export type E85VancouverC2CConceptMapping = { family: "DIMENSIONAL"; field: "setback"; yardName: string; acceptedUnits: readonly E85SourceUnit[] };

const VANCOUVER_C_2C_CONCEPT_TERMS: Readonly<Record<string, E85VancouverC2CConceptMapping>> = {
  "Front Yard": { family: "DIMENSIONAL", field: "setback", yardName: "front", acceptedUnits: ["METRES"] },
};

/** Exact lookup of a Vancouver C-2C approval-path term. Undefined means no reviewed mapping — never "prohibited". */
export function mapVancouverC2CUseStatus(sourceTerm: string): E85UsePermissionStatus | undefined {
  return Object.prototype.hasOwnProperty.call(VANCOUVER_C_2C_USE_STATUS_TERMS, sourceTerm) ? VANCOUVER_C_2C_USE_STATUS_TERMS[sourceTerm] : undefined;
}

/** Exact lookup of a Vancouver C-2C regulated-concept term. */
export function mapVancouverC2CConcept(sourceTerm: string): E85VancouverC2CConceptMapping | undefined {
  return Object.prototype.hasOwnProperty.call(VANCOUVER_C_2C_CONCEPT_TERMS, sourceTerm) ? VANCOUVER_C_2C_CONCEPT_TERMS[sourceTerm] : undefined;
}

/**
 * Vancouver C-2C's names for land uses -> E85 use codes. A VOCABULARY MAP
 * ONLY, exactly as `r1-1-terminology.ts` documents: membership here asserts
 * nothing about a use's approval status in C-2C or anywhere else. Every code
 * is a fresh source-normalized identifier — none require a generic
 * use-taxonomy change, following the same pattern R1-1 already established
 * (`use-taxonomy.ts`'s `E85UsePermission.useCode` is a free string).
 *
 * GATE A2 RESOLUTION (Phase 14.4B), RE-CHECKED against Section 11's OPERATIVE
 * body text (not merely its index) as a final pre-commit safety pass:
 * "Grocery or Drug Store, except for Small-Scale Pharmacy" is included.
 * By-law 3575's own text states Section 11's index "is provided for
 * convenience only and does not form part of this by-law", so the index
 * alone (the prior review's basis) is not proof of absence from the
 * operative body. This re-check instead full-text-searched Section 11's
 * actual numbered provisions (11.1 through the end of Section 11, i.e.
 * before Section 12) in the consolidated by-law volume's own text (confirmed
 * byte-equivalent to the standalone C-2C schedule for the C-2C pages) and
 * confirmed: the defined term "Grocery or Drug Store" (Section 2
 * definition: retail of food or drugs, EXPRESSLY EXCLUDING Neighbourhood
 * Grocery Store and small specialty shops) never appears anywhere in
 * Section 11's operative provisions. The only grocery-adjacent Section 11
 * provisions are 11.8.2 (Neighbourhood Grocery Store — a different, separately
 * defined term) and 11.8.10 (Wine on Shelf), whose .1 limb is keyed to the
 * separately-defined "Grocery Store with Liquor Store" and whose .2 limb uses
 * the bare, undefined phrase "Grocery Store" — which is not a Section 2
 * defined term in its own right (it appears only embedded inside the
 * definition of "Grocery Store with Liquor Store") and is textually distinct
 * from "Grocery or Drug Store". No operative Section 11 provision qualifies
 * or restricts this district's outright "Grocery or Drug Store" row.
 * SAFE FOR NARROW SLICE — CONFIRMED AGAINST OPERATIVE TEXT, NOT JUST THE INDEX.
 *
 * "Retail Store" is excluded unconditionally per this phase's brief
 * (a known, real Section 11 dependency — liquor-store carve-out and
 * used-merchandise floor-area allowance) regardless of the Section 11 index
 * finding above; it is not given a code here.
 */
const VANCOUVER_C_2C_USE_CODE_TERMS: Readonly<Record<string, string>> = {
  "Grocery or Drug Store, except for Small-Scale Pharmacy": "grocery_or_drug_store_except_small_scale_pharmacy",
  "Barber Shop or Beauty Salon": "barber_shop_or_beauty_salon",
  "Beauty and Wellness Centre": "beauty_and_wellness_centre",
  "Laundromat or Dry Cleaning Establishment": "laundromat_or_dry_cleaning_establishment",
  "Photofinishing or Photography Studio": "photofinishing_or_photography_studio",
  "Repair Shop - Class B": "repair_shop_class_b",
};

/** Exact lookup of a Vancouver C-2C land-use name. Undefined means this adapter has no reviewed code for that use. */
export function mapVancouverC2CUseCode(sourceUseTerm: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(VANCOUVER_C_2C_USE_CODE_TERMS, sourceUseTerm) ? VANCOUVER_C_2C_USE_CODE_TERMS[sourceUseTerm] : undefined;
}

/**
 * Converts a stated value to the unit the normalized field expects. This
 * pilot's only DIMENSIONAL concept (`Front Yard`) accepts METRES only, so no
 * conversion policy is exercised — kept as a named function (rather than
 * inlined) so a future concept addition follows the same shape R1-1 uses.
 */
export function convertVancouverC2CUnit(mapping: E85VancouverC2CConceptMapping, value: number, unit: E85SourceUnit): { ok: true; value: number; policyApplied?: string } | { ok: false } {
  if (!mapping.acceptedUnits.includes(unit)) return { ok: false };
  return { ok: true, value };
}

/** Every land-use name this adapter can map, for diagnostics and tests. */
export function vancouverC2CKnownUseTerms(): readonly string[] {
  return Object.keys(VANCOUVER_C_2C_USE_CODE_TERMS).sort();
}

/** Every approval-path term this adapter recognizes, for diagnostics and tests. */
export function vancouverC2CKnownUseStatusTerms(): readonly string[] {
  return Object.keys(VANCOUVER_C_2C_USE_STATUS_TERMS).sort();
}

/** Every regulated-concept term this adapter recognizes, for diagnostics and tests. */
export function vancouverC2CKnownConceptTerms(): readonly string[] {
  return Object.keys(VANCOUVER_C_2C_CONCEPT_TERMS).sort();
}

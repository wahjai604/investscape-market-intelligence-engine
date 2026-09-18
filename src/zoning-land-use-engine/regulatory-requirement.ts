/**
 * InvestScape™ E85 Phase 12B.4 — regulatory requirements: validation, identity
 * and quantification state.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Pure, deterministic and jurisdiction-neutral. Requirement codes, choice-group
 * ids and basis terms are opaque data supplied by adapters.
 *
 * IDENTITY. An obligation is identified by `<category>:<requirementCode>` — never
 * by array position, raw wording, provenance, or choice membership. Choice
 * membership is part of the VALUE, so two sources that disagree about whether an
 * obligation is one alternative of a choice or a free-standing cumulative
 * obligation meet under one identity and conflict, instead of silently coexisting
 * under two. Alternatives of one choice differ by code, so they never collide.
 *
 * Codes containing a character that concept keys use as structure (`[` `]` `{`
 * `}` `:` `#` `/` `;` `|` `=`) or a control character are REJECTED, never
 * escaped. Adapters validate before emitting; building an identity for an
 * invalid obligation throws deterministically.
 */
import type { E85Evidence } from "./evidence-types";
import type {
  E85ObligationKind,
  E85RegulatoryRequirement,
  E85RequirementCategory,
  E85RequirementItem,
  E85RequirementQuantity,
  E85RequirementQuantityKind,
  E85RequirementReferenceRole,
} from "./regulatory-requirement-types";
import { canonicalE85ApplicabilityKey, validateE85RuleApplicability } from "./rule-applicability";

export const E85_REQUIREMENT_CATEGORIES: readonly E85RequirementCategory[] = ["AFFORDABLE_HOUSING"];
export const E85_OBLIGATION_KINDS: readonly E85ObligationKind[] = ["PROVIDE", "PAYMENT_IN_LIEU"];
export const E85_REQUIREMENT_QUANTITY_KINDS: readonly E85RequirementQuantityKind[] = ["MIN_FRACTION_OF_FLOOR_AREA"];
const REFERENCE_ROLES: readonly E85RequirementReferenceRole[] = ["QUANTIFICATION", "TERMS"];

const RESERVED_IDENTITY_CHARACTERS = /[[\]{}:#/;|=]/;

/** Why a code cannot take part in identity, or undefined when it can. */
function codeProblem(code: unknown): string | undefined {
  if (typeof code !== "string" || code.length === 0 || code.trim() !== code) return "must be a non-empty string with no surrounding whitespace";
  if (RESERVED_IDENTITY_CHARACTERS.test(code)) return `${JSON.stringify(code)} contains a reserved character ("[", "]", "{", "}", ":", "#", "/", ";", "|" or "=") and is rejected rather than escaped`;
  for (let i = 0; i < code.length; i++) {
    const unit = code.charCodeAt(i);
    if (unit < 0x20 || unit === 0x7f) return `${JSON.stringify(code)} contains a control character`;
  }
  return undefined;
}

/** Every problem with one obligation value. Empty means valid. */
export function validateE85RegulatoryRequirement(requirement: E85RegulatoryRequirement): readonly string[] {
  const problems: string[] = [];
  if (!E85_REQUIREMENT_CATEGORIES.includes(requirement.category)) problems.push(`category: ${JSON.stringify(requirement.category)} is not a known requirement category.`);
  const code = codeProblem(requirement.requirementCode);
  if (code) problems.push(`requirementCode: ${code}.`);
  if (!E85_OBLIGATION_KINDS.includes(requirement.obligationKind)) problems.push(`obligationKind: ${JSON.stringify(requirement.obligationKind)} is not a known obligation kind.`);
  if (typeof requirement.rawSourceTerminology !== "string" || requirement.rawSourceTerminology.trim() === "") problems.push("rawSourceTerminology: the source's own wording is required.");
  if (requirement.choice !== undefined) {
    const group = codeProblem(requirement.choice.choiceGroupId);
    if (group) problems.push(`choice.choiceGroupId: ${group}.`);
    if (requirement.choice.mode !== "ONE_OF") problems.push(`choice.mode: ${JSON.stringify(requirement.choice.mode)} is not a supported choice mode.`);
  }
  for (const [i, reference] of (requirement.instrumentReferences ?? []).entries()) {
    if (!REFERENCE_ROLES.includes(reference.role)) problems.push(`instrumentReferences[${i}].role: ${JSON.stringify(reference.role)} is not a known reference role.`);
    if (typeof reference.description !== "string" || reference.description.trim() === "") problems.push(`instrumentReferences[${i}].description is required.`);
    if (reference.target === undefined || Object.keys(reference.target).length === 0) problems.push(`instrumentReferences[${i}].target must locate the referenced content.`);
    if (typeof reference.structured !== "boolean") problems.push(`instrumentReferences[${i}].structured must be stated explicitly.`);
  }
  return problems;
}

function validateQuantity(quantity: E85RequirementQuantity, index: number): string[] {
  const problems: string[] = [];
  if (!E85_REQUIREMENT_QUANTITY_KINDS.includes(quantity.kind)) problems.push(`quantities[${index}].kind: ${JSON.stringify(quantity.kind)} is not a known quantity kind.`);
  if (typeof quantity.value !== "number" || !Number.isFinite(quantity.value)) problems.push(`quantities[${index}].value must be a finite number.`);
  else if (quantity.kind === "MIN_FRACTION_OF_FLOOR_AREA" && (quantity.value <= 0 || quantity.value > 1)) problems.push(`quantities[${index}].value ${quantity.value} is not a fraction in (0, 1].`);
  if (typeof quantity.basisTerm !== "string" || quantity.basisTerm.trim() === "") problems.push(`quantities[${index}].basisTerm: the quantity's basis in the source's words is required.`);
  return problems;
}

/** Every problem with one obligation and its quantities, including scope agreement between them. Empty means valid. */
export function validateE85RequirementItem(item: E85RequirementItem): readonly string[] {
  const problems: string[] = [...validateE85RegulatoryRequirement(item.requirement.value)];
  problems.push(...validateE85RuleApplicability(item.requirement.applicability).map((p) => `requirement applicability: ${p}`));
  const kinds = new Set<string>();
  for (const [i, quantity] of (item.quantities ?? []).entries()) {
    problems.push(...validateQuantity(quantity.value, i));
    problems.push(...validateE85RuleApplicability(quantity.applicability).map((p) => `quantities[${i}] applicability: ${p}`));
    if (kinds.has(quantity.value.kind)) problems.push(`quantities[${i}]: more than one ${quantity.value.kind} quantity is stated for one obligation.`);
    kinds.add(quantity.value.kind);
  }
  if (problems.length === 0) {
    const scope = canonicalE85ApplicabilityKey(item.requirement.applicability);
    for (const [i, quantity] of (item.quantities ?? []).entries()) {
      if (canonicalE85ApplicabilityKey(quantity.applicability) !== scope) problems.push(`quantities[${i}]: its applicability scope differs from the obligation's, so it cannot be attributed to this obligation.`);
    }
  }
  return problems;
}

/** Every problem with the obligations of one rule record, including two items claiming one identity. Empty means valid. */
export function validateE85RequirementItems(items: readonly E85RequirementItem[]): readonly string[] {
  const problems: string[] = [];
  const seen = new Map<string, number>();
  for (const [i, item] of items.entries()) {
    const itemProblems = validateE85RequirementItem(item);
    problems.push(...itemProblems.map((p) => `requirements[${i}]: ${p}`));
    if (itemProblems.length > 0) continue;
    const key = `${e85RequirementIdentity(item.requirement.value)}{${canonicalE85ApplicabilityKey(item.requirement.applicability)}}`;
    const first = seen.get(key);
    if (first !== undefined) problems.push(`requirements[${i}]: repeats the obligation and scope of requirements[${first}] within one rule record.`);
    else seen.set(key, i);
  }
  return problems;
}

/** The identity `<category>:<requirementCode>`. Throws for an obligation whose category or code cannot take part in identity. */
export function e85RequirementIdentity(requirement: E85RegulatoryRequirement): string {
  const code = codeProblem(requirement.requirementCode);
  if (code || !E85_REQUIREMENT_CATEGORIES.includes(requirement.category)) {
    throw new Error(`Invalid regulatory requirement identity: ${code ? `requirementCode ${code}` : `category ${JSON.stringify(requirement.category)} is not known`}.`);
  }
  return `${requirement.category}:${requirement.requirementCode}`;
}

/** Sub-key of one quantity of one obligation, e.g. `<category>:<code>#MIN_FRACTION_OF_FLOOR_AREA`. A different kind never collides. */
export function e85RequirementQuantitySubKey(requirementIdentity: string, kind: E85RequirementQuantityKind): string {
  return `${requirementIdentity}#${kind}`;
}

/**
 * The comparison key deciding whether two statements of one obligation AGREE:
 * category, code, obligation kind and choice membership. Raw wording and
 * instrument references are provenance of the statement, not the regulation, so
 * drafting differences never manufacture a conflict.
 */
export function e85RequirementAgreementKey(requirement: E85RegulatoryRequirement): string {
  return JSON.stringify([
    requirement.category,
    requirement.requirementCode,
    requirement.obligationKind,
    requirement.choice === undefined ? null : [requirement.choice.choiceGroupId, requirement.choice.mode],
  ]);
}

/**
 * True when what is owed is not known in structured form: no structured quantity
 * is stated, or the obligation depends for its quantity on a referenced
 * instrument that has not been structured.
 */
export function e85RequirementQuantificationUnresolved(requirement: E85RegulatoryRequirement, quantities: readonly E85Evidence<E85RequirementQuantity>[]): boolean {
  if (quantities.length === 0) return true;
  return (requirement.instrumentReferences ?? []).some((r) => r.role === "QUANTIFICATION" && !r.structured);
}

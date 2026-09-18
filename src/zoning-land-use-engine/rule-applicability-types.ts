/**
 * InvestScape™ E85 Phase 12B.2 — scoped rule applicability: contracts.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * APPLICABILITY answers one question: "does this regulatory value govern THIS
 * proposal?" It is a separate axis from the value itself, from the temporal
 * window, and from provenance, and it lives beside them on `E85Evidence` —
 * never folded into any of them. A district schedule routinely states the same
 * concept (a height, an FSR, a front yard) more than once for different kinds
 * of development; without a scope, those statements are indistinguishable from
 * contradictory zone-wide values, and with a scope expressed only as prose they
 * cannot be evaluated at all.
 *
 * Every dimension here is jurisdiction-neutral. Use codes, building-role codes
 * and tenure codes are DATA supplied by source adapters in the adapter's own
 * normalized vocabulary; nothing in this file or its evaluator knows any
 * municipality's terms. Absence of every dimension means "unscoped", which
 * keeps exactly the meaning evidence had before this contract existed.
 *
 * Deliberately NOT here: temporal authority (evidence-types.ts), discretionary
 * or bonus conditions a caller must affirm (rule-family-types.ts
 * `conditionalBonus`, normalized-bundle-types.ts conditional rules), and
 * compliance obligations (which are their own propositions, not the scope that
 * decides whether some other rule exists).
 */
import type { E85DocumentLocator } from "./provenance-types";

/** Inclusive numeric bounds. Both sides optional; a bound with neither side is equivalent to no bound. Values must be finite. */
export interface E85NumericBound {
  readonly min?: number;
  readonly max?: number;
}

/** The applicability dimensions, in the fixed order used for canonical identity and for reporting. */
export type E85ApplicabilityDimension =
  | "useCodes"
  | "excludedUseCodes"
  | "dwellingUnits"
  | "buildingRoles"
  | "excludedBuildingRoles"
  | "siteAreaSqm"
  | "frontageMetres"
  | "tenureCodes"
  | "excludedTenureCodes"
  | "requiredConditionIds";

/** Canonical dimension order. Identity, evaluation and reporting all walk this list, never object key order. */
export const E85_APPLICABILITY_DIMENSIONS: readonly E85ApplicabilityDimension[] = [
  "useCodes",
  "excludedUseCodes",
  "dwellingUnits",
  "buildingRoles",
  "excludedBuildingRoles",
  "siteAreaSqm",
  "frontageMetres",
  "tenureCodes",
  "excludedTenureCodes",
  "requiredConditionIds",
];

/**
 * A conjunction of scope predicates. Every present dimension must hold for the
 * value to govern a proposal.
 *
 * `excludedUseCodes` never makes an arbitrary use eligible: the evaluator only
 * treats a use as "not excluded" once that use is RECOGNIZED by the governing
 * rule set (see `E85ApplicabilityContext.recognizedUseCodes`). An unrecognized
 * use leaves the dimension undetermined.
 *
 * `requiredConditionIds` name external predicates E85 cannot resolve itself
 * (e.g. a geographic test no spatial stage yet proves). They are never assumed:
 * a condition is true only when the caller affirms it, false only when the
 * caller explicitly establishes it is false, and otherwise unknown. Opaque
 * condition ids never prove two scopes disjoint.
 */
export interface E85RuleApplicability {
  readonly useCodes?: readonly string[];
  readonly excludedUseCodes?: readonly string[];
  readonly dwellingUnits?: E85NumericBound;
  readonly buildingRoles?: readonly string[];
  readonly excludedBuildingRoles?: readonly string[];
  readonly siteAreaSqm?: E85NumericBound;
  readonly frontageMetres?: E85NumericBound;
  readonly tenureCodes?: readonly string[];
  readonly excludedTenureCodes?: readonly string[];
  readonly requiredConditionIds?: readonly string[];
  /**
   * Where each scope dimension is stated at the source, when that is a
   * different place from the value's own `provenance.documentLocator`. Scope is
   * itself a legal assertion and keeps its own trail. Excluded from canonical
   * scope IDENTITY (two statements of the same scope are the same scope), but
   * retained in evidence identity so independent sources stay auditable.
   */
  readonly locators?: Readonly<Partial<Record<E85ApplicabilityDimension, E85DocumentLocator>>>;
}

export type E85ApplicabilityOutcome = "APPLIES" | "NOT_APPLICABLE" | "UNDETERMINED";

/**
 * What is known about the proposal when applicability is decided. Every field
 * is optional; a missing field is UNKNOWN, never false and never true.
 */
export interface E85ApplicabilityContext {
  readonly useCode?: string;
  /** Use codes the governing rule set itself names (via use-permission evidence). Gates exclusion-based use scopes so an unknown use is never treated as "some other use". */
  readonly recognizedUseCodes?: readonly string[];
  readonly dwellingUnitCount?: number;
  readonly buildingRole?: string;
  readonly siteAreaSqm?: number;
  readonly frontageMetres?: number;
  readonly tenureCode?: string;
  /** Condition ids the caller affirms are TRUE. */
  readonly satisfiedConditions?: readonly string[];
  /** Condition ids the caller explicitly establishes are FALSE. Absence from both lists is unknown. A condition in both lists is contradictory and treated as unknown. */
  readonly unsatisfiedConditions?: readonly string[];
}

export interface E85ApplicabilityEvaluation {
  readonly outcome: E85ApplicabilityOutcome;
  /** Canonical scope key; "" for unscoped evidence. */
  readonly applicabilityKey: string;
  /** For NOT_APPLICABLE: the first dimension (in canonical order) proven false. */
  readonly decidingDimension?: E85ApplicabilityDimension;
  /** For UNDETERMINED: every dimension the context could not decide, in canonical order. */
  readonly missingDimensions: readonly E85ApplicabilityDimension[];
}

/** The audit surface a Phase 4 finding carries when scope decided or blocked it. */
export interface E85FindingApplicabilityAudit {
  readonly applicabilityKeys: readonly string[];
  readonly outcome: E85ApplicabilityOutcome;
  readonly decidingDimensions?: readonly E85ApplicabilityDimension[];
  readonly missingDimensions?: readonly E85ApplicabilityDimension[];
}

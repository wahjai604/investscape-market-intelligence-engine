/**
 * InvestScape™ E85 Phase 4 — Rule Normalization & Deterministic Evaluation:
 * evaluation request contract.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * PHASE 4 CONTRACT EXTENSION (documented per the Phase 4 task brief): Phase 3
 * did not define a way for a caller to scope WHICH rule families are being
 * asked about for a given evaluation, nor a request envelope tying a parcel,
 * jurisdiction/zone, use, as-of date, normalized rule set and policy version
 * together. This is additive only — no Phase 3 file is modified to add this,
 * it is a new Phase 4 file. Scoping requested analyses is required by the
 * DATA_GAP-propagation rule: a family that was never requested must never
 * force a gap/review outcome (see `data-gap-types.ts` philosophy, applied
 * here at the request level).
 */
import type { E85ParcelReference } from "./jurisdiction-types";
import type { E85RuleRecord, E85RuleFamily } from "./rule-family-types";
import type { E85PolicyVersion } from "./policy-types";

/** Which rule families the caller actually wants evaluated. Reuses `E85RuleFamily` rather than inventing a parallel enum. */
export type E85RequestedAnalysis = E85RuleFamily;

/**
 * Caller-supplied facts about the specific project/proposal that a
 * conditional rule might depend on (e.g. "does this project provide
 * affordable housing," "is a bicycle room provided"). Phase 4 NEVER assumes
 * a named condition is satisfied unless it appears here explicitly listed as
 * satisfied — absence of a condition name is treated as "not affirmed," not
 * as false and not as true.
 */
export interface E85CallerContext {
  /** Named conditions the caller affirms ARE satisfied for this evaluation, using whatever condition-name vocabulary the supplied rule evidence uses (free-text, case-sensitive exact match only — no fuzzy matching). */
  satisfiedConditions?: readonly string[];
  /**
   * PHASE 12B.2 (optional, additive): condition ids the caller explicitly
   * establishes are FALSE for this proposal. Used only by scoped-rule
   * applicability (`E85RuleApplicability.requiredConditionIds`). A condition in
   * neither list is UNKNOWN — never false by omission.
   */
  unsatisfiedConditions?: readonly string[];
  /** Overlay designations the caller flags as applicable to this parcel (e.g. from a source outside Rule-Only Mode's own discovery, since Rule-Only Mode never discovers overlays spatially itself). */
  overlaysApplicable?: readonly string[];
}

/**
 * PHASE 12B.2 (optional, additive): facts about the proposal that scoped rules
 * may depend on. Site area is NOT repeated here — it stays on
 * `E85ParcelReference.siteAreaSqm` — and the use stays on
 * `E85EvaluationRequest.useCode`. Every field is optional; a missing field
 * leaves any scope depending on it UNDETERMINED, never false.
 */
export interface E85ProposalContext {
  /** Total dwelling units in the proposed development. */
  dwellingUnitCount?: number;
  /** Role of the building being evaluated, in the building-role vocabulary the supplied rule evidence uses. One role per request. */
  buildingRole?: string;
  /** Tenure of the proposed residential floor area, in the tenure vocabulary the supplied rule evidence uses. */
  tenureCode?: string;
  /** Site frontage in metres. */
  frontageMetres?: number;
}

/**
 * The single input envelope for `evaluateZoningAndLandUse`. All rule records
 * supplied here are assumed ALREADY NORMALIZED (Phase 4 does not parse raw
 * PDF/HTML/API payloads — that is Phase 5 scope). The evaluator is pure and
 * deterministic: given the same request, it always produces the same
 * `E85Result`, independent of the order of `rules`.
 */
export interface E85EvaluationRequest {
  parcel: E85ParcelReference;
  /** Jurisdiction to match rule records against — exact string match only. */
  jurisdictionId: string;
  /** Zone designation to match rule records against — exact string match only (e.g. "R1-1" != "R1"). */
  zoneDesignation: string;
  /** The land-use code being evaluated, in whatever use-code vocabulary the supplied `E85UsePermission.useCode` values use. */
  useCode: string;
  /** ISO 8601 date the evaluation is being performed as-of, for temporal applicability filtering. */
  asOfDate: string;
  /** Already-normalized rule records available to the evaluator. Order must not affect the result. */
  rules: readonly E85RuleRecord[];
  /** Which rule families the caller actually wants evaluated this request. A family absent from this list is never evaluated and never produces a gap/warning/review reason. */
  requestedAnalyses: readonly E85RequestedAnalysis[];
  policyVersion: E85PolicyVersion;
  callerContext?: E85CallerContext;
  /** PHASE 12B.2 (optional): proposal facts used only to decide scoped-rule applicability. */
  proposal?: E85ProposalContext;
}

/**
 * InvestScape™ E85 Phase 9 — Decision Orchestration & Material Readiness:
 * contracts.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Phases 4 through 8 each answer one question honestly and refuse the others.
 * Nobody, until now, answered the question a caller actually asks:
 *
 *   "Given this authoritative layer and this parcel, can I rely on this
 *    regulatory answer — and if not, what exactly is missing?"
 *
 * Phase 9 answers it by ORCHESTRATING, never by deciding. It runs the phases in
 * order, keeps every result whole, and adds exactly one thing of its own:
 * MATERIALITY — whether an upstream problem actually bears on THIS parcel and
 * THESE requested analyses.
 *
 * THE INVARIANT THIS FILE EXISTS TO PROTECT: A DOWNSTREAM NUMBER NEVER LAUNDERS
 * AN UPSTREAM GAP. Phase 8A established the hazard precisely — Phase 7 returns
 * the SAME status for a fully-mapped parcel and for a parcel sitting inside a
 * valid polygon whose governing instrument nobody mapped. Both come back
 * resolved; the second merely has an empty pack list, and an absence is exactly
 * what cannot be told from "no instrument governs here". So the decision package
 * carries Phase 8's result in full, forever, and a clean terminal status must be
 * EARNED against material blockers rather than inferred from a successful
 * calculation.
 *
 * The opposite error is just as real, and is the reason materiality exists at
 * all. One unmapped polygon on the far side of a municipal layer must not block
 * every parcel in the city. `hasBlockingSpatialSourceFinding` is correct at the
 * SNAPSHOT level and is deliberately not used as a parcel verdict here; Phase 9
 * re-asks the question per parcel using Phase 7's own geometric evidence.
 *
 * Nothing here acquires anything, computes a rule, or ranks an instrument.
 */
import type { E85DataGap } from "./data-gap-types";
import type { E85EvaluationOutcome } from "./evaluator-result-types";
import type { E85ParcelReference } from "./jurisdiction-types";
import type { E85ManualReviewRecord } from "./manual-review-types";
import type { E85PolicyVersion } from "./policy-types";
import type { E85CallerContext, E85ProposalContext, E85RequestedAnalysis } from "./request-types";
import type { E85OverallStatus } from "./result-status";
import type { E85RuleFamily } from "./rule-family-types";
import type { E85CompositionResult, E85RulePack } from "./composition-types";
import type { E85NormalizationFinding } from "./normalization-finding-types";
import type { E85PrecedenceRelation } from "./precedence-types";
import type { E85SpatialDatasetRegistry } from "./spatial-dataset-registry";
import type { E85ParcelSpatialReference, E85SpatialApplicabilityResult, E85SpatialFeatureClass } from "./spatial-applicability-types";
import type { E85SpatialNormalizationResult } from "./spatial-source-adapter-contract";
import type { E85SpatialRelation } from "./geometry-relations";
import type { E85SpatialTolerance } from "./spatial-types";
import type { E85TemporalRequest } from "./temporal-request-types";

/**
 * The pipeline stages, named so a caller can see which ones ran.
 *
 * `RULE_PACK_RESOLUTION` is a stage rather than an implementation detail
 * because it fails in its own distinct way: Phase 7 can name an instrument that
 * the caller simply did not hand over, and that failure belongs to neither the
 * phase that named it nor the phase that would have consumed it.
 *
 * `TEMPORAL_REQUEST` (PHASE 15.16, Slice 3F-1) is not a pipeline stage in the
 * same sense as the other five -- nothing runs FOR it. It exists solely to
 * source-attribute the one honest disclosure this slice adds: that an
 * explicit `temporalRequest` was accepted but not yet applied. It never
 * appears in `E85DecisionPackage.stages`.
 */
export type E85DecisionStage = "SPATIAL_NORMALIZATION" | "SPATIAL_APPLICABILITY" | "RULE_PACK_RESOLUTION" | "COMPOSITION" | "EVALUATION" | "TEMPORAL_REQUEST";

/**
 * What happened to a stage.
 *
 * A stage that did not run always says why. Silence about a skipped stage is
 * indistinguishable from a stage that ran and found nothing, and those send a
 * reviewer to completely different places.
 */
export type E85DecisionStageState =
  /** Ran to completion on the evidence available. Says nothing about whether the result was clean. */
  | "EXECUTED"
  /** Ran on a confirmed SUBSET while some applicable evidence remained unresolved. */
  | "PARTIALLY_EXECUTED"
  /** Did not run because an earlier stage produced nothing for it to consume. */
  | "SKIPPED"
  /** Did not run because an earlier stage failed in a way that makes running it unsafe or meaningless. */
  | "BLOCKED";

export interface E85DecisionStageRecord {
  stage: E85DecisionStage;
  state: E85DecisionStageState;
  /** Specific, non-boilerplate statement of what ran, or of why it did not. */
  detail: string;
}

/**
 * Whether an upstream problem bears on THIS decision.
 *
 * The three-way split is the whole point. A boolean would force every unproven
 * case into one of the two confident answers, and the honest answer for a
 * quarantined polygon is neither "it matters" nor "it does not" — it is "there
 * is no trustworthy geometry with which to find out", which blocks completeness
 * exactly as a material problem does while remaining a different fact.
 */
export type E85DecisionMateriality =
  /** Bears on this parcel and these requested analyses. Blocks a clean answer. */
  | "MATERIAL"
  /** Proven not to bear on this decision, on authoritative evidence. Retained, never deleted. */
  | "NON_MATERIAL"
  /** Relevance could not be established either way. Blocks a clean answer, and is NEVER silently read as NON_MATERIAL. */
  | "UNDETERMINED";

/**
 * Which terminal vocabulary an upstream problem speaks, carried so status derivation never has to guess.
 *
 * `COMPLETENESS` is deliberately distinct from `GAP`. `GAP` is a legal-vocabulary signal that `decision-status.ts` maps straight onto
 * `DATA_GAP` regardless of which upstream code produced it. A requested analysis family that no contributing pack ever claimed to model
 * (`REQUESTED_FAMILY_NOT_SUPPORTED`) is an ORCHESTRATION completeness fact — the decision is not the whole answer — not a legal
 * statement about the family that WAS modeled and resolved. Using `GAP` for it would silently convert an unrelated family's clean
 * PERMITTED/DENIED status into DATA_GAP, which is exactly the cross-contamination Phase 9 exists to prevent. `COMPLETENESS` blocks
 * `evaluationCompleteness` (via `isE85DecisionBlocking`, which is materiality-based) but is invisible to `determineE85DecisionStatus`'s
 * kind-based switch, so it can never move the terminal status.
 */
export type E85DecisionBlockerKind = "GAP" | "MANUAL_REVIEW" | "COMPLETENESS";

/**
 * One upstream problem, and Phase 9's finding about whether it matters here.
 *
 * This is the audit record for the question Phase 9 exists to answer. A caller
 * who sees a global Phase 8 blocker and a clean parcel decision can come here
 * and read exactly why the two are consistent — which feature it concerned,
 * what Phase 7 said about that feature's relationship to this parcel, and what
 * conclusion followed.
 */
export interface E85DecisionMaterialityRecord {
  /**
   * Stable identity of the UNDERLYING problem, used to keep one upstream fact
   * from becoming three blockers as it is observed by successive layers.
   * Shaped `<stage>:<code>:<subject>`; a locator for deduplication, never a
   * legal identifier.
   */
  sourceRef: string;
  /** The phase that raised the underlying problem. */
  sourcePhase: E85DecisionStage;
  /** The upstream code, verbatim in its own phase's vocabulary. Phase 9 adds no parallel taxonomy. */
  sourceCode: string;
  kind: E85DecisionBlockerKind;
  materiality: E85DecisionMateriality;
  /** Specific, non-boilerplate explanation of how this materiality was reached. */
  reason: string;
  /** The regulatory feature this concerns, when one is known. */
  featureId?: string;
  /** The rule pack this concerns, when one is known. */
  packId?: string;
  /**
   * What Phase 7 said about `featureId`'s relationship to this parcel, when
   * Phase 7 had anything to say. Absent means Phase 7 held no evidence about
   * this feature at all — which is itself why such a record is UNDETERMINED.
   */
  spatialRelation?: E85SpatialRelation;
  /**
   * The rule families this problem could affect, when they are actually KNOWN.
   *
   * ABSENT MEANS UNKNOWN, AND UNKNOWN MEANS EVERY FAMILY. An unresolved
   * instrument's contents are not evidence of absence: a pack nobody mapped
   * cannot be declared irrelevant to parking merely because no parking rule was
   * found in it. Only populate this where an upstream phase actually stated the
   * family — Phase 6 conflicts do; unmapped packs never can.
   */
  families?: readonly E85RuleFamily[];
  /** The underlying gap, when the upstream problem carried one. */
  gap?: E85DataGap;
  /** The underlying manual-review record, when the upstream problem carried one. */
  manualReview?: E85ManualReviewRecord;
}

/** Whether the Phase 4 numbers in this package may be relied on as the whole answer. */
export type E85DecisionEvaluationCompleteness =
  /** Phase 4 ran and no material or undetermined blocker remains. */
  | "COMPLETE"
  /** Phase 4 ran on a confirmed subset while a blocker remains outstanding. Its values are real but are not the whole answer. */
  | "PARTIAL"
  /** Phase 4 did not run. */
  | "NOT_EVALUATED";

/** One step of the "why is this usable / why is this blocked" chain. */
export type E85DecisionTraceKind = "SUPPORT" | "BLOCKER";

/**
 * A trace entry.
 *
 * Deliberately made of IDENTITIES rather than copies. The evidence itself is
 * already retained whole on the package; duplicating a provenance object per
 * concept would make a forty-thousand-polygon decision unreadable, and the
 * identity is what a reviewer actually follows.
 */
export interface E85DecisionTraceEntry {
  kind: E85DecisionTraceKind;
  /** SUPPORT: the pack that contributed rules. */
  packId?: string;
  /** SUPPORT: the spatial feature that brought the pack into play. */
  featureId?: string;
  datasetId?: string;
  datasetVersionId?: string;
  adapterId?: string;
  adapterVersion?: string;
  /** BLOCKER: the phase the problem came from. */
  sourcePhase?: E85DecisionStage;
  /** BLOCKER: the `sourceRef` of the materiality record this entry reports. */
  sourceRef?: string;
  detail: string;
}

/**
 * One Phase 5 source finding, traced back to the exact contributing pack it
 * came from.
 *
 * Identity-preserving on purpose: `packId`/`sourceId`/`sourceVersionId` mirror
 * the same fields on `E85RulePack` exactly, so a reviewer can go from a finding
 * on the decision package straight back to the pack (and therefore the
 * bundle/adapter) that produced it, without composition or Phase 9 having to
 * restate or re-derive that identity.
 */
export interface E85DecisionSourceFinding {
  packId: string;
  sourceId: string;
  sourceVersionId?: string;
  finding: E85NormalizationFinding;
}

/** Rule-pack identities Phase 7 named, matched against what the caller actually supplied. */
export interface E85RulePackResolution {
  /** Packs resolved by EXACT id match, canonically ordered. */
  resolved: readonly E85RulePack[];
  /** Ids Phase 7 named for which no pack was supplied. Never silently dropped. */
  unresolvedPackIds: readonly string[];
  /** Ids supplied more than once with materially different content. Neither copy is chosen. */
  conflictingPackIds: readonly string[];
  /** Ids supplied more than once identically, counted once. A repeated copy is not a second authority. */
  collapsedDuplicatePackIds: readonly string[];
}

/**
 * The decision package.
 *
 * Every phase result is held WHOLE. A caller may reach past Phase 9 to any
 * layer's own evidence at any time, which is the property that makes the
 * orchestration auditable rather than merely convenient.
 */
export interface E85DecisionPackage {
  /** Caller-supplied correlation id, echoed untouched. */
  decisionId?: string;
  parcel: E85ParcelReference;
  parcelSpatial: E85ParcelSpatialReference;
  requestedAnalyses: readonly E85RequestedAnalysis[];

  /** Phase 8, entire — including quarantine, findings and readiness. */
  phase8: E85SpatialNormalizationResult;
  /** Phase 7, entire, when it executed. */
  phase7?: E85SpatialApplicabilityResult;
  /** Phase 6, entire, when it executed — the result union, so a REFUSED composition survives too. */
  phase6?: E85CompositionResult;
  /** Phase 4, entire, when it executed. */
  phase4?: E85EvaluationOutcome;

  /** How Phase 7's pack identities matched what the caller supplied. */
  packResolution: E85RulePackResolution;

  /** Every upstream problem Phase 9 considered, with its materiality finding. Canonically ordered. */
  materiality: readonly E85DecisionMaterialityRecord[];
  /** The subset of `materiality` that blocks a clean answer — MATERIAL or UNDETERMINED. A view, not a second source of truth. */
  blockers: readonly E85DecisionMaterialityRecord[];
  /** Non-blocking caveats a caller should surface. */
  warnings: readonly string[];
  /**
   * Phase 5 source findings, carried forward from every pack that actually
   * contributed to `phase6`'s composed result — never from an excluded,
   * unresolved or non-selected pack. Audit-only: never merged into `warnings`
   * or `gaps`, and never read by `status`, `materiality`, `manualReview` or
   * `evaluationCompleteness`. Ordered by the same deterministic pack ordering
   * Phase 6 already produces (`contributingPackIds`), then by each pack's own
   * finding order — never by object insertion order.
   */
  sourceFindings: readonly E85DecisionSourceFinding[];

  stages: readonly E85DecisionStageRecord[];
  /** Derived in exactly one place from material blockers — see decision-status.ts. */
  status: E85OverallStatus;
  evaluationCompleteness: E85DecisionEvaluationCompleteness;
  trace: readonly E85DecisionTraceEntry[];
  /** ISO 8601. Caller-supplied, else derived from retained evidence, else a fixed sentinel — never a clock read. */
  assembledAt: string;
}

/**
 * The single input envelope.
 *
 * Phase 8's RESULT is the input, not a snapshot: orchestration does not
 * normalize, and handing it a raw payload would put an adapter call inside a
 * layer that must stay able to orchestrate evidence from anywhere.
 */
export interface E85DecisionRequest {
  decisionId?: string;
  /** A completed Phase 8 normalization, success or refusal. */
  normalization: E85SpatialNormalizationResult;
  /** The parcel as geometry, for Phase 7. */
  parcelSpatial: E85ParcelSpatialReference;
  /** The parcel as a Phase 4 reference. Two shapes because the two phases genuinely need different facts. */
  parcel: E85ParcelReference;
  jurisdictionId: string;
  zoneDesignation: string;
  useCode: string;
  asOfDate: string;
  /**
   * PHASE 15.16 (Slice 3F-1): the caller's explicit temporal intent, reconciled
   * against `asOfDate` (above) via the existing `resolveE85TemporalRequest`.
   * Optional, additive, and NOT a request for E85 to perform real temporal
   * analysis: until source-version selection is wired, supplying this field
   * only causes one honest `TEMPORAL_ANALYSIS_NOT_YET_APPLIED` disclosure to be
   * added to `materiality`. A caller that omits it, including one that still
   * supplies only the legacy `asOfDate`, sees no change in behavior.
   */
  temporalRequest?: E85TemporalRequest;
  requestedAnalyses: readonly E85RequestedAnalysis[];
  policyVersion: E85PolicyVersion;
  /**
   * The packs the caller holds. An offline collection, matched by EXACT id —
   * there is no registry lookup, no network, and no nearest-pack fallback.
   */
  availableRulePacks: readonly E85RulePack[];
  callerContext?: E85CallerContext;
  /** PHASE 12B.2: proposal facts for scoped-rule applicability. Passed through to Phase 4 unchanged; Phase 9 does not interpret them and Phase 6 never receives them. */
  proposal?: E85ProposalContext;
  /** Passed through to Phase 7 unchanged. */
  spatialRegistry?: E85SpatialDatasetRegistry;
  tolerance?: E85SpatialTolerance;
  mutuallyExclusiveClasses?: readonly E85SpatialFeatureClass[];
  /** Passed through to Phase 6 unchanged. Phase 9 states no precedence of its own. */
  precedenceRelations?: readonly E85PrecedenceRelation[];
  /** Timestamps, all caller-supplied so no stage reads a clock. */
  resolvedAt?: string;
  composedAt?: string;
  assembledAt?: string;
}

/**
 * Deterministic fallback when neither the caller nor the retained evidence
 * supplies a time. A reproducible constant, matching Phase 8's sentinel: it
 * stamps "when this package was assembled", which is orchestration metadata,
 * and is never written onto a piece of evidence.
 */
export const E85_DECISION_EPOCH = "1970-01-01T00:00:00.000Z";

/** Canonical ordering for anything keyed by a string, so output never carries the caller's array order. */
export function byE85DecisionKey(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Whether a materiality finding stops a caller treating this decision as complete. */
export function isE85DecisionBlocking(record: E85DecisionMaterialityRecord): boolean {
  return record.materiality === "MATERIAL" || record.materiality === "UNDETERMINED";
}

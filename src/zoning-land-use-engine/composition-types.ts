/**
 * InvestScape™ E85 Phase 6 — Multi-Source Rule-Pack Composition: contracts.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Phase 5 answers "what does THIS source say?". Phase 6 answers "how do these
 * already-applicable sources interact?". The split matters: discovering WHICH
 * instruments govern a parcel is a spatial/registry question for a later phase,
 * and legal precedence must never be decided by whatever found the documents.
 *
 *   normalized bundles (Phase 5)
 *        ↓  composeE85RulePacks
 *   effective rules + audit
 *        ↓  evaluateZoningAndLandUse (Phase 4, unchanged)
 *   regulatory result
 *
 * Composition is deliberately PARCEL-INDEPENDENT. It reasons about instruments,
 * not sites, so it derives no `parcelMatch` — there is no parcel here to match,
 * and inventing a tier would be the same fabrication Phase 5 refused at the
 * bundle level. Phase 4 still derives all three qualification axes from the
 * parcel it is actually given.
 */
import type { E85RuleRecord, E85RuleFamily } from "./rule-family-types";
import type { E85ConditionalRuleRecord, E85BundleQualification, E85NormalizedRuleBundle } from "./normalized-bundle-types";
import type { E85CompositionRole, E85PrecedenceRelation, E85PrecedenceProblem } from "./precedence-types";
import type { E85RuleConceptKey, E85RuleConceptContribution } from "./rule-concept-identity";
import type { E85TemporalWindow } from "./evidence-types";
import type { E85Provenance } from "./provenance-types";
import type { E85SourceReadinessAssessment } from "./source-readiness-assessment";
import type { E85ManualReviewRecord } from "./manual-review-types";
import type { E85CompositionFinding } from "./composition-findings";

/**
 * One independently-normalized body of rules offered for composition.
 *
 * Built from an `E85NormalizedRuleBundle` via `rulePackFromBundle`, but typed
 * separately and minimally so composition never assumes every pack came from
 * the same adapter — or from an adapter at all. A future agreement registry, a
 * hand-curated instrument, or another engine's normalizer can present a pack
 * without pretending to be a Phase 5 source bundle.
 */
export interface E85RulePack {
  /** Stable identity of this pack within one composition. Precedence relations refer to packs by this id. */
  packId: string;
  jurisdictionId: string;
  /** The zone/governing-instrument designation these rules attach to. */
  zoneDesignation: string;
  sourceId: string;
  sourceVersionId?: string;
  /** DESCRIPTIVE ONLY. Never read by precedence resolution — see precedence-types.ts. */
  role: E85CompositionRole;
  /** Unconditional rules, safe to compose. */
  rules: readonly E85RuleRecord[];
  /** Condition-gated rules, held out of `rules` exactly as Phase 5 holds them out of a bundle. */
  conditionalRules: readonly E85ConditionalRuleRecord[];
  /** The temporal window the pack's rules were normalized under. */
  temporal?: E85TemporalWindow;
  /** Pack-level provenance identifying source/version/adapter. */
  provenance?: E85Provenance;
  adapterId?: string;
  adapterVersion?: string;
  /** Adaptation-time qualification, floored into the composed result. */
  qualification?: E85BundleQualification;
  /** Source readiness carried through so rights/coverage limitations stay visible after composition. */
  readiness?: E85SourceReadinessAssessment;
  /** ISO 8601 timestamp this pack was normalized. Used only to derive a deterministic `composedAt` when the caller supplies none — never as evidence of recency or precedence. */
  normalizedAt?: string;
}

/** Builds a rule pack from a Phase 5 normalized bundle. The role must be supplied by the caller: a bundle knows what it says, not how it ranks against other instruments. */
export function rulePackFromBundle(bundle: E85NormalizedRuleBundle, packId: string, role: E85CompositionRole): E85RulePack {
  return {
    packId,
    jurisdictionId: bundle.jurisdictionId,
    zoneDesignation: bundle.zoneDesignation,
    sourceId: bundle.sourceId,
    sourceVersionId: bundle.sourceVersionId,
    role,
    rules: bundle.rules,
    conditionalRules: bundle.conditionalRules,
    temporal: bundle.temporal,
    provenance: bundle.provenance,
    adapterId: bundle.adapterId,
    adapterVersion: bundle.adapterVersion,
    qualification: bundle.qualification,
    readiness: bundle.readiness,
    normalizedAt: bundle.normalizedAt,
  };
}

/** One pack's claim about one concept, reduced to what an audit record needs. */
export interface E85ConceptClaim {
  packId: string;
  sourceId: string;
  sourceVersionId?: string;
  adapterId?: string;
  adapterVersion?: string;
  /** The claimed value, as the source stated it. */
  value: unknown;
  provenance: E85Provenance;
  temporal: E85TemporalWindow;
}

/**
 * A rule that lost to an explicitly-stated precedence relation.
 *
 * Kept because deleting it would destroy the only record of what the other
 * authority said. The evaluator consumes effective rules alone; a reviewer
 * asking "what did the base zoning say before the agreement displaced it, and
 * who said the agreement wins?" needs this, and nothing else carries it.
 */
export interface E85SuppressedRuleRecord {
  conceptKey: E85RuleConceptKey;
  family: E85RuleFamily;
  /** The claim that was displaced. */
  suppressed: E85ConceptClaim;
  /** The claim that governs instead. */
  effective: E85ConceptClaim;
  /** The relation that decided it, including its own provenance. */
  relationId: string;
  relation: E85PrecedenceRelation;
  reason: string;
}

/** Two or more authoritative claims about one concept that E85 has no stated basis to rank. */
export interface E85CompositionConflict {
  conceptKey: E85RuleConceptKey;
  family: E85RuleFamily;
  /** Every competing claim, in deterministic order. None is preferred. */
  claims: readonly E85ConceptClaim[];
  /** Distinct values claimed, for a reviewer scanning quickly. */
  distinctValues: readonly unknown[];
  detail: string;
  /** True when at least one competing claim has an unestablished effective date, so the disagreement may be temporal rather than substantive. */
  temporalUncertainty: boolean;
}

/** Composition-level outcome. Unresolved conflicts do not prevent composition — the compatible remainder is still useful, and materiality is Phase 4's question. */
export type E85CompositionStatus = "COMPOSED" | "COMPOSED_WITH_UNRESOLVED_CONFLICTS";

export interface E85ComposedRulePack {
  jurisdictionId: string;
  zoneDesignation: string;
  status: E85CompositionStatus;
  /** Hand straight to `evaluateZoningAndLandUse`. Contains no conflicted concept. */
  effectiveRules: readonly E85RuleRecord[];
  /** Condition-gated rules from every pack, still gated. Composition never affirms a condition. */
  conditionalRules: readonly E85ConditionalRuleRecord[];
  /** Pack ids that contributed, sorted. */
  contributingPackIds: readonly string[];
  /** Source ids that contributed, sorted and deduplicated. */
  contributingSourceIds: readonly string[];
  /** Rules displaced by an explicit relation, with both sides preserved. */
  suppressed: readonly E85SuppressedRuleRecord[];
  /** Concepts left undecided, each naming its family so materiality can be assessed. */
  unresolvedConflicts: readonly E85CompositionConflict[];
  findings: readonly E85CompositionFinding[];
  /** Precedence metadata defects found during validation. */
  precedenceProblems: readonly E85PrecedenceProblem[];
  /** Relations actually applied, for audit. */
  appliedRelations: readonly E85PrecedenceRelation[];
  /**
   * Floor across contributing packs, never an average. Two axes only, for the
   * same reason Phase 5's bundle has two: composition holds no parcel.
   */
  qualification: E85BundleQualification;
  /** Readiness limitations carried from contributing packs. Reported, never used to suppress a rule. */
  readinessLimitations: readonly E85CompositionReadinessLimitation[];
  /** ISO 8601, supplied by the caller — composition never reads a clock. */
  composedAt: string;
}

/** A rights/coverage limitation on a contributing pack, surfaced after composition. */
export interface E85CompositionReadinessLimitation {
  packId: string;
  sourceId: string;
  blockers: readonly string[];
  detail: string;
}

/** Composition refused outright: the packs do not describe one governing context, so there is nothing coherent to compose. */
export type E85CompositionResult =
  | { outcome: "COMPOSED"; composed: E85ComposedRulePack }
  | { outcome: "REFUSED"; problems: readonly E85CompositionProblem[]; manualReview: E85ManualReviewRecord };

export type E85CompositionProblemCode =
  /** Packs disagree about which jurisdiction or zone is being composed. */
  | "INCOMPATIBLE_PACK_CONTEXT"
  /** Two packs share a packId, so precedence relations could not name one unambiguously. */
  | "DUPLICATE_PACK_ID";

export interface E85CompositionProblem {
  code: E85CompositionProblemCode;
  packIds: readonly string[];
  detail: string;
}

export interface E85CompositionOptions {
  /** ISO 8601 timestamp stamped on the composed pack and its records. Defaults to the first pack's normalization time when available; never `Date.now()`. */
  composedAt?: string;
  /**
   * Conditions the caller affirms are satisfied, matched VERBATIM. Affirming a
   * condition makes the matching conditional rules eligible for composition —
   * it does not make them win anything. An admitted conditional rule that
   * disagrees with another authority is an ordinary conflict.
   */
  affirmedConditions?: readonly string[];
  /** Explicitly-stated precedence relations. Absent means no precedence is known, which is a valid and common state. */
  precedenceRelations?: readonly E85PrecedenceRelation[];
}

/** Internal shape shared between the composer and its helpers. Exported for testability of concept grouping. */
export interface E85ConceptGroup {
  conceptKey: E85RuleConceptKey;
  family: E85RuleFamily;
  contributions: readonly E85RuleConceptContribution[];
}

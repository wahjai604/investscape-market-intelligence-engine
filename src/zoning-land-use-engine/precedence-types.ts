/**
 * InvestScape™ E85 Phase 6 — Multi-Source Rule-Pack Composition: explicit
 * precedence.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * THE CENTRAL SAFEGUARD OF PHASE 6, stated once so it cannot be lost:
 *
 *   `E85CompositionRole` is DESCRIPTIVE.
 *   `E85PrecedenceRelation` is AUTHORITATIVE.
 *
 * Calling a pack SITE_SPECIFIC says what kind of instrument it is. It does not
 * say it beats the base zoning, and nothing in E85 may read it that way.
 * Municipal legal regimes genuinely differ: in one city a development agreement
 * displaces the district schedule, in another it can only supplement it, and in
 * a third the answer depends on which came first and under what enabling
 * statute. Software that encoded any of those as "the" rule would be silently
 * wrong two times in three — and wrong invisibly, since the output would look
 * like a confident answer.
 *
 * So precedence exists only where some authority actually stated it. A relation
 * carries provenance for that statement exactly as a rule value does, is scoped
 * to the families/concepts it genuinely covers, and is absent by default.
 * Absence is not a failure mode to be papered over: two conflicting rules with
 * no stated relationship produce an unresolved conflict, which is the honest
 * answer and the one a reviewer can act on.
 *
 * Deliberately NOT modelled:
 *  - a global numeric priority ("priority: 100"). A rank invents a total order
 *    across instruments that no by-law states, and buries the legal assumption
 *    in an integer nobody can audit. Relationships are pairwise and explicit.
 *  - "most restrictive wins" as a default. It is available ONLY per-concept via
 *    an explicit NARROWS relation whose direction the metadata states outright.
 *  - "newer source wins". Publication recency is not legal succession; see the
 *    temporal handling in rule-pack-composer.ts.
 */
import type { E85RuleFamily } from "./rule-family-types";
import type { E85RuleConceptKey } from "./rule-concept-identity";
import type { E85Provenance } from "./provenance-types";
import type { E85TemporalWindow } from "./evidence-types";

/**
 * What kind of instrument a rule pack is. PURELY DESCRIPTIVE — it labels the
 * pack for reviewers and for future source-discovery policy, and confers no
 * precedence whatsoever. See `precedence-resolution.ts`, which never reads it.
 */
export type E85CompositionRole =
  /** The base zoning/district instrument for the zone. */
  | "BASE"
  /** An additional regulatory layer applying on top of a base instrument. */
  | "OVERLAY"
  /** A parcel-specific negotiated instrument (comprehensive development, planned unit development, and equivalents). */
  | "SITE_SPECIFIC"
  /** A negotiated agreement (housing, heritage, servicing, and equivalents). */
  | "AGREEMENT"
  /** A density/amenity bonus schedule or equivalent incentive instrument. */
  | "BONUS_SCHEDULE"
  /** Anything else. Never a hint to guess at hierarchy. */
  | "OTHER";

/**
 * How one pack relates to another, as STATED BY AN AUTHORITY.
 *
 *   OVERRIDES   — the subject's values displace the object's, within scope.
 *   SUPPLEMENTS — the packs coexist within scope. Note carefully: this does NOT
 *                 resolve a same-concept disagreement. Declaring that two
 *                 instruments work together says nothing about which number
 *                 governs when they state the same quantity differently, so a
 *                 genuine conflict inside a SUPPLEMENTS scope stays unresolved.
 *   NARROWS     — within scope, the more restrictive of the two values governs,
 *                 in the direction `restrictiveDirection` states. This is the
 *                 ONLY route to restrictive-wins behaviour in E85, it is opt-in
 *                 per relation, and the direction must be stated rather than
 *                 guessed from a field name.
 */
export type E85PrecedenceRelationType = "OVERRIDES" | "SUPPLEMENTS" | "NARROWS";

/** Which way "more restrictive" runs for a NARROWS relation. Stated by the relation because it is a legal reading, not a property of the number. */
export type E85RestrictiveDirection = "LOWER_IS_MORE_RESTRICTIVE" | "HIGHER_IS_MORE_RESTRICTIVE";

/**
 * What a relation covers. Both fields are matched EXACTLY — no prefix matching,
 * no family widening, no wildcards.
 *
 * Omitting both means the relation covers every concept the two packs share.
 * That is a broad claim, so it should be used only when the authority's own
 * statement is that broad; a relation about height should name height, or a
 * pack-level override will quietly reach families it was never about.
 */
export interface E85PrecedenceScope {
  /** Rule families covered. Undefined means "not limited by family". */
  families?: readonly E85RuleFamily[];
  /** Exact concept keys covered, e.g. "DIMENSIONAL:maxHeightMetres". Undefined means "not limited by concept". */
  conceptKeys?: readonly E85RuleConceptKey[];
}

/**
 * One authority-stated relationship between two rule packs.
 *
 * `provenance` is required, not optional. A relation without a source is an
 * assumption wearing a contract's clothing, and the whole point of this type is
 * that a reviewer can ask "who says so?" and get a document locator back.
 */
export interface E85PrecedenceRelation {
  /** Stable id for this relation, used in findings and audit records. */
  relationId: string;
  /** The pack whose rules take precedence (OVERRIDES/NARROWS) or which adds to the other (SUPPLEMENTS). */
  subjectPackId: string;
  /** The pack being overridden/supplemented/narrowed. */
  objectPackId: string;
  type: E85PrecedenceRelationType;
  /** Undefined means the relation is not scope-limited. Prefer naming the families/concepts the authority actually addressed. */
  scope?: E85PrecedenceScope;
  /** Required for NARROWS, meaningless otherwise. A NARROWS relation without it is malformed and is refused rather than defaulted. */
  restrictiveDirection?: E85RestrictiveDirection;
  /** Where this relationship is stated. Required — see the note above. */
  provenance: E85Provenance;
  /** Exact condition text that must appear in the caller's affirmed conditions before this relation applies. Matched verbatim; never assumed satisfied. */
  conditionalOn?: string;
  /** When the relationship itself is in force, when the authority states it. Absent means no temporal limit was stated — not "always". */
  temporal?: E85TemporalWindow;
  /** Interpretive note for a reviewer, when reading the authority required judgment. */
  interpretationNote?: string;
}

/** Why a precedence relation could not be used. Every one is a data condition a caller can hit, so all are returned, never thrown. */
export type E85PrecedenceProblemCode =
  /** The relation names a pack that is not among the packs being composed. */
  | "UNKNOWN_PACK_REFERENCE"
  /** The relation is structurally invalid (self-reference, NARROWS without a direction, duplicate relationId). */
  | "MALFORMED_RELATION"
  /** Two relations make incompatible claims about the same pair and scope. */
  | "CONFLICTING_PRECEDENCE_DECLARATIONS"
  /** The override graph contains a cycle, so no pack in it can be said to win. */
  | "PRECEDENCE_CYCLE";

export interface E85PrecedenceProblem {
  code: E85PrecedenceProblemCode;
  /** Relation ids involved, in sorted order so the record is deterministic. */
  relationIds: readonly string[];
  /** Pack ids involved, in sorted order. */
  packIds: readonly string[];
  detail: string;
}

/** Whether a relation's scope covers a given concept. Exact matching only. */
export function precedenceScopeCovers(scope: E85PrecedenceScope | undefined, family: E85RuleFamily, conceptKey: E85RuleConceptKey): boolean {
  if (scope === undefined) return true;
  if (scope.families !== undefined && !scope.families.includes(family)) return false;
  if (scope.conceptKeys !== undefined && !scope.conceptKeys.includes(conceptKey)) return false;
  return true;
}

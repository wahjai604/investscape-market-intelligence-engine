/**
 * InvestScape™ E85 Phase 3 — Zoning & Land-Use Rules Engine: policy
 * scaffolding.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Versioned policy TYPE SCAFFOLDING ONLY (Phase 2 correction 12) — no
 * policy logic/values beyond what's needed to type the concept. A future
 * phase will define actual synonym tables, precedence rules, geometry
 * tolerances, etc.; this phase only names the concepts and gives them a
 * versioned home.
 */

/** Placeholder concept names a future policy version will define values for. Deliberately a plain string-literal union rather than an open string, so adding a new policy concept is a visible, reviewed type change. */
export type E85PolicyConceptName =
  /** How raw source terminology (e.g. "Discretionary" vs. "Conditional Approval Use") normalizes onto E85UsePermissionStatus. */
  | "USE_TERMINOLOGY_SYNONYM_NORMALIZATION"
  /** How E85 selects which version of a rule was in force for a given as-of date when multiple temporal windows overlap or gap. */
  | "TEMPORAL_SELECTION"
  /** How E85 resolves precedence between competing rules (e.g. base zoning vs. overlay) when not resolved by evidence alone — distinct from case-specific OVERLAY_PRECEDENCE_UNRESOLVED manual-review instances, this is the general policy for the common/well-evidenced case. */
  | "RULE_PRECEDENCE"
  /** Tolerance permitted when matching parcel geometry to zone boundaries, for a future geometry-aware mode. Not used in Rule-Only Mode v1. */
  | "GEOMETRY_TOLERANCE"
  /** What E85 does when asked about a jurisdiction it does not cover (e.g. always DATA_GAP with JURISDICTION_UNSUPPORTED vs. some other behavior). */
  | "UNSUPPORTED_JURISDICTION_BEHAVIOR";

/** A versioned bundle of policy concepts. Each concept's actual VALUE is intentionally typed as `unknown` at this phase — defining the real shape of e.g. a synonym table is future-phase work; this phase only guarantees every concept has a documented, versioned slot. */
export interface E85PolicyVersion {
  policyVersionId: string;
  effectiveFrom: string;
  /** Free-text description of what changed from the prior version, when applicable. */
  changeNote?: string;
  concepts: Readonly<Partial<Record<E85PolicyConceptName, unknown>>>;
}

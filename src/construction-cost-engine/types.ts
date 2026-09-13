/**
 * InvestScape™ E88 Phase 2 — Construction Cost Engine: core types.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * E88 is a read-only consumer of E86 (src/cre-intelligence/), frozen at v1.0,
 * and does not modify E87 (src/cap-rate-engine/). Every E86 import below is a
 * plain named type import; nothing here requires editing an E86 or E87 file.
 *
 * E86 types are reused ONLY where they are genuinely foundational
 * (CREGeography, CRELocationType, CREAssetClass, CRECitedObservation,
 * CRESource) — exactly the same reuse boundary E87 already drew in its own
 * comparability-types.ts. Everything construction-cost-specific (currency,
 * unit/area basis, hard/soft/total representation, the request/candidate/
 * comparability contracts) is defined here, E88-owned, because E86 has no
 * equivalent semantics for them (E86's `CostBasis` has no $/m² or
 * total-development-cost concept at all — see Phase 1 spec Section 9).
 */
import type {
  CREAssetClass,
  CREGeography,
  CRELocationType,
  CRECitedObservation,
} from "../cre-intelligence/types";
import type { CREPresentationFreshness } from "../cre-intelligence/ingestion/observation-lifecycle";
import type { CanonicalConstructionSubtype } from "./taxonomy";

/**
 * Only currencies any observation in this codebase actually carries today
 * (Phase 1 Section 13: no FX conversion has ever been invented). Adding a
 * third currency here without a corresponding data source would be premature.
 */
export type CCCurrency = "USD" | "CAD";

/**
 * Unit/area basis a construction-cost figure can be expressed in. Extends
 * E86's `CostBasis` (which has no $/m² concept) with the metric equivalent,
 * per Phase 1 Section 9's normalization model. "index" and
 * "percent_of_hard_cost" are carried through unchanged from E86 so a
 * construction_index / construction_cost_change observation can still be
 * represented and explicitly excluded from cost-benchmarking (Section 6.3:
 * these are never dollar figures).
 */
export type CCUnitBasis = "per_sf" | "per_sm" | "per_unit" | "percent_of_hard_cost" | "index";

/**
 * The hard/soft/total distinction that governs the Phase 1 Decision 5 gating
 * rule. "total_cost" exists as a REQUEST concept even though no observation
 * in this codebase has ever stated it as a metric — see Phase 1 Section 9:
 * "a 'total development cost' figure does not exist as an E86/E88 metric and
 * should not be synthesized by adding [hard + soft] without an explicit
 * soft-cost source."
 */
export type CCCostRepresentation = "hard_cost" | "soft_cost" | "total_cost";

export type CCMeasurementSystem = "imperial" | "metric";

/** 1 square metre in square feet. A fixed, published unit-conversion constant — never an invented assumption. */
export const SQ_M_PER_SQ_FT = 0.09290304;
export const SQ_FT_PER_SQ_M = 1 / SQ_M_PER_SQ_FT;

/**
 * The requested construction-cost benchmark identity. Every field the
 * request leaves undefined WIDENS the candidate pool on that dimension — it
 * never causes a silent narrowing or a guessed value (identical principle to
 * E87's `E87ComparabilityRequest`).
 *
 * `costRepresentation` is REQUIRED (unlike E87's optional `capRateType`)
 * because Phase 1 Decision 5 depends on the caller stating up front whether
 * hard cost, soft cost, or total cost was actually asked for — the gating
 * logic in pipeline.ts cannot honestly run against an unstated representation.
 */
export interface ConstructionCostRequest {
  geography: CREGeography;
  locationType?: CRELocationType;
  assetClass: CREAssetClass;
  /** Canonical (E88) subtype, per taxonomy.ts — never a raw publisher-native string. */
  canonicalSubtype?: CanonicalConstructionSubtype;
  costRepresentation: CCCostRepresentation;
  unitBasis?: CCUnitBasis;
  currency?: CCCurrency;
  effectivePeriod?: { start: string; end: string };
  /** Hard freshness gate, applied identically to E87's `minFreshness` semantics. */
  minFreshness?: CREPresentationFreshness;
  asOf?: string;
}

/**
 * Per-observation input to the comparability engine. E88 never recomputes
 * freshness itself — the same hard E86 dependency E87 already documents.
 * `freshness` should be the `CREPresentationFreshness` a caller already
 * computed via E86's `assessFreshness` for this observation's backing source.
 * Undefined is treated honestly as "not assessed," never guessed.
 */
export interface ConstructionCostCandidateInput {
  observation: CRECitedObservation;
  freshness?: CREPresentationFreshness;
}

/**
 * One transformation applied during normalization, or explicitly not
 * applied. Every normalization step must be auditable (Phase 1 Section 9 /
 * Phase 2 objective 3) — nothing here is a silent rewrite of the original
 * value.
 */
export interface NormalizationTransformation {
  dimension: "currency" | "unit_basis" | "measurement_system" | "cost_representation" | "geography" | "subtype_mapping";
  /** What was done, or explicitly why nothing was done. */
  description: string;
  method: string;
  applied: boolean;
}

/**
 * A construction-cost observation after E88's normalization pass. `original`
 * is the E86 `CRECitedObservation` carried through verbatim — normalization
 * never mutates it, and every derived field below can be traced back to it
 * via `transformations`.
 */
export interface NormalizedConstructionCostObservation {
  original: CRECitedObservation;
  costRepresentation: CCCostRepresentation;
  currency?: CCCurrency;
  unitBasis?: CCUnitBasis;
  measurementSystem?: CCMeasurementSystem;
  /** Normalized low/high/value, present only when the source published them and no unresolvable conversion was required. */
  low?: number;
  high?: number;
  value?: number;
  /** Canonical-taxonomy mapping for this observation's source-native subtype, per taxonomy.ts. Never upgraded past the mapping's own confidence. */
  subtypeMapping: import("./taxonomy").ConstructionSubtypeMapping;
  transformations: NormalizationTransformation[];
}

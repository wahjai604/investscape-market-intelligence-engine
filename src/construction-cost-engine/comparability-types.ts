/**
 * InvestScape™ E70 Phase 2 — Construction Cost Comparability Layer: types.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Architecturally analogous to E69's comparability-types.ts, but
 * independently owned by E70 — this file does not import from
 * src/cap-rate-engine/ at all, and E69 is not modified anywhere in this work.
 */
import type { CRECitedObservation } from "../cre-intelligence/types";
import type { MappingConfidence } from "./taxonomy";
import type { ConstructionCostRequest, NormalizedConstructionCostObservation } from "./types";

/** The four-tier vocabulary reused verbatim from E68/E70's taxonomy.ts. */
export type CCMatchLevel = MappingConfidence;

/**
 * A single comparability dimension's result. "not_constrained" means the
 * REQUEST did not specify anything on this axis — such dimensions never
 * participate in the overall floor (see `combineDimensions` in
 * comparability.ts), matching E69's identical convention.
 */
export interface CCDimensionResult {
  level: CCMatchLevel | "not_constrained";
  reason: string;
}

/**
 * Every dimension the Phase 2 objectives require: geography, geography type,
 * building type, subtype (via taxonomy mapping), cost representation
 * (hard/soft/total), unit/basis, currency, period, source freshness, and
 * representation (source-native subtype identity, distinct from the
 * canonical-taxonomy-mapped subtypeMatch).
 */
export interface CCComparabilityDimensions {
  geographyMatch: CCDimensionResult;
  geographyTypeMatch: CCDimensionResult;
  assetMatch: CCDimensionResult;
  subtypeMatch: CCDimensionResult;
  costRepresentationMatch: CCDimensionResult;
  unitBasisMatch: CCDimensionResult;
  currencyMatch: CCDimensionResult;
  periodMatch: CCDimensionResult;
  freshnessMatch: CCDimensionResult;
}

export type CCInclusionDecision = "INCLUDED" | "EXCLUDED";

/**
 * Machine-readable exclusion reasons, scoped to comparability only — distinct
 * from E70's own `CCDataGapReasonCode` (gap-types.ts), which answers "why does
 * no benchmark exist for this request at all" rather than "why was this one
 * candidate excluded."
 */
export type CCExclusionReasonCode =
  | "WRONG_ASSET_TYPE"
  | "WRONG_SUBTYPE_MAPPING"
  | "WRONG_GEOGRAPHY"
  | "WRONG_GEOGRAPHY_TYPE"
  | "WRONG_COST_REPRESENTATION"
  | "CURRENCY_MISMATCH"
  | "INCOMPATIBLE_UNIT_BASIS"
  | "STALE"
  | "UNAVAILABLE"
  | "INSUFFICIENT_PROVENANCE"
  | "OTHER";

/**
 * The full, auditable verdict for one candidate observation against one
 * request. `normalized` is carried through so a consumer never needs to
 * re-derive currency/unit/subtype-mapping information already computed.
 */
export interface ConstructionCostComparabilityCandidate {
  observation: CRECitedObservation;
  /**
   * Absent only when the observation could not be normalized as a cost
   * observation at all (e.g. a construction_index/construction_cost_change
   * metric — Phase 1 Section 6.3: these are never dollar figures). Such a
   * candidate is always EXCLUDED; there is no normalized cost view to
   * fabricate for it.
   */
  normalized?: NormalizedConstructionCostObservation;
  /** Floor across every dimension the request actually constrains. */
  comparability: CCMatchLevel;
  dimensions: CCComparabilityDimensions;
  decision: CCInclusionDecision;
  /** Present only when decision === "EXCLUDED". */
  exclusionReasonCode?: CCExclusionReasonCode;
  /** Deterministic, machine-readable, human-presentable audit text. */
  explanation: string;
  /** Non-blocking caveats — never silently dropped, never blocking inclusion on their own. */
  warnings: string[];
}

export interface ConstructionCostComparabilityResult {
  request: ConstructionCostRequest;
  /** Every candidate evaluated, included and excluded alike — nothing silently dropped. */
  candidates: ConstructionCostComparabilityCandidate[];
  included: ConstructionCostComparabilityCandidate[];
  excluded: ConstructionCostComparabilityCandidate[];
}

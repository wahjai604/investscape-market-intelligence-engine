/**
 * InvestScape™ E69 Phase 2 — Cap-Rate Comparability Layer: types.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * E69 is a read-only consumer of E68 (src/cre-intelligence/), frozen at v1.0.
 * Nothing in this directory imports anything that would require editing an
 * E68 file; every E68 import below is a plain named import from E68 source.
 *
 * This file defines ONLY the Phase 2 scope: a request describing the desired
 * cap-rate benchmark identity, and the per-candidate comparability/inclusion
 * output. It deliberately does NOT define consensus, dispersion, scenario, or
 * transaction-derivation types — those are future phases (see
 * docs/E69-phase1-technical-specification.md Part 20).
 */
import type {
  CRECapRateType,
  CREAssetClass,
  CREGeography,
  CRELocationType,
  CREPropertyClass,
  CRECitedObservation,
} from "../cre-intelligence/types";
import type { MappingConfidence } from "../cre-intelligence/mapping";
import type { CREPresentationFreshness } from "../cre-intelligence/ingestion/observation-lifecycle";

/**
 * The requested cap-rate benchmark identity. Every field the request leaves
 * undefined WIDENS the candidate pool on that dimension; it never causes a
 * silent narrowing or a guessed value. This mirrors
 * `benchmark-selection.ts`'s `matchesIdentity` principle: "only filter on a
 * dimension the request actually specifies."
 *
 * Reuses E68 types verbatim wherever the concept already exists there
 * (`CREGeography`, `CRELocationType`, `CREAssetClass`, `CREPropertyClass`,
 * `CRECapRateType`) rather than duplicating enums.
 */
export interface E69ComparabilityRequest {
  /** country is required (CREGeography.country); region/metro/city/submarket are optional narrowings. */
  geography: CREGeography;
  /** Downtown/CBD/suburban/urban/source-defined geography type. */
  locationType?: CRELocationType;
  assetClass: CREAssetClass;
  /** Source-native building subtype, e.g. "office_prime". */
  propertySubtype?: string;
  propertyClass?: CREPropertyClass;
  /**
   * Pinning a specific cap-rate concept (stabilized/going_in/exit/etc.)
   * narrows comparability per Part 6 of the Phase 1 spec: only an identical
   * `capRateType` is EXACT, and a different `CAP_RATE_FAMILY` is never
   * silently substituted for a pinned type (mirrors `consensus.ts`'s
   * `assertComparableCapRates` guard). Leaving this undefined does not
   * request a specific representation and widens the pool.
   */
  capRateType?: CRECapRateType;
  /** The period the benchmark should describe. Undefined = any period, ranked purely on freshness. */
  effectivePeriod?: { start: string; end: string };
  /**
   * Desired minimum freshness tier (Part 9/11 of Phase 1 spec). When set, a
   * candidate whose assessed freshness ranks below this is EXCLUDED
   * (reason STALE/UNAVAILABLE) rather than merely down-scored — this is the
   * one hard freshness gate Phase 2 applies; everything else about a stale
   * observation is preserved as a legitimate historical fact, never deleted
   * or silently promoted.
   */
  minFreshness?: CREPresentationFreshness;
  /** ISO date this request is evaluated as of. Informational only in Phase 2 (no age-based math beyond periodMatch/minFreshness). */
  asOf?: string;
}

/**
 * Per-observation input to the comparability engine. E69 never recomputes
 * freshness itself — Part 14 of this phase's documentation records this as a
 * hard E68 dependency. `freshness` should be the `CREPresentationFreshness`
 * an E68-Phase-8 caller already computed via `assessFreshness` for this
 * observation's backing source. When a caller has not computed it, leave it
 * undefined; the engine treats that honestly as "not assessed" rather than
 * guessing a tier.
 */
export interface E69CandidateInput {
  observation: CRECitedObservation;
  freshness?: CREPresentationFreshness;
}

/** The four-tier vocabulary this file reuses verbatim from E68's `mapping.ts`. */
export type E69MatchLevel = MappingConfidence;

/**
 * A single comparability dimension's result. `"not_constrained"` means the
 * REQUEST did not specify anything on this axis — it is not a match tier at
 * all, and dimensions in this state never participate in the overall floor
 * (see `combineDimensions` in comparability.ts).
 */
export interface E69DimensionResult {
  level: E69MatchLevel | "not_constrained";
  reason: string;
}

/**
 * Multi-level match exposure (spec requirement: "don't reduce comparability
 * to a single boolean"). Every field is populated for every candidate,
 * whether or not the request constrains it, so a future consensus phase can
 * weight/filter on any axis without recomputing comparability.
 */
export interface E69ComparabilityDimensions {
  geographyMatch: E69DimensionResult;
  geographyTypeMatch: E69DimensionResult;
  assetMatch: E69DimensionResult;
  subtypeMatch: E69DimensionResult;
  classMatch: E69DimensionResult;
  periodMatch: E69DimensionResult;
  freshnessMatch: E69DimensionResult;
  representationMatch: E69DimensionResult;
}

export type E69InclusionDecision = "INCLUDED" | "EXCLUDED";

/**
 * Machine-readable exclusion reasons. Reuses E68's `CREDataGapReasonCode`
 * vocabulary is deliberately NOT done here: those eight codes describe a
 * SOURCE's inability to publish something at ingestion time; none of them
 * answer "this specific observation doesn't fit THIS request," which is an
 * E69-Phase-2 concern (Part 13 of the Phase 1 spec proposes exactly this kind
 * of extension). These codes are net-new and scoped to comparability only.
 */
export type E69ExclusionReasonCode =
  | "WRONG_ASSET_TYPE"
  | "WRONG_ASSET_SUBTYPE"
  | "WRONG_GEOGRAPHY"
  | "WRONG_GEOGRAPHY_TYPE"
  | "WRONG_PROPERTY_CLASS"
  | "STALE"
  | "UNSUPPORTED_MAPPING"
  | "INCOMPATIBLE_REPRESENTATION"
  | "INSUFFICIENT_PROVENANCE"
  | "UNAVAILABLE"
  | "OTHER";

/**
 * The full, auditable verdict for one candidate observation against one
 * request. `observation` is carried through verbatim (never mutated, never
 * copied-and-changed) so a consumer can always trace back to the exact E68
 * record this verdict describes.
 */
export interface E69ComparabilityCandidate {
  observation: CRECitedObservation;
  /** Floor across every dimension the request actually constrains. */
  comparability: E69MatchLevel;
  dimensions: E69ComparabilityDimensions;
  decision: E69InclusionDecision;
  /** Present only when decision === "EXCLUDED". */
  exclusionReasonCode?: E69ExclusionReasonCode;
  /**
   * Deterministic, machine-readable, human-presentable audit text. For an
   * INCLUDED candidate: names which dimensions matched and at what tier. For
   * an EXCLUDED candidate: names the specific mismatch and reason code.
   */
  explanation: string;
  /** Non-blocking caveats (never silently dropped, never blocking inclusion on their own). */
  warnings: string[];
}

export interface E69ComparabilityResult {
  request: E69ComparabilityRequest;
  /** Every candidate evaluated, included and excluded alike — nothing is silently dropped. */
  candidates: E69ComparabilityCandidate[];
  included: E69ComparabilityCandidate[];
  excluded: E69ComparabilityCandidate[];
}

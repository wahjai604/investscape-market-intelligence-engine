/**
 * InvestScape™ E70 Phase 4 — Escalation / Index Integration: core types.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * E70 is a read-only consumer of E68 (src/cre-intelligence/), frozen at v1.0,
 * and does not modify E69 (src/cap-rate-engine/) either. Every E68 import
 * below is a plain named type import from E68 source; nothing here requires
 * editing an E68 or E69 file.
 *
 * Resolves E70 Phase 1 Open Design Decision 3 (docs/E70-phase1-technical-
 * specification.md Section 22): escalation is E70-owned, operating as a
 * read-only consumer of E68's existing construction_index observations
 * (US_CITY_CONSTRUCTION_INDEX_OBSERVATIONS, US_NATIONAL_CONSTRUCTION_INDEX_
 * OBSERVATIONS). No new index VALUE is invented anywhere in this file — it
 * defines the contracts other Phase 4 files (escalation-policy.ts,
 * applicability.ts, escalation.ts) implement against.
 *
 * These types are a superset of E68's own minimal `EscalationResult` shape
 * (types.ts line ~308: baseCost/basePeriod/targetPeriod/indexRatio/
 * escalatedCost) — that E68 type is a plain data shape with no provenance,
 * geography, or audit trail, and predates any implementation. E70 does not
 * import or extend it: doing so would not add anything E70 does not already
 * need to define itself, and would blur the frozen E68/E70 seam for no
 * benefit. E70's richer shape below is the actual Phase 4 contract.
 */
import type { CRECitedObservation, CREGeography } from "../cre-intelligence/types";
import type { CCCurrency } from "./types";
import type { SourceDecision } from "./source-research";

/**
 * The only index series this phase can actually evaluate, per the Phase 1/3
 * audit of what E68/E70 data actually contains (Phase 4 Implementation
 * Safety step 3/4/5). Adding a series id here does NOT imply observations
 * exist for it — see data/index-series.ts for what is actually populated.
 */
export type CCIndexSeriesId =
  | "rlb-city-comparative-cost-index"
  | "rlb-national-construction-cost-index"
  | "statcan-bcpi";

/**
 * Whether an index series describes a specific city/CMA or a whole country.
 * Never used to silently treat "national" as "the same as any city" — see
 * applicability.ts's explicit rule table for how (if at all) a national
 * series may pair with a city-level cost observation.
 */
export type CCIndexGeographyType = "city" | "national" | "cma";

export type CCIndexPeriodGranularity = "annual" | "quarterly" | "monthly";

/**
 * Series-level metadata: what an index IS, independent of any single
 * observation. `sourceStatus` is E70's own USE/REGISTER/REJECT verdict
 * (source-research.ts) — the escalation policy (escalation-policy.ts) gates
 * on this explicitly rather than assuming a registry entry means usable data
 * exists (Phase 4 Implementation Safety step 7).
 */
export interface CCIndexSeries {
  seriesId: CCIndexSeriesId;
  seriesName: string;
  /** E68 CRESource.sourceId this series' observations are cited to. */
  sourceId: string;
  geographyType: CCIndexGeographyType;
  periodGranularity: CCIndexPeriodGranularity;
  /**
   * The currency of COST observations this series may defensibly pair with.
   * The index values themselves are unitless index points (never dollars —
   * Phase 1 Section 6.3) — this field states the currency-denominated cost
   * universe the publisher intends the series to escalate, not a property of
   * the index number itself.
   */
  applicableCurrency: CCCurrency;
  sourceStatus: SourceDecision;
  /** Free-text note on why this series is/isn't usable today. */
  statusNote: string;
}

/**
 * One index data point. Deliberately a thin wrapper around the actual E68
 * `CRECitedObservation` (metric "construction_index") rather than a
 * reinvention — the citation, source, and period already live there and
 * must not be duplicated or restated by hand (duplication risks drift).
 */
export interface CCIndexObservation {
  series: CCIndexSeries;
  /** The underlying E68-cited construction_index observation, verbatim. */
  observation: CRECitedObservation;
}

/**
 * Deterministic applicability verdict for one (cost observation, index
 * series) pair. `relationship` is populated only when `applicable` is true.
 */
export type CCIndexRelationship = "DIRECT" | "INDIRECT";

/** Which check disqualified a series, so escalation.ts can map to a precise DATA_GAP reason code without string-sniffing free text. */
export type CCIndexApplicabilityFailureCategory = "METRIC" | "SOURCE_STATUS" | "CURRENCY" | "GEOGRAPHY";

export interface CCIndexApplicabilityResult {
  applicable: boolean;
  relationship?: CCIndexRelationship;
  reason: string;
  /** Present only when applicable === false. */
  failureCategory?: CCIndexApplicabilityFailureCategory;
}

/** A period, as stated by a source — never invented or interpolated. */
export interface CCPeriod {
  start: string;
  end: string;
  /** Human-readable label as the source states it, e.g. "Q2 2026" or "April 2026". */
  label: string;
}

/**
 * A request to escalate one cost observation to a target period. Every
 * field the caller does not have (e.g. a policy override) is optional — see
 * escalation-policy.ts for the default that applies when `policy` is
 * omitted.
 */
export interface EscalationRequest {
  /** The historical/base-period observation to escalate. Never mutated. */
  sourceObservation: CRECitedObservation;
  targetPeriod: CCPeriod;
  policy?: import("./escalation-policy").CCEscalationPolicy;
  /** Caller-supplied, not `Date.now()` — mirrors pipeline.ts's `checkedAt` determinism requirement. */
  computedAt: string;
}

/** Every calculation step, in order, so the arithmetic can be independently reproduced. */
export interface EscalationCalculationAudit {
  formula: string;
  baseIndexValue: number;
  targetIndexValue: number;
  indexRatio: number;
  steps: readonly string[];
}

/** A cost figure at a point in time: low/high/value mirror E68's own optional-range convention (never a manufactured midpoint). */
export interface CCCostFigure {
  low?: number;
  high?: number;
  value?: number;
  unit: string;
  currency: CCCurrency;
}

export interface EscalationResult {
  /** The original E68 observation, carried through byte-for-byte, never mutated. */
  sourceObservation: CRECitedObservation;
  baseCost: CCCostFigure;
  basePeriod: CCPeriod;
  targetPeriod: CCPeriod;
  /** Present only for a genuine index-ratio escalation; absent for a trivial same-period identity escalation (see escalation-policy.ts). */
  indexSeries?: CCIndexSeries;
  baseIndexObservation?: CRECitedObservation;
  targetIndexObservation?: CRECitedObservation;
  relationship: CCIndexRelationship | "IDENTICAL_PERIOD";
  escalatedCost: CCCostFigure;
  calculation: EscalationCalculationAudit;
  policyVersion: string;
  computedAt: string;
}

export type EscalationDataGapReasonCode =
  | "MISSING_BASE_COST"
  | "INVALID_COST_VALUE"
  | "MISSING_BASE_INDEX"
  | "MISSING_TARGET_INDEX"
  | "UNSUPPORTED_GEOGRAPHY"
  | "INCOMPATIBLE_CURRENCY"
  | "INCOMPATIBLE_METRIC"
  | "INCOMPATIBLE_INDEX_SERIES"
  | "UNRESOLVED_PERIOD"
  | "INSUFFICIENT_INDEX_EVIDENCE"
  | "SOURCE_NOT_VERIFIED"
  | "INVALID_INDEX_VALUE";

export const ESCALATION_DATA_GAP_REASON_LABELS: Readonly<Record<EscalationDataGapReasonCode, string>> = {
  MISSING_BASE_COST: "The source observation has no usable base cost value.",
  INVALID_COST_VALUE: "The source observation's cost value is zero, negative, or otherwise non-positive.",
  MISSING_BASE_INDEX: "No index observation exists for the base period in any applicable series.",
  MISSING_TARGET_INDEX: "No index observation exists for the target period in any applicable series.",
  UNSUPPORTED_GEOGRAPHY: "No index series has an established, defensible applicability relationship to this observation's geography.",
  INCOMPATIBLE_CURRENCY: "No index series applies to this observation's currency.",
  INCOMPATIBLE_METRIC: "The source observation is not a hard_cost or soft_cost observation and cannot be escalated as a cost.",
  INCOMPATIBLE_INDEX_SERIES: "The requested index series is not applicable to this observation.",
  UNRESOLVED_PERIOD: "The base or target period could not be resolved to a defensible index observation.",
  INSUFFICIENT_INDEX_EVIDENCE: "The available index evidence is insufficient (missing, conflicting, or duplicated) to compute a defensible ratio.",
  SOURCE_NOT_VERIFIED: "The index source is registered or rejected, not verified for active use (USE), and cannot be used to escalate a cost.",
  INVALID_INDEX_VALUE: "An index observation exists but its value is non-positive and cannot be used.",
};

export interface EscalationDataGap {
  request: { sourceObservation: CRECitedObservation; targetPeriod: CCPeriod };
  reasonCode: EscalationDataGapReasonCode;
  /** What was requested, what evidence was available, why it was insufficient — never an intention. */
  reason: string;
  /** Every index series actually considered, whether it turned out applicable or not. */
  seriesConsidered: readonly CCIndexSeries[];
  /** What would resolve the gap, only when genuinely true. */
  resolutionHint?: string;
  checkedAt: string;
}

export type EscalationOutcome =
  | { status: "ESCALATED"; result: EscalationResult }
  | { status: "DATA_GAP"; gap: EscalationDataGap };

export function formatEscalationGapMessage(gap: Pick<EscalationDataGap, "reasonCode" | "reason" | "resolutionHint">): string {
  const label = ESCALATION_DATA_GAP_REASON_LABELS[gap.reasonCode];
  const hint = gap.resolutionHint ? ` ${gap.resolutionHint}` : "";
  return `${label} ${gap.reason}${hint}`;
}

/** Re-exported for convenience; genuinely foundational (E68 geography shape). */
export type { CREGeography };

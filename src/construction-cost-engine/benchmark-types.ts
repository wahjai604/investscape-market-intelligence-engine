/**
 * InvestScape™ E70 Phase 5 — Unified Benchmark Output: core types.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * E70 is a read-only consumer of E68 (src/cre-intelligence/), frozen at v1.0,
 * and does not modify E69 (src/cap-rate-engine/). Every E68 import below is a
 * plain named type import from E68 source. Every Phase 2-4 import is a plain
 * named import from E70's own prior phases — nothing here reimplements
 * comparability, normalization, or escalation; benchmark.ts (Section below)
 * orchestrates those existing engines instead.
 *
 * This is the E70 architectural analogue of E69's unified benchmark result —
 * built independently, not by importing anything from src/cap-rate-engine/.
 */
import type { CREAssetClass, CREGeography } from "../cre-intelligence/types";
import type { CREPresentationFreshness } from "../cre-intelligence/ingestion/observation-lifecycle";
import type { CanonicalConstructionSubtype } from "./taxonomy";
import type { CCCostRepresentation, CCCurrency, CCUnitBasis, ConstructionCostRequest, NormalizationTransformation } from "./types";
import type { CCMatchLevel, ConstructionCostComparabilityCandidate } from "./comparability-types";
import type { CCDataGapReasonCode } from "./gap-types";
import type { CCEscalationPolicy } from "./escalation-policy";
import type { CCIndexRelationship, CCPeriod, EscalationDataGapReasonCode, EscalationOutcome } from "./index-types";

/**
 * A benchmark request is Phase 2's `ConstructionCostRequest` plus the
 * Phase 4 escalation dimension (optional) and an optional E70-local user
 * override. Nothing here widens Phase 2's own semantics — `targetPeriod`
 * absent means "answer as of whatever period the best evidence itself
 * covers," never a silent escalation and never a silent no-escalation
 * assumption; its presence means the caller explicitly wants that period.
 */
export interface ConstructionCostBenchmarkRequest extends ConstructionCostRequest {
  /** When present, the benchmark must be expressed as of this period via Phase 4 escalation, or DATA_GAP. */
  targetPeriod?: CCPeriod;
  /** Defaults to Phase 4's CC_DEFAULT_ESCALATION_POLICY when targetPeriod is set and this is omitted. */
  escalationPolicy?: CCEscalationPolicy;
}

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

/**
 * Reused across all three confidence components (Section: Confidence Model)
 * so they combine by a single floor rule without a unit mismatch. Modeled
 * directly on E69's four-tier confidence vocabulary (independently
 * re-implemented here, not imported — E70 does not depend on
 * src/cap-rate-engine/ at all).
 */
export type CCConfidenceTier = "high" | "moderate" | "low" | "very_low";

export interface CCConfidenceBreakdown {
  /** Derived from source quality + freshness of the contributing observation(s) — never from comparability. */
  dataConfidence: CCConfidenceTier;
  /** Derived directly from Phase 2's own `CCMatchLevel` for the contributing candidate(s) — consumed, not reimplemented. */
  comparabilityConfidence: CCConfidenceTier;
  /** floorConfidence(dataConfidence, comparabilityConfidence, and any applicable cap — single-observation, indirect-escalation) — NEVER an average. */
  benchmarkConfidence: CCConfidenceTier;
  /** Every cap/floor input that produced benchmarkConfidence, in order, for audit. */
  derivation: readonly string[];
}

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

/**
 * One contributing observation's full trace: which source, which
 * observation, which geography/subtype/period, whether it was escalated,
 * and which index evidence backed that escalation. Never flattened away —
 * every contributing observation gets its own entry.
 */
export interface BenchmarkProvenanceEntry {
  sourceId: string;
  sourceName: string;
  reportTitle: string;
  publicationDate: string;
  period: string;
  locator: string;
  sourceUrl: string;
  geography: CREGeography;
  propertySubtype?: string;
  comparability: CCMatchLevel;
  freshness?: CREPresentationFreshness;
  wasEscalated: boolean;
  /** Present only when wasEscalated. */
  escalation?: {
    relationship: CCIndexRelationship | "IDENTICAL_PERIOD";
    indexSeriesId?: string;
    baseIndexLocator?: string;
    targetIndexLocator?: string;
    indexRatio: number;
  };
}

// ---------------------------------------------------------------------------
// Contributing observation (internal-facing audit unit, exposed for full traceability)
// ---------------------------------------------------------------------------

export interface CCContributingObservation {
  candidate: ConstructionCostComparabilityCandidate;
  freshness?: CREPresentationFreshness;
  /** Present only when the request specified a targetPeriod (escalation was attempted for this candidate). */
  escalation?: EscalationOutcome;
  dataConfidence: CCConfidenceTier;
  comparabilityConfidence: CCConfidenceTier;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export type CCAggregationMethod = "SINGLE_OBSERVATION" | "RANGE_UNION";

export interface CCAggregationDecision {
  method: CCAggregationMethod;
  observationCount: number;
  /** Human-readable, deterministic explanation of exactly how the final figure was derived. */
  rationale: string;
}

// ---------------------------------------------------------------------------
// Cost figure (shared shape for un-escalated and escalated benchmark values)
// ---------------------------------------------------------------------------

export interface CCBenchmarkCostFigure {
  low?: number;
  high?: number;
  value?: number;
  unit: string;
  currency?: CCCurrency;
}

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

export interface CCBenchmarkAuditTrail {
  candidatesConsidered: number;
  candidatesIncluded: readonly ConstructionCostComparabilityCandidate[];
  candidatesExcluded: readonly ConstructionCostComparabilityCandidate[];
  /** One entry per candidate for which escalation was attempted, whichever way it resolved. */
  escalationDecisions: readonly { locator: string; outcome: "ESCALATED" | "DATA_GAP" | "NOT_REQUESTED"; detail: string }[];
  aggregationDecision: string;
  confidenceCalculation: string;
  pipelineStatus: "CANDIDATES_AVAILABLE" | "DATA_GAP";
}

// ---------------------------------------------------------------------------
// User override (E70-local; see benchmark.ts header for why this is not E69's)
// ---------------------------------------------------------------------------

/**
 * An explicit, user-supplied override of a benchmark figure. NEVER rewrites
 * a source observation, NEVER converts a DATA_GAP into fabricated source
 * evidence — the override is its own clearly-labeled thing, layered ON TOP
 * of (never destructive to) whatever the engine actually computed, exactly
 * mirroring the "layered on top of, never destructive to" precedent E69
 * documents for its own override contract (Phase 1 spec Section 5) — but
 * defined independently here, in E70, at E70's own field shapes.
 */
export interface CCUserOverride {
  overriddenValue: CCBenchmarkCostFigure;
  /** Free-text identifying who supplied the override (e.g. a user id/email) — never inferred. */
  overriddenBy: string;
  reason: string;
  appliedAt: string;
}

// ---------------------------------------------------------------------------
// Success result
// ---------------------------------------------------------------------------

export interface ConstructionCostBenchmarkResult {
  request: ConstructionCostBenchmarkRequest;
  identity: {
    geography: CREGeography;
    assetClass: CREAssetClass;
    canonicalSubtype?: CanonicalConstructionSubtype;
    costRepresentation: CCCostRepresentation;
    currency?: CCCurrency;
    unitBasis?: CCUnitBasis;
  };
  contributingObservations: readonly CCContributingObservation[];
  benchmark: CCBenchmarkCostFigure & { asOfPeriod: CCPeriod; escalated: boolean };
  /** Floor across every contributing candidate's own comparability tier. */
  comparability: CCMatchLevel;
  confidence: CCConfidenceBreakdown;
  aggregation: CCAggregationDecision;
  provenance: readonly BenchmarkProvenanceEntry[];
  auditTrail: CCBenchmarkAuditTrail;
  assumptions: readonly string[];
  /** Every transformation applied to every contributing observation, concatenated in provenance order. */
  transformations: readonly NormalizationTransformation[];
  /** Present only when a caller explicitly applied one via applyUserOverride(). */
  userOverride?: CCUserOverride;
  escalationPolicyVersion?: string;
  computedAt: string;
}

// ---------------------------------------------------------------------------
// DATA_GAP
// ---------------------------------------------------------------------------

/**
 * E70's OWN output-level taxonomy — deliberately NOT a reuse of E68's
 * `CREDataGapReasonCode` (a different question: "why doesn't a source
 * publish this at all") nor a flat re-export of Phase 2's `CCDataGapReasonCode`
 * or Phase 4's `EscalationDataGapReasonCode` (both preserved verbatim in the
 * `pipelineGapReasonCode`/`escalationGapReasonCode` fields below — nothing is
 * destroyed, only unified at the OUTPUT layer for a caller who does not need
 * to know Phase 2 from Phase 4 internals to handle a gap).
 */
export type BenchmarkDataGapReasonCode =
  /** No usable evidence at all: empty pool, wrong asset class, unsupported subtype mapping, or every candidate excluded for a reason not covered below. */
  | "NO_EVIDENCE"
  /** soft_cost or total_cost was requested and no soft-cost evidence exists to honestly serve it (never a fabricated percentage of hard cost). */
  | "TOTAL_COST_UNSUPPORTED"
  /** A currency or unit-basis conversion would be required and none is deterministically available (never an invented FX rate or unstated unit assumption). */
  | "CONVERSION_UNSUPPORTED"
  /** Every candidate was excluded purely on freshness grounds (a request-level minFreshness floor no evidence meets). Reserved distinctly from NO_EVIDENCE so a caller can tell "nothing exists" from "something exists but isn't fresh enough." */
  | "FRESHNESS_UNSUPPORTED"
  /** A targetPeriod was requested and Phase 4 escalation could not be performed for ANY qualifying candidate. */
  | "ESCALATION_UNAVAILABLE"
  /** Multiple top-tier-comparable observations exist but their ranges do not mutually overlap — disagreement is reported, never hidden behind an invented midpoint. */
  | "MATERIAL_DISAGREEMENT"
  /** The request itself is malformed (e.g. an unrecognized country) and cannot be honestly evaluated. */
  | "INVALID_REQUEST";

export const BENCHMARK_DATA_GAP_REASON_LABELS: Readonly<Record<BenchmarkDataGapReasonCode, string>> = {
  NO_EVIDENCE: "No qualifying construction-cost evidence exists for this request.",
  TOTAL_COST_UNSUPPORTED: "The requested cost representation (soft or total cost) requires soft-cost evidence, which does not exist.",
  CONVERSION_UNSUPPORTED: "A currency or unit-basis conversion is required to serve this request and none is deterministically available.",
  FRESHNESS_UNSUPPORTED: "Evidence exists but none meets the request's minimum freshness requirement.",
  ESCALATION_UNAVAILABLE: "A target-period escalation was requested but could not be performed for any qualifying observation.",
  MATERIAL_DISAGREEMENT: "Multiple comparable observations exist but materially disagree; no single benchmark can be honestly derived.",
  INVALID_REQUEST: "The request is malformed and cannot be evaluated.",
};

export interface ConstructionCostBenchmarkDataGap {
  request: ConstructionCostBenchmarkRequest;
  reasonCode: BenchmarkDataGapReasonCode;
  reason: string;
  requestedCostBasis: CCCostRepresentation;
  geography: CREGeography;
  canonicalSubtype?: CanonicalConstructionSubtype;
  currency?: CCCurrency;
  unitBasis?: CCUnitBasis;
  /** Every candidate actually evaluated, included or excluded — nothing silently dropped. */
  evidenceConsidered: readonly ConstructionCostComparabilityCandidate[];
  excludedEvidence: readonly ConstructionCostComparabilityCandidate[];
  /** The original Phase 2 pipeline reason code, preserved verbatim, when this gap originated there. */
  pipelineGapReasonCode?: CCDataGapReasonCode;
  /** The original Phase 4 escalation reason code, preserved verbatim, when this gap originated in escalation. */
  escalationGapReasonCode?: EscalationDataGapReasonCode;
  /** Provenance of whatever evidence WAS found, even though it could not resolve the request (e.g. hard-cost evidence preserved when total_cost was requested). */
  provenance: readonly BenchmarkProvenanceEntry[];
  resolutionHint?: string;
  checkedAt: string;
}

export function formatBenchmarkGapMessage(gap: Pick<ConstructionCostBenchmarkDataGap, "reasonCode" | "reason" | "resolutionHint">): string {
  const label = BENCHMARK_DATA_GAP_REASON_LABELS[gap.reasonCode];
  const hint = gap.resolutionHint ? ` ${gap.resolutionHint}` : "";
  return `${label} ${gap.reason}${hint}`;
}

export type ConstructionCostBenchmarkOutcome =
  | { status: "success"; result: ConstructionCostBenchmarkResult }
  | { status: "data_gap"; gap: ConstructionCostBenchmarkDataGap };

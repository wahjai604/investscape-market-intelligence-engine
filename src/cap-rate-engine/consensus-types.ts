/**
 * InvestScape™ E69 Phase 3 — Consensus & Benchmark Selection: types.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * E69 Phase 3 is a read-only consumer of Phase 2 (`comparability.ts` /
 * `comparability-types.ts`) and of E68 (`src/cre-intelligence/`, frozen at
 * v1.0). Nothing here re-implements comparability; every candidate this
 * layer considers already carries a Phase 2 `E69ComparabilityCandidate`
 * verdict. See docs/E69-phase3-consensus-and-benchmark.md for the full
 * design rationale.
 */
import type { CRECapRateType } from "../cre-intelligence/types";
import type { CREPresentationFreshness } from "../cre-intelligence/ingestion/observation-lifecycle";
import type { E69ComparabilityCandidate, E69ComparabilityRequest, E69ComparabilityResult, E69MatchLevel } from "./comparability-types";

/**
 * Cap-rate representation, per Phase 1 Part on representations. E68 does not
 * carry an explicit "representation" field — Phase 3 classifies it from the
 * shape of the observation (`value` vs `low`/`high`) and from `capRateType`,
 * with an explicit opt-out via `tags.representation` for a source that states
 * its own statistic (e.g. "median", "average", "p25"). Unknown/unrecognized
 * `tags.representation` values are `"unsupported"`, never guessed.
 */
export type E69Representation =
  | "point"
  | "range"
  | "median"
  | "average"
  | "percentile"
  | "transaction_derived"
  | "survey_estimate"
  | "unsupported";

/** Deterministic five-tier source hierarchy (Phase 3 Part on source hierarchy). */
export type E69SourceHierarchyTier =
  | "primary_specialist_research"
  | "primary_brokerage_research"
  | "transaction_derived_complete_provenance"
  | "secondary_aggregated"
  | "unsupported_unknown";

/** Ordinal rank, best (1) to worst (5). Never used to override comparability. */
export const SOURCE_HIERARCHY_RANK: Readonly<Record<E69SourceHierarchyTier, number>> = {
  primary_specialist_research: 1,
  primary_brokerage_research: 2,
  transaction_derived_complete_provenance: 3,
  secondary_aggregated: 4,
  unsupported_unknown: 5,
};

/** Two-axis confidence vocabulary. Combined ONLY by floor (min), never averaged. */
export type E69ConfidenceTier = "high" | "moderate" | "low" | "very_low";

export const CONFIDENCE_RANK: Readonly<Record<E69ConfidenceTier, number>> = {
  high: 3,
  moderate: 2,
  low: 1,
  very_low: 0,
};

export function floorConfidence(a: E69ConfidenceTier, b: E69ConfidenceTier): E69ConfidenceTier {
  return CONFIDENCE_RANK[a] <= CONFIDENCE_RANK[b] ? a : b;
}

/**
 * Configurable dispersion thresholds in basis points. Every default below is
 * PROVISIONAL — chosen for internal consistency and directional plausibility,
 * NOT empirically calibrated against a real cap-rate survey population. A
 * future phase must replace these with calibrated values (see
 * docs/E69-phase3-consensus-and-benchmark.md, "Future calibration
 * requirements"). Callers may override any threshold.
 */
export interface DispersionPolicy {
  /** <= this many bps of spread: "tight" clustering. PROVISIONAL default 15bps. */
  tightBps: number;
  /** <= this many bps: "moderate" clustering. PROVISIONAL default 40bps. */
  moderateBps: number;
  /** <= this many bps: "material" but still resolvable clustering. PROVISIONAL default 75bps. */
  materialBps: number;
  /** > materialBps is "severe" — never averaged; see Phase 3 doc "Conflict handling". */
}

export const DEFAULT_DISPERSION_POLICY: DispersionPolicy = {
  tightBps: 15,
  moderateBps: 40,
  materialBps: 75,
};

export type E69DispersionTier = "single_observation" | "tight" | "moderate" | "material" | "severe";

export interface E69Dispersion {
  /** Spread across contributing scalar values, in basis points (1bp = 0.01 percentage point). */
  bps: number;
  tier: E69DispersionTier;
  policy: DispersionPolicy;
  values: number[];
}

/**
 * Machine-readable DATA_GAP reason codes for Phase 3. Deliberately distinct
 * from E68's `CREDataGapReasonCode` (which describes a SOURCE's inability to
 * publish at ingestion time) and from Phase 2's `E69ExclusionReasonCode`
 * (which describes one candidate's mismatch against a request) — these
 * describe why the POOL, taken as a whole, cannot defensibly produce a
 * benchmark.
 */
export type E69BenchmarkGapReasonCode =
  | "NO_COMPARABLE_OBSERVATIONS"
  | "INSUFFICIENT_PROVENANCE"
  | "INCOMPATIBLE_CAP_RATE_FAMILY"
  | "MATERIAL_SOURCE_DISAGREEMENT"
  | "INSUFFICIENT_FRESHNESS"
  | "UNSUPPORTED_REPRESENTATION"
  | "INSUFFICIENT_EVIDENCE"
  | "OTHER";

/** Per-candidate Phase 3 enrichment, computed once and reused throughout. */
export interface E69EnrichedCandidate {
  candidate: E69ComparabilityCandidate;
  representation: E69Representation;
  scalarValue?: number;
  sourceHierarchyTier: E69SourceHierarchyTier;
  freshness?: CREPresentationFreshness;
  comparability: E69MatchLevel;
  /** Deterministic weight used only for within-group weighted consensus; never crosses family/type groups. */
  weight: number;
  /** Non-blocking Phase-3-specific note, e.g. why this candidate was dropped from consensus despite Phase-2 inclusion. */
  phase3ExclusionReason?: string;
}

export interface E69BenchmarkAuditEntry {
  sourceId: string;
  sourceName: string;
  capRateType?: CRECapRateType;
  representation: E69Representation;
  scalarValue?: number;
  sourceHierarchyTier: E69SourceHierarchyTier;
  comparability: E69MatchLevel;
  freshness?: CREPresentationFreshness;
  weight?: number;
  note: string;
}

export interface E69BenchmarkAudit {
  requestedBenchmark: E69ComparabilityRequest;
  observationsConsideredCount: number;
  excludedByComparability: E69BenchmarkAuditEntry[];
  excludedByPhase3: E69BenchmarkAuditEntry[];
  contributing: E69BenchmarkAuditEntry[];
  sourceHierarchySummary: string;
  dispersion?: E69Dispersion;
  consensusMethod: string;
  dataConfidence: E69ConfidenceTier;
  benchmarkConfidence: E69ConfidenceTier;
  confidence: E69ConfidenceTier;
  finalBenchmarkValue?: number;
  dataGapReasonCode?: E69BenchmarkGapReasonCode;
  narrative: string[];
}

export interface E69Benchmark {
  value: number;
  unit: string;
  capRateType?: CRECapRateType;
  /** How the value was arrived at. Never "interpolated" or "estimated" — those methods do not exist here. */
  method: "single_observation" | "weighted_consensus" | "methodology_preferred";
}

export interface E69BenchmarkGap {
  reasonCode: E69BenchmarkGapReasonCode;
  requestedBenchmark: E69ComparabilityRequest;
  candidateCount: number;
  eligibleCount: number;
  excludedCount: number;
  conflictingCandidates?: E69BenchmarkAuditEntry[];
  explanation: string;
  provenanceReferences: string[];
}

export type E69BenchmarkResult =
  | {
      status: "success";
      benchmark: E69Benchmark;
      dataConfidence: E69ConfidenceTier;
      benchmarkConfidence: E69ConfidenceTier;
      confidence: E69ConfidenceTier;
      contributingObservations: E69ComparabilityCandidate[];
      dispersion: E69Dispersion;
      audit: E69BenchmarkAudit;
    }
  | {
      status: "data_gap";
      gap: E69BenchmarkGap;
      audit: E69BenchmarkAudit;
    };

export interface E69BenchmarkOptions {
  dispersionPolicy?: DispersionPolicy;
}

/** Re-exported for consumers who only import from this file. */
export type { E69ComparabilityResult };

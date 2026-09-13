/**
 * InvestScape™ E87 Phase 5 — Unified Cap-Rate Benchmark Output: types.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Phase 5 does not re-implement Phase 2/3/4 logic. It orchestrates them and
 * defines the single application-ready output contract a caller consumes:
 * either a success (publisher/survey, transaction-derived, or consensus —
 * optionally with a user override layered on top) or a DATA_GAP, never an
 * exception, never a flattened/lossy summary of the underlying evidence.
 *
 * E86 reuse: `UserOverride` (src/cre-intelligence/benchmark-types.ts) is
 * reused verbatim as the override input shape; `createUserOverride` /
 * `resolveBenchmark` (src/cre-intelligence/user-override.ts) are called, not
 * reimplemented — see pipeline.ts's `toE86BenchmarkResponseStub` for how an
 * E87 result is adapted to fit E86's `CREBenchmarkResponse` shape without
 * modifying E86.
 */
import type { CREGeography } from "../cre-intelligence/types";
import type { E87CandidateInput, E87ComparabilityRequest } from "./comparability-types";
import type { E87BenchmarkOptions, E87BenchmarkResult } from "./consensus-types";
import type { CRETransactionDerivedObservation } from "./transaction-types";

/**
 * Where the final benchmark value came from, at the coarse grain the spec
 * requires (Part "REQUIRED DESIGN"). This is informational only — it never
 * changes how the value was computed, only how it is labeled for a consumer.
 */
export type E87BenchmarkOrigin = "publisher_survey" | "transaction_derived" | "consensus";

/**
 * A single pipeline request. The caller supplies the eligible observation
 * pool explicitly (Phase 5 has no live data-fetching layer, consistent with
 * how Phase 2/3 already work) and, optionally, a separate list of Phase 4
 * transaction-derived observations to merge in before comparability.
 *
 * DESIGN CHOICE (documented per spec step 6): transaction-derived
 * observations are accepted as an explicit, separate input
 * (`transactionDerivedObservations`) rather than requiring the caller to
 * pre-convert them into `candidatePool` themselves. The pipeline converts
 * each one via Phase 4's own `toE87CandidateInput` and merges the result into
 * `candidatePool` before calling Phase 2's `evaluateComparability`, so both
 * paths flow through the exact same comparability/consensus contracts with
 * no parallel logic. This keeps `candidatePool` free for a caller who has
 * already resolved E86 observations, while still letting a caller who only
 * has raw transaction inputs plug in Phase 4's output without first learning
 * `toE87CandidateInput`'s exact shape.
 */
export interface E87PipelineRequest {
  comparability: E87ComparabilityRequest;
  candidatePool: readonly E87CandidateInput[];
  transactionDerivedObservations?: readonly CRETransactionDerivedObservation[];
  benchmarkOptions?: E87BenchmarkOptions;
  /**
   * When supplied, always wins (mirrors E86's `resolveBenchmark`: "an
   * override always wins when present"). Layered on top of, never
   * destructive to, the underlying benchmark/DATA_GAP — both remain
   * retrievable on the final result.
   */
  userOverride?: {
    overrideValue: number;
    overrideReason: string;
    /** Injection point for deterministic tests; defaults to `new Date()`. */
    now?: Date;
  };
}

/** The override layer, as it appears on a `user_overridden` pipeline result. */
export interface E87OverrideLayer {
  overrideValue: number;
  overrideReason: string;
  overrideTimestamp: string;
  /** The underlying benchmark's own value, when the underlying result was a success. Never overwritten by the override. */
  originalValue?: number;
  originalStatus: "success" | "data_gap";
}

export type E87PipelineSuccessResult = Extract<E87BenchmarkResult, { status: "success" }>;
export type E87PipelineDataGapResult = Extract<E87BenchmarkResult, { status: "data_gap" }>;

/** A benchmark was produced, and no override was supplied (or none was needed to determine the active value). */
export interface E87PipelineSuccess {
  pipelineStatus: "success";
  origin: E87BenchmarkOrigin;
  /** The full, unflattened Phase 3 success result: benchmark, both confidence axes, contributing observations, dispersion, audit. */
  result: E87PipelineSuccessResult;
  /** The candidate-pool identity/geography this pipeline run was evaluated against, carried through for convenience. */
  requestedGeography: CREGeography;
}

/** No benchmark could be produced. Always a typed result, never an exception. */
export interface E87PipelineDataGap {
  pipelineStatus: "data_gap";
  /** The full, unflattened Phase 3 DATA_GAP result: reason, considered/excluded candidates, provenance, audit. */
  result: E87PipelineDataGapResult;
  requestedGeography: CREGeography;
}

/**
 * A user override is active. The underlying pipeline result (success or
 * data_gap) is preserved verbatim and remains retrievable alongside the
 * override — the override is layered on top, never destructive.
 */
export interface E87PipelineUserOverridden {
  pipelineStatus: "user_overridden";
  /** "n/a" when the underlying result was a DATA_GAP (there is no benchmark origin to report). */
  origin: E87BenchmarkOrigin | "n/a";
  underlying: E87PipelineSuccessResult | E87PipelineDataGapResult;
  override: E87OverrideLayer;
  requestedGeography: CREGeography;
}

export type E87PipelineResult = E87PipelineSuccess | E87PipelineDataGap | E87PipelineUserOverridden;

/**
 * InvestScape™ E69 Phase 5 — Unified Cap-Rate Benchmark Output / End-to-End Integration.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Orchestrates Phases 1-4 into one coherent, application-ready pipeline:
 *
 *   request -> candidate pool (+ transaction-derived merge)
 *     -> Phase 2 comparability (evaluateComparability)
 *     -> Phase 3 representation/consensus (buildCapRateBenchmark)
 *     -> origin classification (publisher/survey | transaction-derived | consensus)
 *     -> E68 user override resolution (createUserOverride / resolveBenchmark)
 *     -> one deterministic E69PipelineResult (success | user_overridden | data_gap)
 *
 * THIS FILE DOES NOT re-derive comparability, re-derive consensus, or
 * reimplement E68's user-override decision logic — it calls Phase 2's
 * `evaluateComparability`, Phase 3's `buildCapRateBenchmark`, Phase 4's
 * `toE69CandidateInput`, and E68's `createUserOverride`/`resolveBenchmark`
 * verbatim.
 *
 * BOUNDARY NOTE (documented per spec, not acted on): E68's
 * `benchmark-selection.ts` and `qualification.ts` contain analytical logic
 * (identity matching, axis qualification) that is conceptually adjacent to
 * what E69 Phase 2/3 does for cap rates specifically. They are read-only
 * reviewed here and NOT imported or modified — E69 deliberately maintains its
 * own comparability/consensus logic in Phase 2/3 rather than reusing or
 * altering those E68 modules, to keep E68 frozen at v1.0. See
 * docs/E69-phase5-unified-benchmark-output.md for the full boundary
 * discussion.
 */
import { createUserOverride, resolveBenchmark } from "../cre-intelligence/user-override";
import type { CREBenchmarkResponse, UserOverride } from "../cre-intelligence/benchmark-types";
import type { CREGeography } from "../cre-intelligence/types";
import { evaluateComparability } from "./comparability";
import type { E69CandidateInput } from "./comparability-types";
import { buildCapRateBenchmark } from "./benchmark-consensus";
import type { E69BenchmarkResult } from "./consensus-types";
import { toE69CandidateInput } from "./transaction-derivation";
import type {
  E69BenchmarkOrigin,
  E69OverrideLayer,
  E69PipelineDataGap,
  E69PipelineRequest,
  E69PipelineResult,
  E69PipelineSuccess,
  E69PipelineUserOverridden,
} from "./pipeline-types";

// ---------------------------------------------------------------------------
// Origin classification
// ---------------------------------------------------------------------------

/**
 * Classify where a successful benchmark's value came from, for display
 * purposes only. Never affects the computed value itself (that is entirely
 * Phase 3's job) — purely a label derived from the already-final set of
 * contributing observations.
 */
function classifyOrigin(result: Extract<E69BenchmarkResult, { status: "success" }>): E69BenchmarkOrigin {
  const types = result.contributingObservations.map((c) => c.observation.capRateType);
  if (types.length > 0 && types.every((t) => t === "derived_transaction")) {
    return "transaction_derived";
  }
  if (result.contributingObservations.length === 1) {
    return "publisher_survey";
  }
  return "consensus";
}

// ---------------------------------------------------------------------------
// E68 user-override adapter
// ---------------------------------------------------------------------------

/**
 * Adapt an E69 Phase 3 result into the minimal `CREBenchmarkResponse` shape
 * E68's `resolveBenchmark` expects, WITHOUT modifying E68's contract. Only
 * the fields `resolveBenchmark` actually inspects (`status`) and the fields
 * `createUserOverride`'s `originalE68Identity` wants to preserve are
 * populated meaningfully; the rest are honest placeholders (empty arrays /
 * "n/a" strings), never fabricated data. This stub is never returned to a
 * caller — it exists purely so E69 can call E68's real override-resolution
 * function instead of reimplementing its "override always wins" logic.
 */
function toE68BenchmarkResponseStub(
  geography: CREGeography,
  assetClass: string,
  result: E69BenchmarkResult,
): CREBenchmarkResponse {
  return {
    status: result.status === "success" ? "AVAILABLE" : "DATA_GAP",
    identity: {
      metric: "cap_rate",
      country: geography.country,
      city: geography.city ?? geography.metro ?? geography.country,
      assetClass: assetClass as CREBenchmarkResponse["identity"]["assetClass"],
      capRateType: result.status === "success" ? result.benchmark.capRateType : undefined,
    },
    warnings: [],
    provenance: [],
    dataGap:
      result.status === "data_gap"
        ? { reason: result.gap.explanation, sourcesInvestigated: result.gap.provenanceReferences, lastResearchDate: "n/a" }
        : undefined,
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run the full E69 pipeline for one request and return one deterministic,
 * structured result. Never throws for an ordinary evidence gap — always
 * returns a typed `E69PipelineResult`.
 *
 * Deterministic: identical `request` always produces an identical result
 * (candidate order does not matter — Phase 2/3 already sort/evaluate
 * deterministically; this function performs no additional non-deterministic
 * step beyond an injectable `userOverride.now`).
 */
export function resolveCapRateBenchmark(request: E69PipelineRequest): E69PipelineResult {
  // Step: merge Phase 4 transaction-derived observations into the candidate
  // pool BEFORE comparability, via Phase 4's own toE69CandidateInput — no
  // parallel conversion logic.
  const transactionCandidates: E69CandidateInput[] = (request.transactionDerivedObservations ?? []).map((obs) =>
    toE69CandidateInput(obs),
  );
  const mergedPool: E69CandidateInput[] = [...request.candidatePool, ...transactionCandidates];

  // Phase 2: comparability.
  const comparabilityResult = evaluateComparability(request.comparability, mergedPool);

  // Phase 3: representation handling + consensus (or DATA_GAP).
  const benchmarkResult = buildCapRateBenchmark(comparabilityResult, request.benchmarkOptions);

  const geography = request.comparability.geography;
  const assetClass = request.comparability.assetClass;

  // No override requested: return the Phase 3 result directly, wrapped in
  // the Phase 5 success/data_gap envelope (never flattened).
  if (!request.userOverride) {
    if (benchmarkResult.status === "success") {
      const success: E69PipelineSuccess = {
        pipelineStatus: "success",
        origin: classifyOrigin(benchmarkResult),
        result: benchmarkResult,
        requestedGeography: geography,
      };
      return success;
    }
    const dataGap: E69PipelineDataGap = {
      pipelineStatus: "data_gap",
      result: benchmarkResult,
      requestedGeography: geography,
    };
    return dataGap;
  }

  // Override requested: resolve via E68's own createUserOverride/resolveBenchmark,
  // never a reimplementation of "override always wins".
  const stub = toE68BenchmarkResponseStub(geography, assetClass, benchmarkResult);
  const override: UserOverride = createUserOverride({
    overrideValue: request.userOverride.overrideValue,
    overrideReason: request.userOverride.overrideReason,
    originalE68Value: benchmarkResult.status === "success" ? benchmarkResult.benchmark.value : undefined,
    originalE68Identity: stub.identity,
    now: request.userOverride.now,
  });
  const resolved = resolveBenchmark(stub, override);

  // `resolveBenchmark` always returns `active: "override"` whenever an
  // override is supplied (see user-override.ts), which is exactly the
  // "override always wins" contract this pipeline needs. The underlying
  // benchmark/DATA_GAP is preserved verbatim on `underlying` regardless.
  const overrideLayer: E69OverrideLayer = {
    overrideValue: resolved.override!.overrideValue,
    overrideReason: resolved.override!.overrideReason,
    overrideTimestamp: resolved.override!.overrideTimestamp,
    originalValue: benchmarkResult.status === "success" ? benchmarkResult.benchmark.value : undefined,
    originalStatus: benchmarkResult.status,
  };

  const userOverridden: E69PipelineUserOverridden = {
    pipelineStatus: "user_overridden",
    origin: benchmarkResult.status === "success" ? classifyOrigin(benchmarkResult) : "n/a",
    underlying: benchmarkResult,
    override: overrideLayer,
    requestedGeography: geography,
  };
  return userOverridden;
}

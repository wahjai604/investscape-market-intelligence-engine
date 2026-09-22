/**
 * InvestScape™ E86 — CRE Intelligence public benchmark surface.
 *
 * This is the ONLY E86 entry point published outside this repository (see
 * `src/index.ts`, which re-exports this module, not `./index`). It exposes
 * exactly the cap-rate/hard-cost consensus and benchmark-selection
 * functions and their minimal calling types — never the broad internal
 * barrel (`./index`), which also carries ingestion, source-registry,
 * licensing, paid-source-analysis, legacy-migration, and user-override
 * material that must not leave this repository unpackaged.
 */

export { capRateConsensus, weightedConsensus } from "./consensus";
export { selectCapRateBenchmark, selectHardCostBenchmark } from "./benchmark-selection";

export type {
  CREObservation,
  CRECitedObservation,
  ConsensusResult,
  CREDataStatus,
  CREDataGap,
  CRECitation,
} from "./types";

export type { BenchmarkIdentity, CREBenchmarkResponse } from "./benchmark-types";

/**
 * InvestScape™ E70 Phase 3 — data layer barrel + pool-assembly helper.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * `e70ConstructionCostPool()` is a convenience for callers/tests: it merges
 * E68's existing (frozen, unmodified) construction-cost observations with
 * E70's own Phase 3 backfill into a single candidate pool, wrapping each as
 * a `ConstructionCostCandidateInput`. This performs no filtering, scoring,
 * or deduplication — comparability.ts / pipeline.ts already own that. It is
 * read-only: it imports E68's exported array, never mutates it.
 */
import { US_CONSTRUCTION_COST_OBSERVATIONS } from "../../cre-intelligence/data/construction-costs-us";
import { RLB_BACKFILL_HARD_COST_OBSERVATIONS } from "./rlb-backfill-q2-2026";
import type { ConstructionCostCandidateInput } from "../types";

export * from "./rlb-backfill-q2-2026";
export * from "./index-series";

/**
 * All hard-cost-and-related observations E70 can see as of Phase 3: E68's
 * original 53 (unchanged) plus E70's 112 backfilled (16 additional cities x
 * 7 RLB building types). Does not include index/change-metric observations
 * beyond what E68 already carries (Phase 3 deliberately did not backfill
 * the cost-index table for new cities — see rlb-backfill-q2-2026.ts header).
 */
export const E70_KNOWN_CONSTRUCTION_COST_OBSERVATIONS = [
  ...US_CONSTRUCTION_COST_OBSERVATIONS,
  ...RLB_BACKFILL_HARD_COST_OBSERVATIONS,
] as const;

export function e70ConstructionCostPool(): ConstructionCostCandidateInput[] {
  return E70_KNOWN_CONSTRUCTION_COST_OBSERVATIONS.map((observation) => ({ observation }));
}

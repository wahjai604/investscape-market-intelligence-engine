/**
 * InvestScape™ E86 Phase 5 — soft costs (Part 7).
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * E86 has zero verified soft-cost observations (RLB's North America report is
 * hard-cost only; no other soft-cost source has been researched). Rather than
 * let an application quietly default to some percentage and present it as
 * research, this always returns an explicit non-availability status.
 */
import type { SoftCostResponse } from "./benchmark-types";

export function getSoftCostBenchmark(identity: SoftCostResponse["identity"]): SoftCostResponse {
  return {
    status: "SOFT_COST_DATA_NOT_AVAILABLE",
    identity,
    reason:
      "E86 has not researched or verified any soft-cost data source. If the application needs a soft-cost assumption, it must be recorded explicitly as an application default or user assumption, never labeled E86-sourced.",
  };
}

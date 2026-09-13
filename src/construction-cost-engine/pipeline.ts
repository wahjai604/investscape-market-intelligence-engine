/**
 * InvestScape™ E88 Phase 2 — Construction Cost Pipeline.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Orchestrates comparability.ts into the single Phase 2 output contract:
 * either qualified comparable candidates, or an explicit `ConstructionCostDataGap`
 * — never an exception, never a fabricated number (Phase 2 objectives 6/10).
 *
 * THIS FILE DOES NOT compute a benchmark value, consensus, or escalated cost.
 * Phase 2 stops at "here are the candidates that legitimately inform this
 * request, or here is exactly why none do" — aggregation is Phase 5+
 * (docs/E88-phase1-technical-specification.md Section 24).
 *
 * HARD-COST-ONLY RULE (Phase 1 Decision 5, Phase 2 objective 6): resolved at
 * THIS layer, before comparability scoring runs on the full pool. A request
 * for "total_cost" is never silently downgraded to hard cost, never
 * estimates soft cost, and never manufactures a total from hard cost alone.
 */
import { evaluateComparability } from "./comparability";
import type { ConstructionCostComparabilityCandidate, ConstructionCostComparabilityResult } from "./comparability-types";
import type { CCDataGapReasonCode, ConstructionCostDataGap } from "./gap-types";
import type { ConstructionCostCandidateInput, ConstructionCostRequest } from "./types";

export type ConstructionCostPipelineResult =
  | { status: "CANDIDATES_AVAILABLE"; result: ConstructionCostComparabilityResult }
  | { status: "DATA_GAP"; gap: ConstructionCostDataGap };

function poolSourceIds(pool: readonly ConstructionCostCandidateInput[]): string[] {
  return [...new Set(pool.map((c) => c.observation.source.sourceId))];
}

function buildGap(
  request: ConstructionCostRequest,
  reasonCode: CCDataGapReasonCode,
  reason: string,
  excludedCandidates: readonly ConstructionCostComparabilityCandidate[],
  sourcesChecked: readonly string[],
  checkedAt: string,
  resolutionHint?: string,
): ConstructionCostDataGap {
  return { request, reasonCode, reason, excludedCandidates, sourcesChecked, checkedAt, resolutionHint };
}

/**
 * Evaluate a construction-cost request against a candidate pool. `checkedAt`
 * should be an ISO date supplied by the caller (never `Date.now()` internally
 * — Phase 2 objective 9 requires deterministic, repeatable output for the
 * same inputs).
 */
export function evaluateConstructionCostRequest(
  request: ConstructionCostRequest,
  pool: readonly ConstructionCostCandidateInput[],
  checkedAt: string,
): ConstructionCostPipelineResult {
  const sourcesChecked = poolSourceIds(pool);

  if (pool.length === 0) {
    return {
      status: "DATA_GAP",
      gap: buildGap(
        request,
        "NO_CANDIDATES_IN_POOL",
        "The supplied candidate pool was empty — no observations of any kind were available to evaluate.",
        [],
        sourcesChecked,
        checkedAt,
      ),
    };
  }

  // --- Phase 1 Decision 5: hard/total gating happens BEFORE comparability scoring. ---

  if (request.costRepresentation === "soft_cost") {
    const softCostPresent = pool.some((c) => c.observation.metric === "soft_cost");
    if (!softCostPresent) {
      return {
        status: "DATA_GAP",
        gap: buildGap(
          request,
          "NO_SOFT_COST_OBSERVATIONS_EXIST",
          "No soft-cost observation exists in the supplied candidate pool for any geography or category. E86 has zero verified soft-cost observations as of Phase 1 (soft-cost.ts always returns SOFT_COST_DATA_NOT_AVAILABLE) — this is a source fact, not an omission.",
          [],
          sourcesChecked,
          checkedAt,
          "A soft-cost source would need to be researched and licensed (Phase 1 Section 21) before this request can be served.",
        ),
      };
    }
    // Soft-cost observations exist in the pool: proceed to normal comparability evaluation below.
  }

  if (request.costRepresentation === "total_cost") {
    const hardCostPresent = pool.some((c) => c.observation.metric === "hard_cost");
    const softCostPresent = pool.some((c) => c.observation.metric === "soft_cost");
    if (!softCostPresent) {
      const reasonCode: CCDataGapReasonCode = hardCostPresent
        ? "TOTAL_COST_UNAVAILABLE_SOFT_COST_MISSING"
        : "SOURCE_DOES_NOT_COVER_CATEGORY";
      const reason = hardCostPresent
        ? "Hard-cost evidence exists in the candidate pool, but total cost cannot be honestly assembled without soft-cost evidence, which is unavailable. Hard cost is never silently presented as total cost, and no soft-cost percentage is invented (Phase 1 Decision 5)."
        : "Neither hard-cost nor soft-cost evidence exists in the candidate pool for this request; a total-cost figure cannot be assembled from nothing.";
      return {
        status: "DATA_GAP",
        gap: buildGap(request, reasonCode, reason, [], sourcesChecked, checkedAt, hardCostPresent ? "A soft-cost source would need to be researched and licensed before a total-cost figure can be assembled." : undefined),
      };
    }
    // Both hard and soft cost observations exist in the pool: proceed to normal comparability evaluation below.
    // (Phase 2 does not aggregate hard+soft into a single total-cost value — see file header. Comparability
    // still runs so a caller can see which hard/soft candidates would jointly inform a future Phase 5 total.)
  }

  const result = evaluateComparability(request, pool);

  if (result.included.length > 0) {
    return { status: "CANDIDATES_AVAILABLE", result };
  }

  // Every candidate was excluded. Distinguish three situations (Phase 2 objective 7):
  //   (a) no candidate even matches the requested asset class at all
  //   (b) asset class matches, but every candidate's subtype mapping is unsupported
  //   (c) asset+subtype are fine; exclusion is on an unrelated axis (geography/currency/freshness/etc.)
  const anyAssetMatch = result.excluded.some((c) => c.dimensions.assetMatch.level !== "unsupported");
  const anySupportedSubtype = result.excluded.some(
    (c) => c.dimensions.assetMatch.level !== "unsupported" && c.dimensions.subtypeMatch.level !== "unsupported",
  );

  let reasonCode: CCDataGapReasonCode;
  let reason: string;
  if (!anyAssetMatch) {
    reasonCode = "SOURCE_DOES_NOT_COVER_CATEGORY";
    reason = "No observation in the candidate pool matches the requested asset class at all.";
  } else if (!anySupportedSubtype) {
    reasonCode = "SOURCE_COVERAGE_UNSUPPORTED_MAPPING";
    reason =
      "Observations exist for the requested asset class, but none has a supported (exact/close/approximate) classification mapping to the requested canonical subtype — see each excluded candidate's subtypeMatch dimension for the specific mapping rationale.";
  } else {
    reasonCode = "ALL_CANDIDATES_EXCLUDED";
    reason =
      "Asset class and subtype mapping are supported for at least one candidate, but every candidate was excluded on another dimension (geography, currency, unit basis, period, or freshness) — see each excluded candidate's dimensions for the specific mismatch.";
  }

  return {
    status: "DATA_GAP",
    gap: buildGap(request, reasonCode, reason, result.excluded, sourcesChecked, checkedAt),
  };
}

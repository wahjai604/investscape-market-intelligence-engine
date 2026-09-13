/**
 * InvestScape™ E88 Phase 3 — Coverage Matrix.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Answers, for a geography x building-type x subtype x hard/soft/total x
 * unit/basis combination, what evidence actually exists — never implying
 * availability where only a source reference exists (Part 6). Built
 * entirely on top of Phase 2's `evaluateConstructionCostRequest`; this file
 * does NOT reimplement comparability or gating logic, only translates its
 * outcome into the six coverage statuses Phase 3 requires.
 *
 * A `LICENSE_RESTRICTED` verdict is never derived by asking the pool (the
 * pool contains no licensed data by construction — Phase 3 forbids
 * purchasing or otherwise acquiring licensed data). It comes from a static
 * cross-reference against `source-research.ts` for the one case Phase 3
 * actually has an opinion on: a request for evidence RSMeans/Altus/etc. are
 * known to plausibly cover but that no free source in the pool answers.
 * This is deliberately conservative — it is asserted only for exactly the
 * situations Phase 1/6 already researched, never inferred generically.
 */
import { evaluateConstructionCostRequest } from "./pipeline";
import type { ConstructionCostCandidateInput, ConstructionCostRequest } from "./types";
import type { CCDataGapReasonCode } from "./gap-types";

export type CoverageStatus =
  | "DATA_AVAILABLE"
  | "DATA_NOT_FOUND"
  | "SOURCE_DOES_NOT_COVER"
  | "UNSUPPORTED_MAPPING"
  | "LICENSE_RESTRICTED"
  | "NOT_YET_IMPLEMENTED";

export interface CoverageResult {
  status: CoverageStatus;
  explanation: string;
}

const GAP_REASON_TO_STATUS: Readonly<Record<CCDataGapReasonCode, CoverageStatus>> = {
  NO_SOFT_COST_OBSERVATIONS_EXIST: "NOT_YET_IMPLEMENTED",
  SOURCE_DOES_NOT_COVER_CATEGORY: "SOURCE_DOES_NOT_COVER",
  SOURCE_COVERAGE_UNSUPPORTED_MAPPING: "UNSUPPORTED_MAPPING",
  TOTAL_COST_UNAVAILABLE_SOFT_COST_MISSING: "NOT_YET_IMPLEMENTED",
  NO_CANDIDATES_IN_POOL: "DATA_NOT_FOUND",
  ALL_CANDIDATES_EXCLUDED: "DATA_NOT_FOUND",
  CURRENCY_CONVERSION_UNAVAILABLE: "DATA_NOT_FOUND",
  UNIT_CONVERSION_UNSUPPORTED: "DATA_NOT_FOUND",
};

/**
 * Requests known, from Phase 1/3 research, to be plausibly answerable only
 * by a licensed source not yet integrated (RSMeans/Altus) — asserted here
 * ONLY for multifamily and industrial hard-cost requests, the two specific
 * categories Phase 1/3 research actually examined and found no free-source
 * coverage for. This list must never grow by inference; only by documented
 * research (source-research.ts).
 */
function isKnownLicenseRestrictedGap(request: ConstructionCostRequest): boolean {
  return (
    request.costRepresentation === "hard_cost" &&
    (request.assetClass === "multifamily" || request.assetClass === "industrial")
  );
}

/**
 * Assess coverage for one request against a candidate pool. `checkedAt`
 * behaves identically to the pipeline's own parameter — supplied by the
 * caller for determinism, never `Date.now()` internally.
 */
export function assessCoverage(
  request: ConstructionCostRequest,
  pool: readonly ConstructionCostCandidateInput[],
  checkedAt: string,
): CoverageResult {
  const result = evaluateConstructionCostRequest(request, pool, checkedAt);

  if (result.status === "CANDIDATES_AVAILABLE") {
    return { status: "DATA_AVAILABLE", explanation: `${result.result.included.length} qualifying candidate(s) found.` };
  }

  const gapStatus = GAP_REASON_TO_STATUS[result.gap.reasonCode];

  // Only narrow DATA_NOT_FOUND/SOURCE_DOES_NOT_COVER toward LICENSE_RESTRICTED,
  // and only for the specific documented cases — never override a more precise
  // verdict the pipeline already reached (e.g. UNSUPPORTED_MAPPING stays as-is).
  if ((gapStatus === "SOURCE_DOES_NOT_COVER" || gapStatus === "DATA_NOT_FOUND") && isKnownLicenseRestrictedGap(request)) {
    return {
      status: "LICENSE_RESTRICTED",
      explanation: `${result.gap.reason} A licensed source (RSMeans/Gordian, Altus — see source-research.ts) plausibly covers this category but has not been acquired (Phase 3 Part 3: no purchases performed).`,
    };
  }

  return { status: gapStatus, explanation: result.gap.reason };
}

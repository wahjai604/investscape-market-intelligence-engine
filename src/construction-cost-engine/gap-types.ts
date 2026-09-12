/**
 * InvestScape™ E70 Phase 2 — Construction Cost Engine: DATA_GAP contract.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Resolves E70 Phase 1 Open Design Decision 1 (docs/E70-phase1-technical-
 * specification.md Section 22): soft-cost (and every other) unavailability
 * becomes a formal, E70-constructed gap record here, WITHOUT editing E68's
 * `soft-cost.ts` — that file keeps returning its fixed
 * `SOFT_COST_DATA_NOT_AVAILABLE` status unchanged. E70 wraps the concept in
 * its own richer, per-request-shaped record instead of mutating E68.
 *
 * These reason codes are net-new and scoped to E70's own concerns, exactly as
 * E69's `E69ExclusionReasonCode` is deliberately NOT a reuse of E68's
 * `CREDataGapReasonCode` (Part 13 rationale in comparability-types.ts):
 * E68's eight codes describe a SOURCE's inability to publish something at
 * ingestion time; E69's codes describe why one observation doesn't fit one
 * request; these codes describe why NO qualifying construction-cost evidence
 * exists for a request at all, including the hard/soft/total distinction
 * that is unique to construction cost and has no E68 or E69 analogue.
 */
import type { ConstructionCostRequest } from "./types";
import type { ConstructionCostComparabilityCandidate } from "./comparability-types";

/**
 * Requirement 7 of the Phase 2 objectives: distinguish these four situations
 * explicitly rather than collapsing them into one "no data" message.
 */
export type CCDataGapReasonCode =
  /** Soft-cost was requested; zero soft-cost observations exist anywhere for any geography/category (true today for every source in E68). */
  | "NO_SOFT_COST_OBSERVATIONS_EXIST"
  /** The requested asset class/subtype is not covered by any source in the candidate pool at all (e.g. multifamily, industrial against RLB). */
  | "SOURCE_DOES_NOT_COVER_CATEGORY"
  /** Source coverage for this category exists, but only via an unsupported (never approximate/close) mapping — the classification cannot be honestly matched. */
  | "SOURCE_COVERAGE_UNSUPPORTED_MAPPING"
  /** Total cost was requested; hard-cost evidence exists but soft-cost evidence does not, so a total figure cannot be honestly assembled (Phase 1 Decision 5). */
  | "TOTAL_COST_UNAVAILABLE_SOFT_COST_MISSING"
  /** The caller supplied an empty candidate pool. */
  | "NO_CANDIDATES_IN_POOL"
  /** Candidates existed but every one was excluded by comparability evaluation. */
  | "ALL_CANDIDATES_EXCLUDED"
  /** A currency conversion would be required to serve this request and no explicitly-sourced FX rate was supplied — never inferred. */
  | "CURRENCY_CONVERSION_UNAVAILABLE"
  /** A unit/basis conversion would be required and is not deterministically supported (e.g. $/SF <-> $/unit needs an unstated average unit size). */
  | "UNIT_CONVERSION_UNSUPPORTED";

export const CC_DATA_GAP_REASON_LABELS: Readonly<Record<CCDataGapReasonCode, string>> = {
  NO_SOFT_COST_OBSERVATIONS_EXIST: "No soft-cost observation exists in the candidate pool for any geography or category.",
  SOURCE_DOES_NOT_COVER_CATEGORY: "No source in the candidate pool publishes this asset class/subtype at all.",
  SOURCE_COVERAGE_UNSUPPORTED_MAPPING: "Source coverage exists but only via an unsupported classification mapping.",
  TOTAL_COST_UNAVAILABLE_SOFT_COST_MISSING: "Hard-cost evidence exists, but total cost cannot be assembled without soft-cost evidence, which is unavailable.",
  NO_CANDIDATES_IN_POOL: "The supplied candidate pool was empty.",
  ALL_CANDIDATES_EXCLUDED: "Every candidate in the pool was excluded by comparability evaluation.",
  CURRENCY_CONVERSION_UNAVAILABLE: "A currency conversion is required to serve this request and no explicitly-sourced FX rate was supplied.",
  UNIT_CONVERSION_UNSUPPORTED: "A unit/basis conversion is required and cannot be performed deterministically from the data available.",
};

/**
 * The full E70 DATA_GAP record. Never contains a fabricated numeric
 * construction-cost benchmark (Phase 2 objective 10) — only the request, the
 * reason, and the full evidence trail considered before concluding no
 * benchmark exists.
 */
export interface ConstructionCostDataGap {
  request: ConstructionCostRequest;
  reasonCode: CCDataGapReasonCode;
  /** Free-text explanation of the source fact behind the gap — never an intention ("we haven't gotten to this yet"). */
  reason: string;
  /** Every candidate considered, whether excluded outright or filtered before comparability ran. Empty array is valid and means the pool itself was empty. */
  excludedCandidates: readonly ConstructionCostComparabilityCandidate[];
  /** Source IDs actually checked before concluding the gap (E68 CRESource.sourceId values). */
  sourcesChecked: readonly string[];
  checkedAt: string;
  /** What WOULD resolve this gap, only when genuinely true — never invented to sound helpful. */
  resolutionHint?: string;
}

/** Precise, non-generic user-facing message, mirroring E68's `formatDataGapMessage`. */
export function formatConstructionCostGapMessage(gap: Pick<ConstructionCostDataGap, "reasonCode" | "reason" | "resolutionHint">): string {
  const label = CC_DATA_GAP_REASON_LABELS[gap.reasonCode];
  const hint = gap.resolutionHint ? ` ${gap.resolutionHint}` : "";
  return `${label} ${gap.reason}${hint}`;
}

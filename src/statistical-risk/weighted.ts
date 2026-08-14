/**
 * InvestScape™ Market Intelligence & Statistical Risk Engine
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * InvestScape™ is a registered trademark of Lighthouse Research Ltd.
 * This software is proprietary and confidential.
 *
 * LICENSING:
 * - Personal/Educational Use: Permitted (see LICENSE)
 * - Commercial Use: Requires written Commercial License Agreement
 * Contact: wahjai604@gmail.com
 *
 * DISCLAIMER:
 * This software is provided "as-is" for informational purposes only.
 * Not investment advice, tax advice, or financial advice.
 * Use at your own risk.
 */

import { ISSUE_CODES, StatResult, issue, nullResult, okResult } from "./types";

export interface WeightedMeanOptions {
  /** Defaults to false — negative weights are rejected unless explicitly opted in, per spec. */
  allowNegativeWeights?: boolean;
}

/**
 * Weighted mean = sum(w*x) / sum(w).
 *
 * Rejects negative weights by default (returns null + issue) since a
 * negative weight has no standard interpretation for the composite scores
 * this function is expected to feed (e.g. data-quality components) — pass
 * `{ allowNegativeWeights: true }` for the rare case where a caller
 * genuinely wants signed weighting.
 */
export function weightedMean(values: number[], weights: number[], options?: WeightedMeanOptions): StatResult<number> {
  const methodology = "weighted mean = sum(w*x) / sum(w)";

  if (values.length !== weights.length) {
    return nullResult(Math.min(values.length, weights.length), methodology, [
      issue(ISSUE_CODES.UNALIGNED_PAIRS, "error", `values and weights must be the same length; received ${values.length} and ${weights.length}.`),
    ]);
  }
  if (values.length === 0) {
    return nullResult(0, methodology, [issue(ISSUE_CODES.EMPTY_INPUT, "error", "Cannot compute weighted mean of an empty array.")]);
  }

  const allowNegative = options?.allowNegativeWeights ?? false;
  if (!allowNegative && weights.some((w) => w < 0)) {
    return nullResult(values.length, methodology, [
      issue(ISSUE_CODES.NEGATIVE_WEIGHT, "error", "Negative weights are not allowed unless options.allowNegativeWeights is true."),
    ]);
  }

  const weightSum = weights.reduce((acc, w) => acc + w, 0);
  if (weightSum === 0) {
    return nullResult(values.length, methodology, [
      issue(ISSUE_CODES.ZERO_DENOMINATOR, "error", "Sum of weights is zero; weighted mean is undefined."),
    ]);
  }

  const weightedSum = values.reduce((acc, v, i) => acc + v * weights[i], 0);
  return okResult(weightedSum / weightSum, values.length, methodology);
}

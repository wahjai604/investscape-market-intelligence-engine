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
import { mean } from "./descriptive";
import { standardDeviation } from "./dispersion";

/**
 * Pearson correlation coefficient: cov(x,y) / (sdX * sdY), using sample
 * (n-1) covariance and standard deviations for consistency with this
 * package's sample-first default.
 *
 * EXPLORATORY ONLY, PER SPEC: correlation never implies causation. Callers
 * (and anything downstream, including AI narrative generation) must not
 * present a Pearson result as a causal relationship — this function returns
 * a bare coefficient with no causal framing, and that framing must not be
 * added elsewhere either.
 */
export function pearsonCorrelation(x: number[], y: number[]): StatResult<number> {
  const methodology = "Pearson correlation = cov(x,y) / (sdX * sdY) — exploratory only, does not imply causation";

  if (x.length !== y.length) {
    return nullResult(Math.min(x.length, y.length), methodology, [
      issue(ISSUE_CODES.UNALIGNED_PAIRS, "error", `x and y must be the same length; received ${x.length} and ${y.length}.`),
    ]);
  }
  if (x.length < 2) {
    return nullResult(x.length, methodology, [
      issue(ISSUE_CODES.INSUFFICIENT_SAMPLE_SIZE, "error", `Pearson correlation requires n>=2; received n=${x.length}.`),
    ]);
  }

  const meanX = mean(x).value as number;
  const meanY = mean(y).value as number;

  const sdX = standardDeviation(x).value;
  const sdY = standardDeviation(y).value;

  if (sdX === null || sdY === null || sdX === 0 || sdY === 0) {
    return nullResult(x.length, methodology, [
      issue(ISSUE_CODES.ZERO_DISPERSION, "error", "Pearson correlation is undefined when either series has zero standard deviation."),
    ]);
  }

  const covariance = x.reduce((acc, xi, i) => acc + (xi - meanX) * (y[i] - meanY), 0) / (x.length - 1);
  const r = covariance / (sdX * sdY);

  // Guard against floating-point drift pushing |r| fractionally past 1.
  const clamped = Math.max(-1, Math.min(1, r));

  return okResult(clamped, x.length, methodology);
}

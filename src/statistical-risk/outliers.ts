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
import { standardDeviation } from "./dispersion";
import { mean, quartiles } from "./descriptive";

/**
 * Z-score of `x` against the distribution described by `referenceValues`:
 * (x - mean(referenceValues)) / sampleSD(referenceValues).
 *
 * Null + a zero-dispersion issue when the reference set has zero sample SD
 * (e.g. a constant series) — dividing by zero SD is undefined, not infinite.
 */
export function zScore(referenceValues: number[], x: number): StatResult<number> {
  const methodology = "z-score = (x - mean) / sample SD";
  const meanResult = mean(referenceValues);
  if (meanResult.value === null) {
    return nullResult(referenceValues.length, methodology, meanResult.issues);
  }
  const sdResult = standardDeviation(referenceValues);
  if (sdResult.value === null) {
    return nullResult(referenceValues.length, methodology, sdResult.issues);
  }
  if (sdResult.value === 0) {
    return nullResult(referenceValues.length, methodology, [
      issue(ISSUE_CODES.ZERO_DISPERSION, "error", "Reference series has zero standard deviation; z-score is undefined."),
    ]);
  }
  return okResult((x - meanResult.value) / sdResult.value, referenceValues.length, methodology);
}

/** Z-score of every element of `values` against `values`' own distribution. */
export function zScores(values: number[]): StatResult<number>[] {
  return values.map((x) => zScore(values, x));
}

export interface IQRBounds {
  q1: number;
  q3: number;
  iqr: number;
  lower: number;
  upper: number;
  multiplier: number;
}

/**
 * IQR outlier fence: [Q1 - multiplier*IQR, Q3 + multiplier*IQR].
 * multiplier defaults to the conventional 1.5 (Tukey's fence) but is
 * configurable, per spec.
 */
export function iqrBounds(values: number[], multiplier = 1.5): StatResult<IQRBounds> {
  const methodology = `IQR fence = [Q1 - ${multiplier}*IQR, Q3 + ${multiplier}*IQR]`;
  const q = quartiles(values);
  if (q.value === null || q.value.q1 === null || q.value.q3 === null || q.value.iqr === null) {
    return nullResult(values.length, methodology, q.issues);
  }
  const { q1, q3, iqr } = q.value;
  return okResult(
    { q1, q3, iqr, lower: q1 - multiplier * iqr, upper: q3 + multiplier * iqr, multiplier },
    values.length,
    methodology,
  );
}

export interface OutlierFlag {
  index: number;
  value: number;
  isOutlier: boolean;
}

/** Convenience wrapper: flags which elements of `values` fall outside the IQR fence. */
export function detectOutliersByIQR(values: number[], multiplier = 1.5): StatResult<OutlierFlag[]> {
  const bounds = iqrBounds(values, multiplier);
  if (bounds.value === null) {
    return nullResult(values.length, bounds.methodology, bounds.issues);
  }
  const { lower, upper } = bounds.value;
  return okResult(
    values.map((value, index) => ({ index, value, isOutlier: value < lower || value > upper })),
    values.length,
    bounds.methodology,
  );
}

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

/** Never mutates `values` — every function here sorts a copy when it needs order. */

export function mean(values: number[]): StatResult<number> {
  if (values.length === 0) {
    return nullResult(0, "arithmetic mean = sum(x)/n", [
      issue(ISSUE_CODES.EMPTY_INPUT, "error", "Cannot compute mean of an empty array."),
    ]);
  }
  const sum = values.reduce((acc, v) => acc + v, 0);
  return okResult(sum / values.length, values.length, "arithmetic mean = sum(x)/n");
}

/**
 * Sorts a COPY of `values` — the caller's array is never reordered.
 */
export function median(values: number[]): StatResult<number> {
  if (values.length === 0) {
    return nullResult(0, "median = middle value(s) of the sorted series", [
      issue(ISSUE_CODES.EMPTY_INPUT, "error", "Cannot compute median of an empty array."),
    ]);
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return okResult(value, values.length, "median = middle value(s) of the sorted series");
}

export function min(values: number[]): StatResult<number> {
  if (values.length === 0) {
    return nullResult(0, "min(x)", [issue(ISSUE_CODES.EMPTY_INPUT, "error", "Cannot compute min of an empty array.")]);
  }
  return okResult(Math.min(...values), values.length, "min(x)");
}

export function max(values: number[]): StatResult<number> {
  if (values.length === 0) {
    return nullResult(0, "max(x)", [issue(ISSUE_CODES.EMPTY_INPUT, "error", "Cannot compute max of an empty array.")]);
  }
  return okResult(Math.max(...values), values.length, "max(x)");
}

export function range(values: number[]): StatResult<number> {
  if (values.length === 0) {
    return nullResult(0, "range = max(x) - min(x)", [
      issue(ISSUE_CODES.EMPTY_INPUT, "error", "Cannot compute range of an empty array."),
    ]);
  }
  return okResult(Math.max(...values) - Math.min(...values), values.length, "range = max(x) - min(x)");
}

/**
 * R-7 (linear interpolation) quantile — the same method R's default
 * `quantile()`, NumPy's default `np.percentile(..., method="linear")`, and
 * Excel's `PERCENTILE.INC` use. This is the ONE percentile method used
 * throughout this package (median, IQR, and benchmarking all call this),
 * per the spec's "one documented method, used consistently" requirement.
 *
 * p must be in [0, 1]. h = (n-1) * p (0-indexed); linear interpolation
 * between the two bracketing order statistics of a SORTED COPY of `values`.
 */
export function quantile(values: number[], p: number): StatResult<number> {
  if (values.length === 0) {
    return nullResult(0, "R-7 linear interpolation quantile", [
      issue(ISSUE_CODES.EMPTY_INPUT, "error", "Cannot compute a quantile of an empty array."),
    ]);
  }
  if (p < 0 || p > 1 || Number.isNaN(p)) {
    return nullResult(values.length, "R-7 linear interpolation quantile", [
      issue(ISSUE_CODES.INVALID_QUANTILE, "error", `p must be in [0, 1]; received ${p}.`),
    ]);
  }

  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) {
    return okResult(sorted[0], 1, "R-7 linear interpolation quantile");
  }

  const h = (sorted.length - 1) * p;
  const lowerIndex = Math.floor(h);
  const upperIndex = Math.ceil(h);
  const frac = h - lowerIndex;

  const value = sorted[lowerIndex] + frac * (sorted[upperIndex] - sorted[lowerIndex]);
  return okResult(value, values.length, "R-7 linear interpolation quantile");
}

/**
 * Percentile rank of `x` within `referenceValues`: the fraction of the
 * reference set at or below `x`, using the standard mid-rank convention for
 * ties — (count strictly below + 0.5 * count equal) / n — so a value tied
 * with several others lands at the middle of their shared rank rather than
 * being pushed to one end. Returned as a fraction in [0, 1], not a 0-100
 * number (callers multiply by 100 for display if they want a percentage).
 */
export function percentileRank(referenceValues: number[], x: number): StatResult<number> {
  const methodology = "percentile rank = (count below + 0.5 * count equal) / n";
  if (referenceValues.length === 0) {
    return nullResult(0, methodology, [
      issue(ISSUE_CODES.EMPTY_INPUT, "error", "Cannot compute a percentile rank against an empty reference set."),
    ]);
  }

  let below = 0;
  let equal = 0;
  for (const v of referenceValues) {
    if (v < x) below += 1;
    else if (v === x) equal += 1;
  }

  return okResult((below + 0.5 * equal) / referenceValues.length, referenceValues.length, methodology);
}

export interface Quartiles {
  q1: number | null;
  q2: number | null;
  q3: number | null;
  iqr: number | null;
}

export function quartiles(values: number[]): StatResult<Quartiles> {
  const q1 = quantile(values, 0.25);
  const q2 = quantile(values, 0.5);
  const q3 = quantile(values, 0.75);

  if (q1.value === null || q2.value === null || q3.value === null) {
    return nullResult(values.length, "Q1/Q2/Q3 via R-7 quantile", [
      ...q1.issues,
      ...q2.issues,
      ...q3.issues,
    ]);
  }

  return okResult(
    { q1: q1.value, q2: q2.value, q3: q3.value, iqr: q3.value - q1.value },
    values.length,
    "Q1/Q2/Q3 via R-7 quantile",
  );
}

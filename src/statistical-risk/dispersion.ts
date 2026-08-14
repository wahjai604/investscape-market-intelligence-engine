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

/** Values with |mean| below this are treated as "zero" for CoV purposes — see coefficientOfVariation(). */
const NEAR_ZERO_EPSILON = 1e-9;

export interface VarianceOptions {
  /** Defaults to false (sample variance, Bessel-corrected, divide by n-1). */
  population?: boolean;
}

function varianceOf(values: number[], options: VarianceOptions | undefined, methodologyLabel: string): StatResult<number> {
  const population = options?.population ?? false;
  const minN = population ? 1 : 2;

  if (values.length < minN) {
    return nullResult(values.length, methodologyLabel, [
      issue(
        values.length === 0 ? ISSUE_CODES.EMPTY_INPUT : ISSUE_CODES.INSUFFICIENT_SAMPLE_SIZE,
        "error",
        `${methodologyLabel} requires n>=${minN}; received n=${values.length}.`,
      ),
    ]);
  }

  const meanResult = mean(values);
  if (meanResult.value === null) {
    return nullResult(values.length, methodologyLabel, meanResult.issues);
  }

  const sumSquaredDeviations = values.reduce((acc, v) => acc + (v - meanResult.value!) ** 2, 0);
  const divisor = population ? values.length : values.length - 1;
  return okResult(sumSquaredDeviations / divisor, values.length, methodologyLabel);
}

/**
 * Sample variance by default (divide by n-1, Bessel's correction).
 * Pass `{ population: true }` to divide by n instead — an explicit opt-in,
 * never the default, per spec.
 */
export function variance(values: number[], options?: VarianceOptions): StatResult<number> {
  const methodology = options?.population
    ? "population variance = sum((x-mean)^2)/n"
    : "sample variance = sum((x-mean)^2)/(n-1)";
  return varianceOf(values, options, methodology);
}

export function standardDeviation(values: number[], options?: VarianceOptions): StatResult<number> {
  const varianceMethodology = options?.population
    ? "population standard deviation = sqrt(population variance)"
    : "sample standard deviation = sqrt(sample variance)";
  const varianceResult = varianceOf(values, options, varianceMethodology);
  if (varianceResult.value === null) {
    return varianceResult;
  }
  return okResult(Math.sqrt(varianceResult.value), values.length, varianceMethodology);
}

/**
 * Coefficient of variation = sample SD / |mean|. Always uses SAMPLE SD
 * regardless of any population option — CoV is conventionally a
 * sample-statistic ratio; a population-mode CoV was not requested by the
 * spec and would need its own explicit decision if ever needed.
 *
 * Returns null (not a huge/infinite number) when |mean| is at or below
 * NEAR_ZERO_EPSILON, since dividing by a near-zero mean produces a number
 * with no real interpretive meaning.
 */
export function coefficientOfVariation(values: number[]): StatResult<number> {
  const methodology = "coefficient of variation = sample SD / |mean|";
  const meanResult = mean(values);
  if (meanResult.value === null) {
    return nullResult(values.length, methodology, meanResult.issues);
  }
  if (Math.abs(meanResult.value) <= NEAR_ZERO_EPSILON) {
    return nullResult(values.length, methodology, [
      issue(ISSUE_CODES.ZERO_DISPERSION, "error", "Mean is zero (or near-zero); coefficient of variation is undefined."),
    ]);
  }

  const sdResult = standardDeviation(values);
  if (sdResult.value === null) {
    return nullResult(values.length, methodology, sdResult.issues);
  }

  return okResult(sdResult.value / Math.abs(meanResult.value), values.length, methodology);
}

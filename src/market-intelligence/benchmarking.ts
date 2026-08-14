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

import { StatResult, StatisticalIssue } from "../statistical-risk/types";
import { max, median, min, percentileRank } from "../statistical-risk/descriptive";
import { zScore } from "../statistical-risk/outliers";
import { MarketObservation, observationKey } from "./domain";
import { checkSeriesComparability } from "./comparability";

/**
 * Subject vs. market median, peer percentile, historical range, and z-score
 * — the four benchmark measures the spec names ("compare subject
 * property/assumption vs market median, peer percentile, historical range,
 * selected benchmark series").
 *
 * Comparability is checked against EVERY member of `benchmarkSeries`
 * before any of it is used — per spec, never silently merge incompatible
 * series. Non-comparable members are excluded from the computation and
 * their issues surfaced in `excludedIssues`, rather than either silently
 * dropping them with no trace or letting them corrupt the benchmark.
 */
export interface BenchmarkComparison {
  subjectValue: number;
  /** How many of `benchmarkSeries` were actually comparable and used below. */
  usableSampleSize: number;
  marketMedian: StatResult<number>;
  peerPercentileRank: StatResult<number>;
  historicalRange: { min: StatResult<number>; max: StatResult<number> };
  zScoreVsBenchmark: StatResult<number>;
  /** Comparability issues for series members that were excluded — never silent. */
  excludedIssues: StatisticalIssue[];
  derivedFrom: string[];
}

export function benchmarkSubject(subject: MarketObservation, benchmarkSeries: MarketObservation[]): BenchmarkComparison {
  const comparabilityResults = checkSeriesComparability(subject, benchmarkSeries);

  const usable: MarketObservation[] = [];
  const excludedIssues: StatisticalIssue[] = [];

  comparabilityResults.forEach((result, i) => {
    if (result.comparable) {
      usable.push(benchmarkSeries[i]);
    } else {
      excludedIssues.push(...result.issues);
    }
  });

  const values = usable.map((o) => o.value);

  return {
    subjectValue: subject.value,
    usableSampleSize: usable.length,
    marketMedian: median(values),
    peerPercentileRank: percentileRank(values, subject.value),
    historicalRange: { min: min(values), max: max(values) },
    zScoreVsBenchmark: zScore(values, subject.value),
    excludedIssues,
    derivedFrom: [observationKey(subject), ...usable.map(observationKey)],
  };
}

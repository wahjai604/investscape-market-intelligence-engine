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
import { cagr, indexSeries, periodChange, rollingGrowth, rollingMean } from "../statistical-risk/growth";
import { MarketObservation, observationKey } from "./domain";
import { checkComparability } from "./comparability";

/** A derived trend value plus the observations that produced it — the provenance the spec requires. */
export interface TrendPoint {
  periodStart: string;
  periodEnd: string;
  result: StatResult<number>;
  derivedFrom: string[];
}

/**
 * Sorts a COPY by periodStart — never mutates the caller's array. This is
 * the single ordering used by every function in this file, so trend
 * results are always chronological regardless of the input order.
 */
export function sortByPeriod(observations: MarketObservation[]): MarketObservation[] {
  return [...observations].sort((a, b) => a.periodStart.localeCompare(b.periodStart));
}

/**
 * Period-over-period change across a sorted MarketObservation series. This
 * one function IS month-over-month / quarter-over-quarter / year-over-year
 * — which one it represents depends entirely on the series' `frequency`
 * and cadence, not a different formula (see statistical-risk/growth.ts's
 * periodChange doc comment).
 *
 * Runs a comparability check between each consecutive pair FIRST — per
 * spec, "never silently merge incompatible series." An incomparable pair's
 * TrendPoint carries a null result plus the comparability issues instead of
 * a number computed from mismatched data.
 */
export function periodOverPeriodSeries(observations: MarketObservation[]): TrendPoint[] {
  const sorted = sortByPeriod(observations);
  const points: TrendPoint[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prior = sorted[i - 1];
    const current = sorted[i];
    const comparability = checkComparability(prior, current);

    if (!comparability.comparable) {
      points.push({
        periodStart: current.periodStart,
        periodEnd: current.periodEnd,
        result: { value: null, sampleSize: 2, issues: comparability.issues, methodology: "period change = (current - prior) / |prior|" },
        derivedFrom: [observationKey(prior), observationKey(current)],
      });
      continue;
    }

    const change = periodChange(current.value, prior.value);
    points.push({
      periodStart: current.periodStart,
      periodEnd: current.periodEnd,
      result: { ...change, issues: [...comparability.issues, ...change.issues] },
      derivedFrom: [observationKey(prior), observationKey(current)],
    });
  }

  return points;
}

/**
 * Whole-number-of-years approximation from two ISO date strings
 * (YYYY-MM-DD or full ISO datetime — both parse deterministically in JS,
 * with no locale dependence, per the engineering standard against
 * locale-dependent date parsing in core logic). Uses the Gregorian mean
 * year length (365.25 days) rather than exact calendar arithmetic — an
 * approximation, documented rather than hidden; exact day counts are not
 * needed for a CAGR that's already an annualized estimate.
 */
function yearsBetween(startIso: string, endIso: string): number {
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  return (new Date(endIso).getTime() - new Date(startIso).getTime()) / msPerYear;
}

/**
 * CAGR from the first to the last observation of a sorted, comparable
 * series. `years`, if omitted, is derived from periodStart of the first
 * observation to periodEnd of the last (see yearsBetween's approximation
 * note) — pass it explicitly to use an exact, caller-known duration
 * instead.
 */
export function cagrOverSeries(observations: MarketObservation[], years?: number): StatResult<number> & { derivedFrom: string[] } {
  const sorted = sortByPeriod(observations);
  if (sorted.length < 2) {
    return {
      value: null,
      sampleSize: sorted.length,
      issues: [{ code: "insufficient_sample_size", severity: "error", message: "CAGR over a series requires at least 2 observations." }],
      methodology: "CAGR = (ending/beginning)^(1/years) - 1",
      derivedFrom: sorted.map(observationKey),
    };
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const comparability = checkComparability(first, last);
  const effectiveYears = years ?? yearsBetween(first.periodStart, last.periodEnd);

  if (!comparability.comparable) {
    return {
      value: null,
      sampleSize: 2,
      issues: comparability.issues,
      methodology: "CAGR = (ending/beginning)^(1/years) - 1",
      derivedFrom: [observationKey(first), observationKey(last)],
    };
  }

  const result = cagr(first.value, last.value, effectiveYears);
  return { ...result, issues: [...comparability.issues, ...result.issues], derivedFrom: [observationKey(first), observationKey(last)] };
}

export interface RollingTrendPoint {
  periodStart: string;
  periodEnd: string;
  result: StatResult<number>;
  derivedFrom: string[];
}

/** Rolling mean over a sorted series' values, re-attached to each period + the observations in that window. */
export function rollingMeanOverSeries(observations: MarketObservation[], window: number): RollingTrendPoint[] {
  const sorted = sortByPeriod(observations);
  const results = rollingMean(
    sorted.map((o) => o.value),
    { window },
  );
  return sorted.map((obs, i) => ({
    periodStart: obs.periodStart,
    periodEnd: obs.periodEnd,
    result: results[i],
    derivedFrom: sorted.slice(Math.max(0, i - window + 1), i + 1).map(observationKey),
  }));
}

/** Rolling growth (vs. the value `window` periods prior) over a sorted series. */
export function rollingGrowthOverSeries(observations: MarketObservation[], window: number): RollingTrendPoint[] {
  const sorted = sortByPeriod(observations);
  const results = rollingGrowth(
    sorted.map((o) => o.value),
    { window },
  );
  return sorted.map((obs, i) => ({
    periodStart: obs.periodStart,
    periodEnd: obs.periodEnd,
    result: results[i],
    derivedFrom: i >= window ? [observationKey(sorted[i - window]), observationKey(obs)] : [observationKey(obs)],
  }));
}

/** Indexed series (value / baseValue * 100) over a sorted series, base taken from the first observation unless overridden. */
export function indexedObservationSeries(
  observations: MarketObservation[],
  baseValue?: number,
): { value: StatResult<number[]>; issues: StatisticalIssue[]; derivedFrom: string[] } {
  const sorted = sortByPeriod(observations);
  const effectiveBase = baseValue ?? sorted[0]?.value;
  const result = indexSeries(
    sorted.map((o) => o.value),
    effectiveBase,
  );
  return { value: result, issues: result.issues, derivedFrom: sorted.map(observationKey) };
}

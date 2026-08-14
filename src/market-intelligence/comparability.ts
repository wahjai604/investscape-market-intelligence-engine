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

import { MarketObservation, StatisticalIssue } from "./domain";

/**
 * Comparability checks, REQUIRED before any aggregation/benchmarking across
 * two MarketObservations, per spec: "Never silently merge incompatible
 * series - return explicit StatisticalIssues."
 *
 * Severity assignment (the spec lists the dimensions to check but not which
 * are hard blockers vs. soft warnings — this is a documented judgment call,
 * not given by the spec):
 *
 * ERROR (blocks direct numeric aggregation — combining these would produce
 * a number with no honest meaning):
 *   - metricId mismatch
 *   - unit mismatch
 *   - currency mismatch (heuristic — see below)
 *   - frequency mismatch (monthly vs. annual, etc.)
 *
 * WARNING (contextually questionable, but not mathematically nonsensical —
 * a caller may have a legitimate reason to proceed, e.g. benchmarking a
 * neighbourhood against its city):
 *   - geography level mismatch
 *   - property segment (tags.propertySegment) mismatch, when both are set
 *   - seasonal adjustment mismatch, when both are known (neither "unknown")
 *   - period misalignment (periodStart/periodEnd don't match exactly)
 *
 * MarketObservation has no separate `currency` field (per spec's own domain
 * contract) — currency is inferred from `unit` via a conservative heuristic:
 * a leading 3-letter uppercase code (e.g. "CAD/sqft", "USD"). Units that
 * don't match this pattern (e.g. "percent", "count", "score") are treated
 * as currency-agnostic and never flagged for currency mismatch.
 */
const CURRENCY_PREFIX = /^([A-Z]{3})(?:\/|\s|$)/;

function currencyOf(unit: string): string | null {
  const match = CURRENCY_PREFIX.exec(unit);
  return match ? match[1] : null;
}

/** Everything after a detected currency prefix — "CAD/sqft" -> "sqft", "CAD" -> "", "percent" -> "percent" (unchanged, no prefix to strip). */
function unitWithoutCurrencyPrefix(unit: string): string {
  const match = CURRENCY_PREFIX.exec(unit);
  return match ? unit.slice(match[0].length) : unit;
}

export interface ComparabilityResult {
  /** false iff at least one "error"-severity issue is present. */
  comparable: boolean;
  issues: StatisticalIssue[];
}

export function checkComparability(a: MarketObservation, b: MarketObservation): ComparabilityResult {
  const issues: StatisticalIssue[] = [];

  if (a.metricId !== b.metricId) {
    issues.push({
      code: "metric_mismatch",
      severity: "error",
      message: `Cannot compare different metrics: "${a.metricId}" vs "${b.metricId}".`,
    });
  }

  const currencyA = currencyOf(a.unit);
  const currencyB = currencyOf(b.unit);
  const bareUnitA = unitWithoutCurrencyPrefix(a.unit);
  const bareUnitB = unitWithoutCurrencyPrefix(b.unit);

  if (bareUnitA !== bareUnitB || (currencyA === null) !== (currencyB === null)) {
    // Either the non-currency part of the unit differs, or one side is
    // currency-denominated and the other isn't — either way, not the same
    // kind of unit, regardless of currency.
    issues.push({
      code: "unit_mismatch",
      severity: "error",
      message: `Unit mismatch: "${a.unit}" vs "${b.unit}".`,
    });
  } else if (currencyA && currencyB && currencyA !== currencyB) {
    issues.push({
      code: "currency_mismatch",
      severity: "error",
      message: `Currency mismatch inferred from unit: "${currencyA}" vs "${currencyB}".`,
    });
  }

  if (a.frequency !== b.frequency) {
    issues.push({
      code: "frequency_mismatch",
      severity: "error",
      message: `Frequency mismatch: "${a.frequency}" vs "${b.frequency}".`,
    });
  }

  if (a.geography.level !== b.geography.level) {
    issues.push({
      code: "geography_level_mismatch",
      severity: "warning",
      message: `Geography level mismatch: "${a.geography.level}" vs "${b.geography.level}".`,
    });
  }

  const segmentA = a.tags?.propertySegment;
  const segmentB = b.tags?.propertySegment;
  if (segmentA && segmentB && segmentA !== segmentB) {
    issues.push({
      code: "property_segment_mismatch",
      severity: "warning",
      message: `Property segment mismatch: "${segmentA}" vs "${segmentB}".`,
    });
  }

  const seasonalA = a.seasonalAdjustment;
  const seasonalB = b.seasonalAdjustment;
  if (seasonalA && seasonalB && seasonalA !== "unknown" && seasonalB !== "unknown" && seasonalA !== seasonalB) {
    issues.push({
      code: "seasonal_adjustment_mismatch",
      severity: "warning",
      message: `Seasonal adjustment mismatch: "${seasonalA}" vs "${seasonalB}".`,
    });
  }

  if (a.periodStart !== b.periodStart || a.periodEnd !== b.periodEnd) {
    issues.push({
      code: "period_misaligned",
      severity: "warning",
      message: `Period misalignment: [${a.periodStart}, ${a.periodEnd}] vs [${b.periodStart}, ${b.periodEnd}].`,
    });
  }

  return {
    comparable: issues.every((i) => i.severity !== "error"),
    issues,
  };
}

/**
 * Validates an entire series pairwise against a single reference
 * observation (e.g. before folding a batch of comps into one benchmark
 * aggregation) — returns one ComparabilityResult per series element,
 * index-aligned.
 */
export function checkSeriesComparability(reference: MarketObservation, series: MarketObservation[]): ComparabilityResult[] {
  return series.map((obs) => checkComparability(reference, obs));
}

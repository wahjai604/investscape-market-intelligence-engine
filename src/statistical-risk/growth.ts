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

/**
 * Generic period-over-period change = (current - prior) / |prior|.
 * This single function IS month-over-month, quarter-over-quarter, and
 * year-over-year — the difference between MoM/QoQ/YoY is entirely which
 * two observations the caller passes in (adjacent months, same-quarter-
 * last-year, etc.), not a different formula. Callers pick the pair from
 * their own MarketObservation series (see market-intelligence/trends.ts).
 */
export function periodChange(current: number, prior: number): StatResult<number> {
  const methodology = "period change = (current - prior) / |prior|";
  if (prior === 0) {
    return nullResult(2, methodology, [
      issue(ISSUE_CODES.ZERO_DENOMINATOR, "error", "Cannot compute period change from a prior value of zero."),
    ]);
  }
  return okResult((current - prior) / Math.abs(prior), 2, methodology);
}

/**
 * CAGR = (ending/beginning)^(1/years) - 1.
 *
 * Domain handling (not fully specified by the spec beyond "explicit
 * sign/domain handling", so documented here): requires years > 0 and both
 * beginning and ending to be strictly positive — a fractional power of a
 * non-positive base is not a real, interpretable growth rate for a
 * real-estate/financial quantity (price, rent, etc. are never legitimately
 * negative; zero is the same "cannot divide" case as periodChange()).
 */
export function cagr(beginning: number, ending: number, years: number): StatResult<number> {
  const methodology = "CAGR = (ending/beginning)^(1/years) - 1";

  if (years <= 0) {
    return nullResult(2, methodology, [
      issue(ISSUE_CODES.INVALID_YEARS, "error", `years must be > 0; received ${years}.`),
    ]);
  }
  if (beginning === 0) {
    return nullResult(2, methodology, [
      issue(ISSUE_CODES.ZERO_DENOMINATOR, "error", "Cannot compute CAGR from a beginning value of zero."),
    ]);
  }
  if (beginning < 0 || ending < 0) {
    return nullResult(2, methodology, [
      issue(
        ISSUE_CODES.INVALID_DOMAIN,
        "error",
        "CAGR requires non-negative beginning and ending values (a fractional power of a negative base is not a real growth rate).",
      ),
    ]);
  }

  return okResult((ending / beginning) ** (1 / years) - 1, 2, methodology);
}

export interface RollingOptions {
  window: number;
}

/**
 * Windowed average, index-aligned with the input: entry i of the result
 * corresponds to entry i of `values`. Insufficient-window policy (an
 * explicit choice, since the spec asks for one but doesn't dictate it):
 * indices before a full window has accumulated (i < window - 1) return
 * `value: null` with an "insufficient_window" issue rather than silently
 * shortening the window — this keeps the result array's length and index
 * alignment identical to the input, which matters most for charting a
 * rolling series alongside its raw series.
 */
export function rollingMean(values: number[], options: RollingOptions): StatResult<number>[] {
  const { window } = options;
  const methodology = `rolling mean, window=${window}`;

  if (window <= 0) {
    return values.map(() =>
      nullResult<number>(0, methodology, [issue(ISSUE_CODES.INVALID_DOMAIN, "error", `window must be > 0; received ${window}.`)]),
    );
  }

  return values.map((_, i) => {
    if (i < window - 1) {
      return nullResult<number>(i + 1, methodology, [
        issue(ISSUE_CODES.INSUFFICIENT_WINDOW, "warning", `Only ${i + 1} of ${window} required observations available at index ${i}.`),
      ]);
    }
    const windowSlice = values.slice(i - window + 1, i + 1);
    const meanResult = mean(windowSlice);
    return okResult<number>(meanResult.value as number, window, methodology);
  });
}

/**
 * Rolling growth = periodChange() applied between each value and the value
 * `window` entries before it, same insufficient-window policy as rollingMean.
 */
export function rollingGrowth(values: number[], options: RollingOptions): StatResult<number>[] {
  const { window } = options;
  const methodology = `rolling growth vs. value ${window} periods prior`;

  if (window <= 0) {
    return values.map(() =>
      nullResult<number>(0, methodology, [issue(ISSUE_CODES.INVALID_DOMAIN, "error", `window must be > 0; received ${window}.`)]),
    );
  }

  return values.map((value, i) => {
    if (i < window) {
      return nullResult<number>(i + 1, methodology, [
        issue(ISSUE_CODES.INSUFFICIENT_WINDOW, "warning", `No observation ${window} periods before index ${i}.`),
      ]);
    }
    const change = periodChange(value, values[i - window]);
    return { ...change, methodology };
  });
}

/**
 * Index series = value / baseValue * 100, one output per input value,
 * index-aligned. Returns a single StatResult wrapping the whole array
 * (rather than one StatResult per element) since a zero base invalidates
 * the entire series at once, not element-by-element.
 */
export function indexSeries(values: number[], baseValue: number): StatResult<number[]> {
  const methodology = "index series = value / baseValue * 100";
  if (baseValue === 0) {
    return nullResult(values.length, methodology, [
      issue(ISSUE_CODES.ZERO_DENOMINATOR, "error", "Cannot build an index series from a base value of zero."),
    ]);
  }
  return okResult(
    values.map((v) => (v / baseValue) * 100),
    values.length,
    methodology,
  );
}

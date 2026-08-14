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

/**
 * Zero-dependency pure-math layer. Nothing in src/statistical-risk/ may
 * import from @investscape/economic-engine, @investscape/calc-engine, or
 * src/market-intelligence/ — enforced by __tests__/module-boundaries.test.ts.
 */

export interface StatisticalIssue {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
}

export interface StatResult<T = number> {
  value: T | null;
  sampleSize: number;
  issues: StatisticalIssue[];
  methodology: string;
}

/**
 * Canonical issue codes used throughout statistical-risk/. `StatisticalIssue.code`
 * stays a plain string (per spec) so callers/adapters can add their own codes,
 * but every issue this package raises itself uses one of these — keeps codes
 * consistent instead of ad hoc per-function strings.
 */
export const ISSUE_CODES = {
  EMPTY_INPUT: "empty_input",
  INSUFFICIENT_SAMPLE_SIZE: "insufficient_sample_size",
  ZERO_DISPERSION: "zero_dispersion",
  ZERO_DENOMINATOR: "zero_denominator",
  UNALIGNED_PAIRS: "unaligned_pairs",
  NEGATIVE_WEIGHT: "negative_weight",
  INVALID_YEARS: "invalid_years",
  INVALID_DOMAIN: "invalid_domain",
  INSUFFICIENT_WINDOW: "insufficient_window",
  INVALID_QUANTILE: "invalid_quantile",
} as const;

/**
 * Severity convention used consistently across every function in this
 * package (documented once here rather than re-argued per function):
 *
 * - "error"   — the statistic could not be computed at all; `value` is null.
 * - "warning" — a value WAS returned but the caller should treat it with
 *               caution (e.g. a minimum-viable sample size).
 * - "info"    — purely informational, does not affect `value`.
 */
export function issue(code: string, severity: StatisticalIssue["severity"], message: string): StatisticalIssue {
  return { code, severity, message };
}

export function nullResult<T = number>(sampleSize: number, methodology: string, issues: StatisticalIssue[]): StatResult<T> {
  return { value: null, sampleSize, issues, methodology };
}

export function okResult<T = number>(value: T, sampleSize: number, methodology: string, issues: StatisticalIssue[] = []): StatResult<T> {
  return { value, sampleSize, issues, methodology };
}

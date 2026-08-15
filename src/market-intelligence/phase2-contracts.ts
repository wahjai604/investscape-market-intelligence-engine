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
 * PHASE 2 — INTERFACES ONLY. Nothing in this file is implemented.
 * See src/statistical-risk/phase2-contracts.ts for the Monte
 * Carlo/probability/portfolio-covariance contracts, which are pure-math
 * and have no MarketObservation dependency.
 *
 * ForecastRequest.series is typed as MarketObservation[] per the spec's
 * verbatim contract — that dependency is exactly why this file lives in
 * market-intelligence/ rather than statistical-risk/, unlike the spec's
 * own illustrative tree (which put all Phase 2 contracts under
 * statistical-risk/). Placing a MarketObservation-typed interface in the
 * zero-dependency pure-math layer would violate the architecture review's
 * module-boundary rule for statistical-risk/; the spec explicitly says its
 * illustrative tree may be adapted, so it was — documented here rather
 * than silently deviated from.
 *
 * Regression and Backtest contracts (added in a later pass, completing
 * the Section 13 scaffold gap a completeness audit found against the
 * master spec) apply the SAME module-boundary reasoning as Forecast:
 * RegressionRequest.target/predictors and BacktestRequest.actuals are all
 * MarketObservation[]-typed, so both belong here, not in
 * statistical-risk/. Contrast this with PortfolioCovarianceRequest
 * (statistical-risk/phase2-contracts.ts), which was deliberately kept
 * generic/number-array-based rather than MarketObservation-typed — see
 * that file's doc comment for why the same reasoning produced the
 * opposite placement there.
 *
 * "Do NOT implement a pseudo-forecasting algorithm merely to fill the
 * interface. Stop at typed interfaces + documentation unless explicitly
 * instructed otherwise." — followed literally below, for every run*()
 * function in this file, not just runForecast().
 */

import { StatisticalIssue, MarketObservation } from "./domain";

export interface ForecastRequest {
  series: MarketObservation[];
  horizonPeriods: number;
  model: string;
  confidenceLevels?: number[];
  assumptions?: Record<string, number | string | boolean>;
}

export interface ForecastPoint {
  period: string;
  estimate: number;
  lower?: number;
  upper?: number;
}

export interface ForecastResult {
  model: string;
  points: ForecastPoint[];
  diagnostics?: Record<string, number>;
  assumptions: Record<string, unknown>;
  issues: StatisticalIssue[];
}

/**
 * Not implemented. Throws immediately so an accidental call surfaces
 * loudly in development/tests rather than silently returning a fabricated
 * forecast.
 */
export function runForecast(_request: ForecastRequest): ForecastResult {
  throw new Error("Phase 2 not implemented: runForecast() is a documented contract only. See phase2-contracts.ts.");
}

/**
 * REGRESSION — added to close a scaffold gap a completeness audit found
 * against the master spec's own Section 13: only Forecast and Monte Carlo
 * had been scaffolded; Regression/ModelDiagnostics had not.
 *
 * Unlike ForecastRequest/MonteCarloRequest, the master spec gives a
 * CATEGORY for this ("regression models"; Section 9's intent implies
 * validating a fitted model), not a code block — so ModelDiagnostics'
 * exact field names below are a documented judgment call, not a spec
 * transcription. Chosen fields follow standard regression-diagnostic
 * vocabulary (r-squared, standard error, per-coefficient estimate +
 * confidence, sample size, residual summary) rather than inventing
 * unfamiliar terminology, so a future Phase 2 implementer isn't left
 * guessing what an unusual field name means. See docs/README.md §8 for
 * the same judgment call documented at the same level of detail as the
 * Forecast/Monte Carlo entries.
 */
export interface RegressionRequest {
  /** The dependent variable being predicted/explained. */
  target: MarketObservation[];
  /** One or more independent variable series, keyed by a caller-chosen predictor name (e.g. "gdp_growth"). */
  predictors: Record<string, MarketObservation[]>;
  /** Caller/future-implementation-chosen model identifier (e.g. "ols", "ridge") — not constrained by this contract. */
  model: string;
  assumptions?: Record<string, number | string | boolean>;
}

export interface RegressionCoefficient {
  /** Matches a key in RegressionRequest.predictors, or the literal "intercept". */
  predictor: string;
  estimate: number;
  standardError?: number;
  confidenceInterval?: [number, number];
  pValue?: number;
}

/**
 * Fields chosen as the minimum a caller would need to judge whether a
 * fitted model is trustworthy enough to act on — not an exhaustive list
 * of every diagnostic a regression library could produce.
 */
export interface ModelDiagnostics {
  rSquared?: number;
  adjustedRSquared?: number;
  /** Residual standard error — spread of actual-vs-predicted, in the target's own units. */
  standardError?: number;
  sampleSize: number;
  coefficients: RegressionCoefficient[];
  residualDiagnostics?: {
    meanResidual?: number;
    residualStandardDeviation?: number;
  };
}

export interface RegressionResult {
  model: string;
  diagnostics: ModelDiagnostics;
  assumptions: Record<string, unknown>;
  issues: StatisticalIssue[];
}

/** Not implemented — same throw-immediately policy as runForecast(). */
export function runRegression(_request: RegressionRequest): RegressionResult {
  throw new Error("Phase 2 not implemented: runRegression() is a documented contract only. See phase2-contracts.ts.");
}

/**
 * BACK-TESTING DIAGNOSTICS — the other half of the Section 13 scaffold
 * gap. Deliberately a SEPARATE interface rather than a field on
 * ModelDiagnostics: back-testing evaluates a model's PREDICTIONS against
 * held-out actuals over time, which is a validation concern that applies
 * equally to a ForecastResult or a RegressionResult — coupling it to
 * ModelDiagnostics specifically would have made it regression-only for no
 * real reason. `predicted` is intentionally a plain {period, estimate,
 * lower?, upper?} shape (matching ForecastPoint's fields) rather than
 * importing ForecastPoint directly, so a RegressionResult's coefficients
 * can be turned into the same shape without a forced dependency between
 * the two result types.
 *
 * Field choices (MAE/RMSE/MAPE/coverage) follow the parent Master
 * Implementation Blueprint's own release-gate language, per the
 * completeness audit that requested this addition.
 */
export interface BacktestRequest {
  /** Held-out actual observations the model's predictions are being checked against. */
  actuals: MarketObservation[];
  /** Model-produced estimates aligned to the same periods as `actuals`. */
  predicted: { period: string; estimate: number; lower?: number; upper?: number }[];
}

export interface BacktestDiagnostics {
  meanAbsoluteError?: number;
  rootMeanSquaredError?: number;
  meanAbsolutePercentageError?: number;
  /** Fraction of `actuals` that fell within the corresponding predicted [lower, upper] interval — "coverage" in release-gate language. Undefined when no predicted points carry an interval. */
  intervalCoverage?: number;
  sampleSize: number;
  issues: StatisticalIssue[];
}

/** Not implemented — same throw-immediately policy as runForecast()/runRegression(). */
export function runBacktest(_request: BacktestRequest): BacktestDiagnostics {
  throw new Error("Phase 2 not implemented: runBacktest() is a documented contract only. See phase2-contracts.ts.");
}

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
 *
 * Monte Carlo simulation and probability-of-threshold (e.g. P(negative
 * cash flow)) are explicitly deferred by the master spec. These two
 * contracts are pure-math (no MarketObservation dependency), so they stay
 * in statistical-risk/ per the spec's illustrative tree. The forecasting,
 * regression, and back-testing contracts, which DO depend on
 * MarketObservation, live in
 * ../market-intelligence/phase2-contracts.ts instead — see that file's
 * doc comment for why.
 *
 * PortfolioCovarianceRequest/Result (added in a later pass, closing a
 * scaffold gap a completeness audit found) is the one PLACEMENT judgment
 * call in this file worth calling out explicitly: portfolio
 * covariance/correlation risk could plausibly have been modeled as
 * MarketObservation-keyed, matching Regression/Backtest's pattern.
 * Deliberately kept generic (named number-array series) instead, because
 * (a) it parallels MonteCarloRequest's own genericness for an even-less-
 * specified capability — the spec's own Phase Scope Matrix marks
 * portfolio covariance "PHASE 2+", one notch further out than the rest of
 * Phase 2, so locking in a MarketObservation-shaped contract this early
 * would be premature; (b) the underlying math (a covariance/correlation
 * matrix) is a direct n-ary generalization of pearsonCorrelation() —
 * already pure math in THIS file's own correlation.ts — so keeping it
 * beside that precedent is more consistent than domain-coupling it.
 *
 * "Do NOT implement a pseudo-forecasting algorithm merely to fill the
 * interface. Stop at typed interfaces + documentation unless explicitly
 * instructed otherwise." — followed literally below, for every run*()
 * function in this file, not just runMonteCarloSimulation().
 */

import { StatisticalIssue } from "./types";

export interface MonteCarloRequest {
  iterations: number;
  /** Required for deterministic/reproducible runs once Phase 2 implements this — unseeded runs must not be silently non-reproducible. */
  seed?: number;
  variables: unknown[];
  targets: unknown[];
}

export interface ProbabilityResult {
  /** e.g. "negative_cash_flow" for a P(negative cash flow) query. */
  event: string;
  probability: number;
  sampleCount: number;
  assumptions: Record<string, unknown>;
  methodology: string;
}

/**
 * Not implemented. Throws immediately so an accidental call surfaces
 * loudly in development/tests rather than silently returning a fabricated
 * probability — there is no "close enough" placeholder for a Monte Carlo
 * simulation.
 */
export function runMonteCarloSimulation(_request: MonteCarloRequest): ProbabilityResult {
  throw new Error("Phase 2 not implemented: runMonteCarloSimulation() is a documented contract only. See phase2-contracts.ts.");
}

/**
 * PORTFOLIO COVARIANCE/CORRELATION RISK — PHASE 2+, the most speculative
 * and least-specified of every scaffold in this package. The master spec
 * names the capability but gives no field-level shape for it (unlike
 * Forecast/MonteCarlo, which had explicit interfaces). `series` is kept
 * deliberately loose (named number arrays, no alignment contract, no
 * return-vs-value-vs-price distinction) rather than over-specified, since
 * a "PHASE 2+" item is further from being built than the rest of Phase 2
 * and premature precision here is more likely to need revisiting than to
 * save future work. See this file's top doc comment for why this contract
 * stayed pure-math instead of MarketObservation-typed, unlike Regression/
 * Backtest in market-intelligence/phase2-contracts.ts.
 */
export interface PortfolioCovarianceRequest {
  /** One named return/value series per portfolio position (e.g. a property id mapped to its period-over-period returns). Caller is responsible for period alignment across series — this contract does not yet define one. */
  series: Record<string, number[]>;
  /** Mirrors statistical-risk's own variance()/standardDeviation() population option (dispersion.ts) — sample (n-1) by default when eventually implemented. */
  population?: boolean;
}

export interface PortfolioCovarianceResult {
  /** Position names, defining the row/column order for both matrices below. */
  positions: string[];
  /** positions.length x positions.length covariance matrix. */
  covarianceMatrix: number[][];
  /** Same shape, Pearson correlation matrix — the n-ary generalization of correlation.ts's pearsonCorrelation(). */
  correlationMatrix: number[][];
  methodology: string;
  issues: StatisticalIssue[];
}

/**
 * Not implemented. Throws immediately, same policy as every other run*()
 * in this package — no fabricated covariance matrix, ever.
 */
export function runPortfolioCovarianceAnalysis(_request: PortfolioCovarianceRequest): PortfolioCovarianceResult {
  throw new Error("Phase 2+ not implemented: runPortfolioCovarianceAnalysis() is a documented contract only. See phase2-contracts.ts.");
}

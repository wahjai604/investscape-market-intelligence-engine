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
 * in statistical-risk/ per the spec's illustrative tree. The forecasting
 * contracts (ForecastRequest/ForecastResult), which DO depend on
 * MarketObservation, live in
 * ../market-intelligence/phase2-contracts.ts instead — see that file's
 * doc comment for why.
 *
 * "Do NOT implement a pseudo-forecasting algorithm merely to fill the
 * interface. Stop at typed interfaces + documentation unless explicitly
 * instructed otherwise." — followed literally below.
 */

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

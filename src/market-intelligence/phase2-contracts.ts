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
 * Carlo/probability contracts, which are pure-math and have no
 * MarketObservation dependency.
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
 * "Do NOT implement a pseudo-forecasting algorithm merely to fill the
 * interface. Stop at typed interfaces + documentation unless explicitly
 * instructed otherwise." — followed literally below.
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

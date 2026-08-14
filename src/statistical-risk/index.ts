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

// Statistical Risk v1 — deterministic, side-effect-free, non-mutating pure math.
// Zero dependency on @investscape/economic-engine, @investscape/calc-engine,
// or ../market-intelligence — enforced by __tests__/module-boundaries.test.ts.

export * from "./types";
export * from "./descriptive";
export * from "./dispersion";
export * from "./growth";
export * from "./outliers";
export * from "./correlation";
export * from "./weighted";
export * from "./phase2-contracts";

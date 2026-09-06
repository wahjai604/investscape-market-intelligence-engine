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
 * Public entry point — Phase 1: descriptive/inferential statistics, trend
 * measures, comparability validation, benchmarking, and data-quality
 * assessment. Phase 2 (forecasting/regression/Monte Carlo/probability-of-
 * threshold/prediction intervals) exists only as documented interfaces —
 * see statistical-risk/phase2-contracts.ts and
 * market-intelligence/phase2-contracts.ts.
 *
 * See docs/README.md for module boundaries, formulas, and usage examples.
 */

export * as statisticalRisk from "./statistical-risk";
export * as marketIntelligence from "./market-intelligence";
export * as visualization from "./visualization";
export * as opportunityTypes from "./types/opportunity.types";

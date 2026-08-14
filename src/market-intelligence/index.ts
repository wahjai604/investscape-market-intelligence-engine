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

// Engine A — Market Intelligence. The ONLY module tree in this package
// allowed to depend on @investscape/economic-engine and
// @investscape/calc-engine as real dependencies.

export * from "./domain";
export * from "./geography";
export * from "./comparability";
export * from "./trends";
export * from "./benchmarking";
export * from "./data-quality";
export * from "./economic-engine-adapters";
export * from "./phase2-contracts";
export * from "./service";

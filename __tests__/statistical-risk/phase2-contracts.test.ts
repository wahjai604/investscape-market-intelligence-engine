/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 */

import {
  runMonteCarloSimulation,
  MonteCarloRequest,
  runPortfolioCovarianceAnalysis,
  PortfolioCovarianceRequest,
} from "../../src/statistical-risk/phase2-contracts";

describe("Phase 2 statistical-risk contracts — interfaces only, not implemented", () => {
  it("MonteCarloRequest/ProbabilityResult shapes typecheck (compile-time proof the contract exists)", () => {
    const request: MonteCarloRequest = { iterations: 1000, seed: 42, variables: [], targets: [] };
    expect(request.iterations).toBe(1000);
  });

  it("runMonteCarloSimulation throws rather than fabricating a result", () => {
    expect(() => runMonteCarloSimulation({ iterations: 100, variables: [], targets: [] })).toThrow(/Phase 2 not implemented/);
  });

  it("PortfolioCovarianceRequest.series is generic Record<string, number[]>, not MarketObservation-typed (compile-time proof of the deliberate placement)", () => {
    const request: PortfolioCovarianceRequest = {
      series: { "property-1": [0.02, 0.03, -0.01], "property-2": [0.01, 0.02, 0.0] },
      population: false,
    };
    expect(Object.keys(request.series)).toHaveLength(2);
  });

  it("runPortfolioCovarianceAnalysis throws with the distinct 'Phase 2+' message, not fabricating a matrix", () => {
    expect(() => runPortfolioCovarianceAnalysis({ series: {} })).toThrow(/Phase 2\+ not implemented/);
  });
});

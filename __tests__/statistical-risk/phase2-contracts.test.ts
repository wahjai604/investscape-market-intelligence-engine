/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 */

import { runMonteCarloSimulation, MonteCarloRequest } from "../../src/statistical-risk/phase2-contracts";

describe("Phase 2 statistical-risk contracts — interfaces only, not implemented", () => {
  it("MonteCarloRequest/ProbabilityResult shapes typecheck (compile-time proof the contract exists)", () => {
    const request: MonteCarloRequest = { iterations: 1000, seed: 42, variables: [], targets: [] };
    expect(request.iterations).toBe(1000);
  });

  it("runMonteCarloSimulation throws rather than fabricating a result", () => {
    expect(() => runMonteCarloSimulation({ iterations: 100, variables: [], targets: [] })).toThrow(/Phase 2 not implemented/);
  });
});

/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 */

import { pearsonCorrelation } from "../../src/statistical-risk/correlation";

describe("pearsonCorrelation", () => {
  it("Pearson([1,2,3], [2,4,6]) = 1.0 — required spec value", () => {
    expect(pearsonCorrelation([1, 2, 3], [2, 4, 6]).value).toBeCloseTo(1.0, 10);
  });

  it("computes -1.0 for a perfectly inverse relationship", () => {
    expect(pearsonCorrelation([1, 2, 3], [6, 4, 2]).value).toBeCloseTo(-1.0, 10);
  });

  it("methodology string states exploratory-only, no causation", () => {
    const result = pearsonCorrelation([1, 2, 3], [2, 4, 6]);
    expect(result.methodology.toLowerCase()).toContain("does not imply causation");
  });

  it("requires aligned pairs", () => {
    const result = pearsonCorrelation([1, 2, 3], [1, 2]);
    expect(result.value).toBeNull();
    expect(result.issues[0].code).toBe("unaligned_pairs");
  });

  it("requires n>=2", () => {
    const result = pearsonCorrelation([1], [2]);
    expect(result.value).toBeNull();
    expect(result.issues[0].code).toBe("insufficient_sample_size");
  });

  it("is undefined when one series has zero dispersion", () => {
    const result = pearsonCorrelation([5, 5, 5], [1, 2, 3]);
    expect(result.value).toBeNull();
    expect(result.issues[0].code).toBe("zero_dispersion");
  });
});

/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 */

import { weightedMean } from "../../src/statistical-risk/weighted";

describe("weightedMean", () => {
  it("computes sum(w*x)/sum(w)", () => {
    // (1*1 + 3*2) / (1+3) = 7/4 = 1.75
    expect(weightedMean([1, 2], [1, 3]).value).toBeCloseTo(1.75, 10);
  });

  it("rejects negative weights by default", () => {
    const result = weightedMean([1, 2], [-1, 3]);
    expect(result.value).toBeNull();
    expect(result.issues[0].code).toBe("negative_weight");
  });

  it("allows negative weights when explicitly opted in", () => {
    const result = weightedMean([1, 2], [-1, 3], { allowNegativeWeights: true });
    expect(result.value).toBeCloseTo((1 * -1 + 2 * 3) / 2, 10);
  });

  it("rejects a zero weight sum", () => {
    const result = weightedMean([1, 2], [1, -1], { allowNegativeWeights: true });
    expect(result.value).toBeNull();
    expect(result.issues[0].code).toBe("zero_denominator");
  });

  it("rejects mismatched array lengths", () => {
    const result = weightedMean([1, 2, 3], [1, 1]);
    expect(result.value).toBeNull();
    expect(result.issues[0].code).toBe("unaligned_pairs");
  });
});

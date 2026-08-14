/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 */

import { zScore, zScores, iqrBounds, detectOutliersByIQR } from "../../src/statistical-risk/outliers";

describe("zScore", () => {
  it("constant-series z-score ([5,5,5], x=5) -> null + zero-dispersion issue — required spec case", () => {
    const result = zScore([5, 5, 5], 5);
    expect(result.value).toBeNull();
    expect(result.issues[0].code).toBe("zero_dispersion");
  });

  it("computes (x-mean)/SD for a normal reference series", () => {
    const result = zScore([2, 4, 4, 4, 5, 5, 7, 9], 9);
    expect(result.value).toBeCloseTo((9 - 5) / 2.13809, 3);
  });
});

describe("zScores", () => {
  it("returns one z-score per element, self-referential", () => {
    const results = zScores([1, 2, 3, 4, 5]);
    expect(results).toHaveLength(5);
    expect(results[2].value).toBeCloseTo(0, 10); // the mean itself has z=0
  });
});

describe("iqrBounds", () => {
  it("computes Q1 - 1.5*IQR / Q3 + 1.5*IQR with the default multiplier", () => {
    const result = iqrBounds([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100]);
    expect(result.value?.multiplier).toBe(1.5);
    expect(result.value!.upper).toBeLessThan(100);
  });

  it("accepts a configurable multiplier", () => {
    const tight = iqrBounds([1, 2, 3, 4, 5, 100], 0.5);
    const wide = iqrBounds([1, 2, 3, 4, 5, 100], 3);
    expect(tight.value!.upper).toBeLessThan(wide.value!.upper);
  });
});

describe("detectOutliersByIQR", () => {
  it("flags the far outlier and nothing else in a clean series", () => {
    const result = detectOutliersByIQR([10, 11, 12, 13, 14, 100]);
    const flags = result.value!;
    expect(flags.find((f) => f.value === 100)?.isOutlier).toBe(true);
    expect(flags.filter((f) => f.isOutlier)).toHaveLength(1);
  });
});

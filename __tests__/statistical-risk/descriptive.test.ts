/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 */

import { mean, median, min, max, range, quantile, quartiles, percentileRank } from "../../src/statistical-risk/descriptive";

describe("mean", () => {
  it("mean([10,20,30]) = 20 — required spec value", () => {
    expect(mean([10, 20, 30]).value).toBe(20);
  });

  it("returns null + insufficient-data issue for an empty array — required spec case", () => {
    const result = mean([]);
    expect(result.value).toBeNull();
    expect(result.issues[0]).toMatchObject({ code: "empty_input", severity: "error" });
  });
});

describe("median", () => {
  it("median([1,3,2,4]) = 2.5 AND leaves the input array unchanged — required spec case", () => {
    const input = [1, 3, 2, 4];
    const result = median(input);
    expect(result.value).toBe(2.5);
    expect(input).toEqual([1, 3, 2, 4]);
  });

  it("returns the single middle value for an odd-length array", () => {
    expect(median([5, 1, 3]).value).toBe(3);
  });
});

describe("quantile (R-7)", () => {
  it("quantile([1,2,3,4], 0.25) = 1.75 — required spec value", () => {
    expect(quantile([1, 2, 3, 4], 0.25).value).toBeCloseTo(1.75, 10);
  });

  it("does not mutate the input array", () => {
    const input = [4, 1, 3, 2];
    quantile(input, 0.5);
    expect(input).toEqual([4, 1, 3, 2]);
  });

  it("rejects p outside [0,1]", () => {
    const result = quantile([1, 2, 3], 1.5);
    expect(result.value).toBeNull();
    expect(result.issues[0].code).toBe("invalid_quantile");
  });
});

describe("quartiles", () => {
  it("computes Q1/Q2/Q3/IQR consistently with quantile()", () => {
    const result = quartiles([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(result.value?.q1).toBeCloseTo(quantile([1, 2, 3, 4, 5, 6, 7, 8], 0.25).value as number, 10);
    expect(result.value?.iqr).toBeCloseTo((result.value!.q3 as number) - (result.value!.q1 as number), 10);
  });
});

describe("percentileRank", () => {
  it("ranks a value in the middle of a tie at the mid-rank convention", () => {
    // reference [1,2,2,3]; x=2 -> below=1, equal=2 -> (1+1)/4 = 0.5
    expect(percentileRank([1, 2, 2, 3], 2).value).toBeCloseTo(0.5, 10);
  });

  it("ranks the max at 1.0 in a strictly-below sense minus half its own tie weight", () => {
    // [1,2,3,4], x=4 -> below=3, equal=1 -> (3+0.5)/4 = 0.875
    expect(percentileRank([1, 2, 3, 4], 4).value).toBeCloseTo(0.875, 10);
  });
});

describe("min/max/range", () => {
  it("computes min/max/range correctly", () => {
    expect(min([3, 1, 2]).value).toBe(1);
    expect(max([3, 1, 2]).value).toBe(3);
    expect(range([3, 1, 2]).value).toBe(2);
  });

  it("returns null + issue for empty arrays", () => {
    expect(min([]).issues[0].code).toBe("empty_input");
    expect(max([]).issues[0].code).toBe("empty_input");
    expect(range([]).issues[0].code).toBe("empty_input");
  });
});

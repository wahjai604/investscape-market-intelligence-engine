/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 */

import { periodChange, cagr, rollingMean, rollingGrowth, indexSeries } from "../../src/statistical-risk/growth";

describe("periodChange", () => {
  it("computes (current-prior)/|prior|", () => {
    expect(periodChange(110, 100).value).toBeCloseTo(0.1, 10);
  });

  it("growth from zero (0 -> 10) -> null + zero-denominator issue — required spec case", () => {
    const result = periodChange(10, 0);
    expect(result.value).toBeNull();
    expect(result.issues[0].code).toBe("zero_denominator");
  });
});

describe("cagr", () => {
  it("CAGR 100 -> 121 over 2 years = 0.10 — required spec value", () => {
    expect(cagr(100, 121, 2).value).toBeCloseTo(0.1, 10);
  });

  it("rejects years <= 0", () => {
    const result = cagr(100, 121, 0);
    expect(result.value).toBeNull();
    expect(result.issues[0].code).toBe("invalid_years");
  });

  it("rejects a zero beginning value", () => {
    const result = cagr(0, 100, 2);
    expect(result.value).toBeNull();
    expect(result.issues[0].code).toBe("zero_denominator");
  });

  it("rejects a negative beginning or ending value", () => {
    const result = cagr(-100, 121, 2);
    expect(result.value).toBeNull();
    expect(result.issues[0].code).toBe("invalid_domain");
  });
});

describe("rollingMean", () => {
  it("returns null for indices before a full window accumulates", () => {
    const results = rollingMean([1, 2, 3, 4, 5], { window: 3 });
    expect(results[0].value).toBeNull();
    expect(results[1].value).toBeNull();
    expect(results[0].issues[0].code).toBe("insufficient_window");
  });

  it("computes the windowed average once the window is full, index-aligned", () => {
    const results = rollingMean([1, 2, 3, 4, 5], { window: 3 });
    expect(results[2].value).toBeCloseTo(2, 10); // mean(1,2,3)
    expect(results[3].value).toBeCloseTo(3, 10); // mean(2,3,4)
    expect(results[4].value).toBeCloseTo(4, 10); // mean(3,4,5)
    expect(results).toHaveLength(5);
  });
});

describe("rollingGrowth", () => {
  it("computes growth vs. the value `window` periods prior", () => {
    const results = rollingGrowth([100, 110, 121], { window: 2 });
    expect(results[0].value).toBeNull();
    expect(results[1].value).toBeNull();
    expect(results[2].value).toBeCloseTo(0.21, 10); // (121-100)/100
  });
});

describe("indexSeries", () => {
  it("computes value/baseValue*100", () => {
    const result = indexSeries([100, 110, 120], 100);
    expect(result.value?.[0]).toBeCloseTo(100, 10);
    expect(result.value?.[1]).toBeCloseTo(110, 10);
    expect(result.value?.[2]).toBeCloseTo(120, 10);
  });

  it("rejects a zero base value", () => {
    const result = indexSeries([100, 110], 0);
    expect(result.value).toBeNull();
    expect(result.issues[0].code).toBe("zero_denominator");
  });
});

/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 */

import { variance, standardDeviation, coefficientOfVariation } from "../../src/statistical-risk/dispersion";

const SAMPLE = [2, 4, 4, 4, 5, 5, 7, 9];

describe("standardDeviation", () => {
  it("sample SD([2,4,4,4,5,5,7,9]) ~= 2.13809 — required spec value", () => {
    expect(standardDeviation(SAMPLE).value).toBeCloseTo(2.13809, 5);
  });

  it("population SD (same input, population mode) = 2.0 — required spec value", () => {
    expect(standardDeviation(SAMPLE, { population: true }).value).toBeCloseTo(2.0, 10);
  });

  it("requires n>=2 for sample mode", () => {
    const result = standardDeviation([5]);
    expect(result.value).toBeNull();
    expect(result.issues[0].code).toBe("insufficient_sample_size");
  });

  it("allows n=1 for population mode", () => {
    expect(standardDeviation([5], { population: true }).value).toBe(0);
  });
});

describe("variance", () => {
  it("sample variance = SD^2 for the same input", () => {
    const sd = standardDeviation(SAMPLE).value as number;
    expect(variance(SAMPLE).value).toBeCloseTo(sd * sd, 10);
  });
});

describe("coefficientOfVariation", () => {
  it("computes SD/|mean| for a normal series", () => {
    const result = coefficientOfVariation(SAMPLE);
    const sd = standardDeviation(SAMPLE).value as number;
    expect(result.value).toBeCloseTo(sd / 5, 10); // mean of SAMPLE is 5
  });

  it("returns null when mean is zero — required edge case behavior", () => {
    const result = coefficientOfVariation([-5, 5]);
    expect(result.value).toBeNull();
    expect(result.issues[0].code).toBe("zero_dispersion");
  });
});

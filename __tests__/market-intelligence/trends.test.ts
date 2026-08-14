/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 */

import { periodOverPeriodSeries, cagrOverSeries, rollingMeanOverSeries, sortByPeriod } from "../../src/market-intelligence/trends";
import { MarketObservation } from "../../src/market-intelligence/domain";
import { wrapCityGeography } from "../../src/market-intelligence/geography";

const GEOGRAPHY = wrapCityGeography({ cityId: "toronto-on", cityName: "Toronto", regionId: "central-canada" });
const SOURCE = { sourceId: "CREA", sourceName: "CREA", sourceType: "commercial" as const };

function monthlyObs(month: string, value: number): MarketObservation {
  return {
    metricId: "city.median_rent",
    value,
    unit: "currency_per_month",
    periodStart: `${month}-01`,
    periodEnd: `${month}-28`,
    frequency: "monthly",
    geography: GEOGRAPHY,
    source: SOURCE,
  };
}

describe("sortByPeriod", () => {
  it("sorts chronologically without mutating the input array", () => {
    const input = [monthlyObs("2026-03", 3), monthlyObs("2026-01", 1), monthlyObs("2026-02", 2)];
    const sorted = sortByPeriod(input);
    expect(sorted.map((o) => o.value)).toEqual([1, 2, 3]);
    expect(input.map((o) => o.value)).toEqual([3, 1, 2]); // original order preserved
  });
});

describe("periodOverPeriodSeries", () => {
  it("computes period-over-period change across a comparable series", () => {
    const series = [monthlyObs("2026-01", 2000), monthlyObs("2026-02", 2100)];
    const points = periodOverPeriodSeries(series);
    expect(points).toHaveLength(1);
    expect(points[0].result.value).toBeCloseTo(0.05, 10);
    expect(points[0].derivedFrom).toHaveLength(2);
  });

  it("never silently merges an incomparable pair — surfaces comparability issues instead of a number", () => {
    const series = [monthlyObs("2026-01", 2000), { ...monthlyObs("2026-02", 2100), metricId: "city.median_house_price" }];
    const points = periodOverPeriodSeries(series);
    expect(points[0].result.value).toBeNull();
    expect(points[0].result.issues.some((i) => i.code === "metric_mismatch")).toBe(true);
  });
});

describe("cagrOverSeries", () => {
  it("computes CAGR from first to last observation of a sorted series", () => {
    const series = [monthlyObs("2024-01", 100), monthlyObs("2026-01", 121)];
    const result = cagrOverSeries(series, 2);
    expect(result.value).toBeCloseTo(0.1, 10);
    expect(result.derivedFrom).toHaveLength(2);
  });

  it("requires at least 2 observations", () => {
    const result = cagrOverSeries([monthlyObs("2026-01", 100)]);
    expect(result.value).toBeNull();
    expect(result.issues[0].code).toBe("insufficient_sample_size");
  });
});

describe("rollingMeanOverSeries", () => {
  it("is index-aligned with the sorted input and carries derivedFrom provenance", () => {
    const series = [monthlyObs("2026-01", 1), monthlyObs("2026-02", 2), monthlyObs("2026-03", 3)];
    const points = rollingMeanOverSeries(series, 2);
    expect(points).toHaveLength(3);
    expect(points[0].result.value).toBeNull();
    expect(points[1].result.value).toBeCloseTo(1.5, 10);
    expect(points[1].derivedFrom).toHaveLength(2);
  });
});

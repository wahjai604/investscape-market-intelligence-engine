/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 */

import { checkComparability } from "../../src/market-intelligence/comparability";
import { MarketObservation } from "../../src/market-intelligence/domain";
import { wrapCityGeography, wrapNeighborhoodGeography } from "../../src/market-intelligence/geography";

function baseObs(overrides: Partial<MarketObservation> = {}): MarketObservation {
  return {
    metricId: "city.median_rent",
    value: 2000,
    unit: "CAD/month",
    periodStart: "2026-01-01",
    periodEnd: "2026-01-31",
    frequency: "monthly",
    geography: wrapCityGeography({ cityId: "toronto-on", cityName: "Toronto", regionId: "central-canada" }),
    source: { sourceId: "CREA", sourceName: "CREA", sourceType: "commercial" },
    ...overrides,
  };
}

describe("checkComparability", () => {
  it("two identical observations are comparable with no issues", () => {
    const result = checkComparability(baseObs(), baseObs());
    expect(result.comparable).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("never silently merges different metrics — metric mismatch is an error", () => {
    const result = checkComparability(baseObs(), baseObs({ metricId: "city.median_house_price" }));
    expect(result.comparable).toBe(false);
    expect(result.issues.find((i) => i.code === "metric_mismatch")?.severity).toBe("error");
  });

  it("structural unit mismatch (not just a currency difference) is an error", () => {
    const result = checkComparability(baseObs({ unit: "percent" }), baseObs({ unit: "days" }));
    expect(result.comparable).toBe(false);
    expect(result.issues.find((i) => i.code === "unit_mismatch")?.severity).toBe("error");
  });

  it("currency-denominated vs. non-currency-denominated for the same bare unit is a unit mismatch, not a currency mismatch", () => {
    const result = checkComparability(baseObs({ unit: "CAD/sqft" }), baseObs({ unit: "sqft" }));
    expect(result.comparable).toBe(false);
    expect(result.issues.find((i) => i.code === "unit_mismatch")?.severity).toBe("error");
    expect(result.issues.find((i) => i.code === "currency_mismatch")).toBeUndefined();
  });

  it("currency mismatch, inferred from matching-shape units with different leading currency codes, is an error", () => {
    const result = checkComparability(baseObs({ unit: "CAD/sqft" }), baseObs({ unit: "USD/sqft" }));
    expect(result.comparable).toBe(false);
    expect(result.issues.find((i) => i.code === "currency_mismatch")).toBeDefined();
  });

  it("non-currency units (percent, count) never trigger a currency-mismatch false positive", () => {
    const result = checkComparability(baseObs({ unit: "percent" }), baseObs({ unit: "percent" }));
    expect(result.issues.find((i) => i.code === "currency_mismatch")).toBeUndefined();
  });

  it("frequency mismatch is an error", () => {
    const result = checkComparability(baseObs(), baseObs({ frequency: "annual" }));
    expect(result.comparable).toBe(false);
    expect(result.issues.find((i) => i.code === "frequency_mismatch")?.severity).toBe("error");
  });

  it("geography level mismatch is a warning, not a blocker", () => {
    const neighborhoodObs = baseObs({
      geography: wrapNeighborhoodGeography({ neighborhoodId: "n1", neighborhoodName: "N1", cityId: "toronto-on" }),
    });
    const result = checkComparability(baseObs(), neighborhoodObs);
    expect(result.comparable).toBe(true);
    expect(result.issues.find((i) => i.code === "geography_level_mismatch")?.severity).toBe("warning");
  });

  it("period misalignment is a warning, not a blocker", () => {
    const result = checkComparability(baseObs(), baseObs({ periodStart: "2026-02-01", periodEnd: "2026-02-28" }));
    expect(result.comparable).toBe(true);
    expect(result.issues.find((i) => i.code === "period_misaligned")?.severity).toBe("warning");
  });

  it("seasonal adjustment mismatch is only flagged when both sides are known", () => {
    const withUnknown = checkComparability(baseObs({ seasonalAdjustment: "seasonally_adjusted" }), baseObs({ seasonalAdjustment: "unknown" }));
    expect(withUnknown.issues.find((i) => i.code === "seasonal_adjustment_mismatch")).toBeUndefined();

    const bothKnown = checkComparability(
      baseObs({ seasonalAdjustment: "seasonally_adjusted" }),
      baseObs({ seasonalAdjustment: "not_adjusted" }),
    );
    expect(bothKnown.issues.find((i) => i.code === "seasonal_adjustment_mismatch")?.severity).toBe("warning");
  });
});

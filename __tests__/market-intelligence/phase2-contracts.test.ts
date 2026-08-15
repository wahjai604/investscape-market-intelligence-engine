/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 */

import { runForecast, ForecastRequest, runRegression, RegressionRequest, runBacktest, BacktestRequest } from "../../src/market-intelligence/phase2-contracts";
import { MarketObservation } from "../../src/market-intelligence/domain";
import { wrapCityGeography } from "../../src/market-intelligence/geography";

const SAMPLE_OBSERVATION: MarketObservation = {
  metricId: "city.median_rent",
  value: 2000,
  unit: "currency_per_month",
  periodStart: "2026-01-01",
  periodEnd: "2026-01-31",
  frequency: "monthly",
  geography: wrapCityGeography({ cityId: "toronto-on", cityName: "Toronto", regionId: "central-canada" }),
  source: { sourceId: "CREA", sourceName: "CREA", sourceType: "commercial" },
};

describe("Phase 2 market-intelligence contracts — interfaces only, not implemented", () => {
  it("ForecastRequest.series is typed as MarketObservation[] (compile-time proof of the spec's verbatim contract)", () => {
    const request: ForecastRequest = { series: [SAMPLE_OBSERVATION], horizonPeriods: 6, model: "arima" };
    expect(request.series).toHaveLength(1);
  });

  it("runForecast throws rather than fabricating a forecast", () => {
    expect(() => runForecast({ series: [], horizonPeriods: 6, model: "arima" })).toThrow(/Phase 2 not implemented/);
  });

  it("RegressionRequest.target/predictors are typed as MarketObservation[] (compile-time proof)", () => {
    const request: RegressionRequest = {
      target: [SAMPLE_OBSERVATION],
      predictors: { gdp_growth: [SAMPLE_OBSERVATION] },
      model: "ols",
    };
    expect(request.predictors.gdp_growth).toHaveLength(1);
  });

  it("runRegression throws rather than fabricating diagnostics", () => {
    expect(() => runRegression({ target: [], predictors: {}, model: "ols" })).toThrow(/Phase 2 not implemented/);
  });

  it("BacktestRequest.actuals is typed as MarketObservation[]; predicted is a plain ForecastPoint-shaped array (compile-time proof)", () => {
    const request: BacktestRequest = {
      actuals: [SAMPLE_OBSERVATION],
      predicted: [{ period: "2026-01-31", estimate: 1950, lower: 1800, upper: 2100 }],
    };
    expect(request.predicted[0].estimate).toBe(1950);
  });

  it("runBacktest throws rather than fabricating diagnostics", () => {
    expect(() => runBacktest({ actuals: [], predicted: [] })).toThrow(/Phase 2 not implemented/);
  });
});

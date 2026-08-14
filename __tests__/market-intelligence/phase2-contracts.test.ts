/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 */

import { runForecast, ForecastRequest } from "../../src/market-intelligence/phase2-contracts";
import { MarketObservation } from "../../src/market-intelligence/domain";
import { wrapCityGeography } from "../../src/market-intelligence/geography";

describe("Phase 2 market-intelligence contracts — interfaces only, not implemented", () => {
  it("ForecastRequest.series is typed as MarketObservation[] (compile-time proof of the spec's verbatim contract)", () => {
    const observation: MarketObservation = {
      metricId: "city.median_rent",
      value: 2000,
      unit: "currency_per_month",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      frequency: "monthly",
      geography: wrapCityGeography({ cityId: "toronto-on", cityName: "Toronto", regionId: "central-canada" }),
      source: { sourceId: "CREA", sourceName: "CREA", sourceType: "commercial" },
    };
    const request: ForecastRequest = { series: [observation], horizonPeriods: 6, model: "arima" };
    expect(request.series).toHaveLength(1);
  });

  it("runForecast throws rather than fabricating a forecast", () => {
    expect(() => runForecast({ series: [], horizonPeriods: 6, model: "arima" })).toThrow(/Phase 2 not implemented/);
  });
});

/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 */

import { buildNeighborhoodSnapshot, benchmarkNeighborhoodMetric } from "../../src/market-intelligence/service";

describe("integration example: buildNeighborhoodSnapshot", () => {
  it("fetches a real neighborhood through economic-engine and assesses its data quality end-to-end", () => {
    const snapshot = buildNeighborhoodSnapshot({
      neighborhoodId: "toronto-yorkville-on",
      neighborhoodName: "Yorkville",
      cityId: "toronto-on",
      coordinates: { lat: 43.6708, lng: -79.3933 },
      asOfDate: new Date("2026-08-04"),
    });

    expect(snapshot.observations.length).toBeGreaterThan(0);
    expect(snapshot.dataQuality.score).toBeGreaterThanOrEqual(0);
    expect(snapshot.dataQuality.score).toBeLessThanOrEqual(100);
    expect(["High", "Moderate", "Low", "Uncertain"]).toContain(snapshot.dataQuality.label);
  });
});

describe("integration example: benchmarkNeighborhoodMetric", () => {
  it("returns null when the subject has no observation for the requested metric", () => {
    const result = benchmarkNeighborhoodMetric(
      {
        neighborhoodId: "toronto-yorkville-on",
        neighborhoodName: "Yorkville",
        cityId: "toronto-on",
        coordinates: { lat: 43.6708, lng: -79.3933 },
        asOfDate: new Date("2026-08-04"),
      },
      [],
      "not_a_real_metric",
    );
    expect(result).toBeNull();
  });
});

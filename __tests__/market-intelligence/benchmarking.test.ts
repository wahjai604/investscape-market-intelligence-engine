/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 */

import { benchmarkSubject } from "../../src/market-intelligence/benchmarking";
import { MarketObservation } from "../../src/market-intelligence/domain";
import { wrapNeighborhoodGeography } from "../../src/market-intelligence/geography";

const SOURCE = { sourceId: "CREA", sourceName: "CREA", sourceType: "commercial" as const };

function rentObs(neighborhoodId: string, value: number, metricId = "neighborhood.median_rent"): MarketObservation {
  return {
    metricId,
    value,
    unit: "currency_per_month",
    periodStart: "2026-01-01",
    periodEnd: "2026-01-31",
    frequency: "monthly",
    geography: wrapNeighborhoodGeography({ neighborhoodId, neighborhoodName: neighborhoodId, cityId: "toronto-on" }),
    source: SOURCE,
  };
}

describe("benchmarkSubject", () => {
  const peers = [rentObs("n1", 1800), rentObs("n2", 2000), rentObs("n3", 2200)];

  it("computes median/percentile/range/z-score against a fully comparable peer set", () => {
    const subject = rentObs("subject", 2000);
    const result = benchmarkSubject(subject, peers);

    expect(result.usableSampleSize).toBe(3);
    expect(result.marketMedian.value).toBe(2000);
    expect(result.historicalRange.min.value).toBe(1800);
    expect(result.historicalRange.max.value).toBe(2200);
    expect(result.excludedIssues).toHaveLength(0);
  });

  it("excludes incomparable peers rather than silently merging them, and reports why", () => {
    const subject = rentObs("subject", 2000);
    const mixedPeers = [...peers, rentObs("n4", 500000, "neighborhood.median_sold_price")];
    const result = benchmarkSubject(subject, mixedPeers);

    expect(result.usableSampleSize).toBe(3); // the mismatched-metric peer excluded
    expect(result.excludedIssues.some((i) => i.code === "metric_mismatch")).toBe(true);
  });

  it("derivedFrom includes the subject plus every usable peer", () => {
    const subject = rentObs("subject", 2000);
    const result = benchmarkSubject(subject, peers);
    expect(result.derivedFrom).toHaveLength(1 + peers.length);
  });
});

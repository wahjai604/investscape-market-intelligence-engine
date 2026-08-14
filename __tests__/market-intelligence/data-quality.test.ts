/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 */

import { DATA_FRESHNESS_TTL } from "@investscape/economic-engine";
import { assessDataQuality, DataQualityInputs, sourceTypeToProvenanceSource, NOT_ENOUGH_DATA_ISSUE_CODE } from "../../src/market-intelligence/data-quality";
import { fetchCityObservations, freshnessScoreFor } from "../../src/market-intelligence/economic-engine-adapters";

describe("assessDataQuality", () => {
  it("weights only the components actually supplied", () => {
    const result = assessDataQuality({ completeness: 1, freshness: 1 });
    expect(result.score).toBe(100);
    expect(result.label).toBe("High");
    expect(result.components.sampleAdequacy).toBeUndefined();
  });

  it("never manufactures a value for a component the caller omitted", () => {
    const result = assessDataQuality({ completeness: 0.5, freshness: 0.5 });
    expect(result.components.sourceReliability).toBeUndefined();
  });

  it("represents 'not enough data to assess' as a StatisticalIssue, not a label value — per architecture review", () => {
    const result = assessDataQuality({ completeness: 0, freshness: 0 });
    expect(result.issues.find((i) => i.code === NOT_ENOUGH_DATA_ISSUE_CODE)?.severity).toBe("error");
    // ConfidenceLabel has no "insufficient"/"none" member — label must still be one of the four real values.
    expect(["High", "Moderate", "Low", "Uncertain"]).toContain(result.label);
  });

  it("respects custom weights", () => {
    const inputs: DataQualityInputs = { completeness: 1, freshness: 0 };
    const completenessHeavy = assessDataQuality(inputs, {
      completeness: 10,
      freshness: 1,
      sampleAdequacy: 1,
      geographicFit: 1,
      segmentSimilarity: 1,
      sourceReliability: 1,
    });
    expect(completenessHeavy.score).toBeGreaterThan(80);
  });
});

describe("sourceTypeToProvenanceSource", () => {
  it("maps every SourceMetadata.sourceType to a valid calc-engine ProvenanceSource", () => {
    expect(sourceTypeToProvenanceSource("government")).toBe("market_data");
    expect(sourceTypeToProvenanceSource("commercial")).toBe("market_data");
    expect(sourceTypeToProvenanceSource("brokerage")).toBe("market_data");
    expect(sourceTypeToProvenanceSource("internal")).toBe("calculated");
    expect(sourceTypeToProvenanceSource("user")).toBe("user_input");
    expect(sourceTypeToProvenanceSource("other")).toBe("estimated");
  });
});

describe("freshnessScoreFor does not hardcode thresholds that disagree with economic-engine's real DATA_FRESHNESS_TTL", () => {
  it("economic-engine's real constants are still 7/14/30/90 days, ms-exact", () => {
    const day = 24 * 60 * 60 * 1000;
    expect(DATA_FRESHNESS_TTL.RATES).toBe(7 * day);
    expect(DATA_FRESHNESS_TTL.MACRO).toBe(14 * day);
    expect(DATA_FRESHNESS_TTL.COMPS).toBe(30 * day);
    expect(DATA_FRESHNESS_TTL.DEMOGRAPHICS).toBe(90 * day);
  });

  it("freshnessScoreFor(asOfDate, category) is computed directly against the imported constant, not a local copy", () => {
    const now = new Date("2026-08-19"); // 15 days after a 2026-08-04 asOfDate
    const asOfDate = new Date("2026-08-04");
    const ageMs = now.getTime() - asOfDate.getTime();
    const expected = 1 - ageMs / DATA_FRESHNESS_TTL.COMPS;
    expect(freshnessScoreFor(asOfDate, "COMPS", now)).toBeCloseTo(expected, 10);
  });

  it("is fully stale (0) once age reaches the category TTL, fully fresh (1) at age 0", () => {
    const asOfDate = new Date("2026-08-04");
    expect(freshnessScoreFor(asOfDate, "MACRO", asOfDate)).toBe(1);
    expect(freshnessScoreFor(asOfDate, "MACRO", new Date(asOfDate.getTime() + DATA_FRESHNESS_TTL.MACRO))).toBe(0);
  });
});

describe("comparability-check interaction: a real confidence:'low' economic-engine bundle propagates into the composite score", () => {
  // yellowknife-nt is a REAL mock entry in investscape-economic-engine's
  // E30 city store with confidence: 'low' — verified by direct inspection
  // of investscape-economic-engine/src/E30-city-market-analysis.ts. This
  // test goes through the real cityMarketAnalysis() call, not a hand-built
  // fixture, so it proves the actual engine's confidence value reaches the
  // composite score end-to-end.
  const now = new Date("2026-08-05"); // 1 day after the mock's asOfDate — freshness stays near 1 either way
  const mockAsOfDate = new Date("2026-08-04");

  it("confidence:'low' produces a lower sourceReliability input than confidence:'high'", () => {
    const low = fetchCityObservations(
      { cityId: "yellowknife-nt", cityName: "Yellowknife", province: "Northwest Territories", regionId: "northern-canada", asOfDate: mockAsOfDate },
      now,
    );
    const high = fetchCityObservations(
      { cityId: "toronto-on", cityName: "Toronto", province: "Ontario", regionId: "central-canada", asOfDate: mockAsOfDate },
      now,
    );

    expect(low.bundle.confidence).toBe("low");
    expect(high.bundle.confidence).toBe("high");
    expect(low.dataQualityInputs.sourceReliability).toBeLessThan(high.dataQualityInputs.sourceReliability as number);
  });

  it("the composite score for the confidence:'low' bundle is lower than the same completeness/freshness scored WITHOUT confidence — proving confidence is not ignored", () => {
    const low = fetchCityObservations(
      { cityId: "yellowknife-nt", cityName: "Yellowknife", province: "Northwest Territories", regionId: "northern-canada", asOfDate: mockAsOfDate },
      now,
    );

    const withConfidence = assessDataQuality(low.dataQualityInputs);
    const completenessAndFreshnessOnly = assessDataQuality({
      completeness: low.dataQualityInputs.completeness,
      freshness: low.dataQualityInputs.freshness,
      // sourceReliability deliberately omitted — "MI's own completeness/freshness math computed in isolation"
    });

    expect(withConfidence.score).toBeLessThan(completenessAndFreshnessOnly.score);
  });

  it("swapping only sourceReliability from low to high (completeness/freshness held constant) raises the composite score", () => {
    const low = fetchCityObservations(
      { cityId: "yellowknife-nt", cityName: "Yellowknife", province: "Northwest Territories", regionId: "northern-canada", asOfDate: mockAsOfDate },
      now,
    );

    const lowScore = assessDataQuality(low.dataQualityInputs);
    const highScore = assessDataQuality({ ...low.dataQualityInputs, sourceReliability: 0.9 });

    expect(highScore.score).toBeGreaterThan(lowScore.score);
  });
});

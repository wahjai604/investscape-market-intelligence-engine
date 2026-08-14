/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 */

import {
  wrapRegionGeography,
  wrapCityGeography,
  wrapNeighborhoodGeography,
  unwrapEconomicEngineGeography,
  countryCodeForRegionId,
} from "../../src/market-intelligence/geography";

describe("geography round-trip — architecture review requirement", () => {
  it("recovers the original regionId from a wrapped region GeographyRef", () => {
    const ref = wrapRegionGeography({ regionId: "central-canada", regionName: "Central Canada" });
    const recovered = unwrapEconomicEngineGeography(ref);
    expect(recovered).toEqual({ level: "region", id: "central-canada" });
  });

  it("recovers the original cityId from a wrapped city GeographyRef", () => {
    const ref = wrapCityGeography({ cityId: "toronto-on", cityName: "Toronto", regionId: "central-canada" });
    const recovered = unwrapEconomicEngineGeography(ref);
    expect(recovered).toEqual({ level: "city", id: "toronto-on" });
  });

  it("recovers the original neighborhoodId AND coordinates from a wrapped neighborhood GeographyRef", () => {
    const ref = wrapNeighborhoodGeography({
      neighborhoodId: "toronto-annex",
      neighborhoodName: "The Annex",
      cityId: "toronto-on",
      coordinates: { lat: 43.6677, lng: -79.4079 },
    });
    const recovered = unwrapEconomicEngineGeography(ref);
    expect(recovered).toEqual({ level: "neighborhood", id: "toronto-annex" });
    expect(ref.economicEngine.coordinates).toEqual({ lat: 43.6677, lng: -79.4079 });
  });

  it("region-level countryCode is derived from economic-engine's real REGION_DETAILS, not guessed", () => {
    expect(countryCodeForRegionId("central-canada")).toBe("CA");
    expect(countryCodeForRegionId("us-northeast")).toBe("US");
    expect(countryCodeForRegionId("not-a-real-region")).toBe("UNKNOWN");
  });

  it("city/neighborhood countryCode defaults to UNKNOWN when not caller-supplied — economic-engine carries no country field at those levels", () => {
    const ref = wrapCityGeography({ cityId: "toronto-on", cityName: "Toronto", regionId: "central-canada" });
    expect(ref.countryCode).toBe("UNKNOWN");
  });

  it("accepts a caller-supplied countryCode for city/neighborhood levels", () => {
    const ref = wrapCityGeography({ cityId: "toronto-on", cityName: "Toronto", regionId: "central-canada", countryCode: "CA" });
    expect(ref.countryCode).toBe("CA");
  });

  it("maps economic-engine's three levels onto the spec's GeographyLevel union without collapsing city vs neighbourhood spelling", () => {
    expect(wrapCityGeography({ cityId: "x", cityName: "X", regionId: "central-canada" }).level).toBe("city");
    expect(
      wrapNeighborhoodGeography({ neighborhoodId: "x", neighborhoodName: "X", cityId: "y" }).level,
    ).toBe("neighbourhood");
  });
});

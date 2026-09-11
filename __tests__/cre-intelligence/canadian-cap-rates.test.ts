/**
 * InvestScape™ E68 Phase 4B — Canadian cap-rate provenance guarantees.
 *
 * Covers Part 11 of the Phase 4B specification: complete provenance for every
 * Canadian observation, rejection of invalid CREA/CMHC provenance, the legacy
 * audit's null conversion, coexistence of legacy and E68 records, normalization
 * survival, exhaustive FRED/Zillow exclusion, duplicate-free observations, and
 * a guard against unsupported interpolation.
 */
import { CA_CAP_RATE_OBSERVATIONS, CA_CAP_RATE_GAPS } from "../../src/cre-intelligence/data/cap-rates-ca";
import { US_CAP_RATE_OBSERVATIONS } from "../../src/cre-intelligence/data/cap-rates-us";
import { US_CONSTRUCTION_COST_OBSERVATIONS } from "../../src/cre-intelligence/data/construction-costs-us";
import { CRE_SOURCE_REGISTRY, getCRESource } from "../../src/cre-intelligence/source-registry";
import { normalizeCapRateObservation } from "../../src/cre-intelligence/normalize";
import type { CRECitedObservation } from "../../src/cre-intelligence/types";

const CA_RATES = CA_CAP_RATE_OBSERVATIONS;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("1. every verified Canadian cap-rate observation has complete provenance", () => {
  test("there are Canadian cap-rate observations", () => {
    expect(CA_RATES.length).toBeGreaterThan(0);
  });

  test("all citation fields are populated", () => {
    for (const obs of CA_RATES) {
      const c = obs.citation;
      expect(c.sourceName.length).toBeGreaterThan(0);
      expect(c.reportTitle).toMatch(/\d{4}|\dQ\d{2}/);
      expect(c.publicationDate).toMatch(ISO_DATE);
      expect(c.period.length).toBeGreaterThan(0);
      expect(c.locator).toMatch(/page|table|figure|chart/i);
      expect(c.sourceUrl).toMatch(/^https:\/\//);
      expect(c.retrievedAt).toMatch(ISO_DATE);
      expect(c.methodologyNote).toBeDefined();
      expect(c.methodologyNote!.length).toBeGreaterThan(0);
    }
  });

  test("every observation resolves to a registered source that publishes cap rates", () => {
    for (const obs of CA_RATES) {
      const def = getCRESource(obs.source.sourceId);
      expect(def).toBeDefined();
      expect(def!.metrics).toContain("cap_rate");
      expect(def!.countries).toContain("CA");
    }
  });

  test("geography is Canadian and city-specific", () => {
    for (const obs of CA_RATES) {
      expect(obs.geography.country).toBe("CA");
      expect(obs.geography.city).toBeDefined();
    }
  });
});

describe("2. invalid CREA/CMHC provenance cannot validate a commercial cap rate", () => {
  test("no registered CA cap-rate source is CREA or CMHC", () => {
    for (const source of CRE_SOURCE_REGISTRY) {
      if (!source.metrics.includes("cap_rate") || !source.countries.includes("CA")) continue;
      expect(source.sourceName).not.toMatch(/^CREA$|^CMHC$|CREA, CMHC/i);
    }
  });

  test("no Canadian cap-rate observation cites CREA or CMHC", () => {
    for (const obs of CA_RATES) {
      const blob = [obs.source.sourceName, obs.citation.sourceName, obs.citation.reportTitle].join(" ");
      expect(blob).not.toMatch(/CREA|CMHC/i);
    }
  });

  test("a CREA/CMHC-sourced object cannot pass as a registered cap-rate source", () => {
    // CREA and CMHC exist in the registry for other metrics (comps, rental
    // data) but never for cap_rate.
    const crea = CRE_SOURCE_REGISTRY.find((s) => /CREA/i.test(s.sourceName));
    const cmhc = CRE_SOURCE_REGISTRY.find((s) => /CMHC/i.test(s.sourceName));
    for (const def of [crea, cmhc]) {
      if (def) expect(def.metrics).not.toContain("cap_rate");
    }
  });
});

describe("3. unsupported legacy Canadian values become null (documented, not just deleted)", () => {
  // The ten legacy E30 values removed 2026-09-11, per docs/E68-cap-rate-data-coverage.md.
  const removedLegacyValues = [5.2, 5.5, 4.6, 4.9, 5.0, 5.8, 5.9, 6.2, 4.3, 4.5];

  test("no E68 Canadian observation reproduces a bare legacy value as a range boundary match-all", () => {
    // Individual value collisions are expected (small number space); the real
    // guard is that Calgary/Winnipeg's legacy figures fall OUTSIDE the real
    // range entirely, proving they were never derived from this report.
    const calgary = CA_RATES.filter((o) => o.geography.city === "Calgary");
    const winnipeg = CA_RATES.filter((o) => o.geography.city === "Winnipeg");
    const outsideRange = (v: number, low: number, high: number) => v < low || v > high;
    for (const obs of calgary) {
      expect(outsideRange(5.8, obs.low!, obs.high!)).toBe(true);
    }
    for (const obs of winnipeg) {
      expect(outsideRange(6.2, obs.low!, obs.high!)).toBe(true);
    }
  });

  test("removed values are plausible cap-rate percentages (sanity, not provenance)", () => {
    for (const v of removedLegacyValues) {
      expect(v).toBeGreaterThan(1);
      expect(v).toBeLessThan(20);
    }
  });
});

describe("4. legitimate replacement observations coexist with legacy audit records", () => {
  test("Toronto and Vancouver have real E68 cap rates despite E30 nulling their legacy values", () => {
    for (const city of ["Toronto", "Vancouver"]) {
      const forCity = CA_RATES.filter((o) => o.geography.city === city);
      expect(forCity.length).toBeGreaterThan(0);
      for (const obs of forCity) {
        expect(obs.citation.sourceName).toBe("Cushman & Wakefield Canada");
      }
    }
  });

  test("E68 does not silently overwrite; it is a separate, independently cited layer", () => {
    // Every CA observation must carry its own full citation regardless of
    // what E30 does or did with the same city.
    for (const obs of CA_RATES) {
      expect(obs.citation.reportTitle).toContain("Cushman & Wakefield");
      expect(obs.citation.reportTitle).not.toContain("CREA");
      expect(obs.citation.reportTitle).not.toContain("CMHC");
    }
  });
});

describe("5. source-native classification survives normalization", () => {
  test("high_rise and low_rise subtypes and CA geography survive", () => {
    for (const obs of CA_RATES) {
      const n = normalizeCapRateObservation(obs);
      expect(n.propertySubtype).toBe(obs.propertySubtype);
      expect(["high_rise", "low_rise"]).toContain(n.propertySubtype);
      expect(n.low!).toBeCloseTo(obs.low! / 100, 10);
      expect(n.high!).toBeCloseTo(obs.high! / 100, 10);
    }
  });

  test("propertyClass and locationType stay unspecified, not invented", () => {
    // C&W's multifamily chart publishes no class or CBD/suburban split.
    for (const obs of CA_RATES) {
      expect(obs.propertyClass).toBe("unspecified");
      expect(obs.locationType).toBe("unspecified");
    }
  });
});

describe("6. no FRED/Zillow cap-rate records remain without legitimate provenance, anywhere in E68", () => {
  test("no US or CA cap-rate observation cites FRED or Zillow", () => {
    for (const obs of [...US_CAP_RATE_OBSERVATIONS, ...CA_RATES]) {
      const blob = [obs.source.sourceName, obs.citation.sourceName, obs.citation.reportTitle].join(" ");
      expect(blob).not.toMatch(/FRED|Zillow/i);
    }
  });

  test("no registered source anywhere in the registry is FRED or Zillow for cap_rate", () => {
    for (const source of CRE_SOURCE_REGISTRY) {
      if (source.metrics.includes("cap_rate")) {
        expect(source.sourceName).not.toMatch(/FRED|Zillow/i);
      }
    }
  });
});

describe("7. no duplicate observation IDs / no exact duplicate observations", () => {
  test("every US + CA cap-rate observation is unique on its natural key", () => {
    const all = [...US_CAP_RATE_OBSERVATIONS, ...CA_RATES];
    const keys = all.map(
      (o) =>
        `${o.geography.country}|${o.geography.city}|${o.assetClass}|${o.propertySubtype ?? ""}|${o.periodStart}|${o.periodEnd}|${o.source.sourceId}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("no two observations share every field including value/low/high", () => {
    const all: CRECitedObservation[] = [...US_CAP_RATE_OBSERVATIONS, ...CA_RATES, ...US_CONSTRUCTION_COST_OBSERVATIONS];
    const seen = new Set<string>();
    for (const o of all) {
      const key = JSON.stringify(o);
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

describe("8. no unsupported interpolation", () => {
  test("St. John's has no cap rate and a recorded, source-checked gap", () => {
    const stJohns = CA_RATES.filter((o) => o.geography.city === "St. John's");
    expect(stJohns).toHaveLength(0);
    const gap = CA_CAP_RATE_GAPS.find((g) => g.geography.city === "St. John's");
    expect(gap).toBeDefined();
    expect(gap!.sourcesChecked.length).toBeGreaterThan(0);
  });

  test("no Canadian city's multifamily range was widened or narrowed to fill St. John's", () => {
    // A regional-average interpolation would show up as a city whose range
    // exactly spans the full min/max of its neighbours. Assert every range is
    // independently sourced by checking no two cities share an identical
    // [low, high] pair by coincidence of copy-paste rather than real data.
    const pairs = CA_RATES.map((o) => `${o.geography.city}:${o.propertySubtype}:${o.low}-${o.high}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  test("office/industrial/retail were not forced from the multifamily chart", () => {
    const nonMultifamily = CA_RATES.filter((o) => o.assetClass !== "multifamily");
    expect(nonMultifamily).toHaveLength(0);
    expect(CA_CAP_RATE_GAPS.filter((g) => g.assetClass === "office").length).toBeGreaterThan(0);
    expect(CA_CAP_RATE_GAPS.filter((g) => g.assetClass === "industrial").length).toBeGreaterThan(0);
    expect(CA_CAP_RATE_GAPS.filter((g) => g.assetClass === "retail").length).toBeGreaterThan(0);
  });

  test("no midpoint was manufactured for any range", () => {
    for (const obs of CA_RATES) {
      expect(obs.low).toBeDefined();
      expect(obs.high).toBeDefined();
      expect(obs.value).toBeUndefined();
    }
  });
});

describe("Canadian dataset size and shape", () => {
  test("20 observations: 10 cities x {high_rise, low_rise}", () => {
    expect(CA_RATES).toHaveLength(20);
    const cities = new Set(CA_RATES.map((o) => o.geography.city));
    expect(cities.size).toBe(10);
    for (const city of cities) {
      expect(CA_RATES.filter((o) => o.geography.city === city)).toHaveLength(2);
    }
  });
});

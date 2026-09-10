/**
 * InvestScape™ E68 Phase 4 — data integrity guarantees.
 *
 * These tests encode the rules that make E68 trustworthy. Each `describe` block
 * maps to a lettered requirement in the Phase 4 specification. They are written
 * to fail loudly if a future contributor backfills an estimate, launders a
 * proprietary figure, or lets an "approximate" mapping drift into "exact".
 */
import {
  US_CAP_RATE_OBSERVATIONS,
  US_CAP_RATE_GAPS,
} from "../../src/cre-intelligence/data/cap-rates-us";
import {
  US_CONSTRUCTION_COST_OBSERVATIONS,
  US_HARD_COST_OBSERVATIONS,
  US_CITY_CONSTRUCTION_CHANGE_OBSERVATIONS,
  US_NATIONAL_CONSTRUCTION_INDEX_OBSERVATIONS,
  US_CONSTRUCTION_COST_GAPS,
} from "../../src/cre-intelligence/data/construction-costs-us";
import {
  CRE_SOURCE_REGISTRY,
  getCRESource,
  isRedistributable,
} from "../../src/cre-intelligence/source-registry";
import {
  mapToLegacyCapRateKey,
  mapRlbSubtype,
  isAutoSurfaceable,
  RLB_SUBTYPE_MAPPING,
} from "../../src/cre-intelligence/mapping";
import {
  normalizeConstructionCostObservation,
  normalizeCapRateObservation,
} from "../../src/cre-intelligence/normalize";
import { assertComparableCapRates } from "../../src/cre-intelligence/consensus";
import type { CREObservation } from "../../src/cre-intelligence/types";
import { rangeMidpoint } from "../../src/cre-intelligence/types";

const ALL_OBSERVATIONS = [...US_CAP_RATE_OBSERVATIONS, ...US_CONSTRUCTION_COST_OBSERVATIONS];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("A. every observation has citation metadata", () => {
  test("no observation ships without a complete, specific citation", () => {
    expect(ALL_OBSERVATIONS.length).toBeGreaterThan(0);

    for (const obs of ALL_OBSERVATIONS) {
      const c = obs.citation;
      expect(c).toBeDefined();
      expect(c.sourceName.length).toBeGreaterThan(0);
      expect(c.reportTitle.length).toBeGreaterThan(0);
      expect(c.sourceUrl).toMatch(/^https:\/\//);
      expect(c.publicationDate).toMatch(ISO_DATE);
      expect(c.retrievedAt).toMatch(ISO_DATE);
      expect(c.period.length).toBeGreaterThan(0);
      expect(c.locator.length).toBeGreaterThan(0);
    }
  });

  test("a bare publisher name is not an acceptable citation", () => {
    // "CBRE" or "CBRE Cap Rate Survey" must never pass as a report title: a
    // title has to identify a specific edition so a reader can re-find it.
    for (const obs of ALL_OBSERVATIONS) {
      const title = obs.citation.reportTitle;
      expect(title).not.toBe(obs.citation.sourceName);
      expect(title.length).toBeGreaterThan(obs.citation.sourceName.length);
      expect(title).toMatch(/\d{4}/); // names a year/edition
    }
  });

  test("the locator points inside the document, not at the publisher", () => {
    for (const obs of ALL_OBSERVATIONS) {
      expect(obs.citation.locator).toMatch(/table|figure|chart|page|section/i);
    }
  });
});

describe("B. every observation has a registered sourceId", () => {
  test("sourceId resolves against CRE_SOURCE_REGISTRY", () => {
    for (const obs of ALL_OBSERVATIONS) {
      expect(obs.source.sourceId.length).toBeGreaterThan(0);
      expect(getCRESource(obs.source.sourceId)).toBeDefined();
    }
  });

  test("the registered source actually publishes the metric claimed", () => {
    for (const obs of ALL_OBSERVATIONS) {
      const definition = getCRESource(obs.source.sourceId)!;
      const declares =
        definition.metrics.includes(obs.metric) ||
        // construction_cost_change is derived from the same index series
        (obs.metric === "construction_cost_change" && definition.metrics.includes("construction_index"));
      expect(declares).toBe(true);
    }
  });
});

describe("C. every observation has publication and period information", () => {
  test("period bounds are ISO dates in the right order", () => {
    for (const obs of ALL_OBSERVATIONS) {
      expect(obs.periodStart).toMatch(ISO_DATE);
      expect(obs.periodEnd).toMatch(ISO_DATE);
      expect(new Date(obs.periodStart).getTime()).toBeLessThanOrEqual(new Date(obs.periodEnd).getTime());
    }
  });

  test("nothing was retrieved before it was published", () => {
    for (const obs of ALL_OBSERVATIONS) {
      const published = new Date(obs.citation.publicationDate).getTime();
      const retrieved = new Date(obs.citation.retrievedAt).getTime();
      expect(retrieved).toBeGreaterThanOrEqual(published);
    }
  });
});

describe("D. proprietary sources cannot be marked redistributable accidentally", () => {
  test("only public-data government sources are redistributable", () => {
    for (const source of CRE_SOURCE_REGISTRY) {
      if (!isRedistributable(source)) continue;
      expect(source.sourceType).toBe("government");
      expect(source.access).toBe("public_data");
      expect(source.redistribution).toBe("public_data_terms");
    }
  });

  test("paid and license-required sources are never redistributable", () => {
    const locked = CRE_SOURCE_REGISTRY.filter(
      (s) => s.access === "paid" || s.redistribution === "license_required",
    );
    expect(locked.length).toBeGreaterThan(0);
    for (const source of locked) {
      expect(isRedistributable(source)).toBe(false);
    }
  });

  test("a freely downloadable report is still not redistributable", () => {
    // The trap this catches: "public_report" reads like "public domain".
    const rlb = getCRESource("rlb-north-america")!;
    expect(rlb.access).toBe("public_report");
    expect(isRedistributable(rlb)).toBe(false);
  });

  test("brokerage and construction-cost sources are never redistributable", () => {
    for (const source of CRE_SOURCE_REGISTRY) {
      if (source.sourceType === "brokerage" || source.sourceType === "construction_cost") {
        expect(isRedistributable(source)).toBe(false);
      }
    }
  });
});

describe("E. unsupported city/category combinations remain absent", () => {
  test("Houston has no construction-cost observation and a recorded gap", () => {
    const houston = US_CONSTRUCTION_COST_OBSERVATIONS.filter((o) => o.geography.city === "Houston");
    expect(houston).toHaveLength(0);

    const gap = US_CONSTRUCTION_COST_GAPS.find((g) => g.geography.city === "Houston");
    expect(gap).toBeDefined();
    expect(gap!.sourcesChecked.length).toBeGreaterThan(0);
    expect(gap!.reason).toMatch(/does not appear/i);
  });

  test("no multifamily or industrial hard cost was invented", () => {
    const fabricated = US_HARD_COST_OBSERVATIONS.filter(
      (o) => o.assetClass === "multifamily" || o.assetClass === "industrial",
    );
    expect(fabricated).toHaveLength(0);
    expect(US_CONSTRUCTION_COST_GAPS.some((g) => g.assetClass === "multifamily")).toBe(true);
    expect(US_CONSTRUCTION_COST_GAPS.some((g) => g.assetClass === "industrial")).toBe(true);
  });

  test("cap rates are absent for all five priority cities, with reasons", () => {
    expect(US_CAP_RATE_OBSERVATIONS).toHaveLength(0);
    for (const city of ["Austin", "Houston", "Miami", "Seattle", "Phoenix"]) {
      const gaps = US_CAP_RATE_GAPS.filter((g) => g.geography.city === city);
      expect(gaps.length).toBeGreaterThan(0);
      for (const gap of gaps) expect(gap.sourcesChecked.length).toBeGreaterThan(0);
    }
  });

  test("every gap gives a source fact, not a TODO", () => {
    for (const gap of [...US_CAP_RATE_GAPS, ...US_CONSTRUCTION_COST_GAPS]) {
      expect(gap.reason.length).toBeGreaterThan(40);
      expect(gap.reason).not.toMatch(/TODO|FIXME|later|coming soon/i);
      expect(gap.checkedAt).toMatch(ISO_DATE);
    }
  });
});

describe("F. source-native ranges are preserved", () => {
  test("published ranges keep low and high and invent no midpoint", () => {
    expect(US_HARD_COST_OBSERVATIONS.length).toBeGreaterThan(0);
    for (const obs of US_HARD_COST_OBSERVATIONS) {
      expect(obs.low).toBeDefined();
      expect(obs.high).toBeDefined();
      expect(obs.low!).toBeLessThan(obs.high!);
      // The critical assertion: RLB prints a range, so `value` stays empty.
      expect(obs.value).toBeUndefined();
    }
  });

  test("a midpoint is available only as an explicit derived call", () => {
    const obs = US_HARD_COST_OBSERVATIONS[0];
    expect(rangeMidpoint(obs)).toBeCloseTo((obs.low! + obs.high!) / 2, 10);
    expect(obs.value).toBeUndefined(); // deriving it did not write it back
  });

  test("ranges survive normalization intact", () => {
    for (const obs of US_HARD_COST_OBSERVATIONS) {
      const normalized = normalizeConstructionCostObservation(obs);
      expect(normalized.low).toBe(obs.low);
      expect(normalized.high).toBe(obs.high);
      expect(normalized.value).toBeUndefined();
      expect(normalized.unit).toBe("USD_per_sf");
    }
  });
});

describe("G. class and location dimensions survive normalization", () => {
  const capRate: CREObservation = {
    metric: "cap_rate",
    assetClass: "office",
    propertySubtype: "office_tower",
    propertyClass: "A",
    locationType: "cbd",
    capRateType: "stabilized",
    geography: { country: "US", city: "Austin" },
    periodStart: "2026-01-01",
    periodEnd: "2026-06-30",
    low: 6.0,
    high: 7.0,
    unit: "percent",
    source: { sourceId: "cbre-us-cap-rates", sourceName: "CBRE", sourceType: "brokerage" },
    sourceQuality: 95,
  };

  test("Class A / CBD / stabilized are not lost when units are converted", () => {
    const normalized = normalizeCapRateObservation(capRate);
    expect(normalized.propertyClass).toBe("A");
    expect(normalized.locationType).toBe("cbd");
    expect(normalized.capRateType).toBe("stabilized");
    expect(normalized.propertySubtype).toBe("office_tower");
    expect(normalized.low).toBeCloseTo(0.06, 10);
    expect(normalized.high).toBeCloseTo(0.07, 10);
  });

  test("dimensions are first-class fields, never buried in tags", () => {
    for (const obs of US_CONSTRUCTION_COST_OBSERVATIONS) {
      const tagKeys = Object.keys(obs.tags ?? {}).map((k) => k.toLowerCase());
      for (const banned of ["class", "propertyclass", "location", "locationtype", "subtype"]) {
        expect(tagKeys).not.toContain(banned);
      }
    }
  });

  test("RLB cost tiers are not laundered into investment classes", () => {
    // "Prime" is a cost tier. If someone maps it to Class A, this fails.
    for (const obs of US_HARD_COST_OBSERVATIONS) {
      expect(obs.propertyClass).toBe("unspecified");
    }
    expect(RLB_SUBTYPE_MAPPING.office_prime.rationale).toMatch(/not\s+CBRE Class A/i);
  });

  test("office with no stated location type gets no legacy key", () => {
    expect(mapToLegacyCapRateKey({ assetClass: "office" }).confidence).toBe("unsupported");
    expect(mapToLegacyCapRateKey({ assetClass: "office" }).key).toBeUndefined();
    expect(mapToLegacyCapRateKey({ assetClass: "office", locationType: "cbd" }).key).toBe("office_downtown");
    expect(mapToLegacyCapRateKey({ assetClass: "office", locationType: "suburban" }).key).toBe("office_suburban");
  });

  test("retail carries no class, matching the legacy layer", () => {
    const retail = mapToLegacyCapRateKey({ assetClass: "retail", propertyClass: "A" });
    expect(retail.key).toBe("retail_neighbourhood");
    expect(retail.propertyClass).toBeUndefined();
  });
});

describe("H. construction subtype mappings cannot silently become exact", () => {
  test("only exact and close auto-surface", () => {
    for (const [subtype, result] of Object.entries(RLB_SUBTYPE_MAPPING)) {
      const auto = isAutoSurfaceable(result.confidence);
      expect(auto).toBe(result.confidence === "exact" || result.confidence === "close");
      if (!auto) {
        expect(["approximate", "unsupported"]).toContain(result.confidence);
        // An unsupported mapping must not name a target subtype at all.
        if (result.confidence === "unsupported") expect(result.legacySubtype).toBeUndefined();
      }
      expect(subtype.length).toBeGreaterThan(0);
    }
  });

  test("the RLB multifamily -> condo 5-12 storey equivalence is refused", () => {
    const mapped = mapRlbSubtype("multifamily_mid_rise");
    expect(mapped.confidence).toBe("unsupported");
    expect(mapped.legacySubtype).toBeUndefined();
    expect(isAutoSurfaceable(mapped.confidence)).toBe(false);
  });

  test("unknown subtypes are unsupported, never approximate", () => {
    const mapped = mapRlbSubtype("totally_made_up_subtype");
    expect(mapped.confidence).toBe("unsupported");
    expect(mapped.legacySubtype).toBeUndefined();
  });

  test("every non-exact mapping explains itself", () => {
    for (const result of Object.values(RLB_SUBTYPE_MAPPING)) {
      if (result.confidence === "exact") continue;
      expect(result.rationale.length).toBeGreaterThan(40);
    }
  });

  test("3-star hotel stays approximate and does not auto-surface", () => {
    const mapped = mapRlbSubtype("hotel_3_star");
    expect(mapped.confidence).toBe("approximate");
    expect(isAutoSurfaceable(mapped.confidence)).toBe(false);
  });
});

describe("I. legacy E30 cap-rate values cannot pass as validated E68 data", () => {
  // The economic-engine E30 records for Miami (5.2/5.9/6.7) and Seattle
  // (4.3/4.9/5.6) were tagged "FRED, Zillow" — neither publishes a commercial
  // cap rate. These tests make it impossible to re-launder them through E68.
  const suspect = [
    { city: "Miami", p25: 5.2, p50: 5.9, p75: 6.7 },
    { city: "Seattle", p25: 4.3, p50: 4.9, p75: 5.6 },
  ];

  test("no E68 observation reproduces the legacy figures", () => {
    for (const { city, p25, p50, p75 } of suspect) {
      const forCity = US_CAP_RATE_OBSERVATIONS.filter((o) => o.geography.city === city);
      expect(forCity).toHaveLength(0);
      for (const value of [p25, p50, p75]) {
        expect(US_CAP_RATE_OBSERVATIONS.some((o) => o.value === value)).toBe(false);
      }
    }
  });

  test("FRED and Zillow are not registered as US cap-rate sources", () => {
    const capRateSources = CRE_SOURCE_REGISTRY.filter(
      (s) => s.metrics.includes("cap_rate") && s.countries.includes("US"),
    );
    for (const source of capRateSources) {
      expect(source.sourceName).not.toMatch(/FRED|Zillow|Federal Reserve Economic Data/i);
    }
  });

  test("a government/residential source cannot back a cap-rate observation", () => {
    const laundered: CREObservation = {
      metric: "cap_rate",
      assetClass: "multifamily",
      capRateType: "stabilized",
      geography: { country: "US", city: "Miami" },
      periodStart: "2026-01-01",
      periodEnd: "2026-06-30",
      value: 5.9,
      unit: "percent",
      source: { sourceId: "us-census-construction-spending", sourceName: "FRED, Zillow", sourceType: "government" },
      sourceQuality: 90,
    };
    const definition = getCRESource(laundered.source.sourceId)!;
    expect(definition.metrics).not.toContain("cap_rate");
  });
});

describe("cap-rate concepts are never blended", () => {
  const base = {
    metric: "cap_rate" as const,
    assetClass: "office" as const,
    geography: { country: "US" as const, city: "Austin" },
    periodStart: "2026-01-01",
    periodEnd: "2026-06-30",
    value: 6,
    unit: "percent",
    source: { sourceId: "cbre-us-cap-rates", sourceName: "CBRE", sourceType: "brokerage" as const },
    sourceQuality: 95,
  };

  test("stabilized and value-add cannot be averaged together", () => {
    expect(() =>
      assertComparableCapRates([
        { ...base, capRateType: "stabilized" },
        { ...base, capRateType: "value_add" },
      ]),
    ).toThrow(/Cannot mix cap-rate types/);
  });

  test("an undeclared cap-rate concept is rejected", () => {
    expect(() => assertComparableCapRates([base])).toThrow(/must declare capRateType/);
  });

  test("a consistent concept passes", () => {
    expect(() =>
      assertComparableCapRates([
        { ...base, capRateType: "stabilized" },
        { ...base, capRateType: "stabilized" },
      ]),
    ).not.toThrow();
  });
});

describe("construction cost concepts are never conflated", () => {
  test("an inflation percentage is not a $/SF benchmark", () => {
    for (const obs of US_CITY_CONSTRUCTION_CHANGE_OBSERVATIONS) {
      expect(obs.metric).toBe("construction_cost_change");
      expect(obs.unit).toBe("percent");
      expect(obs.basis).toBeUndefined();
      expect(obs.unit).not.toMatch(/per_sf/);
    }
  });

  test("hard cost is $/SF and index is index points", () => {
    for (const obs of US_HARD_COST_OBSERVATIONS) {
      expect(obs.metric).toBe("hard_cost");
      expect(obs.unit).toBe("USD_per_sf");
      expect(obs.basis).toBe("per_sf");
    }
    for (const obs of US_NATIONAL_CONSTRUCTION_INDEX_OBSERVATIONS) {
      expect(obs.metric).toBe("construction_index");
      expect(obs.unit).toBe("index");
      expect(obs.value).toBeGreaterThan(0);
    }
  });

  test("published annual change reconciles with the published index levels", () => {
    // Guards the column-misalignment trap documented in construction-costs-us.ts:
    // a naive PDF read yields Miami 4.15% / Phoenix 4.46% / Seattle 4.09%.
    const levels: Record<string, [number, number]> = {
      Austin: [19_560, 20_453],
      Miami: [20_121, 21_126],
      Seattle: [26_703, 27_943],
      Phoenix: [20_942, 22_052],
    };
    for (const obs of US_CITY_CONSTRUCTION_CHANGE_OBSERVATIONS) {
      const [from, to] = levels[obs.geography.city!];
      const derived = (to / from - 1) * 100;
      expect(obs.value!).toBeCloseTo(derived, 1);
    }
  });

  test("the national index series is strictly increasing and complete", () => {
    const series = US_NATIONAL_CONSTRUCTION_INDEX_OBSERVATIONS;
    expect(series).toHaveLength(13);
    for (let i = 1; i < series.length; i++) {
      expect(series[i].value!).toBeGreaterThan(series[i - 1].value!);
    }
  });
});

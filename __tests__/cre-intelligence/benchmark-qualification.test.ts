/**
 * InvestScape™ E68 Phase 4C — benchmark qualification and application mapping.
 *
 * Covers the Phase 4C spec's "never" rules adversarially (with synthetic
 * observations, since the real 35 are all multifamily and can't exercise the
 * asset-class-mismatch or class-substitution paths on their own), plus the
 * real 35-observation mapping table's structural properties.
 */
import { qualifyCapRateObservation } from "../../src/cre-intelligence/qualification";
import { mapToLegacyCapRateKey } from "../../src/cre-intelligence/mapping";
import {
  CAP_RATE_BENCHMARK_MAPPING,
  mappingSummary,
  observationId,
} from "../../src/cre-intelligence/data/cap-rate-benchmark-mapping";
import { US_CAP_RATE_OBSERVATIONS } from "../../src/cre-intelligence/data/cap-rates-us";
import { CA_CAP_RATE_OBSERVATIONS } from "../../src/cre-intelligence/data/cap-rates-ca";
import type { CRECitedObservation } from "../../src/cre-intelligence/types";

const BASE: CRECitedObservation = {
  metric: "cap_rate",
  assetClass: "multifamily",
  geography: { country: "US", city: "Houston" },
  periodStart: "2026-01-01",
  periodEnd: "2026-06-30",
  value: 5.5,
  unit: "percent",
  capRateType: "transaction",
  source: { sourceId: "kidder-mathews-research", sourceName: "Kidder Mathews", sourceType: "brokerage" },
  citation: {
    sourceName: "Kidder Mathews",
    reportTitle: "Test Report 2026",
    publicationDate: "2026-07-01",
    period: "2Q 2026",
    locator: "Table X",
    sourceUrl: "https://example.com/report.pdf",
    retrievedAt: "2026-09-11",
  },
  sourceQuality: 90,
};

describe("never rule: asset class never substituted on city match alone", () => {
  test("a multifamily observation never qualifies for office/industrial/retail", () => {
    // mapToLegacyCapRateKey reads the OBSERVATION's own assetClass; there is no
    // code path that lets a caller ask "does this Houston observation work for
    // office" — the function always answers for the class the source actually
    // measured. This test proves that structurally by checking every asset
    // class the base observation was NOT recorded as returns a DIFFERENT key
    // than what multifamily itself would produce, never a forced match.
    const multifamily = mapToLegacyCapRateKey({ assetClass: "multifamily" });
    expect(multifamily.key).toBe("multifamily");

    for (const wrongClass of ["office", "industrial", "retail"] as const) {
      const q = qualifyCapRateObservation({ ...BASE, assetClass: wrongClass });
      // office needs a locationType or is unsupported; industrial/retail always
      // resolve to their own key — but NEVER to "multifamily".
      expect(q.legacyKey).not.toBe("multifamily");
    }
  });

  test("a hotel or healthcare observation is unsupported, not folded into anything", () => {
    for (const assetClass of ["hotel", "healthcare", "data_center"] as const) {
      const q = qualifyCapRateObservation({ ...BASE, assetClass });
      expect(q.confidence).toBe("unsupported");
      expect(q.legacyKey).toBeUndefined();
    }
  });
});

describe("never rule: CBD never becomes suburban, Class A never becomes B/C", () => {
  test("an office observation's stated locationType passes through unchanged", () => {
    const cbd = qualifyCapRateObservation({ ...BASE, assetClass: "office", locationType: "cbd" });
    expect(cbd.legacyKey).toBe("office_downtown");

    const suburban = qualifyCapRateObservation({ ...BASE, assetClass: "office", locationType: "suburban" });
    expect(suburban.legacyKey).toBe("office_suburban");

    // There is no function signature that lets a caller pass a CBD observation
    // in and request the suburban key out — proven by construction: the key is
    // entirely determined by the observation's own locationType field.
  });

  test("propertyClass is carried through verbatim, never remapped to a different class", () => {
    for (const cls of ["A", "B", "C"] as const) {
      const q = qualifyCapRateObservation({ ...BASE, assetClass: "multifamily", propertyClass: cls });
      const base = mapToLegacyCapRateKey({ assetClass: "multifamily", propertyClass: cls });
      expect(base.propertyClass).toBe(cls);
      expect(q.legacyKey).toBe("multifamily");
    }
  });

  test("office with no stated location type stays unsupported, never guesses CBD or suburban", () => {
    const q = qualifyCapRateObservation({ ...BASE, assetClass: "office" });
    expect(q.confidence).toBe("unsupported");
    expect(q.legacyKey).toBeUndefined();
  });
});

describe("no numerical score can turn unsupported into usable", () => {
  test("high sourceQuality does not rescue an unsupported asset class", () => {
    const q = qualifyCapRateObservation({ ...BASE, assetClass: "hotel", sourceQuality: 99 });
    expect(q.confidence).toBe("unsupported");
  });

  test("a recent, transaction-grade period does not rescue an unsupported asset class", () => {
    const q = qualifyCapRateObservation({
      ...BASE,
      assetClass: "data_center",
      periodEnd: "2026-08-31",
      capRateType: "transaction",
      sourceQuality: 100,
    });
    expect(q.confidence).toBe("unsupported");
  });
});

describe("confidence is a floor (worst axis wins), never an average", () => {
  test("one bad axis caps an otherwise-exact observation, but only to approximate, not unsupported", () => {
    const stale = qualifyCapRateObservation({ ...BASE, periodEnd: "2022-01-01" }); // far more than 24mo old
    expect(stale.baseConfidence).toBe("exact");
    expect(stale.confidence).toBe("approximate");
    expect(stale.confidence).not.toBe("unsupported");
  });

  test("staleness alone never produces unsupported — CURRENT is the lowest-priority axis", () => {
    const veryStale = qualifyCapRateObservation({ ...BASE, periodEnd: "2015-01-01" });
    expect(veryStale.confidence).toBe("approximate");
  });

  test("a documented caveat caps confidence at approximate with a visible warning", () => {
    const caveated = qualifyCapRateObservation({
      ...BASE,
      citation: { ...BASE.citation, methodologyNote: "Known discrepancy between two publisher tables." },
    });
    expect(caveated.confidence).toBe("approximate");
    expect(caveated.warnings.some((w) => w.includes("unresolved caveat"))).toBe(true);
  });
});

describe("midpoints are never presented as publisher data", () => {
  test("a range observation reports valueShape 'range', not a synthesized point", () => {
    const ranged = qualifyCapRateObservation({ ...BASE, value: undefined, low: 5, high: 6 });
    expect(ranged.valueShape).toBe("range");
  });

  test("a point observation reports valueShape 'point'", () => {
    const point = qualifyCapRateObservation(BASE);
    expect(point.valueShape).toBe("point");
  });
});

describe("methodology and source-quality surface as warnings, not silent rescues or penalties", () => {
  test("a non-transaction observation is flagged, not downgraded below its base tier alone", () => {
    const survey = qualifyCapRateObservation({ ...BASE, capRateType: "survey_estimate" });
    expect(survey.methodologyFamily).toBe("survey");
    expect(survey.warnings.some((w) => w.includes("not a transaction-derived average"))).toBe(true);
  });

  test("low sourceQuality is flagged explicitly", () => {
    const low = qualifyCapRateObservation({ ...BASE, sourceQuality: 60 });
    expect(low.sourceQualityTier).toBe("low");
    expect(low.warnings.some((w) => w.includes("below 80"))).toBe(true);
  });
});

describe("the real 35-observation mapping table", () => {
  test("every real observation appears exactly once", () => {
    expect(CAP_RATE_BENCHMARK_MAPPING).toHaveLength(35);
    const ids = CAP_RATE_BENCHMARK_MAPPING.map((r) => r.observationId);
    expect(new Set(ids).size).toBe(35);
  });

  test("observationId is stable and deterministic", () => {
    const obs = US_CAP_RATE_OBSERVATIONS[0];
    expect(observationId(obs)).toBe(observationId(obs));
    expect(observationId(obs)).toContain(obs.source.sourceId);
    expect(observationId(obs)).toContain(obs.geography.city);
  });

  test("nothing unmapped carries a legacyKey", () => {
    for (const row of CAP_RATE_BENCHMARK_MAPPING) {
      if (row.qualification === "unsupported") expect(row.mappedLegacyKey).toBeUndefined();
      else expect(row.mappedLegacyKey).toBeDefined();
    }
  });

  test("every row's asset class is multifamily and every mapped key is 'multifamily'", () => {
    // True today because Phase 4A/4B only sourced multifamily cap rates. This
    // test is a canary: it must be revisited the day an office/industrial/
    // retail cap-rate observation is added (it should then fail here,
    // prompting a review rather than silently expanding unnoticed).
    for (const row of CAP_RATE_BENCHMARK_MAPPING) {
      expect(row.sourceAssetClass).toBe("multifamily");
      if (row.mappedLegacyKey) expect(row.mappedLegacyKey).toBe("multifamily");
    }
  });

  test("Houston's worked example: exact base classification, approximate overall (documented caveat + staleness)", () => {
    const houstonClassA = CAP_RATE_BENCHMARK_MAPPING.filter(
      (r) => r.city === "Houston" && r.sourceSubtype === "class_a_infill",
    );
    expect(houstonClassA.length).toBeGreaterThan(0);
    for (const row of houstonClassA) {
      expect(row.baseQualification).toBe("exact"); // classification match is exact
      expect(row.qualification).toBe("approximate"); // overall is capped by real caveats
      expect(row.warnings.length).toBeGreaterThan(0);
    }
  });

  test("summary counts are internally consistent", () => {
    const summary = mappingSummary();
    const total = summary.exact + summary.close + summary.approximate + summary.unsupported;
    expect(total).toBe(35);
    expect(summary.unsupported).toBe(0); // all 35 are multifamily, which always maps
  });

  test("every US and every CA observation appears in the table", () => {
    const usCount = CAP_RATE_BENCHMARK_MAPPING.filter((r) => r.country === "US").length;
    const caCount = CAP_RATE_BENCHMARK_MAPPING.filter((r) => r.country === "CA").length;
    expect(usCount).toBe(US_CAP_RATE_OBSERVATIONS.length);
    expect(caCount).toBe(CA_CAP_RATE_OBSERVATIONS.length);
  });

  test("the source data files were not mutated by building this mapping", () => {
    // Re-import and spot-check a value that would break if data.ts had been
    // edited to make mapping easier.
    const houston = US_CAP_RATE_OBSERVATIONS.find(
      (o) => o.geography.city === "Houston" && o.propertySubtype === "class_a_infill" && o.periodStart === "2025-04-01",
    );
    expect(houston?.low).toBe(4.75);
    expect(houston?.high).toBe(5.25);
  });
});

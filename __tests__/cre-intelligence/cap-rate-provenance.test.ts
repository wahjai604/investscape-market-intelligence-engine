/**
 * InvestScape™ E86 Phase 4A — cap-rate provenance guarantees.
 *
 * Phase 4A added the first real cap-rate observations. These tests exist so the
 * things that make them trustworthy — full citation, a licence classification
 * that cannot quietly turn permissive, and a hard wall between publisher
 * estimates, transaction averages and E86's own arithmetic — cannot be eroded
 * by a later edit.
 */
import { US_CAP_RATE_OBSERVATIONS, US_CAP_RATE_GAPS } from "../../src/cre-intelligence/data/cap-rates-us";
import { US_CONSTRUCTION_COST_OBSERVATIONS } from "../../src/cre-intelligence/data/construction-costs-us";
import {
  CRE_SOURCE_REGISTRY,
  getCRESource,
  isRedistributable,
  NON_REDISTRIBUTABLE_LICENSES,
} from "../../src/cre-intelligence/source-registry";
import { assertComparableCapRates } from "../../src/cre-intelligence/consensus";
import { normalizeCapRateObservation } from "../../src/cre-intelligence/normalize";
import { CAP_RATE_FAMILY } from "../../src/cre-intelligence/types";
import type { CRECapRateType, CREObservation } from "../../src/cre-intelligence/types";

const CAP_RATES = US_CAP_RATE_OBSERVATIONS;
const ALL = [...US_CAP_RATE_OBSERVATIONS, ...US_CONSTRUCTION_COST_OBSERVATIONS];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("every cap-rate observation carries full provenance", () => {
  test("there are cap-rate observations to check", () => {
    expect(CAP_RATES.length).toBeGreaterThan(0);
  });

  test("all seven citation fields are populated and specific", () => {
    for (const obs of CAP_RATES) {
      const c = obs.citation;
      expect(c.sourceName.length).toBeGreaterThan(0);
      expect(c.reportTitle).toMatch(/\d{4}|\dQ\d{2}/);
      expect(c.reportTitle).not.toBe(c.sourceName);
      expect(c.publicationDate).toMatch(ISO_DATE);
      expect(c.period.length).toBeGreaterThan(0);
      expect(c.locator).toMatch(/table|figure|chart|page|section|row/i);
      expect(c.sourceUrl).toMatch(/^https:\/\//);
      expect(c.retrievedAt).toMatch(ISO_DATE);
    }
  });

  test("every cap rate names a registered source that publishes cap rates", () => {
    for (const obs of CAP_RATES) {
      const def = getCRESource(obs.source.sourceId);
      expect(def).toBeDefined();
      expect(def!.metrics).toContain("cap_rate");
    }
  });

  test("every cap rate declares its concept", () => {
    for (const obs of CAP_RATES) {
      expect(obs.capRateType).toBeDefined();
      expect(CAP_RATE_FAMILY[obs.capRateType!]).toBeDefined();
    }
  });

  test("period bounds are ordered and no figure predates its own publication", () => {
    for (const obs of CAP_RATES) {
      expect(new Date(obs.periodStart).getTime()).toBeLessThanOrEqual(new Date(obs.periodEnd).getTime());
      expect(new Date(obs.citation.retrievedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(obs.citation.publicationDate).getTime(),
      );
    }
  });

  test("republished figures name the party that actually produced them", () => {
    // Kidder and Matthews both credit CoStar. If that attribution is ever
    // dropped, a proprietary dataset starts looking like free brokerage output.
    const republished = CAP_RATES.filter((o) =>
      ["kidder-mathews-research", "matthews-research"].includes(o.source.sourceId),
    );
    expect(republished.length).toBeGreaterThan(0);
    for (const obs of republished) {
      expect(obs.citation.underlyingDataProvider).toMatch(/CoStar/i);
    }
  });
});

describe("ranges and point estimates stay as published", () => {
  test("low never exceeds high, across every observation in the data layer", () => {
    for (const obs of ALL) {
      if (obs.low !== undefined && obs.high !== undefined) {
        expect(obs.low).toBeLessThanOrEqual(obs.high);
      }
    }
  });

  test("a range observation never also carries a value", () => {
    // This is the fabricated-midpoint guard: if both exist, someone computed one.
    for (const obs of ALL) {
      if (obs.low !== undefined && obs.high !== undefined) {
        expect(obs.value).toBeUndefined();
      }
    }
  });

  test("a point estimate carries value and no range", () => {
    const points = CAP_RATES.filter((o) => o.value !== undefined);
    expect(points.length).toBeGreaterThan(0);
    for (const obs of points) {
      expect(obs.low).toBeUndefined();
      expect(obs.high).toBeUndefined();
    }
  });

  test("Houston's class ranges survived as ranges", () => {
    const houston = CAP_RATES.filter((o) => o.geography.city === "Houston");
    expect(houston.length).toBeGreaterThan(0);
    for (const obs of houston) {
      expect(obs.low).toBeDefined();
      expect(obs.high).toBeDefined();
      expect(obs.value).toBeUndefined();
    }
  });
});

describe("derived transaction cap rates are quarantined", () => {
  test("no derived observation exists without complete arithmetic", () => {
    for (const obs of CAP_RATES) {
      if (obs.capRateType !== "derived_transaction") {
        expect(obs.derivedFrom).toBeUndefined();
        continue;
      }
      const d = obs.derivedFrom;
      expect(d).toBeDefined();
      expect(d!.propertyName.length).toBeGreaterThan(0);
      expect(d!.transactionDate).toMatch(ISO_DATE);
      expect(d!.purchasePrice).toBeGreaterThan(0);
      expect(d!.priceSource.length).toBeGreaterThan(0);
      expect(d!.noi).toBeGreaterThan(0);
      expect(d!.noiSource.length).toBeGreaterThan(0);
      expect(d!.methodology.length).toBeGreaterThan(0);
    }
  });

  test("survey, transaction and derived are three separate families", () => {
    expect(CAP_RATE_FAMILY.survey_estimate).toBe("survey");
    expect(CAP_RATE_FAMILY.stabilized).toBe("survey");
    expect(CAP_RATE_FAMILY.transaction).toBe("transaction");
    expect(CAP_RATE_FAMILY.derived_transaction).toBe("derived");
  });

  test("a derived cap rate cannot be averaged with a survey estimate", () => {
    const base: CREObservation = {
      metric: "cap_rate",
      assetClass: "multifamily",
      geography: { country: "US", city: "Houston" },
      periodStart: "2026-01-01",
      periodEnd: "2026-03-31",
      value: 5.5,
      unit: "percent",
      source: { sourceId: "newmark-research", sourceName: "Newmark", sourceType: "brokerage" },
      sourceQuality: 80,
    };
    expect(() =>
      assertComparableCapRates([
        { ...base, capRateType: "survey_estimate" },
        { ...base, capRateType: "derived_transaction" },
      ]),
    ).toThrow(/Cannot mix cap-rate types/);
  });

  test("Kidder's transaction averages and Newmark's estimates cannot be blended", () => {
    const kidder = CAP_RATES.filter((o) => o.source.sourceId === "kidder-mathews-research");
    const newmark = CAP_RATES.filter((o) => o.source.sourceId === "newmark-research");
    expect(kidder.length).toBeGreaterThan(0);
    expect(newmark.length).toBeGreaterThan(0);
    expect(kidder[0].capRateType).toBe("transaction");
    expect(newmark[0].capRateType).toBe("survey_estimate");
    expect(() => assertComparableCapRates([kidder[0], newmark[0]])).toThrow(/Cannot mix cap-rate types/);
  });
});

describe("licence classification cannot quietly turn permissive", () => {
  test("every registry entry carries an explicit licence class", () => {
    for (const source of CRE_SOURCE_REGISTRY) {
      expect(source.license).toBeDefined();
    }
  });

  test("no non-public licence class is ever redistributable", () => {
    for (const source of CRE_SOURCE_REGISTRY) {
      if (NON_REDISTRIBUTABLE_LICENSES.includes(source.license)) {
        expect(isRedistributable(source)).toBe(false);
      }
    }
  });

  test("the new brokerage sources are public_report, not public", () => {
    // Free to read is not free to republish.
    for (const id of ["newmark-research", "kidder-mathews-research", "matthews-research"]) {
      const def = getCRESource(id)!;
      expect(def.license).toBe("public_report");
      expect(isRedistributable(def)).toBe(false);
    }
  });

  test("CoStar and the other subscription datasets stay locked", () => {
    for (const id of ["costar-market-analytics", "msci-rca", "realpage-multifamily", "altus-canada-cre"]) {
      const def = getCRESource(id)!;
      expect(def.license).toBe("subscription");
      expect(isRedistributable(def)).toBe(false);
    }
  });

  test("observations sourced from a non-redistributable publisher say so", () => {
    for (const obs of CAP_RATES) {
      const def = getCRESource(obs.source.sourceId)!;
      if (!isRedistributable(def)) {
        expect(obs.source.licenseNotes).toBeDefined();
        expect(obs.source.licenseNotes!.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("FRED/Zillow can never become cap-rate provenance", () => {
  test("no registered US cap-rate source is FRED or Zillow", () => {
    for (const source of CRE_SOURCE_REGISTRY) {
      if (!source.metrics.includes("cap_rate")) continue;
      expect(source.sourceName).not.toMatch(/FRED|Zillow|Federal Reserve Economic Data/i);
    }
  });

  test("no cap-rate observation cites FRED or Zillow anywhere in its provenance", () => {
    for (const obs of CAP_RATES) {
      const blob = [
        obs.source.sourceName,
        obs.citation.sourceName,
        obs.citation.reportTitle,
        obs.citation.underlyingDataProvider ?? "",
      ].join(" ");
      expect(blob).not.toMatch(/FRED|Zillow/i);
    }
  });

  test("the twelve discredited legacy figures appear nowhere in E86", () => {
    // Every p25/p50/p75 nulled out of E30 across Phase 4 and Phase 4A.
    const discredited: Array<[string, number[]]> = [
      ["Miami", [5.2, 5.9, 6.7]],
      ["Seattle", [4.3, 4.9, 5.6]],
      ["Denver", [5.2, 5.9, 6.6]],
      ["Boston", [4.2, 4.8, 5.5]],
      ["New York", [3.9, 4.5, 5.2]],
      ["Philadelphia", [5.1, 5.8, 6.5]],
      ["Chicago", [5.8, 6.5, 7.2]],
      ["Minneapolis", [5.5, 6.2, 6.9]],
      ["Atlanta", [5.9, 6.6, 7.4]],
      ["Nashville", [6.1, 6.8, 7.5]],
      ["Los Angeles", [4.1, 4.8, 5.5]],
      ["San Francisco", [3.2, 3.9, 4.6]],
    ];
    // Matching one number proves nothing (Kidder's real Seattle figure is 5.6%,
    // which collides with the discredited p75). The triple is the fingerprint.
    for (const [city, values] of discredited) {
      const present = new Set(
        CAP_RATES.filter((o) => o.geography.city === city).flatMap((o) =>
          [o.value, o.low, o.high].filter((v): v is number => v !== undefined),
        ),
      );
      expect(values.every((v) => present.has(v))).toBe(false);
    }
  });
});

describe("source-native classification is preserved", () => {
  test("Houston keeps Newmark's class and infill/suburban split", () => {
    const houston = CAP_RATES.filter((o) => o.geography.city === "Houston");
    const subtypes = new Set(houston.map((o) => o.propertySubtype));
    expect(subtypes).toContain("class_a_infill");
    expect(subtypes).toContain("class_a_suburban");
    expect(subtypes).toContain("class_b");
    expect(subtypes).toContain("class_c");

    const infill = houston.find((o) => o.propertySubtype === "class_a_infill")!;
    expect(infill.propertyClass).toBe("A");
    expect(infill.locationType).toBe("urban");

    const suburban = houston.find((o) => o.propertySubtype === "class_a_suburban")!;
    expect(suburban.propertyClass).toBe("A");
    expect(suburban.locationType).toBe("suburban");
  });

  test("cities that publish no class split are not given one", () => {
    for (const city of ["Phoenix", "Seattle", "Austin"]) {
      const forCity = CAP_RATES.filter((o) => o.geography.city === city);
      expect(forCity.length).toBeGreaterThan(0);
      for (const obs of forCity) {
        expect(obs.propertyClass).toBe("unspecified");
        expect(obs.locationType).toBe("unspecified");
      }
    }
    // And the absence is recorded rather than left to be discovered.
    expect(US_CAP_RATE_GAPS.some((g) => g.propertySubtype === "class_split")).toBe(true);
  });

  test("class and location survive unit normalization", () => {
    const houston = CAP_RATES.filter((o) => o.geography.city === "Houston");
    for (const obs of houston) {
      const n = normalizeCapRateObservation(obs);
      expect(n.propertyClass).toBe(obs.propertyClass);
      expect(n.locationType).toBe(obs.locationType);
      expect(n.capRateType).toBe(obs.capRateType);
      expect(n.propertySubtype).toBe(obs.propertySubtype);
      expect(n.low!).toBeCloseTo(obs.low! / 100, 10);
    }
  });

  test("the Newmark chart's internal date contradiction is recorded, not hidden", () => {
    const houston = CAP_RATES.filter((o) => o.geography.city === "Houston");
    for (const obs of houston) {
      expect(obs.citation.methodologyNote).toMatch(/December 2024/);
    }
  });

  test("no cap-rate dimension is smuggled into tags", () => {
    for (const obs of CAP_RATES) {
      const keys = Object.keys(obs.tags ?? {}).map((k) => k.toLowerCase());
      for (const banned of ["class", "propertyclass", "location", "locationtype", "caprate", "type"]) {
        expect(keys).not.toContain(banned);
      }
    }
  });
});

describe("cap-rate values are plausible percentages", () => {
  test("every figure is a percent between 1 and 20", () => {
    for (const obs of CAP_RATES) {
      expect(obs.unit).toBe("percent");
      for (const v of [obs.value, obs.low, obs.high]) {
        if (v === undefined) continue;
        expect(v).toBeGreaterThan(1);
        expect(v).toBeLessThan(20);
      }
    }
  });

  test("normalization converts percent to decimal without loss", () => {
    for (const obs of CAP_RATES) {
      const n = normalizeCapRateObservation(obs);
      if (obs.value !== undefined) expect(n.value!).toBeCloseTo(obs.value / 100, 10);
      if (obs.high !== undefined) expect(n.high!).toBeCloseTo(obs.high / 100, 10);
    }
  });
});

describe("every cap-rate type in the union is accounted for", () => {
  test("CAP_RATE_FAMILY covers the whole union", () => {
    const all: CRECapRateType[] = [
      "stabilized",
      "value_add",
      "going_in",
      "exit",
      "transaction",
      "net_lease",
      "survey_estimate",
      "derived_transaction",
    ];
    for (const t of all) expect(CAP_RATE_FAMILY[t]).toBeDefined();
  });
});

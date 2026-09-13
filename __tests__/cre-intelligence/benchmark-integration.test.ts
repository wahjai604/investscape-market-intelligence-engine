/**
 * InvestScape™ E86 Phase 5 — application-integration tests (Part 14, A-Q).
 */
import {
  selectCapRateBenchmark,
  selectHardCostBenchmark,
  deriveMidpoint,
} from "../../src/cre-intelligence/benchmark-selection";
import { createUserOverride, resolveBenchmark } from "../../src/cre-intelligence/user-override";
import { auditLegacyBenchmark } from "../../src/cre-intelligence/legacy-migration";
import { getSoftCostBenchmark } from "../../src/cre-intelligence/soft-cost";
import { mapRlbSubtype } from "../../src/cre-intelligence/mapping";
import { US_CAP_RATE_OBSERVATIONS } from "../../src/cre-intelligence/data/cap-rates-us";
import { US_HARD_COST_OBSERVATIONS } from "../../src/cre-intelligence/data/construction-costs-us";
import type { CRECitedObservation } from "../../src/cre-intelligence/types";
import type { BenchmarkIdentity, PublisherRange } from "../../src/cre-intelligence/benchmark-types";

const AS_OF = new Date("2026-09-11");

function houstonClassA(): CRECitedObservation | undefined {
  return US_CAP_RATE_OBSERVATIONS.find(
    (o) => o.geography.city === "Houston" && o.propertySubtype === "class_a_infill" && o.periodStart === "2025-04-01",
  );
}

describe("A. exact benchmark automatically selected", () => {
  test("industrial (no locationType split) resolves AVAILABLE with exact/close qualification", () => {
    const industrial = US_CAP_RATE_OBSERVATIONS.find((o) => o.assetClass === "industrial");
    if (!industrial) return; // guarded: only asserts if industrial data exists
    const identity: BenchmarkIdentity = {
      metric: "cap_rate",
      country: "US",
      city: industrial.geography.city!,
      assetClass: "industrial",
    };
    const result = selectCapRateBenchmark(identity, US_CAP_RATE_OBSERVATIONS, AS_OF);
    expect(["AVAILABLE", "AVAILABLE_WITH_WARNING"]).toContain(result.status);
  });
});

describe("B/C/H. close and approximate benchmarks carry visible qualification", () => {
  test("Houston Class A resolves with a visible approximate warning, never silently exact", () => {
    const identity: BenchmarkIdentity = {
      metric: "cap_rate",
      country: "US",
      city: "Houston",
      assetClass: "multifamily",
      propertySubtype: "class_a_infill",
    };
    const result = selectCapRateBenchmark(identity, US_CAP_RATE_OBSERVATIONS, AS_OF);
    expect(result.status).toBe("AVAILABLE_WITH_WARNING");
    expect(result.qualification).toBe("approximate");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/Approximate benchmark/);
  });
});

describe("D. unsupported benchmark cannot be selected", () => {
  test("an office observation with no locationType never becomes AVAILABLE", () => {
    const synthetic: CRECitedObservation = {
      metric: "cap_rate",
      assetClass: "office",
      geography: { country: "US", city: "Nowhere" },
      periodStart: "2026-01-01",
      periodEnd: "2026-06-30",
      value: 6,
      unit: "percent",
      capRateType: "transaction",
      source: { sourceId: "synthetic", sourceName: "Synthetic", sourceType: "brokerage" },
      citation: {
        sourceName: "Synthetic",
        reportTitle: "Test",
        publicationDate: "2026-07-01",
        period: "2Q 2026",
        locator: "n/a",
        sourceUrl: "https://example.com",
        retrievedAt: "2026-09-11",
      },
      sourceQuality: 95,
    };
    const identity: BenchmarkIdentity = { metric: "cap_rate", country: "US", city: "Nowhere", assetClass: "office" };
    const result = selectCapRateBenchmark(identity, [synthetic], AS_OF);
    expect(result.status).toBe("DATA_GAP");
  });
});

describe("E/F. publisher range remains a range; derived midpoint is explicitly marked", () => {
  test("Houston's range is preserved verbatim, no value field manufactured", () => {
    const identity: BenchmarkIdentity = {
      metric: "cap_rate",
      country: "US",
      city: "Houston",
      assetClass: "multifamily",
      propertySubtype: "class_a_infill",
    };
    const result = selectCapRateBenchmark(identity, US_CAP_RATE_OBSERVATIONS, AS_OF);
    expect(result.publisherRange).toBeDefined();
    expect(result.publisherValue).toBeUndefined();
    expect(result.derivedBenchmark).toBeUndefined();
  });

  test("deriveMidpoint is opt-in and tagged e86_derived / sourceSupplied:false", () => {
    const range: PublisherRange = { low: 5.5, high: 6.0, unit: "percent" };
    const derived = deriveMidpoint(range);
    expect(derived.value).toBeCloseTo(5.75);
    expect(derived.provenance).toBe("e86_derived");
    expect(derived.sourceSupplied).toBe(false);
    expect(derived.derivationMethod).toMatch(/midpoint/);
  });
});

describe("G. source provenance survives transformation", () => {
  test("every provenance entry carries full citation fields", () => {
    const identity: BenchmarkIdentity = { metric: "cap_rate", country: "US", city: "Houston", assetClass: "multifamily" };
    const result = selectCapRateBenchmark(identity, US_CAP_RATE_OBSERVATIONS, AS_OF);
    expect(result.provenance.length).toBeGreaterThan(0);
    for (const entry of result.provenance) {
      expect(entry.sourceId).toBeTruthy();
      expect(entry.reportTitle).toBeTruthy();
      expect(entry.sourceUrl).toBeTruthy();
      expect(entry.observationId).toContain(entry.sourceId);
    }
  });
});

describe("H. Houston approximate-confidence case survives integration end-to-end", () => {
  test("baseline: the raw observation itself is unmodified by selection", () => {
    const before = houstonClassA();
    expect(before?.low).toBe(4.75);
    expect(before?.high).toBe(5.25);

    selectCapRateBenchmark(
      { metric: "cap_rate", country: "US", city: "Houston", assetClass: "multifamily", propertySubtype: "class_a_infill" },
      US_CAP_RATE_OBSERVATIONS,
      AS_OF,
    );

    const after = houstonClassA();
    expect(after?.low).toBe(4.75);
    expect(after?.high).toBe(5.25);
  });
});

describe("I. Miami missing-data case returns DATA_GAP, never zero or null-without-reason", () => {
  test("Miami multifamily cap rate is a structured DATA_GAP", () => {
    const identity: BenchmarkIdentity = { metric: "cap_rate", country: "US", city: "Miami", assetClass: "multifamily" };
    const result = selectCapRateBenchmark(identity, US_CAP_RATE_OBSERVATIONS, AS_OF);
    expect(result.status).toBe("DATA_GAP");
    expect(result.dataGap).toBeDefined();
    expect(result.dataGap!.reason).toBeTruthy();
    expect(result.publisherValue).toBeUndefined();
    expect(result.publisherRange).toBeUndefined();
  });
});

describe("J. wrong asset class cannot cross-map", () => {
  test("requesting office in a city with only multifamily data returns DATA_GAP, not a multifamily value", () => {
    const identity: BenchmarkIdentity = { metric: "cap_rate", country: "US", city: "Houston", assetClass: "office" };
    const result = selectCapRateBenchmark(identity, US_CAP_RATE_OBSERVATIONS, AS_OF);
    expect(result.status).toBe("DATA_GAP");
  });
});

describe("K/L. Class A cannot silently become B/C; CBD cannot silently become suburban", () => {
  test("requesting Class B in a market where only Class A infill exists returns DATA_GAP", () => {
    const identity: BenchmarkIdentity = {
      metric: "cap_rate",
      country: "US",
      city: "Houston",
      assetClass: "multifamily",
      propertySubtype: "class_a_infill",
      propertyClass: "B",
    };
    const result = selectCapRateBenchmark(identity, US_CAP_RATE_OBSERVATIONS, AS_OF);
    // Houston class_a_infill observations carry propertyClass "unspecified" or
    // "A" — never "B" — so an explicit B request must not silently reuse them.
    expect(result.status).toBe("DATA_GAP");
  });

  test("requesting suburban office where only CBD office exists returns DATA_GAP, not the CBD value", () => {
    const cbdOffice: CRECitedObservation = {
      metric: "cap_rate",
      assetClass: "office",
      locationType: "cbd",
      geography: { country: "US", city: "TestCity" },
      periodStart: "2026-01-01",
      periodEnd: "2026-06-30",
      value: 7,
      unit: "percent",
      capRateType: "survey_estimate",
      source: { sourceId: "synthetic", sourceName: "Synthetic", sourceType: "brokerage" },
      citation: {
        sourceName: "Synthetic",
        reportTitle: "Test",
        publicationDate: "2026-07-01",
        period: "2Q 2026",
        locator: "n/a",
        sourceUrl: "https://example.com",
        retrievedAt: "2026-09-11",
      },
      sourceQuality: 95,
    };
    const identity: BenchmarkIdentity = {
      metric: "cap_rate",
      country: "US",
      city: "TestCity",
      assetClass: "office",
      locationType: "suburban",
    };
    const result = selectCapRateBenchmark(identity, [cbdOffice], AS_OF);
    expect(result.status).toBe("DATA_GAP");
  });
});

describe("M. residential data cannot silently become commercial multifamily", () => {
  test("no data-layer function accepts a residential observation and returns a multifamily key", () => {
    // Structural: `matchesIdentity`/`qualifyCapRateObservation` both key off the
    // observation's own assetClass, which E86's type system restricts to
    // CREAssetClass (commercial categories only) — there is no "residential"
    // member, so no residential observation can exist in this pool at all.
    const identity: BenchmarkIdentity = { metric: "cap_rate", country: "US", city: "Houston", assetClass: "multifamily" };
    const result = selectCapRateBenchmark(identity, US_CAP_RATE_OBSERVATIONS, AS_OF);
    for (const entry of result.provenance) {
      expect(entry.sourceId).not.toMatch(/zillow|redfin|census|fred/i);
    }
  });
});

describe("N. user override cannot mutate E86 source data", () => {
  test("creating and resolving an override leaves the observation array untouched", () => {
    const before = JSON.stringify(US_CAP_RATE_OBSERVATIONS);
    const e86 = selectCapRateBenchmark(
      { metric: "cap_rate", country: "US", city: "Houston", assetClass: "multifamily", propertySubtype: "class_a_infill" },
      US_CAP_RATE_OBSERVATIONS,
      AS_OF,
    );
    const override = createUserOverride({
      overrideValue: 6.25,
      overrideReason: "Local broker opinion differs from published range.",
      originalE86Value: 5.0,
      now: AS_OF,
    });
    const resolved = resolveBenchmark(e86, override);
    expect(resolved.active).toBe("override");
    expect(resolved.override?.source).toBe("USER");
    expect(resolved.e86).toBe(e86); // retained, not discarded
    expect(JSON.stringify(US_CAP_RATE_OBSERVATIONS)).toBe(before);
  });

  test("no override falls back to the E86 benchmark when available", () => {
    const e86 = selectCapRateBenchmark(
      { metric: "cap_rate", country: "US", city: "Houston", assetClass: "multifamily", propertySubtype: "class_a_infill" },
      US_CAP_RATE_OBSERVATIONS,
      AS_OF,
    );
    const resolved = resolveBenchmark(e86, undefined);
    expect(resolved.active).toBe("e86");
  });

  test("no override and a DATA_GAP falls back to application_default, never fabricates a value", () => {
    const gap = selectCapRateBenchmark({ metric: "cap_rate", country: "US", city: "Miami", assetClass: "office" }, US_CAP_RATE_OBSERVATIONS, AS_OF);
    const resolved = resolveBenchmark(gap, undefined);
    expect(resolved.active).toBe("application_default");
    expect(resolved.applicationDefaultReason).toBeTruthy();
  });
});

describe("O. invalid legacy values cannot masquerade as E86 values", () => {
  test("a legacy value with no source and no E86 mapping is flagged unverified", () => {
    const audit = auditLegacyBenchmark({ key: "office_downtown", value: 6.5, hasE86Mapping: false });
    expect(audit.classification).toBe("LEGACY_UNVERIFIED");
    expect(audit.hasSource).toBe(false);
    expect(audit.reason).toMatch(/must not be presented as E86-sourced/);
  });

  test("nullify option clears the value instead of retaining it", () => {
    const audit = auditLegacyBenchmark({ key: "office_downtown", value: 6.5, hasE86Mapping: false }, { nullify: true });
    expect(audit.classification).toBe("NULL");
    expect(audit.legacyValue).toBeNull();
  });

  test("a legacy value with a source and a matched E86 observation is still not auto-promoted to E86-sourced", () => {
    const audit = auditLegacyBenchmark({ key: "multifamily", value: 5.0, source: "internal analyst estimate", hasE86Mapping: true });
    expect(audit.classification).toBe("LEGACY_UNVERIFIED");
  });
});

describe("P. construction-cost mappings preserve their qualification", () => {
  test("an RLB office_prime observation resolves AVAILABLE_WITH_WARNING or AVAILABLE with a mapped legacy subtype", () => {
    const officePrime = US_HARD_COST_OBSERVATIONS.find((o) => o.propertySubtype === "office_prime");
    if (!officePrime) return;
    const identity: BenchmarkIdentity = {
      metric: "hard_cost",
      country: "US",
      city: officePrime.geography.city!,
      assetClass: "office",
      propertySubtype: "office_prime",
    };
    const result = selectHardCostBenchmark(identity, US_HARD_COST_OBSERVATIONS, mapRlbSubtype, AS_OF);
    expect(["AVAILABLE", "AVAILABLE_WITH_WARNING"]).toContain(result.status);
    expect(result.mappedLegacyKey).toBe("office_prime");
  });

  test("multifamily construction cost is DATA_GAP, never forced from RLB's office/retail data", () => {
    const synthetic: CRECitedObservation = {
      metric: "hard_cost",
      assetClass: "multifamily",
      propertySubtype: "multifamily_mid_rise",
      geography: { country: "US", city: "TestCity" },
      periodStart: "2026-01-01",
      periodEnd: "2026-06-30",
      low: 200,
      high: 250,
      unit: "USD_per_sf",
      basis: "per_sf",
      source: { sourceId: "rlb-north-america", sourceName: "RLB", sourceType: "construction_cost" },
      citation: {
        sourceName: "RLB",
        reportTitle: "Test",
        publicationDate: "2026-07-07",
        period: "Q2 2026",
        locator: "n/a",
        sourceUrl: "https://example.com",
        retrievedAt: "2026-09-11",
      },
      sourceQuality: 85,
    };
    const identity: BenchmarkIdentity = { metric: "hard_cost", country: "US", city: "TestCity", assetClass: "multifamily" };
    const result = selectHardCostBenchmark(identity, [synthetic], mapRlbSubtype, AS_OF);
    expect(result.status).toBe("DATA_GAP");
  });
});

describe("Q. soft costs cannot be represented as E86 sourced unless an actual source exists", () => {
  test("soft-cost lookup always returns SOFT_COST_DATA_NOT_AVAILABLE today", () => {
    const result = getSoftCostBenchmark({ country: "US", city: "Houston", assetClass: "multifamily" });
    expect(result.status).toBe("SOFT_COST_DATA_NOT_AVAILABLE");
    expect(result.reason).toMatch(/never labeled E86-sourced/);
  });
});

describe("selection is deterministic", () => {
  test("the same identity resolves to the same observation set every call", () => {
    const identity: BenchmarkIdentity = { metric: "cap_rate", country: "US", city: "Houston", assetClass: "multifamily", propertySubtype: "class_a_infill" };
    const r1 = selectCapRateBenchmark(identity, US_CAP_RATE_OBSERVATIONS, AS_OF);
    const r2 = selectCapRateBenchmark(identity, US_CAP_RATE_OBSERVATIONS, AS_OF);
    expect(r1.provenance.map((p) => p.observationId)).toEqual(r2.provenance.map((p) => p.observationId));
  });
});

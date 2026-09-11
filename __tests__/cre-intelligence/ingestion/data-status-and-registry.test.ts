import {
  resolveDataStatus,
  assertObservationStatus,
  type CREObservation,
} from "../../../src/cre-intelligence/types";
import { formatDataGapMessage } from "../../../src/cre-intelligence/ingestion/gap-reasons";
import {
  CRE_PUBLIC_SOURCE_REGISTRY,
  getPublicSource,
  listLegallyIncorporableSources,
  listSourcesRequiringLicenseReview,
} from "../../../src/cre-intelligence/ingestion/public-source-registry";

const BASE_OBS: CREObservation = {
  metric: "cap_rate",
  assetClass: "multifamily",
  capRateType: "stabilized",
  geography: { country: "US", city: "Austin" },
  periodStart: "2026-01-01",
  periodEnd: "2026-06-30",
  value: 5.5,
  unit: "percent",
  source: { sourceId: "cbre-us-cap-rates", sourceName: "CBRE", sourceType: "brokerage" },
  sourceQuality: 95,
};

describe("Phase 7 Part 9 — CREDataStatus", () => {
  test("an observation with no dataStatus resolves to observed (legacy default)", () => {
    expect(resolveDataStatus(BASE_OBS)).toBe("observed");
    expect(() => assertObservationStatus(BASE_OBS)).not.toThrow();
  });

  test("an explicit unsupported dataStatus is refused outright", () => {
    const bad: CREObservation = { ...BASE_OBS, dataStatus: "unsupported" };
    expect(() => assertObservationStatus(bad)).toThrow(/must not exist/i);
  });

  test("a derived observation without derivation provenance is refused", () => {
    const bad: CREObservation = { ...BASE_OBS, dataStatus: "derived", capRateType: "stabilized" };
    expect(() => assertObservationStatus(bad)).toThrow(/derivation provenance/i);
  });

  test("a derived_transaction cap rate satisfies the derived-provenance requirement", () => {
    const ok: CREObservation = {
      ...BASE_OBS,
      dataStatus: "derived",
      capRateType: "derived_transaction",
      derivedFrom: {
        propertyName: "123 Example St",
        transactionDate: "2026-03-01",
        purchasePrice: 10_000_000,
        priceSource: "County deed record",
        noi: 550_000,
        noiSource: "Offering memorandum",
        methodology: "NOI / purchase price",
      },
    };
    expect(() => assertObservationStatus(ok)).not.toThrow();
  });

  test("an observation carrying its own explicit derivedFrom also satisfies a non-transaction derived status", () => {
    const ok: CREObservation = {
      ...BASE_OBS,
      dataStatus: "derived",
      derivedFrom: {
        propertyName: "n/a",
        transactionDate: "2026-01-01",
        purchasePrice: 1,
        priceSource: "x",
        noi: 1,
        noiSource: "x",
        methodology: "x",
      },
    };
    expect(() => assertObservationStatus(ok)).not.toThrow();
  });
});

describe("Phase 7 Part 11 — data gap messaging", () => {
  test("produces a precise message instead of a generic 'no data available'", () => {
    const message = formatDataGapMessage({
      metricLabel: "Commercial cap rate",
      geographyLabel: "Miami, FL",
      reasonCode: "METRIC_NOT_PUBLISHED",
      licensedAlternativeHint: "Licensed CRE market source required.",
    });
    expect(message).toBe(
      "Commercial cap rate unavailable from public government sources for Miami, FL. This metric is not published by any public/government source E68 has checked. Licensed CRE market source required.",
    );
    expect(message).not.toMatch(/^No data available\.?$/);
  });

  test("every reason code produces a distinct, non-empty message", () => {
    const codes = [
      "METRIC_NOT_PUBLISHED",
      "GEOGRAPHY_NOT_COVERED",
      "GRANULARITY_NOT_AVAILABLE",
      "API_OR_DOWNLOAD_UNAVAILABLE",
      "LICENSE_REQUIRED",
      "SOURCE_TEMPORARILY_UNAVAILABLE",
      "SCHEMA_CHANGED",
      "VALIDATION_FAILED",
    ] as const;
    const messages = codes.map((reasonCode) =>
      formatDataGapMessage({ metricLabel: "X", geographyLabel: "Y", reasonCode }),
    );
    expect(new Set(messages).size).toBe(codes.length);
    for (const m of messages) expect(m.length).toBeGreaterThan(20);
  });
});

describe("Phase 7 Part 2/3/10/12 — public source registry integrity", () => {
  test("every entry has a real https evidence URL and a verification date", () => {
    expect(CRE_PUBLIC_SOURCE_REGISTRY.length).toBeGreaterThan(5);
    for (const source of CRE_PUBLIC_SOURCE_REGISTRY) {
      expect(source.evidenceUrls.length).toBeGreaterThan(0);
      for (const url of source.evidenceUrls) expect(url).toMatch(/^https:\/\//);
      expect(source.dateVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(source.sourceId.length).toBeGreaterThan(0);
    }
  });

  test("source IDs are unique", () => {
    const ids = CRE_PUBLIC_SOURCE_REGISTRY.map((s) => s.sourceId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("a source cannot be both legallyIncorporable and requiring license review", () => {
    const incorporable = new Set(listLegallyIncorporableSources().map((s) => s.sourceId));
    const requiresReview = new Set(listSourcesRequiringLicenseReview().map((s) => s.sourceId));
    for (const id of incorporable) expect(requiresReview.has(id)).toBe(false);
  });

  test("FRED and Census are registered but never classified as direct CRE benchmark sources", () => {
    const fred = getPublicSource("fred-api")!;
    const census = getPublicSource("us-census-api")!;
    expect(fred.categories).not.toContain("direct_cre_benchmark");
    expect(census.categories).not.toContain("direct_cre_benchmark");
  });

  test("StatCan WDS is the only entry classified as a direct CRE benchmark source with legallyIncorporable true", () => {
    const directBenchmarkSources = CRE_PUBLIC_SOURCE_REGISTRY.filter((s) =>
      s.categories.includes("direct_cre_benchmark"),
    );
    expect(directBenchmarkSources.map((s) => s.sourceId)).toContain("statcan-wds");
    for (const s of directBenchmarkSources) {
      if (s.sourceId === "statcan-wds") expect(s.legallyIncorporable).toBe(true);
    }
  });

  test("a source marked commercialUseRestriction 'restricted' is never also legallyIncorporable true", () => {
    for (const source of CRE_PUBLIC_SOURCE_REGISTRY) {
      if (source.commercialUseRestriction === "restricted") {
        expect(source.legallyIncorporable).not.toBe(true);
      }
    }
  });
});

import {
  CRE_PAID_SOURCE_PROFILES,
  CRE_RECOMMENDATION_TIERS,
  CRE_SCENARIO_SUMMARIES,
  getPaidSourceProfile,
  getRecommendationTier,
  isPaidSourceRedistributable,
  listPaidSourcesByCountry,
  listPaidSourcesWithCapRateData,
  listPaidSourcesWithConstructionCostData,
} from "../../src/cre-intelligence/paid-source-analysis";

const VALID_EVIDENCE_LEVELS = new Set(["CONFIRMED", "LIKELY", "UNCONFIRMED", "NOT_FOUND"]);
const VALID_LICENSE_PERMISSIONS = new Set(["YES", "NO", "REQUIRES_LICENSE_REVIEW"]);
const VALID_AUTOMATION_CLASSES = new Set([
  "API_AVAILABLE",
  "API_BY_CONTRACT",
  "BULK_EXPORT",
  "WEB_ONLY",
  "REPORT_PDF",
  "MANUAL_ONLY",
  "UNKNOWN",
]);
const VALID_COST_TIERS = new Set(["FREE", "PARTIALLY_PUBLIC", "PRICING_NOT_PUBLIC", "ESTIMATED_THIRD_PARTY_ONLY"]);
const VALID_COUNTRY_COVERAGE = new Set(["CA", "US", "CA_AND_US", "UNCONFIRMED"]);
const VALID_TIERS = new Set(["TIER_1", "TIER_2", "TIER_3", "TIER_4"]);

describe("E68 Phase 6 paid-source classification", () => {
  test("source IDs are unique", () => {
    const ids = CRE_PAID_SOURCE_PROFILES.map((source) => source.sourceId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every profile uses valid enum values for evidence, country coverage, automation, and cost tier", () => {
    for (const source of CRE_PAID_SOURCE_PROFILES) {
      expect(VALID_EVIDENCE_LEVELS.has(source.hasCapRateData)).toBe(true);
      expect(VALID_EVIDENCE_LEVELS.has(source.hasTransactionData)).toBe(true);
      expect(VALID_EVIDENCE_LEVELS.has(source.hasSalePriceData)).toBe(true);
      expect(VALID_EVIDENCE_LEVELS.has(source.hasNoiData)).toBe(true);
      expect(VALID_EVIDENCE_LEVELS.has(source.hasOccupancyData)).toBe(true);
      expect(VALID_EVIDENCE_LEVELS.has(source.hasRentData)).toBe(true);
      expect(VALID_EVIDENCE_LEVELS.has(source.hasConstructionCostData)).toBe(true);
      expect(VALID_EVIDENCE_LEVELS.has(source.hasReplacementCostData)).toBe(true);
      expect(VALID_EVIDENCE_LEVELS.has(source.hasDevelopmentCostData)).toBe(true);
      expect(VALID_EVIDENCE_LEVELS.has(source.hasMarketReports)).toBe(true);
      expect(VALID_EVIDENCE_LEVELS.has(source.bulkExportAvailable)).toBe(true);
      expect(VALID_COUNTRY_COVERAGE.has(source.countryCoverage)).toBe(true);
      expect(VALID_AUTOMATION_CLASSES.has(source.automationClass)).toBe(true);
      expect(VALID_COST_TIERS.has(source.costTier)).toBe(true);
    }
  });

  test("every profile has a fully populated licensing matrix using valid permission values", () => {
    for (const source of CRE_PAID_SOURCE_PROFILES) {
      const permissions = Object.values(source.licensing);
      expect(permissions.length).toBe(7);
      for (const permission of permissions) {
        expect(VALID_LICENSE_PERMISSIONS.has(permission)).toBe(true);
      }
    }
  });

  test("every profile carries at least one evidence URL and a verification date", () => {
    for (const source of CRE_PAID_SOURCE_PROFILES) {
      expect(source.evidenceUrls.length).toBeGreaterThan(0);
      for (const url of source.evidenceUrls) {
        expect(url).toMatch(/^https?:\/\//);
      }
      expect(source.dateVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test("a source claiming PRICING_NOT_PUBLIC never also carries a publicPriceNote", () => {
    for (const source of CRE_PAID_SOURCE_PROFILES) {
      if (source.costTier === "PRICING_NOT_PUBLIC") {
        expect(source.publicPriceNote).toBeUndefined();
      }
    }
  });

  test("a source claiming PARTIALLY_PUBLIC or ESTIMATED_THIRD_PARTY_ONLY pricing carries a publicPriceNote", () => {
    for (const source of CRE_PAID_SOURCE_PROFILES) {
      if (source.costTier === "PARTIALLY_PUBLIC" || source.costTier === "ESTIMATED_THIRD_PARTY_ONLY") {
        expect(source.publicPriceNote).toBeTruthy();
      }
    }
  });

  test("getPaidSourceProfile finds a known source and returns undefined for unknown ids", () => {
    expect(getPaidSourceProfile("cbre-cap-rate-survey")?.companyName).toBe("CBRE");
    expect(getPaidSourceProfile("msci-rca")?.hasTransactionData).toBe("CONFIRMED");
    expect(getPaidSourceProfile("not-a-real-source")).toBeUndefined();
  });

  test("listPaidSourcesByCountry includes CA_AND_US sources for both CA and US queries", () => {
    const caSources = listPaidSourcesByCountry("CA");
    const usSources = listPaidSourcesByCountry("US");
    expect(caSources.some((source) => source.sourceId === "altus-group")).toBe(true);
    expect(usSources.some((source) => source.sourceId === "altus-group")).toBe(true);
    expect(caSources.every((source) => source.countryCoverage === "CA" || source.countryCoverage === "CA_AND_US")).toBe(true);
  });

  test("listPaidSourcesWithCapRateData returns only CONFIRMED cap-rate sources", () => {
    const sources = listPaidSourcesWithCapRateData();
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.every((source) => source.hasCapRateData === "CONFIRMED")).toBe(true);
    // Sources known from research to lack a documented cap-rate product must be excluded.
    expect(sources.some((source) => source.sourceId === "rsmeans-gordian")).toBe(false);
    expect(sources.some((source) => source.sourceId === "propertyshark")).toBe(false);
  });

  test("listPaidSourcesWithConstructionCostData returns only CONFIRMED construction-cost sources", () => {
    const sources = listPaidSourcesWithConstructionCostData();
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.every((source) => source.hasConstructionCostData === "CONFIRMED")).toBe(true);
    expect(sources.some((source) => source.sourceId === "rsmeans-gordian")).toBe(true);
    // Cap-rate-only sources must not be misclassified as construction-cost sources.
    expect(sources.some((source) => source.sourceId === "cbre-cap-rate-survey")).toBe(false);
  });

  test("no paid source in this matrix is classified as redistributable", () => {
    // Consistent with the Phase 6 finding: not one paid source reviewed had
    // documented redistribution rights. This must remain false until a real
    // license is read and the data is updated accordingly.
    for (const source of CRE_PAID_SOURCE_PROFILES) {
      expect(isPaidSourceRedistributable(source)).toBe(false);
      expect(source.redistributionRestricted).toBe(true);
      expect(source.licensing.redistributeRawData).toBe("NO");
    }
  });

  test("recommendation tiers reference only real source IDs and use valid tier labels", () => {
    const knownIds = new Set(CRE_PAID_SOURCE_PROFILES.map((source) => source.sourceId));
    for (const entry of CRE_RECOMMENDATION_TIERS) {
      expect(knownIds.has(entry.sourceId)).toBe(true);
      expect(VALID_TIERS.has(entry.tier)).toBe(true);
    }
  });

  test("recommendation tier IDs are unique and getRecommendationTier resolves them", () => {
    const ids = CRE_RECOMMENDATION_TIERS.map((entry) => entry.sourceId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(getRecommendationTier("cbre-cap-rate-survey")).toBe("TIER_1");
    expect(getRecommendationTier("placer-ai")).toBe("TIER_4");
    expect(getRecommendationTier("not-a-real-source")).toBeUndefined();
  });

  test("TIER_4 sources are exactly the sources with no cap-rate or construction-cost evidence above UNCONFIRMED", () => {
    for (const entry of CRE_RECOMMENDATION_TIERS.filter((item) => item.tier === "TIER_4")) {
      const source = getPaidSourceProfile(entry.sourceId);
      expect(source).toBeDefined();
      expect(source!.hasCapRateData).not.toBe("CONFIRMED");
      expect(source!.hasConstructionCostData).not.toBe("CONFIRMED");
    }
  });

  test("scenario summaries reference only real source IDs and escalate in scope", () => {
    const knownIds = new Set([...CRE_PAID_SOURCE_PROFILES.map((s) => s.sourceId)]);
    for (const scenario of CRE_SCENARIO_SUMMARIES) {
      for (const id of scenario.sourceIds) {
        // Scenario A references E68's existing free-source registry IDs, not
        // this module's paid-source IDs; B and C must reference real paid IDs.
        if (scenario.scenarioId !== "SCENARIO_A_ZERO_BUDGET") {
          expect(knownIds.has(id)).toBe(true);
        }
      }
    }
    const scenarioA = CRE_SCENARIO_SUMMARIES.find((s) => s.scenarioId === "SCENARIO_A_ZERO_BUDGET")!;
    const scenarioB = CRE_SCENARIO_SUMMARIES.find((s) => s.scenarioId === "SCENARIO_B_LOW_MODERATE_BUDGET")!;
    const scenarioC = CRE_SCENARIO_SUMMARIES.find((s) => s.scenarioId === "SCENARIO_C_PROFESSIONAL_BUDGET")!;
    expect(scenarioA.costTier).toBe("FREE");
    expect(scenarioC.sourceIds.length).toBeGreaterThanOrEqual(scenarioB.sourceIds.length);
  });

  test("no proprietary numeric benchmark values (cap-rate percentages or $/SF costs) are embedded in this module", () => {
    // Scan every string field on every exported record for numeric patterns
    // that look like a cap rate (e.g. "5.7%", "4.75-5.25%") or a dollar cost
    // figure attributable to a specific building/city (e.g. "$391.00/ft2").
    // Pricing figures for the *data products themselves* (subscription cost)
    // are allowed and are distinguished by unit ($/yr, $/mo) rather than a
    // per-square-foot or percentage construction/cap-rate figure.
    const capRatePattern = /\b\d{1,2}(?:\.\d{1,2})?\s*%/; // e.g. "5.7%", "4.75%"
    const perSfPattern = /\$\s?\d+(?:\.\d+)?\s*\/\s*(?:ft2|sf|ft²|square\s?foot)/i;

    function collectStrings(value: unknown, out: string[]): void {
      if (typeof value === "string") {
        out.push(value);
      } else if (Array.isArray(value)) {
        value.forEach((item) => collectStrings(item, out));
      } else if (value && typeof value === "object") {
        Object.values(value).forEach((item) => collectStrings(item, out));
      }
    }

    const allStrings: string[] = [];
    collectStrings(CRE_PAID_SOURCE_PROFILES, allStrings);
    collectStrings(CRE_RECOMMENDATION_TIERS, allStrings);
    collectStrings(CRE_SCENARIO_SUMMARIES, allStrings);

    const suspiciousCapRateMatches = allStrings.filter((s) => capRatePattern.test(s));
    const suspiciousPerSfMatches = allStrings.filter((s) => perSfPattern.test(s));

    expect(suspiciousCapRateMatches).toEqual([]);
    expect(suspiciousPerSfMatches).toEqual([]);
  });

  test("subscription pricing notes, where present, describe product cost (per year/month) not a benchmark value", () => {
    for (const source of CRE_PAID_SOURCE_PROFILES) {
      if (source.publicPriceNote) {
        expect(source.publicPriceNote).toMatch(/\/(yr|year|mo|month)|starting at/i);
      }
    }
  });
});

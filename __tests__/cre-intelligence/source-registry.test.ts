import { CRE_SOURCE_REGISTRY, getCRESource, listCRESources } from "../../src/cre-intelligence/source-registry";

describe("E68 CRE source registry", () => {
  test("contains Canada and US benchmark sources", () => {
    expect(getCRESource("cbre-ca-cap-rates")?.countries).toContain("CA");
    expect(getCRESource("cbre-us-cap-rates")?.countries).toContain("US");
    expect(getCRESource("statcan-bcpi")?.access).toBe("public_data");
    expect(getCRESource("msci-rca")?.redistribution).toBe("license_required");
  });

  test("does not classify proprietary datasets as public redistribution sources", () => {
    for (const source of CRE_SOURCE_REGISTRY.filter((item) => item.access === "paid")) {
      expect(source.redistribution).toBe("license_required");
    }
  });

  test("filters sources by metric", () => {
    const capRateSources = listCRESources("cap_rate");
    const costIndexSources = listCRESources("construction_index");
    expect(capRateSources.length).toBeGreaterThan(0);
    expect(costIndexSources.length).toBeGreaterThan(0);
    expect(capRateSources.every((source) => source.metrics.includes("cap_rate"))).toBe(true);
  });

  test("source IDs are unique", () => {
    const ids = CRE_SOURCE_REGISTRY.map((source) => source.sourceId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

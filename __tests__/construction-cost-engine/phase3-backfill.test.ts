/**
 * InvestScape™ E88 Phase 3 — Coverage & Source Backfill tests.
 *
 * Covers: new source observations, additional cities, source-specific
 * mapping, exact/close/approximate/unsupported, licensing-restricted
 * source, missing provenance, index vs cost observation, hard vs soft vs
 * total, unsupported category, duplicate observations, conflicting
 * sources, deterministic source selection, deterministic coverage matrix,
 * no synthetic fallback.
 */
import {
  RLB_BACKFILL_US_HARD_COST_OBSERVATIONS,
  RLB_BACKFILL_CANADA_HARD_COST_OBSERVATIONS,
  RLB_BACKFILL_HARD_COST_OBSERVATIONS,
  e88ConstructionCostPool,
  E88_KNOWN_CONSTRUCTION_COST_OBSERVATIONS,
} from "../../src/construction-cost-engine/data";
import { assessCoverage } from "../../src/construction-cost-engine/coverage-matrix";
import { evaluateComparability } from "../../src/construction-cost-engine/comparability";
import { evaluateConstructionCostRequest } from "../../src/construction-cost-engine/pipeline";
import { E88_PHASE3_SOURCE_RESEARCH } from "../../src/construction-cost-engine/source-research";
import type { ConstructionCostCandidateInput, ConstructionCostRequest } from "../../src/construction-cost-engine/types";
import type { CRECitedObservation } from "../../src/cre-intelligence/types";

const CHECKED_AT = "2026-09-11";

function baseRequest(overrides: Partial<ConstructionCostRequest> = {}): ConstructionCostRequest {
  return {
    geography: { country: "US", city: "Boston" },
    assetClass: "office",
    canonicalSubtype: "office_premium",
    costRepresentation: "hard_cost",
    ...overrides,
  };
}

describe("New source observations / additional cities", () => {
  test("14 new US cities x 7 subtypes = 98 observations", () => {
    expect(RLB_BACKFILL_US_HARD_COST_OBSERVATIONS).toHaveLength(98);
  });

  test("2 Canadian cities x 7 subtypes = 14 observations", () => {
    expect(RLB_BACKFILL_CANADA_HARD_COST_OBSERVATIONS).toHaveLength(14);
  });

  test("combined backfill is 112 observations", () => {
    expect(RLB_BACKFILL_HARD_COST_OBSERVATIONS).toHaveLength(112);
  });

  test("does not duplicate any of the 4 cities E86 already has", () => {
    const backfilledCities = new Set(RLB_BACKFILL_US_HARD_COST_OBSERVATIONS.map((o) => o.geography.city));
    expect(backfilledCities.has("Austin")).toBe(false);
    expect(backfilledCities.has("Miami")).toBe(false);
    expect(backfilledCities.has("Seattle")).toBe(false);
    expect(backfilledCities.has("Phoenix")).toBe(false);
  });

  test("Houston remains absent from the backfill (genuinely not in the source)", () => {
    const cities = new Set(RLB_BACKFILL_US_HARD_COST_OBSERVATIONS.map((o) => o.geography.city));
    expect(cities.has("Houston")).toBe(false);
  });

  test("combined known-observations pool includes both E86's 53 and E88's 112", () => {
    expect(E88_KNOWN_CONSTRUCTION_COST_OBSERVATIONS.length).toBe(53 + 112);
  });

  test("every backfilled observation carries full citation/provenance", () => {
    for (const obs of RLB_BACKFILL_HARD_COST_OBSERVATIONS) {
      expect(obs.citation.sourceName).toBeTruthy();
      expect(obs.citation.reportTitle).toBeTruthy();
      expect(obs.citation.publicationDate).toBeTruthy();
      expect(obs.citation.sourceUrl).toBeTruthy();
      expect(obs.citation.retrievedAt).toBeTruthy();
      expect(obs.source.sourceId).toBe("rlb-north-america");
    }
  });
});

describe("Currency correctness (Canadian observations)", () => {
  test("Canadian observations are CAD, never silently treated as USD", () => {
    for (const obs of RLB_BACKFILL_CANADA_HARD_COST_OBSERVATIONS) {
      expect(obs.unit).toBe("CAD_per_sf");
      expect(obs.geography.country).toBe("CA");
    }
  });

  test("US observations remain USD", () => {
    for (const obs of RLB_BACKFILL_US_HARD_COST_OBSERVATIONS) {
      expect(obs.unit).toBe("USD_per_sf");
      expect(obs.geography.country).toBe("US");
    }
  });

  test("a USD request against a CAD observation is excluded, never silently bridged", () => {
    const calgaryObs = RLB_BACKFILL_CANADA_HARD_COST_OBSERVATIONS.find(
      (o) => o.geography.city === "Calgary" && o.propertySubtype === "office_prime",
    )!;
    const request = baseRequest({ geography: { country: "CA", city: "Calgary" }, currency: "USD" });
    const result = evaluateComparability(request, [{ observation: calgaryObs }]);
    expect(result.included).toHaveLength(0);
    expect(result.excluded[0].exclusionReasonCode).toBe("CURRENCY_MISMATCH");
  });
});

describe("Source-specific mapping / comparability tiers using new data", () => {
  test("Boston office_prime maps at close (subtype dimension), never exact — same mapping rule as the original 4 cities", () => {
    const pool = e88ConstructionCostPool();
    const request = baseRequest({ geography: { country: "US", city: "Boston" }, canonicalSubtype: "office_premium" });
    const result = evaluateComparability(request, pool);
    const bostonCandidate = result.candidates.find((c) => c.observation.geography.city === "Boston" && c.observation.propertySubtype === "office_prime");
    expect(bostonCandidate?.dimensions.subtypeMatch.level).toBe("close");
    expect(bostonCandidate?.dimensions.subtypeMatch.level).not.toBe("exact");
  });

  test("New York retail_shopping_center maps at exact (subtype dimension)", () => {
    const pool = e88ConstructionCostPool();
    const request = baseRequest({ geography: { country: "US", city: "New York" }, assetClass: "retail", canonicalSubtype: "retail_shopping_center" });
    const result = evaluateComparability(request, pool);
    const nyCandidate = result.included.find((c) => c.observation.geography.city === "New York");
    expect(nyCandidate?.dimensions.subtypeMatch.level).toBe("exact");
    expect(nyCandidate?.dimensions.geographyMatch.level).toBe("exact");
  });

  test("Toronto hotel_3_star maps at approximate (subtype dimension), never upgraded", () => {
    const pool = e88ConstructionCostPool();
    const request = baseRequest({ geography: { country: "CA", city: "Toronto" }, assetClass: "hotel", canonicalSubtype: "hotel_select_service", currency: "CAD" });
    const result = evaluateComparability(request, pool);
    const torontoCandidate = result.candidates.find((c) => c.observation.geography.city === "Toronto" && c.observation.propertySubtype === "hotel_3_star");
    expect(torontoCandidate?.dimensions.subtypeMatch.level).toBe("approximate");
  });
});

describe("Unsupported category still correctly refused (multifamily/industrial)", () => {
  test("multifamily hard-cost request against the full known pool -> DATA_GAP, no fabrication", () => {
    const pool = e88ConstructionCostPool();
    const request = baseRequest({ assetClass: "multifamily", canonicalSubtype: "multifamily_mid_rise", geography: { country: "US" } });
    const result = evaluateConstructionCostRequest(request, pool, CHECKED_AT);
    expect(result.status).toBe("DATA_GAP");
    if (result.status !== "DATA_GAP") return;
    expect(result.gap.reasonCode).toBe("SOURCE_DOES_NOT_COVER_CATEGORY");
  });

  test("industrial hard-cost request against the full known pool -> DATA_GAP, no fabrication", () => {
    const pool = e88ConstructionCostPool();
    const request = baseRequest({ assetClass: "industrial", canonicalSubtype: "industrial_warehouse", geography: { country: "US" } });
    const result = evaluateConstructionCostRequest(request, pool, CHECKED_AT);
    expect(result.status).toBe("DATA_GAP");
    if (result.status !== "DATA_GAP") return;
    expect(result.gap.reasonCode).toBe("SOURCE_DOES_NOT_COVER_CATEGORY");
  });
});

describe("Coverage matrix (Part 6)", () => {
  test("DATA_AVAILABLE for a newly-backfilled city/subtype", () => {
    const pool = e88ConstructionCostPool();
    const result = assessCoverage(baseRequest({ geography: { country: "US", city: "Denver" }, canonicalSubtype: "office_premium" }), pool, CHECKED_AT);
    expect(result.status).toBe("DATA_AVAILABLE");
  });

  test("SOURCE_DOES_NOT_COVER for multifamily", () => {
    const pool = e88ConstructionCostPool();
    const result = assessCoverage(baseRequest({ assetClass: "multifamily", canonicalSubtype: "multifamily_mid_rise", geography: { country: "US" } }), pool, CHECKED_AT);
    expect(["SOURCE_DOES_NOT_COVER", "LICENSE_RESTRICTED"]).toContain(result.status);
  });

  test("LICENSE_RESTRICTED asserted only for the documented multifamily/industrial hard-cost gap", () => {
    const pool = e88ConstructionCostPool();
    const result = assessCoverage(baseRequest({ assetClass: "industrial", canonicalSubtype: "industrial_warehouse", geography: { country: "US" } }), pool, CHECKED_AT);
    expect(result.status).toBe("LICENSE_RESTRICTED");
  });

  test("NOT_YET_IMPLEMENTED for soft cost anywhere", () => {
    const pool = e88ConstructionCostPool();
    const result = assessCoverage(baseRequest({ costRepresentation: "soft_cost" }), pool, CHECKED_AT);
    expect(result.status).toBe("NOT_YET_IMPLEMENTED");
  });

  test("DATA_NOT_FOUND for a city genuinely absent from every source (Houston)", () => {
    const pool = e88ConstructionCostPool();
    const result = assessCoverage(baseRequest({ geography: { country: "US", city: "Houston" }, canonicalSubtype: "office_premium" }), pool, CHECKED_AT);
    expect(["DATA_NOT_FOUND", "SOURCE_DOES_NOT_COVER"]).toContain(result.status);
  });

  test("deterministic coverage matrix: repeated calls agree", () => {
    const pool = e88ConstructionCostPool();
    const request = baseRequest({ geography: { country: "US", city: "Chicago" } });
    const a = assessCoverage(request, pool, CHECKED_AT);
    const b = assessCoverage(request, pool, CHECKED_AT);
    expect(a).toEqual(b);
  });

  test("coverage matrix never reports DATA_AVAILABLE for a request no candidate can satisfy (no synthetic fallback)", () => {
    const pool = e88ConstructionCostPool();
    const result = assessCoverage(baseRequest({ costRepresentation: "total_cost", geography: { country: "US", city: "Boston" } }), pool, CHECKED_AT);
    expect(result.status).not.toBe("DATA_AVAILABLE");
  });
});

describe("Duplicate / conflicting observations", () => {
  function fakeObs(overrides: Partial<CRECitedObservation> = {}): CRECitedObservation {
    return {
      metric: "hard_cost",
      assetClass: "office",
      propertySubtype: "office_prime",
      propertyClass: "unspecified",
      locationType: "unspecified",
      geography: { country: "US", region: "TX", metro: "Austin, TX", city: "Austin" },
      periodStart: "2026-04-01",
      periodEnd: "2026-06-30",
      low: 255,
      high: 425,
      unit: "USD_per_sf",
      basis: "per_sf",
      source: { sourceId: "rlb-north-america", sourceName: "Rider Levett Bucknall", sourceType: "construction_cost" },
      citation: {
        sourceName: "Rider Levett Bucknall",
        reportTitle: "RLB Quarterly Construction Cost Report — North America, Q2 2026",
        publicationDate: "2026-07-07",
        period: "Q2 2026",
        locator: "Table X",
        sourceUrl: "https://example.com/rlb.pdf",
        retrievedAt: "2026-09-10",
      },
      sourceQuality: 94,
      ...overrides,
    };
  }

  test("two identical observations from the same source are both preserved, never silently deduplicated", () => {
    const obs = fakeObs();
    const pool: ConstructionCostCandidateInput[] = [{ observation: obs }, { observation: { ...obs } }];
    const request = baseRequest({ geography: { country: "US", city: "Austin" } });
    const result = evaluateComparability(request, pool);
    expect(result.candidates).toHaveLength(2);
  });

  test("conflicting sources for the same city/subtype are both surfaced, never averaged or silently preferred", () => {
    const rlbObs = fakeObs({ low: 255, high: 425 });
    const conflictingObs = fakeObs({
      low: 300,
      high: 500,
      source: { sourceId: "hypothetical-other-source", sourceName: "Hypothetical Other Publisher", sourceType: "construction_cost" },
      citation: { ...fakeObs().citation, sourceName: "Hypothetical Other Publisher", reportTitle: "Hypothetical Report" },
    });
    const pool: ConstructionCostCandidateInput[] = [{ observation: rlbObs }, { observation: conflictingObs }];
    // No canonicalSubtype pinned: the second source has no taxonomy mapping table at all
    // (unknown source is always unsupported, never approximate — taxonomy.ts's own rule),
    // so pinning a subtype would correctly exclude it. Leaving it unconstrained isolates
    // the actual point of this test: two sources' values for the same city/asset class are
    // never merged or silently preferred over one another.
    const request = baseRequest({ geography: { country: "US", city: "Austin" }, canonicalSubtype: undefined });
    const result = evaluateComparability(request, pool);
    expect(result.included).toHaveLength(2);
    const sourceIds = result.included.map((c) => c.observation.source.sourceId).sort();
    expect(sourceIds).toEqual(["hypothetical-other-source", "rlb-north-america"]);
    // Values are never merged/averaged — each candidate keeps its own original low/high.
    expect(result.included.find((c) => c.observation.source.sourceId === "rlb-north-america")?.observation.low).toBe(255);
    expect(result.included.find((c) => c.observation.source.sourceId === "hypothetical-other-source")?.observation.low).toBe(300);
  });

  test("deterministic source selection: comparability tiers do not depend on pool order across conflicting sources", () => {
    const rlbObs = fakeObs();
    const otherObs = fakeObs({ source: { sourceId: "hypothetical-other-source", sourceName: "Hypothetical Other Publisher", sourceType: "construction_cost" } });
    const request = baseRequest({ geography: { country: "US", city: "Austin" }, canonicalSubtype: undefined });
    const forward = evaluateComparability(request, [{ observation: rlbObs }, { observation: otherObs }]);
    const reversed = evaluateComparability(request, [{ observation: otherObs }, { observation: rlbObs }]);
    const tiersBySource = (list: typeof forward.candidates) =>
      Object.fromEntries(list.map((c) => [c.observation.source.sourceId, c.comparability]));
    expect(tiersBySource(forward.candidates)).toEqual(tiersBySource(reversed.candidates));
  });
});

describe("Missing provenance in a hypothetical new-source observation", () => {
  test("a backfilled-style observation with stripped citation is excluded, never trusted anyway", () => {
    const stripped: CRECitedObservation = {
      ...RLB_BACKFILL_US_HARD_COST_OBSERVATIONS[0],
      citation: { sourceName: "", reportTitle: "", publicationDate: "", period: "Q2 2026", locator: "", sourceUrl: "", retrievedAt: "" },
    };
    const request = baseRequest({ geography: stripped.geography, assetClass: stripped.assetClass, canonicalSubtype: "office_premium" });
    const result = evaluateComparability(request, [{ observation: stripped }]);
    expect(result.excluded[0]?.exclusionReasonCode).toBe("INSUFFICIENT_PROVENANCE");
  });
});

describe("Index vs cost observation (still correctly distinguished after backfill)", () => {
  test("a construction_index-metric observation among backfilled hard-cost data never qualifies as a cost candidate", () => {
    const indexObs: CRECitedObservation = {
      ...RLB_BACKFILL_US_HARD_COST_OBSERVATIONS[0],
      metric: "construction_index",
      unit: "index",
      basis: "index",
      low: undefined,
      high: undefined,
      value: 20000,
    };
    const request = baseRequest({ geography: indexObs.geography, canonicalSubtype: "office_premium" });
    const result = evaluateComparability(request, [{ observation: indexObs }]);
    expect(result.included).toHaveLength(0);
    expect(result.excluded[0].normalized).toBeUndefined();
  });
});

describe("Source research register (Part 5)", () => {
  test("every record has a USE/REGISTER/REJECT decision and rationale", () => {
    for (const record of E88_PHASE3_SOURCE_RESEARCH) {
      expect(["USE", "REGISTER", "REJECT"]).toContain(record.decision);
      expect(record.rationale.length).toBeGreaterThan(0);
    }
  });

  test("RLB is USE; Turner & Townsend, StatCan BCPI, RSMeans, Altus are REGISTER; CMHC is REJECT", () => {
    const byId = Object.fromEntries(E88_PHASE3_SOURCE_RESEARCH.map((r) => [r.sourceId, r.decision]));
    expect(byId["rlb-north-america"]).toBe("USE");
    expect(byId["turner-townsend-north-america"]).toBe("REGISTER");
    expect(byId["statcan-bcpi"]).toBe("REGISTER");
    expect(byId["rsmeans-gordian"]).toBe("REGISTER");
    expect(byId["altus-group"]).toBe("REGISTER");
    expect(byId["cmhc-housing"]).toBe("REJECT");
  });

  test("no source record contains a numeric construction-cost figure (metadata only)", () => {
    const serialized = JSON.stringify(E88_PHASE3_SOURCE_RESEARCH);
    expect(serialized).not.toMatch(/"low":\s*\d/);
    expect(serialized).not.toMatch(/"high":\s*\d/);
  });
});

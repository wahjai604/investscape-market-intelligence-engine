/**
 * InvestScape™ E70 Phase 2 — Comparability Layer tests.
 *
 * Adversarial style mirroring __tests__/cap-rate-engine/comparability.test.ts:
 * every case runs evaluateCandidate/evaluateComparability end to end against
 * inline-constructed E68 fixtures, so every dimension's failure mode can
 * actually be triggered.
 */
import { evaluateCandidate, evaluateComparability } from "../../src/construction-cost-engine/comparability";
import type { ConstructionCostCandidateInput, ConstructionCostRequest } from "../../src/construction-cost-engine/types";
import type { CRECitedObservation } from "../../src/cre-intelligence/types";

function obs(overrides: Partial<CRECitedObservation> = {}): CRECitedObservation {
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

function baseRequest(overrides: Partial<ConstructionCostRequest> = {}): ConstructionCostRequest {
  return {
    geography: { country: "US", city: "Austin" },
    assetClass: "office",
    canonicalSubtype: "office_premium",
    costRepresentation: "hard_cost",
    ...overrides,
  };
}

function candidate(o: CRECitedObservation, freshness?: ConstructionCostCandidateInput["freshness"]): ConstructionCostCandidateInput {
  return { observation: o, freshness };
}

describe("Building type / subtype", () => {
  test("exact building-type match (retail shopping center)", () => {
    const r = evaluateCandidate(
      baseRequest({ assetClass: "retail", canonicalSubtype: "retail_shopping_center" }),
      candidate(obs({ assetClass: "retail", propertySubtype: "retail_shopping_center" })),
    );
    expect(r.dimensions.subtypeMatch.level).toBe("exact");
    expect(r.decision).toBe("INCLUDED");
  });

  test("close mapping (office_prime -> office_premium), never reported as exact", () => {
    const r = evaluateCandidate(baseRequest(), candidate(obs()));
    expect(r.dimensions.subtypeMatch.level).toBe("close");
    expect(r.dimensions.subtypeMatch.level).not.toBe("exact");
    expect(r.decision).toBe("INCLUDED");
  });

  test("approximate mapping (hotel 3-star), never upgraded to close", () => {
    const r = evaluateCandidate(
      baseRequest({ assetClass: "hotel", canonicalSubtype: "hotel_select_service" }),
      candidate(obs({ assetClass: "hotel", propertySubtype: "hotel_3_star" })),
    );
    expect(r.dimensions.subtypeMatch.level).toBe("approximate");
    expect(r.decision).toBe("INCLUDED");
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  test("unsupported mapping (multifamily has no RLB subtype at all) -> excluded via subtype, never faked", () => {
    // Asset class itself is a match (a hypothetical multifamily observation exists in the pool);
    // the point is that RLB's mapping table has no entry for this subtype at all, so the
    // subtype dimension — not asset class — is what correctly disqualifies it.
    const r = evaluateCandidate(
      baseRequest({ assetClass: "multifamily", canonicalSubtype: "multifamily_mid_rise" }),
      candidate(obs({ assetClass: "multifamily", propertySubtype: "multifamily_mid_rise" })),
    );
    expect(r.dimensions.subtypeMatch.level).toBe("unsupported");
    expect(r.decision).toBe("EXCLUDED");
    expect(r.exclusionReasonCode).toBe("WRONG_SUBTYPE_MAPPING");
  });

  test("multifamily/industrial truly absent from the RLB pool entirely -> asset-class dimension excludes it", () => {
    const r = evaluateCandidate(
      baseRequest({ assetClass: "multifamily", canonicalSubtype: "multifamily_mid_rise" }),
      candidate(obs({ assetClass: "office", propertySubtype: "office_prime" })), // only office exists in the real RLB pool
    );
    expect(r.dimensions.assetMatch.level).toBe("unsupported");
    expect(r.decision).toBe("EXCLUDED");
    expect(r.exclusionReasonCode).toBe("WRONG_ASSET_TYPE");
  });

  test("wrong building type (industrial requested, office observed) -> excluded", () => {
    const r = evaluateCandidate(baseRequest({ assetClass: "industrial", canonicalSubtype: "industrial_warehouse" }), candidate(obs()));
    expect(r.dimensions.assetMatch.level).toBe("unsupported");
    expect(r.decision).toBe("EXCLUDED");
    expect(r.exclusionReasonCode).toBe("WRONG_ASSET_TYPE");
  });

  test("wrong subtype (retail_strip observed, retail_shopping_center requested) -> excluded", () => {
    const r = evaluateCandidate(
      baseRequest({ assetClass: "retail", canonicalSubtype: "retail_shopping_center" }),
      candidate(obs({ assetClass: "retail", propertySubtype: "retail_strip" })),
    );
    expect(r.dimensions.subtypeMatch.level).toBe("unsupported");
    expect(r.decision).toBe("EXCLUDED");
    expect(r.exclusionReasonCode).toBe("WRONG_SUBTYPE_MAPPING");
  });

  test("request does not pin a canonical subtype -> not_constrained, never scored", () => {
    const r = evaluateCandidate(baseRequest({ canonicalSubtype: undefined }), candidate(obs()));
    expect(r.dimensions.subtypeMatch.level).toBe("not_constrained");
  });
});

describe("Geography", () => {
  test("wrong geography (city mismatch, no shared metro) -> excluded", () => {
    const r = evaluateCandidate(baseRequest({ geography: { country: "US", city: "Miami" } }), candidate(obs()));
    expect(r.dimensions.geographyMatch.level).toBe("unsupported");
    expect(r.decision).toBe("EXCLUDED");
    expect(r.exclusionReasonCode).toBe("WRONG_GEOGRAPHY");
  });

  test("city vs metro vs national mismatch: metro-only request against city-specific observation, different metro -> unsupported", () => {
    const r = evaluateCandidate(
      baseRequest({ geography: { country: "US", metro: "Dallas, TX" } }),
      candidate(obs({ geography: { country: "US", region: "TX", metro: "Austin, TX", city: "Austin" } })),
    );
    expect(r.dimensions.geographyMatch.level).toBe("unsupported");
  });

  test("national request (country only) against city-level observation -> exact (country matches, no narrower pin)", () => {
    const r = evaluateCandidate(baseRequest({ geography: { country: "US" } }), candidate(obs()));
    expect(r.dimensions.geographyMatch.level).toBe("exact");
  });

  test("same metro, different city -> approximate, still included", () => {
    const r = evaluateCandidate(
      baseRequest({ geography: { country: "US", metro: "Austin, TX", city: "Austin" } }),
      candidate(obs({ geography: { country: "US", region: "TX", metro: "Austin, TX", city: "Round Rock" } })),
    );
    expect(r.dimensions.geographyMatch.level).toBe("approximate");
    expect(r.decision).toBe("INCLUDED");
  });
});

describe("Hard / soft / total cost representation", () => {
  test("hard-cost request against hard-cost observation -> exact", () => {
    const r = evaluateCandidate(baseRequest({ costRepresentation: "hard_cost" }), candidate(obs()));
    expect(r.dimensions.costRepresentationMatch.level).toBe("exact");
    expect(r.decision).toBe("INCLUDED");
  });

  test("hard vs soft mismatch: soft-cost request against hard-cost observation -> excluded, never treated as close enough", () => {
    const r = evaluateCandidate(baseRequest({ costRepresentation: "soft_cost" }), candidate(obs({ metric: "hard_cost" })));
    expect(r.dimensions.costRepresentationMatch.level).toBe("unsupported");
    expect(r.decision).toBe("EXCLUDED");
    expect(r.exclusionReasonCode).toBe("WRONG_COST_REPRESENTATION");
  });

  test("total-cost request against a bare hard-cost observation -> excluded at the dimension level (never silently served as total)", () => {
    const r = evaluateCandidate(baseRequest({ costRepresentation: "total_cost" }), candidate(obs({ metric: "hard_cost" })));
    expect(r.dimensions.costRepresentationMatch.level).toBe("unsupported");
    expect(r.decision).toBe("EXCLUDED");
  });

  test("construction_index observation can never satisfy any cost-representation request", () => {
    const r = evaluateCandidate(
      baseRequest({ costRepresentation: "hard_cost" }),
      candidate(obs({ metric: "construction_index", unit: "index", basis: "index", low: undefined, high: undefined, value: 20453 })),
    );
    expect(r.decision).toBe("EXCLUDED");
    expect(r.normalized).toBeUndefined();
  });
});

describe("Currency", () => {
  test("currency mismatch -> excluded, no FX rate invented", () => {
    const r = evaluateCandidate(baseRequest({ currency: "CAD" }), candidate(obs({ unit: "USD_per_sf" })));
    expect(r.dimensions.currencyMatch.level).toBe("unsupported");
    expect(r.decision).toBe("EXCLUDED");
    expect(r.exclusionReasonCode).toBe("CURRENCY_MISMATCH");
  });

  test("unsupported currency conversion is never silently bridged even when requested currency is unusual", () => {
    const r = evaluateCandidate(baseRequest({ currency: "CAD" }), candidate(obs({ unit: "USD_per_sf" })));
    expect(r.dimensions.currencyMatch.reason).toMatch(/no FX rate/i);
  });

  test("matching currency -> exact", () => {
    const r = evaluateCandidate(baseRequest({ currency: "USD" }), candidate(obs({ unit: "USD_per_sf" })));
    expect(r.dimensions.currencyMatch.level).toBe("exact");
  });

  test("no currency pinned -> not_constrained", () => {
    const r = evaluateCandidate(baseRequest({ currency: undefined }), candidate(obs()));
    expect(r.dimensions.currencyMatch.level).toBe("not_constrained");
  });
});

describe("Unit / measurement basis", () => {
  test("incompatible unit basis (per_sf requested, per_unit observed, no conversion possible) -> excluded", () => {
    const r = evaluateCandidate(
      baseRequest({ unitBasis: "per_sf" }),
      candidate(obs({ unit: "USD_per_unit", basis: "per_unit" })),
    );
    expect(r.dimensions.unitBasisMatch.level).toBe("unsupported");
    expect(r.decision).toBe("EXCLUDED");
    expect(r.exclusionReasonCode).toBe("INCOMPATIBLE_UNIT_BASIS");
  });

  test("per_sf vs per_sm is deterministically close, never unsupported", () => {
    const r = evaluateCandidate(baseRequest({ unitBasis: "per_sm" }), candidate(obs({ unit: "USD_per_sf", basis: "per_sf" })));
    expect(r.dimensions.unitBasisMatch.level).toBe("close");
    expect(r.decision).toBe("INCLUDED");
  });

  test("incompatible measurement basis (index basis vs per_sf request) -> excluded via cost-representation dimension", () => {
    const r = evaluateCandidate(
      baseRequest({ unitBasis: "per_sf" }),
      candidate(obs({ metric: "construction_index", unit: "index", basis: "index", low: undefined, high: undefined, value: 1 })),
    );
    expect(r.decision).toBe("EXCLUDED");
  });
});

describe("Freshness", () => {
  test("stale observation is disclosed as approximate, not excluded on its own", () => {
    const r = evaluateCandidate(baseRequest(), candidate(obs(), "stale"));
    expect(r.dimensions.freshnessMatch.level).toBe("approximate");
    expect(r.decision).toBe("INCLUDED");
  });

  test("historical observation is disclosed as approximate, preserved as a valid fact", () => {
    const r = evaluateCandidate(baseRequest(), candidate(obs(), "historical"));
    expect(r.dimensions.freshnessMatch.level).toBe("approximate");
    expect(r.decision).toBe("INCLUDED");
  });

  test("missing freshness assessment is never assumed current", () => {
    const r = evaluateCandidate(baseRequest(), candidate(obs(), undefined));
    expect(r.dimensions.freshnessMatch.level).toBe("approximate");
    expect(r.dimensions.freshnessMatch.reason).toMatch(/not assessed/i);
  });

  test("request pins minFreshness and observation is stale -> hard-excluded", () => {
    const r = evaluateCandidate(baseRequest({ minFreshness: "live_current" }), candidate(obs(), "stale"));
    expect(r.decision).toBe("EXCLUDED");
    expect(r.exclusionReasonCode).toBe("STALE");
  });

  test("unavailable source freshness -> excluded as UNAVAILABLE when minFreshness pinned", () => {
    const r = evaluateCandidate(baseRequest({ minFreshness: "recent" }), candidate(obs(), "unavailable"));
    expect(r.decision).toBe("EXCLUDED");
    expect(r.exclusionReasonCode).toBe("UNAVAILABLE");
  });
});

describe("Provenance", () => {
  test("missing provenance (empty citation fields) -> hard-excluded regardless of other dimensions", () => {
    const badObs = obs({
      citation: {
        sourceName: "",
        reportTitle: "",
        publicationDate: "",
        period: "Q2 2026",
        locator: "",
        sourceUrl: "",
        retrievedAt: "",
      },
    });
    const r = evaluateCandidate(baseRequest(), candidate(badObs));
    expect(r.decision).toBe("EXCLUDED");
    expect(r.exclusionReasonCode).toBe("INSUFFICIENT_PROVENANCE");
  });
});

describe("evaluateComparability — pool-level behavior", () => {
  test("empty candidate pool -> empty included/excluded, no synthetic fallback", () => {
    const result = evaluateComparability(baseRequest(), []);
    expect(result.candidates).toHaveLength(0);
    expect(result.included).toHaveLength(0);
    expect(result.excluded).toHaveLength(0);
  });

  test("multiple candidates with different comparability are all preserved, never collapsed to one", () => {
    const pool = [
      candidate(obs({ geography: { country: "US", city: "Austin" } })),
      candidate(obs({ geography: { country: "US", city: "Miami" } })),
      candidate(obs({ propertySubtype: "hotel_3_star", assetClass: "hotel" })),
    ];
    const result = evaluateComparability(baseRequest({ geography: { country: "US", city: "Austin" } }), pool);
    expect(result.candidates).toHaveLength(3);
    const levels = result.candidates.map((c) => c.comparability);
    expect(new Set(levels).size).toBeGreaterThan(1);
  });

  test("deterministic ordering: result order matches input pool order regardless of comparability tier", () => {
    const pool = [
      candidate(obs({ geography: { country: "US", city: "Miami" } })), // unsupported
      candidate(obs({ geography: { country: "US", city: "Austin" } })), // exact-ish
    ];
    const result = evaluateComparability(baseRequest({ geography: { country: "US", city: "Austin" } }), pool);
    expect(result.candidates[0].observation.geography.city).toBe("Miami");
    expect(result.candidates[1].observation.geography.city).toBe("Austin");
  });

  test("candidate ordering independence: reversing the pool does not change any individual verdict", () => {
    const a = obs({ geography: { country: "US", city: "Austin" } });
    const b = obs({ geography: { country: "US", city: "Miami" } });
    const request = baseRequest({ geography: { country: "US", city: "Austin" } });
    const forward = evaluateComparability(request, [candidate(a), candidate(b)]);
    const reversed = evaluateComparability(request, [candidate(b), candidate(a)]);
    const byCity = (list: typeof forward.candidates) =>
      Object.fromEntries(list.map((c) => [c.observation.geography.city, c.comparability]));
    expect(byCity(forward.candidates)).toEqual(byCity(reversed.candidates));
  });

  test("repeated execution produces identical output (determinism)", () => {
    const pool = [candidate(obs())];
    const request = baseRequest();
    expect(evaluateComparability(request, pool)).toEqual(evaluateComparability(request, pool));
  });

  test("deterministic exclusion reasons: same mismatched candidate always yields the same exclusionReasonCode", () => {
    const pool = [candidate(obs({ assetClass: "office", propertySubtype: "office_prime" }))];
    const request = baseRequest({ assetClass: "multifamily", canonicalSubtype: "multifamily_mid_rise" });
    const runs = Array.from({ length: 5 }, () => evaluateComparability(request, pool).excluded[0].exclusionReasonCode);
    expect(new Set(runs).size).toBe(1);
    expect(runs[0]).toBe("WRONG_ASSET_TYPE");
  });

  test("no synthetic fallback: an all-excluded pool never produces an included candidate", () => {
    const pool = [candidate(obs({ geography: { country: "US", city: "Miami" } }))];
    const result = evaluateComparability(baseRequest({ geography: { country: "US", city: "Austin" } }), pool);
    expect(result.included).toHaveLength(0);
    expect(result.excluded).toHaveLength(1);
  });
});

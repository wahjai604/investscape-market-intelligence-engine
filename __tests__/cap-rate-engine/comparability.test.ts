/**
 * InvestScape™ E69 Phase 2 — Cap-Rate Comparability Layer tests.
 *
 * Adversarial style mirroring __tests__/cre-intelligence/benchmark-qualification.test.ts:
 * every case is exercised end to end (evaluateCandidate/evaluateComparability),
 * not merely named. E68 fixtures are constructed inline (synthetic) so every
 * dimension's failure mode can actually be triggered.
 */
import { evaluateCandidate, evaluateComparability } from "../../src/cap-rate-engine/comparability";
import type { E69CandidateInput, E69ComparabilityRequest } from "../../src/cap-rate-engine/comparability-types";
import type { CRECitedObservation } from "../../src/cre-intelligence/types";

function obs(overrides: Partial<CRECitedObservation> = {}): CRECitedObservation {
  return {
    metric: "cap_rate",
    assetClass: "multifamily",
    geography: { country: "US", metro: "Houston Metro", city: "Houston" },
    periodStart: "2026-01-01",
    periodEnd: "2026-06-30",
    value: 5.5,
    unit: "percent",
    capRateType: "stabilized",
    source: { sourceId: "kidder-mathews-research", sourceName: "Kidder Mathews", sourceType: "brokerage" },
    citation: {
      sourceName: "Kidder Mathews",
      reportTitle: "Test Report 2026",
      publicationDate: "2026-07-01",
      period: "2Q 2026",
      locator: "Table X",
      sourceUrl: "https://example.com/report.pdf",
      retrievedAt: "2026-09-01",
    },
    sourceQuality: 90,
    ...overrides,
  };
}

function baseRequest(overrides: Partial<E69ComparabilityRequest> = {}): E69ComparabilityRequest {
  return {
    geography: { country: "US", city: "Houston" },
    assetClass: "multifamily",
    ...overrides,
  };
}

function candidate(o: CRECitedObservation, freshness?: E69CandidateInput["freshness"]): E69CandidateInput {
  return { observation: o, freshness };
}

describe("Geography", () => {
  test("exact city match", () => {
    const r = evaluateCandidate(baseRequest(), candidate(obs()));
    expect(r.dimensions.geographyMatch.level).toBe("exact");
    expect(r.decision).toBe("INCLUDED");
  });

  test("same metro, different city -> approximate, never exact", () => {
    const r = evaluateCandidate(
      baseRequest({ geography: { country: "US", metro: "Houston Metro", city: "Houston" } }),
      candidate(obs({ geography: { country: "US", metro: "Houston Metro", city: "Sugar Land" } })),
    );
    expect(r.dimensions.geographyMatch.level).toBe("approximate");
    expect(r.decision).toBe("INCLUDED");
  });

  test("wrong city, no shared metro -> unsupported, excluded", () => {
    const r = evaluateCandidate(
      baseRequest({ geography: { country: "US", city: "Houston" } }),
      candidate(obs({ geography: { country: "US", city: "Miami" } })),
    );
    expect(r.dimensions.geographyMatch.level).toBe("unsupported");
    expect(r.decision).toBe("EXCLUDED");
    expect(r.exclusionReasonCode).toBe("WRONG_GEOGRAPHY");
  });

  test("exact submarket match", () => {
    const r = evaluateCandidate(
      baseRequest({ geography: { country: "US", city: "Houston", submarket: "Galleria" } }),
      candidate(obs({ geography: { country: "US", city: "Houston", submarket: "Galleria" } })),
    );
    expect(r.dimensions.geographyMatch.level).toBe("exact");
  });

  test("city-level observation never auto-promoted to exact submarket match", () => {
    const r = evaluateCandidate(
      baseRequest({ geography: { country: "US", city: "Houston", submarket: "Galleria" } }),
      candidate(obs({ geography: { country: "US", city: "Houston" } })),
    );
    expect(r.dimensions.geographyMatch.level).toBe("approximate");
    expect(r.dimensions.geographyMatch.level).not.toBe("exact");
  });

  test("different submarket within same city -> unsupported", () => {
    const r = evaluateCandidate(
      baseRequest({ geography: { country: "US", city: "Houston", submarket: "Galleria" } }),
      candidate(obs({ geography: { country: "US", city: "Houston", submarket: "Downtown" } })),
    );
    expect(r.dimensions.geographyMatch.level).toBe("unsupported");
  });

  test("wrong country -> unsupported", () => {
    const r = evaluateCandidate(
      baseRequest({ geography: { country: "US", city: "Houston" } }),
      candidate(obs({ geography: { country: "CA", city: "Houston" } })),
    );
    expect(r.dimensions.geographyMatch.level).toBe("unsupported");
  });
});

describe("Geography type (downtown/suburban/urban)", () => {
  test("exact downtown/cbd match", () => {
    const r = evaluateCandidate(
      baseRequest({ assetClass: "office", locationType: "cbd" }),
      candidate(obs({ assetClass: "office", locationType: "cbd" })),
    );
    expect(r.dimensions.geographyTypeMatch.level).toBe("exact");
  });

  test("suburban requested, downtown/cbd observed -> unsupported mismatch", () => {
    const r = evaluateCandidate(
      baseRequest({ assetClass: "office", locationType: "suburban" }),
      candidate(obs({ assetClass: "office", locationType: "cbd" })),
    );
    expect(r.dimensions.geographyTypeMatch.level).toBe("unsupported");
    expect(r.decision).toBe("EXCLUDED");
    expect(r.exclusionReasonCode).toBe("WRONG_GEOGRAPHY_TYPE");
  });

  test("infill (urban) requested vs suburban observed -> unsupported, never close", () => {
    const r = evaluateCandidate(
      baseRequest({ assetClass: "office", locationType: "urban" }),
      candidate(obs({ assetClass: "office", locationType: "suburban" })),
    );
    expect(r.dimensions.geographyTypeMatch.level).toBe("unsupported");
  });

  test("urban standing in for cbd is approximate, never close (mirrors mapping.ts precedent)", () => {
    const r = evaluateCandidate(
      baseRequest({ assetClass: "office", locationType: "cbd" }),
      candidate(obs({ assetClass: "office", locationType: "urban" })),
    );
    expect(r.dimensions.geographyTypeMatch.level).toBe("approximate");
  });

  test("unspecified locationType on the observation is never assumed to match", () => {
    const r = evaluateCandidate(
      baseRequest({ assetClass: "office", locationType: "cbd" }),
      candidate(obs({ assetClass: "office", locationType: undefined })),
    );
    expect(r.dimensions.geographyTypeMatch.level).toBe("approximate");
  });

  test("request not pinning locationType leaves the dimension not_constrained", () => {
    const r = evaluateCandidate(baseRequest({ assetClass: "office" }), candidate(obs({ assetClass: "office", locationType: "suburban" })));
    expect(r.dimensions.geographyTypeMatch.level).toBe("not_constrained");
  });
});

describe("Property class", () => {
  test("exact Class A match", () => {
    const r = evaluateCandidate(baseRequest({ propertyClass: "A" }), candidate(obs({ propertyClass: "A" })));
    expect(r.dimensions.classMatch.level).toBe("exact");
  });

  test("Class A requested, Class B observed -> unsupported, never close", () => {
    const r = evaluateCandidate(baseRequest({ propertyClass: "A" }), candidate(obs({ propertyClass: "B" })));
    expect(r.dimensions.classMatch.level).toBe("unsupported");
    expect(r.decision).toBe("EXCLUDED");
    expect(r.exclusionReasonCode).toBe("WRONG_PROPERTY_CLASS");
  });

  test("Class A requested, Class C observed -> unsupported (A is never close to C)", () => {
    const r = evaluateCandidate(baseRequest({ propertyClass: "A" }), candidate(obs({ propertyClass: "C" })));
    expect(r.dimensions.classMatch.level).toBe("unsupported");
  });

  test("unspecified class on observation is never silently treated as Class B", () => {
    const r = evaluateCandidate(baseRequest({ propertyClass: "B" }), candidate(obs({ propertyClass: "unspecified" })));
    expect(r.dimensions.classMatch.level).toBe("approximate");
    expect(r.decision).toBe("INCLUDED");
  });

  test("request not pinning class leaves the dimension not_constrained", () => {
    const r = evaluateCandidate(baseRequest(), candidate(obs({ propertyClass: undefined })));
    expect(r.dimensions.classMatch.level).toBe("not_constrained");
  });
});

describe("Asset type", () => {
  test("exact asset type match", () => {
    const r = evaluateCandidate(baseRequest({ assetClass: "industrial" }), candidate(obs({ assetClass: "industrial" })));
    expect(r.dimensions.assetMatch.level).toBe("exact");
  });

  test("wrong asset type -> unsupported, excluded, never folded into another category", () => {
    const r = evaluateCandidate(baseRequest({ assetClass: "office" }), candidate(obs({ assetClass: "multifamily" })));
    expect(r.dimensions.assetMatch.level).toBe("unsupported");
    expect(r.decision).toBe("EXCLUDED");
    expect(r.exclusionReasonCode).toBe("WRONG_ASSET_TYPE");
  });

  test("asset subtype: exact match", () => {
    const r = evaluateCandidate(
      baseRequest({ assetClass: "office", propertySubtype: "office_prime" }),
      candidate(obs({ assetClass: "office", propertySubtype: "office_prime" })),
    );
    expect(r.dimensions.subtypeMatch.level).toBe("exact");
  });

  test("asset subtype: different subtype -> unsupported (no subtype-family mapping exists yet)", () => {
    const r = evaluateCandidate(
      baseRequest({ assetClass: "office", propertySubtype: "office_prime" }),
      candidate(obs({ assetClass: "office", propertySubtype: "office_secondary" })),
    );
    expect(r.dimensions.subtypeMatch.level).toBe("unsupported");
    expect(r.exclusionReasonCode).toBe("WRONG_ASSET_SUBTYPE");
  });

  test("asset subtype: observation silent on subtype -> approximate, not exact", () => {
    const r = evaluateCandidate(
      baseRequest({ assetClass: "office", propertySubtype: "office_prime" }),
      candidate(obs({ assetClass: "office", propertySubtype: undefined })),
    );
    expect(r.dimensions.subtypeMatch.level).toBe("approximate");
  });
});

describe("Effective period", () => {
  test("exact overlapping period", () => {
    const r = evaluateCandidate(
      baseRequest({ effectivePeriod: { start: "2026-01-01", end: "2026-06-30" } }),
      candidate(obs({ periodStart: "2026-01-01", periodEnd: "2026-06-30" })),
    );
    expect(r.dimensions.periodMatch.level).toBe("exact");
  });

  test("older observation within trailing 12 months -> close", () => {
    const r = evaluateCandidate(
      baseRequest({ effectivePeriod: { start: "2026-07-01", end: "2026-09-01" } }),
      candidate(obs({ periodStart: "2025-10-01", periodEnd: "2025-12-31" })),
    );
    expect(r.dimensions.periodMatch.level).toBe("close");
  });

  test("observation 12-24 months prior -> approximate", () => {
    const r = evaluateCandidate(
      baseRequest({ effectivePeriod: { start: "2026-09-01", end: "2026-09-30" } }),
      candidate(obs({ periodStart: "2025-01-01", periodEnd: "2025-01-31" })),
    );
    expect(r.dimensions.periodMatch.level).toBe("approximate");
  });

  test("observation over 24 months prior -> unsupported", () => {
    const r = evaluateCandidate(
      baseRequest({ effectivePeriod: { start: "2026-09-01", end: "2026-09-30" } }),
      candidate(obs({ periodStart: "2023-01-01", periodEnd: "2023-01-31" })),
    );
    expect(r.dimensions.periodMatch.level).toBe("unsupported");
    expect(r.exclusionReasonCode).toBe("STALE");
  });

  test("request without effectivePeriod leaves the dimension not_constrained", () => {
    const r = evaluateCandidate(baseRequest(), candidate(obs()));
    expect(r.dimensions.periodMatch.level).toBe("not_constrained");
  });
});

describe("Freshness", () => {
  test("stale observation is included, not excluded, when the request pins no minimum freshness", () => {
    const r = evaluateCandidate(baseRequest(), candidate(obs(), "stale"));
    expect(r.dimensions.freshnessMatch.level).toBe("approximate");
    expect(r.decision).toBe("INCLUDED");
  });

  test("historical observation remains a valid, included fact, never deleted/invalidated", () => {
    const r = evaluateCandidate(baseRequest(), candidate(obs(), "historical"));
    expect(r.dimensions.freshnessMatch.level).toBe("approximate");
    expect(r.decision).toBe("INCLUDED");
  });

  test("request pinning minFreshness=recent excludes a stale candidate with reason STALE", () => {
    const r = evaluateCandidate(baseRequest({ minFreshness: "recent" }), candidate(obs(), "stale"));
    expect(r.decision).toBe("EXCLUDED");
    expect(r.exclusionReasonCode).toBe("STALE");
  });

  test("unavailable-source observation, when minFreshness is pinned, excludes with reason UNAVAILABLE", () => {
    const r = evaluateCandidate(baseRequest({ minFreshness: "recent" }), candidate(obs(), "unavailable"));
    expect(r.decision).toBe("EXCLUDED");
    expect(r.exclusionReasonCode).toBe("UNAVAILABLE");
  });

  test("live_current observation is exact on the freshness dimension", () => {
    const r = evaluateCandidate(baseRequest(), candidate(obs(), "live_current"));
    expect(r.dimensions.freshnessMatch.level).toBe("exact");
  });
});

describe("Cap-rate representation / methodology", () => {
  test("pinned capRateType, exact match", () => {
    const r = evaluateCandidate(baseRequest({ capRateType: "stabilized" }), candidate(obs({ capRateType: "stabilized" })));
    expect(r.dimensions.representationMatch.level).toBe("exact");
  });

  test("pinned capRateType, same family different concept -> approximate, disclosed, never averaged silently", () => {
    const r = evaluateCandidate(baseRequest({ capRateType: "stabilized" }), candidate(obs({ capRateType: "going_in" })));
    expect(r.dimensions.representationMatch.level).toBe("approximate");
    expect(r.decision).toBe("INCLUDED");
    expect(r.warnings.some((w) => /never be averaged/.test(w))).toBe(true);
  });

  test("pinned capRateType, different family -> unsupported, never silently substituted", () => {
    const r = evaluateCandidate(baseRequest({ capRateType: "stabilized" }), candidate(obs({ capRateType: "transaction" })));
    expect(r.dimensions.representationMatch.level).toBe("unsupported");
    expect(r.decision).toBe("EXCLUDED");
    expect(r.exclusionReasonCode).toBe("INCOMPATIBLE_REPRESENTATION");
  });

  test("pinned capRateType, observation states none -> unsupported (never assumed compatible)", () => {
    const r = evaluateCandidate(baseRequest({ capRateType: "stabilized" }), candidate(obs({ capRateType: undefined })));
    expect(r.dimensions.representationMatch.level).toBe("unsupported");
  });

  test("no capRateType pinned -> representation dimension not_constrained", () => {
    const r = evaluateCandidate(baseRequest(), candidate(obs({ capRateType: "transaction" })));
    expect(r.dimensions.representationMatch.level).toBe("not_constrained");
  });
});

describe("Missing provenance", () => {
  test("empty citation fields are excluded with INSUFFICIENT_PROVENANCE regardless of otherwise-perfect match", () => {
    const bad = obs({
      citation: {
        sourceName: "",
        reportTitle: "",
        publicationDate: "",
        period: "",
        locator: "",
        sourceUrl: "",
        retrievedAt: "",
      },
    });
    const r = evaluateCandidate(baseRequest(), candidate(bad));
    expect(r.decision).toBe("EXCLUDED");
    expect(r.exclusionReasonCode).toBe("INSUFFICIENT_PROVENANCE");
  });
});

describe("Adversarial: strong metadata never overrides a disqualifying dimension", () => {
  test("a high-source-quality observation of the wrong asset class still resolves excluded", () => {
    const strongButWrongClass = obs({
      assetClass: "office",
      sourceQuality: 99,
      capRateType: "stabilized",
      geography: { country: "US", city: "Houston", submarket: "Galleria" },
      propertyClass: "A",
      locationType: "cbd",
    });
    const r = evaluateCandidate(
      baseRequest({
        assetClass: "multifamily",
        geography: { country: "US", city: "Houston", submarket: "Galleria" },
        propertyClass: "A",
        locationType: "cbd",
        capRateType: "stabilized",
      }),
      candidate(strongButWrongClass, "live_current"),
    );
    expect(r.comparability).toBe("unsupported");
    expect(r.decision).toBe("EXCLUDED");
    expect(r.exclusionReasonCode).toBe("WRONG_ASSET_TYPE");
  });
});

describe("Multi-level matching exposure", () => {
  test("every dimension is populated for every candidate, whether or not constrained", () => {
    const r = evaluateCandidate(baseRequest(), candidate(obs()));
    expect(Object.keys(r.dimensions).sort()).toEqual(
      ["assetMatch", "classMatch", "freshnessMatch", "geographyMatch", "geographyTypeMatch", "periodMatch", "representationMatch", "subtypeMatch"].sort(),
    );
  });

  test("overall comparability is the floor across constrained dimensions, never an average", () => {
    // classMatch approximate (unspecified vs pinned B), geographyMatch exact, assetMatch exact:
    // floor must be approximate, not "mostly exact so round up".
    const r = evaluateCandidate(
      baseRequest({ propertyClass: "B" }),
      candidate(obs({ propertyClass: "unspecified" })),
    );
    expect(r.comparability).toBe("approximate");
  });
});

describe("Audit explanation", () => {
  test("INCLUDED explanation names matched dimensions and tiers", () => {
    const r = evaluateCandidate(baseRequest({ propertyClass: "A" }), candidate(obs({ propertyClass: "A" }), "live_current"));
    expect(r.explanation).toMatch(/^INCLUDED/);
    expect(r.explanation).toMatch(/classMatch=exact/);
    expect(r.explanation).toMatch(/geographyMatch=exact/);
  });

  test("EXCLUDED explanation names the specific mismatch and reason code", () => {
    const r = evaluateCandidate(baseRequest({ assetClass: "office" }), candidate(obs({ assetClass: "retail" })));
    expect(r.explanation).toMatch(/^EXCLUDED \(WRONG_ASSET_TYPE\)/);
    expect(r.explanation).toMatch(/assetMatch=unsupported/);
  });
});

describe("evaluateComparability over a pool", () => {
  test("multiple candidates with different qualification levels split correctly", () => {
    const request = baseRequest({
      assetClass: "office",
      locationType: "cbd",
      propertyClass: "A",
      effectivePeriod: { start: "2026-07-01", end: "2026-09-30" },
    });
    const exact = obs({
      assetClass: "office",
      locationType: "cbd",
      propertyClass: "A",
      periodStart: "2026-07-01",
      periodEnd: "2026-09-30",
    });
    const close = obs({
      assetClass: "office",
      locationType: "cbd",
      propertyClass: "A",
      periodStart: "2025-11-01",
      periodEnd: "2025-12-31",
    });
    const approximate = obs({
      assetClass: "office",
      locationType: "urban",
      propertyClass: "A",
      periodStart: "2026-07-01",
      periodEnd: "2026-09-30",
    });
    const unsupported = obs({
      assetClass: "retail",
      locationType: "cbd",
      propertyClass: "A",
      periodStart: "2026-07-01",
      periodEnd: "2026-09-30",
    });

    const result = evaluateComparability(request, [
      candidate(exact, "live_current"),
      candidate(close, "live_current"),
      candidate(approximate, "live_current"),
      candidate(unsupported, "live_current"),
    ]);

    expect(result.candidates).toHaveLength(4);
    expect(result.included.map((c) => c.comparability).sort()).toEqual(["approximate", "close", "exact"].sort());
    expect(result.excluded).toHaveLength(1);
    expect(result.excluded[0].exclusionReasonCode).toBe("WRONG_ASSET_TYPE");
  });

  test("zero candidates produces an empty, non-throwing result", () => {
    const result = evaluateComparability(baseRequest(), []);
    expect(result.candidates).toHaveLength(0);
    expect(result.included).toHaveLength(0);
    expect(result.excluded).toHaveLength(0);
  });
});

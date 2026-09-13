/**
 * InvestScape™ E85 Phase 4 — qualification propagation, DATA_GAP vs
 * manual-review, and provenance-preservation tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 */
import { evaluateDensity } from "../../src/zoning-land-use-engine/density-evaluation";
import { evaluateUsePermission } from "../../src/zoning-land-use-engine/use-evaluation";
import { E85DensityRule, E85ParcelReference, E85UseRule } from "../../src/zoning-land-use-engine";

function parcel(overrides: Partial<E85ParcelReference> = {}): E85ParcelReference {
  return { parcelReferenceId: "p1", ...overrides };
}

describe("qualification propagation", () => {
  test("a low-precision (bare sourceId, no locator) FSR evidence yields lower evidenceQuality than a precisely-cited one", () => {
    const precise: E85DensityRule = {
      family: "DENSITY",
      jurisdictionId: "jx",
      zoneDesignation: "Z1",
      maxFsr: { value: 1.0, provenance: { sourceId: "s", documentLocator: { section: "3.1" } }, temporal: { effectiveDateBasis: "SOURCE_STATED" } },
    };
    const bare: E85DensityRule = {
      family: "DENSITY",
      jurisdictionId: "jx",
      zoneDesignation: "Z1",
      maxFsr: { value: 1.0, provenance: { sourceId: "s" }, temporal: { effectiveDateBasis: "SOURCE_STATED" } },
    };
    const preciseFinding = evaluateDensity([precise], parcel({ siteAreaSqm: 400 }), "jx", "Z1", "2024-01-01", undefined).find((f) => f.field === "maxFsr");
    const bareFinding = evaluateDensity([bare], parcel({ siteAreaSqm: 400 }), "jx", "Z1", "2024-01-01", undefined).find((f) => f.field === "maxFsr");
    expect(preciseFinding?.qualification?.evidenceQuality).toBe("high");
    expect(bareFinding?.qualification?.evidenceQuality).toBe("low");
  });

  test("a derived GFA never exceeds the qualification of its weakest material input (the FSR evidence)", () => {
    const bare: E85DensityRule = {
      family: "DENSITY",
      jurisdictionId: "jx",
      zoneDesignation: "Z1",
      maxFsr: { value: 1.0, provenance: { sourceId: "s" }, temporal: { effectiveDateBasis: "SOURCE_STATED" } },
    };
    const findings = evaluateDensity([bare], parcel({ siteAreaSqm: 400 }), "jx", "Z1", "2024-01-01", undefined);
    const gfaFinding = findings.find((f) => f.field === "maxRegulatoryGfaSqm");
    expect(gfaFinding?.qualification?.evidenceQuality).toBe("low"); // floored, not upgraded by exact arithmetic
  });

  test("duplicate identical evidence does not boost qualification relative to a single copy", () => {
    const rule: E85DensityRule = {
      family: "DENSITY",
      jurisdictionId: "jx",
      zoneDesignation: "Z1",
      maxFsr: { value: 1.0, provenance: { sourceId: "s" }, temporal: { effectiveDateBasis: "SOURCE_STATED" } },
    };
    const single = evaluateDensity([rule], parcel({ siteAreaSqm: 400 }), "jx", "Z1", "2024-01-01", undefined).find((f) => f.field === "maxFsr");
    const duplicated = evaluateDensity([rule, rule, rule], parcel({ siteAreaSqm: 400 }), "jx", "Z1", "2024-01-01", undefined).find((f) => f.field === "maxFsr");
    expect(single?.qualification).toEqual(duplicated?.qualification);
    expect(single?.outcome).toBe(duplicated?.outcome);
  });
});

describe("DATA_GAP vs manual-review preservation", () => {
  test("DATA_GAP finding never also carries a manual-review reason for the same fact", () => {
    const rule: E85UseRule = {
      family: "USE",
      jurisdictionId: "jx",
      zoneDesignation: "Z1",
      permissions: [{ value: { useCode: "u", status: "PERMITTED" }, provenance: { sourceId: "s" }, temporal: { effectiveDateBasis: "UNKNOWN" } }],
    };
    const f = evaluateUsePermission([rule], parcel(), "jx", "Z1", "u", "2024-01-01");
    expect(f.outcome).toBe("GAP");
    expect(f.manualReview).toBeUndefined();
  });

  test("manual review never collapses to a gap: conflicting evidence stays MANUAL_REVIEW, not GAP", () => {
    const rules: E85UseRule[] = [
      { family: "USE", jurisdictionId: "jx", zoneDesignation: "Z1", permissions: [{ value: { useCode: "u", status: "PERMITTED" }, provenance: { sourceId: "a" }, temporal: { effectiveDateBasis: "SOURCE_STATED" } }] },
      { family: "USE", jurisdictionId: "jx", zoneDesignation: "Z1", permissions: [{ value: { useCode: "u", status: "PROHIBITED" }, provenance: { sourceId: "b" }, temporal: { effectiveDateBasis: "SOURCE_STATED" } }] },
    ];
    const f = evaluateUsePermission(rules, parcel(), "jx", "Z1", "u", "2024-01-01");
    expect(f.outcome).toBe("MANUAL_REVIEW");
    expect(f.gap).toBeUndefined();
  });

  test("UNKNOWN (absence of evidence) never becomes PROHIBITED", () => {
    const f = evaluateUsePermission([], parcel(), "jx", "Z1", "u", "2024-01-01");
    expect((f.resolvedValue as any).status).toBe("UNKNOWN");
    expect((f.resolvedValue as any).status).not.toBe("PROHIBITED");
  });
});

describe("provenance preservation", () => {
  test("resolved use-permission finding retains its source provenance", () => {
    const rule: E85UseRule = {
      family: "USE",
      jurisdictionId: "jx",
      zoneDesignation: "Z1",
      permissions: [{ value: { useCode: "u", status: "PERMITTED" }, provenance: { sourceId: "traceable-source", documentLocator: { section: "9" } }, temporal: { effectiveDateBasis: "SOURCE_STATED" } }],
    };
    const f = evaluateUsePermission([rule], parcel(), "jx", "Z1", "u", "2024-01-01");
    expect((f.resolvedEvidence as any)?.provenance.sourceId).toBe("traceable-source");
  });

  test("derived GFA finding's envelope contribution note documents the FSR x siteArea derivation and preserves the FSR evidence's provenance", () => {
    const rule: E85DensityRule = {
      family: "DENSITY",
      jurisdictionId: "jx",
      zoneDesignation: "Z1",
      maxFsr: { value: 1.0, provenance: { sourceId: "fsr-source", documentLocator: { section: "3.1" } }, temporal: { effectiveDateBasis: "SOURCE_STATED" } },
    };
    const findings = evaluateDensity([rule], parcel({ siteAreaSqm: 400 }), "jx", "Z1", "2024-01-01", undefined);
    const gfa = findings.find((f) => f.field === "maxRegulatoryGfaSqm");
    expect(gfa?.envelopeContribution?.evidence.provenance.sourceId).toBe("fsr-source");
    expect(gfa?.envelopeContribution?.derivationNote).toMatch(/maxFsr/);
    expect(gfa?.envelopeContribution?.derivationNote).toMatch(/siteAreaSqm/);
  });
});

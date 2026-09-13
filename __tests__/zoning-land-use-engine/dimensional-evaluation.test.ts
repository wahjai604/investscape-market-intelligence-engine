/**
 * InvestScape™ E85 Phase 4 — dimensional evaluation tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 * Uses the Phase 3B-validated synthetic fixture values (height 11.5m, 3
 * storeys, front setback 4.9m, coverage 0.50) as input values only.
 */
import { evaluateDimensional, E85DimensionalRule, E85ParcelReference } from "../../src/zoning-land-use-engine";

function parcel(): E85ParcelReference {
  return { parcelReferenceId: "p1" };
}

function dimRule(overrides: Partial<E85DimensionalRule> = {}): E85DimensionalRule {
  return {
    family: "DIMENSIONAL",
    jurisdictionId: "jx",
    zoneDesignation: "R1-1",
    ...overrides,
  };
}

describe("dimensional evaluation", () => {
  test("height, storeys, setback, and coverage each resolve independently", () => {
    const rule = dimRule({
      maxHeightMetres: { value: 11.5, provenance: { sourceId: "s" }, temporal: { effectiveDateBasis: "SOURCE_STATED" } },
      maxStoreys: { value: 3, provenance: { sourceId: "s" }, temporal: { effectiveDateBasis: "SOURCE_STATED" } },
      setbacksMetres: { front: { value: 4.9, provenance: { sourceId: "s" }, temporal: { effectiveDateBasis: "SOURCE_STATED" } } },
      maxSiteCoverageFraction: { value: 0.5, provenance: { sourceId: "s" }, temporal: { effectiveDateBasis: "SOURCE_STATED" } },
    });
    const findings = evaluateDimensional([rule], parcel(), "jx", "R1-1", "2024-01-01");
    expect(findings.find((f) => f.field === "maxHeightMetres")?.resolvedValue).toBe(11.5);
    expect(findings.find((f) => f.field === "maxStoreys")?.resolvedValue).toBe(3);
    expect(findings.find((f) => f.field === "setback:front")?.resolvedValue).toBe(4.9);
    expect(findings.find((f) => f.field === "maxSiteCoverageFraction")?.resolvedValue).toBe(0.5);
  });

  test("frontage resolves as its own independent field", () => {
    const rule = dimRule({
      minFrontageMetres: { value: 15, provenance: { sourceId: "s" }, temporal: { effectiveDateBasis: "SOURCE_STATED" } },
    });
    const findings = evaluateDimensional([rule], parcel(), "jx", "R1-1", "2024-01-01");
    expect(findings.find((f) => f.field === "minFrontageMetres")?.resolvedValue).toBe(15);
  });

  test("a missing required dimension produces no finding at all for that field (not a fabricated 0)", () => {
    const findings = evaluateDimensional([dimRule()], parcel(), "jx", "R1-1", "2024-01-01");
    expect(findings.find((f) => f.field === "maxHeightMetres")).toBeUndefined();
  });

  test("height and storeys never get combined into a derived footprint/GFA field", () => {
    const rule = dimRule({
      maxHeightMetres: { value: 11.5, provenance: { sourceId: "s" }, temporal: { effectiveDateBasis: "SOURCE_STATED" } },
      maxStoreys: { value: 3, provenance: { sourceId: "s" }, temporal: { effectiveDateBasis: "SOURCE_STATED" } },
    });
    const findings = evaluateDimensional([rule], parcel(), "jx", "R1-1", "2024-01-01");
    expect(findings.some((f) => /gfa|footprint|massing/i.test(f.field))).toBe(false);
  });
});

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

describe("dimensional evaluation — current-only anti-look-ahead (Phase 12C.2A)", () => {
  // Synthetic generic evidence only — no real R1-1 dimensional fact carries a proven
  // date (By-law 13817's Schedule A could not be verified as text), so this proves
  // the changed evaluateScalarField path directly without inventing a Vancouver date.
  function datedHeightRule(value: number): E85DimensionalRule {
    return dimRule({
      maxHeightMetres: { value, provenance: { sourceId: "s" }, temporal: { effectiveFrom: "2030-01-01", effectiveDateBasis: "AMENDMENT_DATE_KNOWN" } },
    });
  }

  test("the day before the proven effective date, the current value does not leak backward and produces an honest historical gap, never silence", () => {
    const findings = evaluateDimensional([datedHeightRule(11.5)], parcel(), "jx", "R1-1", "2029-12-31");
    const finding = findings.find((f) => f.field === "maxHeightMetres");
    expect(finding).toBeDefined();
    expect(finding?.outcome).toBe("GAP");
    expect(finding?.resolvedValue).toBeUndefined();
    expect(finding?.gap?.reasonCode).toBe("RULE_NOT_STRUCTURED");
    expect(finding?.gap?.reason).toMatch(/in force as of 2029-12-31/);
  });

  test("on the effective date, the current dimensional value resolves", () => {
    const findings = evaluateDimensional([datedHeightRule(11.5)], parcel(), "jx", "R1-1", "2030-01-01");
    const finding = findings.find((f) => f.field === "maxHeightMetres");
    expect(finding?.outcome).toBe("RESOLVED");
    expect(finding?.resolvedValue).toBe(11.5);
  });

  test("a proposal-scope exclusion remains NO_RULE_FOR_PROPOSAL_SCOPE / no finding, and is never conflated with the historical temporal gap", () => {
    const rule = dimRule({
      maxHeightMetres: {
        value: 11.5,
        provenance: { sourceId: "s" },
        temporal: { effectiveDateBasis: "SOURCE_STATED" },
        applicability: { useCodes: ["duplex"], locators: { useCodes: { section: "x" } } },
      },
    });
    const findings = evaluateDimensional([rule], parcel(), "jx", "R1-1", "2024-01-01", { useCode: "multiple_dwelling", recognizedUseCodes: ["multiple_dwelling", "duplex"] });
    const finding = findings.find((f) => f.field === "maxHeightMetres");
    expect(finding?.outcome).toBe("NO_RULE_FOR_PROPOSAL_SCOPE");
    expect(finding?.gap).toBeUndefined();
  });
});

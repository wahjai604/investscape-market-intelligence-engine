/**
 * InvestScape™ E85 Phase 4 — density/FSR evaluation tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 * Uses the Phase 3B-validated synthetic FSR fixture (1.00) as an input value only.
 */
import { evaluateDensity, E85DensityRule, E85ParcelReference } from "../../src/zoning-land-use-engine";

function parcel(overrides: Partial<E85ParcelReference> = {}): E85ParcelReference {
  return { parcelReferenceId: "p1", ...overrides };
}

function fsrRule(value: number, sourceId = "src-1"): E85DensityRule {
  return {
    family: "DENSITY",
    jurisdictionId: "jx",
    zoneDesignation: "R1-1",
    maxFsr: {
      value,
      provenance: { sourceId, documentLocator: { section: "3.1.1.2" } },
      temporal: { effectiveDateBasis: "PUBLICATION_DATE_INFERRED" },
    },
  };
}

describe("density evaluation", () => {
  test("a single unconditional FSR resolves", () => {
    const findings = evaluateDensity([fsrRule(1.0)], parcel({ siteAreaSqm: 400 }), "jx", "R1-1", "2024-01-01", undefined);
    const fsrFinding = findings.find((f) => f.field === "maxFsr");
    expect(fsrFinding?.resolvedValue).toBe(1.0);
  });

  test("FSR x siteAreaSqm derives maxRegulatoryGfaSqm exactly, no rounding", () => {
    const findings = evaluateDensity([fsrRule(1.0)], parcel({ siteAreaSqm: 371.6 }), "jx", "R1-1", "2024-01-01", undefined);
    const gfa = findings.find((f) => f.field === "maxRegulatoryGfaSqm");
    expect(gfa?.outcome).toBe("RESOLVED");
    expect(gfa?.resolvedValue).toBe(1.0 * 371.6);
  });

  test("missing site area produces REQUIRED_SITE_DIMENSION_MISSING gap scoped to GFA only; FSR itself still resolves", () => {
    const findings = evaluateDensity([fsrRule(1.0)], parcel(), "jx", "R1-1", "2024-01-01", undefined);
    const fsrFinding = findings.find((f) => f.field === "maxFsr");
    const gfaFinding = findings.find((f) => f.field === "maxRegulatoryGfaSqm");
    expect(fsrFinding?.outcome).toBe("RESOLVED");
    expect(gfaFinding?.outcome).toBe("GAP");
    expect(gfaFinding?.gap?.reasonCode).toBe("REQUIRED_SITE_DIMENSION_MISSING");
  });

  test("an explicit GFA cap and a compatible FSR-derived cap are reported as distinct findings, never min()'d", () => {
    const rule: E85DensityRule = {
      ...fsrRule(1.0),
      explicitMaxGfaSqm: {
        value: 300,
        provenance: { sourceId: "src-2", documentLocator: { section: "1.1" } },
        temporal: { effectiveDateBasis: "SOURCE_STATED" },
      },
    };
    const findings = evaluateDensity([rule], parcel({ siteAreaSqm: 500 }), "jx", "R1-1", "2024-01-01", undefined);
    const gfaDerived = findings.find((f) => f.field === "maxRegulatoryGfaSqm");
    const gfaCap = findings.find((f) => f.field === "explicitMaxGfaSqm");
    expect(gfaDerived?.resolvedValue).toBe(500); // FSR-derived: 1.0 x 500
    expect(gfaCap?.resolvedValue).toBe(300); // explicit cap, reported separately
  });

  test("a conditional density bonus is NOT applied when the caller does not affirm the condition", () => {
    const rule: E85DensityRule = {
      ...fsrRule(1.0),
      conditionalBonus: {
        condition: "affordable_housing_provided",
        additionalFsr: {
          value: 0.2,
          provenance: { sourceId: "src-3" },
          temporal: { effectiveDateBasis: "SOURCE_STATED" },
        },
      },
    };
    const findings = evaluateDensity([rule], parcel({ siteAreaSqm: 500 }), "jx", "R1-1", "2024-01-01", undefined);
    const bonus = findings.find((f) => f.field.startsWith("conditionalBonus"));
    expect(bonus?.outcome).toBe("CONDITIONAL_UNRESOLVED");
    const gfa = findings.find((f) => f.field === "maxRegulatoryGfaSqm");
    expect(gfa?.resolvedValue).toBe(500); // unconditional base only, bonus excluded
  });

  test("a conditional density bonus IS applied when the caller affirms the exact condition", () => {
    const rule: E85DensityRule = {
      ...fsrRule(1.0),
      conditionalBonus: {
        condition: "affordable_housing_provided",
        additionalFsr: {
          value: 0.2,
          provenance: { sourceId: "src-3" },
          temporal: { effectiveDateBasis: "SOURCE_STATED" },
        },
      },
    };
    const findings = evaluateDensity([rule], parcel({ siteAreaSqm: 500 }), "jx", "R1-1", "2024-01-01", {
      satisfiedConditions: ["affordable_housing_provided"],
    });
    const bonus = findings.find((f) => f.field.startsWith("conditionalBonus"));
    expect(bonus?.outcome).toBe("RESOLVED");
    expect(bonus?.resolvedValue).toBe(0.2);
  });

  test("conflicting density rules for the same zone escalate to manual review", () => {
    const findings = evaluateDensity([fsrRule(1.0, "src-a"), fsrRule(0.6, "src-b")], parcel({ siteAreaSqm: 500 }), "jx", "R1-1", "2024-01-01", undefined);
    const fsrFinding = findings.find((f) => f.field === "maxFsr");
    expect(fsrFinding?.outcome).toBe("MANUAL_REVIEW");
    expect(fsrFinding?.manualReview?.reasonCode).toBe("CONFLICTING_AUTHORITATIVE_SOURCES");
  });

  test("duplicate identical FSR evidence does not trigger a false conflict", () => {
    const rule = fsrRule(1.0, "src-a");
    const findings = evaluateDensity([rule, rule], parcel({ siteAreaSqm: 500 }), "jx", "R1-1", "2024-01-01", undefined);
    const fsrFinding = findings.find((f) => f.field === "maxFsr");
    expect(fsrFinding?.outcome).toBe("RESOLVED");
    expect(fsrFinding?.resolvedValue).toBe(1.0);
  });
});

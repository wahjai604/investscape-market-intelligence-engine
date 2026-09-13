/**
 * InvestScape™ E85 Phase 3 — Zoning & Land-Use Rules Engine: contract tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Contract-level tests only: no live network, no rule-evaluation logic.
 * Verifies the discriminated unions, taxonomy distinctions, and floor/
 * override helpers behave per Phase 3's mandatory corrections.
 */
import {
  E85Result,
  E85MachineResolvedResult,
  E85DataGapResult,
  E85ManualReviewRequiredResult,
  E85ParcelReference,
  E85Qualification,
  floorQualification,
  floorQualificationTiers,
  E85Override,
  effectiveValue,
  E85UsePermission,
  E85Provenance,
  E85Evidence,
  E85TemporalWindow,
  E85UseRule,
  E85ParkingRule,
  E85DataGap,
  E85ManualReviewRecord,
} from "../../src/zoning-land-use-engine";

function baseParcel(): E85ParcelReference {
  return { parcelReferenceId: "test-parcel-1" };
}

function baseQualification(): E85Qualification {
  return { evidenceQuality: "high", ruleApplicability: "high", parcelMatch: "high" };
}

describe("E85Result discriminated union", () => {
  test("MACHINE_RESOLVED result constructs and compiles with no gaps/reasons fields", () => {
    const result: E85MachineResolvedResult = {
      status: "MACHINE_RESOLVED",
      parcel: baseParcel(),
      qualification: baseQualification(),
      resolvedAt: new Date().toISOString(),
      rulesConsidered: [],
    };
    expect(result.status).toBe("MACHINE_RESOLVED");
    // @ts-expect-error - MACHINE_RESOLVED must not have a gaps field at the type level
    expect(result.gaps).toBeUndefined();
  });

  test("DATA_GAP result cannot masquerade as a numeric envelope result", () => {
    const gap: E85DataGap = {
      reasonCode: "ZONING_NOT_FOUND",
      reason: "No zoning record found for this parcel in any checked source.",
      sourcesChecked: ["test-source"],
      checkedAt: new Date().toISOString(),
    };
    const result: E85DataGapResult = {
      status: "DATA_GAP",
      parcel: baseParcel(),
      qualification: baseQualification(),
      resolvedAt: new Date().toISOString(),
      rulesConsidered: [],
      gaps: [gap],
    };
    expect(result.gaps).toHaveLength(1);
    // A DATA_GAP result's envelope, if present at all, is only ever `partialEnvelope` -
    // there is no field named `envelope` on this variant.
    // @ts-expect-error - DATA_GAP has no `envelope` field, only `partialEnvelope`
    expect(result.envelope).toBeUndefined();
  });

  test("MANUAL_REVIEW_REQUIRED is structurally distinct from DATA_GAP", () => {
    const reviewRecord: E85ManualReviewRecord = {
      // Generic reason code — the jurisdiction-specific label ("CD-1 (245)") is carried
      // in free-text/provenance, never encoded into the reason code itself.
      reasonCode: "SITE_SPECIFIC_ZONING",
      explanation: "Parcel is zoned CD-1 (245) with custom negotiated terms.",
      evidenceConsidered: ["test-source"],
      flaggedAt: new Date().toISOString(),
    };
    const result: E85ManualReviewRequiredResult = {
      status: "MANUAL_REVIEW_REQUIRED",
      parcel: baseParcel(),
      qualification: baseQualification(),
      resolvedAt: new Date().toISOString(),
      rulesConsidered: [],
      reasons: [reviewRecord],
    };
    expect(result.reasons[0].reasonCode).toBe("SITE_SPECIFIC_ZONING");
    // @ts-expect-error - MANUAL_REVIEW_REQUIRED has no `gaps` field, only `reasons`
    expect(result.gaps).toBeUndefined();
  });

  test("a function accepting E85Result must narrow by status before reading variant-specific fields", () => {
    function describe(result: E85Result): string {
      switch (result.status) {
        case "MACHINE_RESOLVED":
          return "resolved";
        case "MACHINE_RESOLVED_WITH_WARNINGS":
          return `resolved with ${result.warnings.length} warnings`;
        case "MANUAL_REVIEW_REQUIRED":
          return `needs review: ${result.reasons.length} reasons`;
        case "DATA_GAP":
          return `gap: ${result.gaps.length} gaps`;
      }
    }
    const resolved: E85MachineResolvedResult = {
      status: "MACHINE_RESOLVED",
      parcel: baseParcel(),
      qualification: baseQualification(),
      resolvedAt: new Date().toISOString(),
      rulesConsidered: [],
    };
    expect(describe(resolved)).toBe("resolved");
  });
});

describe("use-permission taxonomy", () => {
  test("UNKNOWN is distinct from PROHIBITED", () => {
    const unknown: E85UsePermission = { useCode: "daycare", status: "UNKNOWN" };
    const prohibited: E85UsePermission = { useCode: "heavy_industrial", status: "PROHIBITED", rawSourceTerminology: "Not Permitted" };
    expect(unknown.status).not.toBe(prohibited.status);
    expect(unknown.status).toBe("UNKNOWN");
    expect(prohibited.status).toBe("PROHIBITED");
  });

  test("normalized status and raw source terminology are both preserved", () => {
    const permission: E85UsePermission = {
      useCode: "secondary_suite",
      status: "CONDITIONAL",
      rawSourceTerminology: "Conditional Approval Use",
      approvalAuthority: "Director of Planning",
    };
    expect(permission.status).toBe("CONDITIONAL");
    expect(permission.rawSourceTerminology).toBe("Conditional Approval Use");
  });
});

describe("provenance model", () => {
  test("can represent both a document locator and a GIS locator simultaneously", () => {
    const provenance: E85Provenance = {
      sourceId: "test-vancouver-bylaws",
      documentLocator: { bylawOrDocumentId: "3575", schedule: "RS-1", section: "2", table: "Table 2", page: 3 },
      gisLocator: { gisDatasetId: "test-parcel-layer", gisFeatureId: "abc-123" },
      zoneDesignation: "RS-1",
    };
    expect(provenance.documentLocator?.bylawOrDocumentId).toBe("3575");
    expect(provenance.gisLocator?.gisFeatureId).toBe("abc-123");
  });
});

describe("temporal/version model", () => {
  test("temporal/effective-date metadata can be represented on a rule record's evidence", () => {
    const temporal: E85TemporalWindow = {
      effectiveFrom: "2023-01-01",
      effectiveDateBasis: "SOURCE_STATED",
    };
    const evidence: E85Evidence<number> = {
      value: 0.6,
      provenance: { sourceId: "test-source" },
      temporal,
    };
    expect(evidence.temporal.effectiveDateBasis).toBe("SOURCE_STATED");
    expect(evidence.temporal.effectiveTo).toBeUndefined();
  });
});

describe("qualification model", () => {
  test("the three axes are independently settable", () => {
    const q: E85Qualification = { evidenceQuality: "high", ruleApplicability: "low", parcelMatch: "moderate" };
    expect(q.evidenceQuality).toBe("high");
    expect(q.ruleApplicability).toBe("low");
    expect(q.parcelMatch).toBe("moderate");
  });

  test("floor helper returns the weakest input, never an average", () => {
    expect(floorQualificationTiers("high", "low", "moderate")).toBe("low");
    expect(floorQualificationTiers("high", "high", "high")).toBe("high");
    expect(floorQualificationTiers("very_low", "high")).toBe("very_low");
  });

  test("floorQualification floors exactly the three axes of one record", () => {
    const q: E85Qualification = { evidenceQuality: "high", ruleApplicability: "high", parcelMatch: "very_low" };
    expect(floorQualification(q)).toBe("very_low");
  });
});

describe("override contract", () => {
  test("can hold both a source-derived value and an override value simultaneously without mutating the source-derived one", () => {
    const o: E85Override<number> = {
      sourceDerived: 0.6,
      override: {
        overrideValue: 0.75,
        reason: "Confirmed via pre-application letter from City of Vancouver Planning.",
        overriddenAt: new Date().toISOString(),
        overriddenBy: "test-reviewer",
      },
    };
    expect(o.sourceDerived).toBe(0.6);
    expect(o.override?.overrideValue).toBe(0.75);
    expect(effectiveValue(o)).toBe(0.75);
  });

  test("effectiveValue falls back to sourceDerived when no override is present", () => {
    const o: E85Override<number> = { sourceDerived: 0.6 };
    expect(effectiveValue(o)).toBe(0.6);
  });
});

describe("rule family independence", () => {
  test("a UseRule can exist independently of a ParkingRule without requiring it", () => {
    const useRule: E85UseRule = {
      family: "USE",
      jurisdictionId: "test-ca-bc-vancouver",
      zoneDesignation: "RS-1",
      permissions: [
        {
          value: { useCode: "one_family_dwelling", status: "PERMITTED" },
          provenance: { sourceId: "test-source" },
          temporal: { effectiveDateBasis: "SOURCE_STATED" },
        },
      ],
    };
    // No ParkingRule is required to exist for this jurisdiction/zone for the UseRule to be valid.
    const parkingRule: E85ParkingRule | undefined = undefined;
    expect(useRule.family).toBe("USE");
    expect(parkingRule).toBeUndefined();
  });
});

describe("Phase 3B primary-source validation fixtures (synthetic values derived from local offline evidence, not read from the PDFs at test time)", () => {
  test("E85DensityRule can represent a real Vancouver FSR example (R1-1 Section 3.1.1.2: max FSR 1.00 for a qualifying multiple dwelling)", () => {
    const densityRule: import("../../src/zoning-land-use-engine").E85DensityRule = {
      family: "DENSITY",
      jurisdictionId: "test-ca-bc-vancouver",
      zoneDesignation: "R1-1",
      maxFsr: {
        value: 1.0,
        provenance: {
          sourceId: "test-vancouver-bylaws",
          documentLocator: { schedule: "R1-1", section: "3.1.1.2" },
          zoneDesignation: "R1-1",
        },
        temporal: { effectiveDateBasis: "PUBLICATION_DATE_INFERRED" },
      },
    };
    expect(densityRule.maxFsr?.value).toBe(1.0);
  });

  test("E85DimensionalRule can represent real Vancouver height/storeys/setback/coverage examples (R1-1 Section 3.2.2: 11.5m and 3 storeys, 4.9m front yard, 50% site coverage)", () => {
    const dimensionalRule: import("../../src/zoning-land-use-engine").E85DimensionalRule = {
      family: "DIMENSIONAL",
      jurisdictionId: "test-ca-bc-vancouver",
      zoneDesignation: "R1-1",
      maxHeightMetres: {
        value: 11.5,
        provenance: { sourceId: "test-vancouver-bylaws", documentLocator: { schedule: "R1-1", section: "3.2.2.3" } },
        temporal: { effectiveDateBasis: "PUBLICATION_DATE_INFERRED" },
      },
      maxStoreys: {
        value: 3,
        provenance: { sourceId: "test-vancouver-bylaws", documentLocator: { schedule: "R1-1", section: "3.2.2.3" } },
        temporal: { effectiveDateBasis: "PUBLICATION_DATE_INFERRED" },
      },
      setbacksMetres: {
        front: {
          value: 4.9,
          provenance: { sourceId: "test-vancouver-bylaws", documentLocator: { schedule: "R1-1", section: "3.2.2.4" } },
          temporal: { effectiveDateBasis: "PUBLICATION_DATE_INFERRED" },
        },
      },
      maxSiteCoverageFraction: {
        value: 0.5,
        provenance: { sourceId: "test-vancouver-bylaws", documentLocator: { schedule: "R1-1", section: "3.2.2.7" } },
        temporal: { effectiveDateBasis: "PUBLICATION_DATE_INFERRED" },
      },
    };
    // Height and storeys are confirmed as separate, independently stated concepts by the source
    // (e.g. "8.5 m and 2 storeys" for rear buildings vs. "11.5 m and 3 storeys" for other buildings).
    expect(dimensionalRule.maxHeightMetres?.value).toBe(11.5);
    expect(dimensionalRule.maxStoreys?.value).toBe(3);
    expect(dimensionalRule.setbacksMetres?.front.value).toBe(4.9);
    expect(dimensionalRule.maxSiteCoverageFraction?.value).toBe(0.5);
  });

  test("raw zone designation preserves CD-1 verbatim while the generic manual-review reason code stays jurisdiction-neutral", () => {
    const parcel: E85ParcelReference = {
      parcelReferenceId: "test-parcel-cd1",
      rawZoningDesignation: "CD-1 (245)",
    };
    const reviewRecord: E85ManualReviewRecord = {
      reasonCode: "SITE_SPECIFIC_ZONING",
      explanation: "Parcel is governed by a comprehensive-development instrument whose terms are set by its own designating by-law, not a standard district schedule.",
      evidenceConsidered: ["test-vancouver-bylaws"],
      flaggedAt: new Date().toISOString(),
    };
    expect(parcel.rawZoningDesignation).toBe("CD-1 (245)");
    expect(reviewRecord.reasonCode).not.toMatch(/CD-?1/i);
  });

  test("E85DocumentLocator can cite a district schedule + section + page precisely enough for independent human lookup (CD-1 Section 1.1)", () => {
    const provenance: E85Provenance = {
      sourceId: "test-vancouver-bylaws",
      documentLocator: { schedule: "CD-1", section: "1.1", page: 1 },
      zoneDesignation: "CD-1 (245)",
      effectiveDateBasisNote: "Consolidation date printed on district schedule cover page.",
    };
    expect(provenance.documentLocator?.schedule).toBe("CD-1");
    expect(provenance.documentLocator?.section).toBe("1.1");
    expect(provenance.documentLocator?.page).toBe(1);
  });

  test("E85ParkingRule can distinguish vehicle parking from bicycle parking via keyed use categories (Parking By-law Sections 4 vehicle / 6 bicycle are distinct sections)", () => {
    const parkingRule: E85ParkingRule = {
      family: "PARKING",
      jurisdictionId: "test-ca-bc-vancouver",
      zoneDesignation: "R1-1",
      minSpacesPerUse: {
        dwelling_unit_vehicle: {
          value: 1,
          provenance: { sourceId: "test-vancouver-parking-bylaw", documentLocator: { section: "4" } },
          temporal: { effectiveDateBasis: "SOURCE_STATED" },
        },
        dwelling_unit_bicycle: {
          value: 1,
          provenance: { sourceId: "test-vancouver-parking-bylaw", documentLocator: { section: "6" } },
          temporal: { effectiveDateBasis: "SOURCE_STATED" },
        },
      },
    };
    expect(Object.keys(parkingRule.minSpacesPerUse ?? {})).toEqual(
      expect.arrayContaining(["dwelling_unit_vehicle", "dwelling_unit_bicycle"]),
    );
  });

  test("manual-review taxonomy no longer includes DISCRETIONARY_USE_DETERMINATION (removed as redundant with PROFESSIONAL_INTERPRETATION_REQUIRED per Phase 3B primary-source review)", () => {
    const mod = require("../../src/zoning-land-use-engine");
    const labels = mod.E85_MANUAL_REVIEW_REASON_LABELS;
    expect(Object.keys(labels)).not.toContain("DISCRETIONARY_USE_DETERMINATION");
    expect(Object.keys(labels)).toContain("PROFESSIONAL_INTERPRETATION_REQUIRED");
    expect(Object.keys(labels)).toContain("SITE_SPECIFIC_ZONING");
  });

  test("DATA_GAP and manual-review reason codes remain fully disjoint sets", () => {
    const mod = require("../../src/zoning-land-use-engine");
    const dataGapCodes = Object.keys(mod.E85_DATA_GAP_REASON_LABELS);
    const manualReviewCodes = Object.keys(mod.E85_MANUAL_REVIEW_REASON_LABELS);
    const overlap = dataGapCodes.filter((c: string) => manualReviewCodes.includes(c));
    expect(overlap).toEqual([]);
  });
});

describe("public barrel exports resolve", () => {
  test("module resolves without throwing and exposes expected named exports", () => {
    const mod = require("../../src/zoning-land-use-engine");
    expect(typeof mod.floorQualification).toBe("function");
    expect(typeof mod.floorQualificationTiers).toBe("function");
    expect(typeof mod.effectiveValue).toBe("function");
    expect(typeof mod.formatE85DataGapMessage).toBe("function");
    expect(typeof mod.formatE85ManualReviewMessage).toBe("function");
    expect(typeof mod.computeE85AnalyticalReadiness).toBe("function");
    expect(typeof mod.isMachineResolved).toBe("function");
  });
});

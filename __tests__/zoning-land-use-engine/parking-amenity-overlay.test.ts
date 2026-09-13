/**
 * InvestScape™ E85 Phase 4 — parking, amenity, and overlay evaluation tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 * All parking/amenity numeric values below are synthetic/fictional — never
 * a real-world jurisdiction's actual ratio.
 */
import { evaluateParking, evaluateAmenity } from "../../src/zoning-land-use-engine/parking-amenity-evaluation";
import { evaluateOverlay } from "../../src/zoning-land-use-engine/overlay-evaluation";
import { E85ParkingRule, E85AmenityRule, E85OverlayRule, E85ParcelReference } from "../../src/zoning-land-use-engine";

function parcel(): E85ParcelReference {
  return { parcelReferenceId: "p1" };
}

describe("parking evaluation (synthetic fixtures only)", () => {
  test("a synthetic vehicle parking rule resolves", () => {
    const rule: E85ParkingRule = {
      family: "PARKING",
      jurisdictionId: "jx",
      zoneDesignation: "Z1",
      minSpacesPerUse: {
        dwelling_unit_vehicle: { value: 1.25, provenance: { sourceId: "s" }, temporal: { effectiveDateBasis: "SOURCE_STATED" } },
      },
    };
    const findings = evaluateParking([rule], parcel(), "jx", "Z1", "2024-01-01");
    expect(findings.find((f) => f.field === "minSpacesPerUse:dwelling_unit_vehicle")?.resolvedValue).toBe(1.25);
  });

  test("a synthetic bicycle parking rule resolves independently of vehicle parking", () => {
    const rule: E85ParkingRule = {
      family: "PARKING",
      jurisdictionId: "jx",
      zoneDesignation: "Z1",
      minSpacesPerUse: {
        dwelling_unit_bicycle: { value: 2, provenance: { sourceId: "s" }, temporal: { effectiveDateBasis: "SOURCE_STATED" } },
      },
    };
    const findings = evaluateParking([rule], parcel(), "jx", "Z1", "2024-01-01");
    expect(findings.find((f) => f.field === "minSpacesPerUse:dwelling_unit_bicycle")?.resolvedValue).toBe(2);
  });

  test("no parking rule supplied never becomes a fabricated 0", () => {
    const findings = evaluateParking([], parcel(), "jx", "Z1", "2024-01-01");
    expect(findings).toHaveLength(0);
  });
});

describe("amenity evaluation", () => {
  test("a conditional amenity requirement is not resolved when the condition is not affirmed", () => {
    const rule: E85AmenityRule = {
      family: "AMENITY",
      jurisdictionId: "jx",
      zoneDesignation: "Z1",
      requirements: {
        childcare_sqm: { value: "50 sqm", provenance: { sourceId: "s" }, temporal: { effectiveDateBasis: "SOURCE_STATED" } },
      },
      requirementConditions: { childcare_sqm: "unit_count_over_50" },
    };
    const findings = evaluateAmenity([rule], parcel(), "jx", "Z1", "2024-01-01", undefined);
    expect(findings[0].outcome).toBe("CONDITIONAL_UNRESOLVED");
  });

  test("a conditional amenity requirement resolves once the caller affirms the condition", () => {
    const rule: E85AmenityRule = {
      family: "AMENITY",
      jurisdictionId: "jx",
      zoneDesignation: "Z1",
      requirements: {
        childcare_sqm: { value: "50 sqm", provenance: { sourceId: "s" }, temporal: { effectiveDateBasis: "SOURCE_STATED" } },
      },
      requirementConditions: { childcare_sqm: "unit_count_over_50" },
    };
    const findings = evaluateAmenity([rule], parcel(), "jx", "Z1", "2024-01-01", { satisfiedConditions: ["unit_count_over_50"] });
    expect(findings[0].outcome).toBe("RESOLVED");
    expect(findings[0].resolvedValue).toBe("50 sqm");
  });

  test("missing condition input for a conditional requirement never assumes it is satisfied", () => {
    const rule: E85AmenityRule = {
      family: "AMENITY",
      jurisdictionId: "jx",
      zoneDesignation: "Z1",
      requirements: {
        public_art: { value: "$X per sqm", provenance: { sourceId: "s" }, temporal: { effectiveDateBasis: "SOURCE_STATED" } },
      },
      requirementConditions: { public_art: "development_over_threshold" },
    };
    const findings = evaluateAmenity([rule], parcel(), "jx", "Z1", "2024-01-01", { satisfiedConditions: [] });
    expect(findings[0].outcome).toBe("CONDITIONAL_UNRESOLVED");
  });
});

describe("overlay evaluation", () => {
  test("a supplied overlay rule resolves", () => {
    const rule: E85OverlayRule = {
      family: "OVERLAY",
      jurisdictionId: "jx",
      zoneDesignation: "Z1",
      overlayDesignation: "Test Development Permit Area",
      description: { value: "Requires DP approval", provenance: { sourceId: "s" }, temporal: { effectiveDateBasis: "SOURCE_STATED" } },
    };
    const findings = evaluateOverlay([rule], parcel(), "jx", "Z1", "2024-01-01", undefined);
    expect(findings.find((f) => f.field === "overlay:Test Development Permit Area")?.outcome).toBe("RESOLVED");
  });

  test("overlay flagged as applicable but no rule supplied for it produces OVERLAY_DATA_MISSING", () => {
    const findings = evaluateOverlay([], parcel(), "jx", "Z1", "2024-01-01", { overlaysApplicable: ["Test Heritage Area"] });
    const gap = findings.find((f) => f.outcome === "GAP");
    expect(gap?.gap?.reasonCode).toBe("OVERLAY_DATA_MISSING");
  });

  test("two supplied overlays with unresolved relative precedence escalate to manual review", () => {
    const rules: E85OverlayRule[] = [
      { family: "OVERLAY", jurisdictionId: "jx", zoneDesignation: "Z1", overlayDesignation: "Overlay A" },
      { family: "OVERLAY", jurisdictionId: "jx", zoneDesignation: "Z1", overlayDesignation: "Overlay B" },
    ];
    const findings = evaluateOverlay(rules, parcel(), "jx", "Z1", "2024-01-01", undefined);
    const review = findings.find((f) => f.outcome === "MANUAL_REVIEW");
    expect(review?.manualReview?.reasonCode).toBe("OVERLAY_PRECEDENCE_UNRESOLVED");
  });
});

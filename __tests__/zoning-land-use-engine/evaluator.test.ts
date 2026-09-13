/**
 * InvestScape™ E85 Phase 4 — Rule Normalization & Deterministic Evaluation:
 * evaluator orchestration tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Synthetic fixtures only. No network, no real PDF/API access.
 */
import {
  evaluateZoningAndLandUse,
  E85EvaluationRequest,
  E85RuleRecord,
  E85UseRule,
  E85DensityRule,
  E85ParcelReference,
  E85PolicyVersion,
} from "../../src/zoning-land-use-engine";

function policy(): E85PolicyVersion {
  return { policyVersionId: "test-policy-v1", effectiveFrom: "2020-01-01", concepts: {} };
}

function parcel(overrides: Partial<E85ParcelReference> = {}): E85ParcelReference {
  return { parcelReferenceId: "p1", ...overrides };
}

describe("evaluateZoningAndLandUse — jurisdiction/zone applicability", () => {
  const useRule: E85UseRule = {
    family: "USE",
    jurisdictionId: "test-jx",
    zoneDesignation: "R1-1",
    permissions: [
      {
        value: { useCode: "single_family", status: "PERMITTED" },
        provenance: { sourceId: "src-1", documentLocator: { section: "2.1" } },
        temporal: { effectiveDateBasis: "SOURCE_STATED", effectiveFrom: "2020-01-01" },
      },
    ],
  };

  test("exact jurisdiction+zone match resolves", () => {
    const outcome = evaluateZoningAndLandUse({
      parcel: parcel(),
      jurisdictionId: "test-jx",
      zoneDesignation: "R1-1",
      useCode: "single_family",
      asOfDate: "2024-01-01",
      rules: [useRule],
      requestedAnalyses: ["USE"],
      policyVersion: policy(),
    });
    expect(outcome.usePermission?.status).toBe("PERMITTED");
    expect(outcome.result.status === "MACHINE_RESOLVED" || outcome.result.status === "MACHINE_RESOLVED_WITH_WARNINGS").toBe(true);
  });

  test("R1-1 does not match R1 (no fuzzy matching)", () => {
    const outcome = evaluateZoningAndLandUse({
      parcel: parcel(),
      jurisdictionId: "test-jx",
      zoneDesignation: "R1",
      useCode: "single_family",
      asOfDate: "2024-01-01",
      rules: [useRule],
      requestedAnalyses: ["USE"],
      policyVersion: policy(),
    });
    expect(outcome.usePermission?.status).toBe("UNKNOWN");
  });

  test("unsupported jurisdiction (no matching rules at all) resolves use to UNKNOWN, not a gap by itself (absence-is-unknown invariant)", () => {
    const outcome = evaluateZoningAndLandUse({
      parcel: parcel(),
      jurisdictionId: "nonexistent-jx",
      zoneDesignation: "ZZ",
      useCode: "single_family",
      asOfDate: "2024-01-01",
      rules: [useRule],
      requestedAnalyses: ["USE"],
      policyVersion: policy(),
    });
    expect(outcome.usePermission?.status).toBe("UNKNOWN");
  });
});

describe("evaluateZoningAndLandUse — a fully fictional jurisdiction/zone (genericity proof)", () => {
  test("evaluator is not Vancouver-specific and works for an invented place", () => {
    const rule: E85UseRule = {
      family: "USE",
      jurisdictionId: "fictional-nation-zorptown",
      zoneDesignation: "ZORP-9",
      permissions: [
        {
          value: { useCode: "moon_garden", status: "CONDITIONAL", approvalAuthority: "Zorptown Elder Council" },
          provenance: { sourceId: "zorptown-code", documentLocator: { section: "9.9" } },
          temporal: { effectiveDateBasis: "SOURCE_STATED" },
        },
      ],
    };
    const outcome = evaluateZoningAndLandUse({
      parcel: parcel(),
      jurisdictionId: "fictional-nation-zorptown",
      zoneDesignation: "ZORP-9",
      useCode: "moon_garden",
      asOfDate: "2024-06-01",
      rules: [rule],
      requestedAnalyses: ["USE"],
      policyVersion: policy(),
    });
    expect(outcome.usePermission?.status).toBe("CONDITIONAL");
  });
});

describe("evaluateZoningAndLandUse — scope propagation (DATA_GAP per requested output, not all-or-nothing)", () => {
  test("missing parking evidence does not force overall gap when PARKING was not requested", () => {
    const densityRule: E85DensityRule = {
      family: "DENSITY",
      jurisdictionId: "test-jx",
      zoneDesignation: "R1-1",
      maxFsr: {
        value: 1.0,
        provenance: { sourceId: "src-1", documentLocator: { section: "3.1.1.2" } },
        temporal: { effectiveDateBasis: "PUBLICATION_DATE_INFERRED" },
      },
    };
    const outcome = evaluateZoningAndLandUse({
      parcel: parcel({ siteAreaSqm: 500 }),
      jurisdictionId: "test-jx",
      zoneDesignation: "R1-1",
      useCode: "single_family",
      asOfDate: "2024-01-01",
      rules: [densityRule],
      requestedAnalyses: ["USE", "DENSITY"],
      policyVersion: policy(),
    });
    // USE resolves to UNKNOWN (a warning, not a gap), DENSITY resolves cleanly -> overall should not be DATA_GAP.
    expect(outcome.result.status).not.toBe("DATA_GAP");
  });
});

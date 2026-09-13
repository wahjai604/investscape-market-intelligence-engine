/**
 * InvestScape™ E85 Phase 4 — determinism tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 */
import { evaluateZoningAndLandUse, E85EvaluationRequest, E85RuleRecord, E85UseRule, E85DensityRule, E85PolicyVersion } from "../../src/zoning-land-use-engine";

function policy(): E85PolicyVersion {
  return { policyVersionId: "test-policy-v1", effectiveFrom: "2020-01-01", concepts: {} };
}

function baseRequest(rules: readonly E85RuleRecord[]): E85EvaluationRequest {
  return {
    parcel: { parcelReferenceId: "p1", siteAreaSqm: 400 },
    jurisdictionId: "jx",
    zoneDesignation: "R1-1",
    useCode: "single_family",
    asOfDate: "2024-01-01",
    rules,
    requestedAnalyses: ["USE", "DENSITY", "DIMENSIONAL"],
    policyVersion: policy(),
  };
}

describe("determinism", () => {
  const useRule: E85UseRule = {
    family: "USE",
    jurisdictionId: "jx",
    zoneDesignation: "R1-1",
    permissions: [
      { value: { useCode: "single_family", status: "PERMITTED" }, provenance: { sourceId: "s1" }, temporal: { effectiveDateBasis: "SOURCE_STATED" } },
    ],
  };
  const densityRule: E85DensityRule = {
    family: "DENSITY",
    jurisdictionId: "jx",
    zoneDesignation: "R1-1",
    maxFsr: { value: 1.0, provenance: { sourceId: "s2" }, temporal: { effectiveDateBasis: "SOURCE_STATED" } },
  };

  test("reordering the rules array does not change the result", () => {
    const a = evaluateZoningAndLandUse(baseRequest([useRule, densityRule]));
    const b = evaluateZoningAndLandUse(baseRequest([densityRule, useRule]));
    expect(a.result.status).toBe(b.result.status);
    expect(a.usePermission?.status).toBe(b.usePermission?.status);
    expect(a.resolvedMaxFsr?.value).toBe(b.resolvedMaxFsr?.value);
  });

  test("repeated evaluation of the same request produces the same result (except resolvedAt timestamp)", () => {
    const req = baseRequest([useRule, densityRule]);
    const a = evaluateZoningAndLandUse(req);
    const b = evaluateZoningAndLandUse(req);
    expect(a.result.status).toBe(b.result.status);
    expect(a.usePermission).toEqual(b.usePermission);
  });

  test("a duplicate identical rule in the array does not change the result", () => {
    const a = evaluateZoningAndLandUse(baseRequest([useRule, densityRule]));
    const b = evaluateZoningAndLandUse(baseRequest([useRule, useRule, densityRule, densityRule]));
    expect(a.result.status).toBe(b.result.status);
    expect(a.usePermission?.status).toBe(b.usePermission?.status);
    expect(a.resolvedMaxFsr?.value).toBe(b.resolvedMaxFsr?.value);
  });

  test("evaluator does not mutate its input rules array or parcel object", () => {
    const rulesInput = [useRule, densityRule];
    const parcelInput = { parcelReferenceId: "p1", siteAreaSqm: 400 };
    const rulesSnapshot = JSON.parse(JSON.stringify(rulesInput));
    const parcelSnapshot = JSON.parse(JSON.stringify(parcelInput));
    evaluateZoningAndLandUse({
      parcel: parcelInput,
      jurisdictionId: "jx",
      zoneDesignation: "R1-1",
      useCode: "single_family",
      asOfDate: "2024-01-01",
      rules: rulesInput,
      requestedAnalyses: ["USE", "DENSITY"],
      policyVersion: policy(),
    });
    expect(rulesInput).toEqual(rulesSnapshot);
    expect(parcelInput).toEqual(parcelSnapshot);
  });
});

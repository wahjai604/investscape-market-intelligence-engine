/**
 * InvestScape™ E85 — public entry point and API-safe request/response contract.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Server inputs here are TEST-ONLY: the one-feature R1-1 fixture snapshot and a
 * synthetic parcel, assembled with the same caller-side glue the Phase 13 test
 * uses. They stand in for server-built inputs; nothing here is a production
 * parcel-to-designation path.
 */
import {
  canonicalRulePackFromBundle,
  createE85SpatialAdapterRegistry,
  createE85SpatialDatasetRegistry,
  normalizeE85SpatialSnapshot,
  adapters,
  E85NormalizedRuleBundle,
} from "../../src/zoning-land-use-engine";
import { zoningLandUse } from "../../src";
import {
  createVancouverZoningSpatialAdapter,
  vancouverZoningDataset,
  vancouverZoningLinkPolicyFromLegalBundles,
} from "../../src/zoning-land-use-engine/adapters/spatial/vancouver";
import { SYNTHETIC_PARCEL_IN_R1_1, VANCOUVER_NORMALIZED_AT, VANCOUVER_RESOLVED_AT, VAN_R1_1, vancouverSnapshot } from "./fixtures/vancouver-spatial-snapshot";
import {
  r11Document,
  R1_1_MD_LOT_ON_RECORD_OR_SUBDIVIDED_CONDITION,
  R1_1_MD_REAR_VEHICULAR_ACCESS_CONDITION,
  R1_1_MD_NOT_IN_FLOOD_PLAIN_CONDITION,
  SITE_WEST_OF_ONTARIO_OR_CARRALL_CONDITION,
} from "./fixtures/vancouver-r1-1-facts";

const { parseE85PublicRequest, evaluateE85PublicRequest, buildE85DecisionRequestFromPublic, E85_PUBLIC_SERVER_CONTROLLED_FIELDS } = zoningLandUse;
const { vancouverR11Adapter, VANCOUVER_R1_1_SOURCE, VANCOUVER_R1_1_SOURCE_ID, VANCOUVER_JURISDICTION_ID } = adapters.vancouver;

const AS_OF = "2026-09-14";

function validBody(): Record<string, unknown> {
  return {
    parcel: { parcelId: "test-parcel" },
    useCode: "multiple_dwelling",
    requestedAnalyses: ["DENSITY", "USE", "DIMENSIONAL", "REQUIREMENT", "USE"],
    temporal: { mode: "AS_OF", asOfDate: AS_OF },
    proposal: { dwellingUnitCount: 6, tenureCode: "Other Tenure", buildingRole: "Other Building", frontageMetres: 20 },
    siteArea: { sqm: 700, basis: { kind: "BYLAW_DEFINED_SITE_AREA", deductionStatus: "NONE_APPLICABLE_CONFIRMED", sourceReference: "synthetic test survey" } },
    conditions: {
      satisfied: [R1_1_MD_LOT_ON_RECORD_OR_SUBDIVIDED_CONDITION, R1_1_MD_REAR_VEHICULAR_ACCESS_CONDITION, R1_1_MD_NOT_IN_FLOOD_PLAIN_CONDITION, SITE_WEST_OF_ONTARIO_OR_CARRALL_CONDITION],
    },
  };
}

function parsed(body: unknown = validBody()) {
  const r = parseE85PublicRequest(body);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.request;
}

function errorsOf(body: unknown) {
  const r = parseE85PublicRequest(body);
  if (r.ok) throw new Error("expected rejection");
  return r.errors;
}

/** TEST-ONLY stand-in for server-built inputs. */
function testServerInputs(): zoningLandUse.E85PublicServerInputs {
  const result = vancouverR11Adapter.normalize(r11Document(), VANCOUVER_R1_1_SOURCE);
  if (result.outcome !== "NORMALIZED") throw new Error("expected NORMALIZED");
  const legal: E85NormalizedRuleBundle[] = [result.bundle];
  const registry = createE85SpatialAdapterRegistry([createVancouverZoningSpatialAdapter(vancouverZoningLinkPolicyFromLegalBundles(legal))]);
  if (!registry.ok) throw new Error("adapter registry problems");
  const datasets = createE85SpatialDatasetRegistry([vancouverZoningDataset()]);
  return {
    normalization: normalizeE85SpatialSnapshot(vancouverSnapshot([VAN_R1_1]), datasets, registry.registry, { normalizedAt: VANCOUVER_NORMALIZED_AT }),
    parcelSpatial: SYNTHETIC_PARCEL_IN_R1_1(),
    jurisdictionId: VANCOUVER_JURISDICTION_ID,
    zoneDesignation: "R1-1",
    designationSource: { datasetId: "test-dataset", datasetVersionId: "test-version", snapshotSha256: "0".repeat(64) },
    policyVersion: { policyVersionId: "public-contract-test", effectiveFrom: "2020-01-01", concepts: {} },
    availableRulePacks: legal.map((b) => canonicalRulePackFromBundle(b, "BASE")),
    spatialRegistry: datasets,
    resolvedAt: VANCOUVER_RESOLVED_AT,
    composedAt: "2026-09-14T00:00:00.000Z",
    assembledAt: "2026-09-14T00:00:00.000Z",
  };
}

describe("E85 public request: strict schema", () => {
  test("a valid request parses; analyses are de-duplicated into canonical order", () => {
    const r = parsed();
    expect(r.requestedAnalyses).toEqual(["USE", "DENSITY", "DIMENSIONAL", "REQUIREMENT"]);
    expect(r.temporal).toEqual({ mode: "AS_OF", asOfDate: AS_OF });
    expect(r.parcel).toEqual({ parcelId: "test-parcel" });
  });

  test.each(E85_PUBLIC_SERVER_CONTROLLED_FIELDS.map((f) => [f]))("server-controlled field %s is rejected at the top level", (field) => {
    const errors = errorsOf({ ...validBody(), [field]: "anything" });
    expect(errors).toContainEqual(expect.objectContaining({ code: "SERVER_CONTROLLED_FIELD", path: field }));
  });

  test.each([["zoneDesignation"], ["geometry"], ["jurisdictionId"]])("server-controlled field parcel.%s is rejected", (field) => {
    const errors = errorsOf({ ...validBody(), parcel: { parcelId: "x", [field]: "R1-1" } });
    expect(errors).toContainEqual(expect.objectContaining({ code: "SERVER_CONTROLLED_FIELD", path: `parcel.${field}` }));
  });

  test("unknown fields are rejected at every level, not ignored", () => {
    expect(errorsOf({ ...validBody(), extra: 1 })).toContainEqual(expect.objectContaining({ code: "UNKNOWN_FIELD", path: "extra" }));
    expect(errorsOf({ ...validBody(), temporal: { mode: "AS_OF", asOfDate: AS_OF, tz: "UTC" } })).toContainEqual(expect.objectContaining({ code: "UNKNOWN_FIELD", path: "temporal.tz" }));
    const b = validBody();
    (b.siteArea as { basis: Record<string, unknown> }).basis.verifiedByCity = true;
    expect(errorsOf(b)).toContainEqual(expect.objectContaining({ code: "UNKNOWN_FIELD", path: "siteArea.basis.verifiedByCity" }));
  });

  test("AS_OF with an explicit real calendar date is required", () => {
    const { temporal: _t, ...noTemporal } = validBody();
    expect(errorsOf(noTemporal)).toContainEqual(expect.objectContaining({ code: "MISSING_FIELD", path: "temporal" }));
    expect(errorsOf({ ...validBody(), temporal: { mode: "CURRENT" } })).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "temporal.mode" }), expect.objectContaining({ code: "MISSING_FIELD", path: "temporal.asOfDate" })]),
    );
    for (const bad of ["2026-02-30", "2026-9-14", "2026-09-14T00:00:00Z", 20260914]) {
      expect(errorsOf({ ...validBody(), temporal: { mode: "AS_OF", asOfDate: bad } })).toContainEqual(expect.objectContaining({ path: "temporal.asOfDate" }));
    }
  });

  test("the parcel locator must be exactly one of parcelId or a point with a stated CRS", () => {
    expect(errorsOf({ ...validBody(), parcel: {} })).toContainEqual(expect.objectContaining({ path: "parcel" }));
    expect(errorsOf({ ...validBody(), parcel: { parcelId: "a", point: { x: 1, y: 2, crs: "EPSG:26910" } } })).toContainEqual(expect.objectContaining({ path: "parcel" }));
    expect(errorsOf({ ...validBody(), parcel: { point: { x: 1, y: 2, crs: "EPSG:4326" } } })).toContainEqual(expect.objectContaining({ path: "parcel.point.crs" }));
    expect(parsed({ ...validBody(), parcel: { point: { x: 493456.89, y: 5456030.81, crs: "EPSG:26910" } } }).parcel).toEqual({ point: { x: 493456.89, y: 5456030.81, crs: "EPSG:26910" } });
  });

  test("a site area must say what it measures", () => {
    expect(errorsOf({ ...validBody(), siteArea: { sqm: 700 } })).toContainEqual(expect.objectContaining({ code: "MISSING_FIELD", path: "siteArea.basis" }));
    expect(errorsOf({ ...validBody(), siteArea: { sqm: -1, basis: { kind: "GROSS", deductionStatus: "UNKNOWN" } } })).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "siteArea.sqm" }), expect.objectContaining({ path: "siteArea.basis.kind" })]),
    );
  });

  test("a non-object body is rejected without throwing", () => {
    for (const body of [null, "x", [], 3]) expect(errorsOf(body)).toEqual([expect.objectContaining({ code: "INVALID_BODY" })]);
  });
});

describe("E85 public evaluation: server-controlled evidence, API-safe response", () => {
  const server = testServerInputs();
  const { response, trace } = evaluateE85PublicRequest(server, parsed());

  test("legal and spatial inputs come only from the server; no temporal lineage is ever injected", () => {
    const internal = buildE85DecisionRequestFromPublic(server, parsed());
    expect(internal.zoneDesignation).toBe("R1-1");
    expect(internal.parcel.rawZoningDesignation).toBe("R1-1");
    expect(internal.availableRulePacks).toBe(server.availableRulePacks);
    expect(internal.normalization).toBe(server.normalization);
    expect(internal.temporalRequest).toEqual({ mode: "AS_OF", asOfDate: AS_OF });
    expect("temporalLineageEvidence" in internal).toBe(false);
  });

  test("the engine status passes through verbatim and is never called verified", () => {
    expect(["MACHINE_RESOLVED", "MACHINE_RESOLVED_WITH_WARNINGS", "MANUAL_REVIEW_REQUIRED", "DATA_GAP"]).toContain(response.status);
    const text = JSON.stringify(response);
    expect(text).not.toMatch(/"VERIFIED"/);
    expect(text).not.toMatch(/"status":"[A-Z_]*VERIFIED/);
    for (const status of ["MACHINE_RESOLVED", "MACHINE_RESOLVED_WITH_WARNINGS"] as const) {
      const r = zoningLandUse.toE85PublicResponse({ ...evaluateOnce(), status }, parsed(), server);
      expect(r.statusMeaning).toMatch(/not a City verification or a development entitlement/);
    }
  });

  test("the decision trace stays server-side", () => {
    expect(trace.length).toBeGreaterThan(0);
    expect(Object.keys(response)).not.toContain("trace");
    expect(JSON.stringify(response)).not.toContain('"trace"');
  });

  test("the as-of-only temporal disclosure is carried through, unresolved", () => {
    expect(response.temporal).toEqual({ mode: "AS_OF", asOfDate: AS_OF });
    expect(response.temporalFindings).toContainEqual(expect.objectContaining({ sourceCode: "TEMPORAL_ANALYSIS_NOT_YET_APPLIED", sourceRef: `TEMPORAL_REQUEST:TEMPORAL_ANALYSIS_NOT_YET_APPLIED:AS_OF:${AS_OF}` }));
  });

  test("every field carries its own source provenance and temporal window", () => {
    expect(response.fields.length).toBeGreaterThan(0);
    for (const f of response.fields) {
      expect(f.provenance.sourceId).toBe(VANCOUVER_R1_1_SOURCE_ID);
      expect(f.temporal.effectiveDateBasis).toBeDefined();
    }
  });

  test("site-area-dependent values are labelled as depending on a caller assertion", () => {
    const gfa = response.fields.find((f) => f.field === "maxRegulatoryGfaSqm");
    expect(gfa).toBeDefined();
    expect(gfa?.dependsOnCallerAssertions).toContain("siteArea");
    expect(response.callerAssertions.label).toBe("CALLER_ASSERTED_NOT_CITY_VERIFIED");
    expect(response.callerAssertions.siteArea?.sqm).toBe(700);
  });

  test("practical capacity is NOT_ASSESSED and the designation is attributed to server spatial evidence", () => {
    expect(response.practicalCapacity.status).toBe("NOT_ASSESSED");
    expect(response.designation).toEqual(
      expect.objectContaining({ value: "R1-1", basis: "SERVER_SPATIAL_EVIDENCE", snapshotSha256: "0".repeat(64), featureIds: ["494787"] }),
    );
  });

  test("gaps and blockers are carried through, with the internal gap object reduced to its public fields", () => {
    if (response.status === "DATA_GAP") expect(response.gaps.length + response.blockers.length).toBeGreaterThan(0);
    for (const g of response.gaps) expect(Object.keys(g).sort()).toEqual(expect.arrayContaining(["reason", "reasonCode"]));
    for (const g of response.gaps) expect(Object.keys(g)).not.toContain("sourcesChecked");
  });

  test("while a material blocker is outstanding, every field is UNCONFIRMED_WHILE_BLOCKED and names it", () => {
    expect(response.blockers.length).toBeGreaterThan(0);
    const codes = [...new Set(response.blockers.map((b) => b.sourceCode))].sort();
    for (const f of response.fields) {
      expect(f.standing).toBe("UNCONFIRMED_WHILE_BLOCKED");
      expect(f.blockedBy).toEqual(codes);
    }
  });

  test("the USE outcome is reported verbatim, and conditions it was released on are named on the field", () => {
    expect(response.useOutcome).toMatchObject({ useCode: "multiple_dwelling", valueReported: response.fields.some((f) => f.field === "usePermission") });
    const use = response.fields.find((f) => f.field === "usePermission");
    if (use?.dependsOnCallerAssertions.includes("conditions")) expect(use.requiredConditionIds?.length).toBeGreaterThan(0);
  });

  test("the public response is deterministic for the same inputs", () => {
    expect(evaluateE85PublicRequest(testServerInputs(), parsed()).response).toEqual(response);
  });

  function evaluateOnce() {
    const { assembleE85DecisionPackage } = jest.requireActual("../../src/zoning-land-use-engine") as typeof import("../../src/zoning-land-use-engine");
    return assembleE85DecisionPackage(buildE85DecisionRequestFromPublic(server, parsed()));
  }
});

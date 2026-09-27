/**
 * InvestScape™ E85 — quarantined-polygon point-exclusion proof.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Contains information licensed under the Open Government Licence – Vancouver.
 *
 * Proves the one narrow exception to "a quarantined record is UNDETERMINED":
 * a POINT request in EPSG:26910 that lies outside a refused polygon under every
 * ring reading, and clear of every edge by more than the tolerance, may find
 * that record NON_MATERIAL. Every other case must stay UNDETERMINED and
 * blocking, and the record must stay quarantined throughout.
 *
 * Real record: RM-4 494885, whose interior ring touches its shell at one vertex.
 * Parcels and hand-drawn polygons are SYNTHETIC; none is a civic parcel.
 */
import {
  assembleE85DecisionPackage,
  assessE85DecisionMateriality,
  createE85SpatialAdapterRegistry,
  createE85SpatialDatasetRegistry,
  normalizeE85SpatialSnapshot,
  proveE85PointOutsideQuarantinedPolygon,
  E85_QUARANTINE_POINT_EXCLUSION_PROOF_ID,
  E85DecisionPackage,
  E85Geometry,
  E85ParcelSpatialReference,
  E85RawSpatialFeatureRecord,
  E85RawSpatialSourceSnapshot,
  E85SpatialNormalizationSuccess,
} from "../../src/zoning-land-use-engine";
import { createVancouverZoningSpatialAdapter, vancouverZoningDataset, VANCOUVER_ZONING_CRS, VANCOUVER_ZONING_RELEASE } from "../../src/zoning-land-use-engine/adapters/spatial/vancouver";
import { SYNTHETIC_PARCEL_IN_R1_1, VANCOUVER_NORMALIZED_AT, VANCOUVER_RESOLVED_AT, VAN_R1_1, VAN_RM_4_HOLE_TOUCHES_SHELL, vancouverSnapshot } from "./fixtures/vancouver-spatial-snapshot";

const RM_4 = "494885";
const datasets = () => createE85SpatialDatasetRegistry([vancouverZoningDataset()]);

function normalized(records: readonly E85RawSpatialFeatureRecord[], snap?: E85RawSpatialSourceSnapshot): E85SpatialNormalizationSuccess {
  const registry = createE85SpatialAdapterRegistry([createVancouverZoningSpatialAdapter()]);
  if (!registry.ok) throw new Error("adapter registry problems");
  const result = normalizeE85SpatialSnapshot(snap ?? vancouverSnapshot(records), datasets(), registry.registry, { normalizedAt: VANCOUVER_NORMALIZED_AT });
  if (result.outcome !== "NORMALIZED") throw new Error(`expected NORMALIZED, got ${result.reason}`);
  return result;
}

const point = (x: number, y: number, crsId: string = VANCOUVER_ZONING_CRS.crsId): E85ParcelSpatialReference => ({
  parcelReferenceId: `synthetic-point-${x}-${y}`,
  geometry: { type: "POINT", crs: { ...VANCOUVER_ZONING_CRS, crsId }, coordinates: [x, y] },
});

/** Far outside RM-4: the synthetic R1-1 parcel's centre, ~1.8 km away. */
const FAR_OUTSIDE = point(493456.89, 5456030.81);
/** Inside RM-4's shell, clear of its hole. */
const INSIDE_SHELL = point(495300, 5456350);
/** Inside RM-4's interior ring. */
const INSIDE_HOLE = point(495160, 5456435);
/** The vertex where RM-4's hole touches its shell. */
const ON_CONTACT_VERTEX = point(495203.5878999095, 5456460.076396325);

function decide(parcel: E85ParcelSpatialReference, phase8: E85SpatialNormalizationSuccess = normalized([VAN_R1_1, VAN_RM_4_HOLE_TOUCHES_SHELL])): E85DecisionPackage {
  return assembleE85DecisionPackage({
    decisionId: "quarantine-point-exclusion",
    normalization: phase8,
    parcelSpatial: parcel,
    parcel: {
      parcelReferenceId: parcel.parcelReferenceId,
      jurisdiction: { jurisdictionId: "ca-bc-vancouver", country: "CA", regionCode: "BC", municipality: "Vancouver", regulatoryAuthority: "City of Vancouver", displayName: "City of Vancouver, BC, Canada" },
      rawZoningDesignation: "R1-1",
      siteAreaSqm: 500,
    },
    jurisdictionId: "ca-bc-vancouver",
    zoneDesignation: "R1-1",
    useCode: "single_detached_house",
    asOfDate: "2026-09-14",
    requestedAnalyses: ["USE"],
    policyVersion: { policyVersionId: "quarantine-proof-v1", effectiveFrom: "2020-01-01", concepts: {} },
    availableRulePacks: [],
    spatialRegistry: datasets(),
    resolvedAt: VANCOUVER_RESOLVED_AT,
    assembledAt: "2026-09-14T00:00:00.000Z",
  });
}

const rm4Record = (p: E85DecisionPackage) => p.materiality.find((m) => m.featureId === RM_4 && m.sourcePhase === "SPATIAL_NORMALIZATION");
const rm4Blocks = (p: E85DecisionPackage) => p.blockers.some((b) => b.featureId === RM_4);

/** A hand-drawn record, in the City's spelling, whose topology is chosen per test. SYNTHETIC. */
function syntheticRecord(id: string, coordinates: unknown): E85RawSpatialFeatureRecord {
  return {
    rawFeatureId: id,
    rawAttributes: { object_id: id, zoning_classification: "Residential", zoning_category: "RM", zoning_district: "RM-4", cd_1_number: null },
    rawGeometry: { type: "Polygon", coordinates },
  };
}

describe("the record stays quarantined, and retains its rings only where eligible", () => {
  test("RM-4 is still quarantined, never a feature, never in Phase 7", () => {
    const r = normalized([VAN_R1_1, VAN_RM_4_HOLE_TOUCHES_SHELL]);
    expect(r.features.map((f) => f.featureId)).toEqual(["494787"]);
    expect(r.quarantined.map((q) => q.featureId)).toEqual([RM_4]);
    expect(r.quarantined[0].reasonCodes).toEqual(["GEOMETRY_FAILED_PHASE7_VALIDATION"]);
    expect(decide(FAR_OUTSIDE, r).phase7?.hits.some((h) => h.featureId === RM_4)).toBe(false);
  });

  test("its retained rings are the City's coordinates, verbatim", () => {
    const rings = normalized([VAN_RM_4_HOLE_TOUCHES_SHELL]).quarantined[0].exclusionProofRings;
    const raw = (VAN_RM_4_HOLE_TOUCHES_SHELL.rawGeometry as { coordinates: number[][][] }).coordinates;
    expect(rings?.exterior).toEqual(raw[0]);
    expect(rings?.interiors).toEqual(raw.slice(1));
    expect(rings?.crs).toEqual(VANCOUVER_ZONING_CRS);
    expect(rings?.phase7ProblemCodes).toEqual(["INTERIOR_RING_CROSSES_EXTERIOR"]);
  });
});

describe("inside, outside and edge", () => {
  test("OUTSIDE: a far point finds RM-4 NON_MATERIAL under the named proof, and it no longer blocks", () => {
    const p = decide(FAR_OUTSIDE);
    const m = rm4Record(p);
    expect(m?.materiality).toBe("NON_MATERIAL");
    expect(m?.quarantineExclusionProof?.proofId).toBe(E85_QUARANTINE_POINT_EXCLUSION_PROOF_ID);
    expect(m?.quarantineExclusionProof?.minimumEdgeDistance).toBeGreaterThan(1000);
    expect(m?.spatialRelation).toBeUndefined();
    expect(rm4Blocks(p)).toBe(false);
    // ...and the Phase 8 result still records the problem.
    if (p.phase8.outcome !== "NORMALIZED") throw new Error("expected NORMALIZED");
    expect(p.phase8.quarantined.map((q) => q.featureId)).toEqual([RM_4]);
  });

  test("INSIDE the shell stays UNDETERMINED and blocking", () => {
    const p = decide(INSIDE_SHELL);
    expect(rm4Record(p)?.materiality).toBe("UNDETERMINED");
    expect(rm4Blocks(p)).toBe(true);
  });

  test("INSIDE RM-4's hole is outside under all three readings (the hole is wound opposite to the shell), so the proof holds there too", () => {
    const record = normalized([VAN_RM_4_HOLE_TOUCHES_SHELL]).quarantined[0];
    const result = proveE85PointOutsideQuarantinedPolygon({ parcelGeometry: INSIDE_HOLE.geometry, record, datasetVersionId: VANCOUVER_ZONING_RELEASE });
    expect(result.proven).toBe(true);
    expect(rm4Record(decide(INSIDE_HOLE))?.materiality).toBe("NON_MATERIAL");
  });

  test("INSIDE a same-wound touching hole: nonzero winding reads it as inside, so the proof refuses and it stays UNDETERMINED", () => {
    const sameWinding = syntheticRecord("900010", [
      [[490000, 5450000], [490100, 5450000], [490100, 5450100], [490000, 5450100], [490000, 5450000]],
      [[490000, 5450000], [490040, 5450010], [490010, 5450040], [490000, 5450000]],
    ]);
    const r = normalized([sameWinding]);
    expect(r.quarantined[0].exclusionProofRings?.phase7ProblemCodes).toEqual(["INTERIOR_RING_CROSSES_EXTERIOR"]);
    const inHole = point(490015, 5450015);
    expect(proveE85PointOutsideQuarantinedPolygon({ parcelGeometry: inHole.geometry, record: r.quarantined[0], datasetVersionId: VANCOUVER_ZONING_RELEASE })).toMatchObject({ proven: false, refusal: "POINT_INSIDE_UNDER_SOME_READING" });
    expect(decide(inHole, r).materiality.find((m) => m.featureId === "900010")?.materiality).toBe("UNDETERMINED");
    // ...while a point well outside the same shape is proven.
    expect(decide(FAR_OUTSIDE, r).materiality.find((m) => m.featureId === "900010")?.materiality).toBe("NON_MATERIAL");
  });

  test("ON the contact vertex stays UNDETERMINED", () => {
    expect(rm4Record(decide(ON_CONTACT_VERTEX))?.materiality).toBe("UNDETERMINED");
  });

  test("within the configured tolerance of an edge stays UNDETERMINED, and just beyond it is proven", () => {
    // 5 m east of the easternmost shell edge near [495342.44, 5456308.84]→[495343.05, 5456357.93].
    const near = point(495348, 5456330);
    expect(rm4Record(decide(near))?.materiality).toBe("NON_MATERIAL");
    const record = normalized([VAN_RM_4_HOLE_TOUCHES_SHELL]).quarantined[0];
    const within = proveE85PointOutsideQuarantinedPolygon({ parcelGeometry: near.geometry, record, datasetVersionId: VANCOUVER_ZONING_RELEASE, tolerance: { onSegmentDistance: 10 } });
    expect(within).toMatchObject({ proven: false, refusal: "POINT_WITHIN_TOLERANCE_OF_EDGE" });
    const beyond = proveE85PointOutsideQuarantinedPolygon({ parcelGeometry: near.geometry, record, datasetVersionId: VANCOUVER_ZONING_RELEASE, tolerance: { onSegmentDistance: 1 } });
    expect(beyond.proven).toBe(true);
  });
});

describe("crossings, invalid coordinates and CRS", () => {
  // Shell 0..100; the hole's edge x=50 runs from y=20 to y=120, properly crossing the shell's top edge.
  const CROSSING = syntheticRecord("900001", [
    [[490000, 5450000], [490100, 5450000], [490100, 5450100], [490000, 5450100], [490000, 5450000]],
    [[490050, 5450020], [490080, 5450020], [490050, 5450120], [490050, 5450020]],
  ]);

  test("CROSSING: a hole that properly crosses its shell keeps no rings, and a far point stays UNDETERMINED", () => {
    const r = normalized([CROSSING]);
    expect(r.quarantined[0].reasonCodes).toEqual(["GEOMETRY_FAILED_PHASE7_VALIDATION"]);
    expect(r.quarantined[0].exclusionProofRings).toBeUndefined();
    const p = decide(FAR_OUTSIDE, r);
    expect(p.materiality.find((m) => m.featureId === "900001")?.materiality).toBe("UNDETERMINED");
  });

  test("a refusal that is not interior-ring contact (a self-intersecting shell) keeps no rings", () => {
    const bowTie = syntheticRecord("900002", [[[490000, 5450000], [490100, 5450100], [490100, 5450000], [490000, 5450100], [490000, 5450000]]]);
    const r = normalized([bowTie]);
    expect(r.quarantined[0].exclusionProofRings).toBeUndefined();
    expect(decide(FAR_OUTSIDE, r).materiality.find((m) => m.featureId === "900002")?.materiality).toBe("UNDETERMINED");
  });

  test("INVALID COORDINATE in the source: unreadable geometry keeps no rings and stays UNDETERMINED", () => {
    const threeD = syntheticRecord("900003", [[[490000, 5450000, 1], [490100, 5450000, 1], [490100, 5450100, 1], [490000, 5450000, 1]]]);
    const r = normalized([threeD]);
    expect(r.quarantined[0].reasonCodes).toEqual(["UNSUPPORTED_RAW_GEOMETRY"]);
    expect(r.quarantined[0].exclusionProofRings).toBeUndefined();
    expect(decide(FAR_OUTSIDE, r).materiality.find((m) => m.featureId === "900003")?.materiality).toBe("UNDETERMINED");
  });

  test("INVALID COORDINATE in the request: a non-finite point proves nothing", () => {
    const p = decide({ parcelReferenceId: "bad-point", geometry: { type: "POINT", crs: VANCOUVER_ZONING_CRS, coordinates: [Number.NaN, 5456030] } });
    expect(rm4Record(p)?.materiality).toBe("UNDETERMINED");
  });

  test("CRS: a point in another spelling or another CRS proves nothing", () => {
    expect(rm4Record(decide(point(493456.89, 5456030.81, "EPSG:26910")))?.materiality).toBe("UNDETERMINED");
    expect(rm4Record(decide(point(-123.1, 49.25, "EPSG:4326")))?.materiality).toBe("UNDETERMINED");
    const record = normalized([VAN_RM_4_HOLE_TOUCHES_SHELL]).quarantined[0];
    const noCrs = proveE85PointOutsideQuarantinedPolygon({ parcelGeometry: { type: "POINT", coordinates: [493456.89, 5456030.81] } as unknown as E85Geometry, record, datasetVersionId: VANCOUVER_ZONING_RELEASE });
    expect(noCrs).toMatchObject({ proven: false, refusal: "POINT_CRS_UNSUPPORTED" });
  });

  test("CRS: a snapshot with no declared CRS retains no rings, even when the adapter is called directly", () => {
    const snap = { ...vancouverSnapshot([VAN_RM_4_HOLE_TOUCHES_SHELL]) };
    delete (snap as { declaredCrs?: unknown }).declaredCrs;
    const r = createVancouverZoningSpatialAdapter().normalize(snap, vancouverZoningDataset(), { normalizedAt: VANCOUVER_NORMALIZED_AT });
    if (r.outcome !== "NORMALIZED") throw new Error("expected NORMALIZED");
    expect(r.quarantined[0].exclusionProofRings).toBeUndefined();
  });

  test("CRS: rings in a different CRS from the point are refused, not transformed", () => {
    const record = normalized([VAN_RM_4_HOLE_TOUCHES_SHELL]).quarantined[0];
    const moved = { ...record, exclusionProofRings: { ...record.exclusionProofRings!, crs: { ...VANCOUVER_ZONING_CRS, crsId: "EPSG:3005" } } };
    expect(proveE85PointOutsideQuarantinedPolygon({ parcelGeometry: FAR_OUTSIDE.geometry, record: moved, datasetVersionId: VANCOUVER_ZONING_RELEASE })).toMatchObject({ proven: false, refusal: "CRS_MISMATCH" });
  });
});

describe("polygon parcels, duplicate ids and release changes", () => {
  test("POLYGON PARCEL: a distant polygon parcel is still blocked by RM-4 — the exception is for points only", () => {
    const p = decide(SYNTHETIC_PARCEL_IN_R1_1());
    expect(rm4Record(p)?.materiality).toBe("UNDETERMINED");
    expect(rm4Record(p)?.quarantineExclusionProof).toBeUndefined();
    expect(rm4Blocks(p)).toBe(true);
  });

  test("DUPLICATE ID: conflicting records sharing RM-4's id keep no rings and stay UNDETERMINED", () => {
    const twin: E85RawSpatialFeatureRecord = { ...VAN_RM_4_HOLE_TOUCHES_SHELL, rawAttributes: { ...VAN_RM_4_HOLE_TOUCHES_SHELL.rawAttributes, zoning_district: "RM-3" } };
    const r = normalized([VAN_R1_1, VAN_RM_4_HOLE_TOUCHES_SHELL, twin]);
    expect(r.quarantined.filter((q) => q.featureId === RM_4)).toHaveLength(2);
    expect(r.quarantined.every((q) => q.exclusionProofRings === undefined)).toBe(true);
    const p = decide(FAR_OUTSIDE, r);
    expect(p.materiality.filter((m) => m.featureId === RM_4).every((m) => m.materiality === "UNDETERMINED")).toBe(true);
    expect(rm4Blocks(p)).toBe(true);
  });

  test("DUPLICATE ID: two retained-ring records under one id are not allowed to speak for it", () => {
    const r = normalized([VAN_R1_1, VAN_RM_4_HOLE_TOUCHES_SHELL]);
    const doubled: E85SpatialNormalizationSuccess = { ...r, quarantined: [...r.quarantined, { ...r.quarantined[0], rawRecordRef: `${r.quarantined[0].rawRecordRef}-copy` }] };
    const m = assessE85DecisionMateriality({ phase8: doubled, packResolution: { resolved: [], unresolvedPackIds: [], conflictingPackIds: [], collapsedDuplicatePackIds: [] }, requestedAnalyses: ["USE"], assessedAt: "2026-09-14T00:00:00.000Z", parcelGeometry: FAR_OUTSIDE.geometry });
    expect(m.find((x) => x.featureId === RM_4)?.materiality).toBe("UNDETERMINED");
  });

  test("RELEASE CHANGE: a record from another release proves nothing for this one", () => {
    const record = normalized([VAN_RM_4_HOLE_TOUCHES_SHELL]).quarantined[0];
    expect(proveE85PointOutsideQuarantinedPolygon({ parcelGeometry: FAR_OUTSIDE.geometry, record, datasetVersionId: "2026-07-06-data-processing" })).toMatchObject({ proven: false, refusal: "RELEASE_MISMATCH" });
    const r = normalized([VAN_R1_1, VAN_RM_4_HOLE_TOUCHES_SHELL]);
    const stale: E85SpatialNormalizationSuccess = { ...r, quarantined: r.quarantined.map((q) => ({ ...q, datasetVersionId: "2026-06-22-data-processing" })) };
    expect(rm4Record(decide(FAR_OUTSIDE, stale))?.materiality).toBe("UNDETERMINED");
  });

  test("RELEASE CHANGE: an unverified release is refused whole, so no record is proven against it", () => {
    const registry = createE85SpatialAdapterRegistry([createVancouverZoningSpatialAdapter()]);
    if (!registry.ok) throw new Error("adapter registry problems");
    const result = normalizeE85SpatialSnapshot({ ...vancouverSnapshot([VAN_RM_4_HOLE_TOUCHES_SHELL]), datasetVersionId: "2026-07-06-data-processing" }, datasets(), registry.registry, { normalizedAt: VANCOUVER_NORMALIZED_AT });
    expect(result.outcome).toBe("UNSUPPORTED");
  });

  test("a record withheld for anything besides geometry is refused by the proof itself", () => {
    const record = normalized([VAN_RM_4_HOLE_TOUCHES_SHELL]).quarantined[0];
    expect(proveE85PointOutsideQuarantinedPolygon({ parcelGeometry: FAR_OUTSIDE.geometry, record: { ...record, reasonCodes: ["CONFLICTING_FEATURE_ID"] }, datasetVersionId: VANCOUVER_ZONING_RELEASE })).toMatchObject({ proven: false, refusal: "RECORD_NOT_GEOMETRY_QUARANTINE" });
    expect(proveE85PointOutsideQuarantinedPolygon({ parcelGeometry: FAR_OUTSIDE.geometry, record: { ...record, exclusionProofRings: { ...record.exclusionProofRings!, phase7ProblemCodes: ["RING_SELF_INTERSECTION"] } }, datasetVersionId: VANCOUVER_ZONING_RELEASE })).toMatchObject({ proven: false, refusal: "PROBLEM_CODES_NOT_ELIGIBLE" });
  });
});

describe("determinism", () => {
  test("the proof is deterministic and does not mutate its input", () => {
    const record = Object.freeze(normalized([VAN_RM_4_HOLE_TOUCHES_SHELL]).quarantined[0]);
    const before = JSON.stringify(record);
    const a = proveE85PointOutsideQuarantinedPolygon({ parcelGeometry: FAR_OUTSIDE.geometry, record, datasetVersionId: VANCOUVER_ZONING_RELEASE });
    const b = proveE85PointOutsideQuarantinedPolygon({ parcelGeometry: FAR_OUTSIDE.geometry, record, datasetVersionId: VANCOUVER_ZONING_RELEASE });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(record)).toBe(before);
  });
});

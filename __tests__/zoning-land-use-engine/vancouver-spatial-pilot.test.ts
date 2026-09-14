/**
 * InvestScape™ E85 Phase 10 — City of Vancouver authoritative spatial pilot.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Contains information licensed under the Open Government Licence – Vancouver.
 *
 * The first suite in E85 driven by a REAL publisher's real coordinates. Every
 * zoning polygon below was issued by the City of Vancouver and is reproduced
 * verbatim; every parcel is synthetic and is not a civic parcel.
 *
 * What this proves, and the order it proves it in:
 *
 *   Phase 8  what does the City's layer actually contain?
 *   Phase 7  which of those districts reach this parcel?
 *   Phase 6  how do the reaching instruments interact?
 *   Phase 4  what do the resulting rules permit?
 *   Phase 9  and does any of what went wrong matter TO THIS PARCEL?
 *
 * Offline throughout: no network, no file read, no GIS library, no coordinate
 * transformation, no geometry repair.
 */
import * as fs from "fs";
import * as path from "path";
import {
  assembleE85DecisionPackage,
  createE85SpatialAdapterRegistry,
  createE85SpatialDatasetRegistry,
  normalizeE85SpatialSnapshot,
  resolveE85SpatialApplicability,
  validateE85Geometry,
  E85DecisionPackage,
  E85DecisionRequest,
  E85ParcelReference,
  E85ParcelSpatialReference,
  E85PolicyVersion,
  E85RawSpatialFeatureRecord,
  E85RawSpatialSourceSnapshot,
  E85RegulatorySpatialFeature,
  E85RequestedAnalysis,
  E85RulePack,
  E85SpatialApplicabilityResult,
  E85SpatialNormalizationResult,
  E85SpatialNormalizationSuccess,
} from "../../src/zoning-land-use-engine";
import {
  createVancouverZoningSpatialAdapter,
  vancouverZoningDataset,
  vancouverZoningSpatialAdapter,
  VANCOUVER_CLASSIFICATION_TO_FEATURE_CLASS,
  VANCOUVER_DATA_ACCURACY_STATEMENT,
  VANCOUVER_EXTRACT_CADENCE,
  VANCOUVER_OPEN_DATA_ATTRIBUTION,
  VANCOUVER_SPATIAL_JURISDICTION_ID,
  VANCOUVER_ZONING_CRS,
  VANCOUVER_ZONING_DATASET_ID,
  VANCOUVER_ZONING_DISTRICT_TO_RULE_PACKS,
  VANCOUVER_ZONING_FIELDS,
  VANCOUVER_ZONING_RELEASE,
  VANCOUVER_ZONING_SPATIAL_ADAPTER_ID,
  VANCOUVER_ZONING_SPATIAL_ADAPTER_VERSION,
} from "../../src/zoning-land-use-engine/adapters/spatial/vancouver";
import {
  SYNTHETIC_PARCEL_IN_C_2C,
  SYNTHETIC_PARCEL_IN_CD_1_423,
  SYNTHETIC_PARCEL_IN_R1_1,
  SYNTHETIC_PARCEL_IN_RM_5,
  VANCOUVER_NORMALIZED_AT,
  VANCOUVER_PILOT_RECORDS,
  VANCOUVER_RESOLVED_AT,
  VAN_C_2C,
  VAN_CD_1_423,
  VAN_R1_1,
  VAN_RM_4_HOLE_TOUCHES_SHELL,
  VAN_RM_5_WITH_HOLE,
  vancouverSnapshot,
} from "./fixtures/vancouver-spatial-snapshot";
import { pack, COMPOSED_AT, ZONE, JURISDICTION as PACK_JURISDICTION } from "./fixtures/composition-packs";

const ASSEMBLED_AT = "2026-09-14T00:00:00.000Z";
const ALL_ANALYSES: readonly E85RequestedAnalysis[] = ["USE", "DENSITY", "DIMENSIONAL"];

const datasets = () => createE85SpatialDatasetRegistry([vancouverZoningDataset()]);

function normalize(snap: E85RawSpatialSourceSnapshot = vancouverSnapshot(), adapter = vancouverZoningSpatialAdapter): E85SpatialNormalizationResult {
  const registry = createE85SpatialAdapterRegistry([adapter]);
  if (!registry.ok) throw new Error("adapter registry problems");
  return normalizeE85SpatialSnapshot(snap, datasets(), registry.registry, { normalizedAt: VANCOUVER_NORMALIZED_AT });
}

function normalized(snap: E85RawSpatialSourceSnapshot = vancouverSnapshot(), adapter = vancouverZoningSpatialAdapter): E85SpatialNormalizationSuccess {
  const result = normalize(snap, adapter);
  if (result.outcome !== "NORMALIZED") throw new Error(`expected NORMALIZED, got ${result.reason}`);
  return result;
}

function applicability(features: readonly E85RegulatorySpatialFeature[], parcel: E85ParcelSpatialReference): E85SpatialApplicabilityResult {
  return resolveE85SpatialApplicability({ parcel, features, registry: datasets(), resolvedAt: VANCOUVER_RESOLVED_AT });
}

const featureById = (r: E85SpatialNormalizationSuccess, id: string) => r.features.find((f) => f.featureId === id);
const findingCodesFor = (r: E85SpatialNormalizationSuccess, id: string) => r.findings.filter((f) => f.featureId === id).map((f) => f.code).sort();

/* ------------------------------------------------------------------ *
 * §5 / §10 — what the City's layer actually contains
 * ------------------------------------------------------------------ */

describe("E85 Phase 10 — Phase 8 reads the City of Vancouver's real layer", () => {
  test("the snapshot normalizes, and the adapter stamps its own identity", () => {
    const r = normalized();
    expect(r.outcome).toBe("NORMALIZED");
    expect(r.adapterId).toBe(VANCOUVER_ZONING_SPATIAL_ADAPTER_ID);
    expect(r.adapterVersion).toBe(VANCOUVER_ZONING_SPATIAL_ADAPTER_VERSION);
    expect(r.datasetId).toBe(VANCOUVER_ZONING_DATASET_ID);
    expect(r.datasetVersionId).toBe(VANCOUVER_ZONING_RELEASE);
    expect(r.jurisdictionId).toBe(VANCOUVER_SPATIAL_JURISDICTION_ID);
  });

  test("four of five real records become features; the fifth is quarantined, not dropped and not repaired", () => {
    const r = normalized();
    expect(r.features.map((f) => f.featureId)).toEqual(["494597", "494642", "494787", "495494"]);
    expect(r.quarantined).toHaveLength(1);
    expect(r.quarantined[0].featureId).toBe("494885");
    expect(r.quarantined[0].reasonCodes).toEqual(["GEOMETRY_FAILED_PHASE7_VALIDATION"]);
  });

  test("the quarantined record's coordinates were transcribed unchanged before being refused", () => {
    // The invariant that makes Phase 8 trustworthy: the record failed BECAUSE
    // the City published it that way, not because E85 mangled it on the way in.
    const r = normalized();
    const detail = r.quarantined[0].detail;
    expect(detail).toContain("INTERIOR_RING_CROSSES_EXTERIOR");
    expect(detail).toContain("No repair was attempted");
    // And the source record in hand is still exactly what the City issued.
    const raw = VAN_RM_4_HOLE_TOUCHES_SHELL.rawGeometry as { coordinates: number[][][] };
    expect(raw.coordinates[0][0]).toEqual([495203.5878999095, 5456460.076396325]);
    expect(raw.coordinates[1][0]).toEqual([495203.5878999095, 5456460.076396325]);
  });

  test("the accepted hole and the refused hole differ only in topology — the gate discriminates on real data", () => {
    // RM-5 and RM-4 are both real polygons with interior rings. One passes.
    const r = normalized();
    expect(featureById(r, "494597")?.geometry.type).toBe("POLYGON");
    expect(findingCodesFor(r, "494597")).toContain("FEATURE_NORMALIZED");
    expect(findingCodesFor(r, "494885")).toContain("GEOMETRY_FAILED_PHASE7_VALIDATION");
  });

  test("the RM-5 interior ring survives normalization — holes are never dropped to simplify a shape", () => {
    const g = featureById(normalized(), "494597")?.geometry;
    if (g === undefined || g.type !== "POLYGON") throw new Error("expected a polygon");
    expect(g.interiors).toHaveLength(1);
    expect(g.interiors?.[0][0]).toEqual([490241.2420998161, 5459229.424896339]);
  });

  test("every emitted coordinate is byte-identical to the City's published value", () => {
    const g = featureById(normalized(), "494787")?.geometry;
    if (g === undefined || g.type !== "POLYGON") throw new Error("expected a polygon");
    const raw = (VAN_R1_1.rawGeometry as { coordinates: number[][][] }).coordinates[0];
    expect(g.exterior).toEqual(raw.map((p) => [p[0], p[1]]));
  });

  test("the City's label point is never used as a feature's geometry", () => {
    // geo_point_2d is where a cartographer put a piece of text. A zone is not
    // its label, and substituting one for the other would place a district at
    // a point instead of over an area.
    const g = featureById(normalized(), "494787")?.geometry;
    expect(g?.type).toBe("POLYGON");
    const labelPoint = (VAN_R1_1.rawAttributes as { geo_point_2d: { lon: number } }).geo_point_2d;
    expect(JSON.stringify(g)).not.toContain(String(labelPoint.lon));
  });
});

/* ------------------------------------------------------------------ *
 * §6 — feature identity, at exactly the strength the City documents
 * ------------------------------------------------------------------ */

describe("E85 Phase 10 — feature identity is release-scoped, which is all the City documents", () => {
  test("object_id becomes featureId, and travels with the release it was read from", () => {
    const r = normalized();
    const f = featureById(r, "494787");
    expect(f?.featureId).toBe("494787");
    // Identity in E85 is datasetId + datasetVersionId + featureId. The release
    // is part of the key, so nothing here claims this number means the same
    // ground in the next release — which the City does not state either.
    expect(f?.datasetVersionId).toBe(VANCOUVER_ZONING_RELEASE);
    expect(f?.provenance.datasetVersionId).toBe(VANCOUVER_ZONING_RELEASE);
    expect(f?.provenance.featureId).toBe("494787");
  });

  test("a record with no object_id is quarantined, never given its array position as an identity", () => {
    const anonymous: E85RawSpatialFeatureRecord = {
      rawAttributes: { ...VAN_C_2C.rawAttributes, object_id: null },
      rawGeometry: VAN_C_2C.rawGeometry,
    };
    const r = normalized(vancouverSnapshot([VAN_R1_1, anonymous]));
    expect(r.features.map((f) => f.featureId)).toEqual(["494787"]);
    expect(r.quarantined[0].reasonCodes).toEqual(["FEATURE_ID_MISSING"]);
    expect(r.quarantined[0].featureId).toBeUndefined();
  });

  test("two records claiming one object_id with different geometry are BOTH withheld", () => {
    // The City documents this number as unique. Two records contradicting that
    // is a real conflict, and choosing either would make the answer depend on
    // export order while discarding a published boundary.
    const clash: E85RawSpatialFeatureRecord = { ...VAN_C_2C, rawFeatureId: "494787", rawAttributes: { ...VAN_C_2C.rawAttributes, object_id: "494787" } };
    const r = normalized(vancouverSnapshot([VAN_R1_1, clash]));
    expect(r.features.find((f) => f.featureId === "494787")).toBeUndefined();
    expect(r.quarantined.filter((q) => q.featureId === "494787")).toHaveLength(2);
    expect(r.findings.some((f) => f.code === "CONFLICTING_FEATURE_ID")).toBe(true);
  });

  test("the identical record supplied twice is normalized once, and is not treated as corroboration", () => {
    const r = normalized(vancouverSnapshot([VAN_R1_1, { ...VAN_R1_1 }]));
    expect(r.features.filter((f) => f.featureId === "494787")).toHaveLength(1);
    expect(r.findings.some((f) => f.code === "DUPLICATE_RAW_FEATURE_COLLAPSED")).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * §7 / §8 — release identity and CRS
 * ------------------------------------------------------------------ */

describe("E85 Phase 10 — release identity and CRS say only what the evidence supports", () => {
  test("the release label is the City's DATA-processing state, not its metadata stamp and not a download time", () => {
    expect(VANCOUVER_ZONING_RELEASE).toBe("2026-06-29-data-processing");
    // 2026-09-14 is when the City last processed METADATA. Reusing it would
    // announce a new release of polygons that did not change.
    expect(VANCOUVER_ZONING_RELEASE).not.toContain("2026-09-14");
  });

  test("the depicted boundaries carry NO legal effective date", () => {
    const version = vancouverZoningDataset().versions[0];
    expect(version.publishedDate).toBe("2026-06-29");
    expect(version.effectiveFrom).toBeUndefined();
    expect(version.effectiveDateBasis).toBe("UNKNOWN");
    // And that travels all the way to the feature.
    expect(featureById(normalized(), "494787")?.temporal?.effectiveDateBasis).toBe("UNKNOWN");
  });

  test("an unwitnessed retrieval time stays absent rather than becoming a plausible one", () => {
    expect(vancouverSnapshot().retrievedAt).toBeUndefined();
    expect(featureById(normalized(), "494787")?.provenance.observedAt).toBeUndefined();
  });

  test("the CRS is the City's own spelling from the file's crs member, carried unaltered", () => {
    expect(VANCOUVER_ZONING_CRS.crsId).toBe("urn:ogc:def:crs:EPSG::26910");
    const f = featureById(normalized(), "494787");
    expect(f?.geometry.crs.crsId).toBe("urn:ogc:def:crs:EPSG::26910");
    expect(f?.geometry.crs.units).toBe("metre");
    expect(normalized().readiness.crsDeclared).toBe(true);
  });

  test("a snapshot that declares no CRS is refused outright — no CRS is inferred from the coordinates", () => {
    // This is the honest treatment of the City's WGS84 export, which carries no
    // crs member in the file at all.
    const noCrs = { ...vancouverSnapshot(), declaredCrs: undefined };
    const r = normalize(noCrs);
    expect(r.outcome).toBe("UNSUPPORTED");
    if (r.outcome !== "UNSUPPORTED") throw new Error("expected UNSUPPORTED");
    expect(r.reason).toBe("CRS_UNDECLARED");
    expect(r.gap.reasonCode).toBe("SPATIAL_REFERENCE_MISMATCH");
  });

  test("an unverified release is not adapted on the strength of a similar label", () => {
    const r = normalize({ ...vancouverSnapshot(), datasetVersionId: "2026-09-14-data-processing" });
    expect(r.outcome).toBe("UNSUPPORTED");
  });
});

/* ------------------------------------------------------------------ *
 * §11 / §12 — CD-1 and R1-1
 * ------------------------------------------------------------------ */

describe("E85 Phase 10 — CD-1 is carried, and is never linked to a generic pack", () => {
  test("the production rule-pack link policy is empty, because no Vancouver linkage is established", () => {
    expect(Object.keys(VANCOUVER_ZONING_DISTRICT_TO_RULE_PACKS)).toEqual([]);
  });

  test("the real CD-1 (423) feature keeps its geometry and its designation, and activates nothing", () => {
    const f = featureById(normalized(), "495494");
    expect(f?.zoneDesignation).toBe("CD-1 (423)");
    expect(f?.rulePackIds).toEqual([]);
    expect(f?.geometry.type).toBe("POLYGON");
    expect(findingCodesFor(normalized(), "495494")).toContain("RULE_PACK_LINK_UNRESOLVED");
  });

  test("the CD-1 gap names the missing by-law, and says a number is not one", () => {
    const finding = normalized().findings.find((f) => f.featureId === "495494" && f.code === "RULE_PACK_LINK_UNRESOLVED");
    expect(finding?.message).toContain("CD-1");
    expect(finding?.message).toContain("NOT linked to any shared or generic CD-1 pack");
    expect(finding?.gap?.resolutionHint).toContain("A CD-1 number alone does not identify an enacting by-law.");
  });

  test("cd_1_number never becomes a rule-pack identity or a feature identity", () => {
    const r = normalized();
    const f = featureById(r, "495494");
    expect(f?.featureId).toBe("495494");
    expect(f?.featureId).not.toBe("423");
    expect(f?.rulePackIds).toEqual([]);
    expect(JSON.stringify(f?.rulePackIds)).not.toContain("423");
  });

  test("cd_1_number is preserved in the audit trail, so a reviewer can still chase the instrument", () => {
    const audit = normalized().audits.find((a) => a.featureId === "495494");
    expect(audit?.mappings.some((m) => m.sourceField === VANCOUVER_ZONING_FIELDS.cd1Number && m.sourceValue === "423")).toBe(true);
  });

  test("CD-1 stays in the base-zone slot — the City zoned that ground, and Phase 7 must not report it unzoned", () => {
    expect(VANCOUVER_CLASSIFICATION_TO_FEATURE_CLASS["Comprehensive Development"]).toBe("BASE_ZONE");
    const r = normalized();
    expect(featureById(r, "495494")?.featureClass).toBe("BASE_ZONE");
    const result = applicability(r.features, SYNTHETIC_PARCEL_IN_CD_1_423());
    expect(result.dataGaps.some((g) => g.reasonCode === "ZONING_NOT_FOUND")).toBe(false);
    expect(result.findings.some((f) => f.code === "NO_BASE_ZONE_MATCH")).toBe(false);
  });
});

describe("E85 Phase 10 — R1-1 as the layer designates it", () => {
  test("the real R1-1 record carries the City's own classification and category", () => {
    expect(VAN_R1_1.rawAttributes.zoning_district).toBe("R1-1");
    expect(VAN_R1_1.rawAttributes.zoning_classification).toBe("Residential Inclusive");
    expect(VAN_R1_1.rawAttributes.zoning_category).toBe("R1");
    expect(VAN_R1_1.rawAttributes.cd_1_number).toBeNull();
  });

  test("the R1-1 designation is preserved verbatim, and matches the zone the Phase 5 pilot structured", () => {
    expect(featureById(normalized(), "494787")?.zoneDesignation).toBe("R1-1");
  });

  test("R1-1 activates NO rule pack — the spatial label alone does not establish the governing instrument", () => {
    // The Phase 5 pilot normalized the R1-1 District Schedule's content, but
    // defines no packId. Turning the map label "R1-1" into an identifier would
    // be a naming coincidence standing in for legal evidence.
    const r = normalized();
    expect(featureById(r, "494787")?.rulePackIds).toEqual([]);
    expect(findingCodesFor(r, "494787")).toContain("RULE_PACK_LINK_UNRESOLVED");
  });
});

/* ------------------------------------------------------------------ *
 * §18 — real-source end to end, 8 -> 7 -> 6 -> 4 -> 9
 * ------------------------------------------------------------------ */

function parcelRef(parcelReferenceId: string): E85ParcelReference {
  return {
    parcelReferenceId,
    jurisdiction: {
      jurisdictionId: PACK_JURISDICTION,
      country: "XX",
      regionCode: "YY",
      municipality: "Testburgh",
      regulatoryAuthority: "Testburgh Planning Office",
      displayName: "Testburgh, YY, XX",
    },
    rawZoningDesignation: ZONE,
    siteAreaSqm: 500,
  };
}

/**
 * The rule packs a caller holds.
 *
 * Borrowed from the Phase 6 fixture and stamped with ITS jurisdiction, exactly
 * as the reference Phase 8 e2e does, and for the same reason: the only thing
 * joining a spatial feature to a rule pack is a pack IDENTITY. That the layer's
 * jurisdiction and the pack's can differ at all is the architecture working.
 *
 * NOTHING HERE IS A CLAIM ABOUT VANCOUVER LAW. These packs carry invented
 * numbers and are used to prove that a linkage, once an orchestrator states
 * one, flows through Phases 6 and 4 intact.
 */
const TEST_PACK_ID = "test-only-pack-for-linkage-proof";
const packLibrary = (): readonly E85RulePack[] => [pack({ packId: TEST_PACK_ID, role: "BASE", usePermitted: "dwelling", maxFsr: 1.5, maxHeightMetres: 14 })];

const policy = (): E85PolicyVersion => ({ policyVersionId: "phase10-v1", effectiveFrom: "2020-01-01", concepts: {} });

interface DecideSpec {
  records?: readonly E85RawSpatialFeatureRecord[];
  parcel?: E85ParcelSpatialReference;
  linkPolicy?: Readonly<Record<string, readonly string[]>>;
}

function request(spec: DecideSpec = {}): E85DecisionRequest {
  const parcel = spec.parcel ?? SYNTHETIC_PARCEL_IN_R1_1();
  const adapter = spec.linkPolicy === undefined ? vancouverZoningSpatialAdapter : createVancouverZoningSpatialAdapter(spec.linkPolicy);
  return {
    decisionId: "vancouver-pilot-decision",
    normalization: normalize(vancouverSnapshot(spec.records ?? VANCOUVER_PILOT_RECORDS), adapter),
    parcelSpatial: parcel,
    parcel: parcelRef(parcel.parcelReferenceId),
    jurisdictionId: PACK_JURISDICTION,
    zoneDesignation: ZONE,
    useCode: "dwelling",
    asOfDate: "2026-09-14",
    requestedAnalyses: ALL_ANALYSES,
    policyVersion: policy(),
    availableRulePacks: packLibrary(),
    spatialRegistry: datasets(),
    resolvedAt: VANCOUVER_RESOLVED_AT,
    composedAt: COMPOSED_AT,
    assembledAt: ASSEMBLED_AT,
  };
}

const decide = (spec: DecideSpec = {}): E85DecisionPackage => assembleE85DecisionPackage(request(spec));

describe("E85 Phase 10 — real source through Phase 7", () => {
  test("the synthetic parcel is CONTAINED by the real R1-1 polygon and disjoint from the rest", () => {
    const result = applicability(normalized().features, SYNTHETIC_PARCEL_IN_R1_1());
    const relation = (id: string) => result.hits.find((h) => h.featureId === id)?.relation;
    expect(relation("494787")).toBe("CONTAINS");
    expect(relation("494642")).toBe("DISJOINT");
    expect(relation("495494")).toBe("DISJOINT");
    expect(relation("494597")).toBe("DISJOINT");
  });

  test("features that do not reach the parcel are reported as checked, not omitted", () => {
    const result = applicability(normalized().features, SYNTHETIC_PARCEL_IN_R1_1());
    expect(result.hits).toHaveLength(4);
    expect(result.hits.filter((h) => h.applicability === "DOES_NOT_APPLY")).toHaveLength(3);
  });

  test("each synthetic parcel lands in its own real district — the layer is a partition here", () => {
    const features = normalized().features;
    const containing = (parcel: E85ParcelSpatialReference) =>
      applicability(features, parcel).hits.filter((h) => h.relation === "CONTAINS").map((h) => h.featureId);
    expect(containing(SYNTHETIC_PARCEL_IN_R1_1())).toEqual(["494787"]);
    expect(containing(SYNTHETIC_PARCEL_IN_C_2C())).toEqual(["494642"]);
    expect(containing(SYNTHETIC_PARCEL_IN_CD_1_423())).toEqual(["495494"]);
    expect(containing(SYNTHETIC_PARCEL_IN_RM_5())).toEqual(["494597"]);
  });

  test("the quarantined RM-4 record never reaches Phase 7 at all", () => {
    const result = applicability(normalized().features, SYNTHETIC_PARCEL_IN_R1_1());
    expect(result.hits.some((h) => h.featureId === "494885")).toBe(false);
  });

  test("a feature's spatial provenance names the adapter that produced it", () => {
    const hit = applicability(normalized().features, SYNTHETIC_PARCEL_IN_R1_1()).hits.find((h) => h.featureId === "494787");
    expect(hit?.spatialProvenance.adapterId).toBe(VANCOUVER_ZONING_SPATIAL_ADAPTER_ID);
    expect(hit?.spatialProvenance.publisher).toBe("City of Vancouver");
    expect(hit?.spatialProvenance.datasetId).toBe(VANCOUVER_ZONING_DATASET_ID);
  });
});

/* ------------------------------------------------------------------ *
 * §19 — a real unresolved linkage, weighed against a real parcel
 * ------------------------------------------------------------------ */

describe("E85 Phase 10 — a real feature whose instrument is not structured", () => {
  test("Phase 8 retains geometry, Phase 7 determines the relationship, Phase 9 calls it MATERIAL", () => {
    const p = decide({ parcel: SYNTHETIC_PARCEL_IN_R1_1() });

    // Phase 8: the boundary is kept; only the linkage is missing.
    if (p.phase8.outcome !== "NORMALIZED") throw new Error("expected NORMALIZED");
    expect(p.phase8.features.find((f) => f.featureId === "494787")?.geometry.type).toBe("POLYGON");
    expect(p.phase8.findings.some((f) => f.featureId === "494787" && f.code === "RULE_PACK_LINK_UNRESOLVED")).toBe(true);

    // Phase 7: geometry settled it.
    expect(p.phase7?.hits.find((h) => h.featureId === "494787")?.relation).toBe("CONTAINS");

    // Phase 9: the gap is on the ground this parcel actually sits on.
    expect(p.materiality.some((m) => m.featureId === "494787" && m.materiality === "MATERIAL")).toBe(true);
    expect(p.blockers.some((b) => b.featureId === "494787")).toBe(true);
    expect(p.status).not.toBe("MACHINE_RESOLVED");
    expect(p.status).not.toBe("MACHINE_RESOLVED_WITH_WARNINGS");
  });

  test("no regulatory rule is invented to fill the gap", () => {
    const p = decide({ parcel: SYNTHETIC_PARCEL_IN_R1_1() });
    expect(p.phase7?.applicableRulePackIds).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * §20 — the same gap, on ground this parcel is nowhere near
 * ------------------------------------------------------------------ */

describe("E85 Phase 10 — an unresolved feature disjoint from the parcel is NON_MATERIAL", () => {
  /** Linkage for the parcel's OWN district only, supplied the way orchestration would. */
  const linkPolicy = { "R1-1": [TEST_PACK_ID] };

  test("the global Phase 8 gap is retained in full", () => {
    const p = decide({ parcel: SYNTHETIC_PARCEL_IN_R1_1(), linkPolicy });
    if (p.phase8.outcome !== "NORMALIZED") throw new Error("expected NORMALIZED");
    // CD-1 (423) and the others are still unresolved, and still reported.
    expect(p.phase8.findings.some((f) => f.featureId === "495494" && f.code === "RULE_PACK_LINK_UNRESOLVED")).toBe(true);
    expect(p.phase8.quarantined).toHaveLength(1);
  });

  test("but it is NON_MATERIAL to a parcel it does not reach", () => {
    const p = decide({ parcel: SYNTHETIC_PARCEL_IN_R1_1(), linkPolicy });
    const cd1 = p.materiality.filter((m) => m.featureId === "495494");
    expect(cd1.length).toBeGreaterThan(0);
    expect(cd1.every((m) => m.materiality === "NON_MATERIAL")).toBe(true);
    expect(p.blockers.some((b) => b.featureId === "495494")).toBe(false);
  });

  /**
   * The quarantined RM-4 record is excluded HERE and only here.
   *
   * It is not an inconvenience being tidied away — it is a different question,
   * proven on its own immediately below. A withheld record was never compared
   * against the parcel, so its relevance is UNDETERMINED rather than
   * NON_MATERIAL, and UNDETERMINED blocks. This case asks the narrower
   * question §20 exists for: when the ONLY remaining problems are unresolved
   * features the parcel demonstrably does not reach, does the decision proceed?
   */
  const RECORDS_WITHOUT_THE_REFUSED_POLYGON = [VAN_R1_1, VAN_C_2C, VAN_CD_1_423, VAN_RM_5_WITH_HOLE];

  test("with its own district resolved and nothing else blocking, the decision proceeds and Phase 4 evaluates", () => {
    const p = decide({ parcel: SYNTHETIC_PARCEL_IN_R1_1(), linkPolicy, records: RECORDS_WITHOUT_THE_REFUSED_POLYGON });
    if (p.phase8.outcome !== "NORMALIZED") throw new Error("expected NORMALIZED");
    // The disjoint unresolved features are still there, still unlinked.
    expect(p.phase8.features.filter((f) => f.rulePackIds.length === 0)).toHaveLength(3);
    expect(p.phase7?.applicableRulePackIds).toEqual([TEST_PACK_ID]);
    expect(p.phase4).toBeDefined();
    expect(p.phase4?.usePermission?.status).toBe("PERMITTED");
    expect(p.blockers).toEqual([]);
    expect(p.status).toBe("MACHINE_RESOLVED_WITH_WARNINGS");
  });

  test("a QUARANTINED record is UNDETERMINED, not NON_MATERIAL, and blocks on its own", () => {
    // The distinction the materiality layer exists to protect. "It does not
    // reach this parcel" is a measurement; "it was never measurable" is not,
    // and rounding the second to the first would let a refused boundary
    // disappear from a clean decision.
    const p = decide({ parcel: SYNTHETIC_PARCEL_IN_R1_1(), linkPolicy });
    const refused = p.materiality.filter((m) => m.featureId === "494885");
    expect(refused.length).toBeGreaterThan(0);
    expect(refused.every((m) => m.materiality === "UNDETERMINED")).toBe(true);
    expect(p.blockers.map((b) => b.featureId)).toEqual(["494885"]);
    expect(p.status).toBe("DATA_GAP");
  });

  test("the linkage came from orchestration, never from the label's spelling", () => {
    // Same records, same parcel, no policy: nothing resolves.
    const withoutPolicy = decide({ parcel: SYNTHETIC_PARCEL_IN_R1_1() });
    expect(withoutPolicy.phase7?.applicableRulePackIds).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * §21 — a real CD-1, with no instrument E85 holds
 * ------------------------------------------------------------------ */

describe("E85 Phase 10 — a parcel inside a real CD-1 cannot reach a clean decision", () => {
  test("link unresolved, relation CONTAINS, materiality MATERIAL, decision not clean", () => {
    const p = decide({ parcel: SYNTHETIC_PARCEL_IN_CD_1_423() });

    if (p.phase8.outcome !== "NORMALIZED") throw new Error("expected NORMALIZED");
    expect(p.phase8.features.find((f) => f.featureId === "495494")?.rulePackIds).toEqual([]);
    expect(p.phase8.findings.some((f) => f.featureId === "495494" && f.code === "RULE_PACK_LINK_UNRESOLVED")).toBe(true);

    expect(p.phase7?.hits.find((h) => h.featureId === "495494")?.relation).toBe("CONTAINS");

    expect(p.materiality.some((m) => m.featureId === "495494" && m.materiality === "MATERIAL")).toBe(true);
    expect(p.status).not.toBe("MACHINE_RESOLVED");
    expect(p.status).not.toBe("MACHINE_RESOLVED_WITH_WARNINGS");
  });

  test("even a supplied R1-1 linkage does not rescue a CD-1 parcel", () => {
    // Proof that no generic CD pack is reachable by any route.
    const p = decide({ parcel: SYNTHETIC_PARCEL_IN_CD_1_423(), linkPolicy: { "R1-1": [TEST_PACK_ID] } });
    expect(p.phase7?.applicableRulePackIds).toEqual([]);
    expect(p.status).not.toBe("MACHINE_RESOLVED");
  });

  test("a policy keyed on the CD-1 district is EXACT — it cannot spread across the other 890", () => {
    const p = decide({ parcel: SYNTHETIC_PARCEL_IN_CD_1_423(), linkPolicy: { "CD-1 (423)": [TEST_PACK_ID] } });
    if (p.phase8.outcome !== "NORMALIZED") throw new Error("expected NORMALIZED");
    // Only the one district resolves; the categorical "CD" grouping links nothing.
    expect(p.phase8.features.find((f) => f.featureId === "495494")?.rulePackIds).toEqual([TEST_PACK_ID]);
    const p2 = decide({ parcel: SYNTHETIC_PARCEL_IN_CD_1_423(), linkPolicy: { CD: [TEST_PACK_ID] } });
    if (p2.phase8.outcome !== "NORMALIZED") throw new Error("expected NORMALIZED");
    expect(p2.phase8.features.find((f) => f.featureId === "495494")?.rulePackIds).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * §13 / §22 / §23 — licensing, determinism, and containment
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * Phase 10A — the source definition preserves the evidence-supported
 * metadata distinctions, and does not let any of them drift into a
 * stronger claim.
 * ------------------------------------------------------------------ */

describe("E85 Phase 10A — authoritative source metadata keeps its distinctions", () => {
  test("publisher and dataset identity are the City's own", () => {
    const d = vancouverZoningDataset();
    expect(d.publisher).toBe("City of Vancouver");
    expect(d.datasetId).toBe("ca-bc-vancouver:zoning-districts-and-labels");
    expect(d.jurisdictionId).toBe(VANCOUVER_SPATIAL_JURISDICTION_ID);
    expect(d.datasetType).toBe("BASE_ZONING");
  });

  test("the data-processing state is 2026-06-29 and drives the release label", () => {
    expect(vancouverZoningDataset().versions[0].publishedDate).toBe("2026-06-29");
    expect(VANCOUVER_ZONING_RELEASE).toContain("2026-06-29");
    expect(VANCOUVER_ZONING_RELEASE).toContain("data-processing");
  });

  test("the release label is not presented as a City-issued release number", () => {
    // E85 derives this label from the City's data-processing state. The City has
    // not been shown to publish an immutable formal release id, so nothing may
    // imply one.
    const release = VANCOUVER_ZONING_RELEASE.toLowerCase();
    for (const forbidden of ["v1", "rev", "edition", "official-release"]) expect(release).not.toContain(forbidden);
    // Nor the metadata-processing stamp, nor any local download date.
    expect(release).not.toContain("2026-09-14");
  });

  test("the legal effective date remains UNKNOWN, cadence notwithstanding", () => {
    const v = vancouverZoningDataset().versions[0];
    expect(v.effectiveFrom).toBeUndefined();
    expect(v.effectiveDateBasis).toBe("UNKNOWN");
    expect(featureById(normalized(), "494787")?.temporal?.effectiveDateBasis).toBe("UNKNOWN");
  });

  test("the licence is recorded by name, version and reuse status", () => {
    expect(VANCOUVER_OPEN_DATA_ATTRIBUTION).toContain("Open Government Licence");
    expect(VANCOUVER_OPEN_DATA_ATTRIBUTION).toContain("Vancouver");
    expect(vancouverZoningDataset().licenseStatus).toBe("PUBLIC_REUSE");
    expect(vancouverSnapshot().sourceMetadata?.licenceVersion).toBe("1.0");
  });

  test("the weekly extract cadence is recorded as publication context, never as legal effect", () => {
    // Previously reported as "no stated cadence", which was wrong. It is stated,
    // and stating it must not create a date.
    expect(VANCOUVER_EXTRACT_CADENCE.toLowerCase()).toContain("weekly");
    expect(vancouverSnapshot().sourceMetadata?.cityStatedExtractCadence).toBe("weekly");
    const limitations = vancouverZoningDataset().knownLimitations.join(" ").toLowerCase();
    expect(limitations).toContain("weekly");
    expect(limitations).toContain("no legal effective date");
    // And it did not become one.
    expect(vancouverZoningDataset().versions[0].effectiveDateBasis).toBe("UNKNOWN");
  });

  test("the data-accuracy statement is a source limitation, not a geometry failure", () => {
    expect(VANCOUVER_DATA_ACCURACY_STATEMENT.toLowerCase()).toContain("survey accuracy");
    expect(vancouverZoningDataset().knownLimitations.join(" ").toLowerCase()).toContain("survey accuracy");

    // It changes no outcome: the same four features are accepted and the same
    // one is quarantined, for a topology reason and nothing to do with precision.
    const r = normalized();
    expect(r.features).toHaveLength(4);
    expect(r.quarantined).toHaveLength(1);
    expect(r.quarantined[0].reasonCodes).toEqual(["GEOMETRY_FAILED_PHASE7_VALIDATION"]);
    // And no tolerance was widened anywhere to accommodate it.
    const src = fs.readFileSync(path.join(__dirname, "../../src/zoning-land-use-engine/adapters/spatial/vancouver/vancouver-zoning-source.ts"), "utf8");
    expect(/onSegmentDistance/.test(src)).toBe(false);
  });

  test("the accuracy statement does not downgrade access or licence", () => {
    const d = vancouverZoningDataset();
    expect(d.accessStatus).toBe("AVAILABLE");
    expect(d.licenseStatus).toBe("PUBLIC_REUSE");
  });
});

describe("E85 Phase 10A — topology refusals are described as E85's profile, not as a City defect", () => {
  test("the quarantine detail states an E85 validation outcome", () => {
    const q = normalized().quarantined[0];
    expect(q.reasonCodes).toEqual(["GEOMETRY_FAILED_PHASE7_VALIDATION"]);
    expect(q.detail).toContain("Phase 7 geometry validation");
    expect(q.detail).toContain("No repair was attempted");
  });

  test("no Vancouver file claims the City published invalid geometry", () => {
    // The refusal is a fact about E85's topology profile. Asserting a municipal
    // defect would need independent GIS validity evidence, which E85 never has.
    const dir = path.join(__dirname, "../../src/zoning-land-use-engine/adapters/spatial/vancouver");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".ts"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = fs.readFileSync(path.join(dir, file), "utf8");
      for (const term of [/invalid (?:municipal )?(?:data|polygon|geometry)/i, /\bmalformed by the City\b/i, /City.{0,30}\berror\b/i, /publisher is at fault/i]) {
        // The one permitted occurrence is an explicit disclaimer of the claim.
        const hits = (content.match(new RegExp(term.source, "gi")) ?? []).filter((h) => !/does not conclude|NOT a finding|not asserted|never a verdict/i.test(content.slice(Math.max(0, content.indexOf(h) - 200), content.indexOf(h) + 200)));
        expect({ file, term: term.source, hits }).toEqual({ file, term: term.source, hits: [] });
      }
    }
  });

  test("the known limitation states the quarantine count and disclaims a validity verdict", () => {
    const limitations = vancouverZoningDataset().knownLimitations.join(" ");
    expect(limitations).toContain("11 of the 1,621");
    expect(limitations).toContain("Phase 7 topology profile");
    expect(limitations).toContain("NOT a finding that the City published invalid geometry");
  });
});

describe("E85 Phase 10A — the full-snapshot quarantine consequence is stated, not solved away", () => {
  test("the limitation explains why a complete snapshot can stay blocked", () => {
    const limitations = vancouverZoningDataset().knownLimitations.join(" ");
    expect(limitations).toContain("UNDETERMINED");
    expect(limitations).toContain("COMPLETE municipal snapshot");
  });

  test("and the behaviour it describes is real: a distant quarantined record still blocks", () => {
    // The subject parcel is inside R1-1 and demonstrably far from the refused
    // RM-4 polygon, and the decision is STILL blocked. That is the conservative
    // outcome the limitation warns about, proven rather than asserted.
    const p = decide({ parcel: SYNTHETIC_PARCEL_IN_R1_1(), linkPolicy: { "R1-1": [TEST_PACK_ID] } });
    expect(p.materiality.filter((m) => m.featureId === "494885").every((m) => m.materiality === "UNDETERMINED")).toBe(true);
    expect(p.blockers.map((b) => b.featureId)).toEqual(["494885"]);
    expect(p.status).toBe("DATA_GAP");
  });

  test("Phase 9 is not rescued by reading a quarantined record's raw geometry", () => {
    // Strips comments AND string literals, so this tests the OPERATION rather
    // than the word — the same discipline scope-protection.test.ts uses. Phase 9
    // says out loud that it infers nothing from a withheld record's raw
    // geometry, centroid or bounding box; a blanket scan would fail the file for
    // carrying its own disclaimer and push toward deleting it.
    const executable = (source: string) =>
      source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1")
        .replace(/`(?:[^`\\]|\\.)*`/g, (literal) => (literal.match(/\$\{[^}]*\}/g) ?? []).join(" "))
        .replace(/"(?:[^"\\]|\\.)*"/g, '""')
        .replace(/'(?:[^'\\]|\\.)*'/g, "''");

    const decisionDir = path.join(__dirname, "../../src/zoning-land-use-engine");
    for (const file of ["decision-materiality.ts", "decision-orchestrator.ts"]) {
      const content = executable(fs.readFileSync(path.join(decisionDir, file), "utf8"));
      for (const term of [/rawGeometry/, /boundingBox/i, /centroid/i, /convexHull/i]) {
        expect({ file, term: term.source, found: term.test(content) }).toEqual({ file, term: term.source, found: false });
      }
    }
  });
});

describe("E85 Phase 10 — licensing is recorded as the licence actually states it", () => {
  test("the Open Government Licence – Vancouver is an affirmative grant, so PUBLIC_REUSE is honest", () => {
    const dataset = vancouverZoningDataset();
    expect(dataset.licenseStatus).toBe("PUBLIC_REUSE");
    expect(dataset.accessStatus).toBe("AVAILABLE");
    expect(normalized().readiness.licenseStatus).toBe("PUBLIC_REUSE");
  });

  test("the attribution the licence requires is stated, and travels on the snapshot", () => {
    expect(VANCOUVER_OPEN_DATA_ATTRIBUTION).toContain("Open Government Licence");
    expect(vancouverSnapshot().sourceMetadata?.attribution).toBe(VANCOUVER_OPEN_DATA_ATTRIBUTION);
  });

  test("the dataset's known limitations state the identity limit plainly rather than hiding it", () => {
    const limitations = vancouverZoningDataset().knownLimitations.join(" ");
    expect(limitations).toContain("STABILITY ACROSS RELEASES IS NOT DOCUMENTED AND IS NOT ASSUMED");
    expect(limitations).toContain("no legal effective date");
  });
});

describe("E85 Phase 10 — determinism and containment", () => {
  test("normalization is deterministic for identical input", () => {
    expect(JSON.stringify(normalized())).toBe(JSON.stringify(normalized()));
  });

  test("record order in the payload does not change the output", () => {
    const forward = normalized(vancouverSnapshot(VANCOUVER_PILOT_RECORDS));
    const reversed = normalized(vancouverSnapshot([...VANCOUVER_PILOT_RECORDS].reverse()));
    expect(forward.features.map((f) => f.featureId)).toEqual(reversed.features.map((f) => f.featureId));
    expect(JSON.stringify(forward.features)).toBe(JSON.stringify(reversed.features));
  });

  test("normalization does not mutate the caller's snapshot", () => {
    const snap = vancouverSnapshot();
    const before = JSON.stringify(snap);
    normalize(snap);
    expect(JSON.stringify(snap)).toBe(before);
  });

  test("the full-snapshot data-quality shape holds on this subset: 4 accepted, 1 quarantined, 4 unlinked", () => {
    const r = normalized();
    expect(r.features).toHaveLength(4);
    expect(r.quarantined).toHaveLength(1);
    expect(r.features.filter((f) => f.rulePackIds.length === 0)).toHaveLength(4);
    expect(r.readiness.rulePackLinkageSupported).toBe(false);
    expect(r.readiness.geometryAcceptedByPhase7).toBe(true);
    expect(r.readiness.featureMappingSupported).toBe(true);
  });

  test("every accepted feature's geometry independently passes Phase 7 validation", () => {
    for (const f of normalized().features) expect(validateE85Geometry(f.geometry).valid).toBe(true);
  });
});

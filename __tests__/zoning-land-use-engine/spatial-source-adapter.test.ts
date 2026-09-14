/**
 * InvestScape™ E85 Phase 8 — spatial source adapter tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Everything here is synthetic and offline: no fetch, no file read, no GIS
 * library, no real municipality.
 *
 * The suite is organised around the ways an acquisition layer gets a regulatory
 * answer confidently wrong — inventing a CRS, adopting a neighbouring release,
 * promoting a record number into an identity, deriving a rule pack from a label,
 * and above all quietly cleaning a boundary until it validates. Each is
 * individually plausible, and each would be invisible in a 40,000-polygon layer.
 */
import {
  createE85SpatialAdapterRegistry,
  createE85SpatialDatasetRegistry,
  hasBlockingSpatialSourceFinding,
  normalizeE85SpatialSnapshot,
  spatialProvenanceToE85Provenance,
  validateE85Geometry,
  E85SpatialAdapterRegistry,
  E85SpatialNormalizationResult,
  E85SpatialNormalizationSuccess,
  E85SpatialSourceAdapter,
  E85SpatialSourceFinding,
  E85SpatialSourceFindingCode,
  E85SpatialSourceSeverity,
} from "../../src/zoning-land-use-engine";
import { referenceZoningDataset, referenceZoningSpatialAdapter, REFERENCE_ZONING_ADAPTER_ID, REFERENCE_ZONING_ADAPTER_VERSION } from "../../src/zoning-land-use-engine/adapters/spatial/reference";
import {
  deepFreezeSnapshot,
  NORMALIZED_AT,
  PARCEL_IN_RB_A,
  RECORD_A,
  RECORD_B,
  RECORD_BOWTIE,
  RECORD_NO_ID,
  RECORD_OVERLAY,
  RECORD_UNKNOWN_CLASS,
  RECORD_UNMAPPED_ZONE,
  RECORD_UNREADABLE_GEOMETRY,
  REFERENCE_DATASET_ID,
  REFERENCE_JURISDICTION,
  REFERENCE_RELEASE,
  SNAPSHOT_RETRIEVED_AT,
  STANDARD_SNAPSHOT,
  rawEscapedHole,
  rawRecord,
  rawRect,
  snapshot,
} from "./fixtures/spatial-snapshots";

function datasets() {
  return createE85SpatialDatasetRegistry([referenceZoningDataset()]);
}

function adapters(list: readonly E85SpatialSourceAdapter[] = [referenceZoningSpatialAdapter]): E85SpatialAdapterRegistry {
  const result = createE85SpatialAdapterRegistry(list);
  if (!result.ok) throw new Error(`registry problems: ${result.problems.map((p) => p.code).join(", ")}`);
  return result.registry;
}

function normalize(snap = STANDARD_SNAPSHOT(), adapterRegistry = adapters()): E85SpatialNormalizationResult {
  return normalizeE85SpatialSnapshot(snap, datasets(), adapterRegistry, { normalizedAt: NORMALIZED_AT });
}

function expectNormalized(result: E85SpatialNormalizationResult): E85SpatialNormalizationSuccess {
  if (result.outcome !== "NORMALIZED") throw new Error(`expected NORMALIZED, got UNSUPPORTED: ${result.reason}`);
  return result;
}

describe("E85 Phase 8 — a well-formed record becomes a complete spatial feature", () => {
  const result = () => expectNormalized(normalize());

  test("every well-formed record is normalized and nothing is quarantined", () => {
    const r = result();
    expect(r.features.map((f) => f.featureId)).toEqual(["dp-1", "zone-a", "zone-b"]);
    expect(r.quarantined).toEqual([]);
  });

  test("the feature carries exact dataset, release, jurisdiction and feature identity", () => {
    const feature = result().features.find((f) => f.featureId === "zone-a");
    expect(feature?.datasetId).toBe(REFERENCE_DATASET_ID);
    expect(feature?.datasetVersionId).toBe(REFERENCE_RELEASE);
    expect(feature?.jurisdictionId).toBe(REFERENCE_JURISDICTION);
    expect(feature?.featureId).toBe("zone-a");
  });

  test("the declared CRS travels onto the geometry, unchanged and untransformed", () => {
    const feature = result().features.find((f) => f.featureId === "zone-a");
    expect(feature?.geometry.crs.crsId).toBe("EPSG:26910");
    expect(feature?.geometry.crs.declaredBy).toBe("reference dataset metadata");
  });

  test("coordinates are transcribed value-for-value", () => {
    const feature = result().features.find((f) => f.featureId === "zone-a");
    expect(feature?.geometry.type).toBe("POLYGON");
    expect(feature?.geometry.type === "POLYGON" ? feature.geometry.exterior : undefined).toEqual([
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ]);
  });

  test("rule-pack linkage comes from the source's explicit policy", () => {
    const r = result();
    expect(r.features.find((f) => f.featureId === "zone-a")?.rulePackIds).toEqual(["refburgh-rb-1"]);
    expect(r.features.find((f) => f.featureId === "zone-b")?.rulePackIds).toEqual(["refburgh-rb-2"]);
    expect(r.features.find((f) => f.featureId === "dp-1")?.rulePackIds).toEqual(["refburgh-dp-overlay"]);
  });

  test("the source's feature class maps exactly, never by resemblance", () => {
    const r = result();
    expect(r.features.find((f) => f.featureId === "zone-a")?.featureClass).toBe("BASE_ZONE");
    expect(r.features.find((f) => f.featureId === "dp-1")?.featureClass).toBe("OVERLAY");
  });

  test("the raw zone code is preserved verbatim as the designation", () => {
    expect(result().features.find((f) => f.featureId === "zone-a")?.zoneDesignation).toBe("RB-1");
  });

  test("spatial provenance names the adapter and its version", () => {
    const provenance = result().features.find((f) => f.featureId === "zone-a")?.provenance;
    expect(provenance?.adapterId).toBe(REFERENCE_ZONING_ADAPTER_ID);
    expect(provenance?.adapterVersion).toBe(REFERENCE_ZONING_ADAPTER_VERSION);
    expect(provenance?.datasetVersionId).toBe(REFERENCE_RELEASE);
    expect(provenance?.publisher).toBe("Refburgh Open Data (invented)");
  });

  test("adapter identity survives projection into the engine-wide provenance vocabulary", () => {
    // The Phase 5 fields already exist on E85Provenance for exactly this, so a
    // spatially-sourced fact and a document-sourced fact answer "which adapter
    // produced this?" the same way.
    const provenance = result().features.find((f) => f.featureId === "zone-a")!.provenance;
    const projected = spatialProvenanceToE85Provenance(provenance);
    expect(projected.adapterId).toBe(REFERENCE_ZONING_ADAPTER_ID);
    expect(projected.adapterVersion).toBe(REFERENCE_ZONING_ADAPTER_VERSION);
    expect(projected.gisLocator?.gisFeatureId).toBe("zone-a");
  });

  test("the raw-to-normalized mapping is auditable without embedding the payload", () => {
    const audit = result().audits.find((a) => a.featureId === "zone-a");
    expect(audit?.rawRecordRef).toBe("snap-1#0");
    expect(audit?.mappings).toContainEqual({ sourceField: "ZONE_CD", sourceValue: "RB-1", normalizedField: "rulePackIds", normalizedValue: "refburgh-rb-1" });
    expect(audit?.mappings).toContainEqual({ sourceField: "LYR_KIND", sourceValue: "BASE", normalizedField: "featureClass", normalizedValue: "BASE_ZONE" });
    // Compact by design: the audit references the record rather than copying it.
    expect(JSON.stringify(audit)).not.toContain("OBJECT_REF");
  });

  test("success is reported explicitly, not merely implied by an absence of failure", () => {
    const normalized = result().findings.filter((f) => f.code === "FEATURE_NORMALIZED");
    expect(normalized).toHaveLength(3);
    expect(normalized.every((f) => f.severity === "INFO")).toBe(true);
  });

  test("readiness is reported across axes rather than as one boolean", () => {
    expect(result().readiness).toEqual({
      datasetRegistered: true,
      snapshotSupplied: true,
      releaseRecognized: true,
      crsDeclared: true,
      adapterAvailable: true,
      featureMappingSupported: true,
      rulePackLinkageSupported: true,
      geometryAcceptedByPhase7: true,
      licenseStatus: "LICENSE_UNKNOWN",
      accessStatus: "AVAILABLE",
    });
  });
});

describe("E85 Phase 8 — geometry is never cleaned into acceptance", () => {
  test("a bow-tie is quarantined, not repaired", () => {
    const r = expectNormalized(normalize(snapshot({ records: [RECORD_A(), RECORD_BOWTIE()] })));
    expect(r.features.map((f) => f.featureId)).toEqual(["zone-a"]);
    expect(r.quarantined.map((q) => q.featureId)).toEqual(["zone-bad"]);
  });

  test("the refusal names Phase 7's own topology verdict", () => {
    const r = expectNormalized(normalize(snapshot({ records: [RECORD_BOWTIE()] })));
    expect(r.quarantined[0].reasonCodes).toEqual(["GEOMETRY_FAILED_PHASE7_VALIDATION"]);
    expect(r.quarantined[0].detail).toContain("RING_SELF_INTERSECTION");
    expect(r.quarantined[0].detail).toContain("No repair was attempted");
  });

  test("a malformed hole is quarantined too — the gate is reused, not partially copied", () => {
    const escaped = rawRecord({ featureRef: "zone-hole", zoneCode: "RB-1", layerKind: "BASE", geometry: rawEscapedHole() });
    const r = expectNormalized(normalize(snapshot({ records: [escaped] })));
    expect(r.features).toEqual([]);
    expect(r.quarantined[0].detail).toContain("INTERIOR_RING_OUTSIDE_EXTERIOR");
  });

  test("the adapter re-uses Phase 7 validation rather than implementing topology rules of its own", () => {
    // Whatever Phase 7 refuses, Phase 8 refuses — proved by asking Phase 7
    // directly about the same shape rather than trusting the adapter's account.
    const r = expectNormalized(normalize(snapshot({ records: [RECORD_BOWTIE()] })));
    expect(r.quarantined).toHaveLength(1);
    const asPhase7Sees = validateE85Geometry({
      type: "POLYGON",
      crs: { crsId: "EPSG:26910" },
      exterior: [
        [0, 0],
        [100, 100],
        [0, 100],
        [100, 0],
      ],
    });
    expect(asPhase7Sees.valid).toBe(false);
  });

  test("a quarantined boundary contributes no rule pack", () => {
    const r = expectNormalized(normalize(snapshot({ records: [RECORD_BOWTIE()] })));
    expect(r.features.flatMap((f) => f.rulePackIds)).toEqual([]);
    expect(JSON.stringify(r.features)).not.toContain("refburgh-rb-1");
  });

  test("the quarantined record keeps its identity, release and raw locator", () => {
    const r = expectNormalized(normalize(snapshot({ records: [RECORD_BOWTIE()] })));
    expect(r.quarantined[0]).toMatchObject({ featureId: "zone-bad", datasetId: REFERENCE_DATASET_ID, datasetVersionId: REFERENCE_RELEASE, rawRecordRef: "snap-1#0" });
  });

  test("no substitute shape is invented for a geometry the adapter cannot read", () => {
    const r = expectNormalized(normalize(snapshot({ records: [RECORD_UNREADABLE_GEOMETRY()] })));
    expect(r.features).toEqual([]);
    expect(r.quarantined[0].reasonCodes).toEqual(["UNSUPPORTED_RAW_GEOMETRY"]);
    expect(r.quarantined[0].detail).toContain("No bounding box, centroid or other substitute shape");
  });

  test("unreadable and malformed are different verdicts, not one bucket", () => {
    const unreadable = expectNormalized(normalize(snapshot({ records: [RECORD_UNREADABLE_GEOMETRY()] })));
    const malformed = expectNormalized(normalize(snapshot({ records: [RECORD_BOWTIE()] })));
    expect(unreadable.quarantined[0].reasonCodes).not.toEqual(malformed.quarantined[0].reasonCodes);
  });
});

describe("E85 Phase 8 — a CRS is declared or it is absent", () => {
  test("a snapshot with no declared CRS is refused whole, with nothing assumed", () => {
    const r = normalize(snapshot({ records: [RECORD_A()], crs: "ABSENT" }));
    expect(r.outcome).toBe("UNSUPPORTED");
    if (r.outcome !== "UNSUPPORTED") throw new Error("unreachable");
    expect(r.reason).toBe("CRS_UNDECLARED");
    expect(r.detail).toContain("does not assume EPSG:4326");
  });

  test("the registry's CRS is not borrowed to fill the gap", () => {
    const r = normalize(snapshot({ records: [RECORD_A()], crs: "ABSENT" }));
    if (r.outcome !== "UNSUPPORTED") throw new Error("unreachable");
    expect(r.detail).toContain("does not borrow the dataset's registered CRS");
    expect(r.readiness.crsDeclared).toBe(false);
  });

  test("no feature is emitted pretending the CRS is known", () => {
    const r = normalize(snapshot({ records: [RECORD_A()], crs: "ABSENT" }));
    expect(JSON.stringify(r)).not.toContain("EPSG:26910");
  });

  test("the gap names the spatial-reference reason, not a missing-geometry one", () => {
    // The coordinates are present and readable; what is missing is a basis for
    // locating them. Reporting GEOMETRY_UNAVAILABLE would send a caller to
    // re-obtain shapes they already hold.
    const r = normalize(snapshot({ records: [RECORD_A()], crs: "ABSENT" }));
    if (r.outcome !== "UNSUPPORTED") throw new Error("unreachable");
    expect(r.gap.reasonCode).toBe("SPATIAL_REFERENCE_MISMATCH");
    expect(r.gap.resolutionHint).toContain("does not infer a CRS from coordinate ranges");
  });

  test("a snapshot CRS contradicting the registry is reported, with neither side preferred", () => {
    const r = normalize(snapshot({ records: [RECORD_A()], crs: "OTHER" }));
    if (r.outcome !== "UNSUPPORTED") throw new Error("unreachable");
    expect(r.reason).toBe("CRS_CONTRADICTION");
    expect(r.detail).toContain("EPSG:4326");
    expect(r.detail).toContain("EPSG:26910");
    expect(r.detail).toContain("Neither is preferred and no transform is performed");
  });

  test("a contradiction normalizes nothing, rather than normalizing under a guess", () => {
    const r = normalize(snapshot({ records: [RECORD_A(), RECORD_B()], crs: "OTHER" }));
    expect(r.outcome).toBe("UNSUPPORTED");
  });
});

describe("E85 Phase 8 — dataset releases match exactly", () => {
  test("a neighbouring release is not adapted as the registered one", () => {
    const r = normalize(snapshot({ records: [RECORD_A()], datasetVersionId: "2025-Q4" }));
    if (r.outcome !== "UNSUPPORTED") throw new Error("unreachable");
    expect(r.reason).toBe("VERSION_NOT_SUPPORTED");
    expect(r.detail).toContain("2025-Q4");
    expect(r.detail).toContain("no newest-release fallback");
  });

  test("nothing is normalized under a release nobody registered", () => {
    const r = normalize(snapshot({ records: [RECORD_A()], datasetVersionId: "2025-Q4" }));
    expect(JSON.stringify(r)).not.toContain("refburgh-rb-1");
  });

  test("an unregistered dataset refuses the whole snapshot", () => {
    const r = normalize(snapshot({ records: [RECORD_A()], datasetId: "xx-yy-elsewhere:zoning-districts" }));
    if (r.outcome !== "UNSUPPORTED") throw new Error("unreachable");
    expect(r.reason).toBe("DATASET_NOT_REGISTERED");
    expect(r.readiness.datasetRegistered).toBe(false);
  });

  test("a jurisdiction contradiction is reported rather than resolved", () => {
    const r = normalize(snapshot({ records: [RECORD_A()], jurisdictionId: "xx-yy-elsewhere" }));
    if (r.outcome !== "UNSUPPORTED") throw new Error("unreachable");
    expect(r.reason).toBe("JURISDICTION_MISMATCH");
    expect(r.detail).toContain("rather than resolved by preferring either side");
  });
});

describe("E85 Phase 8 — identity is authoritative or the record is withheld", () => {
  test("a record with no feature id is quarantined", () => {
    const r = expectNormalized(normalize(snapshot({ records: [RECORD_NO_ID()] })));
    expect(r.features).toEqual([]);
    expect(r.quarantined[0].reasonCodes).toEqual(["FEATURE_ID_MISSING"]);
  });

  test("the record index is never promoted into an identity", () => {
    const r = expectNormalized(normalize(snapshot({ records: [RECORD_NO_ID()] })));
    expect(r.quarantined[0].featureId).toBeUndefined();
    expect(JSON.stringify(r.features)).not.toContain("record-0");
    expect(JSON.stringify(r.features)).not.toContain("snap-1#0");
  });

  test("the publisher's internal record number is not promoted either", () => {
    // OBJECT_REF is an artefact of the publisher's storage that changes when the
    // layer is rebuilt. It is echoed on the quarantine record as evidence, never
    // adopted as identity.
    const r = expectNormalized(normalize(snapshot({ records: [RECORD_NO_ID()] })));
    expect(r.features).toEqual([]);
    expect(r.quarantined[0].rawValues).toEqual({ OBJECT_REF: 4005 });
    const finding = r.findings.find((f) => f.code === "FEATURE_ID_MISSING");
    expect(finding?.message).toContain("storage artefacts");
  });

  test("a missing id costs only that record", () => {
    const r = expectNormalized(normalize(snapshot({ records: [RECORD_A(), RECORD_NO_ID()] })));
    expect(r.features.map((f) => f.featureId)).toEqual(["zone-a"]);
    expect(r.quarantined).toHaveLength(1);
  });
});

describe("E85 Phase 8 — unknown stays unknown", () => {
  test("an unmapped layer kind is not fuzzy-matched onto a known class", () => {
    const r = expectNormalized(normalize(snapshot({ records: [RECORD_UNKNOWN_CLASS()] })));
    expect(r.features).toEqual([]);
    expect(r.quarantined[0].reasonCodes).toEqual(["UNKNOWN_FEATURE_CLASS"]);
    expect(JSON.stringify(r.features)).not.toContain("BASE_ZONE");
  });

  test("an unmapped layer kind is not silently read as OTHER", () => {
    // OTHER asserts the publisher told us and it did not fit our categories.
    // Silence tells us nothing, and reading it as OTHER would quietly settle
    // whether this feature competes for the base-zone slot.
    const r = expectNormalized(normalize(snapshot({ records: [RECORD_UNKNOWN_CLASS()] })));
    expect(r.quarantined[0].detail).toContain("NOT mapped to OTHER");
    expect(r.quarantined[0].rawValues).toEqual({ LYR_KIND: "FLOODPLAIN_STUDY_AREA" });
  });

  test("an unmapped zone code never becomes a derived rule-pack id", () => {
    const r = expectNormalized(normalize(snapshot({ records: [RECORD_UNMAPPED_ZONE()] })));
    expect(JSON.stringify(r.features)).not.toContain("rb-3");
    expect(JSON.stringify(r.features)).not.toContain("pack-rb3");
  });

  test("an unmapped zone code yields a feature with NO packs rather than a withheld feature", () => {
    // The deliberate asymmetry with an unknown CLASS. Where a feature SITS is a
    // fact the layer established; which instrument governs it is not. Withholding
    // it would make Phase 7 report this ground as having no base zone, which is a
    // stronger and different claim than "we do not hold its rules".
    const r = expectNormalized(normalize(snapshot({ records: [RECORD_UNMAPPED_ZONE()] })));
    expect(r.features.map((f) => f.featureId)).toEqual(["zone-c"]);
    expect(r.features[0].rulePackIds).toEqual([]);
    expect(r.features[0].featureClass).toBe("BASE_ZONE");
    expect(r.quarantined).toEqual([]);
  });

  test("the unresolved linkage is reported as a gap, so the emptiness is never mistaken for a finding of no rules", () => {
    const r = expectNormalized(normalize(snapshot({ records: [RECORD_UNMAPPED_ZONE()] })));
    const finding = r.findings.find((f) => f.code === "RULE_PACK_LINK_UNRESOLVED");
    expect(finding?.severity).toBe("GAP");
    expect(finding?.sourceValue).toBe("RB-3");
    expect(finding?.gap?.reasonCode).toBe("RULE_NOT_STRUCTURED");
    expect(r.readiness.rulePackLinkageSupported).toBe(false);
  });
});

describe("E85 Phase 8 — duplicates and conflicts", () => {
  test("the identical record twice collapses to one feature", () => {
    const r = expectNormalized(normalize(snapshot({ records: [RECORD_A(), RECORD_A()] })));
    expect(r.features.map((f) => f.featureId)).toEqual(["zone-a"]);
    const finding = r.findings.find((f) => f.code === "DUPLICATE_RAW_FEATURE_COLLAPSED");
    expect(finding?.severity).toBe("INFO");
    expect(finding?.message).toContain("does not make its boundary more authoritative");
  });

  test("two records claiming one id but differing are BOTH withheld", () => {
    const conflicting = rawRecord({ featureRef: "zone-a", zoneCode: "RB-2", layerKind: "BASE", geometry: rawRect(0, 0, 50, 50) });
    const r = expectNormalized(normalize(snapshot({ records: [RECORD_A(), conflicting] })));
    expect(r.features.map((f) => f.featureId)).toEqual([]);
    expect(r.quarantined).toHaveLength(2);
    expect(r.quarantined.every((q) => q.reasonCodes.includes("CONFLICTING_FEATURE_ID"))).toBe(true);
  });

  test("the conflict chooses neither first nor last, and merges no geometry", () => {
    const conflicting = rawRecord({ featureRef: "zone-a", zoneCode: "RB-2", layerKind: "BASE", geometry: rawRect(0, 0, 50, 50) });
    const forward = expectNormalized(normalize(snapshot({ records: [RECORD_A(), conflicting] })));
    const reverse = expectNormalized(normalize(snapshot({ records: [conflicting, RECORD_A()] })));
    expect(forward.features).toEqual([]);
    expect(reverse.features).toEqual([]);
    const finding = forward.findings.find((f) => f.code === "CONFLICTING_FEATURE_ID");
    expect(finding?.severity).toBe("MANUAL_REVIEW");
    expect(finding?.manualReview?.reasonCode).toBe("CONFLICTING_AUTHORITATIVE_SOURCES");
    expect(finding?.message).toContain("Neither first nor last is chosen");
  });

  test("a conflict costs only the contested id", () => {
    const conflicting = rawRecord({ featureRef: "zone-a", zoneCode: "RB-2", layerKind: "BASE", geometry: rawRect(0, 0, 50, 50) });
    const r = expectNormalized(normalize(snapshot({ records: [RECORD_A(), conflicting, RECORD_B()] })));
    expect(r.features.map((f) => f.featureId)).toEqual(["zone-b"]);
  });

  test("equivalent geometry in two independent datasets is not collapsed across them", () => {
    // Phase 8 normalizes one dataset per snapshot, so cross-dataset collapse
    // cannot happen structurally — and Phase 7 goes on to keep both provenance
    // chains. Agreement between publishers is never extra authority.
    //
    // The mirror is a genuine second adapter with its own scope check, not a
    // spread clone of the reference one: `canHandle` answers for the adapter it
    // was written for, so cloning the object and swapping `identity` would leave
    // the original's scope logic in place and prove nothing.
    const mirroredDatasetId = "xx-yy-refburgh:heritage-areas";
    const registry = createE85SpatialDatasetRegistry([referenceZoningDataset(), { ...referenceZoningDataset(), datasetId: mirroredDatasetId, datasetType: "HERITAGE" }]);
    const mirrorAdapter: E85SpatialSourceAdapter = {
      identity: { ...referenceZoningSpatialAdapter.identity, adapterId: "xx-yy-refburgh.heritage-areas.geojson", supportedDatasetIds: [mirroredDatasetId] },
      canHandle: (snap) => (snap.datasetId === mirroredDatasetId ? { supported: true } : { supported: false, reason: "DATASET_NOT_SUPPORTED", detail: "mirror handles its own dataset only" }),
      normalize: referenceZoningSpatialAdapter.normalize,
    };

    const a = normalizeE85SpatialSnapshot(snapshot({ records: [RECORD_A()] }), registry, adapters(), { normalizedAt: NORMALIZED_AT });
    const b = normalizeE85SpatialSnapshot(snapshot({ records: [RECORD_A()], datasetId: mirroredDatasetId, snapshotId: "snap-2" }), registry, adapters([mirrorAdapter]), { normalizedAt: NORMALIZED_AT });

    const combined = [...expectNormalized(a).features, ...expectNormalized(b).features];
    expect(combined).toHaveLength(2);
    expect(combined.map((f) => f.datasetId).sort()).toEqual([mirroredDatasetId, REFERENCE_DATASET_ID].sort());
    // Same feature id, same boundary, two independent provenance chains.
    expect(combined.every((f) => f.featureId === "zone-a")).toBe(true);
    expect(combined[0].provenance.datasetId).not.toBe(combined[1].provenance.datasetId);
  });
});

describe("E85 Phase 8 — adapter resolution is exact", () => {
  test("an exact jurisdiction/dataset/release/payload match resolves", () => {
    expect(normalize().outcome).toBe("NORMALIZED");
  });

  test("a wrong jurisdiction never falls back to the one adapter that exists", () => {
    const registry = createE85SpatialDatasetRegistry([referenceZoningDataset(), { ...referenceZoningDataset(), datasetId: "xx-yy-elsewhere:zoning-districts", jurisdictionId: "xx-yy-elsewhere" }]);
    const r = normalizeE85SpatialSnapshot(
      snapshot({ records: [RECORD_A()], datasetId: "xx-yy-elsewhere:zoning-districts", jurisdictionId: "xx-yy-elsewhere" }),
      registry,
      adapters(),
      { normalizedAt: NORMALIZED_AT },
    );
    if (r.outcome !== "UNSUPPORTED") throw new Error("unreachable");
    expect(r.reason).toBe("JURISDICTION_NOT_SUPPORTED");
    expect(r.detail).toContain("No fallback to another jurisdiction's adapter is performed");
  });

  test("an unsupported payload shape is refused rather than guessed at", () => {
    const r = normalize(snapshot({ records: [RECORD_A()], sourceSystem: "ARCGIS_REST" }));
    if (r.outcome !== "UNSUPPORTED") throw new Error("unreachable");
    expect(r.reason).toBe("SOURCE_SYSTEM_NOT_SUPPORTED");
  });

  test("no registered adapter is an explicit refusal carrying a real gap", () => {
    const r = normalize(STANDARD_SNAPSHOT(), adapters([]));
    if (r.outcome !== "UNSUPPORTED") throw new Error("unreachable");
    expect(r.reason).toBe("NO_ADAPTER_REGISTERED");
    expect(r.gap.reasonCode).toBe("RULE_NOT_STRUCTURED");
    expect(r.gap.resolutionHint).toContain("Build and register a spatial adapter");
  });

  test("two adapters claiming one snapshot is refused, not resolved by order", () => {
    const twin: E85SpatialSourceAdapter = { ...referenceZoningSpatialAdapter, identity: { ...referenceZoningSpatialAdapter.identity, adapterId: "xx-yy-refburgh.zoning-districts.twin" } };
    const r = normalize(STANDARD_SNAPSHOT(), adapters([referenceZoningSpatialAdapter, twin]));
    if (r.outcome !== "UNSUPPORTED") throw new Error("unreachable");
    expect(r.reason).toBe("AMBIGUOUS_ADAPTER_MATCH");
    expect(r.detail).toContain("would depend on registration order");
  });

  test("ambiguity is refused identically whichever order the adapters were registered in", () => {
    const twin: E85SpatialSourceAdapter = { ...referenceZoningSpatialAdapter, identity: { ...referenceZoningSpatialAdapter.identity, adapterId: "xx-yy-refburgh.zoning-districts.twin" } };
    const forward = normalize(STANDARD_SNAPSHOT(), adapters([referenceZoningSpatialAdapter, twin]));
    const reverse = normalize(STANDARD_SNAPSHOT(), adapters([twin, referenceZoningSpatialAdapter]));
    expect(JSON.stringify(forward)).toBe(JSON.stringify(reverse));
  });

  test("a duplicate adapter id is refused at registry construction", () => {
    const result = createE85SpatialAdapterRegistry([referenceZoningSpatialAdapter, referenceZoningSpatialAdapter]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.problems[0].code).toBe("DUPLICATE_SPATIAL_ADAPTER_ID");
  });

  test("the registry lists adapters in deterministic id order regardless of registration order", () => {
    const twin: E85SpatialSourceAdapter = { ...referenceZoningSpatialAdapter, identity: { ...referenceZoningSpatialAdapter.identity, adapterId: "aaa-first.zoning.geojson" } };
    expect(adapters([referenceZoningSpatialAdapter, twin]).list().map((a) => a.identity.adapterId)).toEqual(adapters([twin, referenceZoningSpatialAdapter]).list().map((a) => a.identity.adapterId));
  });

  test("a second, unrelated adapter proves the registry is not hardwired to the reference one", () => {
    const other: E85SpatialSourceAdapter = {
      identity: {
        adapterId: "xx-zz-othertown.parcels.arcgis",
        adapterVersion: "0.1.0",
        jurisdictionId: "xx-zz-othertown",
        supportedDatasetIds: ["xx-zz-othertown:parcels"],
        supportedDatasetVersionIds: ["v1"],
        supportedSourceSystems: ["ARCGIS_REST"],
        supportedFeatureClasses: ["OTHER"],
      },
      canHandle: () => ({ supported: true }),
      normalize: () => {
        throw new Error("not reached in this test");
      },
    };
    const registry = adapters([referenceZoningSpatialAdapter, other]);
    expect(registry.get("xx-zz-othertown.parcels.arcgis")).toBeDefined();
    // The reference snapshot still resolves to the reference adapter.
    expect(normalize(STANDARD_SNAPSHOT(), registry).outcome).toBe("NORMALIZED");
  });
});

describe("E85 Phase 8 — snapshot-level and feature-level failures stay distinct", () => {
  test("a feature-level failure still returns NORMALIZED for the rest", () => {
    const r = normalize(snapshot({ records: [RECORD_A(), RECORD_BOWTIE(), RECORD_B()] }));
    expect(r.outcome).toBe("NORMALIZED");
    expect(expectNormalized(r).features.map((f) => f.featureId)).toEqual(["zone-a", "zone-b"]);
  });

  test("a snapshot-level failure yields no features at all", () => {
    const r = normalize(snapshot({ records: [RECORD_A(), RECORD_B()], crs: "ABSENT" }));
    expect(r.outcome).toBe("UNSUPPORTED");
    expect("features" in r).toBe(false);
  });

  test("one bad polygon never costs the caller its siblings", () => {
    const many = [RECORD_A(), RECORD_B(), RECORD_OVERLAY(), RECORD_BOWTIE()];
    const r = expectNormalized(normalize(snapshot({ records: many })));
    expect(r.features).toHaveLength(3);
    expect(r.quarantined).toHaveLength(1);
  });

  test("an empty snapshot normalizes to nothing without failing", () => {
    const r = expectNormalized(normalize(snapshot({ records: [] })));
    expect(r.features).toEqual([]);
    expect(r.readiness.featureMappingSupported).toBe(false);
    expect(r.readiness.releaseRecognized).toBe(true);
  });
});

describe("E85 Phase 8 — determinism, immutability and clock-freedom", () => {
  test("the same snapshot normalizes byte-identically", () => {
    expect(JSON.stringify(normalize())).toBe(JSON.stringify(normalize()));
  });

  test("reversing record order changes nothing semantically", () => {
    const forward = normalize(snapshot({ records: [RECORD_A(), RECORD_B(), RECORD_OVERLAY()] }));
    const reverse = normalize(snapshot({ records: [RECORD_OVERLAY(), RECORD_B(), RECORD_A()] }));
    expect(expectNormalized(forward).features.map((f) => f.featureId)).toEqual(expectNormalized(reverse).features.map((f) => f.featureId));
    expect(expectNormalized(forward).features).toEqual(expectNormalized(reverse).features);
  });

  test("every permutation of three records yields the same feature set", () => {
    const [a, b, c] = [RECORD_A(), RECORD_B(), RECORD_OVERLAY()];
    const permutations = [
      [a, b, c],
      [a, c, b],
      [b, a, c],
      [b, c, a],
      [c, a, b],
      [c, b, a],
    ];
    const outputs = permutations.map((records) => JSON.stringify(expectNormalized(normalize(snapshot({ records }))).features));
    expect(new Set(outputs).size).toBe(1);
  });

  test("features, quarantine and audits all come back canonically ordered", () => {
    const r = expectNormalized(normalize(snapshot({ records: [RECORD_OVERLAY(), RECORD_BOWTIE(), RECORD_A()] })));
    expect(r.features.map((f) => f.featureId)).toEqual([...r.features.map((f) => f.featureId)].sort());
    expect(r.audits.map((a) => a.featureId)).toEqual([...r.audits.map((a) => a.featureId)].sort());
    expect(r.quarantined.map((q) => q.rawRecordRef)).toEqual([...r.quarantined.map((q) => q.rawRecordRef)].sort());
  });

  test("a deep-frozen snapshot survives normalization untouched", () => {
    const frozen = deepFreezeSnapshot(STANDARD_SNAPSHOT());
    expect(() => normalize(frozen)).not.toThrow();
  });

  test("the raw records and their coordinate arrays are unchanged afterwards", () => {
    const snap = STANDARD_SNAPSHOT();
    const before = JSON.stringify(snap);
    normalize(snap);
    expect(JSON.stringify(snap)).toBe(before);
  });

  test("the supplied record array is not reordered in place", () => {
    const records = [RECORD_OVERLAY(), RECORD_B(), RECORD_A()];
    const snap = snapshot({ records });
    const before = records.map((r) => r.rawAttributes.FEATURE_REF);
    normalize(snap);
    expect(records.map((r) => r.rawAttributes.FEATURE_REF)).toEqual(before);
  });

  test("no clock is read — the timestamp comes from the caller or the snapshot", () => {
    expect(expectNormalized(normalize()).normalizedAt).toBe(NORMALIZED_AT);
    const derived = normalizeE85SpatialSnapshot(STANDARD_SNAPSHOT(), datasets(), adapters());
    expect(expectNormalized(derived).normalizedAt).toBe(SNAPSHOT_RETRIEVED_AT);
  });

  test("with no timestamp anywhere the fallback is a constant, not now", () => {
    const undated = { ...STANDARD_SNAPSHOT() };
    delete (undated as { retrievedAt?: string }).retrievedAt;
    const r = expectNormalized(normalizeE85SpatialSnapshot(undated, datasets(), adapters()));
    expect(r.normalizedAt).toBe("1970-01-01T00:00:00.000Z");
  });

  test("an unwitnessed read never acquires a manufactured observation time", () => {
    // `checkedAt` on a gap says when E85 ran a check and may be a sentinel.
    // `observedAt` says when a source was actually read, and inventing that
    // would be fabricating evidence — so it stays absent.
    const undated = { ...STANDARD_SNAPSHOT() };
    delete (undated as { retrievedAt?: string }).retrievedAt;
    const r = expectNormalized(normalizeE85SpatialSnapshot(undated, datasets(), adapters()));
    expect(r.features.every((f) => f.provenance.observedAt === undefined)).toBe(true);
  });

  test("a witnessed read carries the snapshot's own retrieval time", () => {
    expect(expectNormalized(normalize()).features.every((f) => f.provenance.observedAt === SNAPSHOT_RETRIEVED_AT)).toBe(true);
  });
});

describe("E85 Phase 8 — temporal and licensing discipline survive", () => {
  test("a publication date never becomes a legal effective date", () => {
    // The reference release is published 2026-01-15 with no established effect.
    const r = expectNormalized(normalize());
    expect(r.features.every((f) => f.temporal?.effectiveDateBasis === "UNKNOWN")).toBe(true);
    expect(JSON.stringify(r.features)).not.toContain("2026-01-15");
  });

  test("licence status is carried, never inferred from availability", () => {
    const r = expectNormalized(normalize());
    expect(r.readiness.licenseStatus).toBe("LICENSE_UNKNOWN");
    expect(r.readiness.accessStatus).toBe("AVAILABLE");
  });

  test("a licence-unknown dataset still produces complete geometry", () => {
    // Rights govern what may be republished, never where a boundary lies.
    const r = expectNormalized(normalize());
    expect(r.features).toHaveLength(3);
    expect(r.features.every((f) => f.geometry.type === "POLYGON")).toBe(true);
  });
});

describe("E85 Phase 8 — expected source uncertainty is returned, never thrown", () => {
  test("none of the ordinary failure modes throws", () => {
    const cases = [
      snapshot({ records: [], crs: "ABSENT" }),
      snapshot({ records: [RECORD_A()], crs: "OTHER" }),
      snapshot({ records: [RECORD_A()], datasetVersionId: "nope" }),
      snapshot({ records: [RECORD_A()], datasetId: "xx-yy-nowhere:layer" }),
      snapshot({ records: [RECORD_NO_ID(), RECORD_BOWTIE(), RECORD_UNKNOWN_CLASS(), RECORD_UNMAPPED_ZONE(), RECORD_UNREADABLE_GEOMETRY()] }),
      snapshot({ records: [rawRecord({ featureRef: "x", zoneCode: "RB-1", layerKind: "BASE" })] }),
      snapshot({ records: [rawRecord({ featureRef: "y", zoneCode: "RB-1", layerKind: "BASE", geometry: { type: "Polygon", coordinates: [[[0, 0]]] } })] }),
    ];
    for (const snap of cases) {
      expect(() => normalize(snap)).not.toThrow();
    }
  });

  test("a five-way-broken snapshot accounts for every record", () => {
    const records = [RECORD_NO_ID(), RECORD_BOWTIE(), RECORD_UNKNOWN_CLASS(), RECORD_UNMAPPED_ZONE(), RECORD_UNREADABLE_GEOMETRY()];
    const r = expectNormalized(normalize(snapshot({ records })));
    // Nothing vanishes: every record is either a feature or a quarantine entry.
    expect(r.features.length + r.quarantined.length).toBe(records.length);
  });
});

describe("E85 Phase 8 - a resolved linkage and an unresolved one are told apart", () => {
  // The two snapshots differ in ONE respect: the zone code. Same layer, same
  // release, same CRS, same well-formed rectangle, same feature class. Anything
  // that differs in the results below is therefore attributable to linkage
  // alone, which is the whole point of running them side by side.
  const caseA = () => expectNormalized(normalize(snapshot({ records: [RECORD_A()] })));
  const caseB = () => expectNormalized(normalize(snapshot({ records: [RECORD_UNMAPPED_ZONE()] })));

  const linkFinding = (r: E85SpatialNormalizationSuccess) => r.findings.find((f) => f.code === "RULE_PACK_LINK_UNRESOLVED");

  test("both preserve the spatial fact the layer established", () => {
    // Neither feature is withheld and neither boundary is touched. The source
    // said a polygon is here; that much is true in both cases and survives both.
    for (const r of [caseA(), caseB()]) {
      expect(r.features).toHaveLength(1);
      expect(r.features[0].featureClass).toBe("BASE_ZONE");
      const geometry = r.features[0].geometry;
      expect(geometry.type).toBe("POLYGON");
      expect("exterior" in geometry ? geometry.exterior : []).toHaveLength(4);
      expect(r.quarantined).toEqual([]);
    }
  });

  test("both carry full authoritative provenance - an unresolved link is not a weaker citation", () => {
    for (const r of [caseA(), caseB()]) {
      const p = r.features[0].provenance;
      expect(p.datasetId).toBe(REFERENCE_DATASET_ID);
      expect(p.datasetVersionId).toBe(REFERENCE_RELEASE);
      expect(p.jurisdictionId).toBe(REFERENCE_JURISDICTION);
      expect(p.adapterId).toBe(REFERENCE_ZONING_ADAPTER_ID);
      expect(p.adapterVersion).toBe(REFERENCE_ZONING_ADAPTER_VERSION);
      expect(p.observedAt).toBe(SNAPSHOT_RETRIEVED_AT);
    }
  });

  test("CASE A - a mapped code yields a pack, a satisfied readiness axis and nothing blocking", () => {
    const r = caseA();
    expect(r.features[0].rulePackIds).toEqual(["refburgh-rb-1"]);
    expect(r.readiness.rulePackLinkageSupported).toBe(true);
    expect(linkFinding(r)).toBeUndefined();
    expect(hasBlockingSpatialSourceFinding(r.findings)).toBe(false);
  });

  test("CASE B - an unmapped code yields no pack, a failed readiness axis and a blocking gap", () => {
    const r = caseB();
    expect(r.features[0].rulePackIds).toEqual([]);
    expect(r.readiness.rulePackLinkageSupported).toBe(false);
    expect(linkFinding(r)?.severity).toBe("GAP");
    expect(linkFinding(r)?.gap?.reasonCode).toBe("RULE_NOT_STRUCTURED");
    expect(hasBlockingSpatialSourceFinding(r.findings)).toBe(true);
  });

  test("CASE B invents no identifier from the code's spelling", () => {
    // The failure this guards against is the plausible one: "RB-3" is RIGHT
    // THERE, and deriving "refburgh-rb-3" from it would look like a mapping and
    // read like a citation while being neither.
    const r = caseB();
    const serialized = JSON.stringify(r.features);
    for (const invented of ["refburgh-rb-3", "RB-3-pack", "UNKNOWN_RULE_PACK", "unmapped"]) {
      expect(serialized).not.toContain(invented);
    }
    // The raw code survives as a DESIGNATION - what the publisher called this
    // ground - which is a different claim from an instrument identity.
    expect(r.features[0].zoneDesignation).toBe("RB-3");
  });

  test("the two cases are distinguishable without reading a single finding message", () => {
    // A caller that never opens `findings` still cannot confuse these two.
    const a = caseA();
    const b = caseB();
    expect([a.readiness.rulePackLinkageSupported, hasBlockingSpatialSourceFinding(a.findings)]).toEqual([true, false]);
    expect([b.readiness.rulePackLinkageSupported, hasBlockingSpatialSourceFinding(b.findings)]).toEqual([false, true]);
  });
});

describe("E85 Phase 8 - hasBlockingSpatialSourceFinding", () => {
  // Direct coverage of the helper itself. It is the one public call a caller can
  // make to ask "is anything here unfinished?", and until now nothing exercised
  // it. These tests state the semantics the implementation already has; they do
  // not propose new ones.
  function finding(severity: E85SpatialSourceSeverity, code: E85SpatialSourceFindingCode = "FEATURE_NORMALIZED"): E85SpatialSourceFinding {
    return {
      code,
      severity,
      message: `synthetic ${severity} finding`,
      // The contract populates these when and only when the severity calls for
      // it, so the fixtures honour that rather than handing the helper a shape
      // no adapter would ever emit.
      ...(severity === "GAP" ? { gap: { reasonCode: "RULE_NOT_STRUCTURED" as const, reason: "synthetic", sourcesChecked: [REFERENCE_DATASET_ID], checkedAt: NORMALIZED_AT } } : {}),
      ...(severity === "MANUAL_REVIEW"
        ? { manualReview: { reasonCode: "AMBIGUOUS_PARCEL_ZONE_MATCH" as const, explanation: "synthetic", evidenceConsidered: [REFERENCE_DATASET_ID], flaggedAt: NORMALIZED_AT } }
        : {}),
    };
  }

  test("no findings at all is not blocking", () => {
    expect(hasBlockingSpatialSourceFinding([])).toBe(false);
  });

  test("INFO alone is not blocking", () => {
    expect(hasBlockingSpatialSourceFinding([finding("INFO"), finding("INFO")])).toBe(false);
  });

  test("WARNING alone is not blocking - a caveat is not an unanswered question", () => {
    // Recording the existing boundary deliberately. WARNING means the answer was
    // produced and a reviewer should see something about it; GAP means no answer
    // was produced. Only the latter stops a caller treating the result as complete.
    expect(hasBlockingSpatialSourceFinding([finding("WARNING"), finding("INFO")])).toBe(false);
  });

  test("a GAP is blocking", () => {
    expect(hasBlockingSpatialSourceFinding([finding("GAP", "RULE_PACK_LINK_UNRESOLVED")])).toBe(true);
  });

  test("a MANUAL_REVIEW is blocking", () => {
    expect(hasBlockingSpatialSourceFinding([finding("MANUAL_REVIEW", "CONFLICTING_FEATURE_ID")])).toBe(true);
  });

  test("one GAP among many INFOs still blocks - the majority does not outvote it", () => {
    // The property that matters on a real layer: 39,999 normalized records do
    // not dilute the one that was not.
    const many = [...Array.from({ length: 40 }, () => finding("INFO")), finding("WARNING"), finding("GAP", "RULE_PACK_LINK_UNRESOLVED")];
    expect(hasBlockingSpatialSourceFinding(many)).toBe(true);
  });

  test("the answer does not depend on the order the findings arrive in", () => {
    const findings = [finding("INFO"), finding("WARNING"), finding("GAP", "RULE_PACK_LINK_UNRESOLVED"), finding("INFO")];
    expect(hasBlockingSpatialSourceFinding([...findings].reverse())).toBe(hasBlockingSpatialSourceFinding(findings));
    expect(hasBlockingSpatialSourceFinding([...findings].reverse())).toBe(true);
  });

  test("it reads the findings it is given and nothing else", () => {
    // Pure and clock-free: the same array asked twice, and asked about a copy,
    // answers identically.
    const findings = [finding("INFO"), finding("GAP")];
    expect(hasBlockingSpatialSourceFinding(findings)).toBe(hasBlockingSpatialSourceFinding(findings));
    expect(hasBlockingSpatialSourceFinding(JSON.parse(JSON.stringify(findings)))).toBe(true);
  });
});

/**
 * InvestScape™ E85 Phase 7 — spatial applicability tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Everything here is synthetic and offline. The suite is organised around the
 * shortcuts Phase 7 refuses — centroid, area-majority, first-hit, and
 * touching-counts — because each one is individually plausible, individually
 * wrong, and invisible once taken.
 */
import {
  resolveE85SpatialApplicability,
  createE85SpatialDatasetRegistry,
  traceE85RulePackToFeatures,
  e85ApplicableRulePackIds,
  e85AmbiguousHits,
  hasBlockingSpatialFinding,
  hasBlockingSpatialFindingCode,
  buildE85SpatialDatasetId,
  isValidE85SpatialDatasetId,
  findE85SpatialDatasetVersion,
  deriveE85SpatialTemporalWindow,
  spatialProvenanceToE85Provenance,
  e85SpatialFeatureIdentityKey,
  E85SpatialApplicabilityRequest,
  E85SpatialApplicabilityResult,
} from "../../src/zoning-land-use-engine";
import {
  BASE_DATASET,
  CRS,
  DATASET_VERSION,
  FEATURE_A,
  FEATURE_B,
  FEATURE_OVERLAY,
  JURISDICTION,
  OTHER_CRS,
  OVERLAY_DATASET,
  PARCEL_IN_A,
  PARCEL_IN_A_AND_OVERLAY,
  PARCEL_OUTSIDE,
  PARCEL_SPLIT,
  PARCEL_TOUCHING_A,
  RESOLVED_AT,
  STANDARD_DATASETS,
  ZONE_A,
  dataset,
  deepFreeze,
  feature,
  parcel,
  point,
  pos,
  square,
} from "./fixtures/spatial-features";

function resolve(request: Partial<E85SpatialApplicabilityRequest> & Pick<E85SpatialApplicabilityRequest, "parcel" | "features">): E85SpatialApplicabilityResult {
  return resolveE85SpatialApplicability({
    resolvedAt: RESOLVED_AT,
    registry: createE85SpatialDatasetRegistry(STANDARD_DATASETS()),
    ...request,
  });
}

describe("E85 Phase 7 — a parcel inside one base zone", () => {
  const result = () => resolve({ parcel: PARCEL_IN_A(), features: [FEATURE_A(), FEATURE_B()] });

  test("exactly one base pack applies, with no ambiguity", () => {
    const r = result();
    expect(r.applicableRulePackIds).toEqual(["base-a"]);
    expect(r.ambiguousRulePackIds).toEqual([]);
    expect(r.manualReview).toEqual([]);
  });

  test("the non-matching zone is recorded as checked-and-disjoint, not silently absent", () => {
    const hit = result().hits.find((h) => h.featureId === "zone-b");
    expect(hit?.relation).toBe("DISJOINT");
    expect(hit?.applicability).toBe("DOES_NOT_APPLY");
  });

  test("the geometric relation and the applicability conclusion are separate fields", () => {
    const hit = result().hits.find((h) => h.featureId === "zone-a");
    expect(hit?.relation).toBe("CONTAINS");
    expect(hit?.applicability).toBe("APPLIES");
  });

  test("parcelMatch is high — the axis Phase 5 and Phase 6 both declined to invent", () => {
    expect(result().parcelMatch).toBe("high");
  });

  test("the status is settled, with the unknown-effective-date caveat surfaced", () => {
    // The fixture features carry a known effective date, so nothing temporal fires.
    expect(["RESOLVED", "RESOLVED_WITH_WARNINGS"]).toContain(result().status);
    expect(hasBlockingSpatialFinding(result())).toBe(false);
  });

  test("an applying feature is reported, so success is auditable and not merely implied", () => {
    expect(result().hits.some((h) => h.applicability === "APPLIES")).toBe(true);
    // Both features come from the base zoning layer; only datasets actually consulted are listed.
    expect(result().datasetsConsulted).toEqual([BASE_DATASET]);
  });

  test("a pack traces back to the exact feature that activated it", () => {
    const features = traceE85RulePackToFeatures(result(), "base-a");
    expect(features).toHaveLength(1);
    expect(features[0].featureId).toBe("zone-a");
    expect(features[0].spatialProvenance.datasetId).toBe(BASE_DATASET);
    expect(features[0].spatialProvenance.datasetVersionId).toBe(DATASET_VERSION);
    expect(features[0].zoneDesignation).toBe("TB-1");
  });
});

describe("E85 Phase 7 — base zone and overlay coexist", () => {
  const result = () => resolve({ parcel: PARCEL_IN_A_AND_OVERLAY(), features: [FEATURE_A(), FEATURE_OVERLAY()] });

  test("both packs apply — two layers reaching one parcel is the normal arrangement", () => {
    expect(result().applicableRulePackIds).toEqual(["base-a", "overlay-x"]);
  });

  test("overlapping layers produce no ambiguity and no manual review", () => {
    const r = result();
    expect(r.ambiguousRulePackIds).toEqual([]);
    expect(r.manualReview).toEqual([]);
    expect(r.status).not.toBe("MANUAL_REVIEW_REQUIRED");
  });

  test("coexistence is stated explicitly, and defers interaction to the composition layer", () => {
    const finding = result().findings.find((f) => f.code === "OVERLAY_COEXISTS");
    expect(finding?.severity).toBe("INFO");
    expect(finding?.message).toContain("neither suppresses the other");
    expect(finding?.message).toContain("never from geometry");
  });

  test("the overlay is not suppressed merely because a base zone exists", () => {
    expect(result().hits.find((h) => h.featureId === "overlay-x")?.applicability).toBe("APPLIES");
  });
});

describe("E85 Phase 7 — a split parcel is never resolved by a shortcut", () => {
  const result = () => resolve({ parcel: PARCEL_SPLIT(), features: [FEATURE_A(), FEATURE_B()] });

  test("both hits are retained rather than one being chosen", () => {
    const r = result();
    expect(r.hits.filter((h) => h.relation === "INTERSECTS")).toHaveLength(2);
    expect(r.ambiguousRulePackIds).toEqual(["base-a", "base-b"]);
  });

  test("no zone is treated as applicable, so nothing downstream can compose the ambiguity away", () => {
    expect(result().applicableRulePackIds).toEqual([]);
  });

  test("the escalation is manual review with the Phase 3 straddling-zones reason code", () => {
    const r = result();
    expect(r.status).toBe("MANUAL_REVIEW_REQUIRED");
    expect(r.manualReview.every((m) => m.reasonCode === "AMBIGUOUS_PARCEL_ZONE_MATCH")).toBe(true);
    expect(hasBlockingSpatialFinding(r)).toBe(true);
  });

  test("the centroid is not consulted", () => {
    // The parcel spans x=8..12; its centroid at x=10 sits exactly on the A/B
    // line. A centroid rule would have to break that tie somehow, and every way
    // of breaking it is arbitrary. Neither zone wins here.
    const r = result();
    expect(r.applicableRulePackIds).not.toContain("base-a");
    expect(r.applicableRulePackIds).not.toContain("base-b");
  });

  test("area majority is not consulted", () => {
    // 75% of this parcel lies in A. It still does not carry the whole lot.
    const lopsided = resolve({ parcel: parcel(square(7, 2, 11, 4)), features: [FEATURE_A(), FEATURE_B()] });
    expect(lopsided.applicableRulePackIds).toEqual([]);
    expect(lopsided.ambiguousRulePackIds).toEqual(["base-a", "base-b"]);
  });

  test("the ambiguity keeps its layer and pack identity, so materiality can be scoped later", () => {
    const finding = result().findings.find((f) => f.code === "MULTIPLE_BASE_ZONES");
    expect(finding?.rulePackIds).toEqual(["base-a", "base-b"]);
    expect(finding?.featureClasses).toEqual(["BASE_ZONE"]);
    expect(finding?.datasetIds).toEqual([BASE_DATASET]);
  });

  test("each ambiguous hit still carries its own provenance", () => {
    for (const hit of e85AmbiguousHits(result())) {
      expect(hit.spatialProvenance.featureId).toBe(hit.featureId);
      expect(hit.spatialProvenance.datasetVersionId).toBe(DATASET_VERSION);
    }
  });

  test("a parcel partly covered by a single overlay is still a split, not a clean apply", () => {
    const partial = resolve({ parcel: parcel(square(2, 2, 6, 6)), features: [FEATURE_A(), FEATURE_OVERLAY()] });
    expect(partial.applicableRulePackIds).toEqual(["base-a"]);
    expect(partial.ambiguousRulePackIds).toEqual(["overlay-x"]);
    expect(partial.findings.some((f) => f.code === "PARTIAL_OVERLAP")).toBe(true);
  });
});

describe("E85 Phase 7 — boundary contact is not containment, and not non-applicability either", () => {
  const result = () => resolve({ parcel: PARCEL_TOUCHING_A(), features: [FEATURE_A(), FEATURE_B()] });

  test("the touched zone is reported as BOUNDARY_TOUCH and escalated rather than settled", () => {
    // The geometry is certain: these boundaries meet and share no area. What
    // that means legally is not, and a generic spatial foundation has no
    // authoritative policy to read it from — some jurisdictions activate an
    // instrument on abutment, others require containment.
    const hit = result().hits.find((h) => h.featureId === "zone-a");
    expect(hit?.relation).toBe("BOUNDARY_TOUCH");
    expect(hit?.applicability).toBe("MANUAL_REVIEW_REQUIRED");
  });

  test("a touch is never read as containment: the pack does not enter the applicable set", () => {
    expect(result().applicableRulePackIds).not.toContain("base-a");
  });

  test("a touch is never read as irrelevance either: the pack does not vanish", () => {
    expect(result().ambiguousRulePackIds).toContain("base-a");
  });

  test("the containing zone still resolves cleanly alongside it", () => {
    // Boundary uncertainty about one feature must not erase what another feature
    // proved. The parcel is squarely inside B and that stands.
    expect(result().applicableRulePackIds).toEqual(["base-b"]);
  });

  test("the withheld pack keeps everything a later decision needs", () => {
    const hit = result().hits.find((h) => h.featureId === "zone-a");
    expect(hit?.rulePackIds).toEqual(["base-a"]);
    expect(hit?.datasetId).toBe(BASE_DATASET);
    expect(hit?.datasetVersionId).toBe(DATASET_VERSION);
    expect(hit?.spatialProvenance.featureId).toBe("zone-a");
    expect(hit?.zoneDesignation).toBe("TB-1");
  });

  test("the touch carries a manual-review record explaining why it was withheld", () => {
    const finding = result().findings.find((f) => f.code === "BOUNDARY_TOUCH_ONLY");
    expect(finding?.severity).toBe("MANUAL_REVIEW");
    expect(finding?.featureIds).toEqual(["zone-a"]);
    expect(finding?.rulePackIds).toEqual(["base-a"]);
    expect(finding?.manualReview?.reasonCode).toBe("AMBIGUOUS_PARCEL_ZONE_MATCH");
    expect(finding?.message).toContain("rule of the jurisdiction");
    expect(finding?.message).toContain("neither applied nor dismissed");
  });

  test("the detail states the split explicitly: geometry certain, legal consequence not", () => {
    const hit = result().hits.find((h) => h.featureId === "zone-a");
    expect(hit?.detail).toContain("NOT applied");
    expect(hit?.detail).toContain("not dismissed either");
  });

  test("the result is blocking, so a caller cannot treat the touch as settled", () => {
    const r = result();
    expect(r.status).toBe("MANUAL_REVIEW_REQUIRED");
    expect(hasBlockingSpatialFinding(r)).toBe(true);
  });

  test("a proven base zone is not downgraded to a straddling parcel by an edge contact", () => {
    // One exclusive feature contains the parcel and that containment is settled;
    // the open question concerns a different feature. Rating this the same as a
    // parcel split across two zones would erase the distinction the axis exists
    // to carry.
    expect(result().parcelMatch).toBe("moderate");
    expect(resolve({ parcel: PARCEL_SPLIT(), features: [FEATURE_A(), FEATURE_B()] }).parcelMatch).toBe("low");
  });

  test("a parcel that ONLY touches a zone and sits inside none escalates instead of reporting no zoning", () => {
    // Sitting exactly on a line, inside nothing, is a survey-precision question
    // — "no zoning here" would claim more than the geometry supports.
    const r = resolve({ parcel: parcel(square(10, 2, 12, 4)), features: [FEATURE_A()] });
    expect(r.status).toBe("MANUAL_REVIEW_REQUIRED");
    expect(r.dataGaps.some((g) => g.reasonCode === "ZONING_NOT_FOUND")).toBe(false);
    expect(r.manualReview[0].reasonCode).toBe("AMBIGUOUS_PARCEL_ZONE_MATCH");
  });

  test("that case is distinguishable from every other no-zone state by its own finding code", () => {
    const r = resolve({ parcel: parcel(square(10, 2, 12, 4)), features: [FEATURE_A()] });
    const finding = r.findings.find((f) => f.code === "BASE_ZONE_BOUNDARY_ONLY");
    expect(finding?.severity).toBe("MANUAL_REVIEW");
    expect(finding?.featureIds).toEqual(["zone-a"]);
    expect(finding?.message).toContain("no base zone is asserted and no absence of zoning is claimed either");
    // Neither of the two claims it sits between is made.
    expect(r.findings.some((f) => f.code === "NO_BASE_ZONE_MATCH")).toBe(false);
    expect(r.findings.some((f) => f.code === "MULTIPLE_BASE_ZONES")).toBe(false);
  });

  test("the touching pack is still retained there, rather than disappearing with the zone question", () => {
    const r = resolve({ parcel: parcel(square(10, 2, 12, 4)), features: [FEATURE_A()] });
    expect(r.applicableRulePackIds).toEqual([]);
    expect(r.ambiguousRulePackIds).toEqual(["base-a"]);
  });

  test("iteration order does not decide which touching polygon is seen first", () => {
    const forward = resolve({ parcel: PARCEL_TOUCHING_A(), features: [FEATURE_A(), FEATURE_B()] });
    const reverse = resolve({ parcel: PARCEL_TOUCHING_A(), features: [FEATURE_B(), FEATURE_A()] });
    expect(JSON.stringify(forward)).toBe(JSON.stringify(reverse));
  });

  test("boundary hits and their review records come back in canonical order", () => {
    // Two zones touched at once: the ordering of the escalation must be a
    // property of the data, not of the array the caller happened to build.
    const corner = () => parcel(square(10, 10, 12, 12));
    const forward = resolve({ parcel: corner(), features: [FEATURE_A(), FEATURE_B()] });
    const reverse = resolve({ parcel: corner(), features: [FEATURE_B(), FEATURE_A()] });
    expect(JSON.stringify(forward.manualReview)).toBe(JSON.stringify(reverse.manualReview));
    expect(forward.hits.map((h) => h.featureId)).toEqual(["zone-a", "zone-b"]);
    expect(forward.ambiguousRulePackIds).toEqual(["base-a", "base-b"]);
  });
});

describe("E85 Phase 7 — a boundary-touching overlay does not erase a proven base zone", () => {
  /** An overlay whose western edge lies exactly on the parcel's eastern edge at x=4. */
  const touchingOverlay = () => feature({ featureId: "overlay-edge", geometry: square(4, 2, 8, 6), rulePackIds: ["overlay-edge"], featureClass: "OVERLAY" });
  const result = () => resolve({ parcel: PARCEL_IN_A(), features: [FEATURE_A(), touchingOverlay()] });

  test("the base zone is applicable and stays applicable", () => {
    expect(result().applicableRulePackIds).toEqual(["base-a"]);
  });

  test("the overlay does not automatically apply", () => {
    expect(result().applicableRulePackIds).not.toContain("overlay-edge");
    expect(result().hits.find((h) => h.featureId === "overlay-edge")?.applicability).not.toBe("APPLIES");
  });

  test("the overlay does not automatically fail to apply", () => {
    const hit = result().hits.find((h) => h.featureId === "overlay-edge");
    expect(hit?.relation).toBe("BOUNDARY_TOUCH");
    expect(hit?.applicability).toBe("MANUAL_REVIEW_REQUIRED");
    expect(hit?.applicability).not.toBe("DOES_NOT_APPLY");
    expect(result().ambiguousRulePackIds).toEqual(["overlay-edge"]);
  });

  test("the base-zone determination is reported as settled alongside the open overlay question", () => {
    const r = result();
    expect(r.status).toBe("MANUAL_REVIEW_REQUIRED");
    // The proven containment is still legible: it is in the applicable set, it
    // is not in the ambiguous set, and its own hit says CONTAINS.
    expect(r.hits.find((h) => h.featureId === "zone-a")?.relation).toBe("CONTAINS");
    expect(r.hits.find((h) => h.featureId === "zone-a")?.applicability).toBe("APPLIES");
    expect(r.dataGaps.some((g) => g.reasonCode === "ZONING_NOT_FOUND")).toBe(false);
  });

  test("nothing about the escalation ranks the two layers", () => {
    // The overlay is withheld because of WHERE it sits, not because an overlay
    // loses to a base zone. Reversing the classes reaches the same shape of
    // answer with the roles swapped.
    const swapped = resolve({
      parcel: PARCEL_IN_A(),
      features: [feature({ featureId: "zone-a", geometry: ZONE_A(), rulePackIds: ["base-a"], featureClass: "OVERLAY", datasetId: OVERLAY_DATASET }), feature({ featureId: "site-edge", geometry: square(4, 2, 8, 6), rulePackIds: ["site-edge"], featureClass: "SITE_SPECIFIC", datasetId: OVERLAY_DATASET })],
    });
    expect(swapped.applicableRulePackIds).toEqual(["base-a"]);
    expect(swapped.ambiguousRulePackIds).toEqual(["site-edge"]);
  });
});

describe("E85 Phase 7 — no zone found is not the same as no dataset supplied", () => {
  test("features supplied and none matches yields ZONING_NOT_FOUND — a statement about the world", () => {
    const r = resolve({ parcel: PARCEL_OUTSIDE(), features: [FEATURE_A(), FEATURE_B()] });
    expect(r.dataGaps.some((g) => g.reasonCode === "ZONING_NOT_FOUND")).toBe(true);
    expect(r.findings.some((f) => f.code === "NO_BASE_ZONE_MATCH")).toBe(true);
    expect(r.status).toBe("DATA_GAP");
  });

  test("no features at all yields GEOMETRY_UNAVAILABLE, never ZONING_NOT_FOUND", () => {
    const r = resolve({ parcel: PARCEL_IN_A(), features: [] });
    expect(r.dataGaps.map((g) => g.reasonCode)).toEqual(["GEOMETRY_UNAVAILABLE"]);
    expect(r.dataGaps[0].reason).toContain("NOT reported as an absence of zoning");
    expect(r.status).toBe("DATA_GAP");
  });

  test("only an overlay supplied yields a base-layer gap, not a finding that the parcel is unzoned", () => {
    const r = resolve({ parcel: PARCEL_IN_A_AND_OVERLAY(), features: [FEATURE_OVERLAY()] });
    expect(r.dataGaps.some((g) => g.reasonCode === "ZONING_NOT_FOUND")).toBe(false);
    expect(r.findings.some((f) => f.code === "NO_SPATIAL_EVIDENCE_SUPPLIED")).toBe(true);
    // The overlay that WAS supplied still resolves.
    expect(r.applicableRulePackIds).toEqual(["overlay-x"]);
  });

  test("base features excluded before comparison never produce a not-found claim", () => {
    // Every base feature is in the wrong CRS, so nothing was proved either way.
    const wrongCrs = feature({ featureId: "zone-a", geometry: square(0, 0, 10, 10, OTHER_CRS), rulePackIds: ["base-a"] });
    const r = resolve({ parcel: PARCEL_IN_A(), features: [wrongCrs] });
    expect(r.dataGaps.some((g) => g.reasonCode === "ZONING_NOT_FOUND")).toBe(false);
    expect(r.dataGaps.some((g) => g.reasonCode === "SPATIAL_REFERENCE_MISMATCH")).toBe(true);
  });

  test("all four no-base-zone states stay distinguishable from one another", () => {
    // Each row is a different thing to do next: go back to the publisher, obtain
    // a layer, fix a projection, or ask a planner. Collapsing any two of them
    // into one code sends somebody on the wrong errand.
    const compared = resolve({ parcel: PARCEL_OUTSIDE(), features: [FEATURE_A(), FEATURE_B()] });
    const noDataset = resolve({ parcel: PARCEL_IN_A_AND_OVERLAY(), features: [FEATURE_OVERLAY()] });
    const incomparable = resolve({ parcel: PARCEL_IN_A(), features: [feature({ featureId: "zone-a", geometry: square(0, 0, 10, 10, OTHER_CRS), rulePackIds: ["base-a"] })] });
    const boundaryOnly = resolve({ parcel: parcel(square(10, 2, 12, 4)), features: [FEATURE_A()] });

    const shape = (r: E85SpatialApplicabilityResult) => ({ status: r.status, gaps: r.dataGaps.map((g) => g.reasonCode).sort() });

    expect(shape(compared)).toEqual({ status: "DATA_GAP", gaps: ["ZONING_NOT_FOUND"] });
    expect(shape(noDataset)).toEqual({ status: "RESOLVED_WITH_WARNINGS", gaps: ["GEOMETRY_UNAVAILABLE"] });
    expect(shape(incomparable)).toEqual({ status: "DATA_GAP", gaps: ["SPATIAL_REFERENCE_MISMATCH"] });
    expect(shape(boundaryOnly)).toEqual({ status: "MANUAL_REVIEW_REQUIRED", gaps: [] });

    // And the four are pairwise distinct, not merely individually asserted.
    const signatures = [compared, noDataset, incomparable, boundaryOnly].map((r) => JSON.stringify(shape(r)));
    expect(new Set(signatures).size).toBe(4);
  });
});

describe("E85 Phase 7 — a point parcel on a boundary keeps its geometric answer", () => {
  test("a pin on a zone edge is still classified BOUNDARY_TOUCH by the geometry", () => {
    // Only the legal mapping was corrected in Phase 7A. The geometric
    // classification of an edge or vertex was already right and is untouched.
    const r = resolve({ parcel: parcel(point(10, 5)), features: [FEATURE_A()] });
    expect(r.hits[0].relation).toBe("BOUNDARY_TOUCH");
  });

  test("a pin on a vertex is likewise BOUNDARY_TOUCH", () => {
    expect(resolve({ parcel: parcel(point(0, 0)), features: [FEATURE_A()] }).hits[0].relation).toBe("BOUNDARY_TOUCH");
  });

  test("the pack is withheld for review rather than applied or discarded", () => {
    const r = resolve({ parcel: parcel(point(10, 5)), features: [FEATURE_A()] });
    expect(r.applicableRulePackIds).toEqual([]);
    expect(r.ambiguousRulePackIds).toEqual(["base-a"]);
    expect(r.status).toBe("MANUAL_REVIEW_REQUIRED");
  });

  test("a pin strictly inside still applies cleanly", () => {
    expect(resolve({ parcel: parcel(point(5, 5)), features: [FEATURE_A()] }).applicableRulePackIds).toEqual(["base-a"]);
  });
});

describe("E85 Phase 7 — CRS mismatch refuses the comparison", () => {
  const mismatched = () =>
    resolve({
      parcel: PARCEL_IN_A(),
      features: [FEATURE_A(), feature({ featureId: "overlay-x", geometry: square(5, 5, 15, 15, OTHER_CRS), rulePackIds: ["overlay-x"], featureClass: "OVERLAY" })],
    });

  test("the mismatched feature is UNDETERMINED, which is not DISJOINT", () => {
    const hit = mismatched().hits.find((h) => h.featureId === "overlay-x");
    expect(hit?.relation).toBe("UNDETERMINED");
    expect(hit?.applicability).toBe("UNDETERMINED");
  });

  test("the gap names the distinct spatial-reference reason, not a missing-geometry one", () => {
    const gap = mismatched().dataGaps.find((g) => g.reasonCode === "SPATIAL_REFERENCE_MISMATCH");
    expect(gap).toBeDefined();
    expect(gap?.reason).toContain("EPSG:26910");
    expect(gap?.reason).toContain("EPSG:4326");
    expect(gap?.resolutionHint).toContain("E85 performs no coordinate conversion");
  });

  test("no coordinate conversion is attempted — the numbers are not assumed comparable", () => {
    // Were the CRS ignored, this overlay would contain the parcel and apply.
    expect(mismatched().applicableRulePackIds).not.toContain("overlay-x");
  });

  test("an unrelated layer's CRS problem does not sink the base-zone determination", () => {
    expect(mismatched().applicableRulePackIds).toEqual(["base-a"]);
    expect(mismatched().status).not.toBe("DATA_GAP");
  });
});

describe("E85 Phase 7 — missing and malformed geometry", () => {
  test("a parcel with no geometry produces a gap, never an assumed shape", () => {
    const r = resolve({ parcel: parcel(undefined), features: [FEATURE_A()] });
    expect(r.status).toBe("DATA_GAP");
    expect(r.dataGaps[0].reasonCode).toBe("GEOMETRY_UNAVAILABLE");
    expect(r.dataGaps[0].reason).toContain("not a point, not an origin");
    expect(r.applicableRulePackIds).toEqual([]);
    expect(r.hits).toEqual([]);
  });

  test("a missing parcel never becomes the origin, and never selects every pack", () => {
    const r = resolve({ parcel: parcel(undefined), features: [FEATURE_A(), FEATURE_B(), FEATURE_OVERLAY()] });
    expect(r.applicableRulePackIds).toEqual([]);
    expect(JSON.stringify(r)).not.toContain("[0,0]");
  });

  test("a malformed feature is excluded with a typed gap rather than repaired", () => {
    const broken = feature({ featureId: "broken", geometry: { type: "POLYGON", crs: CRS, exterior: [pos(0, 0), pos(1, 1)] }, rulePackIds: ["broken-pack"] });
    const r = resolve({ parcel: PARCEL_IN_A(), features: [FEATURE_A(), broken] });
    expect(r.findings.some((f) => f.code === "GEOMETRY_INVALID")).toBe(true);
    expect(r.applicableRulePackIds).not.toContain("broken-pack");
    expect(r.applicableRulePackIds).toEqual(["base-a"]);
  });

  test("a malformed parcel stops the comparison rather than being silently closed", () => {
    const r = resolve({ parcel: parcel({ type: "POLYGON", crs: CRS, exterior: [pos(0, 0), pos(1, 1)] }), features: [FEATURE_A()] });
    expect(r.status).toBe("DATA_GAP");
    expect(r.dataGaps[0].resolutionHint).toContain("does not repair");
  });

  test("ordinary spatial uncertainty never throws", () => {
    const cases: Partial<E85SpatialApplicabilityRequest>[] = [
      { parcel: parcel(undefined), features: [FEATURE_A()] },
      { parcel: PARCEL_IN_A(), features: [] },
      { parcel: PARCEL_IN_A(), features: [feature({ featureId: "x", geometry: { type: "POLYGON", crs: CRS, exterior: [] }, rulePackIds: [] })] },
      { parcel: parcel(point(5, 5)), features: [FEATURE_A()] },
    ];
    for (const c of cases) {
      expect(() => resolve(c as never)).not.toThrow();
    }
  });
});

describe("E85 Phase 7 — dataset versioning is explicit", () => {
  test("a feature citing an unregistered release is excluded, not compared against another release", () => {
    const stale = feature({ featureId: "zone-a", geometry: ZONE_A(), rulePackIds: ["base-a"], datasetVersionId: "2025-12" });
    const r = resolve({ parcel: PARCEL_IN_A(), features: [stale] });
    expect(r.findings.some((f) => f.code === "DATASET_VERSION_UNREGISTERED")).toBe(true);
    expect(r.applicableRulePackIds).toEqual([]);
    expect(r.hits[0].relation).toBe("UNDETERMINED");
  });

  test("newer-version-wins is not applied", () => {
    const registry = createE85SpatialDatasetRegistry([dataset({ datasetId: BASE_DATASET, versionIds: ["2025-12"] })]);
    const r = resolveE85SpatialApplicability({ parcel: PARCEL_IN_A(), features: [FEATURE_A()], registry, resolvedAt: RESOLVED_AT });
    // The feature cites 2026-06; only 2025-12 is registered. Neither is preferred.
    expect(r.applicableRulePackIds).toEqual([]);
    expect(r.findings.find((f) => f.code === "DATASET_VERSION_UNREGISTERED")?.message).toContain("Newer-version-wins is not applied");
  });

  test("omitting the registry is recorded as unverified rather than passing silently", () => {
    const r = resolveE85SpatialApplicability({ parcel: PARCEL_IN_A(), features: [FEATURE_A()], resolvedAt: RESOLVED_AT });
    expect(r.findings.some((f) => f.code === "DATASET_VERSION_UNVERIFIED")).toBe(true);
    expect(r.applicableRulePackIds).toEqual(["base-a"]);
  });

  test("exact version lookup has no nearest-match fallback", () => {
    const d = dataset({ datasetId: BASE_DATASET, versionIds: ["2026-06"] });
    expect(findE85SpatialDatasetVersion(d, "2026-06")?.versionId).toBe("2026-06");
    expect(findE85SpatialDatasetVersion(d, "2026-05")).toBeUndefined();
    expect(findE85SpatialDatasetVersion(d, "2026")).toBeUndefined();
  });
});

describe("E85 Phase 7 — dataset registry hygiene", () => {
  test("a duplicate dataset id is refused rather than resolved by registration order", () => {
    const registry = createE85SpatialDatasetRegistry([dataset({ datasetId: BASE_DATASET }), dataset({ datasetId: BASE_DATASET })]);
    expect(registry.find(BASE_DATASET)).toBeUndefined();
    expect(registry.problems().map((p) => p.code)).toContain("DUPLICATE_DATASET_ID");
  });

  test("a duplicate version within one dataset is refused", () => {
    const registry = createE85SpatialDatasetRegistry([dataset({ datasetId: BASE_DATASET, versionIds: ["v1", "v1"] })]);
    expect(registry.problems().map((p) => p.code)).toContain("DUPLICATE_DATASET_VERSION");
  });

  test("a dataset with no versions is refused", () => {
    const registry = createE85SpatialDatasetRegistry([dataset({ datasetId: BASE_DATASET, versionIds: [] })]);
    expect(registry.problems().map((p) => p.code)).toContain("NO_REGISTERED_VERSIONS");
  });

  test("a malformed dataset id is refused", () => {
    const registry = createE85SpatialDatasetRegistry([dataset({ datasetId: "C:\\layers\\zoning.shp" })]);
    expect(registry.problems().map((p) => p.code)).toContain("MALFORMED_DATASET_ID");
  });

  test("dataset ids are stable slugs, never paths or URLs", () => {
    expect(buildE85SpatialDatasetId({ jurisdictionId: JURISDICTION, datasetSlug: "zoning-districts" })).toBe(BASE_DATASET);
    expect(isValidE85SpatialDatasetId("https://example.test/layer")).toBe(false);
    expect(() => buildE85SpatialDatasetId({ jurisdictionId: "XX YY", datasetSlug: "zoning" })).toThrow(/stable and machine-independent/);
  });
});

describe("E85 Phase 7 — temporal separation survives", () => {
  test("an unknown legal effective date stays unknown, with publication explicitly ruled out", () => {
    const undated = feature({ featureId: "zone-a", geometry: ZONE_A(), rulePackIds: ["base-a"], temporal: "UNKNOWN" });
    const r = resolve({ parcel: PARCEL_IN_A(), features: [undated] });
    const finding = r.findings.find((f) => f.code === "TEMPORAL_APPLICABILITY_UNKNOWN");
    expect(finding?.severity).toBe("WARNING");
    expect(finding?.message).toContain("says nothing about when the boundary it depicts took effect");
    expect(r.hits[0].temporal.effectiveDateBasis).toBe("UNKNOWN");
  });

  test("a publication date is never promoted into a legal effective date", () => {
    // The dataset version carries publishedDate 2026-06-15 and basis UNKNOWN.
    const version = { versionId: "2026-06", publishedDate: "2026-06-15", observedAt: RESOLVED_AT, effectiveDateBasis: "UNKNOWN" as const };
    expect(deriveE85SpatialTemporalWindow(version)).toEqual({ effectiveDateBasis: "UNKNOWN" });
  });

  test("an established effective date is carried through unchanged", () => {
    expect(deriveE85SpatialTemporalWindow({ versionId: "v", effectiveFrom: "2024-01-01", effectiveDateBasis: "SOURCE_STATED" })).toEqual({
      effectiveFrom: "2024-01-01",
      effectiveDateBasis: "SOURCE_STATED",
    });
  });

  test("an undated feature still applies — unknown timing does not withdraw a boundary", () => {
    const undated = feature({ featureId: "zone-a", geometry: ZONE_A(), rulePackIds: ["base-a"], temporal: "UNKNOWN" });
    expect(resolve({ parcel: PARCEL_IN_A(), features: [undated] }).applicableRulePackIds).toEqual(["base-a"]);
  });
});

describe("E85 Phase 7 — rights never move a boundary", () => {
  const limitedRegistry = () =>
    createE85SpatialDatasetRegistry([dataset({ datasetId: BASE_DATASET, licenseStatus: "LICENSE_UNKNOWN", accessStatus: "AVAILABLE" }), dataset({ datasetId: OVERLAY_DATASET, datasetType: "OVERLAY" })]);

  test("a licence-unknown dataset keeps full spatial authority", () => {
    const r = resolveE85SpatialApplicability({ parcel: PARCEL_IN_A(), features: [FEATURE_A()], registry: limitedRegistry(), resolvedAt: RESOLVED_AT });
    expect(r.applicableRulePackIds).toEqual(["base-a"]);
  });

  test("the limitation is reported, and says so explicitly", () => {
    const r = resolveE85SpatialApplicability({ parcel: PARCEL_IN_A(), features: [FEATURE_A()], registry: limitedRegistry(), resolvedAt: RESOLVED_AT });
    const finding = r.findings.find((f) => f.code === "DATASET_LICENSE_LIMITATION");
    expect(finding?.severity).toBe("WARNING");
    expect(finding?.message).toContain("never where a boundary lies");
  });

  test("licensing does not break a tie between two base zones", () => {
    const r = resolveE85SpatialApplicability({ parcel: PARCEL_SPLIT(), features: [FEATURE_A(), FEATURE_B()], registry: limitedRegistry(), resolvedAt: RESOLVED_AT });
    expect(r.applicableRulePackIds).toEqual([]);
    expect(r.ambiguousRulePackIds).toEqual(["base-a", "base-b"]);
  });
});

describe("E85 Phase 7 — duplicates and independent agreement", () => {
  test("the identical feature supplied twice is counted once", () => {
    const r = resolve({ parcel: PARCEL_IN_A(), features: [FEATURE_A(), FEATURE_A()] });
    expect(r.hits.filter((h) => h.featureId === "zone-a")).toHaveLength(1);
    expect(r.findings.some((f) => f.code === "DUPLICATE_FEATURE_COLLAPSED")).toBe(true);
    expect(r.applicableRulePackIds).toEqual(["base-a"]);
  });

  test("supplying a layer twice does not strengthen it", () => {
    const once = resolve({ parcel: PARCEL_IN_A(), features: [FEATURE_A()] });
    const twice = resolve({ parcel: PARCEL_IN_A(), features: [FEATURE_A(), FEATURE_A()] });
    expect(twice.parcelMatch).toBe(once.parcelMatch);
    expect(twice.applicableRulePackIds).toEqual(once.applicableRulePackIds);
  });

  test("the same boundary from two independent datasets keeps both provenance chains", () => {
    const second = feature({ featureId: "zone-a-mirror", geometry: ZONE_A(), rulePackIds: ["base-a"], featureClass: "OTHER", datasetId: OVERLAY_DATASET });
    const r = resolve({ parcel: PARCEL_IN_A(), features: [FEATURE_A(), second] });
    expect(r.hits.filter((h) => h.applicability === "APPLIES")).toHaveLength(2);
    const finding = r.findings.find((f) => f.code === "INDEPENDENT_DATASET_AGREEMENT");
    expect(finding?.datasetIds).toEqual([BASE_DATASET, OVERLAY_DATASET].sort());
    expect(finding?.message).toContain("never counted as extra authority");
  });

  test("identity is dataset plus release plus feature — a different release is a different feature", () => {
    const a = { datasetId: "d", datasetVersionId: "v1", featureId: "f", jurisdictionId: JURISDICTION, crs: CRS };
    const b = { ...a, datasetVersionId: "v2" };
    expect(e85SpatialFeatureIdentityKey(a)).not.toBe(e85SpatialFeatureIdentityKey(b));
  });
});

describe("E85 Phase 7 — determinism", () => {
  const features = () => [FEATURE_A(), FEATURE_B(), FEATURE_OVERLAY()];

  test("the same inputs give byte-identical output", () => {
    const a = resolve({ parcel: PARCEL_IN_A_AND_OVERLAY(), features: features() });
    const b = resolve({ parcel: PARCEL_IN_A_AND_OVERLAY(), features: features() });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("every permutation of three features gives byte-identical output", () => {
    const [f1, f2, f3] = features();
    const permutations = [
      [f1, f2, f3],
      [f1, f3, f2],
      [f2, f1, f3],
      [f2, f3, f1],
      [f3, f1, f2],
      [f3, f2, f1],
    ];
    const outputs = permutations.map((p) => JSON.stringify(resolve({ parcel: PARCEL_IN_A_AND_OVERLAY(), features: p })));
    expect(new Set(outputs).size).toBe(1);
  });

  test("a contested result is order-independent too", () => {
    const forward = JSON.stringify(resolve({ parcel: PARCEL_SPLIT(), features: [FEATURE_A(), FEATURE_B()] }));
    const reverse = JSON.stringify(resolve({ parcel: PARCEL_SPLIT(), features: [FEATURE_B(), FEATURE_A()] }));
    expect(forward).toBe(reverse);
  });

  test("ring orientation does not change applicability", () => {
    const reversed = feature({ featureId: "zone-a", geometry: { type: "POLYGON", crs: CRS, exterior: [pos(0, 0), pos(0, 10), pos(10, 10), pos(10, 0)] }, rulePackIds: ["base-a"] });
    const a = resolve({ parcel: PARCEL_IN_A(), features: [FEATURE_A()] });
    const b = resolve({ parcel: PARCEL_IN_A(), features: [reversed] });
    expect(b.applicableRulePackIds).toEqual(a.applicableRulePackIds);
    expect(b.hits[0].relation).toBe(a.hits[0].relation);
  });

  test("hits come back in canonical order regardless of supply order", () => {
    const r = resolve({ parcel: PARCEL_IN_A(), features: [FEATURE_OVERLAY(), FEATURE_B(), FEATURE_A()] });
    const keys = r.hits.map((h) => `${h.datasetId}|${h.featureId}`);
    expect(keys).toEqual([...keys].sort());
  });

  test("no clock is read — resolvedAt comes from the caller or the evidence", () => {
    const explicit = resolve({ parcel: PARCEL_IN_A(), features: [FEATURE_A()] });
    expect(explicit.resolvedAt).toBe(RESOLVED_AT);
    const derived = resolveE85SpatialApplicability({
      parcel: parcel(square(2, 2, 4, 4)),
      features: [feature({ featureId: "zone-a", geometry: ZONE_A(), rulePackIds: ["base-a"], observedAt: "2026-03-04T00:00:00.000Z" })],
    });
    expect(derived.resolvedAt).toBe("2026-03-04T00:00:00.000Z");
  });

  test("with no timestamp anywhere, the fallback is a constant rather than now", () => {
    const r = resolveE85SpatialApplicability({
      parcel: { parcelReferenceId: "p", geometry: square(2, 2, 4, 4) },
      features: [feature({ featureId: "zone-a", geometry: ZONE_A(), rulePackIds: ["base-a"] })],
    });
    expect(r.resolvedAt).toBe("1970-01-01T00:00:00.000Z");
  });
});

describe("E85 Phase 7 — inputs are never mutated", () => {
  test("frozen parcel, features and registry survive resolution", () => {
    const p = deepFreeze(PARCEL_IN_A());
    const f = deepFreeze([FEATURE_A(), FEATURE_B(), FEATURE_OVERLAY()]);
    expect(() => resolve({ parcel: p, features: f })).not.toThrow();
  });

  test("the supplied feature array is not reordered in place", () => {
    const supplied = [FEATURE_OVERLAY(), FEATURE_B(), FEATURE_A()];
    const before = supplied.map((x) => x.featureId);
    resolve({ parcel: PARCEL_IN_A(), features: supplied });
    expect(supplied.map((x) => x.featureId)).toEqual(before);
  });

  test("feature geometry is unchanged after resolution", () => {
    const f = FEATURE_A();
    const snapshot = JSON.stringify(f);
    resolve({ parcel: PARCEL_IN_A(), features: [f] });
    expect(JSON.stringify(f)).toBe(snapshot);
  });

  test("resolving twice from one frozen input set gives identical results", () => {
    const p = deepFreeze(PARCEL_SPLIT());
    const f = deepFreeze([FEATURE_A(), FEATURE_B()]);
    expect(JSON.stringify(resolve({ parcel: p, features: f }))).toBe(JSON.stringify(resolve({ parcel: p, features: f })));
  });
});

describe("E85 Phase 7 — geometry names candidates, it never ranks them", () => {
  const contested = () => resolve({ parcel: PARCEL_IN_A_AND_OVERLAY(), features: [FEATURE_A(), FEATURE_OVERLAY()] });

  /**
   * Checked against FIELD NAMES and non-prose values rather than the raw
   * serialization. Phase 7's own findings say in prose that precedence is
   * decided elsewhere — that sentence is the disclaimer, not the offence, and a
   * blanket substring scan would push toward deleting the very explanation a
   * reviewer needs. What must not exist is somewhere to PUT a ranking.
   */
  function structuralKeys(value: unknown, keys: string[] = []): string[] {
    if (Array.isArray(value)) value.forEach((v) => structuralKeys(v, keys));
    else if (value !== null && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        keys.push(k);
        structuralKeys(v, keys);
      }
    }
    return keys;
  }

  const PROSE_FIELDS = new Set(["message", "detail", "explanation", "reason", "resolutionHint", "interpretationNote", "displayName"]);

  function structuralValues(value: unknown, out: string[] = []): string[] {
    if (Array.isArray(value)) value.forEach((v) => structuralValues(v, out));
    else if (value !== null && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        if (PROSE_FIELDS.has(k)) continue;
        if (typeof v === "string") out.push(v);
        else structuralValues(v, out);
      }
    }
    return out;
  }

  test("no field exists that could hold a ranking", () => {
    const keys = structuralKeys(contested()).map((k) => k.toLowerCase());
    for (const forbidden of ["priority", "rank", "precedence", "precedenceweight", "winsover", "overrides", "weight", "supersedes", "score", "order"]) {
      expect({ forbidden, present: keys.some((k) => k.includes(forbidden)) }).toEqual({ forbidden, present: false });
    }
  });

  test("no structural value encodes a ranking either", () => {
    const values = structuralValues(contested()).map((v) => v.toLowerCase());
    for (const forbidden of ["priority", "rank", "winsover", "supersedes"]) {
      expect({ forbidden, present: values.some((v) => v.includes(forbidden)) }).toEqual({ forbidden, present: false });
    }
  });

  test("numeric fields carry no weighting — the only number in a result is a count nobody ranks by", () => {
    const numeric = JSON.stringify(contested()).match(/"[a-zA-Z]+":\s*-?\d+(\.\d+)?/g) ?? [];
    expect(numeric).toEqual([]);
  });

  test("feature class carries no hierarchy — an overlay and a base zone come back alike", () => {
    const r = contested();
    const base = r.hits.find((h) => h.featureClass === "BASE_ZONE");
    const overlay = r.hits.find((h) => h.featureClass === "OVERLAY");
    expect(base?.applicability).toBe("APPLIES");
    expect(overlay?.applicability).toBe("APPLIES");
    // Both are simply applicable; nothing marks either as winning.
    expect(Object.keys(base ?? {})).toEqual(Object.keys(overlay ?? {}));
  });

  test("a SITE_SPECIFIC feature does not outrank a base zone spatially", () => {
    const site = feature({ featureId: "site-1", geometry: ZONE_A(), rulePackIds: ["site-1"], featureClass: "SITE_SPECIFIC", datasetId: OVERLAY_DATASET });
    const r = resolve({ parcel: PARCEL_IN_A(), features: [FEATURE_A(), site] });
    // Both apply. Which one governs where they disagree is Phase 6's question.
    expect(r.applicableRulePackIds).toEqual(["base-a", "site-1"]);
    expect(r.manualReview).toEqual([]);
  });

  test("mutual exclusivity is configurable, not a hardcoded hierarchy", () => {
    const site = feature({ featureId: "site-1", geometry: ZONE_A(), rulePackIds: ["site-1"], featureClass: "SITE_SPECIFIC", datasetId: OVERLAY_DATASET });
    const r = resolve({ parcel: PARCEL_IN_A(), features: [FEATURE_A(), site], mutuallyExclusiveClasses: ["BASE_ZONE", "SITE_SPECIFIC"] });
    // Declared mutually exclusive, they now contest — and still neither wins.
    expect(r.status).toBe("MANUAL_REVIEW_REQUIRED");
    expect(r.applicableRulePackIds).toEqual([]);
    expect(r.ambiguousRulePackIds).toEqual(["base-a", "site-1"]);
  });

  test("no rule values appear in spatial output — Phase 7 carries identities only", () => {
    const serialized = JSON.stringify(contested()).toLowerCase();
    for (const forbidden of ["maxfsr", "maxheight", "setback", "parking", "permission", "gfa", "storeys"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

describe("E85 Phase 7 — parcel match reflects what the geometry actually showed", () => {
  test("a clean polygon containment is high", () => {
    expect(resolve({ parcel: PARCEL_IN_A(), features: [FEATURE_A()] }).parcelMatch).toBe("high");
  });

  test("a point parcel caps at moderate — a pin inside a zone is not a lot inside a zone", () => {
    expect(resolve({ parcel: parcel(point(5, 5)), features: [FEATURE_A()] }).parcelMatch).toBe("moderate");
  });

  test("an ambiguous match is low", () => {
    expect(resolve({ parcel: PARCEL_SPLIT(), features: [FEATURE_A(), FEATURE_B()] }).parcelMatch).toBe("low");
  });

  test("no match at all is very_low", () => {
    expect(resolve({ parcel: PARCEL_OUTSIDE(), features: [FEATURE_A()] }).parcelMatch).toBe("very_low");
  });

  test("a proven containment with an open question elsewhere caps at moderate rather than collapsing to low", () => {
    // The parcel sits squarely inside B; only A's lot line is touched. That is a
    // caveat about a different feature, not a doubt about the containment.
    expect(resolve({ parcel: PARCEL_TOUCHING_A(), features: [FEATURE_A(), FEATURE_B()] }).parcelMatch).toBe("moderate");
  });

  test("a matched-but-contested parcel still outranks an unmatched one", () => {
    // The ordering these four cases must preserve: a split parcel WAS matched,
    // to two zones, which is weaker than a clean match and stronger than none.
    const clean = resolve({ parcel: PARCEL_IN_A(), features: [FEATURE_A()] }).parcelMatch;
    const caveated = resolve({ parcel: PARCEL_TOUCHING_A(), features: [FEATURE_A(), FEATURE_B()] }).parcelMatch;
    const split = resolve({ parcel: PARCEL_SPLIT(), features: [FEATURE_A(), FEATURE_B()] }).parcelMatch;
    const none = resolve({ parcel: PARCEL_OUTSIDE(), features: [FEATURE_A()] }).parcelMatch;
    expect([clean, caveated, split, none]).toEqual(["high", "moderate", "low", "very_low"]);
  });
});

describe("E85 Phase 7 — provenance reaches the engine-wide vocabulary", () => {
  test("spatial provenance projects into E85Provenance, filling the gisLocator Phase 3 defined", () => {
    const r = resolve({ parcel: PARCEL_IN_A(), features: [FEATURE_A()] });
    const projected = spatialProvenanceToE85Provenance(r.hits.find((h) => h.featureId === "zone-a")!.spatialProvenance);
    expect(projected.sourceId).toBe(BASE_DATASET);
    expect(projected.sourceVersionId).toBe(DATASET_VERSION);
    expect(projected.gisLocator?.gisDatasetId).toBe(BASE_DATASET);
    expect(projected.gisLocator?.gisFeatureId).toBe("zone-a");
    expect(projected.gisLocator?.gisLayerId).toBe("districts");
  });

  test("every hit answers which exact feature of which release caused it", () => {
    const r = resolve({ parcel: PARCEL_IN_A_AND_OVERLAY(), features: [FEATURE_A(), FEATURE_OVERLAY()] });
    for (const hit of r.hits) {
      expect(hit.spatialProvenance.featureId).toBe(hit.featureId);
      expect(hit.spatialProvenance.datasetId).toBe(hit.datasetId);
      expect(hit.spatialProvenance.datasetVersionId).toBe(hit.datasetVersionId);
      expect(hit.spatialProvenance.publisher).toBe("Testburgh Open Data");
    }
  });

  test("the applicable-pack helper and the field agree", () => {
    const r = resolve({ parcel: PARCEL_IN_A(), features: [FEATURE_A()] });
    expect(e85ApplicableRulePackIds(r)).toEqual(r.applicableRulePackIds);
  });

  test("blocking findings are detectable from the findings list alone", () => {
    expect(hasBlockingSpatialFindingCode(resolve({ parcel: PARCEL_SPLIT(), features: [FEATURE_A(), FEATURE_B()] }).findings)).toBe(true);
    expect(hasBlockingSpatialFindingCode(resolve({ parcel: PARCEL_IN_A(), features: [FEATURE_A()] }).findings)).toBe(false);
  });
});

/**
 * InvestScape™ E85 Phase 9 — decision orchestration & material readiness tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Everything here is synthetic and offline: invented publisher, invented
 * jurisdiction, no network, no GIS library, no file read.
 *
 * The suite is organised around the two opposite ways an orchestration layer
 * gets a regulatory answer confidently wrong:
 *
 *   IT LAUNDERS A GAP. Something upstream is unresolved, something downstream
 *   nonetheless produces a number, and the number is reported as the answer.
 *   Phase 8A proved how easy this is here specifically — Phase 7 returns the
 *   same status for a fully-mapped parcel and for one sitting inside a polygon
 *   nobody mapped.
 *
 *   IT BLOCKS EVERYTHING. Every upstream problem is treated as fatal, so one
 *   unmapped polygon on the far side of a municipal layer blocks every parcel in
 *   the city, and callers learn to ignore blockers entirely.
 *
 * The pair of tests that matter most are therefore the same snapshot read twice,
 * from two different parcels: `UNMAPPED DISJOINT` and `UNMAPPED APPLICABLE`.
 */
import {
  assembleE85DecisionPackage,
  createE85SpatialAdapterRegistry,
  createE85SpatialDatasetRegistry,
  determineE85DecisionStatus,
  e85DecisionBlockers,
  e85RelationMateriality,
  hasBlockingSpatialSourceFinding,
  normalizeE85SpatialSnapshot,
  resolveE85RulePacks,
  E85DecisionPackage,
  E85DecisionRequest,
  E85ParcelReference,
  E85ParcelSpatialReference,
  E85PolicyVersion,
  E85RawSpatialSourceSnapshot,
  E85RequestedAnalysis,
  E85RulePack,
  E85SpatialNormalizationResult,
  E85SpatialSourceFinding,
  E85SpatialSourceFindingCode,
  E85SpatialSourceSeverity,
  E85TemporalRequestError,
} from "../../src/zoning-land-use-engine";
import { referenceZoningDataset, referenceZoningSpatialAdapter } from "../../src/zoning-land-use-engine/adapters/spatial/reference";
import {
  deepFreezeSnapshot,
  NORMALIZED_AT,
  PARCEL_IN_RB_A,
  PARCEL_IN_RB_A_AND_OVERLAY,
  PARCEL_IN_UNMAPPED_RB_C,
  PARCEL_STRADDLING_A_AND_B,
  PARCEL_TOUCHING_UNMAPPED_C,
  RECORD_A,
  RECORD_B,
  RECORD_BOWTIE,
  RECORD_OVERLAY,
  RECORD_UNMAPPED_OVERLAY,
  RECORD_UNMAPPED_ZONE,
  REFERENCE_DATASET_ID,
  REFERENCE_RELEASE,
  snapshot,
} from "./fixtures/spatial-snapshots";
import { pack, COMPOSED_AT, ZONE, JURISDICTION as PACK_JURISDICTION } from "./fixtures/composition-packs";
import type { E85NormalizationFinding } from "../../src/zoning-land-use-engine/normalization-finding-types";

const ASSEMBLED_AT = "2026-03-01T00:00:00.000Z";
const RESOLVED_AT = "2026-02-12T00:00:00.000Z";
const ALL_ANALYSES: readonly E85RequestedAnalysis[] = ["USE", "DENSITY", "DIMENSIONAL"];

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function datasets() {
  return createE85SpatialDatasetRegistry([referenceZoningDataset()]);
}

/** Phase 8, run exactly as a caller would before handing its RESULT to Phase 9. */
function normalize(snap: E85RawSpatialSourceSnapshot): E85SpatialNormalizationResult {
  const registry = createE85SpatialAdapterRegistry([referenceZoningSpatialAdapter]);
  if (!registry.ok) throw new Error("adapter registry problems");
  return normalizeE85SpatialSnapshot(snap, datasets(), registry.registry, { normalizedAt: NORMALIZED_AT });
}

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

function policy(): E85PolicyVersion {
  return { policyVersionId: "phase9-v1", effectiveFrom: "2020-01-01", concepts: {} };
}

/** The packs a caller holds. Deliberately a plain collection — there is no registry lookup in Phase 9. */
function packLibrary(): E85RulePack[] {
  return [
    pack({ packId: "refburgh-rb-1", role: "BASE", usePermitted: "dwelling", maxFsr: 1.5, maxHeightMetres: 14 }),
    pack({ packId: "refburgh-rb-2", role: "BASE", usePermitted: "dwelling", maxFsr: 3.0, maxHeightMetres: 26 }),
    pack({ packId: "refburgh-dp-overlay", role: "OVERLAY", frontSetback: 6 }),
  ];
}

interface DecideSpec {
  records?: readonly ReturnType<typeof RECORD_A>[];
  snap?: E85RawSpatialSourceSnapshot;
  parcel?: E85ParcelSpatialReference;
  packs?: readonly E85RulePack[];
  requestedAnalyses?: readonly E85RequestedAnalysis[];
  freeze?: boolean;
}

function request(spec: DecideSpec = {}): E85DecisionRequest {
  const snap = spec.snap ?? snapshot({ records: spec.records ?? [RECORD_A()] });
  const parcel = spec.parcel ?? PARCEL_IN_RB_A();
  const packs = spec.packs ?? packLibrary();
  const req: E85DecisionRequest = {
    decisionId: "decision-1",
    normalization: normalize(snap),
    parcelSpatial: parcel,
    parcel: parcelRef(parcel.parcelReferenceId),
    jurisdictionId: PACK_JURISDICTION,
    zoneDesignation: ZONE,
    useCode: "dwelling",
    asOfDate: "2026-02-12",
    requestedAnalyses: spec.requestedAnalyses ?? ALL_ANALYSES,
    policyVersion: policy(),
    availableRulePacks: packs,
    spatialRegistry: datasets(),
    resolvedAt: RESOLVED_AT,
    composedAt: COMPOSED_AT,
    assembledAt: ASSEMBLED_AT,
  };
  return spec.freeze === true ? deepFreezeSnapshot(req) : req;
}

function decide(spec: DecideSpec = {}): E85DecisionPackage {
  return assembleE85DecisionPackage(request(spec));
}

/** Phase 4 stamps `resolvedAt` from the wall clock — its own long-standing behaviour — so that one field is normalized away before comparison. */
function withoutClock(value: unknown): string {
  return JSON.stringify(value).replace(/"resolvedAt":"[^"]*"/g, '"resolvedAt":"<clock>"');
}

const blockerRefs = (p: E85DecisionPackage) => p.blockers.map((b) => b.sourceRef).sort();
const materialityFor = (p: E85DecisionPackage, featureId: string) => p.materiality.filter((m) => m.featureId === featureId);
const stage = (p: E85DecisionPackage, name: string) => p.stages.find((s) => s.stage === name);

// ---------------------------------------------------------------------------

describe("E85 Phase 9 — the clean pipeline retains every phase", () => {
  const clean = () => decide({ records: [RECORD_A()] });

  test("all four phase results are present and whole", () => {
    const p = clean();
    // Not flattened to features / ids / rules / envelope. The evidence survives.
    expect(p.phase8.outcome).toBe("NORMALIZED");
    expect(p.phase7?.hits).toBeDefined();
    expect(p.phase6?.outcome).toBe("COMPOSED");
    expect(p.phase4?.result).toBeDefined();
    if (p.phase8.outcome !== "NORMALIZED") throw new Error("expected NORMALIZED");
    expect(p.phase8.findings.length).toBeGreaterThan(0);
    expect(p.phase8.readiness).toBeDefined();
    expect(p.phase8.quarantined).toEqual([]);
  });

  test("no blocker survives, and the decision is clean", () => {
    const p = clean();
    expect(p.blockers).toEqual([]);
    // The reference dataset carries a licence limitation and an unknown legal
    // effective date, which existing semantics class as WARNINGS rather than
    // gaps. Phase 9 does not promote them: this is the §23 warning-only path.
    expect(p.status).toBe("MACHINE_RESOLVED_WITH_WARNINGS");
    expect(p.warnings.length).toBeGreaterThan(0);
    expect(p.evaluationCompleteness).toBe("COMPLETE");
  });

  test("the regulatory numbers come through", () => {
    const p = clean();
    expect(p.phase4?.resolvedMaxFsr?.value).toBe(1.5);
    expect(p.phase4?.usePermission?.status).toBe("PERMITTED");
  });

  test("every stage is accounted for and says what it did", () => {
    const p = clean();
    for (const name of ["SPATIAL_NORMALIZATION", "SPATIAL_APPLICABILITY", "RULE_PACK_RESOLUTION", "COMPOSITION", "EVALUATION"]) {
      expect(stage(p, name)?.state).toBe("EXECUTED");
      expect(stage(p, name)?.detail.length).toBeGreaterThan(0);
    }
  });

  test("a base zone and an overlay coexist without being treated as a conflict", () => {
    // Spatial coexistence is the normal arrangement, not a disagreement.
    const p = decide({ records: [RECORD_A(), RECORD_OVERLAY()], parcel: PARCEL_IN_RB_A_AND_OVERLAY() });
    expect(p.phase7?.applicableRulePackIds).toEqual(["refburgh-dp-overlay", "refburgh-rb-1"]);
    expect(p.blockers).toEqual([]);
    expect(p.phase6?.outcome).toBe("COMPOSED");
    if (p.phase6?.outcome !== "COMPOSED") throw new Error("expected COMPOSED");
    expect(p.phase6.composed.unresolvedConflicts).toEqual([]);
    // The setback comes from the overlay; the density from the base zone.
    const envelope = p.phase4 && "envelope" in p.phase4.result ? p.phase4.result.envelope : undefined;
    expect(envelope?.envelope?.setbacksMetres?.front?.value).toBe(6);
    expect(p.phase4?.resolvedMaxFsr?.value).toBe(1.5);
  });
});

describe("E85 Phase 9 — THE CENTRAL PAIR: one snapshot, two parcels", () => {
  // The same layer, containing the same unmapped polygon, read from two
  // different parcels. Phase 8's global blocking signal is TRUE in both. Only
  // one of them is actually affected, and nothing but Phase 7's geometry can
  // tell them apart — which is the entire reason Phase 9 exists.
  const mixedSnapshot = () => snapshot({ records: [RECORD_A(), RECORD_UNMAPPED_ZONE()] });

  test("the Phase 8 snapshot-level signal is blocking for BOTH parcels", () => {
    const source = normalize(mixedSnapshot());
    if (source.outcome !== "NORMALIZED") throw new Error("expected NORMALIZED");
    expect(hasBlockingSpatialSourceFinding(source.findings)).toBe(true);
  });

  test("UNMAPPED DISJOINT — proven irrelevant, so this parcel's decision proceeds", () => {
    const p = decide({ snap: mixedSnapshot(), parcel: PARCEL_IN_RB_A() });

    const [linkage] = materialityFor(p, "zone-c").filter((m) => m.sourceCode === "RULE_PACK_LINK_UNRESOLVED");
    expect(linkage.materiality).toBe("NON_MATERIAL");
    expect(linkage.spatialRelation).toBe("DISJOINT");
    expect(linkage.reason).toContain("DISJOINT");

    // Nothing blocks, and the mapped base zone answers normally.
    expect(p.blockers).toEqual([]);
    expect(p.status).toBe("MACHINE_RESOLVED_WITH_WARNINGS");
    expect(p.evaluationCompleteness).toBe("COMPLETE");
    expect(p.phase4?.resolvedMaxFsr?.value).toBe(1.5);
  });

  test("UNMAPPED DISJOINT — the finding is classified, never deleted", () => {
    const p = decide({ snap: mixedSnapshot(), parcel: PARCEL_IN_RB_A() });
    if (p.phase8.outcome !== "NORMALIZED") throw new Error("expected NORMALIZED");
    // Still true of the layer, still on the record, still reachable.
    expect(p.phase8.findings.some((f) => f.code === "RULE_PACK_LINK_UNRESOLVED")).toBe(true);
    expect(hasBlockingSpatialSourceFinding(p.phase8.findings)).toBe(true);
    expect(p.materiality.some((m) => m.sourceCode === "RULE_PACK_LINK_UNRESOLVED")).toBe(true);
  });

  test("UNMAPPED APPLICABLE — the same finding blocks the parcel that is inside it", () => {
    const p = decide({ snap: mixedSnapshot(), parcel: PARCEL_IN_UNMAPPED_RB_C() });

    const [linkage] = materialityFor(p, "zone-c").filter((m) => m.sourceCode === "RULE_PACK_LINK_UNRESOLVED");
    expect(linkage.materiality).toBe("MATERIAL");
    expect(linkage.spatialRelation).toBe("CONTAINS");

    expect(p.blockers.length).toBeGreaterThan(0);
    expect(p.status).not.toBe("MACHINE_RESOLVED");
    expect(p.status).not.toBe("MACHINE_RESOLVED_WITH_WARNINGS");
  });

  test("the Phase 8A hazard stays impossible to hide", () => {
    // Phase 7 reports this parcel as spatially settled with an empty pack list —
    // byte-identical in shape to "no instrument governs here". Phase 9 is the
    // only layer that can tell the difference, and it does.
    const p = decide({ snap: mixedSnapshot(), parcel: PARCEL_IN_UNMAPPED_RB_C() });
    expect(p.phase7?.status).not.toBe("DATA_GAP");
    expect(p.phase7?.applicableRulePackIds).toEqual([]);
    expect(p.status).toBe("DATA_GAP");
    expect(p.blockers.some((b) => b.sourceCode === "RULE_PACK_LINK_UNRESOLVED")).toBe(true);
  });

  test("the global Phase 8 helper is NOT used as the parcel verdict", () => {
    // If Phase 9 had simply forwarded `hasBlockingSpatialSourceFinding`, both
    // parcels would be blocked and the layer would be unusable city-wide.
    const disjoint = decide({ snap: mixedSnapshot(), parcel: PARCEL_IN_RB_A() });
    const inside = decide({ snap: mixedSnapshot(), parcel: PARCEL_IN_UNMAPPED_RB_C() });
    expect(disjoint.status).not.toBe(inside.status);
  });
});

describe("E85 Phase 9 — materiality is decided on geometry, never on convenience", () => {
  test("the relation-to-materiality mapping is exactly as documented", () => {
    expect(e85RelationMateriality("DISJOINT")).toBe("NON_MATERIAL");
    expect(e85RelationMateriality("CONTAINS")).toBe("MATERIAL");
    expect(e85RelationMateriality("INTERSECTS")).toBe("MATERIAL");
    expect(e85RelationMateriality("BOUNDARY_TOUCH")).toBe("MATERIAL");
    expect(e85RelationMateriality("UNDETERMINED")).toBe("UNDETERMINED");
    expect(e85RelationMateriality(undefined)).toBe("UNDETERMINED");
  });

  test("DISJOINT is the only relation that proves irrelevance", () => {
    const proving = (["DISJOINT", "CONTAINS", "INTERSECTS", "BOUNDARY_TOUCH", "UNDETERMINED"] as const).filter((r) => e85RelationMateriality(r) === "NON_MATERIAL");
    expect(proving).toEqual(["DISJOINT"]);
  });

  test("BOUNDARY contact is retained as material, not dismissed for zero shared area", () => {
    const p = decide({ snap: snapshot({ records: [RECORD_B(), RECORD_UNMAPPED_ZONE()] }), parcel: PARCEL_TOUCHING_UNMAPPED_C() });
    const [linkage] = materialityFor(p, "zone-c").filter((m) => m.sourceCode === "RULE_PACK_LINK_UNRESOLVED");
    expect(linkage.spatialRelation).toBe("BOUNDARY_TOUCH");
    expect(linkage.materiality).toBe("MATERIAL");
    expect(linkage.materiality).not.toBe("NON_MATERIAL");
    expect(p.status).not.toBe("MACHINE_RESOLVED");
  });

  test("an unresolved instrument is never scoped away by rule family", () => {
    // Unknown contents are not evidence of absence. A pack nobody mapped cannot
    // be declared irrelevant to PARKING because no parking rule was found in it.
    const p = decide({ snap: snapshot({ records: [RECORD_A(), RECORD_UNMAPPED_ZONE()] }), parcel: PARCEL_IN_UNMAPPED_RB_C(), requestedAnalyses: ["PARKING"] });
    const [linkage] = materialityFor(p, "zone-c").filter((m) => m.sourceCode === "RULE_PACK_LINK_UNRESOLVED");
    expect(linkage.families).toBeUndefined();
    expect(linkage.materiality).toBe("MATERIAL");
  });
});

describe("E85 Phase 9 — a quarantined feature's relevance is never guessed", () => {
  const withBowtie = () => decide({ records: [RECORD_A(), RECORD_BOWTIE()] });

  test("no spatial relation is manufactured for a record that never became a feature", () => {
    const p = withBowtie();
    const records = materialityFor(p, "zone-bad");
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      expect(record.spatialRelation).toBeUndefined();
      expect(record.materiality).toBe("UNDETERMINED");
    }
  });

  test("UNDETERMINED blocks, and is never quietly read as NON_MATERIAL", () => {
    const p = withBowtie();
    expect(p.blockers.some((b) => b.featureId === "zone-bad")).toBe(true);
    expect(p.status).not.toBe("MACHINE_RESOLVED");
    expect(p.status).not.toBe("MACHINE_RESOLVED_WITH_WARNINGS");
  });

  test("a healthy mapped sibling does not prove the layer complete", () => {
    const p = withBowtie();
    // The mapped feature answers perfectly, and that is not the question.
    expect(p.phase4?.resolvedMaxFsr?.value).toBe(1.5);
    expect(p.evaluationCompleteness).toBe("PARTIAL");
  });

  test("one underlying withheld record yields one blocker, not three", () => {
    // Phase 8 emits both FEATURE_QUARANTINED and the specific reason code for
    // this record. Both remain on the Phase 8 result; only one becomes a blocker.
    const p = withBowtie();
    if (p.phase8.outcome !== "NORMALIZED") throw new Error("expected NORMALIZED");
    expect(p.phase8.findings.filter((f) => f.featureId === "zone-bad").length).toBeGreaterThan(1);
    expect(materialityFor(p, "zone-bad")).toHaveLength(1);
  });
});

describe("E85 Phase 9 — a snapshot-level refusal stops everything, visibly", () => {
  const refused = () => decide({ snap: snapshot({ records: [RECORD_A()], datasetId: "xx-yy-nowhere:layer" }) });

  test("Phase 8's refusal is retained in full", () => {
    const p = refused();
    expect(p.phase8.outcome).toBe("UNSUPPORTED");
    if (p.phase8.outcome !== "UNSUPPORTED") throw new Error("expected UNSUPPORTED");
    expect(p.phase8.reason).toBe("DATASET_NOT_REGISTERED");
    expect(p.phase8.gap).toBeDefined();
  });

  test("no downstream stage runs, and each says why", () => {
    const p = refused();
    expect(p.phase7).toBeUndefined();
    expect(p.phase6).toBeUndefined();
    expect(p.phase4).toBeUndefined();
    for (const name of ["SPATIAL_APPLICABILITY", "RULE_PACK_RESOLUTION", "COMPOSITION", "EVALUATION"]) {
      expect(stage(p, name)?.state).toBe("BLOCKED");
      expect(stage(p, name)?.detail).toContain("DATASET_NOT_REGISTERED");
    }
  });

  test("the decision is a data gap", () => {
    const p = refused();
    expect(p.status).toBe("DATA_GAP");
    expect(p.evaluationCompleteness).toBe("NOT_EVALUATED");
  });
});

describe("E85 Phase 9 — rule-pack resolution is exact or it is a gap", () => {
  test("an applicable pack identity with no supplied pack is a DATA_GAP", () => {
    const p = decide({ records: [RECORD_A()], packs: [] });
    expect(p.packResolution.unresolvedPackIds).toEqual(["refburgh-rb-1"]);
    expect(p.status).toBe("DATA_GAP");
    const [blocker] = p.blockers.filter((b) => b.sourceCode === "RULE_PACK_NOT_SUPPLIED");
    expect(blocker.gap?.reasonCode).toBe("RULE_NOT_STRUCTURED");
    expect(blocker.packId).toBe("refburgh-rb-1");
  });

  test("the missing pack is neither dropped nor filled with an empty one", () => {
    const p = decide({ records: [RECORD_A()], packs: [] });
    // The identity survives; the spatial evidence survives; nothing is invented.
    expect(p.phase7?.applicableRulePackIds).toEqual(["refburgh-rb-1"]);
    expect(p.packResolution.resolved).toEqual([]);
    expect(p.phase6).toBeUndefined();
    expect(stage(p, "COMPOSITION")?.state).toBe("SKIPPED");
  });

  test("no fuzzy, prefix or nearest-id matching exists", () => {
    const nearly = packLibrary().map((pk) => ({ ...pk, packId: `${pk.packId}-v2` }));
    const p = decide({ records: [RECORD_A()], packs: nearly });
    expect(p.packResolution.resolved).toEqual([]);
    expect(p.packResolution.unresolvedPackIds).toEqual(["refburgh-rb-1"]);
  });

  test("an identical duplicate collapses and raises no question", () => {
    const dup = [...packLibrary(), pack({ packId: "refburgh-rb-1", role: "BASE", usePermitted: "dwelling", maxFsr: 1.5, maxHeightMetres: 14 })];
    const p = decide({ records: [RECORD_A()], packs: dup });
    expect(p.packResolution.collapsedDuplicatePackIds).toEqual(["refburgh-rb-1"]);
    expect(p.blockers).toEqual([]);
    expect(p.materiality.some((m) => m.sourceCode === "DUPLICATE_RULE_PACK_COLLAPSED" && m.materiality === "NON_MATERIAL")).toBe(true);
    expect(p.phase4?.resolvedMaxFsr?.value).toBe(1.5);
  });

  test("conflicting packs under one id resolve to NEITHER", () => {
    const conflicting = [...packLibrary(), pack({ packId: "refburgh-rb-1", role: "BASE", usePermitted: "dwelling", maxFsr: 9.9, maxHeightMetres: 99 })];
    const p = decide({ records: [RECORD_A()], packs: conflicting });
    expect(p.packResolution.conflictingPackIds).toEqual(["refburgh-rb-1"]);
    expect(p.packResolution.resolved).toEqual([]);
    expect(p.status).toBe("MANUAL_REVIEW_REQUIRED");
    // Neither value is adopted — not the first, not the last.
    expect(withoutClock(p.phase4 ?? null)).not.toContain("9.9");
  });

  test("conflicting-duplicate resolution does not depend on array order", () => {
    const a = pack({ packId: "refburgh-rb-1", role: "BASE", usePermitted: "dwelling", maxFsr: 1.5, maxHeightMetres: 14 });
    const b = pack({ packId: "refburgh-rb-1", role: "BASE", usePermitted: "dwelling", maxFsr: 9.9, maxHeightMetres: 99 });
    expect(resolveE85RulePacks(["refburgh-rb-1"], [a, b])).toEqual(resolveE85RulePacks(["refburgh-rb-1"], [b, a]));
  });
});

describe("E85 Phase 9 — spatial ambiguity is retained, never settled", () => {
  const split = () => decide({ records: [RECORD_A(), RECORD_B()], parcel: PARCEL_STRADDLING_A_AND_B() });

  test("Phase 7's ambiguity survives orchestration intact", () => {
    const p = split();
    expect(p.phase7?.status).toBe("MANUAL_REVIEW_REQUIRED");
    expect(p.phase7?.hits.length).toBe(2);
    expect(p.status).toBe("MANUAL_REVIEW_REQUIRED");
  });

  test("no zone is chosen by area, centroid or order", () => {
    const p = split();
    expect(p.phase7?.applicableRulePackIds).toEqual([]);
    expect(p.phase7?.ambiguousRulePackIds).toEqual(["refburgh-rb-1", "refburgh-rb-2"]);
    // Neither zone's figures are presented as the answer.
    expect(p.evaluationCompleteness).not.toBe("COMPLETE");
  });

  test("reversing the source records does not pick a different zone", () => {
    const forward = decide({ snap: snapshot({ records: [RECORD_A(), RECORD_B()] }), parcel: PARCEL_STRADDLING_A_AND_B() });
    const reversed = decide({ snap: snapshot({ records: [RECORD_B(), RECORD_A()] }), parcel: PARCEL_STRADDLING_A_AND_B() });
    expect(reversed.status).toBe(forward.status);
    expect(reversed.phase7?.ambiguousRulePackIds).toEqual(forward.phase7?.ambiguousRulePackIds);
  });
});

describe("E85 Phase 9 — Phase 6's materiality is reused, never re-derived", () => {
  /** A base zone and an overlay that disagree about density. */
  const conflictingPacks = () => [
    pack({ packId: "refburgh-rb-1", role: "BASE", usePermitted: "dwelling", maxFsr: 1.5 }),
    pack({ packId: "refburgh-dp-overlay", role: "OVERLAY", maxFsr: 2.5 }),
  ];
  const conflictSpec = (requestedAnalyses: readonly E85RequestedAnalysis[]) => ({
    records: [RECORD_A(), RECORD_OVERLAY()],
    parcel: PARCEL_IN_RB_A_AND_OVERLAY(),
    packs: conflictingPacks(),
    requestedAnalyses,
  });

  test("Phase 6 leaves the contested concept undecided, and that survives", () => {
    const p = decide(conflictSpec(["DENSITY"]));
    if (p.phase6?.outcome !== "COMPOSED") throw new Error("expected COMPOSED");
    expect(p.phase6.composed.unresolvedConflicts.length).toBe(1);
    expect(p.phase6.composed.unresolvedConflicts[0].family).toBe("DENSITY");
  });

  test("a conflict in a REQUESTED family blocks the decision", () => {
    const p = decide(conflictSpec(["DENSITY"]));
    const [conflict] = p.materiality.filter((m) => m.sourceCode === "UNRESOLVED_CONFLICT");
    expect(conflict.materiality).toBe("MATERIAL");
    expect(conflict.families).toEqual(["DENSITY"]);
    expect(p.status).toBe("MANUAL_REVIEW_REQUIRED");
    // No value is chosen for the contested concept.
    expect(p.phase4?.resolvedMaxFsr).toBeUndefined();
  });

  test("a conflict in an UNREQUESTED family does not block the requested output", () => {
    const p = decide(conflictSpec(["USE"]));
    const [conflict] = p.materiality.filter((m) => m.sourceCode === "UNRESOLVED_CONFLICT");
    expect(conflict.materiality).toBe("NON_MATERIAL");
    expect(conflict.families).toEqual(["DENSITY"]);
    // The requested analysis still resolves.
    expect(p.phase4?.usePermission?.status).toBe("PERMITTED");
    expect(p.blockers).toEqual([]);
  });

  test("the unrequested conflict is still fully retained on the Phase 6 result", () => {
    const p = decide(conflictSpec(["USE"]));
    if (p.phase6?.outcome !== "COMPOSED") throw new Error("expected COMPOSED");
    expect(p.phase6.composed.unresolvedConflicts.length).toBe(1);
    expect(p.materiality.some((m) => m.sourceCode === "UNRESOLVED_CONFLICT")).toBe(true);
  });

  test("Phase 9 states no precedence of its own", () => {
    const p = decide(conflictSpec(["DENSITY"]));
    if (p.phase6?.outcome !== "COMPOSED") throw new Error("expected COMPOSED");
    // Nothing was suppressed, because no relation said anything should be.
    expect(p.phase6.composed.suppressed).toEqual([]);
    expect(p.phase6.composed.appliedRelations).toEqual([]);
  });

  // PHASE 14.4A.1: DENSITY is a family both contributing packs here DO declare
  // (the fixture derives it from the maxFsr field each supplies), so the real
  // conflict must drive MANUAL_REVIEW_REQUIRED alone — no new coverage blocker
  // double-counts alongside it.
  test("a real within-family conflict does not also raise REQUESTED_FAMILY_NOT_SUPPORTED", () => {
    const p = decide(conflictSpec(["DENSITY"]));
    expect(p.materiality.some((m) => m.sourceCode === "REQUESTED_FAMILY_NOT_SUPPORTED")).toBe(false);
    expect(p.status).toBe("MANUAL_REVIEW_REQUIRED");
  });
});

describe("E85 Phase 9 — a requested family no contributing pack ever claimed to model is a completeness blocker, not a legal gap", () => {
  // PHASE 14.4A.1: `refburgh-rb-1` here declares support for USE only (the
  // fixture derives `supportedRuleFamilies` from which fields the spec sets),
  // so DENSITY was never claimed as modeled at all — not "modeled and silent".
  const useOnlyPack = () => pack({ packId: "refburgh-rb-1", role: "BASE", usePermitted: "dwelling" });
  const useOnly = (requestedAnalyses: readonly E85RequestedAnalysis[]) =>
    decide({ records: [RECORD_A()], parcel: PARCEL_IN_RB_A(), packs: [useOnlyPack()], requestedAnalyses });

  test("(a) requesting an unmodeled family alone produces the new blocker and PARTIAL", () => {
    const p = useOnly(["DENSITY"]);
    const [blocker] = p.blockers.filter((b) => b.sourceCode === "REQUESTED_FAMILY_NOT_SUPPORTED");
    expect(blocker).toBeDefined();
    expect(blocker.materiality).toBe("MATERIAL");
    expect(blocker.kind).toBe("COMPLETENESS");
    expect(blocker.families).toEqual(["DENSITY"]);
    expect(p.evaluationCompleteness).toBe("PARTIAL");
  });

  test("(b) requesting only a modeled family is unaffected: no new blocker, COMPLETE", () => {
    const p = useOnly(["USE"]);
    expect(p.materiality.some((m) => m.sourceCode === "REQUESTED_FAMILY_NOT_SUPPORTED")).toBe(false);
    expect(p.evaluationCompleteness).toBe("COMPLETE");
    expect(p.blockers).toEqual([]);
  });

  test("(c) + (15, THE CENTRAL INVARIANT): a modeled family's clean legal result is untouched by an unmodeled family's blocker", () => {
    const p = useOnly(["USE", "DENSITY"]);
    // The modeled family resolves exactly as it would have alone.
    expect(p.phase4?.usePermission?.status).toBe("PERMITTED");
    expect(p.phase4?.resolvedMaxFsr).toBeUndefined();
    // The unmodeled family is flagged, and only it.
    const densityBlockers = p.blockers.filter((b) => b.sourceCode === "REQUESTED_FAMILY_NOT_SUPPORTED");
    expect(densityBlockers.map((b) => b.families)).toEqual([["DENSITY"]]);
    // Completeness reflects the gap...
    expect(p.evaluationCompleteness).toBe("PARTIAL");
    // ...but the TERMINAL LEGAL STATUS is NOT converted to DATA_GAP or
    // MANUAL_REVIEW_REQUIRED by a blocker of kind COMPLETENESS: it is invisible
    // to determineE85DecisionStatus's kind-based switch, so status is decided
    // by Phase 4's own (clean) conclusion about the family it DID evaluate.
    expect(p.status).not.toBe("DATA_GAP");
    expect(p.status).not.toBe("MANUAL_REVIEW_REQUIRED");
    expect(["MACHINE_RESOLVED", "MACHINE_RESOLVED_WITH_WARNINGS"]).toContain(p.status);
  });

  test("(d) a family declared supported but with every rule NOT_APPLICABLE to this proposal raises no new blocker", () => {
    // maxFsr is stated only under a condition that is never affirmed here, so
    // the DENSITY rule exists, is scoped out, and produces nothing — but the
    // pack still DECLARES density support, which is the only thing this check
    // consults.
    const conditioned = pack({
      packId: "refburgh-rb-1",
      role: "BASE",
      usePermitted: "dwelling",
      conditionalRules: [
        {
          condition: "Site is assembled under a comprehensive development permit",
          sourceFactId: "fact-cd-fsr",
          rule: { jurisdictionId: PACK_JURISDICTION, zoneDesignation: ZONE, family: "DENSITY", maxFsr: { value: 3.0, provenance: { sourceId: "refburgh-rb-1", documentLocator: { section: "3.9" } }, temporal: { effectiveFrom: "2024-01-01", effectiveDateBasis: "SOURCE_STATED" } } },
        },
      ],
      supportedRuleFamilies: ["USE", "DENSITY"],
    });
    const p = decide({ records: [RECORD_A()], parcel: PARCEL_IN_RB_A(), packs: [conditioned], requestedAnalyses: ["USE", "DENSITY"] });
    expect(p.materiality.some((m) => m.sourceCode === "REQUESTED_FAMILY_NOT_SUPPORTED")).toBe(false);
    expect(p.phase4?.resolvedMaxFsr).toBeUndefined();
    expect(p.evaluationCompleteness).toBe("COMPLETE");
  });

  test("(g) multi-pack union: two packs each cover one requested family, contributing together — no blocker", () => {
    const useOnly1 = pack({ packId: "refburgh-rb-1", role: "BASE", usePermitted: "dwelling" });
    const dimensionalOnly = pack({ packId: "refburgh-dp-overlay", role: "OVERLAY", maxHeightMetres: 14, supportedRuleFamilies: ["DIMENSIONAL"] });
    const p = decide({
      records: [RECORD_A(), RECORD_OVERLAY()],
      parcel: PARCEL_IN_RB_A_AND_OVERLAY(),
      packs: [useOnly1, dimensionalOnly],
      requestedAnalyses: ["USE", "DIMENSIONAL"],
    });
    expect(p.materiality.some((m) => m.sourceCode === "REQUESTED_FAMILY_NOT_SUPPORTED")).toBe(false);
    expect(p.evaluationCompleteness).toBe("COMPLETE");
  });

  test("(h) a pack that declares a family but does not CONTRIBUTE to this decision is never credited", () => {
    // refburgh-dp-overlay declares DENSITY here but is never spatially linked to
    // this parcel (only RECORD_A is offered, mapping to refburgh-rb-1 alone), so
    // it never enters packResolution.resolved / contributingPackIds.
    const nonContributing = pack({ packId: "refburgh-dp-overlay", role: "OVERLAY", frontSetback: 6, supportedRuleFamilies: ["DENSITY"] });
    const p = decide({ records: [RECORD_A()], parcel: PARCEL_IN_RB_A(), packs: [useOnlyPack(), nonContributing], requestedAnalyses: ["USE", "DENSITY"] });
    expect(p.packResolution.resolved.map((x) => x.packId)).toEqual(["refburgh-rb-1"]);
    const [blocker] = p.blockers.filter((b) => b.sourceCode === "REQUESTED_FAMILY_NOT_SUPPORTED");
    expect(blocker).toBeDefined();
    expect(blocker.families).toEqual(["DENSITY"]);
  });

  test("(i) an unresolved expected pack suppresses the new check entirely: only RULE_PACK_NOT_SUPPLIED fires", () => {
    // No packs supplied at all: Phase 7 names "refburgh-rb-1" as applicable and
    // nothing resolves it, so its coverage is UNKNOWN, not "supports nothing".
    const p = decide({ records: [RECORD_A()], parcel: PARCEL_IN_RB_A(), packs: [], requestedAnalyses: ["USE", "DENSITY"] });
    expect(p.packResolution.unresolvedPackIds).toEqual(["refburgh-rb-1"]);
    expect(p.materiality.some((m) => m.sourceCode === "REQUESTED_FAMILY_NOT_SUPPORTED")).toBe(false);
    const [blocker] = p.blockers.filter((b) => b.sourceCode === "RULE_PACK_NOT_SUPPLIED");
    expect(blocker).toBeDefined();
    expect(p.status).toBe("DATA_GAP");
  });

  test("(j) a REFUSED composition suppresses the new check entirely: only the refusal blocker fires", () => {
    const incompatible = [
      pack({ packId: "refburgh-rb-1", role: "BASE", usePermitted: "dwelling" }),
      { ...pack({ packId: "refburgh-dp-overlay", role: "OVERLAY", usePermitted: "dwelling" }), jurisdictionId: "xx-yy-elsewhere", zoneDesignation: "OTHER-1" },
    ];
    const p = decide({ records: [RECORD_A(), RECORD_OVERLAY()], parcel: PARCEL_IN_RB_A_AND_OVERLAY(), packs: incompatible, requestedAnalyses: ["USE", "DENSITY"] });
    expect(p.phase6?.outcome).toBe("REFUSED");
    expect(p.materiality.some((m) => m.sourceCode === "REQUESTED_FAMILY_NOT_SUPPORTED")).toBe(false);
    expect(p.materiality.some((m) => m.sourceCode === "COMPOSITION_REFUSED")).toBe(true);
  });
});

describe("E85 Phase 9 — partial work is kept and labelled", () => {
  // The §21 case: a base zone that maps cleanly, and an overlay covering the
  // same ground whose designation nobody mapped.
  const partial = () => decide({ records: [RECORD_A(), RECORD_UNMAPPED_OVERLAY()], parcel: PARCEL_IN_RB_A() });

  test("the confirmed base pack still produces a real number", () => {
    const p = partial();
    expect(p.phase4?.resolvedMaxFsr?.value).toBe(1.5);
  });

  test("the unresolved overlay is material and blocks a clean answer", () => {
    const p = partial();
    const [linkage] = materialityFor(p, "dp-unmapped").filter((m) => m.sourceCode === "RULE_PACK_LINK_UNRESOLVED");
    expect(linkage.materiality).toBe("MATERIAL");
    expect(linkage.spatialRelation).toBe("CONTAINS");
    expect(p.status).toBe("DATA_GAP");
  });

  test("the evaluation is explicitly PARTIAL, never presented as complete", () => {
    const p = partial();
    expect(p.evaluationCompleteness).toBe("PARTIAL");
    expect(stage(p, "EVALUATION")?.state).toBe("PARTIALLY_EXECUTED");
    expect(stage(p, "EVALUATION")?.detail).toContain("NOT the whole answer");
  });

  test("valid partial work is not thrown away to make the blocker tidy", () => {
    const p = partial();
    expect(p.phase6?.outcome).toBe("COMPOSED");
    expect(p.packResolution.resolved.map((x) => x.packId)).toEqual(["refburgh-rb-1"]);
  });
});

describe("E85 Phase 9 — terminal status derivation", () => {
  const gapBlocker = { sourceRef: "a", sourcePhase: "SPATIAL_NORMALIZATION" as const, sourceCode: "X", kind: "GAP" as const, materiality: "MATERIAL" as const, reason: "r" };
  const reviewBlocker = { ...gapBlocker, sourceRef: "b", kind: "MANUAL_REVIEW" as const };
  const undetermined = { ...gapBlocker, sourceRef: "c", materiality: "UNDETERMINED" as const };
  const nonMaterial = { ...gapBlocker, sourceRef: "d", materiality: "NON_MATERIAL" as const };
  const cleanPhase4 = { result: { status: "MACHINE_RESOLVED" } } as never;
  const warnedPhase4 = { result: { status: "MACHINE_RESOLVED_WITH_WARNINGS", warnings: ["phase 4 said so"] } } as never;
  const gappedPhase4 = { result: { status: "DATA_GAP", gaps: [] } } as never;

  test("MANUAL_REVIEW outranks GAP, as documented", () => {
    expect(determineE85DecisionStatus({ materiality: [gapBlocker, reviewBlocker], phase4: cleanPhase4, warnings: [] })).toBe("MANUAL_REVIEW_REQUIRED");
  });

  test("the order of the materiality array changes nothing", () => {
    const forward = determineE85DecisionStatus({ materiality: [gapBlocker, reviewBlocker], phase4: cleanPhase4, warnings: [] });
    const reversed = determineE85DecisionStatus({ materiality: [reviewBlocker, gapBlocker], phase4: cleanPhase4, warnings: [] });
    expect(reversed).toBe(forward);
  });

  test("an UNDETERMINED record blocks exactly as a MATERIAL one does", () => {
    expect(determineE85DecisionStatus({ materiality: [undetermined], phase4: cleanPhase4, warnings: [] })).toBe("DATA_GAP");
  });

  test("a NON_MATERIAL record does not block", () => {
    expect(determineE85DecisionStatus({ materiality: [nonMaterial], phase4: cleanPhase4, warnings: [] })).toBe("MACHINE_RESOLVED");
  });

  test("warnings alone produce the warning status", () => {
    expect(determineE85DecisionStatus({ materiality: [], phase4: cleanPhase4, warnings: ["w"] })).toBe("MACHINE_RESOLVED_WITH_WARNINGS");
  });

  test("a clean slate with a clean evaluation is MACHINE_RESOLVED", () => {
    expect(determineE85DecisionStatus({ materiality: [nonMaterial], phase4: cleanPhase4, warnings: [] })).toBe("MACHINE_RESOLVED");
  });

  test("nothing evaluated is never MACHINE_RESOLVED", () => {
    // The emptiest possible clean answer is still a clean answer, and would be a lie.
    expect(determineE85DecisionStatus({ materiality: [], warnings: [] })).toBe("DATA_GAP");
  });

  test("a clean Phase 4 does not swallow an upstream warning", () => {
    // The reachability question worth asking explicitly: step 3 adopts Phase 4's
    // status, so a clean evaluation could in principle short-circuit past the
    // warning branch and make it dead code. It does not — a MACHINE_RESOLVED
    // evaluation FALLS THROUGH to the warning check rather than returning early,
    // which is why an orchestration-level warning still surfaces.
    expect(determineE85DecisionStatus({ materiality: [], phase4: cleanPhase4, warnings: ["licence limitation"] })).toBe("MACHINE_RESOLVED_WITH_WARNINGS");
    expect(determineE85DecisionStatus({ materiality: [nonMaterial], phase4: cleanPhase4, warnings: ["licence limitation"] })).toBe("MACHINE_RESOLVED_WITH_WARNINGS");
  });

  test("Phase 4's own warning status is carried through with no orchestration warning of its own", () => {
    expect(determineE85DecisionStatus({ materiality: [], phase4: warnedPhase4, warnings: [] })).toBe("MACHINE_RESOLVED_WITH_WARNINGS");
    expect(determineE85DecisionStatus({ materiality: [], phase4: warnedPhase4, warnings: ["and one of ours"] })).toBe("MACHINE_RESOLVED_WITH_WARNINGS");
  });

  test("Phase 4's own gap is carried through", () => {
    expect(determineE85DecisionStatus({ materiality: [], phase4: gappedPhase4, warnings: [] })).toBe("DATA_GAP");
  });

  test("a material GAP outranks warnings — warnings never soften a blocker", () => {
    expect(determineE85DecisionStatus({ materiality: [gapBlocker], phase4: cleanPhase4, warnings: ["w"] })).toBe("DATA_GAP");
  });

  test("a material MANUAL_REVIEW outranks warnings", () => {
    expect(determineE85DecisionStatus({ materiality: [reviewBlocker], phase4: cleanPhase4, warnings: ["w"] })).toBe("MANUAL_REVIEW_REQUIRED");
  });

  test("GAP and MANUAL_REVIEW together resolve by the documented policy, and BOTH stay readable", () => {
    const materiality = [gapBlocker, reviewBlocker];
    expect(determineE85DecisionStatus({ materiality, phase4: cleanPhase4, warnings: ["w"] })).toBe("MANUAL_REVIEW_REQUIRED");
    // The single terminal status names one class; neither class is hidden.
    const blockers = e85DecisionBlockers(materiality);
    expect(blockers.map((b) => b.kind).sort()).toEqual(["GAP", "MANUAL_REVIEW"]);
  });

  test("every blocker stays visible regardless of which single status is chosen", () => {
    const p = decide({ records: [RECORD_A(), RECORD_BOWTIE()], packs: [] });
    expect(p.status).toBe("DATA_GAP");
    // Both the quarantine problem and the missing-pack problem remain readable.
    expect(p.blockers.some((b) => b.featureId === "zone-bad")).toBe(true);
    expect(p.blockers.some((b) => b.sourceCode === "RULE_PACK_NOT_SUPPLIED")).toBe(true);
  });
});

describe("E85 Phase 9 — traceability", () => {
  test("a usable number traces back to pack, feature, release and adapter", () => {
    const p = decide({ records: [RECORD_A()] });
    const support = p.trace.filter((t) => t.kind === "SUPPORT" && t.packId === "refburgh-rb-1");
    expect(support).toHaveLength(1);
    expect(support[0].featureId).toBe("zone-a");
    expect(support[0].datasetId).toBe(REFERENCE_DATASET_ID);
    expect(support[0].datasetVersionId).toBe(REFERENCE_RELEASE);
    expect(support[0].adapterId).toBe("xx-yy-refburgh.zoning-districts.geojson");
    expect(support[0].adapterVersion).toBe("1.0.0");
  });

  test("a blocker traces back to the phase and finding that raised it", () => {
    const p = decide({ snap: snapshot({ records: [RECORD_A(), RECORD_UNMAPPED_ZONE()] }), parcel: PARCEL_IN_UNMAPPED_RB_C() });
    const blocked = p.trace.filter((t) => t.kind === "BLOCKER");
    expect(blocked.length).toBeGreaterThan(0);
    const linkage = blocked.find((t) => t.sourceRef?.includes("RULE_PACK_LINK_UNRESOLVED"));
    expect(linkage?.sourcePhase).toBe("SPATIAL_NORMALIZATION");
    expect(linkage?.featureId).toBe("zone-c");
    expect(linkage?.detail).toContain("MATERIAL");
  });

  test("every blocker appears in the trace exactly once", () => {
    const p = decide({ records: [RECORD_A(), RECORD_BOWTIE()], packs: [] });
    const refs = p.trace.filter((t) => t.kind === "BLOCKER").map((t) => t.sourceRef);
    expect(refs.sort()).toEqual(blockerRefs(p));
    expect(new Set(refs).size).toBe(refs.length);
  });
});

describe("E85 Phase 9 — determinism and immutability", () => {
  const mixed = () => [RECORD_A(), RECORD_UNMAPPED_ZONE(), RECORD_OVERLAY()];

  test("reversing the raw source records changes nothing semantic", () => {
    const forward = decide({ snap: snapshot({ records: mixed() }), parcel: PARCEL_IN_RB_A_AND_OVERLAY() });
    const reversed = decide({ snap: snapshot({ records: [...mixed()].reverse() }), parcel: PARCEL_IN_RB_A_AND_OVERLAY() });
    expect(reversed.status).toBe(forward.status);
    expect(reversed.evaluationCompleteness).toBe(forward.evaluationCompleteness);
    expect(blockerRefs(reversed)).toEqual(blockerRefs(forward));
    expect(withoutClock(reversed.materiality)).toBe(withoutClock(forward.materiality));
    expect(withoutClock(reversed.trace)).toBe(withoutClock(forward.trace));
  });

  test("reversing the supplied rule packs changes nothing", () => {
    const forward = decide({ records: mixed(), parcel: PARCEL_IN_RB_A_AND_OVERLAY(), packs: packLibrary() });
    const reversed = decide({ records: mixed(), parcel: PARCEL_IN_RB_A_AND_OVERLAY(), packs: [...packLibrary()].reverse() });
    expect(withoutClock(reversed.packResolution)).toBe(withoutClock(forward.packResolution));
    expect(reversed.status).toBe(forward.status);
    expect(withoutClock(reversed.trace)).toBe(withoutClock(forward.trace));
  });

  test("reversing the requested analyses changes nothing", () => {
    const forward = decide({ records: mixed(), parcel: PARCEL_IN_RB_A_AND_OVERLAY(), requestedAnalyses: ["USE", "DENSITY", "DIMENSIONAL"] });
    const reversed = decide({ records: mixed(), parcel: PARCEL_IN_RB_A_AND_OVERLAY(), requestedAnalyses: ["DIMENSIONAL", "DENSITY", "USE"] });
    expect(reversed.status).toBe(forward.status);
    expect(blockerRefs(reversed)).toEqual(blockerRefs(forward));
  });

  test("the same request asked twice gives the same package", () => {
    const req = request({ records: mixed(), parcel: PARCEL_IN_RB_A_AND_OVERLAY() });
    expect(withoutClock(assembleE85DecisionPackage(req))).toBe(withoutClock(assembleE85DecisionPackage(req)));
  });

  test("a deep-frozen request is not mutated", () => {
    const req = request({ records: mixed(), parcel: PARCEL_IN_RB_A_AND_OVERLAY(), freeze: true });
    expect(() => assembleE85DecisionPackage(req)).not.toThrow();
  });

  test("a frozen request still produces the full decision", () => {
    const frozen = assembleE85DecisionPackage(request({ records: mixed(), parcel: PARCEL_IN_RB_A_AND_OVERLAY(), freeze: true }));
    const plain = decide({ records: mixed(), parcel: PARCEL_IN_RB_A_AND_OVERLAY() });
    expect(withoutClock(frozen.materiality)).toBe(withoutClock(plain.materiality));
    expect(frozen.status).toBe(plain.status);
  });

  test("the package stamps no clock of its own", () => {
    const p = decide({ records: [RECORD_A()] });
    expect(p.assembledAt).toBe(ASSEMBLED_AT);
  });

  test("with no caller timestamp, the time is derived from retained evidence", () => {
    const req = request({ records: [RECORD_A()] });
    const { assembledAt: _dropped, ...withoutStamp } = req;
    const p = assembleE85DecisionPackage(withoutStamp);
    expect(p.assembledAt).toBe(NORMALIZED_AT);
  });
});

describe("E85 Phase 9 — the decision echoes what it was asked", () => {
  test("the correlation id, parcel and requested analyses come back untouched", () => {
    const p = decide({ records: [RECORD_A()] });
    expect(p.decisionId).toBe("decision-1");
    expect(p.parcel.parcelReferenceId).toBe("refburgh-parcel-1");
    expect(p.parcelSpatial.parcelReferenceId).toBe("refburgh-parcel-1");
    expect(p.requestedAnalyses).toEqual(ALL_ANALYSES);
  });

  test("blockers are exactly the blocking subset of materiality", () => {
    const p = decide({ snap: snapshot({ records: [RECORD_A(), RECORD_UNMAPPED_ZONE()] }), parcel: PARCEL_IN_UNMAPPED_RB_C() });
    const expected = p.materiality.filter((m) => m.materiality !== "NON_MATERIAL");
    expect(p.blockers).toEqual(expected);
  });
});


describe("E85 Phase 9 — sourceFindings: Phase 5 findings carried through composition, audit-only", () => {
  function finding(code: E85NormalizationFinding["code"], severity: E85NormalizationFinding["severity"], message: string): E85NormalizationFinding {
    return { code, severity, message };
  }

  test("two contributing packs each contribute their own findings, in deterministic pack order", () => {
    const base = pack({ packId: "refburgh-rb-1", role: "BASE", usePermitted: "dwelling", maxFsr: 1.5, maxHeightMetres: 14 });
    const overlay = pack({ packId: "refburgh-dp-overlay", role: "OVERLAY", frontSetback: 6 });
    const withFindings1 = { ...base, sourceFindings: [finding("TERM_MAPPED_EXACT", "INFO", "base mapped exactly")] };
    const withFindings2 = { ...overlay, sourceFindings: [finding("SOURCE_NOTE_PRESERVED", "INFO", "overlay note")] };

    const p = decide({ records: [RECORD_A(), RECORD_OVERLAY()], parcel: PARCEL_IN_RB_A_AND_OVERLAY(), packs: [withFindings1, withFindings2] });
    if (p.phase6?.outcome !== "COMPOSED") throw new Error("expected COMPOSED");

    expect(p.sourceFindings).toHaveLength(2);
    expect(p.sourceFindings.map((sf) => sf.packId)).toEqual([...p.phase6.composed.contributingPackIds]);
    for (const sf of p.sourceFindings) {
      if (sf.packId === "refburgh-rb-1") {
        expect(sf.sourceId).toBe(base.sourceId);
        expect(sf.sourceVersionId).toBe(base.sourceVersionId);
        expect(sf.finding.message).toBe("base mapped exactly");
      } else {
        expect(sf.packId).toBe("refburgh-dp-overlay");
        expect(sf.sourceId).toBe(overlay.sourceId);
        expect(sf.finding.message).toBe("overlay note");
      }
    }
  });

  test("a non-contributing pack's findings never leak into the final sourceFindings", () => {
    // Only refburgh-rb-1 is applicable/resolved for this parcel; refburgh-rb-2
    // and the overlay are supplied but never contribute to this decision.
    const contributing = pack({ packId: "refburgh-rb-1", role: "BASE", usePermitted: "dwelling", maxFsr: 1.5, maxHeightMetres: 14 });
    const nonContributing = { ...pack({ packId: "refburgh-rb-2", role: "BASE", usePermitted: "dwelling", maxFsr: 3.0, maxHeightMetres: 26 }), sourceFindings: [finding("UNSUPPORTED_SOURCE_CONCEPT", "GAP", "should never appear")] };
    const withFindings = { ...contributing, sourceFindings: [finding("TERM_MAPPED_EXACT", "INFO", "should appear")] };

    const p = decide({ records: [RECORD_A()], parcel: PARCEL_IN_RB_A(), packs: [withFindings, nonContributing] });
    expect(p.sourceFindings.map((sf) => sf.finding.message)).toEqual(["should appear"]);
    expect(p.sourceFindings.every((sf) => sf.packId !== "refburgh-rb-2")).toBe(true);
  });

  test("an unresolved (never-supplied) pack contributes no sourceFindings — resolution failure is not silently papered over", () => {
    const p = decide({ records: [RECORD_A()], packs: [] });
    expect(p.sourceFindings).toEqual([]);
  });

  test("a REFUSED composition yields an empty sourceFindings, never a partial/guessed one", () => {
    const conflictingId = [
      pack({ packId: "refburgh-rb-1", role: "BASE", usePermitted: "dwelling", maxFsr: 1.5, maxHeightMetres: 14 }),
      { ...pack({ packId: "refburgh-rb-1", role: "BASE", usePermitted: "dwelling", maxFsr: 9.9, maxHeightMetres: 99 }), sourceFindings: [finding("TERM_MAPPED_EXACT", "INFO", "must not leak")] },
    ];
    const p = decide({ records: [RECORD_A()], packs: conflictingId });
    expect(p.packResolution.conflictingPackIds).toEqual(["refburgh-rb-1"]);
    expect(p.sourceFindings).toEqual([]);
  });

  test("sourceFindings do not affect status, materiality, blockers or warnings — they coexist with an unrelated Phase 4 gap untouched", () => {
    const findingsPack = { ...pack({ packId: "refburgh-rb-1", role: "BASE", usePermitted: "dwelling", maxFsr: 1.5, maxHeightMetres: 14 }), sourceFindings: [finding("SOURCE_NOTE_PRESERVED", "INFO", "audit-only note")] };
    const withNote = decide({ records: [RECORD_A()], packs: [findingsPack, pack({ packId: "refburgh-dp-overlay", role: "OVERLAY", frontSetback: 6 })] });
    const withoutNote = decide({ records: [RECORD_A()] });

    expect(withNote.sourceFindings.length).toBeGreaterThan(0);
    // Identical status/materiality/warnings/blockers to the equivalent run
    // without any sourceFindings attached — the field changes nothing else.
    expect(withNote.status).toBe(withoutNote.status);
    expect(withNote.warnings).toEqual(withoutNote.warnings);
    expect(withNote.blockers).toEqual(withoutNote.blockers);
    expect(withNote.evaluationCompleteness).toBe(withoutNote.evaluationCompleteness);
  });

  test("no sourceFindings on a pack yields no entries, never an invented empty-finding placeholder", () => {
    const p = decide({ records: [RECORD_A()] });
    expect(p.sourceFindings).toEqual([]);
  });
});

describe("E85 Phase 9 — distinct problems about one subject all survive", () => {
  /**
   * The regression suite for a real defect found at the Phase 9 commit gate.
   *
   * Materiality records used to be collapsed to ONE per subject. That is right
   * when Phase 8 describes a single problem twice — `FEATURE_QUARANTINED` plus
   * the specific reason — and wrong the moment a record genuinely has more than
   * one thing wrong with it. `E85QuarantinedSpatialRecord.reasonCodes` exists
   * precisely for that case: "More than one can be true at once and all are
   * reported."
   *
   * The consequence was not merely cosmetic. Terminal status is chosen from a
   * blocker's KIND, so erasing a MANUAL_REVIEW in favour of a GAP downgraded the
   * whole decision from "a person must settle this" to "go find missing
   * evidence" — with no trace of the lost blocker anywhere in the package.
   *
   * The reference adapter's control flow emits at most one specific reason per
   * record, so these fixtures construct multi-reason results directly. That is
   * the point: Phase 9 must honour the CONTRACT, not merely the one adapter
   * that currently ships.
   */
  function sourceFinding(code: E85SpatialSourceFindingCode, severity: E85SpatialSourceSeverity, featureId: string, message = `synthetic ${code}`): E85SpatialSourceFinding {
    return {
      code,
      severity,
      featureId,
      rawRecordRef: "snap-1#9",
      message,
      ...(severity === "GAP" ? { gap: { reasonCode: "RULE_NOT_STRUCTURED" as const, reason: message, sourcesChecked: [REFERENCE_DATASET_ID], checkedAt: NORMALIZED_AT } } : {}),
      ...(severity === "MANUAL_REVIEW"
        ? { manualReview: { reasonCode: "AMBIGUOUS_PARCEL_ZONE_MATCH" as const, explanation: message, evidenceConsidered: [REFERENCE_DATASET_ID], flaggedAt: NORMALIZED_AT } }
        : {}),
    };
  }

  /** A real Phase 8 result with extra findings appended — an adapter reporting more than one reason. */
  function withFindings(base: E85SpatialNormalizationResult, extra: readonly E85SpatialSourceFinding[]): E85SpatialNormalizationResult {
    if (base.outcome !== "NORMALIZED") throw new Error("expected NORMALIZED");
    return { ...base, findings: [...base.findings, ...extra] };
  }

  /** Parcel sits inside the unmapped zone C, so its problems are material. */
  const insideUnmapped = (extra: readonly E85SpatialSourceFinding[]) =>
    assembleE85DecisionPackage({
      ...request({ parcel: PARCEL_IN_UNMAPPED_RB_C() }),
      normalization: withFindings(normalize(snapshot({ records: [RECORD_A(), RECORD_UNMAPPED_ZONE()] })), extra),
    });

  const codesFor = (p: E85DecisionPackage, featureId: string) =>
    p.materiality
      .filter((m) => m.featureId === featureId && m.sourcePhase === "SPATIAL_NORMALIZATION")
      .map((m) => m.sourceCode)
      .sort();

  test("GENERIC + ONE SPECIFIC — the generic duplicate is suppressed, the specific one survives", () => {
    // The real adapter case: a bow-tie record produces FEATURE_QUARANTINED and
    // GEOMETRY_FAILED_PHASE7_VALIDATION. One problem, described twice.
    const p = decide({ records: [RECORD_A(), RECORD_BOWTIE()] });
    if (p.phase8.outcome !== "NORMALIZED") throw new Error("expected NORMALIZED");
    const emitted = p.phase8.findings.filter((f) => f.featureId === "zone-bad").map((f) => f.code);
    expect(emitted).toContain("FEATURE_QUARANTINED");
    expect(emitted).toContain("GEOMETRY_FAILED_PHASE7_VALIDATION");
    // Exactly one interpretation, and it is the specific one.
    expect(codesFor(p, "zone-bad")).toEqual(["GEOMETRY_FAILED_PHASE7_VALIDATION"]);
  });

  test("GENERIC ALONE is retained — it is the only account of the problem there is", () => {
    const p = insideUnmapped([sourceFinding("FEATURE_QUARANTINED", "GAP", "ghost-1")]);
    expect(codesFor(p, "ghost-1")).toEqual(["FEATURE_QUARANTINED"]);
    expect(p.blockers.some((b) => b.featureId === "ghost-1")).toBe(true);
  });

  test("TWO DISTINCT SPECIFIC PROBLEMS — both survive, and the GAP is not lost to the MANUAL_REVIEW", () => {
    // The core regression. zone-c already carries RULE_PACK_LINK_UNRESOLVED (GAP).
    const p = insideUnmapped([sourceFinding("CONFLICTING_FEATURE_ID", "MANUAL_REVIEW", "zone-c")]);

    expect(codesFor(p, "zone-c")).toEqual(["CONFLICTING_FEATURE_ID", "RULE_PACK_LINK_UNRESOLVED"]);

    const blockers = p.blockers.filter((b) => b.featureId === "zone-c");
    expect(blockers.map((b) => b.sourceCode).sort()).toEqual(["CONFLICTING_FEATURE_ID", "RULE_PACK_LINK_UNRESOLVED"]);
    expect(blockers.map((b) => b.kind).sort()).toEqual(["GAP", "MANUAL_REVIEW"]);

    // Both reach the trace as separate source problems.
    const traced = p.trace.filter((t) => t.kind === "BLOCKER" && t.featureId === "zone-c").map((t) => t.sourceRef);
    expect(traced).toHaveLength(2);
    expect(new Set(traced).size).toBe(2);

    // The documented policy prefers MANUAL_REVIEW when both classes exist — and
    // the GAP remains readable rather than being hidden by that choice.
    expect(p.status).toBe("MANUAL_REVIEW_REQUIRED");
    expect(p.blockers.some((b) => b.kind === "GAP")).toBe(true);
  });

  test("THREE DISTINCT SPECIFIC PROBLEMS — all three survive", () => {
    const p = insideUnmapped([
      sourceFinding("CONFLICTING_FEATURE_ID", "MANUAL_REVIEW", "zone-c"),
      sourceFinding("GEOMETRY_FAILED_PHASE7_VALIDATION", "GAP", "zone-c"),
    ]);
    // No alphabetical first-wins, no severity first-wins, no subject-only collapse.
    expect(codesFor(p, "zone-c")).toEqual(["CONFLICTING_FEATURE_ID", "GEOMETRY_FAILED_PHASE7_VALIDATION", "RULE_PACK_LINK_UNRESOLVED"]);
    expect(p.blockers.filter((b) => b.featureId === "zone-c")).toHaveLength(3);
  });

  test("STATUS DOWNGRADE REGRESSION — a MANUAL_REVIEW can no longer be erased by an earlier-sorting GAP", () => {
    // Reproduces the exact failure found at the gate. "GEOMETRY_FAILED..." sorts
    // before "RULE_PACK..." and before nothing else mattered: previously only it
    // survived, and the package reported DATA_GAP while a MANUAL_REVIEW blocker
    // had been supplied.
    const p = insideUnmapped([
      sourceFinding("GEOMETRY_FAILED_PHASE7_VALIDATION", "GAP", "zone-c"),
      sourceFinding("UNKNOWN_FEATURE_CLASS", "MANUAL_REVIEW", "zone-c"),
    ]);
    expect(p.blockers.filter((b) => b.featureId === "zone-c")).toHaveLength(3);
    expect(p.blockers.some((b) => b.sourceCode === "UNKNOWN_FEATURE_CLASS" && b.kind === "MANUAL_REVIEW")).toBe(true);
    expect(p.blockers.some((b) => b.sourceCode === "GEOMETRY_FAILED_PHASE7_VALIDATION" && b.kind === "GAP")).toBe(true);
    expect(p.blockers.some((b) => b.sourceCode === "RULE_PACK_LINK_UNRESOLVED" && b.kind === "GAP")).toBe(true);
    // The status the erased blocker would have cost.
    expect(p.status).toBe("MANUAL_REVIEW_REQUIRED");
    expect(p.status).not.toBe("DATA_GAP");
  });

  test("THE SAME PROBLEM REPEATED still collapses — dedup was narrowed, not disabled", () => {
    const repeated = sourceFinding("CONFLICTING_FEATURE_ID", "MANUAL_REVIEW", "zone-c");
    const p = insideUnmapped([repeated, { ...repeated, message: "same problem, said again" }]);
    expect(codesFor(p, "zone-c")).toEqual(["CONFLICTING_FEATURE_ID", "RULE_PACK_LINK_UNRESOLVED"]);
  });

  test("the SAME CODE on DIFFERENT subjects survives independently", () => {
    const p = insideUnmapped([sourceFinding("CONFLICTING_FEATURE_ID", "MANUAL_REVIEW", "zone-a"), sourceFinding("CONFLICTING_FEATURE_ID", "MANUAL_REVIEW", "zone-c")]);
    expect(codesFor(p, "zone-a")).toEqual(["CONFLICTING_FEATURE_ID"]);
    expect(codesFor(p, "zone-c")).toEqual(["CONFLICTING_FEATURE_ID", "RULE_PACK_LINK_UNRESOLVED"]);
  });

  test("the surviving set does not depend on the order the findings arrive in", () => {
    const extra = [sourceFinding("CONFLICTING_FEATURE_ID", "MANUAL_REVIEW", "zone-c"), sourceFinding("GEOMETRY_FAILED_PHASE7_VALIDATION", "GAP", "zone-c")];
    const forward = insideUnmapped(extra);
    const reversed = insideUnmapped([...extra].reverse());
    expect(codesFor(reversed, "zone-c")).toEqual(codesFor(forward, "zone-c"));
    expect(reversed.status).toBe(forward.status);
    expect(withoutClock(reversed.materiality)).toBe(withoutClock(forward.materiality));
    expect(withoutClock(reversed.blockers)).toBe(withoutClock(forward.blockers));
    expect(withoutClock(reversed.trace)).toBe(withoutClock(forward.trace));
  });

  test("more blockers do not multiply the SUPPORT trace", () => {
    // A parcel with a real resolved pack AND a multi-problem sibling: the
    // support chain for the good pack is unaffected by how much is wrong
    // elsewhere.
    const base = () => normalize(snapshot({ records: [RECORD_A(), RECORD_UNMAPPED_OVERLAY()] }));
    const plain = assembleE85DecisionPackage({ ...request({ parcel: PARCEL_IN_RB_A() }), normalization: base() });
    const noisy = assembleE85DecisionPackage({
      ...request({ parcel: PARCEL_IN_RB_A() }),
      normalization: withFindings(base(), [
        sourceFinding("CONFLICTING_FEATURE_ID", "MANUAL_REVIEW", "dp-unmapped"),
        sourceFinding("GEOMETRY_FAILED_PHASE7_VALIDATION", "GAP", "dp-unmapped"),
      ]),
    });

    const support = (p: E85DecisionPackage) => p.trace.filter((t) => t.kind === "SUPPORT");
    expect(support(noisy)).toHaveLength(support(plain).length);
    expect(withoutClock(support(noisy))).toBe(withoutClock(support(plain)));
    // And the extra blockers really are present.
    expect(noisy.blockers.filter((b) => b.featureId === "dp-unmapped")).toHaveLength(3);
    expect(plain.blockers.filter((b) => b.featureId === "dp-unmapped")).toHaveLength(1);
  });

  test("a quarantined record's distinct reasons are not erased by the fix either", () => {
    const p = insideUnmapped([
      sourceFinding("FEATURE_QUARANTINED", "GAP", "zone-bad-2"),
      sourceFinding("GEOMETRY_FAILED_PHASE7_VALIDATION", "GAP", "zone-bad-2"),
      sourceFinding("CONFLICTING_FEATURE_ID", "MANUAL_REVIEW", "zone-bad-2"),
    ]);
    // Generic suppressed; both specific reasons retained.
    expect(codesFor(p, "zone-bad-2")).toEqual(["CONFLICTING_FEATURE_ID", "GEOMETRY_FAILED_PHASE7_VALIDATION"]);
    // Still UNDETERMINED: Phase 7 holds no evidence about this subject.
    for (const record of p.materiality.filter((m) => m.featureId === "zone-bad-2")) {
      expect(record.materiality).toBe("UNDETERMINED");
      expect(record.spatialRelation).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// PHASE 15.16C — compile-time reachability proof.
//
// `E85DecisionRequest.asOfDate` is REQUIRED. A genuinely typed request that
// carries `temporalRequest: { mode: "CURRENT" }` therefore ALSO carries a
// required legacy `asOfDate` — and the existing, unmodified
// `resolveE85TemporalRequest` conflict rule (CURRENT conflicts with ANY
// legacy date) means that state always throws. The only way to construct
// "CURRENT with no legacy date" — the one shape that could let CURRENT
// succeed — is to violate the type contract, which the line below proves the
// compiler refuses to allow. If `asOfDate` is ever made optional without
// updating this fixture, this file fails to compile and CI catches it.
// ---------------------------------------------------------------------------
const PHASE_15_16C_CURRENT_WITHOUT_ASOF_DATE: E85DecisionRequest = {
  ...request({ records: [RECORD_A()] }),
  // @ts-expect-error E85DecisionRequest requires asOfDate.
  asOfDate: undefined,
  temporalRequest: { mode: "CURRENT" },
};
void PHASE_15_16C_CURRENT_WITHOUT_ASOF_DATE;

/**
 * Compile-time positive control, for contrast with the fixture above: a
 * matching `AS_OF` `temporalRequest` alongside the required legacy
 * `asOfDate` DOES satisfy `E85DecisionRequest` with no error. This line is
 * expected to type-check cleanly.
 */
const PHASE_15_16C_AS_OF_WITH_REQUIRED_ASOF_DATE: E85DecisionRequest = {
  ...request({ records: [RECORD_A()] }),
  temporalRequest: { mode: "AS_OF", asOfDate: "2026-02-12" },
};
void PHASE_15_16C_AS_OF_WITH_REQUIRED_ASOF_DATE;

describe("E85 Phase 15.16 (Slice 3F-1, revised 3F-1C) — explicit temporal-analysis-not-applied disclosure", () => {
  /**
   * PHASE 15.16E: `asOfDate` must never be assignable to `undefined` through
   * this helper, on ANY path — including a caller who never mentions it.
   * `Partial<Pick<..., "asOfDate" | ...>>` (the Phase 15.16D shape) failed
   * this: because `exactOptionalPropertyTypes` is off, an optional
   * `asOfDate?: string` still accepts a literal `asOfDate: undefined`, and
   * object-spread order (`{ ...request(...), ...overrides }`) would let that
   * explicit `undefined` erase the base request's required legacy date at
   * runtime — reconstructing the exact false CURRENT-success shape Phase
   * 15.16D was meant to close off.
   *
   * The fix is a pair of call signatures (overloads), not one optional
   * field. `ValidRequestBaseOverrides` never declares an `asOfDate` key at
   * all, so a caller who never mentions `asOfDate` (the common case) matches
   * it as-is. A caller who DOES want a non-default `asOfDate` must match the
   * second signature instead, `ValidRequestWithAsOfOverrides`, whose
   * `asOfDate` is a plain required `string` — never optional, so it can
   * never be satisfied by an explicit `undefined`. Each overload is checked
   * against the call's object literal independently (with the object
   * literal's own excess-property check applied per signature, unlike a
   * plain union type, where an excess key valid on one branch can leak
   * leniency into a sibling branch). An object literal that writes
   * `asOfDate: undefined` therefore satisfies neither signature: it is an
   * excess property against the first (which declares no `asOfDate` key),
   * and `undefined` is not assignable to `string` against the second. There
   * is no cast anywhere in this helper.
   */
  interface ValidRequestBaseOverrides {
    temporalRequest?: E85DecisionRequest["temporalRequest"];
    availableRulePacks?: E85DecisionRequest["availableRulePacks"];
  }
  interface ValidRequestWithAsOfOverrides extends ValidRequestBaseOverrides {
    asOfDate: string;
  }

  function validRequest(overrides?: ValidRequestBaseOverrides): E85DecisionRequest;
  function validRequest(overrides: ValidRequestWithAsOfOverrides): E85DecisionRequest;
  function validRequest(overrides: ValidRequestBaseOverrides | ValidRequestWithAsOfOverrides = {}): E85DecisionRequest {
    return { ...request({ records: [RECORD_A()] }), ...overrides };
  }

  function decideValid(overrides?: ValidRequestBaseOverrides): E85DecisionPackage;
  function decideValid(overrides: ValidRequestWithAsOfOverrides): E85DecisionPackage;
  function decideValid(overrides: ValidRequestBaseOverrides | ValidRequestWithAsOfOverrides = {}): E85DecisionPackage {
    return assembleE85DecisionPackage(validRequest(overrides));
  }

  /**
   * PHASE 15.16E — compile-time rejection proof: this helper's `asOfDate`
   * override rejects an explicit `undefined`. Every other field in this
   * literal is genuinely valid (a real `temporalRequest`), so the ONLY
   * possible source of the expected error is `asOfDate: undefined` failing
   * to satisfy either overload of `decideValid`/`validRequest`. This is a
   * type-level fixture only — wrapped in an arrow function that is never
   * invoked, so it has no runtime effect; TypeScript still type-checks an
   * uninvoked function body.
   */
  const _phase1516eRejectsUndefinedAsOf = () =>
    // @ts-expect-error asOfDate must be a genuine string when supplied to this helper; explicit `undefined` is rejected by both overloads.
    decideValid({ asOfDate: undefined, temporalRequest: { mode: "AS_OF", asOfDate: "2026-02-12" } });
  void _phase1516eRejectsUndefinedAsOf;

  /**
   * Positive contrast for the proof above, using the exact same
   * `temporalRequest` value: supplying a genuine `asOfDate` string matches
   * the `ValidRequestWithAsOfOverrides` overload and type-checks cleanly.
   * The equivalent call IS exercised at runtime by the "AS_OF plus a
   * MATCHING legacy asOfDate" test below.
   */
  const _phase1516eAcceptsGenuineAsOf = () => decideValid({ asOfDate: "2026-02-12", temporalRequest: { mode: "AS_OF", asOfDate: "2026-02-12" } });
  void _phase1516eAcceptsGenuineAsOf;

  const clean = () => decideValid();

  const temporalBlocker = (p: E85DecisionPackage) => p.blockers.filter((b) => b.sourcePhase === "TEMPORAL_REQUEST");
  const temporalMateriality = (p: E85DecisionPackage) => p.materiality.filter((m) => m.sourcePhase === "TEMPORAL_REQUEST");

  describe("legacy compatibility — no behavior change without an explicit temporalRequest", () => {
    test("no temporalRequest override: unchanged clean baseline", () => {
      const p = clean();
      expect(temporalMateriality(p)).toEqual([]);
      expect(p.status).toBe("MACHINE_RESOLVED_WITH_WARNINGS");
      expect(p.evaluationCompleteness).toBe("COMPLETE");
    });

    test("legacy asOfDate alone (asOfDate is always required) introduces no additional temporal disclosure", () => {
      // Revised 3F-1 introduces no additional temporal disclosure for legacy
      // asOfDate-only callers. This is not phrased as "byte-identical to a
      // request with no date at all": asOfDate is REQUIRED on
      // E85DecisionRequest, so that hypothetical state does not exist.
      const p = decideValid({ asOfDate: "2026-02-12" });
      expect(temporalMateriality(p)).toEqual([]);
      expect(p.status).toBe("MACHINE_RESOLVED_WITH_WARNINGS");
      expect(p.evaluationCompleteness).toBe("COMPLETE");
    });
  });

  describe("CURRENT is deferred at the E85DecisionRequest boundary — intentional, fail-closed", () => {
    // CURRENT has NO successful decision-orchestration path in revised 3F-1:
    // `E85DecisionRequest.asOfDate` is required, so any genuinely typed
    // request carrying `temporalRequest: { mode: "CURRENT" }` also carries a
    // legacy `asOfDate`, and the existing (unmodified) resolver conflict rule
    // rejects CURRENT plus any legacy date outright. This is not a defect to
    // work around — it is the documented, intentional boundary for this
    // slice; see the compile-time proof above for why no caller can reach
    // around it.
    test("CURRENT plus the required legacy asOfDate throws the existing deterministic temporal-request conflict error", () => {
      expect(() => decideValid({ temporalRequest: { mode: "CURRENT" } })).toThrow(E85TemporalRequestError);
    });

    test("the conflict throws before any decision package, materiality, blocker or trace is constructed", () => {
      let thrown: unknown;
      try {
        decideValid({ temporalRequest: { mode: "CURRENT" } });
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(E85TemporalRequestError);
      expect((thrown as Error).message).toContain("CURRENT conflicts with legacy asOfDate");
    });
  });

  describe("explicit AS_OF — the only reachable successful temporalRequest path", () => {
    test("AS_OF plus a MATCHING legacy asOfDate is accepted; legacy fact filtering continues, and exactly one disclosure fires because temporalRequest was explicit", () => {
      const p = decideValid({ temporalRequest: { mode: "AS_OF", asOfDate: "2026-02-12" } });
      const records = temporalMateriality(p);
      expect(records).toHaveLength(1);
      expect(records[0].sourceRef).toBe("TEMPORAL_REQUEST:TEMPORAL_ANALYSIS_NOT_YET_APPLIED:AS_OF:2026-02-12");
      expect(records[0].sourceCode).toBe("TEMPORAL_ANALYSIS_NOT_YET_APPLIED");
      expect(records[0].kind).toBe("GAP");
      expect(records[0].materiality).toBe("MATERIAL");
      expect(records[0].gap?.reasonCode).toBe("TEMPORAL_ANALYSIS_NOT_YET_APPLIED");
      expect(records[0].reason).toContain("2026-02-12");
      expect(records[0].reason).not.toMatch(/current law|source-version selected|manual review/i);

      expect(temporalBlocker(p)).toHaveLength(1);
      expect(p.evaluationCompleteness).toBe("PARTIAL");
      expect(p.status).not.toBe("MACHINE_RESOLVED");
      expect(p.status).toBe("DATA_GAP");
      // Phase 4 still ran on the legacy asOfDate exactly as before.
      expect(p.phase4?.resolvedMaxFsr?.value).toBe(1.5);
    });

    test("no trace entry is added, and no top-level package field is added", () => {
      const withAsOf = decideValid({ temporalRequest: { mode: "AS_OF", asOfDate: "2026-02-12" } });
      const without = clean();
      expect(withAsOf.trace).toEqual(without.trace);
      expect(Object.keys(withAsOf).sort()).toEqual(Object.keys(without).sort());
      expect((withAsOf as unknown as Record<string, unknown>)["temporalAnalysis"]).toBeUndefined();
    });

    test("AS_OF plus a CONFLICTING legacy asOfDate throws from the existing resolver", () => {
      expect(() => decideValid({ asOfDate: "2026-02-13", temporalRequest: { mode: "AS_OF", asOfDate: "2026-02-12" } })).toThrow(E85TemporalRequestError);
    });
  });

  describe("malformed temporalRequest at the runtime boundary", () => {
    test("a malformed temporalRequest throws the existing deterministic temporal-request error", () => {
      // Runtime-boundary test only: the explicit `as never` cast simulates a
      // caller that bypasses the type system entirely (e.g. deserialized,
      // unvalidated JSON) — the only realistic way this shape can arise.
      // Ordinary valid-request construction elsewhere in this suite never
      // uses a cast.
      expect(() => decideValid({ temporalRequest: { mode: "SOMETIME" } as never })).toThrow(E85TemporalRequestError);
    });
  });

  describe("deduplication and distinctness", () => {
    test("different AS_OF dates produce distinct sourceRefs", () => {
      const asOf1 = decideValid({ asOfDate: "2026-01-01", temporalRequest: { mode: "AS_OF", asOfDate: "2026-01-01" } });
      const asOf2 = decideValid({ asOfDate: "2026-01-02", temporalRequest: { mode: "AS_OF", asOfDate: "2026-01-02" } });
      const refs = [asOf1, asOf2].map((p) => temporalMateriality(p)[0].sourceRef);
      expect(new Set(refs).size).toBe(2);
      expect(refs).toEqual(["TEMPORAL_REQUEST:TEMPORAL_ANALYSIS_NOT_YET_APPLIED:AS_OF:2026-01-01", "TEMPORAL_REQUEST:TEMPORAL_ANALYSIS_NOT_YET_APPLIED:AS_OF:2026-01-02"]);
    });

    test("exactly one request yields exactly one package-level materiality record and one blocker after existing deduplication", () => {
      const p = decideValid({ temporalRequest: { mode: "AS_OF", asOfDate: "2026-02-12" } });
      expect(temporalMateriality(p)).toHaveLength(1);
      expect(temporalBlocker(p)).toHaveLength(1);
    });
  });

  describe("regression — existing materiality/blockers/status precedence are preserved", () => {
    test("an explicit temporalRequest does not erase or duplicate an unrelated upstream blocker", () => {
      const p = decideValid({ availableRulePacks: [], temporalRequest: { mode: "AS_OF", asOfDate: "2026-02-12" } });
      const [packBlocker] = p.blockers.filter((b) => b.sourceCode === "RULE_PACK_NOT_SUPPLIED");
      expect(packBlocker).toBeDefined();
      expect(temporalBlocker(p)).toHaveLength(1);
      expect(p.blockers.length).toBe(2);
      // Both GAP-kind blockers coexist; the terminal status is still DATA_GAP.
      expect(p.status).toBe("DATA_GAP");
    });

    test("Phase 14 C-2C / R1-1 style clean runs are unaffected when temporalRequest is absent", () => {
      const p = clean();
      expect(p.status).toBe("MACHINE_RESOLVED_WITH_WARNINGS");
      expect(p.evaluationCompleteness).toBe("COMPLETE");
    });
  });

  describe("static isolation — no clock, no re-derivation, no new claims", () => {
    test("the resolved request never reaches Phase 4's asOfDate-driven evaluation beyond the legacy field", () => {
      const p = decideValid({ temporalRequest: { mode: "AS_OF", asOfDate: "2026-02-12" } });
      // Same numeric result as the legacy-only run: nothing about resolution changed.
      const legacyOnly = clean();
      expect(p.phase4?.resolvedMaxFsr?.value).toBe(legacyOnly.phase4?.resolvedMaxFsr?.value);
    });

    test("the disclosure's gap carries no fabricated sourcesChecked and a caller-derived checkedAt, never a fresh clock read", () => {
      const p = decideValid({ temporalRequest: { mode: "AS_OF", asOfDate: "2026-02-12" } });
      const [record] = temporalMateriality(p);
      expect(record.gap?.sourcesChecked).toEqual([]);
      expect(record.gap?.checkedAt).toBe(ASSEMBLED_AT);
    });
  });
});

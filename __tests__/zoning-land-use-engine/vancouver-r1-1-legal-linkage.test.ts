/**
 * InvestScape™ E85 Phase 11 — Vancouver R1-1: the first authoritative
 * spatial→legal instrument join.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Contains information licensed under the Open Government Licence – Vancouver.
 *
 * THREE EVIDENCE CLASSES, KEPT DISTINCT THROUGHOUT:
 *
 *   REAL ZONING GEOMETRY   City of Vancouver `zoning-districts-and-labels`,
 *                          release 2026-06-29-data-processing, verbatim.
 *   AUTHORITATIVE LEGAL    City of Vancouver R1-1 District Schedule, Zoning and
 *                          Development By-law 3575, consolidation 2026-06,
 *                          normalized by the Phase 5 adapter from the Phase 3B
 *                          validated facts. Not re-stated here.
 *   SYNTHETIC PARCEL       a square placed inside the real polygon. Not a civic
 *                          parcel; no lot, address, PID or legal description.
 *
 * The join being proven is that the first two describe the same instrument on
 * the same ground — and, just as importantly, that it does NOT happen when the
 * legal half is absent.
 */
import * as fs from "fs";
import * as path from "path";
import {
  assembleE85DecisionPackage,
  canonicalRulePackFromBundle,
  createE85SpatialAdapterRegistry,
  createE85SpatialDatasetRegistry,
  e85RulePackIdFromSource,
  evaluateZoningAndLandUse,
  normalizeE85SpatialSnapshot,
  resolveE85SpatialApplicability,
  rulePackFromBundle,
  adapters,
  E85DecisionPackage,
  E85NormalizedRuleBundle,
  E85ParcelReference,
  E85ParcelSpatialReference,
  E85PolicyVersion,
  E85RawSpatialFeatureRecord,
  E85RequestedAnalysis,
  E85RulePack,
  E85SpatialNormalizationSuccess,
} from "../../src/zoning-land-use-engine";
import {
  auditVancouverLegalLinkage,
  createVancouverZoningSpatialAdapter,
  vancouverZoningDataset,
  vancouverZoningLinkPolicyFromLegalBundles,
  vancouverZoningSpatialAdapter,
  VANCOUVER_LINKAGE_SOURCE_FIELD,
  VANCOUVER_LINKED_SPATIAL_DISTRICT,
  VANCOUVER_ZONING_DISTRICT_TO_RULE_PACKS,
  VANCOUVER_ZONING_RELEASE,
} from "../../src/zoning-land-use-engine/adapters/spatial/vancouver";
import {
  SYNTHETIC_PARCEL_IN_CD_1_423,
  SYNTHETIC_PARCEL_IN_R1_1,
  VANCOUVER_NORMALIZED_AT,
  VANCOUVER_RESOLVED_AT,
  VAN_C_2C,
  VAN_CD_1_423,
  VAN_R1_1,
  VAN_RM_5_WITH_HOLE,
  vancouverSnapshot,
} from "./fixtures/vancouver-spatial-snapshot";
import { deepFreeze, r11Document } from "./fixtures/vancouver-r1-1-facts";

const { vancouverR11Adapter, VANCOUVER_R1_1_SOURCE, VANCOUVER_R1_1_SOURCE_ID, VANCOUVER_R1_1_VERSION_ID, VANCOUVER_JURISDICTION_ID } = adapters.vancouver;

const ASSEMBLED_AT = "2026-09-14T00:00:00.000Z";
const COMPOSED_AT = "2026-09-14T00:00:00.000Z";
const ALL_ANALYSES: readonly E85RequestedAnalysis[] = ["USE", "DENSITY", "DIMENSIONAL"];

/** The canonical id both halves of the join derive independently. Stated once so a drift shows up here. */
const R1_1_PACK_ID = "ca-bc-vancouver:zoning-development-bylaw-3575:district-schedule-r1-1@2026-06-consolidation";

/* ------------------------------------------------------------------ *
 * The authoritative legal half — produced by the Phase 5 adapter, never
 * hand-copied. No FSR, height or setback figure is restated in this file.
 * ------------------------------------------------------------------ */

function r11Bundle(): E85NormalizedRuleBundle {
  const result = vancouverR11Adapter.normalize(r11Document(), VANCOUVER_R1_1_SOURCE);
  if (result.outcome !== "NORMALIZED") throw new Error(`expected NORMALIZED, got ${result.outcome}`);
  return result.bundle;
}

const r11Pack = (): E85RulePack => canonicalRulePackFromBundle(r11Bundle(), "BASE");

/* ------------------------------------------------------------------ *
 * The spatial half.
 * ------------------------------------------------------------------ */

const datasets = () => createE85SpatialDatasetRegistry([vancouverZoningDataset()]);

function normalized(records: readonly E85RawSpatialFeatureRecord[], legalBundles: readonly E85NormalizedRuleBundle[] = []): E85SpatialNormalizationSuccess {
  const adapter = legalBundles.length === 0 ? vancouverZoningSpatialAdapter : createVancouverZoningSpatialAdapter(vancouverZoningLinkPolicyFromLegalBundles(legalBundles));
  const registry = createE85SpatialAdapterRegistry([adapter]);
  if (!registry.ok) throw new Error("adapter registry problems");
  const result = normalizeE85SpatialSnapshot(vancouverSnapshot(records), datasets(), registry.registry, { normalizedAt: VANCOUVER_NORMALIZED_AT });
  if (result.outcome !== "NORMALIZED") throw new Error(`expected NORMALIZED, got ${result.reason}`);
  return result;
}

const featureById = (r: E85SpatialNormalizationSuccess, id: string) => r.features.find((f) => f.featureId === id);

/* ------------------------------------------------------------------ *
 * §4 / §7 / §8 / §9 — canonical identity
 * ------------------------------------------------------------------ */

describe("E85 Phase 11 — canonical rule-pack identity comes from the legal source", () => {
  test("the derived id is the registered instrument identity plus its version", () => {
    expect(e85RulePackIdFromSource({ sourceId: VANCOUVER_R1_1_SOURCE_ID, sourceVersionId: VANCOUVER_R1_1_VERSION_ID })).toBe(R1_1_PACK_ID);
  });

  test("it is NOT the display label, and not any of the ambiguous short forms", () => {
    const id = r11Pack().packId;
    for (const forbidden of ["R1-1", "r1-1", "R1", "r1", "base", "vancouver-r1"]) expect(id).not.toBe(forbidden);
    // The designation may appear as a SLUG COMPONENT of the legal source id,
    // because the by-law itself names the district schedule that way — not
    // because a map label was converted into an identifier.
    expect(id.startsWith(VANCOUVER_R1_1_SOURCE_ID)).toBe(true);
  });

  test("it is jurisdiction-scoped by construction", () => {
    expect(r11Pack().packId.startsWith(`${VANCOUVER_JURISDICTION_ID}:`)).toBe(true);
  });

  test("it carries no UUID, array index, timestamp or hash", () => {
    const id = r11Pack().packId;
    expect(id).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(id).not.toMatch(/\[\d+\]|#\d+$/);
    expect(id).not.toMatch(/T\d{2}:\d{2}:\d{2}/);
    expect(id).not.toMatch(/\b[0-9a-f]{32,}\b/i);
  });

  test("the instrument identity and the normalized pack instance stay distinguishable", () => {
    // sourceId names the schedule across time; the pack id names one
    // consolidation of it. Both are recoverable from the pack.
    const pack = r11Pack();
    expect(pack.sourceId).toBe(VANCOUVER_R1_1_SOURCE_ID);
    expect(pack.sourceVersionId).toBe(VANCOUVER_R1_1_VERSION_ID);
    expect(pack.packId).toContain(pack.sourceId);
    expect(pack.packId).toContain(pack.sourceVersionId as string);
  });

  test("an empty sourceId is refused rather than producing an invented name", () => {
    expect(() => e85RulePackIdFromSource({ sourceId: "", sourceVersionId: "v" })).toThrow(/never manufactured/);
  });
});

describe("E85 Phase 11 — identity collision and version separation", () => {
  test("same source and version → identical id, every time", () => {
    expect(e85RulePackIdFromSource({ sourceId: VANCOUVER_R1_1_SOURCE_ID, sourceVersionId: VANCOUVER_R1_1_VERSION_ID })).toBe(
      e85RulePackIdFromSource({ sourceId: VANCOUVER_R1_1_SOURCE_ID, sourceVersionId: VANCOUVER_R1_1_VERSION_ID }),
    );
    expect(canonicalRulePackFromBundle(r11Bundle(), "BASE").packId).toBe(r11Pack().packId);
  });

  test("another municipality's R1-1 gets a different id — no cross-jurisdiction collision", () => {
    const elsewhere = e85RulePackIdFromSource({ sourceId: "ca-bc-burnaby:zoning-bylaw-4742:district-schedule-r1-1", sourceVersionId: VANCOUVER_R1_1_VERSION_ID });
    expect(elsewhere).not.toBe(R1_1_PACK_ID);
    expect(elsewhere.startsWith("ca-bc-burnaby:")).toBe(true);
  });

  test("a different consolidation of the SAME instrument is a different pack instance", () => {
    const amended = e85RulePackIdFromSource({ sourceId: VANCOUVER_R1_1_SOURCE_ID, sourceVersionId: "2027-03-consolidation" });
    expect(amended).not.toBe(R1_1_PACK_ID);
    // …yet both still name the same enduring instrument.
    expect(amended.startsWith(VANCOUVER_R1_1_SOURCE_ID)).toBe(true);
  });

  test("a pack with no version degrades to the instrument identity rather than inventing one", () => {
    expect(e85RulePackIdFromSource({ sourceId: VANCOUVER_R1_1_SOURCE_ID })).toBe(VANCOUVER_R1_1_SOURCE_ID);
  });

  test("the caller-supplied-id path still works unchanged — no existing caller is broken", () => {
    expect(rulePackFromBundle(r11Bundle(), "caller-chosen", "BASE").packId).toBe("caller-chosen");
  });
});

/* ------------------------------------------------------------------ *
 * §5 / §11 — the join, on four exact axes
 * ------------------------------------------------------------------ */

describe("E85 Phase 11 — the spatial→legal join is exact on every axis", () => {
  test("the validated R1-1 bundle resolves the R1-1 district and nothing else", () => {
    const policy = vancouverZoningLinkPolicyFromLegalBundles([r11Bundle()]);
    expect(Object.keys(policy)).toEqual(["R1-1"]);
    expect(policy["R1-1"]).toEqual([R1_1_PACK_ID]);
  });

  test("the join keys on zoning_district — never on the category grouping or the CD-1 number", () => {
    expect(VANCOUVER_LINKAGE_SOURCE_FIELD).toBe("zoning_district");
    expect(VANCOUVER_LINKED_SPATIAL_DISTRICT).toBe("R1-1");
  });

  test("a bundle from another jurisdiction is rejected, however well its zone matches", () => {
    const foreign = { ...r11Bundle(), jurisdictionId: "ca-bc-burnaby" };
    expect(vancouverZoningLinkPolicyFromLegalBundles([foreign])).toEqual({});
    expect(auditVancouverLegalLinkage([foreign]).rejected[0].reason).toBe("JURISDICTION_MISMATCH");
  });

  test("a bundle from another source is rejected", () => {
    const other = { ...r11Bundle(), sourceId: "ca-bc-vancouver:parking-bylaw-6059" };
    expect(vancouverZoningLinkPolicyFromLegalBundles([other])).toEqual({});
    expect(auditVancouverLegalLinkage([other]).rejected[0].reason).toBe("SOURCE_NOT_R1_1_DISTRICT_SCHEDULE");
  });

  test("a bundle from an unverified consolidation is rejected", () => {
    const stale = { ...r11Bundle(), sourceVersionId: "2019-01-consolidation" };
    expect(vancouverZoningLinkPolicyFromLegalBundles([stale])).toEqual({});
    expect(auditVancouverLegalLinkage([stale]).rejected[0].reason).toBe("VERSION_NOT_VERIFIED");
  });

  test("a bundle for another zone is rejected", () => {
    const otherZone = { ...r11Bundle(), zoneDesignation: "RM-4" };
    expect(vancouverZoningLinkPolicyFromLegalBundles([otherZone])).toEqual({});
    expect(auditVancouverLegalLinkage([otherZone]).rejected[0].reason).toBe("ZONE_NOT_R1_1");
  });

  test("the same instrument supplied twice yields one pack id, not two", () => {
    expect(vancouverZoningLinkPolicyFromLegalBundles([r11Bundle(), r11Bundle()])["R1-1"]).toEqual([R1_1_PACK_ID]);
  });

  test("no fuzzy matching: R1, Residential and Residential Inclusive resolve nothing", () => {
    const policy = vancouverZoningLinkPolicyFromLegalBundles([r11Bundle()]);
    for (const near of ["R1", "R1-1A", "r1-1", "Residential", "Residential Inclusive", "RS-1"]) {
      expect(policy[near]).toBeUndefined();
    }
  });
});

/* ------------------------------------------------------------------ *
 * §18 / §19 — evidence-gated behaviour
 * ------------------------------------------------------------------ */

describe("E85 Phase 11 — missing legal evidence leaves the linkage unresolved", () => {
  test("the production default remains empty — the adapter alone claims nothing", () => {
    expect(Object.keys(VANCOUVER_ZONING_DISTRICT_TO_RULE_PACKS)).toEqual([]);
    expect(vancouverZoningLinkPolicyFromLegalBundles([])).toEqual({});
  });

  test("a real R1-1 feature with no legal bundle keeps its geometry and its gap", () => {
    const r = normalized([VAN_R1_1]);
    const f = featureById(r, "494787");
    expect(f?.geometry.type).toBe("POLYGON");
    expect(f?.rulePackIds).toEqual([]);
    expect(r.findings.some((x) => x.featureId === "494787" && x.code === "RULE_PACK_LINK_UNRESOLVED")).toBe(true);
    expect(r.readiness.rulePackLinkageSupported).toBe(false);
  });

  test("and a parcel inside it is blocked, materially", () => {
    const p = decide({ records: [VAN_R1_1], legal: [] });
    expect(p.phase7?.hits.find((h) => h.featureId === "494787")?.relation).toBe("CONTAINS");
    expect(p.materiality.some((m) => m.featureId === "494787" && m.materiality === "MATERIAL")).toBe(true);
    expect(p.blockers.some((b) => b.featureId === "494787")).toBe(true);
    expect(p.status).not.toBe("MACHINE_RESOLVED");
  });
});

describe("E85 Phase 11 — supplied legal evidence resolves R1-1, and only R1-1", () => {
  test("the R1-1 feature carries the canonical pack id and loses its gap", () => {
    const r = normalized([VAN_R1_1, VAN_C_2C, VAN_CD_1_423, VAN_RM_5_WITH_HOLE], [r11Bundle()]);
    expect(featureById(r, "494787")?.rulePackIds).toEqual([R1_1_PACK_ID]);
    expect(r.findings.some((x) => x.featureId === "494787" && x.code === "RULE_PACK_LINK_UNRESOLVED")).toBe(false);
    expect(r.readiness.rulePackLinkageSupported).toBe(true);
  });

  test("every other district stays unresolved — C-2C, CD-1 (423) and RM-5 gain nothing", () => {
    const r = normalized([VAN_R1_1, VAN_C_2C, VAN_CD_1_423, VAN_RM_5_WITH_HOLE], [r11Bundle()]);
    for (const id of ["494642", "495494", "494597"]) {
      expect(featureById(r, id)?.rulePackIds).toEqual([]);
      expect(r.findings.some((x) => x.featureId === id && x.code === "RULE_PACK_LINK_UNRESOLVED")).toBe(true);
    }
  });

  test("the CD-1 feature is not linked, and no cd_1_number appears in any pack id", () => {
    const r = normalized([VAN_CD_1_423], [r11Bundle()]);
    expect(featureById(r, "495494")?.rulePackIds).toEqual([]);
    expect(JSON.stringify(r.features)).not.toContain(`"423"]`);
  });
});

/* ------------------------------------------------------------------ *
 * §14 — quarantine survives legal knowledge
 * ------------------------------------------------------------------ */

describe("E85 Phase 11 — a quarantined R1-1 record is not promoted by knowing its law", () => {
  /** A real R1-1 record's attributes on geometry Phase 7 refuses. Legal identity is known; the boundary is still unusable. */
  const brokenR11: E85RawSpatialFeatureRecord = {
    rawFeatureId: "494810",
    rawAttributes: { ...VAN_R1_1.rawAttributes, object_id: "494810" },
    // Hole touches the shell — the same condition that quarantines 494885.
    rawGeometry: {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [100, 0],
          [100, 100],
          [0, 100],
          [0, 0],
        ],
        [
          [0, 0],
          [10, 20],
          [20, 10],
          [0, 0],
        ],
      ],
    },
  };

  test("it is quarantined for geometry, carries no rule pack, and never reaches Phase 7", () => {
    const r = normalized([VAN_R1_1, brokenR11], [r11Bundle()]);
    expect(r.quarantined.map((q) => q.featureId)).toEqual(["494810"]);
    expect(r.quarantined[0].reasonCodes).toEqual(["GEOMETRY_FAILED_PHASE7_VALIDATION"]);
    expect(featureById(r, "494810")).toBeUndefined();
    // The healthy R1-1 record in the same snapshot still links.
    expect(featureById(r, "494787")?.rulePackIds).toEqual([R1_1_PACK_ID]);
  });

  test("legal linkage does not bypass the geometry gate", () => {
    const r = normalized([brokenR11], [r11Bundle()]);
    expect(r.features).toHaveLength(0);
    expect(r.readiness.rulePackLinkageSupported).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * §20 / §21 / §22 / §23 — real end to end
 * ------------------------------------------------------------------ */

function parcelRef(parcelReferenceId: string): E85ParcelReference {
  return {
    parcelReferenceId,
    jurisdiction: {
      jurisdictionId: VANCOUVER_JURISDICTION_ID,
      country: "CA",
      regionCode: "BC",
      municipality: "Vancouver",
      regulatoryAuthority: "City of Vancouver — Planning, Urban Design and Sustainability",
      displayName: "City of Vancouver, BC, Canada",
    },
    rawZoningDesignation: "R1-1",
    siteAreaSqm: 500,
  };
}

const policy = (): E85PolicyVersion => ({ policyVersionId: "phase11-v1", effectiveFrom: "2020-01-01", concepts: {} });

interface DecideSpec {
  records?: readonly E85RawSpatialFeatureRecord[];
  legal?: readonly E85NormalizedRuleBundle[];
  parcel?: E85ParcelSpatialReference;
}

function decide(spec: DecideSpec = {}): E85DecisionPackage {
  const legal = spec.legal ?? [r11Bundle()];
  const parcel = spec.parcel ?? SYNTHETIC_PARCEL_IN_R1_1();
  const adapter = legal.length === 0 ? vancouverZoningSpatialAdapter : createVancouverZoningSpatialAdapter(vancouverZoningLinkPolicyFromLegalBundles(legal));
  const registry = createE85SpatialAdapterRegistry([adapter]);
  if (!registry.ok) throw new Error("adapter registry problems");
  return assembleE85DecisionPackage({
    decisionId: "vancouver-r1-1-linked",
    normalization: normalizeE85SpatialSnapshot(vancouverSnapshot(spec.records ?? [VAN_R1_1]), datasets(), registry.registry, { normalizedAt: VANCOUVER_NORMALIZED_AT }),
    parcelSpatial: parcel,
    parcel: parcelRef(parcel.parcelReferenceId),
    jurisdictionId: VANCOUVER_JURISDICTION_ID,
    zoneDesignation: "R1-1",
    useCode: "one_family_dwelling",
    asOfDate: "2026-09-14",
    requestedAnalyses: ALL_ANALYSES,
    policyVersion: policy(),
    availableRulePacks: legal.map((b) => canonicalRulePackFromBundle(b, "BASE")),
    spatialRegistry: datasets(),
    resolvedAt: VANCOUVER_RESOLVED_AT,
    composedAt: COMPOSED_AT,
    assembledAt: ASSEMBLED_AT,
  });
}

describe("E85 Phase 11 — real City geometry, real City law, synthetic parcel, end to end", () => {
  test("Phase 8 links, Phase 7 applies, Phase 6 receives the pack, Phase 4 evaluates", () => {
    const p = decide();

    if (p.phase8.outcome !== "NORMALIZED") throw new Error("expected NORMALIZED");
    expect(p.phase8.features.find((f) => f.featureId === "494787")?.rulePackIds).toEqual([R1_1_PACK_ID]);

    expect(p.phase7?.hits.find((h) => h.featureId === "494787")?.relation).toBe("CONTAINS");
    expect(p.phase7?.hits.find((h) => h.featureId === "494787")?.applicability).toBe("APPLIES");
    expect(p.phase7?.applicableRulePackIds).toEqual([R1_1_PACK_ID]);

    expect(p.phase6).toBeDefined();
    expect(p.phase4).toBeDefined();
  });

  test("the real R1-1 provisions reach Phase 4 — the join delivered rules, not just geometry", () => {
    // The concrete regulatory content, asserted positively so this cannot pass
    // on two undefineds. Every value below originates in the Phase 3B validated
    // fact set and is produced by the Phase 5 adapter; none is restated here.
    const p = decide();
    const considered = p.phase4?.result.rulesConsidered ?? [];
    expect(considered.length).toBeGreaterThan(0);

    const use = considered.find((r) => r.family === "USE");
    const permission = use?.permissions?.find((e) => e.value.useCode === "one_family_dwelling");
    expect(permission?.value.status).toBe("PERMITTED");
    expect(permission?.value.rawSourceTerminology).toBe("Outright Approval Use");

    const density = considered.find((r) => r.family === "DENSITY");
    expect(density?.maxFsr?.value).toBe(1);

    // And every one of them is traceable to the City's by-law, not to this file.
    expect(permission?.provenance.sourceId).toBe(VANCOUVER_R1_1_SOURCE_ID);
    expect(permission?.provenance.sourceVersionId).toBe(VANCOUVER_R1_1_VERSION_ID);
    expect(permission?.provenance.documentLocator?.bylawOrDocumentId).toBe("3575");
  });

  test("the pipeline reaches the same conclusion as evaluating the bundle directly", () => {
    // The join added geometry, not rules: routing the authoritative bundle
    // through Phases 8→7→6→4 must not change what Phase 4 concludes from it.
    const p = decide();
    const direct = evaluateZoningAndLandUse({
      parcel: parcelRef("direct-check"),
      jurisdictionId: VANCOUVER_JURISDICTION_ID,
      zoneDesignation: "R1-1",
      useCode: "one_family_dwelling",
      asOfDate: "2026-09-14",
      requestedAnalyses: ALL_ANALYSES,
      policyVersion: policy(),
      rules: r11Bundle().rules,
    });
    expect(p.phase4?.result.status).toBe(direct.result.status);

    // Compared by CONTENT, not byte-for-byte: composition orders permissions
    // canonically, so the pipeline legitimately hands Phase 4 the same claims
    // in a different order. Asserting the raw JSON would be asserting
    // composition's sort order, which is not what this test is about.
    const claims = (outcome: typeof direct): readonly string[] =>
      (outcome.result.rulesConsidered ?? [])
        .flatMap((rule): string[] => {
          if (rule.family === "USE") return (rule.permissions ?? []).map((e) => `USE:${e.value.useCode}=${e.value.status}`);
          if (rule.family === "DENSITY") return rule.maxFsr === undefined ? [] : [`FSR=${rule.maxFsr.value}`];
          if (rule.family === "DIMENSIONAL") {
            return [
              ...(rule.maxHeightMetres === undefined ? [] : [`HEIGHT=${rule.maxHeightMetres.value}`]),
              ...(rule.maxStoreys === undefined ? [] : [`STOREYS=${rule.maxStoreys.value}`]),
              ...(rule.maxSiteCoverageFraction === undefined ? [] : [`COVERAGE=${rule.maxSiteCoverageFraction.value}`]),
              ...(rule.setbacksMetres?.front === undefined ? [] : [`FRONT=${rule.setbacksMetres.front.value}`]),
            ];
          }
          return [];
        })
        .sort();

    const viaPipeline = claims(p.phase4 as unknown as typeof direct);
    expect(viaPipeline).toEqual(claims(direct));
    // And it really is the substantive R1-1 content, not an empty set.
    expect(viaPipeline).toEqual(["COVERAGE=0.5", "FRONT=4.9", "FSR=1", "HEIGHT=11.5", "STOREYS=3", "USE:multiple_dwelling=CONDITIONAL", "USE:one_family_dwelling=PERMITTED"]);
  });

  test("§21 SUPPORT trace answers both WHY this rule and WHY at this parcel", () => {
    const p = decide();
    const trace = JSON.stringify(p.trace);

    // WHY this rule — legal provenance.
    expect(trace).toContain(R1_1_PACK_ID);
    expect(trace).toContain(VANCOUVER_R1_1_SOURCE_ID);
    expect(trace).toContain(VANCOUVER_R1_1_VERSION_ID);

    // WHY at this parcel — spatial provenance.
    expect(trace).toContain("494787");
    const supports = p.trace.filter((t) => t.kind === "SUPPORT");
    expect(supports.length).toBeGreaterThan(0);
  });

  test("§22 the spatial release and the legal consolidation are retained independently", () => {
    const p = decide();
    if (p.phase8.outcome !== "NORMALIZED") throw new Error("expected NORMALIZED");

    // Spatial side.
    expect(p.phase8.datasetVersionId).toBe(VANCOUVER_ZONING_RELEASE);
    expect(p.phase7?.hits.find((h) => h.featureId === "494787")?.datasetVersionId).toBe(VANCOUVER_ZONING_RELEASE);

    // Legal side — a different identity, on a different cycle.
    if (p.phase6?.outcome !== "COMPOSED") throw new Error("expected COMPOSED");
    expect(p.phase6.composed.contributingPackIds).toContain(R1_1_PACK_ID);
    expect(p.phase6.composed.contributingSourceIds).toContain(VANCOUVER_R1_1_SOURCE_ID);
    expect(JSON.stringify(p.phase6.composed)).toContain(VANCOUVER_R1_1_VERSION_ID);

    // The two version identities are genuinely different values, not one
    // "current version" wearing two names.
    expect(VANCOUVER_ZONING_RELEASE).not.toBe(VANCOUVER_R1_1_VERSION_ID);
  });

  test("§23 UNKNOWN temporal overlap is not laundered into a clean result", () => {
    // BOTH sides are silent on legal effect: the layer publishes no effective
    // date, and the schedule prints "June 2026" with no adoption date. So the
    // identity join succeeds and the TEMPORAL join cannot be established.
    const p = decide();
    expect(r11Bundle().temporal.effectiveDateBasis).toBe("UNKNOWN");
    expect(vancouverZoningDataset().versions[0].effectiveDateBasis).toBe("UNKNOWN");

    // Phase 4 reaches the rules and then refuses to date them, using the
    // existing Phase 5A vocabulary — no new temporal status was invented.
    const phase4 = p.phase4?.result;
    if (phase4?.status !== "DATA_GAP") throw new Error(`expected Phase 4 DATA_GAP, got ${String(phase4?.status)}`);
    expect(phase4.gaps.some((g) => g.reasonCode === "EFFECTIVE_DATE_UNKNOWN")).toBe(true);

    // No regulatory envelope is produced from undated rules.
    expect(p.phase4?.usePermission).toBeUndefined();
    expect(p.phase4?.resolvedMaxFsr).toBeUndefined();

    // And the decision reports that, rather than a clean answer.
    expect(p.status).toBe("DATA_GAP");
    expect(p.status).not.toBe("MACHINE_RESOLVED");
    expect(p.status).not.toBe("MACHINE_RESOLVED_WITH_WARNINGS");
  });

  test("§23 the gap is temporal, NOT a failure of the linkage", () => {
    // The distinction that makes this phase worth reviewing: the instrument was
    // identified, applied and composed. What is missing is the date it took
    // effect — a fact about the City's document, not about the join.
    const p = decide();
    expect(p.phase7?.applicableRulePackIds).toEqual([R1_1_PACK_ID]);
    expect(p.phase6?.outcome).toBe("COMPOSED");
    expect(p.blockers.filter((b) => b.sourceCode === "RULE_PACK_LINK_UNRESOLVED")).toEqual([]);
    expect(p.blockers).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * §24 — incremental coverage stays possible
 * ------------------------------------------------------------------ */

describe("E85 Phase 11 — unlinked districts elsewhere do not block a linked parcel", () => {
  test("a disjoint unresolved CD-1 is NON_MATERIAL to an R1-1 parcel", () => {
    const p = decide({ records: [VAN_R1_1, VAN_CD_1_423, VAN_C_2C] });
    const cd1 = p.materiality.filter((m) => m.featureId === "495494");
    expect(cd1.length).toBeGreaterThan(0);
    expect(cd1.every((m) => m.materiality === "NON_MATERIAL")).toBe(true);
    expect(p.blockers.some((b) => b.featureId === "495494")).toBe(false);
    expect(p.phase7?.applicableRulePackIds).toEqual([R1_1_PACK_ID]);
  });

  test("the reverse still holds: a parcel inside the unlinked CD-1 is blocked", () => {
    const p = decide({ records: [VAN_R1_1, VAN_CD_1_423], parcel: SYNTHETIC_PARCEL_IN_CD_1_423() });
    expect(p.phase7?.applicableRulePackIds).toEqual([]);
    expect(p.materiality.some((m) => m.featureId === "495494" && m.materiality === "MATERIAL")).toBe(true);
    expect(p.status).not.toBe("MACHINE_RESOLVED");
  });
});

/* ------------------------------------------------------------------ *
 * §29 — licensing stays on separate axes
 * ------------------------------------------------------------------ */

describe("E85 Phase 11 — open spatial data does not upgrade the legal document's rights", () => {
  test("the two sources keep their own licence status", () => {
    expect(vancouverZoningDataset().licenseStatus).toBe("PUBLIC_REUSE");
    expect(VANCOUVER_R1_1_SOURCE.licenseStatus).toBe("LICENSE_UNKNOWN");
  });

  test("the legal source's licence blocker survives the join", () => {
    const readiness = r11Bundle().readiness;
    expect(readiness.licenseStatus).toBe("LICENSE_UNKNOWN");
    expect(readiness.analyticalReadiness).toBe("BLOCKED_BY_LICENSE");
    // And it is still visible on the pack after composition.
    expect(r11Pack().readiness?.licenseStatus).toBe("LICENSE_UNKNOWN");
  });

  test("linking a PUBLIC_REUSE layer to a LICENSE_UNKNOWN instrument grants no new rights", () => {
    const p = decide();
    expect(JSON.stringify(p.phase6 ?? {})).not.toContain("PUBLIC_REUSE");
  });
});

/* ------------------------------------------------------------------ *
 * §34 — determinism and immutability
 * ------------------------------------------------------------------ */

describe("E85 Phase 11 — determinism and immutability", () => {
  test("identity derivation and linkage are deterministic", () => {
    expect(JSON.stringify(vancouverZoningLinkPolicyFromLegalBundles([r11Bundle()]))).toBe(JSON.stringify(vancouverZoningLinkPolicyFromLegalBundles([r11Bundle()])));
    expect(JSON.stringify(normalized([VAN_R1_1], [r11Bundle()]))).toBe(JSON.stringify(normalized([VAN_R1_1], [r11Bundle()])));
  });

  test("bundle order does not change the policy", () => {
    const other = { ...r11Bundle(), sourceId: "ca-bc-vancouver:parking-bylaw-6059" };
    expect(vancouverZoningLinkPolicyFromLegalBundles([r11Bundle(), other])).toEqual(vancouverZoningLinkPolicyFromLegalBundles([other, r11Bundle()]));
  });

  test("record order does not change the linked output", () => {
    const forward = normalized([VAN_R1_1, VAN_C_2C, VAN_CD_1_423], [r11Bundle()]);
    const reversed = normalized([VAN_CD_1_423, VAN_C_2C, VAN_R1_1], [r11Bundle()]);
    expect(JSON.stringify(forward.features)).toBe(JSON.stringify(reversed.features));
  });

  test("a frozen legal bundle is not mutated by the linkage", () => {
    const frozen = deepFreeze(r11Bundle());
    expect(() => vancouverZoningLinkPolicyFromLegalBundles([frozen])).not.toThrow();
    expect(() => canonicalRulePackFromBundle(frozen, "BASE")).not.toThrow();
  });

  test("a frozen spatial snapshot is not mutated by normalization", () => {
    const snap = deepFreeze(vancouverSnapshot([VAN_R1_1]));
    const registry = createE85SpatialAdapterRegistry([createVancouverZoningSpatialAdapter(vancouverZoningLinkPolicyFromLegalBundles([r11Bundle()]))]);
    if (!registry.ok) throw new Error("adapter registry problems");
    expect(() => normalizeE85SpatialSnapshot(snap, datasets(), registry.registry, { normalizedAt: VANCOUVER_NORMALIZED_AT })).not.toThrow();
  });
});

/* ------------------------------------------------------------------ *
 * §28 / §32 — scope protection for the new identity mechanism
 * ------------------------------------------------------------------ */

describe("E85 Phase 11 scope protection — identity is never derived from a display label", () => {
  const engineDir = path.join(__dirname, "../../src/zoning-land-use-engine");
  const executable = (source: string) =>
    source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1")
      .replace(/`(?:[^`\\]|\\.)*`/g, (literal) => (literal.match(/\$\{[^}]*\}/g) ?? []).join(" "))
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''");

  test("the generic id helper reads only sourceId and sourceVersionId", () => {
    const src = fs.readFileSync(path.join(engineDir, "composition-types.ts"), "utf8");
    const body = src.slice(src.indexOf("export function e85RulePackIdFromSource"), src.indexOf("export function canonicalRulePackFromBundle"));
    expect(body).toContain("sourceId");
    expect(body).toContain("sourceVersionId");
    // The one thing it must never touch.
    expect(executable(body)).not.toContain("zoneDesignation");
  });

  test("no generic core file converts a zone designation into a pack id", () => {
    const files = fs.readdirSync(engineDir).filter((f) => f.endsWith(".ts"));
    for (const file of files) {
      const content = executable(fs.readFileSync(path.join(engineDir, file), "utf8"));
      for (const term of [/packId\s*[:=]\s*\w*zoneDesignation/, /packId\s*[:=]\s*`[^`]*zoneDesignation/, /zoneDesignation[^;\n]{0,40}\.toLowerCase\(\)[^;\n]{0,40}packId/]) {
        expect({ file, term: term.source, found: term.test(content) }).toEqual({ file, term: term.source, found: false });
      }
    }
  });

  test("generic Phase 7/8/9 core does not import the Vancouver legal linkage", () => {
    const files = fs.readdirSync(engineDir).filter((f) => f.endsWith(".ts"));
    for (const file of files) {
      const content = fs.readFileSync(path.join(engineDir, file), "utf8");
      expect({ file, imports: /vancouver-legal-linkage|adapters\/spatial\/vancouver/.test(content) }).toEqual({ file, imports: false });
    }
  });

  test("the linkage module performs no acquisition, reads no clock, and repairs no geometry", () => {
    const content = executable(fs.readFileSync(path.join(engineDir, "adapters/spatial/vancouver/vancouver-legal-linkage.ts"), "utf8"));
    for (const term of [/\bfetch\b/, /\baxios\b/i, /\bfs\b/, /readFile/i, /https?:\/\//, /new Date\(\)/, /Date\.now\(\)/, /reproject/i, /snapTo/i, /makeValid/i, /\bbuffer\s*\(/i]) {
      expect({ term: term.source, found: term.test(content) }).toEqual({ term: term.source, found: false });
    }
  });

  test("no CD-1 production linkage exists anywhere in the Vancouver spatial modules", () => {
    const dir = path.join(engineDir, "adapters/spatial/vancouver");
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
      const content = executable(fs.readFileSync(path.join(dir, file), "utf8"));
      for (const term = /cd1Number[^;\n]{0,60}packId/, found = term.test(content); ; ) {
        expect({ file, found }).toEqual({ file, found: false });
        break;
      }
    }
    // And the only district this phase links is R1-1.
    expect(VANCOUVER_LINKED_SPATIAL_DISTRICT).toBe("R1-1");
  });
});

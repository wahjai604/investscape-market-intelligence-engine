/**
 * InvestScape™ E85 Phase 14.4B — Vancouver C-2C spatial->legal linkage tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Proves the Phase 14.4B generalization of `vancouver-legal-linkage.ts` (a
 * single hard-coded R1-1 scalar -> a small immutable per-district table)
 * works correctly for the new C-2C entry, on the real C-2C spatial feature
 * (494642), while `vancouver-r1-1-legal-linkage.test.ts` continues to prove
 * R1-1's own behavior is unchanged (that file's suite is the R1-1 regression
 * proof for this same generalization).
 */
import {
  createE85SpatialAdapterRegistry,
  createE85SpatialDatasetRegistry,
  e85RulePackIdFromSource,
  normalizeE85SpatialSnapshot,
  adapters,
  E85NormalizedRuleBundle,
  E85SpatialNormalizationSuccess,
} from "../../src/zoning-land-use-engine";
import {
  auditVancouverLegalLinkage,
  createVancouverZoningSpatialAdapter,
  vancouverZoningDataset,
  vancouverZoningLinkPolicyFromLegalBundles,
  VANCOUVER_LINKAGE_SOURCE_FIELD,
} from "../../src/zoning-land-use-engine/adapters/spatial/vancouver";
import { VAN_C_2C, VAN_R1_1, VANCOUVER_NORMALIZED_AT, vancouverSnapshot } from "./fixtures/vancouver-spatial-snapshot";
import { c2cDocument } from "./fixtures/vancouver-c-2c-facts";
import { r11Document } from "./fixtures/vancouver-r1-1-facts";

const { vancouverC2CAdapter, VANCOUVER_C_2C_SOURCE, VANCOUVER_C_2C_SOURCE_ID, VANCOUVER_C_2C_VERSION_ID, vancouverR11Adapter, VANCOUVER_R1_1_SOURCE, VANCOUVER_R1_1_SOURCE_ID, VANCOUVER_R1_1_VERSION_ID } = adapters.vancouver;

const C_2C_PACK_ID = "ca-bc-vancouver:zoning-development-bylaw-3575:district-schedule-c-2c@2026-05-consolidation";
const R1_1_PACK_ID = "ca-bc-vancouver:zoning-development-bylaw-3575:district-schedule-r1-1@2026-06-consolidation";

function c2cBundle(): E85NormalizedRuleBundle {
  const result = vancouverC2CAdapter.normalize(c2cDocument(), VANCOUVER_C_2C_SOURCE);
  if (result.outcome !== "NORMALIZED") throw new Error(`expected NORMALIZED, got ${result.outcome}`);
  return result.bundle;
}

function r11Bundle(): E85NormalizedRuleBundle {
  const result = vancouverR11Adapter.normalize(r11Document(), VANCOUVER_R1_1_SOURCE);
  if (result.outcome !== "NORMALIZED") throw new Error(`expected NORMALIZED, got ${result.outcome}`);
  return result.bundle;
}

const datasets = () => createE85SpatialDatasetRegistry([vancouverZoningDataset()]);

function normalized(records: Parameters<typeof vancouverSnapshot>[0], legalBundles: readonly E85NormalizedRuleBundle[] = []): E85SpatialNormalizationSuccess {
  const adapter = createVancouverZoningSpatialAdapter(vancouverZoningLinkPolicyFromLegalBundles(legalBundles));
  const registry = createE85SpatialAdapterRegistry([adapter]);
  if (!registry.ok) throw new Error("adapter registry problems");
  const result = normalizeE85SpatialSnapshot(vancouverSnapshot(records), datasets(), registry.registry, { normalizedAt: VANCOUVER_NORMALIZED_AT });
  if (result.outcome !== "NORMALIZED") throw new Error(`expected NORMALIZED, got ${result.reason}`);
  return result;
}

const featureById = (r: E85SpatialNormalizationSuccess, id: string) => r.features.find((f) => f.featureId === id);

describe("E85 Phase 14.4B — C-2C canonical pack identity", () => {
  test("the derived id matches the frozen expected pack id exactly", () => {
    expect(e85RulePackIdFromSource({ sourceId: VANCOUVER_C_2C_SOURCE_ID, sourceVersionId: VANCOUVER_C_2C_VERSION_ID })).toBe(C_2C_PACK_ID);
  });
});

describe("E85 Phase 14.4B — the join keys on zoning_district, exactly as R1-1's does", () => {
  test("VANCOUVER_LINKAGE_SOURCE_FIELD is unchanged by the generalization", () => {
    expect(VANCOUVER_LINKAGE_SOURCE_FIELD).toBe("zoning_district");
  });
});

describe("E85 Phase 14.4B — no bundle supplied leaves C-2C unlinked", () => {
  test("the real C-2C feature keeps its geometry and its RULE_PACK_LINK_UNRESOLVED gap", () => {
    const r = normalized([VAN_C_2C]);
    const f = featureById(r, "494642");
    expect(f?.geometry).toBeDefined();
    expect(f?.rulePackIds).toEqual([]);
    expect(r.findings.some((x) => x.featureId === "494642" && x.code === "RULE_PACK_LINK_UNRESOLVED")).toBe(true);
  });
});

describe("E85 Phase 14.4B — a validated C-2C bundle resolves C-2C, and only C-2C", () => {
  test("the C-2C feature carries the canonical pack id and loses its gap", () => {
    const r = normalized([VAN_C_2C, VAN_R1_1], [c2cBundle()]);
    expect(featureById(r, "494642")?.rulePackIds).toEqual([C_2C_PACK_ID]);
    expect(r.findings.some((x) => x.featureId === "494642" && x.code === "RULE_PACK_LINK_UNRESOLVED")).toBe(false);
  });

  test("R1-1 stays unresolved when only the C-2C bundle is supplied", () => {
    const r = normalized([VAN_C_2C, VAN_R1_1], [c2cBundle()]);
    expect(featureById(r, "494787")?.rulePackIds).toEqual([]);
    expect(r.findings.some((x) => x.featureId === "494787" && x.code === "RULE_PACK_LINK_UNRESOLVED")).toBe(true);
  });

  test("the policy resolves exactly {C-2C: [C_2C_PACK_ID]} — never also R1-1", () => {
    const policy = vancouverZoningLinkPolicyFromLegalBundles([c2cBundle()]);
    expect(policy).toEqual({ "C-2C": [C_2C_PACK_ID] });
  });
});

describe("E85 Phase 14.4B — both districts resolve simultaneously and independently when both bundles are supplied", () => {
  test("R1-1 and C-2C both link, each to its own pack id, on the real geometry for both", () => {
    const r = normalized([VAN_R1_1, VAN_C_2C], [r11Bundle(), c2cBundle()]);
    expect(featureById(r, "494787")?.rulePackIds).toEqual([R1_1_PACK_ID]);
    expect(featureById(r, "494642")?.rulePackIds).toEqual([C_2C_PACK_ID]);
  });

  test("supplying an R1-1 bundle alone never links C-2C, and vice versa", () => {
    const onlyR11 = normalized([VAN_R1_1, VAN_C_2C], [r11Bundle()]);
    expect(featureById(onlyR11, "494642")?.rulePackIds).toEqual([]);

    const onlyC2C = normalized([VAN_R1_1, VAN_C_2C], [c2cBundle()]);
    expect(featureById(onlyC2C, "494787")?.rulePackIds).toEqual([]);
  });
});

describe("E85 Phase 14.4B — the join is exact on every axis for C-2C too", () => {
  test("a bundle from another jurisdiction is rejected", () => {
    const foreign = { ...c2cBundle(), jurisdictionId: "ca-bc-burnaby" };
    expect(vancouverZoningLinkPolicyFromLegalBundles([foreign])).toEqual({});
    expect(auditVancouverLegalLinkage([foreign]).rejected[0]!.reason).toBe("JURISDICTION_MISMATCH");
  });

  test("a bundle from an entirely unregistered source is rejected as not a registered district schedule", () => {
    const wrongSource = { ...c2cBundle(), sourceId: "ca-bc-vancouver:parking-bylaw-6059" };
    expect(vancouverZoningLinkPolicyFromLegalBundles([wrongSource])).toEqual({});
    expect(auditVancouverLegalLinkage([wrongSource]).rejected[0]!.reason).toBe("SOURCE_NOT_REGISTERED_DISTRICT_SCHEDULE");
  });

  test("a bundle claiming the C-2C zone but carrying R1-1's own source id is rejected as a version mismatch against the R1-1 entry it DOES match on source", () => {
    // sourceId alone matches the registered R1-1 entry; the version does not
    // (this bundle's version is C-2C's "2026-05-consolidation"), so the most
    // specific and honest reason is VERSION_NOT_VERIFIED against that entry —
    // not a generic "source not registered", since the source genuinely IS
    // R1-1's registered source.
    const wrongSource = { ...c2cBundle(), sourceId: VANCOUVER_R1_1_SOURCE_ID };
    expect(vancouverZoningLinkPolicyFromLegalBundles([wrongSource])).toEqual({});
    expect(auditVancouverLegalLinkage([wrongSource]).rejected[0]!.reason).toBe("VERSION_NOT_VERIFIED");
  });

  test("a bundle from an unverified consolidation is rejected", () => {
    const stale = { ...c2cBundle(), sourceVersionId: "2019-01-consolidation" };
    expect(vancouverZoningLinkPolicyFromLegalBundles([stale])).toEqual({});
    expect(auditVancouverLegalLinkage([stale]).rejected[0]!.reason).toBe("VERSION_NOT_VERIFIED");
  });

  test("a bundle for another zone is rejected", () => {
    const otherZone = { ...c2cBundle(), zoneDesignation: "C-2C1" };
    expect(vancouverZoningLinkPolicyFromLegalBundles([otherZone])).toEqual({});
    expect(auditVancouverLegalLinkage([otherZone]).rejected[0]!.reason).toBe("ZONE_NOT_REGISTERED");
  });

  test("no fuzzy matching: C-2, C-2C1 and c-2c resolve nothing for the C-2C entry", () => {
    const policy = vancouverZoningLinkPolicyFromLegalBundles([c2cBundle()]);
    for (const near of ["C-2", "C-2C1", "c-2c", "C2C"]) expect(policy[near]).toBeUndefined();
  });

  test("the same C-2C instrument supplied twice yields one pack id, not two", () => {
    expect(vancouverZoningLinkPolicyFromLegalBundles([c2cBundle(), c2cBundle()])["C-2C"]).toEqual([C_2C_PACK_ID]);
  });
});

describe("E85 Phase 14.4B — quarantine survives for C-2C too", () => {
  test("a geometrically broken C-2C-labelled record is quarantined and carries no rule pack, while the healthy 494642 still links", () => {
    const broken = { ...VAN_C_2C, rawFeatureId: "494999", rawAttributes: { ...VAN_C_2C.rawAttributes, object_id: "494999" }, rawGeometry: { type: "Polygon" as const, coordinates: [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]], [[0, 0], [10, 20], [20, 10], [0, 0]]] } };
    const r = normalized([VAN_C_2C, broken], [c2cBundle()]);
    expect(r.quarantined.map((q) => q.featureId)).toContain("494999");
    expect(featureById(r, "494999")).toBeUndefined();
    expect(featureById(r, "494642")?.rulePackIds).toEqual([C_2C_PACK_ID]);
  });
});

describe("E85 Phase 14.4B — determinism", () => {
  test("record order does not change the linked output across both districts", () => {
    const forward = normalized([VAN_R1_1, VAN_C_2C], [r11Bundle(), c2cBundle()]);
    const reversed = normalized([VAN_C_2C, VAN_R1_1], [c2cBundle(), r11Bundle()]);
    expect(JSON.stringify(forward.features)).toBe(JSON.stringify(reversed.features));
  });
});

/**
 * InvestScape™ E85 — C-2C §2.2.1 enclosed-building gate: the compound
 * condition id versus the proposed separate assertion ids.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Uses the same hermetic C-2C fixture and real-feature spatial path as
 * phase14-c-2c-e2e.test.ts. It pins three things:
 *   1. only the enclosure-only id releases the six uses; the retired compound
 *      id releases nothing even if affirmed;
 *   2. exception and variance ids release nothing, so a claimed variance (or
 *      exception) can never stand in for a proven approval;
 *   3. the proposal is well-formed: distinct ids, distinct evidence, and only
 *      actual enclosure may ever rest on a caller assertion.
 */
import {
  assembleE85DecisionPackage,
  canonicalRulePackFromBundle,
  createE85SpatialAdapterRegistry,
  createE85SpatialDatasetRegistry,
  normalizeE85SpatialSnapshot,
  adapters,
  E85DecisionPackage,
  E85NormalizedRuleBundle,
  E85ParcelReference,
} from "../../src/zoning-land-use-engine";
import { createVancouverZoningSpatialAdapter, vancouverZoningDataset, vancouverZoningLinkPolicyFromLegalBundles } from "../../src/zoning-land-use-engine/adapters/spatial/vancouver";
import { SYNTHETIC_PARCEL_IN_C_2C, VANCOUVER_NORMALIZED_AT, VANCOUVER_RESOLVED_AT, VAN_C_2C, vancouverSnapshot } from "./fixtures/vancouver-spatial-snapshot";
import { c2cDocument, C_2C_ENCLOSED_BUILDING_ASSERTION_PROPOSALS, C_2C_ENCLOSED_BUILDING_CONDITION, C_2C_FACTS, C_2C_LEGACY_COMPOUND_ENCLOSED_BUILDING_CONDITION } from "./fixtures/vancouver-c-2c-facts";

const { vancouverC2CAdapter, VANCOUVER_C_2C_SOURCE, VANCOUVER_JURISDICTION_ID } = adapters.vancouver;
const ENCLOSURE = "vancouver_c_2c_use_wholly_within_completely_enclosed_building";
const VARIANCE = "vancouver_c_2c_2_2_1_director_variance_granted";
const EXCEPTION_A = "vancouver_c_2c_2_2_1_exception_limb_a";

function c2cBundle(): E85NormalizedRuleBundle {
  const result = vancouverC2CAdapter.normalize(c2cDocument(), VANCOUVER_C_2C_SOURCE);
  if (result.outcome !== "NORMALIZED") throw new Error(`expected NORMALIZED, got ${result.outcome}`);
  return result.bundle;
}

function decide(conditions: { satisfied?: string[]; unsatisfied?: string[] }): E85DecisionPackage {
  const legal = [c2cBundle()];
  const parcel = SYNTHETIC_PARCEL_IN_C_2C();
  const registry = createE85SpatialAdapterRegistry([createVancouverZoningSpatialAdapter(vancouverZoningLinkPolicyFromLegalBundles(legal))]);
  if (!registry.ok) throw new Error("adapter registry problems");
  const datasets = () => createE85SpatialDatasetRegistry([vancouverZoningDataset()]);
  const parcelRef: E85ParcelReference = {
    parcelReferenceId: parcel.parcelReferenceId,
    jurisdiction: { jurisdictionId: VANCOUVER_JURISDICTION_ID, country: "CA", regionCode: "BC", municipality: "Vancouver", regulatoryAuthority: "City of Vancouver", displayName: "City of Vancouver, BC, Canada" },
    rawZoningDesignation: "C-2C",
    siteAreaSqm: 500,
  };
  return assembleE85DecisionPackage({
    decisionId: "c-2c-enclosed-building-assertions",
    normalization: normalizeE85SpatialSnapshot(vancouverSnapshot([VAN_C_2C]), datasets(), registry.registry, { normalizedAt: VANCOUVER_NORMALIZED_AT }),
    parcelSpatial: parcel,
    parcel: parcelRef,
    jurisdictionId: VANCOUVER_JURISDICTION_ID,
    zoneDesignation: "C-2C",
    useCode: "barber_shop_or_beauty_salon",
    asOfDate: "2026-09-19",
    requestedAnalyses: ["USE", "DIMENSIONAL"],
    policyVersion: { policyVersionId: "c-2c-assertions-v1", effectiveFrom: "2020-01-01", concepts: {} },
    availableRulePacks: legal.map((b) => canonicalRulePackFromBundle(b, "BASE")),
    spatialRegistry: datasets(),
    resolvedAt: VANCOUVER_RESOLVED_AT,
    composedAt: "2026-09-19T00:00:00.000Z",
    assembledAt: "2026-09-19T00:00:00.000Z",
    callerContext: {
      ...(conditions.satisfied === undefined ? {} : { satisfiedConditions: conditions.satisfied }),
      ...(conditions.unsatisfied === undefined ? {} : { unsatisfiedConditions: conditions.unsatisfied }),
    },
  });
}
const useStatus = (p: E85DecisionPackage) => p.phase4?.usePermission?.status;

const USE_FACT_IDS = C_2C_FACTS.filter((f) => f.family === "USE").map((f) => f.factId);
const LEGACY = C_2C_LEGACY_COMPOUND_ENCLOSED_BUILDING_CONDITION;

describe("C-2C §2.2.1 active gate: enclosure-only id", () => {
  test("the enclosure-only id IS the active gate constant", () => {
    expect(C_2C_ENCLOSED_BUILDING_CONDITION).toBe(ENCLOSURE);
    expect(USE_FACT_IDS).toHaveLength(6);
  });

  test("regression: affirming ONLY the retired compound id yields no permission value", () => {
    const p = decide({ satisfied: [LEGACY] });
    expect(useStatus(p)).not.toBe("PERMITTED");
    expect(useStatus(p)).not.toBe("PROHIBITED");
  });

  test("regression: affirming ONLY the enclosure-only id yields a caller-asserted PERMITTED", () => {
    const p = decide({ satisfied: [ENCLOSURE] });
    expect(useStatus(p)).toBe("PERMITTED");
    expect(JSON.stringify(p.phase4?.usePermission)).toContain(ENCLOSURE);
  });

  test("unknown: nothing affirmed is neither PERMITTED nor PROHIBITED", () => {
    const s = useStatus(decide({}));
    expect(s).not.toBe("PERMITTED");
    expect(s).not.toBe("PROHIBITED");
  });

  test.each([
    ["the retired compound id", [LEGACY]],
    ["the enclosure-only id", [ENCLOSURE]],
  ])("denial of %s withholds permission and never converts to PROHIBITED", (_label, ids) => {
    const s = useStatus(decide({ unsatisfied: ids }));
    expect(s).not.toBe("PERMITTED");
    expect(s).not.toBe("PROHIBITED");
  });

  test.each([
    ["a claimed variance", [VARIANCE]],
    ["a claimed exception limb", [EXCEPTION_A]],
    ["variance + exception + retired compound id", [VARIANCE, EXCEPTION_A, LEGACY]],
  ])("%s does not release the use", (_label, ids) => {
    const s = useStatus(decide({ satisfied: ids }));
    expect(s).not.toBe("PERMITTED");
    expect(s).not.toBe("PROHIBITED");
  });

  test("every one of the six use facts is gated on the enclosure-only id and nothing else", () => {
    const nonReleasing = new Set(C_2C_ENCLOSED_BUILDING_ASSERTION_PROPOSALS.map((p) => p.id).filter((id) => id !== ENCLOSURE));
    for (const fact of C_2C_FACTS) {
      for (const id of fact.applicability?.conditionIds ?? []) {
        expect(nonReleasing.has(id)).toBe(false);
        expect(id).not.toBe(LEGACY);
      }
      if (fact.family === "USE") expect(fact.applicability?.conditionIds).toEqual([ENCLOSURE]);
    }
  });
});

describe("C-2C §2.2.1 assertion proposal is well-formed", () => {
  const P = C_2C_ENCLOSED_BUILDING_ASSERTION_PROPOSALS;

  test("ids are distinct, snake_case, and never reuse the compound id", () => {
    const ids = P.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^vancouver_c_2c_[a-z0-9_]+$/);
      expect(id).not.toBe(LEGACY);
    }
    expect(ids).toEqual(expect.arrayContaining([ENCLOSURE, VARIANCE, EXCEPTION_A, "vancouver_c_2c_2_2_1_exception_limb_m"]));
    expect(ids.filter((id) => id.includes("_exception_limb_"))).toHaveLength(13);
  });

  test("evidence requirements are distinct per kind", () => {
    const kinds = [ENCLOSURE, EXCEPTION_A, VARIANCE].map((id) => P.find((p) => p.id === id)?.evidenceRequired);
    expect(new Set(kinds).size).toBe(3);
  });

  test("only actual enclosure may rest on a caller assertion; a variance needs a verified City decision record", () => {
    expect(P.filter((p) => p.callerAssertionMaySuffice).map((p) => p.id)).toEqual([ENCLOSURE]);
    const variance = P.find((p) => p.id === VARIANCE);
    expect(variance?.callerAssertionMaySuffice).toBe(false);
    expect(variance?.evidenceRequired).toMatch(/verified City decision record/);
    expect(variance?.evidenceRequired).toMatch(/claim that a variance exists is not this evidence/);
  });
});

/**
 * InvestScape™ E85 Phase 7 — end-to-end: spatial applicability → composition →
 * evaluation.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Three layers, three questions, and the point of this suite is that each one
 * answers only its own:
 *
 *   Phase 7  WHICH instruments are in play here?      (geometry)
 *   Phase 6  HOW do those instruments interact?       (stated precedence)
 *   Phase 4  WHAT do the resulting rules permit?      (evaluation)
 *
 * The orchestration — turning applicable pack IDS into actual rule packs —
 * happens HERE, in the test, and deliberately not inside either layer. Phase 7
 * does not import Phase 6, so a spatial layer can never reach into precedence;
 * Phase 6 does not import Phase 7, so composition stays usable with packs that
 * arrived from anywhere. Both directions are enforced by scope-protection.
 *
 * Offline throughout: synthetic coordinates, no network, no GIS, no PDF.
 */
import {
  resolveE85SpatialApplicability,
  createE85SpatialDatasetRegistry,
  composeE85RulePacks,
  evaluateZoningAndLandUse,
  traceE85RulePackToFeatures,
  E85ComposedRulePack,
  E85EvaluationRequest,
  E85ParcelReference,
  E85PolicyVersion,
  E85RegulatorySpatialFeature,
  E85RulePack,
  E85SpatialApplicabilityResult,
} from "../../src/zoning-land-use-engine";
import { FEATURE_A, FEATURE_B, FEATURE_OVERLAY, JURISDICTION, PARCEL_IN_A_AND_OVERLAY, PARCEL_SPLIT, RESOLVED_AT, STANDARD_DATASETS } from "./fixtures/spatial-features";
import { pack, COMPOSED_AT, ZONE } from "./fixtures/composition-packs";

const SITE_AREA_SQM = 500;

/**
 * The rule packs E85 holds, keyed by the identity a spatial feature activates.
 * In production this is a registry lookup; here it is a literal map, which is
 * the point — the spatial layer emits identities, and something else resolves
 * them to rules.
 */
function packLibrary(): Record<string, E85RulePack> {
  return {
    "base-a": pack({ packId: "base-a", role: "BASE", usePermitted: "dwelling", maxFsr: 1.0, maxHeightMetres: 12 }),
    "base-b": pack({ packId: "base-b", role: "BASE", usePermitted: "dwelling", maxFsr: 2.5, maxHeightMetres: 20 }),
    "overlay-x": pack({ packId: "overlay-x", role: "OVERLAY", frontSetback: 5 }),
  };
}

/** Phase 7 → Phase 6 handoff: identities in, rule packs out. */
function resolvePacks(result: E85SpatialApplicabilityResult): readonly E85RulePack[] {
  const library = packLibrary();
  return result.applicableRulePackIds.map((id) => library[id]).filter((p): p is E85RulePack => p !== undefined);
}

function spatial(features: readonly E85RegulatorySpatialFeature[], parcelRef = PARCEL_IN_A_AND_OVERLAY()): E85SpatialApplicabilityResult {
  return resolveE85SpatialApplicability({
    parcel: parcelRef,
    features,
    registry: createE85SpatialDatasetRegistry(STANDARD_DATASETS()),
    resolvedAt: RESOLVED_AT,
  });
}

function compose(packs: readonly E85RulePack[]): E85ComposedRulePack {
  const result = composeE85RulePacks(packs, { composedAt: COMPOSED_AT });
  if (result.outcome !== "COMPOSED") throw new Error(`expected COMPOSED, got ${result.outcome}`);
  return result.composed;
}

function parcel(): E85ParcelReference {
  return {
    parcelReferenceId: "parcel-1",
    jurisdiction: {
      jurisdictionId: JURISDICTION,
      country: "XX",
      regionCode: "YY",
      municipality: "Testburgh",
      regulatoryAuthority: "Testburgh Planning Office",
      displayName: "Testburgh, YY, XX",
    },
    rawZoningDesignation: ZONE,
    siteAreaSqm: SITE_AREA_SQM,
  };
}

function policy(): E85PolicyVersion {
  return { policyVersionId: "phase7-v1", effectiveFrom: "2020-01-01", concepts: {} };
}

function evaluate(composed: E85ComposedRulePack, overrides: Partial<E85EvaluationRequest> = {}) {
  return evaluateZoningAndLandUse({
    parcel: parcel(),
    jurisdictionId: JURISDICTION,
    zoneDesignation: ZONE,
    useCode: "dwelling",
    asOfDate: "2026-09-01",
    rules: composed.effectiveRules,
    requestedAnalyses: ["USE", "DENSITY", "DIMENSIONAL"],
    policyVersion: policy(),
    ...overrides,
  });
}

/** Phase 4 stamps `resolvedAt` from the wall clock, so that one field is normalized away before comparison. */
function withoutClock(outcome: unknown): string {
  return JSON.stringify(outcome).replace(/"resolvedAt":"[^"]*"/g, '"resolvedAt":"<clock>"');
}

describe("E85 Phase 7 end-to-end — geometry selects, composition reconciles, evaluation answers", () => {
  const features = () => [FEATURE_A(), FEATURE_B(), FEATURE_OVERLAY()];

  test("the spatial layer selects exactly the base zone and overlay covering the parcel", () => {
    const result = spatial(features());
    expect(result.applicableRulePackIds).toEqual(["base-a", "overlay-x"]);
    // Zone B was checked and does not reach this parcel.
    expect(result.hits.find((h) => h.featureId === "zone-b")?.applicability).toBe("DOES_NOT_APPLY");
  });

  test("the selected packs compose and evaluate into one regulatory envelope", () => {
    const outcome = evaluate(compose(resolvePacks(spatial(features()))));
    expect(["MACHINE_RESOLVED", "MACHINE_RESOLVED_WITH_WARNINGS"]).toContain(outcome.result.status);
    expect(outcome.usePermission?.status).toBe("PERMITTED");
  });

  test("the envelope draws each value from the instrument the geometry selected", () => {
    const outcome = evaluate(compose(resolvePacks(spatial(features()))));
    const envelope = ("envelope" in outcome.result ? outcome.result.envelope : undefined)?.envelope;
    expect(outcome.resolvedMaxFsr?.value).toBe(1.0);
    expect(envelope?.maxRegulatoryGfaSqm?.value).toBe(1.0 * SITE_AREA_SQM);
    expect(envelope?.maxHeightMetres?.value).toBe(12);
    // The setback comes from the overlay, which only the spatial layer brought in.
    expect(envelope?.setbacksMetres?.front?.value).toBe(5);
    // Zone B's figures never appear: its polygon does not reach this parcel.
    expect(outcome.resolvedMaxFsr?.value).not.toBe(2.5);
    expect(envelope?.maxHeightMetres?.value).not.toBe(20);
  });

  test("reversing the spatial feature order changes nothing downstream", () => {
    const forward = evaluate(compose(resolvePacks(spatial(features()))));
    const reversed = evaluate(compose(resolvePacks(spatial([...features()].reverse()))));
    expect(withoutClock(reversed)).toBe(withoutClock(forward));
  });

  test("every permutation of the spatial features yields one identical envelope", () => {
    const [f1, f2, f3] = features();
    const permutations = [
      [f1, f2, f3],
      [f1, f3, f2],
      [f2, f1, f3],
      [f2, f3, f1],
      [f3, f1, f2],
      [f3, f2, f1],
    ];
    const envelopes = permutations.map((p) => {
      const outcome = evaluate(compose(resolvePacks(spatial(p))));
      return JSON.stringify(("envelope" in outcome.result ? outcome.result.envelope : undefined)?.envelope);
    });
    expect(new Set(envelopes).size).toBe(1);
  });

  test("a final regulatory number traces back to the exact polygon that put its instrument in play", () => {
    const result = spatial(features());
    const composed = compose(resolvePacks(result));
    const outcome = evaluate(composed);
    const envelope = ("envelope" in outcome.result ? outcome.result.envelope : undefined)?.envelope;

    // Rule value → pack → spatial feature → dataset release.
    const packId = "base-a";
    expect(envelope?.maxHeightMetres?.provenance.sourceId).toBe(`${JURISDICTION}:instrument-${packId}`);
    const activating = traceE85RulePackToFeatures(result, packId);
    expect(activating).toHaveLength(1);
    expect(activating[0].featureId).toBe("zone-a");
    expect(activating[0].spatialProvenance.datasetId).toBe(`${JURISDICTION}:zoning-districts`);
    expect(activating[0].spatialProvenance.datasetVersionId).toBe("2026-06");
    expect(activating[0].relation).toBe("CONTAINS");
  });
});

describe("E85 Phase 7 end-to-end — no layer does another layer's job", () => {
  test("spatial output carries no rule content", () => {
    const serialized = JSON.stringify(spatial([FEATURE_A(), FEATURE_OVERLAY()]));
    for (const ruleField of ["maxFsr", "maxHeightMetres", "setbacksMetres", "permissions", "minSpacesPerUse"]) {
      expect(serialized).not.toContain(ruleField);
    }
  });

  test("composed output carries no geometry", () => {
    const composed = compose(resolvePacks(spatial([FEATURE_A(), FEATURE_OVERLAY()])));
    const serialized = JSON.stringify(composed);
    for (const spatialField of ["exterior", "coordinates", "crsId", "POLYGON", "featureClass", "relation"]) {
      expect(serialized).not.toContain(spatialField);
    }
  });

  test("the evaluator receives an ordinary rule array and learns nothing of either upstream layer", () => {
    const composed = compose(resolvePacks(spatial([FEATURE_A(), FEATURE_OVERLAY()])));
    const serialized = JSON.stringify(composed.effectiveRules);
    for (const leak of ["packId", "conceptKey", "suppressed", "featureId", "datasetId", "geometry", "applicability"]) {
      expect(serialized).not.toContain(leak);
    }
    expect(() => evaluate(composed)).not.toThrow();
  });

  test("geometry never decides precedence: both instruments arrive unranked and composition is what reconciles them", () => {
    const result = spatial([FEATURE_A(), FEATURE_OVERLAY()]);
    // Phase 7 hands over two equals.
    expect(result.applicableRulePackIds).toEqual(["base-a", "overlay-x"]);
    const composed = compose(resolvePacks(result));
    // They regulate different concepts, so composition combines them with no
    // suppression and no conflict — a decision made on the rules, not the map.
    expect(composed.status).toBe("COMPOSED");
    expect(composed.suppressed).toEqual([]);
    expect(composed.unresolvedConflicts).toEqual([]);
  });
});

describe("E85 Phase 7 end-to-end — a spatially ambiguous parcel does not silently become a clean answer", () => {
  const split = () => spatial([FEATURE_A(), FEATURE_B()], PARCEL_SPLIT());

  test("the spatial layer withholds both packs rather than picking one", () => {
    const result = split();
    expect(result.applicableRulePackIds).toEqual([]);
    expect(result.ambiguousRulePackIds).toEqual(["base-a", "base-b"]);
    expect(result.status).toBe("MANUAL_REVIEW_REQUIRED");
  });

  test("nothing reaches composition, so no envelope is produced from a contested location", () => {
    const packs = resolvePacks(split());
    expect(packs).toEqual([]);
  });

  test("the ambiguity is legible at the spatial layer rather than surfacing as a mysterious absence downstream", () => {
    const result = split();
    // A caller who composed `ambiguousRulePackIds` anyway would be resolving, by
    // the act of passing them on, the question Phase 7 declined to answer — so
    // the reason is stated here, at the layer that knows it.
    expect(result.manualReview[0].reasonCode).toBe("AMBIGUOUS_PARCEL_ZONE_MATCH");
    expect(result.findings.some((f) => f.code === "MULTIPLE_BASE_ZONES")).toBe(true);
    expect(result.parcelMatch).toBe("low");
  });

  test("had both packs been composed regardless, the conflict would still not resolve itself", () => {
    // Proof the safety is layered rather than resting on Phase 7 alone: even if
    // a caller ignores the ambiguity, Phase 6 finds two authorities disagreeing
    // on height and FSR and refuses to choose between them as well.
    const library = packLibrary();
    const composed = compose([library["base-a"], library["base-b"]]);
    expect(composed.status).toBe("COMPOSED_WITH_UNRESOLVED_CONFLICTS");
    expect(composed.unresolvedConflicts.length).toBeGreaterThan(0);
  });
});

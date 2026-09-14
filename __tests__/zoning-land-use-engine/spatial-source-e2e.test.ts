/**
 * InvestScape™ E85 Phase 8 — end-to-end: raw snapshot → adapter → applicability
 * → composition → evaluation.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Four layers, four questions, and the point of this suite is that each answers
 * only its own:
 *
 *   Phase 8  WHAT does this authoritative layer actually contain?  (source)
 *   Phase 7  WHICH of those instruments reach this parcel?         (geometry)
 *   Phase 6  HOW do the reaching instruments interact?             (precedence)
 *   Phase 4  WHAT do the resulting rules permit?                   (evaluation)
 *
 * The orchestration — turning applicable pack ids into actual rule packs —
 * happens HERE, in the test, and deliberately inside no layer. Phase 7 does not
 * import Phase 8; Phase 6 does not import Phase 7; Phase 4 knows of neither.
 * Every one of those directions is enforced by scope-protection.
 *
 * Offline throughout: an invented publisher, synthetic coordinates, no network,
 * no GIS library, no file read.
 */
import {
  composeE85RulePacks,
  createE85SpatialAdapterRegistry,
  createE85SpatialDatasetRegistry,
  evaluateZoningAndLandUse,
  hasBlockingSpatialSourceFinding,
  normalizeE85SpatialSnapshot,
  resolveE85SpatialApplicability,
  traceE85RulePackToFeatures,
  E85ComposedRulePack,
  E85EvaluationRequest,
  E85ParcelReference,
  E85ParcelSpatialReference,
  E85PolicyVersion,
  E85RawSpatialSourceSnapshot,
  E85RegulatorySpatialFeature,
  E85RulePack,
  E85SpatialApplicabilityResult,
  E85SpatialNormalizationSuccess,
} from "../../src/zoning-land-use-engine";
import { referenceZoningDataset, referenceZoningSpatialAdapter } from "../../src/zoning-land-use-engine/adapters/spatial/reference";
import {
  NORMALIZED_AT,
  PARCEL_IN_RB_A_AND_OVERLAY,
  PARCEL_IN_UNMAPPED_RB_C,
  RECORD_A,
  RECORD_B,
  RECORD_BOWTIE,
  RECORD_OVERLAY,
  RECORD_UNMAPPED_ZONE,
  REFERENCE_DATASET_ID,
  REFERENCE_JURISDICTION,
  REFERENCE_RELEASE,
  STANDARD_SNAPSHOT,
  snapshot,
} from "./fixtures/spatial-snapshots";
import { pack, COMPOSED_AT, ZONE, JURISDICTION as PACK_JURISDICTION } from "./fixtures/composition-packs";

const SITE_AREA_SQM = 500;
const RESOLVED_AT = "2026-02-12T00:00:00.000Z";

/**
 * Two jurisdictions appear in this file, and the distinction is the point.
 *
 * `REFERENCE_JURISDICTION` is whose LAYER Phase 8 is reading. `PACK_JURISDICTION`
 * is whose INSTRUMENTS the shared composition fixture stamps on its rule packs.
 * In production they would be the same place; here they differ because the pack
 * library is borrowed from the Phase 6 fixture, and that they can differ at all
 * is itself the architecture working: the only thing joining a spatial feature
 * to a rule pack is a pack IDENTITY. Phase 7 hands over identities, never
 * jurisdictions, so Phase 4 is driven by whatever the packs themselves declare.
 */

/**
 * The rule packs E85 holds, keyed by the identity a spatial feature activates.
 * In production this is a registry lookup; here it is a literal map, which is
 * the point — Phase 8 emits identities read from a source's own policy, and
 * something else resolves them to rules.
 */
function packLibrary(): Record<string, E85RulePack> {
  return {
    "refburgh-rb-1": pack({ packId: "refburgh-rb-1", role: "BASE", usePermitted: "dwelling", maxFsr: 1.5, maxHeightMetres: 14 }),
    "refburgh-rb-2": pack({ packId: "refburgh-rb-2", role: "BASE", usePermitted: "dwelling", maxFsr: 3.0, maxHeightMetres: 26 }),
    "refburgh-dp-overlay": pack({ packId: "refburgh-dp-overlay", role: "OVERLAY", frontSetback: 6 }),
  };
}

/**
 * Phase 8, with the WHOLE result kept.
 *
 * `normalized()` below drops everything but the features, which is honest about
 * what Phase 7 consumes and is exactly wrong for a linkage-safety test: the
 * signal those tests are about lives in `findings` and `readiness`, so a helper
 * that discards them would quietly assume away the thing being proven. The
 * linkage suites therefore call this one. Test-only; no production helper
 * changed shape to accommodate it.
 */
function normalizeFull(snap: E85RawSpatialSourceSnapshot = STANDARD_SNAPSHOT()): E85SpatialNormalizationSuccess {
  const registry = createE85SpatialAdapterRegistry([referenceZoningSpatialAdapter]);
  if (!registry.ok) throw new Error("adapter registry problems");
  const result = normalizeE85SpatialSnapshot(snap, createE85SpatialDatasetRegistry([referenceZoningDataset()]), registry.registry, { normalizedAt: NORMALIZED_AT });
  if (result.outcome !== "NORMALIZED") throw new Error(`expected NORMALIZED, got ${result.reason}`);
  return result;
}

/** Phase 8 -> Phase 7: raw records in, normalized regulatory features out. */
function normalized(snap: E85RawSpatialSourceSnapshot = STANDARD_SNAPSHOT()): readonly E85RegulatorySpatialFeature[] {
  return normalizeFull(snap).features;
}

/** Phase 7: which of those features reach the parcel. */
function spatial(features: readonly E85RegulatorySpatialFeature[], parcel: E85ParcelSpatialReference = PARCEL_IN_RB_A_AND_OVERLAY()): E85SpatialApplicabilityResult {
  return resolveE85SpatialApplicability({
    parcel,
    features,
    registry: createE85SpatialDatasetRegistry([referenceZoningDataset()]),
    resolvedAt: RESOLVED_AT,
  });
}

/** Phase 7 → Phase 6 handoff: identities in, rule packs out. */
function resolvePacks(result: E85SpatialApplicabilityResult): readonly E85RulePack[] {
  const library = packLibrary();
  return result.applicableRulePackIds.map((id) => library[id]).filter((p): p is E85RulePack => p !== undefined);
}

function compose(packs: readonly E85RulePack[]): E85ComposedRulePack {
  const result = composeE85RulePacks(packs, { composedAt: COMPOSED_AT });
  if (result.outcome !== "COMPOSED") throw new Error(`expected COMPOSED, got ${result.outcome}`);
  return result.composed;
}

function parcel(): E85ParcelReference {
  return {
    parcelReferenceId: "refburgh-parcel-1",
    jurisdiction: {
      jurisdictionId: PACK_JURISDICTION,
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
  return { policyVersionId: "phase8-v1", effectiveFrom: "2020-01-01", concepts: {} };
}

function evaluate(composed: E85ComposedRulePack, overrides: Partial<E85EvaluationRequest> = {}) {
  return evaluateZoningAndLandUse({
    parcel: parcel(),
    jurisdictionId: PACK_JURISDICTION,
    zoneDesignation: ZONE,
    useCode: "dwelling",
    asOfDate: "2026-02-12",
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

describe("E85 Phase 8 end-to-end — a source becomes a regulatory answer", () => {
  test("the adapter turns raw records into features Phase 7 accepts unchanged", () => {
    const features = normalized();
    expect(features.map((f) => f.featureId)).toEqual(["dp-1", "zone-a", "zone-b"]);
    // Phase 7 is handed exactly what the adapter produced — no fixing-up here.
    expect(spatial(features).hits).toHaveLength(3);
  });

  test("geometry selects the base zone and overlay covering the parcel", () => {
    const result = spatial(normalized());
    expect(result.applicableRulePackIds).toEqual(["refburgh-dp-overlay", "refburgh-rb-1"]);
    // Zone B was read from the same layer, checked, and does not reach here.
    expect(result.hits.find((h) => h.featureId === "zone-b")?.applicability).toBe("DOES_NOT_APPLY");
  });

  test("the selected packs compose and evaluate into one regulatory envelope", () => {
    const outcome = evaluate(compose(resolvePacks(spatial(normalized()))));
    expect(["MACHINE_RESOLVED", "MACHINE_RESOLVED_WITH_WARNINGS"]).toContain(outcome.result.status);
    expect(outcome.usePermission?.status).toBe("PERMITTED");
  });

  test("each value traces to the instrument the source named and the geometry selected", () => {
    const outcome = evaluate(compose(resolvePacks(spatial(normalized()))));
    const envelope = ("envelope" in outcome.result ? outcome.result.envelope : undefined)?.envelope;
    expect(outcome.resolvedMaxFsr?.value).toBe(1.5);
    expect(envelope?.maxHeightMetres?.value).toBe(14);
    // The setback comes from the overlay, which only the spatial layer brought in.
    expect(envelope?.setbacksMetres?.front?.value).toBe(6);
    // Zone B's figures never appear: its polygon does not reach this parcel.
    expect(outcome.resolvedMaxFsr?.value).not.toBe(3.0);
    expect(envelope?.maxHeightMetres?.value).not.toBe(26);
  });

  test("a final number traces all the way back to a raw source record", () => {
    // The chain Phase 8 exists to make followable:
    // rule value → pack → spatial feature → dataset release → adapter.
    const features = normalized();
    const result = spatial(features);
    const activating = traceE85RulePackToFeatures(result, "refburgh-rb-1");
    expect(activating).toHaveLength(1);
    expect(activating[0].featureId).toBe("zone-a");
    expect(activating[0].spatialProvenance.datasetId).toBe(REFERENCE_DATASET_ID);
    expect(activating[0].spatialProvenance.datasetVersionId).toBe(REFERENCE_RELEASE);
    expect(activating[0].spatialProvenance.adapterId).toBe("xx-yy-refburgh.zoning-districts.geojson");
    expect(activating[0].spatialProvenance.adapterVersion).toBe("1.0.0");
  });

  test("reversing the raw record order changes nothing downstream", () => {
    const forward = evaluate(compose(resolvePacks(spatial(normalized(snapshot({ records: [RECORD_A(), RECORD_B(), RECORD_OVERLAY()] }))))));
    const reversed = evaluate(compose(resolvePacks(spatial(normalized(snapshot({ records: [RECORD_OVERLAY(), RECORD_B(), RECORD_A()] }))))));
    expect(withoutClock(reversed)).toBe(withoutClock(forward));
  });

  test("every permutation of the raw records yields one identical envelope", () => {
    const [a, b, c] = [RECORD_A(), RECORD_B(), RECORD_OVERLAY()];
    const permutations = [
      [a, b, c],
      [a, c, b],
      [b, a, c],
      [b, c, a],
      [c, a, b],
      [c, b, a],
    ];
    const envelopes = permutations.map((records) => {
      const outcome = evaluate(compose(resolvePacks(spatial(normalized(snapshot({ records }))))));
      return JSON.stringify(("envelope" in outcome.result ? outcome.result.envelope : undefined)?.envelope);
    });
    expect(new Set(envelopes).size).toBe(1);
  });
});

describe("E85 Phase 8 end-to-end — a malformed sibling does not sink the layer", () => {
  const mixed = () => snapshot({ records: [RECORD_A(), RECORD_BOWTIE(), RECORD_OVERLAY()] });

  test("the valid records continue through the whole pipeline", () => {
    const outcome = evaluate(compose(resolvePacks(spatial(normalized(mixed())))));
    expect(["MACHINE_RESOLVED", "MACHINE_RESOLVED_WITH_WARNINGS"]).toContain(outcome.result.status);
    expect(outcome.resolvedMaxFsr?.value).toBe(1.5);
  });

  test("the malformed record never reaches Phase 7 at all", () => {
    const features = normalized(mixed());
    expect(features.map((f) => f.featureId)).toEqual(["dp-1", "zone-a"]);
    expect(features.some((f) => f.featureId === "zone-bad")).toBe(false);
  });

  test("the malformed record contributes no rule-pack applicability", () => {
    const result = spatial(normalized(mixed()));
    expect(result.hits.some((h) => h.featureId === "zone-bad")).toBe(false);
    expect(result.applicableRulePackIds).toEqual(["refburgh-dp-overlay", "refburgh-rb-1"]);
  });

  test("the valid siblings produce exactly the answer they would have without the bad record", () => {
    // The property that matters for a real municipal layer: one tangled polygon
    // out of many changes nothing about the rest.
    const withBad = evaluate(compose(resolvePacks(spatial(normalized(mixed())))));
    const withoutBad = evaluate(compose(resolvePacks(spatial(normalized(snapshot({ records: [RECORD_A(), RECORD_OVERLAY()] }))))));
    expect(withoutClock(withBad)).toBe(withoutClock(withoutBad));
  });
});

describe("E85 Phase 8 end-to-end — no layer does another layer's job", () => {
  test("normalized features carry no rule content", () => {
    const serialized = JSON.stringify(normalized());
    for (const ruleField of ["maxFsr", "maxHeightMetres", "setbacksMetres", "permissions", "minSpacesPerUse"]) {
      expect(serialized).not.toContain(ruleField);
    }
  });

  test("spatial output carries no raw source vocabulary", () => {
    // Phase 7 never learns this publisher's schema; Phase 8 translated it away.
    const serialized = JSON.stringify(spatial(normalized()));
    for (const sourceField of ["ZONE_CD", "LYR_KIND", "OBJECT_REF", "FEATURE_REF", "rawAttributes", "rawGeometry"]) {
      expect(serialized).not.toContain(sourceField);
    }
  });

  test("composed output carries no geometry and no source vocabulary", () => {
    const composed = compose(resolvePacks(spatial(normalized())));
    const serialized = JSON.stringify(composed);
    for (const leak of ["exterior", "coordinates", "crsId", "POLYGON", "featureClass", "snapshotId", "rawRecordRef", "EPSG"]) {
      expect(serialized).not.toContain(leak);
    }
    // `adapterId` itself is NOT forbidden here: Phase 5 puts a document
    // adapter's identity on rule provenance, and that is correct. What must not
    // appear is the SPATIAL adapter — composition never learns which layer, or
    // which reader of which layer, put an instrument in play.
    expect(serialized).not.toContain("xx-yy-refburgh.zoning-districts.geojson");
    expect(serialized).not.toContain(REFERENCE_DATASET_ID);
  });

  test("the evaluator receives an ordinary rule array and learns nothing of the three layers above it", () => {
    const composed = compose(resolvePacks(spatial(normalized())));
    const serialized = JSON.stringify(composed.effectiveRules);
    for (const leak of ["packId", "conceptKey", "suppressed", "featureId", "datasetId", "geometry", "applicability", "rawRecordRef"]) {
      expect(serialized).not.toContain(leak);
    }
    expect(() => evaluate(composed)).not.toThrow();
  });

  test("the source never decides precedence: both instruments arrive unranked", () => {
    const result = spatial(normalized());
    expect(result.applicableRulePackIds).toEqual(["refburgh-dp-overlay", "refburgh-rb-1"]);
    const composed = compose(resolvePacks(result));
    // They regulate different concepts, so composition combines them with no
    // suppression and no conflict — decided on the rules, not on the layer.
    expect(composed.status).toBe("COMPOSED");
    expect(composed.suppressed).toEqual([]);
    expect(composed.unresolvedConflicts).toEqual([]);
  });
});


describe("E85 Phase 8 end-to-end - a parcel inside a feature nobody mapped", () => {
  /**
   * The case this whole gate exists for.
   *
   * Geometry does its job perfectly: the parcel is unambiguously inside zone C,
   * one base zone reaches it, nothing is tangled, nothing is ambiguous. And the
   * answer is still not complete, because the source's own policy never said
   * what governs zone C. The danger is not that anything fails - it is that
   * NOTHING fails, and an empty pack list downstream reads exactly like "no
   * instrument applies here" instead of "we do not know which instrument
   * applies here".
   */
  const unmappedOnly = () => snapshot({ records: [RECORD_UNMAPPED_ZONE()] });
  const parcelC = () => PARCEL_IN_UNMAPPED_RB_C();

  test("Phase 8 keeps the feature and says, in the result itself, that it is not finished", () => {
    const r = normalizeFull(unmappedOnly());
    expect(r.features.map((f) => f.featureId)).toEqual(["zone-c"]);
    expect(r.features[0].rulePackIds).toEqual([]);
    expect(r.quarantined).toEqual([]);
    // Three independent public statements, none of which requires reading prose.
    expect(r.readiness.rulePackLinkageSupported).toBe(false);
    expect(hasBlockingSpatialSourceFinding(r.findings)).toBe(true);
    expect(r.findings.find((f) => f.code === "RULE_PACK_LINK_UNRESOLVED")?.severity).toBe("GAP");
  });

  test("Phase 7 settles containment correctly and invents nothing to fill the gap", () => {
    const result = spatial(normalized(unmappedOnly()), parcelC());
    const hit = result.hits.find((h) => h.featureId === "zone-c");
    // Geometry is certain, and says so.
    expect(hit?.relation).toBe("CONTAINS");
    expect(hit?.applicability).toBe("APPLIES");
    // An applying feature with nothing to contribute contributes nothing. Phase 7
    // does not read "RB-3" and does not manufacture an identity to carry forward.
    expect(hit?.rulePackIds).toEqual([]);
    expect(result.applicableRulePackIds).toEqual([]);
    expect(result.ambiguousRulePackIds).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("refburgh-rb-3");
  });

  test("downstream there is simply no pack to compose - and that is not the same as no rules existing", () => {
    const result = spatial(normalized(unmappedOnly()), parcelC());
    expect(resolvePacks(result)).toEqual([]);
  });

  test("THE HAZARD: Phase 7's status cannot tell this case from a fully mapped one", () => {
    // This test states an uncomfortable fact rather than papering over it, and
    // the comparison is the sharpest form of it available: the ordinary,
    // fully-mapped parcel and the unmapped one come back with the SAME Phase 7
    // status. Not merely "not a data gap" — indistinguishable.
    const fullyMapped = spatial(normalized());
    const unmapped = spatial(normalized(unmappedOnly()), parcelC());
    expect(unmapped.status).toBe(fullyMapped.status);

    // Whatever warnings Phase 7 does raise are about other axes entirely —
    // licensing rights and an unknown effective date — so none of them stands in
    // for the missing linkage, and a caller filtering on them would learn nothing.
    expect(fullyMapped.findings.some((f) => f.code === "DATASET_LICENSE_LIMITATION")).toBe(true);
    expect(unmapped.findings.map((f) => f.code)).not.toContain("RULE_PACK_LINK_UNRESOLVED");

    // The only difference visible at this layer is an ABSENCE — an empty pack
    // list — and an absence is exactly what cannot be told from "no instrument
    // governs this ground".
    expect(unmapped.applicableRulePackIds).toEqual([]);

    // Which is precisely why the caller must carry Phase 8's result alongside it.
    // That is the layer that owns source-mapping completeness, and there the two
    // cases are not remotely alike. Phase 7 is not asked to learn this and must
    // not be taught it: reading a publisher's zone codes is not its question.
    const source = normalizeFull(unmappedOnly());
    expect(hasBlockingSpatialSourceFinding(source.findings)).toBe(true);
    expect(source.readiness.rulePackLinkageSupported).toBe(false);
    expect(hasBlockingSpatialSourceFinding(normalizeFull().findings)).toBe(false);
  });

  test("spatially located does not mean regulatory evaluation complete", () => {
    // The two facts, stated together, are the invariant this phase protects.
    const source = normalizeFull(unmappedOnly());
    const result = spatial(source.features, parcelC());

    // A. The authoritative source establishes that this polygon is here.
    expect(result.hits.find((h) => h.featureId === "zone-c")?.applicability).toBe("APPLIES");
    expect(source.features[0].provenance.datasetId).toBe(REFERENCE_DATASET_ID);
    expect(source.features[0].provenance.datasetVersionId).toBe(REFERENCE_RELEASE);

    // B. E85 cannot connect that polygon to a governing rule pack.
    expect(source.readiness.rulePackLinkageSupported).toBe(false);
    expect(hasBlockingSpatialSourceFinding(source.findings)).toBe(true);

    // Neither truth was solved by deleting the other.
    expect(source.features).toHaveLength(1);
    expect(source.features[0].rulePackIds).toEqual([]);
  });

  test("retaining the feature is what stops a downstream claim that this ground is unzoned", () => {
    // Suppressing the unlinked feature would leave Phase 7 comparing the parcel
    // against nothing, and "no feature reaches this parcel" is a finding about
    // the LAND. Keeping it means the record says the opposite and true thing: a
    // base zone does reach here, and its rules are what we lack.
    const withFeature = spatial(normalized(unmappedOnly()), parcelC());
    const withoutFeature = spatial([], parcelC());

    expect(withFeature.hits).toHaveLength(1);
    expect(withFeature.parcelMatch).not.toBe(withoutFeature.parcelMatch);
    // Both end with no packs - and they are emphatically not the same situation.
    expect(withFeature.applicableRulePackIds).toEqual([]);
    expect(withoutFeature.applicableRulePackIds).toEqual([]);
    expect(withoutFeature.dataGaps.length).toBeGreaterThan(0);
  });
});

describe("E85 Phase 8 end-to-end - a mixed layer: one mapped zone, one unmapped, one malformed", () => {
  /**
   * What a real municipal export looks like. The three records fail and succeed
   * in three different ways at once, and the requirement is that none of them
   * contaminates the others: the good one stays actionable, the unmapped one
   * stays traceable, the tangled one stays out.
   */
  const mixed = () => snapshot({ records: [RECORD_A(), RECORD_UNMAPPED_ZONE(), RECORD_BOWTIE(), RECORD_OVERLAY()] });

  test("the mapped feature keeps its pack and stays downstream-actionable", () => {
    const r = normalizeFull(mixed());
    const zoneA = r.features.find((f) => f.featureId === "zone-a");
    expect(zoneA?.rulePackIds).toEqual(["refburgh-rb-1"]);
    // And it still evaluates, exactly as it would have on a clean layer.
    const outcome = evaluate(compose(resolvePacks(spatial(r.features))));
    expect(outcome.resolvedMaxFsr?.value).toBe(1.5);
  });

  test("the unmapped feature is spatially traceable and carries no pack", () => {
    const r = normalizeFull(mixed());
    const zoneC = r.features.find((f) => f.featureId === "zone-c");
    expect(zoneC?.rulePackIds).toEqual([]);
    expect(zoneC?.featureClass).toBe("BASE_ZONE");
    expect(zoneC?.provenance.datasetVersionId).toBe(REFERENCE_RELEASE);
    // Traceable back to the exact raw record it came from.
    expect(r.audits.find((a) => a.featureId === "zone-c")?.rawRecordRef).toBeDefined();
  });

  test("the malformed feature stays quarantined and never becomes a feature", () => {
    const r = normalizeFull(mixed());
    expect(r.features.some((f) => f.featureId === "zone-bad")).toBe(false);
    expect(r.quarantined.map((q) => q.featureId)).toEqual(["zone-bad"]);
    expect(r.quarantined[0].reasonCodes).toContain("GEOMETRY_FAILED_PHASE7_VALIDATION");
  });

  test("the readiness axis stays ANY-semantics, exactly as documented", () => {
    // Recording the real behaviour, not the behaviour the field's NAME suggests.
    // One mapped feature is enough to satisfy this axis, because that is what it
    // was defined to mean: "at least one feature carries a resolved linkage".
    // A reader who wants "every feature is linked" must not read it here.
    const r = normalizeFull(mixed());
    expect(r.readiness.rulePackLinkageSupported).toBe(true);
  });

  test("CRITICAL: the blocking helper still reports the incomplete sibling", () => {
    // This is the load-bearing assertion of the mixed case. Seven readiness axes
    // are positive and the eighth is positive too - so readiness alone cannot
    // show that one feature went unmapped. The helper can, and does.
    const r = normalizeFull(mixed());
    expect(hasBlockingSpatialSourceFinding(r.findings)).toBe(true);
    const link = r.findings.find((f) => f.code === "RULE_PACK_LINK_UNRESOLVED");
    expect(link?.severity).toBe("GAP");
    expect(link?.featureId).toBe("zone-c");
    expect(link?.gap?.reasonCode).toBe("RULE_NOT_STRUCTURED");
  });

  test("the incomplete sibling never becomes a fabricated pack", () => {
    const r = normalizeFull(mixed());
    const packs = r.features.flatMap((f) => f.rulePackIds);
    expect(packs).toEqual(["refburgh-dp-overlay", "refburgh-rb-1"].sort());
    expect(JSON.stringify(r.features)).not.toContain("refburgh-rb-3");
  });

  test("reversing the source record order changes none of these semantics", () => {
    const forward = normalizeFull(snapshot({ records: [RECORD_A(), RECORD_UNMAPPED_ZONE(), RECORD_BOWTIE(), RECORD_OVERLAY()] }));
    const reversed = normalizeFull(snapshot({ records: [RECORD_OVERLAY(), RECORD_BOWTIE(), RECORD_UNMAPPED_ZONE(), RECORD_A()] }));

    expect(reversed.readiness).toEqual(forward.readiness);
    expect(hasBlockingSpatialSourceFinding(reversed.findings)).toBe(hasBlockingSpatialSourceFinding(forward.findings));
    // The features come out byte-identical: nothing about a feature depends on
    // where in the payload its record happened to sit.
    expect(JSON.stringify(reversed.features)).toBe(JSON.stringify(forward.features));

    // Findings and quarantine entries are compared on WHAT THEY SAY rather than
    // byte-for-byte, and the exclusion is deliberate rather than a concession.
    // `rawRecordRef` is `snapshotId#index` — a positional locator, documented as
    // "a locator, never an identity" — so a record that genuinely moved from
    // position 0 to position 3 SHOULD be referenced differently. A ref that
    // survived reordering would be the bug, because it would no longer point at
    // the record it names. What must not move is the substance.
    const saidBy = (r: E85SpatialNormalizationSuccess) => r.findings.map((f) => [f.code, f.severity, f.featureId ?? "", f.sourceValue ?? "", f.gap?.reasonCode ?? ""].join("|")).sort();
    expect(saidBy(reversed)).toEqual(saidBy(forward));

    const withheld = (r: E85SpatialNormalizationSuccess) => r.quarantined.map((q) => [q.featureId ?? "", [...q.reasonCodes].sort().join(",")].join("|")).sort();
    expect(withheld(reversed)).toEqual(withheld(forward));

    // And the linkage gap in particular still names the same feature.
    const link = (r: E85SpatialNormalizationSuccess) => r.findings.find((f) => f.code === "RULE_PACK_LINK_UNRESOLVED");
    expect(link(reversed)?.featureId).toBe(link(forward)?.featureId);
    expect(link(reversed)?.severity).toBe(link(forward)?.severity);
  });

  test("licensing uncertainty is a separate axis and does not move linkage either way", () => {
    // Rights to USE a layer and ability to MAP its codes fail for unrelated
    // reasons and are fixed by unrelated people. Neither may stand in for the other.
    const r = normalizeFull(mixed());
    expect(r.readiness.licenseStatus).toBe(referenceZoningDataset().licenseStatus);
    expect(r.readiness.accessStatus).toBe(referenceZoningDataset().accessStatus);
    // The linkage gap is reported on its own terms, never as a licensing problem.
    const link = r.findings.find((f) => f.code === "RULE_PACK_LINK_UNRESOLVED");
    expect(link?.gap?.reasonCode).toBe("RULE_NOT_STRUCTURED");
    expect(link?.gap?.reasonCode).not.toBe("LICENSE_UNKNOWN");
  });
});

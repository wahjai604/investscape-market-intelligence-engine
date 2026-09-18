/**
 * InvestScape™ E85 Phase 6 — end-to-end: independently-normalized packs →
 * composition → the UNCHANGED Phase 4 evaluator → regulatory result.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Two things are being proved together.
 *
 * First, that composition slots in cleanly: `effectiveRules` is an ordinary
 * `E85RuleRecord[]`, `evaluateZoningAndLandUse` takes it as-is, and the
 * evaluator neither knows nor can discover that more than one instrument was
 * involved. Phase 4 was not modified for Phase 6 and is not modified here.
 *
 * Second, that a final regulatory number is traceable the whole way back —
 * result → effective rule → composition decision → pack → source id/version →
 * adapter id/version → document locator — and that when a rule was displaced,
 * BOTH chains are still on the record.
 *
 * Offline throughout: no GIS, no network, no PDF, no filesystem evidence.
 */
import {
  composeE85RulePacks,
  compositionManualReview,
  materialCompositionConflicts,
  hasBlockingCompositionFinding,
  evaluateZoningAndLandUse,
  rulePackFromBundle,
  traceE85EffectiveConcept,
  buildE85ConceptKey,
  createE85AdapterRegistry,
  createE85SourceRegistry,
  normalizeSourceDocument,
  E85ComposedRulePack,
  E85EvaluationRequest,
  E85ParcelReference,
  E85PolicyVersion,
  E85RulePack,
  E85CompositionOptions,
  adapters,
} from "../../src/zoning-land-use-engine";
import { pack, relation, JURISDICTION, ZONE, COMPOSED_AT } from "./fixtures/composition-packs";
import { r11Document } from "./fixtures/vancouver-r1-1-facts";

const HEIGHT = buildE85ConceptKey("DIMENSIONAL", "maxHeightMetres");
const SITE_AREA_SQM = 500;

function compose(packs: readonly E85RulePack[], options: E85CompositionOptions = {}): E85ComposedRulePack {
  const result = composeE85RulePacks(packs, { composedAt: COMPOSED_AT, ...options });
  if (result.outcome !== "COMPOSED") throw new Error(`expected COMPOSED, got ${result.outcome}`);
  return result.composed;
}

function policy(): E85PolicyVersion {
  return { policyVersionId: "phase6-v1", effectiveFrom: "2020-01-01", concepts: {} };
}

function parcel(): E85ParcelReference {
  return {
    parcelReferenceId: "composition-parcel-1",
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

/** The composed pack goes straight in. No Phase 6 type crosses this boundary. */
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

const BASE = () => pack({ packId: "base", role: "BASE", usePermitted: "dwelling", maxFsr: 1.0, maxHeightMetres: 12 });
const OVERLAY = () => pack({ packId: "overlay", role: "OVERLAY", frontSetback: 5 });

describe("E85 Phase 6 end-to-end — two packs through composition into Phase 4", () => {
  const composed = compose([BASE(), OVERLAY()]);

  test("the composed rules evaluate to a resolved regulatory result", () => {
    const outcome = evaluate(composed);
    expect(["MACHINE_RESOLVED", "MACHINE_RESOLVED_WITH_WARNINGS"]).toContain(outcome.result.status);
    expect(outcome.usePermission?.status).toBe("PERMITTED");
  });

  test("values from BOTH instruments reach the one regulatory envelope", () => {
    const outcome = evaluate(composed);
    const envelope = ("envelope" in outcome.result ? outcome.result.envelope : undefined)?.envelope;
    // FSR and height came from the base; the front setback came from the overlay.
    expect(outcome.resolvedMaxFsr?.value).toBe(1.0);
    expect(envelope?.maxHeightMetres?.value).toBe(12);
    expect(envelope?.setbacksMetres?.front.value).toBe(5);
    expect(envelope?.maxRegulatoryGfaSqm?.value).toBe(1.0 * SITE_AREA_SQM);
  });

  test("the evaluator receives a plain rule array and nothing composition-specific", () => {
    const serialized = JSON.stringify(composed.effectiveRules);
    for (const compositionOnly of ["packId", "conceptKey", "suppressed", "relationId", "compositionRole", "precedence"]) {
      expect(serialized).not.toContain(compositionOnly);
    }
    // Every element is an ordinary rule record.
    for (const rule of composed.effectiveRules) {
      expect(["USE", "DENSITY", "DIMENSIONAL", "PARKING", "AMENITY", "OVERLAY", "REQUIREMENT"]).toContain(rule.family);
      expect(rule.jurisdictionId).toBe(JURISDICTION);
    }
  });

  test("reversing the source order changes nothing about the regulatory answer", () => {
    // Phase 4 stamps its own `resolvedAt` from the clock at evaluation time, so
    // that one field is normalized away; everything else must match byte for byte.
    const withoutClock = (outcome: unknown): string => JSON.stringify(outcome).replace(/"resolvedAt":"[^"]*"/g, '"resolvedAt":"<clock>"');
    const reversed = compose([OVERLAY(), BASE()]);
    expect(withoutClock(evaluate(reversed))).toBe(withoutClock(evaluate(composed)));
  });

  test("every permutation of three packs yields the same envelope", () => {
    const packs = [BASE(), OVERLAY(), pack({ packId: "third", role: "AGREEMENT", maxStoreys: 3 })];
    const perms = [
      [packs[0], packs[1], packs[2]],
      [packs[2], packs[0], packs[1]],
      [packs[1], packs[2], packs[0]],
      [packs[2], packs[1], packs[0]],
    ];
    const envelopes = perms.map((p) => {
      const outcome = evaluate(compose(p));
      const envelope = ("envelope" in outcome.result ? outcome.result.envelope : undefined)?.envelope;
      return JSON.stringify(envelope);
    });
    expect(new Set(envelopes).size).toBe(1);
  });
});

describe("E85 Phase 6 end-to-end — an unresolved conflict reaches the caller intact", () => {
  const contested = () => compose([BASE(), pack({ packId: "other", role: "SITE_SPECIFIC", maxHeightMetres: 10 })]);

  test("the contested value is simply absent from the envelope — no number is invented", () => {
    const outcome = evaluate(contested());
    const envelope = ("envelope" in outcome.result ? outcome.result.envelope : undefined)?.envelope;
    expect(envelope?.maxHeightMetres).toBeUndefined();
    // The uncontested concepts still resolve.
    expect(outcome.resolvedMaxFsr?.value).toBe(1.0);
  });

  test("the caller can escalate it deterministically via the materiality helper", () => {
    const review = compositionManualReview(contested(), ["USE", "DENSITY", "DIMENSIONAL"]);
    expect(review?.reasonCode).toBe("CONFLICTING_AUTHORITATIVE_SOURCES");
    expect(review?.evidenceConsidered).toHaveLength(2);
    expect(review?.flaggedAt).toBe(COMPOSED_AT);
  });

  test("a conflict outside the requested analyses does not escalate", () => {
    const parkingConflict = compose([
      pack({ packId: "a", role: "BASE", usePermitted: "dwelling", minParkingPerDwelling: 1 }),
      pack({ packId: "b", role: "OVERLAY", minParkingPerDwelling: 2 }),
    ]);
    expect(compositionManualReview(parkingConflict, ["USE", "DENSITY"])).toBeUndefined();
    expect(evaluate(parkingConflict).usePermission?.status).toBe("PERMITTED");
  });

  /**
   * THE COMMIT GATE: a withheld value must never be mistaken for an absent one.
   *
   * Two situations put an identical hole in the envelope — no instrument
   * regulates height, and two instruments regulate it irreconcilably. The
   * evaluator cannot tell them apart, and must not be asked to: it receives an
   * ordinary rule array and Phase 4 is not modified for Phase 6. So the burden
   * falls entirely on the composition layer, and this test exists to prove the
   * burden is actually carried rather than assumed.
   *
   * If this ever fails, a caller can read a confident result off a silently
   * contested height. That is the single most dangerous failure available to a
   * multi-source engine, so it is pinned explicitly rather than inferred from
   * the separate status/helper/finding tests above.
   */
  describe("a withheld value is distinguishable from an absent one", () => {
    const SILENT = () => compose([pack({ packId: "silent", role: "BASE", usePermitted: "dwelling", maxFsr: 1.0 })]);
    const heightOf = (composed: E85ComposedRulePack) => {
      const outcome = evaluate(composed);
      const envelope = ("envelope" in outcome.result ? outcome.result.envelope : undefined)?.envelope;
      return { status: outcome.result.status, height: envelope?.maxHeightMetres };
    };

    test("the evaluator alone genuinely cannot tell them apart — hence the gate", () => {
      const silent = heightOf(SILENT());
      const withheld = heightOf(contested());
      expect(silent.height).toBeUndefined();
      expect(withheld.height).toBeUndefined();
      // Identical evaluator-visible outcome. The distinction lives upstream.
      expect(withheld.status).toBe(silent.status);
    });

    test("composition status separates them", () => {
      expect(SILENT().status).toBe("COMPOSED");
      expect(contested().status).toBe("COMPOSED_WITH_UNRESOLVED_CONFLICTS");
    });

    test("the conflict carries both competing values, so neither was quietly dropped", () => {
      const material = materialCompositionConflicts(contested(), ["USE", "DENSITY", "DIMENSIONAL"]);
      expect(material).toHaveLength(1);
      expect(material[0].conceptKey).toBe(HEIGHT);
      expect([...material[0].distinctValues].sort()).toEqual([10, 12]);
      expect(materialCompositionConflicts(SILENT(), ["USE", "DENSITY", "DIMENSIONAL"])).toHaveLength(0);
    });

    test("the blocking finding fires on the conflict and stays silent on the absence", () => {
      expect(hasBlockingCompositionFinding(contested().findings)).toBe(true);
      expect(hasBlockingCompositionFinding(SILENT().findings)).toBe(false);
      expect(compositionManualReview(SILENT(), ["USE", "DENSITY", "DIMENSIONAL"])).toBeUndefined();
    });

    test("no effective height rule smuggles a value through in either case", () => {
      for (const composed of [SILENT(), contested()]) {
        expect(traceE85EffectiveConcept(composed, HEIGHT)).toBeUndefined();
        expect(JSON.stringify(composed.effectiveRules)).not.toContain("maxHeightMetres");
      }
    });
  });
});

describe("E85 Phase 6 end-to-end — provenance traces the whole way back", () => {
  test("a final regulatory value traces to its source, version, adapter and locator", () => {
    const composed = compose([BASE(), OVERLAY()]);
    const outcome = evaluate(composed);
    const envelope = ("envelope" in outcome.result ? outcome.result.envelope : undefined)?.envelope;

    const provenance = envelope?.maxHeightMetres?.provenance;
    expect(provenance?.sourceId).toBe(`${JURISDICTION}:instrument-base`);
    expect(provenance?.sourceVersionId).toBe(`${JURISDICTION}:instrument-base-v1`);
    expect(provenance?.adapterId).toBe(`${JURISDICTION}:instrument-base.adapter`);
    expect(provenance?.adapterVersion).toBe("1.0.0");
    expect(provenance?.documentLocator?.section).toBe("4.3");

    // And the same chain is reachable from the composed pack directly.
    const traced = traceE85EffectiveConcept(composed, HEIGHT);
    expect(traced?.provenance.sourceId).toBe(provenance?.sourceId);
    expect(traced?.value).toBe(12);
  });

  test("the setback resolves to the OVERLAY's source, not the base's", () => {
    const outcome = evaluate(compose([BASE(), OVERLAY()]));
    const envelope = ("envelope" in outcome.result ? outcome.result.envelope : undefined)?.envelope;
    expect(envelope?.setbacksMetres?.front.provenance.sourceId).toBe(`${JURISDICTION}:instrument-overlay`);
  });

  test("when a rule is overridden, both chains survive in the audit and the winner reaches the result", () => {
    const composed = compose([BASE(), pack({ packId: "site", role: "SITE_SPECIFIC", maxHeightMetres: 10 })], {
      precedenceRelations: [relation({ relationId: "r", subjectPackId: "site", objectPackId: "base", type: "OVERRIDES", scope: { conceptKeys: [HEIGHT] } })],
    });
    const outcome = evaluate(composed);
    const envelope = ("envelope" in outcome.result ? outcome.result.envelope : undefined)?.envelope;

    expect(envelope?.maxHeightMetres?.value).toBe(10);
    expect(envelope?.maxHeightMetres?.provenance.sourceId).toBe(`${JURISDICTION}:instrument-site`);

    const record = composed.suppressed[0];
    expect(record.suppressed.value).toBe(12);
    expect(record.suppressed.provenance.sourceId).toBe(`${JURISDICTION}:instrument-base`);
    expect(record.suppressed.provenance.documentLocator?.section).toBe("4.3");
    expect(record.effective.provenance.sourceId).toBe(`${JURISDICTION}:instrument-site`);
    expect(record.relation.provenance.documentLocator?.section).toBe("12.4");
  });
});

/**
 * The real Vancouver pilot bundle, used as ONE pack among synthetic others.
 * No Vancouver overlay, CD-1 or heritage adapter is implemented to make this
 * work, and no new legal fact about Vancouver is introduced — the second pack
 * is invented, and is labelled as such.
 */
describe("E85 Phase 6 end-to-end — the Phase 5 pilot bundle composes like any other pack", () => {
  const { vancouverR11Adapter, VANCOUVER_R1_1_SOURCE, VANCOUVER_JURISDICTION_ID, VANCOUVER_R1_1_ZONE } = adapters.vancouver;

  function pilotPack(): E85RulePack {
    const sources = createE85SourceRegistry([VANCOUVER_R1_1_SOURCE]);
    const adapterReg = createE85AdapterRegistry([vancouverR11Adapter]);
    if (!sources.ok || !adapterReg.ok) throw new Error("registries should build");
    const result = normalizeSourceDocument(r11Document(), sources.registry, adapterReg.registry);
    if (result.outcome !== "NORMALIZED") throw new Error("expected NORMALIZED");
    return rulePackFromBundle(result.bundle, "pilot", "BASE");
  }

  /** A wholly invented second instrument in the same jurisdiction/zone, stating a concept the pilot does not. */
  function syntheticCompanion(): E85RulePack {
    const p = pack({ packId: "synthetic-companion", role: "OVERLAY", minParkingPerDwelling: 1 });
    return { ...p, jurisdictionId: VANCOUVER_JURISDICTION_ID, zoneDesignation: VANCOUVER_R1_1_ZONE, rules: p.rules.map((r) => ({ ...r, jurisdictionId: VANCOUVER_JURISDICTION_ID, zoneDesignation: VANCOUVER_R1_1_ZONE })) };
  }

  test("a real normalized bundle converts to a rule pack with its identity intact", () => {
    const p = pilotPack();
    expect(p.sourceId).toBe(VANCOUVER_R1_1_SOURCE.sourceId);
    expect(p.sourceVersionId).toBe("2026-06-consolidation");
    expect(p.adapterId).toBe("ca-bc-vancouver.district-schedule.r1-1");
    expect(p.role).toBe("BASE");
  });

  test("the pilot's own temporal gap and licence limitation survive composition untouched", () => {
    const composed = compose([pilotPack(), syntheticCompanion()]);
    // Phase 5A established that this source states no effective date; composing
    // it with another instrument must not quietly supply one.
    // Phase 12B.2: the pilot's FSR is scoped, so it is traced under its scoped concept key.
    const traced = traceE85EffectiveConcept(composed, buildE85ConceptKey("DENSITY", "maxFsr", undefined, "use=multiple_dwelling;dwellingUnits=..8"));
    expect(traced?.value).toBe(1);
    expect(traced?.temporal).toEqual({ effectiveDateBasis: "UNKNOWN" });
    expect(composed.readinessLimitations.map((l) => l.packId)).toContain("pilot");
    expect(composed.readinessLimitations[0].blockers).toContain("LICENSE");
  });

  test("a licence-unknown pilot still contributes every one of its rules", () => {
    const composed = compose([pilotPack(), syntheticCompanion()]);
    // Scoped values reassemble into one record per scope, so families repeat.
    expect([...new Set(composed.effectiveRules.map((r) => r.family))].sort()).toEqual(["DENSITY", "DIMENSIONAL", "PARKING", "REQUIREMENT", "USE"]);
  });

  test("no Vancouver rule is overridden, because no relation was stated", () => {
    const composed = compose([pilotPack(), syntheticCompanion()]);
    expect(composed.suppressed).toEqual([]);
    expect(composed.unresolvedConflicts).toEqual([]);
  });

  test("composing the pilot with itself twice is idempotent and adds no corroboration", () => {
    const once = compose([pilotPack()]);
    const twice = compose([pilotPack(), { ...pilotPack(), packId: "pilot-copy" }]);
    expect(JSON.stringify(twice.effectiveRules)).toBe(JSON.stringify(once.effectiveRules));
    expect(twice.qualification).toEqual(once.qualification);
  });
});

/**
 * InvestScape™ E85 — parking/amenity current-only anti-look-ahead tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * PARKING and AMENITY receive the same Phase 12C.2 fallback density,
 * dimensional and requirement already have: a value that governs the proposal
 * but is outside its temporal window at `asOfDate` is a RULE_NOT_STRUCTURED
 * GAP, never a silent absence. This is evidence completeness only — it states
 * nothing about which rule value is legally in force.
 *
 * All values, jurisdictions and zones below are synthetic/fictional.
 */
import { evaluateParking, evaluateAmenity } from "../../src/zoning-land-use-engine/parking-amenity-evaluation";
import {
  assembleE85DecisionPackage,
  createE85SpatialAdapterRegistry,
  createE85SpatialDatasetRegistry,
  evaluateZoningAndLandUse,
  normalizeE85SpatialSnapshot,
  E85AmenityRule,
  E85DecisionPackage,
  E85DecisionRequest,
  E85Evidence,
  E85EvaluationFinding,
  E85ParcelReference,
  E85ParkingRule,
  E85PolicyVersion,
  E85RequestedAnalysis,
  E85RuleRecord,
  E85RulePack,
  E85TemporalWindow,
} from "../../src/zoning-land-use-engine";
import { referenceZoningDataset, referenceZoningSpatialAdapter } from "../../src/zoning-land-use-engine/adapters/spatial/reference";
import { NORMALIZED_AT, PARCEL_IN_RB_A, RECORD_A, snapshot } from "./fixtures/spatial-snapshots";
import { pack, COMPOSED_AT, ZONE, JURISDICTION as PACK_JURISDICTION } from "./fixtures/composition-packs";

const AS_OF = "2024-06-01";
const FUTURE: E85TemporalWindow = { effectiveFrom: "2025-01-01", effectiveDateBasis: "SOURCE_STATED" };
const EXPIRED: E85TemporalWindow = { effectiveFrom: "2020-01-01", effectiveTo: "2023-12-31", effectiveDateBasis: "SOURCE_STATED" };
const LIVE: E85TemporalWindow = { effectiveFrom: "2020-01-01", effectiveDateBasis: "SOURCE_STATED" };
const UNKNOWN: E85TemporalWindow = { effectiveDateBasis: "UNKNOWN" };

function parcel(): E85ParcelReference {
  return { parcelReferenceId: "p1" };
}

function ev<T>(value: T, temporal: E85TemporalWindow, sourceId = "src-parking"): E85Evidence<T> {
  return { value, provenance: { sourceId }, temporal };
}

function parkingRule(minSpacesPerUse: Record<string, E85Evidence<number>>, overrides: Partial<Pick<E85ParkingRule, "jurisdictionId" | "zoneDesignation">> = {}): E85ParkingRule {
  return { family: "PARKING", jurisdictionId: "jx", zoneDesignation: "Z1", ...overrides, minSpacesPerUse };
}

function amenityRule(requirements: Record<string, E85Evidence<string>>, requirementConditions?: Record<string, string>): E85AmenityRule {
  return { family: "AMENITY", jurisdictionId: "jx", zoneDesignation: "Z1", requirements, ...(requirementConditions ? { requirementConditions } : {}) };
}

const notStructured = (findings: readonly E85EvaluationFinding[]) => findings.filter((f) => f.outcome === "GAP" && f.gap?.reasonCode === "RULE_NOT_STRUCTURED");

describe("PARKING — temporally excluded evidence is a GAP, not a silent absence", () => {
  test("a not-yet-effective minimum produces RULE_NOT_STRUCTURED on its own field, with source and count", () => {
    const findings = evaluateParking([parkingRule({ dwelling_unit: ev(1.25, FUTURE) })], parcel(), "jx", "Z1", AS_OF);
    expect(findings).toHaveLength(1);
    const [gap] = findings;
    expect(gap.family).toBe("PARKING");
    expect(gap.field).toBe("minSpacesPerUse:dwelling_unit");
    expect(gap.outcome).toBe("GAP");
    expect(gap.resolvedValue).toBeUndefined();
    expect(gap.gap?.reasonCode).toBe("RULE_NOT_STRUCTURED");
    expect(gap.gap?.sourcesChecked).toEqual(["src-parking"]);
    expect(gap.gap?.reason).toMatch(/in force as of 2024-06-01/);
    expect(gap.gap?.reason).toMatch(/\(1 not yet effective, 0 expired\)/);
  });

  test("an expired maximum produces RULE_NOT_STRUCTURED on the maxSpacesPerUse field", () => {
    const rule: E85ParkingRule = { family: "PARKING", jurisdictionId: "jx", zoneDesignation: "Z1", maxSpacesPerUse: { dwelling_unit: ev(2, EXPIRED) } };
    const findings = evaluateParking([rule], parcel(), "jx", "Z1", AS_OF);
    expect(findings).toHaveLength(1);
    expect(findings[0].field).toBe("maxSpacesPerUse:dwelling_unit");
    expect(findings[0].gap?.reasonCode).toBe("RULE_NOT_STRUCTURED");
    expect(findings[0].gap?.reason).toMatch(/\(0 not yet effective, 1 expired\)/);
  });

  test("an in-window value still resolves exactly as before", () => {
    const findings = evaluateParking([parkingRule({ dwelling_unit: ev(1.25, LIVE) })], parcel(), "jx", "Z1", AS_OF);
    expect(findings).toHaveLength(1);
    expect(findings[0].outcome).toBe("RESOLVED");
    expect(findings[0].resolvedValue).toBe(1.25);
  });

  test("UNKNOWN date basis does not produce this gap (UNDETERMINED stays excluded from the fallback)", () => {
    const findings = evaluateParking([parkingRule({ dwelling_unit: ev(1.25, UNKNOWN) })], parcel(), "jx", "Z1", AS_OF);
    expect(notStructured(findings)).toEqual([]);
  });

  test("a rule for another jurisdiction or another zone produces no finding at all", () => {
    const rules = [parkingRule({ dwelling_unit: ev(1.25, FUTURE) }, { jurisdictionId: "other-jx" }), parkingRule({ dwelling_unit: ev(1.25, FUTURE) }, { zoneDesignation: "Z2" })];
    expect(evaluateParking(rules, parcel(), "jx", "Z1", AS_OF)).toEqual([]);
  });

  test("out-of-scope evidence stays NO_RULE_FOR_PROPOSAL_SCOPE and never becomes this gap", () => {
    const scoped: E85Evidence<number> = { ...ev(1.25, FUTURE), applicability: { useCodes: ["retail"] } };
    // "dwelling" must be a recognized use for the retail-only scope to be proven NOT_APPLICABLE rather than UNDETERMINED.
    const findings = evaluateParking([parkingRule({ dwelling_unit: scoped })], parcel(), "jx", "Z1", AS_OF, { useCode: "dwelling", recognizedUseCodes: ["dwelling", "retail"] });
    expect(notStructured(findings)).toEqual([]);
    expect(findings.map((f) => f.outcome)).toEqual(["NO_RULE_FOR_PROPOSAL_SCOPE"]);
  });

  test("keys are independent: one live key and one future key give one RESOLVED and one GAP", () => {
    const findings = evaluateParking([parkingRule({ vehicle: ev(1, LIVE), bicycle: ev(2, FUTURE) })], parcel(), "jx", "Z1", AS_OF);
    expect(findings.find((f) => f.field === "minSpacesPerUse:vehicle")?.outcome).toBe("RESOLVED");
    expect(findings.find((f) => f.field === "minSpacesPerUse:bicycle")?.gap?.reasonCode).toBe("RULE_NOT_STRUCTURED");
    expect(findings).toHaveLength(2);
  });

  test("per-rule behavior is preserved: the same key in a live rule and a future rule is evaluated per rule, not pooled", () => {
    const findings = evaluateParking([parkingRule({ dwelling_unit: ev(1, LIVE) }), parkingRule({ dwelling_unit: ev(3, FUTURE) })], parcel(), "jx", "Z1", AS_OF);
    const same = findings.filter((f) => f.field === "minSpacesPerUse:dwelling_unit");
    expect(same.map((f) => f.outcome)).toEqual(["RESOLVED", "GAP"]);
    expect(same[0].resolvedValue).toBe(1);
  });
});

describe("AMENITY — temporally excluded requirements are a GAP, not a silent absence", () => {
  test("a not-yet-effective unconditional requirement produces RULE_NOT_STRUCTURED on requirement:<key>", () => {
    const findings = evaluateAmenity([amenityRule({ childcare_sqm: ev("50 sqm", FUTURE, "src-amenity") })], parcel(), "jx", "Z1", AS_OF, undefined);
    expect(findings).toHaveLength(1);
    expect(findings[0].family).toBe("AMENITY");
    expect(findings[0].field).toBe("requirement:childcare_sqm");
    expect(findings[0].gap?.reasonCode).toBe("RULE_NOT_STRUCTURED");
    expect(findings[0].gap?.sourcesChecked).toEqual(["src-amenity"]);
  });

  test("an expired unconditional requirement produces the same gap", () => {
    const findings = evaluateAmenity([amenityRule({ public_art: ev("$X per sqm", EXPIRED) })], parcel(), "jx", "Z1", AS_OF, undefined);
    expect(findings).toHaveLength(1);
    expect(findings[0].field).toBe("requirement:public_art");
    expect(findings[0].gap?.reason).toMatch(/\(0 not yet effective, 1 expired\)/);
  });

  test("a conditional requirement outside its window is a GAP, not CONDITIONAL_UNRESOLVED (temporal exclusion is checked before the condition)", () => {
    const rule = amenityRule({ childcare_sqm: ev("50 sqm", FUTURE) }, { childcare_sqm: "unit_count_over_50" });
    const unaffirmed = evaluateAmenity([rule], parcel(), "jx", "Z1", AS_OF, undefined);
    const affirmed = evaluateAmenity([rule], parcel(), "jx", "Z1", AS_OF, { satisfiedConditions: ["unit_count_over_50"] });
    for (const findings of [unaffirmed, affirmed]) {
      expect(findings).toHaveLength(1);
      expect(findings[0].outcome).toBe("GAP");
      expect(findings[0].gap?.reasonCode).toBe("RULE_NOT_STRUCTURED");
    }
  });

  test("an expired conditional requirement is also a GAP", () => {
    const rule = amenityRule({ childcare_sqm: ev("50 sqm", EXPIRED) }, { childcare_sqm: "unit_count_over_50" });
    const findings = evaluateAmenity([rule], parcel(), "jx", "Z1", AS_OF, undefined);
    expect(findings.map((f) => f.gap?.reasonCode)).toEqual(["RULE_NOT_STRUCTURED"]);
  });

  test("an in-window conditional requirement keeps its existing CONDITIONAL_UNRESOLVED outcome", () => {
    const rule = amenityRule({ childcare_sqm: ev("50 sqm", LIVE) }, { childcare_sqm: "unit_count_over_50" });
    const findings = evaluateAmenity([rule], parcel(), "jx", "Z1", AS_OF, undefined);
    expect(findings.map((f) => f.outcome)).toEqual(["CONDITIONAL_UNRESOLVED"]);
  });

  test("UNKNOWN date basis does not produce this gap", () => {
    const findings = evaluateAmenity([amenityRule({ childcare_sqm: ev("50 sqm", UNKNOWN) })], parcel(), "jx", "Z1", AS_OF, undefined);
    expect(notStructured(findings)).toEqual([]);
  });
});

describe("Phase 4 overall status — the gap is material only when its family is requested", () => {
  function policy(): E85PolicyVersion {
    return { policyVersionId: "parking-temporal-v1", effectiveFrom: "2020-01-01", concepts: {} };
  }

  function evaluate(rules: readonly E85RuleRecord[], requestedAnalyses: readonly E85RequestedAnalysis[]) {
    return evaluateZoningAndLandUse({ parcel: parcel(), jurisdictionId: "jx", zoneDesignation: "Z1", useCode: "dwelling", asOfDate: AS_OF, rules, requestedAnalyses, policyVersion: policy() });
  }

  const liveHeight: E85RuleRecord = { family: "DIMENSIONAL", jurisdictionId: "jx", zoneDesignation: "Z1", maxHeightMetres: ev(12, LIVE, "src-dim") };

  test("control: a requested PARKING family with in-window evidence is MACHINE_RESOLVED", () => {
    expect(evaluate([parkingRule({ dwelling_unit: ev(1, LIVE) })], ["PARKING"]).result.status).toBe("MACHINE_RESOLVED");
  });

  test("requested PARKING with only out-of-window evidence yields DATA_GAP carrying the RULE_NOT_STRUCTURED gap", () => {
    const outcome = evaluate([parkingRule({ dwelling_unit: ev(1, FUTURE) })], ["PARKING"]);
    expect(outcome.result.status).toBe("DATA_GAP");
    if (outcome.result.status !== "DATA_GAP") throw new Error("expected DATA_GAP");
    expect(outcome.result.gaps.map((g) => g.reasonCode)).toEqual(["RULE_NOT_STRUCTURED"]);
  });

  test("requested AMENITY with only out-of-window evidence yields DATA_GAP", () => {
    const outcome = evaluate([amenityRule({ childcare_sqm: ev("50 sqm", EXPIRED) })], ["AMENITY"]);
    expect(outcome.result.status).toBe("DATA_GAP");
  });

  test("unrequested PARKING/AMENITY with out-of-window evidence has no status effect", () => {
    const rules: E85RuleRecord[] = [liveHeight, parkingRule({ dwelling_unit: ev(1, FUTURE) }), amenityRule({ childcare_sqm: ev("50 sqm", EXPIRED) })];
    const withOutOfWindow = evaluate(rules, ["DIMENSIONAL"]);
    const withoutThem = evaluate([liveHeight], ["DIMENSIONAL"]);
    expect(withOutOfWindow.result.status).toBe(withoutThem.result.status);
    expect(withOutOfWindow.result.status).not.toBe("DATA_GAP");
  });
});

describe("Phase 9 adopts Phase 4's DATA_GAP without any decision/materiality change", () => {
  const ASSEMBLED_AT = "2026-03-01T00:00:00.000Z";
  const RESOLVED_AT = "2026-02-12T00:00:00.000Z";
  const DECISION_AS_OF = "2026-02-12";

  function datasets() {
    return createE85SpatialDatasetRegistry([referenceZoningDataset()]);
  }

  function normalized() {
    const registry = createE85SpatialAdapterRegistry([referenceZoningSpatialAdapter]);
    if (!registry.ok) throw new Error("adapter registry problems");
    return normalizeE85SpatialSnapshot(snapshot({ records: [RECORD_A()] }), datasets(), registry.registry, { normalizedAt: NORMALIZED_AT });
  }

  /** The existing synthetic RB-1 pack, with its parking value's window optionally closed before the decision date. */
  function rb1(parkingWindow: "LIVE" | "EXPIRED"): E85RulePack {
    const base = pack({ packId: "refburgh-rb-1", role: "BASE", usePermitted: "dwelling", maxFsr: 1.5, maxHeightMetres: 14, minParkingPerDwelling: 1 });
    if (parkingWindow === "LIVE") return base;
    const rules = base.rules.map((r): E85RuleRecord => {
      if (r.family !== "PARKING" || !r.minSpacesPerUse) return r;
      const closed = Object.fromEntries(Object.entries(r.minSpacesPerUse).map(([k, e]) => [k, { ...e, temporal: { ...e.temporal, effectiveTo: "2025-12-31" } }]));
      return { ...r, minSpacesPerUse: closed };
    });
    return { ...base, rules };
  }

  function decide(parkingWindow: "LIVE" | "EXPIRED"): E85DecisionPackage {
    const parcelSpatial = PARCEL_IN_RB_A();
    const request: E85DecisionRequest = {
      decisionId: "decision-parking-temporal",
      normalization: normalized(),
      parcelSpatial,
      parcel: {
        parcelReferenceId: parcelSpatial.parcelReferenceId,
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
      },
      jurisdictionId: PACK_JURISDICTION,
      zoneDesignation: ZONE,
      useCode: "dwelling",
      asOfDate: DECISION_AS_OF,
      requestedAnalyses: ["PARKING"],
      policyVersion: { policyVersionId: "phase9-parking-temporal", effectiveFrom: "2020-01-01", concepts: {} },
      availableRulePacks: [rb1(parkingWindow), pack({ packId: "refburgh-rb-2", role: "BASE", usePermitted: "dwelling", maxFsr: 3.0, maxHeightMetres: 26 })],
      spatialRegistry: datasets(),
      resolvedAt: RESOLVED_AT,
      composedAt: COMPOSED_AT,
      assembledAt: ASSEMBLED_AT,
    };
    return assembleE85DecisionPackage(request);
  }

  test("control: in-window parking evidence resolves in Phase 4 and the decision is not DATA_GAP", () => {
    const p = decide("LIVE");
    expect(p.phase4?.result.status).toBe("MACHINE_RESOLVED");
    expect(p.status).not.toBe("DATA_GAP");
  });

  test("expired parking evidence surfaces as Phase 4 DATA_GAP and the decision adopts it", () => {
    const p = decide("EXPIRED");
    expect(p.phase4?.result.status).toBe("DATA_GAP");
    const result = p.phase4?.result;
    if (result?.status !== "DATA_GAP") throw new Error("expected Phase 4 DATA_GAP");
    expect(result.gaps.map((g) => g.reasonCode)).toEqual(["RULE_NOT_STRUCTURED"]);
    expect(p.status).toBe("DATA_GAP");
  });
});

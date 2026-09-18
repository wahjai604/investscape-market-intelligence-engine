/**
 * InvestScape™ E85 Phase 12B.2 — scoped rule applicability: generic contract,
 * identity, composition and evaluation tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Every rule here is invented for an invented jurisdiction ("xx-yy-testville"),
 * so nothing proven in this file can be an accident of Vancouver data. The last
 * section checks the R1-1 temporal and identity freezes on the corrected facts.
 */
import * as fs from "fs";
import * as path from "path";
import {
  adapters,
  buildE85ConceptKey,
  canonicalE85ApplicabilityKey,
  canonicalRulePackFromBundle,
  composeE85RulePacks,
  conceptKeyBase,
  decomposeE85Rules,
  e85ApplicabilityScopesProvenDisjoint,
  evaluateDensity,
  evaluateE85RuleApplicability,
  evaluateZoningAndLandUse,
  evidenceIdentityKey,
  isE85ApplicabilityScoped,
  reassembleE85Rules,
  validateE85RuleApplicability,
  E85ApplicabilityContext,
  E85DensityRule,
  E85DimensionalRule,
  E85EvaluationRequest,
  E85Evidence,
  E85PolicyVersion,
  E85PrecedenceRelation,
  E85Provenance,
  E85RuleApplicability,
  E85RulePack,
  E85RuleRecord,
  E85UseRule,
} from "../../src/zoning-land-use-engine";
import { r11Document } from "./fixtures/vancouver-r1-1-facts";

const J = "xx-yy-testville";
const Z = "T-1";

function provenance(section: string, sourceId = `${J}:land-code`): E85Provenance {
  return { sourceId, documentLocator: { bylawOrDocumentId: "LC-1", section } } as E85Provenance;
}

function ev<T>(value: T, applicability?: E85RuleApplicability, section = "1", sourceId?: string): E85Evidence<T> {
  return { value, provenance: provenance(section, sourceId), temporal: { effectiveFrom: "2020-01-01", effectiveDateBasis: "SOURCE_STATED" }, ...(applicability ? { applicability } : {}) };
}

const APARTMENT: E85RuleApplicability = { useCodes: ["apartment"], dwellingUnits: { max: 8 } };
const NOT_APARTMENT: E85RuleApplicability = { excludedUseCodes: ["apartment"] };

function uses(...codes: string[]): E85UseRule {
  return { family: "USE", jurisdictionId: J, zoneDesignation: Z, permissions: codes.map((c) => ev({ useCode: c, status: "PERMITTED" as const })) };
}
function density(maxFsr: E85Evidence<number>): E85DensityRule {
  return { family: "DENSITY", jurisdictionId: J, zoneDesignation: Z, maxFsr };
}
function height(maxHeightMetres: E85Evidence<number>): E85DimensionalRule {
  return { family: "DIMENSIONAL", jurisdictionId: J, zoneDesignation: Z, maxHeightMetres };
}

const policy = (): E85PolicyVersion => ({ policyVersionId: "scoped-v1", effectiveFrom: "2020-01-01", concepts: {} });

function evaluate(rules: readonly E85RuleRecord[], useCode: string, extra: Partial<E85EvaluationRequest> = {}) {
  return evaluateZoningAndLandUse({
    parcel: { parcelReferenceId: "p", siteAreaSqm: 500 },
    jurisdictionId: J,
    zoneDesignation: Z,
    useCode,
    asOfDate: "2026-01-01",
    rules,
    requestedAnalyses: ["DENSITY", "DIMENSIONAL"],
    policyVersion: policy(),
    ...extra,
  });
}

function pack(packId: string, rules: readonly E85RuleRecord[]): E85RulePack {
  return { packId, jurisdictionId: J, zoneDesignation: Z, sourceId: `${J}:${packId}`, role: "BASE", rules, conditionalRules: [] };
}

/* ================================================================== */

describe("canonical applicability key", () => {
  test("is order-independent: codes are trimmed, de-duplicated and sorted; object key order is irrelevant", () => {
    const a: E85RuleApplicability = { useCodes: ["b", " a ", "a"], dwellingUnits: { max: 8 } };
    const b: E85RuleApplicability = { dwellingUnits: { max: 8 }, useCodes: ["a", "b"] };
    expect(canonicalE85ApplicabilityKey(a)).toBe("use=a|b;dwellingUnits=..8");
    expect(canonicalE85ApplicabilityKey(b)).toBe(canonicalE85ApplicabilityKey(a));
  });

  test("walks a fixed dimension order", () => {
    const all: E85RuleApplicability = {
      requiredConditionIds: ["c"],
      excludedTenureCodes: ["t2"],
      tenureCodes: ["t1"],
      frontageMetres: { min: 17.1 },
      siteAreaSqm: { min: 623 },
      excludedBuildingRoles: ["r2"],
      buildingRoles: ["r1"],
      dwellingUnits: { min: 3, max: 8 },
      excludedUseCodes: ["u2"],
      useCodes: ["u1"],
    };
    expect(canonicalE85ApplicabilityKey(all)).toBe("use=u1;notUse=u2;dwellingUnits=3..8;role=r1;notRole=r2;siteAreaSqm=623..;frontageMetres=17.1..;tenure=t1;notTenure=t2;conditions=c");
  });

  test("empty is identical to absent", () => {
    for (const empty of [undefined, {}, { useCodes: [] }, { dwellingUnits: {} }, { useCodes: ["  "] }] as (E85RuleApplicability | undefined)[]) {
      expect(canonicalE85ApplicabilityKey(empty)).toBe("");
      expect(isE85ApplicabilityScoped(empty)).toBe(false);
    }
    expect(evidenceIdentityKey(ev(1, {}))).toBe(evidenceIdentityKey(ev(1)));
  });

  test("bounds are inclusive and print consistently, including -0", () => {
    expect(canonicalE85ApplicabilityKey({ frontageMetres: { min: 17.1, max: 20 } })).toBe("frontageMetres=17.1..20");
    expect(canonicalE85ApplicabilityKey({ dwellingUnits: { min: -0 } })).toBe("dwellingUnits=0..");
    expect(evaluateE85RuleApplicability({ dwellingUnits: { max: 8 } }, { dwellingUnitCount: 8 }).outcome).toBe("APPLIES");
    expect(evaluateE85RuleApplicability({ siteAreaSqm: { min: 623 } }, { siteAreaSqm: 623 }).outcome).toBe("APPLIES");
  });

  test("non-finite and inverted bounds are rejected", () => {
    for (const bad of [{ dwellingUnits: { max: Number.NaN } }, { siteAreaSqm: { min: Number.POSITIVE_INFINITY } }, { frontageMetres: { min: 10, max: 5 } }] as E85RuleApplicability[]) {
      expect(validateE85RuleApplicability(bad).length).toBeGreaterThan(0);
      expect(() => canonicalE85ApplicabilityKey(bad)).toThrow(/Invalid rule applicability/);
    }
  });

  test("codes with reserved serialization characters are rejected deterministically, never escaped", () => {
    for (const code of ["a;b", "a|b", "a=b", "a{b", "a}b", "a\nb"]) {
      const bad: E85RuleApplicability = { useCodes: [code] };
      expect(() => canonicalE85ApplicabilityKey(bad)).toThrow(/reserved character/);
      expect(validateE85RuleApplicability(bad)).toEqual(validateE85RuleApplicability(bad));
    }
  });

  test("scope locators are provenance, not identity", () => {
    const withLocator: E85RuleApplicability = { ...APARTMENT, locators: { useCodes: { section: "9" } } };
    expect(canonicalE85ApplicabilityKey(withLocator)).toBe(canonicalE85ApplicabilityKey(APARTMENT));
  });

  test("contains no jurisdiction vocabulary", () => {
    expect(canonicalE85ApplicabilityKey(APARTMENT)).toBe("use=apartment;dwellingUnits=..8");
  });
});

describe("three-valued applicability", () => {
  const bound: E85RuleApplicability = { dwellingUnits: { max: 8 } };

  test("true, false and missing", () => {
    expect(evaluateE85RuleApplicability(bound, { dwellingUnitCount: 6 })).toEqual({ outcome: "APPLIES", applicabilityKey: "dwellingUnits=..8", missingDimensions: [] });
    expect(evaluateE85RuleApplicability(bound, { dwellingUnitCount: 9 })).toEqual({ outcome: "NOT_APPLICABLE", applicabilityKey: "dwellingUnits=..8", decidingDimension: "dwellingUnits", missingDimensions: [] });
    expect(evaluateE85RuleApplicability(bound, {})).toEqual({ outcome: "UNDETERMINED", applicabilityKey: "dwellingUnits=..8", missingDimensions: ["dwellingUnits"] });
  });

  test("any false wins over unknowns, wherever it appears", () => {
    const scope: E85RuleApplicability = { useCodes: ["apartment"], buildingRoles: ["rear"], tenureCodes: ["rental"] };
    const result = evaluateE85RuleApplicability(scope, { buildingRole: "front" });
    expect(result.outcome).toBe("NOT_APPLICABLE");
    expect(result.decidingDimension).toBe("buildingRoles");
  });

  test("all unknowns are reported, in canonical order", () => {
    const scope: E85RuleApplicability = { tenureCodes: ["rental"], dwellingUnits: { max: 8 } };
    expect(evaluateE85RuleApplicability(scope, {}).missingDimensions).toEqual(["dwellingUnits", "tenureCodes"]);
  });

  test("external conditions: affirmed true, explicitly false, unknown, contradictory", () => {
    const scope: E85RuleApplicability = { requiredConditionIds: ["site west of line"] };
    expect(evaluateE85RuleApplicability(scope, { satisfiedConditions: ["site west of line"] }).outcome).toBe("APPLIES");
    expect(evaluateE85RuleApplicability(scope, { unsatisfiedConditions: ["site west of line"] }).outcome).toBe("NOT_APPLICABLE");
    expect(evaluateE85RuleApplicability(scope, {}).outcome).toBe("UNDETERMINED");
    expect(evaluateE85RuleApplicability(scope, { satisfiedConditions: ["site west of line"], unsatisfiedConditions: ["site west of line"] }).outcome).toBe("UNDETERMINED");
  });

  test("unscoped evidence always applies", () => {
    expect(evaluateE85RuleApplicability(undefined, {}).outcome).toBe("APPLIES");
  });
});

describe("unknown-use safety", () => {
  const ctx = (useCode: string, recognized: string[]): E85ApplicabilityContext => ({ useCode, recognizedUseCodes: recognized });

  test("an unrecognized use never satisfies an exclusion scope", () => {
    expect(evaluateE85RuleApplicability(NOT_APARTMENT, ctx("spaceport", ["house", "apartment"])).outcome).toBe("UNDETERMINED");
    expect(evaluateE85RuleApplicability(NOT_APARTMENT, ctx("house", ["house", "apartment"])).outcome).toBe("APPLIES");
    expect(evaluateE85RuleApplicability(NOT_APARTMENT, ctx("apartment", [])).outcome).toBe("NOT_APPLICABLE");
  });

  test("an unrecognized use is not proven outside an inclusion scope either", () => {
    expect(evaluateE85RuleApplicability({ useCodes: ["duplex"] }, ctx("spaceport", ["house"])).outcome).toBe("UNDETERMINED");
    expect(evaluateE85RuleApplicability({ useCodes: ["duplex"] }, ctx("house", ["house"])).outcome).toBe("NOT_APPLICABLE");
  });

  const rules: E85RuleRecord[] = [
    uses("house", "duplex", "apartment"),
    density(ev(1.0, APARTMENT, "3.1")),
    density(ev(0.7, { useCodes: ["duplex"] }, "3.2a")),
    density(ev(0.6, { excludedUseCodes: ["apartment", "duplex"] }, "3.2b")),
  ];

  test("recognized uses each get their own scoped FSR", () => {
    expect(evaluate(rules, "house").resolvedMaxFsr?.value).toBe(0.6);
    expect(evaluate(rules, "duplex").resolvedMaxFsr?.value).toBe(0.7);
    expect(evaluate(rules, "apartment", { proposal: { dwellingUnitCount: 6 } }).resolvedMaxFsr?.value).toBe(1.0);
  });

  test("an unknown use gets no FSR and a USE_CLASSIFICATION_UNKNOWN gap", () => {
    const outcome = evaluate(rules, "spaceport");
    expect(outcome.resolvedMaxFsr).toBeUndefined();
    expect(outcome.result.status).toBe("DATA_GAP");
    if (outcome.result.status !== "DATA_GAP") return;
    expect(outcome.result.gaps.map((g) => g.reasonCode)).toEqual(["USE_CLASSIFICATION_UNKNOWN"]);
  });

  test("without use-permission evidence, no use is recognized, so exclusion scopes never apply", () => {
    const outcome = evaluate(rules.slice(1), "house");
    expect(outcome.resolvedMaxFsr).toBeUndefined();
    expect(outcome.result.status).toBe("DATA_GAP");
  });
});

describe("scope identity", () => {
  test("unscoped concept keys are byte-identical to every earlier phase", () => {
    const { contributions } = decomposeE85Rules(
      [density(ev(1)), { family: "DIMENSIONAL", jurisdictionId: J, zoneDesignation: Z, setbacksMetres: { front: ev(4) } }, uses("house")],
      "p",
    );
    expect(contributions.map((c) => c.conceptKey).sort()).toEqual(["DENSITY:maxFsr", "DIMENSIONAL:setbacksMetres[front]", "USE:permission[house]"]);
    expect(contributions.every((c) => c.applicabilityKey === undefined)).toBe(true);
    expect(evidenceIdentityKey(ev(1))).not.toContain("applicability");
  });

  test("same scope -> same key; disjoint scope -> distinct key; base key recoverable", () => {
    const k1 = buildE85ConceptKey("DENSITY", "maxFsr", undefined, canonicalE85ApplicabilityKey({ dwellingUnits: { max: 8 }, useCodes: ["apartment"] }));
    const k2 = buildE85ConceptKey("DENSITY", "maxFsr", undefined, canonicalE85ApplicabilityKey(APARTMENT));
    const k3 = buildE85ConceptKey("DENSITY", "maxFsr", undefined, canonicalE85ApplicabilityKey(NOT_APARTMENT));
    expect(k1).toBe("DENSITY:maxFsr{use=apartment;dwellingUnits=..8}");
    expect(k2).toBe(k1);
    expect(k3).not.toBe(k1);
    expect(conceptKeyBase(k1)).toBe("DENSITY:maxFsr");
    expect(conceptKeyBase("DENSITY:maxFsr")).toBe("DENSITY:maxFsr");
    const bonusKey = buildE85ConceptKey("DENSITY", "conditionalBonus.additionalFsr", "if {braces} appear");
    expect(conceptKeyBase(bonusKey)).toBe(bonusKey);
  });

  test("applicability provenance is not erased from evidence identity", () => {
    const a = ev(1, { ...APARTMENT, locators: { useCodes: { section: "3.1" } } });
    const b = ev(1, { ...APARTMENT, locators: { useCodes: { section: "7.4" } } });
    expect(evidenceIdentityKey(a)).not.toBe(evidenceIdentityKey(b));
    const keys = decomposeE85Rules([density(a), density(b)], "p").contributions.map((c) => c.conceptKey);
    expect(new Set(keys).size).toBe(1);
  });

  test("reassembly keeps one record per scope, and is byte-identical for unscoped input", () => {
    const unscoped: E85RuleRecord[] = [uses("house"), density(ev(1)), height(ev(10))];
    const round = decomposeE85Rules(unscoped, "p");
    const rebuiltUnscoped = reassembleE85Rules(round.contributions, round.overlays);
    // Content round-trips exactly (reassembly has always emitted its own key order).
    expect(rebuiltUnscoped).toEqual(unscoped);
    // And a second round trip is byte-identical: no scope artefact is introduced.
    const again = decomposeE85Rules(rebuiltUnscoped, "p");
    expect(JSON.stringify(reassembleE85Rules(again.contributions, again.overlays))).toBe(JSON.stringify(rebuiltUnscoped));
    expect(JSON.stringify(rebuiltUnscoped)).not.toContain("applicability");

    const scoped = decomposeE85Rules([density(ev(1, APARTMENT)), density(ev(0.6, NOT_APARTMENT))], "p");
    const rebuilt = reassembleE85Rules(scoped.contributions, scoped.overlays) as E85DensityRule[];
    expect(rebuilt.map((r) => r.maxFsr?.value).sort()).toEqual([0.6, 1]);
  });
});

describe("scope disjointness", () => {
  test("proven only by a dimension that cannot hold for both", () => {
    expect(e85ApplicabilityScopesProvenDisjoint(APARTMENT, NOT_APARTMENT)).toBe(true);
    expect(e85ApplicabilityScopesProvenDisjoint({ useCodes: ["a"] }, { useCodes: ["b"] })).toBe(true);
    expect(e85ApplicabilityScopesProvenDisjoint({ dwellingUnits: { max: 8 } }, { dwellingUnits: { min: 9 } })).toBe(true);
    expect(e85ApplicabilityScopesProvenDisjoint({ buildingRoles: ["rear"] }, { excludedBuildingRoles: ["rear"] })).toBe(true);
  });

  test("never assumed: unscoped, overlapping, exclusion-only and opaque conditions are NOT disjoint", () => {
    expect(e85ApplicabilityScopesProvenDisjoint(undefined, APARTMENT)).toBe(false);
    expect(e85ApplicabilityScopesProvenDisjoint({ useCodes: ["apartment"] }, { dwellingUnits: { max: 8 } })).toBe(false);
    expect(e85ApplicabilityScopesProvenDisjoint({ excludedUseCodes: ["a"] }, { excludedUseCodes: ["b"] })).toBe(false);
    expect(e85ApplicabilityScopesProvenDisjoint({ requiredConditionIds: ["west"] }, { requiredConditionIds: ["east"] })).toBe(false);
    expect(e85ApplicabilityScopesProvenDisjoint({ dwellingUnits: { max: 8 } }, { dwellingUnits: { min: 8 } })).toBe(false);
  });
});

describe("Phase 6 composition with scoped concepts", () => {
  const composed = (packs: E85RulePack[], relations?: E85PrecedenceRelation[]) => {
    const result = composeE85RulePacks(packs, { composedAt: "2026-01-01T00:00:00.000Z", ...(relations ? { precedenceRelations: relations } : {}) });
    if (result.outcome !== "COMPOSED") throw new Error("expected COMPOSED");
    return result.composed;
  };

  test("proven-disjoint scoped values coexist, with an audit finding", () => {
    const c = composed([pack("base", [density(ev(1, APARTMENT)), density(ev(0.6, NOT_APARTMENT))])]);
    expect(c.unresolvedConflicts).toEqual([]);
    expect(c.findings.some((f) => f.code === "SCOPED_CONCEPTS_DISJOINT" && f.conceptKey === "DENSITY:maxFsr")).toBe(true);
    expect((c.effectiveRules as E85DensityRule[]).map((r) => r.maxFsr?.value).sort()).toEqual([0.6, 1]);
  });

  test("overlapping scopes with differing values are an unresolved conflict", () => {
    const c = composed([pack("a", [density(ev(1, { useCodes: ["apartment"] }))]), pack("b", [density(ev(0.8, { dwellingUnits: { max: 8 } }))])]);
    expect(c.unresolvedConflicts.map((x) => x.conceptKey)).toEqual(["DENSITY:maxFsr"]);
  });

  test("an unscoped value overlaps every scope", () => {
    const c = composed([pack("a", [density(ev(1, APARTMENT))]), pack("b", [density(ev(0.5))])]);
    expect(c.unresolvedConflicts).toHaveLength(1);
  });

  test("opaque condition ids never make scopes disjoint", () => {
    const c = composed([pack("a", [density(ev(1, { requiredConditionIds: ["west of line"] }))]), pack("b", [density(ev(0.6, { requiredConditionIds: ["east of line"] }))])]);
    expect(c.unresolvedConflicts).toHaveLength(1);
  });

  test("overlapping scopes that agree coexist without conflict", () => {
    const c = composed([pack("a", [density(ev(1, { useCodes: ["apartment"] }))]), pack("b", [density(ev(1, { dwellingUnits: { max: 8 } }))])]);
    expect(c.unresolvedConflicts).toEqual([]);
  });

  test("equal scoped values from independent authorities are preserved as independent evidence", () => {
    const c = composed([pack("a", [density(ev(1, APARTMENT, "3.1", `${J}:a`))]), pack("b", [density(ev(1, APARTMENT, "9.9", `${J}:b`))])]);
    expect(c.findings.some((f) => f.code === "INDEPENDENT_AGREEMENT_PRESERVED")).toBe(true);
    expect(c.findings.some((f) => f.code === "DUPLICATE_RULE_COLLAPSED")).toBe(false);
  });

  test("precedence stated on the base concept still decides an overlapping scoped disagreement", () => {
    const relation = {
      relationId: "site-over-base",
      subjectPackId: "site",
      objectPackId: "base",
      type: "OVERRIDES",
      scope: { conceptKeys: ["DENSITY:maxFsr"] },
      provenance: provenance("12.4"),
    } as E85PrecedenceRelation;
    const c = composed([pack("base", [density(ev(1, { useCodes: ["apartment"] }))]), pack("site", [density(ev(0.8, { dwellingUnits: { max: 8 } }))])], [relation]);
    expect(c.unresolvedConflicts).toEqual([]);
    expect(c.suppressed.map((s) => s.relationId)).toEqual(["site-over-base"]);
  });
});

describe("Phase 4 request-time selection", () => {
  const heights: E85RuleRecord[] = [uses("apartment"), height(ev(8.5, { buildingRoles: ["rear"] }, "a")), height(ev(11.5, { excludedBuildingRoles: ["rear"] }, "b"))];

  test("selection happens before conflict detection: disjoint values never become a false MANUAL_REVIEW", () => {
    const front = evaluate(heights, "apartment", { proposal: { buildingRole: "front" } });
    expect(front.result.status).not.toBe("MANUAL_REVIEW_REQUIRED");
    expect(("envelope" in front.result ? front.result.envelope : undefined)?.envelope.maxHeightMetres?.value).toBe(11.5);
    const rear = evaluate(heights, "apartment", { proposal: { buildingRole: "rear" } });
    expect(("envelope" in rear.result ? rear.result.envelope : undefined)?.envelope.maxHeightMetres?.value).toBe(8.5);
  });

  test("missing proposal context is a DATA_GAP naming the missing dimension, not a guess", () => {
    const outcome = evaluate(heights, "apartment");
    expect(outcome.result.status).toBe("DATA_GAP");
    if (outcome.result.status !== "DATA_GAP") return;
    expect(outcome.result.gaps.map((g) => g.reasonCode)).toEqual(["PROPOSAL_CONTEXT_MISSING"]);
    expect(outcome.result.gaps[0].reason).toMatch(/buildingRoles/);
  });

  test("a missing site dimension a scope depends on is REQUIRED_SITE_DIMENSION_MISSING", () => {
    const rules = [density(ev(1, { siteAreaSqm: { min: 623 } }))];
    const outcome = evaluate(rules, "apartment", { parcel: { parcelReferenceId: "p" } });
    if (outcome.result.status !== "DATA_GAP") throw new Error("expected DATA_GAP");
    expect(outcome.result.gaps.map((g) => g.reasonCode)).toEqual(["REQUIRED_SITE_DIMENSION_MISSING"]);
  });

  test("a scope proven not to apply is excluded, and 'no rule' is never 'unlimited'", () => {
    const rules = [uses("house", "apartment"), density(ev(1, APARTMENT))];
    const outcome = evaluate(rules, "house");
    expect(outcome.result.status).not.toBe("DATA_GAP");
    expect(outcome.resolvedMaxFsr).toBeUndefined();
    const findings = evaluateDensity(rules, { parcelReferenceId: "p", siteAreaSqm: 500 }, J, Z, "2026-01-01", undefined, { useCode: "house", recognizedUseCodes: ["house", "apartment"] });
    expect(findings).toHaveLength(1);
    expect(findings[0].outcome).toBe("NO_RULE_FOR_PROPOSAL_SCOPE");
    expect(findings[0].resolvedValue).toBeUndefined();
    expect(findings[0].gap).toBeUndefined();
    expect(findings[0].applicability).toEqual({ applicabilityKeys: ["use=apartment;dwellingUnits=..8"], outcome: "NOT_APPLICABLE", decidingDimensions: ["useCodes"] });
  });

  test("unscoped rules evaluate exactly as before, with or without proposal context", () => {
    const rules = [uses("house"), density(ev(0.75)), height(ev(10))];
    const plain = evaluate(rules, "house");
    const withContext = evaluate(rules, "house", { proposal: { dwellingUnitCount: 3, buildingRole: "rear", tenureCode: "x", frontageMetres: 9 } });
    expect(withContext.result.status).toBe(plain.result.status);
    expect(withContext.resolvedMaxFsr).toEqual(plain.resolvedMaxFsr);
    expect(JSON.stringify(withContext.result.rulesConsidered)).toBe(JSON.stringify(plain.result.rulesConsidered));
  });
});

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("genericity", () => {
  test("no generic applicability, identity or composition file carries jurisdiction vocabulary in code", () => {
    const dir = path.resolve(__dirname, "../../src/zoning-land-use-engine");
    for (const file of [
      "rule-applicability.ts",
      "rule-applicability-types.ts",
      "rule-concept-identity.ts",
      "rule-identity.ts",
      "rule-pack-composer.ts",
      "request-types.ts",
      "finding-types.ts",
      "evidence-types.ts",
      "composition-findings.ts",
      "source-fact-types.ts",
      "data-gap-types.ts",
      "rule-family-types.ts",
      "regulatory-requirement-types.ts",
      "regulatory-requirement.ts",
      "requirement-evaluation.ts",
      "evaluator.ts",
      "evaluator-result-types.ts",
    ]) {
      const code = codeOnly(fs.readFileSync(path.join(dir, file), "utf8"));
      for (const forbidden of [/vancouver/i, /\bR1-1\b/, /ontario/i, /carrall/i, /schedule j/i, /multiplex/i, /rear_building/, /multiple_dwelling/, /social.housing/i, /5920/, /5,920/, /cash.in.lieu/i]) {
        expect({ file, forbidden: String(forbidden), matched: forbidden.test(code) }).toEqual({ file, forbidden: String(forbidden), matched: false });
      }
    }
  });
});

describe("R1-1 freezes on the corrected facts", () => {
  const { vancouverR11Adapter, VANCOUVER_R1_1_SOURCE, VANCOUVER_R1_1_SOURCE_ID, VANCOUVER_R1_1_VERSION_ID } = adapters.vancouver;
  const normalized = () => {
    const result = vancouverR11Adapter.normalize(r11Document(), VANCOUVER_R1_1_SOURCE);
    if (result.outcome !== "NORMALIZED") throw new Error("expected NORMALIZED");
    return result.bundle;
  };

  // PHASE 12C.2/12C.3A: this freeze originally guarded against ANY temporal
  // implementation happening before its own evidence gate closed. That gate
  // is now closed for exactly two proven dates: By-law 14747 (2026-06-30,
  // the current §3.1.1 density/unit-cap/affordable-housing block) and
  // By-law 13817 (2023-10-17, the 13 facts visually proven identical to the
  // original Schedule A text) — so the freeze narrows to: no effectiveTo is
  // ever invented, no OTHER date appears, and every basis is either UNKNOWN
  // or one of these two proven AMENDMENT_DATE_KNOWN values.
  test("no effectiveTo is invented, and every effectiveDateBasis is UNKNOWN or one of the two proven AMENDMENT_DATE_KNOWN dates", () => {
    const serialized = JSON.stringify(normalized().rules);
    expect(serialized).not.toMatch(/"effectiveTo"/);
    const bases = serialized.match(/"effectiveDateBasis":"([A-Z_]+)"/g);
    expect(bases?.every((m) => m.endsWith('"UNKNOWN"') || m.endsWith('"AMENDMENT_DATE_KNOWN"'))).toBe(true);
    expect(bases?.some((m) => m.endsWith('"AMENDMENT_DATE_KNOWN"'))).toBe(true);
    // No manufactured or speculative date anywhere — only the two proven days.
    const dates = new Set([...serialized.matchAll(/"effectiveFrom":"(\d{4}-\d{2}-\d{2})"/g)].map((m) => m[1]));
    expect([...dates].sort()).toEqual(["2023-10-17", "2026-06-30"]);
    // use-005 (Multiple Dwelling) is the one fact deliberately left UNKNOWN
    // even though By-law 13817 was fully reviewed: its current scope differs
    // from the original §2.2.7 rental-tenure qualifier (Phase 12C.3A).
    expect(serialized).not.toMatch(/2026-06-03/);
  });

  test("Phase 11 legal identity is unchanged", () => {
    expect(VANCOUVER_R1_1_SOURCE_ID).toBe("ca-bc-vancouver:zoning-development-bylaw-3575:district-schedule-r1-1");
    expect(VANCOUVER_R1_1_VERSION_ID).toBe("2026-06-consolidation");
    expect(canonicalRulePackFromBundle(normalized(), "BASE").packId).toBe("ca-bc-vancouver:zoning-development-bylaw-3575:district-schedule-r1-1@2026-06-consolidation");
  });
});

/**
 * InvestScape™ E85 Phase 12B.4 — regulatory requirement tests: generic contract,
 * choice semantics, identity, composition, Phase 4 evaluation, and the current
 * R1-1 §3.1.1.3(b)(ii) obligation.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * The generic sections use an invented jurisdiction ("xx-yy-testville") so no
 * behaviour proven there can be an accident of Vancouver data. The R1-1 section
 * uses the curated, offline fixture; a hypothetical dated registry entry (test
 * only — no date is claimed for Vancouver) drives Phase 4 past the temporal gap.
 */
import * as fs from "fs";
import * as path from "path";
import {
  adapters,
  buildE85ConceptKey,
  canonicalE85ApplicabilityKey,
  canonicalRulePackFromBundle,
  composeE85RulePacks,
  decomposeE85Rules,
  e85RequirementIdentity,
  evaluateZoningAndLandUse,
  reassembleE85Rules,
  validateE85RequirementItem,
  validateE85RequirementItems,
  E85DensityRule,
  E85EvaluationRequest,
  E85Evidence,
  E85NormalizedRuleBundle,
  E85PolicyVersion,
  E85Provenance,
  E85RegulatoryRequirement,
  E85RequirementItem,
  E85RequirementQuantity,
  E85RequirementRule,
  E85RuleApplicability,
  E85RulePack,
  E85RuleRecord,
  E85SourceDefinition,
  E85UseRule,
} from "../../src/zoning-land-use-engine";
import {
  r11Document,
  AFFORDABLE_HOUSING_CHOICE_GROUP,
  SITE_WEST_OF_ONTARIO_OR_CARRALL_CONDITION,
  R1_1_FACTS,
  R1_1_MD_LOT_ON_RECORD_OR_SUBDIVIDED_CONDITION,
  R1_1_MD_REAR_VEHICULAR_ACCESS_CONDITION,
  R1_1_MD_NOT_IN_FLOOD_PLAIN_CONDITION,
} from "./fixtures/vancouver-r1-1-facts";

const J = "xx-yy-testville";
const Z = "T-1";

function provenance(section: string, sourceId = `${J}:land-code`): E85Provenance {
  return { sourceId, documentLocator: { bylawOrDocumentId: "LC-1", section } } as E85Provenance;
}

function ev<T>(value: T, applicability?: E85RuleApplicability, section = "1", sourceId?: string): E85Evidence<T> {
  return { value, provenance: provenance(section, sourceId), temporal: { effectiveFrom: "2020-01-01", effectiveDateBasis: "SOURCE_STATED" }, ...(applicability ? { applicability } : {}) };
}

const TRIGGER: E85RuleApplicability = {
  useCodes: ["apartment"],
  excludedTenureCodes: ["rental"],
  siteAreaSqm: { min: 600 },
  frontageMetres: { min: 15 },
  requiredConditionIds: ["inside_area_x"],
};

const PROVIDE: E85RegulatoryRequirement = {
  category: "AFFORDABLE_HOUSING",
  requirementCode: "affordable_floor_area",
  obligationKind: "PROVIDE",
  rawSourceTerminology: "Affordable Floor Area",
  choice: { choiceGroupId: "g1", mode: "ONE_OF" },
};

const PAY: E85RegulatoryRequirement = {
  category: "AFFORDABLE_HOUSING",
  requirementCode: "affordable_payment",
  obligationKind: "PAYMENT_IN_LIEU",
  rawSourceTerminology: "Payment Instead",
  choice: { choiceGroupId: "g1", mode: "ONE_OF" },
  instrumentReferences: [{ role: "QUANTIFICATION", target: { bylawOrDocumentId: "LC-1", schedule: "Rates", section: "4" }, description: "rate table", structured: false }],
};

function quantity(value: number, applicability: E85RuleApplicability | undefined = TRIGGER, section = "1"): E85Evidence<E85RequirementQuantity> {
  return ev({ kind: "MIN_FRACTION_OF_FLOOR_AREA" as const, value, basisTerm: "residential floor area" }, applicability, section);
}

function item(requirement: E85RegulatoryRequirement, quantities?: E85Evidence<E85RequirementQuantity>[], applicability: E85RuleApplicability | undefined = TRIGGER, section = "1", sourceId?: string): E85RequirementItem {
  return { requirement: ev(requirement, applicability, section, sourceId), ...(quantities ? { quantities } : {}) };
}

function requirementRule(...items: E85RequirementItem[]): E85RequirementRule {
  return { family: "REQUIREMENT", jurisdictionId: J, zoneDesignation: Z, requirements: items };
}

function uses(...codes: string[]): E85UseRule {
  return { family: "USE", jurisdictionId: J, zoneDesignation: Z, permissions: codes.map((c) => ev({ useCode: c, status: "PERMITTED" as const })) };
}

const policy = (): E85PolicyVersion => ({ policyVersionId: "req-v1", effectiveFrom: "2020-01-01", concepts: {} });

const TRIGGERED = {
  parcel: { parcelReferenceId: "p", siteAreaSqm: 700 },
  proposal: { dwellingUnitCount: 6, tenureCode: "strata", frontageMetres: 18 },
  callerContext: { satisfiedConditions: ["inside_area_x"] },
};

function evaluate(rules: readonly E85RuleRecord[], extra: Partial<E85EvaluationRequest> = {}) {
  return evaluateZoningAndLandUse({
    jurisdictionId: J,
    zoneDesignation: Z,
    useCode: "apartment",
    asOfDate: "2026-01-01",
    rules,
    requestedAnalyses: ["REQUIREMENT"],
    policyVersion: policy(),
    ...TRIGGERED,
    ...extra,
  });
}

function gapCodes(outcome: ReturnType<typeof evaluate>): string[] {
  return outcome.result.status === "DATA_GAP" ? outcome.result.gaps.map((g) => g.reasonCode).sort() : [];
}

function pack(packId: string, rules: readonly E85RuleRecord[]): E85RulePack {
  return {
    packId,
    jurisdictionId: J,
    zoneDesignation: Z,
    sourceId: `${J}:${packId}`,
    role: "BASE",
    supportedRuleFamilies: [...new Set(rules.map((r) => r.family))],
    rules,
    conditionalRules: [],
  };
}

function composed(packs: E85RulePack[]) {
  const result = composeE85RulePacks(packs, { composedAt: "2026-01-01T00:00:00.000Z" });
  if (result.outcome !== "COMPOSED") throw new Error("expected COMPOSED");
  return result.composed;
}

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/* ================================================================== */

describe("requirement contract", () => {
  test("a well-formed obligation with its quantity validates", () => {
    expect(validateE85RequirementItem(item(PROVIDE, [quantity(0.05)]))).toEqual([]);
    expect(validateE85RequirementItem(item(PAY))).toEqual([]);
  });

  test("identity is <category>:<code>; reserved characters are rejected, never escaped", () => {
    expect(e85RequirementIdentity(PROVIDE)).toBe("AFFORDABLE_HOUSING:affordable_floor_area");
    for (const code of ["a:b", "a#b", "a/b", "a{b", "a]b", "a;b", "a|b", "a=b", " a", ""]) {
      const bad = { ...PROVIDE, requirementCode: code };
      expect(validateE85RequirementItem(item(bad)).length).toBeGreaterThan(0);
      expect(() => e85RequirementIdentity(bad)).toThrow(/Invalid regulatory requirement identity/);
    }
  });

  test("unknown categories, kinds and choice modes are refused", () => {
    expect(validateE85RequirementItem(item({ ...PROVIDE, category: "PUBLIC_ART" as never })).join(" ")).toMatch(/category/);
    expect(validateE85RequirementItem(item({ ...PROVIDE, obligationKind: "DEDICATE" as never })).join(" ")).toMatch(/obligationKind/);
    expect(validateE85RequirementItem(item({ ...PROVIDE, choice: { choiceGroupId: "g1", mode: "AT_LEAST_ONE_OF" as never } })).join(" ")).toMatch(/choice.mode/);
  });

  test("a quantity must be a fraction with a named basis, and must share the obligation's scope", () => {
    expect(validateE85RequirementItem(item(PROVIDE, [quantity(5)])).join(" ")).toMatch(/not a fraction/);
    expect(validateE85RequirementItem(item(PROVIDE, [ev({ kind: "MIN_FRACTION_OF_FLOOR_AREA" as const, value: 0.05, basisTerm: " " }, TRIGGER)])).join(" ")).toMatch(/basisTerm/);
    expect(validateE85RequirementItem(item(PROVIDE, [quantity(0.05, { useCodes: ["house"] })])).join(" ")).toMatch(/scope differs/);
    expect(validateE85RequirementItem(item(PROVIDE, [quantity(0.05), quantity(0.06, TRIGGER, "2")])).join(" ")).toMatch(/more than one/);
  });

  test("one record may not state the same obligation under the same scope twice", () => {
    expect(validateE85RequirementItems([item(PROVIDE), item(PROVIDE, undefined, TRIGGER, "2")]).join(" ")).toMatch(/repeats/);
    expect(validateE85RequirementItems([item(PROVIDE), item(PAY)])).toEqual([]);
  });

  test("the contract has no election-actor field at all", () => {
    const typesSource = codeOnly(fs.readFileSync(path.resolve(__dirname, "../../src/zoning-land-use-engine/regulatory-requirement-types.ts"), "utf8"));
    expect(typesSource).not.toMatch(/elect|chooser|APPLICANT|AUTHORITY/i);
  });
});

describe("concept and quantity identity", () => {
  test("obligation and quantity keys are readable, scope-aware and distinct", () => {
    const { contributions } = decomposeE85Rules([requirementRule(item(PROVIDE, [quantity(0.05)]))], "p");
    const scope = canonicalE85ApplicabilityKey(TRIGGER);
    expect(contributions.map((c) => c.conceptKey).sort()).toEqual([
      `REQUIREMENT:obligationQuantity[AFFORDABLE_HOUSING:affordable_floor_area#MIN_FRACTION_OF_FLOOR_AREA]{${scope}}`,
      `REQUIREMENT:obligation[AFFORDABLE_HOUSING:affordable_floor_area]{${scope}}`,
    ]);
  });

  test("alternatives in one choice group, and different codes, never share a key", () => {
    const keys = decomposeE85Rules([requirementRule(item(PROVIDE), item(PAY))], "p").contributions.map((c) => c.conceptKey);
    expect(new Set(keys).size).toBe(2);
  });

  test("identity ignores array order, wording and provenance", () => {
    const a = decomposeE85Rules([requirementRule(item(PROVIDE), item(PAY))], "p").contributions.map((c) => c.conceptKey).sort();
    const b = decomposeE85Rules([requirementRule(item(PAY), item({ ...PROVIDE, rawSourceTerminology: "other words" }, undefined, TRIGGER, "9.9"))], "p").contributions.map((c) => c.conceptKey).sort();
    expect(b).toEqual(a);
  });

  test("existing non-requirement concept keys are byte-identical", () => {
    const { contributions } = decomposeE85Rules(
      [
        { family: "DENSITY", jurisdictionId: J, zoneDesignation: Z, maxFsr: ev(1) } as E85DensityRule,
        { family: "AMENITY", jurisdictionId: J, zoneDesignation: Z, requirements: { public_art: ev("1%") } },
        uses("house"),
      ],
      "p",
    );
    expect(contributions.map((c) => c.conceptKey).sort()).toEqual(["AMENITY:requirements[public_art]", "DENSITY:maxFsr", "USE:permission[house]"]);
    expect(buildE85ConceptKey("DENSITY", "maxFsr")).toBe("DENSITY:maxFsr");
  });

  test("decompose/reassemble round-trips obligations with their quantities", () => {
    const rules = [requirementRule(item(PROVIDE, [quantity(0.05)]), item(PAY))];
    const { contributions, overlays } = decomposeE85Rules(rules, "p");
    const rebuilt = reassembleE85Rules(contributions, overlays) as E85RequirementRule[];
    expect(rebuilt).toHaveLength(1);
    expect(rebuilt[0].requirements.map((i) => i.requirement.value.requirementCode)).toEqual(["affordable_floor_area", "affordable_payment"]);
    expect(rebuilt[0].requirements[0].quantities?.map((q) => q.value.value)).toEqual([0.05]);
    expect(rebuilt[0].requirements[1].quantities).toBeUndefined();
  });
});

describe("Phase 6 composition of requirements", () => {
  test("same obligation, same scope, same value from independent sources: agreement", () => {
    const c = composed([pack("a", [requirementRule(item(PROVIDE, [quantity(0.05)], TRIGGER, "1", `${J}:a`))]), pack("b", [requirementRule(item(PROVIDE, [quantity(0.05, TRIGGER, "7")], TRIGGER, "7", `${J}:b`))])]);
    expect(c.unresolvedConflicts).toEqual([]);
    expect(c.findings.some((f) => f.code === "INDEPENDENT_AGREEMENT_PRESERVED" && f.family === "REQUIREMENT")).toBe(true);
  });

  test("same obligation, overlapping scope, different quantity: an unresolved conflict — neither the larger nor the smaller wins", () => {
    const c = composed([pack("a", [requirementRule(item(PROVIDE, [quantity(0.05, { useCodes: ["apartment"] })], { useCodes: ["apartment"] }))]), pack("b", [requirementRule(item(PROVIDE, [quantity(0.1, { siteAreaSqm: { min: 600 } })], { siteAreaSqm: { min: 600 } }))])]);
    expect(c.unresolvedConflicts.map((x) => x.conceptKey)).toEqual(["REQUIREMENT:obligationQuantity[AFFORDABLE_HOUSING:affordable_floor_area#MIN_FRACTION_OF_FLOOR_AREA]"]);
    expect(c.suppressed).toEqual([]);
  });

  test("proven-disjoint scopes coexist", () => {
    const c = composed([pack("a", [requirementRule(item(PROVIDE, [quantity(0.05, { useCodes: ["apartment"] })], { useCodes: ["apartment"] }), item(PROVIDE, [quantity(0.1, { useCodes: ["tower"] })], { useCodes: ["tower"] }))])]);
    expect(c.unresolvedConflicts).toEqual([]);
    expect(c.findings.some((f) => f.code === "SCOPED_CONCEPTS_DISJOINT" && f.family === "REQUIREMENT")).toBe(true);
  });

  test("different requirement codes are cumulative, and ONE_OF alternatives coexist as alternatives", () => {
    const art = { ...PROVIDE, requirementCode: "other_obligation", choice: undefined };
    const c = composed([pack("a", [requirementRule(item(PROVIDE, [quantity(0.05)]), item(PAY))]), pack("b", [requirementRule(item(art))])]);
    expect(c.unresolvedConflicts).toEqual([]);
    const effective = c.effectiveRules.filter((r): r is E85RequirementRule => r.family === "REQUIREMENT").flatMap((r) => r.requirements.map((i) => i.requirement.value.requirementCode));
    expect(effective.sort()).toEqual(["affordable_floor_area", "affordable_payment", "other_obligation"]);
  });

  test("ONE_OF versus cumulative for the same obligation does not silently merge: it conflicts and requires review", () => {
    const cumulative = { ...PROVIDE, choice: undefined };
    const c = composed([pack("a", [requirementRule(item(PROVIDE))]), pack("b", [requirementRule(item(cumulative))])]);
    // One scope is stated, so the conflict is reported on the scoped concept key (Phase 12B.2 convention).
    expect(c.unresolvedConflicts.map((x) => x.conceptKey)).toEqual([`REQUIREMENT:obligation[AFFORDABLE_HOUSING:affordable_floor_area]{${canonicalE85ApplicabilityKey(TRIGGER)}}`]);
    expect(c.findings.find((f) => f.code === "AUTHORITATIVE_CONFLICT_UNRESOLVED")?.manualReview?.reasonCode).toBe("CONFLICTING_AUTHORITATIVE_SOURCES");
  });

  test("differing wording or cross-references alone are not a conflict", () => {
    const reworded = { ...PAY, rawSourceTerminology: "Money Instead", instrumentReferences: undefined };
    const c = composed([pack("a", [requirementRule(item(PAY))]), pack("b", [requirementRule(item(reworded, undefined, TRIGGER, "8"))])]);
    expect(c.unresolvedConflicts).toEqual([]);
  });

  test("pack order and item order never change the composed output", () => {
    const a = pack("a", [requirementRule(item(PROVIDE, [quantity(0.05)]), item(PAY))]);
    const b = pack("b", [requirementRule(item({ ...PROVIDE, requirementCode: "x_other", choice: undefined }))]);
    const reversedA = pack("a", [requirementRule(item(PAY), item(PROVIDE, [quantity(0.05)]))]);
    expect(JSON.stringify(composed([b, reversedA]).effectiveRules)).toBe(JSON.stringify(composed([a, b]).effectiveRules));
  });
});

describe("Phase 4 requirement evaluation", () => {
  const rules: E85RuleRecord[] = [uses("apartment", "house"), requirementRule(item(PROVIDE, [quantity(0.05)]), item(PAY))];

  test("a triggered, structured obligation is returned as a sibling output and does not downgrade the result", () => {
    const outcome = evaluate([uses("apartment"), requirementRule(item(PROVIDE, [quantity(0.05)]))]);
    expect(outcome.result.status).toBe("MACHINE_RESOLVED");
    expect(outcome.requirements).toHaveLength(1);
    const [r] = outcome.requirements!;
    expect(r).toMatchObject({ status: "APPLICABLE_STRUCTURED", category: "AFFORDABLE_HOUSING", requirementCode: "affordable_floor_area", conceptKey: "REQUIREMENT:obligation[AFFORDABLE_HOUSING:affordable_floor_area]" });
    expect(r.requirement?.choice).toEqual({ choiceGroupId: "g1", mode: "ONE_OF" });
    expect(r.quantities.map((q) => q.value)).toEqual([{ kind: "MIN_FRACTION_OF_FLOOR_AREA", value: 0.05, basisTerm: "residential floor area" }]);
    expect(r.evidence[0].provenance.sourceId).toBe(`${J}:land-code`);
    expect(r.gap).toBeUndefined();
    expect("envelope" in outcome.result ? outcome.result.envelope : undefined).toBeUndefined();
  });

  test("an obligation whose amount depends on an unstructured instrument is APPLICABLE_QUANTIFICATION_UNRESOLVED, a material RULE_NOT_STRUCTURED gap", () => {
    const outcome = evaluate(rules);
    expect(outcome.result.status).toBe("DATA_GAP");
    expect(gapCodes(outcome)).toEqual(["RULE_NOT_STRUCTURED"]);
    const pay = outcome.requirements!.find((r) => r.requirementCode === "affordable_payment")!;
    expect(pay.status).toBe("APPLICABLE_QUANTIFICATION_UNRESOLVED");
    expect(pay.quantities).toEqual([]);
    expect(pay.gap?.reason).toMatch(/rate table/);
    expect(pay.requirement?.instrumentReferences?.[0]).toMatchObject({ role: "QUANTIFICATION", structured: false });
  });

  test("alternatives are both returned, in a stable order, each saying which choice it belongs to", () => {
    const outcome = evaluate(rules);
    expect(outcome.requirements!.map((r) => [r.requirementCode, r.requirement?.choice?.choiceGroupId])).toEqual([
      ["affordable_floor_area", "g1"],
      ["affordable_payment", "g1"],
    ]);
    expect(JSON.stringify(evaluate([...rules].reverse()).requirements!.map((r) => [r.requirementCode, r.status]))).toBe(JSON.stringify(outcome.requirements!.map((r) => [r.requirementCode, r.status])));
  });

  test("a requirement gap never blocks an analysis that did not request REQUIREMENT", () => {
    const withDensity = [...rules, { family: "DENSITY", jurisdictionId: J, zoneDesignation: Z, maxFsr: ev(1) } as E85DensityRule];
    const outcome = evaluate(withDensity, { requestedAnalyses: ["DENSITY"] });
    expect(outcome.result.status).toBe("MACHINE_RESOLVED");
    expect(outcome.requirements).toBeUndefined();
    expect(evaluate(withDensity, { requestedAnalyses: ["DENSITY", "REQUIREMENT"] }).result.status).toBe("DATA_GAP");
  });

  test.each([
    ["site area below the threshold", { parcel: { parcelReferenceId: "p", siteAreaSqm: 599 } }],
    ["frontage below the threshold", { proposal: { dwellingUnitCount: 6, tenureCode: "strata", frontageMetres: 14.9 } }],
    ["excluded tenure", { proposal: { dwellingUnitCount: 6, tenureCode: "rental", frontageMetres: 18 } }],
    ["external condition explicitly false", { callerContext: { unsatisfiedConditions: ["inside_area_x"] } }],
  ])("not triggered (%s): no requirement is imposed and nothing is a gap", (_label, extra) => {
    const outcome = evaluate(rules, extra as Partial<E85EvaluationRequest>);
    expect(outcome.requirements).toEqual([]);
    expect(outcome.result.status).toBe("MACHINE_RESOLVED");
  });

  test("an external condition neither affirmed nor denied: APPLICABILITY_UNDETERMINED with EXTERNAL_CONDITION_UNDETERMINED — never true, never false", () => {
    const outcome = evaluate(rules, { callerContext: {} });
    expect(outcome.requirements!.map((r) => r.status)).toEqual(["APPLICABILITY_UNDETERMINED", "APPLICABILITY_UNDETERMINED"]);
    expect(gapCodes(outcome)).toEqual(["EXTERNAL_CONDITION_UNDETERMINED", "EXTERNAL_CONDITION_UNDETERMINED"]);
    expect(outcome.requirements![0].applicability?.missingDimensions).toEqual(["requiredConditionIds"]);
  });

  test("a missing proposal attribute is distinguished from an unresolved external condition", () => {
    expect(gapCodes(evaluate(rules, { proposal: { dwellingUnitCount: 6, frontageMetres: 18 } }))).toEqual(["PROPOSAL_CONTEXT_MISSING", "PROPOSAL_CONTEXT_MISSING"]);
    expect(gapCodes(evaluate(rules, { proposal: { dwellingUnitCount: 6, tenureCode: "strata" } }))).toEqual(["REQUIRED_SITE_DIMENSION_MISSING", "REQUIRED_SITE_DIMENSION_MISSING"]);
  });

  test("an obligation whose effective date is unknown is APPLICABILITY_UNDETERMINED with EFFECTIVE_DATE_UNKNOWN", () => {
    const undated: E85RequirementItem = { requirement: { ...ev(PROVIDE, TRIGGER), temporal: { effectiveDateBasis: "UNKNOWN" } } };
    const outcome = evaluate([uses("apartment"), requirementRule(undated)]);
    expect(outcome.requirements![0].status).toBe("APPLICABILITY_UNDETERMINED");
    expect(gapCodes(outcome)).toEqual(["EFFECTIVE_DATE_UNKNOWN"]);
  });

  test("conflicting authoritative statements of one obligation require manual review", () => {
    const outcome = evaluate([uses("apartment"), requirementRule(item(PROVIDE, [quantity(0.05)])), requirementRule(item({ ...PROVIDE, choice: undefined }, [quantity(0.05, TRIGGER, "2")], TRIGGER, "2"))]);
    expect(outcome.result.status).toBe("MANUAL_REVIEW_REQUIRED");
  });

  test("the stated fraction is never applied to any project figure, and nothing is priced", () => {
    const outcome = evaluate(rules);
    const floorArea = outcome.requirements!.find((r) => r.requirementCode === "affordable_floor_area")!;
    expect(floorArea.quantities[0].value.value).toBe(0.05);
    expect(JSON.stringify(outcome.requirements)).not.toMatch(/"(amount|payment|cost|price|dollars|sqm|squareMetres)"\s*:/i);
    const code = codeOnly(fs.readFileSync(path.resolve(__dirname, "../../src/zoning-land-use-engine/requirement-evaluation.ts"), "utf8"));
    expect(code).not.toMatch(/[\w)\]]\s*\*\s*[\w(]/);
    expect(code).not.toMatch(/from\s+["'].*(calc-engine|tax-engine|economic-engine|e86|e87|e88|construction-cost)/i);
  });
});

/* ================================================================== */

const { vancouverR11Adapter, VANCOUVER_R1_1_SOURCE, VANCOUVER_R1_1_SOURCE_ID, VANCOUVER_R1_1_VERSION_ID, VANCOUVER_JURISDICTION, VANCOUVER_JURISDICTION_ID, VANCOUVER_R1_1_ZONE } = adapters.vancouver;

function r11Bundle(source: E85SourceDefinition = VANCOUVER_R1_1_SOURCE): E85NormalizedRuleBundle {
  const result = vancouverR11Adapter.normalize(r11Document(), source);
  if (result.outcome !== "NORMALIZED") throw new Error("expected NORMALIZED");
  return result.bundle;
}

/** HYPOTHETICAL, test-only effective date. No such date is claimed for Vancouver; Phase 12C owns R1-1 temporal authority. */
function hypotheticalDatedSource(): E85SourceDefinition {
  return { ...VANCOUVER_R1_1_SOURCE, versions: [{ versionId: VANCOUVER_R1_1_VERSION_ID, effectiveFrom: "2026-06-15", effectiveDateBasis: "SOURCE_STATED" }], licenseStatus: "PUBLIC_REUSE" };
}

function r11Items(bundle: E85NormalizedRuleBundle): E85RequirementItem[] {
  return bundle.rules.filter((r): r is E85RequirementRule => r.family === "REQUIREMENT").flatMap((r) => r.requirements);
}

const R11_TRIGGER_KEY =
  "use=multiple_dwelling;dwellingUnits=..8;siteAreaSqm=623..;frontageMetres=17.1..;notTenure=residential_rental_tenure_100_percent;conditions=" + SITE_WEST_OF_ONTARIO_OR_CARRALL_CONDITION;

function r11Evaluate(rules: readonly E85RuleRecord[], extra: Partial<E85EvaluationRequest> = {}) {
  return evaluateZoningAndLandUse({
    parcel: { parcelReferenceId: "r11-parcel", jurisdiction: VANCOUVER_JURISDICTION, rawZoningDesignation: VANCOUVER_R1_1_ZONE, siteAreaSqm: 700 },
    jurisdictionId: VANCOUVER_JURISDICTION_ID,
    zoneDesignation: VANCOUVER_R1_1_ZONE,
    useCode: "multiple_dwelling",
    asOfDate: "2026-09-01",
    rules,
    requestedAnalyses: ["REQUIREMENT"],
    policyVersion: policy(),
    proposal: { dwellingUnitCount: 6, tenureCode: "strata", frontageMetres: 18 },
    callerContext: { satisfiedConditions: [SITE_WEST_OF_ONTARIO_OR_CARRALL_CONDITION] },
    ...extra,
  });
}

describe("R1-1 §3.1.1.3(b)(ii) — the normalized obligation", () => {
  const bundle = r11Bundle();

  test("two alternatives of one ONE_OF choice: 5% social housing floor area, or a cash in lieu payment", () => {
    const items = r11Items(bundle);
    expect(items.map((i) => [i.requirement.value.requirementCode, i.requirement.value.obligationKind, i.requirement.value.category])).toEqual([
      ["social_housing_cash_in_lieu", "PAYMENT_IN_LIEU", "AFFORDABLE_HOUSING"],
      ["social_housing_floor_area", "PROVIDE", "AFFORDABLE_HOUSING"],
    ]);
    for (const i of items) expect(i.requirement.value.choice).toEqual({ choiceGroupId: AFFORDABLE_HOUSING_CHOICE_GROUP, mode: "ONE_OF" });
  });

  test("the social housing quantity is a minimum fraction 0.05 of residential floor area, with its own provenance and a declared conversion", () => {
    const sh = r11Items(bundle).find((i) => i.requirement.value.requirementCode === "social_housing_floor_area")!;
    expect(sh.quantities?.map((q) => q.value)).toEqual([{ kind: "MIN_FRACTION_OF_FLOOR_AREA", value: 0.05, basisTerm: "residential floor area" }]);
    expect(sh.quantities![0].provenance.documentLocator).toMatchObject({ bylawOrDocumentId: "3575", schedule: "District Schedule R1-1", section: "3.1.1.3", clause: "(b)(ii)", page: 8 });
    expect(sh.quantities![0].provenance.interpretationNote).toMatch(/divided by 100/);
    expect(sh.requirement.provenance.documentLocator).toMatchObject({ section: "3.1.1.3", clause: "(b)(ii)", page: 8 });
    expect(sh.requirement.value.rawSourceTerminology).toBe("Social Housing");
  });

  test("the trigger is carried entirely by applicability, with a locator for every dimension", () => {
    for (const i of r11Items(bundle)) {
      expect(canonicalE85ApplicabilityKey(i.requirement.applicability)).toBe(R11_TRIGGER_KEY);
      expect(i.requirement.applicability?.locators).toMatchObject({
        useCodes: { section: "3.1", page: 8 },
        dwellingUnits: { section: "3.1", page: 8 },
        excludedTenureCodes: { section: "3.1.1.3", clause: "(b)", page: 8 },
        siteAreaSqm: { section: "3.1.1.3", clause: "(b)(ii)(A)", page: 8 },
        frontageMetres: { section: "3.1.1.3", clause: "(b)(ii)(B)", page: 8 },
        requiredConditionIds: { section: "3.1.1.3", clause: "(b)(ii)(C)", page: 8 },
      });
    }
  });

  test("the cash alternative carries no quantity, only an unstructured Schedule J §8.1.1 reference", () => {
    const cash = r11Items(bundle).find((i) => i.requirement.value.requirementCode === "social_housing_cash_in_lieu")!;
    expect(cash.quantities).toBeUndefined();
    expect(cash.requirement.value.instrumentReferences).toEqual([
      { role: "QUANTIFICATION", target: { bylawOrDocumentId: "3575", schedule: "Schedule J: Affordable Housing Schedule", section: "8.1.1", page: 5 }, description: "cash in lieu rate table", structured: false },
    ]);
  });

  test("the Schedule J rate is NOT structured into the R1-1 bundle, and Schedule J is never attached as a source", () => {
    const serialized = JSON.stringify(bundle);
    expect(serialized).not.toMatch(/5920|5,920|59\.2|6558/);
    const evidences = r11Items(bundle).flatMap((i) => [i.requirement, ...(i.quantities ?? [])]);
    for (const e of evidences) {
      expect(e.provenance.sourceId).toBe(VANCOUVER_R1_1_SOURCE_ID);
      expect(e.provenance.sourceVersionId).toBe(VANCOUVER_R1_1_VERSION_ID);
      expect(e.provenance.documentLocator?.schedule).toBe("District Schedule R1-1");
    }
    expect(evidences.flatMap((e) => (typeof e.value === "object" && e.value !== null && "value" in e.value ? [(e.value as E85RequirementQuantity).value] : []))).toEqual([0.05]);
  });

  test("no election actor is invented when neither clause names one", () => {
    expect(JSON.stringify(r11Items(bundle))).not.toMatch(/elect|chooser|APPLICANT|"AUTHORITY"|Director/i);
    for (const i of r11Items(bundle)) expect(Object.keys(i.requirement.value).sort()).toEqual(expect.arrayContaining(["category", "obligationKind", "rawSourceTerminology", "requirementCode"]));
    for (const i of r11Items(bundle)) expect(Object.keys(i.requirement.value).every((k) => ["category", "requirementCode", "obligationKind", "rawSourceTerminology", "choice", "instrumentReferences"].includes(k))).toBe(true);
  });

  // PHASE 12C.2: the entire §3.1.1.3(b)(ii) obligation — both alternatives and
  // the 5% quantity — was created by By-law 14747's wholesale §3.1.1
  // replacement, proven effective 2026-06-30 (§37). No longer UNKNOWN.
  test("every requirement evidence item carries the proven 2026-06-30 amendment date, with no effectiveTo", () => {
    const evidences = r11Items(bundle).flatMap((i) => [i.requirement, ...(i.quantities ?? [])]);
    expect(evidences).toHaveLength(3);
    for (const e of evidences) expect(e.temporal).toEqual({ effectiveFrom: "2026-06-30", effectiveDateBasis: "AMENDMENT_DATE_KNOWN" });
  });

  test("the §3.1.1.3(b)(ii) coverage gap is gone; §3.1.1.4 and §3.2.2.10 remain declared gaps", () => {
    const sections = bundle.findings.filter((f) => f.code === "SOURCE_SECTION_UNAVAILABLE").map((f) => f.message);
    expect(sections.some((m) => /3\.1\.1\.3\(b\)\(ii\)/.test(m))).toBe(false);
    expect(sections.some((m) => /3\.1\.1\.4/.test(m))).toBe(true);
    expect(sections.some((m) => /3\.2\.2\.10/.test(m))).toBe(true);
    expect(bundle.readiness.blockers).toContain("STRUCTURE");
  });

  test("R1-1 legal identity is unchanged", () => {
    expect(VANCOUVER_R1_1_SOURCE_ID).toBe("ca-bc-vancouver:zoning-development-bylaw-3575:district-schedule-r1-1");
    expect(VANCOUVER_R1_1_VERSION_ID).toBe("2026-06-consolidation");
    expect(canonicalRulePackFromBundle(bundle, "BASE").packId).toBe("ca-bc-vancouver:zoning-development-bylaw-3575:district-schedule-r1-1@2026-06-consolidation");
  });
});

describe("R1-1 corrected printed-page locators (visually verified against the June 2026 schedule)", () => {
  const EXPECTED: Record<string, number> = { "2.1:Duplex": 2, "2.1:Duplex with Secondary Suite": 2, "2.1:Multiple Dwelling, containing no more than 8 dwelling units": 3, "2.1:Single Detached House": 3, "3.1.1.2": 8, "3.1.1.3": 8, "3.1.2.5": 9, "3.1.2.6": 9, "3.2.1.1": 12, "3.2.2.3": 12, "3.2.2.4": 12, "3.2.2.7": 12 };

  test("every fact cites the printed page its provision is on", () => {
    for (const fact of R1_1_FACTS) {
      const key = fact.locator.section === "2.1" ? `2.1:${fact.locator.row}` : fact.locator.section!;
      expect({ factId: fact.factId, key, page: fact.locator.page }).toEqual({ factId: fact.factId, key, page: EXPECTED[key] });
    }
  });

  test("§3.1 and §3.2 heading locators are pages 8 and 12", () => {
    const pages = R1_1_FACTS.flatMap((f) => Object.values(f.applicability?.locators ?? {})).filter((l) => l.section === "3.1" || l.section === "3.2");
    for (const l of pages) expect(l.page).toBe(l.section === "3.1" ? 8 : 12);
  });
});

describe("R1-1 §3.1.1.3(b)(ii) — Phase 4 for proposals (hypothetical dated control)", () => {
  const rules = r11Bundle(hypotheticalDatedSource()).rules;

  test("a triggering proposal gets both alternatives: social housing structured, cash in lieu unresolved — a material DATA_GAP", () => {
    const outcome = r11Evaluate(rules);
    expect(outcome.requirements!.map((r) => [r.requirementCode, r.status])).toEqual([
      ["social_housing_cash_in_lieu", "APPLICABLE_QUANTIFICATION_UNRESOLVED"],
      ["social_housing_floor_area", "APPLICABLE_STRUCTURED"],
    ]);
    expect(outcome.requirements![1].quantities[0].value.value).toBe(0.05);
    expect(outcome.result.status).toBe("DATA_GAP");
    expect(gapCodes(outcome)).toEqual(["RULE_NOT_STRUCTURED"]);
    expect(outcome.requirements![0].gap?.reason).toMatch(/Schedule J: Affordable Housing Schedule, 8\.1\.1, page 5/);
  });

  test.each([
    ["100% residential rental tenure", { proposal: { dwellingUnitCount: 6, tenureCode: "residential_rental_tenure_100_percent", frontageMetres: 18 } }],
    ["site area 622 m²", { parcel: { parcelReferenceId: "r11-parcel", siteAreaSqm: 622 } }],
    ["frontage 17.0 m", { proposal: { dwellingUnitCount: 6, tenureCode: "strata", frontageMetres: 17.0 } }],
    ["site explicitly not west of the centre lines", { callerContext: { unsatisfiedConditions: [SITE_WEST_OF_ONTARIO_OR_CARRALL_CONDITION] } }],
    ["a single detached house", { useCode: "single_detached_house" }],
  ])("not triggered: %s", (_label, extra) => {
    const outcome = r11Evaluate(rules, extra as Partial<E85EvaluationRequest>);
    expect(outcome.requirements).toEqual([]);
    expect(outcome.result.status).toBe("MACHINE_RESOLVED");
  });

  test("thresholds are inclusive: exactly 623 m² and 17.1 m trigger the obligation", () => {
    const outcome = r11Evaluate(rules, { parcel: { parcelReferenceId: "r11-parcel", siteAreaSqm: 623 }, proposal: { dwellingUnitCount: 6, tenureCode: "strata", frontageMetres: 17.1 } });
    expect(outcome.requirements).toHaveLength(2);
  });

  test("an unresolved geographic condition is EXTERNAL_CONDITION_UNDETERMINED, not treated as true or false", () => {
    const outcome = r11Evaluate(rules, { callerContext: {} });
    expect(outcome.requirements!.map((r) => r.status)).toEqual(["APPLICABILITY_UNDETERMINED", "APPLICABILITY_UNDETERMINED"]);
    expect(gapCodes(outcome)).toEqual(["EXTERNAL_CONDITION_UNDETERMINED", "EXTERNAL_CONDITION_UNDETERMINED"]);
  });

  test("missing tenure, unit count or frontage is a DATA_GAP naming the proposal fact", () => {
    expect(gapCodes(r11Evaluate(rules, { proposal: { dwellingUnitCount: 6, frontageMetres: 18 } }))).toEqual(["PROPOSAL_CONTEXT_MISSING", "PROPOSAL_CONTEXT_MISSING"]);
    expect(gapCodes(r11Evaluate(rules, { proposal: { tenureCode: "strata", frontageMetres: 18 } }))).toEqual(["PROPOSAL_CONTEXT_MISSING", "PROPOSAL_CONTEXT_MISSING"]);
    expect(gapCodes(r11Evaluate(rules, { proposal: { dwellingUnitCount: 6, tenureCode: "strata" } }))).toEqual(["REQUIRED_SITE_DIMENSION_MISSING", "REQUIRED_SITE_DIMENSION_MISSING"]);
  });

  test("the requirement gap does not reach a USE/DENSITY/DIMENSIONAL-only request", () => {
    // PHASE 12C.4A: use-005's own §2.2.7 conditions are affirmed alongside the
    // pre-existing SITE_WEST_OF_ONTARIO_OR_CARRALL_CONDITION affirmation, so
    // this test's actual subject (the REQUIREMENT gap staying scoped to
    // REQUIREMENT-only requests) is exercised without also tripping over the
    // unrelated, still-real USE site-eligibility gate.
    const outcome = r11Evaluate(rules, {
      requestedAnalyses: ["USE", "DENSITY", "DIMENSIONAL"],
      proposal: { dwellingUnitCount: 6, tenureCode: "strata", frontageMetres: 18, buildingRole: "principal_building" },
      callerContext: {
        satisfiedConditions: [
          SITE_WEST_OF_ONTARIO_OR_CARRALL_CONDITION,
          R1_1_MD_LOT_ON_RECORD_OR_SUBDIVIDED_CONDITION,
          R1_1_MD_REAR_VEHICULAR_ACCESS_CONDITION,
          R1_1_MD_NOT_IN_FLOOD_PLAIN_CONDITION,
        ],
      },
    });
    expect(outcome.requirements).toBeUndefined();
    expect(outcome.result.status).not.toBe("DATA_GAP");
    expect(outcome.resolvedMaxFsr?.value).toBe(1.0);
  });

  // PHASE 12C.2: at the target 2026-09-01 asOf, the obligation's now-proven
  // 2026-06-30 effective date makes it in force. The social-housing
  // alternative fully resolves; the cash-in-lieu alternative still cannot
  // resolve, but for an entirely different, pre-existing reason — its
  // Schedule J rate remains deliberately unstructured (RULE_NOT_STRUCTURED),
  // never EFFECTIVE_DATE_UNKNOWN.
  test("at the target date, the social-housing alternative resolves and the cash-in-lieu alternative reports its pre-existing Schedule J quantification gap — neither is EFFECTIVE_DATE_UNKNOWN", () => {
    const outcome = r11Evaluate(r11Bundle().rules);
    expect(outcome.requirements!.map((r) => r.status).sort()).toEqual(["APPLICABLE_QUANTIFICATION_UNRESOLVED", "APPLICABLE_STRUCTURED"]);
    expect(gapCodes(outcome)).not.toContain("EFFECTIVE_DATE_UNKNOWN");
    expect(gapCodes(outcome)).toContain("RULE_NOT_STRUCTURED");
  });

  // Before the proven effective date, the current obligation is not yet in
  // force and no historical predecessor is structured: the honest answer is
  // an unresolved historical gap, never "no requirement" and never the
  // current values applied retroactively.
  test("before 2026-06-30, the current obligation is not yet in force and reports an unresolved historical gap, never a silent absence", () => {
    const outcome = r11Evaluate(r11Bundle().rules, { asOfDate: "2026-06-29" });
    expect(outcome.requirements!.map((r) => r.status)).toEqual(["APPLICABILITY_UNDETERMINED", "APPLICABILITY_UNDETERMINED"]);
    expect(gapCodes(outcome)).toEqual(["RULE_NOT_STRUCTURED", "RULE_NOT_STRUCTURED"]);
  });

  test("composition carries the obligation through unchanged, with no conflict", () => {
    const c = composed([{ ...pack("r11", r11Bundle(hypotheticalDatedSource()).rules), jurisdictionId: VANCOUVER_JURISDICTION_ID, zoneDesignation: VANCOUVER_R1_1_ZONE }]);
    expect(c.unresolvedConflicts).toEqual([]);
    expect(r11Evaluate(c.effectiveRules).requirements!.map((r) => r.status)).toEqual(["APPLICABLE_QUANTIFICATION_UNRESOLVED", "APPLICABLE_STRUCTURED"]);
  });

  // PHASE 12C.2A §19 — the actual Phase 12 target date, not a stand-in.
  test("at the exact target date 2026-09-14, dated evidence resolves and no dated fact reports EFFECTIVE_DATE_UNKNOWN", () => {
    const outcome = r11Evaluate(r11Bundle().rules, { asOfDate: "2026-09-14" });
    expect(outcome.requirements!.map((r) => r.status).sort()).toEqual(["APPLICABLE_QUANTIFICATION_UNRESOLVED", "APPLICABLE_STRUCTURED"]);
    expect(gapCodes(outcome)).not.toContain("EFFECTIVE_DATE_UNKNOWN");
    expect(gapCodes(outcome)).toContain("RULE_NOT_STRUCTURED");
  });

  // PHASE 12C.2A §20 — the 14586 definition-dependency date (2026-02-03) must
  // never become a usable effectiveFrom for requirement-001/002: querying
  // exactly that date must still find the current obligation not yet in force.
  test("2026-02-03 (the 14586 dependency date) does not activate the current obligation", () => {
    const outcome = r11Evaluate(r11Bundle().rules, { asOfDate: "2026-02-03" });
    expect(outcome.requirements!.map((r) => r.status)).toEqual(["APPLICABILITY_UNDETERMINED", "APPLICABILITY_UNDETERMINED"]);
    expect(gapCodes(outcome)).toEqual(["RULE_NOT_STRUCTURED", "RULE_NOT_STRUCTURED"]);
    // The dependency note is visible in normalized-bundle audit output, but purely as INFO — never as what makes the obligation current.
    // PHASE 12C.4B: use-005 now also carries its own (unrelated) note, so 2 SOURCE_NOTE_PRESERVED findings exist; this one is requirement-001's.
    const noteFindings = r11Bundle().findings.filter((f) => f.code === "SOURCE_NOTE_PRESERVED" && f.factId === "r1-1-requirement-001");
    expect(noteFindings).toHaveLength(1);
    expect(noteFindings[0].message).toMatch(/2026-02-03/);
  });
});

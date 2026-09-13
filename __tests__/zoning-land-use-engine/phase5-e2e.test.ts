/**
 * InvestScape™ E85 Phase 5 — end-to-end pilot: curated R1-1 source facts →
 * Vancouver adapter → normalized bundle → Phase 4 evaluator → regulatory
 * result.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Entirely offline: no network, no PDF, no local evidence folder, no GIS. The
 * point being proved is that the Phase 4 evaluator is unchanged and knows
 * nothing about Vancouver — it receives a plain `E85RuleRecord[]` and could
 * not tell which municipality produced it.
 */
import * as fs from "fs";
import * as path from "path";
import {
  createE85AdapterRegistry,
  createE85SourceRegistry,
  normalizeSourceDocument,
  selectRulesForAffirmedConditions,
  pendingConditions,
  evaluateZoningAndLandUse,
  E85EvaluationRequest,
  E85NormalizedRuleBundle,
  E85ParcelReference,
  E85PolicyVersion,
  E85SourceDefinition,
  adapters,
} from "../../src/zoning-land-use-engine";
import { r11Document, REAR_BUILDING_CONDITION } from "./fixtures/vancouver-r1-1-facts";

const { vancouverR11Adapter, VANCOUVER_R1_1_SOURCE, VANCOUVER_JURISDICTION, VANCOUVER_JURISDICTION_ID, VANCOUVER_R1_1_ZONE, VANCOUVER_R1_1_ADAPTER_ID } = adapters.vancouver;

const SITE_AREA_SQM = 400;

function policy(): E85PolicyVersion {
  return { policyVersionId: "phase5-pilot-v1", effectiveFrom: "2020-01-01", concepts: {} };
}

function parcel(): E85ParcelReference {
  return {
    parcelReferenceId: "pilot-parcel-1",
    jurisdiction: VANCOUVER_JURISDICTION,
    rawZoningDesignation: VANCOUVER_R1_1_ZONE,
    siteAreaSqm: SITE_AREA_SQM,
  };
}

/** Acquisition and extraction happen outside E85; this is where their output enters. */
function normalizeR11(source: E85SourceDefinition = VANCOUVER_R1_1_SOURCE): E85NormalizedRuleBundle {
  const sources = createE85SourceRegistry([source]);
  const adapterReg = createE85AdapterRegistry([vancouverR11Adapter]);
  if (!sources.ok || !adapterReg.ok) throw new Error("registries should build");
  const result = normalizeSourceDocument(r11Document(), sources.registry, adapterReg.registry);
  if (result.outcome !== "NORMALIZED") throw new Error(`expected NORMALIZED, got ${result.outcome}`);
  return result.bundle;
}

/**
 * A HYPOTHETICAL registry entry, used only to drive the pipeline past the
 * temporal gap so the machinery downstream of it can be exercised.
 *
 * NO SUCH DATE IS CLAIMED FOR VANCOUVER. The real R1-1 schedule states no
 * effective date at all (see VANCOUVER_R1_1_SOURCE), which is why the pilot
 * bundle gaps on it. This variant differs from the real source in exactly one
 * respect — the registry states an effective date — which is what makes it a
 * clean control: everything that changes between the two suites below is
 * attributable to that one fact, and to nothing about the adapter.
 */
const DATED_EFFECTIVE_FROM = "2026-06-15";
function hypotheticalDatedSource(): E85SourceDefinition {
  return {
    ...VANCOUVER_R1_1_SOURCE,
    versions: [{ versionId: VANCOUVER_R1_1_SOURCE.versions[0].versionId, effectiveFrom: DATED_EFFECTIVE_FROM, effectiveDateBasis: "SOURCE_STATED" }],
    licenseStatus: "PUBLIC_REUSE",
  };
}

function evaluate(request: Partial<E85EvaluationRequest> & Pick<E85EvaluationRequest, "rules" | "useCode">) {
  return evaluateZoningAndLandUse({
    parcel: parcel(),
    jurisdictionId: VANCOUVER_JURISDICTION_ID,
    zoneDesignation: VANCOUVER_R1_1_ZONE,
    asOfDate: "2026-09-01",
    requestedAnalyses: ["USE", "DENSITY", "DIMENSIONAL"],
    policyVersion: policy(),
    ...request,
  });
}

/**
 * THE REAL PILOT SOURCE. The R1-1 schedule states no effective date, so the
 * honest end-to-end answer is: adaptation succeeds completely, provenance
 * survives completely, and Phase 4 declines to assert the rules were in force.
 * That last part is the feature — a fabricated date here would have bought a
 * MACHINE_RESOLVED status with a legal claim behind it that no document makes.
 */
describe("E85 Phase 5 end-to-end — R1-1 facts through the adapter into Phase 4", () => {
  const bundle = normalizeR11();

  test("adaptation succeeds in full: every rule family normalizes", () => {
    expect(bundle.rules.map((r) => r.family).sort()).toEqual(["DENSITY", "DIMENSIONAL", "USE"]);
    expect(bundle.unresolvedSourceItems).toEqual([]);
    // No source FACT failed to normalize; the only gap is the document-level
    // one about its effective date.
    expect(bundle.findings.filter((f) => f.severity === "GAP" && f.factId !== undefined)).toEqual([]);
  });

  test("the one gap is the effective date, reported as such", () => {
    const gaps = bundle.findings.filter((f) => f.severity === "GAP");
    expect(gaps).toHaveLength(1);
    expect(gaps[0].gap?.reasonCode).toBe("EFFECTIVE_DATE_UNKNOWN");
    expect(bundle.temporal).toEqual({ effectiveDateBasis: "UNKNOWN" });
  });

  test("Phase 4 reports the temporal uncertainty rather than resolving through it", () => {
    const outcome = evaluate({ rules: bundle.rules, useCode: "one_family_dwelling" });
    expect(outcome.result.status).toBe("DATA_GAP");
    if (outcome.result.status !== "DATA_GAP") return;
    expect(outcome.result.gaps.map((g) => g.reasonCode)).toContain("EFFECTIVE_DATE_UNKNOWN");
  });

  test("no rule value is asserted while its effective date is unestablished", () => {
    const outcome = evaluate({ rules: bundle.rules, useCode: "one_family_dwelling" });
    expect(outcome.usePermission).toBeUndefined();
    expect(outcome.resolvedMaxFsr).toBeUndefined();
    // Nothing partial leaks into an envelope either.
    expect("envelope" in outcome.result ? outcome.result.envelope : undefined).toBeUndefined();
  });

  test("the parcel and its identity still round-trip through the gapped result", () => {
    const outcome = evaluate({ rules: bundle.rules, useCode: "one_family_dwelling" });
    expect(outcome.result.parcel.parcelReferenceId).toBe("pilot-parcel-1");
    expect(outcome.result.qualification.parcelMatch).toBe("high");
  });

  test("full provenance survives on the normalized rules regardless of the temporal gap", () => {
    const dim = bundle.rules.find((r) => r.family === "DIMENSIONAL");
    const p = dim && "maxHeightMetres" in dim ? dim.maxHeightMetres?.provenance : undefined;
    expect(p?.sourceId).toBe(VANCOUVER_R1_1_SOURCE.sourceId);
    expect(p?.sourceVersionId).toBe("2026-06-consolidation");
    expect(p?.adapterId).toBe(VANCOUVER_R1_1_ADAPTER_ID);
    expect(p?.documentLocator?.section).toBe("3.2.2.3");
    expect(p?.documentLocator?.page).toBe(4);
  });

  test("no architectural massing or financial figure appears in the result", () => {
    const outcome = evaluate({ rules: bundle.rules, useCode: "one_family_dwelling" });
    const serialized = JSON.stringify(outcome).toLowerCase();
    for (const forbidden of ["netsellablearea", "netrentablearea", "netbuildablearea", "massing", "revenue", "irr", "residuallandvalue", "constructioncost"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

/**
 * THE CONTROL. Identical extract, identical adapter, identical evaluator — the
 * one difference is a registry that states an effective date. Everything the
 * pilot withholds above resolves here, which localizes the withholding to the
 * missing evidence and proves the pipeline itself is sound end-to-end.
 */
describe("E85 Phase 5 end-to-end — the same pipeline resolves fully once an effective date exists", () => {
  const bundle = normalizeR11(hypotheticalDatedSource());

  test("the bundle is ready and gap-free when the source states its dates and licence", () => {
    expect(bundle.readiness.overall).toBe("READY");
    expect(bundle.findings.some((f) => f.severity === "GAP")).toBe(false);
    expect(bundle.temporal).toEqual({ effectiveFrom: DATED_EFFECTIVE_FROM, effectiveDateBasis: "SOURCE_STATED" });
  });

  test("an outright-approval use evaluates to PERMITTED", () => {
    const outcome = evaluate({ rules: bundle.rules, useCode: "one_family_dwelling" });
    expect(outcome.usePermission?.status).toBe("PERMITTED");
  });

  test("a conditional-approval use evaluates to CONDITIONAL and keeps the approving authority", () => {
    const outcome = evaluate({ rules: bundle.rules, useCode: "multiple_dwelling" });
    expect(outcome.usePermission?.status).toBe("CONDITIONAL");
    const ev = outcome.usePermission?.evidence;
    expect(ev?.value.approvalAuthority).toBe("Director of Planning");
    expect(ev?.value.rawSourceTerminology).toBe("Conditional Approval Use");
  });

  test("FSR resolves and yields a theoretical regulatory GFA from the supplied site area", () => {
    const outcome = evaluate({ rules: bundle.rules, useCode: "one_family_dwelling" });
    expect(outcome.resolvedMaxFsr?.value).toBe(1.0);
    const envelope = "envelope" in outcome.result ? outcome.result.envelope : undefined;
    expect(envelope?.envelope.maxRegulatoryGfaSqm?.value).toBe(1.0 * SITE_AREA_SQM);
  });

  test("height, storeys, setbacks and coverage all reach the regulatory envelope", () => {
    const outcome = evaluate({ rules: bundle.rules, useCode: "one_family_dwelling" });
    const envelope = ("envelope" in outcome.result ? outcome.result.envelope : undefined)?.envelope;
    expect(envelope?.maxHeightMetres?.value).toBe(11.5);
    expect(envelope?.maxStoreys?.value).toBe(3);
    expect(envelope?.setbacksMetres?.front.value).toBe(4.9);
    expect(envelope?.maxSiteCoverageFraction?.value).toBe(0.5);
  });

  test("the result is a genuine E85Result and resolves rather than gapping", () => {
    const outcome = evaluate({ rules: bundle.rules, useCode: "one_family_dwelling" });
    expect(["MACHINE_RESOLVED", "MACHINE_RESOLVED_WITH_WARNINGS"]).toContain(outcome.result.status);
    expect(outcome.result.qualification.parcelMatch).toBe("high");
  });

  test("provenance survives all the way into the evaluated result", () => {
    const outcome = evaluate({ rules: bundle.rules, useCode: "one_family_dwelling" });
    const envelope = ("envelope" in outcome.result ? outcome.result.envelope : undefined)?.envelope;
    const p = envelope?.maxHeightMetres?.provenance;
    expect(p?.sourceId).toBe(VANCOUVER_R1_1_SOURCE.sourceId);
    expect(p?.sourceVersionId).toBe("2026-06-consolidation");
    expect(p?.adapterId).toBe(VANCOUVER_R1_1_ADAPTER_ID);
    expect(p?.documentLocator?.section).toBe("3.2.2.3");
  });

  test("an as-of date before the stated effective date is NOT resolved as in force", () => {
    const outcome = evaluate({ rules: bundle.rules, useCode: "one_family_dwelling", asOfDate: "2026-06-01" });
    // 2026-06-01 precedes the stated 2026-06-15 — precisely the distinction a
    // fabricated first-of-the-month effective date would have erased.
    expect(outcome.resolvedMaxFsr).toBeUndefined();
  });
});

/**
 * Scans CODE, not documentation. Phase 4 files legitimately explain their
 * jurisdiction-neutrality in prose — applicability.ts, for instance, says it
 * will not normalize "R1-1" toward "R1" — and a check that failed on the
 * explanation would only teach people to delete explanations.
 */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("E85 Phase 5 end-to-end — the evaluator contains no Vancouver knowledge", () => {
  test("no Phase 4 core evaluator file mentions Vancouver, R1-1, or any adapter in its code", () => {
    const dir = path.resolve(__dirname, "../../src/zoning-land-use-engine");
    const coreFiles = [
      "evaluator.ts",
      "use-evaluation.ts",
      "density-evaluation.ts",
      "dimensional-evaluation.ts",
      "parking-amenity-evaluation.ts",
      "overlay-evaluation.ts",
      "envelope-assembly.ts",
      "result-status.ts",
      "applicability.ts",
      "conflict-detection.ts",
      "qualification-derivation.ts",
    ];
    for (const file of coreFiles) {
      const content = codeOnly(fs.readFileSync(path.join(dir, file), "utf8"));
      expect({ file, matched: /vancouver/i.test(content) }).toEqual({ file, matched: false });
      expect({ file, matched: /\bR1-1\b/.test(content) }).toEqual({ file, matched: false });
      expect({ file, matched: /Outright Approval/i.test(content) }).toEqual({ file, matched: false });
      expect({ file, matched: /Director of Planning/i.test(content) }).toEqual({ file, matched: false });
      expect({ file, matched: /from\s+["'].*adapters/.test(content) }).toEqual({ file, matched: false });
    }
  });

  test("core rule/use enums contain no jurisdiction-specific member", () => {
    const dir = path.resolve(__dirname, "../../src/zoning-land-use-engine");
    for (const file of ["use-taxonomy.ts", "rule-family-types.ts"]) {
      const content = fs.readFileSync(path.join(dir, file), "utf8");
      // Vancouver terms may be discussed in prose, but never as a union member.
      expect(content).not.toMatch(/\|\s*"Outright Approval Use"/);
      expect(content).not.toMatch(/\|\s*"R1-1"/);
      expect(content).not.toMatch(/\|\s*"CD-1"/);
    }
  });

  test("the same evaluator resolves an invented jurisdiction identically in shape", () => {
    // Uses the dated control source: this test is about jurisdiction
    // neutrality, and a temporal gap would mask the thing being proved.
    const bundle = normalizeR11(hypotheticalDatedSource());
    const relabelled = JSON.parse(JSON.stringify(bundle.rules).split("ca-bc-vancouver").join("xx-yy-elsewhere").split("R1-1").join("ZZ-9"));
    const outcome = evaluateZoningAndLandUse({
      parcel: { parcelReferenceId: "p", siteAreaSqm: SITE_AREA_SQM },
      jurisdictionId: "xx-yy-elsewhere",
      zoneDesignation: "ZZ-9",
      useCode: "one_family_dwelling",
      asOfDate: "2026-09-01",
      rules: relabelled,
      requestedAnalyses: ["USE", "DENSITY", "DIMENSIONAL"],
      policyVersion: policy(),
    });
    expect(outcome.usePermission?.status).toBe("PERMITTED");
    expect(outcome.resolvedMaxFsr?.value).toBe(1.0);
  });
});

/**
 * Condition handling is orthogonal to the temporal question, so these run on
 * the dated control source — otherwise every assertion below would be masked by
 * the effective-date gap rather than testing condition semantics.
 */
describe("E85 Phase 5 end-to-end — conditional rules never apply themselves", () => {
  const bundle = normalizeR11(hypotheticalDatedSource());

  test("the bundle names the condition it is waiting on", () => {
    expect(pendingConditions(bundle)).toEqual([REAR_BUILDING_CONDITION]);
  });

  test("without affirmation, the conditional height is absent from the evaluation entirely", () => {
    const outcome = evaluate({ rules: bundle.rules, useCode: "one_family_dwelling" });
    const envelope = ("envelope" in outcome.result ? outcome.result.envelope : undefined)?.envelope;
    expect(envelope?.maxHeightMetres?.value).toBe(11.5);
    expect(JSON.stringify(outcome)).not.toContain("8.5");
  });

  test("affirming the condition is what admits the conditional rule — and the evaluator then refuses to pick a winner", () => {
    const withCondition = selectRulesForAffirmedConditions(bundle, [REAR_BUILDING_CONDITION]);
    expect(withCondition.length).toBe(bundle.rules.length + 1);

    const outcome = evaluate({ rules: withCondition, useCode: "one_family_dwelling" });
    // Two authoritative heights now apply (11.5 m generally, 8.5 m for a rear
    // building). Phase 4 escalates rather than silently preferring either,
    // which is exactly the behaviour that makes affirming a condition safe.
    expect(outcome.result.status).toBe("MANUAL_REVIEW_REQUIRED");
    if (outcome.result.status !== "MANUAL_REVIEW_REQUIRED") return;
    expect(outcome.result.reasons.map((r) => r.reasonCode)).toContain("CONFLICTING_AUTHORITATIVE_SOURCES");
  });

  test("affirming an unrelated condition admits nothing", () => {
    expect(selectRulesForAffirmedConditions(bundle, ["some other condition"])).toEqual(bundle.rules);
  });

  test("condition matching is exact — no fuzzy or case-insensitive match", () => {
    expect(selectRulesForAffirmedConditions(bundle, [REAR_BUILDING_CONDITION.toUpperCase()])).toEqual(bundle.rules);
    expect(selectRulesForAffirmedConditions(bundle, ["rear building"])).toEqual(bundle.rules);
  });

  test("selection does not mutate the bundle", () => {
    const before = JSON.stringify(bundle);
    selectRulesForAffirmedConditions(bundle, [REAR_BUILDING_CONDITION]);
    expect(JSON.stringify(bundle)).toBe(before);
  });
});

describe("E85 Phase 5 end-to-end — repeated evaluation is stable", () => {
  test("normalizing and evaluating twice yields the same regulatory answer", () => {
    const first = evaluate({ rules: normalizeR11(hypotheticalDatedSource()).rules, useCode: "one_family_dwelling" });
    const second = evaluate({ rules: normalizeR11(hypotheticalDatedSource()).rules, useCode: "one_family_dwelling" });
    expect(first.resolvedMaxFsr?.value).toBe(second.resolvedMaxFsr?.value);
    expect(first.usePermission).toEqual(second.usePermission);
    expect(first.result.status).toBe(second.result.status);
  });

  test("the pilot source's own gapped answer is equally stable across runs", () => {
    const first = evaluate({ rules: normalizeR11().rules, useCode: "one_family_dwelling" });
    const second = evaluate({ rules: normalizeR11().rules, useCode: "one_family_dwelling" });
    expect(first.result.status).toBe("DATA_GAP");
    expect(first.result.status).toBe(second.result.status);
    if (first.result.status !== "DATA_GAP" || second.result.status !== "DATA_GAP") return;
    expect(first.result.gaps.map((g) => g.reasonCode)).toEqual(second.result.gaps.map((g) => g.reasonCode));
  });

  test("a use the extract never mentions resolves to UNKNOWN, never PROHIBITED", () => {
    const outcome = evaluate({ rules: normalizeR11().rules, useCode: "child_day_care_facility" });
    expect(outcome.usePermission?.status).toBe("UNKNOWN");
  });
});

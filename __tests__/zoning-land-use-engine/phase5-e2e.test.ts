/**
 * InvestScape™ E85 Phase 5 / Phase 12B.2 — end-to-end pilot: curated R1-1
 * source facts → Vancouver adapter → normalized bundle → Phase 4 evaluator →
 * regulatory result.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Entirely offline: no network, no PDF, no local evidence folder, no GIS. The
 * point being proved is that the Phase 4 evaluator knows nothing about
 * Vancouver — it receives a plain `E85RuleRecord[]` and a proposal context and
 * could not tell which municipality produced the rules.
 *
 * Phase 12B.2: the corrected R1-1 facts are scoped, so every end-to-end answer
 * depends on WHICH proposal is asked about. A single detached house, a duplex
 * and a multiple dwelling get different FSRs; a rear building gets a different
 * height; an unknown use gets no scoped value at all.
 */
import * as fs from "fs";
import * as path from "path";
import {
  buildE85ApplicabilityContext,
  createE85AdapterRegistry,
  createE85SourceRegistry,
  evaluateDensity,
  normalizeSourceDocument,
  pendingConditions,
  evaluateZoningAndLandUse,
  E85EvaluationRequest,
  E85NormalizedRuleBundle,
  E85ParcelReference,
  E85PolicyVersion,
  E85SourceDefinition,
  E85UseRule,
  adapters,
} from "../../src/zoning-land-use-engine";
import {
  r11Document,
  R1_1_MD_LOT_ON_RECORD_OR_SUBDIVIDED_CONDITION,
  R1_1_MD_REAR_VEHICULAR_ACCESS_CONDITION,
  R1_1_MD_NOT_IN_FLOOD_PLAIN_CONDITION,
  R1_1_UNSTRUCTURED_SECTIONS,
} from "./fixtures/vancouver-r1-1-facts";

/** PHASE 12C.4A: all three of use-005's current §2.2.7 site-eligibility conditions affirmed, so tests whose real subject is something other than that gate can reach it. */
const MD_SITE_ELIGIBLE: { readonly satisfiedConditions: readonly string[] } = {
  satisfiedConditions: [R1_1_MD_LOT_ON_RECORD_OR_SUBDIVIDED_CONDITION, R1_1_MD_REAR_VEHICULAR_ACCESS_CONDITION, R1_1_MD_NOT_IN_FLOOD_PLAIN_CONDITION],
};

/**
 * PHASE 12C.4B: every current R1-1 USE/DENSITY/DIMENSIONAL fact is now
 * individually dated (use-005 was the last one — see vancouver-r1-1-facts.ts),
 * so the real R1-1 pilot bundle can no longer demonstrate Phase 4's generic
 * EFFECTIVE_DATE_UNKNOWN behavior end-to-end. This synthetic, non-Vancouver
 * USE rule (fed straight to `evaluate()`, bypassing the adapter) exists only
 * to keep that end-to-end demonstration alive without artificially leaving a
 * real R1-1 fact undated for test convenience. The dedicated, purely generic
 * unit-level proof of this same behavior already lives in
 * `use-evaluation.test.ts` ("UNKNOWN effective-date basis on the only
 * matching evidence yields a GAP") — this fixture instead exercises the same
 * behavior through the full request → EvaluationOutcome shape.
 */
function syntheticUndatedUseRules(): readonly E85UseRule[] {
  return [
    {
      family: "USE",
      jurisdictionId: VANCOUVER_JURISDICTION_ID,
      zoneDesignation: VANCOUVER_R1_1_ZONE,
      permissions: [
        {
          value: { useCode: "synthetic_undated_use", status: "CONDITIONAL" },
          provenance: { sourceId: "synthetic-undated-source" },
          temporal: { effectiveDateBasis: "UNKNOWN" },
        },
      ],
    },
  ];
}

const { vancouverR11Adapter, VANCOUVER_R1_1_SOURCE, VANCOUVER_JURISDICTION, VANCOUVER_JURISDICTION_ID, VANCOUVER_R1_1_ZONE, VANCOUVER_R1_1_ADAPTER_ID } = adapters.vancouver;

const SITE_AREA_SQM = 400;
const RENTAL = "residential_rental_tenure_100_percent";

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
 * bundle gaps on it. Phase 12C, not this file, owns R1-1 legal temporal
 * authority.
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

function envelopeOf(outcome: ReturnType<typeof evaluate>) {
  return ("envelope" in outcome.result ? outcome.result.envelope : "partialEnvelope" in outcome.result ? outcome.result.partialEnvelope : undefined)?.envelope;
}

function gapCodes(outcome: ReturnType<typeof evaluate>): string[] {
  return outcome.result.status === "DATA_GAP" ? outcome.result.gaps.map((g) => g.reasonCode) : [];
}

/**
 * THE REAL PILOT SOURCE. The R1-1 schedule states no effective date, so the
 * honest end-to-end answer is: adaptation succeeds completely, provenance
 * survives completely, and Phase 4 declines to assert the rules were in force.
 */
describe("E85 Phase 5 end-to-end — R1-1 facts through the adapter into Phase 4", () => {
  const bundle = normalizeR11();

  test("adaptation succeeds in full: every rule family normalizes and no fact fails", () => {
    expect([...new Set(bundle.rules.map((r) => r.family))].sort()).toEqual(["DENSITY", "DIMENSIONAL", "REQUIREMENT", "USE"]);
    expect(bundle.unresolvedSourceItems).toEqual([]);
    expect(bundle.findings.filter((f) => f.severity === "GAP" && f.factId !== undefined)).toEqual([]);
  });

  test("the gaps are the five declared coverage gaps — no bundle-level EFFECTIVE_DATE_UNKNOWN remains, since every current fact is now individually dated", () => {
    const gaps = bundle.findings.filter((f) => f.severity === "GAP");
    // PHASE 12C.4B: use-005 (the last remaining undated fact) received its
    // own proven temporal window, so `undatedFactIds` is now empty and the
    // adapter's bundle-level EFFECTIVE_DATE_UNKNOWN finding (gated on
    // `undatedFactIds.length > 0`) no longer fires — even though the
    // document VERSION's own stamp (`bundle.temporal`, checked below) is
    // still, correctly, UNKNOWN (the source itself states no version date).
    // R1_1_UNSTRUCTURED_SECTIONS carries 5 entries (3.1.1.4, 3.2.2.10,
    // 2.2.1-with-2.2.2-noted, 2.2.8, 2.2.9 — §2.2.2 was folded into the
    // §2.2.1 entry rather than counted as its own gap, since it is
    // DEFINITION_SUPPORT_ONLY and has no independent obligation).
    expect(gaps.map((g) => g.gap?.reasonCode).sort()).toEqual(["RULE_NOT_STRUCTURED", "RULE_NOT_STRUCTURED", "RULE_NOT_STRUCTURED", "RULE_NOT_STRUCTURED", "RULE_NOT_STRUCTURED"]);
    expect(bundle.temporal).toEqual({ effectiveDateBasis: "UNKNOWN" });
  });

  // PHASE 12C.4B: every current R1-1 USE/DENSITY/DIMENSIONAL fact — including
  // use-005, the last holdout — is now individually dated (2023-10-17 or
  // 2026-06-30). The real R1-1 pilot bundle therefore has no fact left that
  // can demonstrate Phase 4's generic EFFECTIVE_DATE_UNKNOWN behaviour, so
  // these four tests were migrated to `syntheticUndatedUseRules()` — a
  // minimal, non-Vancouver USE rule constructed directly, never a real R1-1
  // fact kept artificially undated for test convenience (see its doc comment
  // above). The rest of this describe block (adaptation success, coverage
  // gaps, single-detached-house/duplex/Multiple-Dwelling values) still
  // exercises the real bundle.
  test("Phase 4 reports the temporal uncertainty rather than resolving through it", () => {
    const outcome = evaluate({ rules: syntheticUndatedUseRules(), useCode: "synthetic_undated_use", requestedAnalyses: ["USE"] });
    expect(outcome.result.status).toBe("DATA_GAP");
    expect(gapCodes(outcome)).toContain("EFFECTIVE_DATE_UNKNOWN");
  });

  test("no rule value is asserted while its effective date is unestablished", () => {
    const outcome = evaluate({ rules: syntheticUndatedUseRules(), useCode: "synthetic_undated_use", requestedAnalyses: ["USE"] });
    expect(outcome.usePermission).toBeUndefined();
    expect(outcome.resolvedMaxFsr).toBeUndefined();
    expect("envelope" in outcome.result ? outcome.result.envelope : undefined).toBeUndefined();
  });

  test("the parcel and its identity still round-trip through the gapped result", () => {
    const outcome = evaluate({ rules: syntheticUndatedUseRules(), useCode: "synthetic_undated_use", requestedAnalyses: ["USE"] });
    expect(outcome.result.parcel.parcelReferenceId).toBe("pilot-parcel-1");
    expect(outcome.result.qualification.parcelMatch).toBe("high");
  });

  test("no architectural massing or financial figure appears in the result", () => {
    const outcome = evaluate({ rules: syntheticUndatedUseRules(), useCode: "synthetic_undated_use", requestedAnalyses: ["USE"] });
    const serialized = JSON.stringify(outcome).toLowerCase();
    for (const forbidden of ["netsellablearea", "netrentablearea", "netbuildablearea", "massing", "revenue", "irr", "residuallandvalue", "constructioncost"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

/**
 * THE CONTROL. Identical extract, identical adapter, identical evaluator — the
 * one difference is a registry that states an effective date (hypothetical,
 * test-only). What remains is purely the scoped-applicability behaviour.
 */
describe("E85 Phase 12B.2 end-to-end — scoped rules govern only their own proposals", () => {
  const bundle = normalizeR11(hypotheticalDatedSource());

  test("the dated control is gap-free except for the declared structure gaps", () => {
    expect(bundle.readiness.blockers).toEqual(["STRUCTURE"]);
    expect(bundle.findings.filter((f) => f.severity === "GAP").every((f) => f.code === "SOURCE_SECTION_UNAVAILABLE")).toBe(true);
    expect(bundle.temporal).toEqual({ effectiveFrom: DATED_EFFECTIVE_FROM, effectiveDateBasis: "SOURCE_STATED" });
  });

  test("Single Detached House: PERMITTED, §3.2 FSR 0.60 and its regulatory GFA", () => {
    const outcome = evaluate({ rules: bundle.rules, useCode: "single_detached_house" });
    expect(outcome.usePermission?.status).toBe("PERMITTED");
    expect(outcome.resolvedMaxFsr?.value).toBe(0.6);
    expect(envelopeOf(outcome)?.maxRegulatoryGfaSqm?.value).toBe(0.6 * SITE_AREA_SQM);
  });

  test("Single Detached House envelope: §3.2 height, front yard and coverage — and NO storeys (withheld)", () => {
    const outcome = evaluate({ rules: bundle.rules, useCode: "single_detached_house" });
    expect(["MACHINE_RESOLVED", "MACHINE_RESOLVED_WITH_WARNINGS"]).toContain(outcome.result.status);
    const env = envelopeOf(outcome);
    expect(env?.maxHeightMetres?.value).toBe(11.5);
    expect(env?.maxHeightMetres?.provenance.documentLocator?.section).toBe("3.2.2.3");
    expect(env?.setbacksMetres?.front.value).toBe(4.9);
    expect(env?.setbacksMetres?.front.provenance.documentLocator?.section).toBe("3.2.2.4");
    expect(env?.maxSiteCoverageFraction?.value).toBe(0.5);
    expect(env?.maxStoreys).toBeUndefined();
    // rulesConsidered legitimately lists every rule; what matters is that the
    // multiple-dwelling rear-building value never reaches this proposal's envelope.
    expect(JSON.stringify(env)).not.toContain("8.5");
  });

  test("Duplex: §3.2.1.1 FSR 0.70", () => {
    const outcome = evaluate({ rules: bundle.rules, useCode: "duplex" });
    expect(outcome.usePermission?.status).toBe("PERMITTED");
    expect(outcome.resolvedMaxFsr?.value).toBe(0.7);
  });

  test("Multiple Dwelling (6 units, principal building, strata): CONDITIONAL, FSR 1.00, §3.1 envelope, no coverage limit invented", () => {
    // PHASE 12C.4A: §2.2.7 site eligibility is affirmed so this test can still
    // reach a resolved USE status; it is not itself testing that gate.
    const outcome = evaluate({ rules: bundle.rules, useCode: "multiple_dwelling", proposal: { dwellingUnitCount: 6, buildingRole: "principal_building", tenureCode: "strata" }, callerContext: MD_SITE_ELIGIBLE });
    expect(outcome.usePermission?.status).toBe("CONDITIONAL");
    expect(outcome.usePermission?.evidence?.value.approvalAuthority).toBe("Director of Planning");
    expect(outcome.resolvedMaxFsr?.value).toBe(1.0);
    const env = envelopeOf(outcome);
    expect(env?.maxHeightMetres?.value).toBe(11.5);
    expect(env?.maxHeightMetres?.provenance.documentLocator?.section).toBe("3.1.2.5");
    expect(env?.maxStoreys?.value).toBe(3);
    expect(env?.setbacksMetres?.front.provenance.documentLocator?.section).toBe("3.1.2.6");
    expect(env?.maxSiteCoverageFraction).toBeUndefined();
    expect(outcome.result.status).not.toBe("DATA_GAP");
  });

  test("Multiple Dwelling rear building: 8.5 m and 2 storeys", () => {
    const outcome = evaluate({ rules: bundle.rules, useCode: "multiple_dwelling", proposal: { dwellingUnitCount: 6, buildingRole: "rear_building", tenureCode: "strata" } });
    const env = envelopeOf(outcome);
    expect(env?.maxHeightMetres?.value).toBe(8.5);
    expect(env?.maxStoreys?.value).toBe(2);
    expect(env?.maxHeightMetres?.provenance.documentLocator?.clause).toBe("(a)");
  });

  test("Multiple Dwelling with 9 units is NOT the ≤8-unit conditional use — it is UNKNOWN, never PROHIBITED", () => {
    const outcome = evaluate({ rules: bundle.rules, useCode: "multiple_dwelling", requestedAnalyses: ["USE"], proposal: { dwellingUnitCount: 9 } });
    expect(outcome.usePermission?.status).toBe("UNKNOWN");
    expect(outcome.usePermission?.status).not.toBe("PROHIBITED");
  });

  test("Multiple Dwelling with no unit count: the scoped permission is a DATA_GAP, not assumed", () => {
    const outcome = evaluate({ rules: bundle.rules, useCode: "multiple_dwelling", requestedAnalyses: ["USE"] });
    expect(outcome.result.status).toBe("DATA_GAP");
    expect(gapCodes(outcome)).toEqual(["PROPOSAL_CONTEXT_MISSING"]);
  });

  test("Multiple Dwelling with no building role: height and storeys are gaps rather than a guessed building", () => {
    const outcome = evaluate({ rules: bundle.rules, useCode: "multiple_dwelling", requestedAnalyses: ["DIMENSIONAL"], proposal: { dwellingUnitCount: 6 } });
    expect(outcome.result.status).toBe("DATA_GAP");
    expect(gapCodes(outcome).sort()).toEqual(["PROPOSAL_CONTEXT_MISSING", "PROPOSAL_CONTEXT_MISSING"]);
  });

  test("an unknown use never matches the 'all other uses' scope: no FSR, a USE_CLASSIFICATION_UNKNOWN gap", () => {
    const outcome = evaluate({ rules: bundle.rules, useCode: "office_building", requestedAnalyses: ["DENSITY", "DIMENSIONAL"] });
    expect(outcome.resolvedMaxFsr).toBeUndefined();
    expect(outcome.result.status).toBe("DATA_GAP");
    expect(new Set(gapCodes(outcome))).toEqual(new Set(["USE_CLASSIFICATION_UNKNOWN"]));
  });

  test("§3.1.1.3 unit cap resolves by tenure: 8 for 100% rental, 6 otherwise, a gap when tenure is unknown", () => {
    const capFor = (tenureCode?: string) => {
      const request = {
        rules: bundle.rules,
        jurisdictionId: VANCOUVER_JURISDICTION_ID,
        zoneDesignation: VANCOUVER_R1_1_ZONE,
        useCode: "multiple_dwelling",
        parcel: parcel(),
        proposal: { dwellingUnitCount: 6, ...(tenureCode === undefined ? {} : { tenureCode }) },
      };
      return evaluateDensity(bundle.rules, parcel(), VANCOUVER_JURISDICTION_ID, VANCOUVER_R1_1_ZONE, "2026-09-01", undefined, buildE85ApplicabilityContext(request)).find(
        (f) => f.field === "maxDwellingUnits",
      );
    };
    expect(capFor(RENTAL)?.resolvedValue).toBe(8);
    expect(capFor("strata")?.resolvedValue).toBe(6);
    expect(capFor(undefined)?.outcome).toBe("GAP");
    expect(capFor(undefined)?.gap?.reasonCode).toBe("PROPOSAL_CONTEXT_MISSING");
    expect(capFor(RENTAL)?.applicability?.applicabilityKeys).toEqual([`use=multiple_dwelling;dwellingUnits=..8;tenure=${RENTAL}`]);
  });

  // PHASE 12C.3A: density-004 (single_detached_house's FSR) now carries its
  // OWN proven effective date (2023-10-17, By-law 13817), which always takes
  // precedence over this bundle's hypothetical SOURCE_STATED control date —
  // so the boundary this test demonstrates is density-004's own real date.
  test("an as-of date before the stated effective date is NOT resolved as in force", () => {
    const outcome = evaluate({ rules: bundle.rules, useCode: "single_detached_house", asOfDate: "2023-10-16" });
    expect(outcome.resolvedMaxFsr).toBeUndefined();
  });

  test("the corrected extract waits on no caller-affirmed condition", () => {
    expect(pendingConditions(bundle)).toEqual([]);
  });
});

/**
 * Scans CODE, not documentation. Phase 4 files legitimately explain their
 * jurisdiction-neutrality in prose.
 */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("E85 Phase 5 end-to-end — the evaluator contains no Vancouver knowledge", () => {
  test("no Phase 4 core evaluator or Phase 12B.2 applicability file mentions Vancouver, R1-1, or any adapter in its code", () => {
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
      "rule-applicability.ts",
      "rule-applicability-types.ts",
      "regulatory-requirement.ts",
      "regulatory-requirement-types.ts",
      "requirement-evaluation.ts",
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
    for (const file of ["use-taxonomy.ts", "rule-family-types.ts", "rule-applicability-types.ts"]) {
      const content = fs.readFileSync(path.join(dir, file), "utf8");
      expect(content).not.toMatch(/\|\s*"Outright Approval Use"/);
      expect(content).not.toMatch(/\|\s*"R1-1"/);
      expect(content).not.toMatch(/\|\s*"CD-1"/);
    }
  });

  test("the same evaluator resolves an invented jurisdiction identically in shape", () => {
    const bundle = normalizeR11(hypotheticalDatedSource());
    const relabelled = JSON.parse(JSON.stringify(bundle.rules).split("ca-bc-vancouver").join("xx-yy-elsewhere").split("R1-1").join("ZZ-9"));
    const outcome = evaluateZoningAndLandUse({
      parcel: { parcelReferenceId: "p", siteAreaSqm: SITE_AREA_SQM },
      jurisdictionId: "xx-yy-elsewhere",
      zoneDesignation: "ZZ-9",
      useCode: "single_detached_house",
      asOfDate: "2026-09-01",
      rules: relabelled,
      requestedAnalyses: ["USE", "DENSITY", "DIMENSIONAL"],
      policyVersion: policy(),
    });
    expect(outcome.usePermission?.status).toBe("PERMITTED");
    expect(outcome.resolvedMaxFsr?.value).toBe(0.6);
  });
});

describe("E85 Phase 5 end-to-end — repeated evaluation is stable", () => {
  test("normalizing and evaluating twice yields the same regulatory answer", () => {
    const proposal = { dwellingUnitCount: 6, buildingRole: "rear_building", tenureCode: RENTAL };
    const first = evaluate({ rules: normalizeR11(hypotheticalDatedSource()).rules, useCode: "multiple_dwelling", proposal });
    const second = evaluate({ rules: normalizeR11(hypotheticalDatedSource()).rules, useCode: "multiple_dwelling", proposal });
    expect(first.resolvedMaxFsr?.value).toBe(second.resolvedMaxFsr?.value);
    expect(first.usePermission).toEqual(second.usePermission);
    expect(first.result.status).toBe(second.result.status);
  });

  test("the pilot source's own gapped answer is equally stable across runs", () => {
    const first = evaluate({ rules: normalizeR11().rules, useCode: "multiple_dwelling", requestedAnalyses: ["USE"], proposal: { dwellingUnitCount: 6 } });
    const second = evaluate({ rules: normalizeR11().rules, useCode: "multiple_dwelling", requestedAnalyses: ["USE"], proposal: { dwellingUnitCount: 6 } });
    expect(first.result.status).toBe("DATA_GAP");
    expect(gapCodes(first)).toEqual(gapCodes(second));
  });

  test("a use the extract never mentions resolves to UNKNOWN, never PROHIBITED", () => {
    const outcome = evaluate({ rules: normalizeR11().rules, useCode: "child_day_care_facility", requestedAnalyses: ["USE"] });
    expect(outcome.usePermission?.status).toBe("UNKNOWN");
  });

  test("the provenance of the dated control survives into the envelope", () => {
    const outcome = evaluate({ rules: normalizeR11(hypotheticalDatedSource()).rules, useCode: "single_detached_house" });
    const p = envelopeOf(outcome)?.maxHeightMetres?.provenance;
    expect(p?.sourceId).toBe(VANCOUVER_R1_1_SOURCE.sourceId);
    expect(p?.sourceVersionId).toBe("2026-06-consolidation");
    expect(p?.adapterId).toBe(VANCOUVER_R1_1_ADAPTER_ID);
  });
});

describe("E85 Phase 12C.3A — 2023-10-17 boundary (By-law 13817, visually proven facts)", () => {
  const bundle = normalizeR11();

  test.each([
    ["single_detached_house", "PERMITTED"],
    ["duplex", "PERMITTED"],
    ["duplex_with_secondary_suite", "CONDITIONAL"],
  ])("USE %s: not yet in force on 2023-10-16, resolved on 2023-10-17", (useCode, expectedStatus) => {
    const before = evaluate({ rules: bundle.rules, useCode, requestedAnalyses: ["USE"], asOfDate: "2023-10-16" });
    expect(before.usePermission?.status).toBe("UNKNOWN");
    const onDate = evaluate({ rules: bundle.rules, useCode, requestedAnalyses: ["USE"], asOfDate: "2023-10-17" });
    expect(onDate.usePermission?.status).toBe(expectedStatus);
  });

  test("DENSITY density-003/004: 0.70/0.60 unavailable on 2023-10-16, resolve on 2023-10-17", () => {
    const beforeDuplex = evaluate({ rules: bundle.rules, useCode: "duplex", requestedAnalyses: ["DENSITY"], asOfDate: "2023-10-16" });
    expect(beforeDuplex.resolvedMaxFsr).toBeUndefined();
    const onDuplex = evaluate({ rules: bundle.rules, useCode: "duplex", requestedAnalyses: ["DENSITY"], asOfDate: "2023-10-17" });
    expect(onDuplex.resolvedMaxFsr?.value).toBe(0.7);

    const beforeSdh = evaluate({ rules: bundle.rules, useCode: "single_detached_house", requestedAnalyses: ["DENSITY"], asOfDate: "2023-10-16" });
    expect(beforeSdh.resolvedMaxFsr).toBeUndefined();
    const onSdh = evaluate({ rules: bundle.rules, useCode: "single_detached_house", requestedAnalyses: ["DENSITY"], asOfDate: "2023-10-17" });
    expect(onSdh.resolvedMaxFsr?.value).toBe(0.6);
  });

  test("DIMENSIONAL representative facts (dim-006 rear MD height, dim-010 §3.2 height, dim-013 §3.2 site coverage): unavailable on 2023-10-16, resolve on 2023-10-17", () => {
    const beforeMd = evaluate({ rules: bundle.rules, useCode: "multiple_dwelling", requestedAnalyses: ["DIMENSIONAL"], proposal: { dwellingUnitCount: 6, buildingRole: "rear_building" }, asOfDate: "2023-10-16" });
    expect(envelopeOf(beforeMd)?.maxHeightMetres).toBeUndefined();
    const onMd = evaluate({ rules: bundle.rules, useCode: "multiple_dwelling", requestedAnalyses: ["DIMENSIONAL"], proposal: { dwellingUnitCount: 6, buildingRole: "rear_building" }, asOfDate: "2023-10-17" });
    expect(envelopeOf(onMd)?.maxHeightMetres?.value).toBe(8.5);

    const beforeSdh = evaluate({ rules: bundle.rules, useCode: "single_detached_house", requestedAnalyses: ["DIMENSIONAL"], asOfDate: "2023-10-16" });
    expect(envelopeOf(beforeSdh)?.maxHeightMetres).toBeUndefined();
    expect(envelopeOf(beforeSdh)?.maxSiteCoverageFraction).toBeUndefined();
    const onSdh = evaluate({ rules: bundle.rules, useCode: "single_detached_house", requestedAnalyses: ["DIMENSIONAL"], asOfDate: "2023-10-17" });
    expect(envelopeOf(onSdh)?.maxHeightMetres?.value).toBe(11.5);
    expect(envelopeOf(onSdh)?.maxSiteCoverageFraction?.value).toBe(0.5);
  });

  test("the exact target date 2026-09-14: every 2023-dated fact resolves exactly as on 2023-10-17, no new EFFECTIVE_DATE_UNKNOWN", () => {
    const outcome = evaluate({ rules: bundle.rules, useCode: "single_detached_house", asOfDate: "2026-09-14" });
    expect(outcome.usePermission?.status).toBe("PERMITTED");
    expect(outcome.resolvedMaxFsr?.value).toBe(0.6);
    expect(envelopeOf(outcome)?.maxHeightMetres?.value).toBe(11.5);
    expect(gapCodes(outcome)).not.toContain("EFFECTIVE_DATE_UNKNOWN");
  });
});

/**
 * PHASE 12C.4A/12C.4B — current §2.2.7 site-eligibility, structured as three
 * independent `requiredConditionIds` on use-005. These three conditions are
 * load-bearing regardless of temporal state: scope is decided before temporal
 * filtering, so a missing or explicitly-false condition produces its
 * gap/UNKNOWN outcome whether or not use-005 is dated. use-005 is now dated
 * (2026-06-30, By-law 14747 clause 4(b) — see vancouver-r1-1-facts.ts), so
 * this block also covers the positive-resolution and boundary-date paths that
 * were blocked in 12C.4A pending that reconstruction.
 */
describe("E85 Phase 12C.4A / 12C.4B — §2.2.7 site-eligibility conditions on use-005", () => {
  const bundle = normalizeR11();
  const ALL_THREE = [R1_1_MD_LOT_ON_RECORD_OR_SUBDIVIDED_CONDITION, R1_1_MD_REAR_VEHICULAR_ACCESS_CONDITION, R1_1_MD_NOT_IN_FLOOD_PLAIN_CONDITION];

  test.each([
    ["lot-history missing", [R1_1_MD_REAR_VEHICULAR_ACCESS_CONDITION, R1_1_MD_NOT_IN_FLOOD_PLAIN_CONDITION]],
    ["rear-access missing", [R1_1_MD_LOT_ON_RECORD_OR_SUBDIVIDED_CONDITION, R1_1_MD_NOT_IN_FLOOD_PLAIN_CONDITION]],
    ["flood-plain condition missing", [R1_1_MD_LOT_ON_RECORD_OR_SUBDIVIDED_CONDITION, R1_1_MD_REAR_VEHICULAR_ACCESS_CONDITION]],
  ])("%s (the other two satisfied) → EXTERNAL_CONDITION_UNDETERMINED, never a resolved status", (_label, satisfied) => {
    const outcome = evaluate({ rules: bundle.rules, useCode: "multiple_dwelling", requestedAnalyses: ["USE"], proposal: { dwellingUnitCount: 6 }, callerContext: { satisfiedConditions: satisfied } });
    expect(outcome.usePermission).toBeUndefined();
    expect(gapCodes(outcome)).toContain("EXTERNAL_CONDITION_UNDETERMINED");
  });

  test("one condition explicitly unsatisfied (the other two satisfied) → USE evidence excluded, result UNKNOWN, never PROHIBITED", () => {
    const outcome = evaluate({
      rules: bundle.rules,
      useCode: "multiple_dwelling",
      requestedAnalyses: ["USE"],
      proposal: { dwellingUnitCount: 6 },
      callerContext: {
        satisfiedConditions: [R1_1_MD_REAR_VEHICULAR_ACCESS_CONDITION, R1_1_MD_NOT_IN_FLOOD_PLAIN_CONDITION],
        unsatisfiedConditions: [R1_1_MD_LOT_ON_RECORD_OR_SUBDIVIDED_CONDITION],
      },
    });
    expect(outcome.usePermission?.status).toBe("UNKNOWN");
    expect(outcome.usePermission?.status).not.toBe("PROHIBITED");
    expect(gapCodes(outcome)).not.toContain("EXTERNAL_CONDITION_UNDETERMINED");
  });

  test("all three satisfied but 9 dwelling units: still not applicable, on the dwelling-unit bound alone", () => {
    const outcome = evaluate({ rules: bundle.rules, useCode: "multiple_dwelling", requestedAnalyses: ["USE"], proposal: { dwellingUnitCount: 9 }, callerContext: { satisfiedConditions: ALL_THREE } });
    expect(outcome.usePermission?.status).toBe("UNKNOWN");
    expect(outcome.usePermission?.status).not.toBe("PROHIBITED");
  });

  test("condition order in the caller context does not change which gap fires (canonical key is order-independent)", () => {
    const forward = evaluate({
      rules: bundle.rules,
      useCode: "multiple_dwelling",
      requestedAnalyses: ["USE"],
      proposal: { dwellingUnitCount: 6 },
      callerContext: { satisfiedConditions: [...ALL_THREE].reverse() },
    });
    const reverse = evaluate({ rules: bundle.rules, useCode: "multiple_dwelling", requestedAnalyses: ["USE"], proposal: { dwellingUnitCount: 6 }, callerContext: { satisfiedConditions: ALL_THREE } });
    expect(gapCodes(forward)).toEqual(gapCodes(reverse));
  });

  test("2026-06-29 (all three conditions satisfied): the current proposition is NOT yet in force — UNKNOWN, never CONDITIONAL", () => {
    const outcome = evaluate({
      rules: bundle.rules,
      useCode: "multiple_dwelling",
      requestedAnalyses: ["USE"],
      proposal: { dwellingUnitCount: 6 },
      asOfDate: "2026-06-29",
      callerContext: { satisfiedConditions: ALL_THREE },
    });
    expect(outcome.usePermission?.status).toBe("UNKNOWN");
    expect(outcome.usePermission?.status).not.toBe("CONDITIONAL");
  });

  test("2026-06-30 (all three conditions satisfied): CONDITIONAL, no EFFECTIVE_DATE_UNKNOWN", () => {
    const outcome = evaluate({
      rules: bundle.rules,
      useCode: "multiple_dwelling",
      requestedAnalyses: ["USE"],
      proposal: { dwellingUnitCount: 6 },
      asOfDate: "2026-06-30",
      callerContext: { satisfiedConditions: ALL_THREE },
    });
    expect(outcome.usePermission?.status).toBe("CONDITIONAL");
    expect(gapCodes(outcome)).not.toContain("EFFECTIVE_DATE_UNKNOWN");
  });

  test("exact target 2026-09-14 (all three conditions satisfied): CONDITIONAL, neither EFFECTIVE_DATE_UNKNOWN nor EXTERNAL_CONDITION_UNDETERMINED, and the disclosed coverage gaps do not erase the resolved status", () => {
    const outcome = evaluate({
      rules: bundle.rules,
      useCode: "multiple_dwelling",
      requestedAnalyses: ["USE"],
      proposal: { dwellingUnitCount: 6 },
      asOfDate: "2026-09-14",
      callerContext: { satisfiedConditions: ALL_THREE },
    });
    expect(outcome.usePermission?.status).toBe("CONDITIONAL");
    expect(gapCodes(outcome)).not.toContain("EFFECTIVE_DATE_UNKNOWN");
    expect(gapCodes(outcome)).not.toContain("EXTERNAL_CONDITION_UNDETERMINED");
  });

  test("DENSITY independence at 2026-09-14: 8-unit rental resolves CONDITIONAL/8, 8-unit other tenure resolves CONDITIONAL/6 — USE eligibility and DENSITY feasibility stay separate questions", () => {
    const rental = evaluate({
      rules: bundle.rules,
      useCode: "multiple_dwelling",
      proposal: { dwellingUnitCount: 8, tenureCode: RENTAL },
      asOfDate: "2026-09-14",
      callerContext: { satisfiedConditions: ALL_THREE },
    });
    expect(rental.usePermission?.status).toBe("CONDITIONAL");
    expect(rental.resolvedMaxFsr).toBeDefined();

    const other = evaluate({
      rules: bundle.rules,
      useCode: "multiple_dwelling",
      proposal: { dwellingUnitCount: 8, tenureCode: "strata" },
      asOfDate: "2026-09-14",
      callerContext: { satisfiedConditions: ALL_THREE },
    });
    expect(other.usePermission?.status).toBe("CONDITIONAL");
    expect(other.usePermission?.status).not.toBe("PROHIBITED");
  });
});

/**
 * PHASE 12C.4B — coverage completeness: every current §2.1 Multiple Dwelling
 * cross-reference (§2.2.1, §2.2.2, §2.2.7, §2.2.8, §2.2.9) is now either
 * STRUCTURED (§2.2.7, via use-005's own requiredConditionIds) or EXPLICITLY
 * ACCOUNTED FOR (the other four) — never silently undisclosed, and never one
 * mechanical gap per section number: §2.2.2 (a supporting definition with no
 * independent obligation) is folded into §2.2.1's single disclosure entry
 * rather than emitting its own separate RULE_NOT_STRUCTURED finding.
 */
describe("E85 Phase 12C.4B — current Multiple Dwelling cross-reference coverage is complete", () => {
  test("§2.2.7 is structured on use-005; §2.2.1 (with §2.2.2 noted inside it), §2.2.8, §2.2.9 are explicitly disclosed as unstructured", () => {
    const bundle = normalizeR11();
    const useRuleRecord = bundle.rules.find((r) => r.family === "USE") as { permissions: readonly { value: { useCode: string }; applicability?: { requiredConditionIds?: readonly string[] } }[] } | undefined;
    const md = useRuleRecord?.permissions.find((p) => p.value.useCode === "multiple_dwelling");
    expect(md?.applicability?.requiredConditionIds?.length).toBe(3);

    for (const section of ["2.2.1", "2.2.8", "2.2.9"]) {
      expect(R1_1_UNSTRUCTURED_SECTIONS.some((s) => s.startsWith(section))).toBe(true);
    }
    // §2.2.2 is NOT its own list entry (that would emit its own, misleading
    // independent RULE_NOT_STRUCTURED gap for a section with no obligation of
    // its own) — it is referenced, marked DEFINITION_SUPPORT_ONLY, inside the
    // §2.2.1 entry that owns the obligation it supports.
    expect(R1_1_UNSTRUCTURED_SECTIONS.some((s) => s.startsWith("2.2.2"))).toBe(false);
    const s221 = R1_1_UNSTRUCTURED_SECTIONS.find((s) => s.startsWith("2.2.1"));
    expect(s221).toMatch(/2\.2\.2/);
    expect(s221).toMatch(/DEFINITION_SUPPORT_ONLY/);
  });
});

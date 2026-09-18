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
  adapters,
} from "../../src/zoning-land-use-engine";
import { r11Document } from "./fixtures/vancouver-r1-1-facts";

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

  test("the gaps are the effective date plus the two declared coverage gaps — nothing else", () => {
    const gaps = bundle.findings.filter((f) => f.severity === "GAP");
    expect(gaps.map((g) => g.gap?.reasonCode).sort()).toEqual(["EFFECTIVE_DATE_UNKNOWN", "RULE_NOT_STRUCTURED", "RULE_NOT_STRUCTURED"]);
    expect(bundle.temporal).toEqual({ effectiveDateBasis: "UNKNOWN" });
  });

  // PHASE 12C.3A: single_detached_house's own USE/DENSITY/DIMENSIONAL facts
  // are now individually proven to 2023-10-17 (By-law 13817) or 2026-06-30
  // (By-law 14747) — see vancouver-r1-1-facts.ts — so single_detached_house
  // itself resolves cleanly at 2026-09-01. use-005 (Multiple Dwelling) is the
  // one fact deliberately left temporally UNKNOWN (its current scope differs
  // from the proven 2023 text — Phase 12C.3), so it is what now demonstrates
  // the genuine, still-real temporal-uncertainty behaviour this section is about.
  test("Phase 4 reports the temporal uncertainty rather than resolving through it", () => {
    const outcome = evaluate({ rules: bundle.rules, useCode: "multiple_dwelling", requestedAnalyses: ["USE"], proposal: { dwellingUnitCount: 6 } });
    expect(outcome.result.status).toBe("DATA_GAP");
    expect(gapCodes(outcome)).toContain("EFFECTIVE_DATE_UNKNOWN");
  });

  test("no rule value is asserted while its effective date is unestablished", () => {
    const outcome = evaluate({ rules: bundle.rules, useCode: "multiple_dwelling", requestedAnalyses: ["USE"], proposal: { dwellingUnitCount: 6 } });
    expect(outcome.usePermission).toBeUndefined();
    expect(outcome.resolvedMaxFsr).toBeUndefined();
    expect("envelope" in outcome.result ? outcome.result.envelope : undefined).toBeUndefined();
  });

  test("the parcel and its identity still round-trip through the gapped result", () => {
    const outcome = evaluate({ rules: bundle.rules, useCode: "multiple_dwelling", requestedAnalyses: ["USE"], proposal: { dwellingUnitCount: 6 } });
    expect(outcome.result.parcel.parcelReferenceId).toBe("pilot-parcel-1");
    expect(outcome.result.qualification.parcelMatch).toBe("high");
  });

  test("no architectural massing or financial figure appears in the result", () => {
    const outcome = evaluate({ rules: bundle.rules, useCode: "multiple_dwelling", requestedAnalyses: ["USE"], proposal: { dwellingUnitCount: 6 } });
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
    const outcome = evaluate({ rules: bundle.rules, useCode: "multiple_dwelling", proposal: { dwellingUnitCount: 6, buildingRole: "principal_building", tenureCode: "strata" } });
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

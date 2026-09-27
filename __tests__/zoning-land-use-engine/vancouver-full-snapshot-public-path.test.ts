/**
 * InvestScape™ E85 — the full 1,621-record Vancouver snapshot through the
 * PUBLIC path: parseE85PublicRequest → evaluateE85PublicRequest, with an
 * explicit AS_OF date, the real R1-1 and C-2C bundles and the quarantined-
 * polygon point-exclusion proof.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Contains information licensed under the Open Government Licence – Vancouver.
 *
 * Server inputs are TEST-ONLY stand-ins built from the pinned export; parcels
 * are SYNTHETIC points inside real polygons. None is a civic parcel. The
 * suite never falls back to a direct orchestrator call without temporalRequest.
 */
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import {
  canonicalRulePackFromBundle,
  createE85SpatialAdapterRegistry,
  createE85SpatialDatasetRegistry,
  normalizeE85SpatialSnapshot,
  adapters,
  E85NormalizedRuleBundle,
  E85RawSpatialFeatureRecord,
  E85SpatialNormalizationSuccess,
} from "../../src/zoning-land-use-engine";
import { zoningLandUse } from "../../src";
import { buildE85TemporalCandidateFromVersionValidity } from "../../src/zoning-land-use-engine/temporal-candidate-adapter";
import { createVancouverZoningSpatialAdapter, vancouverZoningDataset, vancouverZoningLinkPolicyFromLegalBundles, VANCOUVER_ZONING_CRS } from "../../src/zoning-land-use-engine/adapters/spatial/vancouver";
import { VANCOUVER_NORMALIZED_AT, VANCOUVER_RESOLVED_AT, vancouverSnapshot } from "./fixtures/vancouver-spatial-snapshot";
import { c2cDocument, C_2C_ENCLOSED_BUILDING_CONDITION } from "./fixtures/vancouver-c-2c-facts";
import { r11Document, R1_1_DUPLEX_SUITE_LIMIT_CONDITION, R1_1_DUPLEX_SUITE_TREE_CONDITION } from "./fixtures/vancouver-r1-1-facts";

const { parseE85PublicRequest, evaluateE85PublicRequest } = zoningLandUse;
const { vancouverC2CAdapter, VANCOUVER_C_2C_SOURCE, vancouverR11Adapter, VANCOUVER_R1_1_SOURCE, VANCOUVER_JURISDICTION_ID } = adapters.vancouver;

const EXPORT = path.join(__dirname, "../../../e85-pilot-evidence/vancouver-spatial/zoning-districts-and-labels-espg26910.geojson");
const EXPORT_SHA256 = "35e65736c1a577eb38e2d5165b90c1e88946e13a28abe2711fd3773a7393a0ef";
const HAVE_EXPORT = fs.existsSync(EXPORT);
const EVIDENCE_REQUIRED = process.env.E85_EVIDENCE_GATE === "1" || (process.env.CI !== undefined && process.env.CI !== "" && process.env.CI !== "false");
if (!HAVE_EXPORT && !EVIDENCE_REQUIRED) console.warn(`Full Vancouver snapshot not found at ${EXPORT}; the public-path suite is skipped.`);

describe("E85 public-path evidence gate", () => {
  (EVIDENCE_REQUIRED || HAVE_EXPORT ? test : test.skip)("the captured export is present and byte-identical to the pinned capture", () => {
    if (!HAVE_EXPORT) throw new Error(`Evidence gate: full Vancouver snapshot not found at ${EXPORT}.`);
    expect(crypto.createHash("sha256").update(fs.readFileSync(EXPORT)).digest("hex")).toBe(EXPORT_SHA256);
  });
});

const THE_ELEVEN = ["494447", "494523", "494568", "494688", "494721", "494810", "494869", "494873", "494885", "494949", "494963"];
const R1_1_POINT = { x: 493456.89, y: 5456030.81 };
const C_2C_POINT = { x: 491611.89, y: 5456331.0 };
const SITE_AREA = { sqm: 500, basis: { kind: "BYLAW_DEFINED_SITE_AREA", deductionStatus: "NONE_APPLICABLE_CONFIRMED", sourceReference: "synthetic test assertion" } };

function bundle(result: { outcome: string; bundle?: E85NormalizedRuleBundle }): E85NormalizedRuleBundle {
  if (result.outcome !== "NORMALIZED" || result.bundle === undefined) throw new Error(`expected NORMALIZED, got ${result.outcome}`);
  return result.bundle;
}

(HAVE_EXPORT ? describe : describe.skip)("E85 public path — full snapshot, real bundles, AS_OF", () => {
  let legal: E85NormalizedRuleBundle[];
  let phase8: E85SpatialNormalizationSuccess;

  beforeAll(() => {
    const json = JSON.parse(fs.readFileSync(EXPORT, "utf8")) as { features: { properties: Record<string, unknown>; geometry: unknown }[] };
    const records: E85RawSpatialFeatureRecord[] = json.features.map((f) => ({ rawFeatureId: f.properties.object_id as string, rawAttributes: f.properties, rawGeometry: f.geometry }));
    legal = [bundle(vancouverR11Adapter.normalize(r11Document(), VANCOUVER_R1_1_SOURCE)), bundle(vancouverC2CAdapter.normalize(c2cDocument(), VANCOUVER_C_2C_SOURCE))];
    const registry = createE85SpatialAdapterRegistry([createVancouverZoningSpatialAdapter(vancouverZoningLinkPolicyFromLegalBundles(legal))]);
    if (!registry.ok) throw new Error("adapter registry problems");
    const result = normalizeE85SpatialSnapshot(vancouverSnapshot(records), createE85SpatialDatasetRegistry([vancouverZoningDataset()]), registry.registry, { normalizedAt: VANCOUVER_NORMALIZED_AT });
    if (result.outcome !== "NORMALIZED") throw new Error(`expected NORMALIZED, got ${result.reason}`);
    phase8 = result;
  }, 600_000);

  /** TEST-ONLY server inputs: the server, not the caller, resolves the point to its zone. */
  function server(zone: "R1-1" | "C-2C", pt: { x: number; y: number }, temporalEvidence?: zoningLandUse.E85PublicServerInputs["temporalEvidence"]): zoningLandUse.E85PublicServerInputs {
    return {
      normalization: phase8,
      parcelSpatial: { parcelReferenceId: `synthetic-point-${zone}`, geometry: { type: "POINT", crs: VANCOUVER_ZONING_CRS, coordinates: [pt.x, pt.y] } },
      jurisdictionId: VANCOUVER_JURISDICTION_ID,
      zoneDesignation: zone,
      designationSource: { datasetId: "vancouver-zoning", datasetVersionId: "2026-06-29-capture", snapshotSha256: EXPORT_SHA256 },
      policyVersion: { policyVersionId: "public-path-v1", effectiveFrom: "2020-01-01", concepts: {} },
      availableRulePacks: legal.map((b) => canonicalRulePackFromBundle(b, "BASE")),
      spatialRegistry: createE85SpatialDatasetRegistry([vancouverZoningDataset()]),
      resolvedAt: VANCOUVER_RESOLVED_AT,
      composedAt: "2026-09-14T00:00:00.000Z",
      assembledAt: "2026-09-14T00:00:00.000Z",
      ...(temporalEvidence === undefined ? {} : { temporalEvidence }),
    };
  }

  function run(zone: "R1-1" | "C-2C", useCode: string, analysis: string, opts: { siteArea?: boolean; asOf?: string; satisfied?: string[]; unsatisfied?: string[]; temporalEvidence?: zoningLandUse.E85PublicServerInputs["temporalEvidence"] } = {}) {
    const pt = zone === "R1-1" ? R1_1_POINT : C_2C_POINT;
    const parsed = parseE85PublicRequest({
      parcel: { point: { ...pt, crs: "EPSG:26910" } },
      useCode,
      requestedAnalyses: [analysis],
      temporal: { mode: "AS_OF", asOfDate: opts.asOf ?? "2026-09-14" },
      ...(opts.siteArea ? { siteArea: SITE_AREA } : {}),
      ...(opts.satisfied || opts.unsatisfied ? { conditions: { ...(opts.satisfied ? { satisfied: opts.satisfied } : {}), ...(opts.unsatisfied ? { unsatisfied: opts.unsatisfied } : {}) } } : {}),
    });
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    return evaluateE85PublicRequest(server(zone, pt, opts.temporalEvidence), parsed.request).response;
  }

  const summary = (r: zoningLandUse.E85PublicResponse) => ({
    status: r.status,
    fields: r.fields.map((f) => ({ field: f.field, value: f.value, dependsOn: f.dependsOnCallerAssertions })),
    blockers: r.blockers.map((b) => `${b.kind}/${b.materiality}/${b.sourceCode}`),
    gaps: r.gaps.map((g) => g.reasonCode),
    warnings: r.warnings,
    temporalFindings: r.temporalFindings.map((t) => `${t.sourceCode}/${t.materiality}`),
    callerAssertions: r.callerAssertions,
    qualificationFindings: r.sourceFindings.filter((s) => (s.finding as { code: string }).code === "SOURCE_QUALIFICATION_DISCLOSED").map((s) => (s.finding as { factId: string }).factId),
  });

  const TEMPORAL_BLOCKER = "GAP/MATERIAL/TEMPORAL_ANALYSIS_NOT_YET_APPLIED";
  const field = (r: zoningLandUse.E85PublicResponse, name: string) => summary(r).fields.find((f) => f.field === name);

  /** Every point request: the blanket temporal blocker, never a quarantine blocker, and the finding carried through. */
  function expectCommon(r: zoningLandUse.E85PublicResponse) {
    expect(r.status).toBe("DATA_GAP");
    expect(r.temporal.mode).toBe("AS_OF");
    expect(r.temporalFindings.map((t) => `${t.sourceCode}/${t.materiality}`)).toEqual(["TEMPORAL_ANALYSIS_NOT_YET_APPLIED/MATERIAL"]);
    expect(r.blockers.some((b) => b.featureId !== undefined && THE_ELEVEN.includes(b.featureId))).toBe(false);
    expect(r.warnings.some((w) => w.includes("TEMPORAL_APPLICABILITY_UNKNOWN"))).toBe(true);
    expect(r.callerAssertions.label).toBe("CALLER_ASSERTED_NOT_CITY_VERIFIED");
  }

  test.each([false, true])("R1-1 USE (siteArea=%s): PERMITTED, depends on no assertion", (siteArea) => {
    const r = run("R1-1", "single_detached_house", "USE", { siteArea });
    expectCommon(r);
    expect(summary(r).blockers).toEqual([TEMPORAL_BLOCKER]);
    expect(field(r, "usePermission")).toEqual({ field: "usePermission", value: expect.objectContaining({ status: "PERMITTED" }), dependsOn: [] });
    expect(r.callerAssertions.siteArea !== undefined).toBe(siteArea);
  });

  test.each([false, true])("R1-1 DIMENSIONAL (siteArea=%s): height, coverage, setback resolve without assertions", (siteArea) => {
    const r = run("R1-1", "single_detached_house", "DIMENSIONAL", { siteArea });
    expectCommon(r);
    expect(summary(r).fields).toEqual([
      { field: "maxHeightMetres", value: 11.5, dependsOn: [] },
      { field: "maxSiteCoverageFraction", value: 0.5, dependsOn: [] },
      { field: "setbacksMetres", value: 4.9, dependsOn: [] },
    ]);
  });

  test("R1-1 DENSITY without site area: no GFA, REQUIRED_SITE_DIMENSION_MISSING", () => {
    const r = run("R1-1", "single_detached_house", "DENSITY");
    expectCommon(r);
    expect(r.fields).toEqual([]);
    expect(summary(r).gaps).toEqual(["REQUIRED_SITE_DIMENSION_MISSING", "TEMPORAL_ANALYSIS_NOT_YET_APPLIED"]);
  });

  test("R1-1 DENSITY with asserted site area: 0.60 x 500 = 300, flagged as depending on siteArea; the §5.1 relaxation is not applied", () => {
    const r = run("R1-1", "single_detached_house", "DENSITY", { siteArea: true });
    expectCommon(r);
    expect(summary(r).fields).toEqual([{ field: "maxRegulatoryGfaSqm", value: 300, dependsOn: ["siteArea"] }]);
    expect(r.callerAssertions.siteArea?.basis.kind).toBe("BYLAW_DEFINED_SITE_AREA");
  });

  test.each([false, true])("C-2C USE unaffirmed (siteArea=%s): the permission is WITHHELD pending §2.2.1", (siteArea) => {
    const r = run("C-2C", "barber_shop_or_beauty_salon", "USE", { siteArea });
    expectCommon(r);
    expect(r.fields).toEqual([]);
    expect(summary(r).gaps).toEqual(["EXTERNAL_CONDITION_UNDETERMINED", "TEMPORAL_ANALYSIS_NOT_YET_APPLIED"]);
  });

  test("C-2C USE with §2.2.1 affirmed: PERMITTED, flagged as depending on the caller's condition", () => {
    const r = run("C-2C", "barber_shop_or_beauty_salon", "USE", { satisfied: [C_2C_ENCLOSED_BUILDING_CONDITION] });
    expectCommon(r);
    expect(summary(r).fields).toEqual([{ field: "usePermission", value: expect.objectContaining({ status: "PERMITTED" }), dependsOn: ["conditions"] }]);
    expect(r.callerAssertions.conditions?.satisfied).toEqual([C_2C_ENCLOSED_BUILDING_CONDITION]);
  });

  test("C-2C USE with §2.2.1 denied: no permission is reported, and nothing is reported PROHIBITED", () => {
    const r = run("C-2C", "barber_shop_or_beauty_salon", "USE", { unsatisfied: [C_2C_ENCLOSED_BUILDING_CONDITION] });
    expectCommon(r);
    expect(r.fields).toEqual([]);
  });

  test("C-2C USE before By-law 13447's commencement (AS_OF 2022-11-13): nothing resolves", () => {
    const r = run("C-2C", "barber_shop_or_beauty_salon", "USE", { satisfied: [C_2C_ENCLOSED_BUILDING_CONDITION], asOf: "2022-11-13" });
    expectCommon(r);
    expect(r.fields).toEqual([]);
  });

  test.each([false, true])("C-2C DIMENSIONAL (siteArea=%s): 2.5 m front yard stays the minimum; no relaxation applied", (siteArea) => {
    const r = run("C-2C", "barber_shop_or_beauty_salon", "DIMENSIONAL", { siteArea });
    expectCommon(r);
    expect(summary(r).fields).toEqual([{ field: "setbacksMetres", value: 2.5, dependsOn: [] }]);
  });

  test.each([false, true])("C-2C DENSITY (siteArea=%s): not supported, blocked", (siteArea) => {
    const r = run("C-2C", "barber_shop_or_beauty_salon", "DENSITY", { siteArea });
    expectCommon(r);
    expect(r.fields).toEqual([]);
    expect(summary(r).blockers).toEqual(["COMPLETENESS/MATERIAL/REQUESTED_FAMILY_NOT_SUPPORTED", TEMPORAL_BLOCKER]);
  });

  test("R1-1 duplex with secondary suite: withheld until §2.2.1/§2.2.3 are affirmed, then CONDITIONAL depending on conditions", () => {
    const withheld = run("R1-1", "duplex_with_secondary_suite", "USE");
    expectCommon(withheld);
    expect(withheld.fields).toEqual([]);
    expect(summary(withheld).gaps).toContain("EXTERNAL_CONDITION_UNDETERMINED");
    const affirmed = run("R1-1", "duplex_with_secondary_suite", "USE", { satisfied: [R1_1_DUPLEX_SUITE_TREE_CONDITION, R1_1_DUPLEX_SUITE_LIMIT_CONDITION] });
    expect(summary(affirmed).fields).toEqual([{ field: "usePermission", value: expect.objectContaining({ status: "CONDITIONAL" }), dependsOn: ["conditions"] }]);
  });

  describe("caller-condition contract: unknown, affirmed, denied", () => {
    const C2C = (opts: { satisfied?: string[]; unsatisfied?: string[] }) => run("C-2C", "barber_shop_or_beauty_salon", "USE", opts);

    test("unknown: no value, useOutcome UNKNOWN (not PROHIBITED), gap names the condition id", () => {
      const r = C2C({});
      expect(r.useOutcome).toEqual({ useCode: "barber_shop_or_beauty_salon", status: "UNKNOWN", valueReported: false, meaning: expect.stringMatching(/NOT a finding that the use is prohibited/) });
      expect(r.gaps.find((g) => g.reasonCode === "EXTERNAL_CONDITION_UNDETERMINED")?.reason).toContain(C_2C_ENCLOSED_BUILDING_CONDITION);
      expect(r.callerAssertions.conditions).toBeUndefined();
    });

    test("affirmed: PERMITTED, released only on the named caller-asserted condition, and still UNCONFIRMED while blocked", () => {
      const r = C2C({ satisfied: [C_2C_ENCLOSED_BUILDING_CONDITION] });
      const f = r.fields.find((x) => x.field === "usePermission");
      expect(f?.dependsOnCallerAssertions).toEqual(["conditions"]);
      expect(f?.requiredConditionIds).toEqual([C_2C_ENCLOSED_BUILDING_CONDITION]);
      expect(f?.standing).toBe("UNCONFIRMED_WHILE_BLOCKED");
      expect(f?.blockedBy).toEqual(["TEMPORAL_ANALYSIS_NOT_YET_APPLIED"]);
      expect(r.callerAssertions).toEqual({ label: "CALLER_ASSERTED_NOT_CITY_VERIFIED", conditions: { satisfied: [C_2C_ENCLOSED_BUILDING_CONDITION] } });
      expect(r.useOutcome).toMatchObject({ status: "PERMITTED", valueReported: true });
    });

    test("denied: no value and UNKNOWN; nothing anywhere in the response claims PROHIBITED", () => {
      const r = C2C({ unsatisfied: [C_2C_ENCLOSED_BUILDING_CONDITION] });
      expect(r.fields).toEqual([]);
      expect(r.useOutcome).toMatchObject({ status: "UNKNOWN", valueReported: false });
      expect(JSON.stringify({ ...r, useOutcome: undefined, statusMeaning: undefined })).not.toMatch(/"PROHIBITED"/);
      expect(r.warnings.some((w) => /not a finding that the use is prohibited/.test(w))).toBe(true);
      expect(r.warnings.some((w) => /proven not to/.test(w))).toBe(false);
      expect(r.callerAssertions.conditions?.unsatisfied).toEqual([C_2C_ENCLOSED_BUILDING_CONDITION]);
    });

    test("R1-1 use-004: affirming only one of its two conditions still withholds the permission", () => {
      const r = run("R1-1", "duplex_with_secondary_suite", "USE", { satisfied: [R1_1_DUPLEX_SUITE_TREE_CONDITION] });
      expect(r.fields).toEqual([]);
      expect(r.useOutcome).toMatchObject({ status: "UNKNOWN", valueReported: false });
    });
  });

  test("known fact-level dates do not bypass the version-level temporal blocker", () => {
    // Every C-2C fact carries AMENDMENT_DATE_KNOWN (13447, 2022-11-14); the gate still holds.
    const r = run("C-2C", "barber_shop_or_beauty_salon", "DIMENSIONAL");
    expect(r.fields[0].temporal).toEqual({ effectiveFrom: "2022-11-14", effectiveDateBasis: "AMENDMENT_DATE_KNOWN" });
    expect(r.status).toBe("DATA_GAP");
    expect(r.fields.every((f) => f.standing === "UNCONFIRMED_WHILE_BLOCKED")).toBe(true);
    expect(r.blockers).toContainEqual(expect.objectContaining({ sourceCode: "TEMPORAL_ANALYSIS_NOT_YET_APPLIED", materiality: "MATERIAL" }));
  });

  describe("with the only version evidence the pinned sources support (START_UNKNOWN), results stay DATA_GAP", () => {
    // The pinned consolidations record effectiveDateBasis UNKNOWN at version level; no Vancouver date is asserted here.
    const unknownLineages = () => ({
      lineages: legal.map((b) => ({ lineageId: `${b.zoneDesignation}-versions`, adapterResult: buildE85TemporalCandidateFromVersionValidity(b, { state: "START_UNKNOWN" }), membershipRationale: "Pinned consolidation; version-level start not established." })),
    });

    test.each([
      ["R1-1", "single_detached_house", "DIMENSIONAL"],
      ["C-2C", "barber_shop_or_beauty_salon", "DIMENSIONAL"],
      ["R1-1", "single_detached_house", "DENSITY"],
    ] as const)("%s %s %s: lineage not ready, version not applied, DATA_GAP", (zone, use, analysis) => {
      const r = run(zone, use, analysis, { siteArea: true, temporalEvidence: unknownLineages() });
      expect(r.status).toBe("DATA_GAP");
      expect(r.temporalFindings.map((t) => t.sourceCode)).toContain("TEMPORAL_LINEAGE_NOT_READY");
      expect(r.temporalFindings.some((t) => t.materiality === "NON_MATERIAL")).toBe(false);
      expect(r.fields.every((f) => f.standing === "UNCONFIRMED_WHILE_BLOCKED")).toBe(true);
      // No designation coincidence is established, so the undated-polygon warning stays.
      expect(r.temporalFindings.some((t) => t.sourceCode === "DESIGNATION_COINCIDENCE_ESTABLISHED")).toBe(false);
      expect(r.warnings.some((w) => w.startsWith("Phase 7 (TEMPORAL_APPLICABILITY_UNKNOWN)"))).toBe(true);
    });
  });

  test("REPORT", () => {
    if (!process.env.E85_PUBLIC_PATH_REPORT) return;
    const cases: Record<string, unknown> = {};
    for (const zone of ["R1-1", "C-2C"] as const) {
      const use = zone === "R1-1" ? "single_detached_house" : "barber_shop_or_beauty_salon";
      for (const analysis of ["USE", "DIMENSIONAL", "DENSITY"]) {
        for (const siteArea of [false, true]) cases[`${zone} ${analysis} siteArea=${siteArea}`] = summary(run(zone, use, analysis, { siteArea }));
      }
    }
    cases["C-2C USE affirmed §2.2.1"] = summary(run("C-2C", "barber_shop_or_beauty_salon", "USE", { satisfied: [C_2C_ENCLOSED_BUILDING_CONDITION] }));
    cases["C-2C USE denied §2.2.1"] = summary(run("C-2C", "barber_shop_or_beauty_salon", "USE", { unsatisfied: [C_2C_ENCLOSED_BUILDING_CONDITION] }));
    cases["C-2C USE affirmed, AS_OF 2022-11-13"] = summary(run("C-2C", "barber_shop_or_beauty_salon", "USE", { satisfied: [C_2C_ENCLOSED_BUILDING_CONDITION], asOf: "2022-11-13" }));
    cases["R1-1 USE duplex+suite unaffirmed"] = summary(run("R1-1", "duplex_with_secondary_suite", "USE"));
    cases["R1-1 USE duplex+suite affirmed"] = summary(run("R1-1", "duplex_with_secondary_suite", "USE", { satisfied: [R1_1_DUPLEX_SUITE_TREE_CONDITION, R1_1_DUPLEX_SUITE_LIMIT_CONDITION] }));
    cases["R1-1 DENSITY AS_OF 2023-10-16 siteArea"] = summary(run("R1-1", "single_detached_house", "DENSITY", { siteArea: true, asOf: "2023-10-16" }));
    fs.writeFileSync(process.env.E85_PUBLIC_PATH_REPORT, JSON.stringify(cases, null, 1));
  });
});

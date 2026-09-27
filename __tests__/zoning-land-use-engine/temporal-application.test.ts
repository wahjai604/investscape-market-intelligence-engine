/**
 * InvestScape™ E85 — applying a selected legal version, and requiring
 * designation/legal-text coincidence, on the PUBLIC AS_OF path.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * TEST-ONLY, fully SYNTHETIC evidence: the "Testburgh" reference jurisdiction,
 * a synthetic bundle, and synthetic validity windows (instrument ids SYN-*).
 * Nothing here describes Vancouver or any real instrument.
 */
import {
  assembleE85DecisionPackage,
  canonicalRulePackFromBundle,
  createE85SpatialAdapterRegistry,
  createE85SpatialDatasetRegistry,
  normalizeE85SpatialSnapshot,
  E85NormalizedRuleBundle,
  E85RulePack,
} from "../../src/zoning-land-use-engine";
import { zoningLandUse } from "../../src";
import { referenceZoningDataset, referenceZoningSpatialAdapter } from "../../src/zoning-land-use-engine/adapters/spatial/reference";
import { buildE85TemporalCandidateFromVersionValidity } from "../../src/zoning-land-use-engine/temporal-candidate-adapter";
import type { E85TemporalLineageMember } from "../../src/zoning-land-use-engine/temporal-lineage-grouping";
import type { E85VersionValidity } from "../../src/zoning-land-use-engine/version-validity-types";
import { buildE85DesignationValidity, E85DesignationValidity } from "../../src/zoning-land-use-engine/designation-validity-types";
import type { E85FeatureDesignationEvidence } from "../../src/zoning-land-use-engine/decision-temporal-application";
import { NORMALIZED_AT, PARCEL_IN_RB_A, PARCEL_IN_RB_A_AND_OVERLAY, RECORD_A, RECORD_OVERLAY, snapshot } from "./fixtures/spatial-snapshots";
import { pack, JURISDICTION, ZONE } from "./fixtures/composition-packs";

const { parseE85PublicRequest, evaluateE85PublicRequest, buildE85DecisionRequestFromPublic } = zoningLandUse;

const LINKED_PACK_ID = "refburgh-rb-1";
const SOURCE_ID = `${JURISDICTION}:instrument-${LINKED_PACK_ID}`;
const VERSION = "SYN-V2";
const LOC = { bylawOrDocumentId: "SYN-BYLAW", clause: "1" };

/** A synthetic bundle whose rules are the fixture pack's (facts in force from 2024-01-01). */
function bundle(overrides: Partial<E85NormalizedRuleBundle> = {}, maxFsr = 1.5): E85NormalizedRuleBundle {
  const p = pack({ packId: LINKED_PACK_ID, role: "BASE", usePermitted: "dwelling", maxFsr, maxHeightMetres: 14 });
  return {
    sourceId: SOURCE_ID,
    sourceVersionId: VERSION,
    jurisdictionId: JURISDICTION,
    zoneDesignation: ZONE,
    temporal: { effectiveDateBasis: "UNKNOWN" },
    rules: p.rules,
    conditionalRules: p.conditionalRules,
    supportedRuleFamilies: p.supportedRuleFamilies,
    findings: [],
    unresolvedSourceItems: [],
    readiness: { blockers: [], limitations: [] } as unknown as E85NormalizedRuleBundle["readiness"],
    qualification: { evidenceQuality: "high", ruleApplicability: "high" } as unknown as E85NormalizedRuleBundle["qualification"],
    provenance: { sourceId: SOURCE_ID } as unknown as E85NormalizedRuleBundle["provenance"],
    adapterId: "SYN-ADAPTER",
    adapterVersion: "1.0.0",
    normalizedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** The server's pack for the spatially linked id, built from the given bundle. */
const linkedPack = (b: E85NormalizedRuleBundle): E85RulePack => ({ ...canonicalRulePackFromBundle(b, "BASE"), packId: LINKED_PACK_ID });

function closedVersion(from: string, to: string, version = VERSION): E85VersionValidity {
  return {
    state: "CLOSED",
    effectiveFrom: from,
    start: { eventKind: "COMMENCEMENT", effectiveFrom: from, authoritySourceId: SOURCE_ID, authoritySourceVersionId: version, commencementLocator: LOC, effectiveDateBasis: "SOURCE_STATED" },
    effectiveTo: to,
    end: { eventKind: "EXPRESS_REPEAL", effectiveTo: to, authoritySourceId: SOURCE_ID, authoritySourceVersionId: "SYN-NEXT", repealLocator: LOC, effectiveDateBasis: "SOURCE_STATED" },
  };
}

const member = (lineageId: string, b: E85NormalizedRuleBundle, v: E85VersionValidity): E85TemporalLineageMember => ({
  lineageId,
  adapterResult: buildE85TemporalCandidateFromVersionValidity(b, v),
  membershipRationale: "TEST-ONLY synthetic lineage.",
});

const IDENTITY = { jurisdictionId: JURISDICTION, districtOrZoneId: ZONE };
const closedDesignation = (from: string, to: string): E85DesignationValidity =>
  buildE85DesignationValidity({
    state: "CLOSED",
    identity: IDENTITY,
    start: { kind: "MAP_AMENDMENT_OPERATIVE_DATE", effectiveFrom: from, instrumentLocator: { instrumentId: "SYN-MAP-1", clause: "1" } },
    effectiveTo: to,
    end: { kind: "EXPRESS_REPEAL_OF_INSTRUMENT", effectiveTo: to, instrumentLocator: { instrumentId: "SYN-MAP-2", clause: "1" } },
  });
const openDesignation = (from: string): E85DesignationValidity =>
  buildE85DesignationValidity({ state: "OPEN_UNRESEARCHED", identity: IDENTITY, start: { kind: "MAP_AMENDMENT_OPERATIVE_DATE", effectiveFrom: from, instrumentLocator: { instrumentId: "SYN-MAP-1", clause: "1" } } });

function normalization() {
  const registry = createE85SpatialAdapterRegistry([referenceZoningSpatialAdapter]);
  if (!registry.ok) throw new Error("adapter registry problems");
  return normalizeE85SpatialSnapshot(snapshot({ records: [RECORD_A()] }), createE85SpatialDatasetRegistry([referenceZoningDataset()]), registry.registry, { normalizedAt: NORMALIZED_AT });
}
const NORMALIZATION = normalization();
const FEATURE_ID = NORMALIZATION.outcome === "NORMALIZED" ? NORMALIZATION.features[0].featureId : "";

interface Spec {
  packs?: readonly E85RulePack[];
  lineages?: readonly E85TemporalLineageMember[];
  designations?: readonly E85FeatureDesignationEvidence[];
}

function server(spec: Spec): zoningLandUse.E85PublicServerInputs {
  return {
    normalization: NORMALIZATION,
    parcelSpatial: PARCEL_IN_RB_A(),
    jurisdictionId: JURISDICTION,
    zoneDesignation: ZONE,
    designationSource: { datasetId: "synthetic", datasetVersionId: "synthetic", snapshotSha256: "0".repeat(64) },
    policyVersion: { policyVersionId: "temporal-application-test", effectiveFrom: "2020-01-01", concepts: {} },
    availableRulePacks: spec.packs ?? [linkedPack(bundle())],
    spatialRegistry: createE85SpatialDatasetRegistry([referenceZoningDataset()]),
    resolvedAt: "2026-02-12T00:00:00.000Z",
    composedAt: "2026-02-12T00:00:00.000Z",
    assembledAt: "2026-03-01T00:00:00.000Z",
    ...(spec.lineages === undefined ? {} : { temporalEvidence: { lineages: spec.lineages, ...(spec.designations === undefined ? {} : { designations: spec.designations }) } }),
  };
}

function body(asOfDate: string): Record<string, unknown> {
  return { parcel: { parcelId: "synthetic-parcel" }, useCode: "dwelling", requestedAnalyses: ["USE", "DENSITY", "DIMENSIONAL"], temporal: { mode: "AS_OF", asOfDate }, siteArea: { sqm: 500, basis: { kind: "BYLAW_DEFINED_SITE_AREA", deductionStatus: "NONE_APPLICABLE_CONFIRMED" } } };
}

function run(asOfDate: string, spec: Spec) {
  const parsed = parseE85PublicRequest(body(asOfDate));
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return evaluateE85PublicRequest(server(spec), parsed.request);
}
const codes = (r: zoningLandUse.E85PublicResponse) => r.temporalFindings.map((t) => `${t.sourceCode}/${t.materiality}`).sort();
const temporalBlockers = (r: zoningLandUse.E85PublicResponse) => r.blockers.filter((b) => b.materiality !== "NON_MATERIAL" && r.temporalFindings.some((t) => t.sourceCode === b.sourceCode)).map((b) => b.sourceCode).sort();

const GOOD_LINEAGE = () => [member("L", bundle(), closedVersion("2020-01-01", "2030-12-31"))];
const GOOD_DESIGNATION = () => [{ featureId: FEATURE_ID, validity: closedDesignation("2020-01-01", "2030-12-31") }];

describe("server-controlled temporal evidence on the public contract", () => {
  test.each(["temporalEvidence", "temporalLineageEvidence", "lineages", "versionValidity", "designations", "designationValidity"])("a client-supplied %s is rejected as server-controlled", (key) => {
    const r = parseE85PublicRequest({ ...body("2026-02-12"), [key]: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual(expect.objectContaining({ code: "SERVER_CONTROLLED_FIELD", path: key }));
  });

  test("without server temporal evidence the blanket disclosure stands", () => {
    const { response } = run("2026-02-12", {});
    expect(codes(response)).toEqual(["TEMPORAL_ANALYSIS_NOT_YET_APPLIED/MATERIAL"]);
    expect(response.status).toBe("DATA_GAP");
  });
});

describe("positive: a uniquely selected, linked, content-identical version with closed designation coincidence", () => {
  const { response } = run("2026-02-12", { lineages: GOOD_LINEAGE(), designations: GOOD_DESIGNATION() });

  test("the version is applied and coincidence is established, both NON_MATERIAL", () => {
    expect(codes(response)).toEqual(["DESIGNATION_COINCIDENCE_ESTABLISHED/NON_MATERIAL", "TEMPORAL_VERSION_APPLIED/NON_MATERIAL"]);
    expect(temporalBlockers(response)).toEqual([]);
  });

  test("the decision is no longer blocked by temporal evidence, and fields stand resolved", () => {
    expect(response.blockers).toEqual([]);
    expect(response.status).not.toBe("DATA_GAP");
    expect(response.fields.length).toBeGreaterThan(0);
    expect(response.fields.every((f) => f.standing === "RESOLVED_NO_BLOCKERS")).toBe(true);
  });

  test("fact-level filtering still applies inside an applied version (facts start 2024-01-01)", () => {
    const early = run("2023-06-01", { lineages: GOOD_LINEAGE(), designations: [{ featureId: FEATURE_ID, validity: closedDesignation("2020-01-01", "2030-12-31") }] }).response;
    expect(codes(early)).toContain("TEMPORAL_VERSION_APPLIED/NON_MATERIAL");
    expect(early.fields.map((f) => f.field)).toEqual([]);
    expect(early.useOutcome).toMatchObject({ status: "UNKNOWN", valueReported: false });
  });
});

describe("negative: every other outcome stays MATERIAL and DATA_GAP (or manual review)", () => {
  test("clean version selection alone, with no designation evidence, is not resolved", () => {
    const r = run("2026-02-12", { lineages: GOOD_LINEAGE() }).response;
    expect(codes(r)).toEqual(["DESIGNATION_COINCIDENCE_NOT_ESTABLISHED/MATERIAL", "TEMPORAL_VERSION_APPLIED/NON_MATERIAL"]);
    expect(r.status).toBe("DATA_GAP");
    expect(r.fields.every((f) => f.standing === "UNCONFIRMED_WHILE_BLOCKED")).toBe(true);
  });

  test("open-ended ('possibly applicable') designation does not clear coincidence", () => {
    const r = run("2026-02-12", { lineages: GOOD_LINEAGE(), designations: [{ featureId: FEATURE_ID, validity: openDesignation("2020-01-01") }] }).response;
    expect(codes(r)).toContain("DESIGNATION_COINCIDENCE_NOT_ESTABLISHED/MATERIAL");
    expect(r.status).toBe("DATA_GAP");
  });

  test("designation closed before the as-of date does not coincide", () => {
    const r = run("2026-02-12", { lineages: GOOD_LINEAGE(), designations: [{ featureId: FEATURE_ID, validity: closedDesignation("2020-01-01", "2025-12-31") }] }).response;
    expect(codes(r)).toContain("DESIGNATION_COINCIDENCE_NOT_ESTABLISHED/MATERIAL");
  });

  test("two designation records for one feature are not resolved by choosing one", () => {
    const r = run("2026-02-12", { lineages: GOOD_LINEAGE(), designations: [...GOOD_DESIGNATION(), { featureId: FEATURE_ID, validity: closedDesignation("2021-01-01", "2030-12-31") }] }).response;
    expect(codes(r)).toContain("DESIGNATION_COINCIDENCE_NOT_ESTABLISHED/MATERIAL");
  });

  test.each([
    ["future effective", "2019-06-01"],
    ["superseded / outside validity", "2031-06-01"],
  ])("%s: nothing is selected or applied", (_label, asOf) => {
    const r = run(asOf, { lineages: GOOD_LINEAGE(), designations: GOOD_DESIGNATION() }).response;
    expect(codes(r).some((c) => c.startsWith("TEMPORAL_VERSION_APPLIED"))).toBe(false);
    expect(codes(r).every((c) => c.endsWith("/MATERIAL"))).toBe(true);
    expect(r.status).toBe("DATA_GAP");
  });

  test("missing: an open-ended version (no end researched) is never a selectable candidate", () => {
    const open: E85VersionValidity = { state: "OPEN_UNRESEARCHED", effectiveFrom: "2020-01-01", start: (closedVersion("2020-01-01", "2030-12-31") as Extract<E85VersionValidity, { state: "CLOSED" }>).start };
    const r = run("2026-02-12", { lineages: [member("L", bundle(), open)], designations: GOOD_DESIGNATION() }).response;
    expect(codes(r)).toEqual(["TEMPORAL_LINEAGE_NOT_READY/MATERIAL"]);
    expect(r.status).toBe("DATA_GAP");
  });

  test("conflicting: two versions both in force on the date go to manual review", () => {
    const r = run("2026-02-12", {
      lineages: [member("L", bundle(), closedVersion("2020-01-01", "2030-12-31")), member("L", bundle({ sourceVersionId: "SYN-V3" }), closedVersion("2025-01-01", "2030-12-31", "SYN-V3"))],
      designations: GOOD_DESIGNATION(),
    }).response;
    expect(codes(r)).toContain("AS_OF_CONFLICTING_EVIDENCE/MATERIAL");
    expect(r.status).toBe("MANUAL_REVIEW_REQUIRED");
  });

  test("ambiguous: two lineages covering the same source", () => {
    const r = run("2026-02-12", { lineages: [member("L1", bundle(), closedVersion("2020-01-01", "2030-12-31")), member("L2", bundle({ sourceVersionId: "SYN-V9" }), closedVersion("2020-01-01", "2030-12-31", "SYN-V9"))], designations: GOOD_DESIGNATION() }).response;
    expect(codes(r)).toContain("TEMPORAL_VERSION_LINEAGE_AMBIGUOUS/MATERIAL");
    expect(codes(r).some((c) => c.startsWith("TEMPORAL_VERSION_APPLIED"))).toBe(false);
  });

  test("a different selected version is not linked: the linked version is withheld from composition", () => {
    const r = run("2026-02-12", { lineages: [member("L", bundle({ sourceVersionId: "SYN-V3" }), closedVersion("2020-01-01", "2030-12-31", "SYN-V3"))], designations: GOOD_DESIGNATION() }).response;
    expect(codes(r)).toEqual(["TEMPORAL_CANDIDATE_SELECTED_NOT_APPLIED/MATERIAL", "TEMPORAL_VERSION_SELECTED_NOT_LINKED/MATERIAL"]);
    expect(r.fields).toEqual([]);
    expect(r.status).toBe("DATA_GAP");
  });

  test("same ids, different content: withheld, never applied", () => {
    const r = run("2026-02-12", { packs: [linkedPack(bundle({}, 9.9))], lineages: GOOD_LINEAGE(), designations: GOOD_DESIGNATION() }).response;
    expect(codes(r)).toContain("TEMPORAL_VERSION_SELECTED_NOT_LINKED/MATERIAL");
    expect(r.fields).toEqual([]);
  });

  test("a lineage for an unrelated source leaves the linked pack uncovered", () => {
    const r = run("2026-02-12", { lineages: [member("L", bundle({ sourceId: "SYN-OTHER" }), closedVersion("2020-01-01", "2030-12-31"))], designations: GOOD_DESIGNATION() }).response;
    expect(codes(r)).toEqual(["TEMPORAL_CANDIDATE_SELECTED_NOT_APPLIED/MATERIAL", "TEMPORAL_VERSION_NOT_ESTABLISHED/MATERIAL"]);
  });
});

describe("byte-level determinism", () => {
  test("the public response, the trace and the whole decision package are byte-identical across runs", () => {
    const spec = { lineages: GOOD_LINEAGE(), designations: GOOD_DESIGNATION() };
    const a = run("2026-02-12", spec);
    const b = run("2026-02-12", spec);
    expect(JSON.stringify(b.response)).toBe(JSON.stringify(a.response));
    expect(JSON.stringify(b.trace)).toBe(JSON.stringify(a.trace));
    const parsed = parseE85PublicRequest(body("2026-02-12"));
    if (!parsed.ok) throw new Error("parse");
    const p1 = JSON.stringify(assembleE85DecisionPackage(buildE85DecisionRequestFromPublic(server(spec), parsed.request)));
    const p2 = JSON.stringify(assembleE85DecisionPackage(buildE85DecisionRequestFromPublic(server(spec), parsed.request)));
    expect(p2).toBe(p1);
    // Phase 4 stamps come from server-supplied resolvedAt, not the clock.
    expect(p1).not.toMatch(/"(resolvedAt|checkedAt|flaggedAt)":"(?!2026-02-12T00:00:00\.000Z|2026-03-01T00:00:00\.000Z|2026-01-01T00:00:00\.000Z|2026-09-01T00:00:00\.000Z)/);
  });
});

/**
 * Phase 7's TEMPORAL_APPLICABILITY_UNKNOWN says a feature RECORD carries no
 * legal effective date. It must not stand next to a NON_MATERIAL
 * DESIGNATION_COINCIDENCE_ESTABLISHED for the same feature, and it must stay
 * for every applying feature that server evidence did not date.
 */
describe("Phase 7 TEMPORAL_APPLICABILITY_UNKNOWN versus established designation coincidence", () => {
  const PREFIX = "Phase 7 (TEMPORAL_APPLICABILITY_UNKNOWN)";
  const ORIGINAL =
    "Phase 7 (TEMPORAL_APPLICABILITY_UNKNOWN): 1 applying feature(s) have no established legal effective date. The dataset's publication or observation date is NOT used as a substitute: " +
    "when a layer was drawn says nothing about when the boundary it depicts took effect.";
  const temporalWarnings = (r: zoningLandUse.E85PublicResponse) => r.warnings.filter((w) => w.startsWith(PREFIX));
  const pkgOf = (spec: Spec, parcel = PARCEL_IN_RB_A(), normalizationOverride = NORMALIZATION) => {
    const parsed = parseE85PublicRequest(body("2026-02-12"));
    if (!parsed.ok) throw new Error("parse");
    return assembleE85DecisionPackage(buildE85DecisionRequestFromPublic({ ...server(spec), parcelSpatial: parcel, normalization: normalizationOverride }, parsed.request));
  };

  test("positive: established coincidence removes the warning for that feature; nothing else changes", () => {
    const r = run("2026-02-12", { lineages: GOOD_LINEAGE(), designations: GOOD_DESIGNATION() }).response;
    expect(codes(r)).toContain("DESIGNATION_COINCIDENCE_ESTABLISHED/NON_MATERIAL");
    expect(temporalWarnings(r)).toEqual([]);
    // Independent warnings survive, so the status is unchanged.
    expect(r.warnings.some((w) => w.startsWith("Phase 7 (DATASET_LICENSE_LIMITATION)"))).toBe(true);
    expect(r.status).toBe("MACHINE_RESOLVED_WITH_WARNINGS");
    // Phase 7's own finding is retained for audit; only the package warning is qualified.
    const pkg = pkgOf({ lineages: GOOD_LINEAGE(), designations: GOOD_DESIGNATION() });
    expect(pkg.phase7?.findings.map((f) => f.code)).toContain("TEMPORAL_APPLICABILITY_UNKNOWN");
    expect(pkg.warnings.filter((w) => w.startsWith(PREFIX))).toEqual([]);
  });

  test("no temporal evidence at all: the warning stands verbatim", () => {
    expect(temporalWarnings(run("2026-02-12", {}).response)).toEqual([ORIGINAL]);
  });

  test("absent designation evidence: warning stands verbatim beside NOT_ESTABLISHED", () => {
    const r = run("2026-02-12", { lineages: GOOD_LINEAGE() }).response;
    expect(codes(r)).toContain("DESIGNATION_COINCIDENCE_NOT_ESTABLISHED/MATERIAL");
    expect(temporalWarnings(r)).toEqual([ORIGINAL]);
    expect(r.status).toBe("DATA_GAP");
  });

  test("duplicated designation evidence (even identical records): warning stands verbatim", () => {
    const r = run("2026-02-12", { lineages: GOOD_LINEAGE(), designations: [...GOOD_DESIGNATION(), ...GOOD_DESIGNATION()] }).response;
    expect(codes(r)).toContain("DESIGNATION_COINCIDENCE_NOT_ESTABLISHED/MATERIAL");
    expect(temporalWarnings(r)).toEqual([ORIGINAL]);
  });

  test("open-ended designation evidence: warning stands verbatim", () => {
    const r = run("2026-02-12", { lineages: GOOD_LINEAGE(), designations: [{ featureId: FEATURE_ID, validity: openDesignation("2020-01-01") }] }).response;
    expect(codes(r)).toContain("DESIGNATION_COINCIDENCE_NOT_ESTABLISHED/MATERIAL");
    expect(temporalWarnings(r)).toEqual([ORIGINAL]);
  });

  test("mismatched designation identity (another zone): warning stands verbatim", () => {
    const other = buildE85DesignationValidity({
      state: "CLOSED",
      identity: { jurisdictionId: JURISDICTION, districtOrZoneId: "RB-2" },
      start: { kind: "MAP_AMENDMENT_OPERATIVE_DATE", effectiveFrom: "2020-01-01", instrumentLocator: { instrumentId: "SYN-MAP-1", clause: "1" } },
      effectiveTo: "2030-12-31",
      end: { kind: "EXPRESS_REPEAL_OF_INSTRUMENT", effectiveTo: "2030-12-31", instrumentLocator: { instrumentId: "SYN-MAP-2", clause: "1" } },
    });
    const r = run("2026-02-12", { lineages: GOOD_LINEAGE(), designations: [{ featureId: FEATURE_ID, validity: other }] }).response;
    expect(codes(r)).toContain("DESIGNATION_COINCIDENCE_NOT_ESTABLISHED/MATERIAL");
    expect(temporalWarnings(r)).toEqual([ORIGINAL]);
  });

  test("mismatched feature id (evidence for a different feature): warning stands verbatim", () => {
    const r = run("2026-02-12", { lineages: GOOD_LINEAGE(), designations: [{ featureId: "some-other-feature", validity: closedDesignation("2020-01-01", "2030-12-31") }] }).response;
    expect(temporalWarnings(r)).toEqual([ORIGINAL]);
  });

  test("designation closed before the as-of date: warning stands verbatim", () => {
    const r = run("2026-02-12", { lineages: GOOD_LINEAGE(), designations: [{ featureId: FEATURE_ID, validity: closedDesignation("2020-01-01", "2025-12-31") }] }).response;
    expect(temporalWarnings(r)).toEqual([ORIGINAL]);
  });

  test("a second, genuinely undated applying feature keeps its own warning; only the established one is removed", () => {
    const registry = createE85SpatialAdapterRegistry([referenceZoningSpatialAdapter]);
    if (!registry.ok) throw new Error("adapter registry problems");
    const twoFeatures = normalizeE85SpatialSnapshot(snapshot({ records: [RECORD_A(), RECORD_OVERLAY()] }), createE85SpatialDatasetRegistry([referenceZoningDataset()]), registry.registry, { normalizedAt: NORMALIZED_AT });
    if (twoFeatures.outcome !== "NORMALIZED") throw new Error("normalization");
    const overlayId = twoFeatures.features.find((f) => f.featureId !== FEATURE_ID)?.featureId as string;
    const pkg = pkgOf({ lineages: GOOD_LINEAGE(), designations: GOOD_DESIGNATION() }, PARCEL_IN_RB_A_AND_OVERLAY(), twoFeatures);
    expect(pkg.phase7?.findings.find((f) => f.code === "TEMPORAL_APPLICABILITY_UNKNOWN")?.featureIds).toEqual([overlayId, FEATURE_ID].sort());
    expect(pkg.materiality.some((m) => m.sourceCode === "DESIGNATION_COINCIDENCE_ESTABLISHED" && m.featureId === FEATURE_ID)).toBe(true);
    const w = pkg.warnings.filter((x) => x.startsWith(PREFIX));
    expect(w).toHaveLength(1);
    expect(w[0]).toContain(`1 applying feature(s) (${overlayId}) have no established legal effective date`);
    expect(w[0]).toContain(`established coincidence on the as-of date for ${FEATURE_ID}`);
    expect(w[0].split("(")[2]).not.toContain(FEATURE_ID); // the remaining list names only the overlay
  });
});

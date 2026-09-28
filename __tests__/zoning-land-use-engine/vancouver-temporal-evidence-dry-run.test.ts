/**
 * InvestScape™ E85 — Vancouver temporal-evidence DRY RUN on the pinned evidence.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Contains information licensed under the Open Government Licence – Vancouver.
 *
 * Evidence gate (`npm run test:evidence`). Feeds the server-side temporal
 * evidence (adapters/vancouver/legal-pack/temporal-evidence.ts) to the
 * INTERNAL orchestrator, never the public path, for the five pinned AS_OF
 * cases. The points are SYNTHETIC, placed inside real polygons; none is a
 * civic parcel. Nothing here is City-verified or a parcel entitlement.
 *
 * What it proves: with every pinned temporal fact supplied, each case is
 * still DATA_GAP, now for a SPECIFIC MATERIAL reason (neither legal version is
 * CLOSED, so neither is selectable: TEMPORAL_LINEAGE_NOT_READY /
 * AS_OF_LINEAGE_NO_CANDIDATE; R1-1 is START_UNKNOWN pending Q2, C-2C open-ended)
 * instead of the blanket "not yet applied" disclosure; no version is ever
 * applied; the designation is observation-only (classified by the engine's
 * own evaluator, since the orchestrator evaluates coincidence only for an
 * applied version); and the release gates are untouched.
 */
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import {
  adapters,
  assembleE85DecisionPackage,
  createE85SpatialAdapterRegistry,
  createE85SpatialDatasetRegistry,
  E85DecisionPackage,
  E85RawSpatialFeatureRecord,
  E85SpatialNormalizationSuccess,
  normalizeE85SpatialSnapshot,
} from "../../src/zoning-land-use-engine";
import { zoningLandUse } from "../../src";
import { buildE85TemporalCandidateFromVersionValidity } from "../../src/zoning-land-use-engine/temporal-candidate-adapter";
import { evaluateE85DesignationApplicability } from "../../src/zoning-land-use-engine/designation-applicability";
import { createVancouverZoningSpatialAdapter, vancouverZoningDataset, VANCOUVER_ZONING_CRS } from "../../src/zoning-land-use-engine/adapters/spatial/vancouver";
import { VANCOUVER_NORMALIZED_AT, VANCOUVER_RESOLVED_AT, vancouverSnapshot } from "./fixtures/vancouver-spatial-snapshot";

const { parseE85PublicRequest, evaluateE85PublicRequest, buildE85DecisionRequestFromPublic } = zoningLandUse;
const { legalPack } = adapters.vancouver;

const EVIDENCE = path.join(__dirname, "../../../e85-pilot-evidence");
const CHECKSUMS = path.join(EVIDENCE, "PDF-SOURCES.sha256");
const SPATIAL_MANIFEST = path.join(EVIDENCE, "vancouver-spatial/SPATIAL-MANIFEST.json");
const EXPORT = path.join(EVIDENCE, "vancouver-spatial/zoning-districts-and-labels-espg26910.geojson");
const EXPORT_SHA256 = "35e65736c1a577eb38e2d5165b90c1e88946e13a28abe2711fd3773a7393a0ef";
const HAVE_EVIDENCE = fs.existsSync(CHECKSUMS) && fs.existsSync(EXPORT);
const EVIDENCE_REQUIRED = process.env.E85_EVIDENCE_GATE === "1" || (process.env.CI !== undefined && process.env.CI !== "" && process.env.CI !== "false");
if (!HAVE_EVIDENCE && !EVIDENCE_REQUIRED) console.warn(`Evidence folder not found at ${EVIDENCE}; the temporal-evidence dry run is skipped.`);

const R1_1_POINT = { x: 493456.89, y: 5456030.81 };
const C_2C_POINT = { x: 491611.89, y: 5456331.0 };
const SITE_AREA = { sqm: 500, basis: { kind: "BYLAW_DEFINED_SITE_AREA", deductionStatus: "NONE_APPLICABLE_CONFIRMED", sourceReference: "synthetic test assertion" } };

/** The five pinned AS_OF cases, as in the assembly evidence suite. */
const CASES = [
  ["R1-1", "single_detached_house", ["USE", "DENSITY", "DIMENSIONAL", "REQUIREMENT"], "2026-09-14"],
  ["R1-1", "single_detached_house", ["DENSITY"], "2026-09-27"],
  ["R1-1", "duplex_with_secondary_suite", ["USE"], "2026-07-01"],
  ["C-2C", "barber_shop_or_beauty_salon", ["USE", "DIMENSIONAL"], "2026-09-14"],
  ["C-2C", "barber_shop_or_beauty_salon", ["USE"], "2023-01-01"],
] as const;

function checksumIndex(): Map<string, string> {
  const index = new Map<string, string>();
  for (const line of fs.readFileSync(CHECKSUMS, "utf8").split(/\r?\n/)) {
    const m = /^([0-9a-f]{64}) [ *]?(.+)$/.exec(line.trim());
    if (m) index.set(m[1], m[2]);
  }
  return index;
}
const sha256 = (file: string): string => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

(EVIDENCE_REQUIRED || HAVE_EVIDENCE ? describe : describe.skip)("Vancouver temporal evidence — internal dry run on pinned evidence", () => {
  let assembly: ReturnType<typeof legalPack.assembleVancouverLegalPackForServer>;
  let phase8: E85SpatialNormalizationSuccess;

  beforeAll(() => {
    if (!HAVE_EVIDENCE) throw new Error(`Evidence gate: ${CHECKSUMS} or ${EXPORT} not found. The gate refuses to pass by skipping.`);
    const index = checksumIndex();
    const observed = new Map(
      legalPack.VANCOUVER_LEGAL_PACK_MANIFEST.sources.map((s) => {
        const rel = index.get(s.sourcePdfSha256);
        if (rel === undefined) throw new Error(`no evidence path for ${s.sourceId}`);
        return [s.sourceId, sha256(path.join(EVIDENCE, rel))];
      }),
    );
    assembly = legalPack.assembleVancouverLegalPackForServer(legalPack.loadVancouverLegalPack(), { observedPdfSha256BySourceId: observed, extractedAt: "2026-09-27T00:00:00.000Z" });
    const bytes = fs.readFileSync(EXPORT);
    expect(crypto.createHash("sha256").update(bytes).digest("hex")).toBe(EXPORT_SHA256);
    const json = JSON.parse(bytes.toString("utf8")) as { features: { properties: Record<string, unknown>; geometry: unknown }[] };
    const records: E85RawSpatialFeatureRecord[] = json.features.map((f) => ({ rawFeatureId: f.properties.object_id as string, rawAttributes: f.properties, rawGeometry: f.geometry }));
    const registry = createE85SpatialAdapterRegistry([createVancouverZoningSpatialAdapter(assembly.linkPolicy)]);
    if (!registry.ok) throw new Error("adapter registry problems");
    const result = normalizeE85SpatialSnapshot(vancouverSnapshot(records), createE85SpatialDatasetRegistry([vancouverZoningDataset()]), registry.registry, { normalizedAt: VANCOUVER_NORMALIZED_AT });
    if (result.outcome !== "NORMALIZED") throw new Error(`expected NORMALIZED, got ${result.reason}`);
    phase8 = result;
  }, 600_000);

  function server(zone: string, pt: { x: number; y: number }, withPack: boolean): zoningLandUse.E85PublicServerInputs {
    return {
      normalization: phase8,
      parcelSpatial: { parcelReferenceId: `synthetic-point-${zone}`, geometry: { type: "POINT", crs: VANCOUVER_ZONING_CRS, coordinates: [pt.x, pt.y] } },
      jurisdictionId: assembly.jurisdictionId,
      zoneDesignation: zone,
      designationSource: { datasetId: "vancouver-zoning", datasetVersionId: "2026-06-29-capture", snapshotSha256: EXPORT_SHA256 },
      policyVersion: { policyVersionId: "temporal-dry-run-v1", effectiveFrom: "2020-01-01", concepts: {} },
      availableRulePacks: [...assembly.rulePacks],
      spatialRegistry: createE85SpatialDatasetRegistry([vancouverZoningDataset()]),
      resolvedAt: VANCOUVER_RESOLVED_AT,
      composedAt: "2026-09-14T00:00:00.000Z",
      assembledAt: "2026-09-14T00:00:00.000Z",
      ...(withPack ? { legalPack: legalPack.vancouverLegalPackPublicServerInput(assembly) } : {}),
    };
  }

  function parse(zone: string, use: string, analyses: readonly string[], asOfDate: string) {
    const pt = zone === "R1-1" ? R1_1_POINT : C_2C_POINT;
    const parsed = parseE85PublicRequest({ parcel: { point: { ...pt, crs: "EPSG:26910" } }, useCode: use, requestedAnalyses: [...analyses], temporal: { mode: "AS_OF", asOfDate }, siteArea: SITE_AREA });
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    return { pt, request: parsed.request };
  }

  /** The dry run: the same internal request, plus the pinned temporal evidence, straight into the orchestrator. */
  function dryRun(zone: string, use: string, analyses: readonly string[], asOfDate: string): { without: E85DecisionPackage; withEvidence: E85DecisionPackage; featureIds: string[] } {
    const { pt, request } = parse(zone, use, analyses, asOfDate);
    const base = buildE85DecisionRequestFromPublic(server(zone, pt, false), request);
    const without = assembleE85DecisionPackage(base);
    const featureIds = [...new Set((without.phase7?.hits ?? []).filter((h) => h.applicability === "APPLIES").map((h) => h.featureId))].sort();
    const lineages = assembly.bundles.map((b) => {
      const v = legalPack.VANCOUVER_VERSION_VALIDITY_BY_SOURCE.get(b.sourceId);
      if (v === undefined || v.sourceVersionId !== b.sourceVersionId) throw new Error(`no pinned validity for ${b.sourceId}@${b.sourceVersionId}`);
      return { lineageId: `vancouver:${b.sourceId}`, adapterResult: buildE85TemporalCandidateFromVersionValidity(b, v.validity), membershipRationale: "One lineage per pinned Vancouver source; one pinned version each." };
    });
    const designations = featureIds.map((featureId) => ({ featureId, validity: legalPack.vancouverObservedDesignation(zone) }));
    const withEvidence = assembleE85DecisionPackage({ ...base, temporalLineageEvidence: { lineages, designations } });
    return { without, withEvidence, featureIds };
  }

  describe("pinned digests", () => {
    test("every temporal source digest is a committed evidence checksum and matches the bytes on disk", () => {
      const index = checksumIndex();
      for (const s of legalPack.VANCOUVER_TEMPORAL_PINNED_SOURCES.filter((x) => x.role !== "DESIGNATION_OBSERVATION")) {
        const rel = index.get(s.sha256);
        expect({ instrument: s.instrument, inManifest: rel !== undefined }).toEqual({ instrument: s.instrument, inManifest: true });
        expect(sha256(path.join(EVIDENCE, rel!))).toBe(s.sha256);
      }
    });

    test("the designation observation source is the pinned spatial export, and its date is the City processing date", () => {
      const obs = legalPack.VANCOUVER_TEMPORAL_PINNED_SOURCES.find((x) => x.role === "DESIGNATION_OBSERVATION")!;
      expect(obs.sha256).toBe(EXPORT_SHA256);
      expect(sha256(EXPORT)).toBe(obs.sha256);
      const manifest = JSON.parse(fs.readFileSync(SPATIAL_MANIFEST, "utf8")) as { release: { cityLastProcessingData: string; cityTimestampZone: string } };
      expect(manifest.release.cityLastProcessingData.slice(0, 10)).toBe("2026-06-29");
      expect(manifest.release.cityTimestampZone).toBe("UNSTATED");
      const d = legalPack.vancouverObservedDesignation("R1-1");
      expect(d.state).toBe("OPEN_UNRESEARCHED");
      expect(d.state !== "DESIGNATION_START_UNKNOWN" && d.state !== "CONFLICTING_DESIGNATION_START" && d.start.kind).toBe("OPEN_OBSERVATION_ASSERTION");
    });

    test("the 2026-09-28 review date is SHA256_LF_NORMALIZED_REVIEW_RECORD, distinct from the index capture, and is provenance only", () => {
      const p = legalPack.VANCOUVER_END_REVIEW_DATE_PROVENANCE;
      expect(p).toEqual({
        provenance: "SHA256_LF_NORMALIZED_REVIEW_RECORD",
        date: "2026-09-28",
        document: "vancouver-temporal/AMENDMENT-INDEX-RECAPTURE-2026-09-28.md",
        lineEndingNormalizedTextSha256: "523dd99cb521f5d43b9b389a2fc227a3672e0b8ebb4848aaf2f3a6cbea317794",
      });
      // The record's pin is over LINE-ENDING-NORMALIZED text (CRLF -> LF, UTF-8), not raw bytes:
      // the repository converts line endings on checkout, so the same record may be stored with either.
      const raw = fs.readFileSync(path.join(EVIDENCE, p.document), "utf8");
      const normalized = raw.replace(/\r\n/g, "\n");
      expect(crypto.createHash("sha256").update(normalized, "utf8").digest("hex")).toBe(p.lineEndingNormalizedTextSha256);
      // The same text with CRLF endings still matches after normalization.
      expect(crypto.createHash("sha256").update(normalized.replace(/\n/g, "\r\n").replace(/\r\n/g, "\n"), "utf8").digest("hex")).toBe(p.lineEndingNormalizedTextSha256);
      // The record names both captures and the review date. The capture is the END_REVIEW source; the record is not a source.
      const index = legalPack.VANCOUVER_TEMPORAL_PINNED_SOURCES.find((s) => s.role === "END_REVIEW")!;
      // The index capture's digest, by contrast, is a RAW-BYTE hash of the PDF.
      const rel = checksumIndex().get(index.sha256)!;
      expect(sha256(path.join(EVIDENCE, rel))).toBe(index.sha256);
      expect(normalized).toContain(index.sha256);
      expect(normalized).toContain("7a0093b8378147a53144a57d29857bf7c73b24cf4d0ac8052afca1677beeb83c");
      expect(normalized).toContain("performed on 2026-09-28");
      expect(legalPack.VANCOUVER_TEMPORAL_PINNED_SOURCES.some((s) => s.instrument.includes("RECAPTURE") || s.supports.includes(p.date))).toBe(false);
      // It appears in validity only as the end-review cutoff; it is never an effectiveFrom or effectiveTo.
      const c = legalPack.VANCOUVER_C_2C_VERSION_VALIDITY;
      if (c.state !== "OPEN_REVIEWED_NO_END_ESTABLISHED") throw new Error("expected open-reviewed");
      expect(c.endReview.reviewedAt).toBe(p.date);
      expect(JSON.stringify({ ...c, endReview: undefined })).not.toContain(p.date);
    });

    test("R1-1 is START_UNKNOWN pending Q2; 14747 is kept as amendment evidence only; C-2C starts on its pinned instrument", () => {
      const r = legalPack.VANCOUVER_R1_1_VERSION_VALIDITY;
      const c = legalPack.VANCOUVER_C_2C_VERSION_VALIDITY;
      expect(r).toEqual({ state: "START_UNKNOWN" });
      const b14747 = legalPack.VANCOUVER_TEMPORAL_PINNED_SOURCES.find((s) => s.instrument === "By-law 14747")!;
      expect(b14747.role).toBe("AMENDMENT_EVIDENCE");
      expect(b14747.supports).toContain("2026-06-30");
      if (c.state !== "OPEN_REVIEWED_NO_END_ESTABLISHED") throw new Error("expected open-reviewed");
      expect([c.effectiveFrom, c.start.eventKind]).toEqual(["2026-05-19", "IMMEDIATE_ON_ENACTMENT"]);
      // 14697's own enactment statement and immediacy clause, in the committed text of the pinned instrument.
      const text = fs.readFileSync(path.join(EVIDENCE, "vancouver-temporal/c-2c/acquired-sources/14697.txt"), "utf8");
      expect(text).toContain("ENACTED by Council this 19th day of May, 2026");
      expect(text).toMatch(/19\. This by-law is to come into force and take effect on the date of its enactment\./);
    });
  });

  describe.each(CASES)("%s %s %j AS_OF %s", (zone, use, analyses, asOf) => {
    let run: ReturnType<typeof dryRun>;
    beforeAll(() => {
      run = dryRun(zone, use, analyses, asOf);
    });

    test("without evidence: the blanket temporal disclosure (the baseline being replaced)", () => {
      expect(run.without.status).toBe("DATA_GAP");
      expect(run.without.materiality.filter((m) => m.sourcePhase === "TEMPORAL_REQUEST").map((m) => m.sourceCode)).toEqual(["TEMPORAL_ANALYSIS_NOT_YET_APPLIED"]);
    });

    test("with the pinned evidence: still DATA_GAP, no version applied", () => {
      const pkg = run.withEvidence;
      expect(pkg.status).toBe("DATA_GAP");
      expect(pkg.materiality.map((m) => m.sourceCode)).not.toContain("TEMPORAL_VERSION_APPLIED");
      expect(pkg.materiality.some((m) => m.materiality === "NON_MATERIAL" && /TEMPORAL|DESIGNATION/.test(m.sourceCode))).toBe(false);
    });

    test("the blanket disclosure is replaced by a specific MATERIAL blocker for each unselectable open-ended version", () => {
      const pkg = run.withEvidence;
      const temporal = pkg.materiality.filter((m) => m.sourcePhase === "TEMPORAL_REQUEST");
      expect(temporal.map((m) => m.sourceCode)).not.toContain("TEMPORAL_ANALYSIS_NOT_YET_APPLIED");
      // One MATERIAL lineage record per pinned source: the version is open-ended, so the engine has no candidate to select.
      for (const b of assembly.bundles) {
        const rec = temporal.find((m) => m.sourceCode === "TEMPORAL_LINEAGE_NOT_READY" && m.reason.includes(`vancouver:${b.sourceId}`));
        expect(rec).toBeDefined();
        expect(rec!.materiality).toBe("MATERIAL");
        expect(rec!.reason).toContain("AS_OF_LINEAGE_NO_CANDIDATE");
      }
      expect(pkg.blockers.filter((b) => b.sourceCode === "TEMPORAL_LINEAGE_NOT_READY" && b.materiality === "MATERIAL")).toHaveLength(assembly.bundles.length);
    });

    test("internal diagnostic: C-2C is classified against its known start; R1-1 (START_UNKNOWN) is not classified", () => {
      const temporal = run.withEvidence.materiality.filter((m) => m.sourceCode === "TEMPORAL_LINEAGE_NOT_READY");
      const byLineage = (sourceId: string) => temporal.find((m) => m.reason.includes(`vancouver:${sourceId}`))!;
      const c2c = byLineage("ca-bc-vancouver:zoning-development-bylaw-3575:district-schedule-c-2c");
      const r11 = byLineage("ca-bc-vancouver:zoning-development-bylaw-3575:district-schedule-r1-1");
      const expectedC2c = asOf < "2026-05-19" ? "BEFORE_KNOWN_START" : "OPEN_END_PREVENTS_SELECTION";
      expect(c2c.temporalLineageDiagnostic).toEqual({ kind: expectedC2c, asOfDate: asOf, knownStarts: ["2026-05-19"] });
      expect(r11.temporalLineageDiagnostic).toBeUndefined();
      for (const m of [c2c, r11]) expect([m.kind, m.materiality, m.gap?.reasonCode]).toEqual(["GAP", "MATERIAL", "TEMPORAL_LINEAGE_NOT_READY"]);
    });

    test("the designation is observation-only; the orchestrator does not reach it because no version was applied", () => {
      const pkg = run.withEvidence;
      expect(run.featureIds.length).toBe(1);
      // The engine's own designation evaluator classifies the supplied designation for this date.
      const result = evaluateE85DesignationApplicability(legalPack.vancouverObservedDesignation(zone), { kind: "RESOLVED", request: { mode: "AS_OF", asOfDate: asOf } });
      expect(result.kind).toBe("DESIGNATION_OBSERVATION_ONLY_NOT_LEGALLY_DATED");
      // FINDING, pinned: coincidence is evaluated only for an APPLIED pack, so no designation record exists in the package.
      // If a later change evaluates designation without an applied version, this must become a MATERIAL
      // DESIGNATION_COINCIDENCE_NOT_ESTABLISHED blocker, never an established one.
      const designation = pkg.materiality.filter((m) => /DESIGNATION_COINCIDENCE/.test(m.sourceCode));
      expect(designation.every((m) => m.sourceCode === "DESIGNATION_COINCIDENCE_NOT_ESTABLISHED" && m.materiality === "MATERIAL")).toBe(true);
      expect(designation).toEqual([]);
    });

    test("the public path still refuses this evidence, and still discloses NOT_RELEASED / DISABLED", () => {
      const { pt, request } = parse(zone, use, analyses, asOf);
      const lineages = run.withEvidence && assembly.bundles.map((b) => ({ lineageId: `vancouver:${b.sourceId}`, adapterResult: buildE85TemporalCandidateFromVersionValidity(b, legalPack.VANCOUVER_VERSION_VALIDITY_BY_SOURCE.get(b.sourceId)!.validity), membershipRationale: "dry run" }));
      const withTemporal = { ...server(zone, pt, true), temporalEvidence: { lineages } };
      expect(() => evaluateE85PublicRequest(withTemporal, request)).toThrow(/asOfResolution is DISABLED/);
      const { response } = evaluateE85PublicRequest(server(zone, pt, true), request);
      expect(response.status).toBe("DATA_GAP");
      expect(response.temporalFindings.map((t) => t.sourceCode)).toEqual(["TEMPORAL_ANALYSIS_NOT_YET_APPLIED"]);
      const pr = response.packReadiness;
      if (pr.state !== "DISCLOSED") throw new Error("expected DISCLOSED");
      expect([pr.releaseStatus, pr.asOfResolution, pr.versionValidity]).toEqual(["NOT_RELEASED", "DISABLED", "UNKNOWN"]);
      // Affirmative claims only; the engine's own negations ("NOT_CITY_VERIFIED", "not a City verification") are expected.
      const text = JSON.stringify(response);
      expect(text).not.toContain("GIT_PINNED_AUDIT");
      expect(text).not.toMatch(/(?<!NOT_)(?<!not )city[- _]?verified|entitled to|parcel entitlement(?! )/i);
      expect(text).toContain("CALLER_ASSERTED_NOT_CITY_VERIFIED");
    });
  });

  test("the release gates are untouched", () => {
    const m = legalPack.VANCOUVER_LEGAL_PACK_MANIFEST;
    expect([m.releaseStatus, m.asOfResolution, m.openUnknowns.versionValidity]).toEqual(["NOT_RELEASED", "DISABLED", "UNKNOWN"]);
    expect(assembly.temporalEvidence).toBeUndefined();
    expect(legalPack.vancouverLegalPackPublicReadiness(assembly).publicReady).toBe(false);
  });

  // O0 guards (docs/E85-reviewed-open-coverage-decision.md §9 A): only CLOSED intervals apply.
  test("no reviewed-open coverage: MIXED/BOTH_OPEN_END coincidence is never accepted", () => {
    // Case 4: C-2C is OPEN_REVIEWED_NO_END_ESTABLISHED and its designation is observation-only.
    const c = legalPack.VANCOUVER_C_2C_VERSION_VALIDITY;
    expect(c.state).toBe("OPEN_REVIEWED_NO_END_ESTABLISHED");
    expect(evaluateE85DesignationApplicability(legalPack.vancouverObservedDesignation("C-2C"), { kind: "RESOLVED", request: { mode: "AS_OF", asOfDate: "2026-09-14" } }).kind).toBe("DESIGNATION_OBSERVATION_ONLY_NOT_LEGALLY_DATED");
    const pkg = dryRun("C-2C", "barber_shop_or_beauty_salon", ["USE", "DIMENSIONAL"], "2026-09-14").withEvidence;
    expect(pkg.status).toBe("DATA_GAP");
    const codes = [...pkg.materiality, ...pkg.blockers].map((m) => m.sourceCode);
    expect(codes).not.toContain("TEMPORAL_VERSION_APPLIED");
    expect(codes).not.toContain("DESIGNATION_COINCIDENCE_ESTABLISHED");
    expect(pkg.materiality.some((m) => m.materiality === "NON_MATERIAL" && /TEMPORAL|DESIGNATION/.test(m.sourceCode))).toBe(false);
  });

  test("the review date is never a coverage bound", () => {
    const reviewDate = legalPack.VANCOUVER_END_REVIEW_DATE_PROVENANCE.date;
    expect(reviewDate).toBe("2026-09-28");
    for (const [sourceId, { validity }] of legalPack.VANCOUVER_VERSION_VALIDITY_BY_SOURCE) {
      const rest = "endReview" in validity ? { ...validity, endReview: undefined } : validity;
      expect({ sourceId, carriesReviewDate: JSON.stringify(rest).includes(reviewDate) }).toEqual({ sourceId, carriesReviewDate: false });
    }
    for (const zone of ["R1-1", "C-2C"]) expect(JSON.stringify(legalPack.vancouverObservedDesignation(zone))).not.toContain(reviewDate);
    expect(JSON.stringify(legalPack.VANCOUVER_LEGAL_PACK_MANIFEST)).not.toMatch(/currencyProvenTo|coverageBound/);
  });
});


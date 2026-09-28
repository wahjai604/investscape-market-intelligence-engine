/**
 * InvestScape™ E85 — Vancouver legal pack server assembly on the pinned evidence.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Contains information licensed under the Open Government Licence – Vancouver.
 *
 * Evidence gate (`npm run test:evidence`). Hashes the real schedule PDFs,
 * assembles the production legal pack from those digests, builds the Phase 8
 * normalization from the full snapshot with the assembly's own linkage, and
 * runs SYNTHETIC public requests (synthetic points inside real polygons,
 * synthetic site area) through parseE85PublicRequest → evaluateE85PublicRequest.
 *
 * The negative this suite exists for: with the real pack correctly bound,
 * every real Vancouver AS_OF answer is still DATA_GAP.
 */
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import {
  adapters,
  createE85SpatialAdapterRegistry,
  createE85SpatialDatasetRegistry,
  E85RawSpatialFeatureRecord,
  E85SpatialNormalizationSuccess,
  normalizeE85SpatialSnapshot,
} from "../../src/zoning-land-use-engine";
import { zoningLandUse } from "../../src";
import { createVancouverZoningSpatialAdapter, vancouverZoningDataset, VANCOUVER_ZONING_CRS } from "../../src/zoning-land-use-engine/adapters/spatial/vancouver";
import { VANCOUVER_NORMALIZED_AT, VANCOUVER_RESOLVED_AT, vancouverSnapshot } from "./fixtures/vancouver-spatial-snapshot";

const { parseE85PublicRequest, evaluateE85PublicRequest } = zoningLandUse;
const { legalPack } = adapters.vancouver;

const EVIDENCE = path.join(__dirname, "../../../e85-pilot-evidence");
const CHECKSUMS = path.join(EVIDENCE, "PDF-SOURCES.sha256");
const EXPORT = path.join(EVIDENCE, "vancouver-spatial/zoning-districts-and-labels-espg26910.geojson");
const EXPORT_SHA256 = "35e65736c1a577eb38e2d5165b90c1e88946e13a28abe2711fd3773a7393a0ef";
const HAVE_EVIDENCE = fs.existsSync(CHECKSUMS) && fs.existsSync(EXPORT);
const EVIDENCE_REQUIRED = process.env.E85_EVIDENCE_GATE === "1" || (process.env.CI !== undefined && process.env.CI !== "" && process.env.CI !== "false");
if (!HAVE_EVIDENCE && !EVIDENCE_REQUIRED) console.warn(`Evidence folder not found at ${EVIDENCE}; the legal-pack assembly evidence suite is skipped.`);

const R1_1_POINT = { x: 493456.89, y: 5456030.81 };
const C_2C_POINT = { x: 491611.89, y: 5456331.0 };
const SITE_AREA = { sqm: 500, basis: { kind: "BYLAW_DEFINED_SITE_AREA", deductionStatus: "NONE_APPLICABLE_CONFIRMED", sourceReference: "synthetic test assertion" } };

function observedPdfDigests(): Map<string, string> {
  const index = new Map<string, string>();
  for (const line of fs.readFileSync(CHECKSUMS, "utf8").split(/\r?\n/)) {
    const m = /^([0-9a-f]{64}) [ *]?(.+)$/.exec(line.trim());
    if (m) index.set(m[1], m[2]);
  }
  // Hash the bytes on disk; the checksum file only says where they are.
  return new Map(
    legalPack.VANCOUVER_LEGAL_PACK_MANIFEST.sources.map((s) => {
      const rel = index.get(s.sourcePdfSha256);
      if (rel === undefined) throw new Error(`no evidence path for ${s.sourceId}`);
      return [s.sourceId, crypto.createHash("sha256").update(fs.readFileSync(path.join(EVIDENCE, rel))).digest("hex")];
    }),
  );
}

(EVIDENCE_REQUIRED || HAVE_EVIDENCE ? describe : describe.skip)("Vancouver legal pack assembly — pinned evidence, public path", () => {
  let assembly: ReturnType<typeof legalPack.assembleVancouverLegalPackForServer>;
  let phase8: E85SpatialNormalizationSuccess;

  beforeAll(() => {
    if (!HAVE_EVIDENCE) throw new Error(`Evidence gate: ${CHECKSUMS} or ${EXPORT} not found. The gate refuses to pass by skipping.`);
    assembly = legalPack.assembleVancouverLegalPackForServer(legalPack.loadVancouverLegalPack(), { observedPdfSha256BySourceId: observedPdfDigests(), extractedAt: "2026-09-27T00:00:00.000Z" });
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

  /** TEST-ONLY server inputs: legal parts from the assembly, never from the request; no temporal evidence. */
  function server(zone: "R1-1" | "C-2C", pt: { x: number; y: number }): zoningLandUse.E85PublicServerInputs {
    return {
      normalization: phase8,
      parcelSpatial: { parcelReferenceId: `synthetic-point-${zone}`, geometry: { type: "POINT", crs: VANCOUVER_ZONING_CRS, coordinates: [pt.x, pt.y] } },
      jurisdictionId: assembly.jurisdictionId,
      zoneDesignation: zone,
      designationSource: { datasetId: "vancouver-zoning", datasetVersionId: "2026-06-29-capture", snapshotSha256: EXPORT_SHA256 },
      policyVersion: { policyVersionId: "assembly-evidence-v1", effectiveFrom: "2020-01-01", concepts: {} },
      availableRulePacks: [...assembly.rulePacks],
      spatialRegistry: createE85SpatialDatasetRegistry([vancouverZoningDataset()]),
      resolvedAt: VANCOUVER_RESOLVED_AT,
      composedAt: "2026-09-14T00:00:00.000Z",
      assembledAt: "2026-09-14T00:00:00.000Z",
      ...(assembly.temporalEvidence === undefined ? {} : { temporalEvidence: assembly.temporalEvidence }),
      legalPack: legalPack.vancouverLegalPackPublicServerInput(assembly),
    };
  }

  function run(zone: "R1-1" | "C-2C", useCode: string, analyses: string[], asOfDate: string, extra: Record<string, unknown> = {}) {
    const pt = zone === "R1-1" ? R1_1_POINT : C_2C_POINT;
    const parsed = parseE85PublicRequest({ parcel: { point: { ...pt, crs: "EPSG:26910" } }, useCode, requestedAnalyses: analyses, temporal: { mode: "AS_OF", asOfDate }, ...extra });
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    return evaluateE85PublicRequest(server(zone, pt), parsed.request).response;
  }

  test("the real bytes assemble, and the assembly is still NOT_RELEASED, AS_OF-disabled and not public-ready", () => {
    expect(assembly.disclosures.releaseStatus).toBe("NOT_RELEASED");
    expect(assembly.disclosures.asOfResolution).toBe("DISABLED");
    expect(assembly.temporalEvidence).toBeUndefined();
    expect(legalPack.vancouverLegalPackPublicReadiness(assembly).publicReady).toBe(false);
  });

  test.each([
    ["R1-1", "single_detached_house", ["USE", "DENSITY", "DIMENSIONAL", "REQUIREMENT"], "2026-09-14"],
    ["R1-1", "single_detached_house", ["DENSITY"], "2026-09-27"],
    ["R1-1", "duplex_with_secondary_suite", ["USE"], "2026-07-01"],
    ["C-2C", "barber_shop_or_beauty_salon", ["USE", "DIMENSIONAL"], "2026-09-14"],
    ["C-2C", "barber_shop_or_beauty_salon", ["USE"], "2023-01-01"],
  ] as const)("NEGATIVE: real Vancouver AS_OF %s %s %j on %s stays DATA_GAP with the MATERIAL temporal blocker", (zone, use, analyses, asOf) => {
    const r = run(zone, use, [...analyses], asOf, { siteArea: SITE_AREA });
    expect(r.status).toBe("DATA_GAP");
    expect(r.temporalFindings.map((t) => `${t.sourceCode}/${t.materiality}`)).toEqual(["TEMPORAL_ANALYSIS_NOT_YET_APPLIED/MATERIAL"]);
    expect(r.blockers).toContainEqual(expect.objectContaining({ sourceCode: "TEMPORAL_ANALYSIS_NOT_YET_APPLIED", materiality: "MATERIAL" }));
    expect(r.fields.every((f) => f.standing === "UNCONFIRMED_WHILE_BLOCKED")).toBe(true);
    expect(r.designation.value).toBe(zone);
    expect(r.engine.rulePackIds).toEqual([assembly.rulePacks.find((p) => p.zoneDesignation === zone)!.packId]);
    // The real pack's readiness rides along, and does not lift the DATA_GAP.
    expect(r.contractVersion).toBe("e85-public-2");
    const pr = r.packReadiness;
    if (pr.state !== "DISCLOSED") throw new Error(`expected DISCLOSED, got ${pr.state}`);
    expect([pr.releaseStatus, pr.asOfResolution, pr.licence.status, pr.definitionHistory, pr.versionValidity, pr.amendmentIndex.currency]).toEqual([
      "NOT_RELEASED",
      "DISABLED",
      "LICENSE_UNKNOWN",
      "NOT_PROVEN_COMPLETE",
      "UNKNOWN",
      "CHECKED_THROUGH_INDEX_CAPTURE_ONLY",
    ]);
    expect(pr.amendmentIndex.captureDate).toBe("2026-09-15");
    expect(pr.withheldValues.map((w) => w.factId)).toEqual(["r1-1-requirement-002"]);
  });

  test("the licence unknown reaches the public response as a readiness warning", () => {
    const r = run("R1-1", "single_detached_house", ["DIMENSIONAL"], "2026-09-14");
    expect(r.warnings.some((w) => w.includes("readiness blocker(s)") && w.includes("LICENSE"))).toBe(true);
  });

  test("the Schedule J rate reaches the public response only as a not-structured finding, never a value", () => {
    const r = run("R1-1", "single_detached_house", ["REQUIREMENT"], "2026-09-14", { siteArea: SITE_AREA });
    const sj = r.sourceFindings.find((s) => (s.finding as { factId?: string }).factId === "r1-1-requirement-002");
    expect((sj?.finding as { message?: string } | undefined)?.message).toContain("NOT structured");
    expect(JSON.stringify(r.fields)).not.toMatch(/cash.?in.?lieu.*rate["']?\s*:\s*\d/i);
  });

  // Replaces the former pinned gate "pack-level disclosures have no slot in the
  // public DTO yet": e85-public-2 adds that slot as `packReadiness`.
  test("pack-level disclosures reach the public DTO as packReadiness, from the assembly and nowhere else", () => {
    const r = run("C-2C", "barber_shop_or_beauty_salon", ["DIMENSIONAL"], "2026-09-14");
    expect(Object.keys(r)).not.toContain("legalPack");
    const pr = r.packReadiness;
    if (pr.state !== "DISCLOSED") throw new Error(`expected DISCLOSED, got ${pr.state}`);
    expect(pr.legalPackId).toBe(assembly.legalPackId);
    expect(pr.openGates.map((g) => g.gateId)).toEqual(assembly.disclosures.openGates.map((g) => g.gateId));
    expect(pr.openGates.map((g) => g.gateId)).toEqual(expect.arrayContaining(["AMENDMENT_INDEX_RECAPTURE", "SCHEDULE_J_SOURCE_IDENTITY", "CITY_Q1_REUSE"]));
    expect(pr.licence.sources.map((s) => s.sourceId).sort()).toEqual(assembly.rulePacks.map((p) => p.sourceId).sort());
    expect(r.status).toBe("DATA_GAP");
  });

  test("a disclosure altered after assembly is refused before any real AS_OF evaluation", () => {
    const pt = C_2C_POINT;
    const parsed = parseE85PublicRequest({ parcel: { point: { ...pt, crs: "EPSG:26910" } }, useCode: "barber_shop_or_beauty_salon", requestedAnalyses: ["USE"], temporal: { mode: "AS_OF", asOfDate: "2026-09-14" } });
    if (!parsed.ok) throw new Error("parse");
    const altered = { ...server("C-2C", pt), legalPack: { legalPackId: assembly.legalPackId, disclosures: { ...assembly.disclosures, asOfResolution: "ENABLED" as unknown as "DISABLED" } } };
    expect(() => evaluateE85PublicRequest(altered, parsed.request)).toThrow(/asOfResolution ENABLED/);
  });
});

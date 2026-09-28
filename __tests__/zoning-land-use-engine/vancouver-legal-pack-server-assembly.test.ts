/**
 * InvestScape™ E85 — Vancouver legal pack → server assembly boundary.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Runs without the evidence folder. PDF digests here are SYNTHETIC stand-ins:
 * the manifest's own pins are passed as "observed", which proves only the
 * assembly logic. The real bytes are hashed in the evidence suite
 * (vancouver-legal-pack-server-assembly-evidence.test.ts).
 */
import { adapters, canonicalRulePackFromBundle, E85LegalPackIntegrityError, E85LegalPackManifest, E85LegalPackSourceContent } from "../../src/zoning-land-use-engine";
import { r11Document } from "./fixtures/vancouver-r1-1-facts";
import { c2cDocument } from "./fixtures/vancouver-c-2c-facts";

const { legalPack } = adapters.vancouver;
const { VANCOUVER_LEGAL_PACK_MANIFEST: MANIFEST, loadVancouverLegalPack, assembleVancouverLegalPackForServer, vancouverLegalPackPublicReadiness } = legalPack;
const EXTRACTED_AT = "2026-09-27T00:00:00.000Z";
const pinnedDigests = (m: E85LegalPackManifest = MANIFEST) => new Map(m.sources.map((s) => [s.sourceId, s.sourcePdfSha256]));
const assemble = (loaded = loadVancouverLegalPack(), digests = pinnedDigests()) => assembleVancouverLegalPackForServer(loaded, { observedPdfSha256BySourceId: digests, extractedAt: EXTRACTED_AT });
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function problemsOf(fn: () => unknown): readonly string[] {
  try {
    fn();
  } catch (e) {
    if (e instanceof E85LegalPackIntegrityError) return e.problems;
    throw e;
  }
  throw new Error("expected E85LegalPackIntegrityError");
}

describe("Vancouver legal pack server assembly", () => {
  test("assembles two BASE rule packs and a two-district linkage from the production pack", () => {
    const a = assemble();
    expect(a.rulePacks.map((p) => p.packId)).toEqual([
      "ca-bc-vancouver:zoning-development-bylaw-3575:district-schedule-r1-1@2026-06-consolidation",
      "ca-bc-vancouver:zoning-development-bylaw-3575:district-schedule-c-2c@2026-05-consolidation",
    ]);
    expect(Object.keys(a.linkPolicy).sort()).toEqual(["C-2C", "R1-1"]);
    expect(a.temporalEvidence).toBeUndefined();
  });

  test("the rule content equals what the test fixture path builds (test-side comparison only)", () => {
    const a = assemble();
    const fromFixtures = [
      adapters.vancouver.vancouverR11Adapter.normalize(r11Document({ extractedAt: EXTRACTED_AT }), adapters.vancouver.VANCOUVER_R1_1_SOURCE),
      adapters.vancouver.vancouverC2CAdapter.normalize(c2cDocument({ extractedAt: EXTRACTED_AT }), adapters.vancouver.VANCOUVER_C_2C_SOURCE),
    ].map((r) => {
      if (r.outcome !== "NORMALIZED") throw new Error(r.outcome);
      return canonicalRulePackFromBundle(r.bundle, "BASE");
    });
    expect(a.rulePacks).toEqual(fromFixtures);
  });

  test("every pack-level disclosure survives, verbatim, and release stays off", () => {
    const d = assemble().disclosures;
    expect(d.releaseStatus).toBe("NOT_RELEASED");
    expect(d.asOfResolution).toBe("DISABLED");
    expect(d.openUnknowns).toEqual({ versionValidity: "UNKNOWN", definitionHistory: "NOT_PROVEN_COMPLETE", licence: "LICENSE_UNKNOWN", amendmentCurrency: "CHECKED_THROUGH_INDEX_CAPTURE_ONLY" });
    expect(d.currencyCheckedThrough.indexCaptureDate).toBe("2026-09-28");
    expect(d.sourceLicences.every((s) => s.licenseStatus === "LICENSE_UNKNOWN" && s.versionEffectiveDateBasis === "UNKNOWN")).toBe(true);
    expect(d.withheldValues).toEqual([{ factId: "r1-1-requirement-002", what: "Schedule J §8.1.1 cash-in-lieu rate", gateId: "SCHEDULE_J_SOURCE_IDENTITY" }]);
    expect(d.packLevelDisclosures).toEqual(MANIFEST.packLevelDisclosures);
    expect(d.openGates).toEqual(MANIFEST.openGates);
  });

  test("licence and version-validity unknowns reach the rule packs themselves", () => {
    for (const p of assemble().rulePacks) {
      expect(p.readiness?.blockers).toContain("LICENSE");
      expect(p.readiness?.overall).toBe("BLOCKED");
    }
    for (const c of legalPack.VANCOUVER_LEGAL_PACK_CONTENT) for (const v of c.source.versions) expect([v.effectiveDateBasis, v.effectiveFrom]).toEqual(["UNKNOWN", undefined]);
  });

  test("the Schedule J rate stays withheld: finding says not structured, no rate value anywhere", () => {
    const r11 = assemble().bundles.find((b) => b.zoneDesignation === "R1-1")!;
    const finding = r11.findings.find((f) => f.factId === "r1-1-requirement-002");
    expect(finding?.message).toContain("NOT structured");
    expect(JSON.stringify(r11.rules)).not.toMatch(/cashInLieuRate|ratePerSq/i);
  });

  test("a matching pack is still not public-ready", () => {
    const r = vancouverLegalPackPublicReadiness(assemble());
    expect(r.publicReady).toBe(false);
    expect(r.blockedBy).toEqual(expect.arrayContaining(["releaseStatus:NOT_RELEASED", "asOfResolution:DISABLED", "gate:SCHEDULE_J_SOURCE_IDENTITY", "gate:AMENDMENT_INDEX_RECAPTURE", "gate:CITY_Q1_REUSE"]));
  });

  describe("fails closed", () => {
    test("a missing PDF digest", () => {
      const digests = pinnedDigests();
      digests.delete(MANIFEST.sources[1].sourceId);
      expect(problemsOf(() => assemble(undefined, digests))).toEqual([`${MANIFEST.sources[1].sourceId}: no source bytes were hashed`]);
    });

    test("a PDF digest that differs from the pin", () => {
      const digests = pinnedDigests();
      digests.set(MANIFEST.sources[0].sourceId, "0".repeat(64));
      expect(problemsOf(() => assemble(undefined, digests))[0]).toMatch(/source PDF is 0{64}, pack is bound to 2526db0b/);
    });

    test("a fact edited after load (fact-set mismatch), even when the PDF digests match", () => {
      const loaded = loadVancouverLegalPack();
      const content = loaded.content.map((c, i): E85LegalPackSourceContent => (i === 0 ? { ...c, facts: clone(c.facts).map((f, j) => (j === 0 ? { ...f, sourceText: `${String((f as { sourceText?: string }).sourceText)} (edited)` } : f)) } : c));
      expect(problemsOf(() => assemble({ manifest: loaded.manifest, content }))).toEqual([expect.stringMatching(/fact set digest [0-9a-f]{64} is not pinned 0fee9c56/)]);
    });

    test("a manifest that claims release, AS_OF resolution or a known licence", () => {
      const forged = { ...clone(MANIFEST), releaseStatus: "RELEASED", asOfResolution: "ENABLED" } as unknown as E85LegalPackManifest;
      const p = problemsOf(() => assemble({ manifest: forged, content: legalPack.VANCOUVER_LEGAL_PACK_CONTENT }, pinnedDigests(forged)));
      expect(p).toEqual(expect.arrayContaining(["releaseStatus RELEASED is not NOT_RELEASED", "asOfResolution ENABLED is not DISABLED"]));
      const licensed = clone(MANIFEST) as { -readonly [K in keyof E85LegalPackManifest]: E85LegalPackManifest[K] };
      licensed.sources = licensed.sources.map((s) => ({ ...s, licenseStatus: "PUBLIC_REUSE" as const }));
      expect(problemsOf(() => assemble({ manifest: licensed, content: legalPack.VANCOUVER_LEGAL_PACK_CONTENT }, pinnedDigests(licensed)))).toEqual(
        expect.arrayContaining([expect.stringMatching(/licence PUBLIC_REUSE contradicts openUnknowns/)]),
      );
    });

    test("a manifest with an open gate or disclosure removed", () => {
      const m = { ...clone(MANIFEST), openGates: MANIFEST.openGates.filter((g) => g.gateId !== "SCHEDULE_J_SOURCE_IDENTITY"), packLevelDisclosures: [] } as E85LegalPackManifest;
      expect(problemsOf(() => assemble({ manifest: m, content: legalPack.VANCOUVER_LEGAL_PACK_CONTENT }))).toEqual(
        expect.arrayContaining(["open gate SCHEDULE_J_SOURCE_IDENTITY is missing", "packLevelDisclosures is empty"]),
      );
    });

    test("a non-UTC or missing extraction timestamp", () => {
      expect(problemsOf(() => assembleVancouverLegalPackForServer(loadVancouverLegalPack(), { observedPdfSha256BySourceId: pinnedDigests(), extractedAt: "2026-09-27" }))).toEqual([
        "extractedAt 2026-09-27 is not an ISO 8601 UTC timestamp",
      ]);
    });
  });

  test("production assembly source imports no test fixture", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const src = require("fs").readFileSync(require("path").join(__dirname, "../../src/zoning-land-use-engine/adapters/vancouver/legal-pack/server-assembly.ts"), "utf8") as string;
    expect(src).not.toMatch(/__tests__|fixtures|r11Document|c2cDocument|EXTRACTED_AT/);
  });
});

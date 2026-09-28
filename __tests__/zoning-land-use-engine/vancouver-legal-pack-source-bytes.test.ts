/**
 * InvestScape™ E85 — Vancouver legal pack against the pinned evidence bytes.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Evidence gate (`npm run test:evidence`). Re-hashes every PDF the pack
 * manifest pins, located through the workspace's committed
 * e85-pilot-evidence/PDF-SOURCES.sha256, and checks the manifest against the
 * audited VANCOUVER-LEGAL-PACK-MANIFEST.proposed.json. The PDFs are not in git;
 * under the gate a missing file fails rather than skips.
 */
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { adapters, e85LegalPackSourceByteProblems } from "../../src/zoning-land-use-engine";

const { VANCOUVER_LEGAL_PACK_MANIFEST: MANIFEST } = adapters.vancouver.legalPack;

const EVIDENCE = path.join(__dirname, "../../../e85-pilot-evidence");
const CHECKSUMS = path.join(EVIDENCE, "PDF-SOURCES.sha256");
const PROPOSED = path.join(EVIDENCE, "VANCOUVER-LEGAL-PACK-MANIFEST.proposed.json");
const HAVE_EVIDENCE = fs.existsSync(CHECKSUMS) && fs.existsSync(PROPOSED);
const EVIDENCE_REQUIRED = process.env.E85_EVIDENCE_GATE === "1" || (process.env.CI !== undefined && process.env.CI !== "" && process.env.CI !== "false");
if (!HAVE_EVIDENCE && !EVIDENCE_REQUIRED) console.warn(`Evidence folder not found at ${EVIDENCE}; the legal-pack byte suite is skipped.`);

/** sha256 -> relative path, from the committed checksum manifest. */
function checksumIndex(): Map<string, string> {
  const index = new Map<string, string>();
  for (const line of fs.readFileSync(CHECKSUMS, "utf8").split(/\r?\n/)) {
    const m = /^([0-9a-f]{64}) [ *]?(.+)$/.exec(line.trim());
    if (m) index.set(m[1], m[2]);
  }
  return index;
}

const sha256File = (rel: string): string => crypto.createHash("sha256").update(fs.readFileSync(path.join(EVIDENCE, rel))).digest("hex");

(EVIDENCE_REQUIRED || HAVE_EVIDENCE ? describe : describe.skip)("Vancouver legal pack — pinned evidence bytes", () => {
  beforeAll(() => {
    if (!HAVE_EVIDENCE) throw new Error(`Evidence gate: ${CHECKSUMS} or ${PROPOSED} not found. The gate refuses to pass by skipping.`);
  });

  test("every pinned digest is a committed evidence checksum", () => {
    const index = checksumIndex();
    const pins = [...MANIFEST.sources.map((s) => s.sourcePdfSha256), ...MANIFEST.instruments.map((i) => i.sha256), MANIFEST.currencyCheckedThrough.indexSha256];
    for (const pin of pins) expect(index.has(pin)).toBe(true);
  });

  test("the schedule PDFs on disk are the bytes the pack is bound to", () => {
    const index = checksumIndex();
    const observed = new Map(MANIFEST.sources.map((s) => [s.sourceId, sha256File(index.get(s.sourcePdfSha256)!)]));
    expect(e85LegalPackSourceByteProblems(MANIFEST, observed)).toEqual([]);
  });

  test("the authority instruments and amendment index on disk match their pins", () => {
    const index = checksumIndex();
    for (const pin of [...MANIFEST.instruments.map((i) => i.sha256), MANIFEST.currencyCheckedThrough.indexSha256]) expect(sha256File(index.get(pin)!)).toBe(pin);
  });

  test("the manifest agrees with the audited proposal on identity, bytes and fact ids", () => {
    const proposed = JSON.parse(fs.readFileSync(PROPOSED, "utf8")) as {
      legalPackId: string;
      jurisdictionId: string;
      currencyCheckedThrough: { date: string; sha256: string };
      sources: { sourceId: string; sourceVersionId: string; consolidationPeriod: string; versionEffectiveDateBasis: string; adapterId: string; licenseStatus: string; pdf: { sha256: string }; facts: { factId: string }[] }[];
      authorityInstruments: { bylaw: string; sha256: string }[];
    };
    expect(MANIFEST.legalPackId).toBe(proposed.legalPackId);
    expect(MANIFEST.jurisdictionId).toBe(proposed.jurisdictionId);
    expect(MANIFEST.currencyCheckedThrough).toEqual({ indexCaptureDate: proposed.currencyCheckedThrough.date, indexSha256: proposed.currencyCheckedThrough.sha256 });
    for (const s of MANIFEST.sources) {
      const p = proposed.sources.find((x) => x.sourceId === s.sourceId);
      expect(p).toBeDefined();
      expect([s.sourceVersionId, s.consolidationPeriod, s.versionEffectiveDateBasis, s.adapterId, s.licenseStatus, s.sourcePdfSha256]).toEqual([
        p!.sourceVersionId,
        p!.consolidationPeriod,
        p!.versionEffectiveDateBasis,
        p!.adapterId,
        p!.licenseStatus,
        p!.pdf.sha256,
      ]);
      expect([...s.factIds].sort()).toEqual(p!.facts.map((f) => f.factId).sort());
    }
    for (const i of MANIFEST.instruments) expect(proposed.authorityInstruments.find((a) => a.bylaw === i.bylawOrDocumentId)?.sha256).toBe(i.sha256);
  });
});

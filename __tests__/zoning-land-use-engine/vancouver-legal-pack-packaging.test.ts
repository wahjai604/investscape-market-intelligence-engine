/**
 * InvestScape™ E85 — Vancouver legal-pack packaging.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Proves the production facts load only when they match the pinned manifest,
 * that the test fixtures ARE the production facts rather than a copy, and that
 * the pack claims no date, licence or currency the evidence does not support.
 * Hermetic: the only file read is this package's own fixture source.
 */
import * as fs from "fs";
import * as path from "path";
import {
  adapters,
  digestE85LegalPackFactSet,
  E85LegalPackIntegrityError,
  E85LegalPackManifest,
  E85LegalPackSourceContent,
  e85LegalPackSourceByteProblems,
  E85StructuredSourceFact,
} from "../../src/zoning-land-use-engine";
import * as r11Fixture from "./fixtures/vancouver-r1-1-facts";
import * as c2cFixture from "./fixtures/vancouver-c-2c-facts";

const { legalPack } = adapters.vancouver;
const { VANCOUVER_LEGAL_PACK_MANIFEST: MANIFEST, VANCOUVER_LEGAL_PACK_CONTENT: CONTENT, loadVancouverLegalPack } = legalPack;

function expectRefused(manifest: E85LegalPackManifest, content: readonly E85LegalPackSourceContent[], pattern: RegExp): void {
  let thrown: unknown;
  try {
    loadVancouverLegalPack(manifest, content);
  } catch (e) {
    thrown = e;
  }
  expect(thrown).toBeInstanceOf(E85LegalPackIntegrityError);
  expect((thrown as E85LegalPackIntegrityError).problems.some((p) => pattern.test(p))).toBe(true);
}

const withContent = (index: number, patch: Partial<E85LegalPackSourceContent>): E85LegalPackSourceContent[] => CONTENT.map((c, i) => (i === index ? { ...c, ...patch } : c));
const withSource = (index: number, patch: Partial<E85LegalPackManifest["sources"][number]>): E85LegalPackManifest => ({
  ...MANIFEST,
  sources: MANIFEST.sources.map((s, i) => (i === index ? { ...s, ...patch } : s)),
});

describe("startup gate", () => {
  test("the shipped pack loads", () => {
    const loaded = loadVancouverLegalPack();
    expect(loaded.manifest.legalPackId).toBe("ca-bc-vancouver.base-zoning.r1-1+c-2c");
    expect(loaded.content.map((c) => c.facts.length)).toEqual([19, 7]);
  });

  test("the pinned digests are the digests of the shipped facts", () => {
    expect(digestE85LegalPackFactSet(legalPack.R1_1_FACTS, legalPack.R1_1_UNSTRUCTURED_SECTIONS)).toBe(MANIFEST.sources[0].factSetSha256);
    expect(digestE85LegalPackFactSet(legalPack.C_2C_FACTS, legalPack.C_2C_UNSTRUCTURED_SECTIONS)).toBe(MANIFEST.sources[1].factSetSha256);
  });

  test("a changed value is refused", () => {
    const facts = legalPack.R1_1_FACTS.map((f): E85StructuredSourceFact => (f.factId === "r1-1-density-002" ? { ...f, numericValue: 1.1 } : f));
    expectRefused(MANIFEST, withContent(0, { facts }), /fact set digest/);
  });

  test("a changed qualification, date or locator is refused", () => {
    const edits: ((f: E85StructuredSourceFact) => E85StructuredSourceFact)[] = [
      (f) => ({ ...f, qualifications: [] }),
      (f) => ({ ...f, temporal: { effectiveFrom: "2022-11-15", effectiveDateBasis: "AMENDMENT_DATE_KNOWN" } }),
      (f) => ({ ...f, temporalAuthority: { ...f.temporalAuthority!, commencementLocator: { bylawOrDocumentId: "13447", clause: "28" } } }),
    ];
    for (const edit of edits) {
      const facts = legalPack.C_2C_FACTS.map((f) => (f.factId === "c-2c-use-001" ? edit(f) : f));
      expectRefused(MANIFEST, withContent(1, { facts }), /fact set digest/);
    }
  });

  test("an added, dropped or reordered fact is refused", () => {
    const [first, ...rest] = legalPack.C_2C_FACTS;
    expectRefused(MANIFEST, withContent(1, { facts: rest }), /fact ids differ/);
    expectRefused(MANIFEST, withContent(1, { facts: [...rest, first] }), /fact ids differ/);
    expectRefused(MANIFEST, withContent(1, { facts: [...legalPack.C_2C_FACTS, { ...first, factId: "c-2c-use-099" }] }), /fact ids differ/);
  });

  test("a changed unstructured-section disclosure is refused", () => {
    expectRefused(MANIFEST, withContent(1, { unstructuredSections: legalPack.C_2C_UNSTRUCTURED_SECTIONS.slice(1) }), /fact set digest/);
  });

  test("adapter identity drift is refused", () => {
    const adapter = CONTENT[0].adapter;
    expectRefused(MANIFEST, withContent(0, { adapter: { ...adapter, identity: { ...adapter.identity, adapterVersion: "1.2.0" } } }), /adapter version 1\.2\.0/);
    expectRefused(MANIFEST, withContent(0, { adapter: CONTENT[1].adapter }), /adapter is ca-bc-vancouver\.district-schedule\.c-2c/);
    expectRefused(withSource(0, { adapterVersion: "1.0.0" }), CONTENT, /not pinned 1\.0\.0/);
  });

  test("source version drift is refused", () => {
    const source = CONTENT[1].source;
    expectRefused(MANIFEST, withContent(1, { source: { ...source, versions: [{ ...source.versions[0], versionId: "2026-09-consolidation" }] } }), /not registered/);
    expectRefused(MANIFEST, withContent(1, { source: { ...source, versions: [{ ...source.versions[0], consolidationPeriod: "2026-06" }] } }), /consolidation period/);
  });

  test("a source version that gains an effective date is refused", () => {
    const source = CONTENT[0].source;
    const dated = { ...source, versions: [{ ...source.versions[0], effectiveFrom: "2026-06-01", effectiveDateBasis: "PUBLICATION_DATE_INFERRED" as const }] };
    expectRefused(MANIFEST, withContent(0, { source: dated }), /claims an effective date/);
  });

  test("a source that claims reuse rights is refused", () => {
    expectRefused(MANIFEST, withContent(0, { source: { ...CONTENT[0].source, licenseStatus: "PUBLIC_REUSE" } }), /licence PUBLIC_REUSE/);
  });

  test("a fact dated by an instrument without a pinned digest is refused", () => {
    const manifest = { ...MANIFEST, instruments: MANIFEST.instruments.filter((i) => i.bylawOrDocumentId !== "14747") };
    expectRefused(manifest, CONTENT, /instrument 14747, which has no pinned digest/);
  });

  test("a missing or extra source is refused", () => {
    expectRefused(MANIFEST, CONTENT.slice(0, 1), /not supplied/);
    expectRefused({ ...MANIFEST, sources: MANIFEST.sources.slice(0, 1) }, CONTENT, /not in the manifest/);
  });

  test("the error lists every problem, not the first", () => {
    const facts = legalPack.R1_1_FACTS.slice(1);
    const adapter = { ...CONTENT[0].adapter, identity: { ...CONTENT[0].adapter.identity, adapterVersion: "9.9.9" } };
    try {
      loadVancouverLegalPack(MANIFEST, withContent(0, { facts, adapter }));
      throw new Error("expected refusal");
    } catch (e) {
      expect((e as E85LegalPackIntegrityError).problems.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("source byte binding", () => {
  const observed = new Map(MANIFEST.sources.map((s) => [s.sourceId, s.sourcePdfSha256]));

  test("matching digests pass", () => {
    expect(e85LegalPackSourceByteProblems(MANIFEST, observed)).toEqual([]);
  });

  test("an unhashed source is a problem, never a pass", () => {
    expect(e85LegalPackSourceByteProblems(MANIFEST, new Map())).toHaveLength(2);
  });

  test("different bytes are a problem", () => {
    const changed = new Map(observed);
    changed.set(MANIFEST.sources[0].sourceId, "0".repeat(64));
    expect(e85LegalPackSourceByteProblems(MANIFEST, changed)).toEqual([expect.stringMatching(/source PDF is 0{64}/)]);
  });
});

describe("fixtures and production cannot diverge", () => {
  test("every fact the fixtures export is the production object itself", () => {
    const pairs: [Record<string, unknown>, Record<string, unknown>][] = [
      [r11Fixture as Record<string, unknown>, legalPack as Record<string, unknown>],
      [c2cFixture as Record<string, unknown>, legalPack as Record<string, unknown>],
    ];
    let checked = 0;
    for (const [fixture, production] of pairs) {
      for (const [name, value] of Object.entries(fixture)) {
        if (typeof value !== "object" || value === null) continue;
        expect(production[name]).toBe(value);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(26);
    expect(r11Fixture.R1_1_FACTS).toBe(legalPack.R1_1_FACTS);
    expect(c2cFixture.C_2C_FACTS).toBe(legalPack.C_2C_FACTS);
  });

  test("the fixture documents carry the production facts", () => {
    expect(r11Fixture.r11Document().facts).toBe(legalPack.R1_1_FACTS);
    expect(c2cFixture.c2cDocument().facts).toBe(legalPack.C_2C_FACTS);
    expect(r11Fixture.r11Document().unstructuredSections).toBe(legalPack.R1_1_UNSTRUCTURED_SECTIONS);
    expect(c2cFixture.c2cDocument().unstructuredSections).toBe(legalPack.C_2C_UNSTRUCTURED_SECTIONS);
  });

  test.each(["vancouver-r1-1-facts.ts", "vancouver-c-2c-facts.ts"])("%s defines no fact of its own", (file) => {
    const text = fs.readFileSync(path.join(__dirname, "fixtures", file), "utf8");
    for (const marker of ["factId:", "numericValue:", "temporalAuthority:", "qualificationId:", "E85StructuredSourceFact ="]) expect(text).not.toContain(marker);
  });
});

describe("the pack claims nothing the evidence does not support", () => {
  test("AS_OF resolution is disabled and the pack is not released", () => {
    expect(MANIFEST.asOfResolution).toBe("DISABLED");
    expect(MANIFEST.releaseStatus).toBe("NOT_RELEASED");
  });

  test("version validity, definition history, licence and currency stay open", () => {
    expect(MANIFEST.openUnknowns).toEqual({
      versionValidity: "UNKNOWN",
      definitionHistory: "NOT_PROVEN_COMPLETE",
      licence: "LICENSE_UNKNOWN",
      amendmentCurrency: "CHECKED_THROUGH_INDEX_CAPTURE_ONLY",
    });
    for (const s of MANIFEST.sources) {
      expect(s.versionEffectiveDateBasis).toBe("UNKNOWN");
      expect(s.licenseStatus).toBe("LICENSE_UNKNOWN");
    }
    for (const c of CONTENT) for (const v of c.source.versions) expect(v.effectiveFrom).toBeUndefined();
    expect(MANIFEST.reproduction.bylawText).toBe("NOT_ESTABLISHED_DO_NOT_REPRODUCE");
  });

  test("the only date in the manifest is the amendment index capture", () => {
    const dates = JSON.stringify(MANIFEST).match(/\d{4}-\d{2}-\d{2}/g) ?? [];
    // Disclosures and gates may name dates they discuss; structured fields may carry only the capture date.
    const structured = JSON.stringify({ ...MANIFEST, packLevelDisclosures: [], openGates: [] }).match(/\d{4}-\d{2}-\d{2}/g) ?? [];
    expect(new Set(structured)).toEqual(new Set(["2026-09-15"]));
    expect(dates.length).toBeGreaterThan(0);
  });

  test("every City-dependent gate is still listed", () => {
    expect(MANIFEST.openGates.map((g) => g.gateId)).toEqual(
      expect.arrayContaining(["CITY_Q1_REUSE", "CITY_Q2_CONSOLIDATION_TIMING", "CITY_Q3_VOLUME_CURRENCY", "CITY_Q4_DEFINITION_HISTORY", "CITY_Q5_MISSING_C_2C_INSTRUMENTS", "CITY_Q6_LAYER_AUTHORITY", "AMENDMENT_INDEX_RECAPTURE"]),
    );
  });

  test("nothing outside the legal pack imports it", () => {
    const root = path.join(__dirname, "../../src");
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "legal-pack") walk(full);
        } else if (/\.ts$/.test(entry.name) && /from "[^"]*\/legal-pack(\/[^"]*)?"|loadVancouverLegalPack|VANCOUVER_LEGAL_PACK_/.test(fs.readFileSync(full, "utf8"))) {
          offenders.push(path.relative(root, full));
        }
      }
    };
    walk(root);
    // Only the barrel re-export, which keeps the pack reachable without wiring it into a decision path.
    expect(offenders.map((p) => p.replace(/\\/g, "/"))).toEqual(["zoning-land-use-engine/adapters/vancouver/index.ts"]);
  });
});

/**
 * InvestScape™ E85 — Vancouver R1-1 / C-2C readiness-audit corrections.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * One focused check per correction in VANCOUVER-LEGAL-PACK-READINESS.md §3:
 * each corrected locator and qualification, that values, scopes and dates are
 * unchanged, and that no qualification became a limit or a date.
 */
import * as fs from "fs";
import * as path from "path";
import {
  adapters,
  e85FactQualificationProblem,
  E85DensityRule,
  E85DimensionalRule,
  E85Evidence,
  E85NormalizedRuleBundle,
  E85StructuredFactQualification,
  E85StructuredSourceFact,
  E85UsePermission,
  E85UseRule,
} from "../../src/zoning-land-use-engine";
import { C_2C_ENCLOSED_BUILDING_CONDITION, C_2C_ENCLOSED_BUILDING_QUALIFICATION, C_2C_FACTS, c2cDocument } from "./fixtures/vancouver-c-2c-facts";
import { R1_1_DUPLEX_SUITE_LIMIT_CONDITION, R1_1_DUPLEX_SUITE_TREE_CONDITION, R1_1_FACTS, R1_1_OWNER_OCCUPIED_EXCEPTION, r11Document } from "./fixtures/vancouver-r1-1-facts";

const { vancouverC2CAdapter, VANCOUVER_C_2C_SOURCE, VANCOUVER_C_2C_ADAPTER_VERSION, vancouverR11Adapter, VANCOUVER_R1_1_SOURCE, VANCOUVER_R1_1_ADAPTER_VERSION } = adapters.vancouver;

function c2c(facts: readonly E85StructuredSourceFact[] = C_2C_FACTS): E85NormalizedRuleBundle {
  const result = vancouverC2CAdapter.normalize(c2cDocument({ facts }), VANCOUVER_C_2C_SOURCE);
  if (result.outcome !== "NORMALIZED") throw new Error(`expected NORMALIZED, got ${result.outcome}`);
  return result.bundle;
}
function r11(facts: readonly E85StructuredSourceFact[] = R1_1_FACTS): E85NormalizedRuleBundle {
  const result = vancouverR11Adapter.normalize(r11Document({ facts }), VANCOUVER_R1_1_SOURCE);
  if (result.outcome !== "NORMALIZED") throw new Error(`expected NORMALIZED, got ${result.outcome}`);
  return result.bundle;
}
const fact = (facts: readonly E85StructuredSourceFact[], id: string): E85StructuredSourceFact => {
  const found = facts.find((f) => f.factId === id);
  if (found === undefined) throw new Error(`no fact ${id}`);
  return found;
};
const disclosures = (b: E85NormalizedRuleBundle, factId: string) => b.findings.filter((f) => f.factId === factId && f.code === "SOURCE_QUALIFICATION_DISCLOSED");
const permissionFor = (b: E85NormalizedRuleBundle, row: string): E85Evidence<E85UsePermission> | undefined =>
  b.rules.find((r): r is E85UseRule => r.family === "USE")?.permissions.find((p) => p.provenance.documentLocator?.row === row);

const C_2C_USE_IDS = ["c-2c-use-001", "c-2c-use-002", "c-2c-use-003", "c-2c-use-004", "c-2c-use-005", "c-2c-use-006"];
const QUALIFIED_IDS = [...C_2C_USE_IDS, "c-2c-dim-001", "r1-1-use-004", "r1-1-density-004", "r1-1-density-005", "r1-1-density-006"];

describe("C-2C: commencement locator is By-law 13447 cl.89 on all seven facts", () => {
  test("every fact cites cl.28 as the proposition and cl.89 as the commencement; the date is unchanged", () => {
    expect(C_2C_FACTS).toHaveLength(7);
    for (const f of C_2C_FACTS) {
      expect(f.temporalAuthority?.propositionLocator).toEqual({ bylawOrDocumentId: "13447", clause: "28" });
      expect(f.temporalAuthority?.commencementLocator).toEqual({ bylawOrDocumentId: "13447", clause: "89" });
      expect(f.temporal).toEqual({ effectiveFrom: "2022-11-14", effectiveDateBasis: "AMENDMENT_DATE_KNOWN" });
    }
  });

  test("the corrected commencement reaches every normalized evidence item", () => {
    const b = c2c();
    const use = b.rules.find((r): r is E85UseRule => r.family === "USE")!;
    const dim = b.rules.find((r): r is E85DimensionalRule => r.family === "DIMENSIONAL")!;
    const evidence: E85Evidence<unknown>[] = [...use.permissions, dim.setbacksMetres!.front!];
    expect(evidence).toHaveLength(7);
    for (const ev of evidence) expect(ev.provenance.temporalAuthority?.commencementLocator).toEqual({ bylawOrDocumentId: "13447", clause: "89" });
  });
});

describe("C-2C: §2.2.1 enclosed-building qualification on the six use facts", () => {
  test("each use fact carries it, located at §2.2.1 p.5, with its partly unlocated history disclosed", () => {
    for (const id of C_2C_USE_IDS) expect(fact(C_2C_FACTS, id).qualifications).toEqual([C_2C_ENCLOSED_BUILDING_QUALIFICATION]);
    const q = C_2C_ENCLOSED_BUILDING_QUALIFICATION;
    expect(q.kind).toBe("USE_SPECIFIC_REGULATION");
    expect(q.locator).toEqual({ section: "2.2.1", page: 5 });
    expect(q.history.status).toBe("PARTLY_UNLOCATED");
    expect(q.history.locatedInstruments).toEqual([
      { bylawOrDocumentId: "13967", clause: "19" },
      { bylawOrDocumentId: "14485", clause: "9" },
    ]);
    expect(q.history.disclosure).toMatch(/No instrument has been located for exception limb \(f\)/);
  });

  test("each use is still Outright and dated 2022-11-14, and surfaces one WARNING disclosure", () => {
    const b = c2c();
    for (const id of C_2C_USE_IDS) {
      const f = fact(C_2C_FACTS, id);
      const p = permissionFor(b, f.sourceUseTerm!);
      expect(p?.value.status).toBe("PERMITTED");
      expect(p?.temporal.effectiveFrom).toBe("2022-11-14");
      const d = disclosures(b, id);
      expect(d).toHaveLength(1);
      expect(d[0].severity).toBe("WARNING");
      expect(d[0].message).toMatch(/§2\.2\.1 p\.5/);
      expect(d[0].message).toMatch(/History PARTLY_UNLOCATED/);
    }
  });
});

describe("C-2C dim-001: both front-yard citations and the Director relaxation", () => {
  const dim = fact(C_2C_FACTS, "c-2c-dim-001");

  test("cites §3.1.2.3 p.9 as primary and §3.2.2.3 p.12 as additional; the bundle says so", () => {
    expect(dim.locator).toEqual({ section: "3.1.2.3", page: 9 });
    expect(dim.additionalLocators).toEqual([{ section: "3.2.2.3", page: 12 }]);
    const extra = c2c().findings.filter((f) => f.factId === "c-2c-dim-001" && f.code === "SOURCE_LOCATOR_ADDITIONAL");
    expect(extra).toHaveLength(1);
    expect(extra[0].message).toMatch(/§3\.2\.2\.3 p\.12/);
  });

  test("discloses §3.1.2.10 p.10 and §3.2.2.8 p.13 as discretionary, and 2.5 m stays the minimum", () => {
    expect(dim.qualifications?.map((q) => [q.kind, q.locator])).toEqual([
      ["DISCRETIONARY_RELAXATION", { section: "3.1.2.10", page: 10 }],
      ["DISCRETIONARY_RELAXATION", { section: "3.2.2.8", page: 13 }],
    ]);
    const b = c2c();
    const front = b.rules.find((r): r is E85DimensionalRule => r.family === "DIMENSIONAL")!.setbacksMetres!.front!;
    expect(front.value).toBe(2.5);
    for (const d of disclosures(b, "c-2c-dim-001")) expect(d.message).toMatch(/not an entitlement/);
  });
});

describe("R1-1 use-004: secondary-suite limit and §2.2.1 disclosed", () => {
  test("carries §2.2.1 p.4 and §2.2.3 p.5, and stays Conditional", () => {
    const f = fact(R1_1_FACTS, "r1-1-use-004");
    expect(f.qualifications?.map((q) => [q.kind, q.locator])).toEqual([
      ["USE_SPECIFIC_REGULATION", { section: "2.2.1", page: 4 }],
      ["USE_SPECIFIC_REGULATION", { section: "2.2.3", page: 5 }],
    ]);
    expect(f.qualifications?.[1].description).toMatch(/no more than 1 secondary suite for each dwelling unit/);
    const b = r11();
    expect(permissionFor(b, f.sourceUseTerm!)?.value.status).toBe("CONDITIONAL");
    expect(disclosures(b, "r1-1-use-004")).toHaveLength(2);
  });
});

describe("R1-1 density-004: character-house relaxation disclosed, not applied", () => {
  const f = fact(R1_1_FACTS, "r1-1-density-004");
  const q = f.qualifications?.[0] as E85StructuredFactQualification;

  test("is a DISCRETIONARY_RELAXATION at §5.1 p.17 with its located history", () => {
    expect(f.qualifications).toHaveLength(1);
    expect(q.kind).toBe("DISCRETIONARY_RELAXATION");
    expect(q.locator).toEqual({ section: "5.1", page: 17 });
    expect(q.history.status).toBe("INSTRUMENTS_LOCATED");
    expect(q.history.locatedInstruments).toEqual(
      expect.arrayContaining([
        { bylawOrDocumentId: "14747", clause: "4(o)" },
        { bylawOrDocumentId: "14747", clause: "4(e)" },
        { bylawOrDocumentId: "13817", schedule: "Schedule A", section: "3.2.1.2", page: 21 },
      ]),
    );
  });

  test("0.60 remains the only FSR for this scope; no 0.65, 0.75 or 0.85 limit exists anywhere in the bundle", () => {
    const fsr = r11()
      .rules.filter((r): r is E85DensityRule => r.family === "DENSITY")
      .map((r) => r.maxFsr?.value)
      .filter((v): v is number => v !== undefined);
    expect(fsr).toContain(0.6);
    for (const relaxed of [0.65, 0.75, 0.85]) expect(fsr).not.toContain(relaxed);
    expect(f.numericValue).toBe(0.6);
    expect(f.condition).toBeUndefined();
  });
});

describe("R1-1 density-005/006: §3.1.1.4 owner-occupied exception attached to both", () => {
  test("both caps carry the same EXCEPTION at §3.1.1.4 p.8, and the caps are unchanged", () => {
    const d5 = fact(R1_1_FACTS, "r1-1-density-005");
    const d6 = fact(R1_1_FACTS, "r1-1-density-006");
    expect(d5.qualifications).toEqual([R1_1_OWNER_OCCUPIED_EXCEPTION]);
    expect(d6.qualifications).toEqual([R1_1_OWNER_OCCUPIED_EXCEPTION]);
    expect(R1_1_OWNER_OCCUPIED_EXCEPTION.kind).toBe("EXCEPTION");
    expect(R1_1_OWNER_OCCUPIED_EXCEPTION.locator).toEqual({ section: "3.1.1.4", page: 8 });
    expect(R1_1_OWNER_OCCUPIED_EXCEPTION.history.locatedInstruments).toContainEqual({ bylawOrDocumentId: "14747", clause: "4(d)" });
    expect([d5.numericValue, d6.numericValue]).toEqual([8, 6]);
    const units = r11()
      .rules.filter((r): r is E85DensityRule => r.family === "DENSITY")
      .map((r) => r.maxDwellingUnits?.value)
      .filter((v): v is number => v !== undefined)
      .sort();
    expect(units).toEqual([6, 8]);
  });
});

describe("stale text corrected", () => {
  test("the R1-1 fixture header no longer calls use-005 undated", () => {
    const header = fs.readFileSync(path.join(__dirname, "fixtures/vancouver-r1-1-facts.ts"), "utf8");
    expect(header).not.toMatch(/deliberately KEPT\s+\*?\s*UNKNOWN/);
    expect(fact(R1_1_FACTS, "r1-1-use-005").temporal?.effectiveFrom).toBe("2026-06-30");
  });

  test("the R1-1 limitations no longer say every rule is undated, and keep the version-level UNKNOWN", () => {
    const text = VANCOUVER_R1_1_SOURCE.knownLimitations.join(" ");
    expect(text).not.toMatch(/Rules normalized from this source therefore carry an UNKNOWN temporal basis/);
    expect(text).toMatch(/this version's own temporal basis stays UNKNOWN/);
    expect(text).toMatch(/AMENDMENT HISTORY IS NOT PROVEN COMPLETE/);
  });

  test("both adapters are versioned 1.1.0 for the corrected behaviour", () => {
    expect([VANCOUVER_R1_1_ADAPTER_VERSION, VANCOUVER_C_2C_ADAPTER_VERSION]).toEqual(["1.1.0", "1.1.0"]);
  });
});

describe("guards that did not move", () => {
  test("the Schedule J cash-in-lieu rate stays withheld", () => {
    const cash = fact(R1_1_FACTS, "r1-1-requirement-002");
    expect(cash.numericValue).toBeUndefined();
    expect(cash.requirement?.references?.[0].role).toBe("QUANTIFICATION");
  });

  test("no fact takes the volume's July 29, 2026 cover date, and no qualification carries a date or a number", () => {
    for (const f of [...R1_1_FACTS, ...C_2C_FACTS]) {
      expect(f.temporal?.effectiveFrom).not.toBe("2026-07-29");
      for (const q of f.qualifications ?? []) {
        expect(Object.keys(q).filter((k) => k !== "conditionId").sort()).toEqual(["description", "history", "kind", "locator", "qualificationId"]);
        expect(Object.keys(q.history).every((k) => ["status", "locatedInstruments", "disclosure"].includes(k))).toBe(true);
      }
    }
  });

  test("every qualified fact's FIRST finding is still its real outcome, never the disclosure", () => {
    const all = [...c2c().findings, ...r11().findings];
    for (const id of QUALIFIED_IDS) {
      const first = all.find((f) => f.factId === id);
      expect(first?.code).not.toBe("SOURCE_QUALIFICATION_DISCLOSED");
      expect(first?.code).not.toBe("SOURCE_LOCATOR_ADDITIONAL");
    }
  });
});

describe("fail closed: a qualification that cannot be carried faithfully stops the fact", () => {
  const base = fact(R1_1_FACTS, "r1-1-density-004");
  const withQ = (q: unknown): E85StructuredSourceFact => ({ ...base, qualifications: [q as E85StructuredFactQualification] });
  const good = base.qualifications![0];

  test.each([
    ["a numeric value", { ...good, numericValue: 0.85 }, /never state limits/],
    ["no section", { ...good, locator: { page: 17 } }, /names no section/],
    ["an unresolved history with no disclosure", { ...good, history: { status: "NOT_TRACED" } }, /no disclosure/],
    ["an unknown kind", { ...good, kind: "ENTITLEMENT" }, /unrecognized kind/],
  ])("%s", (_label, q, reason) => {
    const f = withQ(q);
    expect(e85FactQualificationProblem(f)).toMatch(reason);
    const b = r11([f]);
    expect(b.rules.filter((r) => r.family === "DENSITY")).toHaveLength(0);
    expect(b.findings.find((x) => x.factId === f.factId)?.severity).toBe("GAP");
    expect(b.unresolvedSourceItems.map((u) => u.factId)).toContain(f.factId);
  });

  test("an additional locator with no section stops the C-2C fact too", () => {
    const f: E85StructuredSourceFact = { ...fact(C_2C_FACTS, "c-2c-dim-001"), additionalLocators: [{ page: 12 }] };
    const b = c2c([f]);
    expect(b.findings.find((x) => x.factId === f.factId)?.severity).toBe("GAP");
  });
});

describe("a use-specific regulation on a use gates the permission; it is never disclosure-only", () => {
  test("each C-2C use requires the §2.2.1 condition on its normalized permission", () => {
    const b = c2c();
    for (const id of C_2C_USE_IDS) {
      const row = fact(C_2C_FACTS, id).locator.row as string;
      expect(permissionFor(b, row)?.applicability?.requiredConditionIds).toEqual([C_2C_ENCLOSED_BUILDING_CONDITION]);
      expect(permissionFor(b, row)?.applicability?.locators?.requiredConditionIds).toEqual({ section: "2.2.1", page: 5 });
    }
  });

  test("R1-1 use-004 requires both §2.2 conditions", () => {
    const f = fact(R1_1_FACTS, "r1-1-use-004");
    const p = permissionFor(r11(), f.locator.row as string);
    expect([...(p?.applicability?.requiredConditionIds ?? [])].sort()).toEqual([R1_1_DUPLEX_SUITE_LIMIT_CONDITION, R1_1_DUPLEX_SUITE_TREE_CONDITION].sort());
  });

  test("a USE_SPECIFIC_REGULATION on a use fact with no gating condition stops the fact", () => {
    const base = fact(C_2C_FACTS, "c-2c-use-002");
    const { applicability: _dropped, ...ungated } = base;
    const bare: E85StructuredSourceFact = { ...ungated, qualifications: [{ ...C_2C_ENCLOSED_BUILDING_QUALIFICATION, conditionId: undefined }] };
    delete (bare.qualifications![0] as { conditionId?: string }).conditionId;
    expect(e85FactQualificationProblem(bare)).toMatch(/no gating condition/);
    expect(permissionFor(c2c([bare]), base.locator.row as string)).toBeUndefined();
  });

  test("a qualification naming a condition the fact does not require stops the fact", () => {
    const base = fact(C_2C_FACTS, "c-2c-use-002");
    const { applicability: _dropped, ...ungated } = base;
    expect(e85FactQualificationProblem(ungated)).toMatch(/does not require/);
  });

  test("C-2C still refuses any scope other than sourced, caller-affirmed conditions", () => {
    const base = fact(C_2C_FACTS, "c-2c-use-002");
    const widened: E85StructuredSourceFact = { ...base, applicability: { ...base.applicability!, dwellingUnits: { max: 1 } } };
    const unsourced: E85StructuredSourceFact = { ...base, applicability: { conditionIds: [C_2C_ENCLOSED_BUILDING_CONDITION] } };
    for (const f of [widened, unsourced]) expect(permissionFor(c2c([f]), base.locator.row as string)).toBeUndefined();
  });
});

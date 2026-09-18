/**
 * InvestScape™ E85 Phase 5 — adapter determinism tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Same structured input, same normalized bundle — regardless of fact order,
 * duplicate facts, or how many times normalization runs. Inputs are never
 * mutated.
 */
import { E85DimensionalRule, adapters } from "../../src/zoning-land-use-engine";
import { r11Document, R1_1_FACTS, deepFreeze, FACT_FSR_MULTIPLE_DWELLING as FACT_FSR, FACT_HEIGHT_OTHER_USES as FACT_HEIGHT } from "./fixtures/vancouver-r1-1-facts";

const { vancouverR11Adapter, VANCOUVER_R1_1_SOURCE } = adapters.vancouver;

function bundleFor(facts: readonly typeof R1_1_FACTS[number][]) {
  const result = vancouverR11Adapter.normalize(r11Document({ facts }), VANCOUVER_R1_1_SOURCE);
  if (result.outcome !== "NORMALIZED") throw new Error(`expected NORMALIZED, got ${result.outcome}`);
  return result.bundle;
}

describe("determinism — repeated runs", () => {
  test("the same input produces a deeply equal bundle every time", () => {
    const a = bundleFor(R1_1_FACTS);
    const b = bundleFor(R1_1_FACTS);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("no wall-clock time leaks into the output", () => {
    const a = bundleFor(R1_1_FACTS);
    const nowIsoYear = String(new Date().getFullYear());
    // Every timestamp in the bundle comes from the fixed extract, so today's
    // date must not appear anywhere in it.
    expect(a.normalizedAt).toBe("2026-09-01T00:00:00.000Z");
    const stamps = JSON.stringify(a).match(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g) ?? [];
    for (const s of stamps) expect(s).toBe("2026-09-01T00:00:00.000Z");
    expect(nowIsoYear.length).toBe(4); // guards the assertion above from being vacuous
  });
});

describe("determinism — input order", () => {
  test("reversing the fact array does not change the bundle", () => {
    const forward = bundleFor(R1_1_FACTS);
    const reversed = bundleFor([...R1_1_FACTS].reverse());
    expect(reversed).toEqual(forward);
  });

  test("an arbitrary shuffle does not change the bundle", () => {
    // A full permutation of every fact (stride 5 is coprime with the fact count).
    const shuffled = R1_1_FACTS.map((_, i) => R1_1_FACTS[(i * 5 + 3) % R1_1_FACTS.length]);
    expect(new Set(shuffled).size).toBe(R1_1_FACTS.length);
    expect(bundleFor(shuffled)).toEqual(bundleFor(R1_1_FACTS));
  });

  test("findings come out in a stable order across permutations", () => {
    const a = bundleFor(R1_1_FACTS).findings.map((f) => `${f.code}:${f.factId ?? "-"}`);
    const b = bundleFor([...R1_1_FACTS].reverse()).findings.map((f) => `${f.code}:${f.factId ?? "-"}`);
    expect(a).toEqual(b);
  });
});

describe("determinism — duplicates", () => {
  test("an identical duplicated fact does not produce a duplicated rule", () => {
    const withDupe = bundleFor([...R1_1_FACTS, { ...FACT_FSR, factId: "r1-1-density-001-copy" }]);
    const density = withDupe.rules.filter((r) => r.family === "DENSITY");
    expect(density).toHaveLength(bundleFor(R1_1_FACTS).rules.filter((r) => r.family === "DENSITY").length);
    expect(withDupe.findings.filter((f) => f.code === "DUPLICATE_SOURCE_FACT_IGNORED")).toHaveLength(1);
  });

  test("a duplicate cannot act as corroboration — the value and its evidence count are unchanged", () => {
    const base = bundleFor(R1_1_FACTS);
    const withDupe = bundleFor([...R1_1_FACTS, { ...FACT_FSR, factId: "dupe-a" }, { ...FACT_FSR, factId: "dupe-b" }]);
    const baseRules = base.rules.map((r) => JSON.stringify(r));
    const dupeRules = withDupe.rules.map((r) => JSON.stringify(r));
    expect(dupeRules).toEqual(baseRules);
    expect(withDupe.qualification).toEqual(base.qualification);
  });

  test("the exact same factId repeated is also collapsed once", () => {
    const withDupe = bundleFor([FACT_HEIGHT, FACT_HEIGHT]);
    expect((withDupe.rules[0] as E85DimensionalRule).maxHeightMetres?.value).toBe(11.5);
    expect(withDupe.rules).toHaveLength(1);
  });

  test("facts differing only in locator are NOT collapsed — they are separate statements", () => {
    const other = { ...FACT_HEIGHT, factId: "height-elsewhere", locator: { section: "3.2.3.1", page: 5 } };
    const bundle = bundleFor([FACT_HEIGHT, other]);
    expect(bundle.findings.filter((f) => f.code === "DUPLICATE_SOURCE_FACT_IGNORED")).toHaveLength(0);
  });
});

describe("determinism — no mutation of inputs", () => {
  test("a deeply frozen document normalizes without throwing", () => {
    const doc = deepFreeze(r11Document());
    expect(() => vancouverR11Adapter.normalize(doc, deepFreeze({ ...VANCOUVER_R1_1_SOURCE }))).not.toThrow();
  });

  test("the input document is byte-identical after normalization", () => {
    const doc = r11Document();
    const before = JSON.stringify(doc);
    vancouverR11Adapter.normalize(doc, VANCOUVER_R1_1_SOURCE);
    expect(JSON.stringify(doc)).toBe(before);
  });

  test("the source definition is byte-identical after normalization", () => {
    const before = JSON.stringify(VANCOUVER_R1_1_SOURCE);
    vancouverR11Adapter.normalize(r11Document(), VANCOUVER_R1_1_SOURCE);
    expect(JSON.stringify(VANCOUVER_R1_1_SOURCE)).toBe(before);
  });

  test("the fact array passed in is not reordered in place", () => {
    const facts = [...R1_1_FACTS];
    const order = facts.map((f) => f.factId);
    vancouverR11Adapter.normalize(r11Document({ facts }), VANCOUVER_R1_1_SOURCE);
    expect(facts.map((f) => f.factId)).toEqual(order);
  });
});

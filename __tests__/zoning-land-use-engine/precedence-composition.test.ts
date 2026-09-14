/**
 * InvestScape™ E85 Phase 6 — explicit precedence: application, scoping,
 * auditability, and every way a precedence declaration can fail to earn trust.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * The distinction being defended here is the one Phase 6 exists for:
 *
 *   compositionRole      is DESCRIPTIVE
 *   precedenceRelation   is AUTHORITATIVE
 *
 * A relation decides an outcome only when it is well-formed, refers to packs in
 * play, does not contradict another relation, and sits in no cycle. Otherwise
 * the contested concept falls back to an honest unresolved conflict — never to
 * a guess dressed as a decision.
 */
import {
  composeE85RulePacks,
  createE85PrecedenceRegistry,
  buildE85ConceptKey,
  precedenceScopeCovers,
  E85ComposedRulePack,
  E85DensityRule,
  E85DimensionalRule,
  E85RulePack,
  E85CompositionOptions,
  E85PrecedenceRelation,
} from "../../src/zoning-land-use-engine";
import { pack, relation, conditionalHeight, JURISDICTION, COMPOSED_AT } from "./fixtures/composition-packs";

const HEIGHT = buildE85ConceptKey("DIMENSIONAL", "maxHeightMetres");
const FSR = buildE85ConceptKey("DENSITY", "maxFsr");

function compose(packs: readonly E85RulePack[], options: E85CompositionOptions = {}): E85ComposedRulePack {
  const result = composeE85RulePacks(packs, { composedAt: COMPOSED_AT, ...options });
  if (result.outcome !== "COMPOSED") throw new Error(`expected COMPOSED, got ${result.outcome}`);
  return result.composed;
}

function dimensional(c: E85ComposedRulePack): E85DimensionalRule | undefined {
  return c.effectiveRules.find((r): r is E85DimensionalRule => r.family === "DIMENSIONAL");
}
function density(c: E85ComposedRulePack): E85DensityRule | undefined {
  return c.effectiveRules.find((r): r is E85DensityRule => r.family === "DENSITY");
}

const basePack = () => pack({ packId: "base", role: "BASE", maxHeightMetres: 12, maxFsr: 1.0 });
const sitePack = () => pack({ packId: "site", role: "SITE_SPECIFIC", maxHeightMetres: 10, maxFsr: 2.5 });

describe("E85 Phase 6 — an explicit override resolves and is fully audited", () => {
  const heightOverride = (): E85PrecedenceRelation =>
    relation({ relationId: "r-height", subjectPackId: "site", objectPackId: "base", type: "OVERRIDES", scope: { conceptKeys: [HEIGHT] } });

  const composed = () => compose([basePack(), sitePack()], { precedenceRelations: [heightOverride()] });

  test("the stated winner governs", () => {
    expect(dimensional(composed())?.maxHeightMetres?.value).toBe(10);
  });

  test("the displaced claim is preserved in full, not deleted", () => {
    const c = composed();
    expect(c.suppressed).toHaveLength(1);
    const record = c.suppressed[0];
    expect(record.conceptKey).toBe(HEIGHT);
    expect(record.suppressed.value).toBe(12);
    expect(record.suppressed.packId).toBe("base");
    expect(record.effective.value).toBe(10);
    expect(record.effective.packId).toBe("site");
  });

  test("the audit names the relation and carries its provenance, so 'who says so?' is answerable", () => {
    const record = composed().suppressed[0];
    expect(record.relationId).toBe("r-height");
    expect(record.relation.provenance.sourceId).toBe(`${JURISDICTION}:enabling-instrument`);
    expect(record.relation.provenance.documentLocator?.section).toBe("12.4");
    expect(record.relation.provenance.documentLocator?.bylawOrDocumentId).toBe("ENABLING-1");
  });

  test("both source chains survive: suppressed and effective each keep source, version and adapter identity", () => {
    const record = composed().suppressed[0];
    for (const claim of [record.suppressed, record.effective]) {
      expect(claim.sourceId).toBeDefined();
      expect(claim.sourceVersionId).toBeDefined();
      expect(claim.adapterId).toBeDefined();
      expect(claim.adapterVersion).toBe("1.0.0");
      expect(claim.provenance.documentLocator?.section).toBeDefined();
    }
    expect(record.suppressed.sourceId).not.toBe(record.effective.sourceId);
  });

  test("findings record both the application and the override", () => {
    const c = composed();
    const applied = c.findings.find((f) => f.code === "PRECEDENCE_RELATION_APPLIED");
    expect(applied?.relationIds).toEqual(["r-height"]);
    expect(applied?.message).toMatch(/not by input order, role label, recency, or restrictiveness/i);
    expect(c.findings.find((f) => f.code === "RULE_OVERRIDDEN")?.packIds).toEqual(["base", "site"]);
    expect(c.appliedRelations.map((r) => r.relationId)).toEqual(["r-height"]);
  });

  test("the result is identical with the packs supplied in reverse order", () => {
    const forward = compose([basePack(), sitePack()], { precedenceRelations: [heightOverride()] });
    const reverse = compose([sitePack(), basePack()], { precedenceRelations: [heightOverride()] });
    expect(JSON.stringify(reverse)).toBe(JSON.stringify(forward));
  });

  test("the resolved concept is not reported as a conflict", () => {
    // FSR is still contested here — the relation was scoped to height alone —
    // which is exactly the point: resolving one concept resolves only that one.
    expect(composed().unresolvedConflicts.map((c) => c.conceptKey)).not.toContain(HEIGHT);
  });

  test("with every contested concept covered, the composition is clean", () => {
    const c = compose([basePack(), sitePack()], {
      precedenceRelations: [relation({ relationId: "r-all", subjectPackId: "site", objectPackId: "base", type: "OVERRIDES" })],
    });
    expect(c.status).toBe("COMPOSED");
    expect(c.unresolvedConflicts).toEqual([]);
  });
});

describe("E85 Phase 6 — a pack-level override never reaches families it was not about", () => {
  test("a height-scoped override leaves the contested FSR unresolved", () => {
    const composed = compose([basePack(), sitePack()], {
      precedenceRelations: [relation({ relationId: "r-height", subjectPackId: "site", objectPackId: "base", type: "OVERRIDES", scope: { conceptKeys: [HEIGHT] } })],
    });
    expect(dimensional(composed)?.maxHeightMetres?.value).toBe(10);
    expect(density(composed)?.maxFsr).toBeUndefined();
    expect(composed.unresolvedConflicts.map((c) => c.conceptKey)).toEqual([FSR]);
  });

  test("a family-scoped override covers every concept in that family and no other", () => {
    const composed = compose([basePack(), sitePack()], {
      precedenceRelations: [relation({ relationId: "r-dim", subjectPackId: "site", objectPackId: "base", type: "OVERRIDES", scope: { families: ["DIMENSIONAL"] } })],
    });
    expect(dimensional(composed)?.maxHeightMetres?.value).toBe(10);
    expect(density(composed)?.maxFsr).toBeUndefined();
  });

  test("an unscoped relation covers everything the two packs share — a broad claim, applied only when made", () => {
    const composed = compose([basePack(), sitePack()], {
      precedenceRelations: [relation({ relationId: "r-all", subjectPackId: "site", objectPackId: "base", type: "OVERRIDES" })],
    });
    expect(dimensional(composed)?.maxHeightMetres?.value).toBe(10);
    expect(density(composed)?.maxFsr?.value).toBe(2.5);
    expect(composed.suppressed.map((s) => s.conceptKey).sort()).toEqual([FSR, HEIGHT]);
  });

  test("scope matching is exact — no prefix or partial concept match", () => {
    expect(precedenceScopeCovers({ conceptKeys: [HEIGHT] }, "DIMENSIONAL", HEIGHT)).toBe(true);
    expect(precedenceScopeCovers({ conceptKeys: [HEIGHT] }, "DIMENSIONAL", buildE85ConceptKey("DIMENSIONAL", "maxStoreys"))).toBe(false);
    expect(precedenceScopeCovers({ families: ["DIMENSIONAL"] }, "DENSITY", FSR)).toBe(false);
    expect(precedenceScopeCovers(undefined, "DENSITY", FSR)).toBe(true);
  });

  test("a relation about an untouched concept changes nothing", () => {
    const composed = compose([basePack(), sitePack()], {
      precedenceRelations: [
        relation({ relationId: "r-parking", subjectPackId: "site", objectPackId: "base", type: "OVERRIDES", scope: { families: ["PARKING"] } }),
      ],
    });
    expect(composed.unresolvedConflicts.map((c) => c.conceptKey).sort()).toEqual([FSR, HEIGHT]);
    expect(composed.suppressed).toEqual([]);
  });
});

describe("E85 Phase 6 — SUPPLEMENTS coexists but settles nothing", () => {
  test("declaring two instruments work together does not decide a shared concept", () => {
    const composed = compose([basePack(), sitePack()], {
      precedenceRelations: [relation({ relationId: "r-supp", subjectPackId: "site", objectPackId: "base", type: "SUPPLEMENTS" })],
    });
    expect(composed.unresolvedConflicts.map((c) => c.conceptKey).sort()).toEqual([FSR, HEIGHT]);
    expect(composed.suppressed).toEqual([]);
  });
});

describe("E85 Phase 6 — restrictive-wins exists only as an explicit, directed opt-in", () => {
  test("a NARROWS relation selects the lower value when the metadata says lower is more restrictive", () => {
    const composed = compose([basePack(), sitePack()], {
      precedenceRelations: [
        relation({
          relationId: "r-narrow",
          subjectPackId: "site",
          objectPackId: "base",
          type: "NARROWS",
          restrictiveDirection: "LOWER_IS_MORE_RESTRICTIVE",
          scope: { conceptKeys: [HEIGHT] },
        }),
      ],
    });
    expect(dimensional(composed)?.maxHeightMetres?.value).toBe(10);
    expect(composed.suppressed[0].suppressed.value).toBe(12);
  });

  test("the direction is honoured, not assumed — HIGHER_IS_MORE_RESTRICTIVE selects the higher value", () => {
    const composed = compose([basePack(), sitePack()], {
      precedenceRelations: [
        relation({
          relationId: "r-narrow",
          subjectPackId: "site",
          objectPackId: "base",
          type: "NARROWS",
          restrictiveDirection: "HIGHER_IS_MORE_RESTRICTIVE",
          scope: { conceptKeys: [HEIGHT] },
        }),
      ],
    });
    expect(dimensional(composed)?.maxHeightMetres?.value).toBe(12);
  });

  test("NARROWS decides the pair regardless of which pack is named subject", () => {
    const forward = compose([basePack(), sitePack()], {
      precedenceRelations: [
        relation({ relationId: "r", subjectPackId: "site", objectPackId: "base", type: "NARROWS", restrictiveDirection: "LOWER_IS_MORE_RESTRICTIVE", scope: { conceptKeys: [HEIGHT] } }),
      ],
    });
    const reversed = compose([basePack(), sitePack()], {
      precedenceRelations: [
        relation({ relationId: "r", subjectPackId: "base", objectPackId: "site", type: "NARROWS", restrictiveDirection: "LOWER_IS_MORE_RESTRICTIVE", scope: { conceptKeys: [HEIGHT] } }),
      ],
    });
    expect(dimensional(forward)?.maxHeightMetres?.value).toBe(10);
    expect(dimensional(reversed)?.maxHeightMetres?.value).toBe(10);
  });

  test("a NARROWS with no stated direction is refused rather than defaulted", () => {
    const composed = compose([basePack(), sitePack()], {
      precedenceRelations: [relation({ relationId: "r-bad", subjectPackId: "site", objectPackId: "base", type: "NARROWS", scope: { conceptKeys: [HEIGHT] } })],
    });
    expect(composed.precedenceProblems[0].code).toBe("MALFORMED_RELATION");
    expect(composed.precedenceProblems[0].detail).toMatch(/legal reading/i);
    expect(dimensional(composed)?.maxHeightMetres).toBeUndefined();
    expect(composed.unresolvedConflicts.map((c) => c.conceptKey)).toContain(HEIGHT);
  });

  test("NARROWS declines to rank values it cannot meaningfully compare", () => {
    const packs: E85RulePack[] = [
      { ...pack({ packId: "a", role: "BASE", usePermitted: "dwelling" }) },
      {
        ...pack({ packId: "b", role: "SITE_SPECIFIC" }),
        rules: [
          {
            jurisdictionId: JURISDICTION,
            zoneDesignation: pack({ packId: "b", role: "BASE" }).zoneDesignation,
            family: "USE",
            permissions: [
              {
                value: { useCode: "dwelling", status: "PROHIBITED" as const },
                provenance: { sourceId: `${JURISDICTION}:b`, documentLocator: { section: "2.1" } },
                temporal: { effectiveFrom: "2024-01-01", effectiveDateBasis: "SOURCE_STATED" as const },
              },
            ],
          },
        ],
      },
    ];
    const composed = compose(packs, {
      precedenceRelations: [
        relation({ relationId: "r", subjectPackId: "b", objectPackId: "a", type: "NARROWS", restrictiveDirection: "LOWER_IS_MORE_RESTRICTIVE" }),
      ],
    });
    // A use status is not a number; the relation cannot rank it, so the
    // disagreement stands rather than being decided by an invented ordering.
    expect(composed.unresolvedConflicts).toHaveLength(1);
    expect(composed.suppressed).toEqual([]);
  });
});

describe("E85 Phase 6 — precedence metadata that has not earned trust is refused", () => {
  test("a relation naming a pack that is not being composed is rejected and reported", () => {
    const composed = compose([basePack(), sitePack()], {
      precedenceRelations: [relation({ relationId: "r-ghost", subjectPackId: "site", objectPackId: "not-supplied", type: "OVERRIDES" })],
    });
    expect(composed.precedenceProblems[0].code).toBe("UNKNOWN_PACK_REFERENCE");
    expect(composed.precedenceProblems[0].packIds).toEqual(["not-supplied"]);
    expect(composed.findings.some((f) => f.code === "PRECEDENCE_METADATA_REJECTED")).toBe(true);
    expect(composed.unresolvedConflicts).toHaveLength(2);
  });

  test("a self-referential relation is rejected", () => {
    const composed = compose([basePack(), sitePack()], {
      precedenceRelations: [relation({ relationId: "r-self", subjectPackId: "base", objectPackId: "base", type: "OVERRIDES" })],
    });
    expect(composed.precedenceProblems[0].code).toBe("MALFORMED_RELATION");
    expect(composed.precedenceProblems[0].detail).toMatch(/both subject and object/i);
  });

  test("a duplicated relationId is rejected, because which declaration applied would depend on order", () => {
    const composed = compose([basePack(), sitePack()], {
      precedenceRelations: [
        relation({ relationId: "dup", subjectPackId: "site", objectPackId: "base", type: "OVERRIDES" }),
        relation({ relationId: "dup", subjectPackId: "base", objectPackId: "site", type: "OVERRIDES" }),
      ],
    });
    expect(composed.precedenceProblems.some((p) => p.code === "MALFORMED_RELATION")).toBe(true);
    expect(composed.suppressed).toEqual([]);
  });

  test("two authorities claiming opposite precedence resolve to neither", () => {
    const composed = compose([basePack(), sitePack()], {
      precedenceRelations: [
        relation({ relationId: "r-a", subjectPackId: "site", objectPackId: "base", type: "OVERRIDES", scope: { conceptKeys: [HEIGHT] } }),
        relation({ relationId: "r-b", subjectPackId: "base", objectPackId: "site", type: "OVERRIDES", scope: { conceptKeys: [HEIGHT] } }),
      ],
    });
    const problem = composed.precedenceProblems.find((p) => p.code === "CONFLICTING_PRECEDENCE_DECLARATIONS");
    expect(problem?.relationIds).toEqual(["r-a", "r-b"]);
    expect(problem?.detail).toMatch(/Neither is applied/i);
    expect(dimensional(composed)?.maxHeightMetres).toBeUndefined();
    expect(composed.unresolvedConflicts.map((c) => c.conceptKey)).toContain(HEIGHT);
  });

  test("contradictory declarations over non-overlapping scopes do not collide", () => {
    const composed = compose([basePack(), sitePack()], {
      precedenceRelations: [
        relation({ relationId: "r-h", subjectPackId: "site", objectPackId: "base", type: "OVERRIDES", scope: { conceptKeys: [HEIGHT] } }),
        relation({ relationId: "r-f", subjectPackId: "base", objectPackId: "site", type: "OVERRIDES", scope: { conceptKeys: [FSR] } }),
      ],
    });
    expect(composed.precedenceProblems).toEqual([]);
    expect(dimensional(composed)?.maxHeightMetres?.value).toBe(10);
    expect(density(composed)?.maxFsr?.value).toBe(1.0);
  });
});

describe("E85 Phase 6 — cycles are detected, never broken by input order", () => {
  test("a two-pack cycle refuses both relations", () => {
    const composed = compose([basePack(), sitePack()], {
      precedenceRelations: [
        relation({ relationId: "r1", subjectPackId: "site", objectPackId: "base", type: "OVERRIDES" }),
        relation({ relationId: "r2", subjectPackId: "base", objectPackId: "site", type: "OVERRIDES", scope: { families: ["DENSITY"] } }),
      ],
    });
    expect(composed.precedenceProblems.length).toBeGreaterThan(0);
    expect(composed.suppressed).toEqual([]);
    expect(composed.unresolvedConflicts.length).toBeGreaterThan(0);
  });

  test("a three-pack ring A→B→C→A is detected and none of its relations applies", () => {
    const packs = [
      pack({ packId: "a", role: "BASE", maxHeightMetres: 12 }),
      pack({ packId: "b", role: "OVERLAY", maxHeightMetres: 10 }),
      pack({ packId: "c", role: "AGREEMENT", maxHeightMetres: 8 }),
    ];
    const relations = [
      relation({ relationId: "ab", subjectPackId: "a", objectPackId: "b", type: "OVERRIDES" }),
      relation({ relationId: "bc", subjectPackId: "b", objectPackId: "c", type: "OVERRIDES" }),
      relation({ relationId: "ca", subjectPackId: "c", objectPackId: "a", type: "OVERRIDES" }),
    ];
    const composed = compose(packs, { precedenceRelations: relations });
    const cycle = composed.precedenceProblems.find((p) => p.code === "PRECEDENCE_CYCLE");
    expect(cycle?.relationIds).toEqual(["ab", "bc", "ca"]);
    expect(cycle?.packIds).toEqual(["a", "b", "c"]);
    expect(cycle?.detail).toMatch(/breaking the cycle at an arbitrary point/i);
    expect(composed.suppressed).toEqual([]);
    expect(composed.unresolvedConflicts).toHaveLength(1);
  });

  test("cycle detection is order-independent across every permutation of the relations", () => {
    const packs = [
      pack({ packId: "a", role: "BASE", maxHeightMetres: 12 }),
      pack({ packId: "b", role: "OVERLAY", maxHeightMetres: 10 }),
      pack({ packId: "c", role: "AGREEMENT", maxHeightMetres: 8 }),
    ];
    const rels = [
      relation({ relationId: "ab", subjectPackId: "a", objectPackId: "b", type: "OVERRIDES" }),
      relation({ relationId: "bc", subjectPackId: "b", objectPackId: "c", type: "OVERRIDES" }),
      relation({ relationId: "ca", subjectPackId: "c", objectPackId: "a", type: "OVERRIDES" }),
    ];
    const orders = [
      [rels[0], rels[1], rels[2]],
      [rels[2], rels[1], rels[0]],
      [rels[1], rels[2], rels[0]],
    ];
    const results = orders.map((r) => JSON.stringify(compose(packs, { precedenceRelations: r })));
    expect(new Set(results).size).toBe(1);
  });

  test("a non-cyclic chain A→B→C is not mistaken for a cycle", () => {
    const registry = createE85PrecedenceRegistry(
      [
        relation({ relationId: "ab", subjectPackId: "a", objectPackId: "b", type: "OVERRIDES" }),
        relation({ relationId: "bc", subjectPackId: "b", objectPackId: "c", type: "OVERRIDES" }),
      ],
      ["a", "b", "c"],
    );
    expect(registry.problems()).toEqual([]);
    expect(registry.usable().map((r) => r.relationId)).toEqual(["ab", "bc"]);
  });
});

describe("E85 Phase 6 — the registry never consults a composition role", () => {
  test("resolution depends only on pack ids, scope and relation type", () => {
    const registry = createE85PrecedenceRegistry([relation({ relationId: "r", subjectPackId: "x", objectPackId: "y", type: "OVERRIDES" })], ["x", "y"]);
    expect(registry.relationsFor("x", "y", "DIMENSIONAL", HEIGHT)).toHaveLength(1);
    // The reverse direction is not inferred from the stated one.
    expect(registry.relationsFor("y", "x", "DIMENSIONAL", HEIGHT)).toEqual([]);
  });

  test("precedence-resolution.ts contains no reference to composition roles", () => {
    // Enforced here rather than by convention: the moment resolution reads a
    // role, role labels silently become legal hierarchy.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const source = fs.readFileSync(path.resolve(__dirname, "../../src/zoning-land-use-engine/precedence-resolution.ts"), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const role of ["BASE", "OVERLAY", "SITE_SPECIFIC", "AGREEMENT", "BONUS_SCHEDULE", "\\brole\\b"]) {
      expect({ role, found: new RegExp(role).test(code) }).toEqual({ role, found: false });
    }
  });
});

describe("E85 Phase 6 — a conditional relation waits for its condition", () => {
  const CONDITION = "the enabling agreement has been executed";
  const conditionalRelation = () =>
    relation({
      relationId: "r-cond",
      subjectPackId: "site",
      objectPackId: "base",
      type: "OVERRIDES",
      scope: { conceptKeys: [HEIGHT] },
      conditionalOn: CONDITION,
    });

  test("unaffirmed, the relation does not apply and the concept stays contested", () => {
    const composed = compose([basePack(), sitePack()], { precedenceRelations: [conditionalRelation()] });
    expect(dimensional(composed)?.maxHeightMetres).toBeUndefined();
    expect(composed.unresolvedConflicts.map((c) => c.conceptKey)).toContain(HEIGHT);
  });

  test("affirmed verbatim, the relation applies", () => {
    const composed = compose([basePack(), sitePack()], { precedenceRelations: [conditionalRelation()], affirmedConditions: [CONDITION] });
    expect(dimensional(composed)?.maxHeightMetres?.value).toBe(10);
  });

  test("affirmation is exact — near-misses do not admit it", () => {
    for (const near of [CONDITION.toUpperCase(), CONDITION.trim() + ".", "the enabling agreement"]) {
      const composed = compose([basePack(), sitePack()], { precedenceRelations: [conditionalRelation()], affirmedConditions: [near] });
      expect(dimensional(composed)?.maxHeightMetres).toBeUndefined();
    }
  });
});

describe("E85 Phase 6 — conditional rules stay conditional", () => {
  const CONDITION = "the site is a corner site";

  test("an unaffirmed conditional rule never enters the effective rules", () => {
    const packs = [
      pack({ packId: "base", role: "BASE", maxHeightMetres: 12 }),
      pack({ packId: "overlay", role: "OVERLAY", conditionalRules: [conditionalHeight(CONDITION, 8.5, `${JURISDICTION}:overlay`)] }),
    ];
    const composed = compose(packs);
    expect(dimensional(composed)?.maxHeightMetres?.value).toBe(12);
    expect(JSON.stringify(composed.effectiveRules)).not.toContain("8.5");
    expect(composed.conditionalRules.map((c) => c.condition)).toEqual([CONDITION]);
    expect(composed.findings.some((f) => f.code === "CONDITIONAL_RULE_PRESERVED")).toBe(true);
  });

  test("affirming admits it — and admission is eligibility, not victory", () => {
    const packs = [
      pack({ packId: "base", role: "BASE", maxHeightMetres: 12 }),
      pack({ packId: "overlay", role: "OVERLAY", conditionalRules: [conditionalHeight(CONDITION, 8.5, `${JURISDICTION}:overlay`)] }),
    ];
    const composed = compose(packs, { affirmedConditions: [CONDITION] });
    // It now competes with the base height, and nothing ranks them.
    expect(composed.unresolvedConflicts.map((c) => c.conceptKey)).toEqual([HEIGHT]);
    expect(dimensional(composed)?.maxHeightMetres).toBeUndefined();
    const admitted = composed.findings.find((f) => f.code === "CONDITIONAL_RULE_ADMITTED");
    expect(admitted?.message).toMatch(/eligible, not authoritative/i);
  });

  test("an admitted conditional rule resolves once a relation ranks it", () => {
    const packs = [
      pack({ packId: "base", role: "BASE", maxHeightMetres: 12 }),
      pack({ packId: "overlay", role: "OVERLAY", conditionalRules: [conditionalHeight(CONDITION, 8.5, `${JURISDICTION}:overlay`)] }),
    ];
    const composed = compose(packs, {
      affirmedConditions: [CONDITION],
      precedenceRelations: [relation({ relationId: "r", subjectPackId: "overlay", objectPackId: "base", type: "OVERRIDES", scope: { conceptKeys: [HEIGHT] } })],
    });
    expect(dimensional(composed)?.maxHeightMetres?.value).toBe(8.5);
    expect(composed.suppressed[0].suppressed.value).toBe(12);
  });

  test("affirming an unrelated condition admits nothing", () => {
    const packs = [
      pack({ packId: "base", role: "BASE", maxHeightMetres: 12 }),
      pack({ packId: "overlay", role: "OVERLAY", conditionalRules: [conditionalHeight(CONDITION, 8.5, `${JURISDICTION}:overlay`)] }),
    ];
    const composed = compose(packs, { affirmedConditions: ["something else entirely"] });
    expect(dimensional(composed)?.maxHeightMetres?.value).toBe(12);
    expect(composed.conditionalRules).toHaveLength(1);
  });
});

describe("E85 Phase 6 — temporal uncertainty never becomes precedence", () => {
  const known = () => pack({ packId: "dated", role: "BASE", maxHeightMetres: 12 });
  const unknown = () => pack({ packId: "undated", role: "OVERLAY", maxHeightMetres: 10, temporalUnknown: true });

  test("a pack with an unknown effective date does not lose to, or beat, a dated one", () => {
    const composed = compose([known(), unknown()]);
    expect(composed.unresolvedConflicts).toHaveLength(1);
    expect(dimensional(composed)?.maxHeightMetres).toBeUndefined();
  });

  test("the temporal uncertainty is flagged, with recency explicitly ruled out", () => {
    const composed = compose([known(), unknown()]);
    expect(composed.unresolvedConflicts[0].temporalUncertainty).toBe(true);
    const finding = composed.findings.find((f) => f.code === "TEMPORAL_RELATION_UNRESOLVED");
    expect(finding?.message).toMatch(/Publication or consolidation recency is NOT used/i);
    expect(finding?.message).toMatch(/which text was read, never which rule superseded which/i);
  });

  test("a later source version string confers no precedence", () => {
    const older = { ...pack({ packId: "old", role: "BASE", maxHeightMetres: 12 }), sourceVersionId: "2019-01-consolidation" };
    const newer = { ...pack({ packId: "new", role: "OVERLAY", maxHeightMetres: 10 }), sourceVersionId: "2026-06-consolidation" };
    const composed = compose([older, newer]);
    expect(composed.unresolvedConflicts).toHaveLength(1);
    expect(composed.suppressed).toEqual([]);
  });

  test("two packs that agree do not conflict merely because one is undated", () => {
    const composed = compose([pack({ packId: "a", role: "BASE", maxHeightMetres: 12 }), pack({ packId: "b", role: "OVERLAY", maxHeightMetres: 12, temporalUnknown: true })]);
    expect(dimensional(composed)?.maxHeightMetres?.value).toBe(12);
    expect(composed.unresolvedConflicts).toEqual([]);
  });
});

describe("E85 Phase 6 — licensing is not precedence", () => {
  test("a licence-limited pack keeps full authority over its rules", () => {
    const limited = pack({ packId: "limited", role: "BASE", maxHeightMetres: 12, readinessBlockers: ["LICENSE"] });
    const composed = compose([limited, pack({ packId: "clear", role: "OVERLAY", frontSetback: 5 })]);
    expect(dimensional(composed)?.maxHeightMetres?.value).toBe(12);
    expect(composed.readinessLimitations.map((l) => l.packId)).toEqual(["limited"]);
    expect(composed.readinessLimitations[0].detail).toMatch(/no rule is suppressed, downgraded, or reordered because of it/i);
  });

  test("a licence limitation does not break a tie", () => {
    const limited = pack({ packId: "limited", role: "BASE", maxHeightMetres: 12, readinessBlockers: ["LICENSE"] });
    const clear = pack({ packId: "clear", role: "OVERLAY", maxHeightMetres: 10 });
    const composed = compose([limited, clear]);
    expect(composed.unresolvedConflicts).toHaveLength(1);
    expect(composed.suppressed).toEqual([]);
  });

  test("the limitation is surfaced as a finding a caller will see", () => {
    const composed = compose([pack({ packId: "limited", role: "BASE", maxHeightMetres: 12, readinessBlockers: ["LICENSE", "VERSION"] })]);
    const finding = composed.findings.find((f) => f.code === "SOURCE_READINESS_LIMITATION");
    expect(finding?.severity).toBe("WARNING");
    expect(composed.readinessLimitations[0].blockers).toEqual(["LICENSE", "VERSION"]);
  });
});

describe("E85 Phase 6 — qualification is floored, never averaged", () => {
  test("the weakest contributing pack sets each axis", () => {
    const composed = compose([
      pack({ packId: "a", role: "BASE", maxFsr: 1, qualification: { evidenceQuality: "high", ruleApplicability: "moderate" } }),
      pack({ packId: "b", role: "OVERLAY", frontSetback: 5, qualification: { evidenceQuality: "low", ruleApplicability: "high" } }),
    ]);
    expect(composed.qualification).toEqual({ evidenceQuality: "low", ruleApplicability: "moderate" });
  });

  test("axes stay independent — a weak axis on one pack does not drag the other axis down", () => {
    const composed = compose([
      pack({ packId: "a", role: "BASE", maxFsr: 1, qualification: { evidenceQuality: "very_low", ruleApplicability: "high" } }),
      pack({ packId: "b", role: "OVERLAY", frontSetback: 5, qualification: { evidenceQuality: "high", ruleApplicability: "high" } }),
    ]);
    expect(composed.qualification).toEqual({ evidenceQuality: "very_low", ruleApplicability: "high" });
  });

  test("composition derives no parcelMatch, because it holds no parcel", () => {
    const composed = compose([pack({ packId: "a", role: "BASE", maxFsr: 1 })]);
    expect(Object.keys(composed.qualification).sort()).toEqual(["evidenceQuality", "ruleApplicability"]);
    expect(JSON.stringify(composed.qualification)).not.toMatch(/parcel/i);
  });
});

/**
 * InvestScape™ E85 Phase 6 — rule-pack composition: combination, conflict,
 * deduplication, order independence.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * The governing property throughout: composition may combine what coexists and
 * may apply precedence someone actually stated, but it may never INVENT a
 * ranking. Most of what follows is a proof that a plausible-looking shortcut —
 * most restrictive wins, base loses, newer wins, first wins — is not taken.
 */
import {
  composeE85RulePacks,
  materialCompositionConflicts,
  compositionManualReview,
  buildE85ConceptKey,
  E85DensityRule,
  E85DimensionalRule,
  E85ParkingRule,
  E85UseRule,
  E85ComposedRulePack,
  E85RulePack,
  E85CompositionOptions,
} from "../../src/zoning-land-use-engine";
import { pack, relation, evidence, JURISDICTION, ZONE, COMPOSED_AT } from "./fixtures/composition-packs";

const HEIGHT = buildE85ConceptKey("DIMENSIONAL", "maxHeightMetres");
const FSR = buildE85ConceptKey("DENSITY", "maxFsr");

function compose(packs: readonly E85RulePack[], options: E85CompositionOptions = {}): E85ComposedRulePack {
  const result = composeE85RulePacks(packs, { composedAt: COMPOSED_AT, ...options });
  if (result.outcome !== "COMPOSED") throw new Error(`expected COMPOSED, got ${result.outcome}`);
  return result.composed;
}

function density(c: E85ComposedRulePack): E85DensityRule | undefined {
  return c.effectiveRules.find((r): r is E85DensityRule => r.family === "DENSITY");
}
function dimensional(c: E85ComposedRulePack): E85DimensionalRule | undefined {
  return c.effectiveRules.find((r): r is E85DimensionalRule => r.family === "DIMENSIONAL");
}

/** Every permutation of an array, so order independence is proved exhaustively rather than by one reversal. */
function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const p of permutations(rest)) out.push([items[i], ...p]);
  }
  return out;
}

describe("E85 Phase 6 — basic composition", () => {
  test("empty input composes to an empty, non-failing result", () => {
    const composed = compose([]);
    expect(composed.status).toBe("COMPOSED");
    expect(composed.effectiveRules).toEqual([]);
    expect(composed.unresolvedConflicts).toEqual([]);
  });

  test("one pack passes through unchanged", () => {
    const composed = compose([pack({ packId: "base", role: "BASE", maxFsr: 1.0, maxHeightMetres: 12 })]);
    expect(density(composed)?.maxFsr?.value).toBe(1.0);
    expect(dimensional(composed)?.maxHeightMetres?.value).toBe(12);
    expect(composed.status).toBe("COMPOSED");
  });

  test("BASE + OVERLAY regulating different concepts: all three rules survive, no conflict", () => {
    const composed = compose([
      pack({ packId: "base", role: "BASE", maxFsr: 1.0, maxHeightMetres: 12 }),
      pack({ packId: "overlay", role: "OVERLAY", frontSetback: 5 }),
    ]);
    expect(density(composed)?.maxFsr?.value).toBe(1.0);
    expect(dimensional(composed)?.maxHeightMetres?.value).toBe(12);
    expect(dimensional(composed)?.setbacksMetres?.front.value).toBe(5);
    expect(composed.unresolvedConflicts).toEqual([]);
    expect(composed.suppressed).toEqual([]);
    expect(composed.status).toBe("COMPOSED");
  });

  test("three compatible packs across four families all compose", () => {
    const composed = compose([
      pack({ packId: "a", role: "BASE", maxFsr: 1.0, usePermitted: "dwelling" }),
      pack({ packId: "b", role: "OVERLAY", maxHeightMetres: 12, rearSetback: 3 }),
      pack({ packId: "c", role: "OTHER", minParkingPerDwelling: 1 }),
    ]);
    expect(composed.effectiveRules.map((r) => r.family).sort()).toEqual(["DENSITY", "DIMENSIONAL", "PARKING", "USE"]);
    const parking = composed.effectiveRules.find((r): r is E85ParkingRule => r.family === "PARKING");
    expect(parking?.minSpacesPerUse?.dwelling_unit.value).toBe(1);
    expect(composed.unresolvedConflicts).toEqual([]);
    expect(composed.contributingPackIds).toEqual(["a", "b", "c"]);
  });

  test("the composed pack names every contributing source", () => {
    const composed = compose([pack({ packId: "a", role: "BASE", maxFsr: 1 }), pack({ packId: "b", role: "OVERLAY", frontSetback: 5 })]);
    expect(composed.contributingSourceIds).toHaveLength(2);
    expect(composed.contributingSourceIds).toEqual([...composed.contributingSourceIds].sort());
  });
});

describe("E85 Phase 6 — concepts, not families, decide what conflicts", () => {
  test("height and storeys are different concepts and coexist", () => {
    const composed = compose([
      pack({ packId: "a", role: "BASE", maxHeightMetres: 12 }),
      pack({ packId: "b", role: "OVERLAY", maxStoreys: 3 }),
    ]);
    expect(dimensional(composed)?.maxHeightMetres?.value).toBe(12);
    expect(dimensional(composed)?.maxStoreys?.value).toBe(3);
    expect(composed.unresolvedConflicts).toEqual([]);
  });

  test("a front yard and a rear yard are different concepts and coexist", () => {
    const composed = compose([
      pack({ packId: "a", role: "BASE", frontSetback: 5 }),
      pack({ packId: "b", role: "OVERLAY", rearSetback: 3 }),
    ]);
    expect(dimensional(composed)?.setbacksMetres?.front.value).toBe(5);
    expect(dimensional(composed)?.setbacksMetres?.rear.value).toBe(3);
    expect(composed.unresolvedConflicts).toEqual([]);
  });

  test("the same yard from two packs with different values IS a conflict", () => {
    const composed = compose([
      pack({ packId: "a", role: "BASE", frontSetback: 5 }),
      pack({ packId: "b", role: "OVERLAY", frontSetback: 3 }),
    ]);
    expect(composed.unresolvedConflicts.map((c) => c.conceptKey)).toEqual([buildE85ConceptKey("DIMENSIONAL", "setbacksMetres", "front")]);
  });

  test("different uses from different packs coexist; the same use with different statuses conflicts", () => {
    const compatible = compose([
      pack({ packId: "a", role: "BASE", usePermitted: "dwelling" }),
      pack({ packId: "b", role: "OVERLAY", usePermitted: "office" }),
    ]);
    const useRule = compatible.effectiveRules.find((r): r is E85UseRule => r.family === "USE");
    expect(useRule?.permissions.map((p) => p.value.useCode).sort()).toEqual(["dwelling", "office"]);
    expect(compatible.unresolvedConflicts).toEqual([]);
  });
});

describe("E85 Phase 6 — an unrankable disagreement stays unranked", () => {
  const conflicting = () => [pack({ packId: "base", role: "BASE", maxHeightMetres: 12 }), pack({ packId: "overlay", role: "OVERLAY", maxHeightMetres: 10 })];

  test("no value is selected at all", () => {
    const composed = compose(conflicting());
    expect(composed.status).toBe("COMPOSED_WITH_UNRESOLVED_CONFLICTS");
    expect(dimensional(composed)?.maxHeightMetres).toBeUndefined();
    // Neither number appears among the effective rules.
    expect(JSON.stringify(composed.effectiveRules)).not.toContain("12");
    expect(JSON.stringify(composed.effectiveRules)).not.toContain("10");
  });

  test("the conflict names both claims and both values", () => {
    const composed = compose(conflicting());
    expect(composed.unresolvedConflicts).toHaveLength(1);
    const conflict = composed.unresolvedConflicts[0];
    expect(conflict.conceptKey).toBe(HEIGHT);
    expect(conflict.family).toBe("DIMENSIONAL");
    expect(conflict.claims.map((c) => c.packId).sort()).toEqual(["base", "overlay"]);
    expect([...conflict.distinctValues].sort()).toEqual([10, 12]);
  });

  test("it escalates as a manual review, not a data gap — evidence exists on both sides", () => {
    const composed = compose(conflicting());
    const finding = composed.findings.find((f) => f.code === "AUTHORITATIVE_CONFLICT_UNRESOLVED");
    expect(finding?.severity).toBe("MANUAL_REVIEW");
    expect(finding?.manualReview?.reasonCode).toBe("CONFLICTING_AUTHORITATIVE_SOURCES");
    expect(finding?.gap).toBeUndefined();
  });

  test("the explanation rules out each shortcut by name", () => {
    const detail = compose(conflicting()).unresolvedConflicts[0].detail;
    expect(detail).toMatch(/no stated precedence relation ranks them/i);
    expect(detail).toMatch(/neither the lower nor the higher/i);
    expect(detail).toMatch(/neither the first nor the last supplied/i);
    expect(detail).toMatch(/no role label decides it/i);
  });

  test("restrictive-wins is not applied, in either direction, for maxima or minima", () => {
    const maxima = compose([pack({ packId: "a", role: "BASE", maxFsr: 1.0 }), pack({ packId: "b", role: "SITE_SPECIFIC", maxFsr: 2.5 })]);
    expect(density(maxima)?.maxFsr).toBeUndefined();
    expect(maxima.unresolvedConflicts.map((c) => c.conceptKey)).toEqual([FSR]);

    const minima = compose([pack({ packId: "a", role: "BASE", minParkingPerDwelling: 1 }), pack({ packId: "b", role: "OVERLAY", minParkingPerDwelling: 2 })]);
    const parking = minima.effectiveRules.find((r): r is E85ParkingRule => r.family === "PARKING");
    expect(parking).toBeUndefined();
  });

  test("unrelated concepts still compose while one concept is contested", () => {
    const composed = compose([
      pack({ packId: "a", role: "BASE", maxHeightMetres: 12, maxFsr: 1.0 }),
      pack({ packId: "b", role: "OVERLAY", maxHeightMetres: 10, frontSetback: 5 }),
    ]);
    expect(density(composed)?.maxFsr?.value).toBe(1.0);
    expect(dimensional(composed)?.setbacksMetres?.front.value).toBe(5);
    expect(dimensional(composed)?.maxHeightMetres).toBeUndefined();
  });
});

describe("E85 Phase 6 — role labels carry no hierarchy", () => {
  const ROLES = ["BASE", "OVERLAY", "SITE_SPECIFIC", "AGREEMENT", "BONUS_SCHEDULE", "OTHER"] as const;

  test.each(ROLES.flatMap((a) => ROLES.filter((b) => b !== a).map((b) => [a, b] as const)))(
    "%s vs %s with no stated relation conflicts rather than ranking",
    (roleA, roleB) => {
      const composed = compose([pack({ packId: "a", role: roleA, maxHeightMetres: 12 }), pack({ packId: "b", role: roleB, maxHeightMetres: 10 })]);
      expect(composed.unresolvedConflicts).toHaveLength(1);
      expect(dimensional(composed)?.maxHeightMetres).toBeUndefined();
    },
  );

  test("specifically, SITE_SPECIFIC does not beat BASE and AGREEMENT does not beat BASE", () => {
    for (const role of ["SITE_SPECIFIC", "AGREEMENT"] as const) {
      const composed = compose([pack({ packId: "base", role: "BASE", maxHeightMetres: 12 }), pack({ packId: "other", role, maxHeightMetres: 10 })]);
      expect(composed.unresolvedConflicts).toHaveLength(1);
      expect(composed.suppressed).toEqual([]);
    }
  });
});

describe("E85 Phase 6 — deduplication never becomes corroboration", () => {
  test("the identical bundle supplied twice changes nothing", () => {
    const single = compose([pack({ packId: "a", role: "BASE", maxFsr: 1.0, maxHeightMetres: 12 })]);
    const doubled = compose([
      pack({ packId: "a", role: "BASE", maxFsr: 1.0, maxHeightMetres: 12 }),
      pack({ packId: "a-copy", role: "BASE", sourceId: `${JURISDICTION}:instrument-a`, maxFsr: 1.0, maxHeightMetres: 12 }),
    ]);
    expect(JSON.stringify(doubled.effectiveRules)).toBe(JSON.stringify(single.effectiveRules));
    expect(doubled.qualification).toEqual(single.qualification);
    expect(doubled.unresolvedConflicts).toEqual([]);
    expect(doubled.findings.some((f) => f.code === "DUPLICATE_RULE_COLLAPSED")).toBe(true);
  });

  test("identical evidence within one concept collapses to one claim", () => {
    const composed = compose([
      pack({ packId: "a", role: "BASE", maxHeightMetres: 12 }),
      pack({ packId: "b", role: "OVERLAY", sourceId: `${JURISDICTION}:instrument-a`, maxHeightMetres: 12 }),
    ]);
    expect(dimensional(composed)?.maxHeightMetres?.value).toBe(12);
    expect(composed.findings.some((f) => f.code === "DUPLICATE_RULE_COLLAPSED")).toBe(true);
  });

  test("the same value from genuinely different sources keeps both provenance chains and raises nothing", () => {
    const composed = compose([
      pack({ packId: "a", role: "BASE", maxHeightMetres: 12, qualification: { evidenceQuality: "high", ruleApplicability: "high" } }),
      pack({ packId: "b", role: "OVERLAY", maxHeightMetres: 12, qualification: { evidenceQuality: "moderate", ruleApplicability: "high" } }),
    ]);
    expect(dimensional(composed)?.maxHeightMetres?.value).toBe(12);
    expect(composed.unresolvedConflicts).toEqual([]);
    const agreement = composed.findings.find((f) => f.code === "INDEPENDENT_AGREEMENT_PRESERVED");
    expect(agreement?.packIds).toEqual(["a", "b"]);
    // Agreement floors qualification like everything else; it never lifts it.
    expect(composed.qualification.evidenceQuality).toBe("moderate");
  });

  test("two by-laws permitting the same use in different words agree rather than conflict", () => {
    const sourceA = `${JURISDICTION}:a`;
    const sourceB = `${JURISDICTION}:b`;
    const packs: E85RulePack[] = [
      {
        ...pack({ packId: "a", role: "BASE" }),
        rules: [
          {
            jurisdictionId: JURISDICTION,
            zoneDesignation: ZONE,
            family: "USE",
            permissions: [evidence({ useCode: "dwelling", status: "PERMITTED" as const, rawSourceTerminology: "Outright" }, sourceA, "2.1")],
          },
        ],
      },
      {
        ...pack({ packId: "b", role: "OVERLAY" }),
        rules: [
          {
            jurisdictionId: JURISDICTION,
            zoneDesignation: ZONE,
            family: "USE",
            permissions: [evidence({ useCode: "dwelling", status: "PERMITTED" as const, rawSourceTerminology: "Permitted As Of Right" }, sourceB, "2.1")],
          },
        ],
      },
    ];
    const composed = compose(packs);
    expect(composed.unresolvedConflicts).toEqual([]);
    expect(composed.findings.some((f) => f.code === "INDEPENDENT_AGREEMENT_PRESERVED")).toBe(true);
  });

  test("the same use with genuinely different statuses does conflict", () => {
    const packs: E85RulePack[] = [
      {
        ...pack({ packId: "a", role: "BASE" }),
        rules: [
          {
            jurisdictionId: JURISDICTION,
            zoneDesignation: ZONE,
            family: "USE",
            permissions: [evidence({ useCode: "dwelling", status: "PERMITTED" as const }, `${JURISDICTION}:a`, "2.1")],
          },
        ],
      },
      {
        ...pack({ packId: "b", role: "OVERLAY" }),
        rules: [
          {
            jurisdictionId: JURISDICTION,
            zoneDesignation: ZONE,
            family: "USE",
            permissions: [evidence({ useCode: "dwelling", status: "PROHIBITED" as const }, `${JURISDICTION}:b`, "2.1")],
          },
        ],
      },
    ];
    const composed = compose(packs);
    expect(composed.unresolvedConflicts.map((c) => c.conceptKey)).toEqual([buildE85ConceptKey("USE", "permission", "dwelling")]);
  });
});

describe("E85 Phase 6 — input order decides nothing", () => {
  const packs = () => [
    pack({ packId: "base", role: "BASE", maxFsr: 1.0, maxHeightMetres: 12 }),
    pack({ packId: "overlay", role: "OVERLAY", frontSetback: 5 }),
    pack({ packId: "agreement", role: "AGREEMENT", maxStoreys: 3 }),
  ];

  test("every permutation of three compatible packs composes identically", () => {
    const perms = permutations(packs());
    expect(perms).toHaveLength(6);
    const first = JSON.stringify(compose(perms[0]));
    for (const p of perms) expect(JSON.stringify(compose(p))).toBe(first);
  });

  test("every permutation of a conflicting set produces the same unresolved conflict", () => {
    const conflicting = [
      pack({ packId: "a", role: "BASE", maxHeightMetres: 12 }),
      pack({ packId: "b", role: "OVERLAY", maxHeightMetres: 10 }),
      pack({ packId: "c", role: "AGREEMENT", maxHeightMetres: 8 }),
    ];
    const results = permutations(conflicting).map((p) => JSON.stringify(compose(p)));
    expect(new Set(results).size).toBe(1);
    const composed = compose(conflicting);
    expect([...composed.unresolvedConflicts[0].distinctValues].sort((x, y) => (x as number) - (y as number))).toEqual([8, 10, 12]);
  });

  test("findings, suppressed records and conflicts all come back in a stable order", () => {
    const a = compose(packs());
    const b = compose([...packs()].reverse());
    expect(a.findings.map((f) => `${f.code}|${f.conceptKey ?? ""}`)).toEqual(b.findings.map((f) => `${f.code}|${f.conceptKey ?? ""}`));
  });
});

describe("E85 Phase 6 — idempotence and immutability", () => {
  test("composing the same set twice yields the same result", () => {
    const packs = [pack({ packId: "a", role: "BASE", maxFsr: 1.0 }), pack({ packId: "b", role: "OVERLAY", frontSetback: 5 })];
    expect(JSON.stringify(compose(packs))).toBe(JSON.stringify(compose(packs)));
  });

  test("composition does not mutate its inputs, even deeply frozen ones", () => {
    const deepFreeze = <T>(value: T): T => {
      if (value && typeof value === "object" && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const key of Object.keys(value as Record<string, unknown>)) deepFreeze((value as Record<string, unknown>)[key]);
      }
      return value;
    };
    const packs = [pack({ packId: "a", role: "BASE", maxFsr: 1.0, maxHeightMetres: 12 }), pack({ packId: "b", role: "OVERLAY", maxHeightMetres: 10 })];
    const relations = [relation({ relationId: "r1", subjectPackId: "b", objectPackId: "a", type: "OVERRIDES" })];
    deepFreeze(packs);
    deepFreeze(relations);
    const before = JSON.stringify({ packs, relations });
    expect(() => composeE85RulePacks(packs, { composedAt: COMPOSED_AT, precedenceRelations: relations })).not.toThrow();
    expect(JSON.stringify({ packs, relations })).toBe(before);
  });
});

describe("E85 Phase 6 — requested-output materiality", () => {
  const mixed = () =>
    compose([
      pack({ packId: "a", role: "BASE", maxFsr: 1.0, minParkingPerDwelling: 1 }),
      pack({ packId: "b", role: "OVERLAY", minParkingPerDwelling: 2 }),
    ]);

  test("a contested parking ratio is recorded with its family", () => {
    const composed = mixed();
    expect(composed.unresolvedConflicts.map((c) => c.family)).toEqual(["PARKING"]);
  });

  test("it is not material to a USE + DENSITY request", () => {
    const composed = mixed();
    expect(materialCompositionConflicts(composed, ["USE", "DENSITY"])).toEqual([]);
    expect(compositionManualReview(composed, ["USE", "DENSITY"])).toBeUndefined();
  });

  test("it is material once PARKING is requested", () => {
    const composed = mixed();
    expect(materialCompositionConflicts(composed, ["USE", "DENSITY", "PARKING"])).toHaveLength(1);
    expect(compositionManualReview(composed, ["PARKING"])?.reasonCode).toBe("CONFLICTING_AUTHORITATIVE_SOURCES");
  });
});

describe("E85 Phase 6 — incomposable input is refused, not merged", () => {
  test("packs from two different zones are refused", () => {
    const other = { ...pack({ packId: "b", role: "OVERLAY", maxFsr: 2 }), zoneDesignation: "TB-2" };
    const result = composeE85RulePacks([pack({ packId: "a", role: "BASE", maxFsr: 1 }), other], { composedAt: COMPOSED_AT });
    expect(result.outcome).toBe("REFUSED");
    if (result.outcome !== "REFUSED") return;
    expect(result.problems[0].code).toBe("INCOMPATIBLE_PACK_CONTEXT");
    expect(result.manualReview.flaggedAt).toBe(COMPOSED_AT);
  });

  test("two packs sharing a packId are refused, because a relation could not name one", () => {
    const result = composeE85RulePacks([pack({ packId: "a", role: "BASE", maxFsr: 1 }), pack({ packId: "a", role: "OVERLAY", frontSetback: 5 })], { composedAt: COMPOSED_AT });
    expect(result.outcome).toBe("REFUSED");
    if (result.outcome !== "REFUSED") return;
    expect(result.problems[0].code).toBe("DUPLICATE_PACK_ID");
  });

  test("refusal is a returned result, never a thrown exception", () => {
    const other = { ...pack({ packId: "b", role: "OVERLAY" }), jurisdictionId: "zz-qq-elsewhere" };
    expect(() => composeE85RulePacks([pack({ packId: "a", role: "BASE" }), other], { composedAt: COMPOSED_AT })).not.toThrow();
  });
});

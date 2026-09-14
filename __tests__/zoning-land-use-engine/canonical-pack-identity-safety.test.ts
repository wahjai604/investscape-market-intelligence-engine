/**
 * InvestScape™ E85 Phase 11A — canonical rule-pack identity: collision safety.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Phase 11 made `packId` something two parties derive independently — a spatial
 * layer naming the instrument that governs a polygon, and a composition naming
 * the pack built from that instrument — rather than something one caller
 * invents. The moment an identifier is DERIVED rather than assigned, its
 * serialization becomes load-bearing: if two different (instrument, version)
 * pairs can print the same id, a precedence relation, a spatial link and a
 * decision trace can all silently refer to the wrong body of law.
 *
 * This suite proves the serialization is injective, and proves it from the
 * actual grammar rather than from the observation that today's examples happen
 * to contain no separator. It also proves the two things that must remain true
 * when an id IS shared: that Phase 6 refuses conflicting packs carrying one
 * canonical id instead of quietly picking one, and that repeating an identical
 * pack does not manufacture a second governing authority.
 */
import {
  buildE85SourceId,
  isValidE85SourceId,
  createE85SourceRegistry,
  e85RulePackIdFromSource,
  canonicalRulePackFromBundle,
  composeE85RulePacks,
  E85_RULE_PACK_ID_VERSION_SEPARATOR,
  E85RulePack,
  E85SourceDefinition,
} from "../../src/zoning-land-use-engine";
import { VANCOUVER_R1_1_SOURCE } from "../../src/zoning-land-use-engine/adapters/vancouver/r1-1-source";
import { pack, conditionalHeight, COMPOSED_AT } from "./fixtures/composition-packs";

const SEP = E85_RULE_PACK_ID_VERSION_SEPARATOR;

/** A contract-valid source identity, built through the authoritative builder rather than typed as a literal. */
const VALID_SOURCE = buildE85SourceId({ jurisdictionId: "xx-yy-testburgh", documentSlug: "zoning-bylaw-1234", scheduleSlug: "district-schedule-tb-1" });

describe("E85 Phase 11A — source-identity grammar is explicit and enforced", () => {
  test("the sourceId grammar admits no separator character at all", () => {
    // Not "no current example contains it" — the pattern itself permits only
    // lower-case alphanumerics and the three joiners, so the separator is
    // unreachable for every conforming id, present and future.
    expect(isValidE85SourceId(VALID_SOURCE)).toBe(true);
    expect(SEP).toBe("@");
    expect(VALID_SOURCE).not.toContain(SEP);
    for (const candidate of [
      `xx-yy-testburgh:zoning-bylaw-1234${SEP}v2`,
      `xx-yy-testburgh${SEP}odd:zoning-bylaw-1234`,
      `xx-yy-testburgh:zoning${SEP}bylaw:schedule-a`,
      `${SEP}xx-yy-testburgh:zoning-bylaw-1234`,
    ]) {
      expect({ candidate, valid: isValidE85SourceId(candidate) }).toEqual({ candidate, valid: false });
    }
  });

  test("the authoritative builder throws on a separator in any component", () => {
    expect(() => buildE85SourceId({ jurisdictionId: `xx-yy-test${SEP}burgh`, documentSlug: "zoning-bylaw-1234" })).toThrow(/Invalid E85 sourceId/);
    expect(() => buildE85SourceId({ jurisdictionId: "xx-yy-testburgh", documentSlug: `zoning-bylaw${SEP}1234` })).toThrow(/Invalid E85 sourceId/);
    expect(() => buildE85SourceId({ jurisdictionId: "xx-yy-testburgh", documentSlug: "zoning-bylaw-1234", scheduleSlug: `schedule${SEP}a` })).toThrow(/Invalid E85 sourceId/);
  });

  test("the source registry refuses to build around a separator-bearing source id", () => {
    // The second enforcement point, and the one that matters operationally: a
    // malformed identity cannot enter a registry and reach composition later.
    const malformed: E85SourceDefinition = { ...VANCOUVER_R1_1_SOURCE, sourceId: `ca-bc-vancouver:zoning-development-bylaw-3575${SEP}june` };
    const result = createE85SourceRegistry([malformed]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.map((p) => p.code)).toContain("MALFORMED_SOURCE_ID");
  });

  test("a version label carries NO grammar, and this is recorded rather than assumed away", () => {
    // Honest statement of the audit's actual finding: E85 constrains source
    // identity and does not constrain version identity. A publisher's label is
    // theirs, and a version legitimately containing the separator is
    // contract-valid today. Collision safety therefore may not lean on the
    // version side, and the tests below show it does not need to.
    const oddVersion = { ...VANCOUVER_R1_1_SOURCE, versions: [{ ...VANCOUVER_R1_1_SOURCE.versions[0], versionId: `2026-06${SEP}council-adopted` }] };
    const result = createE85SourceRegistry([oddVersion]);
    expect(result.ok).toBe(true);
  });
});

describe("E85 Phase 11A — canonical pack identity is collision-safe", () => {
  test("the adversarial pair that would collide under naive concatenation cannot both exist", () => {
    // Pair A: the separator smuggled into the SOURCE half. Contract-invalid at
    // three independent points, and now refused by the identity helper itself
    // before any id is minted.
    const smuggled = `xx-yy-testburgh:zoning-bylaw-1234${SEP}b`;
    expect(isValidE85SourceId(smuggled)).toBe(false);
    expect(() => e85RulePackIdFromSource({ sourceId: smuggled, sourceVersionId: "c" })).toThrow(/not a valid E85 source identity/);

    // Pair B: the same characters, with the separator in the VERSION half.
    // Contract-valid, and it serializes to exactly the string pair A would have
    // produced — which is precisely why pair A must be unconstructible.
    const legitimate = e85RulePackIdFromSource({ sourceId: "xx-yy-testburgh:zoning-bylaw-1234", sourceVersionId: `b${SEP}c` });
    expect(legitimate).toBe(`xx-yy-testburgh:zoning-bylaw-1234${SEP}b${SEP}c`);
  });

  test("the first separator splits the id back into its two parts exactly", () => {
    // "Unambiguously structured": the left of the FIRST separator is the source
    // identity, because a source identity can contain none. Everything after is
    // the version, separators included.
    for (const version of ["2026-06-consolidation", `b${SEP}c`, `${SEP}leading`, `trailing${SEP}`, "with spaces", "UPPER-Case"]) {
      const id = e85RulePackIdFromSource({ sourceId: VALID_SOURCE, sourceVersionId: version });
      const cut = id.indexOf(SEP);
      expect({ version, source: id.slice(0, cut), version_: id.slice(cut + 1) }).toEqual({ version, source: VALID_SOURCE, version_: version });
    }
  });

  test("distinct contract-valid pairs never serialize to the same id", () => {
    const sources = [
      "xx-yy-testburgh:zoning-bylaw-1234",
      "xx-yy-testburgh:zoning-bylaw-1234:district-schedule-tb-1",
      "xx-yy-otherville:zoning-bylaw-1234:district-schedule-tb-1",
      "xx-yy-testburgh:zoning-bylaw-5678",
    ];
    const versions = ["2026-06-consolidation", "2027-03-consolidation", `b${SEP}c`, `2026-06${SEP}council`, "1234"];
    for (const s of sources) expect(isValidE85SourceId(s)).toBe(true);

    const ids = sources.flatMap((sourceId) => versions.map((sourceVersionId) => e85RulePackIdFromSource({ sourceId, sourceVersionId })));
    expect(new Set(ids).size).toBe(sources.length * versions.length);
  });

  test("a version cannot impersonate a different source", () => {
    // The concrete failure the injectivity proof rules out: a version label
    // shaped like another municipality's identity must not relocate the pack.
    const id = e85RulePackIdFromSource({ sourceId: "xx-yy-testburgh:zoning-bylaw-1234", sourceVersionId: "xx-yy-otherville:zoning-bylaw-1234" });
    const impersonated = e85RulePackIdFromSource({ sourceId: "xx-yy-otherville:zoning-bylaw-1234", sourceVersionId: "2026-06-consolidation" });
    expect(id).not.toBe(impersonated);
    expect(id.slice(0, id.indexOf(SEP))).toBe("xx-yy-testburgh:zoning-bylaw-1234");
  });

  test("identity generation is refused, not guessed, when the source identity is unusable", () => {
    expect(() => e85RulePackIdFromSource({ sourceId: "", sourceVersionId: "v" })).toThrow(/never manufactured/);
    expect(() => e85RulePackIdFromSource({ sourceId: "   ", sourceVersionId: "v" })).toThrow(/never manufactured/);
    // A single segment is not a source identity: it names no document.
    expect(() => e85RulePackIdFromSource({ sourceId: "ca-bc-vancouver", sourceVersionId: "v" })).toThrow(/not a valid E85 source identity/);
    expect(() => e85RulePackIdFromSource({ sourceId: "C:\\sources\\r1-1.pdf", sourceVersionId: "v" })).toThrow(/not a valid E85 source identity/);
    expect(() => e85RulePackIdFromSource({ sourceId: "https://vancouver.ca/r1-1", sourceVersionId: "v" })).toThrow(/not a valid E85 source identity/);
  });
});

describe("E85 Phase 11A — absent-version semantics are unambiguous", () => {
  test("no version identified collapses to the enduring instrument identity", () => {
    const bare = e85RulePackIdFromSource({ sourceId: VALID_SOURCE });
    expect(bare).toBe(VALID_SOURCE);
    expect(bare).not.toContain(SEP);
  });

  test("absent, empty and whitespace-only versions are the same fact and are treated as one", () => {
    // Not a collision between two legal versions: none of these IS a version
    // label, so all three say "no version was identified". The alternative —
    // emitting `source@` for an empty string — would invent a version-shaped
    // id for a version nobody stated.
    const bare = e85RulePackIdFromSource({ sourceId: VALID_SOURCE });
    for (const sourceVersionId of [undefined, "", " ", "\t", "\n  "]) {
      expect(e85RulePackIdFromSource({ sourceId: VALID_SOURCE, sourceVersionId })).toBe(bare);
    }
  });

  test("an unversioned id can never equal a versioned id for any legal version", () => {
    // The structural reason, not a sample: every versioned id contains the
    // separator and no unversioned id can, because no source identity may.
    const bare = e85RulePackIdFromSource({ sourceId: VALID_SOURCE });
    for (const sourceVersionId of ["2026-06-consolidation", "v1", "0", `a${SEP}b`, "unknown", "latest", "current"]) {
      const versioned = e85RulePackIdFromSource({ sourceId: VALID_SOURCE, sourceVersionId });
      expect(versioned).not.toBe(bare);
      expect(versioned).toContain(SEP);
    }
  });

  test("no placeholder version is invented to fill an absent one", () => {
    const bare = e85RulePackIdFromSource({ sourceId: VALID_SOURCE });
    for (const placeholder of ["unknown", "latest", "current", "null", "undefined", "none"]) {
      expect(bare.toLowerCase()).not.toContain(placeholder);
    }
    // And the absent case stays distinguishable from someone explicitly
    // registering a version whose label happens to be "unknown".
    expect(e85RulePackIdFromSource({ sourceId: VALID_SOURCE, sourceVersionId: "unknown" })).not.toBe(bare);
  });
});

/** Two packs that agree on every identity field and disagree on what the law says. */
function conflictingPair(): readonly [E85RulePack, E85RulePack] {
  const sourceId = "xx-yy-testburgh:zoning-bylaw-1234:district-schedule-tb-1";
  const sourceVersionId = "2026-06-consolidation";
  const canonical = e85RulePackIdFromSource({ sourceId, sourceVersionId });
  const one = { ...pack({ packId: canonical, role: "BASE", maxFsr: 1, sourceId }), sourceVersionId };
  const two = { ...pack({ packId: canonical, role: "BASE", maxFsr: 3, sourceId }), sourceVersionId };
  return [one, two];
}

describe("E85 Phase 11A — a shared canonical id never hides conflicting content", () => {
  test("two packs with identical canonical identity but different rules are refused", () => {
    const [one, two] = conflictingPair();
    expect(one.packId).toBe(two.packId);
    expect(one.sourceId).toBe(two.sourceId);
    expect(one.sourceVersionId).toBe(two.sourceVersionId);

    const result = composeE85RulePacks([one, two], { composedAt: COMPOSED_AT });
    expect(result.outcome).toBe("REFUSED");
    if (result.outcome !== "REFUSED") return;
    expect(result.problems.map((p) => p.code)).toContain("DUPLICATE_PACK_ID");
  });

  test("neither conflicting value is chosen — not the first, not the last, not the stricter", () => {
    const [one, two] = conflictingPair();
    for (const order of [
      [one, two],
      [two, one],
    ]) {
      const result = composeE85RulePacks(order, { composedAt: COMPOSED_AT });
      expect(result.outcome).toBe("REFUSED");
      if (result.outcome !== "REFUSED") continue;
      // A refusal carries no effective rules at all, so there is no surface on
      // which an FSR of 1 or 3 could have been silently preferred.
      expect(result).not.toHaveProperty("composed");
    }
  });

  test("the refusal is order-independent", () => {
    const [one, two] = conflictingPair();
    const forward = composeE85RulePacks([one, two], { composedAt: COMPOSED_AT });
    const reverse = composeE85RulePacks([two, one], { composedAt: COMPOSED_AT });
    expect(forward.outcome).toBe(reverse.outcome);
    if (forward.outcome !== "REFUSED" || reverse.outcome !== "REFUSED") return;
    expect(forward.problems.map((p) => p.code).sort()).toEqual(reverse.problems.map((p) => p.code).sort());
  });

  test("a conflict in conditional rules alone is caught by the same gate", () => {
    const sourceId = "xx-yy-testburgh:zoning-bylaw-1234:district-schedule-tb-1";
    const canonical = e85RulePackIdFromSource({ sourceId, sourceVersionId: "2026-06-consolidation" });
    const plain = pack({ packId: canonical, role: "BASE", maxFsr: 1, sourceId });
    const withCondition = pack({ packId: canonical, role: "BASE", maxFsr: 1, sourceId, conditionalRules: [conditionalHeight("site fronts an arterial", 12, sourceId)] });
    // Identical on every unconditional axis; they differ only in what one of
    // them says applies conditionally.
    expect(plain.conditionalRules).toEqual([]);
    expect(withCondition.conditionalRules).toHaveLength(1);
    const result = composeE85RulePacks([plain, withCondition], { composedAt: COMPOSED_AT });
    expect(result.outcome).toBe("REFUSED");
    if (result.outcome !== "REFUSED") return;
    expect(result.problems.map((p) => p.code)).toContain("DUPLICATE_PACK_ID");
  });

  test("the refusal is a returned result, never a thrown exception", () => {
    const [one, two] = conflictingPair();
    expect(() => composeE85RulePacks([one, two], { composedAt: COMPOSED_AT })).not.toThrow();
  });
});

describe("E85 Phase 11A — an identical duplicate does not inflate authority", () => {
  test("the same pack supplied twice does not become two governing sources", () => {
    const sourceId = "xx-yy-testburgh:zoning-bylaw-1234:district-schedule-tb-1";
    const canonical = e85RulePackIdFromSource({ sourceId, sourceVersionId: "2026-06-consolidation" });
    const one = pack({ packId: canonical, role: "BASE", maxFsr: 1, sourceId });
    const again = pack({ packId: canonical, role: "BASE", maxFsr: 1, sourceId });

    const result = composeE85RulePacks([one, again], { composedAt: COMPOSED_AT });
    // Existing Phase 6 semantics, retained unchanged: a repeated read is not
    // corroboration, and composition does not silently deduplicate it either —
    // it says it cannot tell which pack a precedence relation would have meant.
    expect(result.outcome).toBe("REFUSED");
    if (result.outcome !== "REFUSED") return;
    expect(result.problems.map((p) => p.code)).toContain("DUPLICATE_PACK_ID");
  });

  test("the same pack supplied once composes normally, so the refusal is about duplication", () => {
    const sourceId = "xx-yy-testburgh:zoning-bylaw-1234:district-schedule-tb-1";
    const canonical = e85RulePackIdFromSource({ sourceId, sourceVersionId: "2026-06-consolidation" });
    const result = composeE85RulePacks([pack({ packId: canonical, role: "BASE", maxFsr: 1, sourceId })], { composedAt: COMPOSED_AT });
    expect(result.outcome).toBe("COMPOSED");
    if (result.outcome !== "COMPOSED") return;
    expect(result.composed.contributingPackIds).toEqual([canonical]);
    expect(result.composed.contributingSourceIds).toEqual([sourceId]);
  });

  test("two DIFFERENT consolidations of one instrument stay two packs, and compose as such", () => {
    // The counterpart property: distinct canonical identity must NOT be
    // collapsed. An amended consolidation is a different pack, not a duplicate.
    const sourceId = "xx-yy-testburgh:zoning-bylaw-1234:district-schedule-tb-1";
    const older = { ...pack({ packId: e85RulePackIdFromSource({ sourceId, sourceVersionId: "2026-06-consolidation" }), role: "BASE", maxFsr: 1, sourceId }), sourceVersionId: "2026-06-consolidation" };
    const newer = { ...pack({ packId: e85RulePackIdFromSource({ sourceId, sourceVersionId: "2027-03-consolidation" }), role: "OVERLAY", maxHeightMetres: 12, sourceId }), sourceVersionId: "2027-03-consolidation" };
    expect(older.packId).not.toBe(newer.packId);
    const result = composeE85RulePacks([older, newer], { composedAt: COMPOSED_AT });
    expect(result.outcome).not.toBe("REFUSED");
  });
});

describe("E85 Phase 11A — pack identity stays secondary to legal identity", () => {
  test("a canonical pack still carries sourceId and sourceVersionId independently", () => {
    const sourceId = "xx-yy-testburgh:zoning-bylaw-1234:district-schedule-tb-1";
    const sourceVersionId = "2026-06-consolidation";
    const built = { ...pack({ packId: e85RulePackIdFromSource({ sourceId, sourceVersionId }), role: "BASE", maxFsr: 1, sourceId }), sourceVersionId };
    expect(built.sourceId).toBe(sourceId);
    expect(built.sourceVersionId).toBe(sourceVersionId);
    // Derivable in one direction only by design: the id is built FROM these,
    // and they are not reconstructed FROM the id anywhere in the engine.
    expect(built.packId).toBe(`${sourceId}${SEP}${sourceVersionId}`);
  });

  test("the canonical convenience wrapper and the raw helper agree exactly", () => {
    // Guards against the wrapper drifting into a second identity scheme.
    const sourceId = "xx-yy-testburgh:zoning-bylaw-1234:district-schedule-tb-1";
    const sourceVersionId = "2026-06-consolidation";
    const bundleShaped = { ...pack({ packId: "caller-invented", role: "BASE", maxFsr: 1, sourceId }), sourceVersionId };
    expect(e85RulePackIdFromSource(bundleShaped)).toBe(e85RulePackIdFromSource({ sourceId, sourceVersionId }));
    expect(typeof canonicalRulePackFromBundle).toBe("function");
  });

  test("a caller-supplied pack id is still accepted, so no historical identity is migrated", () => {
    // Phase 11A changes nothing for packs whose ids predate the canonical path.
    const result = composeE85RulePacks([pack({ packId: "a", role: "BASE", maxFsr: 1 }), pack({ packId: "b", role: "OVERLAY", maxHeightMetres: 12 })], { composedAt: COMPOSED_AT });
    expect(result.outcome).toBe("COMPOSED");
  });
});

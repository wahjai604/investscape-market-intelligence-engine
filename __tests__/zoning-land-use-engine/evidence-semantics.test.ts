/**
 * InvestScape™ E85 Phase 5A — evidence-semantics tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Three claims Phase 5 made that its evidence did not support, each now pinned
 * so it cannot come back:
 *
 *   1. TEMPORAL   — a document headed "June 2026" was recorded as taking effect
 *                   on 2026-06-01. The month was real; the day was invented,
 *                   and a legal effective date was read out of a publication
 *                   stamp that is not one.
 *   2. LICENSING  — a document with no licence statement of any kind was
 *                   recorded as PUBLIC_REUSE, turning "the public can read it"
 *                   into "we may redistribute it".
 *   3. ZONE GAPS  — a real zoning instrument the pilot has no normalizer for
 *                   was reported as zoning that could not be found, which is a
 *                   claim about the world rather than about E85's coverage.
 *
 * Offline and self-contained: no PDF is read, no local evidence folder is
 * touched, no network is reached. The primary-source facts these tests encode
 * are the NEGATIVE ones — that the schedule states no day and no licence — and
 * no regulatory prose appears here.
 */
import {
  createE85AdapterRegistry,
  createE85SourceRegistry,
  normalizeSourceDocument,
  unsupportedReasonToGap,
  deriveE85TemporalWindow,
  describeE85VersionPublication,
  isFullIsoDate,
  isIsoYearMonth,
  evaluateTemporalApplicability,
  computeE85AnalyticalReadiness,
  assessE85SourceReadiness,
  E85AdapterUnsupportedReason,
  E85DataGap,
  E85DataGapReasonCode,
  E85NormalizedRuleBundle,
  E85SourceDefinition,
  E85SourceVersion,
  adapters,
} from "../../src/zoning-land-use-engine";
import { r11Document, EXTRACTED_AT } from "./fixtures/vancouver-r1-1-facts";

const {
  vancouverR11Adapter,
  VANCOUVER_R1_1_SOURCE,
  VANCOUVER_R1_1_SOURCE_ID,
  VANCOUVER_R1_1_VERSION_ID,
  VANCOUVER_R1_1_CONSOLIDATION_PERIOD,
  VANCOUVER_JURISDICTION_ID,
} = adapters.vancouver;

function registries() {
  const sources = createE85SourceRegistry([VANCOUVER_R1_1_SOURCE]);
  const adapterReg = createE85AdapterRegistry([vancouverR11Adapter]);
  if (!sources.ok || !adapterReg.ok) throw new Error("registries should build");
  return { sourceRegistry: sources.registry, adapterRegistry: adapterReg.registry };
}

function normalized(source: E85SourceDefinition = VANCOUVER_R1_1_SOURCE): E85NormalizedRuleBundle {
  const result = vancouverR11Adapter.normalize(r11Document(), source);
  if (result.outcome !== "NORMALIZED") throw new Error(`expected NORMALIZED, got ${result.outcome}`);
  return result.bundle;
}

const registeredVersion = (): E85SourceVersion => VANCOUVER_R1_1_SOURCE.versions[0];

/* ================================================================== *
 * 1. TEMPORAL PRECISION
 * ================================================================== */

describe("E85 Phase 5A — a month-only publication stamp never becomes a day", () => {
  test("the registered version records June 2026 at month precision and states no day", () => {
    const v = registeredVersion();
    expect(v.consolidationPeriod).toBe("2026-06");
    expect(isIsoYearMonth(v.consolidationPeriod)).toBe(true);
    expect(v.consolidationDate).toBeUndefined();
    expect(v.publishedDate).toBeUndefined();
  });

  test("no exact effective date appears without exact source evidence", () => {
    const v = registeredVersion();
    expect(v.effectiveFrom).toBeUndefined();
    expect(v.effectiveDateBasis).toBe("UNKNOWN");
  });

  test("the string 2026-06-01 appears nowhere in the registered source or the normalized bundle", () => {
    expect(JSON.stringify(VANCOUVER_R1_1_SOURCE)).not.toContain("2026-06-01");
    expect(JSON.stringify(normalized())).not.toContain("2026-06-01");
  });

  // PHASE 12C.2: the source's own June-2026 publication stamp still never
  // becomes a day (no "sourceVersionId"-only value manufactures one), but the
  // bundle now legitimately carries "2026-06-30" on the facts By-law 14747
  // proves took effect that day — a genuinely different date, from a genuinely
  // different instrument, never inferred from the June-2026 consolidation
  // stamp. Every occurrence must be traceable to AMENDMENT_DATE_KNOWN.
  test("every 2026-06 date in the bundle is the proven 2026-06-30 amendment date, never a manufactured publication-stamp day", () => {
    const parsed: unknown = JSON.parse(JSON.stringify(normalized()));
    const found = new Set<string>();
    (function walk(node: unknown): void {
      if (typeof node === "string") {
        for (const m of node.matchAll(/2026-06-\d{2}/g)) found.add(m[0]);
      } else if (node !== null && typeof node === "object") {
        for (const v of Object.values(node)) walk(v);
      }
    })(parsed);
    expect([...found]).toEqual(["2026-06-30"]);
  });

  test("source-version identity and rule-effective date are different fields answering different questions", () => {
    const bundle = normalized();
    // WHICH TEXT was read: retained in full, exactly as before.
    expect(bundle.sourceVersionId).toBe(VANCOUVER_R1_1_VERSION_ID);
    expect(bundle.sourceVersionId).toBe("2026-06-consolidation");
    // WHEN THE RULES took effect: not established, and said so.
    expect(bundle.temporal.effectiveFrom).toBeUndefined();
    expect(bundle.temporal.effectiveDateBasis).toBe("UNKNOWN");
  });

  test("the version label is never parsed for a date, however date-like it looks", () => {
    const labelled: E85SourceVersion = { versionId: "2026-06-consolidation", effectiveDateBasis: "UNKNOWN" };
    expect(deriveE85TemporalWindow(labelled)).toEqual({ effectiveDateBasis: "UNKNOWN" });
  });
});

describe("E85 Phase 5A — deriveE85TemporalWindow refuses every publication-to-effect shortcut", () => {
  const base = { versionId: "v1" } as const;

  test("a consolidation date is not promoted to an effective date", () => {
    const w = deriveE85TemporalWindow({ ...base, consolidationDate: "2026-06-04", effectiveDateBasis: "PUBLICATION_DATE_INFERRED" });
    expect(w).toEqual({ effectiveDateBasis: "UNKNOWN" });
  });

  test("a publication date is not promoted to an effective date", () => {
    const w = deriveE85TemporalWindow({ ...base, publishedDate: "2026-06-04", effectiveDateBasis: "PUBLICATION_DATE_INFERRED" });
    expect(w).toEqual({ effectiveDateBasis: "UNKNOWN" });
  });

  test("a month-precision period is not widened into a date", () => {
    const w = deriveE85TemporalWindow({ ...base, consolidationPeriod: "2026-06", effectiveDateBasis: "PUBLICATION_DATE_INFERRED" });
    expect(w).toEqual({ effectiveDateBasis: "UNKNOWN" });
    expect(JSON.stringify(w)).not.toContain("2026-06");
  });

  test("a partial value in effectiveFrom is refused rather than completed", () => {
    expect(isFullIsoDate("2026-06")).toBe(false);
    expect(isFullIsoDate("2026-06-01")).toBe(true);
    const w = deriveE85TemporalWindow({ ...base, effectiveFrom: "2026-06", effectiveDateBasis: "SOURCE_STATED" });
    expect(w).toEqual({ effectiveDateBasis: "UNKNOWN" });
  });

  test("an UNKNOWN basis suppresses any date that snuck alongside it", () => {
    const w = deriveE85TemporalWindow({ ...base, effectiveFrom: "2026-06-15", effectiveDateBasis: "UNKNOWN" });
    expect(w).toEqual({ effectiveDateBasis: "UNKNOWN" });
  });

  test("an absent version yields UNKNOWN, never a default or a clock reading", () => {
    expect(deriveE85TemporalWindow(undefined)).toEqual({ effectiveDateBasis: "UNKNOWN" });
  });

  test("an explicitly stated full effective date IS carried through, with its basis", () => {
    const w = deriveE85TemporalWindow({ ...base, effectiveFrom: "2026-06-15", effectiveDateBasis: "SOURCE_STATED" });
    expect(w).toEqual({ effectiveFrom: "2026-06-15", effectiveDateBasis: "SOURCE_STATED" });
  });

  test("a genuine full publication date may still ground an inferred effective date, when the registry states it explicitly", () => {
    // PUBLICATION_DATE_INFERRED remains a usable, honest basis — what is
    // forbidden is the ADAPTER synthesizing the date, not a registrar
    // declaring one and labelling how it was arrived at.
    const w = deriveE85TemporalWindow({ ...base, publishedDate: "2026-06-04", effectiveFrom: "2026-06-04", effectiveDateBasis: "PUBLICATION_DATE_INFERRED" });
    expect(w).toEqual({ effectiveFrom: "2026-06-04", effectiveDateBasis: "PUBLICATION_DATE_INFERRED" });
  });

  test("derivation is pure and deterministic", () => {
    const v: E85SourceVersion = { ...base, consolidationPeriod: "2026-06", effectiveDateBasis: "UNKNOWN" };
    const before = JSON.stringify(v);
    expect(deriveE85TemporalWindow(v)).toEqual(deriveE85TemporalWindow(v));
    expect(JSON.stringify(v)).toBe(before);
  });
});

describe("E85 Phase 5A — the publication stamp is still reported, honestly labelled", () => {
  test("the month-precision note names the month, its precision, and what it is not", () => {
    const note = describeE85VersionPublication(registeredVersion());
    expect(note).toContain(VANCOUVER_R1_1_CONSOLIDATION_PERIOD);
    expect(note).toMatch(/MONTH precision/i);
    expect(note).toMatch(/no day is inferred/i);
    expect(note).toMatch(/not a statement of when the provisions took legal effect/i);
  });

  test("a version with no publication stamp at all produces no note rather than a vague one", () => {
    expect(describeE85VersionPublication({ versionId: "v1", effectiveDateBasis: "UNKNOWN" })).toBeUndefined();
    expect(describeE85VersionPublication(undefined)).toBeUndefined();
  });
});

describe("E85 Phase 5A — temporal uncertainty survives into the bundle and downstream", () => {
  test("the bundle carries an EFFECTIVE_DATE_UNKNOWN gap, as the basis enum requires", () => {
    const allGaps = normalized().findings.filter((f) => f.severity === "GAP");
    // Phase 12B.2: the only other GAPs are the declared coverage gaps for
    // provisions deliberately left unstructured — never a fact-level failure.
    expect(allGaps.filter((f) => f.gap?.reasonCode !== "EFFECTIVE_DATE_UNKNOWN").every((f) => f.code === "SOURCE_SECTION_UNAVAILABLE")).toBe(true);
    const gaps = allGaps.filter((f) => f.gap?.reasonCode === "EFFECTIVE_DATE_UNKNOWN");
    expect(gaps).toHaveLength(1);
    expect(gaps[0].code).toBe("SOURCE_VERSION_INCOMPLETE");
    expect(gaps[0].gap?.reasonCode).toBe("EFFECTIVE_DATE_UNKNOWN");
    expect(gaps[0].gap?.sourcesChecked).toEqual([VANCOUVER_R1_1_SOURCE_ID]);
    expect(gaps[0].gap?.checkedAt).toBe(EXTRACTED_AT);
    expect(gaps[0].gap?.resolutionHint).toMatch(/effectiveFrom/);
  });

  test("the gap explains the distinction rather than merely stating a value is missing", () => {
    const gap = normalized().findings.find((f) => f.gap?.reasonCode === "EFFECTIVE_DATE_UNKNOWN")?.gap;
    expect(gap?.reason).toMatch(/identifies WHICH TEXT was read/i);
    expect(gap?.reason).toMatch(/does not state when the provisions took legal effect/i);
  });

  test("Phase 4 reports the uncertainty as UNDETERMINED rather than resolving through it", () => {
    const bundle = normalized();
    for (const asOf of ["2020-01-01", "2026-09-01", "2099-01-01"]) {
      expect(evaluateTemporalApplicability(bundle.temporal, asOf)).toBe("UNDETERMINED");
    }
  });

  // PHASE 12C.2: the bundle mixes undated evidence (still exactly the
  // UNKNOWN window this Phase 5A test line originally pinned) with the
  // handful of facts By-law 14747 proves took effect on 2026-06-30. This test
  // now checks that EVERY evidence item still carries an explicit `temporal`
  // object of one of these two authoritative shapes — never a third,
  // unaccounted-for shape, and never simply absent.
  const KNOWN_2026_06_30 = { effectiveFrom: "2026-06-30", effectiveDateBasis: "AMENDMENT_DATE_KNOWN" };
  test("every normalized value carries an accounted-for temporal window — not just the bundle header", () => {
    const bundle = normalized();
    for (const rule of bundle.rules) {
      // Keyed maps (setbacks) are flattened, so a record holding only a scoped
      // front yard is checked as rigorously as one holding a scalar.
      const objects = Object.values(rule).filter((v): v is object => typeof v === "object" && v !== null);
      const evidences =
        rule.family === "USE"
          ? rule.permissions
          : rule.family === "REQUIREMENT"
          ? rule.requirements.flatMap((item) => [item.requirement, ...(item.quantities ?? [])])
          : objects.flatMap((v) => ("temporal" in v ? [v as { temporal: unknown }] : Object.values(v).filter((x): x is { temporal: unknown } => typeof x === "object" && x !== null && "temporal" in x)));
      expect(evidences.length).toBeGreaterThan(0);
      for (const ev of evidences) expect([{ effectiveDateBasis: "UNKNOWN" }, KNOWN_2026_06_30]).toContainEqual(ev.temporal);
    }
  });

  test("repeated normalization is byte-identical, uncertainty included", () => {
    expect(JSON.stringify(normalized())).toBe(JSON.stringify(normalized()));
  });
});

/* ================================================================== *
 * 2. LICENSING / REDISTRIBUTION
 * ================================================================== */

describe("E85 Phase 5A — licensing records established rights, never inferred ones", () => {
  test("the Vancouver source is not labelled PUBLIC_REUSE", () => {
    expect(VANCOUVER_R1_1_SOURCE.licenseStatus).not.toBe("PUBLIC_REUSE");
    expect(VANCOUVER_R1_1_SOURCE.licenseStatus).toBe("LICENSE_UNKNOWN");
  });

  test("the limitation is stated on the source record where a caller will see it", () => {
    const limitations = VANCOUVER_R1_1_SOURCE.knownLimitations.join(" ");
    expect(limitations).toMatch(/REDISTRIBUTION RIGHTS ARE UNKNOWN/);
    expect(limitations).toMatch(/no copyright, licence, open-data or terms-of-use statement/i);
    // States the finding as the absence of evidence it is, not as a restriction
    // the document imposes — the document imposes nothing, it is silent.
    expect(limitations).toMatch(/Public accessibility was verified; permission to reproduce or redistribute was not/i);
  });

  test("the temporal limitation is likewise stated rather than left implicit", () => {
    expect(VANCOUVER_R1_1_SOURCE.knownLimitations.join(" ")).toMatch(/NO EFFECTIVE DATE IS ESTABLISHED/);
  });
});

describe("E85 Phase 5A — access and licensing are independent axes", () => {
  test("the Vancouver source is accessible AND licence-unknown at the same time", () => {
    expect(VANCOUVER_R1_1_SOURCE.accessStatus).toBe("AVAILABLE");
    expect(VANCOUVER_R1_1_SOURCE.licenseStatus).toBe("LICENSE_UNKNOWN");
  });

  test("proving access never upgrades licensing", () => {
    // Every access status, held against an unknown licence: the licence answer
    // does not move, and the derived tier stays blocked on licence.
    for (const accessStatus of ["AVAILABLE", "REGISTERED", "ACCESS_NOT_VERIFIED", "DEFERRED", "UNAVAILABLE"] as const) {
      const derived = computeE85AnalyticalReadiness({ accessStatus, licenseStatus: "LICENSE_UNKNOWN", adapterReadiness: "BUILT_VERIFIED" });
      expect(derived).toBe(accessStatus === "AVAILABLE" ? "BLOCKED_BY_LICENSE" : "BLOCKED_BY_ACCESS");
      expect(derived).not.toBe("READY");
    }
  });

  test("readiness names LICENSE as the blocker while every other axis stays clear", () => {
    const a = assessE85SourceReadiness({
      source: VANCOUVER_R1_1_SOURCE,
      sourceId: VANCOUVER_R1_1_SOURCE_ID,
      versionId: VANCOUVER_R1_1_VERSION_ID,
      zoneDesignation: "R1-1",
      structureSupport: "STRUCTURED",
    });
    expect(a.blockers).toEqual(["LICENSE"]);
    expect(a.accessStatus).toBe("AVAILABLE");
    expect(a.analyticalReadiness).toBe("BLOCKED_BY_LICENSE");
    expect(a.blockerDetails.join(" ")).toMatch(/LICENSE_UNKNOWN/);
  });

  test("the licensing limitation reaches the bundle a caller actually holds", () => {
    const bundle = normalized();
    expect(bundle.readiness.licenseStatus).toBe("LICENSE_UNKNOWN");
    expect(bundle.readiness.blockers).toContain("LICENSE");
    expect(bundle.readiness.overall).toBe("BLOCKED");
  });
});

describe("E85 Phase 5A — a licence limitation does not fabricate or withhold source content", () => {
  test("normalization still succeeds and produces every rule family", () => {
    const bundle = normalized();
    expect([...new Set(bundle.rules.map((r) => r.family))].sort()).toEqual(["DENSITY", "DIMENSIONAL", "REQUIREMENT", "USE"]);
  });

  test("no rule value differs from the PUBLIC_REUSE control — licensing changes rights, not facts", () => {
    const permissive = normalized({ ...VANCOUVER_R1_1_SOURCE, licenseStatus: "PUBLIC_REUSE" });
    const unknown = normalized();
    expect(JSON.stringify(unknown.rules)).toBe(JSON.stringify(permissive.rules));
    expect(JSON.stringify(unknown.conditionalRules)).toBe(JSON.stringify(permissive.conditionalRules));
  });

  test("no test in this suite assumes redistribution permission", () => {
    // The pilot source is the one under test everywhere here; where a cleared
    // licence is needed it is constructed explicitly and locally, never
    // borrowed from the real source record.
    expect(VANCOUVER_R1_1_SOURCE.licenseStatus).toBe("LICENSE_UNKNOWN");
  });
});

/* ================================================================== *
 * 3. KNOWN ZONE VS ZONE NOT FOUND, AND THE FULL FAILURE MATRIX
 * ================================================================== */

describe("E85 Phase 5A — the source/adapter failure matrix keeps its states distinct", () => {
  const CHECKED_AT = "2026-09-01T00:00:00.000Z";
  const gapFor = (reason: E85AdapterUnsupportedReason): E85DataGap => unsupportedReasonToGap(reason, `detail for ${reason}`, [VANCOUVER_R1_1_SOURCE_ID], CHECKED_AT);

  const MATRIX: ReadonlyArray<readonly [E85AdapterUnsupportedReason, E85DataGapReasonCode]> = [
    ["JURISDICTION_NOT_SUPPORTED", "JURISDICTION_UNSUPPORTED"],
    ["JURISDICTION_MISMATCH", "JURISDICTION_UNSUPPORTED"],
    ["SOURCE_NOT_SUPPORTED", "BYLAW_NOT_FOUND"],
    ["VERSION_NOT_SUPPORTED", "BYLAW_VERSION_UNKNOWN"],
    ["ZONE_NOT_SUPPORTED", "RULE_NOT_STRUCTURED"],
    ["NO_ADAPTER_REGISTERED", "RULE_NOT_STRUCTURED"],
    ["AMBIGUOUS_ADAPTER_MATCH", "ZONING_AMBIGUOUS"],
  ];

  test.each(MATRIX)("%s maps to %s", (reason, expected) => {
    expect(gapFor(reason).reasonCode).toBe(expected);
  });

  test("the seven failure states do not collapse into one generic failure", () => {
    const codes = new Set(MATRIX.map(([, code]) => code));
    expect(codes.size).toBe(5);
    // The two reasons that share RULE_NOT_STRUCTURED stay individually
    // identifiable by their own reason axis and their own resolution hints.
    expect(gapFor("ZONE_NOT_SUPPORTED").resolutionHint).not.toBe(gapFor("NO_ADAPTER_REGISTERED").resolutionHint);
    expect(gapFor("ZONE_NOT_SUPPORTED").resolutionHint).toMatch(/adapter covering this zone/i);
    expect(gapFor("NO_ADAPTER_REGISTERED").resolutionHint).toMatch(/Build and register an adapter/i);
  });

  test("no adapter or resolver failure reports the parcel's zoning as unfindable", () => {
    for (const [reason] of MATRIX) {
      expect(gapFor(reason).reasonCode).not.toBe("ZONING_NOT_FOUND");
    }
  });

  test("a known zone unsupported by the adapter is distinguishable from an unregistered source", () => {
    expect(gapFor("ZONE_NOT_SUPPORTED").reasonCode).toBe("RULE_NOT_STRUCTURED");
    expect(gapFor("SOURCE_NOT_SUPPORTED").reasonCode).toBe("BYLAW_NOT_FOUND");
    expect(gapFor("ZONE_NOT_SUPPORTED").reasonCode).not.toBe(gapFor("SOURCE_NOT_SUPPORTED").reasonCode);
  });

  test("every matrix entry produces a real, fully-formed Phase 3 gap record", () => {
    for (const [reason] of MATRIX) {
      const gap = gapFor(reason);
      expect(gap.sourcesChecked).toEqual([VANCOUVER_R1_1_SOURCE_ID]);
      expect(gap.checkedAt).toBe(CHECKED_AT);
      expect(gap.reason).toContain(reason);
    }
  });
});

describe("E85 Phase 5A — the live pipeline reproduces the matrix, not just the mapper", () => {
  test.each([
    ["known zone, no normalizer", { zoneDesignation: "CD-1" }, "ZONE_NOT_SUPPORTED", "RULE_NOT_STRUCTURED"],
    ["unregistered source", { sourceId: "ca-bc-burnaby:zoning-bylaw-4742" }, "SOURCE_NOT_SUPPORTED", "BYLAW_NOT_FOUND"],
    ["unregistered version", { versionId: "2019-01-consolidation" }, "VERSION_NOT_SUPPORTED", "BYLAW_VERSION_UNKNOWN"],
    ["unsupported jurisdiction", { jurisdictionId: "ca-bc-unknown-municipality" }, "JURISDICTION_MISMATCH", "JURISDICTION_UNSUPPORTED"],
  ] as const)("%s → %s / %s", (_label, overrides, expectedReason, expectedCode) => {
    const { sourceRegistry, adapterRegistry } = registries();
    const result = normalizeSourceDocument(r11Document(overrides), sourceRegistry, adapterRegistry);
    expect(result.outcome).toBe("UNSUPPORTED");
    if (result.outcome !== "UNSUPPORTED") return;
    expect(result.reason).toBe(expectedReason);
    expect(result.gap.reasonCode).toBe(expectedCode);
  });

  test("an ambiguous zone match is its own state, not folded into any other", () => {
    const twin = { ...vancouverR11Adapter, identity: { ...vancouverR11Adapter.identity, adapterId: "ca-bc-vancouver.district-schedule.r1-1-twin" } };
    const built = createE85AdapterRegistry([vancouverR11Adapter, twin]);
    if (!built.ok) throw new Error("registry should build");
    const r = built.registry.resolve(
      { jurisdictionId: VANCOUVER_JURISDICTION_ID, sourceId: VANCOUVER_R1_1_SOURCE_ID, versionId: VANCOUVER_R1_1_VERSION_ID, zoneDesignation: "R1-1" },
      EXTRACTED_AT,
    );
    expect(r.resolved).toBe(false);
    if (r.resolved) return;
    expect(r.reason).toBe("AMBIGUOUS_ADAPTER_MATCH");
    expect(r.gap.reasonCode).toBe("ZONING_AMBIGUOUS");
  });

  test("a rule the extract states but the adapter cannot structure is its own state again", () => {
    const doc = r11Document({ facts: [{ factId: "x1", family: "DIMENSIONAL", zoneDesignation: "R1-1", sourceTerm: "Entirely Unreviewed Concept", numericValue: 3, unit: "METRES", locator: { section: "9.9" } }] });
    const result = vancouverR11Adapter.normalize(doc, VANCOUVER_R1_1_SOURCE);
    if (result.outcome !== "NORMALIZED") throw new Error("expected NORMALIZED");
    const finding = result.bundle.findings.find((f) => f.factId === "x1");
    expect(finding?.code).toBe("UNSUPPORTED_SOURCE_CONCEPT");
    expect(finding?.gap?.reasonCode).toBe("RULE_NOT_STRUCTURED");
  });
});

describe("E85 Phase 5A — ZONING_NOT_FOUND keeps its meaning and its place", () => {
  test("it remains in the taxonomy with its own distinct label", () => {
    const notFound: E85DataGapReasonCode = "ZONING_NOT_FOUND";
    const notStructured: E85DataGapReasonCode = "RULE_NOT_STRUCTURED";
    expect(notFound).not.toBe(notStructured);
  });

  test("it is the right code for a parcel whose zoning genuinely could not be identified", () => {
    // The state it actually describes: no designation was established at all,
    // so there is no zone name to hand any adapter in the first place. This
    // arises upstream of normalization, which is why no Phase 5 path emits it.
    const gap: E85DataGap = {
      reasonCode: "ZONING_NOT_FOUND",
      reason: "No zoning designation could be established for the parcel from the information supplied; no zone name was resolved to look a source up by.",
      sourcesChecked: [],
      checkedAt: EXTRACTED_AT,
    };
    expect(gap.reasonCode).toBe("ZONING_NOT_FOUND");
    expect(gap.reason).not.toMatch(/adapter|normaliz/i);
  });

  test("the two states are told apart by whether a zone name exists at all", () => {
    const { sourceRegistry, adapterRegistry } = registries();
    // A zone name IS present here — so whatever else is wrong, it is not that
    // the zoning could not be found.
    const result = normalizeSourceDocument(r11Document({ zoneDesignation: "CD-1" }), sourceRegistry, adapterRegistry);
    if (result.outcome !== "UNSUPPORTED") throw new Error("expected UNSUPPORTED");
    expect(result.detail).toContain("CD-1");
    expect(result.gap.reasonCode).toBe("RULE_NOT_STRUCTURED");
  });
});

/* ================================================================== *
 * 4. LAYER DISCIPLINE (retained Phase 5 decisions, pinned)
 * ================================================================== */

describe("E85 Phase 5A — qualification stays split across the layer that can answer it", () => {
  test("the bundle qualifies only on what adaptation can know", () => {
    expect(Object.keys(normalized().qualification).sort()).toEqual(["evidenceQuality", "ruleApplicability"]);
  });

  test("no parcelMatch is fabricated at normalization time, where no parcel exists", () => {
    const bundle = normalized();
    expect("parcelMatch" in bundle.qualification).toBe(false);
    // And nothing parcel-shaped leaks in by another name.
    expect(JSON.stringify(bundle.qualification)).not.toMatch(/parcel/i);
  });

  test("evidence quality and rule applicability are still both answered", () => {
    const q = normalized().qualification;
    expect(q.evidenceQuality).toBe("high");
    // Phase 12B.2: the rear-building height is now structured applicability
    // (building role), not a caller-affirmed condition, so no fact in the
    // corrected extract is condition-dependent.
    expect(q.ruleApplicability).toBe("high");
  });
});

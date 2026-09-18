/**
 * InvestScape™ E85 Phase 5 — normalization gap & honesty tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * The theme throughout: an adapter that does not understand something must say
 * so. Nothing is guessed, nothing is defaulted to zero, and no fact is
 * silently dropped.
 */
import { createE85AdapterRegistry, createE85SourceRegistry, normalizeSourceDocument, E85DimensionalRule, E85StructuredSourceFact, adapters } from "../../src/zoning-land-use-engine";
// Phase 12B.2: the templates are now the corrected, scoped R1-1 facts. These
// tests vary one field at a time, so the scope a template carries is incidental.
import { r11Document, EXTRACTED_AT, FACT_FSR_OTHER_USES as FACT_FSR, FACT_HEIGHT_OTHER_USES as FACT_HEIGHT, FACT_OUTRIGHT_SINGLE_DETACHED_HOUSE } from "./fixtures/vancouver-r1-1-facts";

const { vancouverR11Adapter, VANCOUVER_R1_1_SOURCE, VANCOUVER_R1_1_SOURCE_ID, VANCOUVER_JURISDICTION_ID } = adapters.vancouver;

function normalizeFacts(facts: readonly E85StructuredSourceFact[], docOverrides = {}) {
  const result = vancouverR11Adapter.normalize(r11Document({ facts, ...docOverrides }), VANCOUVER_R1_1_SOURCE);
  if (result.outcome !== "NORMALIZED") throw new Error(`expected NORMALIZED, got ${result.outcome}`);
  return result.bundle;
}

describe("unknown source term", () => {
  test("an unrecognized regulated concept is never guessed at", () => {
    const bundle = normalizeFacts([{ ...FACT_HEIGHT, factId: "unknown-1", sourceTerm: "Vertical Envelope Allowance" }]);
    expect(bundle.rules).toHaveLength(0);
    const finding = bundle.findings.find((f) => f.factId === "unknown-1");
    expect(finding?.code).toBe("UNSUPPORTED_SOURCE_CONCEPT");
    expect(finding?.severity).toBe("GAP");
    expect(finding?.gap?.reasonCode).toBe("RULE_NOT_STRUCTURED");
    expect(finding?.message).toMatch(/not matched approximately/i);
  });

  test("an unrecognized approval-path term is not silently PERMITTED, CONDITIONAL or PROHIBITED", () => {
    const bundle = normalizeFacts([{ ...FACT_OUTRIGHT_SINGLE_DETACHED_HOUSE, factId: "unknown-use-1", sourceTerm: "Provisionally Tolerated Use" }]);
    expect(bundle.rules).toHaveLength(0);
    expect(JSON.stringify(bundle)).not.toMatch(/"status":"(PERMITTED|CONDITIONAL|PROHIBITED)"/);
    const finding = bundle.findings.find((f) => f.factId === "unknown-use-1");
    expect(finding?.code).toBe("UNSUPPORTED_SOURCE_CONCEPT");
    expect(finding?.gap?.reasonCode).toBe("USE_CLASSIFICATION_UNKNOWN");
  });

  test("no fuzzy matching: a near-miss on a known term still fails", () => {
    for (const term of ["floor space ratio", "Floor  Space Ratio", "Floor Space Ratios", "FSR"]) {
      const bundle = normalizeFacts([{ ...FACT_FSR, factId: "near-miss", sourceTerm: term }]);
      expect(bundle.rules).toHaveLength(0);
      expect(bundle.findings.find((f) => f.factId === "near-miss")?.code).toBe("UNSUPPORTED_SOURCE_CONCEPT");
    }
  });

  test("an unrecognized land-use name is not approximated to a similar one", () => {
    const bundle = normalizeFacts([{ ...FACT_OUTRIGHT_SINGLE_DETACHED_HOUSE, factId: "unknown-use-2", sourceUseTerm: "Two-Family Dwelling" }]);
    expect(bundle.rules).toHaveLength(0);
    expect(bundle.findings.find((f) => f.factId === "unknown-use-2")?.message).toMatch(/not approximated/i);
  });
});

describe("missing required value", () => {
  test("a missing number becomes a DATA_GAP, never 0", () => {
    const bundle = normalizeFacts([{ ...FACT_FSR, factId: "no-value", numericValue: undefined }]);
    expect(bundle.rules).toHaveLength(0);
    const finding = bundle.findings.find((f) => f.factId === "no-value");
    expect(finding?.code).toBe("MISSING_REQUIRED_VALUE");
    expect(finding?.severity).toBe("GAP");
    expect(finding?.message).toMatch(/never read as 0/i);
    // The hard invariant: a gap record carries no fabricated value.
    expect(JSON.stringify(finding?.gap)).not.toMatch(/"value"/);
  });

  test("undefined is not coerced to zero anywhere in the bundle", () => {
    const bundle = normalizeFacts([{ ...FACT_HEIGHT, factId: "no-height", numericValue: undefined }]);
    expect(JSON.stringify(bundle.rules)).not.toContain('"value":0');
    expect(bundle.unresolvedSourceItems.map((u) => u.factId)).toContain("no-height");
  });

  test("a missing unit is not inferred from the concept", () => {
    const bundle = normalizeFacts([{ ...FACT_HEIGHT, factId: "no-unit", unit: undefined }]);
    expect(bundle.rules).toHaveLength(0);
    expect(bundle.findings.find((f) => f.factId === "no-unit")?.code).toBe("UNIT_UNSUPPORTED_FOR_CONCEPT");
  });

  test("a wrong unit for the concept is refused rather than coerced", () => {
    const bundle = normalizeFacts([{ ...FACT_HEIGHT, factId: "bad-unit", unit: "SPACES" }]);
    expect(bundle.rules).toHaveLength(0);
    const finding = bundle.findings.find((f) => f.factId === "bad-unit");
    expect(finding?.code).toBe("UNIT_UNSUPPORTED_FOR_CONCEPT");
    expect(finding?.message).toMatch(/no conversion is attempted/i);
  });

  test("a use fact naming no land use is a gap, not an anonymous permission", () => {
    const bundle = normalizeFacts([{ ...FACT_OUTRIGHT_SINGLE_DETACHED_HOUSE, factId: "no-use", sourceUseTerm: undefined }]);
    expect(bundle.rules).toHaveLength(0);
    expect(bundle.findings.find((f) => f.factId === "no-use")?.code).toBe("MISSING_REQUIRED_VALUE");
  });
});

describe("unsupported rule concepts and sections", () => {
  test("Vancouver parking ratios are deliberately NOT normalized", () => {
    const parkingFact: E85StructuredSourceFact = {
      factId: "parking-1",
      family: "PARKING",
      zoneDesignation: "R1-1",
      sourceTerm: "Minimum Parking Spaces",
      numericValue: 1,
      unit: "SPACES",
      locator: { section: "4.1" },
    };
    const bundle = normalizeFacts([parkingFact]);
    expect(bundle.rules).toHaveLength(0);
    const finding = bundle.findings.find((f) => f.factId === "parking-1");
    expect(finding?.code).toBe("UNSUPPORTED_SOURCE_CONCEPT");
    expect(finding?.gap?.resolutionHint).toMatch(/not been validated from primary source/i);
    // No parking number reaches the output at all.
    expect(JSON.stringify(bundle.rules)).not.toContain("PARKING");
  });

  test("an unstructured section is reported rather than passing as nonexistent", () => {
    const bundle = normalizeFacts([FACT_FSR], { unstructuredSections: ["4.3 Off-street Parking"] });
    const finding = bundle.findings.find((f) => f.code === "SOURCE_SECTION_UNAVAILABLE");
    expect(finding?.severity).toBe("GAP");
    expect(finding?.message).toMatch(/absent rather than nonexistent/i);
    expect(bundle.readiness.structureSupport).toBe("SECTION_NOT_STRUCTURED");
    expect(bundle.readiness.blockers).toContain("STRUCTURE");
  });

  test("a fact for a different zone inside a zone-scoped extract is not attributed to either zone", () => {
    const bundle = normalizeFacts([{ ...FACT_FSR, factId: "wrong-zone", zoneDesignation: "R1-2" }]);
    expect(bundle.rules).toHaveLength(0);
    const finding = bundle.findings.find((f) => f.factId === "wrong-zone");
    expect(finding?.code).toBe("AMBIGUOUS_SOURCE_INTERPRETATION");
    expect(finding?.gap?.reasonCode).toBe("ZONING_AMBIGUOUS");
  });

  test("a family label contradicting the term's mapping is reported, not resolved", () => {
    const bundle = normalizeFacts([{ ...FACT_HEIGHT, factId: "family-clash", family: "DENSITY" }]);
    expect(bundle.rules).toHaveLength(0);
    expect(bundle.findings.find((f) => f.factId === "family-clash")?.code).toBe("AMBIGUOUS_SOURCE_INTERPRETATION");
  });
});

describe("unsupported adapter / jurisdiction / zone at the entry point", () => {
  function registries() {
    const s = createE85SourceRegistry([VANCOUVER_R1_1_SOURCE]);
    const a = createE85AdapterRegistry([vancouverR11Adapter]);
    if (!s.ok || !a.ok) throw new Error("registries should build");
    return { sourceRegistry: s.registry, adapterRegistry: a.registry };
  }

  test("a fictional jurisdiction whose source IS registered but has no adapter fails at adapter resolution", () => {
    // Registering the source isolates the adapter gap: without this the run
    // would stop earlier, at "source not registered", and never exercise
    // resolution at all.
    const nowhereSource = {
      ...VANCOUVER_R1_1_SOURCE,
      sourceId: "xx-yy-nowhereville:land-code-9:schedule-z",
      jurisdictionId: "xx-yy-nowhereville",
      adapterId: undefined,
      adapterReadiness: "NOT_BUILT" as const,
      supportedZoneDesignations: ["NW-1"],
    };
    const s = createE85SourceRegistry([VANCOUVER_R1_1_SOURCE, nowhereSource]);
    const a = createE85AdapterRegistry([vancouverR11Adapter]);
    if (!s.ok || !a.ok) throw new Error("registries should build");

    const doc = r11Document({ sourceId: nowhereSource.sourceId, jurisdictionId: "xx-yy-nowhereville", zoneDesignation: "NW-1" });
    const result = normalizeSourceDocument(doc, s.registry, a.registry);
    expect(result.outcome).toBe("UNSUPPORTED");
    if (result.outcome !== "UNSUPPORTED") return;
    expect(result.reason).toBe("JURISDICTION_NOT_SUPPORTED");
    expect(result.gap.reasonCode).toBe("JURISDICTION_UNSUPPORTED");
    expect(result.gap.reason).toMatch(/No fallback to another jurisdiction/i);
    // Crucially: no Vancouver rules leak into the answer.
    expect(JSON.stringify(result)).not.toContain("11.5");
    expect(JSON.stringify(result)).not.toContain("Outright Approval");
  });

  test("an unregistered source stops before adapter resolution, with its own explicit reason", () => {
    const { sourceRegistry, adapterRegistry } = registries();
    const doc = r11Document({ sourceId: "xx-yy-nowhereville:land-code-9:schedule-z", jurisdictionId: "xx-yy-nowhereville", zoneDesignation: "NW-1" });
    const result = normalizeSourceDocument(doc, sourceRegistry, adapterRegistry);
    expect(result.outcome).toBe("UNSUPPORTED");
    if (result.outcome !== "UNSUPPORTED") return;
    expect(result.reason).toBe("SOURCE_NOT_SUPPORTED");
    expect(result.detail).toMatch(/not registered/i);
  });

  test("an unknown municipality is never treated as Vancouver and gets no default rules", () => {
    const { sourceRegistry, adapterRegistry } = registries();
    const result = normalizeSourceDocument(r11Document({ jurisdictionId: "ca-bc-unknown-municipality" }), sourceRegistry, adapterRegistry);
    expect(result.outcome).toBe("UNSUPPORTED");
    if (result.outcome !== "UNSUPPORTED") return;
    expect("bundle" in result).toBe(false);
  });

  test("CD-1 proves unsupported-zone behaviour without any CD-1 provision being normalized", () => {
    const { sourceRegistry, adapterRegistry } = registries();
    const result = normalizeSourceDocument(r11Document({ zoneDesignation: "CD-1" }), sourceRegistry, adapterRegistry);
    expect(result.outcome).toBe("UNSUPPORTED");
    if (result.outcome !== "UNSUPPORTED") return;
    expect(result.reason).toBe("ZONE_NOT_SUPPORTED");
    // CD-1 is a real, published Vancouver zoning instrument with its own
    // district schedule. What is missing is a normalizer for it, not the
    // zoning — so the gap says the rules are not structured, and never that
    // the parcel's zoning could not be found.
    expect(result.gap.reasonCode).toBe("RULE_NOT_STRUCTURED");
    expect(result.gap.reasonCode).not.toBe("ZONING_NOT_FOUND");
  });

  test("the CD-1 result never implies CD-1 does not exist or that zoning was not found", () => {
    const { sourceRegistry, adapterRegistry } = registries();
    const result = normalizeSourceDocument(r11Document({ zoneDesignation: "CD-1" }), sourceRegistry, adapterRegistry);
    if (result.outcome !== "UNSUPPORTED") throw new Error("expected UNSUPPORTED");
    const text = `${result.detail} ${result.gap.reason} ${result.gap.resolutionHint ?? ""}`;
    expect(text).toMatch(/named by the extract and is not in doubt/i);
    expect(text).toMatch(/absence of structured rules, not an absence of zoning/i);
    expect(text).toMatch(/never whether the zone or document exists/i);
    expect(text).not.toMatch(/could not be found/i);
    expect(text).not.toMatch(/does not exist/i);
    // The hint points at building coverage, not at re-establishing the zoning.
    expect(result.gap.resolutionHint).toMatch(/normalizer|adapter covering this zone/i);
  });

  test("no CD-1 rule content is normalized, invented, or implied anywhere in the result", () => {
    const { sourceRegistry, adapterRegistry } = registries();
    const result = normalizeSourceDocument(r11Document({ zoneDesignation: "CD-1" }), sourceRegistry, adapterRegistry);
    expect(result.outcome).toBe("UNSUPPORTED");
    if (result.outcome !== "UNSUPPORTED") return;
    // An UNSUPPORTED result has no bundle at all: no rules, no values, nothing
    // a caller could mistake for CD-1 coverage.
    expect("bundle" in result).toBe(false);
  });

  test("an unsupported version is refused rather than adapted as though it were known", () => {
    const { sourceRegistry, adapterRegistry } = registries();
    const result = normalizeSourceDocument(r11Document({ versionId: "2019-01-consolidation" }), sourceRegistry, adapterRegistry);
    expect(result.outcome).toBe("UNSUPPORTED");
    if (result.outcome !== "UNSUPPORTED") return;
    expect(result.reason).toBe("VERSION_NOT_SUPPORTED");
    expect(result.gap.reasonCode).toBe("BYLAW_VERSION_UNKNOWN");
    expect(result.gap.resolutionHint).toMatch(/Register and verify this consolidation/i);
  });

  test("calling the adapter directly with an out-of-scope extract also refuses, not just the entry point", () => {
    const result = vancouverR11Adapter.normalize(r11Document({ zoneDesignation: "R1" }), VANCOUVER_R1_1_SOURCE);
    expect(result.outcome).toBe("UNSUPPORTED");
    if (result.outcome !== "UNSUPPORTED") return;
    expect(result.reason).toBe("ZONE_NOT_SUPPORTED");
  });

  test("expected failures are returned, never thrown", () => {
    const { sourceRegistry, adapterRegistry } = registries();
    for (const doc of [r11Document({ zoneDesignation: "CD-1" }), r11Document({ versionId: "nope" }), r11Document({ sourceId: "ca-bc-burnaby:zoning-bylaw-4742" })]) {
      expect(() => normalizeSourceDocument(doc, sourceRegistry, adapterRegistry)).not.toThrow();
    }
  });
});

describe("gap records use the existing Phase 3 taxonomies, not a parallel one", () => {
  test("every GAP finding carries a real E85DataGap with a Phase 3 reason code", () => {
    const bundle = normalizeFacts([
      { ...FACT_FSR, factId: "g1", numericValue: undefined },
      { ...FACT_HEIGHT, factId: "g2", sourceTerm: "Unknown Concept" },
    ]);
    const gapFindings = bundle.findings.filter((f) => f.severity === "GAP");
    expect(gapFindings.length).toBeGreaterThanOrEqual(2);
    for (const f of gapFindings) {
      expect(f.gap).toBeDefined();
      expect(f.gap?.sourcesChecked).toContain(VANCOUVER_R1_1_SOURCE_ID);
      expect(f.gap?.checkedAt).toBe(EXTRACTED_AT);
    }
  });

  test("unresolved source items mirror the findings that explain them", () => {
    const bundle = normalizeFacts([{ ...FACT_FSR, factId: "u1", numericValue: undefined }]);
    expect(bundle.unresolvedSourceItems).toHaveLength(1);
    expect(bundle.unresolvedSourceItems[0]).toMatchObject({ factId: "u1", sourceTerm: "Floor Space Ratio", code: "MISSING_REQUIRED_VALUE" });
  });

  test("a bundle with no usable facts still reports its jurisdiction and source honestly", () => {
    const bundle = normalizeFacts([{ ...FACT_FSR, factId: "none", numericValue: undefined }]);
    expect(bundle.jurisdictionId).toBe(VANCOUVER_JURISDICTION_ID);
    expect(bundle.sourceId).toBe(VANCOUVER_R1_1_SOURCE_ID);
    expect(bundle.rules).toEqual([]);
    expect((bundle.rules as E85DimensionalRule[]).length).toBe(0);
  });
});

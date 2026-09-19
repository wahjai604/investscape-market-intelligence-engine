/**
 * InvestScape™ E85 Phase 5 — source registry tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Offline and self-contained. No network, no filesystem, no PDF.
 */
import {
  createE85SourceRegistry,
  buildE85SourceId,
  isValidE85SourceId,
  findE85SourceVersion,
  E85SourceDefinition,
  adapters,
} from "../../src/zoning-land-use-engine";

const { VANCOUVER_R1_1_SOURCE, VANCOUVER_R1_1_SOURCE_ID, VANCOUVER_R1_1_VERSION_ID, VANCOUVER_JURISDICTION_ID } = adapters.vancouver;

function synthSource(overrides: Partial<E85SourceDefinition> = {}): E85SourceDefinition {
  return {
    sourceId: "xx-yy-zorptown:land-code-1:schedule-a",
    displayName: "Zorptown Land Code — Schedule A",
    publisher: "Zorptown Elder Council",
    jurisdictionId: "xx-yy-zorptown",
    sourceType: "DISTRICT_SCHEDULE",
    document: { bylawOrDocumentId: "1", documentTitle: "Land Code", schedule: "Schedule A" },
    versions: [{ versionId: "2025-01", effectiveDateBasis: "SOURCE_STATED", effectiveFrom: "2025-01-01" }],
    accessStatus: "AVAILABLE",
    licenseStatus: "PUBLIC_REUSE",
    adapterReadiness: "BUILT_VERIFIED",
    supportedRuleFamilies: ["USE"],
    supportedZoneDesignations: ["ZORP-9"],
    knownLimitations: [],
    ...overrides,
  };
}

describe("E85 source registry — registration and exact lookup", () => {
  test("a registered source is retrievable by its exact id", () => {
    const result = createE85SourceRegistry([VANCOUVER_R1_1_SOURCE]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.registry.get(VANCOUVER_R1_1_SOURCE_ID)?.displayName).toBe("City of Vancouver — R1-1 District Schedule");
    expect(result.registry.has(VANCOUVER_R1_1_SOURCE_ID)).toBe(true);
  });

  test("an unknown source id returns undefined — never a nearest match", () => {
    const result = createE85SourceRegistry([VANCOUVER_R1_1_SOURCE]);
    if (!result.ok) throw new Error("registry should build");
    expect(result.registry.get("ca-bc-surrey:zoning-bylaw-12000:district-schedule-r1-1")).toBeUndefined();
    // A near-miss on the SAME jurisdiction must also miss.
    expect(result.registry.get("ca-bc-vancouver:zoning-development-bylaw-3575:district-schedule-r1")).toBeUndefined();
    expect(result.registry.has("nope:nope:nope")).toBe(false);
  });

  test("lookup is deterministic and independent of registration order", () => {
    const a = createE85SourceRegistry([VANCOUVER_R1_1_SOURCE, synthSource()]);
    const b = createE85SourceRegistry([synthSource(), VANCOUVER_R1_1_SOURCE]);
    if (!a.ok || !b.ok) throw new Error("registries should build");
    expect(a.registry.list().map((s) => s.sourceId)).toEqual(b.registry.list().map((s) => s.sourceId));
    expect(a.registry.get(VANCOUVER_R1_1_SOURCE_ID)).toEqual(b.registry.get(VANCOUVER_R1_1_SOURCE_ID));
  });

  test("list() is sorted by sourceId regardless of input order", () => {
    const result = createE85SourceRegistry([synthSource(), VANCOUVER_R1_1_SOURCE]);
    if (!result.ok) throw new Error("registry should build");
    const ids = result.registry.list().map((s) => s.sourceId);
    expect([...ids].sort()).toEqual(ids);
  });

  test("the input array is not mutated", () => {
    const input = [synthSource(), VANCOUVER_R1_1_SOURCE];
    const snapshot = input.map((s) => s.sourceId);
    createE85SourceRegistry(input);
    expect(input.map((s) => s.sourceId)).toEqual(snapshot);
  });
});

describe("E85 source registry — problem detection", () => {
  test("a duplicate sourceId is rejected, not silently de-duplicated", () => {
    const result = createE85SourceRegistry([synthSource(), synthSource({ displayName: "A different record, same id" })]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.map((p) => p.code)).toContain("DUPLICATE_SOURCE_ID");
  });

  test("a filesystem path is rejected as a source id", () => {
    const result = createE85SourceRegistry([synthSource({ sourceId: "C:\\Users\\Eric\\Investscape\\e85-pilot-evidence\\vancouver\\r1-1.pdf" })]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.map((p) => p.code)).toContain("MALFORMED_SOURCE_ID");
  });

  test("a URL is rejected as a source id", () => {
    const result = createE85SourceRegistry([synthSource({ sourceId: "https://vancouver.ca/files/r1-1.pdf" })]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.map((p) => p.code)).toContain("MALFORMED_SOURCE_ID");
  });

  test("a source with no registered versions is rejected", () => {
    const result = createE85SourceRegistry([synthSource({ versions: [] })]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.map((p) => p.code)).toContain("NO_VERSIONS_REGISTERED");
  });

  test("every problem is reported at once, not just the first", () => {
    const result = createE85SourceRegistry([synthSource({ sourceId: "Not A Valid Id", versions: [] })]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.length).toBeGreaterThanOrEqual(2);
  });
});

describe("E85 source identity convention", () => {
  test("buildE85SourceId composes jurisdiction + document + schedule, excluding the version", () => {
    const id = buildE85SourceId({ jurisdictionId: "ca-bc-vancouver", documentSlug: "zoning-development-bylaw-3575", scheduleSlug: "district-schedule-r1-1" });
    expect(id).toBe("ca-bc-vancouver:zoning-development-bylaw-3575:district-schedule-r1-1");
    expect(id).not.toContain("2026");
  });

  test("the schedule segment is optional", () => {
    expect(buildE85SourceId({ jurisdictionId: "ca-bc-vancouver", documentSlug: "parking-bylaw-6059" })).toBe("ca-bc-vancouver:parking-bylaw-6059");
  });

  test("machine-specific or unstable identities are refused", () => {
    expect(() => buildE85SourceId({ jurisdictionId: "C:/Users/Eric", documentSlug: "r1-1.pdf" })).toThrow(/Invalid E85 sourceId/);
    expect(() => buildE85SourceId({ jurisdictionId: "ca-bc-vancouver", documentSlug: "Zoning Bylaw 3575" })).toThrow(/Invalid E85 sourceId/);
    expect(isValidE85SourceId("ca-bc-vancouver")).toBe(false); // a single segment is not a source identity
    expect(isValidE85SourceId(VANCOUVER_R1_1_SOURCE_ID)).toBe(true);
  });

  test("the pilot source id is stable across consolidations by construction", () => {
    expect(VANCOUVER_R1_1_SOURCE_ID).toBe("ca-bc-vancouver:zoning-development-bylaw-3575:district-schedule-r1-1");
    expect(VANCOUVER_R1_1_SOURCE.versions.map((v) => v.versionId)).toEqual([VANCOUVER_R1_1_VERSION_ID]);
  });
});

describe("E85 source registry — scoped queries", () => {
  const built = createE85SourceRegistry([VANCOUVER_R1_1_SOURCE, synthSource()]);
  const registry = built.ok ? built.registry : undefined;

  test("jurisdiction filtering is an exact string match", () => {
    expect(registry?.listForJurisdiction(VANCOUVER_JURISDICTION_ID).map((s) => s.sourceId)).toEqual([VANCOUVER_R1_1_SOURCE_ID]);
    expect(registry?.listForJurisdiction("ca-bc-vancouver-west")).toEqual([]);
  });

  test("zone filtering is exact — R1-1 does not match R1", () => {
    expect(registry?.listForJurisdictionZone(VANCOUVER_JURISDICTION_ID, "R1-1").map((s) => s.sourceId)).toEqual([VANCOUVER_R1_1_SOURCE_ID]);
    expect(registry?.listForJurisdictionZone(VANCOUVER_JURISDICTION_ID, "R1")).toEqual([]);
    expect(registry?.listForJurisdictionZone(VANCOUVER_JURISDICTION_ID, "CD-1")).toEqual([]);
  });

  test("rule-family filtering reflects what the source actually states", () => {
    expect(registry?.listForRuleFamily(VANCOUVER_JURISDICTION_ID, "DENSITY").map((s) => s.sourceId)).toEqual([VANCOUVER_R1_1_SOURCE_ID]);
    // The R1-1 schedule source deliberately does not claim PARKING.
    expect(registry?.listForRuleFamily(VANCOUVER_JURISDICTION_ID, "PARKING")).toEqual([]);
  });

  // PHASE 14.4A.1: the registry's `supportedRuleFamilies` had drifted from the
  // adapter identity's (missing REQUIREMENT), making R1-1 undiscoverable for a
  // family it actually normalizes. Fixed at the source-registry-entry level
  // only — this is discovery/query metadata, never authoritative at decision
  // time (see `E85AdapterIdentity.supportedRuleFamilies`).
  test("rule-family filtering now finds R1-1 for REQUIREMENT, matching its adapter identity", () => {
    expect(registry?.listForRuleFamily(VANCOUVER_JURISDICTION_ID, "REQUIREMENT").map((s) => s.sourceId)).toEqual([VANCOUVER_R1_1_SOURCE_ID]);
  });

  test("findE85SourceVersion is exact — no nearest-consolidation fallback", () => {
    expect(findE85SourceVersion(VANCOUVER_R1_1_SOURCE, VANCOUVER_R1_1_VERSION_ID)?.versionId).toBe(VANCOUVER_R1_1_VERSION_ID);
    expect(findE85SourceVersion(VANCOUVER_R1_1_SOURCE, "2025-01-consolidation")).toBeUndefined();
  });
});

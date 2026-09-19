/**
 * InvestScape™ E85 Phase 5 — adapter resolution tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Proves adapter selection is exact, order-independent, and never falls back
 * from one municipality to another — and, via a synthetic second adapter for
 * an invented place, that the registry architecture is not hard-wired to
 * Vancouver.
 */
import {
  createE85AdapterRegistry,
  createE85SourceRegistry,
  normalizeSourceDocument,
  E85SourceAdapter,
  E85SourceDefinition,
  E85StructuredSourceDocument,
  adapters,
} from "../../src/zoning-land-use-engine";
import { r11Document, EXTRACTED_AT } from "./fixtures/vancouver-r1-1-facts";

const { vancouverR11Adapter, VANCOUVER_R1_1_SOURCE, VANCOUVER_R1_1_SOURCE_ID, VANCOUVER_R1_1_VERSION_ID, VANCOUVER_JURISDICTION_ID } = adapters.vancouver;

/* ------------------------------------------------------------------ *
 * A minimal synthetic adapter for a place that does not exist. It shares
 * nothing with Vancouver but the generic contract, which is the point.
 * ------------------------------------------------------------------ */

const ZORP_SOURCE_ID = "xx-yy-zorptown:land-code-1:schedule-a";
const ZORP_JURISDICTION_ID = "xx-yy-zorptown";
const ZORP_VERSION_ID = "2025-01";

const ZORP_SOURCE: E85SourceDefinition = {
  sourceId: ZORP_SOURCE_ID,
  displayName: "Zorptown Land Code — Schedule A",
  publisher: "Zorptown Elder Council",
  jurisdictionId: ZORP_JURISDICTION_ID,
  sourceType: "DISTRICT_SCHEDULE",
  document: { bylawOrDocumentId: "1", documentTitle: "Land Code", schedule: "Schedule A" },
  versions: [{ versionId: ZORP_VERSION_ID, effectiveDateBasis: "SOURCE_STATED", effectiveFrom: "2025-01-01" }],
  accessStatus: "AVAILABLE",
  licenseStatus: "PUBLIC_REUSE",
  adapterReadiness: "BUILT_VERIFIED",
  adapterId: "xx-yy-zorptown.schedule-a",
  supportedRuleFamilies: ["USE"],
  supportedZoneDesignations: ["ZORP-9"],
  knownLimitations: ["Entirely fictional; exists to prove the registry is not Vancouver-specific."],
};

const zorptownAdapter: E85SourceAdapter = {
  identity: {
    adapterId: "xx-yy-zorptown.schedule-a",
    adapterVersion: "0.1.0",
    jurisdictionId: ZORP_JURISDICTION_ID,
    supportedSourceIds: [ZORP_SOURCE_ID],
    supportedVersionIds: [ZORP_VERSION_ID],
    supportedZoneDesignations: ["ZORP-9"],
    supportedRuleFamilies: ["USE"],
  },
  canHandle: () => ({ supported: true }),
  normalize: (document, source, options) => ({
    outcome: "NORMALIZED",
    bundle: {
      sourceId: source.sourceId,
      sourceVersionId: document.versionId,
      jurisdictionId: document.jurisdictionId,
      zoneDesignation: document.zoneDesignation,
      temporal: { effectiveDateBasis: "SOURCE_STATED", effectiveFrom: "2025-01-01" },
      rules: [
        {
          family: "USE",
          jurisdictionId: document.jurisdictionId,
          zoneDesignation: document.zoneDesignation,
          permissions: [
            {
              value: { useCode: "moon_garden", status: "CONDITIONAL", rawSourceTerminology: "Elder Assent Required", approvalAuthority: "Zorptown Elder Council" },
              provenance: { sourceId: source.sourceId, sourceVersionId: document.versionId, adapterId: "xx-yy-zorptown.schedule-a", adapterVersion: "0.1.0", documentLocator: { section: "9.9" } },
              temporal: { effectiveDateBasis: "SOURCE_STATED", effectiveFrom: "2025-01-01" },
            },
          ],
        },
      ],
      conditionalRules: [],
      supportedRuleFamilies: ["USE"],
      findings: [],
      unresolvedSourceItems: [],
      readiness: {
        sourceId: source.sourceId,
        registered: true,
        structureSupport: "STRUCTURED",
        versionSupport: "REGISTERED",
        zoneScope: "IN_SCOPE",
        temporalApplicability: "APPLIES",
        overall: "READY",
        blockers: [],
        blockerDetails: [],
      },
      qualification: { evidenceQuality: "high", ruleApplicability: "high" },
      provenance: { sourceId: source.sourceId, sourceVersionId: document.versionId, adapterId: "xx-yy-zorptown.schedule-a", adapterVersion: "0.1.0" },
      adapterId: "xx-yy-zorptown.schedule-a",
      adapterVersion: "0.1.0",
      normalizedAt: options?.normalizedAt ?? document.extractedAt,
    },
  }),
};

function zorpDocument(overrides: Partial<E85StructuredSourceDocument> = {}): E85StructuredSourceDocument {
  return {
    sourceId: ZORP_SOURCE_ID,
    jurisdictionId: ZORP_JURISDICTION_ID,
    versionId: ZORP_VERSION_ID,
    zoneDesignation: "ZORP-9",
    facts: [],
    extractedAt: EXTRACTED_AT,
    ...overrides,
  };
}

function bothRegistries(adapterOrder: readonly E85SourceAdapter[] = [vancouverR11Adapter, zorptownAdapter]) {
  const sources = createE85SourceRegistry([VANCOUVER_R1_1_SOURCE, ZORP_SOURCE]);
  const adapterReg = createE85AdapterRegistry(adapterOrder);
  if (!sources.ok || !adapterReg.ok) throw new Error("registries should build");
  return { sourceRegistry: sources.registry, adapterRegistry: adapterReg.registry };
}

const CRITERIA = { jurisdictionId: VANCOUVER_JURISDICTION_ID, sourceId: VANCOUVER_R1_1_SOURCE_ID, versionId: VANCOUVER_R1_1_VERSION_ID, zoneDesignation: "R1-1" };

describe("E85 adapter registry — exact resolution", () => {
  test("exact jurisdiction + source + version + zone resolves the right adapter", () => {
    const { adapterRegistry } = bothRegistries();
    const r = adapterRegistry.resolve(CRITERIA, EXTRACTED_AT);
    expect(r.resolved).toBe(true);
    if (!r.resolved) return;
    expect(r.adapter.identity.adapterId).toBe("ca-bc-vancouver.district-schedule.r1-1");
  });

  test("a different municipality never falls back to Vancouver's adapter", () => {
    const { adapterRegistry } = bothRegistries();
    const r = adapterRegistry.resolve({ ...CRITERIA, jurisdictionId: "ca-bc-surrey", sourceId: "ca-bc-surrey:zoning-bylaw-12000:district-schedule-r1-1" }, EXTRACTED_AT);
    expect(r.resolved).toBe(false);
    if (r.resolved) return;
    expect(r.detail).toMatch(/No fallback to another jurisdiction/i);
    expect(r.gap.reasonCode).toBe("JURISDICTION_UNSUPPORTED");
  });

  test("a wrong source in the right jurisdiction does not resolve", () => {
    const { adapterRegistry } = bothRegistries();
    const r = adapterRegistry.resolve({ ...CRITERIA, sourceId: "ca-bc-vancouver:parking-bylaw-6059" }, EXTRACTED_AT);
    expect(r.resolved).toBe(false);
    if (r.resolved) return;
    expect(r.reason).toBe("SOURCE_NOT_SUPPORTED");
  });

  test("an unsupported version does not resolve — no nearest-consolidation adaptation", () => {
    const { adapterRegistry } = bothRegistries();
    const r = adapterRegistry.resolve({ ...CRITERIA, versionId: "2019-01-consolidation" }, EXTRACTED_AT);
    expect(r.resolved).toBe(false);
    if (r.resolved) return;
    expect(r.reason).toBe("VERSION_NOT_SUPPORTED");
    expect(r.gap.reasonCode).toBe("BYLAW_VERSION_UNKNOWN");
  });

  test("an unsupported zone does not resolve — R1-1's adapter does not widen to R1 or CD-1", () => {
    const { adapterRegistry } = bothRegistries();
    for (const zone of ["R1", "CD-1", "R1-1 "]) {
      const r = adapterRegistry.resolve({ ...CRITERIA, zoneDesignation: zone }, EXTRACTED_AT);
      expect(r.resolved).toBe(false);
      if (r.resolved) continue;
      expect(r.reason).toBe("ZONE_NOT_SUPPORTED");
    }
  });

  test("an empty adapter registry reports NO_ADAPTER_REGISTERED rather than throwing", () => {
    const built = createE85AdapterRegistry([]);
    if (!built.ok) throw new Error("empty registry should build");
    const r = built.registry.resolve(CRITERIA, EXTRACTED_AT);
    expect(r.resolved).toBe(false);
    if (r.resolved) return;
    expect(r.reason).toBe("NO_ADAPTER_REGISTERED");
  });

  test("a duplicate adapterId is rejected at construction", () => {
    const built = createE85AdapterRegistry([vancouverR11Adapter, vancouverR11Adapter]);
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.problems[0].code).toBe("DUPLICATE_ADAPTER_ID");
  });

  test("two adapters claiming the same criteria is refused, not first-wins", () => {
    const clash: E85SourceAdapter = { ...vancouverR11Adapter, identity: { ...vancouverR11Adapter.identity, adapterId: "ca-bc-vancouver.district-schedule.r1-1-alt" } };
    const built = createE85AdapterRegistry([vancouverR11Adapter, clash]);
    if (!built.ok) throw new Error("registry should build with distinct ids");
    const r = built.registry.resolve(CRITERIA, EXTRACTED_AT);
    expect(r.resolved).toBe(false);
    if (r.resolved) return;
    expect(r.reason).toBe("AMBIGUOUS_ADAPTER_MATCH");
  });
});

describe("E85 adapter registry — order independence", () => {
  test("registration order changes neither the resolved adapter nor the listing order", () => {
    const forward = bothRegistries([vancouverR11Adapter, zorptownAdapter]);
    const reverse = bothRegistries([zorptownAdapter, vancouverR11Adapter]);
    const a = forward.adapterRegistry.resolve(CRITERIA, EXTRACTED_AT);
    const b = reverse.adapterRegistry.resolve(CRITERIA, EXTRACTED_AT);
    expect(a.resolved && b.resolved).toBe(true);
    if (!a.resolved || !b.resolved) return;
    expect(a.adapter.identity.adapterId).toBe(b.adapter.identity.adapterId);
    expect(forward.adapterRegistry.list().map((x) => x.identity.adapterId)).toEqual(reverse.adapterRegistry.list().map((x) => x.identity.adapterId));
  });

  test("an ambiguous match is refused regardless of order", () => {
    const clash: E85SourceAdapter = { ...vancouverR11Adapter, identity: { ...vancouverR11Adapter.identity, adapterId: "zzz-last-alphabetically" } };
    for (const order of [[vancouverR11Adapter, clash], [clash, vancouverR11Adapter]]) {
      const built = createE85AdapterRegistry(order);
      if (!built.ok) throw new Error("should build");
      const r = built.registry.resolve(CRITERIA, EXTRACTED_AT);
      expect(r.resolved).toBe(false);
    }
  });
});

describe("E85 adapter architecture is not hard-wired to Vancouver (genericity proof)", () => {
  test("a synthetic adapter for an invented jurisdiction normalizes through the same generic entry point", () => {
    const { sourceRegistry, adapterRegistry } = bothRegistries();
    const result = normalizeSourceDocument(zorpDocument(), sourceRegistry, adapterRegistry);
    expect(result.outcome).toBe("NORMALIZED");
    if (result.outcome !== "NORMALIZED") return;
    expect(result.bundle.adapterId).toBe("xx-yy-zorptown.schedule-a");
    expect(result.bundle.jurisdictionId).toBe(ZORP_JURISDICTION_ID);
    expect(result.bundle.rules).toHaveLength(1);
  });

  test("the two adapters coexist without either capturing the other's extract", () => {
    const { sourceRegistry, adapterRegistry } = bothRegistries();
    const zorp = normalizeSourceDocument(zorpDocument(), sourceRegistry, adapterRegistry);
    const van = normalizeSourceDocument(r11Document(), sourceRegistry, adapterRegistry);
    expect(zorp.outcome === "NORMALIZED" && zorp.bundle.adapterId).toBe("xx-yy-zorptown.schedule-a");
    expect(van.outcome === "NORMALIZED" && van.bundle.adapterId).toBe("ca-bc-vancouver.district-schedule.r1-1");
  });
});

describe("normalizeSourceDocument — registry-level failures are typed results", () => {
  test("an unregistered source is an explicit unsupported result, not an exception", () => {
    const { sourceRegistry, adapterRegistry } = bothRegistries();
    const result = normalizeSourceDocument(r11Document({ sourceId: "ca-bc-burnaby:zoning-bylaw-4742:district-schedule-r1" }), sourceRegistry, adapterRegistry);
    expect(result.outcome).toBe("UNSUPPORTED");
    if (result.outcome !== "UNSUPPORTED") return;
    expect(result.reason).toBe("SOURCE_NOT_SUPPORTED");
    expect(result.gap.checkedAt).toBe(EXTRACTED_AT);
  });

  test("an extract whose jurisdiction contradicts its registered source is reported, not reconciled", () => {
    const { sourceRegistry, adapterRegistry } = bothRegistries();
    const result = normalizeSourceDocument(r11Document({ jurisdictionId: "ca-bc-surrey" }), sourceRegistry, adapterRegistry);
    expect(result.outcome).toBe("UNSUPPORTED");
    if (result.outcome !== "UNSUPPORTED") return;
    expect(result.reason).toBe("JURISDICTION_MISMATCH");
    expect(result.detail).toMatch(/contradiction is reported rather than resolved/i);
  });
});

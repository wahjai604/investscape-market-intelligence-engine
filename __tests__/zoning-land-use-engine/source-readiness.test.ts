/**
 * InvestScape™ E85 Phase 5 — multi-axis source readiness tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * The governing property: "the source exists" must never imply "the source is
 * machine ready". Each test below holds every axis clear except one and proves
 * that single axis is enough to withhold READY, with the specific blocker
 * named rather than collapsed into a boolean.
 */
import { assessE85SourceReadiness, computeE85AnalyticalReadiness, E85SourceDefinition, adapters } from "../../src/zoning-land-use-engine";

const { VANCOUVER_R1_1_SOURCE, VANCOUVER_R1_1_SOURCE_ID, VANCOUVER_R1_1_VERSION_ID, VANCOUVER_R1_1_ZONE } = adapters.vancouver;

/**
 * The base for these tests is a HYPOTHETICAL fully-cleared source, not the real
 * pilot source. The real Vancouver R1-1 entry carries `LICENSE_UNKNOWN` because
 * its document states no licence terms at all — correct for that source, but
 * useless as a base for "hold every axis clear except one" tests, which need a
 * genuinely all-clear starting point. PUBLIC_REUSE is asserted here as a test
 * fixture only; it is not a claim about Vancouver's actual rights.
 */
function source(overrides: Partial<E85SourceDefinition> = {}): E85SourceDefinition {
  return { ...VANCOUVER_R1_1_SOURCE, licenseStatus: "PUBLIC_REUSE", ...overrides };
}

const READY_INPUT = {
  sourceId: VANCOUVER_R1_1_SOURCE_ID,
  versionId: VANCOUVER_R1_1_VERSION_ID,
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  structureSupport: "STRUCTURED" as const,
  temporalApplicability: "APPLIES" as const,
};

describe("E85 source readiness — the fully ready case", () => {
  test("authoritative + accessible + licensed + adapted + structured + registered version + in-scope zone + in force = READY", () => {
    const a = assessE85SourceReadiness({ source: source(), ...READY_INPUT });
    expect(a.overall).toBe("READY");
    expect(a.blockers).toEqual([]);
    expect(a.registered).toBe(true);
    expect(a.publisher).toBe("City of Vancouver");
    expect(a.analyticalReadiness).toBe("READY");
    expect(a.structureSupport).toBe("STRUCTURED");
    expect(a.versionSupport).toBe("REGISTERED");
    expect(a.zoneScope).toBe("IN_SCOPE");
  });
});

describe("E85 source readiness — one blocked axis at a time", () => {
  test("authoritative but structurally unsupported is NOT ready", () => {
    const a = assessE85SourceReadiness({ source: source(), ...READY_INPUT, structureSupport: "UNSUPPORTED_STRUCTURE" });
    expect(a.overall).toBe("BLOCKED");
    expect(a.blockers).toContain("STRUCTURE");
    // The document is still perfectly accessible and licensed — those axes stay clear.
    expect(a.blockers).not.toContain("ACCESS");
    expect(a.blockers).not.toContain("LICENSE");
  });

  test("available source but the needed section was not structured is NOT ready", () => {
    const a = assessE85SourceReadiness({ source: source(), ...READY_INPUT, structureSupport: "SECTION_NOT_STRUCTURED" });
    expect(a.overall).toBe("BLOCKED");
    expect(a.blockers).toContain("STRUCTURE");
    expect(a.blockerDetails.join(" ")).toMatch(/section .* was not structured/i);
  });

  test("available source but unregistered version is NOT ready", () => {
    const a = assessE85SourceReadiness({ source: source(), ...READY_INPUT, versionId: "2019-01-consolidation" });
    expect(a.overall).toBe("BLOCKED");
    expect(a.versionSupport).toBe("UNREGISTERED_VERSION");
    expect(a.blockers).toContain("VERSION");
  });

  test("no version stated at all is NOT ready", () => {
    const a = assessE85SourceReadiness({ source: source(), ...READY_INPUT, versionId: undefined });
    expect(a.versionSupport).toBe("VERSION_UNKNOWN");
    expect(a.blockers).toContain("VERSION");
  });

  test("licensing/redistribution limitation blocks readiness", () => {
    const a = assessE85SourceReadiness({ source: source({ licenseStatus: "REDISTRIBUTION_RESTRICTED" }), ...READY_INPUT });
    expect(a.overall).toBe("BLOCKED");
    expect(a.blockers).toContain("LICENSE");
  });

  test("adapter unavailable blocks readiness even when everything else is perfect", () => {
    const a = assessE85SourceReadiness({ source: source({ adapterReadiness: "NOT_BUILT" }), ...READY_INPUT });
    expect(a.overall).toBe("BLOCKED");
    expect(a.blockers).toContain("ADAPTER");
    expect(a.analyticalReadiness).toBe("BLOCKED_BY_ADAPTER");
  });

  test("access not verified blocks readiness", () => {
    const a = assessE85SourceReadiness({ source: source({ accessStatus: "ACCESS_NOT_VERIFIED" }), ...READY_INPUT });
    expect(a.blockers).toContain("ACCESS");
    expect(a.analyticalReadiness).toBe("BLOCKED_BY_ACCESS");
  });

  test("a zone the source does not cover blocks readiness", () => {
    const a = assessE85SourceReadiness({ source: source(), ...READY_INPUT, zoneDesignation: "CD-1" });
    expect(a.zoneScope).toBe("OUT_OF_SCOPE");
    expect(a.blockers).toContain("ZONE_SCOPE");
  });

  test("a source in force only from a later date is temporally blocked", () => {
    const a = assessE85SourceReadiness({ source: source(), ...READY_INPUT, temporalApplicability: "NOT_YET_EFFECTIVE" });
    expect(a.blockers).toContain("TEMPORAL");
  });

  test("an unregistered source reports NOT_REGISTERED and asserts nothing else", () => {
    const a = assessE85SourceReadiness({ source: undefined, sourceId: "ca-bc-surrey:zoning-bylaw-12000" });
    expect(a.registered).toBe(false);
    expect(a.overall).toBe("BLOCKED");
    expect(a.blockers).toEqual(["NOT_REGISTERED"]);
    expect(a.accessStatus).toBeUndefined();
    expect(a.licenseStatus).toBeUndefined();
    expect(a.analyticalReadiness).toBeUndefined();
  });
});

describe("E85 source readiness — axes are independent, never averaged or compressed", () => {
  test("two simultaneous blockers are both reported, not reduced to one", () => {
    const a = assessE85SourceReadiness({ source: source({ licenseStatus: "LICENSE_UNKNOWN", adapterReadiness: "PLANNED" }), ...READY_INPUT });
    expect(a.blockers).toEqual(expect.arrayContaining(["LICENSE", "ADAPTER"]));
    expect(a.blockerDetails.length).toBe(a.blockers.length);
  });

  test("overall readiness is floor-like: any single blocker withholds READY", () => {
    const oneBlocked = assessE85SourceReadiness({ source: source(), ...READY_INPUT, structureSupport: "UNDETERMINED" });
    expect(oneBlocked.blockers.length).toBe(1);
    expect(oneBlocked.overall).toBe("BLOCKED");
  });

  test("the Phase 3 three-axis derivation is preserved unchanged and recomputed, not stored", () => {
    const s = source({ accessStatus: "AVAILABLE", licenseStatus: "PUBLIC_REUSE", adapterReadiness: "BUILT_VERIFIED" });
    expect(computeE85AnalyticalReadiness(s)).toBe("READY");
    expect(assessE85SourceReadiness({ source: s, ...READY_INPUT }).analyticalReadiness).toBe(computeE85AnalyticalReadiness(s));
  });

  test("assessment is pure — same input, same output, and the source is not mutated", () => {
    const s = source();
    const before = JSON.stringify(s);
    const a1 = assessE85SourceReadiness({ source: s, ...READY_INPUT });
    const a2 = assessE85SourceReadiness({ source: s, ...READY_INPUT });
    expect(a1).toEqual(a2);
    expect(JSON.stringify(s)).toBe(before);
  });
});

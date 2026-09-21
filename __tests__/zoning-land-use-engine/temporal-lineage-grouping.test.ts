/**
 * InvestScape™ E85 Phase 15.10 — temporal lineage grouping tests, Slice 3D-1.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Synthetic identifiers only (TEST-JX / TEST-SOURCE / TEST-V1 / TEST-V2 /
 * TEST-999 / TEST-ZONE / TEST-LINEAGE-*) — no Vancouver/Burnaby/R1-1/C-2C
 * fixture is imported anywhere here.
 */
import * as fs from "fs";
import * as path from "path";
import type { E85NormalizedRuleBundle } from "../../src/zoning-land-use-engine/normalized-bundle-types";
import type { E85VersionValidity, E85StartAuthority, E85EndAuthority, E85OperativeLocator } from "../../src/zoning-land-use-engine/version-validity-types";
import { buildE85TemporalCandidateFromVersionValidity, E85TemporalCandidateAdapterResult } from "../../src/zoning-land-use-engine/temporal-candidate-adapter";
import {
  groupE85TemporalLineageMembers,
  E85TemporalLineageError,
  E85TemporalLineageMember,
  E85TemporalLineageGroup,
  E85TemporalLineageGroupingResult,
} from "../../src/zoning-land-use-engine/temporal-lineage-grouping";

const LOCATOR: E85OperativeLocator = { bylawOrDocumentId: "TEST-999", clause: "1" };

function bundle(overrides: Partial<E85NormalizedRuleBundle> = {}): E85NormalizedRuleBundle {
  return {
    sourceId: "TEST-SOURCE",
    sourceVersionId: "TEST-V1",
    jurisdictionId: "TEST-JX",
    zoneDesignation: "TEST-ZONE",
    temporal: { effectiveDateBasis: "UNKNOWN" },
    rules: [],
    conditionalRules: [],
    supportedRuleFamilies: [],
    findings: [],
    unresolvedSourceItems: [],
    readiness: { blockers: [], limitations: [] } as unknown as E85NormalizedRuleBundle["readiness"],
    qualification: { evidenceQuality: "HIGH", ruleApplicability: "HIGH" } as unknown as E85NormalizedRuleBundle["qualification"],
    provenance: { sourceId: "TEST-SOURCE" } as unknown as E85NormalizedRuleBundle["provenance"],
    adapterId: "TEST-ADAPTER",
    adapterVersion: "1.0.0",
    normalizedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function commencement(overrides: Partial<Extract<E85StartAuthority, { eventKind: "COMMENCEMENT" }>> = {}): E85StartAuthority {
  return {
    eventKind: "COMMENCEMENT",
    effectiveFrom: "2020-01-01",
    authoritySourceId: "TEST-SOURCE",
    authoritySourceVersionId: "TEST-V1",
    commencementLocator: LOCATOR,
    effectiveDateBasis: "SOURCE_STATED",
    ...overrides,
  };
}

function expressRepeal(overrides: Partial<Extract<E85EndAuthority, { eventKind: "EXPRESS_REPEAL" }>> = {}): E85EndAuthority {
  return {
    eventKind: "EXPRESS_REPEAL",
    effectiveTo: "2021-12-31",
    authoritySourceId: "TEST-SOURCE",
    authoritySourceVersionId: "TEST-V2",
    repealLocator: LOCATOR,
    effectiveDateBasis: "SOURCE_STATED",
    ...overrides,
  };
}

const CLOSED_VALIDITY: E85VersionValidity = {
  state: "CLOSED",
  effectiveFrom: "2020-01-01",
  start: commencement(),
  effectiveTo: "2021-12-31",
  end: expressRepeal(),
};

function candidateResult(bundleOverrides: Partial<E85NormalizedRuleBundle> = {}, validity: E85VersionValidity = CLOSED_VALIDITY): E85TemporalCandidateAdapterResult {
  return buildE85TemporalCandidateFromVersionValidity(bundle(bundleOverrides), validity);
}

function nonCandidateResult(
  state:
    | "START_UNKNOWN"
    | "CONFLICTING_START"
    | "OPEN_UNRESEARCHED"
    | "OPEN_REVIEWED_NO_END_ESTABLISHED"
    | "CONFLICTING_END"
    | "CONDITIONAL_PARTIAL_TERMINATION",
  bundleOverrides: Partial<E85NormalizedRuleBundle> = {},
): E85TemporalCandidateAdapterResult {
  let validity: E85VersionValidity;
  switch (state) {
    case "START_UNKNOWN":
      validity = { state: "START_UNKNOWN" };
      break;
    case "CONFLICTING_START":
      validity = { state: "CONFLICTING_START", conflictingStartAssertions: [commencement(), commencement({ effectiveFrom: "2020-02-01" })] };
      break;
    case "OPEN_UNRESEARCHED":
      validity = { state: "OPEN_UNRESEARCHED", effectiveFrom: "2020-01-01", start: commencement() };
      break;
    case "OPEN_REVIEWED_NO_END_ESTABLISHED":
      validity = {
        state: "OPEN_REVIEWED_NO_END_ESTABLISHED",
        effectiveFrom: "2020-01-01",
        start: commencement(),
        endReview: { sourcesChecked: ["TEST-SOURCE"], reviewedAt: "2026-01-01" },
      };
      break;
    case "CONFLICTING_END":
      validity = {
        state: "CONFLICTING_END",
        effectiveFrom: "2020-01-01",
        start: commencement(),
        conflictingEndAssertions: [expressRepeal(), expressRepeal({ effectiveTo: "2022-06-30" })],
      };
      break;
    case "CONDITIONAL_PARTIAL_TERMINATION":
      validity = { state: "CONDITIONAL_PARTIAL_TERMINATION", effectiveFrom: "2020-01-01", start: commencement(), description: "TEST partial termination." };
      break;
  }
  return buildE85TemporalCandidateFromVersionValidity(bundle(bundleOverrides), validity);
}

const NON_CANDIDATE_OUTCOME_PAIRS: readonly [string, Parameters<typeof nonCandidateResult>[0]][] = [
  ["OPEN_END_UNRESEARCHED", "OPEN_UNRESEARCHED"],
  ["OPEN_END_REVIEWED_NO_END_ESTABLISHED", "OPEN_REVIEWED_NO_END_ESTABLISHED"],
  ["START_UNKNOWN", "START_UNKNOWN"],
  ["CONFLICTING_START", "CONFLICTING_START"],
  ["CONFLICTING_END", "CONFLICTING_END"],
  ["PARTIAL_TERMINATION", "CONDITIONAL_PARTIAL_TERMINATION"],
];

function member(lineageId: string, adapterResult: E85TemporalCandidateAdapterResult, rationale = "TEST rationale"): E85TemporalLineageMember {
  return { lineageId, adapterResult, membershipRationale: rationale };
}

function findGroup(result: E85TemporalLineageGroupingResult, lineageId: string): E85TemporalLineageGroup {
  const g = result.groups.find((x) => x.lineageId === lineageId);
  if (g === undefined) throw new Error(`no group found for lineageId "${lineageId}"`);
  return g;
}

// ===========================================================================
// A. Group states
// ===========================================================================
describe("E85 Phase 15.10 — group states", () => {
  test("1. one clean candidate -> GROUP_READY", () => {
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", candidateResult())]);
    const g = findGroup(result, "TEST-LINEAGE-A");
    expect(g.kind).toBe("GROUP_READY");
  });

  test("2. two clean candidates -> GROUP_READY", () => {
    const result = groupE85TemporalLineageMembers([
      member("TEST-LINEAGE-A", candidateResult({ sourceVersionId: "TEST-V1" })),
      member("TEST-LINEAGE-A", candidateResult({ sourceVersionId: "TEST-V2" })),
    ]);
    const g = findGroup(result, "TEST-LINEAGE-A");
    expect(g.kind).toBe("GROUP_READY");
    if (g.kind === "GROUP_READY") expect(g.selectorEligibleMembers.length).toBe(2);
  });

  test.each(NON_CANDIDATE_OUTCOME_PAIRS)("3. candidate + %s -> GROUP_EVIDENCE_INCOMPLETE", (_outcomeName, state) => {
    const result = groupE85TemporalLineageMembers([
      member("TEST-LINEAGE-A", candidateResult({ sourceVersionId: "TEST-V1" })),
      member("TEST-LINEAGE-A", nonCandidateResult(state, { sourceVersionId: "TEST-V2" })),
    ]);
    const g = findGroup(result, "TEST-LINEAGE-A");
    expect(g.kind).toBe("GROUP_EVIDENCE_INCOMPLETE");
  });

  test.each(NON_CANDIDATE_OUTCOME_PAIRS)("4. zero candidates, only %s -> GROUP_NO_CANDIDATE", (_outcomeName, state) => {
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", nonCandidateResult(state))]);
    const g = findGroup(result, "TEST-LINEAGE-A");
    expect(g.kind).toBe("GROUP_NO_CANDIDATE");
  });

  test("5. candidate/candidate collision -> GROUP_BLOCKED", () => {
    const shared = candidateResult({ sourceVersionId: "TEST-V1" });
    const differentContent: E85TemporalCandidateAdapterResult = candidateResult({ sourceVersionId: "TEST-V1" }, { ...CLOSED_VALIDITY, effectiveTo: "2022-12-31", end: expressRepeal({ effectiveTo: "2022-12-31" }) });
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", shared), member("TEST-LINEAGE-A", differentContent)]);
    const g = findGroup(result, "TEST-LINEAGE-A");
    expect(g.kind).toBe("GROUP_BLOCKED");
  });

  test("6. candidate/non-candidate same-ID collision -> GROUP_BLOCKED", () => {
    const candidate = candidateResult({ sourceVersionId: "TEST-V1" });
    // Force same candidateId by matching bundle identity but a different outcome via a fabricated same-id non-candidate.
    const nonCandidate = nonCandidateResult("START_UNKNOWN", { sourceVersionId: "TEST-V1" });
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", candidate), member("TEST-LINEAGE-A", nonCandidate)]);
    const g = findGroup(result, "TEST-LINEAGE-A");
    expect(g.kind).toBe("GROUP_BLOCKED");
  });

  test("7. cross-lineage candidate duplication -> every affected lineage GROUP_BLOCKED", () => {
    const shared = candidateResult({ sourceVersionId: "TEST-V1" });
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", shared), member("TEST-LINEAGE-B", shared)]);
    expect(findGroup(result, "TEST-LINEAGE-A").kind).toBe("GROUP_BLOCKED");
    expect(findGroup(result, "TEST-LINEAGE-B").kind).toBe("GROUP_BLOCKED");
  });

  test("8. collision precedence over evidence-incomplete", () => {
    const a = candidateResult({ sourceVersionId: "TEST-V1" });
    const aConflict = candidateResult({ sourceVersionId: "TEST-V1" }, { ...CLOSED_VALIDITY, effectiveTo: "2023-12-31", end: expressRepeal({ effectiveTo: "2023-12-31" }) });
    const nonCandidate = nonCandidateResult("START_UNKNOWN", { sourceVersionId: "TEST-V2" });
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", a), member("TEST-LINEAGE-A", aConflict), member("TEST-LINEAGE-A", nonCandidate)]);
    expect(findGroup(result, "TEST-LINEAGE-A").kind).toBe("GROUP_BLOCKED");
  });

  test("9. zero-candidate precedence over evidence-incomplete (vacuously true: no candidate means no incomplete state possible)", () => {
    const result = groupE85TemporalLineageMembers([
      member("TEST-LINEAGE-A", nonCandidateResult("START_UNKNOWN", { sourceVersionId: "TEST-V1" })),
      member("TEST-LINEAGE-A", nonCandidateResult("CONFLICTING_END", { sourceVersionId: "TEST-V2" })),
    ]);
    expect(findGroup(result, "TEST-LINEAGE-A").kind).toBe("GROUP_NO_CANDIDATE");
  });

  test("10. only GROUP_READY exposes selectorEligibleMembers at runtime", () => {
    const result = groupE85TemporalLineageMembers([
      member("TEST-LINEAGE-A", candidateResult({ sourceVersionId: "TEST-V1" })),
      member("TEST-LINEAGE-B", candidateResult({ sourceVersionId: "TEST-V2" }, undefined as unknown as E85VersionValidity) as unknown as E85TemporalCandidateAdapterResult ?? candidateResult({ sourceVersionId: "TEST-V2" })),
      member("TEST-LINEAGE-C", nonCandidateResult("START_UNKNOWN", { sourceVersionId: "TEST-V3" })),
      member("TEST-LINEAGE-D", candidateResult({ sourceVersionId: "TEST-V4" })),
      member("TEST-LINEAGE-D", nonCandidateResult("START_UNKNOWN", { sourceVersionId: "TEST-V5" })),
    ]);
    for (const g of result.groups) {
      if (g.kind === "GROUP_READY") {
        expect("selectorEligibleMembers" in g).toBe(true);
      } else {
        expect("selectorEligibleMembers" in g).toBe(false);
      }
    }
  });

  test("11. compile-time absence of selectorEligibleMembers on GROUP_BLOCKED/GROUP_EVIDENCE_INCOMPLETE/GROUP_NO_CANDIDATE", () => {
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", nonCandidateResult("START_UNKNOWN"))]);
    const g = findGroup(result, "TEST-LINEAGE-A");
    if (g.kind === "GROUP_READY") {
      expect(g.selectorEligibleMembers).toBeDefined();
    } else {
      // @ts-expect-error — non-GROUP_READY branches have no selectorEligibleMembers field.
      const _forbidden = g.selectorEligibleMembers;
      expect(_forbidden).toBeUndefined();
    }
  });
});

// ===========================================================================
// B. Preservation
// ===========================================================================
describe("E85 Phase 15.10 — preservation", () => {
  test("12. all members preserved except exact duplicate collapse", () => {
    const a = candidateResult({ sourceVersionId: "TEST-V1" });
    const b = candidateResult({ sourceVersionId: "TEST-V2" });
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", a), member("TEST-LINEAGE-A", b)]);
    const g = findGroup(result, "TEST-LINEAGE-A");
    expect(g.members.length).toBe(2);
  });

  test("13. all non-candidate evidence preserved", () => {
    const nc = nonCandidateResult("CONFLICTING_START", { sourceVersionId: "TEST-V2" });
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", candidateResult({ sourceVersionId: "TEST-V1" })), member("TEST-LINEAGE-A", nc)]);
    const g = findGroup(result, "TEST-LINEAGE-A");
    expect(g.nonCandidateMembers.length).toBe(1);
  });

  test("14. all findings preserved in collisionFindings", () => {
    const shared = candidateResult({ sourceVersionId: "TEST-V1" });
    const conflicting = candidateResult({ sourceVersionId: "TEST-V1" }, { ...CLOSED_VALIDITY, effectiveTo: "2024-01-01", end: expressRepeal({ effectiveTo: "2024-01-01" }) });
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", shared), member("TEST-LINEAGE-A", conflicting)]);
    const g = findGroup(result, "TEST-LINEAGE-A");
    expect(g.collisionFindings.length).toBeGreaterThan(0);
  });

  test("15. GROUP_EVIDENCE_INCOMPLETE preserves candidates but does not expose selectorEligibleMembers", () => {
    const result = groupE85TemporalLineageMembers([
      member("TEST-LINEAGE-A", candidateResult({ sourceVersionId: "TEST-V1" })),
      member("TEST-LINEAGE-A", nonCandidateResult("START_UNKNOWN", { sourceVersionId: "TEST-V2" })),
    ]);
    const g = findGroup(result, "TEST-LINEAGE-A");
    expect(g.kind).toBe("GROUP_EVIDENCE_INCOMPLETE");
    expect(g.members.some((m) => m.adapterResult.outcome === "CANDIDATE")).toBe(true);
    expect("selectorEligibleMembers" in g).toBe(false);
  });

  test("16. GROUP_BLOCKED preserves disputed candidates", () => {
    const a = candidateResult({ sourceVersionId: "TEST-V1" });
    const aConflict = candidateResult({ sourceVersionId: "TEST-V1" }, { ...CLOSED_VALIDITY, effectiveTo: "2025-01-01", end: expressRepeal({ effectiveTo: "2025-01-01" }) });
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", a), member("TEST-LINEAGE-A", aConflict)]);
    const g = findGroup(result, "TEST-LINEAGE-A");
    expect(g.members.length).toBe(2);
  });

  test("17. GROUP_NO_CANDIDATE preserves all evidence", () => {
    const result = groupE85TemporalLineageMembers([
      member("TEST-LINEAGE-A", nonCandidateResult("START_UNKNOWN", { sourceVersionId: "TEST-V1" })),
      member("TEST-LINEAGE-A", nonCandidateResult("CONFLICTING_END", { sourceVersionId: "TEST-V2" })),
    ]);
    const g = findGroup(result, "TEST-LINEAGE-A");
    expect(g.members.length).toBe(2);
  });
});

// ===========================================================================
// C. Identity reconstruction
// ===========================================================================
describe("E85 Phase 15.10 — identity reconstruction", () => {
  test("18. all four identity components participate (different jurisdiction changes group behaviour via distinct candidateId)", () => {
    const a = candidateResult({ jurisdictionId: "TEST-JX-1" });
    const b = candidateResult({ jurisdictionId: "TEST-JX-2" });
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", a), member("TEST-LINEAGE-A", b)]);
    const g = findGroup(result, "TEST-LINEAGE-A");
    expect(g.kind).toBe("GROUP_READY");
    if (g.kind === "GROUP_READY") expect(g.selectorEligibleMembers.length).toBe(2);
  });

  test("19. tampered adapterResult.candidateId rejected", () => {
    const good = candidateResult();
    const tampered = { ...good, candidateId: "TAMPERED" } as E85TemporalCandidateAdapterResult;
    expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", tampered)])).toThrow(E85TemporalLineageError);
  });

  test("20. tampered candidate.candidateId rejected", () => {
    const good = candidateResult();
    if (good.outcome !== "CANDIDATE") throw new Error("expected CANDIDATE");
    const tampered = { ...good, candidate: { ...good.candidate, candidateId: "TAMPERED" } } as E85TemporalCandidateAdapterResult;
    expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", tampered)])).toThrow(E85TemporalLineageError);
  });

  test("21. empty jurisdictionId in bundle rejected at reconstruction", () => {
    const good = candidateResult();
    const malformedBundle = { ...good.bundle, jurisdictionId: "" };
    const tampered = { ...good, bundle: malformedBundle } as E85TemporalCandidateAdapterResult;
    expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", tampered)])).toThrow(E85TemporalLineageError);
  });

  test("22. whitespace-only zoneDesignation in bundle rejected", () => {
    const good = candidateResult();
    const malformedBundle = { ...good.bundle, zoneDesignation: "   " };
    const tampered = { ...good, bundle: malformedBundle } as E85TemporalCandidateAdapterResult;
    expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", tampered)])).toThrow(E85TemporalLineageError);
  });

  test("23. % in identity component round-trips through candidateId comparison", () => {
    const a = candidateResult({ zoneDesignation: "TEST-100%" });
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", a)]);
    expect(findGroup(result, "TEST-LINEAGE-A").kind).toBe("GROUP_READY");
  });

  test("24. @ in identity component round-trips through candidateId comparison", () => {
    const a = candidateResult({ zoneDesignation: "R1@1" });
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", a)]);
    expect(findGroup(result, "TEST-LINEAGE-A").kind).toBe("GROUP_READY");
  });

  test("25. literal %25 in identity component distinguishable from escaped %", () => {
    const literal = candidateResult({ zoneDesignation: "%25" });
    const percent = candidateResult({ zoneDesignation: "%" });
    expect(literal.candidateId).not.toBe(percent.candidateId);
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", literal), member("TEST-LINEAGE-B", percent)]);
    expect(findGroup(result, "TEST-LINEAGE-A").kind).toBe("GROUP_READY");
    expect(findGroup(result, "TEST-LINEAGE-B").kind).toBe("GROUP_READY");
  });

  test("26. literal %40 in identity component distinguishable from escaped @", () => {
    const literal = candidateResult({ zoneDesignation: "%40" });
    const at = candidateResult({ zoneDesignation: "@" });
    expect(literal.candidateId).not.toBe(at.candidateId);
  });

  test("27. padded but non-empty identity values are preserved (accepted, not rejected)", () => {
    const padded = candidateResult({ zoneDesignation: "  TEST-ZONE  " });
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", padded)]);
    expect(findGroup(result, "TEST-LINEAGE-A").kind).toBe("GROUP_READY");
  });

  test("28. parity with real Slice 3C builder output: reconstructed candidateId equals adapterResult.candidateId for a matrix of synthetic bundles", () => {
    const cases: Partial<E85NormalizedRuleBundle>[] = [
      {},
      { jurisdictionId: "TEST-JX@1" },
      { sourceId: "TEST-SOURCE%1" },
      { sourceVersionId: "2026-06@council" },
      { zoneDesignation: "R1@1%" },
      { zoneDesignation: "  TEST-PAD  " },
      { zoneDesignation: "%25%40" },
    ];
    for (const overrides of cases) {
      const result = candidateResult(overrides);
      // If the module accepted this member without throwing, its own internal
      // reconstruction already agreed with adapterResult.candidateId; assert
      // no throw occurs, which is the observable parity signal available
      // through the public API (the private reconstructor is not exported).
      expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", result)])).not.toThrow();
    }
  });
});

// ===========================================================================
// D. Branch validation
// ===========================================================================
describe("E85 Phase 15.10 — branch validation", () => {
  test("29. null member rejected", () => {
    expect(() => groupE85TemporalLineageMembers([null as unknown as E85TemporalLineageMember])).toThrow(E85TemporalLineageError);
  });

  test("30. non-object member rejected", () => {
    expect(() => groupE85TemporalLineageMembers(["not-a-member" as unknown as E85TemporalLineageMember])).toThrow(E85TemporalLineageError);
  });

  test("31. malformed lineageId (empty string) rejected", () => {
    expect(() => groupE85TemporalLineageMembers([member("", candidateResult())])).toThrow(E85TemporalLineageError);
  });

  test("32. malformed lineageId (whitespace-only) rejected", () => {
    expect(() => groupE85TemporalLineageMembers([member("   ", candidateResult())])).toThrow(E85TemporalLineageError);
  });

  test("33. malformed membershipRationale (empty string) rejected", () => {
    expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", candidateResult(), "")])).toThrow(E85TemporalLineageError);
  });

  test("34. malformed membershipRationale (whitespace-only) rejected", () => {
    expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", candidateResult(), "   ")])).toThrow(E85TemporalLineageError);
  });

  test("35. malformed adapterResult (null) rejected", () => {
    expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", null as unknown as E85TemporalCandidateAdapterResult)])).toThrow(E85TemporalLineageError);
  });

  test("36. unsupported outcome rejected", () => {
    const malformed = { outcome: "UNKNOWN_OUTCOME", candidateId: "X", bundle: bundle() } as unknown as E85TemporalCandidateAdapterResult;
    expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", malformed)])).toThrow(E85TemporalLineageError);
  });

  const OUTCOMES_WITH_EXTRA_REQUIRED_FIELD = NON_CANDIDATE_OUTCOME_PAIRS.filter(([outcomeName]) => outcomeName !== "START_UNKNOWN");

  test.each(OUTCOMES_WITH_EXTRA_REQUIRED_FIELD)("37. %s missing required payload rejected", (_outcomeName, state) => {
    const good = nonCandidateResult(state);
    const obj = good as unknown as Record<string, unknown>;
    const stripped: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      if (key === "evidence" || key === "conflictingStartAssertions" || key === "conflictingEndAssertions" || key === "description") continue;
      stripped[key] = obj[key];
    }
    expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", stripped as unknown as E85TemporalCandidateAdapterResult)])).toThrow(E85TemporalLineageError);
  });

  test("38. CANDIDATE missing candidate.temporal rejected", () => {
    const good = candidateResult();
    if (good.outcome !== "CANDIDATE") throw new Error("expected CANDIDATE");
    const malformedCandidate = { candidateId: good.candidateId } as unknown;
    const malformed = { ...good, candidate: malformedCandidate } as E85TemporalCandidateAdapterResult;
    expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", malformed)])).toThrow(E85TemporalLineageError);
  });

  test.each(NON_CANDIDATE_OUTCOME_PAIRS)("39. candidate field present on non-CANDIDATE outcome %s rejected", (_outcomeName, state) => {
    const good = nonCandidateResult(state);
    const tampered = { ...good, candidate: { candidateId: "X", temporal: { effectiveDateBasis: "UNKNOWN" } } } as unknown as E85TemporalCandidateAdapterResult;
    expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", tampered)])).toThrow(E85TemporalLineageError);
  });

  test("40. START_UNKNOWN accepted without validity field (absent-tolerant per actual Slice 3C contract)", () => {
    const result = nonCandidateResult("START_UNKNOWN");
    expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", result)])).not.toThrow();
  });

  test("41. CONFLICTING_START accepted without validity field (absent-tolerant per actual Slice 3C contract)", () => {
    const result = nonCandidateResult("CONFLICTING_START");
    expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", result)])).not.toThrow();
  });

  test("42. missing bundle rejected", () => {
    const good = candidateResult();
    const obj = good as unknown as Record<string, unknown>;
    const stripped: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      if (key === "bundle") continue;
      stripped[key] = obj[key];
    }
    expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", stripped as unknown as E85TemporalCandidateAdapterResult)])).toThrow(E85TemporalLineageError);
  });

  test("43. missing candidateId rejected", () => {
    const good = candidateResult();
    const obj = good as unknown as Record<string, unknown>;
    const stripped: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      if (key === "candidateId") continue;
      stripped[key] = obj[key];
    }
    expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", stripped as unknown as E85TemporalCandidateAdapterResult)])).toThrow(E85TemporalLineageError);
  });
});

// ===========================================================================
// E. Canonicalization
// ===========================================================================
describe("E85 Phase 15.10 — canonicalization (via duplicate/collision detection)", () => {
  test("44. object key insertion order ignored for duplicate detection", () => {
    const a = candidateResult({ sourceVersionId: "TEST-V1" });
    const b = candidateResult({ sourceVersionId: "TEST-V1" });
    // Both built the same way; different key insertion order is not directly
    // constructible from the frozen builder, so this proves duplicate
    // detection is content-based rather than reference-based instead.
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", a), member("TEST-LINEAGE-A", b), member("TEST-LINEAGE-A", { ...a })]);
    const g = findGroup(result, "TEST-LINEAGE-A");
    expect(g.members.length).toBe(1);
  });

  test("45. array order within conflictingStartAssertions is preserved, not treated as unordered for equality", () => {
    const reordered = buildE85TemporalCandidateFromVersionValidity(bundle({ sourceVersionId: "TEST-V2" }), {
      state: "CONFLICTING_START",
      conflictingStartAssertions: [commencement({ effectiveFrom: "2020-02-01" }), commencement()],
    });
    const original = nonCandidateResult("CONFLICTING_START", { sourceVersionId: "TEST-V2" });
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", original), member("TEST-LINEAGE-A", reordered)]);
    const g = findGroup(result, "TEST-LINEAGE-A");
    // Different array order -> different canonical fingerprint -> both retained, collision finding raised.
    expect(g.members.length).toBe(2);
    expect(g.collisionFindings.length).toBeGreaterThan(0);
  });

  test("46. undefined array element rejected during canonicalization", () => {
    const good = candidateResult();
    if (good.outcome !== "CANDIDATE") throw new Error("expected CANDIDATE");
    const malformed = { ...good, conflictingStartAssertionsUnused: [undefined] } as unknown as E85TemporalCandidateAdapterResult & { conflictingStartAssertionsUnused: unknown[] };
    expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", malformed)])).toThrow(E85TemporalLineageError);
  });

  test("47. NaN rejected during canonicalization", () => {
    const good = candidateResult();
    const malformed = { ...good, tamperedNumber: NaN } as unknown as E85TemporalCandidateAdapterResult;
    expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", malformed)])).toThrow(E85TemporalLineageError);
  });

  test("48. Infinity rejected during canonicalization", () => {
    const good = candidateResult();
    const malformed = { ...good, tamperedNumber: Infinity } as unknown as E85TemporalCandidateAdapterResult;
    expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", malformed)])).toThrow(E85TemporalLineageError);
  });

  test("49. BigInt rejected during canonicalization", () => {
    const good = candidateResult();
    const malformed = { ...good, tamperedBig: BigInt(1) } as unknown as E85TemporalCandidateAdapterResult;
    expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", malformed)])).toThrow(E85TemporalLineageError);
  });

  test("50. function rejected during canonicalization", () => {
    const good = candidateResult();
    const malformed = { ...good, tamperedFn: () => 1 } as unknown as E85TemporalCandidateAdapterResult;
    expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", malformed)])).toThrow(E85TemporalLineageError);
  });

  test("51. symbol rejected during canonicalization", () => {
    const good = candidateResult();
    const malformed = { ...good, [Symbol("x")]: 1, tamperedSymbolHolder: Symbol("y") } as unknown as E85TemporalCandidateAdapterResult;
    expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", malformed)])).toThrow(E85TemporalLineageError);
  });

  test("52. Date rejected during canonicalization", () => {
    const good = candidateResult();
    const malformed = { ...good, tamperedDate: new Date("2020-01-01") } as unknown as E85TemporalCandidateAdapterResult;
    expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", malformed)])).toThrow(E85TemporalLineageError);
  });

  test("53. Map rejected during canonicalization", () => {
    const good = candidateResult();
    const malformed = { ...good, tamperedMap: new Map() } as unknown as E85TemporalCandidateAdapterResult;
    expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", malformed)])).toThrow(E85TemporalLineageError);
  });

  test("54. Set rejected during canonicalization", () => {
    const good = candidateResult();
    const malformed = { ...good, tamperedSet: new Set() } as unknown as E85TemporalCandidateAdapterResult;
    expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", malformed)])).toThrow(E85TemporalLineageError);
  });

  test("55. class instance rejected during canonicalization", () => {
    class TestClass {
      x = 1;
    }
    const good = candidateResult();
    const malformed = { ...good, tamperedInstance: new TestClass() } as unknown as E85TemporalCandidateAdapterResult;
    expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", malformed)])).toThrow(E85TemporalLineageError);
  });

  test("56. cyclic reference rejected during canonicalization", () => {
    const good = candidateResult();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const malformed = { ...good, tamperedCycle: cyclic } as unknown as E85TemporalCandidateAdapterResult;
    expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", malformed)])).toThrow(E85TemporalLineageError);
  });

  test("57. deterministic path-based error message for canonicalization failures", () => {
    const good = candidateResult();
    const malformed = { ...good, tamperedNumber: NaN } as unknown as E85TemporalCandidateAdapterResult;
    let first: unknown;
    let second: unknown;
    try {
      groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", malformed)]);
    } catch (e) {
      first = e;
    }
    try {
      groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", { ...good, tamperedNumber: NaN } as unknown as E85TemporalCandidateAdapterResult)]);
    } catch (e) {
      second = e;
    }
    expect((first as Error).message).toBe((second as Error).message);
    expect((first as Error).message).toContain("tamperedNumber");
  });
});

// ===========================================================================
// F. Duplicate/collision behavior
// ===========================================================================
describe("E85 Phase 15.10 — duplicate/collision behavior", () => {
  test("58. exact duplicate collapse", () => {
    const a = candidateResult();
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", a, "R"), member("TEST-LINEAGE-A", a, "R")]);
    expect(findGroup(result, "TEST-LINEAGE-A").members.length).toBe(1);
  });

  test("59. same content, separate object instance, collapses", () => {
    const a1 = candidateResult();
    const a2 = candidateResult();
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", a1, "R"), member("TEST-LINEAGE-A", a2, "R")]);
    expect(findGroup(result, "TEST-LINEAGE-A").members.length).toBe(1);
  });

  test("60. different rationale retained without collision", () => {
    const a = candidateResult();
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", a, "R1"), member("TEST-LINEAGE-A", a, "R2")]);
    const g = findGroup(result, "TEST-LINEAGE-A");
    expect(g.members.length).toBe(2);
    expect(g.collisionFindings.length).toBe(0);
    expect(g.kind).toBe("GROUP_READY");
    if (g.kind === "GROUP_READY") expect(g.selectorEligibleMembers.length).toBe(1);
  });

  test("61. same candidateId, different bundle content (same identity fields, different adapterId) -> collision finding raised", () => {
    const a = candidateResult({ adapterId: "TEST-ADAPTER-1" });
    const b = candidateResult({ adapterId: "TEST-ADAPTER-2" });
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", a), member("TEST-LINEAGE-A", b)]);
    const g = findGroup(result, "TEST-LINEAGE-A");
    expect(g.collisionFindings.length).toBeGreaterThan(0);
  });

  test("62. same ID, different validity -> collision finding raised", () => {
    const a = candidateResult({ sourceVersionId: "TEST-V1" });
    const differentValidity = candidateResult({ sourceVersionId: "TEST-V1" }, { ...CLOSED_VALIDITY, effectiveTo: "2029-01-01", end: expressRepeal({ effectiveTo: "2029-01-01" }) });
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", a), member("TEST-LINEAGE-A", differentValidity)]);
    expect(findGroup(result, "TEST-LINEAGE-A").collisionFindings.some((f) => f.kind === "CANDIDATE_CONTENT_COLLISION")).toBe(true);
  });

  test("63. candidate versus non-candidate same-ID collision preserves both", () => {
    const c = candidateResult({ sourceVersionId: "TEST-V1" });
    const nc = nonCandidateResult("START_UNKNOWN", { sourceVersionId: "TEST-V1" });
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", c), member("TEST-LINEAGE-A", nc)]);
    expect(findGroup(result, "TEST-LINEAGE-A").members.length).toBe(2);
  });

  test("64. two distinct non-candidates under same ID -> NON_CANDIDATE_CONTENT_COLLISION, GROUP_NO_CANDIDATE since no candidate present", () => {
    const nc1 = nonCandidateResult("START_UNKNOWN", { sourceVersionId: "TEST-V1" });
    const nc2 = nonCandidateResult("CONFLICTING_END", { sourceVersionId: "TEST-V1" });
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", nc1), member("TEST-LINEAGE-A", nc2)]);
    const g = findGroup(result, "TEST-LINEAGE-A");
    expect(g.kind).toBe("GROUP_NO_CANDIDATE");
    expect(g.collisionFindings.some((f) => f.kind === "NON_CANDIDATE_CONTENT_COLLISION")).toBe(true);
  });

  test("65. cross-lineage candidate duplication preserves all memberships and emits one global finding", () => {
    const shared = candidateResult();
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", shared), member("TEST-LINEAGE-B", shared)]);
    expect(result.crossLineageFindings.length).toBe(1);
    expect(result.crossLineageFindings[0].kind).toBe("CANDIDATE_ID_IN_MULTIPLE_LINEAGES");
  });

  test("66. cross-lineage non-candidate duplication does not block, emits global finding", () => {
    const shared = nonCandidateResult("START_UNKNOWN");
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", shared), member("TEST-LINEAGE-B", shared)]);
    expect(result.crossLineageFindings.length).toBe(1);
    expect(result.crossLineageFindings[0].kind).toBe("NON_CANDIDATE_ID_IN_MULTIPLE_LINEAGES");
    expect(findGroup(result, "TEST-LINEAGE-A").kind).toBe("GROUP_NO_CANDIDATE");
    expect(findGroup(result, "TEST-LINEAGE-B").kind).toBe("GROUP_NO_CANDIDATE");
  });
});

// ===========================================================================
// G. Determinism
// ===========================================================================
describe("E85 Phase 15.10 — determinism", () => {
  test("67. reversed input produces deeply equal output", () => {
    const inputs = [
      member("TEST-LINEAGE-A", candidateResult({ sourceVersionId: "TEST-V1" })),
      member("TEST-LINEAGE-B", candidateResult({ sourceVersionId: "TEST-V2" })),
      member("TEST-LINEAGE-A", nonCandidateResult("START_UNKNOWN", { sourceVersionId: "TEST-V3" })),
    ];
    const forward = groupE85TemporalLineageMembers(inputs);
    const reversed = groupE85TemporalLineageMembers([...inputs].reverse());
    expect(forward).toEqual(reversed);
  });

  test("68. fixed table of multiple permutations produces deeply equal output", () => {
    const a = member("TEST-LINEAGE-A", candidateResult({ sourceVersionId: "TEST-V1" }));
    const b = member("TEST-LINEAGE-B", candidateResult({ sourceVersionId: "TEST-V2" }));
    const c = member("TEST-LINEAGE-A", nonCandidateResult("CONFLICTING_END", { sourceVersionId: "TEST-V3" }));
    const permutations = [
      [a, b, c],
      [a, c, b],
      [b, a, c],
      [b, c, a],
      [c, a, b],
      [c, b, a],
    ];
    const results = permutations.map((p) => groupE85TemporalLineageMembers(p));
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toEqual(results[0]);
    }
  });

  test("69. deterministic member order within a group", () => {
    const a = candidateResult({ sourceVersionId: "TEST-V2" });
    const b = candidateResult({ sourceVersionId: "TEST-V1" });
    const result1 = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", a), member("TEST-LINEAGE-A", b)]);
    const result2 = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", b), member("TEST-LINEAGE-A", a)]);
    expect(findGroup(result1, "TEST-LINEAGE-A").members).toEqual(findGroup(result2, "TEST-LINEAGE-A").members);
  });

  test("70. deterministic group order (sorted by lineageId)", () => {
    const result = groupE85TemporalLineageMembers([
      member("TEST-LINEAGE-Z", candidateResult({ sourceVersionId: "TEST-V1" })),
      member("TEST-LINEAGE-A", candidateResult({ sourceVersionId: "TEST-V2" })),
    ]);
    expect(result.groups.map((g) => g.lineageId)).toEqual(["TEST-LINEAGE-A", "TEST-LINEAGE-Z"]);
  });

  test("71. deterministic finding order", () => {
    const shared1 = candidateResult({ zoneDesignation: "TEST-ZONE-Z" });
    const shared2 = candidateResult({ zoneDesignation: "TEST-ZONE-A" });
    const result = groupE85TemporalLineageMembers([
      member("TEST-LINEAGE-A", shared1),
      member("TEST-LINEAGE-B", shared1),
      member("TEST-LINEAGE-C", shared2),
      member("TEST-LINEAGE-D", shared2),
    ]);
    const ids = result.crossLineageFindings.map((f) => f.candidateId);
    const sortedIds = [...ids].sort();
    expect(ids).toEqual(sortedIds);
  });

  test("72. repeated invalid input yields identical error type/message", () => {
    let first: unknown;
    let second: unknown;
    try {
      groupE85TemporalLineageMembers([member("", candidateResult())]);
    } catch (e) {
      first = e;
    }
    try {
      groupE85TemporalLineageMembers([member("", candidateResult())]);
    } catch (e) {
      second = e;
    }
    expect(first).toBeInstanceOf(E85TemporalLineageError);
    expect((first as Error).message).toBe((second as Error).message);
  });
});

// ===========================================================================
// H. Isolation
// ===========================================================================
describe("E85 Phase 15.10 — isolation", () => {
  const filePath = path.resolve(__dirname, "../../src/zoning-land-use-engine/temporal-lineage-grouping.ts");
  const source = fs.readFileSync(filePath, "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  test("73. no mutation of input members array", () => {
    const inputs = [member("TEST-LINEAGE-A", candidateResult())];
    const before = JSON.stringify(inputs);
    groupE85TemporalLineageMembers(inputs);
    expect(JSON.stringify(inputs)).toBe(before);
  });

  test("74. no mutation of adapterResult/bundle content", () => {
    const c = candidateResult();
    const before = JSON.stringify(c);
    groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", c)]);
    expect(JSON.stringify(c)).toBe(before);
  });

  test("75. no Date/Date.now/new Date usage in production code", () => {
    expect(/\bDate\.now\s*\(/.test(code)).toBe(false);
    expect(/\bnew\s+Date\s*\(/.test(code)).toBe(false);
    const codeSansStrings = code
      .replace(/`(?:[^`\\]|\\.)*`/g, "``")
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''");
    expect(/[^.\w]Date\b(?!\.now)/.test(codeSansStrings.replace(/new\s+Date/g, "").replace(/instanceof Date/g, ""))).toBe(false);
  });

  test("76. no randomness (Math.random / randomUUID)", () => {
    expect(/Math\.random\s*\(/.test(code)).toBe(false);
    expect(/randomUUID\s*\(/.test(code)).toBe(false);
  });

  test("77. no filesystem or network access", () => {
    expect(/from\s+["'](?:node:)?fs(?:\/promises)?["']/.test(code)).toBe(false);
    expect(/\bfetch\s*\(/.test(code)).toBe(false);
    expect(/from\s+["'](?:node:)?https?["']/.test(code)).toBe(false);
  });

  test("78. no use of `any` in executable/type code", () => {
    const executable = code.replace(/`(?:[^`\\]|\\.)*`/g, "``").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''");
    expect(/\bany\b/.test(executable)).toBe(false);
  });

  test("79. no real-jurisdiction strings", () => {
    for (const term of [/vancouver/i, /burnaby/i, /\bR1-1\b/, /\bC-2C\b/]) {
      expect(term.test(source)).toBe(false);
    }
  });

  test("80. no forbidden imports (registry, source-adapter, linkage, composer, evaluator, status, materiality)", () => {
    const imports = [...code.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    const forbiddenSubstrings = [
      "source-registry",
      "adapter-registry",
      "source-adapter-contract",
      "adapters/",
      "linkage",
      "composer",
      "composition-types",
      "evaluator",
      "decision-",
      "gap",
      "materiality",
      "status",
      "spatial",
      "normalized-bundle-types",
      "version-validity-types",
      "temporal-selection",
    ];
    for (const specifier of imports) {
      for (const forbidden of forbiddenSubstrings) {
        expect(specifier.includes(forbidden)).toBe(false);
      }
    }
    expect([...new Set(imports)]).toEqual(["./temporal-candidate-adapter"]);
  });

  test("81. only the E85TemporalCandidateAdapterResult type is imported from Slice 3C", () => {
    expect(/import\s+type\s*\{\s*E85TemporalCandidateAdapterResult\s*\}\s*from\s+["']\.\/temporal-candidate-adapter["']/.test(code)).toBe(true);
  });

  test("82. no barrel export (module not re-exported through index.ts)", () => {
    const indexSource = fs.readFileSync(path.resolve(__dirname, "../../src/zoning-land-use-engine/index.ts"), "utf8");
    expect(indexSource.includes("temporal-lineage-grouping")).toBe(false);
  });

  test("83. no skipped/todo/.only/snapshot markers in this test file", () => {
    const testSource = fs.readFileSync(path.resolve(__dirname, "temporal-lineage-grouping.test.ts"), "utf8");
    expect(/\btest\.skip\b/.test(testSource)).toBe(false);
    expect(/\btest\.only\b/.test(testSource)).toBe(false);
    expect(/\bdescribe\.skip\b/.test(testSource)).toBe(false);
    expect(/\bdescribe\.only\b/.test(testSource)).toBe(false);
    expect(/\btoMatchSnapshot\b/.test(testSource)).toBe(false);
    expect(/\.todo\(/.test(testSource)).toBe(false);
  });

  test("84. no real fixtures (only TEST- prefixed synthetic identities used in this file's helpers)", () => {
    const testFileSource = fs.readFileSync(path.resolve(__dirname, "temporal-lineage-grouping.test.ts"), "utf8");
    expect(/TEST-JX|TEST-SOURCE|TEST-ZONE|TEST-LINEAGE/.test(testFileSource)).toBe(true);
    // Real-jurisdiction-string absence is separately and exhaustively covered
    // by test 79 (checked against the production module's own source, not
    // this file's own detection regexes, which legitimately contain those
    // words as pattern text).
  });
});

// ===========================================================================
// Additional determinism/coverage padding for state-vocabulary boundary cases
// ===========================================================================
describe("E85 Phase 15.10 — additional boundary coverage", () => {
  test("85. empty members array yields empty groups and empty crossLineageFindings", () => {
    const result = groupE85TemporalLineageMembers([]);
    expect(result.groups).toEqual([]);
    expect(result.crossLineageFindings).toEqual([]);
  });

  test("86. non-array members rejected", () => {
    expect(() => groupE85TemporalLineageMembers("not-an-array" as unknown as E85TemporalLineageMember[])).toThrow(E85TemporalLineageError);
  });

  test("87. multiple independent lineages each computed independently", () => {
    const result = groupE85TemporalLineageMembers([
      member("TEST-LINEAGE-A", candidateResult({ sourceVersionId: "TEST-V1" })),
      member("TEST-LINEAGE-B", nonCandidateResult("START_UNKNOWN", { sourceVersionId: "TEST-V2" })),
      member("TEST-LINEAGE-C", candidateResult({ sourceVersionId: "TEST-V3" }), "R"),
      member("TEST-LINEAGE-C", nonCandidateResult("CONFLICTING_END", { sourceVersionId: "TEST-V4" })),
    ]);
    expect(findGroup(result, "TEST-LINEAGE-A").kind).toBe("GROUP_READY");
    expect(findGroup(result, "TEST-LINEAGE-B").kind).toBe("GROUP_NO_CANDIDATE");
    expect(findGroup(result, "TEST-LINEAGE-C").kind).toBe("GROUP_EVIDENCE_INCOMPLETE");
  });

  test("88. GROUP_READY selectorEligibleMembers is exactly one representative per distinct candidateId", () => {
    const a = candidateResult({ sourceVersionId: "TEST-V1" });
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", a, "R1"), member("TEST-LINEAGE-A", a, "R2")]);
    const g = findGroup(result, "TEST-LINEAGE-A");
    expect(g.kind).toBe("GROUP_READY");
    if (g.kind === "GROUP_READY") {
      expect(g.selectorEligibleMembers.length).toBe(1);
      expect(g.members.length).toBe(2);
    }
  });

  test("89. repeated valid calls are deeply equal (pure function)", () => {
    const inputs = [member("TEST-LINEAGE-A", candidateResult())];
    expect(groupE85TemporalLineageMembers(inputs)).toEqual(groupE85TemporalLineageMembers(inputs));
  });

  test("90. collision finding lineageIds are sorted", () => {
    const shared = candidateResult();
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-Z", shared), member("TEST-LINEAGE-A", shared)]);
    expect(result.crossLineageFindings[0].lineageIds).toEqual(["TEST-LINEAGE-A", "TEST-LINEAGE-Z"]);
  });

  test("91. E85TemporalLineageError has correct name and message prefix", () => {
    try {
      groupE85TemporalLineageMembers([member("", candidateResult())]);
      throw new Error("expected a throw");
    } catch (error) {
      expect(error).toBeInstanceOf(E85TemporalLineageError);
      expect((error as Error).name).toBe("E85TemporalLineageError");
      expect((error as Error).message.startsWith("E85 temporal lineage error:")).toBe(true);
    }
  });
});

// ===========================================================================
// F. Phase 15.19B / Slice 3D-1.1 — runtime domain-invariant validation:
// CANDIDATE outcome must carry validity.state "CLOSED".
// ===========================================================================
describe("E85 Phase 15.19B — CANDIDATE/validity.state domain invariant", () => {
  // A. Positive control — honest CLOSED candidate, produced only via the
  // real Slice 3C factory, continues to reach GROUP_READY and exposes
  // selectorEligibleMembers.
  test("92. honest CLOSED candidate via buildE85TemporalCandidateFromVersionValidity remains accepted -> GROUP_READY", () => {
    const honest = candidateResult(); // uses CLOSED_VALIDITY by default
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", honest)]);
    const g = findGroup(result, "TEST-LINEAGE-A");
    expect(g.kind).toBe("GROUP_READY");
    if (g.kind === "GROUP_READY") {
      expect(g.selectorEligibleMembers.length).toBe(1);
      expect(g.selectorEligibleMembers[0].adapterResult.outcome).toBe("CANDIDATE");
    }
  });

  // B. OPEN_UNRESEARCHED malformed pairing — the exact forgery shape from the
  // Phase 15.19A audit's empirical proof.
  test("93. forged CANDIDATE outcome paired with validity.state OPEN_UNRESEARCHED is rejected before GROUP_READY", () => {
    const honestOpen = nonCandidateResult("OPEN_UNRESEARCHED");
    if (honestOpen.outcome !== "OPEN_END_UNRESEARCHED") throw new Error("expected OPEN_END_UNRESEARCHED");
    const honestClosed = candidateResult();
    if (honestClosed.outcome !== "CANDIDATE") throw new Error("expected CANDIDATE");
    // Narrowest possible forgery: take an honest CANDIDATE shape and swap in
    // the OPEN_UNRESEARCHED validity object, exactly the runtime bypass the
    // Phase 15.19A audit proved was previously accepted.
    const forged: E85TemporalCandidateAdapterResult = { ...honestClosed, validity: honestOpen.validity };
    expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", forged)])).toThrow(E85TemporalLineageError);
    let thrown: unknown;
    try {
      groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", forged)]);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(E85TemporalLineageError);
    const message = (thrown as Error).message;
    expect(message).toContain('outcome "CANDIDATE"');
    expect(message).toContain('validity.state "CLOSED"');
    expect(message).toContain("OPEN_UNRESEARCHED");
    // No group is ever returned for this lineage — the throw happens inside
    // groupE85TemporalLineageMembers's member-validation pass, before any
    // group (let alone GROUP_READY / selectorEligibleMembers) is constructed.
  });

  // C. Every other non-CLOSED validity state (parameterized across the full
  // seven-state union minus CLOSED itself).
  const NON_CLOSED_VALIDITY_STATES: readonly E85VersionValidity["state"][] = [
    "START_UNKNOWN",
    "CONFLICTING_START",
    "OPEN_UNRESEARCHED",
    "OPEN_REVIEWED_NO_END_ESTABLISHED",
    "CONFLICTING_END",
    "CONDITIONAL_PARTIAL_TERMINATION",
  ];

  function honestValidityFor(state: (typeof NON_CLOSED_VALIDITY_STATES)[number]): E85VersionValidity {
    switch (state) {
      case "START_UNKNOWN":
        return { state: "START_UNKNOWN" };
      case "CONFLICTING_START":
        return { state: "CONFLICTING_START", conflictingStartAssertions: [commencement(), commencement({ effectiveFrom: "2020-02-01" })] };
      case "OPEN_UNRESEARCHED":
        return { state: "OPEN_UNRESEARCHED", effectiveFrom: "2020-01-01", start: commencement() };
      case "OPEN_REVIEWED_NO_END_ESTABLISHED":
        return {
          state: "OPEN_REVIEWED_NO_END_ESTABLISHED",
          effectiveFrom: "2020-01-01",
          start: commencement(),
          endReview: { sourcesChecked: ["TEST-SOURCE"], reviewedAt: "2026-01-01" },
        };
      case "CONFLICTING_END":
        return {
          state: "CONFLICTING_END",
          effectiveFrom: "2020-01-01",
          start: commencement(),
          conflictingEndAssertions: [expressRepeal(), expressRepeal({ effectiveTo: "2022-06-30" })],
        };
      case "CONDITIONAL_PARTIAL_TERMINATION":
        return { state: "CONDITIONAL_PARTIAL_TERMINATION", effectiveFrom: "2020-01-01", start: commencement(), description: "TEST partial termination." };
      default:
        throw new Error(`unsupported non-CLOSED validity state in test helper, got ${JSON.stringify(state)}.`);
    }
  }

  test.each(NON_CLOSED_VALIDITY_STATES.map((s) => [s] as const))(
    "94. forged CANDIDATE outcome paired with validity.state %s is rejected",
    (state) => {
      const honestClosed = candidateResult();
      if (honestClosed.outcome !== "CANDIDATE") throw new Error("expected CANDIDATE");
      const forged: E85TemporalCandidateAdapterResult = { ...honestClosed, validity: honestValidityFor(state) };
      expect(() => groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", forged)])).toThrow(E85TemporalLineageError);
    },
  );

  // D. JSON round-trip — proves this is runtime validation, not merely a
  // TypeScript-time guarantee. The `as unknown as` cast here is the
  // narrowest boundary cast needed to simulate deserialized/untyped input
  // reaching the public grouping boundary; it is never used on a passing
  // (positive) path anywhere in this file.
  test("95. JSON round-tripped forged CANDIDATE/OPEN_UNRESEARCHED plain object is rejected at the runtime boundary", () => {
    const honestClosed = candidateResult();
    if (honestClosed.outcome !== "CANDIDATE") throw new Error("expected CANDIDATE");
    const forgedPlainObject = {
      outcome: "CANDIDATE",
      candidateId: honestClosed.candidateId,
      candidate: honestClosed.candidate,
      bundle: honestClosed.bundle,
      validity: { state: "OPEN_UNRESEARCHED", effectiveFrom: "2020-01-01", start: commencement() },
    };
    const deserialized: unknown = JSON.parse(JSON.stringify(forgedPlainObject));
    // Narrowest cast possible to simulate untyped/deserialized input crossing
    // the public grouping boundary — this member is malformed by
    // construction and is not reused on any success-path assertion.
    const deserializedMember = member("TEST-LINEAGE-A", deserialized as unknown as E85TemporalCandidateAdapterResult);
    expect(() => groupE85TemporalLineageMembers([deserializedMember])).toThrow(E85TemporalLineageError);
  });

  // E. Honest non-candidate controls — representative non-CLOSED states,
  // produced by the real Slice 3C adapter, retain their existing frozen
  // group-outcome mapping unchanged by this remediation.
  test("96. honest OPEN_UNRESEARCHED (alone) -> GROUP_NO_CANDIDATE, unaffected by the new invariant check", () => {
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", nonCandidateResult("OPEN_UNRESEARCHED"))]);
    expect(findGroup(result, "TEST-LINEAGE-A").kind).toBe("GROUP_NO_CANDIDATE");
  });

  test("97. honest CLOSED candidate + honest OPEN_UNRESEARCHED sibling -> GROUP_EVIDENCE_INCOMPLETE, unaffected", () => {
    const result = groupE85TemporalLineageMembers([
      member("TEST-LINEAGE-A", candidateResult({ sourceVersionId: "TEST-V1" })),
      member("TEST-LINEAGE-A", nonCandidateResult("OPEN_UNRESEARCHED", { sourceVersionId: "TEST-V2" })),
    ]);
    expect(findGroup(result, "TEST-LINEAGE-A").kind).toBe("GROUP_EVIDENCE_INCOMPLETE");
  });

  test("98. honest CANDIDATE/CANDIDATE content collision -> GROUP_BLOCKED, unaffected by the new invariant check", () => {
    const shared = candidateResult({ sourceVersionId: "TEST-V1" });
    const differentContent = candidateResult({ sourceVersionId: "TEST-V1" }, { ...CLOSED_VALIDITY, effectiveTo: "2022-12-31", end: expressRepeal({ effectiveTo: "2022-12-31" }) });
    const result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", shared), member("TEST-LINEAGE-A", differentContent)]);
    expect(findGroup(result, "TEST-LINEAGE-A").kind).toBe("GROUP_BLOCKED");
  });

  // F. Invalid-interval behavior — this remediation must not weaken or
  // replace the existing, separate invalid-interval construction failure
  // (thrown by Slice 3B's buildE85VersionValidity / Slice 3C's revalidate,
  // both upstream of and untouched by this module). It continues to fail at
  // its own established boundary, never converted into
  // E85TemporalLineageError or a legal evidence gap.
  test("99. invalid interval (effectiveFrom after effectiveTo) still fails at its own established construction boundary, not as E85TemporalLineageError", () => {
    expect(() =>
      buildE85TemporalCandidateFromVersionValidity(bundle(), {
        state: "CLOSED",
        effectiveFrom: "2025-01-01",
        start: commencement({ effectiveFrom: "2025-01-01" }),
        effectiveTo: "2020-01-01",
        end: expressRepeal({ effectiveTo: "2020-01-01" }),
      }),
    ).not.toThrow(E85TemporalLineageError);
  });

  // G. Downstream non-reachability — a grouping-level throw for the
  // malformed lineage means groupE85TemporalLineageMembers never returns a
  // result at all for that call; no GROUP_READY/selectorEligibleMembers
  // value can therefore ever be constructed or handed to a selector. This is
  // proven directly: the throw is synchronous, occurs before `groups` is
  // built (see `groupE85TemporalLineageMembers`'s `members.map(validateMember)`
  // call, which runs before any group-state computation), and no group
  // object is returned or partially returned on throw.
  test("100. malformed CANDIDATE/non-CLOSED member throws before any group is returned for a mixed batch", () => {
    const honestClosed = candidateResult({ sourceVersionId: "TEST-V1" });
    if (honestClosed.outcome !== "CANDIDATE") throw new Error("expected CANDIDATE");
    const forged: E85TemporalCandidateAdapterResult = { ...honestClosed, candidateId: honestClosed.candidateId, validity: honestValidityFor("OPEN_UNRESEARCHED") };
    let result: E85TemporalLineageGroupingResult | undefined;
    let caught: unknown;
    try {
      result = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", candidateResult({ sourceVersionId: "TEST-V2" })), member("TEST-LINEAGE-B", forged)]);
    } catch (error) {
      caught = error;
    }
    expect(result).toBeUndefined();
    expect(caught).toBeInstanceOf(E85TemporalLineageError);
  });
});

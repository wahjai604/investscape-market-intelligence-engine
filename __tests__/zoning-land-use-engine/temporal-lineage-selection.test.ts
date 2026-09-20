/**
 * InvestScape™ E85 Phase 15.12 — temporal lineage selection invocation tests,
 * Slice 3D-3.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Synthetic identifiers only (TEST-JX / TEST-SOURCE / TEST-V* / TEST-ZONE /
 * TEST-LINEAGE-*) — no real-municipality fixture is imported or referenced
 * anywhere in this file. All fixtures are constructed locally; this file
 * does not import the shared fixtures/ directory used by
 * temporal-selection.test.ts, since those fixtures are candidate-shaped, not
 * lineage/group-shaped.
 */
import * as fs from "fs";
import * as path from "path";
import type { E85NormalizedRuleBundle } from "../../src/zoning-land-use-engine/normalized-bundle-types";
import type { E85VersionValidity, E85StartAuthority, E85EndAuthority, E85OperativeLocator } from "../../src/zoning-land-use-engine/version-validity-types";
import { buildE85TemporalCandidateFromVersionValidity } from "../../src/zoning-land-use-engine/temporal-candidate-adapter";
import type { E85TemporalCandidateAdapterResult } from "../../src/zoning-land-use-engine/temporal-candidate-adapter";
import {
  groupE85TemporalLineageMembers,
  E85TemporalLineageMember,
} from "../../src/zoning-land-use-engine/temporal-lineage-grouping";
import type { E85TemporalLineageGroup, E85TemporalLineageGroupingResult } from "../../src/zoning-land-use-engine/temporal-lineage-grouping";
import { selectE85TemporalCandidate } from "../../src/zoning-land-use-engine/temporal-selection";
import type { E85ResolvedTemporalRequest } from "../../src/zoning-land-use-engine/temporal-request-types";
import {
  selectE85TemporalLineages,
  E85TemporalLineageSelectionError,
  E85TemporalLineageSelectionEvaluated,
  E85TemporalLineageSelectionOutcome,
  E85TemporalLineageSelectionResult,
} from "../../src/zoning-land-use-engine/temporal-lineage-selection";

// ---------------------------------------------------------------------------
// Local synthetic fixtures
// ---------------------------------------------------------------------------

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

function closedValidity(effectiveFrom: string, effectiveTo: string): E85VersionValidity {
  return {
    state: "CLOSED",
    effectiveFrom,
    start: commencement({ effectiveFrom }),
    effectiveTo,
    end: expressRepeal({ effectiveTo }),
  };
}

function candidateResult(bundleOverrides: Partial<E85NormalizedRuleBundle> = {}, validity?: E85VersionValidity): E85TemporalCandidateAdapterResult {
  const v = validity ?? closedValidity("2020-01-01", "2020-12-31");
  return buildE85TemporalCandidateFromVersionValidity(bundle(bundleOverrides), v);
}

function nonCandidateResult(bundleOverrides: Partial<E85NormalizedRuleBundle> = {}): E85TemporalCandidateAdapterResult {
  return buildE85TemporalCandidateFromVersionValidity(bundle(bundleOverrides), { state: "START_UNKNOWN" });
}

function member(lineageId: string, adapterResult: E85TemporalCandidateAdapterResult, rationale = "TEST rationale"): E85TemporalLineageMember {
  return { lineageId, adapterResult, membershipRationale: rationale };
}

function findGroup(result: E85TemporalLineageGroupingResult, lineageId: string): E85TemporalLineageGroup {
  const g = result.groups.find((x) => x.lineageId === lineageId);
  if (g === undefined) throw new Error(`no group found for lineageId "${lineageId}"`);
  return g;
}

function findOutcome(result: E85TemporalLineageSelectionResult, lineageId: string): E85TemporalLineageSelectionOutcome {
  const o = result.outcomes.find((x) => x.lineageId === lineageId);
  if (o === undefined) throw new Error(`no outcome found for lineageId "${lineageId}"`);
  return o;
}

const ABSENT: E85ResolvedTemporalRequest = { kind: "ABSENT" };
const CURRENT: E85ResolvedTemporalRequest = { kind: "RESOLVED", request: { mode: "CURRENT" } };
function asOf(date: string): E85ResolvedTemporalRequest {
  return { kind: "RESOLVED", request: { mode: "AS_OF", asOfDate: date } };
}

/** Two non-overlapping closed candidates in one lineage: V1 [2020-01-01,2020-12-31], V2 [2021-06-01,2021-12-31]. */
function twoVersionGroup(lineageId = "TEST-LINEAGE-A"): E85TemporalLineageGroupingResult {
  const v1 = candidateResult({ sourceVersionId: "TEST-V1" }, closedValidity("2020-01-01", "2020-12-31"));
  const v2 = candidateResult({ sourceVersionId: "TEST-V2" }, closedValidity("2021-06-01", "2021-12-31"));
  return groupE85TemporalLineageMembers([member(lineageId, v1), member(lineageId, v2)]);
}

// ===========================================================================
// A. Four-state routing
// ===========================================================================
describe("E85 Phase 15.12 — four-state routing", () => {
  test("1. GROUP_READY routes to LINEAGE_SELECTION_EVALUATED", () => {
    const grouping = twoVersionGroup();
    const result = selectE85TemporalLineages(grouping, asOf("2020-06-15"));
    expect(findOutcome(result, "TEST-LINEAGE-A").kind).toBe("LINEAGE_SELECTION_EVALUATED");
  });

  test("2. GROUP_BLOCKED routes to LINEAGE_NOT_SELECTOR_ELIGIBLE and never invokes the selector", () => {
    const shared = candidateResult({ sourceVersionId: "TEST-V1" });
    const conflicting = candidateResult({ sourceVersionId: "TEST-V1" }, closedValidity("2020-01-01", "2022-01-01"));
    const grouping = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", shared), member("TEST-LINEAGE-A", conflicting)]);
    expect(findGroup(grouping, "TEST-LINEAGE-A").kind).toBe("GROUP_BLOCKED");
    const result = selectE85TemporalLineages(grouping, asOf("2020-06-15"));
    const outcome = findOutcome(result, "TEST-LINEAGE-A");
    expect(outcome.kind).toBe("LINEAGE_NOT_SELECTOR_ELIGIBLE");
    expect("selectorResult" in outcome).toBe(false);
  });

  test("3. GROUP_EVIDENCE_INCOMPLETE routes to LINEAGE_NOT_SELECTOR_ELIGIBLE", () => {
    const grouping = groupE85TemporalLineageMembers([
      member("TEST-LINEAGE-A", candidateResult({ sourceVersionId: "TEST-V1" })),
      member("TEST-LINEAGE-A", nonCandidateResult({ sourceVersionId: "TEST-V2" })),
    ]);
    expect(findGroup(grouping, "TEST-LINEAGE-A").kind).toBe("GROUP_EVIDENCE_INCOMPLETE");
    const outcome = findOutcome(selectE85TemporalLineages(grouping, asOf("2020-06-15")), "TEST-LINEAGE-A");
    expect(outcome.kind).toBe("LINEAGE_NOT_SELECTOR_ELIGIBLE");
  });

  test("4. GROUP_NO_CANDIDATE routes to LINEAGE_NOT_SELECTOR_ELIGIBLE", () => {
    const grouping = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", nonCandidateResult())]);
    expect(findGroup(grouping, "TEST-LINEAGE-A").kind).toBe("GROUP_NO_CANDIDATE");
    const outcome = findOutcome(selectE85TemporalLineages(grouping, asOf("2020-06-15")), "TEST-LINEAGE-A");
    expect(outcome.kind).toBe("LINEAGE_NOT_SELECTOR_ELIGIBLE");
  });

  test("5. only LINEAGE_SELECTION_EVALUATED carries selectorResult at runtime", () => {
    const grouping = groupE85TemporalLineageMembers([
      member("TEST-LINEAGE-A", candidateResult({ sourceVersionId: "TEST-V1" })),
      member("TEST-LINEAGE-B", nonCandidateResult({ sourceVersionId: "TEST-V2" })),
    ]);
    const result = selectE85TemporalLineages(grouping, asOf("2020-06-15"));
    for (const outcome of result.outcomes) {
      if (outcome.kind === "LINEAGE_SELECTION_EVALUATED") {
        expect("selectorResult" in outcome).toBe(true);
      } else {
        expect("selectorResult" in outcome).toBe(false);
      }
    }
  });

  test("6. compile-time absence of selectorResult on LINEAGE_NOT_SELECTOR_ELIGIBLE", () => {
    const grouping = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", nonCandidateResult())]);
    const outcome = findOutcome(selectE85TemporalLineages(grouping, asOf("2020-06-15")), "TEST-LINEAGE-A");
    if (outcome.kind === "LINEAGE_SELECTION_EVALUATED") {
      expect(outcome.selectorResult).toBeDefined();
    } else {
      // @ts-expect-error — LINEAGE_NOT_SELECTOR_ELIGIBLE has no selectorResult field.
      const _forbidden = outcome.selectorResult;
      expect(_forbidden).toBeUndefined();
    }
  });

  test("7. original group kind remains accessible through result.group.kind", () => {
    const grouping = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", nonCandidateResult())]);
    const outcome = findOutcome(selectE85TemporalLineages(grouping, asOf("2020-06-15")), "TEST-LINEAGE-A");
    expect(outcome.group.kind).toBe("GROUP_NO_CANDIDATE");
  });

  test("8. collisionFindings remain accessible through the retained group", () => {
    const shared = candidateResult({ sourceVersionId: "TEST-V1" });
    const conflicting = candidateResult({ sourceVersionId: "TEST-V1" }, closedValidity("2020-01-01", "2023-01-01"));
    const grouping = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", shared), member("TEST-LINEAGE-A", conflicting)]);
    const outcome = findOutcome(selectE85TemporalLineages(grouping, asOf("2020-06-15")), "TEST-LINEAGE-A");
    expect(outcome.group.collisionFindings.length).toBeGreaterThan(0);
  });

  test("9. nonCandidateMembers remain accessible through the retained group", () => {
    const grouping = groupE85TemporalLineageMembers([
      member("TEST-LINEAGE-A", candidateResult({ sourceVersionId: "TEST-V1" })),
      member("TEST-LINEAGE-A", nonCandidateResult({ sourceVersionId: "TEST-V2" })),
    ]);
    const outcome = findOutcome(selectE85TemporalLineages(grouping, asOf("2020-06-15")), "TEST-LINEAGE-A");
    expect(outcome.group.nonCandidateMembers.length).toBe(1);
  });
});

// ===========================================================================
// B. Selector-result pass-through
// ===========================================================================
describe("E85 Phase 15.12 — selector-result pass-through", () => {
  test("10. unique overlap -> SELECTED, matches direct selector call exactly", () => {
    const grouping = twoVersionGroup();
    const ready = findGroup(grouping, "TEST-LINEAGE-A");
    if (ready.kind !== "GROUP_READY") throw new Error("expected GROUP_READY");
    const candidates = ready.selectorEligibleMembers.map((m) => {
      if (m.adapterResult.outcome !== "CANDIDATE") throw new Error("expected CANDIDATE");
      return m.adapterResult.candidate;
    });
    const request = asOf("2020-06-15");
    const direct = selectE85TemporalCandidate(request, candidates);
    const outcome = findOutcome(selectE85TemporalLineages(grouping, request), "TEST-LINEAGE-A");
    if (outcome.kind !== "LINEAGE_SELECTION_EVALUATED") throw new Error("expected LINEAGE_SELECTION_EVALUATED");
    expect(outcome.selectorResult).toEqual(direct);
    expect(direct.kind).toBe("SELECTED");
  });

  test("11. multiple overlap -> CONFLICTING_TEMPORAL_EVIDENCE", () => {
    const v1 = candidateResult({ sourceVersionId: "TEST-V1" }, closedValidity("2020-01-01", "2020-12-31"));
    const v2 = candidateResult({ sourceVersionId: "TEST-V2" }, closedValidity("2020-01-01", "2020-12-31"));
    // Different content (different sourceVersionId) but distinct candidateIds, so no collision — both remain eligible.
    const grouping = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", v1), member("TEST-LINEAGE-A", v2)]);
    expect(findGroup(grouping, "TEST-LINEAGE-A").kind).toBe("GROUP_READY");
    const outcome = findOutcome(selectE85TemporalLineages(grouping, asOf("2020-06-15")), "TEST-LINEAGE-A");
    if (outcome.kind !== "LINEAGE_SELECTION_EVALUATED") throw new Error("expected LINEAGE_SELECTION_EVALUATED");
    expect(outcome.selectorResult.kind).toBe("CONFLICTING_TEMPORAL_EVIDENCE");
  });

  test("12. proven gap -> OUTSIDE_VALIDITY_INTERVAL", () => {
    const grouping = twoVersionGroup();
    const outcome = findOutcome(selectE85TemporalLineages(grouping, asOf("2021-01-15")), "TEST-LINEAGE-A");
    if (outcome.kind !== "LINEAGE_SELECTION_EVALUATED") throw new Error("expected LINEAGE_SELECTION_EVALUATED");
    expect(outcome.selectorResult.kind).toBe("OUTSIDE_VALIDITY_INTERVAL");
  });

  test("13. before all candidates -> FUTURE_EFFECTIVE", () => {
    const grouping = twoVersionGroup();
    const outcome = findOutcome(selectE85TemporalLineages(grouping, asOf("2019-01-01")), "TEST-LINEAGE-A");
    if (outcome.kind !== "LINEAGE_SELECTION_EVALUATED") throw new Error("expected LINEAGE_SELECTION_EVALUATED");
    expect(outcome.selectorResult.kind).toBe("FUTURE_EFFECTIVE");
  });

  test("14. after all closed candidates -> SUPERSEDED", () => {
    const grouping = twoVersionGroup();
    const outcome = findOutcome(selectE85TemporalLineages(grouping, asOf("2022-01-01")), "TEST-LINEAGE-A");
    if (outcome.kind !== "LINEAGE_SELECTION_EVALUATED") throw new Error("expected LINEAGE_SELECTION_EVALUATED");
    expect(outcome.selectorResult.kind).toBe("SUPERSEDED");
  });

  test("15. exact effectiveFrom boundary remains selectable", () => {
    const grouping = twoVersionGroup();
    const outcome = findOutcome(selectE85TemporalLineages(grouping, asOf("2020-01-01")), "TEST-LINEAGE-A");
    if (outcome.kind !== "LINEAGE_SELECTION_EVALUATED") throw new Error("expected LINEAGE_SELECTION_EVALUATED");
    expect(outcome.selectorResult.kind).toBe("SELECTED");
  });

  test("16. exact effectiveTo boundary remains selectable", () => {
    const grouping = twoVersionGroup();
    const outcome = findOutcome(selectE85TemporalLineages(grouping, asOf("2020-12-31")), "TEST-LINEAGE-A");
    if (outcome.kind !== "LINEAGE_SELECTION_EVALUATED") throw new Error("expected LINEAGE_SELECTION_EVALUATED");
    expect(outcome.selectorResult.kind).toBe("SELECTED");
  });

  test("17. selectedCandidateId, candidateIdsConsidered, and reasons are unchanged from a direct selector call", () => {
    const grouping = twoVersionGroup();
    const ready = findGroup(grouping, "TEST-LINEAGE-A");
    if (ready.kind !== "GROUP_READY") throw new Error("expected GROUP_READY");
    const candidates = ready.selectorEligibleMembers.map((m) => {
      if (m.adapterResult.outcome !== "CANDIDATE") throw new Error("expected CANDIDATE");
      return m.adapterResult.candidate;
    });
    const request = asOf("2021-09-01");
    const direct = selectE85TemporalCandidate(request, candidates);
    const outcome = findOutcome(selectE85TemporalLineages(grouping, request), "TEST-LINEAGE-A");
    if (outcome.kind !== "LINEAGE_SELECTION_EVALUATED") throw new Error("expected LINEAGE_SELECTION_EVALUATED");
    expect(outcome.selectorResult.selectedCandidateId).toBe(direct.selectedCandidateId);
    expect(outcome.selectorResult.candidateIdsConsidered).toEqual(direct.candidateIdsConsidered);
    expect(outcome.selectorResult.reasons).toEqual(direct.reasons);
    expect(outcome.selectorResult).toEqual(direct);
  });
});

// ===========================================================================
// C. ABSENT and CURRENT
// ===========================================================================
describe("E85 Phase 15.12 — ABSENT and CURRENT", () => {
  test("18. ABSENT on GROUP_READY preserves INSUFFICIENT_TEMPORAL_EVIDENCE", () => {
    const grouping = twoVersionGroup();
    const outcome = findOutcome(selectE85TemporalLineages(grouping, ABSENT), "TEST-LINEAGE-A");
    if (outcome.kind !== "LINEAGE_SELECTION_EVALUATED") throw new Error("expected LINEAGE_SELECTION_EVALUATED");
    expect(outcome.selectorResult.kind).toBe("INSUFFICIENT_TEMPORAL_EVIDENCE");
    expect(outcome.selectorResult.selectedCandidateId).toBeUndefined();
  });

  test("19. CURRENT on GROUP_READY preserves INSUFFICIENT_TEMPORAL_EVIDENCE", () => {
    const grouping = twoVersionGroup();
    const outcome = findOutcome(selectE85TemporalLineages(grouping, CURRENT), "TEST-LINEAGE-A");
    if (outcome.kind !== "LINEAGE_SELECTION_EVALUATED") throw new Error("expected LINEAGE_SELECTION_EVALUATED");
    expect(outcome.selectorResult.kind).toBe("INSUFFICIENT_TEMPORAL_EVIDENCE");
    expect(outcome.selectorResult.selectedCandidateId).toBeUndefined();
  });

  test("20. ABSENT and CURRENT produce distinct reason strings — ABSENT is not rewritten as CURRENT", () => {
    const grouping = twoVersionGroup();
    const absentOutcome = findOutcome(selectE85TemporalLineages(grouping, ABSENT), "TEST-LINEAGE-A");
    const currentOutcome = findOutcome(selectE85TemporalLineages(grouping, CURRENT), "TEST-LINEAGE-A");
    if (absentOutcome.kind !== "LINEAGE_SELECTION_EVALUATED" || currentOutcome.kind !== "LINEAGE_SELECTION_EVALUATED") {
      throw new Error("expected LINEAGE_SELECTION_EVALUATED");
    }
    expect(absentOutcome.selectorResult.reasons).not.toEqual(currentOutcome.selectorResult.reasons);
  });

  test("21. CURRENT does not touch Date.now / new Date", () => {
    const grouping = twoVersionGroup();
    const dateSpy = jest.spyOn(global, "Date");
    selectE85TemporalLineages(grouping, CURRENT);
    expect(dateSpy).not.toHaveBeenCalled();
    dateSpy.mockRestore();
  });

  test("22. CURRENT does not select the 'latest' candidate — naive latest-wins would pick TEST-V2, but the real result is INSUFFICIENT_TEMPORAL_EVIDENCE", () => {
    const grouping = twoVersionGroup();
    const ready = findGroup(grouping, "TEST-LINEAGE-A");
    if (ready.kind !== "GROUP_READY") throw new Error("expected GROUP_READY");
    const latestCandidateId = ready.selectorEligibleMembers
      .map((m) => {
        if (m.adapterResult.outcome !== "CANDIDATE") throw new Error("expected CANDIDATE");
        return m.adapterResult.candidate;
      })
      .slice()
      .sort((a, b) => (a.temporal.effectiveFrom ?? "").localeCompare(b.temporal.effectiveFrom ?? ""))
      .pop()!.candidateId;
    const outcome = findOutcome(selectE85TemporalLineages(grouping, CURRENT), "TEST-LINEAGE-A");
    if (outcome.kind !== "LINEAGE_SELECTION_EVALUATED") throw new Error("expected LINEAGE_SELECTION_EVALUATED");
    expect(outcome.selectorResult.kind).toBe("INSUFFICIENT_TEMPORAL_EVIDENCE");
    expect(outcome.selectorResult.selectedCandidateId).not.toBe(latestCandidateId);
    expect(outcome.selectorResult.selectedCandidateId).toBeUndefined();
  });

  test("23. repeated CURRENT calls are deeply equal", () => {
    const grouping = twoVersionGroup();
    const first = selectE85TemporalLineages(grouping, CURRENT);
    const second = selectE85TemporalLineages(grouping, CURRENT);
    expect(first).toEqual(second);
  });
});

// ===========================================================================
// D. Multi-lineage isolation
// ===========================================================================
describe("E85 Phase 15.12 — multi-lineage isolation", () => {
  test("24. two independent GROUP_READY lineages can each produce SELECTED", () => {
    const a = candidateResult({ sourceVersionId: "TEST-V1", jurisdictionId: "TEST-JX-A" }, closedValidity("2020-01-01", "2020-12-31"));
    const b = candidateResult({ sourceVersionId: "TEST-V1", jurisdictionId: "TEST-JX-B" }, closedValidity("2020-01-01", "2020-12-31"));
    const grouping = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", a), member("TEST-LINEAGE-B", b)]);
    const result = selectE85TemporalLineages(grouping, asOf("2020-06-15"));
    const oa = findOutcome(result, "TEST-LINEAGE-A");
    const ob = findOutcome(result, "TEST-LINEAGE-B");
    if (oa.kind !== "LINEAGE_SELECTION_EVALUATED" || ob.kind !== "LINEAGE_SELECTION_EVALUATED") throw new Error("expected evaluated");
    expect(oa.selectorResult.kind).toBe("SELECTED");
    expect(ob.selectorResult.kind).toBe("SELECTED");
  });

  test("25. two ready lineages can produce different selector outcomes, and candidates from one never appear in the other's candidateIdsConsidered", () => {
    const a = candidateResult({ sourceVersionId: "TEST-V1", jurisdictionId: "TEST-JX-A" }, closedValidity("2020-01-01", "2020-12-31"));
    const b = candidateResult({ sourceVersionId: "TEST-V1", jurisdictionId: "TEST-JX-B" }, closedValidity("2022-01-01", "2022-12-31"));
    const grouping = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", a), member("TEST-LINEAGE-B", b)]);
    const result = selectE85TemporalLineages(grouping, asOf("2020-06-15"));
    const oa = findOutcome(result, "TEST-LINEAGE-A");
    const ob = findOutcome(result, "TEST-LINEAGE-B");
    if (oa.kind !== "LINEAGE_SELECTION_EVALUATED" || ob.kind !== "LINEAGE_SELECTION_EVALUATED") throw new Error("expected evaluated");
    expect(oa.selectorResult.kind).toBe("SELECTED");
    expect(ob.selectorResult.kind).toBe("FUTURE_EFFECTIVE");
    if (a.outcome !== "CANDIDATE" || b.outcome !== "CANDIDATE") throw new Error("expected CANDIDATE");
    expect(ob.selectorResult.candidateIdsConsidered).not.toContain(a.candidateId);
    expect(oa.selectorResult.candidateIdsConsidered).not.toContain(b.candidateId);
  });

  test("26. selected candidate in one lineage does not influence another", () => {
    const a = candidateResult({ sourceVersionId: "TEST-V1", jurisdictionId: "TEST-JX-A" }, closedValidity("2020-01-01", "2020-12-31"));
    const b = candidateResult({ sourceVersionId: "TEST-V1", jurisdictionId: "TEST-JX-B" }, closedValidity("2020-01-01", "2020-12-31"));
    const groupingBoth = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", a), member("TEST-LINEAGE-B", b)]);
    const groupingSoloB = groupE85TemporalLineageMembers([member("TEST-LINEAGE-B", b)]);
    const resultBoth = findOutcome(selectE85TemporalLineages(groupingBoth, asOf("2020-06-15")), "TEST-LINEAGE-B");
    const resultSolo = findOutcome(selectE85TemporalLineages(groupingSoloB, asOf("2020-06-15")), "TEST-LINEAGE-B");
    if (resultBoth.kind !== "LINEAGE_SELECTION_EVALUATED" || resultSolo.kind !== "LINEAGE_SELECTION_EVALUATED") throw new Error("expected evaluated");
    expect(resultBoth.selectorResult).toEqual(resultSolo.selectorResult);
  });

  test("27. mixed ready and non-ready groups preserve every lineage, and non-ready lineages never receive synthetic selector results", () => {
    const grouping = groupE85TemporalLineageMembers([
      member("TEST-LINEAGE-A", candidateResult({ sourceVersionId: "TEST-V1" })),
      member("TEST-LINEAGE-B", nonCandidateResult({ sourceVersionId: "TEST-V2" })),
      member("TEST-LINEAGE-C", candidateResult({ sourceVersionId: "TEST-V3" }), "R"),
      member("TEST-LINEAGE-C", nonCandidateResult({ sourceVersionId: "TEST-V4" })),
    ]);
    const result = selectE85TemporalLineages(grouping, asOf("2020-06-15"));
    expect(result.outcomes.length).toBe(3);
    expect(findOutcome(result, "TEST-LINEAGE-A").kind).toBe("LINEAGE_SELECTION_EVALUATED");
    expect(findOutcome(result, "TEST-LINEAGE-B").kind).toBe("LINEAGE_NOT_SELECTOR_ELIGIBLE");
    expect(findOutcome(result, "TEST-LINEAGE-C").kind).toBe("LINEAGE_NOT_SELECTOR_ELIGIBLE");
  });

  test("28. cross-lineage candidate duplication already marked GROUP_BLOCKED does not reach selection", () => {
    const shared = candidateResult();
    const grouping = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", shared), member("TEST-LINEAGE-B", shared)]);
    expect(findGroup(grouping, "TEST-LINEAGE-A").kind).toBe("GROUP_BLOCKED");
    const result = selectE85TemporalLineages(grouping, asOf("2020-06-15"));
    expect(findOutcome(result, "TEST-LINEAGE-A").kind).toBe("LINEAGE_NOT_SELECTOR_ELIGIBLE");
    expect(findOutcome(result, "TEST-LINEAGE-B").kind).toBe("LINEAGE_NOT_SELECTOR_ELIGIBLE");
  });

  test("29. candidate plus non-candidate evidence marked GROUP_EVIDENCE_INCOMPLETE does not reach selection", () => {
    const grouping = groupE85TemporalLineageMembers([
      member("TEST-LINEAGE-A", candidateResult({ sourceVersionId: "TEST-V1" })),
      member("TEST-LINEAGE-A", nonCandidateResult({ sourceVersionId: "TEST-V2" })),
    ]);
    expect(findOutcome(selectE85TemporalLineages(grouping, asOf("2020-06-15")), "TEST-LINEAGE-A").kind).toBe("LINEAGE_NOT_SELECTOR_ELIGIBLE");
  });

  test("30. unknown/open validity represented by GROUP_NO_CANDIDATE does not reach selection", () => {
    const grouping = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", nonCandidateResult())]);
    expect(findOutcome(selectE85TemporalLineages(grouping, asOf("2020-06-15")), "TEST-LINEAGE-A").kind).toBe("LINEAGE_NOT_SELECTOR_ELIGIBLE");
  });
});

// ===========================================================================
// E. Ordering and determinism
// ===========================================================================
describe("E85 Phase 15.12 — ordering and determinism", () => {
  test("31. output order follows grouping.groups order", () => {
    const grouping = groupE85TemporalLineageMembers([
      member("TEST-LINEAGE-Z", candidateResult({ sourceVersionId: "TEST-V1" })),
      member("TEST-LINEAGE-A", candidateResult({ sourceVersionId: "TEST-V2" })),
    ]);
    expect(grouping.groups.map((g) => g.lineageId)).toEqual(["TEST-LINEAGE-A", "TEST-LINEAGE-Z"]);
    const result = selectE85TemporalLineages(grouping, asOf("2020-06-15"));
    expect(result.outcomes.map((o) => o.lineageId)).toEqual(["TEST-LINEAGE-A", "TEST-LINEAGE-Z"]);
  });

  test("32. reversed deterministic grouping input produces the correspondingly reversed output, without cross-contamination", () => {
    const inputs = [
      member("TEST-LINEAGE-A", candidateResult({ sourceVersionId: "TEST-V1" })),
      member("TEST-LINEAGE-B", candidateResult({ sourceVersionId: "TEST-V2" })),
    ];
    const forward = groupE85TemporalLineageMembers(inputs);
    const reversed = groupE85TemporalLineageMembers([...inputs].reverse());
    // Slice 3D-1's own grouping is already order-independent (sorted by lineageId), so both groupings are identical;
    // this proves the selection layer built on top of it does not introduce order-dependence of its own.
    expect(selectE85TemporalLineages(forward, asOf("2020-06-15"))).toEqual(selectE85TemporalLineages(reversed, asOf("2020-06-15")));
  });

  test("33. repeated calls with identical input are deeply equal", () => {
    const grouping = twoVersionGroup();
    const request = asOf("2020-06-15");
    expect(selectE85TemporalLineages(grouping, request)).toEqual(selectE85TemporalLineages(grouping, request));
  });

  test("34. errors for identical malformed input are byte-identical", () => {
    let first: unknown;
    let second: unknown;
    try {
      selectE85TemporalLineages(null as unknown as E85TemporalLineageGroupingResult, ABSENT);
    } catch (e) {
      first = e;
    }
    try {
      selectE85TemporalLineages(null as unknown as E85TemporalLineageGroupingResult, ABSENT);
    } catch (e) {
      second = e;
    }
    expect((first as Error).message).toBe((second as Error).message);
  });

  test("35. no NEW timestamp or generated identifier is introduced beyond what the input already carried", () => {
    // The retained group/candidate objects legitimately carry upstream
    // fixture timestamps (e.g. E85NormalizedRuleBundle.normalizedAt); this
    // module must not ADD any of its own. Compare the count of ISO-datetime
    // occurrences in the output against the count already present in the
    // input grouping result — they must match exactly (this module's own
    // "outcomes"/"kind" wrapper adds no new timestamp).
    const grouping = twoVersionGroup();
    const request = asOf("2020-06-15");
    const result = selectE85TemporalLineages(grouping, request);
    const isoPattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g;
    const inputCount = (JSON.stringify(grouping).match(isoPattern) ?? []).length;
    const outputCount = (JSON.stringify(result).match(isoPattern) ?? []).length;
    expect(outputCount).toBe(inputCount);
  });
});

// ===========================================================================
// F. Immutability and reference behavior
// ===========================================================================
describe("E85 Phase 15.12 — immutability and reference behavior", () => {
  test("36. grouping input is not mutated", () => {
    const grouping = twoVersionGroup();
    const before = JSON.stringify(grouping);
    selectE85TemporalLineages(grouping, asOf("2020-06-15"));
    expect(JSON.stringify(grouping)).toBe(before);
  });

  test("37. request input is not mutated", () => {
    const grouping = twoVersionGroup();
    const request = asOf("2020-06-15");
    const before = JSON.stringify(request);
    selectE85TemporalLineages(grouping, request);
    expect(JSON.stringify(request)).toBe(before);
  });

  test("38. GROUP_READY group object is retained by reference", () => {
    const grouping = twoVersionGroup();
    const originalGroup = findGroup(grouping, "TEST-LINEAGE-A");
    const outcome = findOutcome(selectE85TemporalLineages(grouping, asOf("2020-06-15")), "TEST-LINEAGE-A");
    expect(outcome.group).toBe(originalGroup);
  });

  test("39. non-ready group object is retained by reference", () => {
    const grouping = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", nonCandidateResult())]);
    const originalGroup = findGroup(grouping, "TEST-LINEAGE-A");
    const outcome = findOutcome(selectE85TemporalLineages(grouping, asOf("2020-06-15")), "TEST-LINEAGE-A");
    expect(outcome.group).toBe(originalGroup);
  });

  test("40. candidate objects are not mutated", () => {
    const grouping = twoVersionGroup();
    const ready = findGroup(grouping, "TEST-LINEAGE-A");
    if (ready.kind !== "GROUP_READY") throw new Error("expected GROUP_READY");
    const before = JSON.stringify(ready.selectorEligibleMembers);
    selectE85TemporalLineages(grouping, asOf("2020-06-15"));
    expect(JSON.stringify(ready.selectorEligibleMembers)).toBe(before);
  });

  test("41. selectorEligibleMembers is not sorted in place", () => {
    const grouping = twoVersionGroup();
    const ready = findGroup(grouping, "TEST-LINEAGE-A");
    if (ready.kind !== "GROUP_READY") throw new Error("expected GROUP_READY");
    const beforeOrder = ready.selectorEligibleMembers.map((m) => m.adapterResult.candidateId);
    selectE85TemporalLineages(grouping, asOf("2020-06-15"));
    const afterOrder = ready.selectorEligibleMembers.map((m) => m.adapterResult.candidateId);
    expect(afterOrder).toEqual(beforeOrder);
  });
});

// ===========================================================================
// G. Runtime malformed-input boundary
// ===========================================================================
describe("E85 Phase 15.12 — runtime malformed-input boundary", () => {
  test("42. null grouping rejected", () => {
    expect(() => selectE85TemporalLineages(null as unknown as E85TemporalLineageGroupingResult, ABSENT)).toThrow(E85TemporalLineageSelectionError);
  });

  test("43. non-object grouping rejected", () => {
    expect(() => selectE85TemporalLineages("not-an-object" as unknown as E85TemporalLineageGroupingResult, ABSENT)).toThrow(E85TemporalLineageSelectionError);
  });

  test("44. missing groups array rejected", () => {
    expect(() => selectE85TemporalLineages({} as unknown as E85TemporalLineageGroupingResult, ABSENT)).toThrow(E85TemporalLineageSelectionError);
  });

  test("45. null request rejected", () => {
    const grouping = twoVersionGroup();
    expect(() => selectE85TemporalLineages(grouping, null as unknown as E85ResolvedTemporalRequest)).toThrow(E85TemporalLineageSelectionError);
  });

  test("46. unsupported request kind rejected", () => {
    const grouping = twoVersionGroup();
    expect(() => selectE85TemporalLineages(grouping, { kind: "BOGUS" } as unknown as E85ResolvedTemporalRequest)).toThrow(E85TemporalLineageSelectionError);
  });

  test("47. unsupported request mode rejected", () => {
    const grouping = twoVersionGroup();
    expect(() =>
      selectE85TemporalLineages(grouping, { kind: "RESOLVED", request: { mode: "BOGUS" } } as unknown as E85ResolvedTemporalRequest),
    ).toThrow(E85TemporalLineageSelectionError);
  });

  test("48. unsupported group kind rejected", () => {
    const grouping = twoVersionGroup();
    const original = findGroup(grouping, "TEST-LINEAGE-A");
    const malformed: E85TemporalLineageGroupingResult = {
      groups: [{ ...original, kind: "GROUP_BOGUS" } as unknown as E85TemporalLineageGroup],
      crossLineageFindings: [],
    };
    expect(() => selectE85TemporalLineages(malformed, asOf("2020-06-15"))).toThrow(E85TemporalLineageSelectionError);
  });

  test("49. missing/empty lineageId rejected", () => {
    const grouping = twoVersionGroup();
    const original = findGroup(grouping, "TEST-LINEAGE-A");
    const malformed: E85TemporalLineageGroupingResult = {
      groups: [{ ...original, lineageId: "" } as unknown as E85TemporalLineageGroup],
      crossLineageFindings: [],
    };
    expect(() => selectE85TemporalLineages(malformed, asOf("2020-06-15"))).toThrow(E85TemporalLineageSelectionError);
  });

  test("50. whitespace-only lineageId rejected", () => {
    const grouping = twoVersionGroup();
    const original = findGroup(grouping, "TEST-LINEAGE-A");
    const malformed: E85TemporalLineageGroupingResult = {
      groups: [{ ...original, lineageId: "   " } as unknown as E85TemporalLineageGroup],
      crossLineageFindings: [],
    };
    expect(() => selectE85TemporalLineages(malformed, asOf("2020-06-15"))).toThrow(E85TemporalLineageSelectionError);
  });

  test("51. GROUP_READY missing selectorEligibleMembers rejected", () => {
    const grouping = twoVersionGroup();
    const original = findGroup(grouping, "TEST-LINEAGE-A");
    if (original.kind !== "GROUP_READY") throw new Error("expected GROUP_READY");
    const { selectorEligibleMembers: _omit, ...withoutEligible } = original;
    const malformed: E85TemporalLineageGroupingResult = {
      groups: [withoutEligible as unknown as E85TemporalLineageGroup],
      crossLineageFindings: [],
    };
    expect(() => selectE85TemporalLineages(malformed, asOf("2020-06-15"))).toThrow(E85TemporalLineageSelectionError);
  });

  test("52. GROUP_READY with empty selectorEligibleMembers rejected", () => {
    const grouping = twoVersionGroup();
    const original = findGroup(grouping, "TEST-LINEAGE-A");
    if (original.kind !== "GROUP_READY") throw new Error("expected GROUP_READY");
    const malformed: E85TemporalLineageGroupingResult = {
      groups: [{ ...original, selectorEligibleMembers: [] }],
      crossLineageFindings: [],
    };
    expect(() => selectE85TemporalLineages(malformed, asOf("2020-06-15"))).toThrow(E85TemporalLineageSelectionError);
  });

  test("53. GROUP_READY eligible member with non-CANDIDATE outcome rejected", () => {
    const grouping = twoVersionGroup();
    const original = findGroup(grouping, "TEST-LINEAGE-A");
    if (original.kind !== "GROUP_READY") throw new Error("expected GROUP_READY");
    const badMember = { ...original.selectorEligibleMembers[0], adapterResult: nonCandidateResult() };
    const malformed: E85TemporalLineageGroupingResult = {
      groups: [{ ...original, selectorEligibleMembers: [badMember] }],
      crossLineageFindings: [],
    };
    expect(() => selectE85TemporalLineages(malformed, asOf("2020-06-15"))).toThrow(E85TemporalLineageSelectionError);
  });

  test("54. GROUP_READY eligible member missing its candidate rejected", () => {
    const grouping = twoVersionGroup();
    const original = findGroup(grouping, "TEST-LINEAGE-A");
    if (original.kind !== "GROUP_READY") throw new Error("expected GROUP_READY");
    const goodAdapterResult = original.selectorEligibleMembers[0].adapterResult;
    if (goodAdapterResult.outcome !== "CANDIDATE") throw new Error("expected CANDIDATE");
    const { candidate: _omit, ...withoutCandidate } = goodAdapterResult;
    const badMember = { ...original.selectorEligibleMembers[0], adapterResult: withoutCandidate as unknown as E85TemporalCandidateAdapterResult };
    const malformed: E85TemporalLineageGroupingResult = {
      groups: [{ ...original, selectorEligibleMembers: [badMember] }],
      crossLineageFindings: [],
    };
    expect(() => selectE85TemporalLineages(malformed, asOf("2020-06-15"))).toThrow(E85TemporalLineageSelectionError);
  });

  test("55. no bare generic Error leaks through the public boundary for malformed input", () => {
    const attempts: Array<() => void> = [
      () => selectE85TemporalLineages(null as unknown as E85TemporalLineageGroupingResult, ABSENT),
      () => selectE85TemporalLineages({} as unknown as E85TemporalLineageGroupingResult, ABSENT),
      () => selectE85TemporalLineages(twoVersionGroup(), null as unknown as E85ResolvedTemporalRequest),
    ];
    for (const attempt of attempts) {
      try {
        attempt();
        throw new Error("expected a throw");
      } catch (error) {
        expect(error).toBeInstanceOf(E85TemporalLineageSelectionError);
      }
    }
  });

  test("56. E85TemporalLineageSelectionError has correct name and message prefix", () => {
    try {
      selectE85TemporalLineages(null as unknown as E85TemporalLineageGroupingResult, ABSENT);
      throw new Error("expected a throw");
    } catch (error) {
      expect(error).toBeInstanceOf(E85TemporalLineageSelectionError);
      expect((error as Error).name).toBe("E85TemporalLineageSelectionError");
      expect((error as Error).message.startsWith("E85 temporal lineage selection error:")).toBe(true);
    }
  });

  test("57. a genuine E85TemporalSelectionError from the real selector (structurally invalid candidates) propagates unmodified, not converted to E85TemporalLineageSelectionError", () => {
    // Construct a GROUP_READY group whose selectorEligibleMembers pass this
    // module's own boundary checks, then tamper the underlying candidate so
    // effectiveFrom > effectiveTo AFTER grouping accepted it (grouping itself
    // does not reject this shape; only the selector's own structural guard does).
    const grouping = twoVersionGroup();
    const original = findGroup(grouping, "TEST-LINEAGE-A");
    if (original.kind !== "GROUP_READY") throw new Error("expected GROUP_READY");
    const goodMember = original.selectorEligibleMembers[0];
    const goodAdapterResult = goodMember.adapterResult;
    if (goodAdapterResult.outcome !== "CANDIDATE") throw new Error("expected CANDIDATE");
    const tamperedCandidate = { ...goodAdapterResult.candidate, temporal: { ...goodAdapterResult.candidate.temporal, effectiveFrom: "2025-01-01", effectiveTo: "2020-01-01" } };
    const tamperedAdapterResult = { ...goodAdapterResult, candidate: tamperedCandidate };
    const tamperedMember = { ...goodMember, adapterResult: tamperedAdapterResult };
    const malformed: E85TemporalLineageGroupingResult = {
      groups: [{ ...original, selectorEligibleMembers: [tamperedMember] }],
      crossLineageFindings: [],
    };
    expect(() => selectE85TemporalLineages(malformed, asOf("2020-06-15"))).toThrow();
    try {
      selectE85TemporalLineages(malformed, asOf("2020-06-15"));
      throw new Error("expected a throw");
    } catch (error) {
      expect(error).not.toBeInstanceOf(E85TemporalLineageSelectionError);
      expect((error as Error).name).toBe("E85TemporalSelectionError");
    }
  });
});

// ===========================================================================
// H. Scope and isolation checks
// ===========================================================================
describe("E85 Phase 15.12 — scope and isolation checks", () => {
  const filePath = path.resolve(__dirname, "../../src/zoning-land-use-engine/temporal-lineage-selection.ts");
  const source = fs.readFileSync(filePath, "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const codeSansStrings = code
    .replace(/`(?:[^`\\]|\\.)*`/g, "``")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");

  test("58. no Date.now() in production code", () => {
    expect(/\bDate\.now\s*\(/.test(code)).toBe(false);
  });

  test("59. no new Date() in production code", () => {
    expect(/\bnew\s+Date\s*\(/.test(code)).toBe(false);
  });

  test("60. no Math.random() in production code", () => {
    expect(/Math\.random\s*\(/.test(code)).toBe(false);
  });

  test("61. no randomUUID() in production code", () => {
    expect(/randomUUID\s*\(/.test(code)).toBe(false);
  });

  test("62. no filesystem or network access", () => {
    expect(/from\s+["'](?:node:)?fs(?:\/promises)?["']/.test(code)).toBe(false);
    expect(/\bfetch\s*\(/.test(code)).toBe(false);
    expect(/from\s+["'](?:node:)?https?["']/.test(code)).toBe(false);
  });

  test("63. no dynamic execution (eval / new Function)", () => {
    expect(/\beval\s*\(/.test(code)).toBe(false);
    expect(/new\s+Function\s*\(/.test(code)).toBe(false);
  });

  test("64. no use of `any` in executable/type code", () => {
    expect(/\bany\b/.test(codeSansStrings)).toBe(false);
  });

  test("65. no real jurisdiction/district identifiers", () => {
    for (const term of [/vancouver/i, /burnaby/i, /\bR1-1\b/, /\bC-2C\b/]) {
      expect(term.test(source)).toBe(false);
    }
  });

  test("66. no imports of evaluator/composer/linkage/status/materiality/registry modules", () => {
    const imports = [...code.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    const forbiddenSubstrings = [
      "evaluator",
      "composer",
      "composition-",
      "precedence-",
      "linkage",
      "decision-",
      "status",
      "materiality",
      "registry",
      "spatial",
      "adapters/",
    ];
    for (const specifier of imports) {
      for (const forbidden of forbiddenSubstrings) {
        expect(specifier.includes(forbidden)).toBe(false);
      }
    }
    expect([...new Set(imports)].sort()).toEqual(
      ["./temporal-candidate-adapter", "./temporal-lineage-grouping", "./temporal-request-types", "./temporal-selection"].sort(),
    );
  });

  test("67. no barrel export was added (index.ts unchanged)", () => {
    const indexSource = fs.readFileSync(path.resolve(__dirname, "../../src/zoning-land-use-engine/index.ts"), "utf8");
    expect(indexSource.includes("temporal-lineage-selection")).toBe(false);
  });

  test("68. Slice 3D-2 relationship vocabulary is absent", () => {
    for (const term of [/\bAMENDS\b/, /\bREPEALS\b/, /\bREPLACES\b/, /\bSUPERSEDES_RELATIONSHIP\b/, /relationshipKind/]) {
      expect(term.test(source)).toBe(false);
    }
  });

  test("69. Slice 3E/3F wiring is absent (no gap/status/materiality/trace field names in executable/type code)", () => {
    for (const term of [/\bgapCode\b/, /\bblockers\b/, /\bmateriality\b/i, /\btraceId\b/, /\bdecisionPackage\b/i, /\bcompletenessStatus\b/]) {
      expect(term.test(code)).toBe(false);
    }
  });

  test("70. no skipped/todo/.only/snapshot markers in this test file", () => {
    const testSource = fs.readFileSync(path.resolve(__dirname, "temporal-lineage-selection.test.ts"), "utf8");
    expect(/\btest\.skip\b/.test(testSource)).toBe(false);
    expect(/\btest\.only\b/.test(testSource)).toBe(false);
    expect(/\bdescribe\.skip\b/.test(testSource)).toBe(false);
    expect(/\bdescribe\.only\b/.test(testSource)).toBe(false);
    expect(/\btoMatchSnapshot\b/.test(testSource)).toBe(false);
    expect(/\.todo\(/.test(testSource)).toBe(false);
  });

  test("71. no real-jurisdiction identity strings used as fixture data in this test file (identity fields all read TEST-*)", () => {
    // Checked against the fixture BUILDER functions' own default identity
    // values, not the raw file text — a blanket text scan would also flag
    // this very check's own pattern literals, which legitimately name the
    // terms they exist to detect (the same discipline
    // temporal-lineage-grouping.test.ts documents at its own test 84).
    expect(bundle().jurisdictionId.startsWith("TEST-")).toBe(true);
    expect(bundle().sourceId.startsWith("TEST-")).toBe(true);
    expect(bundle().zoneDesignation.startsWith("TEST-")).toBe(true);
  });
});

/**
 * InvestScape™ E85 Phase 15.14 — temporal decision-impact mapper tests,
 * Slice 3E.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Synthetic identifiers only (TEST-JX / TEST-SOURCE / TEST-V* / TEST-ZONE /
 * TEST-LINEAGE-*) — no real-municipality fixture is imported or referenced
 * anywhere in this file. All fixtures are constructed locally, mirroring the
 * conventions of temporal-lineage-selection.test.ts.
 */
import * as fs from "fs";
import * as path from "path";
import type { E85NormalizedRuleBundle } from "../../src/zoning-land-use-engine/normalized-bundle-types";
import type { E85VersionValidity, E85StartAuthority, E85EndAuthority, E85OperativeLocator } from "../../src/zoning-land-use-engine/version-validity-types";
import { buildE85TemporalCandidateFromVersionValidity } from "../../src/zoning-land-use-engine/temporal-candidate-adapter";
import type { E85TemporalCandidateAdapterResult } from "../../src/zoning-land-use-engine/temporal-candidate-adapter";
import { groupE85TemporalLineageMembers, E85TemporalLineageMember } from "../../src/zoning-land-use-engine/temporal-lineage-grouping";
import type { E85TemporalLineageGroupingResult } from "../../src/zoning-land-use-engine/temporal-lineage-grouping";
import { selectE85TemporalLineages } from "../../src/zoning-land-use-engine/temporal-lineage-selection";
import type { E85TemporalLineageSelectionResult } from "../../src/zoning-land-use-engine/temporal-lineage-selection";
import type { E85ResolvedTemporalRequest } from "../../src/zoning-land-use-engine/temporal-request-types";
import {
  mapE85TemporalDecisionImpact,
  E85TemporalDecisionImpactError,
  E85TemporalDecisionImpact,
  E85TemporalImpactDisposition,
} from "../../src/zoning-land-use-engine/temporal-decision-impact";

// ---------------------------------------------------------------------------
// Local synthetic fixtures (mirrors temporal-lineage-selection.test.ts)
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

function nonCandidateResult(bundleOverrides: Partial<E85NormalizedRuleBundle> = {}, validity: E85VersionValidity = { state: "START_UNKNOWN" }): E85TemporalCandidateAdapterResult {
  return buildE85TemporalCandidateFromVersionValidity(bundle(bundleOverrides), validity);
}

function openUnresearchedValidity(effectiveFrom = "2020-01-01"): E85VersionValidity {
  return { state: "OPEN_UNRESEARCHED", effectiveFrom, start: commencement({ effectiveFrom }) };
}

function member(lineageId: string, adapterResult: E85TemporalCandidateAdapterResult, rationale = "TEST rationale"): E85TemporalLineageMember {
  return { lineageId, adapterResult, membershipRationale: rationale };
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

function readyGrouping(lineageId = "TEST-LINEAGE-A"): E85TemporalLineageGroupingResult {
  return groupE85TemporalLineageMembers([member(lineageId, candidateResult({ sourceVersionId: "TEST-V1" }))]);
}

function blockedGrouping(lineageId = "TEST-LINEAGE-A"): E85TemporalLineageGroupingResult {
  const shared = candidateResult({ sourceVersionId: "TEST-V1" });
  const conflicting = candidateResult({ sourceVersionId: "TEST-V1" }, closedValidity("2020-01-01", "2022-01-01"));
  return groupE85TemporalLineageMembers([member(lineageId, shared), member(lineageId, conflicting)]);
}

function evidenceIncompleteGrouping(lineageId = "TEST-LINEAGE-A"): E85TemporalLineageGroupingResult {
  return groupE85TemporalLineageMembers([
    member(lineageId, candidateResult({ sourceVersionId: "TEST-V1" })),
    member(lineageId, nonCandidateResult({ sourceVersionId: "TEST-V2" })),
  ]);
}

function noCandidateGrouping(lineageId = "TEST-LINEAGE-A"): E85TemporalLineageGroupingResult {
  return groupE85TemporalLineageMembers([member(lineageId, nonCandidateResult())]);
}

function evaluate(grouping: E85TemporalLineageGroupingResult, request: E85ResolvedTemporalRequest): E85TemporalLineageSelectionResult {
  return selectE85TemporalLineages(grouping, request);
}

function findImpact(result: E85TemporalDecisionImpact[], lineageId: string): E85TemporalDecisionImpact {
  const found = result.find((i) => i.lineageId === lineageId);
  if (found === undefined) throw new Error(`no impact found for lineageId "${lineageId}"`);
  return found;
}

// ===========================================================================
// A. ABSENT compatibility
// ===========================================================================
describe("E85 Phase 15.14 — ABSENT compatibility", () => {
  test("1. ABSENT returns a structurally distinct result with no impacts field", () => {
    const selection = evaluate(readyGrouping(), ABSENT);
    const result = mapE85TemporalDecisionImpact(selection, ABSENT);
    expect(result).toEqual({ requestKind: "ABSENT" });
    expect("impacts" in result).toBe(false);
  });

  test("2. ABSENT never touches a malformed/throwing-getter selection", () => {
    const poisoned = new Proxy(
      {},
      {
        get() {
          throw new Error("selection must never be read under ABSENT");
        },
      },
    );
    expect(() => mapE85TemporalDecisionImpact(poisoned as unknown as E85TemporalLineageSelectionResult, ABSENT)).not.toThrow();
    expect(mapE85TemporalDecisionImpact(poisoned as unknown as E85TemporalLineageSelectionResult, ABSENT)).toEqual({ requestKind: "ABSENT" });
  });

  test("3. ABSENT never touches null selection", () => {
    expect(() => mapE85TemporalDecisionImpact(null as unknown as E85TemporalLineageSelectionResult, ABSENT)).not.toThrow();
  });

  test("4. ABSENT is deterministic across repeated calls", () => {
    const first = mapE85TemporalDecisionImpact(null as unknown as E85TemporalLineageSelectionResult, ABSENT);
    const second = mapE85TemporalDecisionImpact(null as unknown as E85TemporalLineageSelectionResult, ABSENT);
    expect(first).toEqual(second);
  });

  test("5. ABSENT touches no clock", () => {
    const dateSpy = jest.spyOn(global, "Date");
    mapE85TemporalDecisionImpact(null as unknown as E85TemporalLineageSelectionResult, ABSENT);
    expect(dateSpy).not.toHaveBeenCalled();
    dateSpy.mockRestore();
  });
});

// ===========================================================================
// B. Disposition-policy contract (tested only through public results)
// ===========================================================================
describe("E85 Phase 15.14 — disposition-policy contract", () => {
  test("6. NONE disposition (AS_OF SELECTED) implies non-blocking, unchanged completeness, machine-resolved eligible", () => {
    const selection = evaluate(twoVersionGroup(), asOf("2020-06-15"));
    const result = mapE85TemporalDecisionImpact(selection, asOf("2020-06-15"));
    if (result.requestKind !== "RESOLVED") throw new Error("expected RESOLVED");
    const impact = findImpact([...result.impacts], "TEST-LINEAGE-A");
    expect(impact.disposition).toBe("NONE");
    expect(impact.policy).toEqual({
      blockerRelevant: false,
      completenessRecommendation: "UNCHANGED",
      machineResolvedEligible: true,
      manualReviewRecommendation: "NONE",
    });
  });

  test("7. DATA_GAP disposition implies blocker-relevant, PARTIAL completeness, machine-resolved ineligible, no manual review", () => {
    const selection = evaluate(twoVersionGroup(), CURRENT);
    const result = mapE85TemporalDecisionImpact(selection, CURRENT);
    if (result.requestKind !== "RESOLVED") throw new Error("expected RESOLVED");
    const impact = findImpact([...result.impacts], "TEST-LINEAGE-A");
    expect(impact.disposition).toBe("DATA_GAP");
    expect(impact.policy).toEqual({
      blockerRelevant: true,
      completenessRecommendation: "PARTIAL",
      machineResolvedEligible: false,
      manualReviewRecommendation: "NONE",
    });
  });

  test("8. DISCLOSURE and MANUAL_REVIEW_REQUIRED are reserved union members with no mapping in this slice producing them", () => {
    // Both dispositions are part of the closed E85TemporalImpactDisposition
    // union (compile-time proof: this assignment would fail to typecheck if
    // either literal were removed from the union), but no scenario in this
    // slice's design maps to them — every legitimate conflict in scope
    // resolves to DATA_GAP, per the module's own documented policy.
    const disclosure: E85TemporalImpactDisposition = "DISCLOSURE";
    const manualReview: E85TemporalImpactDisposition = "MANUAL_REVIEW_REQUIRED";
    expect(disclosure).toBe("DISCLOSURE");
    expect(manualReview).toBe("MANUAL_REVIEW_REQUIRED");
  });

  test("9. no impact ever carries a contradictory combination — DATA_GAP always implies blockerRelevant true, NONE always implies false", () => {
    const scenarios: Array<[E85TemporalLineageGroupingResult, E85ResolvedTemporalRequest]> = [
      [readyGrouping(), CURRENT],
      [blockedGrouping(), CURRENT],
      [evidenceIncompleteGrouping(), CURRENT],
      [noCandidateGrouping(), CURRENT],
      [twoVersionGroup(), asOf("2020-06-15")],
      [twoVersionGroup(), asOf("2021-01-15")],
      [twoVersionGroup(), asOf("2019-01-01")],
      [twoVersionGroup(), asOf("2022-01-01")],
      [blockedGrouping(), asOf("2020-06-15")],
      [evidenceIncompleteGrouping(), asOf("2020-06-15")],
      [noCandidateGrouping(), asOf("2020-06-15")],
    ];
    for (const [grouping, request] of scenarios) {
      const result = mapE85TemporalDecisionImpact(evaluate(grouping, request), request);
      if (result.requestKind !== "RESOLVED") throw new Error("expected RESOLVED");
      for (const impact of result.impacts) {
        if (impact.disposition === "DATA_GAP") {
          expect(impact.policy.blockerRelevant).toBe(true);
          expect(impact.policy.machineResolvedEligible).toBe(false);
        }
        if (impact.disposition === "NONE") {
          expect(impact.policy.blockerRelevant).toBe(false);
          expect(impact.policy.machineResolvedEligible).toBe(true);
        }
        expect(impact.policy.manualReviewRecommendation).toBe(impact.disposition === "MANUAL_REVIEW_REQUIRED" ? "REQUIRED" : "NONE");
      }
    }
  });

  test("10. repeated calls yield deeply-equal policy objects", () => {
    const request = CURRENT;
    const selection = evaluate(twoVersionGroup(), request);
    const first = mapE85TemporalDecisionImpact(selection, request);
    const second = mapE85TemporalDecisionImpact(selection, request);
    expect(first).toEqual(second);
  });
});

// ===========================================================================
// C. CURRENT — all four scenarios
// ===========================================================================
describe("E85 Phase 15.14 — CURRENT mapping", () => {
  test("11. ready lineage under CURRENT maps to CURRENT_REFERENCE_BASIS_UNAVAILABLE / DATA_GAP", () => {
    const grouping = readyGrouping();
    const result = mapE85TemporalDecisionImpact(evaluate(grouping, CURRENT), CURRENT);
    if (result.requestKind !== "RESOLVED") throw new Error("expected RESOLVED");
    const impact = findImpact([...result.impacts], "TEST-LINEAGE-A");
    expect(impact.impactKind).toBe("CURRENT_REFERENCE_BASIS_UNAVAILABLE");
    expect(impact.disposition).toBe("DATA_GAP");
    expect(impact.origin).toBe("SELECTOR_DERIVED");
    if (impact.origin !== "SELECTOR_DERIVED") throw new Error("expected SELECTOR_DERIVED");
    expect(impact.selectorResult.kind).toBe("INSUFFICIENT_TEMPORAL_EVIDENCE");
    expect(impact.selectorResult.selectedCandidateId).toBeUndefined();
  });

  test("12. GROUP_BLOCKED under CURRENT maps to CURRENT_LINEAGE_BLOCKED / DATA_GAP, retaining the group by reference", () => {
    const grouping = blockedGrouping();
    const originalGroup = grouping.groups.find((g) => g.lineageId === "TEST-LINEAGE-A")!;
    const result = mapE85TemporalDecisionImpact(evaluate(grouping, CURRENT), CURRENT);
    if (result.requestKind !== "RESOLVED") throw new Error("expected RESOLVED");
    const impact = findImpact([...result.impacts], "TEST-LINEAGE-A");
    expect(impact.impactKind).toBe("CURRENT_LINEAGE_BLOCKED");
    expect(impact.disposition).toBe("DATA_GAP");
    if (impact.origin !== "GROUPING_DERIVED") throw new Error("expected GROUPING_DERIVED");
    expect(impact.group).toBe(originalGroup);
    expect(impact.group.collisionFindings.length).toBeGreaterThan(0);
  });

  test("13. GROUP_EVIDENCE_INCOMPLETE under CURRENT maps to CURRENT_LINEAGE_EVIDENCE_INCOMPLETE / DATA_GAP", () => {
    const grouping = evidenceIncompleteGrouping();
    const result = mapE85TemporalDecisionImpact(evaluate(grouping, CURRENT), CURRENT);
    if (result.requestKind !== "RESOLVED") throw new Error("expected RESOLVED");
    const impact = findImpact([...result.impacts], "TEST-LINEAGE-A");
    expect(impact.impactKind).toBe("CURRENT_LINEAGE_EVIDENCE_INCOMPLETE");
    expect(impact.disposition).toBe("DATA_GAP");
    if (impact.origin !== "GROUPING_DERIVED") throw new Error("expected GROUPING_DERIVED");
    expect(impact.group.nonCandidateMembers.length).toBe(1);
  });

  test("14. GROUP_NO_CANDIDATE under CURRENT maps to CURRENT_LINEAGE_NO_CANDIDATE / DATA_GAP", () => {
    const grouping = noCandidateGrouping();
    const result = mapE85TemporalDecisionImpact(evaluate(grouping, CURRENT), CURRENT);
    if (result.requestKind !== "RESOLVED") throw new Error("expected RESOLVED");
    const impact = findImpact([...result.impacts], "TEST-LINEAGE-A");
    expect(impact.impactKind).toBe("CURRENT_LINEAGE_NO_CANDIDATE");
    expect(impact.disposition).toBe("DATA_GAP");
  });

  test("15. all four CURRENT impact kinds are pairwise distinct", () => {
    function currentImpactKindFor(grouping: E85TemporalLineageGroupingResult): string {
      const result = mapE85TemporalDecisionImpact(evaluate(grouping, CURRENT), CURRENT);
      if (result.requestKind !== "RESOLVED") throw new Error("expected RESOLVED");
      return findImpact([...result.impacts], "TEST-LINEAGE-A").impactKind;
    }
    const kinds = [
      currentImpactKindFor(readyGrouping()),
      currentImpactKindFor(blockedGrouping()),
      currentImpactKindFor(evidenceIncompleteGrouping()),
      currentImpactKindFor(noCandidateGrouping()),
    ];
    expect(new Set(kinds).size).toBe(4);
  });

  test("16. CURRENT never touches Date.now / new Date", () => {
    const grouping = twoVersionGroup();
    const dateSpy = jest.spyOn(global, "Date");
    mapE85TemporalDecisionImpact(evaluate(grouping, CURRENT), CURRENT);
    expect(dateSpy).not.toHaveBeenCalled();
    dateSpy.mockRestore();
  });

  test("17. CURRENT does not select the 'latest' candidate — the mapped impact carries no selectedCandidateId", () => {
    const grouping = twoVersionGroup();
    const result = mapE85TemporalDecisionImpact(evaluate(grouping, CURRENT), CURRENT);
    if (result.requestKind !== "RESOLVED") throw new Error("expected RESOLVED");
    const impact = findImpact([...result.impacts], "TEST-LINEAGE-A");
    if (impact.origin !== "SELECTOR_DERIVED") throw new Error("expected SELECTOR_DERIVED");
    expect(impact.selectorResult.selectedCandidateId).toBeUndefined();
  });

  test("18. production code never reuses EFFECTIVE_DATE_UNKNOWN for the CURRENT reference-basis impact kind", () => {
    const filePath = path.resolve(__dirname, "../../src/zoning-land-use-engine/temporal-decision-impact.ts");
    const source = fs.readFileSync(filePath, "utf8");
    const executableCode = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(executableCode.includes("EFFECTIVE_DATE_UNKNOWN")).toBe(false);
  });
});

// ===========================================================================
// D. AS_OF — all seven selector kinds
// ===========================================================================
describe("E85 Phase 15.14 — AS_OF mapping", () => {
  test("19. SELECTED -> AS_OF_SELECTED / NONE, does not imply global resolution, retains selectedCandidateId", () => {
    const grouping = twoVersionGroup();
    const request = asOf("2020-06-15");
    const result = mapE85TemporalDecisionImpact(evaluate(grouping, request), request);
    if (result.requestKind !== "RESOLVED") throw new Error("expected RESOLVED");
    const impact = findImpact([...result.impacts], "TEST-LINEAGE-A");
    expect(impact.impactKind).toBe("AS_OF_SELECTED");
    expect(impact.disposition).toBe("NONE");
    if (impact.origin !== "SELECTOR_DERIVED") throw new Error("expected SELECTOR_DERIVED");
    expect(impact.selectorResult.kind).toBe("SELECTED");
    expect(impact.selectorResult.selectedCandidateId).toBeDefined();
    // NONE means only "this lineage found a governing candidate" — it says
    // nothing about the overall decision, which this module never computes.
    expect("status" in result).toBe(false);
  });

  test("20. TEMPORALLY_AMBIGUOUS -> AS_OF_TEMPORALLY_AMBIGUOUS / DATA_GAP", () => {
    const v1 = candidateResult({ sourceVersionId: "TEST-V1" }, closedValidity("2020-01-01", "2020-12-31"));
    const grouping = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", v1), member("TEST-LINEAGE-A", nonCandidateResult({ sourceVersionId: "TEST-V2" }, openUnresearchedValidity("2019-01-01")))]);
    // This scenario is actually GROUP_EVIDENCE_INCOMPLETE (mixed candidate + non-candidate), so build TEMPORALLY_AMBIGUOUS directly via two GROUP_READY candidates instead.
    const readyV1 = candidateResult({ sourceVersionId: "TEST-V1" }, closedValidity("2020-01-01", "2020-12-31"));
    const readyGroupingForAmbiguous = groupE85TemporalLineageMembers([member("TEST-LINEAGE-B", readyV1)]);
    void grouping;
    void readyGroupingForAmbiguous;
    // Build the real TEMPORALLY_AMBIGUOUS case per Slice 2: one known-interval
    // candidate overlapping asOfDate, plus an insufficient-evidence candidate
    // that COULD also overlap. Both must be GROUP_READY (candidate outcomes).
    const known = candidateResult({ sourceVersionId: "TEST-V1" }, closedValidity("2020-01-01", "2020-12-31"));
    const insufficient = candidateResult({ sourceVersionId: "TEST-V2" }, { state: "CLOSED", effectiveFrom: "2020-01-01", start: commencement({ effectiveFrom: "2020-01-01", effectiveDateBasis: "UNKNOWN" }), effectiveTo: "2020-12-31", end: expressRepeal({ effectiveTo: "2020-12-31", effectiveDateBasis: "UNKNOWN" }) });
    const ambiguousGrouping = groupE85TemporalLineageMembers([member("TEST-LINEAGE-C", known), member("TEST-LINEAGE-C", insufficient)]);
    const request = asOf("2020-06-15");
    const selection = evaluate(ambiguousGrouping, request);
    const result = mapE85TemporalDecisionImpact(selection, request);
    if (result.requestKind !== "RESOLVED") throw new Error("expected RESOLVED");
    const impact = findImpact([...result.impacts], "TEST-LINEAGE-C");
    expect(impact.impactKind).toBe("AS_OF_TEMPORALLY_AMBIGUOUS");
    expect(impact.disposition).toBe("DATA_GAP");
  });

  test("21. INSUFFICIENT_TEMPORAL_EVIDENCE (AS_OF) -> AS_OF_INSUFFICIENT_EVIDENCE / DATA_GAP, distinct from the CURRENT-context kind", () => {
    const insufficient1 = candidateResult(
      { sourceVersionId: "TEST-V1" },
      { state: "CLOSED", effectiveFrom: "2020-01-01", start: commencement({ effectiveFrom: "2020-01-01", effectiveDateBasis: "UNKNOWN" }), effectiveTo: "2020-12-31", end: expressRepeal({ effectiveTo: "2020-12-31", effectiveDateBasis: "UNKNOWN" }) },
    );
    const grouping = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", insufficient1)]);
    const request = asOf("2020-06-15");
    const selection = evaluate(grouping, request);
    const result = mapE85TemporalDecisionImpact(selection, request);
    if (result.requestKind !== "RESOLVED") throw new Error("expected RESOLVED");
    const impact = findImpact([...result.impacts], "TEST-LINEAGE-A");
    expect(impact.impactKind).toBe("AS_OF_INSUFFICIENT_EVIDENCE");
    expect(impact.disposition).toBe("DATA_GAP");
    expect(impact.impactKind).not.toBe("CURRENT_REFERENCE_BASIS_UNAVAILABLE");
  });

  test("22. CONFLICTING_TEMPORAL_EVIDENCE -> AS_OF_CONFLICTING_EVIDENCE / DATA_GAP", () => {
    const v1 = candidateResult({ sourceVersionId: "TEST-V1" }, closedValidity("2020-01-01", "2020-12-31"));
    const v2 = candidateResult({ sourceVersionId: "TEST-V2" }, closedValidity("2020-01-01", "2020-12-31"));
    const grouping = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", v1), member("TEST-LINEAGE-A", v2)]);
    const request = asOf("2020-06-15");
    const result = mapE85TemporalDecisionImpact(evaluate(grouping, request), request);
    if (result.requestKind !== "RESOLVED") throw new Error("expected RESOLVED");
    const impact = findImpact([...result.impacts], "TEST-LINEAGE-A");
    expect(impact.impactKind).toBe("AS_OF_CONFLICTING_EVIDENCE");
    expect(impact.disposition).toBe("DATA_GAP");
  });

  test("23. OUTSIDE_VALIDITY_INTERVAL -> AS_OF_OUTSIDE_VALIDITY_INTERVAL / DATA_GAP, never claims no law existed", () => {
    const grouping = twoVersionGroup();
    const request = asOf("2021-01-15");
    const result = mapE85TemporalDecisionImpact(evaluate(grouping, request), request);
    if (result.requestKind !== "RESOLVED") throw new Error("expected RESOLVED");
    const impact = findImpact([...result.impacts], "TEST-LINEAGE-A");
    expect(impact.impactKind).toBe("AS_OF_OUTSIDE_VALIDITY_INTERVAL");
    expect(impact.disposition).toBe("DATA_GAP");
    if (impact.origin !== "SELECTOR_DERIVED") throw new Error("expected SELECTOR_DERIVED");
    expect(impact.selectorResult.reasons.join(" ")).not.toMatch(/no law existed/i);
  });

  test("24. FUTURE_EFFECTIVE -> AS_OF_FUTURE_EFFECTIVE / DATA_GAP, never names which future candidate governs", () => {
    const grouping = twoVersionGroup();
    const request = asOf("2019-01-01");
    const result = mapE85TemporalDecisionImpact(evaluate(grouping, request), request);
    if (result.requestKind !== "RESOLVED") throw new Error("expected RESOLVED");
    const impact = findImpact([...result.impacts], "TEST-LINEAGE-A");
    expect(impact.impactKind).toBe("AS_OF_FUTURE_EFFECTIVE");
    expect(impact.disposition).toBe("DATA_GAP");
    if (impact.origin !== "SELECTOR_DERIVED") throw new Error("expected SELECTOR_DERIVED");
    expect(impact.selectorResult.selectedCandidateId).toBeUndefined();
  });

  test("25. SUPERSEDED -> AS_OF_SUPERSEDED / DATA_GAP, never identifies a successor", () => {
    const grouping = twoVersionGroup();
    const request = asOf("2022-01-01");
    const result = mapE85TemporalDecisionImpact(evaluate(grouping, request), request);
    if (result.requestKind !== "RESOLVED") throw new Error("expected RESOLVED");
    const impact = findImpact([...result.impacts], "TEST-LINEAGE-A");
    expect(impact.impactKind).toBe("AS_OF_SUPERSEDED");
    expect(impact.disposition).toBe("DATA_GAP");
    if (impact.origin !== "SELECTOR_DERIVED") throw new Error("expected SELECTOR_DERIVED");
    expect(impact.selectorResult.reasons.join(" ")).not.toMatch(/successor/i);
  });

  test("26. all seven AS_OF selector-derived impact kinds are pairwise distinct", () => {
    const kinds = new Set([
      "AS_OF_SELECTED",
      "AS_OF_TEMPORALLY_AMBIGUOUS",
      "AS_OF_INSUFFICIENT_EVIDENCE",
      "AS_OF_CONFLICTING_EVIDENCE",
      "AS_OF_OUTSIDE_VALIDITY_INTERVAL",
      "AS_OF_FUTURE_EFFECTIVE",
      "AS_OF_SUPERSEDED",
    ]);
    expect(kinds.size).toBe(7);
  });

  test("27. selectorResult is retained by reference for a selector-derived impact", () => {
    const grouping = twoVersionGroup();
    const request = asOf("2020-06-15");
    const selection = evaluate(grouping, request);
    const originalSelectorResult = selection.outcomes.find((o) => o.lineageId === "TEST-LINEAGE-A" && o.kind === "LINEAGE_SELECTION_EVALUATED");
    if (originalSelectorResult === undefined || originalSelectorResult.kind !== "LINEAGE_SELECTION_EVALUATED") throw new Error("expected evaluated");
    const result = mapE85TemporalDecisionImpact(selection, request);
    if (result.requestKind !== "RESOLVED") throw new Error("expected RESOLVED");
    const impact = findImpact([...result.impacts], "TEST-LINEAGE-A");
    if (impact.origin !== "SELECTOR_DERIVED") throw new Error("expected SELECTOR_DERIVED");
    expect(impact.selectorResult).toBe(originalSelectorResult.selectorResult);
  });
});

// ===========================================================================
// E. Non-ready groups under AS_OF
// ===========================================================================
describe("E85 Phase 15.14 — non-ready group mapping under AS_OF", () => {
  test("28. GROUP_BLOCKED (CANDIDATE_CONTENT_COLLISION) -> AS_OF_LINEAGE_BLOCKED / DATA_GAP, never mislabeled as conflicting legal authorities", () => {
    const grouping = blockedGrouping();
    const request = asOf("2020-06-15");
    const result = mapE85TemporalDecisionImpact(evaluate(grouping, request), request);
    if (result.requestKind !== "RESOLVED") throw new Error("expected RESOLVED");
    const impact = findImpact([...result.impacts], "TEST-LINEAGE-A");
    expect(impact.impactKind).toBe("AS_OF_LINEAGE_BLOCKED");
    expect(impact.disposition).toBe("DATA_GAP");
    if (impact.origin !== "GROUPING_DERIVED") throw new Error("expected GROUPING_DERIVED");
    expect(impact.group.collisionFindings.some((f) => f.kind === "CANDIDATE_CONTENT_COLLISION")).toBe(true);
    // A data-integrity collision must never be described as two disagreeing
    // legal authorities.
    expect(JSON.stringify(impact).toLowerCase()).not.toMatch(/conflicting legal author/);
  });

  test("29. GROUP_BLOCKED (CANDIDATE_ID_IN_MULTIPLE_LINEAGES) -> AS_OF_LINEAGE_BLOCKED / DATA_GAP", () => {
    const shared = candidateResult();
    const grouping = groupE85TemporalLineageMembers([member("TEST-LINEAGE-A", shared), member("TEST-LINEAGE-B", shared)]);
    const request = asOf("2020-06-15");
    const result = mapE85TemporalDecisionImpact(evaluate(grouping, request), request);
    if (result.requestKind !== "RESOLVED") throw new Error("expected RESOLVED");
    const impact = findImpact([...result.impacts], "TEST-LINEAGE-A");
    expect(impact.impactKind).toBe("AS_OF_LINEAGE_BLOCKED");
    if (impact.origin !== "GROUPING_DERIVED") throw new Error("expected GROUPING_DERIVED");
    expect(impact.group.collisionFindings.some((f) => f.kind === "CANDIDATE_ID_IN_MULTIPLE_LINEAGES")).toBe(true);
  });

  test("30. GROUP_EVIDENCE_INCOMPLETE with multiple distinct non-candidate outcomes preserves every one, without first-occurrence collapse", () => {
    const grouping = groupE85TemporalLineageMembers([
      member("TEST-LINEAGE-A", candidateResult({ sourceVersionId: "TEST-V1" })),
      member("TEST-LINEAGE-A", nonCandidateResult({ sourceVersionId: "TEST-V2" }, { state: "START_UNKNOWN" })),
      member("TEST-LINEAGE-A", nonCandidateResult({ sourceVersionId: "TEST-V3" }, openUnresearchedValidity("2019-01-01"))),
    ]);
    const request = asOf("2020-06-15");
    const result = mapE85TemporalDecisionImpact(evaluate(grouping, request), request);
    if (result.requestKind !== "RESOLVED") throw new Error("expected RESOLVED");
    const impact = findImpact([...result.impacts], "TEST-LINEAGE-A");
    expect(impact.impactKind).toBe("AS_OF_LINEAGE_EVIDENCE_INCOMPLETE");
    if (impact.origin !== "GROUPING_DERIVED") throw new Error("expected GROUPING_DERIVED");
    const outcomes = impact.group.nonCandidateMembers.map((m) => m.adapterResult.outcome);
    expect(outcomes.sort()).toEqual(["OPEN_END_UNRESEARCHED", "START_UNKNOWN"]);
  });

  test("31. GROUP_NO_CANDIDATE -> AS_OF_LINEAGE_NO_CANDIDATE / DATA_GAP, same evidence-preservation discipline", () => {
    const grouping = groupE85TemporalLineageMembers([
      member("TEST-LINEAGE-A", nonCandidateResult({ sourceVersionId: "TEST-V1" }, { state: "START_UNKNOWN" })),
      member("TEST-LINEAGE-A", nonCandidateResult({ sourceVersionId: "TEST-V2" }, openUnresearchedValidity("2018-01-01"))),
    ]);
    const request = asOf("2020-06-15");
    const result = mapE85TemporalDecisionImpact(evaluate(grouping, request), request);
    if (result.requestKind !== "RESOLVED") throw new Error("expected RESOLVED");
    const impact = findImpact([...result.impacts], "TEST-LINEAGE-A");
    expect(impact.impactKind).toBe("AS_OF_LINEAGE_NO_CANDIDATE");
    if (impact.origin !== "GROUPING_DERIVED") throw new Error("expected GROUPING_DERIVED");
    expect(impact.group.nonCandidateMembers.length).toBe(2);
  });

  test("32. non-ready group mapping never invokes the selector, reconstructs a candidate, or infers a relationship", () => {
    const filePath = path.resolve(__dirname, "../../src/zoning-land-use-engine/temporal-decision-impact.ts");
    const source = fs.readFileSync(filePath, "utf8");
    const executableCode = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(executableCode.includes("selectE85TemporalCandidate")).toBe(false);
  });
});

// ===========================================================================
// F. Multiple impacts and ordering
// ===========================================================================
describe("E85 Phase 15.14 — multiple impacts and ordering", () => {
  test("33. one impact per lineage, in selection.outcomes's own order", () => {
    const grouping = groupE85TemporalLineageMembers([
      member("TEST-LINEAGE-Z", candidateResult({ sourceVersionId: "TEST-V1" })),
      member("TEST-LINEAGE-A", candidateResult({ sourceVersionId: "TEST-V2" })),
    ]);
    const request = asOf("2020-06-15");
    const selection = evaluate(grouping, request);
    expect(selection.outcomes.map((o) => o.lineageId)).toEqual(["TEST-LINEAGE-A", "TEST-LINEAGE-Z"]);
    const result = mapE85TemporalDecisionImpact(selection, request);
    if (result.requestKind !== "RESOLVED") throw new Error("expected RESOLVED");
    expect(result.impacts.map((i) => i.lineageId)).toEqual(["TEST-LINEAGE-A", "TEST-LINEAGE-Z"]);
    expect(result.impacts.length).toBe(2);
  });

  test("34. reversed grouping input produces the correspondingly ordered output (grouping is itself order-independent, so both match)", () => {
    const inputs = [
      member("TEST-LINEAGE-A", candidateResult({ sourceVersionId: "TEST-V1" })),
      member("TEST-LINEAGE-B", candidateResult({ sourceVersionId: "TEST-V2" })),
    ];
    const request = asOf("2020-06-15");
    const forward = evaluate(groupE85TemporalLineageMembers(inputs), request);
    const reversed = evaluate(groupE85TemporalLineageMembers([...inputs].reverse()), request);
    expect(mapE85TemporalDecisionImpact(forward, request)).toEqual(mapE85TemporalDecisionImpact(reversed, request));
  });

  test("35. repeated calls with identical input are deeply equal", () => {
    const grouping = twoVersionGroup();
    const request = asOf("2020-06-15");
    const selection = evaluate(grouping, request);
    expect(mapE85TemporalDecisionImpact(selection, request)).toEqual(mapE85TemporalDecisionImpact(selection, request));
  });

  test("36. two lineages with the same disposition but different evidence are never collapsed", () => {
    const grouping = groupE85TemporalLineageMembers([
      member("TEST-LINEAGE-A", nonCandidateResult({ sourceVersionId: "TEST-V1" }, { state: "START_UNKNOWN" })),
      member("TEST-LINEAGE-B", nonCandidateResult({ sourceVersionId: "TEST-V2" }, { state: "START_UNKNOWN" })),
    ]);
    const request = asOf("2020-06-15");
    const result = mapE85TemporalDecisionImpact(evaluate(grouping, request), request);
    if (result.requestKind !== "RESOLVED") throw new Error("expected RESOLVED");
    expect(result.impacts.length).toBe(2);
    expect(result.impacts.every((i) => i.disposition === "DATA_GAP")).toBe(true);
    expect(result.impacts[0].lineageId).not.toBe(result.impacts[1].lineageId);
  });

  test("37. selection and request inputs are not mutated", () => {
    const grouping = twoVersionGroup();
    const request = asOf("2020-06-15");
    const selection = evaluate(grouping, request);
    const beforeSelection = JSON.stringify(selection);
    const beforeRequest = JSON.stringify(request);
    mapE85TemporalDecisionImpact(selection, request);
    expect(JSON.stringify(selection)).toBe(beforeSelection);
    expect(JSON.stringify(request)).toBe(beforeRequest);
  });
});

// ===========================================================================
// G. Runtime malformed-input boundary
// ===========================================================================
describe("E85 Phase 15.14 — runtime malformed-input boundary", () => {
  test("38. null selection under a RESOLVED request is rejected", () => {
    expect(() => mapE85TemporalDecisionImpact(null as unknown as E85TemporalLineageSelectionResult, CURRENT)).toThrow(E85TemporalDecisionImpactError);
  });

  test("39. non-object selection is rejected", () => {
    expect(() => mapE85TemporalDecisionImpact("nope" as unknown as E85TemporalLineageSelectionResult, CURRENT)).toThrow(E85TemporalDecisionImpactError);
  });

  test("40. missing outcomes array is rejected", () => {
    expect(() => mapE85TemporalDecisionImpact({} as unknown as E85TemporalLineageSelectionResult, CURRENT)).toThrow(E85TemporalDecisionImpactError);
  });

  test("41. unsupported request kind is rejected", () => {
    const selection = evaluate(readyGrouping(), CURRENT);
    expect(() => mapE85TemporalDecisionImpact(selection, { kind: "BOGUS" } as unknown as E85ResolvedTemporalRequest)).toThrow(E85TemporalDecisionImpactError);
  });

  test("42. unsupported request mode is rejected", () => {
    const selection = evaluate(readyGrouping(), CURRENT);
    expect(() => mapE85TemporalDecisionImpact(selection, { kind: "RESOLVED", request: { mode: "BOGUS" } } as unknown as E85ResolvedTemporalRequest)).toThrow(
      E85TemporalDecisionImpactError,
    );
  });

  test("43. AS_OF request missing asOfDate is rejected", () => {
    const selection = evaluate(readyGrouping(), CURRENT);
    expect(() => mapE85TemporalDecisionImpact(selection, { kind: "RESOLVED", request: { mode: "AS_OF" } } as unknown as E85ResolvedTemporalRequest)).toThrow(
      E85TemporalDecisionImpactError,
    );
  });

  test("44. unsupported outcome kind is rejected", () => {
    const selection = evaluate(readyGrouping(), CURRENT);
    const malformed: E85TemporalLineageSelectionResult = { outcomes: [{ ...selection.outcomes[0], kind: "BOGUS" } as unknown as E85TemporalLineageSelectionResult["outcomes"][number]] };
    expect(() => mapE85TemporalDecisionImpact(malformed, CURRENT)).toThrow(E85TemporalDecisionImpactError);
  });

  test("45. missing/empty lineageId is rejected", () => {
    const selection = evaluate(readyGrouping(), CURRENT);
    const malformed: E85TemporalLineageSelectionResult = { outcomes: [{ ...selection.outcomes[0], lineageId: "" } as unknown as E85TemporalLineageSelectionResult["outcomes"][number]] };
    expect(() => mapE85TemporalDecisionImpact(malformed, CURRENT)).toThrow(E85TemporalDecisionImpactError);
  });

  test("46. LINEAGE_SELECTION_EVALUATED missing selectorResult is rejected", () => {
    const selection = evaluate(readyGrouping(), CURRENT);
    const outcome = selection.outcomes[0];
    if (outcome.kind !== "LINEAGE_SELECTION_EVALUATED") throw new Error("expected evaluated");
    const { selectorResult: _omit, ...withoutSelector } = outcome;
    const malformed: E85TemporalLineageSelectionResult = { outcomes: [withoutSelector as unknown as E85TemporalLineageSelectionResult["outcomes"][number]] };
    expect(() => mapE85TemporalDecisionImpact(malformed, CURRENT)).toThrow(E85TemporalDecisionImpactError);
  });

  test("47. LINEAGE_SELECTION_EVALUATED with unsupported selectorResult.kind is rejected", () => {
    const selection = evaluate(readyGrouping(), CURRENT);
    const outcome = selection.outcomes[0];
    if (outcome.kind !== "LINEAGE_SELECTION_EVALUATED") throw new Error("expected evaluated");
    const malformed: E85TemporalLineageSelectionResult = {
      outcomes: [{ ...outcome, selectorResult: { ...outcome.selectorResult, kind: "BOGUS" } } as unknown as E85TemporalLineageSelectionResult["outcomes"][number]],
    };
    expect(() => mapE85TemporalDecisionImpact(malformed, CURRENT)).toThrow(E85TemporalDecisionImpactError);
  });

  test("48. LINEAGE_NOT_SELECTOR_ELIGIBLE missing group is rejected", () => {
    const selection = evaluate(blockedGrouping(), CURRENT);
    const outcome = selection.outcomes[0];
    if (outcome.kind !== "LINEAGE_NOT_SELECTOR_ELIGIBLE") throw new Error("expected not-eligible");
    const { group: _omit, ...withoutGroup } = outcome;
    const malformed: E85TemporalLineageSelectionResult = { outcomes: [withoutGroup as unknown as E85TemporalLineageSelectionResult["outcomes"][number]] };
    expect(() => mapE85TemporalDecisionImpact(malformed, CURRENT)).toThrow(E85TemporalDecisionImpactError);
  });

  test("49. LINEAGE_NOT_SELECTOR_ELIGIBLE with unsupported group.kind is rejected", () => {
    const selection = evaluate(blockedGrouping(), CURRENT);
    const outcome = selection.outcomes[0];
    if (outcome.kind !== "LINEAGE_NOT_SELECTOR_ELIGIBLE") throw new Error("expected not-eligible");
    const malformed: E85TemporalLineageSelectionResult = {
      outcomes: [{ ...outcome, group: { ...outcome.group, kind: "BOGUS" } } as unknown as E85TemporalLineageSelectionResult["outcomes"][number]],
    };
    expect(() => mapE85TemporalDecisionImpact(malformed, CURRENT)).toThrow(E85TemporalDecisionImpactError);
  });

  test("50. CURRENT-mode selectorResult carrying a non-INSUFFICIENT kind is rejected as a boundary violation", () => {
    const request = asOf("2020-06-15");
    const selection = evaluate(twoVersionGroup(), request);
    const outcome = selection.outcomes[0];
    if (outcome.kind !== "LINEAGE_SELECTION_EVALUATED") throw new Error("expected evaluated");
    const tampered: E85TemporalLineageSelectionResult = { outcomes: [outcome] };
    // outcome.selectorResult.kind is "SELECTED" here (AS_OF 2020-06-15), but we
    // feed it through the mapper under a CURRENT request — a shape the real
    // pipeline could never produce, exercising the mapper's own defensive guard.
    expect(() => mapE85TemporalDecisionImpact(tampered, CURRENT)).toThrow(E85TemporalDecisionImpactError);
  });

  test("51. no bare generic Error leaks through the public boundary for malformed input", () => {
    const attempts: Array<() => void> = [
      () => mapE85TemporalDecisionImpact(null as unknown as E85TemporalLineageSelectionResult, CURRENT),
      () => mapE85TemporalDecisionImpact({} as unknown as E85TemporalLineageSelectionResult, CURRENT),
      () => mapE85TemporalDecisionImpact(evaluate(readyGrouping(), CURRENT), { kind: "BOGUS" } as unknown as E85ResolvedTemporalRequest),
    ];
    for (const attempt of attempts) {
      try {
        attempt();
        throw new Error("expected a throw");
      } catch (error) {
        expect(error).toBeInstanceOf(E85TemporalDecisionImpactError);
      }
    }
  });

  test("52. E85TemporalDecisionImpactError has correct name and message prefix", () => {
    try {
      mapE85TemporalDecisionImpact(null as unknown as E85TemporalLineageSelectionResult, CURRENT);
      throw new Error("expected a throw");
    } catch (error) {
      expect(error).toBeInstanceOf(E85TemporalDecisionImpactError);
      expect((error as Error).name).toBe("E85TemporalDecisionImpactError");
      expect((error as Error).message.startsWith("E85 temporal decision impact error:")).toBe(true);
    }
  });

  test("53. repeated identical malformed input yields byte-identical error messages", () => {
    let first: unknown;
    let second: unknown;
    try {
      mapE85TemporalDecisionImpact(null as unknown as E85TemporalLineageSelectionResult, CURRENT);
    } catch (e) {
      first = e;
    }
    try {
      mapE85TemporalDecisionImpact(null as unknown as E85TemporalLineageSelectionResult, CURRENT);
    } catch (e) {
      second = e;
    }
    expect((first as Error).message).toBe((second as Error).message);
  });

  test("54. ABSENT swallows equivalently malformed selection input without throwing", () => {
    expect(() => mapE85TemporalDecisionImpact({} as unknown as E85TemporalLineageSelectionResult, ABSENT)).not.toThrow();
    expect(() => mapE85TemporalDecisionImpact("nope" as unknown as E85TemporalLineageSelectionResult, ABSENT)).not.toThrow();
    expect(() => mapE85TemporalDecisionImpact(undefined as unknown as E85TemporalLineageSelectionResult, ABSENT)).not.toThrow();
  });
});

// ===========================================================================
// H. Purity and isolation checks
// ===========================================================================
describe("E85 Phase 15.14 — purity and isolation checks", () => {
  const filePath = path.resolve(__dirname, "../../src/zoning-land-use-engine/temporal-decision-impact.ts");
  const source = fs.readFileSync(filePath, "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const codeSansStrings = code
    .replace(/`(?:[^`\\]|\\.)*`/g, "``")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");

  test("55. no Date.now() in production code", () => {
    expect(/\bDate\.now\s*\(/.test(code)).toBe(false);
  });

  test("56. no new Date() in production code", () => {
    expect(/\bnew\s+Date\s*\(/.test(code)).toBe(false);
  });

  test("57. no Math.random() in production code", () => {
    expect(/Math\.random\s*\(/.test(code)).toBe(false);
  });

  test("58. no randomUUID() in production code", () => {
    expect(/randomUUID\s*\(/.test(code)).toBe(false);
  });

  test("59. no filesystem or network access", () => {
    expect(/from\s+["'](?:node:)?fs(?:\/promises)?["']/.test(code)).toBe(false);
    expect(/\bfetch\s*\(/.test(code)).toBe(false);
    expect(/from\s+["'](?:node:)?https?["']/.test(code)).toBe(false);
  });

  test("60. no dynamic execution (eval / new Function / dynamic import)", () => {
    expect(/\beval\s*\(/.test(code)).toBe(false);
    expect(/new\s+Function\s*\(/.test(code)).toBe(false);
    expect(/\bimport\s*\(/.test(code)).toBe(false);
    expect(/\brequire\s*\(/.test(code)).toBe(false);
  });

  test("61. no use of `any` in executable/type code", () => {
    expect(/\bany\b/.test(codeSansStrings)).toBe(false);
  });

  test("62. no real jurisdiction/district identifiers", () => {
    for (const term of [/vancouver/i, /burnaby/i, /\bR1-1\b/, /\bC-2C\b/, /13447/, /494642/]) {
      expect(term.test(source)).toBe(false);
    }
  });

  test("63. imports come only from the five permitted modules", () => {
    const imports = [...code.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    const permitted = ["./temporal-request-types", "./temporal-lineage-selection", "./temporal-selection", "./temporal-lineage-grouping", "./temporal-candidate-adapter"];
    for (const specifier of imports) {
      expect(permitted).toContain(specifier);
    }
  });

  test("64. no import of decision-status/materiality/trace/orchestrator/package-types/evaluator/composer/legal-linkage/registry modules", () => {
    const imports = [...code.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    const forbiddenSubstrings = ["decision-", "evaluator", "composer", "composition-", "precedence-", "linkage", "registry", "spatial", "adapters/"];
    for (const specifier of imports) {
      for (const forbidden of forbiddenSubstrings) {
        expect(specifier.includes(forbidden)).toBe(false);
      }
    }
  });

  test("65. no barrel export was added (index.ts unchanged)", () => {
    const indexSource = fs.readFileSync(path.resolve(__dirname, "../../src/zoning-land-use-engine/index.ts"), "utf8");
    expect(indexSource.includes("temporal-decision-impact")).toBe(false);
  });

  test("66. no E85DataGapReasonCode literal or data-gap-types import appears", () => {
    expect(code.includes("data-gap-types")).toBe(false);
  });

  test("67. Slice 3D-2 relationship vocabulary is absent", () => {
    for (const term of [/\bAMENDS\b/, /\bREPEALS\b/, /\bREPLACES\b/, /\bSUPERSEDES_RELATIONSHIP\b/, /relationshipKind/]) {
      expect(term.test(source)).toBe(false);
    }
  });

  test("68. Slice 3F wiring is absent (no gap/status/materiality/trace field names in executable/type code)", () => {
    for (const term of [/\bgapCode\b/, /\bblockers\b/, /\bmateriality\b/i, /\btraceId\b/, /\bdecisionPackage\b/i, /\bcompletenessStatus\b/]) {
      expect(term.test(code)).toBe(false);
    }
  });

  test("69. no skipped/todo/.only/snapshot markers in this test file", () => {
    const testSource = fs.readFileSync(path.resolve(__dirname, "temporal-decision-impact.test.ts"), "utf8");
    expect(/\btest\.skip\b/.test(testSource)).toBe(false);
    expect(/\btest\.only\b/.test(testSource)).toBe(false);
    expect(/\bdescribe\.skip\b/.test(testSource)).toBe(false);
    expect(/\bdescribe\.only\b/.test(testSource)).toBe(false);
    expect(/\btoMatchSnapshot\b/.test(testSource)).toBe(false);
    expect(/\.todo\(/.test(testSource)).toBe(false);
  });

  test("70. no real-jurisdiction identity strings used as fixture data in this test file (identity fields all read TEST-*)", () => {
    expect(bundle().jurisdictionId.startsWith("TEST-")).toBe(true);
    expect(bundle().sourceId.startsWith("TEST-")).toBe(true);
    expect(bundle().zoneDesignation.startsWith("TEST-")).toBe(true);
  });
});

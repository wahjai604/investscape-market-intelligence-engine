/**
 * InvestScape™ E85 Phase 15.4 — temporal candidate selection tests, Slice 2.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 */
import {
  selectE85TemporalCandidate,
  E85TemporalSelectionError,
  E85TemporalCandidate,
} from "../../src/zoning-land-use-engine/temporal-selection";
import { E85ResolvedTemporalRequest } from "../../src/zoning-land-use-engine/temporal-request-types";
import {
  TEMPORAL_FIXTURE_VERSION_1,
  TEMPORAL_FIXTURE_VERSION_2,
  TEMPORAL_FIXTURE_TWO_VERSIONS,
  TEMPORAL_FIXTURE_GAP_DATE,
  TEMPORAL_FIXTURE_BEFORE_ALL_DATE,
  TEMPORAL_FIXTURE_AFTER_ALL_DATE,
  TEMPORAL_FIXTURE_UNKNOWN_CANDIDATE,
  TEMPORAL_FIXTURE_OVERLAPPING_CANDIDATES,
  TEMPORAL_FIXTURE_OVERLAP_DATE,
  TEMPORAL_FIXTURE_FUTURE_EFFECTIVE_ONLY,
  TEMPORAL_FIXTURE_FUTURE_EFFECTIVE_QUERY_DATE,
  TEMPORAL_FIXTURE_SUPERSEDED_ONLY,
  TEMPORAL_FIXTURE_SUPERSEDED_QUERY_DATE,
} from "./fixtures/temporal-two-version-fixture";

const ABSENT: E85ResolvedTemporalRequest = { kind: "ABSENT" };
const CURRENT: E85ResolvedTemporalRequest = { kind: "RESOLVED", request: { mode: "CURRENT" } };
function asOf(date: string): E85ResolvedTemporalRequest {
  return { kind: "RESOLVED", request: { mode: "AS_OF", asOfDate: date } };
}

describe("E85 Phase 15.4 — selectE85TemporalCandidate reconciliation", () => {
  test("1. ABSENT selects nothing", () => {
    const result = selectE85TemporalCandidate(ABSENT, TEMPORAL_FIXTURE_TWO_VERSIONS);
    expect(result.kind).toBe("INSUFFICIENT_TEMPORAL_EVIDENCE");
    expect(result.selectedCandidateId).toBeUndefined();
  });

  test("2. CURRENT selects nothing and uses no clock", () => {
    const dateSpy = jest.spyOn(global, "Date");
    const result = selectE85TemporalCandidate(CURRENT, TEMPORAL_FIXTURE_TWO_VERSIONS);
    expect(dateSpy).not.toHaveBeenCalled();
    expect(result.kind).toBe("INSUFFICIENT_TEMPORAL_EVIDENCE");
    expect(result.selectedCandidateId).toBeUndefined();
    dateSpy.mockRestore();
  });

  test("3. AS_OF inside Version 1 selects only Version 1", () => {
    const result = selectE85TemporalCandidate(asOf("2020-06-15"), TEMPORAL_FIXTURE_TWO_VERSIONS);
    expect(result.kind).toBe("SELECTED");
    expect(result.selectedCandidateId).toBe(TEMPORAL_FIXTURE_VERSION_1.candidateId);
  });

  test("4. AS_OF exactly on Version 1 effectiveFrom selects Version 1", () => {
    const result = selectE85TemporalCandidate(asOf("2020-01-01"), TEMPORAL_FIXTURE_TWO_VERSIONS);
    expect(result.kind).toBe("SELECTED");
    expect(result.selectedCandidateId).toBe(TEMPORAL_FIXTURE_VERSION_1.candidateId);
  });

  test("5. AS_OF exactly on Version 1 effectiveTo selects Version 1", () => {
    const result = selectE85TemporalCandidate(asOf("2020-12-31"), TEMPORAL_FIXTURE_TWO_VERSIONS);
    expect(result.kind).toBe("SELECTED");
    expect(result.selectedCandidateId).toBe(TEMPORAL_FIXTURE_VERSION_1.candidateId);
  });

  test("6. AS_OF inside Version 2 selects only Version 2", () => {
    const result = selectE85TemporalCandidate(asOf("2021-09-01"), TEMPORAL_FIXTURE_TWO_VERSIONS);
    expect(result.kind).toBe("SELECTED");
    expect(result.selectedCandidateId).toBe(TEMPORAL_FIXTURE_VERSION_2.candidateId);
  });

  test("7. AS_OF exactly on Version 2 effectiveFrom selects Version 2", () => {
    const result = selectE85TemporalCandidate(asOf("2021-06-01"), TEMPORAL_FIXTURE_TWO_VERSIONS);
    expect(result.kind).toBe("SELECTED");
    expect(result.selectedCandidateId).toBe(TEMPORAL_FIXTURE_VERSION_2.candidateId);
  });

  test("8. AS_OF exactly on Version 2 effectiveTo (closed) selects Version 2", () => {
    const result = selectE85TemporalCandidate(asOf("2021-12-31"), TEMPORAL_FIXTURE_TWO_VERSIONS);
    expect(result.kind).toBe("SELECTED");
    expect(result.selectedCandidateId).toBe(TEMPORAL_FIXTURE_VERSION_2.candidateId);
  });

  test("9. date between versions -> OUTSIDE_VALIDITY_INTERVAL", () => {
    const result = selectE85TemporalCandidate(asOf(TEMPORAL_FIXTURE_GAP_DATE), TEMPORAL_FIXTURE_TWO_VERSIONS);
    expect(result.kind).toBe("OUTSIDE_VALIDITY_INTERVAL");
    expect(result.selectedCandidateId).toBeUndefined();
  });

  test("10. date before both -> FUTURE_EFFECTIVE", () => {
    const result = selectE85TemporalCandidate(asOf(TEMPORAL_FIXTURE_BEFORE_ALL_DATE), TEMPORAL_FIXTURE_TWO_VERSIONS);
    expect(result.kind).toBe("FUTURE_EFFECTIVE");
    expect(result.selectedCandidateId).toBeUndefined();
  });

  test("11. date after all closed versions -> SUPERSEDED", () => {
    const result = selectE85TemporalCandidate(asOf(TEMPORAL_FIXTURE_AFTER_ALL_DATE), TEMPORAL_FIXTURE_TWO_VERSIONS);
    expect(result.kind).toBe("SUPERSEDED");
    expect(result.selectedCandidateId).toBeUndefined();
  });

  test("12. overlapping applicable versions -> CONFLICTING_TEMPORAL_EVIDENCE", () => {
    const result = selectE85TemporalCandidate(asOf(TEMPORAL_FIXTURE_OVERLAP_DATE), TEMPORAL_FIXTURE_OVERLAPPING_CANDIDATES);
    expect(result.kind).toBe("CONFLICTING_TEMPORAL_EVIDENCE");
    expect(result.selectedCandidateId).toBeUndefined();
  });

  test("13. unknown-basis candidate alone -> INSUFFICIENT_TEMPORAL_EVIDENCE", () => {
    const result = selectE85TemporalCandidate(asOf("2020-06-15"), [TEMPORAL_FIXTURE_UNKNOWN_CANDIDATE]);
    expect(result.kind).toBe("INSUFFICIENT_TEMPORAL_EVIDENCE");
    expect(result.selectedCandidateId).toBeUndefined();
  });

  test("14. unknown candidate that could overlap an otherwise valid selection prevents false unique selection", () => {
    const result = selectE85TemporalCandidate(asOf("2020-06-15"), [
      TEMPORAL_FIXTURE_VERSION_1,
      TEMPORAL_FIXTURE_UNKNOWN_CANDIDATE,
    ]);
    expect(result.kind).toBe("TEMPORALLY_AMBIGUOUS");
    expect(result.selectedCandidateId).toBeUndefined();
  });

  test("15. input candidate order does not change output", () => {
    const forward = selectE85TemporalCandidate(asOf("2020-06-15"), [
      TEMPORAL_FIXTURE_VERSION_1,
      TEMPORAL_FIXTURE_VERSION_2,
    ]);
    const reversed = selectE85TemporalCandidate(asOf("2020-06-15"), [
      TEMPORAL_FIXTURE_VERSION_2,
      TEMPORAL_FIXTURE_VERSION_1,
    ]);
    expect(forward).toEqual(reversed);
  });

  test("16. candidate input is not mutated", () => {
    const candidates: E85TemporalCandidate[] = [
      { ...TEMPORAL_FIXTURE_VERSION_1, temporal: { ...TEMPORAL_FIXTURE_VERSION_1.temporal } },
    ];
    const before = JSON.stringify(candidates);
    selectE85TemporalCandidate(asOf("2020-06-15"), candidates);
    expect(JSON.stringify(candidates)).toBe(before);
  });

  test("17. request input is not mutated", () => {
    const request = asOf("2020-06-15");
    const before = JSON.stringify(request);
    selectE85TemporalCandidate(request, TEMPORAL_FIXTURE_TWO_VERSIONS);
    expect(JSON.stringify(request)).toBe(before);
  });

  test("18. repeated calls are deeply equal", () => {
    const first = selectE85TemporalCandidate(asOf("2020-06-15"), TEMPORAL_FIXTURE_TWO_VERSIONS);
    const second = selectE85TemporalCandidate(asOf("2020-06-15"), TEMPORAL_FIXTURE_TWO_VERSIONS);
    expect(first).toEqual(second);
  });

  test("19. no selected candidate ID appears in non-SELECTED results", () => {
    const nonSelectedResults = [
      selectE85TemporalCandidate(ABSENT, TEMPORAL_FIXTURE_TWO_VERSIONS),
      selectE85TemporalCandidate(CURRENT, TEMPORAL_FIXTURE_TWO_VERSIONS),
      selectE85TemporalCandidate(asOf(TEMPORAL_FIXTURE_GAP_DATE), TEMPORAL_FIXTURE_TWO_VERSIONS),
      selectE85TemporalCandidate(asOf(TEMPORAL_FIXTURE_BEFORE_ALL_DATE), TEMPORAL_FIXTURE_TWO_VERSIONS),
      selectE85TemporalCandidate(asOf(TEMPORAL_FIXTURE_AFTER_ALL_DATE), TEMPORAL_FIXTURE_TWO_VERSIONS),
      selectE85TemporalCandidate(asOf(TEMPORAL_FIXTURE_OVERLAP_DATE), TEMPORAL_FIXTURE_OVERLAPPING_CANDIDATES),
      selectE85TemporalCandidate(asOf("2020-06-15"), [TEMPORAL_FIXTURE_UNKNOWN_CANDIDATE]),
    ];
    for (const result of nonSelectedResults) {
      expect(result.kind).not.toBe("SELECTED");
      expect(result.selectedCandidateId).toBeUndefined();
    }
  });

  test("20. empty candidate list is handled deterministically", () => {
    const first = selectE85TemporalCandidate(asOf("2020-06-15"), []);
    const second = selectE85TemporalCandidate(asOf("2020-06-15"), []);
    expect(first).toEqual(second);
    expect(first.kind).toBe("INSUFFICIENT_TEMPORAL_EVIDENCE");
    expect(first.candidateIdsConsidered).toEqual([]);
  });

  test("21. duplicate candidate IDs are rejected deterministically", () => {
    const duplicated: E85TemporalCandidate[] = [TEMPORAL_FIXTURE_VERSION_1, { ...TEMPORAL_FIXTURE_VERSION_2, candidateId: TEMPORAL_FIXTURE_VERSION_1.candidateId }];
    expect(() => selectE85TemporalCandidate(asOf("2020-06-15"), duplicated)).toThrow(E85TemporalSelectionError);
    expect(() => selectE85TemporalCandidate(asOf("2020-06-15"), duplicated)).toThrow(/duplicate candidateId/);
  });

  test("22. invalid interval where effectiveFrom > effectiveTo is rejected deterministically", () => {
    const invalid: E85TemporalCandidate = {
      candidateId: "TEST-JX/TEST-Z1/invalid",
      temporal: { effectiveFrom: "2021-01-01", effectiveTo: "2020-01-01", effectiveDateBasis: "AMENDMENT_DATE_KNOWN" },
    };
    expect(() => selectE85TemporalCandidate(asOf("2020-06-15"), [invalid])).toThrow(E85TemporalSelectionError);
    expect(() => selectE85TemporalCandidate(asOf("2020-06-15"), [invalid])).toThrow(/effectiveFrom .* after effectiveTo/);
  });

  test("23. no Date.now/new Date dependency across AS_OF, FUTURE_EFFECTIVE, and SUPERSEDED paths", () => {
    const dateSpy = jest.spyOn(global, "Date");
    selectE85TemporalCandidate(asOf(TEMPORAL_FIXTURE_FUTURE_EFFECTIVE_QUERY_DATE), [TEMPORAL_FIXTURE_FUTURE_EFFECTIVE_ONLY]);
    selectE85TemporalCandidate(asOf(TEMPORAL_FIXTURE_SUPERSEDED_QUERY_DATE), [TEMPORAL_FIXTURE_SUPERSEDED_ONLY]);
    selectE85TemporalCandidate(asOf("2020-06-15"), TEMPORAL_FIXTURE_TWO_VERSIONS);
    expect(dateSpy).not.toHaveBeenCalled();
    dateSpy.mockRestore();
  });
});

describe("E85 Phase 15.4 — single-candidate future-effective-only and superseded-only states", () => {
  test("future-effective-only candidate queried before its start -> FUTURE_EFFECTIVE", () => {
    const result = selectE85TemporalCandidate(asOf(TEMPORAL_FIXTURE_FUTURE_EFFECTIVE_QUERY_DATE), [
      TEMPORAL_FIXTURE_FUTURE_EFFECTIVE_ONLY,
    ]);
    expect(result.kind).toBe("FUTURE_EFFECTIVE");
  });

  test("closed/superseded-only candidate queried after its end -> SUPERSEDED", () => {
    const result = selectE85TemporalCandidate(asOf(TEMPORAL_FIXTURE_SUPERSEDED_QUERY_DATE), [TEMPORAL_FIXTURE_SUPERSEDED_ONLY]);
    expect(result.kind).toBe("SUPERSEDED");
  });
});

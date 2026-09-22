/**
 * InvestScape™ E85 Phase 15.21B — parcel-designation AS_OF applicability
 * evaluator tests, Slice 3G-2.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Synthetic identifiers only (SYNTH-JURISDICTION-1 / SYNTH-ZONE-TEST-1 /
 * SYNTH-INSTRUMENT-*) — no real R1-1/C-2C/Feature 494642/Vancouver/Burnaby
 * value is imported or referenced anywhere here.
 */
import {
  buildE85DesignationValidity,
  E85DesignationIdentity,
  E85DesignationInstrumentLocator,
  E85DesignationValidity,
} from "../../src/zoning-land-use-engine/designation-validity-types";
import { E85ResolvedTemporalRequest } from "../../src/zoning-land-use-engine/temporal-request-types";
import {
  evaluateE85DesignationApplicability,
  E85DesignationApplicabilityError,
  E85DesignationApplicabilityResult,
} from "../../src/zoning-land-use-engine/designation-applicability";

const LOCATOR: E85DesignationInstrumentLocator = { instrumentId: "SYNTH-INSTRUMENT-1", clause: "1" };
const LOCATOR_2: E85DesignationInstrumentLocator = { instrumentId: "SYNTH-INSTRUMENT-2", clause: "2" };

const IDENTITY: E85DesignationIdentity = { jurisdictionId: "SYNTH-JURISDICTION-1", districtOrZoneId: "SYNTH-ZONE-TEST-1" };

function asOf(asOfDate: string): E85ResolvedTemporalRequest {
  return { kind: "RESOLVED", request: { mode: "AS_OF", asOfDate } };
}

const ABSENT: E85ResolvedTemporalRequest = { kind: "ABSENT" };
const CURRENT: E85ResolvedTemporalRequest = { kind: "RESOLVED", request: { mode: "CURRENT" } };

describe("evaluateE85DesignationApplicability — resolved-request-mode handling", () => {
  const closed: E85DesignationValidity = buildE85DesignationValidity({
    state: "CLOSED",
    identity: IDENTITY,
    start: { kind: "MAP_AMENDMENT_OPERATIVE_DATE", effectiveFrom: "2020-01-01", instrumentLocator: LOCATOR },
    effectiveTo: "2021-12-31",
    end: { kind: "EXPRESS_REPEAL_OF_INSTRUMENT", effectiveTo: "2021-12-31", instrumentLocator: LOCATOR_2 },
  });

  test("ABSENT is never evaluable", () => {
    expect(evaluateE85DesignationApplicability(closed, ABSENT)).toEqual({ kind: "DESIGNATION_APPLICABILITY_NOT_EVALUABLE" });
  });

  test("CURRENT is never evaluable — no clock is consulted to resolve it", () => {
    expect(evaluateE85DesignationApplicability(closed, CURRENT)).toEqual({ kind: "DESIGNATION_APPLICABILITY_NOT_EVALUABLE" });
  });

  test("AS_OF is evaluable", () => {
    const result = evaluateE85DesignationApplicability(closed, asOf("2020-06-01"));
    expect(result.kind).toBe("DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL");
  });

  test("malformed resolvedRequest.kind throws, never returned as a result", () => {
    const malformed = { kind: "SOMETHING_ELSE" } as unknown as E85ResolvedTemporalRequest;
    expect(() => evaluateE85DesignationApplicability(closed, malformed)).toThrow(E85DesignationApplicabilityError);
  });

  test("malformed resolvedRequest.request.mode throws, never returned as a result", () => {
    const malformed = { kind: "RESOLVED", request: { mode: "BOGUS" } } as unknown as E85ResolvedTemporalRequest;
    expect(() => evaluateE85DesignationApplicability(closed, malformed)).toThrow(E85DesignationApplicabilityError);
  });

  test("malformed resolvedRequest (not an object) throws", () => {
    expect(() => evaluateE85DesignationApplicability(closed, null as unknown as E85ResolvedTemporalRequest)).toThrow(
      E85DesignationApplicabilityError,
    );
  });
});

describe("evaluateE85DesignationApplicability — state 1: DESIGNATION_START_UNKNOWN", () => {
  const validity: E85DesignationValidity = buildE85DesignationValidity({ state: "DESIGNATION_START_UNKNOWN", identity: IDENTITY });

  test.each(["2019-01-01", "2020-01-01", "2025-06-15"])("AS_OF %s -> DESIGNATION_NO_START_EVIDENCE", (date) => {
    expect(evaluateE85DesignationApplicability(validity, asOf(date))).toEqual({ kind: "DESIGNATION_NO_START_EVIDENCE", identity: IDENTITY });
  });
});

describe("evaluateE85DesignationApplicability — state 2: CONFLICTING_DESIGNATION_START", () => {
  const validity: E85DesignationValidity = buildE85DesignationValidity({
    state: "CONFLICTING_DESIGNATION_START",
    identity: IDENTITY,
    conflictingStartAuthorities: [
      { kind: "MAP_AMENDMENT_OPERATIVE_DATE", effectiveFrom: "2020-01-01", instrumentLocator: LOCATOR },
      { kind: "PARCEL_SPECIFIC_INSTRUMENT", effectiveFrom: "2020-02-01", instrumentLocator: LOCATOR_2 },
    ],
  });

  test.each(["2019-01-01", "2020-01-15", "2025-06-15"])("AS_OF %s -> DESIGNATION_START_CONFLICT (never collapsed into 'unknown')", (date) => {
    const result = evaluateE85DesignationApplicability(validity, asOf(date));
    expect(result).toEqual({ kind: "DESIGNATION_START_CONFLICT", identity: IDENTITY });
    expect(result.kind).not.toBe("DESIGNATION_NO_START_EVIDENCE");
  });
});

describe("evaluateE85DesignationApplicability — state 3: OPEN_UNRESEARCHED, dated start", () => {
  const validity: E85DesignationValidity = buildE85DesignationValidity({
    state: "OPEN_UNRESEARCHED",
    identity: IDENTITY,
    start: { kind: "MAP_AMENDMENT_OPERATIVE_DATE", effectiveFrom: "2020-01-01", instrumentLocator: LOCATOR },
  });

  test("before effectiveFrom -> DESIGNATION_NOT_YET_STARTED", () => {
    expect(evaluateE85DesignationApplicability(validity, asOf("2019-12-31"))).toEqual({
      kind: "DESIGNATION_NOT_YET_STARTED",
      identity: IDENTITY,
      effectiveFrom: "2020-01-01",
      asOfDate: "2019-12-31",
    });
  });

  test("at effectiveFrom -> DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END (never a bare YES)", () => {
    expect(evaluateE85DesignationApplicability(validity, asOf("2020-01-01"))).toEqual({
      kind: "DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END",
      identity: IDENTITY,
      effectiveFrom: "2020-01-01",
      asOfDate: "2020-01-01",
    });
  });

  test("well after effectiveFrom -> DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END, still unproven", () => {
    const result = evaluateE85DesignationApplicability(validity, asOf("2030-01-01"));
    expect(result.kind).toBe("DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END");
    if (result.kind === "DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END") {
      expect((result as { effectiveTo?: unknown }).effectiveTo).toBeUndefined();
    }
  });
});

describe("evaluateE85DesignationApplicability — state 3: OPEN_UNRESEARCHED, observation-only start", () => {
  const validity: E85DesignationValidity = buildE85DesignationValidity({
    state: "OPEN_UNRESEARCHED",
    identity: IDENTITY,
    start: { kind: "OPEN_OBSERVATION_ASSERTION", observation: { observedAt: "2023-06-15", datasetId: "SYNTH-DATASET-1" } },
  });

  test.each(["2019-01-01", "2023-06-14", "2023-06-15", "2023-06-16", "2030-01-01"])(
    "AS_OF %s -> DESIGNATION_OBSERVATION_ONLY_NOT_LEGALLY_DATED regardless of relation to observedAt",
    (date) => {
      expect(evaluateE85DesignationApplicability(validity, asOf(date))).toEqual({
        kind: "DESIGNATION_OBSERVATION_ONLY_NOT_LEGALLY_DATED",
        identity: IDENTITY,
        observedAt: "2023-06-15",
      });
    },
  );
});

describe("evaluateE85DesignationApplicability — state 4: OPEN_REVIEWED_NO_END_ESTABLISHED, dated start", () => {
  const validity: E85DesignationValidity = buildE85DesignationValidity({
    state: "OPEN_REVIEWED_NO_END_ESTABLISHED",
    identity: IDENTITY,
    start: { kind: "PARCEL_SPECIFIC_INSTRUMENT", effectiveFrom: "2018-03-01", instrumentLocator: LOCATOR },
    endReview: { sourcesChecked: ["SYNTH-SOURCE-1"], reviewedAt: "2026-01-01" },
  });

  test("before effectiveFrom -> DESIGNATION_NOT_YET_STARTED", () => {
    expect(evaluateE85DesignationApplicability(validity, asOf("2018-02-28")).kind).toBe("DESIGNATION_NOT_YET_STARTED");
  });

  test("at effectiveFrom -> DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END", () => {
    expect(evaluateE85DesignationApplicability(validity, asOf("2018-03-01")).kind).toBe("DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END");
  });

  test("well after reviewedAt -> still DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END, reviewedAt never treated as a bound", () => {
    const result = evaluateE85DesignationApplicability(validity, asOf("2027-01-01"));
    expect(result.kind).toBe("DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END");
  });
});

describe("evaluateE85DesignationApplicability — state 4: OPEN_REVIEWED_NO_END_ESTABLISHED, observation-only start", () => {
  const validity: E85DesignationValidity = buildE85DesignationValidity({
    state: "OPEN_REVIEWED_NO_END_ESTABLISHED",
    identity: IDENTITY,
    start: { kind: "OPEN_OBSERVATION_ASSERTION", observation: { observedAt: "2022-05-01", sourceDescription: "SYNTH-SOURCE-DESC-1" } },
    endReview: { sourcesChecked: ["SYNTH-SOURCE-2"], reviewedAt: "2026-01-01" },
  });

  test.each(["2020-01-01", "2022-05-01", "2028-01-01"])("AS_OF %s -> DESIGNATION_OBSERVATION_ONLY_NOT_LEGALLY_DATED even with an end review on file", (date) => {
    expect(evaluateE85DesignationApplicability(validity, asOf(date))).toEqual({
      kind: "DESIGNATION_OBSERVATION_ONLY_NOT_LEGALLY_DATED",
      identity: IDENTITY,
      observedAt: "2022-05-01",
    });
  });
});

describe("evaluateE85DesignationApplicability — state 5: CLOSED", () => {
  const validity: E85DesignationValidity = buildE85DesignationValidity({
    state: "CLOSED",
    identity: IDENTITY,
    start: { kind: "MAP_AMENDMENT_OPERATIVE_DATE", effectiveFrom: "2020-01-01", instrumentLocator: LOCATOR },
    effectiveTo: "2021-12-31",
    end: { kind: "EXPRESS_REDESIGNATION", effectiveTo: "2021-12-31", instrumentLocator: LOCATOR_2 },
  });

  test("before effectiveFrom -> DESIGNATION_NOT_YET_STARTED (never folded into outside-interval)", () => {
    const result = evaluateE85DesignationApplicability(validity, asOf("2019-12-31"));
    expect(result).toEqual({
      kind: "DESIGNATION_NOT_YET_STARTED",
      identity: IDENTITY,
      effectiveFrom: "2020-01-01",
      asOfDate: "2019-12-31",
    });
    // No prohibited/fabricated fields: no effectiveTo on this result shape,
    // and no legal-text/linkage/rule-pack/materiality/blocker/completeness/
    // terminal-status/trace/parcel-identity/machine-clock content anywhere.
    expect(Object.keys(result).sort()).toEqual(["asOfDate", "effectiveFrom", "identity", "kind"]);
  });

  test("at effectiveFrom (inclusive lower boundary) -> within interval", () => {
    expect(evaluateE85DesignationApplicability(validity, asOf("2020-01-01")).kind).toBe("DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL");
  });

  test("inside the interval -> within interval", () => {
    expect(evaluateE85DesignationApplicability(validity, asOf("2020-06-15")).kind).toBe("DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL");
  });

  test("at effectiveTo (inclusive upper boundary) -> within interval", () => {
    expect(evaluateE85DesignationApplicability(validity, asOf("2021-12-31")).kind).toBe("DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL");
  });

  test("after effectiveTo -> outside interval", () => {
    expect(evaluateE85DesignationApplicability(validity, asOf("2022-01-01"))).toEqual({
      kind: "DESIGNATION_OUTSIDE_CLOSED_INTERVAL",
      identity: IDENTITY,
      effectiveFrom: "2020-01-01",
      effectiveTo: "2021-12-31",
      asOfDate: "2022-01-01",
    });
  });

  test("single-day CLOSED interval: the one day is inclusive-inclusive applicable", () => {
    const singleDay: E85DesignationValidity = buildE85DesignationValidity({
      state: "CLOSED",
      identity: IDENTITY,
      start: { kind: "PARCEL_SPECIFIC_INSTRUMENT", effectiveFrom: "2024-07-04", instrumentLocator: LOCATOR },
      effectiveTo: "2024-07-04",
      end: { kind: "EXPRESS_REPEAL_OF_INSTRUMENT", effectiveTo: "2024-07-04", instrumentLocator: LOCATOR_2 },
    });
    expect(evaluateE85DesignationApplicability(singleDay, asOf("2024-07-03")).kind).toBe("DESIGNATION_NOT_YET_STARTED");
    expect(evaluateE85DesignationApplicability(singleDay, asOf("2024-07-04")).kind).toBe("DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL");
    expect(evaluateE85DesignationApplicability(singleDay, asOf("2024-07-05")).kind).toBe("DESIGNATION_OUTSIDE_CLOSED_INTERVAL");
  });
});

describe("evaluateE85DesignationApplicability — state 6: CONFLICTING_DESIGNATION_END", () => {
  const validity: E85DesignationValidity = buildE85DesignationValidity({
    state: "CONFLICTING_DESIGNATION_END",
    identity: IDENTITY,
    start: { kind: "MAP_AMENDMENT_OPERATIVE_DATE", effectiveFrom: "2020-01-01", instrumentLocator: LOCATOR },
    conflictingEndAuthorities: [
      { kind: "EXPRESS_REDESIGNATION", effectiveTo: "2021-06-30", instrumentLocator: LOCATOR },
      { kind: "EXPRESS_REPEAL_OF_INSTRUMENT", effectiveTo: "2021-12-31", instrumentLocator: LOCATOR_2 },
    ],
  });

  test.each(["2019-01-01", "2020-06-01", "2022-01-01"])("AS_OF %s -> DESIGNATION_END_CONFLICT (never 'unknown' or 'insufficient evidence')", (date) => {
    const result = evaluateE85DesignationApplicability(validity, asOf(date));
    expect(result).toEqual({ kind: "DESIGNATION_END_CONFLICT", identity: IDENTITY });
    expect(result.kind).not.toBe("DESIGNATION_NO_START_EVIDENCE");
    expect(result.kind).not.toBe("DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END");
  });
});

describe("evaluateE85DesignationApplicability — determinism and no-mutation", () => {
  const validity: E85DesignationValidity = buildE85DesignationValidity({
    state: "CLOSED",
    identity: IDENTITY,
    start: { kind: "MAP_AMENDMENT_OPERATIVE_DATE", effectiveFrom: "2020-01-01", instrumentLocator: LOCATOR },
    effectiveTo: "2021-12-31",
    end: { kind: "EXPRESS_REPEAL_OF_INSTRUMENT", effectiveTo: "2021-12-31", instrumentLocator: LOCATOR_2 },
  });
  const request = asOf("2020-06-01");

  test("same input twice yields deeply-equal output", () => {
    const first = evaluateE85DesignationApplicability(validity, request);
    const second = evaluateE85DesignationApplicability(validity, request);
    expect(first).toEqual(second);
  });

  test("input objects are not mutated", () => {
    const validityBefore = JSON.parse(JSON.stringify(validity));
    const requestBefore = JSON.parse(JSON.stringify(request));
    evaluateE85DesignationApplicability(validity, request);
    expect(validity).toEqual(validityBefore);
    expect(request).toEqual(requestBefore);
  });
});

describe("evaluateE85DesignationApplicability — malformed validity input", () => {
  test("an unrecognized validity state throws, never returned as a result", () => {
    const malformed = { state: "SOMETHING_ELSE", identity: IDENTITY } as unknown as E85DesignationValidity;
    expect(() => evaluateE85DesignationApplicability(malformed, asOf("2020-01-01"))).toThrow(E85DesignationApplicabilityError);
  });

  test("a null validity throws", () => {
    expect(() => evaluateE85DesignationApplicability(null as unknown as E85DesignationValidity, asOf("2020-01-01"))).toThrow(
      E85DesignationApplicabilityError,
    );
  });
});

describe("evaluateE85DesignationApplicability — compile-time exhaustiveness", () => {
  test("the result union's discriminant set is exactly the nine documented kinds (a `never`-narrowing compile check)", () => {
    function assertNever(x: never): never {
      throw new Error(`unreachable: ${JSON.stringify(x)}`);
    }

    function classify(result: E85DesignationApplicabilityResult): string {
      switch (result.kind) {
        case "DESIGNATION_APPLICABILITY_NOT_EVALUABLE":
        case "DESIGNATION_NO_START_EVIDENCE":
        case "DESIGNATION_START_CONFLICT":
        case "DESIGNATION_OBSERVATION_ONLY_NOT_LEGALLY_DATED":
        case "DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END":
        case "DESIGNATION_NOT_YET_STARTED":
        case "DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL":
        case "DESIGNATION_OUTSIDE_CLOSED_INTERVAL":
        case "DESIGNATION_END_CONFLICT":
          return result.kind;
        default:
          return assertNever(result);
      }
    }

    expect(classify({ kind: "DESIGNATION_APPLICABILITY_NOT_EVALUABLE" })).toBe("DESIGNATION_APPLICABILITY_NOT_EVALUABLE");
  });
});

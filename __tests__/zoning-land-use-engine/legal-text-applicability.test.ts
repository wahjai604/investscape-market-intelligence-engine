/**
 * InvestScape™ E85 — legal-text-version AS_OF applicability evaluator tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Synthetic identifiers only (SYNTH-SOURCE-* / SYNTH-VERSION-*) — no real
 * R1-1/C-2C/Feature 494642/Vancouver/Burnaby value is imported or referenced
 * anywhere here.
 */
import { buildE85VersionValidity, E85VersionValidity, E85StartAuthority, E85EndAuthority } from "../../src/zoning-land-use-engine/version-validity-types";
import { E85ResolvedTemporalRequest } from "../../src/zoning-land-use-engine/temporal-request-types";
import {
  evaluateE85LegalTextApplicability,
  E85LegalTextApplicabilityError,
  E85LegalTextApplicabilityResult,
} from "../../src/zoning-land-use-engine/legal-text-applicability";

function asOf(asOfDate: string): E85ResolvedTemporalRequest {
  return { kind: "RESOLVED", request: { mode: "AS_OF", asOfDate } };
}

const ABSENT: E85ResolvedTemporalRequest = { kind: "ABSENT" };
const CURRENT: E85ResolvedTemporalRequest = { kind: "RESOLVED", request: { mode: "CURRENT" } };

function startAuthority(effectiveFrom: string): E85StartAuthority {
  return {
    eventKind: "COMMENCEMENT",
    effectiveFrom,
    authoritySourceId: "SYNTH-SOURCE-1",
    authoritySourceVersionId: "SYNTH-VERSION-1",
    commencementLocator: { bylawOrDocumentId: "SYNTH-BYLAW-1", section: "1" },
    effectiveDateBasis: "SOURCE_STATED",
  };
}

function startAuthority2(effectiveFrom: string): E85StartAuthority {
  return {
    eventKind: "IN_FORCE",
    effectiveFrom,
    authoritySourceId: "SYNTH-SOURCE-2",
    authoritySourceVersionId: "SYNTH-VERSION-2",
    inForceLocator: { bylawOrDocumentId: "SYNTH-BYLAW-2", section: "2" },
    effectiveDateBasis: "SOURCE_STATED",
  };
}

function endAuthority(effectiveTo: string): E85EndAuthority {
  return {
    eventKind: "EXPRESS_REPEAL",
    effectiveTo,
    authoritySourceId: "SYNTH-SOURCE-1",
    authoritySourceVersionId: "SYNTH-VERSION-1",
    repealLocator: { bylawOrDocumentId: "SYNTH-BYLAW-3", section: "3" },
    effectiveDateBasis: "SOURCE_STATED",
  };
}

function endAuthority2(effectiveTo: string): E85EndAuthority {
  return {
    eventKind: "EXPRESS_EXPIRY",
    effectiveTo,
    authoritySourceId: "SYNTH-SOURCE-2",
    authoritySourceVersionId: "SYNTH-VERSION-2",
    expiryLocator: { bylawOrDocumentId: "SYNTH-BYLAW-4", section: "4" },
    effectiveDateBasis: "SOURCE_STATED",
  };
}

describe("evaluateE85LegalTextApplicability — resolved-request-mode handling", () => {
  const closed: E85VersionValidity = buildE85VersionValidity({
    state: "CLOSED",
    effectiveFrom: "2020-01-01",
    start: startAuthority("2020-01-01"),
    effectiveTo: "2021-12-31",
    end: endAuthority("2021-12-31"),
  });

  test("ABSENT is never evaluable", () => {
    expect(evaluateE85LegalTextApplicability(closed, ABSENT)).toEqual({ kind: "LEGAL_TEXT_APPLICABILITY_NOT_EVALUABLE" });
  });

  test("CURRENT is never evaluable — no clock is consulted to resolve it", () => {
    expect(evaluateE85LegalTextApplicability(closed, CURRENT)).toEqual({ kind: "LEGAL_TEXT_APPLICABILITY_NOT_EVALUABLE" });
  });

  test("AS_OF is evaluable", () => {
    const result = evaluateE85LegalTextApplicability(closed, asOf("2020-06-01"));
    expect(result.kind).toBe("LEGAL_TEXT_APPLICABLE_WITHIN_CLOSED_INTERVAL");
  });

  test("malformed resolvedRequest.kind throws, never returned as a result", () => {
    const malformed = { kind: "SOMETHING_ELSE" } as unknown as E85ResolvedTemporalRequest;
    expect(() => evaluateE85LegalTextApplicability(closed, malformed)).toThrow(E85LegalTextApplicabilityError);
  });

  test("malformed resolvedRequest.request.mode throws, never returned as a result", () => {
    const malformed = { kind: "RESOLVED", request: { mode: "BOGUS" } } as unknown as E85ResolvedTemporalRequest;
    expect(() => evaluateE85LegalTextApplicability(closed, malformed)).toThrow(E85LegalTextApplicabilityError);
  });

  test("malformed resolvedRequest (not an object) throws", () => {
    expect(() => evaluateE85LegalTextApplicability(closed, null as unknown as E85ResolvedTemporalRequest)).toThrow(
      E85LegalTextApplicabilityError,
    );
  });

  test("malformed validity (not an object) throws", () => {
    expect(() => evaluateE85LegalTextApplicability(null as unknown as E85VersionValidity, asOf("2020-01-01"))).toThrow(
      E85LegalTextApplicabilityError,
    );
  });

  test("unreachable/unrecognized validity.state throws defensively", () => {
    const bogus = { state: "SOMETHING_ELSE" } as unknown as E85VersionValidity;
    expect(() => evaluateE85LegalTextApplicability(bogus, asOf("2020-01-01"))).toThrow(E85LegalTextApplicabilityError);
  });
});

describe("evaluateE85LegalTextApplicability — state 1: START_UNKNOWN", () => {
  const validity: E85VersionValidity = buildE85VersionValidity({ state: "START_UNKNOWN" });

  test.each(["2019-01-01", "2020-01-01", "2025-06-15"])("AS_OF %s -> LEGAL_TEXT_NO_START_EVIDENCE", (date) => {
    expect(evaluateE85LegalTextApplicability(validity, asOf(date))).toEqual({ kind: "LEGAL_TEXT_NO_START_EVIDENCE" });
  });
});

describe("evaluateE85LegalTextApplicability — state 2: CONFLICTING_START", () => {
  const validity: E85VersionValidity = buildE85VersionValidity({
    state: "CONFLICTING_START",
    conflictingStartAssertions: [startAuthority("2020-01-01"), startAuthority2("2020-02-01")],
  });

  test.each(["2019-01-01", "2020-01-15", "2025-06-15"])("AS_OF %s -> LEGAL_TEXT_START_CONFLICT (never collapsed into 'unknown')", (date) => {
    const result = evaluateE85LegalTextApplicability(validity, asOf(date));
    expect(result).toEqual({ kind: "LEGAL_TEXT_START_CONFLICT" });
    expect(result.kind).not.toBe("LEGAL_TEXT_NO_START_EVIDENCE");
  });
});

describe("evaluateE85LegalTextApplicability — START_UNKNOWN vs CONFLICTING_START are genuinely distinct kinds", () => {
  test("distinct result kinds, asserted by name", () => {
    const startUnknown = evaluateE85LegalTextApplicability(buildE85VersionValidity({ state: "START_UNKNOWN" }), asOf("2020-01-01"));
    const conflictingStart = evaluateE85LegalTextApplicability(
      buildE85VersionValidity({
        state: "CONFLICTING_START",
        conflictingStartAssertions: [startAuthority("2020-01-01"), startAuthority2("2020-02-01")],
      }),
      asOf("2020-01-01"),
    );
    expect(startUnknown.kind).toBe("LEGAL_TEXT_NO_START_EVIDENCE");
    expect(conflictingStart.kind).toBe("LEGAL_TEXT_START_CONFLICT");
    expect(startUnknown.kind).not.toBe(conflictingStart.kind);
  });
});

describe("evaluateE85LegalTextApplicability — state 3: OPEN_UNRESEARCHED", () => {
  const validity: E85VersionValidity = buildE85VersionValidity({
    state: "OPEN_UNRESEARCHED",
    effectiveFrom: "2020-01-01",
    start: startAuthority("2020-01-01"),
  });

  test("immediately before effectiveFrom -> LEGAL_TEXT_NOT_YET_STARTED", () => {
    expect(evaluateE85LegalTextApplicability(validity, asOf("2019-12-31"))).toEqual({
      kind: "LEGAL_TEXT_NOT_YET_STARTED",
      effectiveFrom: "2020-01-01",
      asOfDate: "2019-12-31",
    });
  });

  test("exactly at effectiveFrom -> LEGAL_TEXT_POSSIBLY_APPLICABLE_OPEN_END, with limitation (never a bare YES)", () => {
    const result = evaluateE85LegalTextApplicability(validity, asOf("2020-01-01"));
    expect(result.kind).toBe("LEGAL_TEXT_POSSIBLY_APPLICABLE_OPEN_END");
    if (result.kind === "LEGAL_TEXT_POSSIBLY_APPLICABLE_OPEN_END") {
      expect(result.effectiveFrom).toBe("2020-01-01");
      expect(result.asOfDate).toBe("2020-01-01");
      expect(typeof result.limitation).toBe("string");
      expect(result.limitation.length).toBeGreaterThan(0);
    }
  });

  test("well after effectiveFrom -> LEGAL_TEXT_POSSIBLY_APPLICABLE_OPEN_END, still unproven", () => {
    const result = evaluateE85LegalTextApplicability(validity, asOf("2030-01-01"));
    expect(result.kind).toBe("LEGAL_TEXT_POSSIBLY_APPLICABLE_OPEN_END");
    if (result.kind === "LEGAL_TEXT_POSSIBLY_APPLICABLE_OPEN_END") {
      expect((result as { effectiveTo?: unknown }).effectiveTo).toBeUndefined();
    }
  });
});

describe("evaluateE85LegalTextApplicability — state 4: OPEN_REVIEWED_NO_END_ESTABLISHED", () => {
  const validity: E85VersionValidity = buildE85VersionValidity({
    state: "OPEN_REVIEWED_NO_END_ESTABLISHED",
    effectiveFrom: "2020-01-01",
    start: startAuthority("2020-01-01"),
    endReview: { sourcesChecked: ["SYNTH-SOURCE-REVIEW-1"], reviewedAt: "2024-01-01" },
  });

  test("before effectiveFrom -> LEGAL_TEXT_NOT_YET_STARTED", () => {
    expect(evaluateE85LegalTextApplicability(validity, asOf("2019-12-31"))).toEqual({
      kind: "LEGAL_TEXT_NOT_YET_STARTED",
      effectiveFrom: "2020-01-01",
      asOfDate: "2019-12-31",
    });
  });

  test("at/after effectiveFrom -> LEGAL_TEXT_POSSIBLY_APPLICABLE_OPEN_END, with limitation", () => {
    for (const date of ["2020-01-01", "2025-06-15"]) {
      const result = evaluateE85LegalTextApplicability(validity, asOf(date));
      expect(result.kind).toBe("LEGAL_TEXT_POSSIBLY_APPLICABLE_OPEN_END");
      if (result.kind === "LEGAL_TEXT_POSSIBLY_APPLICABLE_OPEN_END") {
        expect(result.limitation.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("evaluateE85LegalTextApplicability — state 5: CLOSED", () => {
  const validity: E85VersionValidity = buildE85VersionValidity({
    state: "CLOSED",
    effectiveFrom: "2020-01-01",
    start: startAuthority("2020-01-01"),
    effectiveTo: "2021-12-31",
    end: endAuthority("2021-12-31"),
  });

  test("immediately before effectiveFrom -> LEGAL_TEXT_NOT_YET_STARTED", () => {
    expect(evaluateE85LegalTextApplicability(validity, asOf("2019-12-31"))).toEqual({
      kind: "LEGAL_TEXT_NOT_YET_STARTED",
      effectiveFrom: "2020-01-01",
      asOfDate: "2019-12-31",
    });
  });

  test("exactly at effectiveFrom (inclusive start) -> LEGAL_TEXT_APPLICABLE_WITHIN_CLOSED_INTERVAL, with limitation", () => {
    const result = evaluateE85LegalTextApplicability(validity, asOf("2020-01-01"));
    expect(result.kind).toBe("LEGAL_TEXT_APPLICABLE_WITHIN_CLOSED_INTERVAL");
    if (result.kind === "LEGAL_TEXT_APPLICABLE_WITHIN_CLOSED_INTERVAL") {
      expect(result.limitation.length).toBeGreaterThan(0);
    }
  });

  test("within interval -> LEGAL_TEXT_APPLICABLE_WITHIN_CLOSED_INTERVAL", () => {
    expect(evaluateE85LegalTextApplicability(validity, asOf("2020-06-01")).kind).toBe("LEGAL_TEXT_APPLICABLE_WITHIN_CLOSED_INTERVAL");
  });

  test("exactly at effectiveTo (inclusive end) -> LEGAL_TEXT_APPLICABLE_WITHIN_CLOSED_INTERVAL", () => {
    const result = evaluateE85LegalTextApplicability(validity, asOf("2021-12-31"));
    expect(result.kind).toBe("LEGAL_TEXT_APPLICABLE_WITHIN_CLOSED_INTERVAL");
  });

  test("immediately after effectiveTo -> LEGAL_TEXT_OUTSIDE_CLOSED_INTERVAL, no limitation field", () => {
    const result = evaluateE85LegalTextApplicability(validity, asOf("2022-01-01"));
    expect(result).toEqual({
      kind: "LEGAL_TEXT_OUTSIDE_CLOSED_INTERVAL",
      effectiveFrom: "2020-01-01",
      effectiveTo: "2021-12-31",
      asOfDate: "2022-01-01",
    });
  });

  test("single-day CLOSED interval: at that day -> within; day before/after -> not-yet-started/outside", () => {
    const singleDay: E85VersionValidity = buildE85VersionValidity({
      state: "CLOSED",
      effectiveFrom: "2020-06-15",
      start: startAuthority("2020-06-15"),
      effectiveTo: "2020-06-15",
      end: endAuthority("2020-06-15"),
    });
    expect(evaluateE85LegalTextApplicability(singleDay, asOf("2020-06-14")).kind).toBe("LEGAL_TEXT_NOT_YET_STARTED");
    expect(evaluateE85LegalTextApplicability(singleDay, asOf("2020-06-15")).kind).toBe("LEGAL_TEXT_APPLICABLE_WITHIN_CLOSED_INTERVAL");
    expect(evaluateE85LegalTextApplicability(singleDay, asOf("2020-06-16")).kind).toBe("LEGAL_TEXT_OUTSIDE_CLOSED_INTERVAL");
  });
});

describe("evaluateE85LegalTextApplicability — state 6: CONFLICTING_END", () => {
  const validity: E85VersionValidity = buildE85VersionValidity({
    state: "CONFLICTING_END",
    effectiveFrom: "2020-01-01",
    start: startAuthority("2020-01-01"),
    conflictingEndAssertions: [endAuthority("2021-06-30"), endAuthority2("2021-12-31")],
  });

  test("immediately before the known effectiveFrom -> determinate LEGAL_TEXT_NOT_YET_STARTED", () => {
    expect(evaluateE85LegalTextApplicability(validity, asOf("2019-12-31"))).toEqual({
      kind: "LEGAL_TEXT_NOT_YET_STARTED",
      effectiveFrom: "2020-01-01",
      asOfDate: "2019-12-31",
    });
  });

  test("exactly at the known effectiveFrom -> LEGAL_TEXT_END_CONFLICT (indeterminate, never guesses)", () => {
    expect(evaluateE85LegalTextApplicability(validity, asOf("2020-01-01"))).toEqual({
      kind: "LEGAL_TEXT_END_CONFLICT",
      effectiveFrom: "2020-01-01",
      asOfDate: "2020-01-01",
    });
  });

  test("well after the known effectiveFrom (even past both disputed ends) -> still LEGAL_TEXT_END_CONFLICT, never resolved", () => {
    expect(evaluateE85LegalTextApplicability(validity, asOf("2030-01-01")).kind).toBe("LEGAL_TEXT_END_CONFLICT");
  });
});

describe("evaluateE85LegalTextApplicability — state 7: CONDITIONAL_PARTIAL_TERMINATION", () => {
  const validity: E85VersionValidity = buildE85VersionValidity({
    state: "CONDITIONAL_PARTIAL_TERMINATION",
    effectiveFrom: "2020-01-01",
    start: startAuthority("2020-01-01"),
    description: "SYNTH: partial termination clause, scope unresolved.",
  });

  test.each(["2019-01-01", "2020-01-01", "2020-06-15", "2030-01-01"])(
    "AS_OF %s -> ALWAYS LEGAL_TEXT_PARTIAL_TERMINATION_INDETERMINATE, regardless of date",
    (date) => {
      expect(evaluateE85LegalTextApplicability(validity, asOf(date))).toEqual({ kind: "LEGAL_TEXT_PARTIAL_TERMINATION_INDETERMINATE" });
    },
  );
});

describe("evaluateE85LegalTextApplicability — determinism / no wall-clock dependency", () => {
  test("output depends only on the resolvedRequest argument, not on when the test runs", () => {
    const validity: E85VersionValidity = buildE85VersionValidity({
      state: "CLOSED",
      effectiveFrom: "2020-01-01",
      start: startAuthority("2020-01-01"),
      effectiveTo: "2021-12-31",
      end: endAuthority("2021-12-31"),
    });
    const a = evaluateE85LegalTextApplicability(validity, asOf("2020-06-01"));
    const b = evaluateE85LegalTextApplicability(validity, asOf("2020-06-01"));
    expect(a).toEqual(b);
  });

  test("module source contains no Date.now()/new Date() call", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs");
    const path = require("path");
    const source: string = fs.readFileSync(path.join(__dirname, "../../src/zoning-land-use-engine/legal-text-applicability.ts"), "utf8");
    expect(source).not.toMatch(/Date\.now\(\)/);
    expect(source).not.toMatch(/new Date\(/);
  });
});

// Type-only sanity check: E85LegalTextApplicabilityResult remains importable
// and usable as a type at call sites, matching the designation-side export.
const _typeCheck: (v: E85LegalTextApplicabilityResult) => void = () => undefined;
void _typeCheck;

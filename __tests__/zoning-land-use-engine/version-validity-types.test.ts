/**
 * InvestScape™ E85 Phase 15.6 — version-validity contract tests, Slice 3B.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Synthetic identifiers only (TEST-JX / TEST-SOURCE / TEST-V1 / TEST-V2 /
 * TEST-999) — no Vancouver/Burnaby fixture is imported anywhere here.
 */
import * as fs from "fs";
import * as path from "path";
import {
  buildE85StartAuthority,
  buildE85EndAuthority,
  buildE85VersionValidity,
  E85VersionValidityError,
  E85StartAuthority,
  E85EndAuthority,
  E85VersionValidity,
  E85OperativeLocator,
} from "../../src/zoning-land-use-engine/version-validity-types";

const LOCATOR: E85OperativeLocator = { bylawOrDocumentId: "TEST-999", clause: "1" };
const LOCATOR_2: E85OperativeLocator = { bylawOrDocumentId: "TEST-999", clause: "2" };
const LOCATOR_3: E85OperativeLocator = { bylawOrDocumentId: "TEST-999", clause: "3" };

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

function inForce(overrides: Partial<Extract<E85StartAuthority, { eventKind: "IN_FORCE" }>> = {}): E85StartAuthority {
  return {
    eventKind: "IN_FORCE",
    effectiveFrom: "2020-01-01",
    authoritySourceId: "TEST-SOURCE",
    authoritySourceVersionId: "TEST-V1",
    inForceLocator: LOCATOR,
    effectiveDateBasis: "SOURCE_STATED",
    ...overrides,
  };
}

function immediate(overrides: Partial<Extract<E85StartAuthority, { eventKind: "IMMEDIATE_ON_ENACTMENT" }>> = {}): E85StartAuthority {
  return {
    eventKind: "IMMEDIATE_ON_ENACTMENT",
    effectiveFrom: "2020-01-01",
    enactmentDate: "2020-01-01",
    authoritySourceId: "TEST-SOURCE",
    authoritySourceVersionId: "TEST-V1",
    enactmentLocator: LOCATOR,
    expressImmediacyLocator: LOCATOR_2,
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

function expressExpiry(overrides: Partial<Extract<E85EndAuthority, { eventKind: "EXPRESS_EXPIRY" }>> = {}): E85EndAuthority {
  return {
    eventKind: "EXPRESS_EXPIRY",
    effectiveTo: "2021-12-31",
    authoritySourceId: "TEST-SOURCE",
    authoritySourceVersionId: "TEST-V2",
    expiryLocator: LOCATOR,
    effectiveDateBasis: "SOURCE_STATED",
    ...overrides,
  };
}

function replacementWithRepeal(overrides: Partial<Extract<E85EndAuthority, { eventKind: "REPLACEMENT_WITH_EXPRESS_REPEAL" }>> = {}): E85EndAuthority {
  return {
    eventKind: "REPLACEMENT_WITH_EXPRESS_REPEAL",
    effectiveTo: "2021-12-31",
    authoritySourceId: "TEST-SOURCE",
    authoritySourceVersionId: "TEST-V2",
    repealLocator: LOCATOR,
    effectiveDateBasis: "SOURCE_STATED",
    successorSourceId: "TEST-SOURCE",
    successorSourceVersionId: "TEST-V2",
    ...overrides,
  };
}

describe("E85 Phase 15.6 — buildE85StartAuthority", () => {
  test("1. valid COMMENCEMENT is accepted", () => {
    expect(buildE85StartAuthority(commencement())).toEqual(commencement());
  });

  test("2. valid IN_FORCE is accepted", () => {
    expect(buildE85StartAuthority(inForce())).toEqual(inForce());
  });

  test("3. valid IMMEDIATE_ON_ENACTMENT is accepted", () => {
    expect(buildE85StartAuthority(immediate())).toEqual(immediate());
  });

  test("4. malformed start date is rejected", () => {
    expect(() => buildE85StartAuthority(commencement({ effectiveFrom: "2020-13-40" }))).toThrow(E85VersionValidityError);
  });

  test("5. invalid calendar date (April 31) is rejected", () => {
    expect(() => buildE85StartAuthority(commencement({ effectiveFrom: "2020-04-31" }))).toThrow(E85VersionValidityError);
  });

  test("6. valid leap day (2024-02-29) is accepted", () => {
    expect(buildE85StartAuthority(commencement({ effectiveFrom: "2024-02-29" })).effectiveFrom).toBe("2024-02-29");
  });

  test("7. invalid leap day (2023-02-29) is rejected", () => {
    expect(() => buildE85StartAuthority(commencement({ effectiveFrom: "2023-02-29" }))).toThrow(E85VersionValidityError);
  });

  test("8. empty authoritySourceId is rejected", () => {
    expect(() => buildE85StartAuthority(commencement({ authoritySourceId: "" }))).toThrow(E85VersionValidityError);
  });

  test("9. empty authoritySourceVersionId is rejected", () => {
    expect(() => buildE85StartAuthority(commencement({ authoritySourceVersionId: "" }))).toThrow(E85VersionValidityError);
  });

  test("10. empty operative locator is rejected", () => {
    expect(() => buildE85StartAuthority(commencement({ commencementLocator: {} }))).toThrow(E85VersionValidityError);
  });

  test("11. IMMEDIATE_ON_ENACTMENT with differing dates is rejected", () => {
    expect(() => buildE85StartAuthority(immediate({ effectiveFrom: "2020-01-02" }))).toThrow(/effectiveFrom to equal enactmentDate/);
  });

  test("12. IMMEDIATE_ON_ENACTMENT with missing express-immediacy locator is rejected", () => {
    expect(() => buildE85StartAuthority(immediate({ expressImmediacyLocator: {} }))).toThrow(E85VersionValidityError);
  });

  test("13. matching dates without express-immediacy proof are rejected (empty locator, dates agree)", () => {
    expect(() =>
      buildE85StartAuthority(immediate({ effectiveFrom: "2020-05-05", enactmentDate: "2020-05-05", expressImmediacyLocator: {} })),
    ).toThrow(E85VersionValidityError);
  });

  test("14. adoption-only/bare-enactment-only shapes cannot be represented through the closed union", () => {
    const bareAdoption = { eventKind: "ADOPTION", effectiveFrom: "2020-01-01" } as unknown as E85StartAuthority;
    expect(() => buildE85StartAuthority(bareAdoption)).toThrow(/eventKind must be one of/);
    const bareEnactment = {
      eventKind: "ENACTMENT",
      effectiveFrom: "2020-01-01",
      authoritySourceId: "TEST-SOURCE",
      authoritySourceVersionId: "TEST-V1",
    } as unknown as E85StartAuthority;
    expect(() => buildE85StartAuthority(bareEnactment)).toThrow(/eventKind must be one of/);
  });

  test("15. builder does not mutate its input", () => {
    const input = commencement();
    const before = JSON.stringify(input);
    buildE85StartAuthority(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe("E85 Phase 15.6 — buildE85EndAuthority", () => {
  test("16. valid EXPRESS_REPEAL is accepted", () => {
    expect(buildE85EndAuthority(expressRepeal())).toEqual(expressRepeal());
  });

  test("17. valid EXPRESS_EXPIRY is accepted", () => {
    expect(buildE85EndAuthority(expressExpiry())).toEqual(expressExpiry());
  });

  test("18. valid REPLACEMENT_WITH_EXPRESS_REPEAL is accepted", () => {
    expect(buildE85EndAuthority(replacementWithRepeal())).toEqual(replacementWithRepeal());
  });

  test("19. malformed end date is rejected", () => {
    expect(() => buildE85EndAuthority(expressRepeal({ effectiveTo: "2021-02-30" }))).toThrow(E85VersionValidityError);
  });

  test("20. empty end locator is rejected", () => {
    expect(() => buildE85EndAuthority(expressRepeal({ repealLocator: {} }))).toThrow(E85VersionValidityError);
  });

  test("21. replacement without express repeal cannot be represented (unrecognized eventKind)", () => {
    const malformed = {
      eventKind: "REPLACEMENT",
      effectiveTo: "2021-12-31",
      authoritySourceId: "TEST-SOURCE",
      authoritySourceVersionId: "TEST-V2",
      successorSourceId: "TEST-SOURCE",
      successorSourceVersionId: "TEST-V2",
    } as unknown as E85EndAuthority;
    expect(() => buildE85EndAuthority(malformed)).toThrow(/eventKind must be one of/);
  });

  test("22. successor identity alone (no repeal locator/eventKind) cannot construct end authority", () => {
    const successorOnly = {
      eventKind: "SUCCEEDED_BY",
      effectiveTo: "2021-12-31",
      successorSourceId: "TEST-SOURCE",
      successorSourceVersionId: "TEST-V2",
    } as unknown as E85EndAuthority;
    expect(() => buildE85EndAuthority(successorOnly)).toThrow(/eventKind must be one of/);
  });

  test("23. builder does not mutate its input", () => {
    const input = replacementWithRepeal();
    const before = JSON.stringify(input);
    buildE85EndAuthority(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe("E85 Phase 15.6 — buildE85VersionValidity", () => {
  test("24. valid START_UNKNOWN is accepted", () => {
    expect(buildE85VersionValidity({ state: "START_UNKNOWN" })).toEqual({ state: "START_UNKNOWN" });
  });

  test("25. valid CONFLICTING_START (>=2 distinct) is accepted", () => {
    const input: E85VersionValidity = {
      state: "CONFLICTING_START",
      conflictingStartAssertions: [commencement(), commencement({ effectiveFrom: "2020-02-01" })],
    };
    const result = buildE85VersionValidity(input);
    expect(result.state).toBe("CONFLICTING_START");
  });

  test("26. valid OPEN_UNRESEARCHED is accepted", () => {
    const input: E85VersionValidity = { state: "OPEN_UNRESEARCHED", effectiveFrom: "2020-01-01", start: commencement() };
    expect(buildE85VersionValidity(input)).toEqual(input);
  });

  test("27. valid OPEN_REVIEWED_NO_END_ESTABLISHED (with review evidence) is accepted", () => {
    const input: E85VersionValidity = {
      state: "OPEN_REVIEWED_NO_END_ESTABLISHED",
      effectiveFrom: "2020-01-01",
      start: commencement(),
      endReview: { sourcesChecked: ["TEST-SOURCE"], reviewedAt: "2026-01-01" },
    };
    expect(buildE85VersionValidity(input)).toEqual(input);
  });

  test("28. valid CLOSED interval is accepted", () => {
    const input: E85VersionValidity = {
      state: "CLOSED",
      effectiveFrom: "2020-01-01",
      start: commencement(),
      effectiveTo: "2021-12-31",
      end: expressRepeal(),
    };
    expect(buildE85VersionValidity(input)).toEqual(input);
  });

  test("29. single-day CLOSED interval (effectiveTo === effectiveFrom) is accepted", () => {
    const input: E85VersionValidity = {
      state: "CLOSED",
      effectiveFrom: "2020-01-01",
      start: commencement({ effectiveFrom: "2020-01-01" }),
      effectiveTo: "2020-01-01",
      end: expressRepeal({ effectiveTo: "2020-01-01" }),
    };
    expect(buildE85VersionValidity(input).state).toBe("CLOSED");
  });

  test("30. valid CONFLICTING_END is accepted", () => {
    const input: E85VersionValidity = {
      state: "CONFLICTING_END",
      effectiveFrom: "2020-01-01",
      start: commencement(),
      conflictingEndAssertions: [expressRepeal(), expressExpiry({ effectiveTo: "2022-06-30" })],
    };
    expect(buildE85VersionValidity(input).state).toBe("CONFLICTING_END");
  });

  test("31. valid CONDITIONAL_PARTIAL_TERMINATION is accepted", () => {
    const input: E85VersionValidity = {
      state: "CONDITIONAL_PARTIAL_TERMINATION",
      effectiveFrom: "2020-01-01",
      start: commencement(),
      description: "Transition clause TEST-999 cl.3 partially terminates one use; reviewer must read the clause directly.",
    };
    expect(buildE85VersionValidity(input)).toEqual(input);
  });

  test("32. the eighth state: end before start is rejected (structural invalid-interval throw)", () => {
    const input: E85VersionValidity = {
      state: "CLOSED",
      effectiveFrom: "2021-01-01",
      start: commencement({ effectiveFrom: "2021-01-01" }),
      effectiveTo: "2020-01-01",
      end: expressRepeal({ effectiveTo: "2020-01-01" }),
    };
    expect(() => buildE85VersionValidity(input)).toThrow(E85VersionValidityError);
    expect(() => buildE85VersionValidity(input)).toThrow(/structurally invalid/);
  });

  test("33. CLOSED without end authority is rejected", () => {
    const input = { state: "CLOSED", effectiveFrom: "2020-01-01", start: commencement(), effectiveTo: "2021-12-31" } as unknown as E85VersionValidity;
    expect(() => buildE85VersionValidity(input)).toThrow(E85VersionValidityError);
  });

  test("34. endpoint date/authority mismatch is rejected (wrapper effectiveTo disagrees with end.effectiveTo)", () => {
    const input: E85VersionValidity = {
      state: "CLOSED",
      effectiveFrom: "2020-01-01",
      start: commencement(),
      effectiveTo: "2021-11-30",
      end: expressRepeal({ effectiveTo: "2021-12-31" }),
    };
    expect(() => buildE85VersionValidity(input)).toThrow(/does not match end authority's own effectiveTo/);
  });

  test("35. wrapper effectiveFrom disagreeing with start.effectiveFrom is rejected", () => {
    const input: E85VersionValidity = {
      state: "OPEN_UNRESEARCHED",
      effectiveFrom: "2020-06-01",
      start: commencement({ effectiveFrom: "2020-01-01" }),
    };
    expect(() => buildE85VersionValidity(input)).toThrow(/does not match start authority's own effectiveFrom/);
  });

  test("36. provenance mismatch (expectedAuthoritySourceId) is rejected", () => {
    const input: E85VersionValidity = {
      state: "OPEN_UNRESEARCHED",
      effectiveFrom: "2020-01-01",
      start: commencement(),
      expectedAuthoritySourceId: "TEST-OTHER-SOURCE",
    };
    expect(() => buildE85VersionValidity(input)).toThrow(/expected authoritySourceId/);
  });

  test("37. reviewed/no-end without review evidence is rejected", () => {
    const input = {
      state: "OPEN_REVIEWED_NO_END_ESTABLISHED",
      effectiveFrom: "2020-01-01",
      start: commencement(),
    } as unknown as E85VersionValidity;
    expect(() => buildE85VersionValidity(input)).toThrow(E85VersionValidityError);
  });

  test("38. conflict with fewer than two assertions is rejected", () => {
    const input: E85VersionValidity = { state: "CONFLICTING_START", conflictingStartAssertions: [commencement()] };
    expect(() => buildE85VersionValidity(input)).toThrow(/requires at least two/);
  });

  test("39. exact duplicate conflict assertions are rejected", () => {
    const input: E85VersionValidity = { state: "CONFLICTING_START", conflictingStartAssertions: [commencement(), commencement()] };
    expect(() => buildE85VersionValidity(input)).toThrow(/duplicate assertions|genuinely distinct/);
  });

  test("40. conflict assertions with same date but not exact duplicates still rejected as not genuinely distinct", () => {
    const input: E85VersionValidity = {
      state: "CONFLICTING_START",
      conflictingStartAssertions: [commencement(), commencement({ authoritySourceVersionId: "TEST-V1-ALT" })],
    };
    expect(() => buildE85VersionValidity(input)).toThrow(/genuinely distinct/);
  });

  test("41. attempting to encode partial termination as ordinary CLOSED is structurally impossible (no end/effectiveTo path)", () => {
    // CONDITIONAL_PARTIAL_TERMINATION carries no `end`/`effectiveTo` field at all,
    // so passing one through the CLOSED branch (the "generic closed interval
    // validation path") requires an explicit state of "CLOSED" with a real
    // E85EndAuthority — a conditional/partial input with only a description
    // can never satisfy it.
    const disguised = {
      state: "CLOSED",
      effectiveFrom: "2020-01-01",
      start: commencement(),
      description: "attempted downgrade",
    } as unknown as E85VersionValidity;
    expect(() => buildE85VersionValidity(disguised)).toThrow(E85VersionValidityError);
  });

  test("42. constructor does not mutate input", () => {
    const input: E85VersionValidity = {
      state: "CLOSED",
      effectiveFrom: "2020-01-01",
      start: commencement(),
      effectiveTo: "2021-12-31",
      end: expressRepeal(),
    };
    const before = JSON.stringify(input);
    buildE85VersionValidity(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  test("43. unrecognized state is rejected deterministically", () => {
    const input = { state: "SUPERSEDED" } as unknown as E85VersionValidity;
    expect(() => buildE85VersionValidity(input)).toThrow(/state must be one of/);
  });
});

describe("E85 Phase 15.6 — determinism and isolation", () => {
  test("44. same valid input yields deeply equal output across repeated calls", () => {
    const input = commencement();
    expect(buildE85StartAuthority(input)).toEqual(buildE85StartAuthority(input));
  });

  test("45. same invalid input yields identical error type/message across repeated calls", () => {
    const input = commencement({ authoritySourceId: "" });
    let first: unknown;
    let second: unknown;
    try {
      buildE85StartAuthority(input);
    } catch (e) {
      first = e;
    }
    try {
      buildE85StartAuthority(input);
    } catch (e) {
      second = e;
    }
    expect(first).toBeInstanceOf(E85VersionValidityError);
    expect((first as Error).message).toBe((second as Error).message);
  });

  test("46. production file source contains no Date/Date.now/new Date usage", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../../src/zoning-land-use-engine/version-validity-types.ts"),
      "utf8",
    );
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(/\bDate\.now\s*\(/.test(code)).toBe(false);
    expect(/\bnew\s+Date\s*\(/.test(code)).toBe(false);
    // No bare `Date` type/value usage outside of the two patterns above either.
    expect(/[^.\w]Date\b(?!\.now)/.test(code.replace(/new\s+Date/g, ""))).toBe(false);
  });

  test("47. production file contains no jurisdiction-specific fields/branching", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../../src/zoning-land-use-engine/version-validity-types.ts"),
      "utf8",
    );
    for (const term of [/vancouver/i, /burnaby/i, /\bR1-1\b/, /\bC-2C\b/]) {
      expect(term.test(source)).toBe(false);
    }
  });

  test("48. production file has no forbidden imports", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../../src/zoning-land-use-engine/version-validity-types.ts"),
      "utf8",
    );
    const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    const forbiddenSubstrings = [
      "provenance-types",
      "registry",
      "composer",
      "evaluator",
      "linkage",
      "temporal-selection",
      "normalized-bundle",
      "adapters",
      "rule-pack-composer",
      "decision-",
    ];
    for (const specifier of imports) {
      for (const forbidden of forbiddenSubstrings) {
        expect(specifier.includes(forbidden)).toBe(false);
      }
    }
    expect(imports).toEqual(["./evidence-types"]);
  });

  test("49. no field named selectedCandidateId or decision-status vocabulary appears in this contract's code (comments stripped)", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../../src/zoning-land-use-engine/version-validity-types.ts"),
      "utf8",
    );
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const term of ["selectedCandidateId", "MANUAL_REVIEW_REQUIRED", "TERMINAL", "materiality"]) {
      expect(code.includes(term)).toBe(false);
    }
  });

  test("50. no import statement in the file reaches provenance-types.ts or names E85TemporalAuthority as an import", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../../src/zoning-land-use-engine/version-validity-types.ts"),
      "utf8",
    );
    const importLines = source.split("\n").filter((line) => /^\s*import\b/.test(line));
    for (const line of importLines) {
      expect(line.includes("provenance-types")).toBe(false);
      expect(line.includes("E85TemporalAuthority")).toBe(false);
    }
  });

  test("51. no use of `any` in the production file's executable/type code", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../../src/zoning-land-use-engine/version-validity-types.ts"),
      "utf8",
    );
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(/\bany\b/.test(code)).toBe(false);
  });
});

/**
 * Slice 3B Targeted Validation Remediation. The freeze audit found that
 * required text fields used `value.length > 0` instead of trimmed
 * non-emptiness, so whitespace-only strings (spaces, tabs, newlines, mixed)
 * incorrectly passed validation. These tests prove every required textual
 * field across start authority, end authority, and validity-state contracts
 * now rejects whitespace-only values via `value.trim().length > 0` semantics,
 * without the stored value itself being silently trimmed/normalized.
 */
const WHITESPACE_ONLY_VALUES = ["", " ", "\t", "\n", " \t\n "];

describe("E85 Phase 15.6B — whitespace-only required text fields are rejected", () => {
  test.each(WHITESPACE_ONLY_VALUES)("start authoritySourceId %j is rejected", (value) => {
    expect(() => buildE85StartAuthority(commencement({ authoritySourceId: value }))).toThrow(E85VersionValidityError);
  });

  test.each(WHITESPACE_ONLY_VALUES)("start authoritySourceVersionId %j is rejected", (value) => {
    expect(() => buildE85StartAuthority(commencement({ authoritySourceVersionId: value }))).toThrow(E85VersionValidityError);
  });

  test.each(WHITESPACE_ONLY_VALUES)("start commencementLocator with only whitespace content %j is rejected", (value) => {
    expect(() => buildE85StartAuthority(commencement({ commencementLocator: { bylawOrDocumentId: value } }))).toThrow(
      E85VersionValidityError,
    );
  });

  test.each(WHITESPACE_ONLY_VALUES)("IMMEDIATE_ON_ENACTMENT enactmentLocator with only whitespace content %j is rejected", (value) => {
    expect(() => buildE85StartAuthority(immediate({ enactmentLocator: { bylawOrDocumentId: value } }))).toThrow(
      E85VersionValidityError,
    );
  });

  test.each(WHITESPACE_ONLY_VALUES)(
    "IMMEDIATE_ON_ENACTMENT expressImmediacyLocator with only whitespace content %j is rejected",
    (value) => {
      expect(() => buildE85StartAuthority(immediate({ expressImmediacyLocator: { bylawOrDocumentId: value } }))).toThrow(
        E85VersionValidityError,
      );
    },
  );

  test.each(WHITESPACE_ONLY_VALUES)("end authoritySourceId %j is rejected", (value) => {
    expect(() => buildE85EndAuthority(expressRepeal({ authoritySourceId: value }))).toThrow(E85VersionValidityError);
  });

  test.each(WHITESPACE_ONLY_VALUES)("end authoritySourceVersionId %j is rejected", (value) => {
    expect(() => buildE85EndAuthority(expressRepeal({ authoritySourceVersionId: value }))).toThrow(E85VersionValidityError);
  });

  test.each(WHITESPACE_ONLY_VALUES)("end repealLocator with only whitespace content %j is rejected", (value) => {
    expect(() => buildE85EndAuthority(expressRepeal({ repealLocator: { bylawOrDocumentId: value } }))).toThrow(
      E85VersionValidityError,
    );
  });

  test.each(WHITESPACE_ONLY_VALUES)("successorSourceId %j is rejected", (value) => {
    expect(() => buildE85EndAuthority(replacementWithRepeal({ successorSourceId: value }))).toThrow(E85VersionValidityError);
  });

  test.each(WHITESPACE_ONLY_VALUES)("successorSourceVersionId %j is rejected", (value) => {
    expect(() => buildE85EndAuthority(replacementWithRepeal({ successorSourceVersionId: value }))).toThrow(
      E85VersionValidityError,
    );
  });

  test.each(WHITESPACE_ONLY_VALUES)("endReview.sourcesChecked entry %j is rejected", (value) => {
    const input: E85VersionValidity = {
      state: "OPEN_REVIEWED_NO_END_ESTABLISHED",
      effectiveFrom: "2020-01-01",
      start: commencement(),
      endReview: { sourcesChecked: [value], reviewedAt: "2026-01-01" },
    };
    expect(() => buildE85VersionValidity(input)).toThrow(E85VersionValidityError);
  });

  test.each(WHITESPACE_ONLY_VALUES)("CONDITIONAL_PARTIAL_TERMINATION description %j is rejected", (value) => {
    const input: E85VersionValidity = {
      state: "CONDITIONAL_PARTIAL_TERMINATION",
      effectiveFrom: "2020-01-01",
      start: commencement(),
      description: value,
    };
    expect(() => buildE85VersionValidity(input)).toThrow(E85VersionValidityError);
  });

  test("a non-whitespace value with incidental leading/trailing whitespace is still accepted and NOT silently trimmed/normalized in the stored output", () => {
    const result = buildE85StartAuthority(commencement({ authoritySourceId: "  TEST-SOURCE  " }));
    expect(result.authoritySourceId).toBe("  TEST-SOURCE  ");
  });
});

describe("E85 Phase 15.6B — IMMEDIATE_ON_ENACTMENT locator-equality policy (explicit non-change)", () => {
  test("equal, non-empty enactmentLocator and expressImmediacyLocator values ARE accepted together (same authoritative clause may validly serve both roles)", () => {
    const sharedLocator: E85OperativeLocator = { bylawOrDocumentId: "TEST-999", clause: "1" };
    const input = immediate({ enactmentLocator: sharedLocator, expressImmediacyLocator: sharedLocator });
    expect(buildE85StartAuthority(input)).toEqual(input);
  });

  test("both enactmentLocator and expressImmediacyLocator individually remain required (whitespace-only rejected even when the other is valid)", () => {
    expect(() =>
      buildE85StartAuthority(immediate({ enactmentLocator: { bylawOrDocumentId: " \t " } })),
    ).toThrow(E85VersionValidityError);
    expect(() =>
      buildE85StartAuthority(immediate({ expressImmediacyLocator: { bylawOrDocumentId: " \t " } })),
    ).toThrow(E85VersionValidityError);
  });
});

describe("E85 Phase 15.6B — canonical date century leap-year exceptions", () => {
  test("1900-02-29 is rejected (divisible by 100 but not by 400 — not a leap year)", () => {
    expect(() => buildE85StartAuthority(commencement({ effectiveFrom: "1900-02-29" }))).toThrow(E85VersionValidityError);
  });

  test("2000-02-29 is accepted (divisible by 400 — the century-exception restoration)", () => {
    expect(buildE85StartAuthority(commencement({ effectiveFrom: "2000-02-29" })).effectiveFrom).toBe("2000-02-29");
  });
});

describe("E85 Phase 15.6B — effectiveDateBasis runtime vocabulary check", () => {
  // The prior audit noted `requireEffectiveDateBasis` already validates against
  // `VALID_EFFECTIVE_DATE_BASES.includes(...)` at runtime, but no test exercised
  // the rejection path. This closes that coverage gap; no production change was
  // needed or made for this item.
  test("a malformed/unrecognized effectiveDateBasis string is rejected at runtime", () => {
    const input = { ...commencement(), effectiveDateBasis: "NOT_A_REAL_BASIS" } as unknown as E85StartAuthority;
    expect(() => buildE85StartAuthority(input)).toThrow(E85VersionValidityError);
    expect(() => buildE85StartAuthority(input)).toThrow(/recognized effective-date basis/);
  });
});

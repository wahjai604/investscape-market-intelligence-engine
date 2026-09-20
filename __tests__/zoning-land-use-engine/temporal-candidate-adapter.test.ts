/**
 * InvestScape™ E85 Phase 15.8 — temporal candidate adapter tests, Slice 3C.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Synthetic identifiers only (TEST-JX / TEST-SOURCE / TEST-V1 / TEST-V2 /
 * TEST-999 / TEST-ZONE) — no Vancouver/Burnaby/R1-1/C-2C fixture is imported
 * anywhere here.
 */
import * as fs from "fs";
import * as path from "path";
import { selectE85TemporalCandidate } from "../../src/zoning-land-use-engine/temporal-selection";
import type { E85TemporalCandidate } from "../../src/zoning-land-use-engine/temporal-selection";
import type { E85NormalizedRuleBundle } from "../../src/zoning-land-use-engine/normalized-bundle-types";
import {
  E85VersionValidity,
  E85StartAuthority,
  E85EndAuthority,
  E85OperativeLocator,
} from "../../src/zoning-land-use-engine/version-validity-types";
import {
  buildE85TemporalCandidateFromVersionValidity,
  E85TemporalCandidateAdapterError,
  E85TemporalCandidateAdapterResult,
} from "../../src/zoning-land-use-engine/temporal-candidate-adapter";

const LOCATOR: E85OperativeLocator = { bylawOrDocumentId: "TEST-999", clause: "1" };
const LOCATOR_2: E85OperativeLocator = { bylawOrDocumentId: "TEST-999", clause: "2" };

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

describe("E85 Phase 15.8 — selector consequence (why open states must not create candidates)", () => {
  test("1. an existing selector treats effectiveTo: undefined as unbounded, selecting a candidate at AS_OF far in the future", () => {
    const candidate: E85TemporalCandidate = {
      candidateId: "TEST",
      temporal: { effectiveFrom: "2020-01-01", effectiveTo: undefined, effectiveDateBasis: "SOURCE_STATED" },
    };
    const result = selectE85TemporalCandidate({ kind: "RESOLVED", request: { mode: "AS_OF", asOfDate: "2100-01-01" } }, [candidate]);
    expect(result.kind).toBe("SELECTED");
    expect(result.selectedCandidateId).toBe("TEST");
  });

  test("2. the selector cannot see any wrapper-level qualification stored beside a candidate", () => {
    const candidate: E85TemporalCandidate = {
      candidateId: "TEST",
      temporal: { effectiveFrom: "2020-01-01", effectiveTo: undefined, effectiveDateBasis: "SOURCE_STATED" },
    };
    // A qualification object exists only in the test's own scope; nothing in
    // `candidate` carries it, and `selectE85TemporalCandidate`'s signature
    // accepts only `E85TemporalCandidate[]` — there is no channel for it.
    const qualification = { kind: "END_NOT_RESEARCHED" as const };
    const result = selectE85TemporalCandidate({ kind: "RESOLVED", request: { mode: "AS_OF", asOfDate: "2100-01-01" } }, [candidate]);
    expect(result.kind).toBe("SELECTED");
    expect(qualification.kind).toBe("END_NOT_RESEARCHED"); // exists, but selection ignored it
  });
});

describe("E85 Phase 15.8 — seven-state mapping", () => {
  test("3. START_UNKNOWN returns correct outcome and has no candidate property", () => {
    const result = buildE85TemporalCandidateFromVersionValidity(bundle(), { state: "START_UNKNOWN" });
    expect(result.outcome).toBe("START_UNKNOWN");
    expect("candidate" in result).toBe(false);
  });

  test("4. CONFLICTING_START preserves assertions and has no candidate", () => {
    const assertions = [commencement(), commencement({ effectiveFrom: "2020-02-01" })];
    const result = buildE85TemporalCandidateFromVersionValidity(bundle(), {
      state: "CONFLICTING_START",
      conflictingStartAssertions: assertions,
    });
    expect(result.outcome).toBe("CONFLICTING_START");
    expect("candidate" in result).toBe(false);
    if (result.outcome === "CONFLICTING_START") {
      expect(result.conflictingStartAssertions).toEqual(assertions);
    }
  });

  test("5. OPEN_UNRESEARCHED preserves start evidence and has no candidate", () => {
    const result = buildE85TemporalCandidateFromVersionValidity(bundle(), {
      state: "OPEN_UNRESEARCHED",
      effectiveFrom: "2020-01-01",
      start: commencement(),
    });
    expect(result.outcome).toBe("OPEN_END_UNRESEARCHED");
    expect("candidate" in result).toBe(false);
    if (result.outcome === "OPEN_END_UNRESEARCHED") {
      expect(result.evidence.effectiveFrom).toBe("2020-01-01");
      expect(result.evidence.start).toEqual(commencement());
    }
  });

  test("6. OPEN_REVIEWED_NO_END_ESTABLISHED preserves reviewedAt and sourcesChecked, does not create effectiveTo, and has no candidate", () => {
    const result = buildE85TemporalCandidateFromVersionValidity(bundle(), {
      state: "OPEN_REVIEWED_NO_END_ESTABLISHED",
      effectiveFrom: "2020-01-01",
      start: commencement(),
      endReview: { sourcesChecked: ["TEST-SOURCE"], reviewedAt: "2026-01-01" },
    });
    expect(result.outcome).toBe("OPEN_END_REVIEWED_NO_END_ESTABLISHED");
    expect("candidate" in result).toBe(false);
    if (result.outcome === "OPEN_END_REVIEWED_NO_END_ESTABLISHED") {
      expect(result.evidence.reviewedAt).toBe("2026-01-01");
      expect(result.evidence.sourcesChecked).toEqual(["TEST-SOURCE"]);
      expect("effectiveTo" in result.evidence).toBe(false);
    }
  });

  test("7. CLOSED produces CANDIDATE with exact start/end dates", () => {
    const result = buildE85TemporalCandidateFromVersionValidity(bundle(), {
      state: "CLOSED",
      effectiveFrom: "2020-01-01",
      start: commencement(),
      effectiveTo: "2021-12-31",
      end: expressRepeal(),
    });
    expect(result.outcome).toBe("CANDIDATE");
    if (result.outcome === "CANDIDATE") {
      expect(result.candidate.temporal.effectiveFrom).toBe("2020-01-01");
      expect(result.candidate.temporal.effectiveTo).toBe("2021-12-31");
    }
  });

  test("8. CLOSED candidate object is newly constructed (not aliased from validity)", () => {
    const validity: E85VersionValidity = {
      state: "CLOSED",
      effectiveFrom: "2020-01-01",
      start: commencement(),
      effectiveTo: "2021-12-31",
      end: expressRepeal(),
    };
    const result = buildE85TemporalCandidateFromVersionValidity(bundle(), validity);
    if (result.outcome === "CANDIDATE") {
      expect(result.candidate).not.toBe(validity as unknown);
      expect((result.candidate as unknown as { start?: unknown }).start).toBeUndefined();
    }
  });

  test("9. CONFLICTING_END preserves assertions and has no candidate", () => {
    const assertions = [expressRepeal(), expressRepeal({ effectiveTo: "2022-06-30" })];
    const result = buildE85TemporalCandidateFromVersionValidity(bundle(), {
      state: "CONFLICTING_END",
      effectiveFrom: "2020-01-01",
      start: commencement(),
      conflictingEndAssertions: assertions,
    });
    expect(result.outcome).toBe("CONFLICTING_END");
    expect("candidate" in result).toBe(false);
    if (result.outcome === "CONFLICTING_END") {
      expect(result.conflictingEndAssertions).toEqual(assertions);
    }
  });

  test("10. partial termination preserves its evidence and has no candidate", () => {
    const result = buildE85TemporalCandidateFromVersionValidity(bundle(), {
      state: "CONDITIONAL_PARTIAL_TERMINATION",
      effectiveFrom: "2020-01-01",
      start: commencement(),
      description: "Transition clause TEST-999 cl.3 partially terminates one use.",
    });
    expect(result.outcome).toBe("PARTIAL_TERMINATION");
    expect("candidate" in result).toBe(false);
    if (result.outcome === "PARTIAL_TERMINATION") {
      expect(result.description).toBe("Transition clause TEST-999 cl.3 partially terminates one use.");
    }
  });

  test("11. compile-time assertion: only CANDIDATE's shape is assignable to a value requiring an E85TemporalCandidate field", () => {
    const result: E85TemporalCandidateAdapterResult = buildE85TemporalCandidateFromVersionValidity(bundle(), { state: "START_UNKNOWN" });
    if (result.outcome === "CANDIDATE") {
      const c: E85TemporalCandidate = result.candidate;
      expect(c).toBeDefined();
    } else {
      // @ts-expect-error — non-CANDIDATE branches have no `candidate` field.
      const _forbidden = result.candidate;
      expect(_forbidden).toBeUndefined();
    }
  });
});

describe("E85 Phase 15.8 — closed-basis policy", () => {
  test("12. matching SOURCE_STATED bases propagate", () => {
    const result = buildE85TemporalCandidateFromVersionValidity(bundle(), {
      state: "CLOSED",
      effectiveFrom: "2020-01-01",
      start: commencement({ effectiveDateBasis: "SOURCE_STATED" }),
      effectiveTo: "2021-12-31",
      end: expressRepeal({ effectiveDateBasis: "SOURCE_STATED" }),
    });
    if (result.outcome === "CANDIDATE") {
      expect(result.candidate.temporal.effectiveDateBasis).toBe("SOURCE_STATED");
    } else {
      throw new Error("expected CANDIDATE");
    }
  });

  test.each(["PUBLICATION_DATE_INFERRED", "AMENDMENT_DATE_KNOWN"] as const)("13. matching %s bases propagate", (basis) => {
    const result = buildE85TemporalCandidateFromVersionValidity(bundle(), {
      state: "CLOSED",
      effectiveFrom: "2020-01-01",
      start: commencement({ effectiveDateBasis: basis }),
      effectiveTo: "2021-12-31",
      end: expressRepeal({ effectiveDateBasis: basis }),
    });
    if (result.outcome === "CANDIDATE") {
      expect(result.candidate.temporal.effectiveDateBasis).toBe(basis);
    } else {
      throw new Error("expected CANDIDATE");
    }
  });

  test("14. different bases demote to UNKNOWN", () => {
    const result = buildE85TemporalCandidateFromVersionValidity(bundle(), {
      state: "CLOSED",
      effectiveFrom: "2020-01-01",
      start: commencement({ effectiveDateBasis: "SOURCE_STATED" }),
      effectiveTo: "2021-12-31",
      end: expressRepeal({ effectiveDateBasis: "PUBLICATION_DATE_INFERRED" }),
    });
    if (result.outcome === "CANDIDATE") {
      expect(result.candidate.temporal.effectiveDateBasis).toBe("UNKNOWN");
    } else {
      throw new Error("expected CANDIDATE");
    }
  });

  test("15. start UNKNOWN demotes to UNKNOWN", () => {
    const result = buildE85TemporalCandidateFromVersionValidity(bundle(), {
      state: "CLOSED",
      effectiveFrom: "2020-01-01",
      start: commencement({ effectiveDateBasis: "UNKNOWN" }),
      effectiveTo: "2021-12-31",
      end: expressRepeal({ effectiveDateBasis: "UNKNOWN" }),
    });
    if (result.outcome === "CANDIDATE") {
      expect(result.candidate.temporal.effectiveDateBasis).toBe("UNKNOWN");
    } else {
      throw new Error("expected CANDIDATE");
    }
  });

  test("16. end UNKNOWN (start known) demotes to UNKNOWN", () => {
    const result = buildE85TemporalCandidateFromVersionValidity(bundle(), {
      state: "CLOSED",
      effectiveFrom: "2020-01-01",
      start: commencement({ effectiveDateBasis: "SOURCE_STATED" }),
      effectiveTo: "2021-12-31",
      end: expressRepeal({ effectiveDateBasis: "UNKNOWN" }),
    });
    if (result.outcome === "CANDIDATE") {
      expect(result.candidate.temporal.effectiveDateBasis).toBe("UNKNOWN");
    } else {
      throw new Error("expected CANDIDATE");
    }
  });

  test("17. endpoint dates remain unchanged regardless of basis demotion", () => {
    const result = buildE85TemporalCandidateFromVersionValidity(bundle(), {
      state: "CLOSED",
      effectiveFrom: "2020-01-01",
      start: commencement({ effectiveDateBasis: "SOURCE_STATED" }),
      effectiveTo: "2021-12-31",
      end: expressRepeal({ effectiveDateBasis: "UNKNOWN" }),
    });
    if (result.outcome === "CANDIDATE") {
      expect(result.candidate.temporal.effectiveFrom).toBe("2020-01-01");
      expect(result.candidate.temporal.effectiveTo).toBe("2021-12-31");
    } else {
      throw new Error("expected CANDIDATE");
    }
  });

  test("18. original individual bases remain available through the returned validity", () => {
    const result = buildE85TemporalCandidateFromVersionValidity(bundle(), {
      state: "CLOSED",
      effectiveFrom: "2020-01-01",
      start: commencement({ effectiveDateBasis: "SOURCE_STATED" }),
      effectiveTo: "2021-12-31",
      end: expressRepeal({ effectiveDateBasis: "UNKNOWN" }),
    });
    if (result.outcome === "CANDIDATE" && result.validity.state === "CLOSED") {
      expect(result.validity.start.effectiveDateBasis).toBe("SOURCE_STATED");
      expect(result.validity.end.effectiveDateBasis).toBe("UNKNOWN");
    } else {
      throw new Error("expected CANDIDATE with CLOSED validity");
    }
  });
});

describe("E85 Phase 15.8 — candidate identity", () => {
  const closedValidity: E85VersionValidity = {
    state: "CLOSED",
    effectiveFrom: "2020-01-01",
    start: commencement(),
    effectiveTo: "2021-12-31",
    end: expressRepeal(),
  };

  function idOf(b: E85NormalizedRuleBundle): string {
    const result = buildE85TemporalCandidateFromVersionValidity(b, closedValidity);
    return result.candidateId;
  }

  test("19. different jurisdiction produces a different ID", () => {
    expect(idOf(bundle({ jurisdictionId: "TEST-JX-1" }))).not.toBe(idOf(bundle({ jurisdictionId: "TEST-JX-2" })));
  });

  test("20. different source produces a different ID", () => {
    expect(idOf(bundle({ sourceId: "TEST-SOURCE-1" }))).not.toBe(idOf(bundle({ sourceId: "TEST-SOURCE-2" })));
  });

  test("21. different version produces a different ID", () => {
    expect(idOf(bundle({ sourceVersionId: "TEST-V1" }))).not.toBe(idOf(bundle({ sourceVersionId: "TEST-V2" })));
  });

  test("22. different zone produces a different ID", () => {
    expect(idOf(bundle({ zoneDesignation: "TEST-ZONE-1" }))).not.toBe(idOf(bundle({ zoneDesignation: "TEST-ZONE-2" })));
  });

  test("23. identical four-part identity produces identical ID", () => {
    expect(idOf(bundle())).toBe(idOf(bundle()));
  });

  test("24. ID does not depend on normalized content (rules/findings differ, identity fields same)", () => {
    const a = bundle({ rules: [], findings: [] });
    const b = bundle({ rules: [], findings: [], adapterId: "TEST-ADAPTER-OTHER" });
    expect(idOf(a)).toBe(idOf(b));
  });

  test("25. repeated calls produce the same ID", () => {
    const b = bundle();
    expect(idOf(b)).toBe(idOf(b));
  });

  test.each(["jurisdictionId", "sourceId", "sourceVersionId", "zoneDesignation"] as const)("26. empty %s component rejected", (field) => {
    expect(() => buildE85TemporalCandidateFromVersionValidity(bundle({ [field]: "" }), closedValidity)).toThrow(E85TemporalCandidateAdapterError);
  });

  test.each(["jurisdictionId", "sourceId", "sourceVersionId", "zoneDesignation"] as const)("27. space-only %s component rejected", (field) => {
    expect(() => buildE85TemporalCandidateFromVersionValidity(bundle({ [field]: "   " }), closedValidity)).toThrow(E85TemporalCandidateAdapterError);
  });

  test.each(["jurisdictionId", "sourceId", "sourceVersionId", "zoneDesignation"] as const)("28. tab/newline-only %s component rejected", (field) => {
    expect(() => buildE85TemporalCandidateFromVersionValidity(bundle({ [field]: "\t\n" }), closedValidity)).toThrow(E85TemporalCandidateAdapterError);
  });

  test("29. accepted padded content is preserved (not silently trimmed) in the underlying bundle passthrough", () => {
    const padded = bundle({ zoneDesignation: "  TEST-ZONE  " });
    const result = buildE85TemporalCandidateFromVersionValidity(padded, closedValidity);
    expect(result.bundle.zoneDesignation).toBe("  TEST-ZONE  ");
  });
});

describe("E85 Phase 15.8 — escaping", () => {
  const closedValidity: E85VersionValidity = {
    state: "CLOSED",
    effectiveFrom: "2020-01-01",
    start: commencement(),
    effectiveTo: "2021-12-31",
    end: expressRepeal(),
  };

  function idOf(b: E85NormalizedRuleBundle): string {
    const result = buildE85TemporalCandidateFromVersionValidity(b, closedValidity);
    return result.candidateId;
  }

  test("30. @ in jurisdiction is escaped and distinguishable", () => {
    const id = idOf(bundle({ jurisdictionId: "TEST-JX@1" }));
    expect(id).toContain("%40");
    expect(id).not.toBe(idOf(bundle({ jurisdictionId: "TEST-JX", sourceId: "1" })));
  });

  test("31. @ in source is escaped", () => {
    const id = idOf(bundle({ sourceId: "TEST-SOURCE@X" }));
    expect(id).toContain("%40");
  });

  test("32. @ in version is escaped", () => {
    const id = idOf(bundle({ sourceVersionId: "2026-06@council" }));
    expect(id).toContain("%40");
  });

  test("33. @ in zone is escaped", () => {
    const id = idOf(bundle({ zoneDesignation: "R1@1" }));
    expect(id).toContain("%40");
  });

  test.each(["jurisdictionId", "sourceId", "sourceVersionId", "zoneDesignation"] as const)("34. %% in %s is escaped", (field) => {
    const id = idOf(bundle({ [field]: "TEST-100%" }));
    expect(id).toContain("%25");
  });

  test("35. literal %25 in input round-trips distinguishably from an escaped %", () => {
    const idLiteral = idOf(bundle({ zoneDesignation: "%25" }));
    const idPercent = idOf(bundle({ zoneDesignation: "%" }));
    expect(idLiteral).not.toBe(idPercent);
  });

  test("36. literal %40 in input round-trips distinguishably from an escaped @", () => {
    const idLiteral = idOf(bundle({ zoneDesignation: "%40" }));
    const idAt = idOf(bundle({ zoneDesignation: "@" }));
    expect(idLiteral).not.toBe(idAt);
  });

  test("37. tuples that would collide under naive @ joining remain distinct after escaping", () => {
    // Naive join: sourceId="TEST-SOURCE", sourceVersionId="V@TEST-ZONE" vs.
    // sourceId="TEST-SOURCE", sourceVersionId="V", zoneDesignation="TEST-ZONE"
    // would both serialize to ".../TEST-SOURCE/V@TEST-ZONE" without escaping.
    const a = idOf(bundle({ sourceVersionId: "V@TEST-ZONE-TAIL", zoneDesignation: "TEST-ZONE" }));
    const b = idOf(bundle({ sourceVersionId: "V", zoneDesignation: "TEST-ZONE-TAIL@TEST-ZONE" }));
    expect(a).not.toBe(b);
  });

  test("38. serialization is deterministic across repeated calls", () => {
    const b = bundle({ zoneDesignation: "R1@1%" });
    expect(idOf(b)).toBe(idOf(b));
  });

  test("39. no hashing, UUID, clock, or randomness in candidateId output (stable, human-inspectable escaping only)", () => {
    const id = idOf(bundle());
    expect(id).toBe("TEST-JX@TEST-SOURCE@TEST-V1@TEST-ZONE");
  });
});

describe("E85 Phase 15.8 — runtime validation and errors", () => {
  const closedValidity: E85VersionValidity = {
    state: "CLOSED",
    effectiveFrom: "2020-01-01",
    start: commencement(),
    effectiveTo: "2021-12-31",
    end: expressRepeal(),
  };

  test("40. null bundle rejected", () => {
    expect(() => buildE85TemporalCandidateFromVersionValidity(null as unknown as E85NormalizedRuleBundle, closedValidity)).toThrow(
      E85TemporalCandidateAdapterError,
    );
  });

  test("41. non-object bundle rejected", () => {
    expect(() => buildE85TemporalCandidateFromVersionValidity("not-a-bundle" as unknown as E85NormalizedRuleBundle, closedValidity)).toThrow(
      E85TemporalCandidateAdapterError,
    );
  });

  test.each(["jurisdictionId", "sourceId", "sourceVersionId", "zoneDesignation"] as const)("42. missing %s field rejected", (field) => {
    const malformed = bundle();
    delete (malformed as unknown as Record<string, unknown>)[field];
    expect(() => buildE85TemporalCandidateFromVersionValidity(malformed, closedValidity)).toThrow(E85TemporalCandidateAdapterError);
  });

  test.each(["jurisdictionId", "sourceId", "sourceVersionId", "zoneDesignation"] as const)("43. non-string %s field rejected", (field) => {
    const malformed = bundle({ [field]: 12345 as unknown as string });
    expect(() => buildE85TemporalCandidateFromVersionValidity(malformed, closedValidity)).toThrow(E85TemporalCandidateAdapterError);
  });

  test("44. unsupported validity state rejected", () => {
    const malformed = { state: "SUPERSEDED" } as unknown as E85VersionValidity;
    expect(() => buildE85TemporalCandidateFromVersionValidity(bundle(), malformed)).toThrow(E85TemporalCandidateAdapterError);
  });

  test("45. invalid start authority rejected (empty operative locator)", () => {
    const malformed: E85VersionValidity = {
      state: "OPEN_UNRESEARCHED",
      effectiveFrom: "2020-01-01",
      start: commencement({ commencementLocator: {} }),
    };
    expect(() => buildE85TemporalCandidateFromVersionValidity(bundle(), malformed)).toThrow(E85TemporalCandidateAdapterError);
  });

  test("46. invalid end authority rejected (empty operative locator)", () => {
    const malformed: E85VersionValidity = {
      state: "CLOSED",
      effectiveFrom: "2020-01-01",
      start: commencement(),
      effectiveTo: "2021-12-31",
      end: expressRepeal({ repealLocator: {} }),
    };
    expect(() => buildE85TemporalCandidateFromVersionValidity(bundle(), malformed)).toThrow(E85TemporalCandidateAdapterError);
  });

  test("47. invalid interval rejected (end before start)", () => {
    const malformed: E85VersionValidity = {
      state: "CLOSED",
      effectiveFrom: "2021-01-01",
      start: commencement({ effectiveFrom: "2021-01-01" }),
      effectiveTo: "2020-01-01",
      end: expressRepeal({ effectiveTo: "2020-01-01" }),
    };
    expect(() => buildE85TemporalCandidateFromVersionValidity(bundle(), malformed)).toThrow(E85TemporalCandidateAdapterError);
  });

  test("48. malformed basis rejected", () => {
    const malformed = {
      ...commencement(),
      effectiveDateBasis: "NOT_A_REAL_BASIS",
    } as unknown as E85StartAuthority;
    const invalidValidity: E85VersionValidity = { state: "OPEN_UNRESEARCHED", effectiveFrom: "2020-01-01", start: malformed };
    expect(() => buildE85TemporalCandidateFromVersionValidity(bundle(), invalidValidity)).toThrow(E85TemporalCandidateAdapterError);
  });

  test("49. malformed review evidence rejected (missing sourcesChecked)", () => {
    const malformed = {
      state: "OPEN_REVIEWED_NO_END_ESTABLISHED",
      effectiveFrom: "2020-01-01",
      start: commencement(),
    } as unknown as E85VersionValidity;
    expect(() => buildE85TemporalCandidateFromVersionValidity(bundle(), malformed)).toThrow(E85TemporalCandidateAdapterError);
  });

  test("50. malformed conflict arrays rejected (fewer than two assertions)", () => {
    const malformed: E85VersionValidity = { state: "CONFLICTING_START", conflictingStartAssertions: [commencement()] };
    expect(() => buildE85TemporalCandidateFromVersionValidity(bundle(), malformed)).toThrow(E85TemporalCandidateAdapterError);
  });

  test("51. malformed partial-termination state rejected (whitespace-only description)", () => {
    const malformed: E85VersionValidity = {
      state: "CONDITIONAL_PARTIAL_TERMINATION",
      effectiveFrom: "2020-01-01",
      start: commencement(),
      description: "   ",
    };
    expect(() => buildE85TemporalCandidateFromVersionValidity(bundle(), malformed)).toThrow(E85TemporalCandidateAdapterError);
  });

  test("52. all rejections are E85TemporalCandidateAdapterError, never a bare Error/E85VersionValidityError leaking through", () => {
    try {
      buildE85TemporalCandidateFromVersionValidity(bundle(), { state: "SUPERSEDED" } as unknown as E85VersionValidity);
      throw new Error("expected a throw");
    } catch (error) {
      expect(error).toBeInstanceOf(E85TemporalCandidateAdapterError);
      expect((error as Error).name).toBe("E85TemporalCandidateAdapterError");
    }
  });
});

describe("E85 Phase 15.8 — provenance", () => {
  test("53. start authority may be proven by a different source/version than the subject bundle", () => {
    const result = buildE85TemporalCandidateFromVersionValidity(
      bundle({ sourceId: "TEST-SUBJECT-SOURCE", sourceVersionId: "TEST-SUBJECT-V1" }),
      {
        state: "OPEN_UNRESEARCHED",
        effectiveFrom: "2020-01-01",
        start: commencement({ authoritySourceId: "TEST-OTHER-AUTHORITY-SOURCE", authoritySourceVersionId: "TEST-OTHER-V1" }),
      },
    );
    expect(result.outcome).toBe("OPEN_END_UNRESEARCHED");
  });

  test("54. end authority may be proven by a different repealing instrument", () => {
    const result = buildE85TemporalCandidateFromVersionValidity(bundle({ sourceId: "TEST-SUBJECT-SOURCE" }), {
      state: "CLOSED",
      effectiveFrom: "2020-01-01",
      start: commencement(),
      effectiveTo: "2021-12-31",
      end: expressRepeal({ authoritySourceId: "TEST-REPEALING-SOURCE", authoritySourceVersionId: "TEST-REPEALING-V1" }),
    });
    expect(result.outcome).toBe("CANDIDATE");
  });

  test("55. successor identity remains distinct from subject and authority identity (REPLACEMENT_WITH_EXPRESS_REPEAL)", () => {
    const end: E85EndAuthority = {
      eventKind: "REPLACEMENT_WITH_EXPRESS_REPEAL",
      effectiveTo: "2021-12-31",
      authoritySourceId: "TEST-SOURCE",
      authoritySourceVersionId: "TEST-V2",
      repealLocator: LOCATOR,
      effectiveDateBasis: "SOURCE_STATED",
      successorSourceId: "TEST-SUCCESSOR-SOURCE",
      successorSourceVersionId: "TEST-SUCCESSOR-V1",
    };
    const result = buildE85TemporalCandidateFromVersionValidity(bundle(), {
      state: "CLOSED",
      effectiveFrom: "2020-01-01",
      start: commencement(),
      effectiveTo: "2021-12-31",
      end,
    });
    expect(result.outcome).toBe("CANDIDATE");
    if (result.outcome === "CANDIDATE" && result.validity.state === "CLOSED" && result.validity.end.eventKind === "REPLACEMENT_WITH_EXPRESS_REPEAL") {
      expect(result.validity.end.successorSourceId).toBe("TEST-SUCCESSOR-SOURCE");
      expect(result.validity.end.successorSourceVersionId).toBe("TEST-SUCCESSOR-V1");
    } else {
      throw new Error("expected CLOSED/REPLACEMENT_WITH_EXPRESS_REPEAL");
    }
  });

  test("56. endpoint authority IDs are not incorrectly required to match bundle IDs", () => {
    const result = buildE85TemporalCandidateFromVersionValidity(bundle({ sourceId: "TEST-SUBJECT-SOURCE", sourceVersionId: "TEST-SUBJECT-V1" }), {
      state: "CLOSED",
      effectiveFrom: "2020-01-01",
      start: commencement({ authoritySourceId: "TEST-COMMENCEMENT-SOURCE", authoritySourceVersionId: "TEST-C-V1" }),
      effectiveTo: "2021-12-31",
      end: expressRepeal({ authoritySourceId: "TEST-REPEAL-SOURCE", authoritySourceVersionId: "TEST-R-V1" }),
    });
    expect(result.outcome).toBe("CANDIDATE");
  });

  test("57. full validity remains available on non-candidate branches too", () => {
    const result = buildE85TemporalCandidateFromVersionValidity(bundle(), {
      state: "CONFLICTING_END",
      effectiveFrom: "2020-01-01",
      start: commencement(),
      conflictingEndAssertions: [expressRepeal(), expressRepeal({ effectiveTo: "2022-06-30" })],
    });
    if (result.outcome === "CONFLICTING_END") {
      expect(result.validity.state).toBe("CONFLICTING_END");
    } else {
      throw new Error("expected CONFLICTING_END");
    }
  });
});

describe("E85 Phase 15.8 — mutation and determinism", () => {
  test("58. bundle is not mutated", () => {
    const b = bundle();
    const before = JSON.stringify(b);
    buildE85TemporalCandidateFromVersionValidity(b, { state: "START_UNKNOWN" });
    expect(JSON.stringify(b)).toBe(before);
  });

  test("59. validity is not mutated", () => {
    const validity: E85VersionValidity = {
      state: "CLOSED",
      effectiveFrom: "2020-01-01",
      start: commencement(),
      effectiveTo: "2021-12-31",
      end: expressRepeal(),
    };
    const before = JSON.stringify(validity);
    buildE85TemporalCandidateFromVersionValidity(bundle(), validity);
    expect(JSON.stringify(validity)).toBe(before);
  });

  test("60. conflicting-start assertion array is not mutated", () => {
    const assertions = [commencement(), commencement({ effectiveFrom: "2020-02-01" })];
    const before = JSON.stringify(assertions);
    buildE85TemporalCandidateFromVersionValidity(bundle(), { state: "CONFLICTING_START", conflictingStartAssertions: assertions });
    expect(JSON.stringify(assertions)).toBe(before);
  });

  test("61. sourcesChecked array is not mutated", () => {
    const sourcesChecked = ["TEST-SOURCE-A", "TEST-SOURCE-B"];
    const before = JSON.stringify(sourcesChecked);
    buildE85TemporalCandidateFromVersionValidity(bundle(), {
      state: "OPEN_REVIEWED_NO_END_ESTABLISHED",
      effectiveFrom: "2020-01-01",
      start: commencement(),
      endReview: { sourcesChecked, reviewedAt: "2026-01-01" },
    });
    expect(JSON.stringify(sourcesChecked)).toBe(before);
  });

  test("62. repeated valid calls are deeply equal", () => {
    const b = bundle();
    const validity: E85VersionValidity = {
      state: "CLOSED",
      effectiveFrom: "2020-01-01",
      start: commencement(),
      effectiveTo: "2021-12-31",
      end: expressRepeal(),
    };
    expect(buildE85TemporalCandidateFromVersionValidity(b, validity)).toEqual(buildE85TemporalCandidateFromVersionValidity(b, validity));
  });

  test("63. repeated invalid calls have identical error type/message", () => {
    let first: unknown;
    let second: unknown;
    try {
      buildE85TemporalCandidateFromVersionValidity(bundle({ sourceId: "" }), { state: "START_UNKNOWN" });
    } catch (e) {
      first = e;
    }
    try {
      buildE85TemporalCandidateFromVersionValidity(bundle({ sourceId: "" }), { state: "START_UNKNOWN" });
    } catch (e) {
      second = e;
    }
    expect(first).toBeInstanceOf(E85TemporalCandidateAdapterError);
    expect((first as Error).message).toBe((second as Error).message);
  });

  test("64. conflicting-start assertion order is preserved", () => {
    const assertions = [commencement({ effectiveFrom: "2020-03-01" }), commencement({ effectiveFrom: "2020-01-01" })];
    const result = buildE85TemporalCandidateFromVersionValidity(bundle(), { state: "CONFLICTING_START", conflictingStartAssertions: assertions });
    if (result.outcome === "CONFLICTING_START") {
      expect(result.conflictingStartAssertions.map((a) => a.effectiveFrom)).toEqual(["2020-03-01", "2020-01-01"]);
    } else {
      throw new Error("expected CONFLICTING_START");
    }
  });

  test("65. sourcesChecked order is preserved", () => {
    const sourcesChecked = ["TEST-SOURCE-Z", "TEST-SOURCE-A"];
    const result = buildE85TemporalCandidateFromVersionValidity(bundle(), {
      state: "OPEN_REVIEWED_NO_END_ESTABLISHED",
      effectiveFrom: "2020-01-01",
      start: commencement(),
      endReview: { sourcesChecked, reviewedAt: "2026-01-01" },
    });
    if (result.outcome === "OPEN_END_REVIEWED_NO_END_ESTABLISHED") {
      expect(result.evidence.sourcesChecked).toEqual(["TEST-SOURCE-Z", "TEST-SOURCE-A"]);
    } else {
      throw new Error("expected OPEN_END_REVIEWED_NO_END_ESTABLISHED");
    }
  });

  test("66. no clock access: production file contains no Date/Date.now/new Date usage", () => {
    const source = fs.readFileSync(path.resolve(__dirname, "../../src/zoning-land-use-engine/temporal-candidate-adapter.ts"), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(/\bDate\.now\s*\(/.test(code)).toBe(false);
    expect(/\bnew\s+Date\s*\(/.test(code)).toBe(false);
    expect(/[^.\w]Date\b(?!\.now)/.test(code.replace(/new\s+Date/g, ""))).toBe(false);
  });
});

describe("E85 Phase 15.8 — isolation", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../src/zoning-land-use-engine/temporal-candidate-adapter.ts"), "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  test("67. no randomness (Math.random / randomUUID)", () => {
    expect(/Math\.random\s*\(/.test(code)).toBe(false);
    expect(/randomUUID\s*\(/.test(code)).toBe(false);
  });

  test("68. no filesystem or network access", () => {
    expect(/from\s+["'](?:node:)?fs(?:\/promises)?["']/.test(code)).toBe(false);
    expect(/\bfetch\s*\(/.test(code)).toBe(false);
    expect(/from\s+["'](?:node:)?https?["']/.test(code)).toBe(false);
  });

  test("69. no use of `any` in executable/type code", () => {
    const executable = code.replace(/`(?:[^`\\]|\\.)*`/g, "``").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''");
    expect(/\bany\b/.test(executable)).toBe(false);
  });

  test("70. no real-jurisdiction strings", () => {
    for (const term of [/vancouver/i, /burnaby/i, /\bR1-1\b/, /\bC-2C\b/]) {
      expect(term.test(source)).toBe(false);
    }
  });

  test("71. no forbidden imports (registry, source-adapter, linkage, composer, evaluator, status, materiality)", () => {
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
    ];
    for (const specifier of imports) {
      for (const forbidden of forbiddenSubstrings) {
        expect(specifier.includes(forbidden)).toBe(false);
      }
    }
    expect([...new Set(imports)].sort()).toEqual(["./evidence-types", "./normalized-bundle-types", "./temporal-selection", "./version-validity-types"].sort());
  });

  test("72. no barrel export (module not re-exported through index.ts)", () => {
    const indexSource = fs.readFileSync(path.resolve(__dirname, "../../src/zoning-land-use-engine/index.ts"), "utf8");
    expect(indexSource.includes("temporal-candidate-adapter")).toBe(false);
  });
});

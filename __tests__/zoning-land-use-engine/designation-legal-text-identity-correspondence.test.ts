/**
 * InvestScape™ E85 Phase 15.22B — designation/legal-text identity
 * correspondence evaluator tests, Slice 3H-1.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Synthetic identifiers only (SYNTH-JURISDICTION-1 / SYNTH-ZONE-TEST-1 /
 * SYNTH-SOURCE-* / SYNTH-VERSION-*) — no real R1-1/C-2C/Feature 494642/
 * Vancouver/Burnaby value is imported or referenced anywhere here.
 */
import {
  evaluateE85DesignationLegalTextIdentityCorrespondence,
  E85DesignationLegalTextIdentityCorrespondenceError,
  E85DesignationLegalTextCorrespondenceResult,
  E85LegalIdentity,
  E85LegalTextIdentityInput,
} from "../../src/zoning-land-use-engine/designation-legal-text-identity-correspondence";
import type { E85DesignationApplicabilityResult } from "../../src/zoning-land-use-engine/designation-applicability";

const LINKAGE: E85LegalIdentity = {
  jurisdictionId: "SYNTH-JURISDICTION-1",
  sourceId: "SYNTH-SOURCE-1",
  sourceVersionId: "SYNTH-VERSION-2026-01",
  zoneDesignation: "SYNTH-ZONE-TEST-1",
};

const MATCHING_LEGAL_TEXT: E85LegalTextIdentityInput = { kind: "SELECTED", identity: { ...LINKAGE } };

const APPLICABLE_WITHIN_CLOSED: E85DesignationApplicabilityResult = {
  kind: "DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL",
  identity: { jurisdictionId: "SYNTH-JURISDICTION-1", districtOrZoneId: "SYNTH-ZONE-TEST-1" },
  effectiveFrom: "2020-01-01",
  effectiveTo: "2021-12-31",
  asOfDate: "2020-06-01",
};

const POSSIBLY_APPLICABLE_OPEN_END: E85DesignationApplicabilityResult = {
  kind: "DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END",
  identity: { jurisdictionId: "SYNTH-JURISDICTION-1", districtOrZoneId: "SYNTH-ZONE-TEST-1" },
  effectiveFrom: "2020-01-01",
  asOfDate: "2020-06-01",
};

const NOT_YET_STARTED: E85DesignationApplicabilityResult = {
  kind: "DESIGNATION_NOT_YET_STARTED",
  identity: { jurisdictionId: "SYNTH-JURISDICTION-1", districtOrZoneId: "SYNTH-ZONE-TEST-1" },
  effectiveFrom: "2030-01-01",
  asOfDate: "2020-06-01",
};

const NOT_EVALUABLE: E85DesignationApplicabilityResult = { kind: "DESIGNATION_APPLICABILITY_NOT_EVALUABLE" };

const NOT_SELECTED: E85LegalTextIdentityInput = { kind: "NOT_SELECTED" };

describe("evaluateE85DesignationLegalTextIdentityCorrespondence — correspondence established", () => {
  test("all three identities matching exactly -> IDENTITY_CORRESPONDENCE_ESTABLISHED, with an explicit limitation", () => {
    const result = evaluateE85DesignationLegalTextIdentityCorrespondence(APPLICABLE_WITHIN_CLOSED, MATCHING_LEGAL_TEXT, LINKAGE);
    expect(result.kind).toBe("IDENTITY_CORRESPONDENCE_ESTABLISHED");
    if (result.kind === "IDENTITY_CORRESPONDENCE_ESTABLISHED") {
      expect(result.designationResultKind).toBe("DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL");
      expect(result.legalTextIdentity).toEqual(LINKAGE);
      expect(result.linkageIdentity).toEqual(LINKAGE);
      expect(typeof result.limitation).toBe("string");
      expect(result.limitation.length).toBeGreaterThan(0);
    }
  });

  test("POSSIBLY_APPLICABLE_OPEN_END designation also reaches correspondence when identities match", () => {
    const result = evaluateE85DesignationLegalTextIdentityCorrespondence(POSSIBLY_APPLICABLE_OPEN_END, MATCHING_LEGAL_TEXT, LINKAGE);
    expect(result.kind).toBe("IDENTITY_CORRESPONDENCE_ESTABLISHED");
    if (result.kind === "IDENTITY_CORRESPONDENCE_ESTABLISHED") {
      expect(result.designationResultKind).toBe("DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END");
    }
  });

  test("determinism: same inputs twice yield deeply-equal output", () => {
    const first = evaluateE85DesignationLegalTextIdentityCorrespondence(APPLICABLE_WITHIN_CLOSED, MATCHING_LEGAL_TEXT, LINKAGE);
    const second = evaluateE85DesignationLegalTextIdentityCorrespondence(APPLICABLE_WITHIN_CLOSED, MATCHING_LEGAL_TEXT, LINKAGE);
    expect(first).toEqual(second);
  });

  test("input objects are not mutated", () => {
    const designationBefore = JSON.parse(JSON.stringify(APPLICABLE_WITHIN_CLOSED));
    const legalTextBefore = JSON.parse(JSON.stringify(MATCHING_LEGAL_TEXT));
    const linkageBefore = JSON.parse(JSON.stringify(LINKAGE));
    evaluateE85DesignationLegalTextIdentityCorrespondence(APPLICABLE_WITHIN_CLOSED, MATCHING_LEGAL_TEXT, LINKAGE);
    expect(APPLICABLE_WITHIN_CLOSED).toEqual(designationBefore);
    expect(MATCHING_LEGAL_TEXT).toEqual(legalTextBefore);
    expect(LINKAGE).toEqual(linkageBefore);
  });
});

describe("evaluateE85DesignationLegalTextIdentityCorrespondence — honesty boundary: no forbidden claim ever appears", () => {
  // Real-jurisdiction identifiers must never appear anywhere, under any circumstance.
  const FORBIDDEN_REAL_IDENTIFIERS = ["R1-1", "C-2C", "494642", "Burnaby", "Vancouver", "current law"];

  // Bare AFFIRMATIVE claim phrases (never a negation of them) that would assert more than
  // identity correspondence. Checked as affirmative patterns, not literal substrings, since
  // the limitation text legitimately contains these words INSIDE a "does NOT mean ..." denial.
  const FORBIDDEN_AFFIRMATIVE_PATTERNS = [
    /(?<!does NOT mean the linkage itself was )\blegally valid\b/,
    /(?<!does NOT mean the parcel was )\bhistorically zoned\b/,
    /(?<!does NOT )\bauthorize(?:s)? rule-pack application\b/,
    /(?<!does NOT )constitute a final zoning determination\b/,
  ];

  test("the correspondence-established result's own fields never contain a real-jurisdiction identifier or a bare affirmative forbidden claim", () => {
    const result = evaluateE85DesignationLegalTextIdentityCorrespondence(APPLICABLE_WITHIN_CLOSED, MATCHING_LEGAL_TEXT, LINKAGE);
    const serialized = JSON.stringify(result);
    for (const term of FORBIDDEN_REAL_IDENTIFIERS) {
      expect(serialized).not.toContain(term);
    }
    for (const pattern of FORBIDDEN_AFFIRMATIVE_PATTERNS) {
      expect(pattern.test(serialized)).toBe(false);
    }
    // The limitation text must explicitly deny temporal validity, historical zoning, and rule-pack authorization.
    if (result.kind === "IDENTITY_CORRESPONDENCE_ESTABLISHED") {
      expect(result.limitation).toMatch(/does NOT mean the linkage itself was legally valid/);
      expect(result.limitation).toMatch(/does NOT mean the parcel was historically zoned/);
      expect(result.limitation).toMatch(/does NOT authorize rule-pack application/);
      expect(result.limitation).toMatch(/does NOT constitute a final zoning determination/);
    }
  });

  test("no result kind ever equals a temporal-validity or rule-pack-authorization claim string", () => {
    const kinds: readonly E85DesignationLegalTextCorrespondenceResult["kind"][] = [
      "DESIGNATION_NOT_APPLICABLE_PASSTHROUGH",
      "LEGAL_TEXT_NOT_SELECTED_PASSTHROUGH",
      "JURISDICTION_MISMATCH",
      "SOURCE_MISMATCH",
      "VERSION_MISMATCH",
      "ZONE_MISMATCH",
      "IDENTITY_CORRESPONDENCE_ESTABLISHED",
    ];
    for (const kind of kinds) {
      expect(kind).not.toMatch(/VALID|APPLIED|AUTHORIZED|HISTORICAL|ALIGNED/);
    }
  });
});

describe("evaluateE85DesignationLegalTextIdentityCorrespondence — mismatch categories", () => {
  test("jurisdiction mismatch (designation side) -> JURISDICTION_MISMATCH", () => {
    const designation: E85DesignationApplicabilityResult = {
      ...APPLICABLE_WITHIN_CLOSED,
      identity: { jurisdictionId: "SYNTH-JURISDICTION-OTHER", districtOrZoneId: "SYNTH-ZONE-TEST-1" },
    };
    const result = evaluateE85DesignationLegalTextIdentityCorrespondence(designation, MATCHING_LEGAL_TEXT, LINKAGE);
    expect(result.kind).toBe("JURISDICTION_MISMATCH");
  });

  test("jurisdiction mismatch (legal-text side) -> JURISDICTION_MISMATCH", () => {
    const legalText: E85LegalTextIdentityInput = { kind: "SELECTED", identity: { ...LINKAGE, jurisdictionId: "SYNTH-JURISDICTION-OTHER" } };
    const result = evaluateE85DesignationLegalTextIdentityCorrespondence(APPLICABLE_WITHIN_CLOSED, legalText, LINKAGE);
    expect(result.kind).toBe("JURISDICTION_MISMATCH");
  });

  test("source mismatch -> SOURCE_MISMATCH", () => {
    const legalText: E85LegalTextIdentityInput = { kind: "SELECTED", identity: { ...LINKAGE, sourceId: "SYNTH-SOURCE-OTHER" } };
    const result = evaluateE85DesignationLegalTextIdentityCorrespondence(APPLICABLE_WITHIN_CLOSED, legalText, LINKAGE);
    expect(result.kind).toBe("SOURCE_MISMATCH");
  });

  test("source-version mismatch -> VERSION_MISMATCH", () => {
    const legalText: E85LegalTextIdentityInput = { kind: "SELECTED", identity: { ...LINKAGE, sourceVersionId: "SYNTH-VERSION-2019-01" } };
    const result = evaluateE85DesignationLegalTextIdentityCorrespondence(APPLICABLE_WITHIN_CLOSED, legalText, LINKAGE);
    expect(result.kind).toBe("VERSION_MISMATCH");
  });

  test("zone mismatch (designation side) -> ZONE_MISMATCH", () => {
    const designation: E85DesignationApplicabilityResult = {
      ...APPLICABLE_WITHIN_CLOSED,
      identity: { jurisdictionId: "SYNTH-JURISDICTION-1", districtOrZoneId: "SYNTH-ZONE-OTHER" },
    };
    const result = evaluateE85DesignationLegalTextIdentityCorrespondence(designation, MATCHING_LEGAL_TEXT, LINKAGE);
    expect(result.kind).toBe("ZONE_MISMATCH");
  });

  test("zone mismatch (legal-text side) -> ZONE_MISMATCH", () => {
    const legalText: E85LegalTextIdentityInput = { kind: "SELECTED", identity: { ...LINKAGE, zoneDesignation: "SYNTH-ZONE-OTHER" } };
    const result = evaluateE85DesignationLegalTextIdentityCorrespondence(APPLICABLE_WITHIN_CLOSED, legalText, LINKAGE);
    expect(result.kind).toBe("ZONE_MISMATCH");
  });

  test("mismatch results carry both supplied identities for audit, unchanged", () => {
    const legalText: E85LegalTextIdentityInput = { kind: "SELECTED", identity: { ...LINKAGE, sourceId: "SYNTH-SOURCE-OTHER" } };
    const result = evaluateE85DesignationLegalTextIdentityCorrespondence(APPLICABLE_WITHIN_CLOSED, legalText, LINKAGE);
    expect(result.kind).toBe("SOURCE_MISMATCH");
    if (result.kind === "SOURCE_MISMATCH") {
      expect(result.legalTextIdentity).toEqual(legalText.kind === "SELECTED" ? legalText.identity : undefined);
      expect(result.linkageIdentity).toEqual(LINKAGE);
    }
  });

  test("jurisdiction mismatch takes precedence over a simultaneous source mismatch", () => {
    const legalText: E85LegalTextIdentityInput = {
      kind: "SELECTED",
      identity: { ...LINKAGE, jurisdictionId: "SYNTH-JURISDICTION-OTHER", sourceId: "SYNTH-SOURCE-OTHER" },
    };
    const result = evaluateE85DesignationLegalTextIdentityCorrespondence(APPLICABLE_WITHIN_CLOSED, legalText, LINKAGE);
    expect(result.kind).toBe("JURISDICTION_MISMATCH");
  });
});

describe("evaluateE85DesignationLegalTextIdentityCorrespondence — passthrough states", () => {
  test.each([
    NOT_EVALUABLE,
    { kind: "DESIGNATION_NO_START_EVIDENCE", identity: { jurisdictionId: "SYNTH-JURISDICTION-1", districtOrZoneId: "SYNTH-ZONE-TEST-1" } },
    { kind: "DESIGNATION_START_CONFLICT", identity: { jurisdictionId: "SYNTH-JURISDICTION-1", districtOrZoneId: "SYNTH-ZONE-TEST-1" } },
    {
      kind: "DESIGNATION_OBSERVATION_ONLY_NOT_LEGALLY_DATED",
      identity: { jurisdictionId: "SYNTH-JURISDICTION-1", districtOrZoneId: "SYNTH-ZONE-TEST-1" },
      observedAt: "2023-01-01",
    },
    NOT_YET_STARTED,
    {
      kind: "DESIGNATION_OUTSIDE_CLOSED_INTERVAL",
      identity: { jurisdictionId: "SYNTH-JURISDICTION-1", districtOrZoneId: "SYNTH-ZONE-TEST-1" },
      effectiveFrom: "2020-01-01",
      effectiveTo: "2021-12-31",
      asOfDate: "2022-01-01",
    },
    { kind: "DESIGNATION_END_CONFLICT", identity: { jurisdictionId: "SYNTH-JURISDICTION-1", districtOrZoneId: "SYNTH-ZONE-TEST-1" } },
  ] as readonly E85DesignationApplicabilityResult[])("non-positive-applicability designation kind %o -> DESIGNATION_NOT_APPLICABLE_PASSTHROUGH", (designation) => {
    const result = evaluateE85DesignationLegalTextIdentityCorrespondence(designation, MATCHING_LEGAL_TEXT, LINKAGE);
    expect(result.kind).toBe("DESIGNATION_NOT_APPLICABLE_PASSTHROUGH");
    if (result.kind === "DESIGNATION_NOT_APPLICABLE_PASSTHROUGH") {
      expect(result.designationResultKind).toBe(designation.kind);
    }
  });

  test("designation applicable but legal text NOT_SELECTED -> LEGAL_TEXT_NOT_SELECTED_PASSTHROUGH", () => {
    const result = evaluateE85DesignationLegalTextIdentityCorrespondence(APPLICABLE_WITHIN_CLOSED, NOT_SELECTED, LINKAGE);
    expect(result.kind).toBe("LEGAL_TEXT_NOT_SELECTED_PASSTHROUGH");
    if (result.kind === "LEGAL_TEXT_NOT_SELECTED_PASSTHROUGH") {
      expect(result.designationResultKind).toBe("DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL");
    }
  });

  test("designation-not-applicable is checked before legal-text-not-selected (designation checked first)", () => {
    const result = evaluateE85DesignationLegalTextIdentityCorrespondence(NOT_EVALUABLE, NOT_SELECTED, LINKAGE);
    expect(result.kind).toBe("DESIGNATION_NOT_APPLICABLE_PASSTHROUGH");
  });
});

describe("evaluateE85DesignationLegalTextIdentityCorrespondence — malformed input throws, never returned as a result", () => {
  test("non-object designation throws", () => {
    expect(() => evaluateE85DesignationLegalTextIdentityCorrespondence(null as unknown as E85DesignationApplicabilityResult, MATCHING_LEGAL_TEXT, LINKAGE)).toThrow(
      E85DesignationLegalTextIdentityCorrespondenceError,
    );
  });

  test("unrecognized designation.kind throws", () => {
    const malformed = { kind: "SOMETHING_ELSE" } as unknown as E85DesignationApplicabilityResult;
    expect(() => evaluateE85DesignationLegalTextIdentityCorrespondence(malformed, MATCHING_LEGAL_TEXT, LINKAGE)).toThrow(E85DesignationLegalTextIdentityCorrespondenceError);
  });

  test("non-object legalTextIdentity throws", () => {
    expect(() => evaluateE85DesignationLegalTextIdentityCorrespondence(APPLICABLE_WITHIN_CLOSED, null as unknown as E85LegalTextIdentityInput, LINKAGE)).toThrow(
      E85DesignationLegalTextIdentityCorrespondenceError,
    );
  });

  test("unrecognized legalTextIdentity.kind throws", () => {
    const malformed = { kind: "BOGUS" } as unknown as E85LegalTextIdentityInput;
    expect(() => evaluateE85DesignationLegalTextIdentityCorrespondence(APPLICABLE_WITHIN_CLOSED, malformed, LINKAGE)).toThrow(E85DesignationLegalTextIdentityCorrespondenceError);
  });

  test("SELECTED legalTextIdentity missing identity fields throws", () => {
    const malformed = { kind: "SELECTED", identity: { jurisdictionId: "x" } } as unknown as E85LegalTextIdentityInput;
    expect(() => evaluateE85DesignationLegalTextIdentityCorrespondence(APPLICABLE_WITHIN_CLOSED, malformed, LINKAGE)).toThrow(E85DesignationLegalTextIdentityCorrespondenceError);
  });

  test("non-object linkageIdentity throws", () => {
    expect(() => evaluateE85DesignationLegalTextIdentityCorrespondence(APPLICABLE_WITHIN_CLOSED, MATCHING_LEGAL_TEXT, null as unknown as E85LegalIdentity)).toThrow(
      E85DesignationLegalTextIdentityCorrespondenceError,
    );
  });

  test("linkageIdentity with an empty-string field throws", () => {
    const malformed = { ...LINKAGE, sourceId: "" };
    expect(() => evaluateE85DesignationLegalTextIdentityCorrespondence(APPLICABLE_WITHIN_CLOSED, MATCHING_LEGAL_TEXT, malformed)).toThrow(
      E85DesignationLegalTextIdentityCorrespondenceError,
    );
  });

  test("linkageIdentity with a whitespace-only field throws", () => {
    const malformed = { ...LINKAGE, zoneDesignation: "   " };
    expect(() => evaluateE85DesignationLegalTextIdentityCorrespondence(APPLICABLE_WITHIN_CLOSED, MATCHING_LEGAL_TEXT, malformed)).toThrow(
      E85DesignationLegalTextIdentityCorrespondenceError,
    );
  });

  // Reproduces the exact native-TypeError-leak defect found by the Phase 15.22C freeze
  // audit's probe: a recognized, whitelisted positive-applicability `kind` whose
  // `identity` field is missing must throw the module's own typed error, never a native
  // TypeError, before any downstream code reads `identity.jurisdictionId`/`districtOrZoneId`.
  test("DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL with no identity field throws the typed error, not a native TypeError", () => {
    const malformed = { kind: "DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL" } as unknown as E85DesignationApplicabilityResult;
    expect(() => evaluateE85DesignationLegalTextIdentityCorrespondence(malformed, MATCHING_LEGAL_TEXT, LINKAGE)).toThrow(E85DesignationLegalTextIdentityCorrespondenceError);
    expect(() => evaluateE85DesignationLegalTextIdentityCorrespondence(malformed, MATCHING_LEGAL_TEXT, LINKAGE)).not.toThrow(TypeError);
  });

  test("DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END with no identity field throws the typed error, not a native TypeError", () => {
    const malformed = { kind: "DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END", effectiveFrom: "2020-01-01", asOfDate: "2020-06-01" } as unknown as E85DesignationApplicabilityResult;
    expect(() => evaluateE85DesignationLegalTextIdentityCorrespondence(malformed, MATCHING_LEGAL_TEXT, LINKAGE)).toThrow(E85DesignationLegalTextIdentityCorrespondenceError);
    expect(() => evaluateE85DesignationLegalTextIdentityCorrespondence(malformed, MATCHING_LEGAL_TEXT, LINKAGE)).not.toThrow(TypeError);
  });

  test("designation.identity: null throws the typed error, not a native TypeError", () => {
    const malformed = { ...APPLICABLE_WITHIN_CLOSED, identity: null } as unknown as E85DesignationApplicabilityResult;
    expect(() => evaluateE85DesignationLegalTextIdentityCorrespondence(malformed, MATCHING_LEGAL_TEXT, LINKAGE)).toThrow(E85DesignationLegalTextIdentityCorrespondenceError);
    expect(() => evaluateE85DesignationLegalTextIdentityCorrespondence(malformed, MATCHING_LEGAL_TEXT, LINKAGE)).not.toThrow(TypeError);
  });

  test("designation.identity not an object (a string) throws the typed error", () => {
    const malformed = { ...APPLICABLE_WITHIN_CLOSED, identity: "SYNTH-ZONE-TEST-1" } as unknown as E85DesignationApplicabilityResult;
    expect(() => evaluateE85DesignationLegalTextIdentityCorrespondence(malformed, MATCHING_LEGAL_TEXT, LINKAGE)).toThrow(E85DesignationLegalTextIdentityCorrespondenceError);
  });

  test("designation.identity missing districtOrZoneId throws the typed error, not a native TypeError", () => {
    const malformed = { ...APPLICABLE_WITHIN_CLOSED, identity: { jurisdictionId: "SYNTH-JURISDICTION-1" } } as unknown as E85DesignationApplicabilityResult;
    expect(() => evaluateE85DesignationLegalTextIdentityCorrespondence(malformed, MATCHING_LEGAL_TEXT, LINKAGE)).toThrow(E85DesignationLegalTextIdentityCorrespondenceError);
    expect(() => evaluateE85DesignationLegalTextIdentityCorrespondence(malformed, MATCHING_LEGAL_TEXT, LINKAGE)).not.toThrow(TypeError);
  });

  test("designation.identity missing jurisdictionId throws the typed error", () => {
    const malformed = { ...APPLICABLE_WITHIN_CLOSED, identity: { districtOrZoneId: "SYNTH-ZONE-TEST-1" } } as unknown as E85DesignationApplicabilityResult;
    expect(() => evaluateE85DesignationLegalTextIdentityCorrespondence(malformed, MATCHING_LEGAL_TEXT, LINKAGE)).toThrow(E85DesignationLegalTextIdentityCorrespondenceError);
  });

  test("designation.identity with an empty-string field throws the typed error", () => {
    const malformed = { ...APPLICABLE_WITHIN_CLOSED, identity: { jurisdictionId: "", districtOrZoneId: "SYNTH-ZONE-TEST-1" } } as unknown as E85DesignationApplicabilityResult;
    expect(() => evaluateE85DesignationLegalTextIdentityCorrespondence(malformed, MATCHING_LEGAL_TEXT, LINKAGE)).toThrow(E85DesignationLegalTextIdentityCorrespondenceError);
  });

  test("a non-positive-applicability designation kind with no identity field does NOT throw (identity is only required for the two positive kinds)", () => {
    const noIdentityNeeded = { kind: "DESIGNATION_APPLICABILITY_NOT_EVALUABLE" } as E85DesignationApplicabilityResult;
    const result = evaluateE85DesignationLegalTextIdentityCorrespondence(noIdentityNeeded, MATCHING_LEGAL_TEXT, LINKAGE);
    expect(result.kind).toBe("DESIGNATION_NOT_APPLICABLE_PASSTHROUGH");
  });
});

describe("evaluateE85DesignationLegalTextIdentityCorrespondence — compile-time exhaustiveness", () => {
  test("the result union's discriminant set is exactly the seven documented kinds (a `never`-narrowing compile check)", () => {
    function assertNever(x: never): never {
      throw new Error(`unreachable: ${JSON.stringify(x)}`);
    }

    function classify(result: E85DesignationLegalTextCorrespondenceResult): string {
      switch (result.kind) {
        case "DESIGNATION_NOT_APPLICABLE_PASSTHROUGH":
        case "LEGAL_TEXT_NOT_SELECTED_PASSTHROUGH":
        case "JURISDICTION_MISMATCH":
        case "SOURCE_MISMATCH":
        case "VERSION_MISMATCH":
        case "ZONE_MISMATCH":
        case "IDENTITY_CORRESPONDENCE_ESTABLISHED":
          return result.kind;
        default:
          return assertNever(result);
      }
    }

    expect(classify({ kind: "DESIGNATION_NOT_APPLICABLE_PASSTHROUGH", designationResultKind: "DESIGNATION_APPLICABILITY_NOT_EVALUABLE" })).toBe(
      "DESIGNATION_NOT_APPLICABLE_PASSTHROUGH",
    );
  });
});

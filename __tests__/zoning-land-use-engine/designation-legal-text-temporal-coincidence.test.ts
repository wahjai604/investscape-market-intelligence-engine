/**
 * InvestScape™ E85 — designation/legal-text temporal coincidence evaluator
 * tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 */
import * as fs from "fs";
import * as path from "path";
import {
  evaluateE85DesignationLegalTextTemporalCoincidence,
  E85DesignationLegalTextTemporalCoincidenceError,
} from "../../src/zoning-land-use-engine/designation-legal-text-temporal-coincidence";
import type { E85DesignationApplicabilityResult } from "../../src/zoning-land-use-engine/designation-applicability";
import type { E85LegalTextApplicabilityResult } from "../../src/zoning-land-use-engine/legal-text-applicability";

const IDENTITY = { jurisdictionId: "SYNTH-JURISDICTION-1", districtOrZoneId: "SYNTH-ZONE-TEST-1" };
const ASOF = "2020-06-01";

const DESIGNATION_CLOSED: E85DesignationApplicabilityResult = {
  kind: "DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL",
  identity: IDENTITY,
  effectiveFrom: "2020-01-01",
  effectiveTo: "2021-12-31",
  asOfDate: ASOF,
};

const DESIGNATION_OPEN_END: E85DesignationApplicabilityResult = {
  kind: "DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END",
  identity: IDENTITY,
  effectiveFrom: "2020-01-01",
  asOfDate: ASOF,
};

const DESIGNATION_NOT_YET_STARTED: E85DesignationApplicabilityResult = {
  kind: "DESIGNATION_NOT_YET_STARTED",
  identity: IDENTITY,
  effectiveFrom: "2030-01-01",
  asOfDate: ASOF,
};

const DESIGNATION_OUTSIDE_CLOSED: E85DesignationApplicabilityResult = {
  kind: "DESIGNATION_OUTSIDE_CLOSED_INTERVAL",
  identity: IDENTITY,
  effectiveFrom: "2000-01-01",
  effectiveTo: "2001-01-01",
  asOfDate: ASOF,
};

const DESIGNATION_NOT_EVALUABLE: E85DesignationApplicabilityResult = { kind: "DESIGNATION_APPLICABILITY_NOT_EVALUABLE" };
const DESIGNATION_NO_START_EVIDENCE: E85DesignationApplicabilityResult = { kind: "DESIGNATION_NO_START_EVIDENCE", identity: IDENTITY };
const DESIGNATION_START_CONFLICT: E85DesignationApplicabilityResult = { kind: "DESIGNATION_START_CONFLICT", identity: IDENTITY };
const DESIGNATION_END_CONFLICT: E85DesignationApplicabilityResult = { kind: "DESIGNATION_END_CONFLICT", identity: IDENTITY };
const DESIGNATION_OBSERVATION_ONLY: E85DesignationApplicabilityResult = {
  kind: "DESIGNATION_OBSERVATION_ONLY_NOT_LEGALLY_DATED",
  identity: IDENTITY,
  observedAt: "2019-01-01",
};

const LEGAL_TEXT_CLOSED: E85LegalTextApplicabilityResult = {
  kind: "LEGAL_TEXT_APPLICABLE_WITHIN_CLOSED_INTERVAL",
  effectiveFrom: "2020-01-01",
  effectiveTo: "2021-12-31",
  asOfDate: ASOF,
  limitation: "legal-text limitation text",
};

const LEGAL_TEXT_OPEN_END: E85LegalTextApplicabilityResult = {
  kind: "LEGAL_TEXT_POSSIBLY_APPLICABLE_OPEN_END",
  effectiveFrom: "2020-01-01",
  asOfDate: ASOF,
  limitation: "legal-text limitation text",
};

const LEGAL_TEXT_NOT_YET_STARTED: E85LegalTextApplicabilityResult = {
  kind: "LEGAL_TEXT_NOT_YET_STARTED",
  effectiveFrom: "2030-01-01",
  asOfDate: ASOF,
};

const LEGAL_TEXT_OUTSIDE_CLOSED: E85LegalTextApplicabilityResult = {
  kind: "LEGAL_TEXT_OUTSIDE_CLOSED_INTERVAL",
  effectiveFrom: "2000-01-01",
  effectiveTo: "2001-01-01",
  asOfDate: ASOF,
};

const LEGAL_TEXT_NOT_EVALUABLE: E85LegalTextApplicabilityResult = { kind: "LEGAL_TEXT_APPLICABILITY_NOT_EVALUABLE" };
const LEGAL_TEXT_NO_START_EVIDENCE: E85LegalTextApplicabilityResult = { kind: "LEGAL_TEXT_NO_START_EVIDENCE" };
const LEGAL_TEXT_START_CONFLICT: E85LegalTextApplicabilityResult = { kind: "LEGAL_TEXT_START_CONFLICT" };
const LEGAL_TEXT_END_CONFLICT: E85LegalTextApplicabilityResult = { kind: "LEGAL_TEXT_END_CONFLICT", effectiveFrom: "2020-01-01", asOfDate: ASOF };
const LEGAL_TEXT_PARTIAL_TERMINATION: E85LegalTextApplicabilityResult = { kind: "LEGAL_TEXT_PARTIAL_TERMINATION_INDETERMINATE" };

describe("evaluateE85DesignationLegalTextTemporalCoincidence", () => {
  // Case 1: both closed-applicable.
  test("both sides closed-applicable -> BOTH_CLOSED_APPLICABLE", () => {
    const result = evaluateE85DesignationLegalTextTemporalCoincidence(DESIGNATION_CLOSED, LEGAL_TEXT_CLOSED, ASOF);
    expect(result.kind).toBe("BOTH_CLOSED_APPLICABLE");
    expect(result.designationResultKind).toBe("DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL");
    expect(result.legalTextResultKind).toBe("LEGAL_TEXT_APPLICABLE_WITHIN_CLOSED_INTERVAL");
    expect(result.asOf).toBe(ASOF);
    if (result.kind === "BOTH_CLOSED_APPLICABLE") {
      expect(typeof result.limitation).toBe("string");
    }
  });

  // Case 2: mixed closed + open-end, both directions.
  test("designation closed, legal-text open-end -> MIXED, openEndSide=LEGAL_TEXT", () => {
    const result = evaluateE85DesignationLegalTextTemporalCoincidence(DESIGNATION_CLOSED, LEGAL_TEXT_OPEN_END, ASOF);
    expect(result.kind).toBe("MIXED_CLOSED_AND_OPEN_END_APPLICABLE");
    if (result.kind === "MIXED_CLOSED_AND_OPEN_END_APPLICABLE") {
      expect(result.openEndSide).toBe("LEGAL_TEXT");
      expect(result.designationResultKind).toBe("DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL");
      expect(result.legalTextResultKind).toBe("LEGAL_TEXT_POSSIBLY_APPLICABLE_OPEN_END");
    }
  });

  test("designation open-end, legal-text closed -> MIXED, openEndSide=DESIGNATION", () => {
    const result = evaluateE85DesignationLegalTextTemporalCoincidence(DESIGNATION_OPEN_END, LEGAL_TEXT_CLOSED, ASOF);
    expect(result.kind).toBe("MIXED_CLOSED_AND_OPEN_END_APPLICABLE");
    if (result.kind === "MIXED_CLOSED_AND_OPEN_END_APPLICABLE") {
      expect(result.openEndSide).toBe("DESIGNATION");
    }
  });

  // Case 3: both open-end hedged, must differ from case 1.
  test("both sides open-end -> BOTH_OPEN_END_APPLICABLE, distinct from BOTH_CLOSED_APPLICABLE", () => {
    const result = evaluateE85DesignationLegalTextTemporalCoincidence(DESIGNATION_OPEN_END, LEGAL_TEXT_OPEN_END, ASOF);
    expect(result.kind).toBe("BOTH_OPEN_END_APPLICABLE");
    expect(result.kind).not.toBe("BOTH_CLOSED_APPLICABLE");
    if (result.kind === "BOTH_OPEN_END_APPLICABLE") {
      expect(typeof result.limitation).toBe("string");
    }
  });

  // Case 4: non-positive-but-dated kinds -> NOT_COINCIDENT.
  test("designation not-yet-started + legal-text closed -> NOT_COINCIDENT preserving both kinds", () => {
    const result = evaluateE85DesignationLegalTextTemporalCoincidence(DESIGNATION_NOT_YET_STARTED, LEGAL_TEXT_CLOSED, ASOF);
    expect(result.kind).toBe("NOT_COINCIDENT");
    expect(result.designationResultKind).toBe("DESIGNATION_NOT_YET_STARTED");
    expect(result.legalTextResultKind).toBe("LEGAL_TEXT_APPLICABLE_WITHIN_CLOSED_INTERVAL");
  });

  test("designation closed + legal-text outside-closed -> NOT_COINCIDENT preserving both kinds", () => {
    const result = evaluateE85DesignationLegalTextTemporalCoincidence(DESIGNATION_CLOSED, LEGAL_TEXT_OUTSIDE_CLOSED, ASOF);
    expect(result.kind).toBe("NOT_COINCIDENT");
    expect(result.designationResultKind).toBe("DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL");
    expect(result.legalTextResultKind).toBe("LEGAL_TEXT_OUTSIDE_CLOSED_INTERVAL");
  });

  test("designation outside-closed + legal-text not-yet-started -> NOT_COINCIDENT", () => {
    const result = evaluateE85DesignationLegalTextTemporalCoincidence(DESIGNATION_OUTSIDE_CLOSED, LEGAL_TEXT_NOT_YET_STARTED, ASOF);
    expect(result.kind).toBe("NOT_COINCIDENT");
    expect(result.designationResultKind).toBe("DESIGNATION_OUTSIDE_CLOSED_INTERVAL");
    expect(result.legalTextResultKind).toBe("LEGAL_TEXT_NOT_YET_STARTED");
  });

  // Case 5: indeterminate kinds, exact source kind preserved, each variant on each side.
  describe("indeterminate kinds preserved exactly", () => {
    const designationIndeterminateCases: [string, E85DesignationApplicabilityResult][] = [
      ["DESIGNATION_NO_START_EVIDENCE", DESIGNATION_NO_START_EVIDENCE],
      ["DESIGNATION_START_CONFLICT", DESIGNATION_START_CONFLICT],
      ["DESIGNATION_END_CONFLICT", DESIGNATION_END_CONFLICT],
      ["DESIGNATION_OBSERVATION_ONLY_NOT_LEGALLY_DATED", DESIGNATION_OBSERVATION_ONLY],
    ];
    for (const [label, designation] of designationIndeterminateCases) {
      test(`designation ${label} + legal-text closed -> INDETERMINATE, exact designation kind preserved`, () => {
        const result = evaluateE85DesignationLegalTextTemporalCoincidence(designation, LEGAL_TEXT_CLOSED, ASOF);
        expect(result.kind).toBe("INDETERMINATE");
        expect(result.designationResultKind).toBe(label);
        expect(result.legalTextResultKind).toBe("LEGAL_TEXT_APPLICABLE_WITHIN_CLOSED_INTERVAL");
      });
    }

    const legalTextIndeterminateCases: [string, E85LegalTextApplicabilityResult][] = [
      ["LEGAL_TEXT_NO_START_EVIDENCE", LEGAL_TEXT_NO_START_EVIDENCE],
      ["LEGAL_TEXT_START_CONFLICT", LEGAL_TEXT_START_CONFLICT],
      ["LEGAL_TEXT_END_CONFLICT", LEGAL_TEXT_END_CONFLICT],
      ["LEGAL_TEXT_PARTIAL_TERMINATION_INDETERMINATE", LEGAL_TEXT_PARTIAL_TERMINATION],
    ];
    for (const [label, legalText] of legalTextIndeterminateCases) {
      test(`legal-text ${label} + designation closed -> INDETERMINATE, exact legal-text kind preserved`, () => {
        const result = evaluateE85DesignationLegalTextTemporalCoincidence(DESIGNATION_CLOSED, legalText, ASOF);
        expect(result.kind).toBe("INDETERMINATE");
        expect(result.legalTextResultKind).toBe(label);
        expect(result.designationResultKind).toBe("DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL");
      });
    }
  });

  // Case 6: not-evaluable, naming which side(s).
  test("designation not-evaluable only -> NOT_EVALUABLE, notEvaluableSide=DESIGNATION", () => {
    const result = evaluateE85DesignationLegalTextTemporalCoincidence(DESIGNATION_NOT_EVALUABLE, LEGAL_TEXT_CLOSED, ASOF);
    expect(result.kind).toBe("NOT_EVALUABLE");
    if (result.kind === "NOT_EVALUABLE") {
      expect(result.notEvaluableSide).toBe("DESIGNATION");
    }
  });

  test("legal-text not-evaluable only -> NOT_EVALUABLE, notEvaluableSide=LEGAL_TEXT", () => {
    const result = evaluateE85DesignationLegalTextTemporalCoincidence(DESIGNATION_CLOSED, LEGAL_TEXT_NOT_EVALUABLE, ASOF);
    expect(result.kind).toBe("NOT_EVALUABLE");
    if (result.kind === "NOT_EVALUABLE") {
      expect(result.notEvaluableSide).toBe("LEGAL_TEXT");
    }
  });

  test("both not-evaluable -> NOT_EVALUABLE, notEvaluableSide=BOTH", () => {
    const result = evaluateE85DesignationLegalTextTemporalCoincidence(DESIGNATION_NOT_EVALUABLE, LEGAL_TEXT_NOT_EVALUABLE, ASOF);
    expect(result.kind).toBe("NOT_EVALUABLE");
    if (result.kind === "NOT_EVALUABLE") {
      expect(result.notEvaluableSide).toBe("BOTH");
    }
  });

  // Case 7: mixed positive + non-positive falls under NOT_COINCIDENT, preserving both kinds.
  test("designation positive + legal-text not-evaluable is reported as NOT_EVALUABLE (more specific), not NOT_COINCIDENT", () => {
    const result = evaluateE85DesignationLegalTextTemporalCoincidence(DESIGNATION_OPEN_END, LEGAL_TEXT_NOT_EVALUABLE, ASOF);
    expect(result.kind).toBe("NOT_EVALUABLE");
  });

  test("designation positive + legal-text indeterminate is reported as INDETERMINATE (more specific), not NOT_COINCIDENT", () => {
    const result = evaluateE85DesignationLegalTextTemporalCoincidence(DESIGNATION_OPEN_END, LEGAL_TEXT_START_CONFLICT, ASOF);
    expect(result.kind).toBe("INDETERMINATE");
  });

  test("designation positive + legal-text dated-non-positive -> NOT_COINCIDENT, both kinds preserved", () => {
    const result = evaluateE85DesignationLegalTextTemporalCoincidence(DESIGNATION_OPEN_END, LEGAL_TEXT_NOT_YET_STARTED, ASOF);
    expect(result.kind).toBe("NOT_COINCIDENT");
    expect(result.designationResultKind).toBe("DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END");
    expect(result.legalTextResultKind).toBe("LEGAL_TEXT_NOT_YET_STARTED");
  });

  // asOf echoed, not used to cross-check embedded dates.
  test("asOf is echoed on the result for caller reference, using the caller-supplied value verbatim", () => {
    const differentAsOf = "1999-01-01";
    const result = evaluateE85DesignationLegalTextTemporalCoincidence(DESIGNATION_CLOSED, LEGAL_TEXT_CLOSED, differentAsOf);
    // Note: DESIGNATION_CLOSED/LEGAL_TEXT_CLOSED both carry asOfDate "2020-06-01"
    // internally, yet the evaluator does NOT reject or alter the outcome based
    // on that mismatch -- it trusts the caller's asOf per the documented trust
    // boundary and simply echoes it back.
    expect(result.kind).toBe("BOTH_CLOSED_APPLICABLE");
    expect(result.asOf).toBe(differentAsOf);
  });

  // Limitation text content checks.
  test("positive-outcome limitation includes trust-boundary statement and full non-claims list", () => {
    const result = evaluateE85DesignationLegalTextTemporalCoincidence(DESIGNATION_CLOSED, LEGAL_TEXT_CLOSED, ASOF);
    expect(result.kind).toBe("BOTH_CLOSED_APPLICABLE");
    if (result.kind !== "BOTH_CLOSED_APPLICABLE") return;
    const text = result.limitation;
    expect(text).toMatch(/ASSUMED, not verified/i);
    expect(text).toMatch(/asOf/);
    expect(text).toMatch(/legal effect/i);
    expect(text).toMatch(/enactment/i);
    expect(text).toMatch(/applicable to any particular property/i);
    expect(text).toMatch(/identity correspondence/i);
    expect(text).toMatch(/historical continuity/i);
    expect(text).toMatch(/rule-pack/i);
    expect(text).toMatch(/final zoning or planning determination/i);
  });

  // Determinism.
  test("determinism: same inputs twice yield deeply-equal output", () => {
    const first = evaluateE85DesignationLegalTextTemporalCoincidence(DESIGNATION_CLOSED, LEGAL_TEXT_CLOSED, ASOF);
    const second = evaluateE85DesignationLegalTextTemporalCoincidence(DESIGNATION_CLOSED, LEGAL_TEXT_CLOSED, ASOF);
    expect(first).toEqual(second);
  });

  // Defensive validation.
  test("throws E85DesignationLegalTextTemporalCoincidenceError on unrecognized designation.kind", () => {
    expect(() =>
      evaluateE85DesignationLegalTextTemporalCoincidence({ kind: "NOT_A_REAL_KIND" } as unknown as E85DesignationApplicabilityResult, LEGAL_TEXT_CLOSED, ASOF),
    ).toThrow(E85DesignationLegalTextTemporalCoincidenceError);
  });

  test("throws E85DesignationLegalTextTemporalCoincidenceError on unrecognized legalText.kind", () => {
    expect(() =>
      evaluateE85DesignationLegalTextTemporalCoincidence(DESIGNATION_CLOSED, { kind: "NOT_A_REAL_KIND" } as unknown as E85LegalTextApplicabilityResult, ASOF),
    ).toThrow(E85DesignationLegalTextTemporalCoincidenceError);
  });

  test("throws E85DesignationLegalTextTemporalCoincidenceError on empty asOf", () => {
    expect(() => evaluateE85DesignationLegalTextTemporalCoincidence(DESIGNATION_CLOSED, LEGAL_TEXT_CLOSED, "")).toThrow(
      E85DesignationLegalTextTemporalCoincidenceError,
    );
  });
});

describe("module source hygiene", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../../src/zoning-land-use-engine/designation-legal-text-temporal-coincidence.ts"),
    "utf8",
  );

  test("does not call Date.now() or new Date()", () => {
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(codeOnly).not.toMatch(/Date\.now\(\)/);
    expect(codeOnly).not.toMatch(/new Date\(/);
  });

  test("does not import the Slice 3H-1 identity-correspondence module", () => {
    const importLines = source.split("\n").filter((line) => /^\s*import /.test(line));
    for (const line of importLines) {
      expect(line).not.toMatch(/designation-legal-text-identity-correspondence/);
    }
  });

  test("does not import raw validity/interval types", () => {
    const importLines = source.split("\n").filter((line) => /^\s*import /.test(line));
    for (const line of importLines) {
      expect(line).not.toMatch(/designation-validity-types/);
      expect(line).not.toMatch(/version-validity-types/);
      expect(line).not.toMatch(/E85DesignationValidity/);
      expect(line).not.toMatch(/E85VersionValidity/);
    }
  });

  test("does not import any rule-pack module", () => {
    expect(source).not.toMatch(/rule-pack-composer/);
    expect(source).not.toMatch(/decision-rule-pack-resolution/);
  });
});

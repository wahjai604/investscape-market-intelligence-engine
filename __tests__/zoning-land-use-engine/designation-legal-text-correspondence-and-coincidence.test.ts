import {
  pairE85DesignationLegalTextCorrespondenceAndCoincidence,
  type E85DesignationLegalTextCorrespondenceAndCoincidenceResult,
} from "../../src/zoning-land-use-engine/designation-legal-text-correspondence-and-coincidence";
import type { E85DesignationLegalTextCorrespondenceResult } from "../../src/zoning-land-use-engine/designation-legal-text-identity-correspondence";
import type { E85DesignationLegalTextTemporalCoincidenceResult } from "../../src/zoning-land-use-engine/designation-legal-text-temporal-coincidence";

const legalTextIdentity = {
  jurisdictionId: "jur-1",
  sourceId: "src-1",
  sourceVersionId: "ver-1",
  zoneDesignation: "RS-1",
};

const linkageIdentity = {
  jurisdictionId: "jur-1",
  sourceId: "src-1",
  sourceVersionId: "ver-1",
  zoneDesignation: "RS-1",
};

// ---- correspondence fixtures (all 7 variants) ----

const correspondenceFixtures: Record<string, E85DesignationLegalTextCorrespondenceResult> = {
  DESIGNATION_NOT_APPLICABLE_PASSTHROUGH: {
    kind: "DESIGNATION_NOT_APPLICABLE_PASSTHROUGH",
    designationResultKind: "DESIGNATION_NOT_YET_STARTED",
  },
  LEGAL_TEXT_NOT_SELECTED_PASSTHROUGH: {
    kind: "LEGAL_TEXT_NOT_SELECTED_PASSTHROUGH",
    designationResultKind: "DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL",
  },
  JURISDICTION_MISMATCH: {
    kind: "JURISDICTION_MISMATCH",
    designationResultKind: "DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL",
    legalTextIdentity,
    linkageIdentity: { ...linkageIdentity, jurisdictionId: "jur-2" },
  },
  SOURCE_MISMATCH: {
    kind: "SOURCE_MISMATCH",
    designationResultKind: "DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL",
    legalTextIdentity,
    linkageIdentity: { ...linkageIdentity, sourceId: "src-2" },
  },
  VERSION_MISMATCH: {
    kind: "VERSION_MISMATCH",
    designationResultKind: "DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL",
    legalTextIdentity,
    linkageIdentity: { ...linkageIdentity, sourceVersionId: "ver-2" },
  },
  ZONE_MISMATCH: {
    kind: "ZONE_MISMATCH",
    designationResultKind: "DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL",
    legalTextIdentity,
    linkageIdentity: { ...linkageIdentity, zoneDesignation: "RS-2" },
  },
  IDENTITY_CORRESPONDENCE_ESTABLISHED: {
    kind: "IDENTITY_CORRESPONDENCE_ESTABLISHED",
    designationResultKind: "DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL",
    legalTextIdentity,
    linkageIdentity,
    limitation: "identity correspondence established limitation text",
  },
};

// ---- coincidence fixtures (all 6 variants) ----

const coincidenceFixtures: Record<string, E85DesignationLegalTextTemporalCoincidenceResult> = {
  BOTH_CLOSED_APPLICABLE: {
    kind: "BOTH_CLOSED_APPLICABLE",
    designationResultKind: "DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL",
    legalTextResultKind: "LEGAL_TEXT_APPLICABLE_WITHIN_CLOSED_INTERVAL",
    asOf: "2026-01-01",
    limitation: "positive coincidence limitation text",
  },
  MIXED_CLOSED_AND_OPEN_END_APPLICABLE: {
    kind: "MIXED_CLOSED_AND_OPEN_END_APPLICABLE",
    designationResultKind: "DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL",
    legalTextResultKind: "LEGAL_TEXT_POSSIBLY_APPLICABLE_OPEN_END",
    openEndSide: "LEGAL_TEXT",
    asOf: "2026-01-01",
    limitation: "positive coincidence limitation text",
  },
  BOTH_OPEN_END_APPLICABLE: {
    kind: "BOTH_OPEN_END_APPLICABLE",
    designationResultKind: "DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END",
    legalTextResultKind: "LEGAL_TEXT_POSSIBLY_APPLICABLE_OPEN_END",
    asOf: "2026-01-01",
    limitation: "positive coincidence limitation text",
  },
  NOT_EVALUABLE: {
    kind: "NOT_EVALUABLE",
    designationResultKind: "DESIGNATION_APPLICABILITY_NOT_EVALUABLE",
    legalTextResultKind: "LEGAL_TEXT_APPLICABILITY_NOT_EVALUABLE",
    notEvaluableSide: "BOTH",
    asOf: "2026-01-01",
  },
  INDETERMINATE: {
    kind: "INDETERMINATE",
    designationResultKind: "DESIGNATION_START_CONFLICT",
    legalTextResultKind: "LEGAL_TEXT_START_CONFLICT",
    asOf: "2026-01-01",
  },
  NOT_COINCIDENT: {
    kind: "NOT_COINCIDENT",
    designationResultKind: "DESIGNATION_NOT_YET_STARTED",
    legalTextResultKind: "LEGAL_TEXT_NOT_YET_STARTED",
    asOf: "2026-01-01",
  },
};

const POSITIVE_COINCIDENCE_KINDS = new Set([
  "BOTH_CLOSED_APPLICABLE",
  "MIXED_CLOSED_AND_OPEN_END_APPLICABLE",
  "BOTH_OPEN_END_APPLICABLE",
]);

function expectedLimitationAttached(correspondenceKind: string, coincidenceKind: string): boolean {
  return correspondenceKind === "IDENTITY_CORRESPONDENCE_ESTABLISHED" || POSITIVE_COINCIDENCE_KINDS.has(coincidenceKind);
}

describe("pairE85DesignationLegalTextCorrespondenceAndCoincidence", () => {
  describe("representative pairing across all 7 correspondence kinds (fixed coincidence: NOT_COINCIDENT)", () => {
    for (const [correspondenceKind, correspondence] of Object.entries(correspondenceFixtures)) {
      it(`correspondence=${correspondenceKind}`, () => {
        const coincidence = coincidenceFixtures.NOT_COINCIDENT;
        const result = pairE85DesignationLegalTextCorrespondenceAndCoincidence(correspondence, coincidence);

        expect(result.correspondence).toBe(correspondence);
        expect(result.coincidence).toBe(coincidence);

        const shouldAttach = expectedLimitationAttached(correspondenceKind, "NOT_COINCIDENT");
        if (shouldAttach) {
          expect(result.limitation).toBeDefined();
        } else {
          expect(result.limitation).toBeUndefined();
        }
      });
    }
  });

  describe("representative pairing across all 6 coincidence kinds (fixed correspondence: DESIGNATION_NOT_APPLICABLE_PASSTHROUGH)", () => {
    for (const [coincidenceKind, coincidence] of Object.entries(coincidenceFixtures)) {
      it(`coincidence=${coincidenceKind}`, () => {
        const correspondence = correspondenceFixtures.DESIGNATION_NOT_APPLICABLE_PASSTHROUGH;
        const result = pairE85DesignationLegalTextCorrespondenceAndCoincidence(correspondence, coincidence);

        expect(result.correspondence).toBe(correspondence);
        expect(result.coincidence).toBe(coincidence);

        const shouldAttach = expectedLimitationAttached("DESIGNATION_NOT_APPLICABLE_PASSTHROUGH", coincidenceKind);
        if (shouldAttach) {
          expect(result.limitation).toBeDefined();
        } else {
          expect(result.limitation).toBeUndefined();
        }
      });
    }
  });

  describe("boundary cases", () => {
    it("IDENTITY_CORRESPONDENCE_ESTABLISHED + BOTH_CLOSED_APPLICABLE (positive+positive) -> limitation attached", () => {
      const result = pairE85DesignationLegalTextCorrespondenceAndCoincidence(
        correspondenceFixtures.IDENTITY_CORRESPONDENCE_ESTABLISHED,
        coincidenceFixtures.BOTH_CLOSED_APPLICABLE,
      );
      expect(result.limitation).toBeDefined();
    });

    it("IDENTITY_CORRESPONDENCE_ESTABLISHED + INDETERMINATE (positive+negative) -> limitation attached", () => {
      const result = pairE85DesignationLegalTextCorrespondenceAndCoincidence(
        correspondenceFixtures.IDENTITY_CORRESPONDENCE_ESTABLISHED,
        coincidenceFixtures.INDETERMINATE,
      );
      expect(result.limitation).toBeDefined();
    });

    it("IDENTITY_CORRESPONDENCE_ESTABLISHED + NOT_EVALUABLE (positive+negative) -> limitation attached", () => {
      const result = pairE85DesignationLegalTextCorrespondenceAndCoincidence(
        correspondenceFixtures.IDENTITY_CORRESPONDENCE_ESTABLISHED,
        coincidenceFixtures.NOT_EVALUABLE,
      );
      expect(result.limitation).toBeDefined();
    });

    it("mismatch correspondence (negative) + BOTH_CLOSED_APPLICABLE (positive) -> limitation attached", () => {
      const result = pairE85DesignationLegalTextCorrespondenceAndCoincidence(
        correspondenceFixtures.ZONE_MISMATCH,
        coincidenceFixtures.BOTH_CLOSED_APPLICABLE,
      );
      expect(result.limitation).toBeDefined();
    });

    it("passthrough correspondence (negative) + BOTH_CLOSED_APPLICABLE (positive) -> limitation attached", () => {
      const result = pairE85DesignationLegalTextCorrespondenceAndCoincidence(
        correspondenceFixtures.DESIGNATION_NOT_APPLICABLE_PASSTHROUGH,
        coincidenceFixtures.BOTH_CLOSED_APPLICABLE,
      );
      expect(result.limitation).toBeDefined();
    });

    it("both negative (DESIGNATION_NOT_APPLICABLE_PASSTHROUGH + NOT_COINCIDENT) -> limitation NOT attached", () => {
      const result = pairE85DesignationLegalTextCorrespondenceAndCoincidence(
        correspondenceFixtures.DESIGNATION_NOT_APPLICABLE_PASSTHROUGH,
        coincidenceFixtures.NOT_COINCIDENT,
      );
      expect(result.limitation).toBeUndefined();
      expect("limitation" in result).toBe(false);
    });
  });

  describe("exact preservation of inputs", () => {
    it("deep-equals correspondence and coincidence for IDENTITY_CORRESPONDENCE_ESTABLISHED + BOTH_CLOSED_APPLICABLE", () => {
      const correspondence = correspondenceFixtures.IDENTITY_CORRESPONDENCE_ESTABLISHED;
      const coincidence = coincidenceFixtures.BOTH_CLOSED_APPLICABLE;
      const result = pairE85DesignationLegalTextCorrespondenceAndCoincidence(correspondence, coincidence);

      expect(result.correspondence).toEqual(correspondence);
      expect(result.coincidence).toEqual(coincidence);
      expect(result.correspondence).toBe(correspondence);
      expect(result.coincidence).toBe(coincidence);
    });

    it("deep-equals correspondence and coincidence for JURISDICTION_MISMATCH + NOT_EVALUABLE", () => {
      const correspondence = correspondenceFixtures.JURISDICTION_MISMATCH;
      const coincidence = coincidenceFixtures.NOT_EVALUABLE;
      const result = pairE85DesignationLegalTextCorrespondenceAndCoincidence(correspondence, coincidence);

      expect(result.correspondence).toEqual(correspondence);
      expect(result.coincidence).toEqual(coincidence);
      expect(result.correspondence).toBe(correspondence);
      expect(result.coincidence).toBe(coincidence);
    });
  });

  describe("limitation text content", () => {
    it("contains the cannot-verify-same-records caveat, the full non-claims list, and the non-contradiction clarification", () => {
      const result = pairE85DesignationLegalTextCorrespondenceAndCoincidence(
        correspondenceFixtures.IDENTITY_CORRESPONDENCE_ESTABLISHED,
        coincidenceFixtures.BOTH_CLOSED_APPLICABLE,
      );
      const text = result.limitation as string;

      // cannot-verify-same-records/date caveat
      expect(text).toMatch(/cannot verify/i);
      expect(text).toMatch(/same designation record/i);
      expect(text).toMatch(/same.*legal-text\/linkage entry|legal-text\/linkage entry/i);
      expect(text).toMatch(/same as-of date/i);

      // full non-claims list
      expect(text).toMatch(/legal effect/i);
      expect(text).toMatch(/enactment/i);
      expect(text).toMatch(/property-specific applicability/i);
      expect(text).toMatch(/historical continuity/i);
      expect(text).toMatch(/rule-pack application/i);
      expect(text).toMatch(/final zoning or planning determination/i);

      // non-contradiction clarification
      expect(text).toMatch(/IDENTITY_CORRESPONDENCE_ESTABLISHED/);
      expect(text).toMatch(/not being contradicted/i);
    });
  });

  describe("hygiene / negative checks", () => {
    it("output object has no synthesized kind/status/valid/linked field", () => {
      const result = pairE85DesignationLegalTextCorrespondenceAndCoincidence(
        correspondenceFixtures.IDENTITY_CORRESPONDENCE_ESTABLISHED,
        coincidenceFixtures.BOTH_CLOSED_APPLICABLE,
      ) as unknown as Record<string, unknown>;

      const topLevelKeys = Object.keys(result);
      expect(topLevelKeys.sort()).toEqual(["correspondence", "coincidence", "limitation"].sort());
      expect("kind" in result).toBe(false);
      expect("status" in result).toBe(false);
      expect("valid" in result).toBe(false);
      expect("linked" in result).toBe(false);
      expect("confirmed" in result).toBe(false);
    });

    it("no separate top-level asOf field is added beyond coincidence.asOf", () => {
      const result = pairE85DesignationLegalTextCorrespondenceAndCoincidence(
        correspondenceFixtures.DESIGNATION_NOT_APPLICABLE_PASSTHROUGH,
        coincidenceFixtures.NOT_COINCIDENT,
      ) as unknown as Record<string, unknown>;
      expect("asOf" in result).toBe(false);
    });

    it("source module has not modified any of the four upstream files (verified via git diff)", () => {
      const { execSync } = require("child_process");
      const diff = execSync(
        'git diff --name-only -- ' +
          'src/zoning-land-use-engine/designation-applicability.ts ' +
          'src/zoning-land-use-engine/legal-text-applicability.ts ' +
          'src/zoning-land-use-engine/designation-legal-text-identity-correspondence.ts ' +
          'src/zoning-land-use-engine/designation-legal-text-temporal-coincidence.ts',
        { cwd: process.cwd() },
      )
        .toString()
        .trim();
      expect(diff).toBe("");
    });

    it("the new module source contains no Date.now()/new Date( calls and no raw validity type imports", () => {
      const fs = require("fs");
      const path = require("path");
      const source = fs.readFileSync(
        path.join(process.cwd(), "src/zoning-land-use-engine/designation-legal-text-correspondence-and-coincidence.ts"),
        "utf8",
      );
      expect(source).not.toMatch(/Date\.now\(\)/);
      expect(source).not.toMatch(/[^.]new Date\(/);
      expect(source).not.toMatch(/^import.*E85DesignationValidity/m);
      expect(source).not.toMatch(/^import.*E85VersionValidity/m);
    });
  });
});

// Type-level check: ensure the exported result type is a flat shape (no kind
// discriminant of its own). This is a compile-time assertion — if it fails,
// tsc will error on this file.
const _typeCheck: E85DesignationLegalTextCorrespondenceAndCoincidenceResult = {
  correspondence: correspondenceFixtures.DESIGNATION_NOT_APPLICABLE_PASSTHROUGH,
  coincidence: coincidenceFixtures.NOT_COINCIDENT,
};
void _typeCheck;

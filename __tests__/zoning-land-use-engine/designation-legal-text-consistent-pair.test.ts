import {
  evaluateE85DesignationLegalTextConsistentPair,
  type E85DesignationLegalTextConsistentPairInput,
} from "../../src/zoning-land-use-engine/designation-legal-text-consistent-pair";
import { evaluateE85DesignationApplicability } from "../../src/zoning-land-use-engine/designation-applicability";
import { evaluateE85LegalTextApplicability } from "../../src/zoning-land-use-engine/legal-text-applicability";
import { evaluateE85DesignationLegalTextIdentityCorrespondence } from "../../src/zoning-land-use-engine/designation-legal-text-identity-correspondence";
import { evaluateE85DesignationLegalTextTemporalCoincidence } from "../../src/zoning-land-use-engine/designation-legal-text-temporal-coincidence";
import { pairE85DesignationLegalTextCorrespondenceAndCoincidence } from "../../src/zoning-land-use-engine/designation-legal-text-correspondence-and-coincidence";
import type { E85DesignationValidity } from "../../src/zoning-land-use-engine/designation-validity-types";
import type { E85VersionValidity } from "../../src/zoning-land-use-engine/version-validity-types";
import type { E85ResolvedTemporalRequest } from "../../src/zoning-land-use-engine/temporal-request-types";

const designationIdentity = { jurisdictionId: "jur-1", districtOrZoneId: "RS-1" };

const closedDesignationValidity: E85DesignationValidity = {
  state: "CLOSED",
  identity: designationIdentity,
  start: {
    kind: "MAP_AMENDMENT_OPERATIVE_DATE",
    effectiveFrom: "2020-01-01",
    instrumentLocator: { instrumentId: "instr-1" },
  },
  effectiveTo: "2030-01-01",
  end: {
    kind: "EXPRESS_REDESIGNATION",
    effectiveTo: "2030-01-01",
    instrumentLocator: { instrumentId: "instr-2" },
  },
};

const closedVersionValidity: E85VersionValidity = {
  state: "CLOSED",
  effectiveFrom: "2020-01-01",
  start: {
    eventKind: "COMMENCEMENT",
    effectiveFrom: "2020-01-01",
    authoritySourceId: "src-1",
    authoritySourceVersionId: "ver-1",
    commencementLocator: { bylawOrDocumentId: "bylaw-1" },
    effectiveDateBasis: "SOURCE_STATED",
  },
  effectiveTo: "2030-01-01",
  end: {
    eventKind: "EXPRESS_REPEAL",
    effectiveTo: "2030-01-01",
    authoritySourceId: "src-1",
    authoritySourceVersionId: "ver-1",
    repealLocator: { bylawOrDocumentId: "bylaw-2" },
    effectiveDateBasis: "SOURCE_STATED",
  },
};

const matchingLegalTextIdentity = {
  kind: "SELECTED" as const,
  identity: {
    jurisdictionId: "jur-1",
    sourceId: "src-1",
    sourceVersionId: "ver-1",
    zoneDesignation: "RS-1",
  },
};

const matchingLinkageIdentity = {
  jurisdictionId: "jur-1",
  sourceId: "src-1",
  sourceVersionId: "ver-1",
  zoneDesignation: "RS-1",
};

const mismatchedLinkageIdentity = {
  jurisdictionId: "jur-1",
  sourceId: "src-1",
  sourceVersionId: "ver-1",
  zoneDesignation: "RS-2", // ZONE_MISMATCH
};

function buildInput(
  overrides: Partial<E85DesignationLegalTextConsistentPairInput> = {},
): E85DesignationLegalTextConsistentPairInput {
  return {
    designationValidity: closedDesignationValidity,
    versionValidity: closedVersionValidity,
    legalTextIdentity: matchingLegalTextIdentity,
    linkageIdentity: matchingLinkageIdentity,
    resolvedRequest: { kind: "RESOLVED", request: { mode: "AS_OF", asOfDate: "2025-06-15" } },
    ...overrides,
  };
}

describe("evaluateE85DesignationLegalTextConsistentPair", () => {
  describe("AS_OF case", () => {
    it("computes all five sub-results and threads the exact asOfDate through unmodified", () => {
      const input = buildInput();
      const result = evaluateE85DesignationLegalTextConsistentPair(input);

      expect(result.designation).toBeDefined();
      expect(result.legalText).toBeDefined();
      expect(result.correspondence).toBeDefined();
      expect(result.coincidence).toBeDefined();
      expect(result.pair).toBeDefined();

      expect(result.coincidence!.asOf).toBe("2025-06-15");
    });

    it("each sub-result matches what calling each evaluator directly would produce", () => {
      const input = buildInput();
      const result = evaluateE85DesignationLegalTextConsistentPair(input);

      const expectedDesignation = evaluateE85DesignationApplicability(input.designationValidity, input.resolvedRequest);
      const expectedLegalText = evaluateE85LegalTextApplicability(input.versionValidity, input.resolvedRequest);
      const expectedCorrespondence = evaluateE85DesignationLegalTextIdentityCorrespondence(
        expectedDesignation,
        input.legalTextIdentity,
        input.linkageIdentity,
      );
      const expectedAsOfDate =
        input.resolvedRequest.kind === "RESOLVED" && input.resolvedRequest.request.mode === "AS_OF" ? input.resolvedRequest.request.asOfDate : "";
      const expectedCoincidence = evaluateE85DesignationLegalTextTemporalCoincidence(expectedDesignation, expectedLegalText, expectedAsOfDate);
      const expectedPair = pairE85DesignationLegalTextCorrespondenceAndCoincidence(expectedCorrespondence, expectedCoincidence);

      expect(result.designation).toEqual(expectedDesignation);
      expect(result.legalText).toEqual(expectedLegalText);
      expect(result.correspondence).toEqual(expectedCorrespondence);
      expect(result.coincidence).toEqual(expectedCoincidence);
      expect(result.pair).toEqual(expectedPair);
    });
  });

  describe("ABSENT case", () => {
    it("computes designation/legalText/correspondence but omits coincidence/pair", () => {
      const input = buildInput({ resolvedRequest: { kind: "ABSENT" } });
      const result = evaluateE85DesignationLegalTextConsistentPair(input);

      expect(result.designation).toBeDefined();
      expect(result.legalText).toBeDefined();
      expect(result.correspondence).toBeDefined();
      expect(result.coincidence).toBeUndefined();
      expect(result.pair).toBeUndefined();
      expect("coincidence" in result).toBe(false);
      expect("pair" in result).toBe(false);
    });

    it("designation/legalText report their NOT_EVALUABLE kinds", () => {
      const input = buildInput({ resolvedRequest: { kind: "ABSENT" } });
      const result = evaluateE85DesignationLegalTextConsistentPair(input);

      expect(result.designation.kind).toBe("DESIGNATION_APPLICABILITY_NOT_EVALUABLE");
      expect(result.legalText.kind).toBe("LEGAL_TEXT_APPLICABILITY_NOT_EVALUABLE");
    });
  });

  describe("CURRENT case", () => {
    it("computes designation/legalText/correspondence but omits coincidence/pair", () => {
      const input = buildInput({ resolvedRequest: { kind: "RESOLVED", request: { mode: "CURRENT" } } });
      const result = evaluateE85DesignationLegalTextConsistentPair(input);

      expect(result.designation).toBeDefined();
      expect(result.legalText).toBeDefined();
      expect(result.correspondence).toBeDefined();
      expect(result.coincidence).toBeUndefined();
      expect(result.pair).toBeUndefined();
      expect("coincidence" in result).toBe(false);
      expect("pair" in result).toBe(false);
    });
  });

  describe("correspondence mismatch + AS_OF present (Decision A proof)", () => {
    it("still computes coincidence and pair even when correspondence is a mismatch kind", () => {
      const input = buildInput({ linkageIdentity: mismatchedLinkageIdentity });
      const result = evaluateE85DesignationLegalTextConsistentPair(input);

      expect(result.correspondence.kind).toBe("ZONE_MISMATCH");
      expect(result.coincidence).toBeDefined();
      expect(result.pair).toBeDefined();
      expect(result.coincidence!.asOf).toBe("2025-06-15");
    });
  });

  describe("limitation content", () => {
    it("always contains the three universal elements (AS_OF case)", () => {
      const result = evaluateE85DesignationLegalTextConsistentPair(buildInput());
      const text = result.limitation;

      // own-consistency-only fact
      expect(text).toMatch(/own invocations/i);
      expect(text).toMatch(/shared,? already-validated input bundle/i);

      // cannot-verify-real-world-assembly
      expect(text).toMatch(/cannot and does not verify/i);
      expect(text).toMatch(/real-world records/i);

      // non-claims list
      expect(text).toMatch(/legal effect/i);
      expect(text).toMatch(/enactment/i);
      expect(text).toMatch(/property-specific applicability/i);
      expect(text).toMatch(/historical continuity/i);
      expect(text).toMatch(/rule-pack application/i);
      expect(text).toMatch(/final zoning or planning determination/i);
    });

    it("explains temporal omission was due to no AS_OF date, not an error (ABSENT case)", () => {
      const result = evaluateE85DesignationLegalTextConsistentPair(buildInput({ resolvedRequest: { kind: "ABSENT" } }));
      const text = result.limitation;

      expect(text).toMatch(/not.*computed/i);
      expect(text).toMatch(/no explicit AS_OF date/i);
      expect(text).toMatch(/not any\s*error or failure/i);
    });

    it("explains temporal omission was due to no AS_OF date, not an error (CURRENT case)", () => {
      const result = evaluateE85DesignationLegalTextConsistentPair(
        buildInput({ resolvedRequest: { kind: "RESOLVED", request: { mode: "CURRENT" } } }),
      );
      const text = result.limitation;

      expect(text).toMatch(/not.*computed/i);
      expect(text).toMatch(/no explicit AS_OF date/i);
      expect(text).toMatch(/not any\s*error or failure/i);
    });

    it("AS_OF-case limitation does NOT contain the omission addendum", () => {
      const result = evaluateE85DesignationLegalTextConsistentPair(buildInput());
      expect(result.limitation).not.toMatch(/not any error or failure/i);
    });
  });

  describe("hygiene checks", () => {
    it("source file's executable code contains no Date.now()/new Date( calls", () => {
      const fs = require("fs");
      const path = require("path");
      const source = fs.readFileSync(
        path.join(process.cwd(), "src/zoning-land-use-engine/designation-legal-text-consistent-pair.ts"),
        "utf8",
      );
      // Strip the block comment (module doc + JSDoc) so mentions of the forbidden
      // patterns in prose (explaining what is NOT done) don't produce false positives.
      const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(codeOnly).not.toMatch(/Date\.now\(\)/);
      expect(codeOnly).not.toMatch(/[^.]new Date\(/);
    });

    it("source file contains no cast expressions (as unknown as / as any)", () => {
      const fs = require("fs");
      const path = require("path");
      const source = fs.readFileSync(
        path.join(process.cwd(), "src/zoning-land-use-engine/designation-legal-text-consistent-pair.ts"),
        "utf8",
      );
      expect(source).not.toMatch(/as unknown as/);
      expect(source).not.toMatch(/as any/);
    });

    it("source file makes no calls to the raw validity/request builders (only mentions them in prose, never invokes them)", () => {
      const fs = require("fs");
      const path = require("path");
      const source = fs.readFileSync(
        path.join(process.cwd(), "src/zoning-land-use-engine/designation-legal-text-consistent-pair.ts"),
        "utf8",
      );
      expect(source).not.toMatch(/buildE85DesignationValidity\(/);
      expect(source).not.toMatch(/buildE85VersionValidity\(/);
      expect(source).not.toMatch(/resolveE85TemporalRequest\(/);
    });

    it("no export from src/index.ts references the new module", () => {
      const fs = require("fs");
      const path = require("path");
      const indexSource = fs.readFileSync(path.join(process.cwd(), "src/index.ts"), "utf8");
      expect(indexSource).not.toMatch(/designation-legal-text-consistent-pair/);
      expect(indexSource).not.toMatch(/ConsistentPair/);
    });

    it("no modification to any of the five existing evaluator/wrapper source files (verified via git diff)", () => {
      const { execSync } = require("child_process");
      const diff = execSync(
        "git diff --name-only -- " +
          "src/zoning-land-use-engine/designation-applicability.ts " +
          "src/zoning-land-use-engine/legal-text-applicability.ts " +
          "src/zoning-land-use-engine/designation-legal-text-identity-correspondence.ts " +
          "src/zoning-land-use-engine/designation-legal-text-temporal-coincidence.ts " +
          "src/zoning-land-use-engine/designation-legal-text-correspondence-and-coincidence.ts",
        { cwd: process.cwd() },
      )
        .toString()
        .trim();
      expect(diff).toBe("");
    });
  });

  describe("type-level: coincidence/pair are optional fields", () => {
    it("compiles a result literal without coincidence/pair present", () => {
      const result = evaluateE85DesignationLegalTextConsistentPair(buildInput({ resolvedRequest: { kind: "ABSENT" } }));
      // If coincidence/pair were required fields, this destructure/assignment would still work at
      // runtime, but the ABSENT-case test above already proves they are runtime-absent; this is a
      // straightforward behavioral re-assertion for clarity alongside the interface's `?` markers.
      expect(result.coincidence).toBeUndefined();
      expect(result.pair).toBeUndefined();
    });
  });
});

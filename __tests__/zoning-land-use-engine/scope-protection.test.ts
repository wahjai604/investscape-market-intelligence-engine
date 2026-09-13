/**
 * InvestScape™ E85 Phase 4 — scope protection tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Verifies no file under src/zoning-land-use-engine imports from a frozen
 * engine, and that evaluator output never contains architectural/financial
 * fields (net/sellable/rentable area, massing, revenue, IRR, etc.).
 */
import * as fs from "fs";
import * as path from "path";
import { evaluateZoningAndLandUse, E85EvaluationRequest, E85UseRule, E85DensityRule, E85DimensionalRule, E85PolicyVersion } from "../../src/zoning-land-use-engine";

const FORBIDDEN_IMPORTS = ["cre-intelligence", "cap-rate-engine", "construction-cost-engine", "calc-engine", "economic-engine", "tax-engine"];

describe("scope protection — no import from frozen engines", () => {
  const dir = path.resolve(__dirname, "../../src/zoning-land-use-engine");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".ts"));

  test.each(files)("%s does not import a forbidden frozen engine", (file) => {
    const content = fs.readFileSync(path.join(dir, file), "utf8");
    for (const forbidden of FORBIDDEN_IMPORTS) {
      expect(content).not.toMatch(new RegExp(`from\\s+["'][^"']*${forbidden}[^"']*["']`));
    }
  });
});

describe("scope protection — no architectural/financial fields in evaluator output", () => {
  test("evaluator output contains no massing/architectural/financial field names", () => {
    const useRule: E85UseRule = {
      family: "USE",
      jurisdictionId: "jx",
      zoneDesignation: "Z1",
      permissions: [{ value: { useCode: "u", status: "PERMITTED" }, provenance: { sourceId: "s" }, temporal: { effectiveDateBasis: "SOURCE_STATED" } }],
    };
    const densityRule: E85DensityRule = {
      family: "DENSITY",
      jurisdictionId: "jx",
      zoneDesignation: "Z1",
      maxFsr: { value: 1.0, provenance: { sourceId: "s" }, temporal: { effectiveDateBasis: "SOURCE_STATED" } },
    };
    const dimRule: E85DimensionalRule = {
      family: "DIMENSIONAL",
      jurisdictionId: "jx",
      zoneDesignation: "Z1",
      maxHeightMetres: { value: 11.5, provenance: { sourceId: "s" }, temporal: { effectiveDateBasis: "SOURCE_STATED" } },
    };
    const policy: E85PolicyVersion = { policyVersionId: "v1", effectiveFrom: "2020-01-01", concepts: {} };
    const outcome = evaluateZoningAndLandUse({
      parcel: { parcelReferenceId: "p1", siteAreaSqm: 300 },
      jurisdictionId: "jx",
      zoneDesignation: "Z1",
      useCode: "u",
      asOfDate: "2024-01-01",
      rules: [useRule, densityRule, dimRule],
      requestedAnalyses: ["USE", "DENSITY", "DIMENSIONAL"],
      policyVersion: policy,
    });
    const serialized = JSON.stringify(outcome);
    const forbiddenFieldNames = [
      "netSellableArea",
      "netRentableArea",
      "netBuildableArea",
      "floorplateEfficiency",
      "unitLayoutEfficiency",
      "massing",
      "revenue",
      "absorption",
      "residualLandValue",
      "capRate",
      "irr",
      "constructionCost",
    ];
    for (const name of forbiddenFieldNames) {
      expect(serialized.toLowerCase()).not.toContain(name.toLowerCase());
    }
  });
});

/**
 * InvestScape™ E85 Phase 4/5 — scope protection tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Verifies no file under src/zoning-land-use-engine imports from a frozen
 * engine, that evaluator output never contains architectural/financial fields
 * (net/sellable/rentable area, massing, revenue, IRR, etc.), and — added in
 * Phase 5 — that no production file performs runtime acquisition of any kind.
 *
 * PHASE 5 CHANGE: file discovery is now RECURSIVE. It was a flat
 * `readdirSync`, which silently stopped protecting the engine the moment
 * Phase 5 introduced `adapters/vancouver/`; a non-recursive scan would have
 * reported green while checking none of the new files.
 */
import * as fs from "fs";
import * as path from "path";
import { evaluateZoningAndLandUse, E85EvaluationRequest, E85UseRule, E85DensityRule, E85DimensionalRule, E85PolicyVersion } from "../../src/zoning-land-use-engine";

const FORBIDDEN_IMPORTS = ["cre-intelligence", "cap-rate-engine", "construction-cost-engine", "calc-engine", "economic-engine", "tax-engine"];

const ENGINE_DIR = path.resolve(__dirname, "../../src/zoning-land-use-engine");

/**
 * Strips comments so these checks test CODE, not documentation. Without this,
 * a file explaining "this adapter never calls Date.now()" would fail the very
 * rule it is documenting, and the honest fix would be to delete the
 * explanation — exactly the wrong incentive. `://` is preserved so URLs inside
 * string literals are not mistaken for line comments.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function codeOf(file: string): string {
  return stripComments(fs.readFileSync(path.join(ENGINE_DIR, file), "utf8"));
}

/** Every .ts file under the engine, at any depth, as a path relative to the engine root. */
function engineFiles(dir: string = ENGINE_DIR, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...engineFiles(path.join(dir, entry.name), rel));
    else if (entry.name.endsWith(".ts")) out.push(rel);
  }
  return out.sort();
}

const ALL_FILES = engineFiles();

describe("scope protection — no import from frozen engines", () => {
  test("recursive discovery actually reaches the Phase 5 adapter subdirectories", () => {
    expect(ALL_FILES).toContain("adapters/vancouver/r1-1-adapter.ts");
    expect(ALL_FILES.some((f) => f.includes("/"))).toBe(true);
  });

  test.each(ALL_FILES)("%s does not import a forbidden frozen engine", (file) => {
    const content = codeOf(file);
    for (const forbidden of FORBIDDEN_IMPORTS) {
      expect(content).not.toMatch(new RegExp(`from\\s+["'][^"']*${forbidden}[^"']*["']`));
    }
  });
});

describe("scope protection — Phase 5 performs no runtime acquisition", () => {
  /** Acquisition, extraction, OCR and GIS are all outside Phase 5; none of these may appear in production code. */
  const FORBIDDEN_RUNTIME = [
    { name: "fetch", pattern: /\bfetch\s*\(/ },
    { name: "XMLHttpRequest", pattern: /\bXMLHttpRequest\b/ },
    { name: "axios", pattern: /\baxios\b/ },
    { name: "node http/https", pattern: /from\s+["'](?:node:)?https?["']/ },
    { name: "filesystem", pattern: /from\s+["'](?:node:)?fs(?:\/promises)?["']|\bfs\.(?:read|write|open|access)/ },
    { name: "child_process", pattern: /from\s+["'](?:node:)?child_process["']/ },
    { name: "pdf parser", pattern: /\bpdf(?:js|parse|lib|reader)\b/i },
    { name: "OCR", pattern: /\b(?:tesseract|ocr)\b/i },
    { name: "browser automation", pattern: /\b(?:puppeteer|playwright|selenium)\b/i },
    { name: "GIS geometry library", pattern: /\b(?:turf|geojson|proj4|jsts)\b/i },
    { name: "dynamic execution", pattern: /\beval\s*\(|new\s+Function\s*\(/ },
  ];

  test.each(ALL_FILES)("%s contains no runtime acquisition, parsing, or dynamic execution", (file) => {
    const content = codeOf(file);
    for (const { name, pattern } of FORBIDDEN_RUNTIME) {
      expect({ file, api: name, found: pattern.test(content) }).toEqual({ file, api: name, found: false });
    }
  });

  test("no production file reads a clock — timestamps come from the caller or the extract", () => {
    for (const file of ALL_FILES) {
      // Phase 4's evaluators legitimately stamp `resolvedAt`/`checkedAt` at
      // evaluation time; Phase 5's adapter/registry layer must not, or a
      // bundle could not be reproducible.
      const isPhase5 = /^(adapters\/|source-registry|source-fact|source-adapter|normalization-|normalized-|adapter-registry|source-readiness-assessment)/.test(file);
      if (!isPhase5) continue;
      const content = codeOf(file);
      expect({ file, usesClock: /new Date\(\)|Date\.now\(\)/.test(content) }).toEqual({ file, usesClock: false });
    }
  });

  test("no production file references the local pilot-evidence folder", () => {
    for (const file of ALL_FILES) {
      const content = fs.readFileSync(path.join(ENGINE_DIR, file), "utf8");
      // Scanned WITH comments: a hard-coded local path must not appear even in a comment.
      expect(content).not.toMatch(/e85-pilot-evidence/i);
      expect(content).not.toMatch(/[A-Za-z]:\\/);
      expect(content).not.toMatch(/\.pdf\b/i);
    }
  });
});

describe("scope protection — jurisdiction code stays out of E85 core", () => {
  const coreFiles = ALL_FILES.filter((f) => !f.startsWith("adapters/"));

  test("no core file imports from the adapters directory", () => {
    for (const file of coreFiles) {
      if (file === "index.ts") continue; // the public barrel deliberately re-exports adapters under a namespace
      const content = codeOf(file);
      expect({ file, importsAdapter: /from\s+["'][^"']*adapters/.test(content) }).toEqual({ file, importsAdapter: false });
    }
  });

  test("the dependency runs one way: adapters may import core, never the reverse", () => {
    const adapterFiles = ALL_FILES.filter((f) => f.startsWith("adapters/"));
    expect(adapterFiles.length).toBeGreaterThan(0);
    for (const file of adapterFiles) {
      const content = codeOf(file);
      // An adapter reaching back into the evaluator would collapse the
      // adaptation/evaluation boundary Phase 5 exists to establish.
      expect({ file, importsEvaluator: /from\s+["'][^"']*\/evaluator["']/.test(content) }).toEqual({ file, importsEvaluator: false });
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

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

/**
 * Strips string literals too, for checks that look for an OPERATION rather than
 * a word.
 *
 * The same incentive argument as `stripComments`, one level further in. A gap's
 * `resolutionHint` telling a caller to "reproject one geometry upstream, then
 * resupply" is E85 refusing to transform coordinates and saying where the work
 * belongs — the disclaimer, not the offence. A blanket scan would fail that file
 * and push toward deleting the very sentence that makes the refusal actionable.
 *
 * Template interpolations are KEPT, so `${transformCoordinates(x)}` would still
 * be caught: an expression inside a template is code, whatever surrounds it.
 */
function executableCodeOf(file: string): string {
  return codeOf(file)
    .replace(/`(?:[^`\\]|\\.)*`/g, (literal) => (literal.match(/\$\{[^}]*\}/g) ?? []).join(" "))
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");
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
    { name: "GIS geometry library", pattern: /\b(?:turf|proj4|jsts)\b/i },
    // PHASE 7: the spatial layer is the obvious place for a geometry
    // dependency or a spatial database to appear. E85 implements the minimum
    // predicates itself and stays dependency-free.
    { name: "spatial database", pattern: /\b(?:postgis|st_intersects|st_contains|st_within|geopandas|gdal|ogr2ogr)\b/i },
    // PHASE 8: "geojson" and "shapefile" are the two banned words that are also
    // FORMAT NAMES, and a source-provenance type must be able to say which
    // format a snapshot arrived in — `E85SpatialSourceSystem` names both. The
    // ban is on DEPENDING on a parser for them, which always shows up as an
    // import or a require (the repo carries zero dependencies, separately
    // verified), so these two are matched in import position only. The bare-word
    // bans above are kept for names that can never be a mere format label.
    { name: "format parser dependency", pattern: /(?:from|require\s*\()\s*["'][^"']*\b(?:geojson|shapefile|shp|wkt|wkb)\b/i },
    { name: "geocoding", pattern: /\b(?:geocode|geocoder|nominatim)\b/i },
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
      // bundle could not be reproducible. Phase 6's composition layer inherits
      // the same rule — a composed pack that embedded the wall clock could not
      // be compared across runs, and order-independence tests would be
      // meaningless. Phase 7 inherits it in turn: a spatial applicability
      // result stamped with the wall clock could not be diffed between runs,
      // which is exactly how an order-dependence bug hides.
      const isClockFree =
        /^(adapters\/|source-registry|source-fact|source-adapter|normalization-|normalized-|adapter-registry|source-readiness-assessment)/.test(file) ||
        /^(composition-|precedence-|rule-concept-identity|rule-pack-composer)/.test(file) ||
        /^(spatial-|geometry-)/.test(file);
      if (!isClockFree) continue;
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

  /**
   * PHASE 6: the composition layer decides legal precedence, which makes it the
   * single most dangerous place for a municipality's hierarchy to take root —
   * one "in this city the agreement wins" special case and every other city
   * gets a confidently wrong answer. So the composer is held to the same
   * jurisdiction-neutrality standard as the Phase 4 evaluator.
   */
  const COMPOSITION_FILES = ["composition-types.ts", "composition-findings.ts", "precedence-types.ts", "precedence-resolution.ts", "rule-concept-identity.ts", "rule-pack-composer.ts"];

  test("the Phase 6 composition files all exist and are discovered", () => {
    for (const file of COMPOSITION_FILES) expect(ALL_FILES).toContain(file);
  });

  test.each(COMPOSITION_FILES)("%s contains no municipal vocabulary", (file) => {
    const content = codeOf(file);
    for (const term of [/vancouver/i, /\bR1-1\b/, /\bCD-1\b/, /\bHA-1\b/, /\bRM-5\b/, /Director of Planning/i, /Outright Approval/i, /Heritage By-?law/i]) {
      expect({ file, term: term.source, found: term.test(content) }).toEqual({ file, term: term.source, found: false });
    }
  });

  test.each(COMPOSITION_FILES)("%s does not import an adapter or the Phase 4 evaluator", (file) => {
    const content = codeOf(file);
    // Composition sits BETWEEN the adapters and the evaluator and must depend on
    // neither: reaching into an adapter would let one municipality's vocabulary
    // shape precedence, and reaching into the evaluator would collapse the
    // composition/evaluation boundary this phase establishes.
    expect({ file, importsAdapter: /from\s+["'][^"']*adapters/.test(content) }).toEqual({ file, importsAdapter: false });
    expect({ file, importsEvaluator: /from\s+["'][^"']*\/evaluator["']/.test(content) }).toEqual({ file, importsEvaluator: false });
  });

  test("no Phase 4 evaluator file imports the composition layer — composition is upstream, and Phase 4 stays unaware of it", () => {
    const phase4 = ["evaluator.ts", "use-evaluation.ts", "density-evaluation.ts", "dimensional-evaluation.ts", "parking-amenity-evaluation.ts", "overlay-evaluation.ts", "envelope-assembly.ts", "result-status.ts", "applicability.ts"];
    for (const file of phase4) {
      const content = codeOf(file);
      expect({ file, importsComposition: /from\s+["'][^"']*(composition|precedence|rule-pack-composer|rule-concept-identity)/.test(content) }).toEqual({ file, importsComposition: false });
    }
  });

  /**
   * PHASE 7: the spatial layer decides which instruments are in play, which
   * makes it the second most dangerous place for a hierarchy to take root —
   * "the site-specific polygon is drawn on top, so it must win" is an easy
   * inference to make from a map and a wrong one to make in law. So Phase 7 is
   * held to the same neutrality standard as the composer, and additionally
   * fenced off from the layer that does decide precedence.
   */
  const SPATIAL_FILES = [
    "spatial-types.ts",
    "geometry-primitives.ts",
    "geometry-validation.ts",
    "geometry-relations.ts",
    "spatial-dataset-types.ts",
    "spatial-dataset-registry.ts",
    "spatial-findings.ts",
    "spatial-applicability-types.ts",
    "spatial-applicability.ts",
  ];

  test("the Phase 7 spatial files all exist and are discovered", () => {
    for (const file of SPATIAL_FILES) expect(ALL_FILES).toContain(file);
  });

  test.each(SPATIAL_FILES)("%s contains no municipal vocabulary", (file) => {
    const content = codeOf(file);
    for (const term of [/vancouver/i, /\bR1-1\b/, /\bCD-1\b/, /\bHA-1\b/, /\bRM-5\b/, /Director of Planning/i, /Outright Approval/i, /Heritage By-?law/i]) {
      expect({ file, term: term.source, found: term.test(content) }).toEqual({ file, term: term.source, found: false });
    }
  });

  test.each(SPATIAL_FILES)("%s does not import the composition layer — geometry names candidates, it never ranks them", (file) => {
    const content = codeOf(file);
    // Phase 7 sits UPSTREAM of Phase 6. Reaching into precedence from the
    // spatial layer would put "which instrument wins" within reach of whatever
    // found the instruments, which is the one coupling this architecture exists
    // to prevent.
    expect({ file, importsComposition: /from\s+["'][^"']*(composition-|precedence-|rule-pack-composer|rule-concept-identity)/.test(content) }).toEqual({ file, importsComposition: false });
  });

  test.each(SPATIAL_FILES)("%s does not import an adapter or the Phase 4 evaluator", (file) => {
    const content = codeOf(file);
    expect({ file, importsAdapter: /from\s+["'][^"']*adapters/.test(content) }).toEqual({ file, importsAdapter: false });
    expect({ file, importsEvaluator: /from\s+["'][^"']*\/evaluator["']/.test(content) }).toEqual({ file, importsEvaluator: false });
  });

  test.each(SPATIAL_FILES)("%s computes no regulatory rule value — Phase 7 carries identities only", (file) => {
    const content = codeOf(file);
    // Naming a rule field in code (rather than in prose) would mean the spatial
    // layer had started holding regulatory content, which is Phase 4's job
    // acting on Phase 6's output.
    for (const field of ["maxFsr", "maxHeightMetres", "maxStoreys", "setbacksMetres", "minSpacesPerUse", "maxRegulatoryGfaSqm", "maxSiteCoverageFraction", "conditionalBonus"]) {
      expect({ file, field, found: content.includes(field) }).toEqual({ file, field, found: false });
    }
  });

  test("no Phase 6 composition file imports the spatial layer — the dependency runs one way", () => {
    for (const file of COMPOSITION_FILES) {
      const content = codeOf(file);
      expect({ file, importsSpatial: /from\s+["'][^"']*(spatial-|geometry-)/.test(content) }).toEqual({ file, importsSpatial: false });
    }
  });

  test("no Phase 4 evaluator file imports the spatial layer", () => {
    const phase4 = ["evaluator.ts", "use-evaluation.ts", "density-evaluation.ts", "dimensional-evaluation.ts", "parking-amenity-evaluation.ts", "overlay-evaluation.ts", "envelope-assembly.ts", "result-status.ts", "applicability.ts"];
    for (const file of phase4) {
      const content = codeOf(file);
      expect({ file, importsSpatial: /from\s+["'][^"']*(spatial-|geometry-)/.test(content) }).toEqual({ file, importsSpatial: false });
    }
  });

  test("every public geometry predicate validates before it measures", () => {
    // The structural half of the Phase 7A topology gate. Phase 7's arithmetic is
    // defined for a narrow polygon profile; a shape outside it that reaches a
    // predicate comes back with a confident CONTAINS or DISJOINT that nobody can
    // justify, and an unjustifiable answer is worse than a refusal because only
    // the refusal is visible. A behavioural proof lives in spatial-topology.test.ts;
    // this catches a NEW exported predicate added later without the guard.
    const content = codeOf("geometry-relations.ts");
    const exported = content.match(/export function (e85[A-Za-z]+)\(/g) ?? [];
    const measuring = exported.map((m) => m.replace(/^export function /, "").replace(/\($/, "")).filter((name) => /Relation$|LocatePoint/.test(name));
    expect(measuring.sort()).toEqual(["e85GeometryRelation", "e85LocatePointInPolygon", "e85PolygonRelation"]);
    for (const name of measuring) {
      // Each public entry point's body must consult the profile gate before it
      // reaches the unchecked arithmetic.
      const body = content.slice(content.indexOf(`export function ${name}(`));
      const guardIndex = body.indexOf("isSupported");
      const workIndex = Math.min(...["locateUnchecked", "polygonRelationUnchecked"].map((call) => (body.indexOf(call) === -1 ? Number.MAX_SAFE_INTEGER : body.indexOf(call))));
      expect({ name, guarded: guardIndex !== -1 && guardIndex < workIndex }).toEqual({ name, guarded: true });
    }
  });

  test("no spatial file anywhere exports an unguarded way to obtain a relation", () => {
    // The test above proves the gate for the three predicates in
    // geometry-relations.ts, matching them BY NAME. This one closes the two
    // gaps that leaves: a relation-returning predicate added to a DIFFERENT
    // spatial file, or one in the same file named without "Relation" or
    // "LocatePoint". It matches by RETURN TYPE instead, so the only way to
    // introduce a new path to a CONTAINS/INTERSECTS/BOUNDARY_TOUCH/DISJOINT is
    // to fail this test and be forced to justify it.
    const guarded = ["e85GeometryRelation", "e85LocatePointInPolygon", "e85PolygonRelation"];
    const classifiers: string[] = [];
    for (const file of SPATIAL_FILES) {
      const content = codeOf(file);
      for (const match of content.matchAll(/export function (e85[A-Za-z0-9]+)\([^)]*\)\s*:\s*(E85SpatialRelation|E85PointLocation)\b/g)) {
        classifiers.push(match[1]);
      }
    }
    expect(classifiers.sort()).toEqual(guarded);
  });

  test("the profile gate has exactly one definition, so the gate and the arithmetic cannot disagree", () => {
    // Relations must consult the same validator the applicability layer does,
    // rather than carrying a private idea of what is supported.
    const relations = codeOf("geometry-relations.ts");
    expect(/from\s+["']\.\/geometry-validation["']/.test(relations)).toBe(true);
    expect(/validateE85GeometryShape/.test(relations)).toBe(true);
    // And the validator must not import the relations it guards, or the gate
    // would depend on the thing it is gating.
    expect(/from\s+["']\.\/geometry-relations["']/.test(codeOf("geometry-validation.ts"))).toBe(false);
  });

  test("the spatial layer performs no coordinate transformation", () => {
    // A reprojection hidden in a predicate would silently move a boundary, and
    // is the one operation Phase 7's exact-CRS contract exists to forbid.
    // Checked against executable code: telling a CALLER to reproject upstream is
    // how E85 states the refusal, and must not be mistaken for performing one.
    for (const file of SPATIAL_FILES) {
      const content = executableCodeOf(file);
      for (const term of [/\bproj4\b/i, /\breproject\b/i, /toWgs84/i, /transformCoordinates/i, /\bgeodesic\b/i]) {
        expect({ file, term: term.source, found: term.test(content) }).toEqual({ file, term: term.source, found: false });
      }
    }
  });

  /**
   * PHASE 8: the spatial SOURCE layer. It sits at the boundary with the outside
   * world, which makes it the one place where acquisition code, a GIS
   * dependency or a quiet geometry "fix" would most plausibly appear — and a
   * cleaned boundary is the most dangerous of the three, because it produces a
   * confident answer about a shape nobody published.
   */
  const SPATIAL_SOURCE_FILES = ["spatial-source-snapshot-types.ts", "spatial-source-findings.ts", "spatial-source-adapter-contract.ts", "spatial-source-adapter-registry.ts"];
  const SPATIAL_ADAPTER_FILES = ["adapters/spatial/index.ts", "adapters/spatial/reference/index.ts", "adapters/spatial/reference/reference-zoning-source.ts", "adapters/spatial/reference/reference-zoning-adapter.ts"];

  test("the Phase 8 spatial source files all exist and are discovered", () => {
    for (const file of [...SPATIAL_SOURCE_FILES, ...SPATIAL_ADAPTER_FILES]) expect(ALL_FILES).toContain(file);
  });

  test.each([...SPATIAL_SOURCE_FILES, ...SPATIAL_ADAPTER_FILES])("%s performs no acquisition", (file) => {
    // Phase 8 normalizes a snapshot the caller already holds. How those bytes
    // were obtained is outside E85 entirely, and the moment this layer fetches,
    // "reproducible offline normalization" stops being true.
    const content = executableCodeOf(file);
    for (const term of [/\bfetch\b/, /\baxios\b/i, /XMLHttpRequest/, /child_process/, /\brequire\s*\(/, /\bimport\s*\(/, /\bfs\b/, /readFile/i, /writeFile/i, /https?:\/\//]) {
      expect({ file, term: term.source, found: term.test(content) }).toEqual({ file, term: term.source, found: false });
    }
  });

  test.each([...SPATIAL_SOURCE_FILES, ...SPATIAL_ADAPTER_FILES])("%s uses no GIS library and no coordinate transform", (file) => {
    const content = executableCodeOf(file);
    for (const term of [/\bturf\b/i, /\bjsts\b/i, /\bproj4\b/i, /postgis/i, /st_intersects/i, /ogr2ogr/i, /\bgdal\b/i, /geocod/i, /\breproject\b/i, /toWgs84/i, /transformCoordinates/i]) {
      expect({ file, term: term.source, found: term.test(content) }).toEqual({ file, term: term.source, found: false });
    }
  });

  test.each([...SPATIAL_SOURCE_FILES, ...SPATIAL_ADAPTER_FILES])("%s performs no geometry repair", (file) => {
    // The Phase 8 invariant that matters most. An adapter that snapped, closed,
    // simplified or buffered a boundary so it passed Phase 7's gate would be
    // substituting a shape nobody enacted, at the exact moment nobody is
    // watching.
    const content = executableCodeOf(file);
    for (const term of [/\bsnapTo/i, /\bsimplify\s*\(/i, /\bbuffer\s*\(/i, /\bdissolve\b/i, /\bunion\s*\(/i, /makeValid/i, /repairGeometry/i, /\bconvexHull\b/i, /boundingBox\s*\(/i]) {
      expect({ file, term: term.source, found: term.test(content) }).toEqual({ file, term: term.source, found: false });
    }
  });

  test.each([...SPATIAL_SOURCE_FILES, ...SPATIAL_ADAPTER_FILES])("%s reads no clock", (file) => {
    const content = codeOf(file);
    expect({ file, usesClock: /new Date\(\)|Date\.now\(\)/.test(content) }).toEqual({ file, usesClock: false });
  });

  test.each(SPATIAL_SOURCE_FILES)("%s contains no source-specific field names — generic core stays generic", (file) => {
    // The property the adapter architecture exists to deliver: adding a
    // publisher means adding a directory, not editing core. The moment core
    // names one publisher's attribute, every other publisher is a special case.
    const content = codeOf(file);
    for (const term of [/vancouver/i, /\bOBJECTID\b/, /\bGlobalID\b/, /ZONING_CD/, /ZONE_NAME/, /ZONE_CD/, /LYR_KIND/, /FEATURE_REF/]) {
      expect({ file, term: term.source, found: term.test(content) }).toEqual({ file, term: term.source, found: false });
    }
  });

  test.each([...SPATIAL_SOURCE_FILES, ...SPATIAL_ADAPTER_FILES])("%s evaluates no regulatory rule", (file) => {
    const content = codeOf(file);
    for (const field of ["maxFsr", "maxHeightMetres", "maxStoreys", "setbacksMetres", "minSpacesPerUse", "maxRegulatoryGfaSqm", "maxSiteCoverageFraction"]) {
      expect({ file, field, found: content.includes(field) }).toEqual({ file, field, found: false });
    }
  });

  test.each([...SPATIAL_SOURCE_FILES, ...SPATIAL_ADAPTER_FILES])("%s decides no legal precedence", (file) => {
    const content = codeOf(file);
    for (const term of [/\bpriority\b/i, /\bprecedence\b/i, /winsOver/i, /\bsupersedes\b/i, /\boverrides\b/i, /precedenceWeight/i]) {
      expect({ file, term: term.source, found: term.test(content) }).toEqual({ file, term: term.source, found: false });
    }
  });

  test("no Phase 7 file imports Phase 8 — the dependency runs one way", () => {
    // Phase 8 may import Phase 7's validation and types; the reverse would put
    // one publisher's schema within reach of the generic applicability layer.
    for (const file of SPATIAL_FILES) {
      const content = codeOf(file);
      expect({ file, importsPhase8: /from\s+["'][^"']*(spatial-source-|adapters)/.test(content) }).toEqual({ file, importsPhase8: false });
    }
  });

  test("no Phase 6 or Phase 4 file imports Phase 8 either", () => {
    for (const file of [...COMPOSITION_FILES, "evaluator.ts", "envelope-assembly.ts", "applicability.ts"]) {
      const content = codeOf(file);
      expect({ file, importsPhase8: /from\s+["'][^"']*spatial-source-/.test(content) }).toEqual({ file, importsPhase8: false });
    }
  });

  test("Phase 8 reuses Phase 7's geometry gate rather than carrying topology rules of its own", () => {
    const adapter = codeOf("adapters/spatial/reference/reference-zoning-adapter.ts");
    expect(/validateE85Geometry/.test(adapter)).toBe(true);
    // No private notion of validity: the words topology validation owns appear
    // in exactly one place in the engine, and it is not here.
    for (const term of [/selfIntersect/i, /ringSimplicity/i, /e85SegmentsIntersect/, /e85RingWindsAround/]) {
      expect({ term: term.source, found: term.test(adapter) }).toEqual({ term: term.source, found: false });
    }
  });

  test("the spatial layer declares exactly one tolerance constant, rather than scattering epsilons", () => {
    // A hidden 1e-9 in three predicates is three different boundary policies
    // nobody agreed to. Literal epsilons are allowed only where the single
    // exported default is defined.
    for (const file of SPATIAL_FILES) {
      const content = codeOf(file);
      const literals = content.match(/\b\d+(?:\.\d+)?e-\d+\b/g) ?? [];
      const allowed = file === "spatial-types.ts" ? 1 : 0;
      expect({ file, epsilonLiterals: literals.length }).toEqual({ file, epsilonLiterals: allowed });
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

describe("E85 scope protection — Phase 9 orchestrates, and does nothing else", () => {
  /**
   * Phase 9 sits above every other layer, which makes it the easiest place in
   * the engine to accidentally rebuild one of them. It has the applicable
   * packs in hand, so ranking them is one line away; it has the effective
   * rules, so reading an FSR off them is one more; it has a parcel and a layer,
   * so "just nudge this geometry" becomes reachable for the first time since
   * Phase 8. These tests exist because orchestration code is where those
   * shortcuts would look most reasonable.
   */
  const DECISION_FILES = [
    "decision-package-types.ts",
    "decision-rule-pack-resolution.ts",
    "decision-materiality.ts",
    "decision-status.ts",
    "decision-trace.ts",
    "decision-orchestrator.ts",
  ];

  test("the Phase 9 decision files all exist and are discovered", () => {
    for (const file of DECISION_FILES) expect(ALL_FILES).toContain(file);
  });

  test.each(DECISION_FILES)("%s performs no acquisition", (file) => {
    // Phase 9 orchestrates evidence already in memory. Phase 8's RESULT is its
    // input; the moment this layer fetches or reads a file, the whole pipeline
    // stops being reproducible offline.
    const content = executableCodeOf(file);
    for (const term of [/\bfetch\b/, /\baxios\b/i, /XMLHttpRequest/, /child_process/, /\brequire\s*\(/, /\bimport\s*\(/, /readFile/i, /writeFile/i, /https?:\/\//, /arcgis/i, /\bwfs\b/i, /\bwms\b/i]) {
      expect({ file, term: term.source, found: term.test(content) }).toEqual({ file, term: term.source, found: false });
    }
  });

  test.each(DECISION_FILES)("%s touches no geometry and no coordinate system", (file) => {
    // Phase 9 READS Phase 7's conclusions about geometry. It never computes,
    // repairs or reprojects any itself — the temptation being to "resolve" an
    // UNDETERMINED relation by measuring something directly.
    const content = executableCodeOf(file);
    for (const term of [/\bturf\b/i, /\bjsts\b/i, /\bproj4\b/i, /postgis/i, /\bgdal\b/i, /geocod/i, /\breproject\b/i, /toWgs84/i, /transformCoordinates/i, /\bsimplify\s*\(/i, /\bbuffer\s*\(/i, /makeValid/i, /repairGeometry/i, /\bconvexHull\b/i, /\bcentroid\b/i, /boundingBox\s*\(/i]) {
      expect({ file, term: term.source, found: term.test(content) }).toEqual({ file, term: term.source, found: false });
    }
  });

  test.each(DECISION_FILES)("%s evaluates no regulatory rule", (file) => {
    // Phase 4 owns evaluation. Phase 9 may LABEL a Phase 4 result complete or
    // partial; it may never produce one of its own.
    const content = codeOf(file);
    for (const field of ["maxFsr", "maxHeightMetres", "maxStoreys", "setbacksMetres", "minSpacesPerUse", "maxRegulatoryGfaSqm", "maxSiteCoverageFraction", "explicitMaxGfaSqm"]) {
      expect({ file, field, found: content.includes(field) }).toEqual({ file, field, found: false });
    }
  });

  test.each(DECISION_FILES)("%s decides no legal precedence", (file) => {
    // Phase 9 may READ Phase 6's precedence output and pass a caller's
    // relations through untouched — that is why `precedenceRelations` and
    // `precedenceProblems` are permitted here. What must never appear is
    // vocabulary for MAKING the decision: nothing in orchestration may conclude
    // that one instrument beats another.
    const content = codeOf(file);
    for (const term of [/winsOver/i, /\bsupersedes\b/i, /precedenceWeight/i, /mostRestrictive/i, /\bbeatsPack\b/i, /rankPacks/i, /\bstrongerThan\b/i, /\bpreferPack\b/i]) {
      expect({ file, term: term.source, found: term.test(content) }).toEqual({ file, term: term.source, found: false });
    }
  });

  test.each(DECISION_FILES)("%s reads no clock", (file) => {
    const content = codeOf(file);
    expect({ file, usesClock: /new Date\(\)|Date\.now\(\)/.test(content) }).toEqual({ file, usesClock: false });
  });

  test.each(DECISION_FILES)("%s names no municipality and no publisher's schema", (file) => {
    // Orchestration is generic or it is a special case pretending to be a layer.
    const content = codeOf(file);
    for (const term of [/vancouver/i, /\bR1-1\b/, /\bCD-1\b/, /Director of Planning/i, /\bOBJECTID\b/, /ZONING_CD/, /ZONE_CD/, /LYR_KIND/, /FEATURE_REF/, /refburgh/i]) {
      expect({ file, term: term.source, found: term.test(content) }).toEqual({ file, term: term.source, found: false });
    }
  });

  test("no earlier phase imports Phase 9 — the dependency runs one way", () => {
    // Phase 9 may call Phases 8, 7, 6 and 4. The reverse would let an
    // orchestration concern leak into a layer whose whole value is that it
    // answers one question and refuses the rest.
    const earlier = ALL_FILES.filter((f) => !f.startsWith("decision-") && f !== "index.ts");
    for (const file of earlier) {
      const content = codeOf(file);
      expect({ file, importsPhase9: /from\s+["'][^"']*\/?decision-/.test(content) }).toEqual({ file, importsPhase9: false });
    }
  });

  test("Phase 9 reaches the phases it orchestrates, and only through their public entry points", () => {
    const orchestrator = codeOf("decision-orchestrator.ts");
    for (const entry of ["resolveE85SpatialApplicability", "composeE85RulePacks", "evaluateZoningAndLandUse"]) {
      expect({ entry, found: orchestrator.includes(entry) }).toEqual({ entry, found: true });
    }
    // It does not reach past them into a phase's internals.
    for (const internal of ["density-evaluation", "dimensional-evaluation", "use-evaluation", "precedence-resolution", "conflict-detection", "geometry-relations", "geometry-primitives"]) {
      expect({ internal, imported: new RegExp(`from\\s+["'][^"']*${internal}`).test(orchestrator) }).toEqual({ internal, imported: false });
    }
  });

  test("Phase 9 adds no external dependency", () => {
    for (const file of DECISION_FILES) {
      const imports = [...codeOf(file).matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
      for (const specifier of imports) {
        expect({ file, specifier, relative: specifier.startsWith(".") }).toEqual({ file, specifier, relative: true });
      }
    }
  });
});

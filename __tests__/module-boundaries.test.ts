/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Enforces the architecture review's module split as an automated check,
 * not just a doc-comment promise: src/statistical-risk/ must have ZERO
 * dependency on @investscape/economic-engine, @investscape/calc-engine, or
 * src/market-intelligence/. This scans the actual source text rather than
 * trusting import discipline to hold over time.
 */

import * as fs from "fs";
import * as path from "path";

const STATISTICAL_RISK_DIR = path.join(__dirname, "..", "src", "statistical-risk");

const FORBIDDEN_PATTERNS = [
  /from\s+["']@investscape\/economic-engine["']/,
  /from\s+["']@investscape\/calc-engine["']/,
  /from\s+["'].*market-intelligence/,
  /require\(\s*["']@investscape\/economic-engine["']\s*\)/,
  /require\(\s*["']@investscape\/calc-engine["']\s*\)/,
];

function listTsFiles(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => path.join(dir, f));
}

describe("module boundaries: src/statistical-risk/ is pure math", () => {
  const files = listTsFiles(STATISTICAL_RISK_DIR);

  it("found the expected source files (sanity check that this test isn't vacuously passing)", () => {
    expect(files.length).toBeGreaterThanOrEqual(7);
  });

  it.each(files)("%s has no import from economic-engine, calc-engine, or market-intelligence", (file) => {
    const contents = fs.readFileSync(file, "utf-8");
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(contents).not.toMatch(pattern);
    }
  });
});

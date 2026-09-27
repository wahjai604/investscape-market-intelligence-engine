/**
 * The evidence-dependent integration gate. Runs ONLY the suites that read the
 * workspace evidence folder, with E85_EVIDENCE_GATE=1 so a missing or altered
 * export fails the run rather than skipping it.
 */
const base = require("./jest.config");
const EVIDENCE_SUITES = require("./jest.evidence-suites");

process.env.E85_EVIDENCE_GATE = "1";

/** @type {import('jest').Config} */
module.exports = {
  preset: base.preset,
  testEnvironment: base.testEnvironment,
  roots: base.roots,
  testRegex: EVIDENCE_SUITES,
  testPathIgnorePatterns: ["/node_modules/"],
  passWithNoTests: false,
};

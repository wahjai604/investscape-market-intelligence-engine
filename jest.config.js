const EVIDENCE_SUITES = require("./jest.evidence-suites");

/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/__tests__"],
  testMatch: ["**/*.test.ts"],
  testPathIgnorePatterns: ["/node_modules/", ...EVIDENCE_SUITES],
};

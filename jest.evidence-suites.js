/**
 * Suites that read the workspace evidence folder (e85-pilot-evidence). They are
 * excluded from the hermetic `npm test` and run only under jest.evidence.config.js
 * (`npm run test:evidence`), where a missing or altered file fails instead of skipping.
 */
module.exports = [
  "/__tests__/zoning-land-use-engine/vancouver-full-snapshot-quarantine\\.test\\.ts$",
  "/__tests__/zoning-land-use-engine/vancouver-full-snapshot-public-path\\.test\\.ts$",
  "/__tests__/zoning-land-use-engine/vancouver-legal-pack-source-bytes\\.test\\.ts$",
  "/__tests__/zoning-land-use-engine/vancouver-legal-pack-server-assembly-evidence\\.test\\.ts$",
];

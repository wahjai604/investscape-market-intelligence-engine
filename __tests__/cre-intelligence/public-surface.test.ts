/**
 * InvestScape™ E86 — public root-surface boundary tests.
 *
 * Verifies the `getCapRateBenchmark` enablement addition: it must delegate
 * exactly to `selectCapRateBenchmark` over the correct country pool, must not
 * change existing selection behavior, and the package root must expose
 * exactly the five approved runtime keys — never the raw observation arrays.
 */
import * as creIntelligence from "../../src/cre-intelligence/public";
import { selectCapRateBenchmark } from "../../src/cre-intelligence/benchmark-selection";
import { getCapRateBenchmark } from "../../src/cre-intelligence/benchmark-lookup";
import { US_CAP_RATE_OBSERVATIONS } from "../../src/cre-intelligence/data/cap-rates-us";
import { CA_CAP_RATE_OBSERVATIONS } from "../../src/cre-intelligence/data/cap-rates-ca";
import type { BenchmarkIdentity } from "../../src/cre-intelligence/benchmark-types";

const AS_OF = new Date("2026-09-11");

describe("getCapRateBenchmark — country dispatch", () => {
  test("known US identity matches a manual selectCapRateBenchmark call over US_CAP_RATE_OBSERVATIONS", () => {
    const sample = US_CAP_RATE_OBSERVATIONS[0];
    const identity: BenchmarkIdentity = {
      metric: "cap_rate",
      country: "US",
      city: sample.geography.city!,
      assetClass: sample.assetClass,
    };
    const viaWrapper = getCapRateBenchmark(identity, AS_OF);
    const viaManual = selectCapRateBenchmark(identity, US_CAP_RATE_OBSERVATIONS, AS_OF);
    expect(viaWrapper).toEqual(viaManual);
  });

  test("known Canadian identity matches a manual selectCapRateBenchmark call over CA_CAP_RATE_OBSERVATIONS", () => {
    const sample = CA_CAP_RATE_OBSERVATIONS[0];
    const identity: BenchmarkIdentity = {
      metric: "cap_rate",
      country: "CA",
      city: sample.geography.city!,
      assetClass: sample.assetClass,
    };
    const viaWrapper = getCapRateBenchmark(identity, AS_OF);
    const viaManual = selectCapRateBenchmark(identity, CA_CAP_RATE_OBSERVATIONS, AS_OF);
    expect(viaWrapper).toEqual(viaManual);
  });

  test("no-match identity returns the existing deterministic DATA_GAP shape", () => {
    const identity: BenchmarkIdentity = {
      metric: "cap_rate",
      country: "US",
      city: "Nowhereville",
      assetClass: "data_center",
    };
    const result = getCapRateBenchmark(identity, AS_OF);
    expect(result.status).toBe("DATA_GAP");
    expect(result.dataGap).toBeDefined();
    expect(result.dataGap?.lastResearchDate).toBe(AS_OF.toISOString().slice(0, 10));
  });

  test("asOf is forwarded unchanged: omitting it reproduces selectCapRateBenchmark's own no-asOf behavior", () => {
    const identity: BenchmarkIdentity = {
      metric: "cap_rate",
      country: "US",
      city: "Nowhereville",
      assetClass: "data_center",
    };
    const viaWrapper = getCapRateBenchmark(identity);
    const viaManual = selectCapRateBenchmark(identity, US_CAP_RATE_OBSERVATIONS);
    expect(viaWrapper).toEqual(viaManual);
    expect(viaWrapper.dataGap?.lastResearchDate).toBe("unknown");
  });
});

describe("creIntelligence public root — exact runtime key set", () => {
  test("exposes exactly the five approved functions", () => {
    const keys = Object.keys(creIntelligence).sort();
    expect(keys).toEqual(
      ["capRateConsensus", "getCapRateBenchmark", "selectCapRateBenchmark", "selectHardCostBenchmark", "weightedConsensus"].sort(),
    );
  });

  test("does not expose either raw observation array or any registry/ingestion key", () => {
    const keys = Object.keys(creIntelligence);
    expect(keys).not.toContain("US_CAP_RATE_OBSERVATIONS");
    expect(keys).not.toContain("CA_CAP_RATE_OBSERVATIONS");
    expect(keys).not.toContain("US_CAP_RATE_GAPS");
    expect(keys).not.toContain("CA_CAP_RATE_GAPS");
  });
});

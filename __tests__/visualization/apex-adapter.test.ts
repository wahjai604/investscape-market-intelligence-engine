/**
 * InvestScape™ Test Suite
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 */

import { pearsonCorrelation } from "../../src/statistical-risk/correlation";
import {
  trendToLineChart,
  distributionToBoxPlot,
  relationshipToScatter,
  benchmarkToBar,
  buildChartMetadata,
} from "../../src/visualization/apex-adapter";
import { TrendPoint } from "../../src/market-intelligence/trends";
import { BenchmarkComparison } from "../../src/market-intelligence/benchmarking";
import { assessDataQuality } from "../../src/market-intelligence/data-quality";

const METADATA = buildChartMetadata("CREA / Statistics Canada", "as of 2026-08-04", assessDataQuality({ completeness: 1, freshness: 1 }));

describe("buildChartMetadata", () => {
  it("carries source/effective-date text + data-quality status on every view model, per spec", () => {
    expect(METADATA.sourceText).toBe("CREA / Statistics Canada");
    expect(METADATA.dataQualityStatus).toBe("High");
  });
});

describe("trendToLineChart", () => {
  it("reshapes TrendPoints into a line chart without recomputing their values", () => {
    const points: TrendPoint[] = [
      { periodStart: "2026-01-01", periodEnd: "2026-01-31", result: { value: 0.05, sampleSize: 2, issues: [], methodology: "x" }, derivedFrom: [] },
      { periodStart: "2026-02-01", periodEnd: "2026-02-28", result: { value: null, sampleSize: 2, issues: [], methodology: "x" }, derivedFrom: [] },
    ];
    const chart = trendToLineChart(points, "Median Rent MoM", METADATA);
    expect(chart.type).toBe("line");
    expect(chart.series[0].data).toEqual([0.05, null]); // null passes through untouched, not recomputed
    expect(chart.categories).toEqual(["2026-01-31", "2026-02-28"]);
  });
});

describe("distributionToBoxPlot", () => {
  it("calls the same quartile function core stats use, not a competing implementation", () => {
    const result = distributionToBoxPlot([{ name: "Toronto", values: [1, 2, 3, 4, 5, 6, 7, 8] }], METADATA);
    expect(result.value?.series[0].data[0]).toEqual([1, 2.75, 4.5, 6.25, 8]); // min, Q1, Q2, Q3, max via R-7
  });
});

describe("relationshipToScatter", () => {
  it("never claims causation in the correlation caption", () => {
    const correlation = pearsonCorrelation([1, 2, 3], [2, 4, 6]);
    const chart = relationshipToScatter(
      [
        [1, 2],
        [2, 4],
        [3, 6],
      ],
      "rent vs. income",
      METADATA,
      correlation,
    );
    expect(chart.correlationNote).toContain("does not imply causation");
    expect(chart.correlationNote).toContain("1.000");
  });
});

describe("benchmarkToBar", () => {
  it("uses BenchmarkComparison's already-computed median/range, does not recompute them", () => {
    const benchmark: BenchmarkComparison = {
      subjectValue: 2000,
      usableSampleSize: 3,
      marketMedian: { value: 1900, sampleSize: 3, issues: [], methodology: "x" },
      peerPercentileRank: { value: 0.6, sampleSize: 3, issues: [], methodology: "x" },
      historicalRange: {
        min: { value: 1800, sampleSize: 3, issues: [], methodology: "x" },
        max: { value: 2200, sampleSize: 3, issues: [], methodology: "x" },
      },
      zScoreVsBenchmark: { value: 0.4, sampleSize: 3, issues: [], methodology: "x" },
      excludedIssues: [],
      derivedFrom: [],
    };

    const chart = benchmarkToBar(benchmark, "Subject", "Peer neighborhoods", METADATA);
    expect(chart.subjectValue).toBe(2000);
    expect(chart.benchmarkMedian).toBe(1900);
    expect(chart.benchmarkRange).toEqual([1800, 2200]);
  });
});

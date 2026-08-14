/**
 * InvestScape™ Market Intelligence & Statistical Risk Engine
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * InvestScape™ is a registered trademark of Lighthouse Research Ltd.
 * This software is proprietary and confidential.
 *
 * LICENSING:
 * - Personal/Educational Use: Permitted (see LICENSE)
 * - Commercial Use: Requires written Commercial License Agreement
 * Contact: wahjai604@gmail.com
 *
 * DISCLAIMER:
 * This software is provided "as-is" for informational purposes only.
 * Not investment advice, tax advice, or financial advice.
 * Use at your own risk.
 */

/**
 * Example adapters converting Market Intelligence / Statistical Risk domain
 * outputs into ApexCharts/ApexMaps-ready view models. Every function here
 * only RESHAPES numbers that were already computed elsewhere (descriptive.ts,
 * benchmarking.ts, trends.ts, correlation.ts) — none of them recompute a
 * statistic, per spec: "Chart adapter may add labels/bands/annotations/
 * series names; must NOT recompute core statistics."
 */

import { quartiles } from "../statistical-risk/descriptive";
import { StatResult } from "../statistical-risk/types";
import { TrendPoint } from "../market-intelligence/trends";
import { BenchmarkComparison } from "../market-intelligence/benchmarking";
import { DataQualityAssessment } from "../market-intelligence/data-quality";
import { ForecastResult } from "../market-intelligence/phase2-contracts";
import {
  BenchmarkBarViewModel,
  BoxPlotViewModel,
  ChartMetadata,
  ChoroplethViewModel,
  HeatmapViewModel,
  HistogramViewModel,
  LineSeriesViewModel,
  MultiSeriesLineViewModel,
  RangeAreaViewModel,
  ScatterViewModel,
  TreemapViewModel,
} from "./types";

export function buildChartMetadata(sourceText: string, effectiveDateText: string, dataQuality: DataQualityAssessment): ChartMetadata {
  return { sourceText, effectiveDateText, dataQualityStatus: dataQuality.label };
}

/** trend -> line */
export function trendToLineChart(points: TrendPoint[], seriesName: string, metadata: ChartMetadata): LineSeriesViewModel {
  return {
    ...metadata,
    type: "line",
    categories: points.map((p) => p.periodEnd),
    series: [{ name: seriesName, data: points.map((p) => p.result.value) }],
  };
}

/** forecast + uncertainty (Phase 2) -> line + range area */
export function forecastToRangeArea(forecast: ForecastResult, metadata: ChartMetadata): RangeAreaViewModel {
  return {
    ...metadata,
    type: "rangeArea",
    categories: forecast.points.map((p) => p.period),
    estimate: { name: forecast.model, data: forecast.points.map((p) => p.estimate) },
    range: {
      name: `${forecast.model} range`,
      data: forecast.points.map((p) => [p.lower ?? null, p.upper ?? null]),
    },
  };
}

/** distribution -> box plot. Calls the SAME quartile function core stats use — reshapes, does not recompute a different way. */
export function distributionToBoxPlot(series: { name: string; values: number[] }[], metadata: ChartMetadata): StatResult<BoxPlotViewModel> {
  const data: [number, number, number, number, number][] = [];
  for (const s of series) {
    const q = quartiles(s.values);
    if (q.value === null || q.value.q1 === null || q.value.q2 === null || q.value.q3 === null) {
      return { value: null, sampleSize: s.values.length, issues: q.issues, methodology: "box plot quartiles via R-7 quantile" };
    }
    data.push([Math.min(...s.values), q.value.q1, q.value.q2, q.value.q3, Math.max(...s.values)]);
  }

  return {
    value: {
      ...metadata,
      type: "boxPlot",
      categories: series.map((s) => s.name),
      series: [{ name: "distribution", data }],
    },
    sampleSize: series.reduce((acc, s) => acc + s.values.length, 0),
    issues: [],
    methodology: "box plot quartiles via R-7 quantile",
  };
}

/** outcome distribution -> histogram-style bar */
export function outcomesToHistogram(buckets: { label: string; count: number }[], seriesName: string, metadata: ChartMetadata): HistogramViewModel {
  return {
    ...metadata,
    type: "histogram",
    categories: buckets.map((b) => b.label),
    series: [{ name: seriesName, data: buckets.map((b) => b.count) }],
  };
}

/**
 * relationship -> scatter (descriptive, not causal). `correlation`, if
 * provided, must already be a computed StatResult from
 * pearsonCorrelation() — this function only formats its value into a
 * caption, it never derives it.
 */
export function relationshipToScatter(
  points: [number, number][],
  seriesName: string,
  metadata: ChartMetadata,
  correlation?: StatResult<number>,
): ScatterViewModel {
  const correlationNote =
    correlation?.value !== undefined && correlation?.value !== null
      ? `Pearson r = ${correlation.value.toFixed(3)} — exploratory only, does not imply causation.`
      : undefined;

  return {
    ...metadata,
    type: "scatter",
    series: [{ name: seriesName, data: points }],
    correlationNote,
  };
}

/** sensitivity -> heatmap/matrix */
export function sensitivityToHeatmap(
  matrix: { x: string; y: string; value: number }[],
  categoriesX: string[],
  categoriesY: string[],
  seriesName: string,
  metadata: ChartMetadata,
): HeatmapViewModel {
  return {
    ...metadata,
    type: "heatmap",
    categoriesX,
    categoriesY,
    series: [{ name: seriesName, data: matrix.map((cell) => ({ x: cell.x, y: cell.value })) }],
  };
}

/** subject-vs-benchmark -> bar/range bar. Uses BenchmarkComparison's already-computed median/range — does not recompute them. */
export function benchmarkToBar(
  benchmark: BenchmarkComparison,
  subjectLabel: string,
  benchmarkLabel: string,
  metadata: ChartMetadata,
): BenchmarkBarViewModel {
  return {
    ...metadata,
    type: "benchmarkBar",
    subjectLabel,
    subjectValue: benchmark.subjectValue,
    benchmarkLabel,
    benchmarkMedian: benchmark.marketMedian.value,
    benchmarkRange: [benchmark.historicalRange.min.value, benchmark.historicalRange.max.value],
  };
}

/** scenario comparison -> multi-series line */
export function scenariosToMultiSeriesLine(
  scenarios: { name: string; points: TrendPoint[] }[],
  metadata: ChartMetadata,
): MultiSeriesLineViewModel {
  const categories = scenarios[0]?.points.map((p) => p.periodEnd) ?? [];
  return {
    ...metadata,
    type: "multiSeriesLine",
    categories,
    series: scenarios.map((s) => ({ name: s.name, data: s.points.map((p) => p.result.value) })),
  };
}

/** geography -> ApexMaps choropleth */
export function geographyToChoropleth(
  entries: { geographyId: string; label: string; value: number }[],
  metadata: ChartMetadata,
): ChoroplethViewModel {
  return { ...metadata, type: "choropleth", regions: entries };
}

/** portfolio concentration -> treemap/bar */
export function concentrationToTreemap(entries: { label: string; value: number }[], seriesName: string, metadata: ChartMetadata): TreemapViewModel {
  return {
    ...metadata,
    type: "treemap",
    series: [{ name: seriesName, data: entries.map((e) => ({ x: e.label, y: e.value })) }],
  };
}

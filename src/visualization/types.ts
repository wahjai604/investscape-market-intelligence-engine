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
 * Adapter-layer view model types — deliberately NOT importing the
 * `apexcharts` package. These are plain, ApexCharts/ApexMaps-*compatible*
 * data shapes (series/categories arrays matching what those libraries
 * expect), not the library's own config types — this package is headless
 * and has no UI dependency, per the engineering standard "no UI imports in
 * core modules" (which this file honors even though it's the adapter
 * layer, not core, since adding a real charting library as a runtime
 * dependency of an engine package is unnecessary coupling this repo
 * doesn't need yet). Consuming UI code maps these onto actual ApexCharts
 * `series`/`options` props.
 *
 * Every view model carries `sourceText` + `effectiveDateText` +
 * `dataQualityStatus`, per spec: "Every chart view model carries
 * source/effective-date text + data-quality status." No 3D variants exist
 * here — none should be added for decoration, per spec.
 */

import type { ConfidenceLabel } from "@investscape/calc-engine";

export interface ChartMetadata {
  sourceText: string;
  effectiveDateText: string;
  dataQualityStatus: ConfidenceLabel;
}

export interface LineSeriesViewModel extends ChartMetadata {
  type: "line";
  categories: string[];
  series: { name: string; data: (number | null)[] }[];
}

/** Forecast + uncertainty band — Phase 2 shape, exists now so the adapter can be written and tested against a hand-built ForecastResult even though runForecast() itself throws until Phase 2. */
export interface RangeAreaViewModel extends ChartMetadata {
  type: "rangeArea";
  categories: string[];
  estimate: { name: string; data: (number | null)[] };
  range: { name: string; data: [number | null, number | null][] };
}

export interface BoxPlotViewModel extends ChartMetadata {
  type: "boxPlot";
  categories: string[];
  series: { name: string; data: [min: number, q1: number, median: number, q3: number, max: number][] }[];
}

export interface HistogramViewModel extends ChartMetadata {
  type: "histogram";
  categories: string[];
  series: { name: string; data: number[] }[];
}

/** Relationship view — descriptive only, per spec: "scatter (descriptive, not causal)". `correlationNote` must never claim causation. */
export interface ScatterViewModel extends ChartMetadata {
  type: "scatter";
  series: { name: string; data: [x: number, y: number][] }[];
  correlationNote?: string;
}

export interface HeatmapViewModel extends ChartMetadata {
  type: "heatmap";
  categoriesX: string[];
  categoriesY: string[];
  series: { name: string; data: { x: string; y: number }[] }[];
}

export interface BenchmarkBarViewModel extends ChartMetadata {
  type: "benchmarkBar";
  subjectLabel: string;
  subjectValue: number;
  benchmarkLabel: string;
  benchmarkMedian: number | null;
  benchmarkRange: [number | null, number | null];
}

export interface MultiSeriesLineViewModel extends ChartMetadata {
  type: "multiSeriesLine";
  categories: string[];
  series: { name: string; data: (number | null)[] }[];
}

/** ApexMaps choropleth-compatible shape: one entry per geography id + value. */
export interface ChoroplethViewModel extends ChartMetadata {
  type: "choropleth";
  regions: { geographyId: string; label: string; value: number }[];
}

export interface TreemapViewModel extends ChartMetadata {
  type: "treemap";
  series: { name: string; data: { x: string; y: number }[] }[];
}

export type ChartViewModel =
  | LineSeriesViewModel
  | RangeAreaViewModel
  | BoxPlotViewModel
  | HistogramViewModel
  | ScatterViewModel
  | HeatmapViewModel
  | BenchmarkBarViewModel
  | MultiSeriesLineViewModel
  | ChoroplethViewModel
  | TreemapViewModel;

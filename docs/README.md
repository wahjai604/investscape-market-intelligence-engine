# Developer Documentation

This document covers module boundaries, the confidence-vocabulary decision, geography reconciliation, the percentile method, sample-vs-population defaults, missing-data policy, visualization-adapter boundaries, and Phase 2 extension points — everything a future contributor (human or Modular Prompt) needs to extend this package correctly.

## 1. Module boundaries

Two module trees, one strict rule between them:

```
src/statistical-risk/    — pure math. ZERO dependency on economic-engine, calc-engine, or market-intelligence.
src/market-intelligence/ — the ONLY tree allowed to import @investscape/economic-engine and @investscape/calc-engine.
src/visualization/       — adapter layer. Imports from both freely; never recomputes a statistic; no UI library dependency.
```

This is enforced by `__tests__/module-boundaries.test.ts`, which scans every file under `src/statistical-risk/` for a forbidden import pattern and fails the build if one appears. Do not weaken or delete this test to make a future change compile — if `statistical-risk/` genuinely needs something from `market-intelligence/`, that is itself a sign the function belongs in `market-intelligence/`, not a reason to relax the boundary.

Within `market-intelligence/`, imports of the two external engine packages are further concentrated into exactly two files by convention (not a test-enforced rule, but a strong one): `geography.ts` (imports `REGION_DETAILS` from economic-engine, for country-code derivation) and `economic-engine-adapters.ts` (imports the actual `regionalMacroContext`/`cityMarketAnalysis`/`neighborhoodDemographics` functions plus `DATA_FRESHNESS_TTL`/`DATA_SOURCES`). Every other file in `market-intelligence/` — `domain.ts`, `comparability.ts`, `trends.ts`, `benchmarking.ts`, `data-quality.ts` — works purely on the normalized `MarketObservation` model and has no idea economic-engine exists. If you add a new economic-engine call, put it in `economic-engine-adapters.ts`, not scattered across the module.

**Why this matters, concretely:** `investscape-economic-engine/src/E45-scenario-batch-processor.ts` (lines ~28–41) documents, in its own header, that a prior spec assumed it could call `@investscape/calc-engine` as a real dependency, that package "was not actually published or present anywhere," and E42–E45 ended up reimplementing a subset of calc-engine's mortgage/amortization/NOI/IRR math independently instead. That excuse doesn't apply here — both packages are real, tested, sibling repos with a working `file:` dependency (the same pattern `investscape-api` already uses). This package depends on them for real rather than repeating that mistake.

## 2. Confidence vocabulary — why calc-engine's, not economic-engine's, not a third one

Two confidence/provenance vocabularies already existed in the InvestScape codebase before this package (documented in `investscape-docs` Doc 62 §2.11):

- `@investscape/calc-engine`'s E19 (Data Provenance): `ProvenanceSource` (5-value enum), `ConfidenceLabel` (`"High"|"Moderate"|"Low"|"Uncertain"`), a numeric `confidence: number` (0–1), and per-field `TrackedField` records with quality scores and ages. Already publicly exported from `@investscape/calc-engine`'s `src/index.ts`.
- `@investscape/economic-engine`'s `RegionMetrics`/`CityMetrics`/`NeighborhoodMetrics`: a flat `confidence: 'high'|'medium'|'low'` string applied to the whole response bundle, backed by a `CONFIDENCE_LEVELS` constant.

An earlier draft of this package's own spec proposed a **third** vocabulary — `DataQualityAssessment.label` as its own `"high"|"moderate"|"low"|"insufficient"` string enum. The Aug 14, 2026 architecture review superseded that explicitly: `DataQualityAssessment.label` in `market-intelligence/data-quality.ts` is typed as calc-engine's real, already-exported `ConfidenceLabel` — not a new enum. `"Not enough data to assess"` is represented as a `StatisticalIssue` with `severity: "error"` (see `NOT_ENOUGH_DATA_ISSUE_CODE`), never as a label value, since `ConfidenceLabel` has no `"insufficient"` member and none was added.

**Why calc-engine's vocabulary and not economic-engine's:** calc-engine's is genuinely richer (per-field, numeric, four labels vs. three) and was already public — importing it creates no new problematic coupling, since calc-engine itself has zero dependencies. Score-to-label mapping in `data-quality.ts`'s `labelForScore()` reuses calc-engine E19's own threshold convention (0.8/0.5/0.25 on a 0–1 scale) rather than inventing new cutoffs, for consistency between the two confidence-scoring implementations that now exist side by side in this codebase.

**Where economic-engine's confidence still comes in:** `market-intelligence/economic-engine-adapters.ts` maps economic-engine's `'high'|'medium'|'low'` onto a `sourceReliability` (0–1) input for `assessDataQuality()` — see `CONFIDENCE_TO_SOURCE_RELIABILITY`. This is legitimate under `data-quality.ts`'s "never infer reliability from a source's name" rule, because economic-engine's own confidence assessment about its bundle is an *external* signal already computed by that engine, not a name-based guess made inside this package. `__tests__/market-intelligence/data-quality.test.ts` proves this propagates end-to-end using a **real** `confidence: 'low'` mock entry (`yellowknife-nt` in economic-engine's E30 city store, verified by direct inspection) rather than a hand-built fixture.

**SourceMetadata.sourceType vs. ProvenanceSource:** the spec's own `SourceMetadata.sourceType` (`"government"|"commercial"|"brokerage"|"user"|"internal"|"other"`) and calc-engine's `ProvenanceSource` (`"user_input"|"market_data"|"appraised"|"estimated"|"calculated"`) are two different enums for a related concept — not the same thing renamed. `data-quality.ts`'s `sourceTypeToProvenanceSource()` is a documented, single bridging function between them; nothing conflates the two vocabularies silently.

## 3. Geography reconciliation

`market-intelligence/domain.ts`'s `GeographyRef` is the spec's required shape (`id`, `name`, `level`, `parentId?`, `countryCode`) plus an `economicEngine` block carrying the original id/level (and coordinates, where they exist) — a wrapper/superset of economic-engine's geography shape, not an independent hierarchy, per the architecture review.

**A correction to the review's own premise, found during implementation:** the review stated coordinates are "confirmed identical across `RegionMetrics`/`CityMetrics`/`NeighborhoodMetrics`." Direct inspection of `investscape-economic-engine/src/types/{region,city,neighborhood}.types.ts` shows this is not accurate — only `NeighborhoodMetrics`/`NeighborhoodMetricsInput` carries `coordinates: {lat, lng}`; `RegionMetrics` and `CityMetrics` do not. `GeographyRef.economicEngine.coordinates` is typed as optional and is only ever populated by `wrapNeighborhoodGeography()`, reflecting reality rather than the review's premise. This is documented rather than silently "fixed" — see `domain.ts`'s `GeographyRef` doc comment.

**Level mapping:** economic-engine's `region` (e.g. `'central-canada'`, spanning multiple provinces) doesn't cleanly match any single value in the spec's `GeographyLevel` union (`"metro"` is one urban area; `"province_state"` is one province) — mapped to `"custom"` as the most honest choice rather than a forced mismatch. `city` → `"city"` and `neighborhood` → `"neighbourhood"` map directly (note the spec's British spelling for the latter).

**countryCode:** derived from economic-engine's real `REGION_DETAILS` lookup for region-level refs (`countryCodeForRegionId()` — `'Canada'` → `'CA'`, `'United States'` → `'US'`, unrecognized → `'UNKNOWN'`, never guessed). City- and neighborhood-level economic-engine types carry no country field at all, so `countryCode` there is caller-supplied, defaulting to `'UNKNOWN'` rather than inferred.

**Round-trip:** `unwrapEconomicEngineGeography()` recovers `{ level, id }` exactly as economic-engine expects it back. `__tests__/market-intelligence/geography.test.ts` proves this for all three levels — the architecture review's specific required test.

## 4. Percentile method

**R-7, linear interpolation, used exclusively and consistently** — the same method R's default `quantile()`, NumPy's default `method="linear"`, and Excel's `PERCENTILE.INC` use. Implemented once, in `statistical-risk/descriptive.ts`'s `quantile()`; `median()`, `quartiles()`, `iqrBounds()`, and any benchmarking percentile all route through it rather than each having their own interpolation logic. `h = (n-1) * p` (0-indexed), linear interpolation between the two bracketing order statistics of a sorted **copy** of the input.

## 5. Sample vs. population defaults

**Sample statistics are the default everywhere** (Bessel-corrected, divide by `n-1`) — `variance()`, `standardDeviation()` both require `n>=2` in sample mode. Population mode (`{ population: true }`) is an explicit opt-in, never inferred, per spec. `coefficientOfVariation()` always uses sample SD regardless of any population option — CoV is conventionally a sample-statistic ratio, and a population-mode CoV wasn't requested; that would need its own explicit design decision if ever needed.

## 6. Missing-data / edge-case policy

Every function returns a `StatResult<T>` (`{ value: T | null, sampleSize, issues, methodology }`) rather than throwing for expected statistical insufficiency, per spec. The severity convention, applied consistently across every function in `statistical-risk/`:

- **`"error"`** — the statistic could not be computed at all; `value` is `null`. Empty input, insufficient sample size, zero dispersion, zero denominator, unaligned pairs, negative weights (unless opted in), invalid years/domain for CAGR.
- **`"warning"`** — a value *was* returned, but the caller should treat it with caution (e.g. an undersized rolling window).
- **`"info"`** — purely informational, doesn't affect `value`. (Not currently used by any function in this package, but part of the type.)

`market-intelligence/comparability.ts` uses a parallel but distinct convention for its own issues: `"error"` blocks aggregation outright (metric/unit/currency/frequency mismatches — combining these would produce a number with no honest meaning); `"warning"` flags something contextually questionable but not mathematically nonsensical (geography-level mismatch, property-segment mismatch, seasonal-adjustment mismatch, period misalignment) — a caller may have a legitimate reason to proceed (e.g. benchmarking a neighbourhood against its city). This severity split is a documented judgment call, not spec-given; see `comparability.ts`'s doc comment for the full reasoning.

## 7. Visualization-adapter boundaries

`src/visualization/` produces plain, ApexCharts/ApexMaps-*compatible* data shapes (`series`/`categories` arrays) — it does **not** import the `apexcharts` package itself, so this remains a headless engine package with no UI runtime dependency. Every adapter function in `apex-adapter.ts` only **reshapes** a value some other module already computed (`descriptive.quartiles()`, `benchmarking.benchmarkSubject()`, `trends.periodOverPeriodSeries()`, `correlation.pearsonCorrelation()`) — none of them derive a statistic a different way. `distributionToBoxPlot()`, for instance, calls the exact same `quartiles()` function core stats use; it doesn't reimplement quartile math to fit a box-plot shape.

Every `ChartViewModel` carries `sourceText`, `effectiveDateText`, and `dataQualityStatus` (typed as `ConfidenceLabel`, same vocabulary as everywhere else in this package), per spec: *"Every chart view model carries source/effective-date text + data-quality status."* No 3D variant exists in `visualization/types.ts` — none should be added for decoration.

## 8. Phase 2 extension points

Nothing in Phase 2 is implemented. Two files hold typed-only contracts, split by dependency (see §1 for why the split doesn't match the spec's own illustrative single-location suggestion):

- `statistical-risk/phase2-contracts.ts` — `MonteCarloRequest`, `ProbabilityResult`, `runMonteCarloSimulation()`. Pure math, no `MarketObservation` dependency, stays in the zero-dependency tree.
- `market-intelligence/phase2-contracts.ts` — `ForecastRequest`, `ForecastPoint`, `ForecastResult`, `runForecast()`. `ForecastRequest.series` is typed as `MarketObservation[]` per the spec's verbatim contract — that dependency is exactly why this file lives in `market-intelligence/` rather than `statistical-risk/`.

Both `run*()` functions throw immediately (`"Phase 2 not implemented..."`) rather than returning a fabricated result — there is no "close enough" placeholder for a forecast or a Monte Carlo simulation. When Phase 2 implementation begins, expect these shapes to be revisited against real forecasting-model requirements rather than treated as frozen — the doc comments say so explicitly.

`visualization/apex-adapter.ts`'s `forecastToRangeArea()` already exists and can be exercised today against a hand-built `ForecastResult` in tests, even though `runForecast()` itself throws — the adapter is a pure reshape function and doesn't care how its input was produced.

## 9. Still-open product decisions (do not guess at these)

Two fields in the API-facing `MIOpportunityMetric<T>` envelope (to be assembled at the `investscape-api` translation-layer boundary in a future Modular Prompt, per the architecture review — **not** returned directly by this package's internal functions) have no definition yet:

- **`status`** — what does it mean? Positive/neutral/caution/negative? This package's closest internal precedent is `market-intelligence/benchmarking.ts`'s `zScoreVsBenchmark` and economic-engine's own `neighborhoodInvestmentScore`'s `grade`/`riskLevel`, but neither has been adopted as *the* answer — that's a product decision for whoever builds the translation layer.
- **`benchmark`** — benchmark against what? City median? Historical trailing average? Peer percentile? `benchmarking.ts`'s `BenchmarkComparison` already computes several of these (`marketMedian`, `peerPercentileRank`, `historicalRange`) — the open question is which one (or which combination) `MIOpportunityMetric.benchmark` should surface, not whether the underlying math exists.

Both are typed-placeholder territory, not this package's problem to solve — this package supplies the real building blocks (`benchmarkSubject()`, `assessDataQuality()`) that whatever answers those questions will be built from.

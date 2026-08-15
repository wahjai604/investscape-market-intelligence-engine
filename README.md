# InvestScape Market Intelligence & Statistical Risk Engine

**Repository:** https://github.com/wahjai604/investscape-market-intelligence-engine
**License:** Proprietary (Closed-Source) — see [LICENSE](LICENSE)
**Copyright:** © 2026 Lighthouse Research Ltd.

## Purpose

Two engines, in one package:

- **Statistical Risk v1** (`src/statistical-risk/`) — deterministic, side-effect-free, non-mutating pure math: descriptive statistics, percentiles (R-7), variance/standard deviation (sample and population), coefficient of variation, period-over-period/CAGR growth, rolling mean/growth, Z-score/IQR outlier detection, Pearson correlation, weighted mean. **Zero dependency** on any other InvestScape package.
- **Market Intelligence** (`src/market-intelligence/`) — comparability validation, benchmarking, trend analysis over real market data, and data-quality assessment. Consumes `@investscape/economic-engine` and `@investscape/calc-engine` as real dependencies rather than re-deriving anything they already compute.

Plus a headless visualization adapter layer (`src/visualization/`) converting domain outputs into ApexCharts/ApexMaps-ready view models, with no UI library dependency.

**This is Phase 1.** Forecasting, regression (with `ModelDiagnostics`), back-testing diagnostics, Monte Carlo simulation, probability-of-threshold, and portfolio covariance/correlation risk are all Phase 2 — documented interfaces only (`phase2-contracts.ts` in both module trees), not implemented. Portfolio covariance/correlation risk specifically is flagged `"PHASE 2+"` in its own doc comment — the most speculative and least-specified of the scaffolds, per the master spec's own Phase Scope Matrix. See [docs/README.md](docs/README.md) §8 for the full rationale, module boundaries, and formulas.

## Scope

| Module | Contents |
|---|---|
| `statistical-risk/descriptive.ts` | mean, median, min, max, range, quantile (R-7), quartiles, percentileRank |
| `statistical-risk/dispersion.ts` | sample/population variance & standard deviation, coefficient of variation |
| `statistical-risk/growth.ts` | period change (MoM/QoQ/YoY are this one function applied to different pairs), CAGR, rolling mean, rolling growth, indexed series |
| `statistical-risk/outliers.ts` | Z-score, IQR outlier bounds, outlier detection |
| `statistical-risk/correlation.ts` | Pearson correlation (exploratory only — never implies causation) |
| `statistical-risk/weighted.ts` | weighted mean |
| `statistical-risk/phase2-contracts.ts` | Monte Carlo / probability-of-threshold and portfolio covariance/correlation ("PHASE 2+") interfaces — not implemented |
| `market-intelligence/domain.ts` | `MarketObservation`, `GeographyRef`, `SourceMetadata` and the rest of the spec's data contracts |
| `market-intelligence/geography.ts` | Wraps/unwraps economic-engine's region/city/neighborhood ids into `GeographyRef` |
| `market-intelligence/comparability.ts` | Required-before-aggregation comparability checks |
| `market-intelligence/trends.ts` | Period-over-period, CAGR, rolling measures over `MarketObservation[]` series |
| `market-intelligence/benchmarking.ts` | Subject vs. market median / peer percentile / historical range / z-score |
| `market-intelligence/data-quality.ts` | Composite 0–100 data-quality score with component breakdown |
| `market-intelligence/economic-engine-adapters.ts` | The one place this package calls `@investscape/economic-engine`'s real functions |
| `market-intelligence/phase2-contracts.ts` | Forecasting, regression/`ModelDiagnostics`, and back-testing interfaces (all depend on `MarketObservation`) — not implemented |
| `visualization/apex-adapter.ts` | Reshapes already-computed results into chart view models — never recomputes a statistic |

## Testing

- **Test suites:** 16
- **Test cases:** 111 (111/111 passing)
- Includes every exact required value from the master spec (mean, median, R-7 quantile, sample/population SD, CAGR, Pearson, zero-dispersion/empty-input/zero-denominator edge cases), plus the architecture review's three additional required tests: the geography round-trip, the confidence-vocabulary data-quality interaction (using a real `confidence: 'low'` economic-engine bundle), and the freshness-TTL agreement check against economic-engine's real `DATA_FRESHNESS_TTL` constants.

```bash
npm test
npm run lint   # tsc --noEmit
npm run build
```

## Installation

For authorized users only. Usage requires a valid InvestScape tier (S1–S3).

This repo depends on sibling repos via local `file:` dependencies — `investscape-economic-engine` and `investscape-calc-engine` must be checked out alongside it (as siblings in the same parent directory), same pattern as `investscape-api`.

```bash
npm install
npm test
npm run build
```

## Architecture

`src/statistical-risk/` has **zero dependency** on `@investscape/economic-engine`, `@investscape/calc-engine`, or `src/market-intelligence/` — enforced by an automated test (`__tests__/module-boundaries.test.ts`) that scans the actual source, not just a doc-comment promise. `src/market-intelligence/` is the only module tree allowed to import the other two engine packages, and does so in exactly two files (`geography.ts`, `economic-engine-adapters.ts`). `src/visualization/` depends on both freely, as an adapter layer, but never recomputes a statistic and has no UI library dependency of its own.

Full rationale, the confidence-vocabulary decision, geography reconciliation, percentile method choice, sample-vs-population defaults, missing-data policy, and Phase 2 extension points: see **[docs/README.md](docs/README.md)**.

## Documentation

Reference documentation: https://github.com/wahjai604/investscape-docs (Doc 62: API Hardening Gap Report and Market Intelligence Contract — the architecture review this package implements).

## License & Disclaimer

This software is closed-source proprietary code. Authorized users only.

For legal disclaimers, see [DISCLAIMER.md](DISCLAIMER.md).

---

© 2026 Lighthouse Research Ltd. All rights reserved.
InvestScape™ is a trademark of Lighthouse Research Ltd.

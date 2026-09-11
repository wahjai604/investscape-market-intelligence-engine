# E68 Phase 5 — Application Integration

Status: **READY FOR FRONTEND INTEGRATION.** The E68-side contract is complete and tested. No application repository was modified — see Part 1.

## Part 1 — Application repository inspection

The workspace was re-searched (all 8 sibling folders, not just the 6 from Phase 4): `investscape-api`, `investscape-calc-engine`, `investscape-docs`, `investscape-economic-engine`, `investscape-market-intelligence-engine`, `investscape-tax-engine`, `weweb-integration-tests`, plus the workspace root.

Findings:

- **No WeWeb frontend repository exists in this workspace.** `weweb-integration-tests` is a small test harness that validates a `<script>` snippet (`weweb-custom-code-snippet.html`) which WeWeb's Custom Code element loads to attach the three engine UMD bundles (`calc-engine`, `economic-engine`, `tax-engine`) to `window.*`. It contains no application pages, no bindings, and no benchmark constants.
- **`CAP_RATE_BENCHMARKS` and `DEV_BUILDING_SUBTYPES` do not exist anywhere in this workspace.** Confirmed by a fresh grep across every repo, re-running Phase 4's search rather than trusting its cached conclusion.
- **`investscape-api` is a real, substantial server-side application layer** — 60+ route modules (`E1`...`E82`), including a `market-intelligence/` route group (`E60`–`E66`) that already imports `@investscape/market-intelligence-engine` as an npm dependency and exposes `POST /calculate/market-intelligence/benchmark-subject` and related endpoints.
- That dependency is **vendored as a frozen tarball, `vendor/investscape-market-intelligence-engine-0.1.1.tgz`**, predating E68 entirely — its `dist/` has no `cre-intelligence` directory. `E60`–`E66` exercise a different, earlier surface of this package (generic statistical `marketIntelligence.benchmarkSubject`), not cap rates or construction costs.
- No other repo (`calc-engine`, `tax-engine`, `economic-engine` outside E30, `docs`) contains a cap-rate or construction-cost constants table beyond `calc-engine`'s `CAP_RATE_STRONG_THRESHOLD`/`SOLID`/`WEAK` — deal-grading cutoffs, not a benchmark-by-city table, and out of scope here.

**Conclusion:** the actual InvestScape "frontend" for engine consumption is a WeWeb project that is not checked into this workspace and cannot be inspected or modified from here. `investscape-api` is a real, available adapter boundary, but wiring this phase's work into its vendored tarball is a packaging/release action (rebuild the tarball, bump the dependency, redeploy the API) that is outside E68's own repository and was not requested — doing it unprompted would be exactly the kind of cross-repo side effect Phase 4C's "do not integrate into the live application yet" was guarding against, one phase early. Per the Phase 5 spec's Part 8, this phase therefore builds the complete integration contract inside `investscape-market-intelligence-engine` and stops there.

## Architecture

```
RAW SOURCE
    v
E68 OBSERVATION        (data/*.ts — CRECitedObservation, immutable, cited)
    v
VALIDATION              (existing: mandatory CRECitation, CREDataGap for absence)
    v
QUALIFICATION           (qualification.ts, Phase 4C — exact/close/approximate/unsupported floor)
    v
E68 BENCHMARK           (benchmark-selection.ts, Phase 5 — deterministic selection -> CREBenchmarkResponse)
    v
APPLICATION MAPPING     (mapping.ts, Phase 4 — legacy key/subtype translation, embedded in qualification)
    v
INVESTSCAPE APPLICATION (not present in this workspace — consumes CREBenchmarkResponse once wired)
```

Nothing in Phase 5 collapses this into a single number. Every `CREBenchmarkResponse` carries `provenance: BenchmarkProvenanceEntry[]` back to the specific observation(s) selected, so "why did InvestScape use this cap rate" is always answerable from the response object alone.

## Benchmark layer (Part 2)

`benchmark-types.ts` defines `BenchmarkIdentity` (the request: geography/asset class/subtype/class/location type/cap-rate type) and `CREBenchmarkResponse` (the result). A benchmark is never a bare number — it is an identity plus one or more `BenchmarkProvenanceEntry` records, each carrying source, report, page/table locator, URL, and qualification.

## Selection rules (Part 3)

`selectCapRateBenchmark` / `selectHardCostBenchmark` in `benchmark-selection.ts` filter the observation pool by identity (country, city, asset class, and — only if the request specifies them — subtype, class, location type, cap-rate type), then rank survivors by period recency and source quality. No averaging step exists in this code path: the top-ranked observation after filtering **is** the benchmark; other matches are retained only as additional `provenance` entries.

Explicitly not done, per spec: no cross-asset-class averaging, no cross-property-class averaging, no CBD/suburban blending, no silent widening after a narrow match fails (a narrower request that finds nothing returns `DATA_GAP`, it does not retry broader).

## Approximate/warning behaviour (Part 4)

- `exact`/`close` qualification -> `status: "AVAILABLE"`.
- `approximate` qualification -> `status: "AVAILABLE_WITH_WARNING"`, and `warnings[0]` is always the mandatory `"Approximate benchmark — ..."` string, never omitted.
- `unsupported` qualification -> `status: "DATA_GAP"`; `mappedLegacyKey` and `publisherRange`/`publisherValue` are never populated.

**Houston worked example**, tested explicitly (`benchmark-integration.test.ts`, describe block B/C/H): Houston Class A Infill resolves `qualification: "approximate"` and `status: "AVAILABLE_WITH_WARNING"` even though its base classification match is exact, because `qualification.ts` (Phase 4C) already caps it for the Newmark source's documented internal date contradiction plus staleness. Phase 5 does not weaken that — it surfaces it as a mandatory warning instead of hiding it.

## Range handling (Part 5)

`CREBenchmarkResponse.publisherRange` holds the publisher's own low/high verbatim; `publisherValue` holds a publisher's own point estimate. Neither is ever synthesized. A single number is only ever produced by the separate, opt-in `deriveMidpoint()` function, which returns a `DerivedValue` explicitly tagged `provenance: "e68_derived"` and `sourceSupplied: false`. Nothing in the selection path calls `deriveMidpoint` on its own — an application must ask for it.

## Construction-cost integration (Part 6)

`selectHardCostBenchmark` reuses the same identity-filter/rank pipeline, but qualifies against `mapRlbSubtype` (Phase 4's mapping table) instead of `qualifyCapRateObservation`, since Phase 4C only built cap-rate qualification. An RLB subtype with `unsupported` mapping confidence — multifamily and industrial, per `mapping.ts` — returns `DATA_GAP`, not a forced fit. RLB's own footnote that its US $/SF figures are hard-cost-only is preserved: nothing here invents a soft-cost or all-in figure from a hard-cost source.

## Soft costs (Part 7)

`soft-cost.ts` returns a fixed `SOFT_COST_DATA_NOT_AVAILABLE` response for every request. E68 has no verified soft-cost source; this is a placeholder contract, not a computed answer, and its `reason` field says so explicitly so a consumer cannot mistake it for E68 research.

## Legacy protection (Part 10)

`legacy-migration.ts`'s `auditLegacyBenchmark` classifies a legacy value as `LEGACY_UNVERIFIED` (default) or `NULL` (if `nullify: true`) whenever it lacks either a recorded source or a matched E68 observation — **and even when it has both**, because having a source and a matched observation is not the same as having been re-derived through E68's own qualification pipeline. No legacy value is ever reclassified as E68-sourced by this function. Since no legacy benchmark table exists in this workspace (Part 1), this is a design/contract for the WeWeb repository to run once E68 is wired in there — not a completed migration.

## User override (Part 11)

`user-override.ts` separates `createUserOverride` (records `overrideValue`/`overrideReason`/`overrideTimestamp`/`originalE68Value`, `source: "USER"`) from `resolveBenchmark` (decides `active: "e68" | "override" | "application_default"`). An override is a returned record, never a write path into the E68 data layer — there is no function in this package that accepts an override and mutates `data/*.ts`. Tested explicitly (Part N).

## Provenance (Part 12)

Every non-`DATA_GAP` `CREBenchmarkResponse` includes `provenance: BenchmarkProvenanceEntry[]` — observation id, source id/name, report title, publication date, period, locator, source URL, qualification, and methodology note when present. This is sufficient to answer "why this number" without a second lookup.

## Data-gap response (Part 13)

Every `DATA_GAP` response includes `dataGap: { reason, sourcesInvestigated, lastResearchDate }`. Never `0`, never a bare `null`, never a market average substituted silently.

## UI-ready output (Part 15)

`CREBenchmarkResponse` is the adapted version of the spec's example — using `publisherRange`/`publisherValue`/`derivedBenchmark` instead of a flat `value/low/high`, per Part 5's requirement that the publisher-vs-derived distinction survive to the UI. See `benchmark-types.ts` for the full shape and `benchmark-integration.test.ts` for worked examples of `AVAILABLE`, `AVAILABLE_WITH_WARNING`, and `DATA_GAP`.

## What Phase 5 explicitly did NOT do (Part 16 compliance)

- Did not invent any cap rate, construction cost, or soft cost.
- Did not interpolate a missing city.
- Did not average unrelated asset classes, property classes, or CBD/suburban observations.
- Did not silently convert any range to a point (`deriveMidpoint` is opt-in and tagged).
- Did not let any `approximate` observation populate a benchmark without a warning.
- Did not modify any of the 88 source observations from Phase 4/4A/4B/4C.
- Did not copy E68 data into another repository.
- Did not touch `investscape-api`'s vendored tarball or any other sibling repo.
- Did not treat a data gap as zero, or an inaccessible source as nonexistent.
- Did not implement or purchase any paid data source.

## Integration endpoint shape (for the frontend team)

This package exports everything a service boundary (e.g. a future `investscape-api` route, or a WeWeb-side adapter once one exists) needs:

```ts
import {
  selectCapRateBenchmark,
  selectHardCostBenchmark,
  deriveMidpoint,
  createUserOverride,
  resolveBenchmark,
  auditLegacyBenchmark,
  getSoftCostBenchmark,
  US_CAP_RATE_OBSERVATIONS,
  CA_CAP_RATE_OBSERVATIONS,
  US_HARD_COST_OBSERVATIONS,
  mapRlbSubtype,
} from "@investscape/market-intelligence-engine";

const response = selectCapRateBenchmark(
  { metric: "cap_rate", country: "US", city: "Houston", assetClass: "multifamily", propertySubtype: "class_a_infill" },
  US_CAP_RATE_OBSERVATIONS,
);
```

A real HTTP endpoint (e.g. `GET /calculate/market-intelligence/e68/cap-rate-benchmark`) is a straightforward thin wrapper around `selectCapRateBenchmark`/`selectHardCostBenchmark` plus the identity from the request body — but adding that route to `investscape-api`, rebuilding its vendored dependency, and redeploying it is a separate, cross-repo action for a future session with explicit instruction to touch that repository.

## Test coverage

`__tests__/cre-intelligence/benchmark-integration.test.ts` — 22 new tests covering Part 14's A, B/C, D, E/F, G, H, I, J, K/L, M, N (x3), O (x3), P (x2), Q, plus a determinism check. Full suite: 24 suites / 263 tests passing; `tsc --noEmit`, `npm run build`, `npm run lint` all clean.

## Remaining gaps (unchanged from Phase 4B/4C — Phase 5 did no new research)

Miami has zero cap-rate observations of any kind; office/industrial/retail remain unsourced for most cities in both countries; no `derived_transaction` cap rate exists anywhere; CBRE Canada/Colliers Canada/Avison Young remain `FOUND_BUT_INACCESSIBLE`; E68 has no soft-cost data at all.

REAL > TRACEABLE > GRANULAR > CURRENT > COMPLETE.

# E68 Phase 7 — Government & Public/API Data Ingestion

Research and implementation date **2026-09-11**. This phase adds the ingestion
architecture and first public-source adapters for E68. It builds on, and does
not duplicate, Phases 1–6:

- `types.ts` — `CREObservation`, `CREDataGap`, citation/provenance model
- `source-registry.ts` — `CRE_SOURCE_REGISTRY`, `isRedistributable`
- `normalize.ts` / `qualification.ts` / `mapping.ts` — normalization, validation, qualification
- `paid-source-analysis.ts` — Phase 6 paid-source classification (unchanged)
- `docs/e68-source-registry.md`, `docs/E68-cap-rate-data-coverage.md`, `docs/E68-phase6-paid-source-analysis.md`

E68 remains the sole data-foundation engine. No E69+ engine, valuation logic,
underwriting logic, or downstream cap-rate/construction-cost calculation was
added in this phase.

---

## 1. Sources investigated

**Canada:** Statistics Canada (Web Data Service / BCPI), CMHC Housing Market
Information Portal, BC Assessment, Government of Canada Open Data
(open.canada.ca), City of Toronto Open Data (representative municipal
example).

**USA:** FRED (Federal Reserve Bank of St. Louis), U.S. Census Bureau (ACS /
Building Permits Survey), Bureau of Economic Analysis (BEA), Bureau of Labor
Statistics (BLS), HUD USER (Fair Market Rents), data.gov, City of Austin Open
Data (representative municipal example, Socrata platform).

Full classification for each — category, API/download availability,
authentication, pricing, licensing tags, geographic granularity, historical
depth, and evidence URLs — is in
`src/cre-intelligence/ingestion/public-source-registry.ts`
(`CRE_PUBLIC_SOURCE_REGISTRY`). That file, not this document, is the source of
truth; citations below summarize it.

Not every provincial/state or municipal source in the spec's list was
individually investigated — see §3 and §10 for what remains open. Per-city
municipal open-data portals for Vancouver, Victoria, Calgary, Edmonton,
Winnipeg, Ottawa, Montreal, Halifax, St. John's, Houston, Miami, Seattle, and
Phoenix were **not individually verified** in this phase; Toronto and Austin
were used as one representative example per country to establish that the
municipal-open-data pattern (Socrata/CKAN, no auth, public-domain-adjacent
terms) is real and workable, not to claim coverage of every priority city.

## 2. Sources accepted (adapters implemented or CREObservation-eligible)

| Source | Role | Why accepted |
| --- | --- | --- |
| Statistics Canada WDS (`statcan-wds`) | Adapter implemented, produces real `CREObservation`s (`construction_index`) | Documented public REST API, no auth, Open Licence explicitly permits commercial use + redistribution with attribution. Already trusted in `CRE_SOURCE_REGISTRY` as `statcan-bcpi`. |
| FRED API (`fred-api`) | Adapter implemented, produces `EconomicIndicatorObservation`s only | Documented public REST API, free API key, decades of metro-level series. Restricted by type system from ever producing a cap rate. |
| U.S. Census Bureau API (`us-census-api`) | Adapter implemented, produces `EconomicIndicatorObservation`s only | Documented public REST API, free API key, public-domain data, explicit ToS. |

No source was added directly to `CRE_SOURCE_REGISTRY` (the benchmark-grade
registry) in this phase except reusing the existing `statcan-bcpi` entry —
Phase 7's new inventory lives in the parallel `CRE_PUBLIC_SOURCE_REGISTRY`
because most of what was investigated is CRE-*adjacent* data, not a CRE
benchmark, and conflating the two registries would blur exactly the
distinction Phase 4's fabrication problem violated.

## 3. Sources rejected or deferred, and why

| Source | Disposition | Reason |
| --- | --- | --- |
| BC Assessment | Rejected for ingestion | Public per-property lookup only; bulk/programmatic access is a paid commercial data-licensing product. `legallyIncorporable: false`. |
| CMHC HMIP | Deferred | Genuinely public housing data, but no documented general-purpose REST API was found — data is published as downloadable tables, not queryable via key. `API_OR_DOWNLOAD_UNAVAILABLE` for automation purposes; already registered (`cmhc-housing`) for manual/report use. |
| open.canada.ca | Deferred (index only) | A CKAN routing layer over StatCan/CMHC/departmental data already assessed individually; no independent CRE dataset found. |
| Toronto Open Data | Deferred (representative only) | Confirms the municipal-portal pattern works; not itself a CRE benchmark source, and the other 9 Canadian priority cities were not individually checked. |
| BEA API | Deferred, architecturally supported | Public API, free key, metro GDP — a natural next adapter using the same `SourceAdapter` contract, not implemented this phase. |
| BLS API | Deferred, architecturally supported | Public API, free key; national PPI construction already used in `CRE_SOURCE_REGISTRY` (`bls-ppi-construction`); metro-level adapter not implemented this phase. |
| HUD USER FMR | Deferred | Public API exists, but Fair Market Rents are a residential subsidy benchmark, not a market rent or CRE metric — low priority for E68's scope. |
| data.gov | Deferred (index only) | Routing layer, not an independent dataset. |
| Austin Open Data | Deferred (representative only) | Confirms the Socrata municipal pattern; Houston/Miami/Seattle/Phoenix each run separate portals, not individually checked. |
| Any paid source (CoStar, MSCI/RCA, CBRE gated download, Altus, RSMeans, etc.) | Out of scope by design | Part 15 of the spec forbids new paid integration in this phase; Phase 6's existing analysis stands unchanged. |

## 4. Source classifications (Part 2)

Every entry in `CRE_PUBLIC_SOURCE_REGISTRY` is tagged with one or more of the
eight Part 2 categories. Summary counts as of this phase:

- **Direct CRE benchmark:** 1 (Statistics Canada BCPI only — a construction
  cost/escalation index, not a cap rate)
- **CRE-adjacent economic:** FRED, BEA, BLS, StatCan WDS, open.canada.ca (partial)
- **Property/assessment:** BC Assessment, Toronto Open Data (partial)
- **Construction/permit:** Toronto Open Data, Austin Open Data, Census (Building Permits Survey)
- **Demographic:** U.S. Census (ACS), open.canada.ca (partial)
- **Rental/housing:** CMHC, HUD USER
- **Transaction/public-record:** none confirmed as genuinely public+redistributable in this phase (deed/sales records generally sit behind county-level portals not individually checked)
- **Not available (explicitly):** no government source in this inventory publishes a commercial cap rate, transaction-derived yield, or construction-cost-per-SF figure directly — confirming Part 6's premise that this must not be assumed.

**No source in this inventory publishes a commercial cap rate.** This
confirms, rather than contradicts, Phase 4's lesson: government/public data is
valuable as CRE-adjacent context (rates, population, employment, construction
activity, escalation), never as a substitute for a licensed CRE market source.

## 5. API/download availability (Part 3)

| Source | API | Auth | Format | Free/Paid |
| --- | --- | --- | --- | --- |
| StatCan WDS | Public REST API | None | JSON/CSV/SDMX | Free |
| FRED | Public REST API | Free API key | JSON/XML | Free |
| US Census (ACS) | Public REST API | Free API key | JSON | Free |
| BEA | Public REST/JSON API | Free API key | JSON/XML | Free |
| BLS | Public REST API | Free API key (higher tier) | JSON | Free |
| HUD USER FMR | Public REST API | Free API key | JSON/CSV | Free |
| CMHC HMIP | Downloadable tables | None | CSV/XLSX | Free |
| open.canada.ca / data.gov | CKAN API | None | CSV/JSON/XML | Free |
| BC Assessment | Web lookup only (bulk = paid) | None (paid tier: contract) | Web only | Free (lookup) / Paid (bulk) |
| Toronto / Austin open data | CKAN / Socrata API | None | CSV/JSON/GeoJSON | Free |

Rate limits, where published, are noted per-source in the registry
(`rateLimitNote`); several sources (FRED, StatCan) do not publish a firm
numeric ceiling and should be re-verified against live terms before
high-volume production use.

## 6. Licensing considerations (Part 10)

Licensing tags applied per source (`CRELicenseTag`):
`PUBLIC_GOVERNMENT`, `PUBLIC_API`, `PUBLIC_DOWNLOAD`, `ATTRIBUTION_REQUIRED`,
`COMMERCIAL_USE_PERMITTED`, `COMMERCIAL_USE_UNCLEAR`, `REDISTRIBUTION_UNCLEAR`,
`LICENSE_REQUIRED`, `PAID`.

- **Clear commercial-use + redistribution:** Statistics Canada (Open Licence –
  Canada; explicit commercial-use and redistribution permission with
  attribution — https://www.statcan.gc.ca/en/reference/licence), U.S. Census
  Bureau, BEA, BLS, HUD (all U.S. federal public-domain works under
  17 U.S.C. §105), open.canada.ca / data.gov (index layers over the same).
- **REQUIRES LICENSE REVIEW:** FRED — a documented Terms of Use page exists
  (https://fred.stlouisfed.org/docs/api/terms_of_use.html) but this phase's
  research did not confirm a specific, unambiguous commercial-use/
  redistribution clause; several FRED series republish third-party data
  (e.g. Zillow-derived series), which independently requires checking the
  *original* producer's terms, not just FRED's. CMHC and Toronto/Austin
  municipal portals: redistribution terms not individually confirmed.
- **License required / rejected:** BC Assessment bulk data (explicit paid
  commercial-licensing program).

No claim in this document or in `public-source-registry.ts` asserts a
redistribution or commercial-use right beyond what was actually read in a
published terms page; every uncertain case is marked `unclear` /
`REQUIRES_LICENSE_REVIEW` rather than assumed favorable.

## 7. Geographic coverage

- **StatCan BCPI:** CMA-level; verified coverage for Vancouver, Calgary,
  Edmonton, Winnipeg, Toronto, Ottawa, Montreal, Halifax. Victoria and St.
  John's are **not confirmed** as separately identified CMAs in this table —
  recorded as an open question, not assumed covered or uncovered.
- **FRED / Census / BEA / BLS:** national and metro/CBSA-level series exist
  for all five U.S. priority cities (Austin, Houston, Miami, Seattle,
  Phoenix) as standard CBSA definitions, though any *specific* series must
  still be checked for whether that particular metro is published (FRED in
  particular varies series-by-series).
- Sub-metro (submarket) granularity is **not available** from any source in
  this inventory — this is a real ceiling on public data's usefulness for
  E68, not an oversight.

## 8. Historical coverage

- StatCan BCPI: multi-decade series, varies by CMA.
- FRED: most macro/mortgage-rate series run for decades; per-series depth
  must be checked individually.
- Census ACS 5-Year Estimates: reliable multi-year vintages back to the
  mid-2000s for most metro geographies; 1-year estimates only for larger
  geographies.
- BEA regional GDP: generally available from the late 1990s/2000s depending
  on the table.
- BLS PPI/CES: decades at the national level; metro-level series vary.

## 9. Implemented adapters

Three adapters, each with the same generic `SourceAdapter<TQuery, TRaw,
TParsed>` contract (`src/cre-intelligence/ingestion/types.ts`):
`fetchRaw` → `parse` → `normalize`, returning one of `ok` (real
`CREObservation[]`), `ok_economic` (`EconomicIndicatorObservation[]`), `gap`
(reason-coded `CREDataGap`), or `error` (typed `SourceAdapterError`).

1. **`FredAdapter`** (`ingestion/adapters/fred-adapter.ts`) — FRED series
   observations. Output type-restricted to `EconomicIndicatorObservation`;
   structurally cannot produce a `cap_rate`.
2. **`StatCanBcpiAdapter`** (`ingestion/adapters/statcan-adapter.ts`) —
   Statistics Canada WDS vector data for the Building Construction Price
   Index. Produces real `CREObservation`s (`metric: "construction_index"`),
   attributed to the existing `statcan-bcpi` registry entry. Validates index
   values against a sanity band and rejects (as a gap, not silently) any
   out-of-range figure.
3. **`CensusAcsAdapter`** (`ingestion/adapters/census-adapter.ts`) — Census
   ACS 5-Year Estimates by metro/CBSA. Output type-restricted to
   `EconomicIndicatorObservation`; rejects Census's negative sentinel codes
   (e.g. `-666666666`) as `VALIDATION_FAILED` rather than storing them as real
   statistics.

All three are tested against recorded JSON fixtures
(`__tests__/cre-intelligence/ingestion/fixtures/`) via an injected fetcher —
**no test in this phase makes a live network call.**

## 10. Deferred adapters

BEA, BLS (metro-level), CMHC, HUD USER, and municipal open-data portals
(Toronto/Austin patterns, Socrata/CKAN) are architecturally supported by the
same `SourceAdapter` contract and are registered in
`CRE_PUBLIC_SOURCE_REGISTRY` with enough metadata to build an adapter, but no
adapter code was written for them this phase — prioritized down in favor of
the three highest-value, best-documented APIs (Part 8 of the spec: "prefer a
small number of excellent adapters over many superficial ones").

## 11. Data gaps

Part 11's structured vocabulary is implemented in
`src/cre-intelligence/ingestion/gap-reasons.ts` as `CREDataGapReasonCode`:
`METRIC_NOT_PUBLISHED`, `GEOGRAPHY_NOT_COVERED`, `GRANULARITY_NOT_AVAILABLE`,
`API_OR_DOWNLOAD_UNAVAILABLE`, `LICENSE_REQUIRED`,
`SOURCE_TEMPORARILY_UNAVAILABLE`, `SCHEMA_CHANGED`, `VALIDATION_FAILED`. This
is attached as an **optional** `reasonCode` field on the existing
`CREDataGap` interface (`types.ts`) — every gap recorded in Phases 1–6 remains
valid without modification; new gaps recorded through the ingestion layer set
it.

`formatDataGapMessage()` turns a reason code into the precise, non-generic
message the spec calls for, e.g.:

> "Commercial cap rate unavailable from public government sources for Miami,
> FL. This metric is not published by any public/government source E68 has
> checked. Licensed CRE market source required."

No new `CREDataGap` rows were added to the existing cap-rate/construction-cost
datasets in this phase — Phase 7 is architecture and adjacent-data ingestion,
not a re-run of the Phase 4 city/metric gap survey. The three adapters
themselves emit reason-coded gaps at runtime (tested: empty result sets,
out-of-range index values, and geography-not-covered all produce a gap
carrying `reasonCode`).

## 12. Architecture

```
Government/Public Source
        |
        v
  Source Adapter            (fetchRaw / parse / normalize — SourceAdapter<TQuery,TRaw,TParsed>)
        |
        v
  Raw Source Record         (RawSourceRecord<TRaw>: sourceId, datasetId, retrievedAt, requestParams, raw)
        |
        v
  Normalization             (adapter.parse -> typed intermediate shape; throws SourceAdapterError on
        |                     an unrecognized shape rather than guessing)
        v
  Validation                (adapter.normalize: range/sanity checks; failures become a reason-coded
        |                     CREDataGap, never a silently-accepted bad value)
        v
  Qualification              (existing qualifyCapRateObservation, for any CREObservation output;
        |                     EconomicIndicatorObservations are qualified by category, not by the
        |                     cap-rate-specific qualification pipeline)
        v
  CREObservation /            Two parallel output shapes, deliberately never conflated — see
  EconomicIndicatorObservation file header of ingestion/types.ts.
        |
        v
  Historical Data Store      (out of scope to build in Phase 7 — each observation already carries
        |                     periodStart/periodEnd/retrievedAt/citation sufficient for a future
        |                     store to key on; no store was implemented)
        v
  Benchmark/Downstream Consumers (existing benchmark-selection.ts / benchmark-types.ts, unmodified)
```

Supported per Part 7: source versioning (via `RawSourceRecord.datasetId` +
`requestParams`), retrieval timestamp (`retrievedAt` on every record and
observation), publication date (`citation.publicationDate`), effective period
(`periodStart`/`periodEnd`), geographic scope (`CREGeography`), dataset
identifier (`datasetId`/`indicatorId`), source URL
(`citation.sourceUrl`/`profile.url`), citation/provenance (`CRECitation`),
raw-vs-normalized distinction (`RawSourceRecord` vs. the normalized output
types), validation status (`IngestionOutcome`'s `ok`/`gap`/`error` states),
refresh schedule (`CREPublicSourceProfile.refresh` + `updateFrequency`),
historical observations (adapters accept a date/period range and return one
observation per period), source failures (`SourceAdapterError` with a typed
`code`), schema changes (`SCHEMA_CHANGED` code, thrown rather than guessed
past).

No adapter was built for a paid/license-gated source; Phase 6's paid-source
interfaces (`CREPaidSourceProfile`) remain as contracts/classification only,
unconnected, per Part 7's explicit instruction.

## 13. Testing methodology

Every adapter has a fixture-based Jest suite
(`__tests__/cre-intelligence/ingestion/*.test.ts`) covering, per Part 14: valid
response, malformed response, missing fields, invalid geography, invalid
date/value handling, provenance preservation, observed-vs-derived
classification (`data-status-and-registry.test.ts`), source failure (network
error, rate limiting), empty result (mapped to a reason-coded gap), and
duplicate-record handling. All fetchers are injected function parameters —
no test performs a live HTTP request. Registry integrity tests confirm every
`CRE_PUBLIC_SOURCE_REGISTRY` entry carries a real `https://` evidence URL and
a verification date, that source IDs are unique, and that FRED/Census are
never classified as direct CRE benchmark sources.

**Full E68 suite result (this phase):** 29 test suites, 321 tests, all
passing (`npx jest` in `investscape-market-intelligence-engine`); `npx tsc
--noEmit` clean. No existing test was modified or weakened.

## 14. Phase 8 prerequisites

This phase deliberately stops short of building a monitoring system (Part
12). What it leaves in place for a future Phase 8:

- `CREPublicSourceProfile.refresh` already records expected update frequency,
  last-known publication period (where known), retrieval mechanism, and
  whether automated ingestion is judged safe per source — the exact inputs a
  scheduler would need.
- `SourceAdapterError`'s typed codes (`NETWORK_ERROR`, `RATE_LIMITED`,
  `SCHEMA_CHANGED`, etc.) are already the right shape for a monitoring system
  to alert on.
- The `SourceAdapter` contract is generic enough that BEA/BLS/CMHC/HUD/
  municipal adapters can be added without changing the pipeline.
- No scheduling, alerting, or automated-refresh code was written — that is
  explicitly Phase 8 scope.

## 15. Recommendations

1. Implement the BLS metro-level and BEA regional-GDP adapters next — both
   have documented, well-behaved APIs and would extend `EconomicIndicatorObservation`
   coverage without new architecture.
2. Before any production automated ingestion of FRED data, read
   `fred.stlouisfed.org/docs/api/terms_of_use.html` in full and record a
   specific commercial-use/redistribution determination (this phase flagged
   it `REQUIRES LICENSE REVIEW`, not resolved it).
3. Investigate each of the 10 Canadian and 5 U.S. priority cities'
   municipal open-data portals individually before assuming the
   Toronto/Austin pattern generalizes — several U.S. counties in particular
   gate permit/assessment data behind vendor portals (e.g. Miami-Dade,
   Harris County) with different terms than a city-run Socrata instance.
4. Do not attempt to derive a cap rate, vacancy rate, or construction
   cost-per-SF from any source in `CRE_PUBLIC_SOURCE_REGISTRY` — none of them
   publish one, and Part 6 of this spec (and Phase 4's history) forbids
   manufacturing one from adjacent statistics.
5. When a licensed CRE data source is eventually contracted (per the Phase 6
   tier recommendations), route its data through a new `SourceAdapter`
   implementation using this same pipeline rather than a bespoke path, so the
   raw-vs-normalized/validation/provenance guarantees apply uniformly.

---

### Citations (representative; full list in `public-source-registry.ts`)

- Statistics Canada Web Data Service — https://www.statcan.gc.ca/en/developers/wds
- Statistics Canada Open Licence — https://www.statcan.gc.ca/en/reference/licence
- Statistics Canada Table 18-10-0135-01 (BCPI) — https://www23.statcan.gc.ca/imdb-bmdi/pub/2317-eng.htm
- FRED API — https://fred.stlouisfed.org/docs/api/fred/
- FRED Terms of Use — https://fred.stlouisfed.org/docs/api/terms_of_use.html
- U.S. Census Bureau Developers — https://www.census.gov/data/developers/data-sets.html
- U.S. Census Bureau API Terms of Service — https://www.census.gov/data/developers/about/terms-of-service.html
- BEA API signup — https://apps.bea.gov/API/signup/
- BLS Developers — https://www.bls.gov/developers/
- HUD USER FMR API — https://www.huduser.gov/portal/dataset/fmr-api.html
- data.gov — https://www.data.gov/
- Government of Canada Open Data — https://open.canada.ca/en/open-data
- Open Government Licence – Canada — https://open.canada.ca/en/open-government-licence-canada
- CMHC Housing Market Data — https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-data/data-tables
- BC Assessment — https://www.bcassessment.ca/
- City of Toronto Open Data — https://open.toronto.ca/
- City of Austin Open Data — https://data.austintexas.gov/

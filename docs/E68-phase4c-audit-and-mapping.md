# E68 Phase 4C — Independent Audit, Benchmark Qualification, Application Mapping

Date **2026-09-11**. Implementation: `src/cre-intelligence/qualification.ts`,
`src/cre-intelligence/data/cap-rate-benchmark-mapping.ts`.
Tests: `__tests__/cre-intelligence/benchmark-qualification.test.ts`.

Phase 4C is a quality gate before Phase 5. **Nothing in this phase touches the
live application.** `CAP_RATE_BENCHMARKS` and `DEV_BUILDING_SUBTYPES` remain
untouched and unreached — they don't exist in this workspace (confirmed
absent, Phase 4).

## Part A — Independent data audit

### Methodology

Every one of the 88 observations (35 cap-rate + 53 construction-cost) was
re-verified against a **freshly re-fetched copy** of its source document —
not the cached extraction from Phase 4/4A/4B. For the two sources whose
numeric data lives in rendered chart graphics (RLB's $/SF table lines up as
text; Cushman & Wakefield's multifamily chart does not), the chart page was
re-rendered as an image with PyMuPDF and read again from scratch. Report
titles, publication dates and creation-date PDF metadata were re-pulled
independently rather than trusted from the first pass.

Structural checks (duplicates, date ordering, range sanity, license
consistency, `sourcesChecked` country-matching) were run as an automated scan
across every observation and every gap.

### Findings — 3 defects, all corrected

| # | File | Defect | Class | Correction |
| --- | --- | --- | --- | --- |
| 1 | `cap-rates-us.ts` | Miami's cap-rate gap listed `"colliers-ca-cap-rates"` — **Colliers Canada** — as a source checked against a Florida gap. Country mismatch; that source was never checked for Miami, and no equivalent US Colliers source is registered. | Fabricated/incorrect `sourcesChecked` claim | Removed the entry. No substitute added — none was actually checked. |
| 2 | `construction-costs-us.ts` | `publicationDate: "2026-06-24"` on all 53 observations. That is RLB's separately-published *"Central Q2 2026"* **regional** page's date, wrongly applied to the citation for the **North America** report actually being cited. The North America PDF's own metadata (re-confirmed on fresh fetch) gives creation/modification date **2026-07-07**, matching its filename (`..._7.7.2026.pdf`). | Incorrect publication date, affecting every observation in the file | Corrected to `2026-07-07` across all 53 observations (single shared `cite()` helper). |
| 3 | `construction-costs-us.ts` | Seattle's `construction_cost_change` was stored as **4.65%**, taken from RLB's *"West Q2 2026"* regional summary **text**, not computed from the table actually cited. The North America report's own index values (26,703 → 27,943) compute to **4.64%** (independently re-derived twice, both times to 4dp: 4.6437%). | 0.01pp transcription/source-selection error | Corrected to `4.64`. |

Per instruction, nothing was silently fixed — each defect is documented in the
source file itself (search for "PHASE 4C AUDIT CORRECTION") with the reasoning
above, before the value was changed.

### Everything independently re-verified and found correct

- All 28 RLB $/SF ranges (4 cities × 7 building types) — pixel/text-exact match
  on re-extraction.
- All 13 quarters of the National Construction Cost Index.
- Austin, Miami, Phoenix construction_cost_change percentages (Seattle's is
  the one correction above).
- All 8 Houston (Newmark) cap-rate ranges, the chart's footnote text verbatim,
  and the PDF's creation date.
- All 6 Kidder Mathews (Phoenix + Seattle) cap-rate values, both "Data Source:
  CoStar" credit lines, and both PDFs' creation dates.
- The Matthews Austin cap rate, publication date, and CoStar credit.
- All 20 Cushman & Wakefield Canada multifamily values (10 cities × High
  Rise/Low Rise) — re-rendered from a fresh PDF fetch and re-read pixel by
  pixel; identical to the first pass.
- RLB's Houston/multifamily/industrial absence claims — re-confirmed against
  the fresh table header (`OFFICES / RETAIL / HOTELS / HOSPITAL` only; no
  Houston row in the 18-city list).
- The Newmark "Corner 63" transaction-table quote used to justify "no
  `derived_transaction` cap rate possible" — re-confirmed verbatim, and
  re-confirmed the table carries no NOI column.
- Zero duplicate observations (exact-object and natural-key checks).
- Zero `retrievedAt` earlier than `publicationDate`.
- Zero low > high ranges.
- Zero observations carrying both `value` and a `low`/`high` range
  (the fabricated-midpoint guard).
- License/redistribution fields are internally consistent for all 20
  registered sources — no source is misclassified as `public` when it is
  actually `public_report`/`subscription`/`paid`.

### Result

| | Construction (53) | Cap rate (35) |
| --- | --- | --- |
| Passed unchanged | 49 | 34 |
| Corrected | 4* | 1 |
| Downgraded | 0 | 0 |
| Rejected | 0 | 0 |

\* The publication-date fix technically touches all 53 citations (one shared
helper), but only Seattle's percentage and the Miami `sourcesChecked` entry
represent independent, distinct errors — 3 root-cause defects total, one of
which (the date) propagated across many rows through shared code.

No fabricated provenance, PDF-extraction misalignment, wrong-city/wrong-asset-
class assignment, residential/commercial conflation, stale-report-as-current
treatment, or false "not found" claim was found beyond the three above.

## Part B — Benchmark qualification

### Design

`qualifyCapRateObservation(obs)` extends `mapping.ts`'s
exact/close/approximate/unsupported framework from *"does this classification
translate into the legacy vocabulary"* to *"is this specific observation fit
to back an application benchmark."* It evaluates:

| Axis | Mechanism | Can it produce `unsupported`? |
| --- | --- | --- |
| Geography, asset class, subtype, class (A/B/C), geography type | `mapToLegacyCapRateKey` (existing, unmodified) | **Yes** — the only axis that can |
| Time-period currency | ≤12mo exact, 12–24mo close, >24mo approximate | No — caps at `approximate` |
| Methodology caveat (e.g. Newmark's internal date contradiction) | Detected from the citation's own `methodologyNote` | No — caps at `approximate` |
| Cap-rate methodology family (survey/transaction/derived) | Surfaced as a warning | No — never downgrades |
| Source quality | Surfaced as a warning below 80 | No — never downgrades |
| Point vs. range | Surfaced as metadata (`valueShape`) | No — informational only |

**Overall confidence is the worst of the axes that can downgrade it — never an
average, never a numeric score.** A numeric average could let strong axes
compensate for a disqualifying one; a floor cannot. This directly satisfies
the instruction not to let a score turn an unsupported observation into a
usable one, and extends it further: no score turns a *merely stale* one into
something better than it earned, either.

### Why the "never" rules hold structurally, not just by convention

- **Never map between asset classes on city match alone** — the function reads
  the observation's own `assetClass`; there is no parameter that lets a caller
  ask "does this Houston multifamily observation work for Houston office."
  Proven adversarially: feeding synthetic `hotel`/`healthcare`/`data_center`
  observations through the pipeline returns `unsupported` every time,
  regardless of how good every other field is (source quality 99, a same-day
  period, transaction methodology — none of it matters, see
  `benchmark-qualification.test.ts`, *"no numerical score can turn unsupported
  into usable."*).
- **Never CBD-to-suburban, never Class A-to-B/C** — `propertyClass` and
  `locationType` pass through verbatim from the observation to the output;
  there is no code path that substitutes one for another. Tested directly.
- **Never multifamily-to-office/industrial/retail** — same mechanism as the
  first rule; multifamily's legacy key is always `"multifamily"`, and no other
  asset class's mapping function can produce that string.
- **Never a manufactured midpoint** — `valueShape` reports `"range"` whenever
  `low`/`high` are set and `value` is not; the existing fabricated-midpoint
  guard (Phase 4 test) already prevents an observation from carrying both.

### Worked example: Houston Class A Infill (the specification's own example)

> *"Houston Class A Infill Multifamily → exact/strong mapping."*

This is true and false in a way that is the entire point of separating
`baseConfidence` from `confidence`:

- **`baseConfidence: "exact"`** — the classification match genuinely is exact.
  City, asset class, property class and location type all translate cleanly.
- **`confidence: "approximate"`** — capped, because this specific observation
  carries a real, disclosed problem: its own chart footnote says *"updated
  December 2024"* while the block is labelled 2Q25 (an internal contradiction
  documented back in Phase 4A), and its period (2Q24 block: periodEnd
  2024-06-30) is more than 24 months old relative to this qualification.

This is not a contradiction in the system — it is the system doing exactly
what Part 2 of Phase 4C asked for: distinguishing *"is the classification
right"* from *"is this specific number ready to back a live benchmark."* A
classification-exact observation with a documented internal date
contradiction should not be silently treated as current, high-confidence data
— and now it isn't.

### Counts across the 35 real observations

| Confidence | Count | Why |
| --- | --- | --- |
| `exact` | 25 | Clean classification, current period, no caveat |
| `close` | 2 | Period 12–24 months old (Kidder's 2Q25 columns for Phoenix and Seattle) |
| `approximate` | 8 | All 8 Houston (Newmark) rows — capped by the documented date-contradiction caveat, and further by staleness for the 2Q24 block |
| `unsupported` | 0 | All 35 real observations are multifamily, which always resolves to the legacy `multifamily` key |

`unsupported: 0` is expected, not a gap in the check: Phase 4A/4B only sourced
multifamily cap rates, so the real dataset never exercises the
wrong-asset-class path. `benchmark-qualification.test.ts` proves that path
works using synthetic observations, and includes a canary test that will fail
the day a real non-multifamily cap-rate observation is added — a deliberate
prompt to re-examine this table rather than let it silently pass everything.

## Part C — Application mapping

`src/cre-intelligence/data/cap-rate-benchmark-mapping.ts` runs every one of
the 35 observations through `qualifyCapRateObservation` and produces
`CAP_RATE_BENCHMARK_MAPPING: readonly BenchmarkMappingRow[]`, one row per
observation:

```
observationId · sourceId/sourceName/reportTitle · country/city ·
sourceAssetClass/sourceSubtype/sourcePropertyClass/sourceLocationType ·
period · valueShape · mappedLegacyKey · qualification · baseQualification ·
mappingRationale · warnings[]
```

`observationId` is a deterministic string (`sourceId:country-city:assetClass:
subtype:periodStart`) — not a database key, just a stable label for this
table's rows, verified unique across all 35.

**The 35 source observations were not modified to make them map.** Every
value, citation and classification in `cap-rates-us.ts` and `cap-rates-ca.ts`
is exactly what Phase 4A/4B (plus the three Phase 4C corrections in Part A)
recorded. `benchmark-qualification.test.ts` includes a direct spot-check
re-confirming a source value after building the mapping table, to catch any
future edit that "fixes" a mapping by touching the underlying data.

### Application mapping counts

| Outcome | Count |
| --- | --- |
| Successfully mapped (`exact` or `close`) | 27 |
| Mapped with warning (`approximate` — surfaced, not auto-applied) | 8 |
| Unmapped (`unsupported`) | 0 |
| **Total** | **35** |

All 35 map to the single legacy key `multifamily` (see the canary note
above). None carry a Class A/B/C split in the *output* except Houston's four
rows, because `LEGACY_CLASS_SPLIT.multifamily = true` and only Houston's
observations carry a real class dimension — Phoenix/Seattle/Austin/all ten
Canadian cities are all-classes-blended averages, and each of those rows
carries an explicit warning saying so (`"Observation carries no Class A/B/C
split..."`), so a consumer cannot mistake a blended figure for a class-specific
one.

### What this table deliberately does NOT do

- It does not decide which observation the application should use for a given
  city/asset-class request when more than one exists (e.g. Kidder's three
  Phoenix quarters). That is a **Phase 5 concern** — matching a live request
  against the best-qualified available observation, possibly combined with
  `weightedConsensus()`.
- It does not write to or import from a WeWeb repository, because none is
  reachable from this workspace.
- It does not surface `approximate`-tier rows automatically to any consumer —
  `isAutoSurfaceable()` (existing, `mapping.ts`) still gates that, and only
  `exact`/`close` pass it.

## Part D — Data integrity summary

| Check | Result |
| --- | --- |
| Duplicate observations | 0 |
| Missing provenance | 0 |
| Invalid citations | 0 (after the 3 corrections above) |
| Unsupported transformations | 0 |
| Fabricated/unsupported values discovered | 0 — the 3 findings were transcription/attribution errors (wrong date, wrong 0.01pp source, wrong `sourcesChecked` entry), not invented data. No dollar figure, percentage, or range anywhere in the 88 observations was found to be fabricated. |

## Part E — Tests

- All pre-existing E68 tests (Phases 1–4B) continue to pass unchanged.
- New: `__tests__/cre-intelligence/benchmark-qualification.test.ts` — the
  "never" rules (adversarial, synthetic inputs), the floor-not-average
  confidence rule, the Houston worked example, the 35-row mapping table's
  structural properties, and a guard against the source data having been
  edited to ease mapping.
- **241 tests, 23 suites, all pass.** `tsc --noEmit` and `npm run lint` clean.

## Part F — Coverage and remaining gaps (unchanged from Phase 4B)

This phase performed no new source research and added no new observations —
it audited and structured what already existed. Coverage, gaps, and the
paid-source research table are unchanged from
`docs/E68-cap-rate-data-coverage.md` §§1–19. In particular:

- Miami still has zero cap-rate observations.
- Office, industrial and retail remain unsourced for every city, US and
  Canada.
- No `derived_transaction` cap rate exists (no source discloses NOI).
- CBRE Canada, Colliers Canada and Avison Young remain
  `FOUND_BUT_INACCESSIBLE` (bot-protected, not absent).

Phase 4C's job was to make sure what exists is real, correctly classified, and
honestly qualified before Phase 5 builds on it — not to grow the dataset.

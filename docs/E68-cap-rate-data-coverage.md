# E68 — Cap Rate Data Coverage (Phase 4A)

Research date **2026-09-10**. Implementation: `src/cre-intelligence/data/cap-rates-us.ts`.
Tests: `__tests__/cre-intelligence/cap-rate-provenance.test.ts`.

Phase 4 concluded there was no usable public cap-rate data. Phase 4A was asked
not to accept that, and the instruction was right: **four of the five priority
cities now have real, cited cap rates.** The Phase 4 conclusion was too quick —
it stopped at the CBRE landing page instead of looking for free brokerage PDFs.

## 1. Coverage matrix

Classification per cell: `FOUND_PUBLIC`, `FOUND_PAID`, `FOUND_BUT_INSUFFICIENT`,
`NOT_FOUND`, `NOT_APPLICABLE`. `NOT_CHECKED` is an honest addition — see §1.1.

| Source | Austin | Houston | Miami | Seattle | Phoenix |
| --- | --- | --- | --- | --- | --- |
| CBRE | FOUND_PAID | FOUND_PAID | FOUND_PAID | FOUND_PAID | FOUND_PAID |
| Colliers | FOUND_BUT_INSUFFICIENT | NOT_FOUND | NOT_FOUND | NOT_FOUND | NOT_FOUND |
| JLL | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED |
| Cushman & Wakefield | NOT_FOUND | NOT_FOUND | NOT_FOUND | NOT_FOUND | FOUND_BUT_INSUFFICIENT |
| Marcus & Millichap | FOUND_BUT_INSUFFICIENT | NOT_FOUND | NOT_FOUND | NOT_FOUND | NOT_FOUND |
| Newmark | NOT_FOUND | **FOUND_PUBLIC** | NOT_FOUND | NOT_FOUND | NOT_FOUND |
| Kidder Mathews | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | **FOUND_PUBLIC** | **FOUND_PUBLIC** |
| Matthews | **FOUND_PUBLIC** | NOT_FOUND | NOT_FOUND | NOT_FOUND | NOT_FOUND |
| Avison Young | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED | NOT_CHECKED |
| Altus | FOUND_PAID | FOUND_PAID | FOUND_PAID | FOUND_PAID | FOUND_PAID |
| MSCI / RCA | FOUND_PAID | FOUND_PAID | FOUND_PAID | FOUND_PAID | FOUND_PAID |
| CoStar | FOUND_PAID | FOUND_PAID | FOUND_PAID | FOUND_PAID | FOUND_PAID |
| RealPage | FOUND_PAID | FOUND_PAID | FOUND_PAID | FOUND_PAID | FOUND_PAID |
| MMG Real Estate Advisors | — | — | FOUND_BUT_INSUFFICIENT | — | — |

Kidder Mathews is `NOT_APPLICABLE` outside the West: it is a western-US firm and
publishes no Texas or Florida multifamily report. That is a coverage boundary,
not a failed search.

### 1.1 Honest limits of this audit

**JLL and Avison Young were not individually fetched.** Neither surfaced a free
city-level cap-rate document in searches, but that is weaker evidence than the
direct document checks behind every other row, and it would be wrong to record
them as `NOT_FOUND`. They remain the most likely place to find additional free
coverage and are the first recommended follow-up.

## 2. Verified cap-rate observations

**15 observations, 4 cities, 3 publishers, 4 source documents.**

Houston 8 · Phoenix 3 · Seattle 3 · Austin 1.
By concept: 9 `survey_estimate`, 6 `transaction`, 0 `derived_transaction`.

### Houston — 8 observations (survey estimate, ranges)

Newmark Houston Multifamily Market Report 2Q25, published 2025-08-05, page 40,
chart *"Newmark's Current Estimate of Houston Cap Rates"*.
[PDF](https://nmrk.imgix.net/uploads/fields/pdf-market-reports/2Q25-Houston-Multifamily-Market-Report.pdf)

| Class | 2Q 2024 | 2Q 2025 |
| --- | --- | --- |
| Class A Infill | 4.75 – 5.25% | 4.75 – 5.25% |
| Class A Suburban | 4.75 – 5.25% | 4.75 – 5.50% |
| Class B | 5.25 – 5.75% | 5.50 – 6.25% |
| Class C | 5.50 – 6.00% | 6.50 – 7.00% |

This is the only free source found with a genuine **class split** and an
infill/suburban geography split — exactly the granularity the application's
`CAP_RATE_BENCHMARKS` layer wants.

Two things recorded rather than resolved:

- **Date contradiction.** The chart footnote reads *"SOURCE: Newmark, updated
  December 2024"*, yet the block is labelled *2Q25* and the PDF was created
  2025-08-05. A December 2024 update cannot contain April–June 2025 data. E68
  stores the period exactly as the publisher labels it and carries the
  contradiction in `methodologyNote`. `sourceQuality` is set to 75, below the
  other cap-rate sources, for this reason.
- **"Market Peak" block not stored.** The same chart carries a third block of
  peak-cycle cap rates. "Market peak" names no period, and an observation
  without a period cannot meet the citation standard.

### Phoenix and Seattle — 6 observations (transaction averages, point estimates)

Kidder Mathews Multifamily Market Trends, 2Q 2026. Table *"Market Breakdown"*,
row *"Average Cap Rate"*. Data source credited in both PDFs: **CoStar**.

| City | 2Q 2026 | 1Q 2026 | 2Q 2025 | Published | PDF |
| --- | --- | --- | --- | --- | --- |
| Phoenix | 5.8% | 6.2% | 6.6% | 2026-07-09 | [link](https://kidder.com/wp-content/uploads/market_report/multifamily-market-research-phoenix-2026-2q.pdf) |
| Seattle | 5.7% | 5.6% | 5.6% | 2026-07-10 | [link](https://kidder.com/wp-content/uploads/market_report/multifamily-market-research-seattle-2026-2q.pdf) |

Publication dates were read from each PDF's own XMP metadata, not inferred.

### Austin — 1 observation (survey estimate, point estimate)

Matthews Austin, TX Multifamily Market Report Q1 2026, published 2026-05-08,
section *"By the Numbers"*: market cap rate **5.7%**. Credited to CoStar.

Filed as a survey estimate, not a transaction cap rate: the publisher's wording
is *"market cap rate"*, a modelled market-wide figure rather than a stated
average of closed sales.

### The two families never mix

Kidder's figures are computed from actual sales (`transaction`); Newmark's and
Matthews' are publisher estimates (`survey_estimate`).
`assertComparableCapRates()` throws if a consensus call spans them, so **there
is no valid Austin-vs-Phoenix comparison in this dataset** without first
choosing a family. A test enforces it.

## 3. Sources behind paywalls

| Source | What exists | Why unusable |
| --- | --- | --- |
| CBRE U.S. Cap Rate Survey H1 2026 | 3,600 estimates across 50+ markets, by sector, class and stabilized/value-add — exactly what E68 wants | Every market-level table is behind "Download the Full Report". The public page carries only directional commentary. Published 2026-08-12. |
| CoStar | The underlying dataset for the Kidder and Matthews figures | Subscription. E68 stores the brokerages' published figures with CoStar recorded as `underlyingDataProvider`; it does not access CoStar. |
| MSCI / RCA | Transaction-derived cap rates, the top of the source hierarchy | Subscription. |
| Altus | Valuation and cost intelligence | Subscription. |
| RealPage | Multifamily analytics | Subscription. |

## 4. Sources investigated and rejected, with reasons

| Source | Reason |
| --- | --- |
| CBRE *Multifamily Underwriting Metrics Improve in Q2* | Checked directly. National averages only (going-in 4.75%, exit 4.96%). Its Figure 4 is by-market but carries **rent growth and IRR targets, not cap rates**. |
| CBRE *Q2 2026 US Multifamily Figures* | Checked directly. No cap rate at any geographic level. |
| Newmark *Austin Multifamily Snapshot 3Q25* | Checked directly. No cap rate. |
| Newmark national *U.S. Multifamily Capital Markets Report* | National only; no metro cap-rate table. |
| Colliers Austin Multifamily Q1 2026 | Page returned **HTTP 403** to automated retrieval. Could not be verified, so nothing was taken from it. |
| Marcus & Millichap Austin multifamily | Market-report service returned *"search service is currently unavailable"*. |
| Cushman & Wakefield Phoenix MarketBeat | Report exists (dated 2026-08-17) but the accessible page shows no cap-rate figure. |
| MMG Real Estate Advisors Miami Q2 2026 | Checked directly. Publishes rent, occupancy, absorption, pipeline — **no cap rate**. |
| apartmentloanstore.com, realcostiq.com, miamirealgroup.com, gabrielmoyers.com, serhantfloridacommercialgroup.com, natanjacobs.com, miamifinancereview.com | Lender blogs, cap-rate calculator sites and agent marketing pages. Excluded by rule: not primary sources, no report title, no period, no method. |
| Search-result snippets | Excluded by rule. Every figure in §2 was read from the source document itself. |

## 5. Remaining gaps

- **Miami — every asset class.** The only priority city with no cap rate at all.
- **Office, industrial and retail — all five cities.** The free brokerage reports
  that publish cap rates are multifamily reports. Their office and industrial
  counterparts publish vacancy, absorption and asking rent, but not yield.
- **Class A/B splits outside Houston.** Phoenix, Seattle and Austin publish a
  single market-wide average. No class dimension can be produced for them
  without inventing it.
- **CBD vs suburban outside Houston.** Same reason.
- **No `derived_transaction` cap rates.** See §6.

All of these are recorded as `CREDataGap` entries in code, not just here.

## 6. Transaction-derived cap rates: investigated, none possible

Part 3 asked whether public transaction records could yield `NOI / price`.

The brokerage reports **do** publish transaction tables. Kidder's Seattle report,
for example, lists individual sales: *Corner 63, Roosevelt, 139 units,
$59,250,000, $426,259 per unit*. Price, unit count and buyer/seller are all
disclosed.

**NOI is not.** Without a disclosed NOI there is no cap rate to compute, and
estimating NOI from unit counts and market rents would be precisely the
fabrication this phase exists to prevent. No derived observation was created.

The schema is nonetheless in place: `CREDerivedTransaction` requires property,
date, price, price source, NOI, NOI source and methodology, and a test asserts
that any future derived observation carries all seven and is never averaged with
survey or transaction figures.

## 7. Houston construction research

Phase 4 recorded Houston as absent from RLB. Phase 4A checked a second
specialised consultancy and **independently confirmed it**.

**Turner & Townsend, Global Construction Market Intelligence 2026 (17th edition)**
covers these US cities: New York ($738.0/ft²), San Francisco ($733.0/ft²),
Charlotte ($417.0/ft²), Atlanta ($410.0/ft²), Austin ($391.0/ft²), Dallas
($386.0/ft²), Phoenix ($363.0/ft²), Denver. **Houston is not among them.**

Two independent specialist consultancies, neither covering Houston, is a much
stronger finding than one. Existing RLB observations were not modified.

**The T&T figures were NOT recorded**, despite covering Austin and Phoenix. The
accessible report page states no building type, no basis, and no hard-versus-
total-cost definition for those $/ft² numbers. Without knowing what they measure
they cannot be assigned an `assetClass` or compared with RLB's figures, and
guessing would defeat the purpose. Classified `FOUND_BUT_INSUFFICIENT`.

Houston $/SF figures do circulate on contractor and construction-manager
marketing sites ($190–$330/SF, $240–$380/SF). These are sales collateral with no
methodology and were rejected.

## 8. Legacy E30 audit — complete

Scope: every city record in `investscape-economic-engine/src/E30-city-market-analysis.ts`.

**29 city records. 19 cite FRED and/or Zillow. 12 of those carried non-null
cap rates. All 12 are now null.**

For each: the cited source was checked against what that publisher actually
produces. FRED publishes interest rates and housing statistics; Zillow publishes
residential ZHVI/ZORI; Redfin publishes residential market tracker data. **None
publishes a commercial cap rate.** No underlying report exists, so there was no
period or methodology to verify — the provenance failed at step 4 of the audit
for all 12 records identically.

### 8.1 Records removed

| City | Removed p25 / p50 / p75 | Phase |
| --- | --- | --- |
| `miami-fl` | 5.2 / 5.9 / 6.7 | 4 |
| `seattle-wa` | 4.3 / 4.9 / 5.6 | 4 |
| `boston-ma` | 4.2 / 4.8 / 5.5 | 4A |
| `new-york-ny` | 3.9 / 4.5 / 5.2 | 4A |
| `philadelphia-pa` | 5.1 / 5.8 / 6.5 | 4A |
| `chicago-il` | 5.8 / 6.5 / 7.2 | 4A |
| `minneapolis-mn` | 5.5 / 6.2 / 6.9 | 4A |
| `atlanta-ga` | 5.9 / 6.6 / 7.4 | 4A |
| `nashville-tn` | 6.1 / 6.8 / 7.5 | 4A |
| `los-angeles-ca` | 4.1 / 4.8 / 5.5 | 4A |
| `san-francisco-ca` | 3.2 / 3.9 / 4.6 | 4A |
| `denver-co` | 5.2 / 5.9 / 6.6 | 4A |

Historical context was **not** deleted. Each record carries an in-file comment
naming the removed values, the provenance failure, the sources searched for a
replacement, and a pointer to this document.

`houston-tx`, `austin-tx`, `phoenix-az`, `dallas-tx`, `san-antonio-tx`,
`tucson-az` and `yellowknife-nt` were already null from earlier corrections.

### 8.2 Records retained

**No US record retains a cap rate.** E68 found real Houston, Seattle, Phoenix and
Austin figures, but they are *not* written back into E30 — see §9.

### 8.3 ⚠️ Out of scope but flagged: the 10 Canadian records

Part 7 scoped this audit to FRED/Zillow. After it, the **only** non-null cap
rates left in E30 are ten Canadian cities, all tagged `CREA, CMHC`:

`halifax-ns` 5.2 · `st-johns-nl` 5.5 · `toronto-on` 4.6 · `montreal-qc` 4.9 ·
`ottawa-on` 5.0 · `calgary-ab` 5.8 · `edmonton-ab` 5.9 · `winnipeg-mb` 6.2 ·
`vancouver-bc` 4.3 · `victoria-bc` 4.5

**CREA publishes residential MLS statistics and CMHC publishes housing data.
Neither publishes a commercial cap rate.** Structurally this is the same
provenance failure as `FRED, Zillow`. These were left untouched because they
were outside the stated scope, but they should be audited next. CBRE Canada and
Colliers Canada both publish free Canadian cap-rate reports, so unlike the US
records these may be genuinely replaceable rather than simply removable.

## 9. Lineage: E68 does not overwrite E30

Per Part 8, E68 observations and legacy E30 values are kept separate:

- E68 (`data/cap-rates-us.ts`) is the authoritative, cited source layer.
- E30 city records keep their own history, including nulled values and the
  comment explaining each removal.
- Nothing from E68 is written back into E30. Seattle is the clearest case: E30's
  Seattle cap rate is `null` because *its* provenance failed, while E68 now
  carries a real Seattle figure from Kidder Mathews. Both states are true and
  both are auditable.

A numeric coincidence worth knowing about: the discredited Seattle p75 was
**5.6%**, and Kidder's genuine Seattle figure for 1Q26 and 2Q25 is also **5.6%**.
The tests therefore check the *percentile triple* and the *provenance*, not bare
numbers — a single value collision proves nothing either way.

## 10. Licence classification (Part 9)

Every registry entry now carries an explicit `license` of `public`,
`public_report`, `public_api`, `paid`, `subscription`, `proprietary` or
`user_supplied`.

`isRedistributable()` requires **all** of: `sourceType: "government"`,
`access: "public_data"`, `redistribution: "public_data_terms"`, and
`license: "public"`. Everything else — including every free brokerage PDF this
phase relied on — is not redistributable. A page being viewable is never the
basis for a classification.

## 11. Recommended licensed data sources

In priority order, if the gaps in §5 matter commercially:

1. **CBRE U.S. Cap Rate Survey** — the single highest-value acquisition. One
   licence closes office, industrial, retail *and* multifamily across all five
   cities, with class and CBD/suburban splits and an explicit stabilized versus
   value-add distinction. Everything E68 wants, already structured.
2. **CoStar** — already the de-facto source under three of the four cities
   here, via brokerage republication. A licence would remove the dependency on
   whichever brokerage happens to publish a free quarterly PDF, and would open
   Miami.
3. **MSCI / RCA** — transaction-derived, the top of the source hierarchy, and
   the only realistic route to genuine `derived_transaction` observations.
4. **Altus** — most valuable if Canadian coverage becomes a priority alongside
   the §8.3 audit.

Before buying anything: **check JLL and Avison Young** (§1.1). They are free and
were not individually verified.

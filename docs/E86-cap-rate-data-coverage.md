# E86 — Cap Rate Data Coverage (Phase 4A)

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
  2025-08-05. A December 2024 update cannot contain April–June 2025 data. E86
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
| CBRE U.S. Cap Rate Survey H1 2026 | 3,600 estimates across 50+ markets, by sector, class and stabilized/value-add — exactly what E86 wants | Every market-level table is behind "Download the Full Report". The public page carries only directional commentary. Published 2026-08-12. |
| CoStar | The underlying dataset for the Kidder and Matthews figures | Subscription. E86 stores the brokerages' published figures with CoStar recorded as `underlyingDataProvider`; it does not access CoStar. |
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

**No US record retains a cap rate.** E86 found real Houston, Seattle, Phoenix and
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

## 9. Lineage: E86 does not overwrite E30

Per Part 8, E86 observations and legacy E30 values are kept separate:

- E86 (`data/cap-rates-us.ts`) is the authoritative, cited source layer.
- E30 city records keep their own history, including nulled values and the
  comment explaining each removal.
- Nothing from E86 is written back into E30. Seattle is the clearest case: E30's
  Seattle cap rate is `null` because *its* provenance failed, while E86 now
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
   value-add distinction. Everything E86 wants, already structured.
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

---

# Phase 4B — Canada, Legacy Provenance Completion, JLL/Avison Young

Research date **2026-09-11**. Adds `src/cre-intelligence/data/cap-rates-ca.ts`.
Tests: `__tests__/cre-intelligence/canadian-cap-rates.test.ts`.

## 12. United States — status unchanged, JLL/Avison Young now checked

The 15 US observations from Phase 4A are unchanged (no transcription error was
found). Phase 4B's mandate for the US was Parts 5–7: check JLL and Avison
Young directly, keep searching for Miami, and confirm the legacy audit was
exhaustive.

**JLL** — checked directly (`jll.com/en-us/insights`). No city-level cap-rate
report for any priority city; the current featured research is global-trends
and AI-focused. Classification: `NOT_FOUND` (a real search was performed, not
assumed).

**Avison Young** — `avisonyoung.us` returned HTTP 403 to every direct fetch
attempted (the market-overview page, the multifamily-overview page). This is
the same Cloudflare-class bot barrier documented for CBRE Canada and Colliers
Canada in §13, not a failed search. Their Q1/Q3 2025 US multifamily reports
were located by search but the report pages themselves were equally
inaccessible. Classification: `FOUND_BUT_INACCESSIBLE`.

**Miami** — no new source found. Every additional search surfaced the same
class of blog/calculator content already rejected in Phase 4A. Still zero
observations.

Updated coverage matrix cells (only changed rows shown; §1's table is otherwise
unchanged):

| Source | Austin | Houston | Miami | Seattle | Phoenix |
| --- | --- | --- | --- | --- | --- |
| JLL | NOT_FOUND | NOT_FOUND | NOT_FOUND | NOT_FOUND | NOT_FOUND |
| Avison Young | FOUND_BUT_INACCESSIBLE | FOUND_BUT_INACCESSIBLE | FOUND_BUT_INACCESSIBLE | FOUND_BUT_INACCESSIBLE | FOUND_BUT_INACCESSIBLE |

## 13. Canada — new verified observations

**20 observations, 10 cities, 1 publisher, 1 document.**

Source: **Cushman & Wakefield, Canadian Cap Rate & Capital Markets Report,
Q2 2026**, published 2026-07-28 (from the PDF's own XMP metadata), retrieved
2026-09-11.
[Direct PDF](https://content.cushmanwakefield.com/api/public/content/cef23b874a284c1caa8547cf3132048d?v=d321917a)

### Why this is the only usable free Canadian source

| Source | Result |
| --- | --- |
| **Cushman & Wakefield Canada** | The PDF downloaded successfully. `pdftotext` could not extract the numeric cap-rate charts — the labels are vector graphics, not text. The report's Multifamily page (page 12) prints a numeric label on every data point; its Industrial, Retail and Office pages are unlabeled national historical trend lines. Rendered page 12 as a 150-DPI image (via PyMuPDF, installed this session) and transcribed the visible labels directly. |
| **CBRE Canada** *Cap Rates & Investment Insights Q2 2026* | Confirmed to exist and to cover the right cities (search summaries describe local-market tables for Victoria, Vancouver, Calgary, Edmonton, Saskatoon, Winnipeg, Toronto, Ottawa, Montreal, Quebec City, Halifax). **Every retrieval attempt failed**: `cbre.ca` returns HTTP 403 with `Cf-Mitigated: challenge` (confirmed via direct `curl -I`, not just WebFetch) — a Cloudflare bot-challenge, not a paywall. Two PDF URLs surfaced by search resolved to **stale archived documents** (Q2 2023 and Q3 2023 editions of the same report), which were rejected outright rather than used. Classification: `FOUND_BUT_INACCESSIBLE`. |
| **Colliers Canada** *Canada Cap Rate Report Q2 2026* | Same outcome: `collierscanada.com` returns HTTP 403 with the identical Cloudflare challenge header. `FOUND_BUT_INACCESSIBLE`. |
| **Avison Young Canada** | `avisonyoung.ca` returns HTTP 403. `FOUND_BUT_INACCESSIBLE`. |

This distinction matters: `FOUND_BUT_INACCESSIBLE` (confirmed to exist, blocked
by bot-protection) is not the same finding as `NOT_FOUND` (searched, nothing
exists) or `FOUND_PAID` (a real paywall). All three CBRE/Colliers/Avison Young
Canada rows are the middle case — genuine data likely sits behind an automated
scraping defense, not a subscription.

### What was recorded

Multifamily only, split High Rise / Low Rise, as printed:

| City | High Rise (Min–Max) | Low Rise (Min–Max) |
| --- | --- | --- |
| Victoria | 4.50 – 5.25% | 4.25 – 5.50% |
| Vancouver | 3.50 – 4.50% | 3.75 – 4.75% |
| Calgary | 4.75 – 5.50% | 4.75 – 5.50% |
| Edmonton | 4.25 – 5.25% | 5.00 – 6.00% |
| Winnipeg | 4.75 – 5.50% | 5.00 – 5.75% |
| Kitchener/Waterloo | 5.00 – 5.50% | 4.50 – 5.25% |
| Toronto | 4.25 – 5.00% | 4.00 – 4.75% |
| Ottawa | 5.00 – 6.00% | 5.00 – 6.00% |
| Montreal | 4.25 – 5.25% | 4.75 – 5.75% |
| Halifax | 4.50 – 5.50% | 5.00 – 6.00% |

Filed as `survey_estimate`: the report's own methodology note reads
*"quarterly estimates of capitalization rates... based on our market
expertise. The cap rate ranges are based on transaction data where possible,
as well as demand and supply dynamics in the region."* That is a synthesized
estimate, not a stated average of closed transactions — the same distinction
Phase 4A drew between Matthews and Kidder in the US.

**St. John's is not covered** — absent from this report and from every other
Canadian source checked. Recorded as a gap, same pattern as Yellowknife
elsewhere in E30.

**Office, industrial and retail are not covered** for any Canadian city. The
report's charts for those sectors are national, unlabeled historical trend
lines (see the rendered images captured this session) — reading a number off a
curve with no printed value would be estimation, which this phase exists to
prevent. Recorded as 30 gaps (10 cities × 3 asset classes).

### `sourceQuality`: 88, and why

Below the 90–95 range used for text-extracted brokerage figures, because these
values were read from a rendered chart image rather than machine-extracted
text. The labels themselves are unambiguous (each data point prints its exact
percentage), but the read is manual-visual rather than programmatic, and that
distinction is preserved in the score rather than smoothed over.

## 14. Legacy E30 audit — now complete across the entire file

**Every** city record in `investscape-economic-engine/src/E30-city-market-analysis.ts`
has been checked. Combined with Phase 4A:

| Phase | Records checked | Invalid found | Nulled |
| --- | --- | --- | --- |
| 4A (2026-09-10) | 19 (FRED/Zillow-tagged) | 12 | 12 |
| 4B (2026-09-11) | 10 (CREA/CMHC-tagged) | 10 | 10 |
| **Total** | **29 of 29 city records** | **22** | **22** |

**Zero city records in E30 now carry a cap rate without either (a) legitimate
provenance or (b) an explicit null with a documented reason.** No further
FRED/Zillow/CREA/CMHC-tagged cap rate exists anywhere in the file.

### Canadian audit method (Part 1)

For each of the ten Canadian cities:

1. **Git history.** `git log --follow` on `E30-city-market-analysis.ts` traces
   every cap-rate value to a single origin: commit `5b62655`, *"[E30]
   City-Level Market Analysis + 40 comprehensive tests"* (2026-08-05). No later
   commit touched these ten values.
2. **The file's own header**, unchanged since that commit, states: *"Mock data
   store for E30... we use fixtures representing realistic Aug 4, 2026 market
   conditions"* — and separately documents CREA as a source for *"Canada
   comps"* and CMHC for *"Canada rental,"* never for cap rate.
3. **CREA** publishes residential MLS statistics (HPI, sales, listings).
   **CMHC** publishes housing starts, rental vacancy and rent data. Neither
   organization publishes a commercial capitalization rate. Confirmed against
   each organization's own published scope, the same check applied to
   FRED/Zillow in Phase 4A.
4. **No underlying report exists to verify** — steps 4–7 of the audit (locate
   the report, verify period, verify methodology) are moot once step 2–3
   establish there was never a cited report in the first place.
5. **Checked against the real replacement**, not assumed fabricated: every
   legacy value was compared against Cushman & Wakefield's genuine Q2 2026
   ranges (§13). Two touch a range boundary by coincidence (Ottawa 5.0,
   Victoria 4.5); **Calgary (5.8) and Winnipeg (6.2) fall entirely outside
   both the High Rise and Low Rise ranges** — positive proof these were never
   derived from real market data, consistent with the "Mock data store"
   label.

Classification for all ten: **`UNSUPPORTED`**. Set to null.

### 14.1 Records removed (Phase 4B)

| City | Removed p50 | vs. C&W High Rise | vs. C&W Low Rise |
| --- | --- | --- | --- |
| `halifax-ns` | 5.2 | in range | in range |
| `st-johns-nl` | 5.5 | no C&W coverage | no C&W coverage |
| `toronto-on` | 4.6 | in range | in range |
| `montreal-qc` | 4.9 | in range | in range |
| `ottawa-on` | 5.0 | touches min | touches min |
| `calgary-ab` | 5.8 | **outside range** | **outside range** |
| `edmonton-ab` | 5.9 | outside range | in range |
| `winnipeg-mb` | 6.2 | **outside range** | **outside range** |
| `vancouver-bc` | 4.3 | in range | in range |
| `victoria-bc` | 4.5 | touches min | in range |

Historical context preserved, not deleted: each record's in-file comment names
the removed value, the provenance failure, the git-history trace, the
comparison against the real replacement, and a pointer to this document. E86's
real Toronto/Vancouver/etc. figures are **not** written back into E30 — see §9
(lineage rule), unchanged from Phase 4A.

### 14.2 Records retained (Canada)

None. All ten were unsupported.

## 15. Master coverage table

Every asset-class/city cell E86 has touched, US and Canada, with status.
`VERIFIED` = a real E86 observation exists; `GAP` = absence recorded with a
reason; blank = not yet investigated for that specific cell (see §5/§13 for
which sub-combinations were checked).

| City | Asset Class | Source | Period | Cap Rate | Status | Quality |
| --- | --- | --- | --- | --- | --- | --- |
| Houston, TX | Multifamily — Class A Infill | Newmark | 2Q25 | 4.75–5.25% | VERIFIED | 75 |
| Houston, TX | Multifamily — Class A Suburban | Newmark | 2Q25 | 4.75–5.50% | VERIFIED | 75 |
| Houston, TX | Multifamily — Class B | Newmark | 2Q25 | 5.50–6.25% | VERIFIED | 75 |
| Houston, TX | Multifamily — Class C | Newmark | 2Q25 | 6.50–7.00% | VERIFIED | 75 |
| Phoenix, AZ | Multifamily (avg.) | Kidder Mathews | 2Q26 | 5.8% | VERIFIED | 90 |
| Seattle, WA | Multifamily (avg.) | Kidder Mathews | 2Q26 | 5.7% | VERIFIED | 90 |
| Austin, TX | Multifamily (avg.) | Matthews | Q1 2026 | 5.7% | VERIFIED | 85 |
| Miami, FL | Multifamily | — | — | — | GAP | — |
| Austin / Houston / Miami / Seattle / Phoenix | Office, Industrial, Retail | — | — | — | GAP | — |
| Toronto, ON | Multifamily — High Rise | Cushman & Wakefield Canada | Q2 2026 | 4.25–5.00% | VERIFIED | 88 |
| Toronto, ON | Multifamily — Low Rise | Cushman & Wakefield Canada | Q2 2026 | 4.00–4.75% | VERIFIED | 88 |
| Vancouver, BC | Multifamily — High/Low Rise | Cushman & Wakefield Canada | Q2 2026 | 3.50–4.50% / 3.75–4.75% | VERIFIED | 88 |
| Calgary, AB | Multifamily — High/Low Rise | Cushman & Wakefield Canada | Q2 2026 | 4.75–5.50% / 4.75–5.50% | VERIFIED | 88 |
| Edmonton, AB | Multifamily — High/Low Rise | Cushman & Wakefield Canada | Q2 2026 | 4.25–5.25% / 5.00–6.00% | VERIFIED | 88 |
| Winnipeg, MB | Multifamily — High/Low Rise | Cushman & Wakefield Canada | Q2 2026 | 4.75–5.50% / 5.00–5.75% | VERIFIED | 88 |
| Kitchener/Waterloo, ON | Multifamily — High/Low Rise | Cushman & Wakefield Canada | Q2 2026 | 5.00–5.50% / 4.50–5.25% | VERIFIED | 88 |
| Ottawa, ON | Multifamily — High/Low Rise | Cushman & Wakefield Canada | Q2 2026 | 5.00–6.00% / 5.00–6.00% | VERIFIED | 88 |
| Montreal, QC | Multifamily — High/Low Rise | Cushman & Wakefield Canada | Q2 2026 | 4.25–5.25% / 4.75–5.75% | VERIFIED | 88 |
| Halifax, NS | Multifamily — High/Low Rise | Cushman & Wakefield Canada | Q2 2026 | 4.50–5.50% / 5.00–6.00% | VERIFIED | 88 |
| St. John's, NL | Multifamily | — | — | — | GAP | — |
| Toronto / Vancouver / etc. (all 10) | Office, Industrial, Retail | — | — | — | GAP | — |

**Absence in this table means E86 has not found a sufficiently documented
public observation for that cell — not that the market has no cap-rate
data.** CBRE (US and Canada), Colliers Canada and Avison Young all almost
certainly have it; it was confirmed unreachable by this phase's tooling, not
confirmed nonexistent.

## 16. Source availability summary

| Category | Sources |
| --- | --- |
| **Retrieved and used** | Newmark (US), Kidder Mathews (US), Matthews (US), Cushman & Wakefield (Canada) |
| **Confirmed to exist, blocked by bot-protection** (`FOUND_BUT_INACCESSIBLE`) | CBRE Canada, Colliers Canada, Avison Young (US and Canada) |
| **Confirmed to exist, paywalled** (`FOUND_PAID`) | CBRE US Cap Rate Survey, CoStar, MSCI/RCA, Altus, RealPage |
| **Checked, no city-level cap rate found** (`NOT_FOUND`) | JLL (US), Marcus & Millichap (Austin), several C&W city pages |
| **Not applicable** | Kidder Mathews outside the western US |

## 17. Remaining gaps (complete list)

- Miami — every asset class (US).
- Office, industrial, retail — all five US priority cities.
- Office, industrial, retail — all ten Canadian cities.
- St. John's, NL — every asset class.
- Class A/B/C splits — present only for Houston (US) and absent everywhere in
  Canada; C&W's Canadian chart has no class dimension at all.
- CBD/suburban splits — present only for Houston (US, via infill/suburban);
  absent everywhere in Canada.
- Derived transaction cap rates — none; no source discloses NOI (§6 of the
  Phase 4A section).
- CBRE Canada, Colliers Canada, Avison Young (both countries) — real data
  believed to exist, blocked by automated bot-protection rather than absent.
  The next practical step is manual retrieval by a human user, not further
  automated searching.

## 18. Paid-source research table (Part 13 — not purchased, not integrated)

| Source | Coverage | Asset classes | Geographies | Historical depth | API | Access model | Licensing | Incremental value here |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **CBRE Cap Rate Survey** | 50+ US markets per survey (H1/H2); Canada separately via CBRE Canada | Office, industrial, retail, multifamily, hotel, seniors housing; stabilized vs. value-add | US and Canada | Survey published semiannually (US) / quarterly (Canada); historical archive not publicly documented | None documented publicly | Full report gated behind an account/download on cbre.com | Subscription/account-gated, terms not published | Closes office/industrial/retail everywhere, adds class + CBD/suburban splits, resolves the stabilized-vs-value-add distinction Phase 4A had to work around |
| **CoStar** | US-wide, property- and market-level, the de-facto source under 3 of the 4 US brokerage figures already in this dataset | All commercial classes | Primarily US | Extensive (decades) | **No public API** — CoStar's Terms of Use explicitly prohibit automated extraction/scraping; no self-serve API exists (confirmed via search, 2026-09-11) | Enterprise subscription, sales-negotiated | Proprietary, redistribution prohibited | Would replace dependency on whichever brokerage happens to publish a free quarterly PDF; opens Miami directly |
| **MSCI / Real Capital Analytics** | Global, transaction-level | All commercial classes | US, Canada, global | Long-running transaction database | Yes — MSCI documents API/data-delivery products including a Snowflake integration for direct data-warehouse ingestion | Subscription, enterprise-negotiated | Proprietary | Top of E86's own source hierarchy (transaction-derived evidence ranks first); the only realistic route to genuine `derived_transaction` observations, since RCA discloses transaction price and often NOI-adjacent data |
| **Altus Group** (incl. Reonomy, acquired July 2026) | Canada-focused valuation/cost intelligence, expanding US property data via Reonomy | Cap rates, hard/soft cost, construction index | Canada primary, US via Reonomy | Not publicly documented | Reonomy offers API access for enterprise ingestion (per Altus product pages) | Subscription | Proprietary | Most valuable for closing the Canadian office/industrial/retail gap this phase left open, and for construction-cost depth in Canada |
| **RealPage** | US multifamily-focused market analytics | Multifamily only | US | Not publicly documented | Not confirmed publicly documented for cap-rate data specifically | Subscription | Proprietary | Narrowest of the five; only adds value if multifamily depth (vs. breadth into other asset classes) becomes the priority |

No prices are stated anywhere above — none were found publicly documented, and
none were guessed.

## 19. What this phase did not do

- Did not implement any paid API integration.
- Did not estimate a value for any city/asset-class combination lacking a
  source.
- Did not write E86's real figures back into E30's legacy records.
- Did not attempt to defeat CBRE Canada's, Colliers Canada's, or Avison
  Young's bot-protection (no headless browser, no proxy rotation, no
  credential use) — `FOUND_BUT_INACCESSIBLE` is reported honestly rather than
  circumvented.

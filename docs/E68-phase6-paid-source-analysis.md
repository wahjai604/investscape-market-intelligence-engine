# E68 Phase 6 — Paid/Commercial CRE Data Source Analysis (Research Only)

Research date **2026-09-11**. This phase is **analysis only**: no purchases, accounts,
sales contacts, payments, contracts, scraping, or paywall/bot-protection bypass were
performed. No Phase 5 architecture or code was modified. No paid-source adapters were
implemented. All claims below carry a source URL and the date it was checked (2026-09-11
for all sources checked in this phase, unless noted). Where public pricing/licensing
terms could not be found, this document says so explicitly rather than guessing:
`PRICING NOT PUBLIC — SALES QUOTE REQUIRED`.

This document builds on, and does not duplicate the primary research already recorded in:
- `E68-cap-rate-data-coverage.md` (§18, §11) — CBRE, CoStar, MSCI/RCA, Altus, RealPage already
  researched there in detail; Phase 6 references those findings and extends to the remaining
  named sources plus construction-cost specialists and automation/licensing classification.
- `e68-source-registry.md` — existing registry entries and redistribution policy.

---

## PART 1 — Paid-source matrix

Legend: `Y` = confirmed with evidence, `N` = confirmed absent/not found, `U` = unknown /
not publicly documented, `PNP` = PRICING NOT PUBLIC — SALES QUOTE REQUIRED.

| Source | Publisher | Product | Canada | US | Asset classes | Cap rates | Transactions | NOI | Construction cost | API | Bulk export | Redistribution | Pricing | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CBRE | CBRE | U.S. Cap Rate Survey / Canada Cap Rates & Investment Insights | Y | Y | Office, industrial, retail, multifamily, hotel, seniors housing | Y (survey estimates) | N (survey, not transaction ledger) | N | N (not a construction-cost product) | U — none documented | U | Report gated, terms not published | PNP | cbre.com/insights (checked 2026-09-10/11, see E68-cap-rate-data-coverage.md §3, §18) |
| CoStar | CoStar Group | CoStar Market Analytics / Property Professional | U (limited) | Y | All commercial classes | Y | Y | Partial (rent/occupancy; NOI not confirmed as a standard field) | Limited | N — ToS prohibits automated extraction/scraping; no self-serve API found | N confirmed publicly | Proprietary, redistribution prohibited | PNP | costar.com/products/market-analytics; confirmed via cap-rate-data-coverage.md §18 (checked 2026-09-11) |
| MSCI / RCA | MSCI | Real Capital Analytics | Y | Y | All commercial classes | Y (transaction-derived) | Y | Partial — RCA discloses price; NOI disclosure not confirmed as universal | N | Y — MSCI documents API/data-delivery incl. Snowflake integration | Y (enterprise) | Proprietary, license-negotiated | PNP | msci.com/data-and-analytics/real-estate/real-capital-analytics (per cap-rate-data-coverage.md §18) |
| Altus Group | Altus Group | Altus Insite / ARGUS / Reonomy (acquired July 2026) | Y (primary) | Y (via Reonomy) | Cap rates, valuation, hard/soft cost, construction index | Y | Partial (Reonomy has property/ownership data) | U | Y | Y — Reonomy offers enterprise API (per Altus product pages) | U | Subscription, proprietary | PNP | altusgroup.com (per cap-rate-data-coverage.md §18) |
| RealPage | RealPage Inc. | RealPage Analytics (multifamily) | N confirmed | Y | Multifamily only | Y (per E68 registry note) | U | U | N | U — not confirmed publicly for cap-rate data | U | Subscription | PNP | realpage.com/analytics (per source-registry.ts, existing) |
| Green Street | Green Street Advisors | Commercial Property Price Index (CPPI), U.S. Market Data & Deals | N (US-focused) | Y | 9 sectors, top 50 US markets + 334 tertiary markets, 4 core sectors | Y — cap-rate and asset-value time series described on product page | Y — Sales Comps / Rent Comps databases described | U | N | U — not documented publicly | U | Subscription, institutional | PNP | greenstreet.com/resources/pricing-index/, info.greenstreet.com/u.s.-market-data-deals-overview (checked 2026-09-11) |
| Trepp | Trepp, LLC | TreppData Feed / CMBS property-level data | N confirmed | Y (CMBS-collateralized properties only) | Properties within CMBS pools, cross-sector | N (no direct market cap-rate product found) | Y (loan/property-level, securitized loans) | Y — TreppData Feed cites operating-expense and property-level financial detail for CMBS properties, which implies NOI-adjacent data | N | U — feed/platform-based, no public REST API doc found | U | Proprietary, licensed | PNP | cherre.com/vendors/trepp/, businesswire release (checked 2026-09-11); scope limited to securitized (CMBS) properties only, not a general market cap-rate survey |
| Yardi Matrix | Yardi Systems | Yardi Matrix | N confirmed | Y (188+ metros) | Multifamily, affordable housing, student housing, self-storage, office, industrial | U — market data/rent/occupancy confirmed; explicit numerical cap-rate product not confirmed in public pages | U | Y — "market financial information including income, expenses, capital expenditures" described | N | U — not documented publicly | U | Subscription | PNP | yardimatrix.com/property-types/multifamily/, yardi.com/product/matrix (checked 2026-09-11) |
| CommercialEdge | Yardi (CommercialEdge) | CommercialEdge listing/property platform | N confirmed | Y | Office, industrial, retail | N — not confirmed | Partial (listing-based, not confirmed as transaction ledger) | N | N | Y — API exists, integrates with PropTech providers (per SelectHub summary) | U | Subscription | Starts ~$250/month for base platform (SelectHub/SourceForge, 2026); API pricing itself not separately published | selecthub.com/p/real-estate-asset-management-software/commercialedge (checked 2026-09-11) |
| PropertyShark | Yardi (PropertyShark) | PropertyShark property records | N | Y (major metros) | Property records, ownership, sales, permits | N | Y (sales/deed records) | N | N | N — no official API; third-party scraping-based "APIs" exist but are not PropertyShark's own product | U | Subscription-tier ($59.95–$169.95/mo Pro/Elite/Platinum, group custom) | Listed | credaily.com/reviews/propertyshark-review, softwarefinder.com/property-management-software/propertyshark (checked 2026-09-11) |
| Placer.ai | Placer Labs | Placer.ai location intelligence | U | Y | Retail/CRE foot-traffic overlay, not a cap-rate/cost product | N | N | N | N | Y — dashboard, API, data feeds described | U | Subscription | Estimated $5,000–$30,000/yr per third-party benchmarking (not Placer's own published rate card) | plumlending.com/insights/placer-ai-review, softwarefinder.com/analytics-software/placer-ai (checked 2026-09-11); NOTE: this is a foot-traffic/location-intelligence product, not a cap-rate or construction-cost source — included per the task's "any other material sources" instruction but out of scope for E68's core benchmark metrics |
| LightBox | LightBox | LightBox Data / SpatialStream API / LightBox Property | Y (per general marketing; not itemized) | Y | Parcel/property records, zoning, building characteristics | N | N | N | N | Y — SpatialStream API documented, "6B+ server hits/month" | U | "Flexible licensing," terms not itemized | PNP | lightboxre.com/data/lightbox-apis/, lightboxre.com/product/spatialstream-real-estate-api (checked 2026-09-11) |
| Moody's Analytics CRE (formerly REIS) | Moody's Analytics | Moody's Analytics CRE / MA CRE API | U (US-focused per sources found) | Y | 10 major CRE sectors, 275+ markets, 3,000+ submarkets | Y — "rents and cap rates" explicitly named among covered indicators | Y — sales transactions mentioned | U | N | Y — documented API (MA CRE API / Data Buffet with API, scheduled baskets, Excel add-in) | Y (Data Buffet baskets) | Subscription, proprietary | PNP | moodyscre.com/products/mca-api/, cre.moodysanalytics.com/capabilities/data/, hub.moodysanalytics.com/products (checked 2026-09-11) |
| JLL | JLL | JLL Research / Capital Markets insights | Y | Y | All commercial classes | Mixed — see cap-rate-data-coverage.md (`NOT_FOUND` for the 5 US priority cities as of Phase 4B) | U | N | N | N (research is report/PDF form) | N | Free reports = `public_report`, not redistributable | Free (public reports); underlying data proprietary | jll.com/en-us/insights (per cap-rate-data-coverage.md §12) |
| Cushman & Wakefield | C&W | Canadian Cap Rate & Capital Markets Report / MarketBeat | Y (confirmed, used by E68) | Y (mixed — see coverage doc) | Multifamily confirmed numerically for Canada; office/industrial/retail unlabeled trend lines only | Y (Canada multifamily); partial (US) | N | N | N | N | N | Free reports = `public_report` | Free | Already an E68 source; see cap-rate-data-coverage.md §13 |
| Colliers | Colliers International | Canada Cap Rate Report | Y (confirmed to exist, `FOUND_BUT_INACCESSIBLE`) | Y (limited, `FOUND_BUT_INSUFFICIENT`/`NOT_FOUND` per city) | Multifamily, office, industrial, retail (per report scope, unverified due to bot-protection) | Believed Y, unverified | U | N | N | N | N | Free reports (unverified due to access block) | Free | cap-rate-data-coverage.md §13 |
| Newmark | Newmark Group | Metro multifamily market reports | N (not found for Canada) | Y (already an E68 source, Houston) | Multifamily (class-split for Houston) | Y | Y (transaction tables, no NOI) | N | N | N | N | Free reports = `public_report` | Free | Already an E68 source |
| Marcus & Millichap | Marcus & Millichap | Research reports / market snapshots | N | Y | Multifamily, industrial, retail, office (sector research) | Mixed — endpoint outage encountered (per registry §"Checked, yielded nothing usable") | U | N | N | N | N | Free reports | Free | e68-source-registry.md |
| Avison Young | Avison Young | US/Canada research | Y (believed, `FOUND_BUT_INACCESSIBLE`) | Y (believed, `FOUND_BUT_INACCESSIBLE`) | All commercial classes (unverified due to bot-protection) | Believed Y, unverified | U | N | N | N | N | Free reports (unverified) | Free | cap-rate-data-coverage.md §12/§13 |

---

## PART 2 — Cap-rate coverage detail

Requiring **actual numerical observations or documented methodology**, not vague
statements ("market intelligence," "cap rates increased"):

- **CBRE** — confirmed numeric product (U.S. Cap Rate Survey: "3,600 estimates across
  50+ markets... by sector, class and stabilized/value-add," per cap-rate-data-coverage.md
  §3) but the market-level tables are gated behind a download form; the free page carries
  only directional commentary. **Verdict: numeric product exists, not publicly readable
  without the gated download** (which was not attempted — no sales inquiry, no signup).
- **MSCI/RCA** — transaction-derived cap rates are RCA's core product; described on MSCI's
  own site as a real-estate transaction analytics platform. Not independently verified with
  a sample number (subscription required).
- **Green Street** — explicitly describes "cap rate and asset value time series" on its own
  Market Data & Deals product page (info.greenstreet.com/u.s.-market-data-deals-overview,
  checked 2026-09-11). This is a documented numeric data product, not marketing language.
- **Moody's Analytics CRE** — explicitly lists "rents and cap rates" among tracked
  indicators across 275+ markets and 3,000+ submarkets (cre.moodysanalytics.com/capabilities/data,
  checked 2026-09-11). Documented numeric product.
- **CoStar** — widely cited as the underlying data source behind free brokerage cap-rate
  charts already in E68 (Kidder Mathews, Matthews — see cap-rate-data-coverage.md §2).
  This is strong indirect evidence CoStar itself carries cap-rate data, even though CoStar's
  own product pages were not independently confirmed with a sample figure.
- **Yardi Matrix, Trepp, CommercialEdge, PropertyShark, LightBox, Placer.ai** — **no
  documented numeric cap-rate data product was found.** Yardi Matrix's public pages
  describe rent, occupancy, and financial (income/expense) data, not a cap-rate metric by
  name. Trepp's property-level CMBS data implies NOI-adjacent figures but not a market
  cap-rate survey. These are correctly excluded from "sources with meaningful cap-rate
  data" in the FINAL REPORT below.

Segmentation (city/metro/submarket/Class A-B-C/CBD-suburban/high-rise-low-rise): CBRE's
survey is documented to split by sector, class, and stabilized/value-add. Moody's CRE
claims submarket-level granularity (3,000+ submarkets). Green Street's product page cites
market-grade and sector-level granularity across ~50 top US markets plus 334 tertiary
markets. None of these segmentation claims were independently verified with a sample row
(all gated). CBRE's granularity is the best-documented against E68's actual gap list
(office/industrial/retail by class and CBD/suburban), consistent with the existing
recommendation in cap-rate-data-coverage.md §11.

---

## PART 3 — Transaction cap rates: price + NOI

E68's existing research (cap-rate-data-coverage.md §6) already established that no free
source discloses both price and NOI for a comparable sale. For paid sources:

| Source | Price disclosed | NOI/income disclosed | Can legitimately derive cap rate | Publisher-supplied cap rate directly |
| --- | --- | --- | --- | --- |
| MSCI/RCA | Y (core transaction database) | Not confirmed as universal field in public docs | Unconfirmed — plausible given "transaction-derived" framing but not verified from a public sample | Y — RCA publishes cap-rate series directly, per MSCI's own product description |
| Trepp | Y (loan-collateral property data) | Y (property-level operating expense/income fields, per TreppData Feed description) | **Most likely candidate for E68-derived cap rates among the sources checked** — but scope is limited to CMBS-collateralized properties, not a general market sample | N confirmed — no market cap-rate survey found |
| CoStar | Y (property records) | Not confirmed as standard field | Unconfirmed | Y — implied by brokerage republication of CoStar-credited averages (already used indirectly by E68) |
| Green Street | Y (Sales Comps database) | Not confirmed | Unconfirmed | Y — "cap rate and asset value time series" is direct |
| Moody's CRE | Y (sales transactions mentioned) | Not confirmed | Unconfirmed | Y — cap rates explicitly named as a tracked indicator |
| CBRE | N (survey, not a transaction ledger) | N | N — not applicable, survey methodology not transaction-by-transaction | Y (survey estimate, not derived) |

**Nothing was calculated.** No sample cap rate was derived from any paid source in this
phase; every "Y" above is a documented product capability, not a computed value. This
distinction — publisher-supplied vs. E68-derived — must be preserved if any of these
sources are later licensed: `CREDerivedTransaction` (already defined in E68's schema per
cap-rate-data-coverage.md §6) requires price, NOI, and both their sources plus methodology,
independent of whether the underlying subscription calls its own output a "cap rate."

---

## PART 4 — Construction costs

| Source | Hard cost | Soft cost | Total dev. cost | Replacement cost | $/SF | $/unit | Regional index | Building-type specificity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RLB North America | Y (already an E68 source, 53 observations) | Partial | N confirmed | N | Y | Partial | Y | Y — by building type, already in use |
| Turner & Townsend | Y (documented, per cap-rate-data-coverage.md §7 — city $/ft² figures) | N (professional fees generally separated, per registry notes) | N | N | Y | N | Y | Undocumented basis for Austin/Phoenix figures (already flagged `FOUND_BUT_INSUFFICIENT` — no stated building type/hard-vs-total basis) |
| RSMeans (Gordian) | Y — core product, "92,000+ unit line items including equipment, material and labor" | Partial (via assemblies/systems costing, not a distinct headline product) | Partial (via full project estimate builds) | Y (used for insurance replacement-cost estimating in practice) | Y | U | Y (location-specific, ~city-level cost factors) | Y — extensive building-type and assembly-level detail; the most granular of any source reviewed |
| Marshall & Swift / CoreLogic (SwiftEstimator) | Y — core product (replacement-cost focus) | U | N (replacement-cost, not full development-cost, focus) | Y — explicitly "the gold standard in property valuation" replacement-cost data, "2,629 locations nationwide" | Y | U | Y | Y — residential, commercial, industrial, agricultural |
| Dodge Construction Network | Partial (via cost-management reporting product; not primarily a unit-cost database like RSMeans) | U | U | N | U | U | Y (regional project data) | U — Dodge's core product is project/bid tracking, not a $/SF cost guide; "Construction Cost Management Report" exists but detail not verified |
| Altus Group | Y (per existing registry: "hard_cost, soft_cost, construction_index") | Y | U | U | U | U | Y | Y (Canada-focused) |
| CBRE / JLL / Cushman & Wakefield | Partial — periodic "cost to build" commentary in market reports | N confirmed as distinct product | N | N | Partial | N | N | Weak — these are brokerage research notes, not dedicated cost databases |

**Filling E68's specific gaps** (multifamily, industrial, office, retail, townhouse, SFR,
high-rise, low-rise, Class A/B office; Houston construction-cost absence; soft costs):

- **RSMeans/Gordian is the strongest candidate for soft-cost and building-type granularity**
  E68 currently lacks — RLB and Turner & Townsend are both hard-cost/$/SF oriented with
  soft costs generally excluded or unstated.
- **Houston gap**: neither RLB nor Turner & Townsend cover Houston (independently confirmed
  by two consultancies per cap-rate-data-coverage.md §7). RSMeans' location-factor model is
  built on ~city-level cost indices nationwide and, based on its documented scope, would very
  plausibly include a Houston factor — but this was not verified against an actual Houston
  line item in this phase (behind a paid tier).
- **Marshall & Swift/CoreLogic** is replacement-cost-focused (appraisal/insurance use case)
  rather than development-cost-focused, so it is a partial fit for E68's "replacement cost"
  dimension but not a fit for "total development cost."

---

## PART 5 — API/automation classification

| Source | Classification | Auth | Docs | Rate limits | Machine-readable format | Historical access | Geo/asset filtering | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CBRE | REPORT_PDF | N/A | N/A | N/A | N | Unknown | Report-level only | Gated download, no API found |
| CoStar | WEB_ONLY (platform) | Login | N/A (proprietary platform) | N/A | Platform export tools exist but automated scraping explicitly prohibited by ToS | Extensive | Y (platform UI) | No public API confirmed |
| MSCI/RCA | API_BY_CONTRACT | Enterprise credential | Documented (Snowflake integration referenced) | Unknown | Y | Extensive | Y | |
| Altus Group (Reonomy) | API_BY_CONTRACT | Enterprise credential | Product pages reference enterprise API | Unknown | Y | Unknown | Y | |
| RealPage | UNKNOWN | — | — | — | — | — | — | No public API documentation found |
| Green Street | UNKNOWN / possibly BULK_EXPORT | — | Not found in public pages | — | Unknown | Extensive (time series described) | Y (by market/sector) | |
| Trepp | BULK_EXPORT (feed-based) | Contract | TreppData Feed described as a data feed product | Unknown | Y | Extensive (loan-level history) | Y (CMBS scope only) | |
| Yardi Matrix | WEB_ONLY / REPORT_PDF | Login | Public docs describe platform and reports, not an API | — | Unknown | Monthly updates described | Y | No public API doc found |
| CommercialEdge | API_AVAILABLE (claimed) | Unknown | Referenced as integrating with PropTech providers | Unknown | Y (implied) | Unknown | Y | Official API docs not independently verified in this phase |
| PropertyShark | MANUAL_ONLY (official) | Login | No official API | — | N | — | — | Third-party scraping services exist but are NOT PropertyShark's own product — excluded from any recommendation |
| Placer.ai | API_AVAILABLE (claimed) | Contract | "API, data feeds" mentioned on product pages | Unknown | Y | Unknown | Y | Not a cap-rate/cost source; noted for completeness only |
| LightBox | API_AVAILABLE | API key / contract | SpatialStream API and a documented "Knowledge Center" (lightbox.document360.io) | Unknown | Y | Unknown | Y (parcel/geo) | Strongest documented API among the non-cap-rate sources reviewed |
| Moody's Analytics CRE | API_AVAILABLE | Enterprise credential | MA CRE API product page + Moody's API Hub documented | Unknown | Y | Extensive (Data Buffet) | Y | Best-documented API among cap-rate-bearing sources |
| JLL / C&W / Colliers / Newmark / M&M / Avison Young | REPORT_PDF | N/A | N/A | N/A | N | Report-level | Report-level | Free brokerage research, no API |
| RSMeans/Gordian | BULK_EXPORT / API_BY_CONTRACT (Gordian Cloud platform) | Login/subscription | Gordian Cloud Platform documented | Unknown | Y | Unknown | Y (location factors) | |
| Marshall & Swift/CoreLogic | WEB_ONLY (SwiftEstimator) / API_BY_CONTRACT possible | Login | Not confirmed publicly | Unknown | Unknown | Unknown | Y | |
| Dodge Construction Network | API_AVAILABLE | Contract | "Construction Data API" page exists (construction.com/apis) | Unknown | Y | Unknown | Y | |

No auth was attempted, no rate limits were tested, and no bypass of any of the above was
performed for this classification — all statuses are read from public marketing/docs pages.

---

## PART 6 — Licensing: seven-question matrix

For every source, "Y" below means the *publicly documented* terms plausibly allow it;
"N" means clearly prohibited or clearly not offered; "REQUIRES LICENSE REVIEW" means the
public pages did not settle the question and an actual contract would need to be read.

| Source | (A) Internal consumption | (B) Display benchmark | (C) Display underlying value | (D) Store raw data | (E) Redistribute raw data | (F) Display derived calc | (G) Show provenance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CBRE (paid survey) | REQUIRES LICENSE REVIEW | REQUIRES LICENSE REVIEW | N (proprietary) | REQUIRES LICENSE REVIEW | N | REQUIRES LICENSE REVIEW | Y (naming the source is standard practice, not itself a redistribution issue) |
| CoStar | REQUIRES LICENSE REVIEW | REQUIRES LICENSE REVIEW | N — ToS explicitly bars automated extraction/redistribution | REQUIRES LICENSE REVIEW | N | REQUIRES LICENSE REVIEW | Y |
| MSCI/RCA | REQUIRES LICENSE REVIEW | REQUIRES LICENSE REVIEW | N (proprietary) | REQUIRES LICENSE REVIEW | N | REQUIRES LICENSE REVIEW | Y |
| Altus Group | REQUIRES LICENSE REVIEW | REQUIRES LICENSE REVIEW | N | REQUIRES LICENSE REVIEW | N | REQUIRES LICENSE REVIEW | Y |
| RealPage | REQUIRES LICENSE REVIEW | REQUIRES LICENSE REVIEW | N | REQUIRES LICENSE REVIEW | N | REQUIRES LICENSE REVIEW | Y |
| Green Street | REQUIRES LICENSE REVIEW | REQUIRES LICENSE REVIEW | N | REQUIRES LICENSE REVIEW | N | REQUIRES LICENSE REVIEW | Y |
| Trepp | REQUIRES LICENSE REVIEW | REQUIRES LICENSE REVIEW | N | REQUIRES LICENSE REVIEW | N | REQUIRES LICENSE REVIEW | Y |
| Moody's Analytics CRE | REQUIRES LICENSE REVIEW | REQUIRES LICENSE REVIEW | N | REQUIRES LICENSE REVIEW | N | REQUIRES LICENSE REVIEW | Y |
| RSMeans/Gordian | REQUIRES LICENSE REVIEW | REQUIRES LICENSE REVIEW | N (per-seat licensing typical of cost-data products) | REQUIRES LICENSE REVIEW | N | REQUIRES LICENSE REVIEW | Y |
| Marshall & Swift/CoreLogic | REQUIRES LICENSE REVIEW | REQUIRES LICENSE REVIEW | N | REQUIRES LICENSE REVIEW | N | REQUIRES LICENSE REVIEW | Y |
| Free brokerage reports (CBRE Canada, C&W, Newmark, Kidder Mathews, Matthews, Colliers, JLL, Avison Young, M&M) | Y (already E68 practice) | Y (already E68 practice — stored as cited observations) | N — `public_report` is explicitly not redistributable per `isRedistributable()` in source-registry.ts | Y (as a cited figure, not a copy of the report) | N | Y | Y |
| Statistics Canada / US Census / BLS / CMHC (government) | Y | Y | Y | Y | Y — `isRedistributable()` returns true only for this class | Y | Y |

**Key finding, consistent with E68's existing `isRedistributable()` design**: not one paid
source reviewed grants redistribution of raw data absent a specific license clause, and
none of the public marketing pages reviewed publish that clause. API access (a technical
capability) and redistribution rights (a legal permission) are always separate questions —
this phase found no source where API availability was documented as implying redistribution
rights.

---

## PART 7 — Economic value

Per the task's explicit instruction, no pricing is invented. Public pricing found:

| Source | Public pricing found | Detail |
| --- | --- | --- |
| RSMeans Data Online | Y | Core plan ~$396/yr; Complete ~$1,019/yr; Complete Plus ~$5,973/yr (Capterra, 2026); alternative tiering $2,195–$6,735/yr for module vs. full database (SoftwareConnect) |
| CommercialEdge | Y (partial) | "Starts at $250/month" for the base platform (SelectHub/SourceForge, 2026) — API pricing itself not separately published |
| PropertyShark | Y | Pro $59.95/mo, Elite $79.95/mo, Platinum $169.95/mo, custom group pricing (CRE Daily, SoftwareFinder, 2026) |
| Placer.ai | Estimated only, not Placer's own rate card | Third-party benchmarking sites estimate $5,000–$30,000/yr — **this is not a confirmed price**, flagged accordingly |
| Dodge Construction Network | Estimated only | One third-party source cites "starting at $300/user/month," but Dodge itself confirms sales-led, configuration-dependent pricing with no published list — treated as `PRICING NOT PUBLIC — SALES QUOTE REQUIRED` |
| CBRE, CoStar, MSCI/RCA, Altus, RealPage, Green Street, Trepp, Yardi Matrix, Moody's Analytics CRE, LightBox, Marshall & Swift/CoreLogic | N | `PRICING NOT PUBLIC — SALES QUOTE REQUIRED` for all — no list price, tier price, or per-seat figure was found on any public page |

**Setup cost, minimum contract, dev/integration cost, maintenance cost**: not publicly
documented for any source in this table. All marked `PRICING NOT PUBLIC — SALES QUOTE
REQUIRED`.

**E68 gaps solved per source** (qualitative, cross-referenced to
cap-rate-data-coverage.md §5/§17 gap list):

| Source | Miami cap rates | Office/industrial/retail cap rates | Multifamily depth | Houston construction cost | Soft costs | Transaction-derived cap rates |
| --- | --- | --- | --- | --- | --- | --- |
| CBRE | Likely (national survey) | Likely (documented sector split) | Yes | No | No | No (survey, not transaction ledger) |
| CoStar | Likely | Likely | Yes | No | No | Unconfirmed |
| MSCI/RCA | Likely | Likely | Yes | No | No | Most likely candidate, unconfirmed |
| Green Street | Likely (top-50 + 334 tertiary markets) | Likely (9 sectors) | Yes | No | No | Partial (Sales Comps) |
| Moody's Analytics CRE | Likely (275+ markets) | Likely (10 sectors) | Yes | No | No | Partial |
| RSMeans/Gordian | No | No | No | **Likely** — nationwide location-factor coverage | **Yes**, best candidate | No |
| Altus Group | No (Canada gap is different) | Partial | Partial | Possible | Yes | No |

---

## PART 8 — Source scoring framework

Scoring dimensions (1–5 each, price excluded from the score itself and reported
separately so it cannot dominate): Coverage, Granularity, Accuracy/Authority, Freshness,
Historical Depth, API Availability, Commercial Licensing clarity, Redistribution Rights,
Integration Complexity (lower is better, inverted for scoring).

Because **no source in this review had its pricing, granularity, or licensing terms
independently verified from primary data** (every paid source is gated), most cells below
are qualitative judgments from public documentation, not measured scores. Where the public
evidence is too thin to respectably rank a dimension, this section says
`INSUFFICIENT PUBLIC INFORMATION` rather than inventing a number.

| Category | Answer | Basis |
| --- | --- | --- |
| BEST OVERALL | INSUFFICIENT PUBLIC INFORMATION — candidates CBRE, MSCI/RCA, Moody's Analytics CRE | All three combine broad geography, multi-sector cap rates, and (for MSCI/Moody's) documented APIs, but none was verified with sample data |
| BEST CAP-RATE SOURCE | CBRE U.S. Cap Rate Survey (qualitative lead) | Only source in this review whose public description explicitly names sector × class × stabilized/value-add segmentation matching E68's exact gap list |
| BEST TRANSACTION SOURCE | MSCI/RCA | Longest-established transaction-level database of the sources reviewed; explicit "transaction-derived" framing |
| BEST CONSTRUCTION-COST SOURCE | RSMeans (Gordian) | Only source with unit-line-item granularity (92,000+ items) and published, if partial, pricing |
| BEST CANADIAN SOURCE | Altus Group | Canada-headquartered, Canada-primary coverage across cap rate + cost; already E68's top Canadian recommendation per cap-rate-data-coverage.md §11 |
| BEST US SOURCE | INSUFFICIENT PUBLIC INFORMATION — CBRE and MSCI/RCA tied on public evidence | Both have the strongest documented US coverage; neither was verified with sample data |
| BEST API/AUTOMATION SOURCE | Moody's Analytics CRE | Only cap-rate-bearing source with a named, documented API product (MA CRE API) plus a public API hub |
| BEST LOW-COST OPTION | RSMeans Data Online (Core plan) | Only source in this entire matrix with a **confirmed public price under $500/year** |
| BEST PREMIUM OPTION | MSCI/RCA or CBRE enterprise survey license | Both are institutional-grade, contract-priced; no public price ceiling found for either |

---

## PART 9 — Free vs. paid gap analysis

| Benchmark | Available free (current E68) | Available paid | Best paid source | Granularity | Currentness | Automation | License status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cap rate — multifamily, Houston/Phoenix/Seattle/Austin | Y (35 observations total, class split for Houston) | Y | CBRE, CoStar | Better (uniform methodology) | Quarterly (paid) vs. mixed quarterly free | REPORT_PDF (free) vs. mixed (paid) | Free = `public_report`, not redistributable; paid = `REQUIRES LICENSE REVIEW` |
| Cap rate — Miami, all classes | N (confirmed gap) | Y (believed) | CBRE, CoStar | Unknown | Unknown | Unknown | `REQUIRES LICENSE REVIEW` |
| Cap rate — office/industrial/retail, all 5 US cities | N (confirmed gap) | Y (believed, CBRE survey documented by class/sector) | CBRE | By sector + class (documented) | Semiannual | REPORT_PDF | `REQUIRES LICENSE REVIEW` |
| Cap rate — Class A/B/C splits outside Houston | N | Y (CBRE) | CBRE | Class-level (documented) | Semiannual | REPORT_PDF | `REQUIRES LICENSE REVIEW` |
| Cap rate — CBD/suburban splits outside Houston | N | Likely (unconfirmed) | CBRE (unconfirmed for this specific split) | Unknown | Unknown | Unknown | `REQUIRES LICENSE REVIEW` |
| Cap rate — Canada, 10 cities, multifamily high/low-rise | Y (20 observations, C&W Canada) | Y | Altus, CBRE Canada, Colliers Canada | Comparable or better (unverified) | Quarterly | Mixed | Free = `public_report`; paid = `REQUIRES LICENSE REVIEW` |
| Cap rate — Canada, office/industrial/retail | N (confirmed gap, all 10 cities) | Likely (unconfirmed) | Altus, CBRE Canada | Unknown | Unknown | Unknown | `REQUIRES LICENSE REVIEW` |
| Transaction-derived cap rates (price + NOI) | N (no free source discloses NOI) | Possibly — MSCI/RCA, Trepp (CMBS scope only) | MSCI/RCA | Property/transaction-level | Monthly (MSCI) | API_BY_CONTRACT | `REQUIRES LICENSE REVIEW` |
| Construction cost — US, $/SF, hard cost | Y (RLB, 53 observations, no Houston) | Y | RSMeans | Location-factor, city-level | Updated regularly (unconfirmed cadence) | BULK_EXPORT/API_BY_CONTRACT | Free = `public_report`; paid = `REQUIRES LICENSE REVIEW` |
| Construction cost — Houston, US | N (confirmed gap, 2 consultancies checked) | Likely (RSMeans nationwide location factors) | RSMeans | Unconfirmed for Houston specifically | Unconfirmed | BULK_EXPORT | `REQUIRES LICENSE REVIEW` |
| Construction cost — soft costs | N (RLB/T&T largely exclude soft cost) | Y | RSMeans (assemblies), Altus | Line-item (RSMeans) | Unconfirmed | Mixed | `REQUIRES LICENSE REVIEW` |
| Construction cost — Canada | N (no Canadian construction-cost E68 source found in this review) | Y | Altus, Statistics Canada BCPI (already free/public) | Index-level (StatCan, free); line-item (Altus, paid, unconfirmed) | Quarterly (StatCan) | public_data (StatCan) / API_BY_CONTRACT (Altus) | StatCan = fully redistributable (government); Altus = `REQUIRES LICENSE REVIEW` |

---

## PART 10 — Confirmation of research-only scope

Confirmed for this entire phase:
- No purchase was made of any product, subscription, seat, or report.
- No account was created with any vendor (CBRE, CoStar, MSCI, Altus, RealPage, Green
  Street, Trepp, Yardi Matrix, CommercialEdge, PropertyShark, Placer.ai, LightBox, Moody's,
  JLL, Cushman & Wakefield, Colliers, Newmark, Marcus & Millichap, Avison Young, RSMeans/
  Gordian, Marshall & Swift/CoreLogic, Dodge Construction Network, or any other).
- No payment information was entered anywhere.
- No sales team was contacted, no demo was requested, no "request a quote" form was
  submitted.
- No web-scraping, headless browser, proxy rotation, or credential-based automation was
  used against any gated or bot-protected page.
- No paywall, login wall, or Cloudflare bot-challenge (e.g., cbre.ca, collierscanada.com,
  avisonyoung.us/.ca — already documented as `FOUND_BUT_INACCESSIBLE` in earlier phases)
  was bypassed. Those classifications are reused, not re-attempted, in this phase.
- All findings in Parts 1–9 above come from publicly visible marketing pages, product
  documentation pages, and independent third-party review/pricing aggregators (Capterra,
  SelectHub, SoftwareFinder, CRE Daily, etc.), each cited with a URL.

---

## PART 11 — E68 architecture recommendation

Target shape (not implemented):

```
Public Sources ─┐
                 ├─▶ E68 Ingestion ─▶ Normalization ─▶ Qualification ─▶ Consensus ─▶ Benchmark ─▶ InvestScape
Paid Sources ───▶ Paid Source Adapter ─┘
```

**Recommendation: do not design source-specific adapters yet.** Justification from this
research, not just repetition of the task's suggestion:

1. **No pricing is public for the top candidates** (CBRE, MSCI/RCA, Green Street, Moody's
   Analytics CRE, Altus, RealPage all `PRICING NOT PUBLIC`). Designing an adapter commits
   engineering time to a data contract (fields, update cadence, licensing constraints) that
   cannot be confirmed until a real contract is read — every "REQUIRES LICENSE REVIEW" cell
   in Part 6 is a design unknown, not just a legal one.
2. **The redistribution question dominates the adapter shape.** E68's existing
   `isRedistributable()` function is narrow by design (government + `public_data` +
   `public_data_terms` + `license: public`). Every paid source reviewed would enter E68 as
   non-redistributable, meaning a paid-source adapter's output could feed the *consensus/
   benchmark* layer but must never flow to any redistribution-flagged code path. That
   constraint is already expressible in the existing type system (`CRELicenseClass`,
   `redistribution`) without a new adapter class.
3. **Field-level formats differ enough across vendors** (Moody's Data Buffet baskets vs.
   MSCI's Snowflake integration vs. RSMeans' Gordian Cloud export vs. Trepp's data feed)
   that a generic "Paid Source Adapter" interface designed from marketing pages alone would
   almost certainly need rework once a real schema is seen — the existing `normalize.ts`
   already handles multi-format ingestion for free sources and is the right place to extend
   once a real contract exists.
4. **The actual purchase decision (Part 15) should come first.** Building adapter
   scaffolding for sources that may never be purchased is speculative engineering against
   this phase's own evidence gaps.

What **can** be done now, cheaply, without waiting for a purchase: keep `source-registry.ts`
as the single append point (adding entries for Green Street, Moody's CRE, RSMeans, etc. with
`access: "paid"`/`"mixed"` and `license: "subscription"`) so that when/if a source is
licensed, its registry entry (not a new architecture layer) is what changes.

---

## PART 12 — Consensus implications of multi-source disagreement

If, e.g., CBRE and MSCI/RCA both publish a Houston Class A cap rate for the same quarter
and disagree, research suggests several established approaches:

- **Source weighting** — E68 already has this concept (`defaultQuality` in
  `CRESourceDefinition`, `sourceQuality` per observation, e.g. Newmark scored 75 vs. Kidder
  Mathews 90 for methodology reasons documented in cap-rate-data-coverage.md §2). This is
  the natural extension point for paid sources: assign a `defaultQuality` reflecting
  methodology (transaction-derived > survey estimate, per the existing source hierarchy in
  e68-source-registry.md).
- **Median / range-band consensus** — appropriate when 3+ independent sources exist for the
  same cell, to avoid a single outlier (e.g., a stale or slow-to-update source) dominating.
  E68's `capRateConsensus()`/`weightedConsensus()` (already implemented, per
  e68-source-registry.md's "Source hierarchy" note) already preserves the union of
  published low/high bounds rather than collapsing to one number — this is the right
  existing behavior to extend, not replace.
- **Recency weighting** — relevant given the dated-vs-labeled-period contradiction E68
  already found in a free source (Newmark's Houston chart, cap-rate-data-coverage.md §2:
  "updated December 2024" footnote vs. "2Q25" label). Paid sources are not immune to this
  kind of internal inconsistency; recency should be judged from the *as-of date the
  publisher states for the data*, not the report's publish date.
- **Methodology weighting** — the existing "family" rule (`assertComparableCapRates()`
  throws if a consensus call spans `survey_estimate` and `transaction` concept families,
  per cap-rate-data-coverage.md §2) is the correct model to extend to paid sources:
  transaction-derived (MSCI/RCA, Trepp) should never be silently averaged with
  survey-estimate (CBRE) sources without an explicit, documented choice of family.

**Recommendation**: extend the existing weighted-consensus + family-separation design
(quality score + recency + explicit methodology family) rather than introducing a new
mechanism. This is consistent with Phase 4A's principle that "the two families never mix"
and requires no new consensus logic — only new registry entries with correctly assigned
`defaultQuality` and `concept` values once (if) a paid source is actually licensed. No
consensus-engine code was modified in this phase.

---

## PART 13 — Canada/USA parity

**CANADA ADVANTAGE**
- Altus Group is Canada-headquartered and Canada-primary — the only source in this review
  with a clear "Canada-first" orientation across both cap rate and construction cost.
- Free Canadian multifamily cap-rate coverage (Cushman & Wakefield Canada, already in E68)
  is broader by city count (10 cities) than any single free US source.

**CANADA GAP**
- No Canadian office/industrial/retail cap-rate source (free or paid) was confirmed with
  actual numeric data in this phase — C&W Canada's non-multifamily charts are unlabeled
  trend lines (cap-rate-data-coverage.md §13), and none of Green Street, Moody's CRE, or
  Trepp confirmed meaningful Canadian coverage (Trepp and Green Street both read as
  US-focused from their public pages).
- No confirmed Canadian construction-cost line-item database besides Statistics Canada's
  BCPI (an escalation index, not a $/SF guide) and Altus (unconfirmed granularity).
- CBRE Canada, Colliers Canada, and Avison Young Canada reports are all blocked by
  bot-protection for automated retrieval (already documented, cap-rate-data-coverage.md
  §13) — this is an access gap, not evidence of absent data, but it remains unresolved.

**US ADVANTAGE**
- Far more named, evidenced paid sources with US-primary or US-only coverage: CoStar,
  Green Street, Trepp, Yardi Matrix, CommercialEdge, PropertyShark, Moody's Analytics CRE,
  RSMeans (US-headquartered, though technically covers "North America").
- Multiple independent free multifamily cap-rate sources already validated across 4 of 5
  priority cities (cap-rate-data-coverage.md §2).

**US GAP**
- Miami — zero cap-rate observations from any free source found in any phase to date.
- Office/industrial/retail cap rates — zero free observations across all 5 US priority
  cities.
- Houston construction cost — confirmed absent from two independent free consultancies
  (RLB, Turner & Townsend); RSMeans is the only plausible paid candidate to fill this, and
  it is unverified for Houston specifically.

**Do not assume parity**: the CBRE, CoStar, and MSCI/RCA rows in Part 1 list Canada
coverage as `Y` (CBRE, MSCI/RCA) or `U`/`N confirmed` (CoStar) based only on those
publishers' general "North America" or global framing on their own marketing pages — none
of the three had Canada-specific numeric content independently verified in this phase.

---

## PART 14 — Final decision matrix

| Source | Primary Value | Canada | USA | Cap Rates | Transactions | Construction | API | Licensing | Cost | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CBRE | Broadest documented cap-rate segmentation (sector×class×stabilized) | Y | Y | Y | N | N | N | REQUIRES LICENSE REVIEW | PNP | TIER 1 |
| MSCI/RCA | Transaction-derived cap rates, top of E68's own source hierarchy | Y | Y | Y | Y | N | Y (contract) | REQUIRES LICENSE REVIEW | PNP | TIER 1 |
| Altus Group | Best Canadian coverage, cap rate + construction cost combined | Y | Partial | Y | Partial | Y | Y (Reonomy) | REQUIRES LICENSE REVIEW | PNP | TIER 1 |
| RSMeans (Gordian) | Only granular, partly-priced construction-cost database reviewed | Y (NA-wide) | Y | N | N | Y | Y | REQUIRES LICENSE REVIEW | Partially public (~$396–$5,973/yr) | TIER 1 |
| Green Street | Documented cap-rate + sales-comps time series, broad US coverage | N | Y | Y | Y | N | U | REQUIRES LICENSE REVIEW | PNP | TIER 2 |
| Moody's Analytics CRE | Best-documented API among cap-rate sources | U | Y | Y | Y | N | Y | REQUIRES LICENSE REVIEW | PNP | TIER 2 |
| CoStar | De-facto source behind existing free E68 figures; would open Miami | U | Y | Y | Y (unconfirmed NOI) | N | N (ToS prohibits) | N (redistribution prohibited) | PNP | TIER 2 |
| Trepp | Only source with documented property-level NOI-adjacent data | N | Y (CMBS scope only) | N | Y | N | U | REQUIRES LICENSE REVIEW | PNP | TIER 3 |
| Marshall & Swift/CoreLogic | Replacement-cost specialist, complements RSMeans | U | Y | N | N | Y (replacement cost) | U | REQUIRES LICENSE REVIEW | PNP | TIER 3 |
| RealPage | Multifamily-only, narrowest scope of reviewed subscription sources | N | Y | Y (unconfirmed) | U | N | U | REQUIRES LICENSE REVIEW | PNP | TIER 3 |
| Yardi Matrix | Strong multifamily/rent data, cap-rate product unconfirmed | N | Y | U | U | N | U | REQUIRES LICENSE REVIEW | PNP | TIER 3 |
| CommercialEdge | Listing/property platform, not a cap-rate or cost source | N | Y | N | Partial | N | Y (claimed) | REQUIRES LICENSE REVIEW | ~$250/mo (base) | TIER 4 |
| PropertyShark | Property records only, no API of its own | N | Y | N | Y | N | N | Subscription tier | $59.95–$169.95/mo | TIER 4 |
| Placer.ai | Foot-traffic/location intelligence, not a cap-rate/cost source | U | Y | N | N | N | Y | REQUIRES LICENSE REVIEW | Estimated, unconfirmed | TIER 4 |
| LightBox | Parcel/zoning data, not a cap-rate or cost source | Y (general) | Y | N | N | N | Y | REQUIRES LICENSE REVIEW | PNP | TIER 4 |
| Dodge Construction Network | Project/bid tracking, not a unit-cost database | N | Y | N | N | Partial | Y | Sales-led, no published rate | Unconfirmed estimate only | TIER 4 |

**TIER 1 (strongly recommended if budget exists):** CBRE, MSCI/RCA, Altus Group, RSMeans
(Gordian).
**TIER 2 (useful if budget permits):** Green Street, Moody's Analytics CRE, CoStar.
**TIER 3 (niche/specialized):** Trepp, Marshall & Swift/CoreLogic, RealPage, Yardi Matrix.
**TIER 4 (not justified now):** CommercialEdge, PropertyShark, Placer.ai, LightBox, Dodge
Construction Network — none of these publish the cap-rate or construction-cost data E68
actually needs; they solve adjacent problems (listings, foot traffic, parcel records, bid
tracking) that are out of E68's current scope.

---

## PART 15 — Scenarios

**SCENARIO A — $0 budget.**
Coverage: exactly today's free E68 state (35 cap-rate observations, 53 construction-cost
observations, 88 total; 4 of 5 US priority cities have multifamily cap rates; 10 Canadian
cities have multifamily high/low-rise cap rates). Remaining gaps: Miami (total gap),
office/industrial/retail everywhere, Houston construction cost, soft costs, transaction-
derived cap rates. Next free step (already identified, not yet executed): manual (human,
non-automated) retrieval of CBRE Canada / Colliers Canada / Avison Young reports currently
blocked only by bot-protection, not by a real paywall — a person opening the page in an
ordinary browser could plausibly retrieve reports believed to exist. Automation: none
beyond what E68 already does. Licensing: unchanged, fully within `public_report` terms
already handled.

**SCENARIO B — low/moderate budget.**
Minimum combination judged from this research to materially improve E68: **RSMeans Data
Online (Core or Complete plan, ~$396–$1,019/yr, confirmed public price)** for
construction-cost granularity and potential Houston coverage, alone. This is the only
source in the entire matrix with a confirmed sub-$2,000/year price and a documented,
granular product (92,000+ line items). Estimated cost: ~$400–$1,000/year (confirmed public
price, not a guess). Coverage gained: soft-cost/assembly-level detail, plausible Houston
$/SF fill, replacement-cost cross-check. Remaining gaps: cap rates (Miami,
office/industrial/retail) untouched — RSMeans does not address cap-rate gaps at all.
API/automation: BULK_EXPORT/API_BY_CONTRACT depending on tier (unconfirmed at the lowest
tier). Licensing: REQUIRES LICENSE REVIEW for any redistribution; internal-use estimating
is RSMeans' standard use case.

**SCENARIO C — professional budget.**
Strongest combination for cap-rate + transaction + construction intelligence: **CBRE Cap
Rate Survey license + MSCI/RCA subscription + RSMeans Complete Plus**. Estimated cost:
`PRICING NOT PUBLIC — SALES QUOTE REQUIRED` for CBRE and MSCI/RCA; RSMeans Complete Plus
publicly listed at ~$5,973/yr — **total professional-tier cost cannot be responsibly
estimated as a single number** because two of the three components have no public price.
Coverage: this combination would, per public product descriptions, close the Miami gap, the
office/industrial/retail gap across all 5 US cities (CBRE's documented sector×class
segmentation), add transaction-derived cap-rate potential (MSCI/RCA), and add
line-item soft-cost/building-type granularity (RSMeans) — but every one of those outcomes
is inferred from marketing/product pages, not verified against sample data, and would need
re-confirmation once (if) a contract is actually reviewed. API/automation: MSCI/RCA and
RSMeans both have documented API/bulk paths; CBRE's survey remains REPORT_PDF only.
Licensing: all three require a real contract read before any redistribution or
display-of-underlying-value decision can be made (Part 6). Expected improvement over
current E68: substantial on paper, unverifiable in degree without the actual data.

---

## FINAL REPORT

1. **Sources investigated**: CBRE, CoStar, MSCI/RCA, Altus Group, RealPage, Green Street,
   Trepp, Yardi Matrix, CommercialEdge, PropertyShark, Placer.ai, LightBox, Moody's
   Analytics/CRE, JLL, Cushman & Wakefield, Colliers, Newmark, Marcus & Millichap, Avison
   Young, RSMeans/Gordian, Marshall & Swift/CoreLogic, Dodge Construction Network (21 total).
2. **Sources with meaningful cap-rate data**: CBRE, MSCI/RCA, CoStar, Green Street, Moody's
   Analytics CRE, Cushman & Wakefield (Canada, already used), Newmark/Kidder
   Mathews/Matthews (US, already used).
3. **Sources with transaction cap-rate data (price+NOI potential)**: MSCI/RCA (most
   plausible), Trepp (CMBS scope only) — neither independently confirmed with sample data.
4. **Sources with construction-cost data**: RSMeans/Gordian, Marshall & Swift/CoreLogic,
   Altus Group, RLB (existing E68 source), Turner & Townsend (existing, flagged
   insufficient).
5. **Sources with soft-cost data**: RSMeans (assemblies), Altus Group (documented field);
   none independently confirmed with a sample value.
6. **Sources with APIs**: MSCI/RCA, Altus/Reonomy, Moody's Analytics CRE, LightBox,
   CommercialEdge (claimed), Placer.ai, Dodge Construction Network, RSMeans/Gordian
   (platform-based).
7. **Sources with commercial-use clarity**: none — every paid source is
   `REQUIRES LICENSE REVIEW`; only government sources (StatCan, Census, BLS, CMHC) and
   E68's existing free brokerage reports have settled licensing.
8. **Sources with redistribution clarity**: only government/public-data sources (per
   `isRedistributable()`); every paid source reviewed is presumptively non-redistributable.
9. **Best Canadian source**: Altus Group.
10. **Best US source**: INSUFFICIENT PUBLIC INFORMATION (CBRE and MSCI/RCA tied).
11. **Best cap-rate source**: CBRE U.S. Cap Rate Survey.
12. **Best transaction source**: MSCI/RCA.
13. **Best construction source**: RSMeans (Gordian).
14. **Best automation source**: Moody's Analytics CRE.
15. **Best low-cost combination**: RSMeans Data Online Core/Complete plan alone
    (~$400–$1,000/yr, confirmed public price).
16. **Best professional combination**: CBRE Cap Rate Survey + MSCI/RCA + RSMeans Complete
    Plus (cost not fully quantifiable — 2 of 3 components have no public price).
17. **Current free-data coverage summary**: 88 total E68 observations (35 cap-rate, 53
    construction-cost); 4 of 5 US priority cities and 10 Canadian cities have multifamily
    cap rates; zero office/industrial/retail cap rates anywhere; Houston has no
    construction-cost coverage.
18. **Remaining critical gaps**: Miami cap rates (all classes); office/industrial/retail
    cap rates everywhere (US and Canada); Class A/B/C and CBD/suburban splits outside
    Houston; Houston construction cost; soft costs generally; transaction-derived (NOI-based)
    cap rates anywhere.
19. **Estimated paid cost by scenario**: A = $0; B ≈ $400–$1,000/yr (RSMeans, confirmed
    public price); C = not quantifiable (CBRE and MSCI/RCA both `PRICING NOT PUBLIC`, plus
    RSMeans Complete Plus ≈ $5,973/yr).
20. **Recommended next step**: license RSMeans Data Online (Scenario B) as the only
    confirmed-price, high-granularity option, while separately requesting non-binding sales
    information (a quote, not a purchase) from CBRE and MSCI/RCA to convert Part 6's
    `REQUIRES LICENSE REVIEW` cells into settled answers before committing further budget or
    designing any paid-source adapter (per Part 11).

# E86 — CRE Source Registry and Normalization Policy

## Purpose

E86 normalizes commercial real-estate cap-rate and construction-cost observations from Canada and the United States. It records provenance and licensing status but does not copy or redistribute proprietary datasets.

## Source classes

### Public government data
- Statistics Canada — Building Construction Price Index (BCPI): quarterly construction-price escalation for commercial, institutional, industrial and residential structures.
- U.S. Census Bureau — Value of Construction Put in Place: monthly construction spending by construction type.
- U.S. Bureau of Labor Statistics — Producer Price Index: construction-related price escalation series.
- CMHC: Canadian housing/construction market context.

### Public brokerage / construction research
- CBRE Canada / CBRE U.S. cap-rate surveys.
- Colliers Canada cap-rate research.
- JLL and Cushman & Wakefield market/valuation research.
- Marcus & Millichap U.S. sector research.
- RLB North America construction-cost reports.
- Turner & Townsend North America cost intelligence.

### Mixed / proprietary
- Altus Group.
- MSCI Real Capital Analytics.
- CoStar.
- RealPage.

Publicly visible research from a proprietary provider may be stored as source metadata and as a manually entered observation where permitted. Underlying subscription datasets must not be copied into the repository unless a separate license permits it.

## Cap-rate canonical representation

E86 stores cap rates internally as decimal fractions:

- `5.50%` → `0.055`
- `6.25%` → `0.0625`

Published ranges are retained as `low` and `high`; a point estimate may be stored in `value`. Range aggregation does not silently narrow a publisher's stated interval.

## Construction-cost canonical representation

Hard and soft costs must declare their basis:

- `per_sf`
- `per_unit`
- `percent_of_hard_cost`
- `index`

Per-SF and per-unit costs must identify CAD or USD. Soft-cost percentages are stored as decimal fractions. Construction indexes are positive numeric indexes and are used for escalation, not interpreted as dollar costs.

## Confidence policy

Source quality is an explicit input from the source registry or caller. E86 does not infer quality solely from a publisher name. Consensus weighting uses explicit source quality and preserves the union of published low/high bounds.

Confidence should be expanded in later phases to include:

1. source quality;
2. freshness;
3. observation count;
4. cross-source agreement;
5. transaction evidence;
6. asset/geography match;
7. data revision status.

## Current source references

- CBRE Canada: https://www.cbre.ca/insights/reports/canada-cap-rates-investment-insights-q2-2026
- CBRE U.S.: https://www.cbre.com/insights/reports/us-cap-rate-survey-h1-2026
- Statistics Canada BCPI: https://www23.statcan.gc.ca/imdb-bmdi/pub/2317-eng.htm
- U.S. Census construction spending: https://www.census.gov/construction/c30/current/index.html
- U.S. BLS PPI: https://www.bls.gov/ppi/
- RLB North America: https://www.rlb.com/americas/insight/
- Turner & Townsend Market Intelligence: https://marketintelligence.turnerandtownsend.com/

Source URLs are references for discovery and provenance. Automated retrieval and redistribution must follow the source's current terms.

---

## Phase 4 — sources actually used (2026-09-10)

Registry entries describe sources E86 *may* draw on. This section records what
was actually retrieved and populated.

### Used

| Source | Report | Published | Retrieved |
| --- | --- | --- | --- |
| `rlb-north-america` | RLB Quarterly Construction Cost Report — North America, Q2 2026 | 2026-06-24 | 2026-09-10 |

One report. 53 observations. PDF:
`https://www.rlb.com/wp-content/uploads/sites/4/2026/06/Q2-2026-QCR_7.7.2026.pdf`
Cross-checked against RLB's Central and West regional summary pages.

### Checked, yielded nothing usable

| Source | Outcome |
| --- | --- |
| `cbre-us-cap-rates` | U.S. Cap Rate Survey H1 2026 (published 2026-08-12). Public page carries directional commentary only; all 3,600 estimates across 50+ markets are behind a download gate. No quotable market-level figure. |
| `marcus-millichap-research` | Austin multifamily market-report endpoint returned "search service is currently unavailable". Nothing retrievable. |
| Secondary aggregators | Figures circulate without report title, period or method. Rank below every primary source under the hierarchy; excluded. |

### Source hierarchy

When several sources cover the same observation, prefer in order:

1. Transaction-derived evidence
2. Market cap-rate survey
3. Institutional brokerage valuation/research
4. Specialized construction-cost consultancy
5. Government index
6. Secondary aggregation

This ranking orders *preference*, not overwriting. E86 retains every underlying
observation; consensus is computed later by `weightedConsensus()` /
`capRateConsensus()`. One source never silently replaces another.

### Redistribution

`isRedistributable()` is deliberately narrow: government + `public_data` +
`public_data_terms`. RLB is `public_report` — free to download, **not**
redistributable. The figures in `data/` are stored as cited observations, not as
a copy of the report.

# E68 — CRE Source Registry and Normalization Policy

## Purpose

E68 normalizes commercial real-estate cap-rate and construction-cost observations from Canada and the United States. It records provenance and licensing status but does not copy or redistribute proprietary datasets.

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

E68 stores cap rates internally as decimal fractions:

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

Source quality is an explicit input from the source registry or caller. E68 does not infer quality solely from a publisher name. Consensus weighting uses explicit source quality and preserves the union of published low/high bounds.

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

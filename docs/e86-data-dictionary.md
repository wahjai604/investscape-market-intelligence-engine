# E86 — CRE Data Dictionary (Phase 4)

Status as of 2026-09-10. This document describes the fields E86 stores, the
rules that govern them, and exactly what data is and is not present.

## Governing rule

> A missing observation is preferable to an estimated or inferred observation.

Quality order, highest priority first:

**REAL > TRACEABLE > GRANULAR > CURRENT > COMPLETE**

Completeness is last. A city having "an observation" is not coverage.

## Core types

### `CREObservation`

| Field | Type | Notes |
| --- | --- | --- |
| `metric` | `cap_rate \| hard_cost \| soft_cost \| construction_index \| construction_cost_change` | Concepts are never blended. |
| `assetClass` | `CREAssetClass` | Broad class only. |
| `propertySubtype` | `string?` | Source-native subtype, e.g. `office_prime`. First-class, not a tag. |
| `propertyClass` | `A \| B \| C \| unspecified` | Never inferred from another classification. |
| `locationType` | `cbd \| suburban \| urban \| unspecified` | Never inferred from a metro-wide figure. |
| `capRateType` | `stabilized \| value_add \| going_in \| exit \| transaction \| net_lease` | Required for `cap_rate`. |
| `geography` | `CREGeography` | country / region / metro / city / submarket. |
| `value` | `number?` | **Omitted when the publisher printed a range.** |
| `low` / `high` | `number?` | Preserved verbatim from the source. |
| `unit` / `basis` | `string` / `CostBasis?` | e.g. `USD_per_sf` / `per_sf`. |
| `source` | `CRESource` | Carries the registry `sourceId`. |
| `citation` | `CRECitation` | Mandatory on everything in `data/`. |
| `sourceQuality` | `number` | 0–100, supplied explicitly, never inferred from publisher name. |
| `tags` | `Record<string,string>?` | Genuinely source-specific extras **only**. |

`propertyClass`, `locationType`, `capRateType` and `propertySubtype` are
first-class fields precisely so they cannot be buried in `tags`. A test enforces
that `tags` never contains `class`, `location`, or `subtype` keys.

### `CRECitation` — the citation standard

Every observation must be independently re-findable. All seven fields required:

`sourceName`, `reportTitle`, `publicationDate`, `period`, `locator`,
`sourceUrl`, `retrievedAt`.

`"CBRE"` is not a citation. `"CBRE Cap Rate Survey"` is not a citation. Tests
assert the report title differs from the publisher name and names a year, and
that the locator matches `table|figure|chart|page|section`.

### `CREDataGap`

Records a deliberate absence: `metric`, optional `assetClass`/`propertySubtype`,
`geography`, `reason`, `sourcesChecked`, `checkedAt`. The `reason` must state a
source fact ("Houston does not appear in RLB's city list"), never an intention
("TODO: add later"). Tests reject TODO-shaped reasons.

### Ranges and midpoints

When a publisher prints `$X–$Y/SF`, E86 stores `low` and `high` and leaves
`value` undefined. `rangeMidpoint(obs)` computes a midpoint on demand as an
explicitly derived value; it never writes back into the observation.

## What is actually populated

### Cap rates — `data/cap-rates-us.ts`

**Zero observations.** Not an oversight; see the file header for the full search
record. CBRE's U.S. Cap Rate Survey H1 2026 (published 2026-08-12) gates every
market-level table behind a download; Marcus & Millichap's market-report service
was unavailable; secondary aggregations carry no report/table traceability.

20 gaps are recorded (5 priority cities × 4 asset classes).

### Construction costs — `data/construction-costs-us.ts`

Single source: **RLB Quarterly Construction Cost Report, North America, Q2 2026**
(published 2026-06-24, retrieved 2026-09-10).

| Group | Count | Shape |
| --- | --- | --- |
| Hard cost `$/SF` | 28 | 4 cities × 7 building types, low/high ranges |
| City index levels | 8 | 4 cities × April 2025 + April 2026 |
| City annual change | 4 | published %, reconciled against index levels |
| National index (NCCI) | 13 | Q2 2023 – Q2 2026 quarterly series |
| **Total** | **53** | |

Cities covered: **Austin, Miami, Seattle, Phoenix**. Houston is absent — RLB
does not list it.

Building types are RLB's own: `office_prime`, `office_secondary`,
`retail_shopping_center`, `retail_strip`, `hotel_5_star`, `hotel_3_star`,
`hospital_general`. There is no multifamily or industrial line in the report.

### Units, stated by the source

RLB's table footnote: *"Values of U.S. locations represent hard construction
costs based on U.S. dollars per square foot of gross floor area."* That sentence
is the entire basis for `hard_cost` / `per_sf` / `USD_per_sf`. Soft costs, land
and fees are excluded.

## Concept separation

Never conflated, each with its own metric:

- **hard construction cost** — `hard_cost`, `USD_per_sf`
- **construction-cost index** — `construction_index`, index points
- **construction inflation** — `construction_cost_change`, percent
- **construction spending** — not stored; registry-only (US Census C30)

An inflation percentage is not a `$/SF` benchmark. A test asserts
`construction_cost_change` observations carry `unit: "percent"` and no `basis`.

Cap-rate concepts are likewise separated by `capRateType`;
`assertComparableCapRates()` throws if a consensus call mixes them or if any
cap-rate observation fails to declare one.

## Extraction hazard (read before editing construction data)

Text-extracting the RLB PDF **misaligns the "Annual % Change" column by one row**
from Boston onward. A naive read produces Miami 4.15%, Phoenix 4.46%, Seattle
4.09% — all wrong. The correct values were derived from the report's own
April-2025 and April-2026 index levels and cross-checked against RLB's regional
summary pages; all 13 U.S. cities reconciled against both:

| City | Naive (wrong) | Verified |
| --- | --- | --- |
| Austin | 4.57% | 4.57% |
| Miami | 4.15% | **4.99%** |
| Phoenix | 4.46% | **5.30%** |
| Seattle | 4.09% | **4.65%** |

A test (`published annual change reconciles with the published index levels`)
locks this in.

## Government sources

FRED and Zillow are **not** cap-rate sources and are not registered as such.
They may supply interest rates, construction indexes, permits, spending, and
housing/rental statistics — never a relabelled commercial cap rate. This rule
exists because E30 previously carried `FRED, Zillow`-tagged cap rates; see
`docs/e86-mapping.md` for the correction record.

## Redistribution

`isRedistributable(source)` returns true only for government sources with
`access: "public_data"` **and** `redistribution: "public_data_terms"`. A report
being free to download (`public_report`, e.g. RLB) does **not** make it
redistributable. Paid and license-required sources never qualify.

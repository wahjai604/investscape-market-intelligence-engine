/**
 * InvestScape™ E68 — U.S. construction-cost observations.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * SINGLE SOURCE FOR THIS FILE
 *   RLB Quarterly Construction Cost Report, North America, Q2 2026
 *   Rider Levett Bucknall · published 2026-07-07 · retrieved 2026-09-10
 *
 * PHASE 4C AUDIT CORRECTION (2026-09-11)
 *   publicationDate was wrongly set to 2026-06-24 -- that is RLB's separately
 *   published "Central Q2 2026" REGIONAL page's date, mistakenly applied to
 *   this citation. The actual North America report cited here (URL below) has
 *   its own creation/modification date of 2026-07-07 in its PDF metadata,
 *   confirmed on re-fetch, and its filename literally encodes it
 *   ("Q2-2026-QCR_7.7.2026.pdf" = July 7, 2026). Corrected across all 53
 *   observations that share this citation.
 *
 *   Also corrected: Seattle's construction_cost_change was 4.65%, taken from
 *   RLB's separate "West Q2 2026" regional summary text rather than computed
 *   from the actual table cited here. The North America report's own index
 *   values (26,703 -> 27,943) compute to 4.64%, not 4.65% -- reconfirmed by
 *   independent re-derivation on 2026-09-11. Corrected to 4.64%.
 *   https://www.rlb.com/wp-content/uploads/sites/4/2026/06/Q2-2026-QCR_7.7.2026.pdf
 *
 * WHY THE $/SF FIGURES ARE hard_cost AND NOTHING ELSE
 *   The report's own footnote to the "Indicative Construction Costs" table
 *   reads: "Values of U.S. locations represent hard construction costs based on
 *   U.S. dollars per square foot of gross floor area." That sentence is the
 *   entire basis for `metric: "hard_cost"`, `basis: "per_sf"` and
 *   `unit: "USD_per_sf"` below. No soft costs, land, or fees are included.
 *
 * WHY THERE ARE NO MIDPOINTS
 *   RLB publishes low/high ranges. `value` is therefore left undefined on every
 *   $/SF observation. Use `rangeMidpoint()` at read time if a single number is
 *   needed; E68 does not bake one in.
 *
 * EXTRACTION HAZARD — READ BEFORE EDITING
 *   Text-extracting this PDF misaligns the "Annual % Change" column by one row
 *   from Boston onward (a naive read yields Miami 4.15%, Phoenix 4.46%,
 *   Seattle 4.09% — all wrong). Every percentage in this file was instead
 *   derived from the report's own April-2025 and April-2026 index levels and
 *   then cross-checked against RLB's regional summary pages:
 *     Central Q2 2026 https://www.rlb.com/americas/insight/rlb-construction-cost-report-central-q2-2026/
 *     West Q2 2026    https://www.rlb.com/americas/insight/rlb-construction-cost-report-west-q2-2026/
 *   All 13 U.S. cities reconciled to both. Re-verify the same way if you touch
 *   these numbers.
 *
 * OFFICE "PRIME"/"SECONDARY" IS NOT CLASS A/B
 *   RLB grades construction cost tiers; CBRE grades investment quality. They
 *   are different classifications with different definitions, so propertyClass
 *   stays "unspecified" on every row here and the RLB grade lives in
 *   propertySubtype. Do not "upgrade" these to Class A/B.
 */
import type { CRECitation, CRECitedObservation, CREDataGap, CRESource } from "../types";

const RLB_SOURCE: CRESource = {
  sourceId: "rlb-north-america",
  sourceName: "Rider Levett Bucknall",
  sourceType: "construction_cost",
  methodologyUrl: "https://www.rlb.com/americas/insight/rlb-construction-cost-report-north-america-q2-2026/",
  retrievedAt: "2026-09-10",
  licenseNotes:
    "Publicly downloadable report. Redistribution not assumed — figures are stored as cited observations, not as a copy of the report.",
};

const RLB_URL = "https://www.rlb.com/wp-content/uploads/sites/4/2026/06/Q2-2026-QCR_7.7.2026.pdf";
const RLB_TITLE = "RLB Quarterly Construction Cost Report — North America, Q2 2026";

function cite(locator: string, period: string): CRECitation {
  return {
    sourceName: "Rider Levett Bucknall",
    reportTitle: RLB_TITLE,
    publicationDate: "2026-07-07",
    period,
    locator,
    sourceUrl: RLB_URL,
    retrievedAt: "2026-09-10",
  };
}

/** RLB's seven U.S. building types, verbatim from the table's column headers. */
type RlbSubtype =
  | "office_prime"
  | "office_secondary"
  | "retail_shopping_center"
  | "retail_strip"
  | "hotel_5_star"
  | "hotel_3_star"
  | "hospital_general";

const SUBTYPE_ASSET_CLASS: Record<RlbSubtype, CRECitedObservation["assetClass"]> = {
  office_prime: "office",
  office_secondary: "office",
  retail_shopping_center: "retail",
  retail_strip: "retail",
  hotel_5_star: "hotel",
  hotel_3_star: "hotel",
  hospital_general: "healthcare",
};

/** Column header text for each subtype, used to build a precise locator. */
const SUBTYPE_LOCATOR: Record<RlbSubtype, string> = {
  office_prime: "Offices / Prime",
  office_secondary: "Offices / Secondary",
  retail_shopping_center: "Retail / Shopping Center",
  retail_strip: "Retail / Strip",
  hotel_5_star: "Hotels / 5 Star",
  hotel_3_star: "Hotels / 3 Star",
  hospital_general: "Hospital / General",
};

function hardCost(
  city: string,
  region: string,
  metro: string,
  subtype: RlbSubtype,
  low: number,
  high: number,
): CRECitedObservation {
  return {
    metric: "hard_cost",
    assetClass: SUBTYPE_ASSET_CLASS[subtype],
    propertySubtype: subtype,
    propertyClass: "unspecified",
    locationType: "unspecified",
    geography: { country: "US", region, metro, city },
    periodStart: "2026-04-01",
    periodEnd: "2026-06-30",
    low,
    high,
    unit: "USD_per_sf",
    basis: "per_sf",
    source: RLB_SOURCE,
    citation: cite(
      `Table "Indicative Construction Costs" — USA / ${city} / ${SUBTYPE_LOCATOR[subtype]}`,
      "Q2 2026",
    ),
    sourceQuality: 94,
  };
}

/**
 * The four priority cities RLB actually covers, with their seven building
 * types. Houston is absent from RLB's U.S. city list entirely — see
 * US_CONSTRUCTION_COST_GAPS.
 */
const CITY_COSTS: Array<{
  city: string;
  region: string;
  metro: string;
  costs: Record<RlbSubtype, [number, number]>;
}> = [
  {
    city: "Austin",
    region: "TX",
    metro: "Austin, TX",
    costs: {
      office_prime: [255, 425],
      office_secondary: [165, 230],
      retail_shopping_center: [205, 335],
      retail_strip: [195, 260],
      hotel_5_star: [430, 590],
      hotel_3_star: [305, 450],
      hospital_general: [480, 680],
    },
  },
  {
    city: "Miami",
    region: "FL",
    metro: "Miami, FL",
    costs: {
      office_prime: [260, 445],
      office_secondary: [170, 240],
      retail_shopping_center: [215, 350],
      retail_strip: [185, 285],
      hotel_5_star: [470, 630],
      hotel_3_star: [325, 430],
      hospital_general: [505, 715],
    },
  },
  {
    city: "Seattle",
    region: "WA",
    metro: "Seattle, WA",
    costs: {
      office_prime: [380, 675],
      office_secondary: [250, 350],
      retail_shopping_center: [280, 455],
      retail_strip: [215, 340],
      hotel_5_star: [495, 750],
      hotel_3_star: [350, 495],
      hospital_general: [665, 940],
    },
  },
  {
    city: "Phoenix",
    region: "AZ",
    metro: "Phoenix, AZ",
    costs: {
      office_prime: [270, 465],
      office_secondary: [180, 245],
      retail_shopping_center: [220, 370],
      retail_strip: [130, 215],
      hotel_5_star: [435, 675],
      hotel_3_star: [230, 350],
      hospital_general: [530, 745],
    },
  },
];

/** 28 observations: 4 covered cities x 7 RLB building types. */
export const US_HARD_COST_OBSERVATIONS: readonly CRECitedObservation[] = CITY_COSTS.flatMap(
  ({ city, region, metro, costs }) =>
    (Object.keys(costs) as RlbSubtype[]).map((subtype) =>
      hardCost(city, region, metro, subtype, costs[subtype][0], costs[subtype][1]),
    ),
);

/**
 * RLB's city-level "Comparative Cost Index" levels. These are index points, not
 * dollars — never treat them as a $/SF figure. April 2025 is carried alongside
 * April 2026 so escalation is computable from two published levels rather than
 * from a percentage someone rounded.
 */
const CITY_INDEX: Array<{ city: string; region: string; metro: string; apr2025: number; apr2026: number; pctPublished: number }> = [
  { city: "Austin", region: "TX", metro: "Austin, TX", apr2025: 19_560, apr2026: 20_453, pctPublished: 4.57 },
  { city: "Miami", region: "FL", metro: "Miami, FL", apr2025: 20_121, apr2026: 21_126, pctPublished: 4.99 },
  { city: "Seattle", region: "WA", metro: "Seattle, WA", apr2025: 26_703, apr2026: 27_943, pctPublished: 4.64 }, // corrected 2026-09-11, was 4.65 (see file header)
  { city: "Phoenix", region: "AZ", metro: "Phoenix, AZ", apr2025: 20_942, apr2026: 22_052, pctPublished: 5.30 },
];

export const US_CITY_CONSTRUCTION_INDEX_OBSERVATIONS: readonly CRECitedObservation[] = CITY_INDEX.flatMap(
  ({ city, region, metro, apr2025, apr2026 }) => [
    {
      metric: "construction_index" as const,
      assetClass: "other" as const,
      geography: { country: "US" as const, region, metro, city },
      periodStart: "2025-04-01",
      periodEnd: "2025-04-30",
      value: apr2025,
      unit: "index",
      basis: "index" as const,
      source: RLB_SOURCE,
      citation: cite(`Table "Comparative Cost Index" — ${city} / April 2025`, "April 2025"),
      sourceQuality: 94,
    },
    {
      metric: "construction_index" as const,
      assetClass: "other" as const,
      geography: { country: "US" as const, region, metro, city },
      periodStart: "2026-04-01",
      periodEnd: "2026-04-30",
      value: apr2026,
      unit: "index",
      basis: "index" as const,
      source: RLB_SOURCE,
      citation: cite(`Table "Comparative Cost Index" — ${city} / April 2026`, "April 2026"),
      sourceQuality: 94,
    },
  ],
);

/**
 * Published annual cost change. Kept as its own metric so it can never be
 * mistaken for a $/SF benchmark (E68 rule: an inflation percentage is not a
 * cost). Each value was reconciled against the index levels above.
 */
export const US_CITY_CONSTRUCTION_CHANGE_OBSERVATIONS: readonly CRECitedObservation[] = CITY_INDEX.map(
  ({ city, region, metro, pctPublished }) => ({
    metric: "construction_cost_change" as const,
    assetClass: "other" as const,
    geography: { country: "US" as const, region, metro, city },
    periodStart: "2025-04-01",
    periodEnd: "2026-04-30",
    value: pctPublished,
    unit: "percent",
    source: RLB_SOURCE,
    citation: cite(
      `Table "Comparative Cost Index" — ${city} / Annual % Change (April 2025 to April 2026)`,
      "April 2025 - April 2026",
    ),
    sourceQuality: 94,
  }),
);

/**
 * RLB National Construction Cost Index, the full published quarterly series.
 * This is the escalation input for `escalateCost()`; it is national and carries
 * no city dimension by design.
 */
const NCCI_SERIES: Array<[string, string, string, number]> = [
  ["Q2 2023", "2023-04-01", "2023-06-30", 251.34],
  ["Q3 2023", "2023-07-01", "2023-09-30", 255.24],
  ["Q4 2023", "2023-10-01", "2023-12-31", 258.62],
  ["Q1 2024", "2024-01-01", "2024-03-31", 262.0],
  ["Q2 2024", "2024-04-01", "2024-06-30", 264.94],
  ["Q3 2024", "2024-07-01", "2024-09-30", 267.77],
  ["Q4 2024", "2024-10-01", "2024-12-31", 270.75],
  ["Q1 2025", "2025-01-01", "2025-03-31", 273.41],
  ["Q2 2025", "2025-04-01", "2025-06-30", 276.51],
  ["Q3 2025", "2025-07-01", "2025-09-30", 279.82],
  ["Q4 2025", "2025-10-01", "2025-12-31", 282.64],
  ["Q1 2026", "2026-01-01", "2026-03-31", 285.47],
  ["Q2 2026", "2026-04-01", "2026-06-30", 288.58],
];

export const US_NATIONAL_CONSTRUCTION_INDEX_OBSERVATIONS: readonly CRECitedObservation[] =
  NCCI_SERIES.map(([period, periodStart, periodEnd, value]) => ({
    metric: "construction_index" as const,
    assetClass: "other" as const,
    geography: { country: "US" as const },
    periodStart,
    periodEnd,
    value,
    unit: "index",
    basis: "index" as const,
    source: RLB_SOURCE,
    citation: cite(`Chart/table "National Construction Cost Index" — ${period}`, period),
    sourceQuality: 94,
  }));

export const US_CONSTRUCTION_COST_OBSERVATIONS: readonly CRECitedObservation[] = [
  ...US_HARD_COST_OBSERVATIONS,
  ...US_CITY_CONSTRUCTION_INDEX_OBSERVATIONS,
  ...US_CITY_CONSTRUCTION_CHANGE_OBSERVATIONS,
  ...US_NATIONAL_CONSTRUCTION_INDEX_OBSERVATIONS,
];

/**
 * Deliberate absences. Each one is a source fact that was checked, not a TODO.
 */
export const US_CONSTRUCTION_COST_GAPS: readonly CREDataGap[] = [
  {
    metric: "hard_cost",
    geography: { country: "US", region: "TX", metro: "Houston, TX", city: "Houston" },
    reason:
      "Houston does not appear in the RLB Q2 2026 U.S. city list (Austin, Boston, Charlotte, Chicago, Dallas, Denver, Honolulu, Las Vegas, Los Angeles, Miami, Minneapolis, Nashville, New York, Phoenix, Portland, San Francisco, Seattle, Washington DC). Dallas is covered but is a different metro and is not a substitute.",
    sourcesChecked: ["rlb-north-america"],
    checkedAt: "2026-09-10",
  },
  {
    metric: "hard_cost",
    assetClass: "multifamily",
    geography: { country: "US" },
    reason:
      "RLB's public North America report carries no multifamily/residential line at all — its U.S. table covers only offices (prime/secondary), retail (shopping center/strip), hotels (5/3 star) and general hospital. No multifamily $/SF benchmark can be derived from it without inventing one.",
    sourcesChecked: ["rlb-north-america"],
    checkedAt: "2026-09-10",
  },
  {
    metric: "hard_cost",
    assetClass: "industrial",
    geography: { country: "US" },
    reason: "No industrial building type in the RLB Q2 2026 U.S. Indicative Construction Costs table.",
    sourcesChecked: ["rlb-north-america"],
    checkedAt: "2026-09-10",
  },
  {
    metric: "soft_cost",
    geography: { country: "US" },
    reason:
      "RLB publishes hard construction cost only (explicit in the table footnote). No soft-cost percentage is published, and deriving one from hard cost would be fabrication.",
    sourcesChecked: ["rlb-north-america"],
    checkedAt: "2026-09-10",
  },
];

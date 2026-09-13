/**
 * InvestScape™ E88 Phase 3 — RLB backfill (additional cities, same report).
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * E88's own data layer — NOT a modification of E86's
 * `src/cre-intelligence/data/construction-costs-us.ts`. That file remains
 * frozen and unchanged. This file adds NEW observations from the SAME
 * already-cited, already-licensed-reviewed RLB report, using E86's
 * `CRECitedObservation` type (read-only import) but constructing new data
 * objects owned entirely by E88, per Phase 3 Part 2's instruction: "add them
 * through E88's source/data layer."
 *
 * SOURCE (same report E86 already cites; re-fetched and re-verified for this
 * phase, not a new source):
 *   RLB Quarterly Construction Cost Report, North America, Q2 2026
 *   Rider Levett Bucknall · published 2026-07-07 · re-retrieved 2026-09-11
 *   https://www.rlb.com/wp-content/uploads/sites/4/2026/06/Q2-2026-QCR_7.7.2026.pdf
 *
 * CROSS-VALIDATION PERFORMED BEFORE TRUSTING THIS EXTRACTION
 *   The report was re-fetched and run through `pdftotext -layout` (not a
 *   heuristic AI summary of the PDF — a byte-accurate text layer extraction).
 *   The "INDICATIVE CONSTRUCTION COSTS" table's rows for Austin, Miami,
 *   Seattle, and Phoenix were compared against E86's already-audited
 *   `US_HARD_COST_OBSERVATIONS` figures and matched EXACTLY, digit for digit,
 *   across all 7 building-type columns for all 4 cities. This is the basis
 *   for trusting this table's extraction for the 14 additional US cities and
 *   2 Canadian cities below — the same table, the same extraction method,
 *   independently confirmed accurate against known-good data.
 *
 * WHAT IS DELIBERATELY NOT INCLUDED HERE (see Phase 3 doc Section 2/9 for why)
 *   - The report's "COMPARATIVE COST INDEX" table (city index levels /
 *     annual % change) is NOT backfilled for these cities. E86's own file
 *     header documents that THIS SAME table's extraction misaligned columns
 *     for the original 4 cities and required manual cross-referencing
 *     against RLB's separate regional summary pages before being trusted.
 *     That same cross-referencing has not been performed for the other 16
 *     cities in this phase, so backfilling their index figures now would
 *     repeat the exact failure mode E86's own audit correction exists to
 *     warn against. Left as an explicit gap, not backfilled speculatively.
 *   - The report's second building-cost table (Industrial Warehouse,
 *     Parking, Residential Multi-Family/Single-Family, Education) is NOT
 *     ingested at all in this phase. See docs/E88-phase3-coverage-and-
 *     source-backfill.md Section 2 ("Major discovery pending verification")
 *     for the full explanation: this table's own column-header text
 *     extracted mis-ordered/overlapping across multiple physical lines, so
 *     — unlike the table below — there is no known-good baseline to validate
 *     the column-to-category mapping against. Per Phase 3's own instruction
 *     ("document it and stop for review rather than silently changing
 *     semantics"), this is flagged for manual review, not guessed at.
 *   - Houston remains absent. It is genuinely not in RLB's U.S. city list in
 *     this report (confirmed again on this re-fetch) — matches E86's
 *     existing `US_CONSTRUCTION_COST_GAPS` entry exactly; no change needed.
 *
 * CURRENCY: the report's own footnote states Canadian-location values are in
 * CAD, U.S.-location values in USD. Calgary and Toronto below are therefore
 * recorded with `unit: "CAD_per_sf"`, never silently treated as USD.
 */
import type { CRECitation, CRECitedObservation, CRESource } from "../../cre-intelligence/types";

const RLB_SOURCE: CRESource = {
  sourceId: "rlb-north-america",
  sourceName: "Rider Levett Bucknall",
  sourceType: "construction_cost",
  methodologyUrl: "https://www.rlb.com/americas/insight/rlb-construction-cost-report-north-america-q2-2026/",
  retrievedAt: "2026-09-11",
  licenseNotes:
    "Publicly downloadable report. Redistribution not assumed — figures are stored as cited observations, not as a copy of the report. Same source/report E86 already cites; re-fetched and re-verified for E88 Phase 3.",
};

const RLB_URL = "https://www.rlb.com/wp-content/uploads/sites/4/2026/06/Q2-2026-QCR_7.7.2026.pdf";
const RLB_TITLE = "RLB Quarterly Construction Cost Report — North America, Q2 2026";

function cite(locator: string): CRECitation {
  return {
    sourceName: "Rider Levett Bucknall",
    reportTitle: RLB_TITLE,
    publicationDate: "2026-07-07",
    period: "Q2 2026",
    locator,
    sourceUrl: RLB_URL,
    retrievedAt: "2026-09-11",
    methodologyNote:
      "Re-extracted via pdftotext -layout on 2026-09-11 and cross-validated against E86's existing Austin/Miami/Seattle/Phoenix hard-cost figures (exact match) before being trusted for these additional cities.",
  };
}

/** Identical to E86's RlbSubtype union — same 7 columns, same report table. */
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
  country: "US" | "CA",
  region: string,
  metro: string,
  currencyUnit: "USD_per_sf" | "CAD_per_sf",
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
    geography: { country, region, metro, city },
    periodStart: "2026-04-01",
    periodEnd: "2026-06-30",
    low,
    high,
    unit: currencyUnit,
    basis: "per_sf",
    source: RLB_SOURCE,
    citation: cite(`Table "Indicative Construction Costs" — ${country === "US" ? "USA" : "Canada"} / ${city} / ${SUBTYPE_LOCATOR[subtype]}`),
    sourceQuality: 94,
  };
}

/**
 * 14 additional U.S. cities from the same "Indicative Construction Costs"
 * table, verbatim from the report (see cross-validation note above). Austin,
 * Miami, Seattle, Phoenix are deliberately excluded — already in E86.
 * Houston is deliberately excluded — genuinely absent from the source.
 */
const US_CITY_COSTS: Array<{ city: string; region: string; metro: string; costs: Record<RlbSubtype, [number, number]> }> = [
  { city: "Boston", region: "MA", metro: "Boston, MA", costs: { office_prime: [460, 725], office_secondary: [285, 425], retail_shopping_center: [250, 400], retail_strip: [175, 280], hotel_5_star: [500, 850], hotel_3_star: [350, 575], hospital_general: [625, 1200] } },
  { city: "Charlotte", region: "NC", metro: "Charlotte, NC", costs: { office_prime: [360, 600], office_secondary: [260, 360], retail_shopping_center: [215, 360], retail_strip: [200, 285], hotel_5_star: [475, 650], hotel_3_star: [330, 435], hospital_general: [710, 985] } },
  { city: "Chicago", region: "IL", metro: "Chicago, IL", costs: { office_prime: [355, 580], office_secondary: [215, 350], retail_shopping_center: [220, 465], retail_strip: [170, 280], hotel_5_star: [530, 810], hotel_3_star: [385, 515], hospital_general: [455, 925] } },
  { city: "Dallas", region: "TX", metro: "Dallas, TX", costs: { office_prime: [260, 435], office_secondary: [160, 235], retail_shopping_center: [210, 345], retail_strip: [195, 265], hotel_5_star: [440, 605], hotel_3_star: [310, 455], hospital_general: [485, 695] } },
  { city: "Denver", region: "CO", metro: "Denver, CO", costs: { office_prime: [350, 575], office_secondary: [250, 350], retail_shopping_center: [235, 385], retail_strip: [235, 350], hotel_5_star: [485, 720], hotel_3_star: [350, 525], hospital_general: [700, 1000] } },
  { city: "Honolulu", region: "HI", metro: "Honolulu, HI", costs: { office_prime: [395, 665], office_secondary: [255, 385], retail_shopping_center: [315, 635], retail_strip: [295, 485], hotel_5_star: [755, 910], hotel_3_star: [435, 685], hospital_general: [585, 980] } },
  { city: "Las Vegas", region: "NV", metro: "Las Vegas, NV", costs: { office_prime: [285, 505], office_secondary: [205, 270], retail_shopping_center: [180, 685], retail_strip: [165, 370], hotel_5_star: [450, 830], hotel_3_star: [265, 455], hospital_general: [570, 680] } },
  { city: "Los Angeles", region: "CA", metro: "Los Angeles, CA", costs: { office_prime: [275, 415], office_secondary: [215, 305], retail_shopping_center: [195, 405], retail_strip: [160, 235], hotel_5_star: [440, 685], hotel_3_star: [315, 420], hospital_general: [705, 1070] } },
  { city: "Minneapolis", region: "MN", metro: "Minneapolis, MN", costs: { office_prime: [430, 700], office_secondary: [300, 430], retail_shopping_center: [245, 430], retail_strip: [245, 330], hotel_5_star: [555, 760], hotel_3_star: [395, 575], hospital_general: [845, 1215] } },
  { city: "Nashville", region: "TN", metro: "Nashville, TN", costs: { office_prime: [370, 610], office_secondary: [265, 370], retail_shopping_center: [215, 370], retail_strip: [200, 290], hotel_5_star: [480, 660], hotel_3_star: [335, 445], hospital_general: [725, 1000] } },
  { city: "New York", region: "NY", metro: "New York, NY", costs: { office_prime: [425, 985], office_secondary: [245, 610], retail_shopping_center: [365, 730], retail_strip: [385, 775], hotel_5_star: [530, 795], hotel_3_star: [385, 530], hospital_general: [655, 1000] } },
  { city: "Portland", region: "OR", metro: "Portland, OR", costs: { office_prime: [350, 450], office_secondary: [325, 425], retail_shopping_center: [325, 425], retail_strip: [300, 375], hotel_5_star: [575, 750], hotel_3_star: [450, 650], hospital_general: [1050, 1350] } },
  { city: "San Francisco", region: "CA", metro: "San Francisco, CA", costs: { office_prime: [460, 800], office_secondary: [360, 600], retail_shopping_center: [350, 715], retail_strip: [360, 720], hotel_5_star: [580, 1100], hotel_3_star: [430, 660], hospital_general: [785, 1500] } },
  { city: "Washington", region: "DC", metro: "Washington, DC", costs: { office_prime: [350, 580], office_secondary: [240, 380], retail_shopping_center: [190, 340], retail_strip: [155, 255], hotel_5_star: [445, 690], hotel_3_star: [290, 455], hospital_general: [535, 950] } },
];

export const RLB_BACKFILL_US_HARD_COST_OBSERVATIONS: readonly CRECitedObservation[] = US_CITY_COSTS.flatMap(
  ({ city, region, metro, costs }) =>
    (Object.keys(costs) as RlbSubtype[]).map((subtype) =>
      hardCost(city, "US", region, metro, "USD_per_sf", subtype, costs[subtype][0], costs[subtype][1]),
    ),
);

/**
 * Canadian cities from the same table. The report's own footnote states
 * Canadian-location values are in CAD — recorded as such here, never
 * silently treated as USD or converted (Phase 1 Section 13 / Phase 2
 * currency model: no invented FX rate, and this isn't even a conversion,
 * just correctly labeling the source's own stated currency).
 */
const CANADA_CITY_COSTS: Array<{ city: string; region: string; metro: string; costs: Record<RlbSubtype, [number, number]> }> = [
  { city: "Calgary", region: "AB", metro: "Calgary, AB", costs: { office_prime: [300, 450], office_secondary: [255, 305], retail_shopping_center: [250, 340], retail_strip: [150, 220], hotel_5_star: [325, 505], hotel_3_star: [245, 280], hospital_general: [730, 990] } },
  { city: "Toronto", region: "ON", metro: "Toronto, ON", costs: { office_prime: [315, 515], office_secondary: [265, 370], retail_shopping_center: [240, 500], retail_strip: [195, 250], hotel_5_star: [450, 835], hotel_3_star: [275, 325], hospital_general: [660, 1025] } },
];

export const RLB_BACKFILL_CANADA_HARD_COST_OBSERVATIONS: readonly CRECitedObservation[] = CANADA_CITY_COSTS.flatMap(
  ({ city, region, metro, costs }) =>
    (Object.keys(costs) as RlbSubtype[]).map((subtype) =>
      hardCost(city, "CA", region, metro, "CAD_per_sf", subtype, costs[subtype][0], costs[subtype][1]),
    ),
);

/** 14 cities x 7 subtypes = 98, plus 2 cities x 7 subtypes = 14. Total 112. */
export const RLB_BACKFILL_HARD_COST_OBSERVATIONS: readonly CRECitedObservation[] = [
  ...RLB_BACKFILL_US_HARD_COST_OBSERVATIONS,
  ...RLB_BACKFILL_CANADA_HARD_COST_OBSERVATIONS,
];

/**
 * InvestScape™ E86 — Canadian cap-rate observations.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * SINGLE SOURCE FOR THIS FILE
 *   Cushman & Wakefield, Canadian Cap Rate & Capital Markets Report, Q2 2026
 *   Published 2026-07-28, retrieved 2026-09-11.
 *   https://content.cushmanwakefield.com/api/public/content/cef23b874a284c1caa8547cf3132048d?v=d321917a
 *
 * WHAT IS HERE AND WHY NOTHING ELSE IS
 *   The report has five cap-rate chart pages: Multifamily, Industrial, Retail,
 *   Office. Only the Multifamily page ("Multifamily Cap Rates — High Rise /
 *   Low Rise") prints a numeric label on every data point, per city. The
 *   Industrial, Retail and Office pages are national historical trend lines
 *   with axis gridlines but no per-point labels — reading a value off them
 *   would mean estimating a position on a curve, which is exactly the
 *   fabrication this project exists to prevent. Only Multifamily is stored.
 *
 *   pdftotext cannot extract this chart: the numbers are vector graphics, not
 *   text. Values below were read from the page rendered as an image (150 DPI,
 *   via PyMuPDF) and transcribed directly from the visible labels — not
 *   estimated from bar/dot position.
 *
 * NINE OF TEN PRIORITY CITIES, NOT TEN
 *   Covered: Victoria, Vancouver, Calgary, Edmonton, Winnipeg,
 *   Kitchener/Waterloo (not a target city; included for completeness),
 *   Toronto, Ottawa, Montreal, Halifax.
 *   Not covered: St. John's. Absent from every Canadian brokerage report
 *   checked — Newfoundland's only market too small for national multifamily
 *   coverage, the same pattern as Yellowknife elsewhere in this codebase.
 *   See CA_CAP_RATE_GAPS.
 *
 * MIN/MAX ARE THE PUBLISHER'S RANGE, NOT A CONFIDENCE INTERVAL
 *   Stored as low/high. No midpoint is computed or stored.
 *
 * CAP RATE TYPE
 *   The report's own methodology note: "Cushman & Wakefield provides
 *   quarterly estimates of capitalization rates... based on our market
 *   expertise. The cap rate ranges are based on transaction data where
 *   possible, as well as demand and supply dynamics in the region." That is
 *   survey_estimate, not transaction: C&W synthesizes an estimate from
 *   transaction data plus market judgment, it does not report a computed
 *   average of closed sales the way Kidder Mathews does for its US cities.
 *
 * THESE ARE NOT THE ORIGIN OF THE REMOVED E30 LEGACY VALUES
 *   E30's legacy Toronto/Vancouver/Calgary/etc. figures were checked against
 *   these ranges before removal (see docs/E86-cap-rate-data-coverage.md §Canada).
 *   Two touch a range boundary by coincidence (Ottawa 5.0, Victoria 4.5);
 *   Calgary (5.8) and Winnipeg (6.2) fall entirely outside both ranges. The
 *   legacy values were not derived from this report.
 */
import type { CRECitedObservation, CREDataGap, CRESource } from "../types";

const CUSHMAN_WAKEFIELD_CANADA: CRESource = {
  sourceId: "cushman-wakefield-canada",
  sourceName: "Cushman & Wakefield Canada",
  sourceType: "brokerage",
  methodologyUrl: "https://www.cushmanwakefield.com/en/canada/insights/canadian-cap-rates-perspective-report",
  retrievedAt: "2026-09-11",
  licenseNotes: "Free public PDF. Redistribution not assumed.",
};

const REPORT_URL =
  "https://content.cushmanwakefield.com/api/public/content/cef23b874a284c1caa8547cf3132048d?v=d321917a";
const REPORT_TITLE = "Cushman & Wakefield Canadian Cap Rate & Capital Markets Report, Q2 2026";
const METHODOLOGY_NOTE =
  'Publisher wording: "quarterly estimates of capitalization rates... based on our market expertise. The cap rate ranges are based on transaction data where possible, as well as demand and supply dynamics in the region." Figures were read from a rendered chart image (page 12), not text-extracted — the PDF encodes these labels as vector graphics.';

type CityRange = { city: string; region?: string; metro: string; high: [number, number]; low: [number, number] };

// Page 12, "Multifamily Cap Rates". [min%, max%] as printed on the chart.
const CITY_RANGES: CityRange[] = [
  { city: "Victoria", region: "BC", metro: "Victoria, BC", high: [4.5, 5.25], low: [4.25, 5.5] },
  { city: "Vancouver", region: "BC", metro: "Vancouver, BC", high: [3.5, 4.5], low: [3.75, 4.75] },
  { city: "Calgary", region: "AB", metro: "Calgary, AB", high: [4.75, 5.5], low: [4.75, 5.5] },
  { city: "Edmonton", region: "AB", metro: "Edmonton, AB", high: [4.25, 5.25], low: [5.0, 6.0] },
  { city: "Winnipeg", region: "MB", metro: "Winnipeg, MB", high: [4.75, 5.5], low: [5.0, 5.75] },
  { city: "Kitchener/Waterloo", region: "ON", metro: "Kitchener-Waterloo, ON", high: [5.0, 5.5], low: [4.5, 5.25] },
  { city: "Toronto", region: "ON", metro: "Toronto, ON", high: [4.25, 5.0], low: [4.0, 4.75] },
  { city: "Ottawa", region: "ON", metro: "Ottawa, ON", high: [5.0, 6.0], low: [5.0, 6.0] },
  { city: "Montreal", region: "QC", metro: "Montreal, QC", high: [4.25, 5.25], low: [4.75, 5.75] },
  { city: "Halifax", region: "NS", metro: "Halifax, NS", high: [4.5, 5.5], low: [5.0, 6.0] },
];

function obs(
  city: CityRange,
  subtype: "high_rise" | "low_rise",
  range: [number, number],
): CRECitedObservation {
  return {
    metric: "cap_rate",
    assetClass: "multifamily",
    propertySubtype: subtype,
    propertyClass: "unspecified",
    locationType: "unspecified",
    capRateType: "survey_estimate",
    geography: { country: "CA", region: city.region, metro: city.metro, city: city.city },
    periodStart: "2026-04-01",
    periodEnd: "2026-06-30",
    low: range[0],
    high: range[1],
    unit: "percent",
    source: CUSHMAN_WAKEFIELD_CANADA,
    citation: {
      sourceName: "Cushman & Wakefield Canada",
      reportTitle: REPORT_TITLE,
      publicationDate: "2026-07-28",
      period: "Q2 2026",
      locator: `Page 12, chart "Multifamily Cap Rates" — ${subtype === "high_rise" ? "High Rise" : "Low Rise"} / ${city.city}`,
      sourceUrl: REPORT_URL,
      retrievedAt: "2026-09-11",
      methodologyNote: METHODOLOGY_NOTE,
    },
    sourceQuality: 88,
  };
}

/** 20 observations: 10 cities x {High Rise, Low Rise}. */
export const CA_CAP_RATE_OBSERVATIONS: readonly CRECitedObservation[] = CITY_RANGES.flatMap((city) => [
  obs(city, "high_rise", city.high),
  obs(city, "low_rise", city.low),
]);

export const CA_CAP_RATE_GAPS: readonly CREDataGap[] = [
  {
    metric: "cap_rate",
    assetClass: "multifamily",
    geography: { country: "CA", region: "NL", metro: "St. John's, NL", city: "St. John's" },
    reason:
      "St. John's does not appear in Cushman & Wakefield's Canadian multifamily cap-rate chart, nor in any other free Canadian brokerage report checked (CBRE Canada and Colliers Canada could not be retrieved — see below). Newfoundland's largest market is likely below the population/liquidity threshold national multifamily surveys cover, the same pattern documented for Yellowknife elsewhere in this file.",
    sourcesChecked: ["cushman-wakefield-canada"],
    checkedAt: "2026-09-11",
  },
  // Office, industrial and retail: the report has national historical trend
  // charts for all three, but none carries per-city numeric labels the way
  // Multifamily does. A national, unlabeled line is not a city observation.
  ...CITY_RANGES.flatMap((city) =>
    (["office", "industrial", "retail"] as const).map((assetClass) => ({
      metric: "cap_rate" as const,
      assetClass,
      geography: { country: "CA" as const, region: city.region, metro: city.metro, city: city.city },
      reason: `Cushman & Wakefield's Q2 2026 report carries a national historical ${assetClass} cap-rate trend line but no city-level table or labeled chart for ${assetClass} the way it does for multifamily. CBRE Canada's Q2 2026 Cap Rate & Investment Insights report explicitly covers ${assetClass} by city but could not be retrieved (Cloudflare bot-challenge blocked automated access on 2026-09-11, confirmed via direct HTTP request). Colliers Canada's Q2 2026 Cap Rate Report was equally inaccessible for the same reason.`,
      sourcesChecked: ["cushman-wakefield-canada", "cbre-ca-cap-rates", "colliers-ca-cap-rates"],
      checkedAt: "2026-09-11",
    })),
  ),
];

/**
 * InvestScape™ E68 — U.S. cap-rate observations.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Phase 4 found nothing. Phase 4A searched harder — past the CBRE landing page,
 * into free brokerage PDFs — and found four of the five priority cities.
 *
 * WHAT IS HERE
 *   Houston  Newmark, Class A Infill / A Suburban / B / C ranges (survey estimate)
 *   Phoenix  Kidder Mathews, average transaction cap rate, 3 quarters
 *   Seattle  Kidder Mathews, average transaction cap rate, 3 quarters
 *   Austin   Matthews, single market cap rate (survey estimate)
 *   Miami    nothing — see US_CAP_RATE_GAPS
 *
 * TWO FAMILIES, NEVER BLENDED
 *   Kidder's figures are computed from actual sales; Newmark's and Matthews'
 *   are publisher estimates of where the market is. `capRateType` keeps them
 *   apart and `assertComparableCapRates` refuses to average across them. There
 *   is no Austin-vs-Phoenix comparison to be made from this file without first
 *   deciding which family you mean.
 *
 * COSTAR SITS UNDER THREE OF THESE
 *   Kidder and Matthews both credit CoStar for the cap-rate figure. The report
 *   is free to read; the underlying dataset is not. `underlyingDataProvider`
 *   records that so nothing here looks more redistributable than it is.
 *
 * NO DERIVED TRANSACTION CAP RATES
 *   Part 3 asked whether public transaction records could yield NOI / price.
 *   The transaction tables in these reports (e.g. Kidder's Seattle sales list:
 *   "Corner 63, Roosevelt, 139 units, $59,250,000, $426,259/unit") publish the
 *   price and unit count but never the NOI. Without a disclosed NOI there is no
 *   cap rate to compute, so `derivedFrom` is unused and no such observation
 *   exists. A test enforces that any future one carries full arithmetic.
 */
import type { CRECitedObservation, CREDataGap, CRESource } from "../types";

const NEWMARK: CRESource = {
  sourceId: "newmark-research",
  sourceName: "Newmark",
  sourceType: "brokerage",
  methodologyUrl: "https://www.nmrk.com/insights/market-report/houston-multifamily-market-updates",
  retrievedAt: "2026-09-10",
  licenseNotes: "Free public PDF. Redistribution not assumed.",
};

const KIDDER: CRESource = {
  sourceId: "kidder-mathews-research",
  sourceName: "Kidder Mathews",
  sourceType: "brokerage",
  methodologyUrl: "https://kidder.com/market-reports/",
  retrievedAt: "2026-09-10",
  licenseNotes: "Free public PDF; cap-rate figures credited to CoStar, whose underlying dataset is proprietary.",
};

const MATTHEWS: CRESource = {
  sourceId: "matthews-research",
  sourceName: "Matthews Real Estate Investment Services",
  sourceType: "brokerage",
  methodologyUrl: "https://www.matthews.com/insights/",
  retrievedAt: "2026-09-10",
  licenseNotes: "Free public market report; cap rate credited to CoStar.",
};

// ---------------------------------------------------------------------------
// Houston — Newmark Houston Multifamily Market Report 2Q25, page 40
// ---------------------------------------------------------------------------
//
// Chart: "Newmark's Current Estimate of Houston Cap Rates". Values were read
// with `pdftotext -table`; the default layout mode scrambles this chart badly
// enough to be unusable, and raw mode pairs the labels ambiguously.
//
// IMPORTANT DISCREPANCY, RECORDED NOT RESOLVED: the chart's own footnote reads
// "SOURCE: Newmark, updated December 2024", while the PDF itself was created
// 2025-08-05 and the block is labelled "2Q25 Cap Rates". A December 2024 update
// cannot contain April–June 2025 data. E68 stores the periods exactly as the
// chart labels them and surfaces the contradiction in methodologyNote rather
// than silently picking one reading. Treat sourceQuality accordingly.
//
// The "Market Peak Cap Rates" block on the same chart is deliberately NOT
// stored: "market peak" names no period, and an observation without a period
// cannot satisfy E68's citation standard.

const HOUSTON_URL = "https://nmrk.imgix.net/uploads/fields/pdf-market-reports/2Q25-Houston-Multifamily-Market-Report.pdf";
const HOUSTON_NOTE =
  "Chart footnote reads 'SOURCE: Newmark, updated December 2024' although the block is labelled 2Q25 and the PDF was created 2025-08-05. Period stored as labelled by the publisher; the figure may be older than its label implies. Publisher estimate, not a transaction average.";

type HoustonRow = {
  label: string;
  subtype: string;
  propertyClass: CRECitedObservation["propertyClass"];
  locationType: CRECitedObservation["locationType"];
};

const HOUSTON_ROWS: HoustonRow[] = [
  { label: "Class A Infill", subtype: "class_a_infill", propertyClass: "A", locationType: "urban" },
  { label: "Class A Suburban", subtype: "class_a_suburban", propertyClass: "A", locationType: "suburban" },
  { label: "Class B", subtype: "class_b", propertyClass: "B", locationType: "unspecified" },
  { label: "Class C", subtype: "class_c", propertyClass: "C", locationType: "unspecified" },
];

/** [low, high] per row, in the row order above. */
const HOUSTON_BLOCKS: Array<{
  block: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  ranges: Array<[number, number]>;
}> = [
  {
    block: "2Q24 Cap Rates",
    period: "2Q 2024",
    periodStart: "2024-04-01",
    periodEnd: "2024-06-30",
    ranges: [
      [4.75, 5.25],
      [4.75, 5.25],
      [5.25, 5.75],
      [5.5, 6.0],
    ],
  },
  {
    block: "2Q25 Cap Rates",
    period: "2Q 2025",
    periodStart: "2025-04-01",
    periodEnd: "2025-06-30",
    ranges: [
      [4.75, 5.25],
      [4.75, 5.5],
      [5.5, 6.25],
      [6.5, 7.0],
    ],
  },
];

const HOUSTON_OBSERVATIONS: CRECitedObservation[] = HOUSTON_BLOCKS.flatMap(
  ({ block, period, periodStart, periodEnd, ranges }) =>
    HOUSTON_ROWS.map((row, i) => ({
      metric: "cap_rate" as const,
      assetClass: "multifamily" as const,
      propertySubtype: row.subtype,
      propertyClass: row.propertyClass,
      locationType: row.locationType,
      capRateType: "survey_estimate" as const,
      geography: { country: "US" as const, region: "TX", metro: "Houston, TX", city: "Houston" },
      periodStart,
      periodEnd,
      low: ranges[i][0],
      high: ranges[i][1],
      unit: "percent",
      source: NEWMARK,
      citation: {
        sourceName: "Newmark",
        reportTitle: "Newmark Houston Multifamily Market Report 2Q25",
        publicationDate: "2025-08-05",
        period,
        locator: `Page 40, chart "Newmark's Current Estimate of Houston Cap Rates" — ${block} / ${row.label}`,
        sourceUrl: HOUSTON_URL,
        retrievedAt: "2026-09-10",
        methodologyNote: HOUSTON_NOTE,
      },
      sourceQuality: 75,
    })),
);

// ---------------------------------------------------------------------------
// Phoenix and Seattle — Kidder Mathews Multifamily Market Trends, 2Q 2026
// ---------------------------------------------------------------------------
//
// Table "Market Breakdown", row "Average Cap Rate", columns 2Q26 / 1Q26 / 2Q25.
// These are averages of actual sales (the same table carries Average Sales
// Price/Unit), so capRateType is "transaction", not a publisher estimate.
// Data Source line in both PDFs: "Data Source: CoStar".

type KidderCity = {
  city: string;
  region: string;
  metro: string;
  url: string;
  publicationDate: string;
  /** [period label, periodStart, periodEnd, value] */
  quarters: Array<[string, string, string, number]>;
};

const KIDDER_CITIES: KidderCity[] = [
  {
    city: "Phoenix",
    region: "AZ",
    metro: "Phoenix, AZ",
    url: "https://kidder.com/wp-content/uploads/market_report/multifamily-market-research-phoenix-2026-2q.pdf",
    publicationDate: "2026-07-09",
    quarters: [
      ["2Q 2026", "2026-04-01", "2026-06-30", 5.8],
      ["1Q 2026", "2026-01-01", "2026-03-31", 6.2],
      ["2Q 2025", "2025-04-01", "2025-06-30", 6.6],
    ],
  },
  {
    city: "Seattle",
    region: "WA",
    metro: "Seattle, WA",
    url: "https://kidder.com/wp-content/uploads/market_report/multifamily-market-research-seattle-2026-2q.pdf",
    publicationDate: "2026-07-10",
    quarters: [
      ["2Q 2026", "2026-04-01", "2026-06-30", 5.7],
      ["1Q 2026", "2026-01-01", "2026-03-31", 5.6],
      ["2Q 2025", "2025-04-01", "2025-06-30", 5.6],
    ],
  },
];

const KIDDER_OBSERVATIONS: CRECitedObservation[] = KIDDER_CITIES.flatMap(
  ({ city, region, metro, url, publicationDate, quarters }) =>
    quarters.map(([period, periodStart, periodEnd, value]) => ({
      metric: "cap_rate" as const,
      assetClass: "multifamily" as const,
      // The table publishes one market-wide average with no class or geography
      // split. Inventing either would be exactly the inference E68 forbids.
      propertyClass: "unspecified" as const,
      locationType: "unspecified" as const,
      capRateType: "transaction" as const,
      geography: { country: "US" as const, region, metro, city },
      periodStart,
      periodEnd,
      value,
      unit: "percent",
      source: KIDDER,
      citation: {
        sourceName: "Kidder Mathews",
        reportTitle: `Kidder Mathews ${city} Multifamily Market Trends, 2Q 2026`,
        publicationDate,
        period,
        locator: `Table "Market Breakdown" — row "Average Cap Rate", column ${period}`,
        sourceUrl: url,
        retrievedAt: "2026-09-10",
        underlyingDataProvider: "CoStar Group, Inc.",
        methodologyNote:
          "Market-wide average cap rate across recorded sales; no property-class or CBD/suburban split is published. Underlying dataset is CoStar's and is proprietary.",
      },
      sourceQuality: 90,
    })),
);

// ---------------------------------------------------------------------------
// Austin — Matthews Austin, TX Multifamily Market Report Q1 2026
// ---------------------------------------------------------------------------
//
// Single figure in the report's "By the Numbers" section, credited to CoStar:
// "The market cap rate stood at 5.7%". The publisher's own words are "market
// cap rate" — a modelled market-wide figure rather than a stated average of
// closed sales — so it is filed as a survey estimate, not a transaction cap
// rate, and will not be averaged with Kidder's figures.

const AUSTIN_OBSERVATIONS: CRECitedObservation[] = [
  {
    metric: "cap_rate",
    assetClass: "multifamily",
    propertyClass: "unspecified",
    locationType: "unspecified",
    capRateType: "survey_estimate",
    geography: { country: "US", region: "TX", metro: "Austin, TX", city: "Austin" },
    periodStart: "2026-01-01",
    periodEnd: "2026-03-31",
    value: 5.7,
    unit: "percent",
    source: MATTHEWS,
    citation: {
      sourceName: "Matthews Real Estate Investment Services",
      reportTitle: "Matthews Austin, TX Multifamily Market Report Q1 2026",
      publicationDate: "2026-05-08",
      period: "Q1 2026",
      locator: 'Section "By the Numbers" — market cap rate',
      sourceUrl: "https://www.matthews.com/insights/austin-multifamily-q1-2026",
      retrievedAt: "2026-09-10",
      underlyingDataProvider: "CoStar Group, Inc.",
      methodologyNote:
        'Publisher wording is "market cap rate", a modelled market-wide figure, not a stated average of closed transactions. All classes combined; no class or geography split published.',
    },
    sourceQuality: 85,
  },
];

export const US_CAP_RATE_OBSERVATIONS: readonly CRECitedObservation[] = [
  ...HOUSTON_OBSERVATIONS,
  ...KIDDER_OBSERVATIONS,
  ...AUSTIN_OBSERVATIONS,
];

// ---------------------------------------------------------------------------
// Gaps
// ---------------------------------------------------------------------------

const MIAMI = { country: "US" as const, region: "FL", metro: "Miami, FL", city: "Miami" };

const MIAMI_SOURCES_CHECKED = [
  "cbre-us-cap-rates",
  "marcus-millichap-research",
  "newmark-research",
  "kidder-mathews-research",
  "cushman-cre-research",
  "colliers-ca-cap-rates",
];

/**
 * Miami is the one priority city with no cap rate at all. Everything that
 * surfaced for it was a lender blog, a cap-rate "calculator" site, or an agent
 * marketing page — the exact category Phase 4A rules out as a citation. MMG Real
 * Estate Advisors' Miami Q2 2026 report is a legitimate brokerage document and
 * was checked directly: it publishes rent, occupancy, absorption and pipeline,
 * and no cap rate.
 */
export const US_CAP_RATE_GAPS: readonly CREDataGap[] = [
  {
    metric: "cap_rate",
    assetClass: "multifamily",
    geography: MIAMI,
    reason:
      "No primary-source Miami multifamily cap rate found. MMG Real Estate Advisors' Miami Q2 2026 Market Report was checked and publishes no cap rate; Kidder Mathews does not cover Florida; CBRE's market-level tables are gated. Every remaining hit was a lender blog, cap-rate calculator site or agent marketing page, none of which can serve as a citation.",
    sourcesChecked: MIAMI_SOURCES_CHECKED,
    checkedAt: "2026-09-10",
  },
  // Office, industrial and retail are unsourced in ALL five cities. The free
  // brokerage reports that carry cap rates are multifamily reports; the office
  // and industrial equivalents publish vacancy, absorption and asking rent but
  // not yield.
  ...(["Austin", "Houston", "Miami", "Seattle", "Phoenix"] as const).flatMap((city) =>
    (["office", "industrial", "retail"] as const).map((assetClass) => ({
      metric: "cap_rate" as const,
      assetClass,
      geography:
        city === "Miami"
          ? MIAMI
          : {
              country: "US" as const,
              city,
              metro: `${city}, ${{ Austin: "TX", Houston: "TX", Seattle: "WA", Phoenix: "AZ" }[city]}`,
              region: { Austin: "TX", Houston: "TX", Seattle: "WA", Phoenix: "AZ" }[city],
            },
      reason: `No ${assetClass} cap rate published for ${city} in any free primary source checked. The brokerage market reports that do carry cap rates (Newmark, Kidder Mathews, Matthews) are multifamily-only; their office/industrial/retail counterparts publish vacancy, absorption and asking rent but no yield. CBRE's U.S. Cap Rate Survey covers these sectors but gates every market-level table behind a download.`,
      sourcesChecked: ["cbre-us-cap-rates", "newmark-research", "kidder-mathews-research", "cushman-cre-research"],
      checkedAt: "2026-09-10",
    })),
  ),
  {
    metric: "cap_rate",
    assetClass: "multifamily",
    geography: { country: "US" },
    propertySubtype: "class_split",
    reason:
      "Class A/B/C splits exist only for Houston (Newmark). Phoenix, Seattle and Austin publish a single market-wide average with no class dimension, so no Class A or Class B observation can be produced for them without inventing the split.",
    sourcesChecked: ["kidder-mathews-research", "matthews-research"],
    checkedAt: "2026-09-10",
  },
];

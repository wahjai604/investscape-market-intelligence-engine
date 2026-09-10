/**
 * InvestScape™ E68 — U.S. cap-rate observations.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * THIS FILE INTENTIONALLY CONTAINS ZERO OBSERVATIONS.
 *
 * That is a finding, not an omission. A search on 2026-09-10 for city-level
 * U.S. cap rates meeting E68's citation standard — publisher, report title,
 * publication date, period, and a locator inside the document — returned
 * nothing usable for Austin, Houston, Miami, Seattle or Phoenix:
 *
 *   CBRE U.S. Cap Rate Survey H1 2026 (published 2026-08-12,
 *   https://www.cbre.com/insights/reports/us-cap-rate-survey-h1-2026)
 *     The public page carries directional commentary only ("cap rates
 *     compressed more for class B and C and value-add than for class A and
 *     stabilized assets"). All 3,600 estimates across 50+ markets sit behind a
 *     "Download the Full Report" gate. No market-level number is quotable.
 *
 *   Marcus & Millichap Austin multifamily research
 *     The market-report endpoint returned "search service is currently
 *     unavailable"; no figure could be retrieved, let alone located to a table.
 *
 *   Secondary aggregators (loan brokers, market-summary blogs)
 *     Numbers circulate — e.g. "Austin multifamily ~5.6%" — with no report
 *     title, no period, and no method. Under E68's source hierarchy these rank
 *     below every primary source and cannot carry a citation. Excluded.
 *
 * WHY NOT FILL THE GAP ANYWAY
 *   The obvious workarounds are all forbidden by E68's first rule, and each has
 *   already produced a real defect in this codebase before:
 *     - a national average is not a city observation
 *     - a regional average is not a city observation
 *     - Class A cannot be inferred from an ungraded figure
 *     - CBD cannot be inferred from a metro-wide figure
 *     - FRED/Zillow residential series are not commercial cap rates
 *   A missing observation is preferable to an estimated one.
 *
 * WHAT WOULD UNBLOCK THIS
 *   A licensed CBRE Cap Rate Survey download, an Altus/CoStar/MSCI seat, or any
 *   primary market report that prints a city-level figure with a locatable
 *   table. Add the source to CRE_SOURCE_REGISTRY first, then populate here.
 */
import type { CRECitedObservation, CREDataGap } from "../types";

/**
 * Empty by design. Typed so that the moment a licensed source arrives, entries
 * land here with citation metadata enforced at compile time.
 */
export const US_CAP_RATE_OBSERVATIONS: readonly CRECitedObservation[] = [];

const PRIORITY_CITIES: Array<{ city: string; region: string; metro: string }> = [
  { city: "Austin", region: "TX", metro: "Austin, TX" },
  { city: "Houston", region: "TX", metro: "Houston, TX" },
  { city: "Miami", region: "FL", metro: "Miami, FL" },
  { city: "Seattle", region: "WA", metro: "Seattle, WA" },
  { city: "Phoenix", region: "AZ", metro: "Phoenix, AZ" },
];

const CAP_RATE_GAP_REASON =
  "No city-level cap rate meeting E68's citation standard is publicly retrievable. CBRE's U.S. Cap Rate Survey H1 2026 gates all market-level tables behind a download; Marcus & Millichap's market-report service was unavailable; secondary aggregations lack report/table traceability and rank below primary sources.";

export const US_CAP_RATE_GAPS: readonly CREDataGap[] = PRIORITY_CITIES.flatMap(
  ({ city, region, metro }) =>
    (["office", "industrial", "retail", "multifamily"] as const).map((assetClass) => ({
      metric: "cap_rate" as const,
      assetClass,
      geography: { country: "US" as const, region, metro, city },
      reason: CAP_RATE_GAP_REASON,
      sourcesChecked: ["cbre-us-cap-rates", "marcus-millichap-research"],
      checkedAt: "2026-09-10",
    })),
);

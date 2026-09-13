/**
 * InvestScape™ E86 — Commercial Real Estate source registry.
 *
 * Registry metadata only. E86 does not copy, cache, or redistribute proprietary
 * datasets. Public-report availability does not by itself grant redistribution
 * rights; callers must respect each publisher's current terms.
 */
import type { CRELicenseClass, CREMetric, CRESourceType } from "./types";

export type CREAccess = "public_report" | "public_data" | "paid" | "mixed";
export type CREUpdateFrequency = "monthly" | "quarterly" | "semiannual" | "annual" | "ad_hoc" | "unknown";

export interface CRESourceDefinition {
  sourceId: string;
  sourceName: string;
  sourceType: CRESourceType;
  countries: Array<"CA" | "US">;
  metrics: CREMetric[];
  access: CREAccess;
  updateFrequency: CREUpdateFrequency;
  url: string;
  redistribution: "not_assumed" | "public_data_terms" | "license_required";
  /**
   * Phase 4A Part 9 classification. Set from the publisher's actual terms, never
   * from "the page loaded without a paywall".
   */
  license: CRELicenseClass;
  defaultQuality: number;
  notes: string;
}

export const CRE_SOURCE_REGISTRY: readonly CRESourceDefinition[] = [
  {
    sourceId: "cbre-ca-cap-rates",
    sourceName: "CBRE Canada Cap Rates & Investment Insights",
    sourceType: "brokerage",
    countries: ["CA"],
    metrics: ["cap_rate"],
    access: "public_report",
    updateFrequency: "quarterly",
    url: "https://www.cbre.ca/insights/reports/canada-cap-rates-investment-insights-q2-2026",
    redistribution: "not_assumed",
    license: "public_report",
    defaultQuality: 95,
    notes: "Canadian cap-rate survey covering national sectors and major markets; detailed report data remains publisher content.",
  },
  {
    sourceId: "cbre-us-cap-rates",
    sourceName: "CBRE U.S. Cap Rate Survey",
    sourceType: "brokerage",
    countries: ["US"],
    metrics: ["cap_rate"],
    access: "public_report",
    updateFrequency: "semiannual",
    url: "https://www.cbre.com/insights/reports/us-cap-rate-survey-h1-2026",
    redistribution: "not_assumed",
    license: "public_report",
    defaultQuality: 95,
    notes: "U.S. survey informed by market professionals and recent trades; use published ranges/estimates with provenance.",
  },
  {
    sourceId: "colliers-ca-cap-rates",
    sourceName: "Colliers Canada Cap Rate Report",
    sourceType: "brokerage",
    countries: ["CA"],
    metrics: ["cap_rate"],
    access: "public_report",
    updateFrequency: "quarterly",
    url: "https://www.collierscanada.com/en-ca/research/canada-cap-rate-report",
    redistribution: "not_assumed",
    license: "public_report",
    defaultQuality: 92,
    notes: "Independent Canadian brokerage benchmark for cross-source validation.",
  },
  {
    sourceId: "jll-cre-research",
    sourceName: "JLL Commercial Real Estate Research",
    sourceType: "brokerage",
    countries: ["CA", "US"],
    metrics: ["cap_rate"],
    access: "mixed",
    updateFrequency: "quarterly",
    url: "https://www.us.jll.com/en/trends-and-insights/research",
    redistribution: "not_assumed",
    license: "public_report",
    defaultQuality: 90,
    notes: "Use market research and published valuation/capital-markets benchmarks; proprietary underlying datasets require authorization.",
  },
  {
    sourceId: "cushman-cre-research",
    sourceName: "Cushman & Wakefield Research",
    sourceType: "brokerage",
    countries: ["CA", "US"],
    metrics: ["cap_rate"],
    access: "mixed",
    updateFrequency: "quarterly",
    url: "https://www.cushmanwakefield.com/en/insights",
    redistribution: "not_assumed",
    license: "public_report",
    defaultQuality: 90,
    notes: "Use published market/valuation research as an independent benchmark.",
  },
  {
    sourceId: "marcus-millichap-research",
    sourceName: "Marcus & Millichap Research",
    sourceType: "brokerage",
    countries: ["US"],
    metrics: ["cap_rate"],
    access: "public_report",
    updateFrequency: "quarterly",
    url: "https://www.marcusmillichap.com/research",
    redistribution: "not_assumed",
    license: "public_report",
    defaultQuality: 90,
    notes: "Strong sector-specific U.S. transaction/cap-rate research, particularly multifamily, industrial, retail and office.",
  },
  {
    sourceId: "altus-canada-cre",
    sourceName: "Altus Group Canada CRE / Valuation Research",
    sourceType: "valuation",
    countries: ["CA", "US"],
    metrics: ["cap_rate", "hard_cost", "soft_cost", "construction_index"],
    access: "mixed",
    updateFrequency: "quarterly",
    url: "https://www.altusgroup.com/",
    redistribution: "license_required",
    license: "subscription",
    defaultQuality: 95,
    notes: "Institutional valuation and cost intelligence; public research can be used as a benchmark, but proprietary databases and guides require licensed access.",
  },
  {
    sourceId: "msci-rca",
    sourceName: "MSCI Real Capital Analytics",
    sourceType: "transaction_database",
    countries: ["CA", "US"],
    metrics: ["cap_rate"],
    access: "paid",
    updateFrequency: "monthly",
    url: "https://www.msci.com/data-and-analytics/real-estate/real-capital-analytics",
    redistribution: "license_required",
    license: "subscription",
    defaultQuality: 98,
    notes: "Institutional transaction database; store derived observations only when license permits.",
  },
  {
    sourceId: "costar-market-analytics",
    sourceName: "CoStar Market Analytics",
    sourceType: "transaction_database",
    countries: ["CA", "US"],
    metrics: ["cap_rate", "hard_cost"],
    access: "paid",
    updateFrequency: "monthly",
    url: "https://www.costar.com/products/market-analytics",
    redistribution: "license_required",
    license: "subscription",
    defaultQuality: 98,
    notes: "Property-level and market transaction/analytics platform; no proprietary records should be copied into E86 without license.",
  },
  {
    sourceId: "realpage-multifamily",
    sourceName: "RealPage Multifamily Analytics",
    sourceType: "transaction_database",
    countries: ["US"],
    metrics: ["cap_rate"],
    access: "mixed",
    updateFrequency: "quarterly",
    url: "https://www.realpage.com/analytics/",
    redistribution: "license_required",
    license: "subscription",
    defaultQuality: 94,
    notes: "Specialized multifamily transaction and market analytics.",
  },
  {
    sourceId: "statcan-bcpi",
    sourceName: "Statistics Canada — Building Construction Price Index",
    sourceType: "government",
    countries: ["CA"],
    metrics: ["construction_index"],
    access: "public_data",
    updateFrequency: "quarterly",
    url: "https://www23.statcan.gc.ca/imdb-bmdi/pub/2317-eng.htm",
    redistribution: "public_data_terms",
    license: "public",
    defaultQuality: 99,
    notes: "Quarterly contractor-price index for commercial, institutional, industrial and residential buildings; use as escalation, not as a direct $/SF benchmark.",
  },
  {
    sourceId: "cmhc-housing",
    sourceName: "CMHC Housing Market Data",
    sourceType: "government",
    countries: ["CA"],
    metrics: ["hard_cost", "soft_cost"],
    access: "public_data",
    updateFrequency: "monthly",
    url: "https://www.cmhc-schl.gc.ca/",
    redistribution: "public_data_terms",
    license: "public",
    defaultQuality: 92,
    notes: "Useful housing construction/development context; does not substitute for a commercial hard-cost guide.",
  },
  {
    sourceId: "us-census-construction-spending",
    sourceName: "U.S. Census Bureau — Value of Construction Put in Place",
    sourceType: "government",
    countries: ["US"],
    metrics: ["hard_cost", "construction_index"],
    access: "public_data",
    updateFrequency: "monthly",
    url: "https://www.census.gov/construction/c30/current/index.html",
    redistribution: "public_data_terms",
    license: "public",
    defaultQuality: 99,
    notes: "Monthly construction spending by type; useful for market context and normalization, not a direct building-specific $/SF benchmark.",
  },
  {
    sourceId: "bls-ppi-construction",
    sourceName: "U.S. Bureau of Labor Statistics — PPI Construction",
    sourceType: "government",
    countries: ["US"],
    metrics: ["construction_index"],
    access: "public_data",
    updateFrequency: "monthly",
    url: "https://www.bls.gov/ppi/",
    redistribution: "public_data_terms",
    license: "public",
    defaultQuality: 99,
    notes: "Producer-price indexes provide U.S. construction cost escalation inputs by category.",
  },
  {
    sourceId: "rlb-north-america",
    sourceName: "Rider Levett Bucknall — North America Construction Cost Reports",
    sourceType: "construction_cost",
    countries: ["CA", "US"],
    metrics: ["hard_cost", "construction_index"],
    access: "public_report",
    updateFrequency: "quarterly",
    url: "https://www.rlb.com/americas/insight/",
    redistribution: "not_assumed",
    license: "public_report",
    defaultQuality: 94,
    notes: "North American construction cost and escalation intelligence with market-level coverage.",
  },
  {
    sourceId: "turner-townsend-north-america",
    sourceName: "Turner & Townsend North America Cost Intelligence",
    sourceType: "construction_cost",
    countries: ["CA", "US"],
    metrics: ["hard_cost", "construction_index"],
    access: "public_report",
    updateFrequency: "quarterly",
    url: "https://marketintelligence.turnerandtownsend.com/",
    redistribution: "not_assumed",
    license: "public_report",
    defaultQuality: 94,
    notes: "Project-based hard-cost and construction-market intelligence; professional fees and other soft costs are generally separated from hard cost in published guides.",
  },
  {
    sourceId: "newmark-research",
    sourceName: "Newmark",
    sourceType: "brokerage",
    countries: ["US"],
    metrics: ["cap_rate"],
    access: "public_report",
    updateFrequency: "quarterly",
    url: "https://www.nmrk.com/insights",
    redistribution: "not_assumed",
    license: "public_report",
    defaultQuality: 90,
    notes: "Free per-metro multifamily market PDFs. The Houston edition carries a dedicated 'Cap Rate Estimates' chart with Class A Infill / A Suburban / B / C ranges - one of the few free sources with a real class split. Check each chart's own footnote date: it can lag the report.",
  },
  {
    sourceId: "kidder-mathews-research",
    sourceName: "Kidder Mathews",
    sourceType: "brokerage",
    countries: ["US"],
    metrics: ["cap_rate"],
    access: "public_report",
    updateFrequency: "quarterly",
    url: "https://kidder.com/market-reports/",
    redistribution: "not_assumed",
    license: "public_report",
    defaultQuality: 90,
    notes: "Free quarterly multifamily market-trends PDFs for western U.S. metros including Seattle and Phoenix. The 'Average Cap Rate' row is a transaction average; figures are credited to CoStar, whose dataset is proprietary. No Florida coverage.",
  },
  {
    sourceId: "matthews-research",
    sourceName: "Matthews Real Estate Investment Services",
    sourceType: "brokerage",
    countries: ["US"],
    metrics: ["cap_rate"],
    access: "public_report",
    updateFrequency: "quarterly",
    url: "https://www.matthews.com/insights/",
    redistribution: "not_assumed",
    license: "public_report",
    defaultQuality: 85,
    notes: "Free per-metro market reports. Publishes a single all-classes 'market cap rate' credited to CoStar - a modelled figure, not a stated transaction average.",
  },
  {
    sourceId: "cushman-wakefield-canada",
    sourceName: "Cushman & Wakefield Canada",
    sourceType: "brokerage",
    countries: ["CA"],
    metrics: ["cap_rate"],
    access: "public_report",
    updateFrequency: "quarterly",
    url: "https://www.cushmanwakefield.com/en/canada/insights/canadian-cap-rates-perspective-report",
    redistribution: "not_assumed",
    license: "public_report",
    defaultQuality: 88,
    notes: "Free quarterly 'Canadian Cap Rate & Capital Markets Report'. Its Multifamily Cap Rates page (High Rise / Low Rise, Min/Max Range) is the only chart in the report with numeric city-level labels; Industrial/Retail/Office pages are unlabeled national historical trend lines and cannot be read without estimating. Figures were read from the rendered chart image, not text-extracted (the PDF encodes the labels as vector graphics).",
  },
];

export function getCRESource(sourceId: string): CRESourceDefinition | undefined {
  return CRE_SOURCE_REGISTRY.find((source) => source.sourceId === sourceId);
}

export function listCRESources(metric?: CREMetric): CRESourceDefinition[] {
  return CRE_SOURCE_REGISTRY.filter((source) => !metric || source.metrics.includes(metric));
}

/**
 * Redistribution is opt-in and narrow: only sources published under explicit
 * public-data terms may be redistributed. `access: "public_report"` is NOT
 * redistribution — a report being free to download says nothing about the right
 * to republish its figures. Proprietary and paid sources can never qualify.
 */
export function isRedistributable(source: CRESourceDefinition): boolean {
  if (source.redistribution !== "public_data_terms") return false;
  if (source.sourceType !== "government") return false;
  if (source.license !== "public") return false;
  return source.access === "public_data";
}

/** Licence classes that must never be treated as redistributable. */
export const NON_REDISTRIBUTABLE_LICENSES: readonly CRELicenseClass[] = [
  "public_report",
  "paid",
  "subscription",
  "proprietary",
  "user_supplied",
];

/** Sources whose figures may be republished downstream. */
export function listRedistributableSources(): CRESourceDefinition[] {
  return CRE_SOURCE_REGISTRY.filter(isRedistributable);
}

/**
 * InvestScape™ E68 Phase 6 — Paid/Commercial CRE Data Source Analysis.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Classification metadata ONLY. This module intentionally carries no cap-rate
 * percentages, no $/SF or $/unit figures, and no other proprietary numeric
 * benchmark values scraped or transcribed from a paid source. Every field
 * here is an enum, boolean, string label, URL, or date describing what a
 * source publishes and under what terms — never the value it publishes.
 *
 * See docs/E68-phase6-paid-source-analysis.md for the full research report,
 * including source URLs and the date each claim was checked. This phase did
 * not purchase, license, or integrate any paid source; nothing here should be
 * read as confirmation that InvestScape has access to any paid dataset.
 */

/** Cost-disclosure states used throughout this module. Never a dollar amount. */
export type CostTierLabel =
  | "FREE"
  | "PARTIALLY_PUBLIC"
  | "PRICING_NOT_PUBLIC"
  | "ESTIMATED_THIRD_PARTY_ONLY";

export type AutomationClass =
  | "API_AVAILABLE"
  | "API_BY_CONTRACT"
  | "BULK_EXPORT"
  | "WEB_ONLY"
  | "REPORT_PDF"
  | "MANUAL_ONLY"
  | "UNKNOWN";

export type EvidenceLevel = "CONFIRMED" | "LIKELY" | "UNCONFIRMED" | "NOT_FOUND";

export type LicensePermission = "YES" | "NO" | "REQUIRES_LICENSE_REVIEW";

export type RecommendationTier = "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4";

export type SourceCountryCoverage = "CA" | "US" | "CA_AND_US" | "UNCONFIRMED";

/**
 * The seven licensing questions from Part 6 of the Phase 6 report. Each is a
 * distinct permission — API access never implies redistribution rights.
 */
export interface CRELicensingProfile {
  /** (A) Can InvestScape internally consume the data? */
  internalConsumption: LicensePermission;
  /** (B) Can InvestScape display the resulting benchmark? */
  displayBenchmark: LicensePermission;
  /** (C) Can InvestScape display the underlying source value? */
  displayUnderlyingValue: LicensePermission;
  /** (D) Can InvestScape store the raw data? */
  storeRawData: LicensePermission;
  /** (E) Can InvestScape redistribute raw data to users? */
  redistributeRawData: LicensePermission;
  /** (F) Can InvestScape display derived calculations? */
  displayDerivedCalculations: LicensePermission;
  /** (G) Can InvestScape expose source name/report/page as provenance? */
  exposeProvenance: LicensePermission;
}

export interface CREPaidSourceProfile {
  sourceId: string;
  companyName: string;
  productName: string;
  countryCoverage: SourceCountryCoverage;
  assetClasses: string[];
  hasCapRateData: EvidenceLevel;
  hasTransactionData: EvidenceLevel;
  hasSalePriceData: EvidenceLevel;
  hasNoiData: EvidenceLevel;
  hasOccupancyData: EvidenceLevel;
  hasRentData: EvidenceLevel;
  hasConstructionCostData: EvidenceLevel;
  hasReplacementCostData: EvidenceLevel;
  hasDevelopmentCostData: EvidenceLevel;
  hasMarketReports: EvidenceLevel;
  historicalDepthDescription: string;
  updateFrequency: "monthly" | "quarterly" | "semiannual" | "annual" | "ad_hoc" | "unknown";
  automationClass: AutomationClass;
  bulkExportAvailable: EvidenceLevel;
  licensing: CRELicensingProfile;
  redistributionRestricted: boolean;
  commercialUseRestricted: boolean;
  costTier: CostTierLabel;
  /** Present only when a specific figure is publicly documented; never invented. */
  publicPriceNote?: string;
  evidenceUrls: string[];
  dateVerified: string;
  notes: string;
}

/** Every paid/commercial CRE source investigated in Phase 6, plus the free brokerage sources already in E68's registry for cross-reference. Not exhaustive of every provider in the market — see the report's Part 1 for scope. */
export const CRE_PAID_SOURCE_PROFILES: readonly CREPaidSourceProfile[] = [
  {
    sourceId: "cbre-cap-rate-survey",
    companyName: "CBRE",
    productName: "U.S. Cap Rate Survey / Canada Cap Rates & Investment Insights",
    countryCoverage: "CA_AND_US",
    assetClasses: ["office", "industrial", "retail", "multifamily", "hotel", "seniors_housing"],
    hasCapRateData: "CONFIRMED",
    hasTransactionData: "NOT_FOUND",
    hasSalePriceData: "NOT_FOUND",
    hasNoiData: "NOT_FOUND",
    hasOccupancyData: "NOT_FOUND",
    hasRentData: "NOT_FOUND",
    hasConstructionCostData: "NOT_FOUND",
    hasReplacementCostData: "NOT_FOUND",
    hasDevelopmentCostData: "NOT_FOUND",
    hasMarketReports: "CONFIRMED",
    historicalDepthDescription: "Semiannual (US) / quarterly (Canada) survey; historical archive not publicly documented",
    updateFrequency: "semiannual",
    automationClass: "REPORT_PDF",
    bulkExportAvailable: "NOT_FOUND",
    licensing: {
      internalConsumption: "REQUIRES_LICENSE_REVIEW",
      displayBenchmark: "REQUIRES_LICENSE_REVIEW",
      displayUnderlyingValue: "NO",
      storeRawData: "REQUIRES_LICENSE_REVIEW",
      redistributeRawData: "NO",
      displayDerivedCalculations: "REQUIRES_LICENSE_REVIEW",
      exposeProvenance: "YES",
    },
    redistributionRestricted: true,
    commercialUseRestricted: true,
    costTier: "PRICING_NOT_PUBLIC",
    evidenceUrls: ["https://www.cbre.com/insights/reports/us-cap-rate-survey-h1-2026"],
    dateVerified: "2026-09-11",
    notes: "Documented numeric product (3,600 estimates, 50+ markets) gated behind a download form; free page carries directional commentary only.",
  },
  {
    sourceId: "costar-market-analytics",
    companyName: "CoStar Group",
    productName: "CoStar Market Analytics / Property Professional",
    countryCoverage: "US",
    assetClasses: ["office", "industrial", "retail", "multifamily", "hotel"],
    hasCapRateData: "CONFIRMED",
    hasTransactionData: "CONFIRMED",
    hasSalePriceData: "LIKELY",
    hasNoiData: "UNCONFIRMED",
    hasOccupancyData: "LIKELY",
    hasRentData: "LIKELY",
    hasConstructionCostData: "UNCONFIRMED",
    hasReplacementCostData: "NOT_FOUND",
    hasDevelopmentCostData: "NOT_FOUND",
    hasMarketReports: "CONFIRMED",
    historicalDepthDescription: "Decades of property- and market-level data",
    updateFrequency: "monthly",
    automationClass: "WEB_ONLY",
    bulkExportAvailable: "NOT_FOUND",
    licensing: {
      internalConsumption: "REQUIRES_LICENSE_REVIEW",
      displayBenchmark: "REQUIRES_LICENSE_REVIEW",
      displayUnderlyingValue: "NO",
      storeRawData: "REQUIRES_LICENSE_REVIEW",
      redistributeRawData: "NO",
      displayDerivedCalculations: "REQUIRES_LICENSE_REVIEW",
      exposeProvenance: "YES",
    },
    redistributionRestricted: true,
    commercialUseRestricted: true,
    costTier: "PRICING_NOT_PUBLIC",
    evidenceUrls: ["https://www.costar.com/products/market-analytics"],
    dateVerified: "2026-09-11",
    notes: "Terms of Use prohibit automated extraction/scraping; no public self-serve API found. De-facto source behind several free brokerage cap-rate charts E68 already stores.",
  },
  {
    sourceId: "msci-rca",
    companyName: "MSCI",
    productName: "Real Capital Analytics",
    countryCoverage: "CA_AND_US",
    assetClasses: ["office", "industrial", "retail", "multifamily", "hotel"],
    hasCapRateData: "CONFIRMED",
    hasTransactionData: "CONFIRMED",
    hasSalePriceData: "CONFIRMED",
    hasNoiData: "UNCONFIRMED",
    hasOccupancyData: "UNCONFIRMED",
    hasRentData: "UNCONFIRMED",
    hasConstructionCostData: "NOT_FOUND",
    hasReplacementCostData: "NOT_FOUND",
    hasDevelopmentCostData: "NOT_FOUND",
    hasMarketReports: "CONFIRMED",
    historicalDepthDescription: "Long-running transaction database",
    updateFrequency: "monthly",
    automationClass: "API_BY_CONTRACT",
    bulkExportAvailable: "CONFIRMED",
    licensing: {
      internalConsumption: "REQUIRES_LICENSE_REVIEW",
      displayBenchmark: "REQUIRES_LICENSE_REVIEW",
      displayUnderlyingValue: "NO",
      storeRawData: "REQUIRES_LICENSE_REVIEW",
      redistributeRawData: "NO",
      displayDerivedCalculations: "REQUIRES_LICENSE_REVIEW",
      exposeProvenance: "YES",
    },
    redistributionRestricted: true,
    commercialUseRestricted: true,
    costTier: "PRICING_NOT_PUBLIC",
    evidenceUrls: ["https://www.msci.com/data-and-analytics/real-estate/real-capital-analytics"],
    dateVerified: "2026-09-11",
    notes: "Top of E68's existing source hierarchy (transaction-derived evidence). Documents an API / Snowflake data-delivery integration.",
  },
  {
    sourceId: "altus-group",
    companyName: "Altus Group",
    productName: "Altus Insite / ARGUS / Reonomy",
    countryCoverage: "CA_AND_US",
    assetClasses: ["office", "industrial", "retail", "multifamily"],
    hasCapRateData: "CONFIRMED",
    hasTransactionData: "UNCONFIRMED",
    hasSalePriceData: "UNCONFIRMED",
    hasNoiData: "NOT_FOUND",
    hasOccupancyData: "UNCONFIRMED",
    hasRentData: "UNCONFIRMED",
    hasConstructionCostData: "CONFIRMED",
    hasReplacementCostData: "UNCONFIRMED",
    hasDevelopmentCostData: "UNCONFIRMED",
    hasMarketReports: "CONFIRMED",
    historicalDepthDescription: "Not publicly documented",
    updateFrequency: "quarterly",
    automationClass: "API_BY_CONTRACT",
    bulkExportAvailable: "UNCONFIRMED",
    licensing: {
      internalConsumption: "REQUIRES_LICENSE_REVIEW",
      displayBenchmark: "REQUIRES_LICENSE_REVIEW",
      displayUnderlyingValue: "NO",
      storeRawData: "REQUIRES_LICENSE_REVIEW",
      redistributeRawData: "NO",
      displayDerivedCalculations: "REQUIRES_LICENSE_REVIEW",
      exposeProvenance: "YES",
    },
    redistributionRestricted: true,
    commercialUseRestricted: true,
    costTier: "PRICING_NOT_PUBLIC",
    evidenceUrls: ["https://www.altusgroup.com/"],
    dateVerified: "2026-09-11",
    notes: "Canada-primary; acquired Reonomy (July 2026) for US property data and API access. Best-positioned Canadian candidate for both cap-rate and construction-cost gaps.",
  },
  {
    sourceId: "realpage-analytics",
    companyName: "RealPage Inc.",
    productName: "RealPage Multifamily Analytics",
    countryCoverage: "US",
    assetClasses: ["multifamily"],
    hasCapRateData: "UNCONFIRMED",
    hasTransactionData: "UNCONFIRMED",
    hasSalePriceData: "NOT_FOUND",
    hasNoiData: "UNCONFIRMED",
    hasOccupancyData: "UNCONFIRMED",
    hasRentData: "UNCONFIRMED",
    hasConstructionCostData: "NOT_FOUND",
    hasReplacementCostData: "NOT_FOUND",
    hasDevelopmentCostData: "NOT_FOUND",
    hasMarketReports: "UNCONFIRMED",
    historicalDepthDescription: "Not publicly documented",
    updateFrequency: "quarterly",
    automationClass: "UNKNOWN",
    bulkExportAvailable: "NOT_FOUND",
    licensing: {
      internalConsumption: "REQUIRES_LICENSE_REVIEW",
      displayBenchmark: "REQUIRES_LICENSE_REVIEW",
      displayUnderlyingValue: "NO",
      storeRawData: "REQUIRES_LICENSE_REVIEW",
      redistributeRawData: "NO",
      displayDerivedCalculations: "REQUIRES_LICENSE_REVIEW",
      exposeProvenance: "YES",
    },
    redistributionRestricted: true,
    commercialUseRestricted: true,
    costTier: "PRICING_NOT_PUBLIC",
    evidenceUrls: ["https://www.realpage.com/analytics/"],
    dateVerified: "2026-09-11",
    notes: "Narrowest scope of the institutional subscription sources reviewed; multifamily-only.",
  },
  {
    sourceId: "green-street",
    companyName: "Green Street Advisors",
    productName: "Commercial Property Price Index / U.S. Market Data & Deals",
    countryCoverage: "US",
    assetClasses: ["office", "industrial", "retail", "multifamily", "hotel"],
    hasCapRateData: "CONFIRMED",
    hasTransactionData: "CONFIRMED",
    hasSalePriceData: "CONFIRMED",
    hasNoiData: "NOT_FOUND",
    hasOccupancyData: "UNCONFIRMED",
    hasRentData: "CONFIRMED",
    hasConstructionCostData: "NOT_FOUND",
    hasReplacementCostData: "NOT_FOUND",
    hasDevelopmentCostData: "NOT_FOUND",
    hasMarketReports: "CONFIRMED",
    historicalDepthDescription: "Time series described for cap rates and asset values across top 50 US markets plus 334 tertiary markets",
    updateFrequency: "quarterly",
    automationClass: "UNKNOWN",
    bulkExportAvailable: "UNCONFIRMED",
    licensing: {
      internalConsumption: "REQUIRES_LICENSE_REVIEW",
      displayBenchmark: "REQUIRES_LICENSE_REVIEW",
      displayUnderlyingValue: "NO",
      storeRawData: "REQUIRES_LICENSE_REVIEW",
      redistributeRawData: "NO",
      displayDerivedCalculations: "REQUIRES_LICENSE_REVIEW",
      exposeProvenance: "YES",
    },
    redistributionRestricted: true,
    commercialUseRestricted: true,
    costTier: "PRICING_NOT_PUBLIC",
    evidenceUrls: [
      "https://www.greenstreet.com/resources/pricing-index/",
      "https://info.greenstreet.com/u.s.-market-data-deals-overview",
    ],
    dateVerified: "2026-09-11",
    notes: "Own product page explicitly describes 'cap rate and asset value time series' and Sales/Rent Comps databases — a documented numeric product, not marketing language.",
  },
  {
    sourceId: "trepp",
    companyName: "Trepp, LLC",
    productName: "TreppData Feed (CMBS property-level data)",
    countryCoverage: "US",
    assetClasses: ["office", "industrial", "retail", "multifamily", "hotel"],
    hasCapRateData: "NOT_FOUND",
    hasTransactionData: "CONFIRMED",
    hasSalePriceData: "CONFIRMED",
    hasNoiData: "LIKELY",
    hasOccupancyData: "LIKELY",
    hasRentData: "UNCONFIRMED",
    hasConstructionCostData: "NOT_FOUND",
    hasReplacementCostData: "NOT_FOUND",
    hasDevelopmentCostData: "NOT_FOUND",
    hasMarketReports: "UNCONFIRMED",
    historicalDepthDescription: "Extensive loan-level history for CMBS-collateralized properties only",
    updateFrequency: "unknown",
    automationClass: "BULK_EXPORT",
    bulkExportAvailable: "CONFIRMED",
    licensing: {
      internalConsumption: "REQUIRES_LICENSE_REVIEW",
      displayBenchmark: "REQUIRES_LICENSE_REVIEW",
      displayUnderlyingValue: "NO",
      storeRawData: "REQUIRES_LICENSE_REVIEW",
      redistributeRawData: "NO",
      displayDerivedCalculations: "REQUIRES_LICENSE_REVIEW",
      exposeProvenance: "YES",
    },
    redistributionRestricted: true,
    commercialUseRestricted: true,
    costTier: "PRICING_NOT_PUBLIC",
    evidenceUrls: ["https://cherre.com/vendors/trepp/"],
    dateVerified: "2026-09-11",
    notes: "Scope limited to properties within CMBS pools, not a general market sample. Most plausible candidate among all sources reviewed for a legitimate price+NOI derived cap rate, but unverified.",
  },
  {
    sourceId: "yardi-matrix",
    companyName: "Yardi Systems",
    productName: "Yardi Matrix",
    countryCoverage: "US",
    assetClasses: ["multifamily", "office", "industrial", "self_storage", "student_housing"],
    hasCapRateData: "UNCONFIRMED",
    hasTransactionData: "UNCONFIRMED",
    hasSalePriceData: "NOT_FOUND",
    hasNoiData: "LIKELY",
    hasOccupancyData: "CONFIRMED",
    hasRentData: "CONFIRMED",
    hasConstructionCostData: "NOT_FOUND",
    hasReplacementCostData: "NOT_FOUND",
    hasDevelopmentCostData: "NOT_FOUND",
    hasMarketReports: "CONFIRMED",
    historicalDepthDescription: "Monthly rent/occupancy updates across 188+ US metros",
    updateFrequency: "monthly",
    automationClass: "WEB_ONLY",
    bulkExportAvailable: "NOT_FOUND",
    licensing: {
      internalConsumption: "REQUIRES_LICENSE_REVIEW",
      displayBenchmark: "REQUIRES_LICENSE_REVIEW",
      displayUnderlyingValue: "NO",
      storeRawData: "REQUIRES_LICENSE_REVIEW",
      redistributeRawData: "NO",
      displayDerivedCalculations: "REQUIRES_LICENSE_REVIEW",
      exposeProvenance: "YES",
    },
    redistributionRestricted: true,
    commercialUseRestricted: true,
    costTier: "PRICING_NOT_PUBLIC",
    evidenceUrls: ["https://www.yardimatrix.com/property-types/multifamily/"],
    dateVerified: "2026-09-11",
    notes: "No documented numeric cap-rate product found on public pages; strong on rent/occupancy/financial data instead.",
  },
  {
    sourceId: "commercialedge",
    companyName: "Yardi (CommercialEdge)",
    productName: "CommercialEdge listing/property platform",
    countryCoverage: "US",
    assetClasses: ["office", "industrial", "retail"],
    hasCapRateData: "NOT_FOUND",
    hasTransactionData: "UNCONFIRMED",
    hasSalePriceData: "UNCONFIRMED",
    hasNoiData: "NOT_FOUND",
    hasOccupancyData: "UNCONFIRMED",
    hasRentData: "UNCONFIRMED",
    hasConstructionCostData: "NOT_FOUND",
    hasReplacementCostData: "NOT_FOUND",
    hasDevelopmentCostData: "NOT_FOUND",
    hasMarketReports: "UNCONFIRMED",
    historicalDepthDescription: "Not publicly documented",
    updateFrequency: "unknown",
    automationClass: "API_AVAILABLE",
    bulkExportAvailable: "UNCONFIRMED",
    licensing: {
      internalConsumption: "REQUIRES_LICENSE_REVIEW",
      displayBenchmark: "REQUIRES_LICENSE_REVIEW",
      displayUnderlyingValue: "REQUIRES_LICENSE_REVIEW",
      storeRawData: "REQUIRES_LICENSE_REVIEW",
      redistributeRawData: "NO",
      displayDerivedCalculations: "REQUIRES_LICENSE_REVIEW",
      exposeProvenance: "YES",
    },
    redistributionRestricted: true,
    commercialUseRestricted: true,
    costTier: "PARTIALLY_PUBLIC",
    publicPriceNote: "Base platform starts ~$250/month (third-party review aggregator); API pricing not separately published",
    evidenceUrls: ["https://www.selecthub.com/p/real-estate-asset-management-software/commercialedge/"],
    dateVerified: "2026-09-11",
    notes: "Not a cap-rate or construction-cost source; a listing/property platform. TIER_4 — out of E68 scope.",
  },
  {
    sourceId: "propertyshark",
    companyName: "Yardi (PropertyShark)",
    productName: "PropertyShark property records",
    countryCoverage: "US",
    assetClasses: ["office", "industrial", "retail", "multifamily"],
    hasCapRateData: "NOT_FOUND",
    hasTransactionData: "CONFIRMED",
    hasSalePriceData: "CONFIRMED",
    hasNoiData: "NOT_FOUND",
    hasOccupancyData: "NOT_FOUND",
    hasRentData: "NOT_FOUND",
    hasConstructionCostData: "NOT_FOUND",
    hasReplacementCostData: "NOT_FOUND",
    hasDevelopmentCostData: "NOT_FOUND",
    hasMarketReports: "NOT_FOUND",
    historicalDepthDescription: "Deed/sales/permit records for major metros",
    updateFrequency: "unknown",
    automationClass: "MANUAL_ONLY",
    bulkExportAvailable: "NOT_FOUND",
    licensing: {
      internalConsumption: "REQUIRES_LICENSE_REVIEW",
      displayBenchmark: "REQUIRES_LICENSE_REVIEW",
      displayUnderlyingValue: "REQUIRES_LICENSE_REVIEW",
      storeRawData: "REQUIRES_LICENSE_REVIEW",
      redistributeRawData: "NO",
      displayDerivedCalculations: "REQUIRES_LICENSE_REVIEW",
      exposeProvenance: "YES",
    },
    redistributionRestricted: true,
    commercialUseRestricted: true,
    costTier: "PARTIALLY_PUBLIC",
    publicPriceNote: "Pro $59.95/mo, Elite $79.95/mo, Platinum $169.95/mo, custom group pricing",
    evidenceUrls: ["https://www.credaily.com/reviews/propertyshark-review/"],
    dateVerified: "2026-09-11",
    notes: "No official API of its own; third-party scraping services exist but are not PropertyShark's product and were not used. TIER_4 — out of E68 scope.",
  },
  {
    sourceId: "placer-ai",
    companyName: "Placer Labs",
    productName: "Placer.ai location intelligence",
    countryCoverage: "UNCONFIRMED",
    assetClasses: ["retail", "other"],
    hasCapRateData: "NOT_FOUND",
    hasTransactionData: "NOT_FOUND",
    hasSalePriceData: "NOT_FOUND",
    hasNoiData: "NOT_FOUND",
    hasOccupancyData: "NOT_FOUND",
    hasRentData: "NOT_FOUND",
    hasConstructionCostData: "NOT_FOUND",
    hasReplacementCostData: "NOT_FOUND",
    hasDevelopmentCostData: "NOT_FOUND",
    hasMarketReports: "UNCONFIRMED",
    historicalDepthDescription: "Not publicly documented",
    updateFrequency: "unknown",
    automationClass: "API_AVAILABLE",
    bulkExportAvailable: "UNCONFIRMED",
    licensing: {
      internalConsumption: "REQUIRES_LICENSE_REVIEW",
      displayBenchmark: "REQUIRES_LICENSE_REVIEW",
      displayUnderlyingValue: "REQUIRES_LICENSE_REVIEW",
      storeRawData: "REQUIRES_LICENSE_REVIEW",
      redistributeRawData: "NO",
      displayDerivedCalculations: "REQUIRES_LICENSE_REVIEW",
      exposeProvenance: "YES",
    },
    redistributionRestricted: true,
    commercialUseRestricted: true,
    costTier: "ESTIMATED_THIRD_PARTY_ONLY",
    publicPriceNote: "Third-party benchmarks estimate $5,000-$30,000/yr; not Placer's own published rate card",
    evidenceUrls: ["https://plumlending.com/insights/placer-ai-review-location-intelligence-foot-traffic-2026"],
    dateVerified: "2026-09-11",
    notes: "Foot-traffic/location-intelligence product, not a cap-rate or construction-cost source. TIER_4 — out of E68 scope, included only per task instruction to survey 'any other material sources'.",
  },
  {
    sourceId: "lightbox",
    companyName: "LightBox",
    productName: "LightBox Data / SpatialStream API / LightBox Property",
    countryCoverage: "CA_AND_US",
    assetClasses: ["office", "industrial", "retail", "multifamily", "other"],
    hasCapRateData: "NOT_FOUND",
    hasTransactionData: "NOT_FOUND",
    hasSalePriceData: "NOT_FOUND",
    hasNoiData: "NOT_FOUND",
    hasOccupancyData: "NOT_FOUND",
    hasRentData: "NOT_FOUND",
    hasConstructionCostData: "NOT_FOUND",
    hasReplacementCostData: "NOT_FOUND",
    hasDevelopmentCostData: "NOT_FOUND",
    hasMarketReports: "UNCONFIRMED",
    historicalDepthDescription: "Not publicly documented",
    updateFrequency: "unknown",
    automationClass: "API_AVAILABLE",
    bulkExportAvailable: "UNCONFIRMED",
    licensing: {
      internalConsumption: "REQUIRES_LICENSE_REVIEW",
      displayBenchmark: "REQUIRES_LICENSE_REVIEW",
      displayUnderlyingValue: "REQUIRES_LICENSE_REVIEW",
      storeRawData: "REQUIRES_LICENSE_REVIEW",
      redistributeRawData: "NO",
      displayDerivedCalculations: "REQUIRES_LICENSE_REVIEW",
      exposeProvenance: "YES",
    },
    redistributionRestricted: true,
    commercialUseRestricted: true,
    costTier: "PRICING_NOT_PUBLIC",
    evidenceUrls: ["https://www.lightboxre.com/data/lightbox-apis/"],
    dateVerified: "2026-09-11",
    notes: "Parcel/zoning/property-record data, not a cap-rate or construction-cost source. Strongest documented API among the non-cap-rate sources reviewed. TIER_4 — out of E68 scope.",
  },
  {
    sourceId: "moodys-analytics-cre",
    companyName: "Moody's Analytics",
    productName: "Moody's Analytics CRE (formerly REIS) / MA CRE API",
    countryCoverage: "US",
    assetClasses: ["office", "industrial", "retail", "multifamily", "hotel"],
    hasCapRateData: "CONFIRMED",
    hasTransactionData: "CONFIRMED",
    hasSalePriceData: "UNCONFIRMED",
    hasNoiData: "UNCONFIRMED",
    hasOccupancyData: "CONFIRMED",
    hasRentData: "CONFIRMED",
    hasConstructionCostData: "NOT_FOUND",
    hasReplacementCostData: "NOT_FOUND",
    hasDevelopmentCostData: "NOT_FOUND",
    hasMarketReports: "CONFIRMED",
    historicalDepthDescription: "10 major CRE sectors, 275+ markets, 3,000+ submarkets, trend and forecast coverage",
    updateFrequency: "unknown",
    automationClass: "API_AVAILABLE",
    bulkExportAvailable: "CONFIRMED",
    licensing: {
      internalConsumption: "REQUIRES_LICENSE_REVIEW",
      displayBenchmark: "REQUIRES_LICENSE_REVIEW",
      displayUnderlyingValue: "NO",
      storeRawData: "REQUIRES_LICENSE_REVIEW",
      redistributeRawData: "NO",
      displayDerivedCalculations: "REQUIRES_LICENSE_REVIEW",
      exposeProvenance: "YES",
    },
    redistributionRestricted: true,
    commercialUseRestricted: true,
    costTier: "PRICING_NOT_PUBLIC",
    evidenceUrls: [
      "https://www.moodyscre.com/products/mca-api/",
      "https://cre.moodysanalytics.com/capabilities/data/",
    ],
    dateVerified: "2026-09-11",
    notes: "Best-documented API among cap-rate-bearing sources reviewed (MA CRE API plus a public API hub / Data Buffet).",
  },
  {
    sourceId: "rsmeans-gordian",
    companyName: "Gordian",
    productName: "RSMeans Data",
    countryCoverage: "CA_AND_US",
    assetClasses: ["office", "industrial", "retail", "multifamily", "other"],
    hasCapRateData: "NOT_FOUND",
    hasTransactionData: "NOT_FOUND",
    hasSalePriceData: "NOT_FOUND",
    hasNoiData: "NOT_FOUND",
    hasOccupancyData: "NOT_FOUND",
    hasRentData: "NOT_FOUND",
    hasConstructionCostData: "CONFIRMED",
    hasReplacementCostData: "LIKELY",
    hasDevelopmentCostData: "LIKELY",
    hasMarketReports: "UNCONFIRMED",
    historicalDepthDescription: "Not publicly documented; location-specific cost factors updated on an ongoing basis",
    updateFrequency: "unknown",
    automationClass: "BULK_EXPORT",
    bulkExportAvailable: "CONFIRMED",
    licensing: {
      internalConsumption: "REQUIRES_LICENSE_REVIEW",
      displayBenchmark: "REQUIRES_LICENSE_REVIEW",
      displayUnderlyingValue: "REQUIRES_LICENSE_REVIEW",
      storeRawData: "REQUIRES_LICENSE_REVIEW",
      redistributeRawData: "NO",
      displayDerivedCalculations: "REQUIRES_LICENSE_REVIEW",
      exposeProvenance: "YES",
    },
    redistributionRestricted: true,
    commercialUseRestricted: true,
    costTier: "PARTIALLY_PUBLIC",
    publicPriceNote: "Core ~$396/yr, Complete ~$1,019/yr, Complete Plus ~$5,973/yr (Capterra, 2026); alternative tiering $2,195-$6,735/yr",
    evidenceUrls: [
      "https://www.gordian.com/products/rsmeans-data-services/",
      "https://www.capterra.com/p/151681/RSMeans/",
    ],
    dateVerified: "2026-09-11",
    notes: "Only source in the entire matrix with a confirmed public price under $500/year. Most granular building-type/assembly-level construction-cost database reviewed (92,000+ line items). Best candidate to fill E68's Houston construction-cost gap and soft-cost gap, unverified for Houston specifically.",
  },
  {
    sourceId: "marshall-swift-corelogic",
    companyName: "CoreLogic",
    productName: "Marshall & Swift / SwiftEstimator",
    countryCoverage: "US",
    assetClasses: ["office", "industrial", "retail", "multifamily", "other"],
    hasCapRateData: "NOT_FOUND",
    hasTransactionData: "NOT_FOUND",
    hasSalePriceData: "NOT_FOUND",
    hasNoiData: "NOT_FOUND",
    hasOccupancyData: "NOT_FOUND",
    hasRentData: "NOT_FOUND",
    hasConstructionCostData: "CONFIRMED",
    hasReplacementCostData: "CONFIRMED",
    hasDevelopmentCostData: "NOT_FOUND",
    hasMarketReports: "NOT_FOUND",
    historicalDepthDescription: "Location-specific cost data for 2,629 locations nationwide (per publisher)",
    updateFrequency: "unknown",
    automationClass: "WEB_ONLY",
    bulkExportAvailable: "UNCONFIRMED",
    licensing: {
      internalConsumption: "REQUIRES_LICENSE_REVIEW",
      displayBenchmark: "REQUIRES_LICENSE_REVIEW",
      displayUnderlyingValue: "REQUIRES_LICENSE_REVIEW",
      storeRawData: "REQUIRES_LICENSE_REVIEW",
      redistributeRawData: "NO",
      displayDerivedCalculations: "REQUIRES_LICENSE_REVIEW",
      exposeProvenance: "YES",
    },
    redistributionRestricted: true,
    commercialUseRestricted: true,
    costTier: "PRICING_NOT_PUBLIC",
    evidenceUrls: ["https://www.corelogic.com/mortgage/appraiser-solutions/marshall-swift/"],
    dateVerified: "2026-09-11",
    notes: "Replacement-cost/appraisal-focused, not a full development-cost product. Complements RSMeans rather than replacing it.",
  },
  {
    sourceId: "dodge-construction-network",
    companyName: "Dodge Construction Network",
    productName: "Dodge Data & Analytics / Construction Data API",
    countryCoverage: "US",
    assetClasses: ["office", "industrial", "retail", "multifamily", "other"],
    hasCapRateData: "NOT_FOUND",
    hasTransactionData: "NOT_FOUND",
    hasSalePriceData: "NOT_FOUND",
    hasNoiData: "NOT_FOUND",
    hasOccupancyData: "NOT_FOUND",
    hasRentData: "NOT_FOUND",
    hasConstructionCostData: "UNCONFIRMED",
    hasReplacementCostData: "NOT_FOUND",
    hasDevelopmentCostData: "NOT_FOUND",
    hasMarketReports: "CONFIRMED",
    historicalDepthDescription: "Regional project/bid-tracking data",
    updateFrequency: "unknown",
    automationClass: "API_AVAILABLE",
    bulkExportAvailable: "UNCONFIRMED",
    licensing: {
      internalConsumption: "REQUIRES_LICENSE_REVIEW",
      displayBenchmark: "REQUIRES_LICENSE_REVIEW",
      displayUnderlyingValue: "REQUIRES_LICENSE_REVIEW",
      storeRawData: "REQUIRES_LICENSE_REVIEW",
      redistributeRawData: "NO",
      displayDerivedCalculations: "REQUIRES_LICENSE_REVIEW",
      exposeProvenance: "YES",
    },
    redistributionRestricted: true,
    commercialUseRestricted: true,
    costTier: "ESTIMATED_THIRD_PARTY_ONLY",
    publicPriceNote: "Dodge itself confirms sales-led, configuration-dependent pricing with no published list; one third-party estimate cites 'starting at $300/user/month' but this is not Dodge's own rate card",
    evidenceUrls: ["https://www.construction.com/apis/"],
    dateVerified: "2026-09-11",
    notes: "Core product is project/bid tracking, not a unit-cost database like RSMeans. TIER_4 — not a fit for E68's construction-cost gaps.",
  },
] as const;

/** Sources already free and in E68's existing registry, kept here only for the tier/recommendation cross-reference — no new figures are added. */
export const CRE_FREE_SOURCE_IDS: readonly string[] = [
  "cbre-ca-cap-rates",
  "cbre-us-cap-rates",
  "colliers-ca-cap-rates",
  "jll-cre-research",
  "cushman-cre-research",
  "marcus-millichap-research",
  "newmark-research",
  "kidder-mathews-research",
  "matthews-research",
  "cushman-wakefield-canada",
];

export interface CRERecommendationEntry {
  sourceId: string;
  tier: RecommendationTier;
  primaryValue: string;
}

/** Part 14 final decision matrix — tier assignment only, no pricing figures. */
export const CRE_RECOMMENDATION_TIERS: readonly CRERecommendationEntry[] = [
  { sourceId: "cbre-cap-rate-survey", tier: "TIER_1", primaryValue: "Broadest documented cap-rate segmentation (sector x class x stabilized/value-add)" },
  { sourceId: "msci-rca", tier: "TIER_1", primaryValue: "Transaction-derived cap rates, top of E68's own source hierarchy" },
  { sourceId: "altus-group", tier: "TIER_1", primaryValue: "Best Canadian coverage, cap rate + construction cost combined" },
  { sourceId: "rsmeans-gordian", tier: "TIER_1", primaryValue: "Only granular, partly-priced construction-cost database reviewed" },
  { sourceId: "green-street", tier: "TIER_2", primaryValue: "Documented cap-rate + sales-comps time series, broad US coverage" },
  { sourceId: "moodys-analytics-cre", tier: "TIER_2", primaryValue: "Best-documented API among cap-rate sources" },
  { sourceId: "costar-market-analytics", tier: "TIER_2", primaryValue: "De-facto source behind existing free E68 figures; would open Miami" },
  { sourceId: "trepp", tier: "TIER_3", primaryValue: "Only source with documented property-level NOI-adjacent data" },
  { sourceId: "marshall-swift-corelogic", tier: "TIER_3", primaryValue: "Replacement-cost specialist, complements RSMeans" },
  { sourceId: "realpage-analytics", tier: "TIER_3", primaryValue: "Multifamily-only, narrowest scope of reviewed subscription sources" },
  { sourceId: "yardi-matrix", tier: "TIER_3", primaryValue: "Strong multifamily/rent data, cap-rate product unconfirmed" },
  { sourceId: "commercialedge", tier: "TIER_4", primaryValue: "Listing/property platform, not a cap-rate or cost source" },
  { sourceId: "propertyshark", tier: "TIER_4", primaryValue: "Property records only, no API of its own" },
  { sourceId: "placer-ai", tier: "TIER_4", primaryValue: "Foot-traffic/location intelligence, not a cap-rate/cost source" },
  { sourceId: "lightbox", tier: "TIER_4", primaryValue: "Parcel/zoning data, not a cap-rate or cost source" },
  { sourceId: "dodge-construction-network", tier: "TIER_4", primaryValue: "Project/bid tracking, not a unit-cost database" },
];

export type ScenarioId = "SCENARIO_A_ZERO_BUDGET" | "SCENARIO_B_LOW_MODERATE_BUDGET" | "SCENARIO_C_PROFESSIONAL_BUDGET";

export interface CREScenarioSummary {
  scenarioId: ScenarioId;
  label: string;
  costTier: CostTierLabel;
  costNote: string;
  sourceIds: readonly string[];
  remainingGaps: readonly string[];
}

/** Part 15 scenarios — classification and source-id references only, no invented totals. */
export const CRE_SCENARIO_SUMMARIES: readonly CREScenarioSummary[] = [
  {
    scenarioId: "SCENARIO_A_ZERO_BUDGET",
    label: "Free/public sources only (current E68 state)",
    costTier: "FREE",
    costNote: "No paid source licensed; $0",
    sourceIds: CRE_FREE_SOURCE_IDS,
    remainingGaps: [
      "Miami cap rates, all classes",
      "Office/industrial/retail cap rates, all US and Canadian cities",
      "Houston construction cost",
      "Soft costs generally",
      "Transaction-derived (NOI-based) cap rates",
    ],
  },
  {
    scenarioId: "SCENARIO_B_LOW_MODERATE_BUDGET",
    label: "RSMeans Data Online only",
    costTier: "PARTIALLY_PUBLIC",
    costNote: "Confirmed public price ~$396-$1,019/yr (Core/Complete plan)",
    sourceIds: ["rsmeans-gordian"],
    remainingGaps: [
      "All cap-rate gaps unchanged (RSMeans does not address cap rates)",
      "Houston construction cost only plausibly, not confirmed, filled",
    ],
  },
  {
    scenarioId: "SCENARIO_C_PROFESSIONAL_BUDGET",
    label: "CBRE Cap Rate Survey + MSCI/RCA + RSMeans Complete Plus",
    costTier: "PRICING_NOT_PUBLIC",
    costNote: "Two of three components have no public price; RSMeans Complete Plus alone is ~$5,973/yr",
    sourceIds: ["cbre-cap-rate-survey", "msci-rca", "rsmeans-gordian"],
    remainingGaps: [
      "Exact granularity of Miami and office/industrial/retail coverage unverified against sample data",
      "Redistribution rights for all three require an actual contract read",
    ],
  },
];

export function getPaidSourceProfile(sourceId: string): CREPaidSourceProfile | undefined {
  return CRE_PAID_SOURCE_PROFILES.find((source) => source.sourceId === sourceId);
}

export function listPaidSourcesByCountry(country: SourceCountryCoverage): CREPaidSourceProfile[] {
  return CRE_PAID_SOURCE_PROFILES.filter((source) => source.countryCoverage === country || source.countryCoverage === "CA_AND_US");
}

export function listPaidSourcesWithCapRateData(): CREPaidSourceProfile[] {
  return CRE_PAID_SOURCE_PROFILES.filter((source) => source.hasCapRateData === "CONFIRMED");
}

export function listPaidSourcesWithConstructionCostData(): CREPaidSourceProfile[] {
  return CRE_PAID_SOURCE_PROFILES.filter((source) => source.hasConstructionCostData === "CONFIRMED");
}

export function getRecommendationTier(sourceId: string): RecommendationTier | undefined {
  return CRE_RECOMMENDATION_TIERS.find((entry) => entry.sourceId === sourceId)?.tier;
}

/**
 * A source can be redistributed only if every licensing permission that
 * governs raw-data exposure explicitly allows it — never inferred from API
 * availability, cost tier, or coverage breadth.
 */
export function isPaidSourceRedistributable(source: CREPaidSourceProfile): boolean {
  return (
    source.licensing.redistributeRawData === "YES" &&
    source.licensing.storeRawData === "YES" &&
    !source.redistributionRestricted
  );
}

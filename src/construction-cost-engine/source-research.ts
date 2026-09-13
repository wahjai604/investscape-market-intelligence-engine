/**
 * InvestScape™ E88 Phase 3 — Source research register.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Structured record of every source investigated in Phase 3 (Parts 3-5),
 * with an explicit USE/REGISTER/REJECT decision and rationale. This is
 * metadata about sources, not construction-cost data itself — no numeric
 * observation lives in this file. See docs/E88-phase3-coverage-and-source-
 * backfill.md for the full narrative behind each entry.
 *
 * "REGISTER" means: acknowledged as a real, relevant source, with known or
 * partially-known licensing posture, but no numeric data has been ingested
 * from it — either because licensing/redistribution terms are unconfirmed,
 * or because what was found is not structured enough to normalize honestly
 * (Phase 1/2 architecture: a missing observation is preferable to a
 * fabricated or unjustifiably mapped one).
 */

export type SourceDecision = "USE" | "REGISTER" | "REJECT";

export interface SourceResearchRecord {
  sourceId: string;
  sourceName: string;
  dataType: string;
  geography: string;
  buildingCategories: string;
  observationAvailability: string;
  publicationCadence: string;
  licensing: string;
  redistribution: string;
  acquisitionMechanism: string;
  e88Compatibility: string;
  decision: SourceDecision;
  rationale: string;
}

export const E88_PHASE3_SOURCE_RESEARCH: readonly SourceResearchRecord[] = [
  {
    sourceId: "rlb-north-america",
    sourceName: "Rider Levett Bucknall — Quarterly Construction Cost Report, North America",
    dataType: "Hard construction cost ($/SF), city-level cost index, national cost index",
    geography: "18 U.S. cities + Calgary/Toronto (Canada) for hard cost; same set for cost index",
    buildingCategories: "Office (Prime/Secondary), Retail (Shopping Center/Strip), Hotel (5-Star/3-Star), Hospital (General); a second table (Industrial Warehouse, Parking, Residential Multi-Family/Single-Family, Education) exists but is NOT ingested this phase — see coverage-matrix.ts and Phase 3 doc Section 2.",
    observationAvailability: "Re-fetched 2026-09-11; hard-cost table cross-validated exact match against E86's existing Austin/Miami/Seattle/Phoenix figures before trusting the 16 additional cities.",
    publicationCadence: "Quarterly",
    licensing: "Publicly downloadable PDF report. No paywall, no account required.",
    redistribution: "Not confirmed permitted as raw redistribution — E86/E88 store cited observations, not a copy of the report (unchanged from Phase 1 finding).",
    acquisitionMechanism: "Direct PDF download from rlb.com, no authentication.",
    e88Compatibility: "Direct — reuses existing RLB_SUBTYPE_MAPPING taxonomy entries for the 7 building types already mapped.",
    decision: "USE",
    rationale: "Already in use since E86 Phase 4; Phase 3 backfills the same report's already-legitimate coverage to 16 additional cities (14 US + 2 Canada) at exact/close/approximate confidence identical to the original 4 cities. No new licensing question — same report, same terms.",
  },
  {
    sourceId: "turner-townsend-north-america",
    sourceName: "Turner & Townsend — Global Construction Market Intelligence (GCMI) 2026",
    dataType: "Per-m² headline city rankings (e.g. \"most expensive market\"); full report structure not confirmed",
    geography: "112 markets globally per publisher's own description; specific North American city breakdown not confirmed in the researched pages",
    buildingCategories: "Not confirmed — the publicly visible page surfaces only aggregate per-m² city rankings, not a per-building-type table comparable to RLB's",
    observationAvailability: "A public marketing page names specific $/m² figures for a handful of cities (New York, San Francisco, Geneva, London) as headline highlights, not a structured, building-type-broken-out table. The full report lives behind a separate publications microsite (publications.turnerandtownsend.com) whose access terms were not confirmed in this phase's research.",
    publicationCadence: "Annual (GCMI); a separate quarterly \"Canada MI\" cost guide also exists (marketintelligence.turnerandtownsend.com)",
    licensing: "Unconfirmed. No explicit redistribution or commercial-use terms were found on the researched pages.",
    redistribution: "Unconfirmed — do not assume permitted.",
    acquisitionMechanism: "Web page + linked publications microsite; access requirements (registration, paywall) not confirmed.",
    e88Compatibility: "Would require a new per-source taxonomy mapping table (no T&T-specific building-type categories confirmed yet) if usable data is later confirmed.",
    decision: "REGISTER",
    rationale: "Real numeric figures exist and are publicly visible, but (a) they are headline city rankings, not a structured table this phase can honestly normalize into E88's canonical taxonomy without inventing a category correspondence, and (b) licensing/redistribution terms were not confirmed. Per Phase 3 Part 3's own instruction, licensing uncertainty means: register the source, document the uncertainty, do not insert proprietary values. No T&T numeric observation is ingested this phase.",
  },
  {
    sourceId: "statcan-bcpi",
    sourceName: "Statistics Canada — Building Construction Price Indexes (BCPI), Table 18-10-0289-01",
    dataType: "Quarterly PRICE INDEX (not a dollar cost figure) for representative building models",
    geography: "15 Canadian CMAs: St. John's, Moncton, Halifax, Québec, Montréal, Ottawa-Gatineau (ON part), Toronto, London, Winnipeg, Regina, Saskatoon, Calgary, Edmonton, Vancouver, Victoria",
    buildingCategories: "Non-residential: office building, warehouse, shopping centre, factory, school, bus depot. Residential: single-detached house, townhouse, high-rise apartment (5+ storeys), low-rise apartment (<5 storeys).",
    observationAvailability: "Index values and quarterly percentage changes are public and downloadable; there is no accompanying $/SF or $/m² dollar figure published as part of this series.",
    publicationCadence: "Quarterly",
    licensing: "Government of Canada Open Government Licence — public, free.",
    redistribution: "Permitted under public-data terms (matches E86's existing `isRedistributable()` classification — the only construction-adjacent source in the registry that already qualifies).",
    acquisitionMechanism: "Direct download / API via Statistics Canada's data portal (www150.statcan.gc.ca), no authentication.",
    e88Compatibility: "Escalation/index input only (Phase 4 concern) — NOT a construction-cost observation. Its own building-model categories (office/warehouse/shopping centre/factory/school/bus depot; single-detached/townhouse/high-rise/low-rise apartment) are a genuinely useful FUTURE taxonomy cross-reference once Phase 4 escalation is built, but ingesting it now as a 'construction cost' would violate Phase 3 Part 4's explicit rule against treating an index as a cost benchmark.",
    decision: "REGISTER",
    rationale: "Confirmed real, free, redistributable, and building-category-specific — but it is structurally an index, not a cost observation, and Phase 3 Part 4 explicitly forbids treating an index as a construction-cost benchmark. Registered for Phase 4 escalation use; zero hard/soft/total cost observations ingested from it this phase.",
  },
  {
    sourceId: "cmhc-housing",
    sourceName: "CMHC (Canada Mortgage and Housing Corporation) — housing market data",
    dataType: "Housing starts, completions, market absorption, investment — not a per-unit construction cost series",
    geography: "Canada, national/provincial/CMA",
    buildingCategories: "Residential (not building-type-specific construction cost)",
    observationAvailability: "Public data exists but no per-SF or per-unit HARD CONSTRUCTION COST series was identified in this phase's research (not deeply re-researched beyond Phase 1's existing registry entry).",
    publicationCadence: "Monthly/quarterly depending on series",
    licensing: "Government of Canada, public",
    redistribution: "Likely permitted under public-data terms, not independently re-confirmed this phase",
    acquisitionMechanism: "CMHC Housing Market Information Portal",
    e88Compatibility: "None identified — no construction-cost-shaped series found",
    decision: "REJECT",
    rationale: "No per-SF/per-unit construction-cost series was identified; CMHC's public data is about housing market activity (starts, completions, investment), not construction cost. Rejected for E88's purposes specifically (a future housing-market-intelligence engine may still find it useful — out of E88's scope).",
  },
  {
    sourceId: "rsmeans-gordian",
    sourceName: "RSMeans / Gordian",
    dataType: "Licensed line-item unit-cost database",
    geography: "U.S. (primary), some Canadian coverage",
    buildingCategories: "Extremely granular — assembly/line-item level, would cover multifamily/industrial/soft-cost gaps RLB does not",
    observationAvailability: "Confirmed to exist per E86 Phase 6 `paid-source-analysis.ts`; not re-researched this phase (no new information — Phase 3 Part 3 caps licensed-source work at metadata only).",
    publicationCadence: "Continuously updated (subscription database), annual print editions",
    licensing: "Paid subscription",
    redistribution: "REQUIRES_LICENSE_REVIEW per E86 Phase 6's own seven-question framework — unresolved, not re-litigated this phase",
    acquisitionMechanism: "Paid subscription/license purchase — explicitly not performed (Phase 3 instruction: do not purchase anything)",
    e88Compatibility: "High, if licensed — would need its own taxonomy mapping table",
    decision: "REGISTER",
    rationale: "Carried forward unchanged from E86 Phase 6 / Phase 1 Section 21. No purchase, no account creation, no new research this phase — remains a Phase 6 (E88 roadmap) concern.",
  },
  {
    sourceId: "altus-group",
    sourceName: "Altus Group",
    dataType: "Licensed Canadian construction-cost data (confirmed to exist per E86 Phase 6)",
    geography: "Canada-primary",
    buildingCategories: "Not re-researched this phase",
    observationAvailability: "Confirmed to exist per E86 Phase 6; not re-researched this phase",
    publicationCadence: "Not re-researched this phase",
    licensing: "Subscription/licensed",
    redistribution: "REQUIRES_LICENSE_REVIEW per E86 Phase 6 — unresolved, not re-litigated this phase",
    acquisitionMechanism: "Paid subscription — explicitly not performed",
    e88Compatibility: "Best-positioned Canadian licensed candidate per Phase 1 Section 21, unchanged",
    decision: "REGISTER",
    rationale: "Carried forward unchanged from Phase 1/E86 Phase 6. No purchase, no account creation, no new research this phase.",
  },
] as const;

/**
 * InvestScape™ E70 Phase 6 — Source Registry.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * The definitive, machine-readable list of every construction-cost-relevant
 * source E70 has evaluated through Phase 6, extending (not replacing) the
 * Phase 3 `source-research.ts` USE/REGISTER/REJECT register with the
 * richer access/license/readiness model Phase 6 requires. Every entry below
 * is a documented project finding — general-knowledge/public-page research,
 * not legal advice, and re-verifiable against each publisher's current
 * terms (identical caveat to Phase 1 Section 21 / Phase 3 Section 8).
 *
 * `computeAnalyticalReadiness` (source-adapter-types.ts) is the ONLY way
 * readiness is derived — nothing below hand-asserts a readiness value.
 */
import { computeAnalyticalReadiness, type E70AnalyticalReadiness, type E70SourceDefinition } from "./source-adapter-types";

export const RLB_SOURCE_DEFINITION: E70SourceDefinition = {
  sourceId: "rlb-north-america",
  publisher: "Rider Levett Bucknall",
  productName: "Quarterly Construction Cost Report — North America",
  version: "Q2 2026",
  publicationDate: "2026-07-07",
  geographyScope: "18 US cities + Calgary/Toronto (Canada), per Phase 3 backfill",
  buildingTypeScope: "Office (prime/secondary), Retail (shopping center/strip), Hotel (5-star/3-star), Hospital (general) — 7 RLB building types",
  metricScope: ["hard_cost", "construction_index", "construction_cost_change"],
  accessStatus: "AVAILABLE",
  licenseStatus: "REDISTRIBUTION_RESTRICTED",
  redistribution: {
    rawObservationVisibility: "RESTRICTED",
    derivedOutputVisibility: "VISIBLE",
    redistributionAllowed: false,
    attributionRequired: true,
    licenseReference: "RLB public report — no explicit raw-data redistribution grant found (Phase 1 Section 21, Phase 3 Section 8)",
    note: "Publicly downloadable PDF, no paywall or account required, but redistribution of the raw report/table data is not assumed permitted. E68/E70 store cited OBSERVATIONS (a $/SF figure with full citation), not a copy of the report — this has been E68's operating posture since Phase 4, unchanged here. A derived benchmark (Phase 5 output) is a distinct question from redistributing the report itself and is treated as VISIBLE, consistent with how E68/E70 have already been shipping benchmark-shaped output built on this source since Phase 2.",
  },
  ingested: true,
  statusNote: "The only source with ingested E70 cost observations (53 from E68 Phase 4 + 112 from E70 Phase 3 backfill = 165 hard-cost observations, plus 21 index/change observations). USE.",
};

export const TURNER_TOWNSEND_SOURCE_DEFINITION: E70SourceDefinition = {
  sourceId: "turner-townsend-north-america",
  publisher: "Turner & Townsend",
  productName: "Global Construction Market Intelligence (GCMI) 2026 / Canada MI cost guide",
  geographyScope: "112 markets globally per publisher's own description; North American city breakdown not confirmed",
  buildingTypeScope: "Not confirmed — publicly visible pages surface only aggregate $/m² city-ranking headlines, not a structured per-building-type table",
  metricScope: [],
  accessStatus: "ACCESS_NOT_VERIFIED",
  licenseStatus: "LICENSE_UNKNOWN",
  redistribution: {
    rawObservationVisibility: "NOT_APPLICABLE",
    derivedOutputVisibility: "NOT_APPLICABLE",
    redistributionAllowed: false,
    attributionRequired: false,
    note: "Full report structure lives behind a separate publications microsite whose access terms (registration/paywall/free) were not confirmed as of Phase 3. No usable per-building-type figures have been located, so redistribution/derivation questions are moot until real data exists. Unchanged from Phase 3's REGISTER verdict.",
  },
  ingested: false,
  statusNote: "REGISTERED / DEFERRED. Real headline $/m² figures exist publicly for a handful of cities but are not a structured table this codebase can honestly normalize into E70's canonical taxonomy without inventing a category correspondence the source doesn't itself provide (Phase 3 Section 3).",
};

export const RSMEANS_SOURCE_DEFINITION: E70SourceDefinition = {
  sourceId: "rsmeans-gordian",
  publisher: "RSMeans / Gordian",
  productName: "RSMeans Data (line-item unit-cost database)",
  geographyScope: "U.S. primary, some Canadian coverage",
  buildingTypeScope: "Extremely granular assembly/line-item level — would cover multifamily/industrial/soft-cost gaps RLB does not, per Phase 1/3 research",
  metricScope: ["hard_cost", "soft_cost"],
  accessStatus: "LICENSE_REQUIRED",
  licenseStatus: "INTERNAL_LICENSE_REQUIRED",
  redistribution: {
    rawObservationVisibility: "NOT_APPLICABLE",
    derivedOutputVisibility: "NOT_APPLICABLE",
    redistributionAllowed: false,
    attributionRequired: false,
    note: "Paid subscription database. E68 Phase 6's own seven-question CRELicensingProfile framework already found every permission (internal consumption, display benchmark, display underlying value, store raw data, redistribute raw data, display derived calculations, expose provenance) REQUIRES_LICENSE_REVIEW or NO. Not re-litigated here — carried forward unchanged.",
  },
  ingested: false,
  statusNote: "REGISTERED / LICENSE_REQUIRED / DEFERRED. No purchase, account creation, or new research performed this phase — remains a future licensing-review decision, contingent on budget and legal review.",
};

export const ALTUS_SOURCE_DEFINITION: E70SourceDefinition = {
  sourceId: "altus-group",
  publisher: "Altus Group",
  productName: "Altus construction-cost data (Canada-primary)",
  geographyScope: "Canada-primary",
  buildingTypeScope: "Not re-researched this phase (unchanged from Phase 1/3)",
  metricScope: ["hard_cost"],
  accessStatus: "LICENSE_REQUIRED",
  licenseStatus: "INTERNAL_LICENSE_REQUIRED",
  redistribution: {
    rawObservationVisibility: "NOT_APPLICABLE",
    derivedOutputVisibility: "NOT_APPLICABLE",
    redistributionAllowed: false,
    attributionRequired: false,
    note: "Subscription/licensed. Best-positioned Canadian licensed candidate per Phase 1 Section 21 — unchanged. E68 Phase 6's licensing-permission framework applies identically to this source and was not re-litigated this phase.",
  },
  ingested: false,
  statusNote: "REGISTERED / LICENSE_REQUIRED / DEFERRED. No purchase or new research performed this phase.",
};

export const STATCAN_BCPI_SOURCE_DEFINITION: E70SourceDefinition = {
  sourceId: "statcan-bcpi",
  publisher: "Statistics Canada",
  productName: "Building Construction Price Indexes (BCPI), Table 18-10-0289-01",
  geographyScope: "15 Canadian CMAs",
  buildingTypeScope: "Non-residential (office/warehouse/shopping centre/factory/school/bus depot) and residential (single-detached/townhouse/high-rise/low-rise apartment) building MODELS — index only, never a dollar figure",
  metricScope: ["construction_index"],
  accessStatus: "AVAILABLE",
  licenseStatus: "PUBLIC_REUSE",
  redistribution: {
    rawObservationVisibility: "VISIBLE",
    derivedOutputVisibility: "VISIBLE",
    redistributionAllowed: true,
    attributionRequired: true,
    licenseReference: "Government of Canada Open Government Licence",
    note: "Confirmed free, government-published, redistributable under public-data terms (Phase 3 Section 4 — the only construction-adjacent source in the whole registry that already qualifies as redistributable). This is explicitly an INDEX source, never a construction-cost observation source — see Phase 4 Section 4/12 and this file's `metricScope` (construction_index only, no hard_cost/soft_cost entry, ever).",
  },
  ingested: false,
  statusNote: "INDEX / REGISTERED, zero observations ingested (Phase 4 Section 4: 'registering a source is not the same as having evidence from it'). Readiness is READY (fully accessible, public-reuse licensed) but `ingested: false` means no envelope is produced yet — an ingestion-layer task, not a licensing block. See Phase 4 escalation.ts / applicability.ts, unchanged by this phase.",
};

export const CMHC_SOURCE_DEFINITION: E70SourceDefinition = {
  sourceId: "cmhc-housing",
  publisher: "Canada Mortgage and Housing Corporation (CMHC)",
  productName: "CMHC housing market data (starts/completions/investment)",
  geographyScope: "Canada, national/provincial/CMA",
  buildingTypeScope: "Residential market activity — not a per-SF or per-unit construction-cost series",
  metricScope: [],
  accessStatus: "UNAVAILABLE",
  licenseStatus: "NOT_APPLICABLE",
  redistribution: {
    rawObservationVisibility: "NOT_APPLICABLE",
    derivedOutputVisibility: "NOT_APPLICABLE",
    redistributionAllowed: false,
    attributionRequired: false,
    note: "Not a licensing restriction — the public data itself is not construction-cost-shaped (housing starts/completions/investment, not $/SF or $/unit). `accessStatus: UNAVAILABLE` here means 'no usable construction-cost series exists to access,' not 'the source is unreachable.'",
  },
  ingested: false,
  statusNote: "REJECTED (unchanged from Phase 3 Section 11). No per-SF/per-unit construction-cost series was identified in prior research; retained as rejected rather than re-investigated, per this phase's instruction to preserve the previously established status.",
};

export const E70_SOURCE_REGISTRY: readonly E70SourceDefinition[] = [
  RLB_SOURCE_DEFINITION,
  TURNER_TOWNSEND_SOURCE_DEFINITION,
  RSMEANS_SOURCE_DEFINITION,
  ALTUS_SOURCE_DEFINITION,
  STATCAN_BCPI_SOURCE_DEFINITION,
  CMHC_SOURCE_DEFINITION,
] as const;

export interface E70SourceReadinessRow {
  sourceId: string;
  publisher: string;
  productName: string;
  costObservationsIngested: boolean;
  indexObservationsIngested: boolean;
  accessStatus: E70SourceDefinition["accessStatus"];
  licenseStatus: E70SourceDefinition["licenseStatus"];
  redistributionAllowed: boolean;
  analyticalReadiness: E70AnalyticalReadiness;
  statusNote: string;
}

/**
 * Deterministic, pure function: the same registry input always produces the
 * same matrix output (Phase 6 determinism requirement). Readiness is always
 * computed fresh via `computeAnalyticalReadiness`, never read from a stored
 * field, so the matrix can never silently drift from the access/license
 * facts that justify each row.
 */
export function buildSourceReadinessMatrix(registry: readonly E70SourceDefinition[] = E70_SOURCE_REGISTRY): readonly E70SourceReadinessRow[] {
  return registry.map((def) => ({
    sourceId: def.sourceId,
    publisher: def.publisher,
    productName: def.productName,
    costObservationsIngested: def.ingested && (def.metricScope.includes("hard_cost") || def.metricScope.includes("soft_cost")),
    indexObservationsIngested: def.ingested && def.metricScope.includes("construction_index"),
    accessStatus: def.accessStatus,
    licenseStatus: def.licenseStatus,
    redistributionAllowed: def.redistribution.redistributionAllowed,
    analyticalReadiness: computeAnalyticalReadiness(def),
    statusNote: def.statusNote,
  }));
}

export function findSourceDefinition(sourceId: string, registry: readonly E70SourceDefinition[] = E70_SOURCE_REGISTRY): E70SourceDefinition | undefined {
  return registry.find((d) => d.sourceId === sourceId);
}

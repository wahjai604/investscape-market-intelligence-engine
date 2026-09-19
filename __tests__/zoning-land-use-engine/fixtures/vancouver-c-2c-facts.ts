/**
 * InvestScape™ E85 Phase 14.4B — curated Vancouver C-2C test facts.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * SELF-CONTAINED AND OFFLINE. Nothing in this file reads a PDF, touches the
 * local pilot-evidence folder, or reaches the network. The values below are
 * structured EXTRACTOR OUTPUT for the 2026-05 consolidation of the C-2C
 * District Schedule; only short terminology labels, numbers and locators
 * appear, never regulatory prose.
 *
 * NARROW, HONEST SLICE — ONLY THE RETAINED FACTS, NOTHING EXCLUDED FOR
 * CONVENIENCE. Six USE facts (Outright, all confirmed clear of any Section 11
 * dependency — see `c-2c-terminology.ts` for the Gate A2 reasoning on Grocery
 * or Drug Store) and one DIMENSIONAL fact (minimum front yard depth, the one
 * dimensional value that survives Gate C: the parking-area setback candidate
 * was excluded because `setbacksMetres`'s free-string keys are presented
 * downstream as undifferentiated yard/building-envelope setbacks — see
 * `c-2c-adapter.ts`'s own source-finding text for the full reasoning).
 *
 * EXCLUDED FROM THIS SLICE, DELIBERATELY:
 *   - Retail Store: real, unresolved Section 11 dependencies (liquor-store
 *     carve-out, used-merchandise floor-area allowance). Excluded per this
 *     phase's brief regardless of any Section 11 index finding.
 *   - Every DENSITY value (§3.1/§3.2 FSR figures): blocked by the §3.1 gate
 *     (bedroom-mix, Sub-Area A) and the §3.1.1.1/§3.2.1.1 minimum-non-dwelling
 *     FSR proviso.
 *   - Every height/storeys value: overridden by the angular building envelope
 *     (§3.1.2.8/§3.2.2.6) for a majority-plausible site.
 *   - The §3.1.2.13/§3.2.2.11 parking-area setback (1.2 m): a real, dated
 *     value, held out per Gate C (see above).
 *   - Maximum unit frontage (15.3 m): no existing E85 field honestly
 *     represents a tenancy/unit-frontage limit.
 *   - Every REQUIREMENT (the Rental Housing Stock ODP dependency).
 *
 * TEMPORAL AUTHORITY. Every fact below carries the same proven window: By-law
 * 13447 clause 28 substituted the current Schedule L structure, in force
 * 2022-11-14 per its own commencement clause — the same shape `r1-1-facts.ts`
 * uses for its own By-law-sourced temporal authority (value provenance is the
 * CURRENT consolidated clause on `documentLocator`; temporal provenance is
 * the AMENDING instrument on `temporalAuthority`, kept as two distinct axes).
 */
import type { E85StructuredSourceDocument, E85StructuredSourceFact } from "../../../src/zoning-land-use-engine";
import type { E85TemporalWindow } from "../../../src/zoning-land-use-engine/evidence-types";
import type { E85TemporalAuthority } from "../../../src/zoning-land-use-engine/provenance-types";
import { adapters } from "../../../src/zoning-land-use-engine";

const { VANCOUVER_C_2C_SOURCE_ID, VANCOUVER_C_2C_VERSION_ID, VANCOUVER_C_2C_ZONE, VANCOUVER_JURISDICTION_ID } = adapters.vancouver;

/** Fixed extraction timestamp — the adapter's only clock. */
export const EXTRACTED_AT = "2026-09-19T00:00:00.000Z";

const USE_TABLE = "2.1 Outright and Conditional Approval Uses";

/** By-law 13447 clause 28: substituted the current C-2C Schedule L structure, in force 2022-11-14. Shared by every retained fact in this narrow slice. */
const BYLAW_13447_TEMPORAL: E85TemporalWindow = { effectiveFrom: "2022-11-14", effectiveDateBasis: "AMENDMENT_DATE_KNOWN" };
const BYLAW_13447_AUTHORITY: E85TemporalAuthority = {
  instrument: { bylawOrDocumentId: "13447" },
  propositionLocator: { bylawOrDocumentId: "13447", clause: "28" },
  commencementLocator: { bylawOrDocumentId: "13447", clause: "28" },
};

export const GROCERY_OR_DRUG_STORE_TERM = "Grocery or Drug Store, except for Small-Scale Pharmacy";
export const BARBER_SHOP_TERM = "Barber Shop or Beauty Salon";
export const BEAUTY_WELLNESS_TERM = "Beauty and Wellness Centre";
export const LAUNDROMAT_TERM = "Laundromat or Dry Cleaning Establishment";
export const PHOTOFINISHING_TERM = "Photofinishing or Photography Studio";
export const REPAIR_SHOP_TERM = "Repair Shop - Class B";

export const FACT_OUTRIGHT_GROCERY_OR_DRUG_STORE: E85StructuredSourceFact = {
  factId: "c-2c-use-001",
  family: "USE",
  zoneDesignation: VANCOUVER_C_2C_ZONE,
  sourceTerm: "Outright Approval Use",
  sourceUseTerm: GROCERY_OR_DRUG_STORE_TERM,
  locator: { section: "2.1", table: USE_TABLE, row: GROCERY_OR_DRUG_STORE_TERM },
  temporal: BYLAW_13447_TEMPORAL,
  temporalAuthority: BYLAW_13447_AUTHORITY,
};

export const FACT_OUTRIGHT_BARBER_SHOP: E85StructuredSourceFact = {
  factId: "c-2c-use-002",
  family: "USE",
  zoneDesignation: VANCOUVER_C_2C_ZONE,
  sourceTerm: "Outright Approval Use",
  sourceUseTerm: BARBER_SHOP_TERM,
  locator: { section: "2.1", table: USE_TABLE, row: BARBER_SHOP_TERM },
  temporal: BYLAW_13447_TEMPORAL,
  temporalAuthority: BYLAW_13447_AUTHORITY,
};

export const FACT_OUTRIGHT_BEAUTY_WELLNESS: E85StructuredSourceFact = {
  factId: "c-2c-use-003",
  family: "USE",
  zoneDesignation: VANCOUVER_C_2C_ZONE,
  sourceTerm: "Outright Approval Use",
  sourceUseTerm: BEAUTY_WELLNESS_TERM,
  locator: { section: "2.1", table: USE_TABLE, row: BEAUTY_WELLNESS_TERM },
  temporal: BYLAW_13447_TEMPORAL,
  temporalAuthority: BYLAW_13447_AUTHORITY,
};

export const FACT_OUTRIGHT_LAUNDROMAT: E85StructuredSourceFact = {
  factId: "c-2c-use-004",
  family: "USE",
  zoneDesignation: VANCOUVER_C_2C_ZONE,
  sourceTerm: "Outright Approval Use",
  sourceUseTerm: LAUNDROMAT_TERM,
  locator: { section: "2.1", table: USE_TABLE, row: LAUNDROMAT_TERM },
  temporal: BYLAW_13447_TEMPORAL,
  temporalAuthority: BYLAW_13447_AUTHORITY,
};

export const FACT_OUTRIGHT_PHOTOFINISHING: E85StructuredSourceFact = {
  factId: "c-2c-use-005",
  family: "USE",
  zoneDesignation: VANCOUVER_C_2C_ZONE,
  sourceTerm: "Outright Approval Use",
  sourceUseTerm: PHOTOFINISHING_TERM,
  locator: { section: "2.1", table: USE_TABLE, row: PHOTOFINISHING_TERM },
  temporal: BYLAW_13447_TEMPORAL,
  temporalAuthority: BYLAW_13447_AUTHORITY,
};

export const FACT_OUTRIGHT_REPAIR_SHOP_B: E85StructuredSourceFact = {
  factId: "c-2c-use-006",
  family: "USE",
  zoneDesignation: VANCOUVER_C_2C_ZONE,
  sourceTerm: "Outright Approval Use",
  sourceUseTerm: REPAIR_SHOP_TERM,
  locator: { section: "2.1", table: USE_TABLE, row: REPAIR_SHOP_TERM },
  temporal: BYLAW_13447_TEMPORAL,
  temporalAuthority: BYLAW_13447_AUTHORITY,
};

/** §3.1.2.3/§3.2.2.3 minimum front yard depth — the one DIMENSIONAL fact this slice retains (Gate C). */
export const FACT_FRONT_YARD: E85StructuredSourceFact = {
  factId: "c-2c-dim-001",
  family: "DIMENSIONAL",
  zoneDesignation: VANCOUVER_C_2C_ZONE,
  sourceTerm: "Front Yard",
  numericValue: 2.5,
  unit: "METRES",
  locator: { section: "3.1.2.3" },
  temporal: BYLAW_13447_TEMPORAL,
  temporalAuthority: BYLAW_13447_AUTHORITY,
};

export const C_2C_FACTS: readonly E85StructuredSourceFact[] = [
  FACT_OUTRIGHT_GROCERY_OR_DRUG_STORE,
  FACT_OUTRIGHT_BARBER_SHOP,
  FACT_OUTRIGHT_BEAUTY_WELLNESS,
  FACT_OUTRIGHT_LAUNDROMAT,
  FACT_OUTRIGHT_PHOTOFINISHING,
  FACT_OUTRIGHT_REPAIR_SHOP_B,
  FACT_FRONT_YARD,
];

/** Provisions known to exist and deliberately NOT structured in this narrow slice. Mirrors each disclosure the adapter itself emits as a source finding, so a test can assert both together. */
export const C_2C_UNSTRUCTURED_SECTIONS: readonly string[] = [
  "3.1 / 3.2 — every floor space ratio value (not structured: gated by the §3.1 bedroom-mix/Sub-Area A regime and the §3.1.1.1/§3.2.1.1 minimum-non-dwelling-FSR proviso)",
  "3.1.2.2 / 3.1.2.7 / 3.2.2.1 (height/storeys rows) — every maximum height and storeys value (not structured: overridden by the §3.1.2.8/§3.2.2.6 angular building envelope for a majority-plausible site)",
];

/** Builds an extract, optionally overriding any field. */
export function c2cDocument(overrides: Partial<E85StructuredSourceDocument> = {}): E85StructuredSourceDocument {
  return {
    sourceId: VANCOUVER_C_2C_SOURCE_ID,
    jurisdictionId: VANCOUVER_JURISDICTION_ID,
    versionId: VANCOUVER_C_2C_VERSION_ID,
    zoneDesignation: VANCOUVER_C_2C_ZONE,
    facts: C_2C_FACTS,
    unstructuredSections: C_2C_UNSTRUCTURED_SECTIONS,
    extractedAt: EXTRACTED_AT,
    ...overrides,
  };
}

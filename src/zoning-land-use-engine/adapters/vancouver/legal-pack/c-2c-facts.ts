/**
 * InvestScape™ E85 Phase 14.4B — production Vancouver C-2C legal-pack facts.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * PRODUCTION HOME (legal-pack packaging pass). Moved verbatim from the test
 * fixture, which now re-exports this module, so tests and production cannot
 * hold two copies. The fact set is pinned by digest in `manifest.ts`, and
 * `loadVancouverLegalPack` refuses to start on any mismatch.
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
 * 2022-11-14 per its own commencement clause, clause 89 (enacted 2022-07-20).
 * Clause 28 is the proposition locator only; it is not the commencement
 * clause (corrected per VANCOUVER-LEGAL-PACK-READINESS.md §3) — the same shape `r1-1-facts.ts`
 * uses for its own By-law-sourced temporal authority (value provenance is the
 * CURRENT consolidated clause on `documentLocator`; temporal provenance is
 * the AMENDING instrument on `temporalAuthority`, kept as two distinct axes).
 */
import type { E85StructuredFactQualification, E85StructuredSourceFact } from "../../../source-fact-types";
import type { E85TemporalWindow } from "../../../evidence-types";
import type { E85TemporalAuthority } from "../../../provenance-types";
import { VANCOUVER_C_2C_ZONE } from "../c-2c-source";

const USE_TABLE = "2.1 Outright and Conditional Approval Uses";

/** By-law 13447 clause 28 substituted the current C-2C Schedule L structure; clause 89 brought it into force on 2022-11-14. Shared by every retained fact in this narrow slice. */
const BYLAW_13447_TEMPORAL: E85TemporalWindow = { effectiveFrom: "2022-11-14", effectiveDateBasis: "AMENDMENT_DATE_KNOWN" };
const BYLAW_13447_AUTHORITY: E85TemporalAuthority = {
  instrument: { bylawOrDocumentId: "13447" },
  propositionLocator: { bylawOrDocumentId: "13447", clause: "28" },
  commencementLocator: { bylawOrDocumentId: "13447", clause: "89" },
};

/**
 * §2.2.1, cited by every §2.1 commercial use row: the use must be carried on
 * wholly within a completely enclosed building, subject to exceptions (a)-(m)
 * and a Director variance. None of those exceptions concerns the six uses
 * below, so their approval value and date stand. §2.2.1's own chain is
 * separate from theirs and only partly located; it never dates these facts.
 */
/**
 * RETIRED compound id: it let one caller affirmation stand for enclosure, an
 * exception OR a variance. No fact names it any longer, so affirming it
 * releases nothing.
 */
export const C_2C_LEGACY_COMPOUND_ENCLOSED_BUILDING_CONDITION = "vancouver_c_2c_wholly_within_enclosed_building";

/**
 * The active §2.2.1 gate: the use will ACTUALLY be carried on wholly within a
 * completely enclosed building. E85 cannot observe it; only a caller
 * affirmation of this proposition releases the value (CALLER_ASSERTED). An
 * exception or variance does not satisfy it; those stay unmodelled.
 */
export const C_2C_ENCLOSED_BUILDING_CONDITION = "vancouver_c_2c_use_wholly_within_completely_enclosed_building";

/** Gates each §2.1 commercial use on §2.2.1. Never narrows a value; only withholds it until affirmed. */
const ENCLOSED_BUILDING_SCOPE = { conditionIds: [C_2C_ENCLOSED_BUILDING_CONDITION], locators: { requiredConditionIds: { section: "2.2.1", page: 5 } } };

export const C_2C_ENCLOSED_BUILDING_QUALIFICATION: E85StructuredFactQualification = {
  qualificationId: "c-2c-2.2.1-enclosed-building",
  kind: "USE_SPECIFIC_REGULATION",
  conditionId: C_2C_ENCLOSED_BUILDING_CONDITION,
  locator: { section: "2.2.1", page: 5 },
  description:
    "Commercial uses listed in section 2.1 must be carried on wholly within a completely enclosed building, subject to exceptions (a)-(m) and a Director of Planning variance. None of the exceptions concerns this use.",
  history: {
    status: "PARTLY_UNLOCATED",
    locatedInstruments: [
      { bylawOrDocumentId: "13967", clause: "19" },
      { bylawOrDocumentId: "14485", clause: "9" },
    ],
    disclosure:
      "Section 2.2.1 was wholly substituted by By-law 13967 cl.19 (in force 2024-04-09) and its restaurant wording amended by By-law 14485 cl.9 (in force 2025-11-05). No instrument has been located for exception limb (f) (hydrotherapy). This chain is the qualifier's own; it does not change this fact's effective date.",
  },
};

/**
 * §2.2.1 is satisfied by any ONE of three different propositions. Only the
 * enclosure id is WIRED (it is C_2C_ENCLOSED_BUILDING_CONDITION). The
 * exception and variance ids are on no fact, so affirming them releases
 * nothing: E85's `requiredConditionIds` is a conjunction with no any-of form,
 * and neither may rest on a caller assertion anyway.
 *
 * Only actual enclosure is a proposition a caller can assert about their own
 * proposal. An exception must name its limb and the facts that meet it. A
 * variance is an approval: a caller saying one was granted is a claim, not
 * proof, and must never release a value without a verified decision record.
 */
export interface C2CEnclosedBuildingAssertionProposal {
  readonly id: string;
  readonly proposition: string;
  readonly evidenceRequired: string;
  /** Whether a CALLER_ASSERTED_NOT_CITY_VERIFIED assertion could ever be enough on its own. */
  readonly callerAssertionMaySuffice: boolean;
}

export const C_2C_ENCLOSED_BUILDING_ASSERTION_PROPOSALS: readonly C2CEnclosedBuildingAssertionProposal[] = [
  {
    id: C_2C_ENCLOSED_BUILDING_CONDITION,
    proposition: "The use will actually be carried on wholly within a completely enclosed building.",
    evidenceRequired: "The proposal's own description or plans showing every part of the use's activity inside a completely enclosed building.",
    callerAssertionMaySuffice: true,
  },
  ...(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m"] as const).map((limb) => ({
    id: `vancouver_c_2c_2_2_1_exception_limb_${limb}`,
    proposition: `The activity falls within §2.2.1 exception limb (${limb}).`,
    evidenceRequired:
      `The facts meeting limb (${limb}) as worded on the as-of date. The fixture records that none of the exceptions concerns the six structured uses, so for them this is not a route to permission${limb === "f" ? "; limb (f)'s amendment history is also unlocated (Q5)" : ""}.`,
    callerAssertionMaySuffice: false,
  })),
  {
    id: "vancouver_c_2c_2_2_1_director_variance_granted",
    proposition: "The Director of Planning has granted a variance of §2.2.1 for this use on this site.",
    evidenceRequired: "A verified City decision record (decision or permit number, authority, date granted, conditions and site). A caller's claim that a variance exists is not this evidence.",
    callerAssertionMaySuffice: false,
  },
];

export const GROCERY_OR_DRUG_STORE_TERM ="Grocery or Drug Store, except for Small-Scale Pharmacy";
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
  applicability: ENCLOSED_BUILDING_SCOPE,
  qualifications: [C_2C_ENCLOSED_BUILDING_QUALIFICATION],
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
  applicability: ENCLOSED_BUILDING_SCOPE,
  qualifications: [C_2C_ENCLOSED_BUILDING_QUALIFICATION],
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
  applicability: ENCLOSED_BUILDING_SCOPE,
  qualifications: [C_2C_ENCLOSED_BUILDING_QUALIFICATION],
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
  applicability: ENCLOSED_BUILDING_SCOPE,
  qualifications: [C_2C_ENCLOSED_BUILDING_QUALIFICATION],
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
  applicability: ENCLOSED_BUILDING_SCOPE,
  qualifications: [C_2C_ENCLOSED_BUILDING_QUALIFICATION],
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
  applicability: ENCLOSED_BUILDING_SCOPE,
  qualifications: [C_2C_ENCLOSED_BUILDING_QUALIFICATION],
};

/**
 * §3.1.2.3/§3.2.2.3 minimum front yard depth — the one DIMENSIONAL fact this
 * slice retains (Gate C). Unscoped (zone-wide), so it cites BOTH sections:
 * §3.2.2.3 states the same 2.5 m (visually confirmed, p.12). Each section's
 * Director power to decrease the front yard (§3.1.2.10, §3.2.2.8) is disclosed
 * as a discretionary relaxation: 2.5 m stays the minimum unless one is granted.
 */
export const FACT_FRONT_YARD: E85StructuredSourceFact = {
  factId: "c-2c-dim-001",
  family: "DIMENSIONAL",
  zoneDesignation: VANCOUVER_C_2C_ZONE,
  sourceTerm: "Front Yard",
  numericValue: 2.5,
  unit: "METRES",
  locator: { section: "3.1.2.3", page: 9 },
  additionalLocators: [{ section: "3.2.2.3", page: 12 }],
  temporal: BYLAW_13447_TEMPORAL,
  temporalAuthority: BYLAW_13447_AUTHORITY,
  qualifications: [
    {
      qualificationId: "c-2c-3.1.2.10-front-yard-relaxation",
      kind: "DISCRETIONARY_RELAXATION",
      locator: { section: "3.1.2.10", page: 10 },
      description: "The Director of Planning may decrease the minimum front yard depth for section 3.1 development.",
      history: { status: "NOT_TRACED", disclosure: "The amendment history of section 3.1.2.10 was not traced; only its presence in the May 2026 consolidation is verified." },
    },
    {
      qualificationId: "c-2c-3.2.2.8-front-yard-relaxation",
      kind: "DISCRETIONARY_RELAXATION",
      locator: { section: "3.2.2.8", page: 13 },
      description: "The Director of Planning may decrease the minimum front yard depth for section 3.2 development.",
      history: { status: "NOT_TRACED", disclosure: "The amendment history of section 3.2.2.8 was not traced; only its presence in the May 2026 consolidation is verified." },
    },
  ],
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

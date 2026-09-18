/**
 * InvestScape™ E85 Phase 5 / Phase 12B.2 — curated Vancouver R1-1 test facts.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * SELF-CONTAINED AND OFFLINE. Nothing in this file reads a PDF, touches the
 * local pilot-evidence folder, or reaches the network. The values below are
 * structured EXTRACTOR OUTPUT for the June 2026 consolidation of the R1-1
 * District Schedule; only short terminology labels, numbers and locators
 * appear, never regulatory prose. Page numbers are the schedule's PRINTED page
 * numbers.
 *
 * PHASE 12B.2 FACT-INTEGRITY REMEDIATION (Phase 12B audit). The Phase 3B/5 set
 * collapsed scoped provisions into zone-wide values. Corrected here:
 *
 *   r1-1-use-001      KEPT id — same §2.1 row, terminology corrected from the
 *                     non-authoritative "One-Family Dwelling" to "Single
 *                     Detached House", locator corrected.
 *   r1-1-use-002      RETIRED -> r1-1-use-005: the permission is scoped to
 *                     "containing no more than 8 dwelling units".
 *   r1-1-density-001  RETIRED (zone-wide FSR 1.00 is not what the law says) ->
 *                     density-002 (§3.1 multiple dwelling 1.00),
 *                     density-003 (§3.2 duplex 0.70), density-004 (§3.2 other
 *                     uses 0.60), plus the §3.1.1.3 unit caps density-005/006.
 *   r1-1-dim-001      RETIRED -> dim-008 (§3.1 other MD buildings, 11.5 m) and
 *                     dim-010 (§3.2, 11.5 m).
 *   r1-1-dim-002      RETIRED -> dim-009 (§3.1 other MD buildings, 3 storeys).
 *                     §3.2 storeys are WITHHELD: §3.2.2.10 limits the third
 *                     storey to a partial storey, which E85 cannot represent.
 *   r1-1-dim-003      RETIRED -> dim-011 (§3.1.2.6) and dim-012 (§3.2.2.4).
 *   r1-1-dim-004      RETIRED -> dim-013 (§3.2.2.7, §3.2 scope only; §3.1 has
 *                     no site-coverage provision).
 *   r1-1-dim-005      RETIRED -> dim-006/007: §3.1.2.5(a) rear buildings of a
 *                     multiple dwelling, 8.5 m AND 2 storeys.
 *   new               use-003 Duplex (Outright), use-004 Duplex with Secondary
 *                     Suite (Conditional) — the §2.1 rows the duplex density
 *                     scope depends on.
 *
 * PHASE 12B.4:
 *   new               requirement-001 / requirement-002 — §3.1.1.3(b)(ii): a
 *                     minimum 5% of residential floor area as social housing, OR
 *                     a cash in lieu payment (ONE_OF). The cash rate lives in
 *                     Schedule J §8.1.1 and is carried only as an unstructured
 *                     reference: Schedule J has no E85 source identity yet. No
 *                     election actor is recorded — neither clause names one.
 *   locators          Every printed page re-verified against the rendered June
 *                     2026 schedule. Phase 12B.2 cited §3.1 as p.7, §3.1.2.5 as
 *                     p.8 and §3.2 as p.11; the printed pages are 8, 9 and 12.
 *                     §2.1 rows: Duplex and Duplex with Secondary Suite p.2;
 *                     Multiple Dwelling and Single Detached House p.3.
 *   §3.2.2.3          Visually verified as its own row, "Maximum building height:
 *                     11.5 m and 3 storeys", under §3.2 "all other uses not
 *                     regulated by section 3.1" — dim-010's scope is correct, and
 *                     §3.2 storeys stay withheld because §3.2.2.10 (p.13) limits
 *                     the third storey to a partial storey.
 *
 * PHASE 12C.2 — the current §3.1.1 density/unit-cap/affordable-housing block
 * (density-002/005/006, requirement-001/002) carries its OWN proven
 * `temporal` window (By-law 14747, effective 2026-06-30), established from the
 * amending instrument itself, never from this June-2026 consolidation stamp.
 *
 * PHASE 12C.3/12C.3A — By-law 13817's Schedule A (the original, image-based
 * 2023 R1-1 District Schedule) was visually rendered and inspected page by
 * page. 13 of the remaining undated facts (use-001/003/004, density-003/004,
 * dim-006 through dim-013) are proven, term-for-term and value-for-value,
 * identical to the 2023 original with no intervening amendment found across
 * the full evidence-folder scan — each now carries its OWN proven `temporal`
 * window (By-law 13817, effective 2023-10-17 per its own §29 commencement
 * clause), distinct per fact via its own 2023 Schedule A `propositionLocator`.
 * By-law 13817 §29 also carries a narrow, application-specific grandfathering
 * carve-out (preserving the pre-existing RS-schedules only for single-
 * detached-house/single-detached-house-with-secondary-suite permit
 * applications already complete and accepted on or before 2023-10-17); this
 * does not defer the general 2023-10-17 effective date and is not encoded
 * here.
 *
 * `use-005` (Multiple Dwelling, ≤8 units, Conditional) is deliberately KEPT
 * UNKNOWN: the original Schedule A's own §2.2.7 restricts the 7-8 unit
 * portion of that range to non-stratified, secured residential rental tenure
 * — a scope-narrowing qualifier the current normalized fact does not carry.
 * The current fact is therefore broader than the 2023 (and, so far as this
 * evidence goes, still-current) legal proposition, so dating it would assert
 * more than is proven. This is a separate fact-integrity question for a
 * future audit, not something this phase resolves.
 *
 * This file is not a test (jest matches `*.test.ts` only).
 */
import type { E85StructuredSourceDocument, E85StructuredSourceFact } from "../../../src/zoning-land-use-engine";
import type { E85TemporalWindow } from "../../../src/zoning-land-use-engine/evidence-types";
import type { E85DocumentLocator, E85TemporalAuthority } from "../../../src/zoning-land-use-engine/provenance-types";
import { adapters } from "../../../src/zoning-land-use-engine";

const { VANCOUVER_R1_1_SOURCE_ID, VANCOUVER_R1_1_VERSION_ID, VANCOUVER_R1_1_ZONE, VANCOUVER_JURISDICTION_ID } = adapters.vancouver;

/** Fixed extraction timestamp — the adapter's only clock, which is what makes every Phase 5 test reproducible. */
export const EXTRACTED_AT = "2026-09-01T00:00:00.000Z";

/** Exact §2.1 row wording. */
export const MULTIPLE_DWELLING_TERM = "Multiple Dwelling, containing no more than 8 dwelling units";
export const DUPLEX_TERM = "Duplex";
export const DUPLEX_WITH_SUITE_TERM = "Duplex with Secondary Suite";
export const REAR_BUILDING_TERM = "Rear Building";
export const RENTAL_100_TERM = "100% Residential Rental Tenure";

const USE_TABLE = "2.1 Outright and Conditional Approval Uses";

/** §3.1 heading: "Multiple dwelling, containing no more than 8 dwelling units". The source of every §3.1 use and unit scope. */
const S31_HEADING = { section: "3.1", page: 8 } as const;
/** §3.2 heading: "Other Uses — all other uses not regulated by section 3.1". */
const S32_HEADING = { section: "3.2", page: 12 } as const;

const MD_SCOPE = {
  useTerms: [MULTIPLE_DWELLING_TERM],
  dwellingUnits: { max: 8 },
  locators: { useCodes: S31_HEADING, dwellingUnits: S31_HEADING },
} as const;

const OTHER_USES_SCOPE = {
  excludedUseTerms: [MULTIPLE_DWELLING_TERM],
  locators: { excludedUseCodes: S32_HEADING },
} as const;

/**
 * PHASE 12C.3A — shared effective window for every fact proven identical to
 * By-law 13817's original 2023 Schedule A text. Every such fact ALSO takes
 * its own, distinct `propositionLocator` (see `s13817Authority` below) —
 * only the date and basis are shared, never the instrument clause, because
 * §2.1's use rows, §3.1.2.5/.6, and §3.2.1.1/§3.2.2.x are all separate
 * clauses of the same instrument, unlike 14747's single shared clause 4(d).
 */
const S13817_ORIGINAL_TEMPORAL: E85TemporalWindow = { effectiveFrom: "2023-10-17", effectiveDateBasis: "AMENDMENT_DATE_KNOWN" };

/**
 * Builds one fact's own By-law 13817 temporal authority: the instrument,
 * this fact's own 2023 Schedule A locator (distinct per fact — visually
 * verified against the rendered original, never assumed from the current
 * consolidation's page numbering), and the shared §29 commencement clause.
 */
function s13817Authority(propositionLocator: E85DocumentLocator): E85TemporalAuthority {
  return {
    instrument: { bylawOrDocumentId: "13817" },
    propositionLocator,
    commencementLocator: { bylawOrDocumentId: "13817", section: "29" },
  };
}

export const FACT_OUTRIGHT_SINGLE_DETACHED_HOUSE: E85StructuredSourceFact = {
  factId: "r1-1-use-001",
  family: "USE",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Outright Approval Use",
  sourceUseTerm: "Single Detached House",
  locator: { section: "2.1", table: USE_TABLE, row: "Single Detached House", page: 3 },
  temporal: S13817_ORIGINAL_TEMPORAL,
  temporalAuthority: s13817Authority({ schedule: "Schedule A", section: "2.1", row: "Single Detached House", page: 13 }),
};

export const FACT_OUTRIGHT_DUPLEX: E85StructuredSourceFact = {
  factId: "r1-1-use-003",
  family: "USE",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Outright Approval Use",
  sourceUseTerm: DUPLEX_TERM,
  locator: { section: "2.1", table: USE_TABLE, row: DUPLEX_TERM, page: 2 },
  temporal: S13817_ORIGINAL_TEMPORAL,
  temporalAuthority: s13817Authority({ schedule: "Schedule A", section: "2.1", row: DUPLEX_TERM, page: 12 }),
};

export const FACT_CONDITIONAL_DUPLEX_WITH_SUITE: E85StructuredSourceFact = {
  factId: "r1-1-use-004",
  family: "USE",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Conditional Approval Use",
  sourceUseTerm: DUPLEX_WITH_SUITE_TERM,
  locator: { section: "2.1", table: USE_TABLE, row: DUPLEX_WITH_SUITE_TERM, page: 2 },
  temporal: S13817_ORIGINAL_TEMPORAL,
  temporalAuthority: s13817Authority({ schedule: "Schedule A", section: "2.1", row: DUPLEX_WITH_SUITE_TERM, page: 12 }),
};

/**
 * PHASE 12C.4A — current §2.2.7 site-eligibility gate for Multiple Dwelling.
 * Opaque, adapter-level ids for §2.2.7(a)/(b)/(c): E85 does not resolve
 * land-title/parcel-history, site-access, or flood-plain-overlay facts itself;
 * a caller affirms or denies each independently. None of the three implies
 * or duplicates the others, and none is derived from any other field —
 * distinct from the coarse `dwellingUnits <= 8` scope, which is the USE row's
 * own text, and distinct from the tenure-conditioned unit cap, which remains
 * solely a DENSITY-family concern (`density-005`/`006`, §3.1.1.3).
 */
export const R1_1_MD_LOT_ON_RECORD_OR_SUBDIVIDED_CONDITION = "vancouver_r1_1_lot_on_record_or_subdivided";
/** §2.2.7(b): site provides vehicular access from the rear. */
export const R1_1_MD_REAR_VEHICULAR_ACCESS_CONDITION = "vancouver_r1_1_rear_vehicular_access";
/** §2.2.7(c): site is not partially or fully within a designated flood plain. */
export const R1_1_MD_NOT_IN_FLOOD_PLAIN_CONDITION = "vancouver_r1_1_not_in_flood_plain";

/**
 * PHASE 12C.4B — proven by direct visual re-inspection of By-law 13817's
 * original 2023 Schedule A page 15: the ORIGINAL Multiple Dwelling row cited
 * six use-specific regulations (2.2.1, 2.2.2, 2.2.7, 2.2.8, 2.2.9, 2.2.10),
 * where original §2.2.7 was the 7-8-unit non-stratified/rental-tenure
 * eligibility bar, original §2.2.8 was today's site-eligibility text
 * (byte-identical apart from clause (a), see below), original §2.2.9 was
 * today's bedroom-mix table, and original §2.2.10 was today's Director
 * discretion for >1 principal building.
 *
 * By-law 14747 clause 4(b) — "strikes section 2.2.7, renumbers section 2.2.8
 * as 2.2.7, and then renumbers the following sections sequentially" — is the
 * clause that (a) ELIMINATES the historical tenure/stratification eligibility
 * bar entirely (the semantic change that makes the current, tenure-silent
 * `use-005` proposition true for the first time) and (b) causes old-2.2.8/9/10
 * to become new-2.2.7/8/9. This is the PRIMARY proposition-changing authority,
 * chosen over clause 4(a)(i) by legal-semantic causation, not clause order:
 * 4(a)(i) (which strikes a now-stale ", 2.2.10" citation from the row) is a
 * consequence OF clause 4(b)'s renumbering cascade — without 4(b), the row
 * citing "2.2.10" a second time under new numbering would double-cite content
 * already covered by the row's own (renumbered) "2.2.9" — never an
 * independent cause of the row's current, shorter reference list.
 *
 * A THIRD, EARLIER amendment was found during this reconstruction and is
 * preserved as a supporting note rather than folded into the single
 * `propositionLocator`: By-law 13998 (enacted and in force 2024-04-23, before
 * 14747) clause 17(b) amended old-§2.2.7(a) [[now new-§2.2.7(a) verbatim, per
 * 14747's later pure renumbering]] from "is a single lot on record ... prior
 * to October 17, 2023" to the current two-branch "(i) prior to October 17,
 * 2023, or (ii) created by subdivision". This means the exact CURRENT wording
 * of condition (a) took its current form on 2024-04-23, under the
 * then-current section number (old 2.2.8), predating 14747's later
 * renumbering — 14747 did not originate the "created by subdivision" branch,
 * it only carried the already-13998-amended text forward under a new number.
 * The fact's own `effectiveFrom` is still correctly 2026-06-30: before that
 * date, the OVERALL current proposition (Conditional, ≤8 units, gated ONLY by
 * site-eligibility, with NO tenure/stratification bar) was false, because the
 * tenure/stratification bar was still in force under old-§2.2.7 until 14747
 * struck it. 13998 changed one component's wording earlier, under a different
 * number, while the historical tenure bar it coexisted with remained active.
 */
const S2_2_7_ELIGIBILITY_TEMPORAL: E85TemporalWindow = { effectiveFrom: "2026-06-30", effectiveDateBasis: "AMENDMENT_DATE_KNOWN" };
const S2_2_7_ELIGIBILITY_AUTHORITY: E85TemporalAuthority = {
  instrument: { bylawOrDocumentId: "14747" },
  propositionLocator: { bylawOrDocumentId: "14747", clause: "4(b)" },
  commencementLocator: { bylawOrDocumentId: "14747", section: "37" },
};

export const FACT_CONDITIONAL_MULTIPLE_DWELLING: E85StructuredSourceFact = {
  factId: "r1-1-use-005",
  family: "USE",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Conditional Approval Use",
  sourceUseTerm: MULTIPLE_DWELLING_TERM,
  applicability: {
    dwellingUnits: { max: 8 },
    conditionIds: [R1_1_MD_LOT_ON_RECORD_OR_SUBDIVIDED_CONDITION, R1_1_MD_REAR_VEHICULAR_ACCESS_CONDITION, R1_1_MD_NOT_IN_FLOOD_PLAIN_CONDITION],
    locators: {
      dwellingUnits: { section: "2.1", table: USE_TABLE, row: MULTIPLE_DWELLING_TERM, page: 3 },
      requiredConditionIds: { section: "2.2.7", page: 5 },
    },
  },
  locator: { section: "2.1", table: USE_TABLE, row: MULTIPLE_DWELLING_TERM, page: 3 },
  temporal: S2_2_7_ELIGIBILITY_TEMPORAL,
  temporalAuthority: S2_2_7_ELIGIBILITY_AUTHORITY,
  notes:
    'By-law 14747 clause 4(a)(i) also struck a now-stale ", 2.2.10" citation from this row\'s third column — a consequence of clause 4(b)\'s renumbering cascade, not an independent proposition change. Separately, By-law 13998 (in force 2024-04-23, predating 14747) clause 17(b) amended condition (a)\'s wording (then numbered 2.2.8(a)) to add the "created by subdivision" branch; 14747 carried that already-amended text forward under the new number 2.2.7(a) without further substantive change.',
};

/**
 * PHASE 12C.2 — §3.1.1 was struck and wholly replaced by By-law 14747 clause
 * 4(d), in force per its own §37 commencement clause on 2026-06-30. This is
 * the proposition's OWN effective date, distinct from the June-2026 schedule
 * consolidation stamp: 14747 is the amending instrument, not merely a
 * republication of unchanged text.
 */
const S311_REPLACEMENT_TEMPORAL: E85TemporalWindow = { effectiveFrom: "2026-06-30", effectiveDateBasis: "AMENDMENT_DATE_KNOWN" };

/**
 * PHASE 12C.2A — machine-readable authority backing `S311_REPLACEMENT_TEMPORAL`:
 * By-law 14747 clause 4(d) struck and replaced §3.1.1 wholesale; its own §37
 * commencement clause brings that replacement into force on 2026-06-30. Kept
 * distinct from each fact's `documentLocator` (which points at the CURRENT
 * consolidated clause, e.g. "3.1.1.2") — this points at the AMENDING
 * instrument instead, so a reviewer can answer "why 2026-06-30?" from the
 * normalized evidence alone, with no report or comment required.
 */
const S311_REPLACEMENT_AUTHORITY: E85TemporalAuthority = {
  instrument: { bylawOrDocumentId: "14747" },
  propositionLocator: { bylawOrDocumentId: "14747", clause: "4(d)" },
  commencementLocator: { bylawOrDocumentId: "14747", section: "37" },
};

/** §3.1.1.2 (as substituted by By-law 14747): maximum FSR 1.00 for §3.1 multiple dwellings. */
export const FACT_FSR_MULTIPLE_DWELLING: E85StructuredSourceFact = {
  factId: "r1-1-density-002",
  family: "DENSITY",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Floor Space Ratio",
  numericValue: 1.0,
  unit: "RATIO",
  applicability: MD_SCOPE,
  locator: { section: "3.1.1.2", page: 8 },
  temporal: S311_REPLACEMENT_TEMPORAL,
  temporalAuthority: S311_REPLACEMENT_AUTHORITY,
};

/** §3.2.1.1: 0.70 for duplex and duplex with secondary suite. */
export const FACT_FSR_DUPLEX: E85StructuredSourceFact = {
  factId: "r1-1-density-003",
  family: "DENSITY",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Floor Space Ratio",
  numericValue: 0.7,
  unit: "RATIO",
  applicability: { useTerms: [DUPLEX_TERM, DUPLEX_WITH_SUITE_TERM], locators: { useCodes: { section: "3.2.1.1", page: 12 } } },
  locator: { section: "3.2.1.1", page: 12 },
  temporal: S13817_ORIGINAL_TEMPORAL,
  temporalAuthority: s13817Authority({ schedule: "Schedule A", section: "3.2.1.1", page: 21 }),
};

/** §3.2.1.1: 0.60 for every other §3.2 use (i.e. not multiple dwelling per §3.2, not duplex per §3.2.1.1). */
export const FACT_FSR_OTHER_USES: E85StructuredSourceFact = {
  factId: "r1-1-density-004",
  family: "DENSITY",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Floor Space Ratio",
  numericValue: 0.6,
  unit: "RATIO",
  applicability: { excludedUseTerms: [MULTIPLE_DWELLING_TERM, DUPLEX_TERM, DUPLEX_WITH_SUITE_TERM], locators: { excludedUseCodes: { section: "3.2.1.1", page: 12 } } },
  locator: { section: "3.2.1.1", page: 12 },
  temporal: S13817_ORIGINAL_TEMPORAL,
  temporalAuthority: s13817Authority({ schedule: "Schedule A", section: "3.2.1.1", page: 21 }),
};

/** §3.1.1.3(a): 100% secured residential rental tenure -> maximum 8 dwelling units. */
export const FACT_UNITS_RENTAL: E85StructuredSourceFact = {
  factId: "r1-1-density-005",
  family: "DENSITY",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Maximum Number of Dwelling Units",
  numericValue: 8,
  unit: "DWELLING_UNITS",
  applicability: { ...MD_SCOPE, tenureTerms: [RENTAL_100_TERM], locators: { ...MD_SCOPE.locators, tenureCodes: { section: "3.1.1.3", clause: "(a)", page: 8 } } },
  locator: { section: "3.1.1.3", clause: "(a)", page: 8 },
  temporal: S311_REPLACEMENT_TEMPORAL,
  temporalAuthority: S311_REPLACEMENT_AUTHORITY,
};

/** §3.1.1.3(b)(i): any tenure other than residential rental -> maximum 6 dwelling units. */
export const FACT_UNITS_OTHER_TENURE: E85StructuredSourceFact = {
  factId: "r1-1-density-006",
  family: "DENSITY",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Maximum Number of Dwelling Units",
  numericValue: 6,
  unit: "DWELLING_UNITS",
  applicability: { ...MD_SCOPE, excludedTenureTerms: [RENTAL_100_TERM], locators: { ...MD_SCOPE.locators, excludedTenureCodes: { section: "3.1.1.3", clause: "(b)", page: 8 } } },
  locator: { section: "3.1.1.3", clause: "(b)(i)", page: 8 },
  temporal: S311_REPLACEMENT_TEMPORAL,
  temporalAuthority: S311_REPLACEMENT_AUTHORITY,
};

/** Opaque, adapter-level id for §3.1.1.3(b)(ii)(C). E85 does not resolve this geography; a caller affirms or denies it. */
export const SITE_WEST_OF_ONTARIO_OR_CARRALL_CONDITION = "site_west_of_ontario_or_carrall_street_centre_lines";

/** The §3.1.1.3(b)(ii) trigger: §3.1 multiple dwelling, tenure not 100% rental, site ≥ 623 m², frontage ≥ 17.1 m, west of the named centre lines. */
const AFFORDABLE_HOUSING_TRIGGER = {
  ...MD_SCOPE,
  excludedTenureTerms: [RENTAL_100_TERM],
  siteAreaSqm: { min: 623 },
  frontageMetres: { min: 17.1 },
  conditionIds: [SITE_WEST_OF_ONTARIO_OR_CARRALL_CONDITION],
  locators: {
    ...MD_SCOPE.locators,
    excludedTenureCodes: { section: "3.1.1.3", clause: "(b)", page: 8 },
    siteAreaSqm: { section: "3.1.1.3", clause: "(b)(ii)(A)", page: 8 },
    frontageMetres: { section: "3.1.1.3", clause: "(b)(ii)(B)", page: 8 },
    requiredConditionIds: { section: "3.1.1.3", clause: "(b)(ii)(C)", page: 8 },
  },
};

export const AFFORDABLE_HOUSING_CHOICE_GROUP = "r1-1_3.1.1.3_b_ii";
const SCHEDULE_J = "Schedule J: Affordable Housing Schedule";

/** §3.1.1.3(b)(ii): "a minimum of 5% of the residential floor area must be developed as social housing" — one alternative. */
export const FACT_REQUIREMENT_SOCIAL_HOUSING: E85StructuredSourceFact = {
  factId: "r1-1-requirement-001",
  family: "REQUIREMENT",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Social Housing",
  numericValue: 5,
  unit: "PERCENT",
  applicability: AFFORDABLE_HOUSING_TRIGGER,
  requirement: {
    quantityBasisTerm: "residential floor area",
    choiceGroup: { groupId: AFFORDABLE_HOUSING_CHOICE_GROUP, mode: "ONE_OF" },
    // §3.1.1.1: developments requiring social housing are subject to Schedule J.
    references: [{ role: "TERMS", target: { bylawOrDocumentId: "3575", schedule: SCHEDULE_J }, description: "affordable housing terms for required social housing, applied by section 3.1.1.1" }],
  },
  locator: { section: "3.1.1.3", clause: "(b)(ii)", page: 8 },
  temporal: S311_REPLACEMENT_TEMPORAL,
  temporalAuthority: S311_REPLACEMENT_AUTHORITY,
  // DEPENDENCY, NOT A PROPOSITION DATE (Phase 12C.1B/12C.2): the governing
  // Section 2 definition of "Social Housing" this alternative relies on was
  // itself amended by By-law 14586, effective 2026-02-03 — before this
  // proposition's own 2026-06-30 effective date, so no active interval exists
  // where the current §3.1.1.3(b)(ii) text was in force under the pre-14586
  // definition. Recorded as audit context only; it is never copied into
  // `temporal` and never used to select or exclude this fact.
  notes: "Governing definition dependency: Section 2 \"Social Housing\" was amended by By-law 14586, effective 2026-02-03. This is a definition/dependency date, not this obligation's own effectiveFrom (2026-06-30, By-law 14747).",
};

/** §3.1.1.3(b)(ii): "or a cash in lieu payment may be provided" — the other alternative. Its rate is Schedule J §8.1.1, not structured here. */
export const FACT_REQUIREMENT_CASH_IN_LIEU: E85StructuredSourceFact = {
  factId: "r1-1-requirement-002",
  family: "REQUIREMENT",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Cash in Lieu Payment",
  applicability: AFFORDABLE_HOUSING_TRIGGER,
  requirement: {
    choiceGroup: { groupId: AFFORDABLE_HOUSING_CHOICE_GROUP, mode: "ONE_OF" },
    references: [{ role: "QUANTIFICATION", target: { bylawOrDocumentId: "3575", schedule: SCHEDULE_J, section: "8.1.1", page: 5 }, description: "cash in lieu rate table" }],
  },
  locator: { section: "3.1.1.3", clause: "(b)(ii)", page: 8 },
  temporal: S311_REPLACEMENT_TEMPORAL,
  temporalAuthority: S311_REPLACEMENT_AUTHORITY,
};

const REAR_SCOPE = { ...MD_SCOPE, buildingRoleTerms: [REAR_BUILDING_TERM], locators: { ...MD_SCOPE.locators, buildingRoles: { section: "3.1.2.5", clause: "(a)", page: 9 } } };
const OTHER_MD_BUILDING_SCOPE = { ...MD_SCOPE, excludedBuildingRoleTerms: [REAR_BUILDING_TERM], locators: { ...MD_SCOPE.locators, excludedBuildingRoles: { section: "3.1.2.5", clause: "(b)", page: 9 } } };

/** §3.1.2.5(a): rear buildings of a multiple dwelling — 8.5 m. */
export const FACT_HEIGHT_REAR_MD: E85StructuredSourceFact = {
  factId: "r1-1-dim-006",
  family: "DIMENSIONAL",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Height",
  numericValue: 8.5,
  unit: "METRES",
  applicability: REAR_SCOPE,
  locator: { section: "3.1.2.5", clause: "(a)", page: 9 },
  temporal: S13817_ORIGINAL_TEMPORAL,
  temporalAuthority: s13817Authority({ schedule: "Schedule A", section: "3.1.2.5", clause: "(a)", page: 18 }),
};

/** §3.1.2.5(a): rear buildings of a multiple dwelling — 2 storeys (same provision, same scope). */
export const FACT_STOREYS_REAR_MD: E85StructuredSourceFact = {
  factId: "r1-1-dim-007",
  family: "DIMENSIONAL",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Storeys",
  numericValue: 2,
  unit: "STOREYS",
  applicability: REAR_SCOPE,
  locator: { section: "3.1.2.5", clause: "(a)", page: 9 },
  temporal: S13817_ORIGINAL_TEMPORAL,
  temporalAuthority: s13817Authority({ schedule: "Schedule A", section: "3.1.2.5", clause: "(a)", page: 18 }),
};

/** §3.1.2.5(b): all other buildings of a multiple dwelling — 11.5 m. */
export const FACT_HEIGHT_OTHER_MD: E85StructuredSourceFact = {
  factId: "r1-1-dim-008",
  family: "DIMENSIONAL",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Height",
  numericValue: 11.5,
  unit: "METRES",
  applicability: OTHER_MD_BUILDING_SCOPE,
  locator: { section: "3.1.2.5", clause: "(b)", page: 9 },
  temporal: S13817_ORIGINAL_TEMPORAL,
  temporalAuthority: s13817Authority({ schedule: "Schedule A", section: "3.1.2.5", clause: "(b)", page: 18 }),
};

/** §3.1.2.5(b): all other buildings of a multiple dwelling — 3 storeys. */
export const FACT_STOREYS_OTHER_MD: E85StructuredSourceFact = {
  factId: "r1-1-dim-009",
  family: "DIMENSIONAL",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Storeys",
  numericValue: 3,
  unit: "STOREYS",
  applicability: OTHER_MD_BUILDING_SCOPE,
  locator: { section: "3.1.2.5", clause: "(b)", page: 9 },
  temporal: S13817_ORIGINAL_TEMPORAL,
  temporalAuthority: s13817Authority({ schedule: "Schedule A", section: "3.1.2.5", clause: "(b)", page: 18 }),
};

/** §3.2.2.3: maximum building height 11.5 m for §3.2 uses. The storeys limit in the same row is withheld (see §3.2.2.10). */
export const FACT_HEIGHT_OTHER_USES: E85StructuredSourceFact = {
  factId: "r1-1-dim-010",
  family: "DIMENSIONAL",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Height",
  numericValue: 11.5,
  unit: "METRES",
  applicability: OTHER_USES_SCOPE,
  locator: { section: "3.2.2.3", page: 12 },
  temporal: S13817_ORIGINAL_TEMPORAL,
  temporalAuthority: s13817Authority({ schedule: "Schedule A", section: "3.2.2.3", page: 21 }),
};

/** §3.1.2.6: minimum front yard depth for §3.1 multiple dwellings. */
export const FACT_FRONT_YARD_MD: E85StructuredSourceFact = {
  factId: "r1-1-dim-011",
  family: "DIMENSIONAL",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Front Yard",
  numericValue: 4.9,
  unit: "METRES",
  applicability: MD_SCOPE,
  locator: { section: "3.1.2.6", page: 9 },
  temporal: S13817_ORIGINAL_TEMPORAL,
  temporalAuthority: s13817Authority({ schedule: "Schedule A", section: "3.1.2.6", page: 18 }),
};

/** §3.2.2.4: minimum front yard depth for §3.2 uses. */
export const FACT_FRONT_YARD_OTHER_USES: E85StructuredSourceFact = {
  factId: "r1-1-dim-012",
  family: "DIMENSIONAL",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Front Yard",
  numericValue: 4.9,
  unit: "METRES",
  applicability: OTHER_USES_SCOPE,
  locator: { section: "3.2.2.4", page: 12 },
  temporal: S13817_ORIGINAL_TEMPORAL,
  temporalAuthority: s13817Authority({ schedule: "Schedule A", section: "3.2.2.4", page: 21 }),
};

/** §3.2.2.7: maximum site coverage 50% for §3.2 uses. Stated as a percentage on purpose, so the PERCENT -> FRACTION policy is exercised. */
export const FACT_SITE_COVERAGE_OTHER_USES_PERCENT: E85StructuredSourceFact = {
  factId: "r1-1-dim-013",
  family: "DIMENSIONAL",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Site Coverage",
  numericValue: 50,
  unit: "PERCENT",
  applicability: OTHER_USES_SCOPE,
  locator: { section: "3.2.2.7", page: 12 },
  temporal: S13817_ORIGINAL_TEMPORAL,
  temporalAuthority: s13817Authority({ schedule: "Schedule A", section: "3.2.2.7", page: 21 }),
};

export const R1_1_FACTS: readonly E85StructuredSourceFact[] = [
  FACT_REQUIREMENT_SOCIAL_HOUSING,
  FACT_REQUIREMENT_CASH_IN_LIEU,
  FACT_OUTRIGHT_SINGLE_DETACHED_HOUSE,
  FACT_OUTRIGHT_DUPLEX,
  FACT_CONDITIONAL_DUPLEX_WITH_SUITE,
  FACT_CONDITIONAL_MULTIPLE_DWELLING,
  FACT_FSR_MULTIPLE_DWELLING,
  FACT_FSR_DUPLEX,
  FACT_FSR_OTHER_USES,
  FACT_UNITS_RENTAL,
  FACT_UNITS_OTHER_TENURE,
  FACT_HEIGHT_REAR_MD,
  FACT_STOREYS_REAR_MD,
  FACT_HEIGHT_OTHER_MD,
  FACT_STOREYS_OTHER_MD,
  FACT_HEIGHT_OTHER_USES,
  FACT_FRONT_YARD_MD,
  FACT_FRONT_YARD_OTHER_USES,
  FACT_SITE_COVERAGE_OTHER_USES_PERCENT,
];

/** Provisions known to exist and deliberately NOT structured, so their absence is an honest coverage gap rather than silence. */
export const R1_1_UNSTRUCTURED_SECTIONS: readonly string[] = [
  "3.1.1.4 — owner-occupied dwelling unit exception to 3.1.1.3(a) (not structured)",
  "3.2.2.10 — partial third storey for §3.2 uses (limits the §3.2.2.3 storey allowance, so §3.2 maximum storeys are withheld)",
  "2.2.1 — front-yard tree retention/planting for new Multiple Dwelling (and other new-construction uses); requires site/tree-inventory facts not represented in current E85 proposal context (not structured). §2.2.2 supplies supporting definitions (\"existing\"/\"planted\" tree) for this section ONLY [DEFINITION_SUPPORT_ONLY] and has no independent obligation of its own, so it is disclosed here rather than as its own separate coverage entry — one unstructured provision, not two.",
  "2.2.8 — bedroom-mix minimum unit-composition table by unit count and tenure; a genuine compliance obligation, but current E85RequirementCategory (AFFORDABLE_HOUSING only) does not honestly represent unit-composition requirements (not structured)",
  "2.2.9 — Director of Planning discretion to permit more than one principal building for Multiple Dwelling; a discretionary standard, not a caller-affirmable binary fact, so it does not fit requiredConditionIds (not structured)",
];

/** Retired fact ids. None may appear in the corrected fact set. */
export const R1_1_RETIRED_FACT_IDS: readonly string[] = ["r1-1-use-002", "r1-1-density-001", "r1-1-dim-001", "r1-1-dim-002", "r1-1-dim-003", "r1-1-dim-004", "r1-1-dim-005"];

/** Builds an extract, optionally overriding any field, so each test states exactly the one thing it is varying. */
export function r11Document(overrides: Partial<E85StructuredSourceDocument> = {}): E85StructuredSourceDocument {
  return {
    sourceId: VANCOUVER_R1_1_SOURCE_ID,
    jurisdictionId: VANCOUVER_JURISDICTION_ID,
    versionId: VANCOUVER_R1_1_VERSION_ID,
    zoneDesignation: VANCOUVER_R1_1_ZONE,
    facts: R1_1_FACTS,
    unstructuredSections: R1_1_UNSTRUCTURED_SECTIONS,
    extractedAt: EXTRACTED_AT,
    ...overrides,
  };
}

/** Recursively freezes an object so a test can prove the adapter never mutates its input — a write would throw in strict mode. */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

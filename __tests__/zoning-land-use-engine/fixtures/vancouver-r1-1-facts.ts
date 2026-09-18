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
 * All temporal authority remains UNKNOWN (Phase 12C).
 *
 * This file is not a test (jest matches `*.test.ts` only).
 */
import type { E85StructuredSourceDocument, E85StructuredSourceFact } from "../../../src/zoning-land-use-engine";
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

export const FACT_OUTRIGHT_SINGLE_DETACHED_HOUSE: E85StructuredSourceFact = {
  factId: "r1-1-use-001",
  family: "USE",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Outright Approval Use",
  sourceUseTerm: "Single Detached House",
  locator: { section: "2.1", table: USE_TABLE, row: "Single Detached House", page: 3 },
};

export const FACT_OUTRIGHT_DUPLEX: E85StructuredSourceFact = {
  factId: "r1-1-use-003",
  family: "USE",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Outright Approval Use",
  sourceUseTerm: DUPLEX_TERM,
  locator: { section: "2.1", table: USE_TABLE, row: DUPLEX_TERM, page: 2 },
};

export const FACT_CONDITIONAL_DUPLEX_WITH_SUITE: E85StructuredSourceFact = {
  factId: "r1-1-use-004",
  family: "USE",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Conditional Approval Use",
  sourceUseTerm: DUPLEX_WITH_SUITE_TERM,
  locator: { section: "2.1", table: USE_TABLE, row: DUPLEX_WITH_SUITE_TERM, page: 2 },
};

export const FACT_CONDITIONAL_MULTIPLE_DWELLING: E85StructuredSourceFact = {
  factId: "r1-1-use-005",
  family: "USE",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Conditional Approval Use",
  sourceUseTerm: MULTIPLE_DWELLING_TERM,
  applicability: {
    dwellingUnits: { max: 8 },
    locators: { dwellingUnits: { section: "2.1", table: USE_TABLE, row: MULTIPLE_DWELLING_TERM, page: 3 } },
  },
  locator: { section: "2.1", table: USE_TABLE, row: MULTIPLE_DWELLING_TERM, page: 3 },
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

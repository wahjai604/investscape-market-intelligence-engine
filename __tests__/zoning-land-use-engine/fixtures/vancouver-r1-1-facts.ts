/**
 * InvestScape™ E85 Phase 5 — curated Vancouver R1-1 test facts.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * SELF-CONTAINED AND OFFLINE. Nothing in this file reads a PDF, touches the
 * local pilot-evidence folder, or reaches the network. The values below are
 * the small subset of R1-1 provisions confirmed during the Phase 3B
 * primary-source review and already recorded as Phase 3B fixtures in
 * contracts.test.ts — FSR 1.00 (s. 3.1.1.2), height 11.5 m and 3 storeys
 * (s. 3.2.2.3), front yard 4.9 m (s. 3.2.2.4), site coverage 50 %
 * (s. 3.2.2.7), and the schedule's two approval paths (s. 2.1). They are
 * re-stated here as structured EXTRACTOR OUTPUT so the adapter has realistic
 * input; only short terminology labels, numbers and locators appear, never
 * regulatory prose.
 *
 * This file is not a test (jest matches `*.test.ts` only) and is imported by
 * the Phase 5 suites.
 */
import type { E85StructuredSourceDocument, E85StructuredSourceFact } from "../../../src/zoning-land-use-engine";
import { adapters } from "../../../src/zoning-land-use-engine";

const { VANCOUVER_R1_1_SOURCE_ID, VANCOUVER_R1_1_VERSION_ID, VANCOUVER_R1_1_ZONE, VANCOUVER_JURISDICTION_ID } = adapters.vancouver;

/** Fixed extraction timestamp — the adapter's only clock, which is what makes every Phase 5 test reproducible. */
export const EXTRACTED_AT = "2026-09-01T00:00:00.000Z";

/** The condition the schedule attaches to the lower height/storey figures. */
export const REAR_BUILDING_CONDITION = "building is a rear building";

export const FACT_OUTRIGHT_ONE_FAMILY: E85StructuredSourceFact = {
  factId: "r1-1-use-001",
  family: "USE",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Outright Approval Use",
  sourceUseTerm: "One-Family Dwelling",
  locator: { section: "2.1", table: "Outright Approval Uses", page: 1 },
};

export const FACT_CONDITIONAL_MULTIPLE_DWELLING: E85StructuredSourceFact = {
  factId: "r1-1-use-002",
  family: "USE",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Conditional Approval Use",
  sourceUseTerm: "Multiple Dwelling",
  locator: { section: "2.1", table: "Conditional Approval Uses", page: 1 },
};

export const FACT_FSR: E85StructuredSourceFact = {
  factId: "r1-1-density-001",
  family: "DENSITY",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Floor Space Ratio",
  numericValue: 1.0,
  unit: "RATIO",
  locator: { section: "3.1.1.2", page: 3 },
};

export const FACT_HEIGHT: E85StructuredSourceFact = {
  factId: "r1-1-dim-001",
  family: "DIMENSIONAL",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Height",
  numericValue: 11.5,
  unit: "METRES",
  locator: { section: "3.2.2.3", page: 4 },
};

export const FACT_STOREYS: E85StructuredSourceFact = {
  factId: "r1-1-dim-002",
  family: "DIMENSIONAL",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Storeys",
  numericValue: 3,
  unit: "STOREYS",
  locator: { section: "3.2.2.3", page: 4 },
};

export const FACT_FRONT_YARD: E85StructuredSourceFact = {
  factId: "r1-1-dim-003",
  family: "DIMENSIONAL",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Front Yard",
  numericValue: 4.9,
  unit: "METRES",
  locator: { section: "3.2.2.4", page: 4 },
};

/** Stated as a percentage on purpose, so the PERCENT -> FRACTION jurisdiction policy is exercised rather than assumed. */
export const FACT_SITE_COVERAGE_PERCENT: E85StructuredSourceFact = {
  factId: "r1-1-dim-004",
  family: "DIMENSIONAL",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Site Coverage",
  numericValue: 50,
  unit: "PERCENT",
  locator: { section: "3.2.2.7", page: 5 },
};

/** The condition-dependent height variant: lower figures apply to a rear building, and only the caller can know whether the proposal is one. */
export const FACT_HEIGHT_REAR_BUILDING: E85StructuredSourceFact = {
  factId: "r1-1-dim-005",
  family: "DIMENSIONAL",
  zoneDesignation: VANCOUVER_R1_1_ZONE,
  sourceTerm: "Height",
  numericValue: 8.5,
  unit: "METRES",
  condition: REAR_BUILDING_CONDITION,
  locator: { section: "3.2.2.3", page: 4 },
};

export const R1_1_FACTS: readonly E85StructuredSourceFact[] = [
  FACT_OUTRIGHT_ONE_FAMILY,
  FACT_CONDITIONAL_MULTIPLE_DWELLING,
  FACT_FSR,
  FACT_HEIGHT,
  FACT_STOREYS,
  FACT_FRONT_YARD,
  FACT_SITE_COVERAGE_PERCENT,
  FACT_HEIGHT_REAR_BUILDING,
];

/** Builds an extract, optionally overriding any field, so each test states exactly the one thing it is varying. */
export function r11Document(overrides: Partial<E85StructuredSourceDocument> = {}): E85StructuredSourceDocument {
  return {
    sourceId: VANCOUVER_R1_1_SOURCE_ID,
    jurisdictionId: VANCOUVER_JURISDICTION_ID,
    versionId: VANCOUVER_R1_1_VERSION_ID,
    zoneDesignation: VANCOUVER_R1_1_ZONE,
    facts: R1_1_FACTS,
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

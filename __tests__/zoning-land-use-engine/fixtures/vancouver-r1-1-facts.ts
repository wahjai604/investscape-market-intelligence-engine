/**
 * InvestScape™ E85 — Vancouver R1-1 test fixture.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * HOLDS NO FACTS. Every fact, qualification, condition id and unstructured
 * section is re-exported from the production legal pack
 * (src/zoning-land-use-engine/adapters/vancouver/legal-pack/r1-1-facts.ts), so
 * tests exercise the exact objects production ships and the two cannot
 * diverge. Only test-only helpers live here: a fixed extraction clock and a
 * document builder. `vancouver-legal-pack-packaging.test.ts` fails if a fact
 * literal is ever reintroduced in this file.
 *
 * This file is not a test (jest matches `*.test.ts` only).
 */
import type { E85StructuredSourceDocument } from "../../../src/zoning-land-use-engine";
import { adapters } from "../../../src/zoning-land-use-engine";
import { R1_1_FACTS, R1_1_UNSTRUCTURED_SECTIONS } from "../../../src/zoning-land-use-engine/adapters/vancouver/legal-pack/r1-1-facts";

export * from "../../../src/zoning-land-use-engine/adapters/vancouver/legal-pack/r1-1-facts";

const { VANCOUVER_R1_1_SOURCE_ID, VANCOUVER_R1_1_VERSION_ID, VANCOUVER_R1_1_ZONE, VANCOUVER_JURISDICTION_ID } = adapters.vancouver;

/** Fixed extraction timestamp — the adapter's only clock, which is what makes every Phase 5 test reproducible. */
export const EXTRACTED_AT = "2026-09-01T00:00:00.000Z";

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

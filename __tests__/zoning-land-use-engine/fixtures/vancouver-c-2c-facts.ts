/**
 * InvestScape™ E85 — Vancouver C-2C test fixture.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * HOLDS NO FACTS. Every fact, qualification, condition id and unstructured
 * section is re-exported from the production legal pack
 * (src/zoning-land-use-engine/adapters/vancouver/legal-pack/c-2c-facts.ts), so
 * tests exercise the exact objects production ships and the two cannot
 * diverge. Only test-only helpers live here: a fixed extraction clock and a
 * document builder. `vancouver-legal-pack-packaging.test.ts` fails if a fact
 * literal is ever reintroduced in this file.
 *
 * This file is not a test (jest matches `*.test.ts` only).
 */
import type { E85StructuredSourceDocument } from "../../../src/zoning-land-use-engine";
import { adapters } from "../../../src/zoning-land-use-engine";
import { C_2C_FACTS, C_2C_UNSTRUCTURED_SECTIONS } from "../../../src/zoning-land-use-engine/adapters/vancouver/legal-pack/c-2c-facts";

export * from "../../../src/zoning-land-use-engine/adapters/vancouver/legal-pack/c-2c-facts";

const { VANCOUVER_C_2C_SOURCE_ID, VANCOUVER_C_2C_VERSION_ID, VANCOUVER_C_2C_ZONE, VANCOUVER_JURISDICTION_ID } = adapters.vancouver;

/** Fixed extraction timestamp — the adapter's only clock. */
export const EXTRACTED_AT = "2026-09-19T00:00:00.000Z";

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

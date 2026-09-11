/**
 * InvestScape™ E68 Phase 8 — Schema Change Detection Contract.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Part 11 of the Phase 8 specification. Phase 7 adapters already fail safe
 * on unrecognized shapes (each `parse()` throws `SourceAdapterError`
 * "SCHEMA_CHANGED" — see fred-adapter.ts, statcan-adapter.ts,
 * census-adapter.ts). This file makes that behavior explicit and reusable:
 * a small declarative "expected shape" fingerprint each adapter can assert
 * against, so a field rename/reorder/type-change is caught in one place
 * rather than re-implemented ad hoc per adapter.
 *
 * This is intentionally lightweight (no schema library dependency) — a
 * fixed, deterministic shape-fingerprint comparison is sufficient to satisfy
 * "detect when a source changes its response structure" without adding a
 * runtime-validation framework the rest of the codebase does not use.
 */
import { SourceAdapterError } from "./types";

export type FieldType = "string" | "number" | "boolean" | "array" | "object";

/** Minimal shape descriptor: required top-level field names and their expected JS type. */
export type ExpectedShape = Readonly<Record<string, FieldType>>;

function actualType(value: unknown): FieldType | "undefined" | "null" {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean" || t === "object") return t;
  return "undefined";
}

/**
 * Throws `SourceAdapterError("SCHEMA_CHANGED", ...)` — never silently maps a
 * mismatched field — the moment a required field is missing or its type no
 * longer matches `expected`. Adapters call this before trusting a raw
 * payload's field values, so a `{city,value,period}` ->
 * `{market,benchmark,effectiveDate}` rename is caught immediately rather
 * than mis-mapping `market` as if it were `city`.
 */
export function assertShape(sourceId: string, record: unknown, expected: ExpectedShape): void {
  if (typeof record !== "object" || record === null) {
    throw new SourceAdapterError("SCHEMA_CHANGED", `${sourceId}: expected an object record, got ${actualType(record)}.`);
  }
  const obj = record as Record<string, unknown>;
  for (const [field, expectedType] of Object.entries(expected)) {
    const found = actualType(obj[field]);
    if (found !== expectedType) {
      throw new SourceAdapterError(
        "SCHEMA_CHANGED",
        `${sourceId}: expected field "${field}" to be ${expectedType}, found ${found}. ` +
          "The source's response structure appears to have changed; refusing to guess at a field mapping.",
      );
    }
  }
}

/** Convenience: true/false version of `assertShape` for callers that want to branch instead of catch. */
export function matchesShape(record: unknown, expected: ExpectedShape): boolean {
  try {
    assertShape("shape-check", record, expected);
    return true;
  } catch {
    return false;
  }
}

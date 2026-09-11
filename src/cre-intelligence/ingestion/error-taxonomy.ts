/**
 * InvestScape™ E68 Phase 8 — Structured Error Classification.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Part 10 of the Phase 8 specification. Reuses `SourceAdapterErrorCode`
 * (ingestion/types.ts), extended in Phase 8 with the additional categories
 * this part requires. This file adds the human-readable labels and the
 * "never silently loses data" contract: `classifyThrown` always returns a
 * structured error code, and `NEVER_SILENT_CODES` documents that every code
 * here corresponds to an explicit gap/event record, never a swallowed
 * exception.
 */
import { SourceAdapterError, type SourceAdapterErrorCode } from "./types";

export const ERROR_TAXONOMY_LABELS: Readonly<Record<SourceAdapterErrorCode, string>> = {
  NETWORK_ERROR: "The source could not be reached over the network.",
  RATE_LIMITED: "The source rejected the request due to rate limiting.",
  SCHEMA_CHANGED: "The source's response no longer matches the shape the adapter recognizes.",
  VALIDATION_FAILED: "A response was retrieved and parsed but failed E68 validation.",
  GEOGRAPHY_NOT_COVERED: "The source does not publish data for the requested geography.",
  NOT_FOUND: "The requested series/dataset/identifier does not exist at the source.",
  AUTHENTICATION_ERROR: "The request was rejected because credentials were missing or invalid.",
  AUTHORIZATION_ERROR: "The credentials were valid but lack permission for the requested resource.",
  SOURCE_UNAVAILABLE: "The source is currently unavailable (outage, maintenance, or persistent failure).",
  INVALID_RESPONSE: "The response was received but could not be parsed as valid data (e.g. malformed JSON).",
  LICENSE_RESTRICTION: "The data exists but its license terms prohibit this use without further review.",
  CONFIGURATION_ERROR: "The adapter is missing required configuration (e.g. an API key was never supplied).",
  EMPTY_RESULT: "The source responded successfully but returned zero records for the request.",
  UNKNOWN_ERROR: "An error occurred that does not match a more specific category.",
};

/**
 * Part 10 — every one of these codes is required to route to an explicit
 * `CREDataGap` and/or `CREIngestionEvent` record (see ingestion-events.ts),
 * never to a caught-and-discarded exception. This constant exists so a test
 * can assert exhaustiveness against `SourceAdapterErrorCode`.
 */
export const ALL_ERROR_CODES: readonly SourceAdapterErrorCode[] = Object.keys(ERROR_TAXONOMY_LABELS) as SourceAdapterErrorCode[];

/** Classify an arbitrary thrown value into a structured (code, message) pair, defaulting to UNKNOWN_ERROR rather than losing the failure silently. */
export function classifyThrown(err: unknown): { code: SourceAdapterErrorCode; message: string } {
  if (err instanceof SourceAdapterError) {
    return { code: err.code, message: err.message };
  }
  if (err instanceof Error) {
    return { code: "UNKNOWN_ERROR", message: err.message };
  }
  return { code: "UNKNOWN_ERROR", message: String(err) };
}

/** Errors that describe a fault in E68 talking to the source (retry may help), vs. a durable/data fault. */
export const TRANSIENT_ERROR_CODES: readonly SourceAdapterErrorCode[] = ["NETWORK_ERROR", "RATE_LIMITED", "SOURCE_UNAVAILABLE"];

export function isTransientError(code: SourceAdapterErrorCode): boolean {
  return TRANSIENT_ERROR_CODES.includes(code);
}

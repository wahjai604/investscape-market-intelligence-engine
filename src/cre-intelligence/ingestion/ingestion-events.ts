/**
 * InvestScape™ E68 Phase 8 — Ingestion Event Model.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Part 9 of the Phase 8 specification. An ingestion event records ONE
 * retrieval attempt against ONE source/adapter. It is diagnostic/operational
 * history, distinct from `CREDataGap` (which records a persistent absence of
 * data for a metric/geography). A single failed attempt may produce both: an
 * ingestion event (this file) AND, when appropriate, a `CREDataGap`.
 *
 * Security (Part 20): `CREIngestionEvent` has no field for credentials, API
 * keys, or secrets, and `redactDiagnostic` exists specifically to strip any
 * accidental leakage out of free-text diagnostic detail before it is stored.
 */
import type { SourceAdapterErrorCode } from "./types";

export type CREIngestionAttemptResult = "success" | "partial" | "failure";

export interface CREIngestionEvent {
  eventId: string;
  sourceId: string;
  adapterId: string;
  attemptedAt: string;
  result: CREIngestionAttemptResult;
  recordsRetrieved: number;
  recordsAccepted: number;
  recordsRejected: number;
  /** Set when `result` is "failure" or "partial". */
  errorCode?: SourceAdapterErrorCode;
  /** Human-readable, secret-free diagnostic detail. Run through `redactDiagnostic` before storing. */
  diagnosticDetail?: string;
  /** True when the failure was caused by a schema/shape change at the source (Part 11). */
  schemaChangeSuspected?: boolean;
  /** True when the failure was caused by a licensing restriction rather than a technical fault. */
  licenseRestrictionEncountered?: boolean;
}

export function buildIngestionEventId(sourceId: string, attemptedAt: string): string {
  return `${sourceId}::${attemptedAt}`;
}

/**
 * Part 9/20 — defensive redaction for free-text diagnostic messages before
 * they are persisted into an event. Adapters should never put a secret into
 * a message in the first place; this is a second line of defense, not a
 * license to be careless upstream.
 */
export function redactDiagnostic(message: string): string {
  return message
    .replace(/([?&](?:api_key|apikey|key|token|secret|password)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/\b(bearer\s+)[A-Za-z0-9._-]+/gi, "$1[REDACTED]");
}

export function recordIngestionEvent(input: {
  sourceId: string;
  adapterId: string;
  attemptedAt: string;
  result: CREIngestionAttemptResult;
  recordsRetrieved: number;
  recordsAccepted: number;
  recordsRejected: number;
  errorCode?: SourceAdapterErrorCode;
  diagnosticDetail?: string;
  schemaChangeSuspected?: boolean;
  licenseRestrictionEncountered?: boolean;
}): CREIngestionEvent {
  return {
    eventId: buildIngestionEventId(input.sourceId, input.attemptedAt),
    sourceId: input.sourceId,
    adapterId: input.adapterId,
    attemptedAt: input.attemptedAt,
    result: input.result,
    recordsRetrieved: input.recordsRetrieved,
    recordsAccepted: input.recordsAccepted,
    recordsRejected: input.recordsRejected,
    errorCode: input.errorCode,
    diagnosticDetail: input.diagnosticDetail ? redactDiagnostic(input.diagnosticDetail) : undefined,
    schemaChangeSuspected: input.schemaChangeSuspected,
    licenseRestrictionEncountered: input.licenseRestrictionEncountered,
  };
}

/** Part 9/17 guarantee: a failed/partial event must never be the ONLY record of an attempt that lost data — recordsRejected + recordsAccepted must account for recordsRetrieved. */
export function assertNoSilentDataLoss(event: CREIngestionEvent): void {
  if (event.recordsAccepted + event.recordsRejected !== event.recordsRetrieved) {
    throw new Error(
      `Ingestion event ${event.eventId} accounts for ${event.recordsAccepted + event.recordsRejected} of ` +
        `${event.recordsRetrieved} retrieved records — the remainder would be silently lost.`,
    );
  }
}

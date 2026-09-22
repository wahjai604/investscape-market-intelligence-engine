/**
 * InvestScape™ E86 Phase 7 — structured data-gap reason codes.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Part 11 of the Phase 7 specification: a human-readable `CREDataGap.reason`
 * string is necessary but not sufficient. Without a closed vocabulary,
 * "no data available" collapses eight structurally different situations into
 * one sentence, and a caller (or a future contributor) cannot tell "this
 * metric genuinely does not exist anywhere public" from "the API is down
 * today" or "a licensed source would answer this." This file gives each of
 * those situations its own code so calling code — and user-facing copy — can
 * be precise, e.g.:
 *
 *   "Commercial cap rate unavailable from public government sources for
 *    Miami, FL. Licensed CRE market source required."
 *
 * instead of a generic "No data available."
 *
 * The vocabulary itself (`CREDataGapReasonCode`) is defined in
 * `src/cre-intelligence/types.ts`, alongside `CREDataGap`, since it is
 * shared domain taxonomy rather than an ingestion-subsystem internal — this
 * module re-exports it so existing ingestion-local imports keep working,
 * and owns the runtime label map and message formatting below.
 */

export type { CREDataGapReasonCode } from "../types";
import type { CREDataGapReasonCode } from "../types";

export const CRE_DATA_GAP_REASON_LABELS: Readonly<Record<CREDataGapReasonCode, string>> = {
  METRIC_NOT_PUBLISHED: "This metric is not published by any public/government source E86 has checked.",
  GEOGRAPHY_NOT_COVERED: "The source publishes this metric, but not for the requested geography.",
  GRANULARITY_NOT_AVAILABLE: "The source publishes this metric only at a coarser geographic granularity than requested.",
  API_OR_DOWNLOAD_UNAVAILABLE: "A source is known to exist but has no public API or downloadable dataset.",
  LICENSE_REQUIRED: "This data exists but only under a paid license E86 has not obtained.",
  SOURCE_TEMPORARILY_UNAVAILABLE: "The source is normally available but could not be reached at retrieval time.",
  SCHEMA_CHANGED: "The source's published schema/format changed in a way E86's adapter does not recognize.",
  VALIDATION_FAILED: "A response was retrieved but failed validation and was discarded rather than stored.",
};

/**
 * Build the precise, non-generic user-facing message the Phase 7 spec asks
 * for. `licensedAlternativeHint` should name what WOULD answer the request
 * (e.g. "Licensed CRE market source required.") only when that is actually
 * true — never invented to sound helpful.
 */
export function formatDataGapMessage(input: {
  metricLabel: string;
  geographyLabel: string;
  reasonCode: CREDataGapReasonCode;
  licensedAlternativeHint?: string;
}): string {
  const base = `${input.metricLabel} unavailable from public government sources for ${input.geographyLabel}.`;
  const detail = CRE_DATA_GAP_REASON_LABELS[input.reasonCode];
  const hint = input.licensedAlternativeHint ? ` ${input.licensedAlternativeHint}` : "";
  return `${base} ${detail}${hint}`;
}

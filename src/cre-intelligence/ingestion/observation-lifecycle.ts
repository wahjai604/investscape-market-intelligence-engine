/**
 * InvestScape™ E68 Phase 8 — Observation Lifecycle, Fingerprinting & Freshness.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Parts 4, 5, 6, 7, 12, 13, 14, 16 of the Phase 8 specification.
 *
 * E68's existing `CREObservation` (types.ts) and `EconomicIndicatorObservation`
 * (ingestion/types.ts) are left untouched by this file: Phase 8 tracks
 * lifecycle/fingerprint/freshness metadata in a separate wrapper record keyed
 * to an observation, rather than mutating the observation shape that Phases
 * 1-7 and their tests already depend on. This is the "minimum necessary
 * metadata" approach flagged as acceptable in Part 13 of the spec, with the
 * remaining architectural requirement documented in
 * docs/E68-phase8-production-monitoring-refresh.md ("Known limitations").
 */
import type { CRECitation, CREGeography, CREObservation } from "../types";
import type { EconomicIndicatorObservation } from "./types";

/**
 * Part 4 — explicit observation lifecycle states.
 *
 *   retrieved  — fetched from the source, not yet validated.
 *   validated  — passed E68 validation/qualification; eligible to become current.
 *   active     — validated AND currently the best-known value for its period
 *                (no newer observation of the same identity has arrived).
 *   superseded — a newer observation for the SAME identity (see
 *                `observationFingerprint`) has since been retrieved; this
 *                record is kept, never deleted, and remains readable as
 *                history.
 *   archived   — retained purely for historical record (e.g. the source
 *                itself was retired); still queryable, never presented as
 *                current.
 *
 * Note: lifecycle status is about CURRENCY, not TRUTH. A `superseded` or
 * `archived` observation is not "wrong" — see Part 7 (STALE ≠ FALSE).
 */
export type CREObservationLifecycleStatus = "retrieved" | "validated" | "active" | "superseded" | "archived";

/** Part 16 — how an observation should be labeled to a consumer, distinct from lifecycle status. */
export type CREPresentationFreshness = "live_current" | "recent" | "historical" | "stale" | "unavailable";

/**
 * Part 4/13/14 — the record E68 keeps alongside a stored observation. This is
 * the identity + timeline metadata; the observation's own fields
 * (`CRECitation.publicationDate`, `periodStart`/`periodEnd`,
 * `CRECitation.retrievedAt`) remain the source of truth for the three dates —
 * this record never restates them differently, only references them.
 */
export interface CREObservationLifecycleRecord {
  /** See `observationFingerprint`. Identity is NEVER retrieval timestamp. */
  fingerprint: string;
  sourceId: string;
  status: CREObservationLifecycleStatus;
  /** ISO timestamp this lifecycle record itself was first created. */
  firstRetrievedAt: string;
  /** ISO timestamp of the most recent retrieval that matched this fingerprint. */
  lastSeenAt: string;
  /** Set when `status` becomes "superseded": the fingerprint of the record that replaced it. */
  supersededByFingerprint?: string;
  /**
   * Part 13 — correction provenance. When a source publishes a corrected
   * figure for the same effective period, the ORIGINAL observation is marked
   * superseded (never mutated or deleted) and this field on the ORIGINAL
   * points forward to the corrected fingerprint, distinguishing an honest
   * source correction from an ordinary new-period observation.
   */
  correction?: {
    correctedByFingerprint: string;
    reason: string;
    detectedAt: string;
  };
  /** Part 14 — source-reported version/vintage of the dataset/report, when the source exposes one. */
  sourceVersion?: string;
}

/**
 * Part 12 — duplicate-protection identity. Deliberately built ONLY from
 * fields that describe WHAT was published (source, metric/indicator,
 * geography, effective period, and — critically — the source's own
 * publication date), never from `retrievedAt`. Retrieving the same published
 * figure twice (Sept 10 and Sept 20) must yield the identical fingerprint.
 *
 * A change in the published VALUE for the same identity is a correction
 * (Part 13), not a new identity — callers detect that by comparing the
 * incoming value/citation against the existing record for the same
 * fingerprint, not by minting a new fingerprint.
 */
export function observationFingerprint(input: {
  sourceId: string;
  /** `CREMetric` or an `EconomicIndicatorObservation.indicatorId` — whatever names WHAT is being measured. */
  metricOrIndicatorId: string;
  geography: CREGeography;
  periodStart: string;
  periodEnd: string;
  /** The source's OWN publication date for this figure (CRECitation.publicationDate), not retrievedAt. */
  publicationDate: string;
}): string {
  const geo = [input.geography.country, input.geography.region, input.geography.metro, input.geography.city, input.geography.submarket]
    .map((part) => (part ?? "").trim().toLowerCase())
    .join("|");
  return [input.sourceId, input.metricOrIndicatorId, geo, input.periodStart, input.periodEnd, input.publicationDate]
    .map((part) => part.trim().toLowerCase())
    .join("::");
}

export function fingerprintOfObservation(obs: CREObservation): string | undefined {
  if (!obs.citation) return undefined;
  return observationFingerprint({
    sourceId: obs.source.sourceId,
    metricOrIndicatorId: obs.metric,
    geography: obs.geography,
    periodStart: obs.periodStart,
    periodEnd: obs.periodEnd,
    publicationDate: obs.citation.publicationDate,
  });
}

export function fingerprintOfEconomicObservation(obs: EconomicIndicatorObservation): string {
  return observationFingerprint({
    sourceId: obs.sourceId,
    metricOrIndicatorId: obs.indicatorId,
    geography: obs.geography,
    periodStart: obs.periodStart,
    periodEnd: obs.periodEnd,
    publicationDate: obs.citation.publicationDate,
  });
}

/**
 * Part 5 — strict date-role validation. Catches exactly the proven Phase 4C
 * failure mode (a publication date transcribed as/confused with a retrieval
 * or effective-period date) plus the inverse (retrieval date substituted for
 * publication date, effective period confused with publication date).
 *
 * Deliberately conservative: this validates ORDERING and DISTINCTNESS
 * relationships that must always hold, not calendar plausibility beyond
 * that (a report can legitimately be published the same day an interval
 * closes, so equality is allowed only where explicitly noted).
 */
export function assertDateRoleIntegrity(input: {
  publicationDate: string;
  periodStart: string;
  periodEnd: string;
  retrievedAt: string;
}): void {
  const pub = Date.parse(input.publicationDate);
  const start = Date.parse(input.periodStart);
  const end = Date.parse(input.periodEnd);
  const retrieved = Date.parse(input.retrievedAt);

  for (const [label, value] of Object.entries({ publicationDate: pub, periodStart: start, periodEnd: end, retrievedAt: retrieved })) {
    if (Number.isNaN(value)) {
      throw new Error(`Invalid ${label}: "${(input as Record<string, string>)[label]}" is not a parseable date.`);
    }
  }
  if (end < start) {
    throw new Error(`Invalid effective period: periodEnd (${input.periodEnd}) precedes periodStart (${input.periodStart}).`);
  }
  // A publisher cannot publish a figure before the period it describes has started, except
  // same-day publication of a period that also starts that day (e.g. a daily rate series).
  if (pub < start && input.publicationDate !== input.periodStart) {
    throw new Error(
      `Publication date (${input.publicationDate}) precedes the effective period start (${input.periodStart}) — ` +
        "check whether periodStart/publicationDate were swapped or confused.",
    );
  }
  // Retrieval can never precede publication: E68 cannot retrieve a figure before it exists.
  if (retrieved < pub) {
    throw new Error(
      `Retrieval date (${input.retrievedAt}) precedes publication date (${input.publicationDate}) — ` +
        "check whether retrievedAt and publicationDate were swapped.",
    );
  }
}

export function assertCitationDateRoleIntegrity(citation: CRECitation): void {
  assertDateRoleIntegrity({
    publicationDate: citation.publicationDate,
    // CRECitation.period is a free-text label, not a machine period; role integrity for the
    // period axis is checked at the CREObservation/EconomicIndicatorObservation level instead
    // via `assertObservationDateRoleIntegrity` below, which has periodStart/periodEnd.
    periodStart: citation.publicationDate,
    periodEnd: citation.publicationDate,
    retrievedAt: citation.retrievedAt,
  });
}

export function assertObservationDateRoleIntegrity(obs: Pick<CREObservation, "periodStart" | "periodEnd" | "citation">): void {
  if (!obs.citation) return; // pre-citation legacy observations are out of scope for this check.
  assertDateRoleIntegrity({
    publicationDate: obs.citation.publicationDate,
    periodStart: obs.periodStart,
    periodEnd: obs.periodEnd,
    retrievedAt: obs.citation.retrievedAt,
  });
}

export function assertEconomicObservationDateRoleIntegrity(obs: EconomicIndicatorObservation): void {
  assertDateRoleIntegrity({
    publicationDate: obs.citation.publicationDate,
    periodStart: obs.periodStart,
    periodEnd: obs.periodEnd,
    retrievedAt: obs.citation.retrievedAt,
  });
}

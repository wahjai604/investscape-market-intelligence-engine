/**
 * InvestScape™ E86 Phase 8 — Source Lifecycle & Refresh Metadata.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Part 3/8/18 of the Phase 8 specification. A source's health status is
 * operational metadata about the SOURCE (can we currently retrieve from it,
 * is its schema still recognized, is licensing settled) — it must NEVER be
 * used to invalidate observations already retrieved and validated. See
 * `docs/E86-phase8-production-monitoring-refresh.md` "Source lifecycle".
 *
 * Non-goal: this module does not implement a scheduler, cron, or any network
 * I/O. It defines the contract a future scheduler would read/write.
 */
import type { CREGeography } from "../types";

/**
 * Part 3 lifecycle states, reusing existing vocabulary where E86 already had
 * it (e.g. `CREDataGapReasonCode`'s SOURCE_TEMPORARILY_UNAVAILABLE /
 * SCHEMA_CHANGED / LICENSE_REQUIRED map onto TEMPORARILY_UNAVAILABLE /
 * SCHEMA_CHANGED / LICENSE_REVIEW below).
 *
 *   ACTIVE                 — last attempt succeeded within its expected cadence.
 *   DEGRADED                — reachable but producing partial/suspect results
 *                             (e.g. some records rejected, elevated error rate).
 *   TEMPORARILY_UNAVAILABLE — could not be reached at last attempt; expected
 *                             to recover without code changes.
 *   SCHEMA_CHANGED          — the source's response shape no longer matches
 *                             what the adapter recognizes; requires an adapter
 *                             code change, not just a retry.
 *   LICENSE_REVIEW          — legal/licensing terms are unresolved
 *                             (`legallyIncorporable: null` in the public
 *                             source registry) or have changed unfavorably.
 *   REQUIRES_CONFIGURATION  — missing/invalid credentials, API key, or other
 *                             required configuration; not a network fault.
 *   RETIRED                 — E86 has deliberately stopped using this source
 *                             (deprecated dataset, source shut down, etc.).
 */
export type CRESourceHealthStatus =
  | "ACTIVE"
  | "DEGRADED"
  | "TEMPORARILY_UNAVAILABLE"
  | "SCHEMA_CHANGED"
  | "LICENSE_REVIEW"
  | "REQUIRES_CONFIGURATION"
  | "RETIRED";

/**
 * Part 6 cadence vocabulary. Deliberately does NOT include a numeric "days
 * until stale" default — that would be inventing a universal freshness
 * period the spec forbids. `unknown` and `irregular` are first-class, honest
 * values, not fallbacks to hide behind.
 */
export type CRERefreshCadence =
  | "realtime"
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "annual"
  | "irregular"
  | "unknown";

/**
 * Part 8 — refresh scheduling metadata for one source. This is STATE (what
 * actually happened / is currently true), distinct from the static
 * descriptive metadata already in `CRESourceDefinition` / `CREPublicSourceProfile`.
 * A future scheduler reads/writes this record; nothing here executes on a
 * timer.
 */
export interface CRESourceRefreshState {
  sourceId: string;
  cadence: CRERefreshCadence;
  /** ISO date of the last retrieval attempt that produced usable data. */
  lastSuccessfulRetrievalAt?: string;
  /** ISO date of the most recent retrieval attempt, success or failure. */
  lastAttemptedRetrievalAt?: string;
  /**
   * ISO date the next refresh is expected, when `cadence` supports a
   * projection. Left undefined for `irregular`/`unknown` cadence — never
   * fabricated.
   */
  nextExpectedRefreshAt?: string;
  sourceUrl: string;
  adapterId?: string;
  authRequirement: "none" | "free_api_key" | "registration_required" | "paid_credentials" | "unknown";
  configurationRequired: boolean;
  historicalBackfillCapable: boolean | "unknown";
  health: CRESourceHealthStatus;
  /** Free-text detail for the current health status (never a secret/credential). */
  healthNote?: string;
  /** ISO date this refresh-state record itself was last updated. */
  updatedAt: string;
}

export function createInitialRefreshState(input: {
  sourceId: string;
  cadence: CRERefreshCadence;
  sourceUrl: string;
  adapterId?: string;
  authRequirement: CRESourceRefreshState["authRequirement"];
  configurationRequired: boolean;
  historicalBackfillCapable: boolean | "unknown";
  asOf: string;
}): CRESourceRefreshState {
  return {
    sourceId: input.sourceId,
    cadence: input.cadence,
    sourceUrl: input.sourceUrl,
    adapterId: input.adapterId,
    authRequirement: input.authRequirement,
    configurationRequired: input.configurationRequired,
    historicalBackfillCapable: input.historicalBackfillCapable,
    health: "ACTIVE",
    updatedAt: input.asOf,
  };
}

/**
 * Part 3 — apply the result of one retrieval attempt to a source's refresh
 * state. Deliberately pure/functional (returns a new object) so callers can
 * decide how/where to persist it; no I/O happens here.
 *
 * Crucially: this function only ever changes `CRESourceRefreshState` fields.
 * It never touches, deletes, or reaches into any previously stored
 * `CREObservation` — that is the Part 3 non-invalidation guarantee.
 */
export function recordRetrievalAttempt(
  state: CRESourceRefreshState,
  outcome: { success: boolean; health: CRESourceHealthStatus; note?: string; attemptedAt: string },
): CRESourceRefreshState {
  return {
    ...state,
    lastAttemptedRetrievalAt: outcome.attemptedAt,
    lastSuccessfulRetrievalAt: outcome.success ? outcome.attemptedAt : state.lastSuccessfulRetrievalAt,
    health: outcome.health,
    healthNote: outcome.note,
    updatedAt: outcome.attemptedAt,
  };
}

/** Whether a source's current health should block NEW retrieval attempts (it never blocks reading past observations). */
export function isSourceUsableForNewRetrieval(health: CRESourceHealthStatus): boolean {
  return health === "ACTIVE" || health === "DEGRADED";
}

export interface CREGeographyScopedRefreshState extends CRESourceRefreshState {
  geography?: CREGeography;
}

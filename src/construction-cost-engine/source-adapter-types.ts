/**
 * InvestScape™ E88 Phase 6 — Source Adapter Architecture: core types.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * E88 is a read-only consumer of E86 (src/cre-intelligence/), frozen at
 * v1.0, and does not modify E87 (src/cap-rate-engine/). Every E86 import
 * below is a plain named type import. Nothing in this file performs
 * normalization, comparability scoring, escalation, or benchmark
 * aggregation — those remain Phase 2/4/5's exclusive responsibility. This
 * file exists purely to represent, for any current or future construction-
 * cost source, five DISTINCT concerns the task explicitly requires E88 to
 * keep separate:
 *
 *   1. source registration      — "we know this source exists"
 *   2. source access readiness  — "can E88 actually reach/read it right now"
 *   3. licensing/redistribution — "what are we allowed to do with what we read"
 *   4. source adapter           — "how do we translate it into E88's shape"
 *   5. analytical usability     — "can it actually enter a benchmark today"
 *
 * Registering a source (1) never implies access (2). Access (2) never
 * implies redistribution rights (3). A source adapter (4) exists even for a
 * source with zero usable observations. Analytical readiness (5) is
 * DERIVED, deterministically, from (2)+(3) — never asserted independently,
 * so it can never silently drift out of sync with the access/licensing
 * facts that justify it (see `computeAnalyticalReadiness` below).
 */
import type { CRECitedObservation } from "../cre-intelligence/types";

/**
 * The metrics a source COULD plausibly contribute, per its own published
 * scope — never a claim that E88 has ingested observations for all of them.
 * Reuses E86's `CREMetric` vocabulary verbatim (no new metric vocabulary is
 * invented here).
 */
export type E88SourceMetricScope = "hard_cost" | "soft_cost" | "construction_index" | "construction_cost_change";

/**
 * Whether E88 can currently REACH this source's data at all. Deliberately
 * distinct from licensing: a source can be perfectly accessible (a public
 * PDF, a free government API) while still being licensing-restricted for
 * redistribution, and a source can be fully licensed while still being
 * technically inaccessible (no ingestion pipeline built yet, an API
 * temporarily down, etc.).
 */
export type E88SourceAccessStatus =
  | "AVAILABLE"
  | "REGISTERED"
  | "LICENSE_REQUIRED"
  | "ACCESS_NOT_VERIFIED"
  | "DEFERRED"
  | "UNAVAILABLE";

/**
 * What E88 is legally/contractually permitted to do with what it reads.
 * Deliberately distinct from access: "PUBLIC_REUSE" says nothing about
 * whether E88 has actually been able to reach the source yet.
 */
export type E88SourceLicenseStatus =
  | "PUBLIC_REUSE"
  | "INTERNAL_LICENSE_REQUIRED"
  | "REDISTRIBUTION_RESTRICTED"
  | "LICENSE_UNKNOWN"
  | "NOT_APPLICABLE";

/**
 * Whether a source can currently contribute to an E88 benchmark at all, and
 * if so, with what restriction. ALWAYS derived by `computeAnalyticalReadiness`
 * from accessStatus + licenseStatus — never set as an independent, hand-
 * authored field on a source definition, so it cannot drift out of sync
 * with the facts that justify it.
 */
export type E88AnalyticalReadiness = "READY" | "READY_WITH_RESTRICTIONS" | "NOT_READY";

/**
 * The visibility/redistribution model for a source's output. This directly
 * answers the task's three-way distinction: internal analytical use (A),
 * user-visible raw output (B), and derived benchmark output (C) — each
 * tracked independently, never inferred from "the source is available."
 */
export interface E88RedistributionPolicy {
  /** May a raw source observation (a $/SF figure, a report table row) ever be shown to an end user verbatim? */
  rawObservationVisibility: "VISIBLE" | "RESTRICTED" | "NOT_APPLICABLE";
  /** May a benchmark DERIVED FROM this source (e.g. a Phase 5 aggregated range) be shown to an end user? */
  derivedOutputVisibility: "VISIBLE" | "RESTRICTED" | "NOT_APPLICABLE";
  /** Whether raw redistribution of this source's data (not merely internal use) is permitted. */
  redistributionAllowed: boolean;
  attributionRequired: boolean;
  /** A citable reference to the license/terms this policy is based on, when one exists. */
  licenseReference?: string;
  /** Free-text: the actual basis for this policy — never a legal conclusion, only a documented project finding (Section: this is not legal advice). */
  note: string;
}

/**
 * Full identity + status metadata for one construction-cost-relevant source.
 * `sourceId` matches E86 `CRESource.sourceId` where the source already has
 * one (e.g. "rlb-north-america") so provenance ties back cleanly; a source
 * with no E86 registry entry yet (there are none as of Phase 6) would still
 * need one before contributing any real observation.
 */
export interface E88SourceDefinition {
  sourceId: string;
  publisher: string;
  productName: string;
  version?: string;
  publicationDate?: string;
  geographyScope: string;
  buildingTypeScope: string;
  metricScope: readonly E88SourceMetricScope[];
  accessStatus: E88SourceAccessStatus;
  licenseStatus: E88SourceLicenseStatus;
  redistribution: E88RedistributionPolicy;
  /**
   * Whether E88 has actually ingested any observation from this source at
   * all, independent of whether it COULD (readiness). Registering a source
   * and having real data for it are different facts — this field is the
   * one that keeps them from being conflated (task Section 12: "Registered
   * does not equal available").
   */
  ingested: boolean;
  statusNote: string;
}

/**
 * Deterministic, pure derivation of analytical readiness from access +
 * license status. NEVER hand-authored on a definition — recomputed every
 * time so it cannot silently drift from the facts that justify it.
 *
 * Rule: only an ACCESS_STATUS of "AVAILABLE" can ever yield something other
 * than NOT_READY (an inaccessible source cannot be analytically ready no
 * matter how permissive its license is). Given availability:
 *   - PUBLIC_REUSE / NOT_APPLICABLE  -> READY
 *   - REDISTRIBUTION_RESTRICTED / INTERNAL_LICENSE_REQUIRED / LICENSE_UNKNOWN -> READY_WITH_RESTRICTIONS
 *     (usable for internal analysis and derived benchmark output; raw
 *     redistribution is a separate, more restrictive question answered by
 *     `E88RedistributionPolicy`, never inferred from readiness alone)
 */
export function computeAnalyticalReadiness(definition: Pick<E88SourceDefinition, "accessStatus" | "licenseStatus">): E88AnalyticalReadiness {
  if (definition.accessStatus !== "AVAILABLE") return "NOT_READY";
  if (definition.licenseStatus === "PUBLIC_REUSE" || definition.licenseStatus === "NOT_APPLICABLE") return "READY";
  return "READY_WITH_RESTRICTIONS";
}

/**
 * One source-specific observation, wrapped for traceability back to the
 * adapter/source that produced it. `observation` is a real E86
 * `CRECitedObservation` — an envelope never carries a fabricated or
 * partially-filled observation; if a source cannot honestly produce one,
 * the adapter returns no envelope for it at all (see `E88SourceAdapter`).
 */
export interface E88SourceObservationEnvelope {
  sourceId: string;
  observation: CRECitedObservation;
  /** Why this observation is being surfaced through this adapter, and any source-specific interpretation notes (e.g. a unit/table caveat) — never a place to hide an assumption silently. */
  adapterNote: string;
}

/**
 * A source-specific translator: raw/source-specific representation -> E88's
 * existing `CRECitedObservation` shape. An adapter NEVER performs
 * normalization (normalize.ts), comparability scoring (comparability.ts),
 * escalation (escalation.ts), or benchmark aggregation (benchmark.ts) — its
 * only job is producing (or refusing to produce) observation envelopes.
 *
 * `listObservations()` MUST return an empty array whenever the source is
 * not `ingested` or its `computeAnalyticalReadiness` result is `NOT_READY`
 * — an adapter can never bypass access/licensing status to surface data
 * anyway. See `adapters/` for the concrete per-source implementations,
 * every one of which enforces this via the shared `gatedObservations` helper
 * rather than duplicating the check.
 */
export interface E88SourceAdapter {
  definition: E88SourceDefinition;
  listObservations(): readonly E88SourceObservationEnvelope[];
}

/**
 * Shared gating helper every concrete adapter uses, so "not ingested" and
 * "not ready" are enforced in exactly one place rather than re-implemented
 * (and potentially inconsistently re-implemented) per adapter.
 */
export function gatedObservations(
  definition: E88SourceDefinition,
  supplier: () => readonly E88SourceObservationEnvelope[],
): readonly E88SourceObservationEnvelope[] {
  if (!definition.ingested) return [];
  if (computeAnalyticalReadiness(definition) === "NOT_READY") return [];
  return supplier();
}

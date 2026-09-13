/**
 * InvestScape™ E86 Phase 8 — Monitoring / Health Summary.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Part 15 of the Phase 8 specification: a typed, machine-readable health
 * summary future application code can consume directly (not merely a doc).
 * Pure functions over caller-supplied arrays — this module holds no state
 * and performs no I/O or scheduling.
 */
import type { CREDataGap } from "../types";
import type { CRESourceHealthStatus, CRESourceRefreshState } from "./source-health";
import type { CREObservationLifecycleRecord, CREObservationLifecycleStatus } from "./observation-lifecycle";
import type { CREIngestionEvent } from "./ingestion-events";

export interface CREMonitoringSummary {
  generatedAt: string;
  sources: {
    total: number;
    byHealth: Record<CRESourceHealthStatus, number>;
  };
  observations: {
    total: number;
    byLifecycleStatus: Record<CREObservationLifecycleStatus, number>;
  };
  ingestion: {
    /** Window the counts below cover; caller decides (e.g. "last 20 events" or "since ISO date"). */
    windowDescription: string;
    successCount: number;
    partialCount: number;
    failureCount: number;
    schemaChangeSuspectedCount: number;
    licenseRestrictionCount: number;
  };
  dataGaps: {
    total: number;
    byReasonCode: Record<string, number>;
  };
}

const EMPTY_HEALTH_COUNTS: Record<CRESourceHealthStatus, number> = {
  ACTIVE: 0,
  DEGRADED: 0,
  TEMPORARILY_UNAVAILABLE: 0,
  SCHEMA_CHANGED: 0,
  LICENSE_REVIEW: 0,
  REQUIRES_CONFIGURATION: 0,
  RETIRED: 0,
};

const EMPTY_LIFECYCLE_COUNTS: Record<CREObservationLifecycleStatus, number> = {
  retrieved: 0,
  validated: 0,
  active: 0,
  superseded: 0,
  archived: 0,
};

export function buildMonitoringSummary(input: {
  generatedAt: string;
  sourceStates: readonly CRESourceRefreshState[];
  observationLifecycles: readonly CREObservationLifecycleRecord[];
  ingestionEvents: readonly CREIngestionEvent[];
  ingestionWindowDescription: string;
  dataGaps: readonly CREDataGap[];
}): CREMonitoringSummary {
  const byHealth = { ...EMPTY_HEALTH_COUNTS };
  for (const s of input.sourceStates) byHealth[s.health]++;

  const byLifecycleStatus = { ...EMPTY_LIFECYCLE_COUNTS };
  for (const o of input.observationLifecycles) byLifecycleStatus[o.status]++;

  let successCount = 0;
  let partialCount = 0;
  let failureCount = 0;
  let schemaChangeSuspectedCount = 0;
  let licenseRestrictionCount = 0;
  for (const e of input.ingestionEvents) {
    if (e.result === "success") successCount++;
    else if (e.result === "partial") partialCount++;
    else failureCount++;
    if (e.schemaChangeSuspected) schemaChangeSuspectedCount++;
    if (e.licenseRestrictionEncountered) licenseRestrictionCount++;
  }

  const byReasonCode: Record<string, number> = {};
  for (const g of input.dataGaps) {
    const key = g.reasonCode ?? "UNCODED";
    byReasonCode[key] = (byReasonCode[key] ?? 0) + 1;
  }

  return {
    generatedAt: input.generatedAt,
    sources: { total: input.sourceStates.length, byHealth },
    observations: { total: input.observationLifecycles.length, byLifecycleStatus },
    ingestion: {
      windowDescription: input.ingestionWindowDescription,
      successCount,
      partialCount,
      failureCount,
      schemaChangeSuspectedCount,
      licenseRestrictionCount,
    },
    dataGaps: { total: input.dataGaps.length, byReasonCode },
  };
}

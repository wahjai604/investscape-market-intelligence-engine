/**
 * InvestScape™ E88 Phase 6 — Source-Level DATA_GAP.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * A distinct, E88-owned gap shape answering a different question than
 * Phase 2's `ConstructionCostDataGap` (gap-types.ts — "why doesn't any
 * evidence in the POOL satisfy this request") or Phase 5's
 * `ConstructionCostBenchmarkDataGap` (benchmark-types.ts — the unified
 * output-level gap): "why can THIS SPECIFIC SOURCE not currently
 * contribute to this request at all, independent of what's in any pool."
 * Useful for a caller asking "why is RSMeans not helping here" without
 * needing to run a full benchmark evaluation first.
 *
 * Does NOT modify E86's `CREDataGap` and is not wired automatically into
 * Phase 5's `benchmark.ts` (per the task's explicit instruction not to
 * modify Phase 1-5 logic to accommodate Phase 6) — it is a standalone,
 * additive explanation utility.
 */
import type { CREAssetClass, CREGeography } from "../cre-intelligence/types";
import { computeAnalyticalReadiness, type E88SourceDefinition, type E88SourceMetricScope } from "./source-adapter-types";
import type { CanonicalConstructionSubtype } from "./taxonomy";

export interface SourceGapRequest {
  metric: E88SourceMetricScope;
  geography: CREGeography;
  assetClass: CREAssetClass;
  canonicalSubtype?: CanonicalConstructionSubtype;
}

export interface SourceAdapterDataGap {
  sourceId: string;
  publisher: string;
  request: SourceGapRequest;
  accessStatus: E88SourceDefinition["accessStatus"];
  licenseStatus: E88SourceDefinition["licenseStatus"];
  reason: string;
  resolutionHint?: string;
  checkedAt: string;
}

/**
 * Explain why a specific source cannot currently contribute to a request,
 * or `undefined` if it genuinely can (ingested, ready, and its metricScope
 * covers the requested metric — this function does NOT check whether the
 * source actually HAS a matching geography/subtype observation; that
 * remains Phase 2/5's job). Never fabricates a value; only ever explains an
 * absence.
 */
export function explainSourceUnavailability(definition: E88SourceDefinition, request: SourceGapRequest, checkedAt: string): SourceAdapterDataGap | undefined {
  const readiness = computeAnalyticalReadiness(definition);

  if (!definition.metricScope.includes(request.metric)) {
    return buildGap(definition, request, `"${definition.publisher}" does not publish "${request.metric}" observations at all, per its documented metric scope (${definition.metricScope.join(", ") || "none"}).`, checkedAt);
  }

  if (!definition.ingested) {
    return buildGap(
      definition,
      request,
      `"${definition.publisher}" is registered in E88's source registry but no observation has been ingested from it yet — this is an ingestion-layer task (Phase 7+), not necessarily a licensing block.`,
      checkedAt,
      readiness === "NOT_READY" ? "Resolving the underlying access/licensing status would be required before any ingestion could begin." : "Building an ingestion adapter for this already-ready source would resolve this gap.",
    );
  }

  if (readiness === "NOT_READY") {
    return buildGap(
      definition,
      request,
      `"${definition.publisher}" has access status "${definition.accessStatus}" and license status "${definition.licenseStatus}", which together are not analytically ready — no observation from this source may be used.`,
      checkedAt,
      "A resolved license review and/or verified access would be required to change this status.",
    );
  }

  return undefined;
}

function buildGap(definition: E88SourceDefinition, request: SourceGapRequest, reason: string, checkedAt: string, resolutionHint?: string): SourceAdapterDataGap {
  return {
    sourceId: definition.sourceId,
    publisher: definition.publisher,
    request,
    accessStatus: definition.accessStatus,
    licenseStatus: definition.licenseStatus,
    reason,
    resolutionHint,
    checkedAt,
  };
}

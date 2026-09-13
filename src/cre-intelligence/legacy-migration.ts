/**
 * InvestScape™ E86 Phase 5 — legacy benchmark protection (Part 10).
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * No legacy `CAP_RATE_BENCHMARKS` / `DEV_BUILDING_SUBTYPES` object exists
 * anywhere in this workspace (re-confirmed this phase — see
 * docs/E86-phase5-application-integration.md, Part 1). This file therefore
 * cannot migrate real data; it defines the audit function the WeWeb/frontend
 * repository should run against its own constants once E86 is wired in
 * there, so an unverified number never gets treated as if E86 produced it.
 */
import type { LegacyBenchmarkAudit, LegacyClassification } from "./benchmark-types";

export interface LegacyBenchmarkEntry {
  key: string;
  value: unknown;
  /** Where the legacy team says this number came from, if anywhere. */
  source?: string;
  /** Whether an E86 observation has been positively matched to this key. */
  hasE86Mapping: boolean;
}

/**
 * `nullify: true` means the caller's application architecture wants
 * unverifiable legacy fields cleared outright; `nullify: false` (default)
 * keeps the value but forces the `LEGACY_UNVERIFIED` classification so a UI
 * can render it with a visible "unverified" flag instead of silently trusting
 * it. Either way, no legacy value is ever returned relabeled as E86-sourced.
 */
export function auditLegacyBenchmark(entry: LegacyBenchmarkEntry, options: { nullify?: boolean } = {}): LegacyBenchmarkAudit {
  const hasSource = Boolean(entry.source && entry.source.trim().length > 0);
  const hasValidMapping = entry.hasE86Mapping;

  if (hasSource && hasValidMapping) {
    return {
      legacyValue: entry.value,
      hasSource,
      hasValidMapping,
      classification: "LEGACY_UNVERIFIED",
      reason: "Has both a stated source and a matched E86 observation, but has not itself been re-derived through E86's qualification pipeline — retained as unverified, not promoted to E86-sourced automatically.",
    };
  }

  const classification: LegacyClassification = options.nullify ? "NULL" : "LEGACY_UNVERIFIED";
  const reasonParts: string[] = [];
  if (!hasSource) reasonParts.push("no recorded source");
  if (!hasValidMapping) reasonParts.push("no matching E86 observation");

  return {
    legacyValue: options.nullify ? null : entry.value,
    hasSource,
    hasValidMapping,
    classification,
    reason: `${reasonParts.join(" and ")} — this value must not be presented as E86-sourced.`,
  };
}

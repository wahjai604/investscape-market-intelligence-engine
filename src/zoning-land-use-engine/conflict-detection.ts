/**
 * InvestScape™ E85 Phase 4 — Rule Normalization & Deterministic Evaluation:
 * generic conflict detection over deduplicated evidence.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Operates strictly AFTER duplicate-evidence removal (rule-identity.ts), so
 * a repeated copy of the same fact from the same source/section/date never
 * registers as a second, conflicting opinion. What remains distinct after
 * dedup is either genuine independent corroboration (same value, different
 * source) or a genuine conflict (different value) — this module only
 * decides which, using a caller-supplied value-equality function so it stays
 * generic across use-permission objects, plain numbers, etc.
 */
import type { E85Evidence } from "./evidence-types";
import { dedupeEvidence } from "./rule-identity";

export interface E85ConflictCheckResult<T> {
  /** True when 2+ distinct (post-dedup) values remain for the same applicable scope. */
  hasConflict: boolean;
  /** The distinct values found, in canonical (first-seen after identity-key sort upstream) order. */
  distinctValues: readonly T[];
  /** The deduplicated evidence items underlying `distinctValues` (order-preserving). */
  deduped: readonly E85Evidence<T>[];
}

export function detectConflict<T>(items: readonly E85Evidence<T>[], sameValue: (a: T, b: T) => boolean): E85ConflictCheckResult<T> {
  const deduped = dedupeEvidence(items);
  const distinct: T[] = [];
  for (const item of deduped) {
    if (!distinct.some((v) => sameValue(v, item.value))) distinct.push(item.value);
  }
  return { hasConflict: distinct.length > 1, distinctValues: distinct, deduped };
}

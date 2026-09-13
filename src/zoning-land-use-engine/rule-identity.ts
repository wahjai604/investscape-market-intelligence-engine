/**
 * InvestScape™ E85 Phase 4 — Rule Normalization & Deterministic Evaluation:
 * evidence identity & duplicate detection.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * DUPLICATE-EVIDENCE IDENTITY STRATEGY (documented explicitly per the Phase 4
 * task brief): two `E85Evidence<T>` items are treated as equivalent
 * duplicates of the SAME underlying fact if and only if they share:
 *   1. the same `value` (deep-equal),
 *   2. the same provenance identity — `sourceId` PLUS an equivalent
 *      `documentLocator` (deep-equal, or both absent) AND an equivalent
 *      `gisLocator` (deep-equal, or both absent), and
 *   3. an equal temporal window (`effectiveFrom`, `effectiveTo`,
 *      `effectiveDateBasis` all equal).
 *
 * This mirrors the known E88 defect (duplicate observations in
 * src/construction-cost-engine wrongly inflating confidence) that this phase
 * is explicitly instructed not to repeat: deduping happens BEFORE
 * qualification aggregation and BEFORE conflict detection, so a record
 * fetched twice from the same source/section/date never (a) boosts
 * qualification, (b) is mistaken for independent corroboration, or (c)
 * trips a false CONFLICTING_AUTHORITATIVE_SOURCES finding.
 *
 * Evidence with the SAME value but DIFFERENT provenance or temporal window
 * is NOT deduplicated here — it may still be genuine independent
 * corroboration, or a distinct conditional/alternate rule; that
 * determination belongs to the family-specific evaluators and
 * conflict-detection.ts, never to this identity layer.
 */
import type { E85Evidence } from "./evidence-types";

/** Deterministic, order-independent stable serialization used only to build comparison keys. Never persisted, never shown to a user. */
function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/** The deterministic identity key for one evidence item, per the strategy documented above. */
export function evidenceIdentityKey<T>(evidence: E85Evidence<T>): string {
  return stableStringify({
    value: evidence.value,
    sourceId: evidence.provenance.sourceId,
    documentLocator: evidence.provenance.documentLocator ?? null,
    gisLocator: evidence.provenance.gisLocator ?? null,
    effectiveFrom: evidence.temporal.effectiveFrom ?? null,
    effectiveTo: evidence.temporal.effectiveTo ?? null,
    effectiveDateBasis: evidence.temporal.effectiveDateBasis,
  });
}

/**
 * Removes exact-identity duplicates, preserving the first occurrence and
 * input order for everything else (order independence of the RESULT is
 * guaranteed by evaluators sorting/floor-combining afterward, not by this
 * function, which is order-preserving by design so callers can trace back
 * to "the first copy encountered" deterministically when order is itself
 * canonicalized upstream, e.g. by identity key, by the caller).
 */
export function dedupeEvidence<T>(items: readonly E85Evidence<T>[]): E85Evidence<T>[] {
  const seen = new Set<string>();
  const out: E85Evidence<T>[] = [];
  for (const item of items) {
    const key = evidenceIdentityKey(item);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

/** Sorts evidence by identity key so downstream logic is independent of input array order. Pure; does not mutate input. */
export function canonicalOrder<T>(items: readonly E85Evidence<T>[]): E85Evidence<T>[] {
  return [...items].sort((a, b) => evidenceIdentityKey(a).localeCompare(evidenceIdentityKey(b)));
}

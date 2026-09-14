/**
 * InvestScape™ E85 Phase 9 — Decision Orchestration: rule-pack resolution.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Phase 7 hands over IDENTITIES. This turns them into the packs the caller
 * actually holds, and the entire design is in what it refuses to do when it
 * cannot.
 *
 * A pack identity that resolves to nothing is the most dangerous shape in the
 * whole pipeline, because the obvious repairs all produce a confident-looking
 * answer: drop the id and the instrument silently stops governing; substitute an
 * empty pack and the instrument governs nothing, which is a legal claim nobody
 * made; take the nearest id and E85 cites an instrument the source never named.
 * So an unresolved identity is REPORTED and carried forward as itself.
 *
 * Matching is exact. No prefix, no case folding, no role fallback, no
 * first-pack-wins.
 */
import type { E85RulePack } from "./composition-types";
import type { E85RulePackResolution } from "./decision-package-types";
import { byE85DecisionKey } from "./decision-package-types";

/**
 * Whether two packs supplied under one id are the same pack.
 *
 * Structural comparison over a canonical key ordering, so two objects built in
 * different field orders still compare equal. This decides only whether a
 * repeat is a COPY; it never decides which of two differing packs is right,
 * because nothing here has standing to.
 */
function packsAreIdentical(a: E85RulePack, b: E85RulePack): boolean {
  return canonicalJson(a) === canonicalJson(b);
}

/** Stable JSON: object keys sorted at every depth, arrays left in their own order (which is meaningful). */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([x], [y]) => byE85DecisionKey(x, y));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

/**
 * Resolves the pack identities Phase 7 named against the packs a caller supplied.
 *
 * Pure, order-independent and offline. `availableRulePacks` is a caller-held
 * collection, never a registry this function goes and consults.
 */
export function resolveE85RulePacks(applicableRulePackIds: readonly string[], availableRulePacks: readonly E85RulePack[]): E85RulePackResolution {
  // Group the supplied packs by id WITHOUT letting position decide anything.
  const supplied = new Map<string, E85RulePack[]>();
  for (const pack of availableRulePacks) {
    const existing = supplied.get(pack.packId);
    if (existing === undefined) supplied.set(pack.packId, [pack]);
    else existing.push(pack);
  }

  const resolved: E85RulePack[] = [];
  const unresolvedPackIds: string[] = [];
  const conflictingPackIds: string[] = [];
  const collapsedDuplicatePackIds: string[] = [];

  // Deduplicate the requested ids themselves: Phase 7 already sorts and dedupes,
  // but a caller may hand this function a list from elsewhere.
  const wanted = [...new Set(applicableRulePackIds)].sort(byE85DecisionKey);

  for (const packId of wanted) {
    const candidates = supplied.get(packId);

    if (candidates === undefined || candidates.length === 0) {
      // The instrument is named and its rules are not in hand. Both halves of
      // that sentence survive into the package.
      unresolvedPackIds.push(packId);
      continue;
    }

    if (candidates.length === 1) {
      resolved.push(candidates[0]);
      continue;
    }

    // More than one pack claims this id.
    const allIdentical = candidates.every((c) => packsAreIdentical(c, candidates[0]));
    if (allIdentical) {
      // A repeated copy is not a second authority. Count it once and say so.
      collapsedDuplicatePackIds.push(packId);
      resolved.push(candidates[0]);
      continue;
    }

    // Materially different packs under one identity. Choosing either would make
    // the regulatory answer depend on the caller's array order, so neither is
    // chosen and the id resolves to nothing.
    conflictingPackIds.push(packId);
  }

  return {
    resolved: resolved.sort((a, b) => byE85DecisionKey(a.packId, b.packId)),
    unresolvedPackIds: unresolvedPackIds.sort(byE85DecisionKey),
    conflictingPackIds: conflictingPackIds.sort(byE85DecisionKey),
    collapsedDuplicatePackIds: collapsedDuplicatePackIds.sort(byE85DecisionKey),
  };
}

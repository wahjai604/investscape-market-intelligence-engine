/**
 * InvestScape™ E85 Phase 5 — Source Adapter & Registry Foundation: adapter
 * resolution.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Resolution is by EXACT metadata match on jurisdiction, source, version and
 * zone. There is deliberately no fuzzy municipality matching, no nearest
 * match, no parent-zone widening, and no fallback from one municipality to
 * another — a Surrey extract must never be normalized by Vancouver's adapter,
 * and an "unknown" municipality must never quietly become the one municipality
 * that happens to be implemented. When nothing matches, the answer is an
 * explicit unsupported result carrying a real DATA_GAP.
 *
 * When MORE than one adapter matches, that is also a failure
 * (`AMBIGUOUS_ADAPTER_MATCH`) rather than a first-wins pick, which is what
 * makes resolution independent of registration order: two registries holding
 * the same adapters in different orders always produce the same answer,
 * including the same failure.
 */
import type { E85SourceAdapter, E85AdapterUnsupportedReason, E85NormalizationResult, E85NormalizationOptions } from "./source-adapter-contract";
import { unsupportedReasonToGap } from "./source-adapter-contract";
import type { E85StructuredSourceDocument } from "./source-fact-types";
import type { E85SourceRegistry } from "./source-registry";
import type { E85DataGap } from "./data-gap-types";

export interface E85AdapterRegistryProblem {
  code: "DUPLICATE_ADAPTER_ID";
  adapterId: string;
  detail: string;
}

export interface E85AdapterResolutionCriteria {
  jurisdictionId: string;
  sourceId: string;
  versionId: string;
  zoneDesignation: string;
}

export type E85AdapterResolution =
  | { resolved: true; adapter: E85SourceAdapter }
  | { resolved: false; reason: E85AdapterUnsupportedReason; detail: string; gap: E85DataGap };

export interface E85AdapterRegistry {
  /** All adapters in deterministic `adapterId` order, regardless of registration order. */
  list(): readonly E85SourceAdapter[];
  get(adapterId: string): E85SourceAdapter | undefined;
  /** Exact-match resolution. `checkedAt` is caller-supplied so the returned gap record is deterministic. */
  resolve(criteria: E85AdapterResolutionCriteria, checkedAt: string): E85AdapterResolution;
}

export type E85AdapterRegistryResult = { ok: true; registry: E85AdapterRegistry } | { ok: false; problems: readonly E85AdapterRegistryProblem[] };

/**
 * Explains why one specific adapter did not match, in most-general-first order
 * so the reported reason is the outermost thing that is wrong: a Surrey
 * extract offered to Vancouver's R1-1 adapter reports a jurisdiction problem,
 * not a zone problem.
 */
function whyNotMatched(adapter: E85SourceAdapter, criteria: E85AdapterResolutionCriteria): E85AdapterUnsupportedReason | undefined {
  const id = adapter.identity;
  if (id.jurisdictionId !== criteria.jurisdictionId) return "JURISDICTION_NOT_SUPPORTED";
  if (!id.supportedSourceIds.includes(criteria.sourceId)) return "SOURCE_NOT_SUPPORTED";
  if (!id.supportedZoneDesignations.includes(criteria.zoneDesignation)) return "ZONE_NOT_SUPPORTED";
  if (!id.supportedVersionIds.includes(criteria.versionId)) return "VERSION_NOT_SUPPORTED";
  return undefined;
}

/**
 * Picks the single most informative failure across every registered adapter.
 * An adapter that matched jurisdiction+source+zone but not version tells the
 * caller something far more actionable ("this consolidation is not verified")
 * than the dozen adapters that failed on jurisdiction, so the deepest failure
 * wins.
 */
const REASON_SPECIFICITY: readonly E85AdapterUnsupportedReason[] = ["JURISDICTION_NOT_SUPPORTED", "SOURCE_NOT_SUPPORTED", "ZONE_NOT_SUPPORTED", "VERSION_NOT_SUPPORTED"];

export function createE85AdapterRegistry(adapters: readonly E85SourceAdapter[]): E85AdapterRegistryResult {
  const problems: E85AdapterRegistryProblem[] = [];
  const counts = new Map<string, number>();
  for (const a of adapters) {
    const n = (counts.get(a.identity.adapterId) ?? 0) + 1;
    counts.set(a.identity.adapterId, n);
    if (n === 2) {
      problems.push({
        code: "DUPLICATE_ADAPTER_ID",
        adapterId: a.identity.adapterId,
        detail: `Adapter id "${a.identity.adapterId}" is registered more than once; which one normalized a value would depend on registration order.`,
      });
    }
  }
  if (problems.length > 0) return { ok: false, problems };

  const sorted = [...adapters].sort((a, b) => (a.identity.adapterId < b.identity.adapterId ? -1 : a.identity.adapterId > b.identity.adapterId ? 1 : 0));
  const index = new Map<string, E85SourceAdapter>(sorted.map((a) => [a.identity.adapterId, a]));

  const registry: E85AdapterRegistry = {
    list: () => sorted,
    get: (adapterId) => index.get(adapterId),
    resolve: (criteria, checkedAt) => {
      const matches = sorted.filter((a) => whyNotMatched(a, criteria) === undefined);

      if (matches.length === 1) return { resolved: true, adapter: matches[0] };

      if (matches.length > 1) {
        const detail =
          `${matches.length} adapters claim ${criteria.jurisdictionId}/${criteria.sourceId}@${criteria.versionId} zone ${criteria.zoneDesignation} ` +
          `(${matches.map((m) => m.identity.adapterId).join(", ")}). Resolution is refused rather than picking one, since either choice would depend on registration order.`;
        return { resolved: false, reason: "AMBIGUOUS_ADAPTER_MATCH", detail, gap: unsupportedReasonToGap("AMBIGUOUS_ADAPTER_MATCH", detail, [criteria.sourceId], checkedAt) };
      }

      if (sorted.length === 0) {
        const detail = `No adapters are registered at all, so ${criteria.jurisdictionId}/${criteria.sourceId} cannot be normalized.`;
        return { resolved: false, reason: "NO_ADAPTER_REGISTERED", detail, gap: unsupportedReasonToGap("NO_ADAPTER_REGISTERED", detail, [criteria.sourceId], checkedAt) };
      }

      const reasons = sorted.map((a) => whyNotMatched(a, criteria)).filter((r): r is E85AdapterUnsupportedReason => r !== undefined);
      let deepest: E85AdapterUnsupportedReason = "JURISDICTION_NOT_SUPPORTED";
      for (const r of reasons) {
        if (REASON_SPECIFICITY.indexOf(r) > REASON_SPECIFICITY.indexOf(deepest)) deepest = r;
      }
      const reason: E85AdapterUnsupportedReason = reasons.length === 0 ? "NO_ADAPTER_REGISTERED" : deepest;
      // A zone-scope failure gets its own sentence, because it is the one most
      // easily misread as a statement about the world: the caller named a zone,
      // so the zoning is not in doubt — only E85's coverage of it is.
      const zoneNote =
        reason === "ZONE_NOT_SUPPORTED"
          ? ` Zone "${criteria.zoneDesignation}" is named by the extract and is not in doubt; this is an absence of structured rules, not an absence of zoning.`
          : "";
      const detail =
        `No registered adapter handles ${criteria.jurisdictionId}/${criteria.sourceId}@${criteria.versionId} zone ${criteria.zoneDesignation}. ` +
        `Closest failure across ${sorted.length} registered adapter(s): ${reason}. No fallback to another jurisdiction's adapter is performed. ` +
        `This reports what E85 can normalize, never whether the zone or document exists.${zoneNote}`;
      return { resolved: false, reason, detail, gap: unsupportedReasonToGap(reason, detail, [criteria.sourceId], checkedAt) };
    },
  };

  return { ok: true, registry };
}

/**
 * The Phase 5 public entry point: resolve the source, resolve the adapter,
 * normalize. Pure, offline, and deterministic given a deterministic extract.
 *
 * Every failure on the way is an ordinary typed result — an unregistered
 * source, a jurisdiction the extract and registry disagree about, no adapter,
 * an ambiguous adapter — and each carries a real Phase 3 `E85DataGap` so the
 * caller reports it the same way as any other unanswerable question.
 */
export function normalizeSourceDocument(
  document: E85StructuredSourceDocument,
  sourceRegistry: E85SourceRegistry,
  adapterRegistry: E85AdapterRegistry,
  options?: E85NormalizationOptions,
): E85NormalizationResult {
  const checkedAt = options?.normalizedAt ?? document.extractedAt;

  const source = sourceRegistry.get(document.sourceId);
  if (!source) {
    const detail = `Source "${document.sourceId}" is not registered in the E85 source registry; no rules are normalized from an unregistered document.`;
    return { outcome: "UNSUPPORTED", reason: "SOURCE_NOT_SUPPORTED", detail, gap: unsupportedReasonToGap("SOURCE_NOT_SUPPORTED", detail, [document.sourceId], checkedAt) };
  }

  if (source.jurisdictionId !== document.jurisdictionId) {
    const detail =
      `The extract claims jurisdiction "${document.jurisdictionId}" but source "${document.sourceId}" is registered to "${source.jurisdictionId}". ` +
      `The contradiction is reported rather than resolved by preferring either.`;
    return { outcome: "UNSUPPORTED", reason: "JURISDICTION_MISMATCH", detail, gap: unsupportedReasonToGap("JURISDICTION_MISMATCH", detail, [document.sourceId], checkedAt) };
  }

  const resolution = adapterRegistry.resolve(
    { jurisdictionId: document.jurisdictionId, sourceId: document.sourceId, versionId: document.versionId, zoneDesignation: document.zoneDesignation },
    checkedAt,
  );
  if (!resolution.resolved) {
    return { outcome: "UNSUPPORTED", reason: resolution.reason, detail: resolution.detail, gap: resolution.gap };
  }

  const decision = resolution.adapter.canHandle(document, source);
  if (!decision.supported) {
    return { outcome: "UNSUPPORTED", reason: decision.reason, detail: decision.detail, gap: unsupportedReasonToGap(decision.reason, decision.detail, [document.sourceId], checkedAt) };
  }

  return resolution.adapter.normalize(document, source, options);
}

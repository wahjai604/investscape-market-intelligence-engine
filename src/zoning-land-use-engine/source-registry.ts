/**
 * InvestScape™ E85 Phase 5 — Source Adapter & Registry Foundation: the
 * generic source registry.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * A pure in-memory lookup over `E85SourceDefinition` records. No network, no
 * filesystem, no database. Lookup is EXACT on `sourceId` — there is no fuzzy
 * matching, no nearest-jurisdiction fallback, and no default source, because
 * every one of those behaviours would let a caller silently receive rules from
 * a document that does not govern their parcel.
 *
 * Construction is fallible and returns a typed result rather than throwing
 * (Phase 5 §22): a duplicate `sourceId` in a registry definition is a
 * detectable, reportable condition, and callers assembling registries from
 * several modules deserve a structured answer rather than an exception.
 */
import type { E85SourceDefinition } from "./source-registry-types";
import { isValidE85SourceId } from "./source-registry-types";
import type { E85RuleFamily } from "./rule-family-types";

export type E85SourceRegistryProblemCode =
  /** Two or more definitions share one `sourceId`. */
  | "DUPLICATE_SOURCE_ID"
  /** A definition's `sourceId` does not conform to the stable-identity convention. */
  | "MALFORMED_SOURCE_ID"
  /** A definition lists no versions, so nothing could ever be matched against it. */
  | "NO_VERSIONS_REGISTERED";

export interface E85SourceRegistryProblem {
  code: E85SourceRegistryProblemCode;
  sourceId: string;
  detail: string;
}

export interface E85SourceRegistry {
  /** Exact-match lookup. Returns undefined for an unknown id — never a nearest match. */
  get(sourceId: string): E85SourceDefinition | undefined;
  has(sourceId: string): boolean;
  /** All registered sources in deterministic `sourceId` order, regardless of registration order. */
  list(): readonly E85SourceDefinition[];
  /** Sources governing exactly this jurisdiction, in deterministic order. Exact string match only. */
  listForJurisdiction(jurisdictionId: string): readonly E85SourceDefinition[];
  /** Sources governing exactly this jurisdiction AND covering exactly this zone designation. A source with no `supportedZoneDesignations` is NOT zone-scoped and is excluded here rather than assumed to cover every zone. */
  listForJurisdictionZone(jurisdictionId: string, zoneDesignation: string): readonly E85SourceDefinition[];
  /** Sources governing this jurisdiction that state the given rule family. */
  listForRuleFamily(jurisdictionId: string, family: E85RuleFamily): readonly E85SourceDefinition[];
}

export type E85SourceRegistryResult =
  | { ok: true; registry: E85SourceRegistry }
  | { ok: false; problems: readonly E85SourceRegistryProblem[] };

function bySourceId(a: E85SourceDefinition, b: E85SourceDefinition): number {
  return a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0;
}

/**
 * Validates and builds a registry. Every problem found is reported at once
 * rather than failing on the first — a caller fixing a registry wants the
 * whole list.
 *
 * The input array is never mutated; the registry holds its own sorted copy.
 */
export function createE85SourceRegistry(definitions: readonly E85SourceDefinition[]): E85SourceRegistryResult {
  const problems: E85SourceRegistryProblem[] = [];
  const seen = new Map<string, number>();

  for (const def of definitions) {
    if (!isValidE85SourceId(def.sourceId)) {
      problems.push({
        code: "MALFORMED_SOURCE_ID",
        sourceId: def.sourceId,
        detail: `"${def.sourceId}" is not a stable colon-separated source identity. A filesystem path, URL, or free-form label must not be used as a source id.`,
      });
    }
    if (def.versions.length === 0) {
      problems.push({
        code: "NO_VERSIONS_REGISTERED",
        sourceId: def.sourceId,
        detail: `Source "${def.sourceId}" registers no versions, so no structured extract could ever be matched to a known consolidation.`,
      });
    }
    const count = (seen.get(def.sourceId) ?? 0) + 1;
    seen.set(def.sourceId, count);
    if (count === 2) {
      problems.push({
        code: "DUPLICATE_SOURCE_ID",
        sourceId: def.sourceId,
        detail: `Source id "${def.sourceId}" is registered more than once. Source identity must be unique; silently keeping one of the two would make which document governs depend on registration order.`,
      });
    }
  }

  if (problems.length > 0) return { ok: false, problems };

  const sorted = [...definitions].sort(bySourceId);
  const index = new Map<string, E85SourceDefinition>(sorted.map((d) => [d.sourceId, d]));

  const registry: E85SourceRegistry = {
    get: (sourceId) => index.get(sourceId),
    has: (sourceId) => index.has(sourceId),
    list: () => sorted,
    listForJurisdiction: (jurisdictionId) => sorted.filter((d) => d.jurisdictionId === jurisdictionId),
    listForJurisdictionZone: (jurisdictionId, zoneDesignation) =>
      sorted.filter((d) => d.jurisdictionId === jurisdictionId && (d.supportedZoneDesignations ?? []).includes(zoneDesignation)),
    listForRuleFamily: (jurisdictionId, family) => sorted.filter((d) => d.jurisdictionId === jurisdictionId && d.supportedRuleFamilies.includes(family)),
  };

  return { ok: true, registry };
}

/**
 * InvestScape™ E85 Phase 7 — Spatial Applicability: dataset registry.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * A lookup table over registered spatial datasets and their releases, and
 * nothing more. It resolves EXACTLY or not at all: no nearest-version fallback,
 * no newest-version-wins, no partial id matching. A feature claiming to come
 * from a release E85 has not registered is reported as such and excluded from
 * applicability, because the alternative — comparing it against whatever
 * release happens to be on hand — produces an answer about a map nobody
 * published.
 *
 * Deliberately much smaller than the Phase 5 source registry. Registering a
 * regulatory document involves adapters, structure support and rule-family
 * coverage; registering a layer involves none of those, and copying that
 * machinery across would imply a symmetry that does not exist.
 *
 * No network behaviour, no filesystem access, no clock.
 */
import type { E85SpatialDatasetDefinition, E85SpatialDatasetVersion } from "./spatial-dataset-types";
import { isValidE85SpatialDatasetId } from "./spatial-dataset-types";

export type E85SpatialRegistryProblemCode =
  /** Two definitions claim the same `datasetId`; which one applied would otherwise depend on registration order. */
  | "DUPLICATE_DATASET_ID"
  /** A `datasetId` does not match the required stable-slug form. */
  | "MALFORMED_DATASET_ID"
  /** One dataset lists the same `versionId` twice, making an exact version lookup ambiguous. */
  | "DUPLICATE_DATASET_VERSION"
  /** A dataset declares no versions at all, so no feature can ever be attributed to a release of it. */
  | "NO_REGISTERED_VERSIONS";

export interface E85SpatialRegistryProblem {
  code: E85SpatialRegistryProblemCode;
  datasetId: string;
  detail: string;
}

export interface E85SpatialDatasetRegistry {
  /** Datasets that passed validation, sorted by id for deterministic iteration. */
  datasets(): readonly E85SpatialDatasetDefinition[];
  find(datasetId: string): E85SpatialDatasetDefinition | undefined;
  /** Exact release lookup. Returns undefined for an unregistered version rather than substituting another. */
  findVersion(datasetId: string, versionId: string): E85SpatialDatasetVersion | undefined;
  problems(): readonly E85SpatialRegistryProblem[];
}

/**
 * Builds a registry, reporting structural problems as data instead of throwing.
 *
 * A malformed registration is a defect worth surfacing loudly, but throwing
 * here would mean one bad entry prevents every other dataset from being usable
 * — the wrong trade when the caller may well be assembling registrations from
 * several places.
 */
export function createE85SpatialDatasetRegistry(definitions: readonly E85SpatialDatasetDefinition[]): E85SpatialDatasetRegistry {
  const problems: E85SpatialRegistryProblem[] = [];
  const byId = new Map<string, E85SpatialDatasetDefinition>();

  for (const definition of definitions) {
    if (!isValidE85SpatialDatasetId(definition.datasetId)) {
      problems.push({
        code: "MALFORMED_DATASET_ID",
        datasetId: definition.datasetId,
        detail: `"${definition.datasetId}" is not a valid dataset id. Expected lower-case colon-separated slugs, e.g. "xx-yy-somewhere:zoning-districts".`,
      });
      continue;
    }
    if (byId.has(definition.datasetId)) {
      problems.push({
        code: "DUPLICATE_DATASET_ID",
        datasetId: definition.datasetId,
        detail: `More than one definition registers dataset "${definition.datasetId}". Neither is used, because which one applied would depend on registration order.`,
      });
      byId.delete(definition.datasetId);
      continue;
    }

    const seenVersions = new Set<string>();
    let versionConflict = false;
    for (const version of definition.versions) {
      if (seenVersions.has(version.versionId)) {
        versionConflict = true;
        problems.push({
          code: "DUPLICATE_DATASET_VERSION",
          datasetId: definition.datasetId,
          detail: `Dataset "${definition.datasetId}" registers version "${version.versionId}" more than once, so an exact version lookup cannot be resolved.`,
        });
      }
      seenVersions.add(version.versionId);
    }
    if (versionConflict) continue;

    if (definition.versions.length === 0) {
      problems.push({
        code: "NO_REGISTERED_VERSIONS",
        datasetId: definition.datasetId,
        detail: `Dataset "${definition.datasetId}" registers no versions, so no feature can be attributed to a release of it.`,
      });
      continue;
    }

    byId.set(definition.datasetId, definition);
  }

  const sorted = [...byId.values()].sort((a, b) => (a.datasetId < b.datasetId ? -1 : a.datasetId > b.datasetId ? 1 : 0));
  const sortedProblems = [...problems].sort((a, b) => (a.datasetId < b.datasetId ? -1 : a.datasetId > b.datasetId ? 1 : a.code < b.code ? -1 : a.code > b.code ? 1 : 0));

  return {
    datasets: () => sorted,
    find: (datasetId) => byId.get(datasetId),
    findVersion: (datasetId, versionId) => byId.get(datasetId)?.versions.find((v) => v.versionId === versionId),
    problems: () => sortedProblems,
  };
}

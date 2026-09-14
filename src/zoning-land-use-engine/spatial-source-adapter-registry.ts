/**
 * InvestScape™ E85 Phase 8 — Spatial Source Adapter: resolution and the
 * snapshot-level gate.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Resolution is by EXACT metadata match on jurisdiction, dataset, release and
 * payload shape. There is deliberately no fuzzy municipality matching, no
 * nearest release, no parent-dataset widening, and no fallback from one
 * municipality to another — a neighbouring city's layer must never be read by
 * this city's adapter, and an unrecognised jurisdiction must never quietly
 * become the one jurisdiction that happens to be implemented.
 *
 * When MORE than one adapter matches, that is a failure rather than a
 * first-wins pick. That is what makes resolution independent of registration
 * order: two registries holding the same adapters in different orders always
 * produce the same answer, including the same failure.
 *
 * THE TWO LEVELS OF FAILURE, SEPARATED HERE STRUCTURALLY. Everything this file
 * checks is a fact about the WHOLE payload — an unregistered dataset, a release
 * nobody registered, an unstated CRS, a contradicted CRS, no adapter. Any one
 * of them is true of every record at once and there is nothing to salvage, so
 * the snapshot is refused entire. Facts about INDIVIDUAL records — a missing
 * id, a tangled polygon, an unmapped zone code — are the adapter's business and
 * cost only that record. One bad polygon out of forty thousand must never cost
 * a caller the other 39,999.
 */
import type { E85SpatialDatasetRegistry } from "./spatial-dataset-registry";
import type { E85RawSpatialSourceSnapshot } from "./spatial-source-snapshot-types";
import type { E85SpatialSourceFinding } from "./spatial-source-findings";
import type {
  E85SpatialAdapterUnsupportedReason,
  E85SpatialNormalizationOptions,
  E85SpatialNormalizationResult,
  E85SpatialSourceAdapter,
  E85SpatialSourceReadiness,
} from "./spatial-source-adapter-contract";
import { byE85SpatialKey, resolveE85SpatialNormalizedAt, spatialUnsupportedReasonToGap, unreadySpatialSource } from "./spatial-source-adapter-contract";
import { e85CrsMatches } from "./spatial-types";
import type { E85DataGap } from "./data-gap-types";

export interface E85SpatialAdapterRegistryProblem {
  code: "DUPLICATE_SPATIAL_ADAPTER_ID";
  adapterId: string;
  detail: string;
}

export interface E85SpatialAdapterResolutionCriteria {
  jurisdictionId: string;
  datasetId: string;
  datasetVersionId: string;
  sourceSystem: E85RawSpatialSourceSnapshot["sourceSystem"];
}

export type E85SpatialAdapterResolution =
  | { resolved: true; adapter: E85SpatialSourceAdapter }
  | { resolved: false; reason: E85SpatialAdapterUnsupportedReason; detail: string; gap: E85DataGap };

export interface E85SpatialAdapterRegistry {
  /** All adapters in deterministic `adapterId` order, regardless of registration order. */
  list(): readonly E85SpatialSourceAdapter[];
  get(adapterId: string): E85SpatialSourceAdapter | undefined;
  /** Exact-match resolution. `checkedAt` is caller-supplied so the returned gap record is deterministic. */
  resolve(criteria: E85SpatialAdapterResolutionCriteria, checkedAt: string): E85SpatialAdapterResolution;
}

export type E85SpatialAdapterRegistryResult = { ok: true; registry: E85SpatialAdapterRegistry } | { ok: false; problems: readonly E85SpatialAdapterRegistryProblem[] };

/**
 * Why one specific adapter did not match, most-general-first so the reported
 * reason is the outermost thing that is wrong: a neighbouring city's snapshot
 * offered to this city's adapter reports a jurisdiction problem, not a release
 * problem.
 */
function whyNotMatched(adapter: E85SpatialSourceAdapter, criteria: E85SpatialAdapterResolutionCriteria): E85SpatialAdapterUnsupportedReason | undefined {
  const id = adapter.identity;
  if (id.jurisdictionId !== criteria.jurisdictionId) return "JURISDICTION_NOT_SUPPORTED";
  if (!id.supportedDatasetIds.includes(criteria.datasetId)) return "DATASET_NOT_SUPPORTED";
  if (!id.supportedSourceSystems.includes(criteria.sourceSystem)) return "SOURCE_SYSTEM_NOT_SUPPORTED";
  if (!id.supportedDatasetVersionIds.includes(criteria.datasetVersionId)) return "VERSION_NOT_SUPPORTED";
  return undefined;
}

/**
 * The single most informative failure across every registered adapter. An
 * adapter matching jurisdiction + dataset + payload shape but not release tells
 * a caller something far more actionable than the dozen that failed on
 * jurisdiction, so the deepest failure wins.
 */
const REASON_SPECIFICITY: readonly E85SpatialAdapterUnsupportedReason[] = ["JURISDICTION_NOT_SUPPORTED", "DATASET_NOT_SUPPORTED", "SOURCE_SYSTEM_NOT_SUPPORTED", "VERSION_NOT_SUPPORTED"];

export function createE85SpatialAdapterRegistry(adapters: readonly E85SpatialSourceAdapter[]): E85SpatialAdapterRegistryResult {
  const problems: E85SpatialAdapterRegistryProblem[] = [];
  const counts = new Map<string, number>();
  for (const a of adapters) {
    const n = (counts.get(a.identity.adapterId) ?? 0) + 1;
    counts.set(a.identity.adapterId, n);
    if (n === 2) {
      problems.push({
        code: "DUPLICATE_SPATIAL_ADAPTER_ID",
        adapterId: a.identity.adapterId,
        detail: `Spatial adapter id "${a.identity.adapterId}" is registered more than once; which one normalized a feature would depend on registration order.`,
      });
    }
  }
  if (problems.length > 0) return { ok: false, problems };

  const sorted = [...adapters].sort((a, b) => byE85SpatialKey(a.identity.adapterId, b.identity.adapterId));
  const index = new Map<string, E85SpatialSourceAdapter>(sorted.map((a) => [a.identity.adapterId, a]));

  const registry: E85SpatialAdapterRegistry = {
    list: () => sorted,
    get: (adapterId) => index.get(adapterId),
    resolve: (criteria, checkedAt) => {
      const matches = sorted.filter((a) => whyNotMatched(a, criteria) === undefined);

      if (matches.length === 1) return { resolved: true, adapter: matches[0] };

      if (matches.length > 1) {
        const detail =
          `${matches.length} spatial adapters claim ${criteria.jurisdictionId}/${criteria.datasetId}@${criteria.datasetVersionId} (${criteria.sourceSystem}): ` +
          `${matches.map((m) => m.identity.adapterId).join(", ")}. Resolution is refused rather than picking one, since either choice would depend on registration order.`;
        return { resolved: false, reason: "AMBIGUOUS_ADAPTER_MATCH", detail, gap: spatialUnsupportedReasonToGap("AMBIGUOUS_ADAPTER_MATCH", detail, [criteria.datasetId], checkedAt) };
      }

      if (sorted.length === 0) {
        const detail = `No spatial adapters are registered at all, so ${criteria.jurisdictionId}/${criteria.datasetId} cannot be normalized.`;
        return { resolved: false, reason: "NO_ADAPTER_REGISTERED", detail, gap: spatialUnsupportedReasonToGap("NO_ADAPTER_REGISTERED", detail, [criteria.datasetId], checkedAt) };
      }

      const reasons = sorted.map((a) => whyNotMatched(a, criteria)).filter((r): r is E85SpatialAdapterUnsupportedReason => r !== undefined);
      let deepest: E85SpatialAdapterUnsupportedReason = "JURISDICTION_NOT_SUPPORTED";
      for (const r of reasons) {
        if (REASON_SPECIFICITY.indexOf(r) > REASON_SPECIFICITY.indexOf(deepest)) deepest = r;
      }
      const reason: E85SpatialAdapterUnsupportedReason = reasons.length === 0 ? "NO_ADAPTER_REGISTERED" : deepest;
      const detail =
        `No registered spatial adapter handles ${criteria.jurisdictionId}/${criteria.datasetId}@${criteria.datasetVersionId} (${criteria.sourceSystem}). ` +
        `Closest failure across ${sorted.length} registered adapter(s): ${reason}. No fallback to another jurisdiction's adapter is performed. ` +
        `This reports what E85 can normalize, never whether the layer or its features exist.`;
      return { resolved: false, reason, detail, gap: spatialUnsupportedReasonToGap(reason, detail, [criteria.datasetId], checkedAt) };
    },
  };

  return { ok: true, registry };
}

function refuse(
  snapshot: E85RawSpatialSourceSnapshot,
  reason: E85SpatialAdapterUnsupportedReason,
  detail: string,
  normalizedAt: string,
  finding: E85SpatialSourceFinding,
  readiness: E85SpatialSourceReadiness,
): E85SpatialNormalizationResult {
  const gap = spatialUnsupportedReasonToGap(reason, detail, [snapshot.datasetId], normalizedAt);
  return {
    outcome: "UNSUPPORTED",
    reason,
    detail,
    snapshotId: snapshot.snapshotId,
    gap,
    findings: [{ ...finding, gap }],
    readiness,
    normalizedAt,
  };
}

/**
 * The Phase 8 public entry point: check the snapshot against authoritative
 * metadata, resolve an adapter, normalize.
 *
 * Pure, offline and deterministic. Nothing here fetches: the snapshot is
 * already in the caller's hand, and how it got there is outside E85 entirely.
 *
 * Every failure on the way is an ordinary typed result carrying a real Phase 3
 * `E85DataGap`, so a refused snapshot is reported in the same vocabulary as any
 * other unanswerable question.
 */
export function normalizeE85SpatialSnapshot(
  snapshot: E85RawSpatialSourceSnapshot,
  datasetRegistry: E85SpatialDatasetRegistry,
  adapterRegistry: E85SpatialAdapterRegistry,
  options?: E85SpatialNormalizationOptions,
): E85SpatialNormalizationResult {
  const normalizedAt = resolveE85SpatialNormalizedAt(snapshot, options);

  // ---- The dataset must be registered before anything it claims is believed.
  const dataset = datasetRegistry.find(snapshot.datasetId);
  if (dataset === undefined) {
    const detail = `Snapshot "${snapshot.snapshotId}" claims dataset "${snapshot.datasetId}", which is not registered in the E85 spatial dataset registry. No feature is normalized from an unregistered dataset.`;
    return refuse(
      snapshot,
      "DATASET_NOT_REGISTERED",
      detail,
      normalizedAt,
      { code: "DATASET_UNREGISTERED", severity: "GAP", message: detail },
      unreadySpatialSource({}),
    );
  }

  // ---- A jurisdiction contradiction is a real inconsistency between two
  //      authoritative statements, and preferring either would hide it.
  if (dataset.jurisdictionId !== snapshot.jurisdictionId) {
    const detail =
      `Snapshot "${snapshot.snapshotId}" claims jurisdiction "${snapshot.jurisdictionId}" but dataset "${snapshot.datasetId}" is registered to "${dataset.jurisdictionId}". ` +
      `The contradiction is reported rather than resolved by preferring either side.`;
    return refuse(
      snapshot,
      "JURISDICTION_MISMATCH",
      detail,
      normalizedAt,
      { code: "JURISDICTION_MISMATCH", severity: "GAP", message: detail },
      unreadySpatialSource({ datasetRegistered: true }),
    );
  }

  // ---- Releases match exactly. A boundary redrawn between releases is a
  //      different boundary, so "close enough" is never close enough.
  const version = datasetRegistry.findVersion(snapshot.datasetId, snapshot.datasetVersionId);
  if (version === undefined) {
    const registered = dataset.versions.map((v) => v.versionId).join(", ");
    const detail =
      `Snapshot "${snapshot.snapshotId}" claims release "${snapshot.datasetVersionId}" of "${snapshot.datasetId}", which is not registered (registered: ${registered || "none"}). ` +
      `No neighbouring release is substituted and no newest-release fallback is applied — a layer redrawn between releases depicts different boundaries.`;
    return refuse(
      snapshot,
      "VERSION_NOT_SUPPORTED",
      detail,
      normalizedAt,
      { code: "DATASET_VERSION_MISMATCH", severity: "GAP", message: detail },
      unreadySpatialSource({ datasetRegistered: true }),
    );
  }

  // ---- A CRS is DECLARED or it is absent. It is never inferred, and an
  //      absence cannot be filled from the registry: what the dataset is
  //      normally published in is not evidence about what THIS payload holds.
  if (snapshot.declaredCrs === undefined) {
    const detail =
      `Snapshot "${snapshot.snapshotId}" declares no coordinate reference system. E85 does not infer one from coordinate ranges, does not assume EPSG:4326, ` +
      `and does not borrow the dataset's registered CRS — what a layer is usually published in says nothing about what this particular payload contains. ` +
      `The coordinates are present and readable; what is absent is any basis for locating them.`;
    return refuse(
      snapshot,
      "CRS_UNDECLARED",
      detail,
      normalizedAt,
      { code: "CRS_UNDECLARED", severity: "GAP", message: detail },
      unreadySpatialSource({ datasetRegistered: true, releaseRecognized: true }),
    );
  }

  if (!e85CrsMatches(snapshot.declaredCrs, dataset.crs)) {
    const detail =
      `Snapshot "${snapshot.snapshotId}" declares CRS "${snapshot.declaredCrs.crsId}" but dataset "${snapshot.datasetId}" is registered as "${dataset.crs.crsId}". ` +
      `Neither is preferred and no transform is performed: one of the two statements is wrong, and normalizing under either would place every feature in a space nobody confirmed.`;
    return refuse(
      snapshot,
      "CRS_CONTRADICTION",
      detail,
      normalizedAt,
      { code: "CRS_CONTRADICTS_REGISTRY", severity: "GAP", message: detail },
      unreadySpatialSource({ datasetRegistered: true, releaseRecognized: true, crsDeclared: true }),
    );
  }

  // ---- Exactly one adapter, or none.
  const resolution = adapterRegistry.resolve(
    { jurisdictionId: snapshot.jurisdictionId, datasetId: snapshot.datasetId, datasetVersionId: snapshot.datasetVersionId, sourceSystem: snapshot.sourceSystem },
    normalizedAt,
  );
  if (!resolution.resolved) {
    return {
      outcome: "UNSUPPORTED",
      reason: resolution.reason,
      detail: resolution.detail,
      snapshotId: snapshot.snapshotId,
      gap: resolution.gap,
      findings: [{ code: "NO_ADAPTER_AVAILABLE", severity: "GAP", message: resolution.detail, gap: resolution.gap }],
      readiness: unreadySpatialSource({ datasetRegistered: true, releaseRecognized: true, crsDeclared: true }),
      normalizedAt,
    };
  }

  const decision = resolution.adapter.canHandle(snapshot, dataset);
  if (!decision.supported) {
    const gap = spatialUnsupportedReasonToGap(decision.reason, decision.detail, [snapshot.datasetId], normalizedAt);
    return {
      outcome: "UNSUPPORTED",
      reason: decision.reason,
      detail: decision.detail,
      snapshotId: snapshot.snapshotId,
      gap,
      findings: [{ code: "NO_ADAPTER_AVAILABLE", severity: "GAP", message: decision.detail, gap }],
      readiness: unreadySpatialSource({ datasetRegistered: true, releaseRecognized: true, crsDeclared: true }),
      normalizedAt,
    };
  }

  return resolution.adapter.normalize(snapshot, dataset, options);
}

/**
 * InvestScape™ E85 Phase 8 — Spatial Source Adapter: the generic contract.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * A spatial adapter answers two questions: "can I read this snapshot?" and, if
 * so, "what are its records as generic E85 spatial features?" It is a pure
 * deterministic function of its inputs, exactly as a Phase 5 document adapter
 * is, and for the same reason: a normalization that depends on anything other
 * than what was supplied cannot be reviewed.
 *
 * THE INVARIANT THIS FILE EXISTS TO PROTECT: AN ADAPTER NEVER MAKES A BOUNDARY
 * ACCEPTABLE. Phase 7 now has a trusted topology gate, and the temptation an
 * acquisition layer creates is to nudge a stubborn polygon through it —
 * snapping a vertex, closing a sliver, dropping a tangled hole, substituting a
 * bounding box. Every one of those changes a published legal boundary into one
 * nobody published, and does it at the exact moment nobody is looking. So the
 * only geometry operation Phase 8 performs is TRANSCRIPTION: reading a source's
 * coordinate spelling into E85's, value for value. If the result fails Phase
 * 7's gate, the record is quarantined and the failure is reported. It is never
 * fixed and retried.
 *
 * Expected failures are TYPED RESULTS, not exceptions. An unregistered dataset,
 * an unstated CRS, a record with no id, a tangled polygon, a zone code nobody
 * mapped — these are ordinary conditions of municipal data, not programmer
 * errors, and a caller must be able to handle them without a try/catch. `throw`
 * is reserved for genuine invariant violations.
 */
import type { E85DataGap } from "./data-gap-types";
import type { E85RegulatorySpatialFeature, E85SpatialFeatureClass } from "./spatial-applicability-types";
import type { E85SpatialDatasetDefinition } from "./spatial-dataset-types";
import type { E85SourceAccessStatus, E85SourceLicenseStatus } from "./source-readiness-types";
import type { E85RawSpatialFeatureRecord, E85RawSpatialSourceSnapshot, E85SpatialSourceSystem } from "./spatial-source-snapshot-types";
import type { E85SpatialSourceFinding, E85SpatialSourceFindingCode } from "./spatial-source-findings";

/**
 * Stable identity of a spatial adapter.
 *
 * "E85-spatial-v1" would be a useless identity: it names the engine, not the
 * publisher's schema being read, and every adapter in the system would share
 * it. Identity is source- and jurisdiction-specific, and `adapterVersion` moves
 * whenever mapping logic changes in a way that could alter output for unchanged
 * input — which is why both travel on every feature's provenance.
 */
export interface E85SpatialAdapterIdentity {
  /** Dotted, jurisdiction-scoped identity, e.g. "xx-yy-testburgh.zoning-districts.geojson". */
  adapterId: string;
  /** Semantic version of this adapter's mapping logic, e.g. "1.0.0". */
  adapterVersion: string;
  /** Exact jurisdiction this adapter serves. Never a region, never a country. */
  jurisdictionId: string;
  /** Exact `datasetId`s this adapter can read. */
  supportedDatasetIds: readonly string[];
  /** Exact release ids this adapter has been verified against. An unlisted release is not adapted. */
  supportedDatasetVersionIds: readonly string[];
  /** Payload shapes this adapter can parse. A GeoJSON reader must never be handed an ArcGIS payload. */
  supportedSourceSystems: readonly E85SpatialSourceSystem[];
  /** Feature classes this adapter has explicit source mappings for. Descriptive; see `E85SpatialFeatureClass`. */
  supportedFeatureClasses: readonly E85SpatialFeatureClass[];
}

export type E85SpatialAdapterUnsupportedReason =
  | "JURISDICTION_NOT_SUPPORTED"
  | "DATASET_NOT_SUPPORTED"
  | "SOURCE_SYSTEM_NOT_SUPPORTED"
  | "VERSION_NOT_SUPPORTED"
  /** The snapshot's `jurisdictionId` contradicts the registered dataset's. A real inconsistency, never reconciled. */
  | "JURISDICTION_MISMATCH"
  /** The snapshot names a dataset the spatial registry does not contain. */
  | "DATASET_NOT_REGISTERED"
  /** The source declared no CRS, so no feature can be given one honestly. */
  | "CRS_UNDECLARED"
  /** The snapshot's CRS contradicts the registered dataset's. No transform is performed and neither side is preferred. */
  | "CRS_CONTRADICTION"
  /** No registered adapter claims this snapshot. */
  | "NO_ADAPTER_REGISTERED"
  /** More than one adapter claims it; choosing either would make the answer depend on registration order. */
  | "AMBIGUOUS_ADAPTER_MATCH";

export type E85SpatialAdapterSupportDecision = { supported: true } | { supported: false; reason: E85SpatialAdapterUnsupportedReason; detail: string };

/**
 * A raw record that could not safely become a feature, kept rather than dropped.
 *
 * Quarantine is the whole reason Phase 8 can be trusted with a real municipal
 * layer. A record here did NOT become a feature, contributes no rule pack, and
 * did not disappear — a reviewer can see exactly which record, from which
 * release, failed for exactly which reason, and can go back to the publisher
 * with something specific.
 */
export interface E85QuarantinedSpatialRecord {
  /** The authoritative feature id, when the record had one. Absent is itself often the reason for quarantine. */
  featureId?: string;
  datasetId: string;
  datasetVersionId: string;
  /** Compact locator — `snapshotId#index`. Never an identity; it names a position in one payload. */
  rawRecordRef: string;
  /** Every reason this record was withheld. More than one can be true at once and all are reported. */
  reasonCodes: readonly E85SpatialSourceFindingCode[];
  /** Specific, non-boilerplate explanation. */
  detail: string;
  /** The handful of raw values that mattered to the decision. Compact by design — see the raw-payload discipline note on `E85SpatialFieldMapping`. */
  rawValues?: Readonly<Record<string, unknown>>;
  /** Convenience locator for the record at its source, when supplied. */
  sourceLocator?: string;
}

/**
 * One raw value and the normalized value it produced.
 *
 * Enough to answer "why does this feature say that?" without copying the source
 * record into the output. Whole raw payloads are deliberately NOT embedded per
 * feature: a 40,000-polygon layer duplicated into 40,000 provenance records is
 * unreviewable, and the reference plus the handful of fields that mattered is
 * what a reviewer actually follows.
 */
export interface E85SpatialFieldMapping {
  /** The source's own attribute name, verbatim. */
  sourceField: string;
  /** The source's own value, verbatim. */
  sourceValue: string;
  /** The E85 field it became. */
  normalizedField: string;
  /** The normalized value. */
  normalizedValue: string;
}

/** The mapping audit for one normalized feature, keyed by its authoritative id. */
export interface E85SpatialFeatureAudit {
  featureId: string;
  rawRecordRef: string;
  mappings: readonly E85SpatialFieldMapping[];
}

/**
 * Adapter/source readiness across independent axes.
 *
 * Kept as separate booleans-with-meaning rather than one flag or one score,
 * because these fail for unrelated reasons and are fixed by unrelated people: a
 * missing CRS is a publisher's metadata problem, an unavailable adapter is
 * ours, and an unmapped zone code is a policy decision nobody has made yet.
 * Averaging them would produce a number that tells nobody what to do next.
 */
export interface E85SpatialSourceReadiness {
  /** The dataset is registered in the spatial dataset registry. */
  datasetRegistered: boolean;
  /** A snapshot was supplied. Says nothing about whether it is usable. */
  snapshotSupplied: boolean;
  /** The snapshot's release is a registered release of that dataset. */
  releaseRecognized: boolean;
  /** The source declared a CRS. Never true because E85 assumed one. */
  crsDeclared: boolean;
  /** Exactly one registered adapter claims this snapshot. */
  adapterAvailable: boolean;
  /** At least one record was mapped into a feature. False on an empty or wholly-quarantined snapshot. */
  featureMappingSupported: boolean;
  /** At least one normalized feature carries a resolved rule-pack linkage. */
  rulePackLinkageSupported: boolean;
  /** At least one normalized feature's geometry was accepted by Phase 7's gate. */
  geometryAcceptedByPhase7: boolean;
  /** Carried through from the registered dataset, never derived from access. */
  licenseStatus?: E85SourceLicenseStatus;
  /** Carried through from the registered dataset. */
  accessStatus?: E85SourceAccessStatus;
}

export interface E85SpatialNormalizationSuccess {
  outcome: "NORMALIZED";
  adapterId: string;
  adapterVersion: string;
  snapshotId: string;
  datasetId: string;
  datasetVersionId: string;
  jurisdictionId: string;
  /** The features, canonically ordered by feature id. The handoff to Phase 7. */
  features: readonly E85RegulatorySpatialFeature[];
  /** Records withheld, canonically ordered. Never merged into `features`. */
  quarantined: readonly E85QuarantinedSpatialRecord[];
  findings: readonly E85SpatialSourceFinding[];
  /** Per-feature raw-to-normalized audit, canonically ordered. */
  audits: readonly E85SpatialFeatureAudit[];
  readiness: E85SpatialSourceReadiness;
  /** ISO 8601. Caller-supplied, else the snapshot's retrieval time, else a fixed sentinel — never a clock read. */
  normalizedAt: string;
}

/**
 * A snapshot-level refusal: nothing in the payload was normalized.
 *
 * Distinct from a payload in which some records were quarantined, and the
 * distinction is load-bearing. One tangled polygon out of forty thousand must
 * not cost a caller the other 39,999; an unregistered dataset or an unstated
 * CRS is a fact about every record at once and there is nothing to salvage.
 */
export interface E85SpatialNormalizationUnsupported {
  outcome: "UNSUPPORTED";
  reason: E85SpatialAdapterUnsupportedReason;
  detail: string;
  snapshotId: string;
  /** A real Phase 3 gap, so a refused snapshot is reportable in the same vocabulary as every other missing answer. */
  gap: E85DataGap;
  findings: readonly E85SpatialSourceFinding[];
  readiness: E85SpatialSourceReadiness;
  normalizedAt: string;
}

export type E85SpatialNormalizationResult = E85SpatialNormalizationSuccess | E85SpatialNormalizationUnsupported;

/** Optional knobs. Minimal on purpose: an adapter with many behavioural switches stops being deterministic in any useful sense. */
export interface E85SpatialNormalizationOptions {
  /** Overrides the timestamp stamped on findings and gap records, so normalization never reads a clock. */
  normalizedAt?: string;
}

export interface E85SpatialSourceAdapter {
  readonly identity: E85SpatialAdapterIdentity;
  /** Pure predicate over identity/scope only. Does not inspect records — a snapshot can be handleable and still normalize to nothing but quarantine. */
  canHandle(snapshot: E85RawSpatialSourceSnapshot, dataset: E85SpatialDatasetDefinition): E85SpatialAdapterSupportDecision;
  /** Pure normalization. Must not mutate `snapshot`, its records, or `dataset`. */
  normalize(snapshot: E85RawSpatialSourceSnapshot, dataset: E85SpatialDatasetDefinition, options?: E85SpatialNormalizationOptions): E85SpatialNormalizationResult;
}

/**
 * Deterministic fallback when neither the caller nor the snapshot supplies a
 * time. A fixed sentinel, not a manufactured retrieval timestamp: it stamps
 * "when E85 performed this check" on gap records, which need one, and is never
 * written to a feature's `observedAt`, which asserts when a source was actually
 * read. Inventing the latter would be evidence fabrication; the former is a
 * reproducible constant.
 */
export const E85_SPATIAL_NORMALIZATION_EPOCH = "1970-01-01T00:00:00.000Z";

export function resolveE85SpatialNormalizedAt(snapshot: Pick<E85RawSpatialSourceSnapshot, "retrievedAt">, options?: E85SpatialNormalizationOptions): string {
  return options?.normalizedAt ?? snapshot.retrievedAt ?? E85_SPATIAL_NORMALIZATION_EPOCH;
}

/**
 * Maps a snapshot-level refusal onto the existing Phase 3 gap taxonomy, so
 * Phase 8 adds no parallel vocabulary for "we cannot answer this".
 *
 * The reason axis is what distinguishes these failures from each other; the gap
 * code says what KIND of answer is missing. Two reasons sharing a code are
 * still told apart by `reason` and by their distinct resolution hints — the
 * same arrangement Phase 5's `unsupportedReasonToGap` uses.
 *
 * Note what CRS failures map to. A snapshot with an unstated or contradicted
 * CRS is not missing geometry — the coordinates are right there — so
 * `GEOMETRY_UNAVAILABLE` would send a caller to re-obtain shapes they already
 * hold. `SPATIAL_REFERENCE_MISMATCH` is the code Phase 7 added for exactly this
 * distinction, and it is reused rather than duplicated.
 */
export function spatialUnsupportedReasonToGap(reason: E85SpatialAdapterUnsupportedReason, detail: string, sourcesChecked: readonly string[], checkedAt: string): E85DataGap {
  const reasonCode =
    reason === "CRS_UNDECLARED" || reason === "CRS_CONTRADICTION"
      ? ("SPATIAL_REFERENCE_MISMATCH" as const)
      : reason === "VERSION_NOT_SUPPORTED"
        ? ("BYLAW_VERSION_UNKNOWN" as const)
        : reason === "JURISDICTION_NOT_SUPPORTED" || reason === "JURISDICTION_MISMATCH"
          ? ("JURISDICTION_UNSUPPORTED" as const)
          : reason === "AMBIGUOUS_ADAPTER_MATCH"
            ? ("ZONING_AMBIGUOUS" as const)
            : // DATASET_NOT_REGISTERED / DATASET_NOT_SUPPORTED / SOURCE_SYSTEM_NOT_SUPPORTED /
              // NO_ADAPTER_REGISTERED: the layer exists and may well be sitting in the
              // caller's hand; what is missing is E85's ability to structure it.
              ("RULE_NOT_STRUCTURED" as const);

  const resolutionHint =
    reason === "CRS_UNDECLARED"
      ? "Obtain the publisher's declared coordinate reference system for this layer and supply it on the snapshot. E85 does not infer a CRS from coordinate ranges."
      : reason === "CRS_CONTRADICTION"
        ? "Establish which coordinate reference system this release is actually published in and correct either the snapshot or the dataset registration. E85 performs no coordinate conversion."
        : reason === "VERSION_NOT_SUPPORTED"
          ? "Register and verify this release, or supply a snapshot of a registered one. No nearest-release substitution is performed."
          : reason === "DATASET_NOT_REGISTERED"
            ? "Register this dataset in the E85 spatial dataset registry before features from it can be normalized."
            : reason === "NO_ADAPTER_REGISTERED"
              ? "Build and register a spatial adapter for this jurisdiction/dataset before its features can be normalized."
              : reason === "SOURCE_SYSTEM_NOT_SUPPORTED"
                ? "Supply the snapshot in a payload shape a registered adapter reads, or extend the adapter to read this one."
                : undefined;

  return { reasonCode, reason: detail, sourcesChecked, checkedAt, ...(resolutionHint === undefined ? {} : { resolutionHint }) };
}

/**
 * A readiness record for a snapshot that never got far enough to be read. Every
 * positive axis must be EARNED, so the default is all-false and a caller states
 * only what was actually established before the refusal.
 */
export function unreadySpatialSource(established: Partial<E85SpatialSourceReadiness>): E85SpatialSourceReadiness {
  return {
    datasetRegistered: false,
    snapshotSupplied: true,
    releaseRecognized: false,
    crsDeclared: false,
    adapterAvailable: false,
    featureMappingSupported: false,
    rulePackLinkageSupported: false,
    geometryAcceptedByPhase7: false,
    ...established,
  };
}

/** Canonical ordering for anything keyed by a string, so output never carries the caller's array order. */
export function byE85SpatialKey(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The raw records of a snapshot paired with their canonical references, without mutating the snapshot. */
export function e85IndexedRawRecords(snapshot: E85RawSpatialSourceSnapshot): readonly { record: E85RawSpatialFeatureRecord; index: number }[] {
  return snapshot.rawFeatures.map((record, index) => ({ record, index }));
}

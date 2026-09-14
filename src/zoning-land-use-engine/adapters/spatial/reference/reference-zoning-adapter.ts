/**
 * InvestScape™ E85 Phase 8 — reference spatial source adapter.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Reads the invented Refburgh zoning layer into generic E85 spatial features.
 * Offline, pure, deterministic, and entirely synthetic — it fetches nothing,
 * reads no file, and describes no real municipality.
 *
 * THE ONE GEOMETRY OPERATION THIS ADAPTER PERFORMS IS TRANSCRIPTION. It reads
 * the source's coordinate spelling — arrays of `[x, y]` pairs — into E85's
 * `E85LinearRing`, value for value, and does nothing else. It does not reorder
 * vertices, untangle a crossing, snap a near-miss, close a sliver, dissolve an
 * overlap, drop a hole, simplify a boundary, buffer anything, substitute a
 * centroid, or rebuild a polygon from its bounding box. Every one of those
 * would replace a published legal boundary with one nobody published, at the
 * exact moment nobody is watching.
 *
 * So when Phase 7's topology gate refuses a polygon, this adapter quarantines
 * the record and reports why. It does not fix and retry. A municipality
 * shipping a tangled polygon has a data problem that belongs back with the
 * municipality, and the honest output is a specific, actionable refusal.
 */
import type { E85RegulatorySpatialFeature, E85SpatialFeatureClass } from "../../../spatial-applicability-types";
import type { E85SpatialDatasetDefinition } from "../../../spatial-dataset-types";
import { deriveE85SpatialTemporalWindow } from "../../../spatial-dataset-types";
import type { E85LinearRing, E85PolygonGeometry, E85Position } from "../../../spatial-types";
import { formatE85GeometryProblems, validateE85Geometry } from "../../../geometry-validation";
import type { E85RawSpatialFeatureRecord, E85RawSpatialSourceSnapshot } from "../../../spatial-source-snapshot-types";
import { e85RawRecordRef } from "../../../spatial-source-snapshot-types";
import type { E85SpatialSourceFinding, E85SpatialSourceFindingCode } from "../../../spatial-source-findings";
import type {
  E85QuarantinedSpatialRecord,
  E85SpatialAdapterIdentity,
  E85SpatialAdapterSupportDecision,
  E85SpatialFeatureAudit,
  E85SpatialFieldMapping,
  E85SpatialNormalizationOptions,
  E85SpatialNormalizationResult,
  E85SpatialSourceAdapter,
} from "../../../spatial-source-adapter-contract";
import { byE85SpatialKey, resolveE85SpatialNormalizedAt } from "../../../spatial-source-adapter-contract";
import {
  REFERENCE_CRS,
  REFERENCE_DATASET_ID,
  REFERENCE_FIELDS,
  REFERENCE_JURISDICTION,
  REFERENCE_LAYER_KIND_TO_CLASS,
  REFERENCE_RELEASE,
  REFERENCE_ZONE_CODE_TO_RULE_PACKS,
} from "./reference-zoning-source";

export const REFERENCE_ZONING_ADAPTER_ID = `${REFERENCE_JURISDICTION}.zoning-districts.geojson`;
export const REFERENCE_ZONING_ADAPTER_VERSION = "1.0.0";

const IDENTITY: E85SpatialAdapterIdentity = {
  adapterId: REFERENCE_ZONING_ADAPTER_ID,
  adapterVersion: REFERENCE_ZONING_ADAPTER_VERSION,
  jurisdictionId: REFERENCE_JURISDICTION,
  supportedDatasetIds: [REFERENCE_DATASET_ID],
  supportedDatasetVersionIds: [REFERENCE_RELEASE],
  supportedSourceSystems: ["GEOJSON"],
  supportedFeatureClasses: ["BASE_ZONE", "OVERLAY", "SITE_SPECIFIC", "HERITAGE"],
};

/** A string attribute, or undefined when absent or not a string. Never coerced: a number where a zone code belongs is a source defect, not a value to `String()`. */
function stringAttribute(record: E85RawSpatialFeatureRecord, field: string): string | undefined {
  const value = record.rawAttributes[field];
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** Whether a value is a pair of finite numbers, without altering it. */
function isPositionLike(value: unknown): value is readonly [number, number] {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === "number" && typeof value[1] === "number" && Number.isFinite(value[0]) && Number.isFinite(value[1]);
}

/** Transcribes one ring. Copies coordinates; changes none, adds none, removes none, reorders none. */
function readRing(value: unknown): E85LinearRing | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const positions: E85Position[] = [];
  for (const entry of value) {
    if (!isPositionLike(entry)) return undefined;
    positions.push([entry[0], entry[1]]);
  }
  return positions;
}

/**
 * Reads this publisher's polygon spelling: `{ type: "Polygon", coordinates:
 * [exteriorRing, ...holes] }`, rings as arrays of `[x, y]`.
 *
 * Returns undefined when the shape is not one this adapter reads — which is
 * DISTINCT from reading it successfully and finding it malformed. The first is
 * "I cannot parse this"; the second is "I parsed it and it is not a valid
 * polygon", and they send a reviewer to different people.
 */
function readPolygon(raw: unknown, crs: E85PolygonGeometry["crs"]): E85PolygonGeometry | undefined {
  if (raw === null || typeof raw !== "object") return undefined;
  const shape = raw as { type?: unknown; coordinates?: unknown };
  if (shape.type !== "Polygon" || !Array.isArray(shape.coordinates) || shape.coordinates.length === 0) return undefined;

  const exterior = readRing(shape.coordinates[0]);
  if (exterior === undefined) return undefined;

  const interiors: E85LinearRing[] = [];
  for (const hole of shape.coordinates.slice(1)) {
    const ring = readRing(hole);
    if (ring === undefined) return undefined;
    interiors.push(ring);
  }

  return { type: "POLYGON", crs, exterior, ...(interiors.length === 0 ? {} : { interiors }) };
}

/** A stable content signature for deciding whether two records claiming one id are the same record or a genuine conflict. */
function materialSignature(record: E85RawSpatialFeatureRecord): string {
  return JSON.stringify({
    geometry: record.rawGeometry ?? null,
    zone: record.rawAttributes[REFERENCE_FIELDS.zoneCode] ?? null,
    kind: record.rawAttributes[REFERENCE_FIELDS.layerKind] ?? null,
  });
}

interface StagedRecord {
  featureId: string;
  record: E85RawSpatialFeatureRecord;
  rawRecordRef: string;
  signature: string;
}

export const referenceZoningSpatialAdapter: E85SpatialSourceAdapter = {
  identity: IDENTITY,

  canHandle(snapshot: E85RawSpatialSourceSnapshot, dataset: E85SpatialDatasetDefinition): E85SpatialAdapterSupportDecision {
    if (snapshot.jurisdictionId !== IDENTITY.jurisdictionId) {
      return { supported: false, reason: "JURISDICTION_NOT_SUPPORTED", detail: `This adapter serves ${IDENTITY.jurisdictionId} only; the snapshot claims "${snapshot.jurisdictionId}".` };
    }
    if (!IDENTITY.supportedDatasetIds.includes(dataset.datasetId)) {
      return { supported: false, reason: "DATASET_NOT_SUPPORTED", detail: `This adapter reads ${IDENTITY.supportedDatasetIds.join(", ")}; the snapshot is of "${dataset.datasetId}".` };
    }
    if (!IDENTITY.supportedSourceSystems.includes(snapshot.sourceSystem)) {
      return {
        supported: false,
        reason: "SOURCE_SYSTEM_NOT_SUPPORTED",
        detail: `This adapter reads ${IDENTITY.supportedSourceSystems.join(", ")} payloads; the snapshot is "${snapshot.sourceSystem}". Payload shapes are not guessed at.`,
      };
    }
    if (!IDENTITY.supportedDatasetVersionIds.includes(snapshot.datasetVersionId)) {
      return {
        supported: false,
        reason: "VERSION_NOT_SUPPORTED",
        detail: `This adapter is verified against release(s) ${IDENTITY.supportedDatasetVersionIds.join(", ")}; the snapshot claims "${snapshot.datasetVersionId}".`,
      };
    }
    return { supported: true };
  },

  normalize(snapshot: E85RawSpatialSourceSnapshot, dataset: E85SpatialDatasetDefinition, options?: E85SpatialNormalizationOptions): E85SpatialNormalizationResult {
    const normalizedAt = resolveE85SpatialNormalizedAt(snapshot, options);
    const crs = snapshot.declaredCrs ?? REFERENCE_CRS;
    const temporal = deriveE85SpatialTemporalWindow(dataset.versions.find((v) => v.versionId === snapshot.datasetVersionId));

    const findings: E85SpatialSourceFinding[] = [];
    const quarantined: E85QuarantinedSpatialRecord[] = [];
    const features: E85RegulatorySpatialFeature[] = [];
    const audits: E85SpatialFeatureAudit[] = [];

    const quarantine = (
      rawRecordRef: string,
      reasonCodes: readonly E85SpatialSourceFindingCode[],
      detail: string,
      featureId?: string,
      rawValues?: Readonly<Record<string, unknown>>,
      sourceLocator?: string,
    ): void => {
      quarantined.push({
        ...(featureId === undefined ? {} : { featureId }),
        datasetId: snapshot.datasetId,
        datasetVersionId: snapshot.datasetVersionId,
        rawRecordRef,
        reasonCodes,
        detail,
        ...(rawValues === undefined ? {} : { rawValues }),
        ...(sourceLocator === undefined ? {} : { sourceLocator }),
      });
      findings.push({
        code: "FEATURE_QUARANTINED",
        severity: "GAP",
        ...(featureId === undefined ? {} : { featureId }),
        rawRecordRef,
        message: detail,
        gap: {
          reasonCode: "RULE_NOT_STRUCTURED",
          reason: detail,
          sourcesChecked: [snapshot.datasetId],
          checkedAt: normalizedAt,
          resolutionHint: "Correct the record at its publisher and re-snapshot. E85 does not repair authoritative spatial evidence on a publisher's behalf.",
        },
      });
    };

    // ---- Pass 1: identity. A record without an authoritative id cannot be
    //      given one, so it never reaches the mapping stage.
    const staged: StagedRecord[] = [];
    snapshot.rawFeatures.forEach((record, index) => {
      const rawRecordRef = e85RawRecordRef(snapshot, record, index);
      const featureId = record.rawFeatureId ?? stringAttribute(record, REFERENCE_FIELDS.featureId);
      if (featureId === undefined) {
        const objectRef = record.rawAttributes[REFERENCE_FIELDS.objectRef];
        findings.push({
          code: "FEATURE_ID_MISSING",
          severity: "GAP",
          rawRecordRef,
          message:
            `Record ${rawRecordRef} carries no authoritative feature identifier. Its record position and the publisher's internal ${REFERENCE_FIELDS.objectRef} ` +
            `(${JSON.stringify(objectRef ?? null)}) are storage artefacts that change when the layer is rebuilt, so neither is promoted into a feature identity.`,
          gap: {
            reasonCode: "RULE_NOT_STRUCTURED",
            reason: `Record ${rawRecordRef} has no authoritative feature id, so no provenance chain can be anchored to it.`,
            sourcesChecked: [snapshot.datasetId],
            checkedAt: normalizedAt,
            resolutionHint: `Obtain a release that populates ${REFERENCE_FIELDS.featureId} for every record.`,
          },
        });
        quarantine(
          rawRecordRef,
          ["FEATURE_ID_MISSING"],
          `Record ${rawRecordRef} was withheld because it has no authoritative feature identifier. Without one, deduplication, provenance and every later "which feature said this?" question are unanswerable.`,
          undefined,
          { [REFERENCE_FIELDS.objectRef]: objectRef ?? null },
          record.sourceLocator,
        );
        return;
      }
      staged.push({ featureId, record, rawRecordRef, signature: materialSignature(record) });
    });

    // ---- Pass 2: identity collisions, resolved by neither first nor last.
    const byFeatureId = new Map<string, StagedRecord[]>();
    for (const entry of staged) {
      const existing = byFeatureId.get(entry.featureId);
      if (existing === undefined) byFeatureId.set(entry.featureId, [entry]);
      else existing.push(entry);
    }

    const accepted: StagedRecord[] = [];
    for (const [featureId, group] of [...byFeatureId.entries()].sort((a, b) => byE85SpatialKey(a[0], b[0]))) {
      if (group.length === 1) {
        accepted.push(group[0]);
        continue;
      }
      const signatures = new Set(group.map((g) => g.signature));
      const refs = group.map((g) => g.rawRecordRef).sort(byE85SpatialKey);
      if (signatures.size === 1) {
        // The identical record, twice. One feature, and a repeated read is
        // never corroboration.
        accepted.push(group.slice().sort((a, b) => byE85SpatialKey(a.rawRecordRef, b.rawRecordRef))[0]);
        findings.push({
          code: "DUPLICATE_RAW_FEATURE_COLLAPSED",
          severity: "INFO",
          featureId,
          rawRecordRef: refs.join(", "),
          message: `Feature "${featureId}" appears ${group.length} times in this snapshot with identical content and was normalized once. Supplying a record twice does not make its boundary more authoritative.`,
        });
        continue;
      }
      const detail =
        `${group.length} records (${refs.join(", ")}) claim authoritative feature id "${featureId}" but differ in geometry or attributes. ` +
        `Neither first nor last is chosen and the geometries are not merged: one of them is wrong, and picking either would make the answer depend on record order while silently discarding a published boundary.`;
      findings.push({
        code: "CONFLICTING_FEATURE_ID",
        severity: "MANUAL_REVIEW",
        featureId,
        rawRecordRef: refs.join(", "),
        message: detail,
        manualReview: {
          // Two authoritative statements from one publisher that cannot both be
          // true. The existing Phase 3 code says exactly this; Phase 8 adds no
          // parallel vocabulary for it.
          reasonCode: "CONFLICTING_AUTHORITATIVE_SOURCES",
          explanation: detail,
          evidenceConsidered: [snapshot.datasetId],
          flaggedAt: normalizedAt,
        },
      });
      for (const entry of group) {
        quarantine(entry.rawRecordRef, ["CONFLICTING_FEATURE_ID"], detail, featureId, { [REFERENCE_FIELDS.zoneCode]: entry.record.rawAttributes[REFERENCE_FIELDS.zoneCode] ?? null }, entry.record.sourceLocator);
      }
    }

    // ---- Pass 3: mapping. Every stage below is an exact lookup or a refusal.
    for (const entry of accepted.sort((a, b) => byE85SpatialKey(a.featureId, b.featureId))) {
      const { featureId, record, rawRecordRef } = entry;
      const mappings: E85SpatialFieldMapping[] = [{ sourceField: REFERENCE_FIELDS.featureId, sourceValue: featureId, normalizedField: "featureId", normalizedValue: featureId }];

      const layerKind = stringAttribute(record, REFERENCE_FIELDS.layerKind);
      const featureClass: E85SpatialFeatureClass | undefined = layerKind === undefined ? undefined : REFERENCE_LAYER_KIND_TO_CLASS[layerKind];
      if (featureClass === undefined) {
        const detail =
          `Record ${rawRecordRef} (feature "${featureId}") declares layer kind ${JSON.stringify(layerKind ?? null)}, which has no exact mapping in this source's policy. ` +
          `It is NOT mapped to OTHER: "the publisher told us and it did not fit our categories" and "the publisher did not tell us" are different claims, and reading silence as OTHER would quietly settle whether this feature competes for the base-zone slot.`;
        findings.push({ code: "UNKNOWN_FEATURE_CLASS", severity: "GAP", featureId, rawRecordRef, ...(layerKind === undefined ? {} : { sourceValue: layerKind }), message: detail });
        quarantine(rawRecordRef, ["UNKNOWN_FEATURE_CLASS"], detail, featureId, { [REFERENCE_FIELDS.layerKind]: layerKind ?? null }, record.sourceLocator);
        continue;
      }
      mappings.push({ sourceField: REFERENCE_FIELDS.layerKind, sourceValue: layerKind as string, normalizedField: "featureClass", normalizedValue: featureClass });

      const geometry = readPolygon(record.rawGeometry, crs);
      if (geometry === undefined) {
        const detail =
          `Record ${rawRecordRef} (feature "${featureId}") carries geometry this adapter cannot read: it expects { type: "Polygon", coordinates: [ring, ...holes] } with rings of [x, y] pairs. ` +
          `No bounding box, centroid or other substitute shape is used in its place.`;
        findings.push({ code: "UNSUPPORTED_RAW_GEOMETRY", severity: "GAP", featureId, rawRecordRef, message: detail });
        quarantine(rawRecordRef, ["UNSUPPORTED_RAW_GEOMETRY"], detail, featureId, undefined, record.sourceLocator);
        continue;
      }

      // ---- Phase 7's gate, reused rather than re-implemented. Topology rules
      //      live in exactly one place, and this is not that place.
      const validation = validateE85Geometry(geometry);
      if (!validation.valid) {
        const detail =
          `Record ${rawRecordRef} (feature "${featureId}") was transcribed successfully and then REFUSED by Phase 7 geometry validation: ${formatE85GeometryProblems(validation.problems)} ` +
          `No repair was attempted: the boundary is not reordered, snapped, simplified, closed, un-tangled or replaced. Altering a published legal boundary so it passes validation would substitute a shape nobody enacted.`;
        findings.push({ code: "GEOMETRY_FAILED_PHASE7_VALIDATION", severity: "GAP", featureId, rawRecordRef, message: detail });
        quarantine(rawRecordRef, ["GEOMETRY_FAILED_PHASE7_VALIDATION"], detail, featureId, undefined, record.sourceLocator);
        continue;
      }

      // ---- Rule-pack linkage. Unknown stays unknown; the feature still exists.
      const zoneCode = stringAttribute(record, REFERENCE_FIELDS.zoneCode);
      const mapped = zoneCode === undefined ? undefined : REFERENCE_ZONE_CODE_TO_RULE_PACKS[zoneCode];
      const rulePackIds = mapped ?? [];
      if (mapped === undefined) {
        findings.push({
          code: "RULE_PACK_LINK_UNRESOLVED",
          severity: "GAP",
          featureId,
          rawRecordRef,
          ...(zoneCode === undefined ? {} : { sourceValue: zoneCode }),
          message:
            `Feature "${featureId}" carries zone code ${JSON.stringify(zoneCode ?? null)}, for which this source's policy states no rule pack. No identifier is derived from the code's spelling. ` +
            `The feature is still emitted with an empty rule-pack list, because WHERE it is remains a fact the layer established: suppressing it would make Phase 7 report this ground as having no base zone, which is a stronger and different claim than "we do not hold its rules".`,
          gap: {
            reasonCode: "RULE_NOT_STRUCTURED",
            reason: `Zone code ${JSON.stringify(zoneCode ?? null)} has no registered rule pack in this source's mapping policy, so the instrument governing feature "${featureId}" is not structured.`,
            sourcesChecked: [snapshot.datasetId],
            checkedAt: normalizedAt,
            resolutionHint: "Add an explicit zone-code-to-rule-pack mapping for this code, and normalize the instrument it refers to.",
          },
        });
      } else {
        mappings.push({ sourceField: REFERENCE_FIELDS.zoneCode, sourceValue: zoneCode as string, normalizedField: "rulePackIds", normalizedValue: rulePackIds.join(", ") });
      }

      features.push({
        featureId,
        datasetId: snapshot.datasetId,
        datasetVersionId: snapshot.datasetVersionId,
        jurisdictionId: snapshot.jurisdictionId,
        geometry,
        rulePackIds: [...rulePackIds].sort(byE85SpatialKey),
        featureClass,
        provenance: {
          datasetId: snapshot.datasetId,
          datasetVersionId: snapshot.datasetVersionId,
          featureId,
          layerName: "zoning-districts",
          publisher: dataset.publisher,
          jurisdictionId: snapshot.jurisdictionId,
          crs,
          adapterId: IDENTITY.adapterId,
          adapterVersion: IDENTITY.adapterVersion,
          // Only when the snapshot witnessed one. An unobserved read stays
          // unobserved rather than acquiring a manufactured timestamp.
          ...(snapshot.retrievedAt === undefined ? {} : { observedAt: snapshot.retrievedAt }),
          ...(record.sourceLocator === undefined ? {} : { url: record.sourceLocator }),
        },
        temporal,
        ...(zoneCode === undefined ? {} : { zoneDesignation: zoneCode }),
      });
      audits.push({ featureId, rawRecordRef, mappings });
      findings.push({
        code: "FEATURE_NORMALIZED",
        severity: "INFO",
        featureId,
        rawRecordRef,
        ...(zoneCode === undefined ? {} : { sourceValue: zoneCode }),
        message: `Record ${rawRecordRef} became feature "${featureId}" (${featureClass}) with ${rulePackIds.length} rule pack(s). Coordinates were transcribed unchanged.`,
      });
    }

    const sortedFeatures = features.sort((a, b) => byE85SpatialKey(a.featureId, b.featureId));
    return {
      outcome: "NORMALIZED",
      adapterId: IDENTITY.adapterId,
      adapterVersion: IDENTITY.adapterVersion,
      snapshotId: snapshot.snapshotId,
      datasetId: snapshot.datasetId,
      datasetVersionId: snapshot.datasetVersionId,
      jurisdictionId: snapshot.jurisdictionId,
      features: sortedFeatures,
      quarantined: quarantined.sort((a, b) => byE85SpatialKey(a.rawRecordRef, b.rawRecordRef)),
      findings: findings.sort((a, b) => byE85SpatialKey(a.code, b.code) || byE85SpatialKey(a.rawRecordRef ?? "", b.rawRecordRef ?? "") || byE85SpatialKey(a.message, b.message)),
      audits: audits.sort((a, b) => byE85SpatialKey(a.featureId, b.featureId)),
      readiness: {
        datasetRegistered: true,
        snapshotSupplied: true,
        releaseRecognized: true,
        crsDeclared: snapshot.declaredCrs !== undefined,
        adapterAvailable: true,
        featureMappingSupported: sortedFeatures.length > 0,
        rulePackLinkageSupported: sortedFeatures.some((f) => f.rulePackIds.length > 0),
        geometryAcceptedByPhase7: sortedFeatures.length > 0,
        licenseStatus: dataset.licenseStatus,
        accessStatus: dataset.accessStatus,
      },
      normalizedAt,
    };
  },
};

/**
 * InvestScape™ E85 Phase 8 — City of Vancouver zoning-districts spatial adapter.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Reads the City of Vancouver's `zoning-districts-and-labels` layer into
 * generic E85 spatial features. Offline, pure and deterministic: it fetches
 * nothing, opens no file, and reads no clock. A snapshot is handed to it by a
 * caller who obtained the bytes somewhere else entirely.
 *
 * THE ONE GEOMETRY OPERATION THIS ADAPTER PERFORMS IS TRANSCRIPTION. It reads
 * the City's coordinate spelling — `{ type: "Polygon", coordinates: [ring,
 * ...holes] }`, rings of `[easting, northing]` — into E85's `E85LinearRing`,
 * value for value. It does not reproject, reorder, snap, close, simplify,
 * buffer, dissolve, un-tangle, drop a hole, flatten a multipart, or substitute
 * a centroid or bounding box. The City's own `geo_point_2d` label point is read
 * for the audit trail and is NEVER used as a feature's geometry: a label anchor
 * is where a cartographer put a piece of text, not where a zone is.
 *
 * So when Phase 7's topology gate refuses one of the City's polygons — and in
 * the audited release it refuses a handful, all of them interior-ring cases —
 * this adapter quarantines the record and reports exactly which ring failed
 * and why. It does not fix and retry.
 *
 * NOTE WHAT A REFUSAL HERE DOES AND DOES NOT ASSERT. It says the shape falls
 * outside the profile E85 is prepared to reason about, which is a statement
 * about E85's gate. It is NOT a finding that the City published invalid data:
 * no independent or general-purpose GIS validity assessment is performed
 * anywhere in this engine, different readers apply different fill rules to a
 * hole that touches its shell, and a shape another tool accepts may still be
 * one whose interior E85 cannot determine unambiguously. The honest output is
 * therefore a specific, reviewable refusal — never a repaired boundary, and
 * never a verdict on the publisher.
 *
 * WHAT THIS ADAPTER REFUSES TO GUESS is which legal instrument governs a
 * district. See `VANCOUVER_ZONING_DISTRICT_TO_RULE_PACKS`: the production
 * policy is empty, every feature normalizes with no rule-pack linkage, and the
 * gap is reported rather than filled by turning a map label into an identifier.
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
import type { E85VancouverRulePackLinkPolicy } from "./vancouver-zoning-source";
import {
  VANCOUVER_CLASSIFICATION_TO_FEATURE_CLASS,
  VANCOUVER_SPATIAL_JURISDICTION_ID,
  VANCOUVER_ZONING_CRS,
  VANCOUVER_ZONING_DATASET_ID,
  VANCOUVER_ZONING_DATASET_SLUG,
  VANCOUVER_ZONING_DISTRICT_TO_RULE_PACKS,
  VANCOUVER_ZONING_FIELDS,
  VANCOUVER_ZONING_RELEASE,
} from "./vancouver-zoning-source";

export const VANCOUVER_ZONING_SPATIAL_ADAPTER_ID = `${VANCOUVER_SPATIAL_JURISDICTION_ID}.${VANCOUVER_ZONING_DATASET_SLUG}.geojson`;

/** Bumped whenever mapping logic changes in a way that could alter output for unchanged input. Stamped onto every feature's provenance. */
export const VANCOUVER_ZONING_SPATIAL_ADAPTER_VERSION = "1.0.0";

const IDENTITY: E85SpatialAdapterIdentity = {
  adapterId: VANCOUVER_ZONING_SPATIAL_ADAPTER_ID,
  adapterVersion: VANCOUVER_ZONING_SPATIAL_ADAPTER_VERSION,
  jurisdictionId: VANCOUVER_SPATIAL_JURISDICTION_ID,
  supportedDatasetIds: [VANCOUVER_ZONING_DATASET_ID],
  supportedDatasetVersionIds: [VANCOUVER_ZONING_RELEASE],
  supportedSourceSystems: ["GEOJSON"],
  // The City publishes this layer as the zoning-district partition, and every
  // classification in it maps to BASE_ZONE — see the mapping table's note on
  // why Comprehensive Development is not demoted out of the base-zone slot.
  supportedFeatureClasses: ["BASE_ZONE"],
};

/** A string attribute, or undefined when absent, empty or not a string. Never coerced: a number where a zone label belongs is a source defect, not a value to `String()`. */
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
 * Reads the City's polygon spelling.
 *
 * Returns undefined when the shape is not one this adapter reads — which is
 * DISTINCT from reading it successfully and finding it malformed. The first is
 * "I cannot parse this"; the second is "I parsed it and it is not a valid
 * polygon", and they send a reviewer to different people.
 *
 * A `MultiPolygon` deliberately falls into the first case rather than being
 * flattened to its largest part. The audited release contains none; if a later
 * one does, the honest answer is a refusal a reviewer can act on, not a zone
 * quietly reduced to whichever piece happened to be biggest.
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
    classification: record.rawAttributes[VANCOUVER_ZONING_FIELDS.zoningClassification] ?? null,
    district: record.rawAttributes[VANCOUVER_ZONING_FIELDS.zoningDistrict] ?? null,
    cd1: record.rawAttributes[VANCOUVER_ZONING_FIELDS.cd1Number] ?? null,
  });
}

interface StagedRecord {
  featureId: string;
  record: E85RawSpatialFeatureRecord;
  rawRecordRef: string;
  signature: string;
}

/**
 * Builds a Vancouver zoning spatial adapter.
 *
 * `rulePackLinkPolicy` defaults to the EMPTY production policy, because E85
 * holds no rule pack whose legal identity has been established as the
 * instrument governing a Vancouver zoning district. A caller that HAS
 * established such a linkage states it here, keyed on the City's exact
 * `zoning_district` label. That linkage is orchestration's to assert and to
 * defend; this adapter will not derive one from the spelling of a map label.
 */
export function createVancouverZoningSpatialAdapter(rulePackLinkPolicy: E85VancouverRulePackLinkPolicy = VANCOUVER_ZONING_DISTRICT_TO_RULE_PACKS): E85SpatialSourceAdapter {
  return {
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
          detail:
            `This adapter is verified against release(s) ${IDENTITY.supportedDatasetVersionIds.join(", ")}; the snapshot claims "${snapshot.datasetVersionId}". ` +
            `Releases are matched exactly: the City republishes this layer whenever anything in it changes, and a release nobody verified is not adapted on the strength of a similar label.`,
        };
      }
      return { supported: true };
    },

    normalize(snapshot: E85RawSpatialSourceSnapshot, dataset: E85SpatialDatasetDefinition, options?: E85SpatialNormalizationOptions): E85SpatialNormalizationResult {
      const normalizedAt = resolveE85SpatialNormalizedAt(snapshot, options);
      const crs = snapshot.declaredCrs ?? VANCOUVER_ZONING_CRS;
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
            resolutionHint:
              "Review this record against the City of Vancouver Open Data Portal to establish whether the shape is a publishing error or a form E85's topology profile does not yet cover, then either re-snapshot a corrected release or extend the profile deliberately. " +
              "E85 does not repair authoritative spatial evidence on a publisher's behalf, and does not conclude from its own refusal that the publisher is at fault.",
          },
        });
      };

      // ---- Pass 1: identity. The City's `object_id` is the only identifier
      //      this layer exposes. It is read as an identifier, never invented:
      //      a record without one is quarantined rather than given its array
      //      position, which would name a place in a payload rather than a
      //      feature in the world and would mean something different the moment
      //      the export was reordered.
      const staged: StagedRecord[] = [];
      snapshot.rawFeatures.forEach((record, index) => {
        const rawRecordRef = e85RawRecordRef(snapshot, record, index);
        const featureId = record.rawFeatureId ?? stringAttribute(record, VANCOUVER_ZONING_FIELDS.objectId);
        if (featureId === undefined) {
          const detail =
            `Record ${rawRecordRef} carries no ${VANCOUVER_ZONING_FIELDS.objectId}. It is withheld rather than given its position in the export, ` +
            `which identifies a row in one download and not a district on the ground.`;
          findings.push({
            code: "FEATURE_ID_MISSING",
            severity: "GAP",
            rawRecordRef,
            message: detail,
            gap: {
              reasonCode: "RULE_NOT_STRUCTURED",
              reason: `Record ${rawRecordRef} has no authoritative feature id, so no provenance chain can be anchored to it.`,
              sourcesChecked: [snapshot.datasetId],
              checkedAt: normalizedAt,
              resolutionHint: `Obtain a release that populates ${VANCOUVER_ZONING_FIELDS.objectId} for every record.`,
            },
          });
          quarantine(rawRecordRef, ["FEATURE_ID_MISSING"], detail, undefined, { [VANCOUVER_ZONING_FIELDS.objectId]: record.rawAttributes[VANCOUVER_ZONING_FIELDS.objectId] ?? null }, record.sourceLocator);
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
          `${group.length} records (${refs.join(", ")}) claim ${VANCOUVER_ZONING_FIELDS.objectId} "${featureId}" but differ in geometry or zoning attributes. ` +
          `Neither first nor last is chosen and the geometries are not merged: the City documents this number as unique, so one of these records contradicts that, and picking either would make the answer depend on export order while silently discarding a published boundary.`;
        findings.push({
          code: "CONFLICTING_FEATURE_ID",
          severity: "MANUAL_REVIEW",
          featureId,
          rawRecordRef: refs.join(", "),
          message: detail,
          manualReview: {
            reasonCode: "CONFLICTING_AUTHORITATIVE_SOURCES",
            explanation: detail,
            evidenceConsidered: [snapshot.datasetId],
            flaggedAt: normalizedAt,
          },
        });
        for (const entry of group) {
          quarantine(
            entry.rawRecordRef,
            ["CONFLICTING_FEATURE_ID"],
            detail,
            featureId,
            { [VANCOUVER_ZONING_FIELDS.zoningDistrict]: entry.record.rawAttributes[VANCOUVER_ZONING_FIELDS.zoningDistrict] ?? null },
            entry.record.sourceLocator,
          );
        }
      }

      // ---- Pass 3: mapping. Every stage below is an exact lookup or a refusal.
      for (const entry of accepted.sort((a, b) => byE85SpatialKey(a.featureId, b.featureId))) {
        const { featureId, record, rawRecordRef } = entry;
        const mappings: E85SpatialFieldMapping[] = [{ sourceField: VANCOUVER_ZONING_FIELDS.objectId, sourceValue: featureId, normalizedField: "featureId", normalizedValue: featureId }];

        const classification = stringAttribute(record, VANCOUVER_ZONING_FIELDS.zoningClassification);
        const featureClass: E85SpatialFeatureClass | undefined = classification === undefined ? undefined : VANCOUVER_CLASSIFICATION_TO_FEATURE_CLASS[classification];
        if (featureClass === undefined) {
          const detail =
            `Record ${rawRecordRef} (feature "${featureId}") declares ${VANCOUVER_ZONING_FIELDS.zoningClassification} ${JSON.stringify(classification ?? null)}, which has no exact mapping in this source's policy. ` +
            `It is NOT mapped to OTHER: "the City told us and it did not fit our categories" and "the City did not tell us" are different claims, and reading either as OTHER would quietly settle whether this feature competes for the base-zone slot — which is what determines whether Phase 7 later reports this ground as unzoned.`;
          findings.push({ code: "UNKNOWN_FEATURE_CLASS", severity: "GAP", featureId, rawRecordRef, ...(classification === undefined ? {} : { sourceValue: classification }), message: detail });
          quarantine(rawRecordRef, ["UNKNOWN_FEATURE_CLASS"], detail, featureId, { [VANCOUVER_ZONING_FIELDS.zoningClassification]: classification ?? null }, record.sourceLocator);
          continue;
        }
        mappings.push({ sourceField: VANCOUVER_ZONING_FIELDS.zoningClassification, sourceValue: classification as string, normalizedField: "featureClass", normalizedValue: featureClass });

        const geometry = readPolygon(record.rawGeometry, crs);
        if (geometry === undefined) {
          const detail =
            `Record ${rawRecordRef} (feature "${featureId}") carries geometry this adapter cannot read: it expects { type: "Polygon", coordinates: [ring, ...holes] } with rings of [easting, northing] pairs. ` +
            `No bounding box, centroid, label point or other substitute shape is used in its place.`;
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
            `No repair was attempted: the boundary is not reordered, snapped, simplified, closed, un-tangled or replaced, and no hole was dropped to make the shell pass. Altering a published legal boundary so it validates would substitute a shape nobody enacted.`;
          findings.push({ code: "GEOMETRY_FAILED_PHASE7_VALIDATION", severity: "GAP", featureId, rawRecordRef, message: detail });
          quarantine(rawRecordRef, ["GEOMETRY_FAILED_PHASE7_VALIDATION"], detail, featureId, { [VANCOUVER_ZONING_FIELDS.zoningDistrict]: record.rawAttributes[VANCOUVER_ZONING_FIELDS.zoningDistrict] ?? null }, record.sourceLocator);
          continue;
        }

        // ---- Rule-pack linkage. Unknown stays unknown; the feature still exists.
        const district = stringAttribute(record, VANCOUVER_ZONING_FIELDS.zoningDistrict);
        const cd1Number = stringAttribute(record, VANCOUVER_ZONING_FIELDS.cd1Number);
        const mapped = district === undefined ? undefined : rulePackLinkPolicy[district];
        const rulePackIds = mapped ?? [];
        if (mapped === undefined) {
          findings.push({
            code: "RULE_PACK_LINK_UNRESOLVED",
            severity: "GAP",
            featureId,
            rawRecordRef,
            ...(district === undefined ? {} : { sourceValue: district }),
            message:
              `Feature "${featureId}" is in ${VANCOUVER_ZONING_FIELDS.zoningDistrict} ${JSON.stringify(district ?? null)}, for which this source's policy states no rule pack. No identifier is derived from the label's spelling. ` +
              (cd1Number === undefined
                ? ""
                : `This is a CD-1 site-specific district (${VANCOUVER_ZONING_FIELDS.cd1Number} ${JSON.stringify(cd1Number)}); it is NOT linked to any shared or generic CD-1 pack, because each CD-1 is its own enacted instrument and a pack covering "CD-1 in general" would state rules no by-law contains. `) +
              `The feature is still emitted with an empty rule-pack list, because WHERE this district is remains a fact the City's layer established: suppressing it would make Phase 7 report this ground as having no base zone, which is a stronger and different claim than "we do not hold its rules".`,
            gap: {
              reasonCode: "RULE_NOT_STRUCTURED",
              reason: `Zoning district ${JSON.stringify(district ?? null)} has no registered rule pack in this source's mapping policy, so the instrument governing feature "${featureId}" is not structured.`,
              sourcesChecked: [snapshot.datasetId],
              checkedAt: normalizedAt,
              resolutionHint:
                cd1Number === undefined
                  ? "Establish which enacted instrument governs this district, normalize it into a rule pack, and state the linkage explicitly in the adapter's rule-pack link policy."
                  : "Identify the specific CD-1 by-law enacting this district, normalize that instrument into its own rule pack, and state the linkage explicitly. A CD-1 number alone does not identify an enacting by-law.",
            },
          });
        } else {
          mappings.push({ sourceField: VANCOUVER_ZONING_FIELDS.zoningDistrict, sourceValue: district as string, normalizedField: "rulePackIds", normalizedValue: rulePackIds.join(", ") });
        }

        // Carried for the audit trail only. `cd_1_number` never becomes a rule
        // pack identity and never becomes a feature identity.
        if (cd1Number !== undefined) {
          mappings.push({ sourceField: VANCOUVER_ZONING_FIELDS.cd1Number, sourceValue: cd1Number, normalizedField: "zoneDesignation", normalizedValue: district ?? "" });
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
            layerName: VANCOUVER_ZONING_DATASET_SLUG,
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
          ...(district === undefined ? {} : { zoneDesignation: district }),
        });
        audits.push({ featureId, rawRecordRef, mappings });
        findings.push({
          code: "FEATURE_NORMALIZED",
          severity: "INFO",
          featureId,
          rawRecordRef,
          ...(district === undefined ? {} : { sourceValue: district }),
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
}

/**
 * The adapter as production registers it: no rule-pack linkage, because none
 * has been established. Every feature it emits carries its geometry and an
 * explicit `RULE_PACK_LINK_UNRESOLVED` gap.
 */
export const vancouverZoningSpatialAdapter: E85SpatialSourceAdapter = createVancouverZoningSpatialAdapter();

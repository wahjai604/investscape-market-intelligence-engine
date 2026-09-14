/**
 * InvestScape™ E85 Phase 8 — synthetic raw spatial snapshot fixtures.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Entirely invented payloads from an invented publisher. Nothing is fetched, no
 * file is read, no shapefile or GeoJSON download is involved, and no real
 * municipality's schema or boundaries are described.
 *
 * The raw records deliberately look like a real export rather than like E85's
 * own types: attribute names are the publisher's, geometry is spelled the
 * publisher's way, and the identity field is not the first thing in the bag.
 * An adapter tested only against tidy input proves nothing about municipal
 * data.
 *
 *      y=150  +---------------+
 *             |  DP-OVERLAY   |         DP = (50,50) .. (150,150)
 *      y=100  +----+----------+----+    +----+
 *             | A  |          | B  |    | C  |   A = (0,0)   .. (100,100)
 *             |    |          |    |    |    |   B = (100,0) .. (200,100)
 *      y=0    +----+----------+----+    +----+   C = (200,0) .. (300,100)
 *            x=0   50   100   150  200  200  300
 *
 * C is well-formed, sits apart from the others, and carries a zone code this
 * source's policy does not map — the one feature whose LOCATION is established
 * and whose GOVERNING INSTRUMENT is not.
 *
 * Not a test file (jest matches `*.test.ts` only); imported by the Phase 8 suites.
 */
import type { E85ParcelSpatialReference, E85RawSpatialFeatureRecord, E85RawSpatialSourceSnapshot, E85SpatialSourceSystem } from "../../../src/zoning-land-use-engine";
import { REFERENCE_CRS, REFERENCE_DATASET_ID, REFERENCE_FIELDS, REFERENCE_JURISDICTION, REFERENCE_RELEASE } from "../../../src/zoning-land-use-engine/adapters/spatial/reference";

export { REFERENCE_CRS, REFERENCE_DATASET_ID, REFERENCE_FIELDS, REFERENCE_JURISDICTION, REFERENCE_RELEASE };

/** A caller-supplied normalization time, so no test depends on a clock. */
export const SNAPSHOT_RETRIEVED_AT = "2026-02-10T00:00:00.000Z";
export const NORMALIZED_AT = "2026-02-11T00:00:00.000Z";

/** A deliberately different CRS, for proving a contradiction is reported rather than resolved. */
export const OTHER_CRS = { crsId: "EPSG:4326", displayName: "Synthetic degrees", declaredBy: "fixture", units: "degree" };

/** The publisher's polygon spelling: a GeoJSON-style ring of [x, y] pairs. */
export function rawPolygon(ring: readonly (readonly [number, number])[], ...holes: readonly (readonly (readonly [number, number])[])[]): unknown {
  return { type: "Polygon", coordinates: [ring.map((p) => [p[0], p[1]]), ...holes.map((h) => h.map((p) => [p[0], p[1]]))] };
}

/** An axis-aligned rectangle in the publisher's spelling, unclosed. */
export function rawRect(minX: number, minY: number, maxX: number, maxY: number): unknown {
  return rawPolygon([
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
  ]);
}

/** A self-intersecting exterior — the bow-tie Phase 7's topology gate exists to refuse. */
export function rawBowTie(): unknown {
  return rawPolygon([
    [0, 0],
    [100, 100],
    [0, 100],
    [100, 0],
  ]);
}

/** A polygon whose hole escapes its shell — malformed in a different way than the bow-tie. */
export function rawEscapedHole(): unknown {
  return rawPolygon(
    [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ],
    [
      [200, 200],
      [220, 200],
      [220, 220],
      [200, 220],
    ],
  );
}

export interface RawRecordSpec {
  featureRef?: string;
  zoneCode?: string;
  layerKind?: string;
  geometry?: unknown;
  objectRef?: number;
  sourceLocator?: string;
  /** Extra publisher attributes, to prove unmapped fields are carried without being interpreted. */
  extra?: Readonly<Record<string, unknown>>;
}

/** Builds a raw record in the publisher's own shape. Only stated fields appear — an absent id is genuinely absent. */
export function rawRecord(spec: RawRecordSpec): E85RawSpatialFeatureRecord {
  const attributes: Record<string, unknown> = { ...(spec.extra ?? {}) };
  if (spec.featureRef !== undefined) attributes[REFERENCE_FIELDS.featureId] = spec.featureRef;
  if (spec.zoneCode !== undefined) attributes[REFERENCE_FIELDS.zoneCode] = spec.zoneCode;
  if (spec.layerKind !== undefined) attributes[REFERENCE_FIELDS.layerKind] = spec.layerKind;
  if (spec.objectRef !== undefined) attributes[REFERENCE_FIELDS.objectRef] = spec.objectRef;
  return {
    rawAttributes: attributes,
    ...(spec.geometry === undefined ? {} : { rawGeometry: spec.geometry }),
    ...(spec.sourceLocator === undefined ? {} : { sourceLocator: spec.sourceLocator }),
  };
}

/** Base zone A, activating pack "refburgh-rb-1". */
export const RECORD_A = (): E85RawSpatialFeatureRecord =>
  rawRecord({ featureRef: "zone-a", zoneCode: "RB-1", layerKind: "BASE", geometry: rawRect(0, 0, 100, 100), objectRef: 4001, sourceLocator: "layer://zoning/4001" });

/** Base zone B, activating pack "refburgh-rb-2". */
export const RECORD_B = (): E85RawSpatialFeatureRecord => rawRecord({ featureRef: "zone-b", zoneCode: "RB-2", layerKind: "BASE", geometry: rawRect(100, 0, 200, 100), objectRef: 4002 });

/** A development-permit overlay straddling both base zones. */
export const RECORD_OVERLAY = (): E85RawSpatialFeatureRecord =>
  rawRecord({ featureRef: "dp-1", zoneCode: "DP-OVERLAY", layerKind: "OVERLAY", geometry: rawRect(50, 50, 150, 150), objectRef: 4003 });

/** A record whose exterior crosses itself. Must be quarantined, never repaired. */
export const RECORD_BOWTIE = (): E85RawSpatialFeatureRecord => rawRecord({ featureRef: "zone-bad", zoneCode: "RB-1", layerKind: "BASE", geometry: rawBowTie(), objectRef: 4004 });

/** A record with no authoritative feature identifier — only the publisher's internal record number. */
export const RECORD_NO_ID = (): E85RawSpatialFeatureRecord => rawRecord({ zoneCode: "RB-1", layerKind: "BASE", geometry: rawRect(0, 0, 10, 10), objectRef: 4005 });

/** A record whose layer kind this source's policy does not map. */
export const RECORD_UNKNOWN_CLASS = (): E85RawSpatialFeatureRecord =>
  rawRecord({ featureRef: "mystery-1", zoneCode: "RB-1", layerKind: "FLOODPLAIN_STUDY_AREA", geometry: rawRect(0, 0, 10, 10), objectRef: 4006 });

/** A record whose zone code has no registered rule-pack mapping. Geometry is fine; what governs it is unknown. */
export const RECORD_UNMAPPED_ZONE = (): E85RawSpatialFeatureRecord =>
  rawRecord({ featureRef: "zone-c", zoneCode: "RB-3", layerKind: "BASE", geometry: rawRect(200, 0, 300, 100), objectRef: 4007 });

/** A record whose geometry is in a shape this adapter does not read. */
export const RECORD_UNREADABLE_GEOMETRY = (): E85RawSpatialFeatureRecord =>
  rawRecord({ featureRef: "zone-weird", zoneCode: "RB-1", layerKind: "BASE", geometry: { type: "MultiPolygon", coordinates: [] }, objectRef: 4008 });

export interface SnapshotSpec {
  records: readonly E85RawSpatialFeatureRecord[];
  snapshotId?: string;
  datasetId?: string;
  datasetVersionId?: string;
  jurisdictionId?: string;
  sourceSystem?: E85SpatialSourceSystem;
  /** The literal sentinel avoids the default-parameter trap: passing `undefined` would silently select the declared default. */
  crs?: "DECLARED" | "ABSENT" | "OTHER";
  retrievedAt?: string;
}

/** Builds a snapshot from a terse spec, so each test states only what it varies. */
export function snapshot(spec: SnapshotSpec): E85RawSpatialSourceSnapshot {
  const crs = spec.crs === "ABSENT" ? undefined : spec.crs === "OTHER" ? OTHER_CRS : REFERENCE_CRS;
  return {
    snapshotId: spec.snapshotId ?? "snap-1",
    datasetId: spec.datasetId ?? REFERENCE_DATASET_ID,
    datasetVersionId: spec.datasetVersionId ?? REFERENCE_RELEASE,
    jurisdictionId: spec.jurisdictionId ?? REFERENCE_JURISDICTION,
    sourceSystem: spec.sourceSystem ?? "GEOJSON",
    sourceLocator: "export://refburgh/zoning-districts/2026-Q1",
    retrievedAt: spec.retrievedAt ?? SNAPSHOT_RETRIEVED_AT,
    ...(crs === undefined ? {} : { declaredCrs: crs }),
    rawFeatures: spec.records,
    sourceMetadata: { recordCount: spec.records.length, layer: "zoning-districts" },
  };
}

/** The ordinary three-record snapshot: two base zones and one overlay, all well-formed. */
export const STANDARD_SNAPSHOT = (): E85RawSpatialSourceSnapshot => snapshot({ records: [RECORD_A(), RECORD_B(), RECORD_OVERLAY()] });

/** A parcel wholly inside base zone A and clear of the overlay. */
export function refburghParcel(geometry: E85ParcelSpatialReference["geometry"], parcelReferenceId = "refburgh-parcel-1"): E85ParcelSpatialReference {
  return { parcelReferenceId, ...(geometry === undefined ? {} : { geometry }) };
}

export const PARCEL_IN_RB_A = (): E85ParcelSpatialReference =>
  refburghParcel({
    type: "POLYGON",
    crs: REFERENCE_CRS,
    exterior: [
      [20, 20],
      [40, 20],
      [40, 40],
      [20, 40],
    ],
  });

/** A parcel inside base zone A and inside the overlay. */
export const PARCEL_IN_RB_A_AND_OVERLAY = (): E85ParcelSpatialReference =>
  refburghParcel({
    type: "POLYGON",
    crs: REFERENCE_CRS,
    exterior: [
      [60, 60],
      [80, 60],
      [80, 80],
      [60, 80],
    ],
  });

/**
 * A parcel wholly inside zone C — the base zone whose code no rule pack maps.
 *
 * Synthetic test-only evidence, and it exists so the linkage-safety suites can
 * ask the question the other parcels cannot: what does the pipeline say when
 * geometry settles WHERE a parcel is, completely and unambiguously, and the
 * source's own policy cannot say WHAT governs it? Note which side was moved to
 * make this case reachable. The parcel is invented; `RECORD_UNMAPPED_ZONE`
 * keeps the coordinates it already had, because relocating a published boundary
 * for a test's convenience is the one thing this whole phase exists to refuse.
 */
export const PARCEL_IN_UNMAPPED_RB_C = (): E85ParcelSpatialReference =>
  refburghParcel(
    {
      type: "POLYGON",
      crs: REFERENCE_CRS,
      exterior: [
        [220, 20],
        [240, 20],
        [240, 40],
        [220, 40],
      ],
    },
    "refburgh-parcel-c",
  );

/** Recursively freezes an object graph, so any attempt to mutate an input throws in strict mode. */
export function deepFreezeSnapshot<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.getOwnPropertyNames(value)) deepFreezeSnapshot((value as Record<string, unknown>)[key]);
  return value;
}

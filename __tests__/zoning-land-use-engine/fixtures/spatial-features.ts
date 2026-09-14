/**
 * InvestScape™ E85 Phase 7 — synthetic spatial fixtures.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Entirely invented coordinates in an invented jurisdiction. Nothing here is
 * fetched, nothing describes a real municipality's boundaries, and no
 * shapefile, GeoJSON download or GIS service is involved.
 *
 * The layout is a deliberately boring grid, because the interesting cases are
 * the relationships between the shapes rather than the shapes themselves:
 *
 *      y=15  +---------------+
 *            |   OVERLAY X   |            X = (5,5) .. (15,15)
 *      y=10  +----+----------+----+
 *            | A  |////|     | B  |        A = (0,0)  .. (10,10)
 *            |    |////|     |    |        B = (10,0) .. (20,10)
 *      y=0   +----+----------+----+
 *           x=0   5    10    15   20
 *
 * A and B are adjacent base zones sharing the line x=10 — the arrangement that
 * makes split-parcel and boundary-touch cases natural rather than contrived.
 *
 * Not a test file (jest matches `*.test.ts` only); imported by the Phase 7 suites.
 */
import type {
  E85Crs,
  E85ParcelSpatialReference,
  E85PolygonGeometry,
  E85PointGeometry,
  E85Position,
  E85RegulatorySpatialFeature,
  E85SpatialDatasetDefinition,
  E85SpatialFeatureClass,
  E85SpatialProvenance,
} from "../../../src/zoning-land-use-engine";

export const JURISDICTION = "xx-yy-testburgh";
export const RESOLVED_AT = "2026-09-01T00:00:00.000Z";
export const DATASET_VERSION = "2026-06";

/** The working CRS for every fixture unless a test deliberately introduces a second one. */
export const CRS: E85Crs = { crsId: "EPSG:26910", displayName: "Synthetic projected metres", declaredBy: "fixture", units: "metre" };
/** A deliberately different CRS, for proving comparison is refused rather than assumed. */
export const OTHER_CRS: E85Crs = { crsId: "EPSG:4326", displayName: "Synthetic degrees", declaredBy: "fixture", units: "degree" };

export const BASE_DATASET = `${JURISDICTION}:zoning-districts`;
export const OVERLAY_DATASET = `${JURISDICTION}:overlay-areas`;

/** An axis-aligned rectangle, written counter-clockwise and left unclosed — the closure convention is what makes that legal. */
export function square(minX: number, minY: number, maxX: number, maxY: number, crs: E85Crs = CRS): E85PolygonGeometry {
  return {
    type: "POLYGON",
    crs,
    exterior: [
      [minX, minY],
      [maxX, minY],
      [maxX, maxY],
      [minX, maxY],
    ],
  };
}

/** The same rectangle wound the other way and explicitly closed, for proving orientation and closure do not change the answer. */
export function squareReversedClosed(minX: number, minY: number, maxX: number, maxY: number, crs: E85Crs = CRS): E85PolygonGeometry {
  return {
    type: "POLYGON",
    crs,
    exterior: [
      [minX, minY],
      [minX, maxY],
      [maxX, maxY],
      [maxX, minY],
      [minX, minY],
    ],
  };
}

export function point(x: number, y: number, crs: E85Crs = CRS): E85PointGeometry {
  return { type: "POINT", crs, coordinates: [x, y] };
}

/** A polygon from an explicit exterior ring and any interior rings, for topology cases the rectangle helpers cannot express. */
export function polygon(exterior: readonly E85Position[], interiors?: readonly (readonly E85Position[])[], crs: E85Crs = CRS): E85PolygonGeometry {
  return { type: "POLYGON", crs, exterior, ...(interiors === undefined ? {} : { interiors }) };
}

/** The corner positions of a rectangle, counter-clockwise and unclosed — the raw ring behind `square`, for composing polygons with holes. */
export function ring(minX: number, minY: number, maxX: number, maxY: number): readonly E85Position[] {
  return [
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
  ];
}

// ---------------------------------------------------------------------------
// Malformed topology. Every one of these is a shape whose relationship to
// another shape has no defined answer, which is exactly why Phase 7 must refuse
// to compute one rather than return whichever number the arithmetic produces.
// ---------------------------------------------------------------------------

/** The classic bow-tie: opposite edges cross at the centre, so the ring encloses two lobes of opposite winding and "inside" has no single meaning. */
export const BOW_TIE = (crs: E85Crs = CRS): E85PolygonGeometry =>
  polygon(
    [
      [0, 0],
      [10, 10],
      [0, 10],
      [10, 0],
    ],
    undefined,
    crs,
  );

/** A different non-adjacent crossing: a vertex pushed back out through the far edge, rather than two edges swapped. Proves the check is general, not a bow-tie special case. */
export const SPIKE_RING = (): E85PolygonGeometry =>
  polygon([
    [0, 0],
    [10, 0],
    [10, 10],
    [-5, 5],
    [0, 10],
  ]);

/** A ring that returns to an earlier vertex without crossing anything — a figure-eight pinched to a point. Touching, not crossing, and still outside the supported profile. */
export const PINCHED_RING = (): E85PolygonGeometry =>
  polygon([
    [0, 0],
    [10, 0],
    [5, 5],
    [10, 10],
    [0, 10],
    [5, 5],
  ]);

/** A well-formed square with a well-formed hole strictly inside it — the case that must keep working. */
export const HOLED_SQUARE = (): E85PolygonGeometry => polygon(ring(0, 0, 10, 10), [ring(3, 3, 6, 6)]);

/** A hole that crosses itself. */
export const SELF_INTERSECTING_HOLE = (): E85PolygonGeometry =>
  polygon(ring(0, 0, 10, 10), [
    [
      [3, 3],
      [6, 6],
      [3, 6],
      [6, 3],
    ],
  ]);

/** A hole lying entirely outside the shell it claims to perforate. */
export const HOLE_OUTSIDE_EXTERIOR = (): E85PolygonGeometry => polygon(ring(0, 0, 10, 10), [ring(20, 20, 22, 22)]);

/** A hole straddling the shell boundary, so part of it is outside the polygon it is meant to be a hole in. */
export const HOLE_CROSSING_EXTERIOR = (): E85PolygonGeometry => polygon(ring(0, 0, 10, 10), [ring(8, 8, 12, 12)]);

/** Two holes whose boundaries cross, so whether the shared region is solid or void depends on a fill rule nobody stated. */
export const CROSSING_HOLES = (): E85PolygonGeometry => polygon(ring(0, 0, 10, 10), [ring(2, 2, 5, 5), ring(4, 4, 7, 7)]);

/** A hole inside another hole. Nothing crosses; the reading is simply undefined. */
export const NESTED_HOLES = (): E85PolygonGeometry => polygon(ring(0, 0, 10, 10), [ring(2, 2, 8, 8), ring(3, 3, 4, 4)]);

/** Zone A — the left-hand base zone. */
export const ZONE_A = (): E85PolygonGeometry => square(0, 0, 10, 10);
/** Zone B — the right-hand base zone, sharing the line x=10 with A. */
export const ZONE_B = (): E85PolygonGeometry => square(10, 0, 20, 10);
/** Overlay X — straddles A and B and extends above both. */
export const OVERLAY_X = (): E85PolygonGeometry => square(5, 5, 15, 15);

export interface FeatureSpec {
  featureId: string;
  geometry: E85PolygonGeometry | E85PointGeometry;
  rulePackIds: readonly string[];
  featureClass?: E85SpatialFeatureClass;
  datasetId?: string;
  datasetVersionId?: string;
  zoneDesignation?: string;
  /** Applies an unknown legal effective date. The literal sentinel avoids the default-parameter trap: passing `undefined` would silently select the dated default. */
  temporal?: "UNKNOWN" | "KNOWN";
  observedAt?: string;
}

export function provenance(spec: { datasetId: string; datasetVersionId: string; featureId: string; observedAt?: string; crsOverride?: E85Crs }): E85SpatialProvenance {
  return {
    datasetId: spec.datasetId,
    datasetVersionId: spec.datasetVersionId,
    featureId: spec.featureId,
    layerName: "districts",
    publisher: "Testburgh Open Data",
    jurisdictionId: JURISDICTION,
    crs: spec.crsOverride ?? CRS,
    ...(spec.observedAt === undefined ? {} : { observedAt: spec.observedAt }),
  };
}

/** Builds a regulatory feature from a terse spec, so each test states only what it varies. */
export function feature(spec: FeatureSpec): E85RegulatorySpatialFeature {
  const featureClass = spec.featureClass ?? "BASE_ZONE";
  const datasetId = spec.datasetId ?? (featureClass === "BASE_ZONE" ? BASE_DATASET : OVERLAY_DATASET);
  const datasetVersionId = spec.datasetVersionId ?? DATASET_VERSION;
  return {
    featureId: spec.featureId,
    datasetId,
    datasetVersionId,
    jurisdictionId: JURISDICTION,
    geometry: spec.geometry,
    rulePackIds: [...spec.rulePackIds],
    featureClass,
    provenance: provenance({ datasetId, datasetVersionId, featureId: spec.featureId, observedAt: spec.observedAt, crsOverride: spec.geometry.crs }),
    temporal: spec.temporal === "UNKNOWN" ? { effectiveDateBasis: "UNKNOWN" } : { effectiveFrom: "2024-01-01", effectiveDateBasis: "SOURCE_STATED" },
    ...(spec.zoneDesignation === undefined ? {} : { zoneDesignation: spec.zoneDesignation }),
  };
}

/** Zone A as a base-zone feature activating pack "base-a". */
export const FEATURE_A = (): E85RegulatorySpatialFeature => feature({ featureId: "zone-a", geometry: ZONE_A(), rulePackIds: ["base-a"], zoneDesignation: "TB-1" });
/** Zone B as a base-zone feature activating pack "base-b". */
export const FEATURE_B = (): E85RegulatorySpatialFeature => feature({ featureId: "zone-b", geometry: ZONE_B(), rulePackIds: ["base-b"], zoneDesignation: "TB-2" });
/** Overlay X as a non-exclusive feature activating pack "overlay-x". */
export const FEATURE_OVERLAY = (): E85RegulatorySpatialFeature =>
  feature({ featureId: "overlay-x", geometry: OVERLAY_X(), rulePackIds: ["overlay-x"], featureClass: "OVERLAY", zoneDesignation: "DPA-1" });

export function parcel(geometry: E85ParcelSpatialReference["geometry"], parcelReferenceId = "parcel-1"): E85ParcelSpatialReference {
  return {
    parcelReferenceId,
    ...(geometry === undefined ? {} : { geometry }),
    provenance: provenance({ datasetId: `${JURISDICTION}:parcel-fabric`, datasetVersionId: DATASET_VERSION, featureId: parcelReferenceId, crsOverride: geometry?.crs }),
  };
}

/** Wholly inside zone A, clear of every boundary. */
export const PARCEL_IN_A = (): E85ParcelSpatialReference => parcel(square(2, 2, 4, 4));
/** Wholly inside zone B. */
export const PARCEL_IN_B = (): E85ParcelSpatialReference => parcel(square(12, 2, 14, 4));
/** Straddles the A/B line at x=10 — the split-parcel case. */
export const PARCEL_SPLIT = (): E85ParcelSpatialReference => parcel(square(8, 2, 12, 4));
/** Inside zone A and inside overlay X. */
export const PARCEL_IN_A_AND_OVERLAY = (): E85ParcelSpatialReference => parcel(square(6, 6, 8, 8));
/** Inside B, with its left edge lying exactly on A's right edge — touches A, contained by B. */
export const PARCEL_TOUCHING_A = (): E85ParcelSpatialReference => parcel(square(10, 2, 12, 4));
/** Beyond every supplied feature. */
export const PARCEL_OUTSIDE = (): E85ParcelSpatialReference => parcel(square(30, 30, 32, 32));

export interface DatasetSpec {
  datasetId: string;
  datasetType?: E85SpatialDatasetDefinition["datasetType"];
  versionIds?: readonly string[];
  accessStatus?: E85SpatialDatasetDefinition["accessStatus"];
  licenseStatus?: E85SpatialDatasetDefinition["licenseStatus"];
  crs?: E85Crs;
}

export function dataset(spec: DatasetSpec): E85SpatialDatasetDefinition {
  return {
    datasetId: spec.datasetId,
    displayName: `Testburgh ${spec.datasetId}`,
    publisher: "Testburgh Open Data",
    jurisdictionId: JURISDICTION,
    datasetType: spec.datasetType ?? "BASE_ZONING",
    versions: (spec.versionIds ?? [DATASET_VERSION]).map((versionId) => ({
      versionId,
      publishedDate: "2026-06-15",
      observedAt: RESOLVED_AT,
      effectiveDateBasis: "UNKNOWN" as const,
    })),
    crs: spec.crs ?? CRS,
    accessStatus: spec.accessStatus ?? "AVAILABLE",
    licenseStatus: spec.licenseStatus ?? "PUBLIC_REUSE",
    supportedGeometryTypes: ["POLYGON"],
    knownLimitations: [],
  };
}

/** The two datasets the fixtures draw from, both registered at the standard release. */
export const STANDARD_DATASETS = (): readonly E85SpatialDatasetDefinition[] => [
  dataset({ datasetId: BASE_DATASET }),
  dataset({ datasetId: OVERLAY_DATASET, datasetType: "OVERLAY" }),
];

/** Recursively freezes an object graph, so any attempt to mutate an input throws in strict mode. */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.getOwnPropertyNames(value)) deepFreeze((value as Record<string, unknown>)[key]);
  return value;
}

/** A position, for tests that need to name one inline without repeating the tuple cast. */
export function pos(x: number, y: number): E85Position {
  return [x, y];
}

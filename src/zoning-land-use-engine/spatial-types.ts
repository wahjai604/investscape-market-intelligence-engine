/**
 * InvestScape™ E85 Phase 7 — Spatial Applicability: geometry & CRS contracts.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * The minimum deterministic geometry needed to answer one question — "which
 * regulatory instruments spatially apply to this parcel?" — and deliberately
 * nothing more. This is not a GIS library and must not grow into one: no
 * projections, no transforms, no buffering, no topology repair, no raster, no
 * geodesic area. Those belong to an acquisition/GIS layer outside E85.
 *
 * TWO RULES GOVERN THIS FILE.
 *
 * First, A COORDINATE PAIR MEANS NOTHING WITHOUT ITS CRS. `[10, 20]` is a
 * different place on Earth in every coordinate system, so every geometry here
 * carries its own `crs` and comparison requires an exact match. There is no
 * EPSG alias table, no "they're probably both WGS84" fallback, and no
 * transform: silently reprojecting is how a parcel ends up in the wrong
 * country, and guessing that two systems agree is the same fabrication Phase 5A
 * removed from the temporal contract.
 *
 * Second, TOLERANCE IS DECLARED ONCE. `E85_DEFAULT_SPATIAL_TOLERANCE` is the
 * single epsilon in Phase 7, expressed as a DISTANCE IN THE CRS'S OWN UNITS so
 * it has a meaning a reviewer can check, and overridable per call. Scattering
 * bare `1e-9` literals through geometry predicates hides the one decision that
 * actually determines whether a parcel sits on a boundary or inside it.
 */

/**
 * A coordinate reference system identifier, compared as an EXACT string.
 *
 * Deliberately opaque: E85 does not parse, canonicalize or alias these. Two
 * spellings of the same system ("EPSG:4326" and "urn:ogc:def:crs:EPSG::4326")
 * are treated as different, which errs toward refusing a comparison rather
 * than assuming one — the safe direction when the alternative is a silently
 * wrong location.
 */
export type E85CrsId = string;

/**
 * A declared coordinate reference system, with provenance for where the
 * declaration came from.
 *
 * `declaredBy` matters because a CRS is usually an assertion by whoever
 * published the dataset, not an intrinsic property of the numbers. Recording
 * who said so lets a reviewer weigh "the publisher's own metadata states
 * EPSG:26910" differently from "the caller assumed EPSG:26910".
 */
export interface E85Crs {
  crsId: E85CrsId;
  /** Human-readable name, e.g. "NAD83 / UTM zone 10N". Never used for matching. */
  displayName?: string;
  /** Where this CRS declaration came from, e.g. "dataset metadata", "caller-supplied". Never inferred from the coordinates themselves. */
  declaredBy?: string;
  /** Units of the coordinate axes, e.g. "metre", "degree". Recorded so a tolerance in coordinate units can be interpreted; never used to convert. */
  units?: string;
}

/** A single position. Exactly two ordinates — Phase 7 is 2D only; elevation is out of scope and must not be silently dropped from a 3D input, so 3D geometry is rejected at validation rather than flattened. */
export type E85Position = readonly [number, number];

/**
 * An ordered sequence of positions forming one ring of a polygon.
 *
 * RING CLOSURE POLICY — the one normalization Phase 7 performs, stated once
 * and applied everywhere: a ring is treated as IMPLICITLY CLOSED. The segment
 * from the last position back to the first is always part of the ring, whether
 * or not the source repeats the first position at the end. Both spellings are
 * accepted and produce identical results, because GeoJSON-style exporters
 * repeat the closing point and shapefile-style ones often do not — rejecting
 * either would reject real authoritative data for a formatting convention.
 * Nothing else about a ring is repaired: winding is not corrected,
 * self-intersections are not fixed, and duplicate interior vertices are not
 * removed.
 */
export type E85LinearRing = readonly E85Position[];

export type E85GeometryType = "POINT" | "POLYGON";

interface E85GeometryBase {
  crs: E85Crs;
  /** Stable identifier for this geometry within its dataset, when the source assigns one. Identity, not a position. */
  geometryId?: string;
}

export interface E85PointGeometry extends E85GeometryBase {
  type: "POINT";
  coordinates: E85Position;
}

export interface E85PolygonGeometry extends E85GeometryBase {
  type: "POLYGON";
  /** The outer boundary. Orientation (clockwise or counter-clockwise) is not significant — see `geometry-relations.ts`, which is orientation-agnostic by construction. */
  exterior: E85LinearRing;
  /** Holes. Omitted or empty when the polygon is solid. A position inside an interior ring is OUTSIDE the polygon. */
  interiors?: readonly E85LinearRing[];
}

export type E85Geometry = E85PointGeometry | E85PolygonGeometry;

/**
 * The single spatial tolerance in Phase 7, as a DISTANCE IN THE CRS'S OWN
 * COORDINATE UNITS.
 *
 * Used in exactly one predicate — whether a position lies ON a segment — which
 * is the only place floating-point noise can flip a boundary case into an
 * interior or exterior one. Orientation tests elsewhere use exact signs, so
 * this value cannot quietly widen an overlap.
 *
 * The default is deliberately tiny. It exists to absorb representation error
 * in coordinates that are mathematically on a line (the result of a projection
 * or a round-trip through text), NOT to declare a real-world snapping distance.
 * A caller working in degrees, or one who wants "within 1cm counts as on the
 * line", must say so explicitly via `E85SpatialTolerance` — Phase 7 will not
 * pick a snapping distance on a jurisdiction's behalf, because how close counts
 * as touching a zone boundary is a legal question, not a numerical one.
 */
export const E85_DEFAULT_SPATIAL_TOLERANCE = 1e-9;

/** Caller-overridable tolerance. Optional everywhere; the default applies when omitted. */
export interface E85SpatialTolerance {
  /** Distance in the CRS's coordinate units within which a position counts as lying on a segment. Must be finite and >= 0. */
  onSegmentDistance?: number;
}

/** Resolves the tolerance actually in force, so no call site repeats the default. */
export function resolveE85Tolerance(tolerance: E85SpatialTolerance | undefined): number {
  const value = tolerance?.onSegmentDistance;
  if (value === undefined || !Number.isFinite(value) || value < 0) return E85_DEFAULT_SPATIAL_TOLERANCE;
  return value;
}

/**
 * Whether two CRS declarations may be compared, by EXACT identifier match.
 *
 * No aliasing, no case folding, no authority/code parsing. If this returns
 * false the correct action is to refuse the comparison and record a gap —
 * never to transform, and never to proceed on the assumption that the numbers
 * are probably compatible.
 */
export function e85CrsMatches(a: E85Crs | undefined, b: E85Crs | undefined): boolean {
  if (a === undefined || b === undefined) return false;
  return a.crsId === b.crsId;
}

/** Every ring of a polygon — exterior plus any interiors — for validation and iteration. */
export function e85PolygonRings(polygon: E85PolygonGeometry): readonly E85LinearRing[] {
  return [polygon.exterior, ...(polygon.interiors ?? [])];
}

/**
 * A ring with any repeated closing position dropped, so every ring is handled
 * in one canonical form. Segments are then taken cyclically, which is what
 * makes the implicit-closure policy above true in code rather than in prose.
 */
export function e85CanonicalRing(ring: E85LinearRing): readonly E85Position[] {
  if (ring.length < 2) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring.slice(0, -1);
  return ring;
}

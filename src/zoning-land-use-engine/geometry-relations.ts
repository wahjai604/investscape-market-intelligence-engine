/**
 * InvestScape™ E85 Phase 7 — Spatial Applicability: geometric relationships.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Pure geometry. Nothing here knows what a zone is, which dataset a shape came
 * from, or what any of it means legally — it answers "how do these two shapes
 * sit relative to each other?" and stops. Keeping that boundary sharp is what
 * lets the applicability layer above it be audited separately from the
 * arithmetic below it.
 *
 * THE DISTINCTION THIS FILE EXISTS TO PRESERVE: touching is not overlapping.
 * A parcel abutting a zone boundary and a parcel lying inside that zone are
 * different regulatory situations with different answers, and a predicate that
 * returns a boolean `intersects` collapses them. Every relation below therefore
 * separates positive-area overlap from mere boundary contact, and BOUNDARY_TOUCH
 * is a first-class outcome rather than a rounding decision. What that contact
 * MEANS is not decided here — see spatial-applicability.ts.
 *
 * SCOPE — THE SUPPORTED POLYGON PROFILE. These predicates are defined for simple
 * (non-self-intersecting) rings with strictly-contained, mutually-disjoint
 * holes, which is what authoritative zoning layers publish. They use vertex
 * classification, edge-midpoint sampling and proper-crossing detection rather
 * than full polygon clipping: within that profile, two interiors cannot overlap
 * without either a vertex falling inside the other shape or their boundaries
 * properly crossing, so no overlap can escape detection.
 *
 * Outside that profile the arithmetic has no defined meaning, so EVERY PUBLIC
 * ENTRY POINT BELOW VALIDATES FIRST and returns UNDETERMINED rather than a
 * number nobody can justify. That guard is the difference between a documented
 * assumption and an enforced one; `validateE85GeometryShape` is the single
 * definition of the profile, so the gate and the arithmetic can never disagree
 * about what is supported.
 *
 * ORIENTATION-AGNOSTIC BY CONSTRUCTION. Ring winding never appears below:
 * containment comes from a crossing count and boundary contact from a distance,
 * neither of which has a sign. Clockwise and counter-clockwise spellings of one
 * shape are therefore the same shape here, with no normalization pass to get
 * wrong.
 */
import type { E85Geometry, E85PointGeometry, E85PolygonGeometry, E85Position, E85SpatialTolerance } from "./spatial-types";
import { e85CanonicalRing, resolveE85Tolerance } from "./spatial-types";
import { e85DistanceSquared, e85PointOnRing, e85ProperlyCrosses, e85RingSegments, e85RingWindsAround, type E85Segment } from "./geometry-primitives";
import { validateE85GeometryShape } from "./geometry-validation";

/**
 * Where a position sits relative to a shape. BOUNDARY is deliberately its own
 * answer and never folded into INTERIOR or EXTERIOR — which of the two it would
 * be folded into is precisely the question a boundary case cannot answer.
 *
 * UNDETERMINED means the polygon is outside the supported profile, so the
 * question has no defined answer. It is NOT a synonym for EXTERIOR: "this shape
 * cannot be measured" and "the point is outside it" are different facts.
 */
export type E85PointLocation = "INTERIOR" | "BOUNDARY" | "EXTERIOR" | "UNDETERMINED";

/** The three answers available once a polygon is known to be within the supported profile. */
type E85DefinedPointLocation = "INTERIOR" | "BOUNDARY" | "EXTERIOR";

/**
 * How a regulatory feature's geometry relates to a parcel's geometry. Read as
 * "the feature ___ the parcel".
 *
 * These are GEOMETRIC facts only. None of them means "applies" — mapping a
 * relationship to legal applicability is an explicit, separate policy in
 * spatial-applicability.ts, because whether abutting a zone boundary makes that
 * zone's rules apply is a legal question this file has no standing to answer.
 */
export type E85SpatialRelation =
  /** The feature fully covers the parcel: every part of the parcel lies within the feature (its boundary included). */
  | "CONTAINS"
  /** The feature and the parcel share positive area, but the parcel is not wholly inside the feature. The split-parcel case. */
  | "INTERSECTS"
  /** The shapes make contact along a boundary or at a vertex, but share no area whatsoever. */
  | "BOUNDARY_TOUCH"
  /** The shapes share no point at all. */
  | "DISJOINT"
  /** The relationship could not be computed — mismatched CRS, invalid or unsupported geometry. Never a synonym for DISJOINT: "we could not tell" and "they do not touch" send a reviewer to different places. */
  | "UNDETERMINED";

/** Whether a geometry is within the profile the predicates below are defined for. */
function isSupported(geometry: E85Geometry): boolean {
  return validateE85GeometryShape(geometry).valid;
}

/**
 * Locates a position relative to a polygon already known to be supported.
 *
 * Boundary is tested first and wins outright: a position lying on a hole's edge
 * is ON the polygon's boundary, not inside the hole and not inside the solid.
 * A position strictly within a hole is EXTERIOR — a hole is not part of the
 * polygon, and reporting it as interior would place a parcel inside a zone the
 * zone explicitly excludes.
 */
function locateUnchecked(point: E85Position, polygon: E85PolygonGeometry, tol: number): E85DefinedPointLocation {
  if (e85PointOnRing(point, polygon.exterior, tol)) return "BOUNDARY";
  for (const hole of polygon.interiors ?? []) {
    if (e85PointOnRing(point, hole, tol)) return "BOUNDARY";
  }
  if (!e85RingWindsAround(point, polygon.exterior)) return "EXTERIOR";
  for (const hole of polygon.interiors ?? []) {
    if (e85RingWindsAround(point, hole)) return "EXTERIOR";
  }
  return "INTERIOR";
}

/**
 * Locates a position relative to a polygon.
 *
 * Validates the polygon first: asking where a point sits relative to a bow-tie
 * has no defined answer, and a ray-casting count would still return one.
 */
export function e85LocatePointInPolygon(point: E85Position, polygon: E85PolygonGeometry, tolerance?: E85SpatialTolerance): E85PointLocation {
  if (!isSupported(polygon)) return "UNDETERMINED";
  return locateUnchecked(point, polygon, resolveE85Tolerance(tolerance));
}

function polygonSegments(polygon: E85PolygonGeometry): readonly E85Segment[] {
  return [polygon.exterior, ...(polygon.interiors ?? [])].flatMap((ring) => e85RingSegments(ring));
}

function midpoint(a: E85Position, b: E85Position): E85Position {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function ringPositions(polygon: E85PolygonGeometry): readonly E85Position[] {
  return [polygon.exterior, ...(polygon.interiors ?? [])].flatMap((ring) => [...e85CanonicalRing(ring)]);
}

/**
 * The relation between two polygons already known to be supported.
 *
 * The order of the checks is the argument:
 *   1. No contact at all → DISJOINT.
 *   2. Every part of the parcel inside the feature → CONTAINS.
 *   3. Any genuinely shared area → INTERSECTS.
 *   4. Contact but no shared area → BOUNDARY_TOUCH.
 * Step 4 is reachable only after 2 and 3 have both declined, which is what
 * guarantees a touching parcel is never reported as a contained one.
 */
function polygonRelationUnchecked(feature: E85PolygonGeometry, parcel: E85PolygonGeometry, tol: number): E85SpatialRelation {
  const parcelVertexLocations = ringPositions(parcel).map((v) => locateUnchecked(v, feature, tol));
  const featureVertexLocations = ringPositions(feature).map((v) => locateUnchecked(v, parcel, tol));

  const featureSegments = polygonSegments(feature);
  const parcelSegments = polygonSegments(parcel);
  const anyProperCrossing = featureSegments.some(([a, b]) => parcelSegments.some(([c, d]) => e85ProperlyCrosses(a, b, c, d)));

  const anyContact = anyProperCrossing || parcelVertexLocations.some((l) => l !== "EXTERIOR") || featureVertexLocations.some((l) => l !== "EXTERIOR");
  if (!anyContact) return "DISJOINT";

  // Edge midpoints guard the concave case: a parcel whose vertices all sit on a
  // concave feature's boundary can still bulge across the notch between them.
  const parcelEdgeMidpointsInside = parcelSegments.every(([a, b]) => locateUnchecked(midpoint(a, b), feature, tol) !== "EXTERIOR");
  const contains = !anyProperCrossing && parcelVertexLocations.every((l) => l !== "EXTERIOR") && parcelEdgeMidpointsInside;
  if (contains) return "CONTAINS";

  const positiveOverlap = anyProperCrossing || parcelVertexLocations.includes("INTERIOR") || featureVertexLocations.includes("INTERIOR");
  return positiveOverlap ? "INTERSECTS" : "BOUNDARY_TOUCH";
}

/**
 * How `feature` relates to `parcel`, both polygons.
 *
 * Either polygon falling outside the supported profile yields UNDETERMINED: a
 * shape whose own topology is undefined cannot be in a defined relationship with
 * anything, and reporting DISJOINT would assert something the arithmetic never
 * established.
 */
export function e85PolygonRelation(feature: E85PolygonGeometry, parcel: E85PolygonGeometry, tolerance?: E85SpatialTolerance): E85SpatialRelation {
  if (!isSupported(feature) || !isSupported(parcel)) return "UNDETERMINED";
  return polygonRelationUnchecked(feature, parcel, resolveE85Tolerance(tolerance));
}

function samePosition(a: E85Position, b: E85Position, tolerance: number): boolean {
  return Math.sqrt(e85DistanceSquared(a, b)) <= tolerance;
}

/**
 * How `feature` relates to `parcel` for any supported combination of geometry
 * types.
 *
 * A POINT parcel is the common "we have a centroid or an address pin, not a
 * lot polygon" case, and it is answered honestly: a pin inside a zone gives
 * CONTAINS, a pin on the boundary gives BOUNDARY_TOUCH. A POINT feature has no
 * area and so can never CONTAIN a polygon parcel — it can only touch it.
 *
 * CRS is NOT checked here: mismatched systems must be refused with an explicit
 * data gap by the applicability layer, which has the provenance to say which
 * dataset disagreed with which. Returning UNDETERMINED from deep inside a
 * geometry predicate would lose that.
 */
export function e85GeometryRelation(feature: E85Geometry, parcel: E85Geometry, tolerance?: E85SpatialTolerance): E85SpatialRelation {
  if (!isSupported(feature) || !isSupported(parcel)) return "UNDETERMINED";
  const tol = resolveE85Tolerance(tolerance);

  if (feature.type === "POLYGON" && parcel.type === "POLYGON") return polygonRelationUnchecked(feature, parcel, tol);

  if (feature.type === "POLYGON" && parcel.type === "POINT") {
    const location = locateUnchecked(parcel.coordinates, feature, tol);
    return location === "INTERIOR" ? "CONTAINS" : location === "BOUNDARY" ? "BOUNDARY_TOUCH" : "DISJOINT";
  }

  if (feature.type === "POINT" && parcel.type === "POLYGON") {
    const location = locateUnchecked((feature as E85PointGeometry).coordinates, parcel, tol);
    // A zero-area feature cannot cover a parcel, so INTERIOR is reported as
    // INTERSECTS rather than CONTAINS — the shapes meet, but nothing is covered.
    return location === "INTERIOR" ? "INTERSECTS" : location === "BOUNDARY" ? "BOUNDARY_TOUCH" : "DISJOINT";
  }

  if (feature.type === "POINT" && parcel.type === "POINT") {
    return samePosition(feature.coordinates, parcel.coordinates, tol) ? "CONTAINS" : "DISJOINT";
  }

  return "UNDETERMINED";
}

/** Whether a relation represents genuinely shared area, as opposed to contact or absence. Centralised so no call site re-decides whether BOUNDARY_TOUCH counts. */
export function e85RelationHasSharedArea(relation: E85SpatialRelation): boolean {
  return relation === "CONTAINS" || relation === "INTERSECTS";
}

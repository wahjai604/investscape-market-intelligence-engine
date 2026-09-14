/**
 * InvestScape™ E85 Phase 7 — Spatial Applicability: geometry validation.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * THE GATE. Phase 7's predicates are defined for a narrow polygon profile, and
 * this file's job is to prove a geometry belongs to that profile BEFORE anything
 * measures it. A shape whose relationship is undefined must never reach a
 * predicate and come back with a confident-looking CONTAINS or DISJOINT: an
 * answer nobody can justify is worse than a refusal, because only the refusal is
 * visible.
 *
 * Validation, never repair. A ring that crosses itself, a polygon wound the
 * wrong way, or a hole that escapes its shell are all left exactly as supplied
 * and reported: silently "fixing" authoritative municipal geometry would mean
 * the relationship E85 reports is one nobody published. The single exception is
 * the implicit ring-closure policy declared in spatial-types.ts, which is a
 * reading convention rather than a repair — it changes no coordinate.
 *
 * THE SUPPORTED POLYGON PROFILE, stated once:
 *   - exactly two finite ordinates per position (3D is rejected, not flattened)
 *   - at least three distinct positions per ring, under the closure convention
 *   - no ring meets itself except where consecutive segments share an endpoint
 *   - every interior ring lies strictly within the exterior ring
 *   - no interior ring meets the exterior ring
 *   - no two interior rings meet, and neither contains the other
 * This is deliberately NARROWER than OGC Simple Features. The objective is not
 * to build a topology engine; it is to refuse shapes outside the subset for
 * which the predicates in geometry-relations.ts are known to hold. Where the two
 * differ, this file rejects — a conservative refusal costs one feature and says
 * so, while a wrong acceptance costs a regulatory answer and says nothing.
 *
 * Malformed source data is ORDINARY, so every failure here is a returned value.
 * Nothing in this file throws: a municipality shipping a two-point ring is a
 * Tuesday, not a programmer error, and an exception would take down a whole
 * batch over one bad feature.
 */
import type { E85Geometry, E85LinearRing, E85PolygonGeometry, E85Position } from "./spatial-types";
import { e85PolygonRings } from "./spatial-types";
import { e85RingWindsAround, e85SegmentsIntersect, e85TopologyRing, e85TopologySegments } from "./geometry-primitives";

export type E85GeometryProblemCode =
  /** The geometry's `type` is not one Phase 7 supports. Reported rather than ignored, so an unsupported feature never silently drops out of an applicability set. */
  | "UNSUPPORTED_GEOMETRY_TYPE"
  /** A position is not a pair of finite numbers — NaN, Infinity, null, or the wrong arity. Includes 3D input, which is rejected rather than flattened. */
  | "INVALID_COORDINATE"
  /** A ring has too few distinct positions to bound any area (fewer than three after the closure convention is applied). */
  | "RING_TOO_FEW_POSITIONS"
  /** A ring meets itself somewhere other than between consecutive segments — a bow-tie, a figure-eight, or a spike folded back through a non-adjacent edge. Outside the supported profile. */
  | "RING_SELF_INTERSECTION"
  /** An interior ring lies wholly outside its exterior ring, so it describes a hole in something else. */
  | "INTERIOR_RING_OUTSIDE_EXTERIOR"
  /** An interior ring meets the exterior ring, so the hole is not strictly inside the shell it belongs to. */
  | "INTERIOR_RING_CROSSES_EXTERIOR"
  /** Two interior rings meet, or one lies inside the other. A hole within a hole has no agreed reading, so it is refused rather than guessed at. */
  | "INTERIOR_RINGS_OVERLAP"
  /** No CRS identifier is declared, so the coordinates cannot be compared with anything. */
  | "CRS_MISSING";

export interface E85GeometryProblem {
  code: E85GeometryProblemCode;
  /** Which ring the problem is in: "exterior", "interior[0]", or "point" — so a reviewer can find it without re-deriving the traversal. */
  location: string;
  /** Specific statement of what was wrong, never boilerplate. */
  detail: string;
}

export type E85GeometryValidation = { valid: true } | { valid: false; problems: readonly E85GeometryProblem[] };

function isFinitePosition(position: unknown): position is E85Position {
  return Array.isArray(position) && position.length === 2 && typeof position[0] === "number" && typeof position[1] === "number" && Number.isFinite(position[0]) && Number.isFinite(position[1]);
}

function describePosition(position: unknown): string {
  if (!Array.isArray(position)) return `not an array (${typeof position})`;
  if (position.length !== 2) return `${position.length} ordinates supplied, exactly 2 required`;
  return `[${String(position[0])}, ${String(position[1])}]`;
}

/** Structure only: arity, finiteness, and enough distinct positions to bound an area. Topology is a separate pass, because a ring of garbage cannot meaningfully be asked whether it crosses itself. */
function validateRingStructure(ring: E85LinearRing, location: string, problems: E85GeometryProblem[]): boolean {
  let positionsValid = true;
  ring.forEach((position, index) => {
    if (!isFinitePosition(position)) {
      positionsValid = false;
      problems.push({
        code: "INVALID_COORDINATE",
        location: `${location}[${index}]`,
        detail: `Position ${index} is ${describePosition(position)}. Every position must be exactly two finite numbers; 3D coordinates are rejected rather than flattened, because dropping an ordinate changes the geometry without saying so.`,
      });
    }
  });
  // Arity is checked before the count so a ring of garbage does not also get
  // reported as "too few positions", which would describe a symptom rather
  // than the cause.
  if (!positionsValid) return false;
  const distinct = e85TopologyRing(ring);
  if (distinct.length < 3) {
    problems.push({
      code: "RING_TOO_FEW_POSITIONS",
      location,
      detail: `${distinct.length} distinct position(s) after the implicit-closure convention; a ring needs at least 3 to bound any area. Repeated positions do not count toward this total.`,
    });
    return false;
  }
  return true;
}

/**
 * Whether two segments of one ring are consecutive and therefore EXPECTED to
 * share an endpoint.
 *
 * Consecutive segments always meet — that is what makes them a ring, not a
 * defect — and the closing segment is consecutive with the opening one, since
 * the ring is cyclic. Missing that second case would report every well-formed
 * polygon in existence as self-intersecting.
 */
function segmentsAreConsecutive(i: number, j: number, count: number): boolean {
  return j === i + 1 || (i === 0 && j === count - 1);
}

/**
 * Ring simplicity. Reports the FIRST offending pair per ring rather than every
 * one: a self-intersecting ring is rejected whole, and enumerating each crossing
 * would bury the finding a reviewer needs under repetitions of it.
 *
 * O(n²) in the ring's positions, with a bounding-box early-out. Adequate for the
 * feature sizes Phase 7 handles and honest about its cost — see the Phase 7A
 * report's Known Limitations for the sweep-line this deliberately is not.
 */
function validateRingSimplicity(ring: E85LinearRing, location: string, problems: E85GeometryProblem[]): boolean {
  // The COLLAPSED ring, so that index adjacency means real adjacency: a
  // duplicated vertex would otherwise push two genuinely consecutive segments
  // two indices apart and have their shared endpoint read as a crossing.
  const segments = e85TopologySegments(ring);
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      if (segmentsAreConsecutive(i, j, segments.length)) continue;
      const [a, b] = segments[i];
      const [c, d] = segments[j];
      if (!e85SegmentsIntersect(a, b, c, d)) continue;
      problems.push({
        code: "RING_SELF_INTERSECTION",
        location,
        detail:
          `Non-adjacent segments ${i} ([${a[0]}, ${a[1]}]→[${b[0]}, ${b[1]}]) and ${j} ([${c[0]}, ${c[1]}]→[${d[0]}, ${d[1]}]) of this ring meet. ` +
          `Phase 7's predicates are defined for simple rings only, so the geometry is refused rather than measured by rules that do not apply to it. ` +
          `Consecutive segments sharing an endpoint are expected and are not reported here.`,
      });
      return false;
    }
  }
  return true;
}

/** Every position of a ring lies strictly inside the exterior — used only once the rings are known not to meet, so "strictly" is the only remaining possibility. */
function ringLiesWithin(inner: E85LinearRing, outer: E85LinearRing): boolean {
  return e85TopologyRing(inner).every((position) => e85RingWindsAround(position, outer));
}

/** Whether any segment of one ring meets any segment of another. Every pair here is between DIFFERENT rings, so no pair is legitimately adjacent and any contact is a defect. */
function ringsMeet(first: E85LinearRing, second: E85LinearRing): boolean {
  const a = e85TopologySegments(first);
  const b = e85TopologySegments(second);
  return a.some(([p, q]) => b.some(([r, s]) => e85SegmentsIntersect(p, q, r, s)));
}

/**
 * Interior-ring topology, for the profile stated in the file header.
 *
 * Runs only over rings that have already passed structure and simplicity, so
 * every check below can assume it is comparing two well-formed simple rings.
 */
function validateInteriorRings(polygon: E85PolygonGeometry, usable: readonly { ring: E85LinearRing; location: string }[], problems: E85GeometryProblem[]): void {
  const exterior = polygon.exterior;
  const holes = usable.filter((r) => r.location !== "exterior");
  const exteriorUsable = usable.some((r) => r.location === "exterior");
  if (!exteriorUsable) return;

  const containedHoles: { ring: E85LinearRing; location: string }[] = [];

  for (const hole of holes) {
    if (ringsMeet(hole.ring, exterior)) {
      problems.push({
        code: "INTERIOR_RING_CROSSES_EXTERIOR",
        location: hole.location,
        detail:
          `This interior ring meets the exterior ring. A hole must lie strictly within the shell it perforates; one that crosses or touches the shell describes a shape whose inside and outside Phase 7 cannot determine, ` +
          `so the geometry is refused rather than reinterpreted.`,
      });
      continue;
    }
    if (!ringLiesWithin(hole.ring, exterior)) {
      problems.push({
        code: "INTERIOR_RING_OUTSIDE_EXTERIOR",
        location: hole.location,
        detail: `This interior ring lies entirely outside the exterior ring, so it perforates nothing. It is refused rather than dropped, because a hole in the wrong place is evidence the feature was assembled incorrectly.`,
      });
      continue;
    }
    containedHoles.push(hole);
  }

  for (let i = 0; i < containedHoles.length; i++) {
    for (let j = i + 1; j < containedHoles.length; j++) {
      const first = containedHoles[i];
      const second = containedHoles[j];
      const meet = ringsMeet(first.ring, second.ring);
      const nested = !meet && (ringLiesWithin(second.ring, first.ring) || ringLiesWithin(first.ring, second.ring));
      if (!meet && !nested) continue;
      problems.push({
        code: "INTERIOR_RINGS_OVERLAP",
        location: `${first.location}+${second.location}`,
        detail: meet
          ? `These two interior rings meet. Overlapping holes have no single agreed reading — whether the shared region is solid or void depends on a fill rule nobody stated — so the geometry is refused rather than assigned one.`
          : `One of these interior rings lies inside the other. A hole within a hole has no agreed reading in this profile, and guessing at one would decide whether a parcel in that region is inside or outside the feature.`,
      });
    }
  }
}

/**
 * Structural and topological validation, WITHOUT the CRS check.
 *
 * This is the predicate `geometry-relations.ts` guards itself with. It asks only
 * "is this a shape my arithmetic is defined for?", which is a question about the
 * shape alone — a polygon with no declared CRS is still a perfectly measurable
 * polygon. Whether two geometries may be compared WITH EACH OTHER is a separate
 * question, owned by the applicability layer, which holds the provenance needed
 * to say which dataset disagreed with which.
 */
export function validateE85GeometryShape(geometry: E85Geometry | undefined): E85GeometryValidation {
  const problems: E85GeometryProblem[] = [];
  collectShapeProblems(geometry, problems);
  return problems.length === 0 ? { valid: true } : { valid: false, problems };
}

function collectShapeProblems(geometry: E85Geometry | undefined, problems: E85GeometryProblem[]): void {
  if (geometry === undefined) {
    problems.push({ code: "UNSUPPORTED_GEOMETRY_TYPE", location: "geometry", detail: "No geometry was supplied. Absent geometry is a data gap, never an empty shape at the origin." });
    return;
  }

  if (geometry.type === "POINT") {
    if (!isFinitePosition(geometry.coordinates)) {
      problems.push({ code: "INVALID_COORDINATE", location: "point", detail: `Point coordinates are ${describePosition(geometry.coordinates)}; exactly two finite numbers are required.` });
    }
    return;
  }

  if (geometry.type !== "POLYGON") {
    problems.push({
      code: "UNSUPPORTED_GEOMETRY_TYPE",
      location: "geometry",
      detail: `Geometry type "${String((geometry as { type?: unknown }).type)}" is not supported by E85 Phase 7, which handles POINT and POLYGON only. The feature is excluded from applicability rather than approximated by a bounding shape.`,
    });
    return;
  }

  // Structure, then simplicity, then inter-ring topology. Each stage assumes the
  // previous one passed, so a ring that failed structure is never asked a
  // question its coordinates cannot answer.
  const locations = e85PolygonRings(geometry).map((ring, index) => ({ ring, location: index === 0 ? "exterior" : `interior[${index - 1}]` }));
  const structurallyValid = locations.filter((entry) => validateRingStructure(entry.ring, entry.location, problems));
  const simple = structurallyValid.filter((entry) => validateRingSimplicity(entry.ring, entry.location, problems));
  validateInteriorRings(geometry, simple, problems);
}

/**
 * Validates one geometry for use in E85: shape, topology, and a declared CRS.
 * Returns every problem found rather than the first, so a caller fixing a
 * dataset sees the whole picture in one pass.
 */
export function validateE85Geometry(geometry: E85Geometry | undefined): E85GeometryValidation {
  const problems: E85GeometryProblem[] = [];

  if (geometry !== undefined && (geometry.crs === undefined || typeof geometry.crs.crsId !== "string" || geometry.crs.crsId.trim() === "")) {
    problems.push({
      code: "CRS_MISSING",
      location: "crs",
      detail: "No coordinate reference system identifier is declared. Coordinates carry no meaning without one, and E85 does not assume a default CRS.",
    });
  }

  collectShapeProblems(geometry, problems);
  return problems.length === 0 ? { valid: true } : { valid: false, problems };
}

/** Every ring of every supplied polygon, for callers that need to iterate geometry uniformly. Exported so tests and the applicability layer share one traversal. */
export function e85GeometryRings(geometry: E85Geometry): readonly E85LinearRing[] {
  return geometry.type === "POLYGON" ? e85PolygonRings(geometry) : [];
}

/** Formats problems into one reviewable sentence for a finding or gap message. */
export function formatE85GeometryProblems(problems: readonly E85GeometryProblem[]): string {
  return problems.map((p) => `${p.code} at ${p.location}: ${p.detail}`).join(" ");
}

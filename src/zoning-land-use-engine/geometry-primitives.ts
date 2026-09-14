/**
 * InvestScape™ E85 Phase 7 — Spatial Applicability: exact 2D primitives.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * The small set of arithmetic both `geometry-validation.ts` and
 * `geometry-relations.ts` need. It exists so that the two share ONE
 * implementation of each predicate rather than two that could drift: validation
 * decides whether a shape is inside the supported profile, relations decides how
 * two supported shapes sit together, and a disagreement between their arithmetic
 * would mean a shape could pass the gate and then be measured by different rules
 * than the gate used.
 *
 * The dependency runs validation → primitives ← relations, and relations →
 * validation for its guard. Nothing here imports either, so there is no cycle.
 *
 * TWO PRECISION POLICIES, DELIBERATELY DISTINCT AND STATED HERE ONCE:
 *
 *   EXACT — orientation, segment intersection, and ring winding take no
 *       tolerance at all. These answer questions about a SINGLE published
 *       geometry's own internal consistency, where the publisher's coordinates
 *       are the only authority and there is no second source to reconcile
 *       against. A tolerance there would either invent invalidity (rejecting a
 *       ring for nearly touching itself) or conceal it (accepting a genuine
 *       crossing because it is small), and both are worse than an exact answer.
 *
 *   TOLERANT — `e85PointOnRing` alone takes a distance, supplied by the caller
 *       from the single `E85SpatialTolerance` mechanism in spatial-types.ts.
 *       That predicate is the one place two INDEPENDENTLY PUBLISHED geometries
 *       are reconciled, where representation error is real.
 *
 * No epsilon literal appears in this file. The one tolerance in Phase 7 is
 * declared in spatial-types.ts and arrives here as a parameter.
 */
import type { E85LinearRing, E85Position } from "./spatial-types";
import { e85CanonicalRing } from "./spatial-types";

/** A segment as an ordered pair of endpoints. */
export type E85Segment = readonly [E85Position, E85Position];

/** Squared distance, kept squared to avoid a needless square root in the hot path. */
export function e85DistanceSquared(a: E85Position, b: E85Position): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

/** Shortest distance from a position to a segment, including the degenerate segment whose endpoints coincide. */
export function e85DistanceToSegment(p: E85Position, a: E85Position, b: E85Position): number {
  const lengthSquared = e85DistanceSquared(a, b);
  if (lengthSquared === 0) return Math.sqrt(e85DistanceSquared(p, a));
  // Projection parameter of p onto the infinite line, clamped to the segment.
  let t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  const projection: E85Position = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  return Math.sqrt(e85DistanceSquared(p, projection));
}

/**
 * Cyclic segments of a ring, honouring the implicit-closure policy in
 * spatial-types.ts.
 *
 * A repeated vertex here yields a zero-length segment, which is harmless to
 * every measurement in geometry-relations.ts: distance-to-segment handles the
 * degenerate case explicitly, and a zero-length edge contributes nothing to a
 * crossing count. It is NOT harmless to topology validation — see
 * `e85TopologyRing`.
 */
export function e85RingSegments(ring: E85LinearRing): readonly E85Segment[] {
  const positions = e85CanonicalRing(ring);
  const segments: E85Segment[] = [];
  for (let i = 0; i < positions.length; i++) {
    segments.push([positions[i], positions[(i + 1) % positions.length]]);
  }
  return segments;
}

function samePoint(a: E85Position, b: E85Position): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/**
 * A ring with degenerate repeats collapsed: consecutive identical positions
 * reduced to one, and any trailing repeat of the first position removed.
 *
 * DERIVED DATA, never written back — the caller's ring is not modified and
 * duplicate vertices are not removed from anyone's published geometry. This form
 * exists because topology validation reasons about segment ADJACENCY BY INDEX,
 * and a zero-length segment breaks that correspondence: in `[a, b, b, c]` the
 * segments a→b and b→c are genuinely consecutive, but the degenerate b→b sits
 * between them and pushes their indices two apart, so an index-based adjacency
 * test would read their shared vertex as a self-intersection and reject an
 * ordinary polygon over a spelling quirk of its source.
 *
 * Collapsing cannot change a ring's shape — a zero-length segment covers no
 * ground — so this is a reading convention in the same family as the implicit
 * closure policy, not a repair. `e85RingSegments` deliberately does NOT apply
 * it, because the measurement predicates are unaffected either way and one
 * canonicalization per question is clearer than one shared form that has to
 * serve both.
 */
export function e85TopologyRing(ring: E85LinearRing): readonly E85Position[] {
  const closed = e85CanonicalRing(ring);
  const collapsed: E85Position[] = [];
  for (const position of closed) {
    if (collapsed.length > 0 && samePoint(collapsed[collapsed.length - 1], position)) continue;
    collapsed.push(position);
  }
  while (collapsed.length > 1 && samePoint(collapsed[0], collapsed[collapsed.length - 1])) collapsed.pop();
  return collapsed;
}

/** Cyclic segments of the collapsed ring, for topology checks that reason about adjacency by index. */
export function e85TopologySegments(ring: E85LinearRing): readonly E85Segment[] {
  const positions = e85TopologyRing(ring);
  const segments: E85Segment[] = [];
  for (let i = 0; i < positions.length; i++) {
    segments.push([positions[i], positions[(i + 1) % positions.length]]);
  }
  return segments;
}

/** Sign of the cross product (b-a)×(c-a): +1 left turn, -1 right turn, 0 collinear. EXACT — no tolerance, so a touch can never be widened into a crossing. */
export function e85Orientation(a: E85Position, b: E85Position, c: E85Position): number {
  const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  return cross > 0 ? 1 : cross < 0 ? -1 : 0;
}

/** Whether a position already known to be COLLINEAR with a segment lies within that segment's extent. */
function withinExtent(a: E85Position, b: E85Position, p: E85Position): boolean {
  return Math.min(a[0], b[0]) <= p[0] && p[0] <= Math.max(a[0], b[0]) && Math.min(a[1], b[1]) <= p[1] && p[1] <= Math.max(a[1], b[1]);
}

/** Whether two segments' bounding boxes are separated. A pure early-out: boxes that merely touch are NOT separated, so this can never change an answer. */
function boxesSeparated(a: E85Position, b: E85Position, c: E85Position, d: E85Position): boolean {
  return (
    Math.max(a[0], b[0]) < Math.min(c[0], d[0]) ||
    Math.max(c[0], d[0]) < Math.min(a[0], b[0]) ||
    Math.max(a[1], b[1]) < Math.min(c[1], d[1]) ||
    Math.max(c[1], d[1]) < Math.min(a[1], b[1])
  );
}

/**
 * Whether two segments share ANY point — proper crossings, endpoint contacts and
 * collinear overlaps alike.
 *
 * The counterpart to `e85ProperlyCrosses`, and the difference between them is
 * the whole point of having both. Relations ask "do these shapes overlap?",
 * where a mere touch must not be promoted into shared area. Topology validation
 * asks "does this ring meet itself anywhere it should not?", where a touch is
 * exactly the defect being looked for — a ring pinched to a point at a
 * non-adjacent vertex is outside the supported profile even though nothing
 * crosses.
 */
export function e85SegmentsIntersect(a: E85Position, b: E85Position, c: E85Position, d: E85Position): boolean {
  if (boxesSeparated(a, b, c, d)) return false;
  const d1 = e85Orientation(c, d, a);
  const d2 = e85Orientation(c, d, b);
  const d3 = e85Orientation(a, b, c);
  const d4 = e85Orientation(a, b, d);
  if (d1 * d2 < 0 && d3 * d4 < 0) return true;
  if (d1 === 0 && withinExtent(c, d, a)) return true;
  if (d2 === 0 && withinExtent(c, d, b)) return true;
  if (d3 === 0 && withinExtent(a, b, c)) return true;
  if (d4 === 0 && withinExtent(a, b, d)) return true;
  return false;
}

/**
 * Whether two segments cross PROPERLY — each passing strictly through the
 * other's interior.
 *
 * Collinear overlaps and endpoint contacts return false by design. Those are
 * touching, and touching is resolved through the boundary machinery rather than
 * being promoted here into evidence of shared area.
 */
export function e85ProperlyCrosses(a: E85Position, b: E85Position, c: E85Position, d: E85Position): boolean {
  const d1 = e85Orientation(a, b, c);
  const d2 = e85Orientation(a, b, d);
  const d3 = e85Orientation(c, d, a);
  const d4 = e85Orientation(c, d, b);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Whether a position lies on a ring's boundary, within the supplied distance. The ONE tolerant predicate in Phase 7. */
export function e85PointOnRing(p: E85Position, ring: E85LinearRing, tolerance: number): boolean {
  return e85RingSegments(ring).some(([a, b]) => e85DistanceToSegment(p, a, b) <= tolerance);
}

/**
 * Even-odd crossing count for a position against one ring. EXACT.
 *
 * Valid only for a position already known not to lie on the ring, which is why
 * every caller tests boundary contact first: the strict/non-strict asymmetry in
 * the `(yi > y) !== (yj > y)` test stops a ray grazing a vertex being counted
 * twice, but says nothing useful about a position sitting on an edge.
 */
export function e85RingWindsAround(p: E85Position, ring: E85LinearRing): boolean {
  const positions = e85CanonicalRing(ring);
  const [x, y] = p;
  let inside = false;
  for (let i = 0, j = positions.length - 1; i < positions.length; j = i++) {
    const [xi, yi] = positions[i];
    const [xj, yj] = positions[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

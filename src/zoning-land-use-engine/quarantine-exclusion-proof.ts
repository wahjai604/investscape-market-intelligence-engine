/**
 * InvestScape™ E85 Phase 9 — Decision Orchestration: the quarantined-polygon
 * point-exclusion proof.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * ONE NARROW EXCEPTION TO "A QUARANTINED RECORD IS UNDETERMINED", AND WHY IT IS
 * SAFE. Phase 8 quarantines a polygon Phase 7's gate refuses, and Phase 9
 * ordinarily treats its relevance to every parcel as UNDETERMINED — because the
 * refused shape's interior is exactly what E85 declined to decide. That is still
 * the rule. This file proves one thing that does NOT depend on deciding it:
 *
 *   A POINT that lies outside the shape under EVERY plausible reading of its
 *   rings — even-odd, nonzero winding, and shell-minus-holes — and farther than
 *   the configured tolerance from EVERY edge, is outside the shape however the
 *   ambiguity is eventually resolved.
 *
 * The readings disagree only about regions bounded by the rings; a point that
 * all three place outside, and that sits clear of every boundary, is outside on
 * any of them. The proof never chooses a reading, never states where the
 * shape's interior is, and never treats the shape as valid.
 *
 * WHAT IT REFUSES, each of which leaves the record UNDETERMINED:
 *   - any parcel geometry that is not a POINT. A polygon parcel can overlap a
 *     region the readings disagree about, and no clearance test settles that.
 *   - a point with invalid coordinates, an undeclared CRS, a CRS other than the
 *     supported projected CRS, or a CRS that differs from the retained rings'.
 *   - a record without retained rings, from another release, or withheld for
 *     any reason other than a Phase 7 geometry refusal.
 *   - rings whose refusal is anything but interior-ring contact, or in which any
 *     two segments properly cross.
 *   - a point on, or within tolerance of, any edge; or inside under any reading.
 *
 * It measures only the retained verbatim rings. It reads no raw source payload,
 * derives no substitute shape, and repairs nothing.
 */
import type { E85GeometryProblemCode } from "./geometry-validation";
import { e85DistanceToSegment, e85Orientation, e85ProperlyCrosses, e85RingSegments, e85RingWindsAround, e85TopologyRing, type E85Segment } from "./geometry-primitives";
import type { E85Geometry, E85LinearRing, E85Position, E85SpatialTolerance } from "./spatial-types";
import { resolveE85Tolerance } from "./spatial-types";
import type { E85QuarantinedExclusionProofRings, E85QuarantinedSpatialRecord } from "./spatial-source-adapter-contract";
import { E85_EXCLUSION_PROOF_ELIGIBLE_PROBLEM_CODES } from "./spatial-source-adapter-contract";

/** The proof's stable name, carried on every materiality record it settles. */
export const E85_QUARANTINE_POINT_EXCLUSION_PROOF_ID = "E85_PHASE9_QUARANTINED_POLYGON_POINT_EXTERIOR_UNDER_ALL_RING_READINGS";

/**
 * CRS identifiers the proof accepts, spelled exactly. EPSG:26910 (NAD83 / UTM
 * zone 10N) is projected in metres, so the configured tolerance is a planar
 * distance in it. A geographic CRS would make the edge-clearance test a
 * statement in degrees, which is why the list is explicit rather than open.
 */
export const E85_EXCLUSION_PROOF_CRS_IDS: readonly string[] = ["urn:ogc:def:crs:EPSG::26910"];

export type E85ExclusionProofRefusal =
  | "PARCEL_NOT_A_POINT"
  | "POINT_COORDINATES_INVALID"
  | "POINT_CRS_UNSUPPORTED"
  | "CRS_MISMATCH"
  | "RECORD_NOT_GEOMETRY_QUARANTINE"
  | "RELEASE_MISMATCH"
  | "NO_RETAINED_RINGS"
  | "PROBLEM_CODES_NOT_ELIGIBLE"
  | "RINGS_MALFORMED"
  | "RINGS_PROPERLY_CROSS"
  | "POINT_WITHIN_TOLERANCE_OF_EDGE"
  | "POINT_INSIDE_UNDER_SOME_READING";

export interface E85ExclusionProofEvidence {
  proofId: typeof E85_QUARANTINE_POINT_EXCLUSION_PROOF_ID;
  crsId: string;
  point: E85Position;
  /** The tolerance in force, in CRS units. The point is strictly farther than this from every edge. */
  tolerance: number;
  /** Smallest distance from the point to any edge of any retained ring. */
  minimumEdgeDistance: number;
  ringCount: number;
  phase7ProblemCodes: readonly E85GeometryProblemCode[];
}

export type E85ExclusionProofResult = { proven: true; evidence: E85ExclusionProofEvidence } | { proven: false; refusal: E85ExclusionProofRefusal; detail: string };

function isFinitePosition(value: unknown): value is E85Position {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === "number" && typeof value[1] === "number" && Number.isFinite(value[0]) && Number.isFinite(value[1]);
}

function allRings(rings: Pick<E85QuarantinedExclusionProofRings, "exterior" | "interiors">): readonly E85LinearRing[] {
  return [rings.exterior, ...rings.interiors];
}

/** Every ring has only finite pairs and at least three distinct positions. */
function ringsWellFormed(rings: readonly E85LinearRing[]): boolean {
  return rings.every((ring) => Array.isArray(ring) && ring.every(isFinitePosition) && e85TopologyRing(ring).length >= 3);
}

/**
 * Whether any two segments of the shape, in any rings or the same ring,
 * properly cross. Endpoint contact and collinear touching are not crossings;
 * those are the interior-ring contacts this proof is scoped to.
 */
export function e85RingsHaveProperCrossing(rings: readonly E85LinearRing[]): boolean {
  const segments: E85Segment[] = rings.flatMap((ring) => [...e85RingSegments(ring)]);
  for (let i = 0; i < segments.length; i++) {
    const [a, b] = segments[i];
    for (let j = i + 1; j < segments.length; j++) {
      const [c, d] = segments[j];
      if (e85ProperlyCrosses(a, b, c, d)) return true;
    }
  }
  return false;
}

/**
 * Whether a refused polygon's rings may be retained for this proof: declared CRS
 * on the supported list, well-formed coordinates, a refusal made only of
 * interior-ring contact codes, and no proper crossing anywhere. Adapters call
 * this; they do not restate it.
 */
export function e85ExclusionProofRingsRetainable(input: { crsId: string | undefined; exterior: E85LinearRing; interiors: readonly E85LinearRing[]; phase7ProblemCodes: readonly E85GeometryProblemCode[] }): boolean {
  if (input.crsId === undefined || !E85_EXCLUSION_PROOF_CRS_IDS.includes(input.crsId)) return false;
  if (input.phase7ProblemCodes.length === 0 || !input.phase7ProblemCodes.every((code) => E85_EXCLUSION_PROOF_ELIGIBLE_PROBLEM_CODES.includes(code))) return false;
  const rings = [input.exterior, ...input.interiors];
  if (!ringsWellFormed(rings)) return false;
  return !e85RingsHaveProperCrossing(rings);
}

/** Winding number of a ring about a point known to be off it. Signed; orientation-dependent by design. */
function windingNumber(p: E85Position, ring: E85LinearRing): number {
  let winding = 0;
  for (const [a, b] of e85RingSegments(ring)) {
    if (a[1] <= p[1]) {
      if (b[1] > p[1] && e85Orientation(a, b, p) > 0) winding++;
    } else if (b[1] <= p[1] && e85Orientation(a, b, p) < 0) {
      winding--;
    }
  }
  return winding;
}

/**
 * Proves, or refuses to prove, that a point lies outside a quarantined polygon
 * under every ring reading. Pure, deterministic and clock-free.
 */
export function proveE85PointOutsideQuarantinedPolygon(input: {
  parcelGeometry: E85Geometry | undefined;
  record: E85QuarantinedSpatialRecord;
  /** The release of the Phase 8 result the decision is built on. */
  datasetVersionId: string;
  tolerance?: E85SpatialTolerance;
}): E85ExclusionProofResult {
  const { parcelGeometry, record } = input;
  const refuse = (refusal: E85ExclusionProofRefusal, detail: string): E85ExclusionProofResult => ({ proven: false, refusal, detail });

  if (parcelGeometry === undefined || parcelGeometry.type !== "POINT") {
    return refuse("PARCEL_NOT_A_POINT", "The subject is not a point. The exclusion proof applies to point requests only; a polygon parcel may overlap a region whose inside and outside the ring readings disagree about.");
  }
  if (!isFinitePosition(parcelGeometry.coordinates)) return refuse("POINT_COORDINATES_INVALID", "The point's coordinates are not two finite numbers.");
  const pointCrsId = parcelGeometry.crs?.crsId;
  if (typeof pointCrsId !== "string" || !E85_EXCLUSION_PROOF_CRS_IDS.includes(pointCrsId)) {
    return refuse("POINT_CRS_UNSUPPORTED", `The point's CRS ${JSON.stringify(pointCrsId ?? null)} is not one the exclusion proof supports (${E85_EXCLUSION_PROOF_CRS_IDS.join(", ")}).`);
  }
  if (record.reasonCodes.length !== 1 || record.reasonCodes[0] !== "GEOMETRY_FAILED_PHASE7_VALIDATION") {
    return refuse("RECORD_NOT_GEOMETRY_QUARANTINE", `The record was withheld for [${record.reasonCodes.join(", ")}], not solely for a Phase 7 geometry refusal.`);
  }
  if (record.datasetVersionId !== input.datasetVersionId) {
    return refuse("RELEASE_MISMATCH", `The quarantined record belongs to release "${record.datasetVersionId}", not the decision's release "${input.datasetVersionId}".`);
  }
  const rings = record.exclusionProofRings;
  if (rings === undefined) return refuse("NO_RETAINED_RINGS", "No rings were retained for this record, so nothing can be measured against the point.");
  if (rings.crs.crsId !== pointCrsId) {
    return refuse("CRS_MISMATCH", `The retained rings are in ${JSON.stringify(rings.crs.crsId)} and the point is in ${JSON.stringify(pointCrsId)}. No transform is performed.`);
  }
  // Re-checked here rather than trusted: a record can be constructed by any caller.
  if (rings.phase7ProblemCodes.length === 0 || !rings.phase7ProblemCodes.every((code) => E85_EXCLUSION_PROOF_ELIGIBLE_PROBLEM_CODES.includes(code))) {
    return refuse("PROBLEM_CODES_NOT_ELIGIBLE", `The refusal [${rings.phase7ProblemCodes.join(", ")}] is not limited to interior-ring contact.`);
  }
  const ringList = allRings(rings);
  if (!ringsWellFormed(ringList)) return refuse("RINGS_MALFORMED", "A retained ring has an invalid coordinate or fewer than three distinct positions.");
  if (e85RingsHaveProperCrossing(ringList)) return refuse("RINGS_PROPERLY_CROSS", "Two segments of the retained rings properly cross, so the shape's regions are not bounded in a way this proof covers.");

  const point = parcelGeometry.coordinates;
  const tolerance = resolveE85Tolerance(input.tolerance);
  let minimumEdgeDistance = Number.POSITIVE_INFINITY;
  for (const ring of ringList) {
    for (const [a, b] of e85RingSegments(ring)) minimumEdgeDistance = Math.min(minimumEdgeDistance, e85DistanceToSegment(point, a, b));
  }
  if (!(minimumEdgeDistance > tolerance)) {
    return refuse("POINT_WITHIN_TOLERANCE_OF_EDGE", `The point is ${minimumEdgeDistance} from the nearest edge, not farther than the tolerance ${tolerance}.`);
  }

  const evenOdd = ringList.reduce((inside, ring) => (e85RingWindsAround(point, ring) ? !inside : inside), false);
  const nonzero = ringList.reduce((sum, ring) => sum + windingNumber(point, ring), 0) !== 0;
  const shellMinusHoles = e85RingWindsAround(point, rings.exterior) && !rings.interiors.some((hole) => e85RingWindsAround(point, hole));
  if (evenOdd || nonzero || shellMinusHoles) {
    const readings = [evenOdd ? "even-odd" : "", nonzero ? "nonzero winding" : "", shellMinusHoles ? "shell-minus-holes" : ""].filter((r) => r !== "");
    return refuse("POINT_INSIDE_UNDER_SOME_READING", `The point is inside under: ${readings.join(", ")}.`);
  }

  return {
    proven: true,
    evidence: {
      proofId: E85_QUARANTINE_POINT_EXCLUSION_PROOF_ID,
      crsId: pointCrsId,
      point: [point[0], point[1]],
      tolerance,
      minimumEdgeDistance,
      ringCount: ringList.length,
      phase7ProblemCodes: rings.phase7ProblemCodes,
    },
  };
}

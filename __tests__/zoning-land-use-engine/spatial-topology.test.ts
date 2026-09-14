/**
 * InvestScape™ E85 Phase 7A — polygon topology is validated, not assumed.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Phase 7's predicates are defined for a narrow polygon profile. Before this
 * remediation that was a documented assumption: the Known Limitations said the
 * result for a self-intersecting shape was undefined, and nothing stopped such a
 * shape reaching the classifier and coming back with a confident CONTAINS or
 * DISJOINT. An answer nobody can justify is worse than a refusal, because only
 * the refusal is visible.
 *
 * These tests hold the gate shut from both sides: the validator rejects what is
 * outside the profile, and the predicates independently refuse to measure it
 * even when called directly.
 *
 * Synthetic coordinates only. Nothing here is fetched and nothing describes a
 * real municipality.
 */
import {
  createE85SpatialDatasetRegistry,
  e85GeometryRelation,
  e85LocatePointInPolygon,
  e85PolygonRelation,
  resolveE85SpatialApplicability,
  validateE85Geometry,
  validateE85GeometryShape,
  type E85GeometryProblemCode,
  type E85PolygonGeometry,
} from "../../src/zoning-land-use-engine";
import {
  BOW_TIE,
  CROSSING_HOLES,
  CRS,
  deepFreeze,
  feature,
  HOLE_CROSSING_EXTERIOR,
  HOLE_OUTSIDE_EXTERIOR,
  HOLED_SQUARE,
  NESTED_HOLES,
  parcel,
  PARCEL_IN_A,
  PINCHED_RING,
  point,
  polygon,
  RESOLVED_AT,
  ring,
  SELF_INTERSECTING_HOLE,
  SPIKE_RING,
  square,
  squareReversedClosed,
  STANDARD_DATASETS,
  ZONE_A,
  FEATURE_A,
} from "./fixtures/spatial-features";

function problemCodes(geometry: E85PolygonGeometry): readonly E85GeometryProblemCode[] {
  const validation = validateE85GeometryShape(geometry);
  return validation.valid ? [] : validation.problems.map((p) => p.code);
}

describe("E85 Phase 7A — the supported polygon profile is accepted", () => {
  test("a simple square is valid", () => {
    expect(validateE85Geometry(square(0, 0, 10, 10)).valid).toBe(true);
  });

  test("reversing the winding does not make a polygon invalid", () => {
    // Orientation is not significant anywhere in Phase 7, and a validator that
    // demanded one winding would reject half of the world's published layers.
    expect(validateE85Geometry(squareReversedClosed(0, 0, 10, 10)).valid).toBe(true);
  });

  test("an explicitly closed ring is valid", () => {
    expect(validateE85Geometry(polygon([...ring(0, 0, 10, 10), [0, 0]])).valid).toBe(true);
  });

  test("an implicitly closed ring is valid, and agrees with the explicit spelling", () => {
    expect(validateE85Geometry(polygon(ring(0, 0, 10, 10))).valid).toBe(true);
    expect(e85PolygonRelation(polygon(ring(0, 0, 10, 10)), square(2, 2, 4, 4))).toBe(e85PolygonRelation(polygon([...ring(0, 0, 10, 10), [0, 0]]), square(2, 2, 4, 4)));
  });

  test("consecutive segments sharing an endpoint are expected, not a self-intersection", () => {
    // Every vertex of every ring is a point where two segments meet. A check
    // that missed this would report every well-formed polygon in existence as
    // self-intersecting, so it is worth an explicit test rather than trust.
    for (const shape of [square(0, 0, 10, 10), polygon(ring(0, 0, 1, 1)), HOLED_SQUARE()]) {
      expect(problemCodes(shape)).toEqual([]);
    }
  });

  test("a triangle — the smallest possible ring — is valid", () => {
    expect(
      problemCodes(
        polygon([
          [0, 0],
          [4, 0],
          [2, 3],
        ]),
      ),
    ).toEqual([]);
  });

  test("a concave polygon is valid: only self-INTERSECTION is refused, not concavity", () => {
    const lShape = polygon([
      [0, 0],
      [10, 0],
      [10, 4],
      [4, 4],
      [4, 10],
      [0, 10],
    ]);
    expect(problemCodes(lShape)).toEqual([]);
  });

  test("a repeated interior vertex is not treated as a self-intersection", () => {
    // A duplicated vertex is a spelling quirk of the source, not a topology
    // defect, and Phase 7 removes duplicate vertices from nobody's data. The
    // trap this guards: the repeat creates a zero-length segment that pushes two
    // genuinely consecutive segments two indices apart, so an adjacency test
    // done on raw indices reads their shared vertex as a crossing and rejects an
    // ordinary published polygon.
    const duplicated = polygon([
      [0, 0],
      [10, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]);
    expect(problemCodes(duplicated)).toEqual([]);
  });

  test("a repeated vertex changes no measurement either — the two ring readings agree", () => {
    const plain = polygon(ring(0, 0, 10, 10));
    const duplicated = polygon([
      [0, 0],
      [10, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 10],
    ]);
    expect(e85PolygonRelation(duplicated, square(2, 2, 4, 4))).toBe(e85PolygonRelation(plain, square(2, 2, 4, 4)));
    expect(e85LocatePointInPolygon([10, 5], duplicated)).toBe("BOUNDARY");
    expect(e85LocatePointInPolygon([5, 5], duplicated)).toBe("INTERIOR");
  });

  test("repeats do not pad a ring up to the three-position minimum", () => {
    // `[a, a, b]` spells three positions and bounds nothing.
    expect(problemCodes(polygon([[0, 0], [0, 0], [5, 5]] as never))).toEqual(["RING_TOO_FEW_POSITIONS"]);
  });

  test("a valid hole strictly inside its shell is supported", () => {
    expect(problemCodes(HOLED_SQUARE())).toEqual([]);
  });
});

describe("E85 Phase 7A — rings that meet themselves are refused", () => {
  test("a bow-tie exterior is rejected with a typed problem", () => {
    expect(problemCodes(BOW_TIE())).toEqual(["RING_SELF_INTERSECTION"]);
  });

  test("a non-adjacent crossing that is not a bow-tie is rejected too", () => {
    expect(problemCodes(SPIKE_RING())).toEqual(["RING_SELF_INTERSECTION"]);
  });

  test("a ring pinched to a point is rejected even though nothing crosses", () => {
    // Touching, not crossing. The conservative direction: the predicates are not
    // known to hold here, so the shape is refused rather than measured.
    expect(problemCodes(PINCHED_RING())).toEqual(["RING_SELF_INTERSECTION"]);
  });

  test("the problem names the offending segments, so a publisher can find them", () => {
    const validation = validateE85GeometryShape(BOW_TIE());
    expect(validation.valid).toBe(false);
    if (validation.valid) throw new Error("unreachable");
    expect(validation.problems[0].location).toBe("exterior");
    expect(validation.problems[0].detail).toContain("Non-adjacent segments");
    expect(validation.problems[0].detail).toContain("refused rather than measured");
  });

  test("the geometry is refused, never repaired: the caller's ring comes back untouched", () => {
    const bowTie = deepFreeze(BOW_TIE());
    const snapshot = JSON.stringify(bowTie);
    expect(() => validateE85GeometryShape(bowTie)).not.toThrow();
    expect(() => e85PolygonRelation(bowTie, square(2, 2, 4, 4))).not.toThrow();
    expect(JSON.stringify(bowTie)).toBe(snapshot);
  });
});

describe("E85 Phase 7A — interior rings outside the profile are refused", () => {
  test("a self-intersecting hole is rejected", () => {
    expect(problemCodes(SELF_INTERSECTING_HOLE())).toEqual(["RING_SELF_INTERSECTION"]);
  });

  test("a self-intersecting hole is reported against the hole, not the shell", () => {
    const validation = validateE85GeometryShape(SELF_INTERSECTING_HOLE());
    if (validation.valid) throw new Error("expected invalid");
    expect(validation.problems[0].location).toBe("interior[0]");
  });

  test("a hole lying outside its exterior is rejected", () => {
    expect(problemCodes(HOLE_OUTSIDE_EXTERIOR())).toEqual(["INTERIOR_RING_OUTSIDE_EXTERIOR"]);
  });

  test("a hole crossing the exterior boundary is rejected", () => {
    expect(problemCodes(HOLE_CROSSING_EXTERIOR())).toEqual(["INTERIOR_RING_CROSSES_EXTERIOR"]);
  });

  test("two holes whose boundaries cross are rejected", () => {
    expect(problemCodes(CROSSING_HOLES())).toEqual(["INTERIOR_RINGS_OVERLAP"]);
  });

  test("a hole nested inside another hole is rejected, though nothing crosses", () => {
    // Whether a parcel in the inner region is inside or outside the feature
    // depends on a fill rule nobody stated. Guessing would decide a regulatory
    // question by convention.
    expect(problemCodes(NESTED_HOLES())).toEqual(["INTERIOR_RINGS_OVERLAP"]);
  });

  test("the interior-ring contract survives: valid holes still work as holes", () => {
    // The remediation narrows what is accepted; it does not withdraw support for
    // interior rings. A point in the hole is still outside the polygon.
    expect(e85LocatePointInPolygon([4.5, 4.5], HOLED_SQUARE())).toBe("EXTERIOR");
    expect(e85LocatePointInPolygon([1, 1], HOLED_SQUARE())).toBe("INTERIOR");
    expect(e85LocatePointInPolygon([3, 4], HOLED_SQUARE())).toBe("BOUNDARY");
  });
});

describe("E85 Phase 7A — unsupported topology cannot reach the relation classifier", () => {
  const parcelShape = () => square(2, 2, 4, 4);

  test("point location refuses rather than ray-casting an undefined shape", () => {
    // Inside a bow-tie, "inside" has no single meaning: the two lobes wind
    // opposite ways. A crossing count would still return a boolean.
    expect(e85LocatePointInPolygon([5, 4], BOW_TIE())).toBe("UNDETERMINED");
    expect(e85LocatePointInPolygon([50, 50], BOW_TIE())).toBe("UNDETERMINED");
  });

  test("UNDETERMINED is not EXTERIOR — a shape that cannot be measured is not a shape a point is outside of", () => {
    expect(e85LocatePointInPolygon([50, 50], BOW_TIE())).not.toBe("EXTERIOR");
  });

  test("the polygon relation returns UNDETERMINED for a malformed feature", () => {
    expect(e85PolygonRelation(BOW_TIE(), parcelShape())).toBe("UNDETERMINED");
  });

  test("the polygon relation returns UNDETERMINED for a malformed parcel too — the guard is symmetric", () => {
    expect(e85PolygonRelation(ZONE_A(), BOW_TIE())).toBe("UNDETERMINED");
  });

  test("no malformed shape produces a normal relation, whatever its arrangement", () => {
    const malformed = [BOW_TIE(), SPIKE_RING(), PINCHED_RING(), SELF_INTERSECTING_HOLE(), HOLE_OUTSIDE_EXTERIOR(), HOLE_CROSSING_EXTERIOR(), CROSSING_HOLES(), NESTED_HOLES()];
    for (const shape of malformed) {
      expect({ shape: JSON.stringify(shape.exterior), relation: e85PolygonRelation(shape, parcelShape()) }).toEqual({ shape: JSON.stringify(shape.exterior), relation: "UNDETERMINED" });
      expect(e85GeometryRelation(shape, point(5, 5))).toBe("UNDETERMINED");
      expect(e85GeometryRelation(point(5, 5), shape)).toBe("UNDETERMINED");
    }
  });

  test("the refusal is not an accident of position: a bow-tie that plainly encloses the parcel still refuses", () => {
    // Were the guard absent, the vertex tests would happily report CONTAINS.
    expect(e85PolygonRelation(BOW_TIE(), square(4, 1, 6, 3))).toBe("UNDETERMINED");
  });

  test("malformed topology gives the same typed result every time", () => {
    const results = Array.from({ length: 5 }, () => e85PolygonRelation(BOW_TIE(), parcelShape()));
    expect(new Set(results).size).toBe(1);
    expect(results[0]).toBe("UNDETERMINED");
  });

  test("a valid polygon is unaffected by the guard", () => {
    expect(e85PolygonRelation(ZONE_A(), parcelShape())).toBe("CONTAINS");
    expect(e85PolygonRelation(HOLED_SQUARE(), square(1, 1, 2, 2))).toBe("CONTAINS");
  });
});

describe("E85 Phase 7A — malformed topology at the applicability layer", () => {
  function resolve(request: Parameters<typeof resolveE85SpatialApplicability>[0]) {
    return resolveE85SpatialApplicability({ resolvedAt: RESOLVED_AT, registry: createE85SpatialDatasetRegistry(STANDARD_DATASETS()), ...request });
  }

  const bowTieZone = () => feature({ featureId: "zone-bowtie", geometry: BOW_TIE(), rulePackIds: ["base-bowtie"] });

  test("a malformed feature selects nothing", () => {
    const r = resolve({ parcel: PARCEL_IN_A(), features: [bowTieZone()] });
    expect(r.applicableRulePackIds).toEqual([]);
    expect(r.ambiguousRulePackIds).toEqual([]);
  });

  test("the exclusion is typed and specific, naming self-intersection rather than 'invalid'", () => {
    const r = resolve({ parcel: PARCEL_IN_A(), features: [bowTieZone()] });
    const finding = r.findings.find((f) => f.code === "GEOMETRY_INVALID");
    expect(finding?.severity).toBe("GAP");
    expect(finding?.gap?.reason).toContain("RING_SELF_INTERSECTION");
  });

  test("malformed topology is never reported as DISJOINT — the comparison never happened", () => {
    const r = resolve({ parcel: PARCEL_IN_A(), features: [bowTieZone()] });
    expect(r.hits[0].relation).toBe("UNDETERMINED");
    expect(r.hits[0].relation).not.toBe("DISJOINT");
    expect(r.hits[0].applicability).toBe("UNDETERMINED");
  });

  test("malformed topology does NOT produce ZONING_NOT_FOUND — zoning was never disproven", () => {
    const r = resolve({ parcel: PARCEL_IN_A(), features: [bowTieZone()] });
    expect(r.dataGaps.some((g) => g.reasonCode === "ZONING_NOT_FOUND")).toBe(false);
    expect(r.findings.some((f) => f.code === "NO_BASE_ZONE_MATCH")).toBe(false);
    expect(r.dataGaps.some((g) => g.reasonCode === "GEOMETRY_UNAVAILABLE")).toBe(true);
  });

  test("a malformed parcel stops the comparison rather than being measured anyway", () => {
    const r = resolve({ parcel: parcel(BOW_TIE()), features: [FEATURE_A()] });
    expect(r.status).toBe("DATA_GAP");
    expect(r.applicableRulePackIds).toEqual([]);
    expect(r.dataGaps[0].reason).toContain("RING_SELF_INTERSECTION");
    expect(r.dataGaps[0].resolutionHint).toContain("does not repair");
  });

  test("one malformed feature does not sink the layers around it", () => {
    const r = resolve({ parcel: PARCEL_IN_A(), features: [FEATURE_A(), bowTieZone()] });
    expect(r.applicableRulePackIds).toEqual(["base-a"]);
    expect(r.findings.some((f) => f.code === "GEOMETRY_INVALID")).toBe(true);
  });

  test("every malformed shape is refused at the applicability layer, not only the bow-tie", () => {
    const shapes: readonly [string, E85PolygonGeometry][] = [
      ["spike", SPIKE_RING()],
      ["pinched", PINCHED_RING()],
      ["self-intersecting-hole", SELF_INTERSECTING_HOLE()],
      ["hole-outside", HOLE_OUTSIDE_EXTERIOR()],
      ["hole-crossing", HOLE_CROSSING_EXTERIOR()],
      ["crossing-holes", CROSSING_HOLES()],
      ["nested-holes", NESTED_HOLES()],
    ];
    for (const [name, geometry] of shapes) {
      const r = resolve({ parcel: PARCEL_IN_A(), features: [feature({ featureId: name, geometry, rulePackIds: [`pack-${name}`] })] });
      expect({ name, packs: r.applicableRulePackIds, relation: r.hits[0].relation, notFound: r.dataGaps.some((g) => g.reasonCode === "ZONING_NOT_FOUND") }).toEqual({
        name,
        packs: [],
        relation: "UNDETERMINED",
        notFound: false,
      });
    }
  });

  test("resolution never throws on malformed topology, and repeats byte-identically", () => {
    const p = deepFreeze(PARCEL_IN_A());
    const f = deepFreeze([FEATURE_A(), bowTieZone()]);
    expect(() => resolve({ parcel: p, features: f })).not.toThrow();
    expect(JSON.stringify(resolve({ parcel: p, features: f }))).toBe(JSON.stringify(resolve({ parcel: p, features: f })));
  });

  test("supply order does not change how malformed topology is reported", () => {
    const forward = resolve({ parcel: PARCEL_IN_A(), features: [FEATURE_A(), bowTieZone()] });
    const reverse = resolve({ parcel: PARCEL_IN_A(), features: [bowTieZone(), FEATURE_A()] });
    expect(JSON.stringify(forward)).toBe(JSON.stringify(reverse));
  });
});

describe("E85 Phase 7A — the shape gate and the comparability gate stay separate", () => {
  test("a polygon with no declared CRS is still a measurable shape", () => {
    // Whether coordinates can be COMPARED WITH ANOTHER dataset is the
    // applicability layer's question; whether the arithmetic is defined for this
    // shape is the relation layer's. Conflating them would make the geometry
    // predicates refuse perfectly well-formed polygons.
    const noCrs = { type: "POLYGON" as const, crs: undefined as never, exterior: ring(0, 0, 10, 10) };
    expect(validateE85GeometryShape(noCrs).valid).toBe(true);
    expect(validateE85Geometry(noCrs).valid).toBe(false);
  });

  test("the full validator reports the missing CRS and the topology defect together", () => {
    const validation = validateE85Geometry({ type: "POLYGON", crs: undefined as never, exterior: BOW_TIE().exterior });
    if (validation.valid) throw new Error("expected invalid");
    expect(validation.problems.map((p) => p.code).sort()).toEqual(["CRS_MISSING", "RING_SELF_INTERSECTION"]);
  });

  test("structural failure short-circuits topology rather than reporting a symptom of it", () => {
    // A two-position ring cannot meaningfully be asked whether it crosses
    // itself, so it is reported as too small and not also as self-intersecting.
    expect(problemCodes(polygon([[0, 0], [1, 1]] as never))).toEqual(["RING_TOO_FEW_POSITIONS"]);
  });

  test("a non-finite coordinate is reported as such, not as a topology failure", () => {
    expect(problemCodes(polygon([[0, 0], [Number.NaN, 1], [2, 2]] as never))).toEqual(["INVALID_COORDINATE"]);
  });

  test("a point geometry has no topology to check and stays valid", () => {
    expect(validateE85Geometry(point(5, 5)).valid).toBe(true);
    expect(validateE85GeometryShape({ type: "POINT", crs: CRS, coordinates: [Number.POSITIVE_INFINITY, 1] }).valid).toBe(false);
  });
});

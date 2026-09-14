/**
 * InvestScape™ E85 Phase 7 — geometry validation & relationship tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Pure geometry, tested on synthetic coordinates. The emphasis throughout is
 * the boundary: almost every wrong regulatory answer a spatial layer can give
 * starts with a predicate quietly deciding that touching counts as being
 * inside.
 */
import {
  validateE85Geometry,
  formatE85GeometryProblems,
  e85LocatePointInPolygon,
  e85PolygonRelation,
  e85GeometryRelation,
  e85RelationHasSharedArea,
  e85CanonicalRing,
  e85CrsMatches,
  resolveE85Tolerance,
  E85_DEFAULT_SPATIAL_TOLERANCE,
  E85PolygonGeometry,
} from "../../src/zoning-land-use-engine";
import { CRS, OTHER_CRS, ZONE_A, ZONE_B, OVERLAY_X, square, squareReversedClosed, point, pos } from "./fixtures/spatial-features";

describe("E85 Phase 7 geometry — structural validation", () => {
  test("a well-formed polygon validates", () => {
    expect(validateE85Geometry(ZONE_A())).toEqual({ valid: true });
  });

  test("a ring with too few positions is rejected, not padded", () => {
    const result = validateE85Geometry({ type: "POLYGON", crs: CRS, exterior: [pos(0, 0), pos(1, 1)] });
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("unreachable");
    expect(result.problems[0].code).toBe("RING_TOO_FEW_POSITIONS");
  });

  test("a repeated closing position does not count toward the minimum", () => {
    // Three entries, but only two distinct — a closed line, not a ring.
    const result = validateE85Geometry({ type: "POLYGON", crs: CRS, exterior: [pos(0, 0), pos(1, 1), pos(0, 0)] });
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("unreachable");
    expect(result.problems[0].code).toBe("RING_TOO_FEW_POSITIONS");
  });

  test("non-finite coordinates are rejected", () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      const result = validateE85Geometry({ type: "POLYGON", crs: CRS, exterior: [[0, 0], [10, bad], [10, 10], [0, 10]] as never });
      expect(result.valid).toBe(false);
      if (result.valid) throw new Error("unreachable");
      expect(result.problems.some((p) => p.code === "INVALID_COORDINATE")).toBe(true);
    }
  });

  test("a 3D coordinate is rejected rather than flattened — dropping an ordinate would change the geometry silently", () => {
    const result = validateE85Geometry({ type: "POLYGON", crs: CRS, exterior: [[0, 0, 5], [10, 0], [10, 10], [0, 10]] as never });
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("unreachable");
    expect(result.problems[0].code).toBe("INVALID_COORDINATE");
    expect(result.problems[0].detail).toContain("3 ordinates supplied");
  });

  test("an unsupported geometry type is reported rather than ignored", () => {
    const result = validateE85Geometry({ type: "LINESTRING", crs: CRS } as never);
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("unreachable");
    expect(result.problems.some((p) => p.code === "UNSUPPORTED_GEOMETRY_TYPE")).toBe(true);
  });

  test("a missing CRS is its own problem — coordinates mean nothing without one", () => {
    const result = validateE85Geometry({ type: "POLYGON", crs: { crsId: "  " }, exterior: ZONE_A().exterior });
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("unreachable");
    expect(result.problems.some((p) => p.code === "CRS_MISSING")).toBe(true);
  });

  test("every problem is reported in one pass, not just the first", () => {
    const result = validateE85Geometry({ type: "POLYGON", crs: { crsId: "" }, exterior: [pos(0, 0), pos(1, 1)] });
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("unreachable");
    expect(result.problems.length).toBeGreaterThan(1);
    expect(formatE85GeometryProblems(result.problems)).toContain("CRS_MISSING");
  });

  test("absent geometry validates as absent rather than throwing", () => {
    expect(validateE85Geometry(undefined).valid).toBe(false);
  });

  test("validation never throws on malformed input — bad municipal data is ordinary", () => {
    const malformed = [{ type: "POLYGON", crs: CRS, exterior: [] }, { type: "POLYGON", crs: CRS, exterior: [null] }, { type: "POINT", crs: CRS, coordinates: "x" }];
    for (const geometry of malformed) {
      expect(() => validateE85Geometry(geometry as never)).not.toThrow();
    }
  });

  test("interior rings are validated too, and located by index", () => {
    const result = validateE85Geometry({ type: "POLYGON", crs: CRS, exterior: ZONE_A().exterior, interiors: [[pos(1, 1), pos(2, 2)]] });
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("unreachable");
    expect(result.problems[0].location).toBe("interior[0]");
  });
});

describe("E85 Phase 7 geometry — ring closure convention", () => {
  test("an explicitly closed ring and an unclosed one are the same ring", () => {
    expect(e85CanonicalRing([pos(0, 0), pos(1, 0), pos(1, 1), pos(0, 0)])).toHaveLength(3);
    expect(e85CanonicalRing([pos(0, 0), pos(1, 0), pos(1, 1)])).toHaveLength(3);
  });

  test("both spellings of one square produce identical relationships", () => {
    const parcel = square(2, 2, 4, 4);
    expect(e85PolygonRelation(square(0, 0, 10, 10), parcel)).toBe("CONTAINS");
    expect(e85PolygonRelation(squareReversedClosed(0, 0, 10, 10), parcel)).toBe("CONTAINS");
  });
});

describe("E85 Phase 7 geometry — point in polygon", () => {
  const zone = ZONE_A();

  test("a point well inside is INTERIOR", () => {
    expect(e85LocatePointInPolygon(pos(5, 5), zone)).toBe("INTERIOR");
  });

  test("a point well outside is EXTERIOR", () => {
    expect(e85LocatePointInPolygon(pos(50, 50), zone)).toBe("EXTERIOR");
  });

  test("a point on an edge is BOUNDARY, never rounded into the zone or out of it", () => {
    expect(e85LocatePointInPolygon(pos(10, 5), zone)).toBe("BOUNDARY");
    expect(e85LocatePointInPolygon(pos(5, 0), zone)).toBe("BOUNDARY");
  });

  test("every vertex is BOUNDARY — the classic ray-casting ambiguity", () => {
    for (const vertex of [pos(0, 0), pos(10, 0), pos(10, 10), pos(0, 10)]) {
      expect(e85LocatePointInPolygon(vertex, zone)).toBe("BOUNDARY");
    }
  });

  test("a point inside a hole is EXTERIOR — a hole is not part of the polygon", () => {
    const withHole: E85PolygonGeometry = { ...ZONE_A(), interiors: [square(4, 4, 6, 6).exterior] };
    expect(e85LocatePointInPolygon(pos(5, 5), withHole)).toBe("EXTERIOR");
    expect(e85LocatePointInPolygon(pos(2, 2), withHole)).toBe("INTERIOR");
  });

  test("a point on a hole's edge is BOUNDARY", () => {
    const withHole: E85PolygonGeometry = { ...ZONE_A(), interiors: [square(4, 4, 6, 6).exterior] };
    expect(e85LocatePointInPolygon(pos(4, 5), withHole)).toBe("BOUNDARY");
  });
});

describe("E85 Phase 7 geometry — polygon relationships", () => {
  test("a parcel wholly inside a zone is CONTAINS", () => {
    expect(e85PolygonRelation(ZONE_A(), square(2, 2, 4, 4))).toBe("CONTAINS");
  });

  test("a parcel straddling two zones INTERSECTS each of them", () => {
    const split = square(8, 2, 12, 4);
    expect(e85PolygonRelation(ZONE_A(), split)).toBe("INTERSECTS");
    expect(e85PolygonRelation(ZONE_B(), split)).toBe("INTERSECTS");
  });

  test("adjacent zones sharing an edge only TOUCH — never CONTAINS, never INTERSECTS", () => {
    expect(e85PolygonRelation(ZONE_A(), ZONE_B())).toBe("BOUNDARY_TOUCH");
    expect(e85PolygonRelation(ZONE_B(), ZONE_A())).toBe("BOUNDARY_TOUCH");
  });

  test("a parcel whose edge lies on the zone boundary but which sits outside only TOUCHES", () => {
    expect(e85PolygonRelation(ZONE_A(), square(10, 2, 12, 4))).toBe("BOUNDARY_TOUCH");
  });

  test("polygons meeting at a single vertex only TOUCH", () => {
    expect(e85PolygonRelation(ZONE_A(), square(10, 10, 12, 12))).toBe("BOUNDARY_TOUCH");
  });

  test("a distant parcel is DISJOINT, which is not the same as UNDETERMINED", () => {
    expect(e85PolygonRelation(ZONE_A(), square(30, 30, 32, 32))).toBe("DISJOINT");
  });

  test("identical polygons are CONTAINS, not a boundary touch", () => {
    expect(e85PolygonRelation(ZONE_A(), ZONE_A())).toBe("CONTAINS");
  });

  test("a feature smaller than and inside the parcel INTERSECTS — it does not contain the parcel", () => {
    expect(e85PolygonRelation(square(4, 4, 6, 6), ZONE_A())).toBe("INTERSECTS");
  });

  test("an overlay crossing a zone INTERSECTS a parcel it partly covers", () => {
    expect(e85PolygonRelation(OVERLAY_X(), square(2, 2, 6, 6))).toBe("INTERSECTS");
  });

  test("a parcel inside a hole is DISJOINT from the polygon", () => {
    const withHole: E85PolygonGeometry = { ...ZONE_A(), interiors: [square(3, 3, 7, 7).exterior] };
    expect(e85PolygonRelation(withHole, square(4, 4, 6, 6))).toBe("DISJOINT");
  });

  test("shared area is recognised only for CONTAINS and INTERSECTS", () => {
    expect(e85RelationHasSharedArea("CONTAINS")).toBe(true);
    expect(e85RelationHasSharedArea("INTERSECTS")).toBe(true);
    expect(e85RelationHasSharedArea("BOUNDARY_TOUCH")).toBe(false);
    expect(e85RelationHasSharedArea("DISJOINT")).toBe(false);
    expect(e85RelationHasSharedArea("UNDETERMINED")).toBe(false);
  });

  test("ring orientation never changes the answer", () => {
    const parcel = square(2, 2, 4, 4);
    const parcelReversed = squareReversedClosed(2, 2, 4, 4);
    for (const zone of [ZONE_A(), squareReversedClosed(0, 0, 10, 10)]) {
      for (const p of [parcel, parcelReversed]) {
        expect(e85PolygonRelation(zone, p)).toBe("CONTAINS");
      }
    }
  });
});

describe("E85 Phase 7 geometry — point parcels", () => {
  test("a pin inside a zone gives CONTAINS", () => {
    expect(e85GeometryRelation(ZONE_A(), point(5, 5))).toBe("CONTAINS");
  });

  test("a pin on the boundary gives BOUNDARY_TOUCH, not containment", () => {
    expect(e85GeometryRelation(ZONE_A(), point(10, 5))).toBe("BOUNDARY_TOUCH");
  });

  test("a pin on a vertex gives BOUNDARY_TOUCH", () => {
    expect(e85GeometryRelation(ZONE_A(), point(0, 0))).toBe("BOUNDARY_TOUCH");
  });

  test("a pin outside gives DISJOINT", () => {
    expect(e85GeometryRelation(ZONE_A(), point(50, 50))).toBe("DISJOINT");
  });

  test("a zero-area feature never CONTAINS a parcel — it can only meet it", () => {
    expect(e85GeometryRelation(point(5, 5), square(0, 0, 10, 10))).toBe("INTERSECTS");
    expect(e85GeometryRelation(point(50, 50), square(0, 0, 10, 10))).toBe("DISJOINT");
  });

  test("coincident points are CONTAINS and separated points are DISJOINT", () => {
    expect(e85GeometryRelation(point(1, 1), point(1, 1))).toBe("CONTAINS");
    expect(e85GeometryRelation(point(1, 1), point(2, 2))).toBe("DISJOINT");
  });
});

describe("E85 Phase 7 geometry — tolerance is declared once and never hidden", () => {
  test("the default applies when nothing is supplied, and is documented as tiny", () => {
    expect(resolveE85Tolerance(undefined)).toBe(E85_DEFAULT_SPATIAL_TOLERANCE);
    expect(E85_DEFAULT_SPATIAL_TOLERANCE).toBeLessThan(1e-6);
  });

  test("a caller-supplied tolerance is honoured", () => {
    expect(resolveE85Tolerance({ onSegmentDistance: 0.5 })).toBe(0.5);
    expect(resolveE85Tolerance({ onSegmentDistance: 0 })).toBe(0);
  });

  test("a nonsensical tolerance falls back to the default rather than corrupting a comparison", () => {
    for (const bad of [NaN, -1, Infinity]) {
      expect(resolveE85Tolerance({ onSegmentDistance: bad })).toBe(E85_DEFAULT_SPATIAL_TOLERANCE);
    }
  });

  test("boundary sensitivity follows the declared tolerance, in coordinate units", () => {
    const zone = ZONE_A();
    // A point 0.1 units outside the x=10 edge.
    const nearlyOn = pos(10.1, 5);
    expect(e85LocatePointInPolygon(nearlyOn, zone)).toBe("EXTERIOR");
    expect(e85LocatePointInPolygon(nearlyOn, zone, { onSegmentDistance: 0.2 })).toBe("BOUNDARY");
  });

  test("the default tolerance does not widen a real gap into contact", () => {
    expect(e85PolygonRelation(ZONE_A(), square(10.0001, 2, 12, 4))).toBe("DISJOINT");
  });
});

describe("E85 Phase 7 geometry — CRS identity", () => {
  test("identical CRS ids match", () => {
    expect(e85CrsMatches(CRS, { ...CRS })).toBe(true);
  });

  test("different CRS ids do not match", () => {
    expect(e85CrsMatches(CRS, OTHER_CRS)).toBe(false);
  });

  test("no aliasing: two spellings of one authority code are treated as different", () => {
    // Erring toward refusing a comparison beats erring toward a wrong location.
    expect(e85CrsMatches({ crsId: "EPSG:4326" }, { crsId: "urn:ogc:def:crs:EPSG::4326" })).toBe(false);
    expect(e85CrsMatches({ crsId: "epsg:4326" }, { crsId: "EPSG:4326" })).toBe(false);
  });

  test("an absent CRS never matches anything, including another absent one", () => {
    expect(e85CrsMatches(undefined, CRS)).toBe(false);
    expect(e85CrsMatches(undefined, undefined)).toBe(false);
  });
});

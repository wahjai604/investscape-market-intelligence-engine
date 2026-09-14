/**
 * InvestScape™ E85 Phase 10 — City of Vancouver zoning snapshot: a SOURCE-DERIVED
 * test fixture.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * ATTRIBUTION — required by clause 4 of the licence these records are used under:
 *
 *   Contains information licensed under the Open Government Licence – Vancouver.
 *
 * Publisher: City of Vancouver (also the data owner)
 * Source:    City of Vancouver Open Data Portal, dataset `zoning-districts-and-labels`
 *            https://opendata.vancouver.ca/explore/dataset/zoning-districts-and-labels/
 * Export:    GeoJSON, "Export geographical coordinates as: EPSG:26910"
 * Release:   dataset Modified / Last processing (data) 2026-06-29
 *            (E85 release label: "2026-06-29-data-processing" — see below)
 * Licence:   Open Government Licence – Vancouver, version 1.0, published on the
 *            same portal and linked from this dataset's Information page.
 *
 * The release label is E85's own, derived from the City's data-processing state.
 * The City has not been shown to publish an immutable formal release number, and
 * none is claimed here.
 *
 * No City logo, crest, or official mark is reproduced, and no endorsement by the
 * City of Vancouver is claimed or implied — clauses 6(d) and 7 of the licence.
 *
 * FIVE RECORDS OUT OF 1,621, AND NOT ONE COORDINATE ALTERED. The whole
 * municipal layer is deliberately NOT committed: the licence would permit it,
 * but a 2.6 MB authoritative dataset living in a source repository goes stale
 * silently, and a stale copy of a zoning layer is worse than no copy. These five
 * are reproduced verbatim from the captured export — every easting and northing
 * to the last digit the City published, every attribute value as spelled,
 * including the nulls. Nothing is rounded, simplified, re-wound, closed or
 * redrawn, because a fixture that "tidied" an authoritative boundary would prove
 * the adapter works on data no publisher ever issued.
 *
 * Each record earns its place by exercising a different real behaviour:
 *
 *   494787  R1-1        the zone the Phase 5 pilot structured; a 3-vertex triangle,
 *                       the smallest R1-1 polygon in the release
 *   494642  C-2C        an ordinary non-R1 district, to prove nothing is R1-shaped
 *   495494  CD-1 (423)  a real site-specific CD-1 instrument, cd_1_number "423"
 *   494597  RM-5        a polygon WITH an interior ring that Phase 7 ACCEPTS
 *   494885  RM-4        a polygon whose interior ring touches its exterior — Phase 7
 *                       REFUSES it, and Phase 8 quarantines it unrepaired
 *
 * The last two are the pair that matters. They differ only in whether the hole
 * is strictly inside the shell, so together they prove the topology gate is
 * discriminating on real municipal data rather than rejecting every hole.
 *
 * THE PARCEL GEOMETRIES BELOW ARE SYNTHETIC AND ARE NOT CIVIC PARCELS. They are
 * small squares placed inside real zoning polygons to drive the applicability
 * comparison. No parcel fabric was consulted; no lot, address, PID or legal
 * description is asserted, and none of these squares corresponds to any real
 * property in Vancouver.
 */
import type { E85ParcelSpatialReference } from "../../../src/zoning-land-use-engine";
import type { E85RawSpatialFeatureRecord, E85RawSpatialSourceSnapshot } from "../../../src/zoning-land-use-engine";
import {
  VANCOUVER_SPATIAL_JURISDICTION_ID,
  VANCOUVER_ZONING_CRS,
  VANCOUVER_ZONING_DATASET_ID,
  VANCOUVER_ZONING_RELEASE,
} from "../../../src/zoning-land-use-engine/adapters/spatial/vancouver";

/** Caller-supplied so no stage reads a clock. Not a City timestamp and not a claim about when anything was published. */
export const VANCOUVER_NORMALIZED_AT = "2026-09-14T00:00:00.000Z";
export const VANCOUVER_RESOLVED_AT = "2026-09-14T00:00:00.000Z";

/** A label for the captured local artefact. NOT a City release id, and not a content hash. */
export const VANCOUVER_SNAPSHOT_ID = "vancouver-zoning-2026-06-29-pilot-subset";

/* ------------------------------------------------------------------------- *
 * Real records, verbatim.
 * ------------------------------------------------------------------------- */

/** R1-1 — the district the Phase 5 pilot structured. Smallest R1-1 polygon in the release: one triangle. */
export const VAN_R1_1: E85RawSpatialFeatureRecord = {
  rawFeatureId: "494787",
  rawAttributes: {
    object_id: "494787",
    zoning_classification: "Residential Inclusive",
    zoning_category: "R1",
    zoning_district: "R1-1",
    cd_1_number: null,
    geo_point_2d: { lon: 493446.31206164643, lat: 5456033.108736394 },
  },
  rawGeometry: {
    type: "Polygon",
    coordinates: [
      [
        [493493.43189987674, 5456046.973596323],
        [493461.6913998776, 5455998.377196321],
        [493383.8130998753, 5456053.975996323],
        [493493.43189987674, 5456046.973596323],
      ],
    ],
  },
};

/** C-2C — an ordinary commercial district, present so the pilot is not shaped around R1-1 alone. */
export const VAN_C_2C: E85RawSpatialFeatureRecord = {
  rawFeatureId: "494642",
  rawAttributes: {
    object_id: "494642",
    zoning_classification: "Commercial",
    zoning_category: "C",
    zoning_district: "C-2C",
    cd_1_number: null,
    geo_point_2d: { lon: 491611.88279746583, lat: 5456331.002957996 },
  },
  rawGeometry: {
    type: "Polygon",
    coordinates: [
      [
        [491591.6489998412, 5456357.168196322],
        [491633.4747998415, 5456356.043296325],
        [491632.1029998433, 5456304.834896323],
        [491590.3054998409, 5456305.953796325],
        [491591.6489998412, 5456357.168196322],
      ],
    ],
  },
};

/**
 * CD-1 (423) — a real site-specific Comprehensive Development district.
 *
 * `cd_1_number` is "423" and `zoning_district` is "CD-1 (423)". E85 holds no
 * rule pack for it, and the number is NOT turned into one.
 */
export const VAN_CD_1_423: E85RawSpatialFeatureRecord = {
  rawFeatureId: "495494",
  rawAttributes: {
    object_id: "495494",
    zoning_classification: "Comprehensive Development",
    zoning_category: "CD",
    zoning_district: "CD-1 (423)",
    cd_1_number: "423",
    geo_point_2d: { lon: 490462.122007983, lat: 5458091.427428707 },
  },
  rawGeometry: {
    type: "Polygon",
    coordinates: [
      [
        [490481.4477998207, 5458146.142196331],
        [490516.124599821, 5458110.541296334],
        [490443.1249998193, 5458036.953396333],
        [490407.8801998182, 5458071.982196334],
        [490481.4477998207, 5458146.142196331],
      ],
    ],
  },
};

/** RM-5 — a real polygon with one interior ring strictly inside its exterior. Phase 7 ACCEPTS it. */
export const VAN_RM_5_WITH_HOLE: E85RawSpatialFeatureRecord = {
  rawFeatureId: "494597",
  rawAttributes: {
    object_id: "494597",
    zoning_classification: "Residential",
    zoning_category: "RM",
    zoning_district: "RM-5",
    cd_1_number: null,
    geo_point_2d: { lon: 490292.9617539739, lat: 5459275.754724165 },
  },
  rawGeometry: {
    type: "Polygon",
    coordinates: [
      [
        [490427.3600998204, 5459516.592096339],
        [490512.852899821, 5459431.687396339],
        [490612.8106998232, 5459332.418596338],
        [490574.088899823, 5459293.389696339],
        [490535.3481998206, 5459254.3417963395],
        [490496.6394998195, 5459215.326996336],
        [490457.8498998201, 5459176.20909634],
        [490419.08829981915, 5459137.120096337],
        [490380.4366998192, 5459098.141196336],
        [490341.7240998188, 5459059.102296336],
        [490303.0124998179, 5459020.062396337],
        [490263.7958998173, 5458981.287496336],
        [490225.35639981634, 5458941.886496338],
        [490125.6976998142, 5459041.1028963365],
        [490090.0136998132, 5459076.506796335],
        [490040.07859981223, 5459126.130596337],
        [490078.78209981334, 5459165.179596338],
        [489993.1828998124, 5459250.292296339],
        [490031.84849981265, 5459289.358296337],
        [490070.5741998118, 5459328.43819634],
        [490109.2437998133, 5459367.553096341],
        [490147.9464998147, 5459406.60809634],
        [490186.61919981404, 5459445.676996342],
        [490225.27299981634, 5459484.767896337],
        [490264.0716998175, 5459523.74989634],
        [490302.78649981704, 5459562.814896339],
        [490341.50319981884, 5459601.85589634],
        [490427.3600998204, 5459516.592096339],
      ],
      [
        [490241.2420998161, 5459229.424896339],
        [490213.1633998163, 5459201.088696337],
        [490205.9962998147, 5459193.875796337],
        [490241.8352998166, 5459158.264796338],
        [490280.5518998177, 5459197.328696339],
        [490244.7097998156, 5459232.924396338],
        [490241.2420998161, 5459229.424896339],
      ],
    ],
  },
};

/**
 * RM-4 — a real polygon whose interior ring MEETS its exterior ring.
 *
 * Both rings contain the position [495203.5878999095, 5456460.076396325]. That
 * shared coordinate is an exact, checkable observation about THIS record, and it
 * is why Phase 7 cannot determine the shape's interior: whether the touching
 * region is solid or void depends on a fill rule nobody stated.
 *
 * It is in the fixture because it falls OUTSIDE E85's current topology profile —
 * not because it is asserted to be a municipal error. No independent GIS validity
 * assessment was made of this polygon, and a tool applying a different fill rule
 * might well accept it. What the fixture proves is that E85 refuses what it
 * cannot read unambiguously, and refuses it without altering a coordinate.
 */
export const VAN_RM_4_HOLE_TOUCHES_SHELL: E85RawSpatialFeatureRecord = {
  rawFeatureId: "494885",
  rawAttributes: {
    object_id: "494885",
    zoning_classification: "Residential",
    zoning_category: "RM",
    zoning_district: "RM-4",
    cd_1_number: null,
    geo_point_2d: { lon: 495151.4187101539, lat: 5456401.374751439 },
  },
  rawGeometry: {
    type: "Polygon",
    coordinates: [
      [
        [495203.5878999095, 5456460.076396325],
        [495302.10309991136, 5456458.3632963225],
        [495308.2016999113, 5456458.257196324],
        [495347.1484999118, 5456434.774996325],
        [495347.0876999122, 5456430.783296323],
        [495346.8976999114, 5456418.311396322],
        [495343.7286999128, 5456408.298396324],
        [495343.513699913, 5456392.2770963255],
        [495343.0525999119, 5456357.929596324],
        [495342.4405999127, 5456308.837796324],
        [495248.8051999107, 5456308.8099963255],
        [495201.5814999103, 5456309.265996324],
        [495154.3098999085, 5456309.884096322],
        [494990.4967999051, 5456312.030296327],
        [494978.7359999042, 5456312.184396324],
        [494979.05609990505, 5456362.359196325],
        [494961.4499999054, 5456362.585396323],
        [494961.7973999043, 5456422.855896323],
        [494962.29749990534, 5456460.075696326],
        [494962.3468999045, 5456463.132496324],
        [494977.9011999047, 5456462.928896324],
        [494982.4392999054, 5456462.869596325],
        [495023.0469999056, 5456462.356596323],
        [495069.2688999061, 5456461.7727963235],
        [495069.2962999061, 5456463.295996324],
        [495069.34629990807, 5456464.795996324],
        [495069.84729990736, 5456502.025796324],
        [495069.96959990775, 5456512.177396325],
        [495115.66189990815, 5456511.611096325],
        [495115.79579990776, 5456521.545396323],
        [495116.296799908, 5456558.695296323],
        [495116.4967999074, 5456575.995196326],
        [495152.79539990815, 5456553.696096323],
        [495192.3440999093, 5456529.386196324],
        [495204.41129990853, 5456521.964396325],
        [495204.2588999103, 5456510.513196325],
        [495203.5878999095, 5456460.076396325],
      ],
      [
        [495203.5878999095, 5456460.076396325],
        [495165.2459999098, 5456460.560896327],
        [495123.18579990865, 5456461.092196323],
        [495123.14499990735, 5456458.143896324],
        [495122.6309999081, 5456420.964896325],
        [495122.6309999076, 5456410.793996326],
        [495164.5289999087, 5456410.270896323],
        [495202.9199999088, 5456409.832896324],
        [495203.5878999095, 5456460.076396325],
      ],
    ],
  },
};

export const VANCOUVER_PILOT_RECORDS: readonly E85RawSpatialFeatureRecord[] = [VAN_R1_1, VAN_C_2C, VAN_CD_1_423, VAN_RM_5_WITH_HOLE, VAN_RM_4_HOLE_TOUCHES_SHELL];

/* ------------------------------------------------------------------------- *
 * Snapshots.
 * ------------------------------------------------------------------------- */

/**
 * The snapshot as Phase 8 receives it.
 *
 * `retrievedAt` IS DELIBERATELY ABSENT. The only local evidence of when these
 * bytes were obtained is a file modification time on one workstation, which is
 * a fact about a disk rather than a witnessed retrieval, and the contract is
 * explicit that E85 never stamps a retrieval time it did not witness. An absent
 * timestamp is the honest record; a plausible one would be indistinguishable
 * downstream from an observed one.
 *
 * `declaredCrs` IS PRESENT, and it is the City's own spelling, copied from the
 * `crs` member the EPSG:26910 export carries in the file itself.
 */
export function vancouverSnapshot(records: readonly E85RawSpatialFeatureRecord[] = VANCOUVER_PILOT_RECORDS): E85RawSpatialSourceSnapshot {
  return {
    snapshotId: VANCOUVER_SNAPSHOT_ID,
    datasetId: VANCOUVER_ZONING_DATASET_ID,
    datasetVersionId: VANCOUVER_ZONING_RELEASE,
    jurisdictionId: VANCOUVER_SPATIAL_JURISDICTION_ID,
    sourceSystem: "GEOJSON",
    declaredCrs: VANCOUVER_ZONING_CRS,
    rawFeatures: records,
    sourceMetadata: {
      attribution: "Contains information licensed under the Open Government Licence – Vancouver.",
      licenceName: "Open Government Licence – Vancouver",
      licenceVersion: "1.0",
      publisher: "City of Vancouver",
      publisherDatasetIdentifier: "zoning-districts-and-labels",
      datasetUrl: "https://opendata.vancouver.ca/explore/dataset/zoning-districts-and-labels/",
      cityModified: "2026-06-29",
      cityLastProcessingData: "2026-06-29",
      cityLastProcessingMetadata: "2026-09-14",
      // Publication context. Not a legal effective date and not a freshness guarantee.
      cityStatedExtractCadence: "weekly",
      // Positional-precision context. Not a statement that any geometry is invalid.
      cityStatedDataAccuracy: "Some City data is created using survey accuracy; some features are not as precise.",
      exportCrsSelection: "EPSG:26910",
      fullReleaseRecordCount: 1621,
      recordsInThisFixture: 5,
    },
  };
}

/* ------------------------------------------------------------------------- *
 * Synthetic parcels. NOT civic parcels — see the file header.
 * ------------------------------------------------------------------------- */

/** A square in the layer's own CRS, in metres. Synthetic throughout. */
function syntheticParcelSquare(parcelReferenceId: string, centreEasting: number, centreNorthing: number, halfWidthMetres: number): E85ParcelSpatialReference {
  const h = halfWidthMetres;
  return {
    parcelReferenceId,
    geometry: {
      type: "POLYGON",
      crs: VANCOUVER_ZONING_CRS,
      exterior: [
        [centreEasting - h, centreNorthing - h],
        [centreEasting + h, centreNorthing - h],
        [centreEasting + h, centreNorthing + h],
        [centreEasting - h, centreNorthing + h],
        [centreEasting - h, centreNorthing - h],
      ],
    },
    provenance: {
      datasetId: "synthetic:test-parcels",
      datasetVersionId: "synthetic-1",
      featureId: parcelReferenceId,
      jurisdictionId: VANCOUVER_SPATIAL_JURISDICTION_ID,
      crs: VANCOUVER_ZONING_CRS,
      interpretationNote: "SYNTHETIC test geometry. Not a civic parcel; no lot, address, PID or legal description is asserted.",
    },
  };
}

/** Sits wholly inside the real R1-1 triangle 494787. */
export const SYNTHETIC_PARCEL_IN_R1_1 = (): E85ParcelSpatialReference => syntheticParcelSquare("synthetic-parcel-r1-1", 493456.89, 5456030.81, 9);

/** Sits wholly inside the real C-2C polygon 494642. */
export const SYNTHETIC_PARCEL_IN_C_2C = (): E85ParcelSpatialReference => syntheticParcelSquare("synthetic-parcel-c-2c", 491611.89, 5456331.0, 12);

/** Sits wholly inside the real CD-1 (423) polygon 495494. */
export const SYNTHETIC_PARCEL_IN_CD_1_423 = (): E85ParcelSpatialReference => syntheticParcelSquare("synthetic-parcel-cd-1-423", 490443.96, 5458073.35, 10);

/** Sits wholly inside the real RM-5 polygon 494597, clear of its interior ring. */
export const SYNTHETIC_PARCEL_IN_RM_5 = (): E85ParcelSpatialReference => syntheticParcelSquare("synthetic-parcel-rm-5", 490122.27, 5459244.37, 30);

/**
 * InvestScape™ E85 Phase 8 — Spatial Source Adapter: raw snapshot contracts.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * What an authoritative spatial source RETURNED, recorded reproducibly, before
 * anything has been interpreted. Phase 8's adapters turn one of these into
 * `E85RegulatorySpatialFeature[]`; this file defines only the input side.
 *
 * ACQUISITION IS NOT MODELLED HERE AND IS NOT IMPLEMENTED ANYWHERE IN E85.
 * How the bytes were obtained — an ArcGIS REST query, an OGC API request, a
 * GeoJSON download, an export somebody committed to a repository — is a
 * concern outside this engine. A snapshot is the RESULT of acquisition, which
 * is why every field below can be satisfied from a file on disk read by a
 * caller, and why nothing in this engine performs a fetch.
 *
 * THE RAW SIDE STAYS RAW. `rawAttributes` and `rawGeometry` are deliberately
 * untyped: the moment this file names a source's field or a format's geometry
 * spelling, the generic core has acquired knowledge of one publisher and every
 * other publisher becomes a special case. Interpreting those shapes is an
 * adapter's entire job, and adapters live under `adapters/spatial/`.
 *
 * IDENTITY IS DECLARED, NOT COMPUTED. `snapshotId` is a caller-supplied or
 * source-derived label. It is NOT a content hash and is not called one: naming
 * a field `hash` would assert an integrity guarantee nothing here computes, and
 * a reviewer trusting that name would be trusting nothing at all.
 */
import type { E85Crs } from "./spatial-types";

/**
 * The KIND of system a snapshot came from, in generic vocabulary.
 *
 * Descriptive only, and used for exactly one thing: letting an adapter declare
 * which shapes of payload it knows how to read, so a GeoJSON-shaped adapter is
 * never handed an ArcGIS-shaped payload. It ranks nothing and implies nothing
 * about authority — a shapefile export of a by-law schedule is exactly as
 * authoritative as the REST endpoint serving the same layer.
 */
export type E85SpatialSourceSystem =
  /** An ESRI ArcGIS REST feature service response shape. */
  | "ARCGIS_REST"
  /** An OGC API - Features / WFS response shape. */
  | "OGC_API_FEATURES"
  /** A GeoJSON document. */
  | "GEOJSON"
  /** Records extracted from a shapefile by some upstream tool. */
  | "SHAPEFILE_EXPORT"
  /** Anything else, named honestly rather than forced into a category above. */
  | "OTHER";

/**
 * One record exactly as the source presented it.
 *
 * `rawFeatureId` is OPTIONAL because sources really do omit stable identifiers,
 * and a contract that required one would force an adapter to invent it. What an
 * adapter does about that absence is a policy decision recorded in
 * spatial-source-adapter-contract.ts, not something papered over here.
 */
export interface E85RawSpatialFeatureRecord {
  /**
   * The publisher's own stable identifier for this feature, when the source
   * supplies one. Absent is a real and common state, never filled in by E85.
   */
  rawFeatureId?: string;
  /** The source's own attribute bag, keys and values verbatim. Never renamed, never coerced, never interpreted at this layer. */
  rawAttributes: Readonly<Record<string, unknown>>;
  /**
   * The source's own geometry, in whatever shape it published. Typed `unknown`
   * on purpose: a generic core that understood `rings` or `coordinates` would
   * be a partial GeoJSON/ArcGIS parser, and the adapter is where format
   * knowledge belongs.
   */
  rawGeometry?: unknown;
  /**
   * Position of this record within `rawFeatures`, for locating it again in the
   * snapshot. A NON-AUTHORITATIVE locator: it identifies a position in one
   * payload, never a feature in the world, and it must never be promoted into a
   * feature identity — reorder the payload and it means something else.
   */
  sourceRecordIndex?: number;
  /** Convenience locator for this individual record, when the source exposes one. Never identity. */
  sourceLocator?: string;
}

/**
 * A reproducible record of one authoritative spatial source response.
 *
 * `declaredCrs` is OPTIONAL, and that is the point: a source that stated no
 * coordinate reference system must be representable as having stated none. An
 * `E85Crs` manufactured here would be indistinguishable downstream from one a
 * publisher actually declared, and Phase 7 would then compare coordinates
 * against a system nobody asserted.
 */
export interface E85RawSpatialSourceSnapshot {
  /** Stable label for this snapshot. Caller- or source-supplied; never a content hash, and never called one — see the file header. */
  snapshotId: string;
  /** Exact `E85SpatialDatasetDefinition.datasetId` this snapshot claims to be of. Checked against the registry, never trusted alone. */
  datasetId: string;
  /** Exact release this snapshot claims. Matched exactly against registered versions; there is no nearest-release behaviour anywhere in Phase 8. */
  datasetVersionId: string;
  /** Exact jurisdiction this snapshot claims. A contradiction with the registry is reported, never reconciled by preferring one side. */
  jurisdictionId: string;
  sourceSystem: E85SpatialSourceSystem;
  /** Where the snapshot came from — an endpoint, a file path recorded by the caller, an export job id. Traceability only, never identity, and never dereferenced by E85. */
  sourceLocator?: string;
  /** ISO 8601 time the caller obtained this snapshot, when known. Absent stays absent: E85 never stamps a retrieval time it did not witness. */
  retrievedAt?: string;
  /** The CRS the source DECLARED for these coordinates. Absent means the source declared none — never inferred from coordinate magnitudes. */
  declaredCrs?: E85Crs;
  rawFeatures: readonly E85RawSpatialFeatureRecord[];
  /** Whatever else the source reported about the payload as a whole (layer name, spatial extent, record count). Verbatim, uninterpreted, and never required. */
  sourceMetadata?: Readonly<Record<string, unknown>>;
}

/** A compact, stable reference to one raw record inside one snapshot, for audit trails that must not embed the record itself. */
export function e85RawRecordRef(snapshot: Pick<E85RawSpatialSourceSnapshot, "snapshotId">, record: E85RawSpatialFeatureRecord, fallbackIndex: number): string {
  const index = record.sourceRecordIndex ?? fallbackIndex;
  return `${snapshot.snapshotId}#${index}`;
}

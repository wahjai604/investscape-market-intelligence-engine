/**
 * InvestScape™ E85 Phase 7 — Spatial Applicability: dataset identity &
 * spatial provenance.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * A SPATIAL DATASET IS NOT A REGULATORY DOCUMENT, and this file is separate
 * from source-registry-types.ts for that reason rather than as a filing
 * convenience. A district schedule is an instrument that STATES rules; a zoning
 * layer is a published depiction of WHERE those rules land. They version on
 * different cycles, carry different licences, are produced by different
 * departments, and can disagree — a layer redrawn in March does not amend a
 * by-law, and a by-law amended in March does not redraw a layer. Modelling them
 * with one type would make those disagreements inexpressible.
 *
 * What IS shared, deliberately, is the Phase 5A temporal discipline: a
 * publication stamp is not a statement of legal effect. `deriveE85SpatialTemporalWindow`
 * routes through the very same enforcement point Phase 5 uses, so a GIS layer
 * cannot become the one place in E85 where "published recently" quietly becomes
 * "in force since".
 *
 * No network behaviour exists here or anywhere in Phase 7. A dataset definition
 * records what E85 knows ABOUT a dataset; acquiring one is an upstream concern.
 */
import type { E85TemporalWindow } from "./evidence-types";
import type { E85Provenance } from "./provenance-types";
import type { E85Crs } from "./spatial-types";
import type { E85SourceAccessStatus, E85SourceLicenseStatus } from "./source-readiness-types";
import { deriveE85TemporalWindow } from "./source-registry-types";

/**
 * Kind of spatial layer, in generic planning vocabulary. No jurisdiction's
 * layer names belong in this union — "ZoningDistricts_2026" is Vancouver's name
 * for an instance of `BASE_ZONING`, and belongs in a dataset definition's id,
 * never in this type.
 */
export type E85SpatialDatasetType =
  /** The layer depicting base zoning districts, the mutually-exclusive partition most jurisdictions publish. */
  | "BASE_ZONING"
  /** A layer depicting an overlay/development-permit-area/special-district boundary that sits on top of base zoning. */
  | "OVERLAY"
  /** A layer depicting parcel/lot boundaries. */
  | "PARCEL_FABRIC"
  /** A layer depicting site-specific or negotiated instrument boundaries. */
  | "SITE_SPECIFIC"
  /** A layer depicting heritage designations or conservation areas. */
  | "HERITAGE"
  /** Anything else, named honestly rather than forced into a category above. */
  | "OTHER";

/**
 * One published version of a spatial dataset.
 *
 * The publication/effect split from Phase 5A applies unchanged:
 *   `versionId` / `publishedDate` / `observedAt`
 *       WHICH DEPICTION was read.
 *   `effectiveFrom` / `effectiveDateBasis`
 *       WHEN THE BOUNDARIES it depicts took legal effect.
 * A GIS layer is republished whenever anything in it changes, which says
 * nothing about when any individual boundary came into force. Nothing in E85
 * promotes the former into the latter.
 */
export interface E85SpatialDatasetVersion {
  /** Stable label for this release, e.g. "2026-06". A label, never parsed for dates. */
  versionId: string;
  /** FULL ISO 8601 date the dataset release was published. Publication, not legal effect. */
  publishedDate?: string;
  /** ISO 8601 timestamp E85 (or its upstream) actually read this release. Retrieval, not legal effect, and not publication either. */
  observedAt?: string;
  /** FULL ISO 8601 date the depicted boundaries took legal effect, set only when genuinely established. Never derived from `publishedDate`. */
  effectiveFrom?: string;
  /** Must be "UNKNOWN" whenever `effectiveFrom` is absent — a basis cannot explain a date that is not there. */
  effectiveDateBasis: E85TemporalWindow["effectiveDateBasis"];
  /** Convenience URL for this release. Never identity. */
  url?: string;
}

/**
 * What E85 knows about one spatial dataset. Registration is a statement of
 * knowledge, not of access: a dataset may be registered and unreachable, or
 * reachable and unlicensed, and those are tracked on separate axes exactly as
 * Phase 3 tracks them for documents.
 */
export interface E85SpatialDatasetDefinition {
  /** Stable logical identity — see `buildE85SpatialDatasetId`. Never a filename, never a URL, never version-dependent. */
  datasetId: string;
  displayName: string;
  /** The body that publishes the layer, e.g. a municipal open-data office. May differ from the body that authored the by-law. */
  publisher: string;
  /** Exact `E85Jurisdiction.jurisdictionId` this dataset covers. */
  jurisdictionId: string;
  datasetType: E85SpatialDatasetType;
  /** Every release E85 has registered. A version absent from this list is unregistered, never silently accepted. */
  versions: readonly E85SpatialDatasetVersion[];
  /** The CRS the dataset's coordinates are published in. Declared, never inferred from the coordinate magnitudes. */
  crs: E85Crs;
  /** Reuses the Phase 3 access axis — "can E85 reach it" is the same question for a layer as for a document. */
  accessStatus: E85SourceAccessStatus;
  /** Reuses the Phase 3 licensing axis. Independent of access, and — see spatial-applicability.ts — never a reason to suppress a geometric fact. */
  licenseStatus: E85SourceLicenseStatus;
  /** Geometry types this dataset's features are known to use. A type absent here is not forbidden; it is simply unverified. */
  supportedGeometryTypes: readonly ("POINT" | "POLYGON")[];
  /** Honest, specific statements of what this dataset does NOT support. Never aspirational. */
  knownLimitations: readonly string[];
  /** Landing URL for the dataset generally. Never identity. */
  url?: string;
}

const DATASET_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?::[a-z0-9]+(?:-[a-z0-9]+)*)+$/;

export interface E85SpatialDatasetIdParts {
  /** Exact jurisdiction id, e.g. "ca-bc-vancouver". */
  jurisdictionId: string;
  /** Slug for the layer, e.g. "zoning-districts". */
  datasetSlug: string;
}

/**
 * Builds a stable dataset id. Throws on a malformed id because that is a
 * programmer defect in how a dataset was declared, not uncertainty in municipal
 * data — the one class of failure Phase 7 raises rather than returns.
 */
export function buildE85SpatialDatasetId(parts: E85SpatialDatasetIdParts): string {
  const id = `${parts.jurisdictionId}:${parts.datasetSlug}`;
  if (!DATASET_ID_PATTERN.test(id)) {
    throw new Error(
      `Invalid E85 spatial datasetId "${id}": expected lower-case colon-separated slugs (e.g. "cc-rr-municipality:zoning-districts"). ` +
        `Filesystem paths, URLs, upper case, and spaces are rejected because a dataset identity must be stable and machine-independent.`,
    );
  }
  return id;
}

export function isValidE85SpatialDatasetId(datasetId: string): boolean {
  return DATASET_ID_PATTERN.test(datasetId);
}

/** Looks up one registered release by EXACT `versionId`. No nearest-version fallback and no newest-wins — an unregistered version is unregistered. */
export function findE85SpatialDatasetVersion(dataset: E85SpatialDatasetDefinition, versionId: string): E85SpatialDatasetVersion | undefined {
  return dataset.versions.find((v) => v.versionId === versionId);
}

/**
 * The ONE place a spatial dataset version becomes a temporal window.
 *
 * Delegates to the Phase 5 derivation so the publication-vs-effect rule has a
 * single implementation across E85. A dataset published in June 2026 with no
 * established effective date yields an UNKNOWN window, exactly as a document
 * would — the layer's freshness is not evidence of anything's legal start.
 */
export function deriveE85SpatialTemporalWindow(version: E85SpatialDatasetVersion | undefined): E85TemporalWindow {
  if (version === undefined) return { effectiveDateBasis: "UNKNOWN" };
  return deriveE85TemporalWindow({ versionId: version.versionId, effectiveFrom: version.effectiveFrom, effectiveDateBasis: version.effectiveDateBasis });
}

/**
 * Full provenance for one spatial fact: which feature, of which release, of
 * which dataset, published by whom, read when, in which CRS.
 *
 * This is the record that answers the question Phase 7 exists to make
 * answerable — "which exact spatial feature caused this rule pack to be
 * considered applicable?" — and every field below is one a reviewer chasing
 * that answer would otherwise have to ask for.
 */
export interface E85SpatialProvenance {
  datasetId: string;
  /** Which release the feature was read from. Required: a feature without a release is a shape with no accountable origin. */
  datasetVersionId: string;
  /** The publisher's own identifier for this feature within the layer. */
  featureId: string;
  /** Layer/table name within the dataset, when the dataset has several. */
  layerName?: string;
  publisher?: string;
  jurisdictionId: string;
  crs: E85Crs;
  /**
   * PHASE 8 CONTRACT ADDITION: identity of the spatial source adapter that
   * normalized this feature, and that adapter's own version.
   *
   * The same release read by adapter v1 and v2 may legitimately yield different
   * features as field mapping improves, so "where exactly did this feature come
   * from?" is not fully answerable from the dataset locator alone. Mirrors the
   * `adapterId`/`adapterVersion` pair Phase 5 added to `E85Provenance` for
   * documents, for the identical reason, and projects into those fields via
   * `spatialProvenanceToE85Provenance`. Optional and additive only — no Phase 7
   * fixture sets it.
   */
  adapterId?: string;
  adapterVersion?: string;
  /** ISO 8601 timestamp this feature was observed/retrieved, when supplied. Never defaulted to now — an unobserved timestamp stays absent. */
  observedAt?: string;
  /** Convenience URL for the feature or its layer. Never identity. */
  url?: string;
  /** Free-text note describing any interpretive judgment made in reading the feature. */
  interpretationNote?: string;
}

/**
 * Projects spatial provenance into the engine-wide `E85Provenance` shape,
 * populating the `gisLocator` that Phase 3 defined and left waiting.
 *
 * Phase 3's provenance model already anticipated spatial evidence
 * (`E85GisLocator`: dataset, layer, feature, geometry) and Phase 7 fills it
 * rather than inventing a parallel chain — so a downstream reviewer follows one
 * provenance vocabulary whether a fact came from a page of a by-law or a
 * polygon in a layer.
 */
export function spatialProvenanceToE85Provenance(spatial: E85SpatialProvenance, geometryRef?: unknown): E85Provenance {
  return {
    sourceId: spatial.datasetId,
    sourceVersionId: spatial.datasetVersionId,
    gisLocator: {
      gisDatasetId: spatial.datasetId,
      gisLayerId: spatial.layerName,
      gisFeatureId: spatial.featureId,
      ...(geometryRef === undefined ? {} : { geometryRef }),
    },
    // The Phase 5 adapter-identity fields already exist on E85Provenance for
    // exactly this purpose, so a spatially-sourced fact and a document-sourced
    // fact answer "which adapter produced this?" in one vocabulary.
    ...(spatial.adapterId === undefined ? {} : { adapterId: spatial.adapterId }),
    ...(spatial.adapterVersion === undefined ? {} : { adapterVersion: spatial.adapterVersion }),
    ...(spatial.url === undefined ? {} : { url: spatial.url }),
    ...(spatial.observedAt === undefined ? {} : { retrievedAt: spatial.observedAt }),
    ...(spatial.interpretationNote === undefined ? {} : { interpretationNote: spatial.interpretationNote }),
  };
}

/** Stable identity string for one feature, used for deduplication. Two records with the same dataset, release and feature id are the same feature observed twice. */
export function e85SpatialFeatureIdentityKey(spatial: E85SpatialProvenance): string {
  return `${spatial.datasetId}|${spatial.datasetVersionId}|${spatial.featureId}`;
}

/**
 * InvestScape™ E85 Phase 8 — reference spatial source: dataset registration
 * and field-mapping policy.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * An INVENTED jurisdiction publishing an INVENTED zoning layer. Nothing here
 * describes a real municipality, no real dataset is registered, and no live GIS
 * exists anywhere in E85. Its purpose is to prove the Phase 8 architecture end
 * to end with a source whose every quirk is deliberate.
 *
 * THIS FILE IS WHERE SOURCE-SPECIFIC KNOWLEDGE LIVES, and it is the only kind
 * of file that may hold it. The generic Phase 8 core knows nothing about
 * attribute names; it knows there is such a thing as an attribute bag. Adding a
 * publisher means adding a directory here — no core file changes, which is the
 * property the adapter architecture exists to deliver.
 *
 * THE MAPPINGS BELOW ARE EXACT, AND THAT IS THE WHOLE POINT. Every one is a
 * total lookup: a code either has a stated mapping or it has none. There is no
 * prefix matching, no substring search, no "looks like a residential zone", and
 * no nearest-code fallback. A zoning code is a legal identifier, and guessing
 * which instrument governs a parcel from the shape of its label is how a site
 * gets evaluated under rules that were never written for it.
 */
import type { E85SpatialDatasetDefinition } from "../../../spatial-dataset-types";
import type { E85SpatialFeatureClass } from "../../../spatial-applicability-types";
import type { E85Crs } from "../../../spatial-types";

/** The invented jurisdiction this reference source belongs to. Not a real place. */
export const REFERENCE_JURISDICTION = "xx-yy-refburgh";

/** The invented zoning-districts layer. */
export const REFERENCE_DATASET_ID = `${REFERENCE_JURISDICTION}:zoning-districts`;

/** The one release this adapter has been verified against. */
export const REFERENCE_RELEASE = "2026-Q1";

/** The CRS this invented publisher states for the layer. Synthetic projected metres. */
export const REFERENCE_CRS: E85Crs = {
  crsId: "EPSG:26910",
  displayName: "Synthetic projected metres",
  declaredBy: "reference dataset metadata",
  units: "metre",
};

/**
 * The source's own attribute names.
 *
 * Deliberately unlovely — mixed case, an abbreviation, a legacy record number —
 * because real publishers' schemas are, and an adapter that only works against
 * a tidy schema proves nothing. Note `OBJECT_REF`: the source's internal record
 * number, which this adapter reads but NEVER treats as feature identity. It is
 * an artefact of the publisher's storage, not a statement about the world, and
 * it changes when the layer is rebuilt.
 */
export const REFERENCE_FIELDS = {
  featureId: "FEATURE_REF",
  zoneCode: "ZONE_CD",
  layerKind: "LYR_KIND",
  objectRef: "OBJECT_REF",
} as const;

/**
 * Source layer-kind values mapped to E85's generic feature classes.
 *
 * DESCRIPTIVE ONLY, and the mapping is total: a value absent from this table is
 * unknown, not "OTHER". Those are different claims. `OTHER` asserts the
 * publisher told us what kind of layer this is and it did not fit E85's
 * categories; silence tells us nothing, and treating silence as `OTHER` would
 * quietly decide the feature is NOT a base zone — which is precisely the
 * decision that determines whether Phase 7 later reports a parcel as unzoned.
 */
export const REFERENCE_LAYER_KIND_TO_CLASS: Readonly<Record<string, E85SpatialFeatureClass>> = {
  BASE: "BASE_ZONE",
  OVERLAY: "OVERLAY",
  SITE: "SITE_SPECIFIC",
  HERITAGE: "HERITAGE",
};

/**
 * Source zone codes mapped to the rule packs that carry their rules.
 *
 * An EXPLICIT, EXHAUSTIVE source policy. A code absent from this table has no
 * known rule pack, and the adapter says so rather than deriving one: "RB-3"
 * does not become "pack-rb3" by string manipulation, because the resemblance
 * between a label and an identifier is a coincidence of naming convention, not
 * evidence about which instrument applies.
 */
export const REFERENCE_ZONE_CODE_TO_RULE_PACKS: Readonly<Record<string, readonly string[]>> = {
  "RB-1": ["refburgh-rb-1"],
  "RB-2": ["refburgh-rb-2"],
  "DP-OVERLAY": ["refburgh-dp-overlay"],
};

/** The reference dataset as it is registered with E85. */
export function referenceZoningDataset(): E85SpatialDatasetDefinition {
  return {
    datasetId: REFERENCE_DATASET_ID,
    displayName: "Refburgh Zoning Districts (reference)",
    publisher: "Refburgh Open Data (invented)",
    jurisdictionId: REFERENCE_JURISDICTION,
    datasetType: "BASE_ZONING",
    versions: [
      {
        versionId: REFERENCE_RELEASE,
        publishedDate: "2026-01-15",
        // The layer's legal effect is NOT established by its publication date,
        // so the basis stays UNKNOWN — the Phase 5A discipline, unchanged.
        effectiveDateBasis: "UNKNOWN",
      },
    ],
    crs: REFERENCE_CRS,
    accessStatus: "AVAILABLE",
    // Silence about terms is recorded as silence. A layer being downloadable is
    // not a grant of redistribution rights.
    licenseStatus: "LICENSE_UNKNOWN",
    supportedGeometryTypes: ["POLYGON"],
    knownLimitations: [
      "Invented reference dataset; describes no real jurisdiction.",
      "Polygon features only — the publisher exports no point or multipart geometry.",
      "Legal effective dates are not published with the layer, so temporal windows stay UNKNOWN.",
    ],
  };
}

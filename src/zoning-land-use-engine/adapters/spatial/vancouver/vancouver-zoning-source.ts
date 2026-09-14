/**
 * InvestScape™ E85 Phase 8 — City of Vancouver zoning-districts spatial source:
 * dataset registration and field-mapping policy.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * THIS FILE IS WHERE VANCOUVER-SPECIFIC KNOWLEDGE LIVES, and it is the only
 * kind of file that may hold it. Generic Phase 7/8/9 code knows that a raw
 * record has an attribute bag; it does not know that this publisher spells its
 * identifier `object_id` or its zone label `zoning_district`. Adding a
 * municipality means adding a directory here — no core file changes.
 *
 * EVERY FACT BELOW IS ONE THE CITY ITSELF STATES, and each is traceable to a
 * named part of the City of Vancouver Open Data Portal's own dataset page:
 *
 *   Information page metadata table  identifier, publisher, data owner, data
 *                                    team, licence, Modified, Last processing
 *   Information page "Data currency" the weekly extract cadence below
 *   Information page "Data accuracy" the survey-accuracy statement below
 *   Dataset schema                   field names, types and descriptions
 *   Export page                      the two CRS choices offered
 *   Open Government Licence – Vancouver   the licence terms
 *
 * Nothing here is inferred from the coordinates, from the file names, or from
 * what a zoning layer "usually" contains.
 *
 * ONE PROVENANCE CAVEAT, RECORDED RATHER THAN GLOSSED. The local offline
 * evidence capture set holds screen captures of the metadata table, the schema,
 * the Export page and the licence. It does NOT currently include a capture of
 * the Information page's "Data currency" and "Data accuracy" sections, so those
 * two statements — `VANCOUVER_EXTRACT_CADENCE` and `VANCOUVER_DATA_ACCURACY_STATEMENT`
 * below — are recorded from the City's live Information page as reported by the
 * operator, and are not re-verifiable against the current capture set. They are
 * descriptive context either way: neither is load-bearing for identity, CRS,
 * geometry or linkage, and nothing in E85 branches on them.
 *
 * THE FOUR TIMESTAMPS THE CITY PUBLISHES ARE NOT INTERCHANGEABLE, and this file
 * keeps them apart deliberately:
 *
 *   Modified                  2026-06-29  the dataset's own modification stamp
 *   Last processing (data)    2026-06-29  when the DATA was last processed
 *   Last processing (metadata) 2026-09-14 when the METADATA was last processed
 *   local download time                   a fact about a human's disk, not a release
 *
 * `versionId` is derived from the data-processing state — the only one of the
 * four that describes the DATA this snapshot contains. The metadata-processing
 * stamp moves when a description is edited and would relabel a release whose
 * polygons never changed; a download time is not a publication event at all.
 *
 * AND NONE OF THEM IS A LEGAL EFFECTIVE DATE. The City publishes no adoption,
 * enactment or in-force date with this layer, so `effectiveDateBasis` is
 * UNKNOWN and `effectiveFrom` is absent — the Phase 5A discipline, unchanged. A
 * zoning layer republished in June says nothing about when any boundary in it
 * came into force.
 */
import type { E85SpatialDatasetDefinition } from "../../../spatial-dataset-types";
import type { E85SpatialFeatureClass } from "../../../spatial-applicability-types";
import type { E85Crs } from "../../../spatial-types";

/** The jurisdiction this source belongs to. Matches the Phase 5 R1-1 pilot's jurisdiction exactly, so the two pilots describe one city. */
export const VANCOUVER_SPATIAL_JURISDICTION_ID = "ca-bc-vancouver";

/** The City's own dataset identifier, as printed on the Information page: `zoning-districts-and-labels`. */
export const VANCOUVER_ZONING_DATASET_SLUG = "zoning-districts-and-labels";

export const VANCOUVER_ZONING_DATASET_ID = `${VANCOUVER_SPATIAL_JURISDICTION_ID}:${VANCOUVER_ZONING_DATASET_SLUG}`;

/**
 * The release label for the captured snapshot, derived from the City's stated
 * DATA-processing state (2026-06-29), which agrees with the dataset's Modified
 * stamp for this capture.
 *
 * A LABEL, never parsed for a date by anything in E85, and deliberately NOT the
 * metadata-processing stamp (2026-09-14): metadata processing moves when a
 * description or a keyword is edited, and reusing it would announce a new
 * release of polygons that did not change.
 */
export const VANCOUVER_ZONING_RELEASE = "2026-06-29-data-processing";

/** The dataset's Modified stamp as the Information page prints it. Publication, not legal effect. */
export const VANCOUVER_ZONING_PUBLISHED_DATE = "2026-06-29";

/**
 * The City's stated DATA CURRENCY: the extract published on the portal is
 * updated weekly.
 *
 * SOURCE PUBLICATION CONTEXT, AND NOTHING MORE. It is recorded because a
 * reviewer asking "how stale might this snapshot be?" deserves the publisher's
 * own answer, and because its absence was previously reported as "no stated
 * cadence", which was wrong.
 *
 * It is NOT a legal effective date, NOT a zoning by-law effective date, NOT a
 * freshness guarantee, NOT a service level, and NOT a release identifier. A
 * weekly extract says when the City refreshes a download; it says nothing about
 * when any depicted boundary came into force, and nothing in E85 derives a date
 * from it. `effectiveDateBasis` stays UNKNOWN regardless.
 *
 * Nor does it make a snapshot expire. E85 has no notion of a stale snapshot and
 * invents none here: a caller holding a snapshot from an earlier week holds
 * exactly what it says it holds, labelled with the release it came from.
 */
export const VANCOUVER_EXTRACT_CADENCE = "The extract published on the City's open data portal is updated weekly.";

/**
 * The City's stated DATA ACCURACY: some City data is created using survey
 * accuracy, while some features are not as precise.
 *
 * SOURCE-QUALITY CONTEXT, AND NOTHING MORE. Recorded because a boundary's
 * positional precision is a real property of the evidence that a reviewer
 * weighing a near-boundary result should be able to see.
 *
 * It is NOT a statement that any geometry is invalid, NOT a reason to quarantine
 * any record, NOT a reason to alter a spatial relation, NOT a downgrade of the
 * layer's authority, and NOT a licence limitation. Nothing in E85 widens a
 * tolerance, buffers a boundary, or softens a relation because of it — how close
 * counts as touching a zone boundary remains a legal question a caller states
 * explicitly via `E85SpatialTolerance`, never one this file answers on a
 * jurisdiction's behalf.
 */
export const VANCOUVER_DATA_ACCURACY_STATEMENT =
  "The City states that some of its data is created using survey accuracy while some features are not as precise.";

/**
 * The CRS spelled EXACTLY as the City's own EPSG:26910 GeoJSON export declares
 * it in its `crs` member.
 *
 * The spelling is copied verbatim and not canonicalized, because `e85CrsMatches`
 * compares identifiers as exact strings on purpose: "EPSG:26910" and
 * "urn:ogc:def:crs:EPSG::26910" are treated as different systems, and the safe
 * direction when two spellings might not mean the same thing is to refuse the
 * comparison rather than assume it.
 *
 * This export is preferred for the pilot over the City's WGS84 export for one
 * reason that has nothing to do with geodesy: the EPSG:26910 file DECLARES its
 * CRS in the file itself, and the WGS84 file declares none. A CRS read from the
 * payload is the publisher's own assertion travelling with the coordinates; a
 * CRS read from a web page a human clicked is an assertion about a download.
 */
export const VANCOUVER_ZONING_CRS: E85Crs = {
  crsId: "urn:ogc:def:crs:EPSG::26910",
  displayName: "NAD83 / UTM zone 10N",
  declaredBy: "City of Vancouver GeoJSON export — file-level crs member",
  units: "metre",
};

/**
 * The source's own attribute names, verbatim from the City's published Dataset
 * schema. Contained here and in this directory's adapter, nowhere else.
 *
 * Note `objectId`. The City documents it as "Unique feature number for data
 * management purposes" — a statement of uniqueness FOR DATA MANAGEMENT, not a
 * promise that the number denotes the same parcel of ground in the next
 * release. What that distinction costs is recorded in `knownLimitations` below
 * and is not papered over by the adapter.
 */
export const VANCOUVER_ZONING_FIELDS = {
  /** "Unique feature number for data management purposes." Snapshot-scoped identity — see the note above. */
  objectId: "object_id",
  /** "Grouping of zoning districts based on land uses regulated and defined in Section 9 of the Zoning and Development By-law." */
  zoningClassification: "zoning_classification",
  /** "Grouping of zoning districts that regulate similar land uses, such as 'C' or 'RM'." */
  zoningCategory: "zoning_category",
  /** "Zoning districts as listed in Section 9 of the Zoning and Development By-law, such as 'C-2' or 'RM-3'." */
  zoningDistrict: "zoning_district",
  /** "Specific CD-1 (Comprehensive Development) zoning district number, sometimes including a letter, such as '40' or '3B'." */
  cd1Number: "cd_1_number",
  /** The City's own label point. Read for audit only — never used as a feature's geometry. */
  geoPoint: "geo_point_2d",
} as const;

/**
 * The City's zoning CLASSIFICATION values mapped to E85's generic feature
 * classes. An exact, total lookup: a classification absent from this table is
 * UNKNOWN, never silently `OTHER`.
 *
 * EVERY VALUE MAPS TO `BASE_ZONE`, INCLUDING COMPREHENSIVE DEVELOPMENT, and
 * that is a deliberate reading of what this layer is rather than an oversight.
 * The City publishes `zoning-districts-and-labels` as the zoning-district
 * partition of the city, and a CD-1 district is ENACTED AS A ZONING DISTRICT by
 * by-law amendment — it replaces the base zoning for its site, it is not drawn
 * on top of one. Classing CD-1 as `SITE_SPECIFIC` would remove it from the
 * mutually-exclusive base-zone slot, and Phase 7 would then report a parcel
 * inside a CD-1 as having NO base zone at all (`NO_BASE_ZONE_MATCH` /
 * `ZONING_NOT_FOUND`) — a materially false statement about ground the City has
 * in fact zoned.
 *
 * The site-specific character of a CD-1 is therefore carried where it is true
 * and harmless: in the feature's `zoneDesignation` ("CD-1 (423)"), in the audit
 * trail's `cd_1_number` mapping, and above all in the fact that its governing
 * instrument stays UNLINKED until someone establishes which instrument it is.
 */
export const VANCOUVER_CLASSIFICATION_TO_FEATURE_CLASS: Readonly<Record<string, E85SpatialFeatureClass>> = {
  Commercial: "BASE_ZONE",
  "Comprehensive Development": "BASE_ZONE",
  "Historical Area": "BASE_ZONE",
  Industrial: "BASE_ZONE",
  "Limited Agriculture": "BASE_ZONE",
  Residential: "BASE_ZONE",
  "Residential Inclusive": "BASE_ZONE",
  "Residential Rental": "BASE_ZONE",
};

/**
 * A policy mapping EXACT `zoning_district` values to the rule packs that carry
 * their rules.
 *
 * Keyed on the full district label the City prints — "R1-1", "C-2C",
 * "CD-1 (423)" — and on nothing else. Never on `zoning_category`, which is a
 * GROUPING: a single "CD" key would link 891 legally distinct site-specific
 * instruments to one pack, and a single "RM" key would do the same across every
 * multiple-dwelling district in the city.
 */
export type E85VancouverRulePackLinkPolicy = Readonly<Record<string, readonly string[]>>;

/**
 * THE PRODUCTION POLICY IS EMPTY, AND THAT IS THE HONEST STATE TODAY.
 *
 * E85 holds no rule pack whose legal identity has been established as the
 * instrument governing any Vancouver zoning district. The Phase 5 R1-1 pilot
 * normalized the R1-1 District Schedule's CONTENT, but it defines no
 * `packId` — no production constant anywhere in this engine names a Vancouver
 * rule pack — so there is nothing here that could be linked to without
 * inventing an identifier.
 *
 * And an invented one is exactly what must not happen. "R1-1" does not become
 * `vancouver-r1-1` by string manipulation: the resemblance between a map label
 * and a pack identifier is a naming coincidence, not evidence about which
 * instrument governs a site. So every feature normalizes with `rulePackIds: []`
 * and a `RULE_PACK_LINK_UNRESOLVED` finding, the geometry is retained in full,
 * and the gap travels to Phase 9 where it is weighed against the actual parcel.
 *
 * A caller that HAS established a linkage supplies it explicitly via
 * `createVancouverZoningSpatialAdapter`. Linkage is orchestration's to state,
 * not this adapter's to guess.
 */
export const VANCOUVER_ZONING_DISTRICT_TO_RULE_PACKS: E85VancouverRulePackLinkPolicy = {};

/**
 * The attribution the Open Government Licence – Vancouver requires of anyone
 * who copies, modifies, publishes, adapts or distributes the Information, in
 * the licence's own words (clause 4).
 */
export const VANCOUVER_OPEN_DATA_ATTRIBUTION = "Contains information licensed under the Open Government Licence – Vancouver.";

/** The dataset as E85 registers it. Registration is a statement of knowledge, never of access or of rights. */
export function vancouverZoningDataset(): E85SpatialDatasetDefinition {
  return {
    datasetId: VANCOUVER_ZONING_DATASET_ID,
    displayName: "City of Vancouver — Zoning Districts and Labels",
    publisher: "City of Vancouver",
    jurisdictionId: VANCOUVER_SPATIAL_JURISDICTION_ID,
    datasetType: "BASE_ZONING",
    versions: [
      {
        versionId: VANCOUVER_ZONING_RELEASE,
        publishedDate: VANCOUVER_ZONING_PUBLISHED_DATE,
        // The City publishes no adoption, enactment or in-force date with this
        // layer. A publication stamp is not a statement of legal effect, so the
        // basis stays UNKNOWN and no `effectiveFrom` is manufactured from it.
        effectiveDateBasis: "UNKNOWN",
      },
    ],
    crs: VANCOUVER_ZONING_CRS,
    accessStatus: "AVAILABLE",
    // The Open Government Licence – Vancouver AFFIRMATIVELY grants a worldwide,
    // royalty-free, perpetual, non-exclusive licence to copy, modify, publish,
    // translate, adapt and distribute the Information, including commercially,
    // subject to attribution. That is an established grant, so PUBLIC_REUSE is
    // the honest record — in contrast to the R1-1 District Schedule, which
    // carries no terms at all and is registered LICENSE_UNKNOWN.
    licenseStatus: "PUBLIC_REUSE",
    supportedGeometryTypes: ["POLYGON"],
    knownLimitations: [
      "object_id is documented by the City only as a \"unique feature number for data management purposes\". Uniqueness within a release is documented and was verified across the audited snapshot; STABILITY ACROSS RELEASES IS NOT DOCUMENTED AND IS NOT ASSUMED. E85 feature identity is release-scoped (datasetId + datasetVersionId + featureId), so this is sufficient for applicability within one release and insufficient for tracking one polygon across two.",
      "The City publishes no legal effective date for the depicted boundaries, so every feature's temporal window is UNKNOWN.",
      "The layer records WHICH district covers each area. It does not carry the by-law text for that district, so a district label alone does not establish which legal instrument governs a site.",
      "cd_1_number identifies a CD-1 district NUMBER, not a specific enacting by-law. Twelve numbers in the audited release are carried by more than one polygon, so the number does not identify a single geometry either.",
      "11 of the 1,621 polygons in the audited release are OUTSIDE E85's current Phase 7 topology profile: their interior rings meet or cross the exterior ring, or meet each other. They are quarantined unrepaired. This records what E85's profile accepts, NOT a finding that the City published invalid geometry — no independent or general-purpose GIS validity assessment was performed, and other readers of this layer may accept these shapes.",
      "Because a quarantined record never becomes a comparable feature, Phase 7 measures no relation for it and Phase 9 must treat its parcel-specific relevance as UNDETERMINED rather than assume it is irrelevant. A decision driven by the COMPLETE municipal snapshot can therefore stay blocked by a quarantined record even when the subject parcel is nowhere near it. This is deliberate and conservative: the alternative is inferring a relation from a boundary E85 refused to accept.",
      "The City's WGS84 (EPSG:4326) export declares no CRS in the file itself; only the EPSG:26910 export does. This registration covers the EPSG:26910 export.",
      "The City states that the published extract is updated weekly. That is publication cadence only: it establishes no legal effective date, guarantees no freshness, and is not a release identifier.",
      "The City states that some of its data is created using survey accuracy while some features are not as precise. This is positional-precision context about the evidence; it is not a statement that any geometry is invalid and no E85 tolerance or spatial relation is adjusted because of it.",
    ],
    url: "https://opendata.vancouver.ca/explore/dataset/zoning-districts-and-labels/",
  };
}

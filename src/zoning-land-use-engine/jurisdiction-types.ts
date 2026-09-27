/**
 * InvestScape™ E85 Phase 3 — Zoning & Land-Use Rules Engine: jurisdiction &
 * parcel contracts.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Deliberately independent of E86's `CREGeography` (market/submarket-level,
 * src/cre-intelligence/types.ts) — that model answers "which market is this
 * comparable in," not "which regulatory authority governs this parcel."
 * E85 defines its own jurisdiction shape fresh, with no import from
 * cre-intelligence, cap-rate-engine, construction-cost-engine, calc-engine,
 * economic-engine, or tax-engine (Phase 2 correction 5 / 14).
 *
 * `E85ParcelReference` is a LOCAL, minimally-coupled input contract — what
 * E85 needs supplied to it in order to resolve rules for a site. It is NOT a
 * claim of platform-wide ownership of parcel identity, and NOT a system of
 * record (Phase 2 correction 4). Development Studio's `parcels` table
 * (investscape-docs canonical docs, Addendum A) may be one future source of
 * this data, but this type does not import or depend on that schema.
 */

/** ISO 3166-1 alpha-2 country code, e.g. "CA", "US". PROPOSED CONTRACT DECISION: kept as a plain string rather than an enum — the number of countries E85 may eventually cover is open-ended and an enum would need constant maintenance. */
export type E85CountryCode = string;

/**
 * A regulatory jurisdiction, independent of any market-intelligence notion
 * of "geography." A jurisdiction is the entity whose by-law/ordinance text
 * governs a rule — e.g. "City of Vancouver," not "Metro Vancouver market."
 */
export interface E85Jurisdiction {
  /** Stable internal identifier, e.g. "ca-bc-vancouver". Never re-used across jurisdictions even if a municipality is renamed/amalgamated. */
  jurisdictionId: string;
  country: E85CountryCode;
  /** Province/state/region name or code, e.g. "BC", "British Columbia". */
  regionCode: string;
  /** The municipality, city, borough, county, or other local authority name, e.g. "Vancouver". */
  municipality: string;
  /**
   * The body that authored/administers the governing document(s) for this
   * jurisdiction, e.g. "City of Vancouver — Planning, Urban Design and
   * Sustainability Department". Distinct from `municipality` because some
   * jurisdictions delegate zoning authority to a separate regulatory body.
   */
  regulatoryAuthority: string;
  /** Human-readable display name, e.g. "City of Vancouver, BC, Canada". */
  displayName: string;
}

/**
 * Rule-Only Mode (Phase 2's confirmed v1 scope) — E85 v1 never requires a
 * GIS polygon. `geometryRef` is an optional, minimal, dependency-free
 * placeholder for a future geometry-aware mode; it carries no GIS library
 * dependency and no shape is assumed at this phase (Phase 2 correction 6).
 */
export type E85GeometryRef = unknown;

/**
 * What a caller's `siteAreaSqm` measures. No universal gross/net rule is
 * supportable: the pilot evidence treats FSR as "floor area ÷ site area" but
 * does not establish, for any jurisdiction, the by-law's own definition of
 * site area or its treatment of road dedications, widenings or
 * statutory-right-of-way areas. E85 therefore never chooses a basis on the
 * caller's behalf.
 *
 * - BYLAW_DEFINED_SITE_AREA: the caller asserts the figure was measured as the
 *   governing by-law defines site area for density purposes.
 * - GROSS_TITLE_AREA: area of the legal parcel(s) as titled/surveyed, before
 *   any dedication.
 * - NET_AFTER_DEDICATIONS: title area less known dedications/widenings.
 * - UNSPECIFIED: the caller does not know what the figure measures.
 */
export type E85SiteAreaKind = "BYLAW_DEFINED_SITE_AREA" | "GROSS_TITLE_AREA" | "NET_AFTER_DEDICATIONS" | "UNSPECIFIED";

/**
 * Whether dedications, widenings or other area reductions that the by-law may
 * exclude from site area are known for this parcel.
 *
 * - NONE_APPLICABLE_CONFIRMED: the caller has confirmed none apply.
 * - ALREADY_REFLECTED: known reductions are already reflected in `siteAreaSqm`.
 * - POSSIBLE_OR_PENDING: a reduction may apply or is pending (e.g. a required
 *   road widening not yet registered).
 * - UNKNOWN: not investigated.
 */
export type E85SiteAreaDeductionStatus = "NONE_APPLICABLE_CONFIRMED" | "ALREADY_REFLECTED" | "POSSIBLE_OR_PENDING" | "UNKNOWN";

/** Caller-declared basis and provenance of `E85ParcelReference.siteAreaSqm`. */
export interface E85SiteAreaBasis {
  kind: E85SiteAreaKind;
  deductionStatus: E85SiteAreaDeductionStatus;
  /** Where the figure came from, e.g. "BC Land Title plan EPP12345", "legal survey dated 2026-03-01", "BC Assessment roll 2026". Free text; not validated. */
  sourceReference?: string;
}

/**
 * Minimal, locally-scoped identification of the parcel/site E85 is
 * evaluating rules for. Every field beyond `parcelReferenceId` is optional
 * because Rule-Only Mode can operate on partial information (with
 * corresponding DATA_GAP records for what's missing) rather than requiring
 * a fully resolved parcel before doing anything at all.
 */
export interface E85ParcelReference {
  /** Caller-supplied or upstream-resolved identifier for this parcel/site, scoped to the caller's own system — NOT an InvestScape-wide canonical parcel ID. */
  parcelReferenceId: string;
  jurisdiction?: E85Jurisdiction;
  /** Civic/mailing address string, as supplied by the caller. Not parsed or validated by this contract. */
  address?: string;
  /** Jurisdiction-assigned legal/folio/roll parcel identifier (e.g. a PID in BC), when known. */
  legalParcelId?: string;
  /** Raw zoning designation string as it appears in the source-of-truth for this parcel, e.g. "RS-1", "CD-1 (245)". Preserved verbatim — never normalized away (mirrors the use-taxonomy raw-string preservation rule). */
  rawZoningDesignation?: string;
  /** Site area in square metres, when known. Some dimensional/density rules cannot be evaluated without this and must instead produce a DATA_GAP (REQUIRED_SITE_DIMENSION_MISSING). */
  siteAreaSqm?: number;
  /** What `siteAreaSqm` measures and where it came from. Optional and additive; see `E85SiteAreaBasis`. When absent, a regulatory GFA derived from `siteAreaSqm` is still reported but carries a warning that its area basis is undeclared. */
  siteAreaBasis?: E85SiteAreaBasis;
  /** Site frontage/depth or other required dimensions the caller has supplied, keyed by jurisdiction-specific dimension name. Intentionally open-ended rather than a fixed set of fields, since required site dimensions vary by rule family and jurisdiction. */
  knownSiteDimensions?: Readonly<Record<string, number>>;
  /** Optional, minimal, dependency-free geometry placeholder — see `E85GeometryRef`. Never required in Rule-Only Mode. */
  geometryRef?: E85GeometryRef;
}

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
  /** Site frontage/depth or other required dimensions the caller has supplied, keyed by jurisdiction-specific dimension name. Intentionally open-ended rather than a fixed set of fields, since required site dimensions vary by rule family and jurisdiction. */
  knownSiteDimensions?: Readonly<Record<string, number>>;
  /** Optional, minimal, dependency-free geometry placeholder — see `E85GeometryRef`. Never required in Rule-Only Mode. */
  geometryRef?: E85GeometryRef;
}

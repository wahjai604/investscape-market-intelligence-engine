/**
 * InvestScape™ E85 Phase 5 — Source Adapter & Registry Foundation: generic
 * source registry contracts.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * E85 owns its own source registry types outright. E88's registry
 * (src/construction-cost-engine/source-registry-e88.ts) was consulted as an
 * ARCHITECTURAL PATTERN ONLY — the separation of registration / access /
 * licence / adapter / analytical readiness into independent axes is a good
 * idea worth reusing as a shape. Nothing is imported from it, no field list is
 * copied, and the vocabulary below is E85's own: E88 registers statistical
 * cost-observation publishers, E85 registers regulatory documents whose
 * identity is a by-law + schedule + consolidation, which is a different kind
 * of thing with different failure modes (a by-law is always "available" as a
 * public document yet routinely NOT machine-normalizable, a state E88's model
 * has no reason to express).
 *
 * NOTHING HERE ACQUIRES ANYTHING. A registry entry is a statement that E85
 * knows a source exists and what E85 is able to do with it — no fetch, no
 * filesystem read, no PDF parsing. See the acquisition/extraction/
 * normalization/evaluation boundary in the Phase 5 report.
 */
import type { E85EffectiveDateBasis, E85TemporalWindow } from "./evidence-types";
import type { E85RuleFamily } from "./rule-family-types";
import type { E85SourceAccessStatus, E85SourceLicenseStatus, E85SourceAdapterReadiness } from "./source-readiness-types";

/**
 * Kind of regulatory instrument, in generic municipal-planning vocabulary. No
 * jurisdiction-specific member is permitted here (Phase 5 §18): "R1-1" and
 * "CD-1" are Vancouver's names for instances of `DISTRICT_SCHEDULE` and
 * `SITE_SPECIFIC_ZONING_INSTRUMENT`, and belong in the Vancouver adapter's own
 * vocabulary, never in this union.
 */
export type E85SourceType =
  /** The consolidated zoning/land-use by-law or ordinance itself. */
  | "ZONING_BYLAW"
  /** A per-district schedule within a zoning by-law, stating one district's uses and regulations. */
  | "DISTRICT_SCHEDULE"
  /** A negotiated, parcel-specific zoning instrument (comprehensive development, planned unit development, and equivalents). */
  | "SITE_SPECIFIC_ZONING_INSTRUMENT"
  /** A standalone parking/loading by-law. */
  | "PARKING_BYLAW"
  /** An official community plan, general plan, or equivalent policy document. */
  | "COMMUNITY_PLAN"
  /** Design/development-permit-area guidelines applying on top of base zoning. */
  | "DEVELOPMENT_PERMIT_GUIDELINE"
  /** A spatial dataset (zoning layer, overlay boundary layer). Registrable now; not consumable in Rule-Only Mode. */
  | "GIS_DATASET";

/**
 * Document identity, distinct from the registry's own `sourceId`. Two sources
 * can share a `bylawOrDocumentId` (every Vancouver district schedule lives
 * inside by-law 3575) while being separate registry entries with separate
 * adapters.
 */
export interface E85SourceDocumentIdentity {
  /** By-law/ordinance/code number as the jurisdiction cites it. */
  bylawOrDocumentId?: string;
  /** Official title of the document as published. */
  documentTitle: string;
  /** Named schedule within the document, when the source IS a schedule rather than a whole document. */
  schedule?: string;
}

/**
 * One published version/consolidation of a source. A regulatory document's
 * content is only meaningful paired with which consolidation it came from —
 * municipalities amend piecemeal and re-issue consolidated PDFs, frequently at
 * a new URL, with no change to the by-law's identity.
 *
 * PHASE 5A CORRECTION — SOURCE VERSION IDENTITY IS NOT A LEGAL EFFECTIVE DATE.
 * These are two different facts about two different things, and this interface
 * keeps them in separate fields on purpose:
 *
 *   `versionId` / `publishedDate` / `consolidationDate` / `consolidationPeriod`
 *       WHICH TEXT was read — the publisher's own identification of the
 *       document revision in hand.
 *   `effectiveFrom` / `effectiveDateBasis`
 *       WHEN THE RULES took legal effect.
 *
 * A consolidation is an editorial republication of provisions that took effect
 * on various earlier dates; "this PDF was consolidated in June 2026" therefore
 * establishes nothing whatsoever about when any provision inside it came into
 * force. Nothing in E85 promotes a publication/consolidation date into
 * `effectiveFrom` — see `deriveE85TemporalWindow`.
 */
export interface E85SourceVersion {
  /** Stable label for this consolidation, e.g. "2026-06-consolidation". Must not encode a local filename or path. Never parsed for dates: it is a label, not a temporal fact. */
  versionId: string;
  /** FULL ISO 8601 date (YYYY-MM-DD) the document/consolidation was published, when the document states a full date. Publication, not legal effect. */
  publishedDate?: string;
  /** FULL ISO 8601 date (YYYY-MM-DD) printed on the document as its consolidation date, when distinct from `publishedDate`. Publication, not legal effect. */
  consolidationDate?: string;
  /**
   * PHASE 5A CONTRACT ADDITION: the consolidation/publication context at
   * MONTH precision (ISO 8601 year-month, e.g. "2026-06"), for the common case
   * of a document whose only date stamp is a month — Vancouver's district
   * schedules are headed "June 2026" and nothing more.
   *
   * Exists so that "June 2026" can be recorded as the month it is instead of
   * being widened to a day nobody printed. `consolidationDate` stays undefined
   * in that case: a month-only stamp does not establish a day, and picking the
   * first of the month is a fabrication that reads as evidence downstream.
   */
  consolidationPeriod?: string;
  /**
   * FULL ISO 8601 date (YYYY-MM-DD) the RULES took legal effect. Set only when
   * a date has actually been established — never derived from a publication or
   * consolidation date by this or any other layer, and never widened from a
   * partial date. Absent means the effective date is not established, which is
   * an honest DATA_GAP, not a reason to guess.
   */
  effectiveFrom?: string;
  /** What grounds `effectiveFrom` — reuses the Phase 3 basis enum rather than duplicating it. Must be "UNKNOWN" whenever `effectiveFrom` is absent: a basis cannot explain a date that is not there. */
  effectiveDateBasis: E85EffectiveDateBasis;
  /** Convenience URL for this specific consolidation. Never identity (Phase 2 correction 9). */
  url?: string;
}

/** Strict full-date test (YYYY-MM-DD). A year-month such as "2026-06" is deliberately NOT a date here — it is a period, and treating it as a date is exactly the widening this module refuses. */
export function isFullIsoDate(value: string | undefined): value is string {
  return value !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Year-month test (YYYY-MM), the precision `consolidationPeriod` carries. */
export function isIsoYearMonth(value: string | undefined): value is string {
  return value !== undefined && /^\d{4}-\d{2}$/.test(value);
}

/**
 * The ONE place a source version becomes a temporal window, so the
 * publication-vs-effect distinction is enforced in code rather than left to
 * each adapter's discretion.
 *
 * `effectiveFrom` is carried through only when the registry states a full ISO
 * date for it. In every other case — no version record, no stated effective
 * date, or a partial one — the window's basis is "UNKNOWN" and it carries no
 * date at all. Phase 4 then reports UNDETERMINED temporal applicability
 * (applicability.ts) and the caller sees an honest gap.
 *
 * What this function deliberately does NOT do is fall back to
 * `consolidationDate`, `consolidationPeriod` or `publishedDate`. That fallback
 * is what turned a document headed "June 2026" into a rule asserted to be in
 * force from 2026-06-01 — a legal claim the source never made.
 */
export function deriveE85TemporalWindow(version: E85SourceVersion | undefined): E85TemporalWindow {
  if (version === undefined || !isFullIsoDate(version.effectiveFrom) || version.effectiveDateBasis === "UNKNOWN") {
    return { effectiveDateBasis: "UNKNOWN" };
  }
  return { effectiveFrom: version.effectiveFrom, effectiveDateBasis: version.effectiveDateBasis };
}

/** Human-readable publication context at whatever precision the document states, for provenance notes. Undefined when the version records no publication stamp at all. */
export function describeE85VersionPublication(version: E85SourceVersion | undefined): string | undefined {
  if (!version) return undefined;
  if (version.consolidationDate) return `Consolidation date ${version.consolidationDate} printed on the registered version "${version.versionId}".`;
  if (version.publishedDate) return `Publication date ${version.publishedDate} printed on the registered version "${version.versionId}".`;
  if (version.consolidationPeriod) {
    return (
      `Registered version "${version.versionId}" is stamped ${version.consolidationPeriod} at MONTH precision only; the source prints no day, ` +
      `and no day is inferred. This is a publication stamp, not a statement of when the provisions took legal effect.`
    );
  }
  return undefined;
}

/**
 * A registered source. Registration asserts only that E85 knows this document
 * exists and records what E85 can currently do with it — it asserts nothing
 * about whether a given rule can be answered today. That is
 * `E85SourceReadinessAssessment` (source-readiness-assessment.ts).
 */
export interface E85SourceDefinition {
  /** Stable logical identity — see `buildE85SourceId`. Never a filename, never a URL, never version-dependent. */
  sourceId: string;
  displayName: string;
  /** The body that authored/administers the document, e.g. "City of Vancouver". */
  publisher: string;
  /** Exact `E85Jurisdiction.jurisdictionId` this source governs. */
  jurisdictionId: string;
  sourceType: E85SourceType;
  document: E85SourceDocumentIdentity;
  /** Every consolidation E85 has registered. A version absent from this list is an unregistered version, never silently adapted. */
  versions: readonly E85SourceVersion[];
  accessStatus: E85SourceAccessStatus;
  licenseStatus: E85SourceLicenseStatus;
  adapterReadiness: E85SourceAdapterReadiness;
  /** `E85AdapterIdentity.adapterId` bound to this source, when one exists. Absent means no adapter — an explicit adaptation gap, never a fallback to another source's adapter. */
  adapterId?: string;
  /** Rule families this source is known to state. A family absent here is not "prohibited" — it is simply not covered by this document. */
  supportedRuleFamilies: readonly E85RuleFamily[];
  /** Zone designations this source covers, matched EXACTLY. Undefined means the source is not zone-scoped (e.g. a whole by-law) rather than "covers every zone". */
  supportedZoneDesignations?: readonly string[];
  /** Honest, specific statements of what this source does NOT support. Never aspirational ("not done yet"). */
  knownLimitations: readonly string[];
  /** Landing/index URL for the source generally. Never identity. */
  url?: string;
  /** ISO 8601 timestamp this registry entry's facts were last verified by a human. */
  verifiedAt?: string;
}

/** Rejected `sourceId` shapes — a local path or URL is machine-specific and/or version-volatile, and must never become a source identity (Phase 5 §20). */
const SOURCE_ID_PATTERN = /^[a-z0-9]+(?:[-.][a-z0-9]+)*(?::[a-z0-9]+(?:[-.][a-z0-9]+)*)+$/;

export interface E85SourceIdParts {
  /** Exact jurisdiction id, e.g. "ca-bc-vancouver". */
  jurisdictionId: string;
  /** Slug for the governing document, e.g. "zoning-development-bylaw-3575". */
  documentSlug: string;
  /** Optional slug for a schedule/part within the document, e.g. "district-schedule-r1-1". */
  scheduleSlug?: string;
}

/**
 * Builds a stable, machine-independent source identity of the form
 * `<jurisdictionId>:<documentSlug>[:<scheduleSlug>]`.
 *
 * Deliberately excludes the version: a consolidation is a version OF a source,
 * not a different source, so `sourceId` stays stable across consolidations and
 * the version travels separately (`E85SourceVersion.versionId`, and
 * `E85Provenance.sourceVersionId` on each normalized value).
 *
 * Throws on a malformed identity. This is a programmer/invariant failure — a
 * hard-coded registry entry with a bad id is a bug, not an expected runtime
 * data condition, so it is one of the few places Phase 5 throws rather than
 * returning a typed result (Phase 5 §22).
 */
export function buildE85SourceId(parts: E85SourceIdParts): string {
  const segments = [parts.jurisdictionId, parts.documentSlug, ...(parts.scheduleSlug ? [parts.scheduleSlug] : [])];
  const id = segments.join(":");
  if (!SOURCE_ID_PATTERN.test(id)) {
    throw new Error(
      `Invalid E85 sourceId "${id}": expected lower-case colon-separated slugs (e.g. "ca-bc-vancouver:zoning-development-bylaw-3575:district-schedule-r1-1"). ` +
        `Filesystem paths, URLs, upper case, and spaces are rejected because a source identity must be stable and machine-independent.`,
    );
  }
  return id;
}

/** Whether `sourceId` conforms to the stable-identity convention, without throwing. */
export function isValidE85SourceId(sourceId: string): boolean {
  return SOURCE_ID_PATTERN.test(sourceId);
}

/** Looks up one registered version of a source by exact `versionId`. No nearest-version fallback. */
export function findE85SourceVersion(source: E85SourceDefinition, versionId: string): E85SourceVersion | undefined {
  return source.versions.find((v) => v.versionId === versionId);
}

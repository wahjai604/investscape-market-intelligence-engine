/**
 * InvestScape™ E85 Phase 5 — Vancouver R1-1 pilot: registered source and
 * jurisdiction records.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Registry METADATA only — the identity, version, licence and coverage facts
 * about the R1-1 District Schedule. Nothing here reads, downloads, or embeds
 * the document. The local PDF used during Phase 3B primary-source validation
 * is evidence for a human, never an input to this code: no path to it appears
 * anywhere, and every test that exercises this source uses curated facts held
 * in the test file itself.
 *
 * `sourceId` is built from jurisdiction + document + schedule and excludes the
 * consolidation, so it survives Vancouver re-issuing the schedule at a new URL
 * on the next consolidation — which is exactly what Vancouver does, and why
 * Phase 3's provenance model already refuses to treat a URL as identity.
 *
 * EVERY FACT BELOW IS ONE THE PRIMARY SOURCE ACTUALLY SUPPORTS. Two of them
 * are negative facts, recorded as such rather than filled in with a plausible
 * value (Phase 5A evidence-semantics remediation):
 *
 *   temporal — the schedule prints "June 2026" and no day, and states no
 *              effective/adoption/enactment date at all. So the version carries
 *              a month-precision `consolidationPeriod` and NO `effectiveFrom`.
 *   licence  — the schedule carries no copyright, licence, open-data or
 *              terms-of-use statement at all. So `licenseStatus` records that
 *              the terms are unknown, not that reuse is permitted.
 *
 * ACCESS AND LICENSING ARE SEPARATE AXES AND ARE ANSWERED SEPARATELY. That E85
 * can obtain and read this document (access) says nothing about what E85 may
 * reproduce, package or redistribute from it (licensing), and an established
 * answer on the first must never be allowed to supply an answer to the second.
 */
import type { E85Jurisdiction } from "../../jurisdiction-types";
import type { E85SourceDefinition } from "../../source-registry-types";
import { buildE85SourceId } from "../../source-registry-types";

export const VANCOUVER_JURISDICTION_ID = "ca-bc-vancouver";

export const VANCOUVER_JURISDICTION: E85Jurisdiction = {
  jurisdictionId: VANCOUVER_JURISDICTION_ID,
  country: "CA",
  regionCode: "BC",
  municipality: "Vancouver",
  regulatoryAuthority: "City of Vancouver — Planning, Urban Design and Sustainability",
  displayName: "City of Vancouver, BC, Canada",
};

/** The zone this pilot covers. One zone, deliberately: the pilot proves the architecture, not Vancouver coverage. */
export const VANCOUVER_R1_1_ZONE = "R1-1";

/** The consolidation Phase 3B validated against, and the only one this adapter claims. A SOURCE VERSION LABEL — not a date, and never parsed as one. */
export const VANCOUVER_R1_1_VERSION_ID = "2026-06-consolidation";

/**
 * The publication stamp the schedule actually prints, at the precision it
 * prints it. Every page of the R1-1 District Schedule is headed
 * "City of Vancouver — June 2026 — Zoning and Development By-law"; the document
 * states no day, and Phase 3B's primary-source review established no day.
 */
export const VANCOUVER_R1_1_CONSOLIDATION_PERIOD = "2026-06";

export const VANCOUVER_R1_1_SOURCE_ID = buildE85SourceId({
  jurisdictionId: VANCOUVER_JURISDICTION_ID,
  documentSlug: "zoning-development-bylaw-3575",
  scheduleSlug: "district-schedule-r1-1",
});

/** Adapter identity, exported here so the source record and the adapter cannot drift apart. */
export const VANCOUVER_R1_1_ADAPTER_ID = "ca-bc-vancouver.district-schedule.r1-1";

/** Bumped whenever normalization logic changes in a way that could alter output for unchanged input. Stamped onto every value's provenance. */
export const VANCOUVER_R1_1_ADAPTER_VERSION = "1.0.0";

export const VANCOUVER_R1_1_SOURCE: E85SourceDefinition = {
  sourceId: VANCOUVER_R1_1_SOURCE_ID,
  displayName: "City of Vancouver — R1-1 District Schedule",
  publisher: "City of Vancouver",
  jurisdictionId: VANCOUVER_JURISDICTION_ID,
  sourceType: "DISTRICT_SCHEDULE",
  document: {
    bylawOrDocumentId: "3575",
    documentTitle: "Zoning and Development By-law",
    schedule: "District Schedule R1-1",
  },
  versions: [
    {
      versionId: VANCOUVER_R1_1_VERSION_ID,
      // MONTH precision, because that is all the document prints. No
      // `consolidationDate` and no `effectiveFrom`: the schedule states no day
      // and no effective/adoption/enactment date anywhere, so there is no full
      // date to record and none is manufactured from the month.
      consolidationPeriod: VANCOUVER_R1_1_CONSOLIDATION_PERIOD,
      effectiveDateBasis: "UNKNOWN",
    },
  ],
  // ACCESS is established: the schedule is published by the City and was
  // retrieved and read during Phase 3B primary-source validation.
  accessStatus: "AVAILABLE",
  // LICENSING is NOT established, and is a separate question from access. The
  // schedule carries no copyright notice, no licence grant, no open-data
  // designation and no terms-of-use statement of any kind, so nothing in the
  // primary evidence supports PUBLIC_REUSE. "Anyone may read it" is not
  // "anyone may redistribute it", and the honest record of an unstated right is
  // that it is unknown — not that it is granted.
  licenseStatus: "LICENSE_UNKNOWN",
  adapterReadiness: "BUILT_VERIFIED",
  adapterId: VANCOUVER_R1_1_ADAPTER_ID,
  supportedRuleFamilies: ["USE", "DENSITY", "DIMENSIONAL"],
  supportedZoneDesignations: [VANCOUVER_R1_1_ZONE],
  knownLimitations: [
    "Covers the R1-1 District Schedule only. No other Vancouver district schedule is registered, and no other municipality falls back to this source.",
    "Parking, loading and bicycle ratios are NOT normalized. Phase 3B verified the Vancouver Parking By-law's section structure only, not its quantitative tables, so no numeric parking requirement has been validated for use.",
    "Amenity and overlay families are not covered by this schedule extract.",
    "Site-specific (CD-1) zoning is out of scope: its terms are negotiated per site and cannot be generalized from a district-schedule pattern. CD-1 is a real, published Vancouver zoning instrument with its own district schedule — 'not normalized here', never 'does not exist'.",
    "Only the subset of R1-1 provisions validated during Phase 3B primary-source review is normalized; the schedule states more than this pilot encodes.",
    "NO EFFECTIVE DATE IS ESTABLISHED. The schedule is stamped 'June 2026' and states no day, and no adoption, enactment or coming-into-force date appears anywhere in it. Rules normalized from this source therefore carry an UNKNOWN temporal basis, and Phase 4 reports temporal applicability as UNDETERMINED rather than assuming they were in force on any given date.",
    "REDISTRIBUTION RIGHTS ARE UNKNOWN. The document carries no copyright, licence, open-data or terms-of-use statement, so no reuse or redistribution permission has been established for its content. Public accessibility was verified; permission to reproduce or redistribute was not.",
  ],
};

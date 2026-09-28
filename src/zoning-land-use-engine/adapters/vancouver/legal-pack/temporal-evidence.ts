/**
 * InvestScape™ E85 — Vancouver legal pack: temporal evidence (DRY RUN ONLY).
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Server-side temporal evidence for the two pinned source versions and the
 * designations observed at the two synthetic test points, built with the
 * engine's own validity builders. NOT WIRED: nothing in the public path,
 * the manifest or the server assembly reads it. The manifest stays
 * NOT_RELEASED with asOfResolution DISABLED and versionValidity UNKNOWN; the
 * assembly still produces no `temporalEvidence`; and the public path still
 * refuses temporal evidence alongside an AS_OF-disabled pack. It exists so an
 * internal dry run can show exactly which evidence is missing.
 *
 * WHAT IS PINNED (every date below is read from bytes pinned in the
 * workspace evidence checksum manifest; digests in
 * `VANCOUVER_TEMPORAL_PINNED_SOURCES`):
 *   - R1-1 "2026-06-consolidation" incorporates By-law 14747, whose s.37
 *     reads: "This by-law is to come into force and take effect on June 30,
 *     2026." 14747 is the latest instrument amending R1-1 in the City
 *     amendment index. That date is AMENDMENT EVIDENCE only: whether the
 *     June reprint was published before 14747 took effect is open (City Q2),
 *     so the consolidation's own validity is START_UNKNOWN, not 2026-06-30.
 *   - C-2C "2026-05-consolidation" starts on By-law 14697 cl.19: "This by-law
 *     is to come into force and take effect on the date of its enactment",
 *     enacted "this 19th day of May, 2026". 14697 is the latest instrument
 *     amending C-2C in that index.
 *   - The end review is the amendment index captured 2026-09-15, which lists
 *     no later amendment to either schedule. It proves nothing after that.
 *
 * WHAT IS DELIBERATELY OPEN. R1-1 has no established start (pending Q2), so it
 * is START_UNKNOWN. C-2C has a start but no end, so it is
 * OPEN_REVIEWED_NO_END_ESTABLISHED. The engine selects only CLOSED versions,
 * so neither is selectable; that is the point of the dry run, not a defect.
 * No reviewed-open coverage policy is introduced here.
 *
 * DESIGNATION. No instrument dating the district at either synthetic point is
 * held, so each is an OPEN_OBSERVATION_ASSERTION grounded in the zoning
 * layer's City processing date. That is an observation, never a legal date.
 */
import { buildE85VersionValidity, type E85VersionValidity } from "../../../version-validity-types";
import { buildE85DesignationValidity, type E85DesignationValidity } from "../../../designation-validity-types";

/** An evidence file this module's dates are read from, pinned by digest. */
export interface E85VancouverPinnedTemporalSource {
  /** AMENDMENT_EVIDENCE: dates an incorporated amendment, NOT the consolidation's validity start. */
  readonly role: "VERSION_START_AUTHORITY" | "AMENDMENT_EVIDENCE" | "END_REVIEW" | "DESIGNATION_OBSERVATION";
  readonly instrument: string;
  readonly sha256: string;
  /** What in the bytes supports the date. A short locator, not by-law text beyond the operative words. */
  readonly supports: string;
}

export const VANCOUVER_TEMPORAL_PINNED_SOURCES: readonly E85VancouverPinnedTemporalSource[] = [
  { role: "AMENDMENT_EVIDENCE", instrument: "By-law 14747", sha256: "dc06460992fa36e09a2db08ff2ca506ed7625790bdd0b87ba3fe6ede4386d1c7", supports: "s.37 commencement on 2026-06-30 (amendment only; consolidation start pending Q2)" },
  { role: "VERSION_START_AUTHORITY", instrument: "By-law 14697", sha256: "b28b9d4223dfa4761381c6975deace4d0c41ded9922d335d3b2f9ff1c8122478", supports: "cl.19 in force on enactment; enacted 2026-05-19" },
  { role: "END_REVIEW", instrument: "City zoning amendments index (captured 2026-09-15)", sha256: "7a0093b8378147a53144a57d29857bf7c73b24cf4d0ac8052afca1677beeb83c", supports: "no amendment to R1-1 or C-2C after 14747 / 14697" },
  { role: "DESIGNATION_OBSERVATION", instrument: "zoning-districts-and-labels export (EPSG:26910)", sha256: "35e65736c1a577eb38e2d5165b90c1e88946e13a28abe2711fd3773a7393a0ef", supports: "City processing date 2026-06-29 (time zone unstated)" },
];

const INDEX = VANCOUVER_TEMPORAL_PINNED_SOURCES[2];

/**
 * Provenance of the end-review date. GIT_PINNED_AUDIT: the date is recorded
 * in `VANCOUVER-LEGAL-PACK-READINESS.md` at evidence-repo commit 60728b5, and
 * has NO SHA-256 entry, unlike the source documents in
 * `VANCOUVER_TEMPORAL_PINNED_SOURCES`. This label describes provenance only.
 * Nothing reads it: it does not affect validity, selection, currency or
 * public output.
 */
export const VANCOUVER_END_REVIEW_DATE_PROVENANCE = {
  provenance: "GIT_PINNED_AUDIT",
  date: "2026-09-26",
  document: "VANCOUVER-LEGAL-PACK-READINESS.md",
  commit: "60728b5",
} as const;

/** The date the amendment-index review was performed (see `VANCOUVER_END_REVIEW_DATE_PROVENANCE`). */
const END_REVIEWED_AT = VANCOUVER_END_REVIEW_DATE_PROVENANCE.date;

const END_REVIEW = {
  sourcesChecked: [`${INDEX.instrument} sha256:${INDEX.sha256}`],
  reviewedAt: END_REVIEWED_AT,
};

/**
 * START_UNKNOWN pending City Q2. The 14747 s.37 commencement (2026-06-30) is
 * retained in `VANCOUVER_TEMPORAL_PINNED_SOURCES` as AMENDMENT_EVIDENCE and is
 * deliberately not used as this consolidation's validity start.
 */
export const VANCOUVER_R1_1_VERSION_VALIDITY: E85VersionValidity = buildE85VersionValidity({ state: "START_UNKNOWN" });

export const VANCOUVER_C_2C_VERSION_VALIDITY: E85VersionValidity = buildE85VersionValidity({
  state: "OPEN_REVIEWED_NO_END_ESTABLISHED",
  effectiveFrom: "2026-05-19",
  start: {
    eventKind: "IMMEDIATE_ON_ENACTMENT",
    effectiveFrom: "2026-05-19",
    enactmentDate: "2026-05-19",
    authoritySourceId: "ca-bc-vancouver:bylaw-14697",
    authoritySourceVersionId: "as-enacted-b28b9d42",
    enactmentLocator: { bylawOrDocumentId: "14697", section: "enactment statement" },
    expressImmediacyLocator: { bylawOrDocumentId: "14697", clause: "19" },
    effectiveDateBasis: "SOURCE_STATED",
  },
  endReview: END_REVIEW,
});

/** Version validity by the pinned source version it dates. */
export const VANCOUVER_VERSION_VALIDITY_BY_SOURCE: ReadonlyMap<string, { readonly sourceVersionId: string; readonly validity: E85VersionValidity }> = new Map([
  ["ca-bc-vancouver:zoning-development-bylaw-3575:district-schedule-r1-1", { sourceVersionId: "2026-06-consolidation", validity: VANCOUVER_R1_1_VERSION_VALIDITY }],
  ["ca-bc-vancouver:zoning-development-bylaw-3575:district-schedule-c-2c", { sourceVersionId: "2026-05-consolidation", validity: VANCOUVER_C_2C_VERSION_VALIDITY }],
]);

/**
 * Observation-only designation for a zoning-layer feature. The observation
 * date is the layer's City processing date, DATE ONLY: the City states no
 * time zone for 2026-06-29T06:47, so no instant is claimed.
 */
export function vancouverObservedDesignation(zoneDesignation: string): E85DesignationValidity {
  return buildE85DesignationValidity({
    state: "OPEN_UNRESEARCHED",
    identity: { jurisdictionId: "ca-bc-vancouver", districtOrZoneId: zoneDesignation },
    start: {
      kind: "OPEN_OBSERVATION_ASSERTION",
      observation: {
        observedAt: "2026-06-29",
        datasetId: "vancouver-zoning",
        sourceDescription: `zoning-districts-and-labels export sha256:${VANCOUVER_TEMPORAL_PINNED_SOURCES[3].sha256}; City processing date, time zone unstated`,
      },
    },
  });
}

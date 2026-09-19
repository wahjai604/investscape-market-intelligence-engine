/**
 * InvestScape™ E85 Phase 14.4B — Vancouver C-2C pilot: registered source and
 * jurisdiction records.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * SECOND DISTRICT, DELIBERATELY NARROW. This proves the generic Phase 4-9
 * pipeline against a second real Vancouver source, not full C-2C coverage.
 * C-2C states considerably more than this file's fact set represents — no
 * density, no height, no storeys, no requirement rule of any kind is
 * registered here. See `knownLimitations` below for the specific, named
 * omissions and why each is deliberate rather than an oversight.
 *
 * Registry METADATA only — the identity, version, licence and coverage facts
 * about the C-2C District Schedule. Nothing here reads, downloads, or embeds
 * the document. Every test that exercises this source uses curated facts held
 * in the test fixture file itself.
 *
 * TEMPORAL NOTE. `sourceVersionId` ("2026-05-consolidation") identifies WHICH
 * TEXT was read — the schedule's own reprint stamp, month precision. It is
 * NOT a fact effective date. Every structured fact in this pilot instead
 * carries its own proven `temporal`/`temporalAuthority` (By-law 13447 clause
 * 28, in force 2022-11-14) established independently in the fixture file,
 * exactly as `r1-1-source.ts` keeps value provenance (current schedule text)
 * and temporal provenance (the amending by-law) as two distinct axes.
 *
 * LICENSING. The standalone C-2C schedule PDF carries no copyright or
 * terms-of-use notice, same as R1-1's schedule. `LICENSE_UNKNOWN` — never
 * inherited from the spatial layer's PUBLIC_REUSE status, which is a
 * different axis entirely.
 */
import type { E85SourceDefinition } from "../../source-registry-types";
import { buildE85SourceId } from "../../source-registry-types";
import { VANCOUVER_JURISDICTION_ID } from "./r1-1-source";

/** The zone this pilot covers. One zone, deliberately: this is a second-district proof, not C-2C coverage. */
export const VANCOUVER_C_2C_ZONE = "C-2C";

/** The consolidation this pilot's facts were checked against. A SOURCE VERSION LABEL — not a date, and never parsed as one. */
export const VANCOUVER_C_2C_VERSION_ID = "2026-05-consolidation";

/** The publication stamp the standalone C-2C schedule prints, at the precision it prints it (month only). */
export const VANCOUVER_C_2C_CONSOLIDATION_PERIOD = "2026-05";

export const VANCOUVER_C_2C_SOURCE_ID = buildE85SourceId({
  jurisdictionId: VANCOUVER_JURISDICTION_ID,
  documentSlug: "zoning-development-bylaw-3575",
  scheduleSlug: "district-schedule-c-2c",
});

/** Adapter identity, exported here so the source record and the adapter cannot drift apart. */
export const VANCOUVER_C_2C_ADAPTER_ID = "ca-bc-vancouver.district-schedule.c-2c";

/** Bumped whenever normalization logic changes in a way that could alter output for unchanged input. Stamped onto every value's provenance. */
export const VANCOUVER_C_2C_ADAPTER_VERSION = "1.0.0";

/**
 * PHASE 14.4B — exactly USE and DIMENSIONAL. No DENSITY (the §3.1 gate,
 * Sub-Area A, and the 0.35 minimum-non-dwelling-FSR proviso are all
 * load-bearing and unresolved from available evidence), no REQUIREMENT (the
 * Rental Housing Stock ODP dependency is out of scope for this slice).
 * Keeping the adapter identity and the source definition's own
 * `supportedRuleFamilies` in lockstep is the specific lesson carried forward
 * from the R1-1 mismatch this project found and fixed (Phase 14.4A.1).
 */
export const VANCOUVER_C_2C_SUPPORTED_RULE_FAMILIES = ["USE", "DIMENSIONAL"] as const;

export const VANCOUVER_C_2C_SOURCE: E85SourceDefinition = {
  sourceId: VANCOUVER_C_2C_SOURCE_ID,
  displayName: "City of Vancouver — C-2C District Schedule",
  publisher: "City of Vancouver",
  jurisdictionId: VANCOUVER_JURISDICTION_ID,
  sourceType: "DISTRICT_SCHEDULE",
  document: {
    bylawOrDocumentId: "3575",
    documentTitle: "Zoning and Development By-law",
    schedule: "District Schedule C-2C",
  },
  versions: [
    {
      versionId: VANCOUVER_C_2C_VERSION_ID,
      // MONTH precision, because that is all the document prints. No
      // `effectiveFrom` at the version level: the reprint stamp identifies
      // which text was read, not when any provision took legal effect.
      consolidationPeriod: VANCOUVER_C_2C_CONSOLIDATION_PERIOD,
      effectiveDateBasis: "UNKNOWN",
    },
  ],
  accessStatus: "AVAILABLE",
  licenseStatus: "LICENSE_UNKNOWN",
  adapterReadiness: "BUILT_VERIFIED",
  adapterId: VANCOUVER_C_2C_ADAPTER_ID,
  supportedRuleFamilies: [...VANCOUVER_C_2C_SUPPORTED_RULE_FAMILIES],
  supportedZoneDesignations: [VANCOUVER_C_2C_ZONE],
  knownLimitations: [
    "Covers 6 of 71 C-2C §2.1 use rows and 1 of ~35 dimensional provisions. Deliberately narrow — a second-district proof of the generic engine, not C-2C coverage.",
    "NO DENSITY VALUE IS PUBLISHED. Every §3.1/§3.2 floor space ratio figure is either gated by the §3.1 residential-rental-tenure regime (bedroom-mix definitional limb, Sub-Area A geography with no machine-readable boundary, and the RHS ODP dependency) or conditioned on a minimum non-dwelling floor space ratio at grade (the §3.1.1.1/§3.2.1.1 proviso) that this record does not represent. Publishing a maximum FSR without that proviso would assert an entitlement the by-law does not actually grant to every proposal.",
    "NO HEIGHT OR STOREYS VALUE IS PUBLISHED. Both regimes' published maximum-height figures are overridden, for a majority-plausible site, by an angular building envelope (§3.1.2.8, §3.2.2.6) this record does not model — publishing the bare figures would be misleading, not merely incomplete.",
    "NO REQUIREMENT RULE IS PUBLISHED. The §2.2.5 rental-replacement obligation via the Rental Housing Stock Official Development Plan (By-law 9488, extended to C-2C by By-law 12955) is a real, separately-enacted instrument this pilot does not hold or structure.",
    "Retail Store is deliberately excluded from the USE facts despite appearing Outright in §2.1: it carries real, unresolved Section 11 dependencies (a liquor-store carve-out and a used-merchandise floor-area allowance) that this pilot does not attempt to structure.",
    "Maximum unit frontage (15.3 m, §3.1.2.1/§3.2.2.1) is not published: no existing E85 dimensional field honestly represents a tenancy/unit-frontage limit, and inventing one was out of scope for this slice.",
    "The §3.1.2.13/§3.2.2.11 parking-area setback (1.2 m) is not published as a structured DIMENSIONAL fact: `E85DimensionalRule.setbacksMetres` is a free-string-keyed map whose keys are presented downstream as undifferentiated yard/building-envelope setbacks, and a parking-specific setback placed in that map would be indistinguishable from a general building setback to any downstream consumer. Recorded only as a source finding.",
    "The angular building envelope, the minimum-FSR proviso, the bedroom-mix definitional clause, Sub-Area A's geographic exclusion, accessory-use/-building percentage caps, and the RHS ODP/rental-replacement dependency are none of them modeled in any form — see the adapter's own source findings for each.",
    "NO EFFECTIVE DATE IS ESTABLISHED AT THE VERSION LEVEL. The schedule's own reprint stamp is month-precision only and states no adoption/enactment/coming-into-force date. Every structured fact in this pilot instead carries its own proven `temporal`/`temporalAuthority` (By-law 13447 clause 28, in force 2022-11-14), established independently of this version stamp.",
    "REDISTRIBUTION RIGHTS ARE UNKNOWN. The standalone schedule PDF carries no copyright, licence, open-data or terms-of-use statement.",
    "This record does not establish coverage of any other Vancouver commercial district (C-2, C-2A, C-2B, C-2C1, or any other C-series schedule).",
  ],
};

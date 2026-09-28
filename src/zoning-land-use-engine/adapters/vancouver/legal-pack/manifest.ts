/**
 * InvestScape™ E85 — Vancouver R1-1 + C-2C legal pack: manifest and loader.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Built from the audited legal-pack manifest proposal and the workspace's
 * committed evidence checksums. Every digest here is the SHA-256 of a pinned
 * evidence file; the evidence gate (`npm run test:evidence`) re-hashes those
 * files and fails on any difference. No path to them appears in this module.
 *
 * NOT RELEASED AND NOT RESOLVABLE. `asOfResolution: "DISABLED"` and
 * `releaseStatus: "NOT_RELEASED"` are literals. Loading the pack proves the
 * binding; it does not register the pack with any decision path or route.
 *
 * To change a fact: edit it in r1-1-facts.ts / c-2c-facts.ts, bump the
 * adapter version if normalized output changes, then re-pin `factSetSha256`
 * here. Anything else fails the load.
 */
import {
  E85LegalPackIntegrityError,
  E85LegalPackManifest,
  E85LegalPackSourceContent,
  e85LegalPackBindingProblems,
} from "../../../legal-pack-integrity";
import { VANCOUVER_C_2C_SOURCE } from "../c-2c-source";
import { vancouverC2CAdapter } from "../c-2c-adapter";
import { VANCOUVER_R1_1_SOURCE } from "../r1-1-source";
import { vancouverR11Adapter } from "../r1-1-adapter";
import { C_2C_FACTS, C_2C_UNSTRUCTURED_SECTIONS } from "./c-2c-facts";
import { R1_1_FACTS, R1_1_UNSTRUCTURED_SECTIONS } from "./r1-1-facts";

export const VANCOUVER_LEGAL_PACK_ID = "ca-bc-vancouver.base-zoning.r1-1+c-2c";

/**
 * Every pin is a literal, never imported from the constants the loader checks
 * against: a pin that recomputes itself cannot catch drift. Bumping an
 * adapter version or relabelling a source version therefore fails the load
 * until the manifest is re-pinned on purpose.
 */
export const VANCOUVER_LEGAL_PACK_MANIFEST: E85LegalPackManifest = {
  manifestFormat: "e85-legal-pack-1",
  legalPackId: VANCOUVER_LEGAL_PACK_ID,
  jurisdictionId: "ca-bc-vancouver",
  releaseStatus: "NOT_RELEASED",
  asOfResolution: "DISABLED",
  currencyCheckedThrough: {
    indexCaptureDate: "2026-09-15",
    indexSha256: "7a0093b8378147a53144a57d29857bf7c73b24cf4d0ac8052afca1677beeb83c",
  },
  openUnknowns: {
    versionValidity: "UNKNOWN",
    definitionHistory: "NOT_PROVEN_COMPLETE",
    licence: "LICENSE_UNKNOWN",
    amendmentCurrency: "CHECKED_THROUGH_INDEX_CAPTURE_ONLY",
  },
  reproduction: {
    structuredValuesAndCitations: "EXPOSABLE_PENDING_CITY_REUSE_ANSWER",
    bylawText: "NOT_ESTABLISHED_DO_NOT_REPRODUCE",
    pageImagesAndPdfs: "DO_NOT_REDISTRIBUTE",
  },
  sources: [
    {
      zoneDesignation: "R1-1",
      sourceId: "ca-bc-vancouver:zoning-development-bylaw-3575:district-schedule-r1-1",
      sourceVersionId: "2026-06-consolidation",
      consolidationPeriod: "2026-06",
      versionEffectiveDateBasis: "UNKNOWN",
      sourcePdfSha256: "2526db0b7a7df787222348a43011ad64d1c52d4699c218f287aaa346cc38d514",
      adapterId: "ca-bc-vancouver.district-schedule.r1-1",
      adapterVersion: "1.1.0",
      licenseStatus: "LICENSE_UNKNOWN",
      accessStatus: "AVAILABLE",
      factIds: [
        "r1-1-requirement-001",
        "r1-1-requirement-002",
        "r1-1-use-001",
        "r1-1-use-003",
        "r1-1-use-004",
        "r1-1-use-005",
        "r1-1-density-002",
        "r1-1-density-003",
        "r1-1-density-004",
        "r1-1-density-005",
        "r1-1-density-006",
        "r1-1-dim-006",
        "r1-1-dim-007",
        "r1-1-dim-008",
        "r1-1-dim-009",
        "r1-1-dim-010",
        "r1-1-dim-011",
        "r1-1-dim-012",
        "r1-1-dim-013",
      ],
      factSetSha256: "0fee9c560a27a3c4037c6f036fba2f62805d4eb97713d10ab094be5756d3de93",
    },
    {
      zoneDesignation: "C-2C",
      sourceId: "ca-bc-vancouver:zoning-development-bylaw-3575:district-schedule-c-2c",
      sourceVersionId: "2026-05-consolidation",
      consolidationPeriod: "2026-05",
      versionEffectiveDateBasis: "UNKNOWN",
      sourcePdfSha256: "4fe8197ec979b347210f195bbeacaa1dd98153e84ea69f90ecf52321b0db621a",
      adapterId: "ca-bc-vancouver.district-schedule.c-2c",
      adapterVersion: "1.1.0",
      licenseStatus: "LICENSE_UNKNOWN",
      accessStatus: "AVAILABLE",
      factIds: ["c-2c-use-001", "c-2c-use-002", "c-2c-use-003", "c-2c-use-004", "c-2c-use-005", "c-2c-use-006", "c-2c-dim-001"],
      factSetSha256: "5a187daa95a253370a6e848e9a6752585e0f87f5d8550f20a116e92f6722cd76",
    },
  ],
  instruments: [
    { bylawOrDocumentId: "13447", role: "DATES_FACTS", sha256: "4d595bb88455988163d480937564be9b0a5b0b699562fd4df01ebecb0c589935" },
    { bylawOrDocumentId: "13817", role: "DATES_FACTS", sha256: "90f77f77be303a8e0b5eee48845e60635675691aade6dc81288e82262f9c11ed" },
    { bylawOrDocumentId: "14747", role: "DATES_FACTS", sha256: "dc06460992fa36e09a2db08ff2ca506ed7625790bdd0b87ba3fe6ede4386d1c7" },
    { bylawOrDocumentId: "13967", role: "QUALIFIER_HISTORY", sha256: "f299ab375e7e182c1201d9a61030f4d1ac17a1f8b3d121518cf73660066493d9" },
    { bylawOrDocumentId: "14485", role: "QUALIFIER_HISTORY", sha256: "376b304d844f63cb472958c023c257844e8b610ea06cbfb1468633a76016cec4" },
  ],
  packLevelDisclosures: [
    "Sections 10 and 11 of By-law 3575 apply to every use and may vary dimensional values (e.g. section 10.22.1, By-law 13947).",
    "The Section 2 definition chain is not proven complete.",
    "Amendment currency is checked through the City amendment index captured 2026-09-15 only.",
    "Neither source version's own effective date is established; each fact carries the date of its own amending instrument.",
    "By-law text licence unknown: values and citations only; consult the by-law.",
  ],
  openGates: [
    { gateId: "CITY_Q1_REUSE", description: "Reuse terms for by-law content (structured values, citations, short extracts) are unanswered." },
    { gateId: "CITY_Q2_CONSOLIDATION_TIMING", description: "Whether the June 2026 R1-1 reprint was published before 14747 took effect (2026-06-30) is unanswered." },
    { gateId: "CITY_Q3_VOLUME_CURRENCY", description: "Whether the volume's 'effective July 29, 2026' statement covers every part is unanswered." },
    { gateId: "CITY_Q4_DEFINITION_HISTORY", description: "No authoritative Section 2 definition amendment history is held." },
    { gateId: "CITY_Q5_MISSING_C_2C_INSTRUMENTS", description: "The instruments behind the C-2C 'RS'->'R1' substitution and the §2.2.1(f) limb are not located." },
    { gateId: "CITY_Q6_LAYER_AUTHORITY", description: "Whether the zoning layer is authoritative for district-at-point is unanswered." },
    { gateId: "AMENDMENT_INDEX_RECAPTURE", description: "Re-capture the amendment index at promotion; amendments after 2026-09-15 are unchecked." },
    { gateId: "SCHEDULE_J_SOURCE_IDENTITY", description: "Schedule J has no source identity; the cash-in-lieu rate stays withheld." },
  ],
};

export const VANCOUVER_LEGAL_PACK_CONTENT: readonly E85LegalPackSourceContent[] = [
  { source: VANCOUVER_R1_1_SOURCE, adapter: vancouverR11Adapter, facts: R1_1_FACTS, unstructuredSections: R1_1_UNSTRUCTURED_SECTIONS },
  { source: VANCOUVER_C_2C_SOURCE, adapter: vancouverC2CAdapter, facts: C_2C_FACTS, unstructuredSections: C_2C_UNSTRUCTURED_SECTIONS },
];

export interface E85LoadedLegalPack {
  readonly manifest: E85LegalPackManifest;
  readonly content: readonly E85LegalPackSourceContent[];
}

/**
 * Startup gate. Throws `E85LegalPackIntegrityError` listing every mismatch
 * between the manifest and the shipped facts, sources and adapters. Arguments
 * exist so tests can prove a divergent pack is refused; production calls it
 * with none.
 */
export function loadVancouverLegalPack(
  manifest: E85LegalPackManifest = VANCOUVER_LEGAL_PACK_MANIFEST,
  content: readonly E85LegalPackSourceContent[] = VANCOUVER_LEGAL_PACK_CONTENT,
): E85LoadedLegalPack {
  const problems = e85LegalPackBindingProblems(manifest, content);
  if (problems.length > 0) throw new E85LegalPackIntegrityError(manifest.legalPackId, problems);
  return Object.freeze({ manifest, content });
}

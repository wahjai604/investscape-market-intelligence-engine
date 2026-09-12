/**
 * InvestScape™ E70 Phase 6 — RLB Second-Table Verification Record.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Formalizes, as a typed, machine-readable record, the unresolved finding
 * Phase 3 first surfaced (Phase 3 doc Section 2.4; documented inline in
 * `taxonomy.ts` next to `KNOWN_UNSUPPORTED_CANONICAL_SUBTYPES`): the RLB Q2
 * 2026 North America report re-fetched in Phase 3 contains a SECOND
 * "Indicative Construction Costs" table — apparently covering Industrial
 * Warehouse, Parking (Ground/Basement), Residential (Multi-Family/Single-
 * Family), and Education (Elementary/High School/University) — that was
 * never transcribed into E68 and whose column-to-category assignment could
 * not be independently cross-validated against any known-good baseline
 * (unlike the first table, whose Austin/Miami/Seattle/Phoenix rows matched
 * E68's existing figures digit-for-digit before the other 16 cities were
 * trusted — Phase 3 Section 2.1).
 *
 * PHASE 6 RE-INVESTIGATION SCOPE: this phase re-reviewed the existing
 * project record (Phase 3 doc, taxonomy.ts's inline note, source-
 * research.ts) for any NEW evidence that would let this be resolved. No new
 * PDF re-fetch or independent table-region extraction was performed this
 * phase (Phase 6 is a source-adapter-architecture phase, not a data-
 * acquisition phase) — per the task's own instruction, "investigate only to
 * the extent supported by source material already available in the
 * repository." No new evidence exists beyond what Phase 3 already
 * documented. The verdict is therefore UNCHANGED: UNVERIFIED, not ingested.
 *
 * This record exists so the open question has a stable, typed home instead
 * of living only in a prose comment — the next phase (or a human reviewer
 * with access to the actual PDF page layout, not a text-layer extraction)
 * has one canonical place to update.
 */

export type SecondTableVerificationStatus = "UNVERIFIED";

export interface SecondTableVerificationRecord {
  status: SecondTableVerificationStatus;
  sourceId: string;
  reportTitle: string;
  reportUrl: string;
  tableIdentity: string;
  suspectedCategories: readonly string[];
  suspectedGeography: string;
  ambiguity: string;
  evidenceAlreadyGathered: readonly string[];
  evidenceNeededToResolve: readonly string[];
  reasonIngestionIsBlocked: string;
  /** Where the original finding and every subsequent re-review is recorded. */
  history: readonly { phase: string; date: string; note: string }[];
}

export const RLB_SECOND_TABLE_VERIFICATION: SecondTableVerificationRecord = {
  status: "UNVERIFIED",
  sourceId: "rlb-north-america",
  reportTitle: "RLB Quarterly Construction Cost Report — North America, Q2 2026",
  reportUrl: "https://www.rlb.com/wp-content/uploads/sites/4/2026/06/Q2-2026-QCR_7.7.2026.pdf",
  tableIdentity: 'A second "Indicative Construction Costs" continuation table, distinct from the first table already ingested (office/retail/hotel/hospital, 7 subtypes, cross-validated in Phase 3).',
  suspectedCategories: [
    "Industrial Warehouse",
    "Parking (Ground)",
    "Parking (Basement)",
    "Residential Multi-Family",
    "Residential Single-Family",
    "Education Elementary",
    "Education High School",
    "Education University",
  ],
  suspectedGeography: "The same 20 cities as the first table (18 US cities + Calgary + Toronto), unconfirmed for this second table specifically.",
  ambiguity:
    'The table\'s column headers extracted across multiple overlapping physical PDF lines in a linear text-layer extraction ("INDUSTRIAL WAREHOUSE", "PARKING GROUND BASEMENT", "RESIDENTIAL MULTI-FAMILY SINGLE-FAMILY", "EDUCATION ELEMENTARY HIGH SCHOOL UNIVERSITY" span five garbled header lines) — there is no independently-verified baseline (no prior E68 figure for any of these categories) to cross-check the column-to-category assignment against, unlike the first table\'s office/retail/hotel/hospital columns.',
  evidenceAlreadyGathered: [
    "Phase 3: re-fetched the report and ran `pdftotext -layout`, confirming the second table's existence and its garbled header layout.",
    "Phase 3: cross-validated the FIRST table's extraction (not this second one) against E68's existing Austin/Miami/Seattle/Phoenix figures, all matching exactly — establishing the extraction METHOD's reliability in general, but not this specific table's column assignment.",
    "Phase 6: re-reviewed all existing project documentation (Phase 3 doc Section 2.4, taxonomy.ts inline note, source-research.ts) for any new evidence; found none beyond what Phase 3 already recorded.",
  ],
  evidenceNeededToResolve: [
    "Direct visual review of the actual PDF page layout (not a linear text-layer dump) to confirm which column header corresponds to which data column.",
    "A second independent extraction pass (e.g. table-region-aware OCR or a structured PDF-table parser) that agrees with a manual reading of the page.",
    "Ideally, a cross-reference against a DIFFERENT RLB regional summary page (as Phase 1/E68 already did for the city cost-index table) that independently states at least one of these category's figures for at least one city, to serve as the missing known-good baseline.",
  ],
  reasonIngestionIsBlocked:
    "Per the governing principle carried through every E70 phase (REAL > TRACEABLE > GRANULAR > CURRENT > COMPLETE): a plausible-looking number is not evidence. Ingesting this table without independent verification would mean trusting a column assignment across five garbled header lines with zero cross-check — exactly the failure mode E68's own Phase 4C audit correction (a wrong Seattle percentage, a wrong publication date) already demonstrated is possible with this exact report and extraction method. Multifamily and industrial remain classified UNSUPPORTED in taxonomy.ts, unchanged.",
  history: [
    { phase: "Phase 3", date: "2026-09-11", note: "Second table discovered on re-fetch; flagged, not ingested; documented in Phase 3 doc Section 2.4 and taxonomy.ts." },
    { phase: "Phase 6", date: "2026-09-12", note: "Re-reviewed existing project evidence for new information; none found. Formalized as this typed record. Status unchanged: UNVERIFIED." },
  ],
};

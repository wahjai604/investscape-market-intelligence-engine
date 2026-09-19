/**
 * InvestScape™ E85 Phase 15.4 — synthetic two-version temporal fixture,
 * Slice 2.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Wholly synthetic: no Vancouver, Burnaby, R1-1, or C-2C identity. Used
 * only to exercise `selectE85TemporalCandidate` (temporal-selection.ts) in
 * isolation from rule-pack composition, evaluators, spatial applicability,
 * legal linkage, and decision packages.
 */
import type { E85TemporalCandidate } from "../../../src/zoning-land-use-engine/temporal-selection";

/** Neutral synthetic jurisdiction/district identifiers for test labelling only — the selector itself never inspects these. */
export const TEMPORAL_FIXTURE_JURISDICTION_ID = "TEST-JX";
export const TEMPORAL_FIXTURE_ZONE_DESIGNATION = "TEST-Z1";

/** First version: in force 2020-01-01 through 2020-12-31 (inclusive), then superseded. */
export const TEMPORAL_FIXTURE_VERSION_1: E85TemporalCandidate = {
  candidateId: "TEST-JX/TEST-Z1/v1",
  temporal: { effectiveFrom: "2020-01-01", effectiveTo: "2020-12-31", effectiveDateBasis: "AMENDMENT_DATE_KNOWN" },
};

/**
 * Second version: in force 2021-06-01 through 2021-12-31 (inclusive). A
 * deliberate gap exists between Version 1's effectiveTo (2020-12-31) and
 * Version 2's effectiveFrom (2021-06-01).
 */
export const TEMPORAL_FIXTURE_VERSION_2: E85TemporalCandidate = {
  candidateId: "TEST-JX/TEST-Z1/v2",
  temporal: { effectiveFrom: "2021-06-01", effectiveTo: "2021-12-31", effectiveDateBasis: "AMENDMENT_DATE_KNOWN" },
};

export const TEMPORAL_FIXTURE_TWO_VERSIONS: readonly E85TemporalCandidate[] = [
  TEMPORAL_FIXTURE_VERSION_1,
  TEMPORAL_FIXTURE_VERSION_2,
];

/** A date strictly between Version 1's effectiveTo and Version 2's effectiveFrom — inside the deliberate gap. */
export const TEMPORAL_FIXTURE_GAP_DATE = "2021-03-15";

/** A date strictly before Version 1's effectiveFrom. */
export const TEMPORAL_FIXTURE_BEFORE_ALL_DATE = "2019-06-01";

/** A date strictly after Version 2's effectiveTo, with both versions closed. */
export const TEMPORAL_FIXTURE_AFTER_ALL_DATE = "2022-03-01";

/** Candidate with unknown temporal authority — no effectiveFrom, basis UNKNOWN. */
export const TEMPORAL_FIXTURE_UNKNOWN_CANDIDATE: E85TemporalCandidate = {
  candidateId: "TEST-JX/TEST-Z1/unknown",
  temporal: { effectiveDateBasis: "UNKNOWN" },
};

/**
 * Two candidates whose validity intervals overlap each other (both cover
 * 2023-07-15), used to exercise CONFLICTING_TEMPORAL_EVIDENCE.
 */
export const TEMPORAL_FIXTURE_OVERLAPPING_A: E85TemporalCandidate = {
  candidateId: "TEST-JX/TEST-Z1/overlap-a",
  temporal: { effectiveFrom: "2023-01-01", effectiveTo: "2023-12-31", effectiveDateBasis: "AMENDMENT_DATE_KNOWN" },
};
export const TEMPORAL_FIXTURE_OVERLAPPING_B: E85TemporalCandidate = {
  candidateId: "TEST-JX/TEST-Z1/overlap-b",
  temporal: { effectiveFrom: "2023-06-01", effectiveTo: "2024-05-31", effectiveDateBasis: "AMENDMENT_DATE_KNOWN" },
};
export const TEMPORAL_FIXTURE_OVERLAP_DATE = "2023-07-15";
export const TEMPORAL_FIXTURE_OVERLAPPING_CANDIDATES: readonly E85TemporalCandidate[] = [
  TEMPORAL_FIXTURE_OVERLAPPING_A,
  TEMPORAL_FIXTURE_OVERLAPPING_B,
];

/** A single candidate that is still open (no effectiveTo) — future-effective-only when queried before its start. */
export const TEMPORAL_FIXTURE_FUTURE_EFFECTIVE_ONLY: E85TemporalCandidate = {
  candidateId: "TEST-JX/TEST-Z1/future-only",
  temporal: { effectiveFrom: "2030-01-01", effectiveDateBasis: "AMENDMENT_DATE_KNOWN" },
};
export const TEMPORAL_FIXTURE_FUTURE_EFFECTIVE_QUERY_DATE = "2029-01-01";

/** A single closed candidate — closed/superseded-only when queried after its end. */
export const TEMPORAL_FIXTURE_SUPERSEDED_ONLY: E85TemporalCandidate = {
  candidateId: "TEST-JX/TEST-Z1/superseded-only",
  temporal: { effectiveFrom: "2010-01-01", effectiveTo: "2010-12-31", effectiveDateBasis: "AMENDMENT_DATE_KNOWN" },
};
export const TEMPORAL_FIXTURE_SUPERSEDED_QUERY_DATE = "2011-01-01";

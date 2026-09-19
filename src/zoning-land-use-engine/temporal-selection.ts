/**
 * InvestScape™ E85 Phase 15.4 — Temporal Selection Contract, Slice 2.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Additive only. This module introduces a pure, jurisdiction-neutral
 * temporal candidate selector (`selectE85TemporalCandidate`) that consumes
 * the Slice 1 `E85ResolvedTemporalRequest` contract (temporal-request-
 * types.ts) and a readonly collection of temporal candidates, each carrying
 * the existing `E85TemporalWindow` (evidence-types.ts). Nothing here is
 * wired into rule-pack composition, evaluators, spatial applicability,
 * Vancouver legal linkage, decision packages, or status/materiality
 * orchestration — that wiring is explicitly out of scope for Slice 2.
 *
 * Design carried over unchanged from Slice 1 and applicability.ts: no
 * machine clock is read anywhere in this file. "CURRENT" is never resolved
 * to a concrete date here — Slice 2 reports that current-authority
 * resolution requires a future explicit resolver/evidence contract, and
 * selects nothing. Month/year precision inference is explicitly deferred;
 * a candidate whose dates are not canonical day-precision (YYYY-MM-DD) is
 * classified as insufficient temporal evidence rather than guessed at.
 */
import type { E85ResolvedTemporalRequest } from "./temporal-request-types";
import { isValidE85AsOfDate } from "./temporal-request-types";
import type { E85TemporalWindow } from "./evidence-types";

/**
 * The smallest generic shape needed to select among temporally distinct
 * versions of something. Deliberately carries no jurisdiction, rule-pack,
 * spatial geometry, or legal-outcome fields — only a deterministic identity
 * and the existing `E85TemporalWindow` temporal grounding.
 */
export interface E85TemporalCandidate {
  readonly candidateId: string;
  readonly temporal: E85TemporalWindow;
}

/**
 * Honest result vocabulary for temporal candidate selection. These are
 * selection-stage outcomes, not terminal legal/decision statuses — no
 * evaluator, composer, or decision-package status is implied or produced
 * here.
 */
export type E85TemporalSelectionKind =
  | "SELECTED"
  | "TEMPORALLY_AMBIGUOUS"
  | "INSUFFICIENT_TEMPORAL_EVIDENCE"
  | "CONFLICTING_TEMPORAL_EVIDENCE"
  | "OUTSIDE_VALIDITY_INTERVAL"
  | "FUTURE_EFFECTIVE"
  | "SUPERSEDED";

/**
 * Deterministic, auditable outcome of `selectE85TemporalCandidate`.
 * `candidateIdsConsidered` is always sorted, independent of input order.
 * `selectedCandidateId` is present only when `kind` is "SELECTED" — exactly
 * one candidate was supportably selected. Never carries a wall-clock
 * timestamp (`flaggedAt`, `checkedAt`, or similar).
 */
export interface E85TemporalSelectionResult {
  readonly kind: E85TemporalSelectionKind;
  readonly candidateIdsConsidered: readonly string[];
  readonly selectedCandidateId?: string;
  readonly reasons: readonly string[];
}

/**
 * Deterministic, reproducible error raised when the candidate collection
 * itself is structurally invalid — a duplicate `candidateId`, or a
 * candidate whose `effectiveFrom` is after its `effectiveTo`. This is a
 * malformed-input rejection at the boundary (consistent with Slice 1's
 * `E85TemporalRequestError`), not an ordinary temporal non-selection
 * outcome, so it is thrown rather than returned as a result kind.
 */
export class E85TemporalSelectionError extends Error {
  constructor(message: string) {
    super(`E85 temporal selection error: ${message}`);
    this.name = "E85TemporalSelectionError";
  }
}

function hasCanonicalDayPrecision(window: E85TemporalWindow): boolean {
  if (window.effectiveDateBasis === "UNKNOWN") return false;
  if (window.effectiveFrom === undefined) return false;
  if (!isValidE85AsOfDate(window.effectiveFrom)) return false;
  if (window.effectiveTo !== undefined && !isValidE85AsOfDate(window.effectiveTo)) return false;
  return true;
}

function assertStructurallyValidCandidates(candidates: readonly E85TemporalCandidate[]): void {
  const seenIds = new Set<string>();
  for (const candidate of candidates) {
    if (seenIds.has(candidate.candidateId)) {
      throw new E85TemporalSelectionError(`duplicate candidateId "${candidate.candidateId}".`);
    }
    seenIds.add(candidate.candidateId);

    const { effectiveFrom, effectiveTo } = candidate.temporal;
    if (
      effectiveFrom !== undefined &&
      effectiveTo !== undefined &&
      isValidE85AsOfDate(effectiveFrom) &&
      isValidE85AsOfDate(effectiveTo) &&
      effectiveFrom > effectiveTo
    ) {
      throw new E85TemporalSelectionError(
        `candidate "${candidate.candidateId}" has effectiveFrom "${effectiveFrom}" after effectiveTo "${effectiveTo}".`,
      );
    }
  }
}

function sortedIds(candidates: readonly E85TemporalCandidate[]): readonly string[] {
  return candidates.map((c) => c.candidateId).slice().sort();
}

function overlaps(window: E85TemporalWindow, asOfDate: string): boolean {
  const from = window.effectiveFrom as string;
  if (asOfDate < from) return false;
  if (window.effectiveTo !== undefined && asOfDate > window.effectiveTo) return false;
  return true;
}

/**
 * Selects among temporally distinct candidates for a resolved temporal
 * request. Pure and deterministic: given the same two inputs, always
 * returns a deeply-equal result or throws the same
 * `E85TemporalSelectionError`. Never reads `Date.now()` or constructs
 * `new Date()`. Neither `resolved` nor `candidates` (nor any candidate
 * object) is mutated.
 */
export function selectE85TemporalCandidate(
  resolved: E85ResolvedTemporalRequest,
  candidates: readonly E85TemporalCandidate[],
): E85TemporalSelectionResult {
  assertStructurallyValidCandidates(candidates);
  const candidateIdsConsidered = sortedIds(candidates);

  if (resolved.kind === "ABSENT") {
    return {
      kind: "INSUFFICIENT_TEMPORAL_EVIDENCE",
      candidateIdsConsidered,
      reasons: ["no temporal request was supplied (ABSENT); selection requires an explicit CURRENT or AS_OF request."],
    };
  }

  if (resolved.request.mode === "CURRENT") {
    return {
      kind: "INSUFFICIENT_TEMPORAL_EVIDENCE",
      candidateIdsConsidered,
      reasons: [
        "temporal request mode is CURRENT; Slice 2 does not resolve current authority against the machine clock or any other implicit source.",
        "resolving CURRENT to a concrete as-of date requires a future explicit resolver/evidence contract, not yet introduced.",
      ],
    };
  }

  const asOfDate = resolved.request.asOfDate;

  const known: { candidate: E85TemporalCandidate; window: E85TemporalWindow }[] = [];
  const unknown: E85TemporalCandidate[] = [];
  for (const candidate of candidates) {
    if (hasCanonicalDayPrecision(candidate.temporal)) {
      known.push({ candidate, window: candidate.temporal });
    } else {
      unknown.push(candidate);
    }
  }

  const knownOverlapping = known.filter(({ window }) => overlaps(window, asOfDate));

  if (knownOverlapping.length > 1) {
    return {
      kind: "CONFLICTING_TEMPORAL_EVIDENCE",
      candidateIdsConsidered,
      reasons: [
        `${knownOverlapping.length} candidates with known validity intervals all cover "${asOfDate}": ` +
          knownOverlapping
            .map((k) => k.candidate.candidateId)
            .slice()
            .sort()
            .join(", ") +
          ".",
      ],
    };
  }

  if (knownOverlapping.length === 1) {
    const selected = knownOverlapping[0].candidate;
    if (unknown.length > 0) {
      return {
        kind: "TEMPORALLY_AMBIGUOUS",
        candidateIdsConsidered,
        reasons: [
          `candidate "${selected.candidateId}" is the only candidate with a known validity interval covering "${asOfDate}", ` +
            `but ${unknown.length} candidate(s) with insufficient temporal authority could also overlap: ` +
            unknown
              .map((c) => c.candidateId)
              .slice()
              .sort()
              .join(", ") +
            ".",
        ],
      };
    }
    return {
      kind: "SELECTED",
      candidateIdsConsidered,
      selectedCandidateId: selected.candidateId,
      reasons: [`candidate "${selected.candidateId}" is the only candidate whose validity interval covers "${asOfDate}".`],
    };
  }

  // No known candidate overlaps asOfDate.
  if (unknown.length > 0 && known.length === 0) {
    return {
      kind: "INSUFFICIENT_TEMPORAL_EVIDENCE",
      candidateIdsConsidered,
      reasons: [
        `no candidate has a canonical, comparable validity interval; ${unknown.length} candidate(s) carry insufficient temporal authority: ` +
          unknown
            .map((c) => c.candidateId)
            .slice()
            .sort()
            .join(", ") +
          ".",
      ],
    };
  }

  if (unknown.length > 0) {
    return {
      kind: "INSUFFICIENT_TEMPORAL_EVIDENCE",
      candidateIdsConsidered,
      reasons: [
        `no known candidate's validity interval covers "${asOfDate}", and ${unknown.length} candidate(s) with insufficient temporal authority could not be ruled out: ` +
          unknown
            .map((c) => c.candidateId)
            .slice()
            .sort()
            .join(", ") +
          ".",
      ],
    };
  }

  if (known.length === 0) {
    return {
      kind: "INSUFFICIENT_TEMPORAL_EVIDENCE",
      candidateIdsConsidered,
      reasons: ["no candidates were supplied."],
    };
  }

  const earliestFrom = known.reduce(
    (min, k) => (min === undefined || (k.window.effectiveFrom as string) < min ? (k.window.effectiveFrom as string) : min),
    undefined as string | undefined,
  ) as string;

  if (asOfDate < earliestFrom) {
    return {
      kind: "FUTURE_EFFECTIVE",
      candidateIdsConsidered,
      reasons: [`"${asOfDate}" is before the earliest known effectiveFrom ("${earliestFrom}") among all candidates.`],
    };
  }

  const allClosed = known.every((k) => k.window.effectiveTo !== undefined);
  if (allClosed) {
    const latestTo = known.reduce(
      (max, k) => (max === undefined || (k.window.effectiveTo as string) > max ? (k.window.effectiveTo as string) : max),
      undefined as string | undefined,
    ) as string;
    if (asOfDate > latestTo) {
      return {
        kind: "SUPERSEDED",
        candidateIdsConsidered,
        reasons: [`"${asOfDate}" is after the latest known effectiveTo ("${latestTo}") among all closed candidates.`],
      };
    }
  }

  return {
    kind: "OUTSIDE_VALIDITY_INTERVAL",
    candidateIdsConsidered,
    reasons: [`"${asOfDate}" falls in a gap between known candidate validity intervals.`],
  };
}

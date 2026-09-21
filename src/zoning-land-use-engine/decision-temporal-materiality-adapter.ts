/**
 * InvestScape™ E85 Phase 15.18A — Temporal Decision-Materiality Adapter, Slice 3F-2.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Additive only. This module is the smallest pure boundary between Slice 3E's
 * `E85TemporalDecisionImpact[]` (temporal-decision-impact.ts) and one or more
 * `E85DecisionMaterialityRecord` values (decision-package-types.ts) suitable
 * for inclusion in an `E85DecisionPackage`.
 *
 * SCOPE. This module does NOT invoke the temporal selector, the lineage
 * grouper, or the Slice 3E mapper — it consumes only their already-computed
 * output, by reference, unmodified. It does NOT read a clock, infer a
 * source-version relationship, resolve spatial applicability, or apply a
 * selected source version to rule-pack evaluation. It does NOT claim that a
 * `SELECTED` outcome means the selected source version controlled evaluation,
 * that a parcel's historical zoning designation is proven, or that legal text
 * and parcel designation were temporally aligned — every branch below,
 * including the one reached from `AS_OF_SELECTED`, produces a record that
 * says only what the existing, frozen pipeline actually established.
 *
 * ONE RECORD PER IMPACT. Every entry in `impacts` produces exactly one
 * `E85DecisionMaterialityRecord` — never zero (an `AS_OF_SELECTED` outcome
 * still produces the `TEMPORAL_CANDIDATE_SELECTED_NOT_APPLIED` caveat, so a
 * caller can never mistake "a candidate was identified" for "the candidate's
 * rule text was applied") and never more than one (no duplicate records for
 * one lineage outcome).
 *
 * Design carried over unchanged from Slices 1-3F-1: no machine clock, no
 * randomness, no I/O, no mutation of caller-supplied values anywhere in this
 * file.
 */
import type { E85DecisionMaterialityRecord } from "./decision-package-types";
import type { E85TemporalDecisionImpact, E85TemporalImpactKind } from "./temporal-decision-impact";

/**
 * Deterministic, reproducible error raised for malformed input at this
 * module's own boundary only — never for a legitimate evidentiary outcome
 * (those are always mapped to a typed materiality record, never an
 * exception).
 */
export class E85TemporalDecisionMaterialityAdapterError extends Error {
  constructor(message: string) {
    super(`E85 temporal decision materiality adapter error: ${message}`);
    this.name = "E85TemporalDecisionMaterialityAdapterError";
  }
}

/**
 * The manual-review reason code used for `AS_OF_CONFLICTING_EVIDENCE`. Two or
 * more supplied source-version candidates in one lineage are each credibly
 * applicable to the requested date and no basis exists to prefer one — this
 * is the same "two authoritative-shaped claims, plausible either way" shape
 * `CONFLICTING_AUTHORITATIVE_SOURCES` already names (manual-review-types.ts);
 * no new manual-review reason code is introduced by this slice.
 */
const CONFLICTING_TEMPORAL_EVIDENCE_MANUAL_REVIEW_REASON = "CONFLICTING_AUTHORITATIVE_SOURCES" as const;

/** Deterministic sourceRef per §17: `TEMPORAL_LINEAGE:<lineageId>:<impactKind>:<mode>[:<asOfDate>]`. */
function buildSourceRef(impact: E85TemporalDecisionImpact): string {
  const dateSuffix = impact.requestMode === "AS_OF" ? `:${impact.asOfDate}` : "";
  return `TEMPORAL_LINEAGE:${impact.lineageId}:${impact.impactKind}:${impact.requestMode}${dateSuffix}`;
}

function requestDescription(impact: E85TemporalDecisionImpact): string {
  return impact.requestMode === "AS_OF" ? `AS_OF "${impact.asOfDate}"` : "CURRENT";
}

/**
 * Builds one GAP-kind materiality record. Shared by every branch below
 * except the manual-review branch.
 */
function buildGapRecord(
  impact: E85TemporalDecisionImpact,
  reasonCode:
    | "TEMPORAL_CURRENT_REFERENCE_UNAVAILABLE"
    | "TEMPORAL_LINEAGE_NOT_READY"
    | "TEMPORAL_CANDIDATE_SELECTED_NOT_APPLIED"
    | "TEMPORAL_CANDIDATE_AMBIGUOUS"
    | "TEMPORAL_CANDIDATE_INSUFFICIENT_EVIDENCE"
    | "TEMPORAL_CANDIDATE_OUTSIDE_VALIDITY"
    | "TEMPORAL_CANDIDATE_FUTURE_EFFECTIVE"
    | "TEMPORAL_CANDIDATE_SUPERSEDED",
  detail: string,
  assessedAt: string,
): E85DecisionMaterialityRecord {
  const sourceRef = buildSourceRef(impact);
  return {
    sourceRef,
    sourcePhase: "TEMPORAL_REQUEST",
    sourceCode: reasonCode,
    kind: "GAP",
    materiality: "MATERIAL",
    reason: detail,
    gap: {
      reasonCode,
      reason: detail,
      sourcesChecked: [],
      checkedAt: assessedAt,
    },
  };
}

/** Builds the one MANUAL_REVIEW-kind materiality record this adapter ever produces. */
function buildManualReviewRecord(impact: E85TemporalDecisionImpact, assessedAt: string): E85DecisionMaterialityRecord {
  const sourceRef = buildSourceRef(impact);
  const detail = `Lineage "${impact.lineageId}": two or more supplied source-version candidates were each credibly applicable to the requested ${requestDescription(impact)}, and no basis exists to prefer one. This concerns SOURCE-VERSION selection only — it makes no claim about rule-pack evaluation, which has not applied any selected version.`;
  return {
    sourceRef,
    sourcePhase: "TEMPORAL_REQUEST",
    sourceCode: "AS_OF_CONFLICTING_EVIDENCE",
    kind: "MANUAL_REVIEW",
    materiality: "MATERIAL",
    reason: detail,
    manualReview: {
      reasonCode: CONFLICTING_TEMPORAL_EVIDENCE_MANUAL_REVIEW_REASON,
      explanation: detail,
      evidenceConsidered: [],
      flaggedAt: assessedAt,
    },
  };
}

/**
 * Maps exactly one `E85TemporalDecisionImpact` onto exactly one
 * `E85DecisionMaterialityRecord`. Exhaustive over the closed
 * `E85TemporalImpactKind` vocabulary — an unsupported kind falls through the
 * `never` branch and throws, a defensive backstop against a future addition
 * to that upstream union, not a reachable path today.
 */
function mapOneImpact(impact: E85TemporalDecisionImpact, assessedAt: string): E85DecisionMaterialityRecord {
  const kind: E85TemporalImpactKind = impact.impactKind;
  switch (kind) {
    case "CURRENT_REFERENCE_BASIS_UNAVAILABLE":
      return buildGapRecord(
        impact,
        "TEMPORAL_CURRENT_REFERENCE_UNAVAILABLE",
        `Lineage "${impact.lineageId}": a CURRENT temporal request was evaluated against supplied lineage evidence, but E85 has no trusted present-day reference basis (no clock is read), so no candidate could be treated as currently in force.`,
        assessedAt,
      );
    case "CURRENT_LINEAGE_BLOCKED":
    case "CURRENT_LINEAGE_EVIDENCE_INCOMPLETE":
    case "CURRENT_LINEAGE_NO_CANDIDATE":
    case "AS_OF_LINEAGE_BLOCKED":
    case "AS_OF_LINEAGE_EVIDENCE_INCOMPLETE":
    case "AS_OF_LINEAGE_NO_CANDIDATE":
      return buildGapRecord(
        impact,
        "TEMPORAL_LINEAGE_NOT_READY",
        `Lineage "${impact.lineageId}" was not structurally ready for source-version selection (${kind}), so no source-version candidate could be considered for the requested ${requestDescription(impact)}.`,
        assessedAt,
      );
    case "AS_OF_SELECTED":
      return buildGapRecord(
        impact,
        "TEMPORAL_CANDIDATE_SELECTED_NOT_APPLIED",
        `Lineage "${impact.lineageId}": a source-version candidate was identified as applicable to the requested ${requestDescription(impact)}. This means ONLY that a candidate was identified within the supplied evidence — the selected version was NOT applied to rule-pack evaluation, no historical parcel zoning designation was proven, and no spatial-temporal alignment was established.`,
        assessedAt,
      );
    case "AS_OF_TEMPORALLY_AMBIGUOUS":
      return buildGapRecord(
        impact,
        "TEMPORAL_CANDIDATE_AMBIGUOUS",
        `Lineage "${impact.lineageId}": more than one supplied source-version candidate was applicable to the requested ${requestDescription(impact)} and no basis exists to prefer one.`,
        assessedAt,
      );
    case "AS_OF_INSUFFICIENT_EVIDENCE":
      return buildGapRecord(
        impact,
        "TEMPORAL_CANDIDATE_INSUFFICIENT_EVIDENCE",
        `Lineage "${impact.lineageId}": no supplied source-version candidate was applicable to the requested ${requestDescription(impact)}.`,
        assessedAt,
      );
    case "AS_OF_CONFLICTING_EVIDENCE":
      return buildManualReviewRecord(impact, assessedAt);
    case "AS_OF_OUTSIDE_VALIDITY_INTERVAL":
      return buildGapRecord(
        impact,
        "TEMPORAL_CANDIDATE_OUTSIDE_VALIDITY",
        `Lineage "${impact.lineageId}": the requested ${requestDescription(impact)} falls outside every supplied candidate's proven validity interval.`,
        assessedAt,
      );
    case "AS_OF_FUTURE_EFFECTIVE":
      return buildGapRecord(
        impact,
        "TEMPORAL_CANDIDATE_FUTURE_EFFECTIVE",
        `Lineage "${impact.lineageId}": the applicable supplied candidate does not yet take effect as of the requested ${requestDescription(impact)}.`,
        assessedAt,
      );
    case "AS_OF_SUPERSEDED":
      return buildGapRecord(
        impact,
        "TEMPORAL_CANDIDATE_SUPERSEDED",
        `Lineage "${impact.lineageId}": the applicable supplied candidate had already been superseded as of the requested ${requestDescription(impact)}.`,
        assessedAt,
      );
    default: {
      const exhaustive: never = kind;
      throw new E85TemporalDecisionMaterialityAdapterError(`unsupported impactKind, got ${JSON.stringify(exhaustive)}.`);
    }
  }
}

/**
 * Converts a Slice 3E `E85TemporalDecisionImpact[]` into deterministic,
 * per-lineage `E85DecisionMaterialityRecord[]` for inclusion in an
 * `E85DecisionPackage`. Pure and deterministic: the same two inputs always
 * yield a deeply-equal result, or the same thrown
 * `E85TemporalDecisionMaterialityAdapterError`. `assessedAt` is caller-
 * supplied (never a fresh clock read) and used only for each record's
 * `gap.checkedAt` / `manualReview.flaggedAt`.
 *
 * Ordering: one record per `impacts` entry, in `impacts`'s own existing
 * deterministic order (lineageId-ascending, inherited unbroken from Slice
 * 3D-1's grouping order through 3D-3 and 3E) — this function never re-sorts.
 * The caller (decision-orchestrator.ts) merges this array into the package's
 * `materiality` and re-sorts the COMBINED array via the same
 * `byE85DecisionKey`-based comparator already used for every other
 * materiality record, so the final package never depends on this function's
 * internal ordering alone.
 */
export function buildE85TemporalLineageMaterialityRecords(
  impacts: readonly E85TemporalDecisionImpact[],
  assessedAt: string,
): readonly E85DecisionMaterialityRecord[] {
  if (!Array.isArray(impacts)) {
    throw new E85TemporalDecisionMaterialityAdapterError(`impacts must be an array, got ${JSON.stringify(impacts)}.`);
  }
  if (typeof assessedAt !== "string" || assessedAt.trim().length === 0) {
    throw new E85TemporalDecisionMaterialityAdapterError(`assessedAt must be a non-empty string, got ${JSON.stringify(assessedAt)}.`);
  }
  return impacts.map((impact) => mapOneImpact(impact, assessedAt));
}

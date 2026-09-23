/**
 * InvestScape™ E85 — Designation/Legal-Text Temporal Coincidence Evaluator.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Additive only. This module answers exactly one question: "given (1) an
 * already-computed `E85DesignationApplicabilityResult`
 * (designation-applicability.ts, Slice 3G-2), (2) an already-computed
 * `E85LegalTextApplicabilityResult` (legal-text-applicability.ts), and (3) a
 * caller-asserted `asOf` date, do the two supplied applicability OUTCOMES
 * indicate co-incidence — i.e. do both sides report a positive-coverage
 * outcome — at that date?" It is a pure, deterministic composition evaluator
 * over the two upstream RESULT types only — nothing more.
 *
 * SCOPE. This module does NOT: recompute applicability; inspect raw validity
 * intervals (`E85DesignationValidity`/`E85VersionValidity` are never
 * imported here — only the two *Result* types); calculate interval overlap,
 * containment, or historical continuity; consult a rule pack; compute
 * materiality, gaps, blockers, or any DATA_GAP/MANUAL_REVIEW_REQUIRED
 * vocabulary; establish legal effect, enactment, property-specific
 * applicability, or a final zoning/planning determination; or reference
 * identity correspondence in any way — Slice 3H-1's
 * `evaluateE85DesignationLegalTextIdentityCorrespondence`
 * (designation-legal-text-identity-correspondence.ts) is orthogonal
 * (identity, not temporal matters) and is neither imported nor required by
 * this module.
 *
 * TRUST BOUNDARY: CALLER-ASSERTED `asOf`. This module receives an explicit
 * `asOf: string` third argument and ASSUMES — but cannot verify — that both
 * supplied applicability results were themselves computed against that same
 * date. Neither `E85DesignationApplicabilityResult` nor
 * `E85LegalTextApplicabilityResult` carries a date field on every variant
 * (roughly half the variants on each side carry no date at all), so this
 * module cannot and does not attempt any date-consistency check: it never
 * reads or compares an embedded `asOfDate`/`effectiveFrom`/`effectiveTo`
 * field on either input for that purpose, and it never calls `Date.now()` or
 * `new Date()`. The caller is solely responsible for ensuring both results
 * were computed for the same `asOf` date before calling this evaluator. This
 * is documented, not enforced — see each result variant's `.limitation`
 * text (where present) and `POSITIVE_COINCIDENCE_LIMITATION` below, which
 * states this trust boundary explicitly.
 *
 * CO-INCIDENCE, NOT ALIGNMENT OR IDENTITY. "Co-incidence" here means only
 * that both supplied outcomes are positive-coverage outcomes. It says
 * nothing about whether the designation and the legal text refer to the same
 * parcel, jurisdiction, zone, or legal instrument (that is Slice 3H-1's
 * question, not this module's), and nothing about legal effect, enactment,
 * or a final determination — see `POSITIVE_COINCIDENCE_LIMITATION`.
 *
 * OUTCOME PRESERVATION. Every outcome variant of this module carries BOTH
 * source `.kind` values (`designationResultKind` and `legalTextResultKind`)
 * by reference, unchanged. No outcome ever collapses to a boolean, and no
 * indeterminate/passthrough outcome ever loses which specific source kind(s)
 * triggered it.
 *
 * No machine clock is read anywhere in this file. No range overlap,
 * containment, or historical continuity is computed anywhere. No file in
 * this module is mutated, and none of its inputs are mutated.
 */
import type { E85DesignationApplicabilityResult } from "./designation-applicability";
import type { E85LegalTextApplicabilityResult } from "./legal-text-applicability";

const ALL_DESIGNATION_RESULT_KINDS: readonly E85DesignationApplicabilityResult["kind"][] = [
  "DESIGNATION_APPLICABILITY_NOT_EVALUABLE",
  "DESIGNATION_NO_START_EVIDENCE",
  "DESIGNATION_START_CONFLICT",
  "DESIGNATION_OBSERVATION_ONLY_NOT_LEGALLY_DATED",
  "DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END",
  "DESIGNATION_NOT_YET_STARTED",
  "DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL",
  "DESIGNATION_OUTSIDE_CLOSED_INTERVAL",
  "DESIGNATION_END_CONFLICT",
];

const ALL_LEGAL_TEXT_RESULT_KINDS: readonly E85LegalTextApplicabilityResult["kind"][] = [
  "LEGAL_TEXT_APPLICABILITY_NOT_EVALUABLE",
  "LEGAL_TEXT_NO_START_EVIDENCE",
  "LEGAL_TEXT_START_CONFLICT",
  "LEGAL_TEXT_NOT_YET_STARTED",
  "LEGAL_TEXT_POSSIBLY_APPLICABLE_OPEN_END",
  "LEGAL_TEXT_APPLICABLE_WITHIN_CLOSED_INTERVAL",
  "LEGAL_TEXT_OUTSIDE_CLOSED_INTERVAL",
  "LEGAL_TEXT_END_CONFLICT",
  "LEGAL_TEXT_PARTIAL_TERMINATION_INDETERMINATE",
];

/**
 * Per-side classification vocabulary used only internally by this module to
 * drive the outcome-combination logic below. Not exported, not part of the
 * public result type.
 *
 *   - NOT_EVALUABLE: the side's own request-mode passthrough kind.
 *   - INDETERMINATE: the side reports an indeterminate/conflicted/
 *     not-legally-dated kind.
 *   - POSITIVE_CLOSED: the side's closed, within-interval positive-coverage
 *     kind.
 *   - POSITIVE_OPEN_END: the side's hedged, open-end positive-coverage kind.
 *   - DETERMINATE_NOT_APPLICABLE: the side reports a determinate,
 *     dated-but-non-positive kind (not yet started / outside closed
 *     interval).
 */
type E85TemporalCoincidenceSideClassification =
  | "NOT_EVALUABLE"
  | "INDETERMINATE"
  | "POSITIVE_CLOSED"
  | "POSITIVE_OPEN_END"
  | "DETERMINATE_NOT_APPLICABLE";

/**
 * Exhaustively classifies a `E85DesignationApplicabilityResult["kind"]` for
 * coincidence-combination purposes. Every one of the 9 designation result
 * kinds is named in its own case (never grouped via array membership), with
 * a compile-time `never`-typed exhaustiveness check as the `default` branch
 * — mirroring the `assertNever`/`const exhaustive: never = x` pattern
 * already used by `evaluateE85DesignationApplicability`
 * (designation-applicability.ts) and `evaluateE85LegalTextApplicability`
 * (legal-text-applicability.ts). If `E85DesignationApplicabilityResult` ever
 * gains a new variant, this function fails to compile until a new case is
 * added for it.
 */
function classifyDesignationKind(
  kind: E85DesignationApplicabilityResult["kind"],
): E85TemporalCoincidenceSideClassification {
  switch (kind) {
    case "DESIGNATION_APPLICABILITY_NOT_EVALUABLE":
      return "NOT_EVALUABLE";
    case "DESIGNATION_NO_START_EVIDENCE":
      return "INDETERMINATE";
    case "DESIGNATION_START_CONFLICT":
      return "INDETERMINATE";
    case "DESIGNATION_OBSERVATION_ONLY_NOT_LEGALLY_DATED":
      return "INDETERMINATE";
    case "DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END":
      return "POSITIVE_OPEN_END";
    case "DESIGNATION_NOT_YET_STARTED":
      return "DETERMINATE_NOT_APPLICABLE";
    case "DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL":
      return "POSITIVE_CLOSED";
    case "DESIGNATION_OUTSIDE_CLOSED_INTERVAL":
      return "DETERMINATE_NOT_APPLICABLE";
    case "DESIGNATION_END_CONFLICT":
      return "INDETERMINATE";
    default: {
      const exhaustive: never = kind;
      throw new E85DesignationLegalTextTemporalCoincidenceError(`unsupported designation result kind, got ${JSON.stringify(exhaustive)}.`);
    }
  }
}

/**
 * Exhaustively classifies a `E85LegalTextApplicabilityResult["kind"]` for
 * coincidence-combination purposes. Every one of the 9 legal-text result
 * kinds is named in its own case (never grouped via array membership), with
 * a compile-time `never`-typed exhaustiveness check as the `default` branch
 * — mirroring the same pattern used by `classifyDesignationKind` above. If
 * `E85LegalTextApplicabilityResult` ever gains a new variant, this function
 * fails to compile until a new case is added for it.
 */
function classifyLegalTextKind(
  kind: E85LegalTextApplicabilityResult["kind"],
): E85TemporalCoincidenceSideClassification {
  switch (kind) {
    case "LEGAL_TEXT_APPLICABILITY_NOT_EVALUABLE":
      return "NOT_EVALUABLE";
    case "LEGAL_TEXT_NO_START_EVIDENCE":
      return "INDETERMINATE";
    case "LEGAL_TEXT_START_CONFLICT":
      return "INDETERMINATE";
    case "LEGAL_TEXT_NOT_YET_STARTED":
      return "DETERMINATE_NOT_APPLICABLE";
    case "LEGAL_TEXT_POSSIBLY_APPLICABLE_OPEN_END":
      return "POSITIVE_OPEN_END";
    case "LEGAL_TEXT_APPLICABLE_WITHIN_CLOSED_INTERVAL":
      return "POSITIVE_CLOSED";
    case "LEGAL_TEXT_OUTSIDE_CLOSED_INTERVAL":
      return "DETERMINATE_NOT_APPLICABLE";
    case "LEGAL_TEXT_END_CONFLICT":
      return "INDETERMINATE";
    case "LEGAL_TEXT_PARTIAL_TERMINATION_INDETERMINATE":
      return "INDETERMINATE";
    default: {
      const exhaustive: never = kind;
      throw new E85DesignationLegalTextTemporalCoincidenceError(`unsupported legal text result kind, got ${JSON.stringify(exhaustive)}.`);
    }
  }
}

/**
 * The shared limitation text carried by every positive (co-incidence)
 * outcome. Modeled on the house style already established by
 * `IDENTITY_CORRESPONDENCE_ESTABLISHED.limitation`
 * (designation-legal-text-identity-correspondence.ts) and
 * `POSITIVE_COVERAGE_LIMITATION` (legal-text-applicability.ts). Fully
 * self-contained: the designation side's own positive-coverage variants
 * carry no `.limitation` field of their own, so nothing upstream can be
 * assumed already disclaimed.
 */
const POSITIVE_COINCIDENCE_LIMITATION =
  "This means ONLY that the supplied designation-applicability result and the supplied legal-text-applicability result both indicate " +
  "positive coverage. Both results are ASSUMED, not verified, to have been computed against the same caller-asserted asOf date supplied " +
  "here — this module cannot and does not check that assumption. It does NOT establish legal effect; it does NOT establish enactment; it " +
  "does NOT establish that either result is applicable to any particular property; it does NOT establish identity correspondence between " +
  "the designation and the legal text; it does NOT establish historical continuity; it does NOT authorize rule-pack application; and it " +
  "does NOT constitute a final zoning or planning determination.";

/**
 * Closed, exhaustive result vocabulary for
 * `evaluateE85DesignationLegalTextTemporalCoincidence`. Every variant
 * carries both source `.kind` values, by reference, unchanged.
 *
 *   - BOTH_CLOSED_APPLICABLE: both sides report their closed,
 *     within-interval positive-coverage kind
 *     (`DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL` +
 *     `LEGAL_TEXT_APPLICABLE_WITHIN_CLOSED_INTERVAL`). Carries `.limitation`.
 *   - MIXED_CLOSED_AND_OPEN_END_APPLICABLE: one side reports its closed,
 *     within-interval positive kind and the other reports its hedged
 *     open-end positive kind. `.openEndSide` names which side ("DESIGNATION"
 *     or "LEGAL_TEXT") is the open-end one. Carries `.limitation`.
 *   - BOTH_OPEN_END_APPLICABLE: both sides report their hedged open-end
 *     positive kind (`DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END` +
 *     `LEGAL_TEXT_POSSIBLY_APPLICABLE_OPEN_END`). Carries `.limitation`.
 *     Distinct from `BOTH_CLOSED_APPLICABLE`.
 *   - NOT_EVALUABLE: either or both sides report their request-mode
 *     passthrough kind (`DESIGNATION_APPLICABILITY_NOT_EVALUABLE` /
 *     `LEGAL_TEXT_APPLICABILITY_NOT_EVALUABLE`). `.notEvaluableSide` names
 *     which side(s) ("DESIGNATION", "LEGAL_TEXT", or "BOTH"). Checked before
 *     the indeterminate and not-co-incident checks below, since
 *     "not evaluable" is a distinct, more specific reason than either.
 *   - INDETERMINATE: either or both sides report an indeterminate kind
 *     (designation: `DESIGNATION_NO_START_EVIDENCE`,
 *     `DESIGNATION_START_CONFLICT`, `DESIGNATION_END_CONFLICT`,
 *     `DESIGNATION_OBSERVATION_ONLY_NOT_LEGALLY_DATED`; legal-text:
 *     `LEGAL_TEXT_NO_START_EVIDENCE`, `LEGAL_TEXT_START_CONFLICT`,
 *     `LEGAL_TEXT_END_CONFLICT`, `LEGAL_TEXT_PARTIAL_TERMINATION_INDETERMINATE`).
 *     The exact source kind(s) are preserved verbatim via
 *     `designationResultKind`/`legalTextResultKind` — never a single generic
 *     bucket that loses which specific kind triggered it.
 *   - NOT_COINCIDENT: neither NOT_EVALUABLE nor INDETERMINATE applies, and at
 *     least one side is not positive (e.g. `DESIGNATION_NOT_YET_STARTED`,
 *     `DESIGNATION_OUTSIDE_CLOSED_INTERVAL`, `LEGAL_TEXT_NOT_YET_STARTED`,
 *     `LEGAL_TEXT_OUTSIDE_CLOSED_INTERVAL`, or any mix of one positive side
 *     with one dated-but-non-positive side). Both source kinds are always
 *     preserved. Co-incidence requires BOTH sides positive; anything else
 *     that isn't more specifically NOT_EVALUABLE or INDETERMINATE falls here.
 */
export type E85DesignationLegalTextTemporalCoincidenceResult =
  | {
      readonly kind: "BOTH_CLOSED_APPLICABLE";
      readonly designationResultKind: E85DesignationApplicabilityResult["kind"];
      readonly legalTextResultKind: E85LegalTextApplicabilityResult["kind"];
      readonly asOf: string;
      readonly limitation: string;
    }
  | {
      readonly kind: "MIXED_CLOSED_AND_OPEN_END_APPLICABLE";
      readonly designationResultKind: E85DesignationApplicabilityResult["kind"];
      readonly legalTextResultKind: E85LegalTextApplicabilityResult["kind"];
      readonly openEndSide: "DESIGNATION" | "LEGAL_TEXT";
      readonly asOf: string;
      readonly limitation: string;
    }
  | {
      readonly kind: "BOTH_OPEN_END_APPLICABLE";
      readonly designationResultKind: E85DesignationApplicabilityResult["kind"];
      readonly legalTextResultKind: E85LegalTextApplicabilityResult["kind"];
      readonly asOf: string;
      readonly limitation: string;
    }
  | {
      readonly kind: "NOT_EVALUABLE";
      readonly designationResultKind: E85DesignationApplicabilityResult["kind"];
      readonly legalTextResultKind: E85LegalTextApplicabilityResult["kind"];
      readonly notEvaluableSide: "DESIGNATION" | "LEGAL_TEXT" | "BOTH";
      readonly asOf: string;
    }
  | {
      readonly kind: "INDETERMINATE";
      readonly designationResultKind: E85DesignationApplicabilityResult["kind"];
      readonly legalTextResultKind: E85LegalTextApplicabilityResult["kind"];
      readonly asOf: string;
    }
  | {
      readonly kind: "NOT_COINCIDENT";
      readonly designationResultKind: E85DesignationApplicabilityResult["kind"];
      readonly legalTextResultKind: E85LegalTextApplicabilityResult["kind"];
      readonly asOf: string;
    };

/**
 * Deterministic, reproducible error raised only for structurally impossible
 * input at this module's own boundary: a non-object argument, an
 * unrecognized `designation.kind`, an unrecognized `legalText.kind`, or a
 * non-string/empty `asOf`. A real, well-formed `E85DesignationApplicabilityResult`
 * (as only `evaluateE85DesignationApplicability` can construct) and a real,
 * well-formed `E85LegalTextApplicabilityResult` (as only
 * `evaluateE85LegalTextApplicability` can construct) can never reach the
 * `kind`-recognition branches — they exist purely as a defensive backstop,
 * mirroring the same defensive-shape-check discipline already applied by
 * `validateDesignationResult`
 * (designation-legal-text-identity-correspondence.ts). Never carries
 * wall-clock time, object identity, or any other nondeterministic content.
 */
export class E85DesignationLegalTextTemporalCoincidenceError extends Error {
  constructor(message: string) {
    super(`E85 designation/legal-text temporal coincidence error: ${message}`);
    this.name = "E85DesignationLegalTextTemporalCoincidenceError";
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validateDesignationResult(designation: unknown): E85DesignationApplicabilityResult {
  if (!isPlainObject(designation)) {
    throw new E85DesignationLegalTextTemporalCoincidenceError(`designation must be an object, got ${JSON.stringify(designation)}.`);
  }
  const kind = designation.kind;
  if (typeof kind !== "string" || !ALL_DESIGNATION_RESULT_KINDS.includes(kind as E85DesignationApplicabilityResult["kind"])) {
    throw new E85DesignationLegalTextTemporalCoincidenceError(
      `designation.kind must be one of ${JSON.stringify(ALL_DESIGNATION_RESULT_KINDS)}, got ${JSON.stringify(kind)}.`,
    );
  }
  return designation as unknown as E85DesignationApplicabilityResult;
}

function validateLegalTextResult(legalText: unknown): E85LegalTextApplicabilityResult {
  if (!isPlainObject(legalText)) {
    throw new E85DesignationLegalTextTemporalCoincidenceError(`legalText must be an object, got ${JSON.stringify(legalText)}.`);
  }
  const kind = legalText.kind;
  if (typeof kind !== "string" || !ALL_LEGAL_TEXT_RESULT_KINDS.includes(kind as E85LegalTextApplicabilityResult["kind"])) {
    throw new E85DesignationLegalTextTemporalCoincidenceError(
      `legalText.kind must be one of ${JSON.stringify(ALL_LEGAL_TEXT_RESULT_KINDS)}, got ${JSON.stringify(kind)}.`,
    );
  }
  return legalText as unknown as E85LegalTextApplicabilityResult;
}

function validateAsOf(asOf: unknown): string {
  if (typeof asOf !== "string" || asOf.trim().length === 0) {
    throw new E85DesignationLegalTextTemporalCoincidenceError(`asOf must be a non-empty string, got ${JSON.stringify(asOf)}.`);
  }
  return asOf;
}

/**
 * Evaluates whether a Slice 3G-2 designation-applicability result and a
 * legal-text-applicability result indicate co-incidence at a caller-asserted
 * `asOf` date. Pure and deterministic: the same three inputs always yield a
 * deeply-equal result, or throw the same
 * `E85DesignationLegalTextTemporalCoincidenceError`. None of the three
 * inputs (nor any nested object within them) is mutated.
 *
 * `asOf` is a caller assertion, not something this module can verify against
 * either input — see the module doc's TRUST BOUNDARY section. It is echoed
 * back on every outcome (`.asOf`) purely for caller reference/traceability,
 * never compared against any embedded date field on either input.
 *
 * Checked in order: (1) is either/both side's kind
 * `*_APPLICABILITY_NOT_EVALUABLE` (`NOT_EVALUABLE`, most specific — a
 * request-mode passthrough is distinct from an evidentiary indeterminate
 * conclusion); (2) is either/both side's kind one of the indeterminate kinds
 * (`INDETERMINATE`); (3) are both sides positive-coverage kinds, and if so
 * which combination (`BOTH_CLOSED_APPLICABLE` /
 * `MIXED_CLOSED_AND_OPEN_END_APPLICABLE` / `BOTH_OPEN_END_APPLICABLE`); (4)
 * otherwise, `NOT_COINCIDENT`.
 */
export function evaluateE85DesignationLegalTextTemporalCoincidence(
  designation: E85DesignationApplicabilityResult,
  legalText: E85LegalTextApplicabilityResult,
  asOf: string,
): E85DesignationLegalTextTemporalCoincidenceResult {
  const validatedDesignation = validateDesignationResult(designation);
  const validatedLegalText = validateLegalTextResult(legalText);
  const validatedAsOf = validateAsOf(asOf);

  const designationResultKind = validatedDesignation.kind;
  const legalTextResultKind = validatedLegalText.kind;

  const designationClassification = classifyDesignationKind(designationResultKind);
  const legalTextClassification = classifyLegalTextKind(legalTextResultKind);

  const designationNotEvaluable = designationClassification === "NOT_EVALUABLE";
  const legalTextNotEvaluable = legalTextClassification === "NOT_EVALUABLE";
  if (designationNotEvaluable || legalTextNotEvaluable) {
    const notEvaluableSide: "DESIGNATION" | "LEGAL_TEXT" | "BOTH" =
      designationNotEvaluable && legalTextNotEvaluable ? "BOTH" : designationNotEvaluable ? "DESIGNATION" : "LEGAL_TEXT";
    return { kind: "NOT_EVALUABLE", designationResultKind, legalTextResultKind, notEvaluableSide, asOf: validatedAsOf };
  }

  const designationIndeterminate = designationClassification === "INDETERMINATE";
  const legalTextIndeterminate = legalTextClassification === "INDETERMINATE";
  if (designationIndeterminate || legalTextIndeterminate) {
    return { kind: "INDETERMINATE", designationResultKind, legalTextResultKind, asOf: validatedAsOf };
  }

  const designationPositive = designationClassification === "POSITIVE_CLOSED" || designationClassification === "POSITIVE_OPEN_END";
  const legalTextPositive = legalTextClassification === "POSITIVE_CLOSED" || legalTextClassification === "POSITIVE_OPEN_END";

  if (designationPositive && legalTextPositive) {
    const designationClosed = designationClassification === "POSITIVE_CLOSED";
    const legalTextClosed = legalTextClassification === "POSITIVE_CLOSED";

    if (designationClosed && legalTextClosed) {
      return {
        kind: "BOTH_CLOSED_APPLICABLE",
        designationResultKind,
        legalTextResultKind,
        asOf: validatedAsOf,
        limitation: POSITIVE_COINCIDENCE_LIMITATION,
      };
    }

    if (!designationClosed && !legalTextClosed) {
      return {
        kind: "BOTH_OPEN_END_APPLICABLE",
        designationResultKind,
        legalTextResultKind,
        asOf: validatedAsOf,
        limitation: POSITIVE_COINCIDENCE_LIMITATION,
      };
    }

    const openEndSide: "DESIGNATION" | "LEGAL_TEXT" = designationClosed ? "LEGAL_TEXT" : "DESIGNATION";
    return {
      kind: "MIXED_CLOSED_AND_OPEN_END_APPLICABLE",
      designationResultKind,
      legalTextResultKind,
      openEndSide,
      asOf: validatedAsOf,
      limitation: POSITIVE_COINCIDENCE_LIMITATION,
    };
  }

  return { kind: "NOT_COINCIDENT", designationResultKind, legalTextResultKind, asOf: validatedAsOf };
}

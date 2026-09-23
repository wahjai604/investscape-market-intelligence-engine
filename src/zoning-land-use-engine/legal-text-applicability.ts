/**
 * InvestScape™ E85 — Legal-Text-Version AS_OF Applicability Evaluator.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Additive only. This module answers exactly one question: "given an
 * already-validated `E85VersionValidity` (version-validity-types.ts) and an
 * already-resolved `E85ResolvedTemporalRequest` (temporal-request-types.ts),
 * is the legal-text version applicable at the requested AS_OF date?" It is a
 * pure, deterministic, single-version evaluator — nothing more.
 *
 * SCOPE. This module mirrors `evaluateE85DesignationApplicability`
 * (designation-applicability.ts, Slice 3G-2) structurally, but operates on
 * `E85VersionValidity` (Slice 3B) instead of `E85DesignationValidity`
 * (Slice 3G-1). It does NOT: correspond this coverage result against a
 * designation-applicability result or any linkage identity (that is a later,
 * out-of-scope co-incidence evaluator); prove enactment or legal effect;
 * conclude that a parcel was historically zoned under this version; consult a
 * rule pack; compute materiality, gaps, blockers, or any
 * DATA_GAP/MANUAL_REVIEW_REQUIRED vocabulary; infer continuity from repeated
 * observations; or get wired into spatial applicability, decision
 * orchestration, or package assembly. All of that is out of scope for this
 * module. This module is not imported by, and does not import, any existing
 * production file other than the two pure type/contract modules named above.
 *
 * REQUEST-MODE CONVENTION. Identical to `evaluateE85DesignationApplicability`:
 * ABSENT and CURRENT are not resolved to a concrete date, not treated as
 * errors, and not defaulted to "today" (no machine clock is read anywhere in
 * this file) — they deterministically produce a dedicated "not evaluable"
 * result kind (`LEGAL_TEXT_APPLICABILITY_NOT_EVALUABLE`). Only `AS_OF` is
 * ever evaluated for applicability.
 *
 * CLOSED BOUNDARY CONVENTION. `CLOSED`'s own module doc
 * (version-validity-types.ts, state 5) states the interval carries
 * `effectiveTo >= effectiveFrom`, with a single-day interval where they are
 * equal permitted. This evaluator uses the identical inclusive-on-both-ends
 * convention for AS_OF membership: `effectiveFrom <= asOfDate <= effectiveTo`.
 *
 * CONFLICTING_END CONVENTION. A known start authority exists even when the
 * end is disputed. An AS_OF date preceding that known `effectiveFrom` is
 * still determinate ("not yet started" — the start evidence is solid even
 * though the end is disputed); an AS_OF date at or after `effectiveFrom` is
 * `LEGAL_TEXT_END_CONFLICT` — this module never guesses which disputed end
 * date wins.
 *
 * CONDITIONAL_PARTIAL_TERMINATION CONVENTION. Always
 * `LEGAL_TEXT_PARTIAL_TERMINATION_INDETERMINATE`, regardless of AS_OF. This
 * module never infers or encodes whether a partial-termination clause
 * behaves as an end date or as a non-temporal scope change — that is an
 * unresolved product/legal question this evaluator does not answer.
 *
 * EVERY POSITIVE-COVERAGE OUTCOME carries a mandatory `.limitation` string,
 * modeled on the house style already established by
 * `evaluateE85DesignationLegalTextIdentityCorrespondence`'s
 * `IDENTITY_CORRESPONDENCE_ESTABLISHED.limitation`
 * (designation-legal-text-identity-correspondence.ts, Slice 3H-1): interval
 * coverage at the supplied AS_OF date does NOT establish enactment, legal
 * effect, applicability to a property, identity correspondence, historical
 * continuity, rule-pack authorization, or a final zoning/planning
 * determination.
 *
 * No machine clock is read anywhere in this file. No range overlap,
 * containment, historical continuity, or legal conclusion of any kind is
 * computed anywhere in this module. No file in this module is mutated, and
 * none of its inputs are mutated.
 */
import type { E85VersionValidity } from "./version-validity-types";
import type { E85ResolvedTemporalRequest } from "./temporal-request-types";

/**
 * Canonical full-date string comparison. `E85VersionValidity`'s dates are
 * already canonical YYYY-MM-DD strings (enforced at construction time by
 * `buildE85VersionValidity`), and `E85ResolvedTemporalRequest`'s AS_OF date
 * is already canonical (enforced by `resolveE85TemporalRequest`), so this
 * module trusts both inputs' date fields and compares them lexically — safe
 * specifically because YYYY-MM-DD lexical order equals calendar order. This
 * mirrors `designation-applicability.ts`'s identical helpers exactly.
 */
function isAtOrAfter(asOfDate: string, boundary: string): boolean {
  return asOfDate >= boundary;
}

function isAtOrBefore(asOfDate: string, boundary: string): boolean {
  return asOfDate <= boundary;
}

/**
 * The shared limitation text carried by every positive-coverage outcome
 * (`LEGAL_TEXT_POSSIBLY_APPLICABLE_OPEN_END` and
 * `LEGAL_TEXT_APPLICABLE_WITHIN_CLOSED_INTERVAL`). Modeled on
 * `IDENTITY_CORRESPONDENCE_ESTABLISHED.limitation`
 * (designation-legal-text-identity-correspondence.ts) — same house style,
 * same enumerated list of what is NOT established, adapted to state
 * "interval coverage" rather than "identity correspondence".
 */
const POSITIVE_COVERAGE_LIMITATION =
  "This means ONLY that the supplied AS_OF date falls within this legal-text version's own validity interval. It does NOT establish " +
  "enactment; it does NOT establish legal effect; it does NOT establish that this version is applicable to any particular property; " +
  "it does NOT establish identity correspondence with any designation or linkage; it does NOT establish historical continuity; it does " +
  "NOT authorize rule-pack application; and it does NOT constitute a final zoning or planning determination.";

/**
 * Closed, exhaustive result vocabulary for
 * `evaluateE85LegalTextApplicability`. Mirrors
 * `E85DesignationApplicabilityResult`'s structure (designation-
 * applicability.ts) one-for-one where `E85VersionValidity`'s seven states
 * justify it; diverges only where the two validity contracts genuinely
 * differ (`E85VersionValidity` has no `OPEN_OBSERVATION_ASSERTION`-style
 * start authority, and instead has the extra `CONDITIONAL_PARTIAL_TERMINATION`
 * state, which `E85DesignationValidity` does not).
 *
 *   - LEGAL_TEXT_APPLICABILITY_NOT_EVALUABLE: the resolved request was
 *     ABSENT or CURRENT. No applicability conclusion is offered.
 *   - LEGAL_TEXT_NO_START_EVIDENCE: `START_UNKNOWN` — there is no start
 *     evidence to evaluate AS_OF against at all. Distinct from "not
 *     applicable"; nothing is known either way.
 *   - LEGAL_TEXT_START_CONFLICT: `CONFLICTING_START` — two or more mutually
 *     inconsistent start authorities exist. Never collapsed into "no
 *     evidence": a conflict is evidentially stronger than an absence, and is
 *     reported as its own distinct outcome.
 *   - LEGAL_TEXT_NOT_YET_STARTED: a known start exists (`OPEN_UNRESEARCHED`,
 *     `OPEN_REVIEWED_NO_END_ESTABLISHED`, `CLOSED`, or `CONFLICTING_END`) and
 *     AS_OF precedes `effectiveFrom`. For `CONFLICTING_END` this is still
 *     determinate: the start is solid evidence even though the end is
 *     disputed.
 *   - LEGAL_TEXT_POSSIBLY_APPLICABLE_OPEN_END: a known start exists
 *     (`OPEN_UNRESEARCHED` or `OPEN_REVIEWED_NO_END_ESTABLISHED`) and AS_OF
 *     is on or after `effectiveFrom`. No `effectiveTo` is known, so coverage
 *     beyond `effectiveFrom` is possible but unproven — never reported as a
 *     bare "applicable". Carries `.limitation`.
 *   - LEGAL_TEXT_APPLICABLE_WITHIN_CLOSED_INTERVAL: `CLOSED` and AS_OF falls
 *     inside the inclusive `[effectiveFrom, effectiveTo]` interval. Carries
 *     `.limitation`.
 *   - LEGAL_TEXT_OUTSIDE_CLOSED_INTERVAL: `CLOSED` and AS_OF falls after
 *     `effectiveTo` (a `CLOSED` AS_OF date preceding `effectiveFrom` is
 *     reported as `LEGAL_TEXT_NOT_YET_STARTED` instead, identically to the
 *     open dated-start states and to `designation-applicability.ts`'s own
 *     CLOSED handling — this keeps "before start" merged into the single
 *     general not-yet-started variant rather than splitting out a separate
 *     closed-specific "before start" kind, matching 3G-2's precedent
 *     exactly).
 *   - LEGAL_TEXT_END_CONFLICT: `CONFLICTING_END` and AS_OF is at or after the
 *     known (unconflicted) `effectiveFrom` — a start authority is
 *     established but two or more mutually inconsistent end authorities
 *     exist. Never collapsed into "unknown"/"insufficient evidence", and
 *     this module never guesses which disputed end date wins.
 *   - LEGAL_TEXT_PARTIAL_TERMINATION_INDETERMINATE:
 *     `CONDITIONAL_PARTIAL_TERMINATION` — ALWAYS this outcome, regardless of
 *     AS_OF. Whether a partial-termination clause behaves as an end date or
 *     as a non-temporal scope change is an unresolved product/legal question
 *     this evaluator does not answer, so no AS_OF relation to the known start
 *     changes this outcome.
 */
export type E85LegalTextApplicabilityResult =
  | { readonly kind: "LEGAL_TEXT_APPLICABILITY_NOT_EVALUABLE" }
  | { readonly kind: "LEGAL_TEXT_NO_START_EVIDENCE" }
  | { readonly kind: "LEGAL_TEXT_START_CONFLICT" }
  | {
      readonly kind: "LEGAL_TEXT_NOT_YET_STARTED";
      readonly effectiveFrom: string;
      readonly asOfDate: string;
    }
  | {
      readonly kind: "LEGAL_TEXT_POSSIBLY_APPLICABLE_OPEN_END";
      readonly effectiveFrom: string;
      readonly asOfDate: string;
      readonly limitation: string;
    }
  | {
      readonly kind: "LEGAL_TEXT_APPLICABLE_WITHIN_CLOSED_INTERVAL";
      readonly effectiveFrom: string;
      readonly effectiveTo: string;
      readonly asOfDate: string;
      readonly limitation: string;
    }
  | {
      readonly kind: "LEGAL_TEXT_OUTSIDE_CLOSED_INTERVAL";
      readonly effectiveFrom: string;
      readonly effectiveTo: string;
      readonly asOfDate: string;
    }
  | { readonly kind: "LEGAL_TEXT_END_CONFLICT"; readonly effectiveFrom: string; readonly asOfDate: string }
  | { readonly kind: "LEGAL_TEXT_PARTIAL_TERMINATION_INDETERMINATE" };

/**
 * Deterministic, reproducible error raised only for structurally impossible
 * input at this module's own boundary: an unrecognized
 * `E85VersionValidity.state`, or an unrecognized `E85ResolvedTemporalRequest`
 * shape (`kind`/`mode`). A real, well-formed version-validity object (as only
 * `buildE85VersionValidity` can construct) and a real, well-formed resolved
 * request (as only `resolveE85TemporalRequest` can construct) can never reach
 * these branches — they exist purely as a defensive backstop, mirroring
 * `E85DesignationApplicabilityError` exactly. Never carries wall-clock time,
 * object identity, or any other nondeterministic content.
 */
export class E85LegalTextApplicabilityError extends Error {
  constructor(message: string) {
    super(`E85 legal text applicability error: ${message}`);
    this.name = "E85LegalTextApplicabilityError";
  }
}

/**
 * Evaluates a known-start `E85VersionValidity` (`OPEN_UNRESEARCHED` or
 * `OPEN_REVIEWED_NO_END_ESTABLISHED`) against a requested AS_OF date. `CLOSED`
 * and `CONFLICTING_END` are handled directly by their caller since they
 * additionally need `effectiveTo`/conflict handling.
 */
function evaluateOpenStart(effectiveFrom: string, asOfDate: string): E85LegalTextApplicabilityResult {
  if (isAtOrAfter(asOfDate, effectiveFrom)) {
    return { kind: "LEGAL_TEXT_POSSIBLY_APPLICABLE_OPEN_END", effectiveFrom, asOfDate, limitation: POSITIVE_COVERAGE_LIMITATION };
  }
  return { kind: "LEGAL_TEXT_NOT_YET_STARTED", effectiveFrom, asOfDate };
}

/**
 * Evaluates the applicability of one legal-text-version validity record
 * against one already-resolved temporal request. Pure and deterministic: the
 * same two inputs always yield a deeply-equal result, or throw the same
 * `E85LegalTextApplicabilityError`. Neither `validity` nor `resolvedRequest`
 * (nor any nested object within them) is mutated.
 *
 * Only `AS_OF` resolved requests are ever evaluated for applicability;
 * `ABSENT` and `CURRENT` deterministically produce
 * `LEGAL_TEXT_APPLICABILITY_NOT_EVALUABLE`, mirroring the convention already
 * established by `evaluateE85DesignationApplicability`
 * (designation-applicability.ts) and, before it,
 * `selectE85TemporalCandidate` (temporal-selection.ts). Every one of
 * `E85VersionValidity`'s seven real states is handled exhaustively via a
 * compile-time exhaustiveness check (the `assertNever` pattern already used
 * by `buildE85TemporalCandidateFromVersionValidity`,
 * temporal-candidate-adapter.ts, and by `evaluateE85DesignationApplicability`
 * itself).
 */
export function evaluateE85LegalTextApplicability(
  validity: E85VersionValidity,
  resolvedRequest: E85ResolvedTemporalRequest,
): E85LegalTextApplicabilityResult {
  if (resolvedRequest === null || typeof resolvedRequest !== "object") {
    throw new E85LegalTextApplicabilityError(`resolvedRequest must be an object, got ${JSON.stringify(resolvedRequest)}.`);
  }

  if (resolvedRequest.kind === "ABSENT") {
    return { kind: "LEGAL_TEXT_APPLICABILITY_NOT_EVALUABLE" };
  }

  if (resolvedRequest.kind !== "RESOLVED") {
    const exhaustiveRequest: never = resolvedRequest;
    throw new E85LegalTextApplicabilityError(`resolvedRequest.kind must be "ABSENT" or "RESOLVED", got ${JSON.stringify(exhaustiveRequest)}.`);
  }

  const { request } = resolvedRequest;
  if (request.mode === "CURRENT") {
    return { kind: "LEGAL_TEXT_APPLICABILITY_NOT_EVALUABLE" };
  }

  if (request.mode !== "AS_OF") {
    const exhaustiveMode: never = request;
    throw new E85LegalTextApplicabilityError(`resolvedRequest.request.mode must be "CURRENT" or "AS_OF", got ${JSON.stringify(exhaustiveMode)}.`);
  }

  const asOfDate = request.asOfDate;

  if (validity === null || typeof validity !== "object") {
    throw new E85LegalTextApplicabilityError(`validity must be an object, got ${JSON.stringify(validity)}.`);
  }

  switch (validity.state) {
    case "START_UNKNOWN":
      return { kind: "LEGAL_TEXT_NO_START_EVIDENCE" };

    case "CONFLICTING_START":
      return { kind: "LEGAL_TEXT_START_CONFLICT" };

    case "OPEN_UNRESEARCHED":
      return evaluateOpenStart(validity.effectiveFrom, asOfDate);

    case "OPEN_REVIEWED_NO_END_ESTABLISHED":
      return evaluateOpenStart(validity.effectiveFrom, asOfDate);

    case "CLOSED": {
      const { effectiveFrom, effectiveTo } = validity;
      // A CLOSED record still has a start date like the open dated states,
      // so an AS_OF date preceding effectiveFrom is reported identically as
      // LEGAL_TEXT_NOT_YET_STARTED, not folded into
      // LEGAL_TEXT_OUTSIDE_CLOSED_INTERVAL — that discriminant is reserved
      // for AS_OF dates strictly after the closed interval's own end. This
      // mirrors designation-applicability.ts's identical CLOSED handling.
      if (!isAtOrAfter(asOfDate, effectiveFrom)) {
        return { kind: "LEGAL_TEXT_NOT_YET_STARTED", effectiveFrom, asOfDate };
      }
      const withinInterval = isAtOrBefore(asOfDate, effectiveTo);
      if (withinInterval) {
        return {
          kind: "LEGAL_TEXT_APPLICABLE_WITHIN_CLOSED_INTERVAL",
          effectiveFrom,
          effectiveTo,
          asOfDate,
          limitation: POSITIVE_COVERAGE_LIMITATION,
        };
      }
      return { kind: "LEGAL_TEXT_OUTSIDE_CLOSED_INTERVAL", effectiveFrom, effectiveTo, asOfDate };
    }

    case "CONFLICTING_END": {
      const { effectiveFrom } = validity;
      if (!isAtOrAfter(asOfDate, effectiveFrom)) {
        return { kind: "LEGAL_TEXT_NOT_YET_STARTED", effectiveFrom, asOfDate };
      }
      return { kind: "LEGAL_TEXT_END_CONFLICT", effectiveFrom, asOfDate };
    }

    case "CONDITIONAL_PARTIAL_TERMINATION":
      return { kind: "LEGAL_TEXT_PARTIAL_TERMINATION_INDETERMINATE" };

    default: {
      const exhaustiveValidity: never = validity;
      throw new E85LegalTextApplicabilityError(`unsupported legal text validity state, got ${JSON.stringify(exhaustiveValidity)}.`);
    }
  }
}

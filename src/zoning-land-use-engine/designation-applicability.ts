/**
 * InvestScape™ E85 Phase 15.21B — Parcel-Designation AS_OF Applicability
 * Evaluator, Slice 3G-2.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Additive only. This module answers exactly one question: "given an
 * already-validated `E85DesignationValidity` (Slice 3G-1,
 * designation-validity-types.ts) and an already-resolved
 * `E85ResolvedTemporalRequest` (Slice 1, temporal-request-types.ts), is the
 * designation applicable at the requested AS_OF date?" It is a pure,
 * deterministic, single-designation evaluator — nothing more.
 *
 * SCOPE. This module does NOT: temporalize legal-linkage; align a
 * designation against `E85VersionValidity`/legal-text validity; consult a
 * rule pack; compute materiality, gaps, blockers, or any
 * DATA_GAP/MANUAL_REVIEW_REQUIRED vocabulary; infer continuity from repeated
 * observations; or get wired into spatial applicability, decision
 * orchestration, or package assembly. All of that is out of scope for this
 * slice — see designation-validity-types.ts's own module doc for the same
 * boundary stated from Slice 3G-1's side. This module is not imported by,
 * and does not import, any existing production file other than the two pure
 * type/contract modules named above.
 *
 * REQUEST-MODE CONVENTION. This module mirrors the convention already
 * established by `selectE85TemporalCandidate` (temporal-selection.ts) and
 * carried forward by `selectE85TemporalLineages`
 * (temporal-lineage-selection.ts): ABSENT and CURRENT are not resolved to a
 * concrete date, not treated as errors, and not defaulted to "today" (no
 * machine clock is read anywhere in this file) — they deterministically
 * produce a dedicated "not evaluable" result kind
 * (`DESIGNATION_APPLICABILITY_NOT_EVALUABLE`). Only `AS_OF` is ever
 * evaluated for applicability.
 *
 * OBSERVATION-ONLY SAFETY RULE. A designation whose start authority is
 * `OPEN_OBSERVATION_ASSERTION` never establishes legal applicability at (or
 * around) its observation date, regardless of how the requested AS_OF date
 * relates to `observedAt`. `OPEN_UNRESEARCHED` and
 * `OPEN_REVIEWED_NO_END_ESTABLISHED` states built on such a start authority
 * always resolve to `DESIGNATION_OBSERVATION_ONLY_NOT_LEGALLY_DATED`, never
 * to `DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END` or any other applicability
 * conclusion — see `buildKnownStartApplicability` below.
 *
 * CLOSED BOUNDARY CONVENTION. `CLOSED`'s own module doc
 * (designation-validity-types.ts, state 5) states the interval is
 * "inclusive on both ends" (`effectiveTo >= effectiveFrom`, and a
 * single-day interval where they are equal is permitted). This evaluator
 * uses the identical inclusive-on-both-ends convention for AS_OF membership:
 * `effectiveFrom <= asOfDate <= effectiveTo`.
 *
 * No machine clock is read anywhere in this file. No continuity is inferred
 * from repeated observations (there is only ever one `observation` per
 * `OPEN_OBSERVATION_ASSERTION` start authority to begin with — Slice 3G-1
 * never merges several). No file in this module is mutated, and none of its
 * inputs are mutated.
 */
import type { E85DesignationValidity, E85DesignationIdentity, E85DesignationStartAuthority } from "./designation-validity-types";
import type { E85ResolvedTemporalRequest } from "./temporal-request-types";

/**
 * Canonical full-date string comparison. `E85DesignationValidity`'s dates
 * are already canonical YYYY-MM-DD strings (enforced at construction time by
 * `buildE85DesignationValidity`), and `E85ResolvedTemporalRequest`'s AS_OF
 * date is already canonical (enforced by `resolveE85TemporalRequest`), so
 * this module trusts both inputs' date fields and compares them lexically —
 * safe specifically because YYYY-MM-DD lexical order equals calendar order.
 * This mirrors the comparison style already used at
 * designation-validity-types.ts's own CLOSED-interval construction-time
 * check (`effectiveTo < effectiveFrom`).
 */
function isAtOrAfter(asOfDate: string, boundary: string): boolean {
  return asOfDate >= boundary;
}

function isAtOrBefore(asOfDate: string, boundary: string): boolean {
  return asOfDate <= boundary;
}

/**
 * Closed, exhaustive result vocabulary for
 * `evaluateE85DesignationApplicability`. Every variant carries the input
 * designation's own `identity`, by reference, unchanged — this module never
 * fabricates or renames identity fields, and never claims a legal-linkage,
 * legal-text, rule-pack, or spatial-alignment conclusion.
 *
 *   - DESIGNATION_APPLICABILITY_NOT_EVALUABLE: the resolved request was
 *     ABSENT or CURRENT. No applicability conclusion is offered.
 *   - DESIGNATION_NO_START_EVIDENCE: `DESIGNATION_START_UNKNOWN` — there is
 *     no start evidence to evaluate AS_OF against at all. Distinct from
 *     "not applicable"; nothing is known either way.
 *   - DESIGNATION_START_CONFLICT: `CONFLICTING_DESIGNATION_START` — two or
 *     more mutually inconsistent start authorities exist. This is never
 *     collapsed into "no evidence": a conflict is evidentially stronger than
 *     an absence, and is reported as its own distinct outcome.
 *   - DESIGNATION_OBSERVATION_ONLY_NOT_LEGALLY_DATED: the known start
 *     authority is `OPEN_OBSERVATION_ASSERTION`. Never promoted to a legal
 *     applicability conclusion, regardless of the AS_OF/observedAt
 *     relationship — see module doc.
 *   - DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END: a dated start authority
 *     exists (`OPEN_UNRESEARCHED` or `OPEN_REVIEWED_NO_END_ESTABLISHED`) and
 *     AS_OF is on or after `effectiveFrom`. No `effectiveTo` is known, so
 *     applicability beyond `effectiveFrom` is possible but unproven — never
 *     reported as a bare "applicable".
 *   - DESIGNATION_NOT_YET_STARTED: a dated start authority exists (an
 *     `OPEN_UNRESEARCHED`/`OPEN_REVIEWED_NO_END_ESTABLISHED` dated start, or a
 *     `CLOSED` record) and AS_OF precedes `effectiveFrom`.
 *   - DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL: `CLOSED` and AS_OF
 *     falls inside the inclusive `[effectiveFrom, effectiveTo]` interval.
 *   - DESIGNATION_OUTSIDE_CLOSED_INTERVAL: `CLOSED` and AS_OF falls after
 *     `effectiveTo` (a `CLOSED` AS_OF date preceding `effectiveFrom` is
 *     reported as `DESIGNATION_NOT_YET_STARTED` instead, identically to the
 *     open dated-start states).
 *   - DESIGNATION_END_CONFLICT: `CONFLICTING_DESIGNATION_END` — a start
 *     authority is established but two or more mutually inconsistent end
 *     authorities exist. Never collapsed into "unknown"/"insufficient
 *     evidence".
 */
export type E85DesignationApplicabilityResult =
  | { readonly kind: "DESIGNATION_APPLICABILITY_NOT_EVALUABLE" }
  | {
      readonly kind: "DESIGNATION_NO_START_EVIDENCE";
      readonly identity: E85DesignationIdentity;
    }
  | {
      readonly kind: "DESIGNATION_START_CONFLICT";
      readonly identity: E85DesignationIdentity;
    }
  | {
      readonly kind: "DESIGNATION_OBSERVATION_ONLY_NOT_LEGALLY_DATED";
      readonly identity: E85DesignationIdentity;
      readonly observedAt: string;
    }
  | {
      readonly kind: "DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END";
      readonly identity: E85DesignationIdentity;
      readonly effectiveFrom: string;
      readonly asOfDate: string;
    }
  | {
      readonly kind: "DESIGNATION_NOT_YET_STARTED";
      readonly identity: E85DesignationIdentity;
      readonly effectiveFrom: string;
      readonly asOfDate: string;
    }
  | {
      readonly kind: "DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL";
      readonly identity: E85DesignationIdentity;
      readonly effectiveFrom: string;
      readonly effectiveTo: string;
      readonly asOfDate: string;
    }
  | {
      readonly kind: "DESIGNATION_OUTSIDE_CLOSED_INTERVAL";
      readonly identity: E85DesignationIdentity;
      readonly effectiveFrom: string;
      readonly effectiveTo: string;
      readonly asOfDate: string;
    }
  | {
      readonly kind: "DESIGNATION_END_CONFLICT";
      readonly identity: E85DesignationIdentity;
    };

/**
 * Deterministic, reproducible error raised only for structurally impossible
 * input at this module's own boundary: an unrecognized
 * `E85DesignationValidity.state`, or an unrecognized
 * `E85ResolvedTemporalRequest` shape (`kind`/`mode`). A real, well-formed
 * designation-validity object (as only `buildE85DesignationValidity` can
 * construct) and a real, well-formed resolved request (as only
 * `resolveE85TemporalRequest` can construct) can never reach these branches
 * — they exist purely as a defensive backstop, never for an ordinary
 * evidentiary outcome. Never carries wall-clock time, object identity, or
 * any other nondeterministic content.
 */
export class E85DesignationApplicabilityError extends Error {
  constructor(message: string) {
    super(`E85 designation applicability error: ${message}`);
    this.name = "E85DesignationApplicabilityError";
  }
}

/**
 * Evaluates a known-start `E85DesignationValidity` (i.e. `OPEN_UNRESEARCHED`,
 * `OPEN_REVIEWED_NO_END_ESTABLISHED`, or `CLOSED`) against a requested AS_OF
 * date. Handles the observation-only safety rule uniformly for the two open
 * states; `CLOSED` is handled directly by its caller since it additionally
 * needs `effectiveTo`.
 */
function evaluateOpenStart(
  identity: E85DesignationIdentity,
  start: E85DesignationStartAuthority,
  asOfDate: string,
): E85DesignationApplicabilityResult {
  if (start.kind === "OPEN_OBSERVATION_ASSERTION") {
    return {
      kind: "DESIGNATION_OBSERVATION_ONLY_NOT_LEGALLY_DATED",
      identity,
      observedAt: start.observation.observedAt,
    };
  }

  const effectiveFrom = start.effectiveFrom;
  if (isAtOrAfter(asOfDate, effectiveFrom)) {
    return { kind: "DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END", identity, effectiveFrom, asOfDate };
  }
  return { kind: "DESIGNATION_NOT_YET_STARTED", identity, effectiveFrom, asOfDate };
}

/**
 * Evaluates the applicability of one parcel-designation validity record
 * against one already-resolved temporal request. Pure and deterministic:
 * the same two inputs always yield a deeply-equal result, or throw the same
 * `E85DesignationApplicabilityError`. Neither `validity` nor
 * `resolvedRequest` (nor any nested object within them) is mutated.
 *
 * Only `AS_OF` resolved requests are ever evaluated for applicability;
 * `ABSENT` and `CURRENT` deterministically produce
 * `DESIGNATION_APPLICABILITY_NOT_EVALUABLE`, mirroring the convention
 * already established by `selectE85TemporalCandidate`
 * (temporal-selection.ts). Every one of `E85DesignationValidity`'s six real
 * states is handled exhaustively via a compile-time exhaustiveness check
 * (the `assertNever` pattern already used by
 * `buildE85TemporalCandidateFromVersionValidity`,
 * temporal-candidate-adapter.ts).
 */
export function evaluateE85DesignationApplicability(
  validity: E85DesignationValidity,
  resolvedRequest: E85ResolvedTemporalRequest,
): E85DesignationApplicabilityResult {
  if (resolvedRequest === null || typeof resolvedRequest !== "object") {
    throw new E85DesignationApplicabilityError(`resolvedRequest must be an object, got ${JSON.stringify(resolvedRequest)}.`);
  }

  if (resolvedRequest.kind === "ABSENT") {
    return { kind: "DESIGNATION_APPLICABILITY_NOT_EVALUABLE" };
  }

  if (resolvedRequest.kind !== "RESOLVED") {
    const exhaustiveRequest: never = resolvedRequest;
    throw new E85DesignationApplicabilityError(`resolvedRequest.kind must be "ABSENT" or "RESOLVED", got ${JSON.stringify(exhaustiveRequest)}.`);
  }

  const { request } = resolvedRequest;
  if (request.mode === "CURRENT") {
    return { kind: "DESIGNATION_APPLICABILITY_NOT_EVALUABLE" };
  }

  if (request.mode !== "AS_OF") {
    const exhaustiveMode: never = request;
    throw new E85DesignationApplicabilityError(`resolvedRequest.request.mode must be "CURRENT" or "AS_OF", got ${JSON.stringify(exhaustiveMode)}.`);
  }

  const asOfDate = request.asOfDate;

  if (validity === null || typeof validity !== "object") {
    throw new E85DesignationApplicabilityError(`validity must be an object, got ${JSON.stringify(validity)}.`);
  }

  switch (validity.state) {
    case "DESIGNATION_START_UNKNOWN":
      return { kind: "DESIGNATION_NO_START_EVIDENCE", identity: validity.identity };

    case "CONFLICTING_DESIGNATION_START":
      return { kind: "DESIGNATION_START_CONFLICT", identity: validity.identity };

    case "OPEN_UNRESEARCHED":
      return evaluateOpenStart(validity.identity, validity.start, asOfDate);

    case "OPEN_REVIEWED_NO_END_ESTABLISHED":
      return evaluateOpenStart(validity.identity, validity.start, asOfDate);

    case "CLOSED": {
      if (validity.start.kind === "OPEN_OBSERVATION_ASSERTION") {
        // Structurally unreachable: `buildE85DesignationValidity` rejects a
        // CLOSED record whose start authority is OPEN_OBSERVATION_ASSERTION
        // (it carries no effectiveFrom). Guarded here defensively so this
        // module never reads a non-existent `effectiveFrom` off it.
        throw new E85DesignationApplicabilityError(
          `CLOSED designation validity has an OPEN_OBSERVATION_ASSERTION start authority, which is structurally impossible.`,
        );
      }
      const effectiveFrom = validity.start.effectiveFrom;
      const effectiveTo = validity.effectiveTo;
      // A CLOSED record still has a start date like the open dated states,
      // so an AS_OF date preceding effectiveFrom is reported identically as
      // DESIGNATION_NOT_YET_STARTED, not folded into
      // DESIGNATION_OUTSIDE_CLOSED_INTERVAL — that discriminant is reserved
      // for AS_OF dates strictly after the closed interval's own end.
      if (!isAtOrAfter(asOfDate, effectiveFrom)) {
        return { kind: "DESIGNATION_NOT_YET_STARTED", identity: validity.identity, effectiveFrom, asOfDate };
      }
      const withinInterval = isAtOrBefore(asOfDate, effectiveTo);
      return {
        kind: withinInterval ? "DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL" : "DESIGNATION_OUTSIDE_CLOSED_INTERVAL",
        identity: validity.identity,
        effectiveFrom,
        effectiveTo,
        asOfDate,
      };
    }

    case "CONFLICTING_DESIGNATION_END":
      return { kind: "DESIGNATION_END_CONFLICT", identity: validity.identity };

    default: {
      const exhaustiveValidity: never = validity;
      throw new E85DesignationApplicabilityError(`unsupported designation validity state, got ${JSON.stringify(exhaustiveValidity)}.`);
    }
  }
}

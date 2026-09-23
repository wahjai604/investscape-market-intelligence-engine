/**
 * InvestScape™ E85 — Designation/Legal-Text Correspondence-and-Coincidence
 * Pairing Wrapper.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Additive only. This module answers exactly one question: "given (1) an
 * already-computed `E85DesignationLegalTextCorrespondenceResult` (Slice
 * 3H-1, designation-legal-text-identity-correspondence.ts) and (2) an
 * already-computed `E85DesignationLegalTextTemporalCoincidenceResult`
 * (designation-legal-text-temporal-coincidence.ts), what does pairing the two
 * — unchanged — look like as a single value?" It is a pure, deterministic
 * pairing wrapper over the two upstream RESULT types only — nothing more.
 *
 * SCOPE. This module does NOT: recompute identity correspondence or temporal
 * coincidence; inspect raw validity intervals or any
 * `E85DesignationValidity`/`E85VersionValidity` type (neither is imported
 * here — only the two `*Result` types are); calculate interval overlap,
 * containment, or historical continuity; read a machine clock
 * (no machine-clock read of any kind appears in this file); verify that the
 * supplied `correspondence` and `coincidence` results refer to the same
 * underlying designation record, the same legal-text/linkage entry, or the
 * same as-of date (this module has no way to check that — see LIMITATION
 * below); synthesize any overall status, "valid", "linked", "confirmed", or
 * other summary judgment; or short-circuit either input — both are always
 * carried through to the output regardless of their `.kind`.
 *
 * NOT A NEW DECISION. This module produces no `kind` field of its own and no
 * discriminated union. Its output is one flat shape carrying both complete
 * input results unchanged, plus an optional `.limitation` string. Callers
 * that need the underlying decisions read `.correspondence.kind` and
 * `.coincidence.kind` directly — this module never collapses, renames, or
 * reinterprets either.
 *
 * LIMITATION ATTACHMENT. `.limitation` is attached if and only if
 * `correspondence.kind === "IDENTITY_CORRESPONDENCE_ESTABLISHED"` OR
 * `coincidence.kind` is one of `"BOTH_CLOSED_APPLICABLE"`,
 * `"MIXED_CLOSED_AND_OPEN_END_APPLICABLE"`, `"BOTH_OPEN_END_APPLICABLE"` — a
 * single OR-condition over the two inputs' own `.kind` values, and nothing
 * else. See `PAIRING_LIMITATION` below for the full text.
 *
 * ASOF. `coincidence.asOf` remains the only date value carried by the pair —
 * this module adds no separate top-level `asOf` field.
 *
 * No machine clock is read anywhere in this file. No range overlap,
 * containment, or historical continuity is computed anywhere. No file in
 * this module is mutated, and none of its inputs are mutated.
 */
import type { E85DesignationLegalTextCorrespondenceResult } from "./designation-legal-text-identity-correspondence";
import type { E85DesignationLegalTextTemporalCoincidenceResult } from "./designation-legal-text-temporal-coincidence";

/**
 * The shared limitation text carried when either input signals a positive
 * outcome (established identity correspondence, or positive temporal
 * co-incidence). Modeled on the house style already established by
 * `IDENTITY_CORRESPONDENCE_ESTABLISHED.limitation`
 * (designation-legal-text-identity-correspondence.ts) and
 * `POSITIVE_COINCIDENCE_LIMITATION`
 * (designation-legal-text-temporal-coincidence.ts). Deliberately does NOT
 * contradict a positive `IDENTITY_CORRESPONDENCE_ESTABLISHED` result: when
 * identity correspondence is present in the supplied `correspondence`
 * result, it IS present — this text only declines to vouch for whether the
 * supplied `correspondence` and `coincidence` results describe the same
 * underlying records.
 */
const PAIRING_LIMITATION =
  "This means ONLY that the supplied identity-correspondence result and the supplied temporal-coincidence result have been paired " +
  "together unchanged. This wrapper cannot verify that both supplied results refer to the same designation record, the same " +
  "legal-text/linkage entry, or the same as-of date — that is solely the calling code's responsibility, not something this module " +
  "checks. Even a supplied identity-correspondence-established result together with a positive temporal co-incidence result does NOT " +
  "establish legal effect; does NOT establish enactment; does NOT establish property-specific applicability; does NOT establish " +
  "historical continuity; does NOT authorize rule-pack application; and does NOT constitute a final zoning or planning determination. " +
  "If the supplied `correspondence` result is IDENTITY_CORRESPONDENCE_ESTABLISHED, that positive result stands as reported by its own " +
  "evaluator and is not being contradicted here — this text only declines to vouch for whether that result and the supplied " +
  "`coincidence` result are consistent with one another.";

const POSITIVE_COINCIDENCE_KINDS: readonly E85DesignationLegalTextTemporalCoincidenceResult["kind"][] = [
  "BOTH_CLOSED_APPLICABLE",
  "MIXED_CLOSED_AND_OPEN_END_APPLICABLE",
  "BOTH_OPEN_END_APPLICABLE",
];

/**
 * Flat pairing of a Slice 3H-1 identity-correspondence result and a
 * temporal-coincidence result. Not a discriminated union: it carries no
 * `kind` field of its own, and no synthesized status/"valid"/"linked"/
 * "confirmed" judgment of any kind. Both nested results are preserved
 * unchanged, by reference, from the caller's own input.
 */
export interface E85DesignationLegalTextCorrespondenceAndCoincidenceResult {
  readonly correspondence: E85DesignationLegalTextCorrespondenceResult;
  readonly coincidence: E85DesignationLegalTextTemporalCoincidenceResult;
  readonly limitation?: string;
}

/**
 * Pairs an already-computed Slice 3H-1 identity-correspondence result with
 * an already-computed temporal-coincidence result into a single flat value.
 * Pure and deterministic: the same two inputs always yield a deeply-equal
 * result. Neither input (nor any nested object within it) is mutated, and
 * both are carried through to the output unchanged regardless of their own
 * `.kind` — this function never short-circuits on either input.
 *
 * `.limitation` is attached under exactly one OR-condition — see the module
 * doc's LIMITATION ATTACHMENT section — and no other branching exists here.
 */
export function pairE85DesignationLegalTextCorrespondenceAndCoincidence(
  correspondence: E85DesignationLegalTextCorrespondenceResult,
  coincidence: E85DesignationLegalTextTemporalCoincidenceResult,
): E85DesignationLegalTextCorrespondenceAndCoincidenceResult {
  const attachLimitation =
    correspondence.kind === "IDENTITY_CORRESPONDENCE_ESTABLISHED" || POSITIVE_COINCIDENCE_KINDS.includes(coincidence.kind);

  if (attachLimitation) {
    return { correspondence, coincidence, limitation: PAIRING_LIMITATION };
  }

  return { correspondence, coincidence };
}

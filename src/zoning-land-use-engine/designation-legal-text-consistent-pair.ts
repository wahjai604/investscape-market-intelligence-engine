/**
 * InvestScape™ E85 — Designation/Legal-Text Consistent-Pair Orchestrator.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Additive only. This module answers exactly one question: "given one
 * already-built, already-validated input bundle (a designation validity, a
 * version validity, a legal-text identity, a linkage identity, and a
 * resolved temporal request), what do the five existing, frozen E85
 * evaluators/wrapper report when threaded through that single bundle?" It is
 * a pure orchestration module — it performs no construction of validity or
 * identity objects, no raw date/interval comparison, and no lookup of its
 * own. It only calls the five existing functions and branches on
 * `resolvedRequest.kind`/`.mode`.
 *
 * SCOPE. This module does NOT: build/validate any of its own inputs (the
 * caller must already have used `buildE85DesignationValidity`,
 * `buildE85VersionValidity`, `resolveE85TemporalRequest`, and whatever
 * constructs `E85LegalTextIdentityInput`/`E85LegalIdentity`); recompute
 * applicability, identity correspondence, or temporal coincidence itself
 * (all five calls are delegated, unmodified, to the existing evaluators);
 * synthesize any overall `kind`/status/"valid"/"linked"/authorization field;
 * or establish legal effect, enactment, property-specific applicability,
 * historical continuity, rule-pack authorization, or a final zoning/planning
 * determination.
 *
 * DECISION A — NO SHORT-CIRCUIT ON CORRESPONDENCE MISMATCH. `designation`,
 * `legalText`, and `correspondence` are always computed. When an explicit
 * AS_OF date is present, `coincidence` and `pair` are ALSO always computed —
 * regardless of what `correspondence.kind` turned out to be, even a mismatch
 * kind. This module never suppresses or skips the temporal calls based on
 * the identity-correspondence outcome.
 *
 * DECISION B — NO INVENTED DATE WHEN AS_OF IS ABSENT. An `asOfDate` is
 * extracted only when `resolvedRequest.kind === "RESOLVED" &&
 * resolvedRequest.request.mode === "AS_OF"`. When the resolved request is
 * `ABSENT` or `CURRENT`, this module never calls
 * `evaluateE85DesignationLegalTextTemporalCoincidence` or
 * `pairE85DesignationLegalTextCorrespondenceAndCoincidence`, never
 * substitutes `Date.now()`, a machine date, the string `"unknown"`, or any
 * other fabricated/placeholder date — `coincidence` and `pair` are simply
 * omitted (undefined, optional fields), never null-filled or error-valued.
 *
 * `limitation` IS ALWAYS PRESENT (unlike the pairing wrapper's own optional
 * `.limitation`) — see `BASE_LIMITATION`/`TEMPORAL_OMITTED_ADDENDUM` below.
 * Following this codebase's existing precedent for conditional disclaimers
 * (e.g. `designation-legal-text-temporal-coincidence.ts`'s `NOT_EVALUABLE`
 * variant, which carries no `.limitation` at all because nothing positive
 * was established), this module instead always attaches a base limitation
 * (module-own-consistency-only, cannot-verify-real-world-assembly, and the
 * full non-claims list), and appends a second, distinct sentence ONLY when
 * `coincidence`/`pair` were omitted, explaining that omission was due to the
 * absence of an explicit AS_OF date — never an error. This mirrors the
 * "second sentence appended conditionally" style already used by
 * `pairE85DesignationLegalTextCorrespondenceAndCoincidence`'s
 * `PAIRING_LIMITATION`, which appends its own non-contradiction clause onto
 * one shared base text.
 *
 * No machine clock is read anywhere in this file. No raw validity/interval
 * inspection is performed here — all five date/interval comparisons live
 * exclusively inside the five called evaluators. No file in this module is
 * mutated, and none of its inputs are mutated.
 */
import { evaluateE85DesignationApplicability, type E85DesignationApplicabilityResult } from "./designation-applicability";
import { evaluateE85LegalTextApplicability, type E85LegalTextApplicabilityResult } from "./legal-text-applicability";
import {
  evaluateE85DesignationLegalTextIdentityCorrespondence,
  type E85DesignationLegalTextCorrespondenceResult,
  type E85LegalTextIdentityInput,
  type E85LegalIdentity,
} from "./designation-legal-text-identity-correspondence";
import {
  evaluateE85DesignationLegalTextTemporalCoincidence,
  type E85DesignationLegalTextTemporalCoincidenceResult,
} from "./designation-legal-text-temporal-coincidence";
import {
  pairE85DesignationLegalTextCorrespondenceAndCoincidence,
  type E85DesignationLegalTextCorrespondenceAndCoincidenceResult,
} from "./designation-legal-text-correspondence-and-coincidence";
import type { E85DesignationValidity } from "./designation-validity-types";
import type { E85VersionValidity } from "./version-validity-types";
import type { E85ResolvedTemporalRequest } from "./temporal-request-types";

/**
 * The base limitation text attached to every result, regardless of whether
 * an AS_OF date was present. States the two universal facts: (1) using one
 * shared input bundle guarantees consistency among THIS FUNCTION's own
 * calls only — a mechanical, construction-guaranteed fact about its own
 * invocation, nothing more; (2) this module cannot verify that the caller
 * originally assembled the designation, legal-text, linkage, validity, or
 * date values from the same real-world records — that is entirely outside
 * this module's reach; plus the full non-claims list already established by
 * the house style (`IDENTITY_CORRESPONDENCE_ESTABLISHED.limitation`,
 * `POSITIVE_COVERAGE_LIMITATION`, `POSITIVE_COINCIDENCE_LIMITATION`,
 * `PAIRING_LIMITATION`).
 */
const BASE_LIMITATION =
  "This means ONLY that this orchestrator threaded one shared, already-validated input bundle through its own designation, legal-text, " +
  "identity-correspondence, and (when an explicit AS_OF date was supplied) temporal-coincidence and pairing calls — a mechanical, " +
  "construction-guaranteed fact about consistency among THIS FUNCTION's own invocations, and nothing more. It cannot and does not verify " +
  "that the caller originally assembled the designation validity, legal-text identity, linkage identity, version validity, or resolved " +
  "temporal request from the same real-world records — that is entirely outside this module's reach. Neither a correspondence match " +
  "(IDENTITY_CORRESPONDENCE_ESTABLISHED) nor point-in-time co-incidence establishes legal effect; it does NOT establish enactment; it does " +
  "NOT establish property-specific applicability; it does NOT establish historical continuity; it does NOT authorize rule-pack " +
  "application; and it does NOT constitute a final zoning or planning determination.";

/**
 * Appended, as a second sentence, only when `coincidence`/`pair` were
 * omitted because the resolved temporal request carried no explicit AS_OF
 * date (ABSENT or CURRENT mode) — never appended for any error condition,
 * since none exists on this path.
 */
const TEMPORAL_OMITTED_ADDENDUM =
  " Temporal-coincidence and pairing results were NOT computed for this call because the supplied resolved temporal request carried no " +
  "explicit AS_OF date (it was ABSENT or CURRENT) — this omission reflects the absence of a concrete date to evaluate against, not any " +
  "error or failure.";

/**
 * Already-built, already-validated typed input bundle. No raw/unknown
 * payloads, no builder calls inside this module, no casts.
 */
export interface E85DesignationLegalTextConsistentPairInput {
  readonly designationValidity: E85DesignationValidity;
  readonly versionValidity: E85VersionValidity;
  readonly legalTextIdentity: E85LegalTextIdentityInput;
  readonly linkageIdentity: E85LegalIdentity;
  readonly resolvedRequest: E85ResolvedTemporalRequest;
}

/**
 * The orchestrated result. All present sub-results are the literal,
 * unmutated, unmodified return values of the underlying evaluator calls — no
 * field is picked, renamed, or normalized. `coincidence`/`pair` are optional
 * and are present if and only if an explicit AS_OF date was supplied (see
 * Decision B in the module doc). `limitation` is always present.
 */
export interface E85DesignationLegalTextConsistentPairResult {
  readonly designation: E85DesignationApplicabilityResult;
  readonly legalText: E85LegalTextApplicabilityResult;
  readonly correspondence: E85DesignationLegalTextCorrespondenceResult;
  readonly coincidence?: E85DesignationLegalTextTemporalCoincidenceResult;
  readonly pair?: E85DesignationLegalTextCorrespondenceAndCoincidenceResult;
  readonly limitation: string;
}

/**
 * Orchestrates the five existing, frozen E85 evaluators/wrapper over one
 * shared, already-validated input bundle. Pure and deterministic: the same
 * input always yields a deeply-equal result (the same five/three underlying
 * calls always yield deeply-equal results for the same inputs). Neither
 * `input` nor any nested object within it is mutated.
 *
 * Always calls, in order: `evaluateE85DesignationApplicability`,
 * `evaluateE85LegalTextApplicability` (reusing the literal same
 * `input.resolvedRequest` object reference passed to the designation call —
 * no clone/reconstruct), and
 * `evaluateE85DesignationLegalTextIdentityCorrespondence`. When
 * `input.resolvedRequest` resolves to an explicit AS_OF date, additionally
 * always calls `evaluateE85DesignationLegalTextTemporalCoincidence` and
 * `pairE85DesignationLegalTextCorrespondenceAndCoincidence` — unconditionally,
 * even when `correspondence.kind` is a mismatch kind (Decision A). When no
 * explicit AS_OF date is present (ABSENT or CURRENT), neither temporal call
 * is made and `coincidence`/`pair` are omitted from the result (Decision B).
 */
export function evaluateE85DesignationLegalTextConsistentPair(
  input: E85DesignationLegalTextConsistentPairInput,
): E85DesignationLegalTextConsistentPairResult {
  const { designationValidity, versionValidity, legalTextIdentity, linkageIdentity, resolvedRequest } = input;

  const designation = evaluateE85DesignationApplicability(designationValidity, resolvedRequest);
  const legalText = evaluateE85LegalTextApplicability(versionValidity, resolvedRequest);
  const correspondence = evaluateE85DesignationLegalTextIdentityCorrespondence(designation, legalTextIdentity, linkageIdentity);

  if (resolvedRequest.kind === "RESOLVED" && resolvedRequest.request.mode === "AS_OF") {
    const asOfDate = resolvedRequest.request.asOfDate;
    const coincidence = evaluateE85DesignationLegalTextTemporalCoincidence(designation, legalText, asOfDate);
    const pair = pairE85DesignationLegalTextCorrespondenceAndCoincidence(correspondence, coincidence);
    return { designation, legalText, correspondence, coincidence, pair, limitation: BASE_LIMITATION };
  }

  return { designation, legalText, correspondence, limitation: BASE_LIMITATION + TEMPORAL_OMITTED_ADDENDUM };
}

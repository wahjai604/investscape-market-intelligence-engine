/**
 * InvestScape™ E85 Phase 15.8 — Temporal Candidate Adapter, Slice 3C.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Additive only. This module is the sole boundary between the Slice 3B
 * `E85VersionValidity` contract (version-validity-types.ts) and the Slice 2
 * `E85TemporalCandidate` contract (temporal-selection.ts). It converts one
 * `E85NormalizedRuleBundle` plus one `E85VersionValidity` into exactly one
 * `E85TemporalCandidateAdapterResult` — either a selector-eligible
 * `E85TemporalCandidate`, preserved-but-non-selector-eligible temporal
 * evidence, or a typed evidentiary rejection.
 *
 * CORE SAFETY RULE. `selectE85TemporalCandidate` (temporal-selection.ts)
 * treats a candidate's `effectiveTo === undefined` as "no upper applicability
 * bound" — it will happily select an open candidate for an arbitrarily
 * distant future AS_OF date, because it has no way to distinguish "end not
 * researched" from "unlimited validity". A qualification stored beside such a
 * candidate cannot repair that after the fact: the selector never sees
 * anything but `E85TemporalCandidate`. Consequently only the `CLOSED`
 * `E85VersionValidity` state — where both endpoints are legally proven —
 * ever produces a value typed `E85TemporalCandidate` here. Every other state
 * returns a result branch that is structurally incapable of being mistaken
 * for one; this is enforced by the shape of `E85TemporalCandidateAdapterResult`
 * itself, not by caller convention.
 *
 * Nothing here is wired into registries, source adapters, real fixtures,
 * legal linkage, spatial modules, rule-pack composition, evaluators, decision
 * packages, gaps/blockers/materiality/status vocabulary, or request
 * normalization — that wiring is explicitly out of scope for Slice 3C.
 * `temporal-selection.ts` is imported only for its `E85TemporalCandidate`
 * type and is never modified or invoked.
 *
 * Design carried over unchanged from Slice 2/Slice 3B: no machine clock, no
 * randomness, and no I/O anywhere in this file.
 */
import type { E85NormalizedRuleBundle } from "./normalized-bundle-types";
import type { E85EffectiveDateBasis } from "./evidence-types";
import type { E85TemporalCandidate } from "./temporal-selection";
import {
  buildE85VersionValidity,
  E85VersionValidityError,
} from "./version-validity-types";
import type {
  E85VersionValidity,
  E85StartAuthority,
  E85EndAuthority,
} from "./version-validity-types";

/**
 * Preserved evidence for `OPEN_UNRESEARCHED`: a known start with no research
 * yet performed on whether/when it ends. Deliberately carries no
 * `effectiveTo` — inventing one would manufacture an applicability claim no
 * evidence supports.
 */
export interface E85OpenUnresearchedEvidence {
  readonly effectiveFrom: string;
  readonly start: E85StartAuthority;
}

/**
 * Preserved evidence for `OPEN_REVIEWED_NO_END_ESTABLISHED`: a known start
 * plus proof that a bounded review was performed and found no qualifying
 * end. `reviewedAt` is a research cutoff, never repurposed as `effectiveTo` —
 * it proves nothing about operative status after that date.
 */
export interface E85ReviewedNoEndEvidence {
  readonly effectiveFrom: string;
  readonly start: E85StartAuthority;
  readonly reviewedAt: string;
  readonly sourcesChecked: readonly string[];
}

/**
 * Closed, exhaustive adapter result vocabulary. Structural safety property:
 * ONLY the `CANDIDATE` branch contains a field typed `E85TemporalCandidate`.
 * Every other branch's shape is not assignable to `E85TemporalCandidate`, so
 * it cannot reach `selectE85TemporalCandidate` by accident — the type system
 * enforces this, not a runtime check or a caller's discipline.
 */
export type E85TemporalCandidateAdapterResult =
  | {
      readonly outcome: "CANDIDATE";
      readonly candidateId: string;
      readonly candidate: E85TemporalCandidate;
      readonly bundle: E85NormalizedRuleBundle;
      readonly validity: E85VersionValidity;
    }
  | {
      readonly outcome: "OPEN_END_UNRESEARCHED";
      readonly candidateId: string;
      readonly bundle: E85NormalizedRuleBundle;
      readonly validity: E85VersionValidity;
      readonly evidence: E85OpenUnresearchedEvidence;
    }
  | {
      readonly outcome: "OPEN_END_REVIEWED_NO_END_ESTABLISHED";
      readonly candidateId: string;
      readonly bundle: E85NormalizedRuleBundle;
      readonly validity: E85VersionValidity;
      readonly evidence: E85ReviewedNoEndEvidence;
    }
  | {
      readonly outcome: "START_UNKNOWN";
      readonly candidateId: string;
      readonly bundle: E85NormalizedRuleBundle;
    }
  | {
      readonly outcome: "CONFLICTING_START";
      readonly candidateId: string;
      readonly bundle: E85NormalizedRuleBundle;
      readonly conflictingStartAssertions: readonly E85StartAuthority[];
    }
  | {
      readonly outcome: "CONFLICTING_END";
      readonly candidateId: string;
      readonly bundle: E85NormalizedRuleBundle;
      readonly validity: E85VersionValidity;
      readonly conflictingEndAssertions: readonly E85EndAuthority[];
    }
  | {
      readonly outcome: "PARTIAL_TERMINATION";
      readonly candidateId: string;
      readonly bundle: E85NormalizedRuleBundle;
      readonly validity: E85VersionValidity;
      readonly description: string;
    };

/**
 * Deterministic, reproducible error raised for programmer/configuration
 * defects at this adapter's boundary — a malformed bundle, an empty/
 * whitespace identity component, or a `validity` value that fails
 * revalidation. Never carries wall-clock time, object identity, or any other
 * nondeterministic content. Never thrown for an ordinary legal-evidence
 * outcome — those are always typed results (see
 * `E85TemporalCandidateAdapterResult`).
 */
export class E85TemporalCandidateAdapterError extends Error {
  constructor(message: string) {
    super(`E85 temporal candidate adapter error: ${message}`);
    this.name = "E85TemporalCandidateAdapterError";
  }
}

function requireNonEmptyIdentityComponent(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new E85TemporalCandidateAdapterError(`bundle.${fieldName} must be a non-empty string, got ${JSON.stringify(value)}.`);
  }
  return value;
}

/**
 * Defensive identity validation. `E85NormalizedRuleBundle`'s identity fields
 * carry no runtime grammar anywhere in this codebase (`sourceVersionId` and
 * `zoneDesignation` are free text by design; `jurisdictionId` likewise), so
 * this adapter checks only non-empty-after-trim — the one property its own
 * candidate-ID injectivity proof (see `buildCandidateId`) actually depends
 * on. It deliberately does NOT import `isValidE85SourceId`
 * (source-registry-types.ts): that grammar belongs to the registry layer,
 * which Slice 3C must not depend on, and this adapter's injectivity does not
 * rely on `sourceId` having any particular shape — every component is
 * escaped uniformly instead (see `buildCandidateId`).
 */
function validateBundleIdentity(bundle: E85NormalizedRuleBundle): void {
  if (bundle === null || typeof bundle !== "object") {
    throw new E85TemporalCandidateAdapterError(`bundle must be an object, got ${JSON.stringify(bundle)}.`);
  }
  requireNonEmptyIdentityComponent(bundle.jurisdictionId, "jurisdictionId");
  requireNonEmptyIdentityComponent(bundle.sourceId, "sourceId");
  requireNonEmptyIdentityComponent(bundle.sourceVersionId, "sourceVersionId");
  requireNonEmptyIdentityComponent(bundle.zoneDesignation, "zoneDesignation");
}

/**
 * Escapes the two characters the serialization below relies on: `%` (the
 * escape character itself) first, then `@` (the component separator).
 * Applied uniformly to all four identity components — including `sourceId`,
 * which happens to be grammar-constrained elsewhere in this codebase but is
 * not verified as `@`-free HERE (this adapter does not import that grammar,
 * see `validateBundleIdentity`) — so injectivity never depends on an
 * unenforced external constraint. Order matters: escaping `%` first ensures
 * a literal `%40` in the input is distinguishable from an escaped `@`.
 */
function escapeIdentityComponent(value: string): string {
  return value.replace(/%/g, "%25").replace(/@/g, "%40");
}

/**
 * Candidate identity for a district-specific legal version: the tuple
 * (jurisdictionId, sourceId, sourceVersionId, zoneDesignation), each
 * component escaped and joined with `@`. This closes the collision a bare
 * `sourceId@sourceVersionId` scheme would have (proven possible: multiple
 * normalized bundles can share one source version, e.g. across zones), and
 * is deliberately NOT `e85RulePackIdFromSource`'s scheme
 * (composition-types.ts) — that identity's uniqueness domain excludes
 * `zoneDesignation` by design (one instrument may compositionally govern
 * multiple zones), which is exactly the wrong domain for temporal candidate
 * identity. No decoder is provided or needed: the original `bundle` is
 * always returned alongside `candidateId` in every result branch.
 */
function buildCandidateId(bundle: E85NormalizedRuleBundle): string {
  return [bundle.jurisdictionId, bundle.sourceId, bundle.sourceVersionId, bundle.zoneDesignation].map(escapeIdentityComponent).join("@");
}

/**
 * Defensively re-runs the supplied `validity` through `buildE85VersionValidity`
 * rather than trusting the static `E85VersionValidity` type. A value merely
 * typed `E85VersionValidity` (e.g. arrived via an unsafe cast or a JSON
 * boundary) is not guaranteed to have actually passed Slice 3B's own
 * validation. `buildE85VersionValidity` is pure and idempotent, so
 * revalidating an already-valid object is cheap and side-effect-free.
 */
function revalidate(validity: E85VersionValidity): E85VersionValidity {
  try {
    return buildE85VersionValidity(validity);
  } catch (error) {
    if (error instanceof E85VersionValidityError) {
      throw new E85TemporalCandidateAdapterError(`supplied validity failed revalidation: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Conservative basis derivation for `CLOSED`. `E85TemporalWindow` has one
 * `effectiveDateBasis` field for the whole interval, but `E85VersionValidity`
 * proves each endpoint independently with its own basis. Blindly propagating
 * the start's basis would be selection-corrupting, not merely a disclosure
 * loss: `selectE85TemporalCandidate`'s `hasCanonicalDayPrecision` gate reads
 * only the window's single basis field, so an end date proven with a weaker
 * (or `"UNKNOWN"`) basis could be silently treated as fully attested. This
 * function instead demotes to `"UNKNOWN"` whenever the two bases differ or
 * either is `"UNKNOWN"` — erring toward EXCLUDING the candidate from the
 * selector's "known" bucket rather than ever overstating its evidentiary
 * strength. This is safe specifically because `CLOSED` intervals are already
 * bounded on both ends: demotion changes whether the interval is trusted for
 * comparison, never how wide it appears. Nothing is lost at the result level
 * — the full `validity` (with both untouched original bases) is always
 * returned alongside the derived candidate.
 */
function deriveClosedBasis(start: E85StartAuthority, end: E85EndAuthority): E85EffectiveDateBasis {
  return start.effectiveDateBasis === end.effectiveDateBasis && start.effectiveDateBasis !== "UNKNOWN" ? start.effectiveDateBasis : "UNKNOWN";
}

/**
 * Converts one `E85NormalizedRuleBundle` plus one `E85VersionValidity` into
 * exactly one `E85TemporalCandidateAdapterResult`. Pure and deterministic:
 * the same two inputs always yield a deeply-equal result or throw the same
 * `E85TemporalCandidateAdapterError`. Neither `bundle` nor `validity` (nor
 * any nested array/object within them) is mutated.
 */
export function buildE85TemporalCandidateFromVersionValidity(
  bundle: E85NormalizedRuleBundle,
  validity: E85VersionValidity,
): E85TemporalCandidateAdapterResult {
  validateBundleIdentity(bundle);
  const validated = revalidate(validity);
  const candidateId = buildCandidateId(bundle);

  switch (validated.state) {
    case "START_UNKNOWN":
      return { outcome: "START_UNKNOWN", candidateId, bundle };

    case "CONFLICTING_START":
      return {
        outcome: "CONFLICTING_START",
        candidateId,
        bundle,
        conflictingStartAssertions: validated.conflictingStartAssertions,
      };

    case "OPEN_UNRESEARCHED":
      return {
        outcome: "OPEN_END_UNRESEARCHED",
        candidateId,
        bundle,
        validity: validated,
        evidence: { effectiveFrom: validated.effectiveFrom, start: validated.start },
      };

    case "OPEN_REVIEWED_NO_END_ESTABLISHED":
      return {
        outcome: "OPEN_END_REVIEWED_NO_END_ESTABLISHED",
        candidateId,
        bundle,
        validity: validated,
        evidence: {
          effectiveFrom: validated.effectiveFrom,
          start: validated.start,
          reviewedAt: validated.endReview.reviewedAt,
          sourcesChecked: validated.endReview.sourcesChecked,
        },
      };

    case "CLOSED": {
      const basis = deriveClosedBasis(validated.start, validated.end);
      const candidate: E85TemporalCandidate = {
        candidateId,
        temporal: {
          effectiveFrom: validated.effectiveFrom,
          effectiveTo: validated.effectiveTo,
          effectiveDateBasis: basis,
        },
      };
      return { outcome: "CANDIDATE", candidateId, candidate, bundle, validity: validated };
    }

    case "CONFLICTING_END":
      return {
        outcome: "CONFLICTING_END",
        candidateId,
        bundle,
        validity: validated,
        conflictingEndAssertions: validated.conflictingEndAssertions,
      };

    case "CONDITIONAL_PARTIAL_TERMINATION":
      return {
        outcome: "PARTIAL_TERMINATION",
        candidateId,
        bundle,
        validity: validated,
        description: validated.description,
      };

    default: {
      const exhaustive: never = validated;
      throw new E85TemporalCandidateAdapterError(`unsupported version validity state, got ${JSON.stringify(exhaustive)}.`);
    }
  }
}

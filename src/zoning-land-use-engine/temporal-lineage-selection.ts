/**
 * InvestScape™ E85 Phase 15.12 — Temporal Lineage Selection Invocation, Slice 3D-3.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Additive only. This module is the thin orchestration boundary between
 * Slice 3D-1's `E85TemporalLineageGroupingResult` (temporal-lineage-
 * grouping.ts) and Slice 2's `selectE85TemporalCandidate`
 * (temporal-selection.ts): for each already-grouped lineage, it invokes the
 * selector exactly when — and only when — the lineage is `GROUP_READY`, and
 * otherwise reports that the lineage was never selector-eligible.
 *
 * SCOPE. This module consumes a complete `E85TemporalLineageGroupingResult`
 * and an already-resolved `E85ResolvedTemporalRequest`. It does NOT normalize
 * raw temporal request input (Slice 1), regroup raw lineage members
 * (Slice 3D-1), inspect raw version-validity records (Slice 3B), infer
 * source-version relationships (Slice 3D-2, deferred), or map results into
 * gaps, status, materiality, blockers, traces, completeness, or decision
 * packages (Slice 3E/3F, unstarted). Nothing here is wired into the
 * evaluator, composer, legal linkage, decision orchestrator, or decision
 * packages, and no real jurisdiction/source is migrated by this slice.
 *
 * CORE SAFETY RULE, carried over from Slice 3D-1's own core safety invariant:
 * only `GROUP_READY` ever exposes `selectorEligibleMembers`, and this module
 * calls `selectE85TemporalCandidate` for that branch alone. The other three
 * group kinds — `GROUP_BLOCKED`, `GROUP_EVIDENCE_INCOMPLETE`,
 * `GROUP_NO_CANDIDATE` — never reach the selector; this module reports them
 * as `LINEAGE_NOT_SELECTOR_ELIGIBLE` and retains their original group object
 * by reference, unmodified.
 *
 * REQUEST SEMANTICS. The same resolved request is passed to the selector
 * unchanged for every `GROUP_READY` lineage, whether it is ABSENT, CURRENT,
 * or AS_OF. This module never inspects `request.kind` / `request.request.mode`
 * to short-circuit, resolve CURRENT to a concrete date, choose a "latest"
 * candidate, or otherwise second-guess the selector's own deterministic
 * behavior. ABSENT and CURRENT therefore continue to produce the selector's
 * existing deterministic `INSUFFICIENT_TEMPORAL_EVIDENCE` result, unchanged.
 * No machine clock is read anywhere in this file.
 *
 * Design carried over unchanged from Slices 1-3D-1: no machine clock, no
 * randomness, no I/O, and no mutation of caller-supplied values anywhere in
 * this file.
 */
import type {
  E85TemporalLineageGroup,
  E85TemporalLineageGroupingResult,
} from "./temporal-lineage-grouping";
import type { E85ResolvedTemporalRequest } from "./temporal-request-types";
import type { E85TemporalCandidate, E85TemporalSelectionResult } from "./temporal-selection";
import { selectE85TemporalCandidate } from "./temporal-selection";
import type { E85TemporalCandidateAdapterResult } from "./temporal-candidate-adapter";

/**
 * A `GROUP_READY` group, extracted from the closed four-way
 * `E85TemporalLineageGroup` union by its discriminant. This is the only
 * group shape a `LINEAGE_SELECTION_EVALUATED` outcome may carry.
 */
type E85GroupReady = Extract<E85TemporalLineageGroup, { readonly kind: "GROUP_READY" }>;

/**
 * The three non-ready group shapes, i.e. every `E85TemporalLineageGroup`
 * variant except `GROUP_READY`. This is the only group shape a
 * `LINEAGE_NOT_SELECTOR_ELIGIBLE` outcome may carry.
 */
type E85GroupNotReady = Exclude<E85TemporalLineageGroup, { readonly kind: "GROUP_READY" }>;

/**
 * A `GROUP_READY` lineage that was actually submitted to
 * `selectE85TemporalCandidate`. `group` is retained by reference from the
 * input grouping result — never cloned, flattened, or duplicated — so every
 * upstream field (`members`, `nonCandidateMembers`, `collisionFindings`,
 * `selectorEligibleMembers`) remains reachable exactly as Slice 3D-1
 * produced it. `selectorResult` is the selector's own, unmodified return
 * value. This is the ONLY branch of `E85TemporalLineageSelectionOutcome`
 * that may carry a `selectorResult`.
 */
export interface E85TemporalLineageSelectionEvaluated {
  readonly kind: "LINEAGE_SELECTION_EVALUATED";
  readonly lineageId: string;
  readonly group: E85GroupReady;
  readonly selectorResult: E85TemporalSelectionResult;
}

/**
 * A lineage that was never selector-eligible — its group was `GROUP_BLOCKED`,
 * `GROUP_EVIDENCE_INCOMPLETE`, or `GROUP_NO_CANDIDATE`. `group` is retained
 * by reference from the input grouping result. This branch's type
 * deliberately does not declare `selectorResult`, `selectedCandidateId`, or
 * `candidateIdsConsidered` — there is no field to omit at runtime because the
 * shape itself has none, mirroring how Slice 3D-1's own `GROUP_READY` /
 * non-`GROUP_READY` split is enforced by shape rather than convention.
 */
export interface E85TemporalLineageNotSelectorEligible {
  readonly kind: "LINEAGE_NOT_SELECTOR_ELIGIBLE";
  readonly lineageId: string;
  readonly group: E85GroupNotReady;
}

/**
 * Closed, two-branch, mutually exclusive per-lineage outcome. Structurally
 * exclusive: only `LINEAGE_SELECTION_EVALUATED` can carry a
 * `selectorResult`, and only it can carry a `GROUP_READY` group — the other
 * branch's `group` type excludes `GROUP_READY` entirely.
 */
export type E85TemporalLineageSelectionOutcome = E85TemporalLineageSelectionEvaluated | E85TemporalLineageNotSelectorEligible;

/**
 * The aggregate result of `selectE85TemporalLineages`: one outcome per
 * lineage from the input grouping result, in the same deterministic order
 * `groupE85TemporalLineageMembers` already produced (sorted by `lineageId`
 * ascending) — this module never re-sorts. A bare readonly-array-shaped
 * wrapper is used, rather than a richer object with a summary/count/status
 * field, because this slice deliberately produces nothing beyond the
 * per-lineage routing/pass-through decision itself: no gap, status,
 * materiality, or decision-package vocabulary belongs here (that is Slice
 * 3E/3F, both unstarted). This mirrors `E85TemporalLineageGroupingResult`'s
 * own `groups` field shape one level up.
 */
export interface E85TemporalLineageSelectionResult {
  readonly outcomes: readonly E85TemporalLineageSelectionOutcome[];
}

/**
 * Deterministic, reproducible error for malformed/configuration input at
 * this module's own orchestration boundary — see the eight conditions
 * checked by `validateBoundary` below. Never thrown for a legitimate
 * `E85TemporalSelectionResult` (including `INSUFFICIENT_TEMPORAL_EVIDENCE`
 * or `CONFLICTING_TEMPORAL_EVIDENCE`) — those are always returned, never
 * converted into an exception. A genuine exception thrown by
 * `selectE85TemporalCandidate` itself is never caught here; it propagates
 * unmodified to the caller.
 */
export class E85TemporalLineageSelectionError extends Error {
  constructor(message: string) {
    super(`E85 temporal lineage selection error: ${message}`);
    this.name = "E85TemporalLineageSelectionError";
  }
}

const SUPPORTED_GROUP_KINDS: readonly string[] = ["GROUP_READY", "GROUP_BLOCKED", "GROUP_EVIDENCE_INCOMPLETE", "GROUP_NO_CANDIDATE"];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Narrows one `selectorEligibleMembers` entry's `adapterResult` to the
 * `CANDIDATE` outcome via a genuine TypeScript type guard (never an unsafe
 * cast or `any`). Slice 3D-1's own builder guarantees every entry in
 * `selectorEligibleMembers` has `outcome === "CANDIDATE"` — but that
 * guarantee is a runtime property of the real builder, not something the
 * static type of `E85TemporalLineageMember.adapterResult` can express (its
 * `adapterResult` is typed as the full seven-outcome
 * `E85TemporalCandidateAdapterResult` union). This function is the explicit
 * runtime check that recovers narrowing at this public boundary.
 */
function isCandidateOutcome(
  adapterResult: E85TemporalCandidateAdapterResult,
): adapterResult is Extract<E85TemporalCandidateAdapterResult, { readonly outcome: "CANDIDATE" }> {
  return adapterResult.outcome === "CANDIDATE";
}

/**
 * Validates the resolved request shape at this module's own boundary. Only
 * the shape is checked here — `resolveE85TemporalRequest` (Slice 1) owns
 * full request normalization, and this function does not reimplement it.
 */
function validateResolvedRequest(request: E85ResolvedTemporalRequest): void {
  if (request === null || typeof request !== "object") {
    throw new E85TemporalLineageSelectionError(`request must be an object, got ${JSON.stringify(request)}.`);
  }
  const r = request as unknown as Record<string, unknown>;
  if (r.kind === "ABSENT") {
    return;
  }
  if (r.kind === "RESOLVED") {
    const inner = r.request as unknown;
    if (inner === null || typeof inner !== "object") {
      throw new E85TemporalLineageSelectionError(`request.request must be an object, got ${JSON.stringify(inner)}.`);
    }
    const mode = (inner as Record<string, unknown>).mode;
    if (mode !== "CURRENT" && mode !== "AS_OF") {
      throw new E85TemporalLineageSelectionError(`request.request.mode must be "CURRENT" or "AS_OF", got ${JSON.stringify(mode)}.`);
    }
    return;
  }
  throw new E85TemporalLineageSelectionError(`request.kind must be "ABSENT" or "RESOLVED", got ${JSON.stringify(r.kind)}.`);
}

/**
 * Validates a single group at this module's own boundary: a supported group
 * kind, a usable `lineageId`, and — for `GROUP_READY` only — a non-empty
 * `selectorEligibleMembers` array whose every entry is genuinely a
 * `CANDIDATE`-outcome member actually carrying its `candidate` object.
 * Everything else about the group (member validity, collision findings,
 * canonicalization) is Slice 3D-1's own responsibility and is trusted here,
 * not reimplemented.
 */
function validateGroup(group: E85TemporalLineageGroup): void {
  if (group === null || typeof group !== "object") {
    throw new E85TemporalLineageSelectionError(`group must be an object, got ${JSON.stringify(group)}.`);
  }
  const kind = (group as { readonly kind?: unknown }).kind;
  if (typeof kind !== "string" || !SUPPORTED_GROUP_KINDS.includes(kind)) {
    throw new E85TemporalLineageSelectionError(`group.kind must be one of ${JSON.stringify(SUPPORTED_GROUP_KINDS)}, got ${JSON.stringify(kind)}.`);
  }
  if (!isNonEmptyString(group.lineageId)) {
    throw new E85TemporalLineageSelectionError(`group.lineageId must be a non-empty string, got ${JSON.stringify(group.lineageId)}.`);
  }
  if (kind !== "GROUP_READY") {
    return;
  }
  const ready = group as E85GroupReady;
  if (!Array.isArray(ready.selectorEligibleMembers) || ready.selectorEligibleMembers.length === 0) {
    throw new E85TemporalLineageSelectionError(
      `GROUP_READY lineage "${group.lineageId}" must have a non-empty selectorEligibleMembers array, got ${JSON.stringify(ready.selectorEligibleMembers)}.`,
    );
  }
  for (const eligibleMember of ready.selectorEligibleMembers) {
    if (eligibleMember === null || typeof eligibleMember !== "object") {
      throw new E85TemporalLineageSelectionError(
        `GROUP_READY lineage "${group.lineageId}" has a selectorEligibleMembers entry that is not an object.`,
      );
    }
    const adapterResult = eligibleMember.adapterResult;
    if (adapterResult === null || typeof adapterResult !== "object" || !isCandidateOutcome(adapterResult)) {
      throw new E85TemporalLineageSelectionError(
        `GROUP_READY lineage "${group.lineageId}" has a selectorEligibleMembers entry whose adapterResult.outcome is not "CANDIDATE".`,
      );
    }
    if (adapterResult.candidate === null || typeof adapterResult.candidate !== "object") {
      throw new E85TemporalLineageSelectionError(
        `GROUP_READY lineage "${group.lineageId}" has a CANDIDATE-outcome selectorEligibleMembers entry with no candidate object.`,
      );
    }
  }
}

/**
 * Validates the grouping result's own boundary shape: a non-null object with
 * a `groups` array, each entry validated by `validateGroup`. Full grouping
 * validation/canonicalization remains Slice 3D-1's own responsibility.
 */
function validateGrouping(grouping: E85TemporalLineageGroupingResult): void {
  if (grouping === null || typeof grouping !== "object") {
    throw new E85TemporalLineageSelectionError(`grouping must be an object, got ${JSON.stringify(grouping)}.`);
  }
  if (!Array.isArray(grouping.groups)) {
    throw new E85TemporalLineageSelectionError(`grouping.groups must be an array, got ${JSON.stringify(grouping.groups)}.`);
  }
  for (const group of grouping.groups) {
    validateGroup(group);
  }
}

/**
 * Extracts the candidates a `GROUP_READY` lineage's `selectorEligibleMembers`
 * carry, via the type-narrowing check on `outcome` rather than an unsafe
 * cast. `validateGroup` has already confirmed every entry is genuinely a
 * `CANDIDATE`-outcome member carrying its `candidate`, so this function's
 * narrowing can never fail here — it exists to keep the extraction itself
 * type-safe without re-deriving that proof inline.
 */
function candidatesOf(group: E85GroupReady): readonly E85TemporalCandidate[] {
  const candidates: E85TemporalCandidate[] = [];
  for (const eligibleMember of group.selectorEligibleMembers) {
    const adapterResult = eligibleMember.adapterResult;
    if (!isCandidateOutcome(adapterResult)) {
      throw new E85TemporalLineageSelectionError(
        `lineage "${group.lineageId}" selectorEligibleMembers entry has adapterResult.outcome "${adapterResult.outcome}", expected "CANDIDATE".`,
      );
    }
    candidates.push(adapterResult.candidate);
  }
  return candidates;
}

/**
 * Computes one lineage's outcome. For `GROUP_READY`, invokes
 * `selectE85TemporalCandidate` exactly once with the candidates extracted
 * from `selectorEligibleMembers` and the caller's resolved request,
 * unchanged, and preserves its return value verbatim. For every other group
 * kind, no selector call is made and the original group is retained by
 * reference. Exhaustive over the closed four-kind group union: an
 * unsupported kind falls through the `never` branch and throws
 * `E85TemporalLineageSelectionError` — this can only be reached if
 * `validateGroup` above did not already reject the input, so it exists as a
 * defensive backstop against a future fifth group kind, not as a reachable
 * path today.
 */
function evaluateOneLineage(group: E85TemporalLineageGroup, request: E85ResolvedTemporalRequest): E85TemporalLineageSelectionOutcome {
  switch (group.kind) {
    case "GROUP_READY": {
      const candidates = candidatesOf(group);
      const selectorResult = selectE85TemporalCandidate(request, candidates);
      return {
        kind: "LINEAGE_SELECTION_EVALUATED",
        lineageId: group.lineageId,
        group,
        selectorResult,
      };
    }
    case "GROUP_BLOCKED":
    case "GROUP_EVIDENCE_INCOMPLETE":
    case "GROUP_NO_CANDIDATE": {
      return {
        kind: "LINEAGE_NOT_SELECTOR_ELIGIBLE",
        lineageId: group.lineageId,
        group,
      };
    }
    default: {
      const exhaustive: never = group;
      throw new E85TemporalLineageSelectionError(`unsupported group kind, got ${JSON.stringify(exhaustive)}.`);
    }
  }
}

/**
 * Invokes the Slice 2 temporal selector, per lineage, over a complete Slice
 * 3D-1 grouping result and an already-resolved temporal request. Only
 * `GROUP_READY` lineages are submitted to `selectE85TemporalCandidate`;
 * `GROUP_BLOCKED`, `GROUP_EVIDENCE_INCOMPLETE`, and `GROUP_NO_CANDIDATE`
 * lineages are reported as not selector-eligible without ever invoking the
 * selector. The same resolved request — ABSENT, CURRENT, or AS_OF — is
 * passed to the selector unchanged for every `GROUP_READY` lineage; this
 * function never resolves CURRENT to a concrete date, never reads a clock,
 * and never infers a "current" candidate by any other means.
 *
 * Pure and deterministic: the same two inputs always yield a deeply-equal
 * result, or the same thrown error. Output order follows
 * `grouping.groups`'s existing deterministic order — this function never
 * re-sorts. Neither `grouping` nor `request` (nor any group, member,
 * candidate, or nested object within them) is mutated; every retained group
 * object is the same reference the caller supplied.
 */
export function selectE85TemporalLineages(
  grouping: E85TemporalLineageGroupingResult,
  request: E85ResolvedTemporalRequest,
): E85TemporalLineageSelectionResult {
  validateGrouping(grouping);
  validateResolvedRequest(request);

  const outcomes = grouping.groups.map((group) => evaluateOneLineage(group, request));

  return { outcomes };
}

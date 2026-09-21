/**
 * InvestScape™ E85 Phase 15.14 — Temporal Decision-Impact Mapper, Slice 3E.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Additive only. This module is the thin, pure boundary between Slice 3D-3's
 * `E85TemporalLineageSelectionResult` (temporal-lineage-selection.ts) plus a
 * resolved temporal request (temporal-request-types.ts) and a FUTURE,
 * unimplemented Slice 3F adapter that will build real decision-package
 * gaps/materiality/status/trace. This module produces neither: it maps every
 * per-lineage outcome onto a typed, jurisdiction-neutral "temporal decision
 * impact" — an intermediate disposition recommendation only.
 *
 * SCOPE. This module does NOT construct an `E85DataGap`, a materiality
 * record, an overall status, or a decision-trace entry (decision-package-
 * types.ts, decision-status.ts, decision-materiality.ts, decision-trace.ts —
 * none of which are imported here). It does NOT add a new
 * `E85DataGapReasonCode` or a new terminal status. It does NOT inspect
 * `requestedAnalyses` — it has no such input. It does NOT infer a source-
 * version relationship (Slice 3D-2, deferred) or invoke the selector itself
 * (Slice 2's `selectE85TemporalCandidate` is never called from here — its
 * results are only ever read, by reference, from the Slice 3D-3 input).
 *
 * CURRENT POLICY (fixed). `temporal-selection.ts` always deterministically
 * returns `INSUFFICIENT_TEMPORAL_EVIDENCE` for CURRENT on a `GROUP_READY`
 * lineage, reading no clock. Every CURRENT-mode lineage outcome — selector-
 * derived or grouping-derived — therefore maps to a `DATA_GAP` disposition,
 * via one of four DISTINCT impact kinds so the underlying evidence (missing
 * reference-time basis vs. collision vs. incomplete evidence vs. no
 * candidate) is never collapsed into one generic reason. This module never
 * reads `Date`/`Date.now()`, never picks a "latest" candidate, and never
 * reuses `EFFECTIVE_DATE_UNKNOWN` (an evidentiary fact about one source's own
 * commencement date, not the same fact as "the system lacks a trusted
 * present-day reference").
 *
 * AS_OF MAPPING. All seven `E85TemporalSelectionKind` values, and all three
 * non-ready `E85TemporalLineageGroup` kinds, each get their own impact kind —
 * distinct from the CURRENT-context impact kinds even where the underlying
 * upstream literal (e.g. `INSUFFICIENT_TEMPORAL_EVIDENCE`) is spelled the
 * same, because this module discriminates on (outcome shape, request mode)
 * jointly, never on the upstream kind alone.
 *
 * Design carried over unchanged from Slices 1-3D-3: no machine clock, no
 * randomness, no I/O, no `any`, and no mutation of caller-supplied values
 * anywhere in this file. Every retained `selectorResult`/`group` is the exact
 * reference the caller supplied — never cloned, flattened, or reconstructed.
 */
import type { E85ResolvedTemporalRequest } from "./temporal-request-types";
import type {
  E85TemporalLineageSelectionOutcome,
  E85TemporalLineageSelectionResult,
} from "./temporal-lineage-selection";
import type { E85TemporalSelectionResult } from "./temporal-selection";
import type { E85TemporalLineageGroup } from "./temporal-lineage-grouping";

/**
 * The non-`GROUP_READY` shapes of `E85TemporalLineageGroup` — the only group
 * shape a `LINEAGE_NOT_SELECTOR_ELIGIBLE` outcome may carry (see Slice
 * 3D-3's own `E85GroupNotReady`, reimplemented here as a type-level
 * `Exclude` rather than imported, since Slice 3D-3 does not export it).
 */
type E85TemporalNonReadyGroup = Exclude<E85TemporalLineageGroup, { readonly kind: "GROUP_READY" }>;

/**
 * Closed, jurisdiction-neutral disposition vocabulary. `DISCLOSURE` is
 * reserved: no mapping in this slice currently produces it. `MANUAL_REVIEW_
 * REQUIRED` is produced for AS_OF + `CONFLICTING_TEMPORAL_EVIDENCE` only —
 * conflicting credible temporal evidence requires human adjudication, unlike
 * missing evidence (`DATA_GAP`). Both union members and their policy rows
 * exist and are exercised through the public result in tests.
 */
export type E85TemporalImpactDisposition = "NONE" | "DISCLOSURE" | "DATA_GAP" | "MANUAL_REVIEW_REQUIRED";

/**
 * The single derived policy a disposition implies. Never independently
 * settable — always read off `getE85TemporalImpactPolicy` — so a
 * `DATA_GAP` impact can never disagree with itself about whether it blocks.
 */
export interface E85TemporalImpactPolicy {
  readonly blockerRelevant: boolean;
  readonly completenessRecommendation: "UNCHANGED" | "PARTIAL";
  readonly machineResolvedEligible: boolean;
  readonly manualReviewRecommendation: "NONE" | "REQUIRED";
}

/**
 * Closed, local, mapper-only impact-kind vocabulary. None of these literals
 * are (or ever become) an `E85DataGapReasonCode` — that final reason-code
 * choice is explicitly deferred to a future Slice 3F. The CURRENT-context
 * and AS_OF-context kinds are deliberately distinct even when the
 * underlying upstream selector/group kind coincides.
 */
export type E85TemporalImpactKind =
  // CURRENT context — four distinct evidentiary situations, one shared DATA_GAP disposition.
  | "CURRENT_REFERENCE_BASIS_UNAVAILABLE"
  | "CURRENT_LINEAGE_BLOCKED"
  | "CURRENT_LINEAGE_EVIDENCE_INCOMPLETE"
  | "CURRENT_LINEAGE_NO_CANDIDATE"
  // AS_OF context, selector-derived — one per E85TemporalSelectionKind.
  | "AS_OF_SELECTED"
  | "AS_OF_TEMPORALLY_AMBIGUOUS"
  | "AS_OF_INSUFFICIENT_EVIDENCE"
  | "AS_OF_CONFLICTING_EVIDENCE"
  | "AS_OF_OUTSIDE_VALIDITY_INTERVAL"
  | "AS_OF_FUTURE_EFFECTIVE"
  | "AS_OF_SUPERSEDED"
  // AS_OF context, grouping-derived — one per non-ready group kind.
  | "AS_OF_LINEAGE_BLOCKED"
  | "AS_OF_LINEAGE_EVIDENCE_INCOMPLETE"
  | "AS_OF_LINEAGE_NO_CANDIDATE";

interface E85TemporalDecisionImpactBase {
  readonly lineageId: string;
  readonly requestMode: "CURRENT" | "AS_OF";
  /** Present only when `requestMode` is "AS_OF". */
  readonly asOfDate?: string;
  readonly impactKind: E85TemporalImpactKind;
  readonly disposition: E85TemporalImpactDisposition;
  readonly policy: E85TemporalImpactPolicy;
}

/**
 * A lineage whose outcome came from `LINEAGE_SELECTION_EVALUATED` — its
 * `selectorResult` is retained by reference, unmodified, from the Slice
 * 3D-3 input.
 */
export interface E85TemporalDecisionImpactSelectorDerived extends E85TemporalDecisionImpactBase {
  readonly origin: "SELECTOR_DERIVED";
  readonly selectorResult: E85TemporalSelectionResult;
}

/**
 * A lineage whose outcome came from `LINEAGE_NOT_SELECTOR_ELIGIBLE` — its
 * `group` is retained by reference, unmodified, from the Slice 3D-3 input.
 * Never `GROUP_READY` — that group shape only ever accompanies a
 * selector-derived impact.
 */
export interface E85TemporalDecisionImpactGroupingDerived extends E85TemporalDecisionImpactBase {
  readonly origin: "GROUPING_DERIVED";
  readonly group: E85TemporalNonReadyGroup;
}

/**
 * One lineage's mapped impact. Structurally exclusive: only
 * `SELECTOR_DERIVED` carries `selectorResult`, and only `GROUPING_DERIVED`
 * carries `group` — mirroring the exclusivity Slice 3D-3's own
 * `E85TemporalLineageSelectionOutcome` union enforces one layer down.
 */
export type E85TemporalDecisionImpact = E85TemporalDecisionImpactSelectorDerived | E85TemporalDecisionImpactGroupingDerived;

/**
 * The ABSENT branch is structurally distinct: no `impacts` field, no
 * lineage/selector/group data of any kind. `mapE85TemporalDecisionImpact`
 * returns this before ever reading its `selection` argument.
 */
export type E85TemporalDecisionImpactResult =
  | { readonly requestKind: "ABSENT" }
  | { readonly requestKind: "RESOLVED"; readonly requestMode: "CURRENT" | "AS_OF"; readonly impacts: readonly E85TemporalDecisionImpact[] };

/**
 * Deterministic, reproducible error raised for malformed input at this
 * module's own boundary only — never for a legitimate evidentiary/legal
 * conflict (those are always typed impacts, never exceptions).
 */
export class E85TemporalDecisionImpactError extends Error {
  constructor(message: string) {
    super(`E85 temporal decision impact error: ${message}`);
    this.name = "E85TemporalDecisionImpactError";
  }
}

// ---------------------------------------------------------------------------
// Disposition policy (private — see module doc; tested only via public results)
// ---------------------------------------------------------------------------

function getE85TemporalImpactPolicy(disposition: E85TemporalImpactDisposition): E85TemporalImpactPolicy {
  switch (disposition) {
    case "NONE":
      return { blockerRelevant: false, completenessRecommendation: "UNCHANGED", machineResolvedEligible: true, manualReviewRecommendation: "NONE" };
    case "DISCLOSURE":
      return { blockerRelevant: false, completenessRecommendation: "UNCHANGED", machineResolvedEligible: true, manualReviewRecommendation: "NONE" };
    case "DATA_GAP":
      return { blockerRelevant: true, completenessRecommendation: "PARTIAL", machineResolvedEligible: false, manualReviewRecommendation: "NONE" };
    case "MANUAL_REVIEW_REQUIRED":
      return { blockerRelevant: true, completenessRecommendation: "PARTIAL", machineResolvedEligible: false, manualReviewRecommendation: "REQUIRED" };
    default: {
      const exhaustive: never = disposition;
      throw new E85TemporalDecisionImpactError(`unsupported disposition, got ${JSON.stringify(exhaustive)}.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Runtime validation (narrow — trusts Slice 3D-1/3D-3/Slice 2's own validation)
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const SUPPORTED_OUTCOME_KINDS: readonly string[] = ["LINEAGE_SELECTION_EVALUATED", "LINEAGE_NOT_SELECTOR_ELIGIBLE"];
const SUPPORTED_NON_READY_GROUP_KINDS: readonly string[] = ["GROUP_BLOCKED", "GROUP_EVIDENCE_INCOMPLETE", "GROUP_NO_CANDIDATE"];
const SUPPORTED_SELECTOR_KINDS: readonly string[] = [
  "SELECTED",
  "TEMPORALLY_AMBIGUOUS",
  "INSUFFICIENT_TEMPORAL_EVIDENCE",
  "CONFLICTING_TEMPORAL_EVIDENCE",
  "OUTSIDE_VALIDITY_INTERVAL",
  "FUTURE_EFFECTIVE",
  "SUPERSEDED",
];

interface ValidatedRequest {
  readonly mode: "CURRENT" | "AS_OF";
  readonly asOfDate?: string;
}

/**
 * Validates the resolved request's own shape at this module's boundary.
 * Never called for the ABSENT branch, which short-circuits before this.
 */
function validateResolvedRequest(request: E85ResolvedTemporalRequest): ValidatedRequest {
  if (!isPlainObject(request)) {
    throw new E85TemporalDecisionImpactError(`request must be an object, got ${JSON.stringify(request)}.`);
  }
  if (request.kind !== "RESOLVED") {
    throw new E85TemporalDecisionImpactError(`request.kind must be "ABSENT" or "RESOLVED", got ${JSON.stringify(request.kind)}.`);
  }
  const inner = (request as { readonly request?: unknown }).request;
  if (!isPlainObject(inner)) {
    throw new E85TemporalDecisionImpactError(`request.request must be an object, got ${JSON.stringify(inner)}.`);
  }
  const mode = inner.mode;
  if (mode === "CURRENT") {
    return { mode: "CURRENT" };
  }
  if (mode === "AS_OF") {
    const asOfDate = inner.asOfDate;
    if (typeof asOfDate !== "string") {
      throw new E85TemporalDecisionImpactError(`request.request with mode AS_OF must carry a string asOfDate, got ${JSON.stringify(asOfDate)}.`);
    }
    return { mode: "AS_OF", asOfDate };
  }
  throw new E85TemporalDecisionImpactError(`request.request.mode must be "CURRENT" or "AS_OF", got ${JSON.stringify(mode)}.`);
}

function validateSelection(selection: E85TemporalLineageSelectionResult): readonly E85TemporalLineageSelectionOutcome[] {
  if (!isPlainObject(selection)) {
    throw new E85TemporalDecisionImpactError(`selection must be an object, got ${JSON.stringify(selection)}.`);
  }
  const outcomes = (selection as { readonly outcomes?: unknown }).outcomes;
  if (!Array.isArray(outcomes)) {
    throw new E85TemporalDecisionImpactError(`selection.outcomes must be an array, got ${JSON.stringify(outcomes)}.`);
  }
  return outcomes as readonly E85TemporalLineageSelectionOutcome[];
}

function validateOutcomeShape(outcome: unknown): E85TemporalLineageSelectionOutcome {
  if (!isPlainObject(outcome)) {
    throw new E85TemporalDecisionImpactError(`selection.outcomes entry must be an object, got ${JSON.stringify(outcome)}.`);
  }
  const kind = outcome.kind;
  if (typeof kind !== "string" || !SUPPORTED_OUTCOME_KINDS.includes(kind)) {
    throw new E85TemporalDecisionImpactError(`outcome.kind must be one of ${JSON.stringify(SUPPORTED_OUTCOME_KINDS)}, got ${JSON.stringify(kind)}.`);
  }
  const lineageId = outcome.lineageId;
  if (typeof lineageId !== "string" || lineageId.trim().length === 0) {
    throw new E85TemporalDecisionImpactError(`outcome.lineageId must be a non-empty string, got ${JSON.stringify(lineageId)}.`);
  }
  if (kind === "LINEAGE_SELECTION_EVALUATED") {
    const selectorResult = (outcome as { readonly selectorResult?: unknown }).selectorResult;
    if (!isPlainObject(selectorResult)) {
      throw new E85TemporalDecisionImpactError(`outcome with kind "LINEAGE_SELECTION_EVALUATED" must have an object selectorResult, got ${JSON.stringify(selectorResult)}.`);
    }
    const selectorKind = selectorResult.kind;
    if (typeof selectorKind !== "string" || !SUPPORTED_SELECTOR_KINDS.includes(selectorKind)) {
      throw new E85TemporalDecisionImpactError(
        `outcome.selectorResult.kind must be one of ${JSON.stringify(SUPPORTED_SELECTOR_KINDS)}, got ${JSON.stringify(selectorKind)}.`,
      );
    }
  } else {
    const group = (outcome as { readonly group?: unknown }).group;
    if (!isPlainObject(group)) {
      throw new E85TemporalDecisionImpactError(`outcome with kind "LINEAGE_NOT_SELECTOR_ELIGIBLE" must have an object group, got ${JSON.stringify(group)}.`);
    }
    const groupKind = group.kind;
    if (typeof groupKind !== "string" || !SUPPORTED_NON_READY_GROUP_KINDS.includes(groupKind)) {
      throw new E85TemporalDecisionImpactError(
        `outcome.group.kind must be one of ${JSON.stringify(SUPPORTED_NON_READY_GROUP_KINDS)}, got ${JSON.stringify(groupKind)}.`,
      );
    }
  }
  return outcome as unknown as E85TemporalLineageSelectionOutcome;
}

// ---------------------------------------------------------------------------
// Per-lineage mapping
// ---------------------------------------------------------------------------

function buildBase(
  lineageId: string,
  request: ValidatedRequest,
  impactKind: E85TemporalImpactKind,
  disposition: E85TemporalImpactDisposition,
): E85TemporalDecisionImpactBase {
  return {
    lineageId,
    requestMode: request.mode,
    ...(request.mode === "AS_OF" ? { asOfDate: request.asOfDate as string } : {}),
    impactKind,
    disposition,
    policy: getE85TemporalImpactPolicy(disposition),
  };
}

function mapSelectorDerived(
  lineageId: string,
  request: ValidatedRequest,
  selectorResult: E85TemporalSelectionResult,
): E85TemporalDecisionImpactSelectorDerived {
  if (request.mode === "CURRENT") {
    // CURRENT policy is fixed: the selector always deterministically returns
    // INSUFFICIENT_TEMPORAL_EVIDENCE for a ready lineage under CURRENT, with
    // zero clock access. Any other selector kind here is a boundary
    // violation of that documented invariant, not a legitimate outcome to
    // map — this module never invents a currency claim to paper over it.
    if (selectorResult.kind !== "INSUFFICIENT_TEMPORAL_EVIDENCE") {
      throw new E85TemporalDecisionImpactError(
        `CURRENT-mode selectorResult.kind must be "INSUFFICIENT_TEMPORAL_EVIDENCE", got ${JSON.stringify(selectorResult.kind)}.`,
      );
    }
    return {
      ...buildBase(lineageId, request, "CURRENT_REFERENCE_BASIS_UNAVAILABLE", "DATA_GAP"),
      origin: "SELECTOR_DERIVED",
      selectorResult,
    };
  }

  switch (selectorResult.kind) {
    case "SELECTED":
      return { ...buildBase(lineageId, request, "AS_OF_SELECTED", "NONE"), origin: "SELECTOR_DERIVED", selectorResult };
    case "TEMPORALLY_AMBIGUOUS":
      return { ...buildBase(lineageId, request, "AS_OF_TEMPORALLY_AMBIGUOUS", "DATA_GAP"), origin: "SELECTOR_DERIVED", selectorResult };
    case "INSUFFICIENT_TEMPORAL_EVIDENCE":
      return { ...buildBase(lineageId, request, "AS_OF_INSUFFICIENT_EVIDENCE", "DATA_GAP"), origin: "SELECTOR_DERIVED", selectorResult };
    case "CONFLICTING_TEMPORAL_EVIDENCE":
      return { ...buildBase(lineageId, request, "AS_OF_CONFLICTING_EVIDENCE", "MANUAL_REVIEW_REQUIRED"), origin: "SELECTOR_DERIVED", selectorResult };
    case "OUTSIDE_VALIDITY_INTERVAL":
      return { ...buildBase(lineageId, request, "AS_OF_OUTSIDE_VALIDITY_INTERVAL", "DATA_GAP"), origin: "SELECTOR_DERIVED", selectorResult };
    case "FUTURE_EFFECTIVE":
      return { ...buildBase(lineageId, request, "AS_OF_FUTURE_EFFECTIVE", "DATA_GAP"), origin: "SELECTOR_DERIVED", selectorResult };
    case "SUPERSEDED":
      return { ...buildBase(lineageId, request, "AS_OF_SUPERSEDED", "DATA_GAP"), origin: "SELECTOR_DERIVED", selectorResult };
    default: {
      const exhaustive: never = selectorResult.kind;
      throw new E85TemporalDecisionImpactError(`unsupported selectorResult.kind, got ${JSON.stringify(exhaustive)}.`);
    }
  }
}

function mapGroupingDerived(
  lineageId: string,
  request: ValidatedRequest,
  group: E85TemporalNonReadyGroup,
): E85TemporalDecisionImpactGroupingDerived {
  if (request.mode === "CURRENT") {
    switch (group.kind) {
      case "GROUP_BLOCKED":
        return { ...buildBase(lineageId, request, "CURRENT_LINEAGE_BLOCKED", "DATA_GAP"), origin: "GROUPING_DERIVED", group };
      case "GROUP_EVIDENCE_INCOMPLETE":
        return { ...buildBase(lineageId, request, "CURRENT_LINEAGE_EVIDENCE_INCOMPLETE", "DATA_GAP"), origin: "GROUPING_DERIVED", group };
      case "GROUP_NO_CANDIDATE":
        return { ...buildBase(lineageId, request, "CURRENT_LINEAGE_NO_CANDIDATE", "DATA_GAP"), origin: "GROUPING_DERIVED", group };
      default: {
        const exhaustive: never = group;
        throw new E85TemporalDecisionImpactError(`unsupported non-ready group kind, got ${JSON.stringify(exhaustive)}.`);
      }
    }
  }

  switch (group.kind) {
    case "GROUP_BLOCKED":
      return { ...buildBase(lineageId, request, "AS_OF_LINEAGE_BLOCKED", "DATA_GAP"), origin: "GROUPING_DERIVED", group };
    case "GROUP_EVIDENCE_INCOMPLETE":
      return { ...buildBase(lineageId, request, "AS_OF_LINEAGE_EVIDENCE_INCOMPLETE", "DATA_GAP"), origin: "GROUPING_DERIVED", group };
    case "GROUP_NO_CANDIDATE":
      return { ...buildBase(lineageId, request, "AS_OF_LINEAGE_NO_CANDIDATE", "DATA_GAP"), origin: "GROUPING_DERIVED", group };
    default: {
      const exhaustive: never = group;
      throw new E85TemporalDecisionImpactError(`unsupported non-ready group kind, got ${JSON.stringify(exhaustive)}.`);
    }
  }
}

function mapOneOutcome(outcome: E85TemporalLineageSelectionOutcome, request: ValidatedRequest): E85TemporalDecisionImpact {
  switch (outcome.kind) {
    case "LINEAGE_SELECTION_EVALUATED":
      return mapSelectorDerived(outcome.lineageId, request, outcome.selectorResult);
    case "LINEAGE_NOT_SELECTOR_ELIGIBLE":
      return mapGroupingDerived(outcome.lineageId, request, outcome.group);
    default: {
      const exhaustive: never = outcome;
      throw new E85TemporalDecisionImpactError(`unsupported outcome kind, got ${JSON.stringify(exhaustive)}.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Maps a Slice 3D-3 `E85TemporalLineageSelectionResult` plus a resolved
 * temporal request onto a pure, neutral `E85TemporalDecisionImpactResult`.
 *
 * `request.kind === "ABSENT"` is checked FIRST and returns immediately —
 * `selection` is never read, validated, or otherwise touched in that branch,
 * even if it is a deliberately malformed or throwing-getter value.
 *
 * For CURRENT/AS_OF requests, produces exactly one `E85TemporalDecisionImpact`
 * per entry in `selection.outcomes`, in that array's own existing
 * deterministic order (this module never re-sorts). Every retained
 * `selectorResult`/`group` is the exact reference the caller supplied.
 *
 * Pure and deterministic: the same two inputs always yield a deeply-equal
 * result or throw the same `E85TemporalDecisionImpactError`. Neither
 * `selection` nor `request` (nor any nested object within them) is mutated.
 * Never reads `Date`/`Date.now()`, `Math.random()`, or `randomUUID()`, and
 * performs no I/O.
 */
export function mapE85TemporalDecisionImpact(
  selection: E85TemporalLineageSelectionResult,
  request: E85ResolvedTemporalRequest,
): E85TemporalDecisionImpactResult {
  if (isPlainObject(request) && request.kind === "ABSENT") {
    return { requestKind: "ABSENT" };
  }

  const validatedRequest = validateResolvedRequest(request);
  const outcomes = validateSelection(selection);
  const validatedOutcomes = outcomes.map(validateOutcomeShape);

  const impacts = validatedOutcomes.map((outcome) => mapOneOutcome(outcome, validatedRequest));

  return { requestKind: "RESOLVED", requestMode: validatedRequest.mode, impacts };
}

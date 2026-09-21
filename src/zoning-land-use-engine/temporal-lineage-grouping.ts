/**
 * InvestScape™ E85 Phase 15.10 — Temporal Lineage Grouping, Slice 3D-1.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Additive only. Groups Slice 3C `E85TemporalCandidateAdapterResult` values
 * into caller-declared "lineages" — mutually exclusive temporal alternatives
 * for one legal-version slot — and computes, per lineage, a structurally
 * safe readiness state.
 *
 * CORE SAFETY INVARIANT. Grouping has no request date. It therefore cannot
 * prove that an unresolved or disputed alternative is irrelevant to some
 * future AS_OF request. Consequently `selectorEligibleMembers` is exposed
 * ONLY by the `GROUP_READY` branch, and `GROUP_READY` requires: at least one
 * `CANDIDATE` member, zero non-candidate members, and zero candidate-
 * involving collisions (same-lineage or cross-lineage). This is enforced by
 * the shape of `E85TemporalLineageGroup` itself — the other three branches
 * do not declare the field at all — not by caller discipline.
 *
 * Reimplements (rather than imports) Slice 3C's identity escaping so this
 * module can validate `candidateId` without trusting it, while never
 * modifying or reaching into `temporal-candidate-adapter.ts`'s private
 * internals. Only the frozen `E85TemporalCandidateAdapterResult` type is
 * imported from that module.
 *
 * Design carried over unchanged from Slices 1-3C: no machine clock, no
 * randomness, no I/O, no mutation of caller-supplied values anywhere in this
 * file. Nothing here constructs an `E85TemporalCandidate`, invokes
 * `selectE85TemporalCandidate`, or wires into request handling, composition,
 * status/materiality, or real-source migration — that is out of scope for
 * 3D-1.
 */
import type { E85TemporalCandidateAdapterResult } from "./temporal-candidate-adapter";

/**
 * One membership record: a caller's claim that a particular Slice 3C result
 * belongs to a particular lineage, plus why. Lineage membership is caller/
 * registry configuration, not legal proof — this module never infers
 * `lineageId` from bundle identity or any other content.
 */
export interface E85TemporalLineageMember {
  readonly lineageId: string;
  readonly adapterResult: E85TemporalCandidateAdapterResult;
  readonly membershipRationale: string;
}

/**
 * Closed collision vocabulary. The CANDIDATE/non-candidate distinction on
 * each kind exists so group-state computation can determine `GROUP_BLOCKED`
 * directly from finding kind, without re-deriving candidate involvement.
 */
export type E85TemporalLineageCollisionKind =
  | "CANDIDATE_CONTENT_COLLISION"
  | "NON_CANDIDATE_CONTENT_COLLISION"
  | "CANDIDATE_ID_IN_MULTIPLE_LINEAGES"
  | "NON_CANDIDATE_ID_IN_MULTIPLE_LINEAGES";

export interface E85TemporalLineageCollisionFinding {
  readonly kind: E85TemporalLineageCollisionKind;
  readonly candidateId: string;
  readonly lineageIds: readonly string[];
  readonly detail: string;
}

interface E85LineageGroupBase {
  readonly lineageId: string;
  readonly members: readonly E85TemporalLineageMember[];
  readonly nonCandidateMembers: readonly E85TemporalLineageMember[];
  readonly collisionFindings: readonly E85TemporalLineageCollisionFinding[];
}

/**
 * Closed, four-way discriminated union. Only `GROUP_READY` declares
 * `selectorEligibleMembers` — the other three variants' object types simply
 * do not have that field, so accessing it without narrowing is a compile
 * error, not merely an empty array at runtime.
 */
export type E85TemporalLineageGroup =
  | (E85LineageGroupBase & {
      readonly kind: "GROUP_READY";
      readonly selectorEligibleMembers: readonly E85TemporalLineageMember[];
    })
  | (E85LineageGroupBase & { readonly kind: "GROUP_BLOCKED" })
  | (E85LineageGroupBase & { readonly kind: "GROUP_EVIDENCE_INCOMPLETE" })
  | (E85LineageGroupBase & { readonly kind: "GROUP_NO_CANDIDATE" });

export interface E85TemporalLineageGroupingResult {
  readonly groups: readonly E85TemporalLineageGroup[];
  readonly crossLineageFindings: readonly E85TemporalLineageCollisionFinding[];
}

/**
 * Deterministic, reproducible error for malformed/configuration input at
 * this module's boundary — a malformed member, an empty lineageId/rationale,
 * a malformed adapter-result branch, a candidateId that fails reconstruction
 * against its own bundle, an unsupported canonical value, or a cycle. Never
 * thrown for an ordinary evidentiary disagreement between two members —
 * those are always typed `E85TemporalLineageCollisionFinding` values.
 */
export class E85TemporalLineageError extends Error {
  constructor(message: string) {
    super(`E85 temporal lineage error: ${message}`);
    this.name = "E85TemporalLineageError";
  }
}

// ---------------------------------------------------------------------------
// Identity reconstruction (reimplemented locally from Slice 3C, not imported)
// ---------------------------------------------------------------------------

function requireNonEmptyIdentityComponent(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new E85TemporalLineageError(`bundle.${fieldName} must be a non-empty string, got ${JSON.stringify(value)}.`);
  }
  return value;
}

function escapeIdentityComponent(value: string): string {
  return value.replace(/%/g, "%25").replace(/@/g, "%40");
}

function reconstructCandidateId(bundle: unknown): string {
  if (bundle === null || typeof bundle !== "object") {
    throw new E85TemporalLineageError(`bundle must be an object, got ${JSON.stringify(bundle)}.`);
  }
  const b = bundle as Record<string, unknown>;
  const jurisdictionId = requireNonEmptyIdentityComponent(b.jurisdictionId, "jurisdictionId");
  const sourceId = requireNonEmptyIdentityComponent(b.sourceId, "sourceId");
  const sourceVersionId = requireNonEmptyIdentityComponent(b.sourceVersionId, "sourceVersionId");
  const zoneDesignation = requireNonEmptyIdentityComponent(b.zoneDesignation, "zoneDesignation");
  return [jurisdictionId, sourceId, sourceVersionId, zoneDesignation].map(escapeIdentityComponent).join("@");
}

// ---------------------------------------------------------------------------
// Branch runtime validation
// ---------------------------------------------------------------------------

const SUPPORTED_OUTCOMES: readonly string[] = [
  "CANDIDATE",
  "OPEN_END_UNRESEARCHED",
  "OPEN_END_REVIEWED_NO_END_ESTABLISHED",
  "START_UNKNOWN",
  "CONFLICTING_START",
  "CONFLICTING_END",
  "PARTIAL_TERMINATION",
];

function requireField(obj: Record<string, unknown>, field: string, outcome: string): unknown {
  if (!(field in obj) || obj[field] === undefined) {
    throw new E85TemporalLineageError(`adapterResult with outcome "${outcome}" must have field "${field}".`);
  }
  return obj[field];
}

function forbidCandidateField(obj: Record<string, unknown>, outcome: string): void {
  if ("candidate" in obj && obj.candidate !== undefined) {
    throw new E85TemporalLineageError(`adapterResult with outcome "${outcome}" must not have a "candidate" field.`);
  }
}

/**
 * Validates one adapterResult's shape against the closed seven-outcome
 * vocabulary, reconstructs candidateId from `bundle`, and cross-checks it
 * (and, for CANDIDATE, `candidate.candidateId`) against the value the
 * adapterResult itself carries. Returns the validated, still-unmutated
 * adapterResult on success.
 */
function validateAndReconstructMember(adapterResult: E85TemporalCandidateAdapterResult): E85TemporalCandidateAdapterResult {
  if (adapterResult === null || typeof adapterResult !== "object") {
    throw new E85TemporalLineageError(`adapterResult must be an object, got ${JSON.stringify(adapterResult)}.`);
  }
  const obj = adapterResult as unknown as Record<string, unknown>;
  const outcome = obj.outcome;
  if (typeof outcome !== "string" || !SUPPORTED_OUTCOMES.includes(outcome)) {
    throw new E85TemporalLineageError(`adapterResult.outcome must be one of ${JSON.stringify(SUPPORTED_OUTCOMES)}, got ${JSON.stringify(outcome)}.`);
  }

  const bundle = requireField(obj, "bundle", outcome);
  const candidateId = requireField(obj, "candidateId", outcome);
  if (typeof candidateId !== "string" || candidateId.trim().length === 0) {
    throw new E85TemporalLineageError(`adapterResult with outcome "${outcome}" must have a non-empty string candidateId.`);
  }

  const reconstructed = reconstructCandidateId(bundle);
  if (reconstructed !== candidateId) {
    throw new E85TemporalLineageError(
      `adapterResult.candidateId "${candidateId}" does not match the identity reconstructed from its bundle ("${reconstructed}") for outcome "${outcome}".`,
    );
  }

  switch (outcome) {
    case "CANDIDATE": {
      const candidate = requireField(obj, "candidate", outcome);
      if (candidate === null || typeof candidate !== "object") {
        throw new E85TemporalLineageError(`adapterResult with outcome "CANDIDATE" must have an object "candidate" field.`);
      }
      const candidateObj = candidate as Record<string, unknown>;
      requireField(candidateObj, "temporal", outcome);
      const innerId = candidateObj.candidateId;
      if (innerId !== candidateId) {
        throw new E85TemporalLineageError(
          `adapterResult.candidate.candidateId "${JSON.stringify(innerId)}" does not match adapterResult.candidateId "${candidateId}".`,
        );
      }
      const validity = requireField(obj, "validity", outcome);
      if (validity === null || typeof validity !== "object") {
        throw new E85TemporalLineageError(`adapterResult with outcome "CANDIDATE" must have an object "validity" field.`);
      }
      const validityState = (validity as Record<string, unknown>).state;
      if (validityState !== "CLOSED") {
        throw new E85TemporalLineageError(
          `adapterResult with outcome "CANDIDATE" must carry validity.state "CLOSED", got ${JSON.stringify(validityState)} (candidateId "${candidateId}").`,
        );
      }
      break;
    }
    case "OPEN_END_UNRESEARCHED": {
      requireField(obj, "evidence", outcome);
      requireField(obj, "validity", outcome);
      forbidCandidateField(obj, outcome);
      break;
    }
    case "OPEN_END_REVIEWED_NO_END_ESTABLISHED": {
      const evidence = requireField(obj, "evidence", outcome);
      if (evidence === null || typeof evidence !== "object") {
        throw new E85TemporalLineageError(`adapterResult with outcome "${outcome}" must have an object "evidence" field.`);
      }
      const evidenceObj = evidence as Record<string, unknown>;
      requireField(evidenceObj, "reviewedAt", outcome);
      requireField(evidenceObj, "sourcesChecked", outcome);
      requireField(obj, "validity", outcome);
      forbidCandidateField(obj, outcome);
      break;
    }
    case "START_UNKNOWN": {
      forbidCandidateField(obj, outcome);
      break;
    }
    case "CONFLICTING_START": {
      requireField(obj, "conflictingStartAssertions", outcome);
      forbidCandidateField(obj, outcome);
      break;
    }
    case "CONFLICTING_END": {
      requireField(obj, "conflictingEndAssertions", outcome);
      requireField(obj, "validity", outcome);
      forbidCandidateField(obj, outcome);
      break;
    }
    case "PARTIAL_TERMINATION": {
      requireField(obj, "description", outcome);
      requireField(obj, "validity", outcome);
      forbidCandidateField(obj, outcome);
      break;
    }
    default: {
      const exhaustive: never = outcome as never;
      throw new E85TemporalLineageError(`unsupported outcome, got ${JSON.stringify(exhaustive)}.`);
    }
  }

  return adapterResult;
}

// ---------------------------------------------------------------------------
// Member validation
// ---------------------------------------------------------------------------

function validateMember(member: E85TemporalLineageMember): E85TemporalLineageMember {
  if (member === null || typeof member !== "object") {
    throw new E85TemporalLineageError(`member must be an object, got ${JSON.stringify(member)}.`);
  }
  const m = member as unknown as Record<string, unknown>;
  if (typeof m.lineageId !== "string" || m.lineageId.trim().length === 0) {
    throw new E85TemporalLineageError(`member.lineageId must be a non-empty string, got ${JSON.stringify(m.lineageId)}.`);
  }
  if (typeof m.membershipRationale !== "string" || m.membershipRationale.trim().length === 0) {
    throw new E85TemporalLineageError(`member.membershipRationale must be a non-empty string, got ${JSON.stringify(m.membershipRationale)}.`);
  }
  if (m.adapterResult === null || typeof m.adapterResult !== "object") {
    throw new E85TemporalLineageError(`member.adapterResult must be an object, got ${JSON.stringify(m.adapterResult)}.`);
  }
  validateAndReconstructMember(member.adapterResult);
  return member;
}

// ---------------------------------------------------------------------------
// Canonicalization (private; for duplicate/content comparison only)
// ---------------------------------------------------------------------------

type CanonicalValue = string | number | boolean | null | readonly CanonicalValue[] | { readonly [key: string]: CanonicalValue };

function canonicalize(value: unknown, path: string, seen: Set<unknown>): CanonicalValue {
  if (value === null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new E85TemporalLineageError(`canonicalization error at "${path}": non-finite number is not permitted.`);
    }
    return value;
  }
  if (typeof value === "bigint") {
    throw new E85TemporalLineageError(`canonicalization error at "${path}": BigInt is not permitted.`);
  }
  if (typeof value === "function") {
    throw new E85TemporalLineageError(`canonicalization error at "${path}": function is not permitted.`);
  }
  if (typeof value === "symbol") {
    throw new E85TemporalLineageError(`canonicalization error at "${path}": symbol is not permitted.`);
  }
  if (typeof value === "undefined") {
    throw new E85TemporalLineageError(`canonicalization error at "${path}": undefined is not permitted here.`);
  }
  if (value instanceof Date) {
    throw new E85TemporalLineageError(`canonicalization error at "${path}": Date is not permitted.`);
  }
  if (value instanceof Map || value instanceof Set) {
    throw new E85TemporalLineageError(`canonicalization error at "${path}": Map/Set is not permitted.`);
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw new E85TemporalLineageError(`canonicalization error at "${path}": cyclic reference detected.`);
    }
    const nextSeen = new Set(seen);
    nextSeen.add(value);
    return value.map((item, index) => {
      if (!(index in value)) {
        throw new E85TemporalLineageError(`canonicalization error at "${path}[${index}]": sparse array element is not permitted.`);
      }
      if (item === undefined) {
        throw new E85TemporalLineageError(`canonicalization error at "${path}[${index}]": undefined array element is not permitted.`);
      }
      return canonicalize(item, `${path}[${index}]`, nextSeen);
    });
  }
  if (typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new E85TemporalLineageError(`canonicalization error at "${path}": non-plain object instance is not permitted.`);
    }
    if (seen.has(value)) {
      throw new E85TemporalLineageError(`canonicalization error at "${path}": cyclic reference detected.`);
    }
    const nextSeen = new Set(seen);
    nextSeen.add(value);
    const obj = value as Record<string, unknown>;
    const result: Record<string, CanonicalValue> = {};
    for (const key of Object.keys(obj).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
      const v = obj[key];
      if (v === undefined) continue; // undefined object property treated as absent
      result[key] = canonicalize(v, `${path}.${key}`, nextSeen);
    }
    return result;
  }
  throw new E85TemporalLineageError(`canonicalization error at "${path}": unsupported value type.`);
}

function canonicalFingerprint(value: unknown): string {
  const canonical = canonicalize(value, "$", new Set());
  return stringifyCanonical(canonical);
}

function stringifyCanonical(value: CanonicalValue): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean" || typeof value === "number") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stringifyCanonical).join(",")}]`;
  const obj = value as { readonly [key: string]: CanonicalValue };
  return `{${Object.keys(obj)
    .map((k) => `${JSON.stringify(k)}:${stringifyCanonical(obj[k])}`)
    .join(",")}}`;
}

// ---------------------------------------------------------------------------
// Comparison helpers
// ---------------------------------------------------------------------------

function codeUnitCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function candidateIdOf(m: E85TemporalLineageMember): string {
  return (m.adapterResult as unknown as { candidateId: string }).candidateId;
}

function isCandidateOutcome(m: E85TemporalLineageMember): boolean {
  return m.adapterResult.outcome === "CANDIDATE";
}

function memberFingerprint(m: E85TemporalLineageMember): string {
  return canonicalFingerprint(m.adapterResult);
}

function exactDuplicateKey(m: E85TemporalLineageMember): string {
  return `${m.lineageId}\u0000${candidateIdOf(m)}\u0000${memberFingerprint(m)}\u0000${m.membershipRationale}`;
}

function compareMembers(a: E85TemporalLineageMember, b: E85TemporalLineageMember): number {
  const byLineage = codeUnitCompare(a.lineageId, b.lineageId);
  if (byLineage !== 0) return byLineage;
  const byCandidateId = codeUnitCompare(candidateIdOf(a), candidateIdOf(b));
  if (byCandidateId !== 0) return byCandidateId;
  const byFingerprint = codeUnitCompare(memberFingerprint(a), memberFingerprint(b));
  if (byFingerprint !== 0) return byFingerprint;
  return codeUnitCompare(a.membershipRationale, b.membershipRationale);
}

function compareFindings(a: E85TemporalLineageCollisionFinding, b: E85TemporalLineageCollisionFinding): number {
  const byCandidateId = codeUnitCompare(a.candidateId, b.candidateId);
  if (byCandidateId !== 0) return byCandidateId;
  const byKind = codeUnitCompare(a.kind, b.kind);
  if (byKind !== 0) return byKind;
  const byLineageIds = codeUnitCompare(a.lineageIds.join("\u0000"), b.lineageIds.join("\u0000"));
  if (byLineageIds !== 0) return byLineageIds;
  return codeUnitCompare(a.detail, b.detail);
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort(codeUnitCompare);
}

// ---------------------------------------------------------------------------
// Duplicate collapse
// ---------------------------------------------------------------------------

function collapseExactDuplicates(members: readonly E85TemporalLineageMember[]): readonly E85TemporalLineageMember[] {
  const seen = new Map<string, E85TemporalLineageMember>();
  for (const m of members) {
    const key = exactDuplicateKey(m);
    if (!seen.has(key)) seen.set(key, m);
  }
  return [...seen.values()].sort(compareMembers);
}

// ---------------------------------------------------------------------------
// Collision detection
// ---------------------------------------------------------------------------

interface CollisionAnalysis {
  readonly perLineageFindings: Map<string, E85TemporalLineageCollisionFinding[]>;
  readonly crossLineageFindings: readonly E85TemporalLineageCollisionFinding[];
  readonly candidateInvolvingLineages: Set<string>;
}

function detectCollisions(allMembers: readonly E85TemporalLineageMember[]): CollisionAnalysis {
  const perLineageFindings = new Map<string, E85TemporalLineageCollisionFinding[]>();
  const crossLineageFindings: E85TemporalLineageCollisionFinding[] = [];
  const candidateInvolvingLineages = new Set<string>();

  // Same-lineage, same candidateId, differing canonical content.
  const byLineageAndId = new Map<string, E85TemporalLineageMember[]>();
  for (const m of allMembers) {
    const key = `${m.lineageId}\u0000${candidateIdOf(m)}`;
    const list = byLineageAndId.get(key) ?? [];
    list.push(m);
    byLineageAndId.set(key, list);
  }
  for (const [key, list] of byLineageAndId) {
    const distinctFingerprints = new Set(list.map(memberFingerprint));
    if (distinctFingerprints.size < 2) continue;
    const [lineageId, candidateId] = key.split("\u0000");
    const anyCandidate = list.some(isCandidateOutcome);
    const kind: E85TemporalLineageCollisionKind = anyCandidate ? "CANDIDATE_CONTENT_COLLISION" : "NON_CANDIDATE_CONTENT_COLLISION";
    const finding: E85TemporalLineageCollisionFinding = {
      kind,
      candidateId,
      lineageIds: [lineageId],
      detail: `${list.length} members in lineage "${lineageId}" share candidateId "${candidateId}" with ${distinctFingerprints.size} distinct content fingerprints.`,
    };
    const arr = perLineageFindings.get(lineageId) ?? [];
    arr.push(finding);
    perLineageFindings.set(lineageId, arr);
    if (anyCandidate) candidateInvolvingLineages.add(lineageId);
  }

  // Cross-lineage: same candidateId appearing in more than one distinct lineage.
  const byId = new Map<string, E85TemporalLineageMember[]>();
  for (const m of allMembers) {
    const list = byId.get(candidateIdOf(m)) ?? [];
    list.push(m);
    byId.set(candidateIdOf(m), list);
  }
  for (const [candidateId, list] of byId) {
    const lineageIds = sortedUnique(list.map((m) => m.lineageId));
    if (lineageIds.length < 2) continue;
    const anyCandidate = list.some(isCandidateOutcome);
    const kind: E85TemporalLineageCollisionKind = anyCandidate ? "CANDIDATE_ID_IN_MULTIPLE_LINEAGES" : "NON_CANDIDATE_ID_IN_MULTIPLE_LINEAGES";
    crossLineageFindings.push({
      kind,
      candidateId,
      lineageIds,
      detail: `candidateId "${candidateId}" appears in ${lineageIds.length} distinct lineages: ${lineageIds.join(", ")}.`,
    });
    if (anyCandidate) {
      for (const lineageId of lineageIds) candidateInvolvingLineages.add(lineageId);
    }
  }

  return { perLineageFindings, crossLineageFindings: crossLineageFindings.sort(compareFindings), candidateInvolvingLineages };
}

// ---------------------------------------------------------------------------
// Group-state computation
// ---------------------------------------------------------------------------

function selectorEligibleRepresentatives(candidateMembers: readonly E85TemporalLineageMember[]): readonly E85TemporalLineageMember[] {
  const byId = new Map<string, E85TemporalLineageMember>();
  for (const m of candidateMembers) {
    const id = candidateIdOf(m);
    const existing = byId.get(id);
    if (existing === undefined || compareMembers(m, existing) < 0) byId.set(id, m);
  }
  return [...byId.values()].sort(compareMembers);
}

function buildGroup(
  lineageId: string,
  members: readonly E85TemporalLineageMember[],
  lineageFindings: readonly E85TemporalLineageCollisionFinding[],
  crossLineageFindingsForThisLineage: readonly E85TemporalLineageCollisionFinding[],
  candidateInvolvingCollision: boolean,
): E85TemporalLineageGroup {
  const sortedMembers = [...members].sort(compareMembers);
  const candidateMembers = sortedMembers.filter(isCandidateOutcome);
  const nonCandidateMembers = sortedMembers.filter((m) => !isCandidateOutcome(m));
  const collisionFindings = [...lineageFindings, ...crossLineageFindingsForThisLineage].sort(compareFindings);

  const base: E85LineageGroupBase = {
    lineageId,
    members: sortedMembers,
    nonCandidateMembers,
    collisionFindings,
  };

  if (candidateInvolvingCollision) {
    return { ...base, kind: "GROUP_BLOCKED" };
  }
  if (candidateMembers.length === 0) {
    return { ...base, kind: "GROUP_NO_CANDIDATE" };
  }
  if (nonCandidateMembers.length > 0) {
    return { ...base, kind: "GROUP_EVIDENCE_INCOMPLETE" };
  }
  return { ...base, kind: "GROUP_READY", selectorEligibleMembers: selectorEligibleRepresentatives(candidateMembers) };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Groups members into lineages and computes each lineage's structurally
 * safe readiness state. Pure and deterministic: the same input (up to
 * member order and exact-duplicate repetition) always yields a deeply-equal
 * result or throws the same `E85TemporalLineageError`. Neither `members` nor
 * any member/adapterResult/bundle/validity/evidence object is mutated.
 */
export function groupE85TemporalLineageMembers(members: readonly E85TemporalLineageMember[]): E85TemporalLineageGroupingResult {
  if (!Array.isArray(members)) {
    throw new E85TemporalLineageError(`members must be an array, got ${JSON.stringify(members)}.`);
  }
  const validated = members.map(validateMember);
  const collapsed = collapseExactDuplicates(validated);

  const { perLineageFindings, crossLineageFindings, candidateInvolvingLineages } = detectCollisions(collapsed);

  const lineageIds = sortedUnique(collapsed.map((m) => m.lineageId));
  const membersByLineage = new Map<string, E85TemporalLineageMember[]>();
  for (const m of collapsed) {
    const list = membersByLineage.get(m.lineageId) ?? [];
    list.push(m);
    membersByLineage.set(m.lineageId, list);
  }

  const groups: E85TemporalLineageGroup[] = lineageIds.map((lineageId) => {
    const lineageMembers = membersByLineage.get(lineageId) ?? [];
    const lineageFindings = perLineageFindings.get(lineageId) ?? [];
    const crossFindingsForLineage = crossLineageFindings.filter((f) => f.lineageIds.includes(lineageId));
    const candidateInvolvingCollision = candidateInvolvingLineages.has(lineageId);
    return buildGroup(lineageId, lineageMembers, lineageFindings, crossFindingsForLineage, candidateInvolvingCollision);
  });

  return { groups, crossLineageFindings };
}

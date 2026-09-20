/**
 * InvestScape™ E85 Phase 15.6 — Version-Validity Contract, Slice 3B.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Additive only. This module introduces a caller-facing "version validity"
 * contract: a closed, exhaustive vocabulary for how a rule/evidence version's
 * start and end in time may be legally established (`E85StartAuthority`,
 * `E85EndAuthority`), and a closed eight-state vocabulary for the validity
 * interval itself (`E85VersionValidity`, with the eighth state — a
 * structurally invalid interval — represented as a construction-time throw
 * rather than a constructible state; see the note above
 * `buildE85VersionValidity`). Nothing here is wired into `E85SourceVersion`,
 * normalized bundles, registries, adapters, candidate selection, request
 * normalization, spatial applicability, legal linkage, rule-pack
 * composition, evaluators, decision packages, or any gaps/blockers/
 * materiality/terminal-status vocabulary — that wiring is explicitly out of
 * scope for Slice 3B. A source-version relationship type is deferred to a
 * later slice.
 *
 * Deliberately separate from `E85TemporalAuthority` (provenance-types.ts):
 * this module does not import, reuse, or convert that type. `commencement`
 * is one way a version may start (`COMMENCEMENT`), never the only one, and
 * an ordinary enactment/adoption/publication event is never itself
 * sufficient to establish when a version took effect — see the forbidden
 * list on `E85StartAuthority` below. Matching dates alone never establish
 * immediate-on-enactment effect; an express, separately-supplied locator is
 * always required. A successor merely existing — by registry position,
 * publication date, consolidation period, or spatial timestamp — never by
 * itself establishes a repeal-by-replacement end; an explicit successor
 * identity is required in addition to an express repeal locator.
 *
 * Design carried over unchanged from Slice 1/Slice 2: no machine clock is
 * read anywhere in this file. No variant claims present-day currency (no
 * "IS_CURRENT" boolean, no reliance on the wall clock). Canonical date
 * validation (YYYY-MM-DD, real Gregorian calendar dates including leap
 * years) is implemented locally, via pure integer arithmetic, deliberately
 * NOT via `new Date(...)` parsing or any locale-aware parsing — see
 * `isCanonicalDate` below. This mirrors `isValidE85AsOfDate`
 * (temporal-request-types.ts) exactly but is reimplemented locally rather
 * than imported, keeping this module's dependency surface limited to the
 * one neutral type it reuses (`E85EffectiveDateBasis`, evidence-types.ts).
 */
import type { E85EffectiveDateBasis } from "./evidence-types";

/**
 * A structured, non-empty pointer into the specific clause of an
 * authoritative document that establishes a start/end event. Deliberately
 * NOT `E85DocumentLocator` (provenance-types.ts) — a locally-defined,
 * structurally similar shape, kept separate so this module never imports
 * provenance-types.ts (and so never gains a path to `E85TemporalAuthority`).
 * Every field is optional individually, but `isNonEmptyLocator` requires at
 * least one to carry real content — a bare `{}` is never an operative
 * locator.
 */
export interface E85OperativeLocator {
  readonly bylawOrDocumentId?: string;
  readonly section?: string;
  readonly clause?: string;
  readonly schedule?: string;
  readonly table?: string;
  readonly row?: string;
  readonly page?: number;
}

/**
 * Closed, exhaustive vocabulary for how a version's START may be legally
 * established. Exactly three variants — no others are representable, by
 * construction of the union itself:
 *
 *   - COMMENCEMENT: an explicit commencement clause brings the instrument
 *     into force on `effectiveFrom`.
 *   - IN_FORCE: an explicit "in force" clause/notice establishes
 *     `effectiveFrom` directly.
 *   - IMMEDIATE_ON_ENACTMENT: the instrument's own text expressly makes
 *     enactment immediately operative. `effectiveFrom` MUST equal
 *     `enactmentDate` (validated at construction, not just typed), and an
 *     express-immediacy locator — separate from the enactment locator — is
 *     always required. Matching dates alone are never sufficient.
 *
 * FORBIDDEN, by design and never representable here: bare adoption, ordinary
 * enactment without express immediacy, passage/readings, assent/approval,
 * publication, consolidation, and acquisition. None of these may become an
 * `E85StartAuthority` variant, now or by silent extension — this is a closed
 * union, not an open string type. Provision-specific commencement is
 * deferred to a later slice and is also not representable here.
 */
export type E85StartAuthority =
  | {
      readonly eventKind: "COMMENCEMENT";
      readonly effectiveFrom: string;
      readonly authoritySourceId: string;
      readonly authoritySourceVersionId: string;
      readonly commencementLocator: E85OperativeLocator;
      readonly effectiveDateBasis: E85EffectiveDateBasis;
    }
  | {
      readonly eventKind: "IN_FORCE";
      readonly effectiveFrom: string;
      readonly authoritySourceId: string;
      readonly authoritySourceVersionId: string;
      readonly inForceLocator: E85OperativeLocator;
      readonly effectiveDateBasis: E85EffectiveDateBasis;
    }
  | {
      readonly eventKind: "IMMEDIATE_ON_ENACTMENT";
      readonly effectiveFrom: string;
      readonly enactmentDate: string;
      readonly authoritySourceId: string;
      readonly authoritySourceVersionId: string;
      readonly enactmentLocator: E85OperativeLocator;
      readonly expressImmediacyLocator: E85OperativeLocator;
      readonly effectiveDateBasis: E85EffectiveDateBasis;
    };

/**
 * Closed, exhaustive vocabulary for how a version's END may be legally
 * established. Exactly three variants — no generic "SUPERSEDED" event is
 * representable:
 *
 *   - EXPRESS_REPEAL: an explicit repeal clause ends the version on
 *     `effectiveTo`.
 *   - EXPRESS_EXPIRY: an explicit sunset/expiry clause ends the version on
 *     `effectiveTo`.
 *   - REPLACEMENT_WITH_EXPRESS_REPEAL: an express repeal clause AND an
 *     explicitly, separately-supplied successor identity
 *     (`successorSourceId` + `successorSourceVersionId`). A successor's mere
 *     existence — by registry position, publication date, consolidation
 *     period, fact date, or spatial timestamp — never by itself constructs a
 *     valid end authority; both the repeal locator/eventKind AND the
 *     explicit successor identity are required together.
 */
export type E85EndAuthority =
  | {
      readonly eventKind: "EXPRESS_REPEAL";
      readonly effectiveTo: string;
      readonly authoritySourceId: string;
      readonly authoritySourceVersionId: string;
      readonly repealLocator: E85OperativeLocator;
      readonly effectiveDateBasis: E85EffectiveDateBasis;
    }
  | {
      readonly eventKind: "EXPRESS_EXPIRY";
      readonly effectiveTo: string;
      readonly authoritySourceId: string;
      readonly authoritySourceVersionId: string;
      readonly expiryLocator: E85OperativeLocator;
      readonly effectiveDateBasis: E85EffectiveDateBasis;
    }
  | {
      readonly eventKind: "REPLACEMENT_WITH_EXPRESS_REPEAL";
      readonly effectiveTo: string;
      readonly authoritySourceId: string;
      readonly authoritySourceVersionId: string;
      readonly repealLocator: E85OperativeLocator;
      readonly effectiveDateBasis: E85EffectiveDateBasis;
      readonly successorSourceId: string;
      readonly successorSourceVersionId: string;
    };

/**
 * Deterministic, non-clock evidence that a bounded review for an end date
 * was actually performed and found nothing. `reviewedAt` is a caller-
 * supplied canonical date (never `Date.now()` / `new Date()`) recording when
 * the review was conducted — it grounds the review in a real, reproducible
 * event rather than an implicit "as of whenever this runs".
 */
export interface E85EndDateReviewEvidence {
  readonly sourcesChecked: readonly string[];
  readonly reviewedAt: string;
  readonly candidatesConsidered?: readonly string[];
}

interface E85KnownStartFields {
  readonly effectiveFrom: string;
  readonly start: E85StartAuthority;
  /** Optional caller-declared expected provenance, cross-checked against `start` at construction. */
  readonly expectedAuthoritySourceId?: string;
  readonly expectedAuthoritySourceVersionId?: string;
}

interface E85KnownEndFields {
  readonly effectiveTo: string;
  readonly end: E85EndAuthority;
  readonly expectedEndAuthoritySourceId?: string;
  readonly expectedEndAuthoritySourceVersionId?: string;
}

/**
 * The final, mutually-exclusive validity vocabulary. Seven of the eight
 * closed-design states are constructible here; the eighth (a structurally
 * invalid interval, e.g. end before start) is represented as a construction-
 * time throw from `buildE85VersionValidity` rather than a constructible
 * union member — see the note above that function for why this satisfies
 * "the eighth state" rather than improvising it.
 *
 *   1. START_UNKNOWN — no start authority, no effectiveFrom.
 *   2. CONFLICTING_START — two or more distinct, disagreeing start-date
 *      assertions, unresolved.
 *   3. OPEN_UNRESEARCHED — known start; end not yet researched at all.
 *   4. OPEN_REVIEWED_NO_END_ESTABLISHED — known start; a bounded review was
 *      performed and found no qualifying end (`endReview` required).
 *   5. CLOSED — known start AND known end (`effectiveTo >= effectiveFrom`).
 *      Single-day validity (`effectiveTo === effectiveFrom`) is permitted.
 *   6. CONFLICTING_END — known start; two or more distinct disagreeing
 *      end-date assertions, unresolved.
 *   7. CONDITIONAL_PARTIAL_TERMINATION — known start; a transition clause /
 *      partial termination that must never be represented as ordinary
 *      CLOSED. Structurally distinct: it carries no `end`/`effectiveTo`
 *      field at all, so it can never be produced by omitting a field from
 *      CLOSED, and CLOSED can never be produced by adding one to this.
 */
export type E85VersionValidity =
  | { readonly state: "START_UNKNOWN" }
  | ({ readonly state: "CONFLICTING_START" } & { readonly conflictingStartAssertions: readonly E85StartAuthority[] })
  | ({ readonly state: "OPEN_UNRESEARCHED" } & E85KnownStartFields)
  | ({ readonly state: "OPEN_REVIEWED_NO_END_ESTABLISHED" } & E85KnownStartFields & { readonly endReview: E85EndDateReviewEvidence })
  | ({ readonly state: "CLOSED" } & E85KnownStartFields & E85KnownEndFields)
  | ({ readonly state: "CONFLICTING_END" } & E85KnownStartFields & { readonly conflictingEndAssertions: readonly E85EndAuthority[] })
  | ({ readonly state: "CONDITIONAL_PARTIAL_TERMINATION" } & E85KnownStartFields & { readonly description: string });

/**
 * Deterministic, reproducible error raised whenever a builder in this module
 * cannot honor its input. Never carries wall-clock time, object identity, or
 * any other nondeterministic content — the same offending input always
 * produces the same message. Consistent with `E85TemporalRequestError`
 * (Slice 1) and `E85TemporalSelectionError` (Slice 2): a single, stable
 * error class rather than a discriminated error-result type.
 */
export class E85VersionValidityError extends Error {
  constructor(message: string) {
    super(`E85 version validity error: ${message}`);
    this.name = "E85VersionValidityError";
  }
}

const VALID_EFFECTIVE_DATE_BASES: readonly string[] = ["SOURCE_STATED", "PUBLICATION_DATE_INFERRED", "AMENDMENT_DATE_KNOWN", "UNKNOWN"];

/**
 * Strict full-date test (YYYY-MM-DD), including calendar validity (real
 * month, real day for that month, real leap years). Reimplemented locally
 * (mirroring `isValidE85AsOfDate` in temporal-request-types.ts) via pure
 * integer arithmetic rather than imported, keeping this module's import
 * surface limited to `E85EffectiveDateBasis`. Deliberately NOT implemented
 * via `new Date(...)` parsing, which silently normalizes invalid dates.
 */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  const table = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return table[month - 1];
}

function isCanonicalDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;
  return day <= daysInMonth(year, month);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonEmptyLocator(locator: E85OperativeLocator | undefined): locator is E85OperativeLocator {
  if (locator === undefined || locator === null || typeof locator !== "object") return false;
  const stringFields: (keyof E85OperativeLocator)[] = ["bylawOrDocumentId", "section", "clause", "schedule", "table", "row"];
  if (stringFields.some((field) => isNonEmptyString(locator[field]))) return true;
  return typeof locator.page === "number";
}

function requireCanonicalDate(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !isCanonicalDate(value)) {
    throw new E85VersionValidityError(`${fieldName} must be a canonical YYYY-MM-DD calendar date, got ${JSON.stringify(value)}.`);
  }
  return value;
}

function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (!isNonEmptyString(value)) {
    throw new E85VersionValidityError(`${fieldName} must be a non-empty string, got ${JSON.stringify(value)}.`);
  }
  return value;
}

function requireOperativeLocator(value: unknown, fieldName: string): E85OperativeLocator {
  if (!isNonEmptyLocator(value as E85OperativeLocator)) {
    throw new E85VersionValidityError(`${fieldName} must be a non-empty operative locator, got ${JSON.stringify(value)}.`);
  }
  return value as E85OperativeLocator;
}

function requireEffectiveDateBasis(value: unknown, fieldName: string): E85EffectiveDateBasis {
  if (typeof value !== "string" || !VALID_EFFECTIVE_DATE_BASES.includes(value)) {
    throw new E85VersionValidityError(`${fieldName} must be a recognized effective-date basis, got ${JSON.stringify(value)}.`);
  }
  return value as E85EffectiveDateBasis;
}

/**
 * Validates and (re)constructs a fresh, non-mutated `E85StartAuthority`.
 * Pure and deterministic: the same input always yields a deeply-equal
 * output or throws the same `E85VersionValidityError`. Rejects any shape
 * outside the three closed variants — there is no code path here that
 * accepts a bare adoption/enactment-only event, matching dates alone
 * (without a separate express-immediacy locator), or any of the other
 * forbidden events listed on `E85StartAuthority`.
 */
export function buildE85StartAuthority(input: E85StartAuthority): E85StartAuthority {
  if (input === null || typeof input !== "object") {
    throw new E85VersionValidityError(`start authority must be an object, got ${JSON.stringify(input)}.`);
  }
  const eventKind = (input as { eventKind?: unknown }).eventKind;

  if (eventKind === "COMMENCEMENT") {
    const i = input as Extract<E85StartAuthority, { eventKind: "COMMENCEMENT" }>;
    return {
      eventKind: "COMMENCEMENT",
      effectiveFrom: requireCanonicalDate(i.effectiveFrom, "effectiveFrom"),
      authoritySourceId: requireNonEmptyString(i.authoritySourceId, "authoritySourceId"),
      authoritySourceVersionId: requireNonEmptyString(i.authoritySourceVersionId, "authoritySourceVersionId"),
      commencementLocator: requireOperativeLocator(i.commencementLocator, "commencementLocator"),
      effectiveDateBasis: requireEffectiveDateBasis(i.effectiveDateBasis, "effectiveDateBasis"),
    };
  }

  if (eventKind === "IN_FORCE") {
    const i = input as Extract<E85StartAuthority, { eventKind: "IN_FORCE" }>;
    return {
      eventKind: "IN_FORCE",
      effectiveFrom: requireCanonicalDate(i.effectiveFrom, "effectiveFrom"),
      authoritySourceId: requireNonEmptyString(i.authoritySourceId, "authoritySourceId"),
      authoritySourceVersionId: requireNonEmptyString(i.authoritySourceVersionId, "authoritySourceVersionId"),
      inForceLocator: requireOperativeLocator(i.inForceLocator, "inForceLocator"),
      effectiveDateBasis: requireEffectiveDateBasis(i.effectiveDateBasis, "effectiveDateBasis"),
    };
  }

  if (eventKind === "IMMEDIATE_ON_ENACTMENT") {
    const i = input as Extract<E85StartAuthority, { eventKind: "IMMEDIATE_ON_ENACTMENT" }>;
    const effectiveFrom = requireCanonicalDate(i.effectiveFrom, "effectiveFrom");
    const enactmentDate = requireCanonicalDate(i.enactmentDate, "enactmentDate");
    if (effectiveFrom !== enactmentDate) {
      throw new E85VersionValidityError(
        `IMMEDIATE_ON_ENACTMENT requires effectiveFrom to equal enactmentDate, got effectiveFrom "${effectiveFrom}" and enactmentDate "${enactmentDate}".`,
      );
    }
    const enactmentLocator = requireOperativeLocator(i.enactmentLocator, "enactmentLocator");
    const expressImmediacyLocator = requireOperativeLocator(i.expressImmediacyLocator, "expressImmediacyLocator");
    return {
      eventKind: "IMMEDIATE_ON_ENACTMENT",
      effectiveFrom,
      enactmentDate,
      authoritySourceId: requireNonEmptyString(i.authoritySourceId, "authoritySourceId"),
      authoritySourceVersionId: requireNonEmptyString(i.authoritySourceVersionId, "authoritySourceVersionId"),
      enactmentLocator,
      expressImmediacyLocator,
      effectiveDateBasis: requireEffectiveDateBasis(i.effectiveDateBasis, "effectiveDateBasis"),
    };
  }

  throw new E85VersionValidityError(
    `start authority eventKind must be one of "COMMENCEMENT", "IN_FORCE", "IMMEDIATE_ON_ENACTMENT", got ${JSON.stringify(eventKind)}.`,
  );
}

/**
 * Validates and (re)constructs a fresh, non-mutated `E85EndAuthority`.
 * `REPLACEMENT_WITH_EXPRESS_REPEAL` requires both an express repeal locator
 * AND an explicit successor identity — a successor identity alone, without
 * the repeal eventKind/locator, can never reach this function (there is no
 * variant for it), and supplying only a successor identity under a
 * different eventKind is rejected as an unrecognized shape.
 */
export function buildE85EndAuthority(input: E85EndAuthority): E85EndAuthority {
  if (input === null || typeof input !== "object") {
    throw new E85VersionValidityError(`end authority must be an object, got ${JSON.stringify(input)}.`);
  }
  const eventKind = (input as { eventKind?: unknown }).eventKind;

  if (eventKind === "EXPRESS_REPEAL") {
    const i = input as Extract<E85EndAuthority, { eventKind: "EXPRESS_REPEAL" }>;
    return {
      eventKind: "EXPRESS_REPEAL",
      effectiveTo: requireCanonicalDate(i.effectiveTo, "effectiveTo"),
      authoritySourceId: requireNonEmptyString(i.authoritySourceId, "authoritySourceId"),
      authoritySourceVersionId: requireNonEmptyString(i.authoritySourceVersionId, "authoritySourceVersionId"),
      repealLocator: requireOperativeLocator(i.repealLocator, "repealLocator"),
      effectiveDateBasis: requireEffectiveDateBasis(i.effectiveDateBasis, "effectiveDateBasis"),
    };
  }

  if (eventKind === "EXPRESS_EXPIRY") {
    const i = input as Extract<E85EndAuthority, { eventKind: "EXPRESS_EXPIRY" }>;
    return {
      eventKind: "EXPRESS_EXPIRY",
      effectiveTo: requireCanonicalDate(i.effectiveTo, "effectiveTo"),
      authoritySourceId: requireNonEmptyString(i.authoritySourceId, "authoritySourceId"),
      authoritySourceVersionId: requireNonEmptyString(i.authoritySourceVersionId, "authoritySourceVersionId"),
      expiryLocator: requireOperativeLocator(i.expiryLocator, "expiryLocator"),
      effectiveDateBasis: requireEffectiveDateBasis(i.effectiveDateBasis, "effectiveDateBasis"),
    };
  }

  if (eventKind === "REPLACEMENT_WITH_EXPRESS_REPEAL") {
    const i = input as Extract<E85EndAuthority, { eventKind: "REPLACEMENT_WITH_EXPRESS_REPEAL" }>;
    return {
      eventKind: "REPLACEMENT_WITH_EXPRESS_REPEAL",
      effectiveTo: requireCanonicalDate(i.effectiveTo, "effectiveTo"),
      authoritySourceId: requireNonEmptyString(i.authoritySourceId, "authoritySourceId"),
      authoritySourceVersionId: requireNonEmptyString(i.authoritySourceVersionId, "authoritySourceVersionId"),
      repealLocator: requireOperativeLocator(i.repealLocator, "repealLocator"),
      effectiveDateBasis: requireEffectiveDateBasis(i.effectiveDateBasis, "effectiveDateBasis"),
      successorSourceId: requireNonEmptyString(i.successorSourceId, "successorSourceId"),
      successorSourceVersionId: requireNonEmptyString(i.successorSourceVersionId, "successorSourceVersionId"),
    };
  }

  throw new E85VersionValidityError(
    `end authority eventKind must be one of "EXPRESS_REPEAL", "EXPRESS_EXPIRY", "REPLACEMENT_WITH_EXPRESS_REPEAL", got ${JSON.stringify(eventKind)}.`,
  );
}

function distinctByKey<T>(items: readonly T[], key: (item: T) => string): number {
  return new Set(items.map(key)).size;
}

function assertGenuineConflict(assertions: readonly unknown[], dateOf: (a: unknown) => string, label: string): void {
  if (assertions.length < 2) {
    throw new E85VersionValidityError(`${label} requires at least two assertions, got ${assertions.length}.`);
  }
  const serializedSet = new Set(assertions.map((a) => JSON.stringify(a)));
  if (serializedSet.size < assertions.length) {
    throw new E85VersionValidityError(`${label} must not contain exact duplicate assertions.`);
  }
  const distinctDates = distinctByKey(assertions, dateOf);
  if (distinctDates < 2) {
    throw new E85VersionValidityError(`${label} requires at least two genuinely distinct dates, got ${distinctDates}.`);
  }
}

function validateEndReviewEvidence(value: E85EndDateReviewEvidence): E85EndDateReviewEvidence {
  if (value === null || typeof value !== "object") {
    throw new E85VersionValidityError(`endReview must be an object, got ${JSON.stringify(value)}.`);
  }
  const sourcesChecked = value.sourcesChecked;
  if (!Array.isArray(sourcesChecked) || sourcesChecked.length === 0 || !sourcesChecked.every(isNonEmptyString)) {
    throw new E85VersionValidityError(`endReview.sourcesChecked must be a non-empty array of non-empty strings.`);
  }
  const reviewedAt = requireCanonicalDate(value.reviewedAt, "endReview.reviewedAt");
  let candidatesConsidered: readonly string[] | undefined;
  if (value.candidatesConsidered !== undefined) {
    if (!Array.isArray(value.candidatesConsidered) || !value.candidatesConsidered.every(isNonEmptyString)) {
      throw new E85VersionValidityError(`endReview.candidatesConsidered, when present, must be an array of non-empty strings.`);
    }
    candidatesConsidered = value.candidatesConsidered.slice();
  }
  return candidatesConsidered === undefined
    ? { sourcesChecked: sourcesChecked.slice(), reviewedAt }
    : { sourcesChecked: sourcesChecked.slice(), reviewedAt, candidatesConsidered };
}

function requireMatchingProvenance(
  expectedSourceId: string | undefined,
  expectedSourceVersionId: string | undefined,
  actualSourceId: string,
  actualSourceVersionId: string,
  label: string,
): void {
  if (expectedSourceId !== undefined && expectedSourceId !== actualSourceId) {
    throw new E85VersionValidityError(`${label} expected authoritySourceId "${expectedSourceId}" but authority carries "${actualSourceId}".`);
  }
  if (expectedSourceVersionId !== undefined && expectedSourceVersionId !== actualSourceVersionId) {
    throw new E85VersionValidityError(
      `${label} expected authoritySourceVersionId "${expectedSourceVersionId}" but authority carries "${actualSourceVersionId}".`,
    );
  }
}

function buildKnownStart(input: E85KnownStartFields): { effectiveFrom: string; start: E85StartAuthority; expectedAuthoritySourceId?: string; expectedAuthoritySourceVersionId?: string } {
  const start = buildE85StartAuthority(input.start);
  const effectiveFrom = requireCanonicalDate(input.effectiveFrom, "effectiveFrom");
  if (effectiveFrom !== start.effectiveFrom) {
    throw new E85VersionValidityError(`effectiveFrom "${effectiveFrom}" does not match start authority's own effectiveFrom "${start.effectiveFrom}".`);
  }
  requireMatchingProvenance(input.expectedAuthoritySourceId, input.expectedAuthoritySourceVersionId, start.authoritySourceId, start.authoritySourceVersionId, "start provenance");
  const result: { effectiveFrom: string; start: E85StartAuthority; expectedAuthoritySourceId?: string; expectedAuthoritySourceVersionId?: string } = { effectiveFrom, start };
  if (input.expectedAuthoritySourceId !== undefined) result.expectedAuthoritySourceId = input.expectedAuthoritySourceId;
  if (input.expectedAuthoritySourceVersionId !== undefined) result.expectedAuthoritySourceVersionId = input.expectedAuthoritySourceVersionId;
  return result;
}

/**
 * Validates and (re)constructs a fresh, non-mutated `E85VersionValidity`.
 * Pure and deterministic: the same input always yields a deeply-equal
 * output or throws the same `E85VersionValidityError`.
 *
 * DESIGN DECISION — the eighth state, `INVALID_INTERVAL`, is NOT a
 * constructible member of the `E85VersionValidity` union. A structurally
 * invalid interval (most concretely: a CLOSED interval whose `effectiveTo`
 * precedes its `effectiveFrom`) is instead rejected here as a thrown
 * `E85VersionValidityError`, exactly as `temporal-selection.ts`'s Slice 2
 * `assertStructurallyValidCandidates` treats `effectiveFrom > effectiveTo`
 * as a construction-time error rather than a selection outcome. Treating
 * structural invalidity as a constructor throw — rather than a state real
 * callers branch on — is the same choice this codebase already made one
 * slice earlier, so it is not an improvisation; it is required because a
 * validity value that is CLOSED-shaped but backwards cannot be reasoned
 * about by anything downstream and must never be handed out as data.
 */
export function buildE85VersionValidity(input: E85VersionValidity): E85VersionValidity {
  if (input === null || typeof input !== "object") {
    throw new E85VersionValidityError(`version validity must be an object, got ${JSON.stringify(input)}.`);
  }
  const state = (input as { state?: unknown }).state;

  if (state === "START_UNKNOWN") {
    return { state: "START_UNKNOWN" };
  }

  if (state === "CONFLICTING_START") {
    const i = input as Extract<E85VersionValidity, { state: "CONFLICTING_START" }>;
    const rebuilt = (i.conflictingStartAssertions ?? []).map((a) => buildE85StartAuthority(a));
    assertGenuineConflict(rebuilt, (a) => (a as E85StartAuthority).effectiveFrom, "CONFLICTING_START.conflictingStartAssertions");
    return { state: "CONFLICTING_START", conflictingStartAssertions: rebuilt };
  }

  if (state === "OPEN_UNRESEARCHED") {
    const i = input as Extract<E85VersionValidity, { state: "OPEN_UNRESEARCHED" }>;
    return { state: "OPEN_UNRESEARCHED", ...buildKnownStart(i) };
  }

  if (state === "OPEN_REVIEWED_NO_END_ESTABLISHED") {
    const i = input as Extract<E85VersionValidity, { state: "OPEN_REVIEWED_NO_END_ESTABLISHED" }>;
    const knownStart = buildKnownStart(i);
    const endReview = validateEndReviewEvidence(i.endReview);
    return { state: "OPEN_REVIEWED_NO_END_ESTABLISHED", ...knownStart, endReview };
  }

  if (state === "CLOSED") {
    const i = input as Extract<E85VersionValidity, { state: "CLOSED" }>;
    const knownStart = buildKnownStart(i);
    const end = buildE85EndAuthority(i.end);
    const effectiveTo = requireCanonicalDate(i.effectiveTo, "effectiveTo");
    if (effectiveTo !== end.effectiveTo) {
      throw new E85VersionValidityError(`effectiveTo "${effectiveTo}" does not match end authority's own effectiveTo "${end.effectiveTo}".`);
    }
    requireMatchingProvenance(i.expectedEndAuthoritySourceId, i.expectedEndAuthoritySourceVersionId, end.authoritySourceId, end.authoritySourceVersionId, "end provenance");
    if (effectiveTo < knownStart.effectiveFrom) {
      throw new E85VersionValidityError(
        `CLOSED interval is structurally invalid: effectiveTo "${effectiveTo}" precedes effectiveFrom "${knownStart.effectiveFrom}".`,
      );
    }
    const result: E85VersionValidity = { state: "CLOSED", ...knownStart, effectiveTo, end };
    if (i.expectedEndAuthoritySourceId !== undefined) (result as { expectedEndAuthoritySourceId?: string }).expectedEndAuthoritySourceId = i.expectedEndAuthoritySourceId;
    if (i.expectedEndAuthoritySourceVersionId !== undefined) (result as { expectedEndAuthoritySourceVersionId?: string }).expectedEndAuthoritySourceVersionId = i.expectedEndAuthoritySourceVersionId;
    return result;
  }

  if (state === "CONFLICTING_END") {
    const i = input as Extract<E85VersionValidity, { state: "CONFLICTING_END" }>;
    const knownStart = buildKnownStart(i);
    const rebuilt = (i.conflictingEndAssertions ?? []).map((a) => buildE85EndAuthority(a));
    assertGenuineConflict(rebuilt, (a) => (a as E85EndAuthority).effectiveTo, "CONFLICTING_END.conflictingEndAssertions");
    return { state: "CONFLICTING_END", ...knownStart, conflictingEndAssertions: rebuilt };
  }

  if (state === "CONDITIONAL_PARTIAL_TERMINATION") {
    const i = input as Extract<E85VersionValidity, { state: "CONDITIONAL_PARTIAL_TERMINATION" }>;
    const knownStart = buildKnownStart(i);
    const description = requireNonEmptyString(i.description, "description");
    return { state: "CONDITIONAL_PARTIAL_TERMINATION", ...knownStart, description };
  }

  throw new E85VersionValidityError(
    `version validity state must be one of "START_UNKNOWN", "CONFLICTING_START", "OPEN_UNRESEARCHED", "OPEN_REVIEWED_NO_END_ESTABLISHED", "CLOSED", "CONFLICTING_END", "CONDITIONAL_PARTIAL_TERMINATION", got ${JSON.stringify(state)}.`,
  );
}

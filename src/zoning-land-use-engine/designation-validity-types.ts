/**
 * InvestScape™ E85 Phase 15.20B — Parcel-Designation Validity Contract,
 * Slice 3G-1.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Additive only. This module introduces a caller-facing "parcel-designation
 * validity" contract: a closed, exhaustive vocabulary for how long a
 * parcel's zoning/district designation is asserted to hold, deliberately
 * kept SEPARATE from `E85VersionValidity` (version-validity-types.ts).
 *
 * `E85VersionValidity` answers "when does a legal TEXT take force/end",
 * evidenced by bylaw commencement/repeal clauses. This module answers a
 * different question — "when is a given PARCEL's designation asserted to
 * hold" — evidenced by map/instrument amendments, parcel-specific rezoning
 * instruments, or dated spatial observations. These are different
 * evidentiary categories and this module deliberately does NOT import,
 * reuse, or convert `E85StartAuthority`/`E85EndAuthority`/
 * `E85VersionValidity` from version-validity-types.ts — it mirrors that
 * file's STRUCTURAL conventions (discriminated unions, a dedicated error
 * class, local canonical-date validation, construction-time throw for
 * structurally-invalid intervals) without conflating the two evidentiary
 * vocabularies.
 *
 * Nothing here is wired into spatial-applicability, legal-linkage,
 * decision-orchestrator, decision-package assembly, rule-pack composition,
 * candidate selection, or any gaps/blockers/materiality/terminal-status
 * vocabulary — that wiring (a future spatial-temporal alignment evaluator,
 * Slice 3G-2) is explicitly OUT OF SCOPE for this slice. This module is not
 * imported by, and does not import, any existing production file.
 *
 * OBSERVATION-CONTINUITY DEFERRAL: no code in this file merges multiple
 * observations, computes first/last observed bounds, infers an interval
 * from observations, or treats repeated agreement as authoritative
 * validity. `OPEN_OBSERVATION_ASSERTION` is grounded in exactly ONE dated
 * observation and never exposes an effective date derived from it. The
 * "do two observations establish continuity" policy question is explicitly
 * left undecided — `OPEN_UNRESEARCHED` and `OPEN_REVIEWED_NO_END_ESTABLISHED`
 * are populated from a single start authority record, never from multiple
 * observations, so neither state requires that policy question to be
 * usable.
 *
 * No machine clock is read anywhere in this file. No variant claims
 * present-day currency. Canonical date validation (YYYY-MM-DD, real
 * Gregorian calendar dates including leap years) is implemented locally via
 * pure integer arithmetic, deliberately NOT via `new Date(...)` parsing —
 * mirroring `isCanonicalDate` in version-validity-types.ts, but
 * reimplemented locally rather than imported (this module has zero imports
 * from version-validity-types.ts or any other existing production file).
 */

/**
 * A structured, non-empty pointer into the specific instrument/clause that
 * establishes a designation start/end event. Deliberately NOT
 * `E85OperativeLocator` (version-validity-types.ts) — a locally-defined,
 * structurally similar shape, kept separate so this module never imports
 * that file. Every field is optional individually, but
 * `isNonEmptyLocator` requires at least one to carry real content.
 */
export interface E85DesignationInstrumentLocator {
  readonly instrumentId?: string;
  readonly citationText?: string;
  readonly section?: string;
  readonly clause?: string;
  readonly page?: number;
}

/**
 * Observation metadata grounding an `OPEN_OBSERVATION_ASSERTION` start
 * authority. Deliberately carries NO field named `effectiveFrom`,
 * `effectiveTo`, or `effectiveDate` — `observedAt` is documented,
 * structurally, as observation metadata only, never as a legal-effective
 * date. `datasetId`/`sourceDescription`: at least one non-empty string
 * identifying the observed dataset/source is required.
 */
export interface E85DesignationObservationMetadata {
  readonly observedAt: string;
  readonly datasetId?: string;
  readonly sourceDescription?: string;
}

/**
 * Closed, exhaustive vocabulary for how a parcel designation's START may be
 * asserted. Exactly three variants — no others are representable:
 *
 *   - MAP_AMENDMENT_OPERATIVE_DATE: a map/instrument amendment that itself
 *     carries an operative date (analogous to a bylaw commencement, but
 *     scoped to a designation amendment instrument, not a legal-text
 *     instrument).
 *   - PARCEL_SPECIFIC_INSTRUMENT: a parcel-specific rezoning/reclassification
 *     instrument with its own effective date.
 *   - OPEN_OBSERVATION_ASSERTION: an open-ended assertion grounded in a
 *     single dated observation. Deliberately has NO `effectiveFrom` field —
 *     only `observation` metadata — so no code path can accidentally read
 *     an "effective date" off it.
 *
 * FORBIDDEN, by design and never representable here: any bylaw
 * commencement/in-force/immediate-on-enactment authority (those are
 * legal-text authorities, not designation authorities); dataset
 * modification timestamps; retrieval/processing/publication timestamps;
 * inference from repeated observations.
 */
export type E85DesignationStartAuthority =
  | {
      readonly kind: "MAP_AMENDMENT_OPERATIVE_DATE";
      readonly effectiveFrom: string;
      readonly instrumentLocator: E85DesignationInstrumentLocator;
    }
  | {
      readonly kind: "PARCEL_SPECIFIC_INSTRUMENT";
      readonly effectiveFrom: string;
      readonly instrumentLocator: E85DesignationInstrumentLocator;
    }
  | {
      readonly kind: "OPEN_OBSERVATION_ASSERTION";
      readonly observation: E85DesignationObservationMetadata;
    };

/**
 * Closed, exhaustive vocabulary for how a parcel designation's END may be
 * asserted. Exactly two variants — no "absence from a later dataset" kind
 * is representable, by design, ever:
 *
 *   - EXPRESS_REDESIGNATION: a later instrument/amendment expressly
 *     redesignates the parcel.
 *   - EXPRESS_REPEAL_OF_INSTRUMENT: the governing instrument is expressly
 *     repealed/superseded for this parcel.
 */
export type E85DesignationEndAuthority =
  | {
      readonly kind: "EXPRESS_REDESIGNATION";
      readonly effectiveTo: string;
      readonly instrumentLocator: E85DesignationInstrumentLocator;
    }
  | {
      readonly kind: "EXPRESS_REPEAL_OF_INSTRUMENT";
      readonly effectiveTo: string;
      readonly instrumentLocator: E85DesignationInstrumentLocator;
    };

/**
 * Every `E85DesignationValidity` state carries an explicit identity block:
 * district/zone-label-level identity only (no parcel-level identifier this
 * slice — deferred). Exact-string, case-sensitive matching; no
 * normalization (two labels differing only by a trailing qualifier, e.g. a
 * base code versus a suffixed sub-designation of it, are distinct
 * identities by design — never fuzzy-matched to each other).
 */
export interface E85DesignationIdentity {
  readonly jurisdictionId: string;
  readonly districtOrZoneId: string;
}

/**
 * Deterministic, non-clock evidence that a bounded end-review was actually
 * performed and found nothing. `reviewedAt` is a caller-supplied canonical
 * date (never `Date.now()` / `new Date()`), mirroring
 * `E85EndDateReviewEvidence` in version-validity-types.ts in spirit but
 * reimplemented locally (no import) and scoped to designation review.
 */
export interface E85DesignationEndReviewEvidence {
  readonly sourcesChecked: readonly string[];
  readonly reviewedAt: string;
}

interface E85DesignationKnownStartFields {
  readonly identity: E85DesignationIdentity;
  readonly start: E85DesignationStartAuthority;
}

interface E85DesignationKnownEndFields {
  readonly effectiveTo: string;
  readonly end: E85DesignationEndAuthority;
}

/**
 * The final, mutually-exclusive parcel-designation-validity vocabulary.
 * Exactly six states — no seventh/eighth is representable. A structurally
 * invalid interval (end before start) is represented as a
 * construction-time throw from `buildE85DesignationValidity`, mirroring
 * `E85VersionValidity`'s own treatment of `INVALID_INTERVAL`, rather than
 * as a constructible union member.
 *
 *   1. DESIGNATION_START_UNKNOWN — no credible start evidence at all;
 *      identity/provenance only, no start authority.
 *   2. CONFLICTING_DESIGNATION_START — two or more credible but mutually
 *      inconsistent start authorities (>= 2 required, no collapsing).
 *   3. OPEN_UNRESEARCHED — a start authority exists; no end research
 *      performed; forbids any end fields.
 *   4. OPEN_REVIEWED_NO_END_ESTABLISHED — a start authority exists and an
 *      end-review was performed and found nothing; forbids effectiveTo.
 *   5. CLOSED — both start and end authority established, with
 *      effectiveTo >= effectiveFrom (inclusive on both ends). The end
 *      authority must be a designation end-authority (never a legal-text
 *      end authority — this module has no such type to accept anyway).
 *   6. CONFLICTING_DESIGNATION_END — a start authority is established but
 *      two or more credible, mutually inconsistent end authorities exist.
 *
 * No CONDITIONAL_PARTIAL_TERMINATION-equivalent state exists — no evidence
 * category has been identified requiring one this slice.
 */
export type E85DesignationValidity =
  | ({ readonly state: "DESIGNATION_START_UNKNOWN" } & { readonly identity: E85DesignationIdentity })
  | ({ readonly state: "CONFLICTING_DESIGNATION_START" } & {
      readonly identity: E85DesignationIdentity;
      readonly conflictingStartAuthorities: readonly E85DesignationStartAuthority[];
    })
  | ({ readonly state: "OPEN_UNRESEARCHED" } & E85DesignationKnownStartFields)
  | ({ readonly state: "OPEN_REVIEWED_NO_END_ESTABLISHED" } & E85DesignationKnownStartFields & {
        readonly endReview: E85DesignationEndReviewEvidence;
      })
  | ({ readonly state: "CLOSED" } & E85DesignationKnownStartFields & E85DesignationKnownEndFields)
  | ({ readonly state: "CONFLICTING_DESIGNATION_END" } & E85DesignationKnownStartFields & {
        readonly conflictingEndAuthorities: readonly E85DesignationEndAuthority[];
      });

/**
 * Deterministic, reproducible error raised whenever a builder in this
 * module cannot honor its input. Never carries wall-clock time, object
 * identity, or any other nondeterministic content.
 */
export class E85DesignationValidityError extends Error {
  constructor(message: string) {
    super(`E85 designation validity error: ${message}`);
    this.name = "E85DesignationValidityError";
  }
}

/**
 * Strict full-date test (YYYY-MM-DD), including calendar validity.
 * Reimplemented locally (mirroring `isCanonicalDate` in
 * version-validity-types.ts) via pure integer arithmetic — deliberately NOT
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

function isNonEmptyLocator(locator: unknown): locator is E85DesignationInstrumentLocator {
  if (locator === undefined || locator === null || typeof locator !== "object") return false;
  const candidate = locator as Record<string, unknown>;
  const stringFields = ["instrumentId", "citationText", "section", "clause"] as const;
  if (stringFields.some((field) => isNonEmptyString(candidate[field]))) return true;
  return typeof candidate.page === "number";
}

function requireCanonicalDate(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !isCanonicalDate(value)) {
    throw new E85DesignationValidityError(`${fieldName} must be a canonical YYYY-MM-DD calendar date, got ${JSON.stringify(value)}.`);
  }
  return value;
}

function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (!isNonEmptyString(value)) {
    throw new E85DesignationValidityError(`${fieldName} must be a non-empty string, got ${JSON.stringify(value)}.`);
  }
  return value;
}

function requireInstrumentLocator(value: unknown, fieldName: string): E85DesignationInstrumentLocator {
  if (!isNonEmptyLocator(value)) {
    throw new E85DesignationValidityError(`${fieldName} must be a non-empty instrument locator, got ${JSON.stringify(value)}.`);
  }
  const candidate = value as Record<string, unknown>;
  const result: {
    instrumentId?: string;
    citationText?: string;
    section?: string;
    clause?: string;
    page?: number;
  } = {};
  if (candidate.instrumentId !== undefined) result.instrumentId = requireOptionalNonEmptyString(candidate.instrumentId, `${fieldName}.instrumentId`);
  if (candidate.citationText !== undefined) result.citationText = requireOptionalNonEmptyString(candidate.citationText, `${fieldName}.citationText`);
  if (candidate.section !== undefined) result.section = requireOptionalNonEmptyString(candidate.section, `${fieldName}.section`);
  if (candidate.clause !== undefined) result.clause = requireOptionalNonEmptyString(candidate.clause, `${fieldName}.clause`);
  if (candidate.page !== undefined) {
    if (typeof candidate.page !== "number") {
      throw new E85DesignationValidityError(`${fieldName}.page must be a number, got ${JSON.stringify(candidate.page)}.`);
    }
    result.page = candidate.page;
  }
  return result;
}

function requireOptionalNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new E85DesignationValidityError(`${fieldName} must be a non-empty string when present, got ${JSON.stringify(value)}.`);
  }
  return value;
}

function requireIdentity(value: unknown, fieldName: string): E85DesignationIdentity {
  if (value === null || typeof value !== "object") {
    throw new E85DesignationValidityError(`${fieldName} must be an object, got ${JSON.stringify(value)}.`);
  }
  const candidate = value as Record<string, unknown>;
  const jurisdictionId = requireNonEmptyString(candidate.jurisdictionId, `${fieldName}.jurisdictionId`);
  const districtOrZoneId = requireNonEmptyString(candidate.districtOrZoneId, `${fieldName}.districtOrZoneId`);
  const allowedKeys = new Set(["jurisdictionId", "districtOrZoneId"]);
  for (const key of Object.keys(candidate)) {
    if (!allowedKeys.has(key)) {
      throw new E85DesignationValidityError(`${fieldName} contains unrecognized field "${key}".`);
    }
  }
  return { jurisdictionId, districtOrZoneId };
}

function requireObservationMetadata(value: unknown, fieldName: string): E85DesignationObservationMetadata {
  if (value === null || typeof value !== "object") {
    throw new E85DesignationValidityError(`${fieldName} must be an object, got ${JSON.stringify(value)}.`);
  }
  const candidate = value as Record<string, unknown>;
  const observedAt = requireCanonicalDate(candidate.observedAt, `${fieldName}.observedAt`);
  const hasDatasetId = candidate.datasetId !== undefined;
  const hasSourceDescription = candidate.sourceDescription !== undefined;
  if (!hasDatasetId && !hasSourceDescription) {
    throw new E85DesignationValidityError(`${fieldName} requires at least one of datasetId or sourceDescription.`);
  }
  const result: { observedAt: string; datasetId?: string; sourceDescription?: string } = { observedAt };
  if (hasDatasetId) result.datasetId = requireOptionalNonEmptyString(candidate.datasetId, `${fieldName}.datasetId`);
  if (hasSourceDescription) result.sourceDescription = requireOptionalNonEmptyString(candidate.sourceDescription, `${fieldName}.sourceDescription`);
  const allowedKeys = new Set(["observedAt", "datasetId", "sourceDescription"]);
  for (const key of Object.keys(candidate)) {
    if (!allowedKeys.has(key)) {
      throw new E85DesignationValidityError(`${fieldName} contains unrecognized field "${key}".`);
    }
  }
  return result;
}

const START_AUTHORITY_KINDS = ["MAP_AMENDMENT_OPERATIVE_DATE", "PARCEL_SPECIFIC_INSTRUMENT", "OPEN_OBSERVATION_ASSERTION"] as const;
const END_AUTHORITY_KINDS = ["EXPRESS_REDESIGNATION", "EXPRESS_REPEAL_OF_INSTRUMENT"] as const;
const VALIDITY_STATES = [
  "DESIGNATION_START_UNKNOWN",
  "CONFLICTING_DESIGNATION_START",
  "OPEN_UNRESEARCHED",
  "OPEN_REVIEWED_NO_END_ESTABLISHED",
  "CLOSED",
  "CONFLICTING_DESIGNATION_END",
] as const;

/**
 * Validates and (re)constructs a fresh, non-mutated
 * `E85DesignationStartAuthority`. Pure and deterministic. Rejects any shape
 * outside the three closed variants.
 */
export function buildE85DesignationStartAuthority(input: unknown): E85DesignationStartAuthority {
  if (input === null || typeof input !== "object") {
    throw new E85DesignationValidityError(`designation start authority must be an object, got ${JSON.stringify(input)}.`);
  }
  const candidate = input as Record<string, unknown>;
  const kind = candidate.kind;

  if (kind === "MAP_AMENDMENT_OPERATIVE_DATE") {
    const allowedKeys = new Set(["kind", "effectiveFrom", "instrumentLocator"]);
    for (const key of Object.keys(candidate)) {
      if (!allowedKeys.has(key)) throw new E85DesignationValidityError(`MAP_AMENDMENT_OPERATIVE_DATE start authority contains forbidden field "${key}".`);
    }
    return {
      kind: "MAP_AMENDMENT_OPERATIVE_DATE",
      effectiveFrom: requireCanonicalDate(candidate.effectiveFrom, "effectiveFrom"),
      instrumentLocator: requireInstrumentLocator(candidate.instrumentLocator, "instrumentLocator"),
    };
  }

  if (kind === "PARCEL_SPECIFIC_INSTRUMENT") {
    const allowedKeys = new Set(["kind", "effectiveFrom", "instrumentLocator"]);
    for (const key of Object.keys(candidate)) {
      if (!allowedKeys.has(key)) throw new E85DesignationValidityError(`PARCEL_SPECIFIC_INSTRUMENT start authority contains forbidden field "${key}".`);
    }
    return {
      kind: "PARCEL_SPECIFIC_INSTRUMENT",
      effectiveFrom: requireCanonicalDate(candidate.effectiveFrom, "effectiveFrom"),
      instrumentLocator: requireInstrumentLocator(candidate.instrumentLocator, "instrumentLocator"),
    };
  }

  if (kind === "OPEN_OBSERVATION_ASSERTION") {
    const allowedKeys = new Set(["kind", "observation"]);
    for (const key of Object.keys(candidate)) {
      if (!allowedKeys.has(key)) {
        throw new E85DesignationValidityError(
          `OPEN_OBSERVATION_ASSERTION start authority contains forbidden field "${key}" (observation-only authorities may never carry an effective date field).`,
        );
      }
    }
    return {
      kind: "OPEN_OBSERVATION_ASSERTION",
      observation: requireObservationMetadata(candidate.observation, "observation"),
    };
  }

  throw new E85DesignationValidityError(
    `designation start authority kind must be one of ${JSON.stringify(START_AUTHORITY_KINDS)}, got ${JSON.stringify(kind)}.`,
  );
}

/**
 * Validates and (re)constructs a fresh, non-mutated
 * `E85DesignationEndAuthority`. Pure and deterministic. Rejects any shape
 * outside the two closed variants — there is no "absence from a later
 * dataset" kind representable here, by design.
 */
export function buildE85DesignationEndAuthority(input: unknown): E85DesignationEndAuthority {
  if (input === null || typeof input !== "object") {
    throw new E85DesignationValidityError(`designation end authority must be an object, got ${JSON.stringify(input)}.`);
  }
  const candidate = input as Record<string, unknown>;
  const kind = candidate.kind;
  const allowedKeys = new Set(["kind", "effectiveTo", "instrumentLocator"]);

  if (kind === "EXPRESS_REDESIGNATION") {
    for (const key of Object.keys(candidate)) {
      if (!allowedKeys.has(key)) throw new E85DesignationValidityError(`EXPRESS_REDESIGNATION end authority contains forbidden field "${key}".`);
    }
    return {
      kind: "EXPRESS_REDESIGNATION",
      effectiveTo: requireCanonicalDate(candidate.effectiveTo, "effectiveTo"),
      instrumentLocator: requireInstrumentLocator(candidate.instrumentLocator, "instrumentLocator"),
    };
  }

  if (kind === "EXPRESS_REPEAL_OF_INSTRUMENT") {
    for (const key of Object.keys(candidate)) {
      if (!allowedKeys.has(key)) throw new E85DesignationValidityError(`EXPRESS_REPEAL_OF_INSTRUMENT end authority contains forbidden field "${key}".`);
    }
    return {
      kind: "EXPRESS_REPEAL_OF_INSTRUMENT",
      effectiveTo: requireCanonicalDate(candidate.effectiveTo, "effectiveTo"),
      instrumentLocator: requireInstrumentLocator(candidate.instrumentLocator, "instrumentLocator"),
    };
  }

  throw new E85DesignationValidityError(
    `designation end authority kind must be one of ${JSON.stringify(END_AUTHORITY_KINDS)}, got ${JSON.stringify(kind)}.`,
  );
}

function distinctByKey<T>(items: readonly T[], key: (item: T) => string): number {
  return new Set(items.map(key)).size;
}

function startAuthorityDateKey(a: E85DesignationStartAuthority): string {
  if (a.kind === "OPEN_OBSERVATION_ASSERTION") return `OBS:${a.observation.observedAt}`;
  return `${a.kind}:${a.effectiveFrom}`;
}

function endAuthorityDateKey(a: E85DesignationEndAuthority): string {
  return `${a.kind}:${a.effectiveTo}`;
}

function assertGenuineConflict<T>(rebuilt: readonly T[], dateKey: (item: T) => string, label: string): void {
  if (rebuilt.length < 2) {
    throw new E85DesignationValidityError(`${label} requires at least two entries, got ${rebuilt.length}.`);
  }
  const serializedSet = new Set(rebuilt.map((a) => JSON.stringify(a)));
  if (serializedSet.size < rebuilt.length) {
    throw new E85DesignationValidityError(`${label} must not contain exact duplicate authority records.`);
  }
  const distinctDates = distinctByKey(rebuilt, dateKey);
  if (distinctDates < 2) {
    throw new E85DesignationValidityError(`${label} requires at least two genuinely distinct dates/observations, got ${distinctDates}.`);
  }
}

function validateEndReviewEvidence(value: unknown): E85DesignationEndReviewEvidence {
  if (value === null || typeof value !== "object") {
    throw new E85DesignationValidityError(`endReview must be an object, got ${JSON.stringify(value)}.`);
  }
  const candidate = value as Record<string, unknown>;
  const sourcesChecked = candidate.sourcesChecked;
  if (!Array.isArray(sourcesChecked) || sourcesChecked.length === 0 || !sourcesChecked.every(isNonEmptyString)) {
    throw new E85DesignationValidityError(`endReview.sourcesChecked must be a non-empty array of non-empty strings.`);
  }
  const reviewedAt = requireCanonicalDate(candidate.reviewedAt, "endReview.reviewedAt");
  const allowedKeys = new Set(["sourcesChecked", "reviewedAt"]);
  for (const key of Object.keys(candidate)) {
    if (!allowedKeys.has(key)) throw new E85DesignationValidityError(`endReview contains unrecognized field "${key}".`);
  }
  return { sourcesChecked: sourcesChecked.slice(), reviewedAt };
}

function buildKnownStart(candidate: Record<string, unknown>): E85DesignationKnownStartFields {
  const identity = requireIdentity(candidate.identity, "identity");
  const start = buildE85DesignationStartAuthority(candidate.start);
  return { identity, start };
}

/**
 * Validates and (re)constructs a fresh, non-mutated `E85DesignationValidity`.
 * Pure and deterministic: the same input always yields a deeply-equal
 * output or throws the same `E85DesignationValidityError`. The runtime
 * boundary parameter is `unknown` — this is the deliberate raw boundary
 * this contract exists to police; every field is validated before any
 * trusted value is constructed.
 *
 * DESIGN DECISION — a structurally invalid interval (a CLOSED-shaped input
 * whose `effectiveTo` precedes `effectiveFrom`) is rejected here as a
 * thrown `E85DesignationValidityError`, never represented as a state. This
 * mirrors `buildE85VersionValidity`'s treatment of its own eighth,
 * non-constructible `INVALID_INTERVAL` state.
 */
export function buildE85DesignationValidity(input: unknown): E85DesignationValidity {
  if (input === null || typeof input !== "object") {
    throw new E85DesignationValidityError(`designation validity must be an object, got ${JSON.stringify(input)}.`);
  }
  const candidate = input as Record<string, unknown>;
  const state = candidate.state;

  if (state === "DESIGNATION_START_UNKNOWN") {
    const allowedKeys = new Set(["state", "identity"]);
    for (const key of Object.keys(candidate)) {
      if (!allowedKeys.has(key)) throw new E85DesignationValidityError(`DESIGNATION_START_UNKNOWN contains forbidden field "${key}".`);
    }
    const identity = requireIdentity(candidate.identity, "identity");
    return { state: "DESIGNATION_START_UNKNOWN", identity };
  }

  if (state === "CONFLICTING_DESIGNATION_START") {
    const allowedKeys = new Set(["state", "identity", "conflictingStartAuthorities"]);
    for (const key of Object.keys(candidate)) {
      if (!allowedKeys.has(key)) throw new E85DesignationValidityError(`CONFLICTING_DESIGNATION_START contains forbidden field "${key}".`);
    }
    const identity = requireIdentity(candidate.identity, "identity");
    const rawList = candidate.conflictingStartAuthorities;
    if (!Array.isArray(rawList)) {
      throw new E85DesignationValidityError(`CONFLICTING_DESIGNATION_START.conflictingStartAuthorities must be an array.`);
    }
    const rebuilt = rawList.map((a) => buildE85DesignationStartAuthority(a));
    assertGenuineConflict(rebuilt, startAuthorityDateKey, "CONFLICTING_DESIGNATION_START.conflictingStartAuthorities");
    return { state: "CONFLICTING_DESIGNATION_START", identity, conflictingStartAuthorities: rebuilt };
  }

  if (state === "OPEN_UNRESEARCHED") {
    const allowedKeys = new Set(["state", "identity", "start"]);
    for (const key of Object.keys(candidate)) {
      if (!allowedKeys.has(key)) throw new E85DesignationValidityError(`OPEN_UNRESEARCHED contains forbidden field "${key}".`);
    }
    const knownStart = buildKnownStart(candidate);
    return { state: "OPEN_UNRESEARCHED", ...knownStart };
  }

  if (state === "OPEN_REVIEWED_NO_END_ESTABLISHED") {
    const allowedKeys = new Set(["state", "identity", "start", "endReview"]);
    for (const key of Object.keys(candidate)) {
      if (!allowedKeys.has(key)) throw new E85DesignationValidityError(`OPEN_REVIEWED_NO_END_ESTABLISHED contains forbidden field "${key}".`);
    }
    const knownStart = buildKnownStart(candidate);
    const endReview = validateEndReviewEvidence(candidate.endReview);
    return { state: "OPEN_REVIEWED_NO_END_ESTABLISHED", ...knownStart, endReview };
  }

  if (state === "CLOSED") {
    const allowedKeys = new Set(["state", "identity", "start", "effectiveTo", "end"]);
    for (const key of Object.keys(candidate)) {
      if (!allowedKeys.has(key)) throw new E85DesignationValidityError(`CLOSED contains forbidden field "${key}".`);
    }
    const knownStart = buildKnownStart(candidate);
    if (knownStart.start.kind === "OPEN_OBSERVATION_ASSERTION") {
      throw new E85DesignationValidityError(`CLOSED requires a dated start authority (MAP_AMENDMENT_OPERATIVE_DATE or PARCEL_SPECIFIC_INSTRUMENT); OPEN_OBSERVATION_ASSERTION carries no effectiveFrom.`);
    }
    const end = buildE85DesignationEndAuthority(candidate.end);
    const effectiveTo = requireCanonicalDate(candidate.effectiveTo, "effectiveTo");
    if (effectiveTo !== end.effectiveTo) {
      throw new E85DesignationValidityError(`effectiveTo "${effectiveTo}" does not match end authority's own effectiveTo "${end.effectiveTo}".`);
    }
    const effectiveFrom = knownStart.start.effectiveFrom;
    if (effectiveTo < effectiveFrom) {
      throw new E85DesignationValidityError(`CLOSED interval is structurally invalid: effectiveTo "${effectiveTo}" precedes effectiveFrom "${effectiveFrom}".`);
    }
    return { state: "CLOSED", ...knownStart, effectiveTo, end };
  }

  if (state === "CONFLICTING_DESIGNATION_END") {
    const allowedKeys = new Set(["state", "identity", "start", "conflictingEndAuthorities"]);
    for (const key of Object.keys(candidate)) {
      if (!allowedKeys.has(key)) throw new E85DesignationValidityError(`CONFLICTING_DESIGNATION_END contains forbidden field "${key}".`);
    }
    const knownStart = buildKnownStart(candidate);
    const rawList = candidate.conflictingEndAuthorities;
    if (!Array.isArray(rawList)) {
      throw new E85DesignationValidityError(`CONFLICTING_DESIGNATION_END.conflictingEndAuthorities must be an array.`);
    }
    const rebuilt = rawList.map((a) => buildE85DesignationEndAuthority(a));
    assertGenuineConflict(rebuilt, endAuthorityDateKey, "CONFLICTING_DESIGNATION_END.conflictingEndAuthorities");
    return { state: "CONFLICTING_DESIGNATION_END", ...knownStart, conflictingEndAuthorities: rebuilt };
  }

  throw new E85DesignationValidityError(
    `designation validity state must be one of ${JSON.stringify(VALIDITY_STATES)}, got ${JSON.stringify(state)}.`,
  );
}

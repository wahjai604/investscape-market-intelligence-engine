/**
 * InvestScape™ E85 Phase 15.3C — Temporal Request Contract, Slice 1.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Additive only. This module introduces a caller-facing temporal request
 * contract (`E85TemporalRequest`) and a pure normalization helper
 * (`resolveE85TemporalRequest`) that reconciles it against the legacy
 * `asOfDate` string still accepted by `E85EvaluationRequest`
 * (request-types.ts). Nothing here is wired into evaluators, composition,
 * linkage, adapters, or decision packages — that wiring is explicitly out of
 * scope for Slice 1.
 *
 * Design carried over unchanged from applicability.ts (Phase 4): no machine
 * clock is read anywhere in this file. "CURRENT" is preserved as a caller
 * intent, never resolved to a concrete date here — resolving CURRENT to an
 * actual as-of date is evaluator-time behavior, out of scope for this
 * request-shape module. Precision-aware comparison across differing date
 * granularities (month-only evidence vs. day-only request, etc.) is
 * explicitly deferred to a future Slice 2 and is NOT attempted here.
 */

/**
 * Caller intent for which point in time a request should be evaluated at.
 * "CURRENT" carries no date of its own — resolving it to a concrete date is
 * evaluator-time behavior, deliberately out of scope for this module.
 * "AS_OF" carries an explicit, caller-supplied ISO 8601 full date
 * (YYYY-MM-DD), validated by `isValidE85AsOfDate` below.
 */
export type E85TemporalRequest = { readonly mode: "CURRENT" } | { readonly mode: "AS_OF"; readonly asOfDate: string };

/**
 * The normalized, unambiguous outcome of reconciling a caller's
 * `temporalRequest` against the legacy `asOfDate` string. "ABSENT" is
 * returned when neither was supplied — Slice 1 never defaults an absent
 * request to CURRENT, and never reads the machine clock to invent one.
 */
export type E85ResolvedTemporalRequest = { readonly kind: "ABSENT" } | { readonly kind: "RESOLVED"; readonly request: E85TemporalRequest };

/**
 * Strict full-date test (YYYY-MM-DD), including calendar validity (real
 * month, real day for that month, real leap years). Deliberately NOT
 * implemented via `new Date(...)` parsing, which silently normalizes
 * invalid dates (e.g. "2026-02-30" becomes March 2) rather than rejecting
 * them — see module doc. No locale-aware parsing (`Date.parse`, `Intl`) is
 * used either. Whitespace of any kind, a time component, non-zero-padded
 * fields, and month-only values are all rejected, never trimmed or widened.
 */
export function isValidE85AsOfDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

/**
 * Deterministic, reproducible error raised whenever
 * `resolveE85TemporalRequest` cannot honor its input — malformed request
 * shape, an invalid AS_OF date, or a conflict between `temporalRequest` and
 * the legacy `asOfDate`. Never carries wall-clock time, object identity, or
 * any other nondeterministic content; the same offending input always
 * produces the same message.
 */
export class E85TemporalRequestError extends Error {
  constructor(message: string) {
    super(`E85 temporal request error: ${message}`);
    this.name = "E85TemporalRequestError";
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Validates that `value` is actually shaped like an `E85TemporalRequest` at
 * a loosely-typed/`unknown` boundary. Malformed or unrecognized shapes are
 * rejected here rather than silently coerced.
 */
function assertWellFormedTemporalRequest(value: unknown): asserts value is E85TemporalRequest {
  if (!isPlainObject(value)) {
    throw new E85TemporalRequestError(`temporalRequest must be an object, got ${JSON.stringify(value)}.`);
  }
  const mode = value["mode"];
  if (mode === "CURRENT") {
    return;
  }
  if (mode === "AS_OF") {
    const asOfDate = value["asOfDate"];
    if (typeof asOfDate !== "string") {
      throw new E85TemporalRequestError(`temporalRequest with mode AS_OF must carry a string asOfDate, got ${JSON.stringify(asOfDate)}.`);
    }
    if (!isValidE85AsOfDate(asOfDate)) {
      throw new E85TemporalRequestError(`temporalRequest.asOfDate "${asOfDate}" is not a valid full ISO 8601 date (YYYY-MM-DD).`);
    }
    return;
  }
  throw new E85TemporalRequestError(`temporalRequest.mode must be "CURRENT" or "AS_OF", got ${JSON.stringify(mode)}.`);
}

/**
 * Reconciles a caller's new `temporalRequest` against the legacy `asOfDate`
 * string still accepted elsewhere, producing exactly one unambiguous
 * `E85ResolvedTemporalRequest`. Pure and deterministic: given the same two
 * inputs, always returns the same result or throws the same error. Never
 * reads `Date.now()` or constructs `new Date()`, and never defaults an
 * absent request to CURRENT.
 *
 * Reconciliation rules:
 *   1. Neither supplied                          -> { kind: "ABSENT" }.
 *   2. Legacy `asOfDate` only                     -> validated, normalized to AS_OF.
 *   3. `temporalRequest` CURRENT only              -> preserved as CURRENT, no date attached.
 *   4. `temporalRequest` AS_OF only                -> validated, preserved.
 *   5. AS_OF `temporalRequest` + identical legacy  -> accepted (they agree).
 *   6. AS_OF `temporalRequest` + different legacy  -> throws (deterministic conflict).
 *   7. CURRENT `temporalRequest` + any legacy date -> throws (CURRENT carries no date to agree with).
 *   8. Malformed/unknown-shaped `temporalRequest`  -> throws, never silently coerced.
 */
export function resolveE85TemporalRequest(temporalRequest: unknown | undefined, asOfDate: string | undefined): E85ResolvedTemporalRequest {
  const hasTemporalRequest = temporalRequest !== undefined;
  const hasLegacyAsOfDate = asOfDate !== undefined;

  if (!hasTemporalRequest && !hasLegacyAsOfDate) {
    return { kind: "ABSENT" };
  }

  if (!hasTemporalRequest) {
    const legacy = asOfDate as string;
    if (!isValidE85AsOfDate(legacy)) {
      throw new E85TemporalRequestError(`asOfDate "${legacy}" is not a valid full ISO 8601 date (YYYY-MM-DD).`);
    }
    return { kind: "RESOLVED", request: { mode: "AS_OF", asOfDate: legacy } };
  }

  assertWellFormedTemporalRequest(temporalRequest);

  if (temporalRequest.mode === "CURRENT") {
    if (hasLegacyAsOfDate) {
      throw new E85TemporalRequestError(
        `temporalRequest mode CURRENT conflicts with legacy asOfDate "${asOfDate}": CURRENT carries no date to reconcile against.`,
      );
    }
    return { kind: "RESOLVED", request: { mode: "CURRENT" } };
  }

  // mode === "AS_OF"
  if (hasLegacyAsOfDate && asOfDate !== temporalRequest.asOfDate) {
    throw new E85TemporalRequestError(
      `temporalRequest.asOfDate "${temporalRequest.asOfDate}" conflicts with legacy asOfDate "${asOfDate}".`,
    );
  }
  return { kind: "RESOLVED", request: { mode: "AS_OF", asOfDate: temporalRequest.asOfDate } };
}

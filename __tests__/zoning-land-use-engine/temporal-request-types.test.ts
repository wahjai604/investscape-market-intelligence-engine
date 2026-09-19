/**
 * InvestScape™ E85 Phase 15.3C — temporal request contract tests, Slice 1.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 */
import {
  resolveE85TemporalRequest,
  isValidE85AsOfDate,
  E85TemporalRequestError,
  E85TemporalRequest,
} from "../../src/zoning-land-use-engine/temporal-request-types";

describe("E85 Phase 15.3C — resolveE85TemporalRequest reconciliation", () => {
  test("neither temporalRequest nor legacy asOfDate supplied -> ABSENT", () => {
    expect(resolveE85TemporalRequest(undefined, undefined)).toEqual({ kind: "ABSENT" });
  });

  test("legacy asOfDate only -> normalized to AS_OF", () => {
    expect(resolveE85TemporalRequest(undefined, "2026-06-15")).toEqual({
      kind: "RESOLVED",
      request: { mode: "AS_OF", asOfDate: "2026-06-15" },
    });
  });

  test("temporalRequest CURRENT only -> preserved, no date attached", () => {
    const result = resolveE85TemporalRequest({ mode: "CURRENT" }, undefined);
    expect(result).toEqual({ kind: "RESOLVED", request: { mode: "CURRENT" } });
    expect(JSON.stringify(result)).not.toMatch(/asOfDate/);
  });

  test("temporalRequest AS_OF only -> validated and preserved", () => {
    expect(resolveE85TemporalRequest({ mode: "AS_OF", asOfDate: "2026-06-15" }, undefined)).toEqual({
      kind: "RESOLVED",
      request: { mode: "AS_OF", asOfDate: "2026-06-15" },
    });
  });

  test("AS_OF temporalRequest plus IDENTICAL legacy asOfDate -> accepted, no throw", () => {
    expect(resolveE85TemporalRequest({ mode: "AS_OF", asOfDate: "2026-06-15" }, "2026-06-15")).toEqual({
      kind: "RESOLVED",
      request: { mode: "AS_OF", asOfDate: "2026-06-15" },
    });
  });

  test("AS_OF temporalRequest plus CONFLICTING legacy asOfDate -> deterministic throw", () => {
    expect(() => resolveE85TemporalRequest({ mode: "AS_OF", asOfDate: "2026-06-15" }, "2026-06-16")).toThrow(
      'temporalRequest.asOfDate "2026-06-15" conflicts with legacy asOfDate "2026-06-16".',
    );
  });

  test("CURRENT temporalRequest plus any legacy asOfDate -> deterministic throw", () => {
    expect(() => resolveE85TemporalRequest({ mode: "CURRENT" }, "2026-06-15")).toThrow(
      'temporalRequest mode CURRENT conflicts with legacy asOfDate "2026-06-15": CURRENT carries no date to reconcile against.',
    );
  });

  test("invalid mode via a runtime-shaped input -> deterministic throw", () => {
    const malformed = { mode: "SOMETIME" } as unknown as E85TemporalRequest;
    expect(() => resolveE85TemporalRequest(malformed, undefined)).toThrow(E85TemporalRequestError);
  });

  test("a non-object runtime input -> deterministic throw", () => {
    const malformed = "not-a-request" as unknown as E85TemporalRequest;
    expect(() => resolveE85TemporalRequest(malformed, undefined)).toThrow(E85TemporalRequestError);
  });

  test("repeated normalization is deterministic", () => {
    const first = resolveE85TemporalRequest({ mode: "AS_OF", asOfDate: "2026-06-15" }, undefined);
    const second = resolveE85TemporalRequest({ mode: "AS_OF", asOfDate: "2026-06-15" }, undefined);
    expect(first).toEqual(second);
  });

  test("no input mutation", () => {
    const input: E85TemporalRequest = { mode: "AS_OF", asOfDate: "2026-06-15" };
    const before = JSON.stringify(input);
    resolveE85TemporalRequest(input, undefined);
    expect(JSON.stringify(input)).toBe(before);
  });

  test("no implicit current date and no clock reads for CURRENT mode", () => {
    const dateSpy = jest.spyOn(global, "Date");
    const result = resolveE85TemporalRequest({ mode: "CURRENT" }, undefined);
    expect(dateSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: "RESOLVED", request: { mode: "CURRENT" } });
    dateSpy.mockRestore();
  });

  test("no clock reads for AS_OF mode normalization", () => {
    const dateSpy = jest.spyOn(global, "Date");
    resolveE85TemporalRequest({ mode: "AS_OF", asOfDate: "2026-06-15" }, undefined);
    expect(dateSpy).not.toHaveBeenCalled();
    dateSpy.mockRestore();
  });
});

describe("E85 Phase 15.3C — isValidE85AsOfDate boundary", () => {
  test("empty string is rejected", () => {
    expect(isValidE85AsOfDate("")).toBe(false);
  });

  test("non-zero-padded date is rejected", () => {
    expect(isValidE85AsOfDate("2026-1-5")).toBe(false);
  });

  test("month-only value is rejected", () => {
    expect(isValidE85AsOfDate("2026-06")).toBe(false);
  });

  test("timestamp input is rejected", () => {
    expect(isValidE85AsOfDate("2026-06-15T00:00:00Z")).toBe(false);
  });

  test("invalid month (13) is rejected", () => {
    expect(isValidE85AsOfDate("2026-13-01")).toBe(false);
  });

  test("invalid month (00) is rejected", () => {
    expect(isValidE85AsOfDate("2026-00-01")).toBe(false);
  });

  test("invalid day: April 31 is rejected", () => {
    expect(isValidE85AsOfDate("2026-04-31")).toBe(false);
  });

  test("invalid day: Feb 30 is rejected", () => {
    expect(isValidE85AsOfDate("2026-02-30")).toBe(false);
  });

  test("invalid day: day 00 is rejected", () => {
    expect(isValidE85AsOfDate("2026-06-00")).toBe(false);
  });

  test("invalid day: day 32 is rejected", () => {
    expect(isValidE85AsOfDate("2026-06-32")).toBe(false);
  });

  test("non-leap-year February 29 is rejected", () => {
    expect(isValidE85AsOfDate("2025-02-29")).toBe(false);
  });

  test("valid leap-year February 29 is accepted", () => {
    expect(isValidE85AsOfDate("2024-02-29")).toBe(true);
    expect(isValidE85AsOfDate("2028-02-29")).toBe(true);
  });

  test("leading/trailing whitespace is rejected", () => {
    expect(isValidE85AsOfDate(" 2026-06-15")).toBe(false);
    expect(isValidE85AsOfDate("2026-06-15 ")).toBe(false);
  });

  test("a genuinely valid date is accepted", () => {
    expect(isValidE85AsOfDate("2026-06-15")).toBe(true);
  });
});

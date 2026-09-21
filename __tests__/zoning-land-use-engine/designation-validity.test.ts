/**
 * InvestScape™ E85 Phase 15.20B — parcel-designation-validity contract
 * tests, Slice 3G-1.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Synthetic identifiers only (SYNTH-JURISDICTION-1 / SYNTH-ZONE-TEST-1 /
 * SYNTH-INSTRUMENT-*) — no real R1-1/C-2C/Feature 494642/Vancouver/Burnaby
 * value is imported or referenced anywhere here.
 */
import * as fs from "fs";
import * as path from "path";
import {
  buildE85DesignationStartAuthority,
  buildE85DesignationEndAuthority,
  buildE85DesignationValidity,
  E85DesignationValidityError,
  E85DesignationStartAuthority,
  E85DesignationEndAuthority,
  E85DesignationValidity,
  E85DesignationInstrumentLocator,
  E85DesignationIdentity,
} from "../../src/zoning-land-use-engine/designation-validity-types";

const LOCATOR: E85DesignationInstrumentLocator = { instrumentId: "SYNTH-INSTRUMENT-1", clause: "1" };
const LOCATOR_2: E85DesignationInstrumentLocator = { instrumentId: "SYNTH-INSTRUMENT-2", clause: "2" };

const IDENTITY: E85DesignationIdentity = { jurisdictionId: "SYNTH-JURISDICTION-1", districtOrZoneId: "SYNTH-ZONE-TEST-1" };

function mapAmendment(overrides: Partial<Extract<E85DesignationStartAuthority, { kind: "MAP_AMENDMENT_OPERATIVE_DATE" }>> = {}): E85DesignationStartAuthority {
  return {
    kind: "MAP_AMENDMENT_OPERATIVE_DATE",
    effectiveFrom: "2020-01-01",
    instrumentLocator: LOCATOR,
    ...overrides,
  };
}

function parcelInstrument(overrides: Partial<Extract<E85DesignationStartAuthority, { kind: "PARCEL_SPECIFIC_INSTRUMENT" }>> = {}): E85DesignationStartAuthority {
  return {
    kind: "PARCEL_SPECIFIC_INSTRUMENT",
    effectiveFrom: "2020-01-01",
    instrumentLocator: LOCATOR,
    ...overrides,
  };
}

function observationAssertion(overrides: Partial<Extract<E85DesignationStartAuthority, { kind: "OPEN_OBSERVATION_ASSERTION" }>> = {}): E85DesignationStartAuthority {
  return {
    kind: "OPEN_OBSERVATION_ASSERTION",
    observation: { observedAt: "2023-06-15", datasetId: "SYNTH-DATASET-1" },
    ...overrides,
  };
}

function expressRedesignation(overrides: Partial<Extract<E85DesignationEndAuthority, { kind: "EXPRESS_REDESIGNATION" }>> = {}): E85DesignationEndAuthority {
  return {
    kind: "EXPRESS_REDESIGNATION",
    effectiveTo: "2021-12-31",
    instrumentLocator: LOCATOR_2,
    ...overrides,
  };
}

function expressRepealOfInstrument(overrides: Partial<Extract<E85DesignationEndAuthority, { kind: "EXPRESS_REPEAL_OF_INSTRUMENT" }>> = {}): E85DesignationEndAuthority {
  return {
    kind: "EXPRESS_REPEAL_OF_INSTRUMENT",
    effectiveTo: "2021-12-31",
    instrumentLocator: LOCATOR_2,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// A. One positive test per valid state (all six) + start-authority tests.
// ---------------------------------------------------------------------------

describe("A. buildE85DesignationStartAuthority — positive", () => {
  test("MAP_AMENDMENT_OPERATIVE_DATE is accepted", () => {
    expect(buildE85DesignationStartAuthority(mapAmendment())).toEqual(mapAmendment());
  });

  test("PARCEL_SPECIFIC_INSTRUMENT is accepted", () => {
    expect(buildE85DesignationStartAuthority(parcelInstrument())).toEqual(parcelInstrument());
  });

  test("OPEN_OBSERVATION_ASSERTION is accepted (D. observation-only evidence)", () => {
    const result = buildE85DesignationStartAuthority(observationAssertion());
    expect(result).toEqual(observationAssertion());
    expect(result.kind).toBe("OPEN_OBSERVATION_ASSERTION");
    if (result.kind === "OPEN_OBSERVATION_ASSERTION") {
      expect(result.observation.observedAt).toBe("2023-06-15");
      // No effectiveFrom/effectiveTo is present anywhere on this object.
      expect(Object.keys(result)).toEqual(["kind", "observation"]);
    }
  });
});

describe("A/B. buildE85DesignationValidity — all six states, positive", () => {
  test("1. DESIGNATION_START_UNKNOWN", () => {
    const input: E85DesignationValidity = { state: "DESIGNATION_START_UNKNOWN", identity: IDENTITY };
    const result = buildE85DesignationValidity(input);
    expect(result).toEqual(input);
    expect(result.state).toBe("DESIGNATION_START_UNKNOWN");
  });

  test("2. CONFLICTING_DESIGNATION_START (>=2 distinct)", () => {
    const input: E85DesignationValidity = {
      state: "CONFLICTING_DESIGNATION_START",
      identity: IDENTITY,
      conflictingStartAuthorities: [mapAmendment(), parcelInstrument({ effectiveFrom: "2020-02-01" })],
    };
    const result = buildE85DesignationValidity(input);
    expect(result.state).toBe("CONFLICTING_DESIGNATION_START");
    if (result.state === "CONFLICTING_DESIGNATION_START") {
      expect(result.conflictingStartAuthorities).toHaveLength(2);
    }
  });

  test("3. OPEN_UNRESEARCHED", () => {
    const input: E85DesignationValidity = { state: "OPEN_UNRESEARCHED", identity: IDENTITY, start: mapAmendment() };
    expect(buildE85DesignationValidity(input)).toEqual(input);
  });

  test("4. OPEN_REVIEWED_NO_END_ESTABLISHED", () => {
    const input: E85DesignationValidity = {
      state: "OPEN_REVIEWED_NO_END_ESTABLISHED",
      identity: IDENTITY,
      start: mapAmendment(),
      endReview: { sourcesChecked: ["SYNTH-SOURCE-1"], reviewedAt: "2026-01-01" },
    };
    expect(buildE85DesignationValidity(input)).toEqual(input);
  });

  test("5. CLOSED (B. bounded interval, exact fields preserved, no legal-text-alignment claim added)", () => {
    const input: E85DesignationValidity = {
      state: "CLOSED",
      identity: IDENTITY,
      start: mapAmendment(),
      effectiveTo: "2021-12-31",
      end: expressRepealOfInstrument(),
    };
    const result = buildE85DesignationValidity(input);
    expect(result).toEqual(input);
    expect(Object.keys(result).sort()).toEqual(["effectiveTo", "end", "identity", "start", "state"].sort());
  });

  test("5b. single-day CLOSED interval (effectiveTo === effectiveFrom) is accepted", () => {
    const input: E85DesignationValidity = {
      state: "CLOSED",
      identity: IDENTITY,
      start: mapAmendment({ effectiveFrom: "2020-01-01" }),
      effectiveTo: "2020-01-01",
      end: expressRepealOfInstrument({ effectiveTo: "2020-01-01" }),
    };
    expect(buildE85DesignationValidity(input).state).toBe("CLOSED");
  });

  test("6. CONFLICTING_DESIGNATION_END", () => {
    const input: E85DesignationValidity = {
      state: "CONFLICTING_DESIGNATION_END",
      identity: IDENTITY,
      start: mapAmendment(),
      conflictingEndAuthorities: [expressRedesignation(), expressRepealOfInstrument({ effectiveTo: "2022-06-30" })],
    };
    const result = buildE85DesignationValidity(input);
    expect(result.state).toBe("CONFLICTING_DESIGNATION_END");
  });
});

// ---------------------------------------------------------------------------
// C. Open states — no effectiveTo synthesized, no "current" inferred.
// ---------------------------------------------------------------------------

describe("C. open designation assertions", () => {
  test("OPEN_UNRESEARCHED never carries an effectiveTo/end field", () => {
    const input: E85DesignationValidity = { state: "OPEN_UNRESEARCHED", identity: IDENTITY, start: mapAmendment() };
    const result = buildE85DesignationValidity(input);
    expect("effectiveTo" in result).toBe(false);
    expect("end" in result).toBe(false);
  });

  test("OPEN_REVIEWED_NO_END_ESTABLISHED never carries an effectiveTo/end field", () => {
    const input: E85DesignationValidity = {
      state: "OPEN_REVIEWED_NO_END_ESTABLISHED",
      identity: IDENTITY,
      start: mapAmendment(),
      endReview: { sourcesChecked: ["SYNTH-SOURCE-1"], reviewedAt: "2026-01-01" },
    };
    const result = buildE85DesignationValidity(input);
    expect("effectiveTo" in result).toBe(false);
    expect("end" in result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// E. Unknown/incomplete/conflicting: exact required evidence, no fabrication.
// ---------------------------------------------------------------------------

describe("E. unknown/incomplete/conflicting evidence", () => {
  test("DESIGNATION_START_UNKNOWN carries no start authority and no interval", () => {
    const result = buildE85DesignationValidity({ state: "DESIGNATION_START_UNKNOWN", identity: IDENTITY });
    expect("start" in result).toBe(false);
    expect("effectiveTo" in result).toBe(false);
  });

  test("CONFLICTING_DESIGNATION_START preserves both conflicting records distinctly (no collapse)", () => {
    const a = mapAmendment();
    const b = parcelInstrument({ effectiveFrom: "2020-02-01" });
    const result = buildE85DesignationValidity({
      state: "CONFLICTING_DESIGNATION_START",
      identity: IDENTITY,
      conflictingStartAuthorities: [a, b],
    });
    if (result.state === "CONFLICTING_DESIGNATION_START") {
      expect(result.conflictingStartAuthorities).toEqual([a, b]);
    }
  });

  test("states remain distinct: DESIGNATION_START_UNKNOWN !== CONFLICTING_DESIGNATION_START shape", () => {
    const unknown = buildE85DesignationValidity({ state: "DESIGNATION_START_UNKNOWN", identity: IDENTITY });
    expect(Object.keys(unknown).sort()).toEqual(["identity", "state"].sort());
  });
});

// ---------------------------------------------------------------------------
// F. Invalid date syntax rejected.
// ---------------------------------------------------------------------------

describe("F. invalid date syntax", () => {
  test("malformed start date rejected", () => {
    expect(() => buildE85DesignationStartAuthority(mapAmendment({ effectiveFrom: "2020-13-40" }))).toThrow(E85DesignationValidityError);
  });

  test("invalid calendar date (April 31) rejected", () => {
    expect(() => buildE85DesignationStartAuthority(mapAmendment({ effectiveFrom: "2020-04-31" }))).toThrow(E85DesignationValidityError);
  });

  test("valid leap day accepted", () => {
    expect(buildE85DesignationStartAuthority(mapAmendment({ effectiveFrom: "2024-02-29" })).kind).toBe("MAP_AMENDMENT_OPERATIVE_DATE");
  });

  test("invalid leap day (2023) rejected", () => {
    expect(() => buildE85DesignationStartAuthority(mapAmendment({ effectiveFrom: "2023-02-29" }))).toThrow(E85DesignationValidityError);
  });

  test("malformed end date rejected", () => {
    expect(() => buildE85DesignationEndAuthority(expressRedesignation({ effectiveTo: "2021-02-30" }))).toThrow(E85DesignationValidityError);
  });

  test("malformed observation date rejected", () => {
    expect(() => buildE85DesignationStartAuthority(observationAssertion({ observation: { observedAt: "2023-99-99", datasetId: "X" } }))).toThrow(
      E85DesignationValidityError,
    );
  });

  test("malformed endReview.reviewedAt rejected", () => {
    const input = {
      state: "OPEN_REVIEWED_NO_END_ESTABLISHED",
      identity: IDENTITY,
      start: mapAmendment(),
      endReview: { sourcesChecked: ["S"], reviewedAt: "not-a-date" },
    } as unknown as E85DesignationValidity;
    expect(() => buildE85DesignationValidity(input)).toThrow(E85DesignationValidityError);
  });
});

// ---------------------------------------------------------------------------
// G. Invalid interval (end before start).
// ---------------------------------------------------------------------------

describe("G. invalid interval", () => {
  test("end before start is rejected (structural invalid-interval throw)", () => {
    const input: E85DesignationValidity = {
      state: "CLOSED",
      identity: IDENTITY,
      start: mapAmendment({ effectiveFrom: "2021-01-01" }),
      effectiveTo: "2020-01-01",
      end: expressRepealOfInstrument({ effectiveTo: "2020-01-01" }),
    };
    expect(() => buildE85DesignationValidity(input)).toThrow(E85DesignationValidityError);
    expect(() => buildE85DesignationValidity(input)).toThrow(/structurally invalid/);
  });

  test("endpoint mismatch between wrapper effectiveTo and end.effectiveTo is rejected", () => {
    const input: E85DesignationValidity = {
      state: "CLOSED",
      identity: IDENTITY,
      start: mapAmendment(),
      effectiveTo: "2021-11-30",
      end: expressRepealOfInstrument({ effectiveTo: "2021-12-31" }),
    };
    expect(() => buildE85DesignationValidity(input)).toThrow(/does not match end authority's own effectiveTo/);
  });
});

// ---------------------------------------------------------------------------
// H. Missing required fields per state family.
// ---------------------------------------------------------------------------

describe("H. missing required fields", () => {
  test("missing identity on DESIGNATION_START_UNKNOWN rejected", () => {
    const input = { state: "DESIGNATION_START_UNKNOWN" } as unknown as E85DesignationValidity;
    expect(() => buildE85DesignationValidity(input)).toThrow(E85DesignationValidityError);
  });

  test("missing jurisdictionId rejected", () => {
    const input = { state: "DESIGNATION_START_UNKNOWN", identity: { districtOrZoneId: "SYNTH-ZONE-TEST-1" } } as unknown as E85DesignationValidity;
    expect(() => buildE85DesignationValidity(input)).toThrow(E85DesignationValidityError);
  });

  test("missing districtOrZoneId rejected", () => {
    const input = { state: "DESIGNATION_START_UNKNOWN", identity: { jurisdictionId: "SYNTH-JURISDICTION-1" } } as unknown as E85DesignationValidity;
    expect(() => buildE85DesignationValidity(input)).toThrow(E85DesignationValidityError);
  });

  test("empty jurisdictionId rejected", () => {
    expect(() => buildE85DesignationValidity({ state: "DESIGNATION_START_UNKNOWN", identity: { jurisdictionId: "", districtOrZoneId: "Z" } })).toThrow(
      E85DesignationValidityError,
    );
  });

  test("missing start authority on OPEN_UNRESEARCHED rejected", () => {
    const input = { state: "OPEN_UNRESEARCHED", identity: IDENTITY } as unknown as E85DesignationValidity;
    expect(() => buildE85DesignationValidity(input)).toThrow(E85DesignationValidityError);
  });

  test("missing instrumentLocator on MAP_AMENDMENT_OPERATIVE_DATE rejected", () => {
    const input = { kind: "MAP_AMENDMENT_OPERATIVE_DATE", effectiveFrom: "2020-01-01" } as unknown as E85DesignationStartAuthority;
    expect(() => buildE85DesignationStartAuthority(input)).toThrow(E85DesignationValidityError);
  });

  test("empty instrumentLocator rejected", () => {
    expect(() => buildE85DesignationStartAuthority(mapAmendment({ instrumentLocator: {} }))).toThrow(E85DesignationValidityError);
  });

  test("missing observation on OPEN_OBSERVATION_ASSERTION rejected", () => {
    const input = { kind: "OPEN_OBSERVATION_ASSERTION" } as unknown as E85DesignationStartAuthority;
    expect(() => buildE85DesignationStartAuthority(input)).toThrow(E85DesignationValidityError);
  });

  test("observation missing both datasetId and sourceDescription rejected", () => {
    const input = { kind: "OPEN_OBSERVATION_ASSERTION", observation: { observedAt: "2023-01-01" } } as unknown as E85DesignationStartAuthority;
    expect(() => buildE85DesignationStartAuthority(input)).toThrow(E85DesignationValidityError);
  });

  test("missing endReview on OPEN_REVIEWED_NO_END_ESTABLISHED rejected", () => {
    const input = { state: "OPEN_REVIEWED_NO_END_ESTABLISHED", identity: IDENTITY, start: mapAmendment() } as unknown as E85DesignationValidity;
    expect(() => buildE85DesignationValidity(input)).toThrow(E85DesignationValidityError);
  });

  test("endReview missing sourcesChecked rejected", () => {
    const input = {
      state: "OPEN_REVIEWED_NO_END_ESTABLISHED",
      identity: IDENTITY,
      start: mapAmendment(),
      endReview: { reviewedAt: "2026-01-01" },
    } as unknown as E85DesignationValidity;
    expect(() => buildE85DesignationValidity(input)).toThrow(E85DesignationValidityError);
  });

  test("CLOSED missing end authority rejected", () => {
    const input = { state: "CLOSED", identity: IDENTITY, start: mapAmendment(), effectiveTo: "2021-12-31" } as unknown as E85DesignationValidity;
    expect(() => buildE85DesignationValidity(input)).toThrow(E85DesignationValidityError);
  });

  test("CONFLICTING_DESIGNATION_START missing conflictingStartAuthorities rejected", () => {
    const input = { state: "CONFLICTING_DESIGNATION_START", identity: IDENTITY } as unknown as E85DesignationValidity;
    expect(() => buildE85DesignationValidity(input)).toThrow(E85DesignationValidityError);
  });
});

// ---------------------------------------------------------------------------
// I. Forbidden fields.
// ---------------------------------------------------------------------------

describe("I. forbidden fields", () => {
  test("OPEN_OBSERVATION_ASSERTION with effectiveFrom is rejected", () => {
    const input = { kind: "OPEN_OBSERVATION_ASSERTION", effectiveFrom: "2020-01-01", observation: { observedAt: "2020-01-01", datasetId: "X" } } as unknown as E85DesignationStartAuthority;
    expect(() => buildE85DesignationStartAuthority(input)).toThrow(E85DesignationValidityError);
  });

  test("DESIGNATION_START_UNKNOWN with fabricated interval fields is rejected", () => {
    const input = { state: "DESIGNATION_START_UNKNOWN", identity: IDENTITY, effectiveFrom: "2020-01-01" } as unknown as E85DesignationValidity;
    expect(() => buildE85DesignationValidity(input)).toThrow(E85DesignationValidityError);
  });

  test("CLOSED missing authority (only effectiveTo, no end object) is rejected", () => {
    const input = { state: "CLOSED", identity: IDENTITY, start: mapAmendment(), effectiveTo: "2021-12-31", end: undefined } as unknown as E85DesignationValidity;
    expect(() => buildE85DesignationValidity(input)).toThrow(E85DesignationValidityError);
  });

  test("OPEN_UNRESEARCHED with forbidden end date is rejected", () => {
    const input = { state: "OPEN_UNRESEARCHED", identity: IDENTITY, start: mapAmendment(), effectiveTo: "2021-12-31" } as unknown as E85DesignationValidity;
    expect(() => buildE85DesignationValidity(input)).toThrow(E85DesignationValidityError);
  });

  test("CONFLICTING_DESIGNATION_START collapsed to a single entry is rejected", () => {
    const input: E85DesignationValidity = {
      state: "CONFLICTING_DESIGNATION_START",
      identity: IDENTITY,
      conflictingStartAuthorities: [mapAmendment()],
    };
    expect(() => buildE85DesignationValidity(input)).toThrow(/requires at least two/);
  });

  test("CONFLICTING_DESIGNATION_END collapsed to a single entry is rejected", () => {
    const input: E85DesignationValidity = {
      state: "CONFLICTING_DESIGNATION_END",
      identity: IDENTITY,
      start: mapAmendment(),
      conflictingEndAuthorities: [expressRedesignation()],
    };
    expect(() => buildE85DesignationValidity(input)).toThrow(/requires at least two/);
  });

  test("authority inappropriate for the state: a legal-text-style eventKind shape is rejected as unrecognized kind", () => {
    const legalTextShaped = {
      eventKind: "COMMENCEMENT",
      effectiveFrom: "2020-01-01",
      authoritySourceId: "X",
      authoritySourceVersionId: "Y",
      commencementLocator: { bylawOrDocumentId: "Z" },
      effectiveDateBasis: "SOURCE_STATED",
    } as unknown as E85DesignationStartAuthority;
    expect(() => buildE85DesignationStartAuthority(legalTextShaped)).toThrow(/kind must be one of/);
  });

  test("CLOSED end authority reusing a start-authority kind is rejected", () => {
    const input = {
      state: "CLOSED",
      identity: IDENTITY,
      start: mapAmendment(),
      effectiveTo: "2021-12-31",
      end: { kind: "MAP_AMENDMENT_OPERATIVE_DATE", effectiveTo: "2021-12-31", instrumentLocator: LOCATOR_2 },
    } as unknown as E85DesignationValidity;
    expect(() => buildE85DesignationValidity(input)).toThrow(E85DesignationValidityError);
  });

  test("CLOSED with OPEN_OBSERVATION_ASSERTION as start is rejected (no effectiveFrom to anchor interval)", () => {
    const input = {
      state: "CLOSED",
      identity: IDENTITY,
      start: observationAssertion(),
      effectiveTo: "2021-12-31",
      end: expressRepealOfInstrument(),
    } as unknown as E85DesignationValidity;
    expect(() => buildE85DesignationValidity(input)).toThrow(E85DesignationValidityError);
  });
});

// ---------------------------------------------------------------------------
// J. Unknown discriminant.
// ---------------------------------------------------------------------------

describe("J. unknown discriminant", () => {
  test("unrecognized validity state rejected", () => {
    const input = { state: "ALIGNED" } as unknown as E85DesignationValidity;
    expect(() => buildE85DesignationValidity(input)).toThrow(/state must be one of/);
  });

  test("unrecognized start authority kind rejected", () => {
    const input = { kind: "OBSERVED_INTERVAL_ASSERTION", effectiveFrom: "2020-01-01" } as unknown as E85DesignationStartAuthority;
    expect(() => buildE85DesignationStartAuthority(input)).toThrow(/kind must be one of/);
  });

  test("unrecognized end authority kind (absence-from-later-dataset shape) rejected", () => {
    const input = { kind: "ABSENT_FROM_LATER_DATASET", effectiveTo: "2020-01-01" } as unknown as E85DesignationEndAuthority;
    expect(() => buildE85DesignationEndAuthority(input)).toThrow(/kind must be one of/);
  });
});

// ---------------------------------------------------------------------------
// K. Malformed/primitive inputs produce deterministic errors, not native TypeError.
// ---------------------------------------------------------------------------

describe("K. malformed top-level inputs", () => {
  test.each([null, undefined, 42, "string", true, [], [1, 2, 3]])("malformed input %j to buildE85DesignationValidity throws E85DesignationValidityError", (value) => {
    expect(() => buildE85DesignationValidity(value as unknown)).toThrow(E85DesignationValidityError);
  });

  test.each([null, undefined, 42, "string", true, []])("malformed input %j to buildE85DesignationStartAuthority throws E85DesignationValidityError", (value) => {
    expect(() => buildE85DesignationStartAuthority(value as unknown)).toThrow(E85DesignationValidityError);
  });

  test.each([null, undefined, 42, "string", true, []])("malformed input %j to buildE85DesignationEndAuthority throws E85DesignationValidityError", (value) => {
    expect(() => buildE85DesignationEndAuthority(value as unknown)).toThrow(E85DesignationValidityError);
  });

  test("malformed nested identity (a number) throws E85DesignationValidityError not TypeError", () => {
    const input = { state: "DESIGNATION_START_UNKNOWN", identity: 5 } as unknown as E85DesignationValidity;
    expect(() => buildE85DesignationValidity(input)).toThrow(E85DesignationValidityError);
  });

  test("malformed nested start (an array) throws E85DesignationValidityError not TypeError", () => {
    const input = { state: "OPEN_UNRESEARCHED", identity: IDENTITY, start: [] } as unknown as E85DesignationValidity;
    expect(() => buildE85DesignationValidity(input)).toThrow(E85DesignationValidityError);
  });

  test("unrecognized field in identity object is rejected", () => {
    const input = { state: "DESIGNATION_START_UNKNOWN", identity: { jurisdictionId: "J", districtOrZoneId: "Z", parcelId: "P" } } as unknown as E85DesignationValidity;
    expect(() => buildE85DesignationValidity(input)).toThrow(E85DesignationValidityError);
  });
});

// ---------------------------------------------------------------------------
// L. JSON round-trip for every major state family.
// ---------------------------------------------------------------------------

describe("L. JSON round-trip", () => {
  test("CLOSED round-trips through JSON", () => {
    const original: E85DesignationValidity = {
      state: "CLOSED",
      identity: IDENTITY,
      start: mapAmendment(),
      effectiveTo: "2021-12-31",
      end: expressRepealOfInstrument(),
    };
    const wire = JSON.parse(JSON.stringify(original)) as unknown;
    expect(buildE85DesignationValidity(wire)).toEqual(original);
  });

  test("OPEN_UNRESEARCHED round-trips through JSON", () => {
    const original: E85DesignationValidity = { state: "OPEN_UNRESEARCHED", identity: IDENTITY, start: parcelInstrument() };
    const wire = JSON.parse(JSON.stringify(original)) as unknown;
    expect(buildE85DesignationValidity(wire)).toEqual(original);
  });

  test("DESIGNATION_START_UNKNOWN round-trips through JSON", () => {
    const original: E85DesignationValidity = { state: "DESIGNATION_START_UNKNOWN", identity: IDENTITY };
    const wire = JSON.parse(JSON.stringify(original)) as unknown;
    expect(buildE85DesignationValidity(wire)).toEqual(original);
  });

  test("CONFLICTING_DESIGNATION_START round-trips through JSON", () => {
    const original: E85DesignationValidity = {
      state: "CONFLICTING_DESIGNATION_START",
      identity: IDENTITY,
      conflictingStartAuthorities: [mapAmendment(), parcelInstrument({ effectiveFrom: "2020-03-01" })],
    };
    const wire = JSON.parse(JSON.stringify(original)) as unknown;
    expect(buildE85DesignationValidity(wire)).toEqual(original);
  });

  test("observation-only start authority round-trips through JSON", () => {
    const original = observationAssertion();
    const wire = JSON.parse(JSON.stringify(original)) as unknown;
    expect(buildE85DesignationStartAuthority(wire)).toEqual(original);
  });

  test("malformed wire input (missing required field) is rejected after round trip", () => {
    const malformed = { state: "CLOSED", identity: IDENTITY, start: mapAmendment() };
    const wire = JSON.parse(JSON.stringify(malformed)) as unknown;
    expect(() => buildE85DesignationValidity(wire)).toThrow(E85DesignationValidityError);
  });
});

// ---------------------------------------------------------------------------
// M. Observation metadata non-promotion.
// ---------------------------------------------------------------------------

describe("M. observation metadata non-promotion", () => {
  test("observedAt never populates effectiveFrom/effectiveTo on the reconstructed authority", () => {
    const result = buildE85DesignationStartAuthority(observationAssertion({ observation: { observedAt: "2023-06-15", datasetId: "SYNTH-DATASET-1" } }));
    expect((result as Record<string, unknown>).effectiveFrom).toBeUndefined();
    expect((result as Record<string, unknown>).effectiveTo).toBeUndefined();
  });

  test("a raw object claiming to promote observedAt to effectiveFrom is rejected as a forbidden field, not silently accepted", () => {
    const smuggled = {
      kind: "OPEN_OBSERVATION_ASSERTION",
      effectiveFrom: "2023-06-15",
      observation: { observedAt: "2023-06-15", datasetId: "SYNTH-DATASET-1" },
    } as unknown as E85DesignationStartAuthority;
    expect(() => buildE85DesignationStartAuthority(smuggled)).toThrow(E85DesignationValidityError);
  });
});

// ---------------------------------------------------------------------------
// N. Repeated-observation non-continuity (structural/negative only).
// ---------------------------------------------------------------------------

describe("N. repeated-observation non-continuity", () => {
  test("no continuity-resolution export exists on this module", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const moduleExports = require("../../src/zoning-land-use-engine/designation-validity-types") as Record<string, unknown>;
    const suspiciousNames = Object.keys(moduleExports).filter((name) => /continu/i.test(name));
    expect(suspiciousNames).toEqual([]);
  });

  test("two dated observations do not automatically merge into a bounded interval — an explicit dated authority (not raw observations) is required for OPEN_UNRESEARCHED/CLOSED", () => {
    // Constructing OPEN_UNRESEARCHED still requires an explicit start
    // authority record; supplying two bare observation timestamps with no
    // authority wrapper is not itself a valid `start` value.
    const twoObservationTimestamps = ["2020-01-01", "2020-06-01"];
    const input = { state: "OPEN_UNRESEARCHED", identity: IDENTITY, start: twoObservationTimestamps } as unknown as E85DesignationValidity;
    expect(() => buildE85DesignationValidity(input)).toThrow(E85DesignationValidityError);
  });
});

// ---------------------------------------------------------------------------
// O. Immutability / determinism.
// ---------------------------------------------------------------------------

describe("O. immutability and determinism", () => {
  test("buildE85DesignationStartAuthority does not mutate its input", () => {
    const input = mapAmendment();
    const before = JSON.stringify(input);
    buildE85DesignationStartAuthority(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  test("buildE85DesignationEndAuthority does not mutate its input", () => {
    const input = expressRepealOfInstrument();
    const before = JSON.stringify(input);
    buildE85DesignationEndAuthority(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  test("buildE85DesignationValidity does not mutate its input", () => {
    const input: E85DesignationValidity = {
      state: "CLOSED",
      identity: IDENTITY,
      start: mapAmendment(),
      effectiveTo: "2021-12-31",
      end: expressRepealOfInstrument(),
    };
    const before = JSON.stringify(input);
    buildE85DesignationValidity(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  test("same valid input yields deeply equal output across repeated calls", () => {
    const input = mapAmendment();
    expect(buildE85DesignationStartAuthority(input)).toEqual(buildE85DesignationStartAuthority(input));
  });

  test("same invalid input yields identical error type/message across repeated calls", () => {
    const input = mapAmendment({ instrumentLocator: {} });
    let first: unknown;
    let second: unknown;
    try {
      buildE85DesignationStartAuthority(input);
    } catch (e) {
      first = e;
    }
    try {
      buildE85DesignationStartAuthority(input);
    } catch (e) {
      second = e;
    }
    expect(first).toBeInstanceOf(E85DesignationValidityError);
    expect((first as Error).message).toBe((second as Error).message);
  });
});

// ---------------------------------------------------------------------------
// Frozen-scope / policy-audit structural proofs (mirroring version-validity
// convention of self-verifying the production file's source text).
// ---------------------------------------------------------------------------

describe("Frozen-policy structural proofs on the production source file", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../src/zoning-land-use-engine/designation-validity-types.ts"), "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  test("no Date.now/new Date usage", () => {
    expect(/\bDate\.now\s*\(/.test(code)).toBe(false);
    expect(/\bnew\s+Date\s*\(/.test(code)).toBe(false);
  });

  test("no jurisdiction-specific fields/branching (Vancouver/Burnaby/R1-1/C-2C)", () => {
    for (const term of [/vancouver/i, /burnaby/i, /\bR1-1\b/, /\bC-2C\b/]) {
      expect(term.test(source)).toBe(false);
    }
  });

  test("no reference to Feature 494642", () => {
    expect(source.includes("494642")).toBe(false);
  });

  test("has zero imports from any other production file (fully self-contained, like version-validity-types.ts's own dependency discipline)", () => {
    const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    expect(imports).toEqual([]);
  });

  test("no use of `any` in the production file's executable/type code", () => {
    expect(/\bany\b/.test(code)).toBe(false);
  });

  test("no decision/materiality/gap/blocker vocabulary appears in this contract's code", () => {
    for (const term of ["selectedCandidateId", "MANUAL_REVIEW_REQUIRED", "materiality", "DecisionPackage", "BLOCKER"]) {
      expect(code.includes(term)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Compile-time contract proofs. Each `@ts-expect-error` targets exactly one
// intended type error; unrelated fields in each fixture are otherwise valid;
// a positive contrast fixture sits alongside each negative one; no cast
// hides the failure. ts-jest type-checks this file as part of `npm test`,
// and an unused `@ts-expect-error` directive fails compilation under
// TypeScript's built-in "unused ts-expect-error" diagnostic.
// ---------------------------------------------------------------------------

describe("Compile-time contract proofs", () => {
  test("positive contrast: CLOSED with all required fields type-checks", () => {
    const valid: E85DesignationValidity = {
      state: "CLOSED",
      identity: IDENTITY,
      start: mapAmendment(),
      effectiveTo: "2021-12-31",
      end: expressRepealOfInstrument(),
    };
    expect(valid.state).toBe("CLOSED");
  });

  test("forbidden field on a state: DESIGNATION_START_UNKNOWN may not carry effectiveFrom", () => {
    const invalid: E85DesignationValidity = {
      state: "DESIGNATION_START_UNKNOWN",
      identity: IDENTITY,
      // @ts-expect-error — DESIGNATION_START_UNKNOWN has no effectiveFrom field.
      effectiveFrom: "2020-01-01",
    };
    expect(invalid.state).toBe("DESIGNATION_START_UNKNOWN");
  });

  test("missing required state field: OPEN_UNRESEARCHED without `start` fails to type-check", () => {
    // @ts-expect-error — OPEN_UNRESEARCHED requires `start`.
    const invalid: E85DesignationValidity = { state: "OPEN_UNRESEARCHED", identity: IDENTITY };
    expect(invalid.state).toBe("OPEN_UNRESEARCHED");
  });

  test("wrong authority type: end authority typed as a start-authority shape is rejected", () => {
    const invalid: E85DesignationEndAuthority = {
      kind: "EXPRESS_REDESIGNATION",
      effectiveTo: "2021-12-31",
      // @ts-expect-error — EXPRESS_REDESIGNATION has no `observation` field (that belongs to a start authority).
      observation: { observedAt: "2020-01-01", datasetId: "X" },
      instrumentLocator: LOCATOR,
    };
    expect(invalid.kind).toBe("EXPRESS_REDESIGNATION");
  });

  test("observation metadata supplied as an effective date fails to type-check on a start authority", () => {
    const invalid: E85DesignationStartAuthority = {
      kind: "OPEN_OBSERVATION_ASSERTION",
      observation: { observedAt: "2020-01-01", datasetId: "X" },
      // @ts-expect-error — OPEN_OBSERVATION_ASSERTION has no effectiveFrom field.
      effectiveFrom: "2020-01-01",
    };
    expect(invalid.kind).toBe("OPEN_OBSERVATION_ASSERTION");
  });

  test("invalid discriminant: an unrecognized `kind` fails to type-check", () => {
    const invalid: E85DesignationStartAuthority = {
      // @ts-expect-error — "OBSERVED_INTERVAL_ASSERTION" is not a member of the closed kind union.
      kind: "OBSERVED_INTERVAL_ASSERTION",
      effectiveFrom: "2020-01-01",
      instrumentLocator: LOCATOR,
    };
    expect(invalid).toBeDefined();
  });

  test("cross-state field mixing: CONFLICTING_DESIGNATION_START may not carry a CLOSED-only `end` field", () => {
    const invalid: E85DesignationValidity = {
      state: "CONFLICTING_DESIGNATION_START",
      identity: IDENTITY,
      conflictingStartAuthorities: [mapAmendment(), parcelInstrument({ effectiveFrom: "2020-02-01" })],
      // @ts-expect-error — CONFLICTING_DESIGNATION_START has no `end` field.
      end: expressRepealOfInstrument(),
    };
    expect(invalid.state).toBe("CONFLICTING_DESIGNATION_START");
  });
});

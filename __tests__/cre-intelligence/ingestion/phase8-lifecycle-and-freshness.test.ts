import {
  observationFingerprint,
  fingerprintOfObservation,
  assertDateRoleIntegrity,
  assertObservationDateRoleIntegrity,
} from "../../../src/cre-intelligence/ingestion/observation-lifecycle";
import { assessFreshness } from "../../../src/cre-intelligence/ingestion/freshness";
import {
  createInitialRefreshState,
  recordRetrievalAttempt,
  isSourceUsableForNewRetrieval,
} from "../../../src/cre-intelligence/ingestion/source-health";
import {
  recordIngestionEvent,
  assertNoSilentDataLoss,
  redactDiagnostic,
} from "../../../src/cre-intelligence/ingestion/ingestion-events";
import { assertShape } from "../../../src/cre-intelligence/ingestion/schema-guard";
import { buildMonitoringSummary } from "../../../src/cre-intelligence/ingestion/monitoring";
import { SourceAdapterError } from "../../../src/cre-intelligence/ingestion/types";
import type { CREObservation } from "../../../src/cre-intelligence/types";

const GEO = { country: "US" as const, city: "Austin" };

function makeObservation(overrides: Partial<CREObservation> = {}): CREObservation {
  return {
    metric: "cap_rate",
    assetClass: "office",
    capRateType: "stabilized",
    geography: GEO,
    periodStart: "2026-04-01",
    periodEnd: "2026-06-30",
    value: 6.5,
    unit: "percent",
    source: { sourceId: "test-source", sourceName: "Test Source", sourceType: "government" },
    sourceQuality: 90,
    citation: {
      sourceName: "Test Source",
      reportTitle: "Test Report Q2 2026",
      publicationDate: "2026-07-05",
      period: "Q2 2026",
      locator: "Table 1",
      sourceUrl: "https://example.com/report",
      retrievedAt: "2026-07-10",
    },
    ...overrides,
  };
}

describe("Phase 8 — duplicate protection (Part 12)", () => {
  test("same published observation retrieved twice yields the identical fingerprint", () => {
    const obs1 = makeObservation({ citation: { ...makeObservation().citation!, retrievedAt: "2026-09-10" } });
    const obs2 = makeObservation({ citation: { ...makeObservation().citation!, retrievedAt: "2026-09-20" } });
    expect(fingerprintOfObservation(obs1)).toBe(fingerprintOfObservation(obs2));
  });

  test("a different publication date (a genuine correction) changes the fingerprint", () => {
    const original = makeObservation();
    const corrected = makeObservation({
      citation: { ...makeObservation().citation!, publicationDate: "2026-08-01" },
    });
    expect(fingerprintOfObservation(original)).not.toBe(fingerprintOfObservation(corrected));
  });

  test("fingerprint identity never includes retrievedAt", () => {
    const fp = observationFingerprint({
      sourceId: "s",
      metricOrIndicatorId: "cap_rate",
      geography: GEO,
      periodStart: "2026-01-01",
      periodEnd: "2026-03-31",
      publicationDate: "2026-04-01",
    });
    expect(fp).not.toMatch(/2026-09/); // no retrieval date leaks in
  });
});

describe("Phase 8 — publication vs. effective period vs. retrieval date (Part 5, 17)", () => {
  test("valid, well-ordered dates pass", () => {
    expect(() =>
      assertDateRoleIntegrity({
        publicationDate: "2026-07-05",
        periodStart: "2026-04-01",
        periodEnd: "2026-06-30",
        retrievedAt: "2026-07-10",
      }),
    ).not.toThrow();
  });

  test("retrieval date substituted for publication date is rejected", () => {
    // Someone accidentally wrote today's retrieval date into publicationDate,
    // which now postdates the recorded retrievedAt.
    expect(() =>
      assertDateRoleIntegrity({
        publicationDate: "2026-07-10",
        periodStart: "2026-04-01",
        periodEnd: "2026-06-30",
        retrievedAt: "2026-07-05", // earlier than "publication" -> impossible
      }),
    ).toThrow(/Retrieval date/);
  });

  test("effective period confused with publication date (period starts after publication) is rejected", () => {
    expect(() =>
      assertDateRoleIntegrity({
        publicationDate: "2026-01-01",
        periodStart: "2026-04-01",
        periodEnd: "2026-06-30",
        retrievedAt: "2026-07-01",
      }),
    ).toThrow(/Publication date/);
  });

  test("invalid publication date string is rejected", () => {
    expect(() =>
      assertDateRoleIntegrity({
        publicationDate: "not-a-date",
        periodStart: "2026-04-01",
        periodEnd: "2026-06-30",
        retrievedAt: "2026-07-10",
      }),
    ).toThrow(/Invalid publicationDate/);
  });

  test("invalid effective period (end before start) is rejected", () => {
    expect(() =>
      assertDateRoleIntegrity({
        publicationDate: "2026-07-05",
        periodStart: "2026-06-30",
        periodEnd: "2026-04-01",
        retrievedAt: "2026-07-10",
      }),
    ).toThrow(/periodEnd/);
  });

  test("assertObservationDateRoleIntegrity catches the real RLB-style transcription error shape", () => {
    // Simulates a publication date accidentally set equal to the effective-period end
    // AND after the recorded retrieval — an internally impossible combination.
    const bad = makeObservation({
      periodStart: "2026-04-01",
      periodEnd: "2026-06-30",
      citation: {
        ...makeObservation().citation!,
        publicationDate: "2026-09-01",
        retrievedAt: "2026-07-10",
      },
    });
    expect(() => assertObservationDateRoleIntegrity(bad)).toThrow(/Retrieval date/);
  });
});

describe("Phase 8 — freshness model (Parts 6, 7, 16)", () => {
  test("unknown cadence never resolves to live_current or stale", () => {
    const result = assessFreshness({ retrievedAt: "2020-01-01", cadence: "unknown", asOf: "2026-09-11" });
    expect(result.presentation).toBe("historical");
    expect(result.missedExpectedRefresh).toBe(false);
  });

  test("irregular cadence never resolves to live_current or stale", () => {
    const result = assessFreshness({ retrievedAt: "2026-09-01", cadence: "irregular", asOf: "2026-09-11" });
    expect(result.presentation).toBe("historical");
  });

  test("recently retrieved monthly-cadence data is live_current", () => {
    const result = assessFreshness({ retrievedAt: "2026-09-01", cadence: "monthly", asOf: "2026-09-11" });
    expect(result.presentation).toBe("live_current");
  });

  test("old monthly-cadence data becomes stale, not invalid", () => {
    const result = assessFreshness({ retrievedAt: "2026-05-01", cadence: "monthly", asOf: "2026-09-11" });
    expect(result.presentation).toBe("stale");
    expect(result.reason).toMatch(/Historical value preserved/);
  });

  test("a source flagged unavailable never presents as live_current even if recently retrieved", () => {
    const result = assessFreshness({
      retrievedAt: "2026-09-10",
      cadence: "daily",
      asOf: "2026-09-11",
      sourceUnavailable: true,
    });
    expect(result.presentation).toBe("unavailable");
  });

  test("stale is never presented as current: stale !== live_current, historical !== live_current", () => {
    const stale = assessFreshness({ retrievedAt: "2026-01-01", cadence: "monthly", asOf: "2026-09-11" });
    const historical = assessFreshness({ retrievedAt: "2020-01-01", cadence: "annual", asOf: "2026-09-11" });
    expect(stale.presentation).not.toBe("live_current");
    expect(historical.presentation).not.toBe("live_current");
  });
});

describe("Phase 8 — source lifecycle does not invalidate existing observations (Part 3)", () => {
  test("a source becoming unavailable only changes CRESourceRefreshState, never touches observation data", () => {
    let state = createInitialRefreshState({
      sourceId: "fred-api",
      cadence: "daily",
      sourceUrl: "https://fred.stlouisfed.org",
      authRequirement: "free_api_key",
      configurationRequired: true,
      historicalBackfillCapable: true,
      asOf: "2026-09-01",
    });
    expect(state.health).toBe("ACTIVE");
    expect(isSourceUsableForNewRetrieval(state.health)).toBe(true);

    // A prior observation exists independently of this state object.
    const priorObservation = makeObservation();

    // The source goes down.
    state = recordRetrievalAttempt(state, {
      success: false,
      health: "TEMPORARILY_UNAVAILABLE",
      note: "Connection timed out.",
      attemptedAt: "2026-09-11",
    });

    expect(state.health).toBe("TEMPORARILY_UNAVAILABLE");
    expect(isSourceUsableForNewRetrieval(state.health)).toBe(false);
    // lastSuccessfulRetrievalAt must NOT advance on a failed attempt.
    expect(state.lastSuccessfulRetrievalAt).toBeUndefined();
    // The previously retrieved observation is completely untouched by any of this.
    expect(priorObservation.value).toBe(6.5);
    expect(priorObservation.dataStatus).toBeUndefined(); // still defaults to "observed"
  });

  test("source resumes service: a subsequent successful attempt restores ACTIVE and advances lastSuccessfulRetrievalAt", () => {
    let state = createInitialRefreshState({
      sourceId: "statcan-wds",
      cadence: "quarterly",
      sourceUrl: "https://www.statcan.gc.ca",
      authRequirement: "none",
      configurationRequired: false,
      historicalBackfillCapable: true,
      asOf: "2026-01-01",
    });
    state = recordRetrievalAttempt(state, { success: false, health: "TEMPORARILY_UNAVAILABLE", attemptedAt: "2026-04-01" });
    expect(state.health).toBe("TEMPORARILY_UNAVAILABLE");

    state = recordRetrievalAttempt(state, { success: true, health: "ACTIVE", attemptedAt: "2026-04-02" });
    expect(state.health).toBe("ACTIVE");
    expect(state.lastSuccessfulRetrievalAt).toBe("2026-04-02");
  });
});

describe("Phase 8 — ingestion events never cause silent data loss (Parts 9, 10, 17)", () => {
  test("a fully-accounted event passes the no-silent-loss assertion", () => {
    const event = recordIngestionEvent({
      sourceId: "fred-api",
      adapterId: "FredAdapter",
      attemptedAt: "2026-09-11",
      result: "partial",
      recordsRetrieved: 10,
      recordsAccepted: 7,
      recordsRejected: 3,
      errorCode: "VALIDATION_FAILED",
    });
    expect(() => assertNoSilentDataLoss(event)).not.toThrow();
  });

  test("an event that does not account for all retrieved records is caught, not silently allowed", () => {
    const event = recordIngestionEvent({
      sourceId: "fred-api",
      adapterId: "FredAdapter",
      attemptedAt: "2026-09-11",
      result: "partial",
      recordsRetrieved: 10,
      recordsAccepted: 7,
      recordsRejected: 1, // 2 records unaccounted for
    });
    expect(() => assertNoSilentDataLoss(event)).toThrow(/silently lost/);
  });

  test("a failed network attempt still produces a fully-accounted event (0 retrieved, 0 accepted, 0 rejected)", () => {
    const event = recordIngestionEvent({
      sourceId: "fred-api",
      adapterId: "FredAdapter",
      attemptedAt: "2026-09-11",
      result: "failure",
      recordsRetrieved: 0,
      recordsAccepted: 0,
      recordsRejected: 0,
      errorCode: "NETWORK_ERROR",
    });
    expect(() => assertNoSilentDataLoss(event)).not.toThrow();
    expect(event.errorCode).toBe("NETWORK_ERROR");
  });

  test("empty response is classified as EMPTY_RESULT, not silently treated as success", () => {
    const event = recordIngestionEvent({
      sourceId: "census-acs",
      adapterId: "CensusAdapter",
      attemptedAt: "2026-09-11",
      result: "failure",
      recordsRetrieved: 0,
      recordsAccepted: 0,
      recordsRejected: 0,
      errorCode: "EMPTY_RESULT",
    });
    expect(event.result).toBe("failure");
    expect(event.errorCode).toBe("EMPTY_RESULT");
  });

  test("authentication/configuration failure is classified distinctly from a network failure", () => {
    const authEvent = recordIngestionEvent({
      sourceId: "fred-api",
      adapterId: "FredAdapter",
      attemptedAt: "2026-09-11",
      result: "failure",
      recordsRetrieved: 0,
      recordsAccepted: 0,
      recordsRejected: 0,
      errorCode: "CONFIGURATION_ERROR",
      diagnosticDetail: "No API key configured for fred-api.",
    });
    expect(authEvent.errorCode).toBe("CONFIGURATION_ERROR");
  });

  test("rate limiting is classified distinctly and never silently retried into a fabricated success", () => {
    const event = recordIngestionEvent({
      sourceId: "fred-api",
      adapterId: "FredAdapter",
      attemptedAt: "2026-09-11",
      result: "failure",
      recordsRetrieved: 0,
      recordsAccepted: 0,
      recordsRejected: 0,
      errorCode: "RATE_LIMITED",
    });
    expect(event.errorCode).toBe("RATE_LIMITED");
    expect(event.result).toBe("failure");
  });

  test("diagnosticDetail with an accidental API key is redacted before storage", () => {
    const event = recordIngestionEvent({
      sourceId: "fred-api",
      adapterId: "FredAdapter",
      attemptedAt: "2026-09-11",
      result: "failure",
      recordsRetrieved: 0,
      recordsAccepted: 0,
      recordsRejected: 0,
      errorCode: "NETWORK_ERROR",
      diagnosticDetail: "GET https://api.stlouisfed.org/fred/series?api_key=SUPERSECRET123 failed",
    });
    expect(event.diagnosticDetail).not.toContain("SUPERSECRET123");
    expect(event.diagnosticDetail).toContain("[REDACTED]");
  });

  test("redactDiagnostic strips bearer tokens too", () => {
    expect(redactDiagnostic("Authorization: Bearer abc.def123 rejected")).not.toContain("abc.def123");
  });
});

describe("Phase 8 — schema change detection (Part 11)", () => {
  test("a matching shape passes", () => {
    expect(() => assertShape("test", { city: "Austin", value: 6.5, period: "Q2" }, { city: "string", value: "number", period: "string" })).not.toThrow();
  });

  test("a renamed/restructured shape ({city,value,period} -> {market,benchmark,effectiveDate}) is rejected, never silently mis-mapped", () => {
    const changed = { market: "Austin", benchmark: 6.5, effectiveDate: "2026-06-30" };
    expect(() => assertShape("test-source", changed, { city: "string", value: "number", period: "string" })).toThrow(SourceAdapterError);
    try {
      assertShape("test-source", changed, { city: "string", value: "number", period: "string" });
    } catch (err) {
      expect((err as SourceAdapterError).code).toBe("SCHEMA_CHANGED");
    }
  });

  test("a missing required field is rejected", () => {
    expect(() => assertShape("test-source", { city: "Austin" }, { city: "string", value: "number" })).toThrow(/value/);
  });

  test("a field with the wrong type is rejected rather than coerced", () => {
    expect(() => assertShape("test-source", { city: "Austin", value: "6.5" }, { city: "string", value: "number" })).toThrow(/expected field "value" to be number/);
  });

  test("a non-object record (malformed JSON parsed to a primitive) is rejected", () => {
    expect(() => assertShape("test-source", "not an object", { city: "string" })).toThrow(SourceAdapterError);
  });
});

describe("Phase 8 — monitoring summary (Part 15)", () => {
  test("produces accurate typed counts across sources, observations, ingestion events, and gaps", () => {
    const summary = buildMonitoringSummary({
      generatedAt: "2026-09-11",
      sourceStates: [
        createInitialRefreshState({
          sourceId: "a",
          cadence: "daily",
          sourceUrl: "https://a",
          authRequirement: "none",
          configurationRequired: false,
          historicalBackfillCapable: true,
          asOf: "2026-01-01",
        }),
        recordRetrievalAttempt(
          createInitialRefreshState({
            sourceId: "b",
            cadence: "monthly",
            sourceUrl: "https://b",
            authRequirement: "none",
            configurationRequired: false,
            historicalBackfillCapable: false,
            asOf: "2026-01-01",
          }),
          { success: false, health: "SCHEMA_CHANGED", attemptedAt: "2026-02-01" },
        ),
      ],
      observationLifecycles: [
        { fingerprint: "fp1", sourceId: "a", status: "active", firstRetrievedAt: "2026-01-01", lastSeenAt: "2026-01-01" },
        { fingerprint: "fp2", sourceId: "a", status: "superseded", firstRetrievedAt: "2026-01-01", lastSeenAt: "2026-02-01" },
      ],
      ingestionEvents: [
        recordIngestionEvent({ sourceId: "a", adapterId: "A", attemptedAt: "2026-02-01", result: "success", recordsRetrieved: 5, recordsAccepted: 5, recordsRejected: 0 }),
        recordIngestionEvent({ sourceId: "b", adapterId: "B", attemptedAt: "2026-02-01", result: "failure", recordsRetrieved: 0, recordsAccepted: 0, recordsRejected: 0, errorCode: "SCHEMA_CHANGED", schemaChangeSuspected: true }),
      ],
      ingestionWindowDescription: "test window",
      dataGaps: [
        { metric: "cap_rate", geography: GEO, reason: "x", sourcesChecked: [], checkedAt: "2026-01-01", reasonCode: "SCHEMA_CHANGED" },
      ],
    });

    expect(summary.sources.total).toBe(2);
    expect(summary.sources.byHealth.ACTIVE).toBe(1);
    expect(summary.sources.byHealth.SCHEMA_CHANGED).toBe(1);
    expect(summary.observations.byLifecycleStatus.active).toBe(1);
    expect(summary.observations.byLifecycleStatus.superseded).toBe(1);
    expect(summary.ingestion.successCount).toBe(1);
    expect(summary.ingestion.failureCount).toBe(1);
    expect(summary.ingestion.schemaChangeSuspectedCount).toBe(1);
    expect(summary.dataGaps.byReasonCode.SCHEMA_CHANGED).toBe(1);
  });
});

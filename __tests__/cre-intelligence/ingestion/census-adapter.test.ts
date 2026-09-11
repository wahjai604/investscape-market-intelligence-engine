import { CensusAcsAdapter, type CensusRawResponse } from "../../../src/cre-intelligence/ingestion/adapters/census-adapter";
import { SourceAdapterError } from "../../../src/cre-intelligence/ingestion/types";
import censusFixture from "./fixtures/census-population.json";

const BASE_QUERY = {
  variable: "B01003_001E",
  variableLabel: "Total population",
  category: "demographic" as const,
  metroCbsaCode: "12420",
  geography: { country: "US" as const, region: "TX", metro: "Austin, TX", city: "Austin" },
  year: 2024,
  unit: "count",
};

function mockFetcher(payload: unknown, status = 200) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  });
}

describe("CensusAcsAdapter", () => {
  test("valid response normalizes to an EconomicIndicatorObservation, dataStatus observed", async () => {
    const adapter = new CensusAcsAdapter("test-key", mockFetcher(censusFixture));
    const raw = await adapter.fetchRaw(BASE_QUERY);
    const parsed = adapter.parse(raw);
    const outcome = adapter.normalize(parsed, BASE_QUERY);

    expect(outcome.status).toBe("ok_economic");
    if (outcome.status !== "ok_economic") throw new Error("unreachable");
    expect(outcome.observations).toHaveLength(1);
    expect(outcome.observations[0].value).toBe(2482828);
    expect(outcome.observations[0].dataStatus).toBe("observed");
    expect(outcome.observations[0].category).toBe("demographic");
    expect(outcome.observations[0].citation.methodologyNote).toMatch(/not endorsed or certified/i);
  });

  test("malformed response (not array-of-arrays) throws SCHEMA_CHANGED", async () => {
    const adapter = new CensusAcsAdapter("test-key", mockFetcher({ error: "bad request" }));
    const raw = await adapter.fetchRaw(BASE_QUERY);
    expect(() => adapter.parse(raw)).toThrow(SourceAdapterError);
  });

  test("header missing expected columns throws SCHEMA_CHANGED", async () => {
    const bad: CensusRawResponse = [["ONLY_ONE_COLUMN"]];
    const adapter = new CensusAcsAdapter("test-key", mockFetcher(bad));
    const raw = await adapter.fetchRaw(BASE_QUERY);
    try {
      adapter.parse(raw);
      throw new Error("expected throw");
    } catch (err) {
      expect((err as SourceAdapterError).code).toBe("SCHEMA_CHANGED");
    }
  });

  test("Census sentinel value for suppressed data throws VALIDATION_FAILED, is never stored as a real statistic", async () => {
    const bad: CensusRawResponse = [
      ["NAME", "B01003_001E", "metro"],
      ["Some Small Area", "-666666666", "99999"],
    ];
    const adapter = new CensusAcsAdapter("test-key", mockFetcher(bad));
    const raw = await adapter.fetchRaw(BASE_QUERY);
    try {
      adapter.parse(raw);
      throw new Error("expected throw");
    } catch (err) {
      expect((err as SourceAdapterError).code).toBe("VALIDATION_FAILED");
    }
  });

  test("invalid geography (HTTP 404) surfaces as GEOGRAPHY_NOT_COVERED", async () => {
    const adapter = new CensusAcsAdapter("test-key", mockFetcher({}, 404));
    await expect(adapter.fetchRaw(BASE_QUERY)).rejects.toMatchObject({ code: "GEOGRAPHY_NOT_COVERED" });
  });

  test("empty row set produces a reason-coded gap", async () => {
    const empty: CensusRawResponse = [["NAME", "B01003_001E", "metro"]];
    const adapter = new CensusAcsAdapter("test-key", mockFetcher(empty));
    const raw = await adapter.fetchRaw(BASE_QUERY);
    const outcome = adapter.normalize(adapter.parse(raw), BASE_QUERY);
    expect(outcome.status).toBe("gap");
    if (outcome.status !== "gap") throw new Error("unreachable");
    expect(outcome.gap.reasonCode).toBe("GEOGRAPHY_NOT_COVERED");
  });

  test("rate limiting surfaces distinctly", async () => {
    const adapter = new CensusAcsAdapter("test-key", mockFetcher({}, 429));
    await expect(adapter.fetchRaw(BASE_QUERY)).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  test("never produces a cap_rate or CREObservation-shaped metric field", async () => {
    const adapter = new CensusAcsAdapter("test-key", mockFetcher(censusFixture));
    const raw = await adapter.fetchRaw(BASE_QUERY);
    const outcome = adapter.normalize(adapter.parse(raw), BASE_QUERY);
    if (outcome.status !== "ok_economic") throw new Error("unreachable");
    for (const obs of outcome.observations) {
      expect((obs as unknown as Record<string, unknown>).metric).toBeUndefined();
    }
  });

  test("duplicate CBSA rows in the raw payload both survive parsing", async () => {
    const dup: CensusRawResponse = [
      ["NAME", "B01003_001E", "metro"],
      ["Austin-Round Rock-San Marcos, TX Metro Area", "2482828", "12420"],
      ["Austin-Round Rock-San Marcos, TX Metro Area", "2482828", "12420"],
    ];
    const adapter = new CensusAcsAdapter("test-key", mockFetcher(dup));
    const raw = await adapter.fetchRaw(BASE_QUERY);
    const parsed = adapter.parse(raw);
    expect(parsed).toHaveLength(2);
  });
});

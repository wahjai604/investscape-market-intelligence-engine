import { FredAdapter, type FredRawResponse } from "../../../src/cre-intelligence/ingestion/adapters/fred-adapter";
import { SourceAdapterError } from "../../../src/cre-intelligence/ingestion/types";
import fredFixture from "./fixtures/fred-mortgage30us.json";

const BASE_QUERY = {
  seriesId: "MORTGAGE30US",
  seriesTitle: "30-Year Fixed Rate Mortgage Average in the United States",
  geography: { country: "US" as const, city: "national" },
  category: "cre_adjacent_economic" as const,
  unit: "percent",
};

function mockFetcher(payload: unknown, status = 200) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  });
}

describe("FredAdapter", () => {
  test("valid response normalizes to EconomicIndicatorObservations, skipping missing points", async () => {
    const adapter = new FredAdapter("test-key", mockFetcher(fredFixture));
    const raw = await adapter.fetchRaw(BASE_QUERY);
    const parsed = adapter.parse(raw);
    const outcome = adapter.normalize(parsed, BASE_QUERY);

    expect(outcome.status).toBe("ok_economic");
    if (outcome.status !== "ok_economic") throw new Error("unreachable");
    expect(outcome.observations).toHaveLength(2); // the "." point is dropped
    expect(outcome.observations[0].value).toBeCloseTo(6.62);
    expect(outcome.observations[0].dataStatus).toBe("observed");
    expect(outcome.observations[0].citation.sourceUrl).toMatch(/^https:\/\/fred\.stlouisfed\.org\//);
  });

  test("never produces a CREObservation or a cap_rate-shaped field", async () => {
    const adapter = new FredAdapter("test-key", mockFetcher(fredFixture));
    const raw = await adapter.fetchRaw(BASE_QUERY);
    const outcome = adapter.normalize(adapter.parse(raw), BASE_QUERY);
    if (outcome.status !== "ok_economic") throw new Error("unreachable");
    for (const obs of outcome.observations) {
      expect((obs as unknown as Record<string, unknown>).metric).toBeUndefined();
      expect((obs as unknown as Record<string, unknown>).capRateType).toBeUndefined();
    }
  });

  test("malformed response (missing observations array) throws SCHEMA_CHANGED", async () => {
    const adapter = new FredAdapter("test-key", mockFetcher({ notObservations: [] }));
    const raw = await adapter.fetchRaw(BASE_QUERY);
    expect(() => adapter.parse(raw)).toThrow(SourceAdapterError);
    try {
      adapter.parse(raw);
    } catch (err) {
      expect((err as SourceAdapterError).code).toBe("SCHEMA_CHANGED");
    }
  });

  test("missing fields on an individual observation throws SCHEMA_CHANGED", async () => {
    const badFixture: FredRawResponse = { observations: [{ date: "2026-01-01" } as never] };
    const adapter = new FredAdapter("test-key", mockFetcher(badFixture));
    const raw = await adapter.fetchRaw(BASE_QUERY);
    expect(() => adapter.parse(raw)).toThrow(/date.*value|value.*date/i);
  });

  test("non-numeric observation value throws VALIDATION_FAILED", async () => {
    const badFixture: FredRawResponse = { observations: [{ date: "2026-01-01", value: "not-a-number" }] };
    const adapter = new FredAdapter("test-key", mockFetcher(badFixture));
    const raw = await adapter.fetchRaw(BASE_QUERY);
    try {
      adapter.parse(raw);
      throw new Error("expected parse to throw");
    } catch (err) {
      expect((err as SourceAdapterError).code).toBe("VALIDATION_FAILED");
    }
  });

  test("empty result set produces a reason-coded data gap, not an empty success", async () => {
    const adapter = new FredAdapter("test-key", mockFetcher({ observations: [] }));
    const raw = await adapter.fetchRaw(BASE_QUERY);
    const outcome = adapter.normalize(adapter.parse(raw), BASE_QUERY);
    expect(outcome.status).toBe("gap");
    if (outcome.status !== "gap") throw new Error("unreachable");
    expect(outcome.gap.reasonCode).toBe("GEOGRAPHY_NOT_COVERED");
    expect(outcome.gap.sourcesChecked).toContain("fred-api");
  });

  test("rate-limited response (HTTP 429) surfaces as RATE_LIMITED, not a silent empty result", async () => {
    const adapter = new FredAdapter("test-key", mockFetcher({}, 429));
    await expect(adapter.fetchRaw(BASE_QUERY)).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  test("network failure surfaces as NETWORK_ERROR", async () => {
    const failingFetcher = async () => {
      throw new Error("ECONNRESET");
    };
    const adapter = new FredAdapter("test-key", failingFetcher);
    await expect(adapter.fetchRaw(BASE_QUERY)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  test("provenance is preserved end to end: series id, retrieval date and source URL", async () => {
    const adapter = new FredAdapter("test-key", mockFetcher(fredFixture));
    const raw = await adapter.fetchRaw(BASE_QUERY);
    const outcome = adapter.normalize(adapter.parse(raw), BASE_QUERY);
    if (outcome.status !== "ok_economic") throw new Error("unreachable");
    for (const obs of outcome.observations) {
      expect(obs.indicatorId).toBe("MORTGAGE30US");
      expect(obs.citation.sourceName).toMatch(/Federal Reserve/);
      expect(obs.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test("duplicate observation dates in the raw payload both survive parsing (source of truth, not deduped silently)", async () => {
    const dup: FredRawResponse = {
      observations: [
        { date: "2026-01-01", value: "6.5" },
        { date: "2026-01-01", value: "6.5" },
      ],
    };
    const adapter = new FredAdapter("test-key", mockFetcher(dup));
    const raw = await adapter.fetchRaw(BASE_QUERY);
    const parsed = adapter.parse(raw);
    expect(parsed).toHaveLength(2);
  });
});

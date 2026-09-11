import { StatCanBcpiAdapter, type StatCanRawResponse } from "../../../src/cre-intelligence/ingestion/adapters/statcan-adapter";
import { SourceAdapterError } from "../../../src/cre-intelligence/ingestion/types";
import statcanFixture from "./fixtures/statcan-vector.json";

const BASE_QUERY = {
  vectorId: 1234567,
  geography: { country: "CA" as const, region: "ON", metro: "Toronto, ON", city: "Toronto" },
  buildingTypeLabel: "Total, non-residential building types",
  latestNPeriods: 3,
};

function mockFetcher(payload: unknown, status = 200) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  });
}

describe("StatCanBcpiAdapter", () => {
  test("valid response normalizes to construction_index CREObservations with provenance", async () => {
    const adapter = new StatCanBcpiAdapter(mockFetcher(statcanFixture));
    const raw = await adapter.fetchRaw(BASE_QUERY);
    const parsed = adapter.parse(raw);
    const outcome = adapter.normalize(parsed, BASE_QUERY);

    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") throw new Error("unreachable");
    expect(outcome.observations).toHaveLength(3);
    for (const obs of outcome.observations) {
      expect(obs.metric).toBe("construction_index");
      expect(obs.unit).toBe("index");
      expect(obs.source.sourceId).toBe("statcan-bcpi");
      expect(obs.dataStatus).toBe("observed");
      expect(obs.citation?.sourceUrl).toMatch(/^https:\/\/www150\.statcan\.gc\.ca\//);
    }
    expect(outcome.observations[2].value).toBeCloseTo(145.8);
  });

  test("malformed response (not an array) throws SCHEMA_CHANGED", async () => {
    const adapter = new StatCanBcpiAdapter(mockFetcher({ not: "an array" }));
    const raw = await adapter.fetchRaw(BASE_QUERY);
    expect(() => adapter.parse(raw)).toThrow(SourceAdapterError);
  });

  test("missing vectorDataPoint field throws SCHEMA_CHANGED", async () => {
    const bad: StatCanRawResponse = [{ status: "SUCCESS", object: { vectorId: 1, productId: 2 } as never }];
    const adapter = new StatCanBcpiAdapter(mockFetcher(bad));
    const raw = await adapter.fetchRaw(BASE_QUERY);
    try {
      adapter.parse(raw);
      throw new Error("expected throw");
    } catch (err) {
      expect((err as SourceAdapterError).code).toBe("SCHEMA_CHANGED");
    }
  });

  test("unexpected status field (invalid geography/vector) throws NOT_FOUND", async () => {
    const bad: StatCanRawResponse = [{ status: "FAILED" }];
    const adapter = new StatCanBcpiAdapter(mockFetcher(bad));
    const raw = await adapter.fetchRaw(BASE_QUERY);
    try {
      adapter.parse(raw);
      throw new Error("expected throw");
    } catch (err) {
      expect((err as SourceAdapterError).code).toBe("NOT_FOUND");
    }
  });

  test("non-numeric refPer value throws VALIDATION_FAILED", async () => {
    const bad: StatCanRawResponse = [
      { status: "SUCCESS", object: { vectorId: 1, productId: 1810013501, vectorDataPoint: [{ refPer: "2026-01-01", value: "abc" }] } },
    ];
    const adapter = new StatCanBcpiAdapter(mockFetcher(bad));
    const raw = await adapter.fetchRaw(BASE_QUERY);
    try {
      adapter.parse(raw);
      throw new Error("expected throw");
    } catch (err) {
      expect((err as SourceAdapterError).code).toBe("VALIDATION_FAILED");
    }
  });

  test("out-of-range index value is rejected as a data gap rather than stored", async () => {
    const bad: StatCanRawResponse = [
      { status: "SUCCESS", object: { vectorId: 1, productId: 1810013501, vectorDataPoint: [{ refPer: "2026-01-01", value: "999999" }] } },
    ];
    const adapter = new StatCanBcpiAdapter(mockFetcher(bad));
    const raw = await adapter.fetchRaw(BASE_QUERY);
    const outcome = adapter.normalize(adapter.parse(raw), BASE_QUERY);
    expect(outcome.status).toBe("gap");
    if (outcome.status !== "gap") throw new Error("unreachable");
    expect(outcome.gap.reasonCode).toBe("VALIDATION_FAILED");
  });

  test("empty data points produce a reason-coded gap", async () => {
    const empty: StatCanRawResponse = [{ status: "SUCCESS", object: { vectorId: 1, productId: 1810013501, vectorDataPoint: [] } }];
    const adapter = new StatCanBcpiAdapter(mockFetcher(empty));
    const raw = await adapter.fetchRaw(BASE_QUERY);
    const outcome = adapter.normalize(adapter.parse(raw), BASE_QUERY);
    expect(outcome.status).toBe("gap");
    if (outcome.status !== "gap") throw new Error("unreachable");
    expect(outcome.gap.reasonCode).toBe("GEOGRAPHY_NOT_COVERED");
    expect(outcome.gap.geography.city).toBe("Toronto");
  });

  test("rate limiting surfaces distinctly from a generic network error", async () => {
    const adapter = new StatCanBcpiAdapter(mockFetcher({}, 429));
    await expect(adapter.fetchRaw(BASE_QUERY)).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  test("never produces a cap_rate observation", async () => {
    const adapter = new StatCanBcpiAdapter(mockFetcher(statcanFixture));
    const raw = await adapter.fetchRaw(BASE_QUERY);
    const outcome = adapter.normalize(adapter.parse(raw), BASE_QUERY);
    if (outcome.status !== "ok") throw new Error("unreachable");
    expect(outcome.observations.every((o) => o.metric !== "cap_rate")).toBe(true);
  });
});

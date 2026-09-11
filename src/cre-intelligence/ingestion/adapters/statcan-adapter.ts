/**
 * InvestScape™ E68 Phase 7 — Statistics Canada Web Data Service (WDS) adapter.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Statistics Canada publishes the Building Construction Price Index (Table
 * 18-10-0135-01) through a documented, key-free public API — the Web Data
 * Service (see docs/E68-phase7-government-public-api-ingestion.md and
 * ../public-source-registry.ts, sourceId "statcan-wds"). This is one of the
 * few government sources that genuinely publishes a direct E68 metric
 * (`construction_index`) rather than merely CRE-adjacent context, and it is
 * already registered in E68's benchmark source registry as `statcan-bcpi`
 * with `access: "public_data"` / `license: "public"`. This adapter therefore
 * produces real `CREObservation`s, unlike the FRED/Census adapters.
 *
 * It STILL must never produce a cap rate: the vector/coordinate the caller
 * supplies determines only which BCPI series (city x building-type
 * combination) is fetched, and `normalize()` hard-codes `metric:
 * "construction_index"`.
 */
import type { CREGeography, CREObservation } from "../../types";
import {
  SourceAdapterError,
  type CREPublicSourceProfile,
  type IngestionOutcome,
  type RawSourceRecord,
  type SourceAdapter,
} from "../types";
import { getPublicSource } from "../public-source-registry";
import { getCRESource } from "../../source-registry";

export interface StatCanQuery {
  /** WDS "vector" identifying one BCPI series (a specific CMA x building type). */
  vectorId: number;
  geography: CREGeography;
  buildingTypeLabel: string;
  /** How many most-recent periods to request from getDataFromVectorsAndLatestNPeriods. */
  latestNPeriods: number;
}

export interface StatCanRawDataPoint {
  refPer: string; // e.g. "2026-04-01"
  refPer2?: string;
  value: string | number;
  decimals?: number;
  scalarFactorCode?: number;
}

export interface StatCanRawVectorResult {
  status: string;
  object?: {
    vectorId: number;
    productId: number;
    vectorDataPoint: StatCanRawDataPoint[];
  };
}

export type StatCanRawResponse = StatCanRawVectorResult[];

export interface StatCanParsedPoint {
  periodStart: string;
  periodEnd: string;
  value: number;
}

export type StatCanFetcher = (url: string, body: unknown) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** Statistics Canada reports BCPI as an index with base period = 100; anything
 * outside a broad sanity band indicates a schema/scale problem, not a real
 * price movement, and must be rejected rather than stored. */
const INDEX_SANITY_MIN = 1;
const INDEX_SANITY_MAX = 10_000;

export class StatCanBcpiAdapter implements SourceAdapter<StatCanQuery, StatCanRawResponse, StatCanParsedPoint> {
  readonly sourceId = "statcan-wds";
  readonly profile: CREPublicSourceProfile;

  constructor(private readonly fetcher: StatCanFetcher) {
    const profile = getPublicSource("statcan-wds");
    if (!profile) throw new Error("statcan-wds is not registered in CRE_PUBLIC_SOURCE_REGISTRY");
    this.profile = profile;
    if (!getCRESource("statcan-bcpi")) {
      throw new Error("statcan-bcpi must be registered in CRE_SOURCE_REGISTRY before this adapter can attribute observations to it.");
    }
  }

  async fetchRaw(query: StatCanQuery): Promise<RawSourceRecord<StatCanRawResponse>> {
    const url = "https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorsAndLatestNPeriods";
    const body = [{ vectorId: query.vectorId, latestN: query.latestNPeriods }];

    let response: { ok: boolean; status: number; json(): Promise<unknown> };
    try {
      response = await this.fetcher(url, body);
    } catch (err) {
      throw new SourceAdapterError("NETWORK_ERROR", `StatCan WDS request failed: ${(err as Error).message}`);
    }
    if (response.status === 429) {
      throw new SourceAdapterError("RATE_LIMITED", "StatCan WDS returned HTTP 429 (rate limited).");
    }
    if (!response.ok) {
      throw new SourceAdapterError("NETWORK_ERROR", `StatCan WDS returned HTTP ${response.status}.`);
    }

    const raw = (await response.json()) as StatCanRawResponse;
    return {
      sourceId: this.sourceId,
      datasetId: `vector-${query.vectorId}`,
      retrievedAt: new Date().toISOString().slice(0, 10),
      requestParams: { vectorId: String(query.vectorId), latestN: String(query.latestNPeriods) },
      raw,
    };
  }

  parse(record: RawSourceRecord<StatCanRawResponse>): StatCanParsedPoint[] {
    if (!Array.isArray(record.raw) || record.raw.length === 0) {
      throw new SourceAdapterError("SCHEMA_CHANGED", "StatCan WDS response was not the expected array of vector results.");
    }
    const result = record.raw[0];
    if (result.status !== "SUCCESS" || !result.object) {
      throw new SourceAdapterError("NOT_FOUND", `StatCan WDS vector lookup did not succeed: status="${result.status}".`);
    }
    if (!Array.isArray(result.object.vectorDataPoint)) {
      throw new SourceAdapterError("SCHEMA_CHANGED", "StatCan WDS result is missing 'vectorDataPoint'.");
    }

    const parsed: StatCanParsedPoint[] = [];
    for (const point of result.object.vectorDataPoint) {
      if (typeof point.refPer !== "string") {
        throw new SourceAdapterError("SCHEMA_CHANGED", "StatCan WDS data point is missing 'refPer'.");
      }
      const value = typeof point.value === "string" ? Number(point.value) : point.value;
      if (!Number.isFinite(value)) {
        throw new SourceAdapterError("VALIDATION_FAILED", `StatCan WDS data point for ${point.refPer} is not numeric.`);
      }
      parsed.push({ periodStart: point.refPer, periodEnd: point.refPer, value });
    }
    return parsed;
  }

  normalize(parsed: StatCanParsedPoint[], query: StatCanQuery): IngestionOutcome {
    if (parsed.length === 0) {
      return {
        status: "gap",
        gap: {
          metric: "construction_index",
          geography: query.geography,
          reason: `StatCan WDS vector ${query.vectorId} (${query.buildingTypeLabel}) returned no data points.`,
          reasonCode: "GEOGRAPHY_NOT_COVERED",
          sourcesChecked: ["statcan-wds"],
          checkedAt: new Date().toISOString().slice(0, 10),
        },
      };
    }

    const retrievedAt = new Date().toISOString().slice(0, 10);
    const observations: CREObservation[] = [];
    for (const point of parsed) {
      if (point.value < INDEX_SANITY_MIN || point.value > INDEX_SANITY_MAX) {
        return {
          status: "gap",
          gap: {
            metric: "construction_index",
            geography: query.geography,
            reason: `StatCan WDS vector ${query.vectorId} returned an out-of-range index value (${point.value}) for ${point.periodStart}; discarded rather than stored.`,
            reasonCode: "VALIDATION_FAILED",
            sourcesChecked: ["statcan-wds"],
            checkedAt: retrievedAt,
          },
        };
      }
      observations.push({
        metric: "construction_index",
        assetClass: "other",
        geography: query.geography,
        periodStart: point.periodStart,
        periodEnd: point.periodEnd,
        value: point.value,
        unit: "index",
        source: { sourceId: "statcan-bcpi", sourceName: "Statistics Canada", sourceType: "government", retrievedAt },
        citation: {
          sourceName: "Statistics Canada",
          reportTitle: `Building Construction Price Indexes, by type of building — ${query.buildingTypeLabel}`,
          publicationDate: point.periodEnd,
          period: point.periodEnd,
          locator: `Table 18-10-0135-01, vector ${query.vectorId}`,
          sourceUrl: "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810013501",
          retrievedAt,
        },
        sourceQuality: 99,
        dataStatus: "observed",
      });
    }

    return { status: "ok", observations };
  }
}

/**
 * InvestScape™ E68 Phase 7 — FRED (Federal Reserve Economic Data) adapter.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * FRED (fred.stlouisfed.org, operated by the Federal Reserve Bank of St.
 * Louis) has a documented public REST API requiring a free API key
 * (see docs/E68-phase7-government-public-api-ingestion.md and
 * ../public-source-registry.ts, sourceId "fred-api").
 *
 * HARD BOUNDARY (Phase 6/7 non-negotiable, see types.ts SourceAdapter docs):
 * this adapter can ONLY ever produce `EconomicIndicatorObservation`s, never a
 * `CREObservation`. FRED has never published a commercial cap rate for any
 * metro, and several FRED series republish data originally produced by a
 * third party (e.g. Zillow-derived housing series) — exactly the aggregator
 * mislabeling that produced the discredited Phase 4 Miami/Seattle "cap rate"
 * figures. The type system enforces this: `normalize()` below is typed to
 * return only `EconomicIndicatorObservation[]`, a `gap`, or an `error`.
 */
import type { CREGeography } from "../../types";
import {
  SourceAdapterError,
  type CREPublicSourceProfile,
  type EconomicIndicatorObservation,
  type IngestionOutcome,
  type RawSourceRecord,
  type SourceAdapter,
} from "../types";
import { getPublicSource } from "../public-source-registry";

export interface FredQuery {
  seriesId: string;
  seriesTitle: string;
  geography: CREGeography;
  /** One of the categories `EconomicIndicatorObservation` permits — never a CRE benchmark. */
  category: EconomicIndicatorObservation["category"];
  unit: string;
  observationStart?: string;
  observationEnd?: string;
}

/** Shape of a single element in FRED's `observations` array. */
export interface FredRawObservation {
  date: string;
  value: string; // FRED returns numeric values as strings, and "." for missing.
}

export interface FredRawResponse {
  realtime_start?: string;
  realtime_end?: string;
  observation_start?: string;
  observation_end?: string;
  units?: string;
  count?: number;
  observations: FredRawObservation[];
}

export interface FredParsedObservation {
  date: string;
  value: number;
}

/** Injected fetcher so tests never touch the network. Defaults to global fetch. */
export type FredFetcher = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export class FredAdapter implements SourceAdapter<FredQuery, FredRawResponse, FredParsedObservation> {
  readonly sourceId = "fred-api";
  readonly profile: CREPublicSourceProfile;

  constructor(
    private readonly apiKey: string,
    private readonly fetcher: FredFetcher = (url) => fetch(url) as unknown as ReturnType<FredFetcher>,
  ) {
    const profile = getPublicSource("fred-api");
    if (!profile) throw new Error("fred-api is not registered in CRE_PUBLIC_SOURCE_REGISTRY");
    this.profile = profile;
  }

  async fetchRaw(query: FredQuery): Promise<RawSourceRecord<FredRawResponse>> {
    const params: Record<string, string> = {
      series_id: query.seriesId,
      api_key: this.apiKey,
      file_type: "json",
      ...(query.observationStart ? { observation_start: query.observationStart } : {}),
      ...(query.observationEnd ? { observation_end: query.observationEnd } : {}),
    };
    const url = `https://api.stlouisfed.org/fred/series/observations?${new URLSearchParams(params).toString()}`;

    let response: { ok: boolean; status: number; json(): Promise<unknown> };
    try {
      response = await this.fetcher(url);
    } catch (err) {
      throw new SourceAdapterError("NETWORK_ERROR", `FRED request failed: ${(err as Error).message}`);
    }

    if (response.status === 429) {
      throw new SourceAdapterError("RATE_LIMITED", "FRED API returned HTTP 429 (rate limited).");
    }
    if (!response.ok) {
      throw new SourceAdapterError("NETWORK_ERROR", `FRED API returned HTTP ${response.status}.`);
    }

    const raw = (await response.json()) as FredRawResponse;
    return {
      sourceId: this.sourceId,
      datasetId: query.seriesId,
      retrievedAt: new Date().toISOString().slice(0, 10),
      requestParams: params,
      raw,
    };
  }

  parse(record: RawSourceRecord<FredRawResponse>): FredParsedObservation[] {
    if (!record.raw || !Array.isArray(record.raw.observations)) {
      throw new SourceAdapterError("SCHEMA_CHANGED", "FRED response is missing the expected 'observations' array.");
    }
    const parsed: FredParsedObservation[] = [];
    for (const obs of record.raw.observations) {
      if (typeof obs.date !== "string" || typeof obs.value !== "string") {
        throw new SourceAdapterError("SCHEMA_CHANGED", "FRED observation is missing a 'date' or 'value' field.");
      }
      if (obs.value === ".") continue; // FRED's documented convention for a missing data point.
      const value = Number(obs.value);
      if (!Number.isFinite(value)) {
        throw new SourceAdapterError("VALIDATION_FAILED", `FRED observation for ${obs.date} is not numeric: "${obs.value}".`);
      }
      parsed.push({ date: obs.date, value });
    }
    return parsed;
  }

  normalize(parsed: FredParsedObservation[], query: FredQuery): IngestionOutcome {
    if (parsed.length === 0) {
      return {
        status: "gap",
        gap: {
          metric: "construction_index", // nearest existing CREMetric for registry bookkeeping; this gap is about an economic series, not a CRE benchmark.
          geography: query.geography,
          reason: `FRED series "${query.seriesId}" (${query.seriesTitle}) returned zero usable observations for the requested window.`,
          reasonCode: "GEOGRAPHY_NOT_COVERED",
          sourcesChecked: ["fred-api"],
          checkedAt: new Date().toISOString().slice(0, 10),
        },
      };
    }

    const retrievedAt = new Date().toISOString().slice(0, 10);
    const observations: EconomicIndicatorObservation[] = parsed.map((point) => ({
      sourceId: this.sourceId,
      indicatorId: query.seriesId,
      indicatorName: query.seriesTitle,
      category: query.category,
      geography: query.geography,
      periodStart: point.date,
      periodEnd: point.date,
      value: point.value,
      unit: query.unit,
      dataStatus: "observed",
      citation: {
        sourceName: "Federal Reserve Bank of St. Louis (FRED)",
        reportTitle: `FRED series ${query.seriesId}: ${query.seriesTitle}`,
        publicationDate: point.date,
        period: point.date,
        locator: `series/observations?series_id=${query.seriesId}`,
        sourceUrl: `https://fred.stlouisfed.org/series/${query.seriesId}`,
        retrievedAt,
      },
      retrievedAt,
    }));

    return { status: "ok_economic", observations };
  }
}

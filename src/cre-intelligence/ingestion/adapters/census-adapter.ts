/**
 * InvestScape™ E68 Phase 7 — U.S. Census Bureau (ACS) adapter.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * The Census Data API (American Community Survey 5-Year Estimates) has a
 * documented, key-authenticated public API (see
 * docs/E68-phase7-government-public-api-ingestion.md and
 * ../public-source-registry.ts, sourceId "us-census-api"). It publishes
 * demographic data (population, households, income) — category (5)/(6)/(2)
 * per Part 2 of the Phase 7 spec, never a CRE benchmark.
 *
 * Like the FRED adapter, this is type-restricted to
 * `EconomicIndicatorObservation` output only; there is no code path that can
 * produce a `CREObservation` with metric `cap_rate` from Census data.
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

export interface CensusQuery {
  /** ACS variable code, e.g. "B01003_001E" (total population). */
  variable: string;
  variableLabel: string;
  category: EconomicIndicatorObservation["category"];
  /** Census "for=metropolitan statistical area/micropolitan statistical area:XXXXX" geography code. */
  metroCbsaCode: string;
  geography: CREGeography;
  year: number;
  unit: string;
}

/**
 * The Census API's distinctive response shape: a JSON array of arrays, first
 * row is the header naming each column, every subsequent row is one
 * geography's values in the same column order.
 */
export type CensusRawResponse = string[][];

export interface CensusParsedRow {
  value: number;
  geoLabel: string;
}

export type CensusFetcher = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export class CensusAcsAdapter implements SourceAdapter<CensusQuery, CensusRawResponse, CensusParsedRow> {
  readonly sourceId = "us-census-api";
  readonly profile: CREPublicSourceProfile;

  constructor(
    private readonly apiKey: string,
    private readonly fetcher: CensusFetcher = (url) => fetch(url) as unknown as ReturnType<CensusFetcher>,
  ) {
    const profile = getPublicSource("us-census-api");
    if (!profile) throw new Error("us-census-api is not registered in CRE_PUBLIC_SOURCE_REGISTRY");
    this.profile = profile;
  }

  async fetchRaw(query: CensusQuery): Promise<RawSourceRecord<CensusRawResponse>> {
    const params: Record<string, string> = {
      get: `NAME,${query.variable}`,
      for: `metropolitan statistical area/micropolitan statistical area:${query.metroCbsaCode}`,
      key: this.apiKey,
    };
    const url = `https://api.census.gov/data/${query.year}/acs/acs5?${new URLSearchParams(params).toString()}`;

    let response: { ok: boolean; status: number; json(): Promise<unknown> };
    try {
      response = await this.fetcher(url);
    } catch (err) {
      throw new SourceAdapterError("NETWORK_ERROR", `Census API request failed: ${(err as Error).message}`);
    }
    if (response.status === 429) {
      throw new SourceAdapterError("RATE_LIMITED", "Census API returned HTTP 429 (rate limited).");
    }
    if (response.status === 404) {
      throw new SourceAdapterError("GEOGRAPHY_NOT_COVERED", `Census API has no data for CBSA code "${query.metroCbsaCode}".`);
    }
    if (!response.ok) {
      throw new SourceAdapterError("NETWORK_ERROR", `Census API returned HTTP ${response.status}.`);
    }

    const raw = (await response.json()) as CensusRawResponse;
    return {
      sourceId: this.sourceId,
      datasetId: `acs5-${query.year}-${query.variable}`,
      retrievedAt: new Date().toISOString().slice(0, 10),
      requestParams: params,
      raw,
    };
  }

  parse(record: RawSourceRecord<CensusRawResponse>): CensusParsedRow[] {
    if (!Array.isArray(record.raw) || record.raw.length < 1) {
      throw new SourceAdapterError("SCHEMA_CHANGED", "Census API response was not the expected array-of-arrays shape.");
    }
    const [header, ...rows] = record.raw;
    if (!Array.isArray(header) || header.length < 2) {
      throw new SourceAdapterError("SCHEMA_CHANGED", "Census API header row is missing expected columns.");
    }
    const nameIdx = header.indexOf("NAME");
    const valueIdx = header.findIndex((h) => h !== "NAME" && !h.toLowerCase().includes("metropolitan"));
    if (nameIdx === -1 || valueIdx === -1) {
      throw new SourceAdapterError("SCHEMA_CHANGED", "Census API header does not contain the expected NAME/variable columns.");
    }
    if (rows.length === 0) {
      return [];
    }

    const parsed: CensusParsedRow[] = [];
    for (const row of rows) {
      const rawValue = row[valueIdx];
      const value = Number(rawValue);
      // Census uses large negative sentinel codes (e.g. -666666666) for
      // suppressed/unavailable estimates; these must be treated as absent
      // data, never as a real (and wildly implausible) statistic.
      if (!Number.isFinite(value) || value < 0) {
        throw new SourceAdapterError("VALIDATION_FAILED", `Census API returned a non-numeric or sentinel value "${rawValue}" for ${row[nameIdx]}.`);
      }
      parsed.push({ value, geoLabel: row[nameIdx] });
    }
    return parsed;
  }

  normalize(parsed: CensusParsedRow[], query: CensusQuery): IngestionOutcome {
    if (parsed.length === 0) {
      return {
        status: "gap",
        gap: {
          metric: "construction_index",
          geography: query.geography,
          reason: `Census ACS variable "${query.variable}" (${query.variableLabel}) returned no rows for CBSA ${query.metroCbsaCode}.`,
          reasonCode: "GEOGRAPHY_NOT_COVERED",
          sourcesChecked: ["us-census-api"],
          checkedAt: new Date().toISOString().slice(0, 10),
        },
      };
    }

    const retrievedAt = new Date().toISOString().slice(0, 10);
    const periodEnd = `${query.year}-12-31`;
    const periodStart = `${query.year - 4}-01-01`; // ACS 5-year estimates describe a 5-year window.

    const observations: EconomicIndicatorObservation[] = parsed.map((row) => ({
      sourceId: this.sourceId,
      indicatorId: query.variable,
      indicatorName: query.variableLabel,
      category: query.category,
      geography: query.geography,
      periodStart,
      periodEnd,
      value: row.value,
      unit: query.unit,
      dataStatus: "observed",
      citation: {
        sourceName: "U.S. Census Bureau",
        reportTitle: `American Community Survey 5-Year Estimates (${query.year}): ${query.variableLabel}`,
        publicationDate: periodEnd,
        period: `${query.year - 4}-${query.year} (5-year estimate)`,
        locator: `Variable ${query.variable}, CBSA ${query.metroCbsaCode} (${row.geoLabel})`,
        sourceUrl: `https://api.census.gov/data/${query.year}/acs/acs5`,
        retrievedAt,
        methodologyNote:
          "This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau.",
      },
      retrievedAt,
    }));

    return { status: "ok_economic", observations };
  }
}

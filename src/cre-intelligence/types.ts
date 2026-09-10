/**
 * InvestScape™ E68 — Commercial Real Estate Intelligence
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Data contracts only. E68 deliberately stores normalized observations and
 * provenance; it does not embed or redistribute proprietary brokerage,
 * transaction, or construction-cost databases.
 */

export type CRECountry = "CA" | "US";

export type CREAssetClass =
  | "office"
  | "industrial"
  | "retail"
  | "multifamily"
  | "hotel"
  | "self_storage"
  | "seniors_housing"
  | "student_housing"
  | "medical_office"
  | "data_center"
  | "mixed_use"
  | "other";

export type CRESourceType =
  | "government"
  | "brokerage"
  | "valuation"
  | "transaction_database"
  | "construction_cost"
  | "user"
  | "internal"
  | "other";

export type CREMetric = "cap_rate" | "hard_cost" | "soft_cost" | "construction_index";

export type CostBasis = "per_sf" | "per_unit" | "percent_of_hard_cost" | "index";

export interface CREGeography {
  country: CRECountry;
  region?: string;
  metro?: string;
  city?: string;
  submarket?: string;
}

export interface CRESource {
  sourceId: string;
  sourceName: string;
  sourceType: CRESourceType;
  methodologyUrl?: string;
  retrievedAt?: string;
  licenseNotes?: string;
}

/**
 * A normalized market observation. low/high are optional because some sources
 * publish point estimates while others publish ranges. For a point estimate,
 * set value and omit low/high. For a range, set low/high and optionally value
 * to the publisher's midpoint.
 */
export interface CREObservation {
  metric: CREMetric;
  assetClass: CREAssetClass;
  geography: CREGeography;
  periodStart: string;
  periodEnd: string;
  value?: number;
  low?: number;
  high?: number;
  unit: string;
  basis?: CostBasis;
  source: CRESource;
  sourceQuality: number;
  sampleSize?: number;
  tags?: Record<string, string>;
}

export interface ConsensusResult {
  metric: CREMetric;
  observationCount: number;
  weightedValue: number;
  low: number;
  high: number;
  confidence: number;
  sourceIds: string[];
}

export interface EscalationResult {
  baseCost: number;
  basePeriod: string;
  targetPeriod: string;
  indexRatio: number;
  escalatedCost: number;
}

/**
 * InvestScape™ E68 — CRE observation normalization.
 *
 * Normalization converts publisher-specific units into canonical internal
 * representations without changing the underlying published observation.
 */
import type { CREObservation, CREMetric, CRESource } from "./types";

export interface NormalizedCapRate {
  metric: "cap_rate";
  value?: number;
  low?: number;
  high?: number;
  source: CRESource;
  assetClass: CREObservation["assetClass"];
  geography: CREObservation["geography"];
  periodStart: string;
  periodEnd: string;
  sourceQuality: number;
  tags?: Record<string, string>;
}

export interface NormalizedConstructionCost {
  metric: "hard_cost" | "soft_cost";
  value?: number;
  low?: number;
  high?: number;
  unit: "CAD_per_sf" | "USD_per_sf" | "CAD_per_unit" | "USD_per_unit" | "percent_of_hard_cost";
  source: CRESource;
  assetClass: CREObservation["assetClass"];
  geography: CREObservation["geography"];
  periodStart: string;
  periodEnd: string;
  sourceQuality: number;
  tags?: Record<string, string>;
}

export interface NormalizedConstructionIndex {
  metric: "construction_index";
  value: number;
  unit: "index";
  source: CRESource;
  assetClass: CREObservation["assetClass"];
  geography: CREObservation["geography"];
  periodStart: string;
  periodEnd: string;
  sourceQuality: number;
  tags?: Record<string, string>;
}

function assertFinite(name: string, value: number | undefined): void {
  if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
    throw new Error(`${name} must be a finite non-negative number`);
  }
}

function normalizePercent(value: number | undefined, unit: string): number | undefined {
  if (value === undefined) return undefined;
  const normalizedUnit = unit.toLowerCase();
  if (normalizedUnit === "decimal" || normalizedUnit === "rate") return value;
  if (normalizedUnit === "percent" || normalizedUnit === "%" || normalizedUnit === "percentage") return value / 100;
  throw new Error(`Unsupported percentage unit: ${unit}`);
}

function validateRange(low: number | undefined, high: number | undefined): void {
  assertFinite("low", low);
  assertFinite("high", high);
  if (low !== undefined && high !== undefined && low > high) {
    throw new Error("low cannot exceed high");
  }
}

function assertMetric(obs: CREObservation, metric: CREMetric): void {
  if (obs.metric !== metric) throw new Error(`Expected ${metric} observation, received ${obs.metric}`);
}

export function normalizeCapRateObservation(obs: CREObservation): NormalizedCapRate {
  assertMetric(obs, "cap_rate");
  validateRange(obs.low, obs.high);
  assertFinite("value", obs.value);

  const normalizedValue = normalizePercent(obs.value, obs.unit);
  const normalizedLow = normalizePercent(obs.low, obs.unit);
  const normalizedHigh = normalizePercent(obs.high, obs.unit);

  if (normalizedValue === undefined && normalizedLow === undefined && normalizedHigh === undefined) {
    throw new Error("Cap-rate observation requires value, low, or high");
  }
  for (const [name, value] of [["value", normalizedValue], ["low", normalizedLow], ["high", normalizedHigh]] as const) {
    if (value !== undefined && value > 1) throw new Error(`${name} cap rate must be <= 100%`);
  }
  validateRange(normalizedLow, normalizedHigh);

  return {
    metric: "cap_rate",
    value: normalizedValue,
    low: normalizedLow,
    high: normalizedHigh,
    source: obs.source,
    assetClass: obs.assetClass,
    geography: obs.geography,
    periodStart: obs.periodStart,
    periodEnd: obs.periodEnd,
    sourceQuality: Math.max(0, Math.min(100, obs.sourceQuality)),
    tags: obs.tags,
  };
}

export function normalizeConstructionCostObservation(obs: CREObservation): NormalizedConstructionCost {
  if (obs.metric !== "hard_cost" && obs.metric !== "soft_cost") {
    throw new Error(`Expected hard_cost or soft_cost observation, received ${obs.metric}`);
  }
  if (!obs.basis) throw new Error("Construction cost observation requires a basis");
  validateRange(obs.low, obs.high);
  assertFinite("value", obs.value);

  const unit = obs.unit.toLowerCase();
  const isPercent = obs.basis === "percent_of_hard_cost";
  let canonicalUnit: NormalizedConstructionCost["unit"];
  let convert: (value: number | undefined) => number | undefined;

  if (isPercent) {
    canonicalUnit = "percent_of_hard_cost";
    convert = (value) => normalizePercent(value, obs.unit);
  } else if (obs.basis === "per_sf") {
    if (unit.includes("cad")) canonicalUnit = "CAD_per_sf";
    else if (unit.includes("usd")) canonicalUnit = "USD_per_sf";
    else throw new Error("Per-SF construction cost unit must specify CAD or USD");
    convert = (value) => value;
  } else if (obs.basis === "per_unit") {
    if (unit.includes("cad")) canonicalUnit = "CAD_per_unit";
    else if (unit.includes("usd")) canonicalUnit = "USD_per_unit";
    else throw new Error("Per-unit construction cost unit must specify CAD or USD");
    convert = (value) => value;
  } else {
    throw new Error(`Unsupported construction cost basis: ${obs.basis}`);
  }

  const normalizedValue = convert(obs.value);
  const normalizedLow = convert(obs.low);
  const normalizedHigh = convert(obs.high);
  validateRange(normalizedLow, normalizedHigh);

  if (isPercent) {
    for (const [name, value] of [["value", normalizedValue], ["low", normalizedLow], ["high", normalizedHigh]] as const) {
      if (value !== undefined && value > 1) throw new Error(`${name} soft-cost percentage must be <= 100%`);
    }
  }

  return {
    metric: obs.metric,
    value: normalizedValue,
    low: normalizedLow,
    high: normalizedHigh,
    unit: canonicalUnit,
    source: obs.source,
    assetClass: obs.assetClass,
    geography: obs.geography,
    periodStart: obs.periodStart,
    periodEnd: obs.periodEnd,
    sourceQuality: Math.max(0, Math.min(100, obs.sourceQuality)),
    tags: obs.tags,
  };
}

export function normalizeConstructionIndexObservation(obs: CREObservation): NormalizedConstructionIndex {
  assertMetric(obs, "construction_index");
  if (obs.unit.toLowerCase() !== "index") throw new Error("Construction index unit must be 'index'");
  if (obs.value === undefined || !Number.isFinite(obs.value) || obs.value <= 0) {
    throw new Error("Construction index requires a positive value");
  }
  return {
    metric: "construction_index",
    value: obs.value,
    unit: "index",
    source: obs.source,
    assetClass: obs.assetClass,
    geography: obs.geography,
    periodStart: obs.periodStart,
    periodEnd: obs.periodEnd,
    sourceQuality: Math.max(0, Math.min(100, obs.sourceQuality)),
    tags: obs.tags,
  };
}

export function constructionIndexRatio(base: NormalizedConstructionIndex, target: NormalizedConstructionIndex): number {
  if (base.value <= 0) throw new Error("Base construction index must be positive");
  return target.value / base.value;
}

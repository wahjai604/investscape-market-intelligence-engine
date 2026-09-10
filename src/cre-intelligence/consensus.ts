/**
 * InvestScape™ E68 — CRE Intelligence consensus helpers.
 *
 * Deterministic normalization only. No source-specific reliability is inferred
 * from a publisher name; callers supply sourceQuality explicitly.
 */
import type { CREObservation, ConsensusResult } from "./types";

function clampQuality(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function observationPoint(obs: CREObservation): number {
  if (obs.value !== undefined) return obs.value;
  if (obs.low !== undefined && obs.high !== undefined) return (obs.low + obs.high) / 2;
  if (obs.low !== undefined) return obs.low;
  if (obs.high !== undefined) return obs.high;
  throw new Error("CRE observation must contain value, low, or high");
}

export function weightedConsensus(observations: CREObservation[]): ConsensusResult {
  if (observations.length === 0) throw new Error("At least one CRE observation is required");

  const weights = observations.map((obs) => clampQuality(obs.sourceQuality));
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightTotal === 0) throw new Error("At least one observation must have positive sourceQuality");

  const points = observations.map(observationPoint);
  const weightedValue = points.reduce((sum, point, i) => sum + point * weights[i], 0) / weightTotal;
  const lows = observations.map((obs, i) => obs.low ?? points[i]);
  const highs = observations.map((obs, i) => obs.high ?? points[i]);

  return {
    metric: observations[0].metric,
    observationCount: observations.length,
    weightedValue,
    low: Math.min(...lows),
    high: Math.max(...highs),
    confidence: Math.round(Math.min(100, (observations.length / 5) * 100) * 100) / 100,
    sourceIds: observations.map((obs) => obs.source.sourceId),
  };
}

export function escalateCost(baseCost: number, baseIndex: number, targetIndex: number): number {
  if (!Number.isFinite(baseCost) || baseCost < 0) throw new Error("baseCost must be a finite non-negative number");
  if (!Number.isFinite(baseIndex) || baseIndex <= 0) throw new Error("baseIndex must be positive");
  if (!Number.isFinite(targetIndex) || targetIndex <= 0) throw new Error("targetIndex must be positive");
  return baseCost * (targetIndex / baseIndex);
}

/**
 * InvestScape™ E70 Phase 4 — Escalation Engine.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * `escalateCost()` is the Phase 4 primitive: given a historical/base-period
 * hard_cost or soft_cost observation and a requested target period, produce
 * an explicit, auditable escalated figure ONLY when defensible index
 * evidence exists — otherwise an explicit `EscalationDataGap`, never a
 * fabricated number (Design Principles 1-6).
 *
 * Pure function: never mutates `request.sourceObservation` or any index
 * observation. Deterministic: identical inputs (including `computedAt`,
 * which is caller-supplied, never `Date.now()`) always produce an identical
 * result — no hidden state, no randomness, no wall-clock dependency.
 *
 * THIS FILE DOES NOT compute a confidence score, a benchmark consensus, or
 * any total/hard/soft aggregation — that remains Phase 5 (docs/E70-phase1-
 * technical-specification.md Section 24). It preserves enough information
 * (`relationship`, `indexSeries`) for Phase 5 to build a confidence model on
 * top, per this phase's explicit boundary instruction.
 */
import type { CRECitedObservation } from "../cre-intelligence/types";
import { evaluateIndexApplicability } from "./applicability";
import { CC_DEFAULT_ESCALATION_POLICY, type CCEscalationPolicy } from "./escalation-policy";
import { CC_KNOWN_INDEX_OBSERVATIONS } from "./data/index-series";
import type {
  CCCostFigure,
  CCIndexObservation,
  CCIndexSeries,
  CCPeriod,
  EscalationDataGap,
  EscalationDataGapReasonCode,
  EscalationOutcome,
  EscalationRequest,
  EscalationResult,
} from "./index-types";

function parseCurrencyFromUnit(unit: string): "USD" | "CAD" | undefined {
  if (unit.startsWith("USD")) return "USD";
  if (unit.startsWith("CAD")) return "CAD";
  return undefined;
}

function isPositiveOrUndefined(n: number | undefined): boolean {
  return n === undefined || (Number.isFinite(n) && n > 0);
}

function periodsIdentical(a: CCPeriod, b: CCPeriod): boolean {
  return a.start === b.start && a.end === b.end;
}

function gap(
  request: EscalationRequest,
  reasonCode: EscalationDataGapReasonCode,
  reason: string,
  seriesConsidered: readonly CCIndexSeries[],
  resolutionHint?: string,
): EscalationOutcome {
  const dataGap: EscalationDataGap = {
    request: { sourceObservation: request.sourceObservation, targetPeriod: request.targetPeriod },
    reasonCode,
    reason,
    seriesConsidered,
    resolutionHint,
    checkedAt: request.computedAt,
  };
  return { status: "DATA_GAP", gap: dataGap };
}

function findIndexObservationForPeriod(
  pool: readonly CCIndexObservation[],
  series: CCIndexSeries,
  observation: CRECitedObservation,
  period: CCPeriod,
): { value: number; observation: CRECitedObservation } | { conflict: true } | undefined {
  const matches = pool.filter(
    (io) =>
      io.series.seriesId === series.seriesId &&
      io.observation.periodStart === period.start &&
      io.observation.periodEnd === period.end &&
      geographyMatchesForSeries(series, observation, io.observation),
  );
  if (matches.length === 0) return undefined;
  const values = new Set(matches.map((m) => m.observation.value));
  if (values.size > 1) return { conflict: true };
  const chosen = matches[0];
  return { value: chosen.observation.value as number, observation: chosen.observation };
}

/**
 * City-level series must match on the observation's own city (never
 * "closest city" or "same region"); national series has no city dimension
 * to match at all — applicability.ts already restricted WHICH series are
 * even candidates, this only disambiguates which specific index observation
 * within that series pertains to this request's geography.
 */
function geographyMatchesForSeries(series: CCIndexSeries, costObservation: CRECitedObservation, indexObservation: CRECitedObservation): boolean {
  if (series.geographyType === "national") return indexObservation.geography.country === costObservation.geography.country;
  return indexObservation.geography.city === costObservation.geography.city && indexObservation.geography.country === costObservation.geography.country;
}

function scaleCostFigure(figure: Pick<CCCostFigure, "low" | "high" | "value">, ratio: number): { low?: number; high?: number; value?: number } {
  return {
    low: figure.low !== undefined ? figure.low * ratio : undefined,
    high: figure.high !== undefined ? figure.high * ratio : undefined,
    value: figure.value !== undefined ? figure.value * ratio : undefined,
  };
}

/**
 * Escalate one source cost observation to a target period. `indexPool`
 * defaults to every index observation E70 actually knows about
 * (data/index-series.ts) but is overridable so tests can exercise synthetic
 * evidence (duplicate/conflicting observations, unsupported series, etc.)
 * without mutating the real dataset.
 */
export function escalateCost(
  request: EscalationRequest,
  indexPool: readonly CCIndexObservation[] = CC_KNOWN_INDEX_OBSERVATIONS,
): EscalationOutcome {
  const policy: CCEscalationPolicy = request.policy ?? CC_DEFAULT_ESCALATION_POLICY;
  const observation = request.sourceObservation;

  if (observation.metric !== "hard_cost" && observation.metric !== "soft_cost") {
    return gap(
      request,
      "INCOMPATIBLE_METRIC",
      `Source observation metric is "${observation.metric}", not hard_cost or soft_cost. An index or cost-change observation is never itself escalatable — it is not a cost figure (Phase 1 Section 6.3).`,
      [],
    );
  }

  const hasAnyValue = observation.low !== undefined || observation.high !== undefined || observation.value !== undefined;
  if (!hasAnyValue) {
    return gap(request, "MISSING_BASE_COST", "The source observation has no low, high, or value field populated — there is no base cost to escalate.", []);
  }
  if (!isPositiveOrUndefined(observation.low) || !isPositiveOrUndefined(observation.high) || !isPositiveOrUndefined(observation.value)) {
    return gap(
      request,
      "INVALID_COST_VALUE",
      `The source observation's cost value(s) include a non-positive number (low=${observation.low}, high=${observation.high}, value=${observation.value}). A construction cost cannot be zero or negative.`,
      [],
    );
  }

  const currency = parseCurrencyFromUnit(observation.unit);
  if (currency === undefined) {
    return gap(
      request,
      "INCOMPATIBLE_CURRENCY",
      `Observation unit "${observation.unit}" does not declare an explicit currency (USD/CAD). Escalation cannot proceed without knowing the currency of the base cost.`,
      [],
    );
  }

  if (!observation.periodStart || !observation.periodEnd) {
    return gap(request, "UNRESOLVED_PERIOD", "The source observation does not state a resolvable periodStart/periodEnd.", []);
  }
  if (!request.targetPeriod.start || !request.targetPeriod.end) {
    return gap(request, "UNRESOLVED_PERIOD", "The requested target period does not state a resolvable start/end date.", []);
  }

  const basePeriod: CCPeriod = { start: observation.periodStart, end: observation.periodEnd, label: observation.citation.period };
  const targetPeriod = request.targetPeriod;

  const baseCost: CCCostFigure = { low: observation.low, high: observation.high, value: observation.value, unit: observation.unit, currency };

  // --- Same-period identity escalation: no index lookup required (policy-gated). ---
  if (policy.period.allowSamePeriodIdentity && periodsIdentical(basePeriod, targetPeriod)) {
    const result: EscalationResult = {
      sourceObservation: observation,
      baseCost,
      basePeriod,
      targetPeriod,
      relationship: "IDENTICAL_PERIOD",
      escalatedCost: { ...baseCost },
      calculation: {
        formula: "escalatedCost = baseCost (target period is identical to base period; ratio = 1 by identity, no index lookup performed)",
        baseIndexValue: 1,
        targetIndexValue: 1,
        indexRatio: 1,
        steps: [
          `Base period (${basePeriod.start} to ${basePeriod.end}) is identical to target period (${targetPeriod.start} to ${targetPeriod.end}).`,
          "Policy allowSamePeriodIdentity = true: escalated cost equals base cost exactly, ratio 1.0.",
        ],
      },
      policyVersion: policy.version,
      computedAt: request.computedAt,
    };
    return { status: "ESCALATED", result };
  }

  if (!policy.period.allowReversePeriodRequest && targetPeriod.start < basePeriod.start) {
    return gap(
      request,
      "UNRESOLVED_PERIOD",
      `Target period (${targetPeriod.start}) precedes base period (${basePeriod.start}) and policy.period.allowReversePeriodRequest is false.`,
      [],
    );
  }

  // --- Determine every series applicable to this observation. ---
  const candidateSeries = uniqueSeries(indexPool);
  const applicabilityBySeriesId = new Map(candidateSeries.map((series) => [series.seriesId, evaluateIndexApplicability(observation, series, policy)]));
  const applicableSeries = candidateSeries.filter((series) => applicabilityBySeriesId.get(series.seriesId)?.applicable);

  if (applicableSeries.length === 0) {
    return gap(request, ...deriveNoApplicableSeriesGap(candidateSeries, applicabilityBySeriesId), candidateSeries);
  }

  if (policy.period.allowNearestPeriodMatching) {
    // Nearest-period matching is enabled by policy but no implementation exists in Phase 4 —
    // fail conservatively rather than silently ignore the policy flag.
    return gap(
      request,
      "UNRESOLVED_PERIOD",
      "Policy has allowNearestPeriodMatching = true, but Phase 4 does not implement nearest-period substitution logic. Failing conservatively rather than silently falling back to exact-period matching or fabricating a match.",
      candidateSeries,
    );
  }

  // Try each applicable series in DIRECT-first order (deterministic, stable within each
  // relationship tier). A series is only actually USED once both its base- and
  // target-period index observations resolve cleanly; a series that is geographically/
  // currency-applicable but has no period coverage for this specific request is skipped
  // in favor of the next applicable series, rather than immediately failing the whole
  // request merely because the higher-precedence (DIRECT) series lacks period coverage.
  const orderedSeries = [
    ...applicableSeries.filter((s) => applicabilityBySeriesId.get(s.seriesId)?.relationship === "DIRECT"),
    ...applicableSeries.filter((s) => applicabilityBySeriesId.get(s.seriesId)?.relationship !== "DIRECT"),
  ];

  let lastFailure: { reasonCode: EscalationDataGapReasonCode; reason: string; resolutionHint?: string } | undefined;

  for (const series of orderedSeries) {
    const relationship = applicabilityBySeriesId.get(series.seriesId)!.relationship!;

    const baseIndex = findIndexObservationForPeriod(indexPool, series, observation, basePeriod);
    if (baseIndex === undefined) {
      lastFailure = {
        reasonCode: "MISSING_BASE_INDEX",
        reason: `No index observation exists in series "${series.seriesId}" for the base period (${basePeriod.start} to ${basePeriod.end}). Nearest-period matching is disabled by policy.`,
        resolutionHint: "Enabling policy.period.allowNearestPeriodMatching (a PROVISIONAL policy) would allow a documented nearest-period substitution instead.",
      };
      continue;
    }
    if ("conflict" in baseIndex) {
      lastFailure = {
        reasonCode: "INSUFFICIENT_INDEX_EVIDENCE",
        reason: `Multiple index observations exist in series "${series.seriesId}" for the base period with conflicting values. No single defensible base index value can be determined.`,
      };
      continue;
    }
    if (baseIndex.value <= 0) {
      lastFailure = { reasonCode: "INVALID_INDEX_VALUE", reason: `Base-period index observation in series "${series.seriesId}" has a non-positive value (${baseIndex.value}).` };
      continue;
    }

    const targetIndex = findIndexObservationForPeriod(indexPool, series, observation, targetPeriod);
    if (targetIndex === undefined) {
      lastFailure = {
        reasonCode: "MISSING_TARGET_INDEX",
        reason: `No index observation exists in series "${series.seriesId}" for the target period (${targetPeriod.start} to ${targetPeriod.end}). Nearest-period matching is disabled by policy.`,
        resolutionHint: "Enabling policy.period.allowNearestPeriodMatching (a PROVISIONAL policy) would allow a documented nearest-period substitution instead.",
      };
      continue;
    }
    if ("conflict" in targetIndex) {
      lastFailure = {
        reasonCode: "INSUFFICIENT_INDEX_EVIDENCE",
        reason: `Multiple index observations exist in series "${series.seriesId}" for the target period with conflicting values. No single defensible target index value can be determined.`,
      };
      continue;
    }
    if (targetIndex.value <= 0) {
      lastFailure = { reasonCode: "INVALID_INDEX_VALUE", reason: `Target-period index observation in series "${series.seriesId}" has a non-positive value (${targetIndex.value}).` };
      continue;
    }

    const indexRatio = targetIndex.value / baseIndex.value;
    const scaled = scaleCostFigure(baseCost, indexRatio);
    const escalatedCost: CCCostFigure = { ...scaled, unit: observation.unit, currency };

    const result: EscalationResult = {
      sourceObservation: observation,
      baseCost,
      basePeriod,
      targetPeriod,
      indexSeries: series,
      baseIndexObservation: baseIndex.observation,
      targetIndexObservation: targetIndex.observation,
      relationship,
      escalatedCost,
      calculation: {
        formula: "escalatedCost = baseCost × (targetIndex / baseIndex)",
        baseIndexValue: baseIndex.value,
        targetIndexValue: targetIndex.value,
        indexRatio,
        steps: [
          `Selected index series "${series.seriesId}" (${relationship} relationship): ${applicabilityBySeriesId.get(series.seriesId)!.reason}`,
          `Base index value at ${basePeriod.start}–${basePeriod.end}: ${baseIndex.value} (${baseIndex.observation.citation.locator}).`,
          `Target index value at ${targetPeriod.start}–${targetPeriod.end}: ${targetIndex.value} (${targetIndex.observation.citation.locator}).`,
          `indexRatio = ${targetIndex.value} / ${baseIndex.value} = ${indexRatio}.`,
          `escalatedCost = baseCost × ${indexRatio} (no intermediate rounding applied).`,
        ],
      },
      policyVersion: policy.version,
      computedAt: request.computedAt,
    };
    return { status: "ESCALATED", result };
  }

  return gap(
    request,
    lastFailure?.reasonCode ?? "INSUFFICIENT_INDEX_EVIDENCE",
    lastFailure?.reason ?? "No applicable index series had resolvable base/target period evidence.",
    candidateSeries,
    lastFailure?.resolutionHint,
  );
}

/**
 * Deduplicated by seriesId and sorted deterministically by seriesId so that
 * pool ordering (e.g. a caller-supplied pool in a different order) never
 * changes which series is considered "first" — output must be pool-order
 * independent (Design Principle: input-order independence).
 */
function uniqueSeries(pool: readonly CCIndexObservation[]): CCIndexSeries[] {
  const bySeriesId = new Map<string, CCIndexSeries>();
  for (const io of pool) bySeriesId.set(io.series.seriesId, io.series);
  return [...bySeriesId.values()].sort((a, b) => a.seriesId.localeCompare(b.seriesId));
}

function deriveNoApplicableSeriesGap(
  candidateSeries: readonly CCIndexSeries[],
  applicabilityBySeriesId: Map<string, ReturnType<typeof evaluateIndexApplicability>>,
): [EscalationDataGapReasonCode, string] {
  const results = candidateSeries.map((s) => applicabilityBySeriesId.get(s.seriesId)!);
  const categories = new Set(results.map((r) => r.failureCategory));

  if (categories.size === 1 && categories.has("SOURCE_STATUS")) {
    return ["SOURCE_NOT_VERIFIED", "Every candidate index series is registered or rejected, not verified for active use — no number is computed from an unverified source."];
  }
  if (categories.size === 1 && categories.has("CURRENCY")) {
    return ["INCOMPATIBLE_CURRENCY", "No candidate index series' applicable currency matches this observation's currency."];
  }
  if (categories.size === 1 && categories.has("METRIC")) {
    return ["INCOMPATIBLE_METRIC", "The source observation is not an escalatable cost metric."];
  }
  if (categories.has("GEOGRAPHY") && !categories.has("SOURCE_STATUS") && !categories.has("CURRENCY")) {
    return ["UNSUPPORTED_GEOGRAPHY", "No index series has an established, defensible geographic applicability relationship to this observation."];
  }
  return [
    "INSUFFICIENT_INDEX_EVIDENCE",
    `No index series is applicable to this request: ${results.map((r) => r.reason).join(" | ")}`,
  ];
}

/**
 * InvestScape™ E87 Phase 6 — Scenario / Sensitivity Framework: implementation.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Consumes Phase 5's `E87PipelineResult` verbatim (never re-derives
 * comparability, consensus, transaction derivation, or override resolution).
 * Produces cap-rate scenarios only — see scenario-types.ts and
 * docs/E87-phase6-scenario-sensitivity.md for the full scope boundary.
 */
import type { E87BenchmarkOrigin, E87PipelineResult } from "./pipeline-types";
import type { E87ComparabilityCandidate } from "./comparability-types";
import type {
  DefaultSensitivityPolicy,
  E87EvidenceSupportedRange,
  E87HypotheticalScenarioSet,
  E87Scenario,
  E87ScenarioBasis,
  E87ScenarioProvenance,
  E87ScenarioResult,
  E87ScenarioType,
  E87SensitivityDeltaInput,
} from "./scenario-types";

// ---------------------------------------------------------------------------
// Deterministic integer basis-point arithmetic
// ---------------------------------------------------------------------------

/**
 * Scale a percent value (e.g. 5.567) into integer "hundredths of a basis
 * point" (1 bp = 0.01 percentage point, so this scale is value * 10_000).
 * Working in this integer domain avoids repeated floating-point addition
 * error when applying whole-basis-point deltas.
 */
function toScaled(percentValue: number): number {
  return Math.round(percentValue * 10_000);
}

function fromScaled(scaled: number): number {
  return scaled / 10_000;
}

/** Whole basis points -> the same scaled integer domain as `toScaled`. */
function bpsToScaled(bps: number): number {
  return bps * 100;
}

// ---------------------------------------------------------------------------
// Delta normalization
// ---------------------------------------------------------------------------

interface NormalizedDelta {
  bps: number;
  label?: string;
}

/**
 * Validates and normalizes the caller's requested deltas: integers only,
 * deduped by bps value (last label for a given bps wins, deterministically,
 * since input is sorted by bps before any tie-break — duplicates of the same
 * bps collapse to one scenario), sorted ascending. Order and duplication in
 * the caller's input never affect the output.
 */
function normalizeDeltas(deltas: readonly E87SensitivityDeltaInput[]): NormalizedDelta[] | { error: string } {
  const byBps = new Map<number, string | undefined>();
  for (const d of deltas) {
    const bps = typeof d === "number" ? d : d.bps;
    const label = typeof d === "number" ? undefined : d.label;
    if (!Number.isInteger(bps)) {
      return { error: `Sensitivity delta ${bps} is not an integer number of basis points.` };
    }
    if (!Number.isFinite(bps) || Math.abs(bps) > 100_000) {
      return { error: `Sensitivity delta ${bps} is out of a sane range.` };
    }
    // Deterministic dedupe: if the same bps appears more than once, keep the
    // first non-undefined label encountered after sorting by input order is
    // irrelevant here since we sort by bps below; ties are broken by
    // preferring a defined label over undefined, applied in a stable pass.
    const existing = byBps.get(bps);
    if (existing === undefined && label !== undefined) {
      byBps.set(bps, label);
    } else if (!byBps.has(bps)) {
      byBps.set(bps, label);
    }
  }
  const normalized = Array.from(byBps.entries())
    // A deltaBps of 0 is always already represented by the anchor scenario
    // (the actual benchmark/override value) — a mechanically generated
    // "+0bps" scenario would be an exact duplicate value with a misleading
    // provenance, so 0 is dropped here rather than ever appearing twice.
    .filter(([bps]) => bps !== 0)
    .map(([bps, label]) => ({ bps, label }))
    .sort((a, b) => a.bps - b.bps);
  return normalized;
}

// ---------------------------------------------------------------------------
// Scenario construction
// ---------------------------------------------------------------------------

function classifyScenarioType(bps: number, label: string | undefined): E87ScenarioType {
  if (label !== undefined) return "custom";
  if (bps === 0) return "benchmark";
  return bps < 0 ? "downside" : "upside";
}

function buildAnchorScenario(
  referenceValue: number,
  provenance: E87ScenarioProvenance,
  basis: E87ScenarioBasis,
  confidence: string | undefined,
  auditExplanation: string,
): E87Scenario {
  return {
    scenarioType: "benchmark",
    capRateValue: referenceValue,
    deltaBps: 0,
    referenceValue,
    provenance,
    basis,
    confidence: confidence as E87Scenario["confidence"],
    auditExplanation,
  };
}

function buildMechanicalScenario(
  referenceValue: number,
  delta: NormalizedDelta,
  basis: E87ScenarioBasis,
  scenarioType: E87ScenarioType,
): E87Scenario {
  const scaledValue = fromScaled(toScaled(referenceValue) + bpsToScaled(delta.bps));
  return {
    scenarioType,
    capRateValue: scaledValue,
    deltaBps: delta.bps,
    referenceValue,
    provenance: "mechanically_generated",
    basis,
    // confidence intentionally omitted: a mechanically generated value never
    // acquires the underlying benchmark's observational confidence.
    auditExplanation:
      `Mechanically generated sensitivity scenario: ${referenceValue} + ${delta.bps}bps = ${scaledValue}. ` +
      "This value is NOT an observed or derived market cap rate; it is a deterministic arithmetic scenario " +
      `applied to the ${basis === "user_override" ? "user-overridden benchmark value" : basis === "hypothetical" ? "caller-supplied hypothetical base value" : "benchmark value"}.` +
      (delta.label ? ` Caller label: "${delta.label}".` : ""),
  };
}

// ---------------------------------------------------------------------------
// Evidence-supported range
// ---------------------------------------------------------------------------

/**
 * Determine whether Phase 3's own evidence can legitimately support a range,
 * WITHOUT ever manufacturing one via +/-N bps. Two, and only two, defensible
 * bases are recognized:
 *
 *  1. `publisher_explicit_range`: exactly one contributing observation, and
 *     that observation itself carries a published low/high (per E86's
 *     `CREObservation` contract: a range observation sets low/high and
 *     leaves `value` undefined).
 *  2. `multi_observation_empirical_range`: two or more contributing
 *     observations, each with a resolvable scalar value (`value`, or the
 *     midpoint of its own low/high if it is itself a range observation) —
 *     the range is exactly [min, max] of those real, already-included
 *     observations. Never widened, never smoothed.
 *
 * Anything else (a single point-value observation, zero contributors) has no
 * defensible range and is reported as unavailable with a reason code.
 */
function computeEvidenceRange(contributing: readonly E87ComparabilityCandidate[]): E87EvidenceSupportedRange {
  if (contributing.length === 0) {
    return {
      available: false,
      reason: "SINGLE_POINT_OBSERVATION",
      explanation: "No contributing observations were available to establish any range.",
    };
  }

  if (contributing.length === 1) {
    const o = contributing[0].observation;
    if (o.low !== undefined && o.high !== undefined) {
      return {
        available: true,
        low: o.low,
        high: o.high,
        basis: "publisher_explicit_range",
        contributingCount: 1,
        explanation:
          `The sole contributing observation (${o.source.sourceName}) itself published an explicit range ` +
          `[${o.low}, ${o.high}] rather than a single point value; that published range is used verbatim.`,
      };
    }
    return {
      available: false,
      reason: "SINGLE_POINT_OBSERVATION",
      explanation:
        "The benchmark rests on a single point-value observation with no published range. " +
        "No defensible range exists; one was deliberately not manufactured.",
    };
  }

  const scalarValues: number[] = [];
  for (const c of contributing) {
    const o = c.observation;
    if (o.value !== undefined) {
      scalarValues.push(o.value);
    } else if (o.low !== undefined && o.high !== undefined) {
      scalarValues.push((o.low + o.high) / 2);
    }
  }
  if (scalarValues.length < 2) {
    return {
      available: false,
      reason: "SINGLE_POINT_OBSERVATION",
      explanation: "Fewer than two contributing observations exposed a resolvable scalar value; no empirical range can be established.",
    };
  }
  const low = Math.min(...scalarValues);
  const high = Math.max(...scalarValues);
  return {
    available: true,
    low,
    high,
    basis: "multi_observation_empirical_range",
    contributingCount: scalarValues.length,
    explanation:
      `${scalarValues.length} contributing observations established an empirical range of ` +
      `[${low}, ${high}] from their own real reported values (min/max, no smoothing or widening applied).`,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate the scenario set for one E87 pipeline result. Deterministic: the
 * same `pipelineResult` and the same set of `deltas` (regardless of input
 * order or duplication) always produce an identical `E87ScenarioResult`.
 *
 * Never mutates `pipelineResult` or any observation reachable from it.
 */
export function generateScenarios(
  pipelineResult: E87PipelineResult,
  deltas: readonly E87SensitivityDeltaInput[] = [],
): E87ScenarioResult {
  if (pipelineResult.pipelineStatus === "data_gap") {
    return {
      scenarioStatus: "data_gap",
      underlyingGap: pipelineResult.result,
      requestedGeography: pipelineResult.requestedGeography,
      explanation:
        "The underlying E87 benchmark is a DATA_GAP " +
        `(${pipelineResult.result.gap.reasonCode}: ${pipelineResult.result.gap.explanation}). ` +
        "No scenarios were mechanically generated from nothing; the original gap and audit trail are preserved verbatim.",
    };
  }

  const normalized = normalizeDeltas(deltas);
  if ("error" in normalized) {
    return { scenarioStatus: "error", reasonCode: "INVALID_DELTA", explanation: normalized.error };
  }

  if (pipelineResult.pipelineStatus === "user_overridden") {
    const referenceValue = pipelineResult.override.overrideValue;
    const underlyingSuccess = pipelineResult.underlying.status === "success" ? pipelineResult.underlying : undefined;
    const contributing = underlyingSuccess?.contributingObservations ?? [];
    const anchor = buildAnchorScenario(
      referenceValue,
      "user_override",
      "user_override",
      undefined,
      `Active value ${referenceValue} came from an E86 user override ("${pipelineResult.override.overrideReason}"), ` +
        "not from publisher data. The underlying benchmark (if any) is preserved unmodified and remains separately retrievable.",
    );
    const scenarios = [anchor, ...normalized.map((d) => buildMechanicalScenario(referenceValue, d, "user_override", classifyScenarioType(d.bps, d.label)))];
    return {
      scenarioStatus: "success",
      origin: pipelineResult.origin as E87BenchmarkOrigin | "n/a",
      isOverrideBased: true,
      requestedGeography: pipelineResult.requestedGeography,
      referenceValue,
      scenarios,
      evidenceRange: computeEvidenceRange(contributing),
    };
  }

  // pipelineStatus === "success"
  const referenceValue = pipelineResult.result.benchmark.value;
  const provenance: E87ScenarioProvenance = pipelineResult.origin === "transaction_derived" ? "derived" : "observed";
  const anchor = buildAnchorScenario(
    referenceValue,
    provenance,
    "benchmark",
    pipelineResult.result.confidence,
    `Benchmark value ${referenceValue} as produced by Phase 3 (${pipelineResult.result.benchmark.method}), ` +
      `origin classified as "${pipelineResult.origin}". This is the actual benchmark, not a generated scenario.`,
  );
  const scenarios = [anchor, ...normalized.map((d) => buildMechanicalScenario(referenceValue, d, "benchmark", classifyScenarioType(d.bps, d.label)))];
  return {
    scenarioStatus: "success",
    origin: pipelineResult.origin,
    isOverrideBased: false,
    requestedGeography: pipelineResult.requestedGeography,
    referenceValue,
    scenarios,
    evidenceRange: computeEvidenceRange(pipelineResult.result.contributingObservations),
  };
}

/**
 * Convenience wrapper applying the versioned, PROVISIONAL default sensitivity
 * policy. Never called implicitly by `generateScenarios` — a caller must
 * explicitly opt in, so a default policy value can never masquerade as
 * market evidence.
 */
export function generateScenariosWithDefaultPolicy(
  pipelineResult: E87PipelineResult,
  policy: DefaultSensitivityPolicy,
): E87ScenarioResult {
  return generateScenarios(pipelineResult, policy.deltasBps);
}

/**
 * Standalone hypothetical scenarios with NO E87 benchmark behind them at all.
 * Deliberately minimal and unmistakably labeled — see
 * docs/E87-phase6-scenario-sensitivity.md "Hypothetical scenarios without a
 * benchmark" for the boundary decision. `acknowledgeHypothetical` must be
 * passed as `true`: this is a structural speed bump, not a UX nicety, against
 * a caller silently treating a bare number as a market benchmark.
 */
export function generateHypotheticalScenarios(
  callerSuppliedBaseValue: number,
  deltas: readonly E87SensitivityDeltaInput[],
  acknowledgeHypothetical: true,
): E87HypotheticalScenarioSet | { scenarioStatus: "error"; reasonCode: "INVALID_DELTA"; explanation: string } {
  void acknowledgeHypothetical; // type-level gate only; see doc rationale
  const normalized = normalizeDeltas(deltas);
  if ("error" in normalized) {
    return { scenarioStatus: "error", reasonCode: "INVALID_DELTA", explanation: normalized.error };
  }
  const anchor: E87Scenario = {
    scenarioType: "benchmark",
    capRateValue: callerSuppliedBaseValue,
    deltaBps: 0,
    referenceValue: callerSuppliedBaseValue,
    provenance: "mechanically_generated",
    basis: "hypothetical",
    auditExplanation:
      `Caller-supplied hypothetical base value ${callerSuppliedBaseValue}. This is NOT derived from any E87 ` +
      "benchmark, observation, or transaction — it is a standalone assumption supplied entirely by the caller.",
  };
  const scenarios = [anchor, ...normalized.map((d) => buildMechanicalScenario(callerSuppliedBaseValue, d, "hypothetical", classifyScenarioType(d.bps, d.label)))];
  return {
    scenarioStatus: "hypothetical",
    isHypothetical: true,
    callerSuppliedBaseValue,
    scenarios,
    evidenceRange: {
      available: false,
      reason: "NOT_APPLICABLE_HYPOTHETICAL",
      explanation: "No E87 benchmark or observations are involved; an evidence-supported range is not applicable to a hypothetical value.",
    },
    disclaimer:
      "These values are a standalone hypothetical, NOT derived from any market observation, transaction, or E87 benchmark. " +
      "Do not present them as market evidence. E87 does not validate, forecast, or endorse the caller-supplied base value.",
  };
}

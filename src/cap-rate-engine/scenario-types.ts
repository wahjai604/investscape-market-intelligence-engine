/**
 * InvestScape™ E69 Phase 6 — Scenario / Sensitivity Framework: types.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * E69 Phase 6 answers exactly one question: "what cap-rate scenarios can
 * legitimately be evaluated around this benchmark?" It is NOT a property
 * valuation engine, NOT an NOI forecast, NOT a DCF/IRR/feasibility engine, and
 * NOT an investment recommendation engine. See
 * docs/E69-phase6-scenario-sensitivity.md for the full design rationale.
 *
 * CORE DISTINCTION preserved throughout this file: a mechanically generated
 * sensitivity scenario is NEVER represented as, and never acquires the type
 * of, an observed/derived market cap rate. `E69ScenarioProvenance` is the
 * field that carries this distinction end-to-end.
 */
import type { CREGeography } from "../cre-intelligence/types";
import type { E69ConfidenceTier } from "./consensus-types";
import type { E69BenchmarkOrigin } from "./pipeline-types";
import type { E69PipelineDataGapResult } from "./pipeline-types";

/**
 * Where a scenario's cap-rate value actually came from.
 *  - "observed": the benchmark itself, when the underlying Phase 5 origin was
 *    a publisher/survey reading or a multi-source consensus of observed
 *    readings.
 *  - "derived": the benchmark itself, when the underlying Phase 5 origin was
 *    transaction-derived (Phase 4 arithmetic on real transaction inputs, not
 *    a mechanical sensitivity step).
 *  - "user_override": the benchmark's active value came from an E68 user
 *    override (Phase 5 `user_overridden`). Never presented as publisher data.
 *  - "mechanically_generated": a caller-requested sensitivity delta applied
 *    to a reference value. Never presented as, and never carries the
 *    confidence of, an observed or derived market reading.
 */
export type E69ScenarioProvenance = "observed" | "derived" | "user_override" | "mechanically_generated";

/** Neutral labels only — none of these imply a favorable/unfavorable outcome. */
export type E69ScenarioType = "benchmark" | "downside" | "base" | "upside" | "custom";

/** What a scenario's cap-rate value is expressed relative to. */
export type E69ScenarioBasis = "benchmark" | "user_override" | "hypothetical";

/**
 * One scenario cap-rate value. `capRateValue` and `deltaBps` are always both
 * populated (deltaBps === 0 for the anchor scenario) so a consumer never has
 * to infer one from the other.
 */
export interface E69Scenario {
  scenarioType: E69ScenarioType;
  /** The scenario's cap-rate value, in the same percent unit as the benchmark. Never rounded beyond the benchmark's own precision plus the requested integer bps. */
  capRateValue: number;
  /** Signed, integer basis points relative to the reference value. 0 for the anchor scenario. */
  deltaBps: number;
  /** The value this scenario is computed relative to (the benchmark's or override's active value, or a caller-supplied hypothetical base). */
  referenceValue: number;
  provenance: E69ScenarioProvenance;
  basis: E69ScenarioBasis;
  /** Only meaningful for provenance "observed" | "derived" | "user_override" — the benchmark's own confidence. Absent (never fabricated) for "mechanically_generated". */
  confidence?: E69ConfidenceTier;
  /** Deterministic, human-presentable explanation of exactly how this value was produced. */
  auditExplanation: string;
}

/**
 * Whether Phase 3's evidence can legitimately support a range (as opposed to
 * a single point value), and if so, exactly which evidence backs it. NEVER
 * constructed by applying an arbitrary +/-N bps to a point value — every
 * field here traces to real contributing observations.
 */
export type E69EvidenceSupportedRange =
  | {
      available: true;
      low: number;
      high: number;
      /** "publisher_explicit_range": a single contributing observation itself published low/high.
       *  "multi_observation_empirical_range": >= 2 contributing observations' scalar values span [low, high]. */
      basis: "publisher_explicit_range" | "multi_observation_empirical_range";
      contributingCount: number;
      explanation: string;
    }
  | {
      available: false;
      reason:
        | "SINGLE_POINT_OBSERVATION"
        | "NOT_APPLICABLE_DATA_GAP"
        | "NOT_APPLICABLE_HYPOTHETICAL";
      explanation: string;
    };

/** A caller-requested sensitivity delta, optionally with a caller-chosen label (forces scenarioType "custom"). */
export type E69SensitivityDeltaInput = number | { bps: number; label?: string };

export interface E69SensitivityRequest {
  /** Integer basis points. Duplicates are deterministically deduped; order does not affect output (deltas are sorted ascending before processing). Non-integer values are a typed error, never silently rounded. */
  deltas: readonly E69SensitivityDeltaInput[];
}

/**
 * PROVISIONAL convenience policy, versioned and clearly NOT market evidence.
 * Never applied automatically — a caller must explicitly opt in via
 * `useDefaultDeltas: true`. See docs/E69-phase6-scenario-sensitivity.md
 * "Default sensitivity policy" for why this exists and why it is not a set
 * of universal stress-test rules.
 */
export interface DefaultSensitivityPolicy {
  version: string;
  deltasBps: readonly number[];
}

export const DEFAULT_SENSITIVITY_POLICY: DefaultSensitivityPolicy = {
  version: "E69-phase6-provisional-v1",
  deltasBps: [-50, -25, 0, 25, 50],
};

export type E69ScenarioGapReasonCode = "INVALID_DELTA" | "NO_BENCHMARK_DATA_GAP" | "NO_DELTAS_REQUESTED";

/** Scenarios could not be produced for a structural reason (not an evidence gap — see the "data_gap" variant below for that). */
export interface E69ScenarioError {
  scenarioStatus: "error";
  reasonCode: E69ScenarioGapReasonCode;
  explanation: string;
}

/** The underlying E69 benchmark was itself a DATA_GAP. Scenarios are never mechanically generated from nothing — the original gap and audit trail are preserved verbatim. */
export interface E69ScenarioDataGap {
  scenarioStatus: "data_gap";
  underlyingGap: E69PipelineDataGapResult;
  requestedGeography: CREGeography;
  explanation: string;
}

export interface E69ScenarioSetSuccess {
  scenarioStatus: "success";
  origin: E69BenchmarkOrigin | "n/a";
  /** true when the reference value came from an E68 user override rather than the raw Phase 3 benchmark. */
  isOverrideBased: boolean;
  requestedGeography: CREGeography;
  referenceValue: number;
  /** Always includes exactly one deltaBps===0 scenario (scenarioType "benchmark"), reflecting the actual benchmark/override value, plus one entry per requested (deduped, sorted) delta. */
  scenarios: E69Scenario[];
  evidenceRange: E69EvidenceSupportedRange;
}

/**
 * A pure hypothetical scenario set with NO E69 benchmark behind it at all —
 * see docs/E69-phase6-scenario-sensitivity.md "Hypothetical scenarios without
 * a benchmark" for why this exists only in this minimal, unmistakably-labeled
 * form.
 */
export interface E69HypotheticalScenarioSet {
  scenarioStatus: "hypothetical";
  /** Always true; present so a consumer can discriminate this variant without a type-narrow on scenarioStatus alone. */
  isHypothetical: true;
  callerSuppliedBaseValue: number;
  scenarios: E69Scenario[];
  evidenceRange: E69EvidenceSupportedRange;
  /** Mandatory — refuses to run without an explicit caller acknowledgment that this is not derived from any market evidence. */
  disclaimer: string;
}

export type E69ScenarioResult = E69ScenarioSetSuccess | E69ScenarioDataGap | E69ScenarioError;

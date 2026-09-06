/**
 * InvestScape™ Market Intelligence & Statistical Risk Engine
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * InvestScape™ is a registered trademark of Lighthouse Research Ltd.
 * This software is proprietary and confidential.
 *
 * LICENSING:
 * - Personal/Educational Use: Permitted (see LICENSE)
 * - Commercial Use: Requires written Commercial License Agreement
 * Contact: wahjai604@gmail.com
 *
 * DISCLAIMER:
 * This software is provided "as-is" for informational purposes only.
 * Not investment advice, tax advice, or financial advice.
 * Use at your own risk.
 */

/**
 * MIOpportunityMetric<T> — the integration-seam envelope for Market
 * Intelligence's discovery/ranking output, per investscape-docs Doc 62
 * §3.3's "net recommendation." This is a synthesis against real field names
 * and types already in this codebase, not a copy-paste of the conceptual
 * AnalysisMetric<T> envelope named in the original prompt — see Doc 62
 * Part 2 for the field-by-field reasoning behind every choice below.
 *
 * This type is scoped to Market Intelligence's own output only. It is not
 * retrofitted onto any existing calc-engine/economic-engine/tax-engine
 * response shape.
 */

import type { ConfidenceLabel, ProvenanceEntry } from "@investscape/calc-engine";
import type { NeighborhoodInvestmentScoreOutput } from "@investscape/economic-engine";
import type { GeographyRef } from "../market-intelligence/domain";

/**
 * MIConfidence — thin alias, not a new vocabulary. Doc 62 §2.11/§3.2:
 * calc-engine's ConfidenceLabel is the richer, already-exported, 4-level
 * vocabulary; economic-engine's separate 3-level string is deliberately not
 * used here so MI doesn't introduce a third confidence vocabulary.
 */
export type MIConfidence = ConfidenceLabel;

/**
 * MIGeography — thin alias of economic-engine's real regionId/cityId/
 * neighborhoodId + {lat,lng} shape. `GeographyRef` (market-intelligence/
 * domain.ts) already IS that shape's wrapper/superset — built specifically
 * so an MI result can be joined back to the exact economic-engine query
 * that produced it (see domain.ts's own doc comment and geography.ts's
 * wrap/unwrap functions) — so this reuses it rather than hand-copying the
 * id/coordinates fields again.
 */
export type MIGeography = GeographyRef;

/**
 * MIEngineId — typed against the `E{number}` convention used throughout
 * this codebase's code, comments, README, and docs (E29, E42, E54, ...).
 * No existing exported TypeScript type embodies this convention as a
 * template-literal type anywhere in calc-engine or economic-engine (it is
 * informal today — checked via direct grep of both repos) — so this is
 * defined here rather than aliased, since there is nothing real to alias.
 */
export type MIEngineId = `E${number}`;

/**
 * MIStatus — decision #1: alias E42's existing grade scale directly rather
 * than hand-redefining the literal union. `neighborhoodInvestmentScore`
 * (economic-engine, E42) already produces `grade: 'A'|'B'|'C'|'D'|'F'` on
 * its `NeighborhoodInvestmentScoreOutput`; that type was not previously
 * exported from economic-engine's package root; it now is (additive-only
 * export, see economic-engine's src/index.ts). Indexed-access keeps this
 * an alias of the real field rather than a copy of the literal union.
 */
export type MIStatus = NeighborhoodInvestmentScoreOutput["grade"];

/**
 * MIBenchmark — decision #2: peer-cohort comparison shape. `benchmarkType`
 * is the discriminant, currently a union of one member ('peer_cohort') so a
 * future variant (e.g. 'trailing_average') can be added without breaking
 * existing callers. Does not hardcode any specific cohort — the caller
 * supplies cohortLabel/cohortSize/cohortMedian/percentileRank.
 */
export interface MIPeerCohortBenchmark {
  benchmarkType: "peer_cohort";
  cohortMedian: number;
  /** 0-1 fraction, matching this package's own percentileRank() (statistical-risk/descriptive.ts) — not a 0-100 scale. */
  percentileRank: number;
  cohortSize: number;
  cohortLabel: string;
}

export type MIBenchmark = MIPeerCohortBenchmark;

/**
 * MIVisualizationHints — deliberately minimal per Doc 62 §3.2/§3.3: the
 * real shape is deferred until an actual consuming UI exists (E27's
 * chart-data precedent is calc-engine-specific and not a generic
 * rendering-hints shape). Extensible placeholder only.
 */
export interface MIVisualizationHints {
  [key: string]: unknown;
}

/** period — reuses the `asOfDate: Date` naming convention used throughout economic-engine's Region/City/NeighborhoodMetrics types. */
export interface MIPeriod {
  asOfDate: Date;
}

export interface MIOpportunityMetric<T> {
  id: string;
  engineId: MIEngineId;
  domain: "region" | "city" | "neighborhood";
  label: string;
  value: T;
  unit: string;
  status: MIStatus;
  interpretation: string;
  benchmark: MIBenchmark;
  confidence: MIConfidence;
  geography: MIGeography;
  period: MIPeriod;
  provenance: ProvenanceEntry[];
  /**
   * "warnings" chosen as the one vocabulary for MI's combined assumptions/
   * caveats concept, modeled on E42's `missingInputs: string[]` and
   * calc-engine's `recommendedActions: string[]` — reusing that plain
   * string[] shape rather than shipping a fourth near-synonym alongside
   * missingInputs/recommendedActions/assumptions.
   */
  warnings: string[];
  methodologyRef: string;
  /**
   * Unpopulated for now — blocked on Doc 62 §2.10's health/capabilities
   * endpoint, which does not exist yet. There is nothing at the API layer
   * to source a real per-response engine version from until that lands.
   */
  engineVersion?: string;
  visualizationHints: MIVisualizationHints;
}

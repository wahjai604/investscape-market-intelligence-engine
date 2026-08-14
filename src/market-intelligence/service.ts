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
 * Small integration example tying adapters + data-quality + benchmarking
 * together — demonstrates the intended call shape for a future
 * investscape-api route handler (Modular Prompt 02), without this package
 * itself depending on Express or any API convention.
 */

import type { NeighborhoodMetricsInput } from "@investscape/economic-engine";
import { fetchNeighborhoodObservations } from "./economic-engine-adapters";
import { assessDataQuality, DataQualityAssessment } from "./data-quality";
import { benchmarkSubject, BenchmarkComparison } from "./benchmarking";
import { MarketObservation } from "./domain";

export interface NeighborhoodSnapshot {
  observations: MarketObservation[];
  dataQuality: DataQualityAssessment;
}

/** Fetches one neighborhood's data through economic-engine and assesses its data quality — the smallest useful end-to-end call. */
export function buildNeighborhoodSnapshot(input: NeighborhoodMetricsInput, now?: Date): NeighborhoodSnapshot {
  const { observations, dataQualityInputs } = fetchNeighborhoodObservations(input, now);
  return { observations, dataQuality: assessDataQuality(dataQualityInputs) };
}

/**
 * Benchmarks one neighborhood's value for `metricId` against a set of peer
 * neighborhoods for the same metric — fetches all of them through
 * economic-engine, then runs the comparability-gated benchmark. Returns
 * `null` (not a throw) if the subject itself doesn't have that metric,
 * since that's a normal "nothing to benchmark" case, not an error.
 */
export function benchmarkNeighborhoodMetric(
  subjectInput: NeighborhoodMetricsInput,
  peerInputs: NeighborhoodMetricsInput[],
  metricId: string,
  now?: Date,
): BenchmarkComparison | null {
  const subjectSnapshot = fetchNeighborhoodObservations(subjectInput, now);
  const subjectObservation = subjectSnapshot.observations.find((o) => o.metricId === metricId);
  if (!subjectObservation) return null;

  const peerObservations = peerInputs.flatMap(
    (peerInput) => fetchNeighborhoodObservations(peerInput, now).observations.filter((o) => o.metricId === metricId),
  );

  return benchmarkSubject(subjectObservation, peerObservations);
}

/**
 * InvestScape™ E88 Phase 6 — RLB Source Adapter.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Wraps E88's EXISTING RLB observations (E86 Phase 4's original 53 +
 * Phase 3's 112 backfilled hard-cost observations, plus Phase 4's city/
 * national index observations) into the Phase 6 adapter contract. This
 * file does NOT duplicate, re-derive, or re-fetch a single figure — every
 * envelope carries the exact same `CRECitedObservation` object already
 * exported by `data/index.ts` / `data/index-series.ts`. It performs no
 * normalization, comparability scoring, escalation, or aggregation.
 */
import { E88_KNOWN_CONSTRUCTION_COST_OBSERVATIONS } from "../data";
import { CC_KNOWN_INDEX_OBSERVATIONS } from "../data/index-series";
import { RLB_SOURCE_DEFINITION } from "../source-registry-e88";
import { gatedObservations, type E88SourceAdapter, type E88SourceObservationEnvelope } from "../source-adapter-types";

function rlbCostEnvelopes(): E88SourceObservationEnvelope[] {
  return E88_KNOWN_CONSTRUCTION_COST_OBSERVATIONS.filter((o) => o.source.sourceId === "rlb-north-america" && (o.metric === "hard_cost" || o.metric === "soft_cost")).map((observation) => ({
    sourceId: "rlb-north-america",
    observation,
    adapterNote: "Existing E86 Phase 4 / E88 Phase 3 RLB hard-cost observation, unchanged — wrapped, not re-derived.",
  }));
}

function rlbIndexEnvelopes(): E88SourceObservationEnvelope[] {
  return CC_KNOWN_INDEX_OBSERVATIONS.filter((io) => io.series.sourceId === "rlb-north-america").map((io) => ({
    sourceId: "rlb-north-america",
    observation: io.observation,
    adapterNote: `Existing Phase 4 RLB index observation (series "${io.series.seriesId}"), unchanged — wrapped, not re-derived.`,
  }));
}

export const RLB_ADAPTER: E88SourceAdapter = {
  definition: RLB_SOURCE_DEFINITION,
  listObservations: () => gatedObservations(RLB_SOURCE_DEFINITION, () => [...rlbCostEnvelopes(), ...rlbIndexEnvelopes()]),
};

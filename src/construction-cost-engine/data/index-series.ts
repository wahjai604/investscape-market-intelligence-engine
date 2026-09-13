/**
 * InvestScape™ E88 Phase 4 — Index series data layer.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Read-only wrapper around E86's EXISTING construction_index observations
 * (`src/cre-intelligence/data/construction-costs-us.ts`) plus E88's own
 * Phase 3 source-research register (source-research.ts). No new index VALUE
 * is invented anywhere in this file — every `CCIndexObservation` below
 * carries an actual E86-cited observation verbatim.
 *
 * Per Phase 4 Implementation Safety steps 4/5: this file is the definitive
 * confirmation of what index evidence actually exists in this codebase today.
 *   - RLB city-level "Comparative Cost Index": 4 cities (Austin, Miami,
 *     Seattle, Phoenix) x 2 periods (April 2025, April 2026) = 8 observations.
 *   - RLB National Construction Cost Index: 13 quarterly observations,
 *     Q2 2023 - Q2 2026, no city dimension.
 *   - Statistics Canada BCPI: REGISTERED (source-research.ts) as a real,
 *     free, redistributable index — but ZERO observations have been ingested
 *     anywhere in E86 or E88 as of Phase 3. It is listed below with an EMPTY
 *     observation array so applicability/escalation code can recognize the
 *     series exists without being able to fabricate a value for it. Ingesting
 *     actual BCPI figures is out of Phase 4 scope (would be new data
 *     acquisition, not escalation-logic implementation) and is called out as
 *     a known limitation in docs/E88-phase4-escalation-and-index.md.
 *
 * No U.S. city outside these 4 has a city-level index; no Canadian city has
 * any RLB-cited index observation at all (RLB's Comparative Cost Index table
 * was only backfilled for the original 4 US cities — Phase 3 doc Section
 * 2.3). Nothing here treats an unlisted city as if it had a city-level index.
 */
import {
  US_CITY_CONSTRUCTION_INDEX_OBSERVATIONS,
  US_NATIONAL_CONSTRUCTION_INDEX_OBSERVATIONS,
} from "../../cre-intelligence/data/construction-costs-us";
import type { CCIndexObservation, CCIndexSeries } from "../index-types";

export const RLB_CITY_INDEX_SERIES: CCIndexSeries = {
  seriesId: "rlb-city-comparative-cost-index",
  seriesName: 'RLB "Comparative Cost Index" (city level)',
  sourceId: "rlb-north-america",
  geographyType: "city",
  periodGranularity: "annual",
  applicableCurrency: "USD",
  sourceStatus: "USE",
  statusNote:
    "Already in active use as of E86 Phase 4 / E88 Phase 1-3. Covers exactly 4 US cities (Austin, Miami, Seattle, Phoenix), 2 periods each (April 2025, April 2026).",
};

export const RLB_NATIONAL_INDEX_SERIES: CCIndexSeries = {
  seriesId: "rlb-national-construction-cost-index",
  seriesName: "RLB National Construction Cost Index",
  sourceId: "rlb-north-america",
  geographyType: "national",
  periodGranularity: "quarterly",
  applicableCurrency: "USD",
  sourceStatus: "USE",
  statusNote:
    "Already in active use. Quarterly, Q2 2023 - Q2 2026, national (US), no city dimension. RLB publishes this specifically as a cross-market US escalation index, not a city-specific figure — see applicability.ts for how this is used as an INDIRECT relationship only, never DIRECT for a specific city.",
};

/**
 * REGISTERED, not USE (source-research.ts: statcan-bcpi decision "REGISTER").
 * Zero observations exist anywhere in this codebase. Included here, with an
 * empty observation list, purely so applicability/escalation code has an
 * explicit series object to reason about ("this source is known and
 * acknowledged, but has no evidence") rather than silently having no
 * representation at all.
 */
export const STATCAN_BCPI_INDEX_SERIES: CCIndexSeries = {
  seriesId: "statcan-bcpi",
  seriesName: "Statistics Canada — Building Construction Price Indexes (BCPI), Table 18-10-0289-01",
  sourceId: "statcan-bcpi",
  geographyType: "cma",
  periodGranularity: "quarterly",
  applicableCurrency: "CAD",
  sourceStatus: "REGISTER",
  statusNote:
    "Confirmed real, free, and redistributable (Phase 3 source-research.ts) but NOT ingested — zero observations exist in E86 or E88. Any escalation request routed to this series returns DATA_GAP (INSUFFICIENT_INDEX_EVIDENCE / SOURCE_NOT_VERIFIED), never a fabricated value.",
};

export const CC_KNOWN_INDEX_SERIES: readonly CCIndexSeries[] = [
  RLB_CITY_INDEX_SERIES,
  RLB_NATIONAL_INDEX_SERIES,
  STATCAN_BCPI_INDEX_SERIES,
];

export const RLB_CITY_INDEX_OBSERVATIONS: readonly CCIndexObservation[] = US_CITY_CONSTRUCTION_INDEX_OBSERVATIONS.map(
  (observation) => ({ series: RLB_CITY_INDEX_SERIES, observation }),
);

export const RLB_NATIONAL_INDEX_OBSERVATIONS: readonly CCIndexObservation[] = US_NATIONAL_CONSTRUCTION_INDEX_OBSERVATIONS.map(
  (observation) => ({ series: RLB_NATIONAL_INDEX_SERIES, observation }),
);

/** Always empty — see STATCAN_BCPI_INDEX_SERIES's statusNote above. */
export const STATCAN_BCPI_INDEX_OBSERVATIONS: readonly CCIndexObservation[] = [];

/** Every index observation E88 can actually see, across every known series. */
export const CC_KNOWN_INDEX_OBSERVATIONS: readonly CCIndexObservation[] = [
  ...RLB_CITY_INDEX_OBSERVATIONS,
  ...RLB_NATIONAL_INDEX_OBSERVATIONS,
  ...STATCAN_BCPI_INDEX_OBSERVATIONS,
];

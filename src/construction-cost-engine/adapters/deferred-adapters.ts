/**
 * InvestScape™ E70 Phase 6 — Deferred/Registered Source Adapters.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Adapter definitions for every currently non-ingested source (Turner &
 * Townsend, RSMeans/Gordian, Altus Group, Statistics Canada BCPI, CMHC).
 * Every one of these `listObservations()` calls is gated by the SAME
 * `gatedObservations` helper the RLB adapter uses — none of them special-
 * cases its way around the "not ingested / not ready" rule. Their supplier
 * functions are never actually invoked in practice (since `ingested` is
 * false for all of them), and are written to return `[]` explicitly anyway
 * so a future flip of `ingested: true` does not silently start fabricating
 * data — a real ingestion implementation would have to REPLACE the
 * supplier, not merely toggle the flag.
 */
import {
  ALTUS_SOURCE_DEFINITION,
  CMHC_SOURCE_DEFINITION,
  RSMEANS_SOURCE_DEFINITION,
  STATCAN_BCPI_SOURCE_DEFINITION,
  TURNER_TOWNSEND_SOURCE_DEFINITION,
} from "../source-registry-e70";
import { gatedObservations, type E70SourceAdapter } from "../source-adapter-types";

export const TURNER_TOWNSEND_ADAPTER: E70SourceAdapter = {
  definition: TURNER_TOWNSEND_SOURCE_DEFINITION,
  listObservations: () => gatedObservations(TURNER_TOWNSEND_SOURCE_DEFINITION, () => []),
};

export const RSMEANS_ADAPTER: E70SourceAdapter = {
  definition: RSMEANS_SOURCE_DEFINITION,
  listObservations: () => gatedObservations(RSMEANS_SOURCE_DEFINITION, () => []),
};

export const ALTUS_ADAPTER: E70SourceAdapter = {
  definition: ALTUS_SOURCE_DEFINITION,
  listObservations: () => gatedObservations(ALTUS_SOURCE_DEFINITION, () => []),
};

/** Index-only, per its definition's metricScope — never a cost-observation adapter. */
export const STATCAN_BCPI_ADAPTER: E70SourceAdapter = {
  definition: STATCAN_BCPI_SOURCE_DEFINITION,
  listObservations: () => gatedObservations(STATCAN_BCPI_SOURCE_DEFINITION, () => []),
};

export const CMHC_ADAPTER: E70SourceAdapter = {
  definition: CMHC_SOURCE_DEFINITION,
  listObservations: () => gatedObservations(CMHC_SOURCE_DEFINITION, () => []),
};

export const E70_DEFERRED_ADAPTERS: readonly E70SourceAdapter[] = [
  TURNER_TOWNSEND_ADAPTER,
  RSMEANS_ADAPTER,
  ALTUS_ADAPTER,
  STATCAN_BCPI_ADAPTER,
  CMHC_ADAPTER,
];

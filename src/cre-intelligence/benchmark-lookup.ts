/**
 * InvestScape™ E86 — public registry-backed cap-rate lookup.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Thin country-dispatch wrapper: picks the internal observation pool by
 * `identity.country` and delegates entirely to the existing
 * `selectCapRateBenchmark` for matching/ranking/qualification/gap behavior.
 * The observation arrays themselves are never exported past this module.
 */
import { selectCapRateBenchmark } from "./benchmark-selection";
import { US_CAP_RATE_OBSERVATIONS } from "./data/cap-rates-us";
import { CA_CAP_RATE_OBSERVATIONS } from "./data/cap-rates-ca";
import type { BenchmarkIdentity, CREBenchmarkResponse } from "./benchmark-types";

export function getCapRateBenchmark(identity: BenchmarkIdentity, asOf?: Date): CREBenchmarkResponse {
  const pool = identity.country === "US" ? US_CAP_RATE_OBSERVATIONS : CA_CAP_RATE_OBSERVATIONS;
  return selectCapRateBenchmark(identity, pool, asOf);
}

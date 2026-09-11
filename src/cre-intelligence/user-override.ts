/**
 * InvestScape™ E68 Phase 5 — user override (Part 11).
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * A sophisticated user may know their local market better than any published
 * survey. `createUserOverride` records that opinion alongside the E68
 * benchmark it replaces — it never touches the underlying observation, and
 * `resolveBenchmark` always keeps both values retrievable.
 */
import type { CREBenchmarkResponse, ResolvedBenchmark, UserOverride } from "./benchmark-types";

export function createUserOverride(params: {
  overrideValue: number;
  overrideReason: string;
  originalE68Value?: number;
  originalE68Identity?: UserOverride["originalE68Identity"];
  now?: Date;
}): UserOverride {
  return {
    source: "USER",
    overrideValue: params.overrideValue,
    overrideReason: params.overrideReason,
    overrideTimestamp: (params.now ?? new Date()).toISOString(),
    originalE68Value: params.originalE68Value,
    originalE68Identity: params.originalE68Identity,
  };
}

/**
 * Decide which value an application should actually use. An override always
 * wins when present — that is the point of an override — but the E68
 * response (if any) is retained on the result so a UI can still show
 * "E68 benchmark was X" next to "using your override of Y".
 *
 * This function performs no mutation of `e68` and returns no shared
 * reference back into E68's data layer.
 */
export function resolveBenchmark(e68: CREBenchmarkResponse | undefined, override: UserOverride | undefined): ResolvedBenchmark {
  if (override) {
    return { active: "override", e68, override };
  }
  if (e68 && e68.status !== "DATA_GAP") {
    return { active: "e68", e68 };
  }
  return {
    active: "application_default",
    e68,
    applicationDefaultReason: "No E68 benchmark available and no user override supplied.",
  };
}

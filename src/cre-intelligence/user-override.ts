/**
 * InvestScape™ E86 Phase 5 — user override (Part 11).
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * A sophisticated user may know their local market better than any published
 * survey. `createUserOverride` records that opinion alongside the E86
 * benchmark it replaces — it never touches the underlying observation, and
 * `resolveBenchmark` always keeps both values retrievable.
 */
import type { CREBenchmarkResponse, ResolvedBenchmark, UserOverride } from "./benchmark-types";

export function createUserOverride(params: {
  overrideValue: number;
  overrideReason: string;
  originalE86Value?: number;
  originalE86Identity?: UserOverride["originalE86Identity"];
  now?: Date;
}): UserOverride {
  return {
    source: "USER",
    overrideValue: params.overrideValue,
    overrideReason: params.overrideReason,
    overrideTimestamp: (params.now ?? new Date()).toISOString(),
    originalE86Value: params.originalE86Value,
    originalE86Identity: params.originalE86Identity,
  };
}

/**
 * Decide which value an application should actually use. An override always
 * wins when present — that is the point of an override — but the E86
 * response (if any) is retained on the result so a UI can still show
 * "E86 benchmark was X" next to "using your override of Y".
 *
 * This function performs no mutation of `e86` and returns no shared
 * reference back into E86's data layer.
 */
export function resolveBenchmark(e86: CREBenchmarkResponse | undefined, override: UserOverride | undefined): ResolvedBenchmark {
  if (override) {
    return { active: "override", e86, override };
  }
  if (e86 && e86.status !== "DATA_GAP") {
    return { active: "e86", e86 };
  }
  return {
    active: "application_default",
    e86,
    applicationDefaultReason: "No E86 benchmark available and no user override supplied.",
  };
}

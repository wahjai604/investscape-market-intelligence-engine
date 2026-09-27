/**
 * InvestScape™ E85 — the Phase 4 evaluation timestamp.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Every `checkedAt`/`flaggedAt`/`resolvedAt` a Phase 4 evaluator stamps comes
 * from here. `evaluateZoningAndLandUse` fixes it for the duration of one
 * synchronous evaluation to `request.resolvedAt` when supplied (so the
 * orchestrated and public paths are byte-reproducible), else to one clock
 * read shared by the whole evaluation. Outside an evaluation it falls back to
 * the clock, exactly as before.
 */
let fixedTimestamp: string | undefined;

export function e85EvaluationTimestamp(): string {
  return fixedTimestamp ?? new Date().toISOString();
}

/** Runs `fn` with every evaluation timestamp fixed to `timestamp`. Synchronous only; restores the previous value on exit. */
export function withE85EvaluationTimestamp<T>(timestamp: string, fn: () => T): T {
  const previous = fixedTimestamp;
  fixedTimestamp = timestamp;
  try {
    return fn();
  } finally {
    fixedTimestamp = previous;
  }
}

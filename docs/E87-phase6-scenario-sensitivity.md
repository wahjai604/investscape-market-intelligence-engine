# E87 Phase 6 — Scenario / Sensitivity Framework

© 2026 Lighthouse Research Ltd. All rights reserved.

## 1. Objective

Answer exactly one question: *"what cap-rate scenarios can legitimately be
evaluated around this benchmark?"* Phase 6 is not a property valuation
engine, not an NOI forecast, not a DCF/IRR/feasibility engine, and not an
investment-recommendation engine. It consumes Phase 5's `E87PipelineResult`
verbatim and produces cap-rate scenario values only.

## 2. Files

- `src/cap-rate-engine/scenario-types.ts` — types.
- `src/cap-rate-engine/scenario-sensitivity.ts` — `generateScenarios`,
  `generateScenariosWithDefaultPolicy`, `generateHypotheticalScenarios`.
- `__tests__/cap-rate-engine/scenario-sensitivity.test.ts` — 24 tests.

Phase 6 does not re-implement comparability, consensus, transaction
derivation, or override resolution — it is a pure function of a Phase 5
`E87PipelineResult`.

## 3. Core distinction

Five things are always kept visually and structurally distinct:

1. Observed/published cap rates (Phase 3 `contributingObservations`).
2. Transaction-derived cap rates (Phase 4, surfaced through Phase 5's
   `origin: "transaction_derived"`).
3. The consensus benchmark itself (Phase 3 `benchmark.value`).
4. An evidence-supported range, if one actually exists (`E87EvidenceSupportedRange`).
5. Mechanically generated sensitivity scenarios (`E87Scenario` with
   `provenance: "mechanically_generated"`).

A mechanically generated scenario can never carry `provenance: "observed"`,
`"derived"`, or `"user_override"` — those three values are reserved for the
anchor scenario, which always reflects the actual benchmark/override value,
never an arithmetic sensitivity step.

## 4. Scenario model (`E87Scenario`)

Fields: `scenarioType` (`benchmark | downside | base | upside | custom`,
neutral labels only), `capRateValue`, `deltaBps` (signed integer, 0 for the
anchor), `referenceValue` (what the delta is relative to), `provenance`
(`observed | derived | user_override | mechanically_generated`), `basis`
(`benchmark | user_override | hypothetical`), `confidence` (only ever
populated for `observed`/`derived`/`user_override`, never fabricated for
`mechanically_generated`), and `auditExplanation` (deterministic, human
presentable).

`scenarioType` classification: `deltaBps === 0` and no caller label ->
`"benchmark"`; caller supplies a `label` for a delta -> `"custom"`;
otherwise negative -> `"downside"`, positive -> `"upside"`. `"base"` is
available to a caller as a custom label for a mechanically generated
delta they want to call their central case — Phase 6 does not itself decide
which delta is "the" base case; that judgment belongs to the caller/consumer.

## 5. Evidence-supported ranges — `computeEvidenceRange`

Never manufactured via +/-N bps. Only two bases are recognized, both
grounded in Phase 3's real `contributingObservations`:

- **`publisher_explicit_range`**: exactly one contributing observation, and
  that observation itself carries `low`/`high` (per E86's `CREObservation`
  contract — a range observation sets `low`/`high` and leaves `value`
  undefined). The published range is used verbatim.
- **`multi_observation_empirical_range`**: two or more contributing
  observations each expose a resolvable scalar (`value`, or the midpoint of
  their own `low`/`high` if they are themselves a range observation); the
  range is exactly `[min, max]` of those real values. No smoothing, no
  widening.

Anything else (a single point-value observation, or zero contributors)
returns `{ available: false, reason: "SINGLE_POINT_OBSERVATION", ... }` — a
structured, typed "no defensible range" result, never a fabricated one.
DATA_GAP and hypothetical inputs get their own distinct reason codes
(`NOT_APPLICABLE_DATA_GAP` is reserved on the type though the current
implementation short-circuits DATA_GAP before computing a range at all —
see §7 — and `NOT_APPLICABLE_HYPOTHETICAL` is used by
`generateHypotheticalScenarios`).

## 6. Mechanical sensitivity scenarios

`generateScenarios(pipelineResult, deltas)` where `deltas` is
`readonly (number | { bps: number; label?: string })[]`.

- Deltas are validated (must be finite integers within a sane range;
  non-integers are a typed `INVALID_DELTA` error, never silently rounded).
- Deduped by `bps` value (a duplicate delta collapses to one scenario;
  `deltaBps === 0` is always dropped from the requested set because the
  anchor scenario already represents it — a mechanically generated "+0bps"
  entry would be an exact-value duplicate with a misleading provenance).
- Sorted ascending before processing, so **input order never affects
  output** (`generateScenarios(r, [50,-50,25])` deep-equals
  `generateScenarios(r, [-50,25,50])`).
- Computed in an integer domain: the reference value is scaled to hundredths
  of a basis point (`value * 10_000`), the requested whole-bps delta is
  scaled the same way (`bps * 100`) and added, then divided back down once
  at the end (`fromScaled`). This avoids repeated floating-point addition
  error and preserves the benchmark's exact original precision — no
  premature rounding at any intermediate step.
- Every non-anchor scenario is `provenance: "mechanically_generated"` and
  omits `confidence` entirely (never inherits the benchmark's confidence
  tier).

### No hard-coded scenario bands

Phase 6 does not decide that ±25bps = normal, ±50bps = reasonable, ±100bps
= stress, or any other universal rule. The caller supplies deltas
explicitly. A convenience default (`DEFAULT_SENSITIVITY_POLICY`, currently
`{version: "E87-phase6-provisional-v1", deltasBps: [-50,-25,0,25,50]}`) is
provided **only** for a caller who wants a starting point — it is explicitly
versioned, explicitly PROVISIONAL, and is never applied automatically:
`generateScenarios` never reads it, and `generateScenariosWithDefaultPolicy`
requires the caller to opt in by passing it themselves. It must never be
presented to an end user as market evidence.

## 7. DATA_GAP behavior

If the Phase 5 pipeline result is `pipelineStatus: "data_gap"`,
`generateScenarios` returns `{ scenarioStatus: "data_gap", underlyingGap,
requestedGeography, explanation }` — the original Phase 3 `E87BenchmarkGap`
(reason code, explanation, provenance references) is preserved verbatim on
`underlyingGap`. No scenarios are mechanically generated from nothing.

## 8. Hypothetical scenarios without a benchmark — decision

**Decision: build it, but only in the most minimal, unmistakably-labeled
form, as a clearly separate function (`generateHypotheticalScenarios`) that
never touches or is reachable from `generateScenarios`.**

Reasoning:

- The spec's own preferred boundary is conservative ("lean toward NOT
  building it"). A pure "apply deltas to a made-up number" capability has
  real potential for misuse if it could be confused with a market-derived
  scenario.
- However, entirely omitting it would push a legitimate, narrow use case
  (a caller who explicitly wants deterministic delta arithmetic on their own
  already-labeled assumption, e.g. an internal placeholder figure) onto a
  downstream engine that would likely just reimplement the same integer-bps
  arithmetic anyway — with less rigor around labeling than Phase 6 can
  guarantee here.
- The compromise implemented: `generateHypotheticalScenarios` (a) requires a
  literal `true` third argument (`acknowledgeHypothetical`) as a
  type-level speed bump against silent misuse, (b) returns a distinct
  result type (`E87HypotheticalScenarioSet`) with `isHypothetical: true` and
  a mandatory `disclaimer` string, (c) always sets `basis: "hypothetical"`
  and `provenance: "mechanically_generated"` on every value including the
  "anchor" (there is no anchor in the observed/derived sense — the caller's
  base number was never observed), and (d) always reports
  `evidenceRange: { available: false, reason: "NOT_APPLICABLE_HYPOTHETICAL" }`
  since no observations exist to support a range.
- It is entirely disconnected from `generateScenarios`/Phase 5 — there is no
  code path by which a `pipelineResult` flows into a hypothetical scenario
  or vice versa, so a caller cannot accidentally blend the two.

If a future engine needs full underwriting-style scenario modeling (NOI
assumptions, exit multiples, IRR sensitivity, etc.), that belongs in a
downstream engine, not here — E87 stops at "a hypothetical delta on a number
the caller already supplied and already knows is not market data."

## 9. User overrides

When the Phase 5 result is `pipelineStatus: "user_overridden"`:

- The anchor scenario uses `override.overrideValue` as `referenceValue` and
  `capRateValue`, with `provenance: "user_override"` (never `"observed"` or
  `"derived"`) and `basis: "user_override"`. Its `auditExplanation` names the
  override reason verbatim.
- `E87ScenarioSetSuccess.isOverrideBased` is `true`, so a consumer can
  branch on this without inspecting `provenance` string values.
- The underlying benchmark or DATA_GAP (`pipelineResult.underlying`) is
  never mutated and is used, when it was itself a success, to compute
  `evidenceRange` from the real contributing observations — the override
  does not erase the underlying evidence picture, it only changes which
  value scenarios are computed relative to.
- Sensitivity scenarios built on an override are `provenance:
  "mechanically_generated"`, `basis: "user_override"` — clearly distinguished
  from both the raw override value and from a benchmark-based sensitivity
  scenario.

## 10. Determinism

- Same `pipelineResult` + same `deltas` (any order, with duplicates) ->
  identical `E87ScenarioResult` (`toEqual`-verified in tests 6, 7, 16, 17).
- No wall-clock, randomness, or object identity is read anywhere in
  `scenario-sensitivity.ts`.
- Arithmetic is via `toScaled`/`fromScaled`/`bpsToScaled` integer-domain
  helpers (§6) rather than repeated floating-point addition.
- Nothing in `pipelineResult` (or any observation reachable from it) is
  mutated — verified by deep-equality snapshot tests before/after.

## 11. Phase 5 origin-classification review (required check)

Phase 5's documented limitation (`docs/E87-phase5-unified-benchmark-output.md`
§15) reads: `classifyOrigin` uses `contributingObservations.length === 1` ->
`publisher_survey`, after first checking for an all-`derived_transaction`
contributor set (-> `transaction_derived`); everything else -> `consensus`.
The Phase 5 doc itself concludes "no real ambiguity exists today" for this
heuristic given only three origin categories, and flags it only as something
"a future phase adding a fourth origin category would need to revisit."

**Outcome: left unchanged, `pipeline.ts` was not modified.** This is a
documented-but-inert limitation, not a live bug: with exactly three origin
categories and the transaction-derived case already checked first, the
`length === 1` branch is unambiguous (it can only mean "the benchmark is
exactly one non-transaction-derived publisher's number"). Phase 6 does not
add a fourth origin category, so no concrete failure mode was found that
Phase 6 could safely fix using existing structural information — actually
resolving it in general would require Phase 5 to carry an explicit
per-observation origin tag through Phase 2/3, which is an architectural
change to Phases 2/3/5 explicitly out of scope for Phase 6 per the governing
instructions. Phase 6 instead treats `E87BenchmarkOrigin` (`"publisher_survey"
| "transaction_derived" | "consensus"`) as an opaque, already-final label from
Phase 5 and maps it to scenario `provenance` (`transaction_derived` ->
`"derived"`; the other two -> `"observed"`) without attempting to
re-derive or second-guess it.

## 12. Phase 3/4 provisional policies

`DispersionPolicy` (`{tightBps:15, moderateBps:40, materialBps:75}`) and
Phase 4's reconciliation thresholds were not touched. Phase 6 revealed no
concrete, unavoidable dependency on either — scenario generation only reads
Phase 3's already-finalized `benchmark.value`, `confidence`, and
`contributingObservations`, never re-running dispersion logic itself.

## 13. Scope exclusions (confirmed not built)

No property valuation, NOI forecast, DCF, IRR, feasibility analysis,
investment recommendation, paid data access, paid-source adapter, live FX
ingestion, InvestScape frontend/API integration, E86 modification, or new
engine was created or touched by this phase.

## 14. Known limitations / unresolved design decisions

- `computeEvidenceRange`'s multi-observation midpoint fallback (for a
  contributing observation that is itself a range with no `value`) uses a
  simple arithmetic midpoint, consistent with E86's own `rangeMidpoint()`
  convention — it is not re-weighted by that observation's Phase 3 weight.
  A future phase could weight the empirical range's implied "typical" value
  by source hierarchy; the min/max range boundary itself is unaffected
  either way since it is a real observed extreme, not a computed statistic.
- `E87ScenarioGapReasonCode` includes `NO_BENCHMARK_DATA_GAP` and
  `NO_DELTAS_REQUESTED` for API completeness/future use; the current
  implementation reports a data-gap-underlying pipeline result via the
  dedicated `E87ScenarioDataGap` variant (not `E87ScenarioError`) and treats
  zero requested deltas as a valid request (anchor-only output), not an
  error — documented here rather than left silently inconsistent with the
  type.
- The origin-classification heuristic limitation from Phase 5 (§11) remains
  open exactly as Phase 5 documented it; Phase 6 works correctly around it
  without resolving it.

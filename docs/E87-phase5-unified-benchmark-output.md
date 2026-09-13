# E87 Phase 5 — Unified Cap-Rate Benchmark Output / End-to-End Integration

© 2026 Lighthouse Research Ltd. All rights reserved.

## 1. Purpose

Phase 5 is the orchestration layer that ties Phases 1-4 into one coherent,
application-ready pipeline and output contract. It is **not** integrated into
any InvestScape frontend/API — it is the final internal seam a future
integration layer will call.

Pipeline:

```
request -> candidate pool (+ transaction-derived merge)
  -> Phase 2 comparability (evaluateComparability)
  -> Phase 3 representation/consensus (buildCapRateBenchmark)
  -> origin classification (publisher/survey | transaction-derived | consensus)
  -> E86 user override resolution (createUserOverride / resolveBenchmark)
  -> one deterministic E87PipelineResult
```

## 2. Files

- `src/cap-rate-engine/pipeline-types.ts` — the unified output contract.
- `src/cap-rate-engine/pipeline.ts` — `resolveCapRateBenchmark`, the single orchestrating function.
- `__tests__/cap-rate-engine/pipeline.test.ts` — 27 end-to-end tests.
- `src/cap-rate-engine/index.ts` — additive barrel exports only (`export * from "./pipeline-types"`, `export * from "./pipeline"`).

No Phase 2/3/4 file's logic was changed. No E86 file was changed.

## 3. The unified output contract

`E87PipelineResult` (in `pipeline-types.ts`) is a discriminated union on
`pipelineStatus`:

- **`"success"`** (`E87PipelineSuccess`) — a benchmark was produced. Carries
  `origin` (`"publisher_survey" | "transaction_derived" | "consensus"`) and
  the **entire, unflattened** Phase 3 success result (`result`: benchmark
  value/unit/capRateType/method, `dataConfidence`, `benchmarkConfidence`,
  `confidence`, `contributingObservations`, `dispersion`, full `audit`).
- **`"user_overridden"`** (`E87PipelineUserOverridden`) — a user override is
  active. Carries `origin` (or `"n/a"` if the underlying result was a
  DATA_GAP), the **full underlying Phase 3 result** (`underlying`, success or
  data_gap, untouched), and an `override` layer (`overrideValue`,
  `overrideReason`, `overrideTimestamp`, `originalValue` when the underlying
  was a success, `originalStatus`).
- **`"data_gap"`** (`E87PipelineDataGap`) — no benchmark could be produced.
  Carries the **entire, unflattened** Phase 3 `E87BenchmarkGap` plus its
  audit (`result`).

Nothing is flattened: a consumer can always answer "what value did
InvestScape use, why, which observations contributed, which were excluded,
what transformations occurred, how fresh is the data, what confidence does it
have" by walking `result`/`underlying`.

There is deliberately **no separate "publisher_survey benchmark" /
"transaction-derived benchmark" / "consensus benchmark" TypeScript variant**
distinct from `E87PipelineSuccess`+`origin`. Phase 3's `E87Benchmark` shape
(value/unit/capRateType/method) and audit trail are already uniform across
all three origins — the only genuine difference between them is *where the
contributing evidence came from*, which `origin` plus
`result.contributingObservations`/`result.audit` already answers in full
without inventing three structurally different success shapes for what is
mechanically the same Phase 3 output.

## 4. `resolveCapRateBenchmark` — orchestration steps

1. Convert every `transactionDerivedObservations` entry via Phase 4's
   `toE87CandidateInput` (unmodified) and merge the results into
   `candidatePool` **before** comparability runs.
2. Run Phase 2's `evaluateComparability` (unmodified) on the merged pool.
3. Run Phase 3's `buildCapRateBenchmark` (unmodified) on the comparability
   result, using `request.benchmarkOptions` (e.g. a caller-supplied
   `DispersionPolicy`) verbatim.
4. Classify `origin` from the success result's `contributingObservations`:
   all `capRateType === "derived_transaction"` -> `"transaction_derived"`;
   exactly one contributor -> `"publisher_survey"`; otherwise ->
   `"consensus"`. This is a label only — it never changes the computed value.
5. If `request.userOverride` is absent: wrap the Phase 3 result directly in
   the `success`/`data_gap` envelope.
6. If `request.userOverride` is present: build a minimal
   `CREBenchmarkResponse` stub (see §6), call E86's real
   `createUserOverride`/`resolveBenchmark`, and wrap the result as
   `user_overridden`, preserving the full underlying result.

### Design choice: how transaction-derived observations enter the pipeline

The spec offered two options: merge transaction-derived candidates into
`candidatePool` before calling this function, or accept them as an explicit
separate pipeline input merged in internally. **This implementation chose the
second** (`transactionDerivedObservations` on `E87PipelineRequest`) because:

- It keeps `candidatePool` a pure `E87CandidateInput[]` (already-resolved E86
  observations), matching Phase 2's existing contract exactly.
- A caller with raw Phase 4 output never needs to learn or duplicate
  `toE87CandidateInput`'s conversion — the pipeline does it, using Phase 4's
  own function, not a re-implementation.
- Both paths still converge into the exact same `evaluateComparability` call
  before any comparability/consensus logic runs, so there is no parallel
  benchmark path.

## 5. E86 components reused

- `createUserOverride` (`src/cre-intelligence/user-override.ts`) — called
  with `overrideValue`, `overrideReason`, `originalE86Value` (the underlying
  Phase 3 benchmark's value when the underlying result was a success, else
  `undefined` — never fabricated), `originalE86Identity` (from the stub
  identity, §6), and the injectable `now`.
- `resolveBenchmark` (`src/cre-intelligence/user-override.ts`) — called with
  the stub `CREBenchmarkResponse` and the `UserOverride` from
  `createUserOverride`. Its `active` field is read (not reimplemented) to
  confirm "override always wins when present" — the one line of E86 logic
  this pipeline depends on rather than reimplementing itself.
- `UserOverride`, `CREBenchmarkResponse` types (`src/cre-intelligence/benchmark-types.ts`)
  — reused verbatim as the shapes those two functions require.
- Indirectly, everything Phase 2/3/4 already reuse from E86:
  `CRECitedObservation`, `CRECapRateType`, `CAP_RATE_FAMILY`, `CREGeography`,
  `CREPresentationFreshness`, `CREDerivedTransaction`, `rangeMidpoint`,
  `MappingConfidence`.

### §6 — Why a stub `CREBenchmarkResponse` is built, and why this doesn't modify E86

`resolveBenchmark`'s real signature is
`(e86: CREBenchmarkResponse | undefined, override: UserOverride | undefined) => ResolvedBenchmark`.
E87's Phase 3 result (`E87BenchmarkResult`) is a different, richer shape than
E86's `CREBenchmarkResponse` — E86's contract was frozen before E87 existed
and was never designed to carry E87's two-axis confidence model, dispersion,
or comparability dimensions. Rather than changing E86's `resolveBenchmark` to
accept E87's shape (forbidden — E86 is frozen v1.0), `pipeline.ts`'s private
`toE86BenchmarkResponseStub` builds the minimal `CREBenchmarkResponse` that
`resolveBenchmark` actually inspects (`status`, used only to distinguish
"available" from "DATA_GAP" — `resolveBenchmark`'s own gate for whether `e86`
would have been used absent an override) plus the identity fields
`createUserOverride`'s `originalE86Identity` wants to preserve for display.
This stub is **never returned to a caller** — it is a private adapter, not a
new public contract, and it neither reads from nor writes to any E86 file.

## 7. Phase 2/3/4 components reused

- `evaluateComparability` (Phase 2, `comparability.ts`).
- `buildCapRateBenchmark` (Phase 3, `benchmark-consensus.ts`).
- `toE87CandidateInput` (Phase 4, `transaction-derivation.ts`).
- Types: `E87CandidateInput`, `E87ComparabilityRequest` (Phase 2);
  `E87BenchmarkOptions`, `E87BenchmarkResult` (Phase 3);
  `CRETransactionDerivedObservation` (Phase 4).

None of these functions' internals were touched; none of their existing test
files were edited; all pre-existing Phase 2/3/4 tests pass unmodified.

## 8. Confidence model

Unchanged in meaning from Phase 3: `dataConfidence` and `benchmarkConfidence`
are read verbatim off the Phase 3 result and surfaced on
`E87PipelineSuccess.result`/`E87PipelineUserOverridden.underlying`. They are
combined only by Phase 3's existing floor rule (`floorConfidence`) — Phase 5
performs **no** additional confidence computation, and in particular never
averages the two axes or recombines them differently.

## 9. Freshness handling

Phase 5 introduces no second freshness-filtering mechanism. Freshness gating
happens exactly once, inside Phase 2's `evaluateCandidate`, and only when the
request sets `minFreshness` explicitly. A stale/historical observation is
never treated as invalid merely for being old — see test group 15/16 below.
Phase 3's audit already records each contributing candidate's derived
freshness tier; Phase 5 surfaces that audit unmodified.

## 10. User override integration

- `request.userOverride` is optional. When present, it **always wins**,
  mirroring E86's `resolveBenchmark` contract exactly (verified, not
  reimplemented — see §4 step 6 and §6).
- The override never mutates or discards the underlying benchmark/DATA_GAP:
  `E87PipelineUserOverridden.underlying` is the full, untouched Phase 3
  result (success or data_gap) that would have been returned had no override
  been supplied.
- `originalValue` is populated only when the underlying result was a success
  (never fabricated as a number when the underlying was a DATA_GAP).
- No new user-identity/authentication concept was introduced: the pipeline
  takes only the minimal shape `createUserOverride` already expects
  (`overrideValue`, `overrideReason`, optional `now`) — no user id is
  required by E86's existing contract, so none was invented here.

## 11. DATA_GAP requirements

Every DATA_GAP result (`E87PipelineDataGap`, or `E87PipelineUserOverridden`
wrapping a data_gap `underlying`) carries Phase 3's full
`E87BenchmarkGap`/`E87BenchmarkAudit`, which together already answer every
required question:

- **Why no benchmark can be produced** — `gap.reasonCode` (one of Phase 3's
  seven `E87BenchmarkGapReasonCode`s) plus `gap.explanation`.
- **Which candidates were considered** — `audit.observationsConsideredCount`,
  and the full per-candidate list is derivable from
  `audit.excludedByComparability` + `audit.excludedByPhase3` (every
  considered candidate lands in exactly one of these when none contributed).
- **Which were excluded, and why** — `audit.excludedByComparability` (Phase 2
  reason codes) and `audit.excludedByPhase3` (Phase 3 reasons: incompatible
  cap-rate-type group, unusable representation), each with a human-readable
  `note`.
- **Provenance references** — `gap.provenanceReferences` (source name + id
  strings traceable back to the original citation).
- **Freshness state** — preserved per-candidate on the audit entries that
  carry a `freshness` field, and reflected in `INSUFFICIENT_FRESHNESS` as an
  explicit reason code when every otherwise-comparable candidate failed a
  `minFreshness` gate.
- **Whether a user override exists** — `E87PipelineUserOverridden` is a
  structurally distinct `pipelineStatus`; a caller checking `pipelineStatus`
  always knows whether an override is layered on a given gap.
- **A structured, human-readable resolution hint, never a fabricated
  number** — `gap.explanation` is written to name the specific missing
  dimension or conflict (e.g. "No comparable candidate carries the exact
  requested capRateType...", "Comparable candidates span N distinct cap-rate
  concepts..."), consistent with Phase 3's existing narrative style; Phase 5
  adds no numeric estimate on top of this.

## 12. Provisional policy decision

Phase 3's `DispersionPolicy` (`tightBps: 15, moderateBps: 40, materialBps: 75`)
and Phase 4's `CREReconciliationPolicy`
(`negligibleBps: 10, notableBps: 30`) were both reviewed during this phase.
**No change was made to either.** There is no empirical cap-rate-survey
population available in this repository or task to calibrate against, and
guessing new thresholds "by intuition" would be strictly worse than keeping
the existing, already-documented PROVISIONAL values. This is a **deliberate
decision to not recalibrate without real data**, re-affirmed here rather than
silently inherited. `E87PipelineRequest.benchmarkOptions` still allows a
caller to override `DispersionPolicy` per-request, unchanged from Phase 3.

## 13. Boundary note: `benchmark-selection.ts` and `qualification.ts`

Both were re-read during this phase, per the task's request to document a
boundary concern rather than modify E86. Observations:

- `qualification.ts`'s `qualifyCapRateObservation` and `benchmark-selection.ts`'s
  `matchesIdentity` implement conceptually similar ideas to E87 Phase 2/3
  (floor-combination of match dimensions; "only filter on what the request
  specifies"). E87 Phase 2/3 **intentionally re-implements these ideas in its
  own module** rather than calling E86's versions directly, because E86's
  versions are scoped to E86's own benchmark-identity model
  (`BenchmarkIdentity`, E86's specific axis set) and are frozen — extending
  them to E87's richer requirements (8 dimensions, transaction-derived
  representation, two-axis confidence) would require modifying frozen E86
  code. Phase 5 does not change this: it continues to call only Phase 2/3's
  own functions, never `benchmark-selection.ts`/`qualification.ts` directly.
- No analytical defect was found in either E86 file during this review; the
  only observation is the intentional duplication-of-concept described
  above, which was already an accepted design decision as of Phase 2/3 and
  is reaffirmed, not revisited, here.

## 14. Never-list confirmation

Phase 5 introduces no new violation of the spec's NEVER list. In particular:
it never invents a cap rate (the override is an explicit user input, not a
computed guess); never averages across incompatible representations
(delegates entirely to Phase 3's existing grouping/dispersion logic); never
treats stale data as invalid (see §9); never substitutes asking/listing/
assessed prices (delegates to Phase 4's existing hard rejection); never
overwrites a publisher cap rate with a derived one (Phase 4's
`audit.reconciliation` keeps both, surfaced unmodified); never overwrites E87
observations because of an override (§10).

## 15. Known limitations / unresolved design decisions

- Origin classification (`publisher_survey` vs `consensus`) uses a simple
  heuristic (`contributingObservations.length === 1` -> publisher_survey).
  A single transaction-derived contributor is classified
  `transaction_derived` (checked first), so this only ambiguity is a single
  non-transaction-derived contributor, which is unambiguously a "the
  benchmark is exactly one publisher's number" case — no real ambiguity
  exists today, but a future phase adding a fourth origin category would need
  to revisit this function.
- The `toE86BenchmarkResponseStub` adapter populates `identity.city` as
  `geography.city ?? geography.metro ?? geography.country` — a reasonable
  best-effort label for a value E86's `resolveBenchmark` does not actually
  inspect (it only branches on `status`), documented here so a future reader
  does not mistake it for a meaningful mapping.
- No live data-fetching layer exists (by design, per spec) — `candidatePool`
  and `transactionDerivedObservations` must be supplied by the caller.

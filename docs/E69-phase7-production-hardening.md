# E69 Phase 7 — Production Hardening & End-to-End Contract Validation

Status: complete. This phase is validation and test-hardening only — no new
analytical features, no recalibration of provisional policy, no changes to
E68.

## 1. Scope of what was tested

A new suite, `__tests__/cap-rate-engine/e2e-pipeline.test.ts` (25 tests),
wires multiple phases together per test — cited E68-shaped observations
(`CRECitedObservation` fixtures) → Phase 2 `evaluateComparability` → Phase 3
`buildCapRateBenchmark` → (Phase 4 `deriveTransactionCapRate` /
`toE69CandidateInput` where relevant) → Phase 5 `resolveCapRateBenchmark`
(including the `userOverride` path) → Phase 6 `generateScenarios` /
`generateScenariosWithDefaultPolicy`. No test in this file re-tests a single
phase in isolation; the existing Phase 2-6 suites (517 tests) continue to
cover isolated/unit-level behavior and were left untouched.

Groups added:

1. **Full chain + provenance tracing** — a distinctively-tagged
   `sourceId`/`reportTitle` is followed from the input observation through
   comparability, the Phase 3 audit trail, the Phase 5 result, and into the
   Phase 6 anchor scenario's `capRateValue`/reference linkage.
2. **Transaction-derived chain** — a distinctive `transactionId` survives
   Phase 4 → Phase 5 (`origin: "transaction_derived"`) → Phase 6 (anchor
   `provenance: "derived"`), and `derivedFrom` remains intact.
3. **DATA_GAP cannot be bypassed** — 11 adversarial end-to-end cases
   (incompatible family, severe conflicting tier-1 sources, wrong geography,
   wrong asset class, missing NOI, invalid/asking price, currency mismatch,
   missing provenance/empty pool, stale-only pool under an explicit freshness
   floor, override over an underlying DATA_GAP, empty pool + empty
   transaction list) all assert `pipelineStatus`/`scenarioStatus === "data_gap"`
   propagates through Phase 5 and Phase 6 without ever producing a numeric
   benchmark. One assertion greps the full `JSON.stringify` of a DATA_GAP
   scenario result for `"capRateValue"` and asserts it is absent.
4. **Confidence floor, end to end** — a high-tier + low-tier agreeing pair,
   and the severe-dispersion methodology-preference path, both assert
   `confidence === floor(dataConfidence, benchmarkConfidence)` using
   `CONFIDENCE_RANK`, and assert the Phase 6 anchor scenario's `confidence`
   field equals that same floor value (never dataConfidence or
   benchmarkConfidence alone, never upgraded).
5. **Stale/historical preservation** — a stale-but-included candidate is
   confirmed present in `audit.contributing`; a stale candidate excluded by
   an explicit `minFreshness` floor is confirmed present in
   `audit.excludedByComparability` (never silently dropped); the raw
   observation object is deep-equal before/after running the full pipeline
   and Phase 6 on top of it.
6. **Scenario provenance isolation** — every non-anchor (`deltaBps !== 0`)
   scenario is asserted `provenance === "mechanically_generated"` with
   `confidence === undefined`, both in a normal-consensus case and in a
   severe-dispersion/methodology-preferred case. The anchor scenario alone
   carries a real confidence tier and a non-`"mechanically_generated"`
   provenance.
7. **User override chain** — benchmark success → override → Phase 6:
   confirms the original benchmark value and its contributing observations
   remain retrievable via `underlying`, confirms the anchor scenario's
   provenance is `"user_override"` and value is the override value, and
   confirms the original input observation is untouched (deep-equal
   snapshot).
8. **Further adversarial cases** — duplicate observations (documents current
   behavior: Phase 2/3 have no dedup step, so two structurally-identical
   observations are treated as two independent candidates — this is existing
   Phase 2/3 behavior, not changed here), mixed cap-rate families in one pool
   (only the exact-family candidate ever contributes), a deterministic tie
   case (reversed order, byte-identical `JSON.stringify`), and an
   empty-pool-plus-empty-transaction-list smoke test that must not throw.
9. **Large-pool determinism** — a 150-synthetic-candidate pool, run through
   the pipeline as-built and under two independent seeded shuffles, produces
   byte-identical (`JSON.stringify`-equal) `E69PipelineResult` output, and the
   resulting Phase 6 scenario sets are likewise byte-identical.

## 2. Defects found

**None.** Every documented behavior matched the spec on inspection and under
test. No changes were made to any Phase 1-6 source file. In particular:

- `classifyOrigin`'s documented known-limitation (Phase 5 §15 / Phase 6 §11)
  was re-reviewed against several adversarial mixed-pool cases (see "Further
  adversarial cases" above) and reproduces the previously-documented,
  intentional heuristic behavior — not a new defect.
- The Phase 6 anchor-scenario confidence assignment (`scenario-sensitivity.ts`
  `generateScenarios`) was specifically checked against a fabricated-upgrade
  concern (item 6 of the task) — it always assigns exactly
  `pipelineResult.result.confidence` (the already-floored value) to the
  anchor, and always omits `confidence` on every mechanically generated
  scenario. No mutation path exists that could let a `deltaBps !== 0`
  scenario acquire a confidence field.

## 3. Public API classification (barrel: `src/cap-rate-engine/index.ts`)

The barrel re-exports every symbol from all ten Phase 1-6 modules
(`export *`). Reviewed every export for intentional-public-API vs.
internal-implementation-detail status:

| Export | File | Classification |
|---|---|---|
| `E69ComparabilityRequest`, `E69CandidateInput`, `E69ComparabilityCandidate`, `E69ComparabilityResult`, `E69ComparabilityDimensions`, `E69DimensionResult`, `E69MatchLevel`, `E69InclusionDecision`, `E69ExclusionReasonCode` | comparability-types.ts | **Intentional public API** — the Phase 2 request/response contract. |
| `evaluateCandidate`, `evaluateComparability` | comparability.ts | **Intentional public API** — `evaluateComparability` is the Phase 2 entry point; `evaluateCandidate` is used directly by existing tests and is a reasonable standalone unit for a caller who wants a single-candidate verdict. |
| `E69Representation`, `E69SourceHierarchyTier`, `SOURCE_HIERARCHY_RANK`, `E69ConfidenceTier`, `CONFIDENCE_RANK`, `floorConfidence`, `DispersionPolicy`, `DEFAULT_DISPERSION_POLICY`, `E69DispersionTier`, `E69Dispersion`, `E69BenchmarkGapReasonCode`, `E69EnrichedCandidate`, `E69BenchmarkAuditEntry`, `E69BenchmarkAudit`, `E69Benchmark`, `E69BenchmarkGap`, `E69BenchmarkResult`, `E69BenchmarkOptions` | consensus-types.ts | **Intentional public API** — the Phase 3 result contract, plus small reusable primitives (`floorConfidence`, `CONFIDENCE_RANK`) that Phase 7's own e2e tests rely on to assert floor behavior from outside the module. |
| `classifyRepresentation`, `extractScalarValue`, `sourceHierarchyTier`, `buildCapRateBenchmark` | benchmark-consensus.ts | **Intentional public API** — `buildCapRateBenchmark` is the Phase 3 entry point; the other three are exercised directly by `__tests__/cap-rate-engine/comparability.test.ts` and `benchmark-consensus.test.ts`, confirming they are meant to be independently callable/testable units, not accidental leaks. |
| `CREDisclosureState`, `Disclosed<T>`, `known`, `unknown`, `notDisclosed`, `notApplicable`, `CREPriceType`, `USABLE_PRICE_TYPES`, `CRENoiDefinition`, `CRENoiQuality`, `NOI_DEFINITION_QUALITY`, `CRENoiPeriod`, `NOI_ANNUALIZATION_FACTOR`, `CRECurrency`, `CREFxConversion`, `CRETransactionCapRateType`, `CRETransactionProvenance`, `CRETransactionInput`, `CRETransactionGapReasonCode`, `CRETransactionGap`, `CREReconciliationPolicy`, `DEFAULT_RECONCILIATION_POLICY`, `CREReconciliationTier`, `CRECapRateReconciliation`, `CRETransactionAudit`, `CRETransactionDerivedObservation`, `CRETransactionResult`, `CRETransactionOptions` | transaction-types.ts | **Intentional public API** — the Phase 4 input/output contract, including the `Disclosed<T>` constructor helpers (`known`/`unknown`/etc.) which every caller (and every test file, including this phase's) must use to build a `CRETransactionInput`. |
| `capRateDifferenceBps`, `classifyReconciliationTier`, `deriveTransactionCapRate`, `deriveTransactionCapRateBatch`, `toE69CandidateInput` | transaction-derivation.ts | **Intentional public API** — `deriveTransactionCapRate`/`Batch` are the Phase 4 entry points, `toE69CandidateInput` is the documented Phase 4→Phase 2 bridge used by Phase 5 itself, and `capRateDifferenceBps`/`classifyReconciliationTier` are exercised directly by `transaction-derivation.test.ts`. |
| `E69BenchmarkOrigin`, `E69PipelineRequest`, `E69OverrideLayer`, `E69PipelineSuccessResult`, `E69PipelineDataGapResult`, `E69PipelineSuccess`, `E69PipelineDataGap`, `E69PipelineUserOverridden`, `E69PipelineResult` | pipeline-types.ts | **Intentional public API** — the Phase 5 request/result contract. |
| `resolveCapRateBenchmark` | pipeline.ts | **Intentional public API** — the sole Phase 5 entry point. |
| `classifyOrigin`, `toE68BenchmarkResponseStub` | pipeline.ts | **Internal implementation detail — already correctly not exported.** Both are plain (non-`export`) functions local to `pipeline.ts`; they are not re-exported by the barrel and were confirmed absent from every import in `__tests__/cap-rate-engine/`. No change needed. |
| `E69ScenarioProvenance`, `E69ScenarioType`, `E69ScenarioBasis`, `E69Scenario`, `E69EvidenceSupportedRange`, `E69SensitivityDeltaInput`, `E69SensitivityRequest`, `DefaultSensitivityPolicy`, `DEFAULT_SENSITIVITY_POLICY`, `E69ScenarioGapReasonCode`, `E69ScenarioError`, `E69ScenarioDataGap`, `E69ScenarioSetSuccess`, `E69HypotheticalScenarioSet`, `E69ScenarioResult` | scenario-types.ts | **Intentional public API** — the Phase 6 contract, including the versioned, clearly-labeled `DEFAULT_SENSITIVITY_POLICY` opt-in convenience. |
| `generateScenarios`, `generateScenariosWithDefaultPolicy`, `generateHypotheticalScenarios` | scenario-sensitivity.ts | **Intentional public API** — the three Phase 6 entry points. |

**Conclusion: no barrel change was made.** The two functions that looked like
candidates for "internal helper accidentally exported" from the task
description (`classifyOrigin`, `toE68BenchmarkResponseStub`) were already
non-exported, module-private functions in `pipeline.ts` — they never reached
the barrel in the first place. Everything actually exported from the barrel
has either a direct external-caller purpose (an entry point or a contract
type) or is directly exercised by name from existing Phase 2-6 test files,
which is a strong signal it was deliberately designed as an independently
usable/testable unit rather than an accidental leak. No export was removed.

## 4. E68/E69 boundary review

Consolidating what Phase 5's own header comment and prior phase docs already
established (no new findings; not re-litigated in depth here):

- **`user-override.ts`**: E69 calls E68's real `createUserOverride` /
  `resolveBenchmark` verbatim via a private adapter
  (`toE68BenchmarkResponseStub` in `pipeline.ts`) rather than reimplementing
  "an override always wins." This is the one place E69 depends on E68 logic
  beyond types, and it is read-only — E69 constructs an honest, minimal stub
  of E68's `CREBenchmarkResponse` shape and never fabricates fields E68 would
  otherwise have populated (warnings/provenance are left as empty arrays,
  never invented).
- **`benchmark-selection.ts` / `qualification.ts`**: conceptually adjacent to
  Phase 2/3 (both do identity/axis matching), but deliberately NOT reused —
  E69 maintains its own comparability/consensus logic so E68 stays frozen at
  v1.0 and so E69's cap-rate-specific rules (capRateType family exactness,
  representation transforms, source hierarchy) don't have to be shoehorned
  into E68's more general axis-qualification model. This is an accepted,
  documented duplication of *concept*, not of *code* — reviewed again in
  Phase 7 and left alone, per the task's instruction not to move code.
- **`observation-lifecycle.ts` (`CREPresentationFreshness`)**: E69 never
  recomputes freshness; Phase 2 requires it to be supplied per candidate and
  treats "not assessed" honestly rather than guessing. Confirmed still true
  by inspection of `comparability-types.ts`.

No boundary concern found in Phase 7 review rises to the level of "should be
moved" — all are already documented, intentional design choices from prior
phases.

## 5. Provisional policies (confirmed unchanged, not recalibrated)

Per the task's explicit prohibition, none of the following were touched.
Listed here for visibility:

- `DEFAULT_DISPERSION_POLICY` (`consensus-types.ts`): `{ tightBps: 15,
  moderateBps: 40, materialBps: 75 }` — still marked
  `PROVISIONAL`/"NOT empirically calibrated" in its doc comment.
- `DEFAULT_RECONCILIATION_POLICY` (`transaction-types.ts`) and
  `classifyReconciliationTier`'s thresholds (`transaction-derivation.ts`) —
  still PROVISIONAL per Phase 4 doc.
- `DEFAULT_SENSITIVITY_POLICY` (`scenario-types.ts`):
  `{ version: "E69-phase6-provisional-v1", deltasBps: [-50, -25, 0, 25, 50]
  }` — still explicitly versioned as provisional and opt-in only
  (`generateScenariosWithDefaultPolicy`, never applied implicitly).

All three remain flagged for future calibration against real market data, as
originally documented in their respective Phase 3/4/6 docs.

## 6. Known limitations / uncertainty (documented, not changed)

- `classifyOrigin`'s heuristic (contributingObservations count/type-based
  origin labeling) has a known edge case already documented in Phase 5 §15 /
  Phase 6 §11: it is informational-only labeling and never affects the
  computed benchmark value, so its edge case was judged (again, in this
  phase) not to warrant a change — consistent with the task's instruction to
  leave documented known-limitations alone. Flagged again here for
  visibility rather than re-litigated.
- Duplicate-observation handling: Phase 2/3 do not deduplicate structurally
  identical observations (e.g. the same citation submitted twice in one
  candidate pool) — both are treated as independent candidates and can both
  contribute to consensus. This is existing behavior, not something Phase 7
  changed. Whether a caller-side or E69-side dedup step should exist is a
  genuine open design question the author is **not certain** is a defect
  (a caller re-submitting the same observation twice may be a caller bug
  outside E69's contract, in which case no engine-level fix is owed) — flagged
  here rather than silently changed, per the task's instruction to document
  uncertainty instead of guessing.

## 7. Final readiness assessment

**READY WITH LIMITATIONS.**

Reasoning: all 567 tests pass (542 pre-existing + 25 new end-to-end/
adversarial), `tsc --noEmit` is clean, no E68 file was touched, no Phase 1-6
source file was modified, and every hardening requirement in the task
(provenance traceability, DATA_GAP non-bypassability, confidence-floor
integrity, stale-data preservation, scenario-provenance isolation, override
preservation, large-pool determinism) was verified end-to-end with passing
tests and no defect found. The "WITH LIMITATIONS" qualifier reflects two
non-blocking, already-documented items carried forward rather than newly
discovered: the Phase 5/6 `classifyOrigin` known-limitation, and the
duplicate-observation open question in §6 above — both are labeling/edge-case
concerns that never allow a fabricated numeric benchmark and never violate
the DATA_GAP/confidence-floor contracts, but should be resolved (or
explicitly accepted) before treating E69 as fully closed.

# E69 Phase 3 — Consensus & Benchmark Selection

© 2026 Lighthouse Research Ltd. All rights reserved.

## 1. Purpose

Phase 2 (`comparability.ts`) answers "which observations are comparable to a
requested benchmark identity?" Phase 3 answers the next question: "given the
comparable ones, is there enough legitimate, non-conflicting evidence to
defend a benchmark?" It is deliberately conservative: insufficient,
conflicting, stale, or incompatible evidence returns a structured
`DATA_GAP`, never a fabricated, interpolated, or silently-averaged number.

## 2. Phase 2 dependency

Phase 3's sole entry point, `buildCapRateBenchmark(comparability, options?)`,
takes Phase 2's own `E69ComparabilityResult` — the output of
`evaluateComparability()` — as its only input. Phase 3 never re-evaluates a
geography/asset/class/period/freshness/representation dimension itself, never
overrides an `EXCLUDED` verdict, and never widens an `INCLUDED` candidate's
comparability tier. Every excluded-by-Phase-2 candidate is carried into
Phase 3's audit trail verbatim (`audit.excludedByComparability`).

## 3. Cap-rate representations

`E69Representation` = `point | range | median | average | percentile |
transaction_derived | survey_estimate | unsupported`.

E68's `CREObservation` has no explicit "representation" field, so
`classifyRepresentation()` derives one:

1. A source-declared `tags.representation` wins when it names one of the
   seven recognized values; any other string is `"unsupported"` — never
   guessed at.
2. Otherwise: `capRateType === "derived_transaction"` → `transaction_derived`;
   `capRateType === "survey_estimate"` → `survey_estimate`; `value` present →
   `point`; `low`+`high` present → `range`; otherwise → `unsupported`.

Only ONE scalar transformation is performed, and it is fully documented:
`range` → E68's own `rangeMidpoint()` (a pure, already-reviewed function).
Every other representation already carries a publisher-printed scalar
(`value`), used verbatim — Phase 3 never computes a median, average, or
percentile itself. An observation whose representation cannot yield a
scalar is excluded with `UNSUPPORTED_REPRESENTATION`, and if that empties the
entire eligible pool, the overall result is `DATA_GAP /
UNSUPPORTED_REPRESENTATION`.

## 4. Cap-rate families

Compatibility is enforced at the **exact `CRECapRateType`** level, not merely
at the coarser `CAP_RATE_FAMILY` (`survey`/`transaction`/`derived`) level —
this mirrors E68's own `assertComparableCapRates` guard in `consensus.ts`
("cannot mix cap-rate types in one consensus"). Two "survey"-family
observations (e.g. `stabilized` and `going_in`) are never pooled together
just because they share a family.

Grouping policy:

- If the request pins `capRateType`, only exact matches enter the consensus
  group; any Phase-2-included candidate of the same `CAP_RATE_FAMILY` but a
  different exact type is excluded by Phase 3 with an explicit audit note
  ("family-adjacent... never pooled for consensus").
- If the request leaves `capRateType` unpinned and every eligible candidate
  shares one exact type, that single group is used.
- If the request leaves it unpinned and eligible candidates span **more than
  one** distinct exact type, Phase 3 refuses to guess which concept the
  caller meant: `DATA_GAP / INCOMPATIBLE_CAP_RATE_FAMILY`, listing every
  group in `gap.conflictingCandidates`.

## 5. Source hierarchy

Five deterministic tiers (`E69SourceHierarchyTier`), derived only from
existing E68 fields (`CRESource.sourceType`, `CAP_RATE_FAMILY`,
`CREDerivedTransaction`):

1. `primary_specialist_research` — `sourceType === "valuation"`.
2. `primary_brokerage_research` — `sourceType === "brokerage"`.
3. `transaction_derived_complete_provenance` — `sourceType ===
   "transaction_database"` with a `CREDerivedTransaction` (`derivedFrom`)
   present and a transaction/derived family `capRateType`.
4. `secondary_aggregated` — `government` / `construction_cost` / `other`, or
   a `transaction_database` entry lacking complete derivation provenance.
5. `unsupported_unknown` — `user` / `internal` / anything else.

This hierarchy affects **weight and confidence only**. It can never move a
candidate Phase 2 excluded back into eligibility, and it can never make an
incompatible asset class, geography, or cap-rate family compatible — proved
by test 16 ("Source hierarchy cannot override incompatibility"), where a
tier-1 `valuation` source with the wrong asset class is still excluded.

## 6. Consensus methodology

For the selected, family/type-compatible group:

- **n = 1**: `method: "single_observation"` — that observation's own scalar
  value is the benchmark, verbatim, no arithmetic performed.
- **n ≥ 2, dispersion tight/moderate/material**: `method:
  "weighted_consensus"` — a deterministic, additive, documented weight per
  candidate: `sourceHierarchyWeight (1–5) + freshnessWeight (1–4) +
  comparabilityWeight (0–3)`; the final value is the weight-normalized
  average of contributing scalar values, rounded to 4 decimal places.
  Weighting is additive (not multiplicative) so one weak axis dampens rather
  than erases a candidate's influence.
- **n ≥ 2, dispersion severe**: see §13 (Conflict handling) — either
  `methodology_preferred` or `DATA_GAP`.

Consensus is never computed across cap-rate-type groups, and weighting never
substitutes for the family/type compatibility gate in §4.

## 7. Dispersion policy

`DispersionPolicy = { tightBps, moderateBps, materialBps }`, in basis points
(1bp = 0.01 percentage point of cap rate), passed explicitly via
`options.dispersionPolicy` (default `DEFAULT_DISPERSION_POLICY`).

**Defaults are PROVISIONAL** — `{ tightBps: 15, moderateBps: 40, materialBps:
75 }` — chosen for internal, directional consistency only. They are **not**
empirically calibrated against a real cap-rate survey population; this is
called out in the source code comments on `DispersionPolicy` and again here.
See §18.

Tiers: `tight` (≤ tightBps) → `moderate` (≤ moderateBps) → `material` (≤
materialBps) → `severe` (> materialBps). A single-candidate group reports
`tier: "single_observation"` (dispersion is not meaningful for n=1).

## 8. Weighting

Weights are explicit, deterministic, and documented in §6. They:

- never override incompatibility (a candidate outside the compatible group
  never receives a weight at all — it is excluded before weighting runs);
- never turn `unsupported` comparability into something usable (a candidate
  reaching this stage is, by construction, Phase-2-`INCLUDED`, i.e. never
  `unsupported`);
- are the simplest defensible additive scheme the team could find; no
  multiplicative or exponential weighting was introduced for its own sake.

## 9. Two-axis confidence

`dataConfidence` (quality of the observations) and `benchmarkConfidence`
(quality of the inference) are computed and reported **separately**, and
combined **only by floor** — `floorConfidence()`, never an average.

- `dataConfidence` = the floor, across every contributing candidate, of that
  candidate's own floor of {source-hierarchy tier, freshness, Phase-2
  comparability tier}. One weak contributing observation legitimately caps
  overall data confidence, consistent with the floor-not-average principle
  used throughout E68 (`qualifyCapRateObservation`) and Phase 2
  (`combineDimensions`).
- `benchmarkConfidence` = the floor of {sample-size tier, dispersion tier,
  source-independence tier (≥2 distinct `sourceId`s → `high`, else
  `moderate`)}.
- `confidence` = `floorConfidence(dataConfidence, benchmarkConfidence)`.

Both components are always present on a `"success"` result
(`result.dataConfidence`, `result.benchmarkConfidence`,
`result.confidence`), and never collapsed before that point.

## 10. Benchmark selection

A benchmark (`status: "success"`) is produced only when, after Phase 2
filtering and Phase 3's own representation/family gates:

- at least one eligible, scalar-bearing, family/type-compatible observation
  remains;
- its provenance was already confirmed adequate by Phase 2's hard
  `INSUFFICIENT_PROVENANCE` gate;
- freshness is acceptable (Phase 2's `minFreshness` gate, honored verbatim);
- no unresolved material (severe, tied-tier) conflict exists; and
- the result is fully explainable via `audit`.

No arbitrary minimum sample size is imposed for ordinary selection — see §11.

## 11. Single-observation handling

One highly authoritative, exactly comparable, recent observation **does**
produce a benchmark (`method: "single_observation"`), and `dataConfidence`
can legitimately be `high` for it. `benchmarkConfidence`, however, is capped
by `sampleSizeConfidence(n)`, which returns `moderate` (not `high`) for
`n < 3` — reflecting limited evidence *breadth*, not weak evidence
*quality*. Because `confidence` is the floor of both axes, the final
confidence for an excellent lone observation is `moderate`, not `low` and
not fabricated `high` (test 1, test 20).

## 12. Multi-source handling

CBRE=5.5%, C&W=5.6%, JLL=5.7% (tight/moderate dispersion): all three
contribute to a `weighted_consensus`, and the result exposes
`contributingObservations`, `dispersion`, `audit.consensusMethod`,
`dataConfidence`/`benchmarkConfidence`/`confidence`, and
`audit.sourceHierarchySummary` (test 3).

## 13. Conflict handling

For severe dispersion (> `materialBps`) within one compatible group:

1. If exactly one candidate holds the uniquely best source-hierarchy tier,
   the disagreement is attributed to methodology quality: that candidate's
   own scalar value becomes the benchmark (`method:
   "methodology_preferred"`), never blended with the disagreeing evidence.
   `benchmarkConfidence` is explicitly floored at `low` or below in this
   path — a resolved-by-preference benchmark is never reported with high
   benchmark confidence.
2. If two or more candidates tie for the best tier and still disagree
   severely (the canonical CBRE=5.0% vs C&W=7.0% case), no methodological
   preference is defensible: `DATA_GAP / MATERIAL_SOURCE_DISAGREEMENT`,
   never an average (never `6.0%`) — proved by tests 6, 25, 28.

Phase 3 does not attempt to detect "different compatible segments that
should stay separate" beyond what Phase 2's dimensions and Phase 3's
capRateType grouping already enforce; a genuine segment split (e.g. two
different submarkets both claiming to answer the same request) is out of
scope here and is a known limitation (§17).

## 14. DATA_GAP behavior

Every `DATA_GAP` (`status: "data_gap"`) provides, on `gap`:
`reasonCode`, `requestedBenchmark`, `candidateCount`, `eligibleCount`,
`excludedCount`, `conflictingCandidates` (where relevant),
`explanation`, and `provenanceReferences`. Reason codes:
`NO_COMPARABLE_OBSERVATIONS`, `INSUFFICIENT_PROVENANCE`,
`INCOMPATIBLE_CAP_RATE_FAMILY`, `MATERIAL_SOURCE_DISAGREEMENT`,
`INSUFFICIENT_FRESHNESS`, `UNSUPPORTED_REPRESENTATION`,
`INSUFFICIENT_EVIDENCE`, `OTHER`. These are deliberately distinct from E68's
`CREDataGapReasonCode` (a source's inability to publish at ingestion time)
and from Phase 2's `E69ExclusionReasonCode` (one candidate's mismatch) —
they describe why the *pool as a whole* cannot defend a benchmark.
`buildCapRateBenchmark` never throws for an ordinary evidence gap.

## 15. Audit trail

Every result (`success` or `data_gap`) carries `audit: E69BenchmarkAudit`
with: `requestedBenchmark`, `observationsConsideredCount`,
`excludedByComparability` (Phase 2's exclusions, with reason + explanation),
`excludedByPhase3` (representation/family exclusions Phase 3 itself made),
`contributing` (every candidate that fed the final value, with its
representation, scalar, source-hierarchy tier, comparability, freshness, and
weight), `sourceHierarchySummary`, `dispersion`, `consensusMethod`,
`dataConfidence`/`benchmarkConfidence`/`confidence`, `finalBenchmarkValue`
(when applicable), `dataGapReasonCode` (when applicable), and a
human-readable `narrative`. This is designed to answer, unassisted, "why did
InvestScape use this cap rate?"

## 16. Determinism

- No randomness (`Math.random`), no wall-clock dependence (`Date.now`), no
  reliance on `Map`/`Set`/object iteration order for anything observable —
  all grouping keys are sorted or explicitly compared before use.
- `compareCandidatesDeterministically()` provides one total order: higher
  weight first, then `sourceId` (lexicographic), then citation
  `publicationDate`, then `reportTitle` — used for both audit ordering and
  any tie-breaking. Tests 17–18 prove pool-order independence and
  run-to-run identical output (`JSON.stringify` equality) directly.

## 17. Known limitations

- Segmentation beyond Phase 2's dimensions and Phase 3's exact-`capRateType`
  grouping (e.g. two legitimately distinct but both-plausible submarket
  reads) is not separately detected; it would currently either pass Phase 2
  comparability (and get pooled, or hit severe-dispersion handling) or fail
  it outright. A dedicated "compatible-but-distinct-segment" detector is
  future work.
- The additive weighting scheme in §6/§8 is intentionally simple; it is not
  a substitute for a calibrated statistical model and does not model source
  correlation/non-independence beyond the coarse `sourceIndependenceConfidence`
  check (distinct `sourceId` count only — it cannot detect two publishers
  quietly citing the same underlying transaction database).
- `median` / `average` / `percentile` representations are trusted verbatim
  from `obs.value` (or the range midpoint) with no independent recomputation
  or plausibility check beyond what Phase 2 already verifies.
- No scenario/what-if sampling: `sampleSizeConfidence` documents that a
  minimum sample size is NOT required for ordinary selection, per the Phase
  3 spec — a future scenario-analysis mode may add one.

## 18. Future calibration requirements

`DEFAULT_DISPERSION_POLICY` (§7), `sourceHierarchyTier` mapping (§5), the
additive weight coefficients (§6/§8), and the confidence-tier mappings in
§9/§11 are all PROVISIONAL engineering defaults, not statistically fitted
values. Before this layer is relied on for real underwriting decisions, a
future phase should calibrate `tightBps`/`moderateBps`/`materialBps` against
an actual observed distribution of same-market, same-period cap-rate
publications, and re-examine whether the `n<3 → moderate` sample-size cap in
`sampleSizeConfidence` reflects real evidentiary practice.

## 19. Boundary with Phase 4 (transaction-derived calculations)

Phase 3 **recognizes** an already-computed `capRateType: "derived_transaction"`
observation and may include it in a benchmark exactly like any other
comparable, compatible, well-provenanced observation (see the "transaction-
derived observation may be recognized..." test) — its `CREDerivedTransaction`
(`derivedFrom`) provenance is what earns it
`transaction_derived_complete_provenance` source-hierarchy tier. Phase 3
performs **no** NOI/price arithmetic itself and never invents a
`derived_transaction` observation from raw transaction inputs; computing one
from scratch (validating `purchasePrice`/`noi` inputs, performing the
division, attaching `derivedFrom` provenance) is explicitly out of scope and
reserved for Phase 4.

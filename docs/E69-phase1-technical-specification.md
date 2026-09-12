# E69 Phase 1 — Commercial Cap Rate Engine: Technical Specification

Status: **SPECIFICATION ONLY — NOTHING IN THIS DOCUMENT IS IMPLEMENTED.**
E69 does not exist in this codebase as of this writing. No file under
`src/cre-intelligence/` was modified to produce this document, and this
document introduces no new source files, only this spec. Every TypeScript-like
block below is an illustrative sketch of a *proposed* future contract, not
real, compiled, or tested code, and must not be copy-pasted into an E69
implementation without re-review at build time (E68 itself may have moved on).

This document was produced by reading, in full: `src/cre-intelligence/types.ts`,
`benchmark-types.ts`, `benchmark-selection.ts`, `consensus.ts`, `qualification.ts`,
`mapping.ts`, `user-override.ts`, `paid-source-analysis.ts`, `legacy-migration.ts`,
`soft-cost.ts`, `source-registry.ts`, `index.ts`, everything under
`src/cre-intelligence/ingestion/` (`types.ts`, `freshness.ts`, `gap-reasons.ts`,
`observation-lifecycle.ts`, `source-health.ts`, `ingestion-events.ts`,
`monitoring.ts`, `schema-guard.ts`, `error-taxonomy.ts`, `public-source-registry.ts`,
and the three adapters), the data files under `src/cre-intelligence/data/`, every
test under `__tests__/cre-intelligence/` (including `ingestion/`), and every
`docs/E68-phase*.md` document plus `docs/e68-source-registry.md`,
`docs/e68-mapping.md`, `docs/e68-data-dictionary.md`, and
`docs/E68-cap-rate-data-coverage.md`.

---

## 1. Executive Summary

E68 is InvestScape's CRE **data foundation**: it answers "what CRE data
exists, where did it come from, how trustworthy is it, what period does it
describe, and is it still current." E68 is explicitly frozen at v1.0 and this
document proposes no change to it.

E69 — the **Commercial Cap Rate Engine** — is a not-yet-built analytical layer
that *consumes* E68's qualified observations to answer a different question:
"given everything E68 knows, what cap-rate benchmark is actually appropriate
for this specific market/asset/class/geography/period, how do multiple
comparable observations get reconciled into one defensible answer (or an
honest refusal), and with what confidence and provenance." E69 owns
comparability judgment, consensus/dispersion analysis, transaction-derived
cap-rate calculation, scenario banding, and cap-rate-specific confidence and
gap semantics. E69 does not re-implement ingestion, provenance, freshness, or
source-registry infrastructure — it reuses E68's for all of that.

A close reading of E68 found that most of what a naive E69 spec would assume
still needs to be built already **exists in E68**, under Phase 4C/5: exact/
close/approximate/unsupported qualification (`qualification.ts`), deterministic
identity-filtered benchmark selection (`benchmark-selection.ts`), a
publisher-range-vs-derived-value type system (`benchmark-types.ts`), and even a
working (if minimal) user-override mechanism (`user-override.ts`). This is the
central finding of Part 2 below, and it reshapes E69's scope considerably:
several things this document was asked to consider as "new E69 functionality"
are, on inspection, existing E68 functionality with a boundary question
attached, not a design gap. Those are flagged explicitly rather than
re-designed from scratch.

---

## 2. E68 Inspection Findings

### 2.1 Reusable E68 types, as they actually exist

| Concept | File | Type/function | Reuse in E69 |
|---|---|---|---|
| Normalized observation | `types.ts` | `CREObservation`, `CRECitedObservation` | E69's sole input unit. Never copied/mutated. |
| Cap-rate concept typing | `types.ts` | `CRECapRateType`, `CAP_RATE_FAMILY` | E69's comparability and consensus logic is built directly on this — it is exactly the "must not average incompatible concepts" axis E69 needs. |
| Provenance/citation | `types.ts` | `CRESource`, `CRECitation` | Carried through verbatim into every E69 output. |
| Geography | `types.ts` | `CREGeography` | E69's geography-comparability rules operate on this shape directly. |
| Honesty/status axis | `types.ts` | `CREDataStatus` (`observed/derived/inferred/unsupported`), `resolveDataStatus`, `assertObservationStatus` | E69 outputs (esp. transaction-derived cap rates) must set `dataStatus: "derived"` using this exact vocabulary — not invent a parallel one. |
| Derivation provenance | `types.ts` | `CREDerivedTransaction` | This is *already* the exact shape a transaction-derived cap rate needs (propertyName, transactionDate, purchasePrice, priceSource, noi, noiSource, methodology). E69 Part 8 below is largely "call this, don't reinvent it." |
| Data gap | `types.ts` | `CREDataGap`, `reasonCode?: CREDataGapReasonCode` | E69 gap results reference/extend this, see Part 11 (E69-specific reason codes) and Part 13. |
| Gap reason vocabulary | `ingestion/gap-reasons.ts` | `CREDataGapReasonCode` (8 codes), `formatDataGapMessage` | Reused as the base vocabulary; E69 needs additional codes not meaningful at ingestion time (see Part 13). |
| Classification mapping / confidence tiers | `mapping.ts` | `MappingConfidence` (`exact/close/approximate/unsupported`), `mapToLegacyCapRateKey`, `AUTO_SURFACED`/`isAutoSurfaceable` | **This is the actual, only E68 qualification vocabulary.** E69's comparability tiers (Part 4) reuse this exact four-value enum rather than inventing a new one, because it is what the codebase already means by those words. |
| Per-observation benchmark fitness | `qualification.ts` | `qualifyCapRateObservation`, `ObservationQualification` (`confidence`, `baseConfidence`, `rationale`, `warnings`, `methodologyFamily`, `valueShape`, `sourceQualityTier`) | Directly reusable as E69's **data confidence** input (see Part 10) — it already separates classification-fit from source-quality-tier from methodology-family, which is most of what E69 needs to build "data confidence" on top of. |
| Deterministic selection | `benchmark-selection.ts` | `selectCapRateBenchmark`, `matchesIdentity`, `rankCandidates` | This already implements "given a BenchmarkIdentity and a pool, filter to matches, rank by period recency then source quality, take the top one, return DATA_GAP if none qualify." E69's benchmark-selection (Part 3/6) is this same idea generalized to *return the whole reconciled picture* (consensus, dispersion, alternatives) rather than "top-1 plus provenance list." See boundary discussion below. |
| Response/identity shapes | `benchmark-types.ts` | `BenchmarkIdentity`, `CREBenchmarkResponse`, `PublisherRange`, `DerivedValue`, `ValueProvenance`, `BenchmarkProvenanceEntry`, `BenchmarkStatus` | E69's output contract (Part 13) is deliberately modeled as a **superset** of this shape, not a parallel one, to avoid two competing "what does a benchmark look like" vocabularies in the same product. |
| User override | `user-override.ts` | `createUserOverride`, `resolveBenchmark`, `UserOverride`, `ResolvedBenchmark` (in `benchmark-types.ts`) | **Already exists.** See Part 12 — this is not new E69 functionality; E69 needs to decide how it composes with a *cap-rate-specific* benchmark result rather than build the mechanism itself. |
| Consensus arithmetic | `consensus.ts` | `weightedConsensus`, `capRateConsensus`, `assertComparableCapRates`, `escalateCost` | Exists, but is a simple source-quality-weighted mean with a hard guard against mixing `capRateType`. It does **not** do dispersion/outlier analysis, does not distinguish transaction from survey evidence in its weighting, and is not period-aware beyond what's baked into `sourceQuality`. E69's consensus methodology (Part 6/8 of this doc) treats this as a narrow, reusable primitive for the "small, tight cluster of same-type same-period observations" case, and builds the rest (dispersion classification, source-hierarchy-aware weighting, period/stale handling, conflict detection) net-new. |
| Freshness | `ingestion/freshness.ts` | `assessFreshness`, `FreshnessAssessment` | E69 consumes this output directly (Part 9) rather than re-deriving currency from raw dates. |
| Lifecycle | `ingestion/observation-lifecycle.ts` | `CREObservationLifecycleStatus` (`retrieved/validated/active/superseded/archived`), `CREPresentationFreshness` (`live_current/recent/historical/stale/unavailable`), `observationFingerprint` | E69 consumes `CREPresentationFreshness` as the actual current/recent/historical/stale/unavailable vocabulary (Part 9); note this is the *presentation* label, distinct from lifecycle *status* — E69 must not conflate them. |
| Source health | `ingestion/source-health.ts` | `CRESourceHealthStatus`, `CRERefreshCadence`, `CRESourceRefreshState` | Consumed read-only when E69 needs to know whether a source backing a candidate observation is currently degraded/unavailable (affects data confidence, not the stored observation's validity). |
| Paid-source metadata | `paid-source-analysis.ts` | `CREPaidSourceProfile`, `CRE_RECOMMENDATION_TIERS`, `isPaidSourceRedistributable` | Classification-only (no proprietary values). E69's source-priority model (Part 5) references source **type/tier**, which this file documents for sources not yet licensed; it carries no cap-rate numbers itself. |
| Legacy compatibility | `mapping.ts`, `legacy-migration.ts` | `LegacyCapRateKey`, `mapRlbSubtype` | Out of scope for E69's core logic; relevant only if E69 must eventually also emit a legacy-compatible key for the current WeWeb front end (flagged as an open question, Part 21). |

### 2.2 Analytical logic already inside E68 that is a boundary concern

The task specifically asked to flag, not move, anything inside E68 that looks
like analytical cap-rate logic rather than data-foundation logic. Two files
qualify:

1. **`src/cre-intelligence/benchmark-selection.ts` — `selectCapRateBenchmark`.**
   This function does not just retrieve or validate data; it makes an
   analytical judgment call ("this is *the* benchmark for this identity, apply
   Part-3-style priority ranking, warn on approximate") that is squarely a cap
   rate *decision*, not a data-foundation fact. Its own header comment even
   says selection was "explicitly deferred" from Phase 4C — i.e. E68's own
   authors already treated this as a distinct concern from qualification, and
   arguably it belongs beside E69's benchmark/consensus logic rather than
   inside the data-foundation engine. **Not moved. Flagged only.** E69 should
   treat this function as a **model** for its own top-1 selection primitive
   (Part 3) but build its full consensus/range/dispersion logic independently
   rather than by extending this function in place, since extending it would
   further blur the E68/E69 line this document is trying to draw cleanly for a
   future migration decision.

2. **`src/cre-intelligence/qualification.ts` — `qualifyCapRateObservation`.**
   This is closer to genuine data-foundation work (it answers "is this
   observation fit to be used at all," which is a provenance/qualification
   question E68 legitimately owns) but two of its axes are cap-rate-domain
   judgments rather than pure data facts: the currency thresholds (≤12mo
   exact / 12–24mo close / >24mo approximate, hardcoded in
   `periodConfidence`) and the "transaction methodology ranks highest" warning
   embedded in the function body (`methodologyFamily !== "transaction"` →
   warning) both encode a *cap-rate market-analysis opinion* about acceptable
   staleness and source-hierarchy, not a generic data-quality fact applicable
   to every CRE metric E68 might ever carry. **Not moved. Flagged only.** E69
   should not silently re-derive different currency thresholds for its own
   purposes; see Open Design Question in Part 21 about whether E69's
   comparability layer should call this function as-is, parameterize it, or
   maintain its own explicitly-cap-rate-benchmark-specific threshold set that
   happens to start out matching E68's.

3. **`benchmark-selection.ts` — `deriveMidpoint`.** A narrow, correctly-quarantined
   (`e68_derived`/`sourceSupplied: false`) utility, not itself objectionable,
   but a data point that "derive a single number from a range" already exists
   in E68 and should not be reinvented differently in E69 (Part 7).

No other file reviewed contains cap-rate-specific analytical logic; the
ingestion, freshness, lifecycle, source-health, error-taxonomy, schema-guard,
and monitoring modules are all genuinely metric-agnostic data-foundation
infrastructure and are excluded from this list.

### 2.3 What does NOT exist in E68 (confirmed, not assumed)

- **No dispersion/outlier/conflict analysis.** `consensus.ts` computes a
  weighted mean and a naive min/max range; nothing detects "these three
  sources disagree materially" versus "these three sources agree tightly."
- **No transaction-derived cap-rate *calculator*.** `CREDerivedTransaction`
  is a provenance *shape* to record such a calculation once made; no function
  in E68 computes `noi / purchasePrice` and populates it. Confirmed via
  `grep`-level read of every `.ts` file under `src/cre-intelligence/` — no
  division of NOI by price exists anywhere in the source tree.
  `docs/E68-phase4c-audit-and-mapping.md` explicitly notes a real-world case
  (the Newmark "Corner 63" transaction table) where a `derived_transaction`
  cap rate was deliberately **not** created because the source table carried
  no NOI column — i.e. E68's own authors already apply the Part 8 rule of
  this document ("if NOI unavailable, do not estimate it") by hand; E69 needs
  to make that rule an enforced function rather than an audit note.
- **No scenario analysis (conservative/base/aggressive)** anywhere in the
  reviewed code.
- **No percentile-band or statistical-survey representation** (25th/50th/75th)
  — E68's `CREObservation` only has `value` or `low`/`high`; there is no
  percentile field or type.
- **No cap-rate-specific gap reason codes.** `CREDataGapReasonCode`'s eight
  values (`METRIC_NOT_PUBLISHED`, `GEOGRAPHY_NOT_COVERED`,
  `GRANULARITY_NOT_AVAILABLE`, `API_OR_DOWNLOAD_UNAVAILABLE`,
  `LICENSE_REQUIRED`, `SOURCE_TEMPORARILY_UNAVAILABLE`, `SCHEMA_CHANGED`,
  `VALIDATION_FAILED`) are all about a *source's* ability to publish
  something, never about "the data exists but doesn't fit this specific
  cap-rate request" (wrong asset class, conflicting sources, insufficient
  comparables). None of these codes are attempted to be misused for E69's
  purposes — new codes are proposed in Part 13.
- **No user-override architecture beyond what Part 2.1 lists.** Confirmed
  present, generic, and reusable — see Part 12. It is *not* cap-rate-specific
  or comparability-aware in any way (it just swaps a number), which is exactly
  the gap E69's override consumption needs to fill without touching the
  mechanism itself.

---

## 3. E69 Scope

**E69 owns:**
- Cap-rate benchmark **selection among comparable observations** (beyond E68's
  single-identity top-1 selection: reconciling several qualifying
  observations into one defensible answer or a structured refusal).
- Cap-rate **comparability** judgment (Part 4).
- Cap-rate **consensus analysis** (Part 6).
- Cap-rate **range analysis** (Part 7): point vs. range vs. percentile handling.
- Cap-rate **dispersion analysis**: quantifying and classifying disagreement
  among comparable observations.
- **Transaction-derived cap-rate calculation** (NOI / price) as an explicit,
  auditable function (Part 8) — not merely a shape to fill in by hand.
- Cap-rate **scenario analysis** where the underlying data supports it (Part 14).
- Cap-rate **confidence** as a two-dimensional model (Part 10).
- Cap-rate **benchmark explanation** — a human-readable account of why a
  result looks the way it does (methodology, exclusions, warnings).
- Cap-rate-specific **DATA_GAP interpretation** (Part 13/11).

**E69 does NOT own** (all remain exclusively E68 or out of scope entirely):
source ingestion; API clients/adapters (`ingestion/adapters/*`); the source
registry (`source-registry.ts`, `ingestion/public-source-registry.ts`);
general provenance infrastructure (`CRESource`, `CRECitation` themselves);
general freshness/lifecycle infrastructure (`freshness.ts`,
`observation-lifecycle.ts`, `source-health.ts` — E69 *reads* their outputs,
never redefines them); construction-cost calculations (`soft-cost.ts`,
construction-cost data files, `mapRlbSubtype`); property valuation;
investment underwriting; development feasibility; investment recommendations;
application UI (WeWeb or otherwise).

---

## 4. Architecture

```
                         ┌───────────────────────────────┐
                         │              E68               │
                         │  (frozen v1.0 data foundation)  │
                         │                                 │
                         │  CREObservation / CRECitation   │
                         │  CREDataStatus                  │
                         │  qualifyCapRateObservation()     │
                         │  assessFreshness()               │
                         │  CREPresentationFreshness         │
                         │  CREDataGap / CREDataGapReasonCode│
                         │  createUserOverride/resolveBenchmark│
                         └───────────────┬─────────────────┘
                                         │ read-only consumption
                                         ▼
                         ┌───────────────────────────────┐
                         │              E69                │
                         │      Commercial Cap Rate Engine │
                         │                                 │
                         │  1. Comparability filter          │
                         │  2. Data-confidence scoring        │
                         │     (wraps qualifyCapRateObservation)│
                         │  3. Transaction-derived calculator  │
                         │  4. Dispersion / consensus engine    │
                         │  5. Range/percentile reconciler       │
                         │  6. Benchmark confidence combiner      │
                         │  7. Scenario band generator (opt-in)    │
                         │  8. E69 gap classifier                   │
                         │  9. Override consumption (reads E68's    │
                         │     UserOverride/ResolvedBenchmark,        │
                         │     never mutates)                          │
                         │ 10. Output assembler → E69BenchmarkResult    │
                         └───────────────┬─────────────────────────────┘
                                         │
                                         ▼
                         ┌───────────────────────────────┐
                         │   InvestScape application layer  │
                         │   (Part 19 — future, out of scope)│
                         └───────────────────────────────┘
```

E69 is a **pure consumer**: it takes an in-memory pool of `CRECitedObservation`
(or equivalent read access to one, however E68 exposes it at build time — an
open question, Part 21) plus a request describing the desired benchmark, and
returns a self-contained result object. It never writes back into E68's data
layer, never mutates an observation, and never persists a "corrected" cap
rate over a source figure.

---

## 5. Data Model

E68's `CREObservation` already prevents collapsing a range into a fabricated
point (`rangeMidpoint()` is opt-in only) and already distinguishes
`value`-vs-`low`/`high`. E69 needs a **richer statistical-representation
type** on top of that, because a cap-rate figure a source publishes is not
always well described by "point or range":

```ts
// ILLUSTRATIVE — proposed, not implemented.

/** How a source actually expressed this figure. Never inferred; set from what
 *  the citation literally says. */
type CapRateRepresentation =
  | { kind: "point"; value: number }
  | { kind: "range"; low: number; high: number }
  | { kind: "median"; value: number; sampleSize?: number }
  | { kind: "average"; value: number; sampleSize?: number }
  | { kind: "percentile"; p25?: number; p50?: number; p75?: number; sampleSize?: number }
  | {
      kind: "transaction_derived";
      value: number;
      derivedFrom: CREDerivedTransaction; // reused from E68 types.ts verbatim
    }
  | {
      kind: "survey_estimate";
      value: number;
      surveyMethodologyNote?: string;
    };

/** Wraps exactly one CRECitedObservation. E69 never discards the original. */
interface E69CandidateObservation {
  observation: CRECitedObservation;      // verbatim, unmodified E68 record
  representation: CapRateRepresentation; // derived FROM observation, never replacing it
}
```

Rules enforced by this shape (mirroring E68's own discipline in
`types.ts`/`benchmark-types.ts`):
- `representation` is always derivable deterministically from `observation`
  (e.g. `value` present → `point`; `low`/`high` present → `range`); E69 never
  asks a human to classify representation independently of what the source
  record already contains.
- A `median`/`average`/`percentile` representation requires that the source
  publisher's methodology note actually says which statistic was reported —
  E69 must not guess that a `value` field is a "median" when the citation is
  silent. Where the citation doesn't disambiguate, representation defaults to
  `point` and a warning is attached, never a silent assumption of a stronger
  statistical claim than the source made.
- No representation ever collapses two representations into one number
  without an explicit, named methodology field carried on the output (Part 6/7).

---

## 6. Comparability Rules

Reuses E68's actual four-tier vocabulary (`mapping.ts`'s `MappingConfidence`:
`exact | close | approximate | unsupported`) rather than inventing a new one,
because that is the vocabulary the codebase — and its tests
(`benchmark-qualification.test.ts`) — already treat as meaningful.
Comparability in E69 is evaluated per-dimension, then combined by **floor**,
exactly as `qualifyCapRateObservation` already does for its own axes (never a
numeric average — Part 2.1's finding that E68 already rejected averaging here
is a deliberate design precedent E69 follows).

| Dimension | EXACT | CLOSE | APPROXIMATE | UNSUPPORTED |
|---|---|---|---|---|
| Asset type (`CREAssetClass`) | Identical | — (no valid narrowing exists; asset class is binary in E68 today, see `mapToLegacyCapRateKey`'s `default` case) | — | Different `assetClass` |
| Asset subtype (`propertySubtype`) | Identical string | Documented subtype family match (E69-defined; none exist in E68 today — new) | Plausible-but-undocumented similarity | No comparable subtype semantics |
| Property class (A/B/C/unspecified) | Identical | — | Adjacent class requested but only "unspecified" available, disclosed | Different explicit class (never A regarded as close to C) |
| Geography — country/metro/city | Identical `CREGeography.city` (+country) | — | Same metro, different city, disclosed | Different country/metro entirely |
| Downtown/suburban/infill (`CRELocationType`) | Identical | "urban" standing in for "cbd" (per `mapping.ts`'s own precedent: `approximate`, not `close`) | Same as prior column — E68 already treats this as approximate, not close; E69 does not upgrade it | Requested `cbd`, only `suburban` observation exists (or vice versa) |
| City/submarket | Identical `submarket` when both specify one | City match, no submarket specified by either | City match, submarket specified by request but not by observation | No city match |
| Effective period (`periodStart`/`periodEnd`) | Overlaps or equals requested period | Ends within trailing 12 months of request (reuses E68's `qualification.ts` threshold — see boundary flag, Part 2.2) | Ends 12–24 months prior | >24 months prior, or gap gated to a stale-only DATA_GAP (Part 13) |
| Publication date | N/A directly comparable — informs freshness (Part 9), not comparability | | | |
| Source methodology (`CRECapRateType`/`CAP_RATE_FAMILY`) | Identical `capRateType` | Same `CAP_RATE_FAMILY` (survey/transaction/derived) but different `capRateType` — **only if** the requester's identity did not pin an exact `capRateType` | Different family, disclosed with mandatory warning | Different family AND requester pinned a specific `capRateType` — never silently substituted (mirrors `consensus.ts`'s existing `assertComparableCapRates` hard rule) |

Overall comparability for a candidate = the floor across every dimension the
*request* actually constrains (mirroring `matchesIdentity`'s existing
"only filter on a dimension the request specifies" principle in
`benchmark-selection.ts` — an unspecified request dimension widens the pool,
it never causes a silent blend).

---

## 7. Source Hierarchy

E68 already establishes a partial hierarchy in prose
(`docs/e68-source-registry.md`'s ordering, and `qualification.ts`'s warning
that transaction methodology "ranks highest in E68's source hierarchy") but
never encodes it as an enforceable priority function. E69 must, because
consensus (Part 8) depends on it.

Priority order, highest to lowest (an E69-net-new ranking, informed by but not
identical to `CAP_RATE_FAMILY`'s three families and `paid-source-analysis.ts`'s
tiering of not-yet-licensed sources):

1. **Transaction-derived observations** (`capRateType: "transaction"` or
   E69's own `"transaction_derived"` representation, Part 8) — an actual
   closed transaction's arithmetic, when NOI is legitimately disclosed.
2. **Primary market surveys from major, broad-panel brokerages**
   (`sourceType: "brokerage"`, high `sourceQuality`, `CAP_RATE_FAMILY` = survey)
   — e.g. CBRE/JLL/Cushman & Wakefield national survey products.
3. **Specialist/regional brokerage research** — same family, narrower panel
   or geographic scope (e.g. Kidder Mathews, Matthews, Newmark regional notes
   already in `data/cap-rates-us.ts`).
4. **Secondary sources** republishing another provider's figures with
   disclosed `underlyingDataProvider` (`CRECitation.underlyingDataProvider`) —
   ranked by the *underlying* provider's tier, with a mandatory
   "republished, not primary" warning.
5. **E68-derived data** (`dataStatus: "derived"`, not a cap-rate transaction —
   e.g. an index-based extrapolation) — usable, but never dominant over any
   `observed` figure.
6. **Inferred/modelled data** (`dataStatus: "inferred"`) — usable only when
   explicitly requested and always downgrades benchmark confidence (Part 10);
   per E68's own policy stated in `types.ts`, E68 "prefers a data gap over an
   inferred value," and E69 inherits that preference — inferred data never
   silently outranks a disclosed DATA_GAP.

Rules for how a source **dominates / supports / is excluded / triggers
conflict / triggers DATA_GAP**:
- **Dominates**: highest-tier observation whose comparability floor (Part 6)
  is `exact` or `close`, and whose freshness (Part 9) is `live_current` or
  `recent`. It becomes the selected benchmark; lower-tier comparable
  observations are retained only as corroborating provenance, never blended
  in (this mirrors `selectCapRateBenchmark`'s existing top-1-plus-provenance
  behavior, generalized).
- **Supports**: a lower-tier or `approximate`-comparability observation whose
  value agrees with the dominant one within the dispersion tolerance
  (Part 8) — cited in the result's `methodology`/`provenance` as corroboration,
  never as an independent input to the number itself.
- **Excluded**: `unsupported` comparability, `dataStatus: "unsupported"`
  (which per E68's own `assertObservationStatus` must never exist as a stored
  observation in the first place — so in practice this means "filtered before
  it ever reaches E69's pool"), or a source currently `RETIRED`/
  `LICENSE_REVIEW` per `CRESourceHealthStatus` and no historical observation
  remains eligible.
- **Triggers conflict** (Part 8): two or more `exact`/`close`-comparability,
  same-tier, `live_current`/`recent` observations disagree beyond the
  dispersion tolerance. Never resolved by averaging across tiers; resolved
  per Part 8's methodology or surfaced as a structured low-confidence result.
- **Triggers DATA_GAP**: no observation clears `approximate` comparability at
  any tier, or all comparable observations fail freshness (Part 9's STALE-only
  case), or a single transaction-derived attempt lacks disclosed NOI (Part 8).

**Never arbitrarily averaged**: a transaction-derived cap rate is never
averaged with a survey estimate to produce a single number (this is the
purpose of `CAP_RATE_FAMILY`'s existing partition and
`assertComparableCapRates`'s hard guard, both reused directly) — even when
both are "comparable" by Part 6's geography/asset/class rules, they answer
different analytical questions and stay in separate consensus pools that the
output surfaces side-by-side rather than merges.

---

## 8. Consensus Methodology

Given a set of observations that clear Part 6 comparability and share a
`CAP_RATE_FAMILY` (survey / transaction / derived — never mixed, reusing
`assertComparableCapRates`):

1. **Identical values** (within a configurable epsilon, e.g. 1bp): trivial
   consensus, confidence maximized for the observation count, no dispersion
   warning.
2. **Small differences** (values cluster within a tolerance band — proposed
   default ±25bp for stabilized cap rates, itself an open design question,
   Part 21, since no such tolerance exists anywhere in E68 today): use a
   source-quality- and hierarchy-weighted combination (extends
   `consensus.ts`'s `weightedConsensus`, but re-weighted per Part 7's
   hierarchy rather than `sourceQuality` alone) to produce a single
   `weightedValue`, reporting the underlying spread (`low`/`high`) rather than
   hiding it.
3. **Large dispersion** (values exceed the tolerance band): **do not average.**
   Report the dispersion explicitly (min/max/spread, which observations anchor
   each end) and either (a) prefer the highest-hierarchy-tier subset if one
   tier clearly dominates in count and comparability, with the rest surfaced
   as "conflicting, lower priority," or (b) return a structured
   low-confidence/insufficient-consensus result rather than inventing a
   midpoint, when no tier dominates.
4. **Conflicting source methodologies**: never combined even if numerically
   close (a `going_in` and a `stabilized` cap rate at the same value are still
   not the same fact) — kept in separate consensus pools, both surfaced.
5. **Different publication/effective periods**: weighted toward recency using
   E68's own `periodEnd` and `CREPresentationFreshness` (Part 9); an
   observation that is `stale` or `historical` per E68's freshness model
   never outweighs a `live_current`/`recent` one in the same pool regardless
   of source tier, though it may still be shown as corroborating history.
6. **Different asset classes/geographies**: excluded entirely at the
   comparability stage (Part 6) — never reach consensus at all.
7. **Stale observations**: included only as historical context (Part 9);
   never contribute to the *current* consensus value; a pool containing only
   stale/historical observations produces a `STALE_ONLY` gap (Part 13), not a
   consensus value labeled as current.
8. **Arithmetic mean is never assumed correct** — it is one candidate
   methodology among the above, used only in the "small differences,
   comparable hierarchy tier" case, and every consensus result must name its
   actual methodology (Part 13's `methodology` field) rather than silently
   default to a mean.
9. **When consensus cannot be responsibly established**: return a structured
   DATA_GAP (extending `CREDataGap`/`CREDataGapReasonCode`, Part 13) or an
   `E69BenchmarkResult` with `confidence: "insufficient"` — never a fabricated
   benchmark. This is the single hardest rule in this document and the one
   most directly extending E68's own stated philosophy ("prefer a data gap
   over an inferred value," `types.ts`).

---

## 9. Range Methodology

- A **point value** the source published stays a point; E69 never manufactures
  a range around it.
- A **range** (`low`/`high`) the source published stays a range; E69 never
  collapses it to a single number without an explicit, opt-in, clearly
  labeled derivation (reusing `deriveMidpoint`'s existing discipline:
  `provenance: "e68_derived"`-equivalent, `sourceSupplied: false`-equivalent —
  Part 5's `CapRateRepresentation` type carries this forward).
- **Percentiles** (25th/50th/75th), when a source actually publishes them, are
  preserved as percentiles — never silently treated as a low/high range or a
  mean, since a P25–P75 band is a different statistical claim than a
  publisher-stated low/high range and conflating them would misstate the
  source's own methodology.
- If E69 **derives** a range from multiple point observations (e.g. reporting
  "$4.75%–5.25%, derived from N observations, method: min/max across
  qualifying comparable observations as of [date]"), that derived range is
  classified explicitly `DERIVED` (parallel to `ValueProvenance`'s
  `"e68_derived"`) with the methodology string preserved in the output
  (Part 13's `methodology` field) — it is never presented indistinguishably
  from a range one publisher actually printed.

---

## 10. Confidence Model

E69 defines **two independent axes**, deliberately not collapsed into one
score (mirroring E68's own no-numeric-score principle from
`qualification.ts`):

**Data Confidence** — how much to trust the underlying observation(s) on
their own terms, largely inherited from E68:
- Base input: `qualifyCapRateObservation`'s `confidence`/`baseConfidence`
  (mapping fidelity), `sourceQualityTier`, `methodologyFamily`.
- Modifiers: `CREPresentationFreshness` (Part 9) downgrades data confidence as
  it moves from `live_current` toward `stale`/`unavailable`; `CRESourceHealthStatus`
  (`DEGRADED`/`TEMPORARILY_UNAVAILABLE`/`LICENSE_REVIEW`) on the backing
  source downgrades it further even if the stored observation itself is
  unaffected (per `source-health.ts`'s own stated principle that source
  health must never invalidate an already-validated observation — E69 treats
  it as a confidence signal, never as a reason to discard the observation).

**Benchmark Confidence** — how well the *selected/reconciled* result actually
answers *this specific request*, independent of how good any one input
observation is:
- Driven by Part 6 comparability floor, Part 8 dispersion/conflict outcome,
  and observation count (a single well-matched observation is lower benchmark
  confidence than five agreeing ones, even if all six are individually
  `exact`/`high` data confidence).
- A perfectly reliable `exact`-comparability single observation still yields
  only moderate benchmark confidence if it is the sole comparable observation
  in existence (no corroboration) — this is the case the task explicitly
  calls out ("a perfectly comparable observation may have lower source
  confidence" and its converse), and it is why the two axes are not merged.

**Combining the two dimensions** (proposed model, not implemented):
Represent both as ordinal tiers (`high | medium | low | insufficient`, not a
numeric score, consistent with E68's stated preference against scores) and
report **both**, plus a combined presentation tier computed as the floor of
the two — never their average — so a high-data/low-benchmark-confidence
result cannot be mistaken for an all-around strong answer. The output
contract (Part 13) surfaces `dataConfidence` and `benchmarkConfidence` as
separate fields plus a derived `overallConfidence` floor field, so a consumer
that only wants one number still gets a defensible one, but nothing is hidden
from a consumer that wants the full picture.

---

## 11. Freshness Handling

E69 does not re-derive currency; it consumes E68's Phase 8 outputs directly:
- `CREPresentationFreshness` (`live_current | recent | historical | stale | unavailable`)
  from `ingestion/observation-lifecycle.ts`, computed per-observation via
  `assessFreshness` in `ingestion/freshness.ts`.
- These are the **verified actual names** in the code — this document does
  not use `live_current`/`recent`/`historical`/`stale`/`unavailable` as
  approximations of some other vocabulary; they are copied verbatim.

Rules:
- A `historical` cap rate **remains a valid fact about its own period** and is
  never deleted or hidden; it simply cannot silently become the answer to
  "what is the current benchmark." E69's output (Part 13) carries a top-level
  `freshness` field for the selected/consensus result, and any `historical`
  or `stale` observation included only as corroboration is labeled as such in
  `observationsExcluded`/`provenance`, never folded into the "current"
  headline value.
- A request that only has `historical`/`stale` comparable observations
  available produces a result whose `freshness` is `historical`/`stale` and
  whose `benchmarkConfidence` is capped low — it does not get silently
  presented as `live_current` just because it is the best available.
- `unavailable` (source currently unreachable) never invalidates a previously
  retrieved observation's own freshness classification at the time it was
  retrieved; it only prevents newer data from superseding it, per
  `source-health.ts`'s stated non-goal.

---

## 12. User Overrides

**E68 already has a user-override architecture.** This was verified by
reading the code, not assumed:
- `src/cre-intelligence/user-override.ts` — `createUserOverride(...)` and
  `resolveBenchmark(e68, override)`.
- `src/cre-intelligence/benchmark-types.ts` — `UserOverride` and
  `ResolvedBenchmark` types.

It records `overrideValue`, `overrideReason`, `overrideTimestamp`,
`originalE68Value`, and `originalE68Identity`, and `resolveBenchmark` never
mutates the underlying `CREBenchmarkResponse` — it returns a new
`ResolvedBenchmark` with `active: "override" | "e68" | "application_default"`
and both values retained.

**What it does not do**: it is generic to any `CREBenchmarkResponse`, with no
cap-rate-specific semantics, no awareness of E69's comparability/consensus
machinery, and no audit trail beyond a single timestamp+reason pair (no
history of prior overrides, no linkage to *which specific* E69 result — as
opposed to a bare `BenchmarkIdentity` — was being overridden).

**Proposed E69 consumption** (net-new, built on top of, not replacing, the
existing mechanism):
```ts
// ILLUSTRATIVE — proposed, not implemented.
interface E69ResolvedBenchmark {
  active: "e69" | "override" | "insufficient_data";
  e69Result?: E69BenchmarkResult;         // Part 13 — the full reconciled result, retained
  override?: UserOverride;                // reused verbatim from E68's benchmark-types.ts
  // Extension E68's UserOverride does not carry today:
  overrideAuditTrail?: {
    supersededOverride?: UserOverride;    // the previous override, if this one replaces it
    appliedBy?: string;                   // proposed — E68 has no user-identity concept at all today
  };
}
```
E69 calls E68's existing `resolveBenchmark`-equivalent logic conceptually
(or a cap-rate-typed sibling of it, since `resolveBenchmark` is typed against
`CREBenchmarkResponse`, not the richer `E69BenchmarkResult` this document
proposes in Part 13 — reconciling those two types is an open question, Part 21)
rather than reimplementing override precedence. It never mutates
`e69Result`, `e69Result.observationsUsed`, or any `CREObservation`.

If overriding a *scenario band* (Part 14) rather than a single benchmark
value is ever required, that is explicitly new ground — E68's `UserOverride`
shape assumes one scalar `overrideValue`, not a banded structure — and is
called out as an open question (Part 21) rather than silently extended here.

---

## 13. Output Contract

```ts
// ILLUSTRATIVE — proposed, not implemented. Deliberately modeled as a
// superset of E68's CREBenchmarkResponse (benchmark-types.ts) rather than a
// parallel, competing shape.

interface E69BenchmarkRequest {
  market: CREGeography;                    // reused from types.ts
  assetClass: CREAssetClass;                // reused
  propertySubtype?: string;
  propertyClass?: CREPropertyClass;         // reused
  locationType?: CRELocationType;           // reused
  capRateType?: CRECapRateType;             // reused — pinning this narrows comparability (Part 6)
  effectivePeriod?: { start: string; end: string };
  asOf?: string;                            // for freshness evaluation, defaults to "now"
}

type E69GapReasonCode =
  | CREDataGapReasonCode                    // E68's 8 codes, reused verbatim where applicable
  | "NO_OBSERVATION"
  | "WRONG_ASSET_CLASS"
  | "WRONG_GEOGRAPHY"
  | "WRONG_PROPERTY_CLASS"
  | "STALE_ONLY"
  | "CONFLICTING_SOURCES"
  | "INSUFFICIENT_COMPARABLES"
  | "SOURCE_QUALITY_INSUFFICIENT"
  | "TRANSACTION_NOI_UNAVAILABLE";

interface E69BenchmarkResult {
  request: E69BenchmarkRequest;
  status: "AVAILABLE" | "AVAILABLE_WITH_WARNING" | "DATA_GAP" | "INSUFFICIENT_CONFIDENCE";

  selectedCapRate?: CapRateRepresentation;   // Part 5 — point/range/median/average/percentile/transaction
  range?: { low: number; high: number; methodology: string }; // present only when legitimately available or DERIVED (Part 7/9)

  dataConfidence?: "high" | "medium" | "low";
  benchmarkConfidence?: "high" | "medium" | "low" | "insufficient";
  overallConfidence?: "high" | "medium" | "low" | "insufficient"; // floor of the two, never an average

  qualification?: MappingConfidence;         // reused from mapping.ts — exact/close/approximate/unsupported
  dataStatus?: CREDataStatus;                // reused from types.ts — observed/derived/inferred/unsupported
  freshness?: CREPresentationFreshness;      // reused from observation-lifecycle.ts

  observationsUsed: BenchmarkProvenanceEntry[];      // reused shape from benchmark-types.ts
  observationsExcluded: Array<BenchmarkProvenanceEntry & { exclusionReason: string }>;

  methodology: string;                        // human-readable account of how the result was reached
  warnings: string[];

  dataGap?: {
    reasonCode: E69GapReasonCode;
    reason: string;
    sourcesInvestigated: string[];
    lastResearchDate: string;
  };

  scenario?: E69ScenarioBand;                 // Part 14 — present only when explicitly requested and supportable
}
```

---

## 14. Scenario Analysis

**Should E69 support Conservative/Base/Aggressive scenarios? Yes, but only
where the underlying dispersion genuinely supports it, never as arbitrary
offsets.**

```ts
// ILLUSTRATIVE — proposed, not implemented.
interface E69ScenarioBand {
  conservative: { value: number; percentile?: number; methodology: string };
  base: { value: number; percentile?: number; methodology: string };
  aggressive: { value: number; percentile?: number; methodology: string };
  derivedFromObservationCount: number;
  methodology: string; // e.g. "P25/P50/P75 of N qualifying observations, [date]"
}
```

Rules:
- Scenario values are derived **only** from the actual dispersion of the
  qualifying observation pool (Part 8) — e.g. base = consensus value/median,
  conservative = a real lower percentile of the pool (for cap rates,
  "conservative" for an investor means the *higher* cap rate / lower value
  assumption — this directional convention must be stated explicitly in the
  methodology string, not left implicit), aggressive = the corresponding
  upper/lower percentile in the other direction.
- **Never** an arbitrary fixed offset (e.g. "±25bp from base") applied without
  traceability to real observations — that would be exactly the fabrication
  failure mode E68's `assertObservationStatus`/`dataStatus` machinery exists
  to prevent, applied to a new surface.
- If the qualifying pool has too few observations to support a meaningful
  percentile split (an open design question is where that threshold sits —
  Part 21), E69 must omit `scenario` entirely and say why, rather than
  produce a band from 2–3 points that implies more statistical grounding than
  exists.
- Every scenario band's `methodology` field names the actual observation
  count and percentile method used, so an override or audit can trace exactly
  how each of the three numbers was reached.

---

## 15. E68/E69 Boundary

Responsibility matrix, corrected against the actual code (not the task's
illustrative example, which this document does not copy uncritically):

| Responsibility | Owner | Evidence |
|---|---|---|
| Source registry, adapters, ingestion | E68 | `source-registry.ts`, `ingestion/adapters/*`, `ingestion/public-source-registry.ts` |
| Raw observation storage + provenance shape | E68 | `types.ts` (`CREObservation`, `CRESource`, `CRECitation`) |
| Data honesty axis (observed/derived/inferred/unsupported) | E68 | `types.ts` (`CREDataStatus`) — E69 *sets* this field on outputs it derives (e.g. transaction cap rates) using E68's vocabulary, but does not own the taxonomy |
| Per-observation qualification (classification fit, currency cap, methodology warning) | E68, with two flagged cap-rate-domain judgments inside it (Part 2.2) | `qualification.ts` |
| Legacy-vocabulary classification mapping | E68 | `mapping.ts` |
| Single-identity deterministic top-1 selection | **Currently E68**, flagged as a boundary concern (Part 2.2) — a plausible future migration target, not moved here | `benchmark-selection.ts` |
| Weighted mean / simple range consensus | E68 (as a narrow primitive) | `consensus.ts` |
| Multi-observation reconciliation, dispersion/conflict analysis, hierarchy-aware weighting | **E69, new** | none exists in E68 |
| Cap-rate comparability tiers (exact/close/approximate/unsupported applied to a *request*, not just a stored observation's classification) | **E69, new**, reusing E68's `MappingConfidence` vocabulary | `mapping.ts` supplies the vocabulary; no request-vs-observation matching logic beyond `benchmark-selection.ts`'s identity filter exists |
| Transaction-derived cap-rate *calculation* | **E69, new** | `CREDerivedTransaction` (E68) is a shape only; no calculator exists anywhere in E68 |
| Percentile/median/average representation types | **E69, new** | `CREObservation` has no percentile field |
| Scenario bands | **E69, new** | nothing in E68 |
| Freshness computation | E68 | `ingestion/freshness.ts` |
| Freshness *consumption for benchmark currency decisions* | E69 | new — E69 decides what freshness implies for "is this the current benchmark," E68 only classifies the observation |
| Lifecycle status / fingerprinting / corrections | E68 | `ingestion/observation-lifecycle.ts` |
| Source health monitoring | E68 | `ingestion/source-health.ts` |
| Paid-source classification metadata | E68 (Phase 6, metadata-only, no values) | `paid-source-analysis.ts` |
| General DATA_GAP structure + 8 ingestion-level reason codes | E68 | `types.ts`, `ingestion/gap-reasons.ts` |
| Cap-rate-specific gap reasons (wrong asset class, conflicting sources, insufficient comparables, NOI unavailable, etc.) | **E69, new**, extending E68's enum | Part 13 |
| User-override mechanism (record + resolve precedence) | E68 | `user-override.ts`, `benchmark-types.ts` |
| Override *consumption in a cap-rate-benchmark-specific context* (audit trail extensions, scenario overrides) | **E69, new** | Part 12 |
| Construction cost, soft cost | E68 (and out of E69 scope entirely) | `soft-cost.ts`, `data/construction-costs-us.ts` |
| Application/UI presentation | Neither — future InvestScape application layer | Part 19 |

---

## 16. Test Strategy

Proposed E69 test matrix (mirroring the rigor of E68's own
`benchmark-qualification.test.ts`'s adversarial style):

| # | Scenario | Expected behavior |
|---|---|---|
| 1 | No data at all for requested identity | `DATA_GAP`, `reasonCode: NO_OBSERVATION` |
| 2 | Exact match, single observation | `AVAILABLE`, `qualification: exact`, benchmark confidence reflects single-observation caveat |
| 3 | Close match (documented narrowing) | `AVAILABLE_WITH_WARNING` or `AVAILABLE` per Part 6, warning names the narrowing |
| 4 | Approximate match | `AVAILABLE_WITH_WARNING`, mandatory disclosure warning, never silently presented as standard |
| 5 | Unsupported match | `DATA_GAP`, never forced into a benchmark |
| 6 | Conflicting sources, same tier, large dispersion | `DATA_GAP` or `INSUFFICIENT_CONFIDENCE` with `reasonCode: CONFLICTING_SOURCES`, dispersion reported, never averaged |
| 7 | Stale data only | `freshness: stale`/`historical`, `reasonCode: STALE_ONLY` if used as the sole basis, capped confidence |
| 8 | Multiple periods available | Recency-weighted per Part 8 point 5; historical retained as corroboration only |
| 9 | Range observations (low/high, no point) | `CapRateRepresentation.kind === "range"`, never collapsed to a point without explicit `DerivedValue`-equivalent |
| 10 | Transaction-derived observations present | Ranked per Part 7 priority 1; `dataStatus: "derived"` propagated |
| 11 | Missing NOI on an attempted transaction derivation | Calculation refused, `reasonCode: TRANSACTION_NOI_UNAVAILABLE`, never estimated |
| 12 | Duplicate observations (same fingerprint per `observationFingerprint`) | De-duplicated before consensus, not double-counted as corroboration |
| 13 | User override present | `active: "override"`, original E69 result retained per Part 12, no mutation of underlying observations |
| 14 | Source-quality downgrade (e.g. `sourceQuality < 80`, or `CRESourceHealthStatus: DEGRADED`) | Data confidence downgraded per Part 10; observation not excluded outright unless comparability also fails |
| 15 | Wrong asset class | Excluded at comparability stage (Part 6), `DATA_GAP`/`reasonCode: WRONG_ASSET_CLASS` if it was the only candidate |
| 16 | Wrong geography | Same pattern, `reasonCode: WRONG_GEOGRAPHY` |
| 17 | Wrong property class | Same pattern, `reasonCode: WRONG_PROPERTY_CLASS` |
| 18 | Insufficient comparables for scenario banding | `scenario` omitted, reason stated in `methodology`/`warnings`, not fabricated from too few points |
| 19 | Mixed `CAP_RATE_FAMILY` in one raw candidate pool | Split into separate pools per `assertComparableCapRates`'s existing guard; never merged |
| 20 | Adversarial: single high-source-quality observation of the *wrong* asset class | Must still resolve `unsupported`/excluded regardless of how strong the rest of its metadata is (mirrors E68's own adversarial test precedent in `benchmark-qualification.test.ts`) |

---

## 17. Future InvestScape Integration

Out of scope to implement now; the eventual contract (independent of WeWeb,
per the task's instruction) is expected to be a thin request/response API
wrapping `E69BenchmarkRequest`/`E69BenchmarkResult` (Part 13) plus the
override flow (Part 12):

```ts
// ILLUSTRATIVE — proposed, not implemented, and not WeWeb-specific.
interface CapRateBenchmarkApi {
  getBenchmark(request: E69BenchmarkRequest): Promise<E69BenchmarkResult>;
  getResolvedBenchmark(request: E69BenchmarkRequest, override?: UserOverride): Promise<E69ResolvedBenchmark>;
  getScenario(request: E69BenchmarkRequest): Promise<E69ScenarioBand | { unavailable: true; reason: string }>;
}
```
This layer would be responsible for translating an application's own request
shape (e.g. whatever the legacy `CAP_RATE_BENCHMARKS`/`DEV_BUILDING_SUBTYPES`
vocabulary WeWeb currently uses — noted in `mapping.ts` as living outside this
workspace entirely) into `E69BenchmarkRequest`, and is explicitly deferred,
consistent with how E68 deferred its own Phase 5 "application mapping" work
from Phase 4C.

---

## 18. Known Limitations

- E69 as specified here inherits E68's own stated non-goals: no invented cap
  rate ever ships, no interpolated missing value, no averaged incompatible
  concept.
- The comparability/consensus tolerance thresholds proposed in Parts 6 and 8
  (e.g. ±25bp dispersion band, 12/24-month currency cliffs reused from
  `qualification.ts`) are **not derived from any documented industry
  methodology** in this codebase — they are illustrative defaults requiring
  real design sign-off before implementation (see Part 21).
- E69's percentile/median/average `CapRateRepresentation` (Part 5) depends on
  source citations actually disclosing which statistic was reported; today's
  E68 observation data (`data/cap-rates-us.ts`, `data/cap-rates-ca.ts`) does
  not appear (on inspection) to carry that distinction explicitly beyond
  point-vs-range, so most existing observations would default to `point` or
  `range` representation until citation data is enriched — this is a data
  quality dependency, not an E69 code gap.
- No sample-size field beyond an already-optional `sampleSize` on
  `CREObservation` exists to weight dispersion statistically; E69's dispersion
  analysis (Part 8) can only weight by source hierarchy and freshness, not by
  underlying survey sample size, unless that field is populated.

---

## 19. Open Design Questions

1. Should E69 extend `qualifyCapRateObservation`'s existing currency
   thresholds (≤12/12–24/>24 months) directly by calling it, or maintain an
   independently versioned cap-rate-benchmark threshold set that starts
   identical but can diverge (Part 2.2 flags the underlying function itself
   as a boundary concern for a future migration decision — this question is
   about *dependency*, not about moving code)?
2. What dispersion tolerance (Part 6/8) actually reflects real CRE market
   practice for "small difference" vs. "large dispersion" per asset class?
   This document's ±25bp default is illustrative only.
3. Should `selectCapRateBenchmark` (`benchmark-selection.ts`) eventually move
   into E69 wholesale, given its own header comment already treats matching-
   a-specific-request-to-an-observation as deferred, analytical work? This
   document deliberately does not decide that; it only flags it (Part 2.2).
4. How does `E69BenchmarkResult` (Part 13) relate long-term to E68's existing
   `CREBenchmarkResponse` (`benchmark-types.ts`) — should E69 wrap/extend it,
   or fully replace it as the application-facing shape? This spec treats them
   as parallel/superset today to avoid touching E68, but that likely needs
   consolidation before a real application integration (Part 17).
5. What minimum observation count justifies scenario banding (Part 14)? No
   statistical floor is proposed here beyond "must be traceable."
6. How should E69 consume a live, mutable E68 observation pool at runtime —
   direct in-process import of E68's data modules, a query interface E68 does
   not yet expose, or a snapshot/batch model? E68's `data/*.ts` files are
   currently static arrays, not a queryable store; this affects how "as of"
   freshness evaluation (Part 9, `assessFreshness`'s `asOf` parameter) is
   wired in practice.
7. Should E69's user-override audit trail (Part 12) require a real user
   identity concept, which does not exist anywhere in E68 today (no user
   model was found in any reviewed file)?
8. Is a percentile-based `CapRateRepresentation` (Part 5) actually achievable
   given current citation data, or does it require an E68 data-enrichment
   effort (out of E69's own scope) before it can be populated for any real
   observation?

---

## 20. Recommended E69 Implementation Phases

1. **Phase 1 (this document)** — specification only. No code.
2. **Phase 2 — Comparability & data-confidence core.** Implement Part 6's
   comparability rules and Part 10's data-confidence wrapper around
   `qualifyCapRateObservation`, with no consensus/scenario logic yet — pure
   filtering and per-observation scoring against a fixed E68 observation pool.
3. **Phase 3 — Consensus & dispersion engine.** Implement Part 8's
   reconciliation logic (hierarchy-weighted combination, dispersion
   classification, conflict detection) on top of Phase 2's filtered pool.
4. **Phase 4 — Transaction-derived cap-rate calculator.** Implement the
   auditable NOI/price function (Part 8 of the task spec / Part 7 hierarchy
   tier 1 above), enforcing E68's `assertObservationStatus`/`dataStatus`
   discipline and the "never estimate NOI" rule as a hard function
   precondition, not a convention.
5. **Phase 5 — Range/percentile representation & output contract.**
   Implement Part 5's `CapRateRepresentation` types and Part 13's
   `E69BenchmarkResult` assembly, wiring together Phases 2–4's outputs into
   one coherent result object per request.
6. **Phase 6 — Freshness/lifecycle integration & gap taxonomy.** Wire in
   `assessFreshness`/`CREPresentationFreshness` (Part 9/11) and implement the
   E69-specific gap reason codes (Part 13) end to end, including the
   `STALE_ONLY` and `INSUFFICIENT_COMPARABLES` paths.
7. **Phase 7 — Scenario analysis.** Implement Part 14's percentile-band
   scenario generator, gated behind the minimum-observation-count question
   from Part 21 being resolved.
8. **Phase 8 — Override consumption & audit extension.** Build E69's
   consumption of E68's existing `createUserOverride`/`resolveBenchmark`
   (Part 12), including whatever audit-trail extension the open question
   there resolves to.
9. **Phase 9 — Test suite hardening.** Implement the full Part 16 matrix,
   including adversarial cases mirroring E68's own
   `benchmark-qualification.test.ts` style, before any application
   integration work begins.
10. **Phase 10 (future, separate engine)** — InvestScape application-facing
    API (Part 19), explicitly out of scope for E69 Phase 1–9.

---

*End of E69 Phase 1 Technical Specification. No E68 file was modified to
produce this document. No implementation code accompanies it.*

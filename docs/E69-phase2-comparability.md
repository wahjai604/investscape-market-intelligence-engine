# E69 Phase 2 — Cap-Rate Comparability Layer

Status: **IMPLEMENTED.** Scope is exactly Phase 2 of
`docs/E69-phase1-technical-specification.md` Part 20: comparability
classification and per-observation inclusion/exclusion. No consensus,
dispersion, transaction-derivation, scenario, or application-integration code
is included — those remain future phases.

Code lives under `src/cap-rate-engine/` (a new top-level sibling to
`src/cre-intelligence/`, not inside it), with tests under
`__tests__/cap-rate-engine/`. **No file under `src/cre-intelligence/` was
modified.** E69 imports E68 types and constants directly from their existing
source files (`../cre-intelligence/types`,
`../cre-intelligence/ingestion/observation-lifecycle`,
`../cre-intelligence/mapping`) — no new export was added to E68's `index.ts`
or any other E68 file.

## 1. Purpose

Given a requested cap-rate benchmark identity and a pool of E68
`CRECitedObservation`s, determine, per observation:

- how closely it matches the request (EXACT / CLOSE / APPROXIMATE /
  UNSUPPORTED),
- why, on a per-dimension basis,
- whether it should be INCLUDED or EXCLUDED from further (future) analysis,
  with a machine-readable reason code when excluded,
- a deterministic, human-presentable audit explanation.

This is the "qualified comparable observation set" the Phase 1 spec calls
Phase 2's deliverable — nothing more.

## 2. Inputs

- `E69ComparabilityRequest` (`src/cap-rate-engine/comparability-types.ts`):
  `geography` (`CREGeography`, reused from E68), `locationType`, `assetClass`,
  `propertySubtype`, `propertyClass`, `capRateType` (all reused E68 types),
  plus E69-native `effectivePeriod`, `minFreshness`, `asOf`. Every field
  except `geography.country` (via `CREGeography`) and `assetClass` is
  optional; an unspecified field widens the pool on that axis rather than
  narrowing or guessing.
- `E69CandidateInput`: one `CRECitedObservation` (verbatim, unmodified) plus
  an optional precomputed `freshness: CREPresentationFreshness`. E69 never
  recomputes freshness — see Section 14.

## 3. Outputs

- `evaluateCandidate(request, input)` → `E69ComparabilityCandidate`: the
  observation (verbatim), overall `comparability`, all eight
  `dimensions`, `decision` (`INCLUDED`/`EXCLUDED`), `exclusionReasonCode`
  (when excluded), `explanation`, and `warnings`.
- `evaluateComparability(request, pool)` → `E69ComparabilityResult`: every
  candidate evaluated, plus `included`/`excluded` splits. Never throws on an
  empty pool; never silently drops a candidate from `candidates`.

## 4. Comparability dimensions

Eight dimensions are evaluated and exposed on every candidate, whether or not
the request constrains them (`not_constrained` when it doesn't):

`geographyMatch`, `geographyTypeMatch`, `assetMatch`, `subtypeMatch`,
`classMatch`, `periodMatch`, `freshnessMatch`, `representationMatch`.

Overall `comparability` is the **floor** across every dimension the request
actually constrains — never an average, never a majority vote. This mirrors
`qualification.ts`'s `qualifyCapRateObservation` combination discipline
exactly.

## 5. Geography rules

`evaluateGeography` in `comparability.ts`. Country mismatch is always
`unsupported`. When the request pins a `submarket`, only an identical
submarket is `exact`; a matching city with no stated submarket is
`approximate` (never auto-promoted to exact submarket), and a different
stated submarket is `unsupported`. When the request pins a `city`, an exact
city match is `exact`; same metro/different city is `approximate`; a
different city with no shared metro is `unsupported`. A country-only request
is `exact` once country matches (that is as granular as was asked for).

## 6. Asset rules

`evaluateAssetClass`: identical `CREAssetClass` is `exact`; anything else is
`unsupported` — asset class has no valid narrowing in E68 today (per
`mapToLegacyCapRateKey`'s own `default` case), so there is no `close`/
`approximate` tier for this dimension.

`evaluateSubtype`: identical `propertySubtype` string is `exact`; the
observation stating no subtype is `approximate` (plausible but undocumented);
a different stated subtype is `unsupported`, because no subtype-family
mapping exists anywhere in E68 today (the Phase 1 spec explicitly flags this
as new, unbuilt territory) — inventing one here would be exactly the
fabricated-mapping failure mode this project exists to prevent.

## 7. Class rules

`evaluatePropertyClass`: identical class is `exact`; the observation's class
`unspecified` is `approximate` (never assumed to be Class B or any other
grade); an explicitly different stated class (A vs B, A vs C, B vs C) is
always `unsupported` — Class A is never treated as close to Class C.

## 8. Period rules

`evaluatePeriod`: an overlapping period is `exact`. A non-overlapping period
whose end is within a trailing 12 months of the requested period's end is
`close`; 12–24 months prior is `approximate`; over 24 months prior (or the
observation's period lying entirely after the requested period) is
`unsupported`. These thresholds intentionally start identical to
`qualification.ts`'s `periodConfidence` cliffs (≤12/12–24/>24 months) but are
an **independently maintained E69 threshold set**, not a call into E68's
function — this resolves Open Design Question 1 of the Phase 1 spec in favor
of independence, so a future E69-specific change to these cliffs cannot
silently alter E68's own qualification behavior or vice versa.

## 9. Freshness rules

`evaluateFreshness` consumes `CREPresentationFreshness` verbatim
(`live_current | recent | historical | stale | unavailable`) and never
recomputes it. Mapping: `live_current` → `exact`, `recent` → `close`,
`stale`/`historical` → `approximate` (both are legitimate, undeleted facts,
merely capped below exact/close for a *current* benchmark), `unavailable` →
`unsupported` on this dimension alone. Crucially, **staleness alone never
excludes a candidate** — `unsupported` freshness participates in the overall
floor like any other dimension would, but a `stale`/`historical` observation
never reaches `unsupported` on this axis, so it cannot be excluded by
freshness alone unless the request explicitly pins `minFreshness`. When
`minFreshness` is set and unmet, the candidate is excluded with reason `STALE`
(or `UNAVAILABLE` if the backing source is unavailable) — this is the one
hard freshness gate in Phase 2. An observation with no supplied `freshness`
is treated as `approximate` ("not assessed"), never assumed current.

## 10. Representation rules

`evaluateRepresentation` operates on `CRECapRateType`/`CAP_RATE_FAMILY`
(reused verbatim from `types.ts`). Only relevant when the request pins a
`capRateType` — otherwise `not_constrained` (an unpinned request never forces
a methodology check, matching `benchmark-selection.ts`'s "only filter on a
specified dimension" principle). When pinned: identical type is `exact`; same
family but a different concept (e.g. requested `stabilized`, observed
`going_in`) is `approximate` and carries a mandatory warning that the two
concepts must never be averaged together; a different family, or an
observation with no stated `capRateType` at all, is `unsupported` — mirroring
`consensus.ts`'s `assertComparableCapRates` hard guard against silently
substituting one cap-rate concept for another.

Cap-rate values themselves (`value` vs `low`/`high`) are never converted to a
common scalar in this phase — the original `CREObservation` is carried
through unmodified on every candidate.

## 11. Inclusion/exclusion rules

A candidate is `EXCLUDED` when any of:

1. **Insufficient provenance** — required citation/source fields
   (`sourceName`, `reportTitle`, `publicationDate`, `sourceUrl`,
   `retrievedAt`, `source.sourceId`) are missing or empty. Checked first,
   before any dimension is even consulted, because an untraceable observation
   must never back a benchmark regardless of how well its other fields match.
2. **Freshness gate** — the request pins `minFreshness` and the candidate's
   assessed freshness ranks below it (`STALE` or `UNAVAILABLE`).
3. **Overall comparability is `unsupported`** — the specific reason code is
   picked from the first `unsupported` dimension in a fixed priority order
   (asset → subtype → geography → geography type → class → representation →
   period → freshness), so the reason always names the actual disqualifying
   fact.

Reason vocabulary (`E69ExclusionReasonCode`): `WRONG_ASSET_TYPE`,
`WRONG_ASSET_SUBTYPE`, `WRONG_GEOGRAPHY`, `WRONG_GEOGRAPHY_TYPE`,
`WRONG_PROPERTY_CLASS`, `STALE`, `UNSUPPORTED_MAPPING`,
`INCOMPATIBLE_REPRESENTATION`, `INSUFFICIENT_PROVENANCE`, `UNAVAILABLE`,
`OTHER`. These are net-new to E69 — E68's `CREDataGapReasonCode` describes a
*source's* inability to publish something at ingestion time, never "this
observation doesn't fit this specific request," so reusing it here would
misuse its vocabulary rather than extend it.

Everything else — `exact`/`close`/`approximate` comparability — is
`INCLUDED`. Phase 2 deliberately does not gate on comparability tier beyond
`unsupported`; deciding whether an `approximate` candidate should actually
count toward a benchmark is Phase 3's (consensus) job, not this layer's.

## 12. Qualification logic

Comparability reuses `mapping.ts`'s `MappingConfidence` (`exact | close |
approximate | unsupported`) verbatim rather than inventing a parallel
four-tier vocabulary, per the Phase 1 spec's explicit finding that this is
"the actual, only E68 qualification vocabulary." Dimensions combine strictly
by floor (`combineDimensions` in `comparability.ts`), so one disqualifying
axis cannot be outweighed by several strong ones — proven adversarially in
tests (Section 15).

## 13. Audit explanation

`buildExplanation` produces one deterministic string per candidate:

- `INCLUDED (comparability=<tier>): dim=<level>, dim=<level>, ...` — lists
  every dimension the request actually constrained and its resulting tier.
- `EXCLUDED (<REASON_CODE>): dim=unsupported (<reason text>); ...` — lists
  every dimension that resolved `unsupported`, each with its own generated
  reason text.

The same string is deterministic for the same inputs (no randomness, no
wall-clock dependency beyond what the caller passes in via `asOf`/period
fields), suitable as-is for a future UI or for a written audit log.

## 14. E68 dependencies

Reused directly, read-only, with no E68 file modified:

| E68 source | What E69 Phase 2 reuses |
|---|---|
| `cre-intelligence/types.ts` | `CRECitedObservation`, `CREGeography`, `CREAssetClass`, `CREPropertyClass`, `CRELocationType`, `CRECapRateType`, `CAP_RATE_FAMILY` |
| `cre-intelligence/mapping.ts` | `MappingConfidence` (the exact/close/approximate/unsupported vocabulary) |
| `cre-intelligence/ingestion/observation-lifecycle.ts` | `CREPresentationFreshness` (type only; E69 never calls `assessFreshness` itself, it consumes an already-computed value) |

E69 does not import `qualification.ts`, `benchmark-selection.ts`,
`consensus.ts`, `user-override.ts`, `benchmark-types.ts`,
`legacy-migration.ts`, `soft-cost.ts`, or `source-registry.ts` in this phase —
none of Phase 2's scope needs them, and importing them preemptively would
blur the boundary this phase is trying to hold.

## 15. Known limitations

- **Freshness must be supplied, not derived.** E69 has no access to a
  source's `CRERefreshCadence`/lifecycle record from a bare
  `CRECitedObservation` alone (that metadata lives in E68's separate
  Phase 8 lifecycle records, keyed by fingerprint, not stored on the
  observation itself). A caller that does not pass `freshness` gets the
  honest, conservative `approximate` treatment rather than a fabricated
  recency claim — but this means Phase 2 cannot, on its own, tell "genuinely
  unassessed" apart from "assessed and happens to be `historical`" without
  the caller doing that assessment first via E68's `assessFreshness`.
- **Period thresholds (12/24 months) are illustrative,** carried over from
  `qualification.ts` starting values per the Phase 1 spec's own caveat (Part
  18) that no documented industry methodology backs this specific cliff in
  this codebase. They are independently versioned in this file specifically
  so a future change here does not perturb E68.
- **No subtype-family mapping exists.** Any non-identical, non-empty
  `propertySubtype` is `unsupported` today; a documented family table (the
  Phase 1 spec's proposed `close` tier for subtypes) is future work and must
  not be guessed at in the meantime.
- **`representationMatch` only evaluates `CRECapRateType`/`CAP_RATE_FAMILY`.**
  The richer `CapRateRepresentation` type (point/range/median/average/
  percentile/transaction-derived/survey-estimate) proposed in Part 5 of the
  Phase 1 spec is explicitly out of scope for Phase 2 (it is Phase 5's
  deliverable) — today's `CREObservation` only actually carries point/range
  data in practice, so building the richer type now would be speculative.
- **Geography rules treat `region` as informational only** (not compared);
  no observation in the current E68 dataset needs region-level
  disambiguation, and adding an unused comparison would be untested,
  unexercised code.

## 16. Future consensus requirements

Phase 3 (consensus/dispersion) will need, from this layer, exactly what it
already exposes and nothing this layer should be asked to grow into:

- The `included` candidate list (never the raw pool) as its starting point,
  since exclusion has already removed `unsupported`/gated candidates.
- Per-dimension detail (not just the floor) so consensus can weight or filter
  further — e.g. preferring `close`-period-but-`exact`-everything-else
  observations over the reverse, which the floor alone cannot express.
- `comparability` tier and `warnings` to drive Phase 3's `benchmarkConfidence`
  axis (Part 10 of the Phase 1 spec) without recomputing anything here.
- A still-open decision (Phase 1 spec, Open Design Question 2): what
  numeric dispersion tolerance separates "small difference" from "large
  dispersion" once actual cap-rate values enter the picture — Phase 2
  deliberately never looks at `value`/`low`/`high` at all, so this remains
  entirely Phase 3's decision to make.
- Whether `CAP_RATE_FAMILY`-mixed candidate pools (survey vs transaction vs
  derived, all individually `INCLUDED` here because Phase 2 does not group by
  family) should be split into separate pools before or during Phase 3's own
  processing — Phase 2 exposes `representationMatch`/the observation's own
  `capRateType` precisely so Phase 3 can make that split without
  re-deriving it.

# E68 Phase 8 — Production Monitoring, Refresh & Data Lifecycle

© 2026 Lighthouse Research Ltd. This is the final major E68 implementation phase. It builds on
Phases 1–7 (source registry, normalization, qualification, public-source ingestion pipeline) and
does not modify any Phase 1–7 numeric data or commit history.

## Architecture

```
Source Adapter attempt
  -> CREIngestionEvent (ingestion-events.ts)         [always recorded, success or failure]
  -> CRESourceRefreshState transition (source-health.ts)  [health/cadence/last-attempt state]
  -> on success: CREObservation / EconomicIndicatorObservation
       -> observationFingerprint (observation-lifecycle.ts)  [identity, never retrievedAt]
       -> CREObservationLifecycleRecord (retrieved -> validated -> active -> superseded/archived)
  -> on failure: CREDataGap (existing Phase 7 model) and/or ingestion event with an
     error-taxonomy.ts code
  -> assessFreshness (freshness.ts) at READ time, for presentation only
  -> buildMonitoringSummary (monitoring.ts) aggregates all of the above
```

All Phase 8 modules live under `src/cre-intelligence/ingestion/` and are pure functions/types —
no network I/O, no timers, no persistence layer. They define contracts a future scheduler and a
future frontend can build on.

## Source lifecycle — IMPLEMENTED NOW

`source-health.ts` defines `CRESourceHealthStatus`: `ACTIVE`, `DEGRADED`,
`TEMPORARILY_UNAVAILABLE`, `SCHEMA_CHANGED`, `LICENSE_REVIEW`, `REQUIRES_CONFIGURATION`,
`RETIRED`. `CRESourceRefreshState` tracks this plus cadence, last attempted/successful retrieval,
next expected refresh, source URL, adapter id, auth/configuration requirements, and historical
backfill capability. `recordRetrievalAttempt` is the only mutator, and it is pure/functional —
callers decide storage. Critically, **no function in this module accepts or touches a
`CREObservation`**, so a health-status change can never reach into and invalidate previously
stored data (Part 3 non-invalidation guarantee, tested in
`phase8-lifecycle-and-freshness.test.ts`).

## Observation lifecycle — IMPLEMENTED NOW

`observation-lifecycle.ts` defines `CREObservationLifecycleStatus`: `retrieved`, `validated`,
`active`, `superseded`, `archived`. This is tracked in a separate
`CREObservationLifecycleRecord` keyed by `fingerprint`, rather than by adding fields to
`CREObservation` itself — see "Known limitations" below for why, and what remains.
`superseded`/`archived` records are never deleted; only `status` changes, and `active` observations
never disappear when a newer period's data arrives (they become `superseded` for their OWN
identity, not overwritten).

## Publication date vs. effective period vs. retrieval date — IMPLEMENTED NOW

`assertDateRoleIntegrity` (and its `CREObservation`/`EconomicIndicatorObservation` wrappers)
enforces:
- `periodEnd >= periodStart`
- `publicationDate` cannot precede `periodStart` (with the one legitimate same-day exception)
- `retrievedAt` cannot precede `publicationDate`

These three checks directly target the proven Phase 4C RLB publication-date transcription error
and its two mirror-image failure modes (retrieval date substituted for publication date; effective
period confused with publication date). All three are covered by dedicated tests.

## Freshness / staleness model — IMPLEMENTED NOW

`freshness.ts`'s `assessFreshness` classifies an observation as `live_current`, `recent`,
`historical`, `stale`, or `unavailable`, using `CRERefreshCadence` (`realtime`, `daily`, `weekly`,
`monthly`, `quarterly`, `semiannual`, `annual`, `irregular`, `unknown`) declared per-source. There
is **no hard-coded universal staleness window**: `unknown`/`irregular` cadence can only ever
resolve to `historical`, never `live_current` or `stale`, because there is no stated cadence to
measure against. The day-count bands (1x/3x/8x the cadence's own period) are a presentation
policy documented here, not a claim from any publisher.

## Stale ≠ false, historical ≠ current — IMPLEMENTED NOW

`assessFreshness` never mutates or discards an observation — it only returns a presentation label.
A `stale` result's `reason` explicitly says "Historical value preserved; not current for
current-market use," never "invalid." `unavailable` presentation is used specifically when a
source is currently unreachable, so a cached last-known value is never mislabeled as
`live_current` merely because it is the newest value E68 has (Part 16).

## Refresh scheduling metadata — IMPLEMENTED NOW (contract only; ARCHITECTURALLY READY for a scheduler)

`CRESourceRefreshState` carries every field Part 8 asks for: cadence, last successful/attempted
retrieval, next expected refresh, source URL, adapter id, auth requirement, configuration
requirement, historical backfill capability, health. No cron/scheduler is implemented — per Part
21, that is explicitly out of scope for this phase.

## Ingestion events — IMPLEMENTED NOW

`ingestion-events.ts`'s `CREIngestionEvent` records source, adapter, attempt timestamp,
success/partial/failure, records retrieved/accepted/rejected, an optional structured error code,
schema-change/license-restriction flags, and redacted diagnostic detail. `assertNoSilentDataLoss`
enforces `recordsAccepted + recordsRejected === recordsRetrieved` — a structural guarantee against
the "records quietly vanish between retrieval and storage" failure mode. `redactDiagnostic` strips
`api_key=`/`token=`/`Bearer ...`-shaped substrings from any diagnostic text before it is treated as
storable (defense in depth; adapters must still never put a secret into a message).

## Error taxonomy — IMPLEMENTED NOW

`SourceAdapterErrorCode` (Phase 7, `ingestion/types.ts`) is extended additively with
`AUTHENTICATION_ERROR`, `AUTHORIZATION_ERROR`, `SOURCE_UNAVAILABLE`, `INVALID_RESPONSE`,
`LICENSE_RESTRICTION`, `CONFIGURATION_ERROR`, `EMPTY_RESULT`, `UNKNOWN_ERROR`, alongside the
existing `NETWORK_ERROR`, `RATE_LIMITED`, `SCHEMA_CHANGED`, `VALIDATION_FAILED`,
`GEOGRAPHY_NOT_COVERED`, `NOT_FOUND`. This is a union-widening change only: every Phase 7 adapter
and test still compiles and passes unchanged (verified: full suite green, `tsc --noEmit` clean).
`error-taxonomy.ts` provides labels, `classifyThrown` (never returns undefined — defaults to
`UNKNOWN_ERROR` rather than losing an unrecognized exception), and `isTransientError`.

## Schema-change detection — IMPLEMENTED NOW (lightweight contract) / ARCHITECTURALLY READY for full per-adapter wiring

`schema-guard.ts`'s `assertShape` checks a raw record against a small declarative
`{field: type}` descriptor and throws `SourceAdapterError("SCHEMA_CHANGED", ...)` the instant a
field is missing or mistyped — proven against the exact example in the spec
(`{city,value,period}` renamed to `{market,benchmark,effectiveDate}`). The three Phase 7 adapters
(FRED, StatCan, Census) already implement equivalent inline checks in their own `parse()` methods
(unchanged in this phase, still passing their existing tests); `assertShape` is the reusable,
testable primitive future adapters (and a future hardening pass of the existing three) can share
instead of re-deriving the same logic per adapter. Wiring `assertShape` directly into the three
existing adapters was deliberately deferred to avoid touching Phase 7's committed, tested adapter
code in a phase that must not modify that commit's behavior.

## Duplicate protection — IMPLEMENTED NOW

`observationFingerprint` builds an identity from `sourceId + metric/indicator + geography +
periodStart + periodEnd + publicationDate` — never from `retrievedAt`. Retrieving RLB's Q2 2026
figure on Sept 10 and again on Sept 20 produces the identical fingerprint (tested). A genuine
source correction (same period, new `publicationDate`) intentionally produces a *different*
fingerprint, which is how Part 13's correction chain is distinguished from Part 12's duplicate
suppression: a correction is a new identity linked backward via
`CREObservationLifecycleRecord.correction`, not a silently-merged duplicate.

## Historical preservation & immutability — IMPLEMENTED NOW (metadata contract) / FUTURE WORK (storage enforcement)

`CREObservationLifecycleRecord.correction` records `{correctedByFingerprint, reason, detectedAt}`
on the ORIGINAL record, and the original's `status` becomes `superseded` — never deleted, never
mutated in place. **Known limitation**: E68 has no persistent observation store yet (Phases 1–7
are in-memory/data-file based); this phase defines the metadata shape a store must honor, but
cannot itself prove no code path ever calls `Array.prototype.splice` on a historical data file.
The remaining requirement is: when a real datastore is introduced, all writes to
`CREObservation`/`EconomicIndicatorObservation` rows must be append-only, and a "correction" write
must go through a code path that sets `correction` on the prior record rather than performing an
UPDATE on its value fields.

## Source versioning — IMPLEMENTED NOW (field) / FUTURE WORK (population)

`CREObservationLifecycleRecord.sourceVersion` holds a source-reported dataset/report version or
vintage when the source exposes one (e.g. "ACS 2024 5-Year Estimates"). None of the three Phase 7
adapters currently populate it (FRED/StatCan series and Census ACS vintages were not modeled with
an explicit version field in Phase 7); wiring it per-adapter is future work.

## Monitoring / health summary — IMPLEMENTED NOW

`monitoring.ts`'s `buildMonitoringSummary` is a typed, pure function returning
`CREMonitoringSummary`: source counts by health status, observation counts by lifecycle status,
ingestion success/partial/failure counts (plus schema-change-suspected and license-restriction
sub-counts), and data-gap counts by `reasonCode`. It is directly consumable by future application
code (a typed object, not a rendered report) — see the "monitoring summary" test for a worked
example with every category populated.

## Public/paid source inventory review (Part 18)

Reviewed the 16-entry `CRE_PUBLIC_SOURCE_REGISTRY` (Phase 7) and the paid-source profiles
(`paid-source-analysis.ts`, Phase 4A/6). For every entry, Phase 8's `createInitialRefreshState`
can be populated from existing fields (`updateFrequency` -> `CRERefreshCadence`, `url` ->
`sourceUrl`, `authRequirement`, `refresh.historicalBackfillPossible` ->
`historicalBackfillCapable`) **except** health, which starts `ACTIVE` only for the three sources
with implemented adapters (fred-api, statcan-wds, us-census-api) and should start
`REQUIRES_CONFIGURATION` (no adapter/credentials wired) for the remaining 13 until an adapter is
built — this phase does not fabricate an `ACTIVE` status for a source E68 has never actually
called. Paid sources (MSCI RCA, CoStar, Altus, RealPage) have no adapters and no public API
credentials in this project; their correct Phase 8 health is `REQUIRES_CONFIGURATION` combined
with `LICENSE_REVIEW` semantics — Phase 8 does not force a single-value model to represent both
simultaneously; a future scheduler should treat any source lacking `legallyIncorporable === true`
as ineligible for `ACTIVE` regardless of technical connectivity. No adapter, credential, or
scheduler entries were fabricated for any of these sources — they are `UNKNOWN`/unpopulated by
design.

## Testing (Part 17)

`__tests__/cre-intelligence/ingestion/phase8-lifecycle-and-freshness.test.ts` (31 tests) covers:
API unavailable / source resumes service, malformed shape / changed schema / missing field /
wrong-typed field, duplicate observation vs. genuine correction, repeated retrieval producing one
fingerprint, stale observation (labeled historical, not invalid), invalid publication date,
invalid effective period, retrieval date substituted for publication date, effective period
confused with publication date, empty response, authentication/configuration failure, rate
limiting, and a full monitoring-summary aggregation. Explicit assertions prove FAILURE ≠ DATA
DELETION (`assertNoSilentDataLoss`), STALE ≠ INVALID (freshness `reason` text and presentation
value), and HISTORICAL ≠ CURRENT (`presentation` enum separates the two). All pre-existing
Phase 1–7 tests continue to pass unmodified (352/352 total suite, up from 321 before this phase).

## Known limitations

- No persistent observation datastore exists yet; lifecycle/fingerprint records are a contract,
  not yet wired to an actual append-only store (see "Historical preservation" above).
- `assertShape` schema-guard is not yet wired into the three existing Phase 7 adapters' `parse()`
  methods (they already fail safe on their own, inline checks); a future pass should route them
  through the shared primitive for consistency and to gain the shape-descriptor contract.
- `sourceVersion` is defined but not populated by any adapter yet.
- Freshness day-count bands (1x/3x/8x cadence period) are a first, reasonable, explicitly-labeled
  policy choice, not derived from any publisher's own definition of "current" — a product decision
  should confirm or tune these bands before user-facing use.
- 13 of 16 public-source registry entries have no adapter; their Phase 8 refresh state would start
  `REQUIRES_CONFIGURATION`, not `ACTIVE`, until one is built.

## Requirements for an eventual production scheduler

- Persist `CRESourceRefreshState` per source and call `recordRetrievalAttempt` after every real
  attempt.
- Compute `nextExpectedRefreshAt` from `cadence` + `lastSuccessfulRetrievalAt` (left as `undefined`
  today for `irregular`/`unknown` cadence — must remain so).
- Route every real adapter invocation through `recordIngestionEvent`, and call
  `assertNoSilentDataLoss` on every event before persisting it.
- Persist `CREObservationLifecycleRecord`s keyed by `observationFingerprint`; a new retrieval that
  matches an existing fingerprint is a no-op duplicate (fingerprint already includes
  `publicationDate`, so a genuine correction — a new `publicationDate` for the same period — by
  definition produces a NEW fingerprint). The scheduler's job on a correction is only to link the
  new record back to the prior one via `correction`, never to decide whether it's a duplicate.
- Enforce append-only writes at the storage layer per "Historical preservation" above.

## Requirements for eventual frontend integration

- Never render an observation's raw `value` without first calling `assessFreshness` and showing
  its `presentation` label; `unavailable`/`stale`/`historical` must be visually distinct from
  `live_current`.
- Surface `CREMonitoringSummary` on an internal ops/status view, not to end users, since it exposes
  operational detail (error counts, schema-change suspicion) rather than market data.
- Any UI offering "as of" language must use the observation's `citation.publicationDate` /
  `periodEnd`, never `citation.retrievedAt`, to describe what the number represents.

## E68 scope freeze

E68 owns **data**: source discovery/classification, source adapters, acquisition, provenance,
normalization, validation, qualification, observed/derived/inferred/unsupported status, data-gap
management, historical preservation, source health, refresh metadata, monitoring, staleness
detection, and ingestion-failure handling, for commercial real estate and CRE-adjacent public
data.

E68 explicitly does **not** own: property valuation, investment underwriting, development
feasibility, construction-cost calculation as a specialized engine, cap-rate calculation as a
specialized engine, or investment recommendations. Those are the responsibility of future,
separately-numbered engines (e.g. a future Commercial Cap Rate Engine, a future Commercial
Construction Cost Engine) that would consume E68's `CREObservation`/`EconomicIndicatorObservation`
data as an input. No such engine is created in this phase; this document states the boundary only,
per Part 22 of the Phase 8 specification.

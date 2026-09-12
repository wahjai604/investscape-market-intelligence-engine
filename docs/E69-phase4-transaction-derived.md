# E69 Phase 4 — Transaction-Derived Cap Rate Calculation

© 2026 Lighthouse Research Ltd. All rights reserved.

Implementation: `src/cap-rate-engine/transaction-types.ts`, `src/cap-rate-engine/transaction-derivation.ts`.
Tests: `__tests__/cap-rate-engine/transaction-derivation.test.ts`.

## 1. Purpose

Phase 4 calculates a defensible cap rate (`NOI / purchase price`) ONLY from a
single real transaction's explicitly disclosed financial figures. It is
deliberately more conservative than dividing two numbers: it validates price
type, NOI definition, NOI period, currency, and provenance before performing
any arithmetic, and returns an explicit `DATA_GAP` — never a guessed or
partially-inferred value — whenever any of those checks fails. It does not
estimate, interpolate, or aggregate; those remain out of scope (see §16, §18)
or belong to earlier/later phases (Phase 2 comparability, Phase 3 consensus).

## 2. Transaction input model

`CRETransactionInput` (transaction-types.ts) carries: `transactionId`,
`propertyName`, `geography` (E68's `CREGeography`), `assetClass`,
`propertySubtype`, `propertyClass`, `locationType`, `transactionDate`, a
`Disclosed<{amount, currency, priceType}>` price, a
`Disclosed<{amount, currency, definition, period}>` NOI, an optional
publisher-stated `publisherCapRate`, an optional `fx` conversion contract, and
`provenance` (source, report, publicationDate, transactionDate, locator,
sourceUrl, transactionId, retrievedAt).

Every financial/definitional field uses `Disclosed<T>`
(`KNOWN | UNKNOWN | NOT_DISCLOSED | NOT_APPLICABLE`) rather than a bare
optional, so "the source never publishes this" (`NOT_APPLICABLE`), "the
source discloses it but we don't have it" (`UNKNOWN`), and "the source
explicitly declines to state it" (`NOT_DISCLOSED`) all stay distinguishable —
and none of the three is ever treated as zero.

## 3. Purchase-price validation

`CREPriceType` distinguishes `confirmed_sale_price`, `reported_sale_price`
(both usable), and `asking_price`, `listing_price`, `assessed_value`,
`estimated_value` (all explicitly UNUSABLE). `USABLE_PRICE_TYPES` is the sole
gate; `deriveTransactionCapRate` rejects any other price type with reason
code `NON_TRANSACTION_PRICE`, regardless of how reputable the source
otherwise is. Price must additionally be `> 0` or the transaction is
rejected with `INVALID_TRANSACTION_VALUES`.

## 4. NOI definitions

`CRENoiDefinition` distinguishes `actual_trailing`, `actual_forward`,
`stabilized`, `estimated`, `seller_reported`, `broker_reported`,
`source_derived`, and `not_disclosed`. `NOI_DEFINITION_QUALITY` maps each to
an explicit `CRENoiQuality` (`ACTUAL | REPORTED | ESTIMATED | STABILIZED |
UNKNOWN`) that is never collapsed into a single generic confidence score and
is carried through to `audit.noi.quality` and to `derivedFrom.methodology`.
`not_disclosed` always produces `DATA_GAP` (`NOI_DEFINITION_MISSING`) — an
NOI amount without a stated definition can never be labeled or trusted.

## 5. NOI period handling

`CRENoiPeriod` supports `annual`, `trailing_12_month`, `forward_12_month`,
`quarterly`, `monthly`. `NOI_ANNUALIZATION_FACTOR` maps quarterly→×4,
monthly→×12, and the other three→×1. Every annualization (or its absence) is
recorded as an explicit, labeled entry in `audit.transformations` — never a
silent multiplication. A missing/absent period produces `DATA_GAP`
(`NOI_PERIOD_MISSING`).

## 6. Currency rules

`CRECurrency = "USD" | "CAD" | "OTHER"`. `OTHER` on either price or NOI is an
unconditional `DATA_GAP` (`CURRENCY_UNKNOWN`) — an ambiguous currency is never
assumed to match. A price/NOI currency mismatch requires an explicit,
matching `CREFxConversion` (`fromCurrency`, `toCurrency`, `rate`, `rateDate`,
`rateSource`); Phase 4 implements only this contract, never a real FX
mechanism or a fabricated rate. Any mismatch without a valid, matching
conversion is `DATA_GAP` (`CURRENCY_MISMATCH`). A valid conversion is applied
and the exact transformation (raw amount, rate, source, date, converted
amount) is recorded in `audit.transformations`.

## 7. Calculation

`capRate = annualizedNoi / purchasePrice`, computed as one full-precision
floating-point division with **no intermediate rounding**: currency
conversion and annualization happen first (each recorded), then the division
happens once against the raw, unrounded operands. `displayValue` is
formatted only at presentation time (`toFixed(2)` + `%`). Verified
reproducible: NOI=$1,200,000 / Price=$20,000,000 → `capRate === 0.06` exactly
(bit-for-bit `toBe` assertion in the test suite) and `displayValue ===
"6.00%"`. A dedicated test also checks an "odd numbers" case
(NOI=987,654 / Price=17,333,333) asserts `capRate` equals the literal JS
division result — proving no rounding was introduced anywhere in the path.

## 8. Validation

`deriveTransactionCapRate` validates, in order: provenance completeness →
price disclosure/type/positivity → NOI disclosure/definition/period/
positivity → currency → (conversion) → annualization → positivity of the
annualized NOI. Any zero or negative price/NOI (before or after conversion/
annualization) is rejected with `INVALID_TRANSACTION_VALUES`; values are
never silently "corrected" (e.g. via `Math.abs`).

## 9. Publisher cap-rate reconciliation

When `CRETransactionInput.publisherCapRate` is present, the publisher's
figure and E69's own `capRate` are both retained (`observation.capRateType`
carries the publisher's stated type; `capRate`/`displayValue` carry E69's
math) and `audit.reconciliation` records: `publisherCapRate`,
`publisherCapRateType`, `derivedCapRate`, `differenceBps`
(`capRateDifferenceBps`, deterministic), a `tier`
(`negligible|notable|material`, via `classifyReconciliationTier` and the
explicitly PROVISIONAL `DEFAULT_RECONCILIATION_POLICY` = `{negligibleBps: 10,
notableBps: 30}`, same spirit as Phase 3's `DispersionPolicy` — not
empirically calibrated), and a narrative that presents both figures without
declaring either "correct." Neither figure ever overwrites the other.

## 10. Provenance

Every successful derivation carries, via `CRETransactionAudit`/
`CREDerivedTransaction`: `source`, `report`/`publicationDate`,
`transactionDate`, `locator`, `sourceUrl`, `transactionId`, raw
`purchasePrice`, raw `noi` (post-conversion/annualization, with the raw
pre-transformation figures visible in `transformations`), `noi.definition`,
`currency`, `calculation` (the exact formula string), and `calculatedAt`
(injectable via `options.now` for deterministic tests; documentation-only,
never affects `capRate`). `CREDerivedTransaction` (E68's own type) is reused
verbatim, not reimplemented.

## 11. Comparability

`toE69CandidateInput()` converts a successful `CRETransactionDerivedObservation`
into exactly the `E69CandidateInput` shape Phase 2's `evaluateCandidate`/
`evaluateComparability` already consume, wrapping a full, valid
`CRECitedObservation` with `capRateType: "derived_transaction"` (E68's own
"computed by E68 as NOI/price" vocabulary — see `CAP_RATE_FAMILY`) and
`dataStatus: "derived"` (satisfying E68's `assertObservationStatus` contract,
since `derivedFrom` is always populated). Geography, assetClass, subtype,
class, and locationType are carried through from the original
`CRETransactionInput` verbatim — no dimension is fabricated to make the
shape fit. This lets a transaction-derived observation flow through Phase 2's
existing dimensions and, from there, into Phase 3's `buildCapRateBenchmark`
unmodified (see §15 and the integration tests in
`transaction-derivation.test.ts`, section 13).

## 12. DATA_GAP behavior

Reason codes (`CRETransactionGapReasonCode`): `TRANSACTION_PRICE_MISSING`,
`NOI_MISSING`, `NOI_DEFINITION_MISSING`, `NOI_PERIOD_MISSING`,
`CURRENCY_MISMATCH`, `CURRENCY_UNKNOWN`, `NON_TRANSACTION_PRICE`,
`INSUFFICIENT_TRANSACTION_PROVENANCE`, `INVALID_TRANSACTION_VALUES`,
`UNSUPPORTED_NOI_METHOD` (reserved for a future methodology outside
`CRENoiDefinition`'s closed vocabulary — the type system currently makes this
unreachable, which is itself the intended guard), `OTHER`. Every gap includes
`transactionId` and a human-readable `explanation`. These codes are
deliberately distinct from E68's `CREDataGapReasonCode` (source-publication
gaps) and Phase 2/3's own gap vocabularies (comparability/benchmark gaps) —
Phase 4's codes describe why ONE transaction's calculation itself could not
be performed.

## 13. Audit trail

`CRETransactionAudit` answers every question the spec requires: property
(`propertyName`), transaction (`transactionId`), source (`source`), price
(`purchasePrice`), NOI (`noi` incl. `quality`), NOI definition/period (on
`noi`), currency (`currency`), calculation (`calculation`), cap-rate type
(`capRateType`, publisher's if stated), publication (`publicationDate`),
locator (`locator`), assumptions (`assumptions`, e.g. "no expenses were
estimated"), and transformations (`transformations`, e.g. annualization or
FX, or explicitly "No annualization required").

## 14. Batch processing

`deriveTransactionCapRateBatch()` maps `deriveTransactionCapRate` over an
array; each transaction's `SUCCESS`/`DATA_GAP` is fully independent (proved
by the "one valid + one invalid" test) and no aggregation, averaging, or
consensus happens across the batch — that remains Phase 3's job, reachable
only by feeding individual `toE69CandidateInput()` outputs through Phase
2/3's own contracts.

## 15. Phase 3 integration

A transaction-derived observation integrates through the EXISTING contracts:
`toE69CandidateInput()` → `evaluateComparability()` (Phase 2, unmodified) →
`buildCapRateBenchmark()` (Phase 3, unmodified). No parallel benchmark engine
was written. This was verified end-to-end in the test suite (§13 above) and
required zero changes to `comparability.ts`/`benchmark-consensus.ts` — `git
diff --stat` against both is empty.

One integration limitation, documented rather than silently patched: Phase 3
groups strictly by exact `capRateType`
(`byType.get(request.capRateType)`), and `toE69CandidateInput` always emits
`capRateType: "derived_transaction"`. This means a transaction-derived
observation will only be pooled by Phase 3 alongside OTHER
`derived_transaction` observations (or alone, in a `single_observation`
benchmark) — it is never pooled with a `stabilized`/`going_in`/etc. survey
observation, even when a request pins one of those types, because Phase 3's
`assertComparableCapRates`-style guard (mirrored from `consensus.ts`)
correctly treats `derived_transaction` and (e.g.) `going_in` as different
families that must never be averaged. This is the intended, conservative
behavior per the spec ("never overwrite/blend the publisher's figure with a
derived one") and requires no change to Phase 3 semantics — but it does mean
a caller who wants a mixed survey+transaction benchmark must request
`capRateType: "derived_transaction"` explicitly (or leave it unpinned with
only transaction-derived candidates present) rather than expecting automatic
pooling. No Phase 3 change was made to work around this.

## 16. Known limitations

- No guessed-expense-ratio pathway exists anywhere in this phase (explicit
  scope exclusion, not an oversight).
- `CREFxConversion` is a contract only; no real FX rate source is wired in.
- `UNSUPPORTED_NOI_METHOD` is defined but currently unreachable, because the
  typed `CRENoiDefinition` union prevents constructing an "unsupported
  method" input in the first place — a future phase accepting looser/raw
  source data (e.g. free-text NOI methodology strings) would need an
  explicit classifier that can route into this code.
- Phase 4 does not assess `CREPresentationFreshness` for a transaction-derived
  observation; a caller must attach freshness (per Phase 2's own documented
  hard dependency on Phase 8's `assessFreshness`) before passing the
  candidate into `evaluateComparability`.
- As documented in §15, a transaction-derived observation and a survey
  observation are never pooled together by Phase 3, by design.

## 17. Future transaction-data sources

Not built in this phase (no scraping, no paid-source access, no API
credentials, per the quality rules): direct feeds from CoStar/Real Capital
Analytics/MSCI, county recorder deed-transfer records, or licensed brokerage
transaction databases. `CRETransactionInput.provenance.source` is a free-text
field today specifically so a future adapter can populate it from any of
these without a schema change.

## 18. Future NOI construction capabilities

Explicitly out of scope for Phase 4 and left for a clearly-labeled future
phase: constructing NOI from gross income minus a documented (not assumed)
operating-expense schedule, when a source publishes both line items
separately; occupancy-adjusted stabilization models; and a documented,
opt-in "modeled NOI" data status distinct from `observed`/`derived` (E68's
`inferred`/`unsupported` statuses already reserve room for this, but no
modeled-NOI construction code exists anywhere in this phase).

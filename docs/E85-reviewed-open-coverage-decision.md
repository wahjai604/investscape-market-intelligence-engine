# E85 decision record: reviewed-open coverage (O0 adopted; O1–O3 unapproved)

Status: **O0 adopted: only `CLOSED` intervals apply. O1–O3 are unapproved
(O1 is rejected); no reviewed-open coverage is approved or implemented.** This
record changes no production selection logic, opens no release gate and
enables no route. Its §8 contract clarification and §9 A guard tests are
applied; §9 B is not written. The pack stays `NOT_RELEASED` with
`asOfResolution: DISABLED`, and `AMENDMENT_INDEX_RECAPTURE` stays open.

Baseline: engine `22e891e`, evidence `f7a2cca`.

## 1. Problem

The engine applies a legal version only when three conditions hold at once:
- the version's validity is `CLOSED`;
- the designation correspondence is `IDENTITY_CORRESPONDENCE_ESTABLISHED`;
- the coincidence is `BOTH_CLOSED_APPLICABLE` (`decision-temporal-application.ts`).

A version or designation that is still in force has no end, so it can never
be `CLOSED`. Without a policy for "open, but reviewed", no present-day AS_OF
can ever be answered. The coincidence module already reports
`MIXED_CLOSED_AND_OPEN_END_APPLICABLE` and `BOTH_OPEN_END_APPLICABLE`, but
nothing accepts them.

This record decides what, if anything, may count an open-ended interval as
covering an AS_OF date.

## 2. Two separate requirements

A decision needs both of the following. Neither can stand in for the other.

| | Legal-version coverage | Parcel-designation coverage |
|---|---|---|
| Question | Was *this text* (source + version) the law on D? | Did *this location* carry *this district* on D? |
| Object | `E85VersionValidity` of a registered consolidation | `E85DesignationValidity` of a spatial feature |
| Start authority | Commencement of the latest incorporated instrument, and that the reprint includes it | A rezoning or designating instrument for the location |
| End review | Amendment index captures, plus instrument checks | Rezoning instruments. The layer's role (City Q6) is context, not proof of start or continuity |
| Today, R1-1 | `START_UNKNOWN` (City Q2) | `OPEN_UNRESEARCHED`, observation only (layer 2026-06-29) |
| Today, C-2C | `OPEN_REVIEWED_NO_END_ESTABLISHED` from 2026-05-19 (14697) | `OPEN_UNRESEARCHED`, observation only (layer 2026-06-29) |

**A layer observation is not a designation start.** It shows the label on
2026-06-29 (City processing date, time zone unstated). It does not show when
the label began, or that the layer is legally authoritative.

## 3. The evidence the end review rests on

- **Capture:** the City amendment index was printed to PDF by a person using a
  browser at **2026-09-28 11:29:51 PDT (18:29:51Z)**.
  - The time comes from the printed page header and the PDF `CreationDate`.
  - Raw-byte SHA-256: `3481f17b…1b01`.
  - The review was performed on 2026-09-28, and is recorded separately with a
    line-ending-normalized pin (`523dd99c…`).
- **What it shows:** as of that instant, the City's summary page listed no
  Zoning and Development By-law amendment touching R1-1 after 14747, or
  C-2C after 14697.
- **What it does not show:**
  - anything after 11:29 PDT;
  - the whole of 2026-09-28;
  - by-laws enacted but not yet listed (listing lag is unknown);
  - anything the summary omits.

## 4. Policy dimensions and options

| Dimension | Options | Conservative choice |
|---|---|---|
| **Granularity** | (a) date; (b) instant | **Date.** AS_OF is date-only in the public contract, and by-law commencement is by day. |
| **Boundary** | (a) the capture date, inclusive; (b) the day before the capture date; (c) the capture instant, if AS_OF were an instant; (d) the day before the capture date minus a listing-lag margin L | **None yet.** (d) needs L, and L has no defensible source (§4a). (b) assumes every amendment is listed the same day it is enacted. So no boundary is approved, and no date is covered. |
| **Time zone** | (a) UTC; (b) America/Vancouver | **America/Vancouver.** By-laws take effect on Vancouver calendar days. 18:29Z is still 2026-09-28 locally. |
| **Inclusion rule** | D is covered iff `effectiveFrom ≤ D ≤ coverageBound` | Closed on both ends, over whole local days. The bound is a date the capture fully postdates. |
| **Source authority** | (a) the index alone; (b) the index plus a date- and subject-based search of the authoritative by-law register (P5) | **(b)**, if the register's authority and currency are established. The index is a City summary, not the enactment record. |
| **Identity** | Coverage attaches to `(jurisdictionId, sourceId, sourceVersionId)` plus the capture SHA-256 | It must equal the selected bundle's identity, and is never inherited across versions or districts. |
| **Recapture** | A new capture replaces the bound only after an entry-level diff shows no new entry touching the district | Any new touching entry voids coverage for that version until validity is recomputed (§7). |
| **Stale evidence** | The bound never moves on its own, so AS_OF dates after it stay uncovered. A pack whose newest capture is older than a maximum age A at promotion is refused. | Enforce A at promotion through `AMENDMENT_INDEX_RECAPTURE`, not at request time. |

**Options for the whole policy:**
- **O0 (status quo, ADOPTED):** `CLOSED` only.
- **O1 (UNAPPROVED; rejected):** the capture date, inclusive. This claims
  full-day coverage from an 11:29 observation.
- **O2 (UNAPPROVED):** strictly before the capture date. The bound is 2026-09-27, and
  there is no lag margin.
- **O3 (design option, UNAPPROVED; covers nothing):** O2 minus a
  listing-lag margin L, plus a register search (P5). No defensible source for
  L exists (§4a), so O3 cannot yield a bound. It is recorded here so its
  assumptions can be reviewed, not adopted.

### 4a. Is there a defensible source for L?

**No.** The checks:
- **City statement:** none held. Neither the index page nor the evidence pack
  states how soon an enacted by-law is listed.
- **Measurement from the index:** not possible. The index gives Council or
  enactment dates, but not the date each entry was *listed*. The two captures
  (2026-09-15 and 2026-09-28) are identical, so they bracket no listing event.
  Measuring would need a capture series across listings that we do not have.
- **Would a measured lag be safe?** No, even with a capture series. Past lags
  are a sample, not a bound. Listing is a manual City web task, with no stated
  service level. A lag observed in the past does not cap the next one, so it
  cannot safely set a future coverage bound.

**O3's assumptions, stated plainly:**
- (i) The City lists every enacted Zoning and Development By-law amendment on
  the index.
- (ii) It does so within a known maximum delay L.
- (iii) The index attributes each amendment to the district schedules it
  touches.

None of these is established. Assumption (ii) could only come from the City,
as a stated maximum or a stated process. An independent source (P5) could
replace (i) and (ii) only if the register is itself authoritative and current,
and that is unconfirmed too.
- **O4 (UNAPPROVED; out of scope):** instant granularity. This needs an instant-typed AS_OF. **Out of
  scope.**

## 5. The five pinned AS_OF cases

Throughout this section, "Legal" is the legal-version blocker and "Desig." is
the designation blocker. Today every case is `DATA_GAP` with
`TEMPORAL_LINEAGE_NOT_READY`, and the public path still gives
`TEMPORAL_ANALYSIS_NOT_YET_APPLIED` because the pack is `DISABLED`.

| # | Case | O0 | O1 (rejected) | O2 | O3 | Can the outcome change? |
|---|---|---|---|---|---|---|
| 1 | R1-1 SDH, all families, 2026-09-14 | Legal: `START_UNKNOWN`. Desig.: observation only | Same | Same | Same | **No.** No open-coverage option helps an unknown start. This needs City Q2 **and** a designation start. |
| 2 | R1-1 SDH, DENSITY, 2026-09-27 | Same as #1 | Same as #1 (and would include 09-28 without support) | Same as #1 (09-27 ≤ bound) | Same as #1. O3 covers nothing. | **No** |
| 3 | R1-1 duplex, USE, 2026-07-01 | Same as #1 | Same | Same | Same | **No.** It also sits one day after 14747 commencement, so Q2 decides whether the reprint applies at all. |
| 4 | C-2C barber, USE + DIM, 2026-09-14 | Legal: open, not `CLOSED`. Desig.: observation only | Legal covered, desig. blocks | Legal covered only on O2's unestablished assumption of zero listing lag. Desig. blocks. | Legal **not** covered: O3 covers nothing (§4a). Desig. blocks. | **No, under any approved option.** Only the rejected or unapproved O1/O2 would clear the legal blocker. Designation blocks in every option. See the C-2A note below. |
| 5 | C-2C barber, USE, 2023-01-01 | Legal: `BEFORE_KNOWN_START` (before 2026-05-19). Desig.: before the 2026-06-29 observation | Same | Same | Same | **No.** It needs a registered earlier C-2C version. No coverage policy adds one. |

**C-2A caution for case 4.** By-law 14697, which starts the C-2C version,
also rezoned 2,348 C-2 / C-2B / C-2C / C-2C1 properties to C-2A. The
synthetic point lies in a polygon the 2026-06-29 layer still labels C-2C.
That fits "not rezoned", but it does not prove it.

Before any C-2C designation coverage, a **source-backed determination** is
required: does By-law 14697's mapped rezoning (its schedule, map or property
list) include the point's site? That means:
- citing the by-law's own schedule or map, pinned by SHA-256;
- locating the site on it, with the method recorded.

A layer label cannot settle this, whatever the layer's status (see P2).

**Conclusion.** No case reaches `APPLY` under any option, because designation
is observation-only everywhere. Only the rejected O1 and the unapproved O2
would clear even the legal blocker, and only in case 4.

## 6. Negative cases (all must stay MATERIAL / DATA_GAP)

| Scenario | Expected result |
|---|---|
| **Amended.** A later capture lists an entry touching C-2C after 14697 | Coverage void. `TEMPORAL_VERSION_NOT_ESTABLISHED`, citing the new entry. Validity must be recomputed (it may become `CLOSED` at that commencement). |
| **Amended but not yet listed** (listing lag). The register shows an instrument enacted or taking effect between the latest indexed touching entry and the bound, whose subject touches the district, but it is not in the index | Coverage void through P5. This is why O2 alone is insufficient. |
| **Conflicting captures.** Two pinned captures disagree for the district, or the validity is `CONFLICTING_END` / `CONFLICTING_START` | No coverage. `TEMPORAL_LINEAGE_NOT_READY`. |
| **Conflicting identity.** The coverage record's `sourceVersionId` or SHA-256 differs from the selected bundle | No coverage. `TEMPORAL_VERSION_SELECTED_NOT_LINKED`. |
| **Missing.** No `endReview`, an unpinned capture, a byte-hash mismatch, or a missing review record | No coverage. The load fails where the evidence gate applies. |
| **Out of window, late.** AS_OF on 2026-09-28 or later (O2). Under O3, every date, since no L is established. | Uncovered, with `OPEN_END_PREVENTS_SELECTION` (diagnostic). |
| **Out of window, early.** AS_OF before `effectiveFrom` | Uncovered, with `BEFORE_KNOWN_START` (diagnostic). |
| **Start unknown.** R1-1 | Never covered, whatever the review. |
| **Designation observation only**, even when the legal version is covered | `DESIGNATION_COINCIDENCE_NOT_ESTABLISHED`, MATERIAL. |
| **Stale.** The newest capture is older than A at promotion | Promotion refused. `AMENDMENT_INDEX_RECAPTURE` stays open. |

## 7. Decision

**O0 is adopted: only `CLOSED` intervals apply.** O1–O3 are unapproved; no
reviewed-open coverage policy is approved.

- O1 is rejected.
- O2 rests on the unestablished assumption that listing is complete and
  same-day.
- O3 is an **unapproved design option that covers nothing**. It depends on L,
  and L has no defensible source (§4a).

All five pinned cases stay `DATA_GAP`, which is the correct answer for the
evidence held.

**What would have to be true before O3 could even be proposed for approval**
(recorded so it can be reviewed, not as a plan to implement):

- **Legal-version coverage (O3 shape):**
  - D is covered iff the version is `OPEN_REVIEWED_NO_END_ESTABLISHED` and
    `effectiveFrom ≤ D ≤ captureLocalDate − 1 day − L`, in America/Vancouver
    whole days.
  - The coverage record matches the selected bundle's identity, and the
    capture SHA-256 matches the pinned capture.
  - P5 finds no touching instrument in the window.
  - The result is a separately named acceptance, `REVIEWED_OPEN_COVERED`.
    It is never `CLOSED`, and it always carries a disclosure naming the
    capture instant.
- **Designation coverage is separate, and stricter.** It needs:
  - a designation-start instrument (never a layer observation or a layer
    status);
  - an instrument-based end review of rezonings affecting the site through
    the same bound.

**Prerequisites** (every one must be met; none is met today):
- **P1, legal start:** City Q2 is answered for R1-1. Until then R1-1 is
  uncoverable and stays `DATA_GAP`.
- **P2, layer role:** City Q6 can establish the zoning layer's authority or
  role, meaning whether it is a legal record or a convenience map, and how
  current it is. **Q6 cannot by itself establish a parcel designation's legal
  start or continuity.** Even an authoritative layer shows the district on a
  processing date. It does not show when the designation began, or that it
  held without interruption across an AS_OF date.
- **P3, designation start and continuity:** for each covered point:
  - a pinned instrument establishes the designation's legal start;
  - rezoning instruments establish continuity through the bound.
  - **For the C-2C point**, this includes a source-backed determination of
    whether By-law 14697's mapped rezoning to C-2A includes its site (§5).
- **P4, listing lag:** a City-stated maximum listing delay, or a stated
  listing process that bounds it. **A measured historical lag does not
  qualify**, because it samples the past and does not bound future delays
  (§4a).
- **P5, register search:** a search of the authoritative City by-law register
  **by date and by subject**:
  - **Dates:** every instrument enacted, or taking effect, from the latest
    indexed touching entry's date through the proposed bound.
  - **Subjects:**
    - the district schedule itself;
    - Section 2 definitions and Sections 10 and 11, which apply to every
      district;
    - general schedules the facts rely on;
    - rezonings that map sites into or out of the district.
  - **Record:** each result is classified as touching or not touching, and
    the search terms, date range and result set are recorded.
  - **Cut-off:** no by-law number is used as a cut-off. Numbering order is
    not evidence of date or subject, and the index itself shows a
    non-sequential number ("Amending By-law 1717", listed for 2026-06-02).
  - **Failure:** an unavailable or incomplete search means not covered.
  - **Authority:** the register's own authority and currency are themselves
    a City question.
- **P6, capture age:** a maximum capture age A at promotion, with a fresh
  capture diffed entry by entry, as was done on 2026-09-28.
- **P7, review first:** a contract amendment and the §9 tests, reviewed
  before any code.

## 8. Contract change (docs/E85-public-temporal-and-condition-contract.md; applied)

In the proposal section, replace the "Not implemented: reviewed-open coverage"
bullet with:

```markdown
- **Not implemented: reviewed-open coverage.** No policy is approved; only
  `CLOSED` intervals apply (see `E85-reviewed-open-coverage-decision.md`).
  The 2026-09-28 index capture is an observation at 11:29 PDT, not full-day
  currency, and never a coverage bound by itself. A listing-lag design (O3)
  is recorded there as unapproved: it covers nothing, because no defensible
  source for a maximum listing delay exists. Legal-version coverage and
  designation coverage are separate requirements. A layer observation, or a
  layer's authority, never establishes a designation's legal start or
  continuity. All five pinned cases stay `DATA_GAP`.
```

In section 3 step 1, replace "proposed `currencyProvenTo` bound (NOT
IMPLEMENTED)" with "proposed coverage bound (NOT IMPLEMENTED and not
approved; see `E85-reviewed-open-coverage-decision.md`)". Leave the
capture-instant text as it is.

## 9. Tests

**A. O0 guard tests (written; they pass today).** They landed with the
contract change, in `__tests__/zoning-land-use-engine/vancouver-temporal-evidence-dry-run.test.ts`:

```ts
test("no reviewed-open coverage: MIXED/BOTH_OPEN_END coincidence is never accepted", () => {
  // For case 4 (C-2C 2026-09-14): the internal package has no APPLY
  // decision, and no TEMPORAL_VERSION_APPLIED or
  // DESIGNATION_COINCIDENCE_ESTABLISHED record.
});
test("the review date is never a coverage bound", () => {
  // No validity or window field equals "2026-09-28" except
  // endReview.reviewedAt, and the manifest carries no currencyProvenTo.
});
```

**B. Specification tests, only if an O3-shaped policy is ever approved.** Nothing is approved now. These would go in
`__tests__/zoning-land-use-engine/reviewed-open-coverage-policy.test.ts`, as
synthetic unit tests, plus evidence-gate cases:
1. The bound is `captureLocalDate − 1 − L`. The capture at 2026-09-28T18:29:51Z gives a local date of 2026-09-28. With a synthetic L = 0 (test fixture only, not a real value), 2026-09-27 is covered and 2026-09-28 is not. With L unset, nothing is covered.
2. A UTC-midnight capture (for example 2026-09-29T02:00Z, which is 2026-09-28 19:00 PDT) still uses the local date 2026-09-28.
3. AS_OF before `effectiveFrom` is not covered.
4. `START_UNKNOWN`, `CONFLICTING_START`, `CONFLICTING_END` and `CONDITIONAL_PARTIAL_TERMINATION` are never covered.
5. A capture SHA-256 mismatch, a missing `endReview` or an unpinned capture means not covered.
6. A recapture diff with a new entry touching the district voids coverage.
7. A date- and subject-based register search that finds a touching instrument in the window, returns incomplete results or fails means not covered. A by-law number alone never decides.
8. An identity mismatch (`sourceVersionId`) means not covered.
9. Legal covered with an observation-only designation is still MATERIAL, and the decision is `DATA_GAP`.
10. Legal covered with a designation start instrument and end review gives `REVIEWED_OPEN_COVERED` plus a disclosure naming the capture instant. This is never labelled `CLOSED`.
11. The five pinned cases stay `DATA_GAP` with today's evidence, whatever L is set to, because designation is observation-only.
12. Promotion is refused when the capture is older than A.
13. Designation coverage is refused when only a layer's authority (Q6) is supplied, without a start instrument and continuity evidence.
14. For the C-2C point, designation coverage is refused until a pinned determination of By-law 14697's mapped rezoning is supplied.

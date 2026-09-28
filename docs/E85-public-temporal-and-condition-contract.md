# E85 public path: the temporal blocker, caller conditions, and DATA_GAP fields

Status: working specification, 2026-09-27. Scope: Vancouver R1-1 and C-2C on
the public `parseE85PublicRequest → evaluateE85PublicRequest` path. Nothing
here assigns an effective window. Tests referenced are in
`__tests__/zoning-land-use-engine/`.

## 1. The blocker, exactly

Every public request is `AS_OF` with an explicit date. The public path sets
`temporalRequest` and never sets `temporalLineageEvidence`
(`buildE85DecisionRequestFromPublic`). With that combination,
`computeE85TemporalMaterialityAddition` (decision-orchestrator.ts) adds exactly one
record:

| Property | Value |
|---|---|
| `sourcePhase` | `TEMPORAL_REQUEST` |
| `sourceRef` | `TEMPORAL_REQUEST:TEMPORAL_ANALYSIS_NOT_YET_APPLIED:AS_OF:<asOfDate>` |
| `kind` / `materiality` | `GAP` / `MATERIAL` |
| effect | becomes a blocker; package `status` is `DATA_GAP`; `evaluationCompleteness` is `PARTIAL` |

Two facts decide what it would take to remove it:

1. **Supplying lineage evidence does not clear it by itself.** It replaces the
   blanket record with one record per lineage, and **every** outcome of
   `buildE85TemporalLineageMaterialityRecords` is `MATERIAL`, including a
   clean `AS_OF_SELECTED`, which becomes
   `TEMPORAL_CANDIDATE_SELECTED_NOT_APPLIED`. The only `NON_MATERIAL`
   temporal record is `TEMPORAL_VERSION_APPLIED` (section 3a). It is emitted
   only when a CLOSED version is selected and applied to composition, and
   each applying feature also needs an established designation coincidence.
   No pinned Vancouver version is CLOSED, so real requests stay `DATA_GAP`.
2. **Fact-level dates are a different axis.** Facts carry their own
   `AMENDMENT_DATE_KNOWN` windows (for example, C-2C 2022-11-14 under By-law 13447
   cl.89). These filter facts inside Phase 4. They say nothing about which
   consolidation governs on the as-of date, or whether the parcel held
   the designation then. They must not clear the blocker. This is tested in
   "known fact-level dates do not bypass the version-level temporal blocker".

## 2. Evidence needed to remove it

Three layers must each be established for the as-of date. **Pinned** means
the bytes are in `e85-pilot-evidence` with a SHA-256. **City** means it is awaiting
the City of Vancouver (questions Q1–Q6 in `VANCOUVER-LEGAL-PACK-READINESS.md` §7).
**Engine** means it is engineering work with no outside dependency.

### 2.1 Version level (which consolidation governs on the as-of date)

| Need | R1-1 (`2026-06-consolidation`) | C-2C (`2026-05-consolidation`) |
|---|---|---|
| Consolidation bytes | Pinned (PDF SHA-256) | Pinned (PDF SHA-256) |
| Version `effectiveDateBasis` | `UNKNOWN`, month-precision stamp only. Correct as is. | `UNKNOWN`, same |
| Latest incorporated instrument and its commencement | Pinned: 14747, enacted 2026-06-03, in force 2026-06-30 (§37) | Pinned: 14697, in force 2026-05-19 (cl.19) |
| Was the reprint published before that instrument took effect? | **City, Q2**. Unresolved, so no lower bound can be set from the stamp. | Not raised. The stamp and 14697 are consistent, but that is not confirmed. |
| Currency (no later amendment) | Pinned only to the index capture on 2026-09-15 | Same |
| Meaning of the volume-level "effective July 29, 2026" statement | **City, Q3** | **City, Q3** |
| Prior versions (for as-of dates before the current consolidation) | 13817 Schedule A is pinned as the 2023 baseline, but it is not a registered source version | Not pinned |

With pinned evidence alone, the most any version window could say is
"no later amendment located through 2026-09-15". An as-of date after the
index capture must stay blocked until the index is re-captured.

### 2.2 Rule level (the facts under that version)

| Need | Status |
|---|---|
| Each fact's own proposition clause and commencement clause | Pinned for every retained fact (`temporalAuthority`) |
| R1-1 dated facts | Pinned: 13817 (2023-10-17), 14747 (2026-06-30) |
| C-2C dated facts | Pinned: 13447 cl.28 / cl.89 (2022-11-14) |
| Qualifier histories | Partly **City**. §2.2.1(f) hydrotherapy limb and the §3.1.2.4(b) "RS"→"R1" instrument (Q5); Section 2 definitions chain (Q4). §3.1.2.10 and §3.2.2.8 not traced (Engine / research). |
| Reuse terms for structured values | **City, Q1** (a publication blocker, not a temporal one) |

### 2.3 Parcel-designation level (did this location hold R1-1/C-2C on the as-of date)

| Need | Status |
|---|---|
| Spatial layer bytes | Pinned: export SHA-256 `35e65736…a0ef`, processed 2026-06-29 |
| Legal effective date of each polygon | **Not available**. The layer publishes none (`TEMPORAL_APPLICABILITY_UNKNOWN`). It would come from the rezoning by-laws that amended Schedule D. |
| Whether the layer is authoritative for which district applies | **City, Q6** |
| Designation history before the as-of date (rezonings) | Not pinned. It needs the Schedule D amendment chain per polygon. |
| The 11 quarantined polygons | Resolved for points by the exclusion proof. They still block polygon parcels. |

## 3. Bounded temporal-evidence implementation plan

Each step is a separate change with its own tests. No step assigns a window
the evidence does not support.

1. **Engine: pinned version-validity records.** Build `E85VersionValidity` for
   each registered consolidation from pinned instruments only. The lower bound
   is `UNKNOWN` until Q2 is answered (R1-1), or is the incorporated instrument's
   commencement where that is proven. The upper bound is open, with a
   `currencyProvenTo: 2026-09-15`. Any as-of date after `currencyProvenTo`
   produces `TEMPORAL_CANDIDATE_OUTSIDE_VALIDITY`.
2. **Engine: a server lineage builder.** Turn step 1 into
   `E85TemporalLineageMember`s on the server (never from the caller). Wire it
   into `E85PublicServerInputs`, where it is currently deliberately absent. The
   result is still `MATERIAL` (`TEMPORAL_CANDIDATE_SELECTED_NOT_APPLIED`); this
   step only replaces the blanket disclosure with specific findings.
3. **Engine: apply the selected version.** Restrict Phase 6 composition to
   packs whose `sourceVersionId` equals the selected candidate. Only an
   applied, unambiguous selection may emit a new `NON_MATERIAL`
   `TEMPORAL_VERSION_APPLIED` record. Every other outcome stays `MATERIAL`.
4. **Engine + City: designation coincidence.** Wire the existing, not yet
   orchestrated `designation-legal-text-consistent-pair` into the decision.
   Designation validity comes from Schedule D rezoning evidence (City). Until
   then, it reports `NOT_EVALUABLE`, which must remain `MATERIAL`.
5. **Release gate.** Both steps 3 and 4 must be non-material for the as-of date
   before the temporal blocker is gone. Test each negative: Q2 unresolved,
   as-of date after the currency date, polygon undated, lineage ambiguous.

The blocker can be retired only after steps 1–5. Steps 1–3 are engineering
work. Step 4 is gated on the City (Q6 and the Schedule D history).

## 3a. Implemented (2026-09-27): synthetic-first temporal application

- `E85PublicServerInputs.temporalEvidence` (server only) carries `lineages`
  and per-feature `designations`. Client bodies naming `temporalEvidence`,
  `temporalLineageEvidence`, `lineages`, `versionValidity`, `designations` or
  `designationValidity` are rejected as `SERVER_CONTROLLED_FIELD`.
- For an AS_OF request with lineages, each resolved pack is decided
  (`decision-temporal-application.ts`): APPLY only when one lineage covers its
  source, it selected exactly that version, and the pack's content equals the
  selected bundle. A different or content-mismatched selected version is
  withheld from composition (`TEMPORAL_VERSION_SELECTED_NOT_LINKED`).
  Uncovered packs get `TEMPORAL_VERSION_NOT_ESTABLISHED`, and multiply-covered
  packs get `TEMPORAL_VERSION_LINEAGE_AMBIGUOUS`. All of these are MATERIAL.
- `TEMPORAL_VERSION_APPLIED` (NON_MATERIAL) replaces
  `TEMPORAL_CANDIDATE_SELECTED_NOT_APPLIED` only for a pack composition used.
- Each applying feature of an applied pack also needs exactly one server
  designation validity whose coincidence is `BOTH_CLOSED_APPLICABLE` with
  identity correspondence (`DESIGNATION_COINCIDENCE_ESTABLISHED`). Otherwise
  it is `DESIGNATION_COINCIDENCE_NOT_ESTABLISHED`, which is MATERIAL. Open-ended
  coincidence does not clear it.
- Only a CLOSED version validity is a selectable candidate. The pinned
  Vancouver validities (internal dry run only, `temporal-evidence.ts`; not
  wired to the public path) are neither CLOSED nor selectable:
  - R1-1 `2026-06-consolidation` is `START_UNKNOWN` pending Q2. The 14747 §37
    commencement (2026-06-30) is kept as pinned `AMENDMENT_EVIDENCE`. It is
    not used as the consolidation's validity start.
  - C-2C `2026-05-consolidation` is `OPEN_REVIEWED_NO_END_ESTABLISHED` from
    14697 (2026-05-19), with the end reviewed only to the 2026-09-15 index
    capture.
  So with real evidence both stay `TEMPORAL_LINEAGE_NOT_READY` and `DATA_GAP`.
- Internal diagnostic (`temporalLineageDiagnostic` on the materiality record).
  It is set only on an AS_OF `TEMPORAL_LINEAGE_NOT_READY` record from a
  `GROUP_NO_CANDIDATE` lineage whose members are **all** open-ended with a
  known start:
  - `BEFORE_KNOWN_START`: the AS_OF date is before every known start. The
    reason adds: the supplied version does not cover the AS_OF date, and an
    applicable earlier version has not been established.
  - `OPEN_END_PREVENTS_SELECTION`: the AS_OF date is on or after every known
    start, but no end is established.
  START_UNKNOWN or conflicting members, and an AS_OF date between members'
  starts, are left unclassified. The diagnostic changes only the reason text.
  Code, kind, materiality, `sourceRef` and `gap.reasonCode` are unchanged. The
  public response shape is unchanged: `temporalFindings` does not carry the
  field. In the dry run, C-2C 2023-01-01 is `BEFORE_KNOWN_START`, the other
  C-2C cases are `OPEN_END_PREVENTS_SELECTION`, and R1-1 is never classified.
- **Not implemented: reviewed-open coverage.** No policy lets an
  `OPEN_REVIEWED_NO_END_ESTABLISHED` version count as covering an AS_OF date
  up to its review date. The `currencyProvenTo` bound in section 3 step 1 is
  still a proposal. An AS_OF date after the 2026-09-15 index capture is
  treated the same as any other date after the start.
- `TEMPORAL_VERSION_APPLIED` is the only NON_MATERIAL temporal record (as
  section 1 states). Today only synthetic CLOSED evidence reaches it.
- The end-review date 2026-09-26 is `GIT_PINNED_AUDIT` provenance
  (`VANCOUVER_END_REVIEW_DATE_PROVENANCE`): git-pinned in the readiness
  audit, with no SHA-256 entry. It is a label only. It does not affect
  validity, selection, currency or public output.
- Phase 7's `TEMPORAL_APPLICABILITY_UNKNOWN` measures only that a feature
  record carries no legal effective date. In the package `warnings` it is
  qualified per feature by the designation result. A feature is left out only
  when it has at least one designation record and every one is NON_MATERIAL
  `DESIGNATION_COINCIDENCE_ESTABLISHED`. Every other applying undated feature
  keeps the warning: no evidence, open-ended, duplicated, a mismatched
  identity or feature, or its pack not applied. With nothing established, the
  original text is unchanged. If some features are established and others are
  not, the warning names only the remaining ones and says which were
  established. Phase 7's own finding (`phase7.findings`) is never altered.
  Real Vancouver requests establish nothing, so they keep the warning.
- Phase 4 timestamps come from Phase 7's deterministic `resolvedAt`
  (`evaluation-clock.ts`), so the orchestrated and public outputs are
  byte-reproducible.

## 4. Public caller-condition contract

Conditions are supplied as `conditions.satisfied` (affirmed) or
`conditions.unsatisfied` (denied), and matched verbatim. Each one is a
**caller assertion**. It is echoed back under
`callerAssertions.label = "CALLER_ASSERTED_NOT_CITY_VERIFIED"` and never checked
by E85.

| Stable id | Gates | What the caller asserts | Source | Not modelled |
|---|---|---|---|---|
| `vancouver_c_2c_use_wholly_within_completely_enclosed_building` | All six C-2C outright uses (c-2c-use-001…006) | The use will actually be carried on wholly within a completely enclosed building. Nothing else: not an exception, not a variance | C-2C §2.2.1, p.5 | Exceptions (a)–(m); the Director's variance; limb (f) history (Q5) |
| `vancouver_r1_1_duplex_suite_front_yard_trees` | R1-1 duplex with secondary suite (r1-1-use-004) | The development retains or plants the front-yard trees §2.2.1 requires, read with the §2.2.2 definitions | R1-1 §2.2.1–2.2.2, p.4 | Tree inventory, site facts; history not traced |
| `vancouver_r1_1_duplex_one_suite_per_unit` | R1-1 duplex with secondary suite (r1-1-use-004) | There is no more than one secondary suite for each dwelling unit | R1-1 §2.2.3, p.5 | Suite count as a proposal field; history not traced |

Each use-004 condition is independent. Both must be affirmed.

**C-2C §2.2.1: three separate assertions, one wired.** §2.2.1 can be met by
actual enclosure, by a named exception limb, or by a granted Director
variance. Each has its own id and evidence requirement, recorded as
`C_2C_ENCLOSED_BUILDING_ASSERTION_PROPOSALS` in the C-2C fixture:

| Id | Proposition | Evidence required | Caller assertion may suffice | Releases the six uses |
|---|---|---|---|---|
| `vancouver_c_2c_use_wholly_within_completely_enclosed_building` | The use is actually carried on wholly within a completely enclosed building | The proposal's description or plans | Yes (labelled `CALLER_ASSERTED_NOT_CITY_VERIFIED`) | **Yes: this is the active gate** |
| `vancouver_c_2c_2_2_1_exception_limb_<a–m>` | The activity falls within that named limb | Facts meeting the limb as worded on the as-of date. The fixture records that no exception concerns the six structured uses. Limb (f) history is unlocated (Q5) | No | No: not modelled |
| `vancouver_c_2c_2_2_1_director_variance_granted` | The Director of Planning has granted a §2.2.1 variance | A verified City decision record: number, authority, date, conditions, site | No. A claim is not an approval | No: not modelled |

The retired compound id `vancouver_c_2c_wholly_within_enclosed_building`
(fixture constant `C_2C_LEGACY_COMPOUND_ENCLOSED_BUILDING_CONDITION`) let one
affirmation stand for all three propositions. It is on no fact, so affirming
it releases nothing: the use stays unknown, never `PROHIBITED`. Exception and
variance ids stay non-releasing until each is separately modelled with its
own evidence. `requiredConditionIds` is a conjunction with no any-of form, so
wiring them needs a new applicability primitive. Tests are in
`c-2c-enclosed-building-assertions.test.ts`.

How each state appears:

| State | `fields` | `useOutcome` | Other |
|---|---|---|---|
| Unknown (not supplied) | no `usePermission` | `UNKNOWN`, `valueReported: false` | gap `EXTERNAL_CONDITION_UNDETERMINED` naming the id |
| Affirmed (all required ids) | `usePermission` PERMITTED (C-2C) / CONDITIONAL (use-004), `dependsOnCallerAssertions: ["conditions"]`, `requiredConditionIds` | status verbatim, `valueReported: true` | echoed under `callerAssertions.conditions.satisfied` |
| Denied | no `usePermission` | `UNKNOWN`, `valueReported: false` | a warning saying it is "not a finding that the use is prohibited"; echoed under `unsatisfied` |
| Partly affirmed (use-004) | no `usePermission` | `UNKNOWN` | gap `EXTERNAL_CONDITION_UNDETERMINED` |

A denial never becomes `PROHIBITED`. A denied use may still be lawful through
an unmodelled exception, a variance, or another approval path. Tests are in
`vancouver-full-snapshot-public-path.test.ts` › "caller-condition contract".

## 5. Field-level contract for DATA_GAP responses

A `DATA_GAP` response may still carry values. Per field:

| Field member | Meaning |
|---|---|
| `value`, `provenance`, `temporal` | What the cited evidence says, with the fact's own window. `temporal` is not a version-level or designation-level finding. |
| `standing` | `UNCONFIRMED_WHILE_BLOCKED` whenever any blocker is outstanding (always the case today). `RESOLVED_NO_BLOCKERS` only when `blockers` is empty. |
| `blockedBy` | Sorted, distinct `sourceCode`s of the outstanding blockers, for example `["TEMPORAL_ANALYSIS_NOT_YET_APPLIED"]`. |
| `dependsOnCallerAssertions` | `siteArea` / `proposal` / `conditions`. Non-empty means the value is only as good as those assertions. |
| `requiredConditionIds` | Present with `conditions`: the ids the value was released on. |

Response level:

- `useOutcome` gives the verbatim status for any evaluated USE request, including
  `UNKNOWN` when nothing was released.
- `gaps` lists values that were **withheld** (for example
  `REQUIRED_SITE_DIMENSION_MISSING`, `EXTERNAL_CONDITION_UNDETERMINED`).
- `temporalFindings` always carries the temporal record.

A consumer must treat `standing: UNCONFIRMED_WHILE_BLOCKED` as "not the
answer for this as-of date". It must never display such a value as
confirmed.

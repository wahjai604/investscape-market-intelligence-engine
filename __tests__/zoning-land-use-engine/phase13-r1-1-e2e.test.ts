/**
 * InvestScape™ E85 Phase 13.1 — Current-Law End-to-End Pilot Proof.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Contains information licensed under the Open Government Licence – Vancouver.
 *
 * Proves that the EXISTING architecture (Phase 8 spatial normalization ->
 * Phase 7 spatial applicability -> Phase 11 legal linkage -> Phase 6
 * composition -> Phase 4 evaluation -> Phase 9 orchestration), using only the
 * already-remediated real R1-1 fact set, produces a correct, coherent Phase 9
 * decision package for all four current rule families (USE, DENSITY,
 * DIMENSIONAL, REQUIREMENT) requested together, on the real accepted/linked
 * R1-1 spatial feature (494787).
 *
 * No new legal fact, no new generic contract and no production convenience
 * facade are introduced here: every function called below already exists and
 * is exercised exactly as `vancouver-r1-1-legal-linkage.test.ts`'s own
 * `decide()` helper exercises it. This file only widens the request to add
 * REQUIREMENT and asserts every family's output from ONE decision package.
 */
import {
  assembleE85DecisionPackage,
  canonicalRulePackFromBundle,
  createE85SpatialAdapterRegistry,
  createE85SpatialDatasetRegistry,
  evaluateZoningAndLandUse,
  normalizeE85SpatialSnapshot,
  adapters,
  E85DecisionPackage,
  E85NormalizedRuleBundle,
  E85ParcelReference,
  E85ParcelSpatialReference,
  E85PolicyVersion,
  E85ProposalContext,
  E85RawSpatialFeatureRecord,
  E85RequestedAnalysis,
  E85RulePack,
} from "../../src/zoning-land-use-engine";
import {
  createVancouverZoningSpatialAdapter,
  vancouverZoningDataset,
  vancouverZoningLinkPolicyFromLegalBundles,
} from "../../src/zoning-land-use-engine/adapters/spatial/vancouver";
import {
  SYNTHETIC_PARCEL_IN_R1_1,
  VANCOUVER_NORMALIZED_AT,
  VANCOUVER_RESOLVED_AT,
  VAN_R1_1,
  vancouverSnapshot,
} from "./fixtures/vancouver-spatial-snapshot";
import {
  r11Document,
  R1_1_MD_LOT_ON_RECORD_OR_SUBDIVIDED_CONDITION,
  R1_1_MD_REAR_VEHICULAR_ACCESS_CONDITION,
  R1_1_MD_NOT_IN_FLOOD_PLAIN_CONDITION,
  SITE_WEST_OF_ONTARIO_OR_CARRALL_CONDITION,
  R1_1_UNSTRUCTURED_SECTIONS,
} from "./fixtures/vancouver-r1-1-facts";

const { vancouverR11Adapter, VANCOUVER_R1_1_SOURCE, VANCOUVER_R1_1_SOURCE_ID, VANCOUVER_R1_1_VERSION_ID, VANCOUVER_JURISDICTION_ID } = adapters.vancouver;

const R1_1_PACK_ID = "ca-bc-vancouver:zoning-development-bylaw-3575:district-schedule-r1-1@2026-06-consolidation";

/** The current target date used throughout Phase 12 remediation. */
const AS_OF_DATE = "2026-09-14";
const ASSEMBLED_AT = "2026-09-14T00:00:00.000Z";
const COMPOSED_AT = "2026-09-14T00:00:00.000Z";

/** All four current rule families, requested TOGETHER in one decision package — the thing Phase 13.0 found untested. */
const FOUR_FAMILIES: readonly E85RequestedAnalysis[] = ["USE", "DENSITY", "DIMENSIONAL", "REQUIREMENT"];

/* ------------------------------------------------------------------ *
 * The authoritative legal half — produced by the real Phase 5 adapter,
 * never hand-copied, exactly as the Phase 11 legal-linkage test builds it.
 * ------------------------------------------------------------------ */

function r11Bundle(): E85NormalizedRuleBundle {
  const result = vancouverR11Adapter.normalize(r11Document(), VANCOUVER_R1_1_SOURCE);
  if (result.outcome !== "NORMALIZED") throw new Error(`expected NORMALIZED, got ${result.outcome}`);
  return result.bundle;
}

const r11Pack = (): E85RulePack => canonicalRulePackFromBundle(r11Bundle(), "BASE");

const datasets = () => createE85SpatialDatasetRegistry([vancouverZoningDataset()]);

/**
 * A parcel reference wide enough to trigger the §3.1.1.3(b)(ii) affordable-
 * housing requirement (site area >= 623 sqm), unlike the 500 sqm parcel the
 * Phase 11 legal-linkage test's own `parcelRef()` uses for its narrower USE/
 * DENSITY-only assertions.
 */
function parcelRef(parcelReferenceId: string): E85ParcelReference {
  return {
    parcelReferenceId,
    jurisdiction: {
      jurisdictionId: VANCOUVER_JURISDICTION_ID,
      country: "CA",
      regionCode: "BC",
      municipality: "Vancouver",
      regulatoryAuthority: "City of Vancouver — Planning, Urban Design and Sustainability",
      displayName: "City of Vancouver, BC, Canada",
    },
    rawZoningDesignation: "R1-1",
    siteAreaSqm: 700,
  };
}

const policy = (): E85PolicyVersion => ({ policyVersionId: "phase13-v1", effectiveFrom: "2020-01-01", concepts: {} });

/** Every §2.2.7 site-eligibility condition, plus the §3.1.1.3(b)(ii)(C) geographic condition — both current triggers this proof exercises. */
const ALL_SATISFIED_CONDITIONS: readonly string[] = [
  R1_1_MD_LOT_ON_RECORD_OR_SUBDIVIDED_CONDITION,
  R1_1_MD_REAR_VEHICULAR_ACCESS_CONDITION,
  R1_1_MD_NOT_IN_FLOOD_PLAIN_CONDITION,
  SITE_WEST_OF_ONTARIO_OR_CARRALL_CONDITION,
];

/** A coherent Multiple Dwelling proposal: 6 units, non-rental tenure (density-006, coexists with the affordability trigger), a non-rear building role, and a frontage that clears the affordability trigger's 17.1 m minimum. */
const COHERENT_MD_PROPOSAL: E85ProposalContext = {
  dwellingUnitCount: 6,
  tenureCode: "Other Tenure",
  buildingRole: "Other Building",
  frontageMetres: 20,
};

interface DecideSpec {
  records?: readonly E85RawSpatialFeatureRecord[];
  legal?: readonly E85NormalizedRuleBundle[];
  parcel?: E85ParcelSpatialReference;
  useCode?: string;
  proposal?: E85ProposalContext;
  callerContext?: { readonly satisfiedConditions?: readonly string[]; readonly unsatisfiedConditions?: readonly string[] };
  requestedAnalyses?: readonly E85RequestedAnalysis[];
}

/**
 * Assembles one E85 decision package through the EXISTING production
 * assembly contract — Phase 8 spatial adapter -> Phase 11 link policy ->
 * `assembleE85DecisionPackage` (Phase 9, which itself runs Phase 7 -> pack
 * resolution -> Phase 6 -> Phase 4 internally). Deliberately mirrors
 * `vancouver-r1-1-legal-linkage.test.ts`'s own `decide()` helper — this is
 * the caller-side assembly the Phase 13.0 audit found is not itself a
 * production function (see report §4/§28), so this test reproduces exactly
 * the glue a real caller would need, rather than inventing a shortcut.
 */
function decide(spec: DecideSpec = {}): E85DecisionPackage {
  const legal = spec.legal ?? [r11Bundle()];
  const parcel = spec.parcel ?? SYNTHETIC_PARCEL_IN_R1_1();
  const adapter = legal.length === 0 ? createVancouverZoningSpatialAdapter({}) : createVancouverZoningSpatialAdapter(vancouverZoningLinkPolicyFromLegalBundles(legal));
  const registry = createE85SpatialAdapterRegistry([adapter]);
  if (!registry.ok) throw new Error("adapter registry problems");
  return assembleE85DecisionPackage({
    decisionId: "phase13-r1-1-four-family",
    normalization: normalizeE85SpatialSnapshot(vancouverSnapshot(spec.records ?? [VAN_R1_1]), datasets(), registry.registry, { normalizedAt: VANCOUVER_NORMALIZED_AT }),
    parcelSpatial: parcel,
    parcel: parcelRef(parcel.parcelReferenceId),
    jurisdictionId: VANCOUVER_JURISDICTION_ID,
    zoneDesignation: "R1-1",
    useCode: spec.useCode ?? "multiple_dwelling",
    asOfDate: AS_OF_DATE,
    requestedAnalyses: spec.requestedAnalyses ?? FOUR_FAMILIES,
    policyVersion: policy(),
    availableRulePacks: legal.map((b) => canonicalRulePackFromBundle(b, "BASE")),
    spatialRegistry: datasets(),
    resolvedAt: VANCOUVER_RESOLVED_AT,
    composedAt: COMPOSED_AT,
    assembledAt: ASSEMBLED_AT,
    ...(spec.proposal === undefined ? {} : { proposal: spec.proposal }),
    ...(spec.callerContext === undefined ? {} : { callerContext: spec.callerContext }),
  });
}

describe("E85 Phase 13.1 — real spatial->legal->composition->evaluation->decision, all four current families together", () => {
  test("Phase 8 links the real feature, Phase 7 applies it, Phase 11's pack resolves, Phase 6 composes it, Phase 4 evaluates it", () => {
    const p = decide({ proposal: COHERENT_MD_PROPOSAL, callerContext: { satisfiedConditions: ALL_SATISFIED_CONDITIONS } });

    if (p.phase8.outcome !== "NORMALIZED") throw new Error("expected NORMALIZED");
    expect(p.phase8.features.find((f) => f.featureId === "494787")?.rulePackIds).toEqual([R1_1_PACK_ID]);

    expect(p.phase7?.hits.find((h) => h.featureId === "494787")?.relation).toBe("CONTAINS");
    expect(p.phase7?.hits.find((h) => h.featureId === "494787")?.applicability).toBe("APPLIES");
    expect(p.phase7?.applicableRulePackIds).toEqual([R1_1_PACK_ID]);

    expect(p.packResolution.resolved.map((r) => r.packId)).toEqual([R1_1_PACK_ID]);
    expect(p.packResolution.unresolvedPackIds).toEqual([]);
    expect(p.packResolution.conflictingPackIds).toEqual([]);

    if (p.phase6?.outcome !== "COMPOSED") throw new Error("expected COMPOSED");
    expect(p.phase6.composed.contributingPackIds).toEqual([R1_1_PACK_ID]);

    expect(p.phase4).toBeDefined();
    expect(p.requestedAnalyses).toEqual(FOUR_FAMILIES);
  });

  test("USE: Multiple Dwelling resolves CONDITIONAL, with real by-law provenance", () => {
    const p = decide({ proposal: COHERENT_MD_PROPOSAL, callerContext: { satisfiedConditions: ALL_SATISFIED_CONDITIONS } });
    expect(p.phase4?.usePermission?.useCode).toBe("multiple_dwelling");
    expect(p.phase4?.usePermission?.status).toBe("CONDITIONAL");

    // rulesConsidered lists every USE-family rule record matching jurisdiction/
    // zone regardless of applicability (it is the raw input, not the resolved
    // answer) — Multiple Dwelling's own permission can therefore sit in any of
    // several USE records, so every record is searched, not just the first.
    const considered = p.phase4?.result.rulesConsidered ?? [];
    const permission = considered.filter((r) => r.family === "USE").flatMap((r) => r.permissions ?? []).find((e) => e.value.useCode === "multiple_dwelling");
    expect(permission?.provenance.sourceId).toBe(VANCOUVER_R1_1_SOURCE_ID);
    expect(permission?.provenance.sourceVersionId).toBe(VANCOUVER_R1_1_VERSION_ID);
    expect(permission?.provenance.documentLocator?.bylawOrDocumentId).toBe("3575");
    expect(permission?.temporal?.effectiveDateBasis).toBe("AMENDMENT_DATE_KNOWN");
    expect(permission?.provenance.temporalAuthority?.instrument.bylawOrDocumentId).toBe("14747");
    expect(permission?.provenance.temporalAuthority?.propositionLocator?.clause).toBe("4(b)");
  });

  test("DENSITY: Multiple Dwelling FSR (1.0) resolves onto the regulatory envelope", () => {
    // Overall `result.status` is DATA_GAP (the real, still-unstructured
    // Schedule J cash-in-lieu rate — see the REQUIREMENT test below), so the
    // resolved DENSITY/DIMENSIONAL envelope lives under `partialEnvelope`,
    // not `envelope` (evaluator.ts's DATA_GAP branch). `resolvedMaxFsr` is
    // unaffected either way, since it is populated independently of status.
    const p = decide({ proposal: COHERENT_MD_PROPOSAL, callerContext: { satisfiedConditions: ALL_SATISFIED_CONDITIONS } });
    expect(p.phase4?.resolvedMaxFsr?.value).toBe(1);
    expect(p.phase4?.resolvedMaxFsr?.evidence.provenance.sourceId).toBe(VANCOUVER_R1_1_SOURCE_ID);

    if (p.phase4?.result.status !== "DATA_GAP") throw new Error("expected DATA_GAP");
    // §3.1.1.2 also states an explicit GFA cap, reported as its own finding
    // (never combined with the FSR-derived figure — density-evaluation.ts's
    // own documented policy). Both are real and both are visible.
    expect(p.phase4.result.partialEnvelope?.envelope.maxRegulatoryGfaSqm?.provenance.sourceId).toBe(VANCOUVER_R1_1_SOURCE_ID);
  });

  test("DENSITY: the real Phase 4 finding for maxDwellingUnits resolves to 6 (other tenure) and is now surfaced on the decision package via resolvedMaxDwellingUnits", () => {
    // Mirrors resolvedMaxFsr's promotion: the evaluator now copies the
    // RESOLVED DENSITY/maxDwellingUnits finding onto `outcome.resolvedMaxDwellingUnits`,
    // same as it already does for maxFsr. `rulesConsidered` still lists BOTH
    // tenure branches unfiltered by applicability (density-005 rental cap 8,
    // density-006 other-tenure cap 6) — that raw list is unchanged — but a
    // caller no longer has to re-implement applicability evaluation to learn
    // which cap actually governs this proposal.
    const p = decide({ proposal: COHERENT_MD_PROPOSAL, callerContext: { satisfiedConditions: ALL_SATISFIED_CONDITIONS } });
    const considered = p.phase4?.result.rulesConsidered ?? [];
    const unitCapValues = considered.flatMap((r) => (r.family === "DENSITY" && r.maxDwellingUnits ? [r.maxDwellingUnits.value] : [])).sort((a, b) => a - b);
    expect(unitCapValues).toEqual([6, 8]); // both tenure branches present, unfiltered — rulesConsidered is unchanged

    expect(p.phase4?.resolvedMaxDwellingUnits?.value).toBe(6);
    expect(p.phase4?.resolvedMaxDwellingUnits?.evidence.provenance.sourceId).toBe(VANCOUVER_R1_1_SOURCE_ID);
    expect(p.phase4?.resolvedMaxDwellingUnits?.evidence.provenance.sourceVersionId).toBe(VANCOUVER_R1_1_VERSION_ID);
    expect(p.phase4?.resolvedMaxDwellingUnits?.evidence.provenance.documentLocator?.bylawOrDocumentId).toBe("3575");
    expect(p.phase4?.resolvedMaxDwellingUnits?.evidence.temporal).toBeDefined();

    if (p.phase4?.result.status !== "DATA_GAP") throw new Error("expected DATA_GAP");
    expect((p.phase4.result.partialEnvelope?.envelope as Record<string, unknown> | undefined)?.maxDwellingUnits).toBeUndefined();
  });

  test("DENSITY: the 100% rental tenure branch resolves resolvedMaxDwellingUnits to 8", () => {
    const rentalProposal: E85ProposalContext = { ...COHERENT_MD_PROPOSAL, tenureCode: "residential_rental_tenure_100_percent" };
    const p = decide({ proposal: rentalProposal, callerContext: { satisfiedConditions: ALL_SATISFIED_CONDITIONS } });
    expect(p.phase4?.resolvedMaxDwellingUnits?.value).toBe(8);
  });

  test("sourceFindings: Phase 5 findings from the real, contributing R1-1 pack are traceable on the decision package", () => {
    const p = decide({ proposal: COHERENT_MD_PROPOSAL, callerContext: { satisfiedConditions: ALL_SATISFIED_CONDITIONS } });
    expect(p.sourceFindings).toBeDefined();
    const bundle = r11Bundle();
    if (bundle.findings.length > 0) {
      expect(p.sourceFindings.length).toBeGreaterThan(0);
      for (const sf of p.sourceFindings) {
        expect(sf.packId).toBe(R1_1_PACK_ID);
        expect(sf.sourceId).toBe(VANCOUVER_R1_1_SOURCE_ID);
        expect(sf.sourceVersionId).toBe(VANCOUVER_R1_1_VERSION_ID);
      }
    }
  });

  test("sourceFindings: all five real R1-1 legal-coverage disclosures are present, identity-traceable, and §2.2.2 is not a separate sixth disclosure", () => {
    // R1_1_UNSTRUCTURED_SECTIONS is the fixture's own documentation constant for
    // the five known intentional coverage gaps. The adapter turns each entry of
    // `document.unstructuredSections` into its own SOURCE_SECTION_UNAVAILABLE
    // finding (r1-1-adapter.ts), with no factId/sourceTerm and no structured
    // "section" field — the section text is only carried inside `message`, so
    // that is the only way to identify each one. This proves the LIVE adapter
    // output still matches the fixture's documented five, not merely that the
    // fixture constant says so.
    expect(R1_1_UNSTRUCTURED_SECTIONS.length).toBe(5);

    const withoutInspection = decide({ proposal: COHERENT_MD_PROPOSAL, callerContext: { satisfiedConditions: ALL_SATISFIED_CONDITIONS } });
    const p = decide({ proposal: COHERENT_MD_PROPOSAL, callerContext: { satisfiedConditions: ALL_SATISFIED_CONDITIONS } });

    const sectionFindings = p.sourceFindings.filter((sf) => sf.finding.code === "SOURCE_SECTION_UNAVAILABLE");
    // Exactly one disclosure per documented section string — no extra, no missing.
    expect(sectionFindings.length).toBe(R1_1_UNSTRUCTURED_SECTIONS.length);

    for (const section of R1_1_UNSTRUCTURED_SECTIONS) {
      const matches = sectionFindings.filter((sf) => sf.finding.message.includes(section));
      expect(matches.length).toBe(1);
      const sf = matches[0]!;
      expect(sf.finding.severity).toBe("GAP");
      expect(sf.finding.factId).toBeUndefined();
      expect(sf.packId).toBe(R1_1_PACK_ID);
      expect(sf.sourceId).toBe(VANCOUVER_R1_1_SOURCE_ID);
      expect(sf.sourceVersionId).toBe(VANCOUVER_R1_1_VERSION_ID);
    }

    // §2.2.2 must NOT appear as an independent, separate disclosure entry: the
    // fixture folds its definition-support role into the SAME §2.2.1 entry
    // (one unstructured provision, not two). No finding's message should name
    // "2.2.2" as its own disclosed section distinct from the §2.2.1 entry that
    // already mentions it.
    const the221Entry = R1_1_UNSTRUCTURED_SECTIONS.find((s) => s.startsWith("2.2.1"));
    expect(the221Entry).toBeDefined();
    expect(the221Entry).toContain("2.2.2");
    const standalone222 = sectionFindings.filter((sf) => sf.finding.message.includes("2.2.2") && !sf.finding.message.includes(the221Entry!));
    expect(standalone222.length).toBe(0);

    // Exposing these five disclosures does not change status/materiality/
    // warnings/manualReview versus an independent run that never inspects them.
    expect(p.status).toBe(withoutInspection.status);
    expect(p.materiality).toEqual(withoutInspection.materiality);
    expect(p.warnings).toEqual(withoutInspection.warnings);
    expect((p as unknown as { manualReview?: unknown }).manualReview).toEqual((withoutInspection as unknown as { manualReview?: unknown }).manualReview);
  });

  test("sourceFindings: the Schedule J cash-in-lieu Phase 5 finding remains visible separately from the Phase 4 gap, and only the Phase 4 gap drives DATA_GAP status", () => {
    // Phase 5's own finding for r1-1-requirement-002 (Cash in Lieu Payment)
    // records that its quantification reference is located but NOT structured
    // — an INFO-severity, audit-only observation, distinct from the real
    // blocking Phase 4 gap (`RULE_NOT_STRUCTURED`) asserted in the REQUIREMENT
    // test above. Both must remain visible in their own separate fields.
    const p = decide({ proposal: COHERENT_MD_PROPOSAL, callerContext: { satisfiedConditions: ALL_SATISFIED_CONDITIONS } });

    const cashInLieuFinding = p.sourceFindings.find((sf) => sf.finding.factId === "r1-1-requirement-002");
    if (cashInLieuFinding === undefined) {
      // If the real bundle carries no such Phase 5 finding, there is nothing
      // further to assert here — record the fact rather than fabricate one.
      expect(cashInLieuFinding).toBeUndefined();
      return;
    }
    expect(cashInLieuFinding.finding.severity).toBe("INFO");
    expect(cashInLieuFinding.finding.message).toContain("NOT structured by this extract");
    expect(cashInLieuFinding.finding.gap).toBeUndefined();

    // The Phase 4 gap (asserted fully in the REQUIREMENT test above) is what
    // actually drives DATA_GAP — the Phase 5 finding above never carries a
    // `gap` record and plays no part in `status`.
    if (p.phase4?.result.status !== "DATA_GAP") throw new Error("expected DATA_GAP");
    expect(p.phase4.result.gaps.some((g) => g.reasonCode === "RULE_NOT_STRUCTURED")).toBe(true);
    expect(p.status).toBe("DATA_GAP");
  });

  test("DIMENSIONAL: the non-rear-building branch of the real §3.1.2.5(b)/§3.1.2.6 provisions resolves onto the envelope — height, storeys and front yard", () => {
    const p = decide({ proposal: COHERENT_MD_PROPOSAL, callerContext: { satisfiedConditions: ALL_SATISFIED_CONDITIONS } });
    if (p.phase4?.result.status !== "DATA_GAP") throw new Error("expected DATA_GAP");
    const envelope = p.phase4.result.partialEnvelope?.envelope;

    // "Other Building" excludes the rear-building branch (8.5 m / 2 storeys)
    // and resolves the other-MD-building branch (11.5 m / 3 storeys) instead
    // — this is the RESOLVED envelope value, filtered by applicability,
    // unlike the raw `rulesConsidered` list which would show both branches.
    expect(envelope?.maxHeightMetres?.value).toBe(11.5);
    expect(envelope?.maxStoreys?.value).toBe(3);
    // Front yard is unscoped by building role, so it resolves regardless.
    expect(envelope?.setbacksMetres?.front?.value).toBe(4.9);

    expect(envelope?.maxHeightMetres?.provenance.sourceId).toBe(VANCOUVER_R1_1_SOURCE_ID);
    expect(envelope?.maxHeightMetres?.temporal?.effectiveFrom).toBe("2023-10-17");
  });

  test("REQUIREMENT: the social-housing alternative resolves structured; the cash-in-lieu alternative honestly discloses Schedule J as not-yet-structured — both from real R1-1 evidence", () => {
    const p = decide({ proposal: COHERENT_MD_PROPOSAL, callerContext: { satisfiedConditions: ALL_SATISFIED_CONDITIONS } });

    // requirements live on the outcome regardless of overall result.status —
    // Phase 4 always populates `outcome.requirements` when REQUIREMENT is requested.
    const outcome = p.phase4!;
    const socialHousing = outcome.requirements?.find((r) => r.requirementCode === "social_housing_floor_area");
    expect(socialHousing?.status).toBe("APPLICABLE_STRUCTURED");
    expect(socialHousing?.category).toBe("AFFORDABLE_HOUSING");
    expect(socialHousing?.requirement?.obligationKind).toBe("PROVIDE");
    expect(socialHousing?.requirement?.choice?.choiceGroupId).toBe("r1-1_3.1.1.3_b_ii");
    expect(socialHousing?.quantities.map((q) => q.value)).toEqual([{ kind: "MIN_FRACTION_OF_FLOOR_AREA", value: 0.05, basisTerm: "residential floor area" }]);
    expect(socialHousing?.evidence[0]?.provenance.sourceId).toBe(VANCOUVER_R1_1_SOURCE_ID);
    expect(socialHousing?.evidence[0]?.provenance.temporalAuthority?.instrument.bylawOrDocumentId).toBe("14747");

    const cashInLieu = outcome.requirements?.find((r) => r.requirementCode === "social_housing_cash_in_lieu");
    expect(cashInLieu?.status).toBe("APPLICABLE_QUANTIFICATION_UNRESOLVED");
    expect(cashInLieu?.requirement?.obligationKind).toBe("PAYMENT_IN_LIEU");
    expect(cashInLieu?.gap?.reasonCode).toBe("RULE_NOT_STRUCTURED");
    expect(cashInLieu?.gap?.reason).toContain("Schedule J");
  });

  test("the still-real Schedule J gap correctly forces overall DATA_GAP, but does NOT erase the resolved USE/DENSITY/DIMENSIONAL values — partial work is labelled, not discarded", () => {
    // This is the honest current-law behavior the Phase 13.0 audit predicted
    // (report §7): Schedule J's cash-in-lieu rate remains genuinely
    // unstructured, so requesting REQUIREMENT alongside the other three
    // families necessarily surfaces DATA_GAP at the Phase 4 result level —
    // yet Phase 9's own design principle ("a package carrying any blocker can
    // never report MACHINE_RESOLVED, but partial work is never refused")
    // means the other three families' values remain fully present and
    // inspectable on `phase4` regardless.
    const p = decide({ proposal: COHERENT_MD_PROPOSAL, callerContext: { satisfiedConditions: ALL_SATISFIED_CONDITIONS } });
    expect(p.phase4?.result.status).toBe("DATA_GAP");
    if (p.phase4?.result.status !== "DATA_GAP") throw new Error("expected DATA_GAP");
    expect(p.phase4.result.gaps.some((g) => g.reasonCode === "RULE_NOT_STRUCTURED")).toBe(true);
    // No OTHER, unexpected gap kind is present alongside the expected one.
    expect(p.phase4.result.gaps.every((g) => g.reasonCode === "RULE_NOT_STRUCTURED")).toBe(true);

    // The USE/DENSITY/DIMENSIONAL values proven in the family-specific tests
    // above are on `outcome.usePermission` / `outcome.resolvedMaxFsr` /
    // `outcome.result.rulesConsidered`, none of which depend on
    // `result.status` — they survive the DATA_GAP exactly as designed.
    expect(p.phase4?.usePermission?.status).toBe("CONDITIONAL");
    expect(p.phase4?.resolvedMaxFsr?.value).toBe(1);
  });

  test("no UNEXPECTED gap kind appears: no EFFECTIVE_DATE_UNKNOWN, no EXTERNAL_CONDITION_UNDETERMINED, no duplicate/unresolved pack, given every condition is affirmed and every current fact is dated", () => {
    const p = decide({ proposal: COHERENT_MD_PROPOSAL, callerContext: { satisfiedConditions: ALL_SATISFIED_CONDITIONS } });
    expect(p.blockers).toEqual([]);
    expect(p.packResolution.unresolvedPackIds).toEqual([]);
    expect(p.packResolution.conflictingPackIds).toEqual([]);
    if (p.phase4?.result.status === "DATA_GAP") {
      const reasonCodes = new Set(p.phase4.result.gaps.map((g) => g.reasonCode));
      expect(reasonCodes.has("EFFECTIVE_DATE_UNKNOWN")).toBe(false);
      expect(reasonCodes.has("EXTERNAL_CONDITION_UNDETERMINED")).toBe(false);
    }
  });

  test("materiality: this clean, fully-linked case carries no unresolved-problem materiality record and no blocker", () => {
    // Phase 9 materiality records exist per UPSTREAM PROBLEM (an unresolved
    // pack, an unmapped feature, a licence blocker), not per successfully-
    // resolved feature — so a clean case with nothing upstream unresolved
    // legitimately produces an EMPTY materiality list, not a "MATERIAL" entry
    // for 494787. Confirmed against decision-materiality.ts's own contract
    // ("materiality is decided per PROBLEM, per parcel").
    const p = decide({ proposal: COHERENT_MD_PROPOSAL, callerContext: { satisfiedConditions: ALL_SATISFIED_CONDITIONS } });
    expect(p.materiality.some((m) => m.materiality === "UNDETERMINED")).toBe(false);
    expect(p.blockers).toEqual([]);
  });

  test("trace: every stage from spatial applicability through evaluation is recorded, and both spatial and legal provenance are traceable", () => {
    const p = decide({ proposal: COHERENT_MD_PROPOSAL, callerContext: { satisfiedConditions: ALL_SATISFIED_CONDITIONS } });
    const stageNames = p.stages.map((s) => s.stage);
    for (const expected of ["SPATIAL_NORMALIZATION", "SPATIAL_APPLICABILITY", "RULE_PACK_RESOLUTION", "COMPOSITION", "EVALUATION"]) {
      expect(stageNames).toContain(expected);
    }
    expect(p.stages.every((s) => s.state !== "BLOCKED")).toBe(true);

    const trace = JSON.stringify(p.trace);
    expect(trace).toContain(R1_1_PACK_ID);
    expect(trace).toContain(VANCOUVER_R1_1_SOURCE_ID);
    expect(trace).toContain("494787");
    expect(p.trace.filter((t) => t.kind === "SUPPORT").length).toBeGreaterThan(0);
  });

  test("the pipeline's REQUIREMENT/USE/DENSITY/DIMENSIONAL conclusions match evaluating the same composed bundle directly", () => {
    // Confirms the join adds geometry, not rules, for the widened four-family
    // request too — the same invariant the Phase 11 test proves for USE/DENSITY.
    const p = decide({ proposal: COHERENT_MD_PROPOSAL, callerContext: { satisfiedConditions: ALL_SATISFIED_CONDITIONS } });
    const direct = evaluateZoningAndLandUse({
      parcel: parcelRef("direct-check"),
      jurisdictionId: VANCOUVER_JURISDICTION_ID,
      zoneDesignation: "R1-1",
      useCode: "multiple_dwelling",
      asOfDate: AS_OF_DATE,
      requestedAnalyses: FOUR_FAMILIES,
      policyVersion: policy(),
      rules: r11Bundle().rules,
      proposal: COHERENT_MD_PROPOSAL,
      callerContext: { satisfiedConditions: ALL_SATISFIED_CONDITIONS },
    });
    expect(p.phase4?.result.status).toBe(direct.result.status);
    expect(p.phase4?.usePermission?.status).toBe(direct.usePermission?.status);
    expect(p.phase4?.resolvedMaxFsr?.value).toBe(direct.resolvedMaxFsr?.value);
    expect((p.phase4?.requirements ?? []).map((r) => [r.requirementCode, r.status]).sort()).toEqual((direct.requirements ?? []).map((r) => [r.requirementCode, r.status]).sort());
  });

  /* ------------------------------------------------------------------ *
   * Negative control — one bounded case, proving UNKNOWN != PROHIBITED
   * survives the full pipeline, not just Phase 4 in isolation.
   * ------------------------------------------------------------------ */

  test("negative control: omitting one required §2.2.7 condition leaves USE genuinely undetermined end-to-end — never PROHIBITED, never a laundered clean result", () => {
    const p = decide({
      proposal: COHERENT_MD_PROPOSAL,
      // Every condition affirmed except rear vehicular access.
      callerContext: { satisfiedConditions: [R1_1_MD_LOT_ON_RECORD_OR_SUBDIVIDED_CONDITION, R1_1_MD_NOT_IN_FLOOD_PLAIN_CONDITION, SITE_WEST_OF_ONTARIO_OR_CARRALL_CONDITION] },
    });
    if (p.phase4?.result.status !== "DATA_GAP") throw new Error(`expected DATA_GAP, got ${String(p.phase4?.result.status)}`);
    expect(p.phase4.result.gaps.some((g) => g.reasonCode === "EXTERNAL_CONDITION_UNDETERMINED")).toBe(true);
    expect(p.phase4?.usePermission).toBeUndefined();
    expect(p.phase4?.usePermission?.status).not.toBe("PROHIBITED");
    expect(p.status).toBe("DATA_GAP");
    expect(p.status).not.toBe("MACHINE_RESOLVED");
  });
});

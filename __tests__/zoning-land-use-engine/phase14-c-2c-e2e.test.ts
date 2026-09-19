/**
 * InvestScape™ E85 Phase 14.4B — Vancouver C-2C end-to-end proof.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Proves that the SAME generic architecture (Phase 8 spatial normalization ->
 * Phase 7 spatial applicability -> Phase 11-generalized legal linkage ->
 * Phase 6 composition -> Phase 4 evaluation -> Phase 9 orchestration) that
 * `phase13-r1-1-e2e.test.ts` proves for R1-1 also produces a correct,
 * coherent Phase 9 decision package for a SECOND real Vancouver source with a
 * genuinely partial family footprint — on the real C-2C spatial feature
 * (494642).
 *
 * THE TWO KEY PROOFS THIS FILE CARRIES:
 *   1. Requesting exactly USE + DIMENSIONAL (what the C-2C pack actually
 *      supports) is COMPLETE, with no coverage blocker.
 *   2. Requesting all four families raises the Phase 14.4A.1
 *      REQUESTED_FAMILY_NOT_SUPPORTED coverage blocker for exactly DENSITY
 *      and REQUIREMENT (never USE or DIMENSIONAL, which the pack DOES
 *      support), and the terminal legal status is NOT corrupted into
 *      DATA_GAP or MANUAL_REVIEW_REQUIRED by it — the modeled families'
 *      clean result stands on its own.
 *
 * No new legal fact and no new generic contract are introduced here.
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
  E85RawSpatialFeatureRecord,
  E85RequestedAnalysis,
  E85RulePack,
} from "../../src/zoning-land-use-engine";
import { createVancouverZoningSpatialAdapter, vancouverZoningDataset, vancouverZoningLinkPolicyFromLegalBundles } from "../../src/zoning-land-use-engine/adapters/spatial/vancouver";
import { SYNTHETIC_PARCEL_IN_C_2C, VANCOUVER_NORMALIZED_AT, VANCOUVER_RESOLVED_AT, VAN_C_2C, vancouverSnapshot } from "./fixtures/vancouver-spatial-snapshot";
import { c2cDocument } from "./fixtures/vancouver-c-2c-facts";

const { vancouverC2CAdapter, VANCOUVER_C_2C_SOURCE, VANCOUVER_C_2C_SOURCE_ID, VANCOUVER_C_2C_VERSION_ID, VANCOUVER_JURISDICTION_ID } = adapters.vancouver;

const C_2C_PACK_ID = "ca-bc-vancouver:zoning-development-bylaw-3575:district-schedule-c-2c@2026-05-consolidation";

const AS_OF_DATE = "2026-09-19";
const ASSEMBLED_AT = "2026-09-19T00:00:00.000Z";
const COMPOSED_AT = "2026-09-19T00:00:00.000Z";

const TWO_SUPPORTED_FAMILIES: readonly E85RequestedAnalysis[] = ["USE", "DIMENSIONAL"];
const FOUR_FAMILIES: readonly E85RequestedAnalysis[] = ["USE", "DENSITY", "DIMENSIONAL", "REQUIREMENT"];

function c2cBundle(): E85NormalizedRuleBundle {
  const result = vancouverC2CAdapter.normalize(c2cDocument(), VANCOUVER_C_2C_SOURCE);
  if (result.outcome !== "NORMALIZED") throw new Error(`expected NORMALIZED, got ${result.outcome}`);
  return result.bundle;
}

const c2cPack = (): E85RulePack => canonicalRulePackFromBundle(c2cBundle(), "BASE");
const datasets = () => createE85SpatialDatasetRegistry([vancouverZoningDataset()]);

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
    rawZoningDesignation: "C-2C",
    siteAreaSqm: 500,
  };
}

const policy = (): E85PolicyVersion => ({ policyVersionId: "phase14-v1", effectiveFrom: "2020-01-01", concepts: {} });

interface DecideSpec {
  records?: readonly E85RawSpatialFeatureRecord[];
  legal?: readonly E85NormalizedRuleBundle[];
  parcel?: E85ParcelSpatialReference;
  useCode?: string;
  requestedAnalyses?: readonly E85RequestedAnalysis[];
}

function decide(spec: DecideSpec = {}): E85DecisionPackage {
  const legal = spec.legal ?? [c2cBundle()];
  const parcel = spec.parcel ?? SYNTHETIC_PARCEL_IN_C_2C();
  const adapter = legal.length === 0 ? createVancouverZoningSpatialAdapter({}) : createVancouverZoningSpatialAdapter(vancouverZoningLinkPolicyFromLegalBundles(legal));
  const registry = createE85SpatialAdapterRegistry([adapter]);
  if (!registry.ok) throw new Error("adapter registry problems");
  return assembleE85DecisionPackage({
    decisionId: "phase14-c-2c",
    normalization: normalizeE85SpatialSnapshot(vancouverSnapshot(spec.records ?? [VAN_C_2C]), datasets(), registry.registry, { normalizedAt: VANCOUVER_NORMALIZED_AT }),
    parcelSpatial: parcel,
    parcel: parcelRef(parcel.parcelReferenceId),
    jurisdictionId: VANCOUVER_JURISDICTION_ID,
    zoneDesignation: "C-2C",
    useCode: spec.useCode ?? "barber_shop_or_beauty_salon",
    asOfDate: AS_OF_DATE,
    requestedAnalyses: spec.requestedAnalyses ?? TWO_SUPPORTED_FAMILIES,
    policyVersion: policy(),
    availableRulePacks: legal.map((b) => canonicalRulePackFromBundle(b, "BASE")),
    spatialRegistry: datasets(),
    resolvedAt: VANCOUVER_RESOLVED_AT,
    composedAt: COMPOSED_AT,
    assembledAt: ASSEMBLED_AT,
  });
}

describe("E85 Phase 14.4B — real spatial->legal->composition->evaluation->decision for C-2C", () => {
  test("Phase 8 links the real 494642 feature, Phase 7 applies it, the pack resolves, Phase 6 composes it, Phase 4 evaluates it", () => {
    const p = decide();

    if (p.phase8.outcome !== "NORMALIZED") throw new Error("expected NORMALIZED");
    expect(p.phase8.features.find((f) => f.featureId === "494642")?.rulePackIds).toEqual([C_2C_PACK_ID]);

    expect(p.phase7?.hits.find((h) => h.featureId === "494642")?.relation).toBe("CONTAINS");
    expect(p.phase7?.hits.find((h) => h.featureId === "494642")?.applicability).toBe("APPLIES");
    expect(p.phase7?.applicableRulePackIds).toEqual([C_2C_PACK_ID]);

    expect(p.packResolution.resolved.map((r) => r.packId)).toEqual([C_2C_PACK_ID]);
    expect(p.packResolution.unresolvedPackIds).toEqual([]);

    if (p.phase6?.outcome !== "COMPOSED") throw new Error("expected COMPOSED");
    expect(p.phase6.composed.contributingPackIds).toEqual([C_2C_PACK_ID]);
    expect(p.phase6.composed.supportedRuleFamilies.slice().sort()).toEqual(["DIMENSIONAL", "USE"]);
  });

  /* ------------------------------------------------------------------ *
   * KEY PROOF 1 — USE + DIMENSIONAL is COMPLETE, no coverage blocker.
   * ------------------------------------------------------------------ */
  test("KEY PROOF: requesting USE + DIMENSIONAL (exactly what C-2C supports) is COMPLETE with no coverage blocker", () => {
    const p = decide({ requestedAnalyses: TWO_SUPPORTED_FAMILIES });
    expect(p.materiality.some((m) => m.sourceCode === "REQUESTED_FAMILY_NOT_SUPPORTED")).toBe(false);
    expect(p.evaluationCompleteness).toBe("COMPLETE");
    expect(p.blockers.filter((b) => b.sourceCode === "REQUESTED_FAMILY_NOT_SUPPORTED")).toEqual([]);

    expect(p.phase4?.usePermission?.status).toBe("PERMITTED");
    expect(p.phase4?.usePermission?.useCode).toBe("barber_shop_or_beauty_salon");
    const envelope =
      p.phase4?.result.status === "MACHINE_RESOLVED" || p.phase4?.result.status === "MACHINE_RESOLVED_WITH_WARNINGS" ? p.phase4.result.envelope?.envelope : p.phase4?.result.partialEnvelope?.envelope;
    expect(envelope?.setbacksMetres?.front?.value).toBe(2.5);
    expect(envelope?.setbacksMetres?.front?.provenance.sourceId).toBe(VANCOUVER_C_2C_SOURCE_ID);
  });

  /* ------------------------------------------------------------------ *
   * KEY PROOF 2 — all four families -> exactly DENSITY + REQUIREMENT
   * coverage blockers, legal status not corrupted.
   * ------------------------------------------------------------------ */
  test("KEY PROOF: requesting all four families raises the coverage blocker for exactly DENSITY and REQUIREMENT, never USE or DIMENSIONAL", () => {
    const p = decide({ requestedAnalyses: FOUR_FAMILIES });
    const coverageBlockers = p.blockers.filter((b) => b.sourceCode === "REQUESTED_FAMILY_NOT_SUPPORTED");
    expect(coverageBlockers.map((b) => b.families).flat().sort()).toEqual(["DENSITY", "REQUIREMENT"]);
    expect(coverageBlockers.every((b) => b.kind === "COMPLETENESS")).toBe(true);
    expect(coverageBlockers.every((b) => b.materiality === "MATERIAL")).toBe(true);
    expect(p.evaluationCompleteness).toBe("PARTIAL");
  });

  test("KEY PROOF: the terminal legal status is NOT corrupted by the coverage blocker — the modeled families' clean result stands", () => {
    const p = decide({ requestedAnalyses: FOUR_FAMILIES });
    // A COMPLETENESS-kind blocker is invisible to determineE85DecisionStatus's
    // kind-based switch (the same generic invariant `decision-orchestration.test.ts`
    // proves for the synthetic fixture) — status is decided by what Phase 4
    // actually concluded about the families it DID evaluate (USE + DIMENSIONAL),
    // both of which are clean here.
    expect(p.status).not.toBe("DATA_GAP");
    expect(p.status).not.toBe("MANUAL_REVIEW_REQUIRED");
    expect(["MACHINE_RESOLVED", "MACHINE_RESOLVED_WITH_WARNINGS"]).toContain(p.status);

    // And the modeled families resolve exactly as they would have alone.
    expect(p.phase4?.usePermission?.status).toBe("PERMITTED");
    expect(p.phase4?.resolvedMaxFsr).toBeUndefined();
    expect(p.phase4?.requirements ?? []).toEqual([]);
  });

  test("requesting only DENSITY (fully unsupported) alone still leaves USE/DIMENSIONAL untouched if also requested, and is PARTIAL if DENSITY is requested alone", () => {
    const p = decide({ requestedAnalyses: ["DENSITY"] });
    const [blocker] = p.blockers.filter((b) => b.sourceCode === "REQUESTED_FAMILY_NOT_SUPPORTED");
    expect(blocker).toBeDefined();
    expect(blocker.families).toEqual(["DENSITY"]);
    expect(p.evaluationCompleteness).toBe("PARTIAL");
  });

  test("no bundle supplied leaves the C-2C feature unlinked and the parcel materially blocked", () => {
    const p = decide({ legal: [] });
    expect(p.phase7?.hits.find((h) => h.featureId === "494642")?.relation).toBe("CONTAINS");
    expect(p.materiality.some((m) => m.featureId === "494642" && m.materiality === "MATERIAL")).toBe(true);
    expect(p.status).not.toBe("MACHINE_RESOLVED");
  });

  test("the pipeline's USE conclusion matches evaluating the composed bundle directly", () => {
    const p = decide();
    const direct = evaluateZoningAndLandUse({
      parcel: parcelRef("direct-check"),
      jurisdictionId: VANCOUVER_JURISDICTION_ID,
      zoneDesignation: "C-2C",
      useCode: "barber_shop_or_beauty_salon",
      asOfDate: AS_OF_DATE,
      requestedAnalyses: TWO_SUPPORTED_FAMILIES,
      policyVersion: policy(),
      rules: c2cBundle().rules,
    });
    expect(p.phase4?.usePermission?.status).toBe(direct.usePermission?.status);
    expect(p.phase4?.result.status).toBe(direct.result.status);
  });

  test("trace: real spatial (494642) and real legal (C-2C source id) provenance are both traceable", () => {
    const p = decide();
    const trace = JSON.stringify(p.trace);
    expect(trace).toContain(C_2C_PACK_ID);
    expect(trace).toContain(VANCOUVER_C_2C_SOURCE_ID);
    expect(trace).toContain("494642");
  });

  /* ------------------------------------------------------------------ *
   * GATE 2 (Phase 14.4B pre-commit safety gate) — within-family honesty
   * check. USE is a "supported" family for C-2C, but this pilot's slice
   * structures only 6 of ~71 real use rows. "Retail Store" is a REAL C-2C
   * use (confirmed outright in `02-provision-inventory.md`) that this pilot
   * deliberately never gives a use code (see `c-2c-terminology.ts` and the
   * adapter test "Retail Store is never given a use code"), because it
   * carries known Section 11 qualifications (a liquor-store carve-out and a
   * used-merchandise floor-area allowance) this narrow slice does not
   * attempt to model.
   *
   * A real caller asking about Retail Store would spell the use code the
   * same way this adapter spells every other C-2C use code — lower_snake_case
   * of the by-law's own name (see `VANCOUVER_C_2C_USE_CODE_TERMS`), i.e.
   * "retail_store" — NOT a string manufactured to force a particular result.
   * No fact in this pack's fixture is ever emitted under that code, so this
   * proves what the EXISTING generic `evaluateUsePermission` (use-evaluation.ts)
   * behavior already does when zero rules in a pack match a requested useCode:
   * it must resolve to an honest UNKNOWN, never a false PERMITTED or a false
   * PROHIBITED — the same "absence is not prohibition" invariant already
   * proven for R1-1, now confirmed against a second real district and a real,
   * named, unmodeled use within an otherwise-"supported" family.
   */
  test("GATE 2: requesting USE for Retail Store (a real C-2C use this pilot deliberately does not structure) resolves to honest UNKNOWN, never a false PERMITTED or PROHIBITED", () => {
    const p = decide({ useCode: "retail_store", requestedAnalyses: ["USE"] });

    // No REQUESTED_FAMILY_NOT_SUPPORTED coverage blocker: USE genuinely is a
    // supported family for this pack. This is NOT the Phase 14.4A.1 whole-family
    // defect — it is the narrower, previously-unchecked within-family case.
    expect(p.materiality.some((m) => m.sourceCode === "REQUESTED_FAMILY_NOT_SUPPORTED")).toBe(false);
    expect(p.blockers.filter((b) => b.sourceCode === "REQUESTED_FAMILY_NOT_SUPPORTED")).toEqual([]);

    // The honest, non-affirmative outcome: UNKNOWN, not PERMITTED, not PROHIBITED.
    expect(p.phase4?.usePermission?.status).toBe("UNKNOWN");
    expect(p.phase4?.usePermission?.useCode).toBe("retail_store");
    expect(p.phase4?.usePermission?.status).not.toBe("PERMITTED");
    expect(p.phase4?.usePermission?.status).not.toBe("PROHIBITED");

    // The terminal decision status must not silently look like a clean
    // affirmative resolution for this use — evaluateUsePermission's own
    // warning path is surfaced, not swallowed.
    expect(p.status).not.toBe("MACHINE_RESOLVED");
  });

  test("sourceFindings: the real, narrow C-2C disclosure findings are traceable on the decision package", () => {
    const p = decide();
    expect(p.sourceFindings.length).toBeGreaterThan(0);
    for (const sf of p.sourceFindings) {
      expect(sf.packId).toBe(C_2C_PACK_ID);
      expect(sf.sourceId).toBe(VANCOUVER_C_2C_SOURCE_ID);
      expect(sf.sourceVersionId).toBe(VANCOUVER_C_2C_VERSION_ID);
    }
    expect(p.sourceFindings.some((sf) => sf.finding.message.includes("angular building envelope"))).toBe(true);
  });
});

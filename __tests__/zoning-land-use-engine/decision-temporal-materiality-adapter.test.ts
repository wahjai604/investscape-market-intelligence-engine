/**
 * InvestScape™ E85 Phase 15.18A — temporal decision-materiality adapter
 * tests, Slice 3F-2.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Synthetic identifiers only (TEST-LINEAGE-*) — no Vancouver/Burnaby/
 * R1-1/C-2C fixture is imported anywhere here. Exercises
 * `buildE85TemporalLineageMaterialityRecords` directly against
 * hand-constructed `E85TemporalDecisionImpact` values, independent of the
 * real Slice 2/3D-1/3D-3/3E pipeline (that pipeline reuse is proven at the
 * orchestrator level in decision-orchestration.test.ts).
 */
import {
  buildE85TemporalLineageMaterialityRecords,
  E85TemporalDecisionMaterialityAdapterError,
} from "../../src/zoning-land-use-engine/decision-temporal-materiality-adapter";
import type { E85TemporalDecisionImpact, E85TemporalImpactKind } from "../../src/zoning-land-use-engine/temporal-decision-impact";
import type { E85TemporalSelectionResult } from "../../src/zoning-land-use-engine/temporal-selection";
import type { E85TemporalLineageGroup } from "../../src/zoning-land-use-engine/temporal-lineage-grouping";

const ASSESSED_AT = "2026-03-01T00:00:00.000Z";

const SELECTOR_KIND_BY_IMPACT: Partial<Record<E85TemporalImpactKind, E85TemporalSelectionResult["kind"]>> = {
  AS_OF_SELECTED: "SELECTED",
  AS_OF_TEMPORALLY_AMBIGUOUS: "TEMPORALLY_AMBIGUOUS",
  AS_OF_INSUFFICIENT_EVIDENCE: "INSUFFICIENT_TEMPORAL_EVIDENCE",
  AS_OF_CONFLICTING_EVIDENCE: "CONFLICTING_TEMPORAL_EVIDENCE",
  AS_OF_OUTSIDE_VALIDITY_INTERVAL: "OUTSIDE_VALIDITY_INTERVAL",
  AS_OF_FUTURE_EFFECTIVE: "FUTURE_EFFECTIVE",
  AS_OF_SUPERSEDED: "SUPERSEDED",
  CURRENT_REFERENCE_BASIS_UNAVAILABLE: "INSUFFICIENT_TEMPORAL_EVIDENCE",
};

function selectorResultFor(kind: E85TemporalSelectionResult["kind"]): E85TemporalSelectionResult {
  return {
    kind,
    candidateIdsConsidered: kind === "TEMPORALLY_AMBIGUOUS" || kind === "CONFLICTING_TEMPORAL_EVIDENCE" ? ["TEST-A", "TEST-B"] : ["TEST-A"],
    ...(kind === "SELECTED" ? { selectedCandidateId: "TEST-A" } : {}),
    reasons: [`TEST reason for ${kind}.`],
  };
}

const NON_READY_GROUP: E85TemporalLineageGroup = {
  kind: "GROUP_NO_CANDIDATE",
  lineageId: "TEST-LINEAGE-NR",
  members: [],
  nonCandidateMembers: [],
  collisionFindings: [],
};

function selectorImpact(lineageId: string, requestMode: "AS_OF" | "CURRENT", impactKind: E85TemporalImpactKind, asOfDate?: string): E85TemporalDecisionImpact {
  const selectorKind = SELECTOR_KIND_BY_IMPACT[impactKind];
  if (selectorKind === undefined) throw new Error(`no selector kind mapped for ${impactKind} in test helper.`);
  const disposition =
    impactKind === "AS_OF_SELECTED"
      ? "NONE"
      : impactKind === "AS_OF_CONFLICTING_EVIDENCE"
        ? "MANUAL_REVIEW_REQUIRED"
        : "DATA_GAP";
  return {
    lineageId,
    requestMode,
    ...(asOfDate === undefined ? {} : { asOfDate }),
    impactKind,
    disposition,
    policy: {
      blockerRelevant: disposition !== "NONE",
      completenessRecommendation: disposition === "NONE" ? "UNCHANGED" : "PARTIAL",
      machineResolvedEligible: disposition === "NONE",
      manualReviewRecommendation: disposition === "MANUAL_REVIEW_REQUIRED" ? "REQUIRED" : "NONE",
    },
    origin: "SELECTOR_DERIVED",
    selectorResult: selectorResultFor(selectorKind),
  } as E85TemporalDecisionImpact;
}

function groupingImpact(lineageId: string, requestMode: "AS_OF" | "CURRENT", impactKind: E85TemporalImpactKind): E85TemporalDecisionImpact {
  return {
    lineageId,
    requestMode,
    impactKind,
    disposition: "DATA_GAP",
    policy: { blockerRelevant: true, completenessRecommendation: "PARTIAL", machineResolvedEligible: false, manualReviewRecommendation: "NONE" },
    origin: "GROUPING_DERIVED",
    group: { ...NON_READY_GROUP, lineageId },
  } as E85TemporalDecisionImpact;
}

describe("E85 Phase 15.18A (Slice 3F-2) — buildE85TemporalLineageMaterialityRecords", () => {
  test("1. zero impacts yields zero records", () => {
    expect(buildE85TemporalLineageMaterialityRecords([], ASSESSED_AT)).toEqual([]);
  });

  test("2. AS_OF_SELECTED produces exactly one MATERIAL GAP record — never zero, never claims application", () => {
    const impact = selectorImpact("TEST-LINEAGE-1", "AS_OF", "AS_OF_SELECTED", "2026-02-12");
    const records = buildE85TemporalLineageMaterialityRecords([impact], ASSESSED_AT);
    expect(records).toHaveLength(1);
    expect(records[0].kind).toBe("GAP");
    expect(records[0].materiality).toBe("MATERIAL");
    expect(records[0].sourceCode).toBe("TEMPORAL_CANDIDATE_SELECTED_NOT_APPLIED");
    expect(records[0].gap?.reasonCode).toBe("TEMPORAL_CANDIDATE_SELECTED_NOT_APPLIED");
    expect(records[0].reason).toMatch(/NOT applied to rule-pack evaluation/);
    expect(records[0].reason).not.toMatch(/controlled evaluation/i);
    expect(records[0].sourceRef).toBe("TEMPORAL_LINEAGE:TEST-LINEAGE-1:AS_OF_SELECTED:AS_OF:2026-02-12");
    expect(records[0].sourcePhase).toBe("TEMPORAL_REQUEST");
  });

  test("3. AS_OF_CONFLICTING_EVIDENCE produces a MANUAL_REVIEW record, not a GAP", () => {
    const impact = selectorImpact("TEST-LINEAGE-2", "AS_OF", "AS_OF_CONFLICTING_EVIDENCE", "2026-02-12");
    const records = buildE85TemporalLineageMaterialityRecords([impact], ASSESSED_AT);
    expect(records).toHaveLength(1);
    expect(records[0].kind).toBe("MANUAL_REVIEW");
    expect(records[0].materiality).toBe("MATERIAL");
    expect(records[0].manualReview?.reasonCode).toBe("CONFLICTING_AUTHORITATIVE_SOURCES");
    expect(records[0].gap).toBeUndefined();
  });

  test.each<[E85TemporalImpactKind, string]>([
    ["AS_OF_TEMPORALLY_AMBIGUOUS", "TEMPORAL_CANDIDATE_AMBIGUOUS"],
    ["AS_OF_INSUFFICIENT_EVIDENCE", "TEMPORAL_CANDIDATE_INSUFFICIENT_EVIDENCE"],
    ["AS_OF_OUTSIDE_VALIDITY_INTERVAL", "TEMPORAL_CANDIDATE_OUTSIDE_VALIDITY"],
    ["AS_OF_FUTURE_EFFECTIVE", "TEMPORAL_CANDIDATE_FUTURE_EFFECTIVE"],
    ["AS_OF_SUPERSEDED", "TEMPORAL_CANDIDATE_SUPERSEDED"],
  ])("4. AS_OF selector-derived %s maps to reason code %s (GAP, MATERIAL)", (impactKind, reasonCode) => {
    const impact = selectorImpact("TEST-LINEAGE-3", "AS_OF", impactKind, "2026-02-12");
    const records = buildE85TemporalLineageMaterialityRecords([impact], ASSESSED_AT);
    expect(records).toHaveLength(1);
    expect(records[0].kind).toBe("GAP");
    expect(records[0].materiality).toBe("MATERIAL");
    expect(records[0].sourceCode).toBe(reasonCode);
    expect(records[0].gap?.reasonCode).toBe(reasonCode);
    expect(records[0].sourceRef).toBe(`TEMPORAL_LINEAGE:TEST-LINEAGE-3:${impactKind}:AS_OF:2026-02-12`);
  });

  test("5. CURRENT_REFERENCE_BASIS_UNAVAILABLE maps to TEMPORAL_CURRENT_REFERENCE_UNAVAILABLE and never carries an asOfDate suffix", () => {
    const impact = selectorImpact("TEST-LINEAGE-4", "CURRENT", "CURRENT_REFERENCE_BASIS_UNAVAILABLE");
    const records = buildE85TemporalLineageMaterialityRecords([impact], ASSESSED_AT);
    expect(records[0].sourceCode).toBe("TEMPORAL_CURRENT_REFERENCE_UNAVAILABLE");
    expect(records[0].sourceRef).toBe("TEMPORAL_LINEAGE:TEST-LINEAGE-4:CURRENT_REFERENCE_BASIS_UNAVAILABLE:CURRENT");
  });

  test.each<E85TemporalImpactKind>([
    "CURRENT_LINEAGE_BLOCKED",
    "CURRENT_LINEAGE_EVIDENCE_INCOMPLETE",
    "CURRENT_LINEAGE_NO_CANDIDATE",
    "AS_OF_LINEAGE_BLOCKED",
    "AS_OF_LINEAGE_EVIDENCE_INCOMPLETE",
    "AS_OF_LINEAGE_NO_CANDIDATE",
  ])("6. grouping-derived %s maps to TEMPORAL_LINEAGE_NOT_READY", (impactKind) => {
    const requestMode = impactKind.startsWith("CURRENT") ? "CURRENT" : "AS_OF";
    const impact = groupingImpact("TEST-LINEAGE-5", requestMode, impactKind);
    const records = buildE85TemporalLineageMaterialityRecords([impact], ASSESSED_AT);
    expect(records).toHaveLength(1);
    expect(records[0].sourceCode).toBe("TEMPORAL_LINEAGE_NOT_READY");
    expect(records[0].kind).toBe("GAP");
  });

  test("7. multiple lineages: one record per impact, order preserved from input (no re-sort inside the adapter)", () => {
    const impacts = [
      selectorImpact("TEST-LINEAGE-B", "AS_OF", "AS_OF_SELECTED", "2026-01-01"),
      selectorImpact("TEST-LINEAGE-A", "AS_OF", "AS_OF_CONFLICTING_EVIDENCE", "2026-01-01"),
    ];
    const records = buildE85TemporalLineageMaterialityRecords(impacts, ASSESSED_AT);
    expect(records.map((r) => r.sourceRef)).toEqual([
      "TEMPORAL_LINEAGE:TEST-LINEAGE-B:AS_OF_SELECTED:AS_OF:2026-01-01",
      "TEMPORAL_LINEAGE:TEST-LINEAGE-A:AS_OF_CONFLICTING_EVIDENCE:AS_OF:2026-01-01",
    ]);
  });

  test("8. no duplicate records for one lineage outcome, and MANUAL_REVIEW is never silently suppressed alongside a DATA_GAP", () => {
    const impacts = [
      selectorImpact("TEST-LINEAGE-6", "AS_OF", "AS_OF_INSUFFICIENT_EVIDENCE", "2026-01-01"),
      selectorImpact("TEST-LINEAGE-7", "AS_OF", "AS_OF_CONFLICTING_EVIDENCE", "2026-01-01"),
    ];
    const records = buildE85TemporalLineageMaterialityRecords(impacts, ASSESSED_AT);
    expect(records).toHaveLength(2);
    expect(records.filter((r) => r.kind === "GAP")).toHaveLength(1);
    expect(records.filter((r) => r.kind === "MANUAL_REVIEW")).toHaveLength(1);
  });

  test("9. deterministic sourceRef collision safety: distinct lineageIds never collide even with identical impactKind/date", () => {
    const impacts = [
      selectorImpact("TEST-LINEAGE-X", "AS_OF", "AS_OF_SUPERSEDED", "2026-01-01"),
      selectorImpact("TEST-LINEAGE-Y", "AS_OF", "AS_OF_SUPERSEDED", "2026-01-01"),
    ];
    const records = buildE85TemporalLineageMaterialityRecords(impacts, ASSESSED_AT);
    expect(new Set(records.map((r) => r.sourceRef)).size).toBe(2);
  });

  test("10. malformed impacts argument throws the adapter's own typed error, not a DATA_GAP", () => {
    expect(() => buildE85TemporalLineageMaterialityRecords(null as never, ASSESSED_AT)).toThrow(E85TemporalDecisionMaterialityAdapterError);
    expect(() => buildE85TemporalLineageMaterialityRecords([], "" as never)).toThrow(E85TemporalDecisionMaterialityAdapterError);
  });

  test("11. gap.checkedAt / manualReview.flaggedAt use the caller-supplied assessedAt, never a fresh clock read", () => {
    const gapImpact = selectorImpact("TEST-LINEAGE-8", "AS_OF", "AS_OF_INSUFFICIENT_EVIDENCE", "2026-01-01");
    const reviewImpact = selectorImpact("TEST-LINEAGE-9", "AS_OF", "AS_OF_CONFLICTING_EVIDENCE", "2026-01-01");
    const records = buildE85TemporalLineageMaterialityRecords([gapImpact, reviewImpact], ASSESSED_AT);
    expect(records[0].gap?.checkedAt).toBe(ASSESSED_AT);
    expect(records[1].manualReview?.flaggedAt).toBe(ASSESSED_AT);
  });

  test("12. no source is promoted to CLOSED and no Feature-494642/spatial vocabulary appears anywhere in this module's source", () => {
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const source = fs.readFileSync(path.resolve(__dirname, "../../src/zoning-land-use-engine/decision-temporal-materiality-adapter.ts"), "utf8");
    for (const forbidden of ["494642", "R1-1", "C-2C", "cityModified", "cityLastProcessingData", "Burnaby", "Date.now", "new Date("]) {
      expect(source.includes(forbidden)).toBe(false);
    }
  });
});

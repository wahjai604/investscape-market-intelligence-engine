/**
 * InvestScape™ E85 Phase 9 — Decision Orchestration: materiality assessment.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * The one judgment Phase 9 makes, and the only reason the phase exists.
 *
 * Phase 8 reports problems about a LAYER. Phase 9 must decide whether each of
 * them bears on ONE PARCEL. Both possible shortcuts are wrong in opposite
 * directions and both are tempting:
 *
 *   Treat every upstream problem as fatal, and one unmapped polygon on the far
 *   edge of a municipal layer blocks every parcel in the city — which is useless
 *   and, worse, trains a caller to ignore blockers.
 *
 *   Treat upstream problems as somebody else's business, and the Phase 8A hazard
 *   walks straight through: a parcel sitting inside a polygon nobody mapped
 *   comes back with a clean status and an empty pack list, indistinguishable
 *   from ground no instrument governs.
 *
 * So materiality is decided per problem, per parcel, ON PHASE 7's OWN GEOMETRIC
 * EVIDENCE — the only authoritative statement available about whether a feature
 * reaches this parcel. Where that evidence does not exist, the answer is
 * UNDETERMINED, which blocks. It is never quietly rounded to NON_MATERIAL.
 *
 * Two rules are worth stating outright because both protect against plausible
 * reasoning:
 *
 *   BOUNDARY CONTACT IS NEVER NON-MATERIAL. Zero shared area is not evidence of
 *   irrelevance; whether abutting an instrument's boundary brings it into force
 *   is a rule of the jurisdiction, and Phase 7 already refuses to answer it.
 *
 *   UNKNOWN PACK CONTENTS ARE NOT EVIDENCE OF ABSENCE. An instrument nobody
 *   mapped cannot be declared irrelevant to PARKING because no parking rule was
 *   found in it. Family scoping is applied ONLY where an upstream phase actually
 *   stated the family.
 */
import type { E85CompositionResult } from "./composition-types";
import type { E85DecisionMaterialityRecord, E85DecisionMateriality, E85RulePackResolution } from "./decision-package-types";
import { byE85DecisionKey } from "./decision-package-types";
import type { E85SpatialRelation } from "./geometry-relations";
import type { E85RequestedAnalysis } from "./request-types";
import type { E85SpatialApplicabilityResult } from "./spatial-applicability-types";
import type { E85SpatialNormalizationResult } from "./spatial-source-adapter-contract";
import type { E85SpatialSourceFinding } from "./spatial-source-findings";

export interface E85DecisionMaterialityInput {
  phase8: E85SpatialNormalizationResult;
  /** Absent when Phase 7 never ran, which makes every feature-scoped problem UNDETERMINED. */
  phase7?: E85SpatialApplicabilityResult;
  packResolution: E85RulePackResolution;
  /** Absent when Phase 6 never ran. */
  phase6?: E85CompositionResult;
  requestedAnalyses: readonly E85RequestedAnalysis[];
  /** Stamped onto any gap record this module must construct. Caller-supplied; never a clock read. */
  assessedAt: string;
}

/**
 * Maps what the geometry said about a feature onto whether its problem matters
 * here.
 *
 * The single place this mapping is stated. `DISJOINT` is the ONLY relation that
 * proves irrelevance, and it earns that because it is the one relation whose
 * legal consequence geometry genuinely settles: a feature that never reaches a
 * parcel cannot regulate it under any jurisdiction's rule.
 */
export function e85RelationMateriality(relation: E85SpatialRelation | undefined): E85DecisionMateriality {
  switch (relation) {
    case "DISJOINT":
      return "NON_MATERIAL";
    case "CONTAINS":
    case "INTERSECTS":
      return "MATERIAL";
    case "BOUNDARY_TOUCH":
      // Contact is certain; what it means is not. Phase 7 routes this to manual
      // review rather than settling it, and Phase 9 does not settle it either.
      return "MATERIAL";
    case "UNDETERMINED":
      return "UNDETERMINED";
    default:
      // No relation at all: Phase 7 held no evidence about this feature, which
      // is the ordinary state for a QUARANTINED record — it never became a
      // feature, so nothing trustworthy was ever compared against the parcel.
      // Manufacturing a relation from a malformed boundary, a raw centroid or a
      // bounding box would be exactly the fabrication Phase 8 refused.
      return "UNDETERMINED";
  }
}

function relationReason(relation: E85SpatialRelation | undefined, featureId: string): string {
  switch (relation) {
    case "DISJOINT":
      return `Phase 7 compared feature "${featureId}" against this parcel and found them DISJOINT — they share no point. The feature cannot govern this parcel under any jurisdiction's rule, so its unresolved source problem does not bear on this decision. The problem remains recorded on the Phase 8 result, where it is still true of the layer.`;
    case "CONTAINS":
      return `Phase 7 found that feature "${featureId}" CONTAINS this parcel. The parcel lies inside a regulatory feature whose source problem is unresolved, so this decision cannot be complete.`;
    case "INTERSECTS":
      return `Phase 7 found that feature "${featureId}" INTERSECTS this parcel — they share area and the parcel is not wholly inside it. The feature reaches this parcel, so its unresolved source problem bears on this decision.`;
    case "BOUNDARY_TOUCH":
      return `Phase 7 found that feature "${featureId}" meets this parcel at a boundary or vertex only. Zero shared area is NOT evidence of irrelevance — whether abutting an instrument brings it into force is a rule of the jurisdiction, which is why Phase 7 holds it for review rather than dismissing it. The problem is treated as bearing on this decision.`;
    case "UNDETERMINED":
      return `Phase 7 could not determine how feature "${featureId}" relates to this parcel. Relevance is therefore unknown, and unknown is not irrelevance.`;
    default:
      return `Phase 7 holds no geometric evidence about "${featureId}" — it never became a comparable feature, so nothing was measured against this parcel. No relation is inferred from a withheld record's raw geometry, centroid or bounding box, so its relevance cannot be established either way.`;
  }
}

/**
 * Picks one representative finding PER DISTINCT PROBLEM per affected subject.
 *
 * Phase 8 legitimately emits more than one finding about a single withheld
 * record, and the two cases must not be confused:
 *
 *   ONE PROBLEM DESCRIBED TWICE. `FEATURE_QUARANTINED` says a record was
 *   withheld and a specific code says why. Both are true, both stay on the
 *   Phase 8 result, and turning them into two blockers would overstate how much
 *   is wrong. The generic one is suppressed.
 *
 *   TWO GENUINELY DIFFERENT PROBLEMS that happen to concern the same record —
 *   which `E85QuarantinedSpatialRecord.reasonCodes` explicitly provides for
 *   ("More than one can be true at once and all are reported"). BOTH must
 *   survive. Collapsing them was a real defect: it erased blockers outright,
 *   and because the terminal-status policy reads a blocker's KIND, erasing a
 *   MANUAL_REVIEW in favour of a GAP silently downgraded the whole decision
 *   from "a person must settle this" to "go find missing evidence".
 *
 * So the grouping key is the PROBLEM IDENTITY — subject plus finding code —
 * which is exactly the identity `sourceRef` already publishes downstream. It is
 * deliberately not the subject alone, and deliberately not the code alone.
 *
 * Deterministic throughout: findings are ordered by code before selection, so
 * neither the survivors nor their order depends on emission order.
 */
function representativeFindings(findings: readonly E85SpatialSourceFinding[]): readonly E85SpatialSourceFinding[] {
  const bySubject = new Map<string, E85SpatialSourceFinding[]>();
  for (const finding of findings) {
    const subject = finding.featureId ?? finding.rawRecordRef ?? "";
    const existing = bySubject.get(subject);
    if (existing === undefined) bySubject.set(subject, [finding]);
    else existing.push(finding);
  }

  const chosen: E85SpatialSourceFinding[] = [];
  for (const [subject, group] of bySubject) {
    if (subject === "") {
      // Snapshot-scoped findings have no subject to collapse against; each is
      // its own fact about the whole payload.
      chosen.push(...group);
      continue;
    }

    const ordered = [...group].sort((a, b) => byE85DecisionKey(a.code, b.code));
    const specific = ordered.filter((f) => f.code !== "FEATURE_QUARANTINED");
    // The generic code is dropped only when a specific reason exists to replace
    // it. Alone, it is the only account of the problem there is, and deleting it
    // would remove the blocker entirely.
    const surviving = specific.length > 0 ? specific : ordered;

    // One representative per distinct code. A repeat of the same code about the
    // same subject IS the same problem reported twice, and still collapses.
    const byCode = new Map<string, E85SpatialSourceFinding>();
    for (const finding of surviving) if (!byCode.has(finding.code)) byCode.set(finding.code, finding);
    chosen.push(...byCode.values());
  }
  return chosen;
}

/**
 * Assesses every upstream blocker against this parcel and these requested
 * analyses.
 *
 * Pure, deterministic, clock-free and order-independent: the result is sorted
 * canonically and no branch consults array position.
 */
export function assessE85DecisionMateriality(input: E85DecisionMaterialityInput): readonly E85DecisionMaterialityRecord[] {
  const { phase8, phase7, packResolution, phase6, requestedAnalyses, assessedAt } = input;
  const records: E85DecisionMaterialityRecord[] = [];

  // ---- Phase 8, snapshot-level refusal. Nothing downstream is reachable.
  if (phase8.outcome === "UNSUPPORTED") {
    records.push({
      sourceRef: `SPATIAL_NORMALIZATION:${phase8.reason}:${phase8.snapshotId}`,
      sourcePhase: "SPATIAL_NORMALIZATION",
      sourceCode: phase8.reason,
      kind: "GAP",
      materiality: "MATERIAL",
      reason:
        `Phase 8 refused snapshot "${phase8.snapshotId}" outright (${phase8.reason}), so no regulatory feature exists to compare against this parcel. ` +
        `A refusal at snapshot level is a fact about every record at once; there is no subset to salvage and no geometry with which to prove any feature irrelevant.`,
      gap: phase8.gap,
    });
    return sortRecords(records);
  }

  // ---- Phase 8, feature-level problems, judged against Phase 7's evidence.
  const blocking = phase8.findings.filter((f) => f.severity === "GAP" || f.severity === "MANUAL_REVIEW");
  for (const finding of representativeFindings(blocking)) {
    const featureId = finding.featureId;

    if (featureId === undefined) {
      // A problem Phase 8 could not attribute to a feature (a record with no
      // authoritative id, for instance). Nothing identifies what ground it
      // concerns, so nothing can prove it does not concern this ground.
      records.push({
        sourceRef: `SPATIAL_NORMALIZATION:${finding.code}:${finding.rawRecordRef ?? phase8.snapshotId}`,
        sourcePhase: "SPATIAL_NORMALIZATION",
        sourceCode: finding.code,
        kind: finding.severity === "MANUAL_REVIEW" ? "MANUAL_REVIEW" : "GAP",
        materiality: "UNDETERMINED",
        reason:
          `Phase 8 reported ${finding.code} for record ${finding.rawRecordRef ?? "(unlocated)"}, which carries no authoritative feature identity. ` +
          `Without an identity there is nothing for Phase 7 to have compared against this parcel, so whether it bears on this decision cannot be established.`,
        ...(finding.gap === undefined ? {} : { gap: finding.gap }),
        ...(finding.manualReview === undefined ? {} : { manualReview: finding.manualReview }),
      });
      continue;
    }

    const hit = phase7?.hits.find((h) => h.featureId === featureId);
    const relation = hit?.relation;
    const materiality = e85RelationMateriality(relation);

    records.push({
      sourceRef: `SPATIAL_NORMALIZATION:${finding.code}:${featureId}`,
      sourcePhase: "SPATIAL_NORMALIZATION",
      sourceCode: finding.code,
      kind: finding.severity === "MANUAL_REVIEW" ? "MANUAL_REVIEW" : "GAP",
      materiality,
      reason: relationReason(relation, featureId),
      featureId,
      ...(relation === undefined ? {} : { spatialRelation: relation }),
      // No `families`: an unmapped or withheld instrument's contents are
      // unknown, and unknown contents may bear on any requested family.
      ...(finding.gap === undefined ? {} : { gap: finding.gap }),
      ...(finding.manualReview === undefined ? {} : { manualReview: finding.manualReview }),
    });
  }

  // ---- Phase 7's own problems. These are already parcel-specific by
  //      construction — Phase 7 raised them ABOUT this parcel — so there is no
  //      further relevance question to ask. Materiality is MATERIAL.
  for (const finding of phase7?.findings ?? []) {
    if (finding.severity !== "GAP" && finding.severity !== "MANUAL_REVIEW") continue;
    const subject = (finding.featureIds ?? []).slice().sort(byE85DecisionKey).join(",");
    records.push({
      sourceRef: `SPATIAL_APPLICABILITY:${finding.code}:${subject}`,
      sourcePhase: "SPATIAL_APPLICABILITY",
      sourceCode: finding.code,
      kind: finding.severity === "MANUAL_REVIEW" ? "MANUAL_REVIEW" : "GAP",
      materiality: "MATERIAL",
      reason: `Phase 7 raised ${finding.code} about this parcel directly: ${finding.message}`,
      ...(finding.featureIds?.length === 1 ? { featureId: finding.featureIds[0] } : {}),
      ...(finding.gap === undefined ? {} : { gap: finding.gap }),
      ...(finding.manualReview === undefined ? {} : { manualReview: finding.manualReview }),
    });
  }

  // ---- Rule-pack resolution.
  for (const packId of packResolution.unresolvedPackIds) {
    records.push({
      sourceRef: `RULE_PACK_RESOLUTION:RULE_PACK_NOT_SUPPLIED:${packId}`,
      sourcePhase: "RULE_PACK_RESOLUTION",
      sourceCode: "RULE_PACK_NOT_SUPPLIED",
      kind: "GAP",
      materiality: "MATERIAL",
      reason:
        `Phase 7 established that rule pack "${packId}" applies to this parcel, and no pack with that exact id was supplied. ` +
        `The instrument is identified and its rules are not in hand. The id is neither dropped nor filled with an empty pack: both would report that this instrument imposes nothing, which is a legal claim no source made.`,
      packId,
      // Deliberately unscoped by family. Nothing is known about what an
      // unsupplied pack regulates, so it may bear on any requested analysis.
      gap: {
        reasonCode: "RULE_NOT_STRUCTURED",
        reason: `Rule pack "${packId}" is applicable to this parcel but no structured rule content for it was supplied to the decision.`,
        sourcesChecked: phase8.outcome === "NORMALIZED" ? [phase8.datasetId] : [],
        checkedAt: assessedAt,
        resolutionHint: `Supply the E85RulePack with packId "${packId}", or normalize the instrument it refers to.`,
      },
    });
  }

  for (const packId of packResolution.conflictingPackIds) {
    records.push({
      sourceRef: `RULE_PACK_RESOLUTION:CONFLICTING_RULE_PACK_DEFINITIONS:${packId}`,
      sourcePhase: "RULE_PACK_RESOLUTION",
      sourceCode: "CONFLICTING_RULE_PACK_DEFINITIONS",
      kind: "MANUAL_REVIEW",
      materiality: "MATERIAL",
      reason:
        `More than one rule pack was supplied under the id "${packId}" with materially different content. Neither was chosen: preferring the first or the last would make this parcel's regulatory answer depend on the caller's array order.`,
      packId,
      manualReview: {
        reasonCode: "CONFLICTING_AUTHORITATIVE_SOURCES",
        explanation: `Two or more supplied rule packs claim the identity "${packId}" but state different rules. A person must establish which definition is the governing instrument.`,
        evidenceConsidered: [packId],
        flaggedAt: assessedAt,
      },
    });
  }

  for (const packId of packResolution.collapsedDuplicatePackIds) {
    // Recorded so a caller can see a duplicate was noticed and counted once. A
    // repeated read of one instrument is not corroboration and not a problem.
    records.push({
      sourceRef: `RULE_PACK_RESOLUTION:DUPLICATE_RULE_PACK_COLLAPSED:${packId}`,
      sourcePhase: "RULE_PACK_RESOLUTION",
      sourceCode: "DUPLICATE_RULE_PACK_COLLAPSED",
      kind: "GAP",
      materiality: "NON_MATERIAL",
      reason: `Rule pack "${packId}" was supplied more than once, identically, and was counted once. A repeated copy of one instrument adds no authority and raises no question.`,
      packId,
    });
  }

  // ---- Phase 6.
  if (phase6?.outcome === "REFUSED") {
    records.push({
      sourceRef: `COMPOSITION:COMPOSITION_REFUSED:${phase6.problems.map((p) => p.code).sort(byE85DecisionKey).join(",")}`,
      sourcePhase: "COMPOSITION",
      sourceCode: "COMPOSITION_REFUSED",
      kind: "MANUAL_REVIEW",
      materiality: "MATERIAL",
      reason: `Phase 6 refused to compose the applicable packs: ${phase6.problems.map((p) => p.detail).join(" ")}`,
      manualReview: phase6.manualReview,
    });
  }

  if (phase6?.outcome === "COMPOSED") {
    for (const conflict of phase6.composed.unresolvedConflicts) {
      // PHASE 6's OWN FAMILY, REUSED. Phase 9 does not re-derive which analyses
      // a legal conflict touches, and does not broaden or narrow it. The family
      // is stated by Phase 6; whether the caller asked about it is the existing
      // E85 materiality rule, applied unchanged.
      const material = requestedAnalyses.includes(conflict.family);
      records.push({
        sourceRef: `COMPOSITION:UNRESOLVED_CONFLICT:${conflict.conceptKey}`,
        sourcePhase: "COMPOSITION",
        sourceCode: "UNRESOLVED_CONFLICT",
        kind: "MANUAL_REVIEW",
        materiality: material ? "MATERIAL" : "NON_MATERIAL",
        reason: material
          ? `Phase 6 left concept "${conflict.conceptKey}" (${conflict.family}) undecided between competing authoritative claims, and ${conflict.family} is a requested analysis. No value is chosen here: precedence is Phase 6's to state and it stated none.`
          : `Phase 6 left concept "${conflict.conceptKey}" (${conflict.family}) undecided, and ${conflict.family} was not requested for this decision. The conflict is retained in full on the Phase 6 result and does not block the analyses that were requested.`,
        families: [conflict.family],
        manualReview: {
          reasonCode: "CONFLICTING_AUTHORITATIVE_SOURCES",
          explanation: conflict.detail,
          evidenceConsidered: conflict.claims.map((c) => c.packId).sort(byE85DecisionKey),
          flaggedAt: assessedAt,
        },
      });
    }

    // ---- Requested-family coverage. Only trustworthy when pack resolution is
    //      completely clean: an unresolved pack's contents are UNKNOWN (see the
    //      RULE_PACK_NOT_SUPPLIED block above), so it might have been the very
    //      thing that would have covered a family the composed union appears to
    //      lack. Comparing against the union in that state would misreport an
    //      unknown as an affirmative "not supported". The existing
    //      RULE_PACK_NOT_SUPPLIED blocker is already unscoped by family and
    //      therefore already the conservative, correct signal for that case.
    if (packResolution.unresolvedPackIds.length === 0) {
      for (const family of requestedAnalyses) {
        if (phase6.composed.supportedRuleFamilies.includes(family)) continue;
        records.push({
          sourceRef: `RULE_PACK_RESOLUTION:REQUESTED_FAMILY_NOT_SUPPORTED:${family}`,
          sourcePhase: "RULE_PACK_RESOLUTION",
          sourceCode: "REQUESTED_FAMILY_NOT_SUPPORTED",
          kind: "COMPLETENESS",
          materiality: "MATERIAL",
          reason:
            `Requested analysis family ${family} is not declared as supported by any contributing rule pack for this decision. ` +
            `No contributing pack's adapter claims to model ${family} at all, so this is a coverage gap, not a within-family finding — ` +
            `it does not affect the legal status of any family that WAS modeled.`,
          families: [family],
        });
      }
    }

    for (const problem of phase6.composed.precedenceProblems) {
      records.push({
        sourceRef: `COMPOSITION:${problem.code}:${problem.relationIds.slice().sort(byE85DecisionKey).join(",")}`,
        sourcePhase: "COMPOSITION",
        sourceCode: problem.code,
        kind: "MANUAL_REVIEW",
        materiality: "MATERIAL",
        reason: `Phase 6 found a defect in the precedence metadata it was given: ${problem.detail}`,
        manualReview: {
          reasonCode: "OVERLAY_PRECEDENCE_UNRESOLVED",
          explanation: problem.detail,
          evidenceConsidered: problem.packIds.slice().sort(byE85DecisionKey),
          flaggedAt: assessedAt,
        },
      });
    }
  }

  return sortRecords(records);
}

/** Canonical ordering, and last-line deduplication on `sourceRef` so one underlying problem yields one record. */
function sortRecords(records: readonly E85DecisionMaterialityRecord[]): readonly E85DecisionMaterialityRecord[] {
  const seen = new Map<string, E85DecisionMaterialityRecord>();
  for (const record of records) if (!seen.has(record.sourceRef)) seen.set(record.sourceRef, record);
  return [...seen.values()].sort((a, b) => byE85DecisionKey(a.sourcePhase, b.sourcePhase) || byE85DecisionKey(a.sourceRef, b.sourceRef));
}

/**
 * InvestScape™ E85 Phase 9 — Decision Orchestration: the pipeline.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Runs Phase 8's result through Phases 7, 6 and 4, and assembles the decision
 * package. What this file does NOT do is the point of it:
 *
 *   It acquires nothing. Phase 8's RESULT is the input.
 *   It repairs no geometry, infers no CRS, transforms no coordinate.
 *   It ranks no instrument — precedence is Phase 6's, exclusively.
 *   It computes no FSR, height, setback, parking or use permission — evaluation
 *     is Phase 4's, exclusively.
 *   It reads no clock.
 *   It mutates no input.
 *
 * Its only judgment is materiality (decision-materiality.ts) and its only
 * conclusion is a terminal status derived in one place (decision-status.ts).
 * Everything else here is plumbing that refuses to lose evidence.
 *
 * A NOTE ON CONTINUING PAST A BLOCKER. Where confirmed packs exist, the pipeline
 * runs to the end even when something upstream is unresolved, because a real
 * partial answer is worth more than no answer — a caller who knows the base zone
 * permits an FSR of 1.5 and knows an overlay is unmapped is better served than
 * one told only "blocked". The safety property is not that partial work is
 * refused; it is that partial work is LABELLED, and that a package carrying any
 * blocker can never report MACHINE_RESOLVED.
 */
import { composeE85RulePacks } from "./rule-pack-composer";
import type { E85CompositionResult } from "./composition-types";
import { assessE85DecisionMateriality } from "./decision-materiality";
import type {
  E85DecisionEvaluationCompleteness,
  E85DecisionPackage,
  E85DecisionRequest,
  E85DecisionSourceFinding,
  E85DecisionStageRecord,
  E85RulePackResolution,
} from "./decision-package-types";
import { E85_DECISION_EPOCH, byE85DecisionKey } from "./decision-package-types";
import { resolveE85RulePacks } from "./decision-rule-pack-resolution";
import { determineE85DecisionStatus, e85DecisionBlockers } from "./decision-status";
import { buildE85DecisionTrace } from "./decision-trace";
import { evaluateZoningAndLandUse } from "./evaluator";
import type { E85EvaluationOutcome } from "./evaluator-result-types";
import { resolveE85SpatialApplicability } from "./spatial-applicability";
import type { E85SpatialApplicabilityResult } from "./spatial-applicability-types";

/** The empty resolution, for paths where no pack identity was ever produced. */
const NO_PACKS: E85RulePackResolution = { resolved: [], unresolvedPackIds: [], conflictingPackIds: [], collapsedDuplicatePackIds: [] };

/**
 * Phase 5 source findings from ACTUALLY CONTRIBUTING packs only, traced back to
 * their originating pack identity.
 *
 * Ordering follows `contributingPackIds` — Phase 6's own deterministic
 * (sorted) pack ordering — then each pack's own `sourceFindings` order, so the
 * result never depends on caller-supplied array order or object insertion
 * order.
 */
function collectE85DecisionSourceFindings(phase6: E85CompositionResult | undefined, packResolution: E85RulePackResolution): readonly E85DecisionSourceFinding[] {
  if (phase6 === undefined || phase6.outcome !== "COMPOSED") return [];
  const byPackId = new Map(packResolution.resolved.map((pack) => [pack.packId, pack]));
  const out: E85DecisionSourceFinding[] = [];
  for (const packId of phase6.composed.contributingPackIds) {
    const pack = byPackId.get(packId);
    if (pack === undefined || pack.sourceFindings === undefined) continue;
    for (const finding of pack.sourceFindings) {
      out.push({ packId: pack.packId, sourceId: pack.sourceId, ...(pack.sourceVersionId === undefined ? {} : { sourceVersionId: pack.sourceVersionId }), finding });
    }
  }
  return out;
}

/**
 * Orchestrates one parcel decision.
 *
 * Pure and deterministic given its inputs. Every timestamp is caller-supplied or
 * derived from retained evidence; no array's order affects any conclusion.
 */
export function assembleE85DecisionPackage(request: E85DecisionRequest): E85DecisionPackage {
  const { normalization, requestedAnalyses } = request;
  const assembledAt = request.assembledAt ?? normalization.normalizedAt ?? E85_DECISION_EPOCH;
  const stages: E85DecisionStageRecord[] = [];
  const warnings: string[] = [];

  // ---- Stage 1: Phase 8. Already run by the caller; recorded either way.
  stages.push({
    stage: "SPATIAL_NORMALIZATION",
    state: "EXECUTED",
    detail:
      normalization.outcome === "NORMALIZED"
        ? `Phase 8 normalized snapshot "${normalization.snapshotId}" into ${normalization.features.length} feature(s), withholding ${normalization.quarantined.length}.`
        : `Phase 8 refused snapshot "${normalization.snapshotId}" (${normalization.reason}): ${normalization.detail}`,
  });

  // ---- Snapshot-level refusal: nothing downstream can run on evidence that
  //      does not exist. Every later stage says so rather than going missing.
  if (normalization.outcome === "UNSUPPORTED") {
    for (const stage of ["SPATIAL_APPLICABILITY", "RULE_PACK_RESOLUTION", "COMPOSITION", "EVALUATION"] as const) {
      stages.push({
        stage,
        state: "BLOCKED",
        detail: `Not run: Phase 8 refused the snapshot (${normalization.reason}), so no regulatory feature, pack identity or rule exists for this stage to consume.`,
      });
    }

    const materiality = assessE85DecisionMateriality({ phase8: normalization, packResolution: NO_PACKS, requestedAnalyses, assessedAt: assembledAt });
    const blockers = e85DecisionBlockers(materiality);
    return {
      ...(request.decisionId === undefined ? {} : { decisionId: request.decisionId }),
      parcel: request.parcel,
      parcelSpatial: request.parcelSpatial,
      requestedAnalyses,
      phase8: normalization,
      packResolution: NO_PACKS,
      materiality,
      blockers,
      warnings,
      sourceFindings: [],
      stages,
      status: determineE85DecisionStatus({ materiality, warnings }),
      evaluationCompleteness: "NOT_EVALUATED",
      trace: buildE85DecisionTrace({ packResolution: NO_PACKS, blockers }),
      assembledAt,
    };
  }

  // ---- Stage 2: Phase 7. Handed exactly what Phase 8 produced — no filtering,
  //      no fixing-up, no substitution for what Phase 8 withheld.
  const phase7: E85SpatialApplicabilityResult = resolveE85SpatialApplicability({
    parcel: request.parcelSpatial,
    features: normalization.features,
    ...(request.spatialRegistry === undefined ? {} : { registry: request.spatialRegistry }),
    ...(request.tolerance === undefined ? {} : { tolerance: request.tolerance }),
    ...(request.mutuallyExclusiveClasses === undefined ? {} : { mutuallyExclusiveClasses: request.mutuallyExclusiveClasses }),
    ...(request.resolvedAt === undefined ? {} : { resolvedAt: request.resolvedAt }),
  });
  stages.push({
    stage: "SPATIAL_APPLICABILITY",
    state: "EXECUTED",
    detail: `Phase 7 compared ${normalization.features.length} feature(s) against parcel "${request.parcelSpatial.parcelReferenceId}" and concluded ${phase7.status}, naming ${phase7.applicableRulePackIds.length} applicable rule pack(s).`,
  });
  for (const finding of phase7.findings) {
    if (finding.severity === "WARNING") warnings.push(`Phase 7 (${finding.code}): ${finding.message}`);
  }

  // ---- Stage 3: pack resolution. Exact id match only.
  const packResolution = resolveE85RulePacks(phase7.applicableRulePackIds, request.availableRulePacks);
  stages.push({
    stage: "RULE_PACK_RESOLUTION",
    state: packResolution.unresolvedPackIds.length > 0 || packResolution.conflictingPackIds.length > 0 ? "PARTIALLY_EXECUTED" : "EXECUTED",
    detail:
      `Resolved ${packResolution.resolved.length} of ${phase7.applicableRulePackIds.length} applicable pack identity/identities by exact id. ` +
      `Unsupplied: [${packResolution.unresolvedPackIds.join(", ")}]. Conflicting duplicates: [${packResolution.conflictingPackIds.join(", ")}]. ` +
      `Identical duplicates collapsed: [${packResolution.collapsedDuplicatePackIds.join(", ")}].`,
  });

  // ---- Stage 4: Phase 6. Only confirmed packs are offered; an unresolved
  //      identity is never represented to composition as anything at all.
  let phase6: E85CompositionResult | undefined;
  if (packResolution.resolved.length === 0) {
    stages.push({
      stage: "COMPOSITION",
      state: "SKIPPED",
      detail:
        phase7.applicableRulePackIds.length === 0
          ? "Not run: Phase 7 named no applicable rule pack for this parcel, so there is nothing to compose."
          : `Not run: none of the applicable pack identities [${phase7.applicableRulePackIds.join(", ")}] resolved to a supplied rule pack.`,
    });
  } else {
    phase6 = composeE85RulePacks(packResolution.resolved, {
      ...(request.composedAt === undefined ? {} : { composedAt: request.composedAt }),
      ...(request.callerContext?.satisfiedConditions === undefined ? {} : { affirmedConditions: request.callerContext.satisfiedConditions }),
      ...(request.precedenceRelations === undefined ? {} : { precedenceRelations: request.precedenceRelations }),
    });
    stages.push({
      stage: "COMPOSITION",
      state: phase6.outcome === "COMPOSED" && packResolution.unresolvedPackIds.length === 0 ? "EXECUTED" : "PARTIALLY_EXECUTED",
      detail:
        phase6.outcome === "COMPOSED"
          ? `Phase 6 composed ${packResolution.resolved.length} pack(s) into ${phase6.composed.effectiveRules.length} effective rule(s) with status ${phase6.composed.status}.` +
            (packResolution.unresolvedPackIds.length > 0 ? ` Composed on a confirmed subset: ${packResolution.unresolvedPackIds.length} applicable identity/identities were not supplied.` : "")
          : `Phase 6 refused composition: ${phase6.problems.map((p) => p.code).join(", ")}.`,
    });
    if (phase6.outcome === "COMPOSED") {
      for (const limitation of phase6.composed.readinessLimitations) {
        warnings.push(`Phase 6 readiness limitation on pack "${limitation.packId}": ${limitation.detail}`);
      }
    }
  }

  // ---- Stage 5: Phase 4, on the rules that safely survived composition.
  let phase4: E85EvaluationOutcome | undefined;
  if (phase6?.outcome === "COMPOSED") {
    phase4 = evaluateZoningAndLandUse({
      parcel: request.parcel,
      jurisdictionId: request.jurisdictionId,
      zoneDesignation: request.zoneDesignation,
      useCode: request.useCode,
      asOfDate: request.asOfDate,
      rules: phase6.composed.effectiveRules,
      requestedAnalyses,
      policyVersion: request.policyVersion,
      ...(request.callerContext === undefined ? {} : { callerContext: request.callerContext }),
      // Phase 12B.2: proposal facts pass through to Phase 4 untouched. Phase 9
      // does not read or interpret them, and Phase 6 never receives them.
      ...(request.proposal === undefined ? {} : { proposal: request.proposal }),
    });
    if (phase4.result.status === "MACHINE_RESOLVED_WITH_WARNINGS") warnings.push(...phase4.result.warnings.map((w) => `Phase 4: ${w}`));
  } else {
    stages.push({
      stage: "EVALUATION",
      state: phase6 === undefined ? "SKIPPED" : "BLOCKED",
      detail:
        phase6 === undefined
          ? "Not run: composition was skipped, so no effective rules exist to evaluate."
          : "Not run: Phase 6 refused composition, so there is no coherent rule set to evaluate.",
    });
  }

  // ---- Materiality, then everything that depends on it.
  const materiality = assessE85DecisionMateriality({
    phase8: normalization,
    phase7,
    packResolution,
    ...(phase6 === undefined ? {} : { phase6 }),
    requestedAnalyses,
    assessedAt: assembledAt,
  });
  const blockers = e85DecisionBlockers(materiality);

  if (phase4 !== undefined) {
    stages.push({
      stage: "EVALUATION",
      state: blockers.length > 0 ? "PARTIALLY_EXECUTED" : "EXECUTED",
      detail:
        blockers.length > 0
          ? `Phase 4 evaluated the confirmed rule subset and returned ${phase4.result.status}. The values are real but are NOT the whole answer: ${blockers.length} blocker(s) remain outstanding for this parcel.`
          : `Phase 4 evaluated the composed rules and returned ${phase4.result.status}.`,
    });
  }

  const evaluationCompleteness: E85DecisionEvaluationCompleteness = phase4 === undefined ? "NOT_EVALUATED" : blockers.length > 0 ? "PARTIAL" : "COMPLETE";

  const sortedWarnings = [...warnings].sort(byE85DecisionKey);

  return {
    ...(request.decisionId === undefined ? {} : { decisionId: request.decisionId }),
    parcel: request.parcel,
    parcelSpatial: request.parcelSpatial,
    requestedAnalyses,
    phase8: normalization,
    phase7,
    ...(phase6 === undefined ? {} : { phase6 }),
    ...(phase4 === undefined ? {} : { phase4 }),
    packResolution,
    materiality,
    blockers,
    warnings: sortedWarnings,
    sourceFindings: collectE85DecisionSourceFindings(phase6, packResolution),
    stages: stages.sort((a, b) => byE85DecisionKey(a.stage, b.stage)),
    status: determineE85DecisionStatus({ materiality, ...(phase4 === undefined ? {} : { phase4 }), warnings: sortedWarnings }),
    evaluationCompleteness,
    trace: buildE85DecisionTrace({ packResolution, phase7, blockers }),
    assembledAt,
  };
}

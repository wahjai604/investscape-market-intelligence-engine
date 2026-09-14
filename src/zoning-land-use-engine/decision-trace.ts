/**
 * InvestScape™ E85 Phase 9 — Decision Orchestration: the decision trace.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Two questions a reviewer asks about any regulatory answer, and the trace
 * exists to answer both from the package alone:
 *
 *   "Why is this number usable?"
 *     -> SUPPORT: pack -> the spatial feature that brought it into play
 *        -> dataset release -> the adapter that read it.
 *
 *   "What stops this answer being complete?"
 *     -> BLOCKER: the materiality record, naming its originating phase and the
 *        upstream finding it interprets.
 *
 * Built from IDENTITIES, deliberately. Every piece of evidence is already
 * retained whole on the package, and copying provenance objects per concept
 * would bloat a real municipal decision into something nobody reads — which is
 * how an audit trail stops functioning as one.
 */
import type { E85DecisionMaterialityRecord, E85DecisionTraceEntry, E85RulePackResolution } from "./decision-package-types";
import { byE85DecisionKey } from "./decision-package-types";
import type { E85SpatialApplicabilityResult } from "./spatial-applicability-types";
import { traceE85RulePackToFeatures } from "./spatial-applicability";

export interface E85DecisionTraceInput {
  packResolution: E85RulePackResolution;
  /** Absent when Phase 7 never ran, in which case no SUPPORT entry can honestly be built. */
  phase7?: E85SpatialApplicabilityResult;
  blockers: readonly E85DecisionMaterialityRecord[];
}

/**
 * Builds the trace. Pure, deterministic and canonically ordered.
 *
 * A resolved pack that no hit activates still gets an entry, with that stated:
 * "this pack was supplied and composed" and "geometry brought it in" are
 * different claims, and silently omitting the pack would imply the second.
 */
export function buildE85DecisionTrace(input: E85DecisionTraceInput): readonly E85DecisionTraceEntry[] {
  const entries: E85DecisionTraceEntry[] = [];

  for (const pack of input.packResolution.resolved) {
    const activating = input.phase7 === undefined ? [] : traceE85RulePackToFeatures(input.phase7, pack.packId);

    if (activating.length === 0) {
      entries.push({
        kind: "SUPPORT",
        packId: pack.packId,
        detail: `Rule pack "${pack.packId}" was supplied and resolved, but no spatial feature in this result activates it. It contributes to composition only if something else brought it in.`,
      });
      continue;
    }

    for (const hit of activating) {
      const provenance = hit.spatialProvenance;
      entries.push({
        kind: "SUPPORT",
        packId: pack.packId,
        featureId: hit.featureId,
        datasetId: provenance.datasetId,
        datasetVersionId: provenance.datasetVersionId,
        ...(provenance.adapterId === undefined ? {} : { adapterId: provenance.adapterId }),
        ...(provenance.adapterVersion === undefined ? {} : { adapterVersion: provenance.adapterVersion }),
        detail:
          `Rule pack "${pack.packId}" is in play because feature "${hit.featureId}" of release "${provenance.datasetVersionId}" ` +
          `${hit.relation} this parcel and Phase 7 concluded ${hit.applicability}.`,
      });
    }
  }

  for (const blocker of input.blockers) {
    entries.push({
      kind: "BLOCKER",
      sourcePhase: blocker.sourcePhase,
      sourceRef: blocker.sourceRef,
      ...(blocker.featureId === undefined ? {} : { featureId: blocker.featureId }),
      ...(blocker.packId === undefined ? {} : { packId: blocker.packId }),
      detail: `${blocker.materiality} (${blocker.kind}) from ${blocker.sourcePhase}/${blocker.sourceCode}: ${blocker.reason}`,
    });
  }

  return entries.sort(
    (a, b) =>
      byE85DecisionKey(a.kind, b.kind) ||
      byE85DecisionKey(a.packId ?? "", b.packId ?? "") ||
      byE85DecisionKey(a.sourceRef ?? "", b.sourceRef ?? "") ||
      byE85DecisionKey(a.featureId ?? "", b.featureId ?? "") ||
      byE85DecisionKey(a.detail, b.detail),
  );
}

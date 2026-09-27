/**
 * InvestScape™ E85 — applying a selected legal version to composition, and
 * requiring designation/legal-text coincidence before a temporal result may
 * be non-material.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Runs only for an explicit, resolved AS_OF request with server-supplied
 * `temporalLineageEvidence` containing at least one lineage. Every
 * selection outcome still comes from the existing, frozen pipeline
 * (grouping -> selection -> decision impact); this module never re-derives one.
 *
 * WHAT IT DECIDES, per resolved rule pack:
 *   APPLY     exactly one lineage covers the pack's source, that lineage's
 *             outcome is AS_OF_SELECTED, and the selected candidate's bundle
 *             IS this pack (same identity AND same canonical content).
 *   EXCLUDE   the covering lineage selected a DIFFERENT version of this source,
 *             or the same ids with different content. The pack is withheld
 *             from composition, since it is not the version selected for the
 *             date, and the result stays MATERIAL.
 *   UNCOVERED no lineage covers this source. Composed as before, and MATERIAL.
 *   AMBIGUOUS more than one lineage covers it. Composed as before, and MATERIAL.
 *   NOT_SELECTED the covering lineage did not select anything. Composed as
 *             before; the lineage's own MATERIAL record stands.
 *
 * Only an APPLY pack that composition actually used produces a NON_MATERIAL
 * `TEMPORAL_VERSION_APPLIED` record, replacing that lineage's
 * `TEMPORAL_CANDIDATE_SELECTED_NOT_APPLIED`. Separately, each APPLIES spatial
 * feature linking an applied pack must show designation/legal-text identity
 * correspondence AND closed-interval coincidence on the as-of date. Anything
 * else, including open-ended ("possibly applicable") coincidence or missing
 * designation evidence, stays MATERIAL. A clean version selection alone can
 * never make a decision resolved.
 *
 * Fact-level windows are untouched: Phase 4 still filters each fact by its
 * own temporal window on the as-of date.
 */
import { isDeepStrictEqual } from "util";
import type { E85CompositionResult, E85RulePack } from "./composition-types";
import { canonicalRulePackFromBundle } from "./composition-types";
import type { E85DecisionMaterialityRecord } from "./decision-package-types";
import { buildE85TemporalLineageMaterialityRecords } from "./decision-temporal-materiality-adapter";
import { evaluateE85DesignationLegalTextConsistentPair } from "./designation-legal-text-consistent-pair";
import type { E85DesignationValidity } from "./designation-validity-types";
import type { E85NormalizedRuleBundle } from "./normalized-bundle-types";
import type { E85SpatialApplicabilityResult } from "./spatial-applicability-types";
import type { E85TemporalCandidateAdapterResult } from "./temporal-candidate-adapter";
import type { E85TemporalDecisionImpact } from "./temporal-decision-impact";
import { mapE85TemporalDecisionImpact } from "./temporal-decision-impact";
import type { E85TemporalLineageMember } from "./temporal-lineage-grouping";
import { groupE85TemporalLineageMembers } from "./temporal-lineage-grouping";
import { selectE85TemporalLineages } from "./temporal-lineage-selection";
import type { E85ResolvedTemporalRequest } from "./temporal-request-types";

/** Server-supplied designation validity for one Phase 8 feature id. Never accepted from a public caller. */
export interface E85FeatureDesignationEvidence {
  readonly featureId: string;
  readonly validity: E85DesignationValidity;
}

type CandidateResult = Extract<E85TemporalCandidateAdapterResult, { outcome: "CANDIDATE" }>;

export type E85TemporalPackDecisionKind = "APPLY" | "EXCLUDE" | "UNCOVERED" | "AMBIGUOUS" | "NOT_SELECTED";

export interface E85TemporalPackDecision {
  readonly packId: string;
  readonly kind: E85TemporalPackDecisionKind;
  readonly lineageId?: string;
  readonly detail: string;
}

export interface E85TemporalApplicationPlan {
  readonly impacts: readonly E85TemporalDecisionImpact[];
  readonly packDecisions: readonly E85TemporalPackDecision[];
  /** The resolved packs composition may use: every pack except EXCLUDE ones. */
  readonly composablePacks: readonly E85RulePack[];
  /** Selected candidate per lineage, for lineages whose outcome was AS_OF_SELECTED. */
  readonly selectedByLineage: ReadonlyMap<string, CandidateResult>;
}

const bundleOf = (m: E85TemporalLineageMember): E85NormalizedRuleBundle => m.adapterResult.bundle;
const sameSource = (b: E85NormalizedRuleBundle, p: E85RulePack) => b.jurisdictionId === p.jurisdictionId && b.sourceId === p.sourceId && b.zoneDesignation === p.zoneDesignation;
const sameVersion = (b: E85NormalizedRuleBundle, p: E85RulePack) => sameSource(b, p) && b.sourceVersionId === p.sourceVersionId;

/** Runs the frozen selection pipeline, then decides, per resolved pack, whether the selected version may be applied. */
export function planE85TemporalApplication(
  lineages: readonly E85TemporalLineageMember[],
  resolvedRequest: E85ResolvedTemporalRequest,
  resolvedPacks: readonly E85RulePack[],
): E85TemporalApplicationPlan {
  const grouping = groupE85TemporalLineageMembers(lineages);
  const selection = selectE85TemporalLineages(grouping, resolvedRequest);
  const impactResult = mapE85TemporalDecisionImpact(selection, resolvedRequest);
  const impacts = impactResult.requestKind === "RESOLVED" ? impactResult.impacts : [];

  const selectedByLineage = new Map<string, CandidateResult>();
  for (const impact of impacts) {
    if (impact.impactKind !== "AS_OF_SELECTED" || impact.origin !== "SELECTOR_DERIVED") continue;
    const id = impact.selectorResult.selectedCandidateId;
    const member = lineages.find((m) => m.lineageId === impact.lineageId && m.adapterResult.outcome === "CANDIDATE" && m.adapterResult.candidateId === id);
    if (member !== undefined) selectedByLineage.set(impact.lineageId, member.adapterResult as CandidateResult);
  }

  const lineageIds = [...new Set(lineages.map((m) => m.lineageId))].sort();
  const packDecisions: E85TemporalPackDecision[] = [];
  for (const pack of resolvedPacks) {
    const covering = lineageIds.filter((id) => lineages.some((m) => m.lineageId === id && sameSource(bundleOf(m), pack)));
    if (covering.length === 0) {
      packDecisions.push({ packId: pack.packId, kind: "UNCOVERED", detail: `No server-supplied lineage covers source "${pack.sourceId}", so no version was selected for the as-of date.` });
      continue;
    }
    if (covering.length > 1) {
      packDecisions.push({ packId: pack.packId, kind: "AMBIGUOUS", detail: `Lineages [${covering.join(", ")}] each cover source "${pack.sourceId}"; no one of them governs this pack.` });
      continue;
    }
    const lineageId = covering[0];
    const selected = selectedByLineage.get(lineageId);
    if (selected === undefined) {
      packDecisions.push({ packId: pack.packId, kind: "NOT_SELECTED", lineageId, detail: `Lineage "${lineageId}" selected no version for the as-of date.` });
      continue;
    }
    if (!sameVersion(selected.bundle, pack)) {
      packDecisions.push({
        packId: pack.packId,
        kind: "EXCLUDE",
        lineageId,
        detail: `Lineage "${lineageId}" selected version "${selected.bundle.sourceVersionId}" for the as-of date, but the parcel's spatial link names version "${pack.sourceVersionId}". The linked version is withheld from composition; the selected one is not linked to this parcel.`,
      });
      continue;
    }
    // Identity is checked above; the pack id is the spatial link's, so only content is compared here.
    const expected = { ...canonicalRulePackFromBundle(selected.bundle, pack.role), packId: pack.packId };
    if (!isDeepStrictEqual(expected, pack)) {
      packDecisions.push({ packId: pack.packId, kind: "EXCLUDE", lineageId, detail: `Lineage "${lineageId}" selected this version by id, but the supplied pack's content differs from the selected bundle. It is withheld from composition.` });
      continue;
    }
    packDecisions.push({ packId: pack.packId, kind: "APPLY", lineageId, detail: `Lineage "${lineageId}" uniquely selected this exact version for the as-of date.` });
  }

  const excluded = new Set(packDecisions.filter((d) => d.kind === "EXCLUDE").map((d) => d.packId));
  return { impacts, packDecisions, composablePacks: resolvedPacks.filter((p) => !excluded.has(p.packId)), selectedByLineage };
}

function record(sourceRef: string, sourceCode: string, materiality: "MATERIAL" | "NON_MATERIAL", reason: string, assessedAt: string, packId?: string, featureId?: string): E85DecisionMaterialityRecord {
  return {
    sourceRef,
    sourcePhase: "TEMPORAL_REQUEST",
    sourceCode,
    kind: "GAP",
    materiality,
    reason,
    ...(packId === undefined ? {} : { packId }),
    ...(featureId === undefined ? {} : { featureId }),
    ...(materiality === "MATERIAL"
      ? { gap: { reasonCode: sourceCode === "DESIGNATION_COINCIDENCE_NOT_ESTABLISHED" ? ("DESIGNATION_COINCIDENCE_NOT_ESTABLISHED" as const) : ("TEMPORAL_VERSION_NOT_ESTABLISHED" as const), reason, sourcesChecked: [], checkedAt: assessedAt } }
      : {}),
  };
}

/**
 * After composition: the temporal materiality records for the package. A
 * lineage's SELECTED_NOT_APPLIED record is replaced by a NON_MATERIAL
 * TEMPORAL_VERSION_APPLIED only when its pack was APPLY and composition
 * actually used it.
 */
export function finalizeE85TemporalApplication(input: {
  plan: E85TemporalApplicationPlan;
  phase6: E85CompositionResult | undefined;
  phase7: E85SpatialApplicabilityResult;
  designations: readonly E85FeatureDesignationEvidence[];
  resolvedRequest: E85ResolvedTemporalRequest;
  asOfDate: string;
  assessedAt: string;
}): readonly E85DecisionMaterialityRecord[] {
  const { plan, phase6, phase7, designations, resolvedRequest, asOfDate, assessedAt } = input;
  const contributing = new Set(phase6?.outcome === "COMPOSED" ? phase6.composed.contributingPackIds : []);
  const applied = plan.packDecisions.filter((d) => d.kind === "APPLY" && contributing.has(d.packId));
  const appliedLineages = new Set(applied.map((d) => d.lineageId as string));
  const out: E85DecisionMaterialityRecord[] = [];

  for (const impact of plan.impacts) {
    if (impact.impactKind === "AS_OF_SELECTED" && appliedLineages.has(impact.lineageId)) {
      const selected = plan.selectedByLineage.get(impact.lineageId) as CandidateResult;
      const packIds = applied.filter((d) => d.lineageId === impact.lineageId).map((d) => d.packId);
      out.push(
        record(
          `TEMPORAL_LINEAGE:${impact.lineageId}:TEMPORAL_VERSION_APPLIED:AS_OF:${asOfDate}`,
          "TEMPORAL_VERSION_APPLIED",
          "NON_MATERIAL",
          `Lineage "${impact.lineageId}": version "${selected.bundle.sourceVersionId}" was uniquely selected for AS_OF "${asOfDate}" and was the version composed (pack(s) ${packIds.join(", ")}). This establishes which legal text governed on that date, not that the parcel held the designation.`,
          assessedAt,
          packIds[0],
        ),
      );
    } else {
      out.push(...buildE85TemporalLineageMaterialityRecords([impact], assessedAt));
    }
  }

  for (const d of plan.packDecisions) {
    if (d.kind === "APPLY" && !contributing.has(d.packId)) {
      out.push(record(`TEMPORAL_PACK:${d.packId}:TEMPORAL_VERSION_NOT_COMPOSED:AS_OF:${asOfDate}`, "TEMPORAL_VERSION_NOT_COMPOSED", "MATERIAL", `${d.detail} Composition did not use it, so it was not applied.`, assessedAt, d.packId));
    } else if (d.kind !== "APPLY" && d.kind !== "NOT_SELECTED") {
      out.push(record(`TEMPORAL_PACK:${d.packId}:TEMPORAL_VERSION_${d.kind}:AS_OF:${asOfDate}`, `TEMPORAL_VERSION_${d.kind === "UNCOVERED" ? "NOT_ESTABLISHED" : d.kind === "EXCLUDE" ? "SELECTED_NOT_LINKED" : "LINEAGE_AMBIGUOUS"}`, "MATERIAL", d.detail, assessedAt, d.packId));
    }
  }

  // Designation/legal-text coincidence, for every applied pack's applying feature(s).
  for (const d of applied) {
    const selected = plan.selectedByLineage.get(d.lineageId as string) as CandidateResult;
    const b = selected.bundle;
    const identity = { jurisdictionId: b.jurisdictionId, sourceId: b.sourceId, sourceVersionId: b.sourceVersionId as string, zoneDesignation: b.zoneDesignation };
    const features = [...new Set(phase7.hits.filter((h) => h.applicability === "APPLIES" && h.rulePackIds.includes(d.packId)).map((h) => h.featureId))].sort();
    if (features.length === 0) {
      out.push(record(`TEMPORAL_DESIGNATION:${d.packId}:NO_APPLYING_FEATURE:AS_OF:${asOfDate}`, "DESIGNATION_COINCIDENCE_NOT_ESTABLISHED", "MATERIAL", `No applying spatial feature links pack "${d.packId}", so its designation cannot be dated.`, assessedAt, d.packId));
      continue;
    }
    for (const featureId of features) {
      const evidence = designations.filter((e) => e.featureId === featureId);
      const ref = `TEMPORAL_DESIGNATION:${featureId}:${d.packId}:AS_OF:${asOfDate}`;
      if (evidence.length !== 1) {
        const why = evidence.length === 0 ? "no server-supplied designation validity" : `${evidence.length} conflicting designation validity records`;
        out.push(record(ref, "DESIGNATION_COINCIDENCE_NOT_ESTABLISHED", "MATERIAL", `Feature "${featureId}" has ${why}, so it is not established that this location held "${b.zoneDesignation}" on ${asOfDate}.`, assessedAt, d.packId, featureId));
        continue;
      }
      const pair = evaluateE85DesignationLegalTextConsistentPair({
        designationValidity: evidence[0].validity,
        versionValidity: selected.validity,
        legalTextIdentity: { kind: "SELECTED", identity },
        linkageIdentity: identity,
        resolvedRequest,
      });
      const clean = pair.correspondence.kind === "IDENTITY_CORRESPONDENCE_ESTABLISHED" && pair.coincidence?.kind === "BOTH_CLOSED_APPLICABLE";
      out.push(
        record(
          ref,
          clean ? "DESIGNATION_COINCIDENCE_ESTABLISHED" : "DESIGNATION_COINCIDENCE_NOT_ESTABLISHED",
          clean ? "NON_MATERIAL" : "MATERIAL",
          clean
            ? `Feature "${featureId}": designation "${b.zoneDesignation}" and legal text "${b.sourceVersionId}" both apply within closed intervals on ${asOfDate}, with identity correspondence.`
            : `Feature "${featureId}": correspondence ${pair.correspondence.kind}, coincidence ${pair.coincidence?.kind ?? "NOT_EVALUATED"}. Only identity correspondence with closed-interval coincidence clears this.`,
          assessedAt,
          d.packId,
          featureId,
        ),
      );
    }
  }
  return out;
}

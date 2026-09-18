/**
 * InvestScape™ E85 Phase 12B.4 — regulatory requirement evaluation.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Pure and deterministic. Decides, for one proposal, which regulatory
 * obligations are triggered, using exactly the Phase 12B.2 applicability
 * machinery (`selectE85EvidenceForProposal`) — there is no second trigger model.
 *
 *  - trigger APPLIES, quantity structured      -> APPLICABLE_STRUCTURED (RESOLVED
 *    finding; a burdensome obligation does not downgrade the result);
 *  - trigger APPLIES, quantity not structured  -> APPLICABLE_QUANTIFICATION_UNRESOLVED
 *    with a RULE_NOT_STRUCTURED gap;
 *  - trigger UNDETERMINED (or in-force date unknown) -> APPLICABILITY_UNDETERMINED
 *    with a gap;
 *  - trigger proven NOT_APPLICABLE             -> audit finding only, no entry;
 *  - agreeing evidence disagrees on the obligation or its quantity -> MANUAL_REVIEW.
 *
 * NO ARITHMETIC. A stated fraction is returned as the fraction; this module never
 * multiplies it by any project figure, and never prices anything.
 */
import type { E85RuleRecord, E85RequirementRule } from "./rule-family-types";
import type { E85Evidence } from "./evidence-types";
import type { E85ParcelReference } from "./jurisdiction-types";
import type { E85EvaluationFinding } from "./finding-types";
import type { E85ApplicabilityContext } from "./rule-applicability-types";
import type { E85DataGap } from "./data-gap-types";
import type { E85RegulatoryRequirement, E85RequirementOutcome, E85RequirementQuantity } from "./regulatory-requirement-types";
import { evaluateTemporalApplicability, matchesJurisdictionZone } from "./applicability";
import { dedupeEvidence, evidenceIdentityKey } from "./rule-identity";
import { deriveEvidenceQuality, deriveParcelMatch, deriveRuleApplicability } from "./qualification-derivation";
import { e85ResolvedApplicabilityAudit, partitionE85EvidenceByApplicability, selectE85EvidenceForProposal } from "./rule-applicability";
import { e85RequirementAgreementKey, e85RequirementIdentity, e85RequirementQuantificationUnresolved } from "./regulatory-requirement";
import { buildE85ConceptKey } from "./rule-concept-identity";

export interface E85RequirementEvaluation {
  findings: readonly E85EvaluationFinding[];
  requirements: readonly E85RequirementOutcome[];
}

function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(byCodeUnit);
}

function canonical<T>(items: readonly E85Evidence<T>[]): E85Evidence<T>[] {
  return dedupeEvidence([...items].sort((a, b) => byCodeUnit(evidenceIdentityKey(a), evidenceIdentityKey(b))));
}

interface RequirementGroup {
  requirements: E85Evidence<E85RegulatoryRequirement>[];
  quantities: E85Evidence<E85RequirementQuantity>[];
}

export function evaluateRequirements(
  rules: readonly E85RuleRecord[],
  parcel: E85ParcelReference,
  jurisdictionId: string,
  zoneDesignation: string,
  asOfDate: string,
  context: E85ApplicabilityContext,
): E85RequirementEvaluation {
  const groups = new Map<string, RequirementGroup>();
  for (const rule of rules) {
    if (rule.family !== "REQUIREMENT" || !matchesJurisdictionZone(rule, jurisdictionId, zoneDesignation)) continue;
    for (const item of (rule as E85RequirementRule).requirements) {
      const id = e85RequirementIdentity(item.requirement.value);
      const group = groups.get(id) ?? { requirements: [], quantities: [] };
      group.requirements.push(item.requirement);
      group.quantities.push(...(item.quantities ?? []));
      groups.set(id, group);
    }
  }

  const findings: E85EvaluationFinding[] = [];
  const requirements: E85RequirementOutcome[] = [];

  for (const id of [...groups.keys()].sort(byCodeUnit)) {
    const group = groups.get(id)!;
    const field = `requirement:${id}`;
    const conceptKey = buildE85ConceptKey("REQUIREMENT", "obligation", id);
    const { category, requirementCode } = group.requirements[0].value;
    const base = { conceptKey, category, requirementCode };
    const sourcesOf = (items: readonly E85Evidence<unknown>[]) => sortedUnique(items.map((e) => e.provenance.sourceId));

    const selection = selectE85EvidenceForProposal("REQUIREMENT", field, group.requirements, context, asOfDate);
    if (selection.finding) {
      findings.push(selection.finding);
      if (selection.finding.outcome === "GAP") {
        requirements.push({
          ...base,
          status: "APPLICABILITY_UNDETERMINED",
          quantities: [],
          evidence: canonical(partitionE85EvidenceByApplicability(group.requirements, context).undetermined.map((c) => c.evidence)),
          ...(selection.finding.applicability ? { applicability: selection.finding.applicability } : {}),
          ...(selection.finding.gap ? { gap: selection.finding.gap } : {}),
        });
      }
      continue;
    }

    if (selection.applicable.length === 0) {
      // The trigger governs this proposal, but no statement of the obligation is
      // established as in force on the as-of date.
      const undated = partitionE85EvidenceByApplicability(group.requirements, context).applies.filter((ev) => evaluateTemporalApplicability(ev.temporal, asOfDate) === "UNDETERMINED");
      if (undated.length > 0) {
        const gap: E85DataGap = {
          reasonCode: "EFFECTIVE_DATE_UNKNOWN",
          reason: `${field}: the obligation's trigger governs this proposal, but its effective-date basis is UNKNOWN, so whether it was in force as of ${asOfDate} could not be determined.`,
          sourcesChecked: sourcesOf(undated),
          checkedAt: new Date().toISOString(),
        };
        const evidence = canonical(undated);
        const audit = e85ResolvedApplicabilityAudit(evidence[0]);
        findings.push({ family: "REQUIREMENT", field, outcome: "GAP", gap, ...(audit ? { applicability: audit } : {}) });
        requirements.push({ ...base, status: "APPLICABILITY_UNDETERMINED", quantities: [], evidence, ...(audit ? { applicability: audit } : {}), gap });
      }
      continue;
    }

    const governing = canonical(selection.applicable);
    if (sortedUnique(governing.map((ev) => e85RequirementAgreementKey(ev.value))).length > 1) {
      findings.push({
        family: "REQUIREMENT",
        field,
        outcome: "MANUAL_REVIEW",
        manualReview: {
          reasonCode: "CONFLICTING_AUTHORITATIVE_SOURCES",
          explanation: `${governing.length} statements of obligation ${id} govern this proposal as of ${asOfDate} and disagree on its kind or choice membership, with no basis to prefer one.`,
          evidenceConsidered: governing.map((e) => e.provenance.sourceId),
          flaggedAt: new Date().toISOString(),
        },
      });
      continue;
    }
    const requirement = governing[0].value;
    const audit = e85ResolvedApplicabilityAudit(governing[0]);
    const auditField = audit ? { applicability: audit } : {};

    // --- quantities, selected exactly like the obligation, one kind at a time ---
    const quantities: E85Evidence<E85RequirementQuantity>[] = [];
    let quantityGap: E85DataGap | undefined;
    let quantityConflict = false;
    for (const kind of sortedUnique(group.quantities.map((q) => q.value.kind))) {
      const quantityField = `${field}#${kind}`;
      const quantitySelection = selectE85EvidenceForProposal("REQUIREMENT", quantityField, group.quantities.filter((q) => q.value.kind === kind), context, asOfDate);
      if (quantitySelection.finding) {
        findings.push(quantitySelection.finding);
        if (quantitySelection.finding.outcome === "GAP" && quantitySelection.finding.gap) quantityGap ??= quantitySelection.finding.gap;
        continue;
      }
      const stated = canonical(quantitySelection.applicable);
      if (stated.length === 0) continue;
      if (sortedUnique(stated.map((q) => JSON.stringify([q.value.kind, q.value.value, q.value.basisTerm]))).length > 1) {
        quantityConflict = true;
        findings.push({
          family: "REQUIREMENT",
          field: quantityField,
          outcome: "MANUAL_REVIEW",
          manualReview: {
            reasonCode: "CONFLICTING_AUTHORITATIVE_SOURCES",
            explanation: `${stated.length} statements of the ${kind} quantity of obligation ${id} govern this proposal and disagree, with no basis to prefer one. No figure is chosen, neither the higher nor the lower.`,
            evidenceConsidered: stated.map((e) => e.provenance.sourceId),
            flaggedAt: new Date().toISOString(),
          },
        });
        continue;
      }
      quantities.push(stated[0]);
    }
    if (quantityConflict) continue;

    if (quantityGap === undefined && !e85RequirementQuantificationUnresolved(requirement, quantities)) {
      findings.push({
        family: "REQUIREMENT",
        field,
        outcome: "RESOLVED",
        qualification: {
          evidenceQuality: deriveEvidenceQuality(governing[0].provenance),
          ruleApplicability: deriveRuleApplicability(false),
          parcelMatch: deriveParcelMatch(parcel, jurisdictionId, zoneDesignation),
        },
        resolvedValue: requirement,
        resolvedEvidence: governing[0] as E85Evidence<unknown>,
        ...auditField,
      });
      requirements.push({ ...base, status: "APPLICABLE_STRUCTURED", requirement, quantities, evidence: governing, ...auditField });
      continue;
    }

    const unstructured = (requirement.instrumentReferences ?? []).filter((r) => r.role === "QUANTIFICATION" && !r.structured);
    const describe = (r: (typeof unstructured)[number]) =>
      `${r.description} (${[r.target.bylawOrDocumentId, r.target.schedule, r.target.section, r.target.page === undefined ? undefined : `page ${r.target.page}`].filter((x) => x !== undefined).join(", ")})`;
    const gap: E85DataGap = quantityGap ?? {
      reasonCode: "RULE_NOT_STRUCTURED",
      reason:
        `${field}: the obligation governs this proposal, but what is owed is not stated in structured form` +
        (unstructured.length > 0 ? `; it depends on ${unstructured.map(describe).join("; ")}, which is known to exist and has not been structured` : "") +
        `. No quantity or amount is inferred.`,
      sourcesChecked: sourcesOf(governing),
      checkedAt: new Date().toISOString(),
      resolutionHint: unstructured.length > 0 ? "Structure the referenced content under its own source identity so its quantity can be stated as evidence." : "Extract the quantity the source states for this obligation.",
    };
    if (quantityGap === undefined) findings.push({ family: "REQUIREMENT", field, outcome: "GAP", gap, ...auditField });
    requirements.push({ ...base, status: "APPLICABLE_QUANTIFICATION_UNRESOLVED", requirement, quantities, evidence: governing, ...auditField, gap });
  }

  return { findings, requirements };
}

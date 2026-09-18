/**
 * InvestScape™ E85 Phase 4 — Rule Normalization & Deterministic Evaluation:
 * dimensional evaluation.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Height, storeys, setbacks (keyed by yard name), site coverage and
 * frontage are reported as INDEPENDENT resolved scalar values with
 * provenance. No derived buildable footprint, massing envelope, or GFA is
 * ever computed from these fields (Phase 2 correction 1, carried into
 * Phase 4's evaluation logic).
 *
 * PHASE 12B.2: each field's evidence is selected by applicability scope before
 * conflict detection. A field whose only rules govern other proposals yields a
 * NO_RULE_FOR_PROPOSAL_SCOPE finding and no envelope value — never a default,
 * never "unlimited".
 */
import type { E85RuleRecord, E85DimensionalRule } from "./rule-family-types";
import type { E85Evidence } from "./evidence-types";
import type { E85ParcelReference } from "./jurisdiction-types";
import type { E85EvaluationFinding } from "./finding-types";
import type { E85ApplicabilityContext } from "./rule-applicability-types";
import { matchesJurisdictionZone } from "./applicability";
import { detectConflict } from "./conflict-detection";
import { deriveEvidenceQuality, deriveParcelMatch, deriveRuleApplicability } from "./qualification-derivation";
import { e85HistoricalRuleNotStructuredGap, e85ResolvedApplicabilityAudit, e85TemporallyExcludedOnly, selectE85EvidenceForProposal } from "./rule-applicability";

function applicableDimensionalRules(rules: readonly E85RuleRecord[], jurisdictionId: string, zoneDesignation: string): E85DimensionalRule[] {
  return rules.filter((r): r is E85DimensionalRule => r.family === "DIMENSIONAL" && matchesJurisdictionZone(r, jurisdictionId, zoneDesignation));
}

function evaluateScalarField(
  fieldName: string,
  envelopeField: string,
  evidenceItems: readonly E85Evidence<number>[],
  parcel: E85ParcelReference,
  jurisdictionId: string,
  zoneDesignation: string,
  asOfDate: string,
  context: E85ApplicabilityContext,
): E85EvaluationFinding | undefined {
  const selection = selectE85EvidenceForProposal("DIMENSIONAL", fieldName, evidenceItems, context, asOfDate);
  if (selection.finding) return selection.finding;
  const applicable = selection.applicable;
  if (applicable.length === 0) {
    const excluded = e85TemporallyExcludedOnly(evidenceItems, context, asOfDate);
    return excluded.length > 0 ? e85HistoricalRuleNotStructuredGap("DIMENSIONAL", fieldName, excluded, asOfDate) : undefined;
  }
  const conflict = detectConflict(applicable, (a, b) => a === b);
  if (conflict.hasConflict) {
    return {
      family: "DIMENSIONAL",
      field: fieldName,
      outcome: "MANUAL_REVIEW",
      manualReview: {
        reasonCode: "CONFLICTING_AUTHORITATIVE_SOURCES",
        explanation: `${conflict.distinctValues.length} distinct values (${conflict.distinctValues.join(", ")}) found for ${fieldName} in ${jurisdictionId}/${zoneDesignation} as of ${asOfDate}.`,
        evidenceConsidered: conflict.deduped.map((e) => e.provenance.sourceId),
        flaggedAt: new Date().toISOString(),
      },
    };
  }
  const ev = conflict.deduped[0];
  const audit = e85ResolvedApplicabilityAudit(ev);
  return {
    family: "DIMENSIONAL",
    field: fieldName,
    outcome: "RESOLVED",
    qualification: {
      evidenceQuality: deriveEvidenceQuality(ev.provenance),
      ruleApplicability: deriveRuleApplicability(false),
      parcelMatch: deriveParcelMatch(parcel, jurisdictionId, zoneDesignation),
    },
    resolvedValue: ev.value,
    envelopeContribution: { field: envelopeField as any, evidence: ev },
    ...(audit ? { applicability: audit } : {}),
  };
}

export function evaluateDimensional(
  rules: readonly E85RuleRecord[],
  parcel: E85ParcelReference,
  jurisdictionId: string,
  zoneDesignation: string,
  asOfDate: string,
  applicabilityContext?: E85ApplicabilityContext,
): E85EvaluationFinding[] {
  const context: E85ApplicabilityContext = applicabilityContext ?? (parcel.siteAreaSqm === undefined ? {} : { siteAreaSqm: parcel.siteAreaSqm });
  const findings: E85EvaluationFinding[] = [];
  const dimRules = applicableDimensionalRules(rules, jurisdictionId, zoneDesignation);

  const scalarFields = ["maxHeightMetres", "maxStoreys", "maxSiteCoverageFraction", "minFrontageMetres"] as const;
  for (const field of scalarFields) {
    const finding = evaluateScalarField(
      field,
      field,
      dimRules.map((r) => r[field]).filter((e): e is E85Evidence<number> => e !== undefined),
      parcel,
      jurisdictionId,
      zoneDesignation,
      asOfDate,
      context,
    );
    if (finding) findings.push(finding);
  }

  // Setbacks keyed by yard name — collect all yard names seen across matching rules, evaluate each independently.
  const yardNames = new Set<string>();
  for (const r of dimRules) {
    if (r.setbacksMetres) for (const yard of Object.keys(r.setbacksMetres)) yardNames.add(yard);
  }
  for (const yard of yardNames) {
    const items = dimRules.map((r) => r.setbacksMetres?.[yard]).filter((e): e is E85Evidence<number> => e !== undefined);
    const finding = evaluateScalarField(`setback:${yard}`, `setbacksMetres.${yard}`, items, parcel, jurisdictionId, zoneDesignation, asOfDate, context);
    if (finding) {
      // Setback envelope contributions are keyed fields; carry the yard name via the field label since
      // E85RegulatoryEnvelope.setbacksMetres is a keyed record, not a flat scalar - envelope-assembly.ts
      // reads `finding.field` (format "setback:<yard>") to place this into the right key.
      findings.push(finding);
    }
  }

  return findings;
}

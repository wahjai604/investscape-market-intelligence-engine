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
 */
import type { E85RuleRecord, E85DimensionalRule } from "./rule-family-types";
import type { E85Evidence } from "./evidence-types";
import type { E85ParcelReference } from "./jurisdiction-types";
import type { E85EvaluationFinding } from "./finding-types";
import { evaluateTemporalApplicability, matchesJurisdictionZone } from "./applicability";
import { detectConflict } from "./conflict-detection";
import { deriveEvidenceQuality, deriveParcelMatch, deriveRuleApplicability } from "./qualification-derivation";

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
): E85EvaluationFinding | undefined {
  const applicable = evidenceItems.filter((ev) => evaluateTemporalApplicability(ev.temporal, asOfDate) === "APPLIES");
  if (applicable.length === 0) return undefined;
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
  };
}

export function evaluateDimensional(
  rules: readonly E85RuleRecord[],
  parcel: E85ParcelReference,
  jurisdictionId: string,
  zoneDesignation: string,
  asOfDate: string,
): E85EvaluationFinding[] {
  const findings: E85EvaluationFinding[] = [];
  const dimRules = applicableDimensionalRules(rules, jurisdictionId, zoneDesignation);

  const heightFinding = evaluateScalarField(
    "maxHeightMetres",
    "maxHeightMetres",
    dimRules.map((r) => r.maxHeightMetres).filter((e): e is E85Evidence<number> => e !== undefined),
    parcel,
    jurisdictionId,
    zoneDesignation,
    asOfDate,
  );
  if (heightFinding) findings.push(heightFinding);

  const storeysFinding = evaluateScalarField(
    "maxStoreys",
    "maxStoreys",
    dimRules.map((r) => r.maxStoreys).filter((e): e is E85Evidence<number> => e !== undefined),
    parcel,
    jurisdictionId,
    zoneDesignation,
    asOfDate,
  );
  if (storeysFinding) findings.push(storeysFinding);

  const coverageFinding = evaluateScalarField(
    "maxSiteCoverageFraction",
    "maxSiteCoverageFraction",
    dimRules.map((r) => r.maxSiteCoverageFraction).filter((e): e is E85Evidence<number> => e !== undefined),
    parcel,
    jurisdictionId,
    zoneDesignation,
    asOfDate,
  );
  if (coverageFinding) findings.push(coverageFinding);

  const frontageFinding = evaluateScalarField(
    "minFrontageMetres",
    "minFrontageMetres",
    dimRules.map((r) => r.minFrontageMetres).filter((e): e is E85Evidence<number> => e !== undefined),
    parcel,
    jurisdictionId,
    zoneDesignation,
    asOfDate,
  );
  if (frontageFinding) findings.push(frontageFinding);

  // Setbacks keyed by yard name — collect all yard names seen across matching rules, evaluate each independently.
  const yardNames = new Set<string>();
  for (const r of dimRules) {
    if (r.setbacksMetres) for (const yard of Object.keys(r.setbacksMetres)) yardNames.add(yard);
  }
  for (const yard of yardNames) {
    const items = dimRules.map((r) => r.setbacksMetres?.[yard]).filter((e): e is E85Evidence<number> => e !== undefined);
    const finding = evaluateScalarField(`setback:${yard}`, `setbacksMetres.${yard}`, items, parcel, jurisdictionId, zoneDesignation, asOfDate);
    if (finding) {
      // Setback envelope contributions are keyed fields; carry the yard name via the field label since
      // E85RegulatoryEnvelope.setbacksMetres is a keyed record, not a flat scalar - envelope-assembly.ts
      // reads `finding.field` (format "setback:<yard>") to place this into the right key.
      findings.push(finding);
    }
  }

  return findings;
}

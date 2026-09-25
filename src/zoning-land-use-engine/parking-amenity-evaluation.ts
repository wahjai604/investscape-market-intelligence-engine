/**
 * InvestScape™ E85 Phase 4 — Rule Normalization & Deterministic Evaluation:
 * parking & amenity evaluation.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Evaluates ONLY whatever normalized `E85ParkingRule`/`E85AmenityRule`
 * records the caller supplies as `rules` — no real-world numeric ratio is
 * ever hard-coded here. Missing evidence is never treated as "0 required."
 * A conditional amenity requirement is never assumed satisfied.
 *
 * PHASE 12B.2: each evidence item is selected by applicability scope first,
 * exactly as in the other family evaluators.
 */
import type { E85RuleRecord, E85ParkingRule, E85AmenityRule } from "./rule-family-types";
import type { E85Evidence } from "./evidence-types";
import type { E85ParcelReference } from "./jurisdiction-types";
import type { E85CallerContext } from "./request-types";
import type { E85EvaluationFinding } from "./finding-types";
import type { E85ApplicabilityContext } from "./rule-applicability-types";
import { matchesJurisdictionZone } from "./applicability";
import { deriveEvidenceQuality, deriveParcelMatch, deriveRuleApplicability } from "./qualification-derivation";
import { e85HistoricalRuleNotStructuredGap, e85ResolvedApplicabilityAudit, e85TemporallyExcludedOnly, selectE85EvidenceForProposal } from "./rule-applicability";

function defaultContext(parcel: E85ParcelReference, callerContext?: E85CallerContext): E85ApplicabilityContext {
  return {
    ...(parcel.siteAreaSqm === undefined ? {} : { siteAreaSqm: parcel.siteAreaSqm }),
    ...(callerContext?.satisfiedConditions === undefined ? {} : { satisfiedConditions: callerContext.satisfiedConditions }),
    ...(callerContext?.unsatisfiedConditions === undefined ? {} : { unsatisfiedConditions: callerContext.unsatisfiedConditions }),
  };
}

function evaluateKeyedNumeric(
  family: "PARKING",
  fieldPrefix: string,
  items: Readonly<Record<string, E85Evidence<number>>> | undefined,
  parcel: E85ParcelReference,
  jurisdictionId: string,
  zoneDesignation: string,
  asOfDate: string,
  context: E85ApplicabilityContext,
): E85EvaluationFinding[] {
  const findings: E85EvaluationFinding[] = [];
  if (!items) return findings;
  for (const [key, item] of Object.entries(items)) {
    const selection = selectE85EvidenceForProposal(family, `${fieldPrefix}:${key}`, [item], context, asOfDate);
    if (selection.finding) {
      findings.push(selection.finding);
      continue;
    }
    const ev = selection.applicable[0];
    if (ev === undefined) {
      // Phase 12C.2 anti-look-ahead, as in density/dimensional: a value that is
      // in scope but outside its temporal window is a GAP, never a silent absence.
      const excluded = e85TemporallyExcludedOnly([item], context, asOfDate);
      if (excluded.length > 0) findings.push(e85HistoricalRuleNotStructuredGap(family, `${fieldPrefix}:${key}`, excluded, asOfDate));
      continue;
    }
    const audit = e85ResolvedApplicabilityAudit(ev);
    findings.push({
      family,
      field: `${fieldPrefix}:${key}`,
      outcome: "RESOLVED",
      qualification: {
        evidenceQuality: deriveEvidenceQuality(ev.provenance),
        ruleApplicability: deriveRuleApplicability(false),
        parcelMatch: deriveParcelMatch(parcel, jurisdictionId, zoneDesignation),
      },
      resolvedValue: ev.value,
      resolvedEvidence: ev as any,
      ...(audit ? { applicability: audit } : {}),
    });
  }
  return findings;
}

export function evaluateParking(
  rules: readonly E85RuleRecord[],
  parcel: E85ParcelReference,
  jurisdictionId: string,
  zoneDesignation: string,
  asOfDate: string,
  applicabilityContext?: E85ApplicabilityContext,
): E85EvaluationFinding[] {
  const context = applicabilityContext ?? defaultContext(parcel);
  const parkingRules = rules.filter((r): r is E85ParkingRule => r.family === "PARKING" && matchesJurisdictionZone(r, jurisdictionId, zoneDesignation));
  const findings: E85EvaluationFinding[] = [];
  for (const r of parkingRules) {
    findings.push(...evaluateKeyedNumeric("PARKING", "minSpacesPerUse", r.minSpacesPerUse, parcel, jurisdictionId, zoneDesignation, asOfDate, context));
    findings.push(...evaluateKeyedNumeric("PARKING", "maxSpacesPerUse", r.maxSpacesPerUse, parcel, jurisdictionId, zoneDesignation, asOfDate, context));
  }
  return findings;
}

export function evaluateAmenity(
  rules: readonly E85RuleRecord[],
  parcel: E85ParcelReference,
  jurisdictionId: string,
  zoneDesignation: string,
  asOfDate: string,
  callerContext: E85CallerContext | undefined,
  applicabilityContext?: E85ApplicabilityContext,
): E85EvaluationFinding[] {
  const context = applicabilityContext ?? defaultContext(parcel, callerContext);
  const amenityRules = rules.filter((r): r is E85AmenityRule => r.family === "AMENITY" && matchesJurisdictionZone(r, jurisdictionId, zoneDesignation));
  const findings: E85EvaluationFinding[] = [];
  for (const r of amenityRules) {
    if (!r.requirements) continue;
    for (const [key, item] of Object.entries(r.requirements)) {
      const selection = selectE85EvidenceForProposal("AMENITY", `requirement:${key}`, [item], context, asOfDate);
      if (selection.finding) {
        findings.push(selection.finding);
        continue;
      }
      const ev = selection.applicable[0];
      if (ev === undefined) {
        const excluded = e85TemporallyExcludedOnly([item], context, asOfDate);
        if (excluded.length > 0) findings.push(e85HistoricalRuleNotStructuredGap("AMENITY", `requirement:${key}`, excluded, asOfDate));
        continue;
      }
      const condition = r.requirementConditions?.[key];
      if (condition) {
        const affirmed = (callerContext?.satisfiedConditions ?? []).includes(condition);
        if (!affirmed) {
          findings.push({
            family: "AMENITY",
            field: `requirement:${key}`,
            outcome: "CONDITIONAL_UNRESOLVED",
            warning: `Amenity requirement "${key}" is conditional on "${condition}", which the caller did not affirm; not treated as applicable or satisfied.`,
          });
          continue;
        }
      }
      const audit = e85ResolvedApplicabilityAudit(ev);
      findings.push({
        family: "AMENITY",
        field: `requirement:${key}`,
        outcome: "RESOLVED",
        qualification: {
          evidenceQuality: deriveEvidenceQuality(ev.provenance),
          ruleApplicability: deriveRuleApplicability(Boolean(condition)),
          parcelMatch: deriveParcelMatch(parcel, jurisdictionId, zoneDesignation),
        },
        resolvedValue: ev.value,
        resolvedEvidence: ev as any,
        ...(audit ? { applicability: audit } : {}),
      });
    }
  }
  return findings;
}

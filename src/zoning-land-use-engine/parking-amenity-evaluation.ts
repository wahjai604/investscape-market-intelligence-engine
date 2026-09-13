/**
 * InvestScape™ E85 Phase 4 — Rule Normalization & Deterministic Evaluation:
 * parking & amenity evaluation.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Evaluates ONLY whatever normalized `E85ParkingRule`/`E85AmenityRule`
 * records the caller supplies as `rules` — no real-world numeric ratio is
 * ever hard-coded here. Missing evidence is never treated as "0 required."
 * A conditional amenity requirement is never assumed satisfied.
 */
import type { E85RuleRecord, E85ParkingRule, E85AmenityRule } from "./rule-family-types";
import type { E85Evidence } from "./evidence-types";
import type { E85ParcelReference } from "./jurisdiction-types";
import type { E85CallerContext } from "./request-types";
import type { E85EvaluationFinding } from "./finding-types";
import { evaluateTemporalApplicability, matchesJurisdictionZone } from "./applicability";
import { detectConflict } from "./conflict-detection";
import { deriveEvidenceQuality, deriveParcelMatch, deriveRuleApplicability } from "./qualification-derivation";

function evaluateKeyedNumeric(
  family: "PARKING",
  fieldPrefix: string,
  items: Readonly<Record<string, E85Evidence<number>>> | undefined,
  parcel: E85ParcelReference,
  jurisdictionId: string,
  zoneDesignation: string,
  asOfDate: string,
): E85EvaluationFinding[] {
  const findings: E85EvaluationFinding[] = [];
  if (!items) return findings;
  for (const [key, ev] of Object.entries(items)) {
    if (evaluateTemporalApplicability(ev.temporal, asOfDate) !== "APPLIES") continue;
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
): E85EvaluationFinding[] {
  const parkingRules = rules.filter((r): r is E85ParkingRule => r.family === "PARKING" && matchesJurisdictionZone(r, jurisdictionId, zoneDesignation));
  const findings: E85EvaluationFinding[] = [];
  for (const r of parkingRules) {
    findings.push(...evaluateKeyedNumeric("PARKING", "minSpacesPerUse", r.minSpacesPerUse, parcel, jurisdictionId, zoneDesignation, asOfDate));
    findings.push(...evaluateKeyedNumeric("PARKING", "maxSpacesPerUse", r.maxSpacesPerUse, parcel, jurisdictionId, zoneDesignation, asOfDate));
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
): E85EvaluationFinding[] {
  const amenityRules = rules.filter((r): r is E85AmenityRule => r.family === "AMENITY" && matchesJurisdictionZone(r, jurisdictionId, zoneDesignation));
  const findings: E85EvaluationFinding[] = [];
  for (const r of amenityRules) {
    if (!r.requirements) continue;
    for (const [key, ev] of Object.entries(r.requirements)) {
      if (evaluateTemporalApplicability(ev.temporal, asOfDate) !== "APPLIES") continue;
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
      });
    }
  }
  return findings;
}

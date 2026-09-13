/**
 * InvestScape™ E85 Phase 4 — Rule Normalization & Deterministic Evaluation:
 * density/FSR evaluation.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * A single, unconditional, resolved FSR may be mechanically multiplied by
 * `parcel.siteAreaSqm` to derive `maxRegulatoryGfaSqm` — only then, and only
 * with no rounding beyond IEEE double precision. An explicit GFA cap and a
 * compatible FSR-derived cap are reported as DISTINCT findings, never
 * min()'d together. A conditional bonus is included only when its exact
 * condition string is present in the caller's affirmed conditions list.
 */
import type { E85RuleRecord, E85DensityRule } from "./rule-family-types";
import type { E85ParcelReference } from "./jurisdiction-types";
import type { E85CallerContext } from "./request-types";
import type { E85EvaluationFinding } from "./finding-types";
import { evaluateTemporalApplicability, matchesJurisdictionZone } from "./applicability";
import { detectConflict } from "./conflict-detection";
import { deriveEvidenceQuality, deriveParcelMatch, deriveRuleApplicability } from "./qualification-derivation";

function applicableDensityRules(rules: readonly E85RuleRecord[], jurisdictionId: string, zoneDesignation: string): E85DensityRule[] {
  return rules.filter((r): r is E85DensityRule => r.family === "DENSITY" && matchesJurisdictionZone(r, jurisdictionId, zoneDesignation));
}

export function evaluateDensity(
  rules: readonly E85RuleRecord[],
  parcel: E85ParcelReference,
  jurisdictionId: string,
  zoneDesignation: string,
  asOfDate: string,
  callerContext: E85CallerContext | undefined,
): E85EvaluationFinding[] {
  const findings: E85EvaluationFinding[] = [];
  const densityRules = applicableDensityRules(rules, jurisdictionId, zoneDesignation);

  // --- maxFsr ---
  const fsrEvidence = densityRules
    .map((r) => r.maxFsr)
    .filter((ev): ev is NonNullable<typeof ev> => ev !== undefined)
    .filter((ev) => evaluateTemporalApplicability(ev.temporal, asOfDate) === "APPLIES");

  let resolvedFsr: number | undefined;
  if (fsrEvidence.length > 0) {
    const conflict = detectConflict(fsrEvidence, (a, b) => a === b);
    if (conflict.hasConflict) {
      findings.push({
        family: "DENSITY",
        field: "maxFsr",
        outcome: "MANUAL_REVIEW",
        manualReview: {
          reasonCode: "CONFLICTING_AUTHORITATIVE_SOURCES",
          explanation: `${conflict.distinctValues.length} distinct maxFsr values (${conflict.distinctValues.join(", ")}) found for ${jurisdictionId}/${zoneDesignation} as of ${asOfDate}, with no basis to prefer one.`,
          evidenceConsidered: conflict.deduped.map((e) => e.provenance.sourceId),
          flaggedAt: new Date().toISOString(),
        },
      });
    } else {
      const ev = conflict.deduped[0];
      resolvedFsr = ev.value;
      findings.push({
        family: "DENSITY",
        field: "maxFsr",
        outcome: "RESOLVED",
        qualification: {
          evidenceQuality: deriveEvidenceQuality(ev.provenance),
          ruleApplicability: deriveRuleApplicability(false),
          parcelMatch: deriveParcelMatch(parcel, jurisdictionId, zoneDesignation),
        },
        resolvedValue: ev.value,
        resolvedEvidence: ev as any,
        // No envelopeContribution here: `maxFsr` itself has no field on
        // `E85RegulatoryEnvelope` (which is deliberately scoped to
        // BUILDABLE-ENVELOPE outputs, not every input rule value) — the FSR
        // value is surfaced via `resolvedValue` above, and its
        // envelope contribution is the DERIVED `maxRegulatoryGfaSqm` finding
        // below.
      });
    }
  }

  // --- GFA derived from FSR x site area ---
  if (resolvedFsr !== undefined) {
    const fsrEv = fsrEvidence.find((e) => e.value === resolvedFsr)!;
    if (parcel.siteAreaSqm === undefined) {
      findings.push({
        family: "DENSITY",
        field: "maxRegulatoryGfaSqm",
        outcome: "GAP",
        gap: {
          reasonCode: "REQUIRED_SITE_DIMENSION_MISSING",
          reason: `maxFsr (${resolvedFsr}) resolved but parcel.siteAreaSqm is missing, so maxRegulatoryGfaSqm cannot be derived.`,
          sourcesChecked: [fsrEv.provenance.sourceId],
          checkedAt: new Date().toISOString(),
          resolutionHint: "Supply parcel.siteAreaSqm to derive the regulatory GFA cap.",
        },
      });
    } else {
      const gfa = resolvedFsr * parcel.siteAreaSqm; // no rounding beyond IEEE double precision
      findings.push({
        family: "DENSITY",
        field: "maxRegulatoryGfaSqm",
        outcome: "RESOLVED",
        qualification: {
          evidenceQuality: deriveEvidenceQuality(fsrEv.provenance),
          ruleApplicability: deriveRuleApplicability(false),
          parcelMatch: deriveParcelMatch(parcel, jurisdictionId, zoneDesignation),
        },
        resolvedValue: gfa,
        envelopeContribution: {
          field: "maxRegulatoryGfaSqm",
          evidence: { value: gfa, provenance: fsrEv.provenance, temporal: fsrEv.temporal },
          derivationNote: `Derived as maxFsr (${resolvedFsr}, source ${fsrEv.provenance.sourceId}) x parcel.siteAreaSqm (${parcel.siteAreaSqm}). Qualification floored to the FSR evidence's qualification; exact arithmetic does not upgrade it.`,
        },
      });
    }
  }

  // --- explicit GFA cap, reported distinctly, never min()'d with the FSR-derived figure ---
  const gfaCapEvidence = densityRules
    .map((r) => r.explicitMaxGfaSqm)
    .filter((ev): ev is NonNullable<typeof ev> => ev !== undefined)
    .filter((ev) => evaluateTemporalApplicability(ev.temporal, asOfDate) === "APPLIES");
  if (gfaCapEvidence.length > 0) {
    const conflict = detectConflict(gfaCapEvidence, (a, b) => a === b);
    if (conflict.hasConflict) {
      findings.push({
        family: "DENSITY",
        field: "explicitMaxGfaSqm",
        outcome: "MANUAL_REVIEW",
        manualReview: {
          reasonCode: "CONFLICTING_AUTHORITATIVE_SOURCES",
          explanation: `${conflict.distinctValues.length} distinct explicit GFA caps (${conflict.distinctValues.join(", ")}) found for ${jurisdictionId}/${zoneDesignation} as of ${asOfDate}.`,
          evidenceConsidered: conflict.deduped.map((e) => e.provenance.sourceId),
          flaggedAt: new Date().toISOString(),
        },
      });
    } else {
      const ev = conflict.deduped[0];
      findings.push({
        family: "DENSITY",
        field: "explicitMaxGfaSqm",
        outcome: "RESOLVED",
        qualification: {
          evidenceQuality: deriveEvidenceQuality(ev.provenance),
          ruleApplicability: deriveRuleApplicability(false),
          parcelMatch: deriveParcelMatch(parcel, jurisdictionId, zoneDesignation),
        },
        resolvedValue: ev.value,
        // Deliberately no envelopeContribution to `maxRegulatoryGfaSqm` here:
        // an explicit cap and an FSR-derived cap arising from different
        // source statements are reported as two distinct findings, never
        // silently reduced via min(). A caller wanting "the binding number"
        // combines them itself with full visibility into both.
        warning: `An explicit GFA cap (${ev.value} sqm) is stated by the source in addition to any FSR-derived figure; the two are reported separately and are not combined by the evaluator.`,
      });
    }
  }

  // --- conditional density bonus: never folded in unless caller affirms the exact condition ---
  for (const rule of densityRules) {
    if (!rule.conditionalBonus) continue;
    const { condition, additionalFsr, additionalGfaSqm } = rule.conditionalBonus;
    const affirmed = (callerContext?.satisfiedConditions ?? []).includes(condition);
    const bonusEv = additionalFsr ?? additionalGfaSqm;
    if (!bonusEv) continue;
    if (evaluateTemporalApplicability(bonusEv.temporal, asOfDate) !== "APPLIES") continue;
    if (affirmed) {
      findings.push({
        family: "DENSITY",
        field: additionalFsr ? "conditionalBonus:additionalFsr" : "conditionalBonus:additionalGfaSqm",
        outcome: "RESOLVED",
        qualification: {
          evidenceQuality: deriveEvidenceQuality(bonusEv.provenance),
          ruleApplicability: deriveRuleApplicability(false),
          parcelMatch: deriveParcelMatch(parcel, jurisdictionId, zoneDesignation),
        },
        resolvedValue: bonusEv.value,
        warning: `Conditional density bonus (condition "${condition}") applied because the caller affirmed this condition is satisfied.`,
      });
    } else {
      findings.push({
        family: "DENSITY",
        field: additionalFsr ? "conditionalBonus:additionalFsr" : "conditionalBonus:additionalGfaSqm",
        outcome: "CONDITIONAL_UNRESOLVED",
        warning: `A conditional density bonus exists (condition "${condition}") but was NOT applied because the caller did not affirm this condition; base maxFsr/explicitMaxGfaSqm figures above are unconditional and exclude it.`,
      });
    }
  }

  return findings;
}

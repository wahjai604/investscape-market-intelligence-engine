/**
 * InvestScape™ E85 Phase 4 — Rule Normalization & Deterministic Evaluation:
 * overlay evaluation.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Rule-Only Mode never discovers overlays spatially or infers them from
 * coordinates/ALR/floodplain/heritage status — it only evaluates an
 * `E85OverlayRule` if supplied as normalized input. If the caller flags
 * (via `E85CallerContext.overlaysApplicable`) that an overlay applies but no
 * matching rule record/terms exist, that is DATA_GAP(OVERLAY_DATA_MISSING).
 * Two supplied, applicable overlays with unresolved relative precedence
 * escalate to MANUAL_REVIEW_REQUIRED(OVERLAY_PRECEDENCE_UNRESOLVED).
 */
import type { E85RuleRecord, E85OverlayRule } from "./rule-family-types";
import type { E85ParcelReference } from "./jurisdiction-types";
import type { E85CallerContext } from "./request-types";
import type { E85EvaluationFinding } from "./finding-types";
import { evaluateTemporalApplicability, matchesJurisdictionZone } from "./applicability";
import { deriveEvidenceQuality, deriveParcelMatch, deriveRuleApplicability } from "./qualification-derivation";

export function evaluateOverlay(
  rules: readonly E85RuleRecord[],
  parcel: E85ParcelReference,
  jurisdictionId: string,
  zoneDesignation: string,
  asOfDate: string,
  callerContext: E85CallerContext | undefined,
): E85EvaluationFinding[] {
  const findings: E85EvaluationFinding[] = [];
  const overlayRules = rules.filter(
    (r): r is E85OverlayRule => r.family === "OVERLAY" && matchesJurisdictionZone(r, jurisdictionId, zoneDesignation),
  );

  const flagged = callerContext?.overlaysApplicable ?? [];
  for (const overlayDesignation of flagged) {
    const matches = overlayRules.filter((r) => r.overlayDesignation === overlayDesignation);
    if (matches.length === 0) {
      findings.push({
        family: "OVERLAY",
        field: `overlay:${overlayDesignation}`,
        outcome: "GAP",
        gap: {
          reasonCode: "OVERLAY_DATA_MISSING",
          reason: `The caller flagged overlay "${overlayDesignation}" as applicable to this parcel, but no matching E85OverlayRule was supplied for ${jurisdictionId}/${zoneDesignation}.`,
          sourcesChecked: overlayRules.map((r) => r.overlayDesignation),
          checkedAt: new Date().toISOString(),
        },
      });
    }
  }

  // Report every SUPPLIED, temporally-applicable overlay rule regardless of whether the caller flagged it,
  // since a supplied rule is direct evidence the evaluator was given, not a spatial inference.
  const applicableOverlays = overlayRules.filter((r) => !r.description || evaluateTemporalApplicability(r.description.temporal, asOfDate) === "APPLIES");
  for (const overlay of applicableOverlays) {
    findings.push({
      family: "OVERLAY",
      field: `overlay:${overlay.overlayDesignation}`,
      outcome: "RESOLVED",
      qualification: overlay.description
        ? {
            evidenceQuality: deriveEvidenceQuality(overlay.description.provenance),
            ruleApplicability: deriveRuleApplicability(false),
            parcelMatch: deriveParcelMatch(parcel, jurisdictionId, zoneDesignation),
          }
        : undefined,
      resolvedValue: { overlayDesignation: overlay.overlayDesignation, description: overlay.description?.value },
    });
  }

  // Precedence conflict: 2+ distinct, applicable overlay designations supplied with no precedence data available anywhere in the contract.
  const distinctDesignations = new Set(applicableOverlays.map((o) => o.overlayDesignation));
  if (distinctDesignations.size > 1) {
    findings.push({
      family: "OVERLAY",
      field: "overlayPrecedence",
      outcome: "MANUAL_REVIEW",
      manualReview: {
        reasonCode: "OVERLAY_PRECEDENCE_UNRESOLVED",
        explanation: `${distinctDesignations.size} distinct overlays (${[...distinctDesignations].join(", ")}) apply to ${jurisdictionId}/${zoneDesignation} as of ${asOfDate} and no source states their relative precedence.`,
        evidenceConsidered: applicableOverlays.map((o) => o.overlayDesignation),
        flaggedAt: new Date().toISOString(),
      },
    });
  }

  return findings;
}

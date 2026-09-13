/**
 * InvestScape™ E85 Phase 4 — Rule Normalization & Deterministic Evaluation:
 * the single public evaluator entry point.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * `evaluateZoningAndLandUse` is pure, synchronous, and deterministic: given
 * the same `E85EvaluationRequest`, it always returns an equal
 * `E85EvaluationOutcome`, independent of the order of `request.rules` or of
 * duplicate evidence within it. It performs NO network calls, NO filesystem
 * access, NO parsing of raw source documents (Phase 5 scope) — it only
 * evaluates already-normalized `E85RuleRecord[]` supplied by the caller.
 *
 * Pipeline order:
 *   1. Per requested family, run that family's evaluator over
 *      `request.rules` (each evaluator independently applies jurisdiction/
 *      zone + temporal applicability filtering and de-duplicates evidence
 *      by identity before any conflict/qualification logic runs).
 *   2. Fold all findings' `envelopeContribution`s into one
 *      `E85RegulatoryEnvelopeResult` (envelope-assembly.ts).
 *   3. Determine the single overall result status via the one explicit
 *      precedence function in result-status.ts.
 *   4. Assemble the frozen `E85Result` variant matching that status,
 *      picking the qualification as the FLOOR over every material,
 *      resolved finding's qualification (never averaged).
 *   5. Wrap it in `E85EvaluationOutcome` together with the resolved
 *      non-envelope values (use permission, parking, amenity, overlays).
 */
import type { E85EvaluationRequest } from "./request-types";
import type { E85EvaluationOutcome } from "./evaluator-result-types";
import type { E85EvaluationFinding } from "./finding-types";
import type { E85Qualification } from "./qualification-types";
import type { E85DataGap } from "./data-gap-types";
import type { E85ManualReviewRecord } from "./manual-review-types";
import type { E85RuleRecord } from "./rule-family-types";
import type { E85UsePermission } from "./use-taxonomy";
import { floorQualificationTiers } from "./qualification-types";
import { evaluateUsePermission } from "./use-evaluation";
import { evaluateDensity } from "./density-evaluation";
import { evaluateDimensional } from "./dimensional-evaluation";
import { evaluateParking, evaluateAmenity } from "./parking-amenity-evaluation";
import { evaluateOverlay } from "./overlay-evaluation";
import { assembleEnvelope } from "./envelope-assembly";
import { determineOverallStatus, isMaterial } from "./result-status";
import { matchesJurisdictionZone } from "./applicability";

function collectQualification(findings: readonly E85EvaluationFinding[]): E85Qualification {
  const quals = findings.map((f) => f.qualification).filter((q): q is E85Qualification => q !== undefined);
  if (quals.length === 0) {
    return { evidenceQuality: "high", ruleApplicability: "high", parcelMatch: "high" };
  }
  return {
    evidenceQuality: floorQualificationTiers(...quals.map((q) => q.evidenceQuality)),
    ruleApplicability: floorQualificationTiers(...quals.map((q) => q.ruleApplicability)),
    parcelMatch: floorQualificationTiers(...quals.map((q) => q.parcelMatch)),
  };
}

export function evaluateZoningAndLandUse(request: E85EvaluationRequest): E85EvaluationOutcome {
  const { parcel, jurisdictionId, zoneDesignation, useCode, asOfDate, rules, requestedAnalyses, callerContext } = request;
  const resolvedAt = new Date().toISOString();

  const findings: E85EvaluationFinding[] = [];

  if (requestedAnalyses.includes("USE")) {
    findings.push(evaluateUsePermission(rules, parcel, jurisdictionId, zoneDesignation, useCode, asOfDate));
  }
  if (requestedAnalyses.includes("DENSITY")) {
    findings.push(...evaluateDensity(rules, parcel, jurisdictionId, zoneDesignation, asOfDate, callerContext));
  }
  if (requestedAnalyses.includes("DIMENSIONAL")) {
    findings.push(...evaluateDimensional(rules, parcel, jurisdictionId, zoneDesignation, asOfDate));
  }
  if (requestedAnalyses.includes("PARKING")) {
    findings.push(...evaluateParking(rules, parcel, jurisdictionId, zoneDesignation, asOfDate));
  }
  if (requestedAnalyses.includes("AMENITY")) {
    findings.push(...evaluateAmenity(rules, parcel, jurisdictionId, zoneDesignation, asOfDate, callerContext));
  }
  if (requestedAnalyses.includes("OVERLAY")) {
    findings.push(...evaluateOverlay(rules, parcel, jurisdictionId, zoneDesignation, asOfDate, callerContext));
  }

  const materialFindings = findings.filter((f) => isMaterial(f, requestedAnalyses));
  const gaps: E85DataGap[] = materialFindings.filter((f) => f.outcome === "GAP" && f.gap).map((f) => f.gap!);
  const manualReviewReasons: E85ManualReviewRecord[] = materialFindings.filter((f) => f.outcome === "MANUAL_REVIEW" && f.manualReview).map((f) => f.manualReview!);
  const warnings: string[] = materialFindings.filter((f) => f.warning).map((f) => f.warning!);

  const qualification = collectQualification(materialFindings);
  const envelopeResult = assembleEnvelope(jurisdictionId, zoneDesignation, materialFindings, gaps);
  const hasEnvelopeContent = Object.keys(envelopeResult.envelope).length > 2; // more than just jurisdictionId/zoneDesignation

  const rulesConsidered: readonly E85RuleRecord[] = rules.filter((r) => matchesJurisdictionZone(r, jurisdictionId, zoneDesignation) && requestedAnalyses.includes(r.family));

  const status = determineOverallStatus(findings, requestedAnalyses);

  let result: E85EvaluationOutcome["result"];
  switch (status) {
    case "MANUAL_REVIEW_REQUIRED":
      result = {
        status: "MANUAL_REVIEW_REQUIRED",
        parcel,
        qualification,
        resolvedAt,
        rulesConsidered,
        reasons: manualReviewReasons,
        partialEnvelope: hasEnvelopeContent ? envelopeResult : undefined,
      };
      break;
    case "DATA_GAP":
      result = {
        status: "DATA_GAP",
        parcel,
        qualification,
        resolvedAt,
        rulesConsidered,
        gaps,
        partialEnvelope: hasEnvelopeContent ? envelopeResult : undefined,
      };
      break;
    case "MACHINE_RESOLVED_WITH_WARNINGS":
      result = {
        status: "MACHINE_RESOLVED_WITH_WARNINGS",
        parcel,
        qualification,
        resolvedAt,
        rulesConsidered,
        envelope: hasEnvelopeContent ? envelopeResult : undefined,
        warnings,
      };
      break;
    case "MACHINE_RESOLVED":
    default:
      result = {
        status: "MACHINE_RESOLVED",
        parcel,
        qualification,
        resolvedAt,
        rulesConsidered,
        envelope: hasEnvelopeContent ? envelopeResult : undefined,
      };
      break;
  }

  const useFinding = findings.find((f) => f.family === "USE");
  const outcome: E85EvaluationOutcome = { result };
  if (useFinding && useFinding.resolvedValue) {
    const up = useFinding.resolvedValue as E85UsePermission;
    outcome.usePermission = { useCode: up.useCode, status: up.status, evidence: useFinding.resolvedEvidence as any };
  }
  const fsrFinding = findings.find((f) => f.family === "DENSITY" && f.field === "maxFsr" && f.outcome === "RESOLVED");
  if (fsrFinding) outcome.resolvedMaxFsr = { value: fsrFinding.resolvedValue as number, evidence: fsrFinding.resolvedEvidence as any };
  const gfaCapFinding = findings.find((f) => f.family === "DENSITY" && f.field === "explicitMaxGfaSqm" && f.outcome === "RESOLVED");
  if (gfaCapFinding) outcome.explicitMaxGfaSqm = { value: gfaCapFinding.resolvedValue as number, evidence: gfaCapFinding.resolvedEvidence as any };

  const parkingFindings = findings.filter((f) => f.family === "PARKING" && f.outcome === "RESOLVED");
  if (parkingFindings.length > 0) {
    outcome.parking = parkingFindings.map((f) => ({ key: f.field, value: f.resolvedValue as number, evidence: f.resolvedEvidence as any }));
  }
  const amenityFindings = findings.filter((f) => f.family === "AMENITY" && f.outcome === "RESOLVED");
  if (amenityFindings.length > 0) {
    outcome.amenity = amenityFindings.map((f) => ({ key: f.field, value: f.resolvedValue as string, evidence: f.resolvedEvidence as any }));
  }
  const overlayFindings = findings.filter((f) => f.family === "OVERLAY" && f.outcome === "RESOLVED" && f.field.startsWith("overlay:"));
  if (overlayFindings.length > 0) {
    outcome.overlays = overlayFindings.map((f) => {
      const v = f.resolvedValue as { overlayDesignation: string; description?: string };
      return { overlayDesignation: v.overlayDesignation, description: v.description };
    });
  }

  return outcome;
}

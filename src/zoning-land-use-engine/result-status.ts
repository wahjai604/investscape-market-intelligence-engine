/**
 * InvestScape™ E85 Phase 4 — Rule Normalization & Deterministic Evaluation:
 * explicit result-status precedence.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * ONE explicit, deterministic precedence function decides overall result
 * status — never "whichever check happened to run last." Only findings for
 * a MATERIAL family (one actually present in `requestedAnalyses`) can drive
 * status; a finding for a family the caller never asked about never forces
 * DATA_GAP/MANUAL_REVIEW/warnings.
 *
 * Precedence (documented, exact order):
 *   1. Any material finding with outcome MANUAL_REVIEW -> MANUAL_REVIEW_REQUIRED.
 *   2. Else any material finding with outcome GAP -> DATA_GAP.
 *   3. Else any material finding carries a `warning`, or is
 *      CONDITIONAL_UNRESOLVED -> MACHINE_RESOLVED_WITH_WARNINGS.
 *   4. Else -> MACHINE_RESOLVED.
 */
import type { E85EvaluationFinding } from "./finding-types";
import type { E85RequestedAnalysis } from "./request-types";

export type E85OverallStatus = "MACHINE_RESOLVED" | "MACHINE_RESOLVED_WITH_WARNINGS" | "MANUAL_REVIEW_REQUIRED" | "DATA_GAP";

export function isMaterial(finding: E85EvaluationFinding, requestedAnalyses: readonly E85RequestedAnalysis[]): boolean {
  return requestedAnalyses.includes(finding.family);
}

export function determineOverallStatus(findings: readonly E85EvaluationFinding[], requestedAnalyses: readonly E85RequestedAnalysis[]): E85OverallStatus {
  const material = findings.filter((f) => isMaterial(f, requestedAnalyses));
  if (material.some((f) => f.outcome === "MANUAL_REVIEW")) return "MANUAL_REVIEW_REQUIRED";
  if (material.some((f) => f.outcome === "GAP")) return "DATA_GAP";
  if (material.some((f) => f.outcome === "CONDITIONAL_UNRESOLVED" || (f.warning && f.outcome === "RESOLVED"))) return "MACHINE_RESOLVED_WITH_WARNINGS";
  return "MACHINE_RESOLVED";
}

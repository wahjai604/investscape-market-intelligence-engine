/**
 * InvestScape™ E85 Phase 4 — Rule Normalization & Deterministic Evaluation:
 * use-permission evaluation.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Hard invariant: absence of applicable evidence for the requested use
 * yields UNKNOWN, never PROHIBITED. Conflicting authoritative evidence
 * (distinct statuses for the same use, after dedup) escalates to
 * MANUAL_REVIEW_REQUIRED(CONFLICTING_AUTHORITATIVE_SOURCES) rather than
 * being resolved by array order or any implicit precedence.
 */
import type { E85RuleRecord } from "./rule-family-types";
import type { E85Evidence } from "./evidence-types";
import type { E85UsePermission } from "./use-taxonomy";
import type { E85ParcelReference } from "./jurisdiction-types";
import type { E85EvaluationFinding } from "./finding-types";
import { evaluateTemporalApplicability, matchesJurisdictionZone } from "./applicability";
import { detectConflict } from "./conflict-detection";
import { deriveEvidenceQuality, deriveParcelMatch, deriveRuleApplicability } from "./qualification-derivation";

function sameUsePermission(a: E85UsePermission, b: E85UsePermission): boolean {
  return a.status === b.status;
}

export function evaluateUsePermission(
  rules: readonly E85RuleRecord[],
  parcel: E85ParcelReference,
  jurisdictionId: string,
  zoneDesignation: string,
  useCode: string,
  asOfDate: string,
): E85EvaluationFinding {
  const applicable: E85Evidence<E85UsePermission>[] = [];
  for (const rule of rules) {
    if (rule.family !== "USE") continue;
    if (!matchesJurisdictionZone(rule, jurisdictionId, zoneDesignation)) continue;
    for (const ev of rule.permissions) {
      if (ev.value.useCode !== useCode) continue;
      const temporal = evaluateTemporalApplicability(ev.temporal, asOfDate);
      if (temporal === "APPLIES") applicable.push(ev);
      // NOT_YET_EFFECTIVE / EXPIRED / UNDETERMINED evidence is excluded from
      // consideration entirely here (never guessed); an UNDETERMINED
      // temporal basis on the ONLY otherwise-matching evidence is surfaced
      // below as a gap rather than silently dropped with no trace.
    }
  }

  if (applicable.length === 0) {
    // Check whether the only reason nothing applies is an UNDETERMINED
    // temporal basis, so that case is distinguishable from genuine absence.
    const undeterminedExists = rules.some(
      (rule) =>
        rule.family === "USE" &&
        matchesJurisdictionZone(rule, jurisdictionId, zoneDesignation) &&
        rule.permissions.some((ev) => ev.value.useCode === useCode && evaluateTemporalApplicability(ev.temporal, asOfDate) === "UNDETERMINED"),
    );
    if (undeterminedExists) {
      return {
        family: "USE",
        field: `usePermission:${useCode}`,
        outcome: "GAP",
        gap: {
          reasonCode: "EFFECTIVE_DATE_UNKNOWN",
          reason: `Use-permission evidence for "${useCode}" exists but its effective-date basis is UNKNOWN, so temporal applicability as of ${asOfDate} could not be determined.`,
          sourcesChecked: rules.filter((r) => r.family === "USE").map((r) => r.jurisdictionId),
          checkedAt: new Date().toISOString(),
        },
      };
    }
    // No applicable evidence found at all: UNKNOWN, never PROHIBITED by absence.
    return {
      family: "USE",
      field: `usePermission:${useCode}`,
      outcome: "RESOLVED",
      qualification: {
        evidenceQuality: "low",
        ruleApplicability: "low",
        parcelMatch: deriveParcelMatch(parcel, jurisdictionId, zoneDesignation),
      },
      warning: `No applicable use-permission evidence found for use "${useCode}" in ${jurisdictionId}/${zoneDesignation} as of ${asOfDate}; resolved status is UNKNOWN (absence is never treated as PROHIBITED).`,
      resolvedValue: { useCode, status: "UNKNOWN" } satisfies E85UsePermission,
    };
  }

  const conflict = detectConflict(applicable, sameUsePermission);
  if (conflict.hasConflict) {
    return {
      family: "USE",
      field: `usePermission:${useCode}`,
      outcome: "MANUAL_REVIEW",
      manualReview: {
        reasonCode: "CONFLICTING_AUTHORITATIVE_SOURCES",
        explanation: `${conflict.distinctValues.length} distinct use-permission statuses (${conflict.distinctValues.map((v) => v.status).join(", ")}) were found for use "${useCode}" in ${jurisdictionId}/${zoneDesignation} as of ${asOfDate}, with no basis to prefer one over another.`,
        evidenceConsidered: conflict.deduped.map((e) => e.provenance.sourceId),
        flaggedAt: new Date().toISOString(),
      },
    };
  }

  const resolved = conflict.deduped[0];
  return {
    family: "USE",
    field: `usePermission:${useCode}`,
    outcome: "RESOLVED",
    qualification: {
      evidenceQuality: deriveEvidenceQuality(resolved.provenance),
      ruleApplicability: deriveRuleApplicability(false),
      parcelMatch: deriveParcelMatch(parcel, jurisdictionId, zoneDesignation),
    },
    resolvedValue: resolved.value,
    resolvedEvidence: resolved as E85Evidence<unknown>,
  };
}

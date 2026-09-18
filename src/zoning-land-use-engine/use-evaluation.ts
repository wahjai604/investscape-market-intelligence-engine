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
 *
 * PHASE 12B.2: a permission may be scoped (e.g. to developments within a
 * dwelling-unit bound). Scope is decided BEFORE temporal filtering and conflict
 * detection. A permission proven not to govern this proposal is excluded, and
 * if nothing else applies the answer is still UNKNOWN — never PROHIBITED. A
 * permission whose scope the proposal context cannot decide is a GAP.
 */
import type { E85RuleRecord } from "./rule-family-types";
import type { E85Evidence } from "./evidence-types";
import type { E85UsePermission } from "./use-taxonomy";
import type { E85ParcelReference } from "./jurisdiction-types";
import type { E85EvaluationFinding } from "./finding-types";
import type { E85ApplicabilityContext } from "./rule-applicability-types";
import { evaluateTemporalApplicability, matchesJurisdictionZone } from "./applicability";
import { detectConflict } from "./conflict-detection";
import { deriveEvidenceQuality, deriveParcelMatch, deriveRuleApplicability } from "./qualification-derivation";
import { e85ResolvedApplicabilityAudit, partitionE85EvidenceByApplicability, recognizedE85UseCodes, selectE85EvidenceForProposal } from "./rule-applicability";

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
  applicabilityContext?: E85ApplicabilityContext,
): E85EvaluationFinding {
  const context: E85ApplicabilityContext = applicabilityContext ?? { useCode, recognizedUseCodes: recognizedE85UseCodes(rules, jurisdictionId, zoneDesignation) };
  const field = `usePermission:${useCode}`;

  const matching: E85Evidence<E85UsePermission>[] = [];
  for (const rule of rules) {
    if (rule.family !== "USE") continue;
    if (!matchesJurisdictionZone(rule, jurisdictionId, zoneDesignation)) continue;
    for (const ev of rule.permissions) {
      if (ev.value.useCode === useCode) matching.push(ev);
    }
  }

  const selection = selectE85EvidenceForProposal("USE", field, matching, context, asOfDate);
  if (selection.finding?.outcome === "GAP") return selection.finding;
  // NOT_YET_EFFECTIVE / EXPIRED / UNDETERMINED evidence is excluded from
  // consideration entirely here (never guessed); an UNDETERMINED temporal basis
  // on the ONLY otherwise-matching, in-scope evidence is surfaced below as a
  // gap rather than silently dropped with no trace.
  const applicable = [...selection.applicable];

  if (applicable.length === 0) {
    // Check whether the only reason nothing applies is an UNDETERMINED
    // temporal basis, so that case is distinguishable from genuine absence.
    const inScope = partitionE85EvidenceByApplicability(matching, context).applies;
    const undeterminedExists = inScope.some((ev) => evaluateTemporalApplicability(ev.temporal, asOfDate) === "UNDETERMINED");
    if (undeterminedExists) {
      return {
        family: "USE",
        field,
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
    const outOfScope = selection.finding?.applicability;
    return {
      family: "USE",
      field,
      outcome: "RESOLVED",
      qualification: {
        evidenceQuality: "low",
        ruleApplicability: "low",
        parcelMatch: deriveParcelMatch(parcel, jurisdictionId, zoneDesignation),
      },
      warning:
        `No applicable use-permission evidence found for use "${useCode}" in ${jurisdictionId}/${zoneDesignation} as of ${asOfDate}; resolved status is UNKNOWN (absence is never treated as PROHIBITED).` +
        (outOfScope ? ` Permission evidence for this use exists only for other proposals (scope ${outOfScope.applicabilityKeys.map((k) => `{${k}}`).join(", ")}), which this proposal was proven not to fall within.` : ""),
      resolvedValue: { useCode, status: "UNKNOWN" } satisfies E85UsePermission,
      ...(outOfScope ? { applicability: outOfScope } : {}),
    };
  }

  const conflict = detectConflict(applicable, sameUsePermission);
  if (conflict.hasConflict) {
    return {
      family: "USE",
      field,
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
  const audit = e85ResolvedApplicabilityAudit(resolved as E85Evidence<unknown>);
  return {
    family: "USE",
    field,
    outcome: "RESOLVED",
    qualification: {
      evidenceQuality: deriveEvidenceQuality(resolved.provenance),
      ruleApplicability: deriveRuleApplicability(false),
      parcelMatch: deriveParcelMatch(parcel, jurisdictionId, zoneDesignation),
    },
    resolvedValue: resolved.value,
    resolvedEvidence: resolved as E85Evidence<unknown>,
    ...(audit ? { applicability: audit } : {}),
  };
}

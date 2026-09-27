/**
 * InvestScape™ E85 Phase 4 — Rule Normalization & Deterministic Evaluation:
 * regulatory envelope assembly.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Folds `envelopeContribution`s from density/dimensional findings into one
 * `E85RegulatoryEnvelopeResult`. Each resolved field is recorded as a
 * `resolvedLimit`; none is asserted to be binding. Rule-Only Mode has no
 * geometry or massing model, so it cannot tell whether, say, height rather
 * than FSR limits achievable floor area — `practicalCapacity` says so
 * explicitly and `bindingConstraints` stays empty.
 */
import type { E85RegulatoryEnvelope, E85RegulatoryEnvelopeResult, E85ResolvedLimit } from "./envelope-types";
import type { E85EvaluationFinding } from "./finding-types";
import type { E85DataGap } from "./data-gap-types";

export function assembleEnvelope(
  jurisdictionId: string,
  zoneDesignation: string,
  findings: readonly E85EvaluationFinding[],
  envelopeGaps: readonly E85DataGap[],
): E85RegulatoryEnvelopeResult {
  const envelope: E85RegulatoryEnvelope = { jurisdictionId, zoneDesignation };
  const resolvedLimits: E85ResolvedLimit[] = [];

  for (const finding of findings) {
    const contribution = finding.envelopeContribution;
    if (!contribution) continue;
    if (contribution.field === "setbacksMetres") continue; // never a flat scalar; handled below by field-label convention
    if (contribution.field.startsWith("setbacksMetres.")) continue;
    (envelope as any)[contribution.field] = contribution.evidence;
    resolvedLimits.push({
      field: contribution.field,
      evidence: contribution.evidence,
      ...(contribution.derivationNote === undefined ? {} : { note: contribution.derivationNote }),
    });
  }

  // Setbacks: dimensional-evaluation.ts labels these findings "setback:<yard>".
  const setbacks: Record<string, (typeof envelope)["setbacksMetres"] extends infer R ? any : never> = {};
  let hasSetback = false;
  for (const finding of findings) {
    if (!finding.field.startsWith("setback:") || !finding.envelopeContribution) continue;
    const yard = finding.field.slice("setback:".length);
    setbacks[yard] = finding.envelopeContribution.evidence;
    hasSetback = true;
    resolvedLimits.push({
      field: "setbacksMetres",
      evidence: finding.envelopeContribution.evidence,
      note: `Yard: ${yard}`,
    });
  }
  if (hasSetback) envelope.setbacksMetres = setbacks;

  return {
    envelope,
    bindingConstraints: [],
    resolvedLimits,
    practicalCapacity: {
      status: "NOT_ASSESSED",
      reason:
        "E85 reports each regulatory limit separately. It has no lot geometry or building-form model, so it does not determine which limit (FSR, height, storeys, setbacks, site coverage) governs achievable floor area; maxRegulatoryGfaSqm is a legal ceiling, not practical capacity.",
    },
    envelopeGaps,
  };
}

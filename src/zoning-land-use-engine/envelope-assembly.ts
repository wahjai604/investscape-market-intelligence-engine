/**
 * InvestScape™ E85 Phase 4 — Rule Normalization & Deterministic Evaluation:
 * regulatory envelope assembly.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Folds `envelopeContribution`s from density/dimensional findings into one
 * `E85RegulatoryEnvelopeResult`, and computes binding-constraint records
 * ONLY where mechanically defensible: a resolved scalar field on the
 * envelope directly binds itself (e.g. "maxHeightMetres constrains
 * maxHeightMetres"). Rule-Only Mode never claims cross-field binding (e.g.
 * "height caps GFA") because it never has the geometry to prove that.
 */
import type { E85RegulatoryEnvelope, E85BindingConstraint, E85RegulatoryEnvelopeResult } from "./envelope-types";
import type { E85EvaluationFinding } from "./finding-types";
import type { E85DataGap } from "./data-gap-types";

export function assembleEnvelope(
  jurisdictionId: string,
  zoneDesignation: string,
  findings: readonly E85EvaluationFinding[],
  envelopeGaps: readonly E85DataGap[],
): E85RegulatoryEnvelopeResult {
  const envelope: E85RegulatoryEnvelope = { jurisdictionId, zoneDesignation };
  const bindingConstraints: E85BindingConstraint[] = [];

  for (const finding of findings) {
    const contribution = finding.envelopeContribution;
    if (!contribution) continue;
    if (contribution.field === "setbacksMetres") continue; // never a flat scalar; handled below by field-label convention
    if (contribution.field.startsWith("setbacksMetres.")) continue;
    (envelope as any)[contribution.field] = contribution.evidence;
    bindingConstraints.push({
      constrainedField: contribution.field,
      evidence: contribution.evidence,
      note: contribution.derivationNote,
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
    bindingConstraints.push({
      constrainedField: "setbacksMetres",
      evidence: finding.envelopeContribution.evidence,
      note: `Yard: ${yard}`,
    });
  }
  if (hasSetback) envelope.setbacksMetres = setbacks;

  return { envelope, bindingConstraints, envelopeGaps };
}

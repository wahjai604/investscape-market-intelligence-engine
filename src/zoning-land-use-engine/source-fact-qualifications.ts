/**
 * InvestScape™ E85 — fact-level qualifications and additional locators.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Shared by every adapter that accepts `E85StructuredSourceFact.qualifications`
 * or `additionalLocators`, so validation and wording are stated once.
 *
 * A qualification never changes a fact's value, scope or outcome here. It is
 * validated (fail closed: a qualification that cannot be carried faithfully
 * stops the fact rather than being dropped) and then surfaced as a finding.
 */
import type { E85NormalizationFinding } from "./normalization-finding-types";
import type { E85DocumentLocator } from "./provenance-types";
import type { E85StructuredSourceFact } from "./source-fact-types";

const QUALIFICATION_KINDS = new Set(["USE_SPECIFIC_REGULATION", "DISCRETIONARY_RELAXATION", "EXCEPTION"]);
const HISTORY_STATUSES = new Set(["INSTRUMENTS_LOCATED", "PARTLY_UNLOCATED", "NOT_TRACED"]);

/** Deterministic, human-readable citation, e.g. "By-law 13447 §3.1.2.10 p.10". */
export function formatE85DocumentLocator(locator: E85DocumentLocator): string {
  const parts: string[] = [];
  if (locator.bylawOrDocumentId !== undefined) parts.push(`By-law ${locator.bylawOrDocumentId}`);
  if (locator.schedule !== undefined) parts.push(locator.schedule);
  if (locator.section !== undefined) parts.push(`§${locator.section}`);
  if (locator.clause !== undefined) parts.push(`cl.${locator.clause}`);
  if (locator.row !== undefined) parts.push(`row "${locator.row}"`);
  if (locator.page !== undefined) parts.push(`p.${locator.page}`);
  return parts.join(" ");
}

const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

/** The first reason the fact's qualifications or additional locators cannot be carried faithfully, or undefined when they can. */
export function e85FactQualificationProblem(fact: E85StructuredSourceFact): string | undefined {
  for (const locator of fact.additionalLocators ?? []) {
    if (!nonEmpty(locator.section)) return `An additional locator on fact "${fact.factId}" names no section.`;
  }
  const seen = new Set<string>();
  for (const q of fact.qualifications ?? []) {
    if (!nonEmpty(q.qualificationId)) return `A qualification on fact "${fact.factId}" has no qualificationId.`;
    if (seen.has(q.qualificationId)) return `Qualification "${q.qualificationId}" appears twice on fact "${fact.factId}".`;
    seen.add(q.qualificationId);
    if (!QUALIFICATION_KINDS.has(q.kind)) return `Qualification "${q.qualificationId}" on fact "${fact.factId}" has an unrecognized kind.`;
    if (!nonEmpty(q.locator?.section)) return `Qualification "${q.qualificationId}" on fact "${fact.factId}" names no section.`;
    if (!nonEmpty(q.description)) return `Qualification "${q.qualificationId}" on fact "${fact.factId}" has no description.`;
    // A numeric field would let a relaxation be read as a limit.
    if ("numericValue" in (q as object)) return `Qualification "${q.qualificationId}" on fact "${fact.factId}" carries a numeric value; qualifications never state limits.`;
    if (q.conditionId !== undefined && !(fact.applicability?.conditionIds ?? []).includes(q.conditionId)) {
      return `Qualification "${q.qualificationId}" on fact "${fact.factId}" names condition "${q.conditionId}", which the fact's scope does not require.`;
    }
    if (fact.family === "USE" && q.kind === "USE_SPECIFIC_REGULATION" && q.conditionId === undefined) {
      return `Qualification "${q.qualificationId}" on use fact "${fact.factId}" is a use-specific regulation with no gating condition; the permission would read as unconditional while compliance is unestablished.`;
    }
    if (!HISTORY_STATUSES.has(q.history?.status)) return `Qualification "${q.qualificationId}" on fact "${fact.factId}" has no recognized history status.`;
    if (q.history.status !== "INSTRUMENTS_LOCATED" && !nonEmpty(q.history.disclosure)) {
      return `Qualification "${q.qualificationId}" on fact "${fact.factId}" has an unresolved history (${q.history.status}) with no disclosure.`;
    }
  }
  return undefined;
}

/** One finding per additional locator and per qualification, in the fact's own order. */
export function e85FactQualificationFindings(fact: E85StructuredSourceFact): E85NormalizationFinding[] {
  const findings: E85NormalizationFinding[] = [];
  for (const locator of fact.additionalLocators ?? []) {
    findings.push({
      code: "SOURCE_LOCATOR_ADDITIONAL",
      severity: "INFO",
      factId: fact.factId,
      sourceTerm: fact.sourceTerm,
      message: `Fact "${fact.factId}" is also stated at ${formatE85DocumentLocator(locator)} (primary citation ${formatE85DocumentLocator(fact.locator)}).`,
    });
  }
  for (const q of fact.qualifications ?? []) {
    const instruments = (q.history.locatedInstruments ?? []).map(formatE85DocumentLocator);
    const history =
      q.history.status === "INSTRUMENTS_LOCATED"
        ? `History: instruments located (${instruments.join("; ") || "none named"}); completeness of its history and definitions is not asserted.`
        : `History ${q.history.status}${instruments.length > 0 ? ` (located: ${instruments.join("; ")})` : ""}: ${q.history.disclosure}`;
    const effect =
      q.kind === "DISCRETIONARY_RELAXATION"
        ? "Discretionary: the stated value remains the limit unless an official grants a relaxation; the relaxation is not an entitlement."
        : q.kind === "EXCEPTION"
          ? "An exception to the value's premise; the value is unchanged."
          : q.conditionId !== undefined
            ? `A use-specific regulation the proposal must also satisfy; the value applies only when the caller affirms condition "${q.conditionId}".`
            : "A use-specific regulation the proposal must also satisfy; the value is unchanged.";
    findings.push({
      code: "SOURCE_QUALIFICATION_DISCLOSED",
      severity: "WARNING",
      factId: fact.factId,
      sourceTerm: fact.sourceTerm,
      message: `Fact "${fact.factId}" is qualified by ${formatE85DocumentLocator(q.locator)} [${q.kind}, ${q.qualificationId}]: ${q.description} ${effect} ${history}`,
    });
  }
  return findings;
}

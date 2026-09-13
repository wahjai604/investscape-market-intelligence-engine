/**
 * InvestScape™ E85 Phase 4 — Rule Normalization & Deterministic Evaluation:
 * jurisdiction/zone/temporal applicability filtering.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Exact string match only for jurisdiction/zone (no fuzzy matching, no
 * normalization of "R1-1" toward "R1"). No "nearest version" temporal
 * fallback — an undetermined temporal basis makes a rule's applicability
 * undetermined, never guessed.
 */
import type { E85TemporalWindow } from "./evidence-types";
import type { E85RuleRecord } from "./rule-family-types";

export type E85TemporalApplicability = "APPLIES" | "NOT_YET_EFFECTIVE" | "EXPIRED" | "UNDETERMINED";

/** Whether `window` covers `asOfDate`, using ISO 8601 date string comparison (lexicographic ordering is valid for ISO 8601 date-only or full-timestamp strings of consistent format). */
export function evaluateTemporalApplicability(window: E85TemporalWindow, asOfDate: string): E85TemporalApplicability {
  if (window.effectiveDateBasis === "UNKNOWN") return "UNDETERMINED";
  if (window.effectiveFrom !== undefined && asOfDate < window.effectiveFrom) return "NOT_YET_EFFECTIVE";
  if (window.effectiveTo !== undefined && asOfDate > window.effectiveTo) return "EXPIRED";
  return "APPLIES";
}

/** Exact jurisdictionId + zoneDesignation match. */
export function matchesJurisdictionZone(rule: E85RuleRecord, jurisdictionId: string, zoneDesignation: string): boolean {
  return rule.jurisdictionId === jurisdictionId && rule.zoneDesignation === zoneDesignation;
}

/** Rules matching jurisdiction+zone, regardless of temporal status (temporal filtering happens per-evidence-item within each family evaluator, since a single rule record can bundle evidence items with different temporal windows). */
export function selectByJurisdictionZone(rules: readonly E85RuleRecord[], jurisdictionId: string, zoneDesignation: string): E85RuleRecord[] {
  return rules.filter((r) => matchesJurisdictionZone(r, jurisdictionId, zoneDesignation));
}

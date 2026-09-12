/**
 * InvestScape™ E70 Phase 4 — Index Applicability Engine.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Deterministic applicability evaluation: given one cost observation and one
 * index series, decide whether that series may defensibly escalate that
 * observation at all, and if so, whether the relationship is DIRECT
 * (series is genuinely specific to this exact geography) or INDIRECT (series
 * is broader than the request but explicitly, deliberately treated as usable
 * by the rule table below — never inferred from string similarity).
 *
 * Design Principle 4 (geographic integrity) and Principle 2 (no invented
 * index data) govern every rule here: an index is never applicable merely
 * because its geography STRING looks similar to the observation's. Every
 * DIRECT/INDIRECT grant below is an explicit, named rule with a rationale,
 * not a generic containment check (e.g. "region matches" or "country
 * matches" is NEVER, by itself, sufficient for INDIRECT — see the national
 * rule below, which is scoped to one specific series, not to "any national
 * series matches any city in that country").
 */
import type { CRECitedObservation } from "../cre-intelligence/types";
import type { CCEscalationPolicy } from "./escalation-policy";
import type { CCIndexApplicabilityResult, CCIndexSeries } from "./index-types";

function parseCurrencyFromUnit(unit: string): "USD" | "CAD" | undefined {
  if (unit.startsWith("USD")) return "USD";
  if (unit.startsWith("CAD")) return "CAD";
  return undefined;
}

/**
 * Explicit per-series geographic applicability rules. Each entry names
 * exactly which series it governs and exactly what relationship it grants —
 * there is no fallback rule that applies to a series not listed here.
 *
 * `rlb-city-comparative-cost-index`: DIRECT, but ONLY for the exact city the
 * series actually carries an observation for (Austin/Miami/Seattle/Phoenix).
 * An unlisted city is never treated as if this series covered it.
 *
 * `rlb-national-construction-cost-index`: INDIRECT, for any US city cost
 * observation, gated by `policy.geography.allowNationalIndexForCityCost`.
 * This is a considered, documented judgment call (see docs/E70-phase4-
 * escalation-and-index.md "RLB national index policy"), not an automatic
 * "national = local" assumption: RLB's own report publishes this specific
 * series as a cross-market US escalation index, independent of any one
 * city's own figures. It is never promoted to DIRECT and never applies to a
 * non-US geography.
 *
 * `statcan-bcpi`: no rule at all. Even if it had observations, no geographic
 * applicability rule has been written for it, so it is always inapplicable
 * (Section: unsupported relationship) until one is deliberately added
 * alongside real ingested data — see data/index-series.ts.
 */
function evaluateGeography(
  seriesId: CCIndexSeries["seriesId"],
  observation: CRECitedObservation,
  policy: CCEscalationPolicy,
): CCIndexApplicabilityResult {
  const country = observation.geography.country;
  const city = observation.geography.city;

  if (seriesId === "rlb-city-comparative-cost-index") {
    const coveredCities = new Set(["Austin", "Miami", "Seattle", "Phoenix"]);
    if (country === "US" && city !== undefined && coveredCities.has(city)) {
      return { applicable: true, relationship: "DIRECT", reason: `RLB's city-level Comparative Cost Index carries an observation for "${city}", exactly matching this observation's geography.` };
    }
    return {
      applicable: false,
      failureCategory: "GEOGRAPHY",
      reason: city
        ? `RLB's city-level Comparative Cost Index has no observation for "${city}" — it covers only Austin, Miami, Seattle, and Phoenix. No fallback to a similar city is performed.`
        : "This observation does not state a specific city, so it cannot be matched against RLB's city-level index (which is city-specific by definition).",
    };
  }

  if (seriesId === "rlb-national-construction-cost-index") {
    if (country !== "US") {
      return {
        applicable: false,
        failureCategory: "GEOGRAPHY",
        reason: `RLB's National Construction Cost Index covers the United States only; this observation's geography (country "${country}") is outside that coverage. No US index is ever substituted for a non-US geography.`,
      };
    }
    if (!policy.geography.allowNationalIndexForCityCost) {
      return {
        applicable: false,
        failureCategory: "GEOGRAPHY",
        reason: "Policy has allowNationalIndexForCityCost = false; the national index is not permitted to escalate a city-level cost observation under this policy.",
      };
    }
    return {
      applicable: true,
      relationship: "INDIRECT",
      reason: "RLB's National Construction Cost Index is explicitly published as a cross-market US escalation input, independent of city. Applied here as an INDIRECT relationship only — never presented as city-specific evidence.",
    };
  }

  // No rule exists for any other series id (e.g. statcan-bcpi): always inapplicable.
  return {
    applicable: false,
    failureCategory: "GEOGRAPHY",
    reason: `No geographic applicability rule has been defined for index series "${seriesId}". An index is never applicable by default — a rule must be explicitly written and reviewed.`,
  };
}

/**
 * The full applicability verdict for one (observation, series) pair,
 * considering: source status, metric type, currency, and geography — in
 * that order, so the FIRST disqualifying reason is always the one reported
 * (never a vague aggregate "doesn't match").
 */
export function evaluateIndexApplicability(
  observation: CRECitedObservation,
  series: CCIndexSeries,
  policy: CCEscalationPolicy,
): CCIndexApplicabilityResult {
  if (observation.metric !== "hard_cost" && observation.metric !== "soft_cost") {
    return {
      applicable: false,
      failureCategory: "METRIC",
      reason: `Observation metric "${observation.metric}" is not a hard_cost or soft_cost observation. An index/percent-change observation can never itself be the subject of escalation (it is not a cost).`,
    };
  }

  if (!policy.allowedIndexSourceStatuses.includes(series.sourceStatus)) {
    return {
      applicable: false,
      failureCategory: "SOURCE_STATUS",
      reason: `Index series "${series.seriesId}" has source status "${series.sourceStatus}", which is not in the policy's allowed statuses (${policy.allowedIndexSourceStatuses.join(", ")}). A REGISTER or REJECT source is acknowledged but never used to compute a number.`,
    };
  }

  const observationCurrency = parseCurrencyFromUnit(observation.unit);
  if (observationCurrency === undefined) {
    return {
      applicable: false,
      failureCategory: "CURRENCY",
      reason: `Observation unit "${observation.unit}" does not declare an explicit currency; no index can be paired with an unstated currency.`,
    };
  }
  if (observationCurrency !== series.applicableCurrency) {
    return {
      applicable: false,
      failureCategory: "CURRENCY",
      reason: `Observation currency "${observationCurrency}" does not match index series "${series.seriesId}"'s applicable currency "${series.applicableCurrency}". Currency and escalation are never bridged without an explicit FX rate, which is out of scope for escalation entirely (Design Principle 3).`,
    };
  }

  return evaluateGeography(series.seriesId, observation, policy);
}

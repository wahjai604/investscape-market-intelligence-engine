/**
 * InvestScape™ E88 Phase 2 — Construction Cost Comparability Layer.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Given a `ConstructionCostRequest` and a pool of E86 `CRECitedObservation`s
 * (wrapped as `ConstructionCostCandidateInput`), classifies every candidate
 * EXACT/CLOSE/APPROXIMATE/UNSUPPORTED, exposes per-dimension reasoning, and
 * produces an explicit INCLUDED/EXCLUDED decision with a machine-readable
 * reason and a deterministic audit explanation.
 *
 * THIS FILE DOES NOT: aggregate a benchmark value, escalate cost, apply a
 * currency/unit conversion (that is normalize.ts's job, invoked here only in
 * identification mode — see below), or decide request-level DATA_GAP status
 * (that is pipeline.ts, Phase 2 objective 6's gating logic). It answers
 * exactly one question per candidate: "does this observation legitimately
 * inform the requested benchmark, and how closely?"
 *
 * DESIGN PRECEDENT REUSED FROM E86/E87 (architectural philosophy, not code):
 * - The four-tier vocabulary (`exact|close|approximate|unsupported`) is
 *   E86's `MappingConfidence`, re-exported by taxonomy.ts, unchanged.
 * - Dimensions combine by FLOOR, never by average — one disqualifying
 *   dimension is never papered over by several strong ones (E87's
 *   `combineDimensions` precedent, independently re-implemented here).
 * - "Only filter on a dimension the request actually specifies" (E87's
 *   `matchesIdentity` principle).
 * - A subtype mapped at "close" or "approximate" confidence is NEVER
 *   reported as "exact" merely because the canonical subtype name matches —
 *   the mapping's own confidence is the ceiling (Phase 1 Decision, taxonomy.ts).
 *
 * NOTHING under src/cre-intelligence/ or src/cap-rate-engine/ is imported for
 * its mutation surface; every import below is a read-only type or pure
 * function, and E87 (src/cap-rate-engine/) is not imported at all — E88 is
 * independently owned.
 */
import type { CREGeography } from "../cre-intelligence/types";
import type { CREPresentationFreshness } from "../cre-intelligence/ingestion/observation-lifecycle";
import { normalizeObservation } from "./normalize";
import { mapSourceSubtype, type ConstructionSubtypeMapping } from "./taxonomy";
import type {
  CCComparabilityDimensions,
  CCDimensionResult,
  CCExclusionReasonCode,
  CCMatchLevel,
  ConstructionCostComparabilityCandidate,
  ConstructionCostComparabilityResult,
} from "./comparability-types";
import type { ConstructionCostCandidateInput, ConstructionCostRequest } from "./types";

const RANK: Readonly<Record<CCMatchLevel, number>> = {
  unsupported: 0,
  approximate: 1,
  close: 2,
  exact: 3,
};

/** Freshest-to-oldest rank, matching E86's `assessFreshness` band ordering. */
const FRESHNESS_RANK: Readonly<Record<CREPresentationFreshness, number>> = {
  live_current: 4,
  recent: 3,
  stale: 2,
  historical: 1,
  unavailable: 0,
};

function normalizeStr(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function worseOf(a: CCMatchLevel, b: CCMatchLevel): CCMatchLevel {
  return RANK[a] <= RANK[b] ? a : b;
}

// ---------------------------------------------------------------------------
// Geography (country / region / metro / city / submarket)
// ---------------------------------------------------------------------------

function evaluateGeography(request: CREGeography, obs: CREGeography): CCDimensionResult {
  if (normalizeStr(request.country) !== normalizeStr(obs.country)) {
    return { level: "unsupported", reason: `Requested country "${request.country}" does not match observation country "${obs.country}".` };
  }

  if (request.submarket !== undefined) {
    if (normalizeStr(obs.submarket) === normalizeStr(request.submarket) && normalizeStr(obs.submarket) !== "") {
      return { level: "exact", reason: `Exact submarket match: "${request.submarket}".` };
    }
    if (obs.submarket === undefined) {
      return {
        level: "approximate",
        reason: `Request specifies submarket "${request.submarket}"; observation states no submarket — never auto-promoted to exact.`,
      };
    }
    return {
      level: "unsupported",
      reason: `Request specifies submarket "${request.submarket}"; observation is a different submarket "${obs.submarket}".`,
    };
  }

  if (request.city !== undefined) {
    if (normalizeStr(obs.city) === normalizeStr(request.city) && normalizeStr(obs.city) !== "") {
      return { level: "exact", reason: `Exact city match: "${request.city}".` };
    }
    if (request.metro !== undefined && normalizeStr(obs.metro) === normalizeStr(request.metro) && normalizeStr(obs.metro) !== "") {
      return {
        level: "approximate",
        reason: `Same metro ("${request.metro}") but different city — observation city "${obs.city ?? "unspecified"}" vs requested "${request.city}".`,
      };
    }
    if (obs.city === undefined && request.metro === undefined) {
      return {
        level: "approximate",
        reason: `Request specifies city "${request.city}"; observation only states country/region, not a city — broader than requested, not exact.`,
      };
    }
    return {
      level: "unsupported",
      reason: `Request specifies city "${request.city}"; observation city "${obs.city ?? "unspecified"}" is a different city with no shared metro.`,
    };
  }

  if (request.metro !== undefined) {
    if (normalizeStr(obs.metro) === normalizeStr(request.metro) && normalizeStr(obs.metro) !== "") {
      return { level: "exact", reason: `Exact metro match: "${request.metro}".` };
    }
    return {
      level: obs.metro === undefined ? "approximate" : "unsupported",
      reason:
        obs.metro === undefined
          ? `Request specifies metro "${request.metro}"; observation states no metro.`
          : `Request specifies metro "${request.metro}"; observation metro is "${obs.metro}".`,
    };
  }

  return { level: "exact", reason: `Request specifies country only ("${request.country}"); country matches.` };
}

function evaluateGeographyType(
  requested: ConstructionCostRequest["locationType"],
  obsLocationType: string | undefined,
): CCDimensionResult {
  if (requested === undefined) {
    return { level: "not_constrained", reason: "Request does not pin a downtown/suburban/urban geography type." };
  }
  const obs = obsLocationType ?? "unspecified";
  if (obs === requested) {
    return { level: "exact", reason: `Observation states locationType "${obs}", matching the request.` };
  }
  if (obs === "unspecified") {
    return {
      level: "approximate",
      reason: `Request pins locationType "${requested}"; observation does not state a geography type — never assumed to match.`,
    };
  }
  if ((requested === "cbd" && obs === "urban") || (requested === "urban" && obs === "cbd")) {
    return {
      level: "approximate",
      reason: `Observation states "${obs}", which overlaps but is not synonymous with requested "${requested}" — approximate, never close.`,
    };
  }
  return {
    level: "unsupported",
    reason: `Request pins locationType "${requested}"; observation explicitly states the different type "${obs}".`,
  };
}

function evaluateAssetClass(requested: string, obsAssetClass: string): CCDimensionResult {
  if (requested === obsAssetClass) {
    return { level: "exact", reason: `Asset class matches: "${requested}".` };
  }
  return {
    level: "unsupported",
    reason: `Requested asset class "${requested}" does not equal observation asset class "${obsAssetClass}" — never folded into an unrelated category (e.g. multifamily/industrial have no RLB line and must not be substituted with a different asset class's figure).`,
  };
}

/**
 * Subtype comparability via the taxonomy's per-source mapping. The mapping's
 * OWN confidence is the ceiling: a "close" or "approximate" source mapping
 * can never be reported as "exact" here merely because the mapped canonical
 * subtype equals the requested one (Phase 1 Decision, taxonomy.ts).
 */
function evaluateSubtype(
  requestedCanonicalSubtype: string | undefined,
  sourceId: string,
  obsSubtype: string | undefined,
): CCDimensionResult {
  if (requestedCanonicalSubtype === undefined) {
    return { level: "not_constrained", reason: "Request does not pin a canonical subtype." };
  }
  const mapping: ConstructionSubtypeMapping = mapSourceSubtype(sourceId, obsSubtype);
  if (mapping.confidence === "unsupported" || mapping.canonicalSubtype === undefined) {
    return {
      level: "unsupported",
      reason: `Observation subtype "${obsSubtype ?? "unspecified"}" from source "${sourceId}" has no supported canonical-taxonomy mapping: ${mapping.rationale}`,
    };
  }
  if (mapping.canonicalSubtype !== requestedCanonicalSubtype) {
    return {
      level: "unsupported",
      reason: `Observation subtype "${obsSubtype}" maps to canonical "${mapping.canonicalSubtype}", not the requested "${requestedCanonicalSubtype}".`,
    };
  }
  // Matched canonical subtype: level is capped at the mapping's own confidence — never upgraded to exact.
  return {
    level: mapping.confidence,
    reason: `Observation subtype "${obsSubtype}" maps to requested canonical "${requestedCanonicalSubtype}" at mapping confidence "${mapping.confidence}" (never upgraded): ${mapping.rationale}`,
  };
}

function evaluateCostRepresentation(
  requested: ConstructionCostRequest["costRepresentation"],
  obsRepresentation: string | undefined,
): CCDimensionResult {
  if (obsRepresentation === undefined) {
    return {
      level: "unsupported",
      reason: "Observation is not a recognized hard_cost/soft_cost representation and cannot serve any cost-representation request.",
    };
  }
  if (requested === obsRepresentation) {
    return { level: "exact", reason: `Cost representation matches: "${requested}".` };
  }
  // A "total_cost" request is never served by a bare hard_cost or soft_cost observation on its own —
  // that gating decision happens at the pipeline level (Phase 1 Decision 5). At the dimension level,
  // a mismatch here is always unsupported; there is no "close enough" substitute for representation.
  return {
    level: "unsupported",
    reason: `Requested cost representation "${requested}" does not match observation representation "${obsRepresentation}" — hard cost is never treated as a stand-in for soft or total cost, and vice versa.`,
  };
}

function evaluateUnitBasis(
  requested: ConstructionCostRequest["unitBasis"],
  obsUnitBasis: string | undefined,
): CCDimensionResult {
  if (requested === undefined) {
    return { level: "not_constrained", reason: "Request does not pin a unit/basis." };
  }
  if (obsUnitBasis === undefined) {
    return { level: "unsupported", reason: `Request pins unit basis "${requested}"; observation states no basis.` };
  }
  if (requested === obsUnitBasis) {
    return { level: "exact", reason: `Unit basis matches: "${requested}".` };
  }
  const bothAreaBases = (requested === "per_sf" || requested === "per_sm") && (obsUnitBasis === "per_sf" || obsUnitBasis === "per_sm");
  if (bothAreaBases) {
    return {
      level: "close",
      reason: `Observation basis "${obsUnitBasis}" is deterministically convertible to requested "${requested}" via the fixed SF/SM constant.`,
    };
  }
  return {
    level: "unsupported",
    reason: `Observation basis "${obsUnitBasis}" cannot be deterministically converted to requested "${requested}" without unstated information (e.g. average unit size).`,
  };
}

function evaluateCurrency(requested: ConstructionCostRequest["currency"], obsCurrency: string | undefined): CCDimensionResult {
  if (requested === undefined) {
    return { level: "not_constrained", reason: "Request does not pin a currency." };
  }
  if (obsCurrency === undefined) {
    return { level: "unsupported", reason: `Request pins currency "${requested}"; observation's unit does not encode a currency.` };
  }
  if (requested === obsCurrency) {
    return { level: "exact", reason: `Currency matches: "${requested}".` };
  }
  return {
    level: "unsupported",
    reason: `Requested currency "${requested}" differs from observation currency "${obsCurrency}" — no FX rate is invented to bridge this (Phase 1 Section 13).`,
  };
}

function evaluatePeriod(
  requested: ConstructionCostRequest["effectivePeriod"],
  obsStart: string,
  obsEnd: string,
): CCDimensionResult {
  if (requested === undefined) {
    return { level: "not_constrained", reason: "Request does not pin an effective period." };
  }
  const reqStart = Date.parse(requested.start);
  const reqEnd = Date.parse(requested.end);
  const start = Date.parse(obsStart);
  const end = Date.parse(obsEnd);
  if ([reqStart, reqEnd, start, end].some((n) => Number.isNaN(n))) {
    return { level: "unsupported", reason: "Unparseable period date(s); a period comparison cannot be honestly made." };
  }

  const overlaps = start <= reqEnd && end >= reqStart;
  if (overlaps) {
    return { level: "exact", reason: `Observation period ${obsStart}..${obsEnd} overlaps the requested period ${requested.start}..${requested.end}.` };
  }

  const monthsPrior = (reqEnd - end) / (1000 * 60 * 60 * 24 * 30.44);
  if (monthsPrior <= 0) {
    return {
      level: "unsupported",
      reason: `Observation period ${obsStart}..${obsEnd} is entirely after the requested period ${requested.start}..${requested.end}.`,
    };
  }
  if (monthsPrior <= 12) {
    return {
      level: "close",
      reason: `Observation period ends ${obsEnd}, within the trailing 12 months of the requested period end ${requested.end}.`,
    };
  }
  if (monthsPrior <= 24) {
    return {
      level: "approximate",
      reason: `Observation period ends ${obsEnd}, ${Math.round(monthsPrior)} months before the requested period end ${requested.end} — 12-24 months prior.`,
    };
  }
  return {
    level: "unsupported",
    reason: `Observation period ends ${obsEnd}, over 24 months before the requested period end ${requested.end}.`,
  };
}

function evaluateFreshness(freshness: CREPresentationFreshness | undefined): CCDimensionResult {
  if (freshness === undefined) {
    return {
      level: "approximate",
      reason: "Freshness was not assessed for this observation — never assumed current.",
    };
  }
  switch (freshness) {
    case "live_current":
      return { level: "exact", reason: "Freshness is live_current." };
    case "recent":
      return { level: "close", reason: "Freshness is recent." };
    case "stale":
      return {
        level: "approximate",
        reason: "Freshness is stale — historically valid but not suitable for a current benchmark; never excluded on this dimension alone.",
      };
    case "historical":
      return {
        level: "approximate",
        reason: "Freshness is historical — a valid fact about its own period, never deleted or invalidated, but capped below exact/close for current-benchmark purposes.",
      };
    case "unavailable":
      return {
        level: "unsupported",
        reason: "The backing source is currently unavailable; this observation cannot be confirmed current.",
      };
  }
}

function combineDimensions(dims: CCComparabilityDimensions): CCMatchLevel {
  let overall: CCMatchLevel = "exact";
  for (const dim of Object.values(dims)) {
    if (dim.level === "not_constrained") continue;
    overall = worseOf(overall, dim.level);
  }
  return overall;
}

const EXCLUSION_PRIORITY: ReadonlyArray<{ key: keyof CCComparabilityDimensions; code: CCExclusionReasonCode }> = [
  { key: "assetMatch", code: "WRONG_ASSET_TYPE" },
  { key: "subtypeMatch", code: "WRONG_SUBTYPE_MAPPING" },
  { key: "geographyMatch", code: "WRONG_GEOGRAPHY" },
  { key: "geographyTypeMatch", code: "WRONG_GEOGRAPHY_TYPE" },
  { key: "costRepresentationMatch", code: "WRONG_COST_REPRESENTATION" },
  { key: "currencyMatch", code: "CURRENCY_MISMATCH" },
  { key: "unitBasisMatch", code: "INCOMPATIBLE_UNIT_BASIS" },
  { key: "periodMatch", code: "STALE" },
  { key: "freshnessMatch", code: "UNAVAILABLE" },
];

function hasProvenance(obs: ConstructionCostCandidateInput["observation"]): boolean {
  const c = obs.citation;
  return Boolean(
    c &&
      c.sourceName.trim() &&
      c.reportTitle.trim() &&
      c.publicationDate.trim() &&
      c.sourceUrl.trim() &&
      c.retrievedAt.trim() &&
      obs.source?.sourceId?.trim(),
  );
}

function buildExplanation(
  decision: "INCLUDED" | "EXCLUDED",
  dims: CCComparabilityDimensions,
  comparability: CCMatchLevel,
  exclusionReasonCode?: CCExclusionReasonCode,
): string {
  const entries = Object.entries(dims) as Array<[keyof CCComparabilityDimensions, CCDimensionResult]>;
  if (decision === "EXCLUDED") {
    const failing = entries.filter(([, d]) => d.level === "unsupported");
    const detail = failing.map(([name, d]) => `${name}=unsupported (${d.reason})`).join("; ");
    return `EXCLUDED (${exclusionReasonCode ?? "OTHER"}): ${detail || "overall comparability floor is unsupported"}.`;
  }
  const constrained = entries.filter(([, d]) => d.level !== "not_constrained");
  const summary = constrained.map(([name, d]) => `${name}=${d.level}`).join(", ");
  return `INCLUDED (comparability=${comparability}): ${summary || "no dimensions constrained by the request"}.`;
}

/**
 * Evaluate one candidate observation against one request. Pure function: it
 * never mutates `input.observation` and produces the same result for the
 * same inputs every time (Phase 2 objective 9: determinism).
 */
export function evaluateCandidate(
  request: ConstructionCostRequest,
  input: ConstructionCostCandidateInput,
): ConstructionCostComparabilityCandidate {
  const obs = input.observation;
  const warnings: string[] = [];

  // Identification-only normalization (no target currency/unit conversion attempted here) —
  // comparability scores the mismatch as a dimension instead of trying to bridge it.
  const normalization = normalizeObservation(obs);

  if (normalization.status === "FAILED") {
    const dimensions: CCComparabilityDimensions = {
      geographyMatch: evaluateGeography(request.geography, obs.geography),
      geographyTypeMatch: evaluateGeographyType(request.locationType, obs.locationType),
      assetMatch: evaluateAssetClass(request.assetClass, obs.assetClass),
      subtypeMatch: { level: "unsupported", reason: "Not evaluated: observation is not a normalizable cost observation." },
      costRepresentationMatch: { level: "unsupported", reason: normalization.explanation },
      unitBasisMatch: { level: "unsupported", reason: "Not evaluated: observation is not a normalizable cost observation." },
      currencyMatch: { level: "unsupported", reason: "Not evaluated: observation is not a normalizable cost observation." },
      periodMatch: evaluatePeriod(request.effectivePeriod, obs.periodStart, obs.periodEnd),
      freshnessMatch: evaluateFreshness(input.freshness),
    };
    return {
      observation: obs,
      normalized: undefined,
      comparability: "unsupported",
      dimensions,
      decision: "EXCLUDED",
      exclusionReasonCode: "WRONG_COST_REPRESENTATION",
      explanation: `EXCLUDED (WRONG_COST_REPRESENTATION): ${normalization.explanation}`,
      warnings,
    };
  }

  const normalized = normalization.result;

  const dimensions: CCComparabilityDimensions = {
    geographyMatch: evaluateGeography(request.geography, obs.geography),
    geographyTypeMatch: evaluateGeographyType(request.locationType, obs.locationType),
    assetMatch: evaluateAssetClass(request.assetClass, obs.assetClass),
    subtypeMatch: evaluateSubtype(request.canonicalSubtype, obs.source.sourceId, obs.propertySubtype),
    costRepresentationMatch: evaluateCostRepresentation(request.costRepresentation, normalized.costRepresentation),
    unitBasisMatch: evaluateUnitBasis(request.unitBasis, normalized.unitBasis),
    currencyMatch: evaluateCurrency(request.currency, normalized.currency),
    periodMatch: evaluatePeriod(request.effectivePeriod, obs.periodStart, obs.periodEnd),
    freshnessMatch: evaluateFreshness(input.freshness),
  };

  for (const dim of Object.values(dimensions)) {
    if (dim.level === "approximate") warnings.push(dim.reason);
  }

  if (!hasProvenance(obs)) {
    return {
      observation: obs,
      normalized,
      comparability: "unsupported",
      dimensions,
      decision: "EXCLUDED",
      exclusionReasonCode: "INSUFFICIENT_PROVENANCE",
      explanation: "EXCLUDED (INSUFFICIENT_PROVENANCE): citation/source fields required to trace this observation back to its publisher are missing or empty.",
      warnings,
    };
  }

  const comparability = combineDimensions(dimensions);

  if (request.minFreshness !== undefined) {
    const required = FRESHNESS_RANK[request.minFreshness];
    const actualRank = input.freshness !== undefined ? FRESHNESS_RANK[input.freshness] : FRESHNESS_RANK.historical;
    if (actualRank < required) {
      const code: CCExclusionReasonCode = input.freshness === "unavailable" ? "UNAVAILABLE" : "STALE";
      return {
        observation: obs,
        normalized,
        comparability: "unsupported",
        dimensions,
        decision: "EXCLUDED",
        exclusionReasonCode: code,
        explanation: `EXCLUDED (${code}): request requires minimum freshness "${request.minFreshness}"; observation freshness is "${input.freshness ?? "not assessed"}".`,
        warnings,
      };
    }
  }

  if (comparability === "unsupported") {
    const failing = EXCLUSION_PRIORITY.find(({ key }) => dimensions[key].level === "unsupported");
    const code: CCExclusionReasonCode = failing?.code ?? "OTHER";
    return {
      observation: obs,
      normalized,
      comparability,
      dimensions,
      decision: "EXCLUDED",
      exclusionReasonCode: code,
      explanation: buildExplanation("EXCLUDED", dimensions, comparability, code),
      warnings,
    };
  }

  return {
    observation: obs,
    normalized,
    comparability,
    dimensions,
    decision: "INCLUDED",
    explanation: buildExplanation("INCLUDED", dimensions, comparability),
    warnings,
  };
}

/**
 * Evaluate an entire candidate pool against one request. Never throws on an
 * empty pool or on zero comparable candidates — it returns an empty
 * `included`/`excluded` split, which pipeline.ts interprets as a DATA_GAP.
 * Result ordering exactly mirrors input pool ordering (Phase 2 objective 9:
 * candidate ordering never affects any individual verdict).
 */
export function evaluateComparability(
  request: ConstructionCostRequest,
  pool: readonly ConstructionCostCandidateInput[],
): ConstructionCostComparabilityResult {
  const candidates = pool.map((input) => evaluateCandidate(request, input));
  return {
    request,
    candidates,
    included: candidates.filter((c) => c.decision === "INCLUDED"),
    excluded: candidates.filter((c) => c.decision === "EXCLUDED"),
  };
}

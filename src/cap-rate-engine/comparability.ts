/**
 * InvestScape™ E69 Phase 2 — Cap-Rate Comparability Layer.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Given an `E69ComparabilityRequest` (the benchmark identity someone wants)
 * and a pool of E68 `CRECitedObservation`s, classifies every candidate
 * EXACT/CLOSE/APPROXIMATE/UNSUPPORTED, exposes the per-dimension reasoning,
 * and produces an explicit INCLUDED/EXCLUDED decision with a machine-readable
 * reason and a deterministic audit explanation.
 *
 * THIS FILE DOES NOT: compute consensus, average values, calculate a
 * transaction-derived cap rate, or produce scenarios. It answers exactly one
 * question per candidate: "does this observation legitimately inform the
 * requested benchmark, and how closely?" Those are separate, later phases
 * (see docs/E69-phase1-technical-specification.md Part 20, Phase 3+).
 *
 * DESIGN PRECEDENT REUSED FROM E68 (not reimplemented differently):
 * - The four-tier vocabulary (`exact|close|approximate|unsupported`) is
 *   `mapping.ts`'s `MappingConfidence`, unchanged.
 * - Dimensions combine by FLOOR, never by average, exactly as
 *   `qualification.ts`'s `qualifyCapRateObservation` combines its own axes —
 *   one disqualifying dimension cannot be papered over by several strong ones.
 * - "Only filter on a dimension the request actually specifies" is
 *   `benchmark-selection.ts`'s `matchesIdentity` principle, applied here to
 *   comparability instead of identity filtering.
 * - CBD-vs-urban is `approximate`, never `close` — the same judgment
 *   `mapping.ts`'s `mapToLegacyCapRateKey` already makes; this file does not
 *   invent a different answer for the same question.
 * - A pinned `capRateType` from a different `CAP_RATE_FAMILY` is never
 *   silently substituted — mirrors `consensus.ts`'s `assertComparableCapRates`
 *   hard guard.
 *
 * NOTHING under src/cre-intelligence/ is imported for its mutation surface;
 * every import below is a read-only type or pure function.
 */
import { CAP_RATE_FAMILY, type CREGeography } from "../cre-intelligence/types";
import type { CREPresentationFreshness } from "../cre-intelligence/ingestion/observation-lifecycle";
import type {
  E69CandidateInput,
  E69ComparabilityCandidate,
  E69ComparabilityDimensions,
  E69ComparabilityRequest,
  E69ComparabilityResult,
  E69DimensionResult,
  E69ExclusionReasonCode,
  E69MatchLevel,
} from "./comparability-types";

const RANK: Readonly<Record<E69MatchLevel, number>> = {
  unsupported: 0,
  approximate: 1,
  close: 2,
  exact: 3,
};

/** Freshest-to-oldest rank, matching `assessFreshness`'s actual band ordering
 *  (live_current > recent > stale > historical), with `unavailable` lowest
 *  because the SOURCE, not just the observation's age, is the problem. */
const FRESHNESS_RANK: Readonly<Record<CREPresentationFreshness, number>> = {
  live_current: 4,
  recent: 3,
  stale: 2,
  historical: 1,
  unavailable: 0,
};

function normalize(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function worseOf(a: E69MatchLevel, b: E69MatchLevel): E69MatchLevel {
  return RANK[a] <= RANK[b] ? a : b;
}

// ---------------------------------------------------------------------------
// Geography (country / region / metro / city / submarket)
// ---------------------------------------------------------------------------

function evaluateGeography(request: CREGeography, obs: CREGeography): E69DimensionResult {
  if (normalize(request.country) !== normalize(obs.country)) {
    return { level: "unsupported", reason: `Requested country "${request.country}" does not match observation country "${obs.country}".` };
  }

  // Submarket is the most specific axis the request can pin.
  if (request.submarket !== undefined) {
    if (normalize(obs.submarket) === normalize(request.submarket) && normalize(obs.submarket) !== "") {
      return { level: "exact", reason: `Exact submarket match: "${request.submarket}".` };
    }
    if (obs.submarket === undefined) {
      return {
        level: "approximate",
        reason: `Request specifies submarket "${request.submarket}"; observation states no submarket — a city-level observation does not automatically become an exact submarket match.`,
      };
    }
    return {
      level: "unsupported",
      reason: `Request specifies submarket "${request.submarket}"; observation is a different submarket "${obs.submarket}".`,
    };
  }

  if (request.city !== undefined) {
    if (normalize(obs.city) === normalize(request.city) && normalize(obs.city) !== "") {
      return { level: "exact", reason: `Exact city match: "${request.city}".` };
    }
    // Different (or absent) city: same metro is a disclosed narrowing, never exact.
    if (request.metro !== undefined && normalize(obs.metro) === normalize(request.metro) && normalize(obs.metro) !== "") {
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
    if (normalize(obs.metro) === normalize(request.metro) && normalize(obs.metro) !== "") {
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

  // Request specifies country only: country-level request, country matched above.
  return { level: "exact", reason: `Request specifies country only ("${request.country}"); country matches.` };
}

// ---------------------------------------------------------------------------
// Geography type (downtown/CBD/suburban/urban/source-defined)
// ---------------------------------------------------------------------------

function evaluateGeographyType(
  requested: E69ComparabilityRequest["locationType"],
  obsLocationType: string | undefined,
): E69DimensionResult {
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
      reason: `Request pins locationType "${requested}"; observation does not state a geography type — never assumed to match, disclosed as approximate.`,
    };
  }
  // "urban" is the documented approximate stand-in for "cbd" (mapping.ts precedent). Never "close".
  if ((requested === "cbd" && obs === "urban") || (requested === "urban" && obs === "cbd")) {
    return {
      level: "approximate",
      reason: `Observation states "${obs}", which overlaps but is not synonymous with requested "${requested}" (matches mapping.ts's existing urban/CBD precedent — approximate, never close).`,
    };
  }
  // Genuine opposite pairing (cbd vs suburban, either direction) or any other explicit mismatch.
  return {
    level: "unsupported",
    reason: `Request pins locationType "${requested}"; observation explicitly states the different type "${obs}".`,
  };
}

// ---------------------------------------------------------------------------
// Asset class (binary in E68 today — see mapToLegacyCapRateKey's default case)
// ---------------------------------------------------------------------------

function evaluateAssetClass(requested: string, obsAssetClass: string): E69DimensionResult {
  if (requested === obsAssetClass) {
    return { level: "exact", reason: `Asset class matches: "${requested}".` };
  }
  return {
    level: "unsupported",
    reason: `Requested asset class "${requested}" does not equal observation asset class "${obsAssetClass}" — asset class has no valid narrowing in E68 today; never folded into an unrelated category.`,
  };
}

// ---------------------------------------------------------------------------
// Property subtype (source-native string, e.g. "office_prime")
// ---------------------------------------------------------------------------

function evaluateSubtype(requested: string | undefined, obsSubtype: string | undefined): E69DimensionResult {
  if (requested === undefined) {
    return { level: "not_constrained", reason: "Request does not pin a property subtype." };
  }
  if (obsSubtype !== undefined && normalize(obsSubtype) === normalize(requested)) {
    return { level: "exact", reason: `Exact subtype match: "${requested}".` };
  }
  if (obsSubtype === undefined) {
    return {
      level: "approximate",
      reason: `Request pins subtype "${requested}"; observation states no subtype — plausible but undocumented similarity, never assumed exact.`,
    };
  }
  return {
    level: "unsupported",
    reason: `Request pins subtype "${requested}"; observation states a different subtype "${obsSubtype}". No documented subtype-family mapping exists in E68 today, so no narrower tier than unsupported is available.`,
  };
}

// ---------------------------------------------------------------------------
// Property class (A/B/C/unspecified)
// ---------------------------------------------------------------------------

function evaluatePropertyClass(requested: string | undefined, obsClass: string | undefined): E69DimensionResult {
  if (requested === undefined) {
    return { level: "not_constrained", reason: "Request does not pin a property class." };
  }
  const obs = obsClass ?? "unspecified";
  if (obs === requested) {
    return { level: "exact", reason: `Property class matches: "${requested}".` };
  }
  if (obs === "unspecified") {
    return {
      level: "approximate",
      reason: `Request pins class "${requested}"; observation carries no A/B/C grade — never assumed to be Class B or any other grade, disclosed as approximate.`,
    };
  }
  return {
    level: "unsupported",
    reason: `Request pins class "${requested}"; observation explicitly states class "${obs}" — an explicit different class is never treated as close (Class A is never close to Class C).`,
  };
}

// ---------------------------------------------------------------------------
// Effective period
// ---------------------------------------------------------------------------

function monthsBetween(a: number, b: number): number {
  return Math.abs(a - b) / (1000 * 60 * 60 * 24 * 30.44);
}

function evaluatePeriod(
  requested: E69ComparabilityRequest["effectivePeriod"],
  obsStart: string,
  obsEnd: string,
): E69DimensionResult {
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

  // Non-overlapping: measure how far the observation's period end sits before the requested period.
  const monthsPrior = (reqEnd - end) / (1000 * 60 * 60 * 24 * 30.44);
  if (monthsPrior <= 0) {
    // Observation's period is entirely AFTER the requested period — a future observation
    // relative to what was asked for. Treated the same as "too far" rather than assumed exact.
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

// ---------------------------------------------------------------------------
// Freshness (consumes E68's CREPresentationFreshness verbatim; never recomputed here)
// ---------------------------------------------------------------------------

function evaluateFreshness(freshness: CREPresentationFreshness | undefined): E69DimensionResult {
  if (freshness === undefined) {
    return {
      level: "approximate",
      reason: "Freshness was not assessed for this observation (no CREPresentationFreshness supplied) — never assumed current.",
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
        reason: "The backing source is currently unavailable; this observation cannot be confirmed current (the observation itself is not thereby invalidated — see freshness gating below).",
      };
  }
}

// ---------------------------------------------------------------------------
// Representation / methodology (CRECapRateType / CAP_RATE_FAMILY)
// ---------------------------------------------------------------------------

function evaluateRepresentation(
  requestedType: string | undefined,
  obsType: string | undefined,
): E69DimensionResult {
  if (requestedType === undefined) {
    return { level: "not_constrained", reason: "Request does not pin a cap-rate representation/methodology (capRateType)." };
  }
  if (obsType === undefined) {
    return {
      level: "unsupported",
      reason: `Request pins capRateType "${requestedType}"; observation states no capRateType, so compatibility cannot be confirmed and is never assumed.`,
    };
  }
  if (obsType === requestedType) {
    return { level: "exact", reason: `capRateType matches exactly: "${requestedType}".` };
  }
  const reqFamily = CAP_RATE_FAMILY[requestedType as keyof typeof CAP_RATE_FAMILY];
  const obsFamily = CAP_RATE_FAMILY[obsType as keyof typeof CAP_RATE_FAMILY];
  if (reqFamily === obsFamily) {
    return {
      level: "approximate",
      reason: `Observation capRateType "${obsType}" shares family "${obsFamily}" with requested "${requestedType}" but is not the same concept — the request pinned an exact type, so this is disclosed as approximate, never silently treated as identical (CAP_RATE_FAMILY concepts must never be averaged together).`,
    };
  }
  return {
    level: "unsupported",
    reason: `Observation capRateType "${obsType}" (family "${obsFamily}") is a different family than the requested "${requestedType}" (family "${reqFamily}") — never silently substituted for a pinned request (mirrors assertComparableCapRates).`,
  };
}

// ---------------------------------------------------------------------------
// Combine + decide + explain
// ---------------------------------------------------------------------------

function combineDimensions(dims: E69ComparabilityDimensions): E69MatchLevel {
  let overall: E69MatchLevel = "exact";
  for (const dim of Object.values(dims)) {
    if (dim.level === "not_constrained") continue;
    overall = worseOf(overall, dim.level);
  }
  return overall;
}

const EXCLUSION_PRIORITY: ReadonlyArray<{ key: keyof E69ComparabilityDimensions; code: E69ExclusionReasonCode }> = [
  { key: "assetMatch", code: "WRONG_ASSET_TYPE" },
  { key: "subtypeMatch", code: "WRONG_ASSET_SUBTYPE" },
  { key: "geographyMatch", code: "WRONG_GEOGRAPHY" },
  { key: "geographyTypeMatch", code: "WRONG_GEOGRAPHY_TYPE" },
  { key: "classMatch", code: "WRONG_PROPERTY_CLASS" },
  { key: "representationMatch", code: "INCOMPATIBLE_REPRESENTATION" },
  { key: "periodMatch", code: "STALE" },
  { key: "freshnessMatch", code: "UNAVAILABLE" },
];

function hasProvenance(obs: E69CandidateInput["observation"]): boolean {
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
  dims: E69ComparabilityDimensions,
  comparability: E69MatchLevel,
  exclusionReasonCode?: E69ExclusionReasonCode,
): string {
  const entries = Object.entries(dims) as Array<[keyof E69ComparabilityDimensions, E69DimensionResult]>;
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
 * same inputs every time.
 */
export function evaluateCandidate(
  request: E69ComparabilityRequest,
  input: E69CandidateInput,
): E69ComparabilityCandidate {
  const obs = input.observation;
  const warnings: string[] = [];

  const dimensions: E69ComparabilityDimensions = {
    geographyMatch: evaluateGeography(request.geography, obs.geography),
    geographyTypeMatch: evaluateGeographyType(request.locationType, obs.locationType),
    assetMatch: evaluateAssetClass(request.assetClass, obs.assetClass),
    subtypeMatch: evaluateSubtype(request.propertySubtype, obs.propertySubtype),
    classMatch: evaluatePropertyClass(request.propertyClass, obs.propertyClass),
    periodMatch: evaluatePeriod(request.effectivePeriod, obs.periodStart, obs.periodEnd),
    freshnessMatch: evaluateFreshness(input.freshness),
    representationMatch: evaluateRepresentation(request.capRateType, obs.capRateType),
  };

  for (const dim of Object.values(dimensions)) {
    if (dim.level === "approximate") warnings.push(dim.reason);
  }

  // Insufficient provenance is a hard exclusion regardless of dimension outcome —
  // an observation E69 cannot trace back to a source must never back a benchmark.
  if (!hasProvenance(obs)) {
    const dimsForExplain = dimensions;
    return {
      observation: obs,
      comparability: "unsupported",
      dimensions: dimsForExplain,
      decision: "EXCLUDED",
      exclusionReasonCode: "INSUFFICIENT_PROVENANCE",
      explanation: `EXCLUDED (INSUFFICIENT_PROVENANCE): citation/source fields required to trace this observation back to its publisher are missing or empty.`,
      warnings,
    };
  }

  const comparability = combineDimensions(dimensions);

  // Hard freshness gate: only applied when the REQUEST pins a minimum freshness tier.
  // Stale/historical data is never excluded merely for existing (Part 9 of the spec) —
  // it is excluded only when the request explicitly demands a fresher tier than exists.
  if (request.minFreshness !== undefined) {
    const required = FRESHNESS_RANK[request.minFreshness];
    const actualRank = input.freshness !== undefined ? FRESHNESS_RANK[input.freshness] : FRESHNESS_RANK.historical;
    if (actualRank < required) {
      const code: E69ExclusionReasonCode = input.freshness === "unavailable" ? "UNAVAILABLE" : "STALE";
      return {
        observation: obs,
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
    const code: E69ExclusionReasonCode = failing?.code ?? "UNSUPPORTED_MAPPING";
    return {
      observation: obs,
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
 * `included`/`excluded` split, which a future consensus/data-gap phase
 * interprets. This function performs no consensus, ranking beyond the split,
 * or value selection.
 */
export function evaluateComparability(
  request: E69ComparabilityRequest,
  pool: readonly E69CandidateInput[],
): E69ComparabilityResult {
  const candidates = pool.map((input) => evaluateCandidate(request, input));
  return {
    request,
    candidates,
    included: candidates.filter((c) => c.decision === "INCLUDED"),
    excluded: candidates.filter((c) => c.decision === "EXCLUDED"),
  };
}

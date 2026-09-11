/**
 * InvestScape™ E68 Phase 4C — cap-rate benchmark qualification.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Extends `mapping.ts`'s exact/close/approximate/unsupported framework from
 * "does this observation's classification translate into the legacy
 * vocabulary" to "is this specific observation actually fit to back an
 * application benchmark." Those are different questions. `mapToLegacyCapRateKey`
 * answers the first; `qualifyCapRateObservation` in this file answers the
 * second, using it as one input among several.
 *
 * NO NUMERICAL SCORE. Every check below returns one of the four existing
 * tiers, and the overall result is the WORST of them (rank-ordered:
 * unsupported < approximate < close < exact). A numeric average could let a
 * few strong dimensions paper over one disqualifying one; a floor cannot. An
 * observation that fails one axis outright (wrong asset class, wrong city,
 * wrong geography type) is `unsupported` regardless of how good the rest of
 * its provenance is — see `combine()`.
 *
 * WHY THIS FILE CANNOT ACCIDENTALLY RELABEL A DIMENSION
 * `mapToLegacyCapRateKey` reads the observation's OWN assetClass/locationType/
 * propertyClass and translates them; it never accepts a target to force-fit
 * against. There is structurally no code path here that could turn a Class A
 * observation into Class B data, or a CBD observation into suburban data —
 * the four "never" rules in the Phase 4C specification (never map between
 * asset classes on city match alone, never CBD-to-suburban, never Class A to
 * B/C, never multifamily to office/industrial/retail) hold because nothing in
 * this file ever substitutes a different dimension than the one the source
 * actually published. Tests in benchmark-qualification.test.ts prove this
 * with adversarial inputs, not just by inspection.
 */
import type { CRECitedObservation, CRECapRateType } from "./types";
import { CAP_RATE_FAMILY } from "./types";
import { mapToLegacyCapRateKey, type LegacyCapRateKey, type MappingConfidence } from "./mapping";

const CONFIDENCE_RANK: Readonly<Record<MappingConfidence, number>> = {
  unsupported: 0,
  approximate: 1,
  close: 2,
  exact: 3,
};

/** The worse (lower-ranked) of two confidence tiers. Never upgrades. */
function worseOf(a: MappingConfidence, b: MappingConfidence): MappingConfidence {
  return CONFIDENCE_RANK[a] <= CONFIDENCE_RANK[b] ? a : b;
}

export type MethodologyFamily = "survey" | "transaction" | "derived";
export type SourceQualityTier = "high" | "medium" | "low";
export type ValueShape = "point" | "range";

export interface ObservationQualification {
  /** Legacy key candidate; absent when overall confidence is unsupported. */
  legacyKey?: LegacyCapRateKey;
  /** The floor over every axis checked. This is what callers should use. */
  confidence: MappingConfidence;
  /** Confidence from classification translation alone (mapping.ts), before
   *  the period/caveat/methodology axes below are applied. Kept visible so a
   *  reader can see WHY the overall confidence is lower than the base one. */
  baseConfidence: MappingConfidence;
  rationale: string;
  /** Non-blocking flags a consumer should surface to a human, not silently drop. */
  warnings: string[];
  methodologyFamily: MethodologyFamily;
  valueShape: ValueShape;
  sourceQualityTier: SourceQualityTier;
}

/**
 * Currency axis. "CURRENT" sits deliberately last in E68's stated priority
 * order (REAL > TRACEABLE > GRANULAR > CURRENT > COMPLETE), so staleness never
 * disqualifies an observation outright — it can only pull it down to
 * `approximate`, never to `unsupported`.
 */
function periodConfidence(obs: CRECitedObservation, asOf: Date): { conf: MappingConfidence; warning?: string } {
  const end = new Date(obs.periodEnd);
  const months = (asOf.getTime() - end.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  if (months <= 12) return { conf: "exact" };
  if (months <= 24) {
    return {
      conf: "close",
      warning: `Period ends ${obs.periodEnd}, ${Math.round(months)} months before the qualification date — downgraded for currency.`,
    };
  }
  return {
    conf: "approximate",
    warning: `Period ends ${obs.periodEnd}, over 24 months before the qualification date — capped at approximate regardless of other dimensions.`,
  };
}

/**
 * Surfaces a documented, unresolved provenance caveat (e.g. the Newmark
 * Houston chart's internal date contradiction) as a mandatory cap, not a
 * silent footnote. Detected generically from the citation's own
 * `methodologyNote` rather than hardcoded per source, so a future observation
 * with a similar caveat is caught the same way.
 */
function caveatConfidence(obs: CRECitedObservation): { conf: MappingConfidence; warning?: string } {
  const note = obs.citation.methodologyNote ?? "";
  if (/discrepancy|contradiction|may be older than its label implies/i.test(note)) {
    return { conf: "approximate", warning: `Citation documents an unresolved caveat: "${note}"` };
  }
  return { conf: "exact" };
}

function sourceQualityTier(quality: number): SourceQualityTier {
  if (quality >= 90) return "high";
  if (quality >= 80) return "medium";
  return "low";
}

function methodologyFamily(capRateType: CRECapRateType | undefined): MethodologyFamily {
  return (capRateType ? CAP_RATE_FAMILY[capRateType] : "survey") as MethodologyFamily;
}

/**
 * Qualify a single real observation for use as an application cap-rate
 * benchmark. This is per-observation classification, not per-target matching
 * (matching a specific application request against the best available
 * observation is Phase 5 work, deferred deliberately — see docs).
 */
export function qualifyCapRateObservation(
  obs: CRECitedObservation,
  asOf: Date = new Date("2026-09-11"),
): ObservationQualification {
  const base = mapToLegacyCapRateKey({
    assetClass: obs.assetClass,
    locationType: obs.locationType,
    propertyClass: obs.propertyClass,
  });

  const warnings: string[] = [];
  let overall = base.confidence;

  const period = periodConfidence(obs, asOf);
  overall = worseOf(overall, period.conf);
  if (period.warning) warnings.push(period.warning);

  const caveat = caveatConfidence(obs);
  overall = worseOf(overall, caveat.conf);
  if (caveat.warning) warnings.push(caveat.warning);

  const family = methodologyFamily(obs.capRateType);
  if (family !== "transaction") {
    warnings.push(
      `Methodology is "${obs.capRateType}" (${family}), not a transaction-derived average — transaction evidence ranks highest in E68's source hierarchy (docs/e68-source-registry.md).`,
    );
  }

  if (obs.sourceQuality < 80) {
    warnings.push(`sourceQuality ${obs.sourceQuality} is below 80.`);
  }

  if (obs.propertyClass === "unspecified" && base.propertyClass !== undefined) {
    warnings.push("Observation carries no Class A/B/C split; the legacy key's class field will be 'unspecified' if surfaced.");
  }

  return {
    legacyKey: overall === "unsupported" ? undefined : base.key,
    confidence: overall,
    baseConfidence: base.confidence,
    rationale: base.rationale,
    warnings,
    methodologyFamily: family,
    valueShape: obs.value !== undefined ? "point" : "range",
    sourceQualityTier: sourceQualityTier(obs.sourceQuality),
  };
}

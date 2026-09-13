/**
 * InvestScape™ E85 Phase 3 — Zoning & Land-Use Rules Engine: qualification
 * model.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Exactly three independent, non-averaged axes (Phase 2 correction 3):
 * evidence quality, rule applicability, parcel match. No numeric
 * probability anywhere. Result status (result-types.ts) is a SEPARATE
 * concept — never folded into this model as a fourth axis, and the floor
 * helper below operates ONLY over the three axes, never over result
 * status, mirroring E70's `floorConfidence` philosophy
 * (src/construction-cost-engine/confidence.ts) but independently
 * reimplemented for E85's own tier scale — no import from
 * construction-cost-engine or cap-rate-engine (Phase 2 correction 14).
 */

export type E85QualificationTier = "very_low" | "low" | "moderate" | "high";

const TIER_RANK: Readonly<Record<E85QualificationTier, number>> = {
  very_low: 0,
  low: 1,
  moderate: 2,
  high: 3,
};

/** How trustworthy/fresh/authoritative the underlying evidence source is (independent of whether the rule it states actually applies to this parcel). */
export type E85EvidenceQualityTier = E85QualificationTier;

/** How well the resolved rule actually applies to the specific request (e.g. use category matched exactly vs. approximately; rule family fully vs. partially structured). Independent of source quality — a perfectly authoritative source can still be a poor applicability match. */
export type E85RuleApplicabilityTier = E85QualificationTier;

/** How confidently the parcel itself was matched to the zone/jurisdiction the rule is drawn from. Independent of both other axes — the source can be excellent and the rule perfectly applicable to the WRONG parcel if the match itself is weak. */
export type E85ParcelMatchTier = E85QualificationTier;

/**
 * The three independent axes, each settable without affecting the others.
 * Never averaged into a single number; never merged with result status.
 */
export interface E85Qualification {
  evidenceQuality: E85EvidenceQualityTier;
  ruleApplicability: E85RuleApplicabilityTier;
  parcelMatch: E85ParcelMatchTier;
}

/**
 * Floor/weakest-of combination over an arbitrary set of qualification
 * tiers: the LOWEST tier among the inputs wins. Never an average, never a
 * weighted score. Intended usage is `floorQualificationTiers(q.evidenceQuality, q.ruleApplicability, q.parcelMatch)`
 * or combining several `E85Qualification` values' same-named axis across
 * multiple evidence items — this helper never takes a result-status value
 * as input (Phase 2 correction 3: result status is not a fourth axis).
 */
export function floorQualificationTiers(...tiers: readonly E85QualificationTier[]): E85QualificationTier {
  let worst: E85QualificationTier = "high";
  for (const t of tiers) {
    if (TIER_RANK[t] < TIER_RANK[worst]) worst = t;
  }
  return worst;
}

/** Convenience floor over all three axes of one `E85Qualification` record. Documented as floor-only, per the module header. */
export function floorQualification(q: E85Qualification): E85QualificationTier {
  return floorQualificationTiers(q.evidenceQuality, q.ruleApplicability, q.parcelMatch);
}

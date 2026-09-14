/**
 * InvestScape™ E85 Phase 7 — Spatial Applicability: contracts.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Phase 7 answers exactly one question — "which regulatory instruments
 * spatially apply to this parcel?" — and hands the answer to Phase 6 as a list
 * of rule-pack identities.
 *
 *   parcel geometry + regulatory features (already acquired, elsewhere)
 *        ↓  resolveE85SpatialApplicability
 *   applicable rule-pack ids + hits + provenance + gaps
 *        ↓  composeE85RulePacks (Phase 6)
 *   effective rules
 *        ↓  evaluateZoningAndLandUse (Phase 4)
 *   regulatory result
 *
 * THE LINE THIS FILE DEFENDS: geometry determines WHICH instruments are in
 * play; it never determines WHICH ONE WINS. A site-specific polygon drawn on
 * top of a base zone is a fact about shapes. That the site-specific instrument
 * governs where they disagree is a fact about law, stated by an enabling
 * provision, and it lives in an `E85PrecedenceRelation` in Phase 6. So nothing
 * in Phase 7's output ranks, weights, orders by importance, or otherwise
 * encodes a winner — a spatial hit says "consider this instrument", full stop.
 *
 * For the same reason Phase 7 does NOT import Phase 6. The dependency runs one
 * way and is enforced by test: composition must remain usable with rule packs
 * that arrived from anywhere at all, and a spatial layer that could reach into
 * precedence would eventually be tempted to set it.
 */
import type { E85DataGap } from "./data-gap-types";
import type { E85ManualReviewRecord } from "./manual-review-types";
import type { E85TemporalWindow } from "./evidence-types";
import type { E85ParcelMatchTier } from "./qualification-types";
import type { E85Geometry, E85SpatialTolerance } from "./spatial-types";
import type { E85SpatialRelation } from "./geometry-relations";
import type { E85SpatialProvenance } from "./spatial-dataset-types";
import type { E85SpatialDatasetRegistry } from "./spatial-dataset-registry";
import type { E85SpatialFinding } from "./spatial-findings";

/**
 * What kind of regulatory layer a feature belongs to. DESCRIPTIVE ONLY — the
 * exact same discipline `E85CompositionRole` is held to in Phase 6, for the
 * exact same reason.
 *
 * This label is used for precisely one thing: deciding which features compete
 * for the SAME regulatory slot, so that two base zones over one parcel can be
 * recognised as an ambiguity. Note what that use does — it makes Phase 7 REFUSE
 * to choose. It never ranks the candidates, never prefers a class, and never
 * settles a disagreement. If this field ever starts deciding which instrument
 * governs, the layering has failed.
 */
export type E85SpatialFeatureClass = "BASE_ZONE" | "OVERLAY" | "SITE_SPECIFIC" | "HERITAGE" | "OTHER";

/**
 * One regulatory geometry that, where it covers a parcel, brings one or more
 * rule packs into consideration.
 *
 * Carries rule-pack IDENTITIES, never rule bodies. Phase 7 has no business
 * holding an FSR figure, and a feature that carried one would invite a spatial
 * layer to start answering regulatory questions.
 */
export interface E85RegulatorySpatialFeature {
  /** The publisher's identifier for this feature within its layer. */
  featureId: string;
  datasetId: string;
  /** Which registered release this feature was read from. Checked against the registry when one is supplied. */
  datasetVersionId: string;
  jurisdictionId: string;
  geometry: E85Geometry;
  /** The rule packs this feature activates, by `E85RulePack.packId`. Empty means the feature is spatially real but activates nothing E85 has normalized. */
  rulePackIds: readonly string[];
  /** DESCRIPTIVE ONLY. See `E85SpatialFeatureClass`. */
  featureClass: E85SpatialFeatureClass;
  provenance: E85SpatialProvenance;
  /** The temporal window the depicted boundary is understood to be in force for. Absent or UNKNOWN stays unknown — never filled from the dataset's publication date. */
  temporal?: E85TemporalWindow;
  /** Raw zone/instrument designation as the layer labels it, e.g. "TB-1". Preserved verbatim. */
  zoneDesignation?: string;
}

/**
 * The parcel side of the comparison.
 *
 * A LOCAL input contract, mirroring `E85ParcelReference`'s deliberate modesty:
 * E85 consumes parcel spatial evidence and does not become the platform's
 * parcel registry. `parcelReferenceId` is the caller's identifier, not an
 * InvestScape-wide canonical one.
 */
export interface E85ParcelSpatialReference {
  parcelReferenceId: string;
  /** The parcel's geometry. A polygon where a lot boundary is known; a point where only a pin or centroid is. Absent is an honest gap, never an assumed shape. */
  geometry?: E85Geometry;
  /** Where the parcel geometry came from, when the caller can say. */
  provenance?: E85SpatialProvenance;
  /** The parcel's own identifier in a parcel-fabric dataset, when it came from one. */
  featureId?: string;
}

/**
 * Whether a spatially-related feature is treated as applicable.
 *
 * Separate from `E85SpatialRelation` on purpose: the relation is what the
 * geometry says, this is what the applicability policy concluded from it. Two
 * jurisdictions could reasonably treat a boundary touch differently, and
 * collapsing the two fields would make that disagreement invisible.
 */
export type E85SpatialApplicability =
  /** The feature's rule packs should be considered for this parcel. */
  | "APPLIES"
  /** The feature shares no point with this parcel. Reached from DISJOINT alone — the one relation whose legal consequence geometry really does settle, since a feature that never reaches a parcel cannot regulate it under any jurisdiction's rule. */
  | "DOES_NOT_APPLY"
  /** Geometry alone cannot settle it, and a person must decide. Carries a manual-review record. Reached from a partial overlap, from competing exclusive layers, and from boundary contact. */
  | "MANUAL_REVIEW_REQUIRED"
  /** The comparison could not be performed at all — CRS mismatch, invalid geometry, unregistered release. Carries a data gap. */
  | "UNDETERMINED";

/** One feature compared against the parcel, with the geometric finding and the applicability conclusion kept distinct. */
export interface E85SpatialHit {
  featureId: string;
  datasetId: string;
  datasetVersionId: string;
  /** DESCRIPTIVE ONLY — carried so a caller can scope an ambiguity to a layer, never so it can rank one. */
  featureClass: E85SpatialFeatureClass;
  /** What the geometry says. */
  relation: E85SpatialRelation;
  /** What the applicability policy concluded. */
  applicability: E85SpatialApplicability;
  /** Rule packs this feature would bring in, preserved even when applicability is ambiguous so a later materiality decision can scope it. */
  rulePackIds: readonly string[];
  zoneDesignation?: string;
  spatialProvenance: E85SpatialProvenance;
  temporal: E85TemporalWindow;
  /** Specific, non-boilerplate statement of why this conclusion followed from this relation. */
  detail: string;
}

/**
 * Overall outcome, aligned with E85's existing result vocabulary rather than a
 * parallel one.
 */
export type E85SpatialApplicabilityStatus =
  /** Applicability was settled from geometry with nothing outstanding. */
  | "RESOLVED"
  /** Settled, but with caveats a reviewer should see (an unknown legal effective date, a licensing limitation, an unverified dataset release). */
  | "RESOLVED_WITH_WARNINGS"
  /** Evidence exists but geometry cannot settle it — a split parcel, competing base zones, or a feature meeting the parcel only at its boundary. */
  | "MANUAL_REVIEW_REQUIRED"
  /** Required spatial evidence was missing or unusable. */
  | "DATA_GAP";

export interface E85SpatialApplicabilityResult {
  status: E85SpatialApplicabilityStatus;
  parcelReferenceId: string;
  jurisdictionId?: string;
  /** Every feature considered, sorted canonically. Includes non-applicable ones, so "we checked and it did not reach" is on the record rather than inferred from an absence. */
  hits: readonly E85SpatialHit[];
  /** Pack ids from hits that APPLY, sorted and deduplicated. This is the handoff to Phase 6. */
  applicableRulePackIds: readonly string[];
  /** Pack ids from hits needing review. Deliberately NOT merged into `applicableRulePackIds`: composing them would silently resolve the ambiguity Phase 7 just refused to resolve. */
  ambiguousRulePackIds: readonly string[];
  manualReview: readonly E85ManualReviewRecord[];
  dataGaps: readonly E85DataGap[];
  findings: readonly E85SpatialFinding[];
  /** Dataset ids actually consulted, sorted. */
  datasetsConsulted: readonly string[];
  /**
   * The Phase 3 qualification axis Phase 7 is finally in a position to answer.
   * Phase 5 refused it (no parcel in hand) and Phase 6 refused it (composition
   * is parcel-independent); here there is a parcel and a boundary, so a tier is
   * derived from what the geometry actually showed rather than assumed.
   */
  parcelMatch: E85ParcelMatchTier;
  /** ISO 8601 timestamp, taken from the caller or the newest observation on the evidence — never a clock read, so a result is reproducible. */
  resolvedAt: string;
}

export interface E85SpatialApplicabilityRequest {
  parcel: E85ParcelSpatialReference;
  /** The regulatory features to compare against. An empty list is meaningfully different from a list that matched nothing — see the no-dataset gap in spatial-applicability.ts. */
  features: readonly E85RegulatorySpatialFeature[];
  /** Optional registry. When supplied, each feature's release must be registered; when omitted, releases are taken on trust and that fact is recorded. */
  registry?: E85SpatialDatasetRegistry;
  tolerance?: E85SpatialTolerance;
  /** Caller-supplied timestamp for reproducibility. Omitted, one is derived deterministically from the evidence. */
  resolvedAt?: string;
  /**
   * Which feature classes compete for the same regulatory slot, so that two of
   * them over one parcel is an ambiguity rather than a coexistence. Defaults to
   * base zoning alone, which is how jurisdictions generally publish it.
   *
   * Explicit and overridable rather than hardcoded, because a jurisdiction that
   * partitions differently deserves to say so — and because a setting a caller
   * can read is a setting a caller can audit.
   */
  mutuallyExclusiveClasses?: readonly E85SpatialFeatureClass[];
}

/** Base zoning is the one class assumed mutually exclusive by default: jurisdictions publish it as a partition, and overlays are drawn expressly to sit on top of it. */
export const E85_DEFAULT_MUTUALLY_EXCLUSIVE_CLASSES: readonly E85SpatialFeatureClass[] = ["BASE_ZONE"];

/** Hits whose applicability needs a person, with their layer and pack identity intact for scoping. */
export function e85AmbiguousHits(result: E85SpatialApplicabilityResult): readonly E85SpatialHit[] {
  return result.hits.filter((h) => h.applicability === "MANUAL_REVIEW_REQUIRED");
}

/**
 * Whether anything about this result should stop a caller treating spatial
 * applicability as settled.
 */
export function hasBlockingSpatialFinding(result: E85SpatialApplicabilityResult): boolean {
  return result.status === "MANUAL_REVIEW_REQUIRED" || result.status === "DATA_GAP";
}

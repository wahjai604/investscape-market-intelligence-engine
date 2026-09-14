/**
 * InvestScape™ E85 Phase 7 — Spatial Applicability: findings.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Every applicability decision is reported, the uneventful ones included —
 * the same discipline Phase 5's normalization findings and Phase 6's
 * composition findings follow. A layer that spoke only on failure would leave a
 * reviewer unable to distinguish "the overlay was checked and does not reach
 * this parcel" from "the overlay was never supplied", which are different
 * enough to change what a person does next.
 *
 * These codes describe WHAT THE SPATIAL LAYER DID. Where the consequence is a
 * missing or contested answer, the finding carries a real Phase 3 record — an
 * `E85DataGap` or an `E85ManualReviewRecord` — rather than a fourth parallel
 * vocabulary.
 */
import type { E85DataGap } from "./data-gap-types";
import type { E85ManualReviewRecord } from "./manual-review-types";
import type { E85SpatialFeatureClass } from "./spatial-applicability-types";

export type E85SpatialFindingCode =
  /** A feature covers the parcel and its rule packs were brought into consideration. The ordinary case. */
  | "FEATURE_APPLIES"
  /** The parcel extends beyond one feature into another — the split-parcel case. No centroid, area-majority or first-hit shortcut is taken. */
  | "PARTIAL_OVERLAP"
  /**
   * The parcel and the feature make contact but share no area. Carries a
   * manual-review record: geometry establishes the contact and can go no
   * further, because whether contact activates an instrument is a rule of the
   * jurisdiction rather than a property of the shapes.
   */
  | "BOUNDARY_TOUCH_ONLY"
  /** No mutually-exclusive feature contains the parcel, but one or more touch it. Distinguishes "we cannot say which zone, or whether any" from "we proved none reaches it". */
  | "BASE_ZONE_BOUNDARY_ONLY"
  /** Two or more mutually-exclusive base-zone features reach one parcel. Carries a manual-review record; no zone is chosen. */
  | "MULTIPLE_BASE_ZONES"
  /** An overlay and a base zone both reach the parcel. Recorded as the normal arrangement it is — explicitly NOT a conflict, and never a reason to suppress either. */
  | "OVERLAY_COEXISTS"
  /** The same feature of the same release of the same dataset was supplied more than once and counted once. */
  | "DUPLICATE_FEATURE_COLLAPSED"
  /** Two INDEPENDENT datasets depict a boundary reaching this parcel. Both provenance chains are kept; agreement between publishers is recorded, never scored as extra authority. */
  | "INDEPENDENT_DATASET_AGREEMENT"
  /** The parcel and a feature declare different coordinate reference systems. No comparison is attempted and no transform is performed. */
  | "CRS_MISMATCH"
  /** A supplied geometry is structurally invalid and was excluded rather than repaired. */
  | "GEOMETRY_INVALID"
  /** No parcel geometry was supplied, so nothing could be compared. Never substituted with a point, an origin, or a jurisdiction-wide assumption. */
  | "PARCEL_GEOMETRY_MISSING"
  /** No regulatory features were supplied at all. Distinct from "features were supplied and none matched". */
  | "NO_SPATIAL_EVIDENCE_SUPPLIED"
  /** Base-zone features WERE supplied and none reaches the parcel — a statement about the world, not about E85's coverage. */
  | "NO_BASE_ZONE_MATCH"
  /** A feature cites a dataset release the registry does not contain. The feature is excluded rather than compared against a different release. */
  | "DATASET_VERSION_UNREGISTERED"
  /** No registry was supplied, so feature releases were taken on trust. Recorded so the absence of verification is visible rather than silent. */
  | "DATASET_VERSION_UNVERIFIED"
  /** A feature's legal effective date is not established. Its dataset's publication date is NOT used as a substitute. */
  | "TEMPORAL_APPLICABILITY_UNKNOWN"
  /** A consulted dataset carries an access/licensing limitation. Reported only — rights never suppress a geometric fact. */
  | "DATASET_LICENSE_LIMITATION";

/**
 * How the finding affects the result.
 *  INFO          — applicability proceeded; recorded for audit.
 *  WARNING       — proceeded with a caveat a reviewer should see.
 *  GAP           — required spatial evidence was missing or unusable; `gap` is populated.
 *  MANUAL_REVIEW — evidence exists but geometry cannot settle it; `manualReview` is populated.
 */
export type E85SpatialSeverity = "INFO" | "WARNING" | "GAP" | "MANUAL_REVIEW";

export interface E85SpatialFinding {
  code: E85SpatialFindingCode;
  severity: E85SpatialSeverity;
  /** Feature ids involved, sorted. */
  featureIds?: readonly string[];
  /** Dataset ids involved, sorted. */
  datasetIds?: readonly string[];
  /** Layer classes involved, sorted — carried so an ambiguity can be scoped to the layer it affects without re-deriving it from the hits. */
  featureClasses?: readonly E85SpatialFeatureClass[];
  /** Rule packs the finding concerns, sorted. Retained on ambiguities so a later materiality decision knows what was affected. */
  rulePackIds?: readonly string[];
  /** Specific, non-boilerplate explanation. */
  message: string;
  /** Populated when and only when `severity` is "GAP". */
  gap?: E85DataGap;
  /** Populated when and only when `severity` is "MANUAL_REVIEW". */
  manualReview?: E85ManualReviewRecord;
}

/** Whether any finding would stop a caller treating spatial applicability as settled. */
export function hasBlockingSpatialFindingCode(findings: readonly E85SpatialFinding[]): boolean {
  return findings.some((f) => f.severity === "GAP" || f.severity === "MANUAL_REVIEW");
}

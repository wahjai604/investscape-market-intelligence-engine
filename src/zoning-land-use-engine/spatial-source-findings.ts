/**
 * InvestScape™ E85 Phase 8 — Spatial Source Adapter: normalization findings.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Every raw record is accounted for. A record either becomes a normalized
 * feature or produces a finding saying why it did not — an adapter that quietly
 * drops what it does not understand is the specific failure this taxonomy
 * exists to prevent, and it is the failure that matters most with municipal
 * data, where a layer of 40,000 polygons makes a silently missing handful
 * invisible.
 *
 * These codes say WHAT HAPPENED DURING SPATIAL NORMALIZATION. They do not
 * duplicate the Phase 3 taxonomies: where a finding also means "a required
 * answer is missing", it carries a real `E85DataGap` with an existing
 * `E85DataGapReasonCode`, and where it means "a person must judge this", it
 * carries a real `E85ManualReviewRecord`. This mirrors exactly what Phase 5's
 * `E85NormalizationFindingCode` does for documents and Phase 7's
 * `E85SpatialFindingCode` does for applicability — three layers, three
 * vocabularies for their own work, one shared vocabulary for consequences.
 */
import type { E85DataGap } from "./data-gap-types";
import type { E85ManualReviewRecord } from "./manual-review-types";

export type E85SpatialSourceFindingCode =
  // ---- Snapshot-level: facts about the whole payload.
  /** The snapshot names a dataset the spatial registry does not contain. Nothing in the payload is normalized. */
  | "DATASET_UNREGISTERED"
  /** The snapshot's release is not a registered release of its dataset. Never adapted as a neighbouring release. */
  | "DATASET_VERSION_MISMATCH"
  /** The snapshot's jurisdiction contradicts the registered dataset's. Reported, never reconciled by preferring either. */
  | "JURISDICTION_MISMATCH"
  /** The source declared no coordinate reference system. No CRS is inferred, so no feature can be given one. */
  | "CRS_UNDECLARED"
  /** The snapshot's declared CRS contradicts the registered dataset's. Neither is preferred and no transform is performed. */
  | "CRS_CONTRADICTS_REGISTRY"
  /** No registered adapter handles this snapshot, or more than one does. */
  | "NO_ADAPTER_AVAILABLE"

  // ---- Feature-level: facts about one record.
  /** A raw record became a normalized feature. The ordinary case, recorded so success is auditable rather than merely implied. */
  | "FEATURE_NORMALIZED"
  /** A raw record could not safely become a feature and was withheld with its identity and reasons intact. */
  | "FEATURE_QUARANTINED"
  /** A raw record carries no authoritative feature identifier. A record index is not a substitute. */
  | "FEATURE_ID_MISSING"
  /** The raw attributes name a feature class this adapter has no exact mapping for. Never fuzzy-matched onto BASE_ZONE or OVERLAY. */
  | "UNKNOWN_FEATURE_CLASS"
  /** The raw geometry is in a shape this adapter cannot read, or is absent. Distinct from geometry that was read and found malformed. */
  | "UNSUPPORTED_RAW_GEOMETRY"
  /** Geometry was read successfully and then REFUSED by Phase 7's topology gate. No repair was attempted. */
  | "GEOMETRY_FAILED_PHASE7_VALIDATION"
  /** The source's own zone/instrument code has no explicit rule-pack mapping. The feature's location is known; what governs it is not. */
  | "RULE_PACK_LINK_UNRESOLVED"
  /** The same authoritative record appeared more than once, identically, and was normalized once. A repeated read is never corroboration. */
  | "DUPLICATE_RAW_FEATURE_COLLAPSED"
  /** Two records claim one authoritative feature id but differ materially. Neither is chosen; both are withheld. */
  | "CONFLICTING_FEATURE_ID";

/**
 * How the finding affects the result.
 *  INFO          — normalization proceeded; recorded for audit.
 *  WARNING       — proceeded with a caveat a reviewer should see.
 *  GAP           — a required answer could not be produced; `gap` is populated.
 *  MANUAL_REVIEW — evidence exists but cannot be settled here; `manualReview` is populated.
 */
export type E85SpatialSourceSeverity = "INFO" | "WARNING" | "GAP" | "MANUAL_REVIEW";

export interface E85SpatialSourceFinding {
  code: E85SpatialSourceFindingCode;
  severity: E85SpatialSourceSeverity;
  /** The authoritative feature id this finding concerns, when one is known. Absent on snapshot-level findings and on records that had none. */
  featureId?: string;
  /** Compact reference to the raw record — `snapshotId#index`. A locator, never an identity. */
  rawRecordRef?: string;
  /** The source's own value that led here (a zone code, a layer label), echoed so a reviewer sees what the adapter was looking at. */
  sourceValue?: string;
  /** Specific, non-boilerplate explanation. */
  message: string;
  /** Populated when and only when `severity` is "GAP". */
  gap?: E85DataGap;
  /** Populated when and only when `severity` is "MANUAL_REVIEW". */
  manualReview?: E85ManualReviewRecord;
}

/** Whether anything would stop a caller treating this normalization as complete. */
export function hasBlockingSpatialSourceFinding(findings: readonly E85SpatialSourceFinding[]): boolean {
  return findings.some((f) => f.severity === "GAP" || f.severity === "MANUAL_REVIEW");
}

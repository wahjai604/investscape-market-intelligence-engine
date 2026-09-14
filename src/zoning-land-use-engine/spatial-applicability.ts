/**
 * InvestScape™ E85 Phase 7 — Spatial Applicability: resolution.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Takes a parcel geometry and a set of already-acquired regulatory features and
 * answers which rule packs are in play. It acquires nothing, decides no legal
 * precedence, and evaluates no rule.
 *
 * FOUR SHORTCUTS ARE REFUSED HERE, EACH OF WHICH IS A COMMON WAY TO GET A
 * CONFIDENTLY WRONG ANSWER:
 *
 *   the centroid shortcut — a parcel spanning two zones is not "in" whichever
 *       zone its middle happens to land in; half a lot does not stop being
 *       regulated because of where the average of its corners falls.
 *   the area-majority shortcut — the larger share does not absorb the smaller.
 *       A 90/10 split is still a split parcel, and which rules govern the 10%
 *       is a question for a planner.
 *   the first-hit shortcut — returning whichever polygon iterated first makes
 *       the answer depend on array order, which is not a property of the land.
 *   the touching-counts shortcut — abutting a zone boundary is not being inside
 *       the zone, and a zero-area contact never silently brings a zone's rules
 *       in. Note that the OPPOSITE shortcut is refused just as firmly: a touch
 *       is not read as definitive non-applicability either. Geometry can
 *       establish that two boundaries meet and nothing more; whether that
 *       contact activates an instrument is a rule of the jurisdiction, and a
 *       generic spatial layer that answered it would be inventing local law.
 *       The geometry is certain, the legal consequence is not, and the result
 *       says exactly that.
 *
 * When geometry genuinely cannot settle applicability, the honest output is an
 * ambiguity carrying every candidate and its provenance — not a choice.
 *
 * Ordinary spatial uncertainty is returned, never thrown: a mismatched CRS, a
 * malformed ring, a parcel straddling a line and a missing layer are all normal
 * conditions of municipal data.
 */
import type { E85DataGap } from "./data-gap-types";
import type { E85ManualReviewRecord } from "./manual-review-types";
import type { E85TemporalWindow } from "./evidence-types";
import type { E85ParcelMatchTier } from "./qualification-types";
import type { E85Geometry } from "./spatial-types";
import type { E85SpatialRelation } from "./geometry-relations";
import type { E85SpatialFinding } from "./spatial-findings";
import type {
  E85ParcelSpatialReference,
  E85RegulatorySpatialFeature,
  E85SpatialApplicability,
  E85SpatialApplicabilityRequest,
  E85SpatialApplicabilityResult,
  E85SpatialApplicabilityStatus,
  E85SpatialFeatureClass,
  E85SpatialHit,
} from "./spatial-applicability-types";
import { E85_DEFAULT_MUTUALLY_EXCLUSIVE_CLASSES } from "./spatial-applicability-types";
import { e85CrsMatches } from "./spatial-types";
import { e85GeometryRelation, e85RelationHasSharedArea } from "./geometry-relations";
import { formatE85GeometryProblems, validateE85Geometry } from "./geometry-validation";
import { e85SpatialFeatureIdentityKey } from "./spatial-dataset-types";

/** Deterministic fallback when neither the caller nor the evidence supplies a timestamp. Never a clock read — a spatial result must be reproducible. */
const EPOCH = "1970-01-01T00:00:00.000Z";

function byString(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort(byString);
}

/** Canonical feature order, independent of the order the caller supplied. */
function featureOrder(a: E85SpatialHit, b: E85SpatialHit): number {
  return byString(a.datasetId, b.datasetId) || byString(a.featureId, b.featureId) || byString(a.datasetVersionId, b.datasetVersionId);
}

const UNKNOWN_TEMPORAL: E85TemporalWindow = { effectiveDateBasis: "UNKNOWN" };

/**
 * Maps a geometric relation to an applicability conclusion.
 *
 * Stated as one explicit function rather than scattered through the walk, so
 * the entire legal policy of Phase 7 is four lines a reviewer can read at once
 * and disagree with in one place.
 */
function applicabilityFor(relation: E85SpatialRelation): E85SpatialApplicability {
  switch (relation) {
    case "CONTAINS":
      return "APPLIES";
    // Positive overlap without containment means the parcel extends past this
    // feature into something else. Which rules govern which part of a lot is a
    // planning judgment, so the packs are retained and flagged, never applied
    // wholesale and never dropped.
    case "INTERSECTS":
      return "MANUAL_REVIEW_REQUIRED";
    // Contact without shared area. The geometry is CERTAIN — these boundaries
    // meet — and the legal consequence is not: some jurisdictions activate an
    // instrument on abutment, others require containment, and the generic
    // foundation has no authoritative policy to read either from. Treating it
    // as definitive non-applicability would embed one of those answers in a
    // layer whose whole purpose is to work anywhere, so the packs are withheld
    // for a person rather than discarded on E85's own authority.
    case "BOUNDARY_TOUCH":
      return "MANUAL_REVIEW_REQUIRED";
    // No shared point at all. This one IS settled by geometry: a feature that
    // does not reach the parcel cannot regulate it under any rule.
    case "DISJOINT":
      return "DOES_NOT_APPLY";
    default:
      return "UNDETERMINED";
  }
}

function detailFor(relation: E85SpatialRelation, featureId: string): string {
  switch (relation) {
    case "CONTAINS":
      return `Feature "${featureId}" fully covers the parcel, so its rule packs are brought into consideration.`;
    case "INTERSECTS":
      return `The parcel extends beyond feature "${featureId}", so the feature governs only part of it. No value is chosen for the parcel as a whole: neither the larger share nor the centroid decides this.`;
    case "BOUNDARY_TOUCH":
      return (
        `The parcel and feature "${featureId}" make contact along a boundary or at a vertex but share no area. Abutting a boundary is not being inside it, so the rule packs are NOT applied. ` +
        `They are not dismissed either: whether boundary contact activates this instrument is a question of the jurisdiction's rule, which geometry cannot answer and this layer does not assume.`
      );
    case "DISJOINT":
      return `Feature "${featureId}" does not reach the parcel.`;
    default:
      return `The relationship between the parcel and feature "${featureId}" could not be computed, which is not the same as their being apart.`;
  }
}

/** The newest observation timestamp on the supplied evidence, so `resolvedAt` is derived from data rather than from a clock. */
function deriveResolvedAt(request: E85SpatialApplicabilityRequest): string {
  const stamps = [request.parcel.provenance?.observedAt, ...request.features.map((f) => f.provenance.observedAt)].filter((t): t is string => t !== undefined).sort(byString);
  return request.resolvedAt ?? stamps[stamps.length - 1] ?? EPOCH;
}

function gapResult(
  request: E85SpatialApplicabilityRequest,
  resolvedAt: string,
  finding: E85SpatialFinding,
): E85SpatialApplicabilityResult {
  return {
    status: "DATA_GAP",
    parcelReferenceId: request.parcel.parcelReferenceId,
    jurisdictionId: request.features[0]?.jurisdictionId,
    hits: [],
    applicableRulePackIds: [],
    ambiguousRulePackIds: [],
    manualReview: [],
    dataGaps: finding.gap ? [finding.gap] : [],
    findings: [finding],
    datasetsConsulted: sortedUnique(request.features.map((f) => f.datasetId)),
    parcelMatch: "very_low",
    resolvedAt,
  };
}

/**
 * Resolves which regulatory features — and therefore which rule packs — apply
 * to a parcel.
 */
export function resolveE85SpatialApplicability(request: E85SpatialApplicabilityRequest): E85SpatialApplicabilityResult {
  const resolvedAt = deriveResolvedAt(request);
  const findings: E85SpatialFinding[] = [];
  const exclusiveClasses = request.mutuallyExclusiveClasses ?? E85_DEFAULT_MUTUALLY_EXCLUSIVE_CLASSES;
  const datasetsConsulted = sortedUnique(request.features.map((f) => f.datasetId));

  // ---- Parcel geometry must exist and be usable before anything is compared.
  const parcelGeometry: E85Geometry | undefined = request.parcel.geometry;
  if (parcelGeometry === undefined) {
    return gapResult(request, resolvedAt, {
      code: "PARCEL_GEOMETRY_MISSING",
      severity: "GAP",
      message: `No geometry was supplied for parcel "${request.parcel.parcelReferenceId}", so no spatial comparison was attempted.`,
      gap: {
        reasonCode: "GEOMETRY_UNAVAILABLE",
        reason: `Parcel "${request.parcel.parcelReferenceId}" was supplied without geometry. No substitute was used: not a point, not an origin, and not an assumption that every feature in the jurisdiction applies.`,
        sourcesChecked: datasetsConsulted,
        checkedAt: resolvedAt,
        resolutionHint: "Supply the parcel's boundary polygon, or a point location if that is all that is known.",
      },
    });
  }

  const parcelValidation = validateE85Geometry(parcelGeometry);
  if (!parcelValidation.valid) {
    return gapResult(request, resolvedAt, {
      code: "GEOMETRY_INVALID",
      severity: "GAP",
      message: `Parcel "${request.parcel.parcelReferenceId}" has structurally invalid geometry and was not compared against any feature.`,
      gap: {
        reasonCode: "GEOMETRY_UNAVAILABLE",
        reason: `Parcel geometry failed structural validation and was excluded rather than repaired: ${formatE85GeometryProblems(parcelValidation.problems)}`,
        sourcesChecked: datasetsConsulted,
        checkedAt: resolvedAt,
        resolutionHint: "Correct the parcel geometry at its source. E85 does not repair rings, close gaps, or drop ordinates on a publisher's behalf.",
      },
    });
  }

  if (request.features.length === 0) {
    return gapResult(request, resolvedAt, {
      code: "NO_SPATIAL_EVIDENCE_SUPPLIED",
      severity: "GAP",
      message: "No regulatory spatial features were supplied, so applicability could not be determined either way.",
      gap: {
        reasonCode: "GEOMETRY_UNAVAILABLE",
        reason:
          "No regulatory geometry was supplied for this parcel. This records an absence of evidence and is deliberately NOT reported as an absence of zoning — nothing here establishes that the parcel is unzoned.",
        sourcesChecked: [],
        checkedAt: resolvedAt,
        resolutionHint: "Supply the authoritative zoning layer features covering this parcel's area.",
      },
    });
  }

  // ---- Deduplicate identical features, then walk in canonical order.
  const seen = new Set<string>();
  const unique: E85RegulatorySpatialFeature[] = [];
  const collapsed: string[] = [];
  for (const feature of request.features) {
    const key = e85SpatialFeatureIdentityKey(feature.provenance);
    if (seen.has(key)) {
      collapsed.push(feature.featureId);
      continue;
    }
    seen.add(key);
    unique.push(feature);
  }
  if (collapsed.length > 0) {
    findings.push({
      code: "DUPLICATE_FEATURE_COLLAPSED",
      severity: "INFO",
      featureIds: sortedUnique(collapsed),
      message: `The same feature of the same dataset release was supplied more than once and counted once. Supplying a layer twice does not make its boundary more authoritative.`,
    });
  }

  const hits: E85SpatialHit[] = [];
  const dataGaps: E85DataGap[] = [];

  for (const feature of unique) {
    const base = {
      featureId: feature.featureId,
      datasetId: feature.datasetId,
      datasetVersionId: feature.datasetVersionId,
      featureClass: feature.featureClass,
      rulePackIds: sortedUnique(feature.rulePackIds),
      zoneDesignation: feature.zoneDesignation,
      spatialProvenance: feature.provenance,
      temporal: feature.temporal ?? UNKNOWN_TEMPORAL,
    };

    // Registered release, when a registry is available to check against.
    if (request.registry !== undefined && request.registry.findVersion(feature.datasetId, feature.datasetVersionId) === undefined) {
      const gap: E85DataGap = {
        reasonCode: "GEOMETRY_UNAVAILABLE",
        reason: `Feature "${feature.featureId}" cites release "${feature.datasetVersionId}" of dataset "${feature.datasetId}", which is not registered. The feature was excluded rather than compared as though it came from a different release — a boundary redrawn between releases is a different boundary.`,
        sourcesChecked: [feature.datasetId],
        checkedAt: resolvedAt,
        resolutionHint: `Register release "${feature.datasetVersionId}" of "${feature.datasetId}", or supply features from a registered release.`,
      };
      dataGaps.push(gap);
      findings.push({
        code: "DATASET_VERSION_UNREGISTERED",
        severity: "GAP",
        featureIds: [feature.featureId],
        datasetIds: [feature.datasetId],
        featureClasses: [feature.featureClass],
        rulePackIds: base.rulePackIds,
        message: `Release "${feature.datasetVersionId}" of dataset "${feature.datasetId}" is not registered; feature "${feature.featureId}" was excluded. Newer-version-wins is not applied, and no other release was substituted.`,
        gap,
      });
      hits.push({ ...base, relation: "UNDETERMINED", applicability: "UNDETERMINED", detail: `Release "${feature.datasetVersionId}" of "${feature.datasetId}" is not registered.` });
      continue;
    }

    const featureValidation = validateE85Geometry(feature.geometry);
    if (!featureValidation.valid) {
      const gap: E85DataGap = {
        reasonCode: "GEOMETRY_UNAVAILABLE",
        reason: `Feature "${feature.featureId}" of dataset "${feature.datasetId}" has structurally invalid geometry and was excluded rather than repaired: ${formatE85GeometryProblems(featureValidation.problems)}`,
        sourcesChecked: [feature.datasetId],
        checkedAt: resolvedAt,
        resolutionHint: "Correct the feature geometry at its publisher. E85 does not repair authoritative regulatory geometry.",
      };
      dataGaps.push(gap);
      findings.push({
        code: "GEOMETRY_INVALID",
        severity: "GAP",
        featureIds: [feature.featureId],
        datasetIds: [feature.datasetId],
        featureClasses: [feature.featureClass],
        rulePackIds: base.rulePackIds,
        message: `Feature "${feature.featureId}" has invalid geometry and was excluded from applicability.`,
        gap,
      });
      hits.push({ ...base, relation: "UNDETERMINED", applicability: "UNDETERMINED", detail: `Feature geometry is structurally invalid.` });
      continue;
    }

    // CRS must match EXACTLY. No transform, no aliasing, no assumption.
    if (!e85CrsMatches(parcelGeometry.crs, feature.geometry.crs)) {
      const gap: E85DataGap = {
        reasonCode: "SPATIAL_REFERENCE_MISMATCH",
        reason:
          `Parcel geometry is declared in "${parcelGeometry.crs?.crsId}" and feature "${feature.featureId}" of dataset "${feature.datasetId}" in "${feature.geometry.crs?.crsId}". ` +
          `No transform between them has been performed, so no comparison was attempted. The coordinates are present and readable; what is absent is any basis for treating them as the same space.`,
        sourcesChecked: [feature.datasetId],
        checkedAt: resolvedAt,
        resolutionHint: "Reproject one geometry into the other's coordinate reference system upstream, then resupply. E85 performs no coordinate conversion.",
      };
      dataGaps.push(gap);
      findings.push({
        code: "CRS_MISMATCH",
        severity: "GAP",
        featureIds: [feature.featureId],
        datasetIds: [feature.datasetId],
        featureClasses: [feature.featureClass],
        rulePackIds: base.rulePackIds,
        message: `Coordinate reference systems differ ("${parcelGeometry.crs?.crsId}" vs "${feature.geometry.crs?.crsId}"); the comparison was refused rather than assumed.`,
        gap,
      });
      hits.push({ ...base, relation: "UNDETERMINED", applicability: "UNDETERMINED", detail: `CRS mismatch: "${parcelGeometry.crs?.crsId}" vs "${feature.geometry.crs?.crsId}".` });
      continue;
    }

    const relation = e85GeometryRelation(feature.geometry, parcelGeometry, request.tolerance);
    hits.push({ ...base, relation, applicability: applicabilityFor(relation), detail: detailFor(relation, feature.featureId) });
  }

  // ---- Mutually-exclusive layers: two base zones over one parcel is an
  //      ambiguity, and Phase 7 refuses to pick rather than preferring either.
  const isExclusive = (featureClass: E85SpatialFeatureClass): boolean => exclusiveClasses.includes(featureClass);
  const exclusiveWithArea = hits.filter((h) => isExclusive(h.featureClass) && e85RelationHasSharedArea(h.relation));
  const contested = exclusiveWithArea.length > 1;

  // Sorted HERE rather than only on the way out: every finding and review
  // record below is generated by walking this array, so sorting at the end
  // would leave those collections carrying the caller's supply order.
  const resolvedHits: E85SpatialHit[] = hits
    .map((hit) => {
      if (!contested || !isExclusive(hit.featureClass) || !e85RelationHasSharedArea(hit.relation)) return hit;
      return {
        ...hit,
        applicability: "MANUAL_REVIEW_REQUIRED" as const,
        detail:
          `${hit.detail} ${exclusiveWithArea.length} mutually-exclusive features of this class reach the parcel and no one of them is chosen: ` +
          `not by area, not by centroid, not by supply order, and not by which layer was named first.`,
      };
    })
    .sort(featureOrder);

  const manualReview: E85ManualReviewRecord[] = [];

  if (contested) {
    const ids = sortedUnique(exclusiveWithArea.map((h) => h.featureId));
    const record: E85ManualReviewRecord = {
      reasonCode: "AMBIGUOUS_PARCEL_ZONE_MATCH",
      explanation:
        `The parcel is reached by ${exclusiveWithArea.length} mutually-exclusive features (${ids.join(", ")}) across dataset(s) ` +
        `${sortedUnique(exclusiveWithArea.map((h) => h.datasetId)).join(", ")}. Every candidate is retained with its own provenance; geometry alone cannot say which governs the parcel, or which governs which part of it.`,
      evidenceConsidered: sortedUnique(exclusiveWithArea.map((h) => h.datasetId)),
      flaggedAt: resolvedAt,
    };
    manualReview.push(record);
    findings.push({
      code: "MULTIPLE_BASE_ZONES",
      severity: "MANUAL_REVIEW",
      featureIds: ids,
      datasetIds: sortedUnique(exclusiveWithArea.map((h) => h.datasetId)),
      featureClasses: sortedUnique(exclusiveWithArea.map((h) => h.featureClass)) as readonly E85SpatialFeatureClass[],
      rulePackIds: sortedUnique(exclusiveWithArea.flatMap((h) => h.rulePackIds)),
      message: record.explanation,
      manualReview: record,
    });
  }

  // Partial overlap is its own finding even when only one exclusive feature is
  // involved: a parcel half-covered by a single overlay is still split.
  for (const hit of resolvedHits) {
    if (hit.relation !== "INTERSECTS") continue;
    const record: E85ManualReviewRecord = {
      reasonCode: "AMBIGUOUS_PARCEL_ZONE_MATCH",
      explanation: `Feature "${hit.featureId}" of dataset "${hit.datasetId}" covers part of the parcel but not all of it. Which rules govern which portion of the site is a planning judgment, not a geometric one.`,
      evidenceConsidered: [hit.datasetId],
      flaggedAt: resolvedAt,
    };
    manualReview.push(record);
    findings.push({
      code: "PARTIAL_OVERLAP",
      severity: "MANUAL_REVIEW",
      featureIds: [hit.featureId],
      datasetIds: [hit.datasetId],
      featureClasses: [hit.featureClass],
      rulePackIds: hit.rulePackIds,
      message: record.explanation,
      manualReview: record,
    });
  }

  // Boundary contact is retained, never resolved. The pack does not enter
  // `applicableRulePackIds` as though the instrument were established, and it
  // does not vanish as though the instrument were ruled out — it travels through
  // the ambiguity path with its feature identity, relation, provenance and
  // release intact, so whoever decides later can see exactly what was withheld
  // and why.
  for (const hit of resolvedHits) {
    if (hit.relation !== "BOUNDARY_TOUCH") continue;
    const record: E85ManualReviewRecord = {
      reasonCode: "AMBIGUOUS_PARCEL_ZONE_MATCH",
      explanation:
        `The parcel touches feature "${hit.featureId}" of dataset "${hit.datasetId}" along a boundary or at a vertex but shares no area with it. ` +
        `The contact itself is certain; what it means is not. Whether abutting this instrument's boundary brings it into force is a rule of the jurisdiction, ` +
        `not a property of the shapes, so the feature is neither applied nor dismissed here.`,
      evidenceConsidered: [hit.datasetId],
      flaggedAt: resolvedAt,
    };
    manualReview.push(record);
    findings.push({
      code: "BOUNDARY_TOUCH_ONLY",
      severity: "MANUAL_REVIEW",
      featureIds: [hit.featureId],
      datasetIds: [hit.datasetId],
      featureClasses: [hit.featureClass],
      rulePackIds: hit.rulePackIds,
      message: record.explanation,
      manualReview: record,
    });
  }

  const applyingHits = resolvedHits.filter((h) => h.applicability === "APPLIES");
  const ambiguousHits = resolvedHits.filter((h) => h.applicability === "MANUAL_REVIEW_REQUIRED");

  // ---- An overlay and a base zone reaching one parcel is the normal
  //      arrangement, not a conflict. Said out loud so nothing downstream
  //      mistakes coexistence for contention.
  const applyingExclusive = applyingHits.filter((h) => isExclusive(h.featureClass));
  const applyingNonExclusive = applyingHits.filter((h) => !isExclusive(h.featureClass));
  if (applyingExclusive.length > 0 && applyingNonExclusive.length > 0) {
    findings.push({
      code: "OVERLAY_COEXISTS",
      severity: "INFO",
      featureIds: sortedUnique(applyingHits.map((h) => h.featureId)),
      datasetIds: sortedUnique(applyingHits.map((h) => h.datasetId)),
      featureClasses: sortedUnique(applyingHits.map((h) => h.featureClass)) as readonly E85SpatialFeatureClass[],
      rulePackIds: sortedUnique(applyingHits.flatMap((h) => h.rulePackIds)),
      message:
        `${applyingNonExclusive.length} non-exclusive feature(s) apply alongside ${applyingExclusive.length} base feature(s). ` +
        `Overlapping layers are how overlays work and neither suppresses the other here; whether and how their rules interact is decided downstream from explicitly-stated precedence, never from geometry.`,
    });
  }

  // Independent publishers depicting the same applicability: keep both chains.
  const applyingDatasets = sortedUnique(applyingHits.map((h) => h.datasetId));
  if (applyingHits.length > 1 && applyingDatasets.length > 1) {
    findings.push({
      code: "INDEPENDENT_DATASET_AGREEMENT",
      severity: "INFO",
      featureIds: sortedUnique(applyingHits.map((h) => h.featureId)),
      datasetIds: applyingDatasets,
      rulePackIds: sortedUnique(applyingHits.flatMap((h) => h.rulePackIds)),
      message: `Features from ${applyingDatasets.length} independent datasets apply to this parcel. Both provenance chains are retained; agreement between publishers is recorded, never counted as extra authority.`,
    });
  }

  // ---- No base zone: distinguish "proved not to match" from "never supplied".
  const exclusiveFeatures = resolvedHits.filter((h) => isExclusive(h.featureClass));
  const exclusiveCompared = exclusiveFeatures.filter((h) => h.relation !== "UNDETERMINED");
  const exclusiveTouching = exclusiveCompared.filter((h) => h.relation === "BOUNDARY_TOUCH");

  if (exclusiveWithArea.length === 0) {
    if (exclusiveFeatures.length === 0) {
      const gap: E85DataGap = {
        reasonCode: "GEOMETRY_UNAVAILABLE",
        reason:
          `No features of a mutually-exclusive class (${exclusiveClasses.join(", ")}) were supplied, so whether the parcel has a base zoning designation was never tested. ` +
          `This records an absence of evidence, NOT a finding that the parcel is unzoned.`,
        sourcesChecked: datasetsConsulted,
        checkedAt: resolvedAt,
        resolutionHint: "Supply the authoritative base zoning layer for this jurisdiction.",
      };
      dataGaps.push(gap);
      findings.push({
        code: "NO_SPATIAL_EVIDENCE_SUPPLIED",
        severity: "GAP",
        datasetIds: datasetsConsulted,
        message: gap.reason,
        gap,
      });
    } else if (exclusiveCompared.length === 0) {
      // Every base-zone feature was excluded before comparison, so nothing was
      // proved about the parcel either way. Its gaps are already recorded.
    } else if (exclusiveTouching.length > 0) {
      // The parcel sits exactly on a boundary and inside nothing. Reporting
      // "no zoning found" would be a stronger claim than the geometry supports,
      // so ZONING_NOT_FOUND is deliberately withheld here. Each touching feature
      // already carries its own review record from the boundary pass above; this
      // one states the separate consequence — that the parcel came away with no
      // base-zone determination at all.
      const record: E85ManualReviewRecord = {
        reasonCode: "AMBIGUOUS_PARCEL_ZONE_MATCH",
        explanation:
          `No mutually-exclusive feature contains the parcel, but ${exclusiveTouching.length} touch(es) it along a boundary or vertex ` +
          `(${sortedUnique(exclusiveTouching.map((h) => h.featureId)).join(", ")}). Whether that contact reflects survey precision or a genuine gap in coverage cannot be settled from geometry, ` +
          `so no base zone is asserted and no absence of zoning is claimed either.`,
        evidenceConsidered: sortedUnique(exclusiveTouching.map((h) => h.datasetId)),
        flaggedAt: resolvedAt,
      };
      manualReview.push(record);
      findings.push({
        code: "BASE_ZONE_BOUNDARY_ONLY",
        severity: "MANUAL_REVIEW",
        featureIds: sortedUnique(exclusiveTouching.map((h) => h.featureId)),
        datasetIds: sortedUnique(exclusiveTouching.map((h) => h.datasetId)),
        featureClasses: sortedUnique(exclusiveTouching.map((h) => h.featureClass)) as readonly E85SpatialFeatureClass[],
        rulePackIds: sortedUnique(exclusiveTouching.flatMap((h) => h.rulePackIds)),
        message: record.explanation,
        manualReview: record,
      });
    } else {
      const gap: E85DataGap = {
        reasonCode: "ZONING_NOT_FOUND",
        reason:
          `${exclusiveCompared.length} mutually-exclusive feature(s) were supplied and compared, and none reaches the parcel. ` +
          `This is a statement about the supplied layer's coverage of this location, established by comparison rather than assumed from an absence of data.`,
        sourcesChecked: sortedUnique(exclusiveCompared.map((h) => h.datasetId)),
        checkedAt: resolvedAt,
        resolutionHint: "Confirm the parcel geometry and the layer's extent; a parcel outside the supplied layer's coverage area is not the same as an unzoned parcel.",
      };
      dataGaps.push(gap);
      findings.push({
        code: "NO_BASE_ZONE_MATCH",
        severity: "GAP",
        featureIds: sortedUnique(exclusiveCompared.map((h) => h.featureId)),
        datasetIds: sortedUnique(exclusiveCompared.map((h) => h.datasetId)),
        message: gap.reason,
        gap,
      });
    }
  }

  // ---- Temporal and rights caveats: reported, never acted upon.
  const temporallyUnknown = resolvedHits.filter((h) => h.applicability === "APPLIES" && h.temporal.effectiveDateBasis === "UNKNOWN");
  if (temporallyUnknown.length > 0) {
    findings.push({
      code: "TEMPORAL_APPLICABILITY_UNKNOWN",
      severity: "WARNING",
      featureIds: sortedUnique(temporallyUnknown.map((h) => h.featureId)),
      datasetIds: sortedUnique(temporallyUnknown.map((h) => h.datasetId)),
      rulePackIds: sortedUnique(temporallyUnknown.flatMap((h) => h.rulePackIds)),
      message:
        `${temporallyUnknown.length} applying feature(s) have no established legal effective date. The dataset's publication or observation date is NOT used as a substitute: ` +
        `when a layer was drawn says nothing about when the boundary it depicts took effect.`,
    });
  }

  if (request.registry === undefined) {
    findings.push({
      code: "DATASET_VERSION_UNVERIFIED",
      severity: "WARNING",
      datasetIds: datasetsConsulted,
      message: "No spatial dataset registry was supplied, so each feature's cited dataset release was taken on trust rather than verified as registered.",
    });
  } else {
    const limited = request.registry
      .datasets()
      .filter((d) => datasetsConsulted.includes(d.datasetId))
      .filter((d) => d.licenseStatus !== "PUBLIC_REUSE" || d.accessStatus !== "AVAILABLE");
    if (limited.length > 0) {
      findings.push({
        code: "DATASET_LICENSE_LIMITATION",
        severity: "WARNING",
        datasetIds: sortedUnique(limited.map((d) => d.datasetId)),
        message:
          `${limited.length} consulted dataset(s) carry an access or redistribution limitation (${limited.map((d) => `${d.datasetId}: ${d.accessStatus}/${d.licenseStatus}`).join("; ")}). ` +
          `Reported only: rights govern what may be republished, never where a boundary lies, and no feature's applicability was changed by this.`,
      });
    }
  }

  // ---- Qualification: the parcelMatch axis Phase 5 and Phase 6 both declined.
  const parcelMatch = deriveParcelMatchTier({ applyingExclusive, ambiguousHits, dataGaps, parcelGeometry });

  const applicableRulePackIds = sortedUnique(applyingHits.flatMap((h) => h.rulePackIds));
  const ambiguousRulePackIds = sortedUnique(ambiguousHits.flatMap((h) => h.rulePackIds));

  const status: E85SpatialApplicabilityStatus =
    applicableRulePackIds.length === 0 && ambiguousRulePackIds.length === 0 && dataGaps.length > 0
      ? "DATA_GAP"
      : ambiguousHits.length > 0 || manualReview.length > 0
        ? "MANUAL_REVIEW_REQUIRED"
        : findings.some((f) => f.severity === "WARNING" || f.severity === "GAP")
          ? "RESOLVED_WITH_WARNINGS"
          : "RESOLVED";

  return {
    status,
    parcelReferenceId: request.parcel.parcelReferenceId,
    jurisdictionId: unique[0]?.jurisdictionId,
    hits: resolvedHits,
    applicableRulePackIds,
    ambiguousRulePackIds,
    manualReview: [...manualReview].sort((a, b) => byString(a.reasonCode, b.reasonCode) || byString(a.explanation, b.explanation)),
    dataGaps: [...dataGaps].sort((a, b) => byString(a.reasonCode, b.reasonCode) || byString(a.reason, b.reason)),
    findings: [...findings].sort((a, b) => byString(a.code, b.code) || byString(a.message, b.message)),
    datasetsConsulted,
    parcelMatch,
    resolvedAt,
  };
}

/**
 * Derives the `parcelMatch` qualification axis from what the geometry actually
 * showed.
 *
 * A point parcel caps at "moderate" however cleanly it lands: a pin inside a
 * polygon says the pin is inside, not that the LOT is. Treating an address
 * point as equivalent to a surveyed boundary is how a corner site ends up
 * confidently assigned to one of the two zones it straddles.
 */
function deriveParcelMatchTier(input: {
  applyingExclusive: readonly E85SpatialHit[];
  ambiguousHits: readonly E85SpatialHit[];
  dataGaps: readonly E85DataGap[];
  parcelGeometry: E85Geometry;
}): E85ParcelMatchTier {
  // Ambiguity is weighed BEFORE the absence of a match: a parcel straddling two
  // zones was matched to both, which is a weak match, not the absence of one.
  // Collapsing it into "very_low" would make a split parcel indistinguishable
  // from a parcel that no supplied layer reaches at all.
  if (input.applyingExclusive.length === 0) return input.ambiguousHits.length > 0 ? "low" : "very_low";
  if (input.applyingExclusive.length > 1) return "low";
  if (input.parcelGeometry.type === "POINT") return "moderate";
  // Exactly one mutually-exclusive feature covers the parcel, and that
  // containment is settled. An open question about some OTHER feature — an
  // overlay meeting the lot line, a layer that could not be compared — is a real
  // caveat and caps the tier, but it does not unsettle what was proven. Letting
  // it collapse the tier to "low" would rate a parcel squarely inside one zone
  // the same as a parcel straddling two, which is the distinction this axis
  // exists to carry.
  return input.ambiguousHits.length > 0 || input.dataGaps.length > 0 ? "moderate" : "high";
}

/**
 * The rule packs a caller may safely hand to Phase 6.
 *
 * Ambiguous packs are deliberately excluded: composing them would resolve, by
 * the side effect of passing them along, exactly the question Phase 7 declined
 * to answer. A caller who wants them must take them from
 * `ambiguousRulePackIds` knowingly.
 */
export function e85ApplicableRulePackIds(result: E85SpatialApplicabilityResult): readonly string[] {
  return result.applicableRulePackIds;
}

/** Every hit that brought in a given rule pack, for tracing a pack back to the exact feature that activated it. */
export function traceE85RulePackToFeatures(result: E85SpatialApplicabilityResult, rulePackId: string): readonly E85SpatialHit[] {
  return result.hits.filter((h) => h.rulePackIds.includes(rulePackId));
}

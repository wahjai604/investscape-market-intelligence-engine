/**
 * InvestScape™ E85 Phase 5 — Source Adapter & Registry Foundation: multi-axis
 * source readiness.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Phase 3 established three registry-level axes (access, licence, adapter) and
 * one derived tier (`computeE85AnalyticalReadiness`). Phase 5 keeps all four
 * unchanged and ADDS the four axes that only become answerable once a specific
 * structured extract is in hand:
 *
 *   structure  — the document exists and is readable, but is the SECTION we
 *                need actually structured into facts? A by-law is always
 *                "available" and routinely not machine-normalizable; those are
 *                different facts and collapsing them is exactly the failure
 *                this file exists to prevent.
 *   version    — is THIS consolidation registered, or are we being handed an
 *                extract from a consolidation nobody has verified?
 *   zone scope — does this source actually govern the zone being asked about?
 *   temporal   — was it in force on the as-of date? (reuses Phase 4's
 *                `E85TemporalApplicability` rather than inventing a parallel
 *                enum.)
 *
 * No axis is averaged against another and none is compressed into a boolean.
 * The overall tier is floor-like in the same sense as `floorQualificationTiers`
 * (qualification-types.ts): READY requires every axis to be clear, and any
 * single blocker is sufficient to withhold it. `blockers` lists every reason
 * found, not just the first, because a source blocked on both licence and
 * adapter needs two pieces of work, not one.
 */
import type { E85TemporalApplicability } from "./applicability";
import type { E85SourceAccessStatus, E85SourceLicenseStatus, E85SourceAdapterReadiness, E85SourceAnalyticalReadiness } from "./source-readiness-types";
import { computeE85AnalyticalReadiness } from "./source-readiness-types";
import type { E85SourceDefinition } from "./source-registry-types";
import { findE85SourceVersion } from "./source-registry-types";

/** Whether the specific content needed has been structured into facts, distinct from whether the document is reachable. */
export type E85SourceStructureSupport =
  /** The needed content is structured and normalizable. */
  | "STRUCTURED"
  /** The document's form is not one E85 can structure at all (e.g. scanned imagery, GIS-only). */
  | "UNSUPPORTED_STRUCTURE"
  /** The document is structurable in general, but the specific section needed was not structured in this extract. */
  | "SECTION_NOT_STRUCTURED"
  /** Not yet established. */
  | "UNDETERMINED";

/** Whether the consolidation in hand is one the registry knows. */
export type E85SourceVersionSupport = "REGISTERED" | "UNREGISTERED_VERSION" | "VERSION_UNKNOWN";

/** Whether the source governs the zone being asked about. */
export type E85SourceZoneScope = "IN_SCOPE" | "OUT_OF_SCOPE" | "NOT_ZONE_SCOPED";

export type E85SourceReadinessBlocker = "NOT_REGISTERED" | "ACCESS" | "LICENSE" | "ADAPTER" | "STRUCTURE" | "VERSION" | "ZONE_SCOPE" | "TEMPORAL";

/** Overall tier. Deliberately two-valued: a partially-ready source is not usable, and a middle tier would invite callers to treat it as if it were. Everything explaining WHY lives in `blockers` and the individual axes. */
export type E85SourceOverallReadiness = "READY" | "BLOCKED";

export interface E85SourceReadinessAssessment {
  sourceId: string;
  /** Whether the source was found in the registry at all. */
  registered: boolean;
  /** The publishing authority, carried here so a readiness answer is self-describing without a second registry lookup. */
  publisher?: string;
  accessStatus?: E85SourceAccessStatus;
  licenseStatus?: E85SourceLicenseStatus;
  adapterReadiness?: E85SourceAdapterReadiness;
  /** Phase 3's three-axis derived tier, unchanged and recomputed here rather than stored, so it can never drift from the axes that justify it. */
  analyticalReadiness?: E85SourceAnalyticalReadiness;
  structureSupport: E85SourceStructureSupport;
  versionSupport: E85SourceVersionSupport;
  zoneScope: E85SourceZoneScope;
  temporalApplicability: E85TemporalApplicability;
  overall: E85SourceOverallReadiness;
  blockers: readonly E85SourceReadinessBlocker[];
  /** One human-readable sentence per blocker, in the same order. */
  blockerDetails: readonly string[];
}

export interface E85SourceReadinessInput {
  /** The registered source, or undefined when the id resolved to nothing. */
  source: E85SourceDefinition | undefined;
  sourceId: string;
  /** Consolidation the structured extract claims to come from. */
  versionId?: string;
  /** Zone the caller is asking about. Omit when the question is not zone-specific. */
  zoneDesignation?: string;
  /** Established by the extract, not guessed: did the extract actually structure what was needed? */
  structureSupport?: E85SourceStructureSupport;
  /** Result of Phase 4's temporal check for the as-of date, when a temporal question is in play. */
  temporalApplicability?: E85TemporalApplicability;
}

/**
 * Pure derivation. Never mutates its input, never consults anything outside
 * the record handed to it, and returns the same assessment for the same input.
 */
export function assessE85SourceReadiness(input: E85SourceReadinessInput): E85SourceReadinessAssessment {
  const { source, sourceId, versionId, zoneDesignation } = input;
  const blockers: E85SourceReadinessBlocker[] = [];
  const blockerDetails: string[] = [];

  const block = (b: E85SourceReadinessBlocker, detail: string): void => {
    blockers.push(b);
    blockerDetails.push(detail);
  };

  if (!source) {
    block("NOT_REGISTERED", `Source "${sourceId}" is not present in the E85 source registry, so nothing is known about its access, licence, structure, or adapter.`);
    return {
      sourceId,
      registered: false,
      structureSupport: "UNDETERMINED",
      versionSupport: "VERSION_UNKNOWN",
      zoneScope: "NOT_ZONE_SCOPED",
      temporalApplicability: input.temporalApplicability ?? "UNDETERMINED",
      overall: "BLOCKED",
      blockers,
      blockerDetails,
    };
  }

  const analyticalReadiness = computeE85AnalyticalReadiness(source);
  if (source.accessStatus !== "AVAILABLE") {
    block("ACCESS", `Source "${sourceId}" has access status ${source.accessStatus}; E85 cannot treat its content as retrievable.`);
  }
  if (source.licenseStatus !== "PUBLIC_REUSE" && source.licenseStatus !== "INTERNAL_LICENSE_REQUIRED") {
    block("LICENSE", `Source "${sourceId}" has licence status ${source.licenseStatus}; its content is not cleared for this use.`);
  }
  if (source.adapterReadiness !== "BUILT_VERIFIED") {
    block("ADAPTER", `Source "${sourceId}" has adapter readiness ${source.adapterReadiness}; no verified adapter exists to normalize it.`);
  }

  const structureSupport = input.structureSupport ?? "UNDETERMINED";
  if (structureSupport !== "STRUCTURED") {
    block(
      "STRUCTURE",
      structureSupport === "SECTION_NOT_STRUCTURED"
        ? `The section of "${sourceId}" needed for this request was not structured by the supplied extract.`
        : structureSupport === "UNSUPPORTED_STRUCTURE"
          ? `The form of "${sourceId}" is not one E85 can structure into facts.`
          : `Whether "${sourceId}" is structured for this request has not been established.`,
    );
  }

  let versionSupport: E85SourceVersionSupport;
  if (versionId === undefined) {
    versionSupport = "VERSION_UNKNOWN";
    block("VERSION", `No consolidation/version was stated for "${sourceId}", so which text was read cannot be established.`);
  } else if (findE85SourceVersion(source, versionId)) {
    versionSupport = "REGISTERED";
  } else {
    versionSupport = "UNREGISTERED_VERSION";
    block(
      "VERSION",
      `Version "${versionId}" of "${sourceId}" is not registered (registered: ${source.versions.map((v) => v.versionId).join(", ") || "none"}); it is not adapted as though it were a known consolidation.`,
    );
  }

  let zoneScope: E85SourceZoneScope;
  const scoped = source.supportedZoneDesignations;
  if (zoneDesignation === undefined || scoped === undefined) {
    zoneScope = "NOT_ZONE_SCOPED";
  } else if (scoped.includes(zoneDesignation)) {
    zoneScope = "IN_SCOPE";
  } else {
    zoneScope = "OUT_OF_SCOPE";
    block("ZONE_SCOPE", `Source "${sourceId}" does not cover zone "${zoneDesignation}" (covers: ${scoped.join(", ") || "none"}).`);
  }

  const temporalApplicability = input.temporalApplicability ?? "UNDETERMINED";
  if (input.temporalApplicability !== undefined && temporalApplicability !== "APPLIES") {
    block("TEMPORAL", `Source "${sourceId}" is ${temporalApplicability} for the requested as-of date.`);
  }

  return {
    sourceId,
    registered: true,
    publisher: source.publisher,
    accessStatus: source.accessStatus,
    licenseStatus: source.licenseStatus,
    adapterReadiness: source.adapterReadiness,
    analyticalReadiness,
    structureSupport,
    versionSupport,
    zoneScope,
    temporalApplicability,
    overall: blockers.length === 0 ? "READY" : "BLOCKED",
    blockers,
    blockerDetails,
  };
}

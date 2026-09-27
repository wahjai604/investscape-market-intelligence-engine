/**
 * InvestScape™ E85 — narrow public entry point and API-safe contract.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * TRUST BOUNDARY. A public caller may say WHERE (a parcel id or a point), WHAT
 * (use, analyses, proposal facts), WHEN (an explicit as-of date) and what it
 * ASSERTS about the site (site area and its basis, affirmed conditions). It
 * may never supply the legal or spatial evidence itself: rule packs, policy,
 * the designation, spatial normalization, dataset registry, precedence,
 * temporal lineage, tolerances and timestamps all come from the server
 * (`E85PublicServerInputs`), built from its own pinned sources. The request
 * parser rejects any of those names outright rather than ignoring them, so a
 * client cannot believe it influenced them.
 *
 * WHAT THE RESPONSE PROMISES. The engine's status is passed through verbatim.
 * MACHINE_RESOLVED means the engine could resolve the requested fields from
 * the evidence it holds; it is never relabelled "verified", and a result that
 * depends on a caller assertion says so on the field. Practical capacity is
 * reported NOT_ASSESSED. Temporal findings (including the blanket
 * TEMPORAL_ANALYSIS_NOT_YET_APPLIED disclosure while no real source-version
 * lineage exists) are carried through, never dropped. The decision trace
 * stays server-side: `evaluateE85PublicRequest` returns it separately from the
 * response DTO for logging only.
 *
 * This module does not load or pin any source. Producing a trustworthy
 * `E85PublicServerInputs` is the server's job; see the API route's blocker notes.
 */
import type { E85RuleFamily } from "./zoning-land-use-engine/rule-family-types";
import type { E85Evidence, E85TemporalWindow } from "./zoning-land-use-engine/evidence-types";
import type { E85DataGap } from "./zoning-land-use-engine/data-gap-types";
import type { E85SiteAreaBasis, E85SiteAreaDeductionStatus, E85SiteAreaKind } from "./zoning-land-use-engine/jurisdiction-types";
import type { E85DecisionPackage, E85DecisionRequest, E85DecisionMateriality, E85DecisionBlockerKind } from "./zoning-land-use-engine/decision-package-types";
import type { E85OverallStatus } from "./zoning-land-use-engine/result-status";
import type { E85PracticalCapacityAssessment, E85RegulatoryEnvelopeResult } from "./zoning-land-use-engine/envelope-types";
import type { E85ApplicabilityDimension } from "./zoning-land-use-engine/rule-applicability-types";
import { assembleE85DecisionPackage } from "./zoning-land-use-engine/decision-orchestrator";

export const E85_PUBLIC_CONTRACT_VERSION = "e85-public-1";

const RULE_FAMILIES: readonly E85RuleFamily[] = ["USE", "DENSITY", "DIMENSIONAL", "PARKING", "AMENITY", "OVERLAY", "REQUIREMENT"];
const SITE_AREA_KINDS: readonly E85SiteAreaKind[] = ["BYLAW_DEFINED_SITE_AREA", "GROSS_TITLE_AREA", "NET_AFTER_DEDICATIONS", "UNSPECIFIED"];
const DEDUCTION_STATUSES: readonly E85SiteAreaDeductionStatus[] = ["NONE_APPLICABLE_CONFIRMED", "ALREADY_REFLECTED", "POSSIBLE_OR_PENDING", "UNKNOWN"];
const POINT_CRS = ["EPSG:26910"] as const;

/**
 * Names a caller must never supply: legal/spatial evidence and server-side
 * controls. Matched case-sensitively at the request's top level and inside
 * `parcel`. Listed so the rejection names the reason instead of a generic
 * "unknown field".
 */
export const E85_PUBLIC_SERVER_CONTROLLED_FIELDS: readonly string[] = [
  "availableRulePacks",
  "rulePacks",
  "packs",
  "policyVersion",
  "policy",
  "zoneDesignation",
  "designation",
  "rawZoningDesignation",
  "jurisdictionId",
  "jurisdiction",
  "normalization",
  "spatialRegistry",
  "spatialSnapshot",
  "parcelSpatial",
  "geometry",
  "temporalLineageEvidence",
  "temporalEvidence",
  "lineages",
  "versionValidity",
  "designations",
  "designationValidity",
  "precedenceRelations",
  "mutuallyExclusiveClasses",
  "tolerance",
  "resolvedAt",
  "composedAt",
  "assembledAt",
  "decisionId",
  "trace",
  "overlaysApplicable",
];

// ---------------------------------------------------------------- request

export type E85PublicParcelLocator =
  | { readonly parcelId: string }
  | { readonly point: { readonly x: number; readonly y: number; readonly crs: (typeof POINT_CRS)[number] } };

export interface E85PublicRequest {
  readonly parcel: E85PublicParcelLocator;
  readonly useCode: string;
  readonly requestedAnalyses: readonly E85RuleFamily[];
  /** AS_OF only, with an explicit calendar date. There is no implicit "current" mode on the public contract. */
  readonly temporal: { readonly mode: "AS_OF"; readonly asOfDate: string };
  readonly proposal?: { readonly dwellingUnitCount?: number; readonly buildingRole?: string; readonly tenureCode?: string; readonly frontageMetres?: number };
  /** A caller assertion. Echoed back labelled CALLER_ASSERTED; never treated as City-verified. */
  readonly siteArea?: { readonly sqm: number; readonly basis: E85SiteAreaBasis };
  /** Caller-affirmed / caller-denied external conditions. Caller assertions, labelled as such. */
  readonly conditions?: { readonly satisfied?: readonly string[]; readonly unsatisfied?: readonly string[] };
}

export type E85PublicRequestErrorCode = "INVALID_BODY" | "SERVER_CONTROLLED_FIELD" | "UNKNOWN_FIELD" | "MISSING_FIELD" | "INVALID_VALUE";

export interface E85PublicRequestError {
  readonly code: E85PublicRequestErrorCode;
  /** Dotted path, "(root)" for the body itself. */
  readonly path: string;
  readonly message: string;
}

export type E85PublicRequestParseResult = { readonly ok: true; readonly request: E85PublicRequest } | { readonly ok: false; readonly errors: readonly E85PublicRequestError[] };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isNonBlankString = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** A real proleptic-Gregorian calendar date written exactly as YYYY-MM-DD. */
function isCalendarDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/**
 * Strict parser for the public request. Unknown keys are rejected at every
 * level; server-controlled names are rejected with their own code. Never
 * throws; every problem is reported, in a deterministic order.
 */
export function parseE85PublicRequest(body: unknown): E85PublicRequestParseResult {
  const errors: E85PublicRequestError[] = [];
  const err = (code: E85PublicRequestErrorCode, path: string, message: string) => errors.push({ code, path, message });

  if (!isObj(body)) return { ok: false, errors: [{ code: "INVALID_BODY", path: "(root)", message: "The request body must be a JSON object." }] };

  const checkKeys = (o: Obj, path: string, allowed: readonly string[]) => {
    for (const key of Object.keys(o).sort()) {
      const at = path === "" ? key : `${path}.${key}`;
      if (E85_PUBLIC_SERVER_CONTROLLED_FIELDS.includes(key)) {
        err("SERVER_CONTROLLED_FIELD", at, `"${key}" is determined by the server from its own pinned legal and spatial sources and cannot be supplied by a caller.`);
      } else if (!allowed.includes(key)) {
        err("UNKNOWN_FIELD", at, `"${key}" is not part of the E85 public request contract.`);
      }
    }
  };

  checkKeys(body, "", ["parcel", "useCode", "requestedAnalyses", "temporal", "proposal", "siteArea", "conditions"]);

  // parcel
  let parcel: E85PublicParcelLocator | undefined;
  if (body.parcel === undefined) err("MISSING_FIELD", "parcel", "parcel is required: supply exactly one of parcelId or point.");
  else if (!isObj(body.parcel)) err("INVALID_VALUE", "parcel", "parcel must be an object.");
  else {
    const p = body.parcel;
    checkKeys(p, "parcel", ["parcelId", "point"]);
    const hasId = p.parcelId !== undefined;
    const hasPoint = p.point !== undefined;
    if (hasId === hasPoint) err("INVALID_VALUE", "parcel", "parcel must contain exactly one of parcelId or point.");
    else if (hasId) {
      if (isNonBlankString(p.parcelId)) parcel = { parcelId: p.parcelId.trim() };
      else err("INVALID_VALUE", "parcel.parcelId", "parcelId must be a non-blank string.");
    } else if (!isObj(p.point)) err("INVALID_VALUE", "parcel.point", "point must be an object { x, y, crs }.");
    else {
      const pt = p.point;
      checkKeys(pt, "parcel.point", ["x", "y", "crs"]);
      const ok = isFiniteNumber(pt.x) && isFiniteNumber(pt.y) && (POINT_CRS as readonly unknown[]).includes(pt.crs);
      if (!isFiniteNumber(pt.x)) err("INVALID_VALUE", "parcel.point.x", "x must be a finite number.");
      if (!isFiniteNumber(pt.y)) err("INVALID_VALUE", "parcel.point.y", "y must be a finite number.");
      if (!(POINT_CRS as readonly unknown[]).includes(pt.crs)) err("INVALID_VALUE", "parcel.point.crs", `crs must be one of ${POINT_CRS.join(", ")}; no CRS is inferred from coordinates.`);
      if (ok) parcel = { point: { x: pt.x as number, y: pt.y as number, crs: pt.crs as (typeof POINT_CRS)[number] } };
    }
  }

  // useCode
  if (body.useCode === undefined) err("MISSING_FIELD", "useCode", "useCode is required.");
  else if (!isNonBlankString(body.useCode)) err("INVALID_VALUE", "useCode", "useCode must be a non-blank string.");

  // requestedAnalyses
  let analyses: E85RuleFamily[] = [];
  if (body.requestedAnalyses === undefined) err("MISSING_FIELD", "requestedAnalyses", "requestedAnalyses is required.");
  else if (!Array.isArray(body.requestedAnalyses) || body.requestedAnalyses.length === 0) err("INVALID_VALUE", "requestedAnalyses", "requestedAnalyses must be a non-empty array.");
  else {
    body.requestedAnalyses.forEach((a, i) => {
      if (!(RULE_FAMILIES as readonly unknown[]).includes(a)) err("INVALID_VALUE", `requestedAnalyses.${i}`, `must be one of ${RULE_FAMILIES.join(", ")}.`);
    });
    analyses = [...new Set(body.requestedAnalyses as E85RuleFamily[])].sort((a, b) => RULE_FAMILIES.indexOf(a) - RULE_FAMILIES.indexOf(b));
  }

  // temporal: AS_OF only
  if (body.temporal === undefined) err("MISSING_FIELD", "temporal", 'temporal is required: { "mode": "AS_OF", "asOfDate": "YYYY-MM-DD" }.');
  else if (!isObj(body.temporal)) err("INVALID_VALUE", "temporal", "temporal must be an object.");
  else {
    const t = body.temporal;
    checkKeys(t, "temporal", ["mode", "asOfDate"]);
    if (t.mode !== "AS_OF") err("INVALID_VALUE", "temporal.mode", 'mode must be "AS_OF"; the public contract has no implicit current-date mode.');
    if (t.asOfDate === undefined) err("MISSING_FIELD", "temporal.asOfDate", "asOfDate is required.");
    else if (!isCalendarDate(t.asOfDate)) err("INVALID_VALUE", "temporal.asOfDate", "asOfDate must be a real calendar date written YYYY-MM-DD.");
  }

  // proposal
  if (body.proposal !== undefined) {
    if (!isObj(body.proposal)) err("INVALID_VALUE", "proposal", "proposal must be an object.");
    else {
      const p = body.proposal;
      checkKeys(p, "proposal", ["dwellingUnitCount", "buildingRole", "tenureCode", "frontageMetres"]);
      if (p.dwellingUnitCount !== undefined && !(Number.isInteger(p.dwellingUnitCount) && (p.dwellingUnitCount as number) >= 0)) err("INVALID_VALUE", "proposal.dwellingUnitCount", "must be a non-negative integer.");
      if (p.frontageMetres !== undefined && !(isFiniteNumber(p.frontageMetres) && p.frontageMetres > 0)) err("INVALID_VALUE", "proposal.frontageMetres", "must be a positive number.");
      for (const k of ["buildingRole", "tenureCode"] as const) if (p[k] !== undefined && !isNonBlankString(p[k])) err("INVALID_VALUE", `proposal.${k}`, "must be a non-blank string.");
    }
  }

  // siteArea
  if (body.siteArea !== undefined) {
    if (!isObj(body.siteArea)) err("INVALID_VALUE", "siteArea", "siteArea must be an object { sqm, basis }.");
    else {
      const s = body.siteArea;
      checkKeys(s, "siteArea", ["sqm", "basis"]);
      if (!(isFiniteNumber(s.sqm) && s.sqm > 0)) err("INVALID_VALUE", "siteArea.sqm", "sqm must be a positive number.");
      if (s.basis === undefined) err("MISSING_FIELD", "siteArea.basis", "basis is required with a site area: say what the figure measures, even if UNSPECIFIED/UNKNOWN.");
      else if (!isObj(s.basis)) err("INVALID_VALUE", "siteArea.basis", "basis must be an object.");
      else {
        const b = s.basis;
        checkKeys(b, "siteArea.basis", ["kind", "deductionStatus", "sourceReference"]);
        if (!(SITE_AREA_KINDS as readonly unknown[]).includes(b.kind)) err("INVALID_VALUE", "siteArea.basis.kind", `must be one of ${SITE_AREA_KINDS.join(", ")}.`);
        if (!(DEDUCTION_STATUSES as readonly unknown[]).includes(b.deductionStatus)) err("INVALID_VALUE", "siteArea.basis.deductionStatus", `must be one of ${DEDUCTION_STATUSES.join(", ")}.`);
        if (b.sourceReference !== undefined && typeof b.sourceReference !== "string") err("INVALID_VALUE", "siteArea.basis.sourceReference", "must be a string.");
      }
    }
  }

  // conditions
  if (body.conditions !== undefined) {
    if (!isObj(body.conditions)) err("INVALID_VALUE", "conditions", "conditions must be an object.");
    else {
      const c = body.conditions;
      checkKeys(c, "conditions", ["satisfied", "unsatisfied"]);
      for (const k of ["satisfied", "unsatisfied"] as const) {
        const v = c[k];
        if (v !== undefined && !(Array.isArray(v) && v.every(isNonBlankString))) err("INVALID_VALUE", `conditions.${k}`, "must be an array of non-blank strings.");
      }
    }
  }

  if (errors.length > 0 || parcel === undefined) return { ok: false, errors };

  const b = body as Obj & { temporal: Obj; useCode: string };
  const proposal = body.proposal as E85PublicRequest["proposal"];
  const siteArea = body.siteArea as { sqm: number; basis: Obj } | undefined;
  const conditions = body.conditions as E85PublicRequest["conditions"];
  return {
    ok: true,
    request: {
      parcel,
      useCode: b.useCode.trim(),
      requestedAnalyses: analyses,
      temporal: { mode: "AS_OF", asOfDate: b.temporal.asOfDate as string },
      ...(proposal === undefined ? {} : { proposal }),
      ...(siteArea === undefined
        ? {}
        : {
            siteArea: {
              sqm: siteArea.sqm,
              basis: {
                kind: siteArea.basis.kind as E85SiteAreaKind,
                deductionStatus: siteArea.basis.deductionStatus as E85SiteAreaDeductionStatus,
                ...(siteArea.basis.sourceReference === undefined ? {} : { sourceReference: siteArea.basis.sourceReference as string }),
              },
            },
          }),
      ...(conditions === undefined ? {} : { conditions }),
    },
  };
}

// ---------------------------------------------------------------- server inputs

/**
 * Everything the server alone decides. Built from pinned sources after the
 * server has resolved the caller's parcel locator itself; never from request
 * fields. `designationSource` records which pinned spatial evidence produced
 * `zoneDesignation`.
 */
export interface E85PublicServerInputs {
  readonly normalization: E85DecisionRequest["normalization"];
  readonly parcelSpatial: E85DecisionRequest["parcelSpatial"];
  readonly jurisdictionId: string;
  readonly zoneDesignation: string;
  readonly designationSource: {
    readonly datasetId: string;
    readonly datasetVersionId: string;
    /** SHA-256 of the exact snapshot bytes the server normalized. */
    readonly snapshotSha256: string;
  };
  readonly policyVersion: E85DecisionRequest["policyVersion"];
  readonly availableRulePacks: E85DecisionRequest["availableRulePacks"];
  /**
   * Server-built version-validity lineages and per-feature designation
   * validity, from pinned evidence only. Absent means no temporal evidence:
   * the blanket TEMPORAL_ANALYSIS_NOT_YET_APPLIED disclosure stands. Never
   * derived from a request field, and never from a consolidation stamp.
   */
  readonly temporalEvidence?: E85DecisionRequest["temporalLineageEvidence"];
  readonly spatialRegistry?: E85DecisionRequest["spatialRegistry"];
  readonly precedenceRelations?: E85DecisionRequest["precedenceRelations"];
  readonly tolerance?: E85DecisionRequest["tolerance"];
  readonly mutuallyExclusiveClasses?: E85DecisionRequest["mutuallyExclusiveClasses"];
  readonly resolvedAt?: string;
  readonly composedAt?: string;
  readonly assembledAt?: string;
}

// ---------------------------------------------------------------- response

/** A value the engine resolved, carried with its own citation. */
export interface E85PublicField {
  readonly family: E85RuleFamily | "ENVELOPE";
  readonly field: string;
  readonly value: unknown;
  readonly note?: string;
  readonly provenance: {
    readonly sourceId: string;
    readonly sourceVersionId?: string;
    readonly adapterId?: string;
    readonly adapterVersion?: string;
    readonly documentLocator?: unknown;
    readonly url?: string;
    readonly interpretationNote?: string;
  };
  readonly temporal: E85TemporalWindow;
  /** Which caller assertions this value depends on. Non-empty means the value is only as good as those assertions. */
  readonly dependsOnCallerAssertions: readonly ("siteArea" | "proposal" | "conditions")[];
  /** The caller-affirmed condition ids this value was released on. Present only when it depends on conditions; each is CALLER_ASSERTED_NOT_CITY_VERIFIED. */
  readonly requiredConditionIds?: readonly string[];
  /**
   * RESOLVED_NO_BLOCKERS — no material blocker is outstanding for this response.
   * UNCONFIRMED_WHILE_BLOCKED — the value was read from the evidence, but at
   * least one material blocker (listed in `blockedBy`) is outstanding, so it
   * must not be relied on as the answer for the as-of date.
   */
  readonly standing: "RESOLVED_NO_BLOCKERS" | "UNCONFIRMED_WHILE_BLOCKED";
  /** Source codes of the outstanding blockers; empty when `standing` is RESOLVED_NO_BLOCKERS. */
  readonly blockedBy: readonly string[];
}

/**
 * The engine's use-permission status, verbatim, for a USE request. Reported
 * even when no permission value is released, so a withheld or out-of-scope
 * use reads UNKNOWN rather than disappearing. UNKNOWN is never PROHIBITED.
 */
export interface E85PublicUseOutcome {
  readonly useCode: string;
  readonly status: "PERMITTED" | "CONDITIONAL" | "PROHIBITED" | "UNKNOWN";
  /** True only when `fields` carries the permission value with its citation. */
  readonly valueReported: boolean;
  readonly meaning: string;
}

export interface E85PublicResponse {
  readonly contractVersion: typeof E85_PUBLIC_CONTRACT_VERSION;
  /** The engine status, verbatim. Not a verification claim; see `statusMeaning`. */
  readonly status: E85OverallStatus;
  readonly statusMeaning: string;
  readonly temporal: { readonly mode: "AS_OF"; readonly asOfDate: string };
  readonly jurisdictionId: string;
  readonly designation: {
    readonly value: string;
    readonly basis: "SERVER_SPATIAL_EVIDENCE";
    readonly datasetId: string;
    readonly datasetVersionId: string;
    readonly snapshotSha256: string;
    readonly featureIds: readonly string[];
  };
  readonly fields: readonly E85PublicField[];
  /** Present when USE was requested and evaluated. */
  readonly useOutcome?: E85PublicUseOutcome;
  readonly practicalCapacity: E85PracticalCapacityAssessment;
  readonly callerAssertions: {
    readonly label: "CALLER_ASSERTED_NOT_CITY_VERIFIED";
    readonly siteArea?: E85PublicRequest["siteArea"];
    readonly proposal?: E85PublicRequest["proposal"];
    readonly conditions?: E85PublicRequest["conditions"];
  };
  readonly warnings: readonly string[];
  readonly gaps: readonly Pick<E85DataGap, "reasonCode" | "reason" | "resolutionHint">[];
  readonly blockers: readonly { readonly kind: E85DecisionBlockerKind; readonly materiality: E85DecisionMateriality; readonly sourceCode: string; readonly reason: string; readonly featureId?: string; readonly packId?: string }[];
  /** Temporal-request findings, including TEMPORAL_ANALYSIS_NOT_YET_APPLIED. Never omitted when present. */
  readonly temporalFindings: readonly { readonly sourceRef: string; readonly sourceCode: string; readonly materiality: E85DecisionMateriality; readonly reason: string }[];
  readonly sourceFindings: readonly { readonly packId: string; readonly sourceId: string; readonly sourceVersionId?: string; readonly finding: unknown }[];
  readonly engine: { readonly rulePackIds: readonly string[]; readonly unresolvedPackIds: readonly string[]; readonly policyVersionId: string };
}

const STATUS_MEANING: Record<E85OverallStatus, string> = {
  MACHINE_RESOLVED:
    "The engine resolved the requested fields from the server's pinned sources for this as-of date. This is a machine reading of those sources, not a City verification or a development entitlement.",
  MACHINE_RESOLVED_WITH_WARNINGS:
    "The engine resolved the requested fields, with warnings that qualify them. This is a machine reading of the server's pinned sources, not a City verification or a development entitlement.",
  MANUAL_REVIEW_REQUIRED: "A person must review the flagged items before any field can be relied on.",
  DATA_GAP: "Evidence needed to answer is missing or unresolved; see gaps and blockers. Resolved fields, if any, are partial.",
};

const USE_STATUS_MEANING: Record<E85PublicUseOutcome["status"], string> = {
  PERMITTED: "The cited source lists this use as outright approval, on the conditions listed in the field. Not a City verification or a permit.",
  CONDITIONAL: "The cited source lists this use as conditional approval: it needs a discretionary decision by the named authority. Not a City verification or a permit.",
  PROHIBITED: "The cited source affirmatively excludes this use in this district.",
  UNKNOWN:
    "No permission value is reported. The evidence does not resolve this use for this request, whether because a required caller condition is unconfirmed, the caller denied it, or no rule was found. This is NOT a finding that the use is prohibited.",
};

const PROPOSAL_DIMENSIONS: readonly E85ApplicabilityDimension[] = ["dwellingUnits", "buildingRoles", "excludedBuildingRoles", "frontageMetres", "tenureCodes", "excludedTenureCodes", "useCodes", "excludedUseCodes"];

function envelopeOf(pkg: E85DecisionPackage): E85RegulatoryEnvelopeResult | undefined {
  const r = pkg.phase4?.result;
  if (r === undefined) return undefined;
  return "envelope" in r ? r.envelope : "partialEnvelope" in r ? r.partialEnvelope : undefined;
}

function dependsOn(field: string, ev: E85Evidence<unknown>, request: E85PublicRequest): E85PublicField["dependsOnCallerAssertions"] {
  const out = new Set<"siteArea" | "proposal" | "conditions">();
  const a = ev.applicability;
  if (field === "maxRegulatoryGfaSqm" || a?.siteAreaSqm !== undefined) out.add("siteArea");
  if (a !== undefined && PROPOSAL_DIMENSIONS.some((d) => a[d as keyof typeof a] !== undefined) && request.proposal !== undefined) out.add("proposal");
  if (a?.requiredConditionIds !== undefined && a.requiredConditionIds.length > 0) out.add("conditions");
  return (["siteArea", "proposal", "conditions"] as const).filter((k) => out.has(k));
}

function publicField(family: E85PublicField["family"], field: string, ev: E85Evidence<unknown>, request: E85PublicRequest, blockedBy: readonly string[], note?: string): E85PublicField {
  const p = ev.provenance;
  const dependsOnCallerAssertions = dependsOn(field, ev, request);
  const conditionIds = ev.applicability?.requiredConditionIds;
  return {
    family,
    field,
    value: ev.value,
    ...(note === undefined ? {} : { note }),
    provenance: {
      sourceId: p.sourceId,
      ...(p.sourceVersionId === undefined ? {} : { sourceVersionId: p.sourceVersionId }),
      ...(p.adapterId === undefined ? {} : { adapterId: p.adapterId }),
      ...(p.adapterVersion === undefined ? {} : { adapterVersion: p.adapterVersion }),
      ...(p.documentLocator === undefined ? {} : { documentLocator: p.documentLocator }),
      ...(p.url === undefined ? {} : { url: p.url }),
      ...(p.interpretationNote === undefined ? {} : { interpretationNote: p.interpretationNote }),
    },
    temporal: ev.temporal,
    dependsOnCallerAssertions,
    ...(dependsOnCallerAssertions.includes("conditions") && conditionIds !== undefined ? { requiredConditionIds: [...conditionIds] } : {}),
    standing: blockedBy.length === 0 ? "RESOLVED_NO_BLOCKERS" : "UNCONFIRMED_WHILE_BLOCKED",
    blockedBy,
  };
}

const NOT_ASSESSED: E85PracticalCapacityAssessment = {
  status: "NOT_ASSESSED",
  reason: "E85 reports each regulatory limit as a legal ceiling or minimum; it does not assess which limit governs an achievable building.",
};

/** Maps a decision package to the public DTO. The decision trace is deliberately not included. */
export function toE85PublicResponse(pkg: E85DecisionPackage, request: E85PublicRequest, server: E85PublicServerInputs): E85PublicResponse {
  const envelope = envelopeOf(pkg);
  const fields: E85PublicField[] = [];
  const blockedBy = [...new Set(pkg.blockers.map((b) => b.sourceCode))].sort();
  const use = pkg.phase4?.usePermission;
  if (use?.evidence !== undefined) fields.push(publicField("USE", "usePermission", use.evidence, request, blockedBy));
  for (const limit of envelope?.resolvedLimits ?? []) fields.push(publicField("ENVELOPE", limit.field, limit.evidence, request, blockedBy, limit.note));
  const useOutcome: E85PublicUseOutcome | undefined =
    pkg.phase4 === undefined || !request.requestedAnalyses.includes("USE")
      ? undefined
      : { useCode: request.useCode, status: use?.status ?? "UNKNOWN", valueReported: use?.evidence !== undefined, meaning: USE_STATUS_MEANING[use?.status ?? "UNKNOWN"] };

  const result = pkg.phase4?.result;
  const resultWarnings = result !== undefined && "warnings" in result ? result.warnings : [];
  const resultGaps = result !== undefined && result.status === "DATA_GAP" ? result.gaps : [];
  const blockerGaps = pkg.blockers.flatMap((b) => (b.gap === undefined ? [] : [b.gap]));
  const seenGap = new Set<string>();
  const gaps = [...resultGaps, ...blockerGaps, ...(envelope?.envelopeGaps ?? [])].filter((g) => {
    const key = `${g.reasonCode}\u0000${g.reason}`;
    if (seenGap.has(key)) return false;
    seenGap.add(key);
    return true;
  });

  return {
    contractVersion: E85_PUBLIC_CONTRACT_VERSION,
    status: pkg.status,
    statusMeaning: STATUS_MEANING[pkg.status],
    temporal: request.temporal,
    jurisdictionId: server.jurisdictionId,
    designation: {
      value: server.zoneDesignation,
      basis: "SERVER_SPATIAL_EVIDENCE",
      datasetId: server.designationSource.datasetId,
      datasetVersionId: server.designationSource.datasetVersionId,
      snapshotSha256: server.designationSource.snapshotSha256,
      featureIds: [...new Set((pkg.phase7?.hits ?? []).filter((h) => h.applicability === "APPLIES").map((h) => h.featureId))].sort(),
    },
    fields,
    ...(useOutcome === undefined ? {} : { useOutcome }),
    practicalCapacity: envelope?.practicalCapacity ?? NOT_ASSESSED,
    callerAssertions: {
      label: "CALLER_ASSERTED_NOT_CITY_VERIFIED",
      ...(request.siteArea === undefined ? {} : { siteArea: request.siteArea }),
      ...(request.proposal === undefined ? {} : { proposal: request.proposal }),
      ...(request.conditions === undefined ? {} : { conditions: request.conditions }),
    },
    warnings: [...new Set([...pkg.warnings, ...resultWarnings])],
    gaps: gaps.map((g) => ({ reasonCode: g.reasonCode, reason: g.reason, ...(g.resolutionHint === undefined ? {} : { resolutionHint: g.resolutionHint }) })),
    blockers: pkg.blockers.map((b) => ({
      kind: b.kind,
      materiality: b.materiality,
      sourceCode: b.sourceCode,
      reason: b.reason,
      ...(b.featureId === undefined ? {} : { featureId: b.featureId }),
      ...(b.packId === undefined ? {} : { packId: b.packId }),
    })),
    temporalFindings: pkg.materiality.filter((m) => m.sourcePhase === "TEMPORAL_REQUEST").map((m) => ({ sourceRef: m.sourceRef, sourceCode: m.sourceCode, materiality: m.materiality, reason: m.reason })),
    sourceFindings: pkg.sourceFindings.map((s) => ({ packId: s.packId, sourceId: s.sourceId, ...(s.sourceVersionId === undefined ? {} : { sourceVersionId: s.sourceVersionId }), finding: s.finding })),
    engine: {
      rulePackIds: pkg.packResolution.resolved.map((p) => p.packId),
      unresolvedPackIds: pkg.packResolution.unresolvedPackIds,
      policyVersionId: server.policyVersion.policyVersionId,
    },
  };
}

/** Builds the internal decision request. Every legal/spatial input comes from `server`; the request contributes only locator-free caller facts. */
export function buildE85DecisionRequestFromPublic(server: E85PublicServerInputs, request: E85PublicRequest): E85DecisionRequest {
  return {
    normalization: server.normalization,
    parcelSpatial: server.parcelSpatial,
    parcel: {
      parcelReferenceId: server.parcelSpatial.parcelReferenceId,
      rawZoningDesignation: server.zoneDesignation,
      ...(request.siteArea === undefined ? {} : { siteAreaSqm: request.siteArea.sqm, siteAreaBasis: request.siteArea.basis }),
    },
    jurisdictionId: server.jurisdictionId,
    zoneDesignation: server.zoneDesignation,
    useCode: request.useCode,
    asOfDate: request.temporal.asOfDate,
    temporalRequest: { mode: "AS_OF", asOfDate: request.temporal.asOfDate },
    requestedAnalyses: request.requestedAnalyses,
    policyVersion: server.policyVersion,
    availableRulePacks: server.availableRulePacks,
    ...(request.proposal === undefined ? {} : { proposal: request.proposal }),
    ...(request.conditions === undefined
      ? {}
      : {
          callerContext: {
            ...(request.conditions.satisfied === undefined ? {} : { satisfiedConditions: request.conditions.satisfied }),
            ...(request.conditions.unsatisfied === undefined ? {} : { unsatisfiedConditions: request.conditions.unsatisfied }),
          },
        }),
    ...(server.spatialRegistry === undefined ? {} : { spatialRegistry: server.spatialRegistry }),
    ...(server.precedenceRelations === undefined ? {} : { precedenceRelations: server.precedenceRelations }),
    ...(server.tolerance === undefined ? {} : { tolerance: server.tolerance }),
    ...(server.mutuallyExclusiveClasses === undefined ? {} : { mutuallyExclusiveClasses: server.mutuallyExclusiveClasses }),
    ...(server.resolvedAt === undefined ? {} : { resolvedAt: server.resolvedAt }),
    ...(server.composedAt === undefined ? {} : { composedAt: server.composedAt }),
    ...(server.assembledAt === undefined ? {} : { assembledAt: server.assembledAt }),
    // Server-controlled only. Without it the engine keeps its TEMPORAL_ANALYSIS_NOT_YET_APPLIED disclosure.
    ...(server.temporalEvidence === undefined ? {} : { temporalLineageEvidence: server.temporalEvidence }),
  };
}

/**
 * Runs one public request against server-built inputs. `response` is the only
 * part that may leave the server; `trace` is for server-side logs.
 */
export function evaluateE85PublicRequest(server: E85PublicServerInputs, request: E85PublicRequest): { response: E85PublicResponse; trace: E85DecisionPackage["trace"] } {
  const pkg = assembleE85DecisionPackage(buildE85DecisionRequestFromPublic(server, request));
  return { response: toE85PublicResponse(pkg, request, server), trace: pkg.trace };
}

/**
 * InvestScape™ E85 Phase 12B.2 — scoped rule applicability: canonical scope
 * identity, three-valued evaluation, scope disjointness, and proposal-time
 * evidence selection.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Pure, deterministic and jurisdiction-neutral. Nothing here knows a
 * municipality, a zone, or an instrument; codes are compared as opaque data.
 *
 * CANONICAL SCOPE KEY. A readable, order-independent string such as
 * `use=multiple_dwelling;dwellingUnits=..8`. Dimensions appear in the fixed
 * order of `E85_APPLICABILITY_DIMENSIONS`; code lists are trimmed, de-duplicated
 * and sorted by UTF-16 code unit; bounds print as `min..max` with an open side
 * left empty; `-0` prints as `0`. Empty lists and empty bounds are identical to
 * absence, and an applicability with nothing left is "" — so unscoped evidence
 * keeps its pre-existing identity byte for byte. No hashing, and no reliance on
 * object insertion order. Codes containing a reserved serialization character
 * (`;` `|` `=` `{` `}` or a control character) are REJECTED, never escaped, and
 * non-finite or inverted bounds are rejected too: adapters validate before
 * emitting, and building a key for invalid applicability throws deterministically.
 *
 * THREE-VALUED CONJUNCTION. Each present dimension is true, false, or unknown.
 * Any false -> NOT_APPLICABLE; otherwise any unknown -> UNDETERMINED; otherwise
 * APPLIES. Missing context is never read as false and never as true.
 *
 * DISJOINTNESS is only ever PROVEN, never assumed: two scopes are disjoint when
 * some single dimension cannot hold for both. Unscoped evidence overlaps every
 * scope, exclusion-only lists never prove disjointness (the universe of codes is
 * open), and opaque condition ids never do.
 */
import type { E85Evidence } from "./evidence-types";
import type { E85RuleFamily, E85RuleRecord } from "./rule-family-types";
import type { E85EvaluationFinding } from "./finding-types";
import type { E85DataGapReasonCode } from "./data-gap-types";
import type { E85EvaluationRequest } from "./request-types";
import type {
  E85ApplicabilityContext,
  E85ApplicabilityDimension,
  E85ApplicabilityEvaluation,
  E85FindingApplicabilityAudit,
  E85NumericBound,
  E85RuleApplicability,
} from "./rule-applicability-types";
import { E85_APPLICABILITY_DIMENSIONS } from "./rule-applicability-types";
import { evaluateTemporalApplicability, matchesJurisdictionZone } from "./applicability";

type E85CodeDimension = "useCodes" | "excludedUseCodes" | "buildingRoles" | "excludedBuildingRoles" | "tenureCodes" | "excludedTenureCodes" | "requiredConditionIds";

const CODE_DIMENSIONS: ReadonlySet<E85ApplicabilityDimension> = new Set<E85ApplicabilityDimension>([
  "useCodes",
  "excludedUseCodes",
  "buildingRoles",
  "excludedBuildingRoles",
  "tenureCodes",
  "excludedTenureCodes",
  "requiredConditionIds",
]);

function isCodeDimension(d: E85ApplicabilityDimension): d is E85CodeDimension {
  return CODE_DIMENSIONS.has(d);
}

/** Short, stable labels used in the canonical key. Changing one changes every scoped concept key, so they are fixed here once. */
const KEY_LABELS: Readonly<Record<E85ApplicabilityDimension, string>> = {
  useCodes: "use",
  excludedUseCodes: "notUse",
  dwellingUnits: "dwellingUnits",
  buildingRoles: "role",
  excludedBuildingRoles: "notRole",
  siteAreaSqm: "siteAreaSqm",
  frontageMetres: "frontageMetres",
  tenureCodes: "tenure",
  excludedTenureCodes: "notTenure",
  requiredConditionIds: "conditions",
};

const RESERVED_CODE_CHARACTERS = /[;|={}]/;

/** True when a code contains a reserved serialization character, or any C0 control character or DEL. */
function hasReservedCodeCharacter(code: string): boolean {
  if (RESERVED_CODE_CHARACTERS.test(code)) return true;
  for (let i = 0; i < code.length; i++) {
    const unit = code.charCodeAt(i);
    if (unit < 0x20 || unit === 0x7f) return true;
  }
  return false;
}

function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function dimensionOrder(a: E85ApplicabilityDimension, b: E85ApplicabilityDimension): number {
  return E85_APPLICABILITY_DIMENSIONS.indexOf(a) - E85_APPLICABILITY_DIMENSIONS.indexOf(b);
}

/** Trimmed, de-duplicated, code-unit-sorted codes; empty strings dropped. */
export function normalizeE85ApplicabilityCodes(codes: readonly string[] | undefined): string[] {
  if (codes === undefined) return [];
  return [...new Set(codes.map((c) => c.trim()).filter((c) => c.length > 0))].sort(byCodeUnit);
}

function boundIsEmpty(bound: E85NumericBound | undefined): boolean {
  return bound === undefined || (bound.min === undefined && bound.max === undefined);
}

/** Every problem with an applicability structure, in canonical dimension order. Empty means valid. */
export function validateE85RuleApplicability(applicability: E85RuleApplicability | undefined): readonly string[] {
  if (applicability === undefined) return [];
  const problems: string[] = [];
  for (const d of E85_APPLICABILITY_DIMENSIONS) {
    if (isCodeDimension(d)) {
      const codes = applicability[d];
      if (codes === undefined) continue;
      for (const code of codes) {
        if (typeof code !== "string") {
          problems.push(`${d}: every code must be a string.`);
        } else if (hasReservedCodeCharacter(code.trim())) {
          problems.push(`${d}: code ${JSON.stringify(code)} contains a reserved character (";", "|", "=", "{", "}" or a control character) and is rejected rather than escaped.`);
        }
      }
    } else {
      const bound = applicability[d];
      if (bound === undefined) continue;
      for (const side of ["min", "max"] as const) {
        const value = bound[side];
        if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value))) problems.push(`${d}.${side}: bounds must be finite numbers.`);
      }
      if (typeof bound.min === "number" && typeof bound.max === "number" && Number.isFinite(bound.min) && Number.isFinite(bound.max) && bound.min > bound.max) {
        problems.push(`${d}: min (${bound.min}) exceeds max (${bound.max}), so no proposal could ever satisfy it.`);
      }
    }
  }
  return problems;
}

function formatNumber(n: number): string {
  return Object.is(n, -0) ? "0" : String(n);
}

function formatBound(bound: E85NumericBound): string {
  return `${bound.min === undefined ? "" : formatNumber(bound.min)}..${bound.max === undefined ? "" : formatNumber(bound.max)}`;
}

/** The canonical scope key, or "" when the evidence is unscoped. Throws for invalid applicability (see module doc). */
export function canonicalE85ApplicabilityKey(applicability: E85RuleApplicability | undefined): string {
  if (applicability === undefined) return "";
  const problems = validateE85RuleApplicability(applicability);
  if (problems.length > 0) throw new Error(`Invalid rule applicability: ${problems.join(" ")}`);
  const parts: string[] = [];
  for (const d of E85_APPLICABILITY_DIMENSIONS) {
    if (isCodeDimension(d)) {
      const codes = normalizeE85ApplicabilityCodes(applicability[d]);
      if (codes.length > 0) parts.push(`${KEY_LABELS[d]}=${codes.join("|")}`);
    } else {
      const bound = applicability[d];
      if (!boundIsEmpty(bound)) parts.push(`${KEY_LABELS[d]}=${formatBound(bound!)}`);
    }
  }
  return parts.join(";");
}

/** True when the applicability narrows anything at all. */
export function isE85ApplicabilityScoped(applicability: E85RuleApplicability | undefined): boolean {
  return canonicalE85ApplicabilityKey(applicability) !== "";
}

type Tri = boolean | undefined;
const ABSENT = "ABSENT" as const;

function withinBound(value: number | undefined, bound: E85NumericBound): Tri {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  if (bound.min !== undefined && value < bound.min) return false;
  if (bound.max !== undefined && value > bound.max) return false;
  return true;
}

function isRecognizedUse(useCode: string, context: E85ApplicabilityContext): boolean {
  return (context.recognizedUseCodes ?? []).some((c) => c.trim() === useCode);
}

function dimensionTruth(d: E85ApplicabilityDimension, a: E85RuleApplicability, context: E85ApplicabilityContext): Tri | typeof ABSENT {
  if (isCodeDimension(d)) {
    const codes = normalizeE85ApplicabilityCodes(a[d]);
    if (codes.length === 0) return ABSENT;
    switch (d) {
      case "useCodes": {
        const use = context.useCode?.trim();
        if (!use) return undefined;
        if (codes.includes(use)) return true;
        return isRecognizedUse(use, context) ? false : undefined;
      }
      case "excludedUseCodes": {
        const use = context.useCode?.trim();
        if (!use) return undefined;
        if (codes.includes(use)) return false;
        // UNKNOWN-USE SAFETY: "not excluded" is only meaningful for a use the
        // governing rule set actually recognizes.
        return isRecognizedUse(use, context) ? true : undefined;
      }
      case "buildingRoles":
      case "tenureCodes": {
        const value = (d === "buildingRoles" ? context.buildingRole : context.tenureCode)?.trim();
        if (!value) return undefined;
        return codes.includes(value);
      }
      case "excludedBuildingRoles":
      case "excludedTenureCodes": {
        const value = (d === "excludedBuildingRoles" ? context.buildingRole : context.tenureCode)?.trim();
        if (!value) return undefined;
        return !codes.includes(value);
      }
      case "requiredConditionIds": {
        const satisfied = new Set(normalizeE85ApplicabilityCodes(context.satisfiedConditions));
        const unsatisfied = new Set(normalizeE85ApplicabilityCodes(context.unsatisfiedConditions));
        let unknown = false;
        for (const id of codes) {
          const isTrue = satisfied.has(id) && !unsatisfied.has(id);
          const isFalse = unsatisfied.has(id) && !satisfied.has(id);
          if (isFalse) return false;
          if (!isTrue) unknown = true;
        }
        return unknown ? undefined : true;
      }
    }
  }
  const bound = a[d as "dwellingUnits" | "siteAreaSqm" | "frontageMetres"];
  if (boundIsEmpty(bound)) return ABSENT;
  const value = d === "dwellingUnits" ? context.dwellingUnitCount : d === "siteAreaSqm" ? context.siteAreaSqm : context.frontageMetres;
  return withinBound(value, bound!);
}

/** Three-valued evaluation of one applicability against one proposal context. Unscoped evidence always APPLIES. */
export function evaluateE85RuleApplicability(applicability: E85RuleApplicability | undefined, context: E85ApplicabilityContext): E85ApplicabilityEvaluation {
  const applicabilityKey = canonicalE85ApplicabilityKey(applicability);
  if (applicabilityKey === "") return { outcome: "APPLIES", applicabilityKey, missingDimensions: [] };
  const missing: E85ApplicabilityDimension[] = [];
  for (const d of E85_APPLICABILITY_DIMENSIONS) {
    const truth = dimensionTruth(d, applicability!, context);
    if (truth === ABSENT) continue;
    if (truth === false) return { outcome: "NOT_APPLICABLE", applicabilityKey, decidingDimension: d, missingDimensions: [] };
    if (truth === undefined) missing.push(d);
  }
  if (missing.length > 0) return { outcome: "UNDETERMINED", applicabilityKey, missingDimensions: missing };
  return { outcome: "APPLIES", applicabilityKey, missingDimensions: [] };
}

const INCLUDE_EXCLUDE_PAIRS: readonly [E85CodeDimension, E85CodeDimension][] = [
  ["useCodes", "excludedUseCodes"],
  ["buildingRoles", "excludedBuildingRoles"],
  ["tenureCodes", "excludedTenureCodes"],
];

/**
 * True only when the two scopes provably cannot both govern one proposal.
 * Anything short of proof — including unscoped evidence and opaque condition
 * ids — returns false, and composition then applies its ordinary
 * agreement/conflict semantics.
 */
export function e85ApplicabilityScopesProvenDisjoint(a: E85RuleApplicability | undefined, b: E85RuleApplicability | undefined): boolean {
  if (canonicalE85ApplicabilityKey(a) === "" || canonicalE85ApplicabilityKey(b) === "") return false;
  for (const [include, exclude] of INCLUDE_EXCLUDE_PAIRS) {
    const ai = normalizeE85ApplicabilityCodes(a![include]);
    const bi = normalizeE85ApplicabilityCodes(b![include]);
    const ae = normalizeE85ApplicabilityCodes(a![exclude]);
    const be = normalizeE85ApplicabilityCodes(b![exclude]);
    if (ai.length > 0 && bi.length > 0 && !ai.some((c) => bi.includes(c))) return true;
    if (ai.length > 0 && ai.every((c) => be.includes(c))) return true;
    if (bi.length > 0 && bi.every((c) => ae.includes(c))) return true;
  }
  for (const d of ["dwellingUnits", "siteAreaSqm", "frontageMetres"] as const) {
    const ab = a![d];
    const bb = b![d];
    if (boundIsEmpty(ab) || boundIsEmpty(bb)) continue;
    const aMin = ab!.min ?? -Infinity;
    const aMax = ab!.max ?? Infinity;
    const bMin = bb!.min ?? -Infinity;
    const bMax = bb!.max ?? Infinity;
    if (aMax < bMin || bMax < aMin) return true;
  }
  return false;
}

/** Use codes the rule set itself names through use-permission evidence for this jurisdiction/zone, sorted. */
export function recognizedE85UseCodes(rules: readonly E85RuleRecord[], jurisdictionId: string, zoneDesignation: string): string[] {
  const out = new Set<string>();
  for (const rule of rules) {
    if (rule.family !== "USE" || !matchesJurisdictionZone(rule, jurisdictionId, zoneDesignation)) continue;
    for (const ev of rule.permissions) out.add(ev.value.useCode.trim());
  }
  return [...out].sort(byCodeUnit);
}

/** Builds the proposal context Phase 4 evaluates scopes against, from what the request already carries. Never invents a value. */
export function buildE85ApplicabilityContext(
  request: Pick<E85EvaluationRequest, "rules" | "jurisdictionId" | "zoneDesignation" | "useCode" | "parcel" | "proposal" | "callerContext">,
): E85ApplicabilityContext {
  const proposal = request.proposal;
  return {
    useCode: request.useCode,
    recognizedUseCodes: recognizedE85UseCodes(request.rules, request.jurisdictionId, request.zoneDesignation),
    ...(proposal?.dwellingUnitCount === undefined ? {} : { dwellingUnitCount: proposal.dwellingUnitCount }),
    ...(proposal?.buildingRole === undefined ? {} : { buildingRole: proposal.buildingRole }),
    ...(proposal?.tenureCode === undefined ? {} : { tenureCode: proposal.tenureCode }),
    ...(proposal?.frontageMetres === undefined ? {} : { frontageMetres: proposal.frontageMetres }),
    ...(request.parcel.siteAreaSqm === undefined ? {} : { siteAreaSqm: request.parcel.siteAreaSqm }),
    ...(request.callerContext?.satisfiedConditions === undefined ? {} : { satisfiedConditions: request.callerContext.satisfiedConditions }),
    ...(request.callerContext?.unsatisfiedConditions === undefined ? {} : { unsatisfiedConditions: request.callerContext.unsatisfiedConditions }),
  };
}

export interface E85ScopedEvidenceClassification<T> {
  readonly evidence: E85Evidence<T>;
  readonly evaluation: E85ApplicabilityEvaluation;
}

export interface E85ApplicabilityPartition<T> {
  readonly applies: readonly E85Evidence<T>[];
  readonly notApplicable: readonly E85ScopedEvidenceClassification<T>[];
  readonly undetermined: readonly E85ScopedEvidenceClassification<T>[];
}

/** Splits evidence by applicability to the proposal. Order-preserving; unscoped evidence always lands in `applies`. */
export function partitionE85EvidenceByApplicability<T>(items: readonly E85Evidence<T>[], context: E85ApplicabilityContext): E85ApplicabilityPartition<T> {
  const applies: E85Evidence<T>[] = [];
  const notApplicable: E85ScopedEvidenceClassification<T>[] = [];
  const undetermined: E85ScopedEvidenceClassification<T>[] = [];
  for (const evidence of items) {
    if (evidence.applicability === undefined) {
      applies.push(evidence);
      continue;
    }
    const evaluation = evaluateE85RuleApplicability(evidence.applicability, context);
    if (evaluation.outcome === "APPLIES") applies.push(evidence);
    else if (evaluation.outcome === "NOT_APPLICABLE") notApplicable.push({ evidence, evaluation });
    else undetermined.push({ evidence, evaluation });
  }
  return { applies, notApplicable, undetermined };
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(byCodeUnit);
}

function sortedDimensions(values: readonly E85ApplicabilityDimension[]): E85ApplicabilityDimension[] {
  return [...new Set(values)].sort(dimensionOrder);
}

function gapReasonFor(missing: readonly E85ApplicabilityDimension[]): E85DataGapReasonCode {
  if (missing.includes("useCodes") || missing.includes("excludedUseCodes")) return "USE_CLASSIFICATION_UNKNOWN";
  if (missing.includes("siteAreaSqm") || missing.includes("frontageMetres")) return "REQUIRED_SITE_DIMENSION_MISSING";
  // Phase 12B.4: an unresolved external condition is not a missing proposal attribute.
  if (missing.every((d) => d === "requiredConditionIds")) return "EXTERNAL_CONDITION_UNDETERMINED";
  return "PROPOSAL_CONTEXT_MISSING";
}

export interface E85ProposalEvidenceSelection<T> {
  /** Evidence whose scope APPLIES and whose temporal window APPLIES — safe to hand to conflict detection. */
  readonly applicable: readonly E85Evidence<T>[];
  /** A GAP when some live scope is undetermined; a NO_RULE_FOR_PROPOSAL_SCOPE audit when every scoped value was proven not to apply. */
  readonly finding?: E85EvaluationFinding;
}

/**
 * Phase 4 selection, run BEFORE conflict detection so disjoint scoped values are
 * never pooled into a false conflict.
 *
 *  - any scope still UNDETERMINED (for evidence not already out of its
 *    temporal window) -> GAP for this field; nothing resolves, because the
 *    undecided value might be the one that governs;
 *  - no scope applies but some were proven NOT_APPLICABLE -> an informational
 *    NO_RULE_FOR_PROPOSAL_SCOPE finding: the source states this concept only for
 *    other proposals. Not a gap (no evidence is missing), and never "unlimited";
 *  - otherwise the applicable evidence, filtered to its temporal window.
 */
export function selectE85EvidenceForProposal<T>(
  family: E85RuleFamily,
  field: string,
  items: readonly E85Evidence<T>[],
  context: E85ApplicabilityContext,
  asOfDate: string,
): E85ProposalEvidenceSelection<T> {
  const partition = partitionE85EvidenceByApplicability(items, context);
  const live = (c: E85ScopedEvidenceClassification<T>): boolean => {
    const temporal = evaluateTemporalApplicability(c.evidence.temporal, asOfDate);
    return temporal !== "NOT_YET_EFFECTIVE" && temporal !== "EXPIRED";
  };

  const undetermined = partition.undetermined.filter(live);
  if (undetermined.length > 0) {
    const missing = sortedDimensions(undetermined.flatMap((c) => c.evaluation.missingDimensions));
    const keys = sortedUnique(undetermined.map((c) => c.evaluation.applicabilityKey));
    const audit: E85FindingApplicabilityAudit = { applicabilityKeys: keys, outcome: "UNDETERMINED", missingDimensions: missing };
    return {
      applicable: [],
      finding: {
        family,
        field,
        outcome: "GAP",
        gap: {
          reasonCode: gapReasonFor(missing),
          reason:
            `${field}: ${undetermined.length} scoped rule value(s) with scope ${keys.map((k) => `{${k}}`).join(", ")} cannot be confirmed to govern this proposal, ` +
            `because the proposal context does not establish: ${missing.join(", ")}. No scope is assumed to apply, and none is assumed not to.`,
          sourcesChecked: sortedUnique(undetermined.map((c) => c.evidence.provenance.sourceId)),
          checkedAt: new Date().toISOString(),
          resolutionHint: `Supply the missing proposal context (${missing.join(", ")}) so each scoped rule's applicability can be decided.`,
        },
        applicability: audit,
      },
    };
  }

  if (partition.applies.length === 0 && partition.notApplicable.length > 0) {
    const keys = sortedUnique(partition.notApplicable.map((c) => c.evaluation.applicabilityKey));
    const deciding = sortedDimensions(partition.notApplicable.map((c) => c.evaluation.decidingDimension).filter((d): d is E85ApplicabilityDimension => d !== undefined));
    return {
      applicable: [],
      finding: {
        family,
        field,
        outcome: "NO_RULE_FOR_PROPOSAL_SCOPE",
        applicability: { applicabilityKeys: keys, outcome: "NOT_APPLICABLE", decidingDimensions: deciding },
      },
    };
  }

  return { applicable: partition.applies.filter((ev) => evaluateTemporalApplicability(ev.temporal, asOfDate) === "APPLIES") };
}

/**
 * PHASE 12C.2 — CURRENT-ONLY ANTI-LOOK-AHEAD helper. `selectE85EvidenceForProposal`
 * silently returns `applicable: []` with NO finding when every scope-applicable
 * item is temporally excluded (NOT_YET_EFFECTIVE/EXPIRED) — by design, so each
 * family evaluator can decide its own honest final answer for that condition
 * (e.g. USE already resolves an honest UNKNOWN status; DENSITY/DIMENSIONAL had
 * no such fallback and silently produced no finding at all, which is the actual
 * defect this phase fixes). This helper gives a family evaluator the facts to
 * build that answer without duplicating the temporal-vs-scope classification
 * logic above. It deliberately excludes evidence with an UNDETERMINED
 * (unknown) temporal basis — that is the pre-existing, distinct
 * EFFECTIVE_DATE_UNKNOWN condition each caller already detects on its own.
 */
export function e85TemporallyExcludedOnly<T>(items: readonly E85Evidence<T>[], context: E85ApplicabilityContext, asOfDate: string): readonly E85Evidence<T>[] {
  const partition = partitionE85EvidenceByApplicability(items, context);
  const status = (ev: E85Evidence<T>) => evaluateTemporalApplicability(ev.temporal, asOfDate);
  const excluded = partition.applies.filter((ev) => status(ev) === "NOT_YET_EFFECTIVE" || status(ev) === "EXPIRED");
  const live = partition.applies.some((ev) => status(ev) === "APPLIES");
  const unresolvedBasis = partition.applies.some((ev) => status(ev) === "UNDETERMINED");
  return live || unresolvedBasis ? [] : excluded;
}

/**
 * Builds the GAP finding for the CURRENT-ONLY anti-look-ahead condition: every
 * scope-applicable value for `field` is proven to govern this proposal, but
 * none is in force as of `asOfDate` and no historical predecessor is
 * structured. A family evaluator calls this only after its own selection
 * already produced no finding and no applicable evidence — `excluded` must be
 * the result of `e85TemporallyExcludedOnly`, and an empty `excluded` means
 * this condition does not hold (caller should not call this function then).
 */
export function e85HistoricalRuleNotStructuredGap<T>(family: E85RuleFamily, field: string, excluded: readonly E85Evidence<T>[], asOfDate: string): E85EvaluationFinding {
  const notYetEffective = excluded.filter((ev) => evaluateTemporalApplicability(ev.temporal, asOfDate) === "NOT_YET_EFFECTIVE").length;
  const expired = excluded.length - notYetEffective;
  return {
    family,
    field,
    outcome: "GAP",
    gap: {
      reasonCode: "RULE_NOT_STRUCTURED",
      reason:
        `${field}: ${excluded.length} scope-applicable rule value(s) exist for this proposal, but none is in force as of ${asOfDate} ` +
        `(${notYetEffective} not yet effective, ${expired} expired). E85's fact model is CURRENT-ONLY: no historical predecessor rule is structured for this date, ` +
        `so the current value cannot be assumed to have applied earlier and no historical value is available. This is an absence of structured rule content for the requested date, not an absence of law.`,
      sourcesChecked: sortedUnique(excluded.map((ev) => ev.provenance.sourceId)),
      checkedAt: new Date().toISOString(),
      resolutionHint: "Structure the historical predecessor evidence in force on the requested date, if it is needed, or query a date on/after the current rule's effectiveFrom.",
    },
  };
}

/** The audit to attach to a RESOLVED finding whose value came from scoped evidence; undefined for unscoped evidence, so ordinary findings carry no extra noise. */
export function e85ResolvedApplicabilityAudit(evidence: E85Evidence<unknown>): E85FindingApplicabilityAudit | undefined {
  const key = canonicalE85ApplicabilityKey(evidence.applicability);
  return key === "" ? undefined : { applicabilityKeys: [key], outcome: "APPLIES" };
}

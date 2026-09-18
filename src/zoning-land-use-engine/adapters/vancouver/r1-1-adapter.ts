/**
 * InvestScape™ E85 Phase 5 — Vancouver R1-1 pilot adapter.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * ONE jurisdiction, ONE schedule, ONE zone. This adapter exists to prove the
 * Phase 5 architecture end-to-end against a real document, not to provide
 * Vancouver zoning coverage — the R1-1 schedule states considerably more than
 * this normalizes, and every other Vancouver district is unsupported.
 *
 * Nothing here evaluates a parcel, judges feasibility, computes massing,
 * fetches anything, or reads a file. It converts structured facts someone else
 * extracted into generic `E85RuleRecord`s, and reports a finding for every
 * fact it could not convert. Its output is consumed by Phase 4's
 * `evaluateZoningAndLandUse`, which has no idea Vancouver exists.
 *
 * PHASE 12B.2 — SCOPED FACTS. The R1-1 schedule states many concepts more than
 * once for different kinds of development (§3.1 multiple dwellings, §3.2 all
 * other uses). A fact's source-vocabulary scope is mapped here onto generic
 * `E85RuleApplicability` and attached to the evidence. A scope term with no
 * reviewed mapping, a scope dimension with no source locator, or an invalid
 * scope makes the whole fact unresolved — a scoped statement is never emitted
 * as though it were zone-wide. Scoped values of one field become separate rule
 * records per scope, because one record holds one value per field.
 *
 * DETERMINISM. The adapter never calls `Date.now()`; every timestamp comes
 * from the extract or the caller. Facts are processed in canonical `factId`
 * order, so input array order cannot change the output. Identical facts are
 * collapsed before any rule is emitted, so a doubled extract cannot produce a
 * doubled rule.
 */
import type { E85StructuredSourceDocument, E85StructuredSourceFact } from "../../source-fact-types";
import type { E85SourceDefinition } from "../../source-registry-types";
import { findE85SourceVersion, deriveE85TemporalWindow, describeE85VersionPublication } from "../../source-registry-types";
import type { E85SourceAdapter, E85AdapterIdentity, E85AdapterSupportDecision, E85NormalizationResult, E85NormalizationOptions } from "../../source-adapter-contract";
import { unsupportedReasonToGap } from "../../source-adapter-contract";
import type { E85NormalizedRuleBundle, E85ConditionalRuleRecord, E85BundleQualification } from "../../normalized-bundle-types";
import type { E85NormalizationFinding, E85UnresolvedSourceItem } from "../../normalization-finding-types";
import type { E85RuleRecord, E85UseRule, E85DensityRule, E85DimensionalRule, E85RequirementRule } from "../../rule-family-types";
import type { E85RegulatoryRequirement, E85RequirementItem, E85RequirementQuantity } from "../../regulatory-requirement-types";
import { e85RequirementIdentity, validateE85RequirementItem } from "../../regulatory-requirement";
import { evidenceIdentityKey } from "../../rule-identity";
import type { E85Evidence, E85TemporalWindow } from "../../evidence-types";
import type { E85Provenance } from "../../provenance-types";
import type { E85UsePermission } from "../../use-taxonomy";
import type { E85QualificationTier } from "../../qualification-types";
import type { E85ApplicabilityDimension, E85RuleApplicability } from "../../rule-applicability-types";
import { floorQualificationTiers } from "../../qualification-types";
import { deriveEvidenceQuality } from "../../qualification-derivation";
import { assessE85SourceReadiness } from "../../source-readiness-assessment";
import { canonicalE85ApplicabilityKey, normalizeE85ApplicabilityCodes, validateE85RuleApplicability } from "../../rule-applicability";
import {
  VANCOUVER_JURISDICTION_ID,
  VANCOUVER_R1_1_ZONE,
  VANCOUVER_R1_1_VERSION_ID,
  VANCOUVER_R1_1_SOURCE_ID,
  VANCOUVER_R1_1_ADAPTER_ID,
  VANCOUVER_R1_1_ADAPTER_VERSION,
} from "./r1-1-source";
import {
  mapVancouverUseStatus,
  mapVancouverUseCode,
  mapVancouverConcept,
  mapVancouverBuildingRole,
  mapVancouverTenure,
  convertVancouverUnit,
  mapVancouverRequirement,
  convertVancouverRequirementQuantity,
  VANCOUVER_CONDITIONAL_APPROVAL_AUTHORITY,
} from "./r1-1-terminology";
import type { E85VancouverConceptMapping } from "./r1-1-terminology";

export const VANCOUVER_R1_1_ADAPTER_IDENTITY: E85AdapterIdentity = {
  adapterId: VANCOUVER_R1_1_ADAPTER_ID,
  adapterVersion: VANCOUVER_R1_1_ADAPTER_VERSION,
  jurisdictionId: VANCOUVER_JURISDICTION_ID,
  supportedSourceIds: [VANCOUVER_R1_1_SOURCE_ID],
  supportedVersionIds: [VANCOUVER_R1_1_VERSION_ID],
  supportedZoneDesignations: [VANCOUVER_R1_1_ZONE],
  supportedRuleFamilies: ["USE", "DENSITY", "DIMENSIONAL", "REQUIREMENT"],
};

/**
 * Content identity of a source fact, deliberately EXCLUDING `factId`: two
 * facts stating the same thing from the same place are the same fact however
 * the extractor labelled them, and emitting both would let a repeated read
 * masquerade as corroboration (Phase 5 §21, and the E88 duplicate-observation
 * defect that rule-identity.ts already guards Phase 4 against).
 */
function factContentKey(fact: E85StructuredSourceFact): string {
  const loc = fact.locator;
  return JSON.stringify([
    fact.family,
    fact.zoneDesignation,
    fact.sourceTerm,
    fact.sourceUseTerm ?? null,
    fact.numericValue ?? null,
    fact.textValue ?? null,
    fact.unit ?? null,
    fact.condition ?? null,
    fact.applicability ?? null,
    fact.requirement ?? null,
    loc.bylawOrDocumentId ?? null,
    loc.section ?? null,
    loc.clause ?? null,
    loc.schedule ?? null,
    loc.table ?? null,
    loc.row ?? null,
    loc.page ?? null,
  ]);
}

function byFactId(a: E85StructuredSourceFact, b: E85StructuredSourceFact): number {
  return a.factId < b.factId ? -1 : a.factId > b.factId ? 1 : 0;
}

function canHandle(document: E85StructuredSourceDocument, source: E85SourceDefinition): E85AdapterSupportDecision {
  const id = VANCOUVER_R1_1_ADAPTER_IDENTITY;
  if (document.jurisdictionId !== id.jurisdictionId) {
    return { supported: false, reason: "JURISDICTION_NOT_SUPPORTED", detail: `This adapter serves ${id.jurisdictionId} only; the extract claims ${document.jurisdictionId}. No cross-municipality fallback is performed.` };
  }
  if (source.jurisdictionId !== id.jurisdictionId) {
    return { supported: false, reason: "JURISDICTION_MISMATCH", detail: `Registered source "${source.sourceId}" belongs to ${source.jurisdictionId}, not ${id.jurisdictionId}.` };
  }
  if (!id.supportedSourceIds.includes(document.sourceId)) {
    return { supported: false, reason: "SOURCE_NOT_SUPPORTED", detail: `This adapter reads ${id.supportedSourceIds.join(", ")} only; the extract came from "${document.sourceId}".` };
  }
  if (!id.supportedZoneDesignations.includes(document.zoneDesignation)) {
    return {
      supported: false,
      reason: "ZONE_NOT_SUPPORTED",
      detail:
        `Zone "${document.zoneDesignation}" is named by the extract and is not in doubt; this adapter simply has no normalizer for it, covering ${id.supportedZoneDesignations.join(", ")} only. ` +
        `Site-specific and other district zones are not generalized from the R1-1 pattern — this is an absence of structured rules, not an absence of zoning.`,
    };
  }
  if (!id.supportedVersionIds.includes(document.versionId)) {
    return {
      supported: false,
      reason: "VERSION_NOT_SUPPORTED",
      detail: `This adapter is verified against consolidation(s) ${id.supportedVersionIds.join(", ")}; the extract claims "${document.versionId}", which is not adapted as though it were a verified consolidation.`,
    };
  }
  return { supported: true };
}

/** One normalized numeric value awaiting placement into a rule record. */
interface ScopedScalar {
  mapping: E85VancouverConceptMapping;
  evidence: E85Evidence<number>;
  scopeKey: string;
}

type ScopeMapping = { ok: true; applicability?: E85RuleApplicability; scopeKey: string } | { ok: false; message: string; code: E85NormalizationFinding["code"]; reasonCode: "RULE_NOT_STRUCTURED" | "USE_CLASSIFICATION_UNKNOWN" };

/**
 * Maps a fact's source-vocabulary scope onto generic applicability. Refuses —
 * rather than drops — anything it cannot map or source: dropping a scope
 * dimension would silently widen the rule.
 */
function mapFactApplicability(fact: E85StructuredSourceFact): ScopeMapping {
  const scope = fact.applicability;
  if (scope === undefined) return { ok: true, scopeKey: "" };

  const unmapped: string[] = [];
  const mapTerms = (terms: readonly string[] | undefined, mapper: (t: string) => string | undefined, label: string): string[] | undefined => {
    if (terms === undefined) return undefined;
    const out: string[] = [];
    for (const term of terms) {
      const code = mapper(term);
      if (code === undefined) unmapped.push(`${label} "${term}"`);
      else out.push(code);
    }
    return out;
  };

  const applicability: E85RuleApplicability = {
    ...(scope.useTerms === undefined ? {} : { useCodes: mapTerms(scope.useTerms, mapVancouverUseCode, "use") }),
    ...(scope.excludedUseTerms === undefined ? {} : { excludedUseCodes: mapTerms(scope.excludedUseTerms, mapVancouverUseCode, "use") }),
    ...(scope.dwellingUnits === undefined ? {} : { dwellingUnits: scope.dwellingUnits }),
    ...(scope.buildingRoleTerms === undefined ? {} : { buildingRoles: mapTerms(scope.buildingRoleTerms, mapVancouverBuildingRole, "building role") }),
    ...(scope.excludedBuildingRoleTerms === undefined ? {} : { excludedBuildingRoles: mapTerms(scope.excludedBuildingRoleTerms, mapVancouverBuildingRole, "building role") }),
    ...(scope.siteAreaSqm === undefined ? {} : { siteAreaSqm: scope.siteAreaSqm }),
    ...(scope.frontageMetres === undefined ? {} : { frontageMetres: scope.frontageMetres }),
    ...(scope.tenureTerms === undefined ? {} : { tenureCodes: mapTerms(scope.tenureTerms, mapVancouverTenure, "tenure") }),
    ...(scope.excludedTenureTerms === undefined ? {} : { excludedTenureCodes: mapTerms(scope.excludedTenureTerms, mapVancouverTenure, "tenure") }),
    ...(scope.conditionIds === undefined ? {} : { requiredConditionIds: scope.conditionIds }),
    ...(scope.locators === undefined ? {} : { locators: scope.locators }),
  };

  if (unmapped.length > 0) {
    const useProblem = unmapped.some((u) => u.startsWith("use "));
    return {
      ok: false,
      code: "UNSUPPORTED_SOURCE_CONCEPT",
      reasonCode: useProblem ? "USE_CLASSIFICATION_UNKNOWN" : "RULE_NOT_STRUCTURED",
      message: `Fact "${fact.factId}" is scoped by ${unmapped.join(", ")}, which this adapter has no reviewed mapping for. The fact is not emitted, because emitting it without that scope would widen the rule beyond what the source states.`,
    };
  }

  const problems = validateE85RuleApplicability(applicability);
  if (problems.length > 0) {
    return { ok: false, code: "AMBIGUOUS_SOURCE_INTERPRETATION", reasonCode: "RULE_NOT_STRUCTURED", message: `Fact "${fact.factId}" carries an invalid scope: ${problems.join(" ")}` };
  }

  const present: E85ApplicabilityDimension[] = [];
  const codeDims: [E85ApplicabilityDimension, readonly string[] | undefined][] = [
    ["useCodes", applicability.useCodes],
    ["excludedUseCodes", applicability.excludedUseCodes],
    ["buildingRoles", applicability.buildingRoles],
    ["excludedBuildingRoles", applicability.excludedBuildingRoles],
    ["tenureCodes", applicability.tenureCodes],
    ["excludedTenureCodes", applicability.excludedTenureCodes],
    ["requiredConditionIds", applicability.requiredConditionIds],
  ];
  for (const [d, codes] of codeDims) if (normalizeE85ApplicabilityCodes(codes).length > 0) present.push(d);
  for (const d of ["dwellingUnits", "siteAreaSqm", "frontageMetres"] as const) {
    const b = applicability[d];
    if (b !== undefined && (b.min !== undefined || b.max !== undefined)) present.push(d);
  }
  const unsourced = present.filter((d) => applicability.locators?.[d] === undefined);
  if (unsourced.length > 0) {
    return {
      ok: false,
      code: "MISSING_REQUIRED_VALUE",
      reasonCode: "RULE_NOT_STRUCTURED",
      message: `Fact "${fact.factId}" states a scope with no source locator for ${unsourced.join(", ")}. Scope is itself a legal assertion, and a source-free scope is not emitted.`,
    };
  }

  const scopeKey = canonicalE85ApplicabilityKey(applicability);
  return scopeKey === "" ? { ok: true, scopeKey } : { ok: true, applicability, scopeKey };
}

function normalize(document: E85StructuredSourceDocument, source: E85SourceDefinition, options?: E85NormalizationOptions): E85NormalizationResult {
  const normalizedAt = options?.normalizedAt ?? document.extractedAt;

  const decision = canHandle(document, source);
  if (!decision.supported) {
    return { outcome: "UNSUPPORTED", reason: decision.reason, detail: decision.detail, gap: unsupportedReasonToGap(decision.reason, decision.detail, [document.sourceId], normalizedAt) };
  }

  const version = findE85SourceVersion(source, document.versionId);
  // The window comes from the shared derivation, which carries an effective
  // date only when the registry states one. It does NOT fall back to the
  // consolidation/publication stamp: which text was read and when its rules
  // took effect are different facts, and this adapter is not entitled to turn
  // the first into the second (Phase 5A).
  const temporal: E85TemporalWindow = deriveE85TemporalWindow(version);
  const publicationNote = describeE85VersionPublication(version);

  const findings: E85NormalizationFinding[] = [];
  const unresolved: E85UnresolvedSourceItem[] = [];
  const conditionalRules: E85ConditionalRuleRecord[] = [];
  const qualityTiers: E85QualificationTier[] = [];
  const applicabilityTiers: E85QualificationTier[] = [];

  const baseProvenance = (fact: E85StructuredSourceFact, interpretationNote?: string): E85Provenance => ({
    sourceId: source.sourceId,
    sourceVersionId: document.versionId,
    adapterId: VANCOUVER_R1_1_ADAPTER_ID,
    adapterVersion: VANCOUVER_R1_1_ADAPTER_VERSION,
    documentLocator: {
      bylawOrDocumentId: source.document.bylawOrDocumentId,
      schedule: source.document.schedule,
      ...fact.locator,
    },
    zoneDesignation: fact.zoneDesignation,
    // Describes the PUBLICATION stamp at whatever precision the source printed
    // it, and says so. It is not a claim about when the provision took effect —
    // that lives in `temporal`, and is UNKNOWN whenever the source states none.
    effectiveDateBasisNote: publicationNote,
    ...(fact.temporalAuthority === undefined ? {} : { temporalAuthority: fact.temporalAuthority }),
    url: version?.url ?? source.url,
    interpretationNote,
    retrievedAt: document.extractedAt,
  });

  const addGap = (fact: E85StructuredSourceFact, code: E85NormalizationFinding["code"], reasonCode: Parameters<typeof gapRecord>[0], message: string, hint?: string): void => {
    findings.push({ code, severity: "GAP", factId: fact.factId, sourceTerm: fact.sourceTerm, message, gap: gapRecord(reasonCode, message, hint) });
    unresolved.push({ factId: fact.factId, sourceTerm: fact.sourceTerm, code, reason: message });
  };

  function gapRecord(reasonCode: "RULE_NOT_STRUCTURED" | "USE_CLASSIFICATION_UNKNOWN" | "ZONING_AMBIGUOUS", reason: string, resolutionHint?: string) {
    return { reasonCode, reason, sourcesChecked: [source.sourceId], checkedAt: normalizedAt, resolutionHint };
  }

  // Canonical order + content-level de-duplication, both before any rule is emitted.
  const ordered = [...document.facts].sort(byFactId);
  const seenContent = new Map<string, string>();
  const facts: E85StructuredSourceFact[] = [];
  for (const fact of ordered) {
    const key = factContentKey(fact);
    const firstFactId = seenContent.get(key);
    if (firstFactId !== undefined) {
      findings.push({
        code: "DUPLICATE_SOURCE_FACT_IGNORED",
        severity: "INFO",
        factId: fact.factId,
        sourceTerm: fact.sourceTerm,
        message: `Fact "${fact.factId}" is identical in content and locator to "${firstFactId}" and was normalized once only, so a repeated read cannot act as corroboration.`,
      });
      continue;
    }
    seenContent.set(key, fact.factId);
    facts.push(fact);
  }

  const permissions: E85Evidence<E85UsePermission>[] = [];
  const scalars: ScopedScalar[] = [];
  const requirementItems: E85RequirementItem[] = [];
  // PHASE 12C.2 — facts that fell back to the source version's own temporal
  // window because they carry no proven window of their own. Collected so the
  // bundle-level EFFECTIVE_DATE_UNKNOWN gap below names exactly which facts it
  // covers, rather than (now inaccurately) claiming the whole bundle is undated
  // once some facts carry a proven `temporal`.
  const undatedFactIds: string[] = [];

  for (const fact of facts) {
    if (fact.zoneDesignation !== document.zoneDesignation) {
      addGap(
        fact,
        "AMBIGUOUS_SOURCE_INTERPRETATION",
        "ZONING_AMBIGUOUS",
        `Fact "${fact.factId}" states zone "${fact.zoneDesignation}" inside an extract scoped to "${document.zoneDesignation}"; it is not attributed to either zone.`,
        "Re-extract the fact into an extract scoped to its own zone.",
      );
      continue;
    }

    if (!VANCOUVER_R1_1_ADAPTER_IDENTITY.supportedRuleFamilies.includes(fact.family)) {
      // Includes PARKING: Phase 3B verified the Vancouver Parking By-law's
      // section structure only, never its quantitative tables, so this adapter
      // has no validated numbers and will not invent any.
      addGap(
        fact,
        "UNSUPPORTED_SOURCE_CONCEPT",
        "RULE_NOT_STRUCTURED",
        `Rule family ${fact.family} is not normalized by this adapter (supports ${VANCOUVER_R1_1_ADAPTER_IDENTITY.supportedRuleFamilies.join(", ")}). ` +
          `No value is produced for "${fact.sourceTerm}".`,
        fact.family === "PARKING" ? "Vancouver parking/loading/bicycle ratios have not been validated from primary source and are deliberately not encoded." : undefined,
      );
      continue;
    }

    const scope = mapFactApplicability(fact);
    if (!scope.ok) {
      addGap(fact, scope.code, scope.reasonCode, scope.message, "Add a reviewed mapping for the scope term, or supply the source locator for every scope dimension.");
      continue;
    }
    const scoped = scope.applicability === undefined ? {} : { applicability: scope.applicability };
    const scopeNote = scope.scopeKey === "" ? "" : ` Scope: {${scope.scopeKey}}.`;

    // PHASE 12C.2A — an extractor's note is audit context, never silently
    // dropped: the contract on `E85StructuredSourceFact.notes` has always
    // promised it "surfaces as an adapter finding", but nothing here actually
    // did that until now. INFO severity only: a note is never itself grounds
    // to change a fact's outcome (a fact whose note describes a real problem
    // must still fail through one of the ordinary gap paths above/below).
    if (fact.notes !== undefined && fact.notes.trim() !== "") {
      findings.push({
        code: "SOURCE_NOTE_PRESERVED",
        severity: "INFO",
        factId: fact.factId,
        sourceTerm: fact.sourceTerm,
        message: `Extractor's note on fact "${fact.factId}": ${fact.notes}`,
      });
    }

    // PHASE 12C.2 — a fact's own proven legal window takes precedence over the
    // document version's bundle-wide window; absence falls back exactly as
    // every earlier phase behaved, so a bundle may mix dated and undated facts
    // without one date leaking onto the other's evidence.
    const factTemporal: E85TemporalWindow = fact.temporal ?? temporal;
    if (fact.temporal !== undefined && fact.temporal.effectiveDateBasis !== "UNKNOWN") {
      findings.push({
        code: "TERM_MAPPED_EXACT",
        severity: "INFO",
        factId: fact.factId,
        sourceTerm: fact.sourceTerm,
        message: `Fact "${fact.factId}" carries its own proven effective date (${fact.temporal.effectiveFrom ?? "no effectiveFrom"}, basis ${fact.temporal.effectiveDateBasis}), distinct from source version "${document.versionId}"'s ${temporal.effectiveDateBasis === "UNKNOWN" ? "unknown" : "own"} temporal basis.`,
      });
    } else if (factTemporal.effectiveDateBasis === "UNKNOWN") {
      undatedFactIds.push(fact.factId);
    }

    if (fact.family === "USE") {
      const status = mapVancouverUseStatus(fact.sourceTerm);
      if (status === undefined) {
        addGap(
          fact,
          "UNSUPPORTED_SOURCE_CONCEPT",
          "USE_CLASSIFICATION_UNKNOWN",
          `Approval-path term "${fact.sourceTerm}" has no reviewed mapping in this adapter, so it is not resolved to PERMITTED, CONDITIONAL, or PROHIBITED. No status is guessed.`,
          "Add a reviewed mapping for this term after confirming its meaning against the by-law.",
        );
        continue;
      }
      if (fact.sourceUseTerm === undefined) {
        addGap(fact, "MISSING_REQUIRED_VALUE", "USE_CLASSIFICATION_UNKNOWN", `Fact "${fact.factId}" states approval path "${fact.sourceTerm}" but names no land use, so there is nothing to attach the status to.`);
        continue;
      }
      const useCode = mapVancouverUseCode(fact.sourceUseTerm);
      if (useCode === undefined) {
        addGap(
          fact,
          "UNSUPPORTED_SOURCE_CONCEPT",
          "USE_CLASSIFICATION_UNKNOWN",
          `Land use "${fact.sourceUseTerm}" has no reviewed E85 use code in this adapter; it is not approximated to a similar-sounding use.`,
          "Add a reviewed vocabulary mapping for this use name.",
        );
        continue;
      }
      const provenance = baseProvenance(fact);
      const permission: E85UsePermission = {
        useCode,
        status,
        rawSourceTerminology: fact.sourceTerm,
        ...(status === "CONDITIONAL" ? { approvalAuthority: VANCOUVER_CONDITIONAL_APPROVAL_AUTHORITY } : {}),
        ...(fact.condition ? { conditionsNote: fact.condition } : {}),
      };
      permissions.push({ value: permission, provenance, temporal: factTemporal, ...scoped });
      qualityTiers.push(deriveEvidenceQuality(provenance));
      applicabilityTiers.push(fact.condition ? "moderate" : "high");
      findings.push({
        code: "TERM_MAPPED_EXACT",
        severity: "INFO",
        factId: fact.factId,
        sourceTerm: fact.sourceTerm,
        message: `"${fact.sourceTerm}" for "${fact.sourceUseTerm}" mapped to ${status} (use code "${useCode}"); source wording preserved on the permission.${scopeNote}`,
      });
      continue;
    }

    if (fact.family === "REQUIREMENT") {
      // Phase 12B.4. The obligation, its trigger (applicability) and any stated
      // quantity each become evidence. Nothing the source does not state is
      // added: no election actor, no amount for a rate held in another instrument.
      const mapping = mapVancouverRequirement(fact.sourceTerm);
      if (mapping === undefined) {
        addGap(
          fact,
          "UNSUPPORTED_SOURCE_CONCEPT",
          "RULE_NOT_STRUCTURED",
          `Requirement term "${fact.sourceTerm}" has no reviewed mapping in this adapter; no obligation is inferred from similar wording.`,
          "Add a reviewed mapping for this obligation after confirming its meaning against the by-law.",
        );
        continue;
      }
      if (fact.condition !== undefined) {
        addGap(
          fact,
          "AMBIGUOUS_SOURCE_INTERPRETATION",
          "RULE_NOT_STRUCTURED",
          `Requirement "${fact.sourceTerm}" carries a free-text condition ("${fact.condition}"). A requirement's trigger must be structured applicability, so the obligation is not emitted.`,
          "Restate the condition as structured applicability.",
        );
        continue;
      }
      const spec = fact.requirement ?? {};
      let quantity: E85Evidence<E85RequirementQuantity> | undefined;
      if (fact.numericValue !== undefined) {
        if (mapping.quantityKind === undefined) {
          addGap(fact, "UNIT_UNSUPPORTED_FOR_CONCEPT", "RULE_NOT_STRUCTURED", `"${fact.sourceTerm}" states the number ${fact.numericValue}, but this adapter has no reviewed quantity kind for that obligation; the number is not attached to it.`);
          continue;
        }
        const converted = fact.unit === undefined ? { ok: false as const } : convertVancouverRequirementQuantity(mapping, fact.numericValue, fact.unit);
        if (!converted.ok) {
          addGap(fact, "UNIT_UNSUPPORTED_FOR_CONCEPT", "RULE_NOT_STRUCTURED", `Unit ${fact.unit ?? "(none)"} is not accepted for "${fact.sourceTerm}" (accepts ${mapping.acceptedQuantityUnits.join(", ")}); no conversion is attempted.`);
          continue;
        }
        if (spec.quantityBasisTerm === undefined || spec.quantityBasisTerm.trim() === "") {
          addGap(fact, "MISSING_REQUIRED_VALUE", "RULE_NOT_STRUCTURED", `"${fact.sourceTerm}" states ${fact.numericValue} ${fact.unit} but no basis it is a share of; a share of an unnamed quantity is not emitted.`, "Re-extract the basis the source names for this quantity.");
          continue;
        }
        quantity = {
          value: { kind: mapping.quantityKind, value: converted.value, basisTerm: spec.quantityBasisTerm },
          provenance: baseProvenance(fact, converted.policyApplied),
          temporal: factTemporal,
          ...scoped,
        };
      }
      const requirement: E85RegulatoryRequirement = {
        category: mapping.category,
        requirementCode: mapping.requirementCode,
        obligationKind: mapping.obligationKind,
        rawSourceTerminology: fact.sourceTerm,
        ...(spec.choiceGroup === undefined ? {} : { choice: { choiceGroupId: spec.choiceGroup.groupId, mode: spec.choiceGroup.mode } }),
        // This extract structures no referenced instrument, so every reference is unstructured.
        ...(spec.references === undefined || spec.references.length === 0
          ? {}
          : { instrumentReferences: spec.references.map((r) => ({ role: r.role, target: r.target, description: r.description, structured: false })) }),
      };
      const provenance = baseProvenance(fact);
      const item: E85RequirementItem = { requirement: { value: requirement, provenance, temporal: factTemporal, ...scoped }, ...(quantity === undefined ? {} : { quantities: [quantity] }) };
      const problems = validateE85RequirementItem(item);
      if (problems.length > 0) {
        addGap(fact, "AMBIGUOUS_SOURCE_INTERPRETATION", "RULE_NOT_STRUCTURED", `Requirement fact "${fact.factId}" cannot be emitted: ${problems.join(" ")}`);
        continue;
      }
      requirementItems.push(item);
      qualityTiers.push(deriveEvidenceQuality(provenance));
      applicabilityTiers.push("high");
      const unstructuredReferences = (requirement.instrumentReferences ?? []).filter((r) => !r.structured);
      findings.push({
        code: quantity?.provenance.interpretationNote ? "TERM_MAPPED_BY_JURISDICTION_POLICY" : "TERM_MAPPED_EXACT",
        severity: "INFO",
        factId: fact.factId,
        sourceTerm: fact.sourceTerm,
        message:
          `"${fact.sourceTerm}" mapped to REQUIREMENT ${e85RequirementIdentity(requirement)} (${requirement.obligationKind})` +
          (quantity === undefined
            ? ", with no structured quantity"
            : `, ${quantity.value.kind} = ${quantity.value.value} of "${quantity.value.basisTerm}"${quantity.provenance.interpretationNote ? ` (${quantity.provenance.interpretationNote} Source stated ${fact.numericValue} ${fact.unit}.)` : ""}`) +
          (requirement.choice === undefined ? "" : `; one alternative of ${requirement.choice.mode} choice "${requirement.choice.choiceGroupId}"`) +
          (unstructuredReferences.length === 0 ? "" : `; depends on ${unstructuredReferences.map((r) => `${r.description} [${r.role}]`).join(", ")}, located and NOT structured by this extract`) +
          `.${scopeNote}`,
      });
      continue;
    }

    // DENSITY / DIMENSIONAL
    const mapping = mapVancouverConcept(fact.sourceTerm);
    if (mapping === undefined) {
      addGap(
        fact,
        "UNSUPPORTED_SOURCE_CONCEPT",
        "RULE_NOT_STRUCTURED",
        `Source term "${fact.sourceTerm}" has no reviewed mapping in this adapter; it is not matched approximately to a similar concept.`,
        "Add a reviewed mapping for this term after confirming what the by-law means by it.",
      );
      continue;
    }
    if (mapping.family !== fact.family) {
      addGap(
        fact,
        "AMBIGUOUS_SOURCE_INTERPRETATION",
        "RULE_NOT_STRUCTURED",
        `Fact "${fact.factId}" is labelled family ${fact.family} but "${fact.sourceTerm}" maps to ${mapping.family}; the contradiction is reported rather than resolved by preferring either.`,
      );
      continue;
    }
    if (fact.numericValue === undefined) {
      addGap(
        fact,
        "MISSING_REQUIRED_VALUE",
        "RULE_NOT_STRUCTURED",
        `"${fact.sourceTerm}" requires a numeric value and the extract states none. No value is produced — absence is never read as 0 or as "unlimited".`,
        "Re-extract this fact with the number the source states, or confirm the source states none.",
      );
      continue;
    }
    if (fact.unit === undefined) {
      addGap(fact, "UNIT_UNSUPPORTED_FOR_CONCEPT", "RULE_NOT_STRUCTURED", `"${fact.sourceTerm}" states value ${fact.numericValue} with no unit; the unit is not inferred from the concept.`);
      continue;
    }
    const converted = convertVancouverUnit(mapping, fact.numericValue, fact.unit);
    if (!converted.ok) {
      addGap(fact, "UNIT_UNSUPPORTED_FOR_CONCEPT", "RULE_NOT_STRUCTURED", `Unit ${fact.unit} is not accepted for "${fact.sourceTerm}" (accepts ${mapping.acceptedUnits.join(", ")}); no conversion is attempted.`);
      continue;
    }

    const provenance = baseProvenance(fact, converted.policyApplied);
    const evidence: E85Evidence<number> = { value: converted.value, provenance, temporal: factTemporal, ...scoped };
    qualityTiers.push(deriveEvidenceQuality(provenance));
    applicabilityTiers.push(fact.condition ? "moderate" : "high");

    findings.push({
      code: converted.policyApplied ? "TERM_MAPPED_BY_JURISDICTION_POLICY" : "TERM_MAPPED_EXACT",
      severity: "INFO",
      factId: fact.factId,
      sourceTerm: fact.sourceTerm,
      message:
        (converted.policyApplied
          ? `"${fact.sourceTerm}" mapped to ${mapping.family}.${mapping.field}. ${converted.policyApplied} Source stated ${fact.numericValue} ${fact.unit}.`
          : `"${fact.sourceTerm}" mapped to ${mapping.family}.${mapping.field} = ${converted.value} (${fact.unit}), value unchanged.`) + scopeNote,
    });

    if (fact.condition !== undefined) {
      // Condition-dependent values never enter the unconditional rule set, so
      // Phase 4 cannot apply one without the caller affirming it, and the
      // adapter never gets to pick whichever value is more favourable.
      conditionalRules.push({ condition: fact.condition, sourceFactId: fact.factId, rule: buildSingleFieldRule(mapping, evidence, document) });
      findings.push({
        code: "CONDITION_PRESERVED",
        severity: "WARNING",
        factId: fact.factId,
        sourceTerm: fact.sourceTerm,
        message: `"${fact.sourceTerm}" = ${converted.value} applies only when: "${fact.condition}". Held out of the unconditional rule set; it enters an evaluation only if a caller affirms that exact condition.`,
      });
      continue;
    }

    scalars.push({ mapping, evidence, scopeKey: scope.scopeKey });
  }

  for (const section of document.unstructuredSections ?? []) {
    const message = `Section "${section}" of ${source.displayName} is known to exist but was not structured by this extract, so any rule it states is absent rather than nonexistent.`;
    findings.push({
      code: "SOURCE_SECTION_UNAVAILABLE",
      severity: "GAP",
      message,
      gap: { reasonCode: "RULE_NOT_STRUCTURED", reason: message, sourcesChecked: [source.sourceId], checkedAt: normalizedAt, resolutionHint: "Extract this section to make its rules available." },
    });
  }

  if (version === undefined) {
    findings.push({
      code: "SOURCE_VERSION_INCOMPLETE",
      severity: "WARNING",
      message: `Version "${document.versionId}" is accepted by the adapter but is not among the registry's registered versions for "${source.sourceId}", so its publication/consolidation dates are unknown and the bundle's temporal basis is UNKNOWN.`,
    });
  }

  // An UNKNOWN temporal basis is reported as a real gap, exactly as the basis
  // enum requires ("always paired with an EFFECTIVE_DATE_UNKNOWN data gap").
  // Normalization still succeeds and every rule still carries full provenance —
  // what is withheld is the claim that these rules were in force on a given
  // date, which the source never made. Phase 4 sees UNDETERMINED applicability
  // and reports it, rather than being handed a manufactured date that would
  // silently evaluate as MACHINE_RESOLVED.
  //
  // PHASE 12C.2 — this fires only for the facts that actually fell back to the
  // version's own UNKNOWN basis (`undatedFactIds`), not unconditionally on the
  // version's basis: some facts now carry their own proven `temporal` and must
  // not be reported as undated merely because the DOCUMENT's own publication
  // stamp is not a legal effective date.
  if (undatedFactIds.length > 0) {
    const message =
      `No effective date is established for "${source.sourceId}" version "${document.versionId}"` +
      (version?.consolidationPeriod ? `, which carries a ${version.consolidationPeriod} publication stamp at month precision and no day` : "") +
      `. The source version identifies WHICH TEXT was read; it does not state when the provisions took legal effect, and no date is inferred from it. ` +
      `${undatedFactIds.length} fact(s) carry no proven amendment-instrument date of their own and therefore fall back to this unknown basis: ${[...undatedFactIds].sort().join(", ")}.`;
    findings.push({
      code: "SOURCE_VERSION_INCOMPLETE",
      severity: "GAP",
      message,
      gap: {
        reasonCode: "EFFECTIVE_DATE_UNKNOWN",
        reason: message,
        sourcesChecked: [source.sourceId],
        checkedAt: normalizedAt,
        resolutionHint: "Establish the provisions' effective date from an authoritative statement (enactment/adoption record or an explicit in-force date) and register it as `effectiveFrom` on this version, or on the individual fact's own `temporal` when only that fact's date is known.",
      },
    });
  }

  const rules: E85RuleRecord[] = [];
  if (permissions.length > 0) {
    const useRule: E85UseRule = { family: "USE", jurisdictionId: document.jurisdictionId, zoneDesignation: document.zoneDesignation, permissions };
    rules.push(useRule);
  }
  rules.push(...buildScopedRules("DENSITY", scalars, document));
  rules.push(...buildScopedRules("DIMENSIONAL", scalars, document));
  rules.push(...buildRequirementRules(requirementItems, document));

  const qualification: E85BundleQualification = {
    evidenceQuality: qualityTiers.length > 0 ? floorQualificationTiers(...qualityTiers) : "low",
    ruleApplicability: applicabilityTiers.length > 0 ? floorQualificationTiers(...applicabilityTiers) : "low",
  };

  const readiness = assessE85SourceReadiness({
    source,
    sourceId: source.sourceId,
    versionId: document.versionId,
    zoneDesignation: document.zoneDesignation,
    structureSupport: (document.unstructuredSections ?? []).length > 0 ? "SECTION_NOT_STRUCTURED" : "STRUCTURED",
  });

  const bundle: E85NormalizedRuleBundle = {
    sourceId: source.sourceId,
    sourceVersionId: document.versionId,
    jurisdictionId: document.jurisdictionId,
    zoneDesignation: document.zoneDesignation,
    temporal,
    rules,
    conditionalRules,
    findings,
    unresolvedSourceItems: unresolved,
    readiness,
    qualification,
    provenance: {
      sourceId: source.sourceId,
      sourceVersionId: document.versionId,
      adapterId: VANCOUVER_R1_1_ADAPTER_ID,
      adapterVersion: VANCOUVER_R1_1_ADAPTER_VERSION,
      documentLocator: { bylawOrDocumentId: source.document.bylawOrDocumentId, schedule: source.document.schedule },
      zoneDesignation: document.zoneDesignation,
      url: version?.url ?? source.url,
      retrievedAt: document.extractedAt,
    },
    adapterId: VANCOUVER_R1_1_ADAPTER_ID,
    adapterVersion: VANCOUVER_R1_1_ADAPTER_VERSION,
    normalizedAt,
  };

  return { outcome: "NORMALIZED", bundle };
}

/** The slot a value occupies in a rule record; two values competing for one slot in one scope go into separate records rather than one silently overwriting the other. */
function slotOf(mapping: E85VancouverConceptMapping): string {
  return mapping.field === "setback" ? `setback:${mapping.yardName}` : mapping.field;
}

/**
 * Builds rule records for one family: unscoped values first, then one group per
 * scope key in code-unit order. Within a group, values are placed into the first
 * record whose slot is still free, in canonical fact order.
 */
function buildScopedRules(family: "DENSITY" | "DIMENSIONAL", scalars: readonly ScopedScalar[], document: E85StructuredSourceDocument): E85RuleRecord[] {
  const base = { jurisdictionId: document.jurisdictionId, zoneDesignation: document.zoneDesignation };
  const ofFamily = scalars.filter((s) => s.mapping.family === family);
  const scopeKeys = [...new Set(ofFamily.map((s) => s.scopeKey))].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const rules: E85RuleRecord[] = [];
  for (const scopeKey of scopeKeys) {
    const records: Map<string, E85Evidence<number>>[] = [];
    for (const s of ofFamily.filter((x) => x.scopeKey === scopeKey)) {
      const slot = slotOf(s.mapping);
      let target = records.find((r) => !r.has(slot));
      if (target === undefined) {
        target = new Map();
        records.push(target);
      }
      target.set(slot, s.evidence);
    }
    for (const r of records) {
      if (family === "DENSITY") {
        const densityRule: E85DensityRule = {
          family: "DENSITY",
          ...base,
          ...(r.has("maxFsr") ? { maxFsr: r.get("maxFsr")! } : {}),
          ...(r.has("maxDwellingUnits") ? { maxDwellingUnits: r.get("maxDwellingUnits")! } : {}),
        };
        rules.push(densityRule);
      } else {
        const setbacks: Record<string, E85Evidence<number>> = {};
        for (const [slot, ev] of r) if (slot.startsWith("setback:")) setbacks[slot.slice("setback:".length)] = ev;
        const dimensionalRule: E85DimensionalRule = {
          family: "DIMENSIONAL",
          ...base,
          ...(r.has("maxHeightMetres") ? { maxHeightMetres: r.get("maxHeightMetres")! } : {}),
          ...(r.has("maxStoreys") ? { maxStoreys: r.get("maxStoreys")! } : {}),
          ...(r.has("maxSiteCoverageFraction") ? { maxSiteCoverageFraction: r.get("maxSiteCoverageFraction")! } : {}),
          ...(r.has("minFrontageMetres") ? { minFrontageMetres: r.get("minFrontageMetres")! } : {}),
          ...(Object.keys(setbacks).length > 0 ? { setbacksMetres: setbacks } : {}),
        };
        rules.push(dimensionalRule);
      }
    }
  }
  return rules;
}

/**
 * Builds REQUIREMENT rule records in canonical obligation order (identity, then
 * scope, then evidence identity). An obligation repeated under the same scope
 * from a different place in the source goes into a separate record, so neither
 * statement overwrites the other.
 */
function buildRequirementRules(items: readonly E85RequirementItem[], document: E85StructuredSourceDocument): E85RuleRecord[] {
  const keyOf = (item: E85RequirementItem) => `${e85RequirementIdentity(item.requirement.value)}{${canonicalE85ApplicabilityKey(item.requirement.applicability)}}`;
  const ordered = [...items].sort((a, b) => {
    const ka = `${keyOf(a)}|${evidenceIdentityKey(a.requirement)}`;
    const kb = `${keyOf(b)}|${evidenceIdentityKey(b.requirement)}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  const records: E85RequirementItem[][] = [];
  for (const item of ordered) {
    let target = records.find((r) => !r.some((existing) => keyOf(existing) === keyOf(item)));
    if (target === undefined) {
      target = [];
      records.push(target);
    }
    target.push(item);
  }
  return records.map((requirements): E85RequirementRule => ({ family: "REQUIREMENT", jurisdictionId: document.jurisdictionId, zoneDesignation: document.zoneDesignation, requirements }));
}

/** Builds a one-field rule record for a condition-dependent value, so an affirmed condition contributes exactly that value and nothing more. */
function buildSingleFieldRule(mapping: E85VancouverConceptMapping, evidence: E85Evidence<number>, document: E85StructuredSourceDocument): E85RuleRecord {
  const base = { jurisdictionId: document.jurisdictionId, zoneDesignation: document.zoneDesignation };
  if (mapping.family === "DENSITY") return mapping.field === "maxDwellingUnits" ? { ...base, family: "DENSITY", maxDwellingUnits: evidence } : { ...base, family: "DENSITY", maxFsr: evidence };
  if (mapping.field === "setback") return { ...base, family: "DIMENSIONAL", setbacksMetres: { [mapping.yardName]: evidence } };
  return { ...base, family: "DIMENSIONAL", [mapping.field]: evidence } as E85DimensionalRule;
}

/** The Vancouver R1-1 pilot adapter. Pure, offline, deterministic. */
export const vancouverR11Adapter: E85SourceAdapter = {
  identity: VANCOUVER_R1_1_ADAPTER_IDENTITY,
  canHandle,
  normalize,
};

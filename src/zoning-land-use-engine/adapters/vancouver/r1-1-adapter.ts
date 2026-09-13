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
import type { E85RuleRecord, E85UseRule, E85DensityRule, E85DimensionalRule } from "../../rule-family-types";
import type { E85Evidence, E85TemporalWindow } from "../../evidence-types";
import type { E85Provenance } from "../../provenance-types";
import type { E85UsePermission } from "../../use-taxonomy";
import type { E85QualificationTier } from "../../qualification-types";
import { floorQualificationTiers } from "../../qualification-types";
import { deriveEvidenceQuality } from "../../qualification-derivation";
import { assessE85SourceReadiness } from "../../source-readiness-assessment";
import {
  VANCOUVER_JURISDICTION_ID,
  VANCOUVER_R1_1_ZONE,
  VANCOUVER_R1_1_VERSION_ID,
  VANCOUVER_R1_1_SOURCE_ID,
  VANCOUVER_R1_1_ADAPTER_ID,
  VANCOUVER_R1_1_ADAPTER_VERSION,
} from "./r1-1-source";
import { mapVancouverUseStatus, mapVancouverUseCode, mapVancouverConcept, convertVancouverUnit, VANCOUVER_CONDITIONAL_APPROVAL_AUTHORITY } from "./r1-1-terminology";

export const VANCOUVER_R1_1_ADAPTER_IDENTITY: E85AdapterIdentity = {
  adapterId: VANCOUVER_R1_1_ADAPTER_ID,
  adapterVersion: VANCOUVER_R1_1_ADAPTER_VERSION,
  jurisdictionId: VANCOUVER_JURISDICTION_ID,
  supportedSourceIds: [VANCOUVER_R1_1_SOURCE_ID],
  supportedVersionIds: [VANCOUVER_R1_1_VERSION_ID],
  supportedZoneDesignations: [VANCOUVER_R1_1_ZONE],
  supportedRuleFamilies: ["USE", "DENSITY", "DIMENSIONAL"],
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
  const densityFields: { maxFsr?: E85Evidence<number> } = {};
  const dimensionalFields: {
    maxHeightMetres?: E85Evidence<number>;
    maxStoreys?: E85Evidence<number>;
    maxSiteCoverageFraction?: E85Evidence<number>;
    minFrontageMetres?: E85Evidence<number>;
    setbacksMetres?: Record<string, E85Evidence<number>>;
  } = {};

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
      permissions.push({ value: permission, provenance, temporal });
      qualityTiers.push(deriveEvidenceQuality(provenance));
      applicabilityTiers.push(fact.condition ? "moderate" : "high");
      findings.push({
        code: "TERM_MAPPED_EXACT",
        severity: "INFO",
        factId: fact.factId,
        sourceTerm: fact.sourceTerm,
        message: `"${fact.sourceTerm}" for "${fact.sourceUseTerm}" mapped to ${status} (use code "${useCode}"); source wording preserved on the permission.`,
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
    const evidence: E85Evidence<number> = { value: converted.value, provenance, temporal };
    qualityTiers.push(deriveEvidenceQuality(provenance));
    applicabilityTiers.push(fact.condition ? "moderate" : "high");

    findings.push({
      code: converted.policyApplied ? "TERM_MAPPED_BY_JURISDICTION_POLICY" : "TERM_MAPPED_EXACT",
      severity: "INFO",
      factId: fact.factId,
      sourceTerm: fact.sourceTerm,
      message: converted.policyApplied
        ? `"${fact.sourceTerm}" mapped to ${mapping.family}.${mapping.field}. ${converted.policyApplied} Source stated ${fact.numericValue} ${fact.unit}.`
        : `"${fact.sourceTerm}" mapped to ${mapping.family}.${mapping.field} = ${converted.value} (${fact.unit}), value unchanged.`,
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

    if (mapping.family === "DENSITY") {
      densityFields.maxFsr = evidence;
    } else if (mapping.field === "setback") {
      dimensionalFields.setbacksMetres = { ...(dimensionalFields.setbacksMetres ?? {}), [mapping.yardName]: evidence };
    } else {
      dimensionalFields[mapping.field] = evidence;
    }
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
  if (temporal.effectiveDateBasis === "UNKNOWN") {
    const message =
      `No effective date is established for "${source.sourceId}" version "${document.versionId}"` +
      (version?.consolidationPeriod ? `, which carries a ${version.consolidationPeriod} publication stamp at month precision and no day` : "") +
      `. The source version identifies WHICH TEXT was read; it does not state when the provisions took legal effect, and no date is inferred from it.`;
    findings.push({
      code: "SOURCE_VERSION_INCOMPLETE",
      severity: "GAP",
      message,
      gap: {
        reasonCode: "EFFECTIVE_DATE_UNKNOWN",
        reason: message,
        sourcesChecked: [source.sourceId],
        checkedAt: normalizedAt,
        resolutionHint: "Establish the provisions' effective date from an authoritative statement (enactment/adoption record or an explicit in-force date) and register it as `effectiveFrom` on this version.",
      },
    });
  }

  const rules: E85RuleRecord[] = [];
  if (permissions.length > 0) {
    const useRule: E85UseRule = { family: "USE", jurisdictionId: document.jurisdictionId, zoneDesignation: document.zoneDesignation, permissions };
    rules.push(useRule);
  }
  if (densityFields.maxFsr) {
    const densityRule: E85DensityRule = { family: "DENSITY", jurisdictionId: document.jurisdictionId, zoneDesignation: document.zoneDesignation, maxFsr: densityFields.maxFsr };
    rules.push(densityRule);
  }
  if (
    dimensionalFields.maxHeightMetres ||
    dimensionalFields.maxStoreys ||
    dimensionalFields.maxSiteCoverageFraction ||
    dimensionalFields.minFrontageMetres ||
    dimensionalFields.setbacksMetres
  ) {
    const dimensionalRule: E85DimensionalRule = {
      family: "DIMENSIONAL",
      jurisdictionId: document.jurisdictionId,
      zoneDesignation: document.zoneDesignation,
      ...(dimensionalFields.maxHeightMetres ? { maxHeightMetres: dimensionalFields.maxHeightMetres } : {}),
      ...(dimensionalFields.maxStoreys ? { maxStoreys: dimensionalFields.maxStoreys } : {}),
      ...(dimensionalFields.maxSiteCoverageFraction ? { maxSiteCoverageFraction: dimensionalFields.maxSiteCoverageFraction } : {}),
      ...(dimensionalFields.minFrontageMetres ? { minFrontageMetres: dimensionalFields.minFrontageMetres } : {}),
      ...(dimensionalFields.setbacksMetres ? { setbacksMetres: dimensionalFields.setbacksMetres } : {}),
    };
    rules.push(dimensionalRule);
  }

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

/** Builds a one-field rule record for a condition-dependent value, so an affirmed condition contributes exactly that value and nothing more. */
function buildSingleFieldRule(mapping: NonNullable<ReturnType<typeof mapVancouverConcept>>, evidence: E85Evidence<number>, document: E85StructuredSourceDocument): E85RuleRecord {
  const base = { jurisdictionId: document.jurisdictionId, zoneDesignation: document.zoneDesignation };
  if (mapping.family === "DENSITY") return { ...base, family: "DENSITY", maxFsr: evidence };
  if (mapping.field === "setback") return { ...base, family: "DIMENSIONAL", setbacksMetres: { [mapping.yardName]: evidence } };
  return { ...base, family: "DIMENSIONAL", [mapping.field]: evidence } as E85DimensionalRule;
}

/** The Vancouver R1-1 pilot adapter. Pure, offline, deterministic. */
export const vancouverR11Adapter: E85SourceAdapter = {
  identity: VANCOUVER_R1_1_ADAPTER_IDENTITY,
  canHandle,
  normalize,
};

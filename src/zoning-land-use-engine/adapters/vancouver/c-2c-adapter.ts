/**
 * InvestScape™ E85 Phase 14.4B — Vancouver C-2C pilot adapter.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * A SECOND, DELIBERATELY NARROW Vancouver district. This adapter exists to
 * prove that the SAME generic Phase 4-9 pipeline that already handles R1-1
 * correctly handles a second real source with a genuinely partial family
 * footprint (USE + DIMENSIONAL only — no DENSITY, no REQUIREMENT), including
 * correctly triggering the Phase 14.4A.1 `REQUESTED_FAMILY_NOT_SUPPORTED`
 * coverage blocker when a caller requests an unsupported family against it.
 *
 * It converts structured facts someone else extracted into generic
 * `E85RuleRecord`s and reports a finding for every fact it could not convert
 * — exactly the R1-1 contract, at a fraction of the vocabulary. Nothing here
 * evaluates a parcel, judges feasibility, computes massing, fetches anything,
 * or reads a file.
 *
 * WHAT THIS PILOT DELIBERATELY DOES NOT STRUCTURE (see `c-2c-source.ts`'s
 * `knownLimitations` for the full, reasoned list, and the adapter's own
 * per-normalize source findings below): any FSR/density value, any height or
 * storeys value, any REQUIREMENT, the angular building envelope, the
 * minimum-FSR proviso, the bedroom-mix clause, Sub-Area A, accessory-use
 * percentage caps, maximum unit frontage, the RHS ODP dependency, Retail
 * Store (Section 11 dependency), and the §3.1.2.13/§3.2.2.11 parking-area
 * setback (a real, dated, freestanding value that this adapter still does NOT
 * structure — see the finding below for why).
 *
 * DETERMINISM. The adapter never calls `Date.now()`; every timestamp comes
 * from the extract or the caller. Facts are processed in canonical `factId`
 * order, so input array order cannot change the output. Identical facts are
 * collapsed before any rule is emitted.
 */
import type { E85StructuredSourceDocument, E85StructuredSourceFact } from "../../source-fact-types";
import type { E85SourceDefinition } from "../../source-registry-types";
import { findE85SourceVersion, deriveE85TemporalWindow, describeE85VersionPublication } from "../../source-registry-types";
import type { E85SourceAdapter, E85AdapterIdentity, E85AdapterSupportDecision, E85NormalizationResult, E85NormalizationOptions } from "../../source-adapter-contract";
import { unsupportedReasonToGap } from "../../source-adapter-contract";
import type { E85NormalizedRuleBundle, E85BundleQualification } from "../../normalized-bundle-types";
import type { E85NormalizationFinding, E85UnresolvedSourceItem } from "../../normalization-finding-types";
import type { E85RuleRecord, E85UseRule, E85DimensionalRule } from "../../rule-family-types";
import type { E85Evidence, E85TemporalWindow } from "../../evidence-types";
import type { E85Provenance } from "../../provenance-types";
import type { E85UsePermission } from "../../use-taxonomy";
import type { E85QualificationTier } from "../../qualification-types";
import { floorQualificationTiers } from "../../qualification-types";
import { deriveEvidenceQuality } from "../../qualification-derivation";
import { assessE85SourceReadiness } from "../../source-readiness-assessment";
import { VANCOUVER_JURISDICTION_ID } from "./r1-1-source";
import {
  VANCOUVER_C_2C_ZONE,
  VANCOUVER_C_2C_VERSION_ID,
  VANCOUVER_C_2C_SOURCE_ID,
  VANCOUVER_C_2C_ADAPTER_ID,
  VANCOUVER_C_2C_ADAPTER_VERSION,
  VANCOUVER_C_2C_SUPPORTED_RULE_FAMILIES,
} from "./c-2c-source";
import { VANCOUVER_CONDITIONAL_APPROVAL_AUTHORITY } from "./r1-1-terminology";
import { mapVancouverC2CUseStatus, mapVancouverC2CUseCode, mapVancouverC2CConcept, convertVancouverC2CUnit } from "./c-2c-terminology";

export const VANCOUVER_C_2C_ADAPTER_IDENTITY: E85AdapterIdentity = {
  adapterId: VANCOUVER_C_2C_ADAPTER_ID,
  adapterVersion: VANCOUVER_C_2C_ADAPTER_VERSION,
  jurisdictionId: VANCOUVER_JURISDICTION_ID,
  supportedSourceIds: [VANCOUVER_C_2C_SOURCE_ID],
  supportedVersionIds: [VANCOUVER_C_2C_VERSION_ID],
  supportedZoneDesignations: [VANCOUVER_C_2C_ZONE],
  supportedRuleFamilies: [...VANCOUVER_C_2C_SUPPORTED_RULE_FAMILIES],
};

/** Content identity of a source fact, deliberately EXCLUDING `factId` — same invariant as `r1-1-adapter.ts`. */
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
  const id = VANCOUVER_C_2C_ADAPTER_IDENTITY;
  if (document.jurisdictionId !== id.jurisdictionId) {
    return { supported: false, reason: "JURISDICTION_NOT_SUPPORTED", detail: `This adapter serves ${id.jurisdictionId} only; the extract claims ${document.jurisdictionId}.` };
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
      detail: `Zone "${document.zoneDesignation}" is named by the extract; this adapter has no normalizer for it, covering ${id.supportedZoneDesignations.join(", ")} only.`,
    };
  }
  if (!id.supportedVersionIds.includes(document.versionId)) {
    return {
      supported: false,
      reason: "VERSION_NOT_SUPPORTED",
      detail: `This adapter is verified against consolidation(s) ${id.supportedVersionIds.join(", ")}; the extract claims "${document.versionId}".`,
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
  const temporal: E85TemporalWindow = deriveE85TemporalWindow(version);
  const publicationNote = describeE85VersionPublication(version);

  const findings: E85NormalizationFinding[] = [];
  const unresolved: E85UnresolvedSourceItem[] = [];
  const qualityTiers: E85QualificationTier[] = [];
  const applicabilityTiers: E85QualificationTier[] = [];

  const baseProvenance = (fact: E85StructuredSourceFact): E85Provenance => ({
    sourceId: source.sourceId,
    sourceVersionId: document.versionId,
    adapterId: VANCOUVER_C_2C_ADAPTER_ID,
    adapterVersion: VANCOUVER_C_2C_ADAPTER_VERSION,
    documentLocator: {
      bylawOrDocumentId: source.document.bylawOrDocumentId,
      schedule: source.document.schedule,
      ...fact.locator,
    },
    zoneDesignation: fact.zoneDesignation,
    effectiveDateBasisNote: publicationNote,
    ...(fact.temporalAuthority === undefined ? {} : { temporalAuthority: fact.temporalAuthority }),
    url: version?.url ?? source.url,
    retrievedAt: document.extractedAt,
  });

  const addGap = (fact: E85StructuredSourceFact, code: E85NormalizationFinding["code"], reasonCode: "RULE_NOT_STRUCTURED" | "USE_CLASSIFICATION_UNKNOWN" | "ZONING_AMBIGUOUS", message: string, hint?: string): void => {
    findings.push({ code, severity: "GAP", factId: fact.factId, sourceTerm: fact.sourceTerm, message, gap: { reasonCode, reason: message, sourcesChecked: [source.sourceId], checkedAt: normalizedAt, resolutionHint: hint } });
    unresolved.push({ factId: fact.factId, sourceTerm: fact.sourceTerm, code, reason: message });
  };

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
        message: `Fact "${fact.factId}" is identical in content and locator to "${firstFactId}" and was normalized once only.`,
      });
      continue;
    }
    seenContent.set(key, fact.factId);
    facts.push(fact);
  }

  const permissions: E85Evidence<E85UsePermission>[] = [];
  const dimensionalEvidence: { field: "setback"; yardName: string; evidence: E85Evidence<number> }[] = [];
  const undatedFactIds: string[] = [];

  for (const fact of facts) {
    if (fact.zoneDesignation !== document.zoneDesignation) {
      addGap(fact, "AMBIGUOUS_SOURCE_INTERPRETATION", "ZONING_AMBIGUOUS", `Fact "${fact.factId}" states zone "${fact.zoneDesignation}" inside an extract scoped to "${document.zoneDesignation}"; it is not attributed to either zone.`);
      continue;
    }

    if (!VANCOUVER_C_2C_ADAPTER_IDENTITY.supportedRuleFamilies.includes(fact.family)) {
      addGap(
        fact,
        "UNSUPPORTED_SOURCE_CONCEPT",
        "RULE_NOT_STRUCTURED",
        `Rule family ${fact.family} is not normalized by this adapter (supports ${VANCOUVER_C_2C_ADAPTER_IDENTITY.supportedRuleFamilies.join(", ")}). No value is produced for "${fact.sourceTerm}".`,
      );
      continue;
    }

    if (fact.applicability !== undefined) {
      addGap(
        fact,
        "UNSUPPORTED_SOURCE_CONCEPT",
        "RULE_NOT_STRUCTURED",
        `Fact "${fact.factId}" states a scope, but this narrow C-2C pilot has no reviewed scope-mapping machinery. Emitting it unscoped would widen the rule, so it is not emitted.`,
      );
      continue;
    }

    const factTemporal: E85TemporalWindow = fact.temporal ?? temporal;
    const temporalNote =
      fact.temporal !== undefined && fact.temporal.effectiveDateBasis !== "UNKNOWN"
        ? ` Effective date: ${fact.temporal.effectiveFrom ?? "no effectiveFrom"} (basis ${fact.temporal.effectiveDateBasis}), proven independently of source version "${document.versionId}"'s ${temporal.effectiveDateBasis === "UNKNOWN" ? "unknown" : "own"} temporal basis.`
        : "";
    if (temporalNote === "" && factTemporal.effectiveDateBasis === "UNKNOWN") undatedFactIds.push(fact.factId);

    if (fact.notes !== undefined && fact.notes.trim() !== "") {
      findings.push({ code: "SOURCE_NOTE_PRESERVED", severity: "INFO", factId: fact.factId, sourceTerm: fact.sourceTerm, message: `Extractor's note on fact "${fact.factId}": ${fact.notes}` });
    }

    if (fact.family === "USE") {
      const status = mapVancouverC2CUseStatus(fact.sourceTerm);
      if (status === undefined) {
        addGap(fact, "UNSUPPORTED_SOURCE_CONCEPT", "USE_CLASSIFICATION_UNKNOWN", `Approval-path term "${fact.sourceTerm}" has no reviewed mapping in this adapter, so it is not resolved to PERMITTED, CONDITIONAL, or PROHIBITED. No status is guessed.`);
        continue;
      }
      if (fact.sourceUseTerm === undefined) {
        addGap(fact, "MISSING_REQUIRED_VALUE", "USE_CLASSIFICATION_UNKNOWN", `Fact "${fact.factId}" states approval path "${fact.sourceTerm}" but names no land use.`);
        continue;
      }
      const useCode = mapVancouverC2CUseCode(fact.sourceUseTerm);
      if (useCode === undefined) {
        addGap(fact, "UNSUPPORTED_SOURCE_CONCEPT", "USE_CLASSIFICATION_UNKNOWN", `Land use "${fact.sourceUseTerm}" has no reviewed E85 use code in this adapter; it is not approximated to a similar-sounding use.`);
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
      permissions.push({ value: permission, provenance, temporal: factTemporal });
      qualityTiers.push(deriveEvidenceQuality(provenance));
      applicabilityTiers.push(fact.condition ? "moderate" : "high");
      findings.push({
        code: "TERM_MAPPED_EXACT",
        severity: "INFO",
        factId: fact.factId,
        sourceTerm: fact.sourceTerm,
        message: `"${fact.sourceTerm}" for "${fact.sourceUseTerm}" mapped to ${status} (use code "${useCode}"); source wording preserved on the permission.${temporalNote}`,
      });
      continue;
    }

    // DIMENSIONAL — this pilot's only concept is "Front Yard".
    const mapping = mapVancouverC2CConcept(fact.sourceTerm);
    if (mapping === undefined) {
      addGap(fact, "UNSUPPORTED_SOURCE_CONCEPT", "RULE_NOT_STRUCTURED", `Source term "${fact.sourceTerm}" has no reviewed mapping in this adapter; it is not matched approximately to a similar concept.`);
      continue;
    }
    if (mapping.family !== fact.family) {
      addGap(fact, "AMBIGUOUS_SOURCE_INTERPRETATION", "RULE_NOT_STRUCTURED", `Fact "${fact.factId}" is labelled family ${fact.family} but "${fact.sourceTerm}" maps to ${mapping.family}.`);
      continue;
    }
    if (fact.numericValue === undefined) {
      addGap(fact, "MISSING_REQUIRED_VALUE", "RULE_NOT_STRUCTURED", `"${fact.sourceTerm}" requires a numeric value and the extract states none. No value is produced.`);
      continue;
    }
    if (fact.unit === undefined) {
      addGap(fact, "UNIT_UNSUPPORTED_FOR_CONCEPT", "RULE_NOT_STRUCTURED", `"${fact.sourceTerm}" states value ${fact.numericValue} with no unit; the unit is not inferred from the concept.`);
      continue;
    }
    const converted = convertVancouverC2CUnit(mapping, fact.numericValue, fact.unit);
    if (!converted.ok) {
      addGap(fact, "UNIT_UNSUPPORTED_FOR_CONCEPT", "RULE_NOT_STRUCTURED", `Unit ${fact.unit} is not accepted for "${fact.sourceTerm}" (accepts ${mapping.acceptedUnits.join(", ")}); no conversion is attempted.`);
      continue;
    }
    if (fact.condition !== undefined) {
      // Condition-dependent DIMENSIONAL values are out of scope for this
      // narrow pilot (no conditional-rule machinery is wired up here); refuse
      // rather than silently emit it unconditionally.
      addGap(fact, "AMBIGUOUS_SOURCE_INTERPRETATION", "RULE_NOT_STRUCTURED", `"${fact.sourceTerm}" carries a free-text condition ("${fact.condition}"), and this narrow pilot has no conditional-rule handling; it is not emitted.`);
      continue;
    }

    const provenance = baseProvenance(fact);
    const evidence: E85Evidence<number> = { value: converted.value, provenance, temporal: factTemporal };
    qualityTiers.push(deriveEvidenceQuality(provenance));
    applicabilityTiers.push("high");
    dimensionalEvidence.push({ field: "setback", yardName: mapping.yardName, evidence });

    findings.push({
      code: "TERM_MAPPED_EXACT",
      severity: "INFO",
      factId: fact.factId,
      sourceTerm: fact.sourceTerm,
      message: `"${fact.sourceTerm}" mapped to DIMENSIONAL.setbacksMetres.${mapping.yardName} = ${converted.value} (${fact.unit}), value unchanged.${temporalNote}`,
    });
  }

  for (const section of document.unstructuredSections ?? []) {
    const message = `Section "${section}" of ${source.displayName} is known to exist but was not structured by this extract, so any rule it states is absent rather than nonexistent.`;
    findings.push({ code: "SOURCE_SECTION_UNAVAILABLE", severity: "GAP", message, gap: { reasonCode: "RULE_NOT_STRUCTURED", reason: message, sourcesChecked: [source.sourceId], checkedAt: normalizedAt, resolutionHint: "Extract this section to make its rules available." } });
  }

  if (version === undefined) {
    findings.push({
      code: "SOURCE_VERSION_INCOMPLETE",
      severity: "WARNING",
      message: `Version "${document.versionId}" is accepted by the adapter but is not among the registry's registered versions for "${source.sourceId}".`,
    });
  }

  if (undatedFactIds.length > 0) {
    const message =
      `No effective date is established for "${source.sourceId}" version "${document.versionId}"` +
      (version?.consolidationPeriod ? `, which carries a ${version.consolidationPeriod} publication stamp at month precision and no day` : "") +
      `. ${undatedFactIds.length} fact(s) carry no proven amendment-instrument date of their own and therefore fall back to this unknown basis: ${[...undatedFactIds].sort().join(", ")}.`;
    findings.push({
      code: "SOURCE_VERSION_INCOMPLETE",
      severity: "GAP",
      message,
      gap: {
        reasonCode: "EFFECTIVE_DATE_UNKNOWN",
        reason: message,
        sourcesChecked: [source.sourceId],
        checkedAt: normalizedAt,
        resolutionHint: "Establish the provisions' effective date from an authoritative statement and register it on the individual fact's own `temporal`.",
      },
    });
  }

  const rules: E85RuleRecord[] = [];
  if (permissions.length > 0) {
    const useRule: E85UseRule = { family: "USE", jurisdictionId: document.jurisdictionId, zoneDesignation: document.zoneDesignation, permissions };
    rules.push(useRule);
  }
  if (dimensionalEvidence.length > 0) {
    const setbacks: Record<string, E85Evidence<number>> = {};
    for (const d of dimensionalEvidence) setbacks[d.yardName] = d.evidence;
    const dimensionalRule: E85DimensionalRule = { family: "DIMENSIONAL", jurisdictionId: document.jurisdictionId, zoneDesignation: document.zoneDesignation, setbacksMetres: setbacks };
    rules.push(dimensionalRule);
  }

  // PHASE 14.4B — Section 13.2-style source findings for the load-bearing
  // limitations this narrow pack deliberately does NOT structure. Audit-only:
  // these never carry a `gap` record, so they never affect status/materiality/
  // completeness (decision-materiality.ts is untouched by this pilot).
  const disclosureFindings: readonly string[] = [
    "§3.1.2.8/§3.2.2.6 angular building envelope: overrides the schedule's own published maximum-height figures for any site that does not satisfy the conjunctive street-width/orientation exceptions; not modeled here, and no height/storeys value is published as a consequence.",
    "§3.1.1.1/§3.2.1.1 minimum-non-dwelling-floor-space-ratio proviso: every published maximum FSR in C-2C is conditioned on this proposal-level floor at grade; not modeled here, and no density value is published as a consequence.",
    "§3.1(d) bedroom-mix definitional clause: gates whether a proposal qualifies as a \"residential rental tenure building\" for the §3.1 regime at all, swinging the reported FSR/height between the §3.1 and §3.2 figures; not modeled.",
    "§3.1(a) Sub-Area A mapped geographic exclusion: the by-law publishes no machine-readable Sub-Area A boundary, so no parcel-level §3.1 applicability determination is currently supportable even in principle; not modeled.",
    "§2.2.10(c)/§2.2.11 accessory-building/accessory-use percentage caps: subordinate-use limits that do not alter any principal-use permission, FSR, or height this pack states; not modeled.",
    "§2.2.5 rental-replacement obligation via the Rental Housing Stock Official Development Plan (By-law 9488, extended to C-2C by By-law 12955): a separately-enacted instrument this pilot does not hold; no REQUIREMENT rule is published as a consequence.",
    "Retail Store (§2.1, Outright): excluded from this pack's USE facts despite its Outright status, because it carries real, unresolved Section 11 dependencies (a liquor-store carve-out and a used-merchandise floor-area allowance) this pilot does not attempt to structure.",
    "§3.1.2.13/§3.2.2.11 parking-area setback from the side property line abutting a flanking street on a corner site (1.2 m, dated to 2022-11-14 by By-law 13447 cl.28): a real, freestanding, dated value that is NOT structured as a DIMENSIONAL setbacksMetres entry, because that field's free-string keys are presented downstream as undifferentiated yard/building-envelope setbacks (dimensional-evaluation.ts / envelope-assembly.ts bind every key to a generic \"Yard: <name>\" constraint) — a parking-specific setback placed there would be indistinguishable from a general building setback to any downstream consumer.",
    "Maximum unit frontage (15.3 m, §3.1.2.1/§3.2.2.1): a real, quantified, non-discretionary limit on tenancy/unit dimension, not published because no existing E85 field honestly represents it.",
  ];
  for (const message of disclosureFindings) {
    findings.push({ code: "SOURCE_SECTION_UNAVAILABLE", severity: "GAP", message });
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
    conditionalRules: [],
    supportedRuleFamilies: VANCOUVER_C_2C_ADAPTER_IDENTITY.supportedRuleFamilies,
    findings,
    unresolvedSourceItems: unresolved,
    readiness,
    qualification,
    provenance: {
      sourceId: source.sourceId,
      sourceVersionId: document.versionId,
      adapterId: VANCOUVER_C_2C_ADAPTER_ID,
      adapterVersion: VANCOUVER_C_2C_ADAPTER_VERSION,
      documentLocator: { bylawOrDocumentId: source.document.bylawOrDocumentId, schedule: source.document.schedule },
      zoneDesignation: document.zoneDesignation,
      url: version?.url ?? source.url,
      retrievedAt: document.extractedAt,
    },
    adapterId: VANCOUVER_C_2C_ADAPTER_ID,
    adapterVersion: VANCOUVER_C_2C_ADAPTER_VERSION,
    normalizedAt,
  };

  return { outcome: "NORMALIZED", bundle };
}

/** The Vancouver C-2C pilot adapter. Pure, offline, deterministic. */
export const vancouverC2CAdapter: E85SourceAdapter = {
  identity: VANCOUVER_C_2C_ADAPTER_IDENTITY,
  canHandle,
  normalize,
};

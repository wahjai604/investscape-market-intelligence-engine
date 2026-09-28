/**
 * InvestScape™ E85 — Vancouver legal pack: internal server assembly.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Turns a loaded legal pack into the server-controlled pieces that
 * `evaluateE85PublicRequest` consumes through `E85PublicServerInputs`: the
 * normalized bundles, their canonical rule packs, and the spatial linkage
 * policy. INTERNAL: no route, no request, no clock of its own.
 *
 * FAIL CLOSED. The loaded pack is re-checked here rather than trusted: the
 * manifest/content binding (fact-set digests, fact ids, source version,
 * adapter identity), the caller-computed PDF digests (a missing digest is a
 * failure), each source's normalization, and the linkage. Every problem is
 * collected and thrown as one `E85LegalPackIntegrityError`.
 *
 * DISCLOSURES ARE CARRIED, NOT INFERRED AWAY. Matching bytes prove only that
 * the facts are bound to the pinned PDFs; they do not release the pack.
 * `releaseStatus`, `asOfResolution` and the open unknowns are copied from the
 * manifest as literal types, and the assembly refuses to build if any
 * disclosure that must survive downstream has been lost:
 *   - LICENSE_UNKNOWN must still appear as a LICENSE readiness blocker on
 *     every bundle (it reaches the public response as a Phase 6 readiness
 *     warning);
 *   - the unknown version validity must still read UNKNOWN on every source
 *     version, and no temporal evidence is produced (so the public path keeps
 *     its MATERIAL temporal blocker and answers DATA_GAP);
 *   - the Schedule J cash-in-lieu rate must still be withheld: the fact that
 *     cites it is present, carries no rate, and its normalization finding
 *     says it is not structured.
 * Pack-level disclosures with no slot in the rule packs (NOT_RELEASED,
 * incomplete definition history, amendment-index currency, open gates) are
 * returned verbatim in `disclosures`, and reach the public response as
 * `packReadiness` through `E85PublicServerInputs.legalPack`
 * (see `vancouverLegalPackPublicServerInput`).
 */
import { canonicalRulePackFromBundle, type E85RulePack } from "../../../composition-types";
import type { E85NormalizedRuleBundle } from "../../../normalized-bundle-types";
import {
  E85LegalPackIntegrityError,
  e85LegalPackBindingProblems,
  e85LegalPackSourceByteProblems,
  type E85LegalPackDisclosures,
} from "../../../legal-pack-integrity";
import { auditVancouverLegalLinkage, vancouverZoningLinkPolicyFromLegalBundles } from "../../spatial/vancouver/vancouver-legal-linkage";
import type { E85LoadedLegalPack } from "./manifest";

type E85VancouverRulePackLinkPolicy = ReturnType<typeof vancouverZoningLinkPolicyFromLegalBundles>;

/** The fact that points at Schedule J's cash-in-lieu rate, which stays withheld. */
export const VANCOUVER_SCHEDULE_J_WITHHELD_FACT_ID = "r1-1-requirement-002";

/** The generic pack disclosure shape; kept under this name for existing callers. */
export type E85VancouverLegalPackDisclosures = E85LegalPackDisclosures;

export interface E85VancouverLegalPackServerAssembly {
  readonly legalPackId: string;
  readonly jurisdictionId: string;
  readonly bundles: readonly E85NormalizedRuleBundle[];
  /** For `E85PublicServerInputs.availableRulePacks`. */
  readonly rulePacks: readonly E85RulePack[];
  /** For the Vancouver spatial adapter the Phase 8 normalizer is built with. */
  readonly linkPolicy: E85VancouverRulePackLinkPolicy;
  readonly disclosures: E85VancouverLegalPackDisclosures;
  /**
   * Never produced. Real AS_OF resolution is DISABLED for this pack, so the
   * server must not supply `E85PublicServerInputs.temporalEvidence` from it.
   */
  readonly temporalEvidence: undefined;
}

export interface E85VancouverLegalPackAssemblyOptions {
  /** SHA-256 of the schedule PDF bytes the server actually holds, keyed by sourceId. */
  readonly observedPdfSha256BySourceId: ReadonlyMap<string, string>;
  /** Extraction timestamp stamped on the documents (ISO 8601). Supplied by the server; never a test clock. */
  readonly extractedAt: string;
}

const REQUIRED_GATES = ["CITY_Q1_REUSE", "CITY_Q2_CONSOLIDATION_TIMING", "CITY_Q4_DEFINITION_HISTORY", "AMENDMENT_INDEX_RECAPTURE", "SCHEDULE_J_SOURCE_IDENTITY"];

/**
 * Builds the server-side legal inputs from a loaded pack, or throws with every
 * problem found. A successful result is still NOT_RELEASED and AS_OF-disabled.
 */
export function assembleVancouverLegalPackForServer(loaded: E85LoadedLegalPack, options: E85VancouverLegalPackAssemblyOptions): E85VancouverLegalPackServerAssembly {
  const { manifest, content } = loaded;
  const problems: string[] = [];

  // Release posture: a manifest that claims more than the pack proves is refused, not honoured.
  if (manifest.releaseStatus !== "NOT_RELEASED") problems.push(`releaseStatus ${String(manifest.releaseStatus)} is not NOT_RELEASED`);
  if (manifest.asOfResolution !== "DISABLED") problems.push(`asOfResolution ${String(manifest.asOfResolution)} is not DISABLED`);
  const u = manifest.openUnknowns;
  if (u.versionValidity !== "UNKNOWN" || u.definitionHistory !== "NOT_PROVEN_COMPLETE" || u.licence !== "LICENSE_UNKNOWN" || u.amendmentCurrency !== "CHECKED_THROUGH_INDEX_CAPTURE_ONLY") {
    problems.push("openUnknowns no longer record every known unknown");
  }
  for (const s of manifest.sources) {
    if (s.licenseStatus !== "LICENSE_UNKNOWN") problems.push(`${s.sourceId}: licence ${s.licenseStatus} contradicts openUnknowns.licence LICENSE_UNKNOWN`);
    if (s.versionEffectiveDateBasis !== "UNKNOWN") problems.push(`${s.sourceId}: version effective-date basis is no longer UNKNOWN`);
  }
  for (const gateId of REQUIRED_GATES) if (!manifest.openGates.some((g) => g.gateId === gateId)) problems.push(`open gate ${gateId} is missing`);
  if (manifest.packLevelDisclosures.length === 0) problems.push("packLevelDisclosures is empty");

  // Identity: re-check, never trust a previously loaded object.
  problems.push(...e85LegalPackBindingProblems(manifest, content));
  problems.push(...e85LegalPackSourceByteProblems(manifest, options.observedPdfSha256BySourceId));
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(options.extractedAt)) problems.push(`extractedAt ${options.extractedAt} is not an ISO 8601 UTC timestamp`);
  if (problems.length > 0) throw new E85LegalPackIntegrityError(manifest.legalPackId, problems);

  // Normalize each source exactly as bound.
  const bundles: E85NormalizedRuleBundle[] = [];
  for (const binding of manifest.sources) {
    const c = content.find((x) => x.source.sourceId === binding.sourceId)!;
    const result = c.adapter.normalize(
      {
        sourceId: binding.sourceId,
        jurisdictionId: manifest.jurisdictionId,
        versionId: binding.sourceVersionId,
        zoneDesignation: binding.zoneDesignation,
        facts: c.facts,
        unstructuredSections: c.unstructuredSections,
        extractedAt: options.extractedAt,
      },
      c.source,
    );
    if (result.outcome !== "NORMALIZED") {
      problems.push(`${binding.sourceId}: normalization returned ${result.outcome}`);
      continue;
    }
    const b = result.bundle;
    if (b.sourceVersionId !== binding.sourceVersionId) problems.push(`${binding.sourceId}: bundle version ${b.sourceVersionId} is not ${binding.sourceVersionId}`);
    if (b.adapterId !== binding.adapterId || b.adapterVersion !== binding.adapterVersion) problems.push(`${binding.sourceId}: bundle adapter ${b.adapterId}@${b.adapterVersion} is not the pinned one`);
    if (b.zoneDesignation !== binding.zoneDesignation) problems.push(`${binding.sourceId}: bundle zone ${b.zoneDesignation} is not ${binding.zoneDesignation}`);
    // Licence disclosure must survive into the rule pack's readiness.
    if (binding.licenseStatus === "LICENSE_UNKNOWN" && !b.readiness.blockers.includes("LICENSE")) problems.push(`${binding.sourceId}: LICENSE_UNKNOWN no longer appears as a LICENSE readiness blocker`);
    if (b.readiness.overall !== "BLOCKED") problems.push(`${binding.sourceId}: readiness reads ${b.readiness.overall}; an unreleased pack must stay BLOCKED`);
    // Version validity must stay unknown.
    const version = c.source.versions.find((v) => v.versionId === binding.sourceVersionId);
    if (version?.effectiveDateBasis !== "UNKNOWN" || version.effectiveFrom !== undefined) problems.push(`${binding.sourceId}: source version now claims an effective date`);
    bundles.push(b);
  }

  // Schedule J: the cash-in-lieu rate stays withheld.
  const r11 = bundles.find((b) => b.zoneDesignation === "R1-1");
  const sjFact = content.flatMap((c) => c.facts).find((f) => f.factId === VANCOUVER_SCHEDULE_J_WITHHELD_FACT_ID);
  if (sjFact === undefined) problems.push(`${VANCOUVER_SCHEDULE_J_WITHHELD_FACT_ID}: the Schedule J fact is missing, so its withholding cannot be shown`);
  else if (!JSON.stringify(sjFact).includes("Schedule J")) problems.push(`${VANCOUVER_SCHEDULE_J_WITHHELD_FACT_ID}: no longer cites Schedule J`);
  const sjFinding = r11?.findings.find((f) => f.factId === VANCOUVER_SCHEDULE_J_WITHHELD_FACT_ID && /NOT structured/.test(f.message));
  if (r11 !== undefined && sjFinding === undefined) problems.push(`${VANCOUVER_SCHEDULE_J_WITHHELD_FACT_ID}: the "not structured" finding is gone; the Schedule J rate may have been structured without a source identity`);

  // Linkage: exactly the pinned zones, each to its own pack.
  const audit = auditVancouverLegalLinkage(bundles);
  const linkPolicy = vancouverZoningLinkPolicyFromLegalBundles(bundles);
  const rulePacks = bundles.map((b) => canonicalRulePackFromBundle(b, "BASE"));
  for (const binding of manifest.sources) {
    const packId = rulePacks.find((p) => p.sourceId === binding.sourceId)?.packId;
    const linked = Object.entries(linkPolicy).filter(([, ids]) => packId !== undefined && ids.includes(packId)).map(([d]) => d);
    if (linked.length !== 1 || linked[0] !== binding.zoneDesignation) problems.push(`${binding.sourceId}: links to [${linked.join(", ")}], expected [${binding.zoneDesignation}]`);
  }
  if (Object.keys(linkPolicy).length !== manifest.sources.length) problems.push(`linkage covers ${Object.keys(linkPolicy).length} districts, the pack has ${manifest.sources.length}`);
  if (audit.rejected.length > 0) problems.push(`linkage rejected ${audit.rejected.map((r) => `${r.sourceId} (${String(r.reason)})`).join(", ")}`);

  if (problems.length > 0) throw new E85LegalPackIntegrityError(manifest.legalPackId, problems);

  return Object.freeze({
    legalPackId: manifest.legalPackId,
    jurisdictionId: manifest.jurisdictionId,
    bundles: Object.freeze(bundles),
    rulePacks: Object.freeze(rulePacks),
    linkPolicy,
    disclosures: Object.freeze({
      releaseStatus: manifest.releaseStatus,
      asOfResolution: manifest.asOfResolution,
      openUnknowns: manifest.openUnknowns,
      currencyCheckedThrough: manifest.currencyCheckedThrough,
      reproduction: manifest.reproduction,
      sourceLicences: manifest.sources.map((s) => ({ sourceId: s.sourceId, licenseStatus: s.licenseStatus, versionEffectiveDateBasis: s.versionEffectiveDateBasis })),
      withheldValues: [{ factId: VANCOUVER_SCHEDULE_J_WITHHELD_FACT_ID, what: "Schedule J §8.1.1 cash-in-lieu rate", gateId: "SCHEDULE_J_SOURCE_IDENTITY" }],
      packLevelDisclosures: [...manifest.packLevelDisclosures],
      openGates: [...manifest.openGates],
    }),
    temporalEvidence: undefined,
  });
}

/**
 * The `E85PublicServerInputs.legalPack` value for this assembly: the pack id
 * and its disclosures, exactly as assembled. Server-side only.
 */
export function vancouverLegalPackPublicServerInput(assembly: E85VancouverLegalPackServerAssembly): { readonly legalPackId: string; readonly disclosures: E85LegalPackDisclosures } {
  return { legalPackId: assembly.legalPackId, disclosures: assembly.disclosures };
}

/**
 * Whether the pack may back a public route. Always false for this pack:
 * `NOT_RELEASED` and `DISABLED` are literal types, so no byte match, fact
 * match or successful assembly can flip it. Lists what still blocks.
 */
export function vancouverLegalPackPublicReadiness(assembly: E85VancouverLegalPackServerAssembly): { readonly publicReady: false; readonly blockedBy: readonly string[] } {
  const d = assembly.disclosures;
  return {
    publicReady: false,
    blockedBy: [`releaseStatus:${d.releaseStatus}`, `asOfResolution:${d.asOfResolution}`, ...d.openGates.map((g) => `gate:${g.gateId}`)],
  };
}

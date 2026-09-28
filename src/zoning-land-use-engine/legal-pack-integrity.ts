/**
 * InvestScape™ E85 — legal-pack packaging integrity.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * A LEGAL PACK binds curated structured facts to the exact source bytes they
 * were read from, the source version label, and the adapter identity that
 * normalizes them. This module checks that binding. It does not read files or
 * reach the network: source bytes are hashed by whoever holds them (the
 * evidence gate, or a release step), and the resulting digests are passed in.
 * The only computation here is SHA-256 over an in-memory canonical form.
 *
 * WHAT A PACK MANIFEST MAY NOT CLAIM. The unknowns are typed as literals, so a
 * manifest cannot record a version-level effective date, a proven definition
 * history, a licence, or amendment currency past the last index capture
 * without a type change that a reviewer will see.
 */
import { createHash } from "crypto";
import type { E85StructuredSourceFact } from "./source-fact-types";
import type { E85SourceDefinition } from "./source-registry-types";
import type { E85SourceAdapter } from "./source-adapter-contract";
import type { E85SourceLicenseStatus, E85SourceAccessStatus } from "./source-readiness-types";

/** Lowercase hex SHA-256. */
export type E85Sha256 = string;

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export function isE85Sha256(value: unknown): value is E85Sha256 {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

/** One source in a pack: its identity, the pinned bytes, and the pinned fact set. */
export interface E85LegalPackSourceBinding {
  readonly zoneDesignation: string;
  readonly sourceId: string;
  /** Source version LABEL. Never a date. */
  readonly sourceVersionId: string;
  /** Month the document prints. Never widened to a day. */
  readonly consolidationPeriod: string;
  /** The printed stamp establishes no effective date for the version. Stays UNKNOWN until an authority says otherwise. */
  readonly versionEffectiveDateBasis: "UNKNOWN";
  /** SHA-256 of the consolidated schedule PDF the facts were read from. */
  readonly sourcePdfSha256: E85Sha256;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly licenseStatus: E85SourceLicenseStatus;
  readonly accessStatus: E85SourceAccessStatus;
  /** Fact ids in pack order. */
  readonly factIds: readonly string[];
  /** SHA-256 of `canonicalE85LegalPackFactSet(facts, unstructuredSections)`. */
  readonly factSetSha256: E85Sha256;
}

/** An instrument a fact's temporal authority or qualification history cites, pinned by bytes only. Carries no date: dates live on the facts that proved them. */
export interface E85LegalPackInstrumentPin {
  readonly bylawOrDocumentId: string;
  readonly role: "DATES_FACTS" | "QUALIFIER_HISTORY";
  readonly sha256: E85Sha256;
}

/** What is known NOT to be established. Every field is a literal on purpose. */
export interface E85LegalPackOpenUnknowns {
  readonly versionValidity: "UNKNOWN";
  readonly definitionHistory: "NOT_PROVEN_COMPLETE";
  readonly licence: "LICENSE_UNKNOWN";
  readonly amendmentCurrency: "CHECKED_THROUGH_INDEX_CAPTURE_ONLY";
}

export interface E85LegalPackManifest {
  readonly manifestFormat: "e85-legal-pack-1";
  readonly legalPackId: string;
  readonly jurisdictionId: string;
  /** No pack is released by packaging alone. */
  readonly releaseStatus: "NOT_RELEASED";
  /** Real AS_OF decisions do not resolve against this pack until the open gates close. */
  readonly asOfResolution: "DISABLED";
  readonly currencyCheckedThrough: {
    /** Capture date of the amendment index. Not an effective date of anything. */
    readonly indexCaptureDate: string;
    readonly indexSha256: E85Sha256;
  };
  readonly openUnknowns: E85LegalPackOpenUnknowns;
  readonly reproduction: {
    readonly structuredValuesAndCitations: "EXPOSABLE_PENDING_CITY_REUSE_ANSWER";
    readonly bylawText: "NOT_ESTABLISHED_DO_NOT_REPRODUCE";
    readonly pageImagesAndPdfs: "DO_NOT_REDISTRIBUTE";
  };
  readonly sources: readonly E85LegalPackSourceBinding[];
  readonly instruments: readonly E85LegalPackInstrumentPin[];
  readonly packLevelDisclosures: readonly string[];
  /** Gates only the City (or a later capture) can close. */
  readonly openGates: readonly { readonly gateId: string; readonly description: string }[];
}

/**
 * The pack-level disclosures a server assembly carries forward from a loaded
 * manifest. Jurisdiction-neutral: a Vancouver assembly produces one, and the
 * public response maps it to `packReadiness`. Copied from the manifest,
 * never from a request.
 */
export interface E85LegalPackDisclosures {
  readonly releaseStatus: E85LegalPackManifest["releaseStatus"];
  readonly asOfResolution: E85LegalPackManifest["asOfResolution"];
  readonly openUnknowns: E85LegalPackOpenUnknowns;
  readonly currencyCheckedThrough: E85LegalPackManifest["currencyCheckedThrough"];
  readonly reproduction: E85LegalPackManifest["reproduction"];
  readonly sourceLicences: readonly { readonly sourceId: string; readonly licenseStatus: E85SourceLicenseStatus; readonly versionEffectiveDateBasis: "UNKNOWN" }[];
  readonly withheldValues: readonly { readonly factId: string; readonly what: string; readonly gateId: string }[];
  readonly packLevelDisclosures: readonly string[];
  readonly openGates: E85LegalPackManifest["openGates"];
}

/** What production supplies for one source when the pack is loaded. */
export interface E85LegalPackSourceContent {
  readonly source: E85SourceDefinition;
  readonly adapter: E85SourceAdapter;
  readonly facts: readonly E85StructuredSourceFact[];
  readonly unstructuredSections: readonly string[];
}

/** Stable JSON: keys sorted at every depth, undefined dropped, array order kept. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

/** The exact string a fact-set digest is taken over. */
export function canonicalE85LegalPackFactSet(facts: readonly E85StructuredSourceFact[], unstructuredSections: readonly string[]): string {
  return canonicalJson({ facts, unstructuredSections });
}

export function digestE85LegalPackFactSet(facts: readonly E85StructuredSourceFact[], unstructuredSections: readonly string[]): E85Sha256 {
  return createHash("sha256").update(canonicalE85LegalPackFactSet(facts, unstructuredSections), "utf8").digest("hex");
}

/**
 * Every way the supplied content fails to match the manifest. Empty means the
 * binding holds. Checks identity only; it never judges whether a fact is right.
 */
export function e85LegalPackBindingProblems(manifest: E85LegalPackManifest, content: readonly E85LegalPackSourceContent[]): string[] {
  const problems: string[] = [];
  const pinnedInstruments = new Set(manifest.instruments.map((i) => i.bylawOrDocumentId));
  if (!isE85Sha256(manifest.currencyCheckedThrough.indexSha256)) problems.push("amendment index digest is not a SHA-256");
  for (const pin of manifest.instruments) if (!isE85Sha256(pin.sha256)) problems.push(`instrument ${pin.bylawOrDocumentId}: digest is not a SHA-256`);

  const bySourceId = new Map(content.map((c) => [c.source.sourceId, c]));
  if (bySourceId.size !== content.length) problems.push("duplicate source supplied");
  for (const c of content) if (!manifest.sources.some((s) => s.sourceId === c.source.sourceId)) problems.push(`${c.source.sourceId}: supplied but not in the manifest`);

  for (const binding of manifest.sources) {
    const at = binding.sourceId;
    const c = bySourceId.get(at);
    if (c === undefined) {
      problems.push(`${at}: in the manifest but not supplied`);
      continue;
    }
    if (!isE85Sha256(binding.sourcePdfSha256)) problems.push(`${at}: source PDF digest is not a SHA-256`);
    if (c.source.jurisdictionId !== manifest.jurisdictionId) problems.push(`${at}: jurisdiction ${c.source.jurisdictionId} is not ${manifest.jurisdictionId}`);

    // Source version: exactly one registered version, the pinned label, the printed month, no effective date.
    const version = c.source.versions.find((v) => v.versionId === binding.sourceVersionId);
    if (version === undefined) problems.push(`${at}: source version ${binding.sourceVersionId} is not registered`);
    else {
      if (version.consolidationPeriod !== binding.consolidationPeriod) problems.push(`${at}: consolidation period ${String(version.consolidationPeriod)} is not ${binding.consolidationPeriod}`);
      if (version.effectiveDateBasis !== "UNKNOWN" || version.effectiveFrom !== undefined) problems.push(`${at}: source version claims an effective date the pack records as UNKNOWN`);
    }
    if (c.source.licenseStatus !== binding.licenseStatus) problems.push(`${at}: licence ${c.source.licenseStatus} is not ${binding.licenseStatus}`);
    if (c.source.accessStatus !== binding.accessStatus) problems.push(`${at}: access ${c.source.accessStatus} is not ${binding.accessStatus}`);
    if (!(c.source.supportedZoneDesignations ?? []).includes(binding.zoneDesignation)) problems.push(`${at}: zone ${binding.zoneDesignation} is not registered`);

    // Adapter identity: source record, adapter object and manifest must all agree.
    const id = c.adapter.identity;
    if (c.source.adapterId !== binding.adapterId) problems.push(`${at}: source names adapter ${String(c.source.adapterId)}, manifest pins ${binding.adapterId}`);
    if (id.adapterId !== binding.adapterId) problems.push(`${at}: adapter is ${id.adapterId}, manifest pins ${binding.adapterId}`);
    if (id.adapterVersion !== binding.adapterVersion) problems.push(`${at}: adapter version ${id.adapterVersion} is not pinned ${binding.adapterVersion}`);
    if (!id.supportedSourceIds.includes(at)) problems.push(`${at}: adapter does not support this source`);
    if (!id.supportedVersionIds.includes(binding.sourceVersionId)) problems.push(`${at}: adapter is not verified against ${binding.sourceVersionId}`);

    // Facts: ids, order, zone, cited instruments, and the byte-exact digest.
    const ids = c.facts.map((f) => f.factId);
    if (new Set(ids).size !== ids.length) problems.push(`${at}: duplicate fact id`);
    if (ids.join("\n") !== binding.factIds.join("\n")) problems.push(`${at}: fact ids differ from the manifest`);
    for (const f of c.facts) {
      if (f.zoneDesignation !== binding.zoneDesignation) problems.push(`${at}: ${f.factId} is in zone ${f.zoneDesignation}`);
      const instrument = f.temporalAuthority?.instrument.bylawOrDocumentId;
      if (instrument !== undefined && !pinnedInstruments.has(instrument)) problems.push(`${at}: ${f.factId} is dated by instrument ${instrument}, which has no pinned digest`);
      for (const q of f.qualifications ?? []) {
        for (const loc of q.history.locatedInstruments ?? []) {
          const qi = loc.bylawOrDocumentId;
          if (qi !== undefined && !pinnedInstruments.has(qi)) problems.push(`${at}: ${f.factId} qualification ${q.qualificationId} cites instrument ${qi}, which has no pinned digest`);
        }
      }
    }
    const digest = digestE85LegalPackFactSet(c.facts, c.unstructuredSections);
    if (digest !== binding.factSetSha256) problems.push(`${at}: fact set digest ${digest} is not pinned ${binding.factSetSha256}`);
  }
  return problems;
}

/**
 * Compares caller-computed source digests with the pins. The caller hashes the
 * bytes it holds; a missing digest is a problem, never a pass.
 */
export function e85LegalPackSourceByteProblems(manifest: E85LegalPackManifest, observedPdfSha256BySourceId: ReadonlyMap<string, string>): string[] {
  const problems: string[] = [];
  for (const binding of manifest.sources) {
    const observed = observedPdfSha256BySourceId.get(binding.sourceId);
    if (observed === undefined) problems.push(`${binding.sourceId}: no source bytes were hashed`);
    else if (observed !== binding.sourcePdfSha256) problems.push(`${binding.sourceId}: source PDF is ${observed}, pack is bound to ${binding.sourcePdfSha256}`);
  }
  return problems;
}

/** Thrown when a pack's binding fails at load. Carries every problem, not the first. */
export class E85LegalPackIntegrityError extends Error {
  readonly legalPackId: string;
  readonly problems: readonly string[];
  constructor(legalPackId: string, problems: readonly string[]) {
    super(`Legal pack ${legalPackId} failed its integrity check (${problems.length} problems)\n- ${problems.join("\n- ")}`);
    this.name = "E85LegalPackIntegrityError";
    this.legalPackId = legalPackId;
    this.problems = [...problems];
  }
}

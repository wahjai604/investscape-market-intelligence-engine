/**
 * InvestScape™ E85 Phase 5 — Source Adapter & Registry Foundation: the
 * generic adapter contract.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * An adapter answers exactly two questions: "can I handle this extract?" and,
 * if so, "what are its facts as generic E85 rules?" It is a pure deterministic
 * function of its inputs.
 *
 * An adapter MUST NOT: evaluate a parcel, judge feasibility, compute massing,
 * fetch anything, invent a value the source did not state, or infer legal
 * meaning the source did not express. Those are, respectively, Phase 4's job,
 * out of E85's scope entirely, out of scope, out of scope, forbidden by the
 * DATA_GAP invariant, and forbidden outright.
 *
 * Expected failures are TYPED RESULTS, not exceptions (Phase 5 §22). An
 * unsupported jurisdiction, an unregistered version, an unknown term and a
 * missing value are all ordinary things that happen when pointing software at
 * municipal documents; a caller must be able to handle them without a
 * try/catch, and the type system should make forgetting to handle them hard.
 * `throw` is reserved for programmer error — a malformed hard-coded registry
 * entry, for instance.
 */
import type { E85StructuredSourceDocument } from "./source-fact-types";
import type { E85SourceDefinition } from "./source-registry-types";
import type { E85NormalizedRuleBundle } from "./normalized-bundle-types";
import type { E85RuleFamily } from "./rule-family-types";
import type { E85DataGap } from "./data-gap-types";

/**
 * Stable identity of an adapter, independent of the engine number. "E85-v1"
 * would be a useless identity: it says which engine ran, not which
 * jurisdiction's reading logic ran, and every adapter in the system would
 * share it. Identity is source/jurisdiction-specific, and `adapterVersion`
 * moves whenever normalization logic changes in a way that could alter output
 * for unchanged input — that is why every normalized value's provenance
 * carries both (see `E85Provenance.adapterId` / `adapterVersion`).
 */
export interface E85AdapterIdentity {
  /** Dotted, jurisdiction-scoped identity, e.g. "ca-bc-vancouver.district-schedule.r1-1". */
  adapterId: string;
  /** Semantic version of this adapter's normalization logic, e.g. "1.0.0". */
  adapterVersion: string;
  /** Exact jurisdiction this adapter serves. Never a region, never a country. */
  jurisdictionId: string;
  /** Exact `sourceId`s this adapter can read. */
  supportedSourceIds: readonly string[];
  /** Exact `versionId`s this adapter has been verified against. An unlisted consolidation is not adapted. */
  supportedVersionIds: readonly string[];
  /** Exact zone designations this adapter covers. */
  supportedZoneDesignations: readonly string[];
  /**
   * Rule families this adapter normalizes. A family outside this list yields UNSUPPORTED_SOURCE_CONCEPT rather than a partial guess.
   * AUTHORITATIVE for decision-time coverage (Phase 9): means "this bundle claims to model the family at all", subject to ordinary
   * within-family applicability/gaps/conflicts — never "a rule always applies" or "every fact in the family is structured".
   */
  supportedRuleFamilies: readonly E85RuleFamily[];
}

export type E85AdapterUnsupportedReason =
  | "JURISDICTION_NOT_SUPPORTED"
  | "SOURCE_NOT_SUPPORTED"
  | "VERSION_NOT_SUPPORTED"
  | "ZONE_NOT_SUPPORTED"
  /** The extract's `jurisdictionId` contradicts the registered source's. A real inconsistency, never reconciled by preferring one. */
  | "JURISDICTION_MISMATCH"
  /** No adapter in the registry claims this extract. */
  | "NO_ADAPTER_REGISTERED"
  /** More than one adapter claims it; selecting either would make the answer depend on registration order. */
  | "AMBIGUOUS_ADAPTER_MATCH";

export type E85AdapterSupportDecision = { supported: true } | { supported: false; reason: E85AdapterUnsupportedReason; detail: string };

export type E85NormalizationResult =
  | { outcome: "NORMALIZED"; bundle: E85NormalizedRuleBundle }
  | {
      outcome: "UNSUPPORTED";
      reason: E85AdapterUnsupportedReason;
      detail: string;
      /** A real Phase 3 gap record so an unsupported source is reportable in the same vocabulary as every other missing answer. */
      gap: E85DataGap;
    };

/** Optional knobs. Kept minimal on purpose — an adapter with many behavioural switches stops being deterministic in any useful sense. */
export interface E85NormalizationOptions {
  /** Overrides the timestamp stamped on the bundle and on any gap/review record. Defaults to the extract's `extractedAt`, so normalization never reads a clock. */
  normalizedAt?: string;
}

export interface E85SourceAdapter {
  readonly identity: E85AdapterIdentity;
  /** Pure predicate over identity/scope only. Does not inspect facts — an extract can be handleable and still normalize to nothing but findings. */
  canHandle(document: E85StructuredSourceDocument, source: E85SourceDefinition): E85AdapterSupportDecision;
  /** Pure normalization. Must not mutate `document` or `source`. */
  normalize(document: E85StructuredSourceDocument, source: E85SourceDefinition, options?: E85NormalizationOptions): E85NormalizationResult;
}

/**
 * Maps an unsupported reason onto the existing Phase 3 gap taxonomy, so Phase 5
 * adds no parallel vocabulary for "we cannot answer this".
 *
 * PHASE 5A CORRECTION — A ZONE E85 CANNOT NORMALIZE IS NOT A ZONE NOBODY CAN
 * FIND. `ZONE_NOT_SUPPORTED` previously mapped to `ZONING_NOT_FOUND`, which
 * reads as "no zoning designation could be found for this parcel". That is a
 * statement about the WORLD, and it is false here: reaching this branch means
 * the extract named a zone, so the zoning was found. Vancouver's CD-1 is the
 * clearest case — a real, published, comprehensively-scheduled zoning
 * instrument that this pilot simply has no normalizer for. Telling a caller
 * their CD-1 parcel has no findable zoning would send them to re-look up
 * something already in hand.
 *
 * The accurate existing code is `RULE_NOT_STRUCTURED`: "the governing document
 * exists but its rule content could not be resolved into a structured rule
 * record." No new code is added, because that one already says it.
 *
 * `ZONING_NOT_FOUND` keeps its meaning and its place in the taxonomy — it
 * describes genuine non-identification of a parcel's zoning, which happens
 * upstream of normalization, not inside it. No Phase 5 path emits it.
 *
 * The seven-way `reason` axis is what distinguishes the failures from each
 * other; the gap code says what KIND of answer is missing, and two reasons
 * mapping to one code are still told apart by `reason` and by their distinct
 * resolution hints.
 */
export function unsupportedReasonToGap(reason: E85AdapterUnsupportedReason, detail: string, sourcesChecked: readonly string[], checkedAt: string): E85DataGap {
  const reasonCode =
    reason === "VERSION_NOT_SUPPORTED"
      ? ("BYLAW_VERSION_UNKNOWN" as const)
      : reason === "JURISDICTION_NOT_SUPPORTED" || reason === "JURISDICTION_MISMATCH"
        ? ("JURISDICTION_UNSUPPORTED" as const)
        : reason === "SOURCE_NOT_SUPPORTED"
          ? // No registered governing document answers this — distinct from
            // having one whose rules are not structured.
            ("BYLAW_NOT_FOUND" as const)
          : reason === "AMBIGUOUS_ADAPTER_MATCH"
            ? ("ZONING_AMBIGUOUS" as const)
            : // ZONE_NOT_SUPPORTED and NO_ADAPTER_REGISTERED: the document is
              // known and the zone is named; what is missing is structured rules.
              ("RULE_NOT_STRUCTURED" as const);
  return {
    reasonCode,
    reason: detail,
    sourcesChecked,
    checkedAt,
    resolutionHint:
      reason === "NO_ADAPTER_REGISTERED"
        ? "Build and register an adapter for this jurisdiction/source before rules from it can be normalized."
        : reason === "VERSION_NOT_SUPPORTED"
          ? "Register and verify this consolidation, or supply an extract from a registered one."
          : reason === "ZONE_NOT_SUPPORTED"
            ? "This zone is named by the extract and is not in question; what is missing is a normalizer for it. Build and register an adapter covering this zone, or evaluate it from a source that already covers it."
            : reason === "SOURCE_NOT_SUPPORTED"
              ? "Register the governing document for this jurisdiction/zone in the E85 source registry before rules can be read from it."
              : undefined,
  };
}

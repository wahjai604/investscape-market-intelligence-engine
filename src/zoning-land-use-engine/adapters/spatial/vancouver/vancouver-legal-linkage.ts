/**
 * InvestScape™ E85 Phase 11 — City of Vancouver: the spatial→legal instrument join.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Phase 10 established WHERE Vancouver's zoning districts are. It deliberately
 * linked none of them to an instrument, because E85 held no rule pack whose
 * legal identity had been established as governing any of that ground. This
 * file performs that join for a small, explicit table of districts — R1-1 and
 * (as of Phase 14.4B) C-2C — and refuses to perform it for any other.
 *
 * PHASE 14.4B GENERALIZATION. What was a single hard-coded scalar
 * (`VANCOUVER_LINKED_SPATIAL_DISTRICT`) and a 4-way if-chain comparing one
 * bundle against one district's constants is now a small immutable array of
 * per-district entries, each checked with the SAME exact-match-only
 * semantics as before: no fuzzy matching, no case-folding, no prefix
 * matching, and no `zoning_category`-based fallback. R1-1's entry carries
 * byte-identical values to what was hard-coded here before this change —
 * this is a data-shape generalization, not a behavior change for R1-1.
 * Recognizing a spatial feature's `zoning_district` label alone never itself
 * creates a link; a link only happens when the caller supplies a normalized
 * bundle whose jurisdictionId/sourceId/sourceVersionId/zoneDesignation all
 * match one table entry exactly.
 *
 * THE JOIN IS EVIDENCE-GATED, NOT CONFIGURED. Nothing here is a switch a caller
 * flips to assert that Vancouver's R1-1 rules exist. The linkage is built FROM
 * the normalized legal bundles a caller actually holds: hand it the validated
 * R1-1 bundle and R1-1 resolves; hand it nothing, or a bundle for another
 * source, version, jurisdiction or zone, and R1-1 stays unresolved and the
 * spatial feature carries its `RULE_PACK_LINK_UNRESOLVED` gap exactly as it did
 * in Phase 10.
 *
 * That is the whole design, and the alternative is worth naming. Populating the
 * adapter's default mapping with R1-1 would make EVERY invocation of the
 * Vancouver spatial adapter announce that an R1-1 rule pack is available —
 * including invocations by a caller who never loaded one. Phase 7 would then
 * report a pack id that resolves to nothing, and the failure would surface as a
 * missing pack at composition time rather than as the honest statement that the
 * governing instrument was never supplied. Spatial data availability and legal
 * evidence availability are different facts, and the linkage is only true when
 * both hold.
 *
 * WHAT IS NOT JOINED HERE, AND WHY. CD-1 is not, and no `cd_1_number` becomes a
 * pack id: each CD-1 is its own enacted instrument and E85 holds none of them.
 * C-1, C-2, RM, RT, DD and the rest are not, however obvious their labels look:
 * a label resembling a schedule title is a naming convention, not evidence that
 * a particular by-law governs a particular polygon. Phase 11 is an R1-1 pilot
 * and its coverage is deliberately narrow.
 */
import type { E85NormalizedRuleBundle } from "../../../normalized-bundle-types";
import { e85RulePackIdFromSource } from "../../../composition-types";
import { VANCOUVER_R1_1_SOURCE_ID, VANCOUVER_R1_1_VERSION_ID, VANCOUVER_R1_1_ZONE, VANCOUVER_JURISDICTION_ID } from "../../vancouver/r1-1-source";
import { VANCOUVER_C_2C_SOURCE_ID, VANCOUVER_C_2C_VERSION_ID, VANCOUVER_C_2C_ZONE } from "../../vancouver/c-2c-source";
import type { E85VancouverRulePackLinkPolicy } from "./vancouver-zoning-source";
import { VANCOUVER_ZONING_FIELDS } from "./vancouver-zoning-source";

/** Why a supplied bundle was not accepted as a registered district's governing instrument. Reported, never silently swallowed. */
export type E85VancouverLinkageRejection = "JURISDICTION_MISMATCH" | "SOURCE_NOT_REGISTERED_DISTRICT_SCHEDULE" | "VERSION_NOT_VERIFIED" | "ZONE_NOT_REGISTERED";

/**
 * One entry in the registered Vancouver district table: the spatial
 * `zoning_district` label on one side, and the four-axis legal identity that
 * must match EXACTLY for a supplied bundle to resolve that label, on the
 * other. Adding a district means adding one entry here — never widening an
 * existing entry's match semantics.
 */
interface E85VancouverDistrictLinkEntry {
  readonly spatialDistrict: string;
  readonly jurisdictionId: string;
  readonly sourceId: string;
  readonly sourceVersionId: string;
  readonly zoneDesignation: string;
}

/**
 * THE REGISTERED VANCOUVER DISTRICT TABLE, and the ONLY districts E85 has
 * established a legal join for.
 *
 * Each entry's `spatialDistrict` is the exact string the City's layer prints,
 * compared exactly against `zoning_district` — never a prefix match, never
 * case-folded, never normalized. "R1-1" and "R1" are different districts
 * governed by different provisions; "C-2C" and "C-2" likewise. A match that
 * tolerated the difference would evaluate a site under rules never written
 * for it.
 *
 * Note carefully what this table is NOT. It is not the source of any pack's
 * identity — the pack id comes from the legal source (`e85RulePackIdFromSource`
 * below), never from this table. Each entry's spatial side is only the other
 * half of a join whose legal half had to be proven independently.
 *
 * THE R1-1 ENTRY IS BYTE-IDENTICAL to the single-district values this module
 * held before Phase 14.4B generalized it to a table: no behavior change for
 * R1-1 is intended or expected.
 */
const VANCOUVER_DISTRICT_LINK_TABLE: readonly E85VancouverDistrictLinkEntry[] = [
  { spatialDistrict: VANCOUVER_R1_1_ZONE, jurisdictionId: VANCOUVER_JURISDICTION_ID, sourceId: VANCOUVER_R1_1_SOURCE_ID, sourceVersionId: VANCOUVER_R1_1_VERSION_ID, zoneDesignation: VANCOUVER_R1_1_ZONE },
  { spatialDistrict: VANCOUVER_C_2C_ZONE, jurisdictionId: VANCOUVER_JURISDICTION_ID, sourceId: VANCOUVER_C_2C_SOURCE_ID, sourceVersionId: VANCOUVER_C_2C_VERSION_ID, zoneDesignation: VANCOUVER_C_2C_ZONE },
];

/**
 * Backward-compatible alias for the R1-1 pilot's original single-district
 * constant. Retained byte-for-byte so every existing R1-1 test and caller
 * continues to read "R1-1" from this name, unchanged by the Phase 14.4B
 * generalization to a table.
 */
export const VANCOUVER_LINKED_SPATIAL_DISTRICT = VANCOUVER_R1_1_ZONE;

export interface E85VancouverLinkageAudit {
  /** The spatial district labels this policy resolves. Empty when no qualifying legal evidence was supplied. */
  linkedDistricts: readonly string[];
  /** The canonical pack id R1-1 resolved to, when it resolved. Retained under its original name for backward compatibility; see `resolvedPackIds` for the general, multi-district form. */
  r11PackId?: string;
  /** The legal instrument identity the join was made against for the first accepted bundle. */
  legalSourceId?: string;
  /** The exact legal version the join was made against for the first accepted bundle. Kept separate from the spatial release on purpose. */
  legalSourceVersionId?: string;
  /** Every district this table resolved, with the exact bundle identity and canonical pack id that resolved it. */
  resolved: readonly { spatialDistrict: string; packId: string; sourceId: string; sourceVersionId: string }[];
  /** Every supplied bundle that was NOT accepted, with the reason. */
  rejected: readonly { sourceId: string; sourceVersionId: string; reason: E85VancouverLinkageRejection }[];
}

/**
 * Whether one normalized bundle is the validated governing instrument for ANY
 * registered district-table entry, and if so, which entry.
 *
 * FOUR AXES, ALL EXACT, ALL REQUIRED, PER ENTRY. A string match on the zone
 * alone would be the label-similarity inference this phase exists to avoid,
 * so the bundle must also come from the entry's registered source, from its
 * verified consolidation, and from Vancouver. Any one of them wrong and the
 * bundle is some other instrument that happens to mention a matching zone
 * designation. When no entry matches on jurisdiction+source+version+zone, the
 * rejection reason reported is the most specific mismatch found among entries
 * that at least matched jurisdiction and source (so a caller sees "wrong
 * version" or "wrong zone" rather than a generic "not registered" whenever a
 * more informative reason is available).
 */
function classifyBundle(bundle: E85NormalizedRuleBundle): { entry: E85VancouverDistrictLinkEntry } | { entry: undefined; reason: E85VancouverLinkageRejection } {
  for (const entry of VANCOUVER_DISTRICT_LINK_TABLE) {
    if (bundle.jurisdictionId === entry.jurisdictionId && bundle.sourceId === entry.sourceId && bundle.sourceVersionId === entry.sourceVersionId && bundle.zoneDesignation === entry.zoneDesignation) {
      return { entry };
    }
  }
  // No exact match on any entry. Report the most specific reason: prefer a
  // jurisdiction+source match with the wrong version or zone over a bare
  // "source not registered" when both apply to different entries.
  let best: E85VancouverLinkageRejection | undefined;
  for (const entry of VANCOUVER_DISTRICT_LINK_TABLE) {
    if (bundle.jurisdictionId !== entry.jurisdictionId) {
      best = best ?? "JURISDICTION_MISMATCH";
      continue;
    }
    if (bundle.sourceId !== entry.sourceId) {
      best = best ?? "SOURCE_NOT_REGISTERED_DISTRICT_SCHEDULE";
      continue;
    }
    if (bundle.sourceVersionId !== entry.sourceVersionId) return { entry: undefined, reason: "VERSION_NOT_VERIFIED" };
    if (bundle.zoneDesignation !== entry.zoneDesignation) return { entry: undefined, reason: "ZONE_NOT_REGISTERED" };
  }
  return { entry: undefined, reason: best ?? "JURISDICTION_MISMATCH" };
}

/**
 * Builds the Vancouver spatial rule-pack link policy from the legal evidence a
 * caller actually holds.
 *
 * Returns an EMPTY policy when no qualifying bundle is supplied — which is the
 * Phase 10 behaviour, unchanged and deliberately reachable. An empty policy is
 * not a failure; it is the accurate statement that E85 knows where R1-1 is and
 * not what it says.
 *
 * The returned policy maps the City's exact `zoning_district` label to the
 * CANONICAL pack id derived from the legal source's own identity and version —
 * so the id a spatial feature carries is the same id the pack built from that
 * bundle carries, without either side having agreed on a name in advance.
 */
export function vancouverZoningLinkPolicyFromLegalBundles(bundles: readonly E85NormalizedRuleBundle[]): E85VancouverRulePackLinkPolicy {
  const policy: Record<string, readonly string[]> = {};
  for (const bundle of bundles) {
    const classification = classifyBundle(bundle);
    if (classification.entry === undefined) continue;
    const packId = e85RulePackIdFromSource({ sourceId: bundle.sourceId, sourceVersionId: bundle.sourceVersionId });
    const district = classification.entry.spatialDistrict;
    const existing = policy[district];
    // The same instrument supplied twice is one instrument. A repeated read is
    // never corroboration, and never two packs.
    policy[district] = existing === undefined || !existing.includes(packId) ? [...(existing ?? []), packId].sort() : existing;
  }
  return policy;
}

/** The same derivation, with the reasoning kept, so a caller can report WHY a district did or did not resolve. */
export function auditVancouverLegalLinkage(bundles: readonly E85NormalizedRuleBundle[]): E85VancouverLinkageAudit {
  const rejected: { sourceId: string; sourceVersionId: string; reason: E85VancouverLinkageRejection }[] = [];
  const resolved: { spatialDistrict: string; packId: string; sourceId: string; sourceVersionId: string }[] = [];
  let firstAccepted: E85NormalizedRuleBundle | undefined;
  for (const bundle of bundles) {
    const classification = classifyBundle(bundle);
    if (classification.entry !== undefined) {
      firstAccepted = firstAccepted ?? bundle;
      const packId = e85RulePackIdFromSource({ sourceId: bundle.sourceId, sourceVersionId: bundle.sourceVersionId });
      if (!resolved.some((r) => r.spatialDistrict === classification.entry.spatialDistrict && r.packId === packId)) {
        resolved.push({ spatialDistrict: classification.entry.spatialDistrict, packId, sourceId: bundle.sourceId, sourceVersionId: bundle.sourceVersionId });
      }
    } else {
      rejected.push({ sourceId: bundle.sourceId, sourceVersionId: bundle.sourceVersionId, reason: classification.reason });
    }
  }
  const policy = vancouverZoningLinkPolicyFromLegalBundles(bundles);
  const linkedDistricts = Object.keys(policy).sort();
  return {
    linkedDistricts,
    resolved,
    ...(firstAccepted === undefined
      ? {}
      : {
          r11PackId: e85RulePackIdFromSource({ sourceId: firstAccepted.sourceId, sourceVersionId: firstAccepted.sourceVersionId }),
          legalSourceId: firstAccepted.sourceId,
          legalSourceVersionId: firstAccepted.sourceVersionId,
        }),
    rejected,
  };
}

/**
 * The spatial attribute this join reads, re-exported so a reviewer chasing the
 * linkage does not have to guess which of the City's six fields it keyed on.
 * It is `zoning_district` — the full district label — and never
 * `zoning_category` (a grouping: "CD" spans 891 distinct instruments) and never
 * `cd_1_number`.
 */
export const VANCOUVER_LINKAGE_SOURCE_FIELD = VANCOUVER_ZONING_FIELDS.zoningDistrict;

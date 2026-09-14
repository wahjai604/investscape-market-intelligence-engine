/**
 * InvestScape™ E85 Phase 11 — City of Vancouver: the spatial→legal instrument join.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Phase 10 established WHERE Vancouver's zoning districts are. It deliberately
 * linked none of them to an instrument, because E85 held no rule pack whose
 * legal identity had been established as governing any of that ground. This
 * file performs that join for exactly one district — R1-1 — and refuses to
 * perform it for any other.
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
import type { E85VancouverRulePackLinkPolicy } from "./vancouver-zoning-source";
import { VANCOUVER_ZONING_FIELDS } from "./vancouver-zoning-source";

/**
 * The City's spatial `zoning_district` label whose legal instrument E85 has
 * established, and the ONLY one.
 *
 * This is the exact string the layer prints, and it is compared exactly. There
 * is no prefix match, no `contains("R1")`, no case folding and no normalization
 * of any kind: "R1-1" and "R1" are different districts governed by different
 * provisions, and a match that tolerated the difference would evaluate a site
 * under rules never written for it.
 *
 * Note carefully what this constant is NOT. It is not the source of the pack's
 * identity — the pack id comes from the legal source, below. This label is only
 * the spatial side of a join whose other side had to be proven independently.
 */
export const VANCOUVER_LINKED_SPATIAL_DISTRICT = VANCOUVER_R1_1_ZONE;

/** Why a supplied bundle was not accepted as the R1-1 governing instrument. Reported, never silently swallowed. */
export type E85VancouverLinkageRejection =
  | "JURISDICTION_MISMATCH"
  | "SOURCE_NOT_R1_1_DISTRICT_SCHEDULE"
  | "VERSION_NOT_VERIFIED"
  | "ZONE_NOT_R1_1";

export interface E85VancouverLinkageAudit {
  /** The spatial district labels this policy resolves. Empty when no qualifying legal evidence was supplied. */
  linkedDistricts: readonly string[];
  /** The canonical pack id R1-1 resolved to, when it resolved. */
  r11PackId?: string;
  /** The legal instrument identity the join was made against. */
  legalSourceId?: string;
  /** The exact legal version the join was made against. Kept separate from the spatial release on purpose. */
  legalSourceVersionId?: string;
  /** Every supplied bundle that was NOT accepted, with the reason. */
  rejected: readonly { sourceId: string; sourceVersionId: string; reason: E85VancouverLinkageRejection }[];
}

/**
 * Whether one normalized bundle is the validated Vancouver R1-1 District
 * Schedule.
 *
 * FOUR AXES, ALL EXACT, ALL REQUIRED. A string match on the zone alone would be
 * the label-similarity inference this phase exists to avoid, so the bundle must
 * also come from the registered R1-1 source, from a verified consolidation, and
 * from Vancouver. Any one of them wrong and the bundle is some other
 * instrument that happens to mention a district called R1-1.
 */
function classifyBundle(bundle: E85NormalizedRuleBundle): E85VancouverLinkageRejection | undefined {
  if (bundle.jurisdictionId !== VANCOUVER_JURISDICTION_ID) return "JURISDICTION_MISMATCH";
  if (bundle.sourceId !== VANCOUVER_R1_1_SOURCE_ID) return "SOURCE_NOT_R1_1_DISTRICT_SCHEDULE";
  if (bundle.sourceVersionId !== VANCOUVER_R1_1_VERSION_ID) return "VERSION_NOT_VERIFIED";
  if (bundle.zoneDesignation !== VANCOUVER_R1_1_ZONE) return "ZONE_NOT_R1_1";
  return undefined;
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
    if (classifyBundle(bundle) !== undefined) continue;
    const packId = e85RulePackIdFromSource({ sourceId: bundle.sourceId, sourceVersionId: bundle.sourceVersionId });
    const existing = policy[VANCOUVER_LINKED_SPATIAL_DISTRICT];
    // The same instrument supplied twice is one instrument. A repeated read is
    // never corroboration, and never two packs.
    policy[VANCOUVER_LINKED_SPATIAL_DISTRICT] = existing === undefined || !existing.includes(packId) ? [...(existing ?? []), packId].sort() : existing;
  }
  return policy;
}

/** The same derivation, with the reasoning kept, so a caller can report WHY a district did or did not resolve. */
export function auditVancouverLegalLinkage(bundles: readonly E85NormalizedRuleBundle[]): E85VancouverLinkageAudit {
  const rejected: { sourceId: string; sourceVersionId: string; reason: E85VancouverLinkageRejection }[] = [];
  let accepted: E85NormalizedRuleBundle | undefined;
  for (const bundle of bundles) {
    const reason = classifyBundle(bundle);
    if (reason === undefined) accepted = accepted ?? bundle;
    else rejected.push({ sourceId: bundle.sourceId, sourceVersionId: bundle.sourceVersionId, reason });
  }
  const policy = vancouverZoningLinkPolicyFromLegalBundles(bundles);
  const linkedDistricts = Object.keys(policy).sort();
  return {
    linkedDistricts,
    ...(accepted === undefined
      ? {}
      : {
          r11PackId: e85RulePackIdFromSource({ sourceId: accepted.sourceId, sourceVersionId: accepted.sourceVersionId }),
          legalSourceId: accepted.sourceId,
          legalSourceVersionId: accepted.sourceVersionId,
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

/**
 * InvestScape™ E70 Phase 2 — Construction Cost Canonical Taxonomy.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * E70 is a read-only consumer of E68 (src/cre-intelligence/), frozen at v1.0,
 * and does not modify E69 (src/cap-rate-engine/) either. Nothing in this
 * directory imports anything that would require editing an E68 or E69 file;
 * every E68 import below is a plain named type import from E68 source.
 *
 * Resolves E70 Phase 1 Open Design Decision 2 (docs/E70-phase1-technical-
 * specification.md Section 22): the canonical taxonomy lives inside E70, not
 * inside E68 and not as a separate shared package. E68's `mapping.ts`
 * (RLB_SUBTYPE_MAPPING) maps a source's native categories onto the LEGACY
 * front-end vocabulary (DEV_BUILDING_SUBTYPES, which does not exist anywhere
 * importable in this workspace). This file instead maps source-native
 * categories onto an E70-owned canonical taxonomy broad enough to receive
 * more than one publisher's categories without distorting either.
 *
 * HARD RULE (Phase 1 Section 6.3/8, carried forward verbatim): multifamily and
 * industrial have no RLB U.S. line item at all. There is nothing to map, so no
 * mapping table entry exists for them here, and no code path in this file may
 * synthesize one. Do not "improve coverage" by inventing a mapping for a
 * category the source simply does not publish — see mapSourceSubtype's
 * fallback below, which is unsupported by construction, not by omission.
 */

/**
 * A broader, publisher-independent building-type vocabulary. Deliberately
 * more granular than the legacy DEV_BUILDING_SUBTYPES list (Phase 1 Section
 * 8): it has slots for categories RLB actually publishes (hospitality tiers,
 * hospital) that the legacy list has no room for, AND slots for categories no
 * source in this codebase has ever published (multifamily subtypes,
 * industrial) so those gaps have a canonical name to be recorded against
 * rather than being invented ad hoc when a second publisher is added.
 *
 * Adding a new canonical subtype here does NOT imply data exists for it — see
 * SOURCE_SUBTYPE_MAPPINGS below for what is actually mapped today.
 */
export type CanonicalConstructionSubtype =
  | "office_premium"
  | "office_standard"
  | "retail_shopping_center"
  | "retail_strip"
  | "hotel_luxury"
  | "hotel_upscale"
  | "hotel_select_service"
  | "healthcare_hospital"
  | "healthcare_medical_office"
  | "multifamily_low_rise"
  | "multifamily_mid_rise"
  | "multifamily_high_rise"
  | "residential_wood_frame_townhouse"
  | "residential_wood_frame_single_family"
  | "industrial_warehouse"
  | "industrial_light_manufacturing";

/**
 * The four-tier vocabulary this file reuses verbatim from E68's `mapping.ts`
 * (`MappingConfidence`), exactly as E69 already does (comparability-types.ts,
 * `E69MatchLevel`). This is the one genuinely foundational cross-engine
 * concept; redefining it locally with the same four values would only invite
 * drift, so it is imported, not duplicated. E70's own analytical judgment —
 * which source subtype maps to which canonical subtype, and at what
 * confidence — remains entirely E70-owned below.
 */
export type { MappingConfidence } from "../cre-intelligence/mapping";
import type { MappingConfidence } from "../cre-intelligence/mapping";

export interface ConstructionSubtypeMapping {
  canonicalSubtype?: CanonicalConstructionSubtype;
  confidence: MappingConfidence;
  rationale: string;
}

/**
 * Per-publisher source-subtype -> canonical-subtype tables. Keyed by E68
 * `CRESource.sourceId` (e.g. "rlb-north-america") so a second publisher (per
 * Phase 1 Decision 4, Turner & Townsend evaluation is Phase 3 work) adds a
 * sibling table here without touching this one.
 *
 * RLB_SUBTYPE_MAPPING is the direct construction-cost analogue of E68's
 * mapping.ts RLB_SUBTYPE_MAPPING, but mapped onto E70's own canonical
 * taxonomy above rather than the legacy DEV_BUILDING_SUBTYPES vocabulary.
 * Confidence tiers and rationale are re-derived independently for this
 * mapping target (they happen to agree with E68's own tiers in every case
 * here, which is expected — the underlying source facts have not changed —
 * but this table is not a copy; it is evaluated against a different target
 * taxonomy).
 */
export const RLB_SUBTYPE_MAPPING: Readonly<Record<string, ConstructionSubtypeMapping>> = {
  office_prime: {
    canonicalSubtype: "office_premium",
    confidence: "close",
    rationale:
      "RLB 'Prime' office is a construction-cost tier (high-specification new build), not an investment grade. It maps to the canonical 'office_premium' cost tier, but this is NOT CBRE Class A — a cost tier and an investment grade are different classifications and must never be conflated.",
  },
  office_secondary: {
    canonicalSubtype: "office_standard",
    confidence: "close",
    rationale: "RLB 'Secondary' office is the standard-specification cost tier. Same caveat: not a Class B designation.",
  },
  retail_shopping_center: {
    canonicalSubtype: "retail_shopping_center",
    confidence: "exact",
    rationale: "Direct category correspondence — RLB's own label is the canonical label.",
  },
  retail_strip: {
    canonicalSubtype: "retail_strip",
    confidence: "exact",
    rationale: "Direct category correspondence — RLB's own label is the canonical label.",
  },
  hotel_5_star: {
    canonicalSubtype: "hotel_luxury",
    confidence: "close",
    rationale: "RLB '5 Star' is a defined hotel specification tier corresponding to luxury full-service product.",
  },
  hotel_3_star: {
    canonicalSubtype: "hotel_select_service",
    confidence: "approximate",
    rationale:
      "RLB '3 Star' spans midscale through upper-midscale. 'hotel_select_service' is the closest canonical subtype, but the definitions do not align at the edges — this mapping must never be silently treated as 'close' or 'exact'; it requires explicit acknowledgement wherever it is surfaced.",
  },
  hospital_general: {
    canonicalSubtype: "healthcare_hospital",
    confidence: "close",
    rationale: "RLB 'Hospital / General' is acute-care hospital construction; distinct from medical office building (no RLB data exists for the latter).",
  },
};

/**
 * The worked example from Phase 1 (Section 6.3 / Section 8): these canonical
 * subtypes are NOT present as keys anywhere in RLB_SUBTYPE_MAPPING above,
 * because RLB's public North America report has no corresponding line item at
 * all — not because a mapping was overlooked. Listed here explicitly, with
 * rationale, so a future contributor sees the gap was checked rather than
 * assuming it was missed.
 */
/**
 * PHASE 3 NOTE (2026-09-11): a Phase 3 re-fetch of the same RLB Q2 2026
 * North America report surfaced a SECOND cost table (Industrial Warehouse,
 * Parking, Residential Multi-Family/Single-Family, Education) that was not
 * present in the Phase 1 audit's understanding of the source. This
 * potentially contradicts the "RLB publishes no multifamily/industrial line
 * at all" premise below. It is deliberately NOT reflected in the mapping
 * table below yet: the table's column headers extracted across multiple
 * overlapping physical PDF lines with no independently-verified baseline to
 * confirm the column-to-category assignment against (unlike the office/
 * retail/hotel/hospital table, which was cross-validated exactly against
 * E68's existing figures before being trusted for Phase 3's backfill — see
 * src/construction-cost-engine/data/rlb-backfill-q2-2026.ts). Per Phase 3's
 * own instruction ("document it and stop for review rather than silently
 * changing semantics"), this is flagged here and in docs/E70-phase3-
 * coverage-and-source-backfill.md Section 2 for manual verification before
 * any future phase treats RLB multifamily/industrial as supported.
 */
export const KNOWN_UNSUPPORTED_CANONICAL_SUBTYPES: ReadonlyArray<{
  canonicalSubtype: CanonicalConstructionSubtype;
  rationale: string;
}> = [
  {
    canonicalSubtype: "multifamily_low_rise",
    rationale: "RLB's public North America report carries no multifamily/residential line whatsoever — nothing to map.",
  },
  {
    canonicalSubtype: "multifamily_mid_rise",
    rationale: "RLB's public North America report carries no multifamily/residential line whatsoever — nothing to map.",
  },
  {
    canonicalSubtype: "multifamily_high_rise",
    rationale: "RLB's public North America report carries no multifamily/residential line whatsoever — nothing to map.",
  },
  {
    canonicalSubtype: "residential_wood_frame_townhouse",
    rationale: "RLB's public North America report carries no wood-frame residential line whatsoever — nothing to map.",
  },
  {
    canonicalSubtype: "residential_wood_frame_single_family",
    rationale: "RLB's public North America report carries no wood-frame residential line whatsoever — nothing to map.",
  },
  {
    canonicalSubtype: "industrial_warehouse",
    rationale: "No industrial building type in RLB's U.S. Indicative Construction Costs table — nothing to map.",
  },
  {
    canonicalSubtype: "industrial_light_manufacturing",
    rationale: "No industrial building type in RLB's U.S. Indicative Construction Costs table — nothing to map.",
  },
];

const SOURCE_MAPPINGS: Readonly<Record<string, Readonly<Record<string, ConstructionSubtypeMapping>>>> = {
  "rlb-north-america": RLB_SUBTYPE_MAPPING,
};

/**
 * Map a source-native subtype string to E70's canonical taxonomy.
 *
 * `sourceId` must match an E68 `CRESource.sourceId` (e.g. "rlb-north-america").
 * An unknown source, or a subtype unknown to that source's table, is always
 * `unsupported` — never approximated or guessed at. This mirrors E68's own
 * `mapRlbSubtype` fallback rule verbatim: "unknown means unsupported, never
 * approximate."
 */
export function mapSourceSubtype(sourceId: string, sourceSubtype: string | undefined): ConstructionSubtypeMapping {
  if (sourceSubtype === undefined) {
    return {
      confidence: "unsupported",
      rationale: "Observation states no source-native subtype; there is nothing to map.",
    };
  }
  const table = SOURCE_MAPPINGS[sourceId];
  if (table === undefined) {
    return {
      confidence: "unsupported",
      rationale: `No E70 subtype-mapping table exists yet for source "${sourceId}". Unknown source means unsupported, never approximate.`,
    };
  }
  return (
    table[sourceSubtype] ?? {
      confidence: "unsupported",
      rationale: `Source "${sourceId}" has no known mapping for subtype "${sourceSubtype}". Unknown subtype means unsupported, never approximate.`,
    }
  );
}

/** Canonical subtypes with at least one mapping entry at close/exact/approximate confidence, for any registered source. */
export function mappedCanonicalSubtypes(): CanonicalConstructionSubtype[] {
  const seen = new Set<CanonicalConstructionSubtype>();
  for (const table of Object.values(SOURCE_MAPPINGS)) {
    for (const mapping of Object.values(table)) {
      if (mapping.canonicalSubtype !== undefined) seen.add(mapping.canonicalSubtype);
    }
  }
  return [...seen];
}

/**
 * InvestScape™ E86 — compatibility mapping to the application-facing layer.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * E86 is the authoritative normalized source layer. The application's existing
 * CAP_RATE_BENCHMARKS and DEV_BUILDING_SUBTYPES are a *compatibility* layer with
 * a coarser vocabulary. This file is the explicit, tested seam between them, so
 * neither one distorts the other.
 *
 * NOTE FOR REVIEWERS: neither `CAP_RATE_BENCHMARKS` nor `DEV_BUILDING_SUBTYPES`
 * exists anywhere in this workspace (all seven sibling repos were searched on
 * 2026-09-10) — they live in the WeWeb front end. The legacy key vocabulary
 * below is therefore transcribed from the E86 Phase 4 specification rather than
 * imported. If the front-end enum ever moves into a shared package, import it
 * here and delete the local literal union so drift becomes a compile error.
 */
import type { CREAssetClass, CRELocationType, CREPropertyClass } from "./types";

/** The legacy application vocabulary, exactly as the front end expects it. */
export type LegacyCapRateKey =
  | "office_downtown"
  | "office_suburban"
  | "industrial"
  | "multifamily"
  | "retail_neighbourhood";

/** The legacy layer splits class only for office/industrial/multifamily. */
export const LEGACY_CLASS_SPLIT: Readonly<Record<LegacyCapRateKey, boolean>> = {
  office_downtown: true,
  office_suburban: true,
  industrial: true,
  multifamily: true,
  retail_neighbourhood: false,
};

/**
 * How faithfully an E86 dimension survives the trip to a legacy key.
 *
 *   exact       — the source's own classification is the legacy category
 *   close       — a documented, defensible narrowing; safe to auto-surface
 *   approximate — plausible but methodologically unsupported; requires explicit
 *                 acknowledgement and never auto-surfaces
 *   unsupported — no honest mapping exists
 */
export type MappingConfidence = "exact" | "close" | "approximate" | "unsupported";

/** Only these two ever reach the application automatically. */
export const AUTO_SURFACED: readonly MappingConfidence[] = ["exact", "close"];

export function isAutoSurfaceable(confidence: MappingConfidence): boolean {
  return AUTO_SURFACED.includes(confidence);
}

export interface CapRateMappingResult {
  key?: LegacyCapRateKey;
  confidence: MappingConfidence;
  /** Class carried through only where the legacy layer models it. */
  propertyClass?: CREPropertyClass;
  rationale: string;
}

/**
 * Map an E86 asset class + location type onto a legacy cap-rate key.
 *
 * The hard rule: an unspecified locationType does NOT become downtown or
 * suburban. Office without a stated geography type has no legacy key at all,
 * because guessing picks one of two materially different benchmarks.
 */
export function mapToLegacyCapRateKey(input: {
  assetClass: CREAssetClass;
  locationType?: CRELocationType;
  propertyClass?: CREPropertyClass;
}): CapRateMappingResult {
  const { assetClass, locationType = "unspecified", propertyClass = "unspecified" } = input;

  const withClass = (key: LegacyCapRateKey, confidence: MappingConfidence, rationale: string): CapRateMappingResult => ({
    key,
    confidence,
    propertyClass: LEGACY_CLASS_SPLIT[key] ? propertyClass : undefined,
    rationale,
  });

  switch (assetClass) {
    case "office":
      if (locationType === "cbd") {
        return withClass("office_downtown", "exact", "Source states CBD/downtown; legacy office_downtown is the same concept.");
      }
      if (locationType === "suburban") {
        return withClass("office_suburban", "exact", "Source states suburban; legacy office_suburban is the same concept.");
      }
      if (locationType === "urban") {
        return withClass(
          "office_downtown",
          "approximate",
          "Source says 'urban', which overlaps but is not synonymous with CBD — many urban submarkets price closer to suburban. Requires acknowledgement.",
        );
      }
      return {
        confidence: "unsupported",
        rationale:
          "Office with no stated location type. Choosing between office_downtown and office_suburban would be an invented distinction.",
      };

    case "industrial":
      return withClass("industrial", "exact", "Legacy industrial is a single undifferentiated category.");

    case "multifamily":
      return withClass("multifamily", "exact", "Legacy multifamily is a single undifferentiated category.");

    case "retail":
      return withClass(
        "retail_neighbourhood",
        "close",
        "Legacy retail_neighbourhood is the only retail benchmark. Neighbourhood/strip retail maps cleanly; class is intentionally dropped because the legacy layer models no retail class split.",
      );

    default:
      return {
        confidence: "unsupported",
        rationale: `Asset class "${assetClass}" has no legacy cap-rate benchmark. Do not fold it into an unrelated category.`,
      };
  }
}

export interface SubtypeMappingResult {
  legacySubtype?: string;
  confidence: MappingConfidence;
  rationale: string;
}

/**
 * RLB building type -> InvestScape DEV_BUILDING_SUBTYPES.
 *
 * The specification's own worked example is the point of this table: RLB's
 * mid-rise multifamily is NOT automatically "condo 5-12 storey", and in fact
 * RLB's public North America report publishes no multifamily line whatsoever,
 * so that mapping is `unsupported` rather than `approximate`.
 */
export const RLB_SUBTYPE_MAPPING: Readonly<Record<string, SubtypeMappingResult>> = {
  office_prime: {
    legacySubtype: "office_prime",
    confidence: "close",
    rationale:
      "RLB 'Prime' office is a construction-cost tier covering high-specification new build. It maps to a premium office subtype, but it is NOT CBRE Class A — a cost tier and an investment grade are different classifications.",
  },
  office_secondary: {
    legacySubtype: "office_secondary",
    confidence: "close",
    rationale: "RLB 'Secondary' office is the standard-specification cost tier. Same caveat: not a Class B designation.",
  },
  retail_shopping_center: {
    legacySubtype: "retail_shopping_center",
    confidence: "exact",
    rationale: "Direct category correspondence.",
  },
  retail_strip: {
    legacySubtype: "retail_strip",
    confidence: "exact",
    rationale: "Direct category correspondence.",
  },
  hotel_5_star: {
    legacySubtype: "hotel_luxury",
    confidence: "close",
    rationale: "RLB '5 Star' is a defined hotel specification tier corresponding to luxury full-service product.",
  },
  hotel_3_star: {
    legacySubtype: "hotel_select_service",
    confidence: "approximate",
    rationale:
      "RLB '3 Star' spans midscale through upper-midscale. Select-service is the closest InvestScape subtype but the definitions do not align at the edges. Requires explicit acknowledgement.",
  },
  hospital_general: {
    legacySubtype: "healthcare_hospital",
    confidence: "close",
    rationale: "RLB 'Hospital / General' is acute-care hospital construction; distinct from medical office building.",
  },
  multifamily_mid_rise: {
    confidence: "unsupported",
    rationale:
      "RLB's public North America report contains no multifamily building type. There is nothing to map, so 'condo 5-12 storey' cannot be sourced from it — this is the specification's worked example of a mapping that must not be faked.",
  },
  industrial_warehouse: {
    confidence: "unsupported",
    rationale: "No industrial building type in the RLB U.S. Indicative Construction Costs table.",
  },
};

export function mapRlbSubtype(subtype: string): SubtypeMappingResult {
  return (
    RLB_SUBTYPE_MAPPING[subtype] ?? {
      confidence: "unsupported",
      rationale: `Unknown RLB subtype "${subtype}". Unknown means unsupported, never approximate.`,
    }
  );
}

/** Subtypes safe to publish to the application without a developer opt-in. */
export function autoSurfaceableSubtypes(): string[] {
  return Object.entries(RLB_SUBTYPE_MAPPING)
    .filter(([, result]) => isAutoSurfaceable(result.confidence))
    .map(([subtype]) => subtype);
}

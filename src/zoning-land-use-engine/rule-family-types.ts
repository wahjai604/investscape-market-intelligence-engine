/**
 * InvestScape™ E85 Phase 3 — Zoning & Land-Use Rules Engine: rule family
 * taxonomy.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Six rule families, independently representable (Phase 2 correction 7):
 * use, density, dimensional, parking, amenity, overlay. No jurisdiction is
 * forced to support every family — "unsupported" (this jurisdiction has no
 * concept of this family at all, e.g. no parking-bylaw concept) and
 * "unavailable" (the jurisdiction has the concept but E85 lacks evidence
 * for this parcel) are different facts, modelled via
 * `E85RuleFamilySupport` rather than by silently omitting a field.
 *
 * These are TYPE-LEVEL CONTRACTS ONLY — no rule evaluation logic. A
 * "DensityRule" record here is a structured container for a density rule's
 * terms as found in evidence, not a calculator.
 */
import type { E85Evidence } from "./evidence-types";
import type { E85UsePermission } from "./use-taxonomy";

/** Whether a jurisdiction supports a given rule family concept at all, independent of whether evidence exists for a specific parcel (Phase 2 correction 7). */
export type E85RuleFamilySupport =
  /** The jurisdiction has this rule-family concept and evidence exists for it (subject to per-parcel resolution). */
  | "SUPPORTED"
  /** The jurisdiction has no concept corresponding to this rule family at all (e.g. no parking bylaw exists). Not a gap — a genuine fact about the jurisdiction. */
  | "NOT_APPLICABLE_TO_JURISDICTION"
  /** The jurisdiction has the concept, but E85 has not yet determined support/evidence for it. */
  | "SUPPORT_UNDETERMINED";

export type E85RuleFamily = "USE" | "DENSITY" | "DIMENSIONAL" | "PARKING" | "AMENITY" | "OVERLAY";

interface E85RuleRecordBase {
  jurisdictionId: string;
  /** Raw zone designation this rule record applies to, e.g. "RS-1". */
  zoneDesignation: string;
}

/** Use rule: the set of use-permission determinations for a zone. Independently representable from every other family — a jurisdiction may have use rules with no density/dimensional rules resolved at all, and vice versa (Phase 2 correction 7). */
export interface E85UseRule extends E85RuleRecordBase {
  family: "USE";
  permissions: readonly E85Evidence<E85UsePermission>[];
}

/** Density rule: FSR and/or other density metrics as stated by the source, never computed. */
export interface E85DensityRule extends E85RuleRecordBase {
  family: "DENSITY";
  /** Maximum floor space ratio as stated by the source, e.g. 0.6. Nullable/optional — absence must be paired with a DATA_GAP record, never defaulted to 0 or unlimited (Phase 2 correction 10). */
  maxFsr?: E85Evidence<number>;
  /** Maximum density expressed in units/hectare or units/acre, when the source states density that way instead of/in addition to FSR. */
  maxDensityUnitsPerArea?: E85Evidence<number>;
}

/** Dimensional rule: height, storeys, setbacks/yards, site coverage — the classic "envelope" dimensions found in a district schedule. */
export interface E85DimensionalRule extends E85RuleRecordBase {
  family: "DIMENSIONAL";
  maxHeightMetres?: E85Evidence<number>;
  maxStoreys?: E85Evidence<number>;
  /** Setback/yard requirements keyed by yard name as the source names it (e.g. "front", "rear", "side", "flanking side"), in metres. */
  setbacksMetres?: Readonly<Record<string, E85Evidence<number>>>;
  /** Maximum site coverage as a fraction (0-1) of site area, as stated by the source. */
  maxSiteCoverageFraction?: E85Evidence<number>;
}

/** Parking rule: off-street parking/loading requirements. A jurisdiction with NO parking bylaw concept reports `E85RuleFamilySupport = "NOT_APPLICABLE_TO_JURISDICTION"` at the coverage level rather than an empty ParkingRule (Phase 2 correction 7). */
export interface E85ParkingRule extends E85RuleRecordBase {
  family: "PARKING";
  /** Minimum required parking spaces per unit of measure, keyed by use category as named at the source (e.g. "dwelling_unit", "retail_per_100sqm"). */
  minSpacesPerUse?: Readonly<Record<string, E85Evidence<number>>>;
  /** Maximum permitted parking spaces, when the source states a maximum (some jurisdictions cap parking rather than only requiring a minimum). */
  maxSpacesPerUse?: Readonly<Record<string, E85Evidence<number>>>;
}

/** Amenity rule: required amenity space, public art, childcare, or other amenity-contribution requirements tied to zoning/development approval. */
export interface E85AmenityRule extends E85RuleRecordBase {
  family: "AMENITY";
  /** Amenity requirements keyed by amenity type as named at the source (e.g. "indoor_amenity_sqm_per_unit", "public_art_contribution"). Values are free-form because amenity requirement units vary widely by jurisdiction and category. */
  requirements?: Readonly<Record<string, E85Evidence<string>>>;
}

/** Overlay rule: an additional regulatory layer on top of base zoning (e.g. a Development Permit Area, heritage conservation area, or comprehensive-development-specific condition). Overlay precedence relative to base zoning is NOT resolved by this type — an unresolved precedence conflict is represented as a manual-review reason (`OVERLAY_PRECEDENCE_UNRESOLVED`) or a data gap (`OVERLAY_DATA_MISSING`), never silently decided by the type. */
export interface E85OverlayRule extends E85RuleRecordBase {
  family: "OVERLAY";
  overlayDesignation: string;
  /** Free-text description of what the overlay modifies (e.g. "requires Development Permit; imposes additional design guidelines"), sourced from the overlay's own governing document. */
  description?: E85Evidence<string>;
}

export type E85RuleRecord = E85UseRule | E85DensityRule | E85DimensionalRule | E85ParkingRule | E85AmenityRule | E85OverlayRule;

/** Per-jurisdiction, per-family support map — lets E85 state "this jurisdiction has no parking-bylaw concept" as a distinct fact from "we have no evidence yet." */
export type E85RuleFamilyCoverage = Readonly<Record<E85RuleFamily, E85RuleFamilySupport>>;

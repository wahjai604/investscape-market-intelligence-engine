/**
 * InvestScape™ E86 Phase 5 — application-facing benchmark types.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Everything downstream of an E86 observation, on the way to something an
 * application can render. Deliberately keeps the chain visible:
 *
 *   RAW SOURCE -> E86 OBSERVATION -> VALIDATION -> QUALIFICATION
 *     -> E86 BENCHMARK -> APPLICATION MAPPING -> INVESTSCAPE APPLICATION
 *
 * A `CREBenchmark` is not a raw observation and not a single number: it is a
 * benchmark identity (geography/asset class/subtype/class/period) plus the
 * observation(s) that back it, so any UI value is traceable back to source.
 */
import type {
  CRECapRateType,
  CREAssetClass,
  CREGeography,
  CRELocationType,
  CREPropertyClass,
} from "./types";
import type { MappingConfidence } from "./mapping";

export type BenchmarkMetric = "cap_rate" | "hard_cost" | "soft_cost";

/**
 * Whether the number a caller is looking at is exactly what the publisher
 * printed, or something E86 computed from what the publisher printed. Must
 * survive every transformation — see `deriveMidpoint` below and Part 5 of the
 * Phase 5 spec. Never collapse this distinction to save a field.
 */
export type ValueProvenance = "publisher_supplied" | "e86_derived" | "user_override" | "application_default";

/**
 * A publisher range, kept verbatim. E86 never replaces this with a single
 * number in place — see `DerivedValue`.
 */
export interface PublisherRange {
  low: number;
  high: number;
  unit: string;
}

/**
 * A single number E86 (or a user, or the application) computed FROM a
 * publisher range or another value. `sourceSupplied: false` always accompanies
 * `e86_derived`/`application_default`/`user_override` — this field exists so a
 * consumer can never accidentally treat a derived value as if the publisher
 * printed it.
 */
export interface DerivedValue {
  value: number;
  unit: string;
  derivationMethod: string;
  provenance: ValueProvenance;
  sourceSupplied: boolean;
}

/** One underlying E86 observation, as much as an application needs to show "why". */
export interface BenchmarkProvenanceEntry {
  observationId: string;
  sourceId: string;
  sourceName: string;
  reportTitle: string;
  publicationDate: string;
  period: string;
  locator: string;
  sourceUrl: string;
  qualification: MappingConfidence;
  methodologyNote?: string;
}

export type BenchmarkStatus = "AVAILABLE" | "AVAILABLE_WITH_WARNING" | "DATA_GAP";

/**
 * The stable identity of a benchmark slot the application can ask for. Two
 * requests with the same identity should always resolve to the same
 * observation set (selection is deterministic — Part 3).
 */
export interface BenchmarkIdentity {
  metric: BenchmarkMetric;
  country: "US" | "CA";
  city: string;
  assetClass: CREAssetClass;
  propertySubtype?: string;
  propertyClass?: CREPropertyClass;
  locationType?: CRELocationType;
  capRateType?: CRECapRateType;
}

/**
 * The full application-facing response for one benchmark request. Shape
 * mirrors the Phase 5 spec's Part 15 example, adapted to E86's actual
 * publisher-range-vs-derived-value distinction rather than a flat
 * value/low/high.
 */
export interface CREBenchmarkResponse {
  status: BenchmarkStatus;
  identity: BenchmarkIdentity;

  /** Present only when status !== "DATA_GAP". */
  publisherRange?: PublisherRange;
  /** Present only when status !== "DATA_GAP" and the source published a point value. */
  publisherValue?: { value: number; unit: string };
  /** Present only when a single number was explicitly derived (e.g. midpoint). Never implied. */
  derivedBenchmark?: DerivedValue;

  qualification?: MappingConfidence;
  mappedLegacyKey?: string;
  warnings: string[];

  provenance: BenchmarkProvenanceEntry[];

  /** Present only when status === "DATA_GAP". */
  dataGap?: {
    reason: string;
    sourcesInvestigated: string[];
    lastResearchDate: string;
  };
}

/**
 * A user-entered value standing in for an E86 benchmark. Never mutates the
 * underlying observation — see Part 11. `source: "USER"` is what a consumer
 * checks to know this did NOT come from E86 research.
 */
export interface UserOverride {
  source: "USER";
  overrideValue: number;
  overrideReason: string;
  overrideTimestamp: string;
  originalE86Value?: number;
  originalE86Identity?: BenchmarkIdentity;
}

/**
 * Result of resolving a benchmark slot when a user override may be in play.
 * `active` says which value an application should actually use; `e86` and
 * `override` are both retained so a UI can show "using your override of X,
 * E86 benchmark was Y" without losing either number.
 */
export interface ResolvedBenchmark {
  active: "e86" | "override" | "application_default";
  e86?: CREBenchmarkResponse;
  override?: UserOverride;
  applicationDefaultReason?: string;
}

/** Soft costs: E86 currently has no verified dataset. Never fabricate a percentage. */
export interface SoftCostResponse {
  status: "SOFT_COST_DATA_NOT_AVAILABLE";
  identity: Pick<BenchmarkIdentity, "country" | "city" | "assetClass" | "propertySubtype">;
  reason: string;
}

/**
 * A legacy (pre-E86) benchmark value found in an application without
 * traceable provenance. Per Part 10, this must never masquerade as an E86
 * value. `NULL` when the application architecture wants the field cleared,
 * `LEGACY_UNVERIFIED` when it wants the old value retained but flagged.
 */
export type LegacyClassification = "NULL" | "LEGACY_UNVERIFIED";

export interface LegacyBenchmarkAudit {
  legacyValue: unknown;
  hasSource: boolean;
  hasValidMapping: boolean;
  classification: LegacyClassification;
  reason: string;
}

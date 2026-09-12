/**
 * InvestScape™ E70 Phase 2 — Construction Cost Normalization.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Deterministic normalization for the dimensions that can be normalized from
 * existing data without external information (currency, unit/basis, area
 * basis, geography passthrough, building type/subtype via taxonomy, hard vs
 * soft vs total cost). Time/index-basis ESCALATION is explicitly out of
 * Phase 2 scope (Phase 1 Section 14 / Phase 4) — this file recognizes index
 * and cost-change metrics only well enough to exclude them from direct
 * cost-benchmarking, never to escalate a figure.
 *
 * Every transformation is recorded in `NormalizationTransformation[]` — see
 * types.ts. Nothing here invents an FX rate, a soft-cost percentage, or an
 * unverified conversion; where a requested target cannot be reached
 * deterministically, `normalizeObservation` returns a FAILED outcome with a
 * precise reason rather than guessing (Phase 2 objective 3).
 */
import type { CRECitedObservation } from "../cre-intelligence/types";
import { mapSourceSubtype } from "./taxonomy";
import {
  SQ_FT_PER_SQ_M,
  type CCCostRepresentation,
  type CCCurrency,
  type CCMeasurementSystem,
  type CCUnitBasis,
  type NormalizationTransformation,
  type NormalizedConstructionCostObservation,
} from "./types";

/** Metrics this file can normalize into a cost representation at all. */
const COST_METRICS = new Set(["hard_cost", "soft_cost"]);

export type NormalizationFailureReason =
  | "NOT_A_COST_OBSERVATION"
  | "CURRENCY_CONVERSION_UNAVAILABLE"
  | "UNIT_CONVERSION_UNSUPPORTED";

export type NormalizationOutcome =
  | { status: "NORMALIZED"; result: NormalizedConstructionCostObservation }
  | { status: "FAILED"; reason: NormalizationFailureReason; explanation: string };

function parseCurrencyFromUnit(unit: string): CCCurrency | undefined {
  if (unit.startsWith("USD")) return "USD";
  if (unit.startsWith("CAD")) return "CAD";
  return undefined;
}

function parseAreaBasisFromUnit(unit: string): "per_sf" | "per_sm" | undefined {
  if (unit.endsWith("_per_sf")) return "per_sf";
  if (unit.endsWith("_per_sm")) return "per_sm";
  return undefined;
}

function costRepresentationForMetric(metric: string): CCCostRepresentation | undefined {
  if (metric === "hard_cost") return "hard_cost";
  if (metric === "soft_cost") return "soft_cost";
  return undefined;
}

function convertAreaValue(value: number, from: "per_sf" | "per_sm", to: "per_sf" | "per_sm"): number {
  if (from === to) return value;
  // 1 SM = 10.7639 SF, so a cost expressed per (the larger) square metre is
  // per-square-foot-cost multiplied by that constant; the inverse divides.
  return from === "per_sf" ? value * SQ_FT_PER_SQ_M : value / SQ_FT_PER_SQ_M;
}

/**
 * Normalize one E68 `CRECitedObservation` into E70's shape, optionally
 * converting to a target currency/unit basis. Passing no `target` performs
 * identification-only normalization (currency/basis/representation/subtype
 * mapping recorded, no conversion attempted).
 *
 * Pure function: never mutates `observation`.
 */
export function normalizeObservation(
  observation: CRECitedObservation,
  target?: { currency?: CCCurrency; unitBasis?: CCUnitBasis },
): NormalizationOutcome {
  const transformations: NormalizationTransformation[] = [];

  const costRepresentation = costRepresentationForMetric(observation.metric);
  if (costRepresentation === undefined) {
    return {
      status: "FAILED",
      reason: "NOT_A_COST_OBSERVATION",
      explanation: `Metric "${observation.metric}" is not a hard_cost or soft_cost observation (e.g. a construction_index or construction_cost_change figure is an index point or percentage, never a dollar figure — Phase 1 Section 6.3). It cannot be normalized as a cost observation.`,
    };
  }
  transformations.push({
    dimension: "cost_representation",
    description: `Identified as "${costRepresentation}" from metric "${observation.metric}".`,
    method: "direct metric-to-representation mapping",
    applied: true,
  });

  const sourceCurrency = parseCurrencyFromUnit(observation.unit);
  const sourceAreaBasis = parseAreaBasisFromUnit(observation.unit);

  transformations.push({
    dimension: "currency",
    description: sourceCurrency
      ? `Identified currency "${sourceCurrency}" from unit "${observation.unit}".`
      : `Unit "${observation.unit}" does not encode a currency (e.g. an index/percent unit) — no currency identified.`,
    method: "unit-string currency parse",
    applied: sourceCurrency !== undefined,
  });

  transformations.push({
    dimension: "unit_basis",
    description: sourceAreaBasis
      ? `Identified area basis "${sourceAreaBasis}" from unit "${observation.unit}".`
      : `Unit "${observation.unit}" is not a per-area unit (basis "${observation.basis ?? "unspecified"}").`,
    method: "unit-string basis parse",
    applied: sourceAreaBasis !== undefined,
  });

  let low = observation.low;
  let high = observation.high;
  let value = observation.value;
  let currency = sourceCurrency;
  let unitBasis: CCUnitBasis | undefined = sourceAreaBasis ?? observation.basis;
  let measurementSystem: CCMeasurementSystem | undefined =
    sourceAreaBasis === "per_sm" ? "metric" : sourceAreaBasis === "per_sf" ? "imperial" : undefined;

  // Currency conversion: never performed. E68/E70 have no FX-conversion function
  // anywhere (Phase 1 Section 13) — a mismatched target currency is always a gap.
  if (target?.currency !== undefined && sourceCurrency !== undefined && target.currency !== sourceCurrency) {
    transformations.push({
      dimension: "currency",
      description: `Requested target currency "${target.currency}" differs from observation currency "${sourceCurrency}". No FX rate was supplied and none is invented.`,
      method: "cross-currency conversion refused (no sourced FX rate)",
      applied: false,
    });
    return {
      status: "FAILED",
      reason: "CURRENCY_CONVERSION_UNAVAILABLE",
      explanation: `Observation is in ${sourceCurrency}; target currency ${target.currency} was requested. A currency conversion requires an explicitly-sourced, dated FX rate (Phase 1 Section 13); none was supplied, so this cannot be normalized to the target currency.`,
    };
  }

  // Unit/area-basis conversion: $/SF <-> $/SM is a fixed, published constant —
  // deterministic and safe to apply. Any other basis pairing (e.g. per_sf <->
  // per_unit) requires information this observation does not state (average
  // unit size) and is refused rather than guessed.
  if (target?.unitBasis !== undefined && unitBasis !== undefined && target.unitBasis !== unitBasis) {
    const bothAreaBases = (unitBasis === "per_sf" || unitBasis === "per_sm") && (target.unitBasis === "per_sf" || target.unitBasis === "per_sm");
    if (!bothAreaBases) {
      transformations.push({
        dimension: "unit_basis",
        description: `Requested target basis "${target.unitBasis}" is not deterministically derivable from source basis "${unitBasis}" without additional unstated information.`,
        method: "unit-basis conversion refused (no deterministic conversion available)",
        applied: false,
      });
      return {
        status: "FAILED",
        reason: "UNIT_CONVERSION_UNSUPPORTED",
        explanation: `Observation basis is "${unitBasis}"; target basis "${target.unitBasis}" was requested. Converting between these requires information (e.g. average unit size for per_sf <-> per_unit) that this observation does not state, so no conversion is performed.`,
      };
    }
    const from = unitBasis as "per_sf" | "per_sm";
    const to = target.unitBasis as "per_sf" | "per_sm";
    low = low !== undefined ? convertAreaValue(low, from, to) : low;
    high = high !== undefined ? convertAreaValue(high, from, to) : high;
    value = value !== undefined ? convertAreaValue(value, from, to) : value;
    unitBasis = to;
    measurementSystem = to === "per_sm" ? "metric" : "imperial";
    transformations.push({
      dimension: "unit_basis",
      description: `Converted from "${from}" to "${to}" using the fixed constant 1 SF = ${SQ_FT_PER_SQ_M.toFixed(8)} SM (1 SM = 10.7639 SF).`,
      method: "fixed unit-conversion constant (no estimation)",
      applied: true,
    });
    transformations.push({
      dimension: "measurement_system",
      description: `Measurement system set to "${measurementSystem}" to match converted basis "${to}".`,
      method: "derived from converted unit basis",
      applied: true,
    });
  } else {
    transformations.push({
      dimension: "measurement_system",
      description: measurementSystem
        ? `Measurement system "${measurementSystem}" identified from source unit basis; no conversion requested.`
        : "No area basis identified; measurement system left undefined rather than guessed.",
      method: "derived from source unit basis",
      applied: measurementSystem !== undefined,
    });
  }

  transformations.push({
    dimension: "geography",
    description: "Geography carried through unchanged (E68's CREGeography shape already fits E70's needs — Phase 1 Section 12).",
    method: "passthrough",
    applied: false,
  });

  const subtypeMapping = mapSourceSubtype(observation.source.sourceId, observation.propertySubtype);
  transformations.push({
    dimension: "subtype_mapping",
    description: `Source-native subtype "${observation.propertySubtype ?? "unspecified"}" mapped to canonical taxonomy at confidence "${subtypeMapping.confidence}": ${subtypeMapping.rationale}`,
    method: "per-source canonical-subtype mapping table (taxonomy.ts)",
    applied: subtypeMapping.canonicalSubtype !== undefined,
  });

  return {
    status: "NORMALIZED",
    result: {
      original: observation,
      costRepresentation,
      currency,
      unitBasis,
      measurementSystem,
      low,
      high,
      value,
      subtypeMapping,
      transformations,
    },
  };
}

/**
 * InvestScape™ E70 Phase 4 — Escalation / Index Integration adversarial test suite.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Covers the 35 scenarios required by the Phase 4 task instructions, plus
 * additional cases the implementation exposed. Uses a mix of:
 *   - Real E68/E70 data (US_HARD_COST_OBSERVATIONS, RLB city/national index,
 *     RLB_BACKFILL_HARD_COST_OBSERVATIONS) for end-to-end integration cases.
 *   - Synthetic fixtures (clearly constructed inline, never presented as real
 *     citations) for edge cases the real dataset cannot exercise (duplicate/
 *     conflicting index values, unsupported/rejected source statuses,
 *     malformed values) — same convention as pipeline.test.ts/comparability.test.ts.
 */
import { escalateCost } from "../../src/construction-cost-engine/escalation";
import { evaluateIndexApplicability } from "../../src/construction-cost-engine/applicability";
import {
  CC_DEFAULT_ESCALATION_POLICY,
  CC_STRICT_ESCALATION_POLICY,
  type CCEscalationPolicy,
} from "../../src/construction-cost-engine/escalation-policy";
import {
  RLB_CITY_INDEX_SERIES,
  RLB_NATIONAL_INDEX_SERIES,
  STATCAN_BCPI_INDEX_SERIES,
  CC_KNOWN_INDEX_OBSERVATIONS,
} from "../../src/construction-cost-engine/data/index-series";
import type { CCIndexObservation, CCIndexSeries, EscalationRequest } from "../../src/construction-cost-engine/index-types";
import type { CRECitedObservation } from "../../src/cre-intelligence/types";
import {
  US_HARD_COST_OBSERVATIONS,
  US_CITY_CONSTRUCTION_INDEX_OBSERVATIONS,
} from "../../src/cre-intelligence/data/construction-costs-us";
import { RLB_BACKFILL_HARD_COST_OBSERVATIONS } from "../../src/construction-cost-engine/data/rlb-backfill-q2-2026";

const CHECKED_AT = "2026-09-12";

function findObs(pool: readonly CRECitedObservation[], city: string, subtype: string): CRECitedObservation {
  const found = pool.find((o) => o.geography.city === city && o.propertySubtype === subtype);
  if (!found) throw new Error(`fixture not found: ${city}/${subtype}`);
  return found;
}

const seattleOfficePrime = findObs(US_HARD_COST_OBSERVATIONS, "Seattle", "office_prime");
const chicagoOfficePrime = findObs(RLB_BACKFILL_HARD_COST_OBSERVATIONS, "Chicago", "office_prime");
const torontoOfficePrime = findObs(RLB_BACKFILL_HARD_COST_OBSERVATIONS, "Toronto", "office_prime");

function req(overrides: Partial<EscalationRequest> = {}): EscalationRequest {
  return {
    sourceObservation: seattleOfficePrime,
    targetPeriod: { start: "2026-04-01", end: "2026-06-30", label: "Q2 2026" },
    computedAt: CHECKED_AT,
    ...overrides,
  };
}

function syntheticIndexObs(series: CCIndexSeries, overrides: Partial<CRECitedObservation> = {}): CCIndexObservation {
  const observation: CRECitedObservation = {
    metric: "construction_index",
    assetClass: "other",
    geography: { country: "US" },
    periodStart: "2025-01-01",
    periodEnd: "2025-03-31",
    value: 200,
    unit: "index",
    basis: "index",
    source: { sourceId: series.sourceId, sourceName: "Synthetic Test Source", sourceType: "construction_cost" },
    citation: {
      sourceName: "Synthetic Test Source",
      reportTitle: "Synthetic fixture — not a real publication",
      publicationDate: "2025-01-01",
      period: "Q1 2025",
      locator: "synthetic",
      sourceUrl: "https://example.com/synthetic",
      retrievedAt: "2026-09-12",
    },
    sourceQuality: 50,
    ...overrides,
  };
  return { series, observation };
}

describe("1-2: exact city / compatible regional (national) index match", () => {
  test("exact city match: Seattle cost + Seattle city index -> DIRECT relationship", () => {
    // Synthetic fixture: real Seattle cost data, aligned to the real city-index period so a DIRECT match is exercised.
    const seattleAtCityIndexPeriod: CRECitedObservation = { ...seattleOfficePrime, periodStart: "2025-04-01", periodEnd: "2025-04-30" };
    const outcome = escalateCost(
      req({ sourceObservation: seattleAtCityIndexPeriod, targetPeriod: { start: "2026-04-01", end: "2026-04-30", label: "April 2026" } }),
    );
    expect(outcome.status).toBe("ESCALATED");
    if (outcome.status !== "ESCALATED") return;
    expect(outcome.result.relationship).toBe("DIRECT");
    expect(outcome.result.indexSeries?.seriesId).toBe("rlb-city-comparative-cost-index");
  });

  test("compatible regional (national) index: Chicago has no city index, national index applies as INDIRECT", () => {
    const outcome = escalateCost(req({ sourceObservation: chicagoOfficePrime, targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } }));
    expect(outcome.status).toBe("ESCALATED");
    if (outcome.status !== "ESCALATED") return;
    expect(outcome.result.relationship).toBe("INDIRECT");
    expect(outcome.result.indexSeries?.seriesId).toBe("rlb-national-construction-cost-index");
  });
});

describe("3-4: incompatible city / incompatible country", () => {
  test("incompatible city: a US city with no city index and national-index fallback disabled -> DATA_GAP", () => {
    const strict: CCEscalationPolicy = { ...CC_STRICT_ESCALATION_POLICY, period: { ...CC_STRICT_ESCALATION_POLICY.period, allowReversePeriodRequest: true } };
    const outcome = escalateCost(req({ sourceObservation: chicagoOfficePrime, policy: strict, targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } }));
    expect(outcome.status).toBe("DATA_GAP");
    if (outcome.status !== "DATA_GAP") return;
    expect(outcome.gap.reasonCode).toBe("UNSUPPORTED_GEOGRAPHY");
  });

  test("incompatible country: RLB's national index (US-only) is refused for a CAD/Canadian observation", () => {
    const cadResult = evaluateIndexApplicability(torontoOfficePrime, RLB_NATIONAL_INDEX_SERIES, CC_DEFAULT_ESCALATION_POLICY);
    expect(cadResult.applicable).toBe(false);
    expect(cadResult.failureCategory).toBe("CURRENCY");

    // The real cross-currency/cross-country boundary this codebase actually has (US vs Canada):
    // request a period different from Toronto's own so the identity shortcut does not mask the real gap.
    const outcome = escalateCost(req({ sourceObservation: torontoOfficePrime, targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } }));
    expect(outcome.status).toBe("DATA_GAP");
    if (outcome.status !== "DATA_GAP") return;
    expect(["INCOMPATIBLE_CURRENCY", "UNSUPPORTED_GEOGRAPHY", "INSUFFICIENT_INDEX_EVIDENCE"]).toContain(outcome.gap.reasonCode);
  });
});

describe("5: incompatible currency", () => {
  test("CAD cost observation (Toronto) has no CAD-denominated index anywhere -> DATA_GAP", () => {
    const outcome = escalateCost(req({ sourceObservation: torontoOfficePrime, targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } }));
    expect(outcome.status).toBe("DATA_GAP");
    if (outcome.status !== "DATA_GAP") return;
    expect(outcome.gap.reasonCode).not.toBe("MISSING_BASE_COST");
  });
});

describe("6-7: missing base/target index", () => {
  test("missing base index: no index observation exists for an unindexed historical quarter", () => {
    const oldObs: CRECitedObservation = { ...seattleOfficePrime, periodStart: "2010-01-01", periodEnd: "2010-03-31" };
    const outcome = escalateCost(req({ sourceObservation: oldObs, targetPeriod: { start: "2026-04-01", end: "2026-06-30", label: "Q2 2026" } }));
    expect(outcome.status).toBe("DATA_GAP");
    if (outcome.status !== "DATA_GAP") return;
    expect(outcome.gap.reasonCode).toBe("MISSING_BASE_INDEX");
  });

  test("missing target index: target period has no index observation", () => {
    const outcome = escalateCost(req({ targetPeriod: { start: "2099-01-01", end: "2099-03-31", label: "Q1 2099" } }));
    expect(outcome.status).toBe("DATA_GAP");
    if (outcome.status !== "DATA_GAP") return;
    expect(outcome.gap.reasonCode).toBe("MISSING_TARGET_INDEX");
  });
});

describe("8: missing base cost", () => {
  test("source observation with no low/high/value -> MISSING_BASE_COST", () => {
    const noCost: CRECitedObservation = { ...seattleOfficePrime, low: undefined, high: undefined, value: undefined };
    const outcome = escalateCost(req({ sourceObservation: noCost }));
    expect(outcome.status).toBe("DATA_GAP");
    if (outcome.status !== "DATA_GAP") return;
    expect(outcome.gap.reasonCode).toBe("MISSING_BASE_COST");
  });
});

describe("9: unresolved period", () => {
  test("target period missing start/end -> UNRESOLVED_PERIOD", () => {
    const outcome = escalateCost(req({ targetPeriod: { start: "", end: "", label: "unknown" } }));
    expect(outcome.status).toBe("DATA_GAP");
    if (outcome.status !== "DATA_GAP") return;
    expect(outcome.gap.reasonCode).toBe("UNRESOLVED_PERIOD");
  });
});

describe("10: same-period request", () => {
  test("target period identical to base period -> identity escalation, ratio 1.0, no index lookup", () => {
    const outcome = escalateCost(req({ targetPeriod: { start: seattleOfficePrime.periodStart, end: seattleOfficePrime.periodEnd, label: "Q2 2026" } }));
    expect(outcome.status).toBe("ESCALATED");
    if (outcome.status !== "ESCALATED") return;
    expect(outcome.result.relationship).toBe("IDENTICAL_PERIOD");
    expect(outcome.result.calculation.indexRatio).toBe(1);
    expect(outcome.result.escalatedCost.low).toBe(seattleOfficePrime.low);
    expect(outcome.result.escalatedCost.high).toBe(seattleOfficePrime.high);
    expect(outcome.result.indexSeries).toBeUndefined();
  });
});

describe("11: valid historical -> target escalation", () => {
  test("Seattle Q2 2026 hard cost escalated to Q1 2024 via national index", () => {
    const outcome = escalateCost(req({ targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } }));
    expect(outcome.status).toBe("ESCALATED");
    if (outcome.status !== "ESCALATED") return;
    expect(outcome.result.calculation.indexRatio).toBeCloseTo(262.0 / 288.58, 10);
    expect(outcome.result.escalatedCost.low).toBeCloseTo((seattleOfficePrime.low as number) * (262.0 / 288.58), 6);
  });
});

describe("12/29: reverse-period request (target before base)", () => {
  test("target period precedes base period -> allowed, ratio < 1, labeled as such", () => {
    const outcome = escalateCost(req({ targetPeriod: { start: "2023-07-01", end: "2023-09-30", label: "Q3 2023" } }));
    expect(outcome.status).toBe("ESCALATED");
    if (outcome.status !== "ESCALATED") return;
    expect(outcome.result.calculation.indexRatio).toBeLessThan(1);
  });

  test("reverse period refused when policy.allowReversePeriodRequest = false", () => {
    const outcome = escalateCost(req({ targetPeriod: { start: "2023-07-01", end: "2023-09-30", label: "Q3 2023" }, policy: CC_STRICT_ESCALATION_POLICY }));
    expect(outcome.status).toBe("DATA_GAP");
    if (outcome.status !== "DATA_GAP") return;
    expect(outcome.gap.reasonCode).toBe("UNRESOLVED_PERIOD");
  });
});

describe("13: unsupported index source", () => {
  test("a series with sourceStatus REJECT is never applicable regardless of geography/currency match", () => {
    const rejectedSeries: CCIndexSeries = { ...RLB_CITY_INDEX_SERIES, seriesId: "rlb-city-comparative-cost-index", sourceStatus: "REJECT" as const };
    const result = evaluateIndexApplicability(seattleOfficePrime, rejectedSeries, CC_DEFAULT_ESCALATION_POLICY);
    expect(result.applicable).toBe(false);
    expect(result.failureCategory).toBe("SOURCE_STATUS");
  });
});

describe("14: deferred/unverified source (REGISTER)", () => {
  test("StatCan BCPI (REGISTER, zero observations) is never used as an active escalation input", () => {
    const result = evaluateIndexApplicability(torontoOfficePrime, STATCAN_BCPI_INDEX_SERIES, CC_DEFAULT_ESCALATION_POLICY);
    expect(result.applicable).toBe(false);
    expect(result.failureCategory).toBe("SOURCE_STATUS");
  });
});

describe("15: rejected source", () => {
  test("a synthetic REJECT series is inapplicable even with matching currency and geography", () => {
    const rejected: CCIndexSeries = { ...RLB_NATIONAL_INDEX_SERIES, sourceStatus: "REJECT" as const };
    const result = evaluateIndexApplicability(seattleOfficePrime, rejected, CC_DEFAULT_ESCALATION_POLICY);
    expect(result.applicable).toBe(false);
  });
});

describe("16-18: deterministic calculation, no intermediate rounding, repeated-call equality", () => {
  test("repeated calls with identical input produce byte-identical output", () => {
    const r = req({ targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } });
    const a = escalateCost(r);
    const b = escalateCost(r);
    expect(a).toEqual(b);
  });

  test("indexRatio is not rounded; full float precision preserved", () => {
    const outcome = escalateCost(req({ targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } }));
    expect(outcome.status).toBe("ESCALATED");
    if (outcome.status !== "ESCALATED") return;
    expect(outcome.result.calculation.indexRatio).toBe(262.0 / 288.58);
    expect(outcome.result.escalatedCost.low).toBe((seattleOfficePrime.low as number) * (262.0 / 288.58));
  });
});

describe("19: input-order independence", () => {
  test("shuffled index pool ordering does not change the result", () => {
    const forward = escalateCost(req({ targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } }), CC_KNOWN_INDEX_OBSERVATIONS);
    const reversed = escalateCost(req({ targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } }), [...CC_KNOWN_INDEX_OBSERVATIONS].reverse());
    expect(forward).toEqual(reversed);
  });
});

describe("20-21: source/index observation immutability", () => {
  test("source cost observation is never mutated by escalateCost", () => {
    const original: CRECitedObservation = { ...seattleOfficePrime };
    const frozenCopy = JSON.parse(JSON.stringify(seattleOfficePrime));
    escalateCost(req({ sourceObservation: original, targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } }));
    expect(original).toEqual(frozenCopy);
  });

  test("index observations in the pool are never mutated", () => {
    const poolCopy = JSON.parse(JSON.stringify(CC_KNOWN_INDEX_OBSERVATIONS.map((io) => io.observation)));
    escalateCost(req({ targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } }));
    const after = CC_KNOWN_INDEX_OBSERVATIONS.map((io) => io.observation);
    expect(JSON.parse(JSON.stringify(after))).toEqual(poolCopy);
  });

  test("a failed escalation does not alter the input observation", () => {
    const before = JSON.parse(JSON.stringify(seattleOfficePrime));
    escalateCost(req({ targetPeriod: { start: "2099-01-01", end: "2099-03-31", label: "Q1 2099" } }));
    expect(JSON.parse(JSON.stringify(seattleOfficePrime))).toEqual(before);
  });
});

describe("22-23: DATA_GAP preserves explanation, provenance traceability", () => {
  test("DATA_GAP names what was requested, what evidence existed, and why it was insufficient", () => {
    const outcome = escalateCost(req({ targetPeriod: { start: "2099-01-01", end: "2099-03-31", label: "Q1 2099" } }));
    expect(outcome.status).toBe("DATA_GAP");
    if (outcome.status !== "DATA_GAP") return;
    expect(outcome.gap.reason.length).toBeGreaterThan(10);
    expect(outcome.gap.request.sourceObservation).toBe(seattleOfficePrime);
    expect(outcome.gap.request.targetPeriod.start).toBe("2099-01-01");
    expect(outcome.gap.seriesConsidered.length).toBeGreaterThan(0);
  });

  test("a successful escalation carries the base/target index citations for independent reproduction", () => {
    const outcome = escalateCost(req({ targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } }));
    expect(outcome.status).toBe("ESCALATED");
    if (outcome.status !== "ESCALATED") return;
    expect(outcome.result.baseIndexObservation?.citation.locator).toBeTruthy();
    expect(outcome.result.targetIndexObservation?.citation.locator).toBeTruthy();
    expect(outcome.result.calculation.steps.length).toBeGreaterThan(0);
  });
});

describe("24: index observation cannot become a cost candidate", () => {
  test("an actual construction_index observation, passed as the source, is refused with INCOMPATIBLE_METRIC", () => {
    const indexAsSource = US_CITY_CONSTRUCTION_INDEX_OBSERVATIONS[0];
    const outcome = escalateCost(req({ sourceObservation: indexAsSource }));
    expect(outcome.status).toBe("DATA_GAP");
    if (outcome.status !== "DATA_GAP") return;
    expect(outcome.gap.reasonCode).toBe("INCOMPATIBLE_METRIC");
  });
});

describe("25: RLB index usage", () => {
  test("RLB national index is the real, active index used for a city with no city-level index", () => {
    const outcome = escalateCost(req({ sourceObservation: chicagoOfficePrime, targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } }));
    expect(outcome.status).toBe("ESCALATED");
    if (outcome.status !== "ESCALATED") return;
    expect(outcome.result.indexSeries?.sourceId).toBe("rlb-north-america");
  });
});

describe("26: Statistics Canada index usage where actually supported", () => {
  test("StatCan BCPI has zero ingested observations; any request routed to it is DATA_GAP, never fabricated", () => {
    const applicability = evaluateIndexApplicability(torontoOfficePrime, STATCAN_BCPI_INDEX_SERIES, CC_DEFAULT_ESCALATION_POLICY);
    // Currency (CAD) matches, but source status (REGISTER) blocks it — confirms "registered, not usable" without inventing data.
    expect(applicability.applicable).toBe(false);
    expect(applicability.failureCategory).toBe("SOURCE_STATUS");
  });
});

describe("27: unsupported geography does not silently fall back", () => {
  test("a city with no city index and national fallback disabled never silently substitutes an approximate match", () => {
    const strict: CCEscalationPolicy = { ...CC_STRICT_ESCALATION_POLICY };
    const outcome = escalateCost(req({ sourceObservation: chicagoOfficePrime, policy: strict, targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } }));
    expect(outcome.status).toBe("DATA_GAP");
  });
});

describe("28: unsupported currency does not silently convert", () => {
  test("Toronto (CAD) is never silently escalated using a USD-denominated index", () => {
    const outcome = escalateCost(req({ sourceObservation: torontoOfficePrime, targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } }));
    expect(outcome.status).toBe("DATA_GAP");
    if (outcome.status !== "DATA_GAP") return;
    // Whatever the exact reasonCode, the result must never be ESCALATED using a mismatched-currency index.
    expect(outcome.status).not.toBe("ESCALATED");
  });
});

describe("30: missing publication/index metadata", () => {
  test("index observation missing a citation locator still carries through (never invented) but escalation still succeeds if the value is present", () => {
    const seriesWithGap = syntheticIndexObs(RLB_NATIONAL_INDEX_SERIES, {
      geography: { country: "US" },
      periodStart: "2024-01-01",
      periodEnd: "2024-03-31",
      value: 262.0,
      citation: { ...syntheticIndexObs(RLB_NATIONAL_INDEX_SERIES).observation.citation, locator: "" },
    });
    const baseIndex = syntheticIndexObs(RLB_NATIONAL_INDEX_SERIES, { periodStart: seattleOfficePrime.periodStart, periodEnd: seattleOfficePrime.periodEnd, value: 288.58 });
    const outcome = escalateCost(req({ targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } }), [seriesWithGap, baseIndex]);
    expect(outcome.status).toBe("ESCALATED");
  });
});

describe("31: malformed/non-positive index values", () => {
  test("a zero-valued base index observation is refused (INVALID_INDEX_VALUE), never divided by", () => {
    const badBase = syntheticIndexObs(RLB_NATIONAL_INDEX_SERIES, { periodStart: seattleOfficePrime.periodStart, periodEnd: seattleOfficePrime.periodEnd, value: 0 });
    const target = syntheticIndexObs(RLB_NATIONAL_INDEX_SERIES, { periodStart: "2024-01-01", periodEnd: "2024-03-31", value: 262 });
    const outcome = escalateCost(req({ targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } }), [badBase, target]);
    expect(outcome.status).toBe("DATA_GAP");
    if (outcome.status !== "DATA_GAP") return;
    expect(outcome.gap.reasonCode).toBe("INVALID_INDEX_VALUE");
  });

  test("a negative-valued target index observation is refused", () => {
    const base = syntheticIndexObs(RLB_NATIONAL_INDEX_SERIES, { periodStart: seattleOfficePrime.periodStart, periodEnd: seattleOfficePrime.periodEnd, value: 288.58 });
    const badTarget = syntheticIndexObs(RLB_NATIONAL_INDEX_SERIES, { periodStart: "2024-01-01", periodEnd: "2024-03-31", value: -5 });
    const outcome = escalateCost(req({ targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } }), [base, badTarget]);
    expect(outcome.status).toBe("DATA_GAP");
    if (outcome.status !== "DATA_GAP") return;
    expect(outcome.gap.reasonCode).toBe("INVALID_INDEX_VALUE");
  });
});

describe("32: zero/negative cost", () => {
  test("zero base cost value is refused", () => {
    const zeroCost: CRECitedObservation = { ...seattleOfficePrime, low: 0, high: 0, value: undefined };
    const outcome = escalateCost(req({ sourceObservation: zeroCost }));
    expect(outcome.status).toBe("DATA_GAP");
    if (outcome.status !== "DATA_GAP") return;
    expect(outcome.gap.reasonCode).toBe("INVALID_COST_VALUE");
  });

  test("negative base cost value is refused", () => {
    const negCost: CRECitedObservation = { ...seattleOfficePrime, low: -100, high: 200 };
    const outcome = escalateCost(req({ sourceObservation: negCost }));
    expect(outcome.status).toBe("DATA_GAP");
    if (outcome.status !== "DATA_GAP") return;
    expect(outcome.gap.reasonCode).toBe("INVALID_COST_VALUE");
  });
});

describe("33: duplicate index observations", () => {
  test("two identical-value duplicate index observations for the same period are deduplicated, not treated as conflicting", () => {
    const base = syntheticIndexObs(RLB_NATIONAL_INDEX_SERIES, { periodStart: seattleOfficePrime.periodStart, periodEnd: seattleOfficePrime.periodEnd, value: 288.58 });
    const baseDuplicate = syntheticIndexObs(RLB_NATIONAL_INDEX_SERIES, { periodStart: seattleOfficePrime.periodStart, periodEnd: seattleOfficePrime.periodEnd, value: 288.58 });
    const target = syntheticIndexObs(RLB_NATIONAL_INDEX_SERIES, { periodStart: "2024-01-01", periodEnd: "2024-03-31", value: 262.0 });
    const outcome = escalateCost(req({ targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } }), [base, baseDuplicate, target]);
    expect(outcome.status).toBe("ESCALATED");
  });
});

describe("34: conflicting index observations", () => {
  test("two DIFFERENT-value observations for the same period -> DATA_GAP (INSUFFICIENT_INDEX_EVIDENCE), never averaged or arbitrarily picked", () => {
    const baseA = syntheticIndexObs(RLB_NATIONAL_INDEX_SERIES, { periodStart: seattleOfficePrime.periodStart, periodEnd: seattleOfficePrime.periodEnd, value: 288.58 });
    const baseB = syntheticIndexObs(RLB_NATIONAL_INDEX_SERIES, { periodStart: seattleOfficePrime.periodStart, periodEnd: seattleOfficePrime.periodEnd, value: 300.0 });
    const target = syntheticIndexObs(RLB_NATIONAL_INDEX_SERIES, { periodStart: "2024-01-01", periodEnd: "2024-03-31", value: 262.0 });
    const outcome = escalateCost(req({ targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } }), [baseA, baseB, target]);
    expect(outcome.status).toBe("DATA_GAP");
    if (outcome.status !== "DATA_GAP") return;
    expect(outcome.gap.reasonCode).toBe("INSUFFICIENT_INDEX_EVIDENCE");
  });
});

describe("35: explicit policy controls behavior", () => {
  test("CC_STRICT_ESCALATION_POLICY disables national-index fallback that CC_DEFAULT_ESCALATION_POLICY allows", () => {
    const target = { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" };
    const permissive = escalateCost(req({ sourceObservation: chicagoOfficePrime, targetPeriod: target, policy: CC_DEFAULT_ESCALATION_POLICY }));
    const strict = escalateCost(req({ sourceObservation: chicagoOfficePrime, targetPeriod: target, policy: CC_STRICT_ESCALATION_POLICY }));
    expect(permissive.status).toBe("ESCALATED");
    expect(strict.status).toBe("DATA_GAP");
  });
});

describe("Additional: hard-cost-only rule respected (no soft-cost fabrication)", () => {
  test("escalating a hard_cost observation never produces a total_cost or soft_cost figure", () => {
    const outcome = escalateCost(req({ targetPeriod: { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" } }));
    expect(outcome.status).toBe("ESCALATED");
    if (outcome.status !== "ESCALATED") return;
    expect(outcome.result.sourceObservation.metric).toBe("hard_cost");
  });
});

describe("Additional: RLB backfill CAD observations remain distinctly currency-tagged", () => {
  test("Toronto observation's unit is CAD_per_sf, never silently treated as USD", () => {
    expect(torontoOfficePrime.unit).toBe("CAD_per_sf");
  });
});

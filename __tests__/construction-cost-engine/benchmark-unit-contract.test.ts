/**
 * InvestScape™ E88 — benchmark unit-contract regression tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * The numeric benchmark figure, `benchmark.unit`, `identity.unitBasis` and
 * every contributing observation's normalized basis must all describe the
 * same unit. An unconverted number must never be relabelled.
 */
import { evaluateConstructionCostBenchmark } from "../../src/construction-cost-engine/benchmark";
import type { ConstructionCostBenchmarkRequest } from "../../src/construction-cost-engine/benchmark-types";
import { SQ_FT_PER_SQ_M, type CCUnitBasis, type ConstructionCostCandidateInput } from "../../src/construction-cost-engine/types";
import type { CRECitedObservation } from "../../src/cre-intelligence/types";
import { e88ConstructionCostPool } from "../../src/construction-cost-engine/data";
import { CC_KNOWN_INDEX_OBSERVATIONS } from "../../src/construction-cost-engine/data/index-series";

const CHECKED_AT = "2026-09-12";

function request(unitBasis?: CCUnitBasis): ConstructionCostBenchmarkRequest {
  return {
    geography: { country: "US", city: "Austin" },
    assetClass: "office",
    canonicalSubtype: "office_premium",
    costRepresentation: "hard_cost",
    ...(unitBasis === undefined ? {} : { unitBasis }),
  };
}

function obs(overrides: Partial<CRECitedObservation> = {}): CRECitedObservation {
  return {
    metric: "hard_cost",
    assetClass: "office",
    propertySubtype: "office_prime",
    propertyClass: "unspecified",
    locationType: "unspecified",
    geography: { country: "US", region: "TX", metro: "Austin, TX", city: "Austin" },
    periodStart: "2026-04-01",
    periodEnd: "2026-06-30",
    low: 255,
    high: 425,
    unit: "USD_per_sf",
    basis: "per_sf",
    source: { sourceId: "rlb-north-america", sourceName: "Rider Levett Bucknall", sourceType: "construction_cost" },
    citation: {
      sourceName: "Rider Levett Bucknall",
      reportTitle: "RLB Quarterly Construction Cost Report — North America, Q2 2026",
      publicationDate: "2026-07-07",
      period: "Q2 2026",
      locator: "Table X",
      sourceUrl: "https://example.com/rlb.pdf",
      retrievedAt: "2026-09-10",
    },
    sourceQuality: 94,
    ...overrides,
  };
}

const pool = (o: CRECitedObservation): ConstructionCostCandidateInput[] => [{ observation: o }];

function success(req: ConstructionCostBenchmarkRequest, o: CRECitedObservation) {
  const outcome = evaluateConstructionCostBenchmark(req, pool(o), [], CHECKED_AT);
  if (outcome.status !== "success") throw new Error(`expected success, got ${outcome.gap.reasonCode}: ${outcome.gap.reason}`);
  return outcome.result;
}

describe("per_sf observation, per_sm request", () => {
  const r = () => success(request("per_sm"), obs());

  test("numeric figures are converted with the fixed SF/SM constant", () => {
    expect(r().benchmark.low).toBeCloseTo(255 * SQ_FT_PER_SQ_M, 9);
    expect(r().benchmark.high).toBeCloseTo(425 * SQ_FT_PER_SQ_M, 9);
  });

  test("benchmark.unit, identity.unitBasis and normalized basis all say per_sm", () => {
    const result = r();
    expect(result.benchmark.unit).toBe("USD_per_sm");
    expect(result.identity.unitBasis).toBe("per_sm");
    for (const c of result.contributingObservations) {
      expect(c.candidate.normalized?.unitBasis).toBe("per_sm");
      expect(c.candidate.normalized?.low).toBeCloseTo(255 * SQ_FT_PER_SQ_M, 9);
    }
  });

  test("the conversion is recorded as an applied transformation and the source figure is preserved", () => {
    const result = r();
    expect(result.transformations.some((t) => t.dimension === "unit_basis" && t.applied && /per_sf.*per_sm/.test(t.description))).toBe(true);
    const original = result.contributingObservations[0].candidate.observation;
    expect(original.unit).toBe("USD_per_sf");
    expect(original.low).toBe(255);
    expect(result.contributingObservations[0].candidate.dimensions.unitBasisMatch.level).toBe("close");
  });
});

describe("per_sm observation, per_sf request", () => {
  test("converts back to per_sf with consistent labels", () => {
    const perSm = 255 * SQ_FT_PER_SQ_M;
    const result = success(request("per_sf"), obs({ unit: "USD_per_sm", basis: "per_sf", low: perSm, high: undefined }));
    expect(result.benchmark.low).toBeCloseTo(255, 9);
    expect(result.benchmark.unit).toBe("USD_per_sf");
    expect(result.identity.unitBasis).toBe("per_sf");
  });
});

describe("identity pairs and unconstrained requests keep the source unit", () => {
  test.each<[CCUnitBasis | undefined]>([["per_sf"], [undefined]])("request %s on a per_sf observation", (basis) => {
    const result = success(request(basis), obs());
    expect(result.benchmark.low).toBe(255);
    expect(result.benchmark.high).toBe(425);
    expect(result.benchmark.unit).toBe("USD_per_sf");
    expect(result.identity.unitBasis).toBe("per_sf");
  });

  test("CAD source keeps its currency in the converted unit label", () => {
    const result = success(
      { ...request("per_sm"), geography: { country: "CA", city: "Toronto" } },
      obs({ unit: "CAD_per_sf", geography: { country: "CA", region: "ON", metro: "Toronto, ON", city: "Toronto" } }),
    );
    expect(result.benchmark.unit).toBe("CAD_per_sm");
    expect(result.benchmark.currency).toBe("CAD");
  });
});

describe("unsupported unit pairs produce a clear gap, never a relabelled number", () => {
  test.each<[CCUnitBasis]>([["per_unit"], ["percent_of_hard_cost"], ["index"]])("per_sf observation, %s request", (basis) => {
    const outcome = evaluateConstructionCostBenchmark(request(basis), pool(obs()), [], CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
    if (outcome.status !== "data_gap") return;
    expect(outcome.gap.reasonCode).toBe("CONVERSION_UNSUPPORTED");
    expect(outcome.gap.unitBasis).toBe(basis);
  });

  test.each<[CCUnitBasis]>([["per_sf"], ["per_sm"]])("per_unit observation, %s request", (basis) => {
    const outcome = evaluateConstructionCostBenchmark(request(basis), pool(obs({ unit: "USD_per_unit", basis: "per_unit" })), [], CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
    if (outcome.status !== "data_gap") return;
    expect(outcome.gap.reasonCode).toBe("CONVERSION_UNSUPPORTED");
  });
});

describe("escalated benchmark (real RLB + index data)", () => {
  const targetPeriod = { start: "2024-01-01", end: "2024-03-31", label: "Q1 2024" };
  const seattle = (unitBasis: CCUnitBasis) => {
    const outcome = evaluateConstructionCostBenchmark(
      { ...request(unitBasis), geography: { country: "US", city: "Seattle" }, targetPeriod },
      e88ConstructionCostPool(),
      CC_KNOWN_INDEX_OBSERVATIONS,
      CHECKED_AT,
    );
    if (outcome.status !== "success") throw new Error(`expected success, got ${outcome.gap.reasonCode}`);
    return outcome.result;
  };

  test("per_sm request converts the escalated figure and labels it per_sm", () => {
    const sf = seattle("per_sf");
    const sm = seattle("per_sm");
    expect(sm.benchmark.escalated).toBe(true);
    expect(sm.benchmark.unit).toBe("USD_per_sm");
    expect(sm.identity.unitBasis).toBe("per_sm");
    expect(sm.benchmark.low!).toBeCloseTo(sf.benchmark.low! * SQ_FT_PER_SQ_M, 6);
    expect(sm.benchmark.high!).toBeCloseTo(sf.benchmark.high! * SQ_FT_PER_SQ_M, 6);
    expect(sf.benchmark.unit).toBe("USD_per_sf");
  });
});

describe("mixed units in an unconstrained top tier", () => {
  test("per_sf and per_sm observations are never unioned into one range", () => {
    const a = obs();
    const b = obs({ unit: "USD_per_sm", low: 255 * SQ_FT_PER_SQ_M, high: 425 * SQ_FT_PER_SQ_M, citation: { ...obs().citation, locator: "Table Y" } });
    const outcome = evaluateConstructionCostBenchmark(request(), [{ observation: a }, { observation: b }], [], CHECKED_AT);
    expect(outcome.status).toBe("data_gap");
    if (outcome.status !== "data_gap") return;
    expect(outcome.gap.reasonCode).toBe("CONVERSION_UNSUPPORTED");
    expect(outcome.gap.reason).toMatch(/USD_per_sf, USD_per_sm/);
  });

  test("the same pair aggregates once the request pins a basis", () => {
    const a = obs();
    const b = obs({ unit: "USD_per_sm", low: 255 * SQ_FT_PER_SQ_M, high: 425 * SQ_FT_PER_SQ_M, citation: { ...obs().citation, locator: "Table Y" } });
    const outcome = evaluateConstructionCostBenchmark(request("per_sf"), [{ observation: a }, { observation: b }], [], CHECKED_AT);
    if (outcome.status !== "success") throw new Error(outcome.gap.reason);
    expect(outcome.result.benchmark.unit).toBe("USD_per_sf");
  });
});

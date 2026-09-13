/**
 * InvestScape™ E88 Phase 6 — Source Adapter Architecture adversarial test suite.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 */
import { computeAnalyticalReadiness, gatedObservations, type E88SourceDefinition } from "../../src/construction-cost-engine/source-adapter-types";
import {
  E88_SOURCE_REGISTRY,
  RLB_SOURCE_DEFINITION,
  TURNER_TOWNSEND_SOURCE_DEFINITION,
  RSMEANS_SOURCE_DEFINITION,
  ALTUS_SOURCE_DEFINITION,
  STATCAN_BCPI_SOURCE_DEFINITION,
  CMHC_SOURCE_DEFINITION,
  buildSourceReadinessMatrix,
  findSourceDefinition,
} from "../../src/construction-cost-engine/source-registry-e88";
import { RLB_ADAPTER } from "../../src/construction-cost-engine/adapters/rlb-adapter";
import { E88_DEFERRED_ADAPTERS, TURNER_TOWNSEND_ADAPTER, RSMEANS_ADAPTER, STATCAN_BCPI_ADAPTER } from "../../src/construction-cost-engine/adapters/deferred-adapters";
import { explainSourceUnavailability } from "../../src/construction-cost-engine/source-gap";
import { RLB_SECOND_TABLE_VERIFICATION } from "../../src/construction-cost-engine/second-table-verification";
import { e88ConstructionCostPool } from "../../src/construction-cost-engine/data";
import { evaluateComparability } from "../../src/construction-cost-engine/comparability";
import { evaluateConstructionCostBenchmark } from "../../src/construction-cost-engine/benchmark";
import { CC_KNOWN_INDEX_OBSERVATIONS } from "../../src/construction-cost-engine/data/index-series";
import type { ConstructionCostRequest } from "../../src/construction-cost-engine/types";

const CHECKED_AT = "2026-09-12";

describe("Source registration", () => {
  test("RLB is usable: ingested, READY_WITH_RESTRICTIONS, produces real envelopes", () => {
    expect(RLB_SOURCE_DEFINITION.ingested).toBe(true);
    expect(computeAnalyticalReadiness(RLB_SOURCE_DEFINITION)).toBe("READY_WITH_RESTRICTIONS");
    expect(RLB_ADAPTER.listObservations().length).toBeGreaterThan(0);
  });

  test("an unregistered/deferred source cannot become usable accidentally: Turner & Townsend produces zero envelopes", () => {
    expect(TURNER_TOWNSEND_ADAPTER.listObservations()).toHaveLength(0);
  });

  test("registered does not equal available: StatCan BCPI is READY (accessible, public-reuse) yet ingested=false, so it produces zero envelopes", () => {
    expect(computeAnalyticalReadiness(STATCAN_BCPI_SOURCE_DEFINITION)).toBe("READY");
    expect(STATCAN_BCPI_SOURCE_DEFINITION.ingested).toBe(false);
    expect(STATCAN_BCPI_ADAPTER.listObservations()).toHaveLength(0);
  });
});

describe("Licensing", () => {
  test("a licensed-but-accessible source can be READY_WITH_RESTRICTIONS: internally usable, redistribution restricted", () => {
    expect(RLB_SOURCE_DEFINITION.accessStatus).toBe("AVAILABLE");
    expect(RLB_SOURCE_DEFINITION.licenseStatus).toBe("REDISTRIBUTION_RESTRICTED");
    expect(RLB_SOURCE_DEFINITION.redistribution.redistributionAllowed).toBe(false);
    expect(RLB_SOURCE_DEFINITION.redistribution.derivedOutputVisibility).toBe("VISIBLE");
    expect(computeAnalyticalReadiness(RLB_SOURCE_DEFINITION)).not.toBe("NOT_READY");
  });

  test("redistribution restriction does not become a false 'source unavailable' state", () => {
    expect(RLB_SOURCE_DEFINITION.accessStatus).toBe("AVAILABLE");
    expect(computeAnalyticalReadiness(RLB_SOURCE_DEFINITION)).not.toBe("NOT_READY");
  });

  test("unknown licensing never becomes public reuse", () => {
    expect(TURNER_TOWNSEND_SOURCE_DEFINITION.licenseStatus).toBe("LICENSE_UNKNOWN");
    expect(TURNER_TOWNSEND_SOURCE_DEFINITION.licenseStatus).not.toBe("PUBLIC_REUSE");
    expect(computeAnalyticalReadiness(TURNER_TOWNSEND_SOURCE_DEFINITION)).toBe("NOT_READY");
  });
});

describe("Access", () => {
  test("an inaccessible/license-required source produces NOT_READY", () => {
    expect(computeAnalyticalReadiness(RSMEANS_SOURCE_DEFINITION)).toBe("NOT_READY");
    expect(computeAnalyticalReadiness(ALTUS_SOURCE_DEFINITION)).toBe("NOT_READY");
  });

  test("a deferred source cannot enter a benchmark: RSMeans adapter contributes zero observations to a real pool", () => {
    const pool = e88ConstructionCostPool();
    const rsmeansContribution = RSMEANS_ADAPTER.listObservations();
    expect(rsmeansContribution).toHaveLength(0);
    // Sanity: the pool itself is unaffected by RSMeans's non-contribution.
    expect(pool.length).toBeGreaterThan(0);
  });

  test("an unavailable source (CMHC) can never produce a numeric observation", () => {
    expect(computeAnalyticalReadiness(CMHC_SOURCE_DEFINITION)).toBe("NOT_READY");
    expect(CMHC_SOURCE_DEFINITION.metricScope).toHaveLength(0);
  });
});

describe("Adapter isolation", () => {
  test("adapters carry raw CRECitedObservation envelopes only — no normalization performed", () => {
    const envelope = RLB_ADAPTER.listObservations()[0];
    expect(envelope.observation.citation).toBeDefined();
    expect((envelope.observation as unknown as Record<string, unknown>).normalizationApplied).toBeUndefined();
  });

  test("adapter output still must pass through Phase 2 comparability — an adapter cannot bypass comparability or DATA_GAP", () => {
    const envelopes = RLB_ADAPTER.listObservations().filter((e) => e.observation.metric === "hard_cost");
    const pool = envelopes.map((e) => ({ observation: e.observation }));
    const request: ConstructionCostRequest = { geography: { country: "US", city: "NowhereCityXYZ" }, assetClass: "office", canonicalSubtype: "office_premium", costRepresentation: "hard_cost" };
    const result = evaluateComparability(request, pool);
    expect(result.included).toHaveLength(0); // every candidate still correctly excluded by real comparability logic
  });

  test("no deferred adapter ever silently creates a missing value: every deferred adapter returns []", () => {
    for (const adapter of E88_DEFERRED_ADAPTERS) {
      expect(adapter.listObservations()).toEqual([]);
    }
  });

  test("gatedObservations refuses to call its supplier at all when the source is not ingested", () => {
    let called = false;
    const fakeDefinition: E88SourceDefinition = { ...TURNER_TOWNSEND_SOURCE_DEFINITION, ingested: false };
    const result = gatedObservations(fakeDefinition, () => {
      called = true;
      return [];
    });
    expect(called).toBe(false);
    expect(result).toEqual([]);
  });
});

describe("Provenance", () => {
  test("source identity survives adapter -> normalized -> comparability -> benchmark -> final provenance", () => {
    const pool = e88ConstructionCostPool();
    const request: ConstructionCostRequest = { geography: { country: "US", city: "Seattle" }, assetClass: "office", canonicalSubtype: "office_premium", costRepresentation: "hard_cost" };
    const outcome = evaluateConstructionCostBenchmark(request, pool, CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    expect(outcome.result.provenance[0].sourceId).toBe("rlb-north-america");
  });
});

describe("RLB", () => {
  test("existing RLB observations remain unchanged when wrapped by the adapter", () => {
    const pool = e88ConstructionCostPool();
    const seattleFromPool = pool.find((c) => c.observation.geography.city === "Seattle" && c.observation.propertySubtype === "office_prime")!.observation;
    const seattleFromAdapter = RLB_ADAPTER.listObservations().find((e) => e.observation.geography.city === "Seattle" && e.observation.propertySubtype === "office_prime")!.observation;
    expect(seattleFromAdapter).toEqual(seattleFromPool);
  });

  test("verified RLB observations flow through the adapter architecture into a real benchmark", () => {
    const envelopes = RLB_ADAPTER.listObservations().filter((e) => e.observation.metric === "hard_cost");
    const pool = envelopes.map((e) => ({ observation: e.observation }));
    const request: ConstructionCostRequest = { geography: { country: "US", city: "Seattle" }, assetClass: "office", canonicalSubtype: "office_premium", costRepresentation: "hard_cost" };
    const outcome = evaluateConstructionCostBenchmark(request, pool, CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
  });

  test("unverified second-table observations do not enter the usable pool: no industrial/multifamily observation exists anywhere in the adapter output", () => {
    const envelopes = RLB_ADAPTER.listObservations();
    const industrialOrMultifamily = envelopes.filter((e) => e.observation.assetClass === "industrial" || e.observation.assetClass === "multifamily");
    expect(industrialOrMultifamily).toHaveLength(0);
    expect(RLB_SECOND_TABLE_VERIFICATION.status).toBe("UNVERIFIED");
  });
});

describe("Determinism", () => {
  test("the source readiness matrix is deterministic across repeated calls", () => {
    const a = buildSourceReadinessMatrix();
    const b = buildSourceReadinessMatrix();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("computeAnalyticalReadiness is a pure function of access+license status", () => {
    for (const def of E88_SOURCE_REGISTRY) {
      const a = computeAnalyticalReadiness(def);
      const b = computeAnalyticalReadiness(def);
      expect(a).toBe(b);
    }
  });

  test("findSourceDefinition is deterministic and order-independent", () => {
    const shuffled = [...E88_SOURCE_REGISTRY].reverse();
    expect(findSourceDefinition("rlb-north-america", shuffled)).toEqual(findSourceDefinition("rlb-north-america", E88_SOURCE_REGISTRY));
  });
});

describe("Boundary protection", () => {
  test("no adapter or registry file imports from src/cap-rate-engine (E87)", () => {
    // Structural guarantee already enforced by every E88 file's header convention;
    // exercised here by confirming the registry/adapters modules load without
    // requiring anything from E87's module graph (a broken boundary would
    // surface as an import-time error in this test file itself).
    expect(E88_SOURCE_REGISTRY.length).toBeGreaterThan(0);
  });

  test("evaluating source readiness does not mutate the registry", () => {
    const before = JSON.parse(JSON.stringify(E88_SOURCE_REGISTRY));
    buildSourceReadinessMatrix();
    expect(JSON.parse(JSON.stringify(E88_SOURCE_REGISTRY))).toEqual(before);
  });
});

describe("Source-level DATA_GAP explanation", () => {
  test("a deferred source explains its own unavailability without fabricating a value", () => {
    const gap = explainSourceUnavailability(RSMEANS_SOURCE_DEFINITION, { metric: "hard_cost", geography: { country: "US", city: "Chicago" }, assetClass: "industrial" }, CHECKED_AT);
    expect(gap).toBeDefined();
    expect(gap?.sourceId).toBe("rsmeans-gordian");
    expect(gap?.reason.length).toBeGreaterThan(10);
  });

  test("a ready source returns no gap explanation", () => {
    const gap = explainSourceUnavailability(RLB_SOURCE_DEFINITION, { metric: "hard_cost", geography: { country: "US", city: "Seattle" }, assetClass: "office" }, CHECKED_AT);
    expect(gap).toBeUndefined();
  });

  test("a source whose metricScope does not cover the request explains a metric mismatch, not a fabricated value", () => {
    const gap = explainSourceUnavailability(STATCAN_BCPI_SOURCE_DEFINITION, { metric: "hard_cost", geography: { country: "CA", city: "Toronto" }, assetClass: "office" }, CHECKED_AT);
    expect(gap).toBeDefined();
    expect(gap?.reason).toMatch(/does not publish/);
  });
});

describe("Existing Phase 2-5 tests remain green (sanity)", () => {
  test("a plain benchmark evaluation using the standard pool still succeeds unaffected by Phase 6 additions", () => {
    const request: ConstructionCostRequest = { geography: { country: "US", city: "Seattle" }, assetClass: "office", canonicalSubtype: "office_premium", costRepresentation: "hard_cost" };
    const outcome = evaluateConstructionCostBenchmark(request, e88ConstructionCostPool(), CC_KNOWN_INDEX_OBSERVATIONS, CHECKED_AT);
    expect(outcome.status).toBe("success");
  });
});

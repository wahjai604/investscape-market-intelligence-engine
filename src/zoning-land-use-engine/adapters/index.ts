/**
 * InvestScape™ E85 Phase 5 — jurisdiction adapters barrel.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Jurisdiction-specific normalization lives under this directory and nowhere
 * else. E85 core (evaluator.ts, use-evaluation.ts, density-evaluation.ts,
 * dimensional-evaluation.ts and the rest of Phase 4) imports nothing from
 * here, and the dependency runs one way only: adapters depend on the generic
 * contracts, never the reverse.
 *
 * Adding a municipality means adding a directory here and registering its
 * adapter — no core file changes, which is the property the Phase 5
 * architecture exists to deliver.
 */
export * as vancouver from "./vancouver";

/**
 * InvestScape™ E88 Phase 6 — Adapter barrel.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 */
export * from "./rlb-adapter";
export * from "./deferred-adapters";
import { RLB_ADAPTER } from "./rlb-adapter";
import { E88_DEFERRED_ADAPTERS } from "./deferred-adapters";
import type { E88SourceAdapter } from "../source-adapter-types";

/** Every adapter E88 currently defines, ready or not — the full Phase 6 adapter roster. */
export const E88_ALL_ADAPTERS: readonly E88SourceAdapter[] = [RLB_ADAPTER, ...E88_DEFERRED_ADAPTERS];

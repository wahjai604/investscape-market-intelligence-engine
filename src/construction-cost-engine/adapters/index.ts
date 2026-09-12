/**
 * InvestScape™ E70 Phase 6 — Adapter barrel.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 */
export * from "./rlb-adapter";
export * from "./deferred-adapters";
import { RLB_ADAPTER } from "./rlb-adapter";
import { E70_DEFERRED_ADAPTERS } from "./deferred-adapters";
import type { E70SourceAdapter } from "../source-adapter-types";

/** Every adapter E70 currently defines, ready or not — the full Phase 6 adapter roster. */
export const E70_ALL_ADAPTERS: readonly E70SourceAdapter[] = [RLB_ADAPTER, ...E70_DEFERRED_ADAPTERS];

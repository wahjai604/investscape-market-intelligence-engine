/**
 * InvestScape™ E85 Phase 8 — City of Vancouver spatial adapter barrel.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * A real publisher and a real layer, read entirely offline. Every export below
 * is Vancouver-specific by design and none of it is referenced by E85 core —
 * core depends on the generic contracts only, and a caller assembling a
 * registry chooses which jurisdictions to include.
 */
export * from "./vancouver-zoning-source";
export * from "./vancouver-zoning-adapter";

// Phase 11 — the spatial→legal join. Kept in its own module because it is the
// one place that knows BOTH this publisher's district labels and this
// jurisdiction's registered legal instruments, and neither the spatial adapter
// nor generic Phase 8 has any business knowing the other half.
export * from "./vancouver-legal-linkage";

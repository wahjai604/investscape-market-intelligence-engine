/**
 * InvestScape™ E88 — Construction Cost Intelligence Engine.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Public surface through Phase 6: canonical taxonomy, normalization,
 * comparability/pipeline (Phase 2), coverage/source research (Phase 3),
 * escalation/index integration (Phase 4), the unified benchmark output
 * layer (Phase 5), and the source-adapter/registry architecture (Phase 6).
 * See docs/E88-phase5-unified-benchmark-output.md Section "Public API" and
 * docs/E88-phase7-production-hardening.md Section "Public API review" for
 * an explicit classification of every export below (intentional public API
 * vs. internal helper vs. compatibility export). Phase 7 added no new
 * export here — it is a validation/hardening phase only. Full licensed-
 * source ingestion and E71 integration remain later phases
 * (docs/E88-phase1-technical-specification.md Section 24) and are not
 * exported here because they do not exist yet.
 */
export * from "./taxonomy";
export * from "./types";
export * from "./gap-types";
export * from "./comparability-types";
export * from "./normalize";
export * from "./comparability";
export * from "./pipeline";
export * from "./source-research";
export * from "./coverage-matrix";
export * from "./data";
export * from "./index-types";
export * from "./escalation-policy";
export * from "./applicability";
export * from "./escalation";
export * from "./benchmark-types";
export * from "./confidence";
export * from "./benchmark";
export * from "./source-adapter-types";
export * from "./source-registry-e88";
export * from "./source-gap";
export * from "./second-table-verification";
export * from "./adapters";

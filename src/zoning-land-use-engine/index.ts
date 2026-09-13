/**
 * InvestScape™ E85 — Zoning & Land-Use Rules Engine.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Phase 3 public surface: types/contracts only (jurisdiction/parcel,
 * provenance, evidence/temporal, use taxonomy, rule families, DATA_GAP
 * taxonomy, manual-review taxonomy, qualification, regulatory envelope,
 * result status union, override, policy scaffolding, source-readiness
 * scaffolding).
 *
 * Phase 4 adds RULE-ONLY MODE deterministic evaluation on top of those
 * frozen contracts: `evaluateZoningAndLandUse` (evaluator.ts) — a pure,
 * synchronous, in-memory evaluator that takes already-normalized
 * `E85RuleRecord[]` (no raw PDF/HTML/API parsing; that is Phase 5 scope) and
 * produces an `E85EvaluationOutcome` wrapping a structurally-valid
 * `E85Result`. Supporting Phase 4 modules: `request-types` (the evaluation
 * request envelope and requested-analysis scoping), `rule-identity`
 * (deterministic evidence de-duplication), `applicability`
 * (jurisdiction/zone/temporal filtering), `qualification-derivation`
 * (deriving the three qualification axes from provenance completeness,
 * since Phase 3's `E85Evidence` carries none directly),
 * `conflict-detection`, the six family evaluators (`use-evaluation`,
 * `density-evaluation`, `dimensional-evaluation`,
 * `parking-amenity-evaluation`, `overlay-evaluation`), `envelope-assembly`,
 * and `result-status` (the one explicit result-status precedence function).
 * Still no source adapters, no network code, no GIS computation, no
 * database code. E85 has NO direct runtime dependency on
 * E68/E69/E70/calc-engine/economic-engine/tax-engine — every export below is
 * defined fresh in this module.
 */
export * from "./jurisdiction-types";
export * from "./provenance-types";
export * from "./evidence-types";
export * from "./use-taxonomy";
export * from "./rule-family-types";
export * from "./data-gap-types";
export * from "./manual-review-types";
export * from "./qualification-types";
export * from "./envelope-types";
export * from "./result-types";
export * from "./override-types";
export * from "./policy-types";
export * from "./source-readiness-types";

// Phase 4 — deterministic evaluation
export * from "./request-types";
export * from "./rule-identity";
export * from "./applicability";
export * from "./qualification-derivation";
export * from "./finding-types";
export * from "./conflict-detection";
export * from "./use-evaluation";
export * from "./density-evaluation";
export * from "./dimensional-evaluation";
export * from "./parking-amenity-evaluation";
export * from "./overlay-evaluation";
export * from "./envelope-assembly";
export * from "./result-status";
export * from "./evaluator-result-types";
export * from "./evaluator";

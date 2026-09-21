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
 *
 * Phase 5 adds the SOURCE ADAPTER & REGISTRY layer that feeds Phase 4: a
 * generic source registry (`source-registry`), multi-axis source readiness
 * (`source-readiness-assessment`), the structured source-fact input contract
 * (`source-fact-types`), normalization findings, the normalized rule bundle,
 * the generic adapter contract, an exact-match adapter resolver
 * (`adapter-registry`), and one pilot adapter for the City of Vancouver R1-1
 * District Schedule under `adapters/`. Phase 5 covers NORMALIZATION only —
 * acquisition (fetching bytes) and extraction (turning a PDF/HTML/API payload
 * into structured facts) are deliberately outside it, so there is still no
 * network code, no filesystem read, no PDF/OCR parsing, and no GIS
 * computation anywhere in this module. The Phase 4 evaluator is unchanged and
 * remains jurisdiction-neutral: it consumes a bundle's `E85RuleRecord[]`
 * without knowing which adapter produced them.
 *
 * E85 has NO direct runtime dependency on
 * E86/E87/E88/calc-engine/economic-engine/tax-engine — every export below is
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

// Phase 12B.2 — scoped rule applicability. An optional, jurisdiction-neutral
// axis on E85Evidence stating which proposals a value governs, with a canonical
// scope identity, three-valued evaluation, and proven-disjointness semantics.
export * from "./rule-applicability-types";
export * from "./rule-applicability";

// Phase 12B.4 — regulatory requirements. A generic rule family for binding
// obligations imposed on an otherwise-entitled development, triggered through
// the Phase 12B.2 applicability axis and never priced.
export * from "./regulatory-requirement-types";
export * from "./regulatory-requirement";
export * from "./requirement-evaluation";

// Phase 5 — source adapters & registry. Generic contracts first; the
// jurisdiction adapters are namespaced under `adapters` so no municipality's
// vocabulary reaches this barrel's top level.
export * from "./source-registry-types";
export * from "./source-registry";
export * from "./source-readiness-assessment";
export * from "./source-fact-types";
export * from "./normalization-finding-types";
export * from "./normalized-bundle-types";
export * from "./source-adapter-contract";
export * from "./adapter-registry";

// Phase 6 — multi-source rule-pack composition. Sits BETWEEN Phase 5 and Phase
// 4: it takes independently-normalized bundles and produces one effective rule
// set that `evaluateZoningAndLandUse` consumes unchanged and unaware. Legal
// precedence comes only from explicitly-stated, provenance-carrying relations —
// composition roles are descriptive labels and confer no hierarchy.
export * from "./rule-concept-identity";
export * from "./precedence-types";
export * from "./precedence-resolution";
export * from "./composition-findings";
export * from "./composition-types";
export * from "./rule-pack-composer";

// Phase 7 — spatial applicability. Sits UPSTREAM of Phase 6 and answers a
// different question: composition asks how already-applicable instruments
// interact, this asks which instruments are in play at all. Geometry names the
// candidates; it never ranks them, and Phase 7 deliberately does not import
// Phase 6 so that it cannot start to.
export * from "./spatial-types";
export * from "./geometry-primitives";
export * from "./geometry-validation";
export * from "./geometry-relations";
export * from "./spatial-dataset-types";
export * from "./spatial-dataset-registry";
export * from "./spatial-findings";
export * from "./spatial-applicability-types";
export * from "./spatial-applicability";

// Phase 8 — spatial source adapters. Sits UPSTREAM of Phase 7 and answers a
// different question again: applicability asks which instruments reach a
// parcel, this asks how an authoritative layer becomes instruments at all.
// Acquisition remains outside E85 entirely; a snapshot is its RESULT.
export * from "./spatial-source-snapshot-types";
export * from "./spatial-source-findings";
export * from "./spatial-source-adapter-contract";
export * from "./spatial-source-adapter-registry";

// Phase 9 - decision orchestration. Sits ABOVE every other phase and answers the
// question none of them may: given this layer and this parcel, can this answer
// be relied on? It runs 8 -> 7 -> 6 -> 4, keeps each result whole, and adds only
// MATERIALITY - whether an upstream problem bears on THIS parcel. It ranks no
// instrument and computes no rule; a clean status is earned against material
// blockers, never inferred from a successful calculation.
export * from "./decision-package-types";
export * from "./decision-rule-pack-resolution";
export * from "./decision-materiality";
export * from "./decision-status";
export * from "./decision-trace";
export * from "./decision-orchestrator";

// PHASE 15.16 (Slice 3F-1): the temporal request contract, now referenced by
// E85DecisionRequest.temporalRequest and exported publicly so callers can
// construct one.
export * from "./temporal-request-types";

export * as adapters from "./adapters";

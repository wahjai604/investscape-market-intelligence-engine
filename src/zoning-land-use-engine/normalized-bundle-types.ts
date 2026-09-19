/**
 * InvestScape™ E85 Phase 5 — Source Adapter & Registry Foundation: the
 * normalized rule bundle.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * The handoff artefact between adaptation and evaluation. Phase 4's
 * `evaluateZoningAndLandUse` consumes `bundle.rules` — a plain
 * `readonly E85RuleRecord[]` — and needs to know nothing about which
 * municipality, document, or adapter produced them. That is the whole point:
 * the evaluator stays jurisdiction-neutral and no Vancouver vocabulary reaches
 * it.
 *
 * CONDITIONAL RULES ARE HELD SEPARATELY, and this is the most important
 * structural decision in the file. `rules` contains only UNCONDITIONAL rules,
 * so handing it straight to Phase 4 can never silently apply a
 * condition-dependent value. Condition-dependent rules live in
 * `conditionalRules`, each tagged with the source's exact condition text, and
 * enter an evaluation only when a caller affirms that condition explicitly via
 * `selectRulesForAffirmedConditions`. The adapter never decides whether a
 * condition holds — it cannot know, and guessing would mean choosing whichever
 * value happens to be more favourable.
 */
import type { E85RuleFamily, E85RuleRecord } from "./rule-family-types";
import type { E85TemporalWindow } from "./evidence-types";
import type { E85Provenance } from "./provenance-types";
import type { E85QualificationTier } from "./qualification-types";
import type { E85NormalizationFinding, E85UnresolvedSourceItem } from "./normalization-finding-types";
import type { E85SourceReadinessAssessment } from "./source-readiness-assessment";

/**
 * The two qualification axes that are answerable at ADAPTATION time.
 *
 * `E85Qualification`'s third axis, `parcelMatch`, is deliberately absent:
 * normalization happens with no parcel in hand at all, so any value for it
 * would be fabricated — "high" would assert a match nobody checked, and
 * "very_low" would libel a perfectly good bundle. Phase 4 derives parcelMatch
 * itself, from the parcel it is actually given
 * (`deriveParcelMatch`, qualification-derivation.ts). Using a two-axis type
 * here makes that division structural rather than a comment someone can miss.
 */
export interface E85BundleQualification {
  evidenceQuality: E85QualificationTier;
  ruleApplicability: E85QualificationTier;
}

/**
 * A rule the source states only under a named condition. `condition` is the
 * source's exact wording, matched verbatim (never fuzzily) against caller
 * affirmations — the same matching discipline Phase 4 already applies to
 * `E85DensityRule.conditionalBonus` and `E85AmenityRule.requirementConditions`.
 */
export interface E85ConditionalRuleRecord {
  /** Exact condition text as stated by the source. */
  condition: string;
  /** The rule as it would apply IF the condition were affirmed. Never merged into `E85NormalizedRuleBundle.rules`. */
  rule: E85RuleRecord;
  /** The source fact this came from, for traceability back through the extract. */
  sourceFactId: string;
}

export interface E85NormalizedRuleBundle {
  sourceId: string;
  /** Consolidation the rules were read from — the same value stamped onto every rule's provenance. */
  sourceVersionId: string;
  jurisdictionId: string;
  zoneDesignation: string;
  /** The temporal window applying to this bundle's rules, derived from the registered version's dates and basis — never fabricated when the source states none. */
  temporal: E85TemporalWindow;
  /** UNCONDITIONAL normalized rules. Safe to hand directly to `evaluateZoningAndLandUse`. */
  rules: readonly E85RuleRecord[];
  /** Condition-dependent rules, deliberately excluded from `rules`. */
  conditionalRules: readonly E85ConditionalRuleRecord[];
  /**
   * Rule families this bundle's adapter claims to model at all, copied verbatim from `E85AdapterIdentity.supportedRuleFamilies` — never
   * inferred from which rules or findings happen to be present. Means "modeled, subject to ordinary within-family applicability/gaps/
   * conflicts", never "a rule always applies" or "every fact in the family is structured". Authoritative for Phase 9 coverage checks.
   */
  supportedRuleFamilies: readonly E85RuleFamily[];
  /** Everything that happened during normalization, including successes, in deterministic order. */
  findings: readonly E85NormalizationFinding[];
  /** Source facts that produced no rule, so the bundle accounts for every input. */
  unresolvedSourceItems: readonly E85UnresolvedSourceItem[];
  readiness: E85SourceReadinessAssessment;
  /**
   * Bundle-level qualification, floored across the contributing evidence. This
   * is the ADAPTER's view of its own output quality; Phase 4 derives its own
   * qualification independently from provenance completeness and never
   * inherits this value, so a permissive adapter cannot inflate an evaluation.
   */
  qualification: E85BundleQualification;
  /** Bundle-level provenance identifying source, version, and adapter. Per-rule provenance carries the same identity plus each value's own locator. */
  provenance: E85Provenance;
  adapterId: string;
  adapterVersion: string;
  /** ISO 8601 timestamp normalization ran, taken from the extract or caller — never `Date.now()`, so a bundle is reproducible. */
  normalizedAt: string;
}

/**
 * Returns the unconditional rules PLUS any conditional rule whose condition
 * appears verbatim in `affirmedConditions`. Case-sensitive exact match only,
 * matching `E85CallerContext.satisfiedConditions` semantics (request-types.ts).
 *
 * Pure and order-stable: unconditional rules first in bundle order, then
 * affirmed conditional rules in bundle order. Neither the bundle nor the input
 * array is mutated.
 */
export function selectRulesForAffirmedConditions(bundle: E85NormalizedRuleBundle, affirmedConditions: readonly string[]): readonly E85RuleRecord[] {
  const affirmed = new Set(affirmedConditions);
  return [...bundle.rules, ...bundle.conditionalRules.filter((c) => affirmed.has(c.condition)).map((c) => c.rule)];
}

/** The distinct condition strings a bundle is waiting on, deduplicated, in first-seen order. Lets a caller show a reviewer exactly which facts they would need to affirm. */
export function pendingConditions(bundle: E85NormalizedRuleBundle): readonly string[] {
  const out: string[] = [];
  for (const c of bundle.conditionalRules) {
    if (!out.includes(c.condition)) out.push(c.condition);
  }
  return out;
}

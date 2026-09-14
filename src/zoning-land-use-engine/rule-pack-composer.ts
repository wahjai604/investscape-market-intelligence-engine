/**
 * InvestScape™ E85 Phase 6 — Multi-Source Rule-Pack Composition: the composer.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Pure, offline, deterministic. Takes independently-normalized rule packs and
 * produces one effective rule set plus a complete audit of how it got there.
 *
 * THE FOUR RULES THIS FILE EXISTS TO ENFORCE:
 *
 *  1. INPUT ORDER DECIDES NOTHING. Every list is canonicalized before use and
 *     every output is emitted in a stable order, so compose([A,B,C]) and
 *     compose([C,A,B]) are indistinguishable.
 *  2. PRECEDENCE REQUIRES EVIDENCE. A winner emerges only from an explicitly
 *     stated relation. There is no restrictive-wins default, no base-loses
 *     default, no newer-wins default, and composition roles are never consulted.
 *  3. AN UNRANKABLE DISAGREEMENT STAYS UNRANKED. Two authorities stating
 *     different values for one concept with no stated relationship produce an
 *     unresolved conflict and a manual-review record — never a quiet pick.
 *  4. NOTHING IS DESTROYED. A displaced rule is preserved with both claims and
 *     the relation that displaced it, so "why this number?" is always answerable.
 *
 * Composition is jurisdiction-neutral: no municipality, zone name, instrument
 * name or approval authority appears anywhere in this file or its siblings, and
 * a scope-protection test enforces that.
 */
import type { E85RuleFamily } from "./rule-family-types";
import type { E85ConditionalRuleRecord, E85BundleQualification } from "./normalized-bundle-types";
import type { E85Evidence, E85TemporalWindow } from "./evidence-types";
import type { E85UsePermission } from "./use-taxonomy";
import type { E85ManualReviewRecord } from "./manual-review-types";
import type { E85PrecedenceRelation } from "./precedence-types";
import type { E85RequestedAnalysis } from "./request-types";
import type {
  E85RulePack,
  E85ComposedRulePack,
  E85CompositionResult,
  E85CompositionOptions,
  E85CompositionProblem,
  E85CompositionConflict,
  E85SuppressedRuleRecord,
  E85ConceptClaim,
  E85CompositionReadinessLimitation,
} from "./composition-types";
import type { E85CompositionFinding } from "./composition-findings";
import type { E85RuleConceptContribution, E85OverlayDeclaration, E85RuleConceptKey } from "./rule-concept-identity";
import { decomposeE85Rules, reassembleE85Rules, conceptKeyFamily } from "./rule-concept-identity";
import { createE85PrecedenceRegistry } from "./precedence-resolution";
import { evidenceIdentityKey } from "./rule-identity";
import { floorQualificationTiers } from "./qualification-types";

/** Deterministic, key-sorted serialization used only for comparison keys. Never persisted, never shown. */
function stableKey(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableKey).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableKey(obj[k])}`)
    .join(",")}}`;
}

/**
 * The comparison key deciding whether two claims about one concept AGREE.
 *
 * For USE this is the permission STATUS alone, matching Phase 4's own
 * `sameUsePermission` semantics (use-evaluation.ts). Two by-laws that both
 * permit a use while printing different wording for it agree about the
 * regulation; treating their prose as a contradiction would manufacture
 * conflicts out of drafting style and bury the real ones.
 */
function valueAgreementKey(family: E85RuleFamily, value: unknown): string {
  if (family === "USE") return stableKey((value as E85UsePermission).status);
  return stableKey(value);
}

function byString(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

/** Canonical ordering for contributions: concept, then evidence identity, then pack. Nothing downstream may depend on input position. */
function contributionOrder(a: E85RuleConceptContribution, b: E85RuleConceptContribution): number {
  return (
    byString(a.conceptKey, b.conceptKey) ||
    byString(evidenceIdentityKey(a.evidence), evidenceIdentityKey(b.evidence)) ||
    byString(a.packId, b.packId)
  );
}

function claimFrom(contribution: E85RuleConceptContribution, pack: E85RulePack): E85ConceptClaim {
  return {
    packId: pack.packId,
    sourceId: pack.sourceId,
    ...(pack.sourceVersionId !== undefined ? { sourceVersionId: pack.sourceVersionId } : {}),
    ...(pack.adapterId !== undefined ? { adapterId: pack.adapterId } : {}),
    ...(pack.adapterVersion !== undefined ? { adapterVersion: pack.adapterVersion } : {}),
    value: contribution.evidence.value,
    provenance: contribution.evidence.provenance,
    temporal: contribution.evidence.temporal,
  };
}

function temporalIsUncertain(temporal: E85TemporalWindow): boolean {
  return temporal.effectiveDateBasis === "UNKNOWN" || temporal.effectiveFrom === undefined;
}

/**
 * Whether `x` displaces `y` for this concept under some stated relation, and
 * which relation says so.
 *
 * OVERRIDES is directional and settled by the relation alone. NARROWS is
 * settled by the VALUES, in the direction the relation states — and only for
 * numbers, because "more restrictive" has no meaning for a use status or a
 * free-text amenity requirement, and inventing one would be precisely the kind
 * of hidden legal assumption this phase exists to prevent.
 */
function displaces(
  x: E85RuleConceptContribution,
  y: E85RuleConceptContribution,
  family: E85RuleFamily,
  conceptKey: E85RuleConceptKey,
  registry: ReturnType<typeof createE85PrecedenceRegistry>,
  affirmed: ReadonlySet<string>,
): E85PrecedenceRelation | undefined {
  const applicable = (relations: readonly E85PrecedenceRelation[]): E85PrecedenceRelation[] =>
    relations.filter((r) => r.conditionalOn === undefined || affirmed.has(r.conditionalOn));

  for (const relation of applicable(registry.relationsFor(x.packId, y.packId, family, conceptKey))) {
    if (relation.type === "OVERRIDES") return relation;
    if (relation.type === "NARROWS") {
      const winner = narrowsWinner(relation, x.evidence.value, y.evidence.value);
      if (winner === "X") return relation;
    }
  }
  // A NARROWS stated in the other direction still decides this pair — it says
  // "within this scope the more restrictive governs", which is symmetric once
  // declared, unlike OVERRIDES which names a specific winner.
  for (const relation of applicable(registry.relationsFor(y.packId, x.packId, family, conceptKey))) {
    if (relation.type === "NARROWS") {
      const winner = narrowsWinner(relation, y.evidence.value, x.evidence.value);
      if (winner === "Y") return relation;
    }
  }
  return undefined;
}

/** Which of two values a NARROWS relation selects. Returns undefined when the values are not both numeric, so a NARROWS never decides something it cannot meaningfully rank. */
function narrowsWinner(relation: E85PrecedenceRelation, xValue: unknown, yValue: unknown): "X" | "Y" | undefined {
  if (typeof xValue !== "number" || typeof yValue !== "number") return undefined;
  if (xValue === yValue) return undefined;
  const lowerWins = relation.restrictiveDirection === "LOWER_IS_MORE_RESTRICTIVE";
  const xWins = lowerWins ? xValue < yValue : xValue > yValue;
  return xWins ? "X" : "Y";
}

/**
 * Composes independently-normalized rule packs into one effective rule set.
 *
 * Every failure that can arise from ordinary regulatory data is a typed result,
 * never an exception: unresolved precedence, contradictory metadata, a cycle, a
 * dangling pack reference. Exceptions are reserved for programmer defects, and
 * this function raises none.
 */
export function composeE85RulePacks(packs: readonly E85RulePack[], options: E85CompositionOptions = {}): E85CompositionResult {
  const problems: E85CompositionProblem[] = [];

  // --- pack-level validation ---
  const idCounts = new Map<string, number>();
  for (const p of packs) idCounts.set(p.packId, (idCounts.get(p.packId) ?? 0) + 1);
  const duplicateIds = [...idCounts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
  if (duplicateIds.length > 0) {
    problems.push({
      code: "DUPLICATE_PACK_ID",
      packIds: duplicateIds.sort(),
      detail: `Pack id(s) ${duplicateIds.sort().map((p) => `"${p}"`).join(", ")} are supplied more than once; a precedence relation naming one could not identify which pack it meant.`,
    });
  }

  const contexts = sortedUnique(packs.map((p) => `${p.jurisdictionId}/${p.zoneDesignation}`));
  if (contexts.length > 1) {
    problems.push({
      code: "INCOMPATIBLE_PACK_CONTEXT",
      packIds: sortedUnique(packs.map((p) => p.packId)),
      detail:
        `The packs describe more than one governing context (${contexts.join(", ")}). Composition answers how instruments over ONE jurisdiction and zone ` +
        `interact; rules from different contexts are not merged, and the contradiction is reported rather than resolved by preferring either.`,
    });
  }

  // Deterministic and clock-free: the caller's timestamp, else the latest
  // normalization time among the packs, else an obvious epoch sentinel. The
  // value is a record of when composition ran, never evidence about the rules.
  const packTimestamps = packs.map((p) => p.normalizedAt).filter((t): t is string => t !== undefined).sort();
  const composedAt = options.composedAt ?? packTimestamps[packTimestamps.length - 1] ?? "1970-01-01T00:00:00.000Z";

  if (problems.length > 0) {
    return {
      outcome: "REFUSED",
      problems,
      manualReview: {
        reasonCode: "PROFESSIONAL_INTERPRETATION_REQUIRED",
        explanation: problems.map((p) => p.detail).join(" "),
        evidenceConsidered: sortedUnique(packs.map((p) => p.sourceId)),
        flaggedAt: composedAt,
      },
    };
  }

  const findings: E85CompositionFinding[] = [];
  const packById = new Map(packs.map((p) => [p.packId, p]));
  const affirmed = new Set(options.affirmedConditions ?? []);

  // --- precedence validation ---
  const registry = createE85PrecedenceRegistry(
    options.precedenceRelations ?? [],
    packs.map((p) => p.packId),
  );
  for (const problem of registry.problems()) {
    findings.push({
      code: "PRECEDENCE_METADATA_REJECTED",
      severity: "WARNING",
      packIds: problem.packIds,
      relationIds: problem.relationIds,
      message:
        `${problem.detail} Concepts this relation would have decided fall back to ordinary conflict handling, ` +
        `so an unusable precedence declaration can never quietly become a decision.`,
    });
  }

  // --- gather contributions ---
  const contributions: E85RuleConceptContribution[] = [];
  const overlays: E85OverlayDeclaration[] = [];
  const pendingConditional: E85ConditionalRuleRecord[] = [];

  for (const pack of [...packs].sort((a, b) => byString(a.packId, b.packId))) {
    const unconditional = decomposeE85Rules(pack.rules, pack.packId);
    contributions.push(...unconditional.contributions);
    overlays.push(...unconditional.overlays);

    for (const conditional of pack.conditionalRules) {
      if (affirmed.has(conditional.condition)) {
        // Admission is not victory. The rule now competes for its concept on
        // exactly the same terms as every other claim, and if it disagrees with
        // one, the disagreement is unresolved like any other.
        const admitted = decomposeE85Rules([conditional.rule], pack.packId);
        contributions.push(...admitted.contributions);
        overlays.push(...admitted.overlays);
        findings.push({
          code: "CONDITIONAL_RULE_ADMITTED",
          severity: "WARNING",
          packIds: [pack.packId],
          message:
            `Condition "${conditional.condition}" was affirmed by the caller, admitting pack "${pack.packId}"'s conditional rule (source fact ` +
            `"${conditional.sourceFactId}") into composition. Admission makes it eligible, not authoritative: it is ranked against other claims like any other.`,
        });
      } else {
        pendingConditional.push(conditional);
        findings.push({
          code: "CONDITIONAL_RULE_PRESERVED",
          severity: "INFO",
          packIds: [pack.packId],
          message:
            `Pack "${pack.packId}" holds a rule conditioned on "${conditional.condition}" (source fact "${conditional.sourceFactId}"). ` +
            `It is excluded from the effective rules; only an exact caller affirmation admits it, and composition never affirms one itself.`,
        });
      }
    }
  }

  contributions.sort(contributionOrder);

  // --- group by regulated concept ---
  const groups = new Map<E85RuleConceptKey, E85RuleConceptContribution[]>();
  for (const c of contributions) {
    const list = groups.get(c.conceptKey) ?? [];
    list.push(c);
    groups.set(c.conceptKey, list);
  }

  const effective: E85RuleConceptContribution[] = [];
  const suppressed: E85SuppressedRuleRecord[] = [];
  const unresolvedConflicts: E85CompositionConflict[] = [];
  const appliedRelations = new Map<string, E85PrecedenceRelation>();

  for (const conceptKey of [...groups.keys()].sort()) {
    const family = conceptKeyFamily(conceptKey);
    const raw = groups.get(conceptKey)!;

    // (a) Collapse byte-identical evidence. A bundle supplied twice is one
    //     authority speaking once, never two agreeing.
    const seen = new Set<string>();
    const items: E85RuleConceptContribution[] = [];
    let collapsed = 0;
    for (const c of raw) {
      const key = `${c.packId}|${evidenceIdentityKey(c.evidence)}`;
      const crossPackKey = evidenceIdentityKey(c.evidence);
      if (seen.has(key) || seen.has(crossPackKey)) {
        collapsed++;
        continue;
      }
      seen.add(key);
      seen.add(crossPackKey);
      items.push(c);
    }
    if (collapsed > 0) {
      findings.push({
        code: "DUPLICATE_RULE_COLLAPSED",
        severity: "INFO",
        conceptKey,
        family,
        packIds: sortedUnique(raw.map((c) => c.packId)),
        message:
          `${collapsed} duplicate claim(s) for ${conceptKey} carried identical evidence (same value, source, locator and temporal window) and were counted once. ` +
          `A repeated read is not corroboration and does not raise qualification.`,
      });
    }

    // (b) One claim: nothing to reconcile.
    if (items.length === 1) {
      effective.push(items[0]);
      findings.push({
        code: "SINGLE_SOURCE_CONCEPT",
        severity: "INFO",
        conceptKey,
        family,
        packIds: [items[0].packId],
        message: `${conceptKey} is stated only by pack "${items[0].packId}"; it carries through unchanged.`,
      });
      continue;
    }

    // (c) Several claims that agree: keep every provenance chain, raise nothing.
    const agreementKeys = sortedUnique(items.map((c) => valueAgreementKey(family, c.evidence.value)));
    if (agreementKeys.length === 1) {
      effective.push(items[0]);
      findings.push({
        code: "INDEPENDENT_AGREEMENT_PRESERVED",
        severity: "INFO",
        conceptKey,
        family,
        packIds: sortedUnique(items.map((c) => c.packId)),
        message:
          `${items.length} authorities state the same value for ${conceptKey} from different evidence. All provenance chains are retained and the ` +
          `agreement does not raise qualification — independent corroboration is recorded, never scored.`,
      });
      continue;
    }

    // (d) Genuine disagreement. Only an explicitly stated relation can settle it.
    const beatenBy = new Map<number, E85PrecedenceRelation>();
    for (let i = 0; i < items.length; i++) {
      for (let j = 0; j < items.length; j++) {
        if (i === j || items[i].packId === items[j].packId) continue;
        const relation = displaces(items[i], items[j], family, conceptKey, registry, affirmed);
        if (relation && !beatenBy.has(j)) beatenBy.set(j, relation);
      }
    }

    const survivorIdx = items.map((_, i) => i).filter((i) => !beatenBy.has(i));
    const survivorAgreement = sortedUnique(survivorIdx.map((i) => valueAgreementKey(family, items[i].evidence.value)));

    if (survivorIdx.length > 0 && survivorAgreement.length === 1) {
      const winner = items[survivorIdx[0]];
      effective.push(winner);
      const winningClaim = claimFrom(winner, packById.get(winner.packId)!);

      for (const [idx, relation] of [...beatenBy.entries()].sort((a, b) => a[0] - b[0])) {
        appliedRelations.set(relation.relationId, relation);
        const loser = items[idx];
        suppressed.push({
          conceptKey,
          family,
          suppressed: claimFrom(loser, packById.get(loser.packId)!),
          effective: winningClaim,
          relationId: relation.relationId,
          relation,
          reason:
            `Pack "${loser.packId}"'s value for ${conceptKey} is displaced by pack "${winner.packId}" under relation "${relation.relationId}" ` +
            `(${relation.subjectPackId} ${relation.type} ${relation.objectPackId}). The displaced claim is preserved here in full.`,
        });
        findings.push({
          code: "RULE_OVERRIDDEN",
          severity: "WARNING",
          conceptKey,
          family,
          packIds: sortedUnique([loser.packId, winner.packId]),
          relationIds: [relation.relationId],
          message:
            `${conceptKey}: pack "${winner.packId}" governs; pack "${loser.packId}" is displaced by explicit relation "${relation.relationId}". ` +
            `Both claims remain in the composition audit.`,
        });
      }

      findings.push({
        code: "PRECEDENCE_RELATION_APPLIED",
        severity: "INFO",
        conceptKey,
        family,
        packIds: sortedUnique(items.map((c) => c.packId)),
        relationIds: sortedUnique([...beatenBy.values()].map((r) => r.relationId)),
        message: `${conceptKey} was contested by ${items.length} packs and resolved by explicitly stated precedence, not by input order, role label, recency, or restrictiveness.`,
      });
      continue;
    }

    // (e) Nothing ranks them. Say so.
    const claims = items.map((c) => claimFrom(c, packById.get(c.packId)!));
    const distinctValues = [...new Map(items.map((c) => [valueAgreementKey(family, c.evidence.value), c.evidence.value])).values()];
    const temporalUncertainty = items.some((c) => temporalIsUncertain(c.evidence.temporal));
    const detail =
      `${items.length} authoritative claims for ${conceptKey} state ${agreementKeys.length} different values ` +
      `(packs ${sortedUnique(items.map((c) => c.packId)).join(", ")}), and no stated precedence relation ranks them. ` +
      `No value is selected: neither the lower nor the higher figure, neither the first nor the last supplied, and no role label decides it.`;

    unresolvedConflicts.push({ conceptKey, family, claims, distinctValues, detail, temporalUncertainty });

    findings.push({
      code: "AUTHORITATIVE_CONFLICT_UNRESOLVED",
      severity: "MANUAL_REVIEW",
      conceptKey,
      family,
      packIds: sortedUnique(items.map((c) => c.packId)),
      message: detail,
      manualReview: {
        reasonCode: "CONFLICTING_AUTHORITATIVE_SOURCES",
        explanation: detail,
        evidenceConsidered: sortedUnique(claims.map((c) => c.sourceId)),
        flaggedAt: composedAt,
      },
    });

    if (temporalUncertainty) {
      findings.push({
        code: "TEMPORAL_RELATION_UNRESOLVED",
        severity: "WARNING",
        conceptKey,
        family,
        packIds: sortedUnique(items.map((c) => c.packId)),
        message:
          `At least one competing claim for ${conceptKey} has no established effective date, so it cannot be placed in time relative to the others. ` +
          `Publication or consolidation recency is NOT used as a substitute: a source version says which text was read, never which rule superseded which.`,
      });
    }
  }

  // --- rules that simply coexist ---
  const multiPackConcepts = [...groups.values()].filter((g) => sortedUnique(g.map((c) => c.packId)).length > 1).length;
  if (packs.length > 1) {
    findings.push({
      code: "RULES_COMBINED",
      severity: "INFO",
      packIds: sortedUnique(packs.map((p) => p.packId)),
      message:
        `${packs.length} rule packs contributed ${groups.size} distinct regulated concepts. ${multiPackConcepts} concept(s) were claimed by more than one pack; ` +
        `the remainder regulate different things and coexist without interaction.`,
    });
  }

  // --- readiness limitations: reported, never enforced ---
  const readinessLimitations: E85CompositionReadinessLimitation[] = [];
  for (const pack of [...packs].sort((a, b) => byString(a.packId, b.packId))) {
    const blockers = pack.readiness?.blockers ?? [];
    if (blockers.length === 0) continue;
    const detail =
      `Pack "${pack.packId}" (source "${pack.sourceId}") carries readiness blocker(s) ${[...blockers].sort().join(", ")}. ` +
      `This is a rights/coverage limitation and has no bearing on what the instrument legally says: no rule is suppressed, downgraded, or reordered because of it.`;
    readinessLimitations.push({ packId: pack.packId, sourceId: pack.sourceId, blockers: [...blockers].sort(), detail });
    findings.push({ code: "SOURCE_READINESS_LIMITATION", severity: "WARNING", packIds: [pack.packId], message: detail });
  }

  // --- qualification: floor, never average ---
  const declared = packs.map((p) => p.qualification).filter((q): q is E85BundleQualification => q !== undefined);
  const qualification: E85BundleQualification =
    declared.length > 0
      ? {
          evidenceQuality: floorQualificationTiers(...declared.map((q) => q.evidenceQuality)),
          ruleApplicability: floorQualificationTiers(...declared.map((q) => q.ruleApplicability)),
        }
      : { evidenceQuality: "low", ruleApplicability: "low" };

  const effectiveSorted = [...effective].sort(contributionOrder);
  const composed: E85ComposedRulePack = {
    jurisdictionId: packs[0]?.jurisdictionId ?? "",
    zoneDesignation: packs[0]?.zoneDesignation ?? "",
    status: unresolvedConflicts.length > 0 ? "COMPOSED_WITH_UNRESOLVED_CONFLICTS" : "COMPOSED",
    effectiveRules: reassembleE85Rules(effectiveSorted, overlays),
    conditionalRules: pendingConditional,
    contributingPackIds: sortedUnique(packs.map((p) => p.packId)),
    contributingSourceIds: sortedUnique(packs.map((p) => p.sourceId)),
    suppressed: [...suppressed].sort((a, b) => byString(a.conceptKey, b.conceptKey) || byString(a.suppressed.packId, b.suppressed.packId)),
    unresolvedConflicts: [...unresolvedConflicts].sort((a, b) => byString(a.conceptKey, b.conceptKey)),
    findings: [...findings].sort((a, b) => byString(a.code, b.code) || byString(a.conceptKey ?? "", b.conceptKey ?? "") || byString(a.message, b.message)),
    precedenceProblems: registry.problems(),
    appliedRelations: [...appliedRelations.values()].sort((a, b) => byString(a.relationId, b.relationId)),
    qualification,
    readinessLimitations,
    composedAt,
  };

  return { outcome: "COMPOSED", composed };
}

/**
 * The unresolved conflicts that could actually affect the requested outputs.
 *
 * Phase 4 already scopes DATA_GAP to what was asked for; this keeps the same
 * discipline across composition. A contested parking ratio must not sink a
 * request that only asks about use and density — it is a real conflict, and it
 * is also irrelevant to the question on the table.
 */
export function materialCompositionConflicts(
  composed: E85ComposedRulePack,
  requestedAnalyses: readonly E85RequestedAnalysis[],
): readonly E85CompositionConflict[] {
  return composed.unresolvedConflicts.filter((c) => requestedAnalyses.includes(c.family));
}

/** A single manual-review record covering every conflict material to the requested analyses, or undefined when none is. */
export function compositionManualReview(
  composed: E85ComposedRulePack,
  requestedAnalyses: readonly E85RequestedAnalysis[],
): E85ManualReviewRecord | undefined {
  const material = materialCompositionConflicts(composed, requestedAnalyses);
  if (material.length === 0) return undefined;
  return {
    reasonCode: "CONFLICTING_AUTHORITATIVE_SOURCES",
    explanation: material.map((c) => c.detail).join(" "),
    evidenceConsidered: sortedUnique(material.flatMap((c) => c.claims.map((claim) => claim.sourceId))),
    flaggedAt: composed.composedAt,
  };
}

/** Every evidence item backing one effective rule value, for tracing a final number back to its source. */
export function traceE85EffectiveConcept(composed: E85ComposedRulePack, conceptKey: E85RuleConceptKey): E85Evidence<unknown> | undefined {
  const decomposed = decomposeE85Rules(composed.effectiveRules, "composed");
  return decomposed.contributions.find((c) => c.conceptKey === conceptKey)?.evidence;
}

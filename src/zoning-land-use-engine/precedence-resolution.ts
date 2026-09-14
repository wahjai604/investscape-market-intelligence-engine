/**
 * InvestScape™ E85 Phase 6 — Multi-Source Rule-Pack Composition: precedence
 * validation and lookup.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * A generic registry over explicitly-stated relations. It resolves exact pack
 * pairs and exact scopes, and it has no default hierarchy, no fallback, and no
 * knowledge of composition roles — `E85CompositionRole` is never read in this
 * file, which is what makes "role does not equal precedence" structural rather
 * than aspirational.
 *
 * Validation happens up front and refuses relations rather than repairing them:
 * a self-reference, a NARROWS with no stated direction, a duplicate relation id,
 * a reference to a pack that is not being composed, two relations that
 * contradict each other, or a cycle. Each is returned as a typed problem, and
 * the relations involved are withheld from resolution entirely — so a
 * contradiction never resolves by luck, and a cycle is never broken by input
 * order. Concepts those relations would have decided fall through to ordinary
 * unresolved-conflict handling, which is exactly where an unanswerable
 * precedence question belongs.
 */
import type { E85PrecedenceRelation, E85PrecedenceProblem, E85PrecedenceScope } from "./precedence-types";
import { precedenceScopeCovers } from "./precedence-types";
import type { E85RuleFamily } from "./rule-family-types";
import type { E85RuleConceptKey } from "./rule-concept-identity";

export interface E85PrecedenceRegistry {
  /** Relations that passed validation, in deterministic `relationId` order. */
  usable(): readonly E85PrecedenceRelation[];
  /** Problems found during validation, in deterministic order. */
  problems(): readonly E85PrecedenceProblem[];
  /**
   * Every usable relation covering this exact concept for this exact ordered
   * pair, in `relationId` order. Both directions must be asked for separately —
   * this never infers the reverse of a stated relation.
   */
  relationsFor(subjectPackId: string, objectPackId: string, family: E85RuleFamily, conceptKey: E85RuleConceptKey): readonly E85PrecedenceRelation[];
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function scopeKey(scope: E85PrecedenceScope | undefined): string {
  if (scope === undefined) return "*";
  const families = scope.families ? [...scope.families].sort().join(",") : "*";
  const concepts = scope.conceptKeys ? [...scope.conceptKeys].sort().join(",") : "*";
  return `${families}|${concepts}`;
}

/** Whether two scopes could both cover some concept — used to decide whether contradictory relations actually collide. */
function scopesIntersect(a: E85PrecedenceScope | undefined, b: E85PrecedenceScope | undefined): boolean {
  if (a === undefined || b === undefined) return true;
  if (a.families && b.families && !a.families.some((f) => b.families!.includes(f))) return false;
  if (a.conceptKeys && b.conceptKeys && !a.conceptKeys.some((c) => b.conceptKeys!.includes(c))) return false;
  return true;
}

/** Relations that actually decide a winner. SUPPLEMENTS deliberately does not — it says the packs coexist, not who governs a shared concept. */
function isDeciding(relation: E85PrecedenceRelation): boolean {
  return relation.type === "OVERRIDES" || relation.type === "NARROWS";
}

/**
 * The concepts at which cycles must be checked.
 *
 * Cycles are a PER-CONCEPT property, not a per-pack one. "The agreement governs
 * height, the base by-law governs density" points the two relations in opposite
 * directions between the same pair of packs, and is a perfectly ordinary and
 * legal arrangement — no concept is decided twice. Checking the pack graph
 * alone would call that a cycle and throw away both relations, so instead each
 * distinct scope mentioned by any relation becomes a probe, and cycles are
 * sought independently at each.
 *
 * Family and wildcard probes use sentinel keys no real relation can list, so a
 * concept-scoped relation matches only its own concepts, while family-scoped and
 * unscoped relations match the broader probes as they should.
 */
function cycleProbes(relations: readonly E85PrecedenceRelation[]): { family: E85RuleFamily; conceptKey: E85RuleConceptKey }[] {
  const probes = new Map<string, { family: E85RuleFamily; conceptKey: E85RuleConceptKey }>();
  probes.set("*", { family: "*" as E85RuleFamily, conceptKey: "*:*" });
  for (const r of relations) {
    for (const key of r.scope?.conceptKeys ?? []) {
      probes.set(key, { family: key.slice(0, key.indexOf(":")) as E85RuleFamily, conceptKey: key });
    }
    for (const family of r.scope?.families ?? []) {
      probes.set(`${family}:*`, { family, conceptKey: `${family}:*` });
    }
  }
  return [...probes.values()].sort((a, b) => byStringKey(a.conceptKey, b.conceptKey));
}

function byStringKey(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Finds every cycle-participating pack in the deciding-relation graph AT ONE
 * CONCEPT.
 *
 * Returns the set of packs that lie on some cycle there. Any relation touching
 * one is withheld: in "A overrides B, B overrides A" neither can be said to win,
 * and in a longer ring the same is true of every edge. Choosing an entry point
 * would be choosing by input order, which is the one thing composition must
 * never do.
 */
function packsOnCycles(relations: readonly E85PrecedenceRelation[]): Set<string> {
  const edges = new Map<string, string[]>();
  for (const r of relations) {
    if (!isDeciding(r)) continue;
    const list = edges.get(r.subjectPackId) ?? [];
    list.push(r.objectPackId);
    edges.set(r.subjectPackId, list);
  }

  const onCycle = new Set<string>();
  const WHITE = 0;
  const GREY = 1;
  const BLACK = 2;
  const colour = new Map<string, number>();
  const stack: string[] = [];

  const visit = (node: string): void => {
    colour.set(node, GREY);
    stack.push(node);
    for (const next of (edges.get(node) ?? []).slice().sort()) {
      const c = colour.get(next) ?? WHITE;
      if (c === WHITE) {
        visit(next);
      } else if (c === GREY) {
        // Everything from `next` up the current stack is on the cycle.
        const from = stack.lastIndexOf(next);
        for (const p of stack.slice(from)) onCycle.add(p);
      }
    }
    stack.pop();
    colour.set(node, BLACK);
  };

  for (const node of [...edges.keys()].sort()) {
    if ((colour.get(node) ?? WHITE) === WHITE) visit(node);
  }
  return onCycle;
}

/**
 * Validates relations against the packs actually being composed and returns a
 * registry over those that survive.
 *
 * `knownPackIds` is required: a relation pointing at a pack nobody supplied is
 * not a harmless no-op, it is a sign the caller believes an instrument is in
 * play that is not, and silently ignoring it would hide that.
 */
export function createE85PrecedenceRegistry(relations: readonly E85PrecedenceRelation[], knownPackIds: readonly string[]): E85PrecedenceRegistry {
  const problems: E85PrecedenceProblem[] = [];
  const known = new Set(knownPackIds);
  const withheld = new Set<string>();

  const withhold = (relation: E85PrecedenceRelation, problem: E85PrecedenceProblem): void => {
    withheld.add(relation.relationId);
    problems.push(problem);
  };

  // --- structural validation ---
  const seenIds = new Map<string, number>();
  for (const r of relations) {
    seenIds.set(r.relationId, (seenIds.get(r.relationId) ?? 0) + 1);
  }

  for (const r of relations) {
    if ((seenIds.get(r.relationId) ?? 0) > 1) {
      withhold(r, {
        code: "MALFORMED_RELATION",
        relationIds: [r.relationId],
        packIds: sortedUnique([r.subjectPackId, r.objectPackId]),
        detail: `Relation id "${r.relationId}" is declared more than once; which declaration applied would depend on input order.`,
      });
      continue;
    }
    if (r.subjectPackId === r.objectPackId) {
      withhold(r, {
        code: "MALFORMED_RELATION",
        relationIds: [r.relationId],
        packIds: [r.subjectPackId],
        detail: `Relation "${r.relationId}" names pack "${r.subjectPackId}" as both subject and object; a pack cannot take precedence over itself.`,
      });
      continue;
    }
    if (r.type === "NARROWS" && r.restrictiveDirection === undefined) {
      withhold(r, {
        code: "MALFORMED_RELATION",
        relationIds: [r.relationId],
        packIds: sortedUnique([r.subjectPackId, r.objectPackId]),
        detail:
          `Relation "${r.relationId}" is NARROWS but states no restrictiveDirection. Which way "more restrictive" runs is a legal reading, ` +
          `not something to infer from a field name, so the relation is refused rather than given a default.`,
      });
      continue;
    }
    const unknown = [r.subjectPackId, r.objectPackId].filter((p) => !known.has(p));
    if (unknown.length > 0) {
      withhold(r, {
        code: "UNKNOWN_PACK_REFERENCE",
        relationIds: [r.relationId],
        packIds: sortedUnique(unknown),
        detail: `Relation "${r.relationId}" refers to pack(s) ${unknown.map((p) => `"${p}"`).join(", ")}, which are not among the packs being composed.`,
      });
    }
  }

  // --- contradictory declarations about the same pair ---
  const structurallyOk = relations.filter((r) => !withheld.has(r.relationId));
  for (let i = 0; i < structurallyOk.length; i++) {
    for (let j = i + 1; j < structurallyOk.length; j++) {
      const a = structurallyOk[i];
      const b = structurallyOk[j];
      const samePair = a.subjectPackId === b.subjectPackId && a.objectPackId === b.objectPackId;
      const reversedPair = a.subjectPackId === b.objectPackId && a.objectPackId === b.subjectPackId;
      if (!samePair && !reversedPair) continue;
      if (!scopesIntersect(a.scope, b.scope)) continue;

      // Two deciding relations pointing opposite ways, or two different
      // deciding types for the same pair and scope, are a genuine
      // disagreement between authorities. Neither is preferred.
      const bothDeciding = isDeciding(a) && isDeciding(b);
      const contradiction = bothDeciding && (reversedPair || a.type !== b.type || scopeKey(a.scope) === scopeKey(b.scope));
      if (!contradiction) continue;

      const problem: E85PrecedenceProblem = {
        code: "CONFLICTING_PRECEDENCE_DECLARATIONS",
        relationIds: sortedUnique([a.relationId, b.relationId]),
        packIds: sortedUnique([a.subjectPackId, a.objectPackId]),
        detail:
          `Relations "${a.relationId}" (${a.subjectPackId} ${a.type} ${a.objectPackId}) and "${b.relationId}" ` +
          `(${b.subjectPackId} ${b.type} ${b.objectPackId}) make incompatible claims over overlapping scope. ` +
          `Neither is applied; the authorities behind them disagree and a reviewer must decide which governs.`,
      };
      withheld.add(a.relationId);
      withheld.add(b.relationId);
      problems.push(problem);
    }
  }

  // --- cycles among whatever still stands, checked concept by concept ---
  const afterContradictions = relations.filter((r) => !withheld.has(r.relationId));
  const reportedCycles = new Set<string>();
  for (const probe of cycleProbes(afterContradictions)) {
    const atProbe = afterContradictions.filter((r) => precedenceScopeCovers(r.scope, probe.family, probe.conceptKey));
    const cyclic = packsOnCycles(atProbe);
    if (cyclic.size === 0) continue;

    const involved = atProbe.filter((r) => isDeciding(r) && cyclic.has(r.subjectPackId) && cyclic.has(r.objectPackId));
    if (involved.length === 0) continue;

    for (const r of involved) withheld.add(r.relationId);
    const signature = sortedUnique(involved.map((r) => r.relationId)).join(",");
    if (reportedCycles.has(signature)) continue;
    reportedCycles.add(signature);

    problems.push({
      code: "PRECEDENCE_CYCLE",
      relationIds: sortedUnique(involved.map((r) => r.relationId)),
      packIds: sortedUnique([...cyclic]),
      detail:
        `The precedence relations ${sortedUnique(involved.map((r) => `"${r.relationId}"`)).join(", ")} form a cycle across packs ` +
        `${sortedUnique([...cyclic]).map((p) => `"${p}"`).join(", ")} for scope ${probe.conceptKey}. No pack in a cycle can be said to take ` +
        `precedence, so none of these relations is applied — breaking the cycle at an arbitrary point would make the answer depend on input order.`,
    });
  }

  const usable = relations.filter((r) => !withheld.has(r.relationId)).sort((a, b) => (a.relationId < b.relationId ? -1 : a.relationId > b.relationId ? 1 : 0));

  const sortedProblems = [...problems].sort((a, b) => {
    const ka = `${a.code}|${a.relationIds.join(",")}`;
    const kb = `${b.code}|${b.relationIds.join(",")}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  return {
    usable: () => usable,
    problems: () => sortedProblems,
    relationsFor: (subjectPackId, objectPackId, family, conceptKey) =>
      usable.filter((r) => r.subjectPackId === subjectPackId && r.objectPackId === objectPackId && precedenceScopeCovers(r.scope, family, conceptKey)),
  };
}

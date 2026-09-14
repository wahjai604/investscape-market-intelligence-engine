/**
 * InvestScape™ E85 Phase 9 — Decision Orchestration: terminal status derivation.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * ONE function decides the decision package's terminal status, for the same
 * reason Phase 4 has exactly one: a status assembled from scattered `if`s
 * throughout a pipeline ends up meaning "whichever check ran last", which is not
 * a legal statement about anything.
 *
 * The vocabulary is E85's existing terminal vocabulary, reused rather than
 * duplicated. A parallel orchestration status family would force every caller to
 * learn a second way of being told the same four things.
 *
 * THE PRECEDENCE, EXACT AND DOCUMENTED — matching `determineOverallStatus`
 * (result-status.ts) so the two layers cannot drift apart:
 *
 *   1. Any BLOCKING materiality record of kind MANUAL_REVIEW
 *        -> MANUAL_REVIEW_REQUIRED
 *   2. Else any BLOCKING materiality record of kind GAP
 *        -> DATA_GAP
 *   3. Else Phase 4's own terminal status, when it ran, is adopted.
 *   4. Else (Phase 4 never ran, nothing blocking)
 *        -> DATA_GAP — nothing was evaluated, so nothing is resolved.
 *   5. Else any warning
 *        -> MACHINE_RESOLVED_WITH_WARNINGS
 *   6. Else
 *        -> MACHINE_RESOLVED
 *
 * "BLOCKING" means MATERIAL or UNDETERMINED (see `isE85DecisionBlocking`).
 * UNDETERMINED blocks: relevance that could not be established is not
 * irrelevance.
 *
 * WHY MANUAL_REVIEW OUTRANKS GAP, and what that ordering is NOT. It is an
 * orchestration reporting policy, chosen because it routes the package to a
 * person — the only party who can act on either class — and kept identical to
 * Phase 4's existing order. It is emphatically NOT a claim that one legal
 * problem outweighs another. No severity is scored, no numeric weight exists,
 * and no enum's string order is relied on anywhere. Every blocker of both
 * classes remains fully visible on the package regardless of which single
 * terminal status is chosen; a caller that needs the other class reads
 * `blockers` and finds it there.
 */
import type { E85DecisionMaterialityRecord } from "./decision-package-types";
import { isE85DecisionBlocking } from "./decision-package-types";
import type { E85EvaluationOutcome } from "./evaluator-result-types";
import type { E85OverallStatus } from "./result-status";

export interface E85DecisionStatusInput {
  materiality: readonly E85DecisionMaterialityRecord[];
  /** Absent when Phase 4 never ran. */
  phase4?: E85EvaluationOutcome;
  warnings: readonly string[];
}

/** The blocking subset of a materiality set. A view over one source of truth, never a second one. */
export function e85DecisionBlockers(materiality: readonly E85DecisionMaterialityRecord[]): readonly E85DecisionMaterialityRecord[] {
  return materiality.filter(isE85DecisionBlocking);
}

/**
 * Derives the terminal status. Pure, deterministic, clock-free, and independent
 * of the order of every input array — each step asks whether a record of a kind
 * EXISTS, never which one came first.
 */
export function determineE85DecisionStatus(input: E85DecisionStatusInput): E85OverallStatus {
  const blockers = e85DecisionBlockers(input.materiality);

  // 1 & 2 — orchestration blockers, by kind.
  if (blockers.some((b) => b.kind === "MANUAL_REVIEW")) return "MANUAL_REVIEW_REQUIRED";
  if (blockers.some((b) => b.kind === "GAP")) return "DATA_GAP";

  // 3 — Phase 4's own conclusion about the rules it was given. Adopted, never
  //     re-derived: Phase 9 does not second-guess the evaluator's materiality.
  if (input.phase4 !== undefined) {
    const evaluated = input.phase4.result.status;
    if (evaluated !== "MACHINE_RESOLVED") {
      return evaluated === "MACHINE_RESOLVED_WITH_WARNINGS" && input.warnings.length === 0 ? "MACHINE_RESOLVED_WITH_WARNINGS" : evaluated;
    }
  } else {
    // 4 — Nothing was evaluated. There is no resolved answer to report, and
    //     reporting MACHINE_RESOLVED for an empty evaluation would be the
    //     emptiest possible clean answer.
    return "DATA_GAP";
  }

  // 5 & 6.
  return input.warnings.length > 0 ? "MACHINE_RESOLVED_WITH_WARNINGS" : "MACHINE_RESOLVED";
}

/**
 * InvestScape™ E70 Phase 4 — Escalation Policy.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * A single, versioned, explicit policy object governing every escalation
 * decision. Nothing in escalation.ts or applicability.ts embeds a magic
 * constant that belongs here instead. Any provisional rule is marked
 * PROVISIONAL in both this file and docs/E70-phase4-escalation-and-index.md
 * — per the task's explicit instruction, a provisional policy must never be
 * silently treated as settled.
 */
import type { SourceDecision } from "./source-research";

export const CC_ESCALATION_POLICY_VERSION = "4.0.0-provisional";

export interface CCEscalationPolicy {
  version: string;

  /**
   * Which E70 source-research verdicts (source-research.ts) may back an
   * active escalation input. Only "USE" qualifies today — a "REGISTER"
   * source (e.g. statcan-bcpi, which has zero ingested observations) or a
   * "REJECT" source is acknowledged as existing but never used to compute a
   * number (Design Principle 2: "no invented index data").
   */
  allowedIndexSourceStatuses: readonly SourceDecision[];

  geography: {
    /**
     * PROVISIONAL. Whether a national-level index series may pair with a
     * city-level cost observation at all, and only ever as an explicit
     * INDIRECT relationship (never silently promoted to DIRECT). This is
     * NOT a generic "national counts as local" rule — it is gated entirely
     * by applicability.ts's explicit per-series rule table, which currently
     * grants this only to RLB's own National Construction Cost Index, whose
     * own published methodology states it as a cross-market US escalation
     * input. Setting this to false forces every city-level cost observation
     * to require its own city-level index or fail with DATA_GAP.
     */
    allowNationalIndexForCityCost: boolean;
  };

  period: {
    /**
     * Whether a request whose target period exactly equals the source
     * observation's own period is served as a trivial identity escalation
     * (ratio 1.0, no index lookup required) rather than requiring an index
     * observation to exist for that exact period. This is a deliberate,
     * narrow convenience — it never applies unless the periods are
     * byte-identical (see escalation.ts).
     */
    allowSamePeriodIdentity: boolean;
    /**
     * PROVISIONAL and OFF by default. If ever enabled, a request whose exact
     * period has no index observation may be served by the nearest
     * available period within `nearestPeriodToleranceDays`, and the result
     * must be labeled as using nearest-period matching. Per the task's
     * explicit instruction, nearest-period substitution must never happen
     * silently — escalation.ts refuses to apply this policy at all unless
     * both fields are set, and always records it in the result/audit trail
     * when it is used.
     */
    allowNearestPeriodMatching: boolean;
    nearestPeriodToleranceDays?: number;
    /**
     * Whether a target period earlier than the base period is served (as a
     * mathematically valid de-escalation, ratio possibly < 1) rather than
     * refused outright. Reversing a request is not, by itself, evidence of
     * an error — the same index-ratio arithmetic applies in either
     * direction, and refusing it would not make the underlying data any
     * more or less defensible. Always labeled explicitly in the audit trail
     * when the target precedes the base.
     */
    allowReversePeriodRequest: boolean;
  };

  rounding: {
    /**
     * Governs the entire pipeline: never round low/high/value, the index
     * ratio, or any intermediate quantity before the FINAL escalated figure
     * is produced (this is a hard rule per the task instructions, not a
     * policy toggle) — this field exists only to make the "no intermediate
     * rounding, full double-precision float arithmetic throughout" rule
     * explicit and inspectable rather than implicit in the code.
     */
    intermediateRounding: false;
    /**
     * Final-output rounding. "none" (the default) emits the exact computed
     * float; the source contract has not, as of Phase 4, ever required a
     * specific rounding precision (Phase 1/2/3 never round a stored dollar
     * figure), so "none" is the correct, non-invented default.
     */
    finalRounding: "none";
  };

  /** Confidence-relevant labels Phase 5 can consume without redesigning this phase's model (task's Confidence section). */
  confidenceLabels: {
    direct: string;
    indirect: string;
    unsupported: string;
  };
}

/**
 * The one policy this phase actually ships as the default. Every field
 * above is populated deliberately, never left as an implicit default buried
 * in escalation.ts.
 */
export const CC_DEFAULT_ESCALATION_POLICY: CCEscalationPolicy = {
  version: CC_ESCALATION_POLICY_VERSION,
  allowedIndexSourceStatuses: ["USE"],
  geography: {
    allowNationalIndexForCityCost: true,
  },
  period: {
    allowSamePeriodIdentity: true,
    allowNearestPeriodMatching: false,
    nearestPeriodToleranceDays: undefined,
    allowReversePeriodRequest: true,
  },
  rounding: {
    intermediateRounding: false,
    finalRounding: "none",
  },
  confidenceLabels: {
    direct: "DIRECT_INDEX_RELATIONSHIP",
    indirect: "INDIRECT_INDEX_RELATIONSHIP",
    unsupported: "UNSUPPORTED_RELATIONSHIP",
  },
};

/**
 * A strict variant with every provisional/permissive flag disabled, provided
 * so a caller can exercise conservative-only behavior explicitly (task
 * adversarial test: "explicit policy controls behavior") without E70 having
 * to silently pick one policy as the only one that ever runs.
 */
export const CC_STRICT_ESCALATION_POLICY: CCEscalationPolicy = {
  ...CC_DEFAULT_ESCALATION_POLICY,
  geography: { allowNationalIndexForCityCost: false },
  period: {
    allowSamePeriodIdentity: true,
    allowNearestPeriodMatching: false,
    nearestPeriodToleranceDays: undefined,
    allowReversePeriodRequest: false,
  },
};

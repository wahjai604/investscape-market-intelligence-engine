/**
 * InvestScape™ E85 Phase 3 — Zoning & Land-Use Rules Engine: result status
 * union.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Discriminated union with four statuses (Phase 2 correction 2/3):
 * MACHINE_RESOLVED, MACHINE_RESOLVED_WITH_WARNINGS, MANUAL_REVIEW_REQUIRED,
 * DATA_GAP. Structurally hard invalid combinations: a MACHINE_RESOLVED
 * variant has no `gaps`/`reasons` field at the type level at all, so a
 * caller cannot construct a "resolved" result that also carries gap/review
 * reasons — TypeScript's discriminated-union narrowing means accessing
 * `.gaps` on a MACHINE_RESOLVED value is a compile error, not just a
 * runtime possibility. Result status is a separate concept from
 * `E85Qualification` (qualification-types.ts) — never a fourth
 * qualification axis, and never combined with it via the floor helper.
 */
import type { E85ParcelReference } from "./jurisdiction-types";
import type { E85Qualification } from "./qualification-types";
import type { E85DataGap } from "./data-gap-types";
import type { E85ManualReviewRecord } from "./manual-review-types";
import type { E85RegulatoryEnvelopeResult } from "./envelope-types";
import type { E85RuleRecord } from "./rule-family-types";

interface E85ResultBase {
  parcel: E85ParcelReference;
  qualification: E85Qualification;
  resolvedAt: string;
  /** The rule records actually consulted in producing this result. */
  rulesConsidered: readonly E85RuleRecord[];
}

/** Every input needed was found and unambiguous; no warning, no review reason, no gap. */
export interface E85MachineResolvedResult extends E85ResultBase {
  status: "MACHINE_RESOLVED";
  envelope?: E85RegulatoryEnvelopeResult;
}

/** Resolved, but with non-blocking caveats a caller should surface (e.g. a single-source rule, or a PROVISIONAL note) that fall short of requiring manual review or indicating a gap. */
export interface E85MachineResolvedWithWarningsResult extends E85ResultBase {
  status: "MACHINE_RESOLVED_WITH_WARNINGS";
  envelope?: E85RegulatoryEnvelopeResult;
  warnings: readonly string[];
}

/** Evidence exists but requires professional/legal interpretation before the result can be trusted — see manual-review-types.ts. Never carries a `gaps` field: if evidence were actually missing, this is the wrong status. */
export interface E85ManualReviewRequiredResult extends E85ResultBase {
  status: "MANUAL_REVIEW_REQUIRED";
  reasons: readonly E85ManualReviewRecord[];
  /** Best-effort partial envelope, when some but not all envelope fields could be resolved without needing review. Optional — a manual-review result need not include one. */
  partialEnvelope?: E85RegulatoryEnvelopeResult;
}

/** Evidence is missing, insufficient, or unresolvable — see data-gap-types.ts. Never carries a `reasons` (manual-review) field, and never carries a fully-resolved numeric envelope for the gapped field(s). */
export interface E85DataGapResult extends E85ResultBase {
  status: "DATA_GAP";
  gaps: readonly E85DataGap[];
  /** Best-effort partial envelope for whatever fields WERE resolvable, distinct from the gapped fields listed in `gaps`. */
  partialEnvelope?: E85RegulatoryEnvelopeResult;
}

export type E85Result = E85MachineResolvedResult | E85MachineResolvedWithWarningsResult | E85ManualReviewRequiredResult | E85DataGapResult;

/** Narrowing helper: true only for statuses that carry a usable (possibly partial, for warnings) envelope-bearing shape. Does not itself resolve anything — a pure type-narrowing convenience. */
export function isMachineResolved(result: E85Result): result is E85MachineResolvedResult | E85MachineResolvedWithWarningsResult {
  return result.status === "MACHINE_RESOLVED" || result.status === "MACHINE_RESOLVED_WITH_WARNINGS";
}

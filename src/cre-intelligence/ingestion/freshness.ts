/**
 * InvestScape™ E68 Phase 8 — Freshness / Staleness Model.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Parts 6, 7, 16. Deliberately holds NO hard-coded universal "N days is
 * stale" constant. Freshness is evaluated relative to a source's own
 * declared `CRERefreshCadence` (source-health.ts). A cadence of
 * "unknown"/"irregular" can only ever resolve to "historical" — never to
 * "live_current" or "stale", both of which require a stated cadence to
 * compare against. This is intentional: inventing a cadence the publisher
 * never committed to would be exactly the fabrication failure mode E68
 * exists to prevent.
 */
import type { CRERefreshCadence } from "./source-health";
import type { CREPresentationFreshness } from "./observation-lifecycle";

/**
 * Multiplier bands, expressed in units of the cadence's OWN period, not in
 * absolute days. E.g. for "monthly" cadence, "recent" means within roughly
 * 1x the monthly period past due, "stale" means more than 3x. The bands
 * themselves are a presentation policy (not a claim about the source), and
 * are documented as such in the Phase 8 doc.
 */
const CADENCE_PERIOD_DAYS: Partial<Record<CRERefreshCadence, number>> = {
  realtime: 1,
  daily: 1,
  weekly: 7,
  monthly: 31,
  quarterly: 93,
  semiannual: 183,
  annual: 366,
};

export interface FreshnessAssessment {
  presentation: CREPresentationFreshness;
  /** Whole days between `asOf` and the observation's own retrieval date, when computable. */
  daysSinceRetrieval?: number;
  /** True when the source's cadence implies an update should have happened by `asOf` but the
   * most recent successful retrieval predates it — i.e. the source may have failed to publish. */
  missedExpectedRefresh: boolean;
  reason: string;
}

/**
 * Part 6/7/16 — classify freshness for presentation purposes. This NEVER
 * mutates or invalidates the observation; it only informs how a consumer
 * should label it (Part 16: live/current, recent, historical, stale,
 * unavailable). "stale" is a presentation label, never a validity claim.
 */
export function assessFreshness(input: {
  retrievedAt: string;
  cadence: CRERefreshCadence;
  /** Most recent successful retrieval for this source overall (may differ from `retrievedAt` of one observation). */
  lastSuccessfulRetrievalAt?: string;
  asOf: string;
  /** True if the source is currently known unreachable/unusable (source-health.ts). */
  sourceUnavailable?: boolean;
}): FreshnessAssessment {
  if (input.sourceUnavailable) {
    return {
      presentation: "unavailable",
      missedExpectedRefresh: true,
      reason: "Source is currently unavailable; the last known observation is preserved but must not be presented as live/current.",
    };
  }

  const retrieved = Date.parse(input.retrievedAt);
  const asOf = Date.parse(input.asOf);
  if (Number.isNaN(retrieved) || Number.isNaN(asOf)) {
    return { presentation: "historical", missedExpectedRefresh: false, reason: "Unparseable date; defaulting to historical (never fabricating recency)." };
  }
  const daysSinceRetrieval = Math.max(0, Math.round((asOf - retrieved) / 86_400_000));

  const periodDays = CADENCE_PERIOD_DAYS[input.cadence];
  if (periodDays === undefined) {
    // "unknown" / "irregular": no cadence to compare against. Never claim live/current or stale.
    return {
      presentation: "historical",
      daysSinceRetrieval,
      missedExpectedRefresh: false,
      reason: `Source cadence is "${input.cadence}"; no stated refresh interval exists to assess freshness against, so this observation is presented as historical rather than guessed at.`,
    };
  }

  const lastSuccess = input.lastSuccessfulRetrievalAt ? Date.parse(input.lastSuccessfulRetrievalAt) : retrieved;
  const daysSinceLastSuccess = Number.isNaN(lastSuccess) ? daysSinceRetrieval : Math.max(0, Math.round((asOf - lastSuccess) / 86_400_000));
  const missedExpectedRefresh = daysSinceLastSuccess > periodDays * 1.5;

  let presentation: CREPresentationFreshness;
  let reason: string;
  if (daysSinceRetrieval <= periodDays) {
    presentation = "live_current";
    reason = `Retrieved within one ${input.cadence} period (${daysSinceRetrieval}d <= ${periodDays}d).`;
  } else if (daysSinceRetrieval <= periodDays * 3) {
    presentation = "recent";
    reason = `Retrieved within three ${input.cadence} periods (${daysSinceRetrieval}d <= ${periodDays * 3}d).`;
  } else if (daysSinceRetrieval <= periodDays * 8) {
    presentation = "stale";
    reason = `More than three but no more than eight ${input.cadence} periods old (${daysSinceRetrieval}d). Historical value preserved; not current for current-market use.`;
  } else {
    presentation = "historical";
    reason = `More than eight ${input.cadence} periods old (${daysSinceRetrieval}d). Treated as pure historical record.`;
  }

  return { presentation, daysSinceRetrieval, missedExpectedRefresh, reason };
}

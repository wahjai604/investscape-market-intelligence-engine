/**
 * InvestScape™ E85 Phase 3 — Zoning & Land-Use Rules Engine: source
 * readiness / licensing type scaffolding.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Mirrors E88's five-axis separation of concerns IN SPIRIT ONLY
 * (src/construction-cost-engine/source-adapter-types.ts) — independently
 * re-typed here for E85's own domain, with no import from
 * construction-cost-engine (Phase 2 correction 13/14). TYPE-LEVEL CONTRACT
 * ONLY: no adapter implementation, no real production source is
 * registered here, no network code.
 *
 * Five distinct concerns, kept separate exactly as E88 keeps them separate:
 *   1. registration     — "we know this source exists"
 *   2. access readiness  — "can E85 actually reach/read it right now"
 *   3. licensing/redistribution — "what are we allowed to do with what we read"
 *   4. adapter readiness — "do we have code that can translate it into E85's shape" (type-only reference here; no code)
 *   5. analytical readiness — "can it actually be used to resolve a rule today"
 */

/**
 * CAN E85 OBTAIN AND READ THE SOURCE? Nothing more. A document being reachable
 * and readable is a fact about retrieval, and it answers no question at all
 * about what may then be done with what was read — see `E85SourceLicenseStatus`
 * below, which is a separate axis for exactly that reason.
 */
export type E85SourceAccessStatus = "AVAILABLE" | "REGISTERED" | "LICENSE_REQUIRED" | "ACCESS_NOT_VERIFIED" | "DEFERRED" | "UNAVAILABLE";

/**
 * WHAT MAY E85 REPRODUCE, PACKAGE, EXPOSE OR REDISTRIBUTE from the source?
 *
 * PHASE 5A: this axis records established RIGHTS, never inferred ones, and it
 * is never derived from access. "The public can read it" and "we may republish
 * it" are different propositions, and the first is not evidence for the second:
 * a municipal by-law is published so people can comply with it, which implies
 * nothing about redistribution licensing. A source whose document carries no
 * copyright notice, licence grant, open-data designation or terms-of-use
 * statement has UNSTATED terms, and the honest record of an unstated right is
 * `LICENSE_UNKNOWN` — not `PUBLIC_REUSE`, which asserts a grant nobody made.
 *
 *   PUBLIC_REUSE               — reuse/redistribution is affirmatively granted
 *                                (an explicit open licence or equivalent).
 *                                Requires positive evidence of the grant.
 *   INTERNAL_LICENSE_REQUIRED  — a licence exists or is obtainable for internal
 *                                analytical use; redistribution is not implied.
 *   REDISTRIBUTION_RESTRICTED  — redistribution is affirmatively restricted.
 *                                Requires positive evidence of the restriction.
 *   LICENSE_UNKNOWN            — terms are not established. The correct value
 *                                whenever the source is simply silent.
 */
export type E85SourceLicenseStatus = "PUBLIC_REUSE" | "INTERNAL_LICENSE_REQUIRED" | "REDISTRIBUTION_RESTRICTED" | "LICENSE_UNKNOWN";

export type E85SourceAdapterReadiness = "NOT_BUILT" | "PLANNED" | "BUILT_UNVERIFIED" | "BUILT_VERIFIED";

/** DERIVED, never asserted independently — computed deterministically from access + license, mirroring E88's `computeAnalyticalReadiness` philosophy so it can never drift out of sync with the facts that justify it. */
export type E85SourceAnalyticalReadiness = "READY" | "BLOCKED_BY_ACCESS" | "BLOCKED_BY_LICENSE" | "BLOCKED_BY_ADAPTER";

export interface E85SourceReadiness {
  sourceId: string;
  displayName: string;
  registered: true;
  accessStatus: E85SourceAccessStatus;
  licenseStatus: E85SourceLicenseStatus;
  adapterReadiness: E85SourceAdapterReadiness;
}

/**
 * Pure, deterministic derivation — analytical readiness is never set directly
 * on a source record; it is always computed from the other three axes.
 *
 * Each axis is consulted on its own terms and none upgrades another: an
 * AVAILABLE access status contributes nothing toward clearing the licence
 * check, so proving E85 can read a document can never make it look cleared to
 * republish. This tier is a REPORT about rights and coverage, not a gate on
 * normalization — an adapter still normalizes a licence-unknown source in full,
 * with complete provenance, and the limitation travels on the bundle's
 * readiness for the caller to act on.
 */
export function computeE85AnalyticalReadiness(source: Pick<E85SourceReadiness, "accessStatus" | "licenseStatus" | "adapterReadiness">): E85SourceAnalyticalReadiness {
  if (source.accessStatus !== "AVAILABLE") return "BLOCKED_BY_ACCESS";
  if (source.licenseStatus !== "PUBLIC_REUSE" && source.licenseStatus !== "INTERNAL_LICENSE_REQUIRED") return "BLOCKED_BY_LICENSE";
  if (source.adapterReadiness !== "BUILT_VERIFIED") return "BLOCKED_BY_ADAPTER";
  return "READY";
}

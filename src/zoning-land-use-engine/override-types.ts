/**
 * InvestScape™ E85 Phase 3 — Zoning & Land-Use Rules Engine: user override
 * contract.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Non-destructive layering (Phase 2 correction 11): an override always
 * preserves the underlying source-derived value/result alongside the
 * override value — never mutates or discards it. Engine-level/in-memory
 * contract only; no persistence is implemented here.
 */

/**
 * Wraps a source-derived value of type `T` together with an optional
 * override. `sourceDerived` is never mutated when `override` is set —
 * both coexist so a caller/reviewer can always see what the evidence said
 * and what a human overrode it to.
 */
export interface E85Override<T> {
  sourceDerived: T;
  override?: E85OverrideRecord<T>;
}

export interface E85OverrideRecord<T> {
  overrideValue: T;
  /** Why the override was made — required, never optional, since an unexplained override is indistinguishable from an error. */
  reason: string;
  overriddenAt: string;
  /** Identity of the person/system making the override, when known (e.g. an email or user ID string) — not validated/parsed by this contract. */
  overriddenBy?: string;
  /** Optional reference to supporting provenance/consultant material justifying the override (e.g. a legal opinion, a municipal pre-application letter), kept as a free-text reference rather than a full provenance record since override justification is not itself a regulatory-evidence claim. */
  supportingReference?: string;
}

/** Returns the effective value to use: the override value if present, otherwise the source-derived value. Pure helper; does not mutate its input. */
export function effectiveValue<T>(o: E85Override<T>): T {
  return o.override ? o.override.overrideValue : o.sourceDerived;
}

/**
 * InvestScape™ E85 Phase 3 — Zoning & Land-Use Rules Engine: regulatory
 * envelope & binding-constraint contracts.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * REGULATORY envelope only — never architectural massing (Phase 2
 * correction 1). This type must NOT expose generic architectural fields
 * like netBuildableArea, netSellableArea, netRentableArea, floorplate
 * efficiency, or unit-layout efficiency. If a jurisdiction has an explicit
 * regulatory "net floor area" definition (i.e. the by-law itself defines
 * what counts/doesn't count toward floor area for FSR purposes), that may
 * be represented via `regulatoryNetFloorAreaSqm`, but only with its own
 * provenance and only as the source's OWN defined concept — never as a
 * stand-in for an architectural efficiency estimate.
 */
import type { E85Evidence } from "./evidence-types";
import type { E85DataGap } from "./data-gap-types";

/**
 * Every numeric field here is optional/nullable, and MUST be paired with a
 * corresponding `E85DataGap` entry in the enclosing result's `gaps` array
 * whenever it is absent because evidence is missing — never defaulted to
 * 0, unlimited, or any other fabricated value (Phase 2 correction 10, hard
 * invariant carried through to the envelope specifically).
 */
export interface E85RegulatoryEnvelope {
  jurisdictionId: string;
  zoneDesignation: string;
  /** Maximum regulatory gross floor area in square metres, as derivable from maxFsr x site area or as directly stated by the source. Never architectural GFA — always the bylaw-defined regulatory figure. */
  maxRegulatoryGfaSqm?: E85Evidence<number>;
  /** The source's OWN explicit regulatory "net floor area" concept, if and only if the source itself defines one for FSR/exclusion purposes. Absent for jurisdictions with no such defined concept — never synthesized from architectural assumptions. */
  regulatoryNetFloorAreaSqm?: E85Evidence<number>;
  maxHeightMetres?: E85Evidence<number>;
  maxStoreys?: E85Evidence<number>;
  maxSiteCoverageFraction?: E85Evidence<number>;
  setbacksMetres?: Readonly<Record<string, E85Evidence<number>>>;
}

/**
 * Identifies which specific rule(s) actually limit the envelope for this
 * parcel/request — e.g. "height is the binding constraint, not FSR,
 * because the FSR-derived envelope exceeds what height/storeys allow."
 * This is a structural pointer to which evidence governed, not a
 * computed massing recommendation.
 */
export interface E85BindingConstraint {
  /** Which envelope field this constraint binds, e.g. "maxHeightMetres". */
  constrainedField: keyof E85RegulatoryEnvelope;
  /** The evidence that establishes this as the binding constraint. */
  evidence: E85Evidence<number>;
  /** Free-text note on why this is binding relative to other rules considered, when non-obvious. */
  note?: string;
}

/** Bundled envelope + binding constraints + any gaps affecting the envelope specifically, kept separate from the top-level result's own gap list so an envelope can be embedded in other contexts without losing its own gap accounting. */
export interface E85RegulatoryEnvelopeResult {
  envelope: E85RegulatoryEnvelope;
  bindingConstraints: readonly E85BindingConstraint[];
  envelopeGaps: readonly E85DataGap[];
}

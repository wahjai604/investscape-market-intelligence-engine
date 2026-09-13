/**
 * InvestScape™ E85 Phase 4 — Rule Normalization & Deterministic Evaluation:
 * qualification derivation.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * PHASE 4 IMPLEMENTATION NOTE (documented explicitly, since this is not
 * spelled out by the frozen Phase 3 contracts): `E85Evidence<T>` carries no
 * qualification field of its own — only `provenance` and `temporal`.
 * `E85Qualification`'s three axes (evidenceQuality, ruleApplicability,
 * parcelMatch) must therefore be DERIVED, deterministically and generically
 * (never Vancouver-specific, never a numeric probability), from what the
 * evidence/request actually contain. This file is that derivation policy.
 * It is intentionally conservative and simple; a future phase may replace it
 * with something more refined without changing any Phase 3 or evaluator
 * contract, since callers only ever see the resulting `E85Qualification`.
 *
 * - evidenceQuality: how precisely the provenance pinpoints its source.
 *     "high"     — a document locator with a section/clause/schedule/table,
 *                   or a GIS locator with a feature id (a human/machine
 *                   could go find the exact passage/feature again).
 *     "moderate" — a document or GIS locator present but without a precise
 *                   pinpoint (e.g. only a bylawOrDocumentId or dataset id).
 *     "low"      — only a bare `sourceId`, no locator at all.
 * - ruleApplicability: how directly the matched rule applies to what was
 *     asked, independent of source quality.
 *     "high"     — exact jurisdiction+zone(+use) match, unconditional.
 *     "moderate" — exact match but the value is conditional/not yet
 *                   affirmed by caller context.
 * - parcelMatch: how confidently the PARCEL itself is tied to the
 *     jurisdiction/zone the evidence is drawn from.
 *     "high"     — parcel carries its own `jurisdiction.jurisdictionId`
 *                   equal to the request's, and (when the parcel states a
 *                   raw zoning designation) it equals the requested zone.
 *     "moderate" — parcel carries a matching jurisdiction but states no raw
 *                   zoning designation to cross-check against the request's
 *                   zone (nothing to contradict, but nothing confirming it
 *                   independently either).
 *     "low"      — the parcel carries no jurisdiction of its own at all, so
 *                   the jurisdiction/zone used for matching came entirely
 *                   from the request, with nothing on the parcel record
 *                   itself to corroborate it.
 */
import type { E85Provenance, E85DocumentLocator, E85GisLocator } from "./provenance-types";
import type { E85ParcelReference } from "./jurisdiction-types";
import type { E85QualificationTier } from "./qualification-types";

function hasPrecisePinpoint(loc: E85DocumentLocator | undefined): boolean {
  if (!loc) return false;
  return Boolean(loc.section || loc.clause || loc.schedule || loc.table || loc.row);
}

function hasPreciseGis(loc: E85GisLocator | undefined): boolean {
  if (!loc) return false;
  return Boolean(loc.gisFeatureId);
}

export function deriveEvidenceQuality(provenance: E85Provenance): E85QualificationTier {
  if (hasPrecisePinpoint(provenance.documentLocator) || hasPreciseGis(provenance.gisLocator)) return "high";
  if (provenance.documentLocator || provenance.gisLocator) return "moderate";
  return "low";
}

export function deriveRuleApplicability(isConditionalOrUnaffirmed: boolean): E85QualificationTier {
  return isConditionalOrUnaffirmed ? "moderate" : "high";
}

export function deriveParcelMatch(parcel: E85ParcelReference, jurisdictionId: string, zoneDesignation: string): E85QualificationTier {
  const parcelJurisdictionId = parcel.jurisdiction?.jurisdictionId;
  if (!parcelJurisdictionId) return "low";
  if (parcelJurisdictionId !== jurisdictionId) return "low";
  if (parcel.rawZoningDesignation && parcel.rawZoningDesignation !== zoneDesignation) return "low";
  if (parcel.rawZoningDesignation === zoneDesignation) return "high";
  return "moderate";
}

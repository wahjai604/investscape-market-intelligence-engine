/**
 * InvestScape™ E85 Phase 6 — Multi-Source Rule-Pack Composition: rule/concept
 * identity.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Composition's first and most consequential question is "do these two rules
 * regulate the SAME THING?" Get it too coarse and a base pack's height rule
 * collides with an overlay's setback rule purely because both are DIMENSIONAL.
 * Get it too fine and two genuinely contradictory height limits both survive.
 * Neither failure is recoverable downstream, so identity is settled here, once,
 * at the level of the individual REGULATED CONCEPT rather than the rule family.
 *
 * A concept key names one regulated quantity: "DIMENSIONAL:maxHeightMetres",
 * "DIMENSIONAL:setbacksMetres[front]", "DENSITY:maxFsr",
 * "USE:permission[one_family_dwelling]". Height and storeys are different
 * concepts. A front yard and a rear yard are different concepts. Two packs
 * stating maxHeightMetres are the same concept and must be reconciled.
 *
 * This module decomposes `E85RuleRecord`s into atomic, concept-keyed
 * contributions and reassembles chosen contributions back into ordinary
 * `E85RuleRecord`s. The round trip is faithful: whatever Phase 4 could read
 * from the input rules, it can read from the output rules, and it never learns
 * that composition happened.
 *
 * Nothing here is jurisdiction-aware. Concept keys are built from the generic
 * Phase 3 rule-family field names plus the source's own key strings (yard
 * names, use codes, parking/amenity keys), which are data, not vocabulary
 * compiled into E85.
 */
import type {
  E85RuleRecord,
  E85RuleFamily,
  E85UseRule,
  E85DensityRule,
  E85DimensionalRule,
  E85ParkingRule,
  E85AmenityRule,
  E85OverlayRule,
} from "./rule-family-types";
import type { E85Evidence } from "./evidence-types";
import type { E85UsePermission } from "./use-taxonomy";

/**
 * Stable identity of one regulated concept, e.g. "DENSITY:maxFsr". Opaque to
 * callers: build it with `buildE85ConceptKey`, never by string concatenation at
 * a call site, so the format stays changeable in one place.
 */
export type E85RuleConceptKey = string;

/** Builds a concept key from its family, field, and optional source-supplied sub-key (yard name, use code, parking/amenity key). */
export function buildE85ConceptKey(family: E85RuleFamily, field: string, subKey?: string): E85RuleConceptKey {
  return subKey === undefined ? `${family}:${field}` : `${family}:${field}[${subKey}]`;
}

/** The family a concept key belongs to, for family-scoped precedence and requested-analysis materiality. */
export function conceptKeyFamily(key: E85RuleConceptKey): E85RuleFamily {
  return key.slice(0, key.indexOf(":")) as E85RuleFamily;
}

/**
 * One atomic, concept-keyed value taken from one rule record in one pack.
 *
 * `carriedCondition` preserves the condition text that a conditional density
 * bonus or a conditional amenity requirement is gated on. It travels with the
 * contribution so reassembly can rebuild the gate exactly, and it is NEVER
 * treated as satisfied here — those two rule-family fields are Phase 4's own
 * condition mechanism, and composition must hand them back untouched.
 */
export interface E85RuleConceptContribution {
  conceptKey: E85RuleConceptKey;
  family: E85RuleFamily;
  /** Rule-family field this came from, e.g. "maxHeightMetres", "setbacksMetres". */
  field: string;
  /** Source-supplied sub-key, e.g. a yard name or use code. Undefined for scalar fields. */
  subKey?: string;
  /** Id of the rule pack that contributed this value. */
  packId: string;
  jurisdictionId: string;
  zoneDesignation: string;
  /** The evidence exactly as it appeared on the source rule — never re-wrapped or re-stamped. */
  evidence: E85Evidence<unknown>;
  /** Condition gating a conditionalBonus / conditional amenity requirement, preserved verbatim. */
  carriedCondition?: string;
}

/** An overlay declared by a pack. Overlays are identified by designation; two packs naming different overlays are not in conflict, they are two overlays. */
export interface E85OverlayDeclaration {
  packId: string;
  jurisdictionId: string;
  zoneDesignation: string;
  overlayDesignation: string;
}

export interface E85RuleDecomposition {
  contributions: readonly E85RuleConceptContribution[];
  overlays: readonly E85OverlayDeclaration[];
}

function pushScalar(
  out: E85RuleConceptContribution[],
  rule: { jurisdictionId: string; zoneDesignation: string },
  packId: string,
  family: E85RuleFamily,
  field: string,
  evidence: E85Evidence<unknown> | undefined,
  carriedCondition?: string,
  subKey?: string,
): void {
  if (evidence === undefined) return;
  out.push({
    conceptKey: buildE85ConceptKey(family, field, subKey),
    family,
    field,
    ...(subKey !== undefined ? { subKey } : {}),
    packId,
    jurisdictionId: rule.jurisdictionId,
    zoneDesignation: rule.zoneDesignation,
    evidence,
    ...(carriedCondition !== undefined ? { carriedCondition } : {}),
  });
}

/**
 * Breaks one rule record into its atomic regulated concepts.
 *
 * Every field that can independently conflict gets its own key; every keyed map
 * (setbacks, parking, amenity requirements, use permissions) is decomposed per
 * key, because a front-yard rule and a rear-yard rule are as unrelated as a
 * height rule and an FSR rule.
 */
export function decomposeE85Rule(rule: E85RuleRecord, packId: string): E85RuleDecomposition {
  const contributions: E85RuleConceptContribution[] = [];
  const overlays: E85OverlayDeclaration[] = [];

  switch (rule.family) {
    case "USE": {
      const r = rule as E85UseRule;
      for (const permission of r.permissions) {
        // Keyed by use code: two packs speaking about different uses are not in
        // conflict, however many permissions each states.
        pushScalar(contributions, r, packId, "USE", "permission", permission as E85Evidence<E85UsePermission>, undefined, permission.value.useCode);
      }
      break;
    }
    case "DENSITY": {
      const r = rule as E85DensityRule;
      pushScalar(contributions, r, packId, "DENSITY", "maxFsr", r.maxFsr);
      pushScalar(contributions, r, packId, "DENSITY", "maxDensityUnitsPerArea", r.maxDensityUnitsPerArea);
      pushScalar(contributions, r, packId, "DENSITY", "explicitMaxGfaSqm", r.explicitMaxGfaSqm);
      if (r.conditionalBonus) {
        // The condition is part of the concept key: a bonus available under one
        // condition is a different regulated thing from a bonus available under
        // another, and collapsing them would silently merge two offers.
        const { condition, additionalFsr, additionalGfaSqm } = r.conditionalBonus;
        pushScalar(contributions, r, packId, "DENSITY", "conditionalBonus.additionalFsr", additionalFsr, condition, condition);
        pushScalar(contributions, r, packId, "DENSITY", "conditionalBonus.additionalGfaSqm", additionalGfaSqm, condition, condition);
      }
      break;
    }
    case "DIMENSIONAL": {
      const r = rule as E85DimensionalRule;
      pushScalar(contributions, r, packId, "DIMENSIONAL", "maxHeightMetres", r.maxHeightMetres);
      pushScalar(contributions, r, packId, "DIMENSIONAL", "maxStoreys", r.maxStoreys);
      pushScalar(contributions, r, packId, "DIMENSIONAL", "maxSiteCoverageFraction", r.maxSiteCoverageFraction);
      pushScalar(contributions, r, packId, "DIMENSIONAL", "minFrontageMetres", r.minFrontageMetres);
      for (const [yard, evidence] of Object.entries(r.setbacksMetres ?? {})) {
        pushScalar(contributions, r, packId, "DIMENSIONAL", "setbacksMetres", evidence, undefined, yard);
      }
      break;
    }
    case "PARKING": {
      const r = rule as E85ParkingRule;
      for (const [key, evidence] of Object.entries(r.minSpacesPerUse ?? {})) {
        pushScalar(contributions, r, packId, "PARKING", "minSpacesPerUse", evidence, undefined, key);
      }
      for (const [key, evidence] of Object.entries(r.maxSpacesPerUse ?? {})) {
        pushScalar(contributions, r, packId, "PARKING", "maxSpacesPerUse", evidence, undefined, key);
      }
      break;
    }
    case "AMENITY": {
      const r = rule as E85AmenityRule;
      for (const [key, evidence] of Object.entries(r.requirements ?? {})) {
        pushScalar(contributions, r, packId, "AMENITY", "requirements", evidence, r.requirementConditions?.[key], key);
      }
      break;
    }
    case "OVERLAY": {
      const r = rule as E85OverlayRule;
      overlays.push({ packId, jurisdictionId: r.jurisdictionId, zoneDesignation: r.zoneDesignation, overlayDesignation: r.overlayDesignation });
      pushScalar(contributions, r, packId, "OVERLAY", "description", r.description, undefined, r.overlayDesignation);
      break;
    }
  }

  return { contributions, overlays };
}

/** Decomposes many rules from one pack, preserving nothing of input array order (callers canonicalize by concept key afterward). */
export function decomposeE85Rules(rules: readonly E85RuleRecord[], packId: string): E85RuleDecomposition {
  const contributions: E85RuleConceptContribution[] = [];
  const overlays: E85OverlayDeclaration[] = [];
  for (const rule of rules) {
    const d = decomposeE85Rule(rule, packId);
    contributions.push(...d.contributions);
    overlays.push(...d.overlays);
  }
  return { contributions, overlays };
}

function sortedEntries<T>(record: Record<string, T>): [string, T][] {
  return Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Rebuilds ordinary `E85RuleRecord`s from chosen contributions, so Phase 4
 * consumes a plain rule array and cannot tell composition ran.
 *
 * Output is canonically ordered — families in a fixed order, keyed maps sorted
 * by key — so two permutations of the same input produce byte-identical rules.
 * Contributions are grouped by jurisdiction+zone, which composition has already
 * verified is a single pair.
 */
export function reassembleE85Rules(contributions: readonly E85RuleConceptContribution[], overlays: readonly E85OverlayDeclaration[]): E85RuleRecord[] {
  if (contributions.length === 0 && overlays.length === 0) return [];

  const anchor = contributions[0] ?? overlays[0];
  const base = { jurisdictionId: anchor.jurisdictionId, zoneDesignation: anchor.zoneDesignation };
  const rules: E85RuleRecord[] = [];

  const byField = (field: string): E85RuleConceptContribution[] => contributions.filter((c) => c.field === field);
  const scalar = (field: string): E85Evidence<never> | undefined => byField(field)[0]?.evidence as E85Evidence<never> | undefined;
  const keyedMap = (field: string): Record<string, E85Evidence<never>> => {
    const out: Record<string, E85Evidence<never>> = {};
    for (const c of byField(field)) out[c.subKey!] = c.evidence as E85Evidence<never>;
    return Object.fromEntries(sortedEntries(out));
  };

  // --- USE ---
  const permissions = byField("permission").sort((a, b) => (a.subKey! < b.subKey! ? -1 : a.subKey! > b.subKey! ? 1 : 0));
  if (permissions.length > 0) {
    const useRule: E85UseRule = { ...base, family: "USE", permissions: permissions.map((c) => c.evidence as E85Evidence<E85UsePermission>) };
    rules.push(useRule);
  }

  // --- DENSITY ---
  const bonusFsr = byField("conditionalBonus.additionalFsr")[0];
  const bonusGfa = byField("conditionalBonus.additionalGfaSqm")[0];
  const maxFsr = scalar("maxFsr");
  const maxDensity = scalar("maxDensityUnitsPerArea");
  const explicitGfa = scalar("explicitMaxGfaSqm");
  if (maxFsr || maxDensity || explicitGfa || bonusFsr || bonusGfa) {
    const bonusCondition = bonusFsr?.carriedCondition ?? bonusGfa?.carriedCondition;
    const densityRule: E85DensityRule = {
      ...base,
      family: "DENSITY",
      ...(maxFsr ? { maxFsr: maxFsr as E85Evidence<number> } : {}),
      ...(maxDensity ? { maxDensityUnitsPerArea: maxDensity as E85Evidence<number> } : {}),
      ...(explicitGfa ? { explicitMaxGfaSqm: explicitGfa as E85Evidence<number> } : {}),
      ...(bonusCondition !== undefined
        ? {
            conditionalBonus: {
              condition: bonusCondition,
              ...(bonusFsr ? { additionalFsr: bonusFsr.evidence as E85Evidence<number> } : {}),
              ...(bonusGfa ? { additionalGfaSqm: bonusGfa.evidence as E85Evidence<number> } : {}),
            },
          }
        : {}),
    };
    rules.push(densityRule);
  }

  // --- DIMENSIONAL ---
  const height = scalar("maxHeightMetres");
  const storeys = scalar("maxStoreys");
  const coverage = scalar("maxSiteCoverageFraction");
  const frontage = scalar("minFrontageMetres");
  const setbacks = keyedMap("setbacksMetres");
  if (height || storeys || coverage || frontage || Object.keys(setbacks).length > 0) {
    const dimensionalRule: E85DimensionalRule = {
      ...base,
      family: "DIMENSIONAL",
      ...(height ? { maxHeightMetres: height as E85Evidence<number> } : {}),
      ...(storeys ? { maxStoreys: storeys as E85Evidence<number> } : {}),
      ...(coverage ? { maxSiteCoverageFraction: coverage as E85Evidence<number> } : {}),
      ...(frontage ? { minFrontageMetres: frontage as E85Evidence<number> } : {}),
      ...(Object.keys(setbacks).length > 0 ? { setbacksMetres: setbacks as Record<string, E85Evidence<number>> } : {}),
    };
    rules.push(dimensionalRule);
  }

  // --- PARKING ---
  const minSpaces = keyedMap("minSpacesPerUse");
  const maxSpaces = keyedMap("maxSpacesPerUse");
  if (Object.keys(minSpaces).length > 0 || Object.keys(maxSpaces).length > 0) {
    const parkingRule: E85ParkingRule = {
      ...base,
      family: "PARKING",
      ...(Object.keys(minSpaces).length > 0 ? { minSpacesPerUse: minSpaces as Record<string, E85Evidence<number>> } : {}),
      ...(Object.keys(maxSpaces).length > 0 ? { maxSpacesPerUse: maxSpaces as Record<string, E85Evidence<number>> } : {}),
    };
    rules.push(parkingRule);
  }

  // --- AMENITY ---
  const amenityContributions = byField("requirements");
  if (amenityContributions.length > 0) {
    const requirements = keyedMap("requirements");
    const requirementConditions: Record<string, string> = {};
    for (const c of amenityContributions) {
      if (c.carriedCondition !== undefined) requirementConditions[c.subKey!] = c.carriedCondition;
    }
    const amenityRule: E85AmenityRule = {
      ...base,
      family: "AMENITY",
      requirements: requirements as Record<string, E85Evidence<string>>,
      ...(Object.keys(requirementConditions).length > 0 ? { requirementConditions: Object.fromEntries(sortedEntries(requirementConditions)) } : {}),
    };
    rules.push(amenityRule);
  }

  // --- OVERLAY: one rule per distinct designation, in designation order ---
  const descriptions = new Map<string, E85Evidence<string>>();
  for (const c of byField("description")) descriptions.set(c.subKey!, c.evidence as E85Evidence<string>);
  const designations = [...new Set(overlays.map((o) => o.overlayDesignation))].sort();
  for (const designation of designations) {
    const description = descriptions.get(designation);
    const overlayRule: E85OverlayRule = { ...base, family: "OVERLAY", overlayDesignation: designation, ...(description ? { description } : {}) };
    rules.push(overlayRule);
  }

  return rules;
}

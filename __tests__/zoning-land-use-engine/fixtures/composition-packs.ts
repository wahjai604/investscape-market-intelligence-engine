/**
 * InvestScape™ E85 Phase 6 — synthetic rule packs for composition tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Entirely invented jurisdictions and instruments. Nothing here describes a
 * real municipality, and nothing reads a file, a network, or a PDF. The point
 * of using an invented place is that it proves composition is not quietly
 * shaped around the one real adapter E85 happens to ship.
 *
 * Not a test file (jest matches `*.test.ts` only); imported by the Phase 6
 * suites.
 */
import type { E85RulePack, E85PrecedenceRelation, E85RuleRecord, E85Evidence, E85ConditionalRuleRecord, E85CompositionRole, E85RuleFamily } from "../../../src/zoning-land-use-engine";

export const JURISDICTION = "xx-yy-testburgh";
export const ZONE = "TB-1";
export const COMPOSED_AT = "2026-09-01T00:00:00.000Z";

/** A full ISO effective date, so temporal semantics are settled unless a test deliberately unsettles them. */
export const KNOWN_EFFECTIVE_FROM = "2024-01-01";

/**
 * `effectiveFrom` takes the literal "UNKNOWN" rather than `undefined` to select
 * an unestablished date. Passing `undefined` to an optional parameter silently
 * selects its DEFAULT, so an `undefined` sentinel here would quietly produce a
 * dated window and make every temporal test pass for the wrong reason.
 */
export function evidence<T>(value: T, sourceId: string, section: string, effectiveFrom: string = KNOWN_EFFECTIVE_FROM): E85Evidence<T> {
  return {
    value,
    provenance: { sourceId, sourceVersionId: `${sourceId}-v1`, adapterId: `${sourceId}.adapter`, adapterVersion: "1.0.0", documentLocator: { section } },
    temporal: effectiveFrom === "UNKNOWN" ? { effectiveDateBasis: "UNKNOWN" } : { effectiveFrom, effectiveDateBasis: "SOURCE_STATED" },
  };
}

export interface PackSpec {
  packId: string;
  role: E85CompositionRole;
  sourceId?: string;
  maxFsr?: number;
  maxHeightMetres?: number;
  maxStoreys?: number;
  frontSetback?: number;
  rearSetback?: number;
  minParkingPerDwelling?: number;
  usePermitted?: string;
  overlayDesignation?: string;
  /** Applies an unknown effective date to every value in the pack. */
  temporalUnknown?: boolean;
  conditionalRules?: readonly E85ConditionalRuleRecord[];
  readinessBlockers?: readonly string[];
  qualification?: E85RulePack["qualification"];
  /** Declared family support. Defaults to exactly the families this spec produces rules for — a reasonable stand-in for an adapter identity in a synthetic fixture. Override to test declared-but-not-fired coverage. */
  supportedRuleFamilies?: readonly E85RuleFamily[];
}

/** Builds a rule pack from a terse spec, so each test states only what it varies. */
export function pack(spec: PackSpec): E85RulePack {
  const sourceId = spec.sourceId ?? `${JURISDICTION}:instrument-${spec.packId}`;
  const from = spec.temporalUnknown ? "UNKNOWN" : KNOWN_EFFECTIVE_FROM;
  const base = { jurisdictionId: JURISDICTION, zoneDesignation: ZONE };
  const rules: E85RuleRecord[] = [];

  if (spec.usePermitted !== undefined) {
    rules.push({
      ...base,
      family: "USE",
      permissions: [evidence({ useCode: spec.usePermitted, status: "PERMITTED" as const }, sourceId, "2.1", from)],
    });
  }
  if (spec.maxFsr !== undefined) {
    rules.push({ ...base, family: "DENSITY", maxFsr: evidence(spec.maxFsr, sourceId, "3.1", from) });
  }
  if (spec.maxHeightMetres !== undefined || spec.maxStoreys !== undefined || spec.frontSetback !== undefined || spec.rearSetback !== undefined) {
    const setbacks: Record<string, E85Evidence<number>> = {};
    if (spec.frontSetback !== undefined) setbacks.front = evidence(spec.frontSetback, sourceId, "4.1", from);
    if (spec.rearSetback !== undefined) setbacks.rear = evidence(spec.rearSetback, sourceId, "4.2", from);
    rules.push({
      ...base,
      family: "DIMENSIONAL",
      ...(spec.maxHeightMetres !== undefined ? { maxHeightMetres: evidence(spec.maxHeightMetres, sourceId, "4.3", from) } : {}),
      ...(spec.maxStoreys !== undefined ? { maxStoreys: evidence(spec.maxStoreys, sourceId, "4.4", from) } : {}),
      ...(Object.keys(setbacks).length > 0 ? { setbacksMetres: setbacks } : {}),
    });
  }
  if (spec.minParkingPerDwelling !== undefined) {
    rules.push({ ...base, family: "PARKING", minSpacesPerUse: { dwelling_unit: evidence(spec.minParkingPerDwelling, sourceId, "5.1", from) } });
  }
  if (spec.overlayDesignation !== undefined) {
    rules.push({ ...base, family: "OVERLAY", overlayDesignation: spec.overlayDesignation, description: evidence("applies additional review", sourceId, "6.1", from) });
  }

  return {
    packId: spec.packId,
    jurisdictionId: JURISDICTION,
    zoneDesignation: ZONE,
    sourceId,
    sourceVersionId: `${sourceId}-v1`,
    role: spec.role,
    supportedRuleFamilies: spec.supportedRuleFamilies ?? [...new Set(rules.map((r) => r.family))],
    rules,
    conditionalRules: spec.conditionalRules ?? [],
    temporal: from === "UNKNOWN" ? { effectiveDateBasis: "UNKNOWN" } : { effectiveFrom: from, effectiveDateBasis: "SOURCE_STATED" },
    adapterId: `${sourceId}.adapter`,
    adapterVersion: "1.0.0",
    qualification: spec.qualification ?? { evidenceQuality: "high", ruleApplicability: "high" },
    normalizedAt: COMPOSED_AT,
    ...(spec.readinessBlockers
      ? {
          readiness: {
            sourceId,
            registered: true,
            structureSupport: "STRUCTURED" as const,
            versionSupport: "REGISTERED" as const,
            zoneScope: "IN_SCOPE" as const,
            temporalApplicability: "APPLIES" as const,
            overall: "BLOCKED" as const,
            blockers: [...spec.readinessBlockers] as never,
            blockerDetails: spec.readinessBlockers.map((b) => `${b} limitation on ${sourceId}`),
          },
        }
      : {}),
  };
}

/** A conditional dimensional rule, used to prove conditions survive composition still gated. */
export function conditionalHeight(condition: string, metres: number, sourceId: string): E85ConditionalRuleRecord {
  return {
    condition,
    sourceFactId: `fact-${metres}`,
    rule: { jurisdictionId: JURISDICTION, zoneDesignation: ZONE, family: "DIMENSIONAL", maxHeightMetres: evidence(metres, sourceId, "4.3") },
  };
}

/** An explicit, provenance-carrying precedence relation. Every field a reviewer would ask about is populated. */
export function relation(overrides: Partial<E85PrecedenceRelation> & Pick<E85PrecedenceRelation, "relationId" | "subjectPackId" | "objectPackId" | "type">): E85PrecedenceRelation {
  return {
    provenance: {
      sourceId: `${JURISDICTION}:enabling-instrument`,
      documentLocator: { bylawOrDocumentId: "ENABLING-1", section: "12.4" },
      interpretationNote: "Synthetic enabling provision stating the relationship between the two instruments.",
    },
    ...overrides,
  };
}

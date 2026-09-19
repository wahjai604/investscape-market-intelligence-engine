/**
 * InvestScape™ E85 Phase 4 — Rule Normalization & Deterministic Evaluation:
 * the evaluator's public output wrapper.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * The frozen `E85Result` union (result-types.ts) has no dedicated field for
 * a resolved use-permission status, parking ratio, amenity requirement, or
 * overlay description — only the numeric `E85RegulatoryEnvelope` fields
 * (density/dimensional) have a home there. Per the Phase 4 task brief's
 * allowance for "an `E85Result` (or a working equivalent that assembles
 * into one)", `evaluateZoningAndLandUse` returns this `E85EvaluationOutcome`
 * wrapper: `result` IS a genuine `E85Result` (satisfying every Phase 3
 * structural invariant), and the sibling fields carry the resolved
 * non-envelope values for callers that need them, without inventing a new
 * top-level status field or duplicating result-status logic.
 */
import type { E85Result } from "./result-types";
import type { E85UsePermission } from "./use-taxonomy";
import type { E85Evidence } from "./evidence-types";
import type { E85RequirementOutcome } from "./regulatory-requirement-types";

export interface E85UsePermissionOutcome {
  useCode: string;
  status: E85UsePermission["status"];
  evidence?: E85Evidence<E85UsePermission>;
}

export interface E85KeyedNumericOutcome {
  key: string;
  value: number;
  evidence: E85Evidence<number>;
}

export interface E85OverlayOutcome {
  overlayDesignation: string;
  description?: string;
}

export interface E85EvaluationOutcome {
  /** The frozen, structurally-valid E85Result — always present. */
  result: E85Result;
  usePermission?: E85UsePermissionOutcome;
  resolvedMaxFsr?: { value: number; evidence: E85Evidence<number> };
  /**
   * Promoted the same way as `resolvedMaxFsr`: the RESOLVED DENSITY finding for
   * `maxDwellingUnits`, when one exists. `density-evaluation.ts` already
   * computes this finding in full (value + evidence); this field only exposes
   * it on the outcome so a caller does not have to reach into `findings`.
   */
  resolvedMaxDwellingUnits?: { value: number; evidence: E85Evidence<number> };
  explicitMaxGfaSqm?: { value: number; evidence: E85Evidence<number> };
  parking?: readonly E85KeyedNumericOutcome[];
  amenity?: readonly { key: string; value: string; evidence: E85Evidence<string> }[];
  overlays?: readonly E85OverlayOutcome[];
  /**
   * PHASE 12B.4 (optional, additive): the regulatory obligations this proposal
   * triggers, or whose triggering could not be decided. Present — possibly
   * empty — exactly when REQUIREMENT was requested. Obligations proven not to
   * apply are omitted. Quantities are the source's own figures, never applied to
   * any project figure.
   */
  requirements?: readonly E85RequirementOutcome[];
}

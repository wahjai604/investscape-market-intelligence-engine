/**
 * InvestScape™ E85 Phase 15.22B — Designation/Legal-Text Identity
 * Correspondence Evaluator, Slice 3H-1.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Additive only. This module answers exactly one question: "given (1) an
 * already-computed `E85DesignationApplicabilityResult` (Slice 3G-2,
 * designation-applicability.ts), (2) a caller-supplied legal-text-selection
 * identity bundle, and (3) a caller-supplied, generic atemporal linkage
 * identity, do all three identities correspond under exact-match rules?" It
 * is a pure, deterministic, jurisdiction-neutral evaluator — nothing more.
 *
 * SCOPE. This module does NOT: temporalize legal-linkage; prove the linkage
 * itself was ever legally valid at any date, including the request's own
 * AS_OF date; conclude that a parcel was historically zoned under the
 * selected legal text; conclude that legal-text validity and designation
 * validity are temporally aligned; authorize rule-pack application; produce
 * a final decision, package, materiality, blocker, completeness, or
 * terminal-status conclusion; assert that any real source (R1-1, C-2C, or
 * any other) is current law; or get wired into spatial applicability,
 * decision orchestration, rule-pack composition, or package assembly. All of
 * that is out of scope for this slice.
 *
 * JURISDICTION-NEUTRAL BY DESIGN. This module imports no jurisdiction-
 * specific linkage table (it does not import, and has never imported, any
 * City of Vancouver adapter module, or any Vancouver/R1-1/C-2C/
 * Feature-494642/Burnaby constant). The "linkage identity" it compares
 * against is supplied entirely by the caller as plain data — this module
 * never looks one up itself and never recreates that adapter's own lookup
 * logic. A caller wiring this evaluator to a real jurisdiction's linkage
 * table would pass that table's matched entry in as `linkageIdentity`; this
 * module has no opinion about where that entry came from.
 *
 * IDENTITY, NOT ALIGNMENT. Exact linkage is not temporal alignment. Even
 * when every supplied identity corresponds exactly, this module's positive
 * result explicitly states that the linkage's own temporal validity has NOT
 * been established — see `IDENTITY_CORRESPONDENCE_ESTABLISHED`'s `limitation`
 * field below, which is always present and always says so. No result kind
 * this module can produce implies more than identity correspondence.
 *
 * CALLER-SUPPLIED CONCLUSIONS ARE NEVER TRUSTED. This module recomputes
 * every identity comparison itself, field by field, using exact string
 * equality only (no case-folding, no fuzzy or prefix matching, no
 * normalization) — mirroring the same exact-match discipline the City of
 * Vancouver district-linkage adapter's own bundle classifier already uses,
 * generalized and reimplemented locally rather than imported (this module
 * has no dependency on that adapter at all). A caller cannot supply a
 * boolean "these correspond" conclusion and have it accepted; there is no
 * such field anywhere in this module's input types.
 *
 * No machine clock is read anywhere in this file. No file in this module is
 * mutated, and none of its inputs are mutated.
 */
import type { E85DesignationApplicabilityResult } from "./designation-applicability";

/**
 * The generic four-axis legal identity shape this module compares. Used both
 * for the caller's supplied legal-text-selection identity and for the
 * caller's supplied atemporal linkage identity — structurally identical
 * shapes, because a real jurisdiction's linkage-table entry and a real
 * legal-text bundle's own identity carry exactly these same four axes (this
 * shape was inspected against one real jurisdiction adapter's own
 * district-link-entry shape as evidence of field meaning, but that adapter
 * module is never imported here). Deliberately carries no date, no effective
 * interval, and no validity-state field of any kind — this shape cannot
 * express temporal validity even if a caller wanted it to.
 */
export interface E85LegalIdentity {
  readonly jurisdictionId: string;
  readonly sourceId: string;
  readonly sourceVersionId: string;
  readonly zoneDesignation: string;
}

/**
 * Whether a legal-text selection identity is available at all. `NOT_SELECTED`
 * covers every case where the upstream temporal-selection pipeline did not
 * reach a `SELECTED`/`AS_OF_SELECTED` outcome — this module never inspects
 * *why* selection did not occur (that reasoning belongs entirely to
 * `temporal-selection.ts`/`temporal-decision-impact.ts`), it only asks
 * whether an identity is available to compare.
 */
export type E85LegalTextIdentityInput = { readonly kind: "SELECTED"; readonly identity: E85LegalIdentity } | { readonly kind: "NOT_SELECTED" };

/**
 * The four-axis mismatch reasons this module can report, in the exact
 * priority order they are checked (jurisdiction first, then source, then
 * source version, then zone) — mirroring the same precedence one real
 * jurisdiction adapter's own bundle classifier already uses ("prefer a
 * jurisdiction+source match with the wrong version or zone over a bare 'not
 * registered' whenever a more informative reason is available"),
 * reimplemented locally.
 */
export type E85IdentityMismatchReason = "JURISDICTION_MISMATCH" | "SOURCE_MISMATCH" | "VERSION_MISMATCH" | "ZONE_MISMATCH";

/**
 * Closed, exhaustive result vocabulary. Every variant that carries an
 * identity carries it BY REFERENCE, unchanged, from the caller's own input —
 * this module never fabricates, renames, or normalizes an identity field.
 *
 *   - DESIGNATION_NOT_APPLICABLE_PASSTHROUGH: the supplied designation result
 *     was not one of the two positive-applicability kinds
 *     (`DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL` or
 *     `DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END`). Checked FIRST, before the
 *     legal-text identity is even inspected.
 *   - LEGAL_TEXT_NOT_SELECTED_PASSTHROUGH: the designation was applicable,
 *     but no legal-text identity was supplied (`kind: "NOT_SELECTED"`).
 *   - JURISDICTION_MISMATCH / SOURCE_MISMATCH / VERSION_MISMATCH /
 *     ZONE_MISMATCH: the designation was applicable, a legal-text identity
 *     was supplied, but the three identities (designation, legal-text,
 *     linkage) do not correspond on at least one axis — the single most
 *     fundamental mismatched axis is reported, never more than one at a
 *     time, mirroring `classifyBundle`'s "most specific reason" precedent.
 *   - IDENTITY_CORRESPONDENCE_ESTABLISHED: every compared axis matches
 *     exactly. `limitation` is always present and always states, in full,
 *     what this result does NOT prove.
 */
export type E85DesignationLegalTextCorrespondenceResult =
  | {
      readonly kind: "DESIGNATION_NOT_APPLICABLE_PASSTHROUGH";
      readonly designationResultKind: E85DesignationApplicabilityResult["kind"];
    }
  | {
      readonly kind: "LEGAL_TEXT_NOT_SELECTED_PASSTHROUGH";
      readonly designationResultKind: E85DesignationApplicabilityResult["kind"];
    }
  | {
      readonly kind: E85IdentityMismatchReason;
      readonly designationResultKind: E85DesignationApplicabilityResult["kind"];
      readonly legalTextIdentity: E85LegalIdentity;
      readonly linkageIdentity: E85LegalIdentity;
    }
  | {
      readonly kind: "IDENTITY_CORRESPONDENCE_ESTABLISHED";
      readonly designationResultKind: E85DesignationApplicabilityResult["kind"];
      readonly legalTextIdentity: E85LegalIdentity;
      readonly linkageIdentity: E85LegalIdentity;
      readonly limitation: string;
    };

/**
 * Deterministic, reproducible error raised only for structurally impossible
 * input at this module's own boundary: a non-object argument, an
 * unrecognized `designation.kind`, an unrecognized `legalTextIdentity.kind`,
 * or a `legalTextIdentity`/`linkageIdentity` shape that fails a basic
 * non-empty-string field check. A real, well-formed
 * `E85DesignationApplicabilityResult` (as only
 * `evaluateE85DesignationApplicability` can construct) can never reach the
 * first of these branches — it exists purely as a defensive backstop,
 * mirroring the Slice 3D-1.1 lesson already applied by
 * `temporal-candidate-adapter.ts`'s `revalidate()` and by
 * `designation-applicability.ts` itself: this module trusts neither
 * argument's static type alone and defensively shape-checks both at its own
 * boundary. Never carries wall-clock time, object identity, or any other
 * nondeterministic content.
 */
export class E85DesignationLegalTextIdentityCorrespondenceError extends Error {
  constructor(message: string) {
    super(`E85 designation/legal-text identity correspondence error: ${message}`);
    this.name = "E85DesignationLegalTextIdentityCorrespondenceError";
  }
}

const POSITIVE_APPLICABILITY_KINDS: readonly E85DesignationApplicabilityResult["kind"][] = [
  "DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL",
  "DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END",
];

const ALL_DESIGNATION_RESULT_KINDS: readonly E85DesignationApplicabilityResult["kind"][] = [
  "DESIGNATION_APPLICABILITY_NOT_EVALUABLE",
  "DESIGNATION_NO_START_EVIDENCE",
  "DESIGNATION_START_CONFLICT",
  "DESIGNATION_OBSERVATION_ONLY_NOT_LEGALLY_DATED",
  "DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END",
  "DESIGNATION_NOT_YET_STARTED",
  "DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL",
  "DESIGNATION_OUTSIDE_CLOSED_INTERVAL",
  "DESIGNATION_END_CONFLICT",
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Defensively validates the `identity` field carried by the two
 * positive-applicability designation kinds. Checked BEFORE any property
 * access downstream (`designationIdentityOf`/`classifyCorrespondence`) ever
 * reads `identity.jurisdictionId`/`identity.districtOrZoneId` — this is the
 * fix for the native-`TypeError` leak a recognized-but-incomplete
 * `designation.kind` value could otherwise reach. Reuses the same
 * non-empty-string field discipline `requireLegalIdentityShape` already
 * applies to `legalTextIdentity`/`linkageIdentity`, applied here to
 * `E85DesignationIdentity`'s own two fields instead.
 */
function requireDesignationIdentityShape(value: unknown, designationKind: string): { readonly jurisdictionId: string; readonly districtOrZoneId: string } {
  if (!isPlainObject(value)) {
    throw new E85DesignationLegalTextIdentityCorrespondenceError(
      `designation.identity must be an object for designation.kind "${designationKind}", got ${JSON.stringify(value)}.`,
    );
  }
  const jurisdictionId = value.jurisdictionId;
  const districtOrZoneId = value.districtOrZoneId;
  if (!isNonEmptyString(jurisdictionId)) {
    throw new E85DesignationLegalTextIdentityCorrespondenceError(
      `designation.identity.jurisdictionId must be a non-empty string for designation.kind "${designationKind}", got ${JSON.stringify(jurisdictionId)}.`,
    );
  }
  if (!isNonEmptyString(districtOrZoneId)) {
    throw new E85DesignationLegalTextIdentityCorrespondenceError(
      `designation.identity.districtOrZoneId must be a non-empty string for designation.kind "${designationKind}", got ${JSON.stringify(districtOrZoneId)}.`,
    );
  }
  return { jurisdictionId, districtOrZoneId };
}

/**
 * Defensive, field-by-field validation of a caller-supplied
 * `E85DesignationApplicabilityResult`. Deliberately does NOT import or
 * re-invoke `evaluateE85DesignationApplicability`/`buildE85DesignationValidity`
 * — this module only needs the result's `kind` (and, when present, its
 * `identity`), never the full designation-validity record, so it checks only
 * what it actually reads rather than re-validating the whole upstream shape.
 * For the two positive-applicability kinds, `identity` is additionally
 * required and shape-checked HERE, before any downstream code reads it —
 * a `kind` that whitelists correctly but carries a missing, null, non-object,
 * or incomplete `identity` is rejected at this boundary rather than reaching
 * an unguarded property access later.
 */
function validateDesignationResult(designation: unknown): E85DesignationApplicabilityResult {
  if (!isPlainObject(designation)) {
    throw new E85DesignationLegalTextIdentityCorrespondenceError(`designation must be an object, got ${JSON.stringify(designation)}.`);
  }
  const kind = designation.kind;
  if (typeof kind !== "string" || !ALL_DESIGNATION_RESULT_KINDS.includes(kind as E85DesignationApplicabilityResult["kind"])) {
    throw new E85DesignationLegalTextIdentityCorrespondenceError(
      `designation.kind must be one of ${JSON.stringify(ALL_DESIGNATION_RESULT_KINDS)}, got ${JSON.stringify(kind)}.`,
    );
  }
  if (POSITIVE_APPLICABILITY_KINDS.includes(kind as E85DesignationApplicabilityResult["kind"])) {
    requireDesignationIdentityShape(designation.identity, kind);
  }
  return designation as unknown as E85DesignationApplicabilityResult;
}

function requireLegalIdentityShape(value: unknown, fieldName: string): E85LegalIdentity {
  if (!isPlainObject(value)) {
    throw new E85DesignationLegalTextIdentityCorrespondenceError(`${fieldName} must be an object, got ${JSON.stringify(value)}.`);
  }
  const jurisdictionId = value.jurisdictionId;
  const sourceId = value.sourceId;
  const sourceVersionId = value.sourceVersionId;
  const zoneDesignation = value.zoneDesignation;
  if (!isNonEmptyString(jurisdictionId)) {
    throw new E85DesignationLegalTextIdentityCorrespondenceError(`${fieldName}.jurisdictionId must be a non-empty string, got ${JSON.stringify(jurisdictionId)}.`);
  }
  if (!isNonEmptyString(sourceId)) {
    throw new E85DesignationLegalTextIdentityCorrespondenceError(`${fieldName}.sourceId must be a non-empty string, got ${JSON.stringify(sourceId)}.`);
  }
  if (!isNonEmptyString(sourceVersionId)) {
    throw new E85DesignationLegalTextIdentityCorrespondenceError(`${fieldName}.sourceVersionId must be a non-empty string, got ${JSON.stringify(sourceVersionId)}.`);
  }
  if (!isNonEmptyString(zoneDesignation)) {
    throw new E85DesignationLegalTextIdentityCorrespondenceError(`${fieldName}.zoneDesignation must be a non-empty string, got ${JSON.stringify(zoneDesignation)}.`);
  }
  return { jurisdictionId, sourceId, sourceVersionId, zoneDesignation };
}

function validateLegalTextIdentityInput(input: unknown): E85LegalTextIdentityInput {
  if (!isPlainObject(input)) {
    throw new E85DesignationLegalTextIdentityCorrespondenceError(`legalTextIdentity must be an object, got ${JSON.stringify(input)}.`);
  }
  const kind = input.kind;
  if (kind === "NOT_SELECTED") {
    return { kind: "NOT_SELECTED" };
  }
  if (kind === "SELECTED") {
    const identity = requireLegalIdentityShape((input as { readonly identity?: unknown }).identity, "legalTextIdentity.identity");
    return { kind: "SELECTED", identity };
  }
  throw new E85DesignationLegalTextIdentityCorrespondenceError(`legalTextIdentity.kind must be "SELECTED" or "NOT_SELECTED", got ${JSON.stringify(kind)}.`);
}

/**
 * Extracts the designation's own identity from a positive-applicability
 * result. Only ever called after `POSITIVE_APPLICABILITY_KINDS` has already
 * confirmed `designation.kind` is one of the two variants that carry
 * `identity` — a compile-time-narrowed access, not a defensive one.
 */
function designationIdentityOf(designation: E85DesignationApplicabilityResult): { readonly jurisdictionId: string; readonly districtOrZoneId: string } {
  if (designation.kind === "DESIGNATION_APPLICABLE_WITHIN_CLOSED_INTERVAL" || designation.kind === "DESIGNATION_POSSIBLY_APPLICABLE_OPEN_END") {
    return designation.identity;
  }
  throw new E85DesignationLegalTextIdentityCorrespondenceError(`designationIdentityOf called on a non-positive-applicability result, got ${JSON.stringify(designation.kind)}.`);
}

/**
 * The exact-match, most-specific-first mismatch classification. Checks
 * jurisdiction on BOTH the designation-vs-linkage axis and the
 * legalText-vs-linkage axis before moving on, then source, then source
 * version, then zone on both axes again — mirroring one real jurisdiction
 * adapter's own bundle-classifier precedence (jurisdiction > source >
 * version > zone), generalized to two identity sources instead of one.
 */
function classifyCorrespondence(
  designationIdentity: { readonly jurisdictionId: string; readonly districtOrZoneId: string },
  legalTextIdentity: E85LegalIdentity,
  linkageIdentity: E85LegalIdentity,
): E85IdentityMismatchReason | undefined {
  if (designationIdentity.jurisdictionId !== linkageIdentity.jurisdictionId) return "JURISDICTION_MISMATCH";
  if (legalTextIdentity.jurisdictionId !== linkageIdentity.jurisdictionId) return "JURISDICTION_MISMATCH";
  if (legalTextIdentity.sourceId !== linkageIdentity.sourceId) return "SOURCE_MISMATCH";
  if (legalTextIdentity.sourceVersionId !== linkageIdentity.sourceVersionId) return "VERSION_MISMATCH";
  if (designationIdentity.districtOrZoneId !== linkageIdentity.zoneDesignation) return "ZONE_MISMATCH";
  if (legalTextIdentity.zoneDesignation !== linkageIdentity.zoneDesignation) return "ZONE_MISMATCH";
  return undefined;
}

/**
 * Evaluates whether a Slice 3G-2 designation-applicability result, a
 * caller-supplied legal-text-selection identity, and a caller-supplied
 * generic atemporal linkage identity correspond. Pure and deterministic: the
 * same three inputs always yield a deeply-equal result, or throw the same
 * `E85DesignationLegalTextIdentityCorrespondenceError`. None of the three
 * inputs (nor any nested object within them) is mutated.
 *
 * Checked in order: (1) is the designation one of the two positive-
 * applicability kinds; (2) was a legal-text identity actually supplied; (3)
 * do the three identities correspond exactly, most-fundamental-mismatch
 * first. `linkageIdentity` is plain caller-supplied data — this module
 * performs no lookup of its own and imports no jurisdiction-specific table.
 */
export function evaluateE85DesignationLegalTextIdentityCorrespondence(
  designation: E85DesignationApplicabilityResult,
  legalTextIdentity: E85LegalTextIdentityInput,
  linkageIdentity: E85LegalIdentity,
): E85DesignationLegalTextCorrespondenceResult {
  const validatedDesignation = validateDesignationResult(designation);
  const validatedLegalText = validateLegalTextIdentityInput(legalTextIdentity);
  const validatedLinkage = requireLegalIdentityShape(linkageIdentity, "linkageIdentity");

  if (!POSITIVE_APPLICABILITY_KINDS.includes(validatedDesignation.kind)) {
    return { kind: "DESIGNATION_NOT_APPLICABLE_PASSTHROUGH", designationResultKind: validatedDesignation.kind };
  }

  if (validatedLegalText.kind === "NOT_SELECTED") {
    return { kind: "LEGAL_TEXT_NOT_SELECTED_PASSTHROUGH", designationResultKind: validatedDesignation.kind };
  }

  const designationIdentity = designationIdentityOf(validatedDesignation);
  const mismatch = classifyCorrespondence(designationIdentity, validatedLegalText.identity, validatedLinkage);

  if (mismatch !== undefined) {
    return {
      kind: mismatch,
      designationResultKind: validatedDesignation.kind,
      legalTextIdentity: validatedLegalText.identity,
      linkageIdentity: validatedLinkage,
    };
  }

  return {
    kind: "IDENTITY_CORRESPONDENCE_ESTABLISHED",
    designationResultKind: validatedDesignation.kind,
    legalTextIdentity: validatedLegalText.identity,
    linkageIdentity: validatedLinkage,
    limitation:
      "This means ONLY that the supplied designation identity, legal-text identity, and linkage identity correspond exactly under " +
      "atemporal, exact-match rules. It does NOT mean the linkage itself was legally valid at any date, including the requested AS_OF " +
      "date; it does NOT mean the parcel was historically zoned under the selected legal text; it does NOT mean legal-text validity and " +
      "designation validity are temporally aligned; it does NOT authorize rule-pack application; and it does NOT constitute a final " +
      "zoning determination.",
  };
}

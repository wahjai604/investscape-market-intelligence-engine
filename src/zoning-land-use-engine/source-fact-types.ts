/**
 * InvestScape™ E85 Phase 5 — Source Adapter & Registry Foundation: the
 * structured source-input contract.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * THIS IS NOT A UNIVERSAL MUNICIPAL-DOCUMENT SCHEMA, and deliberately cannot
 * become one. It is the narrowest shape that an EXTRACTION step (whatever
 * performs it — a human reading a PDF, a future parser, a municipal API
 * client) must produce for an E85 adapter to have something to normalize.
 * Extraction itself is NOT implemented in Phase 5 and nothing in this file
 * reads a document.
 *
 * The governing design rule is that a fact records what the SOURCE SAYS, in
 * the source's own words, plus where it says it — and nothing else. There is
 * no field for a normalized rule family value, no field for an E85 use status,
 * and no field for an interpretation. Those are the adapter's output, and
 * letting an extractor pre-supply them would move jurisdiction interpretation
 * out of the adapter layer, which is precisely the boundary Phase 5 exists to
 * establish.
 *
 * Extensibility is by adding optional fields to `E85StructuredSourceFact`, not
 * by widening `sourceTerm` into a free-form blob: an adapter that does not
 * recognize a term must say so (`UNSUPPORTED_SOURCE_CONCEPT`), and that is
 * only possible while terms stay discrete strings.
 */
import type { E85DocumentLocator, E85TemporalAuthority } from "./provenance-types";
import type { E85RuleFamily } from "./rule-family-types";
import type { E85ApplicabilityDimension, E85NumericBound } from "./rule-applicability-types";
import type { E85RequirementChoiceMode, E85RequirementReferenceRole } from "./regulatory-requirement-types";
import type { E85TemporalWindow } from "./evidence-types";

/**
 * PHASE 12B.2 — which proposals a source statement governs, in the SOURCE's
 * own vocabulary. The adapter maps these terms onto its normalized codes and
 * refuses anything it cannot map. Every dimension present MUST carry a locator
 * saying where the source states that part of the scope: scope is a legal
 * assertion, and a scope with no source is not emitted.
 */
export interface E85StructuredFactApplicability {
  useTerms?: readonly string[];
  excludedUseTerms?: readonly string[];
  dwellingUnits?: E85NumericBound;
  buildingRoleTerms?: readonly string[];
  excludedBuildingRoleTerms?: readonly string[];
  siteAreaSqm?: E85NumericBound;
  frontageMetres?: E85NumericBound;
  tenureTerms?: readonly string[];
  excludedTenureTerms?: readonly string[];
  conditionIds?: readonly string[];
  /** Keyed by the generic dimension each source term set is mapped onto. Required for every dimension present. */
  locators?: Readonly<Partial<Record<E85ApplicabilityDimension, E85DocumentLocator>>>;
}

/**
 * PHASE 12B.4 — the structural parts of a regulatory requirement as the source
 * states them. The obligation itself is named by the fact's `sourceTerm`, which
 * the adapter maps; a stated quantity uses `numericValue` + `unit`; the trigger
 * uses `applicability`. There is deliberately no field for who elects between
 * alternatives: nothing may be recorded that the source does not say.
 */
export interface E85StructuredFactRequirement {
  /** The basis of the stated quantity in the source's own words, e.g. "residential floor area". Required whenever `numericValue` is present. */
  quantityBasisTerm?: string;
  /** Present when the source states this obligation as one alternative of a choice. `groupId` is shared by every alternative of that choice. */
  choiceGroup?: { groupId: string; mode: E85RequirementChoiceMode };
  /** Other instruments, or parts of one, this obligation depends on, located but not structured by this extract. */
  references?: readonly { role: E85RequirementReferenceRole; target: E85DocumentLocator; description: string }[];
}

/**
 * How a provision elsewhere in the source bears on a fact's value without
 * changing it.
 *  USE_SPECIFIC_REGULATION — a regulation the use row itself cites, which a
 *                            proposal must also satisfy.
 *  DISCRETIONARY_RELAXATION — an official MAY vary the value. Never an
 *                            entitlement, never a higher maximum.
 *  EXCEPTION               — the source carves a case out of the value's
 *                            premise (e.g. a tenure test).
 */
export type E85FactQualificationKind = "USE_SPECIFIC_REGULATION" | "DISCRETIONARY_RELAXATION" | "EXCEPTION";

/**
 * What is known of the qualifying provision's own amendment history.
 *  INSTRUMENTS_LOCATED — each instrument named was located and read. This does
 *                        NOT assert the history, or any definition it relies
 *                        on, is complete.
 *  PARTLY_UNLOCATED    — at least one part has no located instrument.
 *  NOT_TRACED          — the provision's history was not traced at all.
 */
export type E85QualificationHistoryStatus = "INSTRUMENTS_LOCATED" | "PARTLY_UNLOCATED" | "NOT_TRACED";

/**
 * A provision that qualifies a fact without changing its value or scope.
 *
 * Deliberately carries NO numeric field: a relaxation's figures stay in
 * `description` so nothing downstream can read them as a limit. A condition
 * that decides whether the value applies at all belongs in `condition` or
 * `applicability`, not here.
 */
export interface E85StructuredFactQualification {
  /** Stable within the fact. */
  qualificationId: string;
  kind: E85FactQualificationKind;
  /** Where the source states the qualification. Must name a section. */
  locator: E85DocumentLocator;
  /** Short paraphrase, never by-law prose. */
  description: string;
  /**
   * The caller-affirmed condition (in the fact's `applicability.conditionIds`)
   * that gates the value on this regulation. REQUIRED for a
   * USE_SPECIFIC_REGULATION on a USE fact: a disclosure alone would let a
   * permission read as unconditional while compliance is unestablished.
   */
  conditionId?: string;
  history: {
    status: E85QualificationHistoryStatus;
    /** Located amending or originating instruments, when any. */
    locatedInstruments?: readonly E85DocumentLocator[];
    /** What is unresolved. Required unless `status` is INSTRUMENTS_LOCATED. */
    disclosure?: string;
  };
}

/**
 * Unit as the source states it. `NONE` is for genuinely unitless facts (a
 * use-permission status); it is NOT a stand-in for "unit not recorded" —
 * omitting `unit` entirely expresses that, and an adapter needing a unit will
 * raise a finding rather than assume one.
 */
export type E85SourceUnit =
  /** A bare ratio, e.g. floor space ratio 1.00. */
  | "RATIO"
  | "METRES"
  | "SQUARE_METRES"
  /** A whole-number count of storeys. */
  | "STOREYS"
  /** A fraction in 0..1, e.g. site coverage 0.5. */
  | "FRACTION"
  /** A percentage in 0..100, e.g. site coverage 50. Kept distinct from FRACTION so an adapter converts explicitly rather than guessing which scale a bare "50" is on. */
  | "PERCENT"
  /** A count of parking/loading/bicycle spaces. */
  | "SPACES"
  /** A whole-number count of dwelling units (Phase 12B.2). */
  | "DWELLING_UNITS"
  | "NONE";

/**
 * One fact extracted from one place in one source document.
 *
 * A missing `numericValue` is NEVER equivalent to zero. An extractor that
 * found the row but no number omits the field, and the adapter turns that into
 * an explicit `MISSING_REQUIRED_VALUE` finding paired with a DATA_GAP — see
 * the hard invariant in data-gap-types.ts.
 */
export interface E85StructuredSourceFact {
  /** Stable identifier for this fact within its document. Used for deterministic ordering, duplicate detection, and pointing findings back at their cause. */
  factId: string;
  /** Which rule family the SOURCE's statement belongs to. Reuses the Phase 3 family enum rather than defining a parallel one. */
  family: E85RuleFamily;
  /** Zone designation exactly as printed at the source, e.g. "R1-1". Never normalized, never widened toward a parent zone. */
  zoneDesignation: string;
  /** The regulated concept in the SOURCE's own vocabulary, e.g. "floor space ratio", "Outright Approval Use". The adapter maps this; core E85 never interprets it. */
  sourceTerm: string;
  /** For USE facts, the land use in the source's own vocabulary, e.g. "One-family Dwelling". */
  sourceUseTerm?: string;
  /** The number as printed. Absent when the source states none — never defaulted. */
  numericValue?: number;
  /** The value as printed when it is textual rather than numeric (e.g. an approval authority, an amenity requirement description). */
  textValue?: string;
  unit?: E85SourceUnit;
  /**
   * The condition the source attaches to this value, verbatim or closely
   * paraphrased, e.g. "building is a rear building". Presence of this field
   * means the value is NOT unconditional, and an adapter must route it away
   * from the unconditional rule set rather than choosing whichever value is
   * more favourable.
   */
  condition?: string;
  /** PHASE 12B.2: the proposals this statement governs, in source vocabulary. Absent means the statement is unscoped. */
  applicability?: E85StructuredFactApplicability;
  /** PHASE 12B.4: for REQUIREMENT facts, the requirement's structural parts in source vocabulary. */
  requirement?: E85StructuredFactRequirement;
  /** Where in the document this fact is stated. Carried straight into provenance. */
  locator: E85DocumentLocator;
  /** Other places the source states the SAME value for the same scope, e.g. a zone-wide value repeated in two sections. Surfaced as a finding; `locator` stays the primary citation. */
  additionalLocators?: readonly E85DocumentLocator[];
  /** Provisions that qualify this value without changing it. Each surfaces as a WARNING finding on the fact. */
  qualifications?: readonly E85StructuredFactQualification[];
  /**
   * PHASE 12C.2 (optional, additive): this fact's OWN legal effective window,
   * when an amending instrument distinct from the document's own
   * publication/consolidation stamp establishes one. Absent means the fact
   * falls back to the document version's derived temporal window exactly as
   * every earlier phase behaved — this field never narrows or overrides that
   * fallback implicitly, an adapter must read it explicitly.
   *
   * This is a proposition date, not a definition/dependency date: if this
   * fact's current wording depends on a term defined or amended elsewhere
   * (e.g. by a different by-law, on a different date), that dependency date
   * does NOT belong here — it belongs in `notes`/provenance as audit context,
   * because attaching it here would make E85 select or exclude this fact on a
   * date that governs a term the fact merely uses, not the fact's own
   * enactment.
   */
  temporal?: E85TemporalWindow;
  /**
   * PHASE 12C.2A (optional, additive): machine-readable identity of the
   * amending instrument backing `temporal`, when `temporal.effectiveDateBasis`
   * is `AMENDMENT_DATE_KNOWN`. A date literal plus that basis enum value is
   * not by itself auditable back to a specific instrument/clause; this field
   * is what makes it so, without requiring a human to have read a report or
   * comment to know why. See `E85TemporalAuthority`.
   */
  temporalAuthority?: E85TemporalAuthority;
  /** Extractor's note on any ambiguity encountered while reading. Surfaces as an adapter finding; never silently dropped. */
  notes?: string;
}

/**
 * A structured extract of ONE zone's content from ONE version of ONE source.
 * Deliberately scoped to a single zone: a multi-zone extract would force the
 * adapter to route facts by zone internally, which is where a "close enough"
 * zone match would eventually creep in.
 */
export interface E85StructuredSourceDocument {
  /** Registered `E85SourceDefinition.sourceId` this extract came from. */
  sourceId: string;
  /** Jurisdiction the extract claims. Cross-checked against the registry; a mismatch is an explicit failure, never reconciled silently. */
  jurisdictionId: string;
  /** Consolidation/version this extract was taken from. An unregistered version is never adapted as though it were known. */
  versionId: string;
  /** The single zone designation this extract covers, exactly as printed. */
  zoneDesignation: string;
  facts: readonly E85StructuredSourceFact[];
  /**
   * Sections the extractor knows exist but did not structure. Recording them
   * is what turns silent absence into an honest `SOURCE_SECTION_UNAVAILABLE`
   * finding — without it, "we did not extract section 4" and "section 4 does
   * not exist" are indistinguishable downstream.
   */
  unstructuredSections?: readonly string[];
  /** ISO 8601 timestamp the extraction was performed. Required: it is the deterministic clock for anything the adapter timestamps, so normalization never calls `Date.now()` itself. */
  extractedAt: string;
}

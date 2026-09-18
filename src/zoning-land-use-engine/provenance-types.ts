/**
 * InvestScape™ E85 Phase 3 — Zoning & Land-Use Rules Engine: provenance
 * model.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Structured, multi-field locator (Phase 2 correction 9) — never one giant
 * free-text field, and never dependent solely on a URL for identity. A
 * bylaw's identity is its jurisdiction + document/section/clause reference,
 * which typically long outlives any particular URL it happens to be hosted
 * at today (Vancouver's own by-law PDFs are re-issued at new URLs on every
 * consolidation, per Phase 3 pilot research below).
 */
import type { E85GeometryRef } from "./jurisdiction-types";

/**
 * A structured pointer into an authoritative regulatory document. Every
 * field is optional because different jurisdictions structure their
 * documents differently (some have schedules/tables, some don't; some are
 * GIS-first with no linear document at all) — but at least one of
 * `documentId` or `gisDatasetId` should normally be present for a
 * provenance record to be meaningful.
 */
export interface E85DocumentLocator {
  /** Bylaw, ordinance, code, or by-law number, e.g. "3575" (Vancouver Zoning and Development By-law). */
  bylawOrDocumentId?: string;
  /** Section number/label within the document, e.g. "Section 2". */
  section?: string;
  /** Clause/sub-clause label within a section, e.g. "2.1". */
  clause?: string;
  /** Named schedule within the document, e.g. "District Schedule RS-1". */
  schedule?: string;
  /** Table label within a schedule/section, e.g. "Table 2 — Conditional Approval Uses". */
  table?: string;
  /** Row identifier/label within a table, when the source is tabular. */
  row?: string;
  /** Page number in the source document/PDF, when known. */
  page?: number;
}

/**
 * PHASE 12C.2A (optional, additive): machine-readable identification of the
 * legal instrument that established an evidence item's `temporal` window,
 * kept strictly distinct from `E85Provenance.documentLocator` — that field
 * locates the VALUE in the current consolidated text (e.g. "§3.1.1.2"); this
 * one locates the AMENDING instrument that made 3.1.1.2 read that way and
 * says when it took effect. Neither overwrites the other, and both are
 * legally meaningful on their own. Present only when `effectiveDateBasis` is
 * `AMENDMENT_DATE_KNOWN` (or another basis a reviewer can point to a specific
 * instrument for); a `SOURCE_STATED`/`PUBLICATION_DATE_INFERRED`/`UNKNOWN`
 * basis has no instrument to name and omits this field. Jurisdiction-neutral:
 * every field reuses `E85DocumentLocator`, so no jurisdiction vocabulary
 * appears here — only in the locator values an adapter supplies.
 */
export interface E85TemporalAuthority {
  /** The amending instrument itself, e.g. `{ bylawOrDocumentId: "<amendment number>" }`. Never the source's own `sourceId` — the instrument need not be a registered E85 source. */
  instrument: E85DocumentLocator;
  /** The specific clause of the instrument that establishes or replaces this proposition, when narrower than the instrument as a whole. */
  propositionLocator?: E85DocumentLocator;
  /** The clause establishing when the instrument (and so this proposition) came into force. */
  commencementLocator: E85DocumentLocator;
}

/** A structured pointer into a GIS dataset, distinct from a document locator — many zoning determinations (e.g. overlay boundaries) are resolved spatially rather than textually. */
export interface E85GisLocator {
  /** Identifier of the GIS dataset/layer, e.g. a municipal open-data layer name. */
  gisDatasetId?: string;
  /** Identifier of the GIS layer within the dataset, if the dataset has multiple layers. */
  gisLayerId?: string;
  /** Identifier of the specific feature within the layer that was matched. */
  gisFeatureId?: string;
  /** Optional, minimal, dependency-free geometry placeholder for the matched feature — see `E85GeometryRef`. Never required in Rule-Only Mode. */
  geometryRef?: E85GeometryRef;
}

/**
 * Full provenance record attached to an evidence item, rule record, or
 * result. Combines a source identity, an optional document locator, an
 * optional GIS locator, zone/overlay designation strings as found at the
 * source (raw, not normalized), an effective-date basis, and optional
 * interpretive notes/assumptions that a human reviewer needs to see.
 */
export interface E85Provenance {
  /** Identifier of the source (adapter/dataset/publisher) this provenance came from. Scoped to E85's own source registry (Phase 3 correction 13) — never a reuse of E86's `sourceId` space. */
  sourceId: string;
  /**
   * PHASE 5 CONTRACT ADDITION (E85 Phase 5 — Source Adapter & Registry
   * Foundation, documented in the Phase 5 report): which VERSION/consolidation
   * of `sourceId` this value was read from, e.g. "2026-06-consolidation".
   * `sourceId` is deliberately stable across consolidations (see
   * source-registry-types.ts), so without this field a provenance record
   * cannot distinguish a value read from the June 2026 consolidation from the
   * same field read from an earlier one. Optional and additive only — no
   * Phase 3/4 fixture sets it.
   */
  sourceVersionId?: string;
  /**
   * PHASE 5 CONTRACT ADDITION: identity of the source adapter that normalized
   * this value, and the adapter's own version. The same source version
   * normalized by adapter v1 and v2 may legitimately yield different
   * structured output as normalization logic improves, so "where exactly did
   * this value come from?" is not fully answerable from the document locator
   * alone. Carried per-evidence (not only on the enclosing bundle) because a
   * normalized `E85RuleRecord` is routinely detached from its bundle and
   * handed to the Phase 4 evaluator on its own. Optional and additive only.
   */
  adapterId?: string;
  adapterVersion?: string;
  documentLocator?: E85DocumentLocator;
  gisLocator?: E85GisLocator;
  /** Raw zone designation string as found at the source, e.g. "RS-1", "CD-1 (245)". */
  zoneDesignation?: string;
  /** Raw overlay designation string as found at the source, e.g. "Development Permit Area — Rain City Strategy". */
  overlayDesignation?: string;
  /** What established the effective date used to select this evidence — see `effectiveDateBasis` values in evidence-types.ts. Free text describing the specific basis found (e.g. "Council adoption date printed on consolidation cover page"). */
  effectiveDateBasisNote?: string;
  /** PHASE 12C.2A (optional, additive): machine-readable amending-instrument identity backing an `AMENDMENT_DATE_KNOWN` `temporal` window. See `E85TemporalAuthority`. */
  temporalAuthority?: E85TemporalAuthority;
  /** Optional URL for convenience/traceability only — NEVER the sole identity of this provenance record (Phase 2 correction 9). May go stale; that does not invalidate the rest of the record. */
  url?: string;
  /** Free-text note describing any interpretive judgment made in reading the source (e.g. "table column header ambiguous between FSR and floor area — read literally as FSR"). */
  interpretationNote?: string;
  /** Free-text list of assumptions made in the absence of an explicit source statement. Every assumption here is a candidate justification for MANUAL_REVIEW_REQUIRED, never silently folded into a numeric result. */
  assumptions?: readonly string[];
  /** When this provenance record was captured/verified by E85 (ISO 8601), distinct from the document's own effective date. */
  retrievedAt?: string;
}

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
  /** Identifier of the source (adapter/dataset/publisher) this provenance came from. Scoped to E85's own source registry (Phase 3 correction 13) — never a reuse of E68's `sourceId` space. */
  sourceId: string;
  documentLocator?: E85DocumentLocator;
  gisLocator?: E85GisLocator;
  /** Raw zone designation string as found at the source, e.g. "RS-1", "CD-1 (245)". */
  zoneDesignation?: string;
  /** Raw overlay designation string as found at the source, e.g. "Development Permit Area — Rain City Strategy". */
  overlayDesignation?: string;
  /** What established the effective date used to select this evidence — see `effectiveDateBasis` values in evidence-types.ts. Free text describing the specific basis found (e.g. "Council adoption date printed on consolidation cover page"). */
  effectiveDateBasisNote?: string;
  /** Optional URL for convenience/traceability only — NEVER the sole identity of this provenance record (Phase 2 correction 9). May go stale; that does not invalidate the rest of the record. */
  url?: string;
  /** Free-text note describing any interpretive judgment made in reading the source (e.g. "table column header ambiguous between FSR and floor area — read literally as FSR"). */
  interpretationNote?: string;
  /** Free-text list of assumptions made in the absence of an explicit source statement. Every assumption here is a candidate justification for MANUAL_REVIEW_REQUIRED, never silently folded into a numeric result. */
  assumptions?: readonly string[];
  /** When this provenance record was captured/verified by E85 (ISO 8601), distinct from the document's own effective date. */
  retrievedAt?: string;
}

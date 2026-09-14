/**
 * InvestScape™ E85 Phase 8 — spatial source adapters barrel.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Source-specific spatial mapping lives under this directory and nowhere else.
 * The generic Phase 8 contracts know that a raw record has an attribute bag;
 * they do not know any publisher's attribute NAMES, and the moment they did,
 * every other publisher would become a special case.
 *
 * The dependency runs one way: adapters depend on the generic contracts and on
 * Phase 7's geometry validation, never the reverse. Phase 7 contains no adapter
 * id, no source schema and no dataset-specific feature class, which is what
 * keeps it usable for a layer that arrives from anywhere at all.
 *
 * Adding a publisher means adding a directory here.
 */
export * as reference from "./reference";

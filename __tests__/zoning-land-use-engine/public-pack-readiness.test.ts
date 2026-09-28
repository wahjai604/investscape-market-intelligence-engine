/**
 * InvestScape™ E85 — `packReadiness` on the public response (e85-public-2).
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Hermetic. The legal pack is assembled from the production facts with the
 * manifest's own PDF pins standing in for hashed bytes (the evidence suite
 * hashes the real PDFs). Server inputs are TEST-ONLY: the one-feature R1-1
 * fixture snapshot and a synthetic parcel.
 *
 * Proves: the disclosure comes only from the server; it is source readiness,
 * never legal status (the decision is byte-identical with or without it); a
 * missing disclosure reads NOT_SUPPLIED; an altered one fails closed; and it
 * carries no by-law text.
 */
import {
  createE85SpatialAdapterRegistry,
  createE85SpatialDatasetRegistry,
  normalizeE85SpatialSnapshot,
  adapters,
  E85LegalPackIntegrityError,
  E85LegalPackDisclosures,
} from "../../src/zoning-land-use-engine";
import { zoningLandUse } from "../../src";
import { createVancouverZoningSpatialAdapter, vancouverZoningDataset } from "../../src/zoning-land-use-engine/adapters/spatial/vancouver";
import { SYNTHETIC_PARCEL_IN_R1_1, VANCOUVER_NORMALIZED_AT, VANCOUVER_RESOLVED_AT, VAN_R1_1, vancouverSnapshot } from "./fixtures/vancouver-spatial-snapshot";

const { parseE85PublicRequest, evaluateE85PublicRequest, toE85PublicPackReadiness, E85_PUBLIC_CONTRACT_VERSION } = zoningLandUse;
const { legalPack } = adapters.vancouver;
const M = legalPack.VANCOUVER_LEGAL_PACK_MANIFEST;

const assembly = legalPack.assembleVancouverLegalPackForServer(legalPack.loadVancouverLegalPack(), {
  observedPdfSha256BySourceId: new Map(M.sources.map((s) => [s.sourceId, s.sourcePdfSha256])),
  extractedAt: "2026-09-27T00:00:00.000Z",
});

function server(withPack = true, override: Partial<zoningLandUse.E85PublicServerInputs> = {}): zoningLandUse.E85PublicServerInputs {
  const registry = createE85SpatialAdapterRegistry([createVancouverZoningSpatialAdapter(assembly.linkPolicy)]);
  if (!registry.ok) throw new Error("adapter registry problems");
  const datasets = createE85SpatialDatasetRegistry([vancouverZoningDataset()]);
  const normalization = normalizeE85SpatialSnapshot(vancouverSnapshot([VAN_R1_1]), datasets, registry.registry, { normalizedAt: VANCOUVER_NORMALIZED_AT });
  if (normalization.outcome !== "NORMALIZED") throw new Error("expected NORMALIZED");
  return {
    normalization,
    parcelSpatial: SYNTHETIC_PARCEL_IN_R1_1(),
    jurisdictionId: assembly.jurisdictionId,
    zoneDesignation: "R1-1",
    designationSource: { datasetId: "test-dataset", datasetVersionId: "test-version", snapshotSha256: "0".repeat(64) },
    policyVersion: { policyVersionId: "pack-readiness-test", effectiveFrom: "2020-01-01", concepts: {} },
    availableRulePacks: [...assembly.rulePacks],
    spatialRegistry: datasets,
    resolvedAt: VANCOUVER_RESOLVED_AT,
    composedAt: "2026-09-14T00:00:00.000Z",
    assembledAt: "2026-09-14T00:00:00.000Z",
    ...(withPack ? { legalPack: legalPack.vancouverLegalPackPublicServerInput(assembly) } : {}),
    ...override,
  };
}

function request(extra: Record<string, unknown> = {}) {
  const r = parseE85PublicRequest({
    parcel: { parcelId: "synthetic-parcel" },
    useCode: "single_detached_house",
    requestedAnalyses: ["USE", "DENSITY", "DIMENSIONAL", "REQUIREMENT"],
    temporal: { mode: "AS_OF", asOfDate: "2026-09-14" },
    siteArea: { sqm: 500, basis: { kind: "BYLAW_DEFINED_SITE_AREA", deductionStatus: "NONE_APPLICABLE_CONFIRMED", sourceReference: "synthetic test assertion" } },
    ...extra,
  });
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.request;
}

/** Evaluates with a disclosure altered by `mutate` and returns the refusal's problems. */
function refusal(mutate: (d: Record<string, unknown>) => void, override: Partial<zoningLandUse.E85PublicServerInputs> = {}): string[] {
  const disclosures = JSON.parse(JSON.stringify(assembly.disclosures)) as Record<string, unknown>;
  mutate(disclosures);
  const s = server(true, { legalPack: { legalPackId: assembly.legalPackId, disclosures: disclosures as unknown as E85LegalPackDisclosures }, ...override });
  try {
    evaluateE85PublicRequest(s, request());
  } catch (e) {
    expect(e).toBeInstanceOf(E85LegalPackIntegrityError);
    // The mapper refuses the same disclosure on its own.
    expect(() => toE85PublicPackReadiness(s)).toThrow(E85LegalPackIntegrityError);
    return [...(e as E85LegalPackIntegrityError).problems];
  }
  throw new Error("expected the altered disclosure to be refused");
}

describe("contract version", () => {
  test("adding a required field bumps the contract to e85-public-2", () => {
    expect(E85_PUBLIC_CONTRACT_VERSION).toBe("e85-public-2");
    expect(evaluateE85PublicRequest(server(), request()).response.contractVersion).toBe("e85-public-2");
  });
});

describe("response mapping from the server's loaded pack", () => {
  test("the Vancouver disclosure maps to the compact DTO, field for field", () => {
    const { packReadiness } = evaluateE85PublicRequest(server(), request()).response;
    expect(packReadiness).toEqual({
      state: "DISCLOSED",
      basis: "SERVER_LOADED_LEGAL_PACK",
      legalPackId: "ca-bc-vancouver.base-zoning.r1-1+c-2c",
      releaseStatus: "NOT_RELEASED",
      asOfResolution: "DISABLED",
      licence: {
        status: "LICENSE_UNKNOWN",
        sources: [
          { sourceId: "ca-bc-vancouver:zoning-development-bylaw-3575:district-schedule-r1-1", licenseStatus: "LICENSE_UNKNOWN" },
          { sourceId: "ca-bc-vancouver:zoning-development-bylaw-3575:district-schedule-c-2c", licenseStatus: "LICENSE_UNKNOWN" },
        ],
      },
      definitionHistory: "NOT_PROVEN_COMPLETE",
      versionValidity: "UNKNOWN",
      amendmentIndex: { captureDate: "2026-09-28", indexSha256: "3481f17b6d8df77716cd6645f08d05afd7be35d34239ea6ede4988ba382a1b01", currency: "CHECKED_THROUGH_INDEX_CAPTURE_ONLY" },
      withheldValues: [{ factId: "r1-1-requirement-002", what: "Schedule J §8.1.1 cash-in-lieu rate", gateId: "SCHEDULE_J_SOURCE_IDENTITY" }],
      openGates: M.openGates.map((g) => ({ gateId: g.gateId, description: g.description })),
      meaning: expect.stringContaining("does not change the decision status"),
    });
  });

  test("with no server disclosure the response says NOT_SUPPLIED; it is never omitted or inferred", () => {
    const { packReadiness } = evaluateE85PublicRequest(server(false), request()).response;
    expect(packReadiness).toEqual({ state: "NOT_SUPPLIED", meaning: expect.stringContaining("Nothing is implied") });
  });

  test("the DTO carries only its declared keys", () => {
    const pr = evaluateE85PublicRequest(server(), request()).response.packReadiness;
    expect(Object.keys(pr).sort()).toEqual(
      ["amendmentIndex", "asOfResolution", "basis", "definitionHistory", "legalPackId", "licence", "meaning", "openGates", "releaseStatus", "state", "versionValidity", "withheldValues"].sort(),
    );
  });
});

describe("source readiness is not legal status", () => {
  test("DATA_GAP stays DATA_GAP, and the decision is identical with or without the disclosure", () => {
    const withPack = evaluateE85PublicRequest(server(true), request()).response;
    const without = evaluateE85PublicRequest(server(false), request()).response;
    expect(withPack.status).toBe("DATA_GAP");
    const { packReadiness: a, ...decisionA } = withPack;
    const { packReadiness: b, ...decisionB } = without;
    expect(a.state).toBe("DISCLOSED");
    expect(b.state).toBe("NOT_SUPPLIED");
    expect(decisionA).toEqual(decisionB);
    expect(withPack.fields.length).toBeGreaterThan(0);
    expect(withPack.fields.every((f) => f.standing === "UNCONFIRMED_WHILE_BLOCKED")).toBe(true);
    expect(withPack.blockers).toContainEqual(expect.objectContaining({ sourceCode: "TEMPORAL_ANALYSIS_NOT_YET_APPLIED", materiality: "MATERIAL" }));
  });

  test("the disclosure reproduces no by-law text", () => {
    const pr = JSON.stringify(evaluateE85PublicRequest(server(), request()).response.packReadiness);
    const bylawStrings = legalPack.VANCOUVER_LEGAL_PACK_CONTENT.flatMap((c) => c.facts).flatMap((f) => [f.notes, ...(f.qualifications ?? []).flatMap((q) => [q.description, q.history.disclosure])]);
    for (const s of bylawStrings) if (typeof s === "string" && s.length > 20) expect(pr).not.toContain(s);
    // No field value, locator or source term leaks through it either.
    for (const needle of ["documentLocator", "sourceTerm", "numericValue", "Outright Approval Use"]) expect(pr).not.toContain(needle);
  });
});

describe("callers cannot provide or override readiness", () => {
  test.each(["packReadiness", "legalPack", "legalPackId", "disclosures", "releaseStatus", "asOfResolution", "licenseStatus", "openGates", "withheldValues"])("request field %s is rejected as server-controlled", (field) => {
    const r = parseE85PublicRequest({ parcel: { parcelId: "p" }, useCode: "single_detached_house", requestedAnalyses: ["USE"], temporal: { mode: "AS_OF", asOfDate: "2026-09-14" }, [field]: { state: "DISCLOSED", releaseStatus: "RELEASED" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual(expect.objectContaining({ code: "SERVER_CONTROLLED_FIELD", path: field }));
  });
});

describe("missing or altered server disclosures fail closed", () => {
  test.each<[string, (d: Record<string, unknown>) => void, RegExp]>([
    ["releaseStatus claims RELEASED", (d) => { d.releaseStatus = "RELEASED"; }, /releaseStatus RELEASED/],
    ["asOfResolution claims ENABLED", (d) => { d.asOfResolution = "ENABLED"; }, /asOfResolution ENABLED/],
    ["definition history claims PROVEN", (d) => { (d.openUnknowns as Record<string, unknown>).definitionHistory = "PROVEN"; }, /openUnknowns/],
    ["openUnknowns removed", (d) => { delete d.openUnknowns; }, /openUnknowns/],
    ["a source claims PUBLIC_REUSE", (d) => { (d.sourceLicences as { licenseStatus: string }[])[1].licenseStatus = "PUBLIC_REUSE"; }, /PUBLIC_REUSE contradicts/],
    ["a licence status is not a status", (d) => { (d.sourceLicences as { licenseStatus: string }[])[0].licenseStatus = "OPEN"; }, /is not a licence status/],
    ["sourceLicences removed", (d) => { delete d.sourceLicences; }, /sourceLicences are missing/],
    ["index digest altered", (d) => { (d.currencyCheckedThrough as Record<string, unknown>).indexSha256 = "not-a-digest"; }, /amendment-index/],
    ["index capture date widened", (d) => { (d.currencyCheckedThrough as Record<string, unknown>).indexCaptureDate = "2026-09"; }, /amendment-index/],
    ["open gates removed", (d) => { d.openGates = []; }, /openGates are missing/],
    ["a gate duplicated", (d) => { const g = d.openGates as unknown[]; g.push(g[0]); }, /duplicated/],
    ["the Schedule J gate closed while the rate is still withheld", (d) => { d.openGates = (d.openGates as { gateId: string }[]).filter((g) => g.gateId !== "SCHEDULE_J_SOURCE_IDENTITY"); }, /names gate SCHEDULE_J_SOURCE_IDENTITY, which is not open/],
    ["withheldValues removed", (d) => { delete d.withheldValues; }, /withheldValues are missing/],
  ])("%s", (_name, mutate, pattern) => {
    expect(refusal(mutate).some((p) => pattern.test(p))).toBe(true);
  });

  test("a disclosure that does not cover a rule pack in use is refused", () => {
    const problems = refusal((d) => { d.sourceLicences = (d.sourceLicences as { sourceId: string }[]).filter((s) => !s.sourceId.endsWith("c-2c")); });
    expect(problems.some((p) => /district-schedule-c-2c.*is not covered by the disclosure/.test(p))).toBe(true);
  });

  test("temporal evidence alongside an AS_OF-disabled pack is refused", () => {
    const problems = refusal(() => undefined, { temporalEvidence: { lineages: [], designations: [] } as unknown as zoningLandUse.E85PublicServerInputs["temporalEvidence"] });
    expect(problems).toContainEqual(expect.stringMatching(/asOfResolution is DISABLED/));
  });

  test("missing disclosures or pack id are refused", () => {
    const s = server(true, { legalPack: { legalPackId: "", disclosures: undefined as unknown as E85LegalPackDisclosures } });
    expect(() => evaluateE85PublicRequest(s, request())).toThrow(E85LegalPackIntegrityError);
    try {
      toE85PublicPackReadiness(s);
    } catch (e) {
      expect((e as E85LegalPackIntegrityError).problems).toEqual(["legalPackId is missing", "disclosures are missing"]);
    }
  });

  test("the unaltered disclosure is accepted", () => {
    expect(refusalOrNone()).toEqual([]);
  });
});

function refusalOrNone(): string[] {
  return zoningLandUse.e85PackReadinessProblems(server());
}

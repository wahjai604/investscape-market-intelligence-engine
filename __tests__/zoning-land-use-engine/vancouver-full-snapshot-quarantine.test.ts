/**
 * InvestScape™ E85 — the full 1,621-record Vancouver snapshot, with the real
 * R1-1 and C-2C legal bundles, under the quarantined-polygon point-exclusion
 * proof.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Contains information licensed under the Open Government Licence – Vancouver.
 *
 * Reads the captured EPSG:26910 export from the workspace evidence folder
 * (e85-pilot-evidence/vancouver-spatial), which is tracked in the parent
 * workspace repository rather than in this package. Where that folder is not
 * present the suite is skipped and says so; it never substitutes a subset.
 *
 * Parcels are SYNTHETIC points and squares placed inside real polygons. None is
 * a civic parcel.
 */
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import {
  assembleE85DecisionPackage,
  canonicalRulePackFromBundle,
  createE85SpatialAdapterRegistry,
  createE85SpatialDatasetRegistry,
  normalizeE85SpatialSnapshot,
  adapters,
  E85DecisionPackage,
  E85NormalizedRuleBundle,
  E85ParcelSpatialReference,
  E85RawSpatialFeatureRecord,
  E85RequestedAnalysis,
  E85SpatialNormalizationSuccess,
} from "../../src/zoning-land-use-engine";
import { createVancouverZoningSpatialAdapter, vancouverZoningDataset, vancouverZoningLinkPolicyFromLegalBundles, VANCOUVER_ZONING_CRS } from "../../src/zoning-land-use-engine/adapters/spatial/vancouver";
import { SYNTHETIC_PARCEL_IN_C_2C, SYNTHETIC_PARCEL_IN_R1_1, VANCOUVER_NORMALIZED_AT, VANCOUVER_RESOLVED_AT, vancouverSnapshot } from "./fixtures/vancouver-spatial-snapshot";
import { c2cDocument } from "./fixtures/vancouver-c-2c-facts";
import { r11Document } from "./fixtures/vancouver-r1-1-facts";

const { vancouverC2CAdapter, VANCOUVER_C_2C_SOURCE, vancouverR11Adapter, VANCOUVER_R1_1_SOURCE, VANCOUVER_JURISDICTION_ID } = adapters.vancouver;

const EXPORT = path.join(__dirname, "../../../e85-pilot-evidence/vancouver-spatial/zoning-districts-and-labels-espg26910.geojson");
/** The captured export's bytes, as pinned in e85-pilot-evidence/vancouver-spatial/SPATIAL-MANIFEST.json. */
const EXPORT_SHA256 = "35e65736c1a577eb38e2d5165b90c1e88946e13a28abe2711fd3773a7393a0ef";
const HAVE_EXPORT = fs.existsSync(EXPORT);
/**
 * Under the evidence gate (`npm run test:evidence`, which sets E85_EVIDENCE_GATE)
 * or on CI, a missing export FAILS rather than skips, so a release cannot pass
 * this gate by never running it. Elsewhere it is excluded from `npm test`.
 */
const EVIDENCE_REQUIRED = process.env.E85_EVIDENCE_GATE === "1" || (process.env.CI !== undefined && process.env.CI !== "" && process.env.CI !== "false");
if (!HAVE_EXPORT && !EVIDENCE_REQUIRED) console.warn(`Full Vancouver snapshot not found at ${EXPORT}; the full-snapshot suite is skipped.`);

describe("E85 full-snapshot evidence gate", () => {
  (EVIDENCE_REQUIRED || HAVE_EXPORT ? test : test.skip)("the captured export is present and byte-identical to the pinned capture", () => {
    if (!HAVE_EXPORT) throw new Error(`Evidence gate: full Vancouver snapshot not found at ${EXPORT}. The gate refuses to pass by skipping.`);
    const sha256 = crypto.createHash("sha256").update(fs.readFileSync(EXPORT)).digest("hex");
    expect(sha256).toBe(EXPORT_SHA256);
  });
});

const THE_ELEVEN = ["494447", "494523", "494568", "494688", "494721", "494810", "494869", "494873", "494885", "494949", "494963"];

function bundle(result: { outcome: string; bundle?: E85NormalizedRuleBundle }): E85NormalizedRuleBundle {
  if (result.outcome !== "NORMALIZED" || result.bundle === undefined) throw new Error(`expected NORMALIZED, got ${result.outcome}`);
  return result.bundle;
}

const datasets = () => createE85SpatialDatasetRegistry([vancouverZoningDataset()]);
const point = (id: string, x: number, y: number): E85ParcelSpatialReference => ({ parcelReferenceId: id, geometry: { type: "POINT", crs: VANCOUVER_ZONING_CRS, coordinates: [x, y] } });

(HAVE_EXPORT ? describe : describe.skip)("E85 — the full 1,621-record Vancouver snapshot with real R1-1 and C-2C bundles", () => {
  let legal: E85NormalizedRuleBundle[];
  let phase8: E85SpatialNormalizationSuccess;
  let fileCrs: unknown;

  beforeAll(() => {
    const json = JSON.parse(fs.readFileSync(EXPORT, "utf8")) as { crs: { properties: { name: string } }; features: { properties: Record<string, unknown>; geometry: unknown }[] };
    fileCrs = json.crs.properties.name;
    const records: E85RawSpatialFeatureRecord[] = json.features.map((f) => ({ rawFeatureId: f.properties.object_id as string, rawAttributes: f.properties, rawGeometry: f.geometry }));
    legal = [bundle(vancouverR11Adapter.normalize(r11Document(), VANCOUVER_R1_1_SOURCE)), bundle(vancouverC2CAdapter.normalize(c2cDocument(), VANCOUVER_C_2C_SOURCE))];
    const registry = createE85SpatialAdapterRegistry([createVancouverZoningSpatialAdapter(vancouverZoningLinkPolicyFromLegalBundles(legal))]);
    if (!registry.ok) throw new Error("adapter registry problems");
    const result = normalizeE85SpatialSnapshot(vancouverSnapshot(records), datasets(), registry.registry, { normalizedAt: VANCOUVER_NORMALIZED_AT });
    if (result.outcome !== "NORMALIZED") throw new Error(`expected NORMALIZED, got ${result.reason}`);
    phase8 = result;
  }, 600_000);

  function decide(parcel: E85ParcelSpatialReference, zone: "R1-1" | "C-2C"): E85DecisionPackage {
    const requestedAnalyses: readonly E85RequestedAnalysis[] = zone === "R1-1" ? ["USE", "DENSITY", "DIMENSIONAL"] : ["USE", "DIMENSIONAL"];
    return assembleE85DecisionPackage({
      decisionId: `full-snapshot-${parcel.parcelReferenceId}`,
      normalization: phase8,
      parcelSpatial: parcel,
      parcel: {
        parcelReferenceId: parcel.parcelReferenceId,
        jurisdiction: { jurisdictionId: VANCOUVER_JURISDICTION_ID, country: "CA", regionCode: "BC", municipality: "Vancouver", regulatoryAuthority: "City of Vancouver — Planning, Urban Design and Sustainability", displayName: "City of Vancouver, BC, Canada" },
        rawZoningDesignation: zone,
        siteAreaSqm: 500,
      },
      jurisdictionId: VANCOUVER_JURISDICTION_ID,
      zoneDesignation: zone,
      useCode: zone === "R1-1" ? "single_detached_house" : "barber_shop_or_beauty_salon",
      asOfDate: "2026-09-14",
      requestedAnalyses,
      policyVersion: { policyVersionId: "full-snapshot-v1", effectiveFrom: "2020-01-01", concepts: {} },
      availableRulePacks: legal.map((b) => canonicalRulePackFromBundle(b, "BASE")),
      spatialRegistry: datasets(),
      resolvedAt: VANCOUVER_RESOLVED_AT,
      composedAt: "2026-09-14T00:00:00.000Z",
      assembledAt: "2026-09-14T00:00:00.000Z",
    });
  }

  const quarantineMateriality = (p: E85DecisionPackage) => THE_ELEVEN.map((id) => p.materiality.find((m) => m.featureId === id)?.materiality);

  test("the export declares the CRS E85 registers, and all 1,621 records are read", () => {
    expect(fileCrs).toBe(VANCOUVER_ZONING_CRS.crsId);
    expect(phase8.features.length + phase8.quarantined.length).toBe(1621);
    expect(phase8.features).toHaveLength(1610);
  });

  test("the 11 records REMAIN QUARANTINED — none becomes a feature — each for a Phase 7 geometry refusal", () => {
    expect(phase8.quarantined.map((q) => q.featureId).sort()).toEqual(THE_ELEVEN);
    expect(phase8.quarantined.every((q) => q.reasonCodes.length === 1 && q.reasonCodes[0] === "GEOMETRY_FAILED_PHASE7_VALIDATION")).toBe(true);
    expect(phase8.features.some((f) => THE_ELEVEN.includes(f.featureId))).toBe(false);
    // Every refusal in this release is interior-ring contact without a proper crossing, so each retains its rings for the proof.
    expect(phase8.quarantined.every((q) => q.exclusionProofRings !== undefined)).toBe(true);
  });

  test("finding counts", () => {
    const counts: Record<string, number> = {};
    for (const f of phase8.findings) counts[f.code] = (counts[f.code] ?? 0) + 1;
    expect(counts).toEqual({ FEATURE_NORMALIZED: 1610, FEATURE_QUARANTINED: 11, GEOMETRY_FAILED_PHASE7_VALIDATION: 11, RULE_PACK_LINK_UNRESOLVED: 1516 });
    expect(phase8.features.filter((f) => f.rulePackIds.length > 0)).toHaveLength(94);
  });

  test("R1-1 POINT: all 11 are NON_MATERIAL under the proof and the decision is not blocked by them", () => {
    const p = decide(point("synthetic-point-r1-1", 493456.89, 5456030.81), "R1-1");
    expect(quarantineMateriality(p)).toEqual(THE_ELEVEN.map(() => "NON_MATERIAL"));
    expect(p.blockers).toEqual([]);
    expect(p.status).toBe("MACHINE_RESOLVED_WITH_WARNINGS");
    expect(p.evaluationCompleteness).toBe("COMPLETE");
  });

  test("R1-1 POLYGON: all 11 remain UNDETERMINED and block", () => {
    const p = decide(SYNTHETIC_PARCEL_IN_R1_1(), "R1-1");
    expect(quarantineMateriality(p)).toEqual(THE_ELEVEN.map(() => "UNDETERMINED"));
    expect(p.blockers.map((b) => b.featureId).sort()).toEqual(THE_ELEVEN);
    expect(p.status).toBe("DATA_GAP");
  });

  test("C-2C POINT: all 11 are NON_MATERIAL and nothing blocks", () => {
    const p = decide(point("synthetic-point-c-2c", 491611.89, 5456331.0), "C-2C");
    expect(quarantineMateriality(p)).toEqual(THE_ELEVEN.map(() => "NON_MATERIAL"));
    expect(p.blockers).toEqual([]);
    expect(p.evaluationCompleteness).toBe("COMPLETE");
  });

  test("C-2C POLYGON: all 11 remain UNDETERMINED and block", () => {
    const p = decide(SYNTHETIC_PARCEL_IN_C_2C(), "C-2C");
    expect(quarantineMateriality(p)).toEqual(THE_ELEVEN.map(() => "UNDETERMINED"));
    expect(p.status).toBe("DATA_GAP");
  });

  test("the temporal finding is carried as a warning on every decision, unchanged", () => {
    for (const p of [decide(point("synthetic-point-r1-1", 493456.89, 5456030.81), "R1-1"), decide(point("synthetic-point-c-2c", 491611.89, 5456331.0), "C-2C")]) {
      expect(p.warnings.some((w) => w.includes("TEMPORAL_APPLICABILITY_UNKNOWN"))).toBe(true);
    }
  });

  test("REPORT", () => {
    if (!process.env.E85_FULL_SNAPSHOT_REPORT) return;
    const cases: [string, E85ParcelSpatialReference, "R1-1" | "C-2C"][] = [
      ["R1-1 point", point("synthetic-point-r1-1", 493456.89, 5456030.81), "R1-1"],
      ["R1-1 polygon", SYNTHETIC_PARCEL_IN_R1_1(), "R1-1"],
      ["C-2C point", point("synthetic-point-c-2c", 491611.89, 5456331.0), "C-2C"],
      ["C-2C polygon", SYNTHETIC_PARCEL_IN_C_2C(), "C-2C"],
    ];
    const report = cases.map(([label, parcel, zone]) => {
      const p = decide(parcel, zone);
      return {
        label,
        status: p.status,
        evaluationCompleteness: p.evaluationCompleteness,
        phase7: p.phase7?.status,
        phase4: p.phase4?.result.status,
        blockers: p.blockers.map((b) => `${b.kind}/${b.materiality} ${b.sourceRef}`),
        proofs: p.materiality.filter((m) => m.quarantineExclusionProof).map((m) => [m.featureId, Math.round((m.quarantineExclusionProof?.minimumEdgeDistance ?? 0) * 10) / 10]),
        warnings: p.warnings,
      };
    });
    fs.writeFileSync(process.env.E85_FULL_SNAPSHOT_REPORT, JSON.stringify(report, null, 1));
  });
});

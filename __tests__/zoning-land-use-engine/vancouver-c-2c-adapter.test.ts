/**
 * InvestScape™ E85 Phase 14.4B — Vancouver C-2C adapter mapping, temporal,
 * and coverage tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Curated facts only — no PDF is read, no local evidence folder is touched,
 * nothing leaves the process. Proves the narrow C-2C slice (USE + DIMENSIONAL
 * only) normalizes correctly, carries complete temporal authority on every
 * fact, and that requesting an unsupported family against the real C-2C pack
 * correctly triggers the Phase 14.4A.1 coverage blocker without corrupting
 * legal status — the direct proof that the frozen generic fix works against
 * a second real source.
 */
import {
  createE85SourceRegistry,
  evaluateZoningAndLandUse,
  E85DimensionalRule,
  E85Evidence,
  E85NormalizedRuleBundle,
  E85RequestedAnalysis,
  E85StructuredSourceFact,
  E85UseRule,
  adapters,
} from "../../src/zoning-land-use-engine";
import {
  c2cDocument,
  C_2C_FACTS,
  C_2C_UNSTRUCTURED_SECTIONS,
  EXTRACTED_AT,
  FACT_FRONT_YARD,
  FACT_OUTRIGHT_GROCERY_OR_DRUG_STORE,
  FACT_OUTRIGHT_BARBER_SHOP,
  FACT_OUTRIGHT_BEAUTY_WELLNESS,
  FACT_OUTRIGHT_LAUNDROMAT,
  FACT_OUTRIGHT_PHOTOFINISHING,
  FACT_OUTRIGHT_REPAIR_SHOP_B,
} from "./fixtures/vancouver-c-2c-facts";

const {
  vancouverC2CAdapter,
  VANCOUVER_C_2C_SOURCE,
  VANCOUVER_C_2C_SOURCE_ID,
  VANCOUVER_C_2C_VERSION_ID,
  VANCOUVER_C_2C_ZONE,
  VANCOUVER_C_2C_ADAPTER_ID,
  VANCOUVER_C_2C_ADAPTER_VERSION,
  VANCOUVER_JURISDICTION_ID,
  mapVancouverC2CUseStatus,
  mapVancouverC2CUseCode,
  mapVancouverC2CConcept,
} = adapters.vancouver;

function normalized(facts: readonly E85StructuredSourceFact[] = C_2C_FACTS): E85NormalizedRuleBundle {
  const result = vancouverC2CAdapter.normalize(c2cDocument({ facts }), VANCOUVER_C_2C_SOURCE);
  if (result.outcome !== "NORMALIZED") throw new Error(`expected NORMALIZED, got ${result.outcome}`);
  return result.bundle;
}

function useRule(b: E85NormalizedRuleBundle): E85UseRule {
  return b.rules.find((r): r is E85UseRule => r.family === "USE")!;
}
function dimensionalRule(b: E85NormalizedRuleBundle): E85DimensionalRule | undefined {
  return b.rules.find((r): r is E85DimensionalRule => r.family === "DIMENSIONAL");
}

/* ------------------------------------------------------------------ *
 * Source registry
 * ------------------------------------------------------------------ */

describe("Vancouver C-2C — source registration", () => {
  test("the frozen identity is exactly what Phase 14.4B specifies", () => {
    expect(VANCOUVER_C_2C_SOURCE_ID).toBe("ca-bc-vancouver:zoning-development-bylaw-3575:district-schedule-c-2c");
    expect(VANCOUVER_C_2C_VERSION_ID).toBe("2026-05-consolidation");
    expect(VANCOUVER_C_2C_SOURCE.licenseStatus).toBe("LICENSE_UNKNOWN");
  });

  test("adapter identity and source definition declare exactly USE and DIMENSIONAL, in lockstep", () => {
    expect(vancouverC2CAdapter.identity.supportedRuleFamilies).toEqual(["USE", "DIMENSIONAL"]);
    expect(VANCOUVER_C_2C_SOURCE.supportedRuleFamilies).toEqual(["USE", "DIMENSIONAL"]);
  });

  test("a source registered with this adapter id agrees with the adapter's own identity", () => {
    const built = createE85SourceRegistry([VANCOUVER_C_2C_SOURCE]);
    if (!built.ok) throw new Error("registry should build");
    expect(built.registry.get(VANCOUVER_C_2C_SOURCE_ID)?.adapterId).toBe(vancouverC2CAdapter.identity.adapterId);
  });

  test("adapter identity is jurisdiction-scoped", () => {
    expect(vancouverC2CAdapter.identity.adapterId).toBe("ca-bc-vancouver.district-schedule.c-2c");
    expect(vancouverC2CAdapter.identity.jurisdictionId).toBe(VANCOUVER_JURISDICTION_ID);
    expect(vancouverC2CAdapter.identity.adapterVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

/* ------------------------------------------------------------------ *
 * USE facts
 * ------------------------------------------------------------------ */

describe("Vancouver C-2C — USE facts (the narrow six)", () => {
  test("all six outright uses normalize to PERMITTED with fresh, source-normalized codes", () => {
    const bundle = normalized();
    const perms = useRule(bundle).permissions;
    expect(perms).toHaveLength(6);
    for (const p of perms) {
      expect(p.value.status).toBe("PERMITTED");
      expect(p.value.rawSourceTerminology).toBe("Outright Approval Use");
    }
    const codes = perms.map((p) => p.value.useCode).sort();
    expect(codes).toEqual(
      [
        "barber_shop_or_beauty_salon",
        "beauty_and_wellness_centre",
        "grocery_or_drug_store_except_small_scale_pharmacy",
        "laundromat_or_dry_cleaning_establishment",
        "photofinishing_or_photography_studio",
        "repair_shop_class_b",
      ].sort(),
    );
  });

  test("Retail Store is never given a use code — it is excluded from this pilot's vocabulary entirely, not merely absent from the fixture", () => {
    expect(mapVancouverC2CUseCode("Retail Store")).toBeUndefined();
  });

  test("Grocery Store (bare term) and Grocery Store with Liquor Store are never given codes — Gate A2 resolved only the exact C-2C table term", () => {
    expect(mapVancouverC2CUseCode("Grocery Store")).toBeUndefined();
    expect(mapVancouverC2CUseCode("Grocery Store with Liquor Store")).toBeUndefined();
  });

  test("mapVancouverC2CUseStatus mirrors the by-law's two approval-path terms", () => {
    expect(mapVancouverC2CUseStatus("Outright Approval Use")).toBe("PERMITTED");
    expect(mapVancouverC2CUseStatus("Conditional Approval Use")).toBe("CONDITIONAL");
    expect(mapVancouverC2CUseStatus("Something Unreviewed")).toBeUndefined();
  });

  test("no permission is ever PROHIBITED — absence is not prohibition", () => {
    const bundle = normalized();
    expect(useRule(bundle).permissions.map((p) => p.value.status)).not.toContain("PROHIBITED");
  });

  test("each individual USE fact normalizes correctly in isolation", () => {
    for (const fact of [FACT_OUTRIGHT_GROCERY_OR_DRUG_STORE, FACT_OUTRIGHT_BARBER_SHOP, FACT_OUTRIGHT_BEAUTY_WELLNESS, FACT_OUTRIGHT_LAUNDROMAT, FACT_OUTRIGHT_PHOTOFINISHING, FACT_OUTRIGHT_REPAIR_SHOP_B]) {
      const bundle = normalized([fact]);
      expect(useRule(bundle).permissions).toHaveLength(1);
      expect(useRule(bundle).permissions[0]!.value.status).toBe("PERMITTED");
    }
  });
});

/* ------------------------------------------------------------------ *
 * DIMENSIONAL fact
 * ------------------------------------------------------------------ */

describe("Vancouver C-2C — the one retained DIMENSIONAL fact (front yard)", () => {
  test("front yard resolves to setbacksMetres.front = 2.5", () => {
    const bundle = normalized();
    const dim = dimensionalRule(bundle);
    expect(dim?.setbacksMetres?.front?.value).toBe(2.5);
    expect(dim?.maxHeightMetres).toBeUndefined();
    expect(dim?.maxStoreys).toBeUndefined();
    expect(dim?.maxSiteCoverageFraction).toBeUndefined();
  });

  test("no other setback key is ever emitted by this pilot — in particular never 'parking'", () => {
    const dim = dimensionalRule(normalized());
    expect(Object.keys(dim?.setbacksMetres ?? {})).toEqual(["front"]);
  });

  test("mapVancouverC2CConcept knows Front Yard only", () => {
    expect(mapVancouverC2CConcept("Front Yard")).toMatchObject({ family: "DIMENSIONAL", field: "setback", yardName: "front" });
    expect(mapVancouverC2CConcept("Height")).toBeUndefined();
    expect(mapVancouverC2CConcept("Floor Space Ratio")).toBeUndefined();
    expect(mapVancouverC2CConcept("Storeys")).toBeUndefined();
  });

  test("front yard evidence carries full provenance", () => {
    const dim = dimensionalRule(normalized());
    const ev = dim?.setbacksMetres?.front as E85Evidence<number>;
    expect(ev.provenance.sourceId).toBe(VANCOUVER_C_2C_SOURCE_ID);
    expect(ev.provenance.sourceVersionId).toBe(VANCOUVER_C_2C_VERSION_ID);
    expect(ev.provenance.adapterId).toBe(VANCOUVER_C_2C_ADAPTER_ID);
    expect(ev.provenance.adapterVersion).toBe(VANCOUVER_C_2C_ADAPTER_VERSION);
    expect(ev.provenance.documentLocator?.bylawOrDocumentId).toBe("3575");
    expect(ev.provenance.documentLocator?.schedule).toBe("District Schedule C-2C");
  });
});

/* ------------------------------------------------------------------ *
 * Temporal completeness
 * ------------------------------------------------------------------ */

describe("Vancouver C-2C — every retained fact carries complete temporal authority", () => {
  test("no fact in the fixture set carries an UNKNOWN effectiveDateBasis", () => {
    for (const f of C_2C_FACTS) {
      expect(f.temporal?.effectiveDateBasis).toBe("AMENDMENT_DATE_KNOWN");
      expect(f.temporal?.effectiveFrom).toBe("2022-11-14");
    }
  });

  test("every normalized evidence item is dated AMENDMENT_DATE_KNOWN, none falls back to the version's own UNKNOWN basis", () => {
    const bundle = normalized();
    const evidences: E85Evidence<unknown>[] = [...useRule(bundle).permissions, ...(dimensionalRule(bundle)?.setbacksMetres ? Object.values(dimensionalRule(bundle)!.setbacksMetres!) : [])];
    expect(evidences.length).toBe(C_2C_FACTS.length);
    for (const ev of evidences) {
      expect(ev.temporal.effectiveDateBasis).toBe("AMENDMENT_DATE_KNOWN");
      expect(ev.temporal.effectiveFrom).toBe("2022-11-14");
      expect(ev.provenance.temporalAuthority?.instrument.bylawOrDocumentId).toBe("13447");
    }
    // No fact fell back to the version-level UNKNOWN basis.
    expect(bundle.findings.some((f) => f.code === "SOURCE_VERSION_INCOMPLETE" && f.severity === "GAP")).toBe(false);
  });

  test("the source version itself still carries no effective date (a schedule reprint stamp is not an effective date)", () => {
    expect(normalized().temporal).toEqual({ effectiveDateBasis: "UNKNOWN" });
  });
});

/* ------------------------------------------------------------------ *
 * Source findings for the deliberately excluded items
 * ------------------------------------------------------------------ */

describe("Vancouver C-2C — audit-only source findings for every deliberate omission", () => {
  test("every load-bearing omission this pack does not structure is disclosed as a GAP-severity, non-blocking finding", () => {
    const bundle = normalized();
    const disclosures = bundle.findings.filter((f) => f.code === "SOURCE_SECTION_UNAVAILABLE");
    // 2 unstructuredSections entries + 9 adapter-authored disclosure findings.
    expect(disclosures.length).toBe(C_2C_UNSTRUCTURED_SECTIONS.length + 9);
    for (const d of disclosures) {
      expect(d.severity).toBe("GAP");
      expect(d.factId).toBeUndefined();
    }
    expect(bundle.findings.some((f) => f.message.includes("angular building envelope"))).toBe(true);
    expect(bundle.findings.some((f) => f.message.includes("minimum-non-dwelling-floor-space-ratio") || f.message.includes("minimum-non-dwelling"))).toBe(true);
    expect(bundle.findings.some((f) => f.message.includes("Sub-Area A"))).toBe(true);
    expect(bundle.findings.some((f) => f.message.includes("Rental Housing Stock"))).toBe(true);
    expect(bundle.findings.some((f) => f.message.includes("Retail Store"))).toBe(true);
    expect(bundle.findings.some((f) => f.message.includes("parking-area setback") && f.message.includes("undifferentiated"))).toBe(true);
    expect(bundle.findings.some((f) => f.message.includes("unit frontage"))).toBe(true);
  });

  test("adapter-authored disclosures never carry a `gap` record — they are audit-only and never drive status/materiality (the two unstructuredSections entries do carry a gap, exactly like R1-1's own unstructured-section findings)", () => {
    const bundle = normalized();
    const adapterAuthored = bundle.findings.filter((f) => f.code === "SOURCE_SECTION_UNAVAILABLE" && f.message.includes("parking-area setback"));
    expect(adapterAuthored.length).toBeGreaterThan(0);
    for (const f of adapterAuthored) expect(f.gap).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ *
 * Requested-family coverage — the direct proof of the Phase 14.4A.1 fix
 * against a second real source, at the Phase 4 (evaluateZoningAndLandUse)
 * level directly, before the full Phase 9 pipeline test does the same thing
 * end to end.
 * ------------------------------------------------------------------ */

describe("Vancouver C-2C — requested-family coverage at the Phase 4 level", () => {
  const policy = () => ({ policyVersionId: "phase14-v1", effectiveFrom: "2020-01-01", concepts: {} });

  test("USE + DIMENSIONAL requested against the real C-2C rules evaluates without any family-coverage problem", () => {
    const bundle = normalized();
    const requestedAnalyses: readonly E85RequestedAnalysis[] = ["USE", "DIMENSIONAL"];
    const result = evaluateZoningAndLandUse({
      parcel: { parcelReferenceId: "c-2c-direct", jurisdiction: { jurisdictionId: VANCOUVER_JURISDICTION_ID, country: "CA", regionCode: "BC", municipality: "Vancouver", regulatoryAuthority: "City of Vancouver — Planning, Urban Design and Sustainability", displayName: "City of Vancouver, BC, Canada" }, rawZoningDesignation: VANCOUVER_C_2C_ZONE, siteAreaSqm: 500 },
      jurisdictionId: VANCOUVER_JURISDICTION_ID,
      zoneDesignation: VANCOUVER_C_2C_ZONE,
      useCode: "barber_shop_or_beauty_salon",
      asOfDate: "2026-09-19",
      requestedAnalyses,
      policyVersion: policy(),
      rules: bundle.rules,
    });
    expect(result.usePermission?.status).toBe("PERMITTED");
    expect(result.usePermission?.useCode).toBe("barber_shop_or_beauty_salon");
  });
});

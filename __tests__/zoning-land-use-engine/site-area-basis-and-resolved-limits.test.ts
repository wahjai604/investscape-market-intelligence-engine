/**
 * InvestScape™ E85 — site-area basis disclosure and resolved-limit (not
 * binding-constraint) envelope semantics.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 * Synthetic fixture values only; no jurisdiction's real FSR or site-area rules.
 */
import {
  assembleEnvelope,
  evaluateDensity,
  evaluateDimensional,
  E85DensityRule,
  E85DimensionalRule,
  E85ParcelReference,
  E85SiteAreaBasis,
} from "../../src/zoning-land-use-engine";

const CONFIRMED_BASIS: E85SiteAreaBasis = {
  kind: "BYLAW_DEFINED_SITE_AREA",
  deductionStatus: "NONE_APPLICABLE_CONFIRMED",
  sourceReference: "legal survey dated 2026-03-01",
};

function parcel(overrides: Partial<E85ParcelReference> = {}): E85ParcelReference {
  return { parcelReferenceId: "p1", ...overrides };
}

function fsrRule(value: number): E85DensityRule {
  return {
    family: "DENSITY",
    jurisdictionId: "jx",
    zoneDesignation: "Z1",
    maxFsr: { value, provenance: { sourceId: "src-fsr" }, temporal: { effectiveDateBasis: "SOURCE_STATED" } },
  };
}

function gfaFinding(p: E85ParcelReference, rules: E85DensityRule[] = [fsrRule(1.5)]) {
  return evaluateDensity(rules, p, "jx", "Z1", "2026-01-01", undefined).find((f) => f.field === "maxRegulatoryGfaSqm");
}

describe("site-area basis for FSR-derived regulatory GFA", () => {
  test("FSR x site area is still derived exactly when the basis is confirmed, with no warning", () => {
    const f = gfaFinding(parcel({ siteAreaSqm: 612.4, siteAreaBasis: CONFIRMED_BASIS }));
    expect(f?.outcome).toBe("RESOLVED");
    expect(f?.resolvedValue).toBe(1.5 * 612.4);
    expect(f?.warning).toBeUndefined();
    expect(f?.envelopeContribution?.derivationNote).toContain("BYLAW_DEFINED_SITE_AREA");
    expect(f?.envelopeContribution?.derivationNote).toContain("legal survey dated 2026-03-01");
  });

  test("a missing basis keeps the value (existing callers) but warns that the basis is undeclared", () => {
    const f = gfaFinding(parcel({ siteAreaSqm: 500 }));
    expect(f?.outcome).toBe("RESOLVED");
    expect(f?.resolvedValue).toBe(750);
    expect(f?.warning).toMatch(/no declared siteAreaBasis/);
    expect(f?.envelopeContribution?.derivationNote).toContain("area basis undeclared");
  });

  test.each<[string, E85SiteAreaBasis, RegExp]>([
    ["gross title area", { ...CONFIRMED_BASIS, kind: "GROSS_TITLE_AREA" }, /GROSS_TITLE_AREA, not confirmed/],
    ["net after dedications", { ...CONFIRMED_BASIS, kind: "NET_AFTER_DEDICATIONS" }, /NET_AFTER_DEDICATIONS, not confirmed/],
    ["unspecified kind", { ...CONFIRMED_BASIS, kind: "UNSPECIFIED" }, /UNSPECIFIED/],
    ["pending dedication", { ...CONFIRMED_BASIS, deductionStatus: "POSSIBLE_OR_PENDING" }, /POSSIBLE_OR_PENDING/],
    ["unknown deductions", { ...CONFIRMED_BASIS, deductionStatus: "UNKNOWN" }, /deduction status is UNKNOWN/],
    ["no source reference", { kind: "BYLAW_DEFINED_SITE_AREA", deductionStatus: "ALREADY_REFLECTED" }, /no source reference/],
    ["blank source reference", { ...CONFIRMED_BASIS, sourceReference: "  " }, /no source reference/],
  ])("an ambiguous basis (%s) warns and never silently picks gross or net", (_label, basis, pattern) => {
    const f = gfaFinding(parcel({ siteAreaSqm: 400, siteAreaBasis: basis }));
    expect(f?.outcome).toBe("RESOLVED");
    expect(f?.resolvedValue).toBe(600); // value is not adjusted toward any assumed basis
    expect(f?.warning).toMatch(pattern);
  });

  test("ALREADY_REFLECTED deductions with a by-law-defined area and a source is clean", () => {
    const f = gfaFinding(parcel({ siteAreaSqm: 400, siteAreaBasis: { ...CONFIRMED_BASIS, deductionStatus: "ALREADY_REFLECTED" } }));
    expect(f?.warning).toBeUndefined();
  });

  test("a missing site area is still a REQUIRED_SITE_DIMENSION_MISSING gap, even with a basis declared", () => {
    const f = gfaFinding(parcel({ siteAreaBasis: CONFIRMED_BASIS }));
    expect(f?.outcome).toBe("GAP");
    expect(f?.gap?.reasonCode).toBe("REQUIRED_SITE_DIMENSION_MISSING");
    expect(f?.resolvedValue).toBeUndefined();
  });

  test("an explicit GFA cap is independent of site area and its basis, and is never min()'d with the FSR figure", () => {
    const rule: E85DensityRule = {
      ...fsrRule(1.0),
      explicitMaxGfaSqm: { value: 300, provenance: { sourceId: "src-cap" }, temporal: { effectiveDateBasis: "SOURCE_STATED" } },
    };
    const findings = evaluateDensity([rule], parcel({ siteAreaSqm: 500 }), "jx", "Z1", "2026-01-01", undefined);
    const derived = findings.find((f) => f.field === "maxRegulatoryGfaSqm");
    const cap = findings.find((f) => f.field === "explicitMaxGfaSqm");
    expect(derived?.resolvedValue).toBe(500);
    expect(cap?.resolvedValue).toBe(300);
    expect(cap?.warning ?? "").not.toMatch(/siteAreaBasis/);
    expect(cap?.envelopeContribution?.field).not.toBe("maxRegulatoryGfaSqm");
  });
});

describe("envelope reports resolved limits, not binding constraints", () => {
  const dimensionalRule: E85DimensionalRule = {
    family: "DIMENSIONAL",
    jurisdictionId: "jx",
    zoneDesignation: "Z1",
    maxHeightMetres: { value: 10.7, provenance: { sourceId: "src-h" }, temporal: { effectiveDateBasis: "SOURCE_STATED" } },
    maxSiteCoverageFraction: { value: 0.4, provenance: { sourceId: "src-c" }, temporal: { effectiveDateBasis: "SOURCE_STATED" } },
    setbacksMetres: { front: { value: 6.1, provenance: { sourceId: "src-s" }, temporal: { effectiveDateBasis: "SOURCE_STATED" } } },
  };

  function envelopeFor(p: E85ParcelReference) {
    const findings = [
      ...evaluateDensity([fsrRule(1.5)], p, "jx", "Z1", "2026-01-01", undefined),
      ...evaluateDimensional([dimensionalRule], p, "jx", "Z1", "2026-01-01"),
    ];
    return assembleEnvelope("jx", "Z1", findings, []);
  }

  test("no resolved limit is asserted to be binding", () => {
    const result = envelopeFor(parcel({ siteAreaSqm: 500, siteAreaBasis: CONFIRMED_BASIS }));
    expect(result.bindingConstraints).toEqual([]);
  });

  test("every separately resolved limit is listed in resolvedLimits with its evidence", () => {
    const result = envelopeFor(parcel({ siteAreaSqm: 500, siteAreaBasis: CONFIRMED_BASIS }));
    const fields = result.resolvedLimits.map((l) => l.field).sort();
    expect(fields).toEqual(["maxHeightMetres", "maxRegulatoryGfaSqm", "maxSiteCoverageFraction", "setbacksMetres"]);
    expect(result.resolvedLimits.find((l) => l.field === "setbacksMetres")?.note).toBe("Yard: front");
    expect(result.resolvedLimits.find((l) => l.field === "maxRegulatoryGfaSqm")?.evidence.value).toBe(750);
  });

  test("practical capacity is explicitly NOT_ASSESSED, and the GFA is described as a legal ceiling only", () => {
    const result = envelopeFor(parcel({ siteAreaSqm: 500, siteAreaBasis: CONFIRMED_BASIS }));
    expect(result.practicalCapacity.status).toBe("NOT_ASSESSED");
    expect(result.practicalCapacity.reason).toMatch(/legal ceiling, not practical capacity/);
    expect(result.resolvedLimits.find((l) => l.field === "maxRegulatoryGfaSqm")?.note).toMatch(/legal FSR ceiling only/);
  });

  test("E85 does not reduce the FSR ceiling by height, coverage or setbacks", () => {
    const result = envelopeFor(parcel({ siteAreaSqm: 500, siteAreaBasis: CONFIRMED_BASIS }));
    expect(result.envelope.maxRegulatoryGfaSqm?.value).toBe(750);
    expect(Object.keys(result.envelope).sort()).toEqual(
      ["jurisdictionId", "maxHeightMetres", "maxRegulatoryGfaSqm", "maxSiteCoverageFraction", "setbacksMetres", "zoneDesignation"],
    );
  });

  test("an empty envelope still states that practical capacity was not assessed", () => {
    const result = assembleEnvelope("jx", "Z1", [], []);
    expect(result.resolvedLimits).toEqual([]);
    expect(result.bindingConstraints).toEqual([]);
    expect(result.practicalCapacity.status).toBe("NOT_ASSESSED");
  });
});

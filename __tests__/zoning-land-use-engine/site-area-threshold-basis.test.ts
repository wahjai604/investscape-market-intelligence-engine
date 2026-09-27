/**
 * InvestScape™ E85 — site-area basis for regulatory site-area thresholds.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 * Synthetic rule shaped like Vancouver C-2C §3.1.1.2 (FSR 3.70 where site
 * area ≥ 1,672 m²); it is not the C-2C adapter's published output.
 */
import {
  buildE85ApplicabilityContext,
  e85ThresholdSiteArea,
  evaluateDensity,
  E85DensityRule,
  E85Evidence,
  E85ParcelReference,
  E85SiteAreaBasis,
} from "../../src/zoning-land-use-engine";

const J = "jx";
const Z = "C-2C-like";
const THRESHOLD = 1672;

const CONFIRMED: E85SiteAreaBasis = {
  kind: "BYLAW_DEFINED_SITE_AREA",
  deductionStatus: "NONE_APPLICABLE_CONFIRMED",
  sourceReference: "legal survey dated 2026-03-01",
};

function fsr(value: number, siteAreaMin?: number): E85Evidence<number> {
  return {
    value,
    provenance: { sourceId: "src-fsr" },
    temporal: { effectiveDateBasis: "SOURCE_STATED" },
    ...(siteAreaMin === undefined ? {} : { applicability: { siteAreaSqm: { min: siteAreaMin } } }),
  };
}

const cornerFsrRule: E85DensityRule = { family: "DENSITY", jurisdictionId: J, zoneDesignation: Z, maxFsr: fsr(3.7, THRESHOLD) };

function parcel(siteAreaSqm: number, siteAreaBasis?: E85SiteAreaBasis): E85ParcelReference {
  return { parcelReferenceId: "p1", siteAreaSqm, ...(siteAreaBasis === undefined ? {} : { siteAreaBasis }) };
}

function fsrFinding(p: E85ParcelReference) {
  return evaluateDensity([cornerFsrRule], p, J, Z, "2026-09-26", undefined).find((f) => f.field === "maxFsr");
}

describe("site-area thresholds require an established site-area basis", () => {
  test.each([THRESHOLD + 500, THRESHOLD - 500])("missing basis (%d m²): the threshold is neither met nor failed — a site-dimension DATA_GAP", (area) => {
    const f = fsrFinding(parcel(area));
    expect(f?.outcome).toBe("GAP");
    expect(f?.gap?.reasonCode).toBe("REQUIRED_SITE_DIMENSION_MISSING");
    expect(f?.gap?.reason).toMatch(/no siteAreaBasis was declared/);
    expect(f?.gap?.reason).toContain(`parcel.siteAreaSqm (${area})`);
    expect(f?.resolvedValue).toBeUndefined();
  });

  test("a caller assertion with a source, but not of the by-law-defined basis, does not establish the threshold", () => {
    const f = fsrFinding(parcel(2000, { ...CONFIRMED, kind: "GROSS_TITLE_AREA", sourceReference: "BC Land Title plan EPP12345" }));
    expect(f?.outcome).toBe("GAP");
    expect(f?.gap?.reason).toMatch(/GROSS_TITLE_AREA, not confirmed as the by-law-defined site area/);
    expect(f?.gap?.resolutionHint).toMatch(/by-law-defined site area with resolved deductions and a source reference/);
  });

  test("unresolved dedications keep a by-law-defined area from establishing the threshold", () => {
    for (const deductionStatus of ["POSSIBLE_OR_PENDING", "UNKNOWN"] as const) {
      const f = fsrFinding(parcel(2000, { ...CONFIRMED, deductionStatus }));
      expect(f?.outcome).toBe("GAP");
      expect(f?.gap?.reason).toContain(`dedication/deduction status is ${deductionStatus}`);
    }
  });

  test("a by-law-defined basis with no source reference does not establish the threshold", () => {
    const f = fsrFinding(parcel(2000, { kind: "BYLAW_DEFINED_SITE_AREA", deductionStatus: "ALREADY_REFLECTED" }));
    expect(f?.outcome).toBe("GAP");
    expect(f?.gap?.reason).toMatch(/no source reference/);
  });

  test("a confirmed by-law-defined basis decides the threshold exactly, inclusive at 1,672 m²", () => {
    const met = fsrFinding(parcel(THRESHOLD, CONFIRMED));
    expect(met?.outcome).toBe("RESOLVED");
    expect(met?.resolvedValue).toBe(3.7);

    const reflected = fsrFinding(parcel(THRESHOLD, { ...CONFIRMED, deductionStatus: "ALREADY_REFLECTED" }));
    expect(reflected?.outcome).toBe("RESOLVED");

    const unmet = fsrFinding(parcel(THRESHOLD - 0.1, CONFIRMED));
    expect(unmet?.outcome).toBe("NO_RULE_FOR_PROPOSAL_SCOPE");
    expect(unmet?.resolvedValue).toBeUndefined();
    expect(unmet?.gap).toBeUndefined();
  });

  test("the GFA derivation and its basis warning are unchanged for an unscoped FSR", () => {
    const unscoped: E85DensityRule = { family: "DENSITY", jurisdictionId: J, zoneDesignation: Z, maxFsr: fsr(1.5) };
    const gfa = evaluateDensity([unscoped], parcel(500), J, Z, "2026-09-26", undefined).find((f) => f.field === "maxRegulatoryGfaSqm");
    expect(gfa?.outcome).toBe("RESOLVED");
    expect(gfa?.resolvedValue).toBe(750);
    expect(gfa?.warning).toMatch(/no declared siteAreaBasis/);
  });

  test("the applicability context carries only an established site area, and explains a withheld one", () => {
    expect(e85ThresholdSiteArea(parcel(2000, CONFIRMED))).toEqual({ siteAreaSqm: 2000 });
    expect(e85ThresholdSiteArea({ parcelReferenceId: "p1" })).toEqual({});
    const withheld = buildE85ApplicabilityContext({ rules: [], jurisdictionId: J, zoneDesignation: Z, useCode: "retail", parcel: parcel(2000) });
    expect(withheld.siteAreaSqm).toBeUndefined();
    expect(withheld.siteAreaBasisIssue).toMatch(/cannot show a legal site-area threshold is met or unmet/);
  });
});

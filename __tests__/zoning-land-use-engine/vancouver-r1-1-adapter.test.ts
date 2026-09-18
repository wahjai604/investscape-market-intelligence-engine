/**
 * InvestScape™ E85 Phase 5 / Phase 12B.2 — Vancouver R1-1 adapter mapping,
 * scope and provenance tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Curated facts only — no PDF is read, no local evidence folder is touched,
 * nothing leaves the process. Phase 12B.2 rewrote the value assertions for the
 * corrected fact set: R1-1 states density and dimensions per legal scope (§3.1
 * multiple dwelling, §3.2 other uses), and the adapter must preserve that scope
 * as structured applicability rather than collapse it into zone-wide values.
 */
import {
  canonicalE85ApplicabilityKey,
  createE85SourceRegistry,
  E85DensityRule,
  E85DimensionalRule,
  E85Evidence,
  E85UseRule,
  E85NormalizedRuleBundle,
  E85StructuredSourceFact,
  adapters,
} from "../../src/zoning-land-use-engine";
import {
  r11Document,
  EXTRACTED_AT,
  R1_1_FACTS,
  R1_1_RETIRED_FACT_IDS,
  FACT_HEIGHT_OTHER_USES,
  FACT_SITE_COVERAGE_OTHER_USES_PERCENT,
  FACT_FSR_MULTIPLE_DWELLING,
} from "./fixtures/vancouver-r1-1-facts";

const { vancouverR11Adapter, VANCOUVER_R1_1_SOURCE, VANCOUVER_R1_1_SOURCE_ID, VANCOUVER_R1_1_VERSION_ID, VANCOUVER_R1_1_ADAPTER_ID, VANCOUVER_R1_1_ADAPTER_VERSION } = adapters.vancouver;
const { mapVancouverUseStatus, mapVancouverConcept, mapVancouverUseCode, vancouverKnownUseStatusTerms } = adapters.vancouver;

const MD = "use=multiple_dwelling;dwellingUnits=..8";
const REAR_MD = "use=multiple_dwelling;dwellingUnits=..8;role=rear_building";
const OTHER_MD_BUILDING = "use=multiple_dwelling;dwellingUnits=..8;notRole=rear_building";
const OTHER_USES = "notUse=multiple_dwelling";
const DUPLEX = "use=duplex|duplex_with_secondary_suite";
const OTHER_FSR_USES = "notUse=duplex|duplex_with_secondary_suite|multiple_dwelling";

function normalized(facts: readonly E85StructuredSourceFact[] = R1_1_FACTS): E85NormalizedRuleBundle {
  const result = vancouverR11Adapter.normalize(r11Document({ facts }), VANCOUVER_R1_1_SOURCE);
  if (result.outcome !== "NORMALIZED") throw new Error(`expected NORMALIZED, got ${result.outcome}`);
  return result.bundle;
}

function useRule(b: E85NormalizedRuleBundle): E85UseRule {
  return b.rules.find((r): r is E85UseRule => r.family === "USE")!;
}
function densityRules(b: E85NormalizedRuleBundle): E85DensityRule[] {
  return b.rules.filter((r): r is E85DensityRule => r.family === "DENSITY");
}
function dimensionalRules(b: E85NormalizedRuleBundle): E85DimensionalRule[] {
  return b.rules.filter((r): r is E85DimensionalRule => r.family === "DIMENSIONAL");
}

type DimField = "maxHeightMetres" | "maxStoreys" | "maxSiteCoverageFraction";
function dim(b: E85NormalizedRuleBundle, field: DimField, scope: string): E85Evidence<number>[] {
  return dimensionalRules(b)
    .map((r) => r[field])
    .filter((e): e is E85Evidence<number> => e !== undefined && canonicalE85ApplicabilityKey(e.applicability) === scope);
}
function front(b: E85NormalizedRuleBundle, scope: string): E85Evidence<number>[] {
  return dimensionalRules(b)
    .map((r) => r.setbacksMetres?.front)
    .filter((e): e is E85Evidence<number> => e !== undefined && canonicalE85ApplicabilityKey(e.applicability) === scope);
}
function fsr(b: E85NormalizedRuleBundle, scope: string): E85Evidence<number>[] {
  return densityRules(b)
    .map((r) => r.maxFsr)
    .filter((e): e is E85Evidence<number> => e !== undefined && canonicalE85ApplicabilityKey(e.applicability) === scope);
}

describe("Vancouver R1-1 — use terminology (Phase 12B.2 remediation)", () => {
  test("Single Detached House is the authoritative outright use, with its own code", () => {
    expect(mapVancouverUseStatus("Outright Approval Use")).toBe("PERMITTED");
    expect(mapVancouverUseCode("Single Detached House")).toBe("single_detached_house");
    const p = useRule(normalized()).permissions.find((e) => e.value.useCode === "single_detached_house");
    expect(p?.value.status).toBe("PERMITTED");
    expect(p?.applicability).toBeUndefined();
  });

  test("no R1-1 fact or permission claims One-Family Dwelling", () => {
    expect(R1_1_FACTS.some((f) => f.sourceUseTerm === "One-Family Dwelling")).toBe(false);
    expect(useRule(normalized()).permissions.some((e) => e.value.useCode === "one_family_dwelling")).toBe(false);
    // The vocabulary entry is retained, not redefined and not aliased.
    expect(mapVancouverUseCode("One-Family Dwelling")).toBe("one_family_dwelling");
  });

  test("Multiple Dwelling is CONDITIONAL only within its machine-evaluable ≤8-unit scope", () => {
    const p = useRule(normalized()).permissions.find((e) => e.value.useCode === "multiple_dwelling");
    expect(p?.value.status).toBe("CONDITIONAL");
    expect(p?.value.approvalAuthority).toBe("Director of Planning");
    expect(p?.applicability?.dwellingUnits).toEqual({ max: 8 });
    expect(canonicalE85ApplicabilityKey(p?.applicability)).toBe("dwellingUnits=..8");
    expect(p?.applicability?.locators?.dwellingUnits?.row).toBe("Multiple Dwelling, containing no more than 8 dwelling units");
  });

  test("duplex rows are present so the duplex density scope names recognized uses", () => {
    const perms = useRule(normalized()).permissions;
    expect(perms.find((e) => e.value.useCode === "duplex")?.value.status).toBe("PERMITTED");
    expect(perms.find((e) => e.value.useCode === "duplex_with_secondary_suite")?.value.status).toBe("CONDITIONAL");
  });

  test("the source's exact wording is preserved alongside the normalized status", () => {
    const perms = useRule(normalized()).permissions;
    expect([...new Set(perms.map((p) => p.value.rawSourceTerminology))].sort()).toEqual(["Conditional Approval Use", "Outright Approval Use"]);
  });

  test("absence from the use table never becomes PROHIBITED", () => {
    const bundle = normalized();
    expect(useRule(bundle).permissions.map((p) => p.value.status)).not.toContain("PROHIBITED");
    expect(vancouverKnownUseStatusTerms().map((t) => mapVancouverUseStatus(t))).not.toContain("PROHIBITED");
    expect(useRule(bundle).permissions.some((p) => p.value.useCode === "laneway_house")).toBe(false);
  });

  test("no retired fact id survives in the corrected set", () => {
    const ids = R1_1_FACTS.map((f) => f.factId);
    for (const retired of R1_1_RETIRED_FACT_IDS) expect(ids).not.toContain(retired);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("Vancouver R1-1 — density is scoped, never zone-wide", () => {
  test("no unscoped FSR is emitted anywhere", () => {
    const all = densityRules(normalized()).map((r) => r.maxFsr).filter((e): e is E85Evidence<number> => e !== undefined);
    expect(all).toHaveLength(3);
    for (const ev of all) expect(canonicalE85ApplicabilityKey(ev.applicability)).not.toBe("");
  });

  test("§3.1 multiple dwelling (≤8 units): FSR 1.00, provenance at §3.1.1.2", () => {
    const [ev] = fsr(normalized(), MD);
    expect(ev.value).toBe(1.0);
    expect(ev.provenance.documentLocator?.section).toBe("3.1.1.2");
    expect(ev.applicability?.locators?.useCodes).toEqual({ section: "3.1", page: 8 });
    expect(mapVancouverConcept("Floor Space Ratio")).toMatchObject({ family: "DENSITY", field: "maxFsr" });
  });

  test("§3.2 duplex and duplex with secondary suite: FSR 0.70", () => {
    const [ev] = fsr(normalized(), DUPLEX);
    expect(ev.value).toBe(0.7);
    expect(ev.provenance.documentLocator?.section).toBe("3.2.1.1");
  });

  test("§3.2 other uses: FSR 0.60, excluding multiple dwelling and both duplex forms", () => {
    const [ev] = fsr(normalized(), OTHER_FSR_USES);
    expect(ev.value).toBe(0.6);
  });

  test("§3.1.1.3 unit caps are separate propositions: 8 for 100% rental, 6 otherwise", () => {
    const caps = densityRules(normalized())
      .map((r) => r.maxDwellingUnits)
      .filter((e): e is E85Evidence<number> => e !== undefined);
    const byKey = Object.fromEntries(caps.map((e) => [canonicalE85ApplicabilityKey(e.applicability), e]));
    expect(byKey[`${MD};tenure=residential_rental_tenure_100_percent`]?.value).toBe(8);
    expect(byKey[`${MD};notTenure=residential_rental_tenure_100_percent`]?.value).toBe(6);
    expect(byKey[`${MD};tenure=residential_rental_tenure_100_percent`]?.provenance.documentLocator?.clause).toBe("(a)");
    // The cap is not derived from the ≤8 use-scope qualifier: they carry different locators.
    expect(byKey[`${MD};tenure=residential_rental_tenure_100_percent`]?.applicability?.locators?.tenureCodes?.section).toBe("3.1.1.3");
  });

  test("the §3.1.1.3(b)(ii) obligation is a REQUIREMENT rule — never an amenity or density value — and is no longer a coverage gap", () => {
    const bundle = normalized();
    expect(bundle.rules.some((r) => r.family === "AMENITY")).toBe(false);
    expect(JSON.stringify(densityRules(bundle))).not.toMatch(/social|cash/i);
    expect(bundle.rules.filter((r) => r.family === "REQUIREMENT")).toHaveLength(1);
    expect(bundle.findings.some((f) => f.code === "SOURCE_SECTION_UNAVAILABLE" && /3\.1\.1\.3\(b\)\(ii\)/.test(f.message))).toBe(false);
    expect(bundle.findings.find((f) => f.code === "SOURCE_SECTION_UNAVAILABLE" && /3\.1\.1\.4/.test(f.message))?.severity).toBe("GAP");
  });
});

describe("Vancouver R1-1 — dimensional rules keep their legal scopes", () => {
  test("rear buildings of a multiple dwelling: 8.5 m AND 2 storeys, one provision, one scope", () => {
    const bundle = normalized();
    const [h] = dim(bundle, "maxHeightMetres", REAR_MD);
    const [s] = dim(bundle, "maxStoreys", REAR_MD);
    expect(h.value).toBe(8.5);
    expect(s.value).toBe(2);
    expect(h.provenance.documentLocator).toMatchObject({ section: "3.1.2.5", clause: "(a)", page: 9 });
    expect(s.provenance.documentLocator).toMatchObject({ section: "3.1.2.5", clause: "(a)", page: 9 });
    // Linked by structure: both limits sit in the same rule record.
    expect(dimensionalRules(bundle).some((r) => r.maxHeightMetres === h && r.maxStoreys === s)).toBe(true);
  });

  test("other buildings of a multiple dwelling: 11.5 m and 3 storeys at §3.1.2.5(b)", () => {
    const bundle = normalized();
    expect(dim(bundle, "maxHeightMetres", OTHER_MD_BUILDING)[0].value).toBe(11.5);
    expect(dim(bundle, "maxStoreys", OTHER_MD_BUILDING)[0].value).toBe(3);
    expect(dim(bundle, "maxHeightMetres", OTHER_MD_BUILDING)[0].provenance.documentLocator?.clause).toBe("(b)");
  });

  test("§3.2 height is 11.5 m, and no fact claims the wrong §3.2.2.3 locator for 8.5 m", () => {
    const bundle = normalized();
    const [h] = dim(bundle, "maxHeightMetres", OTHER_USES);
    expect(h.value).toBe(11.5);
    expect(h.provenance.documentLocator).toMatchObject({ section: "3.2.2.3", page: 12 });
    expect(R1_1_FACTS.some((f) => f.numericValue === 8.5 && f.locator.section === "3.2.2.3")).toBe(false);
  });

  test("§3.2 maximum storeys are WITHHELD and the partial-third-storey section is a declared gap", () => {
    const bundle = normalized();
    expect(dim(bundle, "maxStoreys", OTHER_USES)).toEqual([]);
    const gap = bundle.findings.find((f) => f.code === "SOURCE_SECTION_UNAVAILABLE" && /3\.2\.2\.10/.test(f.message));
    expect(gap?.severity).toBe("GAP");
  });

  test("front yard is stated twice under separate provisions, not merged because the numbers agree", () => {
    const bundle = normalized();
    expect(front(bundle, MD).map((e) => [e.value, e.provenance.documentLocator?.section])).toEqual([[4.9, "3.1.2.6"]]);
    expect(front(bundle, OTHER_USES).map((e) => [e.value, e.provenance.documentLocator?.section])).toEqual([[4.9, "3.2.2.4"]]);
  });

  test("site coverage exists only for §3.2 uses; no §3.1 coverage limit is invented", () => {
    const bundle = normalized();
    const coverage = dimensionalRules(bundle).map((r) => r.maxSiteCoverageFraction).filter((e): e is E85Evidence<number> => e !== undefined);
    expect(coverage).toHaveLength(1);
    expect(canonicalE85ApplicabilityKey(coverage[0].applicability)).toBe(OTHER_USES);
    expect(coverage[0].value).toBe(0.5);
  });

  test("site coverage stated as a percentage is converted to a fraction, and the conversion is declared", () => {
    const bundle = normalized();
    const finding = bundle.findings.find((f) => f.factId === FACT_SITE_COVERAGE_OTHER_USES_PERCENT.factId);
    expect(finding?.code).toBe("TERM_MAPPED_BY_JURISDICTION_POLICY");
    expect(dim(bundle, "maxSiteCoverageFraction", OTHER_USES)[0].provenance.interpretationNote).toMatch(/divided by 100/i);
  });

  test("site coverage already stated as a fraction passes through with no policy note", () => {
    const bundle = normalized([{ ...FACT_SITE_COVERAGE_OTHER_USES_PERCENT, numericValue: 0.5, unit: "FRACTION" }]);
    expect(dim(bundle, "maxSiteCoverageFraction", OTHER_USES)[0].value).toBe(0.5);
    expect(bundle.findings.find((f) => f.factId === FACT_SITE_COVERAGE_OTHER_USES_PERCENT.factId)?.code).toBe("TERM_MAPPED_EXACT");
  });
});

describe("Vancouver R1-1 — a scope the adapter cannot map or source is refused, never widened", () => {
  test("an unmapped scope term makes the fact unresolved and emits no rule", () => {
    const bundle = normalized([{ ...FACT_HEIGHT_OTHER_USES, factId: "bad-scope", applicability: { excludedUseTerms: ["Unreviewed Use"], locators: { excludedUseCodes: { section: "3.2" } } } }]);
    expect(bundle.rules).toEqual([]);
    const f = bundle.findings.find((x) => x.factId === "bad-scope");
    expect(f?.code).toBe("UNSUPPORTED_SOURCE_CONCEPT");
    expect(f?.gap?.reasonCode).toBe("USE_CLASSIFICATION_UNKNOWN");
    expect(f?.message).toMatch(/widen the rule/i);
  });

  test("a scope dimension with no source locator is refused", () => {
    const bundle = normalized([{ ...FACT_FSR_MULTIPLE_DWELLING, factId: "unsourced", applicability: { useTerms: ["Multiple Dwelling, containing no more than 8 dwelling units"], dwellingUnits: { max: 8 } } }]);
    expect(bundle.rules).toEqual([]);
    const f = bundle.findings.find((x) => x.factId === "unsourced");
    expect(f?.code).toBe("MISSING_REQUIRED_VALUE");
    expect(f?.message).toMatch(/source-free scope/i);
  });

  test("an invalid scope (reserved character) is refused deterministically", () => {
    const bundle = normalized([{ ...FACT_HEIGHT_OTHER_USES, factId: "reserved", applicability: { conditionIds: ["a;b"], locators: { requiredConditionIds: { section: "x" } } } }]);
    expect(bundle.rules).toEqual([]);
    expect(bundle.findings.find((x) => x.factId === "reserved")?.code).toBe("AMBIGUOUS_SOURCE_INTERPRETATION");
  });
});

describe("Vancouver R1-1 — caller-affirmed conditions still never apply themselves", () => {
  test("a condition-dependent fact is held out of the unconditional rule set", () => {
    const bundle = normalized([{ ...FACT_HEIGHT_OTHER_USES, factId: "conditional-1", numericValue: 9.9, condition: "a hypothetical condition" }]);
    expect(bundle.rules).toEqual([]);
    expect(bundle.conditionalRules.map((c) => c.condition)).toEqual(["a hypothetical condition"]);
    expect(bundle.findings.find((f) => f.code === "CONDITION_PRESERVED")?.message).toMatch(/only if a caller affirms/i);
    expect(bundle.qualification.ruleApplicability).toBe("moderate");
  });

  test("the corrected R1-1 extract carries no caller-affirmed condition at all", () => {
    const bundle = normalized();
    expect(bundle.conditionalRules).toEqual([]);
    expect(bundle.qualification).toEqual({ evidenceQuality: "high", ruleApplicability: "high" });
  });
});

describe("Vancouver R1-1 — provenance preservation", () => {
  test("the table and row locator survive for tabular use facts", () => {
    const p = useRule(normalized()).permissions.find((e) => e.value.useCode === "single_detached_house");
    expect(p?.provenance.documentLocator).toMatchObject({ section: "2.1", table: "2.1 Outright and Conditional Approval Uses", row: "Single Detached House", page: 3 });
  });

  test("source id, by-law number, schedule, version and adapter survive on every value", () => {
    const bundle = normalized();
    const evidences: E85Evidence<unknown>[] = [
      ...useRule(bundle).permissions,
      ...densityRules(bundle).flatMap((r) => [r.maxFsr, r.maxDwellingUnits].filter((e): e is E85Evidence<number> => e !== undefined)),
      ...dimensionalRules(bundle).flatMap((r) => [r.maxHeightMetres, r.maxStoreys, r.maxSiteCoverageFraction, r.setbacksMetres?.front].filter((e): e is E85Evidence<number> => e !== undefined)),
      ...bundle.rules.flatMap((r) => (r.family === "REQUIREMENT" ? r.requirements.map((i) => i.requirement) : [])),
    ];
    expect(evidences.length).toBe(R1_1_FACTS.length);
    for (const ev of evidences) {
      expect(ev.provenance).toMatchObject({ sourceId: VANCOUVER_R1_1_SOURCE_ID, sourceVersionId: VANCOUVER_R1_1_VERSION_ID, adapterId: VANCOUVER_R1_1_ADAPTER_ID, adapterVersion: VANCOUVER_R1_1_ADAPTER_VERSION });
      expect(ev.provenance.documentLocator).toMatchObject({ bylawOrDocumentId: "3575", schedule: "District Schedule R1-1" });
    }
  });

  test("every scoped value carries a source locator for every scope dimension it states", () => {
    const bundle = normalized();
    for (const r of densityRules(bundle)) {
      for (const ev of [r.maxFsr, r.maxDwellingUnits].filter((e): e is E85Evidence<number> => e !== undefined)) {
        const a = ev.applicability!;
        for (const d of ["useCodes", "excludedUseCodes", "dwellingUnits", "tenureCodes", "excludedTenureCodes"] as const) {
          if (a[d] !== undefined) expect(a.locators?.[d]).toBeDefined();
        }
      }
    }
  });

  test("no effective date is asserted, because the source states none — on the bundle or on any value", () => {
    const bundle = normalized();
    expect(bundle.temporal).toEqual({ effectiveDateBasis: "UNKNOWN" });
    expect(JSON.stringify(bundle.rules)).not.toMatch(/effectiveFrom|effectiveTo/);
  });

  test("the publication stamp is recorded at the precision the source prints, and says it is a publication stamp", () => {
    const note = fsr(normalized(), MD)[0].provenance.effectiveDateBasisNote;
    expect(note).toMatch(/2026-06/);
    expect(note).toMatch(/MONTH precision/i);
    expect(note).toMatch(/not a statement of when the provisions took legal effect/i);
    expect(note).not.toMatch(/2026-06-\d{2}/);
  });

  test("retrievedAt reflects the extraction, and normalizedAt the normalization run", () => {
    const bundle = normalized();
    expect(fsr(bundle, MD)[0].provenance.retrievedAt).toBe(EXTRACTED_AT);
    expect(bundle.normalizedAt).toBe(EXTRACTED_AT);
    const later = vancouverR11Adapter.normalize(r11Document(), VANCOUVER_R1_1_SOURCE, { normalizedAt: "2026-09-13T12:00:00.000Z" });
    if (later.outcome !== "NORMALIZED") throw new Error("expected NORMALIZED");
    expect(later.bundle.normalizedAt).toBe("2026-09-13T12:00:00.000Z");
  });

  test('a reviewer can answer "where exactly did this value come from, and for which proposals?" from one evidence item', () => {
    expect(fsr(normalized(), MD)[0]).toMatchObject({
      value: 1.0,
      provenance: {
        sourceId: VANCOUVER_R1_1_SOURCE_ID,
        sourceVersionId: VANCOUVER_R1_1_VERSION_ID,
        adapterId: VANCOUVER_R1_1_ADAPTER_ID,
        adapterVersion: VANCOUVER_R1_1_ADAPTER_VERSION,
        zoneDesignation: "R1-1",
        documentLocator: { bylawOrDocumentId: "3575", schedule: "District Schedule R1-1", section: "3.1.1.2", page: 8 },
      },
      applicability: { useCodes: ["multiple_dwelling"], dwellingUnits: { max: 8 } },
      temporal: { effectiveDateBasis: "UNKNOWN" },
    });
  });
});

describe("Vancouver R1-1 — bundle-level reporting", () => {
  test("readiness reports the licence blocker AND the declared structure gaps", () => {
    const bundle = normalized();
    expect(bundle.readiness.versionSupport).toBe("REGISTERED");
    expect(bundle.readiness.zoneScope).toBe("IN_SCOPE");
    expect(bundle.readiness.structureSupport).toBe("SECTION_NOT_STRUCTURED");
    expect(bundle.readiness.accessStatus).toBe("AVAILABLE");
    expect(bundle.readiness.overall).toBe("BLOCKED");
    expect([...bundle.readiness.blockers].sort()).toEqual(["LICENSE", "STRUCTURE"]);
  });

  test("a licence limitation does not stop the adapter normalizing or strip provenance", () => {
    const bundle = normalized();
    expect(fsr(bundle, MD)[0].value).toBe(1.0);
    expect(useRule(bundle).permissions.length).toBe(4);
    expect(fsr(bundle, MD)[0].provenance.sourceId).toBe(VANCOUVER_R1_1_SOURCE_ID);
  });

  test("bundle qualification has no parcelMatch axis, because no parcel exists at adaptation time", () => {
    expect(Object.keys(normalized().qualification).sort()).toEqual(["evidenceQuality", "ruleApplicability"]);
  });

  test("every input fact is accounted for, either as a rule or as a finding", () => {
    const bundle = normalized();
    const mentioned = new Set(bundle.findings.map((f) => f.factId).filter((x): x is string => x !== undefined));
    for (const f of R1_1_FACTS) expect(mentioned.has(f.factId)).toBe(true);
    expect(bundle.unresolvedSourceItems).toEqual([]);
  });

  test("a source registered with this adapter id agrees with the adapter's own identity", () => {
    const built = createE85SourceRegistry([VANCOUVER_R1_1_SOURCE]);
    if (!built.ok) throw new Error("registry should build");
    expect(built.registry.get(VANCOUVER_R1_1_SOURCE_ID)?.adapterId).toBe(vancouverR11Adapter.identity.adapterId);
  });

  test("adapter identity is jurisdiction-scoped, not merely the engine number", () => {
    expect(vancouverR11Adapter.identity.adapterId).toBe("ca-bc-vancouver.district-schedule.r1-1");
    expect(vancouverR11Adapter.identity.adapterVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

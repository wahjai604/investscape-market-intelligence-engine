/**
 * InvestScape™ E85 Phase 5 — Vancouver R1-1 adapter mapping & provenance tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 *
 * Curated facts only — no PDF is read, no local evidence folder is touched,
 * nothing leaves the process.
 */
import {
  createE85SourceRegistry,
  E85DensityRule,
  E85DimensionalRule,
  E85UseRule,
  E85NormalizedRuleBundle,
  adapters,
} from "../../src/zoning-land-use-engine";
import { r11Document, EXTRACTED_AT, REAR_BUILDING_CONDITION, FACT_HEIGHT, FACT_SITE_COVERAGE_PERCENT } from "./fixtures/vancouver-r1-1-facts";

const { vancouverR11Adapter, VANCOUVER_R1_1_SOURCE, VANCOUVER_R1_1_SOURCE_ID, VANCOUVER_R1_1_VERSION_ID, VANCOUVER_R1_1_ADAPTER_ID, VANCOUVER_R1_1_ADAPTER_VERSION } = adapters.vancouver;
const { mapVancouverUseStatus, mapVancouverConcept, vancouverKnownUseStatusTerms } = adapters.vancouver;

function normalized(): E85NormalizedRuleBundle {
  const result = vancouverR11Adapter.normalize(r11Document(), VANCOUVER_R1_1_SOURCE);
  if (result.outcome !== "NORMALIZED") throw new Error(`expected NORMALIZED, got ${result.outcome}`);
  return result.bundle;
}

function useRule(b: E85NormalizedRuleBundle): E85UseRule {
  return b.rules.find((r): r is E85UseRule => r.family === "USE")!;
}
function densityRule(b: E85NormalizedRuleBundle): E85DensityRule {
  return b.rules.find((r): r is E85DensityRule => r.family === "DENSITY")!;
}
function dimensionalRule(b: E85NormalizedRuleBundle): E85DimensionalRule {
  return b.rules.find((r): r is E85DimensionalRule => r.family === "DIMENSIONAL")!;
}

describe("Vancouver R1-1 — use terminology mapping", () => {
  test('"Outright Approval Use" maps to PERMITTED', () => {
    expect(mapVancouverUseStatus("Outright Approval Use")).toBe("PERMITTED");
    const p = useRule(normalized()).permissions.find((e) => e.value.useCode === "one_family_dwelling");
    expect(p?.value.status).toBe("PERMITTED");
  });

  test('"Conditional Approval Use" maps to CONDITIONAL and names the approving authority', () => {
    expect(mapVancouverUseStatus("Conditional Approval Use")).toBe("CONDITIONAL");
    const p = useRule(normalized()).permissions.find((e) => e.value.useCode === "multiple_dwelling");
    expect(p?.value.status).toBe("CONDITIONAL");
    expect(p?.value.approvalAuthority).toBe("Director of Planning");
  });

  test("the source's exact wording is preserved alongside the normalized status", () => {
    const perms = useRule(normalized()).permissions;
    expect(perms.map((p) => p.value.rawSourceTerminology).sort()).toEqual(["Conditional Approval Use", "Outright Approval Use"]);
  });

  test("absence from the use table never becomes PROHIBITED", () => {
    const bundle = normalized();
    const statuses = useRule(bundle).permissions.map((p) => p.value.status);
    expect(statuses).not.toContain("PROHIBITED");
    // Nothing in the adapter's vocabulary maps to PROHIBITED at all.
    expect(vancouverKnownUseStatusTerms().map((t) => mapVancouverUseStatus(t))).not.toContain("PROHIBITED");
    // A use simply not present in the extract produces no permission record.
    expect(useRule(bundle).permissions.some((p) => p.value.useCode === "laneway_house")).toBe(false);
  });
});

describe("Vancouver R1-1 — numeric rule normalization", () => {
  test("FSR normalizes to the value the source states, unchanged", () => {
    expect(densityRule(normalized()).maxFsr?.value).toBe(1.0);
    expect(mapVancouverConcept("Floor Space Ratio")).toMatchObject({ family: "DENSITY", field: "maxFsr" });
  });

  test("height normalizes in metres", () => {
    expect(dimensionalRule(normalized()).maxHeightMetres?.value).toBe(11.5);
  });

  test("storeys normalize as a separate concept from height", () => {
    const d = dimensionalRule(normalized());
    expect(d.maxStoreys?.value).toBe(3);
    expect(d.maxHeightMetres?.value).toBe(11.5);
  });

  test("a yard normalizes to a setback keyed by the source's own yard name", () => {
    expect(dimensionalRule(normalized()).setbacksMetres?.front.value).toBe(4.9);
  });

  test("site coverage stated as a percentage is converted to a fraction, and the conversion is declared", () => {
    const bundle = normalized();
    expect(dimensionalRule(bundle).maxSiteCoverageFraction?.value).toBe(0.5);
    const finding = bundle.findings.find((f) => f.factId === FACT_SITE_COVERAGE_PERCENT.factId);
    expect(finding?.code).toBe("TERM_MAPPED_BY_JURISDICTION_POLICY");
    expect(dimensionalRule(bundle).maxSiteCoverageFraction?.provenance.interpretationNote).toMatch(/divided by 100/i);
  });

  test("site coverage already stated as a fraction passes through with no policy note", () => {
    const doc = r11Document({ facts: [{ ...FACT_SITE_COVERAGE_PERCENT, numericValue: 0.5, unit: "FRACTION" }] });
    const result = vancouverR11Adapter.normalize(doc, VANCOUVER_R1_1_SOURCE);
    if (result.outcome !== "NORMALIZED") throw new Error("expected NORMALIZED");
    expect(dimensionalRule(result.bundle).maxSiteCoverageFraction?.value).toBe(0.5);
    expect(result.bundle.findings.find((f) => f.factId === FACT_SITE_COVERAGE_PERCENT.factId)?.code).toBe("TERM_MAPPED_EXACT");
  });
});

describe("Vancouver R1-1 — condition preservation", () => {
  test("a condition-dependent height is held out of the unconditional rule set", () => {
    const bundle = normalized();
    expect(dimensionalRule(bundle).maxHeightMetres?.value).toBe(11.5);
    const conditionalHeights = bundle.conditionalRules.filter((c) => c.rule.family === "DIMENSIONAL");
    expect(conditionalHeights).toHaveLength(1);
    expect(conditionalHeights[0].condition).toBe(REAR_BUILDING_CONDITION);
    expect((conditionalHeights[0].rule as E85DimensionalRule).maxHeightMetres?.value).toBe(8.5);
  });

  test("the adapter never asserts the condition is satisfied", () => {
    const bundle = normalized();
    const finding = bundle.findings.find((f) => f.code === "CONDITION_PRESERVED");
    expect(finding?.severity).toBe("WARNING");
    expect(finding?.message).toMatch(/only if a caller affirms/i);
    // The unconditional rule set contains no 8.5 anywhere.
    expect(JSON.stringify(bundle.rules)).not.toContain("8.5");
  });

  test("the more favourable value is not silently selected — both are visible and separate", () => {
    const bundle = normalized();
    expect(dimensionalRule(bundle).maxHeightMetres?.value).toBe(11.5);
    expect(bundle.conditionalRules.map((c) => c.condition)).toEqual([REAR_BUILDING_CONDITION]);
  });
});

describe("Vancouver R1-1 — provenance preservation", () => {
  test("section and page survive normalization", () => {
    const d = dimensionalRule(normalized());
    expect(d.maxHeightMetres?.provenance.documentLocator?.section).toBe("3.2.2.3");
    expect(d.maxHeightMetres?.provenance.documentLocator?.page).toBe(4);
    expect(d.setbacksMetres?.front.provenance.documentLocator?.section).toBe("3.2.2.4");
  });

  test("the table locator survives for tabular use facts", () => {
    const p = useRule(normalized()).permissions.find((e) => e.value.useCode === "one_family_dwelling");
    expect(p?.provenance.documentLocator?.table).toBe("Outright Approval Uses");
    expect(p?.provenance.documentLocator?.section).toBe("2.1");
  });

  test("source id, by-law number and schedule survive", () => {
    const d = densityRule(normalized());
    expect(d.maxFsr?.provenance.sourceId).toBe(VANCOUVER_R1_1_SOURCE_ID);
    expect(d.maxFsr?.provenance.documentLocator?.bylawOrDocumentId).toBe("3575");
    expect(d.maxFsr?.provenance.documentLocator?.schedule).toBe("District Schedule R1-1");
  });

  test("source VERSION survives on every normalized value", () => {
    const bundle = normalized();
    const provenances = [
      densityRule(bundle).maxFsr?.provenance,
      dimensionalRule(bundle).maxHeightMetres?.provenance,
      useRule(bundle).permissions[0].provenance,
    ];
    for (const p of provenances) expect(p?.sourceVersionId).toBe(VANCOUVER_R1_1_VERSION_ID);
  });

  test("adapter id and version survive on every normalized value, not just on the bundle", () => {
    const bundle = normalized();
    expect(bundle.adapterId).toBe(VANCOUVER_R1_1_ADAPTER_ID);
    expect(bundle.adapterVersion).toBe(VANCOUVER_R1_1_ADAPTER_VERSION);
    const provenances = [densityRule(bundle).maxFsr?.provenance, dimensionalRule(bundle).maxStoreys?.provenance, useRule(bundle).permissions[1].provenance];
    for (const p of provenances) {
      expect(p?.adapterId).toBe(VANCOUVER_R1_1_ADAPTER_ID);
      expect(p?.adapterVersion).toBe(VANCOUVER_R1_1_ADAPTER_VERSION);
    }
  });

  test("no effective date is asserted, because the source states none", () => {
    const bundle = normalized();
    expect(bundle.temporal.effectiveDateBasis).toBe("UNKNOWN");
    expect(bundle.temporal.effectiveFrom).toBeUndefined();
  });

  test("the publication stamp is recorded at the precision the source prints, and says it is a publication stamp", () => {
    const note = densityRule(normalized()).maxFsr?.provenance.effectiveDateBasisNote;
    expect(note).toMatch(/2026-06/);
    expect(note).toMatch(/MONTH precision/i);
    expect(note).toMatch(/not a statement of when the provisions took legal effect/i);
    // The month is never widened into a day, here or anywhere else.
    expect(note).not.toMatch(/2026-06-\d{2}/);
  });

  test("retrievedAt reflects the extraction, and normalizedAt the normalization run", () => {
    const bundle = normalized();
    expect(densityRule(bundle).maxFsr?.provenance.retrievedAt).toBe(EXTRACTED_AT);
    expect(bundle.normalizedAt).toBe(EXTRACTED_AT);
    const later = vancouverR11Adapter.normalize(r11Document(), VANCOUVER_R1_1_SOURCE, { normalizedAt: "2026-09-13T12:00:00.000Z" });
    if (later.outcome !== "NORMALIZED") throw new Error("expected NORMALIZED");
    expect(later.bundle.normalizedAt).toBe("2026-09-13T12:00:00.000Z");
  });

  test('a reviewer can answer "where exactly did this value come from?" from one evidence item alone', () => {
    const fsr = densityRule(normalized()).maxFsr!;
    expect(fsr).toMatchObject({
      value: 1.0,
      provenance: {
        sourceId: VANCOUVER_R1_1_SOURCE_ID,
        sourceVersionId: VANCOUVER_R1_1_VERSION_ID,
        adapterId: VANCOUVER_R1_1_ADAPTER_ID,
        adapterVersion: VANCOUVER_R1_1_ADAPTER_VERSION,
        zoneDesignation: "R1-1",
        documentLocator: { bylawOrDocumentId: "3575", schedule: "District Schedule R1-1", section: "3.1.1.2", page: 3 },
      },
    });
  });
});

describe("Vancouver R1-1 — bundle-level reporting", () => {
  test("the bundle reports its readiness across every axis", () => {
    const bundle = normalized();
    expect(bundle.readiness.versionSupport).toBe("REGISTERED");
    expect(bundle.readiness.zoneScope).toBe("IN_SCOPE");
    expect(bundle.readiness.structureSupport).toBe("STRUCTURED");
    expect(bundle.readiness.accessStatus).toBe("AVAILABLE");
    // BLOCKED on licence alone: the document is reachable, the version is
    // registered, the zone is in scope and the adapter is verified — but no
    // redistribution right has been established, and readiness reports that
    // rather than rounding it up.
    expect(bundle.readiness.overall).toBe("BLOCKED");
    expect(bundle.readiness.blockers).toEqual(["LICENSE"]);
  });

  test("a licence limitation does not stop the adapter normalizing or strip provenance", () => {
    const bundle = normalized();
    expect(bundle.readiness.blockers).toContain("LICENSE");
    // Everything the adapter is for still happened, in full.
    expect(densityRule(bundle).maxFsr?.value).toBe(1.0);
    expect(dimensionalRule(bundle).maxHeightMetres?.value).toBe(11.5);
    expect(useRule(bundle).permissions.length).toBeGreaterThan(0);
    expect(densityRule(bundle).maxFsr?.provenance.sourceId).toBe(VANCOUVER_R1_1_SOURCE_ID);
    expect(densityRule(bundle).maxFsr?.provenance.documentLocator?.section).toBe("3.1.1.2");
  });

  test("bundle qualification has no parcelMatch axis, because no parcel exists at adaptation time", () => {
    const bundle = normalized();
    expect(Object.keys(bundle.qualification).sort()).toEqual(["evidenceQuality", "ruleApplicability"]);
    expect(bundle.qualification.evidenceQuality).toBe("high");
  });

  test("rule applicability floors to moderate while the extract carries a condition-dependent fact", () => {
    // The full fixture includes the rear-building height variant, so the
    // bundle as a whole is not unconditionally applicable — the floor, not an
    // average, is what is reported.
    expect(normalized().qualification.ruleApplicability).toBe("moderate");
  });

  test("an extract with no conditional facts qualifies as fully applicable", () => {
    const facts = r11Document().facts.filter((f) => f.condition === undefined);
    const result = vancouverR11Adapter.normalize(r11Document({ facts }), VANCOUVER_R1_1_SOURCE);
    if (result.outcome !== "NORMALIZED") throw new Error("expected NORMALIZED");
    expect(result.bundle.qualification).toEqual({ evidenceQuality: "high", ruleApplicability: "high" });
    expect(result.bundle.conditionalRules).toEqual([]);
  });

  test("every input fact is accounted for, either as a rule or as a finding", () => {
    const bundle = normalized();
    const factIds = r11Document().facts.map((f) => f.factId);
    const mentioned = new Set(bundle.findings.map((f) => f.factId).filter((x): x is string => x !== undefined));
    for (const id of factIds) expect(mentioned.has(id)).toBe(true);
  });

  test("a source registered with this adapter id agrees with the adapter's own identity", () => {
    const built = createE85SourceRegistry([VANCOUVER_R1_1_SOURCE]);
    if (!built.ok) throw new Error("registry should build");
    expect(built.registry.get(VANCOUVER_R1_1_SOURCE_ID)?.adapterId).toBe(vancouverR11Adapter.identity.adapterId);
  });

  test("adapter identity is jurisdiction-scoped, not merely the engine number", () => {
    expect(vancouverR11Adapter.identity.adapterId).toBe("ca-bc-vancouver.district-schedule.r1-1");
    expect(vancouverR11Adapter.identity.adapterId).not.toMatch(/^E85/i);
    expect(vancouverR11Adapter.identity.adapterVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("height is normalized from the unconditional fact, confirming fixture wiring", () => {
    expect(FACT_HEIGHT.numericValue).toBe(11.5);
    expect(dimensionalRule(normalized()).maxHeightMetres?.value).toBe(FACT_HEIGHT.numericValue);
  });
});

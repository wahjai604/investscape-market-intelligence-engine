/**
 * InvestScape™ E85 Phase 4 — use-permission evaluation tests.
 * © 2026 Lighthouse Research Ltd. All rights reserved.
 */
import { evaluateUsePermission, E85UseRule, E85ParcelReference } from "../../src/zoning-land-use-engine";

function parcel(): E85ParcelReference {
  return { parcelReferenceId: "p1" };
}

function useRule(status: "PERMITTED" | "CONDITIONAL" | "PROHIBITED", sourceId = "src-1", from?: string): E85UseRule {
  return {
    family: "USE",
    jurisdictionId: "jx",
    zoneDesignation: "Z1",
    permissions: [
      {
        value: { useCode: "daycare", status },
        provenance: { sourceId, documentLocator: { section: "1" } },
        temporal: { effectiveDateBasis: "SOURCE_STATED", effectiveFrom: from },
      },
    ],
  };
}

describe("use-permission evaluation", () => {
  test("PERMITTED evidence resolves to PERMITTED", () => {
    const f = evaluateUsePermission([useRule("PERMITTED")], parcel(), "jx", "Z1", "daycare", "2024-01-01");
    expect(f.resolvedValue).toEqual({ useCode: "daycare", status: "PERMITTED" });
  });

  test("CONDITIONAL evidence resolves to CONDITIONAL", () => {
    const f = evaluateUsePermission([useRule("CONDITIONAL")], parcel(), "jx", "Z1", "daycare", "2024-01-01");
    expect(f.resolvedValue).toEqual({ useCode: "daycare", status: "CONDITIONAL" });
  });

  test("PROHIBITED evidence resolves to PROHIBITED", () => {
    const f = evaluateUsePermission([useRule("PROHIBITED")], parcel(), "jx", "Z1", "daycare", "2024-01-01");
    expect(f.resolvedValue).toEqual({ useCode: "daycare", status: "PROHIBITED" });
  });

  test("absence of any applicable evidence resolves to UNKNOWN, never PROHIBITED", () => {
    const f = evaluateUsePermission([], parcel(), "jx", "Z1", "daycare", "2024-01-01");
    expect(f.resolvedValue).toEqual({ useCode: "daycare", status: "UNKNOWN" });
  });

  test("conflicting authoritative sources escalate to manual review, not array-order resolution", () => {
    const rules = [useRule("PERMITTED", "src-a"), useRule("PROHIBITED", "src-b")];
    const f = evaluateUsePermission(rules, parcel(), "jx", "Z1", "daycare", "2024-01-01");
    expect(f.outcome).toBe("MANUAL_REVIEW");
    expect(f.manualReview?.reasonCode).toBe("CONFLICTING_AUTHORITATIVE_SOURCES");
    // Reversed order must produce the same escalation, not a different resolved winner.
    const fReversed = evaluateUsePermission([...rules].reverse(), parcel(), "jx", "Z1", "daycare", "2024-01-01");
    expect(fReversed.outcome).toBe("MANUAL_REVIEW");
  });

  test("duplicate identical evidence (same value+provenance+temporal) does not trip a false conflict", () => {
    const rule = useRule("PERMITTED", "src-a");
    const f = evaluateUsePermission([rule, rule], parcel(), "jx", "Z1", "daycare", "2024-01-01");
    expect(f.outcome).toBe("RESOLVED");
    expect(f.resolvedValue).toEqual({ useCode: "daycare", status: "PERMITTED" });
  });
});

describe("use-permission temporal applicability", () => {
  test("a future-effective rule does not apply", () => {
    const f = evaluateUsePermission([useRule("PERMITTED", "src-1", "2030-01-01")], parcel(), "jx", "Z1", "daycare", "2024-01-01");
    expect(f.resolvedValue).toEqual({ useCode: "daycare", status: "UNKNOWN" });
  });

  test("an expired rule does not apply", () => {
    const rule: E85UseRule = {
      family: "USE",
      jurisdictionId: "jx",
      zoneDesignation: "Z1",
      permissions: [
        {
          value: { useCode: "daycare", status: "PERMITTED" },
          provenance: { sourceId: "src-1" },
          temporal: { effectiveDateBasis: "SOURCE_STATED", effectiveFrom: "2010-01-01", effectiveTo: "2015-01-01" },
        },
      ],
    };
    const f = evaluateUsePermission([rule], parcel(), "jx", "Z1", "daycare", "2024-01-01");
    expect(f.resolvedValue).toEqual({ useCode: "daycare", status: "UNKNOWN" });
  });

  test("an active (currently in-force, open-ended) rule applies", () => {
    const rule: E85UseRule = {
      family: "USE",
      jurisdictionId: "jx",
      zoneDesignation: "Z1",
      permissions: [
        {
          value: { useCode: "daycare", status: "PERMITTED" },
          provenance: { sourceId: "src-1" },
          temporal: { effectiveDateBasis: "SOURCE_STATED", effectiveFrom: "2010-01-01" },
        },
      ],
    };
    const f = evaluateUsePermission([rule], parcel(), "jx", "Z1", "daycare", "2024-01-01");
    expect(f.resolvedValue).toEqual({ useCode: "daycare", status: "PERMITTED" });
  });

  test("a historical (superseded but was-in-force-at-the-time) rule applies for a historical as-of date", () => {
    const rule: E85UseRule = {
      family: "USE",
      jurisdictionId: "jx",
      zoneDesignation: "Z1",
      permissions: [
        {
          value: { useCode: "daycare", status: "PROHIBITED" },
          provenance: { sourceId: "src-1" },
          temporal: { effectiveDateBasis: "SOURCE_STATED", effectiveFrom: "2005-01-01", effectiveTo: "2012-12-31" },
        },
      ],
    };
    const f = evaluateUsePermission([rule], parcel(), "jx", "Z1", "daycare", "2010-01-01");
    expect(f.resolvedValue).toEqual({ useCode: "daycare", status: "PROHIBITED" });
  });

  test("UNKNOWN effective-date basis on the only matching evidence yields a GAP (EFFECTIVE_DATE_UNKNOWN), never a guess", () => {
    const rule: E85UseRule = {
      family: "USE",
      jurisdictionId: "jx",
      zoneDesignation: "Z1",
      permissions: [
        {
          value: { useCode: "daycare", status: "PERMITTED" },
          provenance: { sourceId: "src-1" },
          temporal: { effectiveDateBasis: "UNKNOWN" },
        },
      ],
    };
    const f = evaluateUsePermission([rule], parcel(), "jx", "Z1", "daycare", "2024-01-01");
    expect(f.outcome).toBe("GAP");
    expect(f.gap?.reasonCode).toBe("EFFECTIVE_DATE_UNKNOWN");
  });
});

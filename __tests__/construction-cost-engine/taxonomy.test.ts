/**
 * InvestScape™ E70 Phase 2 — Taxonomy tests.
 */
import { mapSourceSubtype, mappedCanonicalSubtypes, RLB_SUBTYPE_MAPPING, KNOWN_UNSUPPORTED_CANONICAL_SUBTYPES } from "../../src/construction-cost-engine/taxonomy";

describe("mapSourceSubtype", () => {
  test("exact mapping: retail_shopping_center", () => {
    const m = mapSourceSubtype("rlb-north-america", "retail_shopping_center");
    expect(m.confidence).toBe("exact");
    expect(m.canonicalSubtype).toBe("retail_shopping_center");
  });

  test("close mapping: office_prime -> office_premium, never exact", () => {
    const m = mapSourceSubtype("rlb-north-america", "office_prime");
    expect(m.confidence).toBe("close");
    expect(m.canonicalSubtype).toBe("office_premium");
  });

  test("approximate mapping: hotel_3_star, never upgraded to close", () => {
    const m = mapSourceSubtype("rlb-north-america", "hotel_3_star");
    expect(m.confidence).toBe("approximate");
    expect(m.canonicalSubtype).toBe("hotel_select_service");
  });

  test("unknown subtype for known source -> unsupported, never approximate", () => {
    const m = mapSourceSubtype("rlb-north-america", "multifamily_mid_rise");
    expect(m.confidence).toBe("unsupported");
    expect(m.canonicalSubtype).toBeUndefined();
  });

  test("unknown source -> unsupported", () => {
    const m = mapSourceSubtype("some-unregistered-source", "office_prime");
    expect(m.confidence).toBe("unsupported");
  });

  test("undefined subtype -> unsupported", () => {
    const m = mapSourceSubtype("rlb-north-america", undefined);
    expect(m.confidence).toBe("unsupported");
  });

  test("every RLB_SUBTYPE_MAPPING entry with a canonicalSubtype is exact/close/approximate, never unsupported", () => {
    for (const [key, mapping] of Object.entries(RLB_SUBTYPE_MAPPING)) {
      if (mapping.canonicalSubtype !== undefined) {
        expect(["exact", "close", "approximate"]).toContain(mapping.confidence);
      } else {
        fail(`Entry "${key}" has no canonicalSubtype but should (all current RLB_SUBTYPE_MAPPING entries map somewhere).`);
      }
    }
  });

  test("multifamily and industrial subtypes have no RLB_SUBTYPE_MAPPING key at all", () => {
    for (const gap of KNOWN_UNSUPPORTED_CANONICAL_SUBTYPES) {
      const keysMappingToIt = Object.entries(RLB_SUBTYPE_MAPPING).filter(([, m]) => m.canonicalSubtype === gap.canonicalSubtype);
      expect(keysMappingToIt).toHaveLength(0);
    }
  });
});

describe("mappedCanonicalSubtypes", () => {
  test("returns only canonical subtypes actually mapped by a registered source", () => {
    const mapped = mappedCanonicalSubtypes();
    expect(mapped).toContain("office_premium");
    expect(mapped).toContain("retail_shopping_center");
    expect(mapped).not.toContain("multifamily_mid_rise");
    expect(mapped).not.toContain("industrial_warehouse");
  });

  test("deterministic across repeated calls", () => {
    expect(mappedCanonicalSubtypes().sort()).toEqual(mappedCanonicalSubtypes().sort());
  });
});

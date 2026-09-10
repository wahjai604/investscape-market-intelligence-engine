# E68 — Mapping to the application compatibility layer

Status 2026-09-10. Implementation: `src/cre-intelligence/mapping.ts`.
Tests: `__tests__/cre-intelligence/data-integrity.test.ts` (sections G and H).

## Two layers, one explicit seam

| Layer | Role |
| --- | --- |
| **E68** | Authoritative normalized source layer. Preserves source-native granularity. |
| **`CAP_RATE_BENCHMARKS` / `DEV_BUILDING_SUBTYPES`** | Application-facing compatibility layer with a coarser vocabulary. |

E68 is never distorted to fit the legacy vocabulary. The mapping is explicit,
documented and tested, and it is allowed to refuse.

> **Note for reviewers:** neither `CAP_RATE_BENCHMARKS` nor
> `DEV_BUILDING_SUBTYPES` exists anywhere in this workspace — all seven sibling
> repos were searched on 2026-09-10. They live in the WeWeb front end. The legacy
> key vocabulary in `mapping.ts` is therefore transcribed from the Phase 4
> specification rather than imported. **If that enum ever moves into a shared
> package, import it and delete the local literal union so drift becomes a
> compile error.**

## Mapping confidence

| Level | Meaning | Auto-surfaced? |
| --- | --- | --- |
| `exact` | The source's own classification *is* the legacy category | Yes |
| `close` | A documented, defensible narrowing | Yes |
| `approximate` | Plausible but methodologically unsupported | **No** — requires explicit acknowledgement |
| `unsupported` | No honest mapping exists | **No** — no benchmark |

`isAutoSurfaceable()` returns true only for `exact` and `close`. An
`unsupported` result must not name a target subtype at all — a test enforces it.

## Cap-rate key mapping

| E68 input | Legacy key | Confidence | Class carried |
| --- | --- | --- | --- |
| office + `cbd` | `office_downtown` | exact | yes |
| office + `suburban` | `office_suburban` | exact | yes |
| office + `urban` | `office_downtown` | **approximate** | yes |
| office + `unspecified` | *(none)* | **unsupported** | — |
| industrial | `industrial` | exact | yes |
| multifamily | `multifamily` | exact | yes |
| retail | `retail_neighbourhood` | close | **no** |
| anything else | *(none)* | unsupported | — |

Two decisions worth stating plainly:

- **Office with no stated location type gets no key.** The legacy layer forces a
  choice between downtown and suburban, which price materially differently.
  Guessing would invent the distinction, so the mapping refuses instead.
- **Retail drops class.** The legacy layer models no retail class split, so a
  Class A input returns `propertyClass: undefined` rather than smuggling a
  dimension the consumer cannot represent.

`urban → office_downtown` is deliberately `approximate`: many urban submarkets
price closer to suburban, so it never auto-surfaces.

## Construction subtype mapping (RLB → `DEV_BUILDING_SUBTYPES`)

| RLB subtype | Legacy subtype | Confidence |
| --- | --- | --- |
| `retail_shopping_center` | `retail_shopping_center` | exact |
| `retail_strip` | `retail_strip` | exact |
| `office_prime` | `office_prime` | close |
| `office_secondary` | `office_secondary` | close |
| `hotel_5_star` | `hotel_luxury` | close |
| `hospital_general` | `healthcare_hospital` | close |
| `hotel_3_star` | `hotel_select_service` | **approximate** |
| `multifamily_mid_rise` | *(none)* | **unsupported** |
| `industrial_warehouse` | *(none)* | **unsupported** |
| *anything unknown* | *(none)* | **unsupported** |

### "Prime" is not Class A

RLB grades *construction cost tiers*. CBRE grades *investment quality*. They are
different classifications with different definitions and different publishers.
Every RLB-sourced observation therefore carries `propertyClass: "unspecified"`,
and the RLB grade lives in `propertySubtype`. A test asserts this and checks the
`office_prime` rationale still says so in words.

### The worked example: multifamily

The specification's example asks whether *"RLB mid-rise multifamily"* equals
*"InvestScape condo 5–12 storey"*. It does not — and the real answer is stronger
than "approximate": **RLB's public North America report contains no multifamily
building type at all.** Its U.S. table covers only offices, retail, hotels and
general hospital. There is nothing to map, so the entry is `unsupported` and a
dedicated test locks it there.

### Unknown means unsupported

`mapRlbSubtype()` returns `unsupported` for any unrecognised subtype. Unknown is
never quietly promoted to `approximate`.

## E30 legacy cap-rate correction record

The economic-engine E30 city records carried cap rates tagged `FRED, Zillow`.
Neither publisher produces a commercial cap rate: FRED carries interest rates and
housing statistics, Zillow carries residential ZHVI/ZORI. That provenance never
supported the numbers.

E68 Phase 4 searched for legitimate replacements and found none (see
`data/cap-rates-us.ts`). Per the governing rule, the values were set to `null`
rather than preserved:

| City | Removed | Now |
| --- | --- | --- |
| Miami | p25 5.2 / p50 5.9 / p75 6.7 | `null` |
| Seattle | p25 4.3 / p50 4.9 / p75 5.6 | `null` |

This follows the convention already established in that file for
`houston-tx` / `austin-tx` / `phoenix-az`, whose invented placeholders were
removed on 2026-09-09.

### Still outstanding

**Ten further US city records carry the same invalid `FRED, Zillow` cap-rate
provenance** and were left untouched because Phase 4 scoped the correction to
Miami and Seattle. They warrant the same treatment:

| City | p25 / p50 / p75 |
| --- | --- |
| `boston-ma` | 4.2 / 4.8 / 5.5 |
| `new-york-ny` | 3.9 / 4.5 / 5.2 |
| `philadelphia-pa` | 5.1 / 5.8 / 6.5 |
| `chicago-il` | 5.8 / 6.5 / 7.2 |
| `minneapolis-mn` | 5.5 / 6.2 / 6.9 |
| `atlanta-ga` | 5.9 / 6.6 / 7.4 |
| `nashville-tn` | 6.1 / 6.8 / 7.5 |
| `los-angeles-ca` | 4.1 / 4.8 / 5.5 |
| `san-francisco-ca` | 3.2 / 3.9 / 4.6 |
| `denver-co` | 5.2 / 5.9 / 6.6 |

Note `denver-co` (5.2 / 5.9 / 6.6) is near-identical to Miami's removed figures
— consistent with all twelve having come from one unsourced generation pass
rather than from any market data.

/**
 * @file INDICATIVE price catalog for the balcony configurator.
 *
 * None of the numbers in this file are real БАЛКОН-МСК prices. They are a
 * placeholder/test catalog so the pricing module (`calculate.js`) and the
 * `/api/price/quote` route have something plausible to compute with until
 * the business supplies real price lists. Every quote produced from this
 * catalog MUST carry `isEstimate: true` and the `PRICE_DISCLAIMER` text
 * (see `calculate.js`) — never present these numbers as real prices.
 *
 * Shape areas (`SHAPE_AREA_M2`) are the one non-arbitrary part of this file:
 * they are computed from the room outlines in
 * `src/pages/Configurator/planShapes.ts` (`PLAN_SHAPES[id].poly`) with the
 * same shoelace formula as that file's own `planArea()` helper. Values below
 * (rounded to 2 decimals) were hand-computed from those polygons:
 *   - sapozhok:      poly [[0,0],[3130,0],[3130,2085],[2730,2085],[2370,1165],[0,1165]]       -> 4.18 m² (matches the file's own comment: "4.18 m²")
 *   - lodochka:      poly [[0,0],[3250,0],[3250,280],[3650,280],[3650,880],[1745,880],[0,400]] -> 2.68 m² (matches "2.68 m²")
 *   - utyuzhok:      poly [[0,0],[3000,0],[3000,2000],[1250,2000],[343,549]]                   -> 4.75 m² (matches "4.75 m²")
 *   - loggia:        rectangle 3000 x 1200                                                      -> 3.60 m²
 *   - long-loggia:   rectangle 6000 x 1200                                                      -> 7.20 m²
 *   - khrushchevka:  rectangle 2700 x 800                                                       -> 2.16 m²
 * (`utyuzhok`'s fifth point is UTYUG_C = round(1250 * 700/2550), round(2000 * 700/2550)) = [343, 549].)
 */

'use strict';

/** Floor area per shape id, m² — see the file header for how these were derived. */
const SHAPE_AREA_M2 = {
  sapozhok: 4.18,
  lodochka: 2.68,
  utyuzhok: 4.75,
  loggia: 3.6,
  'long-loggia': 7.2,
  khrushchevka: 2.16,
};

/**
 * Indicative price per m² of glazed area, RUB, keyed by the glazing option id
 * used in `VamSelection.glazing` (see `vamShapes.ts` `VamGlazingDef.id` across
 * `VAM_TYPES`): `parapet` / `floor` for the Г/П/Лоджия types, `left` / `right`
 * for the П-44Т (Утюг) type. "floor" (глазирование до пола) and "left"/"right"
 * (full glass wall, both sides) carry a higher indicative rate than a plain
 * parapet glazing — these multipliers are a guess, not a quote.
 */
const GLAZING_PRICE_PER_M2_RUB = {
  parapet: 18000,
  floor: 24000,
  left: 21000,
  right: 21000,
};

/** Fallback rate for a glazing id not in the table above (should not normally happen once validated). */
const DEFAULT_GLAZING_PRICE_PER_M2_RUB = 18000;

/**
 * Flat indicative prices, RUB, for the boolean extras offered in
 * `VamSelection`-adjacent order flow (insulation / ceiling finish / old
 * glazing dismantling). These are flat per-balcony add-ons, not per-m².
 */
const EXTRAS_PRICE_RUB = {
  insulation: 15000,
  ceiling: 8000,
  dismantling: 6000,
};

/**
 * Small indicative price delta, RUB, applied per chosen material/colour pick
 * (`VamSelection.picks[key] = { o, k }`), keyed by the option id `o`. These
 * ids come from the generated app catalogue (`vamApp.generated.ts`) — the
 * textured floor/wall finishes (`laminat`/`vagonka`/`parket`/`mdf`/`plitka`,
 * see `vamCatalog.ts`'s `TEXTURED` set) plus the other option families
 * (`potolok*` ceiling finishes, `frame` colour, `lamp`, `plintus`, `sill`,
 * `chair`/`dryer`/`flowers` plan furniture, `0j`/`1j`/... cabinet variants).
 * None of these deltas are real — flat small placeholder modifiers, as the
 * brief allows when real per-option deltas aren't available.
 */
const MATERIAL_OPTION_DELTA_RUB = {
  laminat: 1200,
  vagonka: 900,
  parket: 2500,
  mdf: 1000,
  plitka: 1800,
  potolok1: 500,
  potolok2: 800,
  potolok3: 1100,
  frame: 0, // frame colour is included in the glazing price per m²
  lamp: 1500,
  plintus: 300,
  sill: 700,
  chair: 2000,
  dryer: 2500,
  flowers: 400,
};

/** Fallback delta, RUB, for any pick option id not listed above. */
const DEFAULT_MATERIAL_OPTION_DELTA_RUB = 500;

/**
 * Indicative installation/work price, as a fraction of the priced subtotal
 * (glazing + extras + material deltas). A placeholder ratio, not a real
 * labour-cost model.
 */
const WORK_PRICE_RATE = 0.2;

const CURRENCY = 'RUB';

const PRICE_DISCLAIMER =
  'Это тестовый/ориентировочный расчёт на основе условного каталога цен, не прайс-лист компании. ' +
  'Точную стоимость определит замерщик после выезда на объект.';

module.exports = {
  SHAPE_AREA_M2,
  GLAZING_PRICE_PER_M2_RUB,
  DEFAULT_GLAZING_PRICE_PER_M2_RUB,
  EXTRAS_PRICE_RUB,
  MATERIAL_OPTION_DELTA_RUB,
  DEFAULT_MATERIAL_OPTION_DELTA_RUB,
  WORK_PRICE_RATE,
  CURRENCY,
  PRICE_DISCLAIMER,
};

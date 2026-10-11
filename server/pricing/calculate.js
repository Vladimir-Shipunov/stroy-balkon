/**
 * @file Pure, Decimal-safe price calculation for a balcony configurator
 * selection. No Express/HTTP here — `server/routes/price.js` wraps this for
 * the `/api/price/quote` endpoint, and the order-submission flow should call
 * `calculateQuote` directly too, so the server never trusts a client-sent
 * price for an order.
 *
 * All money math uses `decimal.js` (never plain floats as the sole
 * mechanism — floats lose precision across JSON round-trips, and compound
 * rounding errors accumulate across many line items). Every money value in
 * the returned quote is a decimal STRING with 2 fraction digits (e.g.
 * "123456.00"), not a JS number.
 *
 * The catalog this module prices against (`./catalog.js`) is an INDICATIVE
 * placeholder catalog, not real company pricing — every quote this module
 * returns carries `isEstimate: true` and `priceDisclaimer`.
 */

'use strict';

const Decimal = require('decimal.js');

const {
  SHAPE_AREA_M2,
  GLAZING_PRICE_PER_M2_RUB,
  DEFAULT_GLAZING_PRICE_PER_M2_RUB,
  EXTRAS_PRICE_RUB,
  MATERIAL_OPTION_DELTA_RUB,
  DEFAULT_MATERIAL_OPTION_DELTA_RUB,
  WORK_PRICE_RATE,
  CURRENCY,
  PRICE_DISCLAIMER,
} = require('./catalog');

/** Typed error for bad quote input — callers (the route, the order flow) can
 * distinguish this from a programming error and respond with a 4xx. */
class QuoteError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'QuoteError';
    this.code = code;
  }
}

const EXTRA_KEYS = Object.keys(EXTRAS_PRICE_RUB);

function money(value) {
  return new Decimal(value).toDecimalPlaces(2);
}

function toMoneyString(decimalValue) {
  return decimalValue.toFixed(2);
}

/** Validate & normalize the picks map: `{ "<hotspotId>|<slotId>": { o: string, k: number } }`. */
function normalizePicks(picks) {
  if (picks === undefined || picks === null) return {};
  if (typeof picks !== 'object' || Array.isArray(picks)) {
    throw new QuoteError('INVALID_PICKS', '"picks" must be an object keyed by hotspot|slot.');
  }
  const out = {};
  for (const [key, pick] of Object.entries(picks)) {
    if (!pick || typeof pick !== 'object') continue;
    if (typeof pick.o !== 'string' || !pick.o) continue;
    if (typeof pick.k !== 'number' || !Number.isFinite(pick.k)) continue;
    out[key] = { o: pick.o, k: pick.k };
  }
  return out;
}

/** Validate & normalize the extras flags: `{ insulation?, ceiling?, dismantling? }`. */
function normalizeExtras(extras) {
  if (extras === undefined || extras === null) return {};
  if (typeof extras !== 'object' || Array.isArray(extras)) {
    throw new QuoteError('INVALID_EXTRAS', '"extras" must be an object of boolean flags.');
  }
  const out = {};
  for (const key of EXTRA_KEYS) {
    out[key] = extras[key] === true;
  }
  return out;
}

/**
 * @param {object} input
 * @param {string} input.shapeId   One of `planShapes.ts`'s `PLAN_SHAPES` ids (see `SHAPE_AREA_M2`).
 * @param {string} input.glazingId One of `vamShapes.ts`'s glazing ids (`parapet`/`floor`/`left`/`right`).
 * @param {Record<string, {o: string, k: number}>} [input.picks]
 * @param {Record<string, boolean>} [input.extras]
 * @returns {{
 *   currency: 'RUB', isEstimate: true, priceDisclaimer: string,
 *   lineItems: Array<{code: string, label: string, qty: string, unit: string, unitPrice: string, amount: string}>,
 *   subtotal: string, workPrice: string, totalPrice: string
 * }}
 */
function calculateQuote(input) {
  if (!input || typeof input !== 'object') {
    throw new QuoteError('INVALID_INPUT', 'Quote input must be an object.');
  }

  const { shapeId, glazingId } = input;

  if (typeof shapeId !== 'string' || !shapeId) {
    throw new QuoteError('MISSING_SHAPE', '"shapeId" is required.');
  }
  const areaM2 = SHAPE_AREA_M2[shapeId];
  if (areaM2 === undefined) {
    throw new QuoteError('UNKNOWN_SHAPE', `Unknown shapeId "${shapeId}". Known shapes: ${Object.keys(SHAPE_AREA_M2).join(', ')}.`);
  }

  if (typeof glazingId !== 'string' || !glazingId) {
    throw new QuoteError('MISSING_GLAZING', '"glazingId" is required.');
  }
  const glazingRate = GLAZING_PRICE_PER_M2_RUB[glazingId];
  if (glazingRate === undefined) {
    throw new QuoteError(
      'UNKNOWN_GLAZING',
      `Unknown glazingId "${glazingId}". Known glazings: ${Object.keys(GLAZING_PRICE_PER_M2_RUB).join(', ')}.`,
    );
  }

  const picks = normalizePicks(input.picks);
  const extras = normalizeExtras(input.extras);

  const area = money(areaM2);
  const lineItems = [];
  let subtotal = new Decimal(0);

  // 1) Glazing shell, priced per m² of floor area.
  const glazingUnitPrice = money(glazingRate !== undefined ? glazingRate : DEFAULT_GLAZING_PRICE_PER_M2_RUB);
  const glazingAmount = money(area.times(glazingUnitPrice));
  lineItems.push({
    code: `glazing:${glazingId}`,
    label: `Остекление (${glazingId}), ${toMoneyString(area)} м²`,
    qty: toMoneyString(area),
    unit: 'm2',
    unitPrice: toMoneyString(glazingUnitPrice),
    amount: toMoneyString(glazingAmount),
  });
  subtotal = subtotal.plus(glazingAmount);

  // 2) One line per material/colour pick, by option id delta.
  for (const [key, pick] of Object.entries(picks)) {
    const delta = MATERIAL_OPTION_DELTA_RUB[pick.o];
    const unitPrice = money(delta !== undefined ? delta : DEFAULT_MATERIAL_OPTION_DELTA_RUB);
    const amount = money(unitPrice);
    lineItems.push({
      code: `pick:${key}`,
      label: `Отделка «${pick.o}» (цвет ${pick.k})`,
      qty: '1.00',
      unit: 'pc',
      unitPrice: toMoneyString(unitPrice),
      amount: toMoneyString(amount),
    });
    subtotal = subtotal.plus(amount);
  }

  // 3) Flat-priced extras.
  for (const key of EXTRA_KEYS) {
    if (!extras[key]) continue;
    const unitPrice = money(EXTRAS_PRICE_RUB[key]);
    lineItems.push({
      code: `extra:${key}`,
      label: EXTRA_LABELS[key] || key,
      qty: '1.00',
      unit: 'pc',
      unitPrice: toMoneyString(unitPrice),
      amount: toMoneyString(unitPrice),
    });
    subtotal = subtotal.plus(unitPrice);
  }

  subtotal = money(subtotal);
  const workPrice = money(subtotal.times(WORK_PRICE_RATE));
  const totalPrice = money(subtotal.plus(workPrice));

  return {
    currency: CURRENCY,
    isEstimate: true,
    priceDisclaimer: PRICE_DISCLAIMER,
    lineItems,
    subtotal: toMoneyString(subtotal),
    workPrice: toMoneyString(workPrice),
    totalPrice: toMoneyString(totalPrice),
  };
}

const EXTRA_LABELS = {
  insulation: 'Утепление',
  ceiling: 'Отделка потолка',
  dismantling: 'Демонтаж старого остекления',
};

module.exports = { calculateQuote, QuoteError };

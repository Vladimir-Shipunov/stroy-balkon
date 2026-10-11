/**
 * @file `/api/price` router — server-side quote endpoint.
 *
 * `POST /quote` accepts a configurator selection and returns a price
 * breakdown computed by `server/pricing/calculate.js` against the
 * INDICATIVE catalog in `server/pricing/catalog.js`. The server never
 * trusts a client-submitted price: the client sends only the selection
 * (shape/glazing/picks/extras), and every money figure in the response is
 * computed here.
 */

'use strict';

const express = require('express');
const logger = require('../utils/logger');
const { cleanString, cleanEnum, cleanObject } = require('../utils/validation');
const { calculateQuote, QuoteError } = require('../pricing/calculate');
const { SHAPE_AREA_M2, GLAZING_PRICE_PER_M2_RUB } = require('../pricing/catalog');

const KNOWN_SHAPE_IDS = Object.keys(SHAPE_AREA_M2);
const KNOWN_GLAZING_IDS = Object.keys(GLAZING_PRICE_PER_M2_RUB);

function sendError(res, status, code, message) {
  res.status(status).json({ success: false, error: { code, message } });
}

module.exports = function createPriceRouter() {
  const router = express.Router();

  router.post('/quote', (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};

    // shapeId / glazingId are free-form enough (hyphenated ids like
    // "long-loggia") that cleanEnum (which restricts to a fixed allow-list) is
    // the right tool here — anything outside the known catalog ids is
    // rejected up front with a clear 400 rather than falling through to
    // calculateQuote's own (also-clear) UNKNOWN_SHAPE/UNKNOWN_GLAZING error.
    const shapeId = cleanEnum(body.shapeId, KNOWN_SHAPE_IDS, null);
    if (!shapeId) {
      return sendError(
        res,
        400,
        'INVALID_SHAPE',
        `"shapeId" must be one of: ${KNOWN_SHAPE_IDS.join(', ')}.`,
      );
    }

    const glazingId = cleanEnum(body.glazingId, KNOWN_GLAZING_IDS, null);
    if (!glazingId) {
      return sendError(
        res,
        400,
        'INVALID_GLAZING',
        `"glazingId" must be one of: ${KNOWN_GLAZING_IDS.join(', ')}.`,
      );
    }

    // picks / extras are validated more loosely here (just shape-sanitized
    // with cleanObject, which strips control chars / angle brackets and caps
    // depth & size) — `calculateQuote` does its own defensive normalization
    // of the actual pick/extra fields, since it must also be safe to call
    // directly from the order-submission flow without going through this
    // route's sanitization.
    const picks = cleanObject(body.picks ?? {});
    const extras = cleanObject(body.extras ?? {});

    try {
      const quote = calculateQuote({ shapeId, glazingId, picks, extras });
      return res.json({ success: true, data: quote });
    } catch (err) {
      if (err instanceof QuoteError) {
        return sendError(res, 400, err.code, err.message);
      }
      // Not a validation problem — a real bug in the pricing module. Don't
      // swallow it silently: log it and surface a generic 500.
      logger.error('[price] /quote failed', err);
      return sendError(res, 500, 'QUOTE_FAILED', 'Could not calculate a price quote.');
    }
  });

  return router;
};

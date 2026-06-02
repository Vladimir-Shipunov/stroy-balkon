/**
 * ============================================
 * BALCONY PRO - admin authentication guard
 * ============================================
 * Protects administrative / PII-exposing endpoints (order listings, order
 * mutations, catalogue management, statistics). Customer-facing endpoints
 * (creating an order, requesting a call, reading the public catalogue) stay open.
 *
 * Fails closed: when ADMIN_API_TOKEN is not configured the guarded routes are
 * denied rather than left open, so customer data is never exposed by default.
 *
 * The token is supplied by the client via either:
 *   Authorization: Bearer <token>
 *   X-Admin-Token: <token>
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

function safeEqual(provided, expected) {
    const a = Buffer.from(String(provided), 'utf8');
    const b = Buffer.from(String(expected), 'utf8');
    // Length must match for timingSafeEqual; comparing lengths first only leaks
    // the token length, which is acceptable.
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

function createAdminGuard(options = {}) {
    const token = options.token || process.env.ADMIN_API_TOKEN || '';

    if (!token) {
        logger.warn('ADMIN_API_TOKEN is not set — administrative API endpoints are disabled (fail closed).');
    }

    return function adminGuard(req, res, next) {
        if (!token) {
            return res.status(503).json({
                success: false,
                error: 'Административный доступ не настроен'
            });
        }

        const header = req.get('authorization') || '';
        const bearer = header.replace(/^Bearer\s+/i, '');
        const provided = (bearer || req.get('x-admin-token') || '').trim();

        if (!provided || !safeEqual(provided, token)) {
            logger.warn('Rejected unauthorized admin request', {
                method: req.method,
                path: req.originalUrl,
                ip: req.ip
            });
            return res.status(401).json({
                success: false,
                error: 'Требуется авторизация администратора'
            });
        }

        return next();
    };
}

module.exports = { createAdminGuard, safeEqual };

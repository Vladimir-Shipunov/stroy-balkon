/**
 * ============================================
 * BALCONY PRO - saved configurator drafts (projects)
 * ============================================
 * A "project" is a saved configurator draft — NOT a submitted order (see
 * server/routes/orders.js for that, separate concept). There is no login
 * system, so ownership is proven by two opaque tokens handed back on create:
 *  - `accessToken` (read-only) — safe to put in a shareable URL/query string.
 *  - `editToken` — required for PUT; the client must keep this one private
 *    (e.g. localStorage) and send it via the `X-Project-Token` header rather
 *    than a query string, so it never ends up in browser history / referrers
 *    / server access logs the way a URL-embedded token would.
 * A single shared token doing both jobs was the original design here and in
 * a since-removed duplicate (server/routes/configurations.js) — a security
 * review correctly flagged it: a "view my draft" link also granted edit
 * rights. Fixed by splitting the two (план.txt §19: "не допускай
 * несанкционированного изменения чужих проектов").
 *
 * Every write re-validates the config server-side (validateConfig) — never
 * trust a client-supplied config, per план.txt §19.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { validateConfig } = require('../validators/configValidator');
const { cleanObject, cleanId, cleanString } = require('../utils/validation');

module.exports = function createProjectsRouter(deps) {
    const router = express.Router();
    const { db } = deps;
    // Mirrors the existing callRequestLimiter pattern in server.js — write endpoints
    // here must not be left unthrottled. Falls back to a no-op if not injected, so
    // this router still works (unthrottled) if ever mounted without it directly.
    const writeLimiter = deps.projectsWriteLimiter || ((req, res, next) => next());

    function parseProjectRow(row) {
        if (!row) return null;
        let config = {};
        try {
            config = JSON.parse(row.config_json);
        } catch {
            config = {};
        }
        return {
            id: row.id,
            config,
            configVersion: row.config_version,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    /** Edit token travels via header (preferred, never logged in a URL) or,
     * for backward compatibility with a plain `?token=`, the query/body —
     * callers should migrate to the header. */
    function readEditToken(req) {
        return cleanString(req.get('X-Project-Token'), { max: 120 })
            || cleanString(req.body?.token, { max: 120 })
            || cleanString(req.query.token, { max: 120 });
    }

    router.post('/', writeLimiter, (req, res) => {
        try {
            const config = cleanObject(req.body?.config ?? req.body, 50000);
            const { valid, errors } = validateConfig(config, { db });

            if (!valid) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid configuration',
                    errors
                });
            }

            const id = uuidv4();
            const accessToken = uuidv4();
            const editToken = uuidv4();
            const saved = db.saveProject({
                id,
                configJson: JSON.stringify(config),
                configVersion: 1,
                accessToken,
                editToken
            });

            if (!saved) {
                return res.status(500).json({
                    success: false,
                    error: 'Could not save project'
                });
            }

            return res.status(201).json({
                success: true,
                id,
                accessToken,
                editToken,
                createdAt: saved.createdAt
            });
        } catch (error) {
            logger.error('Create project error', error);
            return res.status(500).json({
                success: false,
                error: 'Could not create project'
            });
        }
    });

    router.get('/:id', (req, res) => {
        try {
            const id = cleanId(req.params.id);
            // Read access accepts either token — the read-only `accessToken` (meant
            // for a shared view link) or the private `editToken` (so the owner's own
            // "resume editing" flow, which only holds editToken, can also load it).
            const token = cleanString(req.query.token, { max: 120 }) || readEditToken(req);
            const row = db.getProjectById(id);

            if (!row || !token || (row.access_token !== token && row.edit_token !== token)) {
                // Same 404 whether the project is missing or the token is wrong —
                // avoids leaking which project ids exist.
                return res.status(404).json({
                    success: false,
                    error: 'Project not found'
                });
            }

            return res.json({
                success: true,
                project: parseProjectRow(row)
            });
        } catch (error) {
            logger.error('Get project error', error);
            return res.status(500).json({
                success: false,
                error: 'Could not get project'
            });
        }
    });

    router.put('/:id', writeLimiter, (req, res) => {
        try {
            const id = cleanId(req.params.id);
            // Write access requires editToken specifically — accessToken (the
            // shareable read-only link) must never be enough to modify a project.
            const token = readEditToken(req);
            const row = db.getProjectById(id);

            if (!row || !token || row.edit_token !== token) {
                return res.status(404).json({
                    success: false,
                    error: 'Project not found'
                });
            }

            const config = cleanObject(req.body?.config, 50000);
            const { valid, errors } = validateConfig(config, { db });

            if (!valid) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid configuration',
                    errors
                });
            }

            const updated = db.updateProject(id, JSON.stringify(config));
            if (!updated) {
                return res.status(500).json({
                    success: false,
                    error: 'Could not update project'
                });
            }

            const fresh = parseProjectRow(db.getProjectById(id));
            return res.json({
                success: true,
                project: fresh
            });
        } catch (error) {
            logger.error('Update project error', error);
            return res.status(500).json({
                success: false,
                error: 'Could not update project'
            });
        }
    });

    return router;
};

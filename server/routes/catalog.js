/**
 * ============================================
 * BALCONY PRO - read-only catalogue endpoints
 * ============================================
 * Serves the server-side mirror of the client catalogue
 * (server/data/balconyCatalog.json — see that file's `$note`/`$todo` for what
 * is and isn't transcribed from src/pages/Configurator/*) plus the legacy
 * `materials` DB table. Public, read-only — no admin guard needed.
 */

const express = require('express');
const logger = require('../utils/logger');
const { loadCatalog } = require('../validators/configValidator');
const { cleanId } = require('../utils/validation');

module.exports = function createCatalogRouter(deps) {
    const router = express.Router();
    const { db } = deps;

    router.get('/models', (req, res) => {
        try {
            const catalog = loadCatalog();
            return res.json({
                success: true,
                models: catalog.models,
                typeLabels: catalog.typeLabels,
                glazingLabels: catalog.glazingLabels
            });
        } catch (error) {
            logger.error('Catalog models error', error);
            return res.status(500).json({
                success: false,
                error: 'Could not load balcony models'
            });
        }
    });

    router.get('/models/:id', (req, res) => {
        try {
            const id = cleanId(req.params.id);
            const catalog = loadCatalog();
            const model = catalog.models.find((m) => m.id === id);

            if (!model) {
                return res.status(404).json({
                    success: false,
                    error: 'Model not found'
                });
            }

            return res.json({ success: true, model });
        } catch (error) {
            logger.error('Catalog model error', error);
            return res.status(500).json({
                success: false,
                error: 'Could not load balcony model'
            });
        }
    });

    router.get('/materials', (req, res) => {
        try {
            const category = req.query.category ? cleanId(req.query.category) : null;
            const materials = category ? db.getMaterialsByCategory(category) : db.getAllMaterials();
            return res.json({ success: true, materials });
        } catch (error) {
            logger.error('Catalog materials error', error);
            return res.status(500).json({
                success: false,
                error: 'Could not load materials'
            });
        }
    });

    // Allowed ranges/enums per model — the geometry + hotspot-kind subset of the
    // catalogue, handy for a client building its own form controls.
    router.get('/params', (req, res) => {
        try {
            const catalog = loadCatalog();
            const params = catalog.models.map((model) => ({
                id: model.id,
                label: model.label,
                geometry: model.geometry,
                glazings: model.glazings.map((g) => ({
                    id: g.id,
                    label: catalog.glazingLabels[g.id] || g.id,
                    hotspotKinds: [...new Set(g.hotspots.map((h) => h.kind))]
                }))
            }));
            return res.json({
                success: true,
                params,
                finishFamilies: catalog.finishFamilies,
                hotspotKindLabels: catalog.hotspotKindLabels
            });
        } catch (error) {
            logger.error('Catalog params error', error);
            return res.status(500).json({
                success: false,
                error: 'Could not load catalog parameters'
            });
        }
    });

    return router;
};

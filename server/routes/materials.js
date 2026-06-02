/**
 * ============================================
 * BALCONY PRO - materials routes
 * ============================================
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { MaterialIntelligenceBot } = require('../utils/material-intelligence-bot');
const { buildMaterialAdaptationPayload } = require('../plugins/material-adaptation-plugin');
const logger = require('../utils/logger');
const { cleanId, cleanNumber, cleanObject, cleanString } = require('../utils/validation');

const router = express.Router();

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.jpe', '.png', '.webp']);
const TECHNICAL_TEXTURE_PATTERN = /(normal|rough|ao|ambient|occlusion|height|disp|metal|spec|gloss)/i;
const ASSET_OVERRIDES_CACHE_MS = 60000;

module.exports = function createMaterialsRouter(deps) {
    const { db } = deps;
    const materialsRoot = path.join(process.cwd(), 'public', 'assets', 'pbr');
    const intelligenceBot = new MaterialIntelligenceBot({ projectRoot: process.cwd() });
    let assetPayloadCache = {
        expiresAt: 0,
        value: null
    };

    const toPublicAssetPath = (absolutePath) => {
        const relative = path.relative(path.join(process.cwd(), 'public'), absolutePath);
        return `/${relative.replace(/\\/g, '/')}`;
    };

    const readDirSafe = (folderPath) => {
        try {
            return fs.readdirSync(folderPath, { withFileTypes: true });
        } catch (error) {
            logger.warn('Material assets directory read failed', {
                folderPath,
                error: error.message
            });
            return [];
        }
    };

    const statSafe = (filePath) => {
        try {
            return fs.statSync(filePath);
        } catch (error) {
            logger.warn('Material asset stat failed', {
                filePath,
                error: error.message
            });
            return null;
        }
    };

    const listCandidateImages = (folderPath) => {
        const entries = readDirSafe(folderPath);

        return entries
            .filter((entry) => entry.isFile())
            .map((entry) => {
                const ext = path.extname(entry.name).toLowerCase();
                if (!IMAGE_EXTENSIONS.has(ext)) return null;
                if (TECHNICAL_TEXTURE_PATTERN.test(entry.name)) return null;

                const fullPath = path.join(folderPath, entry.name);
                const stat = statSafe(fullPath);
                if (!stat) return null;
                return {
                    fullPath,
                    modifiedAt: stat.mtimeMs
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.modifiedAt - a.modifiedAt);
    };

    const collectAssetOverrides = () => {
        if (!fs.existsSync(materialsRoot)) {
            return {};
        }

        const overrides = {};
        const categoryDirs = readDirSafe(materialsRoot)
            .filter((entry) => entry.isDirectory());

        categoryDirs.forEach((categoryDir) => {
            const categoryPath = path.join(materialsRoot, categoryDir.name);
            const materialDirs = readDirSafe(categoryPath)
                .filter((entry) => entry.isDirectory());

            materialDirs.forEach((materialDir) => {
                const folderPath = path.join(categoryPath, materialDir.name);
                const candidates = listCandidateImages(folderPath);
                if (!candidates.length) return;

                const preview = candidates[0];
                const color = candidates[1] || preview;

                overrides[materialDir.name] = {
                    preview: toPublicAssetPath(preview.fullPath),
                    maps: {
                        color: toPublicAssetPath(color.fullPath)
                    }
                };
            });
        });

        return overrides;
    };

    const getCachedAssetPayload = () => {
        const now = Date.now();
        if (assetPayloadCache.value && assetPayloadCache.expiresAt > now) {
            return assetPayloadCache.value;
        }

        const scanResult = intelligenceBot.scanMaterialFolders();
        const adaptation = buildMaterialAdaptationPayload(scanResult);
        const value = {
            overrides: {
                ...collectAssetOverrides(),
                ...adaptation.overrides
            },
            profiles: adaptation.profiles,
            stats: adaptation.stats
        };

        assetPayloadCache = {
            value,
            expiresAt: now + ASSET_OVERRIDES_CACHE_MS
        };
        return value;
    };

    // GET /api/materials
    router.get('/', (req, res) => {
        try {
            const materials = db.getAllMaterials();
            res.json({
                success: true,
                materials
            });
        } catch (error) {
            logger.error('Get materials error', error);
            res.status(500).json({
                success: false,
                error: 'Не удалось получить материалы'
            });
        }
    });

    // GET /api/materials/asset-overrides
    router.get('/asset-overrides', (req, res) => {
        try {
            const payload = getCachedAssetPayload();
            res.json({
                success: true,
                overrides: payload.overrides,
                profiles: payload.profiles,
                stats: payload.stats
            });
        } catch (error) {
            logger.error('Get material asset overrides error', error);
            res.status(500).json({
                success: false,
                error: 'Не удалось получить текстуры материалов'
            });
        }
    });

    // GET /api/materials/:category
    router.get('/:category', (req, res) => {
        try {
            const category = cleanId(req.params.category);
            const materials = db.getMaterialsByCategory(category);

            res.json({
                success: true,
                materials
            });
        } catch (error) {
            logger.error('Get materials by category error', error);
            res.status(500).json({
                success: false,
                error: 'Не удалось получить материалы категории'
            });
        }
    });

    // GET /api/materials/:category/:id
    router.get('/:category/:id', (req, res) => {
        try {
            const category = cleanId(req.params.category);
            const id = cleanId(req.params.id);
            const material = db.getMaterialById(category, id);

            if (!material) {
                return res.status(404).json({
                    success: false,
                    error: 'Материал не найден'
                });
            }

            return res.json({
                success: true,
                material
            });
        } catch (error) {
            logger.error('Get material error', error);
            return res.status(500).json({
                success: false,
                error: 'Не удалось получить материал'
            });
        }
    });

    // POST /api/materials
    router.post('/', (req, res) => {
        try {
            const materialData = cleanObject(req.body);
            const requiredFields = ['name', 'category', 'price', 'unit'];
            const missingFields = requiredFields.filter((field) => !materialData[field]);

            if (missingFields.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: `Не заполнены обязательные поля: ${missingFields.join(', ')}`
                });
            }

            const material = db.addMaterial({
                id: cleanId(materialData.id),
                name: cleanString(materialData.name, { max: 160 }),
                category: cleanId(materialData.category),
                price: cleanNumber(materialData.price, { min: 0, max: 10000000, fallback: 0 }),
                unit: cleanString(materialData.unit, { max: 40 }),
                description: cleanString(materialData.description, { max: 1000 }),
                color: cleanString(materialData.color, { max: 40 }),
                texture: cleanString(materialData.texture, { max: 120 }),
                popular: Boolean(materialData.popular)
            });
            return res.status(201).json({
                success: true,
                material
            });
        } catch (error) {
            logger.error('Add material error', error);
            return res.status(500).json({
                success: false,
                error: 'Не удалось добавить материал'
            });
        }
    });

    // PUT /api/materials/:category/:id
    router.put('/:category/:id', (req, res) => {
        try {
            const category = cleanId(req.params.category);
            const id = cleanId(req.params.id);
            const updateData = cleanObject(req.body);

            const updated = db.updateMaterial(category, id, {
                name: cleanString(updateData.name, { max: 160 }),
                price: cleanNumber(updateData.price, { min: 0, max: 10000000, fallback: 0 }),
                unit: cleanString(updateData.unit, { max: 40 }),
                description: cleanString(updateData.description, { max: 1000 }),
                color: cleanString(updateData.color, { max: 40 }),
                texture: cleanString(updateData.texture, { max: 120 }),
                popular: Boolean(updateData.popular)
            });
            if (!updated) {
                return res.status(404).json({
                    success: false,
                    error: 'Материал не найден'
                });
            }

            return res.json({
                success: true,
                material: updated
            });
        } catch (error) {
            logger.error('Update material error', error);
            return res.status(500).json({
                success: false,
                error: 'Не удалось обновить материал'
            });
        }
    });

    // DELETE /api/materials/:category/:id
    router.delete('/:category/:id', (req, res) => {
        try {
            const category = cleanId(req.params.category);
            const id = cleanId(req.params.id);
            const deleted = db.deleteMaterial(category, id);

            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    error: 'Материал не найден'
                });
            }

            return res.json({
                success: true,
                message: 'Материал удалён'
            });
        } catch (error) {
            logger.error('Delete material error', error);
            return res.status(500).json({
                success: false,
                error: 'Не удалось удалить материал'
            });
        }
    });

    return router;
};

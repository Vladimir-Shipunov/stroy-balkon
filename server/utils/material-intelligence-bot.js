const fs = require('fs');
const path = require('path');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.jpe', '.png', '.webp']);
const VARIANT_FOLDER_PATTERN = /^variant-(\d{2})$/i;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalizePath(inputPath) {
    return inputPath.replace(/\\/g, '/');
}

function mapTextureKind(fileName) {
    const lower = fileName.toLowerCase();

    if (/(normal(gl|dx)?|\bnrm\b)/.test(lower)) return 'normal';
    if (/rough/.test(lower)) return 'roughness';
    if (/ambient|occlusion|\bao\b/.test(lower)) return 'ao';
    if (/metal/.test(lower)) return 'metalness';
    if (/height|disp|displacement|bump|relief/.test(lower)) return 'height';
    if (/albedo|basecolor|base_color|color|diff|diffuse/.test(lower)) return 'color';
    return 'preview';
}

function readPngSize(buffer) {
    if (buffer.length < 24) return null;
    const signature = buffer.subarray(0, 8).toString('hex');
    if (signature !== '89504e470d0a1a0a') return null;
    return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20)
    };
}

function readJpegSize(buffer) {
    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

    let offset = 2;
    while (offset + 9 < buffer.length) {
        if (buffer[offset] !== 0xff) {
            offset += 1;
            continue;
        }

        const marker = buffer[offset + 1];
        if (marker === 0xd9 || marker === 0xda) break;

        const length = buffer.readUInt16BE(offset + 2);
        const isSOF =
            marker === 0xc0 || marker === 0xc1 || marker === 0xc2 || marker === 0xc3 ||
            marker === 0xc5 || marker === 0xc6 || marker === 0xc7 ||
            marker === 0xc9 || marker === 0xca || marker === 0xcb ||
            marker === 0xcd || marker === 0xce || marker === 0xcf;

        if (isSOF && offset + 8 < buffer.length) {
            const height = buffer.readUInt16BE(offset + 5);
            const width = buffer.readUInt16BE(offset + 7);
            return { width, height };
        }

        if (length <= 0) break;
        offset += 2 + length;
    }

    return null;
}

function readWebpSize(buffer) {
    if (buffer.length < 30) return null;
    if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return null;
    const chunk = buffer.toString('ascii', 12, 16);

    if (chunk === 'VP8 ') {
        if (buffer.length < 30) return null;
        return {
            width: buffer.readUInt16LE(26) & 0x3fff,
            height: buffer.readUInt16LE(28) & 0x3fff
        };
    }

    if (chunk === 'VP8L') {
        if (buffer.length < 25) return null;
        const b0 = buffer[21];
        const b1 = buffer[22];
        const b2 = buffer[23];
        const b3 = buffer[24];
        return {
            width: 1 + (((b1 & 0x3f) << 8) | b0),
            height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6))
        };
    }

    if (chunk === 'VP8X') {
        if (buffer.length < 30) return null;
        return {
            width: 1 + buffer.readUIntLE(24, 3),
            height: 1 + buffer.readUIntLE(27, 3)
        };
    }

    return null;
}

function readImageInfo(filePath) {
    let fd = null;
    try {
        const ext = path.extname(filePath).toLowerCase();
        if (!IMAGE_EXTENSIONS.has(ext)) return null;

        const stat = fs.statSync(filePath);
        fd = fs.openSync(filePath, 'r');
        const head = Buffer.alloc(512);
        fs.readSync(fd, head, 0, 512, 0);

        let size = null;
        if (ext === '.png') size = readPngSize(head);
        if (ext === '.jpg' || ext === '.jpeg' || ext === '.jpe') size = readJpegSize(head);
        if (ext === '.webp') size = readWebpSize(head);

        return {
            ext,
            width: size?.width || 1024,
            height: size?.height || 1024,
            bytes: stat.size,
            modifiedAt: stat.mtimeMs
        };
    } catch (error) {
        return null;
    } finally {
        if (fd !== null) {
            try {
                fs.closeSync(fd);
            } catch (error) {
                // Ignore close failures: the scanner can safely skip this file.
            }
        }
    }
}

function inferPattern(materialId, fileNames = [], category = '') {
    const id = String(materialId || '').toLowerCase();
    const sample = `${materialId} ${fileNames.join(' ')}`.toLowerCase();

    if (/stone|brick|clinker|travertine|concrete|rock/.test(id)) return 'stone';
    if (/tile|porcelain|ceramic|marble|granite/.test(id)) return 'tile';
    if (/decor.*3d|3d.*panel|relief/.test(id)) return 'decor3d';
    if (/tile|porcelain|ceramic|marble|granite/.test(sample)) return 'tile';
    if (/stone|brick|concrete/.test(sample)) return 'stone';
    if (/wood|parquet|laminate|lining|mdf/.test(sample)) return 'wood';
    if (/pvc|plastic/.test(sample)) return 'pvc';
    if (/stretch|fabric/.test(sample)) return 'stretch';
    if (/metal|alum/.test(sample)) return 'metal';
    if (/vinyl/.test(sample)) return 'vinyl';
    if (category === 'floor') return 'floor-generic';
    if (category === 'ceiling') return 'ceiling-generic';
    return 'wall-generic';
}

function patternDefaults(pattern, category) {
    const defaults = {
        tile: { metersPerRepeat: 2.15, minRepeat: 0.8, maxRepeat: 3.2, roughness: 0.34, metalness: 0.05, normalStrength: 1.25, reliefStrength: 0.55, bumpScale: 0.014 },
        stone: { metersPerRepeat: 1.55, minRepeat: 0.9, maxRepeat: 3.6, roughness: 0.9, metalness: 0.02, normalStrength: 1.75, reliefStrength: 1.35, bumpScale: 0.045 },
        decor3d: { metersPerRepeat: 1.25, minRepeat: 0.8, maxRepeat: 3.4, roughness: 0.76, metalness: 0.02, normalStrength: 1.55, reliefStrength: 1.2, bumpScale: 0.035 },
        wood: { metersPerRepeat: 1.85, minRepeat: 0.75, maxRepeat: 4.4, roughness: 0.58, metalness: 0.04, normalStrength: 0.95, reliefStrength: 0.45, bumpScale: 0.01 },
        pvc: { metersPerRepeat: 1.9, minRepeat: 0.6, maxRepeat: 3.8, roughness: 0.34, metalness: 0.03, normalStrength: 0.75, reliefStrength: 0.25, bumpScale: 0.006 },
        stretch: { metersPerRepeat: 2.4, minRepeat: 0.45, maxRepeat: 2.2, roughness: 0.18, metalness: 0.02, normalStrength: 0.35, reliefStrength: 0.12, bumpScale: 0.002 },
        metal: { metersPerRepeat: 1.45, minRepeat: 0.55, maxRepeat: 3.6, roughness: 0.25, metalness: 0.78, normalStrength: 0.9, reliefStrength: 0.2, bumpScale: 0.004 },
        vinyl: { metersPerRepeat: 1.9, minRepeat: 0.65, maxRepeat: 3.8, roughness: 0.46, metalness: 0.03, normalStrength: 0.9, reliefStrength: 0.35, bumpScale: 0.008 },
        'floor-generic': { metersPerRepeat: 1.9, minRepeat: 0.75, maxRepeat: 3.8, roughness: 0.6, metalness: 0.04, normalStrength: 1.0, reliefStrength: 0.4, bumpScale: 0.01 },
        'ceiling-generic': { metersPerRepeat: 2.4, minRepeat: 0.45, maxRepeat: 2.8, roughness: 0.45, metalness: 0.03, normalStrength: 0.7, reliefStrength: 0.22, bumpScale: 0.005 },
        'wall-generic': { metersPerRepeat: 1.7, minRepeat: 0.7, maxRepeat: 4.0, roughness: 0.62, metalness: 0.03, normalStrength: 1.0, reliefStrength: 0.45, bumpScale: 0.01 }
    };

    const base = defaults[pattern] || defaults['wall-generic'];
    if (category === 'floor') {
        return {
            ...base,
            metersPerRepeat: Math.max(base.metersPerRepeat, pattern === 'tile' ? 2.25 : 1.9),
            minRepeat: Math.max(base.minRepeat, 0.75),
            maxRepeat: Math.min(base.maxRepeat, pattern === 'tile' ? 2.8 : 3.8)
        };
    }
    if (category === 'ceiling') {
        return {
            ...base,
            metersPerRepeat: Math.max(base.metersPerRepeat, 2.2),
            maxRepeat: Math.min(base.maxRepeat, 2.8)
        };
    }
    return base;
}

class MaterialIntelligenceBot {
    constructor({ projectRoot }) {
        this.projectRoot = projectRoot;
        this.publicRoot = path.join(projectRoot, 'public');
        this.rootPbr = path.join(this.publicRoot, 'assets', 'pbr');
        this.rootPbrVariants = path.join(this.publicRoot, 'assets', 'pbr-variants');
    }

    _toPublicPath(absolutePath) {
        const relative = path.relative(this.publicRoot, absolutePath);
        return `/${normalizePath(relative)}`;
    }

    _collectFolderImages(folderPath) {
        let entries = [];
        try {
            entries = fs.readdirSync(folderPath, { withFileTypes: true });
        } catch (error) {
            return [];
        }
        return entries
            .filter((entry) => entry.isFile())
            .map((entry) => {
                const absolutePath = path.join(folderPath, entry.name);
                const info = readImageInfo(absolutePath);
                if (!info) return null;
                return {
                    name: entry.name,
                    path: absolutePath,
                    publicPath: this._toPublicPath(absolutePath),
                    kind: mapTextureKind(entry.name),
                    ...info
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.modifiedAt - a.modifiedAt);
    }

    _scanBaseMaterials() {
        const records = [];
        if (!fs.existsSync(this.rootPbr)) return records;

        let categories = [];
        try {
            categories = fs.readdirSync(this.rootPbr, { withFileTypes: true }).filter((x) => x.isDirectory());
        } catch (error) {
            return records;
        }
        categories.forEach((categoryEntry) => {
            const category = categoryEntry.name;
            const categoryPath = path.join(this.rootPbr, category);
            let materials = [];
            try {
                materials = fs.readdirSync(categoryPath, { withFileTypes: true }).filter((x) => x.isDirectory());
            } catch (error) {
                return;
            }

            materials.forEach((materialEntry) => {
                const materialId = materialEntry.name;
                const folderPath = path.join(categoryPath, materialId);
                const files = this._collectFolderImages(folderPath);
                if (!files.length) return;

                records.push({
                    materialId,
                    category,
                    isVariant: false,
                    files
                });
            });
        });

        return records;
    }

    _scanVariantMaterials() {
        const records = [];
        if (!fs.existsSync(this.rootPbrVariants)) return records;

        let categories = [];
        try {
            categories = fs.readdirSync(this.rootPbrVariants, { withFileTypes: true }).filter((x) => x.isDirectory());
        } catch (error) {
            return records;
        }
        categories.forEach((categoryEntry) => {
            const category = categoryEntry.name;
            const categoryPath = path.join(this.rootPbrVariants, category);
            let baseMaterials = [];
            try {
                baseMaterials = fs.readdirSync(categoryPath, { withFileTypes: true }).filter((x) => x.isDirectory());
            } catch (error) {
                return;
            }

            baseMaterials.forEach((baseEntry) => {
                const baseId = baseEntry.name;
                const basePath = path.join(categoryPath, baseId);
                let variantDirs = [];
                try {
                    variantDirs = fs.readdirSync(basePath, { withFileTypes: true }).filter((x) => x.isDirectory());
                } catch (error) {
                    return;
                }

                variantDirs.forEach((variantEntry) => {
                    const match = VARIANT_FOLDER_PATTERN.exec(variantEntry.name);
                    if (!match) return;

                    const variantNum = match[1];
                    const materialId = `${baseId}-v${variantNum}`;
                    const folderPath = path.join(basePath, variantEntry.name);
                    const files = this._collectFolderImages(folderPath);
                    if (!files.length) return;

                    records.push({
                        materialId,
                        category,
                        isVariant: true,
                        baseMaterialId: baseId,
                        files
                    });
                });
            });
        });

        return records;
    }

    _selectBestFiles(files) {
        const byKind = (kind) => files.find((file) => file.kind === kind) || null;
        const nonTechnical = files.filter((file) => file.kind === 'preview' || file.kind === 'color');
        const largestNonTechnical = [...nonTechnical].sort((a, b) => (b.width * b.height) - (a.width * a.height))[0] || null;

        const preview = largestNonTechnical || byKind('color') || files[0] || null;
        const color = byKind('color') || preview;

        return {
            preview,
            maps: {
                color,
                normal: byKind('normal'),
                roughness: byKind('roughness'),
                ao: byKind('ao'),
                metalness: byKind('metalness'),
                height: byKind('height')
            }
        };
    }

    _buildProfile(record, selected) {
        const colorOrPreview = selected.maps.color || selected.preview;
        if (!colorOrPreview) return null;

        const pixelCount = Math.max(1, colorOrPreview.width * colorOrPreview.height);
        const qualityFactor = clamp(Math.sqrt(pixelCount) / 1024, 0.55, 2.8);
        const aspectRatio = colorOrPreview.width / Math.max(1, colorOrPreview.height);
        const pattern = inferPattern(record.materialId, record.files.map((f) => f.name), record.category);
        const defaults = patternDefaults(pattern, record.category);
        const detailScale = pattern === 'tile' || pattern === 'stone' || pattern === 'decor3d'
            ? clamp(1 / Math.sqrt(qualityFactor), 0.88, 1.12)
            : clamp(1 / qualityFactor, 0.82, 1.35);

        const hasNormal = Boolean(selected.maps.normal);
        const hasRoughness = Boolean(selected.maps.roughness);
        const hasHeight = Boolean(selected.maps.height);

        return {
            pattern,
            source: 'local-ai-bot',
            qualityScore: Math.round(clamp(qualityFactor / 2.5, 0, 1) * 100) / 100,
            aspectRatio: Math.round(aspectRatio * 100) / 100,
            metersPerRepeat: Math.round((defaults.metersPerRepeat * detailScale) * 100) / 100,
            minRepeat: defaults.minRepeat,
            maxRepeat: defaults.maxRepeat,
            roughness: hasRoughness ? null : defaults.roughness,
            metalness: defaults.metalness,
            normalStrength: hasNormal ? Math.max(1.2, defaults.normalStrength) : defaults.normalStrength,
            reliefStrength: hasHeight || hasNormal ? defaults.reliefStrength : Math.max(defaults.reliefStrength, pattern === 'stone' ? 1.2 : 0.45),
            bumpScale: defaults.bumpScale,
            useGeneratedRelief: !hasNormal || pattern === 'stone' || pattern === 'decor3d',
            preserveMotif: pattern === 'tile' || pattern === 'stone' || pattern === 'decor3d',
            useTriplanarHint: record.category === 'walls' && pattern === 'stone'
        };
    }

    scanMaterialFolders() {
        const allRecords = [
            ...this._scanBaseMaterials(),
            ...this._scanVariantMaterials()
        ];

        const payload = {
            overrides: {},
            profiles: {},
            stats: {
                materialsDetected: 0,
                variantMaterialsDetected: 0,
                imagesDetected: 0
            }
        };

        allRecords.forEach((record) => {
            const selected = this._selectBestFiles(record.files);
            if (!selected.preview && !selected.maps.color) return;

            const overrideMaps = {};
            Object.entries(selected.maps).forEach(([mapKey, file]) => {
                if (!file) return;
                overrideMaps[mapKey] = file.publicPath;
            });

            payload.overrides[record.materialId] = {
                preview: selected.preview ? selected.preview.publicPath : (selected.maps.color?.publicPath || null),
                maps: overrideMaps
            };

            const profile = this._buildProfile(record, selected);
            if (profile) {
                payload.profiles[record.materialId] = profile;
            }

            payload.stats.materialsDetected += 1;
            if (record.isVariant) {
                payload.stats.variantMaterialsDetected += 1;
            }
            payload.stats.imagesDetected += record.files.length;
        });

        return payload;
    }
}

module.exports = {
    MaterialIntelligenceBot
};

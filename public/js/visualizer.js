/**
 * ============================================
 * ============================================
 */

// ============================================
// ============================================
class BalconyVisualizer {
    constructor(containerId, options = {}) {
        // ============================================
        // ============================================
        this.config = {
            containerId: containerId,
            width: options.width || 1200,
            height: options.height || 800,
            backgroundColor: options.backgroundColor || 0x87ceeb,
            gridColor: options.gridColor || 0xcccccc,
            axisColors: {
                x: 0xff0000,
                y: 0x00ff00,
                z: 0x0000ff
            },
            camera: {
                fov: 64,
                near: 0.01,
                far: 1000,
                position: { x: 0, y: 1.65, z: -0.35 },
                initialLookAt: { x: 0, y: 1.55, z: 1.5 }
            },
            lighting: {
                ambient: 0.78,
                directional: 1.05,
                hemisphere: 0.65,
                interior: 0.62
            },
            controls: {
                enableRotate: true,
                enableZoom: false,
                enablePan: false,
                minDistance: 1.2,
                maxDistance: 1.2,
                rotateSpeed: 0.5,
                zoomSpeed: 1.2
            },
            quality: {
                antialias: true,
                shadowMap: true,
                pixelRatio: Math.min(window.devicePixelRatio, 1.5),
                textureQuality: 'high'
            },
            exterior: {
                enabled: true,
                distance: 50,
                skyColor: 0x87ceeb,
                groundColor: 0x3d5c5c,
                showBuildings: true,
                showTrees: true,
                timeOfDay: 'day'
            }
        };

        // ============================================
        // ============================================
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.clock = null;
        this.composer = null;

        // ============================================
        // ============================================
        this.balconyGroup = null;
        this.exteriorGroup = null;
        this.walls = {};
        this.ceiling = null;
        this.floor = null;
        this.windows = [];
        this.lightingObjects = [];
        this.furnitureObjects = [];
        this.slatPanelObjects = [];
        this.cameraBounds = null;
        this.interiorCameraAnchor = null;
        this.interiorLookDistance = 1.55;
        this.interiorFov = this.config.camera.fov;
        this.helpers = {};
        this.markers = [];
        this.clips = [];

        // ============================================
        // ============================================
        this.state = {
            isLoaded: false,
            isAnimating: false,
            placementMode: null,
            editingFurnitureId: null,
            selectedElement: null,
            viewMode: 'interior',
            showGrid: false,
            showAxes: false,
            showWireframe: false,
            isFullscreen: false,
            currentBalconyType: 'loggia-3',
            materialsLoaded: false,
            exteriorLoaded: false
        };

        // ============================================
        // ============================================
        this.builder = null;
        this.container = null;
        this.animationFrame = null;
        this.materialsCache = {};
        this.texturesCache = {};
        this.materialLoadPromises = {};
        this.textureLoadPromises = {};
        this.textureFailureCache = {};
        this.stoneReliefObjects = [];
        this.slatPanelObjects = [];
        this.textureRetryCooldownMs = 30000;
        this.lastBuilderSnapshot = null;
        this.lastGeometryKey = null;
        this.cabinetDoorStates = {};
        this.updateScheduled = false;
        this.updateFrame = null;
        this.placementPreview = null;
        this.renderActiveUntil = 0;
        this.forceRender = true;
        this._managedIntervals = [];

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // ============================================
        // ============================================
        this.callbacks = {
            onObjectClick: [],
            onPlacement: [],
            onLoad: [],
            onError: [],
            onMaterialChange: [],
            onViewChange: [],
            onExteriorUpdate: []
        };

        this.init();
    }

    setFurnitureEditTarget(furnitureId) {
        this.state.editingFurnitureId = furnitureId || null;
    }

    // ============================================
    // ============================================

    /**
     */
    init() {
        try {
            console.log('?? Initializing BalconyPro Visualizer v3.0.0...');
            
            this.container = document.getElementById(this.config.containerId);
            if (!this.container) {
                throw new Error(`Container ${this.config.containerId} not found`);
            }

            console.log('? Container found:', this.container);

            this._createScene();

            this._createCamera();

            this._createRenderer();

            if (typeof THREE.EffectComposer !== 'undefined') {
    this._initPostProcessing();
            }

            this._createLighting();

            this._createControls();
            if (this.controls) {
                this.controls.maxPolarAngle = Math.PI * 0.86;
                this.controls.minPolarAngle = Math.PI * 0.18;
                this.controls.enableZoom = false;
                this.controls.enablePan = false;
            }

            this._createHelpers();

            this._createExterior();

            this._createBalcony();

            this._setupEventListeners();

            this._startAnimation();

            this._onResize();

            this._loadDefaultTextures();

            const overlay = document.getElementById('visualizerOverlay');
            if (overlay) {
                overlay.classList.add('hidden');
            }

            this.state.isLoaded = true;
            this._notifyLoad();

            console.log('? BalconyVisualizer initialized successfully');
            console.log('?? Stats:', this.getSceneStats());

        } catch (error) {
            console.error('? Visualizer initialization error:', error);
            this._notifyError(error);
            
            const overlay = document.getElementById('visualizerOverlay');
            if (overlay) {
                overlay.innerHTML = `
                    <div style="color: white; text-align: center; padding: 20px;">
                        <div style="font-size: 48px; margin-bottom: 10px;">??</div>
                        <div style="font-size: 18px; margin-bottom: 10px;">������ �������� 3D</div>
                        <div style="font-size: 14px; opacity: 0.8;">${error.message}</div>
                        <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; cursor: pointer;">�������������</button>
                    </div>
                `;
                overlay.classList.remove('hidden');
            }
        }
    }

    _preloadCatalogTextures() {
        if (typeof MaterialsAPI === 'undefined') return;

        ['walls', 'ceiling', 'floor'].forEach((category) => {
            MaterialsAPI.getByCategory(category).forEach((material) => {
                this._ensureMaterialTexturePack(material, false);
            });
        });
    }

    _resolveMaterialLookupElement(element) {
        if (!element || !element.startsWith('walls_')) {
            return element;
        }

        if (element === 'walls_extension' || element === 'walls_front_p') {
            return 'walls_front';
        }

        return element;
    }

    _ensureMaterialTexturePack(material, triggerUpdate = true) {
        if (!material?.id || typeof MaterialsAPI === 'undefined') return null;

        const cached = this.materialsCache[material.id];
        if (cached?.status === 'loaded') {
            return cached.textures;
        }
        if (cached?.status === 'failed' && cached.failedAt && (Date.now() - cached.failedAt) < this.textureRetryCooldownMs) {
            return null;
        }

        if (this.materialLoadPromises[material.id]) {
            return null;
        }

        const maps = MaterialsAPI.getPBRMaps(material);
        if (!maps?.color) {
            return null;
        }

        const loaders = Object.entries(maps)
            .filter(([, url]) => typeof url === 'string' && /\.(jpg|jpeg|png|webp)$/i.test(url))
            .map(([type, url]) => this.loadTexture(url)
                .then((texture) => {
                    this._configurePBRTexture(texture, type);
                    return [type, texture];
                })
                .catch(() => null));

        if (!loaders.length) {
            return null;
        }

        this.materialsCache[material.id] = { status: 'loading', textures: null };
        this.materialLoadPromises[material.id] = Promise.all(loaders)
            .then((entries) => {
                const textures = Object.fromEntries(entries.filter(Boolean));
                delete this.materialLoadPromises[material.id];

                if (!Object.keys(textures).length) {
                    this.materialsCache[material.id] = { status: 'failed', textures: null, failedAt: Date.now() };
                    return null;
                }

                this.materialsCache[material.id] = { status: 'loaded', textures };
                if (triggerUpdate) {
                    this.requestUpdate();
                }

                return textures;
            })
            .catch((error) => {
                console.warn('Texture pack load failed:', material.id, error);
                this.materialsCache[material.id] = { status: 'failed', textures: null, failedAt: Date.now() };
                delete this.materialLoadPromises[material.id];
                return null;
            });

        return null;
    }

    _configurePBRTexture(texture, type) {
        if (!texture) return;

        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.anisotropy = Math.min(8, this.renderer?.capabilities?.getMaxAnisotropy?.() || 1);

        if (type === 'color') {
            texture.encoding = THREE.sRGBEncoding;
        }
    }

    _getMaterialAIProfile(materialId) {
        if (!materialId || typeof MaterialsAPI === 'undefined' || typeof MaterialsAPI.getAIProfile !== 'function') {
            return null;
        }
        return MaterialsAPI.getAIProfile(materialId) || null;
    }

    _isExactPhotoStoneMaterial(materialOrId) {
        const materialId = typeof materialOrId === 'string' ? materialOrId : materialOrId?.id;
        return typeof materialId === 'string' && materialId.startsWith('wall-artificial-stone');
    }

    _getPhotoStoneRepeat(surfaceElement, sizeX, sizeY, materialId = '') {
        const targetTileWidth = 0.86;
        const targetTileHeight = 0.66;
        const minRepeatX = surfaceElement === 'walls_left' || surfaceElement === 'walls_right' ? 1.35 : 2.6;
        const repeatX = THREE.MathUtils.clamp(sizeX / targetTileWidth, minRepeatX, 5.2);
        const repeatY = THREE.MathUtils.clamp(sizeY / targetTileHeight, 3.2, 5.4);

        return { repeatX, repeatY };
    }

    _getTextureRepeatForElement(surfaceElement, fallbackType, materialId = '') {
        const dimensions = this.builder?.dimensions || { length: 3, width: 1.4, height: 2.7 };
        const { sizeX, sizeY } = this._getNominalSurfaceSize(surfaceElement, dimensions);

        let metersPerRepeat = 1.55;
        let minRepeat = 0.75;
        let maxRepeat = 4.2;
        if (fallbackType === 'tile') {
            metersPerRepeat = 2.15;
            minRepeat = 0.8;
            maxRepeat = 3.2;
        } else if (fallbackType === 'stone') {
            metersPerRepeat = 1.55;
            minRepeat = 0.9;
            maxRepeat = 3.6;
        } else if (fallbackType === 'decor3d') {
            metersPerRepeat = 1.25;
            minRepeat = 0.8;
            maxRepeat = 3.4;
        } else if (fallbackType === 'slats') {
            metersPerRepeat = 1.15;
            maxRepeat = 3.8;
        } else if (fallbackType === 'stretch') {
            metersPerRepeat = 2.4;
            minRepeat = 0.45;
            maxRepeat = 2.4;
        } else if (fallbackType === 'wood' || fallbackType === 'lining' || fallbackType === 'laminate' || fallbackType === 'parquet' || fallbackType === 'mdf' || fallbackType === 'pvc' || fallbackType === 'vinyl') {
            metersPerRepeat = 1.85;
            maxRepeat = 4;
        }

        if (surfaceElement === 'floor') {
            // Never sample only a tiny fraction of floor textures:
            // full texture footprint keeps the structure visible and distinctive.
            minRepeat = Math.max(minRepeat, 1);
        }

        if (surfaceElement === 'floor' && typeof materialId === 'string') {
            if (materialId.startsWith('floor-quartz-vinyl')) {
                metersPerRepeat = 2.25;
                minRepeat = 0.75;
                maxRepeat = 3.2;
            } else if (materialId.startsWith('floor-laminate')) {
                metersPerRepeat = 2.2;
                minRepeat = 0.7;
                maxRepeat = 3.4;
            } else if (materialId.startsWith('floor-parquet-board')) {
                metersPerRepeat = 2.05;
                minRepeat = 0.75;
                maxRepeat = 3.3;
            } else if (materialId.startsWith('floor-tile-porcelain')) {
                metersPerRepeat = 2.35;
                minRepeat = 0.8;
                maxRepeat = 2.8;
            }
        }

        if (this._isExactPhotoStoneMaterial(materialId)) {
            return this._getPhotoStoneRepeat(surfaceElement, sizeX, sizeY, materialId);
        }

        const repeatX = THREE.MathUtils.clamp(sizeX / metersPerRepeat, minRepeat, maxRepeat);
        const repeatY = THREE.MathUtils.clamp(sizeY / metersPerRepeat, minRepeat, maxRepeat);

        const aiProfile = this._getMaterialAIProfile(materialId);
        if (aiProfile) {
            const aiMetersPerRepeat = Number(aiProfile.metersPerRepeat);
            const aiMinRepeat = Number(aiProfile.minRepeat);
            const aiMaxRepeat = Number(aiProfile.maxRepeat);
            const aspectRatio = Number(aiProfile.aspectRatio);

            if (Number.isFinite(aiMetersPerRepeat) && aiMetersPerRepeat > 0) {
                metersPerRepeat = aiMetersPerRepeat;
            }
            if (Number.isFinite(aiMinRepeat) && aiMinRepeat > 0) {
                minRepeat = aiMinRepeat;
            }
            if (Number.isFinite(aiMaxRepeat) && aiMaxRepeat > 0) {
                maxRepeat = aiMaxRepeat;
            }
            if (aiProfile.preserveMotif) {
                maxRepeat = Math.min(maxRepeat, surfaceElement === 'floor' || surfaceElement === 'ceiling' ? 2.8 : 3.4);
                minRepeat = Math.max(minRepeat, 0.75);
            }

            const clampedX = THREE.MathUtils.clamp(sizeX / metersPerRepeat, minRepeat, maxRepeat);
            const clampedYBase = THREE.MathUtils.clamp(sizeY / metersPerRepeat, minRepeat, maxRepeat);
            const clampedRatio = Number.isFinite(aspectRatio)
                ? THREE.MathUtils.clamp(aspectRatio, 0.35, 2.8)
                : 1;
            const clampedY = THREE.MathUtils.clamp(clampedYBase / clampedRatio, minRepeat, maxRepeat);
            return { repeatX: clampedX, repeatY: clampedY };
        }

        return { repeatX, repeatY };
    }

    _getNominalSurfaceSize(surfaceElement, dimensions = this.builder?.dimensions || { length: 3, width: 1.4, height: 2.7 }) {
        switch (surfaceElement) {
            case 'floor':
            case 'ceiling':
                return {
                    sizeX: Math.max(dimensions.length, 1),
                    sizeY: Math.max(dimensions.width, 1)
                };
            case 'walls_front':
            case 'walls_back':
            case 'walls_front_p':
            case 'walls_extension':
                return {
                    sizeX: Math.max(dimensions.length, 1),
                    sizeY: Math.max(dimensions.height, 1)
                };
            case 'walls_left':
            case 'walls_right':
                return {
                    sizeX: Math.max(dimensions.width, 1),
                    sizeY: Math.max(dimensions.height, 1)
                };
            default:
                return {
                    sizeX: Math.max((dimensions.length + dimensions.width) / 2, 1),
                    sizeY: Math.max(dimensions.height, 1)
                };
        }
    }

    _cloneTextureForSurface(texture, repeatX, repeatY, type = 'color') {
        if (!texture) return null;

        const surfaceTexture = texture.clone();
        const repeatMode = THREE.MirroredRepeatWrapping || THREE.RepeatWrapping;
        surfaceTexture.wrapS = repeatMode;
        surfaceTexture.wrapT = repeatMode;
        surfaceTexture.repeat.set(repeatX, repeatY);
        surfaceTexture.offset.set(0.0015, 0.0015);
        surfaceTexture.anisotropy = Math.min(12, this.renderer?.capabilities?.getMaxAnisotropy?.() || 1);
        surfaceTexture.minFilter = THREE.LinearMipMapLinearFilter;
        surfaceTexture.magFilter = THREE.LinearFilter;

        if (type === 'color') {
            surfaceTexture.encoding = THREE.sRGBEncoding;
        } else if (typeof THREE.LinearEncoding !== 'undefined') {
            surfaceTexture.encoding = THREE.LinearEncoding;
        }

        surfaceTexture.needsUpdate = true;
        return surfaceTexture;
    }

    _scaleMaterialTextureRepeat(material, scaleX = 1, scaleY = 1) {
        if (!material) return;
        const materials = Array.isArray(material) ? material : [material];
        const mapKeys = ['map', 'normalMap', 'roughnessMap', 'aoMap', 'bumpMap', 'displacementMap'];

        materials.forEach((entry) => {
            if (!entry) return;
            mapKeys.forEach((key) => {
                const texture = entry[key];
                if (!texture?.repeat) return;
                texture.repeat.set(
                    Math.max(0.25, texture.repeat.x * scaleX),
                    Math.max(0.25, texture.repeat.y * scaleY)
                );
                texture.needsUpdate = true;
            });
        });
    }

    _fitMaterialRepeatToSurface(material, elementName, surfaceWidth, surfaceHeight) {
        if (!material || !surfaceWidth || !surfaceHeight) return;

        const lookupElement = this._resolveMaterialLookupElement(
            String(elementName || '').startsWith('wall_')
                ? String(elementName).replace('wall_', 'walls_')
                : elementName
        );
        if (this._fitPanelTextureRepeatToWallStable(material, lookupElement, surfaceWidth, surfaceHeight)) {
            return;
        }

        const nominal = this._getNominalSurfaceSize(lookupElement);
        const scaleX = THREE.MathUtils.clamp(surfaceWidth / nominal.sizeX, 0.18, 2.4);
        const scaleY = THREE.MathUtils.clamp(surfaceHeight / nominal.sizeY, 0.16, 2.0);

        this._scaleMaterialTextureRepeat(material, scaleX, scaleY);
    }

    _fitPanelTextureRepeatToWallStable(material, elementName, surfaceWidth, surfaceHeight) {
        if (!String(elementName || '').startsWith('walls_')) {
            return false;
        }

        const selectedMaterial = this.builder?.getMaterial(elementName);
        const textureName = String(selectedMaterial?.texture || selectedMaterial?.id || '').toLowerCase();
        const isPanelMaterial = /lining|mdf|pvc|slat|reik/.test(textureName);
        if (!isPanelMaterial) {
            return false;
        }

        const materials = Array.isArray(material) ? material : [material];
        const mapKeys = ['map', 'normalMap', 'roughnessMap', 'aoMap', 'bumpMap', 'displacementMap'];
        let sourceSpacingPx = 22;
        let metersPerPanel = 0.12;

        if (textureName.includes('mdf')) {
            sourceSpacingPx = 34;
            metersPerPanel = 0.18;
        } else if (textureName.includes('pvc')) {
            sourceSpacingPx = 26;
            metersPerPanel = 0.16;
        } else if (textureName.includes('slat') || textureName.includes('reik')) {
            sourceSpacingPx = 18;
            metersPerPanel = 0.09;
        }

        const panelTextureColumns = 512 / sourceSpacingPx;
        const repeatX = THREE.MathUtils.clamp(surfaceWidth / (metersPerPanel * panelTextureColumns), 0.035, 1.6);
        const repeatY = THREE.MathUtils.clamp(surfaceHeight / 2.7, 0.65, 1.35);

        materials.forEach((entry) => {
            if (!entry) return;
            mapKeys.forEach((key) => {
                const texture = entry[key];
                if (!texture?.repeat) return;
                texture.repeat.set(repeatX, repeatY);
                texture.needsUpdate = true;
            });
        });

        return true;
    }

    _fitPanelTextureRepeatToWall(material, elementName, surfaceWidth, surfaceHeight) {
        if (!String(elementName || '').startsWith('walls_')) {
            return false;
        }

        const selectedMaterial = this.builder?.getMaterial(elementName);
        const textureName = String(selectedMaterial?.texture || selectedMaterial?.id || '').toLowerCase();
        const isPanelMaterial = /lining|mdf|pvc|slat|reik|рейк/.test(textureName);
        if (!isPanelMaterial) {
            return false;
        }

        const materials = Array.isArray(material) ? material : [material];
        const mapKeys = ['map', 'normalMap', 'roughnessMap', 'aoMap', 'bumpMap', 'displacementMap'];
        const panelTextureColumns = textureName.includes('slat') || textureName.includes('reik') || textureName.includes('рейк')
            ? 512 / 18
            : 512 / 22;
        const metersPerPanel = 0.14;
        const repeatX = THREE.MathUtils.clamp(surfaceWidth / (metersPerPanel * panelTextureColumns), 0.035, 1.6);
        const repeatY = THREE.MathUtils.clamp(surfaceHeight / 2.7, 0.65, 1.35);

        materials.forEach((entry) => {
            if (!entry) return;
            mapKeys.forEach((key) => {
                const texture = entry[key];
                if (!texture?.repeat) return;
                texture.repeat.set(repeatX, repeatY);
                texture.needsUpdate = true;
            });
        });

        return true;
    }

    _getReliefSettings(fallbackType, aiProfile = null, isCeiling = false, isFloor = false) {
        const defaults = {
            stone: { normalStrength: 1.75, bumpScale: 0.045, generated: true },
            decor3d: { normalStrength: 1.55, bumpScale: 0.035, generated: true },
            tile: { normalStrength: 1.25, bumpScale: 0.014, generated: true },
            parquet: { normalStrength: 1.0, bumpScale: 0.012, generated: true },
            laminate: { normalStrength: 0.95, bumpScale: 0.01, generated: true },
            wood: { normalStrength: 0.95, bumpScale: 0.01, generated: true },
            lining: { normalStrength: 0.9, bumpScale: 0.009, generated: true },
            pvc: { normalStrength: 0.75, bumpScale: 0.006, generated: false },
            mdf: { normalStrength: 0.85, bumpScale: 0.008, generated: true },
            vinyl: { normalStrength: 0.85, bumpScale: 0.008, generated: true },
            stretch: { normalStrength: 0.35, bumpScale: 0.002, generated: false },
            standard: { normalStrength: 0.8, bumpScale: 0.006, generated: false }
        };

        const base = defaults[fallbackType] || defaults.standard;
        const reliefStrength = Number(aiProfile?.reliefStrength);
        const aiNormalStrength = Number(aiProfile?.normalStrength);
        const aiBumpScale = Number(aiProfile?.bumpScale);
        const surfaceFactor = isCeiling ? 0.65 : (isFloor ? 0.85 : 1);

        return {
            normalStrength: THREE.MathUtils.clamp(
                Number.isFinite(aiNormalStrength) ? aiNormalStrength : base.normalStrength,
                0.1,
                2.5
            ),
            bumpScale: THREE.MathUtils.clamp(
                (Number.isFinite(aiBumpScale) ? aiBumpScale : base.bumpScale) *
                    (Number.isFinite(reliefStrength) ? THREE.MathUtils.clamp(reliefStrength, 0.25, 2.5) : 1) *
                    surfaceFactor,
                0,
                0.08
            ),
            useGeneratedRelief: Boolean(aiProfile?.useGeneratedRelief) || base.generated
        };
    }

    _getFallbackTextureMaps(cacheKey, fallbackType, surfaceElement, isCeiling = false, isFloor = false) {
        const sourceTexture = this.texturesCache[cacheKey];
        if (!sourceTexture) {
            return {};
        }

        const { repeatX, repeatY } = this._getTextureRepeatForElement(surfaceElement, fallbackType, '');
        const reliefSettings = this._getReliefSettings(fallbackType, null, isCeiling, isFloor);
        const maps = {
            map: this._cloneTextureForSurface(sourceTexture, repeatX, repeatY, 'color')
        };

        if (reliefSettings.useGeneratedRelief) {
            maps.bumpMap = this._cloneTextureForSurface(sourceTexture, repeatX, repeatY, 'height');
            maps.bumpScale = reliefSettings.bumpScale;
        }

        return maps;
    }

    _buildSurfaceMaterial(materialOptions) {
        const material = new THREE.MeshStandardMaterial(materialOptions);
        material.userData = {
            ...(material.userData || {}),
            surfaceTextureClones: true
        };
        return material;
    }

    _buildCatalogMaterial(material, fallbackType, color, isCeiling = false, isFloor = false, surfaceElement = '') {
        const pack = material?.id ? this._ensureMaterialTexturePack(material) : null;
        if (!pack?.color) {
            return null;
        }

        const exactPhotoStone = this._isExactPhotoStoneMaterial(material);
        const { repeatX, repeatY } = this._getTextureRepeatForElement(surfaceElement, fallbackType, material?.id || '');
        const aiProfile = this._getMaterialAIProfile(material?.id || '');
        const surfacePack = {};
        ['color', 'normal', 'roughness', 'ao', 'height'].forEach((mapKey) => {
            surfacePack[mapKey] = this._cloneTextureForSurface(pack[mapKey], repeatX, repeatY, mapKey);
        });
        const reliefSettings = this._getReliefSettings(fallbackType, aiProfile, isCeiling, isFloor);

        const materialOptions = {
            color: exactPhotoStone ? 0xffffff : color,
            map: surfacePack.color,
            normalMap: surfacePack.normal || null,
            roughnessMap: surfacePack.roughness || null,
            aoMap: surfacePack.ao || null,
            side: isCeiling ? THREE.DoubleSide : THREE.FrontSide
        };

        if (materialOptions.normalMap) {
            materialOptions.normalScale = new THREE.Vector2(reliefSettings.normalStrength, reliefSettings.normalStrength);
        } else if (surfacePack.height || reliefSettings.useGeneratedRelief) {
            materialOptions.bumpMap = surfacePack.height || this._cloneTextureForSurface(pack.color, repeatX, repeatY, 'height');
            materialOptions.bumpScale = exactPhotoStone ? 0.085 : reliefSettings.bumpScale;
        }

        if (isFloor) {
            const baseColor = color && color.isColor ? color.clone() : new THREE.Color(color);
            const floorShade = fallbackType === 'tile' ? 0.82 : 0.86;
            materialOptions.color = baseColor.multiplyScalar(floorShade);
            if (!materialOptions.normalScale && materialOptions.normalMap) {
                materialOptions.normalScale = new THREE.Vector2(1.2, 1.2);
            }
        }

        switch (fallbackType) {
            case 'stone':
                materialOptions.roughness = exactPhotoStone ? 0.86 : 0.92;
                materialOptions.metalness = 0.02;
                materialOptions.envMapIntensity = exactPhotoStone ? 0.24 : materialOptions.envMapIntensity;
                break;
            case 'stretch':
                materialOptions.roughness = 0.18;
                materialOptions.metalness = 0.02;
                materialOptions.envMapIntensity = 0.08;
                break;
            case 'metal':
                materialOptions.roughness = 0.22;
                materialOptions.metalness = 0.82;
                materialOptions.envMapIntensity = 0.8;
                break;
            case 'tile':
                materialOptions.roughness = 0.32;
                materialOptions.metalness = 0.08;
                materialOptions.envMapIntensity = 0.18;
                break;
            default:
                materialOptions.roughness = 0.58;
                materialOptions.metalness = 0.04;
                materialOptions.envMapIntensity = 0.24;
                break;
        }

        if (aiProfile) {
            const aiRoughness = Number(aiProfile.roughness);
            const aiMetalness = Number(aiProfile.metalness);
            const aiNormalStrength = Number(aiProfile.normalStrength);
            if (Number.isFinite(aiRoughness)) {
                materialOptions.roughness = THREE.MathUtils.clamp(aiRoughness, 0.02, 1);
            }
            if (Number.isFinite(aiMetalness)) {
                materialOptions.metalness = THREE.MathUtils.clamp(aiMetalness, 0, 1);
            }
            if (Number.isFinite(aiNormalStrength) && materialOptions.normalMap) {
                const strength = THREE.MathUtils.clamp(aiNormalStrength, 0.1, 2.5);
                materialOptions.normalScale = new THREE.Vector2(strength, strength);
            }
        }

        return this._buildSurfaceMaterial(materialOptions);
    }

    /**
     * @private
     */
    _createScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xdce8f2);
        
        this.scene.fog = new THREE.Fog(
            0xdce8f2,
            14,
            120
        );

        console.log('? Scene created');
    }

    /**
     * @private
     */
    _createCamera() {
        const { fov, near, far } = this.config.camera;
        const aspect = this.container.clientWidth / this.container.clientHeight;

        this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        
        this.camera.position.set(
            this.config.camera.position.x,
            this.config.camera.position.y,
            this.config.camera.position.z
        );
        
        this.camera.lookAt(
            this.config.camera.initialLookAt.x,
            this.config.camera.initialLookAt.y,
            this.config.camera.initialLookAt.z
        );

        console.log('? Camera created at interior position');
    }

    /**
     * @private
     */
    _createRenderer() {
        const { antialias, shadowMap, pixelRatio } = this.config.quality;

        this.renderer = new THREE.WebGLRenderer({ 
            antialias: antialias,
            alpha: true,
            preserveDrawingBuffer: true,
            powerPreference: 'high-performance'
        });

        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(pixelRatio);
        this.renderer.shadowMap.enabled = shadowMap;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        
        this.renderer.localClippingEnabled = false;

        this.container.appendChild(this.renderer.domElement);

        console.log('? Renderer created with quality:', this.config.quality);
    }

    /**
     * @private
     */
    _createLighting() {
        const { ambient, directional, hemisphere, interior } = this.config.lighting;

        this.ambientLight = new THREE.AmbientLight(0xffffff, ambient);
        this.scene.add(this.ambientLight);

        this.directionalLight = new THREE.DirectionalLight(0xffffff, directional);
        this.directionalLight.position.set(9, 14, 18);
        this.directionalLight.castShadow = true;
        
        this.directionalLight.shadow.mapSize.width = 1024;
        this.directionalLight.shadow.mapSize.height = 1024;
        this.directionalLight.shadow.camera.near = 0.5;
        this.directionalLight.shadow.camera.far = 50;
        this.directionalLight.shadow.camera.left = -10;
        this.directionalLight.shadow.camera.right = 10;
        this.directionalLight.shadow.camera.top = 10;
        this.directionalLight.shadow.camera.bottom = -10;
        this.directionalLight.shadow.bias = -0.0001;
        
        this.scene.add(this.directionalLight);

        this.hemisphereLight = new THREE.HemisphereLight(0xcfe6ff, 0x8d7660, hemisphere);
        this.scene.add(this.hemisphereLight);

        this.interiorLight = new THREE.PointLight(0xffffff, interior, 10);
        this.interiorLight.position.set(0, 2.1, 0.4);
        this.interiorLight.castShadow = true;
        this.scene.add(this.interiorLight);

        console.log('? Lighting system created');
    }

    /**
     * @private
     */
    _createControls() {
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(
                this.camera,
                this.renderer.domElement
            );

            const { enableRotate, enableZoom, enablePan, minDistance, maxDistance, rotateSpeed, zoomSpeed } = this.config.controls;

            this.controls.enableRotate = enableRotate;
            this.controls.enableZoom = enableZoom;
            this.controls.enablePan = enablePan;
            this.controls.minDistance = minDistance;
            this.controls.maxDistance = maxDistance;
            
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.rotateSpeed = rotateSpeed;
            this.controls.zoomSpeed = zoomSpeed;
            
            this.controls.screenSpacePanning = false;
            this.controls.maxPolarAngle = Math.PI * 0.9;
            this.controls.minPolarAngle = Math.PI * 0.22;
            
            this.controls.target.set(
                this.config.camera.initialLookAt.x,
                this.config.camera.initialLookAt.y,
                this.config.camera.initialLookAt.z
            );

            this.controls.addEventListener('start', () => this.requestRender(1000));
            this.controls.addEventListener('change', () => this.requestRender(300));
            this.controls.addEventListener('end', () => this.requestRender(500));
             
            console.log('? OrbitControls created for interior view');
        } else {
            console.warn('?? OrbitControls not loaded');
        }
    }

    /**
     * @private
     */
    _createHelpers() {
        this.helpers.grid = new THREE.GridHelper(20, 20, this.config.gridColor, this.config.gridColor);
        this.helpers.grid.position.y = -0.1;
        this.helpers.grid.visible = this.state.showGrid;
        this.helpers.grid.material.opacity = 0.3;
        this.helpers.grid.material.transparent = true;
        this.scene.add(this.helpers.grid);

        this.helpers.axes = new THREE.AxesHelper(5);
        this.helpers.axes.visible = this.state.showAxes;
        this.scene.add(this.helpers.axes);

        this.helpers.cameraHelper = new THREE.CameraHelper(this.camera);
        this.helpers.cameraHelper.visible = false;
        this.scene.add(this.helpers.cameraHelper);

        console.log('? Helpers created');
    }

    /**
     * @private
     */
    _createExterior() {
        if (!this.config.exterior.enabled) return;

        this.exteriorGroup = new THREE.Group();
        this.exteriorGroup.name = 'exterior';

        const { distance, skyColor, groundColor, showBuildings, showTrees } = this.config.exterior;
        const streetLevel = this._getExteriorStreetLevel();

        this._createSky(skyColor);

        this._createGround(groundColor, distance, streetLevel);
        this._createStreetScene(distance, streetLevel);
        this._createHostBuildingFacade(streetLevel);

        if (showBuildings) {
            this._createBackgroundBuildings(distance, streetLevel);
        }

        if (showTrees) {
            this._createBackgroundTrees(distance, streetLevel);
        }

        this._createSun();

        this.scene.add(this.exteriorGroup);
        this.state.exteriorLoaded = true;

        console.log('? Exterior world created');
    }

    _getExteriorStreetLevel() {
        return -32;
    }

    /**
     * @private
     */
    _createSky(color) {
        const skyTexture = this._createSkyTexture(color);
        const skyGeometry = new THREE.SphereGeometry(200, 32, 32);
        const skyMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            map: skyTexture,
            side: THREE.BackSide,
            fog: false
        });
        const sky = new THREE.Mesh(skyGeometry, skyMaterial);
        sky.name = 'exterior-sky';
        this.skyMesh = sky;
        this.exteriorGroup.add(sky);
    }

    _createSkyTexture(baseColor) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const top = this._mixHexColors(baseColor, 0xf7fbff, 0.68);
        const mid = this._mixHexColors(baseColor, 0xd6ebfb, 0.46);
        const horizon = this._mixHexColors(baseColor, 0xf6efe2, 0.36);
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, top);
        gradient.addColorStop(0.58, mid);
        gradient.addColorStop(0.82, horizon);
        gradient.addColorStop(1, '#d4e6ef');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let i = 0; i < 18; i++) {
            const x = Math.random() * canvas.width;
            const y = 70 + Math.random() * 190;
            const width = 130 + Math.random() * 220;
            const height = 18 + Math.random() * 36;
            const cloud = ctx.createRadialGradient(x, y, 2, x, y, width);
            cloud.addColorStop(0, 'rgba(255,255,255,0.16)');
            cloud.addColorStop(0.55, 'rgba(255,255,255,0.08)');
            cloud.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = cloud;
            ctx.beginPath();
            ctx.ellipse(x, y, width, height, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    /**
     * @private
     */
    _createGround(color, distance, streetLevel = -32) {
        const groundGeometry = new THREE.PlaneGeometry(distance * 4, distance * 4);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.95,
            metalness: 0.02,
            map: this._createGroundTexture()
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = streetLevel;
        ground.receiveShadow = true;
        ground.name = 'exterior-ground';
        this.groundMesh = ground;
        this.exteriorGroup.add(ground);

        const horizonBand = new THREE.Mesh(
            new THREE.PlaneGeometry(distance * 3.4, distance * 0.36),
            new THREE.MeshBasicMaterial({
                color: 0xc8d7de,
                transparent: true,
                opacity: 0.78,
                fog: false
            })
        );
        horizonBand.position.set(0, streetLevel + distance * 0.52, distance * 0.82);
        horizonBand.name = 'exterior-horizon-band';
        this.horizonBand = horizonBand;
        this.exteriorGroup.add(horizonBand);

        const horizonLine = new THREE.Mesh(
            new THREE.PlaneGeometry(distance * 3.4, 0.42),
            new THREE.MeshBasicMaterial({
                color: 0x8fb6bf,
                transparent: true,
                opacity: 0.88,
                fog: false
            })
        );
        horizonLine.position.set(0, streetLevel + distance * 0.44, distance * 0.8);
        horizonLine.name = 'exterior-horizon-line';
        this.horizonLine = horizonLine;
        this.exteriorGroup.add(horizonLine);
    }

    _createStreetScene(distance, streetLevel) {
        const roadMaterial = new THREE.MeshStandardMaterial({
            color: 0x2e3136,
            roughness: 0.94,
            metalness: 0.02
        });
        const laneMaterial = new THREE.MeshBasicMaterial({ color: 0xe6d17d });

        const road = new THREE.Mesh(
            new THREE.PlaneGeometry(distance * 2.2, 9.5),
            roadMaterial
        );
        road.rotation.x = -Math.PI / 2;
        road.position.set(0, streetLevel + 0.03, distance * 0.34);
        road.receiveShadow = true;
        road.name = 'exterior-road-main';
        this.exteriorGroup.add(road);

        for (let i = -4; i <= 4; i++) {
            const lane = new THREE.Mesh(
                new THREE.PlaneGeometry(1.8, 0.12),
                laneMaterial
            );
            lane.rotation.x = -Math.PI / 2;
            lane.position.set(i * 6.2, streetLevel + 0.05, distance * 0.34);
            lane.name = `exterior-lane-${i}`;
            this.exteriorGroup.add(lane);
        }

        const crossRoad = new THREE.Mesh(
            new THREE.PlaneGeometry(8.2, distance * 1.55),
            roadMaterial
        );
        crossRoad.rotation.x = -Math.PI / 2;
        crossRoad.position.set(-14, streetLevel + 0.025, distance * 0.28);
        crossRoad.receiveShadow = true;
        crossRoad.name = 'exterior-road-cross';
        this.exteriorGroup.add(crossRoad);

        const sidewalkMaterial = new THREE.MeshStandardMaterial({
            color: 0x9b9a91,
            roughness: 0.9,
            metalness: 0.02
        });
        [-1, 1].forEach((side) => {
            const sidewalk = new THREE.Mesh(
                new THREE.PlaneGeometry(distance * 2.2, 2.2),
                sidewalkMaterial
            );
            sidewalk.rotation.x = -Math.PI / 2;
            sidewalk.position.set(0, streetLevel + 0.055, distance * 0.34 + side * 5.9);
            sidewalk.receiveShadow = true;
            sidewalk.name = `exterior-sidewalk-${side}`;
            this.exteriorGroup.add(sidewalk);
        });

        const addCar = (x, z, color) => {
            const car = new THREE.Group();
            const body = new THREE.Mesh(
                new THREE.BoxGeometry(2.4, 0.7, 1.15),
                new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.16 })
            );
            body.position.y = 0.45;
            body.castShadow = true;
            car.add(body);

            const cabin = new THREE.Mesh(
                new THREE.BoxGeometry(1.2, 0.48, 0.95),
                new THREE.MeshStandardMaterial({ color: 0xb9c6cf, roughness: 0.28, metalness: 0.08 })
            );
            cabin.position.set(0.1, 0.92, 0);
            car.add(cabin);

            car.position.set(x, streetLevel + 0.05, z);
            car.userData.type = 'street-car';
            this.exteriorGroup.add(car);
        };

        addCar(-9, distance * 0.32, 0xc84d3f);
        addCar(4, distance * 0.38, 0x426ea8);
        addCar(13, distance * 0.3, 0x6d7a38);
        addCar(-17, distance * 0.2, 0xd4c263);
    }

    _createHostBuildingFacade(streetLevel) {
        const dimensions = this.builder?.dimensions || { length: 3, width: 1.4, height: 2.7, shape: 'loggia-3' };
        const profile = this._getBalconyProfile(dimensions);
        const bounds = this._getProfileBounds(profile);
        const facadeZ = bounds.minZ - 0.82;
        const facadeMaterial = new THREE.MeshStandardMaterial({
            color: 0x9aa5aa,
            roughness: 0.92,
            metalness: 0.02
        });
        const windowMaterial = new THREE.MeshStandardMaterial({
            color: 0xa8b8c4,
            roughness: 0.22,
            metalness: 0.08,
            emissive: 0x223340,
            emissiveIntensity: 0.06
        });

        const lowerFacadeHeight = Math.max(Math.abs(streetLevel) - 0.35, 8);
        const lowerFacade = new THREE.Mesh(
            new THREE.BoxGeometry(bounds.width + 1.2, lowerFacadeHeight, 0.45),
            facadeMaterial
        );
        lowerFacade.position.set(bounds.centerX, streetLevel + lowerFacadeHeight / 2, facadeZ);
        lowerFacade.receiveShadow = true;
        lowerFacade.name = 'host-building-lower-facade';
        this.exteriorGroup.add(lowerFacade);

        for (let row = 0; row < 10; row++) {
            for (let col = -1; col <= 1; col++) {
                const window = new THREE.Mesh(
                    new THREE.BoxGeometry(0.56, 0.72, 0.05),
                    windowMaterial
                );
                window.position.set(
                    bounds.centerX + col * 0.92,
                    streetLevel + 1.2 + row * 2.35,
                    facadeZ + 0.25
                );
                window.name = `host-building-lower-window-${row}-${col}`;
                this.exteriorGroup.add(window);
            }
        }

        const wingHeight = dimensions.height + 3.6;
        const wingWidth = 4.2;
        const wingOffsetX = bounds.width / 2 + wingWidth / 2 + 0.25;
        ['left', 'right'].forEach((side, sideIndex) => {
            const direction = side === 'left' ? -1 : 1;
            const wing = new THREE.Mesh(
                new THREE.BoxGeometry(wingWidth, wingHeight, 0.6),
                facadeMaterial
            );
            wing.position.set(bounds.centerX + direction * wingOffsetX, wingHeight / 2 - 0.2, facadeZ + 0.04);
            wing.receiveShadow = true;
            wing.name = `host-building-wing-${side}`;
            this.exteriorGroup.add(wing);

            for (let row = 0; row < 6; row++) {
                const window = new THREE.Mesh(
                    new THREE.BoxGeometry(1.05, 1.45, 0.05),
                    windowMaterial
                );
                window.position.set(
                    wing.position.x,
                    0.7 + row * 2.1,
                    facadeZ + 0.34
                );
                this.exteriorGroup.add(window);
            }
        });

        const topBand = new THREE.Mesh(
            new THREE.BoxGeometry(bounds.width + 1.2, 1.3, 0.52),
            facadeMaterial
        );
        topBand.position.set(bounds.centerX, dimensions.height + 1.18, facadeZ + 0.02);
        topBand.receiveShadow = true;
        topBand.name = 'host-building-top-band';
        this.exteriorGroup.add(topBand);

        const balconySlab = new THREE.Mesh(
            new THREE.BoxGeometry(bounds.width + 1.35, 0.2, 0.72),
            new THREE.MeshStandardMaterial({ color: 0x8f989d, roughness: 0.86, metalness: 0.03 })
        );
        balconySlab.position.set(bounds.centerX, -0.18, facadeZ + 0.08);
        balconySlab.receiveShadow = true;
        balconySlab.name = 'host-building-balcony-slab';
        this.exteriorGroup.add(balconySlab);
    }

    /**
     * @private
     */
    _createBackgroundBuildings(distance, streetLevel = -32) {
        const buildingCount = 10;
        const buildingMaterial = new THREE.MeshStandardMaterial({
            color: 0x9eaab5,
            roughness: 0.92,
            metalness: 0.03
        });

        for (let i = 0; i < buildingCount; i++) {
            const height = 20 + Math.random() * 30;
            const width = 10 + Math.random() * 10;
            const depth = 10 + Math.random() * 10;

            const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
            const building = new THREE.Mesh(buildingGeometry, buildingMaterial);

            const angle = -Math.PI / 3 + (i / (buildingCount - 1)) * (Math.PI * 2 / 3);
            const radius = distance * (0.88 + (i % 3) * 0.08);
            const x = Math.sin(angle) * radius;
            const z = Math.cos(angle) * radius + distance * 0.74;

            building.position.set(x, streetLevel + height / 2, z);
            building.castShadow = true;
            building.receiveShadow = true;

            this.exteriorGroup.add(building);
        }
    }

    /**
     * @private
     */
    _createBackgroundTrees(distance, streetLevel = -32) {
        const treeCount = 14;
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x5a3f2b, roughness: 0.95 });
        const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x6e9a56, roughness: 0.92 });

        for (let i = 0; i < treeCount; i++) {
            const tree = new THREE.Group();

            const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.7, 3, 8);
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            trunk.position.y = 1.5;
            trunk.castShadow = true;
            tree.add(trunk);

            const leavesGeometry = new THREE.ConeGeometry(2, 5, 8);
            const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
            leaves.position.y = 5;
            leaves.castShadow = true;
            tree.add(leaves);

            const angle = -Math.PI / 2.5 + (i / (treeCount - 1)) * (Math.PI / 1.25);
            const radius = distance * (0.56 + (i % 4) * 0.05);
            const x = Math.sin(angle) * radius;
            const z = Math.cos(angle) * radius + distance * 0.38;

            tree.position.set(x, streetLevel, z);
            const scale = 0.8 + Math.random() * 0.4;
            tree.scale.set(scale, scale, scale);
            tree.userData.isTree = true;

            this.exteriorGroup.add(tree);
        }
    }

    /**
     * @private
     */
    _createSun() {
        const sunGeometry = new THREE.SphereGeometry(5, 32, 32);
        const sunMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff7a,
            fog: false
        });
        const sun = new THREE.Mesh(sunGeometry, sunMaterial);
        sun.position.set(50, 50, 50);
        sun.name = 'exterior-sun';
        this.sunMesh = sun;
        this.exteriorGroup.add(sun);
    }

    _mixHexColors(baseHex, targetHex, ratio) {
        const base = new THREE.Color(baseHex);
        const target = new THREE.Color(targetHex);
        return `#${base.lerp(target, THREE.MathUtils.clamp(ratio, 0, 1)).getHexString()}`;
    }

    _createGroundTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#708f73';
        ctx.fillRect(0, 0, 512, 512);

        for (let i = 0; i < 1400; i++) {
            const alpha = 0.03 + Math.random() * 0.06;
            const size = 1 + Math.random() * 3;
            ctx.fillStyle = `rgba(${70 + Math.random() * 45}, ${90 + Math.random() * 55}, ${55 + Math.random() * 35}, ${alpha})`;
            ctx.beginPath();
            ctx.arc(Math.random() * 512, Math.random() * 512, size, 0, Math.PI * 2);
            ctx.fill();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(18, 18);
        return texture;
    }

    /**
     * @private
     */
    _loadDefaultTextures() {
        this.texturesCache.wood = this._createWoodTexture();
        this.texturesCache.tile = this._createTileTexture();
        this.texturesCache.laminate = this._createLaminateTexture();
        this.texturesCache.wall = this._createWallTexture();
        this.texturesCache.pvc = this._createPanelTexture('#eef2f5', '#d8dde3', 26, 'vertical');
        this.texturesCache.mdf = this._createPanelTexture('#9a795a', '#7d5f47', 34, 'vertical');
        this.texturesCache.decor3d = this._createPanelTexture('#e7dfd2', '#d3cabd', 38, 'checker');
        this.texturesCache.stone = this._createStoneTexture();
        this.texturesCache.parquet = this._createParquetTexture();
        this.texturesCache.slats = this._createPanelTexture('#8a6a4e', '#5f4632', 18, 'slats');
        this.texturesCache.liningVertical = this._createPanelTexture('#eddcc7', '#c6a683', 22, 'vertical');
        this.texturesCache.liningHorizontal = this._createPanelTexture('#eddcc7', '#c6a683', 22, 'horizontal');
        this.texturesCache.stretch = this._createStretchTexture();
        this.texturesCache.vinyl = this._createPanelTexture('#9a8776', '#7f6d5f', 44, 'horizontal');

        this.state.materialsLoaded = true;
        console.log('? Default textures loaded');
    }

    /**
     * @private
     */
    _createWoodTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#8B7355';
        ctx.fillRect(0, 0, 512, 512);

        for (let i = 0; i < 100; i++) {
            ctx.strokeStyle = `rgba(${100 + Math.random() * 50}, ${70 + Math.random() * 30}, ${50 + Math.random() * 20}, 0.3)`;
            ctx.lineWidth = 1 + Math.random() * 2;
            ctx.beginPath();
            ctx.moveTo(0, Math.random() * 512);
            ctx.lineTo(512, Math.random() * 512);
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);

        return texture;
    }

    /**
     * @private
     */
    _createTileTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#CCCCCC';
        ctx.fillRect(0, 0, 512, 512);

        ctx.strokeStyle = '#999999';
        ctx.lineWidth = 3;
        const tileSize = 128;

        for (let x = 0; x <= 512; x += tileSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 512);
            ctx.stroke();
        }

        for (let y = 0; y <= 512; y += tileSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(512, y);
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 4);

        return texture;
    }

    /**
     * @private
     */
    _createLaminateTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#A0826D';
        ctx.fillRect(0, 0, 512, 512);

        for (let y = 0; y < 512; y += 64) {
            ctx.fillStyle = `rgba(${140 + Math.random() * 20}, ${110 + Math.random() * 20}, ${90 + Math.random() * 20}, 0.5)`;
            ctx.fillRect(0, y, 512, 60);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 4);

        return texture;
    }

    /**
     * @private
     */
    _createWallTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#D4A574';
        ctx.fillRect(0, 0, 512, 512);

        for (let i = 0; i < 10000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const brightness = Math.random() * 40 - 20;
            ctx.fillStyle = `rgba(${212 + brightness}, ${165 + brightness}, ${116 + brightness}, 0.3)`;
            ctx.fillRect(x, y, 2, 2);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);

        return texture;
    }

    _createPanelTexture(baseColor, accentColor, spacing = 24, pattern = 'vertical') {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, 512, 512);
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 3;

        if (pattern === 'horizontal') {
            for (let y = 0; y <= 512; y += spacing) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(512, y);
                ctx.stroke();
            }
        } else if (pattern === 'checker') {
            for (let y = 0; y < 512; y += spacing) {
                for (let x = 0; x < 512; x += spacing) {
                    if (((x + y) / spacing) % 2 === 0) {
                        ctx.fillStyle = 'rgba(255,255,255,0.18)';
                        ctx.fillRect(x, y, spacing, spacing);
                    }
                }
            }
        } else if (pattern === 'slats') {
            for (let x = 0; x <= 512; x += spacing) {
                ctx.fillStyle = accentColor;
                ctx.fillRect(x, 0, Math.max(8, spacing * 0.45), 512);
                ctx.fillStyle = 'rgba(255,255,255,0.08)';
                ctx.fillRect(x + 2, 0, 2, 512);
            }
        } else {
            for (let x = 0; x <= 512; x += spacing) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, 512);
                ctx.stroke();
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(pattern === 'checker' ? 3 : 2, pattern === 'horizontal' ? 3 : 2);
        return texture;
    }

    _createStoneTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#8d8172';
        ctx.fillRect(0, 0, 512, 512);

        for (let i = 0; i < 220; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const w = 24 + Math.random() * 60;
            const h = 18 + Math.random() * 42;
            const shade = 110 + Math.random() * 70;
            ctx.fillStyle = `rgba(${shade}, ${shade - 8}, ${shade - 18}, 0.38)`;
            ctx.fillRect(x, y, w, h);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);
        return texture;
    }

    _createParquetTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const size = 64;

        ctx.fillStyle = '#b8926f';
        ctx.fillRect(0, 0, 512, 512);

        for (let y = 0; y < 512; y += size) {
            for (let x = 0; x < 512; x += size) {
                const isAlt = ((x + y) / size) % 2 === 0;
                ctx.fillStyle = isAlt ? '#c8a27d' : '#9f7858';
                ctx.fillRect(x, y, size - 2, size - 2);
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(3, 3);
        return texture;
    }

    _createStretchTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 512, 512);
        gradient.addColorStop(0, '#f8f4ee');
        gradient.addColorStop(0.5, '#efe8de');
        gradient.addColorStop(1, '#fdfbf8');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 512);

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 1);
        return texture;
    }
        // ============================================
    // ============================================

    /**
     * @private
     */
    _createBalcony(options = {}) {
        const preserveCamera = options.preserveCamera === true;
        const savedCameraState = preserveCamera ? this._captureCameraState() : null;
        if (this.balconyGroup) {
            this.scene.remove(this.balconyGroup);
            this._disposeGroup(this.balconyGroup);
            this.windows = [];
        }

        this.balconyGroup = new THREE.Group();
        this.balconyGroup.name = 'balcony';

        const dimensions = this.builder?.dimensions || {
            length: 3,
            width: 1.4,
            height: 2.7,
            shape: 'loggia-3'
        };

        console.log('?? Creating balcony:', dimensions);
        this.state.currentBalconyType = dimensions.shape;
        this._updateCameraBounds(dimensions);

        this._createFloorWithFinishing(dimensions);
        this._createCeilingWithFinishing(dimensions);
        this._createWallsWithFinishing(dimensions);
        this._createBalconyEntrance(dimensions);
        this._createWindows(dimensions);
        
        this._createMarkers(dimensions);

        this._centerBalcony(dimensions);

        this.scene.add(this.balconyGroup);

        if (savedCameraState) {
            this._restoreCameraState(savedCameraState, dimensions);
        } else if (this.state.viewMode === 'interior') {
            this._applyInteriorCameraPose(dimensions, false);
        }
        
        console.log('? Balcony created successfully with finishing');
    }

    /**
     * @private
     */
    _createFloorWithFinishing(dimensions) {
        const profile = this._getBalconyProfile(dimensions);
        const baseMaterial = new THREE.MeshStandardMaterial({
            color: 0x8f8f8f,
            roughness: 0.92,
            metalness: 0.08,
            side: THREE.DoubleSide
        });

        this.floor = this._createSurfaceFromPoints(
            profile.points,
            baseMaterial,
            0,
            'floor_base',
            { element: 'floor', type: 'base' }
        );
        this.floor.receiveShadow = true;
        this.balconyGroup.add(this.floor);

        this.floorFinishing = this._createSurfaceFromPoints(
            profile.points,
            this._getMaterialForElement('floor'),
            0.012,
            'floor_finishing',
            { element: 'floor', type: 'finishing' }
        );
        this.floorFinishing.receiveShadow = true;
        this.balconyGroup.add(this.floorFinishing);
    }

    /**
     * @private
     */
    _createCeilingWithFinishing(dimensions) {
        const profile = this._getBalconyProfile(dimensions);
        const { height } = dimensions;
        const glazingType = this.builder?.glazing?.type || 'classic';
        const baseMaterial = new THREE.MeshStandardMaterial({
            color: 0xa6a6a6,
            roughness: 0.9,
            metalness: 0.06,
            side: THREE.DoubleSide
        });

        this.ceiling = this._createSurfaceFromPoints(
            profile.points,
            baseMaterial,
            height,
            'ceiling_base',
            { element: 'ceiling', type: 'base' }
        );
        this.balconyGroup.add(this.ceiling);

        this.ceilingFinishing = this._createSurfaceFromPoints(
            profile.points,
            this._isCeilingSlatSelected() ? this._getSlatBackerMaterial() : this._getMaterialForElement('ceiling'),
            height - 0.012,
            'ceiling_finishing',
            { element: 'ceiling', type: 'finishing' }
        );
        if (this.ceilingFinishing?.material?.color) {
            this.ceilingFinishing.material.color.multiplyScalar(0.94);
        }
        this.balconyGroup.add(this.ceilingFinishing);

        if (glazingType !== 'none') {
            this._createCeilingOpeningShadowTrims(profile, height);
        }
    }

    _createCeilingOpeningShadowTrims(profile, height) {
        if (!profile?.glazingEdges?.length) return;

        const trimMaterial = new THREE.MeshStandardMaterial({
            color: 0xbdb5ab,
            roughness: 0.82,
            metalness: 0.04
        });
        const shadowMaterial = new THREE.MeshStandardMaterial({
            color: 0x3f3a35,
            roughness: 0.96,
            metalness: 0.02
        });

        profile.glazingEdges.forEach((index) => {
            const start = profile.points[index];
            const end = profile.points[(index + 1) % profile.points.length];
            const dx = end.x - start.x;
            const dz = end.z - start.z;
            const length = Math.hypot(dx, dz);
            const angle = Math.atan2(dz, dx);
            const midpointX = (start.x + end.x) / 2;
            const midpointZ = (start.z + end.z) / 2;
            const normal = this._getSegmentNormal(start, end);

            const trim = new THREE.Mesh(
                new THREE.BoxGeometry(length + 0.02, 0.042, 0.075),
                trimMaterial
            );
            trim.position.set(
                midpointX + normal.x * 0.025,
                height - 0.03,
                midpointZ + normal.z * 0.025
            );
            trim.rotation.y = -angle;
            trim.castShadow = true;
            trim.receiveShadow = true;
            trim.name = `ceiling_opening_trim_${index}`;
            trim.userData = { element: 'ceiling', type: 'opening-trim' };
            this.balconyGroup.add(trim);

            const shadowGap = new THREE.Mesh(
                new THREE.BoxGeometry(length + 0.04, 0.05, 0.055),
                shadowMaterial
            );
            shadowGap.position.set(
                midpointX + normal.x * 0.055,
                height - 0.065,
                midpointZ + normal.z * 0.055
            );
            shadowGap.rotation.y = -angle;
            shadowGap.receiveShadow = true;
            shadowGap.name = `ceiling_shadow_gap_${index}`;
            shadowGap.userData = { element: 'ceiling', type: 'shadow-gap' };
            this.balconyGroup.add(shadowGap);
        });
    }

    /**
     * @private
     */
    _createFinishingGeometry(length, width, shape, thickness) {
        if (shape === 'straight') {
            return new THREE.BoxGeometry(length, thickness, width);
        } else if (shape === 'L-left' || shape === 'L-right') {
            return this._createLShapeGeometry(length, width, thickness, shape);
        } else if (shape === 'P') {
            return this._createPShapeGeometry(length, width, thickness);
        }
        return new THREE.BoxGeometry(length, thickness, width);
    }

    /**
     * @private
     */
    _createWallsWithFinishing(dimensions) {
        const { height } = dimensions;
        const profile = this._getBalconyProfile(dimensions);
        const glazingType = this.builder?.glazing?.type || 'classic';
        const parapetHeight = glazingType === 'french' ? 0.16 : 1.05;
        const entranceEdge = this._getBackEntranceEdge(profile);

        console.log('?? Creating walls with profile:', { shape: dimensions.shape, glazingType });

        Object.values(this.walls).forEach(wall => {
            if (wall) this.balconyGroup.remove(wall);
        });
        this.walls = {};

        profile.points.forEach((start, index) => {
            const end = profile.points[(index + 1) % profile.points.length];
            const isGlazingEdge = profile.glazingEdges.includes(index);
            const isEntranceEdge = entranceEdge && index === entranceEdge.index;
            const wallName = this._getWallElementName(start, end, index);

            if (!isGlazingEdge && !isEntranceEdge) {
                const wall = this._createWallSegment(
                    start,
                    end,
                    height,
                    0.14,
                    wallName,
                    0,
                    { profileIndex: index }
                );
                this.walls[`${wallName}_${index}`] = wall;
                this.balconyGroup.add(wall);
            }
        });

        this._createGlazingParapets(profile, parapetHeight);
        this._createGlazingCaps(profile, parapetHeight);

        console.log('? Walls created successfully with profile geometry');
    }

    _createGlazingParapets(profile, parapetHeight) {
        if (!profile?.points?.length || !profile.glazingEdges?.length) return;

        profile.glazingEdges.forEach((edgeIndex) => {
            const start = profile.points[edgeIndex];
            const end = profile.points[(edgeIndex + 1) % profile.points.length];
            const elementName = this._getWallElementName(start, end, edgeIndex);
            const parapet = this._createWallSegment(
                start,
                end,
                parapetHeight,
                0.14,
                elementName,
                0,
                { profileIndex: edgeIndex }
            );

            parapet.name = `glazing_parapet_${edgeIndex}`;
            parapet.userData = {
                ...parapet.userData,
                element: elementName,
                type: 'parapet',
                surfaceHeight: parapetHeight
            };
            this.walls[`glazing_parapet_${edgeIndex}`] = parapet;
            this.balconyGroup.add(parapet);
        });
    }

    _createGlazingCaps(profile, parapetHeight) {
        if (!profile?.points?.length || !profile.glazingEdges?.length) return;

        const capMaterial = this._getParapetCapMaterial();
        const chains = this._getGlazingEdgeChains(profile);

        chains.forEach((chain, index) => {
            if (chain.length < 2) return;

            const cap = new THREE.Mesh(
                this._createPolylineStripGeometry(chain, 0.18, 0.035),
                capMaterial.clone()
            );
            cap.rotation.x = -Math.PI / 2;
            cap.position.y = parapetHeight;
            cap.castShadow = true;
            cap.receiveShadow = true;
            cap.name = `glazing_continuous_cap_${index}`;
            cap.userData = {
                element: 'windowsill',
                type: 'parapet-cap',
                surfaceLength: this._getPolylineLength(chain),
                surfaceHeight: 0.18
            };
            this.walls[`glazing_cap_${index}`] = cap;
            this.balconyGroup.add(cap);
        });
    }

    _getChainMaterialElement(profile, chain) {
        let bestElement = null;
        let bestLength = 0;

        for (let index = 0; index < chain.length - 1; index += 1) {
            const start = chain[index];
            const end = chain[index + 1];
            const length = Math.hypot(end.x - start.x, end.z - start.z);
            if (length > bestLength) {
                bestLength = length;
                bestElement = this._getWallElementName(start, end, index);
            }
        }

        return bestElement || 'walls_front';
    }

    _getPolylineLength(points) {
        return points.reduce((sum, point, pointIndex) => {
            if (pointIndex === 0) return sum;
            const previous = points[pointIndex - 1];
            return sum + Math.hypot(point.x - previous.x, point.z - previous.z);
        }, 0);
    }

    _getGlazingEdgeChains(profile) {
        const pointCount = profile.points.length;
        const sortedEdges = [...profile.glazingEdges].sort((a, b) => a - b);
        const chains = [];
        let current = [];

        sortedEdges.forEach((edgeIndex) => {
            if (!current.length || edgeIndex === current[current.length - 1] + 1) {
                current.push(edgeIndex);
                return;
            }

            chains.push(current);
            current = [edgeIndex];
        });

        if (current.length) {
            chains.push(current);
        }

        if (
            chains.length > 1 &&
            chains[0][0] === 0 &&
            chains[chains.length - 1][chains[chains.length - 1].length - 1] === pointCount - 1
        ) {
            const first = chains.shift();
            chains[chains.length - 1].push(...first);
        }

        return chains.map((chain) => {
            const points = chain.map((edgeIndex) => profile.points[edgeIndex]);
            const lastEdge = chain[chain.length - 1];
            points.push(profile.points[(lastEdge + 1) % pointCount]);
            return points;
        });
    }

    _createPolylineStripGeometry(points, width, height) {
        const polygon = this._getPolylineStripPoints(points, width);
        const shape = new THREE.Shape();

        polygon.forEach((point, index) => {
            const shapeY = -point.z;
            if (index === 0) {
                shape.moveTo(point.x, shapeY);
            } else {
                shape.lineTo(point.x, shapeY);
            }
        });
        shape.closePath();

        const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: height,
            bevelEnabled: false
        });
        geometry.computeVertexNormals();
        return geometry;
    }

    _getPolylineStripPoints(points, width) {
        const halfWidth = width / 2;
        const directions = [];
        const normals = [];

        for (let index = 0; index < points.length - 1; index += 1) {
            const start = points[index];
            const end = points[index + 1];
            const dx = end.x - start.x;
            const dz = end.z - start.z;
            const length = Math.hypot(dx, dz) || 1;
            const direction = { x: dx / length, z: dz / length };

            directions.push(direction);
            normals.push({ x: -direction.z, z: direction.x });
        }

        const offsetPoint = (index, side) => {
            const point = points[index];

            if (index === 0) {
                const normal = normals[0];
                return {
                    x: point.x + normal.x * halfWidth * side,
                    z: point.z + normal.z * halfWidth * side
                };
            }

            if (index === points.length - 1) {
                const normal = normals[normals.length - 1];
                return {
                    x: point.x + normal.x * halfWidth * side,
                    z: point.z + normal.z * halfWidth * side
                };
            }

            const previousNormal = normals[index - 1];
            const nextNormal = normals[index];
            const previousDirection = directions[index - 1];
            const nextDirection = directions[index];
            const previousLinePoint = {
                x: point.x + previousNormal.x * halfWidth * side,
                z: point.z + previousNormal.z * halfWidth * side
            };
            const nextLinePoint = {
                x: point.x + nextNormal.x * halfWidth * side,
                z: point.z + nextNormal.z * halfWidth * side
            };
            const intersection = this._intersectLines2D(
                previousLinePoint,
                previousDirection,
                nextLinePoint,
                nextDirection
            );

            if (intersection && Math.hypot(intersection.x - point.x, intersection.z - point.z) < halfWidth * 3.5) {
                return intersection;
            }

            const averageNormal = {
                x: previousNormal.x + nextNormal.x,
                z: previousNormal.z + nextNormal.z
            };
            const normalLength = Math.hypot(averageNormal.x, averageNormal.z) || 1;
            return {
                x: point.x + (averageNormal.x / normalLength) * halfWidth * side,
                z: point.z + (averageNormal.z / normalLength) * halfWidth * side
            };
        };

        const left = points.map((point, index) => offsetPoint(index, 1));
        const right = points.map((point, index) => offsetPoint(index, -1)).reverse();
        return [...left, ...right];
    }

    _intersectLines2D(pointA, directionA, pointB, directionB) {
        const cross = directionA.x * directionB.z - directionA.z * directionB.x;
        if (Math.abs(cross) < 0.00001) {
            return null;
        }

        const dx = pointB.x - pointA.x;
        const dz = pointB.z - pointA.z;
        const distance = (dx * directionB.z - dz * directionB.x) / cross;
        return {
            x: pointA.x + directionA.x * distance,
            z: pointA.z + directionA.z * distance
        };
    }

    _getProfileCenter(profile) {
        const points = profile?.points || [];
        if (!points.length) {
            return { x: 0, z: 0 };
        }

        return {
            x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
            z: points.reduce((sum, point) => sum + point.z, 0) / points.length
        };
    }

    _clampPointInsideProfile(point, profile, margin = 0.18) {
        if (!profile?.points?.length || this._isPointInProfile(point.x, point.z, profile.points)) {
            return point;
        }

        const center = this._getProfileCenter(profile);
        const steps = 12;
        for (let step = 1; step <= steps; step += 1) {
            const factor = step / steps;
            const candidate = {
                x: point.x + (center.x - point.x) * factor,
                z: point.z + (center.z - point.z) * factor
            };
            if (this._isPointInProfile(candidate.x, candidate.z, profile.points)) {
                return candidate;
            }
        }

        return {
            x: center.x,
            z: center.z
        };
    }

    _isPointInProfile(x, z, points) {
        let inside = false;
        for (let index = 0, prev = points.length - 1; index < points.length; prev = index, index += 1) {
            const a = points[index];
            const b = points[prev];
            const intersects = ((a.z > z) !== (b.z > z)) &&
                (x < (b.x - a.x) * (z - a.z) / ((b.z - a.z) || 0.000001) + a.x);
            if (intersects) {
                inside = !inside;
            }
        }

        return inside;
    }

    _getProfileSignedArea(profile) {
        const points = profile?.points || [];
        if (points.length < 3) {
            return 0;
        }

        let area = 0;
        for (let index = 0; index < points.length; index += 1) {
            const current = points[index];
            const next = points[(index + 1) % points.length];
            area += current.x * next.z - next.x * current.z;
        }

        return area / 2;
    }

    _createWallWithFinishing(name, width, height, thickness, position, rotation, finishingThickness) {
        const baseGeometry = new THREE.BoxGeometry(width, height, thickness);
        const baseMaterial = new THREE.MeshStandardMaterial({
            color: 0x777777,
            roughness: 0.9,
            metalness: 0.1
        });

        const wallBase = new THREE.Mesh(baseGeometry, baseMaterial);
        wallBase.position.set(position.x, position.y, position.z);
        wallBase.rotation.y = rotation;
        wallBase.castShadow = true;
        wallBase.receiveShadow = true;
        wallBase.name = `${name}_wall_base`;
        wallBase.userData = { element: `wall_${name}`, type: 'base' };
        
        this.balconyGroup.add(wallBase);
        this.walls[`${name}_base`] = wallBase;

        const finishingMaterial = this._getMaterialForElement(`wall_${name}`);
        const finishingGeometry = new THREE.BoxGeometry(width, height, finishingThickness);
        
        const wallFinishing = new THREE.Mesh(finishingGeometry, finishingMaterial);
        
        const offset = thickness / 2 + finishingThickness / 2;
        if (rotation === 0) {
            wallFinishing.position.set(position.x, position.y, position.z - offset);
        } else {
            wallFinishing.position.set(position.x - offset, position.y, position.z);
        }
        
        wallFinishing.rotation.y = rotation;
        wallFinishing.receiveShadow = true;
        wallFinishing.name = `${name}_wall_finishing`;
        wallFinishing.userData = { element: `wall_${name}`, type: 'finishing' };
        
        this.balconyGroup.add(wallFinishing);
        this.walls[name] = wallFinishing;
    }

    /**
     * @private
     */
    _createLShapeWalls(dimensions) {
        const { length, width, height } = dimensions;
        const wallThickness = 0.15;
        const extensionLength = length * 0.5;

        const extensionWallGeometry = new THREE.BoxGeometry(wallThickness, height, extensionLength);
        const wallMaterial = this._getMaterialForElement('wall_extension');
        const extensionWall = new THREE.Mesh(extensionWallGeometry, wallMaterial);
        extensionWall.position.set(length/2 + wallThickness/2, height/2, width/2);
        extensionWall.name = 'wall_extension';
        extensionWall.userData = { element: 'wall_extension' };
        
        this.balconyGroup.add(extensionWall);
        this.walls.extension = extensionWall;

        const finishingMaterial = this._getMaterialForElement('wall_extension');
        const finishingGeometry = new THREE.BoxGeometry(wallThickness, height, extensionLength);
        const finishingWall = new THREE.Mesh(finishingGeometry, finishingMaterial);
        finishingWall.position.set(length/2 + wallThickness, height/2, width/2);
        finishingWall.name = 'wall_extension_finishing';
        finishingWall.userData = { element: 'wall_extension', type: 'finishing' };
        
        this.balconyGroup.add(finishingWall);
    }

    /**
     * @private
     */
    _createPShapeWalls(dimensions) {
        const { length, width, height } = dimensions;
        const wallThickness = 0.15;

        const frontWallGeometry = new THREE.BoxGeometry(length, height, wallThickness);
        const wallMaterial = this._getMaterialForElement('wall_front_p');
        const frontWall = new THREE.Mesh(frontWallGeometry, wallMaterial);
        frontWall.position.set(0, height/2, -width/2 + wallThickness/2);
        frontWall.name = 'wall_front_p';
        frontWall.userData = { element: 'wall_front_p' };
        
        this.balconyGroup.add(frontWall);
        this.walls.front_p = frontWall;

        const finishingMaterial = this._getMaterialForElement('wall_front_p');
        const finishingGeometry = new THREE.BoxGeometry(length, height, 0.02);
        const finishingWall = new THREE.Mesh(finishingGeometry, finishingMaterial);
        finishingWall.position.set(0, height/2, -width/2 + wallThickness + 0.01);
        finishingWall.name = 'wall_front_p_finishing';
        finishingWall.userData = { element: 'wall_front_p', type: 'finishing' };
        
        this.balconyGroup.add(finishingWall);
    }

    /**
     * @private
     */
    _createWindows(dimensions) {
        this._clearWindowObjects();

        const profile = this._getBalconyProfile(dimensions);
        const glazingType = this.builder?.glazing?.type || 'classic';

        if (glazingType === 'none') {
            return;
        }

        const glazedEdges = profile.glazingEdges.map(index => {
            const start = profile.points[index];
            const end = profile.points[(index + 1) % profile.points.length];
            return { index, start, end };
        });

        const sections = this._getEdgeSections(
            glazedEdges,
            this.builder?.glazing?.windowSections || glazedEdges.length
        );

        glazedEdges.forEach((edge, edgeIndex) => {
            const glazingObjects = this._createGlazingForSegment(
                edge.start,
                edge.end,
                dimensions,
                glazingType,
                sections[edgeIndex]
            );

            glazingObjects.forEach(object => {
                this.windows.push(object);
                this.balconyGroup.add(object);
            });
        });

        console.log('? Windows created with profile geometry');
    }

    _getBalconyProfile(dimensions) {
        const { length, width, shape = 'loggia-3' } = dimensions;
        const halfL = length / 2;
        const halfW = width / 2;

        const profiles = {
            'hrushchevka': {
                points: [
                    { x: -halfL, z: -halfW },
                    { x: halfL, z: -halfW },
                    { x: halfL, z: halfW },
                    { x: -halfL, z: halfW }
                ],
                glazingEdges: [2]
            },
            'loggia-3': {
                points: [
                    { x: -halfL, z: -halfW },
                    { x: halfL, z: -halfW },
                    { x: halfL, z: halfW },
                    { x: -halfL, z: halfW }
                ],
                glazingEdges: [2]
            },
            'loggia-6': {
                points: [
                    { x: -halfL, z: -halfW },
                    { x: halfL, z: -halfW },
                    { x: halfL, z: halfW },
                    { x: -halfL, z: halfW }
                ],
                glazingEdges: [2]
            },
            'boot': {
                points: [
                    { x: -halfL, z: -halfW },
                    { x: halfL, z: -halfW },
                    { x: halfL, z: halfW },
                    { x: halfL - length * (400 / 3200), z: halfW },
                    { x: -halfL + length * (2400 / 3200), z: -halfW + width * (1200 / 2100) },
                    { x: -halfL, z: -halfW + width * (1200 / 2100) }
                ],
                glazingEdges: [2, 3, 4]
            },
            'iron': {
                points: [
                    { x: -halfL, z: -halfW },
                    { x: halfL, z: -halfW },
                    { x: halfL, z: halfW },
                    { x: -halfL * 0.08, z: halfW },
                    { x: -halfL, z: -halfW * 0.16 }
                ],
                glazingEdges: [2, 3]
            },
            'boat': {
                points: [
                    { x: -halfL, z: -halfW },
                    { x: -halfL + length * (3250 / 3650), z: -halfW },
                    { x: -halfL + length * (3250 / 3650), z: -halfW + width * (280 / 960) },
                    { x: halfL, z: -halfW + width * (280 / 960) },
                    { x: halfL, z: halfW },
                    { x: -halfL + length * (1700 / 3650), z: halfW },
                    { x: -halfL, z: -halfW + width * (400 / 960) }
                ],
                glazingEdges: [4, 5]
            }
        };

        const profile = profiles[shape] || profiles['loggia-3'];
        const layout = this.builder?.glazing?.layout || 'straight';
        const gSide = this.builder?.glazing?.gSide === 'right' ? 'right' : 'left';

        return {
            points: profile.points,
            glazingEdges: this._getGlazingEdgesForLayout(profile.points, profile.glazingEdges, layout, gSide)
        };
    }

    _clearWindowObjects() {
        this.windows.forEach((windowObject) => {
            if (windowObject.parent) {
                windowObject.parent.remove(windowObject);
            }
            this._disposeObject(windowObject);
        });
        this.windows = [];
    }

    _getGlazingEdgesForLayout(points, defaultEdges, layout, gSide) {
        if (!Array.isArray(points) || points.length < 3) return defaultEdges || [];
        if (layout === 'straight') return defaultEdges || [];

        const bounds = points.reduce((acc, point) => ({
            minX: Math.min(acc.minX, point.x),
            maxX: Math.max(acc.maxX, point.x),
            minZ: Math.min(acc.minZ, point.z),
            maxZ: Math.max(acc.maxZ, point.z)
        }), {
            minX: Infinity,
            maxX: -Infinity,
            minZ: Infinity,
            maxZ: -Infinity
        });

        const edgeInfo = points.map((start, index) => {
            const end = points[(index + 1) % points.length];
            const midX = (start.x + end.x) / 2;
            const midZ = (start.z + end.z) / 2;
            return { index, midX, midZ };
        });

        const spanZ = Math.max(bounds.maxZ - bounds.minZ, 0.1);
        const frontThreshold = bounds.maxZ - spanZ * 0.42;
        const frontEdges = edgeInfo
            .filter((edge) => edge.midZ >= frontThreshold)
            .map((edge) => edge.index);

        const leftEdge = edgeInfo.reduce((best, edge) => edge.midX < best.midX ? edge : best, edgeInfo[0]);
        const rightEdge = edgeInfo.reduce((best, edge) => edge.midX > best.midX ? edge : best, edgeInfo[0]);
        const merged = new Set(frontEdges.length ? frontEdges : defaultEdges);

        if (layout === 'g') {
            merged.add(gSide === 'right' ? rightEdge.index : leftEdge.index);
        } else if (layout === 'p') {
            merged.add(leftEdge.index);
            merged.add(rightEdge.index);
        }

        return Array.from(merged).sort((a, b) => a - b);
    }

    _createSurfaceFromPoints(points, material, y, name, userData = {}) {
        const shape = new THREE.Shape();
        points.forEach((point, index) => {
            const z = -point.z;
            if (index === 0) {
                shape.moveTo(point.x, z);
            } else {
                shape.lineTo(point.x, z);
            }
        });
        shape.closePath();

        const geometry = new THREE.ShapeGeometry(shape);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = y;
        mesh.name = name;
        mesh.userData = userData;

        return mesh;
    }

    _createWallSegment(start, end, height, thickness, elementName, baseY = 0, options = {}) {
        const dx = end.x - start.x;
        const dz = end.z - start.z;
        const length = Math.hypot(dx, dz);
        const visualLength = Math.max(0.04, length);
        const angle = Math.atan2(dz, dx);
        const midpoint = {
            x: (start.x + end.x) / 2,
            z: (start.z + end.z) / 2
        };
        const baseMaterial = this._getMaterialForElement(elementName);
        baseMaterial.side = THREE.DoubleSide;
        const wall = new THREE.Mesh(
            new THREE.PlaneGeometry(visualLength, height),
            baseMaterial
        );

        wall.position.set(midpoint.x, height / 2, midpoint.z);
        wall.position.y = baseY + height / 2;
        wall.rotation.y = -angle;
        wall.castShadow = true;
        wall.receiveShadow = true;
        wall.name = `${elementName}_${Math.round(midpoint.x * 100)}_${Math.round(midpoint.z * 100)}`;
        wall.userData = {
            element: elementName,
            type: 'wall',
            surfaceLength: visualLength,
            surfaceHeight: height,
            actualSegmentLength: length,
            profileIndex: options.profileIndex
        };
        this._fitMaterialRepeatToSurface(baseMaterial, elementName, length, height);

        return wall;
    }

    _createBalconyEntrance(dimensions) {
        if (!this.balconyGroup || !dimensions) return;

        const profile = this._getBalconyProfile(dimensions);
        const edge = this._getBackEntranceEdge(profile);
        if (!edge) return;

        const aliases = {
            'door-window': 'plastic-door',
            'door-wide-window': 'glazing-window',
            'center-door': 'plastic-door',
            'joined-room': 'open-connection'
        };
        const entrance = this.builder?.entrance || { type: 'plastic-door', mirrored: false, width: 0.9, height: 2.15 };
        const type = aliases[entrance.type] || entrance.type || 'plastic-door';
        const group = new THREE.Group();
        group.name = 'balcony_entrance';
        group.userData = { element: 'entrance', type };
        const wallElement = this._getWallElementName(edge.start, edge.end, edge.index);

        const wallLength = edge.length;
        const maxOpeningW = Math.max(1.45, wallLength - 0.26);
        const fallbackOpeningW = type === 'glazing-window' ? 2.2 : type === 'open-connection' ? 2.35 : 1.65;
        const requestedW = Number.isFinite(entrance.width) ? entrance.width : fallbackOpeningW;
        const requestedH = Number.isFinite(entrance.height) ? entrance.height : 2.25;
        const openingW = THREE.MathUtils.clamp(requestedW, 1.45, maxOpeningW);
        const openingH = THREE.MathUtils.clamp(requestedH, 2.0, Math.max(2.0, dimensions.height - 0.12));
        const baseY = 0;
        const centerY = baseY + openingH / 2;
        const offset = 0.042;
        const inward = edge.inward;

        const frameMaterial = new THREE.MeshStandardMaterial({ color: 0xf7f8f6, roughness: 0.34, metalness: 0.04 });
        const glassMaterial = this._getWindowGlassMaterial();
        glassMaterial.opacity = 0.24;
        const revealMaterial = new THREE.MeshStandardMaterial({ color: 0xf1eee7, roughness: 0.82, metalness: 0.01, side: THREE.DoubleSide });
        const gasketMaterial = new THREE.MeshStandardMaterial({ color: 0x6e7479, roughness: 0.62, metalness: 0.12 });
        const handleMaterial = new THREE.MeshStandardMaterial({ color: 0x34383c, roughness: 0.34, metalness: 0.58 });

        const addPanel = (name, localX, y, width, height, material, zOffset = offset) => {
            const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
            panel.position.set(
                edge.mid.x + edge.unit.x * localX + inward.x * zOffset,
                y,
                edge.mid.z + edge.unit.z * localX + inward.z * zOffset
            );
            panel.rotation.y = -edge.angle;
            panel.name = name;
            panel.userData = { element: 'entrance', type: name };
            group.add(panel);
            return panel;
        };

        const addBox = (name, localX, y, width, height, depth, material, zOffset = offset) => {
            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(
                    Math.max(width, 0.001),
                    Math.max(height, 0.001),
                    Math.max(depth, 0.001)
                ),
                material
            );
            mesh.position.set(
                edge.mid.x + edge.unit.x * localX + inward.x * zOffset,
                y,
                edge.mid.z + edge.unit.z * localX + inward.z * zOffset
            );
            mesh.rotation.y = -edge.angle;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.name = name;
            mesh.userData = { element: 'entrance', type: name };
            group.add(mesh);
            return mesh;
        };

        const addWallPanel = (name, localX, y, width, height, zOffset = 0.006) => {
            if (width <= 0.01 || height <= 0.01) return null;
            const wallMaterial = this._getMaterialForElement(wallElement);
            wallMaterial.side = THREE.DoubleSide;
            this._fitMaterialRepeatToSurface(wallMaterial, wallElement, width, height);
            const panel = addPanel(name, localX, y, width, height, wallMaterial, zOffset);
            panel.userData = {
                element: wallElement,
                type: 'wall',
                surfaceLength: width,
                surfaceHeight: height,
                actualSegmentLength: width,
                profileIndex: edge.index
            };
            this.walls[name] = panel;
            return panel;
        };

        const addRectFrame = (prefix, localX, y, width, height, material = frameMaterial, thickness = 0.07, zOffset = offset + 0.014) => {
            const depth = material === gasketMaterial ? 0.026 : 0.052;
            addBox(`${prefix}_top`, localX, y + height / 2 - thickness / 2, width, thickness, depth, material, zOffset);
            addBox(`${prefix}_bottom`, localX, y - height / 2 + thickness / 2, width, thickness, depth, material, zOffset);
            addBox(`${prefix}_left`, localX - width / 2 + thickness / 2, y, thickness, height, depth, material, zOffset);
            addBox(`${prefix}_right`, localX + width / 2 - thickness / 2, y, thickness, height, depth, material, zOffset);
        };

        const addApartmentBehindEntrance = () => {
            const roomDepth = Math.max(1.35, Math.min(2.0, dimensions.width * 1.25));
            const roomWidth = Math.max(openingW + 0.7, Math.min(wallLength + 0.4, 3.5));
            const roomHeight = Math.max(2.35, Math.min(dimensions.height, 2.7));
            const apartmentFloorMaterial = new THREE.MeshStandardMaterial({
                color: 0xa47d5e,
                roughness: 0.82,
                metalness: 0.02
            });
            const apartmentWallMaterial = new THREE.MeshStandardMaterial({
                color: 0xd8d0c3,
                roughness: 0.9,
                metalness: 0.01
            });
            const apartmentSideMaterial = new THREE.MeshStandardMaterial({
                color: 0xcac1b5,
                roughness: 0.88,
                metalness: 0.01
            });
            const baseboardMaterial = new THREE.MeshStandardMaterial({
                color: 0xf4f0e9,
                roughness: 0.58,
                metalness: 0.02
            });

            addBox('apartment_floor', 0, 0.012, roomWidth, 0.024, roomDepth, apartmentFloorMaterial, -roomDepth / 2);
            addBox('apartment_ceiling', 0, roomHeight - 0.015, roomWidth, 0.03, roomDepth, apartmentWallMaterial, -roomDepth / 2);
            addBox('apartment_back_wall', 0, roomHeight / 2, roomWidth, roomHeight, 0.035, apartmentWallMaterial, -roomDepth);
            addBox('apartment_left_wall', -roomWidth / 2, roomHeight / 2, 0.035, roomHeight, roomDepth, apartmentSideMaterial, -roomDepth / 2);
            addBox('apartment_right_wall', roomWidth / 2, roomHeight / 2, 0.035, roomHeight, roomDepth, apartmentSideMaterial, -roomDepth / 2);
            addBox('apartment_back_baseboard', 0, 0.09, roomWidth, 0.08, 0.045, baseboardMaterial, -roomDepth + 0.03);
        };

        const addWallCutout = () => {
            const sideWidth = Math.max(0, (wallLength - openingW) / 2);
            const topHeight = Math.max(0, dimensions.height - (baseY + openingH));
            const bottomHeight = Math.max(0, baseY);
            addWallPanel('entrance_wall_left', -openingW / 2 - sideWidth / 2, dimensions.height / 2, sideWidth, dimensions.height);
            addWallPanel('entrance_wall_right', openingW / 2 + sideWidth / 2, dimensions.height / 2, sideWidth, dimensions.height);
            addWallPanel('entrance_wall_top', 0, baseY + openingH + topHeight / 2, openingW, topHeight);
            addWallPanel('entrance_wall_bottom', 0, bottomHeight / 2, openingW, bottomHeight);
            addRectFrame('entrance_wall_reveal', 0, centerY, openingW + 0.16, openingH + 0.16, revealMaterial, 0.08, offset + 0.004);
        };

        const addTransparentBalconyBlock = () => {
            const clearW = Math.max(1.18, openingW - 0.14);
            const clearH = Math.max(1.8, openingH - 0.12);
            const bottomY = baseY + 0.06;
            const frameY = bottomY + clearH / 2;
            const gap = 0.04;
            const glassInset = 0.11;
            const doorGlassH = Math.max(1.55, clearH - 0.18);
            const doorGlassY = frameY + 0.01;

            const addMullion = (name, x) => {
                addBox(name, x, frameY, 0.07, clearH, 0.07, frameMaterial, offset + 0.035);
            };

            const addDoor = (prefix, x, width) => {
                addRectFrame(`${prefix}_frame`, x, frameY, width, clearH, frameMaterial, 0.06, offset + 0.038);
                addBox(`${prefix}_glass`, x, doorGlassY, Math.max(0.28, width - glassInset), doorGlassH, 0.018, glassMaterial, offset + 0.056);
                addRectFrame(`${prefix}_gasket`, x, doorGlassY, Math.max(0.34, width - glassInset + 0.04), doorGlassH + 0.04, gasketMaterial, 0.018, offset + 0.064);
                addBox(`${prefix}_handle`, x + width * 0.32, baseY + Math.min(1.08, clearH * 0.5), 0.032, 0.22, 0.035, handleMaterial, offset + 0.088);
            };

            const addWindow = (prefix, x, width, windowHeight) => {
                const safeWindowH = Math.max(0.42, Math.min(windowHeight, clearH - 0.16));
                const topGap = 0.08;
                const windowY = bottomY + clearH - topGap - safeWindowH / 2;
                const infillH = Math.max(0, clearH - safeWindowH - topGap);
                const infillY = bottomY + infillH / 2;

                if (infillH > 0.03) {
                    addBox(`${prefix}_wall_infill`, x, infillY, width, infillH, 0.035, revealMaterial, offset + 0.022);
                }

                addRectFrame(`${prefix}_frame`, x, windowY, width, safeWindowH, frameMaterial, 0.055, offset + 0.034);
                addBox(`${prefix}_glass`, x, windowY, Math.max(0.22, width - glassInset), Math.max(0.24, safeWindowH - glassInset), 0.018, glassMaterial, offset + 0.052);
                addRectFrame(`${prefix}_gasket`, x, windowY, Math.max(0.28, width - glassInset + 0.04), Math.max(0.3, safeWindowH - glassInset + 0.04), gasketMaterial, 0.018, offset + 0.06);
            };

            addRectFrame('entrance_pvc_outer_frame', 0, centerY, openingW, openingH, frameMaterial, 0.075, offset + 0.018);

            if (type === 'open-connection') {
                const doorW = Math.max(0.62, clearW * 0.34);
                const sideW = Math.max(0.28, (clearW - doorW - gap * 2) / 2);
                const totalW = sideW * 2 + doorW + gap * 2;
                const startX = -totalW / 2;
                const leftX = startX + sideW / 2;
                const doorX = startX + sideW + gap + doorW / 2;
                const rightX = startX + sideW + gap + doorW + gap + sideW / 2;

                addMullion('entrance_left_mullion', startX + sideW + gap / 2);
                addMullion('entrance_right_mullion', startX + sideW + gap + doorW + gap / 2);
                addWindow('entrance_left_window', leftX, sideW, clearH * 0.33);
                addDoor('entrance_center_door', doorX, doorW);
                addWindow('entrance_right_window', rightX, sideW, clearH * 0.33);
            } else {
                const doorShare = type === 'glazing-window' ? 0.36 : 0.54;
                const doorW = Math.max(0.58, clearW * doorShare);
                const windowW = Math.max(0.38, clearW - doorW - gap);
                const totalW = doorW + windowW + gap;
                const startX = -totalW / 2;
                const doorX = startX + doorW / 2;
                const windowX = startX + doorW + gap + windowW / 2;
                const windowH = type === 'glazing-window' ? clearH * 0.38 : clearH * 0.42;

                addMullion('entrance_right_mullion', startX + doorW + gap / 2);
                addDoor('entrance_left_door', doorX, doorW);
                addWindow('entrance_right_window', windowX, windowW, windowH);
            }

            addBox('entrance_top_transom_bar', 0, baseY + openingH - 0.19, openingW - 0.16, 0.045, 0.055, frameMaterial, offset + 0.066);
            addBox('entrance_threshold', 0, baseY + 0.055, openingW - 0.1, 0.11, 0.12, frameMaterial, offset + 0.07);
        };

        addApartmentBehindEntrance();
        addWallCutout();
        addTransparentBalconyBlock();

        this.balconyGroup.add(group);
    }

    _getBackEntranceEdge(profile) {
        if (!profile?.points?.length) return null;
        const center = this._getProfileCenter(profile);
        const candidates = profile.points.map((start, index) => {
            const end = profile.points[(index + 1) % profile.points.length];
            const dx = end.x - start.x;
            const dz = end.z - start.z;
            const length = Math.hypot(dx, dz);
            const mid = { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 };
            return { start, end, index, dx, dz, length, mid };
        }).filter((edge) => edge.length > 0.25);

        const edge = candidates.reduce((best, current) => {
            if (!best) return current;
            if (current.mid.z < best.mid.z - 0.001) return current;
            if (Math.abs(current.mid.z - best.mid.z) < 0.001 && current.length > best.length) return current;
            return best;
        }, null);
        if (!edge) return null;

        const angle = Math.atan2(edge.dz, edge.dx);
        const unit = { x: edge.dx / edge.length, z: edge.dz / edge.length };
        const toCenter = { x: center.x - edge.mid.x, z: center.z - edge.mid.z };
        const toCenterLength = Math.hypot(toCenter.x, toCenter.z) || 1;

        return {
            ...edge,
            angle,
            unit,
            inward: { x: toCenter.x / toCenterLength, z: toCenter.z / toCenterLength }
        };
    }

    _createGlazingForSegment(start, end, dimensions, glazingType, sectionsCount) {
        const { height } = dimensions;
        const dx = end.x - start.x;
        const dz = end.z - start.z;
        const segmentLength = Math.hypot(dx, dz);
        const angle = Math.atan2(dz, dx);
        const unitX = dx / segmentLength;
        const unitZ = dz / segmentLength;
        const normal = this._getSegmentNormal(start, end);
        const frameDepth = 0.08;
        const frameBottom = glazingType === 'french' ? 0.16 : 1.05;
        const frameHeight = glazingType === 'french'
            ? Math.max(height - 0.24, 1.4)
            : Math.max(height - frameBottom - 0.08, 0.9);
        const centerY = frameBottom + frameHeight / 2;
        const sectionWidth = segmentLength / sectionsCount;
        const frameMaterial = this._getWindowFrameMaterial();
        const glassMaterial = this._getWindowGlassMaterial();
        const objects = [];

        const centerX = (start.x + end.x) / 2;
        const centerZ = (start.z + end.z) / 2;
        const frameCenterX = centerX + normal.x * 0.02;
        const frameCenterZ = centerZ + normal.z * 0.02;
        const addFramePart = (width, partHeight, offsetAlong, y) => {
            const part = new THREE.Mesh(
                new THREE.BoxGeometry(width, partHeight, frameDepth),
                frameMaterial
            );
            part.position.set(
                frameCenterX + unitX * offsetAlong,
                y,
                frameCenterZ + unitZ * offsetAlong
            );
            part.rotation.y = -angle;
            part.userData = { element: 'window', type: 'frame' };
            objects.push(part);
        };

        addFramePart(segmentLength, 0.05, 0, frameBottom + frameHeight - 0.025);
        addFramePart(segmentLength, 0.05, 0, frameBottom + 0.025);
        addFramePart(0.05, frameHeight, -segmentLength / 2 + 0.025, centerY);
        addFramePart(0.05, frameHeight, segmentLength / 2 - 0.025, centerY);

        const glass = new THREE.Mesh(
            new THREE.PlaneGeometry(Math.max(segmentLength - 0.08, 0.2), Math.max(frameHeight - 0.08, 0.2)),
            glassMaterial
        );
        glass.position.set(
            centerX + normal.x * 0.05,
            centerY,
            centerZ + normal.z * 0.05
        );
        glass.rotation.y = -angle;
        glass.name = `glazing_glass_${Math.round(glass.position.x * 100)}_${Math.round(glass.position.z * 100)}`;
        glass.userData = { element: 'window', type: 'glass' };
        objects.push(glass);

        for (let i = 1; i < sectionsCount; i++) {
            const offset = -segmentLength / 2 + sectionWidth * i;
            const mullion = new THREE.Mesh(
                new THREE.BoxGeometry(0.05, frameHeight, frameDepth + 0.01),
                frameMaterial
            );
            mullion.position.set(
                centerX + unitX * offset + normal.x * 0.03,
                centerY,
                centerZ + unitZ * offset + normal.z * 0.03
            );
            mullion.rotation.y = -angle;
            mullion.userData = { element: 'window', type: 'frame' };
            objects.push(mullion);
        }

        return objects;
    }

    _getEdgeSections(edges, requestedSections) {
        const totalLength = edges.reduce((sum, edge) => {
            return sum + Math.hypot(edge.end.x - edge.start.x, edge.end.z - edge.start.z);
        }, 0);

        if (!edges.length) {
            return [];
        }

        const safeRequestedSections = Math.max(1, parseInt(requestedSections, 10) || edges.length);

        const distribution = edges.map(edge => {
            const length = Math.hypot(edge.end.x - edge.start.x, edge.end.z - edge.start.z);
            return Math.max(1, Math.round((length / totalLength) * safeRequestedSections));
        });

        let diff = safeRequestedSections - distribution.reduce((sum, value) => sum + value, 0);
        let index = 0;

        while (diff !== 0 && distribution.length > 0 && index < distribution.length * 20) {
            const currentIndex = index % distribution.length;
            if (diff > 0) {
                distribution[currentIndex] += 1;
                diff -= 1;
            } else if (distribution[currentIndex] > 1) {
                distribution[currentIndex] -= 1;
                diff += 1;
            }
            index += 1;
        }

        return distribution;
    }

    _getWallElementName(start, end, index) {
        const midpoint = {
            x: (start.x + end.x) / 2,
            z: (start.z + end.z) / 2
        };
        const dx = Math.abs(end.x - start.x);
        const dz = Math.abs(end.z - start.z);

        if (dx >= dz) {
            return midpoint.z >= 0 ? 'walls_front' : 'walls_back';
        }

        return midpoint.x >= 0 ? 'walls_right' : 'walls_left';
    }

    _getSegmentNormal(start, end) {
        const dx = end.x - start.x;
        const dz = end.z - start.z;
        const length = Math.hypot(dx, dz) || 1;

        return {
            x: -dz / length,
            z: dx / length
        };
    }

    _getProfileBounds(profile) {
        const xs = profile.points.map(point => point.x);
        const zs = profile.points.map(point => point.z);

        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minZ: Math.min(...zs),
            maxZ: Math.max(...zs),
            centerX: (Math.min(...xs) + Math.max(...xs)) / 2,
            centerZ: (Math.min(...zs) + Math.max(...zs)) / 2,
            width: Math.max(...xs) - Math.min(...xs),
            depth: Math.max(...zs) - Math.min(...zs)
        };
    }

    _getGlazingCenter(profile) {
        const centers = profile.glazingEdges.map(index => {
            const start = profile.points[index];
            const end = profile.points[(index + 1) % profile.points.length];

            return {
                x: (start.x + end.x) / 2,
                z: (start.z + end.z) / 2
            };
        });

        if (centers.length === 0) {
            const bounds = this._getProfileBounds(profile);
            return { x: bounds.centerX, z: bounds.maxZ };
        }

        return {
            x: centers.reduce((sum, point) => sum + point.x, 0) / centers.length,
            z: centers.reduce((sum, point) => sum + point.z, 0) / centers.length
        };
    }

    _getInteriorCameraPose(dimensions) {
        const safeDimensions = dimensions || this.builder?.dimensions || {
            length: 3,
            width: 1.4,
            height: 2.7,
            shape: 'loggia-3'
        };
        const profile = this._getBalconyProfile(safeDimensions);
        const bounds = this._getProfileBounds(profile);
        const glazingCenter = this._getGlazingCenter(profile);
        const eyeHeight = this._getInteriorEyeHeight(safeDimensions);
        const cameraX = THREE.MathUtils.clamp(
            glazingCenter.x,
            bounds.minX + 0.24,
            bounds.maxX - 0.24
        );
        const cameraZ = THREE.MathUtils.clamp(
            (bounds.minZ + glazingCenter.z) / 2,
            bounds.minZ + 0.24,
            bounds.maxZ - 0.24
        );

        return {
            x: cameraX,
            y: eyeHeight,
            z: cameraZ,
            lookAt: {
                x: glazingCenter.x,
                y: Math.min(eyeHeight + 0.02, safeDimensions.height - 0.45),
                z: glazingCenter.z + 0.08
            }
        };
    }

    _getInteriorEyeHeight(dimensions = this.builder?.dimensions) {
        const rawHeight = Number(dimensions?.height);
        const height = Number.isFinite(rawHeight) ? rawHeight : 2.7;
        return Math.min(Math.max(height * 0.55, 1.42), height - 0.42);
    }

    _getInteriorTargetYBounds(dimensions = this.builder?.dimensions) {
        const rawHeight = Number(dimensions?.height);
        const height = Number.isFinite(rawHeight) ? rawHeight : 2.7;
        const eyeY = this._getInteriorEyeHeight(dimensions);
        const minY = Math.max(0.28, eyeY - 1.15);
        const maxY = Math.max(minY + 0.35, Math.min(height - 0.18, eyeY + 1.05));

        return { minY, maxY };
    }

    _setInteriorCameraAnchor(pose) {
        if (!pose) return;

        this.interiorCameraAnchor = new THREE.Vector3(pose.x, pose.y, pose.z);
        const lookTarget = new THREE.Vector3(pose.lookAt.x, pose.lookAt.y, pose.lookAt.z);
        this.interiorLookDistance = THREE.MathUtils.clamp(
            lookTarget.distanceTo(this.interiorCameraAnchor),
            1.15,
            2.0
        );
    }

    _getInteriorCameraAnchor(dimensions = this.builder?.dimensions) {
        const pose = this._getInteriorCameraPose(dimensions);
        if (!this.interiorCameraAnchor) {
            this._setInteriorCameraAnchor(pose);
        }

        const bounds = this.cameraBounds;
        const anchor = this.interiorCameraAnchor?.clone?.() || new THREE.Vector3(pose.x, pose.y, pose.z);
        if (bounds) {
            anchor.x = THREE.MathUtils.clamp(anchor.x, bounds.minX + 0.04, bounds.maxX - 0.04);
            anchor.y = bounds.eyeY ?? this._getInteriorEyeHeight(dimensions);
            anchor.z = THREE.MathUtils.clamp(anchor.z, bounds.minZ + 0.05, bounds.maxZ - 0.05);
            this.interiorCameraAnchor.copy(anchor);
        }

        return anchor;
    }

    _applyInteriorCameraPose(dimensions, animate = false) {
        const pose = this._getInteriorCameraPose(dimensions);
        this._setInteriorCameraAnchor(pose);

        if (animate) {
            this._animateCamera(pose, pose.lookAt);
            return;
        }

        this.camera.position.set(pose.x, pose.y, pose.z);
        this.camera.lookAt(pose.lookAt.x, pose.lookAt.y, pose.lookAt.z);

        if (this.controls) {
            this.controls.target.set(pose.lookAt.x, pose.lookAt.y, pose.lookAt.z);
            this._applyControlLimits(dimensions || this.builder?.dimensions);
            this.controls.update();
        }
    }

    _captureCameraState() {
        if (!this.camera) {
            return null;
        }

        return {
            position: this.camera.position.clone(),
            target: this.controls ? this.controls.target.clone() : null
        };
    }

    _restoreCameraState(cameraState, dimensions) {
        if (!cameraState || !this.camera) {
            return;
        }

        if (this.state.viewMode === 'interior') {
            const pose = this._getInteriorCameraPose(dimensions || this.builder?.dimensions);
            this._setInteriorCameraAnchor(pose);
            const anchor = this._getInteriorCameraAnchor(dimensions || this.builder?.dimensions);
            const direction = cameraState.target
                ? cameraState.target.clone().sub(cameraState.position)
                : new THREE.Vector3(pose.lookAt.x - pose.x, pose.lookAt.y - pose.y, pose.lookAt.z - pose.z);
            if (direction.lengthSq() < 0.000001) {
                direction.set(0, 0, 1);
            }
            direction.normalize();

            this.camera.position.copy(anchor);
            if (this.controls) {
                this.controls.target.copy(anchor).add(direction.multiplyScalar(this.interiorLookDistance));
                this._applyControlLimits(dimensions || this.builder?.dimensions);
                this._constrainInteriorCamera();
                this.controls.update();
            } else {
                this.camera.lookAt(anchor.clone().add(direction));
            }
            return;
        }

        this.camera.position.copy(cameraState.position);

        if (this.controls && cameraState.target) {
            this.controls.target.copy(cameraState.target);
            this._applyControlLimits(dimensions || this.builder?.dimensions);
            this._constrainInteriorCamera();
            this.controls.update();
        } else if (cameraState.target) {
            this.camera.lookAt(cameraState.target);
        }
    }

    _updateCameraBounds(dimensions) {
        const profile = this._getBalconyProfile(dimensions);
        const bounds = this._getProfileBounds(profile);
        const wallClearance = 0.14;
        const cameraInsetX = THREE.MathUtils.clamp(bounds.width * 0.14, wallClearance, 0.28);
        const cameraInsetZ = THREE.MathUtils.clamp(bounds.depth * 0.18, wallClearance + 0.04, 0.34);
        const eyeY = this._getInteriorEyeHeight(dimensions);
        const targetYBounds = this._getInteriorTargetYBounds(dimensions);
        this.cameraBounds = {
            minX: bounds.minX + cameraInsetX,
            maxX: bounds.maxX - cameraInsetX,
            minZ: bounds.minZ + cameraInsetZ,
            maxZ: bounds.maxZ - cameraInsetZ,
            minY: 1.2,
            maxY: Math.max(1.6, dimensions.height - 0.45),
            eyeY,
            targetMinY: targetYBounds.minY,
            targetMaxY: targetYBounds.maxY,
            centerX: bounds.centerX,
            centerZ: bounds.centerZ,
            width: bounds.width,
            depth: bounds.depth
        };

        this._applyControlLimits(dimensions);
    }

    _applyControlLimits(dimensions) {
        if (!this.controls || !this.cameraBounds || !dimensions) return;

        const span = Math.max(this.cameraBounds.width, this.cameraBounds.depth);
        this.controls.enablePan = false;
        if (this.state.viewMode === 'interior') {
            const fixedDistance = THREE.MathUtils.clamp(this.interiorLookDistance || 1.55, 1.15, 2.0);
            this.controls.enableZoom = false;
            this.controls.minDistance = fixedDistance;
            this.controls.maxDistance = fixedDistance;
            this.controls.minPolarAngle = Math.PI * 0.18;
            this.controls.maxPolarAngle = Math.PI * 0.86;

            const targetYBounds = this._getInteriorTargetYBounds(dimensions);
            const targetMinY = Number.isFinite(this.cameraBounds.targetMinY)
                ? this.cameraBounds.targetMinY
                : targetYBounds.minY;
            const targetMaxY = Number.isFinite(this.cameraBounds.targetMaxY)
                ? this.cameraBounds.targetMaxY
                : targetYBounds.maxY;
            const anchor = this._getInteriorCameraAnchor(dimensions);
            this.camera.position.copy(anchor);
            this.controls.target.y = Math.min(
                targetMaxY,
                Math.max(targetMinY, this.controls.target.y)
            );
        } else {
            this.controls.enableZoom = true;
            this.controls.minDistance = 0.48;
            this.controls.maxDistance = Math.max(1.6, Math.min(span * 1.1, 3.2));
            this.controls.target.clamp(
                new THREE.Vector3(this.cameraBounds.minX - 0.18, 1.05, this.cameraBounds.minZ - 0.18),
                new THREE.Vector3(this.cameraBounds.maxX + 0.18, dimensions.height - 0.25, this.cameraBounds.maxZ - 0.02)
            );
        }
    }

    _constrainInteriorCamera() {
        if (!this.controls || !this.cameraBounds || this.state.viewMode !== 'interior') {
            return;
        }

        const bounds = this.cameraBounds;
        const lookDirection = this.controls.target.clone().sub(this.camera.position);
        if (lookDirection.lengthSq() < 0.000001) {
            lookDirection.set(0, 0, 1);
        }

        const lookDistance = THREE.MathUtils.clamp(this.interiorLookDistance || lookDirection.length(), 1.15, 2.0);
        lookDirection.normalize();

        const anchor = this._getInteriorCameraAnchor(this.builder?.dimensions);
        this.camera.position.copy(anchor);
        this.controls.target.copy(anchor).add(lookDirection.multiplyScalar(lookDistance));
        const targetYBounds = this._getInteriorTargetYBounds(this.builder?.dimensions);
        const targetMinY = Number.isFinite(bounds.targetMinY) ? bounds.targetMinY : targetYBounds.minY;
        const targetMaxY = Number.isFinite(bounds.targetMaxY) ? bounds.targetMaxY : targetYBounds.maxY;
        this.controls.target.y = Math.min(targetMaxY, Math.max(targetMinY, this.controls.target.y));
        this.camera.lookAt(this.controls.target);
    }

    _getViewPoses() {
        const dimensions = this.builder?.dimensions || {
            length: 3,
            width: 1.4,
            height: 2.7,
            shape: 'loggia-3'
        };
        const profile = this._getBalconyProfile(dimensions);
        const bounds = this._getProfileBounds(profile);
        const glazingCenter = this._getGlazingCenter(profile);
        const center = {
            x: bounds.centerX,
            y: Math.min(Math.max(dimensions.height * 0.55, 1.4), dimensions.height - 0.4),
            z: bounds.centerZ
        };
        const interior = this._getInteriorCameraPose(dimensions);
        const sideInsetX = THREE.MathUtils.clamp(bounds.width * 0.18, 0.2, 0.42);
        const sideInsetZ = THREE.MathUtils.clamp(bounds.depth * 0.18, 0.18, 0.38);
        const topY = Math.max(1.95, dimensions.height - 0.32);

        return {
            front: {
                x: interior.x,
                y: interior.y,
                z: interior.z,
                lookAt: { x: glazingCenter.x, y: center.y, z: glazingCenter.z }
            },
            top: {
                x: center.x,
                y: topY,
                z: Math.min(bounds.maxZ - 0.18, Math.max(bounds.minZ + 0.18, center.z)),
                lookAt: { x: center.x, y: 0.35, z: center.z }
            },
            side: {
                x: bounds.maxX - sideInsetX,
                y: center.y,
                z: center.z - sideInsetZ,
                lookAt: { x: bounds.minX + sideInsetX, y: center.y, z: center.z }
            },
            iso: {
                x: bounds.maxX - sideInsetX,
                y: Math.max(1.8, dimensions.height * 0.72),
                z: bounds.minZ + sideInsetZ,
                lookAt: { x: center.x, y: center.y, z: center.z }
            },
            interior
        };
    }

    /**
     * @private
     */
    _createMarkers(dimensions) {
        this.markers.forEach(marker => this.scene.remove(marker));
        this.markers = [];

        const navigationPoints = this._getNavigationPoints(dimensions);
        if (!navigationPoints.length) {
            return;
        }

        navigationPoints.forEach((point) => this._createNavigationMarker(point));
        console.log('? Navigation markers created');
        return;

        const { height } = dimensions;
        const profile = this._getBalconyProfile(dimensions);
        const bounds = this._getProfileBounds(profile);
        const markerOffset = 0.12;

        const wallMarkers = [
            { name: 'walls_front', pos: { x: bounds.centerX, y: height / 2, z: bounds.maxZ - markerOffset }, color: 0xffa500 },
            { name: 'walls_back', pos: { x: bounds.centerX, y: height / 2, z: bounds.minZ + markerOffset }, color: 0xffa500 },
            { name: 'walls_left', pos: { x: bounds.minX + markerOffset, y: height / 2, z: bounds.centerZ }, color: 0xffa500 },
            { name: 'walls_right', pos: { x: bounds.maxX - markerOffset, y: height / 2, z: bounds.centerZ }, color: 0xffa500 },
            { name: 'ceiling', pos: { x: bounds.centerX, y: height - 0.18, z: bounds.centerZ }, color: 0x00ff00 },
            { name: 'floor', pos: { x: bounds.centerX, y: 0.12, z: bounds.centerZ }, color: 0x0000ff }
        ];

        wallMarkers.forEach(marker => {
            const geometry = new THREE.SphereGeometry(0.08, 16, 16);
            const material = new THREE.MeshBasicMaterial({ 
                color: marker.color,
                transparent: true,
                opacity: 0.8
            });
            const sphere = new THREE.Mesh(geometry, material);
            sphere.position.set(marker.pos.x, marker.pos.y, marker.pos.z);
            sphere.userData = { element: marker.name, isMarker: true };
            
            this.scene.add(sphere);
            this.markers.push(sphere);

            const ringGeometry = new THREE.RingGeometry(0.1, 0.12, 32);
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: marker.color,
                transparent: true,
                opacity: 0.6,
                side: THREE.DoubleSide
            });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.position.set(marker.pos.x, marker.pos.y, marker.pos.z);
            ring.lookAt(this.camera.position);
            ring.userData = { element: marker.name, isMarker: true, isRing: true };
            
            this.scene.add(ring);
            this.markers.push(ring);
        });

        console.log('? Markers created for interaction');
    }

    /**
     * @private
     */
    _getNavigationPoints(dimensions) {
        const { length = 3, width = 1.4, height = 2.7, shape = 'loggia-3' } = dimensions || {};
        const profile = this._getBalconyProfile({ length, width, height, shape });
        const bounds = this._getProfileBounds(profile);
        const glazingCenter = this._getGlazingCenter(profile);
        const halfL = length / 2;
        const halfW = width / 2;
        const eyeHeight = this._getInteriorEyeHeight(dimensions);
        const layout = this.builder?.glazing?.layout || 'straight';
        const gSide = this.builder?.glazing?.gSide === 'right' ? 'right' : 'left';
        const glazingZ = bounds.maxZ;
        const centerZ = THREE.MathUtils.clamp(
            (bounds.minZ + glazingZ) / 2,
            bounds.minZ + 0.28,
            bounds.maxZ - 0.28
        );
        const centerX = THREE.MathUtils.clamp(
            glazingCenter.x,
            bounds.minX + 0.28,
            bounds.maxX - 0.28
        );
        const frontLookY = Math.min(eyeHeight, height - 0.45);
        const insetX = Math.max(0.24, Math.min(length * 0.18, 0.55));
        const alignedZ = centerZ;
        const points = [
            {
                id: 'full-view',
                label: 'full-view',
                position: { x: centerX, y: 0.028, z: THREE.MathUtils.clamp(bounds.minZ + 0.26, bounds.minZ + 0.22, bounds.maxZ - 0.34) },
                camera: { x: centerX, y: eyeHeight, z: THREE.MathUtils.clamp(bounds.minZ + 0.32, bounds.minZ + 0.24, bounds.maxZ - 0.38) },
                lookAt: {
                    x: glazingCenter.x,
                    y: frontLookY,
                    z: THREE.MathUtils.clamp(bounds.centerZ + 0.2, bounds.minZ + 0.18, bounds.maxZ - 0.04)
                }
            },
            {
                id: 'center',
                label: 'center',
                position: { x: centerX, y: 0.028, z: centerZ },
                camera: { x: centerX, y: eyeHeight, z: centerZ },
                lookAt: {
                    x: glazingCenter.x,
                    y: frontLookY,
                    z: glazingCenter.z + 0.08
                }
            }
        ];

        if (shape === 'loggia-3') {
            return points;
        }

        if (shape === 'boot') {
            const standingZ = -halfW + width * (600 / 2100);
            const frontZone = this._clampPointInsideProfile(
                { x: -halfL + length * 0.34, z: standingZ },
                profile,
                0.22
            );
            const sideZone = this._clampPointInsideProfile(
                { x: -halfL + length * 0.72, z: standingZ },
                profile,
                0.22
            );

            return [
                {
                    id: 'boot-main',
                    label: 'boot-main',
                    position: { x: frontZone.x, y: 0.028, z: frontZone.z },
                    camera: { x: frontZone.x, y: eyeHeight, z: frontZone.z },
                    lookAt: {
                        x: frontZone.x,
                        y: frontLookY,
                        z: -halfW + width * (1200 / 2100)
                    }
                },
                {
                    id: 'boot-side',
                    label: 'boot-side',
                    position: { x: sideZone.x, y: 0.028, z: sideZone.z },
                    camera: { x: sideZone.x, y: eyeHeight, z: sideZone.z },
                    lookAt: {
                        x: sideZone.x,
                        y: frontLookY,
                        z: -halfW + width * (1200 / 2100)
                    }
                }
            ];
        }

        if (layout === 'straight') {
            return points;
        }

        if (layout === 'g') {
            const isRight = gSide === 'right';
            const cornerX = isRight ? (halfL - insetX) : (-halfL + insetX);
            points.push({
                id: isRight ? 'front-right' : 'front-left',
                label: isRight ? 'front-right' : 'front-left',
                position: { x: cornerX, y: 0.028, z: alignedZ },
                camera: { x: cornerX, y: eyeHeight, z: alignedZ },
                lookAt: {
                    x: cornerX,
                    y: frontLookY,
                    z: bounds.maxZ + 0.02
                }
            });
        } else if (layout === 'p') {
            const leftX = -halfL + insetX;
            const rightX = halfL - insetX;
            points.push(
                {
                    id: 'front-left',
                    label: 'front-left',
                    position: { x: leftX, y: 0.028, z: alignedZ },
                    camera: { x: leftX, y: eyeHeight, z: alignedZ },
                    lookAt: {
                        x: leftX,
                        y: frontLookY,
                        z: bounds.maxZ + 0.02
                    }
                },
                {
                    id: 'front-right',
                    label: 'front-right',
                    position: { x: rightX, y: 0.028, z: alignedZ },
                    camera: { x: rightX, y: eyeHeight, z: alignedZ },
                    lookAt: {
                        x: rightX,
                        y: frontLookY,
                        z: bounds.maxZ + 0.02
                    }
                }
            );
        }

        return points;
    }

    _createNavigationMarker(point) {
        const base = new THREE.Mesh(
            new THREE.CylinderGeometry(0.115, 0.115, 0.018, 28),
            new THREE.MeshStandardMaterial({
                color: 0xffffff,
                emissive: 0x2f67ff,
                emissiveIntensity: 0.2,
                roughness: 0.28,
                metalness: 0.08,
                transparent: true,
                opacity: 0.94
            })
        );
        base.position.set(point.position.x, point.position.y, point.position.z);
        base.userData = {
            element: 'navigation-point',
            isMarker: true,
            markerType: 'navigation',
            navigationPoint: point
        };

        const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.13, 0.18, 40),
            new THREE.MeshBasicMaterial({
                color: 0x7fb2ff,
                transparent: true,
                opacity: 0.78,
                side: THREE.DoubleSide
            })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(point.position.x, point.position.y + 0.011, point.position.z);
        ring.userData = {
            element: 'navigation-point',
            isMarker: true,
            isRing: true,
            markerType: 'navigation',
            navigationPoint: point
        };

        this.scene.add(base, ring);
        this.markers.push(base, ring);
    }

    _moveCameraToNavigationPoint(point) {
        if (!point || !this.camera) {
            return;
        }

        const dimensions = this.builder?.dimensions || {
            length: 3,
            width: 1.4,
            height: 2.7,
            shape: 'loggia-3'
        };

        this.state.viewMode = 'interior';
        this._setInteriorCameraAnchor({
            x: point.camera.x,
            y: point.camera.y,
            z: point.camera.z,
            lookAt: point.lookAt
        });
        this.camera.position.set(point.camera.x, point.camera.y, point.camera.z);

        if (this.controls) {
            this.controls.target.set(point.lookAt.x, point.lookAt.y, point.lookAt.z);
            this._applyControlLimits(dimensions);
            this._constrainInteriorCamera();
            this.controls.update();
        } else {
            this.camera.lookAt(point.lookAt.x, point.lookAt.y, point.lookAt.z);
        }
    }

    _createLShapeGeometry(length, width, thickness, shapeType) {
        const shape = new THREE.Shape();
        const extensionWidth = width * 0.5;

        if (shapeType === 'L-left') {
            shape.moveTo(0, 0);
            shape.lineTo(length, 0);
            shape.lineTo(length, width);
            shape.lineTo(length * 0.5, width);
            shape.lineTo(length * 0.5, width + extensionWidth);
            shape.lineTo(0, width + extensionWidth);
            shape.lineTo(0, 0);
        } else {
            shape.moveTo(0, 0);
            shape.lineTo(length, 0);
            shape.lineTo(length, width + extensionWidth);
            shape.lineTo(length * 0.5, width + extensionWidth);
            shape.lineTo(length * 0.5, width);
            shape.lineTo(0, width);
            shape.lineTo(0, 0);
        }

        const extrudeSettings = {
            depth: thickness,
            bevelEnabled: false
        };

        return new THREE.ExtrudeGeometry(shape, extrudeSettings);
    }

    /**
     * @private
     */
    _createPShapeGeometry(length, width, thickness) {
        const shape = new THREE.Shape();
        const extensionLength = length * 0.5;

        shape.moveTo(0, 0);
        shape.lineTo(length + extensionLength, 0);
        shape.lineTo(length + extensionLength, width);
        shape.lineTo(length, width);
        shape.lineTo(length, 0);
        shape.lineTo(0, 0);
        shape.lineTo(0, width);
        shape.lineTo(extensionLength, width);
        shape.lineTo(extensionLength, 0);
        shape.lineTo(0, 0);

        const extrudeSettings = {
            depth: thickness,
            bevelEnabled: false
        };

        return new THREE.ExtrudeGeometry(shape, extrudeSettings);
    }

    /**
     * @private
     */
    _centerBalcony(dimensions) {
        this.balconyGroup.position.set(0, 0, 0);
    }
        // ============================================
    // ============================================

    /**
     */
    requestRender(durationMs = 250) {
        this.forceRender = true;
        this.renderActiveUntil = Math.max(this.renderActiveUntil, performance.now() + durationMs);
    }

    /**
     */
    requestUpdate() {
        if (this.updateScheduled) return;
        this.updateScheduled = true;

        this.updateFrame = requestAnimationFrame(() => {
            this.updateScheduled = false;
            this.updateFrame = null;
            this.update();
            this.requestRender(400);
        });
    }

    /**
     */
    update() {
        if (!this.builder) return;

        const geometryKey = JSON.stringify({
            dimensions: this.builder.dimensions,
            glazingType: this.builder.glazing?.type,
            windowSections: this.builder.glazing?.windowSections,
            glazingLayout: this.builder.glazing?.layout,
            glazingGSide: this.builder.glazing?.gSide,
            entranceType: this.builder.entrance?.type,
            entranceMirrored: this.builder.entrance?.mirrored,
            entranceWidth: this.builder.entrance?.width,
            entranceHeight: this.builder.entrance?.height
        });
        const shouldRebuildGeometry = this.lastGeometryKey !== geometryKey;

        if (shouldRebuildGeometry) {
            this._updateGeometry({ preserveCamera: true });
            this.lastGeometryKey = geometryKey;
        } else {
            this._updateWindows();
            this._updateMarkers();
        }

        this._updateMaterials();

        this._updateLighting();

        this._updateFurniture();

        this._updateExterior();

    }

    /**
     * @private
     */
    _updateGeometry(options = {}) {
        this._createBalcony(options);
    }

    /**
     * @private
     */
    _updateMaterials() {
        if (!this.builder) return;

        console.log('?? Updating materials...');

        if (this.floor) {
            this.floor.material = this._getMaterialForElement('floor');
        }
        if (this.floorFinishing) {
            this.floorFinishing.material = this._getMaterialForElement('floor');
        }

        if (this.ceiling) {
            this.ceiling.material = this._isCeilingSlatSelected()
                ? this._getSlatBackerMaterial()
                : this._getMaterialForElement('ceiling');
        }
        if (this.ceilingFinishing) {
            this.ceilingFinishing.material = this._isCeilingSlatSelected()
                ? this._getSlatBackerMaterial()
                : this._getMaterialForElement('ceiling');
        }

        Object.entries(this.walls).forEach(([wallName, wall]) => {
            if (wall) {
                if (wall.userData?.type === 'parapet-cap') {
                    wall.material = this._getParapetCapMaterial();
                } else {
                    const wallMaterial = this._getMaterialForElement(wall.userData.element || wallName);
                    wallMaterial.side = THREE.DoubleSide;
                    wall.material = wallMaterial;
                    this._fitMaterialRepeatToSurface(
                        wall.material,
                        wall.userData.element || wallName,
                        wall.userData.actualSegmentLength || wall.userData.surfaceLength,
                        wall.userData.surfaceHeight
                    );
                }
            }
        });

        this._refreshStoneRelief();
        this._refreshSlatPanels();

        this.windows.forEach(window => {
            if (window.userData.type === 'frame') {
                window.material = this._getWindowFrameMaterial();
            } else if (window.userData.type === 'glass') {
                window.material = this._getWindowGlassMaterial();
            } else if (window.userData.type === 'sill') {
                window.material = this._getWindowSillMaterial();
            }
        });

        console.log('? Materials updated');
    }

    _clearStoneRelief() {
        if (!this.stoneReliefObjects?.length) return;

        this.stoneReliefObjects.forEach((group) => {
            group.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach((material) => {
                        ['map', 'normalMap', 'roughnessMap', 'aoMap', 'bumpMap'].forEach((mapKey) => {
                            const texture = material?.[mapKey];
                            if (texture?.userData?.stoneReliefClone) {
                                texture.dispose();
                            }
                        });
                        material.dispose();
                    });
                }
            });
            if (group.parent) {
                group.parent.remove(group);
            }
        });
        this.stoneReliefObjects = [];
    }

    _isStoneWallElement(element) {
        if (!this.builder || !element || !String(element).startsWith('walls_')) {
            return false;
        }

        const lookupElement = this._resolveMaterialLookupElement(element);
        const material = this.builder.getMaterial(lookupElement);
        if (this._isExactPhotoStoneMaterial(material) && MaterialsAPI?.getPBRMaps?.(material)?.color) {
            return false;
        }

        const sample = `${material?.id || ''} ${material?.texture || ''} ${material?.name || ''}`.toLowerCase();
        return /stone|brick|clinker|travertine|rock/.test(sample);
    }

    _getStoneReliefTexture(material) {
        if (!material?.id) return null;

        const cachedPack = this.materialsCache?.[material.id]?.textures;
        if (cachedPack?.color) {
            return cachedPack.color;
        }

        this._ensureMaterialTexturePack(material);
        return null;
    }

    _cloneStoneReliefTexture(sourceTexture, row, col, seed) {
        if (!sourceTexture) return null;

        const texture = sourceTexture.clone();
        const repeatMode = THREE.MirroredRepeatWrapping || THREE.RepeatWrapping;
        texture.wrapS = repeatMode;
        texture.wrapT = repeatMode;
        texture.repeat.set(
            0.34 + Math.abs(Math.sin(row * 2.81 + col * 4.37 + seed)) * 0.28,
            0.52 + Math.abs(Math.cos(row * 3.29 + col * 1.93 + seed)) * 0.32
        );
        texture.offset.set(
            (Math.abs(Math.sin(row * 12.17 + col * 7.13 + seed)) * 0.83) % 1,
            (Math.abs(Math.cos(row * 5.71 + col * 10.41 + seed)) * 0.79) % 1
        );
        texture.anisotropy = Math.min(10, this.renderer?.capabilities?.getMaxAnisotropy?.() || 1);
        texture.encoding = THREE.sRGBEncoding;
        texture.userData = {
            ...(texture.userData || {}),
            stoneReliefClone: true
        };
        texture.needsUpdate = true;
        return texture;
    }

    _createStoneReliefForWall(wall, elementName, reliefIndex = 0) {
        const params = wall?.geometry?.parameters || {};
        const wallLength = Math.max(Number(params.width) || 0, 0);
        const wallHeight = Math.max(Number(params.height) || 0, 0);
        const wallDepth = Math.max(Number(params.depth) || 0.14, 0.04);

        if (wallLength < 0.35 || wallHeight < 0.35) {
            return null;
        }

        const profile = this._getBalconyProfile(this.builder?.dimensions || { length: 3, width: 1.4, shape: 'loggia-3' });
        const center = this._getProfileCenter(profile);
        const inward = new THREE.Vector3(center.x - wall.position.x, 0, center.z - wall.position.z);
        if (inward.lengthSq() < 0.0001) {
            inward.set(Math.sin(wall.rotation.y), 0, -Math.cos(wall.rotation.y));
        }
        inward.normalize();

        const tangent = new THREE.Vector3(Math.cos(wall.rotation.y), 0, -Math.sin(wall.rotation.y));
        const group = new THREE.Group();
        group.name = `stone_relief_${elementName}_${reliefIndex}`;
        group.userData = {
            element: elementName,
            type: 'stone-relief',
            generated: true
        };

        const lookupElement = this._resolveMaterialLookupElement(elementName);
        const selectedMaterial = this.builder?.getMaterial(lookupElement);
        const sourceTexture = this._getStoneReliefTexture(selectedMaterial);
        const palette = [
            0x4d3b2b,
            0x6a5137,
            0x8b6b49,
            0x2f2822,
            0xb38c61,
            0x705a45,
            0xc4ad86,
            0x3b3229
        ];
        const textureTints = [
            0xd1b68d,
            0xb28a5f,
            0x7b624a,
            0x5c4938,
            0xc3a071,
            0x8d7257,
            0x4e3d2f
        ];
        const hasTexture = Boolean(sourceTexture);
        const mortarMaterial = new THREE.MeshStandardMaterial({
            color: 0x221b16,
            roughness: 0.96,
            metalness: 0.01
        });

        const mortarBack = new THREE.Mesh(
            new THREE.BoxGeometry(wallLength + 0.012, wallHeight + 0.012, 0.012),
            mortarMaterial
        );
        mortarBack.position.copy(wall.position).add(inward.clone().multiplyScalar(wallDepth / 2 + 0.008));
        mortarBack.rotation.y = wall.rotation.y;
        mortarBack.receiveShadow = true;
        group.add(mortarBack);

        const seed = Math.abs(Math.sin((wall.position.x + 13.7) * 11.31 + (wall.position.z + 5.3) * 19.17));
        let y = -wallHeight / 2 + 0.09;
        let row = 0;

        while (y < wallHeight / 2 - 0.08) {
            const rowHeight = THREE.MathUtils.clamp(0.15 + ((row + reliefIndex) % 3) * 0.035 + seed * 0.025, 0.14, 0.24);
            let x = -wallLength / 2 + ((row % 2) ? -0.08 : 0);
            let col = 0;

            while (x < wallLength / 2 - 0.06) {
                const widthNoise = Math.abs(Math.sin((row + 1) * 9.73 + (col + 1) * 4.61 + seed * 8));
                const blockWidth = THREE.MathUtils.clamp(0.28 + widthNoise * 0.32, 0.24, 0.62);
                const visibleWidth = Math.min(blockWidth, wallLength / 2 - x);
                if (visibleWidth > 0.12) {
                    const depthNoise = Math.abs(Math.sin((row + 2) * 5.91 + (col + 3) * 7.27 + seed));
                    const blockDepth = 0.026 + depthNoise * 0.038;
                    const paletteColor = palette[(row * 5 + col * 3 + reliefIndex) % palette.length];
                    const tintColor = textureTints[(row * 7 + col * 5 + reliefIndex) % textureTints.length];
                    const stoneTexture = this._cloneStoneReliefTexture(sourceTexture, row + reliefIndex, col, seed);
                    const stoneMaterial = new THREE.MeshStandardMaterial({
                        color: hasTexture ? tintColor : paletteColor,
                        map: stoneTexture,
                        roughness: 0.88 + depthNoise * 0.08,
                        metalness: 0.015,
                        bumpMap: stoneTexture || this.texturesCache.stone || null,
                        bumpScale: 0.018
                    });
                    const stone = new THREE.Mesh(
                        new THREE.BoxGeometry(
                            Math.max(visibleWidth - 0.018, 0.05),
                            Math.max(rowHeight - 0.014, 0.05),
                            blockDepth
                        ),
                        stoneMaterial
                    );
                    const localX = x + visibleWidth / 2;
                    const localY = y + rowHeight / 2;
                    stone.position
                        .copy(wall.position)
                        .add(tangent.clone().multiplyScalar(localX))
                        .add(new THREE.Vector3(0, localY, 0))
                        .add(inward.clone().multiplyScalar(wallDepth / 2 + 0.014 + blockDepth / 2));
                    stone.rotation.y = wall.rotation.y;
                    stone.castShadow = true;
                    stone.receiveShadow = true;
                    group.add(stone);

                    if (depthNoise > 0.42) {
                        const highlight = new THREE.Mesh(
                            new THREE.BoxGeometry(Math.max(visibleWidth - 0.05, 0.04), 0.012, 0.004),
                            new THREE.MeshStandardMaterial({
                                color: hasTexture ? 0x6e5540 : 0x8f775b,
                                roughness: 0.86,
                                metalness: 0.01
                            })
                        );
                        highlight.position
                            .copy(stone.position)
                            .add(new THREE.Vector3(0, Math.max(rowHeight * 0.33, 0.03), 0))
                            .add(inward.clone().multiplyScalar(blockDepth / 2 + 0.004));
                        highlight.rotation.y = wall.rotation.y;
                        group.add(highlight);
                    }
                }

                x += blockWidth;
                col += 1;
            }

            y += rowHeight;
            row += 1;
        }

        return group;
    }

    _refreshStoneRelief() {
        this._clearStoneRelief();
        if (!this.builder || !this.balconyGroup) return;

        let reliefIndex = 0;
        Object.values(this.walls).forEach((wall) => {
            const elementName = wall?.userData?.element;
            if (!wall?.isMesh || wall.userData?.type === 'corner-trim' || !this._isStoneWallElement(elementName)) {
                return;
            }

            const relief = this._createStoneReliefForWall(wall, elementName, reliefIndex);
            if (!relief) return;

            this.balconyGroup.add(relief);
            this.stoneReliefObjects.push(relief);
            reliefIndex += 1;
        });
    }

    _clearSlatPanels() {
        if (!this.slatPanelObjects?.length) return;

        this.slatPanelObjects.forEach((group) => {
            group.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach((material) => {
                        ['map', 'normalMap', 'roughnessMap', 'aoMap', 'bumpMap'].forEach((mapKey) => {
                            if (material?.[mapKey]) {
                                material[mapKey].dispose();
                            }
                        });
                        material.dispose();
                    });
                }
            });
            if (group.parent) {
                group.parent.remove(group);
            }
        });
        this.slatPanelObjects = [];
    }

    _isSlatMaterial(material) {
        const sample = `${material?.id || ''} ${material?.texture || ''} ${material?.name || ''}`.toLowerCase();
        return /slat|reik|рейк|decor-slats/.test(sample);
    }

    _isCeilingSlatSelected() {
        return this._isSlatMaterial(this.builder?.getMaterial('ceiling'));
    }

    _getSlatWoodMaterial() {
        return new THREE.MeshStandardMaterial({
            color: 0xd7bd91,
            roughness: 0.58,
            metalness: 0.025,
            envMapIntensity: 0.28,
            map: this._cloneTextureForSurface(this.texturesCache.wood, 1.2, 4.8, 'color') || null,
            bumpMap: this._cloneTextureForSurface(this.texturesCache.wood, 1.2, 4.8, 'height') || null,
            bumpScale: 0.012
        });
    }

    _getSlatBackerMaterial() {
        return new THREE.MeshStandardMaterial({
            color: 0x090807,
            roughness: 0.82,
            metalness: 0.02,
            envMapIntensity: 0.08,
            side: THREE.DoubleSide
        });
    }

    _getCeilingSlatLayoutMetrics(dimensions = this.builder?.dimensions) {
        const safeHeight = Number.isFinite(Number(dimensions?.height))
            ? Number(dimensions.height)
            : 2.7;
        const slatHeight = 0.065;
        const slatCenterY = safeHeight - 0.102;

        return {
            backerY: safeHeight - 0.052,
            slatWidth: 0.082,
            pitch: 0.165,
            slatHeight,
            slatCenterY,
            slatBottomY: slatCenterY - slatHeight / 2,
            lightBaseY: slatCenterY - slatHeight / 2 - 0.046
        };
    }

    _getCeilingLightBaseY(defaultY = 0) {
        const fallbackY = Number.isFinite(Number(defaultY))
            ? Number(defaultY)
            : (Number(this.builder?.dimensions?.height) || 2.7) - 0.04;

        if (!this._isCeilingSlatSelected()) {
            return fallbackY;
        }

        return this._getCeilingSlatLayoutMetrics().lightBaseY;
    }

    _createCeilingSlatPanel() {
        const material = this.builder?.getMaterial('ceiling');
        if (!this._isSlatMaterial(material)) return null;

        const dimensions = this.builder?.dimensions || { length: 3, width: 1.4, height: 2.7, shape: 'loggia-3' };
        const profile = this._getBalconyProfile(dimensions);
        const bounds = this._getProfileBounds(profile);
        const slatMetrics = this._getCeilingSlatLayoutMetrics(dimensions);
        const group = new THREE.Group();
        group.name = 'slat_panel_ceiling';
        group.userData = { element: 'ceiling', type: 'slat-panel' };

        const backer = this._createSurfaceFromPoints(
            profile.points,
            this._getSlatBackerMaterial(),
            slatMetrics.backerY,
            'slat_ceiling_black_backer',
            { element: 'ceiling', type: 'slat-backer' }
        );
        group.add(backer);

        const slatWidth = slatMetrics.slatWidth;
        const pitch = slatMetrics.pitch;
        const slatHeight = slatMetrics.slatHeight;
        const slatLength = bounds.width + 0.04;
        const woodMaterial = this._getSlatWoodMaterial();
        let z = bounds.minZ + slatWidth / 2;
        let index = 0;

        while (z <= bounds.maxZ - slatWidth / 2) {
            const slat = new THREE.Mesh(
                new THREE.BoxGeometry(slatLength, slatHeight, slatWidth),
                woodMaterial.clone()
            );
            slat.position.set(bounds.centerX, slatMetrics.slatCenterY, z);
            slat.castShadow = true;
            slat.receiveShadow = true;
            slat.name = `ceiling_slat_${index}`;
            slat.userData = { element: 'ceiling', type: 'slat' };
            group.add(slat);
            z += pitch;
            index += 1;
        }

        return group;
    }

    _createWallSlatPanel(wall, elementName) {
        const lookupElement = this._resolveMaterialLookupElement(elementName);
        const material = this.builder?.getMaterial(lookupElement);
        if (!this._isSlatMaterial(material)) return null;

        const params = wall?.geometry?.parameters || {};
        const visualWallLength = Math.max(Number(params.width) || 0, 0);
        const actualWallLength = Math.max(Number(wall?.userData?.actualSegmentLength) || visualWallLength, 0);
        const wallLength = actualWallLength;
        const wallHeight = Math.max(Number(params.height) || 0, 0);
        const wallDepth = Math.max(Number(params.depth) || 0.12, 0.04);
        if (wallLength < 0.55 || wallHeight < 0.35) return null;
        if (
            this.builder?.dimensions?.shape === 'boat' &&
            Number(wall?.userData?.profileIndex) === 3
        ) {
            return null;
        }

        const profile = this._getBalconyProfile(this.builder?.dimensions || { length: 3, width: 1.4, shape: 'loggia-3' });
        const center = this._getProfileCenter(profile);
        const inward = new THREE.Vector3(center.x - wall.position.x, 0, center.z - wall.position.z);
        if (inward.lengthSq() < 0.0001) {
            inward.set(Math.sin(wall.rotation.y), 0, -Math.cos(wall.rotation.y));
        }
        inward.normalize();

        const tangent = new THREE.Vector3(Math.cos(wall.rotation.y), 0, -Math.sin(wall.rotation.y));
        const group = new THREE.Group();
        group.name = `slat_panel_${elementName}`;
        group.userData = { element: elementName, type: 'slat-panel' };

        const backer = new THREE.Mesh(
            new THREE.BoxGeometry(wallLength + 0.012, wallHeight + 0.012, 0.014),
            this._getSlatBackerMaterial()
        );
        backer.position.copy(wall.position).add(inward.clone().multiplyScalar(wallDepth / 2 + 0.01));
        backer.rotation.y = wall.rotation.y;
        backer.receiveShadow = true;
        backer.userData = { element: elementName, type: 'slat-backer' };
        group.add(backer);

        const slatWidth = 0.045;
        const pitch = 0.118;
        const protrusion = 0.045;
        const slatHeight = Math.max(wallHeight - 0.035, 0.2);
        const globalPhase = this._getWallSlatGlobalPhase(wall, tangent, pitch);
        let x = -wallLength / 2 + slatWidth / 2 + globalPhase;
        let index = 0;

        while (x <= wallLength / 2 - slatWidth / 2) {
            const slat = new THREE.Mesh(
                new THREE.BoxGeometry(slatWidth, slatHeight, protrusion),
                this._getSlatWoodMaterial()
            );
            slat.position
                .copy(wall.position)
                .add(tangent.clone().multiplyScalar(x))
                .add(inward.clone().multiplyScalar(wallDepth / 2 + 0.02 + protrusion / 2));
            slat.rotation.y = wall.rotation.y;
            slat.castShadow = true;
            slat.receiveShadow = true;
            slat.name = `${elementName}_wall_slat_${index}`;
            slat.userData = { element: elementName, type: 'slat' };
            group.add(slat);
            x += pitch;
            index += 1;
        }

        return group;
    }

    _getWallSlatGlobalPhase(wall, tangent, pitch) {
        if (this.builder?.dimensions?.shape !== 'boat') {
            return 0;
        }

        const originProjection = wall.position.x * tangent.x + wall.position.z * tangent.z;
        const localStart = originProjection - (Number(wall.userData?.actualSegmentLength) || 0) / 2;
        const remainder = ((localStart % pitch) + pitch) % pitch;

        return remainder > 0 ? pitch - remainder : 0;
    }

    _refreshSlatPanels() {
        this._clearSlatPanels();
        if (!this.builder || !this.balconyGroup) return;

        const ceilingSlats = this._createCeilingSlatPanel();
        if (ceilingSlats) {
            this.balconyGroup.add(ceilingSlats);
            this.slatPanelObjects.push(ceilingSlats);
        }

        Object.values(this.walls).forEach((wall) => {
            const elementName = wall?.userData?.element;
            if (!wall?.isMesh || !elementName || wall.userData?.type === 'parapet-cap') return;

            const wallSlats = this._createWallSlatPanel(wall, elementName);
            if (!wallSlats) return;

            this.balconyGroup.add(wallSlats);
            this.slatPanelObjects.push(wallSlats);
        });
    }

    /**
     * @private
     */
    _getWindowFrameMaterial() {
        return new THREE.MeshStandardMaterial({
            color: 0xf6f7f6,
            metalness: 0.18,
            roughness: 0.52,
            envMapIntensity: 0.12
        });
    }

    /**
     * @private
     */
    _getWindowGlassMaterial() {
        return new THREE.MeshPhysicalMaterial({
            color: 0xdcecff,
            metalness: 0.04,
            roughness: 0.08,
            transmission: 0.9,
            transparent: true,
            opacity: 0.34,
            envMapIntensity: 0.85,
            clearcoat: 1,
            clearcoatRoughness: 0.08,
            side: THREE.DoubleSide
        });
    }

    /**
     * @private
     */
    _getWindowSillMaterial() {
        return new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.5,
            metalness: 0.1
        });
    }

    /**
     * @private
     */
    _getParapetCapMaterial() {
        return new THREE.MeshStandardMaterial({
            color: 0xf8f8f4,
            roughness: 0.42,
            metalness: 0.08,
            envMapIntensity: 0.18
        });
    }

    /**
     * @private
     */
    _updateLighting() {
        this.lightingObjects.forEach(obj => this.scene.remove(obj));
        this.lightingObjects = [];

        if (!this.builder) return;

        this.builder.lighting.items.forEach(light => {
            const lightObj = this._createLightObject(light);
            if (lightObj) {
                this.scene.add(lightObj);
                this.lightingObjects.push(lightObj);
            }
        });

        this._updateAmbientLighting();
        this._updateTimeOfDay();
    }

    /**
     * @private
     */
    _updateAmbientLighting() {
        const hasFixtureLights = Boolean(this.builder?.lighting?.items?.length);
        const fixtureBrightnessFactor = this._getFixtureBrightnessFactor();
        const autoOn = this.builder?.lighting?.autoOn !== false;
        const fixtureActive = hasFixtureLights && autoOn && fixtureBrightnessFactor > 0.001;

        if (this.ambientLight) {
            this.ambientLight.intensity = this.config.lighting.ambient;
        }
        if (this.directionalLight) {
            this.directionalLight.intensity = this.config.lighting.directional;
        }
        if (this.hemisphereLight) {
            this.hemisphereLight.intensity = this.config.lighting.hemisphere;
        }
        if (this.interiorLight) {
            this.interiorLight.intensity = fixtureActive
                ? this.config.lighting.interior * (0.04 + fixtureBrightnessFactor * 0.3)
                : this.config.lighting.interior;
        }
    }

    _getFixtureBrightnessFactor() {
        const rawBrightness = Number(this.builder?.lighting?.brightness);
        const clamped = THREE.MathUtils.clamp(Number.isFinite(rawBrightness) ? rawBrightness : 80, 0, 200);
        if (clamped <= 0) return 0;
        return Math.pow(clamped / 200, 0.62);
    }

    /**
     * @private
     */
    _createLightObject(lightData) {
        const group = new THREE.Group();
        const lightColor = this._getLightColor(lightData.temperature);
        const typeId = lightData.type?.id || '';
        const layout = lightData.layout || {};
        const position = lightData.position || { x: 0, y: 0, z: 0 };
        const brightness = THREE.MathUtils.clamp(Number(lightData.brightness) || 80, 0, 200);
        const intensityScale = brightness <= 0 ? 0 : Math.pow(brightness / 100, 1.18);
        const shadowBudget = 1;
        let emittedLights = 0;

        const scaleIntensity = (baseIntensity) => {
            if (!Number.isFinite(baseIntensity)) return 0;
            return baseIntensity * intensityScale;
        };

        const addDownSpot = (source, options = {}) => {
            const target = new THREE.Object3D();
            target.position.set(
                source.x + (options.targetXOffset || 0),
                source.y - (options.targetOffset || 1.6),
                source.z + (options.targetZOffset || 0)
            );
            group.add(target);

            const spot = new THREE.SpotLight(
                lightColor,
                scaleIntensity(options.baseIntensity ?? 1.9),
                options.distance || 4.5,
                options.angle || Math.PI / 5.5,
                options.penumbra || 0.65,
                2
            );
            spot.position.set(source.x, source.y, source.z);
            spot.target = target;
            spot.castShadow = emittedLights < shadowBudget && intensityScale > 0.25;

            if (spot.castShadow) {
                spot.shadow.mapSize.width = 512;
                spot.shadow.mapSize.height = 512;
            }

            group.add(spot);
            emittedLights += 1;
            return spot;
        };

        const addGlowPoint = (source, options = {}) => {
            const point = new THREE.PointLight(
                lightColor,
                scaleIntensity(options.baseIntensity ?? 0.8),
                options.distance || 3.2,
                2
            );
            point.position.set(source.x, source.y, source.z);
            point.castShadow = false;
            group.add(point);
            emittedLights += 1;
            return point;
        };

        const ceilingSlatsSelected = this._isCeilingSlatSelected();
        const lightBaseY = this._getCeilingLightBaseY(position.y);

        if (typeId === 'ceiling-track-lights') {
            const trackLength = layout.trackLength || 0.75;
            const headCount = layout.headCount || 3;
            const tracksCount = Math.max(1, layout.tracksCount || 1);
            const trackIndex = Math.max(0, layout.trackIndex || 0);
            const trackNormalized = tracksCount === 1
                ? 0
                : (trackIndex / (tracksCount - 1) - 0.5) * 2;
            const railMaterial = new THREE.MeshStandardMaterial({
                color: 0x2a2f35,
                roughness: 0.38,
                metalness: 0.78
            });
            const housingMaterial = new THREE.MeshStandardMaterial({
                color: 0xf2f4f6,
                emissive: lightColor,
                emissiveIntensity: 0.08,
                roughness: 0.24,
                metalness: 0.5
            });
            const accentMaterial = new THREE.MeshStandardMaterial({
                color: 0x9ea7b3,
                roughness: 0.34,
                metalness: 0.72
            });

            const rail = new THREE.Mesh(
                new THREE.BoxGeometry(trackLength, 0.028, 0.045),
                railMaterial
            );
            rail.position.set(position.x, lightBaseY, position.z);
            group.add(rail);

            const railCaps = [-1, 1].map((direction) => {
                const cap = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.022, 0.022, 0.016, 18),
                    accentMaterial
                );
                cap.rotation.z = Math.PI / 2;
                cap.position.set(position.x + direction * (trackLength / 2), lightBaseY, position.z);
                return cap;
            });
            railCaps.forEach((cap) => group.add(cap));

            const offsets = Array.from({ length: headCount }, (_, index) => {
                if (headCount === 1) return 0;
                const spread = Math.max(trackLength * 0.94, 0.62);
                return -spread / 2 + (spread * index) / (headCount - 1);
            });

            offsets.forEach((offset, index) => {
                const alongNormalized = headCount === 1
                    ? 0
                    : (index / (headCount - 1) - 0.5) * 2;
                const headGroup = new THREE.Group();
                const mount = new THREE.Mesh(
                    new THREE.BoxGeometry(0.055, 0.024, 0.028),
                    railMaterial
                );
                mount.position.set(0, -0.02, 0);
                headGroup.add(mount);

                const stem = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.011, 0.011, 0.05, 14),
                    accentMaterial
                );
                stem.position.set(0, -0.05, 0);
                headGroup.add(stem);

                const yTilt = alongNormalized * 0.22;
                const zTilt = (-trackNormalized * 0.18) + (index % 2 === 0 ? 0.08 : -0.08);

                const head = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.038, 0.045, 0.11, 22),
                    housingMaterial
                );
                head.rotation.z = Math.PI / 2;
                head.rotation.y = yTilt;
                head.rotation.x = zTilt;
                head.position.set(0, -0.095, 0);
                headGroup.add(head);

                const lens = new THREE.Mesh(
                    new THREE.CircleGeometry(0.028, 22),
                    new THREE.MeshBasicMaterial({
                        color: lightColor,
                        transparent: true,
                        opacity: 0.9
                    })
                );
                lens.rotation.y = Math.PI / 2;
                lens.rotation.x = zTilt;
                lens.position.set(0.053, -0.095, 0);
                headGroup.add(lens);

                const headPosition = {
                    x: position.x + offset,
                    y: lightBaseY,
                    z: position.z
                };
                headGroup.position.set(headPosition.x, headPosition.y, headPosition.z);
                group.add(headGroup);

                addDownSpot(
                    { x: headPosition.x, y: headPosition.y - 0.11, z: headPosition.z },
                    {
                        baseIntensity: 1.95,
                        distance: 4.6,
                        angle: Math.PI / 5.6,
                        penumbra: 0.84,
                        targetOffset: 1.8,
                        targetXOffset: alongNormalized * 0.18,
                        targetZOffset: (trackNormalized * 0.1) + (zTilt * 0.25)
                    }
                );
            });
        } else if (typeId === 'ceiling-contour-led') {
            const contourWidth = layout.width || 1.2;
            const contourDepth = layout.depth || 0.8;
            const ledThickness = 0.028;
            const ledMaterial = new THREE.MeshBasicMaterial({
                color: lightColor,
                transparent: true,
                opacity: 0.92,
                side: THREE.DoubleSide
            });
            const segments = [
                { size: [contourWidth, ledThickness, ledThickness], offset: [0, -0.012, -contourDepth / 2] },
                { size: [contourWidth, ledThickness, ledThickness], offset: [0, -0.012, contourDepth / 2] },
                { size: [ledThickness, ledThickness, contourDepth], offset: [-contourWidth / 2, -0.012, 0] },
                { size: [ledThickness, ledThickness, contourDepth], offset: [contourWidth / 2, -0.012, 0] }
            ];

            segments.forEach((segment) => {
                const strip = new THREE.Mesh(
                    new THREE.BoxGeometry(...segment.size),
                    ledMaterial
                );
                strip.position.set(
                    position.x + segment.offset[0],
                    lightBaseY + segment.offset[1],
                    position.z + segment.offset[2]
                );
                group.add(strip);
            });

            [
                { x: position.x, y: lightBaseY - 0.05, z: position.z - contourDepth / 2 },
                { x: position.x, y: lightBaseY - 0.05, z: position.z + contourDepth / 2 },
                { x: position.x - contourWidth / 2, y: lightBaseY - 0.05, z: position.z },
                { x: position.x + contourWidth / 2, y: lightBaseY - 0.05, z: position.z }
            ].forEach((source) => {
                addGlowPoint(source, {
                    baseIntensity: 0.75,
                    distance: 3.6
                });
            });
        } else {
            const fixtureRadius = Number(layout.fixtureRadius) || 0.105;
            const fixtureY = lightBaseY - 0.032;
            const spotTrim = new THREE.Mesh(
                new THREE.CylinderGeometry(fixtureRadius, fixtureRadius, 0.028, 28),
                new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    emissive: lightColor,
                    emissiveIntensity: intensityScale > 0 ? THREE.MathUtils.clamp(0.08 + intensityScale * 0.06, 0.08, 0.24) : 0,
                    roughness: 0.22,
                    metalness: 0.18
                })
            );
            spotTrim.position.set(position.x, fixtureY, position.z);
            group.add(spotTrim);

            const lens = new THREE.Mesh(
                new THREE.CircleGeometry(fixtureRadius * 0.78, 28),
                new THREE.MeshBasicMaterial({
                    color: lightColor,
                    transparent: true,
                    opacity: intensityScale > 0 ? 0.82 : 0.18,
                    side: THREE.DoubleSide
                })
            );
            lens.rotation.x = -Math.PI / 2;
            lens.position.set(position.x, fixtureY - 0.017, position.z);
            group.add(lens);

            addDownSpot(
                { x: position.x, y: fixtureY - 0.03, z: position.z },
                {
                    baseIntensity: ceilingSlatsSelected ? 2.45 : 2.05,
                    distance: ceilingSlatsSelected ? 4.9 : 4.2,
                    angle: ceilingSlatsSelected ? Math.PI / 4.8 : Math.PI / 5.2,
                    penumbra: 0.72
                }
            );
        }
        group.userData = { element: 'light', id: lightData.id };

        return group;
    }
        // ============================================
        // ============================================
        /**
        * @private
        */
    _getMaterialForElement(element) {
    let color = 0xffffff;
    let materialType = 'standard';
    let selectedMaterial = null;
    const normalizedElementRaw = element.startsWith('wall_')
        ? element.replace('wall_', 'walls_')
        : element;
    const normalizedElement = this._resolveMaterialLookupElement(normalizedElementRaw);
    const isCeiling = normalizedElementRaw === 'ceiling';
    const isFloor = normalizedElement === 'floor';
    
    if (this.builder) {
        const colorHex = this.builder.getColor(normalizedElement);
        if (colorHex) {
            color = colorHex;
        }
        selectedMaterial = this.builder.getMaterial(normalizedElement);
        if (selectedMaterial?.texture) {
            const textureName = selectedMaterial.texture;

            if (textureName.includes('stone')) {
                materialType = 'stone';
            } else if (textureName.includes('tile') || textureName.includes('porcelain')) {
                materialType = 'tile';
            } else if (textureName.includes('vinyl')) {
                materialType = 'vinyl';
            } else if (textureName.includes('stretch')) {
                materialType = 'stretch';
            } else if (textureName.includes('pvc')) {
                materialType = 'pvc';
            } else if (textureName.includes('mdf')) {
                materialType = 'mdf';
            } else if (textureName.includes('decor') || textureName.includes('3d')) {
                materialType = 'decor3d';
            } else if (textureName.includes('slats')) {
                materialType = 'slats';
            } else if (textureName.includes('parquet')) {
                materialType = 'parquet';
            } else if (textureName.includes('laminate') || textureName.includes('laminat')) {
                materialType = 'laminate';
            } else if (textureName.includes('lining')) {
                materialType = 'lining';
            } else if (textureName.includes('wood')) {
                materialType = 'wood';
            } else if (textureName.includes('metal')) {
                materialType = 'metal';
            }
        }
    }

    const shouldUseCatalogMaps = selectedMaterial?.id !== 'wall-euro-lining-painted';
    if (selectedMaterial && shouldUseCatalogMaps) {
        const catalogMaterial = this._buildCatalogMaterial(
            selectedMaterial,
            materialType,
            color,
            isCeiling,
            isFloor,
            normalizedElement
        );
        if (catalogMaterial) {
            return catalogMaterial;
        }
    }

    switch (materialType) {
        case 'wood':
            return this._buildSurfaceMaterial({ color, roughness: 0.66, metalness: 0.04, envMapIntensity: 0.35, ...this._getFallbackTextureMaps('wood', 'wood', normalizedElement, isCeiling, isFloor), side: isCeiling ? THREE.DoubleSide : THREE.FrontSide });
        case 'lining':
            return this._buildSurfaceMaterial({
                color,
                roughness: 0.62,
                metalness: 0.03,
                envMapIntensity: 0.25,
                ...this._getFallbackTextureMaps(isCeiling ? 'liningHorizontal' : 'liningVertical', 'lining', normalizedElement, isCeiling, isFloor),
                side: isCeiling ? THREE.DoubleSide : THREE.FrontSide
            });
        case 'laminate':
            return this._buildSurfaceMaterial({ color, roughness: 0.52, metalness: 0.05, envMapIntensity: 0.28, ...this._getFallbackTextureMaps('laminate', 'laminate', normalizedElement, isCeiling, isFloor), side: isCeiling ? THREE.DoubleSide : THREE.FrontSide });
        case 'tile':
            return this._buildSurfaceMaterial({ color, roughness: 0.34, metalness: 0.08, envMapIntensity: 0.18, ...this._getFallbackTextureMaps('tile', 'tile', normalizedElement, isCeiling, isFloor), side: isCeiling ? THREE.DoubleSide : THREE.FrontSide });
        case 'vinyl':
            return this._buildSurfaceMaterial({ color, roughness: 0.45, metalness: 0.03, envMapIntensity: 0.16, ...this._getFallbackTextureMaps('vinyl', 'vinyl', normalizedElement, isCeiling, isFloor), side: isCeiling ? THREE.DoubleSide : THREE.FrontSide });
        case 'pvc':
            return this._buildSurfaceMaterial({ color, roughness: 0.3, metalness: 0.04, envMapIntensity: 0.12, ...this._getFallbackTextureMaps('pvc', 'pvc', normalizedElement, isCeiling, isFloor), side: isCeiling ? THREE.DoubleSide : THREE.FrontSide });
        case 'mdf':
            return this._buildSurfaceMaterial({ color, roughness: 0.68, metalness: 0.03, envMapIntensity: 0.22, ...this._getFallbackTextureMaps('mdf', 'mdf', normalizedElement, isCeiling, isFloor), side: isCeiling ? THREE.DoubleSide : THREE.FrontSide });
        case 'decor3d':
            return this._buildSurfaceMaterial({ color, roughness: 0.74, metalness: 0.02, envMapIntensity: 0.12, ...this._getFallbackTextureMaps('decor3d', 'decor3d', normalizedElement, isCeiling, isFloor), side: isCeiling ? THREE.DoubleSide : THREE.FrontSide });
        case 'slats':
            return this._buildSurfaceMaterial({ color, roughness: 0.62, metalness: 0.03, envMapIntensity: 0.24, ...this._getFallbackTextureMaps('slats', 'slats', normalizedElement, isCeiling, isFloor), side: isCeiling ? THREE.DoubleSide : THREE.FrontSide });
        case 'parquet':
            return this._buildSurfaceMaterial({ color, roughness: 0.57, metalness: 0.04, envMapIntensity: 0.3, ...this._getFallbackTextureMaps('parquet', 'parquet', normalizedElement, isCeiling, isFloor), side: isCeiling ? THREE.DoubleSide : THREE.FrontSide });
        case 'stretch':
            return this._buildSurfaceMaterial({ color, roughness: 0.14, metalness: 0.02, envMapIntensity: 0.08, ...this._getFallbackTextureMaps('stretch', 'stretch', normalizedElement, isCeiling, isFloor), side: isCeiling ? THREE.DoubleSide : THREE.FrontSide });
        case 'stone':
            return this._buildSurfaceMaterial({ color, roughness: 0.9, metalness: 0.02, ...this._getFallbackTextureMaps('stone', 'stone', normalizedElement, isCeiling, isFloor), side: isCeiling ? THREE.DoubleSide : THREE.FrontSide });
        case 'metal':
            return new THREE.MeshStandardMaterial({ color, roughness: 0.22, metalness: 0.82, envMapIntensity: 0.8, side: isCeiling ? THREE.DoubleSide : THREE.FrontSide });
        default:
            return this._buildSurfaceMaterial({ color, roughness: 0.5, metalness: 0.04, envMapIntensity: 0.25, ...this._getFallbackTextureMaps('wall', 'standard', normalizedElement, isCeiling, isFloor), side: isCeiling ? THREE.DoubleSide : THREE.FrontSide });
    }
    }
    /**
     * @private
     */
    _getLightColor(temperature) {
        switch (temperature) {
            case 'warm': return 0xffcc80;
            case 'cool': return 0x80deea;
            case 'neutral': return 0xffffff;
            default: return 0xffffff;
        }
    }

    /**
     * @private
     */
    _updateFurniture() {
        this.furnitureObjects.forEach(obj => this.scene.remove(obj));
        this.furnitureObjects = [];

        if (!this.builder) return;

        this.builder.furniture.items.forEach(furniture => {
            const placement = this._normalizeFurniturePlacement(furniture);
            furniture.position = {
                x: placement.x,
                y: placement.y,
                z: placement.z
            };
            furniture.rotation = placement.rotation;
            furniture.placementMeta = {
                ...(furniture.placementMeta || {}),
                ...(placement.meta || {})
            };

            const furnitureObj = this._createFurnitureObject(furniture);
            if (furnitureObj) {
                this.scene.add(furnitureObj);
                this.furnitureObjects.push(furnitureObj);
            }
        });
    }

    /**
     * @private
     */
    _createFurnitureObject(furnitureData, options = {}) {
        const { dimensions, position, rotation } = furnitureData;
        const isPreview = options.preview === true;
        const typeId = furnitureData.type?.id || '';
        const isCabinet = typeId.startsWith('cabinet');

        if (isCabinet) {
            return this._createCabinetObject(furnitureData, options);
        }

        const geometry = new THREE.BoxGeometry(
            dimensions.width / 100,
            dimensions.height / 100,
            dimensions.depth / 100
        );

        const material = new THREE.MeshStandardMaterial({
            color: furnitureData.color || furnitureData.type.color || 0x8B7355,
            roughness: 0.6,
            metalness: 0.1,
            transparent: isPreview,
            opacity: isPreview ? 0.42 : 1
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
            position.x,
            position.y + dimensions.height / 200,
            position.z
        );
        mesh.rotation.y = rotation * Math.PI / 180;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { element: 'furniture', id: furnitureData.id, isPreview };

        return mesh;
    }

    _createCabinetObject(furnitureData, options = {}) {
        const { dimensions, position, rotation } = furnitureData;
        const isPreview = options.preview === true;
        const id = furnitureData.id;
        const w = Math.max((dimensions.width || 80) / 100, 0.32);
        const h = Math.max((dimensions.height || 100) / 100, 0.5);
        const d = Math.max((dimensions.depth || 40) / 100, 0.26);
        const panel = THREE.MathUtils.clamp(Math.min(w * 0.075, d * 0.11), 0.018, 0.038);
        const color = furnitureData.color || furnitureData.type?.color || '#8B7355';
        const isOpen = Boolean(this.cabinetDoorStates[id]);
        const doorCount = /2door|corner|hanging/.test(furnitureData.type?.id || '') || w >= 0.72 ? 2 : 1;
        const baseColor = new THREE.Color(color);

        const group = new THREE.Group();
        group.position.set(position.x, position.y, position.z);
        group.rotation.y = rotation * Math.PI / 180;
        group.userData = {
            element: 'furniture',
            id,
            isPreview,
            furnitureKind: 'cabinet'
        };

        const opacity = isPreview ? 0.42 : 1;
        const materialOptions = {
            roughness: 0.58,
            metalness: 0.08,
            transparent: isPreview,
            opacity
        };
        const bodyMaterial = new THREE.MeshStandardMaterial({
            ...materialOptions,
            color: baseColor.clone().multiplyScalar(0.78)
        });
        const doorMaterial = new THREE.MeshStandardMaterial({
            ...materialOptions,
            color: baseColor.clone().multiplyScalar(0.98),
            roughness: 0.46,
            envMapIntensity: 0.18
        });
        const trimMaterial = new THREE.MeshStandardMaterial({
            ...materialOptions,
            color: baseColor.clone().multiplyScalar(0.66),
            roughness: 0.55,
            metalness: 0.06
        });
        const shadowMaterial = new THREE.MeshStandardMaterial({
            ...materialOptions,
            color: 0x2f2a25,
            roughness: 0.82,
            metalness: 0.02
        });
        const handleMaterial = new THREE.MeshStandardMaterial({
            ...materialOptions,
            color: 0xd8c18a,
            roughness: 0.3,
            metalness: 0.45
        });

        const furnitureUserData = {
            element: 'furniture',
            id,
            isPreview,
            furnitureKind: 'cabinet'
        };
        const addBox = (name, size, pos, mat) => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
            mesh.position.set(...pos);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.name = name;
            mesh.userData = furnitureUserData;
            group.add(mesh);
            return mesh;
        };

        addBox('cabinet_back', [w, h, panel], [0, h / 2, -d / 2 + panel / 2], bodyMaterial);
        addBox('cabinet_left_side', [panel, h, d], [-w / 2 + panel / 2, h / 2, 0], bodyMaterial);
        addBox('cabinet_right_side', [panel, h, d], [w / 2 - panel / 2, h / 2, 0], bodyMaterial);
        addBox('cabinet_top', [w, panel, d], [0, h - panel / 2, 0], bodyMaterial);
        addBox('cabinet_bottom', [w, panel, d], [0, panel / 2, 0], bodyMaterial);
        addBox('cabinet_top_front_rail', [w, panel * 1.25, panel * 1.8], [0, h - panel * 1.45, d / 2 - panel * 0.25], trimMaterial);
        addBox('cabinet_bottom_plinth', [w * 0.92, panel * 1.45, panel * 2.2], [0, panel * 0.55, d / 2 - panel * 0.1], trimMaterial);

        const shelfCount = h > 1.4 ? 3 : (h > 0.8 ? 2 : 1);
        for (let i = 1; i <= shelfCount; i++) {
            const y = (h * i) / (shelfCount + 1);
            addBox('cabinet_shelf', [w - panel * 2, panel * 0.72, d - panel * 2], [0, y, -panel * 0.2], bodyMaterial);
        }

        const reveal = addBox('cabinet_shadow_reveal', [w - panel * 2, h - panel * 2, 0.012], [0, h / 2, d / 2 + panel * 0.35], shadowMaterial);
        reveal.castShadow = false;

        const createDoor = (side) => {
            const single = doorCount === 1;
            const doorGap = 0.01;
            const doorThickness = Math.max(panel * 0.9, 0.022);
            const doorW = single ? w - panel * 2.4 : (w - panel * 3.1 - doorGap) / 2;
            const doorH = h - panel * 2.45;
            const hingeX = single
                ? -w / 2 + panel * 1.25
                : (side === 'left' ? -w / 2 + panel * 1.25 : w / 2 - panel * 1.25);
            const doorCenterX = single || side === 'left' ? doorW / 2 : -doorW / 2;
            const frontZ = d / 2 + panel * 0.85;

            const pivot = new THREE.Group();
            pivot.name = `cabinet_${side}_door_pivot`;
            pivot.position.set(hingeX, h / 2, frontZ);
            pivot.userData = furnitureUserData;

            const addDoorBox = (name, size, pos, mat) => {
                const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
                mesh.position.set(...pos);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.name = name;
                mesh.userData = furnitureUserData;
                pivot.add(mesh);
                return mesh;
            };

            const door = addDoorBox(
                `cabinet_${side}_door`,
                [doorW, doorH, doorThickness],
                [doorCenterX, 0, 0],
                doorMaterial
            );
            door.castShadow = true;

            const detailZ = doorThickness * 0.78;
            const railH = Math.max(panel * 0.72, 0.018);
            const stileW = Math.max(panel * 0.55, 0.014);
            addDoorBox(`cabinet_${side}_door_top_rail`, [doorW * 0.9, railH, doorThickness * 0.45], [doorCenterX, doorH / 2 - railH, detailZ], trimMaterial);
            addDoorBox(`cabinet_${side}_door_bottom_rail`, [doorW * 0.9, railH, doorThickness * 0.45], [doorCenterX, -doorH / 2 + railH, detailZ], trimMaterial);
            addDoorBox(`cabinet_${side}_door_outer_stile`, [stileW, doorH * 0.9, doorThickness * 0.45], [doorCenterX + (single || side === 'left' ? doorW * 0.38 : -doorW * 0.38), 0, detailZ], trimMaterial);
            addDoorBox(`cabinet_${side}_door_inner_stile`, [stileW, doorH * 0.9, doorThickness * 0.45], [doorCenterX + (single || side === 'left' ? doorW * 0.08 : -doorW * 0.08), 0, detailZ], trimMaterial);

            const handleX = single || side === 'left'
                ? doorW - Math.max(panel * 2.4, 0.065)
                : -doorW + Math.max(panel * 2.4, 0.065);
            const handle = new THREE.Mesh(
                new THREE.BoxGeometry(0.026, Math.min(0.32, doorH * 0.32), 0.03),
                handleMaterial
            );
            handle.position.set(handleX, 0, detailZ + 0.018);
            handle.castShadow = true;
            handle.name = `cabinet_${side}_handle`;
            handle.userData = furnitureUserData;
            pivot.add(handle);

            if (single) {
                pivot.rotation.y = isOpen ? -Math.PI * 0.54 : 0;
            } else {
                pivot.rotation.y = isOpen ? (side === 'left' ? -Math.PI * 0.52 : Math.PI * 0.52) : 0;
            }

            group.add(pivot);
            return pivot;
        };

        createDoor('left');
        if (doorCount > 1) {
            createDoor('right');
        }

        return group;
    }

    _toggleCabinetDoors(furnitureId) {
        if (!furnitureId) return;
        this.cabinetDoorStates[furnitureId] = !this.cabinetDoorStates[furnitureId];
        this._updateFurniture();
        this.requestRender(500);
    }

    /**
     * @private
     */
    _updateWindows() {
        if (this.builder) {
            this._createWindows(this.builder.dimensions);
        }
    }

    /**
     * @private
     */
    _updateMarkers() {
        if (this.builder) {
            this._createMarkers(this.builder.dimensions);
        }
    }

    /**
     * @private
     */
    _updateExterior() {
        if (!this.config.exterior.enabled) return;

        this._updateTimeOfDay();

        this._updateSunPosition();

        this._notifyExteriorUpdate();
    }

    /**
     * @private
     */
    _updateTimeOfDay() {
        const timeSettings = {
            morning: { skyColor: 0xffeedd, lightIntensity: 0.7, ambientIntensity: 0.72, hemisphereIntensity: 0.54, interiorIntensity: 0.58, sunPosition: { x: 5, y: 5, z: 10 } },
            day: { skyColor: 0x87ceeb, lightIntensity: 1.0, ambientIntensity: 0.78, hemisphereIntensity: 0.65, interiorIntensity: 0.62, sunPosition: { x: 10, y: 15, z: 10 } },
            evening: { skyColor: 0xffddaa, lightIntensity: 0.5, ambientIntensity: 0.5, hemisphereIntensity: 0.42, interiorIntensity: 0.68, sunPosition: { x: -5, y: 3, z: 10 } },
            night: { skyColor: 0x071225, lightIntensity: 0.04, ambientIntensity: 0.07, hemisphereIntensity: 0.05, interiorIntensity: 0.28, sunPosition: { x: 0, y: -5, z: 0 } }
        };

        const time = this.config.exterior.timeOfDay || 'day';
        const setting = timeSettings[time];
        const hasFixtureLights = Boolean(this.builder?.lighting?.items?.length);
        const autoOn = this.builder?.lighting?.autoOn !== false;
        const fixtureBrightnessFactor = this._getFixtureBrightnessFactor();
        const fixtureActive = hasFixtureLights && autoOn && fixtureBrightnessFactor > 0.001;

        if (this.scene) {
            this.scene.background = new THREE.Color(setting.skyColor);
            this.scene.fog.color.setHex(setting.skyColor);
        }
        if (this.skyMesh?.material) {
            this.skyMesh.material.color.setHex(0xffffff);
            if (this.skyMesh.material.map) {
                this.skyMesh.material.map.dispose();
            }
            this.skyMesh.material.map = this._createSkyTexture(setting.skyColor);
            this.skyMesh.material.needsUpdate = true;
        }
        if (this.sunMesh) {
            this.sunMesh.visible = time !== 'night';
        }
        if (this.horizonBand?.material?.color) {
            const hazeColor = new THREE.Color(setting.skyColor).lerp(new THREE.Color(0xe8ddd0), time === 'evening' ? 0.38 : 0.22);
            this.horizonBand.material.color.copy(hazeColor);
            this.horizonBand.material.opacity = time === 'night' ? 0.18 : 0.78;
        }
        if (this.horizonLine?.material?.color) {
            const lineColor = new THREE.Color(setting.skyColor).lerp(new THREE.Color(0x80a8b4), time === 'evening' ? 0.52 : 0.38);
            this.horizonLine.material.color.copy(lineColor);
            this.horizonLine.material.opacity = time === 'night' ? 0.22 : 0.88;
        }

        if (this.directionalLight) {
            this.directionalLight.intensity = setting.lightIntensity;
        }
        if (this.ambientLight) {
            this.ambientLight.intensity = setting.ambientIntensity;
        }
        if (this.hemisphereLight) {
            this.hemisphereLight.intensity = setting.hemisphereIntensity;
        }
        if (this.interiorLight) {
            this.interiorLight.intensity = fixtureActive
                ? setting.interiorIntensity * (0.03 + fixtureBrightnessFactor * 0.22)
                : setting.interiorIntensity;
        }
        if (this.renderer) {
            const targetExposure = time === 'night' ? 0.58 : (time === 'evening' ? 0.82 : 1.0);
            this.renderer.toneMappingExposure = targetExposure;
        }
    }

    /**
     * @private
     */
    _updateSunPosition() {
        const timeSettings = {
            morning: { x: 5, y: 5, z: 10 },
            day: { x: 10, y: 15, z: 10 },
            evening: { x: -5, y: 3, z: 10 },
            night: { x: 0, y: -5, z: 0 }
        };

        const time = this.config.exterior.timeOfDay || 'day';
        const pos = timeSettings[time];

        if (this.directionalLight) {
            this.directionalLight.position.set(pos.x, pos.y, pos.z);
        }
    }

    /**
     * @param {string} time - morning, day, evening, night
     */
    setTimeOfDay(time) {
        this.config.exterior.timeOfDay = time;
        this._updateExterior();
        this.requestRender(400);
        console.log('?? Time of day set to:', time);
    }

    // ============================================
    // ============================================

    /**
     * @private
     */
    _setupEventListeners() {
        this.renderer.domElement.addEventListener('click', (e) => this._onClick(e));

        this.renderer.domElement.addEventListener('mousemove', (e) => this._onMouseMove(e));

        window.addEventListener('resize', () => this._onResize());

        this.renderer.domElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        this.renderer.domElement.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
        this.renderer.domElement.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
        this.renderer.domElement.addEventListener('touchend', (e) => this._onTouchEnd(e), { passive: false });

        window.addEventListener('keydown', (e) => this._onKeyDown(e));

        this.renderer.domElement.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });

        console.log('? Event listeners configured');
    }

    /**
     * @private
     */
    _onClick(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();

        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersectObjects = [];
        if (this.balconyGroup) {
            this.balconyGroup.traverse((child) => {
                if (child.isMesh) {
                    intersectObjects.push(child);
                }
            });
        }

        this.markers.forEach(marker => intersectObjects.push(marker));

        this.furnitureObjects.forEach(obj => intersectObjects.push(obj));

        this.lightingObjects.forEach(obj => intersectObjects.push(obj));

        const intersects = this.raycaster.intersectObjects(intersectObjects, true);

        if (intersects.length > 0) {
            const intersect = intersects[0];
            const userData = intersect.object.userData;

            if (userData.isMarker) {
                console.log('?? Marker clicked:', userData.element);
                if (userData.markerType === 'navigation' && userData.navigationPoint) {
                    this._moveCameraToNavigationPoint(userData.navigationPoint);
                }
                this._notifyObjectClick(userData, intersect.point);
                return;
            }

            if (this.state.placementMode === 'lighting') {
                if (['ceiling', 'ceiling_base', 'ceiling_finishing'].includes(intersect.object.name)) {
                    this._placeLighting(intersect.point);
                }
            }
            else if (this.state.placementMode === 'furniture') {
                if (['floor', 'floor_base', 'floor_finishing'].includes(intersect.object.name)) {
                    this._placeFurniture(intersect.point);
                }
            }
            else {
                const furnitureUserData = this._getFurnitureUserData(intersect.object) || userData;
                this._notifyObjectClick(furnitureUserData, intersect.point);
                if (furnitureUserData?.element === 'furniture' || furnitureUserData?.type === 'furniture') {
                    if (furnitureUserData.furnitureKind === 'cabinet') {
                        this._toggleCabinetDoors(furnitureUserData.id);
                    }
                    this._highlightObject(intersect.object);
                }
            }
        }
    }

    _getFurnitureUserData(object) {
        let current = object;
        while (current) {
            if (current.userData?.element === 'furniture') {
                return current.userData;
            }
            current = current.parent;
        }
        return null;
    }

    /**
     * @private
     */
    _highlightObject(object) {
        if (!object || !object.isMesh) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        const applicable = materials.filter((material) => material && Object.prototype.hasOwnProperty.call(material, 'emissive'));
        if (!applicable.length) return;

        if (!object.userData.originalEmissive) {
            object.userData.originalEmissive = new WeakMap();
        }

        applicable.forEach((material) => {
            if (!object.userData.originalEmissive.has(material)) {
                object.userData.originalEmissive.set(material, {
                    emissive: material.emissive.clone(),
                    emissiveIntensity: material.emissiveIntensity || 0
                });
            }

            material.emissive.setHex(0x2f7dff);
            material.emissiveIntensity = 0.45;
        });

        window.setTimeout(() => {
            applicable.forEach((material) => {
                const original = object.userData.originalEmissive?.get(material);
                if (!original) return;
                material.emissive.copy(original.emissive);
                material.emissiveIntensity = original.emissiveIntensity;
            });
        }, 350);
    }

    /**
     * @private
     */
    _onMouseMove(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = this.raycaster.intersectObjects(this.balconyGroup?.children || [], true);

        if (this.state.placementMode === 'furniture') {
            const floorHit = intersects.find((intersect) =>
                ['floor', 'floor_base', 'floor_finishing'].includes(intersect.object.name)
            );

            if (floorHit) {
                this._updateFurniturePreview(floorHit.point);
                this.renderer.domElement.style.cursor = 'crosshair';
            } else {
                this._removePlacementPreview();
                this.renderer.domElement.style.cursor = 'not-allowed';
            }
            return;
        }

        if (intersects.length > 0) {
            this.renderer.domElement.style.cursor = 'pointer';
        } else {
            this.renderer.domElement.style.cursor = 'default';
        }
    }

    /**
     * @private
     */
    _onResize() {
        if (!this.container) return;

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
        this.requestRender(400);

        console.log('?? Window resized:', width, 'x', height);
    }

    /**
     * @private
     */
    _onTouchStart(event) {
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            this._onClick({
                clientX: touch.clientX,
                clientY: touch.clientY
            });
        }
    }

    /**
     * @private
     */
    _onTouchMove(event) {
        if (this.controls) {
            event.preventDefault();
        }
    }

    /**
     * @private
     */
    _onTouchEnd(event) {
    }

    /**
     * @private
     */
    _onKeyDown(event) {
        switch (event.key.toLowerCase()) {
            case 'g':
                this.toggleGrid(!this.state.showGrid);
                break;
            case 'h':
                this.toggleWireframe(!this.state.showWireframe);
                break;
            case 'r':
                this.resetCamera();
                break;
            case 'f':
                this.toggleFullscreen();
                break;
            case 's':
                this.exportScreenshot();
                break;
        }
    }

    /**
     * @private
     */
    _onWheel(event) {
        if (this.controls) {
            event.preventDefault();
        }
    }

    // ============================================
    // ============================================

    /**
     * @private
     */
    _placeLighting(point) {
        if (this.builder && this.builder.lighting.selectedType) {
            this.builder.addLight({
                x: point.x,
                y: point.y,
                z: point.z
            }, this.builder.lighting.selectedType.id);

            this._updateLighting();
            this._notifyPlacement('lighting', point);
            this.exitPlacementMode();

            console.log('?? Light placed at:', point);
        }
    }

    /**
     * @private
     */
    _placeFurniture(point) {
        if (this.builder && this.builder.furniture.selectedType) {
            const placement = this._getFurniturePlacementPoint(point, this.builder.furniture.selectedType);
            if (this.state.editingFurnitureId) {
                this.builder.updateFurniturePlacement(
                    this.state.editingFurnitureId,
                    {
                        x: placement.x,
                        y: placement.y,
                        z: placement.z
                    },
                    placement.rotation,
                    placement.meta || null
                );
            } else {
                this.builder.addFurniture({
                    x: placement.x,
                    y: placement.y,
                    z: placement.z
                }, this.builder.furniture.selectedType.id, placement.rotation, placement.meta || null);
            }

            this._updateFurniture();
            this._notifyPlacement('furniture', placement);
            this.state.editingFurnitureId = null;
            this.exitPlacementMode();

            console.log('?? Furniture placed at:', point);
        }
    }

    /**
     */
    enterPlacementMode(mode) {
        this.state.placementMode = mode;
        this.renderer.domElement.style.cursor = 'crosshair';

        if (this.controls) {
            this.controls.enableRotate = false;
        }

        if (mode !== 'furniture') {
            this._removePlacementPreview();
        }

        console.log('?? Placement mode entered:', mode);
    }

    /**
     */
    exitPlacementMode() {
        this.state.placementMode = null;
        this.state.editingFurnitureId = null;
        this.renderer.domElement.style.cursor = 'default';
        this._removePlacementPreview();

        if (this.controls) {
            this.controls.enableRotate = true;
        }

        console.log('? Placement mode exited');
    }

    // ============================================
    // ============================================

    /**
     */
    _updateFurniturePreview(point) {
        if (!this.builder?.furniture?.selectedType) {
            this._removePlacementPreview();
            return;
        }

        const selectedType = this.builder.furniture.selectedType;
        const placement = this._getFurniturePlacementPoint(point, selectedType);

        if (!this.placementPreview) {
            this.placementPreview = this._createFurnitureObject({
                id: 'placement-preview',
                type: selectedType,
                dimensions: selectedType.dimensions || { width: 80, height: 100, depth: 40 },
                position: placement,
                rotation: placement.rotation
            }, { preview: true });
            this.scene.add(this.placementPreview);
        }

        this.placementPreview.position.set(
            placement.x,
            this.placementPreview.isGroup
                ? placement.y
                : placement.y + (selectedType.dimensions?.height || 100) / 200,
            placement.z
        );
        this.placementPreview.rotation.y = placement.rotation * Math.PI / 180;
        this.placementPreview.visible = true;
    }

    _removePlacementPreview() {
        if (!this.placementPreview) {
            return;
        }

        this.scene.remove(this.placementPreview);
        this._disposeObject(this.placementPreview);
        this.placementPreview = null;
    }

    _getFurniturePlacementConfig(furnitureType) {
        const dims = furnitureType?.dimensions || { width: 80, height: 100, depth: 40 };
        const furnitureId = furnitureType?.id || '';
        const roomHeight = this.builder?.dimensions?.height || 2.7;
        const itemHeight = dims.height / 100;
        const verticalGap = 0.12;
        const maxBaseY = Math.max(0, roomHeight - itemHeight - verticalGap);
        const preferredWallBaseY = Math.max(0.95, Math.min(roomHeight * 0.55, maxBaseY));

        return {
            width: dims.width / 100,
            height: itemHeight,
            depth: dims.depth / 100,
            mountType: furnitureId.includes('hanging') ? 'wall' : 'floor',
            baseY: furnitureId.includes('hanging') ? preferredWallBaseY : 0,
            wallGap: 0.01,
            sideGap: 0.03
        };
    }

    _getFurniturePlacementBounds() {
        const dimensions = this.builder?.dimensions || {
            length: 3,
            width: 1.4,
            height: 2.7,
            shape: 'loggia-3'
        };
        const profile = this._getBalconyProfile(dimensions);
        const bounds = this._getProfileBounds(profile);

        return {
            ...bounds,
            height: dimensions.height
        };
    }

    _clampFurnitureAxis(value, min, max) {
        if (min > max) {
            return (min + max) / 2;
        }

        return THREE.MathUtils.clamp(value, min, max);
    }

    _getFurnitureWallSegments() {
        const dimensions = this.builder?.dimensions || {
            length: 3,
            width: 1.4,
            height: 2.7,
            shape: 'loggia-3'
        };
        const profile = this._getBalconyProfile(dimensions);
        const glazingType = this.builder?.glazing?.type || 'classic';
        const center = this._getProfileCenter(profile);
        const segments = [];

        profile.points.forEach((start, index) => {
            const end = profile.points[(index + 1) % profile.points.length];
            const isGlazed = profile.glazingEdges.includes(index) && glazingType !== 'none';
            if (isGlazed) {
                return;
            }

            const dx = end.x - start.x;
            const dz = end.z - start.z;
            const length = Math.hypot(dx, dz);
            if (length <= 0.001) {
                return;
            }

            const unitX = dx / length;
            const unitZ = dz / length;
            let normal = this._getSegmentNormal(start, end);
            const midpoint = {
                x: (start.x + end.x) / 2,
                z: (start.z + end.z) / 2
            };
            const toCenter = {
                x: center.x - midpoint.x,
                z: center.z - midpoint.z
            };

            if ((normal.x * toCenter.x) + (normal.z * toCenter.z) < 0) {
                normal = { x: -normal.x, z: -normal.z };
            }

            segments.push({
                id: `${this._getWallElementName(start, end, index)}_${index}`,
                index,
                wall: this._getWallElementName(start, end, index),
                start,
                end,
                midpoint,
                length,
                unitX,
                unitZ,
                normal,
                angle: Math.atan2(dz, dx)
            });
        });

        return segments;
    }

    _getNearestFurnitureSegment(point, furnitureType, preferredWall = null) {
        const config = this._getFurniturePlacementConfig(furnitureType);
        const segments = this._getFurnitureWallSegments();
        const matchingSegments = preferredWall
            ? segments.filter((segment) => segment.wall === preferredWall)
            : segments;
        const fittingSegments = matchingSegments.filter((segment) => {
            return segment.length >= config.width + config.sideGap * 2;
        });
        const candidates = fittingSegments.length ? fittingSegments : matchingSegments;

        if (!candidates.length) {
            return null;
        }

        return candidates
            .map((segment) => {
                const projection = ((point.x - segment.start.x) * segment.unitX)
                    + ((point.z - segment.start.z) * segment.unitZ);
                const clampedProjection = THREE.MathUtils.clamp(projection, 0, segment.length);
                const closestPoint = {
                    x: segment.start.x + segment.unitX * clampedProjection,
                    z: segment.start.z + segment.unitZ * clampedProjection
                };
                const distance = Math.hypot(point.x - closestPoint.x, point.z - closestPoint.z);

                return {
                    segment,
                    projection: clampedProjection,
                    distance
                };
            })
            .sort((a, b) => a.distance - b.distance)[0];
    }

    _getFurnitureSegmentByAnchor(anchor, furnitureType) {
        const preferredSegmentId = anchor?.segmentId || null;
        const preferredWall = anchor?.wall || null;
        const segments = this._getFurnitureWallSegments();

        if (preferredSegmentId) {
            const matchedSegment = segments.find((segment) => segment.id === preferredSegmentId);
            if (matchedSegment) {
                return matchedSegment;
            }
        }

        if (preferredWall) {
            const config = this._getFurniturePlacementConfig(furnitureType);
            const wallSegments = segments
                .filter((segment) => segment.wall === preferredWall)
                .sort((a, b) => b.length - a.length);
            const fittingWallSegment = wallSegments.find((segment) => {
                return segment.length >= config.width + config.sideGap * 2;
            });
            if (fittingWallSegment) {
                return fittingWallSegment;
            }
            if (wallSegments.length) {
                return wallSegments[0];
            }
        }

        return segments.sort((a, b) => b.length - a.length)[0] || null;
    }

    _resolveFurnitureAnchor(point, furnitureType) {
        const config = this._getFurniturePlacementConfig(furnitureType);
        const nearest = this._getNearestFurnitureSegment(point, furnitureType);
        const segment = nearest?.segment || this._getFurnitureSegmentByAnchor(null, furnitureType);
        if (!segment) {
            return {
                wall: 'back',
                anchorRatio: 0.5,
                mountType: config.mountType,
                segmentId: null
            };
        }

        const spanMin = config.width / 2 + config.sideGap;
        const spanMax = segment.length - config.width / 2 - config.sideGap;
        const axisValue = spanMax - spanMin <= 0
            ? segment.length / 2
            : this._clampFurnitureAxis(nearest?.projection ?? segment.length / 2, spanMin, spanMax);

        const anchorRatio = spanMax - spanMin <= 0
            ? 0.5
            : THREE.MathUtils.clamp((axisValue - spanMin) / (spanMax - spanMin), 0, 1);

        return {
            wall: segment.wall,
            segmentId: segment.id,
            anchorRatio,
            mountType: config.mountType
        };
    }

    _placementFromAnchor(anchor, furnitureType) {
        const config = this._getFurniturePlacementConfig(furnitureType);
        const segment = this._getFurnitureSegmentByAnchor(anchor, furnitureType);
        if (!segment) {
            const bounds = this._getFurniturePlacementBounds();
            return {
                x: bounds.centerX,
                y: config.baseY,
                z: bounds.centerZ,
                rotation: 0,
                wall: anchor?.wall || 'back',
                meta: {
                    wall: anchor?.wall || 'back',
                    anchorRatio: 0.5,
                    mountType: config.mountType,
                    segmentId: null
                }
            };
        }

        const wall = segment.wall;
        const anchorRatio = THREE.MathUtils.clamp(anchor?.anchorRatio ?? 0.5, 0, 1);
        const spanMin = config.width / 2 + config.sideGap;
        const spanMax = segment.length - config.width / 2 - config.sideGap;
        const along = spanMax - spanMin <= 0
            ? segment.length / 2
            : THREE.MathUtils.lerp(spanMin, spanMax, anchorRatio);
        const offset = config.depth / 2 + config.wallGap;
        const x = segment.start.x + segment.unitX * along + segment.normal.x * offset;
        const z = segment.start.z + segment.unitZ * along + segment.normal.z * offset;
        const rotation = THREE.MathUtils.radToDeg(-segment.angle);

        return {
            x,
            y: config.baseY,
            z,
            rotation,
            wall,
            meta: {
                wall,
                segmentId: segment.id,
                anchorRatio,
                mountType: config.mountType
            }
        };
    }

    _normalizeFurniturePlacement(furnitureData) {
        const fallbackPoint = furnitureData?.position || { x: 0, y: 0, z: 0 };
        const anchor = furnitureData?.placementMeta?.wall
            ? furnitureData.placementMeta
            : this._resolveFurnitureAnchor(fallbackPoint, furnitureData?.type);

        return this._placementFromAnchor(anchor, furnitureData?.type);
    }

    _getFurniturePlacementPoint(point, furnitureType) {
        const anchor = this._resolveFurnitureAnchor(point, furnitureType);
        return this._placementFromAnchor(anchor, furnitureType);
    }

    setView(view) {
        const poses = this._getViewPoses();

        if (poses[view]) {
            const pos = poses[view];
            this.state.viewMode = 'interior';
            this._applyControlLimits(this.builder?.dimensions);
            const anchor = this._getInteriorCameraAnchor(this.builder?.dimensions);
            this._animateCamera({ x: anchor.x, y: anchor.y, z: anchor.z }, pos.lookAt);
            console.log('?? View changed to:', view);
            this._notifyViewChange(view);
        }
    }

    /**
     * @private
     */
    _animateCamera(position, target) {
        const startPos = { ...this.camera.position };
        const startTarget = this.controls?.target?.clone() || new THREE.Vector3(0, 1.5, 0);

        const duration = 500;
        const startTime = Date.now();
        this.requestRender(duration + 150);

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = this._easeInOutCubic(progress);

            this.camera.position.lerpVectors(
                new THREE.Vector3(startPos.x, startPos.y, startPos.z),
                new THREE.Vector3(position.x, position.y, position.z),
                eased
            );

            if (this.controls) {
                this.controls.target.lerpVectors(
                    startTarget,
                    new THREE.Vector3(target.x, target.y, target.z),
                    eased
                );
                if (this.state.viewMode === 'interior') {
                    this._constrainInteriorCamera();
                }
                this.controls.update();
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }

    /**
     * @private
     */
    _easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    /**
     */
    zoom(direction) {
        if (this.state.viewMode === 'interior') {
            const delta = direction === 'in' ? -4 : 4;
            this.camera.fov = THREE.MathUtils.clamp(this.camera.fov + delta, 52, 74);
            this.camera.updateProjectionMatrix();
            this._constrainInteriorCamera();
            this.requestRender(350);
            console.log('?? Interior FOV zoom:', direction);
            return;
        }

        const factor = direction === 'in' ? 0.9 : 1.1;
        const offset = this.camera.position.clone().sub(this.controls.target);
        offset.multiplyScalar(factor);
        this.camera.position.copy(this.controls.target).add(offset);
        if (this.state.viewMode === 'interior') {
            this._constrainInteriorCamera();
            this.controls.update();
        } else {
            this.camera.lookAt(this.controls.target);
        }

        this.requestRender(350);
        console.log('?? Zoom:', direction);
    }

    /**
     * @param {string} direction - left, right, up, down
     */
    rotate(direction) {
        if (!this.controls) return;

        const angle = 0.3;
        const hasNativeRotateApi =
            typeof this.controls.rotateLeft === 'function' &&
            typeof this.controls.rotateRight === 'function' &&
            typeof this.controls.rotateUp === 'function';

        if (hasNativeRotateApi) {
            if (direction === 'left') this.controls.rotateLeft(angle);
            else if (direction === 'right') this.controls.rotateRight(angle);
            else if (direction === 'up') this.controls.rotateUp(-angle);
            else if (direction === 'down') this.controls.rotateUp(angle);
        } else {
            const target = this.controls.target?.clone?.() || new THREE.Vector3();
            const offset = this.camera.position.clone().sub(target);
            const spherical = new THREE.Spherical().setFromVector3(offset);
            const minPolar = (this.controls.minPolarAngle ?? 0) + 0.0001;
            const maxPolar = (this.controls.maxPolarAngle ?? Math.PI) - 0.0001;

            if (direction === 'left') spherical.theta -= angle;
            else if (direction === 'right') spherical.theta += angle;
            else if (direction === 'up') spherical.phi = THREE.MathUtils.clamp(spherical.phi - angle, minPolar, maxPolar);
            else if (direction === 'down') spherical.phi = THREE.MathUtils.clamp(spherical.phi + angle, minPolar, maxPolar);

            offset.setFromSpherical(spherical);
            this.camera.position.copy(target).add(offset);
        }

        this.controls.update();
        if (this.state.viewMode === 'interior') {
            this._constrainInteriorCamera();
            this.controls.update();
        }
        this.requestRender(350);
        console.log('?? Rotated:', direction);
    }

    /**
     */
    resetCamera() {
        this.state.viewMode = 'interior';
        this.camera.fov = this.interiorFov || this.config.camera.fov;
        this.camera.updateProjectionMatrix();
        this._applyInteriorCameraPose(this.builder?.dimensions, false);
        this.requestRender(500);

        console.log('?? Camera reset');
    }

    /**
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.container.requestFullscreen?.();
            this.state.isFullscreen = true;
        } else {
            document.exitFullscreen?.();
            this.state.isFullscreen = false;
        }

        console.log('??? Fullscreen:', this.state.isFullscreen);
    }

    /**
     * @private
     */
    _notifyViewChange(view) {
        this.callbacks.onViewChange.forEach(callback => {
            try {
                callback(view);
            } catch (error) {
                console.error('? Error in view change callback:', error);
            }
        });
    }

    /**
     * @private
     */
    _notifyExteriorUpdate() {
        this.callbacks.onExteriorUpdate.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error('? Error in exterior update callback:', error);
            }
        });
    }
        // ============================================
    // ============================================

    /**
     */
    takeScreenshot() {
        this.renderer.render(this.scene, this.camera);
        return this.renderer.domElement.toDataURL('image/png');
    }

    /**
     */
    exportScreenshot(filename = 'balcony.png') {
        const dataUrl = this.takeScreenshot();
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();

        console.log('?? Screenshot exported:', filename);

        this._showNotification('�������� ��������!', 'success');
    }

    /**
     */
    async getFullScreenshot() {
        await new Promise(resolve => requestAnimationFrame(resolve));

        const originalPixelRatio = this.renderer.getPixelRatio();
        this.renderer.setPixelRatio(2);
        this.renderer.render(this.scene, this.camera);

        const dataUrl = this.renderer.domElement.toDataURL('image/png', 1.0);

        this.renderer.setPixelRatio(originalPixelRatio);

        return dataUrl;
    }

    /**
     */
    takeTransparentScreenshot() {
        const originalBackground = this.scene.background;
        this.scene.background = null;

        this.renderer.render(this.scene, this.camera);
        const dataUrl = this.renderer.domElement.toDataURL('image/png');

        this.scene.background = originalBackground;

        return dataUrl;
    }

    /**
     */
    async capture360() {
        const images = [];
        const angles = [0, 90, 180, 270];

        const originalRotation = this.camera.rotation.y;

        for (const angle of angles) {
            this.camera.rotation.y = angle * Math.PI / 180;
            this.renderer.render(this.scene, this.camera);

            await new Promise(resolve => requestAnimationFrame(resolve));

            images.push(this.renderer.domElement.toDataURL('image/png'));
        }

        this.camera.rotation.y = originalRotation;

        console.log('?? 360� capture completed:', images.length, 'images');
        return images;
    }

    /**
     */
    async capturePanorama() {
        const originalFov = this.camera.fov;
        this.camera.fov = 120;
        this.camera.updateProjectionMatrix();

        await new Promise(resolve => requestAnimationFrame(resolve));

        this.renderer.render(this.scene, this.camera);
        const panorama = this.renderer.domElement.toDataURL('image/png');

        this.camera.fov = originalFov;
        this.camera.updateProjectionMatrix();

        console.log('?? Panorama captured');
        return panorama;
    }

    /**
     * @private
     */
    _showNotification(message, type = 'info') {
        let notification = document.getElementById('visualizer-notification');

        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'visualizer-notification';
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 25px;
                background: #10b981;
                color: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 10000;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.3s ease;
                opacity: 0;
                transform: translateY(-20px);
            `;
            document.body.appendChild(notification);
        }

        const colors = {
            success: '#10b981',
            error: '#ef4444',
            info: '#3b82f6',
            warning: '#f59e0b'
        };
        notification.style.background = colors[type] || colors.info;

        notification.textContent = message;
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-20px)';
        }, 3000);
    }

    // ============================================
    // ============================================

    /**
     * @private
     */
    _startAnimation() {
        this.clock = new THREE.Clock();
        this.state.isAnimating = true;
        this.requestRender(600);

        const animate = () => {
            this.animationFrame = requestAnimationFrame(animate);

            const delta = this.clock.getDelta();
            const now = performance.now();
            let controlsChanged = false;

            if (this.controls) {
                controlsChanged = this.controls.update() === true;
                if (this.state.viewMode === 'interior') {
                    this._constrainInteriorCamera();
                }
            }

            const shouldRender = this.forceRender || controlsChanged || now < this.renderActiveUntil;
            if (!shouldRender) {
                return;
            }

            this.forceRender = false;
            this._animateMarkers(delta);

            this._animateExterior(delta);

            this.renderer.render(this.scene, this.camera);
        };

        animate();
        console.log('? Animation started');
    }

    /**
     * @private
     */
    _animateMarkers(delta) {
        const time = Date.now() * 0.001;

        this.markers.forEach((marker, index) => {
            if (marker.userData.isRing) {
                if (marker.userData.markerType === 'navigation') {
                    marker.rotation.x = -Math.PI / 2;
                    marker.rotation.z += delta * 0.9;
                } else {
                    marker.rotation.z += delta * 0.5;
                    marker.lookAt(this.camera.position);
                }
            } else {
                const scale = 1 + Math.sin(time * 2 + index) * 0.1;
                marker.scale.set(scale, scale, scale);
            }
        });
    }

    /**
     * @private
     */
    _animateExterior(delta) {
        if (!this.exteriorGroup) return;

        const time = Date.now() * 0.0001;

        if (this.config.exterior.showTrees) {
            this.exteriorGroup.children.forEach(child => {
                if (child.userData.isTree) {
                    child.rotation.z = Math.sin(time + child.position.x) * 0.02;
                }
            });
        }
    }

    /**
     */
    stopAnimation() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
            this.state.isAnimating = false;
            this.renderActiveUntil = 0;
            console.log('?? Animation stopped');
        }

        if (this.updateFrame) {
            cancelAnimationFrame(this.updateFrame);
            this.updateFrame = null;
            this.updateScheduled = false;
        }
    }

    /**
     */
    resumeAnimation() {
        if (!this.animationFrame) {
            this._startAnimation();
        }
    }

    /**
     */
    animateToElement(element, duration = 1000) {
        const positions = {
            'wall_front': { x: 0, y: 1.5, z: 2 },
            'wall_back': { x: 0, y: 1.5, z: -2 },
            'wall_left': { x: -2, y: 1.5, z: 0 },
            'wall_right': { x: 2, y: 1.5, z: 0 },
            'ceiling': { x: 0, y: 2.5, z: 0 },
            'floor': { x: 0, y: 0.5, z: 0 }
        };

        if (positions[element]) {
            const targetPos = {
                ...positions[element],
                y: this.state.viewMode === 'interior'
                    ? this._getInteriorEyeHeight(this.builder?.dimensions)
                    : positions[element].y
            };

            const startPos = { ...this.camera.position };
            const startTime = Date.now();

            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = this._easeInOutCubic(progress);

                this.camera.position.lerpVectors(
                    new THREE.Vector3(startPos.x, startPos.y, startPos.z),
                    new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z),
                    eased
                );

                if (this.controls) {
                    this.controls.target.lerpVectors(
                        this.controls.target,
                        new THREE.Vector3(0, 1.5, 0),
                        eased
                    );
                    if (this.state.viewMode === 'interior') {
                        this._constrainInteriorCamera();
                    }
                    this.controls.update();
                }

                if (progress < 1) {
                    requestAnimationFrame(animate);
                }
            };

            animate();
            console.log('?? Animating to element:', element);
        }
    }

    /**
     */
    startTour(duration = 10000) {
        const positions = [
            { x: 0, y: 1.7, z: 0, lookAt: { x: 0, y: 1.5, z: 2 } },
            { x: 1, y: 1.7, z: 1, lookAt: { x: -1, y: 1.5, z: -1 } },
            { x: 0, y: 1.7, z: 1, lookAt: { x: 0, y: 1.5, z: -1 } },
            { x: -1, y: 1.7, z: 0, lookAt: { x: 1, y: 1.5, z: 0 } },
            { x: 0, y: 1.7, z: 0, lookAt: { x: 0, y: 1.5, z: 2 } }
        ];

        let currentIndex = 0;
        const segmentDuration = duration / positions.length;

        const animateSegment = () => {
            if (currentIndex >= positions.length - 1) {
                console.log('?? Tour completed');
                return;
            }

            const from = positions[currentIndex];
            const to = positions[currentIndex + 1];

            this._animateCameraPosition(
                { x: from.x, y: from.y, z: from.z },
                { x: to.x, y: to.y, z: to.z },
                segmentDuration,
                () => {
                    currentIndex++;
                    animateSegment();
                }
            );
        };

        animateSegment();
        console.log('?? Tour started');
    }

    /**
     * @private
     */
    _animateCameraPosition(from, to, duration, onComplete) {
        const startTime = Date.now();
        const startPos = this.camera.position.clone();
        this.requestRender(duration + 150);

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = this._easeInOutCubic(progress);

            this.camera.position.lerpVectors(
                new THREE.Vector3(startPos.x, startPos.y, startPos.z),
                new THREE.Vector3(to.x, to.y, to.z),
                eased
            );

            if (this.state.viewMode === 'interior') {
                this._constrainInteriorCamera();
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else if (onComplete) {
                onComplete();
            }
        };

        animate();
    }

    /**
     */
    stopTour() {
        this.resetCamera();
        console.log('?? Tour stopped');
    }

    // ============================================
    // ============================================

    /**
     */
    dispose() {
        console.log('?? Disposing visualizer...');

        this.stopAnimation();
        if (Array.isArray(this._managedIntervals)) {
            this._managedIntervals.forEach((intervalId) => clearInterval(intervalId));
            this._managedIntervals = [];
        }

        if (this.balconyGroup) {
            this._disposeGroup(this.balconyGroup);
        }

        if (this.exteriorGroup) {
            this._disposeGroup(this.exteriorGroup);
        }

        this.markers.forEach(marker => {
            if (marker.geometry) marker.geometry.dispose();
            if (marker.material) marker.material.dispose();
            this.scene.remove(marker);
        });
        this.markers = [];

        this.lightingObjects.forEach(obj => {
            this._disposeObject(obj);
            this.scene.remove(obj);
        });
        this.lightingObjects = [];

        this.furnitureObjects.forEach(obj => {
            this._disposeObject(obj);
            this.scene.remove(obj);
        });
        this.furnitureObjects = [];

        this.windows.forEach(obj => {
            this._disposeObject(obj);
            this.balconyGroup?.remove(obj);
        });
        this.windows = [];

        if (this.helpers.grid) {
            this.helpers.grid.geometry.dispose();
            this.helpers.grid.material.dispose();
            this.scene.remove(this.helpers.grid);
        }

        if (this.helpers.axes) {
            this.helpers.axes.geometry.dispose();
            this.helpers.axes.material.dispose();
            this.scene.remove(this.helpers.axes);
        }

        if (this.renderer) {
            this.renderer.dispose();
            if (this.container && this.renderer.domElement) {
                this.container.removeChild(this.renderer.domElement);
            }
            this.renderer = null;
        }

        if (this.scene) {
            while (this.scene.children.length > 0) {
                this.scene.remove(this.scene.children[0]);
            }
        }

        this._clearTextureCache();
        this.materialsCache = {};
        this.texturesCache = {};
        this.materialLoadPromises = {};
        this.textureLoadPromises = {};
        this.textureFailureCache = {};

        console.log('? Visualizer disposed successfully');
    }

    /**
     * @private
     */
    _disposeGroup(group) {
        group.traverse((child) => {
            this._disposeObject(child);
        });

        if (this.scene) {
            this.scene.remove(group);
        }
    }

    /**
     * @private
     */
    _disposeObject(object) {
        if (object.geometry) {
            object.geometry.dispose();
        }

        if (object.material) {
            if (Array.isArray(object.material)) {
                object.material.forEach(material => {
                    this._disposeMaterial(material);
                });
            } else {
                this._disposeMaterial(object.material);
            }
        }

        if (object.texture) {
            object.texture.dispose();
        }
    }

    /**
     * @private
     */
    _disposeMaterial(material) {
        if (material.map) material.map.dispose();
        if (material.lightMap) material.lightMap.dispose();
        if (material.bumpMap) material.bumpMap.dispose();
        if (material.normalMap) material.normalMap.dispose();
        if (material.specularMap) material.specularMap.dispose();
        if (material.envMap) material.envMap.dispose();

        material.dispose();
    }

    /**
     * @private
     */
    _clearTextureCache() {
        Object.values(this.texturesCache).forEach(texture => {
            if (texture) texture.dispose();
        });
    }

    /**
     */
    reloadTextures() {
        this._clearTextureCache();
        this._loadDefaultTextures();
        this._updateMaterials();
        console.log('?? Textures reloaded');
    }

    refreshMaterialAssets() {
        this.materialsCache = {};
        this.materialLoadPromises = {};
        this.textureFailureCache = {};
        this._preloadCatalogTextures();
        this.requestUpdate();
    }

    // ============================================
    // ============================================

    /**
     */
    subscribe(event, callback) {
        if (this.callbacks[event] && typeof callback === 'function') {
            this.callbacks[event].push(callback);
            console.log('?? Subscribed to event:', event);
        }
    }

    /**
     */
    unsubscribe(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
            console.log('?? Unsubscribed from event:', event);
        }
    }

    /**
     */
    clearCallbacks() {
        Object.keys(this.callbacks).forEach(key => {
            this.callbacks[key] = [];
        });
        console.log('??? All callbacks cleared');
    }

    /**
     * @private
     */
    _notifyObjectClick(userData, point) {
        this.callbacks.onObjectClick.forEach(callback => {
            try {
                callback(userData, point);
            } catch (error) {
                console.error('? Error in object click callback:', error);
            }
        });
    }

    /**
     * @private
     */
    _notifyPlacement(type, point) {
        this.callbacks.onPlacement.forEach(callback => {
            try {
                callback(type, point);
            } catch (error) {
                console.error('? Error in placement callback:', error);
            }
        });
    }

    /**
     * @private
     */
    _notifyLoad() {
        this.callbacks.onLoad.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error('? Error in load callback:', error);
            }
        });
    }

    /**
     * @private
     */
    _notifyError(error) {
        this.callbacks.onError.forEach(callback => {
            try {
                callback(error);
            } catch (e) {
                console.error('? Error in error callback:', e);
            }
        });
    }

    /**
     * @private
     */
    _notifyMaterialChange(element, material) {
        this.callbacks.onMaterialChange.forEach(callback => {
            try {
                callback(element, material);
            } catch (error) {
                console.error('? Error in material change callback:', error);
            }
        });
    }

    /**
     * @private
     */
    _notifyViewChange(view) {
        this.callbacks.onViewChange.forEach(callback => {
            try {
                callback(view);
            } catch (error) {
                console.error('? Error in view change callback:', error);
            }
        });
    }

    /**
     * @private
     */
    _notifyExteriorUpdate() {
        this.callbacks.onExteriorUpdate.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error('? Error in exterior update callback:', error);
            }
        });
    }

    // ============================================
    // ============================================

    /**
     */
    setBuilder(builder) {
        this.builder = builder;

        if (builder) {
            builder.subscribe(() => {
                this.requestUpdate();
            });

            this.lastGeometryKey = JSON.stringify({
                dimensions: builder.dimensions,
                glazingType: builder.glazing?.type,
                windowSections: builder.glazing?.windowSections
            });
            this._applyInteriorCameraPose(builder.dimensions, false);

            console.log('? Builder connected to visualizer');
        }
    }

    /**
     */
    toggleGrid(show) {
        this.state.showGrid = show;
        if (this.helpers.grid) {
            this.helpers.grid.visible = show;
        }
        console.log('?? Grid visibility:', show);
    }

    /**
     */
    toggleAxes(show) {
        this.state.showAxes = show;
        if (this.helpers.axes) {
            this.helpers.axes.visible = show;
        }
        console.log('?? Axes visibility:', show);
    }

    /**
     */
    toggleWireframe(show) {
        this.state.showWireframe = show;

        this.balconyGroup?.traverse((child) => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.wireframe = show);
                } else {
                    child.material.wireframe = show;
                }
            }
        });

        console.log('?? Wireframe mode:', show);
    }

    /**
     */
    toggleViewMode(mode) {
        this.state.viewMode = mode;

        if (mode === 'interior') {
            this._applyInteriorCameraPose(this.builder?.dimensions, false);
            this.controls.maxDistance = 10;
            this.controls.enablePan = false;
        } else {
            const pose = this._getViewPoses().iso;
            this.camera.position.set(pose.x, pose.y, pose.z);
            this.camera.lookAt(pose.lookAt.x, pose.lookAt.y, pose.lookAt.z);
            if (this.controls) {
                this.controls.target.set(pose.lookAt.x, pose.lookAt.y, pose.lookAt.z);
            }
            this.controls.maxDistance = 20;
            this.controls.enablePan = true;
        }

        console.log('??? View mode:', mode);
    }

    /**
     */
    setBackgroundColor(color) {
        if (typeof color === 'string') {
            this.scene.background = new THREE.Color(color);
        } else {
            this.scene.background = new THREE.Color(color);
        }
        console.log('?? Background color updated');
    }

    /**
     * @param {string} quality - low, medium, high
     */
    setQuality(quality) {
        const settings = {
            low: { pixelRatio: 1, shadowMap: false, antialias: false },
            medium: { pixelRatio: 1.5, shadowMap: true, antialias: true },
            high: { pixelRatio: 2, shadowMap: true, antialias: true }
        };

        const setting = settings[quality] || settings.medium;

        this.renderer.setPixelRatio(setting.pixelRatio);
        this.renderer.shadowMap.enabled = setting.shadowMap;
        this.renderer.antialias = setting.antialias;

        console.log('?? Quality set to:', quality);
    }

    /**
     */
    getSceneStats() {
        return {
            objects: this.scene.children.length,
            markers: this.markers.length,
            lights: this.lightingObjects.length,
            furniture: this.furnitureObjects.length,
            windows: this.windows.length,
            walls: Object.keys(this.walls).length,
            isLoaded: this.state.isLoaded,
            isAnimating: this.state.isAnimating
        };
    }

    /**
     */
    logSceneInfo() {
        const stats = this.getSceneStats();
        console.log('?? Scene Statistics:', stats);
    }

    /**
     */
    isReady() {
        return this.state.isLoaded &&
            this.scene !== null &&
            this.camera !== null &&
            this.renderer !== null;
    }

    /**
     */
    reloadScene() {
        console.log('?? Reloading scene...');
        this.dispose();
        this.init();
    }

    /**
     */
    resetToDefaults() {
        this.state.showGrid = false;
        this.state.showAxes = false;
        this.state.showWireframe = false;
        this.state.placementMode = null;

        this.toggleGrid(false);
        this.toggleAxes(false);
        this.toggleWireframe(false);
        this.exitPlacementMode();
        this.resetCamera();

        console.log('? Reset to defaults');
    }

    /**
     */
    isActive() {
        return this.state.isLoaded &&
            this.renderer !== null &&
            this.animationFrame !== null;
    }

    /**
     */
    pauseRendering() {
        this.stopAnimation();
        console.log('?? Rendering paused');
    }

    /**
     */
    resumeRendering() {
        if (!this.animationFrame) {
            this._startAnimation();
            console.log('?? Rendering resumed');
        }
        this.requestRender(600);
    }

    /**
     */
    toggleRendering() {
        if (this.isActive()) {
            this.pauseRendering();
        } else {
            this.resumeRendering();
        }
    }

    /**
     */
    getFPS() {
        if (this.clock) {
            return Math.round(1 / this.clock.getDelta());
        }
        return 0;
    }

    /**
     */
    getSummary() {
        return {
            version: '3.0.0',
            containerId: this.config.containerId,
            isReady: this.isReady(),
            isActive: this.isActive(),
            dimensions: this.builder?.dimensions || null,
            objects: this.getSceneStats(),
            performance: this.getRenderStats(),
            fps: this.getFPS()
        };
    }

    /**
     */
    printSummary() {
        const summary = this.getSummary();
        console.table(summary);
    }

    /**
     */
    getRenderStats() {
        const info = this.renderer.info;
        return {
            drawCalls: info.render.calls,
            triangles: info.render.triangles,
            points: info.render.points,
            lines: info.render.lines,
            textures: info.memory.textures,
            geometries: info.memory.geometries,
            programs: info.programs ? info.programs.length : 0
        };
    }

    /**
     */
    logRenderStats() {
        const stats = this.getRenderStats();
        console.log('?? Render Statistics:', stats);
    }

    /**
     */
    destroy() {
        console.log('?? Destroying visualizer...');

        this.unregisterFromGlobalRegistry();

        this.clearCallbacks();

        this.stopAnimation();

        this.dispose();

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.balconyGroup = null;
        this.builder = null;
        this.container = null;

        console.log('? Visualizer destroyed successfully');
    }
        // ============================================
    // ============================================

    /**
     */
    optimizeForMobile() {
        console.log('?? Optimizing for mobile devices...');

        this.renderer.setPixelRatio(1);
        this.renderer.shadowMap.enabled = false;
        this.renderer.antialias = false;

        this.setLightIntensity(0.8);

        this.scene.fog = null;

        this.directionalLight.castShadow = false;

        this._optimizeMaterials();

        console.log('? Mobile optimization complete');
    }

    /**
     * @private
     */
    _optimizeMaterials() {
        this.scene.traverse((object) => {
            if (object.isMesh && object.material) {
                if (object.material.roughness) {
                    object.material.roughness = 0.5;
                }
                if (object.material.metalness) {
                    object.material.metalness = 0.1;
                }
            }
        });
    }

    /**
     */
    optimizeForDesktop() {
        console.log('?? Optimizing for desktop...');

        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.antialias = true;

        this.scene.fog = new THREE.Fog(
            this.config.backgroundColor,
            10,
            100
        );

        this.directionalLight.castShadow = true;

        console.log('? Desktop optimization complete');
    }

    /**
     */
    autoOptimize() {
        const checkInterval = setInterval(() => {
            const fps = this.getFPS();

            if (fps < 30) {
                console.log('? Auto-optimizing due to low FPS:', fps);
                this.setPerformanceMode(true);
            } else if (fps > 55) {
                console.log('?? Restoring quality due to high FPS:', fps);
                this.setPerformanceMode(false);
            }
        }, 2000);

        this._managedIntervals.push(checkInterval);
        return checkInterval;
    }

    /**
     */
    setPerformanceMode(enable) {
        if (enable) {
            this.renderer.setPixelRatio(1);
            this.renderer.shadowMap.enabled = false;
            this.renderer.antialias = false;
            this.scene.fog = null;
        } else {
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            this.renderer.shadowMap.enabled = true;
            this.renderer.antialias = true;
            this.scene.fog = new THREE.Fog(this.config.backgroundColor, 10, 100);
        }

        console.log('? Performance mode:', enable);
    }

    /**
     */
    static checkWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            return !!gl;
        } catch (e) {
            return false;
        }
    }

    /**
     */
    static isWebGL2Supported() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl2');
            return !!gl;
        } catch (e) {
            return false;
        }
    }

    /**
     */
    getWebGLInfo() {
        const gl = this.renderer.getContext();
        return {
            vendor: gl.getParameter(gl.VENDOR),
            renderer: gl.getParameter(gl.RENDERER),
            version: gl.getParameter(gl.VERSION),
            shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
            maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
            maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS)
        };
    }

    /**
     */
    logWebGLInfo() {
        const info = this.getWebGLInfo();
        console.log('?? WebGL Information:', info);
    }

    /**
     */
    static getRecommendedSettings() {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
        );

        const isLowEnd = navigator.hardwareConcurrency <= 4;

        if (isMobile || isLowEnd) {
            return {
                quality: 'low',
                shadowMap: false,
                antialias: false,
                pixelRatio: 1
            };
        }

        return {
            quality: 'high',
            shadowMap: true,
            antialias: true,
            pixelRatio: Math.min(window.devicePixelRatio, 2)
        };
    }

    // ============================================
    // ============================================

    /**
     */
    setDebugMode(enable) {
        if (enable) {
            this.toggleGrid(true);
            this.toggleAxes(true);

            if (this.helpers.cameraHelper) {
                this.helpers.cameraHelper.visible = true;
            }

            this.toggleWireframe(false);

            this._enableDebugLogging();

            console.log('?? Debug mode enabled');
        } else {
            this.toggleGrid(false);
            this.toggleAxes(false);

            if (this.helpers.cameraHelper) {
                this.helpers.cameraHelper.visible = false;
            }

            this.toggleWireframe(false);

            this._disableDebugLogging();

            console.log('?? Debug mode disabled');
        }
    }

    /**
     * @private
     */
    _enableDebugLogging() {
        this._debugLogging = true;
        console.log('?? Debug logging enabled');
    }

    /**
     * @private
     */
    _disableDebugLogging() {
        this._debugLogging = false;
        console.log('?? Debug logging disabled');
    }

    /**
     */
    inspectObject(object) {
        if (!object) {
            console.log('?? No object to inspect');
            return;
        }

        console.log('?? Object inspection:', {
            name: object.name,
            type: object.type,
            position: object.position,
            rotation: object.rotation,
            scale: object.scale,
            visible: object.visible,
            userData: object.userData
        });
    }

    /**
     */
    getRenderStats() {
        const info = this.renderer.info;
        return {
            drawCalls: info.render.calls,
            triangles: info.render.triangles,
            points: info.render.points,
            lines: info.render.lines,
            textures: info.memory.textures,
            geometries: info.memory.geometries,
            programs: info.programs ? info.programs.length : 0
        };
    }

    /**
     */
    logRenderStats() {
        const stats = this.getRenderStats();
        console.log('?? Render Statistics:', stats);
    }

    /**
     */
    listSceneObjects() {
        const objects = [];
        this.scene.traverse((object) => {
            objects.push({
                name: object.name,
                type: object.type,
                id: object.id
            });
        });
        console.log('?? Scene objects:', objects);
        return objects;
    }

    /**
     */
    findObjectByName(name) {
        let found = null;
        this.scene.traverse((object) => {
            if (object.name === name) {
                found = object;
            }
        });
        console.log('?? Found object:', name, found ? '?' : '?');
        return found;
    }

    /**
     */
    highlightObject(object, color = 0xffff00) {
        if (object && object.isMesh) {
            if (!object.userData.originalMaterial) {
                object.userData.originalMaterial = object.material;
            }

            const highlightMaterial = new THREE.MeshBasicMaterial({
                color: color,
                wireframe: true,
                transparent: true,
                opacity: 0.5
            });

            object.material = highlightMaterial;

            setTimeout(() => {
                if (object.userData.originalMaterial) {
                    object.material = object.userData.originalMaterial;
                }
            }, 2000);
        }
    }

    /**
     */
    monitorPerformance(interval = 1000) {
        const intervalId = setInterval(() => {
            const fps = this.getFPS();
            const stats = this.getRenderStats();

            console.log('?? Performance:', {
                fps,
                drawCalls: stats.drawCalls,
                triangles: stats.triangles,
                memory: {
                    textures: stats.textures,
                    geometries: stats.geometries
                }
            });

            if (fps < 30) {
                console.warn('?? Low FPS detected:', fps);
            }
        }, interval);
        this._managedIntervals.push(intervalId);
        return intervalId;
    }

    /**
     */
    clearTextureCache() {
        this.scene.traverse((object) => {
            if (object.material) {
                const material = object.material;
                if (material.map) {
                    material.map.dispose();
                    material.map = null;
                }
            }
        });
        console.log('??? Texture cache cleared');
    }

    /**
     */
    reloadTextures() {
        this.clearTextureCache();
        this._updateMaterials();
        console.log('?? Textures reloaded');
    }

    // ============================================
    // ============================================

    /**
     */
    exportSceneState() {
        return {
            camera: {
                position: this.camera.position.clone(),
                target: this.controls?.target?.clone() || new THREE.Vector3(0, 1.5, 0),
                fov: this.camera.fov
            },
            balcony: this.builder?.exportConfig() || {},
            settings: {
                showGrid: this.state.showGrid,
                showAxes: this.state.showAxes,
                showWireframe: this.state.showWireframe,
                viewMode: this.state.viewMode
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     */
    importSceneState(state) {
        if (state.camera) {
            this.camera.position.copy(state.camera.position);
            if (this.controls && state.camera.target) {
                this.controls.target.copy(state.camera.target);
                if (this.state.viewMode === 'interior') {
                    this._constrainInteriorCamera();
                }
                this.controls.update();
            }
            this.camera.fov = state.camera.fov || 60;
            this.camera.updateProjectionMatrix();
        }

        if (state.settings) {
            this.toggleGrid(state.settings.showGrid);
            this.toggleAxes(state.settings.showAxes);
            this.toggleWireframe(state.settings.showWireframe);
        }

        console.log('?? Scene state imported');
    }

    /**
     */
    saveToLocalStorage(key = 'balcony_visualizer_state') {
        try {
            const state = this.exportSceneState();
            localStorage.setItem(key, JSON.stringify(state));
            console.log('?? State saved to localStorage');
        } catch (error) {
            console.error('? Failed to save to localStorage:', error);
        }
    }

    /**
     */
    loadFromLocalStorage(key = 'balcony_visualizer_state') {
        try {
            const stateJson = localStorage.getItem(key);
            if (stateJson) {
                const state = JSON.parse(stateJson);
                this.importSceneState(state);
                console.log('?? State loaded from localStorage');
                return true;
            }
        } catch (error) {
            console.error('? Failed to load from localStorage:', error);
        }
        return false;
    }

    /**
     */
    clearLocalStorage(key = 'balcony_visualizer_state') {
        localStorage.removeItem(key);
        console.log('??? LocalStorage cleared');
    }

    /**
     */
    exportConfigJSON() {
        return JSON.stringify(this.exportSceneState(), null, 2);
    }

    /**
     */
    importConfigJSON(json) {
        try {
            const state = JSON.parse(json);
            this.importSceneState(state);
            console.log('? Configuration imported from JSON');
        } catch (error) {
            console.error('? Failed to import configuration:', error);
        }
    }

    /**
     */
    downloadConfig(filename = 'balcony-config.json') {
        const json = this.exportConfigJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        console.log('?? Configuration downloaded:', filename);
    }

    /**
     */
    uploadConfig(file) {
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const json = event.target.result;
                this.importConfigJSON(json);
            } catch (error) {
                console.error('? Failed to parse configuration file:', error);
            }
        };

        reader.readAsText(file);
        console.log('?? Configuration uploaded');
    }

    // ============================================
    // ============================================

    /**
     * @returns {Object} Public API
     */
    getAPI() {
        return {
            // Camera control
            setView: (view) => this.setView(view),
            resetCamera: () => this.resetCamera(),
            zoom: (dir) => this.zoom(dir),
            rotate: (dir) => this.rotate(dir),

            // Scene control
            toggleGrid: (show) => this.toggleGrid(show),
            toggleAxes: (show) => this.toggleAxes(show),
            toggleWireframe: (show) => this.toggleWireframe(show),

            // Screenshot
            takeScreenshot: () => this.takeScreenshot(),
            exportScreenshot: (name) => this.exportScreenshot(name),

            // State
            isReady: () => this.isReady(),
            getStats: () => this.getSceneStats(),

            // Events
            subscribe: (event, cb) => this.subscribe(event, cb),
            unsubscribe: (event, cb) => this.unsubscribe(event, cb)
        };
    }

    /**
     */
    integrateWith(app) {
        if (app.onReady) {
            this.subscribe('onLoad', () => app.onReady(this.getAPI()));
        }

        if (app.onError) {
            this.subscribe('onError', (error) => app.onError(error));
        }

        if (app.onObjectClick) {
            this.subscribe('onObjectClick', (data, point) => {
                app.onObjectClick(data, point);
            });
        }

        console.log('?? Integrated with external application');
    }

    /**
     */
    registerPlugin(name, plugin) {
        if (!this.plugins) {
            this.plugins = {};
        }

        this.plugins[name] = plugin;

        if (plugin.init) {
            plugin.init(this);
        }

        console.log('?? Plugin registered:', name);
    }

    /**
     */
    getPlugin(name) {
        return this.plugins?.[name] || null;
    }

    /**
     */
    unregisterPlugin(name) {
        if (this.plugins?.[name]) {
            const plugin = this.plugins[name];

            if (plugin.dispose) {
                plugin.dispose();
            }

            delete this.plugins[name];
            console.log('?? Plugin unregistered:', name);
        }
    }

    /**
     */
    getPlugins() {
        return Object.keys(this.plugins || {});
    }

    // ============================================
    // ============================================

    /**
     */
    runTestScenario(scenario) {
        const scenarios = {
            'basic': () => this._testBasic(),
            'materials': () => this._testMaterials(),
            'lighting': () => this._testLighting(),
            'camera': () => this._testCamera(),
            'performance': () => this._testPerformance()
        };

        if (scenarios[scenario]) {
            console.log('?? Running test scenario:', scenario);
            scenarios[scenario]();
        } else {
            console.error('? Unknown test scenario:', scenario);
        }
    }

    /**
     * @private
     */
    _testBasic() {
        console.assert(this.scene !== null, 'Scene should exist');
        console.assert(this.camera !== null, 'Camera should exist');
        console.assert(this.renderer !== null, 'Renderer should exist');
        console.assert(this.isReady(), 'Visualizer should be ready');
        console.log('? Basic tests passed');
    }

    /**
     * @private
     */
    _testMaterials() {
        console.assert(this.floor !== null, 'Floor should exist');
        console.assert(this.ceiling !== null, 'Ceiling should exist');
        console.assert(Object.keys(this.walls).length > 0, 'Walls should exist');
        console.log('? Materials tests passed');
    }

    /**
     * @private
     */
    _testLighting() {
        console.assert(this.ambientLight !== null, 'Ambient light should exist');
        console.assert(this.directionalLight !== null, 'Directional light should exist');
        console.log('? Lighting tests passed');
    }

    /**
     * @private
     */
    _testCamera() {
        console.assert(this.camera.position.y > 0, 'Camera should be positioned');
        console.assert(this.controls !== null, 'Controls should exist');
        console.log('? Camera tests passed');
    }

    /**
     * @private
     */
    _testPerformance() {
        const startTime = performance.now();

        for (let i = 0; i < 100; i++) {
            const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
            const material = new THREE.MeshBasicMaterial();
            const mesh = new THREE.Mesh(geometry, material);
            this.scene.add(mesh);
            this.scene.remove(mesh);
            geometry.dispose();
            material.dispose();
        }

        const endTime = performance.now();
        const duration = endTime - startTime;

        console.log(`? Performance test: ${duration.toFixed(2)}ms for 100 objects`);
        console.assert(duration < 1000, 'Should complete in under 1 second');
        console.log('? Performance tests passed');
    }

    /**
     */
    getTestReport() {
        return {
            isReady: this.isReady(),
            scene: {
                objects: this.scene.children.length,
                lights: this.scene.children.filter(c => c.isLight).length,
                meshes: this.scene.children.filter(c => c.isMesh).length
            },
            camera: {
                position: this.camera.position.clone(),
                fov: this.camera.fov,
                near: this.camera.near,
                far: this.camera.far
            },
            renderer: {
                width: this.renderer.domElement.width,
                height: this.renderer.domElement.height,
                pixelRatio: this.renderer.getPixelRatio()
            },
            performance: this.getRenderStats()
        };
    }

    /**
     */
    cloneConfig() {
        return JSON.parse(JSON.stringify(this.config));
    }

    /**
     */
    static compareConfigs(config1, config2) {
        const differences = [];

        const allKeys = new Set([
            ...Object.keys(config1 || {}),
            ...Object.keys(config2 || {})
        ]);

        allKeys.forEach(key => {
            if (JSON.stringify(config1?.[key]) !== JSON.stringify(config2?.[key])) {
                differences.push({
                    key,
                    value1: config1?.[key],
                    value2: config2?.[key]
                });
            }
        });

        return differences;
    }

    /**
     */
    static validateConfig(config) {
        const errors = [];
        const warnings = [];

        if (!config.containerId) {
            errors.push('containerId is required');
        }

        if (config.camera?.fov && (config.camera.fov < 1 || config.camera.fov > 180)) {
            errors.push('Camera FOV must be between 1 and 180');
        }

        if (config.camera?.near && config.camera.near <= 0) {
            errors.push('Camera near must be positive');
        }

        if (config.camera?.far && config.camera.far <= config.camera?.near) {
            errors.push('Camera far must be greater than near');
        }

        if (config.controls?.minDistance && config.controls.minDistance < 0) {
            warnings.push('minDistance should be non-negative');
        }

        if (config.controls?.maxDistance && config.controls.maxDistance < config.controls?.minDistance) {
            errors.push('maxDistance must be greater than minDistance');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
        // ============================================
    // ============================================

    /**
     */
    async loadTexture(url) {
        if (!url || typeof url !== 'string') {
            return Promise.reject(new Error('Invalid texture URL'));
        }

        if (this.texturesCache[url]) {
            return this.texturesCache[url];
        }

        if (this.textureLoadPromises[url]) {
            return this.textureLoadPromises[url];
        }

        const failedAt = this.textureFailureCache[url];
        if (failedAt && (Date.now() - failedAt) < this.textureRetryCooldownMs) {
            return Promise.reject(new Error(`Texture temporarily blocked after recent failure: ${url}`));
        }

        this.textureLoadPromises[url] = new Promise((resolve, reject) => {
            const loader = new THREE.TextureLoader();
            loader.load(
                url,
                (texture) => {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    this.texturesCache[url] = texture;
                    delete this.textureFailureCache[url];
                    delete this.textureLoadPromises[url];
                    resolve(texture);
                },
                undefined,
                (error) => {
                    this.textureFailureCache[url] = Date.now();
                    delete this.textureLoadPromises[url];
                    reject(error || new Error(`Texture load error: ${url}`));
                }
            );
        });

        return this.textureLoadPromises[url];
    }

    /**
     */
    async loadTextures(urls) {
        const promises = urls.map(url => this.loadTexture(url));
        return Promise.all(promises);
    }

    /**
     */
    createWoodTexture(options = {}) {
        const {
            width = 512,
            height = 512,
            color1 = '#8B7355',
            color2 = '#6B5344',
            grainDensity = 100
        } = options;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = color1;
        ctx.fillRect(0, 0, width, height);

        for (let i = 0; i < grainDensity; i++) {
            ctx.strokeStyle = color2;
            ctx.lineWidth = 1 + Math.random() * 2;
            ctx.globalAlpha = 0.3 + Math.random() * 0.4;
            ctx.beginPath();
            const y = Math.random() * height;
            ctx.moveTo(0, y);
            
            for (let x = 0; x < width; x += 10) {
                ctx.lineTo(x, y + Math.sin(x * 0.05) * 5);
            }
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);

        return texture;
    }

    /**
     */
    createTileTexture(options = {}) {
        const {
            width = 512,
            height = 512,
            tileSize = 128,
            tileColor = '#CCCCCC',
            groutColor = '#999999',
            groutWidth = 3
        } = options;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = tileColor;
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = groutColor;
        ctx.lineWidth = groutWidth;

        for (let x = 0; x <= width; x += tileSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        for (let y = 0; y <= height; y += tileSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 4);

        return texture;
    }

    /**
     */
    createConcreteTexture(options = {}) {
        const {
            width = 512,
            height = 512,
            baseColor = '#888888',
            noiseDensity = 5000
        } = options;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, width, height);

        for (let i = 0; i < noiseDensity; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const brightness = Math.random() * 60 - 30;
            const r = 136 + brightness;
            const g = 136 + brightness;
            const b = 136 + brightness;
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillRect(x, y, 2, 2);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);

        return texture;
    }

    /**
     */
    createBrickTexture(options = {}) {
        const {
            width = 512,
            height = 512,
            brickColor = '#A05244',
            mortarColor = '#CCCCCC',
            brickWidth = 64,
            brickHeight = 32,
            mortarWidth = 4
        } = options;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = mortarColor;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = brickColor;
        let offsetY = 0;
        let row = 0;

        while (offsetY < height) {
            let offsetX = row % 2 === 0 ? 0 : brickWidth / 2;
            
            while (offsetX < width) {
                ctx.fillRect(
                    offsetX + mortarWidth / 2,
                    offsetY + mortarWidth / 2,
                    brickWidth - mortarWidth,
                    brickHeight - mortarWidth
                );
                offsetX += brickWidth;
            }
            
            offsetY += brickHeight;
            row++;
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 4);

        return texture;
    }

    /**
     */
    createTexturedMaterial(options = {}) {
        const {
            type = 'standard',
            color = 0xffffff,
            texture = null,
            roughness = 0.5,
            metalness = 0.1,
            transparent = false,
            opacity = 1.0,
            side = THREE.DoubleSide
        } = options;

        const materialOptions = {
            color,
            roughness,
            metalness,
            transparent,
            opacity,
            side
        };

        if (texture) {
            materialOptions.map = texture;
        }

        switch (type) {
            case 'basic':
                return new THREE.MeshBasicMaterial(materialOptions);
            case 'lambert':
                return new THREE.MeshLambertMaterial(materialOptions);
            case 'phong':
                return new THREE.MeshPhongMaterial(materialOptions);
            case 'physical':
                return new THREE.MeshPhysicalMaterial(materialOptions);
            default:
                return new THREE.MeshStandardMaterial(materialOptions);
        }
    }

    /**
     */
    updateElementMaterial(element, materialOptions) {
        const material = this.createTexturedMaterial(materialOptions);
        
        let targetObject = null;
        
        if (element === 'floor') {
            targetObject = this.floorFinishing || this.floor;
        } else if (element === 'ceiling') {
            targetObject = this.ceilingFinishing || this.ceiling;
        } else if (element.startsWith('wall_')) {
            targetObject = this.walls[element.replace('wall_', '')];
        }

        if (targetObject) {
            if (targetObject.material) {
                this._disposeMaterial(targetObject.material);
            }
            
            targetObject.material = material;
            console.log('? Material updated for:', element);
        }
    }

    /**
     */
    getAvailableMaterials() {
        return [
            { id: 'wood', name: '������', type: 'texture' },
            { id: 'tile', name: '������', type: 'texture' },
            { id: 'laminate', name: '�������', type: 'texture' },
            { id: 'concrete', name: '�����', type: 'texture' },
            { id: 'brick', name: '������', type: 'texture' },
            { id: 'paint', name: '������', type: 'color' },
            { id: 'plaster', name: '����������', type: 'texture' },
            { id: 'metal', name: '������', type: 'texture' },
            { id: 'glass', name: '������', type: 'special' },
            { id: 'carpet', name: '�����', type: 'texture' }
        ];
    }

    /**
     */
    applyMaterial(element, materialId) {
        const materials = {
            wood: { type: 'standard', texture: this.texturesCache.wood, roughness: 0.7 },
            tile: { type: 'standard', texture: this.texturesCache.tile, roughness: 0.4 },
            laminate: { type: 'standard', texture: this.texturesCache.laminate, roughness: 0.5 },
            concrete: { type: 'standard', texture: this.texturesCache.concrete, roughness: 0.9 },
            brick: { type: 'standard', texture: this.texturesCache.brick, roughness: 0.8 },
            paint: { type: 'standard', color: 0xffffff, roughness: 0.5 },
            plaster: { type: 'standard', roughness: 0.7 },
            metal: { type: 'standard', roughness: 0.3, metalness: 0.8 },
            glass: { type: 'physical', transparent: true, opacity: 0.7, roughness: 0.1 },
            carpet: { type: 'standard', roughness: 1.0 }
        };

        const material = materials[materialId];
        if (material) {
            this.updateElementMaterial(element, material);
            this._notifyMaterialChange(element, material);
            console.log('? Material applied:', materialId, 'to', element);
        }
    }

    // ============================================
    // ============================================

    /**
     */
    addPointLight(options = {}) {
        const {
            color = 0xffffff,
            intensity = 1,
            distance = 10,
            decay = 2,
            position = { x: 0, y: 2, z: 0 },
            castShadow = true
        } = options;

        const light = new THREE.PointLight(color, intensity, distance, decay);
        light.position.set(position.x, position.y, position.z);
        light.castShadow = castShadow;

        if (castShadow) {
            light.shadow.mapSize.width = 1024;
            light.shadow.mapSize.height = 1024;
        }

        this.scene.add(light);
        this.lightingObjects.push(light);

        console.log('?? Point light added');
        return light;
    }

    /**
     */
    addSpotLight(options = {}) {
        const {
            color = 0xffffff,
            intensity = 1,
            distance = 20,
            angle = Math.PI / 6,
            penumbra = 0.5,
            position = { x: 0, y: 3, z: 0 },
            target = { x: 0, y: 0, z: 0 },
            castShadow = true
        } = options;

        const light = new THREE.SpotLight(color, intensity, distance, angle, penumbra);
        light.position.set(position.x, position.y, position.z);
        light.castShadow = castShadow;

        const targetObject = new THREE.Object3D();
        targetObject.position.set(target.x, target.y, target.z);
        this.scene.add(targetObject);
        light.target = targetObject;

        if (castShadow) {
            light.shadow.mapSize.width = 1024;
            light.shadow.mapSize.height = 1024;
        }

        this.scene.add(light);
        this.lightingObjects.push(light);

        console.log('?? Spot light added');
        return light;
    }

    /**
     */
    addRectAreaLight(options = {}) {
        const {
            color = 0xffffff,
            intensity = 1,
            width = 2,
            height = 0.1,
            position = { x: 0, y: 2.5, z: 0 },
            rotation = { x: -Math.PI / 2, y: 0, z: 0 }
        } = options;

        const light = new THREE.RectAreaLight(color, intensity, width, height);
        light.position.set(position.x, position.y, position.z);
        light.rotation.set(rotation.x, rotation.y, rotation.z);

        this.scene.add(light);
        this.lightingObjects.push(light);

        const helper = new THREE.RectAreaLightHelper(light);
        this.scene.add(helper);

        console.log('?? Rect area light added');
        return light;
    }

    /**
     */
    configureShadows(options = {}) {
        const {
            enabled = true,
            mapSize = 2048,
            near = 0.5,
            far = 50,
            bias = -0.0001
        } = options;

        if (this.directionalLight) {
            this.directionalLight.castShadow = enabled;
            
            if (enabled) {
                this.directionalLight.shadow.mapSize.width = mapSize;
                this.directionalLight.shadow.mapSize.height = mapSize;
                this.directionalLight.shadow.camera.near = near;
                this.directionalLight.shadow.camera.far = far;
                this.directionalLight.shadow.bias = bias;
            }
        }

        this.renderer.shadowMap.enabled = enabled;

        console.log('?? Shadows configured:', enabled);
    }

    /**
     */
    async setHDREnvironment(hdrUrl) {
        try {
            const loader = new THREE.RGBELoader();
            const texture = await loader.loadAsync(hdrUrl);
            
            texture.mapping = THREE.EquirectangularReflectionMapping;
            this.scene.environment = texture;
            this.scene.background = texture;

            console.log('?? HDR environment set');
        } catch (error) {
            console.error('? HDR load error:', error);
        }
    }

    /**
     */
    updateLightingSettings(settings) {
        const {
            ambientIntensity,
            directionalIntensity,
            hemisphereIntensity,
            timeOfDay
        } = settings;

        if (ambientIntensity !== undefined && this.ambientLight) {
            this.ambientLight.intensity = ambientIntensity;
        }

        if (directionalIntensity !== undefined && this.directionalLight) {
            this.directionalLight.intensity = directionalIntensity;
        }

        if (hemisphereIntensity !== undefined && this.hemisphereLight) {
            this.hemisphereLight.intensity = hemisphereIntensity;
        }

        if (timeOfDay) {
            this.setTimeOfDay(timeOfDay);
        }

        console.log('?? Lighting settings updated');
    }

    /**
     */
    setLightingPreset(preset) {
        const presets = {
            bright: {
                ambientIntensity: 0.8,
                directionalIntensity: 1.0,
                hemisphereIntensity: 0.6,
                timeOfDay: 'day'
            },
            dim: {
                ambientIntensity: 0.3,
                directionalIntensity: 0.4,
                hemisphereIntensity: 0.2,
                timeOfDay: 'evening'
            },
            night: {
                ambientIntensity: 0.1,
                directionalIntensity: 0.0,
                hemisphereIntensity: 0.1,
                timeOfDay: 'night'
            },
            studio: {
                ambientIntensity: 0.6,
                directionalIntensity: 1.2,
                hemisphereIntensity: 0.4,
                timeOfDay: 'day'
            },
            natural: {
                ambientIntensity: 0.5,
                directionalIntensity: 0.8,
                hemisphereIntensity: 0.5,
                timeOfDay: 'morning'
            }
        };

        const presetSettings = presets[preset];
        if (presetSettings) {
            this.updateLightingSettings(presetSettings);
            console.log('?? Lighting preset applied:', preset);
        }
    }

    /**
     */
    animateLighting(from, to, duration = 2000) {
        const startTime = Date.now();
        const startValues = { ...from };

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = this._easeInOutCubic(progress);

            const currentValues = {};
            Object.keys(from).forEach(key => {
                currentValues[key] = startValues[key] + (to[key] - startValues[key]) * eased;
            });

            this.updateLightingSettings(currentValues);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        animate();
        console.log('?? Lighting animation started');
    }

    /**
     */
    getLightingInfo() {
        return {
            ambient: this.ambientLight ? {
                intensity: this.ambientLight.intensity,
                color: this.ambientLight.color.getHex()
            } : null,
            directional: this.directionalLight ? {
                intensity: this.directionalLight.intensity,
                color: this.directionalLight.color.getHex(),
                position: this.directionalLight.position,
                castShadow: this.directionalLight.castShadow
            } : null,
            hemisphere: this.hemisphereLight ? {
                intensity: this.hemisphereLight.intensity
            } : null,
            pointLights: this.lightingObjects.filter(l => l.isPointLight).length,
            spotLights: this.lightingObjects.filter(l => l.isSpotLight).length,
            areaLights: this.lightingObjects.filter(l => l.isRectAreaLight).length
        };
    }

    // ============================================
    // ============================================

    /**
     */
    addGlowEffect(object, options = {}) {
        const {
            color = 0xffffff,
            intensity = 1,
            distance = 5
        } = options;

        const glowLight = new THREE.PointLight(color, intensity, distance);
        glowLight.position.copy(object.position);
        object.add(glowLight);

        const spriteMaterial = new THREE.SpriteMaterial({
            color: color,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(distance, distance, 1);
        object.add(sprite);

        console.log('? Glow effect added');
    }

    /**
     */
    addReflectionEffect(object, options = {}) {
        const {
            envMap = null,
            metalness = 0.9,
            roughness = 0.1
        } = options;

        if (object.isMesh && object.material) {
            if (envMap) {
                object.material.envMap = envMap;
            }
            object.material.metalness = metalness;
            object.material.roughness = roughness;
            object.material.needsUpdate = true;

            console.log('?? Reflection effect added');
        }
    }

    /**
     */
    addTransparencyEffect(object, options = {}) {
        const {
            opacity = 0.5,
            transparent = true,
            transmission = 0.9
        } = options;

        if (object.isMesh && object.material) {
            object.material.transparent = transparent;
            object.material.opacity = opacity;

            if (object.material.isMeshPhysicalMaterial) {
                object.material.transmission = transmission;
            }

            object.material.needsUpdate = true;

            console.log('?? Transparency effect added');
        }
    }

    /**
     */
    createParticleSystem(options = {}) {
        const {
            count = 1000,
            size = 0.1,
            color = 0xffffff,
            position = { x: 0, y: 0, z: 0 },
            spread = { x: 5, y: 5, z: 5 }
        } = options;

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);

        for (let i = 0; i < count * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * spread.x + position.x;
            positions[i + 1] = (Math.random() - 0.5) * spread.y + position.y;
            positions[i + 2] = (Math.random() - 0.5) * spread.z + position.z;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: color,
            size: size,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        const particles = new THREE.Points(geometry, material);
        this.scene.add(particles);

        console.log('? Particle system created');
        return particles;
    }

    /**
     */
    animateParticles(particles, options = {}) {
        const {
            speed = 0.01,
            rotation = { x: 0, y: 0.01, z: 0 }
        } = options;

        const animate = () => {
            if (!particles) return;

            particles.rotation.x += rotation.x;
            particles.rotation.y += rotation.y;
            particles.rotation.z += rotation.z;

            requestAnimationFrame(animate);
        };

        animate();
        console.log('? Particle animation started');
    }
        // ============================================
    // ============================================

    /**
     */
    addFurniture(furnitureData) {
        const { type, position, rotation, dimensions } = furnitureData;

        const furniture = this._createFurnitureObject({
            type,
            position,
            rotation,
            dimensions
        });

        if (furniture) {
            this.scene.add(furniture);
            this.furnitureObjects.push(furniture);
            console.log('?? Furniture added:', type.name);
        }

        return furniture;
    }

    /**
     */
    removeFurniture(id) {
        const index = this.furnitureObjects.findIndex(obj => obj.userData.id === id);
        
        if (index > -1) {
            const furniture = this.furnitureObjects[index];
            this.scene.remove(furniture);
            this._disposeObject(furniture);
            this.furnitureObjects.splice(index, 1);
            console.log('??? Furniture removed:', id);
        }
    }

    /**
     */
    moveFurniture(id, newPosition) {
        const furniture = this.furnitureObjects.find(obj => obj.userData.id === id);
        
        if (furniture) {
            furniture.position.set(newPosition.x, newPosition.y, newPosition.z);
            console.log('?? Furniture moved:', id);
        }
    }

    /**
     */
    rotateFurniture(id, rotation) {
        const furniture = this.furnitureObjects.find(obj => obj.userData.id === id);
        
        if (furniture) {
            furniture.rotation.y = rotation * Math.PI / 180;
            console.log('?? Furniture rotated:', id);
        }
    }

    /**
     */
    getAllFurniture() {
        return this.furnitureObjects.map(obj => ({
            id: obj.userData.id,
            type: obj.userData.type,
            position: obj.position,
            rotation: obj.rotation.y * 180 / Math.PI
        }));
    }

    /**
     */
    clearAllFurniture() {
        this.furnitureObjects.forEach(obj => {
            this.scene.remove(obj);
            this._disposeObject(obj);
        });
        this.furnitureObjects = [];
        console.log('??? All furniture cleared');
    }

    /**
     */
    getAvailableFurnitureTypes() {
        return [
            { id: 'chair', name: '����', width: 50, height: 90, depth: 50, color: 0x8B7355 },
            { id: 'table', name: '����', width: 120, height: 75, depth: 80, color: 0x6B5344 },
            { id: 'cabinet', name: '����', width: 80, height: 200, depth: 60, color: 0x5C4A3D },
            { id: 'sofa', name: '�����', width: 200, height: 80, depth: 90, color: 0x4A5C6B },
            { id: 'plant', name: '��������', width: 40, height: 100, depth: 40, color: 0x228B22 },
            { id: 'lamp', name: '�����', width: 30, height: 150, depth: 30, color: 0xFFD700 },
            { id: 'bench', name: '��������', width: 150, height: 50, depth: 40, color: 0x8B7355 },
            { id: 'flowerpot', name: '��������� ������', width: 30, height: 40, depth: 30, color: 0xA0522D }
        ];
    }

    /**
     */
    createComplexFurniture(options) {
        const { type, position, rotation } = options;
        const group = new THREE.Group();

        switch (type) {
            case 'table_complex':
                this._createTableParts(group);
                break;
            case 'chair_complex':
                this._createChairParts(group);
                break;
            case 'shelf_complex':
                this._createShelfParts(group);
                break;
        }

        group.position.set(position.x, position.y, position.z);
        group.rotation.y = rotation * Math.PI / 180;
        group.userData = { element: 'furniture', type: type, isComplex: true };

        this.scene.add(group);
        this.furnitureObjects.push(group);

        return group;
    }

    /**
     * @private
     */
    _createTableParts(group) {
        const material = new THREE.MeshStandardMaterial({ color: 0x6B5344, roughness: 0.6 });

        const topGeometry = new THREE.BoxGeometry(1.2, 0.05, 0.8);
        const top = new THREE.Mesh(topGeometry, material);
        top.position.y = 0.75;
        top.castShadow = true;
        group.add(top);

        const legGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.75);
        const positions = [
            { x: -0.5, z: -0.3 },
            { x: 0.5, z: -0.3 },
            { x: -0.5, z: 0.3 },
            { x: 0.5, z: 0.3 }
        ];

        positions.forEach(pos => {
            const leg = new THREE.Mesh(legGeometry, material);
            leg.position.set(pos.x, 0.375, pos.z);
            leg.castShadow = true;
            group.add(leg);
        });
    }

    /**
     * @private
     */
    _createChairParts(group) {
        const material = new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.6 });

        const seatGeometry = new THREE.BoxGeometry(0.5, 0.05, 0.5);
        const seat = new THREE.Mesh(seatGeometry, material);
        seat.position.y = 0.45;
        seat.castShadow = true;
        group.add(seat);

        const backGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.05);
        const back = new THREE.Mesh(backGeometry, material);
        back.position.set(0, 0.7, -0.225);
        back.castShadow = true;
        group.add(back);

        const legGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.45);
        const positions = [
            { x: -0.2, z: -0.2 },
            { x: 0.2, z: -0.2 },
            { x: -0.2, z: 0.2 },
            { x: 0.2, z: 0.2 }
        ];

        positions.forEach(pos => {
            const leg = new THREE.Mesh(legGeometry, material);
            leg.position.set(pos.x, 0.225, pos.z);
            leg.castShadow = true;
            group.add(leg);
        });
    }

    /**
     * @private
     */
    _createShelfParts(group) {
        const material = new THREE.MeshStandardMaterial({ color: 0x5C4A3D, roughness: 0.6 });

        const shelfGeometry = new THREE.BoxGeometry(1, 0.03, 0.3);
        for (let i = 0; i < 4; i++) {
            const shelf = new THREE.Mesh(shelfGeometry, material);
            shelf.position.y = 0.15 + i * 0.6;
            shelf.castShadow = true;
            group.add(shelf);
        }

        const sideGeometry = new THREE.BoxGeometry(0.03, 2.4, 0.3);
        const leftSide = new THREE.Mesh(sideGeometry, material);
        leftSide.position.set(-0.485, 1.2, 0);
        group.add(leftSide);

        const rightSide = new THREE.Mesh(sideGeometry, material);
        rightSide.position.set(0.485, 1.2, 0);
        group.add(rightSide);
    }

    // ============================================
    // ============================================

    /**
     */
    updateWindowsConfig(options) {
        const {
            windowCount,
            windowStyle,
            frameColor,
            glassType
        } = options;

        if (windowCount) {
            this.builder.glazing.windowSections = windowCount;
        }

        if (frameColor) {
            this.windowFrameColor = frameColor;
        }

        if (glassType) {
            this.windowGlassType = glassType;
        }

        if (this.builder) {
            this._createWindows(this.builder.dimensions);
        }

        console.log('?? Windows config updated');
    }

    /**
     */
    createWindowWithBlinds(options) {
        const {
            width = 1,
            height = 1.5,
            slatCount = 10,
            color = 0xffffff,
            position = { x: 0, y: 0, z: 0 }
        } = options;

        const group = new THREE.Group();

        const slatGeometry = new THREE.BoxGeometry(width, 0.02, 0.05);
        const slatMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });

        for (let i = 0; i < slatCount; i++) {
            const slat = new THREE.Mesh(slatGeometry, slatMaterial);
            slat.position.y = height / 2 - (i + 0.5) * (height / slatCount);
            slat.position.z = 0.05;
            group.add(slat);
        }

        group.position.set(position.x, position.y, position.z);
        group.userData = { element: 'blinds', isOpen: false };

        this.scene.add(group);

        return group;
    }

    /**
     */
    toggleBlinds(blinds, isOpen) {
        blinds.children.forEach((slat, index) => {
            const targetRotation = isOpen ? Math.PI / 2 : 0;
            slat.rotation.x = targetRotation * (index / blinds.children.length);
        });

        blinds.userData.isOpen = isOpen;
        console.log('?? Blinds toggled:', isOpen);
    }

    /**
     */
    createWindowWithCurtains(options) {
        const {
            width = 1,
            height = 1.5,
            color = 0x4A5C6B,
            position = { x: 0, y: 0, z: 0 },
            isOpen = false
        } = options;

        const group = new THREE.Group();

        const curtainMaterial = new THREE.MeshStandardMaterial({
            color,
            roughness: 0.8,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9
        });

        const leftCurtainGeometry = new THREE.PlaneGeometry(width / 2, height);
        const leftCurtain = new THREE.Mesh(leftCurtainGeometry, curtainMaterial);
        leftCurtain.position.set(-width / 4, height / 2, 0.1);
        if (isOpen) leftCurtain.position.x = -width / 2;
        group.add(leftCurtain);

        const rightCurtainGeometry = new THREE.PlaneGeometry(width / 2, height);
        const rightCurtain = new THREE.Mesh(rightCurtainGeometry, curtainMaterial);
        rightCurtain.position.set(width / 4, height / 2, 0.1);
        if (isOpen) rightCurtain.position.x = width / 2;
        group.add(rightCurtain);

        const rodGeometry = new THREE.CylinderGeometry(0.02, 0.02, width);
        const rodMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 });
        const rod = new THREE.Mesh(rodGeometry, rodMaterial);
        rod.rotation.z = Math.PI / 2;
        rod.position.set(0, height, 0.1);
        group.add(rod);

        group.position.set(position.x, position.y, position.z);
        group.userData = { element: 'curtains', isOpen };

        this.scene.add(group);

        return group;
    }

    /**
     */
    toggleCurtains(curtains, isOpen) {
        curtains.children.forEach(child => {
            if (child.geometry.type === 'PlaneGeometry') {
                const offset = isOpen ? 0.25 : 0;
                if (child.position.x < 0) {
                    child.position.x = -0.25 + offset;
                } else {
                    child.position.x = 0.25 - offset;
                }
            }
        });

        curtains.userData.isOpen = isOpen;
        console.log('?? Curtains toggled:', isOpen);
    }

    /**
     */
    getAllWindows() {
        return this.windows.map((window, index) => ({
            index,
            name: window.name,
            type: window.userData.type,
            position: window.position
        }));
    }

    // ============================================
    // ============================================

    /**
     */
    createInteractiveMarker(options) {
        const {
            position = { x: 0, y: 0, z: 0 },
            color = 0xffa500,
            size = 0.1,
            label = '',
            onClick = null
        } = options;

        const geometry = new THREE.SphereGeometry(size, 16, 16);
        const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.8
        });
        const marker = new THREE.Mesh(geometry, material);
        marker.position.set(position.x, position.y, position.z);
        marker.userData = {
            element: label,
            isMarker: true,
            isInteractive: true,
            onClick: onClick
        };

        const ringGeometry = new THREE.RingGeometry(size * 1.2, size * 1.5, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.copy(position);
        ring.lookAt(this.camera.position);
        ring.userData = { element: label, isMarker: true, isRing: true };

        this.scene.add(marker, ring);
        this.markers.push(marker, ring);

        return marker;
    }

    /**
     */
    removeMarker(marker) {
        const index = this.markers.indexOf(marker);
        if (index > -1) {
            this.scene.remove(marker);
            this.markers.splice(index, 1);
            console.log('??? Marker removed');
        }
    }

    /**
     */
    clearAllMarkers() {
        this.markers.forEach(marker => {
            this.scene.remove(marker);
            if (marker.geometry) marker.geometry.dispose();
            if (marker.material) marker.material.dispose();
        });
        this.markers = [];
        console.log('??? All markers cleared');
    }

    /**
     */
    animateMarker(marker, options = {}) {
        const {
            pulse = true,
            rotate = true,
            speed = 1
        } = options;

        const animate = () => {
            if (!marker) return;

            if (pulse) {
                const scale = 1 + Math.sin(Date.now() * 0.002 * speed) * 0.2;
                marker.scale.set(scale, scale, scale);
            }

            if (rotate) {
                marker.rotation.y += 0.01 * speed;
            }

            requestAnimationFrame(animate);
        };

        animate();
    }

    /**
     */
    highlightMarker(marker, color = 0xffff00) {
        if (marker.material) {
            marker.material.color.setHex(color);
            marker.material.emissive.setHex(color);
            marker.material.emissiveIntensity = 0.5;
        }
    }

    /**
     */
    resetMarkerHighlight(marker, originalColor = 0xffa500) {
        if (marker.material) {
            marker.material.color.setHex(originalColor);
            marker.material.emissive.setHex(0x000000);
            marker.material.emissiveIntensity = 0;
        }
    }

    /**
     */
    getAllMarkers() {
        return this.markers.map(marker => ({
            position: marker.position,
            element: marker.userData.element,
            isInteractive: marker.userData.isInteractive
        }));
    }

    // ============================================
    // ============================================

    /**
     */
    measureDistance(point1, point2) {
        const distance = point1.distanceTo(point2);
        console.log('?? Distance:', distance.toFixed(2), 'm');
        return distance;
    }

    /**
     */
    showDimensions() {
        if (!this.builder) return;

        const { length, width, height } = this.builder.dimensions;

        console.log('?? Room dimensions:', {
            length: length + ' m',
            width: width + ' m',
            height: height + ' m',
            area: (length * width).toFixed(2) + ' m?',
            volume: (length * width * height).toFixed(2) + ' m?'
        });

        return {
            length,
            width,
            height,
            area: length * width,
            volume: length * width * height
        };
    }

    /**
     */
    createDimensionLine(start, end, label = '') {
        const group = new THREE.Group();

        const distance = start.distanceTo(end);
        const direction = new THREE.Vector3().subVectors(end, start).normalize();
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([start, end]);
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffff00 });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        group.add(line);

        const arrowHelper1 = new THREE.ArrowHelper(direction, start, 0.2, 0xffff00);
        const arrowHelper2 = new THREE.ArrowHelper(direction.clone().negate(), end, 0.2, 0xffff00);
        group.add(arrowHelper1);
        group.add(arrowHelper2);

        if (label) {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 256;
            canvas.height = 64;
            context.fillStyle = 'white';
            context.font = 'Bold 32px Arial';
            context.fillText(label, 0, 40);

            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(material);
            sprite.position.lerpVectors(start, end, 0.5);
            sprite.position.y += 0.3;
            sprite.scale.set(1, 0.25, 1);
            group.add(sprite);
        }

        this.scene.add(group);

        return group;
    }

    /**
     */
    clearDimensionLines() {
        const lines = this.scene.children.filter(child => child.type === 'Group');
        lines.forEach(line => {
            this.scene.remove(line);
        });
        console.log('??? Dimension lines cleared');
    }

    /**
     */
    getSceneInfo() {
        return {
            totalObjects: this.scene.children.length,
            balconyObjects: this.balconyGroup?.children.length || 0,
            walls: Object.keys(this.walls).length,
            windows: this.windows.length,
            furniture: this.furnitureObjects.length,
            lights: this.lightingObjects.length,
            markers: this.markers.length,
            memory: {
                geometries: this.renderer.info.memory.geometries,
                textures: this.renderer.info.memory.textures
            },
            render: {
                calls: this.renderer.info.render.calls,
                triangles: this.renderer.info.render.triangles
            }
        };
    }

    /**
     */
    exportToOBJ() {
        let obj = '# BalconyPro 3D Model\n\n';

        this.balconyGroup?.traverse((child) => {
            if (child.isMesh) {
                obj += `o ${child.name}\n`;
                
                const positions = child.geometry.attributes.position.array;
                for (let i = 0; i < positions.length; i += 3) {
                    obj += `v ${positions[i]} ${positions[i + 1]} ${positions[i + 2]}\n`;
                }

                obj += '\n';
            }
        });

        console.log('?? Exported to OBJ format');
        return obj;
    }

    /**
     */
    saveSceneToFile(filename = 'balcony', format = 'json') {
        let content = '';
        let mimeType = 'application/json';

        if (format === 'json') {
            content = JSON.stringify(this.exportSceneState());
        } else if (format === 'obj') {
            content = this.exportToOBJ();
            mimeType = 'model/obj';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `${filename}.${format}`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);

        console.log('?? Scene saved:', filename, format);
    }

    /**
     */
    toggleMeasurementMode(enable) {
        this.state.measurementMode = enable;

        if (enable) {
            this.renderer.domElement.style.cursor = 'crosshair';
            console.log('?? Measurement mode enabled');
        } else {
            this.renderer.domElement.style.cursor = 'default';
            console.log('?? Measurement mode disabled');
        }
    }

    /**
     */
    enablePresentationMode() {
        this.toggleGrid(false);
        this.toggleAxes(false);
        this.setQuality('high');
        this.setTimeOfDay('day');
        this.configureShadows({ enabled: true, mapSize: 4096 });

        console.log('?? Presentation mode enabled');
    }

    /**
     */
    disablePresentationMode() {
        this.toggleGrid(this.state.showGrid);
        this.toggleAxes(this.state.showAxes);
        this.setQuality('medium');

        console.log('?? Presentation mode disabled');
    }

    /**
     */
    togglePresentationMode() {
        if (this.state.presentationMode) {
            this.disablePresentationMode();
        } else {
            this.enablePresentationMode();
        }

        this.state.presentationMode = !this.state.presentationMode;
    }

    /**
     */
    createCheckpoint(position, label = '') {
        const geometry = new THREE.OctahedronGeometry(0.15);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            wireframe: true
        });
        const checkpoint = new THREE.Mesh(geometry, material);
        checkpoint.position.set(position.x, position.y, position.z);
        checkpoint.userData = { element: 'checkpoint', label };

        this.scene.add(checkpoint);

        return checkpoint;
    }

    /**
     */
    goToCheckpoint(checkpoint, duration = 1000) {
        const targetPos = checkpoint.position.clone();
        targetPos.y += 1.7;

        this._animateCamera(
            { x: targetPos.x, y: targetPos.y, z: targetPos.z },
            { x: checkpoint.position.x, y: checkpoint.position.y, z: checkpoint.position.z },
            duration
        );

        console.log('?? Going to checkpoint:', checkpoint.userData.label);
    }
        // ============================================
    // ============================================

    /**
     */
    static createPreset(preset) {
        const presets = {
            'default': {
                width: 800,
                height: 600,
                backgroundColor: 0x87ceeb,
                quality: {
                    antialias: true,
                    shadowMap: true,
                    pixelRatio: Math.min(window.devicePixelRatio, 2)
                }
            },
            'mobile': {
                width: window.innerWidth,
                height: window.innerHeight,
                backgroundColor: 0x87ceeb,
                quality: {
                    antialias: false,
                    shadowMap: false,
                    pixelRatio: 1
                },
                controls: {
                    enableRotate: true,
                    enableZoom: true,
                    enablePan: false,
                    minDistance: 1,
                    maxDistance: 15
                }
            },
            'desktop': {
                width: 1200,
                height: 800,
                backgroundColor: 0x87ceeb,
                quality: {
                    antialias: true,
                    shadowMap: true,
                    pixelRatio: Math.min(window.devicePixelRatio, 2)
                },
                controls: {
                    enableRotate: true,
                    enableZoom: true,
                    enablePan: true,
                    minDistance: 2,
                    maxDistance: 20
                }
            },
            'low-end': {
                width: 640,
                height: 480,
                backgroundColor: 0x87ceeb,
                quality: {
                    antialias: false,
                    shadowMap: false,
                    pixelRatio: 1
                }
            },
            'high-end': {
                width: 1920,
                height: 1080,
                backgroundColor: 0x87ceeb,
                quality: {
                    antialias: true,
                    shadowMap: true,
                    pixelRatio: 2
                }
            },
            'vr': {
                width: 2160,
                height: 1200,
                backgroundColor: 0x87ceeb,
                quality: {
                    antialias: true,
                    shadowMap: true,
                    pixelRatio: 1.5
                },
                camera: {
                    fov: 90,
                    near: 0.1,
                    far: 1000
                }
            }
        };

        return presets[preset] || presets.default;
    }

    /**
     */
    static getAvailablePresets() {
        return ['default', 'mobile', 'desktop', 'low-end', 'high-end', 'vr'];
    }

    /**
     */
    applyPreset(preset) {
        const presetConfig = this.constructor.createPreset(preset);
        Object.assign(this.config, presetConfig);
        console.log('? Preset applied:', preset);
    }

    /**
     */
    saveAsPreset(name) {
        const config = this.cloneConfig();
        
        if (!this.userPresets) {
            this.userPresets = {};
        }
        
        this.userPresets[name] = config;
        
        try {
            localStorage.setItem('balcony_user_presets', JSON.stringify(this.userPresets));
            console.log('?? Preset saved:', name);
        } catch (error) {
            console.error('? Failed to save preset:', error);
        }
    }

    /**
     */
    loadUserPresets() {
        try {
            const saved = localStorage.getItem('balcony_user_presets');
            if (saved) {
                this.userPresets = JSON.parse(saved);
                console.log('?? User presets loaded:', Object.keys(this.userPresets).length);
            }
        } catch (error) {
            console.error('? Failed to load user presets:', error);
        }
    }

    /**
     */
    getAllPresets() {
        return {
            system: this.constructor.getAvailablePresets(),
            user: Object.keys(this.userPresets || {})
        };
    }

    /**
     */
    deleteUserPreset(name) {
        if (this.userPresets && this.userPresets[name]) {
            delete this.userPresets[name];
            
            try {
                localStorage.setItem('balcony_user_presets', JSON.stringify(this.userPresets));
                console.log('??? Preset deleted:', name);
            } catch (error) {
                console.error('? Failed to delete preset:', error);
            }
        }
    }

    // ============================================
    // ============================================

    /**
     */
    initPluginSystem() {
        this.plugins = {};
        this.pluginHooks = {
            onInit: [],
            onBeforeRender: [],
            onAfterRender: [],
            onUpdate: [],
            onDispose: []
        };
        console.log('?? Plugin system initialized');
    }

    /**
     */
    registerPlugin(name, plugin) {
        if (!this.plugins) {
            this.initPluginSystem();
        }

        this.plugins[name] = plugin;

        if (plugin.hooks) {
            Object.entries(plugin.hooks).forEach(([hookName, callback]) => {
                if (this.pluginHooks[hookName]) {
                    this.pluginHooks[hookName].push(callback);
                }
            });
        }

        if (plugin.init) {
            plugin.init(this);
        }

        console.log('?? Plugin registered:', name);

        this._triggerHook('onInit', { pluginName: name });
    }

    /**
     * @private
     */
    _triggerHook(hookName, data = {}) {
        if (this.pluginHooks[hookName]) {
            this.pluginHooks[hookName].forEach(callback => {
                try {
                    callback(data, this);
                } catch (error) {
                    console.error(`? Error in ${hookName} hook:`, error);
                }
            });
        }
    }

    /**
     */
    getPlugin(name) {
        return this.plugins?.[name] || null;
    }

    /**
     */
    unregisterPlugin(name) {
        if (this.plugins?.[name]) {
            const plugin = this.plugins[name];

            if (plugin.dispose) {
                plugin.dispose();
            }

            if (plugin.hooks) {
                Object.entries(plugin.hooks).forEach(([hookName, callback]) => {
                    if (this.pluginHooks[hookName]) {
                        this.pluginHooks[hookName] = this.pluginHooks[hookName].filter(cb => cb !== callback);
                    }
                });
            }

            delete this.plugins[name];
            console.log('?? Plugin unregistered:', name);
        }
    }

    /**
     */
    getPlugins() {
        return Object.keys(this.plugins || {});
    }

    /**
     */
    togglePlugin(name, enabled) {
        const plugin = this.getPlugin(name);
        if (plugin) {
            plugin.enabled = enabled;
            console.log(`?? Plugin ${name} ${enabled ? 'enabled' : 'disabled'}`);
        }
    }

    /**
     */
    getPluginInfo(name) {
        const plugin = this.getPlugin(name);
        if (plugin) {
            return {
                name: plugin.name || name,
                version: plugin.version || '1.0.0',
                author: plugin.author || 'Unknown',
                description: plugin.description || '',
                enabled: plugin.enabled !== false,
                hooks: Object.keys(plugin.hooks || {})
            };
        }
        return null;
    }

    /**
     */
    async loadPluginFromURL(url) {
        try {
            const response = await fetch(url);
            const pluginCode = await response.text();
            
            const pluginModule = eval(`(${pluginCode})`);
            
            const name = pluginModule.name || `plugin_${Date.now()}`;
            this.registerPlugin(name, pluginModule);
            
            console.log('?? Plugin loaded from URL:', url);
            return pluginModule;
        } catch (error) {
            console.error('? Failed to load plugin from URL:', error);
            throw error;
        }
    }

    // ============================================
    // ============================================

    /**
     */
    integrateWithStore(store) {
        this.store = store;

        if (store.subscribe) {
            store.subscribe(() => {
                const state = store.getState();
                if (state.balcony) {
                    this._syncWithStore(state.balcony);
                }
            });
        }

        this.subscribe('onObjectClick', (data, point) => {
            if (store.dispatch) {
                store.dispatch({
                    type: 'BALCONY_OBJECT_CLICK',
                    payload: { data, point }
                });
            }
        });

        console.log('?? Integrated with store');
    }

    /**
     * @private
     */
    _syncWithStore(balconyState) {
        if (balconyState.dimensions && this.builder) {
            this.builder.dimensions = balconyState.dimensions;
            this.update();
        }

        if (balconyState.materials) {
            Object.entries(balconyState.materials).forEach(([element, material]) => {
                this.applyMaterial(element, material);
            });
        }
    }

    /**
     */
    integrateWithAnalytics(analytics) {
        this.analytics = analytics;

        this.subscribe('onLoad', () => {
            analytics?.track('visualizer_loaded', {
                timestamp: Date.now(),
                version: '3.0.0'
            });
        });

        this.subscribe('onObjectClick', (data) => {
            analytics?.track('object_clicked', {
                element: data.element,
                timestamp: Date.now()
            });
        });

        this.subscribe('onPlacement', (type) => {
            analytics?.track('object_placed', {
                type,
                timestamp: Date.now()
            });
        });

        console.log('?? Integrated with analytics');
    }

    /**
     */
    exportForCRM() {
        return {
            customer: {
            },
            balcony: {
                dimensions: this.builder?.dimensions,
                materials: this._exportMaterials(),
                furniture: this.getAllFurniture(),
                lighting: this.getLightingInfo(),
                totalCost: this.builder?.calculateTotal?.() || 0
            },
            timestamp: new Date().toISOString(),
            sessionId: this._generateSessionId()
        };
    }

    /**
     * @private
     */
    _exportMaterials() {
        return {
            floor: this.floor?.material?.color?.getHex(),
            ceiling: this.ceiling?.material?.color?.getHex(),
            walls: Object.entries(this.walls).reduce((acc, [name, wall]) => {
                acc[name] = wall.material?.color?.getHex();
                return acc;
            }, {})
        };
    }

    /**
     * @private
     */
    _generateSessionId() {
        return 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    /**
     */
    async sendToServer(endpoint, data) {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const result = await response.json();
            console.log('?? Data sent to server:', endpoint);
            return result;
        } catch (error) {
            console.error('? Failed to send data to server:', error);
            throw error;
        }
    }

    /**
     */
    async saveProjectToServer(endpoint = '/api/projects/save') {
        const projectData = this.exportForCRM();
        return this.sendToServer(endpoint, projectData);
    }

    /**
     */
    async loadProjectFromServer(projectId, endpoint = '/api/projects/load') {
        try {
            const response = await fetch(`${endpoint}?id=${projectId}`);
            const projectData = await response.json();

            if (projectData.balcony) {
                this.importSceneState(projectData.balcony);
            }

            console.log('?? Project loaded:', projectId);
            return projectData;
        } catch (error) {
            console.error('? Failed to load project:', error);
            throw error;
        }
    }

    // ============================================
    // ============================================

    /**
     */
    initWorker(workerPath) {
        if (typeof Worker !== 'undefined') {
            this.worker = new Worker(workerPath);
            
            this.worker.onmessage = (event) => {
                this._handleWorkerMessage(event.data);
            };

            this.worker.onerror = (error) => {
                console.error('? Worker error:', error);
            };

            console.log('?? Worker initialized');
        }
    }

    /**
     * @private
     */
    _handleWorkerMessage(data) {
        switch (data.type) {
            case 'CALCULATION_COMPLETE':
                console.log('? Calculation complete:', data.result);
                break;
            case 'PROGRESS':
                console.log('?? Progress:', data.progress + '%');
                break;
            case 'ERROR':
                console.error('? Worker error:', data.error);
                break;
        }
    }

    /**
     */
    sendToWorker(type, data) {
        if (this.worker) {
            this.worker.postMessage({ type, data });
        }
    }

    /**
     */
    async performHeavyCalculation(calculationData) {
        return new Promise((resolve, reject) => {
            if (!this.worker) {
                console.warn('?? Worker not initialized, calculating in main thread');
                resolve(this._performCalculationInMainThread(calculationData));
                return;
            }

            const messageId = 'calc_' + Date.now();

            const handler = (event) => {
                if (event.data.id === messageId) {
                    this.worker.removeEventListener('message', handler);
                    
                    if (event.data.error) {
                        reject(new Error(event.data.error));
                    } else {
                        resolve(event.data.result);
                    }
                }
            };

            this.worker.addEventListener('message', handler);
            this.worker.postMessage({
                id: messageId,
                type: 'HEAVY_CALCULATION',
                data: calculationData
            });

            setTimeout(() => {
                this.worker.removeEventListener('message', handler);
                reject(new Error('Calculation timeout'));
            }, 30000);
        });
    }

    /**
     * @private
     */
    _performCalculationInMainThread(data) {
        return {
            success: true,
            result: data
        };
    }

    /**
     */
    terminateWorker() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
            console.log('?? Worker terminated');
        }
    }

    // ============================================
    // ============================================

    /**
     */
    initPWA() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('?? SW registered:', registration.scope);
                    this._setupSWCommunication(registration);
                })
                .catch(error => {
                    console.log('?? SW registration failed:', error);
                });
        }

        window.addEventListener('online', () => this._handleOnline());
        window.addEventListener('offline', () => this._handleOffline());

        this._setupAddToHomeScreen();

        console.log('?? PWA features initialized');
    }

    /**
     * @private
     */
    _setupSWCommunication(registration) {
        registration.active.postMessage({
            type: 'INITIALIZE',
            visualizerVersion: '3.0.0'
        });

        navigator.serviceWorker.addEventListener('message', (event) => {
            this._handleSWMessage(event.data);
        });
    }

    /**
     * @private
     */
    _handleSWMessage(data) {
        switch (data.type) {
            case 'CACHE_UPDATED':
                console.log('?? Cache updated:', data.cacheName);
                break;
            case 'OFFLINE_READY':
                console.log('?? Offline mode ready');
                this._showNotification('���������� ������ � ������ ������', 'info');
                break;
        }
    }

    /**
     * @private
     */
    _handleOnline() {
        console.log('?? Online');
        this._showNotification('���������� �������������', 'success');
        
        this._syncOfflineData();
    }

    /**
     * @private
     */
    _handleOffline() {
        console.log('?? Offline');
        this._showNotification('������ � ������ ������', 'warning');
    }

    /**
     * @private
     */
    _setupAddToHomeScreen() {
        let deferredPrompt;

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            this._showInstallPrompt();
        });

        window.addEventListener('appinstalled', () => {
            console.log('?? PWA installed');
            deferredPrompt = null;
        });
    }

    /**
     * @private
     */
    _showInstallPrompt() {
        const installButton = document.createElement('button');
        installButton.textContent = '?? ���������� ����������';
        installButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 15px 25px;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            z-index: 10000;
        `;

        installButton.addEventListener('click', async () => {
            console.log('?? Install prompt shown');
        });

        document.body.appendChild(installButton);
    }

    /**
     * @private
     */
    async _syncOfflineData() {
        console.log('?? Syncing offline data...');
    }

    /**
     */
    async cacheResources(urls) {
        if ('caches' in window) {
            const cache = await caches.open('balcony-pro-v1');
            await cache.addAll(urls);
            console.log('?? Resources cached:', urls.length);
        }
    }

    // ============================================
    // ============================================

    /**
     */
    getFullInfo() {
        return {
            version: '3.0.0',
            containerId: this.config.containerId,
            isReady: this.isReady(),
            isActive: this.isActive(),
            dimensions: this.builder?.dimensions || null,
            stats: this.getSceneStats(),
            renderStats: this.getRenderStats(),
            fps: this.getFPS(),
            lighting: this.getLightingInfo(),
            furniture: this.getAllFurniture(),
            windows: this.getAllWindows(),
            markers: this.getAllMarkers(),
            plugins: this.getPlugins(),
            presets: this.getAllPresets(),
            webGL: this.getWebGLInfo()
        };
    }

    /**
     */
    exportFullConfig() {
        return {
            version: '3.0.0',
            config: this.cloneConfig(),
            scene: this.exportSceneState(),
            materials: this._exportMaterials(),
            furniture: this.getAllFurniture(),
            lighting: this.getLightingInfo(),
            presets: this.userPresets || {},
            timestamp: new Date().toISOString()
        };
    }

    /**
     */
    importFullConfig(config) {
        if (config.config) {
            Object.assign(this.config, config.config);
        }

        if (config.scene) {
            this.importSceneState(config.scene);
        }

        if (config.presets) {
            this.userPresets = config.presets;
        }

        console.log('? Full configuration imported');
    }

    /**
     */
    factoryReset() {
        this.dispose();
        
        this.config = {
            containerId: this.config.containerId,
            width: 800,
            height: 600,
            backgroundColor: 0x87ceeb,
            gridColor: 0xcccccc,
            axisColors: { x: 0xff0000, y: 0x00ff00, z: 0x0000ff },
            camera: {
                fov: 60,
                near: 0.1,
                far: 1000,
                position: { x: 0, y: 1.7, z: 0 },
                initialLookAt: { x: 0, y: 1.5, z: 2 }
            },
            lighting: {
                ambient: 0.6,
                directional: 0.8,
                hemisphere: 0.4,
                interior: 0.5
            },
            controls: {
                enableRotate: true,
                enableZoom: true,
                enablePan: false,
                minDistance: 0.5,
                maxDistance: 10,
                rotateSpeed: 0.5,
                zoomSpeed: 1.2
            },
            quality: {
                antialias: true,
                shadowMap: true,
                pixelRatio: Math.min(window.devicePixelRatio, 2)
            },
            exterior: {
                enabled: true,
                distance: 50,
                skyColor: 0x87ceeb,
                groundColor: 0x3d5c5c,
                showBuildings: true,
                showTrees: true,
                timeOfDay: 'day'
            }
        };

        this.state = {
            isLoaded: false,
            isAnimating: false,
            placementMode: null,
            selectedElement: null,
            viewMode: 'interior',
            showGrid: false,
            showAxes: false,
            showWireframe: false,
            isFullscreen: false,
            currentBalconyType: 'loggia-3',
            materialsLoaded: false,
            exteriorLoaded: false
        };

        this.plugins = {};
        this.userPresets = {};

        this.init();
        console.log('?? Factory reset completed');
    }

    /**
     */
    static getLicenseInfo() {
        return {
            type: 'MIT',
            author: 'BalconyPro Team',
            year: 2024,
            url: 'https://opensource.org/licenses/MIT',
            permissions: [
                'Commercial use',
                'Modification',
                'Distribution',
                'Private use'
            ],
            limitations: [
                'Liability',
                'Warranty'
            ]
        };
    }

    /**
     */
    static showProjectInfo() {
        console.log('%c?? BalconyPro Visualizer', 'font-size: 24px; font-weight: bold; color: #2563eb;');
        console.log('%cVersion 3.0.0 ULTIMATE', 'font-size: 14px; color: #6b7280;');
        console.log('%cBuilt with Three.js r' + (typeof THREE !== 'undefined' ? THREE.REVISION : 'unknown'), 'font-size: 12px; color: #9ca3af;');
        console.log('%c� 2024 BalconyPro Team. MIT License.', 'font-size: 10px; color: #d1d5db;');
        console.log('');
        console.log('?? Documentation: https://balconypro.ru/docs');
        console.log('?? Issues: https://github.com/balconypro/visualizer/issues');
        console.log('?? Support: support@balconypro.ru');
    }

    /**
     */
    static async checkForUpdates() {
        try {
            const response = await fetch('https://api.balconypro.ru/version');
            const data = await response.json();
            
            const currentVersion = '3.0.0';
            const latestVersion = data.version;
            
            return {
                current: currentVersion,
                latest: latestVersion,
                hasUpdate: latestVersion !== currentVersion,
                changelog: data.changelog
            };
        } catch (error) {
            console.error('Failed to check for updates:', error);
            return null;
        }
    }

    /**
     */
    registerInGlobalRegistry() {
        if (!window.BalconyProRegistry) {
            window.BalconyProRegistry = {
                visualizers: [],
                getVisualizerById: (id) => {
                    return window.BalconyProRegistry.visualizers.find(v => v.config.containerId === id);
                },
                getAllVisualizers: () => {
                    return window.BalconyProRegistry.visualizers;
                },
                count: () => {
                    return window.BalconyProRegistry.visualizers.length;
                }
            };
        }
        
        window.BalconyProRegistry.visualizers.push(this);
        console.log('?? Registered in global registry. Total visualizers:', 
            window.BalconyProRegistry.count());
    }

    /**
     */
    unregisterFromGlobalRegistry() {
        if (window.BalconyProRegistry) {
            const index = window.BalconyProRegistry.visualizers.indexOf(this);
            if (index > -1) {
                window.BalconyProRegistry.visualizers.splice(index, 1);
                console.log('?? Unregistered from global registry. Remaining visualizers:', 
                    window.BalconyProRegistry.count());
            }
        }
    }

    /**
     */
    getId() {
        return this.config.containerId + '_' + Date.now();
    }

    /**
     */
    clone(newContainerId) {
        const config = this.cloneConfig();
        config.containerId = newContainerId;
        
        const cloned = new BalconyVisualizer(newContainerId, config);
        
        cloned.builder = this.builder;
        cloned.userPresets = { ...this.userPresets };
        
        return cloned;
    }

    /**
     */
    compareWith(other) {
        return this.constructor.compareConfigs(this.config, other.config);
    }

    /**
     */
    mergeWith(other) {
        this.userPresets = {
            ...this.userPresets,
            ...other.userPresets
        };

        if (other.plugins) {
            Object.entries(other.plugins).forEach(([name, plugin]) => {
                if (!this.plugins?.[name]) {
                    this.registerPlugin(name, plugin);
                }
            });
        }

        console.log('?? Merged with another visualizer');
    }

    /**
     */
    destroy() {
        console.log('?? Destroying visualizer...');
        
        this.unregisterFromGlobalRegistry();
        
        this.clearCallbacks();
        
        this.stopAnimation();
        
        this.terminateWorker();
        
        this.dispose();
        
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.balconyGroup = null;
        this.builder = null;
        this.container = null;
        this.plugins = null;
        this.userPresets = null;
        
        console.log('? Visualizer destroyed successfully');
    }
}

// Переопределения после восстановления кодировки: русские подписи и уведомления.
BalconyVisualizer.prototype.getAvailableMaterials = function() {
    return [
        { id: 'wood', name: 'Дерево', type: 'texture' },
        { id: 'tile', name: 'Плитка', type: 'texture' },
        { id: 'laminate', name: 'Ламинат', type: 'texture' },
        { id: 'concrete', name: 'Бетон', type: 'texture' },
        { id: 'brick', name: 'Кирпич', type: 'texture' },
        { id: 'paint', name: 'Краска', type: 'color' },
        { id: 'plaster', name: 'Штукатурка', type: 'texture' },
        { id: 'metal', name: 'Металл', type: 'texture' },
        { id: 'glass', name: 'Стекло', type: 'special' },
        { id: 'carpet', name: 'Ковролин', type: 'texture' }
    ];
};

BalconyVisualizer.prototype.getAvailableFurnitureTypes = function() {
    return [
        { id: 'chair', name: 'Стул', width: 50, height: 90, depth: 50, color: 0x8B7355 },
        { id: 'table', name: 'Стол', width: 120, height: 75, depth: 80, color: 0x6B5344 },
        { id: 'cabinet', name: 'Шкаф', width: 80, height: 200, depth: 60, color: 0x5C4A3D },
        { id: 'sofa', name: 'Диван', width: 200, height: 80, depth: 90, color: 0x4A5C6B },
        { id: 'plant', name: 'Растение', width: 40, height: 100, depth: 40, color: 0x228B22 },
        { id: 'lamp', name: 'Лампа', width: 30, height: 150, depth: 30, color: 0xFFD700 },
        { id: 'bench', name: 'Скамейка', width: 150, height: 50, depth: 40, color: 0x8B7355 },
        { id: 'flowerpot', name: 'Цветочный горшок', width: 30, height: 40, depth: 30, color: 0xA0522D }
    ];
};

BalconyVisualizer.prototype.exportScreenshot = function(filename = 'balcony.png') {
    const dataUrl = this.takeScreenshot();
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();

    console.log('Screenshot exported:', filename);
    this._showNotification('Скриншот сохранён!', 'success');
};

BalconyVisualizer.prototype.capture360 = async function() {
    const images = [];
    const angles = [0, 90, 180, 270];
    const originalRotation = this.camera.rotation.y;

    for (const angle of angles) {
        this.camera.rotation.y = angle * Math.PI / 180;
        this.renderer.render(this.scene, this.camera);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        images.push(this.renderer.domElement.toDataURL('image/png'));
    }

    this.camera.rotation.y = originalRotation;
    console.log('360° capture completed:', images.length, 'images');
    return images;
};

BalconyVisualizer.prototype._handleSWMessage = function(data) {
    switch (data.type) {
        case 'CACHE_UPDATED':
            console.log('Cache updated:', data.cacheName);
            break;
        case 'OFFLINE_READY':
            console.log('Offline mode ready');
            this._showNotification('Офлайн-режим готов к работе', 'info');
            break;
    }
};

BalconyVisualizer.prototype._handleOnline = function() {
    console.log('Online');
    this._showNotification('Подключение восстановлено', 'success');
    this._syncOfflineData();
};

BalconyVisualizer.prototype._handleOffline = function() {
    console.log('Offline');
    this._showNotification('Работа в офлайн-режиме', 'warning');
};

BalconyVisualizer.prototype._showInstallPrompt = function() {
    const installButton = document.createElement('button');
    installButton.textContent = 'Установить приложение';
    installButton.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 15px 25px;
        background: #2563eb;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        z-index: 9999;
        box-shadow: 0 8px 24px rgba(0,0,0,.25);
    `;
    installButton.addEventListener('click', () => installButton.remove(), { once: true });
    document.body.appendChild(installButton);
};

// Lightweight local fallback so the viewer keeps working without CDN OrbitControls.
if (typeof THREE !== 'undefined' && typeof THREE.OrbitControls === 'undefined') {
    function SimpleOrbitControls(camera, domElement) {
        THREE.EventDispatcher.call(this);

        this.camera = camera;
        this.domElement = domElement;
        this.target = new THREE.Vector3();

        this.enableRotate = true;
        this.enableZoom = true;
        this.enablePan = false;
        this.enableDamping = false;
        this.dampingFactor = 0.05;
        this.rotateSpeed = 1;
        this.zoomSpeed = 1;
        this.minDistance = 0.1;
        this.maxDistance = Infinity;
        this.minPolarAngle = 0;
        this.maxPolarAngle = Math.PI;
        this.screenSpacePanning = false;

        this._dragging = false;
        this._pointer = new THREE.Vector2();
        this._spherical = new THREE.Spherical();
        this._sphericalDelta = new THREE.Spherical(0, 0, 0);
        this._scale = 1;
        this._lastPosition = this.camera.position.clone();
        this._lastTarget = this.target.clone();

        this._startEvent = { type: 'start' };
        this._changeEvent = { type: 'change' };
        this._endEvent = { type: 'end' };

        this._onPointerDown = this._handlePointerDown.bind(this);
        this._onPointerMove = this._handlePointerMove.bind(this);
        this._onPointerUp = this._handlePointerUp.bind(this);
        this._onWheel = this._handleWheel.bind(this);

        this.domElement.addEventListener('pointerdown', this._onPointerDown);
        window.addEventListener('pointermove', this._onPointerMove);
        window.addEventListener('pointerup', this._onPointerUp);
        this.domElement.addEventListener('wheel', this._onWheel, { passive: false });
    }

    SimpleOrbitControls.prototype = Object.create(THREE.EventDispatcher.prototype);
    SimpleOrbitControls.prototype.constructor = SimpleOrbitControls;

    SimpleOrbitControls.prototype.dispose = function() {
        this.domElement.removeEventListener('pointerdown', this._onPointerDown);
        window.removeEventListener('pointermove', this._onPointerMove);
        window.removeEventListener('pointerup', this._onPointerUp);
        this.domElement.removeEventListener('wheel', this._onWheel);
    };

    SimpleOrbitControls.prototype.rotateLeft = function(angle) {
        if (!this.enableRotate) return;
        this._sphericalDelta.theta -= angle;
    };

    SimpleOrbitControls.prototype.rotateRight = function(angle) {
        this.rotateLeft(-angle);
    };

    SimpleOrbitControls.prototype.rotateUp = function(angle) {
        if (!this.enableRotate) return;
        this._sphericalDelta.phi -= angle;
    };

    SimpleOrbitControls.prototype._handlePointerDown = function(event) {
        if (!this.enableRotate || event.button !== 0) return;

        this._dragging = true;
        this._pointer.set(event.clientX, event.clientY);
        this.dispatchEvent(this._startEvent);
    };

    SimpleOrbitControls.prototype._handlePointerMove = function(event) {
        if (!this._dragging) return;

        const width = Math.max(this.domElement.clientWidth, 1);
        const height = Math.max(this.domElement.clientHeight, 1);
        const deltaX = event.clientX - this._pointer.x;
        const deltaY = event.clientY - this._pointer.y;

        this._pointer.set(event.clientX, event.clientY);
        this.rotateLeft((deltaX / width) * Math.PI * this.rotateSpeed);
        this.rotateUp((deltaY / height) * Math.PI * this.rotateSpeed);
    };

    SimpleOrbitControls.prototype._handlePointerUp = function() {
        if (!this._dragging) return;

        this._dragging = false;
        this.dispatchEvent(this._endEvent);
    };

    SimpleOrbitControls.prototype._handleWheel = function(event) {
        if (!this.enableZoom) return;

        event.preventDefault();
        const zoomStep = Math.pow(0.95, this.zoomSpeed);
        this._scale *= event.deltaY < 0 ? 1 / zoomStep : zoomStep;
        this.dispatchEvent(this._startEvent);
        this.dispatchEvent(this._endEvent);
    };

    SimpleOrbitControls.prototype.update = function() {
        const offset = this.camera.position.clone().sub(this.target);
        if (offset.lengthSq() === 0) {
            offset.set(0, 0, Math.max(this.minDistance, 1));
        }

        this._spherical.setFromVector3(offset);

        const deltaTheta = this.enableDamping
            ? this._sphericalDelta.theta * this.dampingFactor
            : this._sphericalDelta.theta;
        const deltaPhi = this.enableDamping
            ? this._sphericalDelta.phi * this.dampingFactor
            : this._sphericalDelta.phi;
        const nextScale = this.enableDamping
            ? 1 + ((this._scale - 1) * this.dampingFactor)
            : this._scale;

        this._spherical.theta += deltaTheta;
        this._spherical.phi = THREE.MathUtils.clamp(
            this._spherical.phi + deltaPhi,
            this.minPolarAngle + 0.0001,
            this.maxPolarAngle - 0.0001
        );
        this._spherical.radius = THREE.MathUtils.clamp(
            this._spherical.radius * nextScale,
            this.minDistance,
            this.maxDistance
        );

        offset.setFromSpherical(this._spherical);
        this.camera.position.copy(this.target).add(offset);
        this.camera.lookAt(this.target);

        if (this.enableDamping) {
            this._sphericalDelta.theta *= 1 - this.dampingFactor;
            this._sphericalDelta.phi *= 1 - this.dampingFactor;
            this._scale += (1 - this._scale) * this.dampingFactor;
        } else {
            this._sphericalDelta.theta = 0;
            this._sphericalDelta.phi = 0;
            this._scale = 1;
        }

        if (Math.abs(this._scale - 1) < 0.0001) {
            this._scale = 1;
        }

        const changed = this._lastPosition.distanceToSquared(this.camera.position) > 0.0000001 ||
            this._lastTarget.distanceToSquared(this.target) > 0.0000001;

        if (changed) {
            this._lastPosition.copy(this.camera.position);
            this._lastTarget.copy(this.target);
            this.dispatchEvent(this._changeEvent);
        }

        return changed;
    };

    THREE.OrbitControls = SimpleOrbitControls;
}

// ============================================
// ============================================
let balconyVisualizer = null;

// ============================================
// ============================================
(function initVisualizerModule() {
    console.log('?? BalconyVisualizer module loaded');
    console.log('?? Three.js version:', typeof THREE !== 'undefined' ? THREE.REVISION : 'not loaded');
    console.log('?? BalconyPro Visualizer v3.0.0 ULTIMATE');
})();

// ============================================
// ============================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BalconyVisualizer, balconyVisualizer };
}

if (typeof window !== 'undefined') {
    window.BalconyVisualizer = BalconyVisualizer;
    window.balconyVisualizer = balconyVisualizer;
}

// ============================================
// ============================================

if (typeof window !== 'undefined') {
    window.getVisualizer = function() {
        return balconyVisualizer;
    };

    window.createVisualizer = function(containerId, options) {
        balconyVisualizer = new BalconyVisualizer(containerId, options);
        return balconyVisualizer;
    };

    window.destroyVisualizer = function() {
        if (balconyVisualizer) {
            balconyVisualizer.destroy();
            balconyVisualizer = null;
            console.log('??? Visualizer destroyed');
        }
    };

    console.log('?? Available console commands:');
    console.log('  getVisualizer() - Get current visualizer instance');
    console.log('  createVisualizer(id, options) - Create new visualizer');
    console.log('  destroyVisualizer() - Destroy current visualizer');
    console.log('  BalconyVisualizer - Access the class');
    console.log('  BalconyVisualizer.showProjectInfo() - Show project info');
}

// ============================================
// ============================================
(function checkCompatibility() {
    if (typeof BalconyVisualizer !== 'undefined' && BalconyVisualizer.checkWebGLSupport) {
        if (!BalconyVisualizer.checkWebGLSupport()) {
            console.error('? WebGL is not supported in this browser');
        }
    }
    
    if (typeof THREE === 'undefined') {
        console.error('? Three.js is not loaded');
    } else {
        console.log('? Three.js r' + THREE.REVISION + ' detected');
    }
    
    if (typeof THREE !== 'undefined' && typeof THREE.OrbitControls === 'undefined') {
        console.warn('?? OrbitControls not loaded - camera controls will not work');
    } else if (typeof THREE !== 'undefined') {
        console.log('? OrbitControls loaded');
    }
    
    if (typeof navigator !== 'undefined') {
        const hardwareConcurrency = navigator.hardwareConcurrency || 4;
        const deviceMemory = navigator.deviceMemory || 4;
        
        console.log('?? System info:', {
            cpuCores: hardwareConcurrency,
            memoryGB: deviceMemory,
            pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
            userAgent: navigator.userAgent
        });
    }
    
    if (typeof BalconyVisualizer !== 'undefined' && BalconyVisualizer.getRecommendedSettings) {
        const recommended = BalconyVisualizer.getRecommendedSettings();
        console.log('?? Recommended settings:', recommended);
    }
})();

// ============================================
// ============================================
if (typeof console !== 'undefined') {
    console.log('');
    console.log('%c? BalconyPro Visualizer v3.0.0 ULTIMATE Ready!', 
        'font-size: 16px; font-weight: bold; color: #10b981;');
    console.log('%c?? Create amazing balcony visualizations', 
        'font-size: 12px; color: #6b7280;');
    console.log('');
}

// ============================================
// ============================================
if (typeof exports !== 'undefined') {
    exports.BalconyVisualizer = BalconyVisualizer;
    exports.balconyVisualizer = balconyVisualizer;
}

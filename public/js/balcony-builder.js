/**
 * ============================================
 * ============================================
 */

// ============================================
// ============================================
class BalconyBuilder {
    constructor() {
        // ============================================
        // ============================================
        this.dimensions = {
            length: 3,
            width: 1.4,
            height: 2.7,
            shape: 'loggia-3'
        };

        // ============================================
        // ============================================
        this.glazing = {
            type: 'classic',        // classic, french, none
            windowSections: 3,
            layout: 'straight',
            gSide: 'left',
            windowType: null,
            windowsillType: null,
            sillType: null
        };

        this.entrance = {
            type: 'plastic-door',
            mirrored: false,
            width: 1.65,
            height: 2.25
        };

        // ============================================
        // ============================================
        this.materials = {
            walls: {
                front: { materialId: null, color: '#FFFFFF', area: 0 },
                left: { materialId: null, color: '#FFFFFF', area: 0 },
                right: { materialId: null, color: '#FFFFFF', area: 0 },
                back: { materialId: null, color: '#FFFFFF', area: 0 }
            },
            ceiling: { materialId: null, color: '#FFFFFF', area: 0 },
            floor: { materialId: null, color: '#8B7355', area: 0 },
            windows: [],
            windowsill: { materialId: null, length: 0 },
            sill: { materialId: null, length: 0 }
        };

        // ============================================
        // ============================================
        this.lighting = {
            items: [],
            selectedType: null,
            brightness: 80,
            temperature: 'neutral', // warm, neutral, cool
            autoOn: true
        };

        // ============================================
        // ============================================
        this.furniture = {
            items: [],
            selectedType: null
        };

        // ============================================
        // ============================================
        this.extras = {
            insulation: false,
            wiring: false,
            floorHeating: false,
            ventilation: false,
            demolition: false,
            disposal: false
        };

        // ============================================
        // ============================================
        this.state = {
            isModified: false,
            lastSaved: null,
            version: '2.0.0'
        };

        // ============================================
        // ============================================
        this.callbacks = {
            onUpdate: [],
            onMaterialChange: [],
            onDimensionChange: [],
            onPriceChange: []
        };

        // ============================================
        // ============================================
        this.history = {
            states: [],
            currentIndex: -1,
            maxSize: 5
        };

        this._applyDefaultInterior();
        this._recalculateAreas();
        this.saveToHistory();
    }

    // ============================================
    // ============================================

    /**
     */
    setLength(length) {
        const value = Math.max(2, Math.min(20, parseFloat(length) || 3));
        if (this.dimensions.length !== value) {
            this.dimensions.length = value;
            this._onDimensionChange();
            this._recalculateAreas();
            this._notifyUpdate();
        }
    }

    /**
     */
    setWidth(width) {
        const value = Math.max(0.8, Math.min(5, parseFloat(width) || 1.5));
        if (this.dimensions.width !== value) {
            this.dimensions.width = value;
            this._onDimensionChange();
            this._recalculateAreas();
            this._notifyUpdate();
        }
    }

    /**
     */
    setHeight(height) {
        const value = Math.max(2.2, Math.min(4, parseFloat(height) || 2.7));
        if (this.dimensions.height !== value) {
            this.dimensions.height = value;
            this._onDimensionChange();
            this._recalculateAreas();
            this._notifyUpdate();
        }
    }

    /**
     */
    setShape(shape) {
        const normalizedShape = this._normalizeShape(shape);
        if (normalizedShape === 'g-shaped' || normalizedShape === 'g-shaped-right') {
            this.setGlazingLayout('g');
            this.setGlazingGSide(normalizedShape === 'g-shaped-right' ? 'right' : 'left');
            return;
        }

        if (normalizedShape === 'p-shaped') {
            this.setGlazingLayout('p');
            return;
        }

        const preset = this._getShapePreset(normalizedShape);
        if (preset && this.dimensions.shape !== normalizedShape) {
            this.dimensions = {
                ...this.dimensions,
                length: preset.length,
                width: preset.width,
                height: preset.height,
                shape: normalizedShape
            };
            this.glazing.windowSections = preset.windowSections;
            this._normalizeGlazingLayoutForCurrentShape();
            this._onDimensionChange();
            this._recalculateAreas();
            this._notifyUpdate();
        }
    }

    /**
     */
    setDimensions(dimensions) {
        const normalizedShape = dimensions.shape
            ? this._normalizeShape(dimensions.shape)
            : this.dimensions.shape;
        const { shape, ...restDimensions } = dimensions || {};
        const preset = this._getShapePreset(normalizedShape);

        this.dimensions = {
            ...this.dimensions,
            ...(dimensions.shape && preset ? {
                length: preset.length,
                width: preset.width,
                height: preset.height
            } : {}),
            ...restDimensions,
            shape: preset ? normalizedShape : this.dimensions.shape
        };

        if (dimensions.shape) {
            if (normalizedShape === 'g-shaped' || normalizedShape === 'g-shaped-right') {
                this.setGlazingLayout('g');
                this.setGlazingGSide(normalizedShape === 'g-shaped-right' ? 'right' : 'left');
            } else if (normalizedShape === 'p-shaped') {
                this.setGlazingLayout('p');
            } else {
                this.setGlazingLayout('straight');
            }
        }

        if (dimensions.shape && preset) {
            this.glazing.windowSections = preset.windowSections;
        }

        this._onDimensionChange();
        this._normalizeGlazingLayoutForCurrentShape();
        this._recalculateAreas();
        this._notifyUpdate();
    }

    // ============================================
    // ============================================

    /**
     */
    setGlazingType(type) {
        const normalizedType = this._normalizeGlazingType(type);
        const validTypes = ['classic', 'french', 'none'];

        if (validTypes.includes(normalizedType)) {
            this.glazing.type = normalizedType;
            if (normalizedType === 'none') {
                this.glazing.layout = 'straight';
            }
            this._notifyUpdate();
            this.saveToHistory();
        }
    }

    /**
     */
    setWindowSections(count) {
        const value = Math.max(1, Math.min(10, parseInt(count) || 3));
        this.glazing.windowSections = value;
        this._notifyUpdate();
        this.saveToHistory();
    }

    setGlazingLayout(layout) {
        const normalizedLayout = String(layout || '').toLowerCase();
        if (!['straight', 'g', 'p'].includes(normalizedLayout)) return;

        const nextLayout = this._supportsExtendedGlazingLayout()
            ? normalizedLayout
            : 'straight';

        this.glazing.layout = nextLayout;

        if (nextLayout === 'g') {
            this.glazing.windowSections = Math.max(3, this.glazing.windowSections);
        } else if (nextLayout === 'p') {
            this.glazing.windowSections = Math.max(4, this.glazing.windowSections);
        }

        this._recalculateAreas();
        this._notifyUpdate();
    }

    setGlazingGSide(side) {
        this.glazing.gSide = side === 'right' ? 'right' : 'left';
        this._notifyUpdate();
    }

    setEntranceType(type) {
        const aliases = {
            'door-window': 'plastic-door',
            'door-wide-window': 'glazing-window',
            'center-door': 'plastic-door',
            'joined-room': 'open-connection'
        };
        const requestedType = String(type || '').toLowerCase();
        const normalizedType = aliases[requestedType] || requestedType;
        if (!['plastic-door', 'glazing-window', 'open-connection'].includes(normalizedType)) {
            return;
        }

        const previousType = this.entrance.type;
        this.entrance.type = normalizedType;
        this.entrance.mirrored = false;
        if (previousType !== normalizedType) {
            const defaults = {
                'plastic-door': { width: 1.65, height: 2.25 },
                'glazing-window': { width: 2.2, height: 2.25 },
                'open-connection': { width: 2.35, height: 2.25 }
            };
            this.entrance.width = defaults[normalizedType].width;
            this.entrance.height = defaults[normalizedType].height;
        }
        this._normalizeEntranceSize();
        this._notifyUpdate();
    }

    setEntranceMirrored(mirrored) {
        this.entrance.mirrored = Boolean(mirrored) && this.entrance.type === 'plastic-door';
        this._notifyUpdate();
    }

    setEntranceSize(width, height) {
        const nextWidth = Number.parseFloat(width);
        const nextHeight = Number.parseFloat(height);
        if (Number.isFinite(nextWidth)) {
            this.entrance.width = nextWidth;
        }
        if (Number.isFinite(nextHeight)) {
            this.entrance.height = nextHeight;
        }
        this._normalizeEntranceSize();
        this._notifyUpdate();
    }

    _normalizeEntranceSize() {
        const type = this.entrance.type || 'plastic-door';
        const defaults = {
            'plastic-door': { width: 1.65, height: 2.25, minW: 1.35, maxW: 2.15, minH: 2.0, maxH: 2.55 },
            'glazing-window': { width: 2.2, height: 2.25, minW: 1.75, maxW: 2.85, minH: 2.0, maxH: 2.55 },
            'open-connection': { width: 2.35, height: 2.25, minW: 1.9, maxW: 3.2, minH: 2.0, maxH: 2.55 }
        };
        const limits = defaults[type] || defaults['plastic-door'];
        const width = Number.isFinite(this.entrance.width) ? this.entrance.width : limits.width;
        const height = Number.isFinite(this.entrance.height) ? this.entrance.height : limits.height;
        this.entrance.width = Math.max(limits.minW, Math.min(limits.maxW, width));
        this.entrance.height = Math.max(limits.minH, Math.min(limits.maxH, height));
    }

    _supportsExtendedGlazingLayout(shape = this.dimensions.shape) {
        return ['loggia-3', 'loggia-6'].includes(shape);
    }

    _normalizeGlazingLayoutForCurrentShape() {
        if (!this._supportsExtendedGlazingLayout()) {
            this.glazing.layout = 'straight';
        }

        if (!['straight', 'g', 'p'].includes(this.glazing.layout)) {
            this.glazing.layout = 'straight';
        }

        this.glazing.gSide = this.glazing.gSide === 'right' ? 'right' : 'left';
    }

    /**
     */
    selectWindowType(windowTypeId) {
        const windowType = MaterialsAPI.getById(windowTypeId, 'windows');
        if (windowType) {
            this.glazing.windowType = windowType;
            this._onMaterialChange('windows', windowType);
            this._notifyUpdate();
        }
    }

    /**
     */
    selectWindowsillType(windowsillTypeId) {
        const windowsillType = MaterialsAPI.getById(windowsillTypeId, 'windowsill');
        if (windowsillType && windowsillType.category === 'windowsill' && !windowsillType.id.includes('sill')) {
            this.materials.windowsill.materialId = windowsillTypeId;
            this._onMaterialChange('windowsill', windowsillType);
            this._notifyUpdate();
        }
    }

    /**
     */
    selectSillType(sillTypeId) {
        const sillType = MaterialsAPI.getById(sillTypeId, 'windowsill');
        if (sillType && sillType.id.includes('sill')) {
            this.materials.sill.materialId = sillTypeId;
            this._onMaterialChange('sill', sillType);
            this._notifyUpdate();
        }
    }

    // ============================================
    // ============================================

    /**
     */
    selectMaterial(element, materialId, color = null) {
        const parts = element.split('_');
        const category = parts[0];
        const subElement = parts[1] || null;

        const material = MaterialsAPI.getById(materialId, category);
        if (!material) {
            console.warn(`Material ${materialId} not found in category ${category}`);
            return false;
        }
        const resolvedColor = color || this._getDefaultMaterialColor(category, material);

        if (category === 'walls' && subElement === 'all') {
            Object.keys(this.materials.walls).forEach((wallName) => {
                this.materials.walls[wallName] = {
                    materialId: materialId,
                    color: resolvedColor,
                    area: this.materials.walls[wallName].area
                };
            });
        } else if (category === 'walls' && subElement) {
            this.materials.walls[subElement] = {
                materialId: materialId,
                color: resolvedColor,
                area: this.materials.walls[subElement].area
            };
        } else if (category === 'ceiling') {
            this.materials.ceiling = {
                materialId: materialId,
                color: resolvedColor,
                area: this.materials.ceiling.area
            };
        } else if (category === 'floor') {
            this.materials.floor = {
                materialId: materialId,
                color: resolvedColor,
                area: this.materials.floor.area
            };
        }

        this._onMaterialChange(element, material);
        this._notifyUpdate();
        this.saveToHistory();
        return true;
    }

    /**
     */
    _getDefaultMaterialColor(category, material) {
        if (category === 'ceiling') {
            return '#F4F2ED';
        }

        return material?.color || '#FFFFFF';
    }

    setColor(element, color) {
        const parts = element.split('_');
        const category = parts[0];
        const subElement = parts[1] || null;

        if (category === 'walls' && subElement === 'all') {
            Object.keys(this.materials.walls).forEach((wallName) => {
                this.materials.walls[wallName].color = color;
            });
        } else if (category === 'walls' && subElement && this.materials.walls[subElement]) {
            this.materials.walls[subElement].color = color;
        } else if (category === 'ceiling') {
            this.materials.ceiling.color = color;
        } else if (category === 'floor') {
            this.materials.floor.color = color;
        }

        this._notifyUpdate();
        this.saveToHistory();
    }

    /**
     */
    getMaterial(element) {
        const parts = element.split('_');
        const category = parts[0];
        const subElement = parts[1] || null;

        if (category === 'walls' && subElement === 'all') {
            const wallData = this.materials.walls.front;
            if (wallData && wallData.materialId) {
                return MaterialsAPI.getById(wallData.materialId, 'walls');
            }
        } else if (category === 'walls' && subElement) {
            const wallData = this.materials.walls[subElement];
            if (wallData && wallData.materialId) {
                return MaterialsAPI.getById(wallData.materialId, 'walls');
            }
        } else if (category === 'ceiling' && this.materials.ceiling.materialId) {
            return MaterialsAPI.getById(this.materials.ceiling.materialId, 'ceiling');
        } else if (category === 'floor' && this.materials.floor.materialId) {
            return MaterialsAPI.getById(this.materials.floor.materialId, 'floor');
        }

        return null;
    }

    /**
     */
    getColor(element) {
        const parts = element.split('_');
        const category = parts[0];
        const subElement = parts[1] || null;

        if (category === 'walls' && subElement === 'all') {
            return this.materials.walls.front?.color || '#FFFFFF';
        } else if (category === 'walls' && subElement) {
            return this.materials.walls[subElement]?.color || '#FFFFFF';
        } else if (category === 'ceiling') {
            return this.materials.ceiling.color;
        } else if (category === 'floor') {
            return this.materials.floor.color;
        }

        return '#FFFFFF';
    }

    // ============================================
    // ============================================

    /**
     */
    addLight(position, materialId) {
        const lightType = MaterialsAPI.getById(materialId, 'lighting');
        if (!lightType) return false;

        this.lighting.selectedType = lightType;
        this._syncLightingLayout();
        this._notifyUpdate();
        this.saveToHistory();
        return true;
    }

    /**
     */
    removeLight(lightId) {
        const index = this.lighting.items.findIndex(l => l.id === lightId);
        if (index !== -1) {
            this.lighting.items.splice(index, 1);
            this._notifyUpdate();
            this.saveToHistory();
        }
    }

    /**
     */
    setLightBrightness(brightness) {
        const nextBrightness = Math.max(0, Math.min(200, Number(brightness) || 0));
        this.lighting.brightness = nextBrightness;
        this.lighting.items.forEach((item) => {
            item.brightness = nextBrightness;
        });
        this._notifyUpdate();
    }

    /**
     * @param {string} temp - warm, neutral, cool
     */
    setLightTemperature(temp) {
        const validTemps = ['warm', 'neutral', 'cool'];
        if (validTemps.includes(temp)) {
            this.lighting.temperature = temp;
            this.lighting.items.forEach((item) => {
                item.temperature = temp;
            });
            this._notifyUpdate();
        }
    }

    /**
     * Установить автовключение освещения
     */
    setLightAutoOn(enabled) {
        this.lighting.autoOn = Boolean(enabled);
        this._notifyUpdate();
    }

    /**
     */
    selectLightingType(materialId) {
        const lightType = MaterialsAPI.getById(materialId, 'lighting');
        if (lightType) {
            this.lighting.selectedType = lightType;
            this._syncLightingLayout();
            this._notifyUpdate();
            this.saveToHistory();
        }
    }

    // ============================================
    // ============================================

    /**
     */
    addFurniture(position, materialId, rotation = 0, placementMeta = null) {
        const furnitureType = MaterialsAPI.getById(materialId, 'furniture');
        if (!furnitureType) return false;

        const furniture = {
            id: this._generateId('furniture'),
            type: furnitureType,
            position: { ...position },
            rotation: rotation,
            dimensions: furnitureType.dimensions || { width: 80, height: 100, depth: 40 },
            placementMeta: placementMeta ? { ...placementMeta } : null
        };

        this.furniture.items.push(furniture);
        this._notifyUpdate();
        this.saveToHistory();
        return true;
    }

    /**
     */
    removeFurniture(furnitureId) {
        const index = this.furniture.items.findIndex(f => f.id === furnitureId);
        if (index !== -1) {
            this.furniture.items.splice(index, 1);
            this._notifyUpdate();
            this.saveToHistory();
        }
    }

    /**
     */
    updateFurniturePosition(furnitureId, position) {
        const furniture = this.furniture.items.find(f => f.id === furnitureId);
        if (furniture) {
            furniture.position = { ...position };
            this._notifyUpdate();
            this.saveToHistory();
        }
    }

    updateFurniturePlacement(furnitureId, position, rotation = null, placementMeta = null) {
        const furniture = this.furniture.items.find(f => f.id === furnitureId);
        if (furniture) {
            furniture.position = { ...position };
            if (rotation !== null) {
                furniture.rotation = rotation;
            }
            if (placementMeta) {
                furniture.placementMeta = { ...placementMeta };
            }
            this._notifyUpdate();
            this.saveToHistory();
        }
    }

    updateFurnitureColor(furnitureId, color) {
        const furniture = this.furniture.items.find(f => f.id === furnitureId);
        if (!furniture || !/^#[0-9a-fA-F]{6}$/.test(String(color || ''))) {
            return false;
        }

        furniture.color = String(color).toUpperCase();
        this._notifyUpdate();
        this.saveToHistory();
        return true;
    }

    /**
     */
    selectFurnitureType(materialId) {
        const furnitureType = MaterialsAPI.getById(materialId, 'furniture');
        if (furnitureType) {
            this.furniture.selectedType = furnitureType;
        }
    }

    clearFurnitureSelection() {
        this.furniture.selectedType = null;
    }

    // ============================================
    // ============================================

    /**
     */
    setExtraOption(option, enabled) {
        if (this.extras.hasOwnProperty(option)) {
            this.extras[option] = enabled;
            this._notifyUpdate();
        }
    }

    /**
     */
    getExtras() {
        return { ...this.extras };
    }

    // ============================================
    // ============================================

    /**
     * @private
     */
    _recalculateAreas() {
        const { length, width, height, shape } = this.dimensions;

        let floorArea = MaterialsAPI.calculateArea('floor', { length, width, height, shape });
        this.materials.floor.area = floorArea;
        this.materials.ceiling.area = floorArea;

        const wallsArea = MaterialsAPI.calculateArea('walls', { length, width, height, shape });
        const rearDepth = Math.min(Math.max(width * 0.504, 0.41), 0.7);
        const rearWing = Math.min(Math.max(length * 0.31, 0.96), 1.82);
        
        switch (shape) {
            case 'hrushchevka':
            case 'loggia-3':
            case 'loggia-6':
                this.materials.walls.front.area = Math.round(width * height * 0.7 * 10) / 10;
                this.materials.walls.back.area = Math.round(width * height * 0.7 * 10) / 10;
                this.materials.walls.left.area = Math.round((wallsArea - this.materials.walls.front.area - this.materials.walls.back.area) / 2 * 10) / 10;
                this.materials.walls.right.area = this.materials.walls.left.area;
                break;
            case 'g-shaped':
            case 'g-shaped-right':
            case 'boot':
                this.materials.walls.front.area = Math.round(width * height * 0.7 * 10) / 10;
                this.materials.walls.back.area = Math.round((width + rearWing) * height * 0.7 * 10) / 10;
                this.materials.walls.left.area = Math.round((length + rearDepth) * height * 0.7 * 10) / 10;
                this.materials.walls.right.area = Math.round((wallsArea - this.materials.walls.front.area - this.materials.walls.back.area - this.materials.walls.left.area) * 10) / 10;
                break;
            case 'p-shaped':
            case 'iron':
            case 'boat':
                this.materials.walls.front.area = Math.round(width * height * 0.7 * 10) / 10;
                this.materials.walls.back.area = Math.round((width + rearWing * 2) * height * 0.7 * 10) / 10;
                this.materials.walls.left.area = Math.round((length + rearDepth) * height * 0.7 * 10) / 10;
                this.materials.walls.right.area = this.materials.walls.left.area;
                break;
            default:
                this.materials.walls.front.area = wallsArea / 4;
                this.materials.walls.back.area = wallsArea / 4;
                this.materials.walls.left.area = wallsArea / 4;
                this.materials.walls.right.area = wallsArea / 4;
        }

        const glazingLayout = this.glazing.layout || 'straight';
        const perimeter = glazingLayout === 'p'
            ? (length + width * 2)
            : (glazingLayout === 'g' ? (length + width) : length);
        this.materials.windowsill.length = Math.round(perimeter * 10) / 10;
        this.materials.sill.length = Math.round(perimeter * 10) / 10;
    }

    /**
     */
    getArea(element) {
        const parts = element.split('_');
        const category = parts[0];
        const subElement = parts[1] || null;

        if (category === 'walls' && subElement) {
            return this.materials.walls[subElement]?.area || 0;
        } else if (category === 'ceiling') {
            return this.materials.ceiling.area;
        } else if (category === 'floor') {
            return this.materials.floor.area;
        } else if (category === 'windowsill') {
            return this.materials.windowsill.length;
        } else if (category === 'sill') {
            return this.materials.sill.length;
        }

        return 0;
    }

    /**
     */
    getTotalWallsArea() {
        return Object.values(this.materials.walls).reduce((sum, wall) => sum + wall.area, 0);
    }

    // ============================================
    // ============================================

    /**
     */
    getAllMaterials() {
        const materials = [];

        Object.entries(this.materials.walls).forEach(([wallName, wallData]) => {
            if (wallData.materialId) {
                const material = MaterialsAPI.getById(wallData.materialId, 'walls');
                if (material && wallData.area > 0) {
                    materials.push({
                        ...material,
                        element: `wall_${wallName}`,
                        quantity: wallData.area,
                        unit: '�?',
                        total: material.price * wallData.area,
                        color: wallData.color
                    });
                }
            }
        });

        if (this.materials.ceiling.materialId) {
            const material = MaterialsAPI.getById(this.materials.ceiling.materialId, 'ceiling');
            if (material && this.materials.ceiling.area > 0) {
                materials.push({
                    ...material,
                    element: 'ceiling',
                    quantity: this.materials.ceiling.area,
                    unit: '�?',
                    total: material.price * this.materials.ceiling.area,
                    color: this.materials.ceiling.color
                });
            }
        }

        if (this.materials.floor.materialId) {
            const material = MaterialsAPI.getById(this.materials.floor.materialId, 'floor');
            if (material && this.materials.floor.area > 0) {
                materials.push({
                    ...material,
                    element: 'floor',
                    quantity: this.materials.floor.area,
                    unit: '�?',
                    total: material.price * this.materials.floor.area,
                    color: this.materials.floor.color
                });
            }
        }

        if (this.glazing.windowType) {
            const windowCount = this.glazing.windowSections;
            materials.push({
                ...this.glazing.windowType,
                element: 'windows',
                quantity: windowCount,
                unit: '��',
                total: this.glazing.windowType.price * windowCount
            });
        }

        if (this.materials.windowsill.materialId) {
            const material = MaterialsAPI.getById(this.materials.windowsill.materialId, 'windowsill');
            if (material) {
                materials.push({
                    ...material,
                    element: 'windowsill',
                    quantity: this.materials.windowsill.length,
                    unit: '�.�.',
                    total: material.price * this.materials.windowsill.length
                });
            }
        }

        if (this.materials.sill.materialId) {
            const material = MaterialsAPI.getById(this.materials.sill.materialId, 'windowsill');
            if (material) {
                materials.push({
                    ...material,
                    element: 'sill',
                    quantity: this.materials.sill.length,
                    unit: '�.�.',
                    total: material.price * this.materials.sill.length
                });
            }
        }

        this.lighting.items.forEach(light => {
            materials.push({
                ...light.type,
                element: 'lighting',
                quantity: 1,
                unit: '��',
                total: light.type.price,
                instanceId: light.id
            });
        });

        this.furniture.items.forEach(furniture => {
            materials.push({
                ...furniture.type,
                element: 'furniture',
                quantity: 1,
                unit: '��',
                total: furniture.type.price,
                instanceId: furniture.id
            });
        });

        return materials;
    }

    /**
     */
    getParamsString() {
        const { length, width, height, shape } = this.dimensions;
        return `${length}� ? ${width}� ? ${height}�, ${this.getShapeName(shape)}`;
    }

    getShapeName(shape = this.dimensions.shape) {
        if (shape === 'g-shaped-right') {
            return '\u0413-\u043e\u0431\u0440\u0430\u0437\u043d\u044b\u0439 (\u043f\u0440\u0430\u0432\u044b\u0439)';
        }

        const shapeNames = {
            'hrushchevka': '��������',
            'loggia-3': '������ 3 �',
            'loggia-6': '������ 6 �',
            'g-shaped': '������ �-��������',
            'p-shaped': '������ �-��������',
            'boot': '������ ��������',
            'iron': '������ �������',
            'boat': '������ ��������'
        };

        return shapeNames[shape] || shape;
    }

    // Переопределение после восстановления кодировки: нормальные единицы и названия форм.
    getAllMaterials() {
        const materials = [];

        Object.entries(this.materials.walls).forEach(([wallName, wallData]) => {
            if (!wallData.materialId || wallData.area <= 0) return;
            const material = MaterialsAPI.getById(wallData.materialId, 'walls');
            if (!material) return;

            materials.push({
                ...material,
                element: `wall_${wallName}`,
                quantity: wallData.area,
                unit: 'м²',
                total: material.price * wallData.area,
                color: wallData.color
            });
        });

        if (this.materials.ceiling.materialId && this.materials.ceiling.area > 0) {
            const material = MaterialsAPI.getById(this.materials.ceiling.materialId, 'ceiling');
            if (material) {
                materials.push({
                    ...material,
                    element: 'ceiling',
                    quantity: this.materials.ceiling.area,
                    unit: 'м²',
                    total: material.price * this.materials.ceiling.area,
                    color: this.materials.ceiling.color
                });
            }
        }

        if (this.materials.floor.materialId && this.materials.floor.area > 0) {
            const material = MaterialsAPI.getById(this.materials.floor.materialId, 'floor');
            if (material) {
                materials.push({
                    ...material,
                    element: 'floor',
                    quantity: this.materials.floor.area,
                    unit: 'м²',
                    total: material.price * this.materials.floor.area,
                    color: this.materials.floor.color
                });
            }
        }

        if (this.glazing.windowType) {
            const windowCount = this.glazing.windowSections;
            materials.push({
                ...this.glazing.windowType,
                element: 'windows',
                quantity: windowCount,
                unit: 'шт',
                total: this.glazing.windowType.price * windowCount
            });
        }

        if (this.materials.windowsill.materialId) {
            const material = MaterialsAPI.getById(this.materials.windowsill.materialId, 'windowsill');
            if (material) {
                materials.push({
                    ...material,
                    element: 'windowsill',
                    quantity: this.materials.windowsill.length,
                    unit: 'п.м.',
                    total: material.price * this.materials.windowsill.length
                });
            }
        }

        if (this.materials.sill.materialId) {
            const material = MaterialsAPI.getById(this.materials.sill.materialId, 'windowsill');
            if (material) {
                materials.push({
                    ...material,
                    element: 'sill',
                    quantity: this.materials.sill.length,
                    unit: 'п.м.',
                    total: material.price * this.materials.sill.length
                });
            }
        }

        this.lighting.items.forEach((light) => {
            materials.push({
                ...light.type,
                element: 'lighting',
                quantity: 1,
                unit: 'шт',
                total: light.type.price,
                instanceId: light.id
            });
        });

        this.furniture.items.forEach((furniture) => {
            materials.push({
                ...furniture.type,
                element: 'furniture',
                quantity: 1,
                unit: 'шт',
                total: furniture.type.price,
                instanceId: furniture.id
            });
        });

        return materials;
    }

    getParamsString() {
        const { length, width, height, shape } = this.dimensions;
        return `${length} м x ${width} м x ${height} м, ${this.getShapeName(shape)}`;
    }

    getShapeName(shape = this.dimensions.shape) {
        if (shape === 'g-shaped-right') {
            return 'Г-образный (правый)';
        }

        const shapeNames = {
            'hrushchevka': 'Хрущёвка',
            'loggia-3': 'Лоджия 3 м',
            'loggia-6': 'Лоджия 6 м',
            'g-shaped': 'Г-образный',
            'p-shaped': 'П-образный',
            'boot': 'Сапожок',
            'iron': 'Утюжок',
            'boat': 'Лодочка'
        };

        return shapeNames[shape] || shape;
    }

    getShapeName(shape = this.dimensions.shape) {
        const shapeNames = {
            'hrushchevka': 'Хрущёвка',
            'loggia-3': 'Лоджия 3 м',
            'loggia-6': 'Лоджия 6 м',
            'boot': 'Сапожок',
            'iron': 'Утюжок',
            'boat': 'Лодочка'
        };

        return shapeNames[shape] || 'Лоджия';
    }

    _applyDefaultInterior() {
        const defaultWallMaterial = {
            materialId: 'wall-mdf-panels',
            color: '#9B7A5A'
        };

        Object.keys(this.materials.walls).forEach((wallName) => {
            this.materials.walls[wallName] = {
                ...defaultWallMaterial,
                area: this.materials.walls[wallName].area
            };
        });
        this.materials.ceiling = {
            materialId: 'ceiling-stretch',
            color: '#F4F2ED',
            area: this.materials.ceiling.area
        };
        this.materials.floor = {
            materialId: 'floor-laminate',
            color: '#8F735D',
            area: this.materials.floor.area
        };
        this.materials.windowsill.materialId = 'windowsill-pvc-standard';
        this.materials.sill.materialId = 'sill-external';
        this.glazing.windowType = MaterialsAPI.getById('window-standard-2chamber', 'windows');
        this.lighting.selectedType = MaterialsAPI.getById('ceiling-spotlights', 'lighting');
        this._syncLightingLayout();
    }

    _normalizeShape(shape) {
        const aliases = {
            'straight': 'loggia-3',
            'L-left': 'g-shaped',
            'L-right': 'g-shaped-right',
            'P': 'p-shaped',
            'custom': 'boot'
        };

        return aliases[shape] || shape;
    }

    _normalizeGlazingType(type) {
        const aliases = {
            cold: 'classic',
            warm: 'classic',
            panoramic: 'french'
        };

        return aliases[type] || type;
    }

    _getShapePreset(shape) {
        const presets = {
            'hrushchevka': { length: 2.8, width: 0.9, height: 2.5, windowSections: 3 },
            'loggia-3': { length: 3.0, width: 1.4, height: 2.7, windowSections: 3 },
            'loggia-6': { length: 6.0, width: 1.5, height: 2.7, windowSections: 6 },
            'boot': { length: 3.2, width: 2.1, height: 2.7, windowSections: 4 },
            'iron': { length: 3.0, width: 2.0, height: 2.7, windowSections: 4 },
            'boat': { length: 3.65, width: 0.96, height: 2.7, windowSections: 4 }
        };

        return presets[shape] || null;
    }

    /**
     */
    exportConfig() {
        return {
            dimensions: { ...this.dimensions },
            glazing: { ...this.glazing },
            entrance: { ...this.entrance },
            materials: JSON.parse(JSON.stringify(this.materials)),
            lighting: {
                items: JSON.parse(JSON.stringify(this.lighting.items)),
                selectedTypeId: this.lighting.selectedType?.id || null,
                brightness: this.lighting.brightness,
                temperature: this.lighting.temperature,
                autoOn: this.lighting.autoOn
            },
            furniture: {
                items: JSON.parse(JSON.stringify(this.furniture.items))
            },
            extras: { ...this.extras },
            state: { ...this.state }
        };
    }

    /**
     */
    importConfig(config) {
        if (config.dimensions) this.setDimensions(config.dimensions);
        if (config.glazing) this.glazing = { ...this.glazing, ...config.glazing };
        if (config.entrance) {
            this.entrance = { ...this.entrance, ...config.entrance };
            this.setEntranceType(this.entrance.type);
            this.setEntranceMirrored(this.entrance.mirrored);
            this.setEntranceSize(this.entrance.width, this.entrance.height);
        }
        this._normalizeGlazingLayoutForCurrentShape();
        if (config.materials) this.materials = JSON.parse(JSON.stringify(config.materials));
        if (config.lighting) {
            this.lighting.items = JSON.parse(JSON.stringify(config.lighting.items || []));
            this.lighting.selectedType = config.lighting.selectedTypeId
                ? MaterialsAPI.getById(config.lighting.selectedTypeId, 'lighting')
                : (this.lighting.items[0]?.type?.id ? MaterialsAPI.getById(this.lighting.items[0].type.id, 'lighting') : this.lighting.selectedType);
            this.lighting.brightness = Number.isFinite(config.lighting.brightness)
                ? Math.max(0, Math.min(200, config.lighting.brightness))
                : 80;
            this.lighting.temperature = config.lighting.temperature || 'neutral';
            this.lighting.autoOn = config.lighting.autoOn !== false;
            this._syncLightingLayout();
        }
        if (config.furniture) {
            this.furniture.items = JSON.parse(JSON.stringify(config.furniture.items || []));
        }
        if (config.extras) this.extras = { ...this.extras, ...config.extras };
        
        this._recalculateAreas();
        this._notifyUpdate();
    }

    // ============================================
    // ============================================

    /**
     * @private
     */
    saveToHistory() {
        const state = this.exportConfig();
        
        if (this.history.currentIndex < this.history.states.length - 1) {
            this.history.states = this.history.states.slice(0, this.history.currentIndex + 1);
        }

        this.history.states.push(state);
        
        if (this.history.states.length > this.history.maxSize) {
            this.history.states.shift();
        } else {
            this.history.currentIndex++;
        }
    }

    /**
     */
    undo() {
        if (this.history.currentIndex > 0) {
            this.history.currentIndex--;
            this.importConfig(this.history.states[this.history.currentIndex]);
            return true;
        }
        return false;
    }

    /**
     */
    redo() {
        if (this.history.currentIndex < this.history.states.length - 1) {
            this.history.currentIndex++;
            this.importConfig(this.history.states[this.history.currentIndex]);
            return true;
        }
        return false;
    }

    /**
     */
    canUndo() {
        return this.history.currentIndex > 0;
    }

    /**
     */
    canRedo() {
        return this.history.currentIndex < this.history.states.length - 1;
    }

    // ============================================
    // ============================================

    /**
     */
    reset() {
        this.dimensions = { length: 3, width: 1.4, height: 2.7, shape: 'loggia-3' };
        this.glazing = { type: 'classic', windowSections: 3, layout: 'straight', gSide: 'left', windowType: null, windowsillType: null, sillType: null };
        this.entrance = { type: 'plastic-door', mirrored: false, width: 1.65, height: 2.25 };
        this.materials = {
            walls: {
                front: { materialId: null, color: '#FFFFFF', area: 0 },
                left: { materialId: null, color: '#FFFFFF', area: 0 },
                right: { materialId: null, color: '#FFFFFF', area: 0 },
                back: { materialId: null, color: '#FFFFFF', area: 0 }
            },
            ceiling: { materialId: null, color: '#FFFFFF', area: 0 },
            floor: { materialId: null, color: '#8B7355', area: 0 },
            windows: [],
            windowsill: { materialId: null, length: 0 },
            sill: { materialId: null, length: 0 }
        };
        this.lighting = { items: [], selectedType: null, brightness: 80, temperature: 'neutral', autoOn: true };
        this.furniture = { items: [], selectedType: null };
        this.extras = { insulation: false, wiring: false, floorHeating: false, ventilation: false, demolition: false, disposal: false };
        
        this._applyDefaultInterior();
        this._recalculateAreas();
        this._notifyUpdate();
        this.history = { states: [], currentIndex: -1, maxSize: 5 };
        this.saveToHistory();
    }

    // ============================================
    // ============================================

    /**
     */
    subscribe(callback) {
        if (typeof callback === 'function') {
            this.callbacks.onUpdate.push(callback);
        }
    }

    /**
     */
    unsubscribe(callback) {
        this.callbacks.onUpdate = this.callbacks.onUpdate.filter(cb => cb !== callback);
    }

    /**
     * @private
     */
    _notifyUpdate() {
        this.state.isModified = true;
        this.state.lastSaved = new Date().toISOString();
        
        this.callbacks.onUpdate.forEach(callback => {
            try {
                callback(this);
            } catch (error) {
                console.error('Error in update callback:', error);
            }
        });
    }

    /**
     * @private
     */
    _onDimensionChange() {
        this._syncLightingLayout();
        this.callbacks.onDimensionChange.forEach(callback => {
            try {
                callback(this.dimensions);
            } catch (error) {
                console.error('Error in dimension callback:', error);
            }
        });
    }

    /**
     * @private
     */
    _onMaterialChange(element, material) {
        this.callbacks.onMaterialChange.forEach(callback => {
            try {
                callback(element, material);
            } catch (error) {
                console.error('Error in material callback:', error);
            }
        });
    }

    // ============================================
    // ============================================

    /**
     * @private
     */
    _generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * @private
     */
    _cloneObject(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    _syncLightingLayout() {
        const lightType = this.lighting.selectedType;
        if (!lightType) {
            this.lighting.items = [];
            return;
        }

        const previousIds = this.lighting.items.map(item => item.id);
        const layout = this._generateLightingLayout(lightType);

        this.lighting.items = layout.map((item, index) => ({
            id: previousIds[index] || this._generateId('light'),
            type: lightType,
            position: item.position,
            rotation: item.rotation || 0,
            layout: item.layout || {},
            brightness: this.lighting.brightness,
            temperature: this.lighting.temperature
        }));
    }

    _generateLightingLayout(lightType) {
        const { length, width, height, shape } = this.dimensions;
        const ceilingY = height - 0.04;
        const isBoatShape = shape === 'boat';
        const isBootShape = shape === 'boot';
        const usableLength = isBoatShape
            ? Math.max(length - 1.05, 1.35)
            : Math.max(length - 0.6, 1.2);
        const usableDepth = Math.max(width - 0.28, 0.5);
        const typeId = lightType?.id;
        const profilePoints = this._getLightingProfilePoints(length, width, shape);
        const safeCeilingPosition = (x, z, margin = 0.18) => {
            const safePoint = this._getSafeLightingPlanPosition(x, z, profilePoints, margin);
            return { x: safePoint.x, y: ceilingY, z: safePoint.z };
        };

        if (typeId === 'ceiling-track-lights') {
            const tracksCount = (length >= 4.2 || width >= 1.7) ? 2 : 1;
            const trackLength = Math.max(1.1, Math.min(length - 0.16, usableLength + 0.36));
            const headCount = Math.max(3, Math.min(8, Math.round(trackLength / 0.62)));
            const zSpan = Math.max(0.24, Math.min(usableDepth * 0.78, 0.72));
            const zOffsets = Array.from({ length: tracksCount }, (_, index) => {
                if (tracksCount === 1) return 0;
                return -zSpan / 2 + (zSpan * index) / (tracksCount - 1);
            });

            return zOffsets.map((zOffset, index) => ({
                position: safeCeilingPosition(0, zOffset, 0.2),
                rotation: 0,
                layout: {
                    kind: 'track',
                    trackLength,
                    headCount,
                    trackIndex: index,
                    tracksCount
                }
            }));
        }

        if (typeId === 'ceiling-contour-led') {
            const safeCenter = safeCeilingPosition(0, 0, 0.24);
            return [{
                position: safeCenter,
                rotation: 0,
                layout: {
                    kind: 'contour',
                    width: Math.max(0.75, usableLength),
                    depth: Math.max(0.42, usableDepth)
                }
            }];
        }

        const spotCount = isBoatShape
            ? 3
            : isBootShape
                ? 3
            : Math.max(2, Math.min(6, Math.round(length / 0.9)));
        const rowsCount = width >= 1.75 && spotCount >= 4 ? 2 : 1;
        const columnsCount = Math.ceil(spotCount / rowsCount);
        const startX = -usableLength / 2;
        const xStep = columnsCount > 1 ? usableLength / (columnsCount - 1) : 0;
        const rowOffset = Math.min(0.22, usableDepth * 0.18);
        const zOffsets = rowsCount === 2 ? [-rowOffset, rowOffset] : [0];
        const layout = [];

        if (isBootShape) {
            const halfL = length / 2;
            const halfW = width / 2;
            const bootPositions = [
                { x: -halfL + length * 0.22, z: -halfW + width * 0.3 },
                { x: -halfL + length * 0.55, z: -halfW + width * 0.3 },
                { x: -halfL + length * 0.9, z: -halfW + width * 0.62 }
            ];

            return bootPositions.map((point, index) => ({
                position: safeCeilingPosition(point.x, point.z, 0.24),
                rotation: 0,
                layout: {
                    kind: 'spot',
                    rowIndex: 0,
                    rowsCount: 1,
                    columnIndex: index,
                    columnsCount: bootPositions.length,
                    fixtureRadius: 0.085
                }
            }));
        }

        for (let rowIndex = 0; rowIndex < rowsCount; rowIndex += 1) {
            for (let columnIndex = 0; columnIndex < columnsCount; columnIndex += 1) {
                if (layout.length >= spotCount) {
                    break;
                }

                layout.push({
                    position: safeCeilingPosition(
                        columnsCount === 1 ? 0 : startX + (xStep * columnIndex),
                        zOffsets[rowIndex],
                        isBoatShape ? 0.22 : 0.18
                    ),
                    rotation: 0,
                    layout: {
                        kind: 'spot',
                        rowIndex,
                        rowsCount,
                        columnIndex,
                        columnsCount,
                        fixtureRadius: isBoatShape ? 0.075 : 0.105
                    }
                });
            }
        }

        return layout;
    }

    _getLightingProfilePoints(length, width, shape) {
        const halfL = length / 2;
        const halfW = width / 2;

        switch (shape) {
            case 'boot':
                return [
                    { x: -halfL, z: -halfW },
                    { x: halfL, z: -halfW },
                    { x: halfL, z: halfW },
                    { x: halfL - length * (400 / 3200), z: halfW },
                    { x: -halfL + length * (2400 / 3200), z: -halfW + width * (1200 / 2100) },
                    { x: -halfL, z: -halfW + width * (1200 / 2100) }
                ];
            case 'iron':
                return [
                    { x: -halfL, z: -halfW },
                    { x: halfL, z: -halfW },
                    { x: halfL, z: halfW },
                    { x: -halfL * 0.08, z: halfW },
                    { x: -halfL, z: -halfW * 0.16 }
                ];
            case 'boat':
                return [
                    { x: -halfL, z: -halfW },
                    { x: -halfL + length * (3250 / 3650), z: -halfW },
                    { x: -halfL + length * (3250 / 3650), z: -halfW + width * (280 / 960) },
                    { x: halfL, z: -halfW + width * (280 / 960) },
                    { x: halfL, z: halfW },
                    { x: -halfL + length * (1700 / 3650), z: halfW },
                    { x: -halfL, z: -halfW + width * (400 / 960) }
                ];
            default:
                return [
                    { x: -halfL, z: -halfW },
                    { x: halfL, z: -halfW },
                    { x: halfL, z: halfW },
                    { x: -halfL, z: halfW }
                ];
        }
    }

    _getSafeLightingPlanPosition(x, z, points, margin = 0.18) {
        if (!Array.isArray(points) || points.length < 3) {
            return { x, z };
        }

        if (this._isLightingPointSafe(x, z, points, margin)) {
            return { x, z };
        }

        const bounds = this._getLightingProfileBounds(points);
        const center = this._getLightingProfileCenter(points);
        const margins = [margin, margin * 0.66, margin * 0.36, 0.02, 0];
        const xCandidates = [
            x,
            Math.max(bounds.minX + margin, Math.min(bounds.maxX - margin, x)),
            center.x,
            x + margin,
            x - margin,
            center.x + (x - center.x) * 0.7,
            center.x + (x - center.x) * 0.45
        ];

        for (const currentMargin of margins) {
            for (const xCandidate of xCandidates) {
                const safeX = Math.max(
                    bounds.minX + currentMargin,
                    Math.min(bounds.maxX - currentMargin, xCandidate)
                );
                const intervals = this._getLightingZIntervalsAtX(points, safeX);
                const interval = intervals
                    .sort((a, b) => (b.max - b.min) - (a.max - a.min))[0];

                if (!interval) continue;

                const minZ = interval.min + currentMargin;
                const maxZ = interval.max - currentMargin;
                const safeZ = minZ <= maxZ
                    ? Math.max(minZ, Math.min(maxZ, z))
                    : (interval.min + interval.max) / 2;

                if (this._isLightingPointSafe(safeX, safeZ, points, currentMargin)) {
                    return { x: safeX, z: safeZ };
                }
            }
        }

        return center;
    }

    _getLightingProfileBounds(points) {
        const xs = points.map(point => point.x);
        const zs = points.map(point => point.z);

        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minZ: Math.min(...zs),
            maxZ: Math.max(...zs)
        };
    }

    _getLightingProfileCenter(points) {
        return {
            x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
            z: points.reduce((sum, point) => sum + point.z, 0) / points.length
        };
    }

    _getLightingZIntervalsAtX(points, x) {
        const intersections = [];

        for (let index = 0; index < points.length; index += 1) {
            const start = points[index];
            const end = points[(index + 1) % points.length];
            const crossesX = (start.x <= x && x < end.x) || (end.x <= x && x < start.x);

            if (!crossesX) continue;

            const ratio = (x - start.x) / (end.x - start.x);
            intersections.push(start.z + (end.z - start.z) * ratio);
        }

        intersections.sort((a, b) => a - b);

        const intervals = [];
        for (let index = 0; index < intersections.length - 1; index += 2) {
            intervals.push({
                min: intersections[index],
                max: intersections[index + 1]
            });
        }

        return intervals;
    }

    _isLightingPointSafe(x, z, points, margin) {
        if (!this._isPointInsideLightingProfile(x, z, points)) {
            return false;
        }

        const minDistance = points.reduce((best, start, index) => {
            const end = points[(index + 1) % points.length];
            return Math.min(best, this._distancePointToSegment(x, z, start, end));
        }, Infinity);

        return minDistance >= Math.max(0, margin * 0.92 - 0.005);
    }

    _isPointInsideLightingProfile(x, z, points) {
        let inside = false;

        for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
            const currentPoint = points[index];
            const previousPoint = points[previous];
            const intersects = ((currentPoint.z > z) !== (previousPoint.z > z)) &&
                (x < ((previousPoint.x - currentPoint.x) * (z - currentPoint.z)) /
                    ((previousPoint.z - currentPoint.z) || 1e-9) + currentPoint.x);

            if (intersects) {
                inside = !inside;
            }
        }

        return inside;
    }

    _distancePointToSegment(x, z, start, end) {
        const dx = end.x - start.x;
        const dz = end.z - start.z;
        const lengthSquared = dx * dx + dz * dz;

        if (lengthSquared <= 0.000001) {
            return Math.hypot(x - start.x, z - start.z);
        }

        const t = Math.max(0, Math.min(1, ((x - start.x) * dx + (z - start.z) * dz) / lengthSquared));
        const projectionX = start.x + dx * t;
        const projectionZ = start.z + dz * t;

        return Math.hypot(x - projectionX, z - projectionZ);
    }

    /**
     */
    getSummary() {
        return {
            dimensions: this.getParamsString(),
            totalArea: {
                walls: this.getTotalWallsArea(),
                ceiling: this.materials.ceiling.area,
                floor: this.materials.floor.area
            },
            materialsCount: this.getAllMaterials().length,
            lightsCount: this.lighting.items.length,
            furnitureCount: this.furniture.items.length,
            extrasEnabled: Object.values(this.extras).filter(v => v).length,
            isModified: this.state.isModified
        };
    }
}

// ============================================
// ============================================
const balconyBuilder = new BalconyBuilder();

// ============================================
// ============================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BalconyBuilder, balconyBuilder };
}

window.BalconyBuilder = BalconyBuilder;
window.balconyBuilder = balconyBuilder;

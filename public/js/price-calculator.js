/**
 * ============================================
 * ============================================
 */

// ============================================
// ============================================
class PriceCalculator {
    constructor() {
        this.builder = null;

        this.settings = {
            markup: {
                materials: 1.0,
                work: 1.0,
                premium: 1.25
            },

            discounts: {
                largeOrder: {
                    threshold: 200000,
                    percent: 10
                },
                mediumOrder: {
                    threshold: 150000,
                    percent: 7
                },
                smallOrder: {
                    threshold: 100000,
                    percent: 5
                }
            },

            seasonalCoefficients: {
                winter: 0.9,
                spring: 1.0,
                summer: 1.15,
                autumn: 1.05
            },

            regionalCoefficients: {
                moscow: 1.0,
                spb: 0.95,
                regions: 0.85
            }
        };

        this.cache = {
            materials: null,
            work: null,
            total: null,
            timestamp: null,
            validFor: 60000
        };

        this.callbacks = {
            onPriceChange: []
        };
    }

    // ============================================
    // ============================================

    /**
     */
    setBuilder(builder) {
        this.builder = builder;
        
        if (builder) {
            builder.subscribe(() => {
                this._invalidateCache();
                this._notifyPriceChange();
            });
        }
    }

    /**
     */
    setSettings(settings) {
        this.settings = { ...this.settings, ...settings };
        this._invalidateCache();
    }

    // ============================================
    // ============================================

    /**
     */
    calculateMaterialsCost() {
        if (!this.builder) return 0;

        const materials = this.builder.getAllMaterials();
        let total = 0;

        materials.forEach(material => {
            const materialTotal = material.price * material.quantity;
            total += materialTotal;
        });

        total *= this.settings.markup.materials;

        return Math.round(total);
    }

    /**
     */
    calculateMaterialsCostByCategory() {
        if (!this.builder) return {};

        const materials = this.builder.getAllMaterials();
        const byCategory = {};

        materials.forEach(material => {
            const category = material.category;
            if (!byCategory[category]) {
                byCategory[category] = {
                    items: [],
                    subtotal: 0
                };
            }

            const itemTotal = material.price * material.quantity;
            byCategory[category].items.push({
                ...material,
                total: itemTotal
            });
            byCategory[category].subtotal += itemTotal;
        });

        Object.keys(byCategory).forEach(category => {
            byCategory[category].subtotal = Math.round(
                byCategory[category].subtotal * this.settings.markup.materials
            );
        });

        return byCategory;
    }

    /**
     */
    getMaterialsDetail() {
        if (!this.builder) return [];

        const materials = this.builder.getAllMaterials();
        
        return materials.map(material => ({
            id: material.id,
            name: material.name,
            category: material.category,
            element: material.element,
            price: material.price,
            quantity: material.quantity,
            unit: material.unit,
            subtotal: material.price * material.quantity,
            total: Math.round(material.price * material.quantity * this.settings.markup.materials),
            color: material.color || null,
            dimensions: material.dimensions || null
        }));
    }

    // ============================================
    // ============================================

    /**
     */
    calculateWorkCost() {
        if (!this.builder) return 0;

        let total = 0;

        const baseWorkPrice = this._calculateBaseWorkPrice();
        total += baseWorkPrice;

        const materialsWorkPrice = this._calculateMaterialsWorkPrice();
        total += materialsWorkPrice;

        const extrasWorkPrice = this._calculateExtrasWorkPrice();
        total += extrasWorkPrice;

        total *= this.settings.markup.work;

        return Math.round(total);
    }

    /**
     * @private
     */
    _calculateBaseWorkPrice() {
        const { length, width, shape } = this.builder.dimensions;
        const area = length * width;

        let basePrice = MaterialsAPI.getBaseWorkPrice(length);

        if (shape === 'L-left' || shape === 'L-right') {
            basePrice *= WorkPrices.coefficients.angle;
        } else if (shape === 'P') {
            basePrice *= WorkPrices.coefficients.pShape;
        }

        return Math.round(basePrice);
    }

    /**
     * @private
     */
    _calculateMaterialsWorkPrice() {
        let total = 0;
        const { length, width, height, shape } = this.builder.dimensions;
        const options = { shape };

        Object.entries(this.builder.materials.walls).forEach(([wallName, wallData]) => {
            if (wallData.materialId && wallData.area > 0) {
                const material = MaterialsAPI.getById(wallData.materialId, 'walls');
                if (material) {
                    const workType = this._getWorkTypeForMaterial(material, 'walls');
                    const workPrice = MaterialsAPI.calculateWorkPrice(workType, wallData.area, options);
                    total += workPrice;
                }
            }
        });

        if (this.builder.materials.ceiling.materialId && this.builder.materials.ceiling.area > 0) {
            const material = MaterialsAPI.getById(
                this.builder.materials.ceiling.materialId, 
                'ceiling'
            );
            if (material) {
                const workType = this._getWorkTypeForMaterial(material, 'ceiling');
                const workPrice = MaterialsAPI.calculateWorkPrice(
                    workType, 
                    this.builder.materials.ceiling.area, 
                    options
                );
                total += workPrice;
            }
        }

        if (this.builder.materials.floor.materialId && this.builder.materials.floor.area > 0) {
            const material = MaterialsAPI.getById(
                this.builder.materials.floor.materialId, 
                'floor'
            );
            if (material) {
                const workType = this._getWorkTypeForMaterial(material, 'floor');
                const workPrice = MaterialsAPI.calculateWorkPrice(
                    workType, 
                    this.builder.materials.floor.area, 
                    options
                );
                total += workPrice;
            }
        }

        if (this.builder.glazing.windowType) {
            const windowCount = this.builder.glazing.windowSections;
            let installPrice = WorkPrices.types.windowInstall;

            if (this.builder.glazing.type === 'panoramic') {
                installPrice = WorkPrices.types.panoramicInstall;
            } else if (this.builder.glazing.windowType.id.includes('premium')) {
                installPrice = WorkPrices.types.windowPremiumInstall;
            } else if (this.builder.glazing.windowType.id.includes('aluminum')) {
                installPrice = WorkPrices.types.aluminumInstall;
            }

            total += installPrice * windowCount;
        }

        if (this.builder.materials.windowsill.materialId) {
            total += WorkPrices.types.windowsillInstall * this.builder.materials.windowsill.length;
        }
        if (this.builder.materials.sill.materialId) {
            total += WorkPrices.types.sillInstall * this.builder.materials.sill.length;
        }

        return total;
    }

    /**
     * @private
     */
    _calculateExtrasWorkPrice() {
        let total = 0;
        const extras = this.builder.extras;

        if (extras.insulation) {
            const { length, width } = this.builder.dimensions;
            const area = length * width;
            total += WorkPrices.types.insulation * area;
        }

        if (extras.wiring) {
            total += WorkPrices.types.wiring;
        }

        if (extras.floorHeating) {
            const { length, width } = this.builder.dimensions;
            const area = length * width;
            total += WorkPrices.types.floorHeating * area;
        }

        if (extras.ventilation) {
            total += WorkPrices.types.ventilation;
        }

        if (extras.demolition) {
            total += WorkPrices.types.demolition;
        }

        if (extras.disposal) {
            total += WorkPrices.types.disposal;
        }

        return total;
    }

    /**
     * @private
     */
    _getWorkTypeForMaterial(material, category) {
        const materialId = material.id.toLowerCase();

        if (category === 'walls') {
            if (materialId.includes('vagonka')) return 'wallsVagonka';
            if (materialId.includes('laminat')) return 'wallsLaminat';
            if (materialId.includes('pvh')) return 'wallsPvh';
            if (materialId.includes('mdf')) return 'wallsMdf';
            if (materialId.includes('parquet')) return 'wallsParquet';
            if (materialId.includes('brick')) return 'wallsBrick';
            if (materialId.includes('stone')) return 'wallsStone';
            if (materialId.includes('paint')) return 'wallsPaint';
            return 'wallsPvh';
        }

        if (category === 'ceiling') {
            if (materialId.includes('stretch')) return 'ceilingStretch';
            if (materialId.includes('pvh')) return 'ceilingPvh';
            if (materialId.includes('vagonka')) return 'ceilingVagonka';
            if (materialId.includes('armstrong')) return 'ceilingArmstrong';
            if (materialId.includes('gypsum')) return 'ceilingGypsum';
            return 'ceilingPvh';
        }

        if (category === 'floor') {
            if (materialId.includes('laminat')) return 'floorLaminat';
            if (materialId.includes('linoleum')) return 'floorLinoleum';
            if (materialId.includes('tile') || materialId.includes('ceramic') || materialId.includes('porcelain')) {
                return 'floorTile';
            }
            if (materialId.includes('parquet')) return 'floorParquet';
            if (materialId.includes('cork')) return 'floorCork';
            if (materialId.includes('vinyl')) return 'floorVinyl';
            return 'floorLaminat';
        }

        return '';
    }

    /**
     */
    getWorkDetail() {
        if (!this.builder) return [];

        const detail = [];

        const basePrice = this._calculateBaseWorkPrice();
        detail.push({
            id: 'base_work',
            name: '������� ������',
            description: `���������� � �������� ������ ��� ������� ${this.builder.dimensions.length}�`,
            quantity: 1,
            unit: '��������',
            price: basePrice,
            total: basePrice
        });

        const materialsWork = this._calculateMaterialsWorkPrice();
        if (materialsWork > 0) {
            detail.push({
                id: 'materials_work',
                name: '������ ����������',
                description: '��������� ��������� ���������� �������',
                quantity: 1,
                unit: '��������',
                price: materialsWork,
                total: materialsWork
            });
        }

        const extras = this.builder.extras;
        
        if (extras.insulation) {
            const { length, width } = this.builder.dimensions;
            const area = length * width;
            const price = WorkPrices.types.insulation * area;
            detail.push({
                id: 'insulation',
                name: '���������',
                description: '����������� ��������� �������',
                quantity: area,
                unit: '�?',
                price: WorkPrices.types.insulation,
                total: price
            });
        }

        if (extras.wiring) {
            detail.push({
                id: 'wiring',
                name: '���������',
                description: '�������� ���������, ��������� ������� � ������������',
                quantity: 1,
                unit: '��������',
                price: WorkPrices.types.wiring,
                total: WorkPrices.types.wiring
            });
        }

        if (extras.floorHeating) {
            const { length, width } = this.builder.dimensions;
            const area = length * width;
            const price = WorkPrices.types.floorHeating * area;
            detail.push({
                id: 'floor_heating',
                name: 'Ҹ���� ���',
                description: '��������� ������� ������ ����',
                quantity: area,
                unit: '�?',
                price: WorkPrices.types.floorHeating,
                total: price
            });
        }

        if (extras.ventilation) {
            detail.push({
                id: 'ventilation',
                name: '����������',
                description: '��������� ��������� ����������',
                quantity: 1,
                unit: '��������',
                price: WorkPrices.types.ventilation,
                total: WorkPrices.types.ventilation
            });
        }

        if (extras.demolition) {
            detail.push({
                id: 'demolition',
                name: '��������',
                description: '�������� ������ �������',
                quantity: 1,
                unit: '��������',
                price: WorkPrices.types.demolition,
                total: WorkPrices.types.demolition
            });
        }

        if (extras.disposal) {
            detail.push({
                id: 'disposal',
                name: '����� ������',
                description: '����� ������������� ������',
                quantity: 1,
                unit: '��������',
                price: WorkPrices.types.disposal,
                total: WorkPrices.types.disposal
            });
        }

        return detail;
    }

    // ============================================
    // ============================================

    /**
     */
    calculateTotal() {
        if (this._isCacheValid()) {
            return this.cache.total;
        }

        const materialsCost = this.calculateMaterialsCost();
        const workCost = this.calculateWorkCost();
        const subtotal = materialsCost + workCost;

        const discount = this._calculateDiscount(subtotal);
        const total = subtotal - discount;

        this.cache.total = Math.round(total);
        this.cache.timestamp = Date.now();

        return this.cache.total;
    }

    /**
     * @private
     */
    _calculateDiscount(subtotal) {
        const { discounts } = this.settings;
        let discountPercent = 0;

        if (subtotal >= discounts.largeOrder.threshold) {
            discountPercent = discounts.largeOrder.percent;
        } else if (subtotal >= discounts.mediumOrder.threshold) {
            discountPercent = discounts.mediumOrder.percent;
        } else if (subtotal >= discounts.smallOrder.threshold) {
            discountPercent = discounts.smallOrder.percent;
        }

        return Math.round(subtotal * discountPercent / 100);
    }

    /**
     */
    getDiscountPercent() {
        const subtotal = this.calculateMaterialsCost() + this.calculateWorkCost();
        const { discounts } = this.settings;

        if (subtotal >= discounts.largeOrder.threshold) {
            return discounts.largeOrder.percent;
        } else if (subtotal >= discounts.mediumOrder.threshold) {
            return discounts.mediumOrder.percent;
        } else if (subtotal >= discounts.smallOrder.threshold) {
            return discounts.smallOrder.percent;
        }

        return 0;
    }

    /**
     */
    getDetailedBreakdown() {
        const materialsCost = this.calculateMaterialsCost();
        const workCost = this.calculateWorkCost();
        const subtotal = materialsCost + workCost;
        const discount = this._calculateDiscount(subtotal);
        const total = subtotal - discount;

        return {
            materials: {
                total: materialsCost,
                byCategory: this.calculateMaterialsCostByCategory(),
                items: this.getMaterialsDetail()
            },
            work: {
                total: workCost,
                items: this.getWorkDetail()
            },
            pricing: {
                subtotal: subtotal,
                discount: discount,
                discountPercent: this.getDiscountPercent(),
                total: Math.round(total)
            },
            summary: {
                params: this.builder?.getParamsString() || '',
                areas: {
                    walls: this.builder?.getTotalWallsArea() || 0,
                    ceiling: this.builder?.getArea('ceiling') || 0,
                    floor: this.builder?.getArea('floor') || 0
                },
                itemCount: this.builder?.getAllMaterials().length || 0
            }
        };
    }

    /**
     */
    getEstimate() {
        const breakdown = this.getDetailedBreakdown();

        return {
            header: {
                title: '����� �� ������� �������',
                date: new Date().toLocaleDateString('ru-RU'),
                params: breakdown.summary.params
            },
            areas: breakdown.summary.areas,
            materials: {
                total: this.formatPrice(breakdown.materials.total),
                items: breakdown.materials.items.map(item => ({
                    name: item.name,
                    element: this._getElementName(item.element),
                    quantity: `${item.quantity} ${item.unit}`,
                    price: this.formatPrice(item.price),
                    total: this.formatPrice(item.total)
                }))
            },
            work: {
                total: this.formatPrice(breakdown.work.total),
                items: breakdown.work.items.map(item => ({
                    name: item.name,
                    description: item.description,
                    total: this.formatPrice(item.total)
                }))
            },
            totals: {
                subtotal: this.formatPrice(breakdown.pricing.subtotal),
                discount: breakdown.pricing.discountPercent > 0 
                    ? `-${breakdown.pricing.discountPercent}% (${this.formatPrice(breakdown.pricing.discount)})`
                    : null,
                total: this.formatPrice(breakdown.pricing.total)
            },
            notes: [
                '* ��������� �������� ���������������',
                '** ������ ������ ����� ����������� ������',
                '*** �������� �� ��� ������ 5 ���'
            ]
        };
    }

    // ============================================
    // ============================================

    /**
     */
    formatPrice(price) {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(price);
    }

    /**
     */
    formatArea(area) {
        return `${area.toFixed(1)} �?`;
    }

    /**
     */
    formatDimensions(dimensions) {
        return `${dimensions.length}� ? ${dimensions.width}� ? ${dimensions.height}�`;
    }

    /**
     * @private
     */
    _getElementName(element) {
        const names = {
            'wall_front': '�������� �����',
            'wall_left': '����� �����',
            'wall_right': '������ �����',
            'wall_back': '������ �����',
            'ceiling': '�������',
            'floor': '���',
            'windows': '����',
            'windowsill': '����������',
            'sill': '�����',
            'lighting': '���������',
            'furniture': '������'
        };
        return names[element] || element;
    }

    // ============================================
    // ============================================

    /**
     * @private
     */
    _isCacheValid() {
        if (!this.cache.timestamp) return false;
        const age = Date.now() - this.cache.timestamp;
        return age < this.cache.validFor;
    }

    /**
     * @private
     */
    _invalidateCache() {
        this.cache = {
            materials: null,
            work: null,
            total: null,
            timestamp: null,
            validFor: 60000
        };
    }

    /**
     */
    clearCache() {
        this._invalidateCache();
    }

    // ============================================
    // ============================================

    /**
     */
    subscribeToPriceChange(callback) {
        if (typeof callback === 'function') {
            this.callbacks.onPriceChange.push(callback);
        }
    }

    /**
     */
    unsubscribeFromPriceChange(callback) {
        this.callbacks.onPriceChange = this.callbacks.onPriceChange.filter(cb => cb !== callback);
    }

    /**
     * @private
     */
    _notifyPriceChange() {
        const total = this.calculateTotal();
        this.callbacks.onPriceChange.forEach(callback => {
            try {
                callback(total, this.getDetailedBreakdown());
            } catch (error) {
                console.error('Error in price callback:', error);
            }
        });
    }

    // ============================================
    // ============================================

    /**
     */
    exportToJSON() {
        return {
            estimate: this.getEstimate(),
            breakdown: this.getDetailedBreakdown(),
            generatedAt: new Date().toISOString(),
            version: '2.0.0'
        };
    }

    /**
     */
    exportForPrint() {
        const estimate = this.getEstimate();
        
        return {
            ...estimate,
            printDate: new Date().toLocaleString('ru-RU'),
            company: {
                name: 'BalconyPro',
                phone: '+7 (999) 123-45-67',
                email: 'info@balconypro.ru',
                website: 'www.balconypro.ru'
            }
        };
    }

    /**
     */
    generateMessageText() {
        const breakdown = this.getDetailedBreakdown();
        const total = breakdown.pricing.total;
        const discount = breakdown.pricing.discountPercent;

        let text = `?? *������ ��������� �������*\n\n`;
        text += `?? *���������:*\n${breakdown.summary.params}\n\n`;
        text += `?? *�������:*\n`;
        text += `� �����: ${breakdown.summary.areas.walls} �?\n`;
        text += `� �������: ${breakdown.summary.areas.ceiling} �?\n`;
        text += `� ���: ${breakdown.summary.areas.floor} �?\n\n`;
        text += `?? *���������:*\n`;
        text += `� ���������: ${this.formatPrice(breakdown.materials.total)}\n`;
        text += `� ������: ${this.formatPrice(breakdown.work.total)}\n`;
        
        if (discount > 0) {
            text += `� ������: -${discount}%\n`;
        }
        
        text += `\n? *�����: ${this.formatPrice(total)}*\n\n`;
        text += `?? ��� ������ �������: +7 (999) 123-45-67`;

        return text;
    }

    // ============================================
    // ============================================

    /**
     */
    static compareConfigurations(builder1, builder2) {
        const calc1 = new PriceCalculator();
        const calc2 = new PriceCalculator();
        
        calc1.setBuilder(builder1);
        calc2.setBuilder(builder2);

        const breakdown1 = calc1.getDetailedBreakdown();
        const breakdown2 = calc2.getDetailedBreakdown();

        const diff = {
            materials: breakdown1.materials.total - breakdown2.materials.total,
            work: breakdown1.work.total - breakdown2.work.total,
            total: breakdown1.pricing.total - breakdown2.pricing.total,
            percent: Math.round(
                ((breakdown1.pricing.total - breakdown2.pricing.total) / breakdown2.pricing.total) * 100
            )
        };

        return {
            config1: {
                params: builder1.getParamsString(),
                total: breakdown1.pricing.total,
                breakdown: breakdown1
            },
            config2: {
                params: builder2.getParamsString(),
                total: breakdown2.pricing.total,
                breakdown: breakdown2
            },
            difference: diff,
            cheaper: diff.total < 0 ? 'config1' : 'config2'
        };
    }
}

// Переопределения после восстановления кодировки: русские названия работ/элементов и единицы.
PriceCalculator.prototype.getWorkDetail = function() {
    if (!this.builder) return [];

    const detail = [];
    const basePrice = this._calculateBaseWorkPrice();

    detail.push({
        id: 'base_work',
        name: 'Базовые работы',
        description: `Подготовка и монтаж для балкона длиной ${this.builder.dimensions.length} м`,
        quantity: 1,
        unit: 'комплект',
        price: basePrice,
        total: basePrice
    });

    const materialsWork = this._calculateMaterialsWorkPrice();
    if (materialsWork > 0) {
        detail.push({
            id: 'materials_work',
            name: 'Монтаж материалов',
            description: 'Установка выбранных отделочных материалов',
            quantity: 1,
            unit: 'комплект',
            price: materialsWork,
            total: materialsWork
        });
    }

    const extras = this.builder.extras;

    if (extras.insulation) {
        const { length, width } = this.builder.dimensions;
        const area = length * width;
        detail.push({
            id: 'insulation',
            name: 'Утепление',
            description: 'Монтаж утеплителя по площади пола',
            quantity: area,
            unit: 'м²',
            price: WorkPrices.types.insulation,
            total: WorkPrices.types.insulation * area
        });
    }

    if (extras.wiring) {
        detail.push({
            id: 'wiring',
            name: 'Электрика',
            description: 'Прокладка кабеля, розеток и освещения',
            quantity: 1,
            unit: 'комплект',
            price: WorkPrices.types.wiring,
            total: WorkPrices.types.wiring
        });
    }

    if (extras.floorHeating) {
        const { length, width } = this.builder.dimensions;
        const area = length * width;
        detail.push({
            id: 'floor_heating',
            name: 'Тёплый пол',
            description: 'Монтаж системы тёплого пола',
            quantity: area,
            unit: 'м²',
            price: WorkPrices.types.floorHeating,
            total: WorkPrices.types.floorHeating * area
        });
    }

    if (extras.ventilation) {
        detail.push({
            id: 'ventilation',
            name: 'Вентиляция',
            description: 'Монтаж вентиляционного оборудования',
            quantity: 1,
            unit: 'комплект',
            price: WorkPrices.types.ventilation,
            total: WorkPrices.types.ventilation
        });
    }

    if (extras.demolition) {
        detail.push({
            id: 'demolition',
            name: 'Демонтаж',
            description: 'Демонтаж старой отделки',
            quantity: 1,
            unit: 'комплект',
            price: WorkPrices.types.demolition,
            total: WorkPrices.types.demolition
        });
    }

    if (extras.disposal) {
        detail.push({
            id: 'disposal',
            name: 'Вывоз мусора',
            description: 'Вывоз строительного мусора',
            quantity: 1,
            unit: 'комплект',
            price: WorkPrices.types.disposal,
            total: WorkPrices.types.disposal
        });
    }

    return detail;
};

PriceCalculator.prototype.getEstimate = function() {
    const breakdown = this.getDetailedBreakdown();

    return {
        header: {
            title: 'Смета по конфигурации балкона',
            date: new Date().toLocaleDateString('ru-RU'),
            params: breakdown.summary.params
        },
        areas: breakdown.summary.areas,
        materials: {
            total: this.formatPrice(breakdown.materials.total),
            items: breakdown.materials.items.map((item) => ({
                name: item.name,
                element: this._getElementName(item.element),
                quantity: `${item.quantity} ${item.unit}`,
                price: this.formatPrice(item.price),
                total: this.formatPrice(item.total)
            }))
        },
        work: {
            total: this.formatPrice(breakdown.work.total),
            items: breakdown.work.items.map((item) => ({
                name: item.name,
                description: item.description,
                total: this.formatPrice(item.total)
            }))
        },
        totals: {
            subtotal: this.formatPrice(breakdown.pricing.subtotal),
            discount: breakdown.pricing.discountPercent > 0
                ? `-${breakdown.pricing.discountPercent}% (${this.formatPrice(breakdown.pricing.discount)})`
                : null,
            total: this.formatPrice(breakdown.pricing.total)
        },
        notes: [
            '* Итоговая стоимость зависит от фактических замеров',
            '** Сроки работ уточняются после выезда мастера',
            '*** Гарантия на работы до 5 лет'
        ]
    };
};

PriceCalculator.prototype.formatArea = function(area) {
    return `${area.toFixed(1)} м²`;
};

PriceCalculator.prototype.formatDimensions = function(dimensions) {
    return `${dimensions.length} м x ${dimensions.width} м x ${dimensions.height} м`;
};

PriceCalculator.prototype._getElementName = function(element) {
    const names = {
        'wall_front': 'Передняя стена',
        'wall_left': 'Левая стена',
        'wall_right': 'Правая стена',
        'wall_back': 'Задняя стена',
        'ceiling': 'Потолок',
        'floor': 'Пол',
        'windows': 'Окна',
        'windowsill': 'Подоконник',
        'sill': 'Порог',
        'lighting': 'Освещение',
        'furniture': 'Мебель'
    };
    return names[element] || element;
};

PriceCalculator.prototype.generateMessageText = function() {
    const breakdown = this.getDetailedBreakdown();
    const total = breakdown.pricing.total;
    const discount = breakdown.pricing.discountPercent;

    let text = `Смета по вашему балкону\n\n`;
    text += `Параметры:\n${breakdown.summary.params}\n\n`;
    text += `Площади:\n`;
    text += `- Стены: ${breakdown.summary.areas.walls} м²\n`;
    text += `- Потолок: ${breakdown.summary.areas.ceiling} м²\n`;
    text += `- Пол: ${breakdown.summary.areas.floor} м²\n\n`;
    text += `Стоимость:\n`;
    text += `- Материалы: ${this.formatPrice(breakdown.materials.total)}\n`;
    text += `- Работы: ${this.formatPrice(breakdown.work.total)}\n`;
    if (discount > 0) {
        text += `- Скидка: -${discount}%\n`;
    }
    text += `\nИтого: ${this.formatPrice(total)}\n\n`;
    text += `Контакт: +7 (999) 123-45-67`;

    return text;
};

// ============================================
// ============================================
const priceCalculator = new PriceCalculator();

// ============================================
// ============================================
(function initCalculator() {
    console.log('?? PriceCalculator initialized');
    console.log('Default settings:', priceCalculator.settings);
})();

// ============================================
// ============================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PriceCalculator, priceCalculator };
}

window.PriceCalculator = PriceCalculator;
window.priceCalculator = priceCalculator;

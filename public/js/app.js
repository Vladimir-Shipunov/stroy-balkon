/**
 * ============================================
 * BALCONY PRO - ОСНОВНОЕ ПРИЛОЖЕНИЕ
 * Версия: 2.0.0
 * ============================================
 * Главный файл приложения: инициализация и управление компонентами.
 */

// ============================================
// 1. Глобальное состояние приложения
// ============================================
const App = {
    // Компоненты
    builder: null,
    calculator: null,
    visualizer: null,
    orderHandler: null,

    // Элементы UI
    elements: {},

    // Состояние
    state: {
        isInitialized: false,
        isLoading: true,
        currentTab: 'materials',
        placementMode: null,
        editingFurnitureId: null,
        selectedFurnitureId: null,
        selectedElement: 'walls_all',
        wallSelectionMode: 'linked',
        lightingType: 'ceiling',
        visualizerInViewport: true,
        materialVariantsBaseByCategory: {
            walls: null,
            ceiling: null,
            floor: null
        }
    },

    // Настройки
    summaryPanelController: {
        autoCollapseDelayMs: 10000,
        collapseTimer: null,
        isCollapsed: true
    },

    config: {
        debug: false,
        autoSave: false,
        notifications: false,
        suppressPopups: true,
        analytics: false,
        enableServiceWorker: false,
        heroSlider: {
            endpoint: '/api/hero-slides',
            fallback: '/assets/images/hero-slider/01-stone-lodgia.svg',
            intervalMs: 5000
        },
        gallery: {
            endpoint: '/api/gallery'
        }
    }
};

// ============================================
// 2. Инициализация приложения
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('Запуск BalconyPro...');
    console.log('Version: 2.0.0');
    App.initGlobalErrorHandlers();
    
    App.init();
});

App.initGlobalErrorHandlers = function() {
    if (this._globalErrorHandlersBound) return;
    this._globalErrorHandlersBound = true;

    window.addEventListener('error', (event) => {
        const message = event?.error?.message || event?.message || 'Неизвестная ошибка интерфейса';
        console.error('Runtime error:', event?.error || message);
        this.handleRuntimeError(message);
    });

    window.addEventListener('unhandledrejection', (event) => {
        const reason = event?.reason;
        const message = reason?.message || String(reason || 'Неизвестная ошибка Promise');
        console.error('Unhandled promise rejection:', reason || message);
        this.handleRuntimeError(message);
    });
};

App.handleRuntimeError = function(message) {
    const userMessage = /429|too many|rate limit/i.test(String(message))
        ? 'Сервер временно ограничил запросы. Подождите несколько секунд.'
        : 'Произошла ошибка. Приложение продолжает работать.';

    this.showToast?.(userMessage, 'error');
};

/**
 * Инициализировать приложение
 */
App.init = async function() {
    try {
        this.showLoading();

        await this.initComponents();
        await this.loadMaterialAssetOverrides();

        this.cacheElements();

        this.initUI();

        this.initEventListeners();

        this.initMaterialTabs();
        
        this.initVisualizerControls();

        this.linkComponents();

        this.initPerformanceOptimizations();

        this.loadSavedData();

        this.hideLoading();

        this.state.isInitialized = true;

        console.log('Приложение успешно инициализировано');

    } catch (error) {
        console.error('Ошибка инициализации приложения:', error);
        this.showError('Ошибка загрузки приложения. Обновите страницу.');
    }
};

/**
 */
App.initComponents = async function() {
    // BalconyBuilder
    this.builder = window.balconyBuilder || new BalconyBuilder();
    console.log('✅ Builder initialized');

    this.calculator = null;

    // BalconyVisualizer
    this.visualizer = new BalconyVisualizer('balcony3d', {
        width: 800,
        height: 600,
        backgroundColor: 0x87ceeb,
        quality: {
            antialias: true,
            shadowMap: true,
            pixelRatio: Math.min(window.devicePixelRatio, 1.25)
        }
    });
    this.visualizer.setBuilder(this.builder);
    console.log('Визуализатор инициализирован');

    // OrderHandler
    this.orderHandler = window.orderHandler || new OrderHandler({
        apiUrl: '/api',
        timeout: 30000,
        retryAttempts: 3,
        autoSave: this.config.autoSave,
        validatePhone: true,
        validateEmail: true
    });
    console.log('OrderHandler инициализирован');
};

/**
 */
App.cacheElements = function() {
    this.elements = {
        configurator: document.getElementById('configurator'),
        visualizerContainer: document.getElementById('visualizerContainer'),
        visualizerOverlay: document.getElementById('visualizerOverlay'),
        configGalleryTabs: document.getElementById('configGalleryTabs'),
        configGalleryGrid: document.getElementById('configGalleryGrid'),
        configGalleryCount: document.getElementById('configGalleryCount'),
        
        sidebarLeft: document.querySelector('.config-sidebar-left'),
        sidebarRight: document.querySelector('.config-sidebar-right'),
        summaryPanel: document.getElementById('summaryPanel'),
        
        tabs: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content'),
        
        materialsGrid: document.getElementById('materialsGrid'),
        elementSelect: document.getElementById('elementSelect'),
        colorElementSelect: document.getElementById('colorElementSelect'),
        materialPreview: document.getElementById('materialPreview'),
        previewMaterialName: document.getElementById('previewMaterialName'),
        previewTexture: document.getElementById('previewTexture'),
        previewUnit: document.getElementById('previewUnit'),
        previewDescription: document.getElementById('previewDescription'),
        
        colorGrid: document.getElementById('colorGrid'),
        paletteGrid: document.getElementById('paletteGrid'),
        customColorPicker: document.getElementById('customColorPicker'),
        customColorHex: document.getElementById('customColorHex'),
        currentColorPreview: document.getElementById('currentColorPreview'),
        currentColorHex: document.getElementById('currentColorHex'),
        currentColorName: document.getElementById('currentColorName'),
        
        furnitureGrid: document.getElementById('furnitureGrid'),
        placedFurnitureList: document.getElementById('placedFurnitureList'),
        cabinetColorPanel: document.getElementById('cabinetColorPanel'),
        cabinetColorSwatches: document.getElementById('cabinetColorSwatches'),
        cabinetColorPicker: document.getElementById('cabinetColorPicker'),
        cabinetColorApply: document.getElementById('cabinetColorApply'),
        cabinetColorStatus: document.getElementById('cabinetColorStatus'),
        
        lightingGrid: document.getElementById('lightingGrid'),
        placedLightingList: document.getElementById('placedLightingList'),
        
        summaryParams: document.getElementById('summaryParams'),
        summaryArea: document.getElementById('summaryArea'),
        summaryMaterials: document.getElementById('summaryMaterials'),
        summaryWorks: document.getElementById('summaryWorks'),
        
        orderModal: document.getElementById('orderModal'),
        requestModal: document.getElementById('requestModal'),
        orderForm: document.getElementById('orderForm'),
        requestForm: document.getElementById('requestForm'),
        orderSummaryContent: document.getElementById('orderSummaryContent'),
        
        toastContainer: document.getElementById('toastContainer'),
        
        header: document.getElementById('header'),
        navMenu: document.getElementById('navMenu'),
        mobileMenuBtn: document.getElementById('mobileMenuBtn'),
        
        placementModeIndicator: document.getElementById('placementModeIndicator'),
        placementModeName: document.getElementById('placementModeName'),
        glazingLayoutSwitch: document.getElementById('glazingLayoutSwitch'),
        glazingSideSwitch: document.getElementById('glazingSideSwitch'),
        entranceTypeSwitch: document.getElementById('entranceTypeSwitch'),
        entranceSideSwitch: document.getElementById('entranceSideSwitch'),
        entranceWidth: document.getElementById('entranceWidth'),
        entranceHeight: document.getElementById('entranceHeight'),
        entranceWidthValue: document.getElementById('entranceWidthValue'),
        entranceHeightValue: document.getElementById('entranceHeightValue')
    };
};

/**
 */
App.initUI = function() {
    this.clearTransientPanels();
    this.ensureShapeVariants();
    this.syncWallSelectionMode();
    const summaryPrimaryAction = document.querySelector('#summaryPanel .btn-primary');
    if (summaryPrimaryAction) {
        summaryPrimaryAction.textContent = 'Заказать замер';
    }
    this.renderMaterials();
    
    this.renderColors();
    
    this.renderFurniture();
    this.renderCabinetColorControls();
    
    this.renderLighting();
    
    this.syncDimensionControls();
    this.updateSummary(true);
    
    this.initTabs();
    
    this.initMobileMenu();

    this.initActiveNavigation();
    this.initAnchorScrolling();
    
    this.initHeroSlider();
    this.initConfigGallery();

    this.initSummaryPanelBehavior();
    this.initHeaderScroll();
};

App.initConfigGallery = async function() {
    if (!this.elements.configGalleryTabs || !this.elements.configGalleryGrid) return;

    this.state.gallerySections = [];
    this.state.activeGallerySection = this.state.activeGallerySection || 'before';
    this.elements.configGalleryGrid.innerHTML = `
        <div class="config-gallery-empty">
            <span class="config-gallery-empty-icon">📷</span>
            <span>Загрузка галереи...</span>
        </div>
    `;

    try {
        const response = await fetch(this.config.gallery.endpoint, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Gallery request failed: ${response.status}`);
        }

        const data = await response.json();
        const sections = Array.isArray(data.sections) ? data.sections : [];
        this.state.gallerySections = sections;

        if (!sections.some((section) => section.id === this.state.activeGallerySection)) {
            this.state.activeGallerySection = sections[0]?.id || 'before';
        }

        this.renderConfigGallery();
    } catch (error) {
        console.error('Gallery init error:', error);
        this.elements.configGalleryTabs.innerHTML = '';
        this.elements.configGalleryGrid.innerHTML = `
            <div class="config-gallery-empty">
                <span class="config-gallery-empty-icon">📷</span>
                <span>Галерея временно недоступна</span>
            </div>
        `;
    }
};

App.renderConfigGallery = function() {
    const tabs = this.elements.configGalleryTabs;
    const grid = this.elements.configGalleryGrid;
    if (!tabs || !grid) return;

    const sections = this.state.gallerySections || [];
    const activeId = this.state.activeGallerySection || sections[0]?.id;
    const activeSection = sections.find((section) => section.id === activeId) || sections[0];
    const totalCount = sections.reduce((sum, section) => sum + (section.images?.length || 0), 0);

    if (this.elements.configGalleryCount) {
        this.elements.configGalleryCount.textContent = this.formatPhotoCount(totalCount);
    }

    tabs.innerHTML = sections.map((section) => {
        const count = section.images?.length || 0;
        const isActive = section.id === activeSection?.id;
        return `
            <button class="config-gallery-tab ${isActive ? 'active' : ''}" type="button" onclick="App.selectConfigGallerySection('${this.escapeHtml(section.id)}')">
                <span>${this.escapeHtml(section.title)}</span>
                <small>${count}</small>
            </button>
        `;
    }).join('');

    if (!activeSection || !activeSection.images?.length) {
        grid.innerHTML = `
            <div class="config-gallery-empty">
                <span class="config-gallery-empty-icon">📷</span>
                <span>Пока нет фото</span>
            </div>
        `;
        return;
    }

    grid.innerHTML = activeSection.images.map((image) => `
        <a class="config-gallery-item" href="${this.escapeHtml(image.url)}" target="_blank" rel="noopener">
            <img src="${this.escapeHtml(image.url)}" alt="${this.escapeHtml(activeSection.title)}" loading="lazy">
        </a>
    `).join('');
};

App.selectConfigGallerySection = function(sectionId) {
    this.state.activeGallerySection = sectionId;
    this.renderConfigGallery();
};

App.formatPhotoCount = function(count) {
    const value = Number(count) || 0;
    const mod10 = value % 10;
    const mod100 = value % 100;

    if (mod10 === 1 && mod100 !== 11) {
        return `${value} фото`;
    }

    return `${value} фото`;
};

App.escapeHtml = function(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

/**
 */
App.initVisualizerControls = function() {
    const controlBtns = document.querySelectorAll('.control-btn');
    
    controlBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.currentTarget.dataset.action;
            const view = e.currentTarget.dataset.view;
            
            if (action) {
                this.handleCameraAction(action);
                
                document.querySelectorAll('.control-btn[data-action]').forEach(b => {
                    b.classList.remove('active');
                });
            }
            
            if (view) {
                document.querySelectorAll('.control-btn[data-view]').forEach(b => {
                    b.classList.remove('active');
                });
                
                e.currentTarget.classList.add('active');
                
                if (this.visualizer) {
                    switch(view) {
                        case 'front':
                            this.visualizer.setView('front');
                            break;
                        case 'top':
                            this.visualizer.setView('top');
                            break;
                        case 'side':
                            this.visualizer.setView('side');
                            break;
                        case 'iso':
                            this.visualizer.setView('iso');
                            break;
                    }
                }
            }
        });
    });
};

App.initHeroSlider = async function() {
    const slides = Array.from(document.querySelectorAll('.hero-slide'));
    if (slides.length < 2) return;

    const config = this.config.heroSlider;
    const fallback = config.fallback;
    const urls = await this.resolveHeroSlideUrls();
    const slideUrls = urls.length ? urls : [fallback];
    let currentIndex = 0;
    let activeLayer = 0;

    if (this.heroSliderTimer) {
        window.clearInterval(this.heroSliderTimer);
        this.heroSliderTimer = null;
    }

    const setSlideImage = (layer, url) => {
        layer.style.backgroundImage = `url("${url}")`;
        layer.classList.remove('is-active');
        layer.offsetHeight;
        layer.classList.add('is-active');
    };

    slides.forEach((slide) => {
        slide.classList.remove('is-active');
        slide.style.backgroundImage = `url("${fallback}")`;
    });

    setSlideImage(slides[activeLayer], slideUrls[currentIndex]);

    if (slideUrls.length < 2) {
        return;
    }

    this.heroSliderTimer = window.setInterval(() => {
        currentIndex = (currentIndex + 1) % slideUrls.length;
        const nextLayer = activeLayer === 0 ? 1 : 0;

        setSlideImage(slides[nextLayer], slideUrls[currentIndex]);
        slides[activeLayer].classList.remove('is-active');
        activeLayer = nextLayer;
    }, config.intervalMs);
};

App.resolveHeroSlideUrls = async function() {
    const config = this.config.heroSlider;
    try {
        const response = await fetch(config.endpoint, { cache: 'no-store' });
        if (!response.ok) return [];

        const data = await response.json();
        if (!data?.success || !Array.isArray(data.slides)) return [];

        return data.slides.filter((url) => typeof url === 'string' && url.trim());
    } catch (error) {
        console.warn('Hero slider photos are unavailable:', error);
        return [];
    }
};

/**
 */
App.initEventListeners = function() {
    this.initModalOutsideClose();

    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && this.state.placementMode) {
            this.cancelPlacementMode();
        }
    });

    document.querySelectorAll('.size-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const size = e.currentTarget.dataset.size;
            this.selectSize(size);
        });
    });

    const customSizeInput = document.getElementById('customSize');
    if (customSizeInput) {
        customSizeInput.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            if (value && value >= 2 && value <= 20) {
                this.builder.setLength(value);
                this.updateSummary();
            }
        });
    }

    const widthRange = document.getElementById('widthRange');
    const widthValue = document.getElementById('widthValue');
    if (widthRange && widthValue) {
        let widthCommitTimer = null;
        const commitWidth = (rawValue) => {
            const value = parseFloat(rawValue);
            if (!Number.isFinite(value)) return;
            this.builder.setWidth(value);
            widthValue.textContent = `${value} \u043c`;
            this.updateSummary();
        };

        widthRange.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            widthValue.textContent = `${value} \u043c`;

            clearTimeout(widthCommitTimer);
            widthCommitTimer = setTimeout(() => {
                commitWidth(value);
            }, 90);
        });

        widthRange.addEventListener('change', (e) => {
            clearTimeout(widthCommitTimer);
            commitWidth(e.target.value);
        });
    }

    const heightRange = document.getElementById('heightRange');
    const heightValue = document.getElementById('heightValue');
    if (heightRange && heightValue) {
        let heightCommitTimer = null;
        const commitHeight = (rawValue) => {
            const value = parseFloat(rawValue);
            if (!Number.isFinite(value)) return;
            this.builder.setHeight(value);
            heightValue.textContent = `${value} \u043c`;
            this.updateSummary();
        };

        heightRange.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            heightValue.textContent = `${value} \u043c`;

            clearTimeout(heightCommitTimer);
            heightCommitTimer = setTimeout(() => {
                commitHeight(value);
            }, 90);
        });

        heightRange.addEventListener('change', (e) => {
            clearTimeout(heightCommitTimer);
            commitHeight(e.target.value);
        });
    }

    document.querySelectorAll('.shape-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const shape = e.currentTarget.dataset.shape;
            this.selectShape(shape);
        });
    });

    const glazingType = document.getElementById('glazingType');
    if (glazingType) {
        glazingType.addEventListener('change', (e) => {
            this.builder.setGlazingType(e.target.value);
            this.visualizer?.requestUpdate?.();
            this.syncGlazingLayoutMode();
            this.syncDimensionControls();
            this.updateSummary(true);
        });
    }

    if (this.elements.glazingLayoutSwitch) {
        this.elements.glazingLayoutSwitch.querySelectorAll('[data-glazing-layout]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                this.applyGlazingLayout(e.currentTarget.dataset.glazingLayout);
            });
        });
    }

    if (this.elements.glazingSideSwitch) {
        this.elements.glazingSideSwitch.querySelectorAll('[data-glazing-side]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                this.applyGlazingSide(e.currentTarget.dataset.glazingSide);
            });
        });
    }

    if (this.elements.entranceTypeSwitch) {
        this.elements.entranceTypeSwitch.querySelectorAll('[data-entrance-type]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                this.applyEntranceType(e.currentTarget.dataset.entranceType);
            });
        });
    }

    if (this.elements.entranceSideSwitch) {
        this.elements.entranceSideSwitch.querySelectorAll('[data-entrance-mirror]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                this.applyEntranceMirror(e.currentTarget.dataset.entranceMirror === 'true');
            });
        });
    }

    const applyEntranceSizeFromInputs = () => {
        this.applyEntranceSize(
            Number(this.elements.entranceWidth?.value),
            Number(this.elements.entranceHeight?.value)
        );
    };
    this.elements.entranceWidth?.addEventListener('input', applyEntranceSizeFromInputs);
    this.elements.entranceHeight?.addEventListener('input', applyEntranceSizeFromInputs);

    const windowSections = document.getElementById('windowSections');
    if (windowSections) {
        windowSections.addEventListener('change', (e) => {
            this.builder.setWindowSections(e.target.value);
            this.visualizer?.requestUpdate?.();
            this.updateSummary(true);
        });
    }

    ['needInsulation', 'needWiring', 'needFloorHeating', 'needVentilation'].forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                const option = id.replace('need', '').toLowerCase();
                this.builder.setExtraOption(option, e.target.checked);
                this.updateSummary();
            });
        }
    });

    // ============================================
    // ============================================
    
    document.querySelectorAll('[data-wall-mode]').forEach((btn) => {
        btn.addEventListener('click', () => {
            this.state.wallSelectionMode = btn.dataset.wallMode;
            this.syncWallSelectionMode();
        });
    });

    if (this.elements.elementSelect) {
        this.elements.elementSelect.addEventListener('change', (e) => {
            const nextElement = String(e.target.value || 'walls_all');
            this.state.selectedElement = nextElement;
            const nextCategory = this.getCategoryForElement(nextElement);
            this.state.materialVariantsBaseByCategory[nextCategory] = null;
            this.renderMaterialsForCategory(nextCategory);
        });
    }

    // ============================================
    // ============================================
    
    if (this.elements.paletteGrid) {
        this.elements.paletteGrid.addEventListener('click', (e) => {
            const paletteBtn = e.target.closest('.palette-btn');
            if (paletteBtn) {
                const palette = paletteBtn.dataset.palette;
                this.selectPalette(palette);
            }
        });
    }

    if (this.elements.colorGrid) {
        this.elements.colorGrid.addEventListener('click', (e) => {
            const colorBtn = e.target.closest('.color-btn');
            if (colorBtn) {
                const color = colorBtn.dataset.color;
                this.selectColor(color);
            }
        });
    }

    if (this.elements.customColorPicker) {
        this.elements.customColorPicker.addEventListener('input', (e) => {
            this.elements.customColorHex.value = e.target.value;
        });
    }

    if (this.elements.customColorHex) {
        this.elements.customColorHex.addEventListener('input', (e) => {
            let value = e.target.value;
            if (!value.startsWith('#')) {
                value = '#' + value;
            }
            this.elements.customColorPicker.value = value;
        });
    }

    if (this.elements.colorElementSelect) {
        this.elements.colorElementSelect.addEventListener('change', (e) => {
            if (e.target.value.startsWith('walls_')) {
                this.state.wallSelectionMode = e.target.value === 'walls_all' ? 'linked' : 'individual';
                this.syncWallSelectionMode();
            }

            this.updateCurrentColor(this.builder.getColor(e.target.value));
        });
    }

    if (this.elements.cabinetColorSwatches) {
        this.elements.cabinetColorSwatches.addEventListener('click', (e) => {
            const swatch = e.target.closest('[data-cabinet-color]');
            if (!swatch) return;
            this.applyCabinetColor(swatch.dataset.cabinetColor);
        });
    }

    if (this.elements.cabinetColorPicker) {
        this.elements.cabinetColorPicker.addEventListener('input', (e) => {
            this.applyCabinetColor(e.target.value);
        });
    }

    if (this.elements.cabinetColorApply) {
        this.elements.cabinetColorApply.addEventListener('click', () => {
            this.applyCabinetColor(this.elements.cabinetColorPicker?.value);
        });
    }

    // ============================================
    // ============================================
    document.querySelectorAll('#tab-lighting [data-lighting-type]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const nextType = e.currentTarget.dataset.lightingType;
            if (!nextType) return;
            this.state.lightingType = nextType;
            this.renderLighting();
        });
    });

    const lightBrightness = document.getElementById('lightBrightness');
    const brightnessValue = document.getElementById('brightnessValue');
    if (lightBrightness) {
        let lightingBrightnessCommitTimer = null;
        const commitBrightness = (rawValue) => {
            const value = Math.max(0, Math.min(200, Number(rawValue) || 0));
            this.builder.setLightBrightness(value);
            if (brightnessValue) {
                brightnessValue.textContent = `${value}%`;
            }
            this.updateSummary();
        };

        lightBrightness.addEventListener('input', (e) => {
            const value = Math.max(0, Math.min(200, Number(e.target.value) || 0));
            if (brightnessValue) {
                brightnessValue.textContent = `${value}%`;
            }

            clearTimeout(lightingBrightnessCommitTimer);
            lightingBrightnessCommitTimer = setTimeout(() => {
                commitBrightness(value);
            }, 70);
        });

        lightBrightness.addEventListener('change', (e) => {
            clearTimeout(lightingBrightnessCommitTimer);
            commitBrightness(e.target.value);
        });
    }

    document.querySelectorAll('.temp-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const temp = e.currentTarget.dataset.temp;
            if (!temp) return;
            this.builder.setLightTemperature(temp);
            this.updateSummary();
        });
    });

    const autoLighting = document.getElementById('autoLighting');
    if (autoLighting) {
        autoLighting.addEventListener('change', (e) => {
            this.builder.setLightAutoOn(e.target.checked);
            this.syncLightingShowcaseMode();
            this.updateSummary();
        });
    }

    const orderBtn = document.getElementById('orderBtn');
    if (orderBtn) {
        orderBtn.addEventListener('click', () => this.openOrderModal());
    }

    if (this.elements.orderForm) {
        this.elements.orderForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitOrder();
        });
    }

    if (this.elements.requestForm) {
        this.elements.requestForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitRequest();
        });
    }

    // ============================================
    // ============================================
    
    const phoneInputs = document.querySelectorAll('input[type="tel"]');
    phoneInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            e.target.value = this.orderHandler.formatPhoneInput(e.target.value);
        });
    });

    // ============================================
    // ============================================
    
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = e.currentTarget.getAttribute('href');
            const target = document.querySelector(targetId);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    console.log('Обработчики событий инициализированы');
};

/**
 */
App.initMaterialTabs = function() {
    const categoryBtns = document.querySelectorAll('.materials-categories .category-btn[data-category]');
    const materialsGrid = document.getElementById('materialsGrid');
    
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            categoryBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            const category = e.currentTarget.dataset.category;
            
            if (materialsGrid && category) {
                this.state.selectedElement = this.getDefaultElementForCategory(category);
                if (this.elements.elementSelect) {
                    this.elements.elementSelect.value = this.state.selectedElement;
                }
                this.state.materialVariantsBaseByCategory[category] = null;
                this.renderMaterialsForCategory(category);
            }
        });
    });
};

/**
 */
App.linkComponents = function() {
    this.builder.subscribe(() => {
        this.updateSummary();
    });

    this.visualizer.subscribe('onObjectClick', (userData, point) => {
        this.handleObjectClick(userData, point);
    });

    this.visualizer.subscribe('onPlacement', (type, point) => {
        this.handlePlacement(type, point);
    });

    this.orderHandler.subscribe('onOrderSuccess', (result) => {
        this.handleOrderSuccess(result);
    });

    this.orderHandler.subscribe('onOrderError', (error) => {
        this.handleOrderError(error);
    });

    console.log('Компоненты связаны');
};

/**
 */
App.loadSavedData = function() {
    return;
};

App.loadMaterialAssetOverrides = async function() {
    if (!window.MaterialsAPI || typeof window.MaterialsAPI.loadAssetOverridesFromServer !== 'function') {
        return;
    }

    try {
        await window.MaterialsAPI.loadAssetOverridesFromServer();
        if (typeof this.visualizer?.refreshMaterialAssets === 'function') {
            this.visualizer.refreshMaterialAssets();
        }
    } catch (error) {
        console.warn('Material asset overrides were not loaded:', error);
    }
};

// ============================================
// ============================================

/**
 */
App.renderMaterials = function() {
    const requestedCategory = this.getCategoryForElement(this.state.selectedElement || 'walls_front');
    const category = ['walls', 'ceiling', 'floor'].includes(requestedCategory)
        ? requestedCategory
        : 'walls';

    if (category !== requestedCategory) {
        this.state.selectedElement = this.getDefaultElementForCategory(category);
    }

    this.renderMaterialsForCategory(category);
};

/**
 */
App.renderMaterialsForCategory = function(category) {
    const grid = this.elements.materialsGrid;
    if (!grid) return;

    const safeCategory = ['walls', 'ceiling', 'floor'].includes(category)
        ? category
        : 'walls';

    if (safeCategory !== category) {
        this.state.selectedElement = this.getDefaultElementForCategory(safeCategory);
    }

    if (this.elements.elementSelect) {
        this.elements.elementSelect.value = this.state.selectedElement;
    }

    document.querySelectorAll('.materials-categories .category-btn').forEach((button) => {
        button.classList.toggle('active', button.dataset.category === safeCategory);
    });

    const allMaterials = MaterialsAPI.getByCategory(safeCategory);
    let materials = allMaterials;

    const baseId = this.state.materialVariantsBaseByCategory[safeCategory];
    if (baseId) {
        materials = allMaterials.filter((material) =>
            material.id === baseId || material.baseMaterialId === baseId
        );

        const hasVariants = materials.some((material) => material.baseMaterialId === baseId);
        if (!hasVariants) {
            this.state.materialVariantsBaseByCategory[safeCategory] = null;
            materials = allMaterials.filter((material) => !material.baseMaterialId);
        }
    } else {
        materials = allMaterials.filter((material) => !material.baseMaterialId);
    }
    
    const selectedElement = safeCategory === 'walls'
        ? this.getEffectiveMaterialTarget(this.state.selectedElement || 'walls_all')
        : this.getDefaultElementForCategory(safeCategory);
    const currentSelectedId = this.builder?.getMaterial(selectedElement)?.id || null;

    const backButton = this.state.materialVariantsBaseByCategory[safeCategory]
        ? `
        <button class="category-btn active" type="button" onclick="App.showBaseMaterialsForCategory('${safeCategory}')">
            Назад к базовым материалам
        </button>
    `
        : '';

    grid.innerHTML = `
        ${backButton}
        ${materials.map(material => `
        <div class="material-card ${currentSelectedId === material.id ? 'active' : ''}" 
             data-material="${material.id}" 
             data-base-material="${material.baseMaterialId || ''}"
             data-category="${safeCategory}"
             onclick="App.selectMaterial('${safeCategory}', '${material.id}')">
            <div class="material-preview" style="${this.getMaterialPreviewStyle(material)}"></div>
            <div class="material-name">${material.name}</div>
            ${material.popular ? '<span class="popular-badge">&#128293;</span>' : ''}
        </div>
    `).join('')}
    `;
};

App.showBaseMaterialsForCategory = function(category) {
    const safeCategory = ['walls', 'ceiling', 'floor'].includes(category)
        ? category
        : 'walls';

    this.state.materialVariantsBaseByCategory[safeCategory] = null;
    this.renderMaterialsForCategory(safeCategory);
};

App.getMaterialPreviewStyle = function(material) {
    const pbrMaps = MaterialsAPI.getPBRMaps(material);
    const previewImage = MaterialsAPI.getPreviewImage(material) || material?.image || pbrMaps?.color || null;
    const baseColor = material?.color || '#d9d9d9';
    const category = material?.category || '';

    const isFlatSurface = category === 'walls' || category === 'floor' || category === 'ceiling';
    const previewSize = category === 'floor'
        ? '96px 96px'
        : (category === 'walls' ? '110px 110px' : '120px 120px');

    if (!previewImage) {
        return `background-color: ${baseColor};`;
    }

    const isPhotoPreview = typeof previewImage === 'string' && /\/assets\/pbr(?:-variants)?\//i.test(previewImage);
    const isArtificialStonePreview = material?.id && String(material.id).startsWith('wall-artificial-stone');
    const shouldTilePreview = isFlatSurface && !isPhotoPreview;
    const backgroundSize = isArtificialStonePreview
        ? 'auto 100%'
        : (shouldTilePreview ? previewSize : 'cover');

    return [
        `background-color: ${baseColor}`,
        `background-image: linear-gradient(rgba(255,255,255,0.04), rgba(0,0,0,0.08)), url('${previewImage}')`,
        `background-size: ${backgroundSize}`,
        'background-position: center',
        `background-repeat: ${isArtificialStonePreview || shouldTilePreview ? 'repeat' : 'no-repeat'}`
    ].join('; ');
};

/**
 */
App.renderColors = function() {
    const grid = this.elements.colorGrid;
    if (!grid) return;

    const colors = MaterialsAPI.getAllColors();
    
    grid.innerHTML = colors.map((color) => `
        <button class="color-btn" 
                data-color="${color.hex}" 
                style="background-color: ${color.hex}"
                title="${color.name}">
        </button>
    `).join('');
};

/**
 */
App.renderFurniture = function() {
    const grid = this.elements.furnitureGrid;
    if (!grid) return;

    const furniture = MaterialsAPI.getByCategory('furniture');
    const selectedTypeId = this.builder?.furniture?.selectedType?.id || null;
    
    grid.innerHTML = furniture.map(item => `
        <div class="furniture-card ${item.id.startsWith('cabinet') ? 'is-cabinet' : ''} ${selectedTypeId === item.id ? 'active' : ''}" 
             data-material="${item.id}"
             onclick="App.selectFurniture('${item.id}')">
            <div class="furniture-preview" style="background-color: ${item.color}"></div>
            <div class="furniture-name">${item.name}</div>
        </div>
    `).join('');
};

App.getSelectedFurniture = function() {
    if (!this.state.selectedFurnitureId || !this.builder?.furniture?.items) {
        return null;
    }
    return this.builder.furniture.items.find((item) => item.id === this.state.selectedFurnitureId) || null;
};

App.isCabinetFurniture = function(furniture) {
    return Boolean(furniture?.type?.id && String(furniture.type.id).startsWith('cabinet'));
};

App.renderCabinetColorControls = function() {
    const panel = this.elements.cabinetColorPanel;
    if (!panel) return;

    const swatches = [
        { name: 'Орех', color: '#8B7355' },
        { name: 'Дуб', color: '#C8A875' },
        { name: 'Графит', color: '#3F3A3A' },
        { name: 'Белый', color: '#F4F0E8' },
        { name: 'Мокко', color: '#6B5344' },
        { name: 'Золото', color: '#B9831F' }
    ];
    const selected = this.getSelectedFurniture();
    const canEdit = this.isCabinetFurniture(selected);
    const currentColor = (selected?.color || selected?.type?.color || '#8B7355').toUpperCase();

    panel.classList.toggle('is-disabled', !canEdit);

    if (this.elements.cabinetColorStatus) {
        this.elements.cabinetColorStatus.textContent = canEdit ? 'Шкаф выбран' : 'Выберите шкаф';
    }

    if (this.elements.cabinetColorPicker) {
        this.elements.cabinetColorPicker.value = /^#[0-9a-fA-F]{6}$/.test(currentColor) ? currentColor : '#8B7355';
        this.elements.cabinetColorPicker.disabled = !canEdit;
    }

    if (this.elements.cabinetColorApply) {
        this.elements.cabinetColorApply.disabled = !canEdit;
    }

    if (this.elements.cabinetColorSwatches) {
        this.elements.cabinetColorSwatches.innerHTML = swatches.map((item) => `
            <button class="cabinet-color-swatch ${currentColor === item.color.toUpperCase() ? 'active' : ''}"
                    type="button"
                    data-cabinet-color="${item.color}"
                    title="${item.name}"
                    aria-label="${item.name}"
                    style="background-color: ${item.color}"
                    ${canEdit ? '' : 'disabled'}>
            </button>
        `).join('');
    }
};

App.applyCabinetColor = function(color) {
    const normalized = String(color || '').trim().toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(normalized)) {
        return;
    }

    const selected = this.getSelectedFurniture();
    if (!this.isCabinetFurniture(selected)) {
        this.showToast('Сначала выберите шкаф в списке или в 3D', 'info');
        return;
    }

    this.builder.updateFurnitureColor(selected.id, normalized);
    this.renderCabinetColorControls();
    this.renderPlacedFurniture();
};

App.renderPlacedFurniture = function() {
    const list = this.elements.placedFurnitureList;
    if (!list || !this.builder) return;

    const items = this.builder.furniture.items || [];
    if (!items.length) {
        list.innerHTML = '<p class="empty-message">Мебель ещё не размещена</p>';
        return;
    }

    list.innerHTML = items.map((item) => `
        <div class="placed-item ${this.state.selectedFurnitureId === item.id ? 'is-active' : ''}" onclick="App.selectPlacedFurniture('${item.id}')">
            <div class="placed-item-name">${item.type.name}</div>
            <div class="placed-item-actions">
                <button class="btn-move" type="button" onclick="event.stopPropagation(); App.startFurnitureReposition('${item.id}')">↔</button>
                <button class="btn-remove" type="button" onclick="event.stopPropagation(); App.removePlacedFurniture('${item.id}')">Удалить</button>
            </div>
        </div>
    `).join('');
};

App.selectPlacedFurniture = function(furnitureId) {
    this.state.selectedFurnitureId = this.state.selectedFurnitureId === furnitureId ? null : furnitureId;
    this.renderPlacedFurniture();
    this.renderCabinetColorControls();
};

/**
 */
App.renderLighting = function() {
    const grid = this.elements.lightingGrid;
    if (!grid) return;

    const lighting = MaterialsAPI.getByCategory('lighting');
    const safeType = ['ceiling', 'wall', 'floor', 'decorative'].includes(this.state.lightingType)
        ? this.state.lightingType
        : 'ceiling';
    const filteredLighting = lighting.filter((item) => this.getLightingBucket(item) === safeType);
    const selectedLightingId = this.builder?.lighting?.selectedType?.id;

    document.querySelectorAll('#tab-lighting [data-lighting-type]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.lightingType === safeType);
    });
    
    if (!filteredLighting.length) {
        grid.innerHTML = '<p class="empty-message">Для этой категории пока нет светильников</p>';
        return;
    }

    grid.innerHTML = filteredLighting.map(item => `
        <div class="lighting-card ${selectedLightingId === item.id ? 'active' : ''}" 
             data-material="${item.id}"
             onclick="App.selectLighting('${item.id}')">
            <div class="lighting-preview" style="background-color: ${item.color}"></div>
            <div class="lighting-name">${item.name}</div>
        </div>
    `).join('');
};

App.getLightingBucket = function(item) {
    const id = item?.id || '';
    if (id.startsWith('wall-')) return 'wall';
    if (id.startsWith('floor-')) return 'floor';
    if (id.startsWith('decorative-')) return 'decorative';
    return 'ceiling';
};

App.renderPlacedLighting = function() {
    const list = this.elements.placedLightingList;
    if (!list || !this.builder) return;

    const items = this.builder.lighting.items || [];
    if (!items.length) {
        list.innerHTML = '<p class="empty-message">Светильники ещё не размещены</p>';
        return;
    }

    list.innerHTML = items.map((item, index) => `
        <div class="placed-item">
            <div class="placed-item-name">${item.type?.name || 'Светильник'} #${index + 1}</div>
            <div class="placed-item-actions">
                <button class="btn-remove" type="button" onclick="App.removePlacedLight('${item.id}')">Удалить</button>
            </div>
        </div>
    `).join('');
};

App.syncLightingControls = function() {
    if (!this.builder) return;

    const brightness = Number(this.builder.lighting?.brightness ?? 80);
    const temperature = this.builder.lighting?.temperature || 'neutral';
    const autoOn = this.builder.lighting?.autoOn !== false;

    const brightnessInput = document.getElementById('lightBrightness');
    const brightnessValue = document.getElementById('brightnessValue');
    if (brightnessInput) brightnessInput.value = String(brightness);
    if (brightnessValue) brightnessValue.textContent = `${brightness}%`;

    document.querySelectorAll('.temp-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.temp === temperature);
    });

    const autoLightingCheckbox = document.getElementById('autoLighting');
    if (autoLightingCheckbox) autoLightingCheckbox.checked = autoOn;
};

// ============================================
// ============================================

/**
 */
App.selectSize = function(size) {
    document.querySelectorAll('.size-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.size === size) {
            btn.classList.add('active');
        }
    });

    const customSize = document.getElementById('customSize');
    if (customSize) {
        customSize.style.display = 'none';
    }

    this.builder.setLength(size);
    this.updateSummary();
};

/**
 */
App.selectShape = function(shape) {
    document.querySelectorAll('.shape-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.shape === shape) {
            btn.classList.add('active');
        }
    });

    this.builder.setShape(shape);
    this.syncDimensionControls();
    this.updateSummary();
};

App.isExtendedGlazingLayoutAvailable = function() {
    const shape = this.builder?.dimensions?.shape;
    const glazingType = this.builder?.glazing?.type || 'classic';
    return ['loggia-3', 'loggia-6'].includes(shape) && glazingType !== 'none';
};

App.normalizeGlazingLayoutSelection = function(layout) {
    const requestedLayout = ['straight', 'g', 'p'].includes(layout) ? layout : 'straight';
    return this.isExtendedGlazingLayoutAvailable() ? requestedLayout : 'straight';
};

App.applyGlazingLayout = function(layout) {
    const nextLayout = this.normalizeGlazingLayoutSelection(layout);
    this.builder.setGlazingLayout(nextLayout);
    this.visualizer?.requestUpdate?.();
    this.syncGlazingLayoutMode();
    this.updateSummary(true);
};

App.applyGlazingSide = function(side) {
    if (!this.isExtendedGlazingLayoutAvailable() || this.builder?.glazing?.layout !== 'g') {
        return;
    }

    this.builder.setGlazingGSide(side);
    this.visualizer?.requestUpdate?.();
    this.syncGlazingLayoutMode();
    this.updateSummary(true);
};

App.applyEntranceType = function(type) {
    this.builder.setEntranceType(type);
    this.visualizer?.requestUpdate?.();
    this.syncEntranceMode();
    this.updateSummary(true);
};

App.applyEntranceMirror = function(mirrored) {
    this.builder.setEntranceMirrored(mirrored);
    this.visualizer?.requestUpdate?.();
    this.syncEntranceMode();
    this.updateSummary(true);
};

App.applyEntranceSize = function(width, height) {
    this.builder.setEntranceSize(width, height);
    this.visualizer?.requestUpdate?.();
    this.syncEntranceMode();
    this.updateSummary(true);
};

App.syncEntranceMode = function() {
    const aliases = {
        'door-window': 'plastic-door',
        'door-wide-window': 'glazing-window',
        'center-door': 'plastic-door',
        'joined-room': 'open-connection'
    };
    const type = aliases[this.builder?.entrance?.type] || this.builder?.entrance?.type || 'plastic-door';
    const mirrored = Boolean(this.builder?.entrance?.mirrored);
    const canMirror = type === 'plastic-door';
    const entranceWidth = Number(this.builder?.entrance?.width) || 1.65;
    const entranceHeight = Number(this.builder?.entrance?.height) || 2.25;

    if (this.elements.entranceTypeSwitch) {
        this.elements.entranceTypeSwitch.querySelectorAll('[data-entrance-type]').forEach((btn) => {
            const isActive = btn.dataset.entranceType === type;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }

    if (this.elements.entranceSideSwitch) {
        this.elements.entranceSideSwitch.style.display = canMirror ? '' : 'none';
        this.elements.entranceSideSwitch.setAttribute('aria-hidden', canMirror ? 'false' : 'true');
        this.elements.entranceSideSwitch.querySelectorAll('[data-entrance-mirror]').forEach((btn) => {
            const isActive = (btn.dataset.entranceMirror === 'true') === mirrored;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            btn.disabled = !canMirror;
        });
    }

    const sizeLimits = {
        'plastic-door': { minW: 1.35, maxW: 2.15, minH: 2, maxH: 2.55 },
        'glazing-window': { minW: 1.75, maxW: 2.85, minH: 2, maxH: 2.55 },
        'open-connection': { minW: 1.9, maxW: 3.2, minH: 2, maxH: 2.55 }
    };
    const limits = sizeLimits[type] || sizeLimits['plastic-door'];
    if (this.elements.entranceWidth) {
        this.elements.entranceWidth.min = limits.minW;
        this.elements.entranceWidth.max = limits.maxW;
        this.elements.entranceWidth.value = Math.min(limits.maxW, Math.max(limits.minW, entranceWidth)).toFixed(2);
    }
    if (this.elements.entranceHeight) {
        this.elements.entranceHeight.min = limits.minH;
        this.elements.entranceHeight.max = limits.maxH;
        this.elements.entranceHeight.value = Math.min(limits.maxH, Math.max(limits.minH, entranceHeight)).toFixed(2);
    }
    if (this.elements.entranceWidthValue) {
        this.elements.entranceWidthValue.textContent = `${entranceWidth.toFixed(2)} м`;
    }
    if (this.elements.entranceHeightValue) {
        this.elements.entranceHeightValue.textContent = `${entranceHeight.toFixed(2)} м`;
    }
};

App.syncDimensionControls = function() {
    const { length, width, height, shape } = this.builder.dimensions;
    const customSize = document.getElementById('customSize');
    const widthRange = document.getElementById('widthRange');
    const widthValue = document.getElementById('widthValue');
    const heightRange = document.getElementById('heightRange');
    const heightValue = document.getElementById('heightValue');
    const windowSections = document.getElementById('windowSections');
    const glazingType = document.getElementById('glazingType');
    const extras = this.builder.getExtras();

    document.querySelectorAll('.shape-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.shape === shape);
    });

    document.querySelectorAll('.size-btn').forEach(btn => {
        btn.classList.toggle('active', Number(btn.dataset.size) === length);
    });

    if (customSize) {
        customSize.value = length;
    }

    if (widthRange) {
        widthRange.value = width;
    }

    if (widthValue) {
        widthValue.textContent = `${width} \u043c`;
    }

    if (heightRange) {
        heightRange.value = height;
    }

    if (heightValue) {
        heightValue.textContent = `${height} \u043c`;
    }

    if (windowSections) {
        windowSections.value = this.builder.glazing.windowSections;
    }

    if (glazingType) {
        glazingType.value = this.builder.glazing.type;
    }

    this.syncGlazingLayoutMode();
    this.syncEntranceMode();

    const extrasMap = {
        needInsulation: extras.insulation,
        needWiring: extras.wiring,
        needFloorHeating: extras.floorHeating,
        needVentilation: extras.ventilation
    };

    Object.entries(extrasMap).forEach(([id, value]) => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.checked = Boolean(value);
        }
    });
};

App.syncGlazingLayoutMode = function() {
    const isAvailable = this.isExtendedGlazingLayoutAvailable();
    let layout = this.normalizeGlazingLayoutSelection(this.builder?.glazing?.layout || 'straight');
    const side = this.builder?.glazing?.gSide || 'left';

    if (this.builder?.glazing?.layout !== layout) {
        this.builder.setGlazingLayout(layout);
        this.visualizer?.requestUpdate?.();
    }

    if (this.elements.glazingLayoutSwitch) {
        const group = this.elements.glazingLayoutSwitch.closest('.form-group');
        if (group) {
            group.style.display = isAvailable ? '' : 'none';
            group.setAttribute('aria-hidden', isAvailable ? 'false' : 'true');
        }

        this.elements.glazingLayoutSwitch.querySelectorAll('[data-glazing-layout]').forEach((btn) => {
            const isActive = btn.dataset.glazingLayout === layout;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            btn.disabled = !isAvailable;
        });
    }

    if (this.elements.glazingSideSwitch) {
        const showSideSwitch = isAvailable && layout === 'g';
        this.elements.glazingSideSwitch.style.display = showSideSwitch ? '' : 'none';
        this.elements.glazingSideSwitch.setAttribute('aria-hidden', showSideSwitch ? 'false' : 'true');
        this.elements.glazingSideSwitch.querySelectorAll('[data-glazing-side]').forEach((btn) => {
            const isActive = btn.dataset.glazingSide === side;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            btn.disabled = !showSideSwitch;
        });
    }
};

/**
 */
App.selectMaterial = function(category, materialId) {
    const safeCategory = ['walls', 'ceiling', 'floor'].includes(category)
        ? category
        : 'walls';

    if (['walls', 'ceiling', 'floor'].includes(safeCategory)) {
        const clickedMaterial = MaterialsAPI.getById(materialId, safeCategory);
        if (clickedMaterial && !clickedMaterial.baseMaterialId) {
            const hasVariants = MaterialsAPI.getByCategory(safeCategory)
                .some((material) => material.baseMaterialId === clickedMaterial.id);

            if (hasVariants) {
                const element = safeCategory === 'walls'
                    ? this.getEffectiveMaterialTarget(this.state.selectedElement || 'walls_all')
                    : this.getDefaultElementForCategory(safeCategory);

                this.builder.selectMaterial(element, materialId);
                this.state.materialVariantsBaseByCategory[safeCategory] = clickedMaterial.id;
                this.renderMaterialsForCategory(safeCategory);
                this.updateMaterialPreview(safeCategory, materialId);
                this.updateSummary();
                return;
            }
        }
    }

    const element = safeCategory === 'walls'
        ? this.getEffectiveMaterialTarget(this.state.selectedElement || 'walls_all')
        : this.getDefaultElementForCategory(safeCategory);
    
    this.builder.selectMaterial(element, materialId);
    
    document.querySelectorAll('.material-card').forEach(card => {
        card.classList.remove('active');
        if (card.dataset.material === materialId) {
            card.classList.add('active');
        }
    });

    this.updateMaterialPreview(safeCategory, materialId);

    
    this.updateSummary();

    this.showToast('Материал выбран', 'success');
};

/**
 */
App.selectColor = function(color) {
    const element = this.getEffectiveMaterialTarget(this.elements.colorElementSelect?.value || 'walls_all');
    
    this.builder.setColor(element, color);
    
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.color === color) {
            btn.classList.add('active');
        }
    });

    this.updateCurrentColor(color);
    if (this.elements.colorElementSelect?.value.startsWith('walls_')) {
        this.syncWallSelectionMode();
    }

};

/**
 */
App.selectPalette = function(paletteName) {
    const palette = MaterialsAPI.getColorPalette(paletteName);
    const grid = this.elements.colorGrid;
    
    if (grid && palette) {
        grid.innerHTML = palette.map(color => `
            <button class="color-btn" 
                    data-color="${color.hex}" 
                    style="background-color: ${color.hex}"
                    title="${color.name}">
            </button>
        `).join('');
    }
};

/**
 */
App.selectFurniture = function(materialId) {
    const selectedTypeId = this.builder?.furniture?.selectedType?.id || null;
    if (this.state.placementMode === 'furniture' && selectedTypeId === materialId && !this.state.editingFurnitureId) {
        this.cancelPlacementMode();
        return;
    }

    this.state.editingFurnitureId = null;
    this.state.placementMode = 'furniture';
    this.visualizer.setFurnitureEditTarget(null);
    this.builder.selectFurnitureType(materialId);
    this.visualizer.enterPlacementMode('furniture');
    
    this.elements.placementModeName.textContent = 'Мебель';
    this.elements.placementModeIndicator.classList.add('active');
    this.renderFurniture();
    
    this.showToast('Кликните на пол для размещения мебели. Esc или повторный клик по карточке отменяет выбор.', 'info');
};

/**
 */
App.startFurnitureReposition = function(furnitureId) {
    const furniture = this.builder?.furniture?.items?.find((item) => item.id === furnitureId);
    if (!furniture || !this.visualizer) return;

    this.state.editingFurnitureId = furnitureId;
    this.state.selectedFurnitureId = furnitureId;
    this.state.placementMode = 'furniture';
    this.builder.selectFurnitureType(furniture.type.id);
    this.visualizer.setFurnitureEditTarget(furnitureId);
    this.visualizer.enterPlacementMode('furniture');
    this.elements.placementModeName.textContent = 'Перестановка мебели';
    this.elements.placementModeIndicator.classList.add('active');
    this.renderFurniture();
    this.renderPlacedFurniture();
    this.renderCabinetColorControls();
    this.showToast('Кликните на пол, чтобы переставить выбранный шкаф', 'info');
};

App.removePlacedFurniture = function(furnitureId) {
    if (!this.builder) return;

    this.builder.removeFurniture(furnitureId);
    if (this.state.selectedFurnitureId === furnitureId) {
        this.state.selectedFurnitureId = null;
    }
    if (this.state.editingFurnitureId === furnitureId) {
        this.exitPlacementMode();
    }
    this.renderCabinetColorControls();
    this.updateSummary();
    this.showToast('Элемент мебели удалён', 'success');
};

App.selectLighting = function(materialId) {
    this.builder.selectLightingType(materialId);
    this.visualizer?.exitPlacementMode();

    document.querySelectorAll('.lighting-card').forEach(card => {
        card.classList.toggle('active', card.dataset.material === materialId);
    });

    if (this.elements.placementModeIndicator) {
        this.elements.placementModeIndicator.classList.remove('active');
    }

    this.syncLightingShowcaseMode();
    this.updateSummary();
    this.showToast('Освещение автоматически размещено на потолке', 'success');
};

App.removePlacedLight = function(lightId) {
    if (!this.builder) return;
    this.builder.removeLight(lightId);
    this.updateSummary();
};

// ============================================
// ============================================

/**
 */

App.updateSummary = function(options = {}) {
    const immediate = options === true || options?.immediate === true;

    if (immediate) {
        if (this._summaryUpdateFrame) {
            cancelAnimationFrame(this._summaryUpdateFrame);
            this._summaryUpdateFrame = null;
        }
        this._updateSummaryNow();
        return;
    }

    if (this._summaryUpdateFrame) return;

    this._summaryUpdateFrame = requestAnimationFrame(() => {
        this._summaryUpdateFrame = null;
        this._updateSummaryNow();
    });
};

/**
 */
App._updateSummaryNow = function() {
    if (!this.builder) return;

    if (this.elements.summaryParams) {
        this.elements.summaryParams.textContent = this.builder.getParamsString();
    }

    if (this.elements.summaryArea) {
        const totalArea = this.builder.getArea('floor') + this.builder.getArea('ceiling');
        this.elements.summaryArea.textContent = `${totalArea.toFixed(1)} \u043c\u00B2`;
    }

    if (this.elements.summaryMaterials) {
        const materials = this.builder.getAllMaterials();
        
        if (materials.length === 0) {
            this.elements.summaryMaterials.innerHTML = '<p class="empty-text">Материалы не выбраны</p>';
        } else {
            this.elements.summaryMaterials.innerHTML = materials.map(material => `
                <div class="summary-item">
                    <span class="summary-item-name">${material.name}</span>
                    <span class="summary-item-value">${this.formatMaterialQuantity(material)}</span>
                </div>
            `).join('');
        }
    }

    if (this.elements.summaryWorks) {
        const extras = this.getEnabledExtras();

        if (extras.length === 0) {
            this.elements.summaryWorks.innerHTML = '<p class="empty-text">Дополнительные работы не выбраны</p>';
        } else {
            this.elements.summaryWorks.innerHTML = extras.map(extra => `
                <div class="summary-item">
                    <span class="summary-item-name">${extra}</span>
                </div>
            `).join('');
        }
    }

    this.renderPlacedFurniture();
    this.renderCabinetColorControls();
    this.renderPlacedLighting();
    this.syncLightingControls();
};

/**
 */
App.updateMaterialPreview = function(category, materialId) {
    const material = MaterialsAPI.getById(materialId, category);
    if (!material) return;

    if (this.elements.materialPreview) {
        this.elements.materialPreview.style.display = 'block';
    }

    if (this.elements.previewMaterialName) {
        this.elements.previewMaterialName.textContent = material.name;
    }

    if (this.elements.previewTexture) {
        this.elements.previewTexture.style.cssText = this.getMaterialPreviewStyle(material);
    }

    if (this.elements.previewDescription) {
        this.elements.previewDescription.textContent = material.description;
    }

    if (this.elements.previewUnit) {
        this.elements.previewUnit.textContent = material.unit || '—';
    }
};

/**
 */
App.updateCurrentColor = function(color) {
    if (this.elements.currentColorPreview) {
        this.elements.currentColorPreview.style.backgroundColor = color;
    }

    if (this.elements.currentColorHex) {
        this.elements.currentColorHex.textContent = color;
    }

    if (this.elements.currentColorName) {
        this.elements.currentColorName.textContent = MaterialsAPI.getColorName(color);
    }
};

// ============================================
// ============================================

/**
 */
App.ensureShapeVariants = function() {
    return;
};

App.initSummaryPanelBehavior = function() {
    const panel = this.elements.summaryPanel;
    if (!panel || window.innerWidth < 1200) return;

    const controller = this.summaryPanelController;
    const fab = document.getElementById('summaryFab');

    panel.classList.add('is-collapsed');
    controller.isCollapsed = true;

    fab?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.openSummaryPanel();
    });

    const insideActivityHandler = () => {
        if (!controller.isCollapsed) {
            this.resetSummaryPanelCollapseTimer();
        }
    };

    ['pointerdown', 'input', 'change', 'focusin'].forEach((eventName) => {
        panel.addEventListener(eventName, insideActivityHandler);
    });

    panel.querySelectorAll('.summary-actions .btn').forEach((button) => {
        button.addEventListener('click', () => this.collapseSummaryPanel());
    });

    const outsideActivityHandler = (event) => {
        if (controller.isCollapsed) return;
        if (panel.contains(event.target)) return;
        this.collapseSummaryPanel();
    };

    ['pointerdown', 'wheel', 'keydown', 'touchstart'].forEach((eventName) => {
        document.addEventListener(eventName, outsideActivityHandler, { passive: true });
    });
};

App.openSummaryPanel = function() {
    const panel = this.elements.summaryPanel;
    if (!panel || window.innerWidth < 1200) return;

    const controller = this.summaryPanelController;
    panel.classList.remove('is-collapsed');
    controller.isCollapsed = false;
    this.resetSummaryPanelCollapseTimer();
};

App.collapseSummaryPanel = function() {
    const panel = this.elements.summaryPanel;
    if (!panel || window.innerWidth < 1200) return;

    const controller = this.summaryPanelController;
    panel.classList.add('is-collapsed');
    controller.isCollapsed = true;

    if (controller.collapseTimer) {
        window.clearTimeout(controller.collapseTimer);
        controller.collapseTimer = null;
    }
};

App.resetSummaryPanelCollapseTimer = function() {
    const panel = this.elements.summaryPanel;
    if (!panel || window.innerWidth < 1200) return;

    const controller = this.summaryPanelController;
    if (controller.collapseTimer) {
        window.clearTimeout(controller.collapseTimer);
    }

    controller.collapseTimer = window.setTimeout(() => {
        this.collapseSummaryPanel();
    }, controller.autoCollapseDelayMs);
};

App.handleObjectClick = function(userData, point) {
    if (this.config.debug) {
        console.log('Object clicked:', userData, point);
    }

    if (userData?.element === 'furniture' && userData.id) {
        this.state.selectedFurnitureId = userData.id;
        this.renderPlacedFurniture();
        this.renderCabinetColorControls();
    }
};

/**
 */
App.handlePlacement = function(type, point) {
    if (type === 'furniture') {
        this.state.editingFurnitureId = null;
        this.state.selectedFurnitureId = null;
        this.renderCabinetColorControls();
    }
    this.exitPlacementMode();
    this.updateSummary();
};

App.resetVisualizerState = function() {
    if (!this.builder || !this.visualizer) return;

    this.builder.reset();
    this.visualizer.resetCamera();
    this.exitPlacementMode();
    this.state.wallSelectionMode = 'linked';
    this.state.selectedElement = 'walls_all';
    Object.keys(this.state.materialVariantsBaseByCategory).forEach((category) => {
        this.state.materialVariantsBaseByCategory[category] = null;
    });
    this.syncDimensionControls();
    this.syncWallSelectionMode();
    this.renderMaterials();
    this.updateSummary();
    this.showToast('Визуализатор сброшен', 'info');
};

/**
 */
App.exitPlacementMode = function() {
    this.visualizer?.exitPlacementMode();
    this.visualizer?.setFurnitureEditTarget(null);
    this.builder?.clearFurnitureSelection?.();
    this.elements.placementModeIndicator?.classList.remove('active');
    this.state.placementMode = null;
    this.state.editingFurnitureId = null;
    this.renderFurniture();
};

/**
 */
App.handleCameraAction = function(action) {
    if (!this.visualizer) return;

    console.log('Camera action:', action);

    switch (action) {
        case 'rotate-left':
            this.visualizer.rotate('left');
            break;
        case 'rotate-right':
            this.visualizer.rotate('right');
            break;
        case 'rotate-up':
            this.visualizer.rotate('up');
            break;
        case 'rotate-down':
            this.visualizer.rotate('down');
            break;
        case 'zoom-in':
            this.visualizer.zoom('in');
            break;
        case 'zoom-out':
            this.visualizer.zoom('out');
            break;
        case 'reset':
            this.visualizer.resetCamera();
            break;
        case 'view-front':
            this.visualizer.setView('front');
            break;
        case 'view-top':
            this.visualizer.setView('top');
            break;
        case 'view-side':
            this.visualizer.setView('side');
            break;
        case 'view-iso':
            this.visualizer.setView('iso');
            break;
    }
};

// ============================================
// ============================================

/**
 */
App.initTabs = function() {
    this.elements.tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.currentTarget.dataset.tab;
            this.switchTab(tabName);
        });
    });
};

/**
 */
App.switchTab = function(tabName) {
    this.elements.tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    this.elements.tabContents.forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabName}`);
    });

    this.state.currentTab = tabName;
    this.syncLightingShowcaseMode();
};

// ============================================
// ============================================

/**
 */
App.syncLightingShowcaseMode = function() {
    if (!this.visualizer) return;

    const autoOn = this.builder?.lighting?.autoOn !== false;
    if (this.state.currentTab === 'lighting' && autoOn) {
        this.visualizer.setTimeOfDay('night');
    } else {
        this.visualizer.setTimeOfDay('day');
    }
};

App.initMobileMenu = function() {
    if (!this.elements.mobileMenuBtn || !this.elements.navMenu) return;

    this.elements.mobileMenuBtn.addEventListener('click', () => {
        this.elements.navMenu.classList.toggle('active');
        this.elements.mobileMenuBtn.classList.toggle('active');
    });

    this.elements.navMenu.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            this.elements.navMenu.classList.remove('active');
            this.elements.mobileMenuBtn.classList.remove('active');
        });
    });
};

App.initActiveNavigation = function() {
    if (!this.elements.navMenu) return;

    const navLinks = Array.from(this.elements.navMenu.querySelectorAll('.nav-link[href^="#"]'));
    const navSections = navLinks
        .map((link) => {
            const hash = link.getAttribute('href');
            return {
                hash,
                link,
                section: hash ? document.querySelector(hash) : null
            };
        })
        .filter((item) => item.section);

    if (!navSections.length) return;

    const setActiveLink = (activeHash) => {
        navLinks.forEach((link) => {
            link.classList.toggle('active', link.getAttribute('href') === activeHash);
        });
    };

    const syncActiveLink = () => {
        const headerHeight = this.elements.header?.offsetHeight || 0;
        const markerY = window.scrollY + headerHeight + window.innerHeight * 0.6;
        const documentHeight = Math.max(
            document.documentElement.scrollHeight,
            document.body.scrollHeight
        );
        const isAtBottom = window.scrollY + window.innerHeight >= documentHeight - 8;
        let activeHash = navSections[0].hash;

        navSections.forEach((item) => {
            if (markerY >= item.section.offsetTop) {
                activeHash = item.hash;
            }
        });

        if (isAtBottom) {
            activeHash = navSections[navSections.length - 1].hash;
        }

        setActiveLink(activeHash);
    };

    navLinks.forEach((link) => {
        link.addEventListener('click', () => {
            const hash = link.getAttribute('href');
            if (navSections.some((item) => item.hash === hash)) {
                setActiveLink(hash);
            }
        });
    });

    window.addEventListener('scroll', syncActiveLink, { passive: true });
    window.addEventListener('resize', syncActiveLink);
    syncActiveLink();
};

App.initAnchorScrolling = function() {
    if (this._anchorScrollingBound) return;
    this._anchorScrollingBound = true;

    document.querySelectorAll('a[href^="#"]').forEach((link) => {
        link.addEventListener('click', (event) => {
            const hash = link.getAttribute('href');
            if (!hash || hash === '#') return;

            const target = document.querySelector(hash);
            if (!target) return;

            event.preventDefault();

            const headerHeight = this.elements.header?.offsetHeight || 86;
            const top = hash === '#hero'
                ? 0
                : Math.max(0, target.getBoundingClientRect().top + window.pageYOffset - headerHeight - 12);

            window.scrollTo({ top, behavior: 'smooth' });

            if (history.pushState) {
                history.pushState(null, '', hash);
            }
        });
    });
};

/**
 */
App.initHeaderScroll = function() {
    const syncTopState = () => {
        if (window.scrollY > 50) {
            this.elements.header?.classList.add('scrolled');
        } else {
            this.elements.header?.classList.remove('scrolled');
        }

        const configuratorTop = this.elements.configurator
            ? this.elements.configurator.getBoundingClientRect().top + window.scrollY
            : 0;
        document.body.classList.toggle(
            'is-configurator-reached',
            window.scrollY >= Math.max(0, configuratorTop - window.innerHeight * 0.45)
        );
    };

    window.addEventListener('scroll', syncTopState, { passive: true });
    window.addEventListener('resize', syncTopState);
    syncTopState();
};

App.initPerformanceOptimizations = function() {
    if (!this.visualizer || !this.elements.visualizerContainer) return;

    const syncVisualizerRendering = () => {
        const shouldRender = !document.hidden && this.state.visualizerInViewport !== false;

        if (shouldRender) {
            this.visualizer.resumeRendering?.();
            this.visualizer.requestRender?.(500);
        } else {
            this.visualizer.pauseRendering?.();
        }
    };

    if (this._visualizerVisibilityObserver) {
        this._visualizerVisibilityObserver.disconnect();
    }

    if ('IntersectionObserver' in window) {
        this._visualizerVisibilityObserver = new IntersectionObserver((entries) => {
            const entry = entries[0];
            this.state.visualizerInViewport = entry
                ? entry.isIntersecting && entry.intersectionRatio > 0.12
                : true;
            syncVisualizerRendering();
        }, {
            threshold: [0, 0.12, 0.35]
        });

        this._visualizerVisibilityObserver.observe(this.elements.visualizerContainer);
    } else {
        this.state.visualizerInViewport = true;
    }

    if (this._visualizerVisibilityHandler) {
        document.removeEventListener('visibilitychange', this._visualizerVisibilityHandler);
    }

    this._visualizerVisibilityHandler = () => {
        syncVisualizerRendering();
    };

    document.addEventListener('visibilitychange', this._visualizerVisibilityHandler);
    syncVisualizerRendering();
};

App.initModalOutsideClose = function() {
    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
        if (overlay.dataset.outsideCloseBound === 'true') return;
        overlay.dataset.outsideCloseBound = 'true';

        overlay.addEventListener('pointerdown', (event) => {
            if (event.target !== overlay) return;

            if (overlay.id === 'requestModal') {
                this.closeRequestModal();
                return;
            }

            if (overlay.id === 'orderModal') {
                this.closeOrderModal();
                return;
            }

            overlay.classList.remove('active');
            document.body.style.overflow = '';
        });
    });
};

// ============================================
// ============================================

/**
 */
App.openOrderModal = function() {
    const materials = this.builder.getAllMaterials();
    if (materials.length === 0) {
        this.showToast('Выберите хотя бы один материал', 'error');
        return;
    }

    this.updateOrderPreview();

    this.elements.orderModal?.classList.add('active');
    document.body.style.overflow = 'hidden';
};

/**
 */
App.closeOrderModal = function() {
    this.elements.orderModal?.classList.remove('active');
    document.body.style.overflow = '';
};

/**
 */
App.openRequestModal = function() {
    this.elements.requestModal?.classList.add('active');
    document.body.style.overflow = 'hidden';
};

/**
 */
App.closeRequestModal = function() {
    this.elements.requestModal?.classList.remove('active');
    document.body.style.overflow = '';
};

/**
 */
App.updateOrderPreview = function() {
    const materials = this.builder.getAllMaterials();
    const extras = this.getEnabledExtras();
    const materialsText = materials.length > 0
        ? materials.map(material => material.name).join(', ')
        : 'Не выбрано';
    const extrasText = extras.length > 0
        ? extras.join(', ')
        : 'Нет';
    
    if (this.elements.orderSummaryContent) {
        this.elements.orderSummaryContent.innerHTML = `
            <div class="order-summary-row">
                <span>Параметры:</span>
                <span>${this.builder.getParamsString()}</span>
            </div>
            <div class="order-summary-row">
                <span>Материалы:</span>
                <span>${materialsText}</span>
            </div>
            <div class="order-summary-row">
                <span>Дополнительно:</span>
                <span>${extrasText}</span>
            </div>
        `;
    }
};

// ============================================
// ============================================

/**
 */
App.submitOrder = async function() {
    const form = this.elements.orderForm;
    if (!form) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');

    const orderData = {
        clientName: form.querySelector('#clientName')?.value,
        clientPhone: form.querySelector('#clientPhone')?.value,
        clientEmail: form.querySelector('#clientEmail')?.value,
        clientAddress: form.querySelector('#clientAddress')?.value,
        comment: form.querySelector('#comment')?.value,
        balconyType: 'balcony',
        balconySize: this.builder.dimensions.length,
        balconyShape: this.builder.dimensions.shape,
        materials: this.builder.getAllMaterials(),
        extras: this.builder.getExtras()
    };

    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'flex';

    try {
        let screenshot = null;
        if (this.visualizer) {
            screenshot = await this.visualizer.getFullScreenshot();
        }

        const result = await this.orderHandler.submitOrder(orderData, screenshot);

        if (!result.success) {
            this.showToast(result.error, 'error');
        }
    } catch (error) {
        console.error('Ошибка отправки заказа:', error);
        this.showToast('Ошибка отправки заказа. Попробуйте позже.', 'error');
    } finally {
        submitBtn.disabled = false;
        btnText.style.display = '';
        btnLoading.style.display = 'none';
    }
};

/**
 */
App.submitRequest = async function() {
    const form = this.elements.requestForm;
    if (!form) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправка...';

    try {
        const response = await fetch('/api/request-call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: form.querySelector('#requestName')?.value,
                phone: form.querySelector('#requestPhone')?.value
            })
        });

        const result = await response.json();

        if (result.success) {
            this.showToast('Заявка отправлена! Мы перезвоним вам в течение 5 минут', 'success');
            form.reset();
            this.closeRequestModal();
        } else {
            throw new Error(result.error);
        }

    } catch (error) {
        this.showToast('Ошибка отправки. Попробуйте позже.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
};

/**
 */
App.handleOrderSuccess = function(result) {
    this.showToast(`Заказ #${result.orderId} успешно создан!`, 'success');
    this.closeOrderModal();
    
    this.showThankYouMessage(result.orderId);
};

/**
 */
App.handleOrderError = function(error) {
    this.showToast(error.error || 'Ошибка отправки заказа', 'error');
};

/**
 */
App.showThankYouMessage = function(orderId) {
    const modalContent = this.elements.orderModal?.querySelector('.modal-content');
    if (!modalContent) return;

    modalContent.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div style="font-size: 64px; margin-bottom: 20px;">✓</div>
            <h2 style="color: var(--color-secondary); margin-bottom: 20px;">Спасибо за заявку!</h2>
            <p style="font-size: 18px; margin-bottom: 10px;">Ваш заказ #${orderId} принят в работу</p>
            <p style="color: var(--color-gray-500); margin-bottom: 30px;">
                Мы свяжемся с вами в ближайшее время
            </p>
            <button class="btn btn-primary btn-full" onclick="location.reload();">
                Создать новый проект
            </button>
        </div>
    `;
};

// ============================================
// ============================================

/**
 */
App.showToast = function(message, type = 'info') {
    if (this.config.suppressPopups) {
        this.clearTransientPanels();
        return;
    }

    if (!this.config.notifications) return;
    if (!this.elements.toastContainer) return;

    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <div class="toast-content">
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    this.elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};

// ============================================
// ============================================

/**
 */
App.showLoading = function() {
    if (this.config.suppressPopups) return;

    const overlay = document.createElement('div');
    overlay.id = 'app-loading';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
            <span>Загрузка...</span>
        </div>
    `;
    document.body.appendChild(overlay);
};

/**
 */
App.hideLoading = function() {
    const overlay = document.getElementById('app-loading');
    if (overlay) {
        overlay.remove();
    }
    this.state.isLoading = false;
};

App.clearTransientPanels = function() {
    const overlay = document.getElementById('app-loading');
    if (overlay) {
        overlay.remove();
    }

    if (this.elements?.toastContainer) {
        this.elements.toastContainer.innerHTML = '';
        this.elements.toastContainer.style.display = 'none';
    }
};

/**
 */
App.showError = function(message) {
    this.showToast(message, 'error');
};

// ============================================
// ============================================

/**
 */
App.getCategoryForElement = function(element) {
    if (element === 'windowsill' || element === 'sill' || element === 'windows') {
        return 'walls';
    }

    const parts = element.split('_');
    const category = parts[0];
    return ['walls', 'ceiling', 'floor'].includes(category) ? category : 'walls';
};

App.getDefaultElementForCategory = function(category) {
    const map = {
        walls: 'walls_all',
        ceiling: 'ceiling',
        floor: 'floor',
        windows: 'windows'
    };

    return map[category] || 'walls_all';
};

App.getEffectiveMaterialTarget = function(element) {
    if (!element || !element.startsWith('walls_')) {
        return element;
    }

    return this.state.wallSelectionMode === 'linked' ? 'walls_all' : element;
};

App.syncWallSelectionMode = function() {
    const isLinked = this.state.wallSelectionMode !== 'individual';
    const colorSelect = this.elements.colorElementSelect;

    document.querySelectorAll('[data-wall-mode]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.wallMode === (isLinked ? 'linked' : 'individual'));
    });

    document.querySelectorAll('#colorElementSelect option').forEach((option) => {
        if (!option.value.startsWith('walls_')) {
            return;
        }

        const isAllOption = option.value === 'walls_all';
        option.hidden = isLinked ? !isAllOption : false;
    });

    if (this.state.selectedElement && this.state.selectedElement.startsWith('walls_')) {
        this.state.selectedElement = isLinked
            ? 'walls_all'
            : (this.state.selectedElement === 'walls_all' ? 'walls_front' : this.state.selectedElement);
    }

    if (colorSelect && colorSelect.value.startsWith('walls_')) {
        colorSelect.value = isLinked
            ? 'walls_all'
            : (colorSelect.value === 'walls_all' ? 'walls_front' : colorSelect.value);
        this.updateCurrentColor(this.builder.getColor(colorSelect.value));
    }

    if (this.state.selectedElement) {
        this.renderMaterialsForCategory(this.getCategoryForElement(this.state.selectedElement));
    }
};

/**
 */
App.saveProject = function() {
    this.showToast('Постоянное сохранение отключено для ускорения', 'info');
};

/**
 */
App.resetConfigurator = function() {
    if (confirm('Вы уверены? Все изменения будут потеряны.')) {
        this.builder.reset();
        this.state.wallSelectionMode = 'linked';
        this.state.selectedElement = 'walls_all';
        Object.keys(this.state.materialVariantsBaseByCategory).forEach((category) => {
            this.state.materialVariantsBaseByCategory[category] = null;
        });
        this.syncWallSelectionMode();
        this.updateSummary();
        this.showToast('Конфигуратор сброшен', 'info');
    }
};

App.cancelPlacementMode = function() {
    if (!this.state.placementMode) return;

    this.exitPlacementMode();
    this.showToast('Режим размещения отключён', 'info');
};

App.applyCustomColor = function() {
    let value = (this.elements.customColorHex?.value || this.elements.customColorPicker?.value || '').trim();
    if (!value) return;

    if (!value.startsWith('#')) {
        value = `#${value}`;
    }

    if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
        this.showToast('Укажите цвет в формате #RRGGBB', 'error');
        return;
    }

    const normalizedColor = value.toUpperCase();

    if (this.elements.customColorPicker) {
        this.elements.customColorPicker.value = normalizedColor;
    }

    if (this.elements.customColorHex) {
        this.elements.customColorHex.value = normalizedColor;
    }

    this.selectColor(normalizedColor);
};

/**
 */
function scrollToConfigurator() {
    const configurator = document.getElementById('configurator');
    if (configurator) {
        configurator.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/**
 */
function scrollToPortfolio() {
    const portfolio = document.getElementById('portfolio');
    if (portfolio) {
        portfolio.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/**
 */
function toggleSummary() {
    return;
}

/**
 */
function takeScreenshot() {
    if (App.visualizer) {
        App.visualizer.exportScreenshot('balcony-project.png');
        App.showToast('Скриншот сохранён', 'success');
    }
}

/**
 */
function toggleFullscreen() {
    const container = document.getElementById('visualizerContainer');
    if (container) {
        if (!document.fullscreenElement) {
            container.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
    }
}

// ============================================
// ============================================
window.App = App;
window.scrollToConfigurator = scrollToConfigurator;
window.scrollToPortfolio = scrollToPortfolio;
window.toggleSummary = toggleSummary;
window.takeScreenshot = takeScreenshot;
window.toggleFullscreen = toggleFullscreen;
window.openOrderModal = () => App.openOrderModal();
window.closeOrderModal = () => App.closeOrderModal();
window.openRequestModal = () => App.openRequestModal();
window.closeRequestModal = () => App.closeRequestModal();
window.saveProject = () => App.saveProject();
window.resetVisualizerState = () => App.resetVisualizerState();
window.resetConfigurator = () => App.resetConfigurator();
window.cancelPlacementMode = () => App.cancelPlacementMode();
window.applyCustomColor = () => App.applyCustomColor();

// ============================================
// ============================================
if ('serviceWorker' in navigator && App.config.enableServiceWorker === true) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered:', registration);
            })
            .catch(error => {
                console.log('SW registration failed:', error);
            });
    });
}

window.adjustCounter = adjustCounter;


/**
 */
function adjustCounter(elementId, change) {
    const input = document.getElementById(elementId);
    if (!input) return;
    
    const currentValue = parseInt(input.value) || 3;
    const minValue = parseInt(input.min) || 1;
    const maxValue = parseInt(input.max) || 10;
    
    let newValue = currentValue + change;
    
    if (newValue < minValue) newValue = minValue;
    if (newValue > maxValue) newValue = maxValue;
    
    input.value = newValue;
    
    if (elementId === 'windowSections') {
        const app = window.App;
        const builder = app?.builder || window.balconyBuilder;
        const visualizer = app?.visualizer || window.balconyVisualizer;

        if (builder) {
            builder.setWindowSections(newValue);
            visualizer?.requestUpdate?.();
            app?.updateSummary?.(true);
        }
    }
}

App.getEnabledExtras = function() {
    const extras = this.builder.getExtras();
    const labels = {
        insulation: 'Утепление',
        wiring: 'Электрика',
        floorHeating: 'Тёплый пол',
        ventilation: 'Вентиляция',
        demolition: 'Демонтаж',
        disposal: 'Вывоз мусора'
    };

    return Object.entries(extras)
        .filter(([, enabled]) => enabled)
        .map(([key]) => labels[key] || key);
};

App.formatMaterialQuantity = function(material) {
    if (!material || material.quantity == null) {
        return '';
    }

    const quantity = Number.isInteger(material.quantity)
        ? material.quantity
        : material.quantity.toFixed(1);

    return `${quantity} ${material.unit || ''}`.trim();
};


console.log(' BalconyPro Application Ready!');

window.resetCamera = function() {
    if (App.visualizer) {
        App.visualizer.resetCamera();
    }
};

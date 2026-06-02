/**
 * ============================================
 * BALCONY PRO - MATERIALS CATALOG
 * Version: 3.0.0
 * ============================================
 */

const MaterialsDatabase = {
    walls: [
        {
            id: 'wall-pvc-panels',
            name: '\u041f\u0430\u043d\u0435\u043b\u0438 \u0441\u0442\u0435\u043d\u043e\u0432\u044b\u0435 \u041f\u0412\u0425',
            category: 'walls',
            price: 590,
            unit: '\u043c\u00b2',
            description: '\u0412\u043b\u0430\u0433\u043e\u0441\u0442\u043e\u0439\u043a\u0438\u0435 \u041f\u0412\u0425 \u043f\u0430\u043d\u0435\u043b\u0438 \u0434\u043b\u044f \u0432\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0435\u0439 \u043e\u0442\u0434\u0435\u043b\u043a\u0438 \u0431\u0430\u043b\u043a\u043e\u043d\u0430',
            color: '#E6E1D6',
            texture: 'pvc-panel',
            image: '/assets/textures/walls/pvh.jpg',
            popular: true
        },
        {
            id: 'wall-mdf-panels',
            name: '\u041f\u0430\u043d\u0435\u043b\u0438 \u041c\u0414\u0424',
            category: 'walls',
            price: 890,
            unit: '\u043c\u00b2',
            description: '\u041c\u0414\u0424 \u043f\u0430\u043d\u0435\u043b\u0438 \u0441 \u0437\u0430\u0449\u0438\u0442\u043d\u044b\u043c \u043f\u043e\u043a\u0440\u044b\u0442\u0438\u0435\u043c \u0438 \u0442\u0435\u043f\u043b\u043e\u0439 \u0444\u0430\u043a\u0442\u0443\u0440\u043e\u0439 \u0434\u0435\u0440\u0435\u0432\u0430',
            color: '#9B7A5A',
            texture: 'mdf-panel',
            image: '/assets/textures/walls/mdf.jpg',
            popular: true
        },
        {
            id: 'wall-euro-lining-painted',
            name: '\u0415\u0432\u0440\u043e-\u0432\u0430\u0433\u043e\u043d\u043a\u0430 \u0441 \u043e\u043a\u0440\u0430\u0441\u043a\u043e\u0439',
            category: 'walls',
            price: 990,
            unit: '\u043c\u00b2',
            description: '\u041e\u043a\u0440\u0430\u0448\u0435\u043d\u043d\u0430\u044f \u0435\u0432\u0440\u043e-\u0432\u0430\u0433\u043e\u043d\u043a\u0430 \u0441 \u043d\u0430\u0442\u0443\u0440\u0430\u043b\u044c\u043d\u043e\u0439 \u0434\u0440\u0435\u0432\u0435\u0441\u043d\u043e\u0439 \u0444\u0430\u043a\u0442\u0443\u0440\u043e\u0439',
            color: '#E8D8C3',
            texture: 'painted-lining',
            image: '/assets/textures/walls/vagonka.jpg',
            popular: true
        },
        {
            id: 'wall-moisture-laminate',
            name: '\u041b\u0430\u043c\u0438\u043d\u0430\u0442 \u0432\u043b\u0430\u0433\u043e\u0441\u0442\u043e\u0439\u043a\u0438\u0439',
            category: 'walls',
            price: 1180,
            unit: '\u043c\u00b2',
            description: '\u0412\u043b\u0430\u0433\u043e\u0441\u0442\u043e\u0439\u043a\u0438\u0439 \u043b\u0430\u043c\u0438\u043d\u0430\u0442 \u0434\u043b\u044f \u0441\u0442\u0435\u043d \u0441 \u0432\u044b\u0440\u0430\u0436\u0435\u043d\u043d\u043e\u0439 \u0434\u0440\u0435\u0432\u0435\u0441\u043d\u043e\u0439 \u0442\u0435\u043a\u0441\u0442\u0443\u0440\u043e\u0439',
            color: '#8C6F57',
            texture: 'laminate-wall',
            image: '/assets/textures/walls/laminat.jpg',
            popular: true
        },
        {
            id: 'wall-linden-parquet-painted',
            name: '\u0421\u0442\u0435\u043d\u043e\u0432\u043e\u0439 \u043f\u0430\u0440\u043a\u0435\u0442 \u0438\u0437 \u041b\u0438\u043f\u044b \u0441 \u043e\u043a\u0440\u0430\u0441\u043a\u043e\u0439',
            category: 'walls',
            price: 1490,
            unit: '\u043c\u00b2',
            description: '\u041e\u043a\u0440\u0430\u0448\u0435\u043d\u043d\u044b\u0439 \u0441\u0442\u0435\u043d\u043e\u0432\u043e\u0439 \u043f\u0430\u0440\u043a\u0435\u0442 \u0438\u0437 \u043b\u0438\u043f\u044b \u0441 \u0434\u0435\u043a\u043e\u0440\u0430\u0442\u0438\u0432\u043d\u043e\u0439 \u0440\u0430\u0441\u043a\u043b\u0430\u0434\u043a\u043e\u0439',
            color: '#B8926F',
            texture: 'linden-parquet',
            image: '/assets/textures/walls/parquet.jpg',
            popular: false
        },
        {
            id: 'wall-decor-3d-panels',
            name: '\u0414\u0435\u043a\u043e\u0440\u0430\u0442\u0438\u0432\u043d\u044b\u0435 \u0438 3\u0414 \u043f\u0430\u043d\u0435\u043b\u0438',
            category: 'walls',
            price: 1350,
            unit: '\u043c\u00b2',
            description: '\u0420\u0435\u043b\u044c\u0435\u0444\u043d\u044b\u0435 \u0434\u0435\u043a\u043e\u0440\u0430\u0442\u0438\u0432\u043d\u044b\u0435 \u043f\u0430\u043d\u0435\u043b\u0438 \u0434\u043b\u044f \u0430\u043a\u0446\u0435\u043d\u0442\u043d\u043e\u0439 \u0441\u0442\u0435\u043d\u044b',
            color: '#D8CCBC',
            texture: 'decor-3d',
            image: '/assets/textures/walls/pvh-color.jpg',
            popular: true
        },
        {
            id: 'wall-decor-slats',
            name: '\u0420\u0435\u0435\u0447\u043d\u044b\u0435 \u043f\u0430\u043d\u0435\u043b\u0438',
            category: 'walls',
            price: 1650,
            unit: '\u043c\u00b2',
            description: '\u0414\u0435\u043a\u043e\u0440\u0430\u0442\u0438\u0432\u043d\u044b\u0435 \u0434\u0435\u0440\u0435\u0432\u044f\u043d\u043d\u044b\u0435 \u0440\u0435\u0439\u043a\u0438 \u043d\u0430 \u0447\u0451\u0440\u043d\u043e\u0439 \u043f\u043e\u0434\u043b\u043e\u0436\u043a\u0435',
            color: '#C8A879',
            texture: 'decor-slats',
            image: '/assets/textures/ceiling/vagonka.jpg',
            popular: true
        },
        {
            id: 'wall-artificial-stone',
            name: '\u0418\u0441\u043a\u0443\u0441\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0439 \u043a\u0430\u043c\u0435\u043d\u044c',
            category: 'walls',
            price: 1890,
            unit: '\u043c\u00b2',
            description: '\u0424\u0430\u043a\u0442\u0443\u0440\u043d\u044b\u0439 \u0438\u0441\u043a\u0443\u0441\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0439 \u043a\u0430\u043c\u0435\u043d\u044c \u0434\u043b\u044f \u0434\u043e\u043b\u0433\u043e\u0432\u0435\u0447\u043d\u043e\u0439 \u043e\u0442\u0434\u0435\u043b\u043a\u0438 \u0441\u0442\u0435\u043d',
            color: '#8B7D6C',
            texture: 'artificial-stone',
            image: '/assets/textures/walls/stone.jpg',
            popular: true
        }
    ],

    ceiling: [
        {
            id: 'ceiling-pvc-panels',
            name: '\u041f\u0430\u043d\u0435\u043b\u0438 \u041f\u0412\u0425',
            category: 'ceiling',
            price: 620,
            unit: '\u043c\u00b2',
            description: '\u041b\u0435\u0433\u043a\u0438\u0435 \u0432\u043b\u0430\u0433\u043e\u0441\u0442\u043e\u0439\u043a\u0438\u0435 \u043f\u0430\u043d\u0435\u043b\u0438 \u041f\u0412\u0425 \u0434\u043b\u044f \u043f\u043e\u0442\u043e\u043b\u043a\u0430',
            color: '#F5F3EE',
            texture: 'pvc-ceiling',
            image: '/assets/textures/ceiling/pvh.jpg',
            popular: true
        },
        {
            id: 'ceiling-laminate',
            name: '\u041b\u0430\u043c\u0438\u043d\u0430\u0442',
            category: 'ceiling',
            price: 980,
            unit: '\u043c\u00b2',
            description: '\u041f\u043e\u0442\u043e\u043b\u043e\u043a \u0438\u0437 \u043b\u0430\u043c\u0438\u043d\u0430\u0442\u0430 \u0441 \u0430\u043a\u043a\u0443\u0440\u0430\u0442\u043d\u043e\u0439 \u043b\u0438\u043d\u0435\u0439\u043d\u043e\u0439 \u0440\u0430\u0441\u043a\u043b\u0430\u0434\u043a\u043e\u0439',
            color: '#F2EEE6',
            texture: 'laminate-ceiling',
            image: '/assets/textures/ceiling/vagonka.jpg',
            popular: false
        },
        {
            id: 'ceiling-stretch',
            name: '\u041d\u0430\u0442\u044f\u0436\u043d\u043e\u0439 \u043f\u043e\u0442\u043e\u043b\u043e\u043a',
            category: 'ceiling',
            price: 1250,
            unit: '\u043c\u00b2',
            description: '\u0413\u043b\u0430\u0434\u043a\u0438\u0439 \u043d\u0430\u0442\u044f\u0436\u043d\u043e\u0439 \u043f\u043e\u0442\u043e\u043b\u043e\u043a \u0441 \u0447\u0438\u0441\u0442\u043e\u0439 \u0441\u043e\u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e\u0439 \u043f\u043e\u0432\u0435\u0440\u0445\u043d\u043e\u0441\u0442\u044c\u044e',
            color: '#F6F4EF',
            texture: 'stretch-ceiling',
            image: '/assets/textures/ceiling/stretch-matte.jpg',
            popular: true
        },
        {
            id: 'ceiling-decor-slats',
            name: '\u0414\u0435\u043a\u043e\u0440\u0430\u0442\u0438\u0432\u043d\u044b\u0435 \u0440\u0435\u0439\u043a\u0438',
            category: 'ceiling',
            price: 1550,
            unit: '\u043c\u00b2',
            description: '\u041f\u043e\u0442\u043e\u043b\u043e\u0447\u043d\u044b\u0435 \u0434\u0435\u043a\u043e\u0440\u0430\u0442\u0438\u0432\u043d\u044b\u0435 \u0440\u0435\u0439\u043a\u0438 \u0441 \u0432\u044b\u0440\u0430\u0436\u0435\u043d\u043d\u044b\u043c \u043e\u0431\u044a\u0435\u043c\u043e\u043c',
            color: '#F1ECE3',
            texture: 'decor-slats',
            image: '/assets/textures/ceiling/vagonka.jpg',
            popular: true
        }
    ],

    floor: [
        {
            id: 'floor-laminate',
            name: '\u041b\u0430\u043c\u0438\u043d\u0430\u0442',
            category: 'floor',
            price: 1190,
            unit: '\u043c\u00b2',
            description: '\u041f\u0440\u0430\u043a\u0442\u0438\u0447\u043d\u044b\u0439 \u043b\u0430\u043c\u0438\u043d\u0430\u0442 \u0434\u043b\u044f \u043f\u043e\u043b\u0430 \u0431\u0430\u043b\u043a\u043e\u043d\u0430',
            color: '#8F735D',
            texture: 'floor-laminate',
            image: '/assets/textures/floor/laminat-33.jpg',
            popular: true
        },
        {
            id: 'floor-quartz-vinyl',
            name: '\u041a\u0432\u0430\u0440\u0446-\u0432\u0438\u043d\u0438\u043b',
            category: 'floor',
            price: 1490,
            unit: '\u043c\u00b2',
            description: '\u0412\u043b\u0430\u0433\u043e\u0441\u0442\u043e\u0439\u043a\u0438\u0439 \u043a\u0432\u0430\u0440\u0446-\u0432\u0438\u043d\u0438\u043b \u0441 \u0438\u0437\u043d\u043e\u0441\u043e\u0441\u0442\u043e\u0439\u043a\u043e\u0439 \u043f\u043e\u0432\u0435\u0440\u0445\u043d\u043e\u0441\u0442\u044c\u044e',
            color: '#8E7A69',
            texture: 'quartz-vinyl',
            image: '/assets/textures/floor/vinyl.jpg',
            popular: true
        },
        {
            id: 'floor-parquet-board',
            name: '\u041f\u0430\u0440\u043a\u0435\u0442\u043d\u0430\u044f \u0434\u043e\u0441\u043a\u0430',
            category: 'floor',
            price: 2190,
            unit: '\u043c\u00b2',
            description: '\u041d\u0430\u0442\u0443\u0440\u0430\u043b\u044c\u043d\u0430\u044f \u043f\u0430\u0440\u043a\u0435\u0442\u043d\u0430\u044f \u0434\u043e\u0441\u043a\u0430 \u0441 \u0442\u0435\u043f\u043b\u043e\u0439 \u0434\u0440\u0435\u0432\u0435\u0441\u043d\u043e\u0439 \u0444\u0430\u043a\u0442\u0443\u0440\u043e\u0439',
            color: '#8B6C4D',
            texture: 'parquet-board',
            image: '/assets/textures/floor/parquet.jpg',
            popular: true
        },
        {
            id: 'floor-tile-porcelain',
            name: '\u041f\u043b\u0438\u0442\u043a\u0430 \u0438\u043b\u0438 \u043a\u0435\u0440\u0430\u043c\u043e\u0433\u0440\u0430\u043d\u0438\u0442',
            category: 'floor',
            price: 1750,
            unit: '\u043c\u00b2',
            description: '\u041a\u0435\u0440\u0430\u043c\u043e\u0433\u0440\u0430\u043d\u0438\u0442 \u0438\u043b\u0438 \u043f\u043b\u0438\u0442\u043a\u0430 \u0434\u043b\u044f \u0443\u0441\u0442\u043e\u0439\u0447\u0438\u0432\u043e\u0433\u043e \u0438 \u043b\u0435\u0433\u043a\u043e\u0433\u043e \u0432 \u0443\u0445\u043e\u0434\u0435 \u043f\u043e\u043b\u0430',
            color: '#B8B1A8',
            texture: 'tile-porcelain',
            image: '/assets/textures/floor/porcelain.jpg',
            popular: true
        }
    ],

    windows: [
        {
            id: 'window-standard-1chamber',
            name: '\u041e\u043a\u043d\u043e \u0441\u0442\u0430\u043d\u0434\u0430\u0440\u0442 (1-\u043a\u0430\u043c)',
            category: 'windows',
            price: 8500,
            unit: '\u0448\u0442',
            description: '\u041e\u0434\u043d\u043e\u043a\u0430\u043c\u0435\u0440\u043d\u044b\u0439 \u0441\u0442\u0435\u043a\u043b\u043e\u043f\u0430\u043a\u0435\u0442, \u043f\u0440\u043e\u0444\u0438\u043b\u044c 60\u043c\u043c',
            color: '#FFFFFF',
            texture: 'window',
            image: '/assets/textures/windows/standard-1.jpg',
            popular: false
        },
        {
            id: 'window-standard-2chamber',
            name: '\u041e\u043a\u043d\u043e \u0441\u0442\u0430\u043d\u0434\u0430\u0440\u0442 (2-\u043a\u0430\u043c)',
            category: 'windows',
            price: 11500,
            unit: '\u0448\u0442',
            description: '\u0414\u0432\u0443\u0445\u043a\u0430\u043c\u0435\u0440\u043d\u044b\u0439 \u0441\u0442\u0435\u043a\u043b\u043e\u043f\u0430\u043a\u0435\u0442, \u043f\u0440\u043e\u0444\u0438\u043b\u044c 60\u043c\u043c',
            color: '#FFFFFF',
            texture: 'window',
            image: '/assets/textures/windows/standard-2.jpg',
            popular: true
        },
        {
            id: 'window-premium-2chamber',
            name: '\u041e\u043a\u043d\u043e \u043f\u0440\u0435\u043c\u0438\u0443\u043c (2-\u043a\u0430\u043c)',
            category: 'windows',
            price: 16500,
            unit: '\u0448\u0442',
            description: '\u0414\u0432\u0443\u0445\u043a\u0430\u043c\u0435\u0440\u043d\u044b\u0439, \u043f\u0440\u043e\u0444\u0438\u043b\u044c 70\u043c\u043c, \u044d\u043d\u0435\u0440\u0433\u043e\u0441\u0431\u0435\u0440\u0435\u0433\u0430\u044e\u0449\u0438\u0439',
            color: '#F5F5F5',
            texture: 'window-premium',
            image: '/assets/textures/windows/premium-2.jpg',
            popular: true
        },
        {
            id: 'window-premium-3chamber',
            name: '\u041e\u043a\u043d\u043e \u043f\u0440\u0435\u043c\u0438\u0443\u043c (3-\u043a\u0430\u043c)',
            category: 'windows',
            price: 21000,
            unit: '\u0448\u0442',
            description: '\u0422\u0440\u0451\u0445\u043a\u0430\u043c\u0435\u0440\u043d\u044b\u0439, \u043f\u0440\u043e\u0444\u0438\u043b\u044c 70\u043c\u043c, \u043c\u0430\u043a\u0441\u0438\u043c\u0430\u043b\u044c\u043d\u0430\u044f \u0437\u0430\u0449\u0438\u0442\u0430',
            color: '#F5F5F5',
            texture: 'window-premium',
            image: '/assets/textures/windows/premium-3.jpg',
            popular: false
        },
        {
            id: 'window-panoramic',
            name: '\u041f\u0430\u043d\u043e\u0440\u0430\u043c\u043d\u043e\u0435 \u043e\u0441\u0442\u0435\u043a\u043b\u0435\u043d\u0438\u0435',
            category: 'windows',
            price: 35000,
            unit: '\u043c.\u043f.',
            description: '\u041f\u0430\u043d\u043e\u0440\u0430\u043c\u043d\u043e\u0435 \u043e\u0441\u0442\u0435\u043a\u043b\u0435\u043d\u0438\u0435 \u043e\u0442 \u043f\u043e\u043b\u0430 \u0434\u043e \u043f\u043e\u0442\u043e\u043b\u043a\u0430',
            color: '#E8E8E8',
            texture: 'panoramic',
            image: '/assets/textures/windows/panoramic.jpg',
            popular: true
        },
        {
            id: 'window-aluminum',
            name: '\u0410\u043b\u044e\u043c\u0438\u043d\u0438\u0435\u0432\u043e\u0435 \u043e\u0441\u0442\u0435\u043a\u043b\u0435\u043d\u0438\u0435',
            category: 'windows',
            price: 12000,
            unit: '\u043c.\u043f.',
            description: '\u0425\u043e\u043b\u043e\u0434\u043d\u043e\u0435 \u0430\u043b\u044e\u043c\u0438\u043d\u0438\u0435\u0432\u043e\u0435 \u043e\u0441\u0442\u0435\u043a\u043b\u0435\u043d\u0438\u0435',
            color: '#C0C0C0',
            texture: 'aluminum',
            image: '/assets/textures/windows/aluminum.jpg',
            popular: false
        }
    ],

    windowsill: [
        {
            id: 'windowsill-pvc-standard',
            name: '\u041f\u043e\u0434\u043e\u043a\u043e\u043d\u043d\u0438\u043a \u041f\u0412\u0425 \u0441\u0442\u0430\u043d\u0434\u0430\u0440\u0442',
            category: 'windowsill',
            price: 1500,
            unit: '\u043c.\u043f.',
            description: '\u041f\u0412\u0425 \u043f\u043e\u0434\u043e\u043a\u043e\u043d\u043d\u0438\u043a 400\u043c\u043c',
            color: '#FFFFFF',
            texture: 'pvc',
            image: '/assets/textures/windowsill/pvc-std.jpg',
            popular: true
        },
        {
            id: 'windowsill-pvc-premium',
            name: '\u041f\u043e\u0434\u043e\u043a\u043e\u043d\u043d\u0438\u043a \u041f\u0412\u0425 \u043f\u0440\u0435\u043c\u0438\u0443\u043c',
            category: 'windowsill',
            price: 2500,
            unit: '\u043c.\u043f.',
            description: '\u041f\u0412\u0425 \u043f\u043e\u0434\u043e\u043a\u043e\u043d\u043d\u0438\u043a \u043f\u0440\u0435\u043c\u0438\u0443\u043c 600\u043c\u043c',
            color: '#F5F5F5',
            texture: 'pvc-premium',
            image: '/assets/textures/windowsill/pvc-premium.jpg',
            popular: false
        },
        {
            id: 'windowsill-wood',
            name: '\u041f\u043e\u0434\u043e\u043a\u043e\u043d\u043d\u0438\u043a \u0434\u0435\u0440\u0435\u0432\u044f\u043d\u043d\u044b\u0439',
            category: 'windowsill',
            price: 4500,
            unit: '\u043c.\u043f.',
            description: '\u041d\u0430\u0442\u0443\u0440\u0430\u043b\u044c\u043d\u044b\u0439 \u0434\u0435\u0440\u0435\u0432\u044f\u043d\u043d\u044b\u0439 \u043f\u043e\u0434\u043e\u043a\u043e\u043d\u043d\u0438\u043a',
            color: '#C4A574',
            texture: 'wood',
            image: '/assets/textures/windowsill/wood.jpg',
            popular: true
        },
        {
            id: 'windowsill-marble',
            name: '\u041f\u043e\u0434\u043e\u043a\u043e\u043d\u043d\u0438\u043a \u043c\u0440\u0430\u043c\u043e\u0440',
            category: 'windowsill',
            price: 8500,
            unit: '\u043c.\u043f.',
            description: '\u0418\u0441\u043a\u0443\u0441\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0439 \u043c\u0440\u0430\u043c\u043e\u0440',
            color: '#E8E4D9',
            texture: 'marble',
            image: '/assets/textures/windowsill/marble.jpg',
            popular: false
        },
        {
            id: 'sill-external',
            name: '\u041e\u0442\u043b\u0438\u0432 \u0432\u043d\u0435\u0448\u043d\u0438\u0439',
            category: 'windowsill',
            price: 900,
            unit: '\u043c.\u043f.',
            description: '\u041c\u0435\u0442\u0430\u043b\u043b\u0438\u0447\u0435\u0441\u043a\u0438\u0439 \u0432\u043d\u0435\u0448\u043d\u0438\u0439 \u043e\u0442\u043b\u0438\u0432',
            color: '#C0C0C0',
            texture: 'metal',
            image: '/assets/textures/windowsill/sill.jpg',
            popular: true
        }
    ],

    lighting: [
        {
            id: 'ceiling-spotlights',
            name: '\u0412\u0441\u0442\u0440\u043e\u0435\u043d\u043d\u044b\u0435 \u0442\u043e\u0447\u0435\u0447\u043d\u044b\u0435 \u043b\u0430\u043c\u043f\u044b',
            category: 'lighting',
            price: 750,
            unit: '\u0448\u0442',
            description: '\u0412\u0441\u0442\u0440\u043e\u0435\u043d\u043d\u044b\u0435 \u043f\u043e\u0442\u043e\u043b\u043e\u0447\u043d\u044b\u0435 \u0442\u043e\u0447\u043a\u0438 \u0434\u043b\u044f \u0440\u043e\u0432\u043d\u043e\u0433\u043e \u043e\u0431\u0449\u0435\u0433\u043e \u043e\u0441\u0432\u0435\u0449\u0435\u043d\u0438\u044f',
            color: '#FFFFFF',
            texture: 'ceiling-spotlights',
            image: '/assets/textures/lighting/spot-7w.jpg',
            popular: true,
            power: 7,
            lightTemp: '4000K'
        },
        {
            id: 'ceiling-track-lights',
            name: '\u0422\u0440\u0435\u043a \u0441\u0432\u0435\u0442\u0438\u043b\u044c\u043d\u0438\u043a\u0438 (\u043d\u0430\u043f\u0440\u0430\u0432\u043b\u044f\u0435\u043c\u044b\u0435)',
            category: 'lighting',
            price: 2800,
            unit: '\u043a\u043e\u043c\u043f\u043b\u0435\u043a\u0442',
            description: '\u041f\u043e\u0442\u043e\u043b\u043e\u0447\u043d\u044b\u0439 \u0442\u0440\u0435\u043a \u0441 \u043d\u0430\u043f\u0440\u0430\u0432\u043b\u044f\u0435\u043c\u044b\u043c\u0438 \u0441\u0432\u0435\u0442\u0438\u043b\u044c\u043d\u0438\u043a\u0430\u043c\u0438',
            color: '#F5F5F5',
            texture: 'ceiling-track',
            image: '/assets/textures/lighting/chandelier-modern.jpg',
            popular: true,
            power: 18,
            lightTemp: '4000K'
        },
        {
            id: 'ceiling-contour-led',
            name: '\u041a\u0440\u0443\u0433\u043e\u0432\u043e\u0435/\u043a\u043e\u043d\u0442\u0443\u0440\u043d\u043e\u0435 LED \u043e\u0441\u0432\u0435\u0449\u0435\u043d\u0438\u0435',
            category: 'lighting',
            price: 2200,
            unit: '\u043a\u043e\u043c\u043f\u043b\u0435\u043a\u0442',
            description: '\u041a\u043e\u043d\u0442\u0443\u0440\u043d\u043e\u0435 LED \u043e\u0441\u0432\u0435\u0449\u0435\u043d\u0438\u0435 \u043f\u043e \u043f\u0435\u0440\u0438\u043c\u0435\u0442\u0440\u0443 \u043f\u043e\u0442\u043e\u043b\u043a\u0430',
            color: '#FFF4D6',
            texture: 'ceiling-contour-led',
            image: '/assets/textures/lighting/strip-5m.jpg',
            popular: true,
            power: 24,
            lightTemp: '3000K'
        }
    ],

    furniture: [
        {
            id: 'cabinet-1door-low',
            name: '\u0428\u043a\u0430\u0444 1 \u0434\u0432\u0435\u0440\u044c \u043d\u0438\u0437\u043a\u0438\u0439',
            category: 'furniture',
            price: 6200,
            unit: '\u0448\u0442',
            description: '\u041d\u0430\u043f\u043e\u043b\u044c\u043d\u044b\u0439 \u0448\u043a\u0430\u0444 1 \u0434\u0432\u0435\u0440\u044c, \u0432\u044b\u0441\u043e\u0442\u0430 100\u0441\u043c',
            color: '#8B7355',
            texture: 'wood',
            image: '/assets/textures/furniture/cabinet-2low.jpg',
            popular: true,
            dimensions: { width: 40, height: 100, depth: 40 }
        },
        {
            id: 'cabinet-2door-low',
            name: '\u0428\u043a\u0430\u0444 2 \u0434\u0432\u0435\u0440\u0438 \u043d\u0438\u0437\u043a\u0438\u0439',
            category: 'furniture',
            price: 8500,
            unit: '\u0448\u0442',
            description: '\u041d\u0430\u043f\u043e\u043b\u044c\u043d\u044b\u0439 \u0448\u043a\u0430\u0444 2 \u0434\u0432\u0435\u0440\u0438, \u0432\u044b\u0441\u043e\u0442\u0430 100\u0441\u043c',
            color: '#8B7355',
            texture: 'wood',
            image: '/assets/textures/furniture/cabinet-2low.jpg',
            popular: true,
            dimensions: { width: 80, height: 100, depth: 40 }
        },
        {
            id: 'cabinet-1door-tall',
            name: '\u0428\u043a\u0430\u0444 1 \u0434\u0432\u0435\u0440\u044c \u0432\u044b\u0441\u043e\u043a\u0438\u0439',
            category: 'furniture',
            price: 9800,
            unit: '\u0448\u0442',
            description: '\u041d\u0430\u043f\u043e\u043b\u044c\u043d\u044b\u0439 \u0448\u043a\u0430\u0444 1 \u0434\u0432\u0435\u0440\u044c, \u0432\u044b\u0441\u043e\u0442\u0430 200\u0441\u043c',
            color: '#8B7355',
            texture: 'wood',
            image: '/assets/textures/furniture/cabinet-2tall.jpg',
            popular: true,
            dimensions: { width: 40, height: 200, depth: 40 }
        },
        {
            id: 'cabinet-2door-tall',
            name: '\u0428\u043a\u0430\u0444 2 \u0434\u0432\u0435\u0440\u0438 \u0432\u044b\u0441\u043e\u043a\u0438\u0439',
            category: 'furniture',
            price: 14500,
            unit: '\u0448\u0442',
            description: '\u041d\u0430\u043f\u043e\u043b\u044c\u043d\u044b\u0439 \u0448\u043a\u0430\u0444 2 \u0434\u0432\u0435\u0440\u0438, \u0432\u044b\u0441\u043e\u0442\u0430 200\u0441\u043c',
            color: '#8B7355',
            texture: 'wood',
            image: '/assets/textures/furniture/cabinet-2tall.jpg',
            popular: true,
            dimensions: { width: 80, height: 200, depth: 40 }
        },
        {
            id: 'cabinet-corner',
            name: '\u0428\u043a\u0430\u0444 \u0443\u0433\u043b\u043e\u0432\u043e\u0439',
            category: 'furniture',
            price: 16500,
            unit: '\u0448\u0442',
            description: '\u0423\u0433\u043b\u043e\u0432\u043e\u0439 \u0448\u043a\u0430\u0444 \u0434\u043b\u044f \u0431\u0430\u043b\u043a\u043e\u043d\u0430',
            color: '#8B7355',
            texture: 'wood',
            image: '/assets/textures/furniture/cabinet-corner.jpg',
            popular: true,
            dimensions: { width: 80, height: 180, depth: 80 }
        },
        {
            id: 'cabinet-hanging',
            name: '\u0428\u043a\u0430\u0444 \u043d\u0430\u0432\u0435\u0441\u043d\u043e\u0439',
            category: 'furniture',
            price: 6500,
            unit: '\u0448\u0442',
            description: '\u041d\u0430\u0432\u0435\u0441\u043d\u043e\u0439 \u0448\u043a\u0430\u0444 \u0434\u043b\u044f \u0431\u0430\u043b\u043a\u043e\u043d\u0430',
            color: '#8B7355',
            texture: 'wood',
            image: '/assets/textures/furniture/cabinet-hanging.jpg',
            popular: false,
            dimensions: { width: 80, height: 60, depth: 35 }
        },
        {
            id: 'chest-drawers',
            name: '\u041a\u043e\u043c\u043e\u0434',
            category: 'furniture',
            price: 9500,
            unit: '\u0448\u0442',
            description: '\u041a\u043e\u043c\u043e\u0434 \u0441 \u044f\u0449\u0438\u043a\u0430\u043c\u0438 \u0434\u043b\u044f \u0431\u0430\u043b\u043a\u043e\u043d\u0430',
            color: '#A0826D',
            texture: 'wood',
            image: '/assets/textures/furniture/chest.jpg',
            popular: true,
            dimensions: { width: 80, height: 85, depth: 40 }
        }
    ]
};

const MaterialAssetCatalog = {
    'wall-pvc-panels': {
        preview: '/assets/pbr/walls/wall-pvc-panels/Albedo.jpg',
        maps: {
            color: '/assets/pbr/walls/wall-pvc-panels/Albedo.jpg',
            normal: '/assets/pbr/walls/wall-pvc-panels/Normal.jpg',
            roughness: '/assets/pbr/walls/wall-pvc-panels/Roughness.jpg',
            ao: '/assets/pbr/walls/wall-pvc-panels/AO.jpg'
        }
    },
    'wall-mdf-panels': {
        preview: '/assets/pbr/walls/wall-mdf-panels/Planks030A.png',
        maps: {
            color: '/assets/pbr/walls/wall-mdf-panels/Planks030A_1K-JPG_Color.jpg',
            normal: '/assets/pbr/walls/wall-mdf-panels/Planks030A_1K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr/walls/wall-mdf-panels/Planks030A_1K-JPG_Roughness.jpg',
            ao: '/assets/pbr/walls/wall-mdf-panels/Planks030A_1K-JPG_AmbientOcclusion.jpg'
        }
    },
    'wall-euro-lining-painted': {
        preview: '/assets/pbr/walls/wall-euro-lining-painted/WoodFloor039.png',
        maps: {
            color: '/assets/pbr/walls/wall-euro-lining-painted/WoodFloor039_4K-JPG_Color.jpg',
            normal: '/assets/pbr/walls/wall-euro-lining-painted/WoodFloor039_4K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr/walls/wall-euro-lining-painted/WoodFloor039_4K-JPG_Roughness.jpg',
            ao: '/assets/pbr/walls/wall-euro-lining-painted/WoodFloor039_4K-JPG_AmbientOcclusion.jpg'
        }
    },
    'wall-moisture-laminate': {
        preview: '/assets/pbr/walls/wall-moisture-laminate/laminate_floor_02_diff_1k.jpg',
        maps: {
            color: '/assets/pbr/walls/wall-moisture-laminate/laminate_floor_02_diff_1k.jpg'
        }
    },
    'wall-linden-parquet-painted': {
        preview: '/assets/pbr/walls/wall-linden-parquet-painted/WoodFloor057.png',
        maps: {
            color: '/assets/pbr/walls/wall-linden-parquet-painted/WoodFloor057_1K-JPG_Color.jpg',
            normal: '/assets/pbr/walls/wall-linden-parquet-painted/WoodFloor057_1K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr/walls/wall-linden-parquet-painted/WoodFloor057_1K-JPG_Roughness.jpg',
            ao: '/assets/pbr/walls/wall-linden-parquet-painted/WoodFloor057_1K-JPG_AmbientOcclusion.jpg'
        }
    },
    'wall-decor-3d-panels': {
        preview: '/assets/pbr/walls/wall-decor-3d-panels/Albedo.jpg',
        maps: {
            color: '/assets/pbr/walls/wall-decor-3d-panels/Albedo.jpg',
            normal: '/assets/pbr/walls/wall-decor-3d-panels/Normal.jpg',
            roughness: '/assets/pbr/walls/wall-decor-3d-panels/Roughness.jpg',
            ao: '/assets/pbr/walls/wall-decor-3d-panels/AO.jpg'
        }
    },
    'wall-artificial-stone': {
        preview: '/assets/pbr/walls/wall-artificial-stone/Bricks075A.png',
        maps: {
            color: '/assets/pbr/walls/wall-artificial-stone/Bricks075A_4K-JPG_Color.jpg',
            normal: '/assets/pbr/walls/wall-artificial-stone/Bricks075A_4K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr/walls/wall-artificial-stone/Bricks075A_4K-JPG_Roughness.jpg',
            ao: '/assets/pbr/walls/wall-artificial-stone/Bricks075A_4K-JPG_AmbientOcclusion.jpg'
        }
    },
    'ceiling-pvc-panels': {
        preview: '/assets/pbr/ceiling/ceiling-pvc-panels/Plastic013A.png',
        maps: {
            color: '/assets/pbr/ceiling/ceiling-pvc-panels/Plastic013A_1K-JPG_Color.jpg',
            normal: '/assets/pbr/ceiling/ceiling-pvc-panels/Plastic013A_1K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr/ceiling/ceiling-pvc-panels/Plastic013A_1K-JPG_Roughness.jpg'
        }
    },
    'ceiling-laminate': {
        preview: '/assets/pbr/ceiling/ceiling-laminate/WoodFloor006.png',
        maps: {
            color: '/assets/pbr/ceiling/ceiling-laminate/WoodFloor006_1K-JPG_Color.jpg',
            normal: '/assets/pbr/ceiling/ceiling-laminate/WoodFloor006_1K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr/ceiling/ceiling-laminate/WoodFloor006_1K-JPG_Roughness.jpg'
        }
    },
    'ceiling-stretch': {
        preview: '/assets/pbr/ceiling/ceiling-stretch/Fabric037.png',
        maps: {
            color: '/assets/pbr/ceiling/ceiling-stretch/Fabric037_1K-JPG_Color.jpg',
            normal: '/assets/pbr/ceiling/ceiling-stretch/Fabric037_1K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr/ceiling/ceiling-stretch/Fabric037_1K-JPG_Roughness.jpg',
            ao: '/assets/pbr/ceiling/ceiling-stretch/Fabric037_1K-JPG_AmbientOcclusion.jpg'
        }
    },
    'ceiling-decor-slats': {
        preview: '/assets/pbr/ceiling/ceiling-decor-slats/Albedo.jpg',
        maps: {
            color: '/assets/pbr/ceiling/ceiling-decor-slats/Albedo.jpg',
            normal: '/assets/pbr/ceiling/ceiling-decor-slats/Normal.jpg',
            roughness: '/assets/pbr/ceiling/ceiling-decor-slats/Roughness.jpg',
            ao: '/assets/pbr/ceiling/ceiling-decor-slats/AO.jpg'
        }
    },
    'floor-laminate': {
        preview: '/assets/pbr/floor/floor-laminate/laminate_floor_02_diff_1k.jpg',
        maps: {
            color: '/assets/pbr/floor/floor-laminate/laminate_floor_02_diff_1k.jpg'
        }
    },
    'floor-quartz-vinyl': {
        preview: '/assets/pbr/floor/floor-quartz-vinyl-plank/Tiles052.png',
        maps: {
            color: '/assets/pbr/floor/floor-quartz-vinyl-plank/Tiles052_4K-JPG_Color.jpg',
            normal: '/assets/pbr/floor/floor-quartz-vinyl-plank/Tiles052_4K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr/floor/floor-quartz-vinyl-plank/Tiles052_4K-JPG_Roughness.jpg'
        }
    },
    'floor-parquet-board': {
        preview: '/assets/pbr/floor/floor-parquet-board/Wood066.png',
        maps: {
            color: '/assets/pbr/floor/floor-parquet-board/Wood066_4K-JPG_Color.jpg',
            normal: '/assets/pbr/floor/floor-parquet-board/Wood066_4K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr/floor/floor-parquet-board/Wood066_4K-JPG_Roughness.jpg'
        }
    },
    'floor-tile-porcelain': {
        preview: '/assets/pbr/floor/floor-tile-porcelain/Marble003.png',
        maps: {
            color: '/assets/pbr/floor/floor-tile-porcelain/Marble003_4K-JPG_Color.jpg',
            normal: '/assets/pbr/floor/floor-tile-porcelain/Marble003_4K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr/floor/floor-tile-porcelain/Marble003_4K-JPG_Roughness.jpg'
        }
    }
};

const MaterialVariantAssets = {
    'wall-artificial-stone-v02': {
        preview: '/assets/pbr-variants/walls/wall-artificial-stone/variant-02/Bricks083.png',
        maps: {
            color: '/assets/pbr-variants/walls/wall-artificial-stone/variant-02/Bricks083_4K-JPG_Color.jpg',
            normal: '/assets/pbr-variants/walls/wall-artificial-stone/variant-02/Bricks083_4K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr-variants/walls/wall-artificial-stone/variant-02/Bricks083_4K-JPG_Roughness.jpg',
            ao: '/assets/pbr-variants/walls/wall-artificial-stone/variant-02/Bricks083_4K-JPG_AmbientOcclusion.jpg'
        }
    },
    'wall-artificial-stone-v03': {
        preview: '/assets/pbr-variants/walls/wall-artificial-stone/variant-03/Tiles089.png',
        maps: {
            color: '/assets/pbr-variants/walls/wall-artificial-stone/variant-03/Tiles089_4K-JPG_Color.jpg',
            normal: '/assets/pbr-variants/walls/wall-artificial-stone/variant-03/Tiles089_4K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr-variants/walls/wall-artificial-stone/variant-03/Tiles089_4K-JPG_Roughness.jpg',
            ao: '/assets/pbr-variants/walls/wall-artificial-stone/variant-03/Tiles089_4K-JPG_AmbientOcclusion.jpg'
        }
    },
    'wall-artificial-stone-v04': {
        preview: '/assets/pbr-variants/walls/wall-artificial-stone/variant-04/Bricks003.png',
        maps: {
            color: '/assets/pbr-variants/walls/wall-artificial-stone/variant-04/Bricks003_4K-JPG_Color.jpg',
            normal: '/assets/pbr-variants/walls/wall-artificial-stone/variant-04/Bricks003_4K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr-variants/walls/wall-artificial-stone/variant-04/Bricks003_4K-JPG_Roughness.jpg'
        }
    },
    'wall-decor-3d-panels-v02': {
        preview: '/assets/pbr-variants/walls/wall-decor-3d-panels/variant-02/WoodSiding005.png',
        maps: {
            color: '/assets/pbr-variants/walls/wall-decor-3d-panels/variant-02/WoodSiding005_4K-JPG_Color.jpg',
            normal: '/assets/pbr-variants/walls/wall-decor-3d-panels/variant-02/WoodSiding005_4K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr-variants/walls/wall-decor-3d-panels/variant-02/WoodSiding005_4K-JPG_Roughness.jpg',
            ao: '/assets/pbr-variants/walls/wall-decor-3d-panels/variant-02/WoodSiding005_4K-JPG_AmbientOcclusion.jpg'
        }
    },
    'wall-decor-3d-panels-v03': {
        preview: '/assets/pbr-variants/walls/wall-decor-3d-panels/variant-03/Concrete045.png',
        maps: {
            color: '/assets/pbr-variants/walls/wall-decor-3d-panels/variant-03/Concrete045_4K-JPG_Color.jpg',
            normal: '/assets/pbr-variants/walls/wall-decor-3d-panels/variant-03/Concrete045_4K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr-variants/walls/wall-decor-3d-panels/variant-03/Concrete045_4K-JPG_Roughness.jpg',
            ao: '/assets/pbr-variants/walls/wall-decor-3d-panels/variant-03/Concrete045_4K-JPG_AmbientOcclusion.jpg'
        }
    },
    'wall-euro-lining-painted-v02': {
        preview: '/assets/pbr-variants/walls/wall-euro-lining-painted/variant-02/WoodFloor041.png',
        maps: {
            color: '/assets/pbr-variants/walls/wall-euro-lining-painted/variant-02/WoodFloor041_4K-JPG_Color.jpg',
            normal: '/assets/pbr-variants/walls/wall-euro-lining-painted/variant-02/WoodFloor041_4K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr-variants/walls/wall-euro-lining-painted/variant-02/WoodFloor041_4K-JPG_Roughness.jpg',
            ao: '/assets/pbr-variants/walls/wall-euro-lining-painted/variant-02/WoodFloor041_4K-JPG_AmbientOcclusion.jpg'
        }
    },
    'wall-euro-lining-painted-v03': {
        preview: '/assets/pbr-variants/walls/wall-euro-lining-painted/variant-03/WoodFloor039.png',
        maps: {
            color: '/assets/pbr-variants/walls/wall-euro-lining-painted/variant-03/WoodFloor039_4K-JPG_Color.jpg',
            normal: '/assets/pbr-variants/walls/wall-euro-lining-painted/variant-03/WoodFloor039_4K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr-variants/walls/wall-euro-lining-painted/variant-03/WoodFloor039_4K-JPG_Roughness.jpg',
            ao: '/assets/pbr-variants/walls/wall-euro-lining-painted/variant-03/WoodFloor039_4K-JPG_AmbientOcclusion.jpg'
        }
    },
    'floor-laminate-v02': {
        preview: '/assets/pbr-variants/floor/floor-laminate/variant-02/WoodFloor007.png',
        maps: {
            color: '/assets/pbr-variants/floor/floor-laminate/variant-02/WoodFloor007_4K-JPG_Color.jpg',
            normal: '/assets/pbr-variants/floor/floor-laminate/variant-02/WoodFloor007_4K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr-variants/floor/floor-laminate/variant-02/WoodFloor007_4K-JPG_Roughness.jpg',
            ao: '/assets/pbr-variants/floor/floor-laminate/variant-02/WoodFloor007_4K-JPG_AmbientOcclusion.jpg'
        }
    },
    'floor-laminate-v03': {
        preview: '/assets/pbr-variants/floor/floor-laminate/variant-03/WoodFloor046.png',
        maps: {
            color: '/assets/pbr-variants/floor/floor-laminate/variant-03/WoodFloor046_4K-JPG_Color.jpg',
            normal: '/assets/pbr-variants/floor/floor-laminate/variant-03/WoodFloor046_4K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr-variants/floor/floor-laminate/variant-03/WoodFloor046_4K-JPG_Roughness.jpg'
        }
    },
    'floor-laminate-v04': {
        preview: '/assets/pbr-variants/floor/floor-laminate/variant-04/PaintedWood009C.png',
        maps: {
            color: '/assets/pbr-variants/floor/floor-laminate/variant-04/PaintedWood009C_4K-JPG_Color.jpg',
            normal: '/assets/pbr-variants/floor/floor-laminate/variant-04/PaintedWood009C_4K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr-variants/floor/floor-laminate/variant-04/PaintedWood009C_4K-JPG_Roughness.jpg',
            ao: '/assets/pbr-variants/floor/floor-laminate/variant-04/PaintedWood009C_4K-JPG_AmbientOcclusion.jpg'
        }
    },
    'floor-parquet-board-v02': {
        preview: '/assets/pbr-variants/floor/floor-parquet-board/variant-02/WoodFloor007.png',
        maps: {
            color: '/assets/pbr-variants/floor/floor-parquet-board/variant-02/WoodFloor007_4K-JPG_Color.jpg',
            normal: '/assets/pbr-variants/floor/floor-parquet-board/variant-02/WoodFloor007_4K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr-variants/floor/floor-parquet-board/variant-02/WoodFloor007_4K-JPG_Roughness.jpg',
            ao: '/assets/pbr-variants/floor/floor-parquet-board/variant-02/WoodFloor007_4K-JPG_AmbientOcclusion.jpg'
        }
    },
    'floor-parquet-board-v03': {
        preview: '/assets/pbr-variants/floor/floor-parquet-board/variant-03/WoodFloor034.png',
        maps: {
            color: '/assets/pbr-variants/floor/floor-parquet-board/variant-03/WoodFloor034_4K-JPG_Color.jpg',
            normal: '/assets/pbr-variants/floor/floor-parquet-board/variant-03/WoodFloor034_4K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr-variants/floor/floor-parquet-board/variant-03/WoodFloor034_4K-JPG_Roughness.jpg',
            ao: '/assets/pbr-variants/floor/floor-parquet-board/variant-03/WoodFloor034_4K-JPG_AmbientOcclusion.jpg'
        }
    },
    'floor-parquet-board-v04': {
        preview: '/assets/pbr-variants/floor/floor-parquet-board/variant-04/WoodFloor035.png',
        maps: {
            color: '/assets/pbr-variants/floor/floor-parquet-board/variant-04/WoodFloor035_4K-JPG_Color.jpg',
            normal: '/assets/pbr-variants/floor/floor-parquet-board/variant-04/WoodFloor035_4K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr-variants/floor/floor-parquet-board/variant-04/WoodFloor035_4K-JPG_Roughness.jpg',
            ao: '/assets/pbr-variants/floor/floor-parquet-board/variant-04/WoodFloor035_4K-JPG_AmbientOcclusion.jpg'
        }
    },
    'floor-quartz-vinyl-v02': {
        preview: '/assets/pbr-variants/floor/floor-quartz-vinyl/variant-02/Marble007.png',
        maps: {
            color: '/assets/pbr-variants/floor/floor-quartz-vinyl/variant-02/Marble007_4K-JPG_Color.jpg',
            normal: '/assets/pbr-variants/floor/floor-quartz-vinyl/variant-02/Marble007_4K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr-variants/floor/floor-quartz-vinyl/variant-02/Marble007_4K-JPG_Roughness.jpg'
        }
    },
    'floor-quartz-vinyl-v03': {
        preview: '/assets/pbr-variants/floor/floor-quartz-vinyl/variant-03/Marble020.png',
        maps: {
            color: '/assets/pbr-variants/floor/floor-quartz-vinyl/variant-03/Marble020_4K-JPG_Color.jpg',
            normal: '/assets/pbr-variants/floor/floor-quartz-vinyl/variant-03/Marble020_4K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr-variants/floor/floor-quartz-vinyl/variant-03/Marble020_4K-JPG_Roughness.jpg'
        }
    },
    'floor-quartz-vinyl-v04': {
        preview: '/assets/pbr-variants/floor/floor-quartz-vinyl/variant-04/Travertine001.png',
        maps: {
            color: '/assets/pbr-variants/floor/floor-quartz-vinyl/variant-04/Travertine001_4K-JPG_Color.jpg',
            normal: '/assets/pbr-variants/floor/floor-quartz-vinyl/variant-04/Travertine001_4K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr-variants/floor/floor-quartz-vinyl/variant-04/Travertine001_4K-JPG_Roughness.jpg',
            ao: '/assets/pbr-variants/floor/floor-quartz-vinyl/variant-04/Travertine001_4K-JPG_AmbientOcclusion.jpg'
        }
    },
    'floor-tile-porcelain-v02': {
        preview: '/assets/pbr-variants/floor/floor-tile-porcelain/variant-02/Tiles107.png',
        maps: {
            color: '/assets/pbr-variants/floor/floor-tile-porcelain/variant-02/Tiles107_4K-JPG_Color.jpg',
            normal: '/assets/pbr-variants/floor/floor-tile-porcelain/variant-02/Tiles107_4K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr-variants/floor/floor-tile-porcelain/variant-02/Tiles107_4K-JPG_Roughness.jpg',
            ao: '/assets/pbr-variants/floor/floor-tile-porcelain/variant-02/Tiles107_4K-JPG_AmbientOcclusion.jpg'
        }
    },
    'floor-tile-porcelain-v03': {
        preview: '/assets/pbr-variants/floor/floor-tile-porcelain/variant-03/Tiles040.png',
        maps: {
            color: '/assets/pbr-variants/floor/floor-tile-porcelain/variant-03/Tiles040_4K-JPG_Color.jpg',
            normal: '/assets/pbr-variants/floor/floor-tile-porcelain/variant-03/Tiles040_4K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr-variants/floor/floor-tile-porcelain/variant-03/Tiles040_4K-JPG_Roughness.jpg'
        }
    },
    'floor-tile-porcelain-v04': {
        preview: '/assets/pbr-variants/floor/floor-tile-porcelain/variant-04/Tiles078.png',
        maps: {
            color: '/assets/pbr-variants/floor/floor-tile-porcelain/variant-04/Tiles078_4K-JPG_Color.jpg',
            normal: '/assets/pbr-variants/floor/floor-tile-porcelain/variant-04/Tiles078_4K-JPG_NormalGL.jpg',
            roughness: '/assets/pbr-variants/floor/floor-tile-porcelain/variant-04/Tiles078_4K-JPG_Roughness.jpg'
        }
    }
};

let materialAssetCatalogEnabled = false;
let verifiedMaterialAssetIds = new Set();

function hasUsableAssetInfo(assetInfo) {
    if (!assetInfo || typeof assetInfo !== 'object') return false;
    if (assetInfo.preview) return true;
    return Object.values(assetInfo.maps || {}).some(Boolean);
}

function getVerifiedAssetInfo(materialId) {
    if (!materialAssetCatalogEnabled || !verifiedMaterialAssetIds.has(materialId)) {
        return null;
    }

    return MaterialAssetCatalog[materialId] || null;
}

function setMaterialCatalogAssetState(enabled) {
    materialAssetCatalogEnabled = Boolean(enabled);
    if (!materialAssetCatalogEnabled) {
        verifiedMaterialAssetIds = new Set();
    }

    Object.values(MaterialsDatabase).flat().forEach((material) => {
        const assetInfo = getVerifiedAssetInfo(material.id);
        material.image = assetInfo?.preview || null;
        material.preview = assetInfo?.preview || null;
        material.maps = assetInfo?.maps || null;
    });
}

function expandMaterialsWithVariants() {
    const existingById = new Set(Object.values(MaterialsDatabase).flat().map((material) => material.id));

    Object.entries(MaterialVariantAssets).forEach(([variantId, assetInfo]) => {
        if (existingById.has(variantId)) return;

        const baseMatch = /^(.+)-v(\d{2})$/.exec(variantId);
        if (!baseMatch) return;

        const baseId = baseMatch[1];
        const variantNumber = Number(baseMatch[2]);
        if (!Number.isFinite(variantNumber)) return;

        const category = ['walls', 'ceiling', 'floor'].find((cat) =>
            (MaterialsDatabase[cat] || []).some((material) => material.id === baseId)
        );
        if (!category) return;

        const baseMaterial = MaterialsDatabase[category].find((material) => material.id === baseId);
        if (!baseMaterial) return;

        MaterialsDatabase[category].push({
            ...baseMaterial,
            id: variantId,
            name: `${baseMaterial.name} (Variant ${variantNumber})`,
            image: null,
            preview: null,
            maps: null,
            baseMaterialId: baseMaterial.id
        });

        MaterialAssetCatalog[variantId] = assetInfo;
    });
}

function inferLocalMaterialAIProfile(material) {
    if (!material?.id) return null;

    const sample = `${material.id} ${material.texture || ''} ${material.name || ''}`.toLowerCase();
    let pattern = 'wall-generic';

    if (/stone|brick|clinker|travertine|rock/.test(sample)) {
        pattern = 'stone';
    } else if (/decor.*3d|3d.*panel|relief/.test(sample)) {
        pattern = 'decor3d';
    } else if (/tile|porcelain|ceramic|marble|granite/.test(sample)) {
        pattern = 'tile';
    } else if (/wood|parquet|laminate|laminat|lining|mdf/.test(sample)) {
        pattern = 'wood';
    } else if (/pvc|plastic|pvh/.test(sample)) {
        pattern = 'pvc';
    } else if (/stretch|fabric/.test(sample)) {
        pattern = 'stretch';
    } else if (/vinyl/.test(sample)) {
        pattern = 'vinyl';
    } else if (material.category === 'floor') {
        pattern = 'floor-generic';
    } else if (material.category === 'ceiling') {
        pattern = 'ceiling-generic';
    }

    const presets = {
        tile: { metersPerRepeat: 2.15, minRepeat: 0.8, maxRepeat: 3.2, roughness: 0.34, metalness: 0.05, normalStrength: 1.25, reliefStrength: 0.55, bumpScale: 0.014, preserveMotif: true, useGeneratedRelief: true },
        stone: { metersPerRepeat: 1.55, minRepeat: 0.9, maxRepeat: 3.6, roughness: 0.9, metalness: 0.02, normalStrength: 1.75, reliefStrength: 1.35, bumpScale: 0.045, preserveMotif: true, useGeneratedRelief: true, useTriplanarHint: true },
        decor3d: { metersPerRepeat: 1.25, minRepeat: 0.8, maxRepeat: 3.4, roughness: 0.76, metalness: 0.02, normalStrength: 1.55, reliefStrength: 1.2, bumpScale: 0.035, preserveMotif: true, useGeneratedRelief: true },
        wood: { metersPerRepeat: 1.85, minRepeat: 0.75, maxRepeat: 4.0, roughness: 0.58, metalness: 0.04, normalStrength: 0.95, reliefStrength: 0.45, bumpScale: 0.01, preserveMotif: false, useGeneratedRelief: true },
        pvc: { metersPerRepeat: 1.9, minRepeat: 0.6, maxRepeat: 3.8, roughness: 0.34, metalness: 0.03, normalStrength: 0.75, reliefStrength: 0.25, bumpScale: 0.006, preserveMotif: false, useGeneratedRelief: false },
        stretch: { metersPerRepeat: 2.4, minRepeat: 0.45, maxRepeat: 2.4, roughness: 0.18, metalness: 0.02, normalStrength: 0.35, reliefStrength: 0.12, bumpScale: 0.002, preserveMotif: false, useGeneratedRelief: false },
        vinyl: { metersPerRepeat: 1.9, minRepeat: 0.65, maxRepeat: 3.8, roughness: 0.46, metalness: 0.03, normalStrength: 0.9, reliefStrength: 0.35, bumpScale: 0.008, preserveMotif: false, useGeneratedRelief: true },
        'floor-generic': { metersPerRepeat: 1.9, minRepeat: 0.75, maxRepeat: 3.8, roughness: 0.6, metalness: 0.04, normalStrength: 1, reliefStrength: 0.4, bumpScale: 0.01, preserveMotif: false, useGeneratedRelief: true },
        'ceiling-generic': { metersPerRepeat: 2.4, minRepeat: 0.45, maxRepeat: 2.8, roughness: 0.45, metalness: 0.03, normalStrength: 0.7, reliefStrength: 0.22, bumpScale: 0.005, preserveMotif: false, useGeneratedRelief: false },
        'wall-generic': { metersPerRepeat: 1.7, minRepeat: 0.7, maxRepeat: 4.0, roughness: 0.62, metalness: 0.03, normalStrength: 1, reliefStrength: 0.45, bumpScale: 0.01, preserveMotif: false, useGeneratedRelief: true }
    };

    const base = presets[pattern] || presets['wall-generic'];
    const floorTuning = material.category === 'floor'
        ? {
            metersPerRepeat: Math.max(base.metersPerRepeat, pattern === 'tile' ? 2.35 : 1.9),
            minRepeat: Math.max(base.minRepeat, 0.75),
            maxRepeat: Math.min(base.maxRepeat, pattern === 'tile' ? 2.8 : 3.8)
        }
        : {};
    const ceilingTuning = material.category === 'ceiling'
        ? {
            metersPerRepeat: Math.max(base.metersPerRepeat, 2.2),
            maxRepeat: Math.min(base.maxRepeat, 2.8)
        }
        : {};

    return {
        pattern,
        source: 'local-catalog-profile',
        aspectRatio: 1,
        qualityScore: 0.85,
        ...base,
        ...floorTuning,
        ...ceilingTuning
    };
}

const MaterialAIProfiles = {};

const ColorPalettes = {
    neutral: [
        { name: '\u0411\u0435\u043b\u044b\u0439', hex: '#FFFFFF' },
        { name: '\u0421\u0432\u0435\u0442\u043b\u043e-\u0441\u0435\u0440\u044b\u0439', hex: '#F5F5F5' },
        { name: '\u0421\u0435\u0440\u044b\u0439', hex: '#9E9E9E' },
        { name: '\u0422\u0451\u043c\u043d\u043e-\u0441\u0435\u0440\u044b\u0439', hex: '#616161' },
        { name: '\u0411\u0435\u0436\u0435\u0432\u044b\u0439', hex: '#E7DDCF' },
        { name: '\u0413\u0440\u0435\u0439\u0434\u0436', hex: '#C7BFB2' }
    ],
    warm: [
        { name: '\u041c\u043e\u043b\u043e\u0447\u043d\u044b\u0439', hex: '#FFF6E9' },
        { name: '\u041f\u0435\u0441\u043e\u0447\u043d\u044b\u0439', hex: '#E6C9A8' },
        { name: '\u041a\u0430\u0440\u0430\u043c\u0435\u043b\u044c\u043d\u044b\u0439', hex: '#D4A574' },
        { name: '\u0422\u0435\u0440\u0440\u0430\u043a\u043e\u0442', hex: '#C47F5A' },
        { name: '\u041a\u043e\u0440\u0438\u0446\u0430', hex: '#8B5E3C' },
        { name: '\u0422\u0451\u043f\u043b\u044b\u0439 \u0431\u0435\u0436', hex: '#EAD9C8' }
    ],
    cool: [
        { name: '\u041b\u0435\u0434\u044f\u043d\u043e\u0439', hex: '#F3F8FB' },
        { name: '\u0421\u0435\u0440\u043e-\u0433\u043e\u043b\u0443\u0431\u043e\u0439', hex: '#C8D7E1' },
        { name: '\u0421\u0442\u0430\u043b\u044c', hex: '#8FA3B0' },
        { name: '\u0413\u0440\u0430\u0444\u0438\u0442', hex: '#54636F' },
        { name: '\u0425\u043e\u043b\u043e\u0434\u043d\u044b\u0439 \u0431\u0435\u043b\u044b\u0439', hex: '#FAFCFF' },
        { name: '\u041c\u043e\u0440\u0441\u043a\u043e\u0439 \u0442\u0443\u043c\u0430\u043d', hex: '#B7C6CF' }
    ],
    nature: [
        { name: '\u041b\u0438\u043f\u0430', hex: '#D5B894' },
        { name: '\u0414\u0443\u0431', hex: '#B58A62' },
        { name: '\u041e\u043b\u0438\u0432\u0430', hex: '#A6A17A' },
        { name: '\u041c\u043e\u0445', hex: '#6E7F5B' },
        { name: '\u041f\u0435\u0441\u043e\u043a', hex: '#DCC7A1' },
        { name: '\u041a\u0430\u043c\u0435\u043d\u044c', hex: '#90867A' }
    ],
    modern: [
        { name: '\u0410\u043d\u0442\u0440\u0430\u0446\u0438\u0442', hex: '#263238' },
        { name: '\u0413\u0440\u0430\u0444\u0438\u0442', hex: '#424B54' },
        { name: '\u0425\u0440\u043e\u043c', hex: '#8C98A4' },
        { name: '\u0411\u0435\u0442\u043e\u043d', hex: '#B7B8BA' },
        { name: '\u0416\u0435\u043c\u0447\u0443\u0433', hex: '#E8E8E6' },
        { name: '\u0413\u0440\u0430\u0444\u0438\u0442 \u0442\u0451\u043f\u043b\u044b\u0439', hex: '#5E5A57' }
    ],
    vivid: [
        { name: '\u041a\u043e\u0440\u0430\u043b\u043b', hex: '#FF6B6B' },
        { name: '\u0411\u0438\u0440\u044e\u0437\u0430', hex: '#4ECDC4' },
        { name: '\u041b\u0430\u0437\u0443\u0440\u044c', hex: '#45B7D1' },
        { name: '\u0413\u043e\u0440\u0447\u0438\u0446\u0430', hex: '#D9A441' },
        { name: '\u0422\u0435\u0440\u0440\u0430\u043a\u043e\u0442\u0430', hex: '#C96A4A' },
        { name: '\u0428\u0430\u043b\u0444\u0435\u0439', hex: '#7FA28A' }
    ]
};

const MaterialColors = Object.values(ColorPalettes).flat();

const WorkPrices = {
    base: {
        2: 18000,
        3: 23500,
        4: 29800,
        5: 36500,
        6: 43200
    },
    types: {
        walls: 950,
        ceiling: 850,
        floor: 900,
        windowInstall: 6500,
        panoramicInstall: 12500,
        windowPremiumInstall: 9200,
        aluminumInstall: 7800,
        windowsillInstall: 1200,
        sillInstall: 900,
        insulation: 700,
        wiring: 5500,
        floorHeating: 1800,
        ventilation: 6200,
        demolition: 4800,
        disposal: 3500
    },
    coefficients: {
        angle: 1.15,
        pShape: 1.28,
        highFloor: 1.12,
        tightAccess: 1.08
    }
};

const MaterialsAPI = {
    getByCategory(category) {
        return MaterialsDatabase[category] || [];
    },

    getById(id, category) {
        const items = MaterialsDatabase[category];
        if (!items) return null;
        return items.find((item) => item.id === id) || null;
    },

    getAllCategories() {
        return Object.keys(MaterialsDatabase);
    },

    getPopular(category = null) {
        if (category) {
            return MaterialsDatabase[category]?.filter((m) => m.popular) || [];
        }
        return Object.values(MaterialsDatabase).flat().filter((m) => m.popular);
    },

    search(query) {
        const lowerQuery = query.toLowerCase();
        return Object.values(MaterialsDatabase)
            .flat()
            .filter((item) => item.name.toLowerCase().includes(lowerQuery) || item.description.toLowerCase().includes(lowerQuery));
    },

    calculateArea(type, dimensions) {
        const { length, width, height, shape } = dimensions;

        switch (type) {
            case 'walls':
                return this.calculateWallsArea(length, width, height, shape);
            case 'ceiling':
            case 'floor':
                return this.calculateFloorArea(length, width, shape);
            default:
                return 0;
        }
    },

    calculateWallsArea(length, width, height, shape) {
        let perimeter;

        switch (shape) {
            case 'hrushchevka':
            case 'loggia-3':
            case 'loggia-6':
                perimeter = (length + width) * 2;
                break;
            case 'g-shaped':
            case 'g-shaped-right':
                perimeter = (length + width) * 2 + Math.min(Math.max(length * 0.31, 0.96), 1.82) + Math.min(Math.max(width * 0.504, 0.41), 0.7);
                break;
            case 'boot':
                perimeter =
                    length +
                    width +
                    length * (400 / 3200) +
                    Math.hypot(length * (400 / 3200), width * (900 / 2100)) +
                    length * (2400 / 3200) +
                    width * (1200 / 2100);
                break;
            case 'p-shaped':
            case 'iron':
                perimeter = (length + width) * 2 + (Math.min(Math.max(length * 0.31, 0.96), 1.82) * 2) + (Math.min(Math.max(width * 0.504, 0.41), 0.7) * 2);
                break;
            case 'boat':
                perimeter =
                    length * (3250 / 3650) +
                    width * (280 / 960) +
                    length * (400 / 3650) +
                    width * (680 / 960) +
                    length * (1950 / 3650) +
                    Math.hypot(length * (1700 / 3650), width * (560 / 960)) +
                    width * (400 / 960);
                break;
            default:
                perimeter = (length + width) * 2;
        }

        const windowArea = perimeter * height * 0.3;
        return Math.round((perimeter * height - windowArea) * 10) / 10;
    },

    calculateFloorArea(length, width, shape) {
        let area = length * width;

        switch (shape) {
            case 'g-shaped':
            case 'g-shaped-right':
                area += Math.min(Math.max(length * 0.31, 0.96), 1.82) * Math.min(Math.max(width * 0.504, 0.41), 0.7);
                break;
            case 'p-shaped':
                area += Math.min(Math.max(length * 0.31, 0.96), 1.82) * Math.min(Math.max(width * 0.504, 0.41), 0.7) * 2;
                break;
            case 'boot':
                area =
                    length * width * (1200 / 2100) +
                    (length * (400 / 3200) * width * (900 / 2100)) / 2 +
                    length * (400 / 3200) * width * (900 / 2100);
                break;
            case 'iron':
                area *= 1.12;
                break;
            case 'boat':
                area *= 0.83;
                break;
        }

        return Math.round(area * 10) / 10;
    },

    calculateWorkPrice(workType, area, options = {}) {
        const basePrice = WorkPrices.types[workType] || 0;
        let price = basePrice * area;

        if (['g-shaped', 'g-shaped-right', 'boot'].includes(options.shape)) {
            price *= WorkPrices.coefficients.angle;
        } else if (['p-shaped', 'iron', 'boat'].includes(options.shape)) {
            price *= WorkPrices.coefficients.pShape;
        }

        return Math.round(price);
    },

    getBaseWorkPrice(size) {
        const sizes = Object.keys(WorkPrices.base).map(Number).sort((a, b) => a - b);
        let closestSize = sizes[0];
        for (const s of sizes) {
            if (s <= size) closestSize = s;
        }
        return WorkPrices.base[closestSize] || WorkPrices.base[2];
    },

    getColorPalette(paletteName) {
        return ColorPalettes[paletteName] || ColorPalettes.neutral;
    },

    getAllColors() {
        return MaterialColors;
    },

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
            ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            }
            : { r: 0, g: 0, b: 0 };
    },

    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map((x) => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    },

    getColorName(hex) {
        for (const palette of Object.values(ColorPalettes)) {
            const color = palette.find((item) => item.hex.toUpperCase() === hex.toUpperCase());
            if (color) return color.name;
        }
        return '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c\u0441\u043a\u0438\u0439';
    },

    getAssetInfo(materialOrId, category = null) {
        const material = typeof materialOrId === 'string'
            ? this.getById(materialOrId, category)
            : materialOrId;

        if (!material?.id) return null;
        return getVerifiedAssetInfo(material.id);
    },

    getPreviewImage(materialOrId, category = null) {
        return this.getAssetInfo(materialOrId, category)?.preview || null;
    },

    getPBRMaps(materialOrId, category = null) {
        return this.getAssetInfo(materialOrId, category)?.maps || null;
    },

    getAIProfile(materialOrId, category = null) {
        const material = typeof materialOrId === 'string'
            ? this.getById(materialOrId, category) || { id: materialOrId }
            : materialOrId;

        if (!material?.id) return null;
        return MaterialAIProfiles[material.id] || inferLocalMaterialAIProfile(material);
    },

    applyAssetOverrides(overrides = {}) {
        if (!overrides || typeof overrides !== 'object') return;
        const usableOverrides = Object.entries(overrides).filter(([, override]) => hasUsableAssetInfo(override));
        if (usableOverrides.length > 0) {
            materialAssetCatalogEnabled = true;
        }

        usableOverrides.forEach(([materialId, override]) => {
            if (!materialId || !override || typeof override !== 'object') return;
            verifiedMaterialAssetIds.add(materialId);

            const previous = MaterialAssetCatalog[materialId] || {};
            const verifiedMaps = { ...(override.maps || {}) };

            MaterialAssetCatalog[materialId] = {
                ...previous,
                ...override,
                preview: override.preview || verifiedMaps.color || null,
                maps: verifiedMaps
            };
        });

        Object.values(MaterialsDatabase).flat().forEach((material) => {
            const assetInfo = getVerifiedAssetInfo(material.id);

            material.image = assetInfo?.preview || null;
            material.preview = assetInfo?.preview || null;
            material.maps = assetInfo?.maps || null;
        });
    },

    applyAIProfiles(profiles = {}) {
        if (!profiles || typeof profiles !== 'object') return;

        Object.entries(profiles).forEach(([materialId, profile]) => {
            if (!materialId || !profile || typeof profile !== 'object') return;
            MaterialAIProfiles[materialId] = {
                ...(MaterialAIProfiles[materialId] || {}),
                ...profile
            };
        });
    },

    async loadAssetOverridesFromServer() {
        if (typeof fetch !== 'function') return;

        const response = await fetch('/api/materials/asset-overrides', {
            method: 'GET',
            headers: {
                Accept: 'application/json'
            }
        });

        if (!response.ok) return;
        const payload = await response.json();
        if (!payload?.success || !payload.overrides) return;

        const usableOverrides = Object.fromEntries(
            Object.entries(payload.overrides || {}).filter(([, override]) => hasUsableAssetInfo(override))
        );

        if (!payload.stats?.materialsDetected && Object.keys(usableOverrides).length === 0) {
            setMaterialCatalogAssetState(false);
            this.applyAIProfiles(payload.profiles || {});
            return;
        }

        this.applyAssetOverrides(usableOverrides);
        this.applyAIProfiles(payload.profiles || {});
    },

    exportForServer() {
        return {
            materials: MaterialsDatabase,
            assets: MaterialAssetCatalog,
            workPrices: WorkPrices,
            colors: {
                palettes: ColorPalettes,
                all: MaterialColors
            }
        };
    }
};

(function initMaterials() {
    expandMaterialsWithVariants();
    setMaterialCatalogAssetState(false);

    console.log('Materials API initialized');
    console.log('Categories:', MaterialsAPI.getAllCategories());
    console.log('Popular items:', MaterialsAPI.getPopular().length);
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MaterialsDatabase,
        ColorPalettes,
        MaterialColors,
        WorkPrices,
        MaterialsAPI,
        MaterialAIProfiles
    };
}

window.MaterialsDatabase = MaterialsDatabase;
window.ColorPalettes = ColorPalettes;
window.MaterialColors = MaterialColors;
window.WorkPrices = WorkPrices;
window.MaterialsAPI = MaterialsAPI;
window.MaterialAIProfiles = MaterialAIProfiles;

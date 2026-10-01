const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk');
const logger = require('./utils/logger');
const { cleanPhone, cleanString } = require('./utils/validation');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// AI assistant — created only if a key is configured (otherwise the endpoint
// degrades gracefully).
const anthropicClient = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null;
const AI_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const UPLOAD_EXTENSIONS = new Set(['.jpg', '.jpeg', '.jpe', '.png', '.gif', '.webp']);
const UPLOAD_MIME_TYPES = new Set([
    'image/jpeg',
    'image/pjpeg',
    'image/png',
    'image/gif',
    'image/webp'
]);

function sanitizeUploadFilename(originalName = 'upload') {
    const ext = path.extname(originalName).toLowerCase();
    const base = path.basename(originalName, ext)
        .normalize('NFKD')
        .replace(/[^\w.-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80) || 'upload';

    return `${base}${UPLOAD_EXTENSIONS.has(ext) ? ext : '.bin'}`;
}

const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    message: { success: false, error: 'Слишком много запросов. Попробуйте позже.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => !req.path.startsWith('/api')
});

const callRequestLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    message: { success: false, error: 'Слишком много заявок. Пожалуйста, позвоните нам напрямую.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip
});

const aiChatLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 40,
    message: { success: false, error: 'Слишком много сообщений. Немного подождите.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip
});

const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
const siteHost = (() => {
    try { return new URL(siteUrl).hostname; } catch { return 'localhost'; }
})();

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'blob:'],
            connectSrc: ["'self'"],
            frameSrc: ['https://yandex.ru'],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: NODE_ENV === 'production' ? [] : null
        }
    },
    crossOriginEmbedderPolicy: false
}));

const allowedOrigins = new Set(
    [siteUrl, 'http://localhost:3000', 'http://127.0.0.1:3000']
        .filter(Boolean)
);
// In development the Vite dev server runs on a different origin (5173/5174 + LAN
// IPs) and proxies /api here — allow local origins so the SPA can reach the API.
const devOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|172\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/;
app.use(cors({
    origin: (origin, callback) => {
        if (
            !origin ||
            allowedOrigins.has(origin) ||
            (NODE_ENV !== 'production' && devOriginPattern.test(origin))
        ) {
            callback(null, true);
        } else {
            callback(new Error('CORS: origin not allowed'));
        }
    },
    credentials: true
}));
app.use(compression());
app.use(morgan(NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api', apiLimiter);

const requiredDirs = [
    './database',
    './public/uploads',
    './public/uploads/gallery/before',
    './public/uploads/gallery/process',
    './public/uploads/gallery/after',
    './public/assets/images/hero-slider',
    './logs',
    './server/config',
    './server/routes',
    './server/models',
    './server/utils'
];

requiredDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info('Created required directory', { dir });
    }
});

const uploadsGitkeep = './public/uploads/.gitkeep';
if (!fs.existsSync(uploadsGitkeep)) {
    fs.writeFileSync(uploadsGitkeep, '');
}

const Database = require('./config/database');
const db = new Database(process.env.DB_PATH || './database/balcony.db');
{
    const originalLog = console.log;
    const originalWarn = console.warn;
    try {
        console.log = () => {};
        console.warn = () => {};
        db.initialize();
    } finally {
        console.log = originalLog;
        console.warn = originalWarn;
    }
}
logger.info('Database initialized', { path: process.env.DB_PATH || './database/balcony.db' });

const EmailService = require('./config/email');
const emailService = new EmailService({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
    from: process.env.EMAIL_FROM
});

const TelegramBot = require('./utils/telegram-bot');
const telegramBot = new TelegramBot({
    token: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
    enabled: process.env.TELEGRAM_ENABLED === 'true'
});

const { createAdminGuard } = require('./middleware/admin-auth');
const adminGuard = createAdminGuard();

const ordersRouter = require('./routes/orders');

app.use('/api/orders', ordersRouter({ db, emailService, telegramBot, adminGuard }));

app.get('/api/hero-slides', (req, res) => {
    try {
        const heroSlidesDir = path.join(__dirname, '../public/assets/images/hero-slider');
        const supportedExtensions = new Set(['.jpg', '.jpeg', '.webp', '.png', '.svg']);

        if (!fs.existsSync(heroSlidesDir)) {
            return res.json({ success: true, slides: [] });
        }

        const collator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });
        const slides = fs.readdirSync(heroSlidesDir, { withFileTypes: true })
            .filter((entry) => {
                if (!entry.isFile() || entry.name.startsWith('.')) return false;
                return supportedExtensions.has(path.extname(entry.name).toLowerCase());
            })
            .map((entry) => entry.name)
            .sort((a, b) => collator.compare(a, b))
            .slice(0, 5)
            .map((filename) => `/assets/images/hero-slider/${encodeURIComponent(filename)}`);

        return res.json({ success: true, slides });
    } catch (error) {
        logger.error('Hero slides list error', error);
        return res.status(500).json({
            success: false,
            error: 'Не удалось получить список фотографий для главного экрана'
        });
    }
});

app.get('/api/gallery', (req, res) => {
    try {
        const galleryRoot = path.join(__dirname, '../public/uploads/gallery');
        const supportedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
        const categories = [
            { id: 'before', title: 'До работ', folder: 'before' },
            { id: 'process', title: 'Процесс', folder: 'process' },
            { id: 'after', title: 'После работ', folder: 'after' }
        ];
        const collator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });

        const sections = categories.map((category) => {
            const folderPath = path.join(galleryRoot, category.folder);
            if (!fs.existsSync(folderPath)) {
                return { ...category, images: [] };
            }

            const images = fs.readdirSync(folderPath, { withFileTypes: true })
                .filter((entry) => {
                    if (!entry.isFile() || entry.name.startsWith('.')) return false;
                    return supportedExtensions.has(path.extname(entry.name).toLowerCase());
                })
                .map((entry) => entry.name)
                .sort((a, b) => collator.compare(a, b))
                .map((filename) => ({
                    filename,
                    url: `/uploads/gallery/${category.folder}/${encodeURIComponent(filename)}`
                }));

            return { ...category, images };
        });

        return res.json({ success: true, sections });
    } catch (error) {
        logger.error('Gallery list error', error);
        return res.status(500).json({
            success: false,
            error: 'Не удалось получить список фотографий галереи'
        });
    }
});

// Three.js r184+ bundle is served from public/vendor/three.global.js
// (built via: npm run build:three)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './public/uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}-${sanitizeUploadFilename(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const extname = UPLOAD_EXTENSIONS.has(path.extname(file.originalname).toLowerCase());
        const mimetype = UPLOAD_MIME_TYPES.has(String(file.mimetype || '').toLowerCase());

        if (extname && mimetype) {
            cb(null, true);
            return;
        }
        const error = new Error('Разрешены только изображения: jpeg, jpg, png, gif, webp');
        error.status = 400;
        cb(error);
    }
});

app.post('/api/upload', upload.single('screenshot'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Файл не был загружен'
            });
        }

        return res.json({
            success: true,
            filename: req.file.filename,
            path: `/uploads/${req.file.filename}`,
            size: req.file.size
        });
    } catch (error) {
        logger.error('File upload error', error);
        return res.status(500).json({
            success: false,
            error: 'Не удалось загрузить файл'
        });
    }
});

app.post('/api/request-call', callRequestLimiter, async (req, res) => {
    try {
        const name = cleanString(req.body?.name, { max: 120 }) || 'Client';
        const phone = cleanPhone(req.body?.phone);

        if (!phone || phone.length < 10) {
            return res.status(400).json({
                success: false,
                error: 'Укажите корректный номер телефона'
            });
        }

        const callRequest = {
            name,
            phone,
            createdAt: new Date().toISOString(),
            status: 'pending'
        };

        const saved = db.saveCallRequest(callRequest);
        if (!saved) {
            logger.error('Call request was not saved', new Error('Database save returned a falsy value'));
            return res.status(500).json({
                success: false,
                error: 'Не удалось сохранить заявку'
            });
        }

        const telegramResult = await telegramBot.sendCallRequest(callRequest);
        if (!telegramResult?.success) {
            logger.warn('Telegram call request notification failed', { error: telegramResult?.error });
        }

        return res.json({
            success: true,
            message: 'Заявка принята. Мы перезвоним в ближайшее время.'
        });
    } catch (error) {
        logger.error('Call request error', error);
        return res.status(500).json({
            success: false,
            error: 'Не удалось обработать заявку'
        });
    }
});

/* ------------------------------------------------------------------ *
 * AI renovation advisor (Claude)
 * ------------------------------------------------------------------ */

// Values the assistant may set in the 2D configurator. They must match the ids in
// src/pages/Configurator/vamCatalog.ts / ChatWidget.tsx (which maps them onto the
// catalogue and drops anything the current layout doesn't have).
const AI_VALID = {
    layout: ['sapozhok', 'lodochka', 'utyuzhok', 'loggia', 'long-loggia', 'khrushchevka'],
    wallFamily: ['laminat', 'vagonka', 'parket', 'mdf'],
    floorFamily: ['laminat', 'plitka'],
    glazing: ['classic', 'panoramic'],
    plintus: ['none', 'white', 'grey', 'brown'],
    lamp: ['none', 'pendant', 'flat', 'cylinder', 'loft', 'track-black', 'track-white']
};

// Furniture the assistant may add (one per reply) — mapped to the scene's items in ChatWidget.tsx.
const AI_OBJECT_TYPES = [
    'cabinet-2door', 'cabinet-3door', 'cabinet-4door', 'cabinet-low',
    'bar-stool', 'dryer', 'plant'
];

function buildAiSystemPrompt(page, config) {
    return `Ты — эксперт-консультант компании «БАЛКОН-МСК» по ремонту и остеклению балконов в Москве. Отвечай по-русски, дружелюбно и профессионально. Помогай клиенту выбрать остекление, утепление, отделку, мебель и освещение; объясняй различия и сроки. Стоимость в конфигураторе не считается — на вопрос о цене мягко предложи бесплатный замер и точную смету от специалиста. Ответы краткие: 2–4 предложения, если не просят подробнее.

Текущая страница пользователя: ${page}.
Текущая конфигурация балкона: ${JSON.stringify(config)}.

Ты можешь менять сцену в конфигураторе. Используй ТОЛЬКО эти id значений:
- layout (форма балкона): sapozhok=Сапожок, lodochka=Лодочка, utyuzhok=Утюжок, loggia=Обычная лоджия, long-loggia=Удлинённая лоджия, khrushchevka=Хрущёвка
- wallFamily (отделка стен): laminat=Ламинат, vagonka=Вагонка, parket=Стеновой паркет, mdf=МДФ-панели (МДФ — только для сапожка)
- floorFamily (пол): laminat=Ламинат, plitka=Плитка
- glazing (остекление): classic=Окна от парапета, panoramic=Панорамное (в пол; у Утюжка только «от парапета»)
- plintus: none=без плинтуса, white=белый, grey=серый, brown=тёмно-коричневый
- lamp (потолочный светильник): none=без, pendant=подвесной, flat=плоский, cylinder=накладной цилиндр, loft=лофт-клетка, track-black=трековый чёрный, track-white=трековый белый

Ты также можешь добавить один предмет на балкон (по одному за раз, положение выбирает сам конфигуратор) — поле "addObject" с ТОЧНО одним из этих id:
cabinet-2door=Шкаф на 2 дверцы, cabinet-3door=Шкаф на 3 дверцы, cabinet-4door=Шкаф на 4 дверцы, cabinet-low=Низкий шкаф с подушками, bar-stool=Барный стул, dryer=Сушилка для белья, plant=Комнатное растение.

Отвечай СТРОГО одним JSON-объектом без markdown и без тройных кавычек, в формате:
{"message":"<текст ответа>","config":{<только нужные поля из списка выше, опционально>},"addObject":<id предмета или null>,"lead":<true если клиент готов заказать/записаться, иначе false>}
Если менять конфигурацию не нужно — опусти config или передай {}. Если добавлять предмет не нужно — передай null. Других полей не добавляй.`;
}

function parseAiResponse(text) {
    let obj = null;
    try {
        obj = JSON.parse(text);
    } catch {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end > start) {
            try { obj = JSON.parse(text.slice(start, end + 1)); } catch { obj = null; }
        }
    }
    if (!obj || typeof obj !== 'object') {
        return { message: text.trim() || 'Извините, не удалось обработать ответ.', config: {}, addObject: null, lead: false };
    }
    const message = typeof obj.message === 'string' && obj.message.trim()
        ? obj.message.trim()
        : (text.trim() || 'Чем ещё помочь?');
    const config = {};
    if (obj.config && typeof obj.config === 'object') {
        for (const key of Object.keys(AI_VALID)) {
            const value = obj.config[key];
            if (typeof value === 'string' && AI_VALID[key].includes(value)) {
                config[key] = value;
            }
        }
    }
    const addObject = typeof obj.addObject === 'string' && AI_OBJECT_TYPES.includes(obj.addObject)
        ? obj.addObject
        : null;
    return { message, config, addObject, lead: obj.lead === true };
}

app.post('/api/ai-chat', aiChatLimiter, async (req, res) => {
    if (!anthropicClient) {
        return res.status(503).json({
            success: false,
            error: 'AI-консультант временно недоступен. Оставьте заявку или позвоните нам.'
        });
    }
    try {
        const body = req.body || {};
        const page = cleanString(body.page, { max: 80 }) || 'сайт';
        const incomingConfig = (body.config && typeof body.config === 'object') ? body.config : {};
        const config = {};
        for (const key of Object.keys(AI_VALID)) {
            const value = incomingConfig[key];
            if (typeof value === 'string') config[key] = value.slice(0, 40);
        }
        const messages = Array.isArray(body.messages)
            ? body.messages
                .filter((m) => m && (m.role === 'user' || m.role === 'assistant')
                    && typeof m.content === 'string' && m.content.trim())
                .slice(-12)
                .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
            : [];
        while (messages.length && messages[0].role === 'assistant') {
            messages.shift();
        }
        if (!messages.length || messages[messages.length - 1].role !== 'user') {
            return res.status(400).json({ success: false, error: 'Пустое сообщение' });
        }
        const response = await anthropicClient.messages.create({
            model: AI_MODEL,
            max_tokens: 700,
            system: buildAiSystemPrompt(page, config),
            messages
        });
        const text = response.content
            .filter((block) => block.type === 'text')
            .map((block) => block.text)
            .join('')
            .trim();
        const parsed = parseAiResponse(text);
        return res.json({
            success: true,
            message: parsed.message,
            config: parsed.config,
            addObject: parsed.addObject,
            lead: parsed.lead
        });
    } catch (error) {
        logger.error('AI chat error', error);
        return res.status(500).json({ success: false, error: 'Не удалось получить ответ. Попробуйте ещё раз.' });
    }
});

app.get('/api/statistics', adminGuard, (req, res) => {
    try {
        const stats = db.getStatistics();
        return res.json({
            success: true,
            statistics: stats
        });
    } catch (error) {
        logger.error('Statistics error', error);
        return res.status(500).json({
            success: false,
            error: 'Не удалось получить статистику'
        });
    }
});

app.get('/api/health', (req, res) => {
    const memory = process.memoryUsage();
    const databaseOk = typeof db.ping === 'function' ? db.ping() : false;

    res.status(databaseOk ? 200 : 503).json({
        success: databaseOk,
        status: databaseOk ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: NODE_ENV,
        checks: {
            database: databaseOk ? 'ok' : 'failed',
            memory: {
                rss: memory.rss,
                heapUsed: memory.heapUsed,
                heapTotal: memory.heapTotal
            },
            telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
            emailConfigured: Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS)
        }
    });
});

app.use(express.static(path.join(__dirname, '../public'), {
    // Without this, express.static's own default ("serve index.html for a
    // directory request") auto-resolves bare '/' to the legacy public/index.html
    // *before* the explicit '/' route below ever runs — silently overriding it.
    index: false,
    maxAge: NODE_ENV === 'production' ? '7d' : 0,
    etag: true
}));

// The React SPA (public/app/, built by `npm run build:app`) owns every
// top-level page route — '/', '/configurator', '/services', etc. It used to
// be reachable only under '/app/...' while these legacy static pages sat at
// the real routes; that's fixed now, so the SPA is what visitors actually see.
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/app/index.html'));
});

// No SPA equivalent exists for this one yet — keep serving the legacy static page.
app.get('/privacy', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/privacy.html'));
});

app.use((req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({
            success: false,
            error: 'Маршрут API не найден'
        });
    }

    const hasFileExtension = path.extname(req.path) !== '';
    if (hasFileExtension) {
        return res.status(404).send('Not found');
    }

    return res.sendFile(path.join(__dirname, '../public/app/index.html'));
});

app.use((err, req, res, next) => {
    logger.error('Server request error', err, {
        method: req.method,
        path: req.path,
        ip: req.ip
    });

    const status = err.status || 500;
    const payload = {
        success: false,
        error: status < 500 && err.message ? err.message : 'Внутренняя ошибка сервера'
    };

    if (req.path.startsWith('/api')) {
        return res.status(status).json(payload);
    }

    return res.status(status).send(payload.error);
});

const server = app.listen(PORT, () => {
    console.log('============================================');
    console.log('BALCONY PRO SERVER');
    console.log('============================================');
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`URL: http://localhost:${PORT}`);
    console.log(`Режим: ${NODE_ENV}`);
    console.log(`Email: ${process.env.EMAIL_USER ? 'настроен' : 'не настроен'}`);
    console.log(`Telegram: ${process.env.TELEGRAM_BOT_TOKEN ? 'настроен' : 'не настроен'}`);
    console.log(`База данных: ${process.env.DB_PATH || './database/balcony.db'}`);
    console.log('============================================');
    console.log('Доступные эндпоинты:');
    console.log('  GET  /api/health - Проверка состояния');
    console.log('  POST /api/orders - Создать заказ');
    console.log('  GET  /api/orders/:id - Получить заказ');
    console.log('  POST /api/upload - Загрузить файл');
    console.log('  POST /api/request-call - Заказать звонок');
    console.log('  GET  /api/statistics - Статистика');
    console.log('============================================');
});

let isShuttingDown = false;

function gracefulShutdown(reason, error = null, exitCode = 0) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    if (error) {
        logger.error(`Fatal shutdown: ${reason}`, error);
    } else {
        logger.info(`Graceful shutdown: ${reason}`);
    }

    const forceTimer = setTimeout(() => {
        logger.error('Forced shutdown timeout', new Error('Server did not close in time'));
        process.exit(exitCode || 1);
    }, 10000);
    forceTimer.unref();

    server.close(() => {
        try {
            db.close();
        } catch (closeError) {
            logger.error('Database close failed during shutdown', closeError);
        }
        clearTimeout(forceTimer);
        process.exit(exitCode);
    });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    gracefulShutdown('unhandledRejection', error, 1);
});

process.on('uncaughtException', (error) => {
    gracefulShutdown('uncaughtException', error, 1);
});

module.exports = app;

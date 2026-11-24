/**
 * ============================================
 * BALCONY PRO - ������������ ���� ������
 * ������: 2.0.0
 * ============================================
 * SQLite ���� ������ ��� �������� ������� � ����������
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

class BalconyDatabase {
    constructor(dbPath) {
        this.dbPath = dbPath || './database/balcony.db';
        this.db = null;
    }

    /**
     * ���������������� ���� ������
     */
    initialize() {
        try {
            // ������ ���������� ���� �� ����������
            const dir = path.dirname(this.dbPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // ��������� ����������
            this.db = new Database(this.dbPath);
            this.db.pragma('journal_mode = WAL');

            // ������ �������
            this._createTables();

            // ��������� ���������� �������
            this._seedInitialData();

            logger.info('Database initialized', { path: this.dbPath });

        } catch (error) {
            logger.error('Database initialization failed', error);
            throw error;
        }
    }

    /**
     * ������� �������
     * @private
     */
    _createTables() {
        // ������� �������
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                orderId TEXT UNIQUE NOT NULL,
                clientName TEXT NOT NULL,
                clientPhone TEXT NOT NULL,
                clientEmail TEXT,
                clientAddress TEXT,
                comment TEXT,
                balconyType TEXT NOT NULL,
                balconySize REAL NOT NULL,
                balconyShape TEXT DEFAULT 'straight',
                materials TEXT,
                materialsPrice REAL DEFAULT 0,
                workPrice REAL DEFAULT 0,
                totalPrice REAL DEFAULT 0,
                screenshot TEXT,
                metadata TEXT,
                status TEXT DEFAULT 'new',
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL
            )
        `);

        // ������� ����������
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS materials (
                id TEXT PRIMARY KEY,
                category TEXT NOT NULL,
                name TEXT NOT NULL,
                price REAL NOT NULL,
                unit TEXT NOT NULL,
                description TEXT,
                color TEXT,
                texture TEXT,
                popular INTEGER DEFAULT 0,
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL
            )
        `);

        // ������� �������� ������
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS call_requests (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                createdAt TEXT NOT NULL,
                processedAt TEXT
            )
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id TEXT PRIMARY KEY,
                visitorId TEXT,
                visitorName TEXT,
                visitorPhone TEXT,
                page TEXT,
                status TEXT DEFAULT 'new',
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY,
                sessionId TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                createdAt TEXT NOT NULL,
                FOREIGN KEY (sessionId) REFERENCES chat_sessions(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);
            CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updatedAt);
            CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(sessionId);
        `);
        const hasChatVisitorId = this.db
            .prepare("SELECT 1 FROM pragma_table_info('chat_sessions') WHERE name = 'visitorId'")
            .get();
        if (!hasChatVisitorId) {
            this.db.exec('ALTER TABLE chat_sessions ADD COLUMN visitorId TEXT');
        }
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_chat_sessions_visitor ON chat_sessions(visitorId)');

        // Admin-editable price list (so prices can change without a code deploy).
        // scope: 'material' | 'profile' | 'base' | 'option'; ref_key identifies the
        // priced thing within that scope (a model id, a finish family id, etc).
        // is_estimate flags rows that are placeholder/test prices, not real company
        // pricing — see server/pricing/priceCalculator.js and the seed below.
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS pricing_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scope TEXT NOT NULL,
                ref_key TEXT NOT NULL,
                unit_price_cents INTEGER NOT NULL,
                currency TEXT NOT NULL DEFAULT 'RUB',
                is_estimate INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL
            )
        `);

        // Which options are compatible with which balcony model/sections.
        // payload is a JSON blob (shape documented in server/validators/configValidator.js).
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS compatibility_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                balcony_model_id TEXT NOT NULL,
                rule_type TEXT NOT NULL,
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        `);

        // A saved configurator draft — NOT an order (see orders table above). No login
        // system exists, so ownership is proven by two opaque secrets handed back to
        // the client on create: `share_token` (read-only — safe to put in a shareable
        // URL) and `edit_token` (required for PUT; kept private client-side, e.g.
        // localStorage, sent via header rather than query string). Earlier revisions
        // of this file also had a near-duplicate `configurations` table with a single
        // token doing both jobs (the same "share link grants edit rights" flaw a
        // security review caught here) — removed rather than kept as a second,
        // divergent source of truth for the same concept (план.txt §4).
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                config_json TEXT NOT NULL,
                config_version INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                access_token TEXT UNIQUE NOT NULL,
                edit_token TEXT UNIQUE
            )
        `);
        // `CREATE TABLE IF NOT EXISTS` is a no-op against a DB file that already has
        // a `projects` table from before `edit_token` existed — it does NOT add the
        // new column. Add it explicitly first, then backfill, so this doesn't crash
        // on boot against an already-deployed database.
        const hasEditToken = this.db
            .prepare("SELECT 1 FROM pragma_table_info('projects') WHERE name = 'edit_token'")
            .get();
        if (!hasEditToken) {
            this.db.exec('ALTER TABLE projects ADD COLUMN edit_token TEXT');
        }
        // Backfill rows created before `edit_token` existed: fall back to
        // `access_token` as the edit token (both-in-one, the old behaviour) rather
        // than leaving the column NULL and locking old drafts out of editing.
        this.db.exec(`UPDATE projects SET edit_token = access_token WHERE edit_token IS NULL`);

        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
            CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(createdAt);
            CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(clientPhone);
            CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category);
            CREATE INDEX IF NOT EXISTS idx_pricing_rules_scope_ref ON pricing_rules(scope, ref_key);
            CREATE INDEX IF NOT EXISTS idx_compatibility_rules_model ON compatibility_rules(balcony_model_id);
            CREATE INDEX IF NOT EXISTS idx_projects_access_token ON projects(access_token);
            CREATE INDEX IF NOT EXISTS idx_projects_edit_token ON projects(edit_token);
        `);
    }

    /**
     * ��������� ���������� �������
     * @private
     */
    _seedInitialData() {
        // The old seed path here inserted a hardcoded catalog with mojibake
        // (broken Cyrillic encoding) in name/unit/description, and a now-removed
        // `_loadFrontendMaterialCatalog()` fallback pointed at a `public/js/materials.js`
        // file that doesn't exist in this repo. That seed is gone — see
        // `_pruneCorruptedMaterials()` below, which only cleans up any such rows left
        // over from a previous run. The `materials` table itself stays: it's still
        // read by `server/routes/catalog.js` (GET /api/materials) and used as a
        // pricing fallback in `server/pricing/priceCalculator.js`. Real catalog data
        // should be added through `addMaterial()` (admin tooling) going forward.
        this._pruneCorruptedMaterials();
        this._seedPricingRules();
    }

    /**
     * One-time cleanup: delete any previously-seeded mojibake rows from the
     * `materials` table. No-op once they're gone. Does NOT reseed anything.
     * @private
     */
    _pruneCorruptedMaterials() {
        try {
            const brokenTextPattern = '%�%';
            const result = this.db.prepare(`
                DELETE FROM materials
                WHERE name LIKE ? OR unit LIKE ? OR description LIKE ?
            `).run(brokenTextPattern, brokenTextPattern, brokenTextPattern);
            if (result.changes > 0) {
                logger.info('Removed corrupted legacy materials rows', { count: result.changes });
            }
        } catch (error) {
            logger.error('Prune corrupted materials error', error);
        }
    }

    /**
     * Minimal placeholder price list so POST /api/pricing/calculate returns something
     * testable out of the box. These are TEST/PLACEHOLDER prices (is_estimate = 1) —
     * NOT real company pricing. An admin replaces them later via the pricing_rules
     * table without a code deploy; nothing in this codebase should present these
     * numbers to a customer as final.
     * @private
     */
    _seedPricingRules() {
        const count = this.db.prepare('SELECT COUNT(*) as count FROM pricing_rules').get();
        if (count.count > 0) return;

        const now = new Date().toISOString();
        // Balcony model base shells (scope 'base') — round placeholder figures, RUB.
        const baseModels = [
            ['sapozhok', 180000],
            ['lodochka', 150000],
            ['utyuzhok', 160000],
            ['loggia', 120000],
            ['long-loggia', 220000],
            ['khrushchevka', 100000]
        ];
        // Wall/floor finish families (scope 'material') the plan-mode picks actually use
        // (src/pages/Configurator/vamCatalog.ts TEXTURED set), priced per "unit" (one
        // hotspot) until real area-based pricing is modeled — see priceCalculator.js.
        const finishFamilies = [
            ['laminat', 25000],
            ['vagonka', 18000],
            ['parket', 32000],
            ['mdf', 20000],
            ['plitka', 28000]
        ];

        const insert = this.db.prepare(`
            INSERT INTO pricing_rules (scope, ref_key, unit_price_cents, currency, is_estimate, updated_at)
            VALUES (?, ?, ?, ?, 1, ?)
        `);

        const insertMany = this.db.transaction((rows) => {
            for (const row of rows) insert.run(...row);
        });

        insertMany([
            ...baseModels.map(([refKey, rub]) => ['base', refKey, rub * 100, 'RUB', now]),
            ...finishFamilies.map(([refKey, rub]) => ['material', refKey, rub * 100, 'RUB', now])
        ]);

        logger.info('Pricing rules seeded (placeholder/estimate prices)', {
            count: baseModels.length + finishFamilies.length
        });
    }

    // _loadFrontendMaterialCatalog() and _getInitialMaterials() used to live here:
    // a hardcoded seed list with mojibake (broken Cyrillic encoding) strings and a
    // fallback that `require()`d a `public/js/materials.js` file that doesn't exist
    // in this repo. Neither is referenced anymore (see `_seedInitialData()` above) —
    // removed as dead code rather than left to silently no-op.

    // ============================================
    // ������ ��� �������
    // ============================================

    /**
     * ��������� �����
     * @param {Object} order - ������ ������
     * @returns {Object|null} ����������� �����
     */
    saveOrder(order) {
        try {
            const insert = this.db.prepare(`
                INSERT INTO orders (
                    id, orderId, clientName, clientPhone, clientEmail, clientAddress,
                    comment, balconyType, balconySize, balconyShape, materials,
                    materialsPrice, workPrice, totalPrice, screenshot, metadata,
                    status, createdAt, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            insert.run(
                order.id,
                order.orderId,
                order.clientName,
                order.clientPhone,
                order.clientEmail,
                order.clientAddress,
                order.comment,
                order.balconyType,
                order.balconySize,
                order.balconyShape,
                JSON.stringify(order.materials),
                order.materialsPrice,
                order.workPrice,
                order.totalPrice,
                order.screenshot,
                JSON.stringify(order.metadata),
                order.status,
                order.createdAt,
                order.updatedAt
            );

            return order;

        } catch (error) {
            logger.error('Save order error', error);
            return null;
        }
    }

    /**
     * �������� ����� �� ID
     * @param {string} id - ID ������
     * @returns {Object|null} �����
     */
    getOrderById(id) {
        try {
            const order = this.db.prepare('SELECT * FROM orders WHERE id = ? OR orderId = ?').get(id, id);
            
            if (order) {
                order.materials = JSON.parse(order.materials);
                order.metadata = JSON.parse(order.metadata);
            }
            
            return order || null;

        } catch (error) {
            logger.error('Get order error', error);
            return null;
        }
    }

    /**
     * �������� ������ � ����������
     * @param {Object} options - �����
     * @returns {Object} ������ � ���������
     */
    getOrders(options = {}) {
        try {
            const { page = 1, limit = 20, status = null } = options;
            const offset = (page - 1) * limit;

            let query = 'SELECT * FROM orders';
            let countQuery = 'SELECT COUNT(*) as total FROM orders';

            if (status) {
                query += ' WHERE status = ?';
                countQuery += ' WHERE status = ?';
                query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
                
                const total = this.db.prepare(countQuery).get(status);
                const orders = this.db.prepare(query).all(status, limit, offset);

                return {
                    data: orders.map(o => this._parseOrder(o)),
                    total: total.total,
                    page,
                    limit
                };
            }

            query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
            
            const total = this.db.prepare(countQuery).get();
            const orders = this.db.prepare(query).all(limit, offset);

            return {
                data: orders.map(o => this._parseOrder(o)),
                total: total.total,
                page,
                limit
            };

        } catch (error) {
            logger.error('Get orders error', error);
            return { data: [], total: 0, page: 1, limit: 20 };
        }
    }

    /**
     * �������� ������ �� ��������
     * @param {string} phone - �������
     * @returns {Array} ������
     */
    getOrdersByPhone(phone) {
        try {
            const orders = this.db.prepare('SELECT * FROM orders WHERE clientPhone LIKE ? ORDER BY createdAt DESC').all(`%${phone}%`);
            return orders.map(o => this._parseOrder(o));

        } catch (error) {
            logger.error('Get orders by phone error', error);
            return [];
        }
    }

    /**
     * �������� ������ ������
     * @param {string} id - ID ������
     * @param {string} status - ����� ������
     * @param {string} comment - �����������
     * @returns {boolean} ����������
     */
    updateOrderStatus(id, status, comment = '') {
        try {
            const update = this.db.prepare(`
                UPDATE orders 
                SET status = ?, updatedAt = ?
                WHERE id = ? OR orderId = ?
            `);

            const result = update.run(status, new Date().toISOString(), id, id);
            return result.changes > 0;

        } catch (error) {
            logger.error('Update order status error', error);
            return false;
        }
    }

    // ============================================
    // ������ ��� ����������
    // ============================================

    /**
     * �������� ��� ���������
     * @returns {Array} ���������
     */
    getAllMaterials() {
        try {
            return this.db.prepare('SELECT * FROM materials ORDER BY category, name').all();

        } catch (error) {
            logger.error('Get all materials error', error);
            return [];
        }
    }

    /**
     * �������� ��������� �� ���������
     * @param {string} category - ���������
     * @returns {Array} ���������
     */
    getMaterialsByCategory(category) {
        try {
            return this.db.prepare('SELECT * FROM materials WHERE category = ? ORDER BY name').all(category);

        } catch (error) {
            logger.error('Get materials by category error', error);
            return [];
        }
    }

    /**
     * �������� �������� �� ID
     * @param {string} category - ���������
     * @param {string} id - ID ���������
     * @returns {Object|null} ��������
     */
    getMaterialById(category, id) {
        try {
            return this.db.prepare('SELECT * FROM materials WHERE category = ? AND id = ?').get(category, id) || null;

        } catch (error) {
            logger.error('Get material error', error);
            return null;
        }
    }

    /**
     * �������� ��������
     * @param {Object} material - ������ ���������
     * @returns {Object} ����������� ��������
     */
    addMaterial(material) {
        try {
            const now = new Date().toISOString();
            const insert = this.db.prepare(`
                INSERT INTO materials (id, category, name, price, unit, description, color, texture, popular, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            insert.run(
                material.id || `mat_${Date.now()}`,
                material.category,
                material.name,
                material.price,
                material.unit,
                material.description || '',
                material.color || '',
                material.texture || '',
                material.popular ? 1 : 0,
                now,
                now
            );

            return { ...material, createdAt: now, updatedAt: now };

        } catch (error) {
            logger.error('Add material error', error);
            return null;
        }
    }

    /**
     * �������� ��������
     * @param {string} category - ���������
     * @param {string} id - ID ���������
     * @param {Object} updateData - ������ ��� ����������
     * @returns {Object|null} ���������� ��������
     */
    updateMaterial(category, id, updateData) {
        try {
            const update = this.db.prepare(`
                UPDATE materials 
                SET name = ?, price = ?, unit = ?, description = ?, color = ?, texture = ?, popular = ?, updatedAt = ?
                WHERE category = ? AND id = ?
            `);

            update.run(
                updateData.name,
                updateData.price,
                updateData.unit,
                updateData.description,
                updateData.color,
                updateData.texture,
                updateData.popular ? 1 : 0,
                new Date().toISOString(),
                category,
                id
            );

            return this.getMaterialById(category, id);

        } catch (error) {
            logger.error('Update material error', error);
            return null;
        }
    }

    /**
     * ������� ��������
     * @param {string} category - ���������
     * @param {string} id - ID ���������
     * @returns {boolean} ����������
     */
    deleteMaterial(category, id) {
        try {
            const del = this.db.prepare('DELETE FROM materials WHERE category = ? AND id = ?');
            const result = del.run(category, id);
            return result.changes > 0;

        } catch (error) {
            logger.error('Delete material error', error);
            return false;
        }
    }

    // ============================================
    // Pricing rules (admin-editable price list)
    // ============================================

    /**
     * All pricing rules, optionally filtered by scope.
     * @param {string} [scope]
     * @returns {Array}
     */
    getPricingRules(scope) {
        try {
            if (scope) {
                return this.db.prepare('SELECT * FROM pricing_rules WHERE scope = ? ORDER BY ref_key').all(scope);
            }
            return this.db.prepare('SELECT * FROM pricing_rules ORDER BY scope, ref_key').all();
        } catch (error) {
            logger.error('Get pricing rules error', error);
            return [];
        }
    }

    /**
     * Latest pricing rule for one (scope, ref_key) pair.
     * @param {string} scope
     * @param {string} refKey
     * @returns {Object|null}
     */
    getPricingRule(scope, refKey) {
        try {
            return this.db.prepare(
                'SELECT * FROM pricing_rules WHERE scope = ? AND ref_key = ? ORDER BY updated_at DESC LIMIT 1'
            ).get(scope, refKey) || null;
        } catch (error) {
            logger.error('Get pricing rule error', error);
            return null;
        }
    }

    /**
     * Create or update (by scope + ref_key) a pricing rule. Admin-only in practice.
     * @param {Object} rule - { scope, refKey, unitPriceCents, currency, isEstimate }
     * @returns {Object|null}
     */
    upsertPricingRule(rule) {
        try {
            const now = new Date().toISOString();
            const existing = this.db.prepare(
                'SELECT id FROM pricing_rules WHERE scope = ? AND ref_key = ?'
            ).get(rule.scope, rule.refKey);

            if (existing) {
                this.db.prepare(`
                    UPDATE pricing_rules
                    SET unit_price_cents = ?, currency = ?, is_estimate = ?, updated_at = ?
                    WHERE id = ?
                `).run(
                    Math.round(rule.unitPriceCents),
                    rule.currency || 'RUB',
                    rule.isEstimate ? 1 : 0,
                    now,
                    existing.id
                );
                return this.getPricingRule(rule.scope, rule.refKey);
            }

            this.db.prepare(`
                INSERT INTO pricing_rules (scope, ref_key, unit_price_cents, currency, is_estimate, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(
                rule.scope,
                rule.refKey,
                Math.round(rule.unitPriceCents),
                rule.currency || 'RUB',
                rule.isEstimate ? 1 : 0,
                now
            );
            return this.getPricingRule(rule.scope, rule.refKey);
        } catch (error) {
            logger.error('Upsert pricing rule error', error);
            return null;
        }
    }

    // ============================================
    // Compatibility rules (which options fit which model)
    // ============================================

    /**
     * @param {string} balconyModelId
     * @returns {Array}
     */
    getCompatibilityRules(balconyModelId) {
        try {
            return this.db.prepare(
                'SELECT * FROM compatibility_rules WHERE balcony_model_id = ? ORDER BY updated_at DESC'
            ).all(balconyModelId);
        } catch (error) {
            logger.error('Get compatibility rules error', error);
            return [];
        }
    }

    /**
     * @param {Object} rule - { balconyModelId, ruleType, payload }
     * @returns {Object|null}
     */
    addCompatibilityRule(rule) {
        try {
            const now = new Date().toISOString();
            const insert = this.db.prepare(`
                INSERT INTO compatibility_rules (balcony_model_id, rule_type, payload, updated_at)
                VALUES (?, ?, ?, ?)
            `);
            const result = insert.run(
                rule.balconyModelId,
                rule.ruleType,
                JSON.stringify(rule.payload ?? {}),
                now
            );
            return { id: result.lastInsertRowid, ...rule, updatedAt: now };
        } catch (error) {
            logger.error('Add compatibility rule error', error);
            return null;
        }
    }

    // ============================================
    // Projects (saved configurator drafts — not orders)
    // ============================================

    /**
     * @param {Object} project - { id, configJson, configVersion, accessToken, editToken }
     * @returns {Object|null}
     */
    saveProject(project) {
        try {
            const now = new Date().toISOString();
            const insert = this.db.prepare(`
                INSERT INTO projects (id, config_json, config_version, created_at, updated_at, access_token, edit_token)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            insert.run(
                project.id,
                project.configJson,
                project.configVersion || 1,
                now,
                now,
                project.accessToken,
                project.editToken
            );
            return { id: project.id, createdAt: now, updatedAt: now };
        } catch (error) {
            logger.error('Save project error', error);
            return null;
        }
    }

    /**
     * @param {string} id
     * @returns {Object|null} raw row (config_json still a string)
     */
    getProjectById(id) {
        try {
            return this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) || null;
        } catch (error) {
            logger.error('Get project error', error);
            return null;
        }
    }

    /**
     * @param {string} id
     * @param {string} configJson
     * @returns {boolean}
     */
    updateProject(id, configJson) {
        try {
            const row = this.db.prepare('SELECT config_version FROM projects WHERE id = ?').get(id);
            if (!row) return false;
            const result = this.db.prepare(`
                UPDATE projects
                SET config_json = ?, config_version = ?, updated_at = ?
                WHERE id = ?
            `).run(configJson, (row.config_version || 1) + 1, new Date().toISOString(), id);
            return result.changes > 0;
        } catch (error) {
            logger.error('Update project error', error);
            return false;
        }
    }

    // ============================================
    // ������ ��� �������� ������
    // ============================================

    /**
     * ��������� ������ ������
     * @param {Object} request - ������ �������
     * @returns {Object} ����������� ������
     */
    saveCallRequest(request) {
        try {
            const insert = this.db.prepare(`
                INSERT INTO call_requests (id, name, phone, status, createdAt)
                VALUES (?, ?, ?, ?, ?)
            `);

            insert.run(
                `call_${Date.now()}`,
                request.name,
                request.phone,
                request.status,
                request.createdAt
            );

            return request;

        } catch (error) {
            logger.error('Save call request error', error);
            return null;
        }
    }

    getCallRequests({ page = 1, limit = 20, status = null } = {}) {
        try {
            const offset = (page - 1) * limit;
            const base = status
                ? 'FROM call_requests WHERE status = ?'
                : 'FROM call_requests';
            const where = status ? [status] : [];
            const total = this.db.prepare(`SELECT COUNT(*) as total ${base}`).get(...where).total;
            const rows = status
                ? this.db.prepare(`SELECT * ${base} ORDER BY createdAt DESC LIMIT ? OFFSET ?`).all(...where, limit, offset)
                : this.db.prepare(`SELECT * ${base} ORDER BY createdAt DESC LIMIT ? OFFSET ?`).all(limit, offset);
            return { data: rows, page, limit, total };
        } catch (error) {
            logger.error('Get call requests error', error);
            return { data: [], page, limit, total: 0 };
        }
    }

    updateCallRequestStatus(id, status) {
        try {
            const now = new Date().toISOString();
            const result = this.db.prepare(`
                UPDATE call_requests
                SET status = ?, processedAt = ?
                WHERE id = ?
            `).run(status, status === 'pending' ? null : now, id);
            return result.changes > 0;
        } catch (error) {
            logger.error('Update call request status error', error);
            return false;
        }
    }

    createChatSession(session) {
        try {
            this.db.prepare(`
                INSERT INTO chat_sessions (id, visitorId, visitorName, visitorPhone, page, status, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, 'new', ?, ?)
            `).run(session.id, session.visitorId, session.visitorName, session.visitorPhone, session.page, session.createdAt, session.updatedAt);
            return session;
        } catch (error) {
            logger.error('Create chat session error', error);
            return null;
        }
    }

    getChatSessionByVisitor(visitorId) {
        try {
            const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
            return this.db.prepare(`
                SELECT * FROM chat_sessions
                WHERE visitorId = ? AND status != 'closed' AND updatedAt >= ?
                ORDER BY updatedAt DESC
                LIMIT 1
            `).get(visitorId, cutoff) || null;
        } catch (error) {
            logger.error('Get chat session by visitor error', error);
            return null;
        }
    }

    getChatSession(id) {
        try {
            return this.db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(id) || null;
        } catch (error) {
            logger.error('Get chat session error', error);
            return null;
        }
    }

    touchChatSession(id) {
        try {
            this.db.prepare(`
                UPDATE chat_sessions SET updatedAt = ?, status = CASE WHEN status = 'closed' THEN 'new' ELSE status END
                WHERE id = ?
            `).run(new Date().toISOString(), id);
        } catch (error) {
            logger.error('Touch chat session error', error);
        }
    }

    saveChatMessage(message) {
        try {
            this.db.prepare(`
                INSERT INTO chat_messages (id, sessionId, role, content, createdAt)
                VALUES (?, ?, ?, ?, ?)
            `).run(message.id, message.sessionId, message.role, message.content, message.createdAt);
            this.touchChatSession(message.sessionId);
            return message;
        } catch (error) {
            logger.error('Save chat message error', error);
            return null;
        }
    }

    getChatMessages(sessionId) {
        try {
            return this.db.prepare(`
                SELECT id, sessionId, role, content, createdAt
                FROM chat_messages
                WHERE sessionId = ?
                ORDER BY createdAt ASC
            `).all(sessionId);
        } catch (error) {
            logger.error('Get chat messages error', error);
            return [];
        }
    }

    getChatSessions({ page = 1, limit = 20, status = null } = {}) {
        try {
            const offset = (page - 1) * limit;
            const base = status ? 'FROM chat_sessions WHERE status = ?' : 'FROM chat_sessions';
            const where = status ? [status] : [];
            const total = this.db.prepare(`SELECT COUNT(*) as total ${base}`).get(...where).total;
            const sessions = status
                ? this.db.prepare(`SELECT * ${base} ORDER BY updatedAt DESC LIMIT ? OFFSET ?`).all(...where, limit, offset)
                : this.db.prepare(`SELECT * ${base} ORDER BY updatedAt DESC LIMIT ? OFFSET ?`).all(limit, offset);
            return { data: sessions.map((session) => ({
                ...session,
                messages: this.getChatMessages(session.id)
            })), page, limit, total };
        } catch (error) {
            logger.error('Get chat sessions error', error);
            return { data: [], page, limit, total: 0 };
        }
    }

    updateChatSessionStatus(id, status) {
        try {
            const result = this.db.prepare(`
                UPDATE chat_sessions SET status = ?, updatedAt = ? WHERE id = ?
            `).run(status, new Date().toISOString(), id);
            return result.changes > 0;
        } catch (error) {
            logger.error('Update chat session status error', error);
            return false;
        }
    }

    // ============================================
    // ����������
    // ============================================

    /**
     * �������� ����������
     * @returns {Object} ����������
     */
    getStatistics() {
        try {
            const totalOrders = this.db.prepare('SELECT COUNT(*) as count FROM orders').get().count;
            const newOrders = this.db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'new'").get().count;
            const totalRevenue = this.db.prepare('SELECT SUM(totalPrice) as sum FROM orders').get().sum || 0;
            const pendingCalls = this.db.prepare("SELECT COUNT(*) as count FROM call_requests WHERE status = 'pending'").get().count;

            return {
                orders: {
                    total: totalOrders,
                    new: newOrders
                },
                revenue: {
                    total: totalRevenue
                },
                calls: {
                    pending: pendingCalls
                }
            };

        } catch (error) {
            logger.error('Get statistics error', error);
            return {};
        }
    }

    // ============================================
    // ��������������� ������
    // ============================================

    /**
     * ���������� �����
     * @private
     * @param {Object} order - ����� �� ��
     * @returns {Object} ������������ �����
     */
    _parseOrder(order) {
        if (order) {
            try {
                order.materials = JSON.parse(order.materials || '[]');
            } catch (error) {
                order.materials = [];
            }
            try {
                order.metadata = JSON.parse(order.metadata || '{}');
            } catch (error) {
                order.metadata = {};
            }
        }
        return order;
    }

    ping() {
        try {
            if (!this.db) return false;
            const row = this.db.prepare('SELECT 1 AS ok').get();
            return row?.ok === 1;
        } catch (error) {
            logger.error('Database ping error', error);
            return false;
        }
    }

    /**
     * ������� ����������
     */
    close() {
        if (this.db) {
            this.db.close();
            logger.info('Database connection closed');
        }
    }
}

module.exports = BalconyDatabase;

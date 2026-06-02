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

        // �������
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
            CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(createdAt);
            CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(clientPhone);
            CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category);
        `);
    }

    /**
     * ��������� ���������� �������
     * @private
     */
    _seedInitialData() {
        const count = this.db.prepare('SELECT COUNT(*) as count FROM materials').get();
        const brokenTextPattern = '%�%';
        const corrupted = this.db.prepare(`
            SELECT COUNT(*) as count
            FROM materials
            WHERE name LIKE ? OR unit LIKE ? OR description LIKE ?
        `).get(brokenTextPattern, brokenTextPattern, brokenTextPattern);
        const materials = this._getInitialMaterials();
        
        if (corrupted.count > 0) {
            this.db.prepare(`
                DELETE FROM materials
                WHERE name LIKE ? OR unit LIKE ? OR description LIKE ?
            `).run(brokenTextPattern, brokenTextPattern, brokenTextPattern);
        }

        if (count.count === 0 || corrupted.count > 0) {
            const upsert = this.db.prepare(`
                INSERT INTO materials (id, category, name, price, unit, description, color, texture, popular, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    category = excluded.category,
                    name = excluded.name,
                    price = excluded.price,
                    unit = excluded.unit,
                    description = excluded.description,
                    color = excluded.color,
                    texture = excluded.texture,
                    popular = excluded.popular,
                    updatedAt = excluded.updatedAt
            `);

            const upsertMany = this.db.transaction((items) => {
                for (const item of items) {
                    upsert.run(...item);
                }
            });

            upsertMany(materials);
            logger.info('Materials catalog seeded', { count: materials.length });
        }
    }

    _loadFrontendMaterialCatalog(now) {
        const catalogPath = path.join(process.cwd(), 'public', 'js', 'materials.js');
        if (!fs.existsSync(catalogPath)) return [];

        const previousWindow = global.window;
        try {
            global.window = {};
            delete require.cache[require.resolve(catalogPath)];
            const catalog = require(catalogPath);
            const materialsDatabase = catalog.MaterialsDatabase || global.window.MaterialsDatabase;
            if (!materialsDatabase || typeof materialsDatabase !== 'object') return [];

            return Object.values(materialsDatabase)
                .flat()
                .filter((material) => material && material.id && material.category)
                .map((material) => [
                    material.id,
                    material.category,
                    material.name || material.id,
                    Number(material.price) || 0,
                    material.unit || 'шт',
                    material.description || '',
                    material.color || '#FFFFFF',
                    material.texture || '',
                    material.popular ? 1 : 0,
                    now,
                    now
                ]);
        } catch (error) {
            logger.warn('Frontend material catalog load failed', { error: error.message });
            return [];
        } finally {
            if (previousWindow === undefined) {
                delete global.window;
            } else {
                global.window = previousWindow;
            }
        }
    }

    /**
     * �������� ��������� ���������
     * @private
     * @returns {Array} ������ ���������� � �������:
     * [id, category, name, price, unit, description, color, texture, popular, createdAt, updatedAt]
     */
    _getInitialMaterials() {
        const now = new Date().toISOString();
        const frontendMaterials = this._loadFrontendMaterialCatalog(now);
        if (frontendMaterials.length > 0) {
            return frontendMaterials;
        }

        const materials = [];

        // ============================================
        // �������� ���������
        // ============================================
        materials.push([
            'vagonka-premium',
            'walls',
            '������� �������',
            850,
            '�?',
            '����������� ���������� ������� ������� �����',
            '#D4A574',
            'wood-light',
            1,
            now,
            now
        ]);
        materials.push([
            'vagonka-standard',
            'walls',
            '������� ��������',
            550,
            '�?',
            '���������� ������� ������������ ��������',
            '#C4956A',
            'wood-medium',
            0,
            now,
            now
        ]);
        materials.push([
            'laminat-wall',
            'walls',
            '�������� �������',
            950,
            '�?',
            '������������ ������� ��� ����',
            '#8B7355',
            'laminat',
            1,
            now,
            now
        ]);
        materials.push([
            'pvh-panels',
            'walls',
            '��� ������',
            450,
            '�?',
            '����������� ������, ������������',
            '#F5F5F5',
            'pvh',
            0,
            now,
            now
        ]);
        materials.push([
            'mdf-panels',
            'walls',
            '��� ������',
            750,
            '�?',
            '��� ������ � �������� ���������',
            '#A0826D',
            'mdf',
            1,
            now,
            now
        ]);
        materials.push([
            'parquet-wall',
            'walls',
            '�������� ������',
            1450,
            '�?',
            '����������� ������ ��� ����',
            '#8B6F47',
            'parquet',
            0,
            now,
            now
        ]);
        materials.push([
            'brick-decor',
            'walls',
            '������������ ������',
            1200,
            '�?',
            '�������� ��������� ������',
            '#A05244',
            'brick',
            1,
            now,
            now
        ]);

        // ============================================
        // ���������� ���������
        // ============================================
        materials.push([
            'stretch-ceiling-glossy',
            'ceiling',
            '�������� ���������',
            1200,
            '�?',
            '��������� �������� �������',
            '#FFFFFF',
            'stretch-glossy',
            1,
            now,
            now
        ]);
        materials.push([
            'stretch-ceiling-matte',
            'ceiling',
            '�������� �������',
            1100,
            '�?',
            '������� �������� �������',
            '#F5F5F5',
            'stretch-matte',
            1,
            now,
            now
        ]);
        materials.push([
            'pvh-ceiling',
            'ceiling',
            '��� �������',
            550,
            '�?',
            '����������� ��������� �������',
            '#FFFFFF',
            'pvh-ceiling',
            0,
            now,
            now
        ]);
        materials.push([
            'vagonka-ceiling',
            'ceiling',
            '������� �������',
            650,
            '�?',
            '���������� ������� ��� �������',
            '#D4A574',
            'wood-light',
            1,
            now,
            now
        ]);

        // ============================================
        // ��������� ���������
        // ============================================
        materials.push([
            'laminate-floor-33',
            'floor',
            '������� 33 �����',
            1200,
            '�?',
            '������������� ������� 33 ������',
            '#8B7355',
            'laminat',
            1,
            now,
            now
        ]);
        materials.push([
            'laminate-floor-32',
            'floor',
            '������� 32 �����',
            950,
            '�?',
            '������� 32 ������ ��� ����',
            '#9C846B',
            'laminat',
            1,
            now,
            now
        ]);
        materials.push([
            'linoleum-commercial',
            'floor',
            '�������� ������������',
            650,
            '�?',
            '������������� ������������ ��������',
            '#A0A0A0',
            'linoleum',
            0,
            now,
            now
        ]);
        materials.push([
            'tile-ceramic',
            'floor',
            '������ ������������',
            1400,
            '�?',
            '������������ ��������� ������',
            '#C0C0C0',
            'tile',
            1,
            now,
            now
        ]);
        materials.push([
            'parquet-floor',
            'floor',
            '��������� �����',
            2200,
            '�?',
            '����������� ��������� �����',
            '#8B6F47',
            'parquet',
            1,
            now,
            now
        ]);

        // ============================================
        // ����
        // ============================================
        materials.push([
            'window-standard-2chamber',
            'windows',
            '���� �������� (2-���)',
            11500,
            '��',
            '������������ �����������, ������� 60��',
            '#FFFFFF',
            'window',
            1,
            now,
            now
        ]);
        materials.push([
            'window-premium-2chamber',
            'windows',
            '���� ������� (2-���)',
            16500,
            '��',
            '������������, ������� 70��, �����������������',
            '#F5F5F5',
            'window-premium',
            1,
            now,
            now
        ]);
        materials.push([
            'window-panoramic',
            'windows',
            '���������� ����������',
            35000,
            '�.�.',
            '���������� ���������� �� ���� �� �������',
            '#E8E8E8',
            'panoramic',
            1,
            now,
            now
        ]);

        // ============================================
        // ����������� � ������
        // ============================================
        materials.push([
            'windowsill-pvc-standard',
            'windowsill',
            '���������� ��� ��������',
            1500,
            '�.�.',
            '��� ���������� 400��',
            '#FFFFFF',
            'pvc',
            1,
            now,
            now
        ]);
        materials.push([
            'sill-external',
            'windowsill',
            '����� �������',
            900,
            '�.�.',
            '������������� ������� �����',
            '#C0C0C0',
            'metal',
            1,
            now,
            now
        ]);

        // ============================================
        // ���������
        // ============================================
        materials.push([
            'led-spot-5w',
            'lighting',
            'LED �������� 5W',
            450,
            '��',
            '������������ �������� ���������� 5W',
            '#FFFFFF',
            'led-spot',
            1,
            now,
            now
        ]);
        materials.push([
            'led-spot-7w',
            'lighting',
            'LED �������� 7W',
            550,
            '��',
            '������������ �������� ���������� 7W',
            '#FFFFFF',
            'led-spot',
            1,
            now,
            now
        ]);
        materials.push([
            'led-panel-36w',
            'lighting',
            'LED ������ 36W',
            1800,
            '��',
            '������������ ������ 600x600��',
            '#FFFFFF',
            'led-panel',
            0,
            now,
            now
        ]);
        materials.push([
            'chandelier-modern',
            'lighting',
            '������ �����������',
            4500,
            '��',
            '���������� ������ � ����������� �����',
            '#F0F0F0',
            'chandelier',
            1,
            now,
            now
        ]);

        // ============================================
        // ������
        // ============================================
        materials.push([
            'cabinet-2door-low',
            'furniture',
            '���� 2 ����� ������',
            8500,
            '��',
            '��������� ���� 2 �����, ������ 100��',
            '#8B7355',
            'wood',
            1,
            now,
            now
        ]);
        materials.push([
            'cabinet-2door-tall',
            'furniture',
            '���� 2 ����� �������',
            14500,
            '��',
            '��������� ���� 2 �����, ������ 200��',
            '#8B7355',
            'wood',
            1,
            now,
            now
        ]);
        materials.push([
            'cabinet-corner',
            'furniture',
            '���� �������',
            16500,
            '��',
            '������� ���� ��� �������',
            '#8B7355',
            'wood',
            1,
            now,
            now
        ]);
        materials.push([
            'table-folding',
            'furniture',
            '���� ��������',
            4500,
            '��',
            '�������� ���� ��� �������',
            '#C4A574',
            'wood',
            1,
            now,
            now
        ]);
        materials.push([
            'chair-balcony',
            'furniture',
            '���� ���������',
            2500,
            '��',
            '���� ��� �������, ��������',
            '#A0A0A0',
            'metal',
            1,
            now,
            now
        ]);

        return materials;
    }

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

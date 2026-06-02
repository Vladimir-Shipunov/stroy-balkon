const express = require('express');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const {
    cleanArray,
    cleanEmail,
    cleanEnum,
    cleanId,
    cleanInteger,
    cleanNumber,
    cleanObject,
    cleanPhone,
    cleanString
} = require('../utils/validation');

const { createAdminGuard } = require('../middleware/admin-auth');

module.exports = function createOrdersRouter(deps) {
    const router = express.Router();
    const { db, emailService, telegramBot } = deps;
    // Self-sufficient if a guard is not injected — fail closed by default.
    const adminGuard = deps.adminGuard || createAdminGuard();
    const validStatuses = ['new', 'processing', 'confirmed', 'in_work', 'completed', 'cancelled'];

    router.post('/', async (req, res) => {
        try {
            const orderData = cleanObject(req.body);
            const missingFields = ['clientName', 'clientPhone', 'balconySize', 'balconyType']
                .filter((field) => !orderData[field]);

            if (missingFields.length) {
                return res.status(400).json({
                    success: false,
                    error: `Missing required fields: ${missingFields.join(', ')}`
                });
            }

            const clientName = cleanString(orderData.clientName, { max: 120 });
            const clientPhone = cleanPhone(orderData.clientPhone);
            const clientEmail = cleanEmail(orderData.clientEmail);
            const balconySize = cleanNumber(orderData.balconySize, { min: 0.5, max: 20, fallback: NaN });

            if (clientName.length < 2 || clientPhone.length < 10 || !Number.isFinite(balconySize)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid order data'
                });
            }

            const order = {
                id: uuidv4(),
                orderId: `ORD-${Date.now()}`,
                clientName,
                clientPhone,
                clientEmail,
                clientAddress: cleanString(orderData.clientAddress, { max: 300 }) || null,
                comment: cleanString(orderData.comment, { max: 1500 }) || null,
                balconyType: cleanString(orderData.balconyType, { max: 80 }),
                balconySize,
                balconyShape: cleanString(orderData.balconyShape, { max: 80 }) || 'straight',
                materials: cleanArray(orderData.materials, 100),
                materialsPrice: cleanNumber(orderData.materialsPrice, { min: 0, max: 100000000, fallback: 0 }),
                workPrice: cleanNumber(orderData.workPrice, { min: 0, max: 100000000, fallback: 0 }),
                totalPrice: cleanNumber(orderData.totalPrice, { min: 0, max: 100000000, fallback: 0 }),
                screenshot: cleanString(orderData.screenshot, { max: 1000 }) || null,
                metadata: cleanObject(orderData.metadata),
                status: 'new',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const savedOrder = db.saveOrder(order);
            if (!savedOrder) {
                return res.status(500).json({
                    success: false,
                    error: 'Could not save order'
                });
            }

            const telegramResult = await telegramBot.sendNewOrder(order);
            if (!telegramResult?.success) {
                logger.warn('Telegram order notification failed', {
                    orderId: order.orderId,
                    error: telegramResult?.error
                });
            }

            if (order.clientEmail) {
                const emailResult = await emailService.sendOrderConfirmation(order);
                if (!emailResult?.success) {
                    logger.warn('Order confirmation email failed', {
                        orderId: order.orderId,
                        error: emailResult?.error
                    });
                }
            }

            return res.status(201).json({
                success: true,
                orderId: order.orderId,
                message: 'Order created',
                order: {
                    id: order.id,
                    orderId: order.orderId,
                    createdAt: order.createdAt
                }
            });
        } catch (error) {
            logger.error('Create order error', error);
            return res.status(500).json({
                success: false,
                error: 'Could not create order'
            });
        }
    });

    router.get('/', adminGuard, (req, res) => {
        try {
            const page = cleanInteger(req.query.page, { min: 1, max: 10000, fallback: 1 });
            const limit = cleanInteger(req.query.limit, { min: 1, max: 100, fallback: 20 });
            const status = cleanEnum(req.query.status, validStatuses, null);
            const orders = db.getOrders({ page, limit, status });

            return res.json({
                success: true,
                orders: orders.data,
                pagination: {
                    page: orders.page,
                    limit: orders.limit,
                    total: orders.total,
                    pages: Math.ceil(orders.total / orders.limit)
                }
            });
        } catch (error) {
            logger.error('Get orders error', error);
            return res.status(500).json({
                success: false,
                error: 'Could not get orders'
            });
        }
    });

    router.get('/client/:phone', adminGuard, (req, res) => {
        try {
            const phone = cleanPhone(req.params.phone);
            return res.json({
                success: true,
                orders: db.getOrdersByPhone(phone)
            });
        } catch (error) {
            logger.error('Get client orders error', error);
            return res.status(500).json({
                success: false,
                error: 'Could not get client orders'
            });
        }
    });

    router.post('/export/pdf', adminGuard, (req, res) => {
        return res.status(501).json({
            success: false,
            error: 'PDF export is not implemented yet'
        });
    });

    router.post('/export/excel', adminGuard, (req, res) => {
        return res.status(501).json({
            success: false,
            error: 'Excel export is not implemented yet'
        });
    });

    router.get('/:id', adminGuard, (req, res) => {
        try {
            const orderId = cleanId(req.params.id);
            const order = db.getOrderById(orderId);

            if (!order) {
                return res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
            }

            return res.json({
                success: true,
                order
            });
        } catch (error) {
            logger.error('Get order error', error);
            return res.status(500).json({
                success: false,
                error: 'Could not get order'
            });
        }
    });

    router.post('/:id/cancel', adminGuard, (req, res) => {
        try {
            const orderId = cleanId(req.params.id);
            const reason = cleanString(req.body?.reason, { max: 500 });
            const updated = db.updateOrderStatus(orderId, 'cancelled', reason);

            if (!updated) {
                return res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
            }

            return res.json({
                success: true,
                message: 'Order cancelled'
            });
        } catch (error) {
            logger.error('Cancel order error', error);
            return res.status(500).json({
                success: false,
                error: 'Could not cancel order'
            });
        }
    });

    router.post('/:id/status', adminGuard, (req, res) => {
        try {
            const orderId = cleanId(req.params.id);
            const status = cleanString(req.body?.status, { max: 40 });
            const comment = cleanString(req.body?.comment, { max: 500 });

            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid status'
                });
            }

            const updated = db.updateOrderStatus(orderId, status, comment);
            if (!updated) {
                return res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
            }

            return res.json({
                success: true,
                message: 'Order status updated'
            });
        } catch (error) {
            logger.error('Update status error', error);
            return res.status(500).json({
                success: false,
                error: 'Could not update order status'
            });
        }
    });

    return router;
};

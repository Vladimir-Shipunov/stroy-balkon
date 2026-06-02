const axios = require('axios');
const logger = require('./logger');
const { CircuitBreaker, retry } = require('./safety');

class TelegramBot {
    constructor(config = {}) {
        this.config = {
            token: config.token,
            chatId: config.chatId,
            enabled: config.enabled !== false
        };

        this.apiBase = `https://api.telegram.org/bot${this.config.token}`;
        this.circuitBreaker = new CircuitBreaker({
            name: 'telegram',
            failureThreshold: 3,
            cooldownMs: 30000
        });

        if (this.config.enabled && this.config.token && this.config.chatId) {
            logger.info('Telegram bot initialized');
        } else {
            logger.warn('Telegram bot is not configured');
        }
    }

    async sendMessage(text, options = {}) {
        if (!this.config.enabled || !this.config.token || !this.config.chatId) {
            return { success: false, error: 'Telegram не настроен' };
        }

        try {
            const response = await this.circuitBreaker.execute(() => retry(
                    () => axios.post(`${this.apiBase}/sendMessage`, {
                        chat_id: this.config.chatId,
                        text,
                        parse_mode: 'HTML',
                        ...options
                    }, { timeout: 8000 }),
                    {
                        retries: 2,
                        timeoutMs: 9000,
                        label: 'telegram.sendMessage',
                        onError: (error, meta) => logger.warn('Telegram send attempt failed', {
                            attempt: meta.attempt + 1,
                            retries: meta.retries,
                            error: error.response?.data || error.message
                        })
                    }
                )
            );

            return { success: true, data: response.data };
        } catch (error) {
            logger.error('Telegram send message failed', error, { response: error.response?.data });
            return { success: false, error: error.message };
        }
    }

    async sendNewOrder(order) {
        const message = this._formatOrderMessage(order);
        return this.sendMessage(message);
    }

    async sendCallRequest(request) {
        const name = this._escapeHtml(request.name || 'Клиент');
        const phone = this._escapeHtml(request.phone || '');
        const message = `
<b>Новая заявка на звонок</b>

Имя: ${name}
Телефон: ${phone}
Дата: ${new Date(request.createdAt).toLocaleString('ru-RU')}
        `.trim();

        return this.sendMessage(message);
    }

    _formatOrderMessage(order) {
        const safe = (value) => this._escapeHtml(value || '');
        const materialsList = order.materials?.slice(0, 5).map(
            (m) => `• ${safe(m.name)} (${safe(m.quantity)} ${safe(m.unit)})`
        ).join('\n') || 'Материалы не выбраны';
        const siteUrl = process.env.SITE_URL || '';
        const orderLink = siteUrl ? `${siteUrl}/admin/orders/${safe(order.id)}` : '';

        return `
<b>Новый заказ</b>

Номер: ${safe(order.orderId)}
Клиент: ${safe(order.clientName)}
Телефон: ${safe(order.clientPhone)}
${order.clientEmail ? `Email: ${safe(order.clientEmail)}` : ''}

<b>Параметры балкона</b>
Тип: ${safe(order.balconyType)}
Размер: ${safe(order.balconySize)} м
Форма: ${safe(order.balconyShape)}

<b>Материалы</b>
${materialsList}
${order.materials?.length > 5 ? `\n... и ещё ${order.materials.length - 5}` : ''}

Дата: ${new Date(order.createdAt).toLocaleString('ru-RU')}
${orderLink ? `Ссылка: ${orderLink}` : ''}
        `.trim();
    }

    async sendScreenshot(screenshotPath, caption = '') {
        if (!this.config.enabled || !this.config.token || !this.config.chatId) {
            return { success: false, error: 'Telegram не настроен' };
        }

        try {
            const fs = require('fs');
            const path = require('path');
            const fullPath = path.join(__dirname, '../../', screenshotPath);

            if (!fs.existsSync(fullPath)) {
                return { success: false, error: 'Файл не найден' };
            }

            // Оставлено как fallback: в текущем проекте скриншоты обычно не отправляются в Telegram.
            return { success: false, error: 'Отправка фото не реализована для этого режима' };
        } catch (error) {
            logger.error('Telegram screenshot send failed', error);
            return { success: false, error: error.message };
        }
    }

    async checkConnection() {
        try {
            const response = await axios.get(`${this.apiBase}/getMe`, { timeout: 5000 });
            return response.data.ok;
        } catch (error) {
            return false;
        }
    }

    _escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

module.exports = TelegramBot;

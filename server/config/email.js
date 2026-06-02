const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const { CircuitBreaker, retry } = require('../utils/safety');

class EmailService {
    constructor(config = {}) {
        this.config = {
            host: config.host || 'smtp.gmail.com',
            port: Number(config.port) || 587,
            secure: Boolean(config.secure),
            user: config.user,
            pass: config.pass,
            from: config.from || 'BalconyPro <noreply@balconypro.ru>'
        };

        this.transporter = null;
        this.circuitBreaker = new CircuitBreaker({
            name: 'email',
            failureThreshold: 3,
            cooldownMs: 30000
        });
        this._initialize();
    }

    _initialize() {
        if (!this.config.user || !this.config.pass) {
            logger.warn('Email service is not configured');
            return;
        }

        this.transporter = nodemailer.createTransport({
            host: this.config.host,
            port: this.config.port,
            secure: this.config.secure,
            connectionTimeout: 8000,
            greetingTimeout: 8000,
            socketTimeout: 12000,
            auth: {
                user: this.config.user,
                pass: this.config.pass
            }
        });

        this.transporter.verify((error) => {
            if (error) {
                logger.error('Email SMTP verification failed', error);
                return;
            }
            logger.info('Email service is ready');
        });
    }

    async _sendMail(mail, label) {
        if (!this.transporter) {
            return { success: false, error: 'Email service is not configured' };
        }

        try {
            const info = await this.circuitBreaker.execute(() => retry(
                () => this.transporter.sendMail(mail),
                {
                    retries: 1,
                    timeoutMs: 12000,
                    label,
                    onError: (error, meta) => logger.warn('Email send attempt failed', {
                        label,
                        attempt: meta.attempt + 1,
                        retries: meta.retries,
                        error: error.message
                    })
                }
            ));

            logger.info('Email sent', { label, messageId: info.messageId });
            return { success: true, messageId: info.messageId };
        } catch (error) {
            logger.error('Email send failed', error, { label });
            return { success: false, error: error.message };
        }
    }

    async sendOrderConfirmation(order) {
        if (!order.clientEmail) {
            return { success: false, error: 'Client email is missing' };
        }

        const emailData = this._createOrderConfirmationEmail(order);
        return this._sendMail({
            from: this.config.from,
            to: order.clientEmail,
            subject: emailData.subject,
            html: emailData.html
        }, 'email.sendOrderConfirmation');
    }

    async sendManagerNotification(order) {
        return this._sendMail({
            from: this.config.from,
            to: this.config.user,
            subject: `New order ${order.orderId}`,
            html: this._createManagerNotificationEmail(order)
        }, 'email.sendManagerNotification');
    }

    _createOrderConfirmationEmail(order) {
        return {
            subject: `Order ${order.orderId} received - BalconyPro`,
            html: this._createBaseEmail(`
                <h2>Thank you. We received your order.</h2>
                <table>
                    <tr><td>Order</td><td>${this._escape(order.orderId)}</td></tr>
                    <tr><td>Date</td><td>${this._escape(new Date(order.createdAt).toLocaleString('ru-RU'))}</td></tr>
                    <tr><td>Name</td><td>${this._escape(order.clientName)}</td></tr>
                    <tr><td>Phone</td><td>${this._escape(order.clientPhone)}</td></tr>
                    <tr><td>Balcony type</td><td>${this._escape(order.balconyType)}</td></tr>
                    <tr><td>Size</td><td>${this._escape(order.balconySize)} m</td></tr>
                </table>
                <p>We will contact you soon to clarify the details.</p>
            `)
        };
    }

    _createManagerNotificationEmail(order) {
        return this._createBaseEmail(`
            <h2>New order ${this._escape(order.orderId)}</h2>
            <table>
                <tr><td>Name</td><td>${this._escape(order.clientName)}</td></tr>
                <tr><td>Phone</td><td>${this._escape(order.clientPhone)}</td></tr>
                <tr><td>Email</td><td>${this._escape(order.clientEmail || 'not provided')}</td></tr>
                <tr><td>Balcony type</td><td>${this._escape(order.balconyType)}</td></tr>
                <tr><td>Size</td><td>${this._escape(order.balconySize)} m</td></tr>
                <tr><td>Shape</td><td>${this._escape(order.balconyShape)}</td></tr>
            </table>
        `);
    }

    _createBaseEmail(content) {
        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; }
    .container { max-width: 640px; margin: 0 auto; padding: 24px; }
    .header { background: #1d4ed8; color: #fff; padding: 18px 20px; border-radius: 10px; }
    .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin-top: 16px; }
    table { border-collapse: collapse; width: 100%; }
    td { border-bottom: 1px solid #e5e7eb; padding: 8px; }
    td:first-child { color: #6b7280; width: 180px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1 style="margin:0">BalconyPro</h1></div>
    <div class="card">${content}</div>
  </div>
</body>
</html>`;
    }

    _escape(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

module.exports = EmailService;

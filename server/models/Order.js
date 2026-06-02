/**
 * ============================================
 * BALCONY PRO - ������ ������
 * ������: 2.0.0
 * ============================================
 */

class Order {
    constructor(data) {
        this.id = data.id || null;
        this.orderId = data.orderId || null;
        this.clientName = data.clientName || '';
        this.clientPhone = data.clientPhone || '';
        this.clientEmail = data.clientEmail || null;
        this.clientAddress = data.clientAddress || null;
        this.comment = data.comment || null;
        
        // ��������� �������
        this.balconyType = data.balconyType || '';
        this.balconySize = data.balconySize || 0;
        this.balconyShape = data.balconyShape || 'straight';
        
        // ���������
        this.materials = data.materials || [];
        
        // ����
        this.materialsPrice = data.materialsPrice || 0;
        this.workPrice = data.workPrice || 0;
        this.totalPrice = data.totalPrice || 0;
        
        // ��������
        this.screenshot = data.screenshot || null;
        
        // ����������
        this.metadata = data.metadata || {};
        
        // ������
        this.status = data.status || 'new';
        
        // ����
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
    }

    /**
     * ������������ �����
     * @returns {Object} ��������� ���������
     */
    validate() {
        const errors = [];

        if (!this.clientName || this.clientName.length < 2) {
            errors.push('������������ ��� �������');
        }

        if (!this.clientPhone || this.clientPhone.length < 10) {
            errors.push('������������ �������');
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * �������� ������ ������
     * @returns {Object} ������
     */
    getSummary() {
        return {
            orderId: this.orderId,
            client: `${this.clientName} (${this.clientPhone})`,
            balcony: `${this.balconySize}�, ${this.balconyShape}`,
            total: this.totalPrice,
            status: this.status,
            createdAt: this.createdAt
        };
    }

    /**
     * �������������� ��� Telegram
     * @returns {string} ����� ���������
     */
    toTelegramMessage() {
        return `
?? <b>����� �����!</b>

?? <b>�����:</b> ${this.orderId}
?? <b>������:</b> ${this.clientName}
?? <b>�������:</b> ${this.clientPhone}
${this.clientEmail ? `?? <b>Email:</b> ${this.clientEmail}` : ''}

?? <b>��������� �������:</b>
� ���: ${this.balconyType}
� ������: ${this.balconySize} �
� �����: ${this.balconyShape}

?? <b>���������:</b> (${this.materials.length} ���.)
${this.materials.slice(0, 5).map(m => `� ${m.name} - ${m.quantity} ${m.unit}`).join('\n')}
${this.materials.length > 5 ? `... � ��� ${this.materials.length - 5}` : ''}

?? <b>����:</b> ${new Date(this.createdAt).toLocaleString('ru-RU')}
        `.trim();
    }

    /**
     * �������������� ��� Email
     * @returns {Object} ������ ��� ������
     */
    toEmailData() {
        return {
            subject: `����� ${this.orderId} - BalconyPro`,
            html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .section { margin-bottom: 20px; }
        .label { font-weight: bold; color: #6b7280; }
        .value { color: #1f2937; }
        .total { font-size: 24px; font-weight: bold; color: #2563eb; }
        .footer { text-align: center; margin-top: 30px; color: #9ca3af; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>?? BalconyPro</h1>
            <p>��� ����� ������ � ������</p>
        </div>
        <div class="content">
            <div class="section">
                <p class="label">����� ������:</p>
                <p class="value">${this.orderId}</p>
            </div>
            <div class="section">
                <p class="label">������:</p>
                <p class="value">${this.clientName}</p>
                <p class="value">${this.clientPhone}</p>
            </div>
            <div class="section">
                <p class="label">��������� �������:</p>
                <p class="value">${this.balconySize} �, ${this.balconyShape}</p>
            </div>
            <div class="section">
                <p>�� �������� � ���� � ������� 15 ����� ��� ������������� ������� ������.</p>
            </div>
        </div>
        <div class="footer">
            <p>� 2024 BalconyPro. ��� ����� ��������.</p>
            <p>�������: +7 (999) 123-45-67 | Email: info@balconypro.ru</p>
        </div>
    </div>
</body>
</html>
            `
        };
    }

    /**
     * ������������� � JSON
     * @returns {Object} JSON ������
     */
    toJSON() {
        return {
            id: this.id,
            orderId: this.orderId,
            clientName: this.clientName,
            clientPhone: this.clientPhone,
            clientEmail: this.clientEmail,
            clientAddress: this.clientAddress,
            comment: this.comment,
            balconyType: this.balconyType,
            balconySize: this.balconySize,
            balconyShape: this.balconyShape,
            materials: this.materials,
            materialsPrice: this.materialsPrice,
            workPrice: this.workPrice,
            totalPrice: this.totalPrice,
            screenshot: this.screenshot,
            metadata: this.metadata,
            status: this.status,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

module.exports = Order;

/**
 * ============================================
 * BALCONY PRO - ��������� �����������
 * ������: 2.0.0
 * ============================================
 * ��������� ����������� � PDF ��� �������
 * ����������� ���������� Puppeteer ��� ����������
 */

const fs = require('fs');
const path = require('path');

class ImageGenerator {
    constructor(options = {}) {
        this.config = {
            outputDir: options.outputDir || './public/uploads/generated',
            puppeteerEnabled: options.puppeteerEnabled || false,
            quality: options.quality || 90,
            width: options.width || 1920,
            height: options.height || 1080,
            ...options
        };

        this.puppeteer = null;
        this.browser = null;

        // ������ ���������� ��� ������
        this._ensureOutputDir();

        console.log('??? ImageGenerator initialized');
    }

    /**
     * ��������� ��� ���������� ����������
     * @private
     */
    _ensureOutputDir() {
        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }
    }

    /**
     * ���������������� Puppeteer
     * @returns {Promise<void>}
     */
    async initPuppeteer() {
        if (this.config.puppeteerEnabled && !this.puppeteer) {
            try {
                this.puppeteer = require('puppeteer');
                console.log('? Puppeteer ��������');
            } catch (error) {
                console.warn('?? Puppeteer �� ����������. ��������� ����� canvas.');
                this.config.puppeteerEnabled = false;
            }
        }
    }

    /**
     * ��������� �������
     * @returns {Promise<void>}
     */
    async launchBrowser() {
        if (this.config.puppeteerEnabled && !this.browser) {
            try {
                this.browser = await this.puppeteer.launch({
                    headless: 'new',
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage'
                    ]
                });
                console.log('? ������� �������');
            } catch (error) {
                console.error('? ������ ������� ��������:', error);
                this.config.puppeteerEnabled = false;
            }
        }
    }

    /**
     * ������� �������
     */
    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            console.log('? ������� ������');
        }
    }

    /**
     * ������������� ����������� �������
     * @param {Object} orderData - ������ ������
     * @param {string} screenshotBase64 - �������� �� �������������
     * @returns {Promise<Object>} ��������� ���������
     */
    async generateBalconyImage(orderData, screenshotBase64 = null) {
        try {
            const filename = `balcony-${orderData.orderId || Date.now()}.png`;
            const outputPath = path.join(this.config.outputDir, filename);

            if (this.config.puppeteerEnabled && screenshotBase64) {
                // ��������� ����� Puppeteer � �����������
                await this._generateWithPuppeteer(orderData, screenshotBase64, outputPath);
            } else if (screenshotBase64) {
                // ������ ��������� ��������
                await this._saveScreenshot(screenshotBase64, outputPath);
            } else {
                // ���������� placeholder
                await this._generatePlaceholder(orderData, outputPath);
            }

            return {
                success: true,
                filename: filename,
                path: outputPath,
                url: `/uploads/generated/${filename}`
            };

        } catch (error) {
            console.error('Generate image error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * ������������� ����� Puppeteer
     * @private
     * @param {Object} orderData - ������ ������
     * @param {string} screenshotBase64 - ��������
     * @param {string} outputPath - ���� ������
     */
    async _generateWithPuppeteer(orderData, screenshotBase64, outputPath) {
        await this.launchBrowser();
        
        if (!this.browser) {
            throw new Error('Browser not available');
        }

        const page = await this.browser.newPage();
        
        // ������������� ������
        await page.setViewport({
            width: this.config.width,
            height: this.config.height
        });

        // ������ HTML ��� ����������
        const html = this._createImageHTML(orderData, screenshotBase64);
        
        await page.setContent(html, { waitUntil: 'networkidle0' });
        
        // ������ �������� ��������
        await page.screenshot({
            path: outputPath,
            fullPage: true,
            quality: this.config.quality
        });

        await page.close();

        console.log('? ����������� ������������� ����� Puppeteer:', outputPath);
    }

    /**
     * ������� HTML ��� ����������
     * @private
     * @param {Object} orderData - ������ ������
     * @param {string} screenshotBase64 - ��������
     * @returns {string} HTML
     */
    _createImageHTML(orderData, screenshotBase64) {
        return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>������ ������� - ${orderData.orderId}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 40px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 25px 50px rgba(0,0,0,0.3);
        }
        .header {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }
        .header h1 { font-size: 36px; margin-bottom: 10px; }
        .header p { opacity: 0.9; font-size: 18px; }
        .content { padding: 40px; }
        .screenshot {
            width: 100%;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            margin-bottom: 30px;
        }
        .screenshot img { width: 100%; height: auto; display: block; }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        .info-card {
            background: #f9fafb;
            padding: 25px;
            border-radius: 12px;
            border-left: 4px solid #2563eb;
        }
        .info-card h3 {
            color: #1f2937;
            font-size: 16px;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e5e7eb;
        }
        .info-row:last-child { border-bottom: none; }
        .info-label { color: #6b7280; font-size: 14px; }
        .info-value { font-weight: 600; color: #1f2937; }
        .total-card {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 30px;
            border-radius: 12px;
            text-align: center;
        }
        .total-label { font-size: 18px; opacity: 0.9; margin-bottom: 10px; }
        .total-value { font-size: 48px; font-weight: 700; }
        .materials-list {
            background: #f9fafb;
            padding: 25px;
            border-radius: 12px;
            margin-top: 20px;
        }
        .materials-list h3 {
            color: #1f2937;
            font-size: 16px;
            margin-bottom: 15px;
        }
        .material-item {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #e5e7eb;
            font-size: 14px;
        }
        .material-item:last-child { border-bottom: none; }
        .footer {
            background: #1f2937;
            color: white;
            padding: 30px 40px;
            text-align: center;
        }
        .footer p { opacity: 0.8; margin: 5px 0; }
        .watermark {
            position: absolute;
            bottom: 20px;
            right: 20px;
            opacity: 0.3;
            font-size: 24px;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>?? BalconyPro</h1>
            <p>������ ������� �������</p>
        </div>
        
        <div class="content">
            <div class="screenshot">
                <img src="${screenshotBase64}" alt="������ �������">
            </div>

            <div class="info-grid">
                <div class="info-card">
                    <h3>?? ���������� � ������</h3>
                    <div class="info-row">
                        <span class="info-label">����� ������:</span>
                        <span class="info-value">${orderData.orderId || 'N/A'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">������:</span>
                        <span class="info-value">${orderData.clientName || 'N/A'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">����:</span>
                        <span class="info-value">${new Date().toLocaleDateString('ru-RU')}</span>
                    </div>
                </div>

                <div class="info-card">
                    <h3>?? ��������� �������</h3>
                    <div class="info-row">
                        <span class="info-label">������:</span>
                        <span class="info-value">${orderData.balconySize || 0} �</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">�����:</span>
                        <span class="info-value">${orderData.balconyShape || '������'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">���:</span>
                        <span class="info-value">${orderData.balconyType || '������'}</span>
                    </div>
                </div>
            </div>

            ${orderData.materials && orderData.materials.length > 0 ? `
            <div class="materials-list">
                <h3>?? ��������� ���������</h3>
                ${orderData.materials.slice(0, 10).map(m => `
                    <div class="material-item">
                        <span>${m.name} (${m.quantity} ${m.unit})</span>
                        <span>${m.price * m.quantity} ?</span>
                    </div>
                `).join('')}
                ${orderData.materials.length > 10 ? `<p style="text-align: center; color: #6b7280; margin-top: 10px;">... � ��� ${orderData.materials.length - 10} �������</p>` : ''}
            </div>
            ` : ''}

            <div class="total-card" style="margin-top: 30px;">
                <div class="total-label">�������� ���������</div>
                <div class="total-value">${orderData.totalPrice || 0} ?</div>
            </div>
        </div>

        <div class="footer">
            <p><strong>BalconyPro</strong> - ���������������� ������� ��������</p>
            <p>?? +7 (999) 123-45-67 | ?? info@balconypro.ru</p>
            <p>www.balconypro.ru</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    /**
     * ��������� ��������
     * @private
     * @param {string} base64 - Base64 �����������
     * @param {string} outputPath - ���� ������
     */
    async _saveScreenshot(base64, outputPath) {
        // ������� ������� data:image/png;base64,
        const base64Data = base64.replace(/^data:image\/png;base64,/, '');
        
        await fs.promises.writeFile(outputPath, base64Data, 'base64');
        console.log('? �������� ��������:', outputPath);
    }

    /**
     * ������������� placeholder
     * @private
     * @param {Object} orderData - ������ ������
     * @param {string} outputPath - ���� ������
     */
    async _generatePlaceholder(orderData, outputPath) {
        // ������ ������� SVG placeholder
        const svg = `
<svg width="${this.config.width}" height="${this.config.height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <text x="50%" y="40%" font-family="Arial" font-size="48" fill="white" text-anchor="middle">
        ?? BalconyPro
    </text>
    <text x="50%" y="50%" font-family="Arial" font-size="24" fill="white" text-anchor="middle">
        ������: ${orderData.orderId || 'N/A'}
    </text>
    <text x="50%" y="55%" font-family="Arial" font-size="24" fill="white" text-anchor="middle">
        ${orderData.clientName || '������'}
    </text>
    <text x="50%" y="65%" font-family="Arial" font-size="36" fill="white" text-anchor="middle">
        ${orderData.totalPrice || 0} ?
    </text>
    <text x="50%" y="90%" font-family="Arial" font-size="18" fill="rgba(255,255,255,0.7)" text-anchor="middle">
        ${new Date().toLocaleDateString('ru-RU')}
    </text>
</svg>
        `;

        await fs.promises.writeFile(outputPath, svg);
        console.log('? Placeholder ������:', outputPath);
    }

    /**
     * ������������� PDF �����
     * @param {Object} orderData - ������ ������
     * @returns {Promise<Object>} ���������
     */
    async generatePDF(orderData) {
        try {
            const filename = `estimate-${orderData.orderId || Date.now()}.pdf`;
            const outputPath = path.join(this.config.outputDir, filename);

            if (this.config.puppeteerEnabled) {
                await this.launchBrowser();
                
                if (!this.browser) {
                    throw new Error('Browser not available');
                }

                const page = await this.browser.newPage();
                
                await page.setViewport({
                    width: this.config.width,
                    height: this.config.height
                });

                const html = this._createPDFHTML(orderData);
                await page.setContent(html, { waitUntil: 'networkidle0' });
                
                await page.pdf({
                    path: outputPath,
                    format: 'A4',
                    printBackground: true,
                    margin: {
                        top: '20mm',
                        right: '20mm',
                        bottom: '20mm',
                        left: '20mm'
                    }
                });

                await page.close();

                return {
                    success: true,
                    filename: filename,
                    path: outputPath,
                    url: `/uploads/generated/${filename}`
                };

            } else {
                // ���������� �������� ���� Puppeteer ����������
                return {
                    success: false,
                    error: 'Puppeteer �� ��������. ����������: npm install puppeteer'
                };
            }

        } catch (error) {
            console.error('Generate PDF error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * ������� HTML ��� PDF
     * @private
     * @param {Object} orderData - ������ ������
     * @returns {string} HTML
     */
    _createPDFHTML(orderData) {
        return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <style>
        @page { size: A4; margin: 20mm; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; }
        .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #2563eb; margin: 0; }
        .header p { color: #6b7280; margin: 5px 0; }
        .section { margin-bottom: 25px; }
        .section-title { font-size: 18px; font-weight: 600; color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 15px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f9fafb; font-weight: 600; color: #6b7280; }
        .total-row { font-size: 18px; font-weight: 700; }
        .total-row td { border-top: 2px solid #2563eb; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>?? BalconyPro</h1>
        <p>����� �� ������� �������</p>
        <p>����� � ${orderData.orderId || 'N/A'}</p>
        <p>${new Date().toLocaleDateString('ru-RU')}</p>
    </div>

    <div class="section">
        <div class="section-title">?? ������</div>
        <p><strong>${orderData.clientName || 'N/A'}</strong></p>
        <p>?? ${orderData.clientPhone || 'N/A'}</p>
        <p>?? ${orderData.clientEmail || 'N/A'}</p>
    </div>

    <div class="section">
        <div class="section-title">?? ��������� �������</div>
        <table>
            <tr><th>��������</th><th>��������</th></tr>
            <tr><td>���</td><td>${orderData.balconyType || '������'}</td></tr>
            <tr><td>������</td><td>${orderData.balconySize || 0} �</td></tr>
            <tr><td>�����</td><td>${orderData.balconyShape || '������'}</td></tr>
        </table>
    </div>

    <div class="section">
        <div class="section-title">?? ���������</div>
        <table>
            <tr><th>������������</th><th>���-��</th><th>��.</th><th>����</th><th>�����</th></tr>
            ${(orderData.materials || []).map(m => `
                <tr>
                    <td>${m.name}</td>
                    <td>${m.quantity}</td>
                    <td>${m.unit}</td>
                    <td>${m.price} ?</td>
                    <td>${m.price * m.quantity} ?</td>
                </tr>
            `).join('')}
        </table>
    </div>

    <div class="section">
        <div class="section-title">?? �����</div>
        <table>
            <tr><td>���������:</td><td style="text-align: right;">${orderData.materialsPrice || 0} ?</td></tr>
            <tr><td>������:</td><td style="text-align: right;">${orderData.workPrice || 0} ?</td></tr>
            <tr class="total-row"><td>�����:</td><td style="text-align: right;">${orderData.totalPrice || 0} ?</td></tr>
        </table>
    </div>

    <div class="footer">
        <p>BalconyPro � ${new Date().getFullYear()}</p>
        <p>?? +7 (999) 123-45-67 | ?? info@balconypro.ru | ?? www.balconypro.ru</p>
        <p>�������� �� ��� ������ 5 ���</p>
    </div>
</body>
</html>
        `;
    }

    /**
     * �������� ������ �����
     * @param {number} days - ���������� ���� ��� ��������
     */
    async cleanupOldFiles(days = 30) {
        try {
            const files = await fs.promises.readdir(this.config.outputDir);
            const now = Date.now();
            const maxAge = days * 24 * 60 * 60 * 1000;

            for (const file of files) {
                const filePath = path.join(this.config.outputDir, file);
                const stats = await fs.promises.stat(filePath);
                
                if (now - stats.mtimeMs > maxAge) {
                    await fs.promises.unlink(filePath);
                    console.log('??? ����� ������ ����:', file);
                }
            }

        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }

    /**
     * ���������� ���������
     */
    async destroy() {
        await this.closeBrowser();
        console.log('? ImageGenerator ���������');
    }
}

module.exports = ImageGenerator;
/**
 * ============================================
 * ============================================
 */

// ============================================
// ============================================
class OrderHandler {
    constructor(options = {}) {
        // ============================================
        // ============================================
        this.config = {
            apiUrl: options.apiUrl || '/api',
            timeout: options.timeout || 30000,
            retryAttempts: options.retryAttempts || 3,
            retryDelay: options.retryDelay || 1000,
            validatePhone: options.validatePhone !== false,
            validateEmail: options.validateEmail !== false,
            requireEmail: options.requireEmail || false,
            autoSave: options.autoSave === true,
            saveInterval: options.saveInterval || 30000
        };

        // ============================================
        // ============================================
        this.state = {
            isSubmitting: false,
            lastOrderId: null,
            orders: [],
            savedDrafts: [],
            currentDraft: null
        };

        // ============================================
        // ============================================
        this.callbacks = {
            onOrderStart: [],
            onOrderSuccess: [],
            onOrderError: [],
            onOrderProgress: [],
            onDraftSave: [],
            onValidation: []
        };

        // ============================================
        // ============================================
        this.cache = {
            lastSubmission: null,
            submissionCount: 0,
            rateLimitWindow: 60000
        };
        this.autoSaveTimer = null;

        if (this.config.autoSave) {
            this._startAutoSave();
        } else {
            this._clearDraft();
        }

    }

    // ============================================
    // ============================================

    /**
     */
    validateOrderData(data) {
        const errors = [];
        const warnings = [];

        // ============================================
        // ============================================
        
        if (!data.clientName || typeof data.clientName !== 'string') {
            errors.push({
                field: 'clientName',
                message: '������� ���� ���',
                code: 'NAME_REQUIRED'
            });
        } else if (data.clientName.trim().length < 2) {
            errors.push({
                field: 'clientName',
                message: '��� ������ ��������� ������� 2 �������',
                code: 'NAME_TOO_SHORT'
            });
        } else if (data.clientName.trim().length > 100) {
            errors.push({
                field: 'clientName',
                message: '��� �� ������ ��������� 100 ��������',
                code: 'NAME_TOO_LONG'
            });
        }

        if (!data.clientPhone || typeof data.clientPhone !== 'string') {
            errors.push({
                field: 'clientPhone',
                message: '������� ����� ��������',
                code: 'PHONE_REQUIRED'
            });
        } else if (this.config.validatePhone) {
            const phoneValidation = this._validatePhone(data.clientPhone);
            if (!phoneValidation.valid) {
                errors.push({
                    field: 'clientPhone',
                    message: phoneValidation.message,
                    code: 'PHONE_INVALID'
                });
            }
        }

        if (data.clientEmail) {
            if (this.config.validateEmail) {
                const emailValidation = this._validateEmail(data.clientEmail);
                if (!emailValidation.valid) {
                    errors.push({
                        field: 'clientEmail',
                        message: emailValidation.message,
                        code: 'EMAIL_INVALID'
                    });
                }
            }
        } else if (this.config.requireEmail) {
            errors.push({
                field: 'clientEmail',
                message: 'Email ���������� ��� ����������',
                code: 'EMAIL_REQUIRED'
            });
        }

        if (data.clientAddress && data.clientAddress.length > 200) {
            warnings.push({
                field: 'clientAddress',
                message: '����� �� ������ ��������� 200 ��������',
                code: 'ADDRESS_TOO_LONG'
            });
        }

        // ============================================
        // ============================================
        
        if (!data.balconySize || data.balconySize <= 0) {
            errors.push({
                field: 'balconySize',
                message: '������� ������ �������',
                code: 'SIZE_REQUIRED'
            });
        } else if (data.balconySize < 2 || data.balconySize > 20) {
            errors.push({
                field: 'balconySize',
                message: '������ ������� ������ ���� �� 2 �� 20 ������',
                code: 'SIZE_INVALID'
            });
        }

        if (!data.balconyType) {
            errors.push({
                field: 'balconyType',
                message: '�������� ��� �������',
                code: 'TYPE_REQUIRED'
            });
        }

        // ============================================
        // ============================================
        
        if (!data.materials || Object.keys(data.materials).length === 0) {
            warnings.push({
                field: 'materials',
                message: '�� �� ������� �� ������ ���������',
                code: 'NO_MATERIALS'
            });
        }

        // ============================================
        // ============================================
        
        const now = Date.now();
        if (this.cache.lastSubmission && (now - this.cache.lastSubmission) < this.cache.rateLimitWindow) {
            errors.push({
                field: 'general',
                message: '����������, ��������� ����� ��������� ���������� ������',
                code: 'RATE_LIMIT'
            });
        }

        // ============================================
        // ============================================
        
        const result = {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings,
            canSubmit: errors.length === 0
        };

        this._notifyValidation(result);

        return result;
    }

    /**
     * @private
     */
    _validatePhone(phone) {
        const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
        
        const phoneRegex = /^7\d{10}$/;
        
        if (!phoneRegex.test(cleaned)) {
            return {
                valid: false,
                message: '������� ���������� ����� �������� (��������, +7 (999) 123-45-67)'
            };
        }

        return {
            valid: true,
            cleaned: cleaned,
            formatted: this._formatPhone(cleaned)
        };
    }

    /**
     * @private
     */
    _validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!emailRegex.test(email)) {
            return {
                valid: false,
                message: '������� ���������� email �����'
            };
        }

        if (email.length > 254) {
            return {
                valid: false,
                message: 'Email ������� �������'
            };
        }

        const parts = email.split('@');
        if (parts[1] && parts[1].length > 253) {
            return {
                valid: false,
                message: '����� email ������� �������'
            };
        }

        return {
            valid: true,
            normalized: email.toLowerCase()
        };
    }

    /**
     * @private
     */
    _formatPhone(phone) {
        const cleaned = phone.replace(/\D/g, '');
        
        if (cleaned.length === 11 && cleaned.startsWith('7')) {
            return `+7 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9)}`;
        }
        
        if (cleaned.length === 11 && cleaned.startsWith('8')) {
            return `+7 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9)}`;
        }

        return phone;
    }

    /**
     */
    formatPhoneInput(phone) {
        let value = phone.replace(/\D/g, '');
        
        if (value.length > 0) {
            if (value[0] === '7' || value[0] === '8') {
                value = value.substring(1);
            }
            
            let formattedValue = '+7';
            
            if (value.length > 0) {
                formattedValue += ' (' + value.substring(0, 3);
            }
            if (value.length >= 3) {
                formattedValue += ') ' + value.substring(3, 6);
            }
            if (value.length >= 6) {
                formattedValue += '-' + value.substring(6, 8);
            }
            if (value.length >= 8) {
                formattedValue += '-' + value.substring(8, 10);
            }
            
            return formattedValue;
        }
        
        return '';
    }

    // ============================================
    // ============================================

    /**
     */
    async submitOrder(orderData, screenshot = null) {
        // ============================================
        // ============================================
        
        if (this.state.isSubmitting) {
            return {
                success: false,
                error: '����� ��� ������������',
                code: 'ALREADY_SUBMITTING'
            };
        }

        // ============================================
        // ============================================
        
        const validation = this.validateOrderData(orderData);
        
        if (!validation.valid) {
            return {
                success: false,
                error: '������ ���������',
                code: 'VALIDATION_FAILED',
                errors: validation.errors,
                warnings: validation.warnings
            };
        }

        // ============================================
        // ============================================
        
        this.state.isSubmitting = true;
        this._notifyOrderStart(orderData);

        if (orderData.clientPhone) {
            const phoneValidation = this._validatePhone(orderData.clientPhone);
            if (phoneValidation.valid) {
                orderData.clientPhone = phoneValidation.formatted;
            }
        }

        if (orderData.clientEmail) {
            orderData.clientEmail = orderData.clientEmail.toLowerCase().trim();
        }

        orderData.metadata = {
            userAgent: navigator.userAgent,
            screenResolution: `${screen.width}x${screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            language: navigator.language,
            submittedAt: new Date().toISOString(),
            url: window.location.href,
            referrer: document.referrer || null
        };

        // ============================================
        // ============================================
        
        try {
            let screenshotPath = null;
            if (screenshot) {
                screenshotPath = await this._uploadScreenshot(screenshot);
            }

            const requestData = {
                ...orderData,
                screenshot: screenshotPath
            };

            const response = await this._sendRequest('/orders', requestData, 'POST');

            this.cache.lastSubmission = Date.now();
            this.cache.submissionCount++;

            if (response.success) {
                this.state.lastOrderId = response.orderId;
                this.state.orders.push({
                    id: response.orderId,
                    data: orderData,
                    createdAt: new Date().toISOString()
                });

                this._clearDraft();

                this._notifyOrderSuccess({
                    orderId: response.orderId,
                    data: orderData,
                    response: response
                });

                return {
                    success: true,
                    orderId: response.orderId,
                    message: response.message || '����� ������� ������',
                    data: orderData
                };
            } else {
                throw new Error(response.error || '����������� ������');
            }

        } catch (error) {
            console.error('Order submission error:', error);

            this._notifyOrderError({
                error: error,
                data: orderData
            });

            return {
                success: false,
                error: error.message,
                code: error.code || 'SUBMISSION_ERROR',
                data: orderData
            };

        } finally {
            this.state.isSubmitting = false;
        }
    }

    /**
     * @private
     */
    async _uploadScreenshot(screenshot) {
        try {
            const blob = await fetch(screenshot).then(r => r.blob());

            const formData = new FormData();
            formData.append('screenshot', blob, 'balcony-screenshot.png');

            const response = await fetch(`${this.config.apiUrl}/upload`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || '������ �������� ���������');
            }

            return result.path;

        } catch (error) {
            console.warn('Screenshot upload failed:', error);
            return null;
        }
    }

    /**
     * @private
     */
    async _sendRequest(endpoint, data, method = 'POST') {
        let lastError = null;

        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

                const response = await fetch(`${this.config.apiUrl}${endpoint}`, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: method === 'GET' ? undefined : JSON.stringify(data),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                let result = null;
                try {
                    result = await response.json();
                } catch (parseError) {
                    result = null;
                }

                if (!response.ok) {
                    if (response.status === 429) {
                        const retryAfter = response.headers.get('retry-after');
                        const retryHint = retryAfter ? ` ��������� ����� ${retryAfter} ���.` : '';
                        throw new Error(`������� ����� �������� � �������.${retryHint}`);
                    }
                    throw new Error(result.error || `HTTP ${response.status}`);
                }

                return result;

            } catch (error) {
                lastError = error;
                
                this._notifyOrderProgress({
                    attempt: attempt,
                    maxAttempts: this.config.retryAttempts,
                    error: error.message
                });

                if (attempt < this.config.retryAttempts) {
                    await this._delay(this.config.retryDelay * attempt);
                }
            }
        }

        throw lastError || new Error('�� ������� ��������� ������');
    }

    /**
     * @private
     * @returns {Promise}
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ============================================
    // ============================================

    /**
     */
    saveDraft(data) {
        if (!this.config.autoSave) {
            return;
        }

        try {
            const draft = {
                id: this._generateId('draft'),
                data: data,
                savedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            };

            localStorage.setItem('balcony_draft', JSON.stringify(draft));

            this.state.currentDraft = draft;
            this.state.savedDrafts.push(draft);

            this._notifyDraftSave(draft);

            console.log('?? Draft saved:', draft.id);

        } catch (error) {
            console.warn('Failed to save draft:', error);
        }
    }

    /**
     */
    loadDraft() {
        if (!this.config.autoSave) {
            return null;
        }

        try {
            const saved = localStorage.getItem('balcony_draft');
            
            if (!saved) {
                return null;
            }

            const draft = JSON.parse(saved);

            if (new Date(draft.expiresAt) < new Date()) {
                this._clearDraft();
                return null;
            }

            this.state.currentDraft = draft;
            return draft.data;

        } catch (error) {
            console.warn('Failed to load draft:', error);
            return null;
        }
    }

    /**
     */
    _clearDraft() {
        try {
            localStorage.removeItem('balcony_draft');
        } catch (error) {
            console.warn('Failed to clear draft:', error);
        }
        this.state.currentDraft = null;
    }

    /**
     * @private
     */
    _startAutoSave() {
        if (!this.config.autoSave) {
            return;
        }

        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }

        this.autoSaveTimer = setInterval(() => {
            if (window.balconyBuilder) {
                const draft = {
                    builder: window.balconyBuilder.exportConfig(),
                    timestamp: new Date().toISOString()
                };
                this.saveDraft(draft);
            }
        }, this.config.saveInterval);
    }

    // ============================================
    // ============================================

    /**
     */
    async getOrder(orderId) {
        try {
            const response = await this._sendRequest(`/orders/${orderId}`, {}, 'GET');
            return response.order;
        } catch (error) {
            console.error('Failed to get order:', error);
            throw error;
        }
    }

    /**
     */
    async getClientOrders(phone) {
        try {
            const response = await this._sendRequest(`/orders/client?phone=${encodeURIComponent(phone)}`, {}, 'GET');
            return response.orders || [];
        } catch (error) {
            console.error('Failed to get client orders:', error);
            return [];
        }
    }

    /**
     */
    async cancelOrder(orderId, reason = '') {
        try {
            const response = await this._sendRequest(`/orders/${orderId}/cancel`, { reason }, 'POST');
            return response;
        } catch (error) {
            console.error('Failed to cancel order:', error);
            throw error;
        }
    }

    // ============================================
    // ============================================

    /**
     */
    async exportToPDF(orderData) {
        try {
            const response = await this._sendRequest('/orders/export/pdf', orderData, 'POST');
            
            const byteCharacters = atob(response.pdf);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            
            return new Blob([byteArray], { type: 'application/pdf' });

        } catch (error) {
            console.error('Failed to export PDF:', error);
            throw error;
        }
    }

    /**
     */
    async exportToExcel(orderData) {
        try {
            const response = await this._sendRequest('/orders/export/excel', orderData, 'POST');
            
            const byteCharacters = atob(response.excel);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            
            return new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        } catch (error) {
            console.error('Failed to export Excel:', error);
            throw error;
        }
    }

    /**
     */
    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // ============================================
    // ============================================

    /**
     */
    subscribe(event, callback) {
        if (this.callbacks[event] && typeof callback === 'function') {
            this.callbacks[event].push(callback);
        }
    }

    /**
     */
    unsubscribe(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
        }
    }

    /**
     * @private
     */
    _notifyOrderStart(data) {
        this.callbacks.onOrderStart.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('Error in order start callback:', error);
            }
        });
    }

    /**
     * @private
     */
    _notifyOrderSuccess(result) {
        this.callbacks.onOrderSuccess.forEach(callback => {
            try {
                callback(result);
            } catch (error) {
                console.error('Error in order success callback:', error);
            }
        });
    }

    /**
     * @private
     */
    _notifyOrderError(error) {
        this.callbacks.onOrderError.forEach(callback => {
            try {
                callback(error);
            } catch (e) {
                console.error('Error in order error callback:', e);
            }
        });
    }

    /**
     * @private
     */
    _notifyOrderProgress(progress) {
        this.callbacks.onOrderProgress.forEach(callback => {
            try {
                callback(progress);
            } catch (error) {
                console.error('Error in order progress callback:', error);
            }
        });
    }

    /**
     * @private
     */
    _notifyDraftSave(draft) {
        this.callbacks.onDraftSave.forEach(callback => {
            try {
                callback(draft);
            } catch (error) {
                console.error('Error in draft save callback:', error);
            }
        });
    }

    /**
     * @private
     */
    _notifyValidation(result) {
        this.callbacks.onValidation.forEach(callback => {
            try {
                callback(result);
            } catch (error) {
                console.error('Error in validation callback:', error);
            }
        });
    }

    // ============================================
    // ============================================

    /**
     * @private
     */
    _generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     */
    getStatistics() {
        return {
            totalOrders: this.state.orders.length,
            lastOrderId: this.state.lastOrderId,
            isSubmitting: this.state.isSubmitting,
            draftsCount: this.state.savedDrafts.length,
            submissionCount: this.cache.submissionCount,
            lastSubmission: this.cache.lastSubmission
        };
    }

    /**
     */
    clearState() {
        this.state = {
            isSubmitting: false,
            lastOrderId: null,
            orders: [],
            savedDrafts: [],
            currentDraft: null
        };
    }

    /**
     */
    destroy() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
        this.clearState();
        Object.keys(this.callbacks).forEach(key => {
            this.callbacks[key] = [];
        });
    }
}

// Переопределения после восстановления кодировки: понятные русские сообщения валидации и ошибок.
OrderHandler.prototype.validateOrderData = function(data) {
    const errors = [];
    const warnings = [];

    if (!data.clientName || typeof data.clientName !== 'string') {
        errors.push({ field: 'clientName', message: 'Укажите имя', code: 'NAME_REQUIRED' });
    } else if (data.clientName.trim().length < 2) {
        errors.push({ field: 'clientName', message: 'Имя должно содержать минимум 2 символа', code: 'NAME_TOO_SHORT' });
    } else if (data.clientName.trim().length > 100) {
        errors.push({ field: 'clientName', message: 'Имя не должно быть длиннее 100 символов', code: 'NAME_TOO_LONG' });
    }

    if (!data.clientPhone || typeof data.clientPhone !== 'string') {
        errors.push({ field: 'clientPhone', message: 'Укажите номер телефона', code: 'PHONE_REQUIRED' });
    } else if (this.config.validatePhone) {
        const phoneValidation = this._validatePhone(data.clientPhone);
        if (!phoneValidation.valid) {
            errors.push({ field: 'clientPhone', message: phoneValidation.message, code: 'PHONE_INVALID' });
        }
    }

    if (data.clientEmail) {
        if (this.config.validateEmail) {
            const emailValidation = this._validateEmail(data.clientEmail);
            if (!emailValidation.valid) {
                errors.push({ field: 'clientEmail', message: emailValidation.message, code: 'EMAIL_INVALID' });
            }
        }
    } else if (this.config.requireEmail) {
        errors.push({ field: 'clientEmail', message: 'Укажите email', code: 'EMAIL_REQUIRED' });
    }

    if (data.clientAddress && data.clientAddress.length > 200) {
        warnings.push({ field: 'clientAddress', message: 'Адрес длиннее 200 символов', code: 'ADDRESS_TOO_LONG' });
    }

    if (!data.balconySize || data.balconySize <= 0) {
        errors.push({ field: 'balconySize', message: 'Укажите размер балкона', code: 'SIZE_REQUIRED' });
    } else if (data.balconySize < 2 || data.balconySize > 20) {
        errors.push({ field: 'balconySize', message: 'Размер балкона должен быть от 2 до 20 м', code: 'SIZE_INVALID' });
    }

    if (!data.balconyType) {
        errors.push({ field: 'balconyType', message: 'Выберите тип балкона', code: 'TYPE_REQUIRED' });
    }

    if (!data.materials || Object.keys(data.materials).length === 0) {
        warnings.push({ field: 'materials', message: 'Материалы не выбраны', code: 'NO_MATERIALS' });
    }

    const now = Date.now();
    if (this.cache.lastSubmission && (now - this.cache.lastSubmission) < this.cache.rateLimitWindow) {
        errors.push({
            field: 'general',
            message: 'Слишком частая отправка. Подождите немного и попробуйте снова.',
            code: 'RATE_LIMIT'
        });
    }

    const result = {
        valid: errors.length === 0,
        errors,
        warnings,
        canSubmit: errors.length === 0
    };

    this._notifyValidation(result);
    return result;
};

OrderHandler.prototype._validatePhone = function(phone) {
    const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
    const phoneRegex = /^7\d{10}$/;

    if (!phoneRegex.test(cleaned)) {
        return {
            valid: false,
            message: 'Укажите корректный номер телефона в формате +7 (999) 123-45-67'
        };
    }

    return { valid: true, cleaned, formatted: this._formatPhone(cleaned) };
};

OrderHandler.prototype._validateEmail = function(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { valid: false, message: 'Укажите корректный email' };
    }
    if (email.length > 254) {
        return { valid: false, message: 'Email слишком длинный' };
    }
    const parts = email.split('@');
    if (parts[1] && parts[1].length > 253) {
        return { valid: false, message: 'Домен email слишком длинный' };
    }
    return { valid: true, normalized: email.toLowerCase() };
};

OrderHandler.prototype.submitOrder = async function(orderData, screenshot = null) {
    if (this.state.isSubmitting) {
        return { success: false, error: 'Заказ уже отправляется', code: 'ALREADY_SUBMITTING' };
    }

    const validation = this.validateOrderData(orderData);
    if (!validation.valid) {
        return {
            success: false,
            error: 'Проверьте корректность данных',
            code: 'VALIDATION_FAILED',
            errors: validation.errors,
            warnings: validation.warnings
        };
    }

    this.state.isSubmitting = true;
    this._notifyOrderStart(orderData);

    if (orderData.clientPhone) {
        const phoneValidation = this._validatePhone(orderData.clientPhone);
        if (phoneValidation.valid) {
            orderData.clientPhone = phoneValidation.formatted;
        }
    }
    if (orderData.clientEmail) {
        orderData.clientEmail = orderData.clientEmail.toLowerCase().trim();
    }

    orderData.metadata = {
        userAgent: navigator.userAgent,
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        submittedAt: new Date().toISOString(),
        url: window.location.href,
        referrer: document.referrer || null
    };

    try {
        let screenshotPath = null;
        if (screenshot) {
            screenshotPath = await this._uploadScreenshot(screenshot);
        }

        const response = await this._sendRequest('/orders', { ...orderData, screenshot: screenshotPath }, 'POST');
        this.cache.lastSubmission = Date.now();
        this.cache.submissionCount++;

        if (!response.success) {
            throw new Error(response.error || 'Не удалось отправить заказ');
        }

        this.state.lastOrderId = response.orderId;
        this.state.orders.push({
            id: response.orderId,
            data: orderData,
            createdAt: new Date().toISOString()
        });

        this._clearDraft();
        this._notifyOrderSuccess({ orderId: response.orderId, data: orderData, response });

        return {
            success: true,
            orderId: response.orderId,
            message: response.message || 'Заказ успешно отправлен',
            data: orderData
        };
    } catch (error) {
        console.error('Order submission error:', error);
        this._notifyOrderError({ error, data: orderData });
        return {
            success: false,
            error: error.message,
            code: error.code || 'SUBMISSION_ERROR',
            data: orderData
        };
    } finally {
        this.state.isSubmitting = false;
    }
};

OrderHandler.prototype._uploadScreenshot = async function(screenshot) {
    try {
        const blob = await fetch(screenshot).then((r) => r.blob());
        const formData = new FormData();
        formData.append('screenshot', blob, 'balcony-screenshot.png');

        const response = await fetch(`${this.config.apiUrl}/upload`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Ошибка загрузки скриншота');
        }
        return result.path;
    } catch (error) {
        console.warn('Screenshot upload failed:', error);
        return null;
    }
};

OrderHandler.prototype._sendRequest = async function(endpoint, data, method = 'POST') {
    let lastError = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
        let timeoutId = null;
        try {
            const controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

            const response = await fetch(`${this.config.apiUrl}${endpoint}`, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: method === 'GET' ? undefined : JSON.stringify(data),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            let result = null;
            try {
                result = await response.json();
            } catch {
                result = null;
            }

            if (!response.ok) {
                if (response.status === 429) {
                    const retryAfter = response.headers.get('retry-after');
                    const retryHint = retryAfter ? ` Повторите через ${retryAfter} сек.` : '';
                    throw new Error(`Сервер временно ограничил запросы.${retryHint}`);
                }
                throw new Error(result?.error || `HTTP ${response.status}`);
            }

            return result;
        } catch (error) {
            lastError = error;
            this._notifyOrderProgress({
                attempt,
                maxAttempts: this.config.retryAttempts,
                error: error.message
            });
            if (attempt < this.config.retryAttempts) {
                await this._delay(this.config.retryDelay * attempt);
            }
        } finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        }
    }

    throw lastError || new Error('Не удалось выполнить запрос');
};

// ============================================
// ============================================
const orderHandler = new OrderHandler();


// ============================================
// ============================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { OrderHandler, orderHandler };
}

window.OrderHandler = OrderHandler;
window.orderHandler = orderHandler;

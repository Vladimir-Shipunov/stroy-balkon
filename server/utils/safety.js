function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout(promiseFactory, timeoutMs, label = 'operation') {
    let timer = null;
    try {
        return await Promise.race([
            Promise.resolve().then(promiseFactory),
            new Promise((_, reject) => {
                timer = setTimeout(() => {
                    const error = new Error(`${label} timed out after ${timeoutMs}ms`);
                    error.code = 'ETIMEDOUT';
                    reject(error);
                }, timeoutMs);
            })
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

async function retry(operation, options = {}) {
    const {
        retries = 2,
        timeoutMs = 8000,
        baseDelayMs = 250,
        label = 'operation',
        onError = null
    } = options;

    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            return await withTimeout(operation, timeoutMs, label);
        } catch (error) {
            lastError = error;
            if (typeof onError === 'function') {
                onError(error, { attempt, retries, label });
            }
            if (attempt < retries) {
                await delay(baseDelayMs * (attempt + 1));
            }
        }
    }
    throw lastError;
}

class CircuitBreaker {
    constructor(options = {}) {
        this.failureThreshold = options.failureThreshold || 3;
        this.cooldownMs = options.cooldownMs || 30000;
        this.name = options.name || 'circuit';
        this.failures = 0;
        this.openedAt = 0;
    }

    isOpen() {
        if (!this.openedAt) return false;
        if (Date.now() - this.openedAt >= this.cooldownMs) {
            this.openedAt = 0;
            this.failures = 0;
            return false;
        }
        return true;
    }

    async execute(operation) {
        if (this.isOpen()) {
            const error = new Error(`${this.name} circuit breaker is open`);
            error.code = 'CIRCUIT_OPEN';
            throw error;
        }

        try {
            const result = await operation();
            this.failures = 0;
            this.openedAt = 0;
            return result;
        } catch (error) {
            this.failures += 1;
            if (this.failures >= this.failureThreshold) {
                this.openedAt = Date.now();
            }
            throw error;
        }
    }
}

function asyncHandler(handler) {
    return (req, res, next) => {
        Promise.resolve(handler(req, res, next)).catch(next);
    };
}

module.exports = {
    CircuitBreaker,
    asyncHandler,
    retry,
    withTimeout
};

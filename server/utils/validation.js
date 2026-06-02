function cleanString(value, options = {}) {
    const {
        max = 500,
        fallback = '',
        allowEmpty = true
    } = options;

    if (typeof value !== 'string') return fallback;
    const cleaned = value
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/[<>]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max);

    if (!allowEmpty && !cleaned) return fallback;
    return cleaned;
}

function cleanEnum(value, allowed, fallback = null) {
    const normalized = cleanString(String(value || ''), { max: 80 });
    return allowed.includes(normalized) ? normalized : fallback;
}

function cleanNumber(value, options = {}) {
    const {
        min = Number.NEGATIVE_INFINITY,
        max = Number.POSITIVE_INFINITY,
        fallback = 0
    } = options;

    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
}

function cleanInteger(value, options = {}) {
    return Math.round(cleanNumber(value, options));
}

function cleanPhone(value) {
    return cleanString(value, { max: 32 }).replace(/[^\d+()\-.\s]/g, '');
}

function cleanEmail(value) {
    const email = cleanString(value, { max: 254 }).toLowerCase();
    if (!email) return null;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function cleanJsonValue(value, options = {}, depth = 0) {
    const {
        maxDepth = 6,
        maxKeys = 80,
        maxItems = 50,
        maxString = 1000
    } = options;

    if (depth > maxDepth) return null;
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'string') return cleanString(value, { max: maxString });
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

    if (Array.isArray(value)) {
        return value
            .slice(0, maxItems)
            .map((item) => cleanJsonValue(item, options, depth + 1))
            .filter((item) => item !== undefined);
    }

    if (typeof value === 'object') {
        const cleaned = {};
        Object.entries(value).slice(0, maxKeys).forEach(([key, item]) => {
            const safeKey = cleanString(String(key), { max: 80 }).replace(/[<>]/g, '');
            if (!safeKey) return;
            cleaned[safeKey] = cleanJsonValue(item, options, depth + 1);
        });
        return cleaned;
    }

    return null;
}

function cleanObject(value, maxLength = 20000) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    try {
        const normalized = JSON.parse(JSON.stringify(value));
        const cleaned = cleanJsonValue(normalized);
        const serialized = JSON.stringify(cleaned);

        if (serialized.length <= maxLength) {
            return cleaned;
        }

        return {
            truncated: true,
            originalLength: serialized.length
        };
    } catch (error) {
        return {};
    }
}

function cleanArray(value, maxItems = 50) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, maxItems).map((item) => cleanObject(item, 2000));
}

function cleanId(value) {
    return cleanString(value, { max: 120 }).replace(/[^a-zA-Z0-9_.:-]/g, '');
}

module.exports = {
    cleanArray,
    cleanEmail,
    cleanEnum,
    cleanId,
    cleanInteger,
    cleanNumber,
    cleanObject,
    cleanPhone,
    cleanString
};

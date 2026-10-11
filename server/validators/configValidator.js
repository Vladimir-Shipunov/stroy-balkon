/**
 * ============================================
 * BALCONY PRO - server-side configurator validation
 * ============================================
 * Validates a configurator selection against the real catalogue. The client
 * (src/pages/Configurator/vamCatalog.ts) has its own validation
 * (`normalizeVamSelection`) but that is advisory only — per план.txt §19 the
 * server must never trust client-only validation, so every mutating endpoint
 * (pricing, project create/update) runs this module first.
 *
 * The catalogue subset used here (server/data/balconyCatalog.json) is a
 * hand-generated mirror of src/pages/Configurator/{vamShapes.ts,planShapes.ts,
 * planGeometry.ts} — see that file's `$note`/`$todo` fields for exactly what is
 * and isn't covered (notably: per-hotspot option ids / colour indices from the
 * ~20000-line vamApp.generated.ts are NOT transcribed, so those are validated
 * permissively, not invented).
 *
 * Expected config shape (mirrors `VamSelection` in vamCatalog.ts):
 *   {
 *     shape: string,              // balcony model id, e.g. "sapozhok"
 *     glazing: string,            // glazing id of that model, e.g. "parapet"
 *     picks: {
 *       "<hotspotId>|<slotId>": { o: string, k: number }   // hotspotId always "P:..."
 *     }
 *   }
 */

const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, '../data/balconyCatalog.json');

let cachedCatalog = null;
function loadCatalog() {
    if (cachedCatalog) return cachedCatalog;
    const raw = fs.readFileSync(CATALOG_PATH, 'utf8');
    cachedCatalog = JSON.parse(raw);
    return cachedCatalog;
}

function findModel(catalog, shapeId) {
    return catalog.models.find((m) => m.id === shapeId) || null;
}

function findGlazing(model, glazingId) {
    return model.glazings.find((g) => g.id === glazingId) || null;
}

/**
 * Compatibility rules are admin-editable (table `compatibility_rules`,
 * scope = balcony_model_id). No row for a model = permissive, per the task spec
 * ("fall back to permissive if no rule row exists for that model yet").
 * `payload` is expected to be JSON like:
 *   { "disallow": [{ "glazing": "floor", "kind": "sill" }, ...] }
 * disallowing a (glazing, hotspot-kind) combination outright, or
 *   { "disallowOption": [{ "kind": "wall", "option": "parket" }] }
 * disallowing a specific finish option for a hotspot kind on this model.
 */
function loadCompatibilityRules(db, modelId) {
    if (!db || typeof db.db?.prepare !== 'function') return [];
    try {
        const rows = db.db.prepare(
            'SELECT rule_type, payload FROM compatibility_rules WHERE balcony_model_id = ?'
        ).all(modelId);
        return rows.map((row) => {
            try {
                return { ruleType: row.rule_type, payload: JSON.parse(row.payload) };
            } catch {
                return { ruleType: row.rule_type, payload: null };
            }
        });
    } catch {
        // Table may not exist yet on an older DB file mid-migration — permissive fallback.
        return [];
    }
}

function isDisallowedByRules(rules, glazingId, hotspotKind, optionId) {
    for (const rule of rules) {
        if (!rule.payload) continue;
        if (Array.isArray(rule.payload.disallow)) {
            for (const d of rule.payload.disallow) {
                if (d && d.glazing === glazingId && d.kind === hotspotKind) return true;
            }
        }
        if (Array.isArray(rule.payload.disallowOption)) {
            for (const d of rule.payload.disallowOption) {
                if (d && d.kind === hotspotKind && d.option === optionId) return true;
            }
        }
    }
    return false;
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Validate a configurator selection.
 * @param {*} config - the client-supplied config object (untrusted)
 * @param {{ db?: object }} [options] - optional DB handle (the app's BalconyDatabase
 *   instance) to look up compatibility_rules; omitted = permissive compatibility check.
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateConfig(config, options = {}) {
    const errors = [];

    if (!isPlainObject(config)) {
        return { valid: false, errors: ['config must be an object'] };
    }

    const catalog = loadCatalog();

    const shapeId = config.shape;
    if (typeof shapeId !== 'string' || !shapeId) {
        errors.push('shape is required');
        return { valid: false, errors };
    }

    const model = findModel(catalog, shapeId);
    if (!model) {
        errors.push(`unknown balcony model: ${shapeId}`);
        return { valid: false, errors };
    }

    const glazingId = config.glazing;
    if (typeof glazingId !== 'string' || !glazingId) {
        errors.push('glazing is required');
        return { valid: false, errors };
    }

    const glazing = findGlazing(model, glazingId);
    if (!glazing) {
        errors.push(`glazing "${glazingId}" is not available for model "${shapeId}"`);
        return { valid: false, errors };
    }

    // Fixed per-model dimensions: the catalogue has no adjustable sizing (every model
    // is one fixed shape), so a client that sends explicit dimensions must match them
    // exactly. Absent fields are fine (the configurator doesn't normally send these).
    const dimChecks = [
        ['widthMm', model.geometry.widthMm],
        ['depthMm', model.geometry.depthMm],
        ['ceilingHeightMm', model.geometry.ceilingHeightMm],
        ['parapetHeightMm', model.geometry.parapetHeightMm]
    ];
    for (const [field, range] of dimChecks) {
        const value = config[field];
        if (value === undefined || value === null) continue;
        if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
            errors.push(`${field} must be a positive number`);
            continue;
        }
        if (value < range.min || value > range.max) {
            errors.push(`${field} (${value}) is outside the allowed range [${range.min}, ${range.max}] for model "${shapeId}"`);
        }
    }

    // Picks — the catalogue subset here mirrors the real (single) hotspot list.
    const picks = config.picks;
    if (picks !== undefined && !isPlainObject(picks)) {
        errors.push('picks must be an object');
    } else if (isPlainObject(picks)) {
        const hotspotsById = new Map(glazing.hotspots.map((h) => [h.id, h]));
        const rules = loadCompatibilityRules(options.db, shapeId);

        for (const [key, pick] of Object.entries(picks)) {
            if (!isPlainObject(pick) || typeof pick.o !== 'string' || !pick.o || typeof pick.k !== 'number' || !Number.isInteger(pick.k) || pick.k < 0) {
                errors.push(`pick "${key}" must be { o: string, k: integer >= 0 }`);
                continue;
            }

            const sep = key.lastIndexOf('|');
            if (sep < 0) {
                errors.push(`pick key "${key}" must be "<hotspotId>|<slotId>"`);
                continue;
            }
            const hotspotId = key.slice(0, sep);
            const slotId = key.slice(sep + 1);

            // Every current hotspot id is prefixed "P:" (see vamPlanHotspots in
            // vamCatalog.ts). A saved config from before the single-page merge may still
            // carry leftover picks under the old "photo" mode's numeric app-screen ids —
            // silently skip those rather than failing the save over stale data.
            if (!hotspotId.startsWith('P:')) continue;

            const hotspot = hotspotsById.get(hotspotId);
            if (!hotspot) {
                errors.push(`hotspot "${hotspotId}" does not exist on model "${shapeId}" with glazing "${glazingId}"`);
                continue;
            }
            // Plan hotspots have exactly one slot, id "main" (see vamPlanHotspots in vamCatalog.ts).
            if (slotId !== 'main') {
                errors.push(`pick key "${key}": plan hotspots only have slot "main"`);
                continue;
            }

            // Finish-family membership: only known for wall/floor (see $todo in the catalogue
            // file for why ceiling/frame/etc. option ids can't be checked here).
            const family = catalog.finishFamilies[hotspot.kind];
            if (family && !family.includes(pick.o)) {
                errors.push(`option "${pick.o}" is not a known ${hotspot.kind} finish (expected one of: ${family.join(', ')})`);
            }

            if (isDisallowedByRules(rules, glazingId, hotspot.kind, pick.o)) {
                errors.push(`option "${pick.o}" on hotspot "${hotspotId}" is not compatible with model "${shapeId}"`);
            }
        }
    }

    return { valid: errors.length === 0, errors };
}

module.exports = { validateConfig, loadCatalog };

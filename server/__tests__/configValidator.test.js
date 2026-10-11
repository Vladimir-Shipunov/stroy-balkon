const test = require('node:test');
const assert = require('node:assert/strict');

const { validateConfig, loadCatalog } = require('../validators/configValidator');

const catalog = loadCatalog();
const sapozhok = catalog.models.find((m) => m.id === 'sapozhok');
assert.ok(sapozhok, 'fixture assumption: sapozhok must exist in balconyCatalog.json');

test('validateConfig: a config built from real catalog data is valid', () => {
    const { valid, errors } = validateConfig({
        shape: 'sapozhok',
        glazing: 'parapet',
        mode: 'plan',
        picks: {
            'P:w1|main': { o: 'laminat', k: 0 },
            'P:floor|main': { o: 'parket', k: 1 }
        }
    });
    assert.deepEqual(errors, []);
    assert.equal(valid, true);
});

test('validateConfig: unknown balcony model id is rejected', () => {
    const { valid, errors } = validateConfig({
        shape: 'definitely-not-a-model',
        glazing: 'parapet'
    });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => /unknown balcony model/.test(e)));
});

test('validateConfig: out-of-range dimension is rejected (план.txt §7 rule 10 — impossible parameter combinations)', () => {
    // sapozhok's widthMm range is fixed at exactly its real value (min === max,
    // per balconyCatalog.json — the catalogue has no adjustable sizing), so any
    // other explicit widthMm is out of range.
    const outOfRangeWidth = sapozhok.geometry.widthMm.max + 500;
    const { valid, errors } = validateConfig({
        shape: 'sapozhok',
        glazing: 'parapet',
        widthMm: outOfRangeWidth
    });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => /widthMm/.test(e) && /outside the allowed range/.test(e)));
});

test('validateConfig: unknown material/option id on a wall hotspot is rejected', () => {
    const { valid, errors } = validateConfig({
        shape: 'sapozhok',
        glazing: 'parapet',
        mode: 'plan',
        picks: {
            'P:w1|main': { o: 'definitely-not-a-material', k: 0 }
        }
    });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => /is not a known wall finish/.test(e)));
});

test('validateConfig: negative dimension is rejected (план.txt §7 rule 10 — no negative sizes)', () => {
    const { valid, errors } = validateConfig({
        shape: 'sapozhok',
        glazing: 'parapet',
        widthMm: -100
    });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => /widthMm/.test(e) && /positive number/.test(e)));
});

test('validateConfig: zero dimension is rejected (план.txt §7 rule 10 — no zero/impossible sizes)', () => {
    const { valid, errors } = validateConfig({
        shape: 'sapozhok',
        glazing: 'parapet',
        depthMm: 0
    });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => /depthMm/.test(e) && /positive number/.test(e)));
});

test('validateConfig: non-object config is rejected', () => {
    const { valid, errors } = validateConfig(null);
    assert.equal(valid, false);
    assert.ok(errors.length > 0);
});

test('validateConfig: unknown glazing for a known model is rejected', () => {
    const { valid, errors } = validateConfig({
        shape: 'sapozhok',
        glazing: 'not-a-real-glazing'
    });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => /is not available for model/.test(e)));
});

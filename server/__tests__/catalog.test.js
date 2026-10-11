const test = require('node:test');
const assert = require('node:assert/strict');

const { createTestServer } = require('./helpers/testServer');
const { loadCatalog } = require('../validators/configValidator');

test('catalog routes', async (t) => {
    const server = await createTestServer();
    t.after(() => server.close());

    const realCatalog = loadCatalog();
    const realModelIds = realCatalog.models.map((m) => m.id);

    await t.test('GET /api/catalog/models returns the real catalogue shapes', async () => {
        const res = await fetch(`${server.baseUrl}/api/catalog/models`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.success, true);
        assert.ok(Array.isArray(body.models));
        const ids = body.models.map((m) => m.id);
        assert.deepEqual(ids.sort(), realModelIds.slice().sort());
        assert.ok(body.typeLabels);
        assert.ok(body.glazingLabels);
    });

    await t.test('GET /api/catalog/models/:id returns a known model', async () => {
        const knownId = realModelIds[0];
        const res = await fetch(`${server.baseUrl}/api/catalog/models/${knownId}`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.success, true);
        assert.equal(body.model.id, knownId);
    });

    await t.test('GET /api/catalog/models/:id 404s for an unknown id', async () => {
        const res = await fetch(`${server.baseUrl}/api/catalog/models/not-a-real-model`);
        assert.equal(res.status, 404);
        const body = await res.json();
        assert.equal(body.success, false);
    });

    await t.test('GET /api/catalog/materials returns a sane shape', async () => {
        const res = await fetch(`${server.baseUrl}/api/catalog/materials`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.success, true);
        assert.ok(Array.isArray(body.materials));
    });

    await t.test('GET /api/catalog/params returns a sane shape', async () => {
        const res = await fetch(`${server.baseUrl}/api/catalog/params`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.success, true);
        assert.ok(Array.isArray(body.params));
        assert.equal(body.params.length, realModelIds.length);
        assert.ok(body.finishFamilies);
        assert.ok(body.hotspotKindLabels);

        const first = body.params[0];
        assert.ok(typeof first.id === 'string');
        assert.ok(first.geometry);
        assert.ok(Array.isArray(first.glazings));
    });
});

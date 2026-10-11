const test = require('node:test');
const assert = require('node:assert/strict');

const { createTestServer } = require('./helpers/testServer');

function validConfig() {
    return {
        shape: 'sapozhok',
        glazing: 'parapet',
        mode: 'plan',
        picks: {
            'P:w1|main': { o: 'laminat', k: 0 }
        }
    };
}

function invalidConfig() {
    // Unknown balcony model id — rejected by validateConfig at the very first check.
    return {
        shape: 'not-a-real-model',
        glazing: 'parapet',
        mode: 'plan'
    };
}

test('projects routes', async (t) => {
    const server = await createTestServer();
    t.after(() => server.close());

    await t.test('POST / with a valid config succeeds and returns an access token', async () => {
        const res = await fetch(`${server.baseUrl}/api/projects/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: validConfig() })
        });
        assert.equal(res.status, 201);
        const body = await res.json();
        assert.equal(body.success, true);
        assert.ok(body.id);
        assert.ok(body.accessToken);
    });

    await t.test('POST / with an invalid config returns 400 with errors', async () => {
        const res = await fetch(`${server.baseUrl}/api/projects/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: invalidConfig() })
        });
        assert.equal(res.status, 400);
        const body = await res.json();
        assert.equal(body.success, false);
        assert.ok(Array.isArray(body.errors));
        assert.ok(body.errors.length > 0);
    });

    await t.test('GET /:id with the right token returns the saved config', async () => {
        const createRes = await fetch(`${server.baseUrl}/api/projects/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: validConfig() })
        });
        const created = await createRes.json();

        const res = await fetch(
            `${server.baseUrl}/api/projects/${created.id}?token=${created.accessToken}`
        );
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.success, true);
        assert.equal(body.project.id, created.id);
        assert.equal(body.project.config.shape, 'sapozhok');
    });

    await t.test('GET /:id with a wrong token 404s identically to "not found"', async () => {
        const createRes = await fetch(`${server.baseUrl}/api/projects/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: validConfig() })
        });
        const created = await createRes.json();

        const wrongTokenRes = await fetch(
            `${server.baseUrl}/api/projects/${created.id}?token=wrong-token-value`
        );
        const missingProjectRes = await fetch(
            `${server.baseUrl}/api/projects/this-id-does-not-exist?token=${created.accessToken}`
        );
        const missingTokenRes = await fetch(`${server.baseUrl}/api/projects/${created.id}`);

        assert.equal(wrongTokenRes.status, 404);
        assert.equal(missingProjectRes.status, 404);
        assert.equal(missingTokenRes.status, 404);

        const [wrongTokenBody, missingProjectBody] = await Promise.all([
            wrongTokenRes.json(),
            missingProjectRes.json()
        ]);
        // Per the "no login system" design, a wrong token must be indistinguishable
        // from a missing project — same status and same error payload shape.
        assert.deepEqual(wrongTokenBody, missingProjectBody);
    });

    await t.test('PUT /:id updates and re-validates (valid update succeeds)', async () => {
        const createRes = await fetch(`${server.baseUrl}/api/projects/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: validConfig() })
        });
        const created = await createRes.json();

        const updatedConfig = { ...validConfig(), glazing: 'floor', picks: {} };
        const putRes = await fetch(`${server.baseUrl}/api/projects/${created.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-Project-Token': created.editToken },
            body: JSON.stringify({ config: updatedConfig })
        });
        assert.equal(putRes.status, 200);
        const putBody = await putRes.json();
        assert.equal(putBody.success, true);
        assert.equal(putBody.project.config.glazing, 'floor');
        assert.equal(putBody.project.configVersion, 2);
    });

    await t.test('PUT /:id with a now-invalid config is rejected, not silently saved', async () => {
        const createRes = await fetch(`${server.baseUrl}/api/projects/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: validConfig() })
        });
        const created = await createRes.json();

        const putRes = await fetch(`${server.baseUrl}/api/projects/${created.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-Project-Token': created.editToken },
            body: JSON.stringify({ config: invalidConfig() })
        });
        assert.equal(putRes.status, 400);
        const putBody = await putRes.json();
        assert.equal(putBody.success, false);
        assert.ok(Array.isArray(putBody.errors));

        // Confirm the original config is still there — the bad PUT was not persisted.
        const getRes = await fetch(
            `${server.baseUrl}/api/projects/${created.id}?token=${created.accessToken}`
        );
        const getBody = await getRes.json();
        assert.equal(getBody.project.config.shape, 'sapozhok');
        assert.equal(getBody.project.configVersion, 1);
    });

    await t.test('accessToken (read-only) alone cannot PUT — only editToken can', async () => {
        const createRes = await fetch(`${server.baseUrl}/api/projects/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: validConfig() })
        });
        const created = await createRes.json();
        assert.ok(created.editToken);
        assert.notEqual(created.accessToken, created.editToken);

        const putRes = await fetch(`${server.baseUrl}/api/projects/${created.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-Project-Token': created.accessToken },
            body: JSON.stringify({ config: { ...validConfig(), glazing: 'floor' } })
        });
        assert.equal(putRes.status, 404);

        // Confirm it really wasn't saved.
        const getRes = await fetch(
            `${server.baseUrl}/api/projects/${created.id}?token=${created.accessToken}`
        );
        const getBody = await getRes.json();
        assert.equal(getBody.project.config.glazing, 'parapet');
    });
});

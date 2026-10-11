/**
 * Test-only helper: builds a minimal Express app wiring up just the routers
 * under test (catalog, projects) against a throwaway temp-file SQLite DB.
 *
 * Deliberately does NOT require server/server.js — that file calls
 * app.listen() unconditionally at module load (binding the real PORT) and
 * wires up unrelated subsystems (orders, pricing, AI chat, uploads) that are
 * out of scope here and owned by other concurrent sessions. Mounting just
 * catalog.js + projects.js against a fresh BalconyDatabase gives the same
 * route behaviour under test without any of that.
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');

const BalconyDatabase = require('../../config/database');
const createCatalogRouter = require('../../routes/catalog');
const createProjectsRouter = require('../../routes/projects');

function createTestServer() {
    const tmpPath = path.join(
        os.tmpdir(),
        `balcony-test-${crypto.randomBytes(8).toString('hex')}.db`
    );

    const db = new BalconyDatabase(tmpPath);
    db.initialize();

    const app = express();
    app.use(express.json());
    app.use('/api/catalog', createCatalogRouter({ db }));
    app.use('/api/projects', createProjectsRouter({ db }));

    return new Promise((resolve, reject) => {
        const server = app.listen(0, () => {
            const { port } = server.address();
            resolve({
                baseUrl: `http://127.0.0.1:${port}`,
                db,
                async close() {
                    await new Promise((res) => server.close(res));
                    db.close();
                    for (const suffix of ['', '-wal', '-shm']) {
                        try {
                            fs.unlinkSync(tmpPath + suffix);
                        } catch {
                            // already gone — fine
                        }
                    }
                }
            });
        });
        server.on('error', reject);
    });
}

module.exports = { createTestServer };

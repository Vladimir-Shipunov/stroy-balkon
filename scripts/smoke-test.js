const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const targets = ['server', path.join('public', 'js')];

function collectJsFiles(dir) {
    const absolute = path.join(root, dir);
    if (!fs.existsSync(absolute)) return [];

    return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(absolute, entry.name);
        const relative = path.relative(root, fullPath);
        if (entry.isDirectory()) return collectJsFiles(relative);
        return entry.isFile() && entry.name.endsWith('.js') ? [relative] : [];
    });
}

const files = targets.flatMap(collectJsFiles);
const serviceWorker = path.join('public', 'sw.js');
if (fs.existsSync(path.join(root, serviceWorker))) {
    files.push(serviceWorker);
}

files.forEach((file) => {
    execFileSync(process.execPath, ['--check', path.join(root, file)], {
        stdio: 'inherit'
    });
});

console.log(`Smoke test passed: checked ${files.length} JavaScript files.`);

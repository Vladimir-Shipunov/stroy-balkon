const fs = require('fs');
const path = require('path');
const util = require('util');

const logDir = path.join(process.cwd(), 'logs');
const logFile = path.join(logDir, 'app.log');

function ensureLogDir() {
    try {
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    } catch (error) {
        console.error('Failed to create log directory:', error);
    }
}

function serializeError(error) {
    if (!error) return null;
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code: error.code,
            status: error.status || error.statusCode
        };
    }
    return error;
}

function write(level, message, context = {}) {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...context
    };

    const output = JSON.stringify(entry);
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[consoleMethod](message, Object.keys(context).length ? util.inspect(context, { depth: 4 }) : '');

    ensureLogDir();
    fs.promises.appendFile(logFile, `${output}\n`).catch((error) => {
        console.error('Failed to write application log:', error);
    });
}

module.exports = {
    info(message, context) {
        write('info', message, context);
    },
    warn(message, context) {
        write('warn', message, context);
    },
    error(message, error, context = {}) {
        write('error', message, {
            ...context,
            error: serializeError(error)
        });
    },
    serializeError
};

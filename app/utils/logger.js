const APP_NAME = 'NBL';

const isDev = process.env.NODE_ENV !== 'production';
const LOG_LEVEL = process.env.LOG_LEVEL || (isDev ? 'debug' : 'warn');

const LEVELS = {
    debug: 10,
    info: 20,
    success: 25,
    warn: 30,
    error: 40
};

const EMOJIS = {
    debug: '🔍',
    info: 'ℹ️',
    success: '✅',
    warn: '⚠️',
    error: '❌'
};

// ---------------------------
// Utils
// ---------------------------
const shouldLog = (level) =>
    LEVELS[level] >= LEVELS[LOG_LEVEL];

const parseShop = (args) => {
    // Only treat first arg as shop if it's a non-empty string containing myshopify.com
    // null / undefined / non-shop strings fall through to message
    if (args[0] && typeof args[0] === 'string' && args[0].includes('myshopify.com')) {
        return { shop: args[0], rest: args.slice(1) };
    }
    // Skip null/undefined first arg so it doesn't consume the message slot
    if (args[0] === null || args[0] === undefined) {
        return { shop: null, rest: args.slice(1) };
    }
    return { shop: null, rest: args };
};

/**
 * Extracts a compact, readable location from an Error stack.
 * Returns the first app-code frame — skips node_modules and node internals.
 *
 * Example output: "redeemReward (api.get-reward-voucher.jsx:144)"
 *
 * Falls back to the raw second line if no app frame is found.
 */
const compactStack = (stack) => {
    if (!stack) return undefined;
    const lines = stack.split('\n').slice(1); // skip "Error: message" line
    const appFrame = lines.find(
        (l) => l.includes('/app/') && !l.includes('node_modules')
    );
    const raw = appFrame || lines[0] || '';
    // Strip leading whitespace and "at " prefix, keep just "fn (file:line)"
    return raw.replace(/^\s+at\s+/, '').trim();
};

const normalizeExtras = (extras) => {
    return extras.reduce((acc, item, i) => {
        if (item instanceof Error) {
            acc.error = item.message;
            // Dev: compact single-line location instead of full stack dump
            // Prod: omit stack entirely — use external error tracking (e.g. Sentry)
            if (isDev) acc.at = compactStack(item.stack);
        } else if (typeof item === 'object' && item !== null) {
            // If caller passed { error, stack } manually, compact the stack
            const { stack, ...rest } = item;
            Object.assign(acc, rest);
            if (stack && isDev) acc.at = compactStack(stack);
        } else {
            acc[`extra${i + 1}`] = item;
        }
        return acc;
    }, {});
};

// ---------------------------
// Core Logger
// ---------------------------
function logMessage(level, ...args) {
    if (!shouldLog(level)) return;

    const { shop, rest } = parseShop(args);
    const message = rest[0] || '(no message)';
    const extras = normalizeExtras(rest.slice(1));

    const payload = {
        app: APP_NAME,
        level,
        time: new Date().toISOString(),
        shop,
        message,
        ...extras
    };

    // 👉 Dev = pretty log
    if (isDev) {
        const emoji = EMOJIS[level] || '→';
        console[level === 'error' ? 'error' : 'log'](
            `## [${APP_NAME}] ${emoji} [${level.toUpperCase()}] ${shop ? `[${shop}] ` : ''}${message}`
        );

        if (Object.keys(extras).length) {
            console.log(extras);
        }
    }

    // 👉 Prod = structured JSON (VERY IMPORTANT)
    else {
        const method =
            level === 'error' ? 'error' :
                level === 'warn' ? 'warn' :
                    'log';

        console[method](JSON.stringify(payload));
    }
}

// ---------------------------
// Export
// ---------------------------
export const logger = {
    debug: (...a) => logMessage('debug', ...a),
    info: (...a) => logMessage('info', ...a),
    success: (...a) => logMessage('success', ...a),
    warn: (...a) => logMessage('warn', ...a),
    error: (...a) => logMessage('error', ...a)
};
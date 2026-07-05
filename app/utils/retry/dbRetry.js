import { withRetry } from './withRetry.js';

export const dbRetry = (fn, context = {}) => {
    return withRetry(fn, {
        retryableErrors: [
            "ECONNRESET",
            "ETIMEDOUT",
            "deadlock",
            "timeout"
        ],
        context: {
            ...context,
            layer: "database"
        }
    });
};
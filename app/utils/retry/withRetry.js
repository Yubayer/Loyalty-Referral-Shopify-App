import { RETRY_CONFIG } from './retryConfig.js';
import { logger } from '../logger.js';

export const withRetry = async (fn, options = {}) => {
    const config = { ...RETRY_CONFIG, ...options };

    const {
        maxAttempts,
        baseDelayMs,
        backoffFactor,
        maxDelayMs,
        jitterFactor,
        retryableErrors,
        context = {}
    } = config;

    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const result = await fn();

            // ✅ success after retry — log recovery
            if (attempt > 1) {
                logger.success(
                    context.shop,
                    `Recovered on attempt ${attempt}/${maxAttempts}`,
                    { attempt, maxAttempts, ...context }
                );
            }

            return result;

        } catch (error) {
            lastError = error;
            const message = error?.message || 'Unknown error';

            // ❌ skip retry if error is not in retryableErrors list
            // retryableErrors entries can be strings (message.includes check)
            // or constructors/classes (instanceof check)
            if (
                retryableErrors.length &&
                !retryableErrors.some(e =>
                    typeof e === 'string'
                        ? message.toLowerCase().includes(e.toLowerCase())
                        : (typeof e === 'function' && error instanceof e)
                )
            ) {
                logger.error(
                    context.shop,
                    `Non-retryable error — aborting`,
                    { attempt, maxAttempts, error: message, ...context }
                );
                throw error;
            }

            // ❌ last attempt exhausted → throw
            if (attempt === maxAttempts) {
                logger.error(
                    context.shop,
                    `All ${maxAttempts} attempts failed`,
                    { attempt, maxAttempts, error: message, ...context }
                );
                throw error;
            }

            // ⏳ calculate delay with exponential backoff + jitter
            let delay = baseDelayMs * (backoffFactor ** (attempt - 1));
            delay = Math.min(delay, maxDelayMs);
            if (jitterFactor) {
                delay += Math.random() * delay * jitterFactor;
            }

            logger.warn(
                context.shop,
                `Attempt ${attempt}/${maxAttempts} failed — retrying in ${Math.round(delay)}ms`,
                { attempt, maxAttempts, error: message, delayMs: Math.round(delay), ...context }
            );

            await new Promise(res => setTimeout(res, delay));
        }
    }

    throw lastError; // fallback safety
};
export const RETRY_CONFIG = {
    // 🔁 Total attempts (1 initial + retries)
    maxAttempts: 4,

    // ⏳ Balanced delay (slightly higher than 1s for production safety)
    baseDelayMs: 1200,

    // 📈 Exponential backoff (1.2s → 2.4s → 4.8s → 9.6s)
    backoffFactor: 2,

    // ⛔ Max delay cap (avoid too long wait)
    maxDelayMs: 30000, // 30s

    // 🎲 Small jitter to avoid retry spikes
    jitterFactor: 0.3,

    // ⚠️ Retry all by default (can override per use-case)
    retryableErrors: [],

    // 🧠 Default context (auto used in logger)
    context: {
        app: "NBL"
    }
};
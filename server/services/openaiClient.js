import OpenAI from 'openai';
import config from '../config/env.js';

const rawClient = new OpenAI({
    apiKey: config.openai.apiKey,
});

const queue = [];
let activeCount = 0;
let lastStartAt = 0;

const {
    maxConcurrency,
    minIntervalMs,
    maxRetries,
    retryInitialDelayMs,
} = config.openai;

function schedule(task) {
    return new Promise((resolve, reject) => {
        queue.push({ task, resolve, reject });
        processQueue();
    });
}

function processQueue() {
    if (activeCount >= Math.max(1, maxConcurrency)) {
        return;
    }

    const job = queue.shift();
    if (!job) {
        return;
    }

    const delay = Math.max(0, (minIntervalMs || 0) - (Date.now() - lastStartAt));

    activeCount += 1;

    const runJob = () => {
        lastStartAt = Date.now();

        Promise.resolve()
            .then(() => job.task())
            .then(result => job.resolve(result))
            .catch(error => job.reject(error))
            .finally(() => {
                activeCount -= 1;
                processQueue();
            });
    };

    if (delay > 0) {
        setTimeout(runJob, delay);
    } else {
        runJob();
    }
}

async function wait(ms) {
    if (!ms || ms <= 0) {
        return;
    }

    await new Promise(resolve => setTimeout(resolve, ms));
}

async function executeWithRetry(task, attempt = 1) {
    try {
        return await task();
    } catch (error) {
        const status = error?.status || error?.response?.status;

        if (attempt >= Math.max(1, maxRetries || 1)) {
            if (status === 429) {
                error.code = error.code || 'openai_rate_limited';
            }
            throw error;
        }

        const retryAfterHeader = error?.response?.headers?.['retry-after']
            || error?.headers?.['retry-after'];
        const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;

        let delay = Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : null;

        if (!delay) {
            const baseDelay = Math.max(200, retryInitialDelayMs || 1000);
            const jitter = Math.random() * 200;
            delay = Math.min(baseDelay * (2 ** (attempt - 1)) + jitter, 30_000);
        }

        if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
            await wait(delay);
            return executeWithRetry(task, attempt + 1);
        }

        throw error;
    }
}

const chatProxy = new Proxy(rawClient.chat, {
    get(target, prop, receiver) {
        if (prop === 'completions') {
            return new Proxy(target.completions, {
                get(completionsTarget, completionsProp) {
                    if (completionsProp === 'create') {
                        const original = completionsTarget.create.bind(completionsTarget);
                        return (params) => schedule(() => executeWithRetry(() => original(params)));
                    }

                    return Reflect.get(completionsTarget, completionsProp);
                },
            });
        }

        return Reflect.get(target, prop, receiver);
    },
});

const openai = new Proxy(rawClient, {
    get(target, prop, receiver) {
        if (prop === 'chat') {
            return chatProxy;
        }

        return Reflect.get(target, prop, receiver);
    },
});

export default openai;

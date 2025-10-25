import OpenAI from 'openai';
import config from '../../config/env.js';

const baseClientOptions = {
    baseURL: config.openai.baseUrl || 'https://api.openai.com/v1',
};

if (config.openai.organization) {
    baseClientOptions.organization = config.openai.organization;
}

if (config.openai.project) {
    baseClientOptions.project = config.openai.project;
}

const apiKeys = config.openai.apiKeys.length ? config.openai.apiKeys : [config.openai.apiKey];
const clients = apiKeys.filter(Boolean).map(apiKey => new OpenAI({ ...baseClientOptions, apiKey }));

let clientIndex = 0;

const queue = [];
let activeCount = 0;
let lastStartAt = 0;

const {
    maxConcurrency,
    minIntervalMs,
    maxRetries,
    retryInitialDelayMs,
    cacheTtlMs,
} = config.openai;

const cacheEnabled = (cacheTtlMs || 0) > 0;
const cache = cacheEnabled ? new Map() : null;
const inFlight = cacheEnabled ? new Map() : null;

function hasClient() {
    return clients.length > 0;
}

function getClient() {
    if (!hasClient()) {
        throw new Error('openai_client_unavailable');
    }
    return clients[clientIndex];
}

function rotateClient() {
    if (clients.length <= 1) {
        return;
    }

    clientIndex = (clientIndex + 1) % clients.length;
    const activeKey = apiKeys[clientIndex];
    console.warn(`OpenAI client rotated. Active key index: ${clientIndex} (${maskKey(activeKey)})`);
}

function schedule(task) {
    return new Promise((resolve, reject) => {
        queue.push({ task, resolve, reject });
        processQueue();
    });
}

function processQueue() {
    if (activeCount >= Math.max(1, maxConcurrency || 1)) {
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

async function wait(delayMs) {
    if (!delayMs || delayMs <= 0) {
        return;
    }

    await new Promise(resolve => setTimeout(resolve, delayMs));
}

function calculateRetryDelay(error, attempt) {
    const retryAfterHeader = error?.response?.headers?.['retry-after']
        || error?.headers?.['retry-after'];
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;

    if (Number.isFinite(retryAfterSeconds)) {
        return retryAfterSeconds * 1000;
    }

    const baseDelay = Math.max(200, retryInitialDelayMs || 1000);
    const jitter = Math.random() * 200;
    return Math.min(baseDelay * (2 ** (attempt - 1)) + jitter, 30_000);
}

async function executeWithRetry(task, attempt = 1) {
    try {
        return await task(getClient());
    } catch (error) {
        const status = error?.status || error?.response?.status;
        const retriableStatuses = new Set([429, 500, 502, 503, 504]);
        const rotateStatuses = new Set([401, 403, 429]);

        if (rotateStatuses.has(status)) {
            rotateClient();
        }

        if (attempt >= Math.max(1, maxRetries || 1)) {
            if (status === 429) {
                error.code = error.code || 'openai_rate_limited';
            }
            throw error;
        }

        if (retriableStatuses.has(status)) {
            await wait(calculateRetryDelay(error, attempt));
            return executeWithRetry(task, attempt + 1);
        }

        if (rotateStatuses.has(status) && clients.length > 1) {
            return executeWithRetry(task, attempt + 1);
        }

        throw error;
    }
}

function getCacheKey(params) {
    if (!cacheEnabled) {
        return null;
    }

    try {
        return JSON.stringify(params);
    } catch (error) {
        return null;
    }
}

function getCachedValue(key) {
    if (!cacheEnabled || !key) {
        return null;
    }

    const entry = cache.get(key);
    if (!entry) {
        return null;
    }

    if (entry.expires <= Date.now()) {
        cache.delete(key);
        return null;
    }

    return cloneResponse(entry.value);
}

function setCachedValue(key, value) {
    if (!cacheEnabled || !key) {
        return;
    }

    cache.set(key, {
        value: cloneResponse(value),
        expires: Date.now() + cacheTtlMs,
    });
}

function cloneResponse(payload) {
    if (typeof structuredClone === 'function') {
        return structuredClone(payload);
    }

    return JSON.parse(JSON.stringify(payload));
}

function callModel(client, params) {
    const model = params?.model || config.openai.model;
    const resolvedParams = { ...params, model };

    if (shouldUseResponsesApi(model)) {
        const responseParams = convertToResponseParams(resolvedParams);
        return client.responses.create(responseParams).then(normalizeResponsePayload);
    }

    return client.chat.completions.create(resolvedParams);
}

function shouldUseResponsesApi(model) {
    if (!model) {
        return false;
    }
    return /^gpt-5/i.test(model) || /^gpt-4\.1/i.test(model) || /^o1/i.test(model) || /^o3/i.test(model);
}

function convertToResponseParams(params) {
    const {
        messages,
        prompt,
        max_tokens,
        temperature,
        top_p,
        n,
        stop,
        response_format,
        tools,
        ...rest
    } = params || {};

    const input = buildResponseInput({ messages, prompt });
    const payload = {
        ...rest,
        input,
    };

    if (typeof max_tokens === 'number') {
        payload.max_output_tokens = max_tokens;
    }
    if (typeof temperature === 'number') {
        payload.temperature = temperature;
    }
    if (typeof top_p === 'number') {
        payload.top_p = top_p;
    }
    if (Array.isArray(stop) && stop.length) {
        payload.stop_sequences = stop;
    }
    if (typeof n === 'number' && n > 1) {
        payload.num_responses = n;
    }
    if (response_format && response_format.type === 'json_object') {
        payload.response_format = { type: 'json_object' };
    }
    if (Array.isArray(tools) && tools.length) {
        payload.tools = tools;
    }

    return payload;
}

function buildResponseInput({ messages, prompt }) {
    if (Array.isArray(messages) && messages.length) {
        return messages.map(message => normalizeResponseMessage(message));
    }

    if (typeof prompt === 'string' && prompt.trim()) {
        return [
            {
                role: 'user',
                content: [{ type: 'text', text: prompt.trim() }],
            },
        ];
    }

    return [
        {
            role: 'user',
            content: [{ type: 'text', text: '' }],
        },
    ];
}

function normalizeResponseMessage(message) {
    if (!message) {
        return {
            role: 'user',
            content: [{ type: 'text', text: '' }],
        };
    }

    const role = message.role || 'user';
    if (Array.isArray(message.content)) {
        return {
            role,
            content: message.content.map(normalizeResponseContent).filter(Boolean),
        };
    }

    if (typeof message.content === 'string') {
        return {
            role,
            content: [{ type: 'text', text: message.content }],
        };
    }

    return {
        role,
        content: [{ type: 'text', text: JSON.stringify(message.content) }],
    };
}

function normalizeResponseContent(content) {
    if (!content) {
        return null;
    }

    if (typeof content === 'string') {
        return { type: 'text', text: content };
    }

    if (content.type === 'text' && typeof content.text === 'string') {
        return { type: 'text', text: content.text };
    }

    if (content.type === 'input_text' && typeof content.text === 'string') {
        return { type: 'text', text: content.text };
    }

    return { type: 'text', text: JSON.stringify(content) };
}

function normalizeResponsePayload(response) {
    if (!response) {
        return response;
    }

    const messageContent = extractTextFromResponseOutput(response.output);
    const choice = {
        index: 0,
        message: {
            role: 'assistant',
            content: messageContent,
        },
        finish_reason: response.stop_reason || 'stop',
    };

    return {
        id: response.id,
        choices: [choice],
        model: response.model,
        usage: response.usage,
        response,
    };
}

function extractTextFromResponseOutput(output) {
    if (!Array.isArray(output) || output.length === 0) {
        return '';
    }

    const texts = [];
    for (const item of output) {
        if (!item) {
            continue;
        }
        const segments = Array.isArray(item.content) ? item.content : [];
        for (const segment of segments) {
            if (segment?.type === 'output_text' && typeof segment.text === 'string') {
                texts.push(segment.text);
            } else if (segment?.type === 'text' && typeof segment.text === 'string') {
                texts.push(segment.text);
            } else if (typeof segment === 'string') {
                texts.push(segment);
            }
        }
    }

    return texts.join('');
}

function requestChatCompletion(params) {
    if (!cacheEnabled || params?.stream) {
        return schedule(() => executeWithRetry(client => callModel(client, params)));
    }

    const key = getCacheKey(params);
    if (!key) {
        return schedule(() => executeWithRetry(client => callModel(client, params)));
    }

    const cached = getCachedValue(key);
    if (cached) {
        return Promise.resolve(cached);
    }

    if (inFlight.has(key)) {
        return inFlight.get(key).then(cloneResponse);
    }

    const execPromise = schedule(() => executeWithRetry(client => callModel(client, params)));

    const wrapped = execPromise
        .then(result => {
            setCachedValue(key, result);
            inFlight.delete(key);
            return cloneResponse(result);
        })
        .catch(error => {
            inFlight.delete(key);
            throw error;
        });

    inFlight.set(key, wrapped);
    return wrapped;
}

export async function createChatCompletion(params) {
    if (!hasClient()) {
        const error = new Error('openai_client_unavailable');
        error.code = 'openai_client_unavailable';
        throw error;
    }

    return requestChatCompletion(params);
}

export function isConfigured() {
    return hasClient();
}

export default {
    createChatCompletion,
    isConfigured,
};

function maskKey(key) {
    if (!key || key.length < 8) {
        return '***';
    }

    const prefix = key.slice(0, 6);
    const suffix = key.slice(-4);
    return `${prefix}…${suffix}`;
}

import config from '../../config/env.js';

const BASE_URL = (config.deepseek.baseUrl || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
const DEFAULT_MODEL = config.deepseek.model || 'deepseek-chat';

export function isConfigured() {
    return Boolean(config.deepseek.apiKey);
}

export async function createChatCompletion(params = {}) {
    if (!config.deepseek.apiKey) {
        const error = new Error('deepseek_api_key_missing');
        error.code = 'deepseek_api_key_missing';
        throw error;
    }

    const payload = buildPayload(params);
    const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.deepseek.apiKey}`,
        },
        body: JSON.stringify(payload),
    });

    const text = await response.text();

    let json;
    try {
        json = text ? JSON.parse(text) : null;
    } catch (error) {
        const parseError = new Error('deepseek_invalid_response');
        parseError.code = 'deepseek_invalid_response';
        parseError.cause = error;
        parseError.raw = text;
        throw parseError;
    }

    if (!response.ok) {
        const error = new Error(json?.error?.message || 'DeepSeek API error');
        error.code = json?.error?.code || 'deepseek_api_error';
        error.status = response.status;
        error.details = json?.error;
        throw error;
    }

    return json;
}

function buildPayload(params) {
    const {
        messages,
        temperature,
        top_p,
        max_tokens,
        stop,
        stream,
        ...rest
    } = params;

    const payload = {
        model: rest.model || DEFAULT_MODEL,
        messages: Array.isArray(messages) && messages.length ? messages : [{ role: 'user', content: 'Hello' }],
        temperature: typeof temperature === 'number' ? temperature : 0.7,
        stream: Boolean(stream),
        ...rest,
    };

    if (typeof top_p === 'number') {
        payload.top_p = top_p;
    }

    if (typeof max_tokens === 'number') {
        payload.max_tokens = max_tokens;
    }

    if (Array.isArray(stop) && stop.length) {
        payload.stop = stop;
    }

    return payload;
}

export default {
    createChatCompletion,
    isConfigured,
};

import config from '../config/env.js';
import openaiProvider from './providers/openaiProvider.js';
import deepseekProvider from './providers/deepseekProvider.js';

const PROVIDER_METADATA = {
    openai: {
        id: 'openai',
        label: 'OpenAI GPT-5',
        description: 'Использует модели OpenAI (нужен актуальный ключ и квоты).',
        requiresKey: true,
    },
    deepseek: {
        id: 'deepseek',
        label: 'DeepSeek Chat',
        description: 'Бесплатный API DeepSeek (нужен ключ, но есть базовые лимиты).',
        requiresKey: true,
    },
    local: {
        id: 'local',
        label: 'Локальный режим',
        description: 'Ответы строятся по встроенным правилам без внешнего ИИ.',
        requiresKey: false,
    },
};

const PROVIDER_HANDLERS = {
    openai: openaiProvider,
    deepseek: deepseekProvider,
};

export function getProviderCatalog() {
    return config.ai.allowedProviders.map(providerId => {
        const meta = PROVIDER_METADATA[providerId] || { id: providerId, label: providerId };
        const availability = determineAvailability(providerId);
        return {
            id: providerId,
            label: meta.label || providerId,
            description: meta.description || '',
            requires_key: Boolean(meta.requiresKey),
            available: availability.available,
            status: availability.status,
            status_message: availability.message,
            default: providerId === config.ai.defaultProvider,
        };
    });
}

export function resolveProvider({ profile, preferred, allowLocal = true } = {}) {
    const candidates = getCandidateProviders({ profile, preferred, allowLocal });
    const provider = candidates.find(id => id !== 'local')
        || (allowLocal ? candidates.find(id => id === 'local') : null)
        || null;

    if (!provider) {
        return { provider: null, availability: { available: false, status: 'unavailable' } };
    }

    return { provider, availability: determineAvailability(provider) };
}

function getCandidateProviders({ profile, preferred, allowLocal = true } = {}) {
    const allowed = config.ai.allowedProviders;
    const sanitizedPreferred = sanitizeProvider(preferred, allowed);
    const profilePreferred = sanitizeProvider(profile?.preferences?.ai_provider, allowed);

    const order = [
        sanitizedPreferred,
        profilePreferred,
        config.ai.defaultProvider,
        ...allowed,
    ].filter(Boolean);

    const unique = [];
    for (const id of order) {
        if (!allowed.includes(id)) {
            continue;
        }
        if (!allowLocal && id === 'local') {
            continue;
        }
        if (!unique.includes(id)) {
            unique.push(id);
        }
    }

    if (allowLocal && allowed.includes('local') && !unique.includes('local')) {
        unique.push('local');
    }

    return unique;
}

export async function createChatCompletion(params, options = {}) {
    const allowLocal = options.allowLocal !== false;
    const candidates = getCandidateProviders({
        profile: options.profile,
        preferred: options.provider,
        allowLocal,
    });

    if (!candidates.length) {
        const error = new Error('Нет доступного AI-провайдера');
        error.code = 'llm_provider_unavailable';
        throw error;
    }

    const attempted = [];
    for (const providerId of candidates) {
        if (providerId === 'local') {
            continue;
        }

        const handler = PROVIDER_HANDLERS[providerId];
        if (!handler || typeof handler.createChatCompletion !== 'function') {
            continue;
        }

        attempted.push(providerId);
        try {
            const response = await handler.createChatCompletion(params);
            if (response && typeof response === 'object') {
                response._provider = providerId;
            }
            return response;
        } catch (error) {
            if (!isRecoverableError(error)) {
                throw error;
            }
            console.warn(`Provider ${providerId} failed with recoverable error: ${error.code || error.message}`);
        }
    }

    if (allowLocal && candidates.includes('local')) {
        const error = new Error('Включён локальный режим без внешнего ИИ');
        error.code = 'llm_provider_local';
        throw error;
    }

    const error = new Error(`Все AI-провайдеры недоступны (${attempted.join(', ') || 'none'})`);
    error.code = 'llm_provider_unavailable';
    throw error;
}

export function providerAvailable(providerId) {
    return determineAvailability(providerId).available;
}

function sanitizeProvider(providerId, allowed) {
    if (!providerId || typeof providerId !== 'string') {
        return null;
    }
    const candidate = providerId.trim().toLowerCase();
    return allowed.includes(candidate) ? candidate : null;
}

function determineAvailability(providerId) {
    switch (providerId) {
    case 'openai':
        return openaiProvider.isConfigured()
            ? { available: true, status: 'configured' }
            : { available: false, status: 'missing_key', message: 'Не указан ключ OpenAI' };
    case 'deepseek':
        return deepseekProvider.isConfigured()
            ? { available: true, status: 'configured' }
            : { available: false, status: 'missing_key', message: 'Не указан ключ DeepSeek' };
    case 'local':
        return { available: true, status: 'local' };
    default:
        return { available: false, status: 'unknown', message: 'Провайдер не поддерживается' };
    }
}

export default {
    createChatCompletion,
    resolveProvider,
    getProviderCatalog,
    providerAvailable,
};

function isRecoverableError(error) {
    if (!error) {
        return false;
    }

    const code = (error.code || '').toLowerCase();
    if (['insufficient_quota', 'openai_rate_limited', 'rate_limit_exceeded', 'quota_exceeded', 'deepseek_api_error'].includes(code)) {
        return true;
    }

    const status = error.status ?? error?.response?.status;
    if (status === 401 || status === 403 || status === 429 || status === 500 || status === 503) {
        return true;
    }

    return false;
}

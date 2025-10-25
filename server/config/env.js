import dotenv from 'dotenv';

dotenv.config();

function parseList(value, fallback = []) {
    if (!value) {
        return [...fallback];
    }

    return value
        .split(',')
        .map(item => item.trim().toLowerCase())
        .filter(Boolean);
}

export const config = {
    telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
        allowedUserIds: (process.env.TELEGRAM_ALLOWED_IDS || '')
            .split(',')
            .map(value => value.trim())
            .filter(Boolean),
    },
    ai: {
        defaultProvider: (process.env.AI_DEFAULT_PROVIDER || 'openai').trim().toLowerCase() || 'openai',
        allowedProviders: parseList(process.env.AI_ALLOWED_PROVIDERS, ['openai', 'deepseek', 'local']),
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY?.trim() || null,
        apiKeys: [
            ...(process.env.OPENAI_API_KEYS
                ? process.env.OPENAI_API_KEYS.split(',').map(value => value.trim()).filter(Boolean)
                : []),
        ],
        baseUrl: process.env.OPENAI_API_BASE_URL?.trim() || null,
        organization: process.env.OPENAI_ORG?.trim() || null,
        project: process.env.OPENAI_PROJECT?.trim() || null,
        model: process.env.OPENAI_MODEL || 'gpt-5',
        maxConcurrency: parseInt(process.env.OPENAI_MAX_CONCURRENCY || '1', 10),
        minIntervalMs: parseInt(process.env.OPENAI_MIN_INTERVAL_MS || '800', 10),
        maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3', 10),
        retryInitialDelayMs: parseInt(process.env.OPENAI_RETRY_INITIAL_DELAY_MS || '1000', 10),
        cacheTtlMs: parseInt(process.env.OPENAI_CACHE_TTL_MS || '120000', 10),
    },
    deepseek: {
        apiKey: process.env.DEEPSEEK_API_KEY?.trim() || null,
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        baseUrl: process.env.DEEPSEEK_API_BASE_URL?.trim() || 'https://api.deepseek.com/v1',
    },
    supabase: {
        url: process.env.SUPABASE_URL,
        anonKey: process.env.SUPABASE_ANON_KEY,
        serviceKey: process.env.SUPABASE_SERVICE_KEY,
    },
    app: {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: parseInt(process.env.PORT || '3000', 10),
        host: process.env.HOST || '0.0.0.0',
        webAppUrl: process.env.WEBAPP_URL || null,
    },
    security: {
        encryptionSecret: process.env.ENCRYPTION_SECRET,
        jwtSecret: process.env.JWT_SECRET,
    },
};

const normalizedOpenAiKeys = [
    ...(config.openai.apiKey ? [config.openai.apiKey] : []),
    ...config.openai.apiKeys,
].filter(Boolean);

config.openai.apiKeys = [...new Set(normalizedOpenAiKeys)];
config.openai.apiKey = config.openai.apiKeys[0] || null;
config.openai.cacheTtlMs = Number.isFinite(config.openai.cacheTtlMs)
    ? Math.max(0, config.openai.cacheTtlMs)
    : 0;

if (config.openai.project && !config.openai.project.startsWith('proj_')) {
    console.warn(`⚠️ Ignoring OPENAI_PROJECT value "${config.openai.project}" — expected identifier starting with "proj_".`);
    config.openai.project = null;
}

config.ai.allowedProviders = [...new Set(config.ai.allowedProviders)].filter(Boolean);
if (config.ai.allowedProviders.length === 0) {
    config.ai.allowedProviders = ['local'];
}

if (!config.ai.allowedProviders.includes(config.ai.defaultProvider)) {
    config.ai.defaultProvider = config.ai.allowedProviders[0];
}

// Validate required environment variables
const requiredVars = [
    'TELEGRAM_BOT_TOKEN',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
];

for (const varName of requiredVars) {
    if (!process.env[varName]) {
        console.error(`❌ Missing required environment variable: ${varName}`);
        process.exit(1);
    }
}

if (config.ai.allowedProviders.includes('openai') && config.openai.apiKeys.length === 0) {
    console.warn('⚠️ AI provider "openai" указан, но ключ не найден. Укажи OPENAI_API_KEY или удалите провайдера из AI_ALLOWED_PROVIDERS.');
}

if (config.ai.allowedProviders.includes('deepseek') && !config.deepseek.apiKey) {
    console.warn('⚠️ AI provider "deepseek" указан, но ключ не найден. Укажи DEEPSEEK_API_KEY или удалите провайдера из AI_ALLOWED_PROVIDERS.');
}

export default config;

import dotenv from 'dotenv';

dotenv.config();

export const config = {
    telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
        allowedUserIds: (process.env.TELEGRAM_ALLOWED_IDS || '')
            .split(',')
            .map(value => value.trim())
            .filter(Boolean),
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        maxConcurrency: parseInt(process.env.OPENAI_MAX_CONCURRENCY || '1', 10),
        minIntervalMs: parseInt(process.env.OPENAI_MIN_INTERVAL_MS || '800', 10),
        maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3', 10),
        retryInitialDelayMs: parseInt(process.env.OPENAI_RETRY_INITIAL_DELAY_MS || '1000', 10),
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

// Validate required environment variables
const requiredVars = [
    'TELEGRAM_BOT_TOKEN',
    'OPENAI_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
];

for (const varName of requiredVars) {
    if (!process.env[varName]) {
        console.error(`❌ Missing required environment variable: ${varName}`);
        process.exit(1);
    }
}

export default config;

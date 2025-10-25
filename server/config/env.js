import dotenv from 'dotenv';

dotenv.config();

export const config = {
    telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY,
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


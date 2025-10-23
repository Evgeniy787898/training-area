const ALLOWED_ENVIRONMENTS = new Set(['development', 'test', 'production']);
const ALLOWED_LOG_LEVELS = new Set(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);

const isValidUrl = (value) => {
  try {
    const url = new URL(value);
    return Boolean(url.protocol && url.host);
  } catch (error) {
    return false;
  }
};

export const loadEnv = (env = process.env) => {
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (!ALLOWED_ENVIRONMENTS.has(nodeEnv)) {
    throw new Error(`Unsupported NODE_ENV value: ${nodeEnv}`);
  }

  const logLevel = env.LOG_LEVEL ?? 'info';
  if (!ALLOWED_LOG_LEVELS.has(logLevel)) {
    throw new Error(`Unsupported LOG_LEVEL value: ${logLevel}`);
  }

  const config = {
    NODE_ENV: nodeEnv,
    LOG_LEVEL: logLevel,
    SUPABASE_URL: env.SUPABASE_URL ?? null,
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY ?? null,
    TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN ?? null,
    OPENAI_API_KEY: env.OPENAI_API_KEY ?? null,
    OPENAI_ORGANIZATION: env.OPENAI_ORGANIZATION ?? null,
    OPENAI_PROJECT: env.OPENAI_PROJECT ?? null,
    ERROR_TRACKING_DSN: env.ERROR_TRACKING_DSN ?? null,
    isProduction: nodeEnv === 'production'
  };

  if (config.SUPABASE_URL && !isValidUrl(config.SUPABASE_URL)) {
    throw new Error('SUPABASE_URL must be a valid URL');
  }

  if (config.TELEGRAM_BOT_TOKEN && config.TELEGRAM_BOT_TOKEN.length < 30) {
    throw new Error('TELEGRAM_BOT_TOKEN выглядит некорректно');
  }

  if (config.OPENAI_API_KEY && !config.OPENAI_API_KEY.startsWith('sk-')) {
    throw new Error('OPENAI_API_KEY должен начинаться с «sk-»');
  }

  return config;
};

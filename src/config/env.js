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
    ERROR_TRACKING_DSN: env.ERROR_TRACKING_DSN ?? null,
    isProduction: nodeEnv === 'production'
  };

  if (config.SUPABASE_URL && !isValidUrl(config.SUPABASE_URL)) {
    throw new Error('SUPABASE_URL must be a valid URL');
  }

  return config;
};

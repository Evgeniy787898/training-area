import { performance } from 'node:perf_hooks';
import { MetricsTracker } from '../monitoring/metrics.js';
import { ErrorTracker } from '../monitoring/errorTracker.js';

const LEVEL_PRIORITY = new Map([
  ['fatal', 60],
  ['error', 50],
  ['warn', 40],
  ['info', 30],
  ['debug', 20],
  ['trace', 10],
  ['silent', 100]
]);

const sanitizeContent = (content) => content.replace(/\s+/g, ' ').trim();
const containsSensitiveData = (content) => /(парол|password|token|secret|ключ)/i.test(content);

const createLogger = (level = 'info') => {
  const threshold = LEVEL_PRIORITY.get(level) ?? LEVEL_PRIORITY.get('info');

  const log = (priority, label, payload) => {
    if (priority < threshold || threshold === 100) {
      return;
    }

    const time = new Date().toISOString();
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
    process.stdout.write(`[${time}] ${label.toUpperCase()}: ${message}\n`);
  };

  return {
    level,
    info: (payload) => log(LEVEL_PRIORITY.get('info'), 'info', payload),
    warn: (payload) => log(LEVEL_PRIORITY.get('warn'), 'warn', payload),
    error: (payload) => log(LEVEL_PRIORITY.get('error'), 'error', payload)
  };
};

const buildWelcomeMessage = (name) => `🔥 Привет, ${name}! Я твой персональный тренер в Telegram.

Вот как мы работаем:
• Пиши, как себя чувствуешь и сколько есть времени.
• Командой «цель: …» обновляй главный фокус.
• «готовность: 1-5» — чтобы я корректировал нагрузку.
• После тренировки пришли пару строк фидбэка, я всё запомню.

Готов начать? Расскажи, как прошёл день и что хочется прокачать.`;

const parseDirectives = (content) => {
  const directives = {};
  const goalMatch = content.match(/цель\s*:\s*([^\n]+)/i);
  if (goalMatch) {
    directives.goal = sanitizeContent(goalMatch[1]);
  }

  const readinessMatch = content.match(/готовн(?:ость)?\s*:\s*(\d)/i);
  if (readinessMatch) {
    const value = Number.parseInt(readinessMatch[1], 10);
    if (Number.isInteger(value) && value >= 1 && value <= 5) {
      directives.readiness = value;
    }
  }

  return directives;
};

export class BotEngine {
  constructor(options = {}) {
    this.metrics = options.metrics ?? new MetricsTracker();
    this.errorTracker = options.errorTracker ?? new ErrorTracker();
    this.config = options.config ?? { NODE_ENV: 'development', LOG_LEVEL: 'info', isProduction: false };
    this.logger = options.logger ?? createLogger(this.config.LOG_LEVEL ?? 'info');
    this.trainingCoach = options.trainingCoach;
    if (!this.trainingCoach) {
      this.logger.warn('TrainingCoach не передан — функциональность будет ограничена');
    }
  }

  async handleMessage(message) {
    const start = performance.now();

    try {
      this.assertValidMessage(message);
      const sanitized = sanitizeContent(message.content);

      if (containsSensitiveData(sanitized)) {
        this.logger.warn({ userId: message.userId, message: 'Обнаружены чувствительные данные' });
        return {
          reply: 'Я не могу обработать это сообщение из соображений безопасности.',
          confidence: 0,
          moderation: 'flagged'
        };
      }

      const response = await this.routeMessage({ message, sanitized });
      this.metrics.incrementMessages(message.channel);
      return response;
    } catch (error) {
      this.metrics.incrementErrors('processing');
      await this.errorTracker.captureError(error, { userId: message.userId, channel: message.channel });
      this.logger.error({ message: 'Ошибка обработки сообщения', details: error instanceof Error ? error.message : error });
      return {
        reply: 'Что-то пошло не так. Давай попробуем ещё раз через минутку.',
        confidence: 0,
        moderation: 'flagged'
      };
    } finally {
      const end = performance.now();
      this.metrics.observeLatency(message.channel ?? 'unknown', (end - start) / 1000);
    }
  }

  getHealthSnapshot() {
    return {
      loggerLevel: this.logger.level,
      metricsEnabled: this.metrics instanceof MetricsTracker,
      errorTracking: this.errorTracker.isEnabled(),
      environment: this.config.NODE_ENV ?? 'development'
    };
  }

  async routeMessage({ message, sanitized }) {
    if (!this.trainingCoach) {
      return {
        reply: 'Сервер тренера ещё не настроен. Проверь конфигурацию.',
        confidence: 0,
        moderation: 'flagged'
      };
    }

    const name = message.metadata?.displayName ?? 'друг';

    if (sanitized === '/start') {
      const profile = await this.trainingCoach.ensureProfile({
        telegramId: message.userId,
        displayName: name
      });
      this.logger.info({ message: 'Создан или найден профиль', profileId: profile.id });
      return {
        reply: buildWelcomeMessage(profile.displayName),
        confidence: 1,
        moderation: 'allowed'
      };
    }

    const directives = parseDirectives(sanitized);
    let profile = await this.trainingCoach.ensureProfile({
      telegramId: message.userId,
      displayName: name
    });

    if (Object.keys(directives).length > 0) {
      profile = await this.trainingCoach.updateProfile(profile, directives);
    }

    const plan = await this.trainingCoach.generatePlan({
      profile,
      requestText: sanitized
    });

    return {
      reply: plan,
      confidence: 0.9,
      moderation: 'allowed'
    };
  }

  assertValidMessage(message) {
    if (!message || typeof message !== 'object') {
      throw new Error('Message must be an object');
    }

    if (!message.userId) {
      throw new Error('Missing user id');
    }

    if (!message.channel) {
      throw new Error('Missing channel');
    }

    if (!message.content || !sanitizeContent(message.content)) {
      throw new Error('Message content is empty');
    }
  }
}

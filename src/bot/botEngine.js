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
const containsSensitiveData = (content) => /password|ssn|secret/i.test(content);

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

export class BotEngine {
  constructor(options = {}) {
    this.metrics = options.metrics ?? new MetricsTracker();
    this.errorTracker = options.errorTracker ?? new ErrorTracker();
    this.config = options.config ?? { NODE_ENV: 'development', LOG_LEVEL: 'info', isProduction: false };
    this.logger = options.logger ?? createLogger(this.config.LOG_LEVEL ?? 'info');
  }

  async handleMessage(message) {
    const start = performance.now();

    try {
      this.assertValidMessage(message);
      const sanitized = sanitizeContent(message.content);

      if (containsSensitiveData(sanitized)) {
        this.logger.warn({ userId: message.userId, message: 'Sensitive payload detected' });
        return {
          reply: 'I am sorry, but I cannot help with that request.',
          confidence: 0,
          moderation: 'flagged'
        };
      }

      const reply = this.createReply(sanitized);
      this.metrics.incrementMessages(message.channel);

      return {
        reply,
        confidence: 0.8,
        moderation: 'allowed'
      };
    } catch (error) {
      this.metrics.incrementErrors('processing');
      await this.errorTracker.captureError(error, { userId: message.userId, channel: message.channel });
      this.logger.error({ message: 'Failed to handle bot message', details: error instanceof Error ? error.message : error });
      return {
        reply: 'Something went wrong while processing your request.',
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

  createReply(content) {
    if (/hello|hi|hey/i.test(content)) {
      return 'Hello! How can I assist you today?';
    }

    if (/help/i.test(content)) {
      return 'Sure, here is a link to the help center: https://example.com/help';
    }

    if (this.config.isProduction) {
      return 'Thanks for reaching out. A support specialist will follow up shortly.';
    }

    return `Echo: ${content}`;
  }
}

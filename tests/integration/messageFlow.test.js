import test from 'node:test';
import assert from 'node:assert/strict';
import { BotEngine, MetricsTracker, ErrorTracker, loadEnv, HealthService } from '../../src/index.js';

const setupBot = () => {
  const metrics = new MetricsTracker({ prefix: 'integration_bot' });
  const captured = [];
  const errorTracker = new ErrorTracker({ transport: async (payload) => captured.push(payload) });

  const bot = new BotEngine({
    metrics,
    errorTracker,
    config: loadEnv({ NODE_ENV: 'production', LOG_LEVEL: 'info' })
  });

  const health = new HealthService({
    metrics,
    indicators: [
      async () => ({ name: 'error-tracker', healthy: errorTracker.isEnabled() }),
      async () => ({ name: 'bot-engine', healthy: bot.getHealthSnapshot().metricsEnabled })
    ]
  });

  return { bot, metrics, health, captured };
};

test('processes multiple messages and reports metrics', async () => {
  const { bot, metrics, health } = setupBot();

  await bot.handleMessage({ userId: '1', channel: 'web', content: 'hi there' });
  await bot.handleMessage({ userId: '1', channel: 'web', content: 'need help' });
  await bot.handleMessage({ userId: '2', channel: 'slack', content: 'account issue' });

  const metricsSnapshot = await metrics.getMetricsSnapshot();
  assert.ok(metricsSnapshot.includes('integration_bot_messages_total{channel="web"} 2'));
  assert.ok(metricsSnapshot.includes('integration_bot_messages_total{channel="slack"} 1'));

  const healthSnapshot = await health.check();
  assert.equal(healthSnapshot.status, 'ok');
  assert.ok(healthSnapshot.metrics.includes('integration_bot_messages_total{channel="web"} 2'));
});

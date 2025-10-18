import test from 'node:test';
import assert from 'node:assert/strict';
import { BotEngine, MetricsTracker, ErrorTracker, loadEnv } from '../../src/index.js';

const createMetrics = () => new MetricsTracker({ prefix: 'test_bot' });

const baseMessage = {
  userId: 'user-1',
  channel: 'web',
  content: 'Hello there'
};

test('responds with greeting for hello-like messages', async () => {
  const metrics = createMetrics();
  const engine = new BotEngine({ metrics, config: loadEnv({ NODE_ENV: 'development', LOG_LEVEL: 'info' }) });

  const response = await engine.handleMessage(baseMessage);

  assert.ok(response.reply.includes('Hello'));
  assert.equal(response.moderation, 'allowed');
  const snapshot = await metrics.getMetricsSnapshot();
  assert.ok(snapshot.includes('test_bot_messages_total{channel="web"} 1'));
});

test('echoes message content in non production environment', async () => {
  const engine = new BotEngine({ config: loadEnv({ NODE_ENV: 'development', LOG_LEVEL: 'info' }) });

  const response = await engine.handleMessage({ ...baseMessage, content: 'What is up?' });

  assert.ok(response.reply.includes('Echo: What is up?'));
  assert.equal(response.moderation, 'allowed');
});

test('flags sensitive data and avoids processing', async () => {
  const metrics = createMetrics();
  const engine = new BotEngine({ metrics, config: loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'info' }) });

  const response = await engine.handleMessage({ ...baseMessage, content: 'My password is secret123' });

  assert.equal(response.moderation, 'flagged');
  assert.ok(response.reply.includes('cannot help'));
  const snapshot = await metrics.getMetricsSnapshot();
  assert.ok(!snapshot.includes('test_bot_messages_total{channel="web"} 1'));
});

test('captures errors when message is invalid', async () => {
  const captured = [];
  const tracker = new ErrorTracker({ transport: async (payload) => captured.push(payload) });
  const engine = new BotEngine({
    errorTracker: tracker,
    metrics: createMetrics(),
    config: loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'info' })
  });

  const response = await engine.handleMessage({ ...baseMessage, content: '   ' });

  assert.equal(response.moderation, 'flagged');
  assert.equal(captured.length, 1);
});

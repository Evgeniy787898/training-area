import http from 'node:http';
import { BotEngine, MetricsTracker, ErrorTracker, loadEnv, HealthService } from '../src/index.js';

const config = loadEnv(process.env);
const metrics = new MetricsTracker({ prefix: 'server_bot' });
const errorTracker = new ErrorTracker({ dsn: process.env.ERROR_TRACKING_DSN ?? null });
const bot = new BotEngine({ metrics, errorTracker, config });
const healthService = new HealthService({
  metrics,
  indicators: [
    async () => ({ name: 'error-tracker', healthy: errorTracker.isEnabled() }),
    async () => ({ name: 'bot-engine', healthy: true })
  ]
});

const PORT = Number.parseInt(process.env.PORT ?? '8080', 10);

const parseJsonBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString('utf-8');
  return body.length > 0 ? JSON.parse(body) : {};
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      const report = await healthService.check();
      const status = report.status === 'ok' ? 200 : 503;
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(report));
      return;
    }

    if (req.method === 'GET' && req.url === '/metrics') {
      const snapshot = await metrics.getMetricsSnapshot();
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end(snapshot);
      return;
    }

    if (req.method === 'POST' && req.url === '/messages') {
      const payload = await parseJsonBody(req);
      const response = await bot.handleMessage(payload);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (error) {
    await errorTracker.captureError(error, { route: req.url, method: req.method });
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Bot server listening on port ${PORT}`);
});

import { HealthService, MetricsTracker } from '../src/index.js';

const metrics = new MetricsTracker({ prefix: 'vercel_bot' });
const healthService = new HealthService({ metrics });

export default async function handler(req, res) {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const report = await healthService.check();
  res.status(report.status === 'ok' ? 200 : 503).json(report);
}

import { MetricsTracker } from '../src/index.js';

const metrics = new MetricsTracker({ prefix: 'vercel_bot' });

export default async function handler(req, res) {
  if (req.method && req.method !== 'GET') {
    res.status(405).send('Method not allowed');
    return;
  }

  const snapshot = await metrics.getMetricsSnapshot();
  res.setHeader('content-type', 'text/plain');
  res.status(200).send(snapshot);
}

export class HealthService {
  constructor(options = {}) {
    this.indicators = options.indicators ?? [];
    this.metrics = options.metrics ?? null;
  }

  async check() {
    const checks = [];
    for (const indicator of this.indicators) {
      try {
        const result = await indicator();
        checks.push(result);
      } catch (error) {
        checks.push({ name: indicator.name ?? 'unknown', healthy: false, details: { message: error.message } });
      }
    }

    const healthy = checks.every((check) => check.healthy);

    return {
      status: healthy ? 'ok' : 'degraded',
      checks,
      metrics: this.metrics ? await this.metrics.getMetricsSnapshot() : undefined
    };
  }
}

const buildLabel = (labels) =>
  Object.entries(labels)
    .map(([key, value]) => `${key}="${value}"`)
    .join(',');

export class MetricsTracker {
  constructor(options = {}) {
    this.prefix = options.prefix ?? 'bot';
    this.messages = new Map();
    this.errors = new Map();
    this.latency = new Map();
  }

  incrementMessages(channel) {
    const current = this.messages.get(channel) ?? 0;
    this.messages.set(channel, current + 1);
  }

  incrementErrors(type) {
    const current = this.errors.get(type) ?? 0;
    this.errors.set(type, current + 1);
  }

  observeLatency(channel, seconds) {
    const bucket = this.latency.get(channel) ?? [];
    bucket.push(seconds);
    this.latency.set(channel, bucket);
  }

  async getMetricsSnapshot() {
    const lines = [];

    lines.push(`# HELP ${this.prefix}_messages_total Total number of processed bot messages`);
    lines.push(`# TYPE ${this.prefix}_messages_total counter`);
    if (this.messages.size === 0) {
      lines.push(`${this.prefix}_messages_total{${buildLabel({ channel: 'unknown' })}} 0`);
    } else {
      for (const [channel, count] of this.messages.entries()) {
        lines.push(`${this.prefix}_messages_total{${buildLabel({ channel })}} ${count}`);
      }
    }

    lines.push(`# HELP ${this.prefix}_errors_total Total number of bot processing errors`);
    lines.push(`# TYPE ${this.prefix}_errors_total counter`);
    if (this.errors.size === 0) {
      lines.push(`${this.prefix}_errors_total{${buildLabel({ type: 'none' })}} 0`);
    } else {
      for (const [type, count] of this.errors.entries()) {
        lines.push(`${this.prefix}_errors_total{${buildLabel({ type })}} ${count}`);
      }
    }

    lines.push(`# HELP ${this.prefix}_latency_seconds Average time taken to handle messages`);
    lines.push(`# TYPE ${this.prefix}_latency_seconds gauge`);
    if (this.latency.size === 0) {
      lines.push(`${this.prefix}_latency_seconds{${buildLabel({ channel: 'unknown' })}} 0`);
    } else {
      for (const [channel, values] of this.latency.entries()) {
        const average = values.reduce((total, value) => total + value, 0) / values.length;
        lines.push(`${this.prefix}_latency_seconds{${buildLabel({ channel })}} ${average}`);
      }
    }

    return lines.join('\n');
  }
}

export class ErrorTracker {
  constructor(options = {}) {
    this.transport = options.transport;
    this.captured = [];
    this.dsn = options.dsn ?? null;
  }

  async captureError(error, metadata = {}) {
    const payload = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      metadata,
      timestamp: new Date().toISOString()
    };

    this.captured.push(payload);

    if (typeof this.transport === 'function') {
      await this.transport(payload);
    }
  }

  isEnabled() {
    return Boolean(this.transport || this.dsn);
  }

  getCaptured() {
    return [...this.captured];
  }
}

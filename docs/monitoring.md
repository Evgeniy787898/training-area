# Monitoring and Observability

The monitoring stack combines structured logging, metrics, and error tracking to provide a full view of bot health.

## Metrics

* `MetricsTracker` in `src/monitoring/metrics.js` collects counters and latency measurements exposed in Prometheus text format.
* Metrics are exposed through the HTTP server (`/metrics` in `server/index.js`) or via the Vercel route in `api/metrics.js`.
* Use the `scripts/load-test.js` utility to validate throughput and ensure the exported metrics remain within acceptable latency ranges.

## Error tracking

* `ErrorTracker` in `src/monitoring/errorTracker.js` wraps a pluggable transport (e.g. Sentry, Supabase logs). Configure the transport via dependency injection.
* The class powers runtime error capture inside `BotEngine`, the HTTP server, and the serverless functions.

## Health checks

* `HealthService` (`src/health/healthCheck.js`) aggregates asynchronous health indicators and returns an `ok`/`degraded` status.
* Kubernetes manifests reference `/health` for readiness/liveness probes, and the Vercel endpoint (`api/health.js`) returns the same aggregated report.

## Dashboards

1. Scrape metrics from the deployment environment and import them into Grafana dashboards (latency, throughput, error rates).
2. Connect your error tracking provider (Sentry, Datadog, etc.) to `ErrorTracker`.
3. Monitor Supabase by enabling database logs and setting alerts on slow queries or failed migrations.

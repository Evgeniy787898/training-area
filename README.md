# Training Area Bot Platform

This repository provides a reference implementation for a conversational assistant with production-ready workflows.

## Key capabilities

* **CI pipeline**: GitHub Actions run custom linting, unit/integration tests, security scanning, and privacy checks.
* **Deployment options**: Supabase migrations and functions, Kubernetes manifests, Render blueprint, and Vercel serverless handlers.
* **Observability**: Lightweight Prometheus-style metrics, structured logging, and pluggable error tracking utilities.
* **QA toolkit**: Unit/integration tests powered by the Node.js test runner, load testing via a built-in script, and privacy/compliance validation.

## Getting started

```bash
npm install # no external packages required
npm run qa:ci
```

Start the reference HTTP service locally:

```bash
node server/index.js
```

Use `npm run test:load` (optionally with `LOAD_TEST_TARGET`) to stress test a deployed endpoint. Supabase tooling requires the [Supabase CLI](https://supabase.com/docs/guides/cli) to be installed locally.

Further documentation:

* [Deployment guide](docs/deployment.md)
* [Monitoring guide](docs/monitoring.md)
* [QA processes](docs/qa.md)

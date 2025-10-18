# Quality Assurance Processes

This project enforces multiple layers of QA.

## Automated tests

* **Unit tests**: `npm run test:unit` executes targeted tests in `tests/unit` with the built-in Node.js test runner.
* **Integration tests**: `npm run test:integration` covers the end-to-end message flow.
* **Coverage**: `npm run test:coverage` enables experimental coverage collection from Node.js.

## Static analysis

* `npm run lint` enforces repository standards (trailing whitespace, TODO bans, and no `console.log` usage in source files).
* `npm run security` scans project files for dangerous patterns such as `eval`, `new Function`, or `child_process` imports.

## Load testing

* `npm run test:load` executes the custom load generator in `scripts/load-test.js` against a configured endpoint.
* Gate deployments by running the load test in staging and tracking p95/p99 latency plus error rates.

## Privacy & compliance

* `npm run privacy-check` validates `docs/privacy/data-inventory.json`, ensuring each dataset has a purpose, legal basis, and acceptable retention period.
* Update the inventory whenever new data is collected or retention rules change.

## Manual verification

1. Verify Supabase migrations in a staging environment before promoting to production (`supabase db push`).
2. Smoke-test the serverless moderation function using `supabase functions serve moderation`.
3. Confirm health endpoints respond with status `ok` after every deploy.

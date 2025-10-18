# Deployment Infrastructure

This repository includes multiple deployment pathways so the bot can be shipped to the environment that best matches the project needs.

## Supabase migrations

* `supabase/config.toml` contains the local Supabase configuration. Run `supabase start` (requires the Supabase CLI) to spin up the development stack.
* `supabase/migrations/*` stores database migrations. Generate new migrations with `supabase migration new <name>` and apply them locally using `supabase db reset`.
* `supabase/functions/moderation` exposes a serverless moderation function that can be deployed with `supabase functions deploy moderation`.

## Render deployment

Render can deploy the Node service defined in `server/index.js` via `infra/render/render.yaml`:

```bash
render blueprint deploy infra/render/render.yaml
```

The blueprint skips a build step and starts the HTTP server directly. Secret values (such as `SUPABASE_URL`) are injected using Render environment variables.

## Kubernetes deployment

The manifests in `infra/kubernetes` define a `Deployment` with health and liveness probes plus a `Service` object. Deploy using `kubectl`:

```bash
kubectl apply -f infra/kubernetes/deployment.yaml
```

Provide the container image in the manifest (for example, build and push with GitHub Actions) and create the `bot-secrets` secret containing Supabase credentials.

## Vercel serverless endpoints

`infra/vercel/vercel.json` configures two API routes (`api/health.js` and `api/metrics.js`) that expose health and metrics information. Deploy the project with the Vercel CLI:

```bash
vercel --prod
```

Set the Supabase and logging environment variables inside the Vercel dashboard so that the handlers can reach backend services.

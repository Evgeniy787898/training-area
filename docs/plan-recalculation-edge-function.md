# Plan Recalculation Edge Function

This document describes how to deploy and operate the `recalculate-plan` Supabase Edge Function, including runtime permissions, scheduling, observability, and rollback procedures.

## Runtime configuration

1. Apply the SQL migration to provision the supporting `automation.plan_recalculation_runs` table and ensure the Edge Function (running with the `service_role`) can query the `training_events`, `training_feedback`, and `plans` tables:
   ```bash
   supabase db push
   ```
2. Store the following secrets using the Supabase CLI so they are available to the function at runtime:
   ```bash
   supabase secrets set \
     SUPABASE_URL="https://<PROJECT_REF>.supabase.co" \
     SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
     PIPELINE_ENDPOINT="https://ml.internal/pipeline" \
     SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..." \
     SUPABASE_FUNCTION_SECRET="<jwt-for-scheduled-trigger>" \
     SCHEDULE_ALERT_WEBHOOK="https://hooks.slack.com/services/..."
   ```
   * `PIPELINE_ENDPOINT` should accept a JSON payload containing the latest training events and feedback and respond with the recalculated plans.
   * `SLACK_WEBHOOK_URL` receives failure notifications.
   * `SUPABASE_FUNCTION_SECRET` is used by the scheduler to authenticate when invoking the function.

## Deploying the Edge Function

1. Build locally (optional) to confirm the function compiles:
   ```bash
   supabase functions serve recalculate-plan --env-file .env.local
   ```
2. Deploy to the targeted environment:
   ```bash
   supabase functions deploy recalculate-plan
   ```
3. Smoke test the deployment using a manual trigger:
   ```bash
   curl \
     -X POST \
     -H "Authorization: Bearer $SUPABASE_FUNCTION_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"trigger":"manual"}' \
     "https://<PROJECT_REF>.functions.supabase.co/recalculate-plan"
   ```

## Scheduling

The `supabase/schedules/plan-recalculation-nightly.json` manifest captures the desired nightly cadence, retry policy, and alerting destinations. Register or update the schedule via the Supabase CLI:

```bash
supabase functions schedule upsert \
  --file supabase/schedules/plan-recalculation-nightly.json
```

You may create additional schedules (e.g., post-training) by duplicating the manifest and adjusting the cron expression or payload trigger.

## Monitoring and observability

* **Run history:** Successful and failed executions are recorded in the `automation.plan_recalculation_runs` table, including metadata describing the trigger, plan scope, and error context if any.
* **Function logs:** Edge Functions automatically emit structured JSON logs (see `log()` helper) that can be forwarded to your observability stack.
* **Alerts:** Slack/webhook notifications are sent when a run fails. Extend `sendSlackAlert()` to forward messages to PagerDuty, Datadog, or other systems as required.
* **Metrics:** Aggregate counts from `automation.plan_recalculation_runs` to drive dashboards (e.g., Grafana). Example query:
  ```sql
  select date_trunc('day', executed_at) as day,
         count(*) filter (where status = 'success') as successes,
         count(*) filter (where status = 'failure') as failures
    from automation.plan_recalculation_runs
   group by 1
   order by 1;
  ```

## Rollback strategy

1. Re-deploy the previous stable function artifact:
   ```bash
   supabase functions deploy recalculate-plan --project-ref <PROJECT_REF> --import-map path/to/previous/import_map.json --legacy-bundle
   ```
   (Supply the specific bundle artifact or Git commit tag used for the last known good deployment.)
2. Restore database changes if necessary by rolling back the migration:
   ```bash
   supabase migration repair --status reverted --name 20240610120000_edge_function_permissions
   supabase db reset # destructive, use only if coordinated with DB team
   ```
3. Disable the schedule to halt automated triggers while remediation occurs:
   ```bash
   supabase functions schedule delete plan-recalculation-nightly
   ```
4. Re-enable once the fix is deployed and validated:
   ```bash
   supabase functions schedule create \
     plan-recalculation-nightly \
     --cron "0 3 * * *" \
     --endpoint "/recalculate-plan" \
     --payload '{"trigger":"scheduled"}'
   ```

Document any incidents, including root cause and follow-up actions, to maintain operational readiness.

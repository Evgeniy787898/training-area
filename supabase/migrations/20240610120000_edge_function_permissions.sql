-- Grants edge functions (executed with service role) explicit access to core tables.
-- Adjust table names to match your production schema prior to deployment.

set check_function_bodies = off;

create schema if not exists automation;

create table if not exists automation.plan_recalculation_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null,
  executed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

grant usage on schema automation to service_role;
grant all privileges on all tables in schema automation to service_role;

grant usage on schema public to service_role;

grant select on public.training_events to service_role;
grant select on public.training_feedback to service_role;
grant insert, update on public.plans to service_role;

grant usage, select on all sequences in schema public to service_role;

alter table public.training_events enable row level security;
alter table public.training_feedback enable row level security;
alter table public.plans enable row level security;

create policy if not exists "edge functions can read training events"
  on public.training_events
  for select
  using (auth.role() = 'service_role');

create policy if not exists "edge functions can read training feedback"
  on public.training_feedback
  for select
  using (auth.role() = 'service_role');

create policy if not exists "edge functions can upsert plans"
  on public.plans
  for insert with check (auth.role() = 'service_role')
  using (auth.role() = 'service_role');

create policy if not exists "edge functions can update plans"
  on public.plans
  for update using (auth.role() = 'service_role');

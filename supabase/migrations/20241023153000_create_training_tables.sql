-- Миграция для хранения тренировочных программ и прогресса пользователя
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

create table if not exists training_profiles (
  id uuid primary key default gen_random_uuid(),
  telegram_id text not null unique,
  display_name text not null,
  goal text,
  readiness integer not null default 3 check (readiness between 1 and 5),
  preferences jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger training_profiles_set_updated_at
  before update on training_profiles
  for each row execute function public.set_updated_at();

create table if not exists training_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references training_profiles(id) on delete cascade,
  planned_for date not null,
  status text not null check (status in ('planned', 'completed', 'skipped')),
  intensity text not null,
  blocks jsonb not null,
  reflection text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, planned_for)
);

create trigger training_sessions_set_updated_at
  before update on training_sessions
  for each row execute function public.set_updated_at();

create table if not exists training_metrics (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references training_sessions(id) on delete cascade,
  metric_type text not null,
  metric_value numeric(10,2) not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists training_metrics_session_id_idx on training_metrics(session_id);

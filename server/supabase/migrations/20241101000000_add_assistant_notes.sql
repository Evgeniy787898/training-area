-- Assistant notes store personal reminders captured from chat
create table if not exists assistant_notes (
    id uuid primary key default uuid_generate_v4(),
    profile_id uuid not null references profiles(id) on delete cascade,
    title text,
    content text not null,
    tags text[] default array[]::text[],
    source text not null default 'chat',
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists assistant_notes_profile_created_idx
    on assistant_notes (profile_id, created_at desc);

alter table assistant_notes enable row level security;

-- Service role retains full access
grant all on assistant_notes to service_role;


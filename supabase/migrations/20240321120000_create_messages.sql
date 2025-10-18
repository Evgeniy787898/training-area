create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  channel text not null,
  content text not null,
  reply text,
  sentiment text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists conversation_messages_user_id_idx on public.conversation_messages (user_id);
create index if not exists conversation_messages_created_at_idx on public.conversation_messages (created_at desc);

-- Wiskunde Tool — initial schema + RLS + Realtime
-- Run this in Supabase SQL Editor or via CLI migrations.

create extension if not exists "pgcrypto";

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  max_number integer not null check (max_number in (10, 20, 100)),
  operation_mode text not null default 'both',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists sessions_code_idx on public.sessions (code);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists participants_session_idx on public.participants (session_id);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  a integer not null,
  b integer not null,
  op text not null check (char_length(op) >= 1),
  user_answer integer not null,
  is_correct boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists answers_session_idx on public.answers (session_id);
create index if not exists answers_participant_idx on public.answers (participant_id);

alter table public.sessions enable row level security;
alter table public.participants enable row level security;
alter table public.answers enable row level security;

-- Classroom MVP: open policies for anon key (replace with stricter rules later)
create policy "sessions_select" on public.sessions for select using (true);
create policy "sessions_insert" on public.sessions for insert with check (true);
create policy "sessions_update" on public.sessions for update using (true);

create policy "participants_select" on public.participants for select using (true);
create policy "participants_insert" on public.participants for insert with check (true);

create policy "answers_select" on public.answers for select using (true);
create policy "answers_insert" on public.answers for insert with check (true);

-- Realtime (Supabase)
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.participants;
alter publication supabase_realtime add table public.answers;

-- 2026-05-15-workout-sessions.sql
-- Workout session flow tables. Idempotent: safe to re-run.

create table if not exists workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  focus text,
  energy_pre int,
  energy_post int,
  mood_post text,
  notes text,
  started_at timestamptz default now(),
  ended_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references workout_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_name text not null,
  set_number int not null,
  weight_lb numeric,
  reps int,
  rpe numeric,
  created_at timestamptz default now()
);

alter table workout_sessions enable row level security;
alter table workout_sets enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'workout_sessions' and policyname = 'user reads own sessions') then
    create policy "user reads own sessions" on workout_sessions for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'workout_sessions' and policyname = 'user writes own sessions') then
    create policy "user writes own sessions" on workout_sessions for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'workout_sessions' and policyname = 'user updates own sessions') then
    create policy "user updates own sessions" on workout_sessions for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'workout_sets' and policyname = 'user reads own sets') then
    create policy "user reads own sets" on workout_sets for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'workout_sets' and policyname = 'user writes own sets') then
    create policy "user writes own sets" on workout_sets for insert with check (auth.uid() = user_id);
  end if;
end $$;

create index if not exists workout_sessions_user_started on workout_sessions(user_id, started_at desc);
create index if not exists workout_sets_session on workout_sets(session_id, set_number);

-- Backward-compatible rename from v1 schema column names. No-op if already migrated or never present.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'workout_sets' and column_name = 'exercise'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'workout_sets' and column_name = 'exercise_name'
  ) then
    alter table workout_sets rename column exercise to exercise_name;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'workout_sets' and column_name = 'set_num'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'workout_sets' and column_name = 'set_number'
  ) then
    alter table workout_sets rename column set_num to set_number;
  end if;
end $$;

-- Ensure user_id NOT NULL constraint on workout_sets (v1 had it nullable via DEFAULT auth.uid()).
-- Backfill any orphan rows first to avoid constraint failure.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'workout_sets'
      and column_name = 'user_id' and is_nullable = 'YES'
  ) then
    update workout_sets s
       set user_id = ws.user_id
      from workout_sessions ws
     where s.session_id = ws.id and s.user_id is null;
    -- Only enforce NOT NULL if no nulls remain.
    if not exists (select 1 from workout_sets where user_id is null) then
      alter table workout_sets alter column user_id set not null;
    end if;
  end if;
end $$;

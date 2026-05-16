-- 2026-05-15-dogfood-mode.sql
-- Solo dogfood mode: ensure every Vitals table exists, swap RLS to permissive policies
-- so the anon role (no logged-in user) can read/write. Idempotent.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Ensure every table exists (no-op if already present)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists intake_events (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  item text not null,
  qty_text text,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  water_ml numeric,
  caffeine_mg numeric,
  raw_input text,
  parsed_by text,
  image_url text,
  user_id uuid
);

create table if not exists output_events (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  type text not null,
  payload jsonb,
  user_id uuid
);

create table if not exists workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
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
  session_id uuid references workout_sessions(id) on delete cascade,
  user_id uuid,
  exercise_name text not null,
  set_number int not null,
  weight_lb numeric,
  reps int,
  rpe numeric,
  created_at timestamptz default now()
);

create table if not exists physique_snapshots (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  image_storage_path text,
  analysis_json jsonb,
  bf_percent_estimate numeric,
  notes text,
  user_id uuid
);

create table if not exists daily_summary (
  date date primary key,
  calories_total numeric default 0,
  protein_g_total numeric default 0,
  carbs_g_total numeric default 0,
  fat_g_total numeric default 0,
  water_ml_total numeric default 0,
  caffeine_mg_total numeric default 0,
  workout_count integer default 0,
  mood_avg numeric,
  sleep_hours numeric,
  recovery_score numeric,
  user_id uuid
);

create table if not exists user_profile (
  id uuid primary key,
  tier text not null default 'pro' check (tier in ('free', 'pro', 'premium')),
  trial_started_at timestamptz default now(),
  trial_ends_at timestamptz default (now() + interval '14 days'),
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  current_period_end timestamptz,
  display_name text,
  onboarding_completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists consent_log (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  consent_version text not null,
  accepted_terms boolean not null,
  accepted_privacy boolean not null,
  accepted_not_medical_advice boolean not null,
  ip_hash text,
  user_agent text,
  user_id uuid
);

create table if not exists substances (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  dose numeric,
  dose_unit text,
  frequency text,
  route text,
  site_rotation text,
  start_date date,
  stop_date date,
  source_flag text,
  notes text,
  active boolean default true,
  created_at timestamptz default now(),
  user_id uuid
);

create table if not exists substance_doses_log (
  id uuid primary key default gen_random_uuid(),
  substance_id uuid references substances(id) on delete cascade,
  ts timestamptz not null default now(),
  dose_taken numeric,
  notes text,
  user_id uuid
);

create table if not exists substance_side_effects (
  id uuid primary key default gen_random_uuid(),
  substance_id uuid references substances(id) on delete cascade,
  ts timestamptz not null default now(),
  effect text not null,
  severity integer,
  notes text,
  user_id uuid
);

create table if not exists bloodwork_panels (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  drawn_on date,
  source_format text,
  panel_name text,
  lab_provider text,
  notes text,
  user_id uuid
);

create table if not exists bloodwork_markers (
  id uuid primary key default gen_random_uuid(),
  panel_id uuid references bloodwork_panels(id) on delete cascade,
  marker text not null,
  category text,
  value numeric,
  unit text,
  ref_low numeric,
  ref_high numeric,
  flag text,
  raw_text text,
  user_id uuid
);

create table if not exists practice_sessions (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  category text not null,
  practice_type text not null,
  duration_min numeric,
  intensity integer,
  mood_pre integer,
  mood_post integer,
  energy_pre integer,
  energy_post integer,
  clarity_pre integer,
  clarity_post integer,
  notes text,
  user_id uuid
);

create table if not exists custom_metrics_defs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text,
  frequency text,
  metric_type text default 'numeric',
  active boolean default true,
  created_at timestamptz default now(),
  user_id uuid
);

create table if not exists custom_metrics_log (
  id uuid primary key default gen_random_uuid(),
  metric_id uuid references custom_metrics_defs(id) on delete cascade,
  ts timestamptz not null default now(),
  value numeric,
  value_bool boolean,
  notes text,
  user_id uuid
);

create table if not exists rediagnosis_reports (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  model_used text not null,
  tier_at_time text,
  period_start timestamptz,
  period_end timestamptz,
  wins jsonb,
  leaks jsonb,
  adjustments jsonb,
  bloodwork_due jsonb,
  experiment jsonb,
  raw_response text,
  disclaimer_version text not null default 'v1.0',
  user_id uuid
);

create table if not exists rediagnosis_feedback (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references rediagnosis_reports(id) on delete cascade,
  recommendation_index integer,
  recommendation_text text,
  action text,
  ts timestamptz not null default now(),
  user_id uuid
);

create table if not exists onboarding_progress (
  user_id uuid primary key,
  step_consent_at timestamptz,
  step_identity_at timestamptz,
  step_snapshot_at timestamptz,
  step_stack_at timestamptz,
  step_rhythm_at timestamptz,
  step_bloodwork_at timestamptz,
  step_goal_at timestamptz,
  completed_at timestamptz,
  identity_data jsonb,
  rhythm_data jsonb,
  first_goal text,
  thirty_day_checkpoint text
);

create table if not exists recommendations_audit (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  source text not null,
  model_used text,
  tier_at_time text,
  prompt_excerpt text,
  recommendation_text text not null,
  disclaimer_version text not null default 'v1.0',
  disclaimer_text text not null,
  user_id uuid
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status text,
  tier text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  trial_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists subscription_events (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  stripe_event_id text unique,
  event_type text not null,
  payload jsonb,
  user_id uuid
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Backward-compat: v1 -> v2 column renames on workout_sets (no-op if absent)
-- ─────────────────────────────────────────────────────────────────────────────

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

-- Make sure user_id on workouts is nullable for anon dogfood writes.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'workout_sessions'
      and column_name = 'user_id' and is_nullable = 'NO'
  ) then
    alter table workout_sessions alter column user_id drop not null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'workout_sets'
      and column_name = 'user_id' and is_nullable = 'NO'
  ) then
    alter table workout_sets alter column user_id drop not null;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Enable RLS on every table
-- ─────────────────────────────────────────────────────────────────────────────

alter table intake_events           enable row level security;
alter table output_events           enable row level security;
alter table workout_sessions        enable row level security;
alter table workout_sets            enable row level security;
alter table physique_snapshots      enable row level security;
alter table daily_summary           enable row level security;
alter table user_profile            enable row level security;
alter table consent_log             enable row level security;
alter table substances              enable row level security;
alter table substance_doses_log     enable row level security;
alter table substance_side_effects  enable row level security;
alter table bloodwork_panels        enable row level security;
alter table bloodwork_markers       enable row level security;
alter table practice_sessions       enable row level security;
alter table custom_metrics_defs     enable row level security;
alter table custom_metrics_log      enable row level security;
alter table rediagnosis_reports     enable row level security;
alter table rediagnosis_feedback    enable row level security;
alter table onboarding_progress     enable row level security;
alter table recommendations_audit   enable row level security;
alter table subscriptions           enable row level security;
alter table subscription_events     enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Swap to permissive solo-dogfood RLS on every table.
--    Drop ALL existing policies, then add dogfood read+write policies.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  r record;
  tables text[] := array[
    'intake_events','output_events','workout_sessions','workout_sets',
    'physique_snapshots','daily_summary','user_profile','consent_log',
    'substances','substance_doses_log','substance_side_effects',
    'bloodwork_panels','bloodwork_markers','practice_sessions',
    'custom_metrics_defs','custom_metrics_log','rediagnosis_reports',
    'rediagnosis_feedback','onboarding_progress','recommendations_audit',
    'subscriptions','subscription_events'
  ];
  t text;
begin
  foreach t in array tables loop
    for r in
      select policyname from pg_policies
       where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', r.policyname, t);
    end loop;
    execute format('create policy "dogfood read all"   on public.%I for select using (true)',           t);
    execute format('create policy "dogfood insert all" on public.%I for insert with check (true)',     t);
    execute format('create policy "dogfood update all" on public.%I for update using (true) with check (true)', t);
    execute format('create policy "dogfood delete all" on public.%I for delete using (true)',          t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Indexes (idempotent)
-- ─────────────────────────────────────────────────────────────────────────────

create index if not exists idx_substances_user_active        on substances(user_id, active);
create index if not exists idx_bloodwork_markers_user_marker on bloodwork_markers(user_id, marker);
create index if not exists idx_bloodwork_panels_user_ts      on bloodwork_panels(user_id, ts desc);
create index if not exists idx_practice_sessions_user_ts     on practice_sessions(user_id, ts desc);
create index if not exists idx_custom_metrics_log_metric_ts  on custom_metrics_log(metric_id, ts desc);
create index if not exists idx_rediagnosis_user_ts           on rediagnosis_reports(user_id, ts desc);
create index if not exists idx_intake_user_ts                on intake_events(user_id, ts desc);
create index if not exists idx_workout_sessions_user_started on workout_sessions(user_id, started_at desc);
create index if not exists idx_workout_sets_session          on workout_sets(session_id, set_number);

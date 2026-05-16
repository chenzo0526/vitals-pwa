-- 2026-05-16-multi-user-rls.sql
-- Re-tighten RLS: drop permissive dogfood policies, swap to per-user (auth.uid() = user_id).
-- DO NOT run until magic-link auth is verified working in production.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Drop ALL existing policies and create per-user policies for every table.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  r record;
  tables text[] := array[
    'intake_events','output_events','workout_sessions','workout_sets',
    'physique_snapshots','daily_summary','consent_log',
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
    execute format('create policy "read own"   on public.%I for select using (auth.uid() = user_id)', t);
    execute format('create policy "insert own" on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "update own" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "delete own" on public.%I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) user_profile is scoped by id (= auth.uid()), not user_id.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname='public' and tablename='user_profile' loop
    execute format('drop policy %I on public.user_profile', r.policyname);
  end loop;
end $$;

create policy "read own profile"   on user_profile for select using (auth.uid() = id);
create policy "insert own profile" on user_profile for insert with check (auth.uid() = id);
create policy "update own profile" on user_profile for update using (auth.uid() = id) with check (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Purge legacy dogfood rows where user_id is null (orphans from anon writes).
--    Must precede NOT NULL enforcement.
-- ─────────────────────────────────────────────────────────────────────────────
delete from intake_events           where user_id is null;
delete from output_events           where user_id is null;
delete from workout_sets            where user_id is null;
delete from workout_sessions        where user_id is null;
delete from physique_snapshots      where user_id is null;
delete from substance_doses_log     where user_id is null;
delete from substance_side_effects  where user_id is null;
delete from substances              where user_id is null;
delete from bloodwork_markers       where user_id is null;
delete from bloodwork_panels        where user_id is null;
delete from practice_sessions       where user_id is null;
delete from custom_metrics_log      where user_id is null;
delete from custom_metrics_defs     where user_id is null;
delete from rediagnosis_feedback    where user_id is null;
delete from rediagnosis_reports     where user_id is null;
delete from recommendations_audit   where user_id is null;
delete from consent_log             where user_id is null;
delete from daily_summary           where user_id is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Re-enforce NOT NULL on user_id so future orphan inserts fail loudly.
-- ─────────────────────────────────────────────────────────────────────────────
alter table intake_events           alter column user_id set not null;
alter table workout_sessions        alter column user_id set not null;
alter table workout_sets            alter column user_id set not null;
alter table physique_snapshots      alter column user_id set not null;
alter table substances              alter column user_id set not null;
alter table practice_sessions       alter column user_id set not null;
alter table custom_metrics_defs     alter column user_id set not null;
alter table custom_metrics_log      alter column user_id set not null;
alter table rediagnosis_reports     alter column user_id set not null;
alter table bloodwork_panels        alter column user_id set not null;
alter table bloodwork_markers       alter column user_id set not null;
alter table consent_log             alter column user_id set not null;

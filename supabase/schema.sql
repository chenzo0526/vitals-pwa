-- VITALS PWA — Supabase Schema (v2)
-- Run this in your Supabase SQL editor

------------------------------------------------------------
-- V1 tables (intake, output, workouts, physique, daily summary)
------------------------------------------------------------

CREATE TABLE IF NOT EXISTS intake_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  item text NOT NULL,
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
  user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);
ALTER TABLE intake_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own intake" ON intake_events;
CREATE POLICY "Users can manage own intake" ON intake_events FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS output_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  type text NOT NULL,
  payload jsonb,
  user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);
ALTER TABLE output_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own output" ON output_events;
CREATE POLICY "Users can manage own output" ON output_events FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  focus text,
  energy_pre integer CHECK (energy_pre BETWEEN 1 AND 10),
  energy_post integer CHECK (energy_post BETWEEN 1 AND 10),
  notes text,
  user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own sessions" ON workout_sessions;
CREATE POLICY "Users can manage own sessions" ON workout_sessions FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS workout_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise text NOT NULL,
  set_num integer NOT NULL DEFAULT 1,
  reps integer,
  weight_lb numeric,
  rpe integer CHECK (rpe BETWEEN 1 AND 10),
  user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own sets" ON workout_sets;
CREATE POLICY "Users can manage own sets" ON workout_sets FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS physique_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  image_storage_path text,
  analysis_json jsonb,
  bf_percent_estimate numeric,
  notes text,
  user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);
ALTER TABLE physique_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access own physique data" ON physique_snapshots;
CREATE POLICY "Users can only access own physique data" ON physique_snapshots FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS daily_summary (
  date date PRIMARY KEY,
  calories_total numeric DEFAULT 0,
  protein_g_total numeric DEFAULT 0,
  carbs_g_total numeric DEFAULT 0,
  fat_g_total numeric DEFAULT 0,
  water_ml_total numeric DEFAULT 0,
  caffeine_mg_total numeric DEFAULT 0,
  workout_count integer DEFAULT 0,
  mood_avg numeric,
  sleep_hours numeric,
  recovery_score numeric,
  user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);
ALTER TABLE daily_summary ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own daily summary" ON daily_summary;
CREATE POLICY "Users can manage own daily summary" ON daily_summary FOR ALL USING (auth.uid() = user_id);

------------------------------------------------------------
-- V2: user_profile (tier, trial, stripe ids)
------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_profile (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  tier text NOT NULL DEFAULT 'pro' CHECK (tier IN ('free', 'pro', 'premium')),
  trial_started_at timestamptz DEFAULT now(),
  trial_ends_at timestamptz DEFAULT (now() + interval '14 days'),
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  current_period_end timestamptz,
  display_name text,
  onboarding_completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own profile" ON user_profile;
CREATE POLICY "Users can manage own profile" ON user_profile FOR ALL USING (auth.uid() = id);

-- Auto-create user_profile row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profile (id) VALUES (NEW.id) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

------------------------------------------------------------
-- V2: consent log (Step 0 of onboarding)
------------------------------------------------------------

CREATE TABLE IF NOT EXISTS consent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  consent_version text NOT NULL,
  accepted_terms boolean NOT NULL,
  accepted_privacy boolean NOT NULL,
  accepted_not_medical_advice boolean NOT NULL,
  ip_hash text,
  user_agent text,
  user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);
ALTER TABLE consent_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own consent" ON consent_log;
CREATE POLICY "Users can manage own consent" ON consent_log FOR ALL USING (auth.uid() = user_id);

------------------------------------------------------------
-- V2: substances
------------------------------------------------------------

CREATE TABLE IF NOT EXISTS substances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('hormones', 'peptides', 'prescription', 'supplements', 'cognitive', 'custom')),
  dose numeric,
  dose_unit text,
  frequency text,
  route text CHECK (route IN ('oral', 'IM', 'sub-Q', 'topical', 'sublingual', 'inhaled', 'other')),
  site_rotation text,
  start_date date,
  stop_date date,
  source_flag text CHECK (source_flag IN ('rx', 'research', 'otc', 'other')),
  notes text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);
ALTER TABLE substances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own substances" ON substances;
CREATE POLICY "Users can manage own substances" ON substances FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS substance_doses_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  substance_id uuid REFERENCES substances(id) ON DELETE CASCADE,
  ts timestamptz NOT NULL DEFAULT now(),
  dose_taken numeric,
  notes text,
  user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);
ALTER TABLE substance_doses_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own dose logs" ON substance_doses_log;
CREATE POLICY "Users can manage own dose logs" ON substance_doses_log FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS substance_side_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  substance_id uuid REFERENCES substances(id) ON DELETE CASCADE,
  ts timestamptz NOT NULL DEFAULT now(),
  effect text NOT NULL,
  severity integer CHECK (severity BETWEEN 1 AND 10),
  notes text,
  user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);
ALTER TABLE substance_side_effects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own side effects" ON substance_side_effects;
CREATE POLICY "Users can manage own side effects" ON substance_side_effects FOR ALL USING (auth.uid() = user_id);

------------------------------------------------------------
-- V2: bloodwork
------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bloodwork_panels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  drawn_on date,
  source_format text CHECK (source_format IN ('pdf', 'photo', 'manual')),
  panel_name text,
  lab_provider text,
  notes text,
  user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);
ALTER TABLE bloodwork_panels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own panels" ON bloodwork_panels;
CREATE POLICY "Users can manage own panels" ON bloodwork_panels FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS bloodwork_markers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id uuid REFERENCES bloodwork_panels(id) ON DELETE CASCADE,
  marker text NOT NULL,
  category text,
  value numeric,
  unit text,
  ref_low numeric,
  ref_high numeric,
  flag text CHECK (flag IN ('low', 'normal', 'high', 'critical')),
  raw_text text,
  user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);
ALTER TABLE bloodwork_markers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own markers" ON bloodwork_markers;
CREATE POLICY "Users can manage own markers" ON bloodwork_markers FOR ALL USING (auth.uid() = user_id);

------------------------------------------------------------
-- V2: practices
------------------------------------------------------------

CREATE TABLE IF NOT EXISTS practice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  category text NOT NULL CHECK (category IN ('thermal', 'pressure_oxygen', 'light', 'movement', 'mind_spiritual', 'recovery', 'custom')),
  practice_type text NOT NULL,
  duration_min numeric,
  intensity integer CHECK (intensity BETWEEN 1 AND 10),
  mood_pre integer CHECK (mood_pre BETWEEN 1 AND 10),
  mood_post integer CHECK (mood_post BETWEEN 1 AND 10),
  energy_pre integer CHECK (energy_pre BETWEEN 1 AND 10),
  energy_post integer CHECK (energy_post BETWEEN 1 AND 10),
  clarity_pre integer CHECK (clarity_pre BETWEEN 1 AND 10),
  clarity_post integer CHECK (clarity_post BETWEEN 1 AND 10),
  notes text,
  user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own practice sessions" ON practice_sessions;
CREATE POLICY "Users can manage own practice sessions" ON practice_sessions FOR ALL USING (auth.uid() = user_id);

------------------------------------------------------------
-- V2: custom metrics
------------------------------------------------------------

CREATE TABLE IF NOT EXISTS custom_metrics_defs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  unit text,
  frequency text CHECK (frequency IN ('daily', 'weekly', 'per_event')),
  metric_type text DEFAULT 'numeric' CHECK (metric_type IN ('numeric', 'boolean', 'scale_1_10')),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);
ALTER TABLE custom_metrics_defs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own metric defs" ON custom_metrics_defs;
CREATE POLICY "Users can manage own metric defs" ON custom_metrics_defs FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS custom_metrics_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_id uuid REFERENCES custom_metrics_defs(id) ON DELETE CASCADE,
  ts timestamptz NOT NULL DEFAULT now(),
  value numeric,
  value_bool boolean,
  notes text,
  user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);
ALTER TABLE custom_metrics_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own metric logs" ON custom_metrics_log;
CREATE POLICY "Users can manage own metric logs" ON custom_metrics_log FOR ALL USING (auth.uid() = user_id);

------------------------------------------------------------
-- V2: rediagnosis
------------------------------------------------------------

CREATE TABLE IF NOT EXISTS rediagnosis_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  model_used text NOT NULL,
  tier_at_time text,
  period_start timestamptz,
  period_end timestamptz,
  wins jsonb,
  leaks jsonb,
  adjustments jsonb,
  bloodwork_due jsonb,
  experiment jsonb,
  raw_response text,
  disclaimer_version text NOT NULL DEFAULT 'v1.0',
  user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);
ALTER TABLE rediagnosis_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own rediagnosis" ON rediagnosis_reports;
CREATE POLICY "Users can manage own rediagnosis" ON rediagnosis_reports FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS rediagnosis_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES rediagnosis_reports(id) ON DELETE CASCADE,
  recommendation_index integer,
  recommendation_text text,
  action text CHECK (action IN ('accept', 'skip', 'already_doing')),
  ts timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);
ALTER TABLE rediagnosis_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own feedback" ON rediagnosis_feedback;
CREATE POLICY "Users can manage own feedback" ON rediagnosis_feedback FOR ALL USING (auth.uid() = user_id);

------------------------------------------------------------
-- V2: onboarding progress
------------------------------------------------------------

CREATE TABLE IF NOT EXISTS onboarding_progress (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) DEFAULT auth.uid(),
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
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own onboarding" ON onboarding_progress;
CREATE POLICY "Users can manage own onboarding" ON onboarding_progress FOR ALL USING (auth.uid() = user_id);

------------------------------------------------------------
-- V2: recommendations audit (every AI rec stored with disclaimer)
------------------------------------------------------------

CREATE TABLE IF NOT EXISTS recommendations_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  model_used text,
  tier_at_time text,
  prompt_excerpt text,
  recommendation_text text NOT NULL,
  disclaimer_version text NOT NULL DEFAULT 'v1.0',
  disclaimer_text text NOT NULL,
  user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);
ALTER TABLE recommendations_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own audit" ON recommendations_audit;
CREATE POLICY "Users can read own audit" ON recommendations_audit FOR ALL USING (auth.uid() = user_id);

------------------------------------------------------------
-- V2: stripe subscriptions + events
------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  stripe_price_id text,
  status text,
  tier text CHECK (tier IN ('free', 'pro', 'premium')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  trial_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own subscriptions" ON subscriptions;
CREATE POLICY "Users can read own subscriptions" ON subscriptions FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  stripe_event_id text UNIQUE,
  event_type text NOT NULL,
  payload jsonb,
  user_id uuid REFERENCES auth.users(id)
);
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own sub events" ON subscription_events;
CREATE POLICY "Users can read own sub events" ON subscription_events FOR ALL USING (auth.uid() = user_id);

------------------------------------------------------------
-- Indexes for common query patterns
------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_substances_user_active ON substances(user_id, active);
CREATE INDEX IF NOT EXISTS idx_bloodwork_markers_user_marker ON bloodwork_markers(user_id, marker);
CREATE INDEX IF NOT EXISTS idx_bloodwork_panels_user_ts ON bloodwork_panels(user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_ts ON practice_sessions(user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_custom_metrics_log_metric_ts ON custom_metrics_log(metric_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_rediagnosis_user_ts ON rediagnosis_reports(user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_intake_user_ts ON intake_events(user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_ts ON workout_sessions(user_id, started_at DESC);

-- VITALS PWA — Supabase Schema
-- Run this in your Supabase SQL editor

-- Intake Events (food logs)
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
CREATE POLICY "Users can manage own intake" ON intake_events
  FOR ALL USING (auth.uid() = user_id);

-- Output Events (bowel movements, etc.)
CREATE TABLE IF NOT EXISTS output_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  type text NOT NULL,
  payload jsonb,
  user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);

ALTER TABLE output_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own output" ON output_events
  FOR ALL USING (auth.uid() = user_id);

-- Workout Sessions
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
CREATE POLICY "Users can manage own sessions" ON workout_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Workout Sets
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
CREATE POLICY "Users can manage own sets" ON workout_sets
  FOR ALL USING (auth.uid() = user_id);

-- Physique Snapshots (TEXT ONLY — no image storage by default)
CREATE TABLE IF NOT EXISTS physique_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  image_storage_path text, -- null if not persisted (preferred)
  analysis_json jsonb,
  bf_percent_estimate numeric,
  notes text,
  user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);

ALTER TABLE physique_snapshots ENABLE ROW LEVEL SECURITY;
-- CRITICAL: Only the authenticated user can read their own snapshots
CREATE POLICY "Users can only access own physique data" ON physique_snapshots
  FOR ALL USING (auth.uid() = user_id);

-- Daily Summary (upserted by a cron or trigger)
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
CREATE POLICY "Users can manage own daily summary" ON daily_summary
  FOR ALL USING (auth.uid() = user_id);

-- Supabase Storage: physique-images bucket (if you ever want to store images)
-- Run this separately in the Storage section or via the API:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('physique-images', 'physique-images', false);
-- CREATE POLICY "Private physique bucket" ON storage.objects
--   FOR ALL USING (auth.uid()::text = (storage.foldername(name))[1]);

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseKey)

export type IntakeEvent = {
  id?: string
  ts?: string
  item: string
  qty_text?: string
  calories?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  water_ml?: number
  caffeine_mg?: number
  raw_input?: string
  parsed_by?: string
  image_url?: string
}

export type WorkoutSession = {
  id?: string
  started_at?: string
  ended_at?: string
  focus?: string
  energy_pre?: number
  energy_post?: number
  notes?: string
}

export type WorkoutSet = {
  id?: string
  session_id: string
  exercise: string
  set_num: number
  reps?: number
  weight_lb?: number
  rpe?: number
}

export type PhysiqueSnapshot = {
  id?: string
  ts?: string
  image_storage_path?: string
  analysis_json?: object
  bf_percent_estimate?: number
  notes?: string
}

export type DailySummary = {
  date: string
  calories_total?: number
  protein_g_total?: number
  carbs_g_total?: number
  fat_g_total?: number
  water_ml_total?: number
  caffeine_mg_total?: number
  workout_count?: number
  mood_avg?: number
  sleep_hours?: number
  recovery_score?: number
}

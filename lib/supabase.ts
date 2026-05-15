import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Server-side admin client (used in webhook handlers)
export function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return createClient(url, serviceKey, { auth: { persistSession: false } })
}

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

export type Substance = {
  id?: string
  name: string
  category: 'hormones' | 'peptides' | 'prescription' | 'supplements' | 'cognitive' | 'custom'
  dose?: number
  dose_unit?: string
  frequency?: string
  route?: 'oral' | 'IM' | 'sub-Q' | 'topical' | 'sublingual' | 'inhaled' | 'other'
  site_rotation?: string
  start_date?: string
  stop_date?: string
  source_flag?: 'rx' | 'research' | 'otc' | 'other'
  notes?: string
  active?: boolean
}

export type BloodworkPanel = {
  id?: string
  ts?: string
  drawn_on?: string
  source_format?: 'pdf' | 'photo' | 'manual'
  panel_name?: string
  lab_provider?: string
  notes?: string
}

export type BloodworkMarker = {
  id?: string
  panel_id?: string
  marker: string
  category?: string
  value?: number
  unit?: string
  ref_low?: number
  ref_high?: number
  flag?: 'low' | 'normal' | 'high' | 'critical'
  raw_text?: string
}

export type PracticeSession = {
  id?: string
  ts?: string
  category: 'thermal' | 'pressure_oxygen' | 'light' | 'movement' | 'mind_spiritual' | 'recovery' | 'custom'
  practice_type: string
  duration_min?: number
  intensity?: number
  mood_pre?: number
  mood_post?: number
  energy_pre?: number
  energy_post?: number
  clarity_pre?: number
  clarity_post?: number
  notes?: string
}

export type CustomMetricDef = {
  id?: string
  name: string
  unit?: string
  frequency?: 'daily' | 'weekly' | 'per_event'
  metric_type?: 'numeric' | 'boolean' | 'scale_1_10'
  active?: boolean
}

export const SUBSTANCE_CATEGORY_COLORS: Record<string, string> = {
  hormones: 'bg-rose-500/20 border-rose-400/40 text-rose-300',
  peptides: 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300',
  prescription: 'bg-violet-500/20 border-violet-400/40 text-violet-300',
  supplements: 'bg-green-500/20 border-green-400/40 text-green-300',
  cognitive: 'bg-amber-500/20 border-amber-400/40 text-amber-300',
  custom: 'bg-slate-500/20 border-slate-400/40 text-slate-300',
}

export const PRACTICE_CATEGORY_COLORS: Record<string, string> = {
  thermal: 'bg-orange-500/20 border-orange-400/40 text-orange-300',
  pressure_oxygen: 'bg-blue-500/20 border-blue-400/40 text-blue-300',
  light: 'bg-amber-500/20 border-amber-400/40 text-amber-300',
  movement: 'bg-green-500/20 border-green-400/40 text-green-300',
  mind_spiritual: 'bg-violet-500/20 border-violet-400/40 text-violet-300',
  recovery: 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300',
  custom: 'bg-slate-500/20 border-slate-400/40 text-slate-300',
}

// Browser-side Supabase client (auth cookie aware via @supabase/ssr).
// Use this from any 'use client' component or hook.
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

// Helper: get the current authenticated user id, or null.
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

// ── Domain types ─────────────────────────────────────────────────────────────

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
  user_id?: string
}

export type WorkoutSession = {
  id?: string
  started_at?: string
  ended_at?: string
  focus?: string
  energy_pre?: number
  energy_post?: number
  notes?: string
  user_id?: string
}

export type WorkoutSet = {
  id?: string
  session_id: string
  exercise_name: string
  set_number: number
  reps?: number
  weight_lb?: number
  rpe?: number
  user_id?: string
}

export type PhysiqueSnapshot = {
  id?: string
  ts?: string
  image_storage_path?: string
  analysis_json?: object
  bf_percent_estimate?: number
  notes?: string
  user_id?: string
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
  user_id?: string
}

export type BloodworkPanel = {
  id?: string
  ts?: string
  drawn_on?: string
  source_format?: 'pdf' | 'photo' | 'manual'
  panel_name?: string
  lab_provider?: string
  notes?: string
  user_id?: string
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
  user_id?: string
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
  user_id?: string
}

export type CustomMetricDef = {
  id?: string
  name: string
  unit?: string
  frequency?: 'daily' | 'weekly' | 'per_event'
  metric_type?: 'numeric' | 'boolean' | 'scale_1_10'
  active?: boolean
  user_id?: string
}

export type LifeEventCategory =
  | 'family_illness' | 'loss' | 'move' | 'job_change' | 'relationship'
  | 'sleep_disruption' | 'cycle_change' | 'training_gap' | 'stress_event'
  | 'travel' | 'mental_health' | 'injury' | 'other'

export type LifeEvent = {
  id?: string
  user_id?: string
  started_on: string  // YYYY-MM-DD
  ended_on?: string | null
  category: LifeEventCategory
  title: string
  description?: string | null
  impact_level: 'low' | 'medium' | 'high'
  created_at?: string
  updated_at?: string
}

export const LIFE_EVENT_LABELS: Record<LifeEventCategory, string> = {
  family_illness: 'Family illness',
  loss: 'Loss / grief',
  move: 'Move / relocation',
  job_change: 'Job change',
  relationship: 'Relationship',
  sleep_disruption: 'Sleep disruption',
  cycle_change: 'Cycle / protocol change',
  training_gap: 'Training gap',
  stress_event: 'Stress event',
  travel: 'Major travel',
  mental_health: 'Mental health',
  injury: 'Injury',
  other: 'Other',
}

export const LIFE_EVENT_COLORS: Record<LifeEventCategory, string> = {
  family_illness: 'border-rose-400/30 bg-rose-500/5 text-rose-200',
  loss: 'border-violet-400/30 bg-violet-500/5 text-violet-200',
  move: 'border-amber-400/30 bg-amber-500/5 text-amber-200',
  job_change: 'border-cyan-400/30 bg-cyan-500/5 text-cyan-200',
  relationship: 'border-pink-400/30 bg-pink-500/5 text-pink-200',
  sleep_disruption: 'border-indigo-400/30 bg-indigo-500/5 text-indigo-200',
  cycle_change: 'border-cyan-400/30 bg-cyan-500/5 text-cyan-200',
  training_gap: 'border-emerald-400/30 bg-emerald-500/5 text-emerald-200',
  stress_event: 'border-orange-400/30 bg-orange-500/5 text-orange-200',
  travel: 'border-sky-400/30 bg-sky-500/5 text-sky-200',
  mental_health: 'border-violet-400/30 bg-violet-500/5 text-violet-200',
  injury: 'border-rose-400/30 bg-rose-500/5 text-rose-200',
  other: 'border-slate-400/30 bg-slate-500/5 text-slate-200',
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

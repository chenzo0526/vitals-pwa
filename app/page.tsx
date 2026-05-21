'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Zap, Beef, Wheat, Droplet, Droplets, Brain, FlaskConical, Sparkles, Activity, ChevronRight, Camera, CheckCircle2, Circle, Calendar, Dumbbell, Plus, Loader2, Info, X, Heart } from 'lucide-react'
import { UserProfile, isTrialing, trialDaysLeft } from '@/lib/tier'
import { getLocalDateString, getUserTimezone } from '@/lib/dates'
import { celebrate } from '@/lib/celebrate'
import { yesterdayStr } from '@/lib/logDate'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import CoachInsightCard from '@/components/CoachInsightCard'
import { computeCalorieTarget } from '@/lib/calorieTarget'
import type { CalorieGoal, CalorieTargetResult } from '@/lib/calorieTarget'

const DEFAULT_GOALS = { calories: 2400, protein_g: 180, carbs_g: 250, fat_g: 80, water_ml: 3000 }

// Infer calorie goal from the user's stated first_goal text (best-effort heuristic).
// User can override via /more later. Defaults to maintain.
function inferCalorieGoalFromText(text: string | null | undefined): CalorieGoal {
  if (!text) return 'maintain'
  const t = text.toLowerCase()
  if (/aggressive\s*cut|drop\s*\d+\s*lb|lose\s*\d+\s*lb|cut\s*hard|crash\s*diet/.test(t)) return 'aggressive_cut'
  if (/\bcut\b|\blose\b|\bdrop\b|\blean\s*out|\bshred|fat\s*loss/.test(t)) return 'moderate_cut'
  if (/aggressive\s*bulk|mass\s*gain|gain\s*\d+\s*lb/.test(t)) return 'aggressive_bulk'
  if (/\bbulk\b|\bgain\b|jacked|build\s*muscle|add\s*size|recomp/.test(t)) return 'lean_bulk'
  return 'maintain'
}

type Today = {
  calories_total: number; protein_g_total: number; carbs_g_total: number; fat_g_total: number; water_ml_total: number
}

type OpenWorkout = { id: string; focus: string | null; started_at: string }
type BioSnapshot = { for_date: string; hrv_rmssd: number | null; rhr_bpm: number | null; sleep_total_min: number | null; steps: number | null; active_calories: number | null }
type NextScheduledWorkout = { id: string; focus: string | null; scheduled_at: string }

type BaselineStatus = {
  hasPhysique: boolean
  hasSubstances: boolean
  hasBloodwork: boolean
}

export default function HomePage() {
  const [today, setToday] = useState<Today>({
    calories_total: 0, protein_g_total: 0, carbs_g_total: 0, fat_g_total: 0, water_ml_total: 0,
  })
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [loading, setLoading] = useState(true)
  const [openWorkout, setOpenWorkout] = useState<OpenWorkout | null>(null)
  const [nextScheduled, setNextScheduled] = useState<NextScheduledWorkout | null>(null)
  const [baseline, setBaseline] = useState<BaselineStatus>({ hasPhysique: false, hasSubstances: false, hasBloodwork: false })
  const [addingWater, setAddingWater] = useState<number | null>(null)  // ml of pending add for the spinner
  const [calTarget, setCalTarget] = useState<CalorieTargetResult | null>(null)
  const [bio, setBio] = useState<BioSnapshot | null>(null)
  const [showCalMath, setShowCalMath] = useState(false)

  useEffect(() => {
    async function fetchAll() {
      try {
        const dateStr = getLocalDateString()
        const { data: { user } } = await supabase.auth.getUser()
        const uid = user?.id

        const sixHoursAgoIso = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
        const nowIso = new Date().toISOString()
        const [summaryRes, profileRes, onbRes, openSessionRes, physiqueRes, substancesRes, bloodworkRes, nextScheduledRes, onboardingDataRes, biometricsRes, bioLatestRes] = await Promise.all([
          supabase.from('daily_summary').select('*').eq('date', dateStr).maybeSingle(),
          uid
            ? supabase.from('user_profile').select('*').eq('id', uid).maybeSingle()
            : Promise.resolve({ data: null }),
          uid
            ? supabase.from('onboarding_progress').select('completed_at').eq('user_id', uid).maybeSingle()
            : Promise.resolve({ data: null }),
          uid
            ? supabase
                .from('workout_sessions')
                .select('id, focus, started_at')
                .is('ended_at', null)
                .gt('started_at', sixHoursAgoIso)
                .order('started_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            : Promise.resolve({ data: null }),
          uid
            ? supabase.from('physique_snapshots').select('id', { count: 'exact', head: true }).eq('user_id', uid)
            : Promise.resolve({ count: 0 }),
          uid
            ? supabase.from('substances').select('id', { count: 'exact', head: true }).eq('user_id', uid)
            : Promise.resolve({ count: 0 }),
          uid
            ? supabase.from('bloodwork_panels').select('id', { count: 'exact', head: true }).eq('user_id', uid)
            : Promise.resolve({ count: 0 }),
          uid
            ? supabase
                .from('workout_sessions')
                .select('id, focus, scheduled_at')
                .eq('user_id', uid)
                .is('started_at', null)
                .not('scheduled_at', 'is', null)
                .gte('scheduled_at', nowIso)
                .order('scheduled_at', { ascending: true })
                .limit(1)
                .maybeSingle()
            : Promise.resolve({ data: null }),
          uid
            ? supabase.from('onboarding_progress').select('identity_data, rhythm_data, first_goal').eq('user_id', uid).maybeSingle()
            : Promise.resolve({ data: null }),
          uid
            ? supabase.from('biometric_entries').select('active_calories, for_date').eq('user_id', uid).not('active_calories', 'is', null).gte('for_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)).order('for_date', { ascending: false }).limit(7)
            : Promise.resolve({ data: null }),
          uid
            ? supabase.from('biometric_entries').select('for_date, hrv_rmssd, rhr_bpm, sleep_total_min, steps, active_calories').eq('user_id', uid).order('for_date', { ascending: false }).limit(1).maybeSingle()
            : Promise.resolve({ data: null }),
        ])

        if (uid && profileRes.data) {
          const tz = getUserTimezone()
          const stored = (profileRes.data as { timezone?: string }).timezone
          if (stored !== tz) {
            await supabase.from('user_profile').update({ timezone: tz }).eq('id', uid)
          }
        }
        if (summaryRes.data) {
          setToday({
            calories_total: summaryRes.data.calories_total || 0,
            protein_g_total: summaryRes.data.protein_g_total || 0,
            carbs_g_total: summaryRes.data.carbs_g_total || 0,
            fat_g_total: summaryRes.data.fat_g_total || 0,
            water_ml_total: summaryRes.data.water_ml_total || 0,
          })
        }
        if (profileRes.data) setProfile(profileRes.data as UserProfile)
        if (!onbRes.data || !(onbRes.data as { completed_at: string | null }).completed_at) {
          setNeedsOnboarding(true)
        }
        if (openSessionRes.data) setOpenWorkout(openSessionRes.data as OpenWorkout)
        if (nextScheduledRes.data) setNextScheduled(nextScheduledRes.data as NextScheduledWorkout)
        setBaseline({
          hasPhysique: (physiqueRes.count ?? 0) > 0,
          hasSubstances: (substancesRes.count ?? 0) > 0,
          hasBloodwork: (bloodworkRes.count ?? 0) > 0,
        })

        // Compute personalized calorie target from profile data
        const identity = (onboardingDataRes.data?.identity_data || {}) as Record<string, unknown>
        const rhythm = (onboardingDataRes.data?.rhythm_data || {}) as Record<string, unknown>
        const inferredGoal = inferCalorieGoalFromText(onboardingDataRes.data?.first_goal ?? null)
        // Roll up average daily ACTIVE (move) calories from the wearable. TDEE is then
        // computed as BMR + this avg (robust vs Apple's double-counted total energy).
        // Skip today (incomplete day). Clamp per-day to ignore obvious double-count spikes.
        const biometricRows = ((biometricsRes as { data?: Array<{ active_calories: number | null; for_date: string }> | null })?.data) || []
        let wearableActive: number | null = null
        if (biometricRows.length > 0) {
          const todayStr = new Date().toISOString().slice(0, 10)
          const eligible = biometricRows.filter((r) => r.active_calories != null && r.active_calories > 50 && r.for_date !== todayStr)
          if (eligible.length >= 1) {
            const sum = eligible.reduce((a, r) => a + Math.min(2500, r.active_calories || 0), 0)
            wearableActive = Math.round(sum / eligible.length)
          }
        }
        const target = computeCalorieTarget({
          age: identity.age ? Number(identity.age) : null,
          sex: 'male',
          weight_kg: identity.weight_kg ? Number(identity.weight_kg) : null,
          height_cm: identity.height_cm ? Number(identity.height_cm) : null,
          training_days_per_week: rhythm.training_days_per_week ? Number(rhythm.training_days_per_week) : null,
          goal: inferredGoal,
          wearable_active_kcal: wearableActive,
        })
        setCalTarget(target)
        if (bioLatestRes && (bioLatestRes as { data?: BioSnapshot | null }).data) {
          setBio((bioLatestRes as { data: BioSnapshot }).data)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  async function addWater(ml: number) {
    if (addingWater !== null) return
    setAddingWater(ml)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error: insErr } = await supabase.from('intake_events').insert({
        user_id: user.id,
        item: ml >= 1000 ? `Water (${(ml / 1000).toFixed(ml % 1000 === 0 ? 0 : 1)} L)` : `Water (${ml} ml)`,
        qty_text: ml >= 1000 ? `${(ml / 1000).toFixed(ml % 1000 === 0 ? 0 : 1)} L` : `${ml} ml`,
        water_ml: ml,
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        parsed_by: 'quick_log',
      })
      if (insErr) throw new Error(insErr.message)
      // Optimistic update — daily_summary trigger will catch up
      setToday(t => ({ ...t, water_ml_total: (t.water_ml_total || 0) + ml }))
    } catch (e) {
      console.error('[home] water log failed:', e)
    } finally {
      setAddingWater(null)
    }
  }

  async function endOpenWorkout() {
    if (!openWorkout) return
    const startedAt = new Date(openWorkout.started_at)
    const endedAt = new Date(startedAt.getTime() + 60 * 60 * 1000).toISOString()
    await supabase.from('workout_sessions').update({
      ended_at: endedAt,
      mood_post: 'auto-ended',
    }).eq('id', openWorkout.id)
    setOpenWorkout(null)
  }

  // Personalized macro targets from calorie engine — falls back to DEFAULT_GOALS when profile incomplete
  const goals = calTarget && calTarget.is_complete ? {
    calories: calTarget.target,
    protein_g: calTarget.protein_g_target,
    carbs_g: calTarget.carbs_g_target,
    fat_g: calTarget.fat_g_target,
    water_ml: DEFAULT_GOALS.water_ml,
  } : DEFAULT_GOALS

  const macros = [
    { label: 'Protein', value: today.protein_g_total, goal: goals.protein_g, unit: 'g', icon: Beef, color: 'text-cyan-400' },
    { label: 'Carbs', value: today.carbs_g_total, goal: goals.carbs_g, unit: 'g', icon: Wheat, color: 'text-violet-400' },
    { label: 'Fat', value: today.fat_g_total, goal: goals.fat_g, unit: 'g', icon: Droplet, color: 'text-rose-400' },
    { label: 'Water', value: Math.round((today.water_ml_total || 0) / 100) / 10, goal: goals.water_ml / 1000, unit: 'L', icon: Droplets, color: 'text-blue-400' },
  ]

  const caloriesRemaining = goals.calories - today.calories_total
  const caloriesPctOfTarget = goals.calories > 0 ? (today.calories_total / goals.calories) * 100 : 0

  // Fire a one-shot goal-hit burst the first time today crosses 95% of calorie target.
  // Uses localStorage so it only triggers once per local date.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (loading) return
    if (goals.calories <= 0) return
    if (caloriesPctOfTarget < 95) return
    const todayKey = getLocalDateString(new Date(), getUserTimezone())
    const flagKey = `vitals:goal-hit:${todayKey}`
    try {
      if (localStorage.getItem(flagKey)) return
      localStorage.setItem(flagKey, '1')
      celebrate.goal()
    } catch { /* private mode — skip */ }
  }, [loading, goals.calories, caloriesPctOfTarget])

  const baselineDone = baseline.hasPhysique && baseline.hasSubstances && baseline.hasBloodwork
  // Don't render checklist until baseline status is loaded — otherwise it flashes
  // "0 of 3 complete" on every navigation back to home, even when fully done.
  const showBaselineChecklist = !loading && !needsOnboarding && !baselineDone
  const baselineSteps = [
    {
      key: 'physique',
      done: baseline.hasPhysique,
      href: '/progress',
      icon: Camera,
      title: 'Take baseline body photos',
      sub: '4 angles — front, sides, back. AI gives you BF% + muscle dev.',
      accent: 'rose',
    },
    {
      key: 'substances',
      done: baseline.hasSubstances,
      href: '/substances',
      icon: FlaskConical,
      title: 'Build your stack',
      sub: 'Log every substance — doses, frequency, route, schedule.',
      accent: 'cyan',
    },
    {
      key: 'bloodwork',
      done: baseline.hasBloodwork,
      href: '/bloodwork',
      icon: Activity,
      title: 'Upload your latest bloodwork',
      sub: 'AI parses every marker, flags out-of-range values.',
      accent: 'amber',
    },
  ] as const

  const intelligenceLinks = [
    { href: '/substances', icon: FlaskConical, label: 'Stack', color: 'text-cyan-400' },
    { href: '/practices', icon: Sparkles, label: 'Practices', color: 'text-violet-400' },
    { href: '/rediagnosis', icon: Brain, label: 'Rediagnosis', color: 'text-amber-400' },
  ]

  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Morning' : now.getHours() < 17 ? 'Afternoon' : 'Evening'
  const trial = isTrialing(profile)
  const trialDays = trialDaysLeft(profile)
  const name = profile?.display_name?.split('@')[0] || 'there'

  return (
    <div className="px-4 pt-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/50 text-sm">{greeting}, {name}</p>
          <h1 className="text-2xl font-bold tracking-tight text-white">VITALS</h1>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="outline" className="border-amber-400/30 text-amber-400 text-xs tabular-nums">
            {now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Badge>
          {profile && (
            <Link href="/billing">
              <Badge variant="outline" className="border-violet-400/30 text-violet-300 text-[10px] capitalize tabular-nums">
                {profile.tier}{trial ? ` · ${trialDays}d trial` : ''}
              </Badge>
            </Link>
          )}
        </div>
      </div>

      {/* Open workout banner */}
      {openWorkout && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-emerald-400/30 bg-emerald-500/10">
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-emerald-100">Workout in progress</p>
                  <p className="text-[11px] text-emerald-200/70 truncate">
                    {openWorkout.focus || 'General'} · started{' '}
                    {Math.round((Date.now() - new Date(openWorkout.started_at).getTime()) / 60000)}m ago
                  </p>
                </div>
              </div>
              <div className="flex gap-1.5">
                <Link
                  href={`/workout/active?session=${openWorkout.id}`}
                  className="text-xs font-semibold px-3 py-1.5 rounded-md bg-emerald-400 text-black hover:bg-emerald-300"
                >
                  Resume
                </Link>
                <button
                  onClick={endOpenWorkout}
                  className="text-xs px-2.5 py-1.5 rounded-md text-emerald-200 hover:bg-emerald-500/20"
                >
                  End
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Next scheduled workout — only when no active session is running. */}
      {!openWorkout && nextScheduled && (
        <Link href="/workout">
          <Card className="border-amber-400/30 bg-gradient-to-r from-amber-400/10 to-amber-400/5 cursor-pointer hover:from-amber-400/20 hover:to-amber-400/10 transition-colors">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center flex-shrink-0">
                <Dumbbell className="text-amber-400" size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {nextScheduled.focus || 'Workout'} scheduled
                </p>
                <p className="text-[11px] text-amber-200/80">
                  {friendlyWhenHome(nextScheduled.scheduled_at)}
                </p>
              </div>
              <Calendar className="text-amber-400/60 flex-shrink-0" size={16} />
            </CardContent>
          </Card>
        </Link>
      )}

      {needsOnboarding && (
        <Link href="/onboarding">
          <Card className="border-amber-400/30 bg-gradient-to-r from-amber-400/10 to-violet-400/10 cursor-pointer hover:from-amber-400/20 hover:to-violet-400/20 transition-colors">
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Finish setting up VITALS</p>
                <p className="text-[11px] text-white/60">7-step onboarding · ~6 min</p>
              </div>
              <ChevronRight className="text-amber-400" size={20} />
            </CardContent>
          </Card>
        </Link>
      )}

      {showBaselineChecklist && (
        <Card className="border-white/10 bg-gradient-to-b from-white/5 to-white/[0.02]">
          <CardContent className="pt-4 pb-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">Set up your baseline</p>
                <p className="text-[11px] text-white/50">
                  {baselineSteps.filter(s => s.done).length} of {baselineSteps.length} complete — finish all 3 for full intelligence
                </p>
              </div>
              <Sparkles size={18} className="text-amber-400/60" />
            </div>
            <div className="space-y-1.5">
              {baselineSteps.map(step => {
                const Icon = step.icon
                const accentBorder =
                  step.accent === 'rose' ? 'border-rose-400/30 hover:bg-rose-500/5' :
                  step.accent === 'cyan' ? 'border-cyan-400/30 hover:bg-cyan-500/5' :
                  'border-amber-400/30 hover:bg-amber-500/5'
                const accentIcon =
                  step.accent === 'rose' ? 'text-rose-400' :
                  step.accent === 'cyan' ? 'text-cyan-400' :
                  'text-amber-400'
                return (
                  <Link
                    key={step.key}
                    href={step.href}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border bg-white/[0.02] transition-colors ${
                      step.done ? 'border-emerald-400/30 bg-emerald-500/5' : accentBorder
                    }`}
                  >
                    {step.done ? (
                      <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Circle size={18} className="text-white/30 flex-shrink-0" />
                    )}
                    <Icon size={16} className={step.done ? 'text-emerald-400/70' : accentIcon} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-semibold ${step.done ? 'text-white/60 line-through' : 'text-white'}`}>
                        {step.title}
                      </p>
                      {!step.done && (
                        <p className="text-[10px] text-white/50 truncate">{step.sub}</p>
                      )}
                    </div>
                    {!step.done && <ChevronRight size={14} className="text-white/30 flex-shrink-0" />}
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Coach — daily cross-data intelligence. The WOW card. */}
      {!needsOnboarding && <CoachInsightCard />}

      {/* Recovery snapshot — your body data, front and center. Taps through to full Recovery. */}
      {!needsOnboarding && bio && (bio.hrv_rmssd != null || bio.rhr_bpm != null || bio.steps != null || bio.sleep_total_min != null || bio.active_calories != null) && (
        <Link href="/recovery" className="block">
          <Card className="border-rose-400/20 bg-gradient-to-br from-rose-500/[0.05] to-cyan-500/[0.03] hover:brightness-110 transition-all active:scale-[0.99]">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider font-bold text-rose-300 flex items-center gap-1.5">
                  <Heart size={11} /> Recovery · {bio.for_date}
                </p>
                <ChevronRight size={13} className="text-white/30" />
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center">
                  <p className="text-[9px] uppercase tracking-wider text-white/40">HRV</p>
                  <p className="text-sm font-bold text-cyan-300 tabular-nums leading-tight">{bio.hrv_rmssd != null ? Math.round(bio.hrv_rmssd) : '—'}<span className="text-[9px] text-white/30 font-normal"> ms</span></p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] uppercase tracking-wider text-white/40">RHR</p>
                  <p className="text-sm font-bold text-rose-300 tabular-nums leading-tight">{bio.rhr_bpm != null ? bio.rhr_bpm : '—'}<span className="text-[9px] text-white/30 font-normal"> bpm</span></p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] uppercase tracking-wider text-white/40">Sleep</p>
                  <p className="text-sm font-bold text-indigo-300 tabular-nums leading-tight">{bio.sleep_total_min != null ? (bio.sleep_total_min/60).toFixed(1) : '—'}<span className="text-[9px] text-white/30 font-normal"> h</span></p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] uppercase tracking-wider text-white/40">Steps</p>
                  <p className="text-sm font-bold text-sky-300 tabular-nums leading-tight">{bio.steps != null ? (bio.steps/1000).toFixed(1) : '—'}<span className="text-[9px] text-white/30 font-normal"> k</span></p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Forgot to log yesterday? One-tap catch-up. Keeps the coach's data honest. */}
      {!needsOnboarding && (
        <Link
          href={`/food-search?date=${yesterdayStr()}`}
          className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 hover:bg-white/[0.06] transition-colors active:scale-[0.99]"
        >
          <div className="flex items-center gap-2.5">
            <Calendar size={15} className="text-white/40" />
            <span className="text-xs text-white/60">Forgot to log yesterday? <span className="text-white/80 font-semibold">Catch up</span></span>
          </div>
          <ChevronRight size={14} className="text-white/30" />
        </Link>
      )}

      {/* Calorie hero — personalized target, with remaining/over indicator */}
      {loading ? (
        <SkeletonCard />
      ) : (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="pt-5 pb-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/50 text-xs uppercase tracking-wider">Today</p>
                <p className="text-3xl font-bold text-amber-400 tabular-nums">
                  {today.calories_total.toLocaleString()}
                  <span className="text-sm text-white/40 font-normal ml-1">/ {goals.calories.toLocaleString()} kcal</span>
                </p>
                {calTarget && (
                  <div className="text-[10px] text-white/40 mt-0.5 leading-tight flex items-center gap-1.5 flex-wrap">
                    {calTarget.is_complete ? (
                      <>
                        <span>
                          TDEE {calTarget.tdee.toLocaleString()} kcal
                          {calTarget.tdee_source === 'wearable' && (
                            <span className="ml-1 px-1 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[8px] uppercase tracking-wider font-bold align-middle">
                              from wearable
                            </span>
                          )}
                          {calTarget.delta !== 0 && (
                            <span className={calTarget.delta < 0 ? 'text-rose-300' : 'text-emerald-300'}>
                              {' '}· {calTarget.delta < 0 ? '' : '+'}{calTarget.delta} kcal goal
                            </span>
                          )}
                        </span>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowCalMath(true) }}
                          className="inline-flex items-center gap-0.5 text-amber-300/70 hover:text-amber-200 underline decoration-dotted underline-offset-2"
                          aria-label="Show calorie math"
                        >
                          <Info size={10} /> Why?
                        </button>
                      </>
                    ) : (
                      <span className="text-amber-300/70">Add age/height/weight in profile for personalized target</span>
                    )}
                  </div>
                )}
              </div>
              <Zap size={32} className="text-amber-400/30" />
            </div>
            <Progress
              value={Math.min(100, caloriesPctOfTarget)}
              className="h-2 bg-white/10"
            />
            <p className={`text-[11px] tabular-nums ${
              caloriesRemaining > 200 ? 'text-emerald-300' :
              caloriesRemaining > 0 ? 'text-amber-300' :
              caloriesRemaining > -200 ? 'text-orange-300' :
              'text-rose-300'
            }`}>
              {caloriesRemaining > 0
                ? `${caloriesRemaining.toLocaleString()} kcal remaining`
                : caloriesRemaining === 0
                ? 'On target'
                : `${Math.abs(caloriesRemaining).toLocaleString()} kcal over`}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Macro Grid */}
      <div className="grid grid-cols-2 gap-3">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border-white/10 bg-white/5">
                <CardContent className="p-3 space-y-2">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-1 w-full mt-2" />
                </CardContent>
              </Card>
            ))
          : macros.map(({ label, value, goal, unit, icon: Icon, color }) => (
              <Card key={label} className="border-white/10 bg-white/5">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/50 text-xs">{label}</span>
                    <Icon size={14} className={color} />
                  </div>
                  <p className={`text-xl font-bold tabular-nums ${color}`}>
                    {typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(1)) : value}
                    <span className="text-xs text-white/30 font-normal ml-0.5">{unit}</span>
                  </p>
                  <Progress
                    value={Math.min(100, (Number(value) / goal) * 100)}
                    className="h-1 mt-2 bg-white/10"
                  />
                  <p className="text-[10px] text-white/30 mt-1">goal: {goal}{unit}</p>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Quick water log — one tap, no forms */}
      <Card className="border-blue-400/20 bg-blue-500/[0.04]">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-blue-200 font-bold flex items-center gap-1.5">
              <Droplets size={12} /> Quick water
            </p>
            <p className="text-[10px] text-white/40 tabular-nums">
              {Math.round((today.water_ml_total || 0) / 100) / 10} L today · goal {goals.water_ml / 1000} L
            </p>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[250, 500, 750, 1000].map((ml) => (
              <button
                key={ml}
                onClick={() => addWater(ml)}
                disabled={addingWater !== null}
                className="flex items-center justify-center gap-1 py-2.5 rounded-md bg-blue-500/10 border border-blue-400/30 text-blue-200 text-xs font-bold tabular-nums hover:bg-blue-500/20 active:scale-95 transition-all disabled:opacity-50"
              >
                {addingWater === ml ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <><Plus size={10} strokeWidth={3} />{ml >= 1000 ? `${ml/1000} L` : `${ml} ml`}</>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Intelligence */}
      <div>
        <p className="text-white/40 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Activity size={11} /> Intelligence
        </p>
        <div className="grid grid-cols-3 gap-2">
          {intelligenceLinks.map(({ href, icon: Icon, label, color }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors active:scale-95"
            >
              <Icon size={20} className={color} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Why this calorie number? — math transparency modal */}
      {showCalMath && calTarget && calTarget.is_complete && (
        <div
          className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
          onClick={() => setShowCalMath(false)}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-zinc-950 border border-amber-400/20 rounded-2xl p-4 space-y-3 max-h-[85vh] overflow-y-auto safe-bottom"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-white">Where this number comes from</p>
                <p className="text-[10px] text-white/40">Mifflin-St Jeor BMR × activity × your stated goal.</p>
              </div>
              <button
                onClick={() => setShowCalMath(false)}
                className="text-white/40 hover:text-white/80 p-1.5 rounded-md hover:bg-white/5 flex-shrink-0"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2 text-[12px]">
              {calTarget.tdee_source === 'wearable' ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">BMR (resting burn)</span>
                    <span className="text-white font-mono tabular-nums">{calTarget.bmr.toLocaleString()} kcal</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">+ Active (Apple Watch avg)</span>
                    <span className="text-emerald-300 font-mono tabular-nums">{Math.max(0, calTarget.tdee - calTarget.bmr).toLocaleString()} kcal</span>
                  </div>
                  <div className="border-t border-white/10 pt-2 flex items-center justify-between">
                    <span className="text-white/60">= TDEE (measured)</span>
                    <span className="text-emerald-300 font-mono tabular-nums font-bold">{calTarget.tdee.toLocaleString()} kcal</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">BMR (resting burn)</span>
                    <span className="text-white font-mono tabular-nums">{calTarget.bmr.toLocaleString()} kcal</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Activity multiplier</span>
                    <span className="text-white font-mono tabular-nums">
                      ×{' '}
                      {calTarget.activity_level === 'sedentary' && '1.20 (sedentary)'}
                      {calTarget.activity_level === 'light' && '1.375 (light)'}
                      {calTarget.activity_level === 'moderate' && '1.55 (moderate)'}
                      {calTarget.activity_level === 'active' && '1.725 (active)'}
                      {calTarget.activity_level === 'very_active' && '1.90 (very active)'}
                    </span>
                  </div>
                  <div className="border-t border-white/10 pt-2 flex items-center justify-between">
                    <span className="text-white/60">= TDEE (estimated)</span>
                    <span className="text-amber-300 font-mono tabular-nums font-bold">{calTarget.tdee.toLocaleString()} kcal</span>
                  </div>
                </>
              )}
              {calTarget.delta !== 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Goal delta</span>
                    <span className={`font-mono tabular-nums ${calTarget.delta < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                      {calTarget.delta > 0 ? '+' : ''}{calTarget.delta} kcal/day
                    </span>
                  </div>
                  <div className="border-t border-white/10 pt-2 flex items-center justify-between">
                    <span className="text-white/60 font-bold">= Daily target</span>
                    <span className="text-amber-400 font-mono tabular-nums font-bold text-base">{calTarget.target.toLocaleString()} kcal</span>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5 space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Macro targets</p>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <p className="text-rose-300 font-mono tabular-nums font-bold">{calTarget.protein_g_target}g</p>
                  <p className="text-[9px] text-white/40 uppercase tracking-wider">Protein</p>
                </div>
                <div>
                  <p className="text-amber-300 font-mono tabular-nums font-bold">{calTarget.carbs_g_target}g</p>
                  <p className="text-[9px] text-white/40 uppercase tracking-wider">Carbs</p>
                </div>
                <div>
                  <p className="text-cyan-300 font-mono tabular-nums font-bold">{calTarget.fat_g_target}g</p>
                  <p className="text-[9px] text-white/40 uppercase tracking-wider">Fat</p>
                </div>
              </div>
            </div>

            <div className="text-[10px] text-white/50 space-y-1.5 leading-relaxed">
              <p>
                <span className="font-bold text-white/70">Activity tier</span> is auto-set from your weekly training days in onboarding. Edit it in your profile if it feels off.
              </p>
              <p>
                {calTarget.tdee_source === 'wearable' ? (
                  <>
                    <span className="font-bold text-emerald-300">Live read:</span> pulling actual daily burn from your Apple Watch via Health Auto Export. This adapts as your training load shifts — no need to manually edit activity level.
                  </>
                ) : (
                  <>
                    <span className="font-bold text-white/70">Heads up:</span> this is a baseline estimate. Once Health Auto Export starts pushing your daily total calories, the number switches to live wearable data automatically.
                  </>
                )}
              </p>
              <p>
                <span className="font-bold text-white/70">If your weight isn&apos;t moving:</span> trust the trend over the number. ±100 kcal across a couple weeks beats chasing daily accuracy.
              </p>
            </div>

            <button
              onClick={() => setShowCalMath(false)}
              className="w-full py-2.5 rounded-lg bg-amber-400/15 border border-amber-400/40 text-amber-200 text-xs uppercase tracking-wider font-bold hover:bg-amber-400/25"
            >
              Got it
            </button>
          </motion.div>
        </div>
      )}
    </div>
  )
}

// Friendly relative time for the home "next scheduled workout" pill.
function friendlyWhenHome(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffMin = Math.round(diffMs / 60000)
  const diffHr = Math.round(diffMs / 3600000)
  const sameDay = d.toDateString() === now.toDateString()
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
  const isTomorrow = d.toDateString() === tomorrow.toDateString()
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (sameDay) {
    if (diffMin < 60 && diffMin >= 0) return `In ${diffMin}m · today ${time}`
    return `Today, ${time} (in ${diffHr}h)`
  }
  if (isTomorrow) return `Tomorrow, ${time}`
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  return `${dateStr}, ${time}`
}

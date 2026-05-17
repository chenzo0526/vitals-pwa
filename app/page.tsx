'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Zap, Beef, Wheat, Droplet, Droplets, Brain, FlaskConical, Sparkles, Activity, ChevronRight, Camera, CheckCircle2, Circle, Calendar, Dumbbell } from 'lucide-react'
import { UserProfile, isTrialing, trialDaysLeft } from '@/lib/tier'
import { getLocalDateString, getUserTimezone } from '@/lib/dates'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import CoachInsightCard from '@/components/CoachInsightCard'

const GOALS = { calories: 2400, protein_g: 180, carbs_g: 250, fat_g: 80, water_ml: 3000 }

type Today = {
  calories_total: number; protein_g_total: number; carbs_g_total: number; fat_g_total: number; water_ml_total: number
}

type OpenWorkout = { id: string; focus: string | null; started_at: string }
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

  useEffect(() => {
    async function fetchAll() {
      try {
        const dateStr = getLocalDateString()
        const { data: { user } } = await supabase.auth.getUser()
        const uid = user?.id

        const sixHoursAgoIso = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
        const nowIso = new Date().toISOString()
        const [summaryRes, profileRes, onbRes, openSessionRes, physiqueRes, substancesRes, bloodworkRes, nextScheduledRes] = await Promise.all([
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
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

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

  const macros = [
    { label: 'Protein', value: today.protein_g_total, goal: GOALS.protein_g, unit: 'g', icon: Beef, color: 'text-cyan-400' },
    { label: 'Carbs', value: today.carbs_g_total, goal: GOALS.carbs_g, unit: 'g', icon: Wheat, color: 'text-violet-400' },
    { label: 'Fat', value: today.fat_g_total, goal: GOALS.fat_g, unit: 'g', icon: Droplet, color: 'text-rose-400' },
    { label: 'Water', value: Math.round((today.water_ml_total || 0) / 100) / 10, goal: GOALS.water_ml / 1000, unit: 'L', icon: Droplets, color: 'text-blue-400' },
  ]

  const baselineDone = baseline.hasPhysique && baseline.hasSubstances && baseline.hasBloodwork
  const showBaselineChecklist = !needsOnboarding && !baselineDone
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

      {/* Calorie hero */}
      {loading ? (
        <SkeletonCard />
      ) : (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-white/50 text-xs uppercase tracking-wider">Today</p>
                <p className="text-3xl font-bold text-amber-400 tabular-nums">
                  {today.calories_total.toLocaleString()}
                  <span className="text-sm text-white/40 font-normal ml-1">/ {GOALS.calories} kcal</span>
                </p>
              </div>
              <Zap size={32} className="text-amber-400/30" />
            </div>
            <Progress
              value={Math.min(100, (today.calories_total / GOALS.calories) * 100)}
              className="h-2 bg-white/10"
            />
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

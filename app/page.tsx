'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Zap, Beef, Wheat, Droplets, Brain, FlaskConical, Sparkles, Activity, ChevronRight } from 'lucide-react'
import { UserProfile, isTrialing, trialDaysLeft } from '@/lib/tier'
import { getLocalDateString, getUserTimezone } from '@/lib/dates'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'

const GOALS = { calories: 2400, protein_g: 180, carbs_g: 250, fat_g: 80, water_ml: 3000 }

type Today = {
  calories_total: number; protein_g_total: number; carbs_g_total: number; fat_g_total: number; water_ml_total: number
}

type OpenWorkout = { id: string; focus: string | null; started_at: string }

export default function HomePage() {
  const [today, setToday] = useState<Today>({
    calories_total: 0, protein_g_total: 0, carbs_g_total: 0, fat_g_total: 0, water_ml_total: 0,
  })
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [loading, setLoading] = useState(true)
  const [openWorkout, setOpenWorkout] = useState<OpenWorkout | null>(null)

  useEffect(() => {
    async function fetchAll() {
      try {
        const dateStr = getLocalDateString()
        const { data: { user } } = await supabase.auth.getUser()
        const uid = user?.id

        const sixHoursAgoIso = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
        const [summaryRes, profileRes, onbRes, openSessionRes] = await Promise.all([
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
    { label: 'Calories', value: today.calories_total, goal: GOALS.calories, unit: 'kcal', icon: Zap, color: 'text-amber-400' },
    { label: 'Protein', value: today.protein_g_total, goal: GOALS.protein_g, unit: 'g', icon: Beef, color: 'text-cyan-400' },
    { label: 'Carbs', value: today.carbs_g_total, goal: GOALS.carbs_g, unit: 'g', icon: Wheat, color: 'text-violet-400' },
    { label: 'Water', value: Math.round((today.water_ml_total || 0) / 100) / 10, goal: GOALS.water_ml / 1000, unit: 'L', icon: Droplets, color: 'text-blue-400' },
  ]

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

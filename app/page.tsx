'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Zap, Beef, Wheat, Droplets, Camera, ScanLine, Mic, Dumbbell, TrendingUp, Brain, FlaskConical, Sparkles } from 'lucide-react'
import { UserProfile, isTrialing, trialDaysLeft } from '@/lib/tier'

const GOALS = { calories: 2400, protein_g: 180, carbs_g: 250, fat_g: 80, water_ml: 3000 }

type Today = {
  calories_total: number; protein_g_total: number; carbs_g_total: number; fat_g_total: number; water_ml_total: number
}

export default function HomePage() {
  const [today, setToday] = useState<Today>({
    calories_total: 0, protein_g_total: 0, carbs_g_total: 0, fat_g_total: 0, water_ml_total: 0,
  })
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      try {
        const dateStr = new Date().toISOString().split('T')[0]
        const { data: { user } } = await supabase.auth.getUser()
        const uid = user?.id
        const [summaryRes, profileRes, onbRes] = await Promise.all([
          supabase.from('daily_summary').select('*').eq('date', dateStr).maybeSingle(),
          uid
            ? supabase.from('user_profile').select('*').eq('id', uid).maybeSingle()
            : Promise.resolve({ data: null }),
          uid
            ? supabase.from('onboarding_progress').select('completed_at').eq('user_id', uid).maybeSingle()
            : Promise.resolve({ data: null }),
        ])
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
      } catch {
        // placeholder creds — show zeros
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const macros = [
    { label: 'Calories', value: today.calories_total, goal: GOALS.calories, unit: 'kcal', icon: Zap, color: 'text-amber-400' },
    { label: 'Protein', value: today.protein_g_total, goal: GOALS.protein_g, unit: 'g', icon: Beef, color: 'text-cyan-400' },
    { label: 'Carbs', value: today.carbs_g_total, goal: GOALS.carbs_g, unit: 'g', icon: Wheat, color: 'text-violet-400' },
    { label: 'Water', value: Math.round((today.water_ml_total || 0) / 100) / 10, goal: GOALS.water_ml / 1000, unit: 'L', icon: Droplets, color: 'text-blue-400' },
  ]

  const quickActions = [
    { href: '/food', icon: Camera, label: 'Plate', color: 'bg-amber-400/10 border-amber-400/20 text-amber-400' },
    { href: '/label', icon: ScanLine, label: 'Label', color: 'bg-cyan-400/10 border-cyan-400/20 text-cyan-400' },
    { href: '/voice', icon: Mic, label: 'Voice', color: 'bg-violet-400/10 border-violet-400/20 text-violet-400' },
    { href: '/workout', icon: Dumbbell, label: 'Lift', color: 'bg-green-400/10 border-green-400/20 text-green-400' },
    { href: '/progress', icon: TrendingUp, label: 'Body', color: 'bg-rose-400/10 border-rose-400/20 text-rose-400' },
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
  const name = profile?.display_name || 'Vincenzo'

  return (
    <div className="px-4 pt-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/50 text-sm">{greeting}, {name}</p>
          <h1 className="text-2xl font-bold tracking-tight text-white">VITALS</h1>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="outline" className="border-amber-400/30 text-amber-400 text-xs">
            {now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Badge>
          {profile && (
            <Link href="/billing">
              <Badge variant="outline" className="border-violet-400/30 text-violet-300 text-[10px] capitalize">
                {profile.tier}{trial ? ` · ${trialDays}d trial` : ''}
              </Badge>
            </Link>
          )}
        </div>
      </div>

      {needsOnboarding && (
        <Link href="/onboarding">
          <Card className="border-amber-400/30 bg-gradient-to-r from-amber-400/10 to-violet-400/10 cursor-pointer hover:from-amber-400/20 hover:to-violet-400/20 transition-colors">
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Finish setting up VITALS</p>
                <p className="text-[11px] text-white/60">7-step onboarding · ~6 min</p>
              </div>
              <Sparkles className="text-amber-400" size={20} />
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Calorie Ring / Main Stat */}
      <Card className="border-white/10 bg-white/5">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-white/50 text-xs uppercase tracking-wider">Today</p>
              <p className="text-3xl font-bold text-amber-400">
                {loading ? '—' : today.calories_total.toLocaleString()}
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

      {/* Macro Grid */}
      <div className="grid grid-cols-2 gap-3">
        {macros.map(({ label, value, goal, unit, icon: Icon, color }) => (
          <Card key={label} className="border-white/10 bg-white/5">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/50 text-xs">{label}</span>
                <Icon size={14} className={color} />
              </div>
              <p className={`text-xl font-bold ${color}`}>
                {loading ? '—' : typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(1)) : value}
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

      {/* Quick log */}
      <div>
        <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Log</p>
        <div className="grid grid-cols-5 gap-2">
          {quickActions.map(({ href, icon: Icon, label, color }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border ${color} transition-opacity hover:opacity-80 active:scale-95`}
            >
              <Icon size={20} />
              <span className="text-[9px] font-medium text-center leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Intelligence shortcuts */}
      <div>
        <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Intelligence</p>
        <div className="grid grid-cols-3 gap-2">
          {intelligenceLinks.map(({ href, icon: Icon, label, color }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
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

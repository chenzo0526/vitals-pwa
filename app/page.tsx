'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Zap, Beef, Wheat, Droplets, Camera, ScanLine, Mic, Dumbbell, TrendingUp } from 'lucide-react'
import Link from 'next/link'

const GOALS = { calories: 2400, protein_g: 180, carbs_g: 250, fat_g: 80, water_ml: 3000 }

export default function HomePage() {
  const [today, setToday] = useState({
    calories_total: 0, protein_g_total: 0, carbs_g_total: 0, fat_g_total: 0, water_ml_total: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchToday() {
      try {
        const dateStr = new Date().toISOString().split('T')[0]
        const { data } = await supabase
          .from('daily_summary')
          .select('*')
          .eq('date', dateStr)
          .single()
        if (data) {
          setToday({
            calories_total: data.calories_total || 0,
            protein_g_total: data.protein_g_total || 0,
            carbs_g_total: data.carbs_g_total || 0,
            fat_g_total: data.fat_g_total || 0,
            water_ml_total: data.water_ml_total || 0,
          })
        }
      } catch {
        // Placeholder creds — show zeros
      } finally {
        setLoading(false)
      }
    }
    fetchToday()
  }, [])

  const macros = [
    { label: 'Calories', value: today.calories_total, goal: GOALS.calories, unit: 'kcal', icon: Zap, color: 'text-amber-400' },
    { label: 'Protein', value: today.protein_g_total, goal: GOALS.protein_g, unit: 'g', icon: Beef, color: 'text-cyan-400' },
    { label: 'Carbs', value: today.carbs_g_total, goal: GOALS.carbs_g, unit: 'g', icon: Wheat, color: 'text-violet-400' },
    { label: 'Water', value: Math.round((today.water_ml_total || 0) / 100) / 10, goal: GOALS.water_ml / 1000, unit: 'L', icon: Droplets, color: 'text-blue-400' },
  ]

  const quickActions = [
    { href: '/food', icon: Camera, label: 'Snap Plate', color: 'bg-amber-400/10 border-amber-400/20 text-amber-400' },
    { href: '/label', icon: ScanLine, label: 'Scan Label', color: 'bg-cyan-400/10 border-cyan-400/20 text-cyan-400' },
    { href: '/voice', icon: Mic, label: 'Log Voice', color: 'bg-violet-400/10 border-violet-400/20 text-violet-400' },
    { href: '/workout', icon: Dumbbell, label: 'Log Lift', color: 'bg-green-400/10 border-green-400/20 text-green-400' },
    { href: '/progress', icon: TrendingUp, label: 'Body Check', color: 'bg-rose-400/10 border-rose-400/20 text-rose-400' },
  ]

  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Morning' : now.getHours() < 17 ? 'Afternoon' : 'Evening'

  return (
    <div className="px-4 pt-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/50 text-sm">{greeting}, Vincenzo</p>
          <h1 className="text-2xl font-bold tracking-tight text-white">VITALS</h1>
        </div>
        <Badge variant="outline" className="border-amber-400/30 text-amber-400 text-xs">
          {now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </Badge>
      </div>

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

      {/* Quick Actions */}
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
    </div>
  )
}

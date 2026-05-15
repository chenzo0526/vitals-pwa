'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { History, Flame, Beef, Dumbbell } from 'lucide-react'

type DaySummary = {
  date: string
  calories_total: number
  protein_g_total: number
  workout_count: number
}

function getCalColor(cals: number) {
  if (cals === 0) return 'bg-white/5'
  if (cals < 1600) return 'bg-amber-400/20'
  if (cals < 2000) return 'bg-amber-400/50'
  if (cals < 2400) return 'bg-amber-400/80'
  return 'bg-amber-400'
}

export default function HistoryPage() {
  const [summaries, setSummaries] = useState<DaySummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch7Days() {
      try {
        const dates = Array.from({ length: 7 }, (_, i) => {
          const d = new Date()
          d.setDate(d.getDate() - (6 - i))
          return d.toISOString().split('T')[0]
        })

        const { data } = await supabase
          .from('daily_summary')
          .select('date, calories_total, protein_g_total, workout_count')
          .in('date', dates)

        const mapped: DaySummary[] = dates.map((date) => {
          const found = data?.find((d) => d.date === date)
          return {
            date,
            calories_total: found?.calories_total || 0,
            protein_g_total: found?.protein_g_total || 0,
            workout_count: found?.workout_count || 0,
          }
        })
        setSummaries(mapped)
      } catch {
        // Placeholder: generate empty 7 days
        const empty = Array.from({ length: 7 }, (_, i) => {
          const d = new Date()
          d.setDate(d.getDate() - (6 - i))
          return { date: d.toISOString().split('T')[0], calories_total: 0, protein_g_total: 0, workout_count: 0 }
        })
        setSummaries(empty)
      } finally {
        setLoading(false)
      }
    }
    fetch7Days()
  }, [])

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="px-4 pt-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">7-Day History</h1>
        <History size={20} className="text-white/30" />
      </div>

      {/* Calorie Heatmap */}
      <Card className="border-white/10 bg-white/5">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm text-white/60 flex items-center gap-2">
            <Flame size={14} className="text-amber-400" /> Calorie Intake
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="grid grid-cols-7 gap-1.5">
            {(loading ? Array(7).fill({ date: '', calories_total: 0, protein_g_total: 0, workout_count: 0 }) : summaries).map((day, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className={`w-full aspect-square rounded-lg ${getCalColor(day.calories_total)} flex items-center justify-center`}>
                  {day.calories_total > 0 && (
                    <span className="text-[8px] font-bold text-black/70">{Math.round(day.calories_total / 100)}k</span>
                  )}
                </div>
                <span className="text-[9px] text-white/30">
                  {day.date ? dayLabels[new Date(day.date + 'T12:00:00').getDay()] : '—'}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1 mt-3 justify-end">
            <span className="text-[9px] text-white/30">0</span>
            {['bg-amber-400/20', 'bg-amber-400/50', 'bg-amber-400/80', 'bg-amber-400'].map((c, i) => (
              <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
            ))}
            <span className="text-[9px] text-white/30">2400+</span>
          </div>
        </CardContent>
      </Card>

      {/* Daily rows */}
      <div className="space-y-2">
        {(loading ? Array(7).fill(null) : [...summaries].reverse()).map((day, i) => {
          if (!day) return (
            <Card key={i} className="border-white/10 bg-white/5 animate-pulse">
              <CardContent className="py-3"><div className="h-4 bg-white/10 rounded" /></CardContent>
            </Card>
          )
          const isToday = day.date === new Date().toISOString().split('T')[0]
          return (
            <Card key={day.date} className={`border-white/10 ${isToday ? 'bg-amber-400/5 border-amber-400/20' : 'bg-white/5'}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-medium">
                        {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                      {isToday && <Badge className="text-[9px] bg-amber-400/20 text-amber-400 border-amber-400/30 py-0">Today</Badge>}
                    </div>
                    <div className="flex gap-3 mt-0.5">
                      <span className="text-amber-400 text-xs flex items-center gap-0.5">
                        <Flame size={10} /> {day.calories_total || '—'}
                      </span>
                      <span className="text-cyan-400 text-xs flex items-center gap-0.5">
                        <Beef size={10} /> {day.protein_g_total || '—'}g
                      </span>
                    </div>
                  </div>
                  {day.workout_count > 0 && (
                    <Badge className="bg-green-400/20 text-green-400 border-green-400/30 text-xs flex items-center gap-1">
                      <Dumbbell size={10} /> {day.workout_count}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

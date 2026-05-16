'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { History, Flame, Beef, Dumbbell } from 'lucide-react'
import { getLastNDates, getLocalDateString, parseLocalDate } from '@/lib/dates'
import { Skeleton } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'

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
      const dates = getLastNDates(7)
      try {
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
        const empty = dates.map((date) => ({
          date, calories_total: 0, protein_g_total: 0, workout_count: 0,
        }))
        setSummaries(empty)
      } finally {
        setLoading(false)
      }
    }
    fetch7Days()
  }, [])

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const hasAnyData = summaries.some((d) => d.calories_total > 0 || d.workout_count > 0)

  return (
    <div className="px-4 pt-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-white">7-Day History</h1>
        <History size={20} className="text-white/30" />
      </div>

      {/* Calorie Heatmap */}
      <Card className="border-white/10 bg-white/5">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-medium text-white/70 flex items-center gap-2">
            <Flame size={14} className="text-amber-400" /> Calorie Intake
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="grid grid-cols-7 gap-1.5">
            {loading
              ? Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <Skeleton className="w-full aspect-square rounded-lg" />
                    <Skeleton className="h-2 w-5" />
                  </div>
                ))
              : summaries.map((day, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03, duration: 0.22 }}
                    className="flex flex-col items-center gap-1"
                  >
                    <div className={`w-full aspect-square rounded-lg ${getCalColor(day.calories_total)} flex items-center justify-center`}>
                      {day.calories_total > 0 && (
                        <span className="text-[9px] font-bold text-black/70 tabular-nums">
                          {Math.round(day.calories_total / 100) / 10}k
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] text-white/30">
                      {day.date ? dayLabels[parseLocalDate(day.date).getDay()] : '—'}
                    </span>
                  </motion.div>
                ))}
          </div>
          <div className="flex items-center gap-1 mt-3 justify-end">
            <span className="text-[9px] text-white/30">0</span>
            {['bg-amber-400/20', 'bg-amber-400/50', 'bg-amber-400/80', 'bg-amber-400'].map((c, i) => (
              <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
            ))}
            <span className="text-[9px] text-white/30 tabular-nums">2400+</span>
          </div>
        </CardContent>
      </Card>

      {/* Daily rows */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Card key={i} className="border-white/10 bg-white/5">
              <CardContent className="py-3 space-y-1.5">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-2 w-1/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !hasAnyData ? (
        <EmptyState
          icon={Flame}
          title="No data this week yet"
          body="Log your first meal to see your week shape up. Tap the + button below to start."
          accent="amber"
        />
      ) : (
        <div className="space-y-2">
          {[...summaries].reverse().map((day) => {
            const isToday = day.date === getLocalDateString()
            return (
              <motion.div key={day.date} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                <Card className={`border-white/10 ${isToday ? 'bg-amber-400/5 border-amber-400/20' : 'bg-white/5'}`}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-white text-sm font-medium">
                            {parseLocalDate(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </p>
                          {isToday && <Badge className="text-[9px] bg-amber-400/20 text-amber-400 border-amber-400/30 py-0">Today</Badge>}
                        </div>
                        <div className="flex gap-3 mt-0.5">
                          <span className="text-amber-400 text-xs flex items-center gap-0.5 tabular-nums">
                            <Flame size={10} /> {day.calories_total || '—'}
                          </span>
                          <span className="text-cyan-400 text-xs flex items-center gap-0.5 tabular-nums">
                            <Beef size={10} /> {day.protein_g_total || '—'}g
                          </span>
                        </div>
                      </div>
                      {day.workout_count > 0 && (
                        <Badge className="bg-emerald-400/20 text-emerald-300 border-emerald-400/30 text-xs flex items-center gap-1 tabular-nums">
                          <Dumbbell size={10} /> {day.workout_count}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

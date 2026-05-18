'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ChevronLeft, Flame, Beef, Wheat, Droplet, Droplets, Loader2, Dumbbell, Sparkles, Heart, Activity, FlaskConical, Camera, Trash2,
} from 'lucide-react'
import { parseLocalDate } from '@/lib/dates'

type IntakeEvent = {
  id: string
  ts: string
  item: string
  qty_text: string | null
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  water_ml: number | null
  parsed_by: string | null
}

type WorkoutSession = {
  id: string
  focus: string | null
  started_at: string | null
  ended_at: string | null
  energy_pre: number | null
  energy_post: number | null
  notes: string | null
}

type WorkoutSet = {
  id: string
  session_id: string
  exercise_name: string
  set_number: number
  reps: number | null
  weight_lb: number | null
  rpe: number | null
}

type DailySummary = {
  date: string
  calories_total: number | null
  protein_g_total: number | null
  carbs_g_total: number | null
  fat_g_total: number | null
  water_ml_total: number | null
  workout_count: number | null
}

type PracticeSession = {
  id: string
  ts: string
  category: string
  practice_type: string
  duration_min: number | null
  intensity: number | null
}

type PhysiqueSnapshot = {
  id: string
  ts: string
  bf_percent_estimate: number | null
}

type DailyCheckin = {
  id: string
  for_date: string
  mood: number | null
  energy: number | null
  sleep_quality: number | null
  sleep_hours: number | null
  stress_level: number | null
  notes: string | null
}

export default function HistoryDetailPage() {
  const params = useParams<{ date: string }>()
  const date = params?.date

  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [intake, setIntake] = useState<IntakeEvent[]>([])
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([])
  const [setsBySession, setSetsBySession] = useState<Record<string, WorkoutSet[]>>({})
  const [practices, setPractices] = useState<PracticeSession[]>([])
  const [snapshots, setSnapshots] = useState<PhysiqueSnapshot[]>([])
  const [checkin, setCheckin] = useState<DailyCheckin | null>(null)

  useEffect(() => {
    if (!date) return
    (async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const dayStartIso = new Date(`${date}T00:00:00`).toISOString()
      const dayEndIso = new Date(`${date}T23:59:59.999`).toISOString()

      const [summaryRes, intakeRes, workoutsRes, practicesRes, snapshotsRes, checkinRes] = await Promise.all([
        supabase.from('daily_summary').select('*').eq('date', date).maybeSingle(),
        supabase.from('intake_events').select('*').eq('user_id', user.id).gte('ts', dayStartIso).lte('ts', dayEndIso).order('ts', { ascending: true }),
        supabase.from('workout_sessions').select('*').eq('user_id', user.id).gte('started_at', dayStartIso).lte('started_at', dayEndIso).order('started_at', { ascending: true }),
        supabase.from('practice_sessions').select('id, ts, category, practice_type, duration_min, intensity').eq('user_id', user.id).gte('ts', dayStartIso).lte('ts', dayEndIso).order('ts', { ascending: true }),
        supabase.from('physique_snapshots').select('id, ts, bf_percent_estimate').eq('user_id', user.id).gte('ts', dayStartIso).lte('ts', dayEndIso).order('ts', { ascending: true }),
        supabase.from('daily_checkins').select('*').eq('user_id', user.id).eq('for_date', date).maybeSingle(),
      ])

      if (summaryRes.data) setSummary(summaryRes.data as DailySummary)
      if (intakeRes.data) setIntake(intakeRes.data as IntakeEvent[])
      if (workoutsRes.data) setWorkouts(workoutsRes.data as WorkoutSession[])
      if (practicesRes.data) setPractices(practicesRes.data as PracticeSession[])
      if (snapshotsRes.data) setSnapshots(snapshotsRes.data as PhysiqueSnapshot[])
      if (checkinRes.data) setCheckin(checkinRes.data as DailyCheckin)

      // Pull sets for each workout
      if (workoutsRes.data && workoutsRes.data.length > 0) {
        const sessionIds = workoutsRes.data.map((w) => w.id)
        const { data: sets } = await supabase
          .from('workout_sets')
          .select('id, session_id, exercise_name, set_number, reps, weight_lb, rpe')
          .in('session_id', sessionIds)
          .order('set_number')
        if (sets) {
          const grouped: Record<string, WorkoutSet[]> = {}
          for (const s of sets) {
            if (!grouped[s.session_id]) grouped[s.session_id] = []
            grouped[s.session_id].push(s as WorkoutSet)
          }
          setSetsBySession(grouped)
        }
      }
      setLoading(false)
    })()
  }, [date])

  async function deleteIntake(id: string) {
    if (!confirm('Delete this entry? Macros will recalculate.')) return
    await supabase.from('intake_events').delete().eq('id', id)
    setIntake((arr) => arr.filter((i) => i.id !== id))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-amber-400" />
      </div>
    )
  }

  if (!date) return null
  const niceDate = parseLocalDate(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const totalWater = intake.reduce((s, i) => s + (i.water_ml || 0), 0)
  const hasAnything = intake.length > 0 || workouts.length > 0 || practices.length > 0 || snapshots.length > 0 || checkin

  return (
    <div className="px-4 pt-6 pb-12 space-y-4">
      <Link href="/history" className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1">
        <ChevronLeft size={12} /> History
      </Link>

      <div>
        <h1 className="text-xl font-bold tracking-tight">{niceDate}</h1>
        <p className="text-[11px] text-white/50 mt-0.5">Everything logged this day</p>
      </div>

      {/* Day summary */}
      {summary && (summary.calories_total || summary.protein_g_total || summary.carbs_g_total || summary.fat_g_total) && (
        <Card className="border-amber-400/20 bg-amber-400/5">
          <CardContent className="p-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">Daily Totals</p>
            <div className="grid grid-cols-4 gap-2">
              <Stat icon={Flame} label="kcal" value={summary.calories_total || 0} color="text-amber-400" />
              <Stat icon={Beef} label="P" value={summary.protein_g_total || 0} unit="g" color="text-cyan-400" />
              <Stat icon={Wheat} label="C" value={summary.carbs_g_total || 0} unit="g" color="text-violet-400" />
              <Stat icon={Droplet} label="F" value={summary.fat_g_total || 0} unit="g" color="text-rose-400" />
            </div>
            {totalWater > 0 && (
              <p className="text-[11px] text-blue-300 flex items-center gap-1 pt-1 border-t border-white/5">
                <Droplets size={11} /> {totalWater >= 1000 ? `${(totalWater/1000).toFixed(1)} L` : `${totalWater} ml`} water
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Daily check-in */}
      {checkin && (
        <Card className="border-violet-400/30 bg-violet-500/[0.04]">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider text-violet-300 font-bold flex items-center gap-1">
                <Sparkles size={11} /> Daily check-in
              </p>
              <Link href="/journal" className="text-[10px] uppercase tracking-wider text-white/40 hover:text-white/80">Open</Link>
            </div>
            <div className="grid grid-cols-4 gap-2 text-[11px]">
              {checkin.mood != null && <CheckinPill icon={Heart} label="Mood" value={checkin.mood} />}
              {checkin.energy != null && <CheckinPill icon={Activity} label="Energy" value={checkin.energy} />}
              {checkin.sleep_quality != null && <CheckinPill icon={Sparkles} label="Sleep" value={checkin.sleep_quality} />}
              {checkin.stress_level != null && <CheckinPill icon={Activity} label="Stress" value={checkin.stress_level} />}
            </div>
            {checkin.notes && (
              <p className="text-[11px] text-white/70 leading-relaxed whitespace-pre-line pt-1 border-t border-white/5">{checkin.notes}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Workouts */}
      {workouts.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold flex items-center gap-1">
            <Dumbbell size={11} /> Workouts ({workouts.length})
          </p>
          {workouts.map((w) => {
            const sets = setsBySession[w.id] || []
            const groupedByExercise: Record<string, WorkoutSet[]> = {}
            for (const s of sets) {
              if (!groupedByExercise[s.exercise_name]) groupedByExercise[s.exercise_name] = []
              groupedByExercise[s.exercise_name].push(s)
            }
            const startTime = w.started_at ? new Date(w.started_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''
            const durationMin = (w.started_at && w.ended_at)
              ? Math.round((new Date(w.ended_at).getTime() - new Date(w.started_at).getTime()) / 60000)
              : null
            return (
              <Card key={w.id} className="border-emerald-400/20 bg-emerald-500/5">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-emerald-100">{w.focus || 'Workout'}</p>
                    <div className="flex items-center gap-1 text-[10px] text-emerald-200/70 tabular-nums">
                      {startTime} {durationMin != null && `· ${durationMin}m`}
                    </div>
                  </div>
                  {w.energy_pre != null && (
                    <div className="flex items-center gap-2 text-[10px] text-white/50">
                      <span>Energy: {w.energy_pre}{w.energy_post != null && ` → ${w.energy_post}`}</span>
                    </div>
                  )}
                  {Object.entries(groupedByExercise).length > 0 ? (
                    <div className="space-y-1.5 pt-1 border-t border-white/5">
                      {Object.entries(groupedByExercise).map(([ex, exSets]) => (
                        <div key={ex}>
                          <p className="text-xs font-semibold text-white">{ex}</p>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {exSets.map((s) => (
                              <span key={s.id} className="text-[10px] tabular-nums px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/70">
                                {s.weight_lb != null ? `${s.weight_lb}lb` : ''}
                                {s.weight_lb != null && s.reps != null ? ' × ' : ''}
                                {s.reps != null ? `${s.reps}` : ''}
                                {s.rpe != null ? ` @ ${s.rpe}` : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-white/40 italic">No sets logged.</p>
                  )}
                  {w.notes && <p className="text-[11px] text-white/65 leading-relaxed pt-1 border-t border-white/5">{w.notes}</p>}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Intake events */}
      {intake.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-amber-300 font-bold flex items-center gap-1">
            <Flame size={11} /> Meals & drinks ({intake.length})
          </p>
          {intake.map((i) => (
            <Card key={i.id} className="border-white/10 bg-white/5">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{i.item}</p>
                    {i.qty_text && <p className="text-[11px] text-white/50 truncate">{i.qty_text}</p>}
                    <div className="flex flex-wrap gap-2 mt-1 text-[10px]">
                      {!!i.calories && <Badge variant="outline" className="border-amber-400/30 text-amber-300 py-0">{i.calories} kcal</Badge>}
                      {!!i.protein_g && <Badge variant="outline" className="border-cyan-400/30 text-cyan-300 py-0">P {i.protein_g}g</Badge>}
                      {!!i.carbs_g && <Badge variant="outline" className="border-violet-400/30 text-violet-300 py-0">C {i.carbs_g}g</Badge>}
                      {!!i.fat_g && <Badge variant="outline" className="border-rose-400/30 text-rose-300 py-0">F {i.fat_g}g</Badge>}
                      {!!i.water_ml && <Badge variant="outline" className="border-blue-400/30 text-blue-300 py-0">{i.water_ml >= 1000 ? `${(i.water_ml/1000).toFixed(1)}L` : `${i.water_ml}ml`}</Badge>}
                    </div>
                    <p className="text-[9px] text-white/30 mt-1 uppercase tracking-wider">
                      {new Date(i.ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      {i.parsed_by && ` · ${i.parsed_by}`}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteIntake(i.id)}
                    className="p-1.5 rounded-md text-rose-400/70 hover:text-rose-300 hover:bg-rose-500/10 flex-shrink-0"
                    aria-label="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Practices */}
      {practices.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-violet-300 font-bold flex items-center gap-1">
            <FlaskConical size={11} /> Practices ({practices.length})
          </p>
          {practices.map((p) => (
            <Card key={p.id} className="border-white/10 bg-white/5">
              <CardContent className="p-2.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white capitalize">{p.practice_type}</p>
                  <p className="text-[10px] text-white/50 capitalize">{p.category.replace('_', ' ')}</p>
                </div>
                <div className="text-[11px] text-white/60 tabular-nums">
                  {p.duration_min ? `${p.duration_min}m` : ''} {p.intensity ? `· I${p.intensity}` : ''}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Body checks */}
      {snapshots.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-rose-300 font-bold flex items-center gap-1">
            <Camera size={11} /> Body checks ({snapshots.length})
          </p>
          {snapshots.map((s) => (
            <Card key={s.id} className="border-rose-400/20 bg-rose-500/5">
              <CardContent className="p-2.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-rose-100">Physique snapshot</p>
                  <p className="text-[10px] text-white/50">{new Date(s.ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                </div>
                {s.bf_percent_estimate != null && (
                  <p className="text-base font-bold text-rose-400 tabular-nums">{s.bf_percent_estimate}%</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!hasAnything && (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-white/60">Nothing logged on this day.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Stat({ icon: Icon, label, value, unit, color }: { icon: typeof Flame; label: string; value: number; unit?: string; color: string }) {
  return (
    <div className="text-center">
      <Icon size={11} className={color + ' mx-auto'} />
      <p className={`text-base font-bold tabular-nums ${color}`}>{Math.round(value)}{unit && <span className="text-[10px] font-normal opacity-60 ml-0.5">{unit}</span>}</p>
      <p className="text-[9px] uppercase tracking-wider text-white/40">{label}</p>
    </div>
  )
}

function CheckinPill({ icon: Icon, label, value }: { icon: typeof Heart; label: string; value: number }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-md p-1.5 text-center">
      <Icon size={10} className="text-violet-300 mx-auto" />
      <p className="text-sm font-bold text-violet-200 tabular-nums">{value}</p>
      <p className="text-[8px] uppercase tracking-wider text-white/40">{label}</p>
    </div>
  )
}

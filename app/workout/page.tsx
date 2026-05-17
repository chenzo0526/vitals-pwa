'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Play, Loader2, Calendar, Clock, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

type ScheduledWorkout = {
  id: string
  focus: string | null
  scheduled_at: string
}

type Mode = 'now' | 'later'

const FOCUS_PRESETS = ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Conditioning', 'Full body']

// Default scheduled time = tomorrow 7am local.
function defaultScheduleLocal(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(7, 0, 0, 0)
  // Format YYYY-MM-DDTHH:mm for <input type="datetime-local">.
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function WorkoutPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [mode, setMode] = useState<Mode>('now')
  const [focus, setFocus] = useState('')
  const [energyPre, setEnergyPre] = useState(7)
  const [scheduleLocal, setScheduleLocal] = useState<string>(defaultScheduleLocal())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [upcoming, setUpcoming] = useState<ScheduledWorkout[]>([])

  // Auto-end any of this user's STARTED workout_sessions that have been open >6 hours.
  // Scheduled-but-not-started rows are NOT auto-ended (started_at is null on those).
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const sixHoursAgoIso = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
      const { data: stale } = await supabase
        .from('workout_sessions')
        .select('id, started_at')
        .is('ended_at', null)
        .not('started_at', 'is', null)
        .lt('started_at', sixHoursAgoIso)
      if (!stale || stale.length === 0) return
      for (const s of stale) {
        const endedAt = new Date(new Date(s.started_at!).getTime() + 60 * 60 * 1000).toISOString()
        await supabase.from('workout_sessions').update({
          ended_at: endedAt,
          mood_post: 'auto-ended',
        }).eq('id', s.id)
      }
    })()
  }, [])

  async function loadUpcoming() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const nowIso = new Date().toISOString()
    const sevenDaysIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('workout_sessions')
      .select('id, focus, scheduled_at')
      .eq('user_id', user.id)
      .is('started_at', null)
      .not('scheduled_at', 'is', null)
      .gte('scheduled_at', nowIso)
      .lte('scheduled_at', sevenDaysIso)
      .order('scheduled_at', { ascending: true })
    if (data) setUpcoming(data as ScheduledWorkout[])
  }

  useEffect(() => { loadUpcoming() }, [])

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login?redirect=/workout')
        return
      }

      if (mode === 'now') {
        const { data, error: insertErr } = await supabase
          .from('workout_sessions')
          .insert({
            focus: focus || null,
            energy_pre: energyPre,
            started_at: new Date().toISOString(),
            user_id: user.id,
          })
          .select()
          .single()
        if (insertErr || !data) throw new Error(insertErr?.message || 'Could not start session')
        router.push(`/workout/active?session=${data.id}`)
        return
      }

      // Scheduled — convert local datetime input to ISO.
      const scheduledIso = new Date(scheduleLocal).toISOString()
      if (Number.isNaN(new Date(scheduleLocal).getTime())) {
        throw new Error('Pick a valid date and time')
      }
      const { error: schedErr } = await supabase
        .from('workout_sessions')
        .insert({
          focus: focus || null,
          energy_pre: energyPre,
          scheduled_at: scheduledIso,
          user_id: user.id,
        })
      if (schedErr) throw new Error(schedErr.message)
      toast({
        kind: 'success',
        title: 'Workout scheduled',
        text: friendlyWhen(scheduledIso),
      })
      // Reset form, reload upcoming list, stay on page.
      setFocus('')
      setEnergyPre(7)
      setScheduleLocal(defaultScheduleLocal())
      setMode('now')
      loadUpcoming()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed'
      setError(msg)
      toast({ kind: 'error', title: 'Could not save', text: msg })
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteScheduled(id: string) {
    if (!confirm('Cancel this scheduled workout?')) return
    const { error: delErr } = await supabase.from('workout_sessions').delete().eq('id', id)
    if (delErr) {
      toast({ kind: 'error', title: 'Could not cancel', text: delErr.message })
      return
    }
    loadUpcoming()
  }

  async function startScheduledNow(s: ScheduledWorkout) {
    const { error: upErr } = await supabase
      .from('workout_sessions')
      .update({ started_at: new Date().toISOString() })
      .eq('id', s.id)
    if (upErr) {
      toast({ kind: 'error', title: 'Could not start', text: upErr.message })
      return
    }
    router.push(`/workout/active?session=${s.id}`)
  }

  const primaryLabel = useMemo(() => {
    if (submitting) return mode === 'now' ? 'Starting…' : 'Scheduling…'
    return mode === 'now' ? 'Start Session' : 'Schedule Workout'
  }, [mode, submitting])

  return (
    <div className="px-4 pt-6 space-y-4 pb-8">
      <h1 className="text-2xl font-bold tracking-tight text-white">Workout</h1>

      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 border border-white/10 rounded-lg">
        <button
          onClick={() => setMode('now')}
          className={`py-2 rounded text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
            mode === 'now' ? 'bg-emerald-400 text-black' : 'text-white/50 hover:text-white/80'
          }`}
        >
          <Play size={12} /> Start now
        </button>
        <button
          onClick={() => setMode('later')}
          className={`py-2 rounded text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
            mode === 'later' ? 'bg-amber-400 text-black' : 'text-white/50 hover:text-white/80'
          }`}
        >
          <Calendar size={12} /> Schedule for later
        </button>
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardContent className="py-4 space-y-4">
          <div>
            <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Focus</p>
            <input
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              onBlur={(e) => setFocus(e.target.value)}
              onAnimationStart={(e) => { if (e.animationName === 'onAutoFillStart') setFocus(e.currentTarget.value) }}
              placeholder="push · pull · legs · conditioning"
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/50"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {FOCUS_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setFocus(p)}
                  className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {mode === 'later' && (
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-2 flex items-center gap-1">
                <Clock size={11} /> When
              </p>
              <input
                type="datetime-local"
                value={scheduleLocal}
                onChange={(e) => setScheduleLocal(e.target.value)}
                onBlur={(e) => setScheduleLocal(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400/50"
              />
              <p className="text-[10px] text-white/40 mt-1">
                {friendlyWhen(safeIso(scheduleLocal))}
              </p>
            </div>
          )}

          <div>
            <p className="text-white/40 text-xs uppercase tracking-wider mb-2">
              {mode === 'now' ? 'Energy now (1–10)' : 'Planned energy target (1–10)'}
            </p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => setEnergyPre(n)}
                  className={`flex-1 py-2 rounded text-xs font-bold transition-colors tabular-nums ${
                    energyPre === n ? 'bg-amber-400 text-black' : 'bg-white/5 text-white/40 hover:bg-white/10'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={submit}
            disabled={submitting}
            className={`w-full font-bold h-12 ${
              mode === 'now'
                ? 'bg-emerald-400 text-black hover:bg-emerald-300'
                : 'bg-amber-400 text-black hover:bg-amber-300'
            }`}
          >
            {submitting ? (
              <><Loader2 size={16} className="mr-2 animate-spin" /> {primaryLabel}</>
            ) : mode === 'now' ? (
              <><Play size={16} className="mr-2" /> {primaryLabel}</>
            ) : (
              <><Calendar size={16} className="mr-2" /> {primaryLabel}</>
            )}
          </Button>

          {error && (
            <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-md p-2">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Upcoming scheduled workouts */}
      {upcoming.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-[10px] uppercase tracking-wider text-white/40 flex items-center gap-1">
            <Calendar size={11} /> Upcoming
          </p>
          {upcoming.map((s) => (
            <Card key={s.id} className="border-amber-400/20 bg-amber-400/5">
              <CardContent className="p-3 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">
                    {s.focus || 'Workout'}
                  </p>
                  <p className="text-[11px] text-amber-200/80">
                    {friendlyWhen(s.scheduled_at)}
                  </p>
                </div>
                <button
                  onClick={() => startScheduledNow(s)}
                  className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-md bg-emerald-400/20 border border-emerald-400/40 text-emerald-300 hover:bg-emerald-400/30"
                >
                  Start now
                </button>
                <button
                  onClick={() => deleteScheduled(s.id)}
                  className="p-1.5 rounded-md text-rose-400/70 hover:text-rose-300 hover:bg-rose-500/10"
                  aria-label="Cancel"
                >
                  <Trash2 size={14} />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {upcoming.length === 0 && mode === 'later' && (
        <div className="text-center text-[11px] text-white/40 pt-2">
          No upcoming workouts yet.
        </div>
      )}

      <div className="text-center pt-4">
        <Link href="/history" className="text-[11px] text-white/40 hover:text-white/70 underline">
          View past workouts
        </Link>
      </div>
    </div>
  )
}

function safeIso(local: string): string {
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

function friendlyWhen(iso: string): string {
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
    if (diffMin < 0) return `Today, ${time} (past)`
    if (diffMin < 60) return `In ${diffMin}m · today ${time}`
    return `Today, ${time} (in ${diffHr}h)`
  }
  if (isTomorrow) return `Tomorrow, ${time}`
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  return `${dateStr}, ${time}`
}

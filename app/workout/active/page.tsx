'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Square, Loader2, Check, Dumbbell, X, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'

type SessionRow = {
  id: string
  focus: string | null
  energy_pre: number | null
  started_at: string
  ended_at: string | null
  user_id: string | null
}

type SetRow = {
  id: string
  session_id: string
  exercise_name: string
  set_number: number
  weight_lb: number | null
  reps: number | null
  rpe: number | null
}

type DraftSet = { weight_lb: string; reps: string; rpe: string }

export default function ActiveWorkoutPage() {
  return (
    <Suspense fallback={<div className="px-4 pt-6 text-white/40 text-sm">Loading session…</div>}>
      <ActiveWorkoutInner />
    </Suspense>
  )
}

function ActiveWorkoutInner() {
  const router = useRouter()
  const params = useSearchParams()
  const sessionId = params.get('session')

  const [session, setSession] = useState<SessionRow | null>(null)
  const [allSets, setAllSets] = useState<SetRow[]>([])
  const [exerciseName, setExerciseName] = useState('')
  const [draftSets, setDraftSets] = useState<DraftSet[]>([{ weight_lb: '', reps: '', rpe: '' }])
  const [savingExercise, setSavingExercise] = useState(false)
  const [restRemaining, setRestRemaining] = useState<number | null>(null)
  const [showEnd, setShowEnd] = useState(false)
  const [now, setNow] = useState<number>(() => Date.now())
  const [error, setError] = useState<string | null>(null)
  const [previousExercises, setPreviousExercises] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load session + sets
  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    async function load() {
      const [sessRes, setsRes] = await Promise.all([
        supabase.from('workout_sessions').select('*').eq('id', sessionId).single(),
        supabase.from('workout_sets').select('*').eq('session_id', sessionId).order('set_number'),
      ])
      if (cancelled) return
      if (sessRes.data) setSession(sessRes.data as SessionRow)
      if (setsRes.data) setAllSets(setsRes.data as SetRow[])
    }
    load()
    return () => { cancelled = true }
  }, [sessionId])

  // Load previous exercise names for autocomplete (across all user sessions, deduped)
  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('workout_sets')
        .select('exercise_name')
        .order('created_at', { ascending: false })
        .limit(500)
      if (cancelled || !data) return
      const seen = new Set<string>()
      const list: string[] = []
      for (const r of data as Array<{ exercise_name: string }>) {
        const name = r.exercise_name.trim()
        if (name && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase())
          list.push(name)
        }
      }
      setPreviousExercises(list)
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Live timers (elapsed + rest countdown)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (restRemaining === null) return
    if (restRemaining <= 0) {
      setRestRemaining(null)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([60, 80, 60])
      return
    }
    const id = setTimeout(() => setRestRemaining((r) => (r === null ? null : r - 1)), 1000)
    return () => clearTimeout(id)
  }, [restRemaining])

  const elapsed = useMemo(() => {
    if (!session) return 0
    return Math.max(0, Math.floor((now - new Date(session.started_at).getTime()) / 1000))
  }, [session, now])

  const groupedByExercise = useMemo(() => {
    const map = new Map<string, SetRow[]>()
    for (const s of allSets) {
      const list = map.get(s.exercise_name) || []
      list.push(s)
      map.set(s.exercise_name, list)
    }
    return Array.from(map.entries())
  }, [allSets])

  const nextSetNumber = useMemo(() => {
    const sameExercise = allSets.filter((s) => s.exercise_name.toLowerCase() === exerciseName.trim().toLowerCase())
    if (sameExercise.length === 0) return 1
    return Math.max(...sameExercise.map((s) => s.set_number)) + 1
  }, [allSets, exerciseName])

  const suggestions = useMemo(() => {
    if (!exerciseName.trim()) return previousExercises.slice(0, 5)
    const q = exerciseName.toLowerCase()
    return previousExercises.filter((e) => e.toLowerCase().includes(q) && e.toLowerCase() !== q).slice(0, 5)
  }, [exerciseName, previousExercises])

  function updateDraftSet(idx: number, key: keyof DraftSet, value: string) {
    setDraftSets((prev) => prev.map((s, i) => (i === idx ? { ...s, [key]: value } : s)))
  }

  function addDraftRow() {
    const last = draftSets[draftSets.length - 1]
    setDraftSets((prev) => [...prev, { weight_lb: last?.weight_lb || '', reps: last?.reps || '', rpe: '' }])
  }

  function removeDraftRow(idx: number) {
    setDraftSets((prev) => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx))
  }

  async function saveExercise() {
    if (!session || !sessionId) return
    const name = exerciseName.trim()
    if (!name) {
      setError('Exercise name required')
      return
    }
    const validRows = draftSets.filter((d) => d.weight_lb || d.reps)
    if (validRows.length === 0) {
      setError('Add at least one set with weight or reps')
      return
    }
    setSavingExercise(true)
    setError(null)
    try {
      let setNumStart = nextSetNumber
      const rows = validRows.map((d) => {
        const row: Record<string, unknown> = {
          session_id: sessionId,
          exercise_name: name,
          set_number: setNumStart++,
          weight_lb: d.weight_lb ? Number(d.weight_lb) : null,
          reps: d.reps ? Number(d.reps) : null,
          rpe: d.rpe ? Number(d.rpe) : null,
        }
        if (session.user_id) row.user_id = session.user_id
        return row
      })
      const { data, error: insertErr } = await supabase.from('workout_sets').insert(rows).select()
      if (insertErr) throw new Error(insertErr.message)
      if (data) setAllSets((prev) => [...prev, ...(data as SetRow[])])

      // Reset for next exercise + start rest timer
      setExerciseName('')
      setDraftSets([{ weight_lb: '', reps: '', rpe: '' }])
      setShowSuggestions(false)
      setRestRemaining(60)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(30)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingExercise(false)
    }
  }

  function skipRest() {
    setRestRemaining(null)
    inputRef.current?.focus()
  }

  if (!sessionId) {
    return (
      <div className="px-4 pt-6">
        <p className="text-rose-300 text-sm">No session id. </p>
        <Button onClick={() => router.push('/workout')} className="mt-3 bg-amber-400 text-black">Back to workout</Button>
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 pb-32 space-y-4">
      {/* Header */}
      <Card className="border-green-400/20 bg-green-400/5">
        <CardContent className="py-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-green-400 font-bold text-sm uppercase tracking-wider">Live session</p>
              <p className="text-white text-base mt-0.5">{session?.focus || 'General training'}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-mono font-bold text-amber-400 tabular-nums">{fmtTime(elapsed)}</p>
              {session?.energy_pre != null && (
                <Badge variant="outline" className="border-amber-400/30 text-amber-300 text-[10px] mt-1">
                  energy {session.energy_pre}/10
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rest timer */}
      {restRemaining !== null && (
        <Card className="border-cyan-400/30 bg-cyan-500/10">
          <CardContent className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="text-cyan-300" size={18} />
              <div>
                <p className="text-cyan-200 text-xs uppercase tracking-wider">Rest</p>
                <p className="text-2xl font-mono font-bold text-cyan-100 tabular-nums">{fmtTime(restRemaining)}</p>
              </div>
            </div>
            <Button onClick={skipRest} variant="outline" className="border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/20">
              Skip Rest
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Already logged exercises */}
      {groupedByExercise.length > 0 && (
        <div>
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Logged</p>
          <div className="space-y-2">
            {groupedByExercise.map(([name, sets]) => (
              <Card key={name} className="border-white/10 bg-white/5">
                <CardContent className="py-2 px-3">
                  <p className="text-white text-sm font-medium flex items-center gap-1.5">
                    <Dumbbell size={13} className="text-white/40" /> {name}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                    {sets.map((s) => (
                      <span key={s.id} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/70">
                        {s.weight_lb ? `${s.weight_lb}lb` : ''}
                        {s.weight_lb && s.reps ? ' × ' : ''}
                        {s.reps ? `${s.reps}` : ''}
                        {s.rpe ? ` @${s.rpe}` : ''}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Exercise + sets entry */}
      <Card className="border-white/10 bg-white/5">
        <CardContent className="pt-4 space-y-3">
          <div className="relative">
            <label className="text-xs text-white/50 uppercase tracking-wider">Exercise</label>
            <input
              ref={inputRef}
              value={exerciseName}
              onChange={(e) => { setExerciseName(e.target.value); setShowSuggestions(true) }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Bench Press, Squat, Pull-up…"
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber-400/50"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-44 overflow-y-auto rounded-md border border-white/10 bg-zinc-950 shadow-lg">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onMouseDown={(e) => { e.preventDefault(); setExerciseName(s); setShowSuggestions(false) }}
                    className="block w-full text-left px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[1.4rem_1fr_1fr_1fr_1.7rem] gap-1.5 text-[10px] uppercase tracking-wider text-white/40">
              <span>#</span>
              <span>Weight (lb)</span>
              <span>Reps</span>
              <span>RPE</span>
              <span />
            </div>
            {draftSets.map((d, i) => (
              <div key={i} className="grid grid-cols-[1.4rem_1fr_1fr_1fr_1.7rem] gap-1.5 items-center">
                <span className="text-white/40 text-xs font-mono">{nextSetNumber + i}</span>
                <input
                  type="number" inputMode="decimal" value={d.weight_lb}
                  onChange={(e) => updateDraftSet(i, 'weight_lb', e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-amber-400/50"
                />
                <input
                  type="number" inputMode="numeric" value={d.reps}
                  onChange={(e) => updateDraftSet(i, 'reps', e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-amber-400/50"
                />
                <input
                  type="number" inputMode="decimal" step="0.5" min="1" max="10" value={d.rpe}
                  onChange={(e) => updateDraftSet(i, 'rpe', e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-amber-400/50"
                />
                <button
                  onClick={() => removeDraftRow(i)}
                  className="text-white/30 hover:text-rose-400 disabled:opacity-30 flex justify-center"
                  disabled={draftSets.length === 1}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={addDraftRow}
              variant="outline"
              className="flex-1 border-white/20 text-white/70 hover:bg-white/10"
            >
              <Plus size={14} className="mr-1" /> Add Set
            </Button>
            <Button
              onClick={saveExercise}
              disabled={savingExercise || !exerciseName.trim()}
              className="flex-1 bg-amber-400 text-black hover:bg-amber-300 disabled:opacity-30"
            >
              {savingExercise ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Check size={14} className="mr-1" />}
              Save Exercise
            </Button>
          </div>

          {error && (
            <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-md p-2">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {/* End session sticky */}
      <div className="fixed bottom-20 left-0 right-0 z-30 px-4 pointer-events-none">
        <div className="max-w-md mx-auto pointer-events-auto">
          <Button
            onClick={() => setShowEnd(true)}
            className="w-full bg-rose-500 text-white hover:bg-rose-400 shadow-lg shadow-rose-500/30"
          >
            <Square size={14} className="mr-2" /> End Session
          </Button>
        </div>
      </div>

      {showEnd && session && sessionId && (
        <EndSessionDialog
          session={session}
          sessionId={sessionId}
          onClose={() => setShowEnd(false)}
          onFinished={() => router.push(`/workout/summary?session=${sessionId}`)}
        />
      )}
    </div>
  )
}

function EndSessionDialog({
  session, sessionId, onClose, onFinished,
}: {
  session: SessionRow
  sessionId: string
  onClose: () => void
  onFinished: () => void
}) {
  const [energyPost, setEnergyPost] = useState<number>(session.energy_pre || 7)
  const [moodPost, setMoodPost] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function finish() {
    setSaving(true)
    setError(null)
    try {
      const { error: updErr } = await supabase
        .from('workout_sessions')
        .update({
          ended_at: new Date().toISOString(),
          energy_post: energyPost,
          mood_post: moodPost || null,
          notes: notes || null,
        })
        .eq('id', sessionId)
      if (updErr) throw new Error(updErr.message)
      onFinished()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-end sm:items-center justify-center p-4">
      <Card className="border-white/10 bg-zinc-950 w-full max-w-md">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Finish session</h2>
            <button onClick={onClose}><X size={20} className="text-white/40" /></button>
          </div>

          <div>
            <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Energy post (1-10)</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => setEnergyPost(n)}
                  className={`flex-1 py-1.5 rounded text-xs font-bold transition-colors ${
                    energyPost === n ? 'bg-amber-400 text-black' : 'bg-white/5 text-white/40 hover:bg-white/10'
                  }`}
                >{n}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider">Mood</label>
            <input
              value={moodPost} onChange={(e) => setMoodPost(e.target.value)}
              placeholder="Strong, drained, dialed, flat…"
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider">Notes</label>
            <Textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="PRs, technique notes, pains, conditions…"
              className="bg-white/5 border-white/10 mt-1"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-md p-2">
              {error}
            </p>
          )}

          <Button
            onClick={finish}
            disabled={saving}
            className="w-full bg-green-400 text-black hover:bg-green-300"
          >
            {saving ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Check size={14} className="mr-2" />}
            Finish
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function fmtTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

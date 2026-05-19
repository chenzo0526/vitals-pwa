'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Square, Loader2, Check, Dumbbell, X, Clock, Edit3, Trash2, Mic, MicOff, Sparkles, ChevronDown, ChevronUp, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { celebrate } from '@/lib/celebrate'
import ExercisePicker from '@/components/ExercisePicker'

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

// Voice types (avoid global collision)
type VJWREvent = { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }
type VJWRecognizer = {
  continuous: boolean; interimResults: boolean; lang: string
  start: () => void; stop: () => void
  onresult: ((e: VJWREvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

const MOOD_CHIPS = ['Crushed it', 'Solid', 'Average', 'Off today', 'Drained', 'Strong', 'Joints felt off', 'Low energy']
const NOTE_QUICK_CHIPS = ['PR hit', 'Form breakdown late sets', 'Felt fast', 'Felt heavy', 'Cardio after', 'Skipped accessories', 'Bad sleep showed']

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
  const [pickerOpen, setPickerOpen] = useState(false)
  const [draftSets, setDraftSets] = useState<DraftSet[]>([{ weight_lb: '', reps: '', rpe: '' }])
  const [showRpe, setShowRpe] = useState(false)
  const [showRpeInfo, setShowRpeInfo] = useState(false)
  const [savingExercise, setSavingExercise] = useState(false)
  const [restRemaining, setRestRemaining] = useState<number | null>(null)
  const [showEnd, setShowEnd] = useState(false)
  const [editingSet, setEditingSet] = useState<SetRow | null>(null)
  const [now, setNow] = useState<number>(() => Date.now())
  const [error, setError] = useState<string | null>(null)
  const [previousExercises, setPreviousExercises] = useState<string[]>([])

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

  // Load previous exercise names (recents for the picker)
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

  // Live timers
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

  async function logSingleSet(idx: number) {
    if (!session || !sessionId) return
    const name = exerciseName.trim()
    if (!name) { setError('Pick an exercise first'); return }
    const d = draftSets[idx]
    if (!d || (!d.weight_lb && !d.reps)) { setError('Enter weight or reps'); return }
    setError(null)
    setSavingExercise(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login?redirect=/workout'); return }
      const setNum = nextSetNumber
      const row = {
        session_id: sessionId,
        user_id: user.id,
        exercise_name: name,
        set_number: setNum,
        weight_lb: d.weight_lb ? Number(d.weight_lb) : null,
        reps: d.reps ? Number(d.reps) : null,
        rpe: d.rpe ? Number(d.rpe) : null,
      }
      const { data, error: insertErr } = await supabase.from('workout_sets').insert([row]).select()
      if (insertErr) throw new Error(insertErr.message)
      if (data) setAllSets((prev) => [...prev, ...(data as SetRow[])])
      // PR detection: did this weight beat the user's previous max for this exercise?
      const newWeight = d.weight_lb ? Number(d.weight_lb) : 0
      if (newWeight > 0) {
        try {
          const { data: priorMax } = await supabase
            .from('workout_sets')
            .select('weight_lb')
            .eq('user_id', user.id)
            .eq('exercise_name', name)
            .neq('session_id', sessionId) // ignore this session's earlier sets
            .order('weight_lb', { ascending: false })
            .limit(1)
            .maybeSingle()
          const prevBest = priorMax?.weight_lb ?? 0
          if (newWeight > prevBest && prevBest > 0) {
            celebrate.pr()
          } else {
            celebrate.lift()
          }
        } catch {
          celebrate.lift()
        }
      } else {
        celebrate.lift()
      }
      // Remove this draft row + keep weight as prefill for the next set
      setDraftSets((prev) => {
        const remaining = prev.filter((_, i) => i !== idx)
        if (remaining.length === 0) return [{ weight_lb: d.weight_lb, reps: d.reps, rpe: '' }]
        return remaining
      })
      setRestRemaining(90)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(30)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not log set')
    } finally {
      setSavingExercise(false)
    }
  }

  async function saveExercise() {
    if (!session || !sessionId) return
    const name = exerciseName.trim()
    if (!name) {
      setError('Tap to pick an exercise first')
      return
    }
    const validRows = draftSets.filter((d) => d.weight_lb || d.reps)
    if (validRows.length === 0) {
      setError('Add weight or reps for at least one set')
      return
    }
    setSavingExercise(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login?redirect=/workout')
        return
      }
      let setNumStart = nextSetNumber
      const rows = validRows.map((d) => ({
        session_id: sessionId,
        user_id: user.id,
        exercise_name: name,
        set_number: setNumStart++,
        weight_lb: d.weight_lb ? Number(d.weight_lb) : null,
        reps: d.reps ? Number(d.reps) : null,
        rpe: d.rpe ? Number(d.rpe) : null,
      }))
      const { data, error: insertErr } = await supabase.from('workout_sets').insert(rows).select()
      if (insertErr) throw new Error(insertErr.message)
      if (data) setAllSets((prev) => [...prev, ...(data as SetRow[])])

      // Reset for next exercise + start rest timer
      setExerciseName('')
      setDraftSets([{ weight_lb: '', reps: '', rpe: '' }])
      setRestRemaining(90)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(30)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingExercise(false)
    }
  }

  async function deleteSet(id: string) {
    if (!confirm('Delete this set?')) return
    const { error: delErr } = await supabase.from('workout_sets').delete().eq('id', id)
    if (delErr) {
      setError(delErr.message)
      return
    }
    setAllSets((prev) => prev.filter((s) => s.id !== id))
  }

  async function saveEditedSet(s: SetRow, patch: { weight_lb: number | null; reps: number | null; rpe: number | null }) {
    const { error: upErr } = await supabase.from('workout_sets').update(patch).eq('id', s.id)
    if (upErr) {
      setError(upErr.message)
      return
    }
    setAllSets((prev) => prev.map((x) => (x.id === s.id ? { ...x, ...patch } : x)))
    setEditingSet(null)
  }

  function skipRest() {
    setRestRemaining(null)
  }

  async function cancelSession() {
    if (!sessionId) return
    if (!confirm('Cancel this session and DELETE it (plus all sets logged)? This cannot be undone.')) return
    await supabase.from('workout_sets').delete().eq('session_id', sessionId)
    await supabase.from('workout_sessions').delete().eq('id', sessionId)
    router.push('/workout')
  }

  if (!sessionId) {
    return (
      <div className="px-4 pt-6">
        <p className="text-rose-300 text-sm">No session id.</p>
        <Button onClick={() => router.push('/workout')} className="mt-3 bg-amber-400 text-black">Back to workout</Button>
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 pb-32 space-y-4">
      {/* Header */}
      <Card className="border-green-400/20 bg-green-400/5">
        <CardContent className="py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-green-400 font-bold text-sm uppercase tracking-wider">Live session</p>
              <p className="text-white text-base mt-0.5 truncate">{session?.focus || 'General training'}</p>
            </div>
            <div className="text-right flex flex-col items-end gap-1">
              <p className="text-2xl font-mono font-bold text-amber-400 tabular-nums leading-none">{fmtTime(elapsed)}</p>
              <div className="flex items-center gap-1.5">
                {session?.energy_pre != null && (
                  <Badge variant="outline" className="border-amber-400/30 text-amber-300 text-[10px]">
                    energy {session.energy_pre}/10
                  </Badge>
                )}
                <button
                  onClick={cancelSession}
                  className="text-[10px] uppercase tracking-wider text-rose-400/70 hover:text-rose-300 hover:underline px-1"
                  aria-label="Cancel and delete session"
                >
                  cancel
                </button>
              </div>
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
              Skip
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Logged exercises — each set is tappable to edit */}
      {groupedByExercise.length > 0 && (
        <div>
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Logged · tap a set to edit</p>
          <div className="space-y-2">
            {groupedByExercise.map(([name, sets]) => (
              <Card key={name} className="border-white/10 bg-white/5">
                <CardContent className="py-2.5 px-3">
                  <p className="text-white text-sm font-medium flex items-center gap-1.5">
                    <Dumbbell size={13} className="text-white/40" /> {name}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {sets.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setEditingSet(s)}
                        className="text-[11px] px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:border-amber-400/30 tabular-nums flex items-center gap-1"
                      >
                        <span className="text-white/40">#{s.set_number}</span>
                        {s.weight_lb != null && `${s.weight_lb}lb`}
                        {s.weight_lb != null && s.reps != null && ' × '}
                        {s.reps != null && `${s.reps}`}
                        {s.rpe != null && <span className="text-amber-300/70">@{s.rpe}</span>}
                        <Edit3 size={9} className="text-white/30 ml-0.5" />
                      </button>
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
          {/* Exercise picker trigger */}
          <div>
            <label className="text-[10px] text-white/50 uppercase tracking-wider">Exercise</label>
            <button
              onClick={() => setPickerOpen(true)}
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-3 py-3 text-sm focus:outline-none focus:border-amber-400/50 hover:border-amber-400/30 text-left flex items-center justify-between gap-2"
            >
              {exerciseName ? (
                <span className="text-white font-medium">{exerciseName}</span>
              ) : (
                <span className="text-white/40">Tap to pick · Bench, RDL, Hack squat…</span>
              )}
              <Dumbbell size={14} className="text-amber-400/70 flex-shrink-0" />
            </button>
          </div>

          {/* Set entry — 2-col Weight + Reps, RPE behind toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Sets</p>
              <button
                onClick={() => setShowRpe((s) => !s)}
                className="text-[10px] uppercase tracking-wider text-white/40 hover:text-white/80 flex items-center gap-1"
              >
                {showRpe ? <><ChevronUp size={10} /> Hide RPE</> : <><ChevronDown size={10} /> Show RPE</>}
                <button
                  onClick={(e) => { e.stopPropagation(); setShowRpeInfo((v) => !v) }}
                  className="ml-0.5 text-white/30 hover:text-amber-300"
                >
                  <Info size={10} />
                </button>
              </button>
            </div>
            {showRpeInfo && (
              <p className="text-[10px] text-amber-200/70 bg-amber-400/[0.05] border border-amber-400/20 rounded p-2 leading-relaxed">
                <span className="font-bold">RPE = Rate of Perceived Exertion (1-10).</span> How hard the set felt. 10 = absolute max, 9 = 1 rep in reserve, 8 = 2 RIR, 7 = 3 RIR. Optional — only track it if you find it useful.
              </p>
            )}
            {draftSets.map((d, i) => (
              <div key={i} className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold tabular-nums">
                    Set {nextSetNumber + i}
                  </span>
                  <button
                    onClick={() => removeDraftRow(i)}
                    className="text-white/30 hover:text-rose-400 disabled:opacity-20 p-0.5"
                    disabled={draftSets.length === 1}
                    aria-label="Remove this draft"
                  >
                    <X size={12} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] uppercase tracking-wider text-white/40">Weight (lb)</label>
                    <input
                      type="number" inputMode="decimal" value={d.weight_lb}
                      onChange={(e) => updateDraftSet(i, 'weight_lb', e.target.value)}
                      onBlur={(e) => updateDraftSet(i, 'weight_lb', e.target.value)}
                      placeholder="0"
                      className="w-full mt-0.5 bg-white/5 border border-white/10 rounded-md px-2 py-2 text-sm tabular-nums focus:outline-none focus:border-amber-400/50"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase tracking-wider text-white/40">Reps</label>
                    <input
                      type="number" inputMode="numeric" value={d.reps}
                      onChange={(e) => updateDraftSet(i, 'reps', e.target.value)}
                      onBlur={(e) => updateDraftSet(i, 'reps', e.target.value)}
                      placeholder="0"
                      className="w-full mt-0.5 bg-white/5 border border-white/10 rounded-md px-2 py-2 text-sm tabular-nums focus:outline-none focus:border-amber-400/50"
                    />
                  </div>
                </div>
                {showRpe && (
                  <div>
                    <label className="text-[9px] uppercase tracking-wider text-amber-300/60">RPE 1-10</label>
                    <input
                      type="number" inputMode="decimal" step="0.5" min="1" max="10" value={d.rpe}
                      onChange={(e) => updateDraftSet(i, 'rpe', e.target.value)}
                      onBlur={(e) => updateDraftSet(i, 'rpe', e.target.value)}
                      placeholder="Optional"
                      className="w-full mt-0.5 bg-white/[0.03] border border-amber-400/20 rounded-md px-2 py-1.5 text-xs tabular-nums focus:outline-none focus:border-amber-400/40 text-amber-200/80"
                    />
                  </div>
                )}
                <Button
                  onClick={() => logSingleSet(i)}
                  disabled={savingExercise || !exerciseName.trim() || (!d.weight_lb && !d.reps)}
                  className="w-full bg-emerald-400 text-black hover:bg-emerald-300 disabled:opacity-30 font-bold h-9 text-xs"
                >
                  {savingExercise ? <Loader2 size={12} className="mr-1 animate-spin" /> : <Check size={12} className="mr-1" />}
                  Log Set & Start Rest
                </Button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={addDraftRow}
              variant="outline"
              className="flex-1 border-white/20 text-white/70 hover:bg-white/10"
            >
              <Plus size={14} className="mr-1" /> Add another draft
            </Button>
            <Button
              onClick={saveExercise}
              disabled={savingExercise || !exerciseName.trim() || draftSets.every(d => !d.weight_lb && !d.reps)}
              className="flex-1 bg-amber-400/20 border border-amber-400/40 text-amber-200 hover:bg-amber-400/30 disabled:opacity-30 text-xs"
              title="Save all drafts at once (instead of one-at-a-time)"
            >
              Save all drafts
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
            className="w-full bg-rose-500 text-white hover:bg-rose-400 shadow-lg shadow-rose-500/30 h-12"
          >
            <Square size={14} className="mr-2" /> End Session
          </Button>
        </div>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(name) => setExerciseName(name)}
        recentNames={previousExercises}
      />

      {showEnd && session && sessionId && (
        <EndSessionDialog
          session={session}
          sessionId={sessionId}
          onClose={() => setShowEnd(false)}
          onFinished={() => router.push(`/workout/summary?session=${sessionId}`)}
        />
      )}

      {editingSet && (
        <EditSetDialog
          set={editingSet}
          onClose={() => setEditingSet(null)}
          onSave={(patch) => saveEditedSet(editingSet, patch)}
          onDelete={() => { deleteSet(editingSet.id); setEditingSet(null) }}
        />
      )}
    </div>
  )
}

function EditSetDialog({
  set, onClose, onSave, onDelete,
}: {
  set: SetRow
  onClose: () => void
  onSave: (patch: { weight_lb: number | null; reps: number | null; rpe: number | null }) => void
  onDelete: () => void
}) {
  const [weight, setWeight] = useState(set.weight_lb != null ? String(set.weight_lb) : '')
  const [reps, setReps] = useState(set.reps != null ? String(set.reps) : '')
  const [rpe, setRpe] = useState(set.rpe != null ? String(set.rpe) : '')

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur flex items-end sm:items-center justify-center p-4">
      <Card className="border-white/10 bg-zinc-950 w-full max-w-md">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white">Edit set #{set.set_number} — {set.exercise_name}</h2>
            <button onClick={onClose}><X size={20} className="text-white/40" /></button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/40">Weight (lb)</label>
              <input
                type="number" inputMode="decimal" value={weight}
                onChange={(e) => setWeight(e.target.value)}
                onBlur={(e) => setWeight(e.target.value)}
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-2 py-2 text-sm tabular-nums focus:outline-none focus:border-amber-400/50"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/40">Reps</label>
              <input
                type="number" inputMode="numeric" value={reps}
                onChange={(e) => setReps(e.target.value)}
                onBlur={(e) => setReps(e.target.value)}
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-2 py-2 text-sm tabular-nums focus:outline-none focus:border-amber-400/50"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/40">RPE</label>
              <input
                type="number" inputMode="decimal" step="0.5" min="1" max="10" value={rpe}
                onChange={(e) => setRpe(e.target.value)}
                onBlur={(e) => setRpe(e.target.value)}
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-2 py-2 text-sm tabular-nums focus:outline-none focus:border-amber-400/50"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2 border-t border-white/5">
            <Button onClick={onDelete} variant="outline" className="border-rose-400/30 text-rose-300 hover:bg-rose-500/10">
              <Trash2 size={12} className="mr-1" /> Delete
            </Button>
            <Button
              onClick={() => onSave({
                weight_lb: weight ? Number(weight) : null,
                reps: reps ? Number(reps) : null,
                rpe: rpe ? Number(rpe) : null,
              })}
              className="ml-auto bg-amber-400 text-black hover:bg-amber-300 font-bold"
            >
              <Check size={12} className="mr-1" /> Save
            </Button>
          </div>
        </CardContent>
      </Card>
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
  const [moodChips, setMoodChips] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [voiceListening, setVoiceListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [voiceInterim, setVoiceInterim] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<VJWRecognizer | null>(null)

  useEffect(() => {
    const win = (typeof window !== 'undefined' ? window : null) as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown } | null
    setVoiceSupported(!!(win?.SpeechRecognition || win?.webkitSpeechRecognition))
  }, [])

  function toggleMoodChip(c: string) {
    setMoodChips((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])
  }
  function addNoteChip(c: string) {
    setNotes((prev) => prev ? `${prev}\n${c}` : c)
  }

  function startVoice() {
    setError(null)
    const win = window as unknown as { SpeechRecognition?: new () => VJWRecognizer; webkitSpeechRecognition?: new () => VJWRecognizer }
    const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition
    if (!Ctor) { setError('Voice not supported'); return }
    const rec: VJWRecognizer = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'
    rec.onresult = (e: VJWREvent) => {
      let finalText = ''
      let interimText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        if (result.isFinal) finalText += result[0].transcript
        else interimText += result[0].transcript
      }
      if (finalText) setNotes((t) => (t + ' ' + finalText).trim())
      setVoiceInterim(interimText)
    }
    rec.onerror = (e: { error: string }) => {
      if (e.error !== 'no-speech') setError(`Voice: ${e.error}`)
      setVoiceListening(false)
    }
    rec.onend = () => { setVoiceListening(false); setVoiceInterim('') }
    recognitionRef.current = rec
    try { rec.start(); setVoiceListening(true) } catch (e) { setError(e instanceof Error ? e.message : 'Mic error') }
  }

  function stopVoice() {
    recognitionRef.current?.stop()
    setVoiceListening(false)
    setVoiceInterim('')
  }

  async function finish() {
    setSaving(true)
    setError(null)
    try {
      const moodSummary = moodChips.length > 0 ? moodChips.join(', ') : null
      const { error: updErr } = await supabase
        .from('workout_sessions')
        .update({
          ended_at: new Date().toISOString(),
          energy_post: energyPost,
          mood_post: moodSummary,
          notes: notes.trim() || null,
        })
        .eq('id', sessionId)
      if (updErr) throw new Error(updErr.message)
      celebrate.lift()
      onFinished()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur flex items-end sm:items-center justify-center p-4 overflow-y-auto">
      <Card className="border-white/10 bg-zinc-950 w-full max-w-md max-h-[92vh] overflow-y-auto my-auto">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white">Finish session</h2>
            <button onClick={onClose}><X size={20} className="text-white/40" /></button>
          </div>

          {/* Energy post */}
          <div>
            <p className="text-white/50 text-[10px] uppercase tracking-wider mb-1.5">Energy after (1-10)</p>
            <div className="grid grid-cols-10 gap-1">
              {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                <button
                  key={n}
                  onClick={() => setEnergyPost(n)}
                  className={`py-2 rounded text-xs font-bold transition-colors tabular-nums ${
                    energyPost === n ? 'bg-amber-400 text-black' : 'bg-white/5 text-white/40 hover:bg-white/10'
                  }`}
                >{n}</button>
              ))}
            </div>
          </div>

          {/* Mood chips — quick tap, multi-select */}
          <div>
            <p className="text-white/50 text-[10px] uppercase tracking-wider mb-1.5">How did it feel? (tap any that apply)</p>
            <div className="flex flex-wrap gap-1.5">
              {MOOD_CHIPS.map((c) => {
                const on = moodChips.includes(c)
                return (
                  <button
                    key={c}
                    onClick={() => toggleMoodChip(c)}
                    className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                      on
                        ? 'bg-amber-400/20 border-amber-400/50 text-amber-200 font-semibold'
                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {c}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Notes with voice */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-white/50 text-[10px] uppercase tracking-wider">Notes — talk it through</p>
              {voiceSupported && (
                voiceListening ? (
                  <motion.button
                    onClick={stopVoice}
                    className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md bg-rose-500/20 border border-rose-400/40 text-rose-200 flex items-center gap-1"
                  >
                    <motion.div
                      className="w-1.5 h-1.5 rounded-full bg-rose-400"
                      animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                    <MicOff size={11} /> Stop
                  </motion.button>
                ) : (
                  <button
                    onClick={startVoice}
                    className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md bg-violet-400/20 border border-violet-400/40 text-violet-200 hover:bg-violet-400/30 flex items-center gap-1"
                  >
                    <Mic size={11} /> Talk
                  </button>
                )
              )}
            </div>
            <Textarea
              value={notes + (voiceInterim ? (notes ? ' ' : '') + voiceInterim : '')}
              onChange={(e) => { setNotes(e.target.value); setVoiceInterim('') }}
              placeholder={voiceListening ? 'Listening — speak about how it went…' : 'What felt good · what was off · PRs · injuries · the vibe'}
              className="bg-white/5 border-white/10 min-h-[100px]"
            />
            {/* Quick note chips */}
            <div className="flex flex-wrap gap-1 mt-2">
              {NOTE_QUICK_CHIPS.map((c) => (
                <button
                  key={c}
                  onClick={() => addNoteChip(c)}
                  className="text-[10px] px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80"
                >
                  + {c}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-md p-2">
              {error}
            </p>
          )}

          <Button
            onClick={finish}
            disabled={saving}
            className="w-full bg-green-400 text-black hover:bg-green-300 h-11 font-bold"
          >
            {saving ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Sparkles size={14} className="mr-2" />}
            Finish session
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

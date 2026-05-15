'use client'

import { useState } from 'react'
import { Play, Square, Plus, Loader2, Check, Dumbbell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'

type ParsedSet = {
  exercise: string
  set_num: number
  reps?: number
  weight_lb?: number
  rpe?: number
  notes?: string
}

type ParsedWorkout = {
  sets: ParsedSet[]
  focus: string
  estimated_duration_min?: number
}

export default function WorkoutPage() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [inputText, setInputText] = useState('')
  const [parsedSets, setParsedSets] = useState<ParsedSet[]>([])
  const [parsing, setParsing] = useState(false)
  const [focus, setFocus] = useState('')
  const [saved, setSaved] = useState(false)
  const [energyPre, setEnergyPre] = useState(7)

  async function startSession() {
    const ts = new Date().toISOString()
    setStartedAt(ts)
    setSaved(false)
    try {
      const { data } = await supabase
        .from('workout_sessions')
        .insert({ started_at: ts, energy_pre: energyPre, focus })
        .select()
        .single()
      if (data) setSessionId(data.id)
    } catch {
      setSessionId('local-' + Date.now())
    }
  }

  async function parseSets() {
    if (!inputText.trim()) return
    setParsing(true)
    try {
      const res = await fetch('/api/parse-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      })
      const data: ParsedWorkout = await res.json()
      if (data.sets) {
        setParsedSets((prev) => [...prev, ...data.sets])
        if (data.focus && !focus) setFocus(data.focus)
      }
      setInputText('')
    } catch {
      // silently fail
    } finally {
      setParsing(false)
    }
  }

  async function endSession() {
    if (!startedAt) return
    const endedAt = new Date().toISOString()
    try {
      if (sessionId && !sessionId.startsWith('local-')) {
        await supabase
          .from('workout_sessions')
          .update({ ended_at: endedAt, focus, notes: `${parsedSets.length} sets logged` })
          .eq('id', sessionId)

        // Insert sets
        for (const set of parsedSets) {
          await supabase.from('workout_sets').insert({
            session_id: sessionId,
            exercise: set.exercise,
            set_num: set.set_num,
            reps: set.reps,
            weight_lb: set.weight_lb,
            rpe: set.rpe,
          })
        }
      }
    } catch {
      // graceful — offline or placeholder creds
    }
    setSaved(true)
    setSessionId(null)
    setStartedAt(null)
    setParsedSets([])
    setInputText('')
  }

  const elapsed = startedAt ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000) : 0

  return (
    <div className="px-4 pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Workout</h1>
        {sessionId && (
          <Badge className="bg-green-400/20 text-green-400 border-green-400/30">
            {elapsed}m active
          </Badge>
        )}
      </div>

      {/* Session control */}
      {!sessionId ? (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="py-4 space-y-3">
            <div>
              <p className="text-white/40 text-xs mb-2">Energy level (1-10)</p>
              <div className="flex gap-1">
                {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                  <button
                    key={n}
                    onClick={() => setEnergyPre(n)}
                    className={`flex-1 py-2 rounded text-xs font-bold transition-colors ${
                      energyPre === n ? 'bg-amber-400 text-black' : 'bg-white/5 text-white/40 hover:bg-white/10'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={startSession} className="w-full bg-green-400 text-black font-bold hover:bg-green-300">
              <Play size={16} className="mr-2" /> Start Session
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-green-400/20 bg-green-400/5">
          <CardContent className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <p className="text-green-400 font-medium text-sm">Session active — {elapsed} min</p>
            </div>
            <Button onClick={endSession} size="sm" variant="outline" className="border-red-400/30 text-red-400 hover:bg-red-400/10">
              <Square size={14} className="mr-1" /> End
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Set logger */}
      {sessionId && (
        <div className="space-y-3">
          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="e.g. bench press 185x5, 185x5, 185x4 — or squat 3x5 at 225"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/20 resize-none"
            rows={3}
          />
          <Button
            onClick={parseSets}
            disabled={parsing || !inputText.trim()}
            className="w-full bg-white/10 text-white hover:bg-white/20"
          >
            {parsing ? <><Loader2 size={14} className="mr-2 animate-spin" /> Parsing…</> : <><Plus size={14} className="mr-2" /> Add Sets</>}
          </Button>
        </div>
      )}

      {/* Logged sets */}
      {parsedSets.length > 0 && (
        <div className="space-y-2">
          <p className="text-white/40 text-xs uppercase tracking-wider">Logged Sets ({parsedSets.length})</p>
          {parsedSets.map((set, i) => (
            <Card key={i} className="border-white/10 bg-white/5">
              <CardContent className="py-2 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Dumbbell size={14} className="text-white/30" />
                    <span className="text-white text-sm">{set.exercise}</span>
                    <span className="text-white/40 text-xs">set {set.set_num}</span>
                  </div>
                  <div className="flex gap-2 text-xs">
                    {set.weight_lb && <span className="text-amber-400">{set.weight_lb}lb</span>}
                    {set.reps && <span className="text-cyan-400">×{set.reps}</span>}
                    {set.rpe && <span className="text-violet-400">RPE {set.rpe}</span>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {saved && (
        <Card className="border-green-400/20 bg-green-400/5">
          <CardContent className="py-3 flex items-center justify-center gap-2">
            <Check size={16} className="text-green-400" />
            <p className="text-green-400 font-medium">Session saved ✓</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

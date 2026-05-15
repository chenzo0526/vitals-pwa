'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronRight, Copy, Check, Home, Dumbbell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'

type SessionRow = {
  id: string
  focus: string | null
  energy_pre: number | null
  energy_post: number | null
  mood_post: string | null
  notes: string | null
  started_at: string
  ended_at: string | null
}

type SetRow = {
  id: string
  exercise_name: string
  set_number: number
  weight_lb: number | null
  reps: number | null
  rpe: number | null
}

export default function SummaryPage() {
  return (
    <Suspense fallback={<div className="px-4 pt-6 text-white/40 text-sm">Loading summary…</div>}>
      <SummaryInner />
    </Suspense>
  )
}

function SummaryInner() {
  const router = useRouter()
  const params = useSearchParams()
  const sessionId = params.get('session')
  const [session, setSession] = useState<SessionRow | null>(null)
  const [sets, setSets] = useState<SetRow[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    async function load() {
      const [sessRes, setsRes] = await Promise.all([
        supabase.from('workout_sessions').select('*').eq('id', sessionId).single(),
        supabase.from('workout_sets').select('*').eq('session_id', sessionId).order('set_number'),
      ])
      if (sessRes.data) setSession(sessRes.data as SessionRow)
      if (setsRes.data) setSets(setsRes.data as SetRow[])
    }
    load()
  }, [sessionId])

  const grouped = useMemo(() => {
    const map = new Map<string, SetRow[]>()
    for (const s of sets) {
      const list = map.get(s.exercise_name) || []
      list.push(s)
      map.set(s.exercise_name, list)
    }
    return Array.from(map.entries())
  }, [sets])

  const durationSec = useMemo(() => {
    if (!session) return 0
    const start = new Date(session.started_at).getTime()
    const end = session.ended_at ? new Date(session.ended_at).getTime() : Date.now()
    return Math.max(0, Math.floor((end - start) / 1000))
  }, [session])

  const totalVolume = useMemo(() => {
    return sets.reduce((acc, s) => acc + ((s.weight_lb || 0) * (s.reps || 0)), 0)
  }, [sets])

  const totalSets = sets.length

  function buildLogText(): string {
    if (!session) return ''
    const lines: string[] = []
    lines.push(`Workout — ${new Date(session.started_at).toLocaleString()}`)
    if (session.focus) lines.push(`Focus: ${session.focus}`)
    lines.push(`Duration: ${fmtDuration(durationSec)}`)
    if (session.energy_pre != null || session.energy_post != null) {
      lines.push(`Energy: ${session.energy_pre ?? '—'} → ${session.energy_post ?? '—'}`)
    }
    if (session.mood_post) lines.push(`Mood: ${session.mood_post}`)
    lines.push(`Total volume: ${totalVolume.toLocaleString()} lb`)
    lines.push(`Total sets: ${totalSets}`)
    lines.push('')
    for (const [name, list] of grouped) {
      lines.push(name)
      for (const s of list) {
        const parts: string[] = []
        if (s.weight_lb != null) parts.push(`${s.weight_lb}lb`)
        if (s.reps != null) parts.push(`× ${s.reps}`)
        if (s.rpe != null) parts.push(`@${s.rpe}`)
        lines.push(`  set ${s.set_number}: ${parts.join(' ') || '—'}`)
      }
    }
    if (session.notes) {
      lines.push('')
      lines.push(`Notes: ${session.notes}`)
    }
    return lines.join('\n')
  }

  async function copyLog() {
    try {
      await navigator.clipboard.writeText(buildLogText())
      setCopied(true)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(30)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  if (!sessionId) {
    return (
      <div className="px-4 pt-6">
        <p className="text-rose-300 text-sm">No session id.</p>
        <Button onClick={() => router.push('/workout')} className="mt-3 bg-amber-400 text-black">Back</Button>
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 pb-12 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Session Summary</h1>
        <Badge variant="outline" className="border-green-400/30 text-green-300 text-xs">complete</Badge>
      </div>

      {/* Top stats */}
      <Card className="border-amber-400/20 bg-gradient-to-br from-amber-400/5 via-violet-400/5 to-cyan-400/5">
        <CardContent className="p-4 space-y-3">
          {session?.focus && <p className="text-white text-sm font-semibold">{session.focus}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Duration" value={fmtDuration(durationSec)} accent="text-amber-400" />
            <Stat label="Total volume" value={`${totalVolume.toLocaleString()} lb`} accent="text-cyan-400" />
            <Stat label="Total sets" value={String(totalSets)} accent="text-violet-400" />
            <Stat
              label="Energy"
              value={`${session?.energy_pre ?? '—'} → ${session?.energy_post ?? '—'}`}
              accent="text-green-400"
            />
          </div>
          {session?.mood_post && (
            <p className="text-xs text-white/60">
              <span className="uppercase tracking-wider text-white/40">Mood:</span> {session.mood_post}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Exercise breakdown */}
      <div>
        <p className="text-xs uppercase tracking-wider text-white/40 mb-2">Exercises</p>
        <div className="space-y-1.5">
          {grouped.map(([name, list]) => {
            const open = expanded[name] ?? true
            const volume = list.reduce((a, s) => a + ((s.weight_lb || 0) * (s.reps || 0)), 0)
            return (
              <Card key={name} className="border-white/10 bg-white/5">
                <button
                  onClick={() => setExpanded((p) => ({ ...p, [name]: !open }))}
                  className="w-full text-left px-3 py-2 flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    {open ? <ChevronDown size={14} className="text-white/40" /> : <ChevronRight size={14} className="text-white/40" />}
                    <Dumbbell size={13} className="text-white/40" />
                    <span className="text-sm font-medium">{name}</span>
                  </span>
                  <span className="text-[11px] text-white/50">
                    {list.length} set{list.length !== 1 ? 's' : ''}{volume ? ` · ${volume.toLocaleString()} lb` : ''}
                  </span>
                </button>
                {open && (
                  <div className="border-t border-white/10 px-3 py-2 space-y-1">
                    {list.map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-xs">
                        <span className="text-white/40">set {s.set_number}</span>
                        <span className="flex gap-2">
                          {s.weight_lb != null && <span className="text-amber-400">{s.weight_lb}lb</span>}
                          {s.reps != null && <span className="text-cyan-400">× {s.reps}</span>}
                          {s.rpe != null && <span className="text-violet-400">RPE {s.rpe}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </div>

      {session?.notes && (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Notes</p>
            <p className="text-sm text-white/80 whitespace-pre-line">{session.notes}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 pt-2">
        <Button onClick={copyLog} variant="outline" className="flex-1 border-white/20">
          {copied ? <><Check size={14} className="mr-1" /> Copied</> : <><Copy size={14} className="mr-1" /> Copy log entry</>}
        </Button>
        <Button onClick={() => router.push('/')} className="flex-1 bg-amber-400 text-black hover:bg-amber-300">
          <Home size={14} className="mr-1" /> Back to home
        </Button>
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
      <p className={`text-lg font-bold ${accent}`}>{value}</p>
    </div>
  )
}

function fmtDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, PracticeSession, PRACTICE_CATEGORY_COLORS, getCurrentUserId } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Sparkles, Plus, X, Flame, Wind, Sun, Footprints, Brain, HeartHandshake } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { SkeletonRow } from '@/components/Skeleton'

const CATEGORIES = [
  { key: 'thermal', label: 'Thermal', icon: Flame, types: ['Sauna', 'Cold plunge', 'Ice bath', 'Infrared', 'Contrast'] },
  { key: 'pressure_oxygen', label: 'Pressure / O₂', icon: Wind, types: ['HBOT', 'Breathwork', 'Wim Hof', 'Box breathing'] },
  { key: 'light', label: 'Light', icon: Sun, types: ['Red light', 'Sun exposure', 'Blue blockers', 'Grounding'] },
  { key: 'movement', label: 'Movement', icon: Footprints, types: ['Walking', 'Yoga', 'Mobility', 'Stretching', 'Zone 2'] },
  { key: 'mind_spiritual', label: 'Mind / Spirit', icon: Brain, types: ['Meditation', 'Journaling', 'Prayer', 'Gratitude', 'Reading'] },
  { key: 'recovery', label: 'Recovery', icon: HeartHandshake, types: ['Massage', 'Chiropractic', 'Acupuncture', 'Float tank'] },
  { key: 'custom', label: 'Custom', icon: Sparkles, types: [] },
] as const

export default function PracticesPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<PracticeSession[]>([])
  const [logging, setLogging] = useState<PracticeSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('practice_sessions')
      .select('*')
      .order('ts', { ascending: false })
      .limit(50)
    if (data) setSessions(data as PracticeSession[])
    setLoading(false)
  }

  async function save(s: PracticeSession) {
    setError(null)
    try {
      const userId = await getCurrentUserId()
      if (!userId) {
        router.push('/login?redirect=/practices')
        return
      }
      if (s.id) {
        const { error: updErr } = await supabase.from('practice_sessions').update(s).eq('id', s.id)
        if (updErr) throw new Error(updErr.message)
      } else {
        const { error: insErr } = await supabase.from('practice_sessions').insert({ ...s, user_id: userId })
        if (insErr) throw new Error(insErr.message)
      }
      setLogging(null)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save session')
    }
  }

  // Counts last 7 days by category
  const recentCounts = sessions.reduce<Record<string, number>>((acc, s) => {
    const within7d = s.ts && (Date.now() - new Date(s.ts).getTime() < 7 * 24 * 60 * 60 * 1000)
    if (within7d) acc[s.category] = (acc[s.category] || 0) + 1
    return acc
  }, {})

  return (
    <div className="px-4 pt-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="text-violet-400" size={24} /> Practices
        </h1>
        <p className="text-xs text-white/40 mt-0.5">Non-substance interventions</p>
      </div>

      {/* Quick-log grid */}
      <div className="grid grid-cols-2 gap-2">
        {CATEGORIES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setLogging({
              category: key as PracticeSession['category'],
              practice_type: '',
              ts: new Date().toISOString(),
            })}
            className={`p-3 rounded-xl border text-left transition-all active:scale-95 ${PRACTICE_CATEGORY_COLORS[key]}`}
          >
            <Icon size={18} />
            <p className="text-xs font-semibold text-white mt-1.5">{label}</p>
            <p className="text-[10px] text-white/40">{recentCounts[key] || 0} this week</p>
          </button>
        ))}
      </div>

      {error && (
        <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-md p-2">
          {error}
        </div>
      )}

      {/* Recent sessions */}
      <div>
        <p className="text-xs uppercase tracking-wider text-white/40 mb-2">Recent</p>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="Add a practice"
            body="Log sauna, cold plunge, meditation, breathwork, or anything else. Track how mood and energy shift before/after."
            accent="violet"
          />
        ) : (
          <div className="space-y-2">
            {sessions.map(s => (
              <Card key={s.id} className={`border bg-white/5 ${PRACTICE_CATEGORY_COLORS[s.category]}`}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{s.practice_type}</p>
                      <p className="text-[11px] text-white/50">
                        {s.duration_min ? `${s.duration_min} min` : ''}
                        {s.intensity ? ` · intensity ${s.intensity}/10` : ''}
                      </p>
                    </div>
                    <p className="text-[10px] text-white/40">
                      {s.ts ? new Date(s.ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                  {(s.mood_pre || s.mood_post) && (
                    <p className="text-[10px] text-white/40 mt-1">
                      mood {s.mood_pre || '—'} → {s.mood_post || '—'}
                      {s.energy_pre && ` · energy ${s.energy_pre} → ${s.energy_post || '—'}`}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {logging && (
        <PracticeEditor session={logging} onSave={save} onClose={() => setLogging(null)} />
      )}
    </div>
  )
}

function PracticeEditor({
  session, onSave, onClose,
}: {
  session: PracticeSession
  onSave: (s: PracticeSession) => void
  onClose: () => void
}) {
  const [s, setS] = useState<PracticeSession>(session)
  const cat = CATEGORIES.find(c => c.key === s.category)

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-end sm:items-center justify-center p-4">
      <Card className="border-white/10 bg-zinc-950 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Log {cat?.label}</h2>
            <button onClick={onClose} className="text-white/40 hover:text-white/80"><X size={20} /></button>
          </div>

          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider">Type</label>
            {cat && cat.types.length > 0 ? (
              <div className="grid grid-cols-2 gap-1 mt-1">
                {cat.types.map(t => (
                  <button key={t}
                    onClick={() => setS({ ...s, practice_type: t })}
                    className={`text-xs px-2 py-1.5 rounded border ${s.practice_type === t ? 'bg-amber-400 text-black border-amber-400' : 'bg-white/5 border-white/10 text-white/70'}`}
                  >{t}</button>
                ))}
                <input
                  value={(cat.types as readonly string[]).includes(s.practice_type) ? '' : s.practice_type}
                  onChange={e => setS({ ...s, practice_type: e.target.value })}
                  placeholder="Other..."
                  className="text-xs px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white/70 col-span-2"
                />
              </div>
            ) : (
              <input
                value={s.practice_type}
                onChange={e => setS({ ...s, practice_type: e.target.value })}
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm"
                placeholder="Custom practice name"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <NumField label="Duration (min)" value={s.duration_min} onChange={v => setS({ ...s, duration_min: v })} />
            <NumField label="Intensity 1-10" value={s.intensity} onChange={v => setS({ ...s, intensity: v })} max={10} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <NumField label="Mood pre" value={s.mood_pre} onChange={v => setS({ ...s, mood_pre: v })} max={10} />
            <NumField label="Energy pre" value={s.energy_pre} onChange={v => setS({ ...s, energy_pre: v })} max={10} />
            <NumField label="Clarity pre" value={s.clarity_pre} onChange={v => setS({ ...s, clarity_pre: v })} max={10} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <NumField label="Mood post" value={s.mood_post} onChange={v => setS({ ...s, mood_post: v })} max={10} />
            <NumField label="Energy post" value={s.energy_post} onChange={v => setS({ ...s, energy_post: v })} max={10} />
            <NumField label="Clarity post" value={s.clarity_post} onChange={v => setS({ ...s, clarity_post: v })} max={10} />
          </div>

          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider">Notes</label>
            <Textarea
              value={s.notes || ''}
              onChange={e => setS({ ...s, notes: e.target.value })}
              className="bg-white/5 border-white/10 mt-1"
            />
          </div>

          <Button
            onClick={() => onSave(s)}
            disabled={!s.practice_type}
            className="w-full bg-violet-400 text-black hover:bg-violet-300"
          >
            Save session
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function NumField({ label, value, onChange, max }: {
  label: string; value?: number; onChange: (v?: number) => void; max?: number
}) {
  return (
    <div>
      <label className="text-[10px] text-white/50 uppercase tracking-wider">{label}</label>
      <input
        type="number" min={0} max={max}
        value={value ?? ''} onChange={e => onChange(e.target.value ? Number(e.target.value) : undefined)}
        className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-violet-400/50"
      />
    </div>
  )
}

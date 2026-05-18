'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  supabase, getCurrentUserId, LifeEvent, LifeEventCategory,
  LIFE_EVENT_LABELS, LIFE_EVENT_COLORS,
} from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  BookOpen, Plus, X, Loader2, AlertTriangle, Calendar, Heart, MapPin, Briefcase,
  Users, Moon, FlaskConical, Dumbbell, AlertOctagon, Plane, Brain, Bandage, Circle, Trash2, Edit3,
} from 'lucide-react'

const CATEGORY_ICONS: Record<LifeEventCategory, typeof Heart> = {
  family_illness: Heart,
  loss: Heart,
  move: MapPin,
  job_change: Briefcase,
  relationship: Users,
  sleep_disruption: Moon,
  cycle_change: FlaskConical,
  training_gap: Dumbbell,
  stress_event: AlertOctagon,
  travel: Plane,
  mental_health: Brain,
  injury: Bandage,
  other: Circle,
}

const CATEGORIES: LifeEventCategory[] = [
  'family_illness', 'loss', 'mental_health', 'stress_event', 'sleep_disruption',
  'cycle_change', 'training_gap', 'injury', 'move', 'job_change', 'relationship', 'travel', 'other',
]

type FormState = {
  started_on: string
  ended_on: string
  category: LifeEventCategory
  title: string
  description: string
  impact_level: 'low' | 'medium' | 'high'
  ongoing: boolean
}

const EMPTY_FORM: FormState = {
  started_on: new Date().toISOString().split('T')[0],
  ended_on: '',
  category: 'stress_event',
  title: '',
  description: '',
  impact_level: 'medium',
  ongoing: false,
}

export default function TimelinePage() {
  const router = useRouter()
  const [events, setEvents] = useState<LifeEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login?redirect=/timeline')
        return
      }
      const { data, error: loadErr } = await supabase
        .from('life_events')
        .select('*')
        .order('started_on', { ascending: false })
      if (loadErr) throw new Error(loadErr.message)
      setEvents((data || []) as LifeEvent[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setShowForm(true)
  }

  function openEdit(ev: LifeEvent) {
    setEditingId(ev.id || null)
    setForm({
      started_on: ev.started_on,
      ended_on: ev.ended_on || '',
      category: ev.category,
      title: ev.title,
      description: ev.description || '',
      impact_level: ev.impact_level,
      ongoing: !ev.ended_on,
    })
    setShowForm(true)
  }

  async function save() {
    setError(null)
    if (!form.title.trim()) {
      setError('Give it a title')
      return
    }
    setSaving(true)
    try {
      const userId = await getCurrentUserId()
      if (!userId) throw new Error('Not signed in')
      const payload: Partial<LifeEvent> & { user_id: string } = {
        user_id: userId,
        started_on: form.started_on,
        ended_on: form.ongoing ? null : (form.ended_on || null),
        category: form.category,
        title: form.title.trim(),
        description: form.description.trim() || null,
        impact_level: form.impact_level,
      }
      if (editingId) {
        const { error: upErr } = await supabase.from('life_events').update(payload).eq('id', editingId)
        if (upErr) throw new Error(upErr.message)
      } else {
        const { error: insErr } = await supabase.from('life_events').insert(payload)
        if (insErr) throw new Error(insErr.message)
      }
      setShowForm(false)
      setEditingId(null)
      setForm(EMPTY_FORM)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function deleteEvent(id: string) {
    if (!confirm('Delete this event?')) return
    const { error: delErr } = await supabase.from('life_events').delete().eq('id', id)
    if (delErr) {
      setError(delErr.message)
      return
    }
    load()
  }

  // Group events by year for the timeline view
  const grouped = useMemo(() => {
    const m = new Map<string, LifeEvent[]>()
    for (const ev of events) {
      const yr = ev.started_on.split('-')[0]
      if (!m.has(yr)) m.set(yr, [])
      m.get(yr)!.push(ev)
    }
    return Array.from(m.entries()).sort((a, b) => Number(b[0]) - Number(a[0]))
  }, [events])

  return (
    <div className="px-4 pt-6 pb-12 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="text-violet-400" size={24} /> Life Timeline
          </h1>
          <p className="text-xs text-white/40 mt-0.5">
            {events.length} event{events.length !== 1 ? 's' : ''} · context Vitals uses to read your data correctly
          </p>
        </div>
        <Button
          onClick={openNew}
          className="bg-violet-500/20 border border-violet-400/40 text-violet-300 hover:bg-violet-500/30"
        >
          <Plus size={16} /> Add
        </Button>
      </div>

      {/* Why this matters card */}
      {events.length === 0 && !loading && (
        <Card className="border-violet-400/30 bg-gradient-to-br from-violet-500/5 to-transparent">
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-bold text-violet-200">Why this matters</p>
            <p className="text-xs text-white/70 leading-relaxed">
              The body is a result of life. Numbers without context mislead. When your AI Coach or Bloodwork Interpreter reads your data, it now reads it through THIS timeline — so a T crash during a caregiver year doesn't look like primary hypogonadism, and a sleep collapse during a breakup doesn't look like a thyroid problem.
            </p>
            <p className="text-xs text-white/70 leading-relaxed">
              Log the big events. Cycle ends. Moves. Family illness. Breakups. Travel. Injuries. Anything that shaped a chunk of your data window. Be honest with the AI — be more honest than you'd be with a doctor.
            </p>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-md p-2 flex items-start gap-1.5">
          <AlertTriangle size={12} className="mt-0.5" /> <span>{error}</span>
        </div>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={18} className="animate-spin text-violet-400" />
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([year, eventsInYear]) => (
            <div key={year} className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold sticky top-0 bg-black/70 backdrop-blur py-1">
                {year}
              </p>
              {eventsInYear.map((ev) => {
                const Icon = CATEGORY_ICONS[ev.category] || Circle
                const colorClass = LIFE_EVENT_COLORS[ev.category] || 'border-white/10 bg-white/5 text-white/70'
                return (
                  <Card key={ev.id} className={`border ${colorClass.split(' ')[0]} bg-white/5`}>
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <div className={`w-8 h-8 rounded-md flex-shrink-0 flex items-center justify-center border ${colorClass}`}>
                            <Icon size={14} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-white leading-tight">{ev.title}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[10px] uppercase tracking-wider text-white/40">
                                {LIFE_EVENT_LABELS[ev.category]}
                              </span>
                              <span className="text-[10px] text-white/30">·</span>
                              <span className="text-[10px] text-white/50 tabular-nums">
                                {formatDateRange(ev.started_on, ev.ended_on)}
                              </span>
                              {ev.impact_level === 'high' && (
                                <Badge variant="outline" className="border-rose-400/40 text-rose-300 text-[9px] py-0">high impact</Badge>
                              )}
                              {ev.impact_level === 'low' && (
                                <Badge variant="outline" className="border-white/15 text-white/40 text-[9px] py-0">low impact</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => openEdit(ev)}
                            className="p-1.5 rounded-md text-white/40 hover:text-white/80 hover:bg-white/5"
                            aria-label="Edit"
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            onClick={() => ev.id && deleteEvent(ev.id)}
                            className="p-1.5 rounded-md text-rose-400/70 hover:text-rose-300 hover:bg-rose-500/10"
                            aria-label="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      {ev.description && (
                        <p className="text-[11px] text-white/65 leading-relaxed pl-10 whitespace-pre-line">
                          {ev.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-40 bg-black/80 backdrop-blur"
              onClick={() => !saving && setShowForm(false)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed left-0 right-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto safe-bottom"
            >
              <div className="max-w-md mx-auto bg-zinc-950 border-t border-white/10 rounded-t-3xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-base font-bold">{editingId ? 'Edit event' : 'Add life event'}</p>
                  <button onClick={() => !saving && setShowForm(false)} className="text-white/40 hover:text-white/80">
                    <X size={20} />
                  </button>
                </div>

                {/* Title */}
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-white/40">Title *</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    onBlur={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Mom diagnosed with cancer · Came off cycle cold turkey"
                    className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-violet-400/50"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-white/40">Category</label>
                  <div className="grid grid-cols-3 gap-1.5 mt-1">
                    {CATEGORIES.map((cat) => {
                      const Icon = CATEGORY_ICONS[cat]
                      const isSelected = form.category === cat
                      return (
                        <button
                          key={cat}
                          onClick={() => setForm({ ...form, category: cat })}
                          className={`flex flex-col items-center gap-1 p-2 rounded-md border text-[10px] transition-colors ${
                            isSelected
                              ? `${LIFE_EVENT_COLORS[cat]} font-bold`
                              : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10'
                          }`}
                        >
                          <Icon size={14} />
                          <span className="text-center leading-tight">{LIFE_EVENT_LABELS[cat]}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/40">Started</label>
                    <input
                      type="date"
                      value={form.started_on}
                      onChange={(e) => setForm({ ...form, started_on: e.target.value })}
                      className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-violet-400/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-white/40">
                      {form.ongoing ? 'Ongoing' : 'Ended (optional)'}
                    </label>
                    <input
                      type="date"
                      value={form.ended_on}
                      disabled={form.ongoing}
                      onChange={(e) => setForm({ ...form, ended_on: e.target.value })}
                      className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-violet-400/50 disabled:opacity-40"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-violet-400"
                    checked={form.ongoing}
                    onChange={(e) => setForm({ ...form, ongoing: e.target.checked, ended_on: e.target.checked ? '' : form.ended_on })}
                  />
                  <span className="text-white/70">Still happening / single-point event</span>
                </label>

                {/* Impact */}
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-white/40">Impact on your body / mind</label>
                  <div className="grid grid-cols-3 gap-1.5 mt-1">
                    {(['low', 'medium', 'high'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => setForm({ ...form, impact_level: lvl })}
                        className={`py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${
                          form.impact_level === lvl
                            ? lvl === 'high' ? 'bg-rose-400/20 border border-rose-400/40 text-rose-200'
                            : lvl === 'medium' ? 'bg-amber-400/20 border border-amber-400/40 text-amber-200'
                            : 'bg-white/10 border border-white/20 text-white/60'
                            : 'bg-white/5 border border-white/10 text-white/40 hover:bg-white/10'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-white/40">Context</label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    onBlur={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="What was happening? How did it affect sleep / training / mood / nutrition? Be honest — the AI uses this to read your data correctly."
                    className="bg-white/5 border-white/10 mt-1 min-h-[100px]"
                  />
                </div>

                {error && (
                  <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-md p-2">
                    {error}
                  </div>
                )}

                {/* Save */}
                <div className="flex gap-2 pt-1 border-t border-white/5">
                  <Button
                    onClick={save}
                    disabled={saving || !form.title.trim()}
                    className="flex-1 bg-violet-400 text-black hover:bg-violet-300 disabled:opacity-50 h-11 font-bold"
                  >
                    {saving ? <><Loader2 size={14} className="mr-2 animate-spin" /> Saving</> : (editingId ? 'Save changes' : 'Add event')}
                  </Button>
                  <Button
                    onClick={() => !saving && setShowForm(false)}
                    variant="outline"
                    className="border-white/20 text-white/60 h-11"
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function formatDateRange(start: string, end?: string | null): string {
  const s = new Date(start)
  const startFmt = s.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  if (!end) return `${startFmt} →`
  const e = new Date(end)
  if (s.toDateString() === e.toDateString()) return startFmt
  const endFmt = e.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  return `${startFmt} → ${endFmt}`
}

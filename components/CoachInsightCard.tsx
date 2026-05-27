'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles, Loader2, RefreshCw, AlertTriangle, ChevronRight, Brain, Dumbbell, FlaskConical, Heart, Apple, Camera, Activity, BellOff, Check, Bell } from 'lucide-react'

type InsightType = 'nutrition' | 'training' | 'protocol' | 'recovery' | 'bloodwork' | 'body_comp' | 'general'

type Insight = {
  type: InsightType
  topic_key?: string
  title: string
  body: string
  urgency: 'low' | 'medium' | 'high'
  data_sources: string[]
}

type CoachResponse = {
  cached: boolean
  generated_at: string
  insights: Insight[]
  context_summary?: string
  error?: string
}

const TYPE_META: Record<InsightType, { icon: typeof Brain; accent: string; bg: string; border: string }> = {
  nutrition:  { icon: Apple,        accent: 'text-emerald-300', bg: 'bg-emerald-500/5', border: 'border-emerald-400/30' },
  training:   { icon: Dumbbell,     accent: 'text-amber-300',   bg: 'bg-amber-500/5',   border: 'border-amber-400/30' },
  protocol:   { icon: FlaskConical, accent: 'text-cyan-300',    bg: 'bg-cyan-500/5',    border: 'border-cyan-400/30' },
  recovery:   { icon: Heart,        accent: 'text-rose-300',    bg: 'bg-rose-500/5',    border: 'border-rose-400/30' },
  bloodwork:  { icon: Activity,     accent: 'text-violet-300',  bg: 'bg-violet-500/5',  border: 'border-violet-400/30' },
  body_comp:  { icon: Camera,       accent: 'text-pink-300',    bg: 'bg-pink-500/5',    border: 'border-pink-400/30' },
  general:    { icon: Brain,        accent: 'text-blue-300',    bg: 'bg-blue-500/5',    border: 'border-blue-400/30' },
}

const URGENCY_PULSE: Record<Insight['urgency'], string> = {
  high: 'ring-1 ring-rose-400/40',
  medium: '',
  low: 'opacity-95',
}


// Fallback topic_key when Claude didn't tag the insight (legacy cached insights from before
// the snooze feature shipped). Stable slug of the title so re-runs hit the same row.
function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'untitled-insight'
}

export default function CoachInsightCard() {
  const [data, setData] = useState<CoachResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<number | null>(0) // first card expanded by default
  const [snoozing, setSnoozing] = useState<string | null>(null)
  const [snoozed, setSnoozed] = useState<Set<string>>(new Set())
  const [pausedList, setPausedList] = useState<Array<{ topic_key: string; topic_title: string; dismissed_until: string }>>([])
  const [showPaused, setShowPaused] = useState(false)
  const [unsnoozing, setUnsnoozing] = useState<string | null>(null)

  async function loadPaused() {
    try {
      const res = await fetch('/api/coach-dismiss')
      if (res.ok) {
        const j = await res.json()
        setPausedList(j.snoozed || [])
      }
    } catch { /* non-critical */ }
  }

  async function unsnoozeTopic(topicKey: string) {
    if (unsnoozing) return
    setUnsnoozing(topicKey)
    try {
      const res = await fetch(`/api/coach-dismiss?topic_key=${encodeURIComponent(topicKey)}`, { method: 'DELETE' })
      if (res.ok) {
        setPausedList((list) => list.filter((p) => p.topic_key !== topicKey))
        setSnoozed((set) => { const n = new Set(set); n.delete(topicKey); return n })
      }
    } catch { /* user can retry */ } finally {
      setUnsnoozing(null)
    }
  }

  async function snoozeTopic(topicKey: string, topicTitle: string) {
    if (!topicKey || snoozing) return
    setSnoozing(topicKey)
    try {
      const res = await fetch('/api/coach-dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_key: topicKey, topic_title: topicTitle, days: 7 }),
      })
      if (res.ok) {
        setSnoozed((s) => new Set(s).add(topicKey))
        const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        setPausedList((list) => {
          if (list.some((p) => p.topic_key === topicKey)) return list
          return [{ topic_key: topicKey, topic_title: topicTitle, dismissed_until: until }, ...list]
        })
      }
    } catch {
      // silent — user can retry
    } finally {
      setSnoozing(null)
    }
  }

  function cacheKey() {
    return `vitals:coach:${new Date().toISOString().slice(0, 10)}`
  }

  async function fetchCoach(forceRefresh = false) {
    if (forceRefresh) setGenerating(true)
    else if (!data) setLoading(true) // only show skeleton if we have NOTHING to show
    setError(null)
    try {
      const res = await fetch(`/api/coach-today${forceRefresh ? '?refresh=1' : ''}`)
      const json = (await res.json()) as CoachResponse
      if (!res.ok) throw new Error(json.error || 'Coach failed')
      setData(json)
      try { localStorage.setItem(cacheKey(), JSON.stringify(json)) } catch { /* private mode */ }
    } catch (e) {
      // If we have a cached version showing, don't blow away the UI with an error
      if (!data) setError(e instanceof Error ? e.message : 'Could not load coach')
    } finally {
      setLoading(false)
      setGenerating(false)
    }
  }

  useEffect(() => {
    // Stale-while-revalidate: paint cached coach instantly, then refresh in the background.
    try {
      const cached = localStorage.getItem(cacheKey())
      if (cached) {
        setData(JSON.parse(cached))
        setLoading(false)
      }
    } catch { /* noop */ }
    fetchCoach(false)
    loadPaused()
  }, [])

  // No insights state — first-time user with no data yet
  const hasInsights = data?.insights && data.insights.length > 0

  if (loading && !data) {
    return (
      <Card className="border-amber-400/20 bg-gradient-to-br from-amber-400/5 to-violet-400/5">
        <CardContent className="p-4 flex items-center gap-3">
          <Loader2 size={18} className="animate-spin text-amber-400" />
          <p className="text-sm text-white/60">Coach is reading your data…</p>
        </CardContent>
      </Card>
    )
  }

  if (error && !data) {
    return (
      <Card className="border-rose-400/30 bg-rose-500/5">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle size={16} className="text-rose-400 flex-shrink-0" />
            <p className="text-xs text-rose-200 truncate">{error}</p>
          </div>
          <button
            onClick={() => fetchCoach(true)}
            className="text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-md bg-rose-400/20 border border-rose-400/40 text-rose-200 hover:bg-rose-400/30"
          >
            Retry
          </button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-amber-400/20 bg-gradient-to-br from-amber-400/[0.04] via-transparent to-violet-400/[0.04] overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center">
              <Sparkles size={14} className="text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">Today&apos;s Intelligence</p>
              <p className="text-[10px] text-white/40">
                {data?.cached ? 'Cached — generated earlier today' : 'Fresh read'}
                {data?.generated_at && ` · ${new Date(data.generated_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchCoach(true)}
            disabled={generating}
            className="text-white/40 hover:text-white/80 disabled:opacity-40 p-1.5 rounded-md hover:bg-white/5"
            aria-label="Refresh insights"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>

        {/* Insights */}
        {!hasInsights && !generating && (
          <div className="text-center py-3">
            <p className="text-xs text-white/50">No insights yet. Log your stack + a meal to unlock today&apos;s read.</p>
          </div>
        )}

        {hasInsights && (
          <div className="space-y-2">
            {data!.insights.map((ins, i) => {
              const meta = TYPE_META[ins.type] || TYPE_META.general
              const Icon = meta.icon
              const isOpen = expanded === i
              const topicKey = ins.topic_key || slugifyTitle(ins.title)
              return (
                <button
                  key={i}
                  onClick={() => setExpanded(isOpen ? null : i)}
                  className={`w-full text-left rounded-lg border ${meta.border} ${meta.bg} ${URGENCY_PULSE[ins.urgency]} p-2.5 transition-colors hover:brightness-110`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`w-7 h-7 rounded-md ${meta.bg} border ${meta.border} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={14} className={meta.accent} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs font-bold ${meta.accent} leading-tight`}>{ins.title}</p>
                        <ChevronRight
                          size={12}
                          className={`text-white/30 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                        />
                      </div>
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="overflow-hidden"
                          >
                            <p className="text-[12px] text-white/75 leading-relaxed mt-1.5">{ins.body}</p>
                            {ins.data_sources.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {ins.data_sources.map((src) => (
                                  <span
                                    key={src}
                                    className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/40"
                                  >
                                    {src}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-end">
                              {snoozed.has(topicKey) ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-300 inline-flex items-center gap-1">
                                    <Check size={11} /> Paused 7 days
                                  </span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); unsnoozeTopic(topicKey) }}
                                    disabled={unsnoozing === topicKey}
                                    className="text-[10px] uppercase tracking-wider font-bold text-white/40 hover:text-white/80 disabled:opacity-50 underline underline-offset-2"
                                  >
                                    Undo
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    snoozeTopic(topicKey, ins.title)
                                  }}
                                  disabled={snoozing === topicKey}
                                  className="text-[10px] uppercase tracking-wider font-bold text-white/40 hover:text-white/80 disabled:opacity-50 inline-flex items-center gap-1 px-1.5 py-1 rounded hover:bg-white/5"
                                  aria-label="Got it — stop showing this for 7 days"
                                >
                                  {snoozing === topicKey ? (
                                    <Loader2 size={11} className="animate-spin" />
                                  ) : (
                                    <BellOff size={11} />
                                  )}
                                  Got it — pause 7d
                                </button>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Paused topics manager — un-snooze anything you muted */}
        {pausedList.length > 0 && (
          <div className="pt-1 border-t border-white/5">
            <button
              onClick={() => setShowPaused((v) => !v)}
              className="w-full flex items-center justify-between text-[10px] uppercase tracking-wider text-white/40 hover:text-white/70 py-1"
            >
              <span className="inline-flex items-center gap-1">
                <BellOff size={11} /> Paused topics ({pausedList.length})
              </span>
              <ChevronRight size={11} className={`transition-transform ${showPaused ? 'rotate-90' : ''}`} />
            </button>
            {showPaused && (
              <div className="space-y-1 mt-1">
                {pausedList.map((p) => (
                  <div key={p.topic_key} className="flex items-center justify-between gap-2 rounded-md bg-white/[0.03] border border-white/5 px-2 py-1.5">
                    <span className="text-[11px] text-white/60 truncate">{p.topic_title}</span>
                    <button
                      onClick={() => unsnoozeTopic(p.topic_key)}
                      disabled={unsnoozing === p.topic_key}
                      className="text-[10px] uppercase tracking-wider font-bold text-amber-300/80 hover:text-amber-200 disabled:opacity-50 inline-flex items-center gap-1 flex-shrink-0"
                    >
                      {unsnoozing === p.topic_key ? <Loader2 size={10} className="animate-spin" /> : <Bell size={10} />}
                      Resume
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-[9px] text-white/30 leading-relaxed pt-1 border-t border-white/5">
          Information, not medical advice. Discuss any protocol changes with a knowledgeable practitioner.
        </p>
      </CardContent>
    </Card>
  )
}

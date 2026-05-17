'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles, Loader2, RefreshCw, AlertTriangle, ChevronRight, Brain, Dumbbell, FlaskConical, Heart, Apple, Camera, Activity } from 'lucide-react'

type InsightType = 'nutrition' | 'training' | 'protocol' | 'recovery' | 'bloodwork' | 'body_comp' | 'general'

type Insight = {
  type: InsightType
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

export default function CoachInsightCard() {
  const [data, setData] = useState<CoachResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<number | null>(0) // first card expanded by default

  async function fetchCoach(forceRefresh = false) {
    if (forceRefresh) setGenerating(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/coach-today${forceRefresh ? '?refresh=1' : ''}`)
      const json = (await res.json()) as CoachResponse
      if (!res.ok) throw new Error(json.error || 'Coach failed')
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load coach')
    } finally {
      setLoading(false)
      setGenerating(false)
    }
  }

  useEffect(() => { fetchCoach(false) }, [])

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
              <p className="text-sm font-bold text-white leading-tight">Today's Intelligence</p>
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
            <p className="text-xs text-white/50">No insights yet. Log your stack + a meal to unlock today's read.</p>
          </div>
        )}

        {hasInsights && (
          <div className="space-y-2">
            {data!.insights.map((ins, i) => {
              const meta = TYPE_META[ins.type] || TYPE_META.general
              const Icon = meta.icon
              const isOpen = expanded === i
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

        <p className="text-[9px] text-white/30 leading-relaxed pt-1 border-t border-white/5">
          Information, not medical advice. Discuss any protocol changes with a knowledgeable practitioner.
        </p>
      </CardContent>
    </Card>
  )
}

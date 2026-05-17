'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase, BloodworkPanel, BloodworkMarker } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Disclaimer from '@/components/Disclaimer'
import {
  ChevronLeft, Sparkles, Loader2, RefreshCw, AlertTriangle, TrendingUp, TrendingDown,
  FlaskConical, Activity, Beaker, Lightbulb, ChevronDown, ChevronUp,
} from 'lucide-react'

type HotSpot = {
  marker: string
  value: number | string
  unit: string
  ref_range: string
  flag: 'low' | 'normal' | 'high' | 'critical'
  what_it_means: string
  context_with_stack: string | null
  trend_note: string | null
}

type Trend = {
  marker: string
  from_value: number | string
  to_value: number | string
  percent_change: number
  direction: 'up' | 'down'
  likely_drivers: string[]
  what_to_watch: string
}

type StackInteraction = {
  substance: string
  marker: string
  interaction: string
  what_to_track: string
}

type LifestyleDial = {
  intervention: string
  rationale: string
  evidence_strength: 'low' | 'moderate' | 'strong'
}

type Interpretation = {
  headline: string
  overall_read: string
  hot_spots: HotSpot[]
  trends: Trend[]
  stack_interactions: StackInteraction[]
  suggested_next_labs: string[]
  lifestyle_dials: LifestyleDial[]
  context_summary?: string
}

type InterpretationResponse = {
  cached: boolean
  generated_at: string
  interpretation: Interpretation
  context_summary?: string
  error?: string
}

const FLAG_STYLES: Record<HotSpot['flag'], string> = {
  low: 'border-blue-400/40 bg-blue-500/10 text-blue-200',
  normal: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  high: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
  critical: 'border-rose-400/40 bg-rose-500/10 text-rose-200',
}

const EVIDENCE_DOTS: Record<LifestyleDial['evidence_strength'], string> = {
  strong: '●●●',
  moderate: '●●○',
  low: '●○○',
}

export default function BloodworkPanelDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const panelId = params?.id

  const [panel, setPanel] = useState<BloodworkPanel | null>(null)
  const [markers, setMarkers] = useState<BloodworkMarker[]>([])
  const [interpretation, setInterpretation] = useState<Interpretation | null>(null)
  const [cached, setCached] = useState(false)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAllMarkers, setShowAllMarkers] = useState(false)

  useEffect(() => {
    if (!panelId) return
    (async () => {
      setLoading(true)
      const [{ data: p }, { data: m }, { data: existing }] = await Promise.all([
        supabase.from('bloodwork_panels').select('*').eq('id', panelId).maybeSingle(),
        supabase.from('bloodwork_markers').select('*').eq('panel_id', panelId).order('category'),
        supabase.from('bloodwork_interpretations').select('*').eq('panel_id', panelId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      if (p) setPanel(p as BloodworkPanel)
      if (m) setMarkers(m as BloodworkMarker[])
      if (existing) {
        setInterpretation(existing.interpretation as Interpretation)
        setGeneratedAt(existing.created_at)
        setCached(true)
      }
      setLoading(false)
    })()
  }, [panelId])

  async function generate(refresh = false) {
    if (!panelId) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/interpret-bloodwork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ panel_id: panelId, refresh }),
      })
      const data = (await res.json()) as InterpretationResponse
      if (!res.ok) throw new Error(data.error || 'Failed')
      setInterpretation(data.interpretation)
      setCached(data.cached)
      setGeneratedAt(data.generated_at)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate interpretation')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-rose-400" />
      </div>
    )
  }

  if (!panel) {
    return (
      <div className="px-4 pt-6">
        <Link href="/bloodwork" className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1">
          <ChevronLeft size={12} /> Back to Bloodwork
        </Link>
        <p className="text-white/60 mt-6">Panel not found.</p>
      </div>
    )
  }

  // Group markers by category for the marker list
  const markersByCategory = markers.reduce<Record<string, BloodworkMarker[]>>((acc, m) => {
    const cat = m.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(m)
    return acc
  }, {})
  const visibleMarkers = showAllMarkers
    ? markers
    : markers.filter(m => m.flag === 'low' || m.flag === 'high' || m.flag === 'critical').slice(0, 8)

  return (
    <div className="px-4 pt-6 pb-12 space-y-5">
      <Link href="/bloodwork" className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1">
        <ChevronLeft size={12} /> Back to Bloodwork
      </Link>

      {/* Panel header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">{panel.panel_name || 'Bloodwork panel'}</h1>
        <p className="text-xs text-white/50 mt-0.5">
          {panel.drawn_on || (panel.ts ? new Date(panel.ts).toLocaleDateString() : 'Unknown date')}
          {panel.lab_provider && ` · ${panel.lab_provider}`}
          {' · '}{markers.length} markers
        </p>
      </div>

      {/* AI Interpreter Card */}
      <Card className="border-amber-400/30 bg-gradient-to-br from-amber-400/5 via-transparent to-violet-400/5 overflow-hidden">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center">
                <Sparkles size={16} className="text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">AI Interpreter</p>
                <p className="text-[10px] text-white/40">
                  {!interpretation && !generating && 'Press Interpret to generate a forensic read'}
                  {interpretation && cached && generatedAt && `Cached · ${new Date(generatedAt).toLocaleString()}`}
                  {interpretation && !cached && generatedAt && `Fresh · ${new Date(generatedAt).toLocaleString()}`}
                </p>
              </div>
            </div>
            {interpretation && (
              <button
                onClick={() => generate(true)}
                disabled={generating}
                className="text-white/40 hover:text-white/80 disabled:opacity-40 p-1.5 rounded-md hover:bg-white/5"
                aria-label="Re-generate"
              >
                {generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              </button>
            )}
          </div>

          {/* CTA when no interpretation yet */}
          {!interpretation && !generating && (
            <div className="space-y-2">
              <p className="text-xs text-white/60 leading-relaxed">
                Get a forensic read of this panel using your full Vitals profile — your stack, training, body comp, prior panels, and goals. Information framed, not medical advice.
              </p>
              <Button
                onClick={() => generate(false)}
                className="w-full bg-amber-400 text-black hover:bg-amber-300 font-bold h-11"
              >
                <Sparkles size={14} className="mr-2" /> Interpret this panel
              </Button>
              {error && (
                <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-md p-2 flex items-start gap-1.5">
                  <AlertTriangle size={12} className="mt-0.5" /> {error}
                </p>
              )}
            </div>
          )}

          {generating && !interpretation && (
            <div className="flex items-center gap-2 text-white/60 py-2">
              <Loader2 size={14} className="animate-spin text-amber-400" />
              <p className="text-xs">Reading your panel in context… ~10-20 seconds.</p>
            </div>
          )}

          {/* Interpretation rendered */}
          {interpretation && (
            <div className="space-y-4">
              {/* Headline */}
              <div>
                <p className="text-base font-bold text-amber-300 leading-snug">{interpretation.headline}</p>
                <p className="text-xs text-white/70 mt-2 leading-relaxed whitespace-pre-line">{interpretation.overall_read}</p>
              </div>

              {/* Hot Spots */}
              {interpretation.hot_spots && interpretation.hot_spots.length > 0 && (
                <Section icon={Activity} title="Hot spots" accent="text-rose-300">
                  <div className="space-y-2">
                    {interpretation.hot_spots.map((h, i) => (
                      <div key={i} className={`rounded-lg border p-2.5 ${FLAG_STYLES[h.flag]}`}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold">{h.marker}</p>
                          <p className="text-xs font-mono tabular-nums">
                            {h.value} <span className="opacity-70">{h.unit}</span>
                            <span className="opacity-50 ml-1">({h.ref_range})</span>
                          </p>
                        </div>
                        <p className="text-[11px] mt-1.5 leading-relaxed text-white/80">{h.what_it_means}</p>
                        {h.context_with_stack && (
                          <p className="text-[11px] mt-1.5 leading-relaxed bg-cyan-500/10 border-l-2 border-cyan-400/50 pl-2 py-1 text-cyan-200">
                            <span className="font-bold">Stack context:</span> {h.context_with_stack}
                          </p>
                        )}
                        {h.trend_note && (
                          <p className="text-[11px] mt-1.5 leading-relaxed bg-violet-500/10 border-l-2 border-violet-400/50 pl-2 py-1 text-violet-200">
                            <span className="font-bold">Trend:</span> {h.trend_note}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Trends */}
              {interpretation.trends && interpretation.trends.length > 0 && (
                <Section icon={TrendingUp} title="Trends vs prior panel" accent="text-violet-300">
                  <div className="space-y-2">
                    {interpretation.trends.map((t, i) => {
                      const TrendIcon = t.direction === 'up' ? TrendingUp : TrendingDown
                      const trendColor = t.direction === 'up' ? 'text-emerald-300' : 'text-rose-300'
                      return (
                        <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-white">{t.marker}</p>
                            <div className={`flex items-center gap-1 ${trendColor}`}>
                              <TrendIcon size={12} />
                              <span className="text-xs font-mono tabular-nums font-bold">
                                {t.percent_change > 0 ? '+' : ''}{t.percent_change}%
                              </span>
                            </div>
                          </div>
                          <p className="text-[11px] text-white/60 mt-1">
                            {t.from_value} → {t.to_value}
                          </p>
                          {t.likely_drivers.length > 0 && (
                            <p className="text-[11px] mt-1.5 text-white/70">
                              <span className="text-white/40">Likely drivers:</span> {t.likely_drivers.join(', ')}
                            </p>
                          )}
                          <p className="text-[11px] mt-1 text-white/70">
                            <span className="text-white/40">Watch:</span> {t.what_to_watch}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </Section>
              )}

              {/* Stack interactions */}
              {interpretation.stack_interactions && interpretation.stack_interactions.length > 0 && (
                <Section icon={FlaskConical} title="Stack interactions" accent="text-cyan-300">
                  <div className="space-y-2">
                    {interpretation.stack_interactions.map((si, i) => (
                      <div key={i} className="rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-2.5">
                        <p className="text-xs font-bold text-cyan-200">
                          {si.substance} ↔ {si.marker}
                        </p>
                        <p className="text-[11px] text-white/75 mt-1.5 leading-relaxed">{si.interaction}</p>
                        <p className="text-[11px] mt-1.5 text-cyan-300/80">
                          <span className="text-white/40">Track:</span> {si.what_to_track}
                        </p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Suggested next labs */}
              {interpretation.suggested_next_labs && interpretation.suggested_next_labs.length > 0 && (
                <Section icon={Beaker} title="Order next time" accent="text-blue-300">
                  <div className="flex flex-wrap gap-1.5">
                    {interpretation.suggested_next_labs.map((lab, i) => (
                      <Badge key={i} variant="outline" className="border-blue-400/30 text-blue-200 text-[11px]">
                        {lab}
                      </Badge>
                    ))}
                  </div>
                </Section>
              )}

              {/* Lifestyle dials */}
              {interpretation.lifestyle_dials && interpretation.lifestyle_dials.length > 0 && (
                <Section icon={Lightbulb} title="Cheap dials worth turning" accent="text-emerald-300">
                  <div className="space-y-2">
                    {interpretation.lifestyle_dials.map((d, i) => (
                      <div key={i} className="rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-emerald-200">{d.intervention}</p>
                          <span className="text-[10px] font-mono text-emerald-300/70" title={`Evidence: ${d.evidence_strength}`}>
                            {EVIDENCE_DOTS[d.evidence_strength]}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/75 mt-1.5 leading-relaxed">{d.rationale}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          )}

          <p className="text-[10px] text-white/30 leading-relaxed pt-2 border-t border-white/5">
            Information, not medical advice. Discuss any protocol changes with a knowledgeable practitioner.
          </p>
        </CardContent>
      </Card>

      {/* Raw markers — collapsible */}
      <Card className="border-white/10 bg-white/5">
        <CardHeader className="pb-2 pt-3 flex flex-row items-center justify-between">
          <CardTitle className="text-xs uppercase tracking-wider text-white/60">
            All markers ({markers.length})
          </CardTitle>
          <button
            onClick={() => setShowAllMarkers(s => !s)}
            className="text-[10px] uppercase tracking-wider text-white/40 hover:text-white/80 flex items-center gap-1"
          >
            {showAllMarkers ? <>Show flagged only <ChevronUp size={11} /></> : <>Show all <ChevronDown size={11} /></>}
          </button>
        </CardHeader>
        <CardContent className="space-y-1.5 pb-3">
          {visibleMarkers.length === 0 && (
            <p className="text-[11px] text-white/40">No flagged markers in this panel.</p>
          )}
          {visibleMarkers.map(m => (
            <div key={m.id} className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-white/80 truncate">{m.marker}</p>
                <p className="text-[10px] text-white/40">
                  {m.category} · ref {m.ref_low ?? '—'} – {m.ref_high ?? '—'} {m.unit || ''}
                </p>
              </div>
              <div className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded border ${FLAG_STYLES[m.flag || 'normal']}`}>
                {m.value}<span className="text-[10px] opacity-60 ml-0.5">{m.unit}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Disclaimer />
    </div>
  )
}

function Section({
  icon: Icon, title, accent, children,
}: {
  icon: typeof Sparkles; title: string; accent: string; children: React.ReactNode
}) {
  return (
    <div>
      <p className={`text-[10px] uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5 ${accent}`}>
        <Icon size={11} /> {title}
      </p>
      {children}
    </div>
  )
}

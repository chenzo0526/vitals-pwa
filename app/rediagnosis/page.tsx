'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Brain, Sparkles, ThumbsUp, X, Check, Loader2, Beaker, AlertTriangle } from 'lucide-react'
import { InlineUpgradeCard } from '@/components/UpgradeBadge'
import Disclaimer from '@/components/Disclaimer'

type Report = {
  id: string
  ts: string
  model_used: string
  tier_at_time: string
  wins?: Array<{ title: string; detail: string }>
  leaks?: Array<{ title: string; detail: string }>
  adjustments?: Array<{ title: string; detail: string; category?: string }>
  bloodwork_due?: Array<{ panel: string; reason: string; suggested_timeframe: string }>
  experiment?: { title: string; hypothesis: string; protocol: string; duration_days: number }
}

export default function RediagnosisPage() {
  const [tier, setTier] = useState<'free' | 'pro' | 'premium'>('pro')
  const [report, setReport] = useState<Report | null>(null)
  const [history, setHistory] = useState<Report[]>([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<string, 'accept' | 'skip' | 'already_doing'>>({})

  useEffect(() => { load() }, [])

  async function load() {
    const [profRes, repsRes] = await Promise.all([
      supabase.from('user_profile').select('tier').single(),
      supabase.from('rediagnosis_reports').select('*').order('ts', { ascending: false }).limit(10),
    ])
    if (profRes.data) setTier((profRes.data as { tier: 'free' | 'pro' | 'premium' }).tier)
    if (repsRes.data && repsRes.data.length > 0) {
      setReport(repsRes.data[0] as Report)
      setHistory(repsRes.data as Report[])
    }
  }

  async function run() {
    setRunning(true)
    setError(null)
    try {
      const res = await fetch('/api/rediagnosis', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Rediagnosis failed')
      setReport(data)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setRunning(false)
    }
  }

  async function logFeedback(idx: number, action: 'accept' | 'skip' | 'already_doing', text: string) {
    if (!report) return
    setFeedback(prev => ({ ...prev, [`${report.id}-${idx}`]: action }))
    await supabase.from('rediagnosis_feedback').insert({
      report_id: report.id,
      recommendation_index: idx,
      recommendation_text: text,
      action,
    })
  }

  if (tier === 'free') {
    return (
      <div className="px-4 pt-6 space-y-5">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Brain className="text-violet-400" size={24} /> Rediagnosis
        </h1>
        <InlineUpgradeCard
          title="Weekly AI Review is a Pro feature"
          description="Sonnet 4.5 weekly review (Pro) or Opus 4.7 monthly review (Premium). Reviews your full stack, bloodwork, training, and practices — surfaces 3 wins, 3 leaks, 3 protocol adjustments, and an experiment to run."
        />
        <Disclaimer />
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="text-violet-400" size={24} /> Rediagnosis
          </h1>
          <p className="text-xs text-white/40 mt-0.5">
            {tier === 'premium' ? 'Opus 4.7 · monthly' : 'Sonnet 4.5 · weekly'}
          </p>
        </div>
        <Button
          onClick={run}
          disabled={running}
          className="bg-violet-500/20 border border-violet-400/40 text-violet-300 hover:bg-violet-500/30"
        >
          {running ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
          {running ? 'Running…' : 'Run review'}
        </Button>
      </div>

      {error && (
        <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-md p-2 flex items-start gap-1.5">
          <AlertTriangle size={12} className="mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {report ? (
        <>
          <p className="text-[10px] text-white/40 uppercase tracking-wider">
            Reviewed {new Date(report.ts).toLocaleString()} · {report.model_used}
          </p>

          {/* Wins */}
          <Section title="3 Wins" emoji="✅" color="green">
            {(report.wins || []).map((w, i) => (
              <ItemCard key={i} title={w.title} detail={w.detail} color="green" />
            ))}
          </Section>

          {/* Leaks */}
          <Section title="3 Leaks" emoji="⚠️" color="amber">
            {(report.leaks || []).map((l, i) => (
              <ItemCard key={i} title={l.title} detail={l.detail} color="amber" />
            ))}
          </Section>

          {/* Adjustments — with feedback */}
          <Section title="3 Protocol Adjustments" emoji="🎯" color="violet">
            {(report.adjustments || []).map((a, i) => {
              const fb = feedback[`${report.id}-${i}`]
              return (
                <Card key={i} className="border-violet-400/30 bg-violet-500/5">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="border-violet-400/30 text-violet-300 text-[9px] mt-0.5">
                        {a.category || 'lifestyle'}
                      </Badge>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{a.title}</p>
                        <p className="text-xs text-white/60 mt-1 leading-snug">{a.detail}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 pt-1">
                      {fb ? (
                        <Badge variant="outline" className="border-white/20 text-[10px]">
                          {fb === 'accept' ? '✓ accepted' : fb === 'already_doing' ? 'already doing' : 'skipped'}
                        </Badge>
                      ) : (
                        <>
                          <button onClick={() => logFeedback(i, 'accept', a.title)} className="text-[10px] px-2 py-1 rounded bg-green-500/20 text-green-300 hover:bg-green-500/30">
                            <Check size={10} className="inline" /> Accept
                          </button>
                          <button onClick={() => logFeedback(i, 'already_doing', a.title)} className="text-[10px] px-2 py-1 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30">
                            <ThumbsUp size={10} className="inline" /> Already doing
                          </button>
                          <button onClick={() => logFeedback(i, 'skip', a.title)} className="text-[10px] px-2 py-1 rounded bg-white/5 text-white/50 hover:bg-white/10">
                            <X size={10} className="inline" /> Skip
                          </button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </Section>

          {/* Bloodwork due */}
          {report.bloodwork_due && report.bloodwork_due.length > 0 && (
            <Section title="Bloodwork Due" emoji="🩸" color="rose">
              {report.bloodwork_due.map((b, i) => (
                <Card key={i} className="border-rose-400/30 bg-rose-500/5">
                  <CardContent className="p-3">
                    <p className="text-sm font-medium">{b.panel}</p>
                    <p className="text-xs text-white/60 mt-1">{b.reason}</p>
                    <p className="text-[10px] text-rose-300 mt-1">⏱ {b.suggested_timeframe}</p>
                  </CardContent>
                </Card>
              ))}
            </Section>
          )}

          {/* Experiment */}
          {report.experiment && (
            <Section title="Experiment" emoji="🧪" color="cyan">
              <Card className="border-cyan-400/30 bg-cyan-500/5">
                <CardContent className="p-3 space-y-1">
                  <p className="text-sm font-bold flex items-center gap-1.5">
                    <Beaker size={14} className="text-cyan-300" /> {report.experiment.title}
                  </p>
                  <p className="text-xs text-white/60">Hypothesis: {report.experiment.hypothesis}</p>
                  <p className="text-xs text-white/60">Protocol: {report.experiment.protocol}</p>
                  <Badge variant="outline" className="border-cyan-400/30 text-cyan-300 text-[10px] mt-1">
                    {report.experiment.duration_days} days
                  </Badge>
                </CardContent>
              </Card>
            </Section>
          )}

          <Disclaimer />

          {history.length > 1 && (
            <div className="pt-4 border-t border-white/10">
              <p className="text-xs uppercase tracking-wider text-white/40 mb-2">Previous reviews</p>
              <div className="space-y-1">
                {history.slice(1, 5).map(h => (
                  <button
                    key={h.id}
                    onClick={() => { setReport(h); setFeedback({}) }}
                    className="block w-full text-left text-xs text-white/60 hover:text-white/90 p-2 rounded bg-white/5 hover:bg-white/10"
                  >
                    {new Date(h.ts).toLocaleDateString()} · {h.model_used} · {(h.wins?.length || 0) + (h.leaks?.length || 0) + (h.adjustments?.length || 0)} items
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-6 text-center">
            <Brain className="text-white/20 mx-auto mb-3" size={32} />
            <p className="text-sm text-white/60">No reviews yet.</p>
            <p className="text-xs text-white/40 mt-1">Tap "Run review" to analyze your last 7 days.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Section({ title, emoji, children, color }: { title: string; emoji: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={`text-xs uppercase tracking-wider mb-2 text-${color}-300/80`}>{emoji} {title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function ItemCard({ title, detail, color }: { title: string; detail: string; color: 'green' | 'amber' | 'violet' }) {
  const styles = {
    green: 'border-green-400/30 bg-green-500/5',
    amber: 'border-amber-400/30 bg-amber-500/5',
    violet: 'border-violet-400/30 bg-violet-500/5',
  }[color]
  return (
    <Card className={`border ${styles}`}>
      <CardContent className="p-3">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-white/60 mt-1 leading-snug">{detail}</p>
      </CardContent>
    </Card>
  )
}

'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Lock, Loader2, AlertCircle, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase, getCurrentUserId } from '@/lib/supabase'

type PhysiqueAnalysis = {
  estimated_bf_percent: number
  muscle_development: {
    chest: number; back: number; shoulders: number; arms: number
    quads: number; hams: number; glutes: number; calves: number; abs: number
  }
  symmetry_issues: string[]
  posture_flags: string[]
  top_3_weak_points: string[]
  suggested_focus_next_30_days: string
  overall_condition: string
  notes?: string
}

const muscleLabels: Record<string, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', arms: 'Arms',
  quads: 'Quads', hams: 'Hamstrings', glutes: 'Glutes', calves: 'Calves', abs: 'Abs',
}

function MuscleBar({ muscle, score }: { muscle: string; score: number }) {
  const color = score >= 8 ? 'bg-green-400' : score >= 6 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <span className="text-white/50 text-xs w-20 flex-shrink-0">{muscleLabels[muscle]}</span>
      <div className="flex-1 bg-white/10 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color} transition-all`} style={{ width: `${score * 10}%` }} />
      </div>
      <span className="text-white/60 text-xs w-4">{score}</span>
    </div>
  )
}

export default function ProgressPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<PhysiqueAnalysis | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string
      setAnalysis(null)
      setSaved(false)
      setError(null)
      setLoading(true)

      try {
        const userId = await getCurrentUserId()
        if (!userId) {
          router.push('/login?redirect=/progress')
          return
        }
        const base64 = dataUrl.split(',')[1]
        const mediaType = dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg'

        // PRIVACY: Photo is sent to AI for analysis and not persisted.
        const res = await fetch('/api/analyze-physique', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, mediaType }),
        })
        const data = await res.json()
        if (!res.ok || data.error) throw new Error(data.error || 'Analysis failed')
        setAnalysis(data)

        // Save ONLY the text analysis to Supabase, not the image
        const { error: insErr } = await supabase.from('physique_snapshots').insert({
          ts: new Date().toISOString(),
          image_storage_path: null,
          analysis_json: data,
          bf_percent_estimate: data.estimated_bf_percent,
          user_id: userId,
        })
        if (insErr) throw new Error(insErr.message)
        setSaved(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Analysis failed')
      } finally {
        setLoading(false)
        // PRIVACY: Image reference cleared, not stored
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="px-4 pt-6 space-y-4">
      {/* Privacy badge — prominent */}
      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
        <Lock size={14} className="text-green-400 flex-shrink-0" />
        <p className="text-green-300 text-xs">
          <strong>Private — your eyes only.</strong> Photos are sent to AI for analysis and immediately discarded. Zero image persistence.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Physique Check</h1>
        <Badge variant="outline" className="border-rose-400/30 text-rose-400 text-xs">AI Vision</Badge>
      </div>

      {/* Upload */}
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full py-10 rounded-2xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-3 bg-white/5 active:bg-white/10 transition-colors"
      >
        <Camera size={40} className="text-white/30" />
        <p className="text-white/40 text-sm text-center px-4">Upload front, side, or back photo<br />— deleted immediately after analysis</p>
      </button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleCapture} className="hidden" />

      {loading && (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="py-6 flex items-center justify-center gap-3">
            <Loader2 size={20} className="animate-spin text-rose-400" />
            <p className="text-white/60">AI analyzing… photo will be discarded</p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-400/20 bg-red-400/5">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertCircle size={16} className="text-red-400" />
            <p className="text-red-300 text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {analysis && (
        <div className="space-y-4">
          {/* BF% Hero */}
          <Card className="border-rose-400/20 bg-rose-400/5">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/50 text-xs uppercase tracking-wider">Est. Body Fat</p>
                  <p className="text-3xl font-bold text-rose-400">{analysis.estimated_bf_percent}%</p>
                  <p className="text-white/40 text-xs mt-0.5 capitalize">{analysis.overall_condition}</p>
                </div>
                <TrendingUp size={32} className="text-rose-400/30" />
              </div>
            </CardContent>
          </Card>

          {/* Muscle Dev */}
          <Card className="border-white/10 bg-white/5">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm text-white/70">Muscle Development</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              {Object.entries(analysis.muscle_development).map(([muscle, score]) => (
                <MuscleBar key={muscle} muscle={muscle} score={score} />
              ))}
            </CardContent>
          </Card>

          {/* Weak Points */}
          <Card className="border-amber-400/20 bg-amber-400/5">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm text-amber-400">Top 3 Weak Points</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 pb-4">
              {analysis.top_3_weak_points.map((point, i) => (
                <p key={i} className="text-white/70 text-sm">• {point}</p>
              ))}
            </CardContent>
          </Card>

          {/* 30-Day Plan */}
          <Card className="border-cyan-400/20 bg-cyan-400/5">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm text-cyan-400">30-Day Focus</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <p className="text-white/70 text-sm">{analysis.suggested_focus_next_30_days}</p>
            </CardContent>
          </Card>

          {/* Issues */}
          {(analysis.symmetry_issues.length > 0 || analysis.posture_flags.length > 0) && (
            <Card className="border-white/10 bg-white/5">
              <CardContent className="py-4 space-y-3">
                {analysis.symmetry_issues.length > 0 && (
                  <div>
                    <p className="text-white/40 text-xs mb-1">Symmetry Notes</p>
                    {analysis.symmetry_issues.map((s, i) => <p key={i} className="text-white/60 text-xs">• {s}</p>)}
                  </div>
                )}
                {analysis.posture_flags.length > 0 && (
                  <div>
                    <p className="text-white/40 text-xs mb-1">Posture Flags</p>
                    {analysis.posture_flags.map((s, i) => <p key={i} className="text-white/60 text-xs">• {s}</p>)}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {saved && (
            <p className="text-center text-green-400/60 text-xs">Analysis saved. Photo not retained. ✓</p>
          )}
        </div>
      )}
    </div>
  )
}

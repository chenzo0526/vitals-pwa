'use client'

import { useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Lock, Loader2, AlertCircle, TrendingUp, Check, X, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { supabase, getCurrentUserId } from '@/lib/supabase'
import { compressImage } from '@/lib/images'

type PhysiqueAnalysis = {
  estimated_bf_percent: number
  bf_confidence?: 'high' | 'medium' | 'low'
  angles_analyzed?: Array<'front' | 'side' | 'back'>
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

type Angle = 'front' | 'side' | 'back'

type SlotState = {
  base64: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
  previewUrl: string
}

const ANGLE_ORDER: Angle[] = ['front', 'side', 'back']
const ANGLE_LABEL: Record<Angle, string> = {
  front: 'Front',
  side: 'Side',
  back: 'Back',
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

function PhotoSlot({
  angle,
  state,
  onPick,
  onClear,
  disabled,
}: {
  angle: Angle
  state: SlotState | null
  onPick: () => void
  onClear: () => void
  disabled: boolean
}) {
  const filled = !!state
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] uppercase tracking-wider text-white/40 text-center">{ANGLE_LABEL[angle]}</p>
      {filled ? (
        <div className="relative aspect-[3/4] rounded-xl overflow-hidden border border-amber-400/40 bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={state!.previewUrl} alt={`${angle} preview`} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute top-1.5 right-1.5">
            <button
              onClick={onClear}
              disabled={disabled}
              className="w-7 h-7 rounded-full bg-black/70 backdrop-blur border border-white/20 flex items-center justify-center text-white/80 hover:text-white disabled:opacity-40"
              aria-label={`Remove ${angle} photo`}
            >
              <X size={14} />
            </button>
          </div>
          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-400/90 text-black text-[10px] font-bold">
            <Check size={10} strokeWidth={3} /> {ANGLE_LABEL[angle]}
          </div>
        </div>
      ) : (
        <button
          onClick={onPick}
          disabled={disabled}
          className="w-full aspect-[3/4] rounded-xl border-2 border-dashed border-white/15 bg-white/5 active:bg-white/10 flex flex-col items-center justify-center gap-1.5 disabled:opacity-40"
        >
          <Camera size={22} className="text-white/40" />
          <span className="text-[11px] text-white/50">Add {ANGLE_LABEL[angle].toLowerCase()}</span>
        </button>
      )}
    </div>
  )
}

export default function ProgressPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<PhysiqueAnalysis | null>(null)
  const [slots, setSlots] = useState<Record<Angle, SlotState | null>>({
    front: null,
    side: null,
    back: null,
  })

  // One hidden input per angle. We trigger it imperatively to capture for the right slot.
  const inputs = {
    front: useRef<HTMLInputElement>(null),
    side: useRef<HTMLInputElement>(null),
    back: useRef<HTMLInputElement>(null),
  }
  const pendingAngleRef = useRef<Angle>('front')

  const filledAngles = useMemo(
    () => ANGLE_ORDER.filter(a => slots[a] !== null),
    [slots],
  )
  const filledCount = filledAngles.length
  const canAnalyze = filledCount >= 1 && !loading

  function pickFor(angle: Angle) {
    pendingAngleRef.current = angle
    inputs[angle].current?.click()
  }

  function clearSlot(angle: Angle) {
    setSlots((prev) => {
      if (prev[angle]) URL.revokeObjectURL(prev[angle]!.previewUrl)
      return { ...prev, [angle]: null }
    })
    // Also clear the file input so picking the same file twice re-fires onChange.
    if (inputs[angle].current) inputs[angle].current!.value = ''
    setAnalysis(null)
    setSaved(false)
    setError(null)
  }

  async function handlePick(angle: Angle, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setAnalysis(null)
    setSaved(false)
    try {
      const compressed = await compressImage(file, { maxEdge: 1024, quality: 0.82 })
      const previewUrl = URL.createObjectURL(file)
      setSlots((prev) => {
        if (prev[angle]) URL.revokeObjectURL(prev[angle]!.previewUrl)
        return {
          ...prev,
          [angle]: {
            base64: compressed.base64,
            mediaType: compressed.mediaType,
            previewUrl,
          },
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load photo')
    }
  }

  async function runAnalysis() {
    if (!canAnalyze) return
    setLoading(true)
    setError(null)
    setAnalysis(null)
    setSaved(false)
    try {
      const userId = await getCurrentUserId()
      if (!userId) {
        router.push('/login?redirect=/progress')
        return
      }
      const payload = {
        images: filledAngles.map(a => ({
          angle: a,
          image: slots[a]!.base64,
          mediaType: slots[a]!.mediaType,
        })),
      }
      const res = await fetch('/api/analyze-physique', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Analysis failed')
      setAnalysis(data)

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
    }
  }

  function startOver() {
    ANGLE_ORDER.forEach((a) => {
      if (slots[a]) URL.revokeObjectURL(slots[a]!.previewUrl)
      if (inputs[a].current) inputs[a].current!.value = ''
    })
    setSlots({ front: null, side: null, back: null })
    setAnalysis(null)
    setSaved(false)
    setError(null)
  }

  return (
    <div className="px-4 pt-6 pb-8 space-y-4">
      {/* Privacy badge */}
      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
        <Lock size={14} className="text-green-400 flex-shrink-0" />
        <p className="text-green-300 text-xs">
          <strong>Private — your eyes only.</strong> Photos are sent to AI for analysis and immediately discarded. Zero image persistence.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Body Check</h1>
        <Badge variant="outline" className="border-rose-400/30 text-rose-400 text-xs">AI Vision</Badge>
      </div>

      <p className="text-xs text-white/55 leading-relaxed">
        Add up to 3 angles for the most accurate read. More angles = better calibration. Tap any slot to capture.
      </p>

      {/* 3 photo slots */}
      <div className="grid grid-cols-3 gap-2">
        {ANGLE_ORDER.map((a) => (
          <PhotoSlot
            key={a}
            angle={a}
            state={slots[a]}
            onPick={() => pickFor(a)}
            onClear={() => clearSlot(a)}
            disabled={loading}
          />
        ))}
      </div>

      {/* Hidden inputs — one per angle, each tagged with capture so iOS opens camera */}
      {ANGLE_ORDER.map((a) => (
        <input
          key={a}
          ref={inputs[a]}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => handlePick(a, e)}
          className="hidden"
        />
      ))}

      {/* Analyze CTA */}
      <Button
        onClick={runAnalysis}
        disabled={!canAnalyze}
        className="w-full h-12 bg-amber-400 text-black font-bold hover:bg-amber-300 disabled:opacity-40"
      >
        {loading ? (
          <><Loader2 size={16} className="mr-2 animate-spin" /> Analyzing {filledCount} angle{filledCount === 1 ? '' : 's'}…</>
        ) : analysis ? (
          <><Sparkles size={16} className="mr-2" /> Re-analyze ({filledCount} angle{filledCount === 1 ? '' : 's'})</>
        ) : filledCount === 0 ? (
          'Add at least one photo'
        ) : (
          <><Sparkles size={16} className="mr-2" /> Analyze ({filledCount} angle{filledCount === 1 ? '' : 's'})</>
        )}
      </Button>

      {filledCount > 0 && !loading && (
        <button
          onClick={startOver}
          className="w-full text-center text-xs text-white/40 hover:text-white/70"
        >
          Clear all photos
        </button>
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
        <div className="space-y-4 pt-2">
          {/* BF% Hero */}
          <Card className="border-rose-400/20 bg-rose-400/5">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/50 text-xs uppercase tracking-wider">Est. Body Fat</p>
                  <p className="text-3xl font-bold text-rose-400">{analysis.estimated_bf_percent}%</p>
                  <p className="text-white/40 text-xs mt-0.5 capitalize">
                    {analysis.overall_condition}
                    {analysis.bf_confidence && (
                      <> · <span className="text-white/60">{analysis.bf_confidence} confidence</span></>
                    )}
                  </p>
                  {analysis.angles_analyzed && analysis.angles_analyzed.length > 0 && (
                    <p className="text-white/30 text-[10px] uppercase tracking-wider mt-1">
                      Calibrated from {analysis.angles_analyzed.join(' + ')}
                    </p>
                  )}
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
            <p className="text-center text-green-400/60 text-xs">Analysis saved. Photos not retained. ✓</p>
          )}
        </div>
      )}
    </div>
  )
}

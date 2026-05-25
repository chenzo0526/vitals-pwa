'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ChevronLeft, Camera, ImagePlus, Loader2, AlertCircle, RotateCcw, Check, AlertTriangle, Ban } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { compressImage } from '@/lib/images'

type Ingredient = { name: string; rating: 'good' | 'neutral' | 'bad'; note: string }
type Flag = { label: string; severity: 'info' | 'watch' | 'avoid'; why: string }
type CleanResult = {
  product_name: string
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  score: number
  summary: string
  ingredients: Ingredient[]
  flags: Flag[]
  better_swaps?: string[]
}

const GRADE_COLOR: Record<string, string> = {
  A: 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10',
  B: 'text-lime-300 border-lime-400/40 bg-lime-500/10',
  C: 'text-amber-300 border-amber-400/40 bg-amber-500/10',
  D: 'text-orange-300 border-orange-400/40 bg-orange-500/10',
  F: 'text-rose-300 border-rose-400/40 bg-rose-500/10',
}

export default function CleanFoodPage() {
  const [imageData, setImageData] = useState<string | null>(null)
  const [stage, setStage] = useState<'idle' | 'analyzing' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<CleanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError(null)
    setResult(null)
    setStage('analyzing')
    try {
      const c = await compressImage(file, { maxEdge: 1024, quality: 0.8 })
      setImageData(`data:${c.mediaType};base64,${c.base64}`)
      const res = await fetch('/api/analyze-clean', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: c.base64, mediaType: c.mediaType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      setResult(data as CleanResult)
      setStage('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
      setStage('error')
    }
  }

  function reset() {
    setImageData(null); setResult(null); setError(null); setStage('idle')
  }

  return (
    <div className="px-4 pt-6 pb-12 space-y-4">
      <Link href="/" className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1">
        <ChevronLeft size={12} /> Home
      </Link>
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">Food Check</h1>
        <p className="text-[11px] text-white/45 mt-0.5">Snap a label or plate — get a clean/dirty read on what&apos;s in it.</p>
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

      {stage === 'idle' && (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => cameraRef.current?.click()} className="flex flex-col items-center gap-2 p-6 rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] text-amber-200 active:scale-95 transition">
            <Camera size={26} /> <span className="text-sm font-semibold">Take photo</span>
          </button>
          <button onClick={() => libraryRef.current?.click()} className="flex flex-col items-center gap-2 p-6 rounded-2xl border border-white/10 bg-white/5 text-white/70 active:scale-95 transition">
            <ImagePlus size={26} /> <span className="text-sm font-semibold">From library</span>
          </button>
        </div>
      )}

      {imageData && (
        <div className="rounded-xl overflow-hidden border border-white/10 max-h-48 flex items-center justify-center bg-black/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageData} alt="food" className="max-h-48 object-contain" />
        </div>
      )}

      {stage === 'analyzing' && (
        <div className="flex items-center justify-center gap-2 py-8 text-white/60">
          <Loader2 size={18} className="animate-spin text-amber-400" /> Reading ingredients…
        </div>
      )}

      {stage === 'error' && error && (
        <div className="flex items-center gap-2 text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-md p-3 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <Card className={`border ${GRADE_COLOR[result.grade] || GRADE_COLOR.C}`}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center text-3xl font-black ${GRADE_COLOR[result.grade] || GRADE_COLOR.C}`}>
                {result.grade}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white leading-tight">{result.product_name}</p>
                <p className="text-[11px] text-white/60 mt-0.5 leading-snug">{result.summary}</p>
                <p className="text-[10px] text-white/40 mt-1 tabular-nums">Cleanliness score: {result.score}/100</p>
              </div>
            </CardContent>
          </Card>

          {result.flags?.length > 0 && (
            <div className="space-y-1.5">
              {result.flags.map((f, i) => (
                <div key={i} className={`flex items-start gap-2 rounded-lg border p-2.5 ${
                  f.severity === 'avoid' ? 'border-rose-400/30 bg-rose-500/[0.07]' : f.severity === 'watch' ? 'border-amber-400/30 bg-amber-500/[0.06]' : 'border-white/10 bg-white/[0.03]'
                }`}>
                  {f.severity === 'avoid' ? <Ban size={14} className="text-rose-300 mt-0.5 flex-shrink-0" /> : f.severity === 'watch' ? <AlertTriangle size={14} className="text-amber-300 mt-0.5 flex-shrink-0" /> : <Check size={14} className="text-white/40 mt-0.5 flex-shrink-0" />}
                  <div>
                    <p className="text-xs font-semibold text-white">{f.label}</p>
                    <p className="text-[11px] text-white/55 leading-snug">{f.why}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {result.ingredients?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-1.5">Ingredients</p>
              <div className="space-y-1">
                {result.ingredients.map((ing, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-md bg-white/[0.03] border border-white/10 px-2.5 py-1.5">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ing.rating === 'good' ? 'bg-emerald-400' : ing.rating === 'bad' ? 'bg-rose-400' : 'bg-white/30'}`} />
                    <span className="text-xs text-white/85 flex-1 min-w-0">{ing.name}</span>
                    {ing.note && <span className="text-[10px] text-white/40 truncate max-w-[45%]">{ing.note}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.better_swaps && result.better_swaps.length > 0 && (
            <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/[0.06] p-3">
              <p className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold mb-1">Cleaner swaps</p>
              <ul className="text-xs text-white/75 space-y-0.5 list-disc list-inside">
                {result.better_swaps.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}

          <button onClick={reset} className="w-full py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/70 text-xs uppercase tracking-wider font-bold hover:bg-white/10 flex items-center justify-center gap-1.5">
            <RotateCcw size={12} /> Check another
          </button>
          <p className="text-[9px] text-white/30 text-center">Information, not medical advice. Ingredient reads can be imperfect — verify the label for allergens.</p>
        </motion.div>
      )}
    </div>
  )
}

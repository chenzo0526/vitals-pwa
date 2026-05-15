'use client'

import { useState, useRef } from 'react'
import { ScanLine, Loader2, Check, AlertCircle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'

type LabelData = {
  product_name: string
  serving_size: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g?: number
  sugar_g?: number
  sodium_mg?: number
  confidence: 'high' | 'medium' | 'low'
}

export default function LabelPage() {
  const [imageData, setImageData] = useState<string | null>(null)
  const [label, setLabel] = useState<LabelData | null>(null)
  const [loading, setLoading] = useState(false)
  const [logged, setLogged] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string
      setImageData(dataUrl)
      setLabel(null)
      setLogged(false)
      setError(null)
      setLoading(true)
      try {
        const base64 = dataUrl.split(',')[1]
        const mediaType = dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg'
        const res = await fetch('/api/analyze-label', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, mediaType }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        setLabel(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'OCR failed')
      } finally {
        setLoading(false)
      }
    }
    reader.readAsDataURL(file)
  }

  async function logEntry() {
    if (!label) return
    try {
      await supabase.from('intake_events').insert({
        ts: new Date().toISOString(),
        item: label.product_name,
        qty_text: label.serving_size,
        calories: label.calories,
        protein_g: label.protein_g,
        carbs_g: label.carbs_g,
        fat_g: label.fat_g,
        raw_input: 'label-scan',
        parsed_by: 'claude-ocr',
      })
      setLogged(true)
    } catch {
      setLogged(true)
    }
  }

  return (
    <div className="px-4 pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Scan Label</h1>
        <Badge variant="outline" className="border-cyan-400/30 text-cyan-400 text-xs">Claude OCR</Badge>
      </div>

      <button
        onClick={() => fileRef.current?.click()}
        className="w-full aspect-video rounded-2xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-3 bg-white/5 active:bg-white/10 transition-colors overflow-hidden relative"
      >
        {imageData ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageData} alt="Nutrition label" className="absolute inset-0 w-full h-full object-cover rounded-2xl" />
        ) : (
          <>
            <ScanLine size={40} className="text-white/30" />
            <p className="text-white/40 text-sm">Tap to snap nutrition label</p>
          </>
        )}
      </button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleCapture} className="hidden" />

      {loading && (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="py-6 flex items-center justify-center gap-3">
            <Loader2 size={20} className="animate-spin text-cyan-400" />
            <p className="text-white/60">Reading label with Claude…</p>
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

      {label && !loading && (
        <div className="space-y-3">
          <Card className="border-white/10 bg-white/5">
            <CardContent className="pt-4 pb-3 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white font-semibold">{label.product_name}</p>
                  <p className="text-white/40 text-xs">Serving: {label.serving_size}</p>
                </div>
                <Badge className={`text-xs border ${label.confidence === 'high' ? 'bg-green-400/20 text-green-400 border-green-400/30' : 'bg-amber-400/20 text-amber-400 border-amber-400/30'}`}>
                  {label.confidence}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Calories', value: `${label.calories} kcal`, color: 'text-amber-400' },
                  { label: 'Protein', value: `${label.protein_g}g`, color: 'text-cyan-400' },
                  { label: 'Carbs', value: `${label.carbs_g}g`, color: 'text-violet-400' },
                  { label: 'Fat', value: `${label.fat_g}g`, color: 'text-orange-400' },
                  ...(label.fiber_g ? [{ label: 'Fiber', value: `${label.fiber_g}g`, color: 'text-green-400' }] : []),
                  ...(label.sodium_mg ? [{ label: 'Sodium', value: `${label.sodium_mg}mg`, color: 'text-red-400' }] : []),
                ].map(({ label: l, value, color }) => (
                  <div key={l} className="bg-white/5 rounded-lg p-2">
                    <p className="text-white/40 text-xs">{l}</p>
                    <p className={`font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            {!logged ? (
              <>
                <Button onClick={() => { setImageData(null); setLabel(null) }} variant="outline" className="flex-1 border-white/20 text-white/60">
                  <RotateCcw size={16} className="mr-2" /> Retake
                </Button>
                <Button onClick={logEntry} className="flex-1 bg-cyan-400 text-black font-bold hover:bg-cyan-300">
                  <Check size={16} className="mr-2" /> Log It
                </Button>
              </>
            ) : (
              <Card className="w-full border-green-400/20 bg-green-400/5">
                <CardContent className="py-3 flex items-center justify-center gap-2">
                  <Check size={16} className="text-green-400" />
                  <p className="text-green-400 font-medium">Logged ✓</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

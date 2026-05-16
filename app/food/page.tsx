'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, ImagePlus, RotateCcw, Check, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase, getCurrentUserId } from '@/lib/supabase'
import { Toast, ToastMsg } from '@/components/Toast'

type MacroItem = {
  name: string
  qty_estimate: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

type Analysis = {
  items: MacroItem[]
  total_macros: { calories: number; protein_g: number; carbs_g: number; fat_g: number }
  confidence: 'high' | 'medium' | 'low'
  notes?: string
}

export default function FoodPage() {
  const router = useRouter()
  const [imageData, setImageData] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [logging, setLogging] = useState(false)
  const [logged, setLogged] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastMsg | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)

  async function handleImage(file: File) {
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string
      setImageData(dataUrl)
      setAnalysis(null)
      setLogged(false)
      setError(null)
      await analyzeImage(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  function onCameraChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleImage(file)
    e.target.value = ''
  }

  function onLibraryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleImage(file)
    e.target.value = ''
  }

  async function analyzeImage(dataUrl: string) {
    setLoading(true)
    try {
      const base64 = dataUrl.split(',')[1]
      const mediaType = dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg'
      const res = await fetch('/api/analyze-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Analysis failed')
      setAnalysis(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  async function logEntry() {
    if (!analysis) return
    setLogging(true)
    setError(null)
    try {
      const userId = await getCurrentUserId()
      if (!userId) {
        router.push('/login?redirect=/food')
        return
      }
      const items = analysis.items.map((item) => item.name).join(', ')
      const { error: insertErr } = await supabase.from('intake_events').insert({
        ts: new Date().toISOString(),
        item: items,
        qty_text: analysis.items.map((i) => `${i.qty_estimate} ${i.name}`).join(', '),
        calories: analysis.total_macros.calories,
        protein_g: analysis.total_macros.protein_g,
        carbs_g: analysis.total_macros.carbs_g,
        fat_g: analysis.total_macros.fat_g,
        raw_input: 'camera',
        parsed_by: 'food-vision',
        user_id: userId,
      })
      if (insertErr) throw new Error(insertErr.message)
      setLogged(true)
      setToast({ id: Date.now(), kind: 'success', text: 'Logged to today' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save log'
      setError(msg)
      setToast({ id: Date.now(), kind: 'error', text: msg })
    } finally {
      setLogging(false)
    }
  }

  const confidenceColor = {
    high: 'bg-green-400/20 text-green-400 border-green-400/30',
    medium: 'bg-amber-400/20 text-amber-400 border-amber-400/30',
    low: 'bg-red-400/20 text-red-400 border-red-400/30',
  }

  return (
    <div className="px-4 pt-6 space-y-4">
      <Toast msg={toast} onDismiss={() => setToast(null)} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Snap Plate</h1>
        <Badge variant="outline" className="border-amber-400/30 text-amber-400 text-xs">AI Vision</Badge>
      </div>

      {/* Source buttons */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={() => cameraRef.current?.click()}
          className="bg-amber-400/10 border border-amber-400/30 text-amber-300 hover:bg-amber-400/20 h-12"
        >
          <Camera size={18} className="mr-2" /> Take photo
        </Button>
        <Button
          onClick={() => libraryRef.current?.click()}
          className="bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/20 h-12"
        >
          <ImagePlus size={18} className="mr-2" /> Upload from library
        </Button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onCameraChange} className="hidden" />
      <input ref={libraryRef} type="file" accept="image/*" onChange={onLibraryChange} className="hidden" />

      {/* Preview */}
      {imageData && (
        <div className="w-full aspect-video rounded-2xl overflow-hidden relative bg-white/5 border border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageData} alt="Captured plate" className="absolute inset-0 w-full h-full object-cover" />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="py-6 flex items-center justify-center gap-3">
            <Loader2 size={20} className="animate-spin text-amber-400" />
            <p className="text-white/60">Analyzing plate with AI…</p>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && !loading && (
        <Card className="border-red-400/20 bg-red-400/5">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
            <p className="text-red-300 text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Analysis Results */}
      {analysis && !loading && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-white/50 text-sm">Identified Items</p>
            <Badge className={`text-xs border ${confidenceColor[analysis.confidence]}`}>
              {analysis.confidence} confidence
            </Badge>
          </div>

          {analysis.items.map((item, i) => (
            <Card key={i} className="border-white/10 bg-white/5">
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white font-medium text-sm">{item.name}</p>
                    <p className="text-white/40 text-xs">{item.qty_estimate}</p>
                  </div>
                  <p className="text-amber-400 font-bold">{item.calories}</p>
                </div>
                <div className="flex gap-3 mt-2">
                  <span className="text-cyan-400 text-xs">P {item.protein_g}g</span>
                  <span className="text-violet-400 text-xs">C {item.carbs_g}g</span>
                  <span className="text-orange-400 text-xs">F {item.fat_g}g</span>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Totals */}
          <Card className="border-amber-400/20 bg-amber-400/5">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between">
                <p className="text-amber-400 font-bold">TOTAL</p>
                <p className="text-amber-400 font-bold text-lg">{analysis.total_macros.calories} kcal</p>
              </div>
              <div className="flex gap-4 mt-1">
                <span className="text-cyan-400 text-sm">P {analysis.total_macros.protein_g}g</span>
                <span className="text-violet-400 text-sm">C {analysis.total_macros.carbs_g}g</span>
                <span className="text-orange-400 text-sm">F {analysis.total_macros.fat_g}g</span>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          {!logged ? (
            <div className="flex gap-2">
              <Button
                onClick={() => { setImageData(null); setAnalysis(null) }}
                variant="outline"
                className="flex-1 border-white/20 text-white/60"
              >
                <RotateCcw size={16} className="mr-2" /> Retake
              </Button>
              <Button
                onClick={logEntry}
                disabled={logging}
                className="flex-1 bg-amber-400 text-black font-bold hover:bg-amber-300"
              >
                {logging ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Check size={16} className="mr-2" />}
                Log It
              </Button>
            </div>
          ) : (
            <Card className="w-full border-green-400/20 bg-green-400/5">
              <CardContent className="py-3 flex items-center justify-center gap-2">
                <Check size={16} className="text-green-400" />
                <p className="text-green-400 font-medium">Logged ✓</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

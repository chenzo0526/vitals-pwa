'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Camera, ImagePlus, RotateCcw, Check, Loader2, AlertCircle, Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase, getCurrentUserId } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { compressImage, formatBytes } from '@/lib/images'
import { celebrateConfetti } from '@/lib/confetti'

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
  const { toast } = useToast()
  const [imageData, setImageData] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [stage, setStage] = useState<'idle' | 'compressing' | 'analyzing' | 'done' | 'error'>('idle')
  const [logging, setLogging] = useState(false)
  const [logged, setLogged] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [compressedInfo, setCompressedInfo] = useState<string | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)

  function recompute(items: MacroItem[]) {
    return items.reduce(
      (acc, i) => ({
        calories: acc.calories + (i.calories || 0),
        protein_g: acc.protein_g + (i.protein_g || 0),
        carbs_g: acc.carbs_g + (i.carbs_g || 0),
        fat_g: acc.fat_g + (i.fat_g || 0),
      }),
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    )
  }

  async function handleImage(file: File) {
    setLogged(false)
    setAnalysis(null)
    setError(null)
    setCompressedInfo(null)

    // Show a preview asap from the raw file
    const reader = new FileReader()
    reader.onload = (ev) => setImageData(ev.target?.result as string)
    reader.readAsDataURL(file)

    setStage('compressing')
    try {
      const compressed = await compressImage(file, { maxEdge: 1024, quality: 0.8 })
      setCompressedInfo(`${compressed.width}×${compressed.height} · ${formatBytes(compressed.bytes)}`)
      setStage('analyzing')
      const res = await fetch('/api/analyze-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: compressed.base64, mediaType: compressed.mediaType }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Analysis failed')
      setAnalysis(data)
      setStage('done')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed'
      setError(msg)
      setStage('error')
    }
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

  async function doInsert(a: Analysis) {
    const userId = await getCurrentUserId()
    if (!userId) {
      router.push('/login?redirect=/food')
      throw new Error('Not signed in')
    }
    const totals = a.total_macros || recompute(a.items)
    const { error: insertErr } = await supabase.from('intake_events').insert({
      ts: new Date().toISOString(),
      item: a.items.map((i) => i.name).join(', '),
      qty_text: a.items.map((i) => `${i.qty_estimate} ${i.name}`).join(', '),
      calories: totals.calories,
      protein_g: totals.protein_g,
      carbs_g: totals.carbs_g,
      fat_g: totals.fat_g,
      raw_input: 'food-vision',
      parsed_by: 'food-vision',
      user_id: userId,
    })
    if (insertErr) throw new Error(insertErr.message)
  }

  async function logEntry() {
    if (!analysis) return
    setLogging(true)
    setError(null)
    try {
      await doInsert(analysis)
      setLogged(true)
      celebrateConfetti()
      toast({ kind: 'success', title: 'Logged', text: 'Added to today.' })
      setTimeout(() => router.push('/'), 1100)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save log'
      setError(msg)
      toast({
        kind: 'error',
        title: 'Save failed',
        text: msg,
        onRetry: () => doInsert(analysis).then(() => {
          setLogged(true)
          celebrateConfetti()
          toast({ kind: 'success', title: 'Logged', text: 'Added to today.' })
          setTimeout(() => router.push('/'), 1100)
        }),
      })
    } finally {
      setLogging(false)
    }
  }

  function patchItem(i: number, patch: Partial<MacroItem>) {
    if (!analysis) return
    const items = analysis.items.map((it, idx) => idx === i ? { ...it, ...patch } : it)
    setAnalysis({ ...analysis, items, total_macros: recompute(items) })
  }

  const confidenceColor = {
    high: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
    medium: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
    low: 'bg-rose-500/15 text-rose-300 border-rose-400/30',
  } as const

  const stageLabel = {
    idle: '',
    compressing: 'Optimizing image…',
    analyzing: 'Analyzing plate with AI…',
    done: '',
    error: '',
  }[stage]

  return (
    <div className="px-4 pt-6 pb-32 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-white">Snap Plate</h1>
        <Badge variant="outline" className="border-amber-400/30 text-amber-400 text-xs">AI Vision</Badge>
      </div>

      {/* Source buttons */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={() => cameraRef.current?.click()}
          className="bg-amber-400/10 border border-amber-400/30 text-amber-300 hover:bg-amber-400/20 h-12 font-semibold"
        >
          <Camera size={18} className="mr-2" /> Take photo
        </Button>
        <Button
          onClick={() => libraryRef.current?.click()}
          className="bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/20 h-12 font-semibold"
        >
          <ImagePlus size={18} className="mr-2" /> From library
        </Button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onCameraChange} className="hidden" />
      <input ref={libraryRef} type="file" accept="image/*" onChange={onLibraryChange} className="hidden" />

      {imageData && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full aspect-video rounded-2xl overflow-hidden relative bg-white/5 border border-white/10"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageData} alt="Captured plate" className="absolute inset-0 w-full h-full object-cover" />
          {compressedInfo && (
            <div className="absolute bottom-2 right-2 text-[10px] px-2 py-0.5 rounded-md bg-black/60 text-white/70 tabular-nums">
              {compressedInfo}
            </div>
          )}
        </motion.div>
      )}

      {(stage === 'compressing' || stage === 'analyzing') && (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="py-6 flex items-center justify-center gap-3">
            <Loader2 size={20} className="animate-spin text-amber-400" />
            <p className="text-white/70 text-sm">{stageLabel}</p>
          </CardContent>
        </Card>
      )}

      {error && stage === 'error' && (
        <Card className="border-rose-400/30 bg-rose-500/10">
          <CardContent className="py-3 flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-300" />
            <p className="text-rose-100 text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {analysis && stage === 'done' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-white/50 text-xs uppercase tracking-wider">Identified Items</p>
            <Badge className={`text-xs border ${confidenceColor[analysis.confidence]}`}>
              {analysis.confidence} confidence
            </Badge>
          </div>

          {analysis.items.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.2, ease: 'easeOut' }}
            >
              <Card className="border-white/10 bg-white/5">
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-base">{item.name}</p>
                      <p className="text-white/40 text-xs mt-0.5">{item.qty_estimate}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-amber-400 font-bold text-xl tabular-nums">{item.calories}</p>
                      <button
                        onClick={() => setEditing(i)}
                        className="p-1.5 rounded-md text-white/40 hover:text-white/90 hover:bg-white/10"
                        aria-label="Edit"
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-2">
                    <Chip color="cyan">P {item.protein_g}g</Chip>
                    <Chip color="violet">C {item.carbs_g}g</Chip>
                    <Chip color="orange">F {item.fat_g}g</Chip>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {/* Totals */}
          <Card className="border-amber-400/30 bg-gradient-to-br from-amber-400/10 via-amber-500/5 to-transparent">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between">
                <p className="text-amber-300 font-bold text-xs uppercase tracking-wider">Total</p>
                <p className="text-amber-300 font-bold text-2xl tabular-nums">
                  {analysis.total_macros.calories}
                  <span className="text-xs text-amber-300/60 font-normal ml-1">kcal</span>
                </p>
              </div>
              <div className="flex gap-4 mt-1">
                <span className="text-cyan-300 text-sm tabular-nums">P {analysis.total_macros.protein_g}g</span>
                <span className="text-violet-300 text-sm tabular-nums">C {analysis.total_macros.carbs_g}g</span>
                <span className="text-orange-300 text-sm tabular-nums">F {analysis.total_macros.fat_g}g</span>
              </div>
            </CardContent>
          </Card>

          {/* Sticky Log button */}
          {!logged && (
            <div className="fixed bottom-20 left-0 right-0 px-4 z-30 pointer-events-none">
              <div className="max-w-md mx-auto flex gap-2 pointer-events-auto">
                <Button
                  onClick={() => { setImageData(null); setAnalysis(null); setStage('idle'); setError(null) }}
                  variant="outline"
                  className="border-white/20 text-white/70 bg-zinc-950/70 backdrop-blur"
                >
                  <RotateCcw size={16} />
                </Button>
                <Button
                  onClick={logEntry}
                  disabled={logging}
                  className="flex-1 bg-amber-400 text-black font-semibold hover:bg-amber-300 shadow-lg shadow-amber-400/20 h-12"
                >
                  {logging ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Check size={18} className="mr-2" />}
                  Log {analysis.total_macros.calories} kcal
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {editing !== null && analysis && (
        <EditItemModal
          item={analysis.items[editing]}
          onClose={() => setEditing(null)}
          onSave={(patch) => { patchItem(editing, patch); setEditing(null) }}
        />
      )}
    </div>
  )
}

function Chip({ color, children }: { color: 'cyan' | 'violet' | 'orange' | 'amber'; children: React.ReactNode }) {
  const cls = {
    cyan: 'bg-cyan-500/10 text-cyan-300 border-cyan-400/20',
    violet: 'bg-violet-500/10 text-violet-300 border-violet-400/20',
    orange: 'bg-orange-500/10 text-orange-300 border-orange-400/20',
    amber: 'bg-amber-500/10 text-amber-300 border-amber-400/20',
  }[color]
  return <span className={`text-[11px] px-2 py-0.5 rounded-md border ${cls} tabular-nums`}>{children}</span>
}

function EditItemModal({
  item, onClose, onSave,
}: {
  item: MacroItem
  onClose: () => void
  onSave: (patch: Partial<MacroItem>) => void
}) {
  const [name, setName] = useState(item.name)
  const [qty, setQty] = useState(item.qty_estimate)
  const [cal, setCal] = useState(String(item.calories))
  const [p, setP] = useState(String(item.protein_g))
  const [c, setC] = useState(String(item.carbs_g))
  const [f, setF] = useState(String(item.fat_g))

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-end sm:items-center justify-center p-4">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
        className="w-full max-w-md"
      >
        <Card className="border-white/10 bg-zinc-950">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white">Looks wrong? Fix it.</h2>
              <button onClick={onClose}><X size={20} className="text-white/40" /></button>
            </div>
            <Field label="Item" value={name} onChange={setName} />
            <Field label="Portion" value={qty} onChange={setQty} />
            <div className="grid grid-cols-4 gap-2">
              <Field label="kcal" type="number" value={cal} onChange={setCal} />
              <Field label="P (g)" type="number" value={p} onChange={setP} />
              <Field label="C (g)" type="number" value={c} onChange={setC} />
              <Field label="F (g)" type="number" value={f} onChange={setF} />
            </div>
            <Button
              onClick={() => onSave({
                name,
                qty_estimate: qty,
                calories: Number(cal) || 0,
                protein_g: Number(p) || 0,
                carbs_g: Number(c) || 0,
                fat_g: Number(f) || 0,
              })}
              className="w-full bg-amber-400 text-black hover:bg-amber-300 font-semibold"
            >
              Save
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-[10px] text-white/50 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-amber-400/50 tabular-nums"
      />
    </div>
  )
}

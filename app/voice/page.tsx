'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, MicOff, Loader2, Check, AlertCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { supabase, getCurrentUserId } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { celebrateConfetti } from '@/lib/confetti'

type ParsedItem = {
  name: string
  quantity?: number | string
  unit?: string
  qty_estimate?: string
  estimated_calories?: number
  calories?: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

type Parsed = {
  items: ParsedItem[]
  total_macros?: { calories: number; protein_g: number; carbs_g: number; fat_g: number }
}

const SILENCE_MS = 3000

export default function VoicePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [recording, setRecording] = useState(false)
  const [transcriptFinal, setTranscriptFinal] = useState('')
  const [transcriptInterim, setTranscriptInterim] = useState('')
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [loading, setLoading] = useState(false)
  const [logging, setLogging] = useState(false)
  const [logged, setLogged] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finalRef = useRef('')

  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop() } catch {}
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    }
  }, [])

  function resetSilenceTimer() {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    silenceTimerRef.current = setTimeout(() => {
      try { recognitionRef.current?.stop() } catch {}
    }, SILENCE_MS)
  }

  function startRecording() {
    setError(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Speech recognition not supported on this device. Type your meal below.')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interim = ''
      let appended = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i]
        const text = res[0].transcript
        if (res.isFinal) {
          appended += text + ' '
        } else {
          interim += text
        }
      }
      if (appended) {
        finalRef.current = (finalRef.current + appended).replace(/\s+/g, ' ').trim() + ' '
        setTranscriptFinal(finalRef.current)
      }
      setTranscriptInterim(interim)
      resetSilenceTimer()
    }

    recognition.onerror = (e: { error?: string }) => {
      if (e?.error === 'no-speech' || e?.error === 'aborted') return
      setError('Recording failed. Try typing below.')
    }

    recognition.onend = () => {
      setRecording(false)
      setTranscriptInterim('')
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
      setRecording(true)
      resetSilenceTimer()
    } catch {
      setError('Microphone unavailable. Try typing below.')
    }
  }

  function stopRecording() {
    try { recognitionRef.current?.stop() } catch {}
    setRecording(false)
  }

  function clearAll() {
    finalRef.current = ''
    setTranscriptFinal('')
    setTranscriptInterim('')
    setParsed(null)
    setLogged(false)
    setError(null)
  }

  async function parseTranscript() {
    const text = (finalRef.current || transcriptFinal).trim()
    if (!text) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Parse failed')
      setParsed(normalizeParsed(data))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Parse failed')
    } finally {
      setLoading(false)
    }
  }

  async function doInsert(p: Parsed) {
    const userId = await getCurrentUserId()
    if (!userId) {
      router.push('/login?redirect=/voice')
      throw new Error('Not signed in')
    }
    const totals = p.total_macros || sumMacros(p.items)
    const { error: insertErr } = await supabase.from('intake_events').insert({
      ts: new Date().toISOString(),
      item: p.items.map((i) => i.name).join(', '),
      qty_text: p.items
        .map((i) => `${i.quantity || ''}${i.unit ? ' ' + i.unit : ''} ${i.name}`.trim())
        .join(', '),
      calories: totals.calories,
      protein_g: totals.protein_g,
      carbs_g: totals.carbs_g,
      fat_g: totals.fat_g,
      raw_input: (finalRef.current || transcriptFinal).trim(),
      parsed_by: 'voice-parse',
      user_id: userId,
    })
    if (insertErr) throw new Error(insertErr.message)
  }

  async function logEntry() {
    if (!parsed) return
    setLogging(true)
    setError(null)
    try {
      await doInsert(parsed)
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
        onRetry: () => doInsert(parsed).then(() => {
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

  const liveTranscript = (transcriptFinal + (transcriptInterim ? transcriptInterim : '')).trim()

  return (
    <div className="px-4 pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Log Voice</h1>
        <Badge variant="outline" className="border-violet-400/30 text-violet-400 text-xs">AI Parse</Badge>
      </div>

      {/* Record control */}
      <div className="flex flex-col items-center gap-3 py-4">
        <button
          onClick={recording ? stopRecording : startRecording}
          className={`w-24 h-24 rounded-full flex items-center justify-center transition-all active:scale-95 ${
            recording
              ? 'bg-red-500 scale-105 shadow-lg shadow-red-500/40'
              : 'bg-violet-400/20 border-2 border-violet-400/40'
          }`}
        >
          {recording ? (
            <MicOff size={36} className="text-white" />
          ) : (
            <Mic size={36} className="text-violet-400" />
          )}
        </button>
        <p className="text-white/40 text-xs text-center">
          {recording ? 'Recording… tap to stop (auto-stops after 3s silence)' : 'Tap to start recording'}
        </p>
      </div>

      {/* Live transcript */}
      {(liveTranscript || recording) && (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="py-3 px-4">
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
              {recording ? 'Listening…' : 'Transcript'}
            </p>
            <p className="text-white text-sm">
              <span>{transcriptFinal}</span>
              <span className="italic text-white/40">{transcriptInterim}</span>
              {!liveTranscript && <span className="text-white/30">—</span>}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Manual textarea fallback */}
      <div className="space-y-2">
        <p className="text-white/40 text-xs uppercase tracking-wider">Or edit / type it</p>
        <Textarea
          value={transcriptFinal}
          onChange={(e) => { finalRef.current = e.target.value; setTranscriptFinal(e.target.value) }}
          placeholder="e.g. 3 eggs, 2 slices toast with butter, black coffee"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/20 resize-none"
          rows={3}
        />
      </div>

      {transcriptFinal && !parsed && (
        <div className="flex gap-2">
          <Button
            onClick={clearAll}
            variant="outline"
            className="border-white/20 text-white/60"
          >
            <Trash2 size={14} className="mr-1" /> Clear
          </Button>
          <Button
            onClick={parseTranscript}
            disabled={loading || recording}
            className="flex-1 bg-violet-400 text-black font-bold hover:bg-violet-300"
          >
            {loading ? <><Loader2 size={16} className="mr-2 animate-spin" /> Parsing…</> : 'Done · Parse with AI'}
          </Button>
        </div>
      )}

      {error && (
        <Card className="border-red-400/20 bg-red-400/5">
          <CardContent className="py-3 flex items-center gap-2">
            <AlertCircle size={14} className="text-red-400" />
            <p className="text-red-300 text-xs">{error}</p>
          </CardContent>
        </Card>
      )}

      {parsed && (
        <div className="space-y-3">
          {parsed.items.map((item, i) => {
            const cals = item.estimated_calories ?? item.calories ?? 0
            const qtyLabel = item.qty_estimate || (item.quantity ? `${item.quantity}${item.unit ? ' ' + item.unit : ''}` : '')
            return (
              <Card key={i} className="border-white/10 bg-white/5">
                <CardContent className="py-3 px-4">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-white text-sm font-medium">{item.name}</p>
                      <p className="text-white/40 text-xs">{qtyLabel}</p>
                    </div>
                    <p className="text-amber-400 font-bold">{cals}</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          <Card className="border-violet-400/20 bg-violet-400/5">
            <CardContent className="py-3 px-4">
              <div className="flex justify-between">
                <p className="text-violet-400 font-bold">TOTAL</p>
                <p className="text-amber-400 font-bold">{(parsed.total_macros || sumMacros(parsed.items)).calories} kcal</p>
              </div>
              <div className="flex gap-4 mt-1">
                <span className="text-cyan-400 text-sm">P {(parsed.total_macros || sumMacros(parsed.items)).protein_g}g</span>
                <span className="text-violet-400 text-sm">C {(parsed.total_macros || sumMacros(parsed.items)).carbs_g}g</span>
                <span className="text-orange-400 text-sm">F {(parsed.total_macros || sumMacros(parsed.items)).fat_g}g</span>
              </div>
            </CardContent>
          </Card>

          {!logged ? (
            <Button
              onClick={logEntry}
              disabled={logging}
              className="w-full bg-amber-400 text-black font-bold hover:bg-amber-300"
            >
              {logging ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Check size={16} className="mr-2" />}
              Log It
            </Button>
          ) : (
            <Card className="border-green-400/20 bg-green-400/5">
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

function sumMacros(items: ParsedItem[]) {
  return items.reduce(
    (acc, it) => ({
      calories: acc.calories + (it.estimated_calories ?? it.calories ?? 0),
      protein_g: acc.protein_g + (it.protein_g || 0),
      carbs_g: acc.carbs_g + (it.carbs_g || 0),
      fat_g: acc.fat_g + (it.fat_g || 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  )
}

function normalizeParsed(raw: { items?: Array<Partial<ParsedItem>>; total_macros?: Parsed['total_macros'] }): Parsed {
  const items: ParsedItem[] = (raw.items || []).map((it) => ({
    name: it.name || 'item',
    quantity: it.quantity,
    unit: it.unit,
    qty_estimate: it.qty_estimate,
    estimated_calories: it.estimated_calories,
    calories: it.calories,
    protein_g: it.protein_g || 0,
    carbs_g: it.carbs_g || 0,
    fat_g: it.fat_g || 0,
  }))
  return { items, total_macros: raw.total_macros }
}

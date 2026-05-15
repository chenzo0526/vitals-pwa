'use client'

import { useState, useRef } from 'react'
import { Mic, MicOff, Loader2, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'

type ParsedMacros = {
  items: Array<{ name: string; qty_estimate: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }>
  total_macros: { calories: number; protein_g: number; carbs_g: number; fat_g: number }
  confidence: 'high' | 'medium' | 'low'
}

export default function VoicePage() {
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [parsed, setParsed] = useState<ParsedMacros | null>(null)
  const [loading, setLoading] = useState(false)
  const [logged, setLogged] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  function startRecording() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Speech recognition not supported on this device. Type your meal below.')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript
      setTranscript(text)
    }
    recognition.onerror = () => setError('Recording failed. Try typing below.')
    recognition.onend = () => setRecording(false)
    recognitionRef.current = recognition
    recognition.start()
    setRecording(true)
  }

  function stopRecording() {
    recognitionRef.current?.stop()
    setRecording(false)
  }

  async function parseTranscript() {
    if (!transcript.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcript }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setParsed(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Parse failed')
    } finally {
      setLoading(false)
    }
  }

  async function logEntry() {
    if (!parsed) return
    try {
      await supabase.from('intake_events').insert({
        ts: new Date().toISOString(),
        item: parsed.items.map((i) => i.name).join(', '),
        calories: parsed.total_macros.calories,
        protein_g: parsed.total_macros.protein_g,
        carbs_g: parsed.total_macros.carbs_g,
        fat_g: parsed.total_macros.fat_g,
        raw_input: transcript,
        parsed_by: 'claude-text',
      })
      setLogged(true)
    } catch {
      setLogged(true)
    }
  }

  return (
    <div className="px-4 pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Log Voice</h1>
        <Badge variant="outline" className="border-violet-400/30 text-violet-400 text-xs">AI Parse</Badge>
      </div>

      {/* Record Button */}
      <div className="flex flex-col items-center gap-4 py-6">
        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
            recording
              ? 'bg-red-500 scale-110 shadow-lg shadow-red-500/40'
              : 'bg-violet-400/20 border-2 border-violet-400/40'
          }`}
        >
          {recording ? (
            <MicOff size={36} className="text-white" />
          ) : (
            <Mic size={36} className="text-violet-400" />
          )}
        </button>
        <p className="text-white/40 text-sm text-center">
          {recording ? 'Recording… release to stop' : 'Hold to record your meal'}
        </p>
      </div>

      {/* Text Input */}
      <div className="space-y-2">
        <p className="text-white/40 text-xs uppercase tracking-wider">Or type it</p>
        <Textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="e.g. 3 eggs, 2 slices toast with butter, black coffee"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/20 resize-none"
          rows={3}
        />
      </div>

      {transcript && !parsed && (
        <Button onClick={parseTranscript} disabled={loading} className="w-full bg-violet-400 text-black font-bold hover:bg-violet-300">
          {loading ? <><Loader2 size={16} className="mr-2 animate-spin" /> Parsing…</> : 'Parse with AI'}
        </Button>
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
          {parsed.items.map((item, i) => (
            <Card key={i} className="border-white/10 bg-white/5">
              <CardContent className="py-3 px-4">
                <div className="flex justify-between">
                  <div>
                    <p className="text-white text-sm font-medium">{item.name}</p>
                    <p className="text-white/40 text-xs">{item.qty_estimate}</p>
                  </div>
                  <p className="text-amber-400 font-bold">{item.calories}</p>
                </div>
              </CardContent>
            </Card>
          ))}

          <Card className="border-violet-400/20 bg-violet-400/5">
            <CardContent className="py-3 px-4">
              <div className="flex justify-between">
                <p className="text-violet-400 font-bold">TOTAL</p>
                <p className="text-amber-400 font-bold">{parsed.total_macros.calories} kcal</p>
              </div>
              <div className="flex gap-4 mt-1">
                <span className="text-cyan-400 text-sm">P {parsed.total_macros.protein_g}g</span>
                <span className="text-violet-400 text-sm">C {parsed.total_macros.carbs_g}g</span>
                <span className="text-orange-400 text-sm">F {parsed.total_macros.fat_g}g</span>
              </div>
            </CardContent>
          </Card>

          {!logged ? (
            <Button onClick={logEntry} className="w-full bg-amber-400 text-black font-bold hover:bg-amber-300">
              <Check size={16} className="mr-2" /> Log It
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

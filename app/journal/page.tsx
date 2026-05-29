'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Mic, MicOff, ChevronLeft, Loader2, Heart, Zap, Brain, Moon, Sparkles,
  AlertTriangle, Check, RefreshCw, History, Trophy, Target, Activity,
} from 'lucide-react'

// Minimal local types for the Web Speech API. Named with VJ prefix to avoid collision
// with anything lib.dom might or might not have.
type VJRecognitionEvent = {
  resultIndex: number
  results: ArrayLike<{
    isFinal: boolean
    0: { transcript: string }
  }>
}
type VJRecognizer = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((e: VJRecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

type Checkin = {
  id?: string
  for_date: string
  mood: number | null
  energy: number | null
  focus: number | null
  sleep_quality: number | null
  sleep_hours: number | null
  stress_level: number | null
  training_quality: number | null
  gratitude_items: string[]
  intentions: string[]
  concerns: string[]
  wins: string[]
  transcript: string | null
  notes: string | null
}

const PROMPTS = [
  "How'd you sleep, what's your energy, what'd you train, what's on your mind",
  "Mood today, anything weighing on you, any wins, any concerns",
  "Talk for 30 seconds — your body, your head, your spirit",
  "How are you doing physically, mentally, spiritually right now",
]

export default function JournalPage() {
  const router = useRouter()
  const [supported, setSupported] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [todayCheckin, setTodayCheckin] = useState<Checkin | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<Checkin[]>([])
  const [prompt] = useState(() => PROMPTS[Math.floor(Math.random() * PROMPTS.length)])

  const recognitionRef = useRef<VJRecognizer | null>(null)

  // Detect browser support + load today's existing check-in
  useEffect(() => {
    // Web Speech API isn't reliably typed in lib.dom; use `any` window for vendor prefix detection.
    const win = (typeof window !== 'undefined' ? window : null) as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown } | null
    const SpeechRec = win?.SpeechRecognition || win?.webkitSpeechRecognition || null
    setSupported(!!SpeechRec)
    loadToday()
  }, [])

  async function loadToday() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login?redirect=/journal')
      return
    }
    const today = new Date().toLocaleDateString('en-CA')
    const { data } = await supabase
      .from('daily_checkins')
      .select('*')
      .eq('user_id', user.id)
      .eq('for_date', today)
      .maybeSingle()
    if (data) setTodayCheckin(data as Checkin)
  }

  async function loadHistory() {
    const { data } = await supabase
      .from('daily_checkins')
      .select('*')
      .order('for_date', { ascending: false })
      .limit(14)
    if (data) setHistory(data as Checkin[])
  }

  function startListening() {
    setError(null)
    setPermissionDenied(false)
    if (!supported) {
      setError('Voice input is not available on this browser. You can type instead.')
      return
    }
    const win2 = window as unknown as { SpeechRecognition?: new () => VJRecognizer; webkitSpeechRecognition?: new () => VJRecognizer }
    const SpeechRecCtor = win2.SpeechRecognition || win2.webkitSpeechRecognition
    if (!SpeechRecCtor) return
    const rec: VJRecognizer = new SpeechRecCtor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'
    rec.onresult = (e: VJRecognitionEvent) => {
      let finalText = ''
      let interimText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        if (result.isFinal) finalText += result[0].transcript
        else interimText += result[0].transcript
      }
      if (finalText) setTranscript((t) => (t + ' ' + finalText).trim())
      setInterim(interimText)
    }
    rec.onerror = (e: { error: string }) => {
      console.error('[journal] SpeechRecognition error:', e.error)
      if (e.error === 'not-allowed' || e.error === 'permission-denied') {
        setPermissionDenied(true)
        setError('Microphone permission denied. Enable it in Settings → Safari → Microphone.')
      } else if (e.error === 'no-speech') {
        // Silent failure — just stop, no error message
      } else {
        setError(`Voice error: ${e.error}`)
      }
      setListening(false)
    }
    rec.onend = () => {
      setListening(false)
      setInterim('')
    }
    recognitionRef.current = rec
    try {
      rec.start()
      setListening(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start mic')
    }
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setListening(false)
    setInterim('')
  }

  async function submit() {
    const fullText = transcript.trim()
    if (!fullText) {
      setError('Say or type something first.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/parse-journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: fullText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setTodayCheckin(data.checkin as Checkin)
      setTranscript('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSubmitting(false)
    }
  }

  function resetForToday() {
    setTodayCheckin(null)
    setTranscript('')
    setError(null)
  }

  // History panel toggle
  async function toggleHistory() {
    if (!showHistory) await loadHistory()
    setShowHistory((s) => !s)
  }

  return (
    <div className="px-4 pt-6 pb-12 space-y-4">
      <Link href="/" className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1">
        <ChevronLeft size={12} /> Home
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="text-violet-400" size={20} /> Daily check-in
          </h1>
          <p className="text-[11px] text-white/50 mt-0.5">
            Talk for 30 seconds. AI captures mood / energy / sleep / training / what&apos;s on your mind.
          </p>
        </div>
        <button
          onClick={toggleHistory}
          className="text-[10px] uppercase tracking-wider text-white/40 hover:text-white/80 flex items-center gap-1 px-2 py-1 rounded-md"
        >
          <History size={12} /> {showHistory ? 'Hide' : 'History'}
        </button>
      </div>

      {error && (
        <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-md p-2 flex items-start gap-1.5">
          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" /> <span>{error}</span>
        </div>
      )}

      {/* Already checked in today */}
      {todayCheckin && !showHistory ? (
        <CheckinSummary
          checkin={todayCheckin}
          onRedo={resetForToday}
        />
      ) : !showHistory ? (
        /* Recording / typing UI */
        <Card className="border-violet-400/30 bg-gradient-to-br from-violet-500/[0.05] to-transparent">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs text-white/60 leading-relaxed">
              <span className="text-violet-300 font-bold">Prompt:</span> {prompt}
            </p>

            {/* Big mic button or transcript editor */}
            <div className="relative">
              <Textarea
                value={transcript + (interim ? (transcript ? ' ' : '') + interim : '')}
                onChange={(e) => { setTranscript(e.target.value); setInterim('') }}
                onBlur={(e) => setTranscript(e.target.value)}
                placeholder={listening ? 'Listening… speak naturally.' : 'Tap the mic and start talking, or type here directly.'}
                className="bg-black/30 border-violet-400/20 min-h-[150px] text-sm leading-relaxed"
              />
              {listening && (
                <motion.div
                  className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-rose-500/20 border border-rose-400/40"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                >
                  <motion.div
                    className="w-2 h-2 rounded-full bg-rose-400"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                  <span className="text-[10px] uppercase tracking-wider text-rose-200 font-bold">Listening</span>
                </motion.div>
              )}
            </div>

            {/* Controls */}
            <div className="flex gap-2">
              {supported && (
                listening ? (
                  <Button
                    onClick={stopListening}
                    className="flex-1 bg-rose-500/20 border border-rose-400/40 text-rose-200 hover:bg-rose-500/30 h-12 font-bold"
                  >
                    <MicOff size={16} className="mr-2" /> Stop
                  </Button>
                ) : (
                  <Button
                    onClick={startListening}
                    className="flex-1 bg-violet-400/20 border border-violet-400/40 text-violet-200 hover:bg-violet-400/30 h-12 font-bold"
                  >
                    <Mic size={16} className="mr-2" /> {transcript ? 'Add more' : 'Start talking'}
                  </Button>
                )
              )}
              <Button
                onClick={submit}
                disabled={!transcript.trim() || submitting || listening}
                className="flex-1 bg-violet-400 text-black hover:bg-violet-300 disabled:opacity-50 h-12 font-bold"
              >
                {submitting ? <><Loader2 size={14} className="mr-2 animate-spin" /> Parsing</> : <><Check size={14} className="mr-2" /> Save check-in</>}
              </Button>
            </div>

            {!supported && (
              <p className="text-[10px] text-amber-300/70">
                Voice input isn&apos;t available on this browser — type into the box above and hit Save.
              </p>
            )}
            {permissionDenied && (
              <p className="text-[10px] text-rose-300/70">
                Settings → Safari → Microphone → Allow for vitals-pwa.vercel.app
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* History */}
      {showHistory && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-white/40">Last 14 days</p>
          {history.length === 0 && (
            <p className="text-[11px] text-white/40 italic">No check-ins yet.</p>
          )}
          {history.map((c) => (
            <Card key={c.id} className="border-white/10 bg-white/5">
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-white tabular-nums">{c.for_date}</p>
                  <div className="flex items-center gap-2 text-[10px] text-white/50">
                    {c.mood && <span>😊 {c.mood}</span>}
                    {c.energy && <span>⚡ {c.energy}</span>}
                    {c.sleep_quality && <span>🌙 {c.sleep_quality}</span>}
                  </div>
                </div>
                {c.notes && (
                  <p className="text-[11px] text-white/70 leading-relaxed line-clamp-3">{c.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function CheckinSummary({ checkin, onRedo }: { checkin: Checkin; onRedo: () => void }) {
  const metrics = [
    { label: 'Mood', value: checkin.mood, icon: Heart, color: 'text-rose-300' },
    { label: 'Energy', value: checkin.energy, icon: Zap, color: 'text-amber-300' },
    { label: 'Focus', value: checkin.focus, icon: Brain, color: 'text-cyan-300' },
    { label: 'Sleep', value: checkin.sleep_quality, icon: Moon, color: 'text-indigo-300' },
    { label: 'Stress', value: checkin.stress_level, icon: Activity, color: 'text-orange-300' },
    { label: 'Training', value: checkin.training_quality, icon: Trophy, color: 'text-emerald-300' },
  ].filter(m => m.value !== null && m.value !== undefined)

  return (
    <Card className="border-emerald-400/30 bg-gradient-to-br from-emerald-500/[0.06] to-transparent">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center">
              <Check size={14} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Checked in today</p>
              <p className="text-[10px] text-white/40">AI has it — Coach will use this</p>
            </div>
          </div>
          <button
            onClick={onRedo}
            className="text-white/40 hover:text-white/80 p-1.5 rounded-md hover:bg-white/5"
            aria-label="Redo today"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Metrics grid */}
        {metrics.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {metrics.map((m) => (
              <div key={m.label} className="bg-white/5 border border-white/10 rounded-lg p-2">
                <div className="flex items-center justify-between">
                  <m.icon size={12} className={m.color} />
                  <p className={`text-base font-bold tabular-nums ${m.color}`}>{m.value}</p>
                </div>
                <p className="text-[9px] uppercase tracking-wider text-white/40 mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Sleep hours */}
        {checkin.sleep_hours && (
          <p className="text-[11px] text-white/60">
            <span className="text-indigo-300 font-bold">{checkin.sleep_hours}h</span> sleep
          </p>
        )}

        {/* Wins / Gratitude / Concerns / Intentions */}
        {checkin.wins?.length > 0 && (
          <ListBlock icon={Trophy} title="Wins" items={checkin.wins} color="text-emerald-300" />
        )}
        {checkin.gratitude_items?.length > 0 && (
          <ListBlock icon={Heart} title="Gratitude" items={checkin.gratitude_items} color="text-rose-300" />
        )}
        {checkin.intentions?.length > 0 && (
          <ListBlock icon={Target} title="Intentions" items={checkin.intentions} color="text-cyan-300" />
        )}
        {checkin.concerns?.length > 0 && (
          <ListBlock icon={AlertTriangle} title="Concerns" items={checkin.concerns} color="text-amber-300" />
        )}

        {checkin.notes && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Notes</p>
            <p className="text-[11px] text-white/75 leading-relaxed whitespace-pre-line">{checkin.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ListBlock({ icon: Icon, title, items, color }: { icon: typeof Heart; title: string; items: string[]; color: string }) {
  return (
    <div>
      <p className={`text-[10px] uppercase tracking-wider font-bold mb-1 flex items-center gap-1 ${color}`}>
        <Icon size={10} /> {title}
      </p>
      <ul className="space-y-0.5">
        {items.map((s, i) => <li key={i} className="text-[11px] text-white/75 leading-relaxed pl-2">· {s}</li>)}
      </ul>
    </div>
  )
}

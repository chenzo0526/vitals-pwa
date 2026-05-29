'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, Send, Mic, MicOff, Sparkles, Loader2, Check } from 'lucide-react'

type Msg = { role: 'user' | 'assistant'; content: string; actions?: string[] }

const SUGGESTIONS = [
  'What have I eaten today?',
  'How many calories do I have left?',
  'Should I train legs today?',
  "How's my recovery looking?",
  'Log a protein shake and 2 eggs',
]

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center"><Loader2 size={18} className="animate-spin text-amber-400" /></div>}>
      <ChatInner />
    </Suspense>
  )
}

function ChatInner() {
  const params = useSearchParams()
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [recording, setRecording] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const autoSentRef = useRef(false)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  // Deep-link auto-send: /chat?q=<prompt> fires the question immediately so a tap
  // from the home Coach card or a suggestion chip lands straight in a real answer.
  useEffect(() => {
    if (autoSentRef.current) return
    const q = params.get('q')
    if (q && q.trim()) {
      autoSentRef.current = true
      send(q)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    const next = [...messages, { role: 'user' as const, content: trimmed }]
    setMessages(next)
    setInput('')
    setSending(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "I hit a snag. Give me another shot in a sec.")
      setMessages((m) => [...m, { role: 'assistant', content: json.reply, actions: json.actions }])
    } catch (e) {
      // Server returns a friendly, user-facing message (incl. out-of-credit) — show it as-is.
      setMessages((m) => [...m, { role: 'assistant', content: e instanceof Error ? e.message : "I hit a snag. Try that again in a sec." }])
    } finally {
      setSending(false)
    }
  }

  function toggleMic() {
    if (recording) {
      recognitionRef.current?.stop()
      setRecording(false)
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Voice input not supported on this browser.'); return }
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'
    let final = ''
    rec.onresult = (e: { results: { [k: number]: { [k: number]: { transcript: string }; isFinal: boolean } }; resultIndex: number }) => {
      let interim = ''
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (let i = (e as any).resultIndex; i < (e as any).results.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = (e as any).results[i]
        if (r.isFinal) final += r[0].transcript
        else interim += r[0].transcript
      }
      setInput((final + interim).trim())
    }
    rec.onend = () => setRecording(false)
    rec.onerror = () => setRecording(false)
    recognitionRef.current = rec
    rec.start()
    setRecording(true)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-center gap-2 flex-shrink-0 border-b border-white/5">
        <Link href="/" className="text-white/40 hover:text-white/80"><ChevronLeft size={18} /></Link>
        <div className="w-7 h-7 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center">
          <Sparkles size={14} className="text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-tight">Ask Vitals</p>
          <p className="text-[10px] text-white/40">Talk to log · ask anything about your body</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-4 pt-4">
            <p className="text-center text-xs text-white/40">Log by talking. Ask anything. I know your food, training, recovery, and stack.</p>
            <div className="space-y-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="w-full text-left p-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] text-sm text-white/80 transition-colors active:scale-[0.99]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
              m.role === 'user'
                ? 'bg-amber-400 text-black rounded-br-md'
                : 'bg-white/[0.06] border border-white/10 text-white/90 rounded-bl-md'
            }`}>
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.actions && m.actions.length > 0 && (
                <div className="mt-1.5 flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-emerald-300">
                  <Check size={11} /> Logged
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-white/[0.06] border border-white/10 rounded-2xl rounded-bl-md px-3.5 py-2.5">
              <Loader2 size={14} className="animate-spin text-amber-400" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-3 pt-2 pb-4 border-t border-white/5 safe-bottom">
        <div className="flex items-end gap-2">
          <button
            onClick={toggleMic}
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              recording ? 'bg-rose-500/20 border border-rose-400/50 text-rose-300 animate-pulse' : 'bg-white/5 border border-white/10 text-white/50 hover:text-white/80'
            }`}
            aria-label="Voice input"
          >
            {recording ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
            placeholder="Log a meal, or ask anything…"
            rows={1}
            className="flex-1 resize-none bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-400/50 max-h-28"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || sending}
            className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-400 text-black flex items-center justify-center disabled:opacity-40 hover:bg-amber-300 transition-colors"
            aria-label="Send"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

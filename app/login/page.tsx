'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { getUserTimezone } from '@/lib/dates'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Mail, Loader2, AlertTriangle, ArrowLeft, MailCheck, KeyRound, ChevronDown, ChevronUp } from 'lucide-react'

const RESEND_COOLDOWN_SECONDS = 60

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="px-4 pt-6 text-white/40">Loading…</div>}>
      <LoginInner />
    </Suspense>
  )
}

function LoginInner() {
  const router = useRouter()
  const params = useSearchParams()
  const redirectTo = params.get('redirect') || '/'
  const initialError = params.get('error')

  const [stage, setStage] = useState<'email' | 'sent'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(
    initialError === 'callback_failed' ? 'That sign-in link expired. Send a fresh one.' : null,
  )
  const [resendIn, setResendIn] = useState(0)
  const [showCodeEntry, setShowCodeEntry] = useState(false)
  const [lastSentAt, setLastSentAt] = useState<number | null>(null)
  const codeInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setInterval(() => setResendIn((n) => Math.max(0, n - 1)), 1000)
    return () => clearInterval(t)
  }, [resendIn])

  useEffect(() => {
    if (showCodeEntry) setTimeout(() => codeInputRef.current?.focus(), 100)
  }, [showCodeEntry])

  const canVerify = code.trim().length >= 4 && /^\d+$/.test(code.trim())

  const sendCode = useCallback(async () => {
    if (!email.trim() || sending) return
    setSending(true)
    setError(null)
    try {
      const redirectUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback`
        : undefined
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: redirectUrl,
        },
      })
      if (otpError) throw otpError
      setStage('sent')
      setCode('')
      setResendIn(RESEND_COOLDOWN_SECONDS)
      setLastSentAt(Date.now())
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Could not send. Try again.'
      setError(raw)
    } finally {
      setSending(false)
    }
  }, [email, sending])

  const verify = useCallback(async (overrideToken?: string) => {
    if (verifying) return
    const token = (overrideToken ?? code).trim()
    if (token.length < 4 || !/^\d+$/.test(token)) return
    setVerifying(true)
    setError(null)
    try {
      const { data, error: verifyErr } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token,
        type: 'email',
      })
      if (verifyErr || !data?.session?.user) throw verifyErr || new Error('Invalid code')

      const user = data.session.user
      const tz = getUserTimezone()
      const trialEndsIso = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      await supabase.from('user_profile').upsert({
        id: user.id,
        tier: 'pro',
        display_name: user.email,
        trial_ends_at: trialEndsIso,
        timezone: tz,
      }, { onConflict: 'id', ignoreDuplicates: false })

      const { data: profile } = await supabase
        .from('user_profile')
        .select('onboarding_completed_at')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile?.onboarding_completed_at) {
        router.push('/onboarding')
      } else {
        router.push(redirectTo)
      }
      router.refresh()
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Code didn't work."
      console.error('[verify] Supabase OTP error:', raw, 'token len:', token.length)
      const isExpiry = /expired/i.test(raw)
      const isInvalid = /invalid|token/i.test(raw)
      let hint = ''
      if (isExpiry) hint = 'Code expired. Tap Resend below and use the NEWEST email — older codes stop working immediately.'
      else if (isInvalid) hint = 'Code rejected. iOS often autofills the previous code — tap Resend, wait for the new email, manually copy the code from THAT email (not autofill).'
      else hint = raw
      setError(hint)
      setCode('')
      setResendIn(0)
      setVerifying(false)
      setTimeout(() => codeInputRef.current?.focus(), 0)
    }
  }, [code, email, redirectTo, router, verifying])

  function changeEmail() {
    setStage('email')
    setCode('')
    setError(null)
    setShowCodeEntry(false)
    setLastSentAt(null)
  }

  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!lastSentAt) return
    const t = setInterval(() => setTick((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [lastSentAt])
  const sinceSentSec = lastSentAt ? Math.floor((Date.now() - lastSentAt) / 1000) : 0
  void tick

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">VITALS</h1>
          <p className="text-white/50 text-sm mt-1">Personal health intelligence</p>
        </div>

        <Card className="border-white/10 bg-white/5 overflow-hidden">
          <CardContent className="pt-5 pb-5">
            <AnimatePresence mode="wait" initial={false}>
              {stage === 'email' ? (
                <motion.div
                  key="email"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-xs text-white/50 uppercase tracking-wider">Email</label>
                    <div className="relative mt-1">
                      <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                      <input
                        type="email"
                        autoFocus
                        autoComplete="email"
                        inputMode="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && email && !sending) sendCode() }}
                        placeholder="you@example.com"
                        className="w-full bg-white/5 border border-white/10 rounded-md pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400/50"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={sendCode}
                    disabled={!email.trim() || sending}
                    className="w-full bg-amber-400 text-black font-bold hover:bg-amber-300 disabled:opacity-40 h-11"
                  >
                    {sending ? (
                      <><Loader2 size={16} className="mr-2 animate-spin" /> Sending…</>
                    ) : (
                      'Send sign-in email'
                    )}
                  </Button>

                  {error && (
                    <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-md p-2 flex items-start gap-1.5">
                      <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                      <span className="whitespace-pre-line leading-relaxed">{error}</span>
                    </div>
                  )}

                  <p className="text-[11px] text-white/40 text-center leading-snug pt-1">
                    No passwords. We email you a magic link.<br />
                    By continuing you agree to the{' '}
                    <a href="/terms" className="text-cyan-400 underline">Terms</a>
                    {' '}and{' '}
                    <a href="/privacy" className="text-cyan-400 underline">Privacy Policy</a>.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="sent"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="space-y-4"
                >
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto rounded-full bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center mb-3">
                      <MailCheck size={22} className="text-emerald-300" />
                    </div>
                    <p className="text-base font-bold text-white">Check your email</p>
                    <p className="text-xs text-white/60 mt-1">
                      Sent to <span className="text-amber-300 font-semibold">{email}</span>
                    </p>
                    <p className="text-xs text-emerald-300 mt-3 px-2 leading-relaxed font-semibold">
                      Tap the &quot;Sign in to VITALS&quot; button in the email — it logs you in automatically.
                    </p>
                    {sinceSentSec < 10 && (
                      <p className="text-[10px] text-white/40 mt-2">Email usually arrives in 5-15 seconds.</p>
                    )}
                    {sinceSentSec >= 30 && sinceSentSec < 90 && (
                      <p className="text-[10px] text-amber-300/70 mt-2">Not seeing it? Check spam, or tap Resend.</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <button
                      onClick={changeEmail}
                      className="text-white/40 hover:text-white/70 flex items-center gap-1"
                    >
                      <ArrowLeft size={12} /> Wrong email?
                    </button>
                    <button
                      onClick={sendCode}
                      disabled={resendIn > 0 || sending}
                      className="text-cyan-400 hover:text-cyan-300 disabled:text-white/30 disabled:cursor-not-allowed tabular-nums"
                    >
                      {sending
                        ? 'Resending…'
                        : resendIn > 0
                          ? `Resend in ${resendIn}s`
                          : 'Resend email'}
                    </button>
                  </div>

                  <div className="pt-3 border-t border-white/5">
                    <button
                      onClick={() => setShowCodeEntry((s) => !s)}
                      className="w-full text-xs text-white/50 hover:text-white/80 flex items-center justify-center gap-1.5 py-1"
                    >
                      <KeyRound size={12} />
                      {showCodeEntry ? 'Hide code entry' : 'Or enter the code manually'}
                      {showCodeEntry ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>

                    <AnimatePresence initial={false}>
                      {showCodeEntry && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-2.5 pt-3">
                            <p className="text-[10px] text-amber-200/70 bg-amber-400/[0.05] border border-amber-400/20 rounded p-2 leading-relaxed">
                              <span className="font-bold">If autofill keeps failing:</span> tap Resend → wait 5 seconds → open the NEWEST email → long-press the code → Copy → paste here.
                            </p>
                            <input
                              ref={codeInputRef}
                              type="text"
                              inputMode="numeric"
                              pattern="\d*"
                              autoComplete="one-time-code"
                              maxLength={10}
                              value={code}
                              onChange={(e) => {
                                const clean = e.target.value.replace(/\D/g, '').slice(0, 10)
                                setCode(clean)
                                if (error) setError(null)
                              }}
                              onBlur={(e) => {
                                const clean = e.target.value.replace(/\D/g, '').slice(0, 10)
                                setCode(clean)
                              }}
                              onKeyDown={(e) => { if (e.key === 'Enter' && canVerify) verify(code) }}
                              onFocus={(e) => e.currentTarget.select()}
                              placeholder="• • • • • • •"
                              className="w-full h-14 text-center text-2xl font-mono font-bold tabular-nums tracking-[0.3em] bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-amber-400/50 focus:bg-white/10"
                              aria-label="One-time code"
                            />
                            <Button
                              onClick={() => verify(code)}
                              disabled={!canVerify || verifying}
                              className="w-full bg-amber-400 text-black font-bold hover:bg-amber-300 disabled:opacity-40 h-11"
                            >
                              {verifying ? (
                                <><Loader2 size={16} className="mr-2 animate-spin" /> Verifying…</>
                              ) : (
                                'Verify code'
                              )}
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {error && (
                    <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-md p-2 flex items-start gap-1.5">
                      <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                      <span className="whitespace-pre-line leading-relaxed">{error}</span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

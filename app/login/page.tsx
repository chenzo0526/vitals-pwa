'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { getUserTimezone } from '@/lib/dates'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Mail, Loader2, AlertTriangle, ArrowLeft, ShieldCheck } from 'lucide-react'

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

  const [stage, setStage] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(
    initialError === 'callback_failed' ? 'That sign-in link expired. Try the code instead.' : null,
  )
  const [resendIn, setResendIn] = useState(0)

  // Auto-advance focus refs for the 6 digit inputs.
  const inputs = useRef<Array<HTMLInputElement | null>>([])

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return
    const t = setInterval(() => setResendIn((n) => Math.max(0, n - 1)), 1000)
    return () => clearInterval(t)
  }, [resendIn])

  // Auto-focus the first digit input when entering code stage.
  useEffect(() => {
    if (stage === 'code') inputs.current[0]?.focus()
  }, [stage])

  const codeStr = useMemo(() => code.join(''), [code])
  const canVerify = codeStr.length === 6 && /^\d{6}$/.test(codeStr)

  const sendCode = useCallback(async () => {
    if (!email.trim() || sending) return
    setSending(true)
    setError(null)
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      })
      if (otpError) throw otpError
      setStage('code')
      setCode(['', '', '', '', '', ''])
      setResendIn(RESEND_COOLDOWN_SECONDS)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send code. Try again.')
    } finally {
      setSending(false)
    }
  }, [email, sending])

  async function verify() {
    if (!canVerify || verifying) return
    setVerifying(true)
    setError(null)
    try {
      const { data, error: verifyErr } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: codeStr,
        type: 'email',
      })
      if (verifyErr || !data?.session?.user) throw verifyErr || new Error('Invalid code')

      const user = data.session.user
      const tz = getUserTimezone()
      const trialEndsIso = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      // Upsert profile (handle_new_user trigger may have created the row already).
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
      // Hard-refresh after navigation so middleware re-reads the session cookie.
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid or expired code.')
      setVerifying(false)
    }
  }

  function setDigit(idx: number, value: string) {
    // Allow user to clear, or type a single digit
    const clean = value.replace(/\D/g, '').slice(-1)
    setCode((prev) => prev.map((c, i) => (i === idx ? clean : c)))
    if (clean && idx < 5) inputs.current[idx + 1]?.focus()
  }

  function onKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !code[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus()
      setCode((prev) => prev.map((c, i) => (i === idx - 1 ? '' : c)))
      e.preventDefault()
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      inputs.current[idx - 1]?.focus()
      e.preventDefault()
    } else if (e.key === 'ArrowRight' && idx < 5) {
      inputs.current[idx + 1]?.focus()
      e.preventDefault()
    } else if (e.key === 'Enter' && canVerify) {
      verify()
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    e.preventDefault()
    const next = ['', '', '', '', '', '']
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]
    setCode(next)
    const focusIdx = Math.min(pasted.length, 5)
    inputs.current[focusIdx]?.focus()
  }

  function changeEmail() {
    setStage('email')
    setCode(['', '', '', '', '', ''])
    setError(null)
  }

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
                      'Send code'
                    )}
                  </Button>

                  {error && (
                    <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-md p-2 flex items-start gap-1.5">
                      <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <p className="text-[11px] text-white/40 text-center leading-snug pt-1">
                    No passwords. We email you a 6-digit code.<br />
                    By continuing you agree to the{' '}
                    <a href="/terms" className="text-cyan-400 underline">Terms</a>
                    {' '}and{' '}
                    <a href="/privacy" className="text-cyan-400 underline">Privacy Policy</a>.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="code"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="space-y-4"
                >
                  <div className="text-center">
                    <div className="w-10 h-10 mx-auto rounded-full bg-amber-400/10 border border-amber-400/30 flex items-center justify-center mb-3">
                      <ShieldCheck size={18} className="text-amber-300" />
                    </div>
                    <p className="text-sm font-semibold text-white">Enter the 6-digit code</p>
                    <p className="text-xs text-white/50 mt-1">
                      Sent to <span className="text-amber-300">{email}</span>
                    </p>
                  </div>

                  <div className="flex justify-between gap-1.5">
                    {code.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => { inputs.current[i] = el }}
                        type="text"
                        inputMode="numeric"
                        pattern="\d*"
                        autoComplete={i === 0 ? 'one-time-code' : 'off'}
                        maxLength={1}
                        value={digit}
                        onChange={(e) => setDigit(i, e.target.value)}
                        onKeyDown={(e) => onKeyDown(i, e)}
                        onPaste={onPaste}
                        onFocus={(e) => e.currentTarget.select()}
                        className="w-11 h-12 text-center text-xl font-bold tabular-nums bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-400/50 focus:bg-white/10"
                        aria-label={`Digit ${i + 1}`}
                      />
                    ))}
                  </div>

                  <Button
                    onClick={verify}
                    disabled={!canVerify || verifying}
                    className="w-full bg-amber-400 text-black font-bold hover:bg-amber-300 disabled:opacity-40 h-11"
                  >
                    {verifying ? (
                      <><Loader2 size={16} className="mr-2 animate-spin" /> Verifying…</>
                    ) : (
                      'Verify'
                    )}
                  </Button>

                  {error && (
                    <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-md p-2 flex items-start gap-1.5">
                      <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

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
                          : 'Resend code'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

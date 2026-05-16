'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Mail, Loader2, Check, AlertTriangle } from 'lucide-react'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="px-4 pt-6 text-white/40">Loading…</div>}>
      <LoginInner />
    </Suspense>
  )
}

function LoginInner() {
  const params = useSearchParams()
  const redirectTo = params.get('redirect') || '/'
  const initialError = params.get('error')

  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(
    initialError === 'callback_failed' ? 'Sign-in failed. Please try again.' : null,
  )

  async function send() {
    if (!email.trim()) return
    setSending(true)
    setError(null)
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      const callbackUrl = `${origin}/auth/callback?next=${encodeURIComponent(redirectTo)}&tz=${encodeURIComponent(tz)}`
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: callbackUrl },
      })
      if (otpError) throw otpError
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send link. Try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">VITALS</h1>
          <p className="text-white/50 text-sm mt-1">Personal health intelligence</p>
        </div>

        <Card className="border-white/10 bg-white/5">
          <CardContent className="pt-5 pb-5 space-y-4">
            {sent ? (
              <div className="text-center space-y-3 py-4">
                <div className="w-12 h-12 rounded-full bg-green-400/10 border border-green-400/30 flex items-center justify-center mx-auto">
                  <Check className="text-green-400" size={22} />
                </div>
                <div>
                  <p className="text-white font-semibold">Check your inbox</p>
                  <p className="text-white/60 text-sm mt-1">
                    Click the link we sent to <span className="text-amber-300">{email}</span> to sign in.
                  </p>
                </div>
                <button
                  onClick={() => { setSent(false); setEmail('') }}
                  className="text-xs text-white/40 underline hover:text-white/60"
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-wider">Email</label>
                  <div className="relative mt-1">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                      type="email"
                      autoFocus
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && email && !sending) send() }}
                      placeholder="you@example.com"
                      className="w-full bg-white/5 border border-white/10 rounded-md pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400/50"
                    />
                  </div>
                </div>

                <Button
                  onClick={send}
                  disabled={!email.trim() || sending}
                  className="w-full bg-amber-400 text-black font-bold hover:bg-amber-300 disabled:opacity-40"
                >
                  {sending ? (
                    <><Loader2 size={16} className="mr-2 animate-spin" /> Sending…</>
                  ) : (
                    <>Send magic link</>
                  )}
                </Button>

                {error && (
                  <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-md p-2 flex items-start gap-1.5">
                    <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <p className="text-[11px] text-white/40 text-center leading-snug pt-1">
                  No passwords. We email you a one-tap link to sign in.<br />
                  By continuing you agree to the{' '}
                  <a href="/terms" className="text-cyan-400 underline">Terms</a>
                  {' '}and{' '}
                  <a href="/privacy" className="text-cyan-400 underline">Privacy Policy</a>.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

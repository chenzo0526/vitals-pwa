'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { CONSENT_BODY, DISCLAIMER_VERSION } from '@/lib/disclaimer'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Check, ChevronRight, ChevronLeft, Sparkles, Heart, Camera, FlaskConical, Activity, Droplet, Target } from 'lucide-react'

const STEPS = [
  { idx: 0, key: 'consent', title: 'Consent', sec: 60, icon: Heart },
  { idx: 1, key: 'identity', title: 'Identity', sec: 60, icon: Sparkles },
  { idx: 2, key: 'snapshot', title: 'Snapshot', sec: 90, icon: Camera },
  { idx: 3, key: 'stack', title: 'Stack', sec: 60, icon: FlaskConical },
  { idx: 4, key: 'rhythm', title: 'Rhythm', sec: 45, icon: Activity },
  { idx: 5, key: 'bloodwork', title: 'Bloodwork', sec: 45, icon: Droplet },
  { idx: 6, key: 'goal', title: 'First Goal', sec: 30, icon: Target },
]

function haptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(20)
  }
}

function celebrate() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate([20, 40, 60])
  }
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const [consentChecks, setConsentChecks] = useState({ terms: false, privacy: false, notMedical: false })
  const [identity, setIdentity] = useState({ display_name: '', age: '', weight_lb: '', height_in: '' })
  const [snapshotNotes, setSnapshotNotes] = useState('')
  const [stackNotes, setStackNotes] = useState('')
  const [rhythm, setRhythm] = useState({ training_days_per_week: '', avg_sleep_hours: '' })
  const [bloodworkNote, setBloodworkNote] = useState('')
  const [goal, setGoal] = useState('')
  const [checkpoint, setCheckpoint] = useState('')

  const allConsent = consentChecks.terms && consentChecks.privacy && consentChecks.notMedical
  const pct = ((step + 1) / STEPS.length) * 100

  async function next() {
    haptic()
    if (step === 0) await saveConsent()
    if (step < STEPS.length - 1) setStep(step + 1)
    else await finish()
  }

  function back() {
    haptic()
    if (step > 0) setStep(step - 1)
  }

  function skip() {
    haptic()
    if (step < STEPS.length - 1) setStep(step + 1)
    else finish()
  }

  async function saveConsent() {
    try {
      await supabase.from('consent_log').insert({
        consent_version: DISCLAIMER_VERSION,
        accepted_terms: consentChecks.terms,
        accepted_privacy: consentChecks.privacy,
        accepted_not_medical_advice: consentChecks.notMedical,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      })
      await supabase.from('onboarding_progress').upsert({ step_consent_at: new Date().toISOString() })
    } catch {}
  }

  async function finish() {
    setSubmitting(true)
    try {
      await supabase.from('onboarding_progress').upsert({
        step_identity_at: new Date().toISOString(),
        step_snapshot_at: new Date().toISOString(),
        step_stack_at: new Date().toISOString(),
        step_rhythm_at: new Date().toISOString(),
        step_bloodwork_at: new Date().toISOString(),
        step_goal_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        identity_data: identity,
        rhythm_data: rhythm,
        first_goal: goal,
        thirty_day_checkpoint: checkpoint,
      })
      if (identity.display_name) {
        await supabase.from('user_profile').update({
          display_name: identity.display_name,
          onboarding_completed_at: new Date().toISOString(),
        }).eq('id', (await supabase.auth.getUser()).data.user?.id || '')
      }
    } catch {}
    celebrate()
    setDone(true)
    setTimeout(() => router.push('/'), 2200)
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 12 }}
        >
          <div className="w-20 h-20 rounded-full bg-amber-400 flex items-center justify-center mb-6">
            <Check className="text-black" size={48} />
          </div>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-3xl font-bold tracking-tight"
        >
          Welcome to VITALS.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-white/60 mt-3 text-sm max-w-xs"
        >
          Your dashboard is ready. 14-day Pro trial activated.
        </motion.p>
      </div>
    )
  }

  const current = STEPS[step]
  const Icon = current.icon

  return (
    <div className="px-4 pt-6 pb-12 space-y-5">
      {/* Header with progress */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/40 uppercase tracking-wider">
            Step {step + 1} of {STEPS.length}
          </span>
          <span className="text-amber-400">{current.sec}s</span>
        </div>
        <Progress value={pct} className="h-1.5 bg-white/10" />
        <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-4 px-4">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              onClick={() => { haptic(); setStep(i) }}
              className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-md flex-shrink-0 transition-colors ${
                i === step ? 'bg-amber-400 text-black' : i < step ? 'bg-white/10 text-white/80' : 'text-white/30'
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center">
              <Icon className="text-amber-400" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{current.title}</h1>
            </div>
          </div>

          {step === 0 && (
            <Card className="border-white/10 bg-white/5">
              <CardContent className="pt-5 space-y-4">
                <p className="text-xs text-white/60 whitespace-pre-line leading-relaxed">{CONSENT_BODY}</p>
                <div className="space-y-2 pt-2 border-t border-white/10">
                  {[
                    { k: 'terms', label: 'I accept the Terms of Service', link: '/terms' },
                    { k: 'privacy', label: 'I accept the Privacy Policy', link: '/privacy' },
                    { k: 'notMedical', label: 'I understand VITALS is not medical advice', link: null },
                  ].map(({ k, label, link }) => (
                    <label key={k} className="flex items-start gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        className="mt-0.5 accent-amber-400"
                        checked={consentChecks[k as keyof typeof consentChecks]}
                        onChange={(e) => { haptic(); setConsentChecks(p => ({ ...p, [k]: e.target.checked })) }}
                      />
                      <span className="text-white/80">
                        {label}
                        {link && <Link href={link} target="_blank" className="text-cyan-400 ml-1 underline">view</Link>}
                      </span>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {step === 1 && (
            <Card className="border-white/10 bg-white/5">
              <CardContent className="pt-5 space-y-3">
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-wider">Display name</label>
                  <input
                    value={identity.display_name}
                    onChange={(e) => setIdentity({ ...identity, display_name: e.target.value })}
                    placeholder="Vincenzo"
                    className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber-400/50"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-white/50 uppercase tracking-wider">Age</label>
                    <input
                      type="number" value={identity.age}
                      onChange={(e) => setIdentity({ ...identity, age: e.target.value })}
                      className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber-400/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 uppercase tracking-wider">Weight (lb)</label>
                    <input
                      type="number" value={identity.weight_lb}
                      onChange={(e) => setIdentity({ ...identity, weight_lb: e.target.value })}
                      className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber-400/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 uppercase tracking-wider">Height (in)</label>
                    <input
                      type="number" value={identity.height_in}
                      onChange={(e) => setIdentity({ ...identity, height_in: e.target.value })}
                      className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber-400/50"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card className="border-white/10 bg-white/5">
              <CardContent className="pt-5 space-y-3">
                <p className="text-xs text-white/60">Take a baseline body photo or note your current state.</p>
                <Link
                  href="/progress"
                  className="block text-center py-4 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-400 text-sm font-medium hover:bg-amber-400/20 transition-colors"
                >
                  <Camera size={20} className="inline mr-2" />
                  Go to Body Check
                </Link>
                <Textarea
                  value={snapshotNotes}
                  onChange={(e) => setSnapshotNotes(e.target.value)}
                  placeholder="Or describe your current physique state..."
                  className="bg-white/5 border-white/10"
                />
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card className="border-white/10 bg-white/5">
              <CardContent className="pt-5 space-y-3">
                <p className="text-xs text-white/60">List substances you're currently taking (you'll add details later).</p>
                <Link
                  href="/substances"
                  className="block text-center py-4 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-400 text-sm font-medium hover:bg-amber-400/20 transition-colors"
                >
                  <FlaskConical size={20} className="inline mr-2" />
                  Open Stack Builder
                </Link>
                <Textarea
                  value={stackNotes}
                  onChange={(e) => setStackNotes(e.target.value)}
                  placeholder="Quick list: TRT, BPC-157, creatine, magnesium..."
                  className="bg-white/5 border-white/10"
                />
              </CardContent>
            </Card>
          )}

          {step === 4 && (
            <Card className="border-white/10 bg-white/5">
              <CardContent className="pt-5 space-y-3">
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-wider">Training days/week</label>
                  <input
                    type="number" min={0} max={7}
                    value={rhythm.training_days_per_week}
                    onChange={(e) => setRhythm({ ...rhythm, training_days_per_week: e.target.value })}
                    className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber-400/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-wider">Average sleep (hours)</label>
                  <input
                    type="number" min={0} max={14} step={0.5}
                    value={rhythm.avg_sleep_hours}
                    onChange={(e) => setRhythm({ ...rhythm, avg_sleep_hours: e.target.value })}
                    className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber-400/50"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {step === 5 && (
            <Card className="border-white/10 bg-white/5">
              <CardContent className="pt-5 space-y-3">
                <p className="text-xs text-white/60">Upload recent bloodwork now, or skip and add later.</p>
                <Link
                  href="/bloodwork"
                  className="block text-center py-4 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-400 text-sm font-medium hover:bg-amber-400/20 transition-colors"
                >
                  <Droplet size={20} className="inline mr-2" />
                  Upload Bloodwork
                </Link>
                <Textarea
                  value={bloodworkNote}
                  onChange={(e) => setBloodworkNote(e.target.value)}
                  placeholder="Note: last lab date, panels run, anything flagged..."
                  className="bg-white/5 border-white/10"
                />
              </CardContent>
            </Card>
          )}

          {step === 6 && (
            <Card className="border-white/10 bg-white/5">
              <CardContent className="pt-5 space-y-3">
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-wider">One goal for the next 30 days</label>
                  <Textarea
                    value={goal} onChange={(e) => setGoal(e.target.value)}
                    placeholder="Drop 5lb, hit 200g protein daily, sleep 8h consistently..."
                    className="bg-white/5 border-white/10 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-wider">30-day checkpoint metric</label>
                  <input
                    value={checkpoint}
                    onChange={(e) => setCheckpoint(e.target.value)}
                    placeholder="Weigh-in, body photo, retest E2..."
                    className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber-400/50"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Footer nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur border-t border-white/10 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center gap-2">
          {step > 0 && (
            <Button variant="outline" size="sm" onClick={back} className="border-white/20">
              <ChevronLeft size={16} />
            </Button>
          )}
          {step > 0 && step < STEPS.length - 1 && (
            <Button variant="ghost" size="sm" onClick={skip} className="text-white/40">Skip</Button>
          )}
          <Button
            onClick={next}
            disabled={(step === 0 && !allConsent) || submitting}
            className="ml-auto bg-amber-400 text-black hover:bg-amber-300 disabled:opacity-30"
          >
            {step === STEPS.length - 1 ? (submitting ? 'Finishing…' : 'Finish') : 'Continue'}
            <ChevronRight size={16} className="ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}

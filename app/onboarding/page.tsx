'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { CONSENT_BODY, DISCLAIMER_VERSION } from '@/lib/disclaimer'
import { getUserTimezone } from '@/lib/dates'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import {
  Check, ChevronRight, ChevronLeft, Sparkles, Heart, Camera,
  FlaskConical, Activity, Droplet, Target, AlertTriangle, Loader2, ShieldCheck,
  Share, Plus, Smartphone,
} from 'lucide-react'

const STEPS = [
  { idx: 0, key: 'consent',   title: 'Consent',    sec: 60, icon: Heart,        progressField: 'step_consent_at' as const },
  { idx: 1, key: 'identity',  title: 'Identity',   sec: 60, icon: Sparkles,     progressField: 'step_identity_at' as const },
  { idx: 2, key: 'snapshot',  title: 'Snapshot',   sec: 90, icon: Camera,       progressField: 'step_snapshot_at' as const },
  { idx: 3, key: 'stack',     title: 'Stack',      sec: 60, icon: FlaskConical, progressField: 'step_stack_at' as const },
  { idx: 4, key: 'rhythm',    title: 'Rhythm',     sec: 45, icon: Activity,     progressField: 'step_rhythm_at' as const },
  { idx: 5, key: 'bloodwork', title: 'Bloodwork',  sec: 45, icon: Droplet,      progressField: 'step_bloodwork_at' as const },
  { idx: 6, key: 'goal',      title: 'First Goal', sec: 30, icon: Target,       progressField: 'step_goal_at' as const },
] as const

const OPTIONAL_STEPS = new Set([2, 3, 5])

function haptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(20)
}
function celebrate() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([20, 40, 60])
}

type HeightUnit = 'imperial' | 'metric'
type WeightUnit = 'lb' | 'kg'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resuming, setResuming] = useState(true)

  const [consentChecks, setConsentChecks] = useState({ terms: false, privacy: false, notMedical: false })

  const [displayName, setDisplayName] = useState('')
  const [age, setAge] = useState('')
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('imperial')
  const [heightFt, setHeightFt] = useState('')
  const [heightIn, setHeightIn] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('lb')
  const [weightLb, setWeightLb] = useState('')
  const [weightKg, setWeightKg] = useState('')

  const [snapshotNotes, setSnapshotNotes] = useState('')
  const [stackNotes, setStackNotes] = useState('')
  const [rhythm, setRhythm] = useState({ training_days_per_week: '', avg_sleep_hours: '' })
  const [bloodworkNote, setBloodworkNote] = useState('')
  const [goal, setGoal] = useState('')
  const [checkpoint, setCheckpoint] = useState('')

  const allConsent = consentChecks.terms && consentChecks.privacy && consentChecks.notMedical
  const pct = ((step + 1) / STEPS.length) * 100

  // On mount: stamp timezone, restore state from onboarding_progress, jump to last unfinished step.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const tz = getUserTimezone()
      await supabase.from('user_profile').update({ timezone: tz }).eq('id', user.id)

      const { data: prog } = await supabase
        .from('onboarding_progress')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (cancelled) return
      if (prog) {
        if (prog.identity_data) {
          const d = prog.identity_data as Record<string, unknown>
          if (d.display_name) setDisplayName(String(d.display_name))
          if (d.age != null) setAge(String(d.age))
          if (d.height_cm != null) setHeightCm(String(d.height_cm))
          if (d.weight_kg != null) setWeightKg(String(d.weight_kg))
          if (d.height_unit_pref === 'imperial' || d.height_unit_pref === 'metric') {
            setHeightUnit(d.height_unit_pref as HeightUnit)
          }
          if (d.weight_unit_pref === 'lb' || d.weight_unit_pref === 'kg') {
            setWeightUnit(d.weight_unit_pref as WeightUnit)
          }
        }
        if (prog.rhythm_data) {
          const r = prog.rhythm_data as Record<string, unknown>
          setRhythm({
            training_days_per_week: r.training_days_per_week ? String(r.training_days_per_week) : '',
            avg_sleep_hours: r.avg_sleep_hours ? String(r.avg_sleep_hours) : '',
          })
        }
        if (prog.first_goal) setGoal(String(prog.first_goal))
        if (prog.thirty_day_checkpoint) setCheckpoint(String(prog.thirty_day_checkpoint))
        if (prog.step_consent_at) {
          setConsentChecks({ terms: true, privacy: true, notMedical: true })
        }
        // Jump to first step that is NOT yet completed.
        const lastUnfinished = STEPS.findIndex(s => !(prog as Record<string, unknown>)[s.progressField])
        if (lastUnfinished !== -1) setStep(lastUnfinished)
        else setStep(STEPS.length - 1)
      }
      setResuming(false)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const computedHeightCm = useMemo(() => {
    if (heightUnit === 'imperial') {
      const ft = Number(heightFt) || 0
      const inch = Number(heightIn) || 0
      if (!ft && !inch) return null
      return Math.round(((ft * 12) + inch) * 2.54 * 10) / 10
    }
    const cm = Number(heightCm)
    return cm > 0 ? Math.round(cm * 10) / 10 : null
  }, [heightUnit, heightFt, heightIn, heightCm])

  const computedWeightKg = useMemo(() => {
    if (weightUnit === 'lb') {
      const lb = Number(weightLb)
      return lb > 0 ? Math.round(lb * 0.45359237 * 10) / 10 : null
    }
    const kg = Number(weightKg)
    return kg > 0 ? Math.round(kg * 10) / 10 : null
  }, [weightUnit, weightLb, weightKg])

  const stepValid = useMemo(() => {
    switch (step) {
      case 0: return allConsent
      case 1: return Boolean(displayName.trim())
      case 6: return Boolean(goal.trim())
      default: return true
    }
  }, [step, allConsent, displayName, goal])

  async function getUserId(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? null
  }

  function back() {
    haptic()
    if (step > 0) setStep(step - 1)
  }

  function skip() {
    haptic()
    if (step < STEPS.length - 1) setStep(step + 1)
  }

  async function persistStep(stepIdx: number) {
    const userId = await getUserId()
    if (!userId) throw new Error('Not signed in')
    const update: Record<string, unknown> = {
      user_id: userId,
      [STEPS[stepIdx].progressField]: new Date().toISOString(),
    }
    // Persist step-specific data so resume works.
    if (stepIdx === 1) {
      update.identity_data = {
        display_name: displayName,
        age: age ? Number(age) : null,
        height_cm: computedHeightCm,
        weight_kg: computedWeightKg,
        height_unit_pref: heightUnit,
        weight_unit_pref: weightUnit,
      }
    }
    if (stepIdx === 4) {
      update.rhythm_data = rhythm
    }
    if (stepIdx === 6) {
      update.first_goal = goal
      update.thirty_day_checkpoint = checkpoint
    }
    const { error: upsertErr } = await supabase
      .from('onboarding_progress')
      .upsert(update, { onConflict: 'user_id' })
    if (upsertErr) throw new Error(upsertErr.message)
  }

  async function next() {
    haptic()
    setError(null)
    setSubmitting(true)
    try {
      if (step === 0) await saveConsent()
      else if (step !== STEPS.length - 1) await persistStep(step)

      if (step < STEPS.length - 1) {
        setStep(step + 1)
      } else {
        await finish()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your progress. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function saveConsent() {
    const userId = await getUserId()
    if (!userId) throw new Error('Not signed in')
    const { error: clErr } = await supabase.from('consent_log').insert({
      user_id: userId,
      consent_version: DISCLAIMER_VERSION,
      accepted_terms: consentChecks.terms,
      accepted_privacy: consentChecks.privacy,
      accepted_not_medical_advice: consentChecks.notMedical,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    })
    if (clErr) throw new Error('consent_log: ' + clErr.message)
    const { error: progErr } = await supabase.from('onboarding_progress').upsert({
      user_id: userId,
      step_consent_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (progErr) throw new Error('onboarding_progress: ' + progErr.message)
  }

  async function finish() {
    const userId = await getUserId()
    if (!userId) {
      router.push('/login')
      return
    }
    const identityData = {
      display_name: displayName,
      age: age ? Number(age) : null,
      height_cm: computedHeightCm,
      weight_kg: computedWeightKg,
      height_unit_pref: heightUnit,
      weight_unit_pref: weightUnit,
    }
    const nowIso = new Date().toISOString()

    const { error: progErr } = await supabase.from('onboarding_progress').upsert({
      user_id: userId,
      step_identity_at: nowIso,
      step_snapshot_at: nowIso,
      step_stack_at: nowIso,
      step_rhythm_at: nowIso,
      step_bloodwork_at: nowIso,
      step_goal_at: nowIso,
      completed_at: nowIso,
      identity_data: identityData,
      rhythm_data: rhythm,
      first_goal: goal,
      thirty_day_checkpoint: checkpoint,
    }, { onConflict: 'user_id' })
    if (progErr) throw new Error('onboarding_progress finish: ' + progErr.message)

    // ALWAYS set onboarding_completed_at — this is what unblocks the home page.
    const profileUpdate: Record<string, unknown> = { onboarding_completed_at: nowIso }
    if (displayName) profileUpdate.display_name = displayName
    const { error: profErr } = await supabase
      .from('user_profile')
      .update(profileUpdate)
      .eq('id', userId)
    if (profErr) throw new Error('user_profile: ' + profErr.message)

    celebrate()
    setDone(true)
    // Don't auto-route — let the user choose to install or continue. Standalone PWA = real app feel.
  }

  if (done) {
    return <FinishedScreen onContinue={() => router.push('/')} />
  }

  if (resuming) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-amber-400" size={20} />
      </div>
    )
  }

  const current = STEPS[step]
  const Icon = current.icon
  const isFinalStep = step === STEPS.length - 1
  const isConsentStep = step === 0
  const canSkip = OPTIONAL_STEPS.has(step) && !isConsentStep

  let primaryLabel = 'Next'
  if (isConsentStep) primaryLabel = submitting ? 'Saving…' : 'Accept & Continue'
  else if (isFinalStep) primaryLabel = submitting ? 'Finishing…' : 'Finish & Enter Vitals'
  else if (submitting) primaryLabel = 'Saving…'

  return (
    <div className="px-4 pt-6 pb-28 space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/40 uppercase tracking-wider">
            Step {step + 1} of {STEPS.length}
          </span>
          <span className="text-amber-400">{current.sec}s</span>
        </div>
        <Progress value={pct} className="h-1.5 bg-white/10" />
        <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-4 px-4">
          {STEPS.map((s, i) => {
            const isCurrent = i === step
            const isCompleted = i < step
            const isFuture = i > step
            return (
              <button
                key={s.key}
                onClick={() => {
                  // Only allow going back to completed steps. Forward jumps must use Next so data persists.
                  if (isCompleted) { haptic(); setStep(i) }
                }}
                disabled={isFuture}
                aria-disabled={isFuture}
                className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-md flex-shrink-0 transition-colors ${
                  isCurrent
                    ? 'bg-amber-400 text-black'
                    : isCompleted
                      ? 'bg-white/10 text-white/80 hover:bg-white/15 cursor-pointer'
                      : 'text-white/20 cursor-not-allowed'
                }`}
              >
                {s.title}
              </button>
            )
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center">
              <Icon className="text-amber-400" size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">{current.title}</h1>
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
                        className="mt-0.5 accent-amber-400 w-4 h-4"
                        checked={consentChecks[k as keyof typeof consentChecks]}
                        onChange={(e) => { haptic(); setConsentChecks(p => ({ ...p, [k]: e.target.checked })) }}
                      />
                      <span className="text-white/80 leading-relaxed">
                        {label}
                        {link && <Link href={link} target="_blank" className="text-cyan-400 ml-1 underline">view</Link>}
                      </span>
                    </label>
                  ))}
                </div>
                {!allConsent && (
                  <p className="text-[10px] text-white/40 flex items-center gap-1">
                    <ShieldCheck size={11} /> Check all three boxes to continue
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {step === 1 && (
            <Card className="border-white/10 bg-white/5">
              <CardContent className="pt-5 space-y-4">
                <div>
                  <label className="text-xs text-white/50 uppercase tracking-wider">Display name *</label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Vincenzo"
                    className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber-400/50"
                  />
                </div>

                <div>
                  <label className="text-xs text-white/50 uppercase tracking-wider">Age</label>
                  <input
                    type="number" value={age} onChange={(e) => setAge(e.target.value)}
                    className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber-400/50"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-white/50 uppercase tracking-wider">Height</label>
                    <UnitToggle
                      options={[
                        { value: 'imperial', label: 'ft / in' },
                        { value: 'metric', label: 'cm' },
                      ]}
                      value={heightUnit}
                      onChange={(v) => setHeightUnit(v as HeightUnit)}
                    />
                  </div>
                  {heightUnit === 'imperial' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <input
                          type="number" min={0} max={9} value={heightFt}
                          onChange={(e) => setHeightFt(e.target.value)}
                          placeholder="5"
                          className="w-full bg-white/5 border border-white/10 rounded-md pl-3 pr-9 py-2 text-sm focus:outline-none focus:border-amber-400/50"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40 pointer-events-none">ft</span>
                      </div>
                      <div className="relative">
                        <input
                          type="number" min={0} max={11} value={heightIn}
                          onChange={(e) => setHeightIn(e.target.value)}
                          placeholder="10"
                          className="w-full bg-white/5 border border-white/10 rounded-md pl-3 pr-9 py-2 text-sm focus:outline-none focus:border-amber-400/50"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40 pointer-events-none">in</span>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="number" min={0} max={300} step="0.1" value={heightCm}
                        onChange={(e) => setHeightCm(e.target.value)}
                        placeholder="178"
                        className="w-full bg-white/5 border border-white/10 rounded-md pl-3 pr-10 py-2 text-sm focus:outline-none focus:border-amber-400/50"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40 pointer-events-none">cm</span>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-white/50 uppercase tracking-wider">Weight</label>
                    <UnitToggle
                      options={[
                        { value: 'lb', label: 'lb' },
                        { value: 'kg', label: 'kg' },
                      ]}
                      value={weightUnit}
                      onChange={(v) => setWeightUnit(v as WeightUnit)}
                    />
                  </div>
                  {weightUnit === 'lb' ? (
                    <div className="relative">
                      <input
                        type="number" min={0} max={1000} step="0.1" value={weightLb}
                        onChange={(e) => setWeightLb(e.target.value)}
                        placeholder="180"
                        className="w-full bg-white/5 border border-white/10 rounded-md pl-3 pr-10 py-2 text-sm focus:outline-none focus:border-amber-400/50"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40 pointer-events-none">lb</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="number" min={0} max={500} step="0.1" value={weightKg}
                        onChange={(e) => setWeightKg(e.target.value)}
                        placeholder="82"
                        className="w-full bg-white/5 border border-white/10 rounded-md pl-3 pr-10 py-2 text-sm focus:outline-none focus:border-amber-400/50"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40 pointer-events-none">kg</span>
                    </div>
                  )}
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
                <p className="text-xs text-white/60">List substances you&apos;re currently taking (you&apos;ll add details later).</p>
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
                  <label className="text-xs text-white/50 uppercase tracking-wider">One goal for the next 30 days *</label>
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

      {error && (
        <Card className="border-rose-400/30 bg-rose-500/10">
          <CardContent className="py-3 px-3 flex items-start gap-2">
            <AlertTriangle size={14} className="text-rose-300 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-rose-200 leading-snug">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur border-t border-white/10 px-4 py-3 safe-bottom">
        <div className="max-w-md mx-auto flex items-center gap-2">
          <Button
            variant="outline"
            onClick={back}
            disabled={step === 0 || submitting}
            className="border-white/20 text-white/60 disabled:opacity-20"
          >
            <ChevronLeft size={16} className="mr-1" /> Back
          </Button>
          {canSkip && (
            <Button variant="ghost" onClick={skip} disabled={submitting} className="text-white/40">
              Skip
            </Button>
          )}
          <Button
            onClick={next}
            disabled={!stepValid || submitting}
            className="ml-auto bg-amber-400 text-black hover:bg-amber-300 disabled:opacity-30 font-semibold"
          >
            {submitting && <Loader2 size={14} className="mr-1.5 animate-spin" />}
            {primaryLabel}
            {!submitting && <ChevronRight size={16} className="ml-1" />}
          </Button>
        </div>
      </div>
    </div>
  )
}

function UnitToggle({
  options, value, onChange,
}: {
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="inline-flex bg-white/5 border border-white/10 rounded-md p-0.5">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => { haptic(); onChange(o.value) }}
          className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded transition-colors ${
            value === o.value ? 'bg-amber-400 text-black font-bold' : 'text-white/50 hover:text-white/80'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function detectPlatform(): 'ios-safari' | 'android' | 'standalone' | 'desktop' | 'other' {
  if (typeof window === 'undefined') return 'other'
  // Standalone PWA (already installed)
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS sets navigator.standalone when launched from homescreen
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  if (standalone) return 'standalone'
  const ua = window.navigator.userAgent || ''
  const isIOS = /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua)
  if (isIOS) return 'ios-safari'
  if (/Android/i.test(ua)) return 'android'
  if (!/Mobi|Android|iPhone|iPad/i.test(ua)) return 'desktop'
  return 'other'
}

function FinishedScreen({ onContinue }: { onContinue: () => void }) {
  const platform = useMemo(() => detectPlatform(), [])
  const showInstallHelp = platform === 'ios-safari' || platform === 'android'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center py-12">
      <motion.div
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 12 }}
      >
        <div className="w-20 h-20 rounded-full bg-amber-400 flex items-center justify-center mb-6">
          <Check className="text-black" size={48} />
        </div>
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }} className="text-3xl font-bold tracking-tight"
      >
        Welcome to VITALS.
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }} className="text-white/60 mt-3 text-sm max-w-xs"
      >
        14-day Pro trial activated.
      </motion.p>

      {showInstallHelp && (
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-8 w-full max-w-sm bg-white/5 border border-amber-400/30 rounded-2xl p-5 text-left"
        >
          <div className="flex items-center gap-2 mb-3">
            <Smartphone size={18} className="text-amber-400" />
            <p className="text-sm font-bold text-white">Install Vitals as an app</p>
          </div>
          <p className="text-xs text-white/60 leading-relaxed mb-3">
            Skip the browser. Opens like a real app, stays signed in, no back-swipe surprises.
          </p>
          {platform === 'ios-safari' ? (
            <ol className="space-y-2.5 text-xs text-white/80">
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold flex items-center justify-center mt-0.5">1</span>
                <span>Tap the <Share size={12} className="inline -mt-0.5 mx-0.5 text-cyan-400" /> <span className="text-cyan-400 font-semibold">Share</span> button in Safari&apos;s bottom toolbar</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold flex items-center justify-center mt-0.5">2</span>
                <span>Scroll and tap <span className="text-white font-semibold">Add to Home Screen</span> <Plus size={12} className="inline -mt-0.5" /></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold flex items-center justify-center mt-0.5">3</span>
                <span>Tap <span className="text-white font-semibold">Add</span> — Vitals appears on your home screen</span>
              </li>
            </ol>
          ) : (
            <ol className="space-y-2.5 text-xs text-white/80">
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold flex items-center justify-center mt-0.5">1</span>
                <span>Tap the <span className="text-cyan-400 font-semibold">⋮ menu</span> in Chrome (top-right)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold flex items-center justify-center mt-0.5">2</span>
                <span>Tap <span className="text-white font-semibold">Add to Home screen</span> or <span className="text-white font-semibold">Install app</span></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold flex items-center justify-center mt-0.5">3</span>
                <span>Confirm — Vitals launches like a real app from now on</span>
              </li>
            </ol>
          )}
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ delay: 1.0 }}
        className="mt-8 w-full max-w-sm"
      >
        <Button
          onClick={onContinue}
          className="w-full h-12 bg-amber-400 text-black font-bold hover:bg-amber-300"
        >
          {showInstallHelp ? 'Continue to dashboard' : 'Enter Vitals'}
          <ChevronRight size={16} className="ml-1" />
        </Button>
      </motion.div>
    </div>
  )
}

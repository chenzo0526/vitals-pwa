'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Loader2, Save, Check } from 'lucide-react'
import { supabase, getCurrentUserId } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [displayName, setDisplayName] = useState('')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState<'male' | 'female'>('male')
  const [heightFt, setHeightFt] = useState('')
  const [heightIn, setHeightIn] = useState('')
  const [weightLb, setWeightLb] = useState('')
  const [goal, setGoal] = useState('')
  const [trainingDays, setTrainingDays] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const uid = await getCurrentUserId()
    if (!uid) { router.push('/login?redirect=/profile'); return }
    const [profileRes, onbRes] = await Promise.all([
      supabase.from('user_profile').select('display_name').eq('id', uid).maybeSingle(),
      supabase.from('onboarding_progress').select('identity_data, rhythm_data, first_goal').eq('user_id', uid).maybeSingle(),
    ])
    if (profileRes.data?.display_name) setDisplayName(String(profileRes.data.display_name))
    const id = (onbRes.data?.identity_data || {}) as Record<string, unknown>
    if (id.age != null) setAge(String(id.age))
    if (id.sex === 'female') setSex('female')
    if (id.height_cm) {
      const totalIn = Math.round(Number(id.height_cm) / 2.54)
      setHeightFt(String(Math.floor(totalIn / 12)))
      setHeightIn(String(totalIn % 12))
    }
    if (id.weight_kg) setWeightLb(String(Math.round(Number(id.weight_kg) * 2.20462)))
    if (onbRes.data?.first_goal) setGoal(String(onbRes.data.first_goal))
    const r = (onbRes.data?.rhythm_data || {}) as Record<string, unknown>
    if (r.training_days_per_week != null) setTrainingDays(String(r.training_days_per_week))
    setLoading(false)
  }

  async function save() {
    setSaving(true); setErr(null); setSaved(false)
    try {
      const uid = await getCurrentUserId()
      if (!uid) { router.push('/login?redirect=/profile'); return }
      const ft = Number(heightFt) || 0
      const inches = Number(heightIn) || 0
      const height_cm = ft || inches ? Math.round((ft * 12 + inches) * 2.54) : null
      const weight_kg = weightLb ? Math.round((Number(weightLb) / 2.20462) * 10) / 10 : null

      const { data: existing } = await supabase.from('onboarding_progress').select('identity_data, rhythm_data').eq('user_id', uid).maybeSingle()
      const identity_data = { ...((existing?.identity_data || {}) as Record<string, unknown>), age: age ? Number(age) : null, sex, height_cm, weight_kg }
      const rhythm_data = { ...((existing?.rhythm_data || {}) as Record<string, unknown>), training_days_per_week: trainingDays ? Number(trainingDays) : null }

      const { error: e1 } = await supabase.from('onboarding_progress').upsert({ user_id: uid, identity_data, rhythm_data, first_goal: goal || null }, { onConflict: 'user_id' })
      if (e1) throw new Error(e1.message)
      if (displayName.trim()) {
        const { error: e2 } = await supabase.from('user_profile').update({ display_name: displayName.trim() }).eq('id', uid)
        if (e2) throw new Error(e2.message)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2200)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-amber-400" /></div>

  return (
    <div className="px-4 pt-6 pb-12 space-y-4">
      <Link href="/more" className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1"><ChevronLeft size={12} /> More</Link>
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Profile</h1>
        <p className="text-[11px] text-white/45 mt-0.5">Update anything that&apos;s off. Your coach + calorie target use these.</p>
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardContent className="p-4 space-y-3">
          <Field label="Display name">
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="First name" className={inputCls} />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Age">
              <input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="years" className={inputCls} />
            </Field>
            <Field label="Sex (for BMR)">
              <select value={sex} onChange={(e) => setSex(e.target.value as 'male' | 'female')} className={inputCls}>
                <option value="male" className="bg-zinc-900">Male</option>
                <option value="female" className="bg-zinc-900">Female</option>
              </select>
            </Field>
          </div>

          <div>
            <p className="text-xs text-white/50 uppercase tracking-wider">Height</p>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <input type="number" value={heightFt} onChange={(e) => setHeightFt(e.target.value)} placeholder="ft" className={inputCls} />
              <input type="number" value={heightIn} onChange={(e) => setHeightIn(e.target.value)} placeholder="in" className={inputCls} />
            </div>
          </div>

          <Field label="Bodyweight (lb)">
            <input type="number" value={weightLb} onChange={(e) => setWeightLb(e.target.value)} placeholder="lb" className={inputCls} />
          </Field>

          <Field label="Training days per week">
            <input type="number" min={0} max={7} value={trainingDays} onChange={(e) => setTrainingDays(e.target.value)} placeholder="days/wk" className={inputCls} />
          </Field>

          <Field label="Current goal">
            <textarea value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. lean cut to 12% bf, add 10lb on bench, hold protein 180g+" rows={2} className={inputCls + ' resize-none'} />
          </Field>

          {err && <p className="text-xs text-rose-300">{err}</p>}
          <Button onClick={save} disabled={saving} className="w-full bg-amber-400 text-black hover:bg-amber-300 font-semibold disabled:opacity-50">
            {saving ? <><Loader2 size={14} className="mr-1.5 animate-spin" /> Saving</> : saved ? <><Check size={14} className="mr-1.5" /> Saved</> : <><Save size={14} className="mr-1.5" /> Save changes</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

const inputCls = 'w-full mt-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber-400/50'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-white/50 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

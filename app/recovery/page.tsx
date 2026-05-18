'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, getCurrentUserId } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Heart, Activity, Moon, Loader2, ChevronLeft, AlertTriangle, Check, RefreshCw, History,
  Watch, Plus, Trash2, Edit3, TrendingUp, TrendingDown,
} from 'lucide-react'

type BiometricEntry = {
  id?: string
  for_date: string
  source: 'manual' | 'apple_health' | 'whoop' | 'oura' | 'fitbit' | 'garmin' | 'other'
  hrv_rmssd: number | null
  rhr_bpm: number | null
  sleep_total_min: number | null
  sleep_deep_min: number | null
  sleep_rem_min: number | null
  sleep_efficiency_pct: number | null
  steps: number | null
  recovery_score: number | null
  strain_score: number | null
  readiness_score: number | null
  notes: string | null
}

const SOURCE_LABELS: Record<BiometricEntry['source'], string> = {
  manual: 'Manual',
  apple_health: 'Apple Health',
  whoop: 'WHOOP',
  oura: 'Oura',
  fitbit: 'Fitbit',
  garmin: 'Garmin',
  other: 'Other',
}

type FormState = {
  for_date: string
  source: BiometricEntry['source']
  hrv_rmssd: string
  rhr_bpm: string
  sleep_total_hours: string  // user enters hours, we convert to min
  sleep_efficiency_pct: string
  recovery_score: string
  strain_score: string
  readiness_score: string
  notes: string
}

const emptyForm = (): FormState => ({
  for_date: new Date().toLocaleDateString('en-CA'),
  source: 'manual',
  hrv_rmssd: '',
  rhr_bpm: '',
  sleep_total_hours: '',
  sleep_efficiency_pct: '',
  recovery_score: '',
  strain_score: '',
  readiness_score: '',
  notes: '',
})

export default function RecoveryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<BiometricEntry[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const userId = await getCurrentUserId()
      if (!userId) {
        router.push('/login?redirect=/recovery')
        return
      }
      const { data, error: loadErr } = await supabase
        .from('biometric_entries')
        .select('*')
        .order('for_date', { ascending: false })
        .limit(30)
      if (loadErr) throw new Error(loadErr.message)
      setEntries((data || []) as BiometricEntry[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setEditingId(null)
    setForm(emptyForm())
    setError(null)
    setShowForm(true)
  }

  function openEdit(e: BiometricEntry) {
    setEditingId(e.id || null)
    setForm({
      for_date: e.for_date,
      source: e.source,
      hrv_rmssd: e.hrv_rmssd != null ? String(e.hrv_rmssd) : '',
      rhr_bpm: e.rhr_bpm != null ? String(e.rhr_bpm) : '',
      sleep_total_hours: e.sleep_total_min != null ? (e.sleep_total_min / 60).toFixed(1) : '',
      sleep_efficiency_pct: e.sleep_efficiency_pct != null ? String(e.sleep_efficiency_pct) : '',
      recovery_score: e.recovery_score != null ? String(e.recovery_score) : '',
      strain_score: e.strain_score != null ? String(e.strain_score) : '',
      readiness_score: e.readiness_score != null ? String(e.readiness_score) : '',
      notes: e.notes || '',
    })
    setError(null)
    setShowForm(true)
  }

  async function save() {
    setError(null)
    setSaving(true)
    try {
      const userId = await getCurrentUserId()
      if (!userId) throw new Error('Not signed in')
      const payload = {
        user_id: userId,
        for_date: form.for_date,
        source: form.source,
        hrv_rmssd: form.hrv_rmssd ? Number(form.hrv_rmssd) : null,
        rhr_bpm: form.rhr_bpm ? Number(form.rhr_bpm) : null,
        sleep_total_min: form.sleep_total_hours ? Math.round(Number(form.sleep_total_hours) * 60) : null,
        sleep_efficiency_pct: form.sleep_efficiency_pct ? Number(form.sleep_efficiency_pct) : null,
        recovery_score: form.recovery_score ? Number(form.recovery_score) : null,
        strain_score: form.strain_score ? Number(form.strain_score) : null,
        readiness_score: form.readiness_score ? Number(form.readiness_score) : null,
        notes: form.notes.trim() || null,
      }
      if (editingId) {
        const { error: upErr } = await supabase.from('biometric_entries').update(payload).eq('id', editingId)
        if (upErr) throw new Error(upErr.message)
      } else {
        // Upsert on (user_id, for_date, source) — easy re-entry without dupes
        const { error: insErr } = await supabase
          .from('biometric_entries')
          .upsert(payload, { onConflict: 'user_id,for_date,source' })
        if (insErr) throw new Error(insErr.message)
      }
      setShowForm(false)
      setEditingId(null)
      setForm(emptyForm())
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function deleteEntry(id: string) {
    if (!confirm('Delete this entry?')) return
    const { error: delErr } = await supabase.from('biometric_entries').delete().eq('id', id)
    if (delErr) {
      setError(delErr.message)
      return
    }
    load()
  }

  // Most recent entry — for "today's recovery" hero
  const latest = entries[0]
  const previous = entries[1]
  function trendIcon(curr: number | null, prev: number | null) {
    if (curr == null || prev == null) return null
    const diff = curr - prev
    if (Math.abs(diff) < 0.5) return null
    return diff > 0
      ? <TrendingUp size={11} className="text-emerald-300 inline ml-1" />
      : <TrendingDown size={11} className="text-rose-300 inline ml-1" />
  }

  return (
    <div className="px-4 pt-6 pb-12 space-y-4">
      <Link href="/" className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1">
        <ChevronLeft size={12} /> Home
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Heart className="text-rose-400" size={20} /> Recovery
          </h1>
          <p className="text-[11px] text-white/50 mt-0.5">
            HRV, RHR, sleep. Coach reads this. WHOOP/Apple Health connector coming.
          </p>
        </div>
        <Button
          onClick={openNew}
          className="bg-rose-500/20 border border-rose-400/40 text-rose-300 hover:bg-rose-500/30"
        >
          <Plus size={16} /> Log
        </Button>
      </div>

      {error && (
        <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-md p-2 flex items-start gap-1.5">
          <AlertTriangle size={12} className="mt-0.5" /> <span>{error}</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && entries.length === 0 && !showForm && (
        <Card className="border-rose-400/30 bg-gradient-to-br from-rose-500/5 to-transparent">
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-bold text-rose-200">Track your recovery</p>
            <p className="text-xs text-white/70 leading-relaxed">
              Quick-log HRV, RHR, and sleep from your wearable (WHOOP / Oura / Apple Watch / Garmin). The AI Coach reads these to spot overtraining, undersleep, and stress patterns before they catch up to you.
            </p>
            <p className="text-xs text-white/60 leading-relaxed">
              Auto-sync coming soon. For now: open your wearable's app, glance at today's numbers, tap <strong className="text-rose-300">Log</strong> above. 15 seconds, done.
            </p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={18} className="animate-spin text-rose-400" />
        </div>
      )}

      {/* Latest hero */}
      {latest && (
        <Card className="border-rose-400/30 bg-gradient-to-br from-rose-500/[0.05] to-transparent">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-rose-300 font-bold">Latest</p>
                <p className="text-[10px] text-white/50">{latest.for_date} · {SOURCE_LABELS[latest.source]}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(latest)} className="p-1.5 rounded-md text-white/40 hover:text-white/80 hover:bg-white/5"><Edit3 size={12} /></button>
                <button onClick={() => latest.id && deleteEntry(latest.id)} className="p-1.5 rounded-md text-rose-400/70 hover:text-rose-300 hover:bg-rose-500/10"><Trash2 size={12} /></button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {latest.hrv_rmssd != null && (
                <Metric label="HRV" value={latest.hrv_rmssd.toFixed(0)} unit="ms" icon={Activity} color="text-cyan-300" trend={trendIcon(latest.hrv_rmssd, previous?.hrv_rmssd ?? null)} />
              )}
              {latest.rhr_bpm != null && (
                <Metric label="RHR" value={String(latest.rhr_bpm)} unit="bpm" icon={Heart} color="text-rose-300" trend={trendIcon(latest.rhr_bpm, previous?.rhr_bpm ?? null)} />
              )}
              {latest.sleep_total_min != null && (
                <Metric label="Sleep" value={(latest.sleep_total_min / 60).toFixed(1)} unit="h" icon={Moon} color="text-indigo-300" trend={trendIcon(latest.sleep_total_min, previous?.sleep_total_min ?? null)} />
              )}
              {latest.recovery_score != null && (
                <Metric label="Recovery" value={String(latest.recovery_score)} unit="" icon={Activity} color="text-emerald-300" trend={trendIcon(latest.recovery_score, previous?.recovery_score ?? null)} />
              )}
              {latest.strain_score != null && (
                <Metric label="Strain" value={latest.strain_score.toFixed(1)} unit="" icon={TrendingUp} color="text-amber-300" trend={null} />
              )}
              {latest.readiness_score != null && (
                <Metric label="Readiness" value={String(latest.readiness_score)} unit="" icon={Activity} color="text-violet-300" trend={trendIcon(latest.readiness_score, previous?.readiness_score ?? null)} />
              )}
            </div>

            {latest.notes && (
              <p className="text-[11px] text-white/65 leading-relaxed bg-black/20 rounded-md p-2 border border-white/5">{latest.notes}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* History */}
      {entries.length > 1 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-white/40 flex items-center gap-1">
            <History size={11} /> Last 30 days
          </p>
          {entries.slice(1).map((e) => (
            <Card key={e.id} className="border-white/10 bg-white/5">
              <CardContent className="p-2.5 flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white tabular-nums">{e.for_date}</p>
                  <p className="text-[10px] text-white/50">{SOURCE_LABELS[e.source]}</p>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-white/60 flex-shrink-0">
                  {e.hrv_rmssd != null && <span className="tabular-nums">HRV {e.hrv_rmssd.toFixed(0)}</span>}
                  {e.rhr_bpm != null && <span className="tabular-nums">RHR {e.rhr_bpm}</span>}
                  {e.sleep_total_min != null && <span className="tabular-nums">{(e.sleep_total_min/60).toFixed(1)}h</span>}
                </div>
                <button onClick={() => openEdit(e)} className="p-1.5 rounded-md text-white/40 hover:text-white/80"><Edit3 size={10} /></button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-end sm:items-center justify-center p-4">
          <Card className="border-rose-400/30 bg-zinc-950 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">{editingId ? 'Edit entry' : 'Log recovery'}</h2>
                <button onClick={() => !saving && setShowForm(false)} className="text-white/40 hover:text-white/80">✕</button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <FormField label="Date">
                  <input type="date" value={form.for_date} onChange={(e) => setForm({...form, for_date: e.target.value})} className={inputClass} />
                </FormField>
                <FormField label="Source">
                  <select value={form.source} onChange={(e) => setForm({...form, source: e.target.value as BiometricEntry['source']})} className={inputClass}>
                    {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k} className="bg-zinc-900">{v}</option>)}
                  </select>
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <FormField label="HRV (ms)">
                  <input type="number" step="0.1" value={form.hrv_rmssd} onChange={(e) => setForm({...form, hrv_rmssd: e.target.value})} onBlur={(e) => setForm((f) => ({...f, hrv_rmssd: e.target.value}))} placeholder="62" className={inputClass} />
                </FormField>
                <FormField label="RHR (bpm)">
                  <input type="number" value={form.rhr_bpm} onChange={(e) => setForm({...form, rhr_bpm: e.target.value})} onBlur={(e) => setForm((f) => ({...f, rhr_bpm: e.target.value}))} placeholder="58" className={inputClass} />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <FormField label="Sleep (hours)">
                  <input type="number" step="0.1" value={form.sleep_total_hours} onChange={(e) => setForm({...form, sleep_total_hours: e.target.value})} onBlur={(e) => setForm((f) => ({...f, sleep_total_hours: e.target.value}))} placeholder="7.5" className={inputClass} />
                </FormField>
                <FormField label="Sleep efficiency (%)">
                  <input type="number" value={form.sleep_efficiency_pct} onChange={(e) => setForm({...form, sleep_efficiency_pct: e.target.value})} onBlur={(e) => setForm((f) => ({...f, sleep_efficiency_pct: e.target.value}))} placeholder="88" className={inputClass} />
                </FormField>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <FormField label="Recovery 0-100">
                  <input type="number" min={0} max={100} value={form.recovery_score} onChange={(e) => setForm({...form, recovery_score: e.target.value})} onBlur={(e) => setForm((f) => ({...f, recovery_score: e.target.value}))} placeholder="WHOOP" className={inputClass} />
                </FormField>
                <FormField label="Strain 0-21">
                  <input type="number" step="0.1" value={form.strain_score} onChange={(e) => setForm({...form, strain_score: e.target.value})} onBlur={(e) => setForm((f) => ({...f, strain_score: e.target.value}))} placeholder="WHOOP" className={inputClass} />
                </FormField>
                <FormField label="Readiness 0-100">
                  <input type="number" min={0} max={100} value={form.readiness_score} onChange={(e) => setForm({...form, readiness_score: e.target.value})} onBlur={(e) => setForm((f) => ({...f, readiness_score: e.target.value}))} placeholder="Oura" className={inputClass} />
                </FormField>
              </div>

              <FormField label="Notes">
                <textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} rows={2} placeholder="Felt off · slept deep · etc." className={inputClass + ' resize-none'} />
              </FormField>

              <div className="flex gap-2 pt-2 border-t border-white/5">
                <Button onClick={save} disabled={saving} className="flex-1 bg-rose-400 text-black hover:bg-rose-300 h-11 font-bold disabled:opacity-50">
                  {saving ? <><Loader2 size={14} className="mr-2 animate-spin" /> Saving</> : <><Check size={14} className="mr-2" /> {editingId ? 'Save changes' : 'Save entry'}</>}
                </Button>
                <Button onClick={() => !saving && setShowForm(false)} variant="outline" className="border-white/20 text-white/60 h-11" disabled={saving}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

const inputClass = "w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-rose-400/50"

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-white/40">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  )
}

function Metric({ label, value, unit, icon: Icon, color, trend }: { label: string; value: string; unit: string; icon: typeof Heart; color: string; trend: React.ReactNode }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-2">
      <div className="flex items-center justify-between">
        <Icon size={11} className={color} />
        <p className={`text-base font-bold tabular-nums ${color}`}>
          {value}{unit && <span className="text-xs text-white/40 font-normal ml-0.5">{unit}</span>}
          {trend}
        </p>
      </div>
      <p className="text-[9px] uppercase tracking-wider text-white/40 mt-0.5">{label}</p>
    </div>
  )
}

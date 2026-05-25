'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Plus, X, Loader2, Trash2, ChevronRight, ChevronLeft as CL, Dumbbell, Save } from 'lucide-react'
import { supabase, getCurrentUserId } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type ProgEx = { name: string; sets: number; weight_lb: number; reps: number; prog: 'weight' | 'reps'; inc: number }
type ProgDay = { label: string; exercises: ProgEx[] }
type Plan = { days: ProgDay[] }
type Program = { id: string; name: string; weeks: number; current_week: number; plan: Plan }

function targetFor(ex: ProgEx, week: number) {
  const w = Math.max(0, week - 1)
  if (ex.prog === 'weight') return { sets: ex.sets, weight: ex.weight_lb + w * ex.inc, reps: ex.reps }
  return { sets: ex.sets, weight: ex.weight_lb, reps: ex.reps + w * ex.inc }
}

export default function ProgramPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [program, setProgram] = useState<Program | null>(null)
  const [building, setBuilding] = useState(false)
  const [saving, setSaving] = useState(false)

  // builder state
  const [name, setName] = useState('My Mesocycle')
  const [weeks, setWeeks] = useState(6)
  const [days, setDays] = useState<ProgDay[]>([{ label: 'Day 1', exercises: [] }])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const uid = await getCurrentUserId()
    if (!uid) { router.push('/login?redirect=/program'); return }
    const { data } = await supabase.from('workout_programs').select('id, name, weeks, current_week, plan').eq('user_id', uid).eq('active', true).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (data) setProgram(data as Program)
    setLoading(false)
  }

  async function saveProgram() {
    setSaving(true)
    try {
      const uid = await getCurrentUserId()
      if (!uid) { router.push('/login?redirect=/program'); return }
      // deactivate existing
      await supabase.from('workout_programs').update({ active: false }).eq('user_id', uid).eq('active', true)
      const { error } = await supabase.from('workout_programs').insert({
        user_id: uid, name: name.trim() || 'My Mesocycle', weeks, current_week: 1,
        plan: { days: days.filter((d) => d.exercises.length > 0) },
      })
      if (error) throw new Error(error.message)
      setBuilding(false)
      await load()
    } catch { /* surfaced via reload */ } finally {
      setSaving(false)
    }
  }

  async function setWeek(w: number) {
    if (!program) return
    const nw = Math.max(1, Math.min(program.weeks, w))
    setProgram({ ...program, current_week: nw })
    await supabase.from('workout_programs').update({ current_week: nw, updated_at: new Date().toISOString() }).eq('id', program.id)
  }

  async function endProgram() {
    if (!program || !confirm('End this mesocycle? You can build a fresh one.')) return
    await supabase.from('workout_programs').update({ active: false }).eq('id', program.id)
    setProgram(null)
  }

  // builder helpers
  function addDay() { setDays((d) => [...d, { label: `Day ${d.length + 1}`, exercises: [] }]) }
  function removeDay(i: number) { setDays((d) => d.filter((_, idx) => idx !== i)) }
  function addEx(di: number) { setDays((d) => d.map((day, idx) => idx === di ? { ...day, exercises: [...day.exercises, { name: '', sets: 3, weight_lb: 0, reps: 10, prog: 'weight', inc: 5 }] } : day)) }
  function removeEx(di: number, ei: number) { setDays((d) => d.map((day, idx) => idx === di ? { ...day, exercises: day.exercises.filter((_, j) => j !== ei) } : day)) }
  function updEx(di: number, ei: number, patch: Partial<ProgEx>) {
    setDays((d) => d.map((day, idx) => idx === di ? { ...day, exercises: day.exercises.map((ex, j) => j === ei ? { ...ex, ...patch } : ex) } : day))
  }

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-amber-400" /></div>

  return (
    <div className="px-4 pt-6 pb-12 space-y-4">
      <Link href="/workout" className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1"><ChevronLeft size={12} /> Workout</Link>
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Program</h1>
        <p className="text-[11px] text-white/45 mt-0.5">Mesocycle with built-in progressive overload — the app tells you the numbers each week.</p>
      </div>

      {/* ===== Active program view ===== */}
      {program && !building && (
        <div className="space-y-3">
          <Card className="border-amber-400/25 bg-amber-400/[0.05]">
            <CardContent className="p-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white">{program.name}</p>
                  <p className="text-[11px] text-white/50">{program.plan.days.length} days/week · {program.weeks}-week block</p>
                </div>
                <button onClick={endProgram} className="text-[10px] uppercase tracking-wider text-rose-400/70 hover:text-rose-300">End</button>
              </div>
              <div className="flex items-center justify-between mt-3 bg-black/30 rounded-lg p-2">
                <button onClick={() => setWeek(program.current_week - 1)} disabled={program.current_week <= 1} className="p-1.5 rounded-md text-white/60 hover:text-white disabled:opacity-30"><CL size={16} /></button>
                <p className="text-sm font-bold text-amber-300 tabular-nums">Week {program.current_week} <span className="text-white/40 font-normal">of {program.weeks}</span></p>
                <button onClick={() => setWeek(program.current_week + 1)} disabled={program.current_week >= program.weeks} className="p-1.5 rounded-md text-white/60 hover:text-white disabled:opacity-30"><ChevronRight size={16} /></button>
              </div>
            </CardContent>
          </Card>

          {program.plan.days.map((day, di) => (
            <Card key={di} className="border-white/10 bg-white/5">
              <CardContent className="p-3">
                <p className="text-sm font-bold text-white flex items-center gap-1.5 mb-2"><Dumbbell size={13} className="text-amber-400" /> {day.label}</p>
                <div className="space-y-1.5">
                  {day.exercises.map((ex, ei) => {
                    const t = targetFor(ex, program.current_week)
                    return (
                      <div key={ei} className="flex items-center justify-between rounded-md bg-white/[0.03] border border-white/10 px-2.5 py-2">
                        <span className="text-xs text-white/85">{ex.name}</span>
                        <span className="text-xs tabular-nums text-amber-200 font-semibold">{t.sets} × {t.reps} @ {t.weight}lb</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
          <p className="text-[10px] text-white/35 text-center">Targets auto-progress each week ({'+'}weight or {'+'}reps per exercise). Bump the week when you start a new training week.</p>
        </div>
      )}

      {/* ===== No program ===== */}
      {!program && !building && (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-4 space-y-2 text-center">
            <p className="text-sm font-bold text-white">No active program</p>
            <p className="text-xs text-white/60 leading-relaxed">Build a mesocycle: pick your days, movements, and starting numbers. Vitals progresses the weight/reps for you each week so you actually overload.</p>
            <Button onClick={() => setBuilding(true)} className="bg-amber-400 text-black hover:bg-amber-300 font-semibold mt-1"><Plus size={15} className="mr-1" /> Build a program</Button>
          </CardContent>
        </Card>
      )}

      {/* ===== Builder ===== */}
      {building && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-[10px] uppercase tracking-wider text-white/40">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-2 py-2 text-sm focus:outline-none focus:border-amber-400/50" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/40">Weeks</label>
              <input type="number" min={2} max={12} value={weeks} onChange={(e) => setWeeks(Math.max(2, Math.min(12, Number(e.target.value) || 6)))} className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-2 py-2 text-sm tabular-nums focus:outline-none focus:border-amber-400/50" />
            </div>
          </div>

          {days.map((day, di) => (
            <Card key={di} className="border-white/10 bg-white/5">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input value={day.label} onChange={(e) => setDays((d) => d.map((dd, idx) => idx === di ? { ...dd, label: e.target.value } : dd))} placeholder="Day label (e.g. Chest/Tri)" className="flex-1 bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-sm font-semibold focus:outline-none focus:border-amber-400/50" />
                  <button onClick={() => removeDay(di)} className="text-white/30 hover:text-rose-400 p-1"><Trash2 size={14} /></button>
                </div>
                {day.exercises.map((ex, ei) => (
                  <div key={ei} className="rounded-lg border border-white/10 bg-black/20 p-2 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input value={ex.name} onChange={(e) => updEx(di, ei, { name: e.target.value })} placeholder="Exercise (e.g. Flat bench)" className="flex-1 bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-amber-400/50" />
                      <button onClick={() => removeEx(di, ei)} className="text-white/30 hover:text-rose-400 p-1"><X size={12} /></button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <NumF label="Sets" value={ex.sets} onChange={(v) => updEx(di, ei, { sets: v })} />
                      <NumF label="Weight" value={ex.weight_lb} onChange={(v) => updEx(di, ei, { weight_lb: v })} />
                      <NumF label="Reps" value={ex.reps} onChange={(v) => updEx(di, ei, { reps: v })} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] uppercase tracking-wider text-white/40">Progress weekly by</span>
                      <button onClick={() => updEx(di, ei, { prog: 'weight', inc: 5 })} className={`text-[10px] px-2 py-0.5 rounded-full border ${ex.prog === 'weight' ? 'bg-amber-400/20 border-amber-400/50 text-amber-200' : 'border-white/10 text-white/50'}`}>+weight</button>
                      <button onClick={() => updEx(di, ei, { prog: 'reps', inc: 1 })} className={`text-[10px] px-2 py-0.5 rounded-full border ${ex.prog === 'reps' ? 'bg-amber-400/20 border-amber-400/50 text-amber-200' : 'border-white/10 text-white/50'}`}>+reps</button>
                      <input type="number" value={ex.inc} onChange={(e) => updEx(di, ei, { inc: Number(e.target.value) || 0 })} className="w-12 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[11px] tabular-nums text-center focus:outline-none focus:border-amber-400/50" />
                      <span className="text-[9px] text-white/40">{ex.prog === 'weight' ? 'lb/wk' : 'rep/wk'}</span>
                    </div>
                  </div>
                ))}
                <button onClick={() => addEx(di)} className="w-full text-[11px] py-1.5 rounded-md border border-dashed border-white/15 text-white/50 hover:text-amber-300 hover:border-amber-400/30">+ Add exercise</button>
              </CardContent>
            </Card>
          ))}

          <button onClick={addDay} className="w-full text-xs py-2 rounded-lg border border-dashed border-white/15 text-white/60 hover:text-amber-300 hover:border-amber-400/30">+ Add training day</button>

          <div className="flex gap-2">
            <Button onClick={() => setBuilding(false)} variant="outline" className="flex-1 border-white/20 text-white/70">Cancel</Button>
            <Button onClick={saveProgram} disabled={saving || days.every((d) => d.exercises.length === 0)} className="flex-1 bg-amber-400 text-black hover:bg-amber-300 font-semibold disabled:opacity-40">
              {saving ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Save size={14} className="mr-1" />} Save program
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function NumF({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-[9px] uppercase tracking-wider text-white/40">{label}</label>
      <input type="number" inputMode="decimal" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} className="w-full mt-0.5 bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-sm tabular-nums focus:outline-none focus:border-amber-400/50" />
    </div>
  )
}

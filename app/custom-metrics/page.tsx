'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, CustomMetricDef, getCurrentUserId } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sliders, Plus, X, Check } from 'lucide-react'

type LogRow = { id: string; metric_id: string; ts: string; value: number | null; value_bool: boolean | null }

export default function CustomMetricsPage() {
  const router = useRouter()
  const [defs, setDefs] = useState<CustomMetricDef[]>([])
  const [recentLogs, setRecentLogs] = useState<LogRow[]>([])
  const [adding, setAdding] = useState(false)
  const [logging, setLogging] = useState<CustomMetricDef | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const [defsRes, logsRes] = await Promise.all([
      supabase.from('custom_metrics_defs').select('*').eq('active', true).order('created_at', { ascending: false }),
      supabase.from('custom_metrics_log').select('*').order('ts', { ascending: false }).limit(60),
    ])
    if (defsRes.data) setDefs(defsRes.data as CustomMetricDef[])
    if (logsRes.data) setRecentLogs(logsRes.data as LogRow[])
  }

  async function createDef(d: CustomMetricDef) {
    setError(null)
    const userId = await getCurrentUserId()
    if (!userId) {
      router.push('/login?redirect=/custom-metrics')
      return
    }
    const { error: insErr } = await supabase.from('custom_metrics_defs').insert({ ...d, user_id: userId })
    if (insErr) {
      setError(insErr.message)
      return
    }
    setAdding(false)
    load()
  }

  async function quickLog(d: CustomMetricDef, value: number | null, valueBool: boolean | null) {
    setError(null)
    const userId = await getCurrentUserId()
    if (!userId) {
      router.push('/login?redirect=/custom-metrics')
      return
    }
    const { error: insErr } = await supabase.from('custom_metrics_log').insert({
      metric_id: d.id,
      value,
      value_bool: valueBool,
      user_id: userId,
    })
    if (insErr) {
      setError(insErr.message)
      return
    }
    setLogging(null)
    load()
  }

  function lastValue(metric_id: string) {
    return recentLogs.find(l => l.metric_id === metric_id)
  }

  return (
    <div className="px-4 pt-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sliders className="text-amber-400" size={24} /> Custom Metrics
          </h1>
          <p className="text-xs text-white/40 mt-0.5">Track anything you want</p>
        </div>
        <Button
          onClick={() => setAdding(true)}
          className="bg-amber-500/20 border border-amber-400/40 text-amber-300 hover:bg-amber-500/30"
        >
          <Plus size={16} /> New
        </Button>
      </div>

      {error && (
        <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-md p-2">
          {error}
        </div>
      )}

      {defs.length === 0 ? (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-6 text-center">
            <Sliders className="text-white/20 mx-auto mb-3" size={32} />
            <p className="text-sm text-white/60">No custom metrics yet.</p>
            <p className="text-xs text-white/40 mt-1 max-w-[260px] mx-auto">Add ones that matter to you: sleep quality, mood, joy, clarity, reading minutes, family-call yes/no.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {defs.map(d => {
            const last = lastValue(d.id!)
            return (
              <Card key={d.id} className="border-white/10 bg-white/5">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-[11px] text-white/50">
                      {d.frequency || 'as needed'} · {d.metric_type} {d.unit && `· ${d.unit}`}
                    </p>
                    {last && (
                      <p className="text-[10px] text-white/40 mt-0.5">
                        last: {last.value_bool !== null ? (last.value_bool ? 'yes' : 'no') : last.value}
                        {' · '}{new Date(last.ts).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={() => setLogging(d)}
                    className="bg-amber-500/20 border border-amber-400/40 text-amber-300 hover:bg-amber-500/30"
                  >
                    Log
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {adding && <DefEditor onSave={createDef} onClose={() => setAdding(false)} />}
      {logging && <QuickLogDialog def={logging} onLog={quickLog} onClose={() => setLogging(null)} />}
    </div>
  )
}

function DefEditor({ onSave, onClose }: { onSave: (d: CustomMetricDef) => void; onClose: () => void }) {
  const [d, setD] = useState<CustomMetricDef>({ name: '', unit: '', frequency: 'daily', metric_type: 'numeric', active: true })

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-end sm:items-center justify-center p-4">
      <Card className="border-white/10 bg-zinc-950 w-full max-w-md">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">New custom metric</h2>
            <button onClick={onClose}><X size={20} className="text-white/40" /></button>
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider">Name</label>
            <input
              value={d.name} onChange={e => setD({ ...d, name: e.target.value })}
              placeholder="Sleep quality, joy, bathroom count..."
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider">Type</label>
              <select
                value={d.metric_type} onChange={e => setD({ ...d, metric_type: e.target.value as CustomMetricDef['metric_type'] })}
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm"
              >
                <option value="numeric" className="bg-zinc-900">numeric</option>
                <option value="scale_1_10" className="bg-zinc-900">scale 1-10</option>
                <option value="boolean" className="bg-zinc-900">yes / no</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider">Frequency</label>
              <select
                value={d.frequency} onChange={e => setD({ ...d, frequency: e.target.value as CustomMetricDef['frequency'] })}
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm"
              >
                <option value="daily" className="bg-zinc-900">daily</option>
                <option value="weekly" className="bg-zinc-900">weekly</option>
                <option value="per_event" className="bg-zinc-900">per event</option>
              </select>
            </div>
          </div>
          {d.metric_type === 'numeric' && (
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider">Unit (optional)</label>
              <input
                value={d.unit} onChange={e => setD({ ...d, unit: e.target.value })}
                placeholder="minutes, hours, count, lbs..."
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm"
              />
            </div>
          )}
          <Button onClick={() => onSave(d)} disabled={!d.name} className="w-full bg-amber-400 text-black hover:bg-amber-300">
            Create metric
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function QuickLogDialog({ def, onLog, onClose }: {
  def: CustomMetricDef
  onLog: (d: CustomMetricDef, value: number | null, valueBool: boolean | null) => void
  onClose: () => void
}) {
  const [val, setVal] = useState<string>('')

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-end sm:items-center justify-center p-4">
      <Card className="border-white/10 bg-zinc-950 w-full max-w-md">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Log: {def.name}</h2>
            <button onClick={onClose}><X size={20} className="text-white/40" /></button>
          </div>
          {def.metric_type === 'boolean' ? (
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => onLog(def, null, true)} className="bg-green-500/20 border border-green-400/40 text-green-300 hover:bg-green-500/30 py-6">
                <Check size={20} /> Yes
              </Button>
              <Button onClick={() => onLog(def, null, false)} className="bg-rose-500/20 border border-rose-400/40 text-rose-300 hover:bg-rose-500/30 py-6">
                <X size={20} /> No
              </Button>
            </div>
          ) : def.metric_type === 'scale_1_10' ? (
            <div className="grid grid-cols-5 gap-2">
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <Button key={n} onClick={() => onLog(def, n, null)}
                  className="bg-white/5 border border-white/10 hover:bg-amber-400/20">{n}</Button>
              ))}
            </div>
          ) : (
            <>
              <input
                type="number" value={val} onChange={e => setVal(e.target.value)}
                placeholder={def.unit || 'Value'}
                className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm"
                autoFocus
              />
              <Button onClick={() => onLog(def, Number(val), null)} disabled={!val} className="w-full bg-amber-400 text-black">
                Log {val} {def.unit}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

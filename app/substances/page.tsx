'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Substance, SUBSTANCE_CATEGORY_COLORS, getCurrentUserId } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { FlaskConical, Plus, X, Calendar, AlertCircle } from 'lucide-react'
import { TIER_LIMITS } from '@/lib/tier'
import { InlineUpgradeCard } from '@/components/UpgradeBadge'

const CATEGORIES: Substance['category'][] = ['hormones', 'peptides', 'prescription', 'supplements', 'cognitive', 'custom']
const ROUTES = ['oral', 'IM', 'sub-Q', 'topical', 'sublingual', 'inhaled', 'other'] as const
const SOURCES = ['rx', 'research', 'otc', 'other'] as const

export default function SubstancesPage() {
  const router = useRouter()
  const [items, setItems] = useState<Substance[]>([])
  const [tier, setTier] = useState<'free' | 'pro' | 'premium'>('pro')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Substance | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const [subRes, profRes] = await Promise.all([
        supabase.from('substances').select('*').order('created_at', { ascending: false }),
        user
          ? supabase.from('user_profile').select('tier').eq('id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ])
      if (subRes.data) setItems(subRes.data as Substance[])
      if (profRes.data) setTier((profRes.data as { tier: 'free' | 'pro' | 'premium' }).tier)
    } catch {}
    setLoading(false)
  }

  async function saveSubstance(s: Substance) {
    setError(null)
    try {
      const userId = await getCurrentUserId()
      if (!userId) {
        router.push('/login?redirect=/substances')
        return
      }
      if (s.id) {
        const { error: updErr } = await supabase.from('substances').update(s).eq('id', s.id)
        if (updErr) throw new Error(updErr.message)
      } else {
        const { error: insErr } = await supabase.from('substances').insert({ ...s, user_id: userId })
        if (insErr) throw new Error(insErr.message)
      }
      setEditing(null)
      setAdding(false)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    }
  }

  async function deleteSubstance(id: string) {
    if (!confirm('Delete this substance?')) return
    setError(null)
    const { error: delErr } = await supabase.from('substances').delete().eq('id', id)
    if (delErr) {
      setError(delErr.message)
      return
    }
    setEditing(null)
    load()
  }

  const activeCount = items.filter(i => i.active !== false).length
  const limit = TIER_LIMITS[tier].maxSubstances
  const atLimit = activeCount >= limit
  const grouped = CATEGORIES.reduce<Record<string, Substance[]>>((acc, c) => {
    acc[c] = items.filter(i => i.category === c)
    return acc
  }, {})

  return (
    <div className="px-4 pt-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FlaskConical className="text-cyan-400" size={24} /> Stack
          </h1>
          <p className="text-xs text-white/40 mt-0.5">
            {activeCount} active{limit !== Infinity && ` / ${limit} (${tier} tier)`}
          </p>
        </div>
        <Button
          onClick={() => { setAdding(true); setEditing({ name: '', category: 'supplements', active: true }) }}
          disabled={atLimit}
          className="bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/30"
        >
          <Plus size={16} /> Add
        </Button>
      </div>

      {atLimit && tier === 'free' && (
        <InlineUpgradeCard
          title="Hit your 3-substance limit"
          description="Upgrade to Pro for unlimited substances, weekly AI rediagnosis, and bloodwork uploads."
        />
      )}

      {error && (
        <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-md p-2">
          {error}
        </div>
      )}

      {/* Timeline / Grid by category */}
      {!loading && CATEGORIES.map(cat => grouped[cat].length > 0 && (
        <div key={cat}>
          <p className="text-xs uppercase tracking-wider text-white/40 mb-2">{cat}</p>
          <div className="space-y-2">
            {grouped[cat].map(s => (
              <Card
                key={s.id}
                className={`border bg-white/5 cursor-pointer hover:bg-white/10 transition-colors ${SUBSTANCE_CATEGORY_COLORS[s.category]}`}
                onClick={() => setEditing(s)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm text-white">{s.name}</p>
                      <p className="text-[11px] text-white/50 mt-0.5">
                        {s.dose ? `${s.dose}${s.dose_unit || ''}` : ''} {s.frequency || ''} {s.route ? `· ${s.route}` : ''}
                      </p>
                      {s.source_flag && (
                        <Badge variant="outline" className="mt-1.5 border-white/20 text-[9px] py-0">
                          {s.source_flag}
                        </Badge>
                      )}
                    </div>
                    {s.active === false && (
                      <Badge variant="outline" className="border-white/20 text-[9px] py-0">stopped</Badge>
                    )}
                  </div>
                  {s.start_date && (
                    <p className="text-[10px] text-white/40 mt-1.5 flex items-center gap-1">
                      <Calendar size={10} />
                      {s.start_date}{s.stop_date ? ` → ${s.stop_date}` : ' → active'}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {!loading && items.length === 0 && (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-6 text-center">
            <FlaskConical className="text-white/20 mx-auto mb-3" size={32} />
            <p className="text-sm text-white/60">No substances tracked yet.</p>
            <p className="text-xs text-white/40 mt-1">Add your first one — hormones, peptides, Rx, supplements, etc.</p>
          </CardContent>
        </Card>
      )}

      {/* Edit / Add dialog */}
      {(editing || adding) && (
        <SubstanceEditor
          substance={editing!}
          onSave={saveSubstance}
          onDelete={editing?.id ? () => deleteSubstance(editing.id!) : undefined}
          onClose={() => { setEditing(null); setAdding(false) }}
        />
      )}
    </div>
  )
}

function SubstanceEditor({
  substance, onSave, onDelete, onClose,
}: {
  substance: Substance
  onSave: (s: Substance) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [s, setS] = useState<Substance>(substance)

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-end sm:items-center justify-center p-4">
      <Card className="border-white/10 bg-zinc-950 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">{s.id ? 'Edit' : 'New'} substance</h2>
            <button onClick={onClose} className="text-white/40 hover:text-white/80"><X size={20} /></button>
          </div>

          <Field label="Name" value={s.name} onChange={v => setS({ ...s, name: v })} placeholder="Testosterone Cypionate" />

          <div className="grid grid-cols-2 gap-2">
            <SelectField
              label="Category" value={s.category}
              options={CATEGORIES} onChange={v => setS({ ...s, category: v as Substance['category'] })}
            />
            <SelectField
              label="Route" value={s.route || ''}
              options={['', ...ROUTES] as string[]} onChange={v => setS({ ...s, route: v as Substance['route'] })}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Dose" type="number" value={s.dose?.toString() || ''} onChange={v => setS({ ...s, dose: v ? Number(v) : undefined })} placeholder="100" />
            <Field label="Unit" value={s.dose_unit || ''} onChange={v => setS({ ...s, dose_unit: v })} placeholder="mg" />
          </div>

          <Field label="Frequency" value={s.frequency || ''} onChange={v => setS({ ...s, frequency: v })} placeholder="2x/week" />

          <div className="grid grid-cols-2 gap-2">
            <Field label="Start date" type="date" value={s.start_date || ''} onChange={v => setS({ ...s, start_date: v })} />
            <Field label="Stop date" type="date" value={s.stop_date || ''} onChange={v => setS({ ...s, stop_date: v })} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <SelectField
              label="Source" value={s.source_flag || ''}
              options={['', ...SOURCES] as string[]} onChange={v => setS({ ...s, source_flag: v as Substance['source_flag'] })}
            />
            <Field label="Site rotation" value={s.site_rotation || ''} onChange={v => setS({ ...s, site_rotation: v })} placeholder="L glute / R glute" />
          </div>

          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider">Notes</label>
            <Textarea
              value={s.notes || ''}
              onChange={e => setS({ ...s, notes: e.target.value })}
              className="bg-white/5 border-white/10 mt-1"
              placeholder="Side effects, reason for use, source, etc."
            />
          </div>

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              className="accent-amber-400"
              checked={s.active !== false}
              onChange={e => setS({ ...s, active: e.target.checked })}
            />
            <span>Currently active</span>
          </label>

          <div className="flex items-center gap-2 pt-2 border-t border-white/10">
            {onDelete && (
              <Button variant="ghost" onClick={onDelete} className="text-rose-400 hover:bg-rose-500/10">
                <AlertCircle size={14} /> Delete
              </Button>
            )}
            <Button
              onClick={() => onSave(s)}
              disabled={!s.name || !s.category}
              className="ml-auto bg-cyan-400 text-black hover:bg-cyan-300"
            >
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="text-xs text-white/50 uppercase tracking-wider">{label}</label>
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-cyan-400/50"
      />
    </div>
  )
}

function SelectField({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="text-xs text-white/50 uppercase tracking-wider">{label}</label>
      <select
        value={value} onChange={e => onChange(e.target.value)}
        className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-cyan-400/50"
      >
        {options.map(o => <option key={o} value={o} className="bg-zinc-900">{o || '—'}</option>)}
      </select>
    </div>
  )
}

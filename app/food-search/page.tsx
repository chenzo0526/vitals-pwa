'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, getCurrentUserId } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Search, ChevronLeft, Loader2, Check, Plus, Minus, X, AlertTriangle, Flame, Beef, Wheat, Droplet,
} from 'lucide-react'
import { useToast } from '@/components/Toast'
import { celebrate } from '@/lib/celebrate'
import { resolveLogDate, readDateParamFromUrl } from '@/lib/logDate'
import LogDateBanner from '@/components/LogDateBanner'

type FoodResult = {
  fdc_id: number
  name: string
  brand: string | null
  category: string | null
  per_amount: string
  is_branded_serving: boolean
  estimated?: boolean
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  sugar_g: number
  sodium_mg: number
  water_ml: number
}

export default function FoodSearchPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoodResult[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<FoodResult | null>(null)
  const [servings, setServings] = useState<number>(1)
  const [logging, setLogging] = useState(false)
  const [logCtx] = useState(() => resolveLogDate(readDateParamFromUrl()))
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim() || query.trim().length < 2) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(() => doSearch(query.trim()), 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  async function doSearch(q: string) {
    setSearching(true)
    setError(null)
    try {
      const res = await fetch(`/api/search-food?q=${encodeURIComponent(q)}&limit=12`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Search failed')
      setResults(data.results || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  async function logItem() {
    if (!selected) return
    setLogging(true)
    try {
      const userId = await getCurrentUserId()
      if (!userId) {
        router.push('/login?redirect=/food-search')
        return
      }
      const mult = Math.max(0.1, servings || 1)
      const { error: insErr } = await supabase.from('intake_events').insert({
        user_id: userId,
        ts: logCtx.ts,
        item: selected.name,
        qty_text: `${servings} × ${selected.per_amount}`,
        calories: Math.round(selected.calories * mult),
        protein_g: Math.round(selected.protein_g * mult * 10) / 10,
        carbs_g: Math.round(selected.carbs_g * mult * 10) / 10,
        fat_g: Math.round(selected.fat_g * mult * 10) / 10,
        water_ml: Math.round(selected.water_ml * mult),
        parsed_by: 'usda-search',
        raw_input: `usda:${selected.fdc_id}`,
      })
      if (insErr) throw new Error(insErr.message)
      toast({ kind: 'success', title: 'Logged', text: selected.name })
      celebrate.food()
      setTimeout(() => router.push('/'), 900)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Log failed')
    } finally {
      setLogging(false)
    }
  }

  return (
    <div className="px-4 pt-6 pb-12 space-y-4">
      <Link href="/" className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1">
        <ChevronLeft size={12} /> Home
      </Link>
      <LogDateBanner dateStr={logCtx.dateStr} isToday={logCtx.isToday} />

      <div>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Search className="text-emerald-400" size={20} /> Search foods
        </h1>
        <p className="text-[11px] text-white/50 mt-0.5">USDA database · branded + generic foods · per 100g or per serving</p>
      </div>

      {/* Search input */}
      <Card className="border-white/10 bg-white/5">
        <CardContent className="p-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="chicken breast, oatmeal, trader joe's spinach ravioli..."
              className="w-full bg-black/30 border border-white/10 rounded-md pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:border-emerald-400/50"
            />
            {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-emerald-400" />}
            {!searching && query && (
              <button onClick={() => { setQuery(''); setResults([]) }} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80">
                <X size={14} />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-md p-2 flex items-start gap-1.5">
          <AlertTriangle size={12} className="mt-0.5" /> <span>{error}</span>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && !selected && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-white/40">{results.length} matches</p>
          {results.map((r) => (
            <button
              key={r.fdc_id}
              onClick={() => { setSelected(r); setServings(1) }}
              className="w-full text-left rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-emerald-400/30 transition-colors p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">{r.name}
                    {r.estimated && <span className="ml-1.5 text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-violet-400/15 border border-violet-400/30 text-violet-300 align-middle">≈ AI estimate</span>}
                  </p>
                  <p className="text-[10px] text-white/40 mt-0.5">
                    Per {r.per_amount}
                    {r.category && ` · ${r.category}`}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <Badge variant="outline" className="border-amber-400/30 text-amber-300 text-[10px] py-0">{r.calories} kcal</Badge>
                    <Badge variant="outline" className="border-cyan-400/30 text-cyan-300 text-[10px] py-0">P {r.protein_g}g</Badge>
                    <Badge variant="outline" className="border-violet-400/30 text-violet-300 text-[10px] py-0">C {r.carbs_g}g</Badge>
                    <Badge variant="outline" className="border-rose-400/30 text-rose-300 text-[10px] py-0">F {r.fat_g}g</Badge>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {results.length === 0 && !searching && query.length >= 2 && !error && (
        <p className="text-[11px] text-white/40 text-center py-4">No matches.</p>
      )}

      {/* Selected food — quantity + log */}
      {selected && (
        <Card className="border-emerald-400/30 bg-emerald-500/[0.05]">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white">{selected.name}</p>
                <p className="text-[10px] text-white/40 mt-0.5">Per {selected.per_amount}{selected.category && ` · ${selected.category}`}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-white/40 hover:text-white/80">
                <X size={16} />
              </button>
            </div>

            {/* Servings stepper */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">Servings ({selected.per_amount} each)</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setServings((s) => Math.max(0.25, Math.round((s - 0.25) * 100) / 100))}
                  className="w-10 h-10 rounded-md bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 flex items-center justify-center"
                >
                  <Minus size={16} />
                </button>
                <input
                  type="number"
                  step="0.25"
                  value={servings}
                  onChange={(e) => setServings(Number(e.target.value) || 1)}
                  className="flex-1 bg-black/30 border border-white/10 rounded-md px-3 py-2 text-center text-base font-bold tabular-nums focus:outline-none focus:border-emerald-400/50"
                />
                <button
                  onClick={() => setServings((s) => Math.round((s + 0.25) * 100) / 100)}
                  className="w-10 h-10 rounded-md bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 flex items-center justify-center"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Computed totals */}
            <div className="grid grid-cols-4 gap-2 bg-black/20 rounded-md p-2 border border-white/5">
              <Totals icon={Flame} label="kcal" value={Math.round(selected.calories * servings)} color="text-amber-300" />
              <Totals icon={Beef} label="P" unit="g" value={Math.round(selected.protein_g * servings * 10) / 10} color="text-cyan-300" />
              <Totals icon={Wheat} label="C" unit="g" value={Math.round(selected.carbs_g * servings * 10) / 10} color="text-violet-300" />
              <Totals icon={Droplet} label="F" unit="g" value={Math.round(selected.fat_g * servings * 10) / 10} color="text-rose-300" />
            </div>

            <Button
              onClick={logItem}
              disabled={logging}
              className="w-full bg-emerald-400 text-black hover:bg-emerald-300 font-bold h-12 disabled:opacity-50"
            >
              {logging ? <><Loader2 size={14} className="mr-2 animate-spin" /> Logging</> : <><Check size={14} className="mr-2" /> Log to today</>}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Totals({ icon: Icon, label, value, unit, color }: { icon: typeof Flame; label: string; value: number; unit?: string; color: string }) {
  return (
    <div className="text-center">
      <Icon size={10} className={`${color} mx-auto`} />
      <p className={`text-sm font-bold tabular-nums ${color}`}>{value}{unit && <span className="text-[9px] font-normal opacity-60 ml-0.5">{unit}</span>}</p>
      <p className="text-[9px] uppercase tracking-wider text-white/40">{label}</p>
    </div>
  )
}

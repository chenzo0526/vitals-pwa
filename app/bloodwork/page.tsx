'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, BloodworkPanel, BloodworkMarker, Substance, getCurrentUserId } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Droplet, Upload, Camera, Loader2, X, AlertTriangle, TrendingUp } from 'lucide-react'
import { TIER_LIMITS } from '@/lib/tier'
import { InlineUpgradeCard } from '@/components/UpgradeBadge'
import Disclaimer from '@/components/Disclaimer'

type MarkerWithDate = BloodworkMarker & { panel_ts?: string }

const CATEGORY_LABELS: Record<string, string> = {
  hormones: 'Hormones',
  metabolic: 'Metabolic',
  lipids: 'Lipids',
  cbc: 'CBC',
  thyroid: 'Thyroid',
  vitamins: 'Vitamins',
  liver: 'Liver',
  kidney: 'Kidney',
  inflammation: 'Inflammation',
  other: 'Other',
}

export default function BloodworkPage() {
  const router = useRouter()
  const [panels, setPanels] = useState<BloodworkPanel[]>([])
  const [markersByCategory, setMarkersByCategory] = useState<Record<string, MarkerWithDate[]>>({})
  const [activeSubstances, setActiveSubstances] = useState<Substance[]>([])
  const [tier, setTier] = useState<'free' | 'pro' | 'premium'>('pro')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const [panelsRes, markersRes, subsRes, profRes] = await Promise.all([
        supabase.from('bloodwork_panels').select('*').order('ts', { ascending: false }),
        supabase.from('bloodwork_markers').select('*, bloodwork_panels(ts)').order('panel_id'),
        supabase.from('substances').select('*').eq('active', true),
        user
          ? supabase.from('user_profile').select('tier').eq('id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ])
      if (panelsRes.data) setPanels(panelsRes.data as BloodworkPanel[])
      if (subsRes.data) setActiveSubstances(subsRes.data as Substance[])
      if (profRes.data) setTier((profRes.data as { tier: 'free' | 'pro' | 'premium' }).tier)
      if (markersRes.data) {
        const byCategory: Record<string, MarkerWithDate[]> = {}
        for (const m of markersRes.data as Array<BloodworkMarker & { bloodwork_panels?: { ts: string } }>) {
          const cat = m.category || 'other'
          if (!byCategory[cat]) byCategory[cat] = []
          byCategory[cat].push({ ...m, panel_ts: m.bloodwork_panels?.ts })
        }
        setMarkersByCategory(byCategory)
      }
    } catch (e) {
      console.error(e)
    }
  }

  async function handleUpload(file: File) {
    if (tier === 'free') {
      setError('Bloodwork uploads require a Pro plan.')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const userId = await getCurrentUserId()
      if (!userId) {
        router.push('/login?redirect=/bloodwork')
        return
      }
      const base64 = await fileToBase64(file)
      const mediaType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
      const res = await fetch('/api/parse-bloodwork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Parse failed')

      const panelRes = await supabase.from('bloodwork_panels').insert({
        source_format: 'photo',
        panel_name: data.panel_name || 'Imported panel',
        lab_provider: data.lab_provider || null,
        drawn_on: data.drawn_on || null,
        user_id: userId,
      }).select().single()

      if (panelRes.error) throw new Error(panelRes.error.message)

      if (panelRes.data && data.markers?.length) {
        const panel_id = panelRes.data.id
        const rows = data.markers.map((m: BloodworkMarker) => ({
          panel_id,
          user_id: userId,
          marker: m.marker,
          category: m.category,
          value: m.value,
          unit: m.unit,
          ref_low: m.ref_low,
          ref_high: m.ref_high,
          flag: m.flag,
          raw_text: m.raw_text,
        }))
        const { error: mErr } = await supabase.from('bloodwork_markers').insert(rows)
        if (mErr) throw new Error(mErr.message)
      }
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  // Cross-reference active substances → relevant markers to watch
  const watchlist = buildWatchlist(activeSubstances)
  const limits = TIER_LIMITS[tier]

  return (
    <div className="px-4 pt-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Droplet className="text-rose-400" size={24} /> Bloodwork
        </h1>
        <p className="text-xs text-white/40">
          {panels.length} panel{panels.length !== 1 ? 's' : ''}
        </p>
      </div>

      {tier === 'free' ? (
        <InlineUpgradeCard
          title="Bloodwork upload requires Pro"
          description="Pro includes AI extraction from PDFs/photos, marker trend tracking, and 3 panels per year. Premium = unlimited."
        />
      ) : (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs text-white/60">
              Upload PDF, lab photo, or enter manually. AI extracts every marker, value, unit, and flag.
            </p>
            <div className="flex gap-2">
              <input
                ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
                onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])}
              />
              <Button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="bg-rose-500/20 border border-rose-400/40 text-rose-300 hover:bg-rose-500/30 flex-1"
              >
                {uploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                {uploading ? 'Parsing…' : 'Upload'}
              </Button>
              <Button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="bg-violet-500/20 border border-violet-400/40 text-violet-300 hover:bg-violet-500/30"
              >
                <Camera size={16} />
              </Button>
            </div>
            {error && (
              <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-md p-2 flex items-start gap-1.5">
                <AlertTriangle size={12} className="mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <p className="text-[10px] text-white/30">
              Tier limit: {limits.bloodworkUploadsPerYear === Infinity ? 'unlimited' : `${limits.bloodworkUploadsPerYear}/yr`}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Watchlist from substances */}
      {watchlist.length > 0 && (
        <Card className="border-amber-400/20 bg-amber-400/5">
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-amber-400 mb-1.5 flex items-center gap-1">
              <TrendingUp size={11} /> Watch list (from your stack)
            </p>
            <div className="flex flex-wrap gap-1">
              {watchlist.map(w => (
                <Badge key={w} variant="outline" className="border-amber-400/30 text-amber-200 text-[10px]">{w}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Panels list */}
      {panels.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-white/40 mb-2">Panels</p>
          <div className="space-y-2">
            {panels.map(p => (
              <Card key={p.id} className="border-white/10 bg-white/5">
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{p.panel_name || 'Untitled panel'}</p>
                    <p className="text-[11px] text-white/50">
                      {p.drawn_on || (p.ts ? new Date(p.ts).toLocaleDateString() : '')}
                      {p.lab_provider && ` · ${p.lab_provider}`}
                    </p>
                  </div>
                  <Badge variant="outline" className="border-white/20 text-[10px]">{p.source_format}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Markers by category */}
      {Object.entries(markersByCategory).map(([cat, markers]) => (
        <div key={cat}>
          <p className="text-xs uppercase tracking-wider text-white/40 mb-2">{CATEGORY_LABELS[cat] || cat}</p>
          <div className="space-y-1.5">
            {dedupeLatest(markers).map(m => <MarkerRow key={`${m.marker}-${m.panel_id}`} marker={m} allByName={markers.filter(x => x.marker === m.marker)} />)}
          </div>
        </div>
      ))}

      {panels.length === 0 && (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-6 text-center">
            <Droplet className="text-white/20 mx-auto mb-3" size={32} />
            <p className="text-sm text-white/60">No bloodwork yet.</p>
            <p className="text-xs text-white/40 mt-1">Upload a lab PDF or photo to get started.</p>
          </CardContent>
        </Card>
      )}

      {panels.length > 0 && <Disclaimer />}
    </div>
  )
}

function MarkerRow({ marker, allByName }: { marker: MarkerWithDate; allByName: MarkerWithDate[] }) {
  const flagColor = {
    low: 'text-blue-300 bg-blue-500/10 border-blue-400/30',
    normal: 'text-green-300 bg-green-500/10 border-green-400/30',
    high: 'text-amber-300 bg-amber-500/10 border-amber-400/30',
    critical: 'text-rose-300 bg-rose-500/10 border-rose-400/30',
  }[marker.flag || 'normal']

  const trend = allByName.length >= 2 ? renderSparkline(allByName) : null

  return (
    <Card className="border-white/10 bg-white/5">
      <CardContent className="p-3 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{marker.marker}</p>
          <p className="text-[11px] text-white/40">
            ref: {marker.ref_low ?? '—'} – {marker.ref_high ?? '—'} {marker.unit || ''}
          </p>
        </div>
        {trend}
        <div className="text-right ml-3">
          <p className={`text-sm font-bold inline-block px-2 py-0.5 rounded border ${flagColor}`}>
            {marker.value} <span className="font-normal opacity-60 text-xs">{marker.unit}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function renderSparkline(history: MarkerWithDate[]) {
  const sorted = [...history].sort((a, b) => (a.panel_ts || '').localeCompare(b.panel_ts || ''))
  const vals = sorted.map(h => h.value || 0)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 1
  const points = vals.map((v, i) => `${(i / (vals.length - 1)) * 40},${20 - ((v - min) / range) * 16}`).join(' ')
  return (
    <svg width="44" height="22" className="text-cyan-400 mx-2 flex-shrink-0">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function dedupeLatest(markers: MarkerWithDate[]): MarkerWithDate[] {
  const map = new Map<string, MarkerWithDate>()
  for (const m of markers) {
    const existing = map.get(m.marker)
    if (!existing || (m.panel_ts || '') > (existing.panel_ts || '')) {
      map.set(m.marker, m)
    }
  }
  return Array.from(map.values())
}

function buildWatchlist(subs: Substance[]): string[] {
  const watch = new Set<string>()
  for (const s of subs) {
    const n = s.name.toLowerCase()
    if (s.category === 'hormones' || n.includes('test') || n.includes('cyp') || n.includes('estradiol')) {
      watch.add('Total T'); watch.add('Free T'); watch.add('E2'); watch.add('HCT'); watch.add('Lipids')
    }
    if (n.includes('hcg')) watch.add('LH'); watch.add('FSH')
    if (s.category === 'peptides' || n.includes('bpc') || n.includes('tb-500') || n.includes('cjc')) {
      watch.add('IGF-1')
    }
    if (n.includes('thyroid') || n.includes('t3') || n.includes('t4') || n.includes('levo')) {
      watch.add('TSH'); watch.add('Free T3'); watch.add('Free T4')
    }
    if (n.includes('metformin')) watch.add('A1C')
  }
  return Array.from(watch)
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

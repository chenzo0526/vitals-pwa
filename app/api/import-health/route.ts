import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Apple Health / wearable import endpoint.
// User configures the Health Auto Export iOS app (or any equivalent) to POST JSON here with their token in the X-Vitals-Token header.
//
// Accepts two shapes:
//
// 1. Health Auto Export "Aggregated" JSON shape:
//    {
//      "data": {
//        "metrics": [
//          { "name": "heart_rate_variability", "units": "ms", "data": [{ "date": "2026-05-18 03:00:00", "qty": 62.3 }] },
//          { "name": "resting_heart_rate", "units": "count/min", "data": [{ "date": "...", "qty": 58 }] },
//          { "name": "sleep_analysis", "data": [{ "startDate": "...", "endDate": "...", "value": "Asleep" }] },
//          { "name": "step_count", "data": [{ "date": "...", "qty": 8421 }] },
//          ...
//        ]
//      }
//    }
//
// 2. Simple direct shape (anyone scripting their own import):
//    {
//      "entries": [
//        { "for_date": "2026-05-18", "source": "apple_health", "hrv_rmssd": 62.3, "rhr_bpm": 58, "sleep_total_min": 480, "steps": 8421 }
//      ]
//    }
//
// Each entry upserts into biometric_entries on (user_id, for_date, source).

type HAEMetric = {
  name: string
  units?: string
  data?: Array<{
    date?: string
    startDate?: string
    endDate?: string
    qty?: number
    value?: string | number
    Avg?: number
    Max?: number
    Min?: number
  }>
}

type DirectEntry = {
  for_date: string
  source?: string
  hrv_rmssd?: number
  rhr_bpm?: number
  sleep_total_min?: number
  sleep_deep_min?: number
  sleep_rem_min?: number
  sleep_light_min?: number
  sleep_awake_min?: number
  sleep_efficiency_pct?: number
  steps?: number
  active_calories?: number
  total_calories?: number
  recovery_score?: number
  strain_score?: number
  readiness_score?: number
  body_temp_c?: number
  spo2_pct?: number
  respiratory_rate?: number
  notes?: string
}

type ImportPayload = {
  data?: { metrics?: HAEMetric[] }
  entries?: DirectEntry[]
}

function toLocalDate(isoOrSpaceDate: string): string {
  // Health Auto Export uses "YYYY-MM-DD HH:MM:SS" with no timezone. We trust the device's local time.
  // Extract just the date portion.
  return isoOrSpaceDate.split(' ')[0].split('T')[0]
}

function normalizeHAE(metrics: HAEMetric[]): DirectEntry[] {
  // Aggregate metrics by date.
  const byDate = new Map<string, DirectEntry>()
  function get(d: string): DirectEntry {
    if (!byDate.has(d)) byDate.set(d, { for_date: d, source: 'apple_health' })
    return byDate.get(d)!
  }

  for (const metric of metrics) {
    if (!metric?.data) continue
    const name = (metric.name || '').toLowerCase()
    for (const point of metric.data) {
      const rawDate = point.date || point.startDate
      if (!rawDate) continue
      const d = toLocalDate(rawDate)
      const entry = get(d)
      const qty = point.qty ?? point.Avg

      if (name.includes('heart_rate_variability') || name === 'hrv' || name.includes('heart rate variability')) {
        if (qty != null) entry.hrv_rmssd = Number(qty)
      } else if (name.includes('resting_heart_rate') || name === 'rhr' || name.includes('resting heart rate')) {
        if (qty != null) entry.rhr_bpm = Math.round(Number(qty))
      } else if (name === 'sleep_analysis' || name.includes('sleep')) {
        // Sum sleep duration if startDate/endDate provided
        if (point.startDate && point.endDate) {
          const start = new Date(point.startDate.replace(' ', 'T'))
          const end = new Date(point.endDate.replace(' ', 'T'))
          const min = Math.round((end.getTime() - start.getTime()) / 60000)
          if (min > 0 && min < 1440) {
            entry.sleep_total_min = (entry.sleep_total_min || 0) + min
          }
        } else if (qty != null) {
          // HAE sometimes gives total in hours via qty
          entry.sleep_total_min = Math.round(Number(qty) * 60)
        }
      } else if (name === 'step_count' || name === 'steps') {
        if (qty != null) entry.steps = (entry.steps || 0) + Math.round(Number(qty))
      } else if (name === 'active_energy' || name.includes('active energy')) {
        // Active burn counts toward BOTH active_calories and total daily energy.
        if (qty != null) {
          const v = Math.round(Number(qty))
          entry.active_calories = (entry.active_calories || 0) + v
          entry.total_calories = (entry.total_calories || 0) + v
        }
      } else if (name === 'basal_energy_burned' || name.includes('basal energy') || name.includes('resting energy')) {
        // Basal/resting burn is the other half of total daily energy (TDEE = active + basal).
        if (qty != null) entry.total_calories = (entry.total_calories || 0) + Math.round(Number(qty))
      } else if (name === 'respiratory_rate') {
        if (qty != null) entry.respiratory_rate = Number(qty)
      } else if (name === 'blood_oxygen_saturation' || name === 'oxygen_saturation' || name.includes('spo2')) {
        if (qty != null) entry.spo2_pct = Math.round(Number(qty) * (Number(qty) < 2 ? 100 : 1))
      } else if (name === 'body_temperature' || name.includes('body temp')) {
        if (qty != null) entry.body_temp_c = Number(qty)
      }
    }
  }

  return Array.from(byDate.values())
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('x-vitals-token') || new URL(req.url).searchParams.get('token')
    if (!token) {
      return NextResponse.json({ error: 'Missing X-Vitals-Token header or ?token= query' }, { status: 401 })
    }

    const payload = await req.json() as ImportPayload

    let entries: DirectEntry[] = []
    if (payload.entries && Array.isArray(payload.entries)) {
      entries = payload.entries
    } else if (payload.data?.metrics && Array.isArray(payload.data.metrics)) {
      entries = normalizeHAE(payload.data.metrics)
    } else {
      return NextResponse.json({ error: 'Payload must include either "entries" or "data.metrics"' }, { status: 400 })
    }

    if (entries.length === 0) {
      return NextResponse.json({ ok: true, imported: 0, message: 'No data in payload' })
    }

    // Write via a SECURITY DEFINER RPC. The function validates the token, resolves the
    // user, and upserts — all server-side with elevated privileges — so this route only
    // needs the public anon key (no SUPABASE_SERVICE_ROLE_KEY env dependency).
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { data: rpcData, error: rpcErr } = await supabase.rpc('import_biometrics', {
      p_token: token,
      p_entries: entries,
    })

    if (rpcErr) {
      console.error('[import-health] rpc failed:', rpcErr.message)
      return NextResponse.json({ error: rpcErr.message }, { status: 500 })
    }

    const result = (rpcData || {}) as { error?: string; imported?: number; failed?: number }
    if (result.error) {
      // Invalid/missing token surfaces here from the function.
      const status = result.error.toLowerCase().includes('token') ? 401 : 400
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({
      ok: true,
      imported: result.imported ?? 0,
      failed: result.failed ?? 0,
      total: entries.length,
    })
  } catch (err) {
    console.error('[import-health] error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Import failed' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: '/api/import-health',
    method: 'POST',
    auth: 'X-Vitals-Token header OR ?token= query param',
    payload_shapes: ['{ data: { metrics: [...] } }  // Health Auto Export', '{ entries: [{ for_date, hrv_rmssd, rhr_bpm, sleep_total_min, ... }] }'],
  })
}

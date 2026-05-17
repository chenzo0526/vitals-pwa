import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generateBloodworkInterpretation } from '@/lib/claude'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Bloodwork Interpreter v2 — generates a forensic per-panel read using ALL the user's context.
// Cost is ~$0.05/call. Cached per panel — user can re-generate when their context changes.
// Body: { panel_id: string, refresh?: boolean }
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
            } catch { /* server component context */ }
          },
        },
      },
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const userId = user.id

    const body = await req.json()
    const panelId: string | undefined = body?.panel_id
    const refresh: boolean = body?.refresh === true
    if (!panelId) return NextResponse.json({ error: 'panel_id required' }, { status: 400 })

    // Cache check — most recent interpretation for this panel
    if (!refresh) {
      const { data: cached } = await supabase
        .from('bloodwork_interpretations')
        .select('*')
        .eq('panel_id', panelId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cached) {
        return NextResponse.json({
          cached: true,
          generated_at: cached.created_at,
          interpretation: cached.interpretation,
          context_summary: cached.context_summary,
        })
      }
    }

    // Pull the panel + ALL its markers
    const { data: panel, error: panelErr } = await supabase
      .from('bloodwork_panels')
      .select('*')
      .eq('id', panelId)
      .eq('user_id', userId)
      .maybeSingle()
    if (panelErr || !panel) return NextResponse.json({ error: 'Panel not found' }, { status: 404 })

    const { data: markers } = await supabase
      .from('bloodwork_markers')
      .select('*')
      .eq('panel_id', panelId)
      .eq('user_id', userId)
      .order('category')
    if (!markers || markers.length === 0) {
      return NextResponse.json({ error: 'This panel has no markers to interpret. Re-upload the source file.' }, { status: 400 })
    }

    // Pull user context — profile (from onboarding) + active stack + prior panels (for trend analysis)
    const [
      profileRes,
      onboardingRes,
      substancesRes,
      priorPanelsRes,
      latestPhysiqueRes,
    ] = await Promise.all([
      supabase.from('user_profile').select('*').eq('id', userId).maybeSingle(),
      supabase.from('onboarding_progress').select('identity_data, rhythm_data, first_goal').eq('user_id', userId).maybeSingle(),
      supabase.from('substances').select('*').eq('user_id', userId).eq('active', true),
      supabase
        .from('bloodwork_panels')
        .select('id, drawn_on, panel_name, lab_provider')
        .eq('user_id', userId)
        .neq('id', panelId)
        .order('drawn_on', { ascending: false })
        .limit(3),
      supabase
        .from('physique_snapshots')
        .select('ts, bf_percent_estimate')
        .eq('user_id', userId)
        .order('ts', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    // Pull markers from prior panels for trend analysis
    let priorMarkers: Array<{ marker: string; value: number | null; unit: string | null; panel_id: string; drawn_on: string | null }> = []
    if (priorPanelsRes.data && priorPanelsRes.data.length > 0) {
      const priorPanelIds = priorPanelsRes.data.map(p => p.id)
      const { data: pm } = await supabase
        .from('bloodwork_markers')
        .select('marker, value, unit, panel_id')
        .in('panel_id', priorPanelIds)
      if (pm) {
        const dateByPanel = new Map(priorPanelsRes.data.map(p => [p.id, p.drawn_on]))
        priorMarkers = pm.map(m => ({
          ...m,
          drawn_on: dateByPanel.get(m.panel_id) ?? null,
        }))
      }
    }

    const identity = (onboardingRes.data?.identity_data || {}) as Record<string, unknown>

    const context = {
      panel: {
        id: panel.id,
        panel_name: panel.panel_name,
        lab_provider: panel.lab_provider,
        drawn_on: panel.drawn_on,
        source_format: panel.source_format,
        markers: markers.map(m => ({
          marker: m.marker,
          category: m.category,
          value: m.value,
          unit: m.unit,
          ref_low: m.ref_low,
          ref_high: m.ref_high,
          flag: m.flag,
        })),
      },
      user: {
        display_name: profileRes.data?.display_name || null,
        age: identity.age ?? null,
        sex: 'male',
        height_cm: identity.height_cm ?? null,
        weight_kg: identity.weight_kg ?? null,
        goals: onboardingRes.data?.first_goal || null,
        timezone: profileRes.data?.timezone || null,
        latest_body_fat_percent: latestPhysiqueRes.data?.bf_percent_estimate ?? null,
      },
      active_stack: (substancesRes.data || []).map(s => ({
        name: s.name,
        category: s.category,
        dose: s.dose ? `${s.dose}${s.dose_unit || ''}` : null,
        frequency: s.frequency,
        route: s.route,
        start_date: s.start_date,
        site_rotation: s.site_rotation,
        notes: s.notes,
      })),
      prior_panels_for_trend: (priorPanelsRes.data || []).map(p => ({
        id: p.id,
        panel_name: p.panel_name,
        drawn_on: p.drawn_on,
        markers: priorMarkers.filter(m => m.panel_id === p.id).map(m => ({
          marker: m.marker,
          value: m.value,
          unit: m.unit,
        })),
      })),
    }

    const rawResponse = await generateBloodworkInterpretation(JSON.stringify(context, null, 2))
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[interpret-bloodwork] no JSON in response:', rawResponse?.slice(0, 400))
      return NextResponse.json({ error: 'Interpreter could not generate a read — try again in a moment.' }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0])
    const interpretation = parsed
    const contextSummary = parsed.context_summary || ''

    // Insert a new interpretation row (allow multiple per panel — history of regenerations is useful)
    await supabase.from('bloodwork_interpretations').insert({
      user_id: userId,
      panel_id: panelId,
      interpretation,
      context_summary: contextSummary,
      model_used: 'claude-sonnet-4-5',
    })

    return NextResponse.json({
      cached: false,
      generated_at: new Date().toISOString(),
      interpretation,
      context_summary: contextSummary,
    })
  } catch (err) {
    console.error('[interpret-bloodwork] error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Interpreter failed' }, { status: 500 })
  }
}

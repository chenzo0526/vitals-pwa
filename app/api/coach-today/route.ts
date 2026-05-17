import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generateCoachInsights } from '@/lib/claude'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// AI Coach today — generates 1-3 cross-data insight cards for the user.
// Caches one row per user per local date so we don't burn Claude calls on every page load.
// Force-regenerate via ?refresh=1.
export async function GET(req: NextRequest) {
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

    const url = new URL(req.url)
    const forceRefresh = url.searchParams.get('refresh') === '1'

    // Get user profile (for timezone -> local date bucket)
    const { data: profile } = await supabase
      .from('user_profile')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    const tz = profile?.timezone || 'America/Los_Angeles'
    const todayLocal = new Date().toLocaleDateString('en-CA', { timeZone: tz }) // YYYY-MM-DD

    // Cache check
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from('coach_insights')
        .select('*')
        .eq('user_id', userId)
        .eq('generated_for_date', todayLocal)
        .maybeSingle()
      if (cached) {
        return NextResponse.json({
          cached: true,
          generated_at: cached.created_at,
          insights: cached.insights,
          context_summary: cached.context_summary,
        })
      }
    }

    // Pull all context streams in parallel
    const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const fortyEightHoursAheadIso = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    const nowIso = new Date().toISOString()

    const [
      onboardingRes,
      substancesRes,
      bloodworkPanelsRes,
      bloodworkMarkersRes,
      recentIntakeRes,
      scheduledWorkoutsRes,
      recentWorkoutsRes,
      latestPhysiqueRes,
      dailySummaryTodayRes,
    ] = await Promise.all([
      supabase.from('onboarding_progress').select('identity_data, rhythm_data, first_goal, thirty_day_checkpoint').eq('user_id', userId).maybeSingle(),
      supabase.from('substances').select('*').eq('user_id', userId).eq('active', true),
      supabase.from('bloodwork_panels').select('*').eq('user_id', userId).order('drawn_on', { ascending: false }).limit(2),
      supabase.from('bloodwork_markers').select('*, bloodwork_panels(drawn_on, panel_name)').eq('user_id', userId).order('panel_id'),
      supabase.from('intake_events').select('item, qty_text, calories, protein_g, carbs_g, fat_g, ts').eq('user_id', userId).gte('ts', sevenDaysAgoIso).order('ts', { ascending: false }).limit(50),
      supabase.from('workout_sessions').select('id, focus, scheduled_at, energy_pre').eq('user_id', userId).is('started_at', null).not('scheduled_at', 'is', null).gte('scheduled_at', nowIso).lte('scheduled_at', fortyEightHoursAheadIso).order('scheduled_at', { ascending: true }),
      supabase.from('workout_sessions').select('focus, started_at, ended_at, energy_pre, energy_post').eq('user_id', userId).not('started_at', 'is', null).gte('started_at', sevenDaysAgoIso).order('started_at', { ascending: false }).limit(10),
      supabase.from('physique_snapshots').select('ts, bf_percent_estimate, analysis_json').eq('user_id', userId).order('ts', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('daily_summary').select('*').eq('user_id', userId).eq('date', todayLocal).maybeSingle(),
    ])

    const identity = (onboardingRes.data?.identity_data || {}) as Record<string, unknown>
    const rhythm = (onboardingRes.data?.rhythm_data || {}) as Record<string, unknown>

    // Compose the context payload
    const context = {
      today: todayLocal,
      timezone: tz,
      profile: {
        display_name: profile?.display_name || null,
        age: identity.age ?? null,
        sex: 'male', // Vitals' MVP user-base is hormone-optimization-focused males; we'll widen this later
        height_cm: identity.height_cm ?? null,
        weight_kg: identity.weight_kg ?? null,
        training_days_per_week: rhythm.training_days_per_week ?? null,
        avg_sleep_hours: rhythm.avg_sleep_hours ?? null,
        goals: onboardingRes.data?.first_goal || null,
        thirty_day_checkpoint: onboardingRes.data?.thirty_day_checkpoint || null,
        timezone: tz,
      },
      active_stack: (substancesRes.data || []).map((s) => ({
        name: s.name,
        category: s.category,
        dose: s.dose ? `${s.dose}${s.dose_unit || ''}` : null,
        frequency: s.frequency,
        route: s.route,
        start_date: s.start_date,
        site_rotation: s.site_rotation,
        notes: s.notes,
      })),
      bloodwork: {
        latest_panel: bloodworkPanelsRes.data?.[0]
          ? {
              drawn_on: bloodworkPanelsRes.data[0].drawn_on,
              panel_name: bloodworkPanelsRes.data[0].panel_name,
              lab_provider: bloodworkPanelsRes.data[0].lab_provider,
            }
          : null,
        markers: (bloodworkMarkersRes.data || []).map((m) => ({
          marker: m.marker,
          category: m.category,
          value: m.value,
          unit: m.unit,
          ref_low: m.ref_low,
          ref_high: m.ref_high,
          flag: m.flag,
          drawn_on: (m as { bloodwork_panels?: { drawn_on?: string } }).bloodwork_panels?.drawn_on,
        })),
      },
      nutrition_today: dailySummaryTodayRes.data
        ? {
            calories: dailySummaryTodayRes.data.calories_total,
            protein_g: dailySummaryTodayRes.data.protein_g_total,
            carbs_g: dailySummaryTodayRes.data.carbs_g_total,
            fat_g: dailySummaryTodayRes.data.fat_g_total,
            water_ml: dailySummaryTodayRes.data.water_ml_total,
          }
        : null,
      recent_intake_last_7d: (recentIntakeRes.data || []).slice(0, 25),
      scheduled_workouts_next_48h: (scheduledWorkoutsRes.data || []).map((w) => ({
        focus: w.focus,
        when: w.scheduled_at,
        planned_energy: w.energy_pre,
      })),
      recent_workouts_last_7d: (recentWorkoutsRes.data || []).map((w) => ({
        focus: w.focus,
        started_at: w.started_at,
        ended_at: w.ended_at,
        energy_pre: w.energy_pre,
        energy_post: w.energy_post,
      })),
      latest_physique: latestPhysiqueRes.data
        ? {
            ts: latestPhysiqueRes.data.ts,
            bf_percent_estimate: latestPhysiqueRes.data.bf_percent_estimate,
            analysis: latestPhysiqueRes.data.analysis_json,
          }
        : null,
    }

    const rawResponse = await generateCoachInsights(JSON.stringify(context, null, 2))
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[coach-today] no JSON in response:', rawResponse?.slice(0, 300))
      return NextResponse.json({ error: 'Coach could not generate insights — try again in a moment.' }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0])
    const insights = parsed.insights || []
    const contextSummary = parsed.context_summary || ''

    // Store / upsert today's insights
    await supabase.from('coach_insights').upsert(
      {
        user_id: userId,
        generated_for_date: todayLocal,
        insights,
        context_summary: contextSummary,
        model_used: 'claude-sonnet-4-5',
      },
      { onConflict: 'user_id,generated_for_date' },
    )

    return NextResponse.json({
      cached: false,
      generated_at: new Date().toISOString(),
      insights,
      context_summary: contextSummary,
    })
  } catch (err) {
    console.error('[coach-today] error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Coach failed' }, { status: 500 })
  }
}

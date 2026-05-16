import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase-server'
import { generateRecommendationWithClaude } from '@/lib/claude'
import { TIER_LIMITS } from '@/lib/tier'
import { DISCLAIMER_VERSION, RECOMMENDATION_DISCLAIMER } from '@/lib/disclaimer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TASK_PROMPT = `You will receive 7 days of a user's tracked health data. Produce a weekly review with EXACTLY this JSON shape (no preamble, no markdown fences):

{
  "wins": [
    {"title": string, "detail": string}, // exactly 3 items
    ...
  ],
  "leaks": [
    {"title": string, "detail": string}, // exactly 3 items — gaps, missed protocols, regressions
    ...
  ],
  "adjustments": [
    {"title": string, "detail": string, "category": "lifestyle" | "stack" | "training" | "recovery" | "bloodwork"}, // exactly 3 items
    ...
  ],
  "bloodwork_due": [
    {"panel": string, "reason": string, "suggested_timeframe": string}
  ],
  "experiment": {"title": string, "hypothesis": string, "protocol": string, "duration_days": number}
}

Constraints:
- "adjustments" must NEVER prescribe specific drug doses or substance protocols. Frame as information ("consider discussing X with a qualified practitioner").
- Lifestyle adjustments (sleep timing, food patterns, training volume, cold/heat exposure, meditation) MAY be specific.
- Be direct and concise. No filler.`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const forceModel = body.model as string | undefined

    const supabase = getServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }
    const userId = user.id

    // Pull tier
    let tier: 'free' | 'pro' | 'premium' = 'pro'
    const { data: profile } = await supabase.from('user_profile').select('tier').eq('id', userId).maybeSingle()
    if (profile) tier = (profile as { tier: 'free' | 'pro' | 'premium' }).tier

    const limits = TIER_LIMITS[tier]
    if (!limits.rediagnosisAccess) {
      return NextResponse.json(
        { error: 'Rediagnosis requires Pro or Premium. Upgrade in /billing.', tier },
        { status: 403 },
      )
    }

    const model = forceModel || limits.rediagnosisModel || 'claude-sonnet-4-5'

    // Pull last 7 days of data (RLS filters to this user automatically)
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const [intakes, workouts, practices, substances, bloodwork, bwMarkers, customLogs] = await Promise.all([
      supabase.from('intake_events').select('*').gte('ts', since).limit(200),
      supabase.from('workout_sessions').select('*').gte('started_at', since),
      supabase.from('practice_sessions').select('*').gte('ts', since),
      supabase.from('substances').select('*').eq('active', true),
      supabase.from('bloodwork_panels').select('*').order('ts', { ascending: false }).limit(2),
      supabase.from('bloodwork_markers').select('*, bloodwork_panels(ts)').limit(80),
      supabase.from('custom_metrics_log').select('*, custom_metrics_defs(name, unit)').gte('ts', since),
    ])

    const context = `USER DATA (last 7 days):

INTAKE EVENTS (${intakes.data?.length || 0}):
${(intakes.data || []).slice(0, 50).map((i: { ts: string; item: string; calories?: number; protein_g?: number }) => `- ${i.ts}: ${i.item} (${i.calories || '?'}kcal, ${i.protein_g || '?'}gP)`).join('\n')}

WORKOUTS (${workouts.data?.length || 0}):
${(workouts.data || []).map((w: { started_at: string; focus?: string; energy_pre?: number; energy_post?: number }) => `- ${w.started_at} ${w.focus || 'general'} energy ${w.energy_pre}→${w.energy_post}`).join('\n')}

PRACTICES (${practices.data?.length || 0}):
${(practices.data || []).map((p: { ts: string; category: string; practice_type: string; duration_min?: number; mood_pre?: number; mood_post?: number }) => `- ${p.ts} ${p.category}/${p.practice_type} ${p.duration_min}min mood ${p.mood_pre}→${p.mood_post}`).join('\n')}

ACTIVE STACK (${substances.data?.length || 0}):
${(substances.data || []).map((s: { name: string; dose?: number; dose_unit?: string; frequency?: string; route?: string; start_date?: string }) => `- ${s.name} ${s.dose || ''}${s.dose_unit || ''} ${s.frequency || ''} ${s.route || ''} since ${s.start_date}`).join('\n')}

RECENT BLOODWORK PANELS:
${(bloodwork.data || []).map((b: { drawn_on?: string; ts?: string; panel_name?: string }) => `- ${b.drawn_on || b.ts}: ${b.panel_name}`).join('\n')}

RECENT MARKERS:
${(bwMarkers.data || []).slice(0, 40).map((m: { marker: string; value?: number; unit?: string; ref_low?: number; ref_high?: number; flag?: string }) => `- ${m.marker}: ${m.value}${m.unit || ''} (ref ${m.ref_low ?? '—'}-${m.ref_high ?? '—'}) flag=${m.flag}`).join('\n')}

CUSTOM METRICS LOGS:
${(customLogs.data || []).slice(0, 40).map((c: { ts: string; custom_metrics_defs?: { name: string }; value?: number; value_bool?: boolean }) => `- ${c.ts} ${c.custom_metrics_defs?.name}: ${c.value ?? c.value_bool}`).join('\n')}

User tier: ${tier}. Today: ${new Date().toISOString().split('T')[0]}.`

    const raw = await generateRecommendationWithClaude(TASK_PROMPT, context, model)
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[rediagnosis] no JSON in response:', raw?.slice(0, 300))
      return NextResponse.json({ error: 'Failed to generate review. Please try again.' }, { status: 500 })
    }
    const parsed = JSON.parse(jsonMatch[0])

    // Save report (RLS check: user_id must equal auth.uid())
    const { data: report } = await supabase.from('rediagnosis_reports').insert({
      user_id: userId,
      model_used: model,
      tier_at_time: tier,
      period_start: since,
      period_end: new Date().toISOString(),
      wins: parsed.wins,
      leaks: parsed.leaks,
      adjustments: parsed.adjustments,
      bloodwork_due: parsed.bloodwork_due,
      experiment: parsed.experiment,
      raw_response: raw,
      disclaimer_version: DISCLAIMER_VERSION,
    }).select().single()

    // Audit every recommendation
    const auditRows = (parsed.adjustments || []).map((a: { title: string; detail: string }) => ({
      user_id: userId,
      source: 'rediagnosis',
      model_used: model,
      tier_at_time: tier,
      recommendation_text: `${a.title}: ${a.detail}`,
      disclaimer_version: DISCLAIMER_VERSION,
      disclaimer_text: RECOMMENDATION_DISCLAIMER,
    }))
    if (auditRows.length) await supabase.from('recommendations_audit').insert(auditRows)

    return NextResponse.json({ report_id: report?.id, ...parsed, model_used: model, tier_at_time: tier })
  } catch (err) {
    console.error('[rediagnosis] error:', err)
    return NextResponse.json({ error: 'Failed to generate review. Please try again.' }, { status: 500 })
  }
}

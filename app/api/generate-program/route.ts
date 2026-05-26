import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } },
  )
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const userId = user.id

    const body = await req.json().catch(() => ({}))
    const daysPerWeek = Math.max(2, Math.min(6, Number(body?.days_per_week) || 4))
    const weeks = Math.max(3, Math.min(8, Number(body?.weeks) || 6))
    const equipment = typeof body?.equipment === 'string' ? body.equipment.slice(0, 200) : 'full commercial gym'
    const notes = typeof body?.notes === 'string' ? body.notes.slice(0, 400) : ''

    const sevenWeeksAgo = new Date(Date.now() - 60 * 86400000).toISOString()
    const [onbRes, physRes, setsRes] = await Promise.all([
      supabase.from('onboarding_progress').select('first_goal, identity_data, rhythm_data').eq('user_id', userId).maybeSingle(),
      supabase.from('physique_snapshots').select('analysis_json, bf_percent_estimate').eq('user_id', userId).order('ts', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('workout_sets').select('exercise_name, weight_lb, reps, created_at').eq('user_id', userId).eq('is_warmup', false).gte('created_at', sevenWeeksAgo).order('created_at', { ascending: false }).limit(200),
    ])

    // Best recent top set per exercise — gives the AI real starting weights.
    const known: Record<string, { weight: number; reps: number }> = {}
    for (const s of (setsRes.data || []) as Array<{ exercise_name: string; weight_lb: number | null; reps: number | null }>) {
      const k = s.exercise_name
      const w = s.weight_lb || 0
      if (!known[k] || w > known[k].weight) known[k] = { weight: w, reps: s.reps || 0 }
    }

    const identity = (onbRes.data?.identity_data || {}) as Record<string, unknown>
    const phys = physRes.data?.analysis_json as Record<string, unknown> | undefined

    const context = {
      goal: onbRes.data?.first_goal || 'build muscle',
      sex: 'male',
      age: identity.age ?? null,
      bodyweight_lb: identity.weight_kg ? Math.round(Number(identity.weight_kg) * 2.20462) : null,
      bf_percent: physRes.data?.bf_percent_estimate ?? null,
      weak_points: phys?.weak_points || phys?.top_3_weak_points || null,
      suggested_focus: phys?.suggested_focus_next_30_days || null,
      recent_top_sets: known, // exercise -> best recent {weight, reps}; use these as starting weights
      days_per_week: daysPerWeek,
      weeks,
      equipment,
      user_notes: notes,
      context_note: 'User is an intermediate lifter returning to training after a layoff — ramp conservatively, leave reps in reserve early, do not prescribe near-maximal loads in week 1.',
    }

    const system = `You are an elite strength & hypertrophy coach designing a mesocycle. Use the user's real data. Return ONLY valid JSON in EXACTLY this shape (no prose):
{
  "name": string,
  "weeks": number,
  "days": [
    { "label": string, "exercises": [
      { "name": string, "sets": number, "weight_lb": number, "reps": number, "prog": "weight" | "reps", "inc": number }
    ]}
  ]
}

Rules:
- Design ${daysPerWeek} training days, a ${weeks}-week block. Label days by clear intent (e.g. "Push", "Pull", "Legs", "Upper" — Push/Pull mixed, "Lower").
- ⚠️ MOVEMENTS MUST MATCH THE DAY'S INTENT. Read your own day label and only place movements that fit:
  * PUSH / chest / shoulders / triceps days → bench/incline/OH press, dips, flyes, lateral raises, triceps work.
  * PULL / back / biceps days → rows, pulldowns, pull-ups, face pulls, rear delts, curls. NEVER put bench/incline press/flyes/triceps work here.
  * LEGS days → squats, RDLs, lunges, hip thrusts, leg press, curls, extensions, calves.
  * UPPER days (combined push+pull) → mix presses + rows in roughly equal amounts.
  * LOWER days → quad + posterior chain split.
  Before finalizing the JSON, RE-READ each day and remove any movement that doesn't belong (e.g. an incline DB press on a "Back" day must be removed/swapped).
- 3-6 movements per day, 2-4 working sets each. Prioritize the user's weak_points/suggested_focus with extra volume.
- STARTING WEIGHTS: when an exercise (or a close variant) appears in recent_top_sets, set weight_lb at ~90% of that top set (conservative, leaving reps in reserve for a returning lifter). For new exercises, estimate a sensible starting weight from their bodyweight + the loads they handle on similar lifts. Never prescribe a number you can't justify from their data.
- progression: most compound lifts "prog":"weight" with "inc": 5 (lb/week); isolation/machine work that's already heavy can use "prog":"reps" with "inc": 1. Keep it sane.
- Respect equipment ("${equipment}") and any user notes. Match the user's goal.
- Realistic, balanced, injury-aware for someone ramping back from a layoff.`

    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      temperature: 0.5,
      system,
      messages: [{ role: 'user', content: `Design my program from this data:\n\n${JSON.stringify(context, null, 2)}` }],
    })
    const c = resp.content[0]
    const txt = c.type === 'text' ? c.text : ''
    const m = txt.match(/\{[\s\S]*\}/)
    if (!m) return NextResponse.json({ error: 'Could not generate a program. Try again.' }, { status: 500 })
    const plan = JSON.parse(m[0])
    return NextResponse.json(plan)
  } catch (err) {
    console.error('[generate-program] error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Generation failed' }, { status: 500 })
  }
}

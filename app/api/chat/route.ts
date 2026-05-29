import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import { computeCalorieTarget, inferCalorieGoal } from '@/lib/calorieTarget'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch { /* server ctx */ }
        },
      },
    },
  )
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'log_food',
    description: "Log food/drink the user says they consumed. Estimate macros yourself from nutrition knowledge — do NOT ask for exact numbers. Combine everything in one call. Only call when the user clearly states they ate/drank something (e.g. 'log 2 eggs and a shake', 'I had chicken and rice').",
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: "Short label of the meal, e.g. '2 eggs, oatmeal, whey shake'" },
        calories: { type: 'number' },
        protein_g: { type: 'number' },
        carbs_g: { type: 'number' },
        fat_g: { type: 'number' },
        water_ml: { type: 'number', description: 'Water content in ml if a drink, else 0' },
        sodium_mg: { type: 'number', description: 'Estimated sodium in mg' },
        potassium_mg: { type: 'number', description: 'Estimated potassium in mg' },
      },
      required: ['summary', 'calories', 'protein_g', 'carbs_g', 'fat_g'],
    },
  },
  {
    name: 'log_water',
    description: "Log water intake when the user says they drank water (e.g. 'I drank a liter', 'log 500ml water', 'had a glass of water' = ~250ml).",
    input_schema: {
      type: 'object',
      properties: { ml: { type: 'number' } },
      required: ['ml'],
    },
  },
  {
    name: 'log_workout',
    description: "Log a workout the user describes (e.g. 'did 4 sets of squats at 185 for 8', 'benched 3x10 at 135, then incline DB 3x12 at 50'). Parse every exercise and every set. Create one session with all the sets.",
    input_schema: {
      type: 'object',
      properties: {
        focus: { type: 'string', description: "Body part / focus label, e.g. 'Legs', 'Push', 'Back'. Infer if not stated." },
        exercises: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              sets: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { weight_lb: { type: 'number' }, reps: { type: 'number' }, rpe: { type: 'number' } },
                },
              },
            },
            required: ['name', 'sets'],
          },
        },
      },
      required: ['exercises'],
    },
  },
  {
    name: 'delete_last_food',
    description: "Delete the user's most recent food/water log when they say they made a mistake (e.g. 'remove that', 'undo the last one', 'delete the shake I just logged').",
    input_schema: { type: 'object', properties: {} },
  },
]

type ChatMsg = { role: 'user' | 'assistant'; content: string }

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const userId = user.id

    const body = await req.json()
    const incoming: ChatMsg[] = Array.isArray(body?.messages) ? body.messages.slice(-20) : []
    if (incoming.length === 0) return NextResponse.json({ error: 'No messages' }, { status: 400 })

    // Use the user's real timezone so "today's" intake bucket is correct near midnight
    // (was hardcoded Pacific — wrong for testers in other zones). Matches coach-today.
    const { data: tzProfile } = await supabase.from('user_profile').select('timezone').eq('id', userId).maybeSingle()
    const tz = (tzProfile as { timezone?: string } | null)?.timezone || 'America/Los_Angeles'
    const todayLocal = new Date().toLocaleDateString('en-CA', { timeZone: tz })
    const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const startOfTodayIso = new Date(`${todayLocal}T00:00:00`).toISOString()

    const [
      onbRes, todayIntakeRes, recentWorkoutsRes, workoutSetsRes,
      bioLatestRes, bioWeekRes, substancesRes, physiqueRes, checkinRes,
    ] = await Promise.all([
      supabase.from('onboarding_progress').select('identity_data, rhythm_data, first_goal').eq('user_id', userId).maybeSingle(),
      supabase.from('intake_events').select('item, qty_text, calories, protein_g, carbs_g, fat_g, water_ml, ts').eq('user_id', userId).gte('ts', startOfTodayIso).order('ts', { ascending: true }),
      supabase.from('workout_sessions').select('id, focus, started_at, ended_at, energy_post').eq('user_id', userId).not('started_at', 'is', null).gte('started_at', sevenDaysAgoIso).order('started_at', { ascending: false }).limit(8),
      supabase.from('workout_sets').select('session_id, exercise_name, set_number, weight_lb, reps').eq('user_id', userId).gte('created_at', sevenDaysAgoIso).limit(200),
      supabase.from('biometric_entries').select('for_date, hrv_rmssd, rhr_bpm, sleep_total_min, steps, active_calories').eq('user_id', userId).order('for_date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('biometric_entries').select('for_date, active_calories').eq('user_id', userId).not('active_calories', 'is', null).gte('for_date', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)).order('for_date', { ascending: false }).limit(7),
      supabase.from('substances').select('name, dose, dose_unit, frequency').eq('user_id', userId).eq('active', true),
      supabase.from('physique_snapshots').select('bf_percent_estimate, analysis_json, ts').eq('user_id', userId).order('ts', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('daily_checkins').select('for_date, mood, energy, sleep_quality, stress_level, concerns, notes').eq('user_id', userId).order('for_date', { ascending: false }).limit(1).maybeSingle(),
    ])

    const identity = (onbRes.data?.identity_data || {}) as Record<string, unknown>
    const rhythm = (onbRes.data?.rhythm_data || {}) as Record<string, unknown>
    const goal = inferCalorieGoal(onbRes.data?.first_goal)

    // wearable active avg (clamped, excl today)
    const bioWeek = (bioWeekRes.data || []) as Array<{ for_date: string; active_calories: number | null }>
    const eligibleActive = bioWeek.filter((r) => r.active_calories != null && r.active_calories > 50 && r.for_date !== todayLocal)
    const wearableActive = eligibleActive.length ? Math.round(eligibleActive.reduce((a, r) => a + Math.min(2500, r.active_calories || 0), 0) / eligibleActive.length) : null

    const calTarget = computeCalorieTarget({
      age: identity.age ? Number(identity.age) : null,
      sex: identity.sex === 'female' ? 'female' : 'male',
      weight_kg: identity.weight_kg ? Number(identity.weight_kg) : null,
      height_cm: identity.height_cm ? Number(identity.height_cm) : null,
      training_days_per_week: rhythm.training_days_per_week ? Number(rhythm.training_days_per_week) : null,
      goal,
      wearable_active_kcal: wearableActive,
    })

    const intake = (todayIntakeRes.data || []) as Array<{ item: string; calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null; water_ml: number | null; ts: string }>
    const totals = intake.reduce((a, e) => ({
      calories: a.calories + (e.calories || 0),
      protein_g: a.protein_g + (e.protein_g || 0),
      carbs_g: a.carbs_g + (e.carbs_g || 0),
      fat_g: a.fat_g + (e.fat_g || 0),
      water_ml: a.water_ml + (e.water_ml || 0),
    }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, water_ml: 0 })

    // group sets by session
    const sets = (workoutSetsRes.data || []) as Array<{ session_id: string; exercise_name: string; set_number: number; weight_lb: number | null; reps: number | null }>
    const workouts = (recentWorkoutsRes.data || []).map((w) => {
      const ws = sets.filter((s) => s.session_id === (w as { id: string }).id)
      const byEx: Record<string, number> = {}
      ws.forEach((s) => { byEx[s.exercise_name] = (byEx[s.exercise_name] || 0) + 1 })
      return {
        focus: w.focus, started_at: w.started_at, ended_at: w.ended_at, energy_post: w.energy_post,
        exercises: Object.entries(byEx).map(([name, n]) => `${name} (${n} sets)`),
      }
    })

    const physAnalysis = physiqueRes.data?.analysis_json as Record<string, unknown> | undefined

    const context = {
      today: todayLocal,
      identity: { age: identity.age, weight_lb: identity.weight_kg ? Math.round(Number(identity.weight_kg) * 2.20462) : null, height_cm: identity.height_cm, stated_goal: onbRes.data?.first_goal, inferred_goal: goal },
      calorie_target: calTarget.is_complete ? { target_kcal: calTarget.target, tdee: calTarget.tdee, source: calTarget.tdee_source, protein_g: calTarget.protein_g_target, carbs_g: calTarget.carbs_g_target, fat_g: calTarget.fat_g_target } : null,
      today_intake: { totals, items: intake.map((e) => ({ item: e.item, kcal: e.calories, p: e.protein_g, c: e.carbs_g, f: e.fat_g, time: new Date(e.ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz }) })) },
      recent_workouts_7d: workouts,
      latest_recovery: bioLatestRes.data || null,
      active_stack: substancesRes.data || [],
      latest_physique: physAnalysis ? { bf_percent: physiqueRes.data?.bf_percent_estimate, weak_points: physAnalysis.weak_points || physAnalysis.top_3_weak_points, focus: physAnalysis.suggested_focus_next_30_days } : null,
      latest_checkin: checkinRes.data || null,
    }

    const system = `You are VITALS — the user's personal AI health agent. Think Jarvis for their body: sharp, fast, a little wit, never robotic or corporate. You have their full real-time data below.

WHO YOU ARE
- Talk like a knowledgeable training partner who happens to know endocrinology and nutrition. Concise. Confident. Human.
- The user is bought-in but BUSY and gets bored of friction. Be the opposite of a form. One or two tight sentences usually beats a paragraph. Get to the point.

WHAT YOU CAN DO
- LOG things when they tell you: log_food (estimate macros yourself — never ask for numbers), log_water, or log_workout (parse every exercise + set). Made a mistake? delete_last_food removes the most recent log. After logging, confirm in ONE line with the running daily total vs target (or the workout summary).
- ANSWER from their data: what they've eaten, calories/protein left, recovery, recent training, stack, body comp. Use real numbers from the context.
- COACH: if they ask whether to train / how recovered they are / what to eat, give a clear call using recovery + recent training + soreness cues.

CRITICAL JUDGEMENT
- If they're returning from a long layoff or recently trained a muscle hard and it's still sore, do NOT push more volume — protect them. Ramp gradually. Recovery and soreness OUTRANK hitting volume targets.
- Use latest_recovery (HRV/RHR/sleep/steps) and recent_workouts when giving training calls. Reference the actual numbers.
- You are an information tool, not a prescriber. For substance/protocol changes, inform — don't command — and suggest a knowledgeable practitioner for big calls.

STYLE
- No markdown headers. No bullet dumps unless they ask for a list. Talk like a text message from a smart friend.
- When you log something, be quick: "Logged — 320 kcal, 40g protein. You're at 1,200 / 2,400, 95g protein in." 

USER CONTEXT (live):
${JSON.stringify(context, null, 2)}`

    // Build message history
    const messages: Anthropic.MessageParam[] = incoming.map((m) => ({ role: m.role, content: m.content }))

    const actions: string[] = []
    let finalText = ''

    for (let iter = 0; iter < 3; iter++) {
      const resp = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        temperature: 0.4,
        system,
        tools: TOOLS,
        messages,
      })

      // collect text
      const textParts = resp.content.filter((c) => c.type === 'text') as Anthropic.TextBlock[]
      if (textParts.length) finalText = textParts.map((t) => t.text).join('\n').trim()

      if (resp.stop_reason !== 'tool_use') break

      const toolUses = resp.content.filter((c) => c.type === 'tool_use') as Anthropic.ToolUseBlock[]
      messages.push({ role: 'assistant', content: resp.content })

      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const tu of toolUses) {
        const input = tu.input as Record<string, number | string>
        try {
          if (tu.name === 'log_food') {
            const { error } = await supabase.from('intake_events').insert({
              user_id: userId, ts: new Date().toISOString(),
              item: String(input.summary || 'Logged via chat'),
              qty_text: 'via chat',
              calories: Math.round(Number(input.calories) || 0),
              protein_g: Math.round((Number(input.protein_g) || 0) * 10) / 10,
              carbs_g: Math.round((Number(input.carbs_g) || 0) * 10) / 10,
              fat_g: Math.round((Number(input.fat_g) || 0) * 10) / 10,
              water_ml: Math.round(Number(input.water_ml) || 0),
              sodium_mg: Math.round(Number(input.sodium_mg) || 0),
              potassium_mg: Math.round(Number(input.potassium_mg) || 0),
              parsed_by: 'chat', raw_input: incoming[incoming.length - 1]?.content?.slice(0, 200) || '',
            })
            if (error) throw new Error(error.message)
            actions.push(`food:${input.summary}`)
            toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: `Logged: ${input.summary} (${input.calories} kcal, ${input.protein_g}g protein).` })
          } else if (tu.name === 'log_water') {
            const ml = Math.round(Number(input.ml) || 0)
            const { error } = await supabase.from('intake_events').insert({
              user_id: userId, ts: new Date().toISOString(), item: 'Water', qty_text: `${ml} ml`,
              calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, water_ml: ml, parsed_by: 'chat', raw_input: '',
            })
            if (error) throw new Error(error.message)
            actions.push(`water:${ml}`)
            toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: `Logged ${ml} ml water.` })
          } else if (tu.name === 'log_workout') {
            const wi = input as unknown as { focus?: string; exercises?: Array<{ name: string; sets: Array<{ weight_lb?: number; reps?: number; rpe?: number }> }> }
            const exs = Array.isArray(wi.exercises) ? wi.exercises : []
            if (exs.length === 0) {
              toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: 'No exercises parsed.', is_error: true })
            } else {
              const { data: sess, error: sErr } = await supabase
                .from('workout_sessions')
                .insert({ user_id: userId, focus: String(wi.focus || 'Workout'), started_at: new Date().toISOString(), ended_at: new Date().toISOString() })
                .select('id').single()
              if (sErr || !sess) throw new Error(sErr?.message || 'session insert failed')
              const rows: Array<Record<string, unknown>> = []
              for (const ex of exs) {
                let n = 1
                for (const st of (ex.sets || [])) {
                  rows.push({ session_id: sess.id, user_id: userId, exercise_name: ex.name, set_number: n++, weight_lb: st.weight_lb ?? null, reps: st.reps ?? null, rpe: st.rpe ?? null })
                }
              }
              if (rows.length > 0) {
                const { error: setErr } = await supabase.from('workout_sets').insert(rows)
                if (setErr) throw new Error(setErr.message)
              }
              actions.push(`workout:${exs.length} exercises, ${rows.length} sets`)
              toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: `Logged workout: ${exs.map((e) => e.name).join(', ')} (${rows.length} sets).` })
            }
          } else if (tu.name === 'delete_last_food') {
            const { data: last } = await supabase
              .from('intake_events').select('id, item').eq('user_id', userId)
              .order('ts', { ascending: false }).limit(1).maybeSingle()
            if (!last) {
              toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: 'Nothing recent to delete.' })
            } else {
              const { error: delErr } = await supabase.from('intake_events').delete().eq('id', (last as { id: string }).id)
              if (delErr) throw new Error(delErr.message)
              actions.push(`deleted:${(last as { item: string }).item}`)
              toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: `Deleted: ${(last as { item: string }).item}.` })
            }
          } else {
            toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: 'Unknown tool', is_error: true })
          }
        } catch (e) {
          toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: `Failed: ${e instanceof Error ? e.message : 'error'}`, is_error: true })
        }
      }
      messages.push({ role: 'user', content: toolResults })
    }

    return NextResponse.json({ reply: finalText || 'Done.', actions })
  } catch (err) {
    console.error('[chat] error:', err)
    const msg = err instanceof Error ? err.message : 'Chat failed'
    const low = /credit balance|insufficient_quota|rate_limit|overloaded/i.test(msg)
    const friendly = low
      ? "I'm out of AI credit right now — top up at console.anthropic.com and I'll be back. (Your logs are safe.)"
      : "I hit a snag on that one. Give me another shot in a sec."
    return NextResponse.json({ error: friendly, code: low ? 'ai_credit' : 'ai_error' }, { status: 503 })
  }
}

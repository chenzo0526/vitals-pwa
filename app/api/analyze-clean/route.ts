import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { analyzeImageWithClaude, CLEAN_FOOD_PROMPT } from '@/lib/claude'
import { friendlyAiError } from '@/lib/aiError'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // Auth gate — Claude vision is expensive; don't leave this open to credit-drain.
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } },
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sign in to use this.' }, { status: 401 })

    const { image, mediaType } = await req.json()
    if (!image) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    // Pull the user's goals/conditions to personalize the analysis (best-effort).
    let userContext = 'No specific conditions provided — analyze generally for a health-conscious adult.'
    try {
      const { data: onb } = await supabase
        .from('onboarding_progress').select('first_goal, identity_data').eq('user_id', user.id).maybeSingle()
      const goal = onb?.first_goal
      const conditions = (onb?.identity_data as { conditions?: string; health_notes?: string } | null)
      const bits: string[] = []
      if (goal) bits.push(`Goal: ${goal}.`)
      if (conditions?.conditions) bits.push(`Conditions: ${conditions.conditions}.`)
      if (conditions?.health_notes) bits.push(`Notes: ${conditions.health_notes}.`)
      if (bits.length) userContext = `USER CONTEXT — personalize flags to this: ${bits.join(' ')}`
    } catch { /* personalization is best-effort */ }

    const prompt = CLEAN_FOOD_PROMPT.replace('{{USER_CONTEXT}}', userContext)
    const raw = await analyzeImageWithClaude(image, mediaType || 'image/jpeg', prompt)
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[analyze-clean] no JSON:', raw?.slice(0, 200))
      return NextResponse.json({ error: 'Could not analyze that image. Try a clearer shot of the food or label.' }, { status: 500 })
    }
    return NextResponse.json(JSON.parse(jsonMatch[0]))
  } catch (err) {
    console.error('[analyze-clean] error:', err)
    const ai = friendlyAiError(err, 'check that food')
    return NextResponse.json({ error: ai.message, code: ai.code }, { status: ai.status })
  }
}

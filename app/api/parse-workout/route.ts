import { NextRequest, NextResponse } from 'next/server'
import { parseWorkoutWithClaude } from '@/lib/claude'
import { friendlyAiError } from '@/lib/aiError'
import { getServerUser } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!(await getServerUser())) return NextResponse.json({ error: 'Sign in to use this.' }, { status: 401 })
    const { text } = await req.json()
    if (!text) return NextResponse.json({ error: 'No text provided' }, { status: 400 })

    const raw = await parseWorkoutWithClaude(text)
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[parse-workout] no JSON in response:', raw?.slice(0, 200))
      return NextResponse.json({ error: 'Failed to parse workout. Please try again.' }, { status: 500 })
    }

    return NextResponse.json(JSON.parse(jsonMatch[0]))
  } catch (err) {
    console.error('[parse-workout] error:', err)
    const ai = friendlyAiError(err, 'log that workout')
    return NextResponse.json({ error: ai.message, code: ai.code }, { status: ai.status })
  }
}

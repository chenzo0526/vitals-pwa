import { NextRequest, NextResponse } from 'next/server'
import { parseTextWithClaude } from '@/lib/claude'
import { friendlyAiError } from '@/lib/aiError'
import { getServerUser } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!(await getServerUser())) return NextResponse.json({ error: 'Sign in to use this.' }, { status: 401 })
    const { text } = await req.json()
    if (!text) return NextResponse.json({ error: 'No text provided' }, { status: 400 })

    const raw = await parseTextWithClaude(text)
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[parse-text] no JSON in response:', raw?.slice(0, 200))
      return NextResponse.json({ error: 'Failed to parse meal. Please try again.' }, { status: 500 })
    }

    return NextResponse.json(JSON.parse(jsonMatch[0]))
  } catch (err) {
    console.error('[parse-text] error:', err)
    const ai = friendlyAiError(err, 'log that meal')
    return NextResponse.json({ error: ai.message, code: ai.code }, { status: ai.status })
  }
}

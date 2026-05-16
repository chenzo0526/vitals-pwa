import { NextRequest, NextResponse } from 'next/server'
import { analyzeImageWithClaude, BLOODWORK_PARSE_PROMPT } from '@/lib/claude'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { image, mediaType } = await req.json()
    if (!image) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    const raw = await analyzeImageWithClaude(
      image,
      mediaType || 'image/jpeg',
      BLOODWORK_PARSE_PROMPT,
      'claude-sonnet-4-5'
    )

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[parse-bloodwork] no JSON in response:', raw?.slice(0, 200))
      return NextResponse.json({ error: 'Failed to parse bloodwork. Please try again.' }, { status: 500 })
    }

    return NextResponse.json(JSON.parse(jsonMatch[0]))
  } catch (err) {
    console.error('[parse-bloodwork] error:', err)
    return NextResponse.json({ error: 'Failed to parse bloodwork. Please try again.' }, { status: 500 })
  }
}

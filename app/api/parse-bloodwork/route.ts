import { NextRequest, NextResponse } from 'next/server'
import {
  analyzeImageWithClaude,
  analyzePdfWithClaude,
  BLOODWORK_PARSE_PROMPT,
} from '@/lib/claude'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Multi-page lab reports can run long; give Claude headroom to extract every marker.
const MAX_TOKENS_FOR_BLOODWORK = 4096

export async function POST(req: NextRequest) {
  try {
    const { image, mediaType } = await req.json()
    if (!image) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const isPdf = mediaType === 'application/pdf'
    const raw = isPdf
      ? await analyzePdfWithClaude(image, BLOODWORK_PARSE_PROMPT, 'claude-sonnet-4-5', MAX_TOKENS_FOR_BLOODWORK)
      : await analyzeImageWithClaude(image, (mediaType || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp', BLOODWORK_PARSE_PROMPT, 'claude-sonnet-4-5')

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[parse-bloodwork] no JSON in response:', raw?.slice(0, 200))
      return NextResponse.json({ error: 'Could not extract markers from this file. Try a clearer photo or a different PDF.' }, { status: 500 })
    }

    return NextResponse.json(JSON.parse(jsonMatch[0]))
  } catch (err) {
    console.error('[parse-bloodwork] error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to parse bloodwork. Please try again.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

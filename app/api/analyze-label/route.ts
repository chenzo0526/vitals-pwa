import { NextRequest, NextResponse } from 'next/server'
import { analyzeImageWithClaude, LABEL_OCR_PROMPT } from '@/lib/claude'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { image, mediaType } = await req.json()
    if (!image) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    const raw = await analyzeImageWithClaude(image, mediaType || 'image/jpeg', LABEL_OCR_PROMPT)
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[analyze-label] no JSON in response:', raw?.slice(0, 200))
      return NextResponse.json({ error: 'Failed to read nutrition label. Please try again.' }, { status: 500 })
    }

    return NextResponse.json(JSON.parse(jsonMatch[0]))
  } catch (err) {
    console.error('[analyze-label] error:', err)
    return NextResponse.json({ error: 'Failed to read nutrition label. Please try again.' }, { status: 500 })
  }
}

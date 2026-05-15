import { NextRequest, NextResponse } from 'next/server'
import { analyzeImageWithClaude, PHYSIQUE_ANALYSIS_PROMPT } from '@/lib/claude'

export async function POST(req: NextRequest) {
  try {
    const { image, mediaType } = await req.json()
    if (!image) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    // PRIVACY: Image is processed server-side and immediately discarded.
    // Only the text analysis is returned — no image is persisted.
    const raw = await analyzeImageWithClaude(image, mediaType || 'image/jpeg', PHYSIQUE_ANALYSIS_PROMPT)
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Failed to parse response' }, { status: 500 })

    return NextResponse.json(JSON.parse(jsonMatch[0]))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
